import {
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import axios from "axios";

import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Clock3,
  Coins,
  Flag,
  Globe2,
  Landmark,
  Lightbulb,
  Loader2,
  Rocket,
  Shield,
  Sparkles,
  Target,
  Users,
  WandSparkles,
  XCircle,
} from "lucide-react";

import { UserContext } from "../../Utils/UserContext";

/* =========================================================
   Helpers
========================================================= */

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isEmpty(value) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (isEmpty(value)) return [];
  return [value];
}

function getText(value) {
  if (value === null || value === undefined) return "";

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return (
      value.text ||
      value.description ||
      value.definition ||
      value.answer ||
      value.expected_answer ||
      value.label ||
      value.title ||
      value.term ||
      value.rule ||
      value.caption ||
      value.meaning ||
      ""
    );
  }

  return String(value);
}

/*
 * نفس فكرة ScienceLesson:
 * يمكن للـ component استقبال:
 * - axis object كامل من API
 * - content فقط
 * - data.axis.content
 * - data.answer / data.lesson
 */
function normalizeLesson(data) {
  return (
    data?.axis?.content ||
    data?.content ||
    data?.answer ||
    data?.lesson ||
    data ||
    null
  );
}

function normalizeAxis(data, lesson) {
  return (
    data?.axis || {
      id:
        data?.id ??
        data?.axis_id ??
        lesson?.axis_id ??
        null,

      title:
        data?.title ||
        lesson?.axis_title ||
        lesson?.title ||
        "درس التاريخ",

      tag:
        data?.tag ||
        lesson?.axis_tag ||
        "",
    }
  );
}

function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ar");
}

function formatHistoryDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ar-DZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function scrollToHistoryTop() {
  window.requestAnimationFrame(() => {
    document
      .getElementById("history-course-card-top")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  });
}

/* =========================================================
   Normalize learning path / mastery
========================================================= */

function normalizeStoryScene(scene, index = 0) {
  if (!scene) return null;

  const narration = toArray(scene?.narration);

  const content = {
    teacher:
      narration.join("\n\n") ||
      scene?.teacher ||
      "",

    simple_answer:
      scene?.checkpoint?.answer ||
      "",

    memory_hook:
      scene?.memory_bridge?.formula ||
      scene?.memory_card?.back ||
      "",

    takeaway:
      scene?.checkpoint?.answer ||
      "",

    groups:
      scene?.key_knowledge?.groups ||
      scene?.results ||
      [],

    events:
      scene?.timeline ||
      [],

    comparisons:
      scene?.comparison_memory
        ? scene.comparison_memory.map((item) => ({
            a: item?.west,
            b: item?.east,
            difference: item?.idea,
          }))
        : [],

    sections:
      scene?.results ||
      [],

    bac_note:
      scene?.bac_answer ||
      null,
  };

  if (scene?.visual?.type === "balance_shift") {
    content.graph_data = {
      ...scene.visual,
      diagram_type: "balance_shift",
    };
  } else if (scene?.cause_chain) {
    content.graph_data = {
      diagram_type: "cause_chain",
      nodes: scene.cause_chain.map((item) =>
        typeof item === "string" ? item : item?.label,
      ),
    };
  } else if (scene?.final_chain) {
    content.graph_data = {
      diagram_type: "flow",
      nodes: scene.final_chain,
    };
  }

  if (scene?.camps?.length) {
    content.groups = scene.camps.map((camp) => ({
      group: `${camp?.name || ""} — ${camp?.ideology || ""}`,
      items: [
        camp?.goal ? `الهدف: ${camp.goal}` : "",
        ...toArray(camp?.strategies?.political).map((item) =>
          typeof item === "string"
            ? `سياسيًا: ${item}`
            : `سياسيًا: ${item?.name}${item?.explain ? ` — ${item.explain}` : ""}`,
        ),
        ...toArray(camp?.strategies?.economic).map(
          (item) => `اقتصاديًا: ${getText(item)}`,
        ),
        ...toArray(camp?.strategies?.military).map(
          (item) => `عسكريًا: ${getText(item)}`,
        ),
      ].filter(Boolean),
    }));
  }

  if (scene?.relationship) {
    content.groups = [
      {
        group: `${scene.relationship?.label || "طبيعة العلاقة"} (${scene.relationship?.period || ""})`,
        items: toArray(scene.relationship?.manifestations),
      },
    ];
  }

  return {
    id:
      scene?.id ||
      `story_scene_${index + 1}`,
    type:
      scene?.timeline
        ? "timeline"
        : scene?.comparison_memory || scene?.camps
          ? "comparison"
          : "concept",
    title:
      scene?.title ||
      `المشهد ${index + 1}`,
    content,
  };
}

function getAllLessonSteps(lesson) {
  const learningPath =
    toArray(lesson?.learning_path);

  if (learningPath.length) {
    return learningPath;
  }

  return toArray(lesson?.story)
    .map((scene, index) =>
      normalizeStoryScene(scene, index),
    )
    .filter(Boolean);
}

function buildStepMap(lesson) {
  return Object.fromEntries(
    getAllLessonSteps(lesson).map(
      (step) => [String(step?.id || ""), step],
    ),
  );
}

function createFallbackPhases(lesson) {
  const steps =
    getAllLessonSteps(lesson);

  if (!steps.length) return [];

  /*
   * إذا JSON القديم يحتوي story فقط:
   * كل مشهد يصبح مرحلة مستقلة.
   * وإذا يوجد learning_path فقط:
   * نستعمل نفس الخطوات بدون أن يظهر خطأ "لا توجد مراحل".
   */
  if (
    !toArray(lesson?.learning_path).length &&
    toArray(lesson?.story).length
  ) {
    return steps.map((step, index) => ({
      id: `story_phase_${step?.id || index}`,
      number: String(index + 1).padStart(2, "0"),
      label: "القصة",
      title: step?.title || `المشهد ${index + 1}`,
      description:
        "تابع الحدث وافهم السبب والنتيجة، ثم استخدم المساعد الذكي إذا احتجت تبسيطًا أو مثالًا.",
      items: [
        {
          id: `story_item_${step?.id || index}`,
          ref: step?.id,
          kind: step?.type || "concept",
          label: step?.title || `المشهد ${index + 1}`,
        },
      ],
    }));
  }

  return [
    {
      id: "fallback_phase",
      number: "01",
      label: "الدرس",
      title:
        lesson?.title ||
        lesson?.chapter_title ||
        "درس التاريخ",
      description:
        lesson?.lesson_goal ||
        "افهم القصة التاريخية ثم ثبّت المعلومات.",
      items: steps.map(
        (step, index) => ({
          id:
            `fallback_${step?.id || index}`,
          ref: step?.id,
          kind:
            step?.type ||
            "concept",
          label:
            step?.title ||
            `المرحلة ${index + 1}`,
        }),
      ),
    },
  ];
}

function normalizeMastery(lesson) {
  const mastery =
    lesson?.mastery_experience;

  if (
    mastery &&
    Array.isArray(mastery.phases) &&
    mastery.phases.length
  ) {
    return mastery;
  }

  return {
    version: 1,
    mode: "history_story",
    design: {
      show_phase_progress: true,
    },
    intro: {
      eyebrow:
        lesson?.chapter_title ||
        "التاريخ",
      title:
        lesson?.axis_title ||
        lesson?.title ||
        "درس التاريخ",
      subtitle:
        lesson?.lesson_goal ||
        "افهم الأحداث كقصة مترابطة بدل حفظها كقائمة.",
      primary_action: "ابدأ القصة",
      secondary_action: "",
      plan: [],
    },
    memory_chain: [],
    phases:
      createFallbackPhases(
        lesson,
      ),
  };
}

/* =========================================================
   AI — شرح بسيط / مثال
   نفس طريقة ScienceLesson
========================================================= */

const HISTORY_REEXPLAIN_ACTIONS = [
  {
    id: "explanation",
    requestType: "explanation",
    label: "أعد شرح المرحلة",
    shortLabel: "شرح بسيط",
    description:
      "نفس الفكرة بكلمات أسهل جدًا",
    icon: Brain,
    prompt:
      "أعد شرح هذه المرحلة فقط من درس التاريخ بطريقة بسيطة جدًا وكأن تلميذ البكالوريا لم يفهمها. ابدأ من السبب ثم الحدث ثم النتيجة إن وجدت. استعمل كلمات سهلة وجمل قصيرة، واربط المعلومات ببعضها كقصة. لا تضف معلومات خارج محتوى المرحلة ولا تعِد شرح الدرس كاملًا.",
  },
  {
    id: "example",
    requestType: "example",
    label: "أعطني مثالًا",
    shortLabel: "مثال",
    description:
      "مثال أو تشبيه بسيط يثبت الفكرة",
    icon: Lightbulb,
    prompt:
      "أعطني مثالًا واحدًا بسيطًا جدًا يساعد تلميذ البكالوريا على فهم فكرة هذه المرحلة التاريخية. يمكن أن يكون مثالًا توضيحيًا أو تشبيهًا بسيطًا، لكن يجب أن تفرق بوضوح بين المثال التوضيحي والحدث التاريخي الحقيقي. لا تخترع تاريخًا أو شخصية أو معلومة تاريخية غير موجودة في محتوى المرحلة.",
  },
];

function normalizeAIAnswer(payload) {
  const candidate =
    payload?.saved_explanation
      ?.answer ??
    payload?.answer ??
    payload?.ai_answer ??
    payload?.response ??
    payload?.generated_answer ??
    payload?.re_explanation ??
    payload?.explanation ??
    payload?.message ??
    payload;

  if (
    typeof candidate ===
    "string"
  ) {
    const text =
      candidate.trim();

    if (!text) return null;

    const requestType =
      payload?.request_type ??
      payload?.requestType ??
      "";

    return {
      type:
        requestType ===
        "example"
          ? "example"
          : "explanation",
      content: text,
    };
  }

  if (
    !candidate ||
    typeof candidate !==
      "object" ||
    Array.isArray(candidate)
  ) {
    return null;
  }

  const rawType =
    candidate.type ??
    payload?.request_type ??
    payload?.requestType ??
    "";

  const type =
    rawType === "example"
      ? "example"
      : "explanation";

  const content =
    candidate.content ||
    (type === "example"
      ? candidate.example
      : candidate.explanation) ||
    candidate.simple_explanation ||
    candidate.direct_answer ||
    candidate.teacher_message ||
    candidate.text ||
    "";

  if (
    !String(content || "")
      .trim()
  ) {
    return null;
  }

  return {
    type,
    content:
      String(content).trim(),
  };
}

function normalizeHistoryAIItem(
  item,
  index = 0,
) {
  if (!item) return null;

  const answerData =
    normalizeAIAnswer(item);

  if (!answerData?.content) {
    return null;
  }

  const question =
    item?.student_question ??
    item?.question ??
    item?.student_message ??
    "";

  const detectedType =
    item?.request_type ??
    item?.requestType ??
    answerData?.type ??
    (String(question).includes(
      "مثال",
    )
      ? "example"
      : "explanation");

  return {
    id:
      item?.id ??
      item?.history_id ??
      item?.re_explanation_id ??
      `history-ai-${index}-${String(
        item?.created_at ||
          item?.createdAt ||
          "",
      )}`,

    stepId:
      item?.step_id ??
      item?.stepId ??
      item?.step?.id ??
      item?.lesson_step_id ??
      "",

    question,

    answerData: {
      ...answerData,
      type:
        detectedType ===
        "example"
          ? "example"
          : "explanation",
    },

    requestType:
      detectedType ===
      "example"
        ? "example"
        : "explanation",

    model:
      item?.model ??
      item?.model_name ??
      item?.ai_model ??
      "",

    createdAt:
      item?.created_at ??
      item?.createdAt ??
      item?.date_created ??
      item?.timestamp ??
      "",

    pending:
      Boolean(item?.pending),

    raw: item,
  };
}

function extractAIHistoryArray(
  source,
) {
  if (!source) return [];

  if (Array.isArray(source)) {
    return source;
  }

  const candidates = [
    source?.re_explain_history,
    source?.re_explanations,
    source
      ?.re_explanation_history,
    source?.explanation_history,
    source?.history,
    source?.histories,
    source
      ?.previous_explanations,
    source?.answers,
    source?.results,
  ];

  const direct =
    candidates.find(
      Array.isArray,
    );

  if (direct) return direct;

  /*
   * بعض الـ API ترجع:
   * {
   *   data: {
   *     re_explanations: [...]
   *   }
   * }
   */
  if (
    source?.data &&
    source.data !== source
  ) {
    return extractAIHistoryArray(
      source.data,
    );
  }

  /*
   * وأحيانًا تكون محفوظة داخل axis.
   */
  if (
    source?.axis &&
    source.axis !== source
  ) {
    const axisHistory =
      extractAIHistoryArray(
        source.axis,
      );

    if (axisHistory.length) {
      return axisHistory;
    }
  }

  return [];
}

function getStepAIHistory(
  source,
  stepId,
) {
  return extractAIHistoryArray(
    source,
  )
    .map((item, index) =>
      normalizeHistoryAIItem(
        item,
        index,
      ),
    )
    .filter(Boolean)
    .filter(
      (item) =>
        !item.stepId ||
        String(item.stepId) ===
          String(stepId || ""),
    );
}

function normalizeAssistantText(
  value,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function HistoryAssistantAnswer({
  answer,
  requestType = "explanation",
}) {
  const normalized =
    normalizeAIAnswer(
      typeof answer === "object"
        ? answer
        : {
            answer,
            request_type:
              requestType,
          },
    );

  if (!normalized) {
    return null;
  }

  const isExample =
    normalized.type ===
    "example";

  const text =
    normalizeAssistantText(
      normalized.content,
    );

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black",
          isExample
            ? "bg-amber-50 text-amber-800"
            : "bg-indigo-50 text-indigo-700",
        )}
      >
        {isExample ? (
          <Lightbulb size={13} />
        ) : (
          <Brain size={13} />
        )}

        {isExample
          ? "مثال توضيحي"
          : "شرح مبسط"}
      </div>

      <div className="space-y-2">
        {lines.map(
          (line, index) => (
            <p
              key={`${line}-${index}`}
              className="text-[14px] font-semibold leading-8 text-slate-700 sm:text-[15px]"
            >
              {line}
            </p>
          ),
        )}
      </div>
    </div>
  );
}

function HistoryAIHelpPanel({
  step,
  axis,
  axisId,
  initialHistory = [],
  onReExplain,
}) {
  const COURSE_URL =
    import.meta.env
      .VITE_COURSE_URL;

  const endpoint =
    `${COURSE_URL}axes/re-explication/`;

  const { token } =
    useContext(UserContext);

  const [open, setOpen] =
    useState(false);

  const [
    loadingAction,
    setLoadingAction,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [history, setHistory] =
    useState([]);

  const abortRef =
    useRef(null);

  const requestIdRef =
    useRef(0);

  const activeStepIdRef =
    useRef(step?.id || "");

  const messagesEndRef =
    useRef(null);

  const shouldAutoScrollRef =
    useRef(false);

  const loading =
    Boolean(loadingAction);

  /*
   * عند تغيير المرحلة:
   * نحمل آخر 3 شروحات محفوظة من قاعدة البيانات.
   */
  useEffect(() => {
    const normalized =
      toArray(initialHistory)
        .map((item, index) =>
          normalizeHistoryAIItem(
            item,
            index,
          ),
        )
        .filter(Boolean)
        .filter(
          (item) =>
            !item.stepId ||
            String(
              item.stepId,
            ) ===
              String(
                step?.id ||
                  "",
              ),
        )
        .sort((a, b) => {
          const first =
            new Date(
              a.createdAt || 0,
            ).getTime();

          const second =
            new Date(
              b.createdAt || 0,
            ).getTime();

          return first - second;
        });

    activeStepIdRef.current =
      step?.id || "";

    requestIdRef.current += 1;

    abortRef.current?.abort();
    abortRef.current = null;

    setOpen(false);
    setLoadingAction("");
    setError("");
    shouldAutoScrollRef.current =
      false;

    setHistory(
      normalized.slice(-3),
    );

    return () => {
      abortRef.current?.abort();
    };
  }, [
    step?.id,
    initialHistory,
  ]);

  useEffect(() => {
    if (
      !open ||
      !shouldAutoScrollRef.current
    ) {
      return;
    }

    messagesEndRef.current
      ?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });

    if (!loading) {
      shouldAutoScrollRef.current =
        false;
    }
  }, [
    history,
    loading,
    open,
  ]);

  async function ask(action) {
    if (!action || loading) {
      return;
    }

    if (
      !step ||
      typeof step !==
        "object" ||
      !step?.id
    ) {
      setError(
        "المرحلة الحالية غير صالحة.",
      );
      setOpen(true);
      return;
    }

    const resolvedAxisId =
      axisId ??
      axis?.id ??
      null;

    if (
      resolvedAxisId === null ||
      resolvedAxisId ===
        undefined ||
      resolvedAxisId === ""
    ) {
      setError(
        "معرف المحور غير موجود. تأكد أن بيانات المحور القادمة من API تحتوي على id.",
      );
      setOpen(true);
      return;
    }

    const requestedStep = {
      id: step.id,

      type:
        step.type ||
        "history_step",

      title:
        step.title ||
        "شرح المرحلة",

      /*
       * نرسل محتوى المرحلة كاملًا إلى backend
       * حتى يستخدم RAG / Groq نفس بيانات الدرس.
       */
      content:
        step.content || {},
    };

    const requestedStepId =
      String(requestedStep.id);

    const currentRequestId =
      requestIdRef.current + 1;

    requestIdRef.current =
      currentRequestId;

    abortRef.current?.abort();

    const controller =
      new AbortController();

    abortRef.current =
      controller;

    const optimisticId =
      `history-pending-${currentRequestId}-${Date.now()}`;

    const optimisticItem = {
      id: optimisticId,
      stepId:
        requestedStepId,
      question:
        action.label,
      answerData: {
        type:
          action.requestType,
        content: "",
      },
      requestType:
        action.requestType,
      model: "",
      createdAt:
        new Date().toISOString(),
      pending: true,
    };

    shouldAutoScrollRef.current =
      true;

    setOpen(true);
    setError("");

    setLoadingAction(
      action.id,
    );

    setHistory((current) =>
      [
        ...current.filter(
          (item) =>
            !item.pending,
        ),
        optimisticItem,
      ].slice(-3),
    );

    const payload = {
      step: requestedStep,

      student_question:
        action.prompt,

      request_type:
        action.requestType,

      axis_id:
        Number(
          resolvedAxisId,
        ),

      /*
       * معلومات إضافية اختيارية.
       * backend القديم يمكنه تجاهلها،
       * والـ backend الجديد يمكنه استعمالها في RAG.
       */
      subject:
        "history",

      axis_tag:
        axis?.tag ||
        step?.axis_tag ||
        "",

      chapter_code:
        step?.chapter_code ||
        "",
    };

    try {
      let result;

      /*
       * إذا الصفحة الأم توفر onReExplain
       * نستعملها، وإلا نستعمل endpoint نفسه
       * الموجود في ScienceLesson.
       */
      if (
        typeof onReExplain ===
        "function"
      ) {
        result =
          await onReExplain(
            payload,
            {
              signal:
                controller.signal,
              stepId:
                requestedStepId,
              actionId:
                action.id,
            },
          );
      } else {
        const response =
          await axios.post(
            endpoint,
            payload,
            {
              signal:
                controller.signal,

              headers: {
                "Content-Type":
                  "application/json",

                ...(token
                  ? {
                      Authorization:
                        `Bearer ${token}`,
                    }
                  : {}),
              },
            },
          );

        result =
          response.data;
      }

      if (
        controller.signal
          .aborted ||
        requestIdRef.current !==
          currentRequestId ||
        String(
          activeStepIdRef.current,
        ) !==
          requestedStepId
      ) {
        return;
      }

      const savedSource =
        result?.saved_explanation ||
        result;

      const normalizedAnswer =
        normalizeAIAnswer({
          ...savedSource,
          ...result,
          request_type:
            action.requestType,
        });

      if (!normalizedAnswer) {
        throw new Error(
          "وصل جواب فارغ من الخادم.",
        );
      }

      const savedItem =
        normalizeHistoryAIItem(
          {
            ...savedSource,
            ...result,

            step_id:
              result?.step_id ??
              savedSource
                ?.step_id ??
              requestedStepId,

            student_question:
              action.label,

            request_type:
              action.requestType,

            answer:
              result?.answer ??
              savedSource
                ?.answer ??
              normalizedAnswer,

            model:
              result?.model ??
              savedSource
                ?.model_name ??
              "",

            created_at:
              savedSource
                ?.created_at ||
              savedSource
                ?.updated_at ||
              new Date()
                .toISOString(),
          },
          currentRequestId,
        );

      if (!savedItem) {
        throw new Error(
          "وصل جواب فارغ من الخادم.",
        );
      }

      /*
       * نعوض العنصر المؤقت بالعنصر المحفوظ
       * ونبقي آخر 3 فقط.
       */
      setHistory(
        (current) => {
          const withoutPending =
            current.filter(
              (item) =>
                item.id !==
                optimisticId,
            );

          const withoutDuplicate =
            withoutPending.filter(
              (item) =>
                String(
                  item.id,
                ) !==
                String(
                  savedItem.id,
                ),
            );

          return [
            ...withoutDuplicate,
            savedItem,
          ].slice(-3);
        },
      );
    } catch (requestError) {
      setHistory(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              optimisticId,
          ),
      );

      if (
        axios.isCancel(
          requestError,
        ) ||
        requestError?.code ===
          "ERR_CANCELED" ||
        controller.signal.aborted
      ) {
        return;
      }

      const responseData =
        requestError?.response
          ?.data;

      let serializerMessage =
        "";

      if (
        responseData &&
        typeof responseData ===
          "object"
      ) {
        serializerMessage =
          Object.values(
            responseData,
          )
            .flat()
            .find(
              (value) =>
                typeof value ===
                "string",
            );
      }

      setError(
        responseData?.detail ||
          responseData?.error ||
          responseData?.message ||
          serializerMessage ||
          requestError?.message ||
          "حدث خطأ أثناء إنشاء المساعدة.",
      );
    } finally {
      if (
        requestIdRef.current ===
          currentRequestId &&
        String(
          activeStepIdRef.current,
        ) ===
          requestedStepId
      ) {
        setLoadingAction("");
      }
    }
  }

  return (
    <section
      dir="rtl"
      className="mt-6 overflow-hidden rounded-[26px] border border-slate-200/90 bg-white shadow-[0_18px_55px_-32px_rgba(15,23,42,0.45)]"
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (value) =>
              !value,
          )
        }
        className="group flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-right transition hover:bg-slate-50/80 sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-500/25">
            <WandSparkles
              size={19}
            />

            <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-black text-slate-950">
                مساعد فهم التاريخ
              </h3>

              {history.filter(
                (item) =>
                  !item.pending,
              ).length > 0 && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700">
                  {
                    history.filter(
                      (item) =>
                        !item.pending,
                    ).length
                  }
                  /3
                </span>
              )}
            </div>

            <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
              لم تفهم الحدث؟ اطلب شرحًا بسيطًا أو مثالًا
            </p>
          </div>
        </div>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-700">
          {open ? (
            <ChevronUp
              size={16}
            />
          ) : (
            <ChevronDown
              size={16}
            />
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {HISTORY_REEXPLAIN_ACTIONS.map(
              (action) => {
                const Icon =
                  action.icon;

                const isLoading =
                  loadingAction ===
                  action.id;

                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() =>
                      ask(action)
                    }
                    disabled={
                      loading
                    }
                    className={cn(
                      "group/action flex min-h-[66px] items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-right shadow-sm transition duration-200",
                      isLoading
                        ? "border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-100"
                        : "border-slate-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md",
                      loading &&
                        !isLoading &&
                        "cursor-not-allowed opacity-45",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition",
                        action.id ===
                          "example"
                          ? "bg-amber-500 group-hover/action:bg-amber-600"
                          : "bg-indigo-600 group-hover/action:bg-indigo-700",
                      )}
                    >
                      {isLoading ? (
                        <Loader2
                          className="animate-spin"
                          size={17}
                        />
                      ) : (
                        <Icon
                          size={17}
                        />
                      )}
                    </span>

                    <span className="min-w-0">
                      <span className="block text-xs font-black text-slate-900 sm:text-[13px]">
                        {
                          action.shortLabel
                        }
                      </span>

                      <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-500 sm:text-[11px]">
                        {
                          action.description
                        }
                      </span>
                    </span>
                  </button>
                );
              },
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-rose-800">
              <AlertTriangle
                className="mt-0.5 shrink-0"
                size={15}
              />

              <p className="text-[11px] font-bold leading-5">
                {error}
              </p>
            </div>
          )}

          {history.length >
            0 && (
            <div className="mt-4 space-y-3">
              {history.map(
                (
                  item,
                  index,
                ) => {
                  const itemType =
                    item
                      ?.answerData
                      ?.type ??
                    item
                      ?.requestType ??
                    "explanation";

                  const isExample =
                    itemType ===
                    "example";

                  return (
                    <article
                      key={
                        item.id ||
                        index
                      }
                      className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                    >
                      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-3.5 py-2.5 sm:px-4">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                              item.pending
                                ? "bg-indigo-50 text-indigo-700"
                                : isExample
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-indigo-50 text-indigo-700",
                            )}
                          >
                            {item.pending ? (
                              <Loader2
                                className="animate-spin"
                                size={14}
                              />
                            ) : isExample ? (
                              <Lightbulb
                                size={14}
                              />
                            ) : (
                              <Brain
                                size={14}
                              />
                            )}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-black text-slate-900">
                              {item.question ||
                                (isExample
                                  ? "مثال"
                                  : "شرح مبسط")}
                            </p>

                            {item.model && (
                              <p className="truncate text-[9px] font-semibold text-slate-400">
                                {
                                  item.model
                                }
                              </p>
                            )}
                          </div>
                        </div>

                        {item.createdAt &&
                          !item.pending && (
                            <span className="shrink-0 text-[9px] font-semibold text-slate-400">
                              {formatHistoryDate(
                                item.createdAt,
                              )}
                            </span>
                          )}
                      </header>

                      <div className="p-4 sm:p-5">
                        {item.pending ? (
                          <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
                            <Loader2
                              className="animate-spin text-indigo-600"
                              size={16}
                            />

                            <div>
                              <p className="text-xs font-black text-indigo-950">
                                {isExample
                                  ? "أحضّر لك مثالًا بسيطًا..."
                                  : "أعيد شرح الحدث بطريقة أسهل..."}
                              </p>

                              <p className="mt-0.5 text-[10px] font-semibold text-indigo-600">
                                سيظهر الجواب هنا مباشرة
                              </p>
                            </div>
                          </div>
                        ) : (
                          <HistoryAssistantAnswer
                            answer={
                              item.answerData
                            }
                            requestType={
                              itemType
                            }
                          />
                        )}
                      </div>
                    </article>
                  );
                },
              )}

              <div
                ref={
                  messagesEndRef
                }
              />
            </div>
          )}

          {!loading &&
            history.length ===
              0 &&
            !error && (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-4 text-center">
                <p className="text-[11px] font-bold text-slate-400">
                  اختر «شرح بسيط» أو «مثال». سيتم حفظ آخر 3 مساعدات في قاعدة البيانات وعرضها عند العودة لهذه المرحلة.
                </p>
              </div>
            )}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   UI
========================================================= */

const GROUP_ICONS = [
  Landmark,
  Coins,
  Users,
  Rocket,
];

function MemoryHook({
  text,
}) {
  if (!text) return null;

  return (
    <div className="mt-5 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm font-black leading-7 text-amber-950">
      <Brain
        className="mt-1 shrink-0"
        size={17}
      />
      <span>{text}</span>
    </div>
  );
}

function GroupGrid({
  groups,
}) {
  const list =
    toArray(groups);

  if (!list.length) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map(
        (group, index) => {
          const Icon =
            GROUP_ICONS[
              index %
                GROUP_ICONS.length
            ];

          return (
            <article
              key={`${group?.group || index}-${index}`}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Icon
                    size={18}
                  />
                </div>

                <h4 className="font-black text-slate-950">
                  {group?.group ||
                    group?.title}
                </h4>
              </div>

              <div className="space-y-2">
                {toArray(
                  group?.items,
                ).map(
                  (
                    item,
                    itemIndex,
                  ) => (
                    <div
                      key={`${getText(item)}-${itemIndex}`}
                      className="flex items-start gap-2 text-sm font-semibold leading-7 text-slate-600"
                    >
                      <CheckCircle2
                        className="mt-1 shrink-0 text-slate-400"
                        size={15}
                      />

                      <span>
                        {getText(
                          item,
                        )}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </article>
          );
        },
      )}
    </div>
  );
}

function PointGrid({
  points,
}) {
  const list =
    toArray(points);

  if (!list.length) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map(
        (
          point,
          index,
        ) => (
          <article
            key={`${point?.title || index}-${index}`}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
          >
            <h4 className="font-black text-slate-950">
              {point?.title ||
                `الفكرة ${index + 1}`}
            </h4>

            <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">
              {point
                ?.explanation ||
                point
                  ?.description ||
                getText(point)}
            </p>
          </article>
        ),
      )}
    </div>
  );
}



function VariedMindMap({ graph }) {
  if (!graph) return null;

  const type = graph?.diagram_type;

  if (type === "staircase") {
    const nodes = toArray(graph?.nodes);
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white p-5 sm:p-7">
        <MindMapHeading graph={graph} />
        <div className="mx-auto max-w-3xl space-y-2">
          {nodes.map((node, index) => (
            <div
              key={`${getText(node)}-${index}`}
              className="flex"
              style={{ paddingRight: `${Math.min(index * 24, 144)}px` }}
            >
              <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                  {index + 1}
                </span>
                <span className="text-sm font-black text-slate-700">{getText(node)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "radial" || type === "mega_radial") {
    const branches = toArray(graph?.branches);
    return (
      <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-5 sm:p-7">
        <MindMapHeading graph={graph} />
        <div className="mx-auto mb-5 flex min-h-24 max-w-md items-center justify-center rounded-full bg-slate-950 px-7 py-5 text-center text-base font-black text-white shadow-xl">
          {graph?.center}
        </div>
        <div className={cn(
          "grid gap-4",
          type === "mega_radial" ? "md:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4",
        )}>
          {branches.map((branch, index) => (
            <article key={`${branch?.label}-${index}`} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-800">
                {index + 1}
              </div>
              <h4 className="text-center text-sm font-black text-slate-950">{branch?.label}</h4>
              <div className="mt-3 space-y-2">
                {toArray(branch?.items).map((item, itemIndex) => (
                  <div key={`${getText(item)}-${itemIndex}`} className="rounded-xl bg-slate-50 px-3 py-2 text-center text-[11px] font-bold leading-5 text-slate-600">
                    {getText(item)}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (type === "petals") {
    const branches = toArray(graph?.branches);
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white p-5 sm:p-7">
        <MindMapHeading graph={graph} />
        <div className="mx-auto grid max-w-4xl gap-3 lg:grid-cols-[1fr_220px_1fr] lg:items-center">
          <div className="space-y-3">
            {branches.filter((_, i) => i % 2 === 0).map((branch, i) => (
              <PetalCard key={`${branch?.label}-${i}`} branch={branch} />
            ))}
          </div>
          <div className="flex min-h-40 items-center justify-center rounded-full bg-slate-950 p-6 text-center text-base font-black text-white shadow-xl">
            {graph?.center}
          </div>
          <div className="space-y-3">
            {branches.filter((_, i) => i % 2 === 1).map((branch, i) => (
              <PetalCard key={`${branch?.label}-${i}`} branch={branch} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "pyramid") {
    const levels = toArray(graph?.levels);
    return (
      <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-5 sm:p-7">
        <MindMapHeading graph={graph} />
        <div className="mx-auto flex max-w-3xl flex-col-reverse items-center gap-2">
          {levels.map((level, index) => {
            const width = 48 + index * 16;
            return (
              <div
                key={`${level?.label}-${index}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"
                style={{ width: `${Math.min(width, 100)}%` }}
              >
                <p className="text-[11px] font-black text-amber-700">{level?.label}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {toArray(level?.items).map((item, itemIndex) => (
                    <span key={`${getText(item)}-${itemIndex}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
                      {getText(item)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "mirror") {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white p-5 sm:p-7">
        <MindMapHeading graph={graph} />
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
          <MirrorSide side={graph?.left} />
          <div className="hidden items-center justify-center lg:flex">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
              VS
            </div>
          </div>
          <MirrorSide side={graph?.right} />
        </div>
      </div>
    );
  }

  if (type === "split_tree") {
    const branches = toArray(graph?.branches);
    return (
      <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-5 sm:p-7">
        <MindMapHeading graph={graph} />
        <div className="mx-auto max-w-sm rounded-3xl bg-slate-950 px-5 py-4 text-center font-black text-white">
          {graph?.root}
        </div>
        <ArrowDown className="mx-auto my-3 text-slate-300" size={20} />
        <div className="grid gap-4 md:grid-cols-2">
          {branches.map((branch, index) => (
            <article key={`${branch?.label}-${index}`} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-center text-base font-black text-slate-950">{branch?.label}</h4>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {toArray(branch?.items).map((item, itemIndex) => (
                  <div key={`${getText(item)}-${itemIndex}`} className="rounded-xl bg-slate-50 px-3 py-2 text-center text-xs font-bold text-slate-600">
                    {getText(item)}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (type === "orbit_clusters") {
    const clusters = toArray(graph?.clusters);
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white p-5 sm:p-7">
        <MindMapHeading graph={graph} />
        <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-slate-950 p-4 text-center text-xs font-black text-white shadow-xl">
          {graph?.center}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {clusters.map((cluster, index) => (
            <article key={`${cluster?.label}-${index}`} className="rounded-full border border-slate-200 bg-slate-50 p-6 text-center">
              <h4 className="text-sm font-black text-amber-700">{cluster?.label}</h4>
              <div className="mt-3 space-y-1.5">
                {toArray(cluster?.items).map((item, itemIndex) => (
                  <p key={`${getText(item)}-${itemIndex}`} className="text-[11px] font-bold text-slate-600">
                    {getText(item)}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (type === "hub_spokes") {
    const spokes = toArray(graph?.spokes);
    return (
      <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-5 sm:p-7">
        <MindMapHeading graph={graph} />
        <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-slate-950 p-4 text-center text-sm font-black text-white shadow-xl">
          {graph?.center}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {spokes.map((spoke, index) => (
            <div key={`${spoke?.name}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="text-sm font-black text-slate-950">{spoke?.name}</p>
              <div className="mx-auto my-2 h-4 w-px bg-slate-200" />
              <p className="text-xs font-black text-amber-700">{spoke?.link}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "timeline_ladder") {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white p-5 sm:p-7">
        <MindMapHeading graph={graph} />
        <DateLadder items={graph?.items} />
      </div>
    );
  }

  return null;
}

function MindMapHeading({ graph }) {
  if (!graph?.title && !graph?.description) return null;
  return (
    <div className="mb-6 text-center">
      {graph?.title && <h4 className="text-lg font-black text-slate-950">{graph.title}</h4>}
      {graph?.description && <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">{graph.description}</p>}
    </div>
  );
}

function PetalCard({ branch }) {
  return (
    <div className="rounded-[999px] border border-amber-100 bg-amber-50 px-5 py-4 text-center">
      <p className="text-sm font-black text-amber-900">{branch?.label}</p>
      {branch?.text && <p className="mt-1 text-[11px] font-bold text-amber-800/80">{branch.text}</p>}
    </div>
  );
}

function MirrorSide({ side }) {
  if (!side) return null;
  return (
    <article className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
      <div className="text-center">
        <h4 className="text-xl font-black text-slate-950">{side?.title}</h4>
        {side?.subtitle && <p className="mt-1 text-xs font-bold text-slate-500">{side.subtitle}</p>}
      </div>
      <div className="mt-5 space-y-3">
        {toArray(side?.rows).map((row, index) => (
          <div key={`${row?.label}-${index}`} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-black text-amber-700">{row?.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {toArray(row?.items).map((item, itemIndex) => (
                <span key={`${getText(item)}-${itemIndex}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-700">
                  {getText(item)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}


function GenericGraph({
  graph,
}) {
  const nodes = toArray(graph?.nodes);

  if (!nodes.length) return null;

  const type = graph?.diagram_type || "flow";

  if (
    [
      "story_flow",
      "cause_tree",
      "five_branch_map",
      "two_branch_tree",
      "comparison_tree",
      "two_sided_comparison",
    ].includes(type)
  ) {
    const first = nodes[0];
    const rest = nodes.slice(1);

    return (
      <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-5 sm:p-6">
        {graph?.title && (
          <div className="mb-5 text-center">
            <h4 className="text-base font-black text-slate-950">
              {graph.title}
            </h4>
            {graph?.description && (
              <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                {graph.description}
              </p>
            )}
          </div>
        )}

        <div className="mx-auto max-w-sm rounded-3xl bg-slate-950 px-5 py-4 text-center text-sm font-black text-white shadow-lg">
          {getText(first)}
        </div>

        {rest.length > 0 && (
          <>
            <ArrowDown className="mx-auto my-3 text-slate-300" size={20} />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((node, index) => (
                <div
                  key={`${getText(node)}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm font-black leading-6 text-slate-700 shadow-sm"
                >
                  {getText(node)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[28px] bg-slate-50 p-5">
      <FlowDiagram graph={graph} />
    </div>
  );
}

function StrategyComparison({
  comparison,
}) {
  if (!comparison?.left && !comparison?.right) return null;

  const sides = [
    ["left", comparison?.left],
    ["right", comparison?.right],
  ].filter(([, side]) => side);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {sides.map(([key, side]) => (
        <article
          key={key}
          className={cn(
            "overflow-hidden rounded-[28px] border bg-white shadow-sm",
            key === "left"
              ? "border-amber-200"
              : "border-slate-300",
          )}
        >
          <div
            className={cn(
              "px-5 py-4",
              key === "left"
                ? "bg-amber-50"
                : "bg-slate-100",
            )}
          >
            <h4 className="text-lg font-black text-slate-950">
              {side?.title}
            </h4>
          </div>

          <div className="space-y-4 p-5">
            {toArray(side?.sections).map((section, index) => (
              <div
                key={`${section?.label}-${index}`}
                className="rounded-2xl bg-slate-50 p-4"
              >
                <p className="text-sm font-black text-slate-950">
                  {section?.label}
                </p>

                <div className="mt-3 space-y-2">
                  {toArray(section?.items).map((item, itemIndex) => (
                    <div
                      key={`${getText(item)}-${itemIndex}`}
                      className="flex items-start gap-2 text-xs font-bold leading-6 text-slate-600"
                    >
                      <CheckCircle2
                        className="mt-1 shrink-0 text-slate-400"
                        size={14}
                      />
                      <span>{getText(item)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function MasterMindMap({
  map,
}) {
  if (!map) return null;

  return (
    <div className="rounded-[32px] border border-amber-200 bg-gradient-to-b from-amber-50/70 to-white p-5 sm:p-7">
      {map?.title && (
        <p className="mb-5 text-center text-xs font-black text-amber-700">
          {map.title}
        </p>
      )}

      <div className="mx-auto max-w-xl rounded-[28px] bg-slate-950 px-6 py-5 text-center text-lg font-black text-white shadow-xl">
        {map?.center || "ملخص الدرس"}
      </div>

      <ArrowDown className="mx-auto my-4 text-slate-300" size={22} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {toArray(map?.branches).map((branch, index) => (
          <article
            key={`${branch?.label}-${index}`}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-sm font-black text-amber-700">
                {index + 1}
              </div>
              <h4 className="font-black text-slate-950">
                {branch?.label}
              </h4>
            </div>

            <div className="space-y-2">
              {toArray(branch?.items).map((item, itemIndex) => (
                <div
                  key={`${getText(item)}-${itemIndex}`}
                  className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-6 text-slate-600"
                >
                  {getText(item)}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}


function BalanceShift({
  graph,
}) {
  if (
    !graph?.left ||
    !graph?.right
  ) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-black text-slate-400">
          {graph.left.state}
        </p>

        <h4 className="mt-1 text-lg font-black">
          {graph.left.label}
        </h4>

        <div className="mt-3 space-y-2">
          {toArray(
            graph.left.items,
          ).map((item) => (
            <p
              key={getText(item)}
              className="text-sm font-bold text-slate-600"
            >
              • {getText(item)}
            </p>
          ))}
        </div>
      </div>

      <ArrowLeft className="mx-auto hidden text-slate-300 md:block" />

      <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
        <p className="text-xs font-black text-slate-400">
          {graph.right.state}
        </p>

        <h4 className="mt-1 text-lg font-black">
          {graph.right.label}
        </h4>

        <div className="mt-3 space-y-2">
          {toArray(
            graph.right.items,
          ).map((item) => (
            <p
              key={getText(item)}
              className="text-sm font-bold text-slate-300"
            >
              • {getText(item)}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlowDiagram({
  graph,
}) {
  const nodes =
    toArray(graph?.nodes);

  if (!nodes.length) {
    return null;
  }

  return (
    <div className="mx-auto max-w-xl">
      {nodes.map(
        (
          node,
          index,
        ) => (
          <div
            key={`${getText(node)}-${index}`}
          >
            <div
              className={cn(
                "rounded-2xl border px-4 py-3 text-center text-sm font-black",
                index ===
                  nodes.length -
                    1
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-700",
              )}
            >
              {getText(
                node,
              )}
            </div>

            {index <
              nodes.length -
                1 && (
              <ArrowDown className="mx-auto my-2 text-slate-300" size={18} />
            )}
          </div>
        ),
      )}
    </div>
  );
}

function Timeline({
  events,
}) {
  const list =
    toArray(events);

  const [filter, setFilter] =
    useState("all");

  const visible =
    useMemo(() => {
      if (
        filter ===
        "all"
      ) {
        return list;
      }

      return list.filter(
        (event) =>
          event?.side ===
          filter,
      );
    }, [
      list,
      filter,
    ]);

  if (!list.length) {
    return null;
  }

  return (
    <div>
      {list.some(
        (event) =>
          event?.side ===
            "west" ||
          event?.side ===
            "east",
      ) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            [
              "all",
              "الكل",
            ],
            [
              "west",
              "الغرب",
            ],
            [
              "east",
              "الشرق",
            ],
          ].map(
            ([
              value,
              label,
            ]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setFilter(
                    value,
                  )
                }
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-black",
                  filter ===
                    value
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-600",
                )}
              >
                {label}
              </button>
            ),
          )}
        </div>
      )}

      <div className="relative space-y-3 before:absolute before:bottom-4 before:right-[17px] before:top-4 before:w-px before:bg-slate-200">
        {visible.map(
          (
            event,
            index,
          ) => (
            <article
              key={`${event?.date}-${event?.title}-${index}`}
              className="relative pr-11"
            >
              <div
                className={cn(
                  "absolute right-2 top-5 z-10 h-[19px] w-[19px] rounded-full border-4 border-white",
                  event
                    ?.side ===
                    "west"
                    ? "bg-slate-950"
                    : event
                          ?.side ===
                        "east"
                      ? "bg-slate-400"
                      : "bg-amber-500",
                )}
              />

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-slate-400">
                      {
                        event?.date
                      }
                    </p>

                    <h4 className="mt-1 text-lg font-black text-slate-950">
                      {
                        event?.title
                      }
                    </h4>
                  </div>

                  {event?.side &&
                    event?.side !==
                      "neutral" && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                        {event.side ===
                        "west"
                          ? "غربي"
                          : "شرقي"}
                      </span>
                    )}
                </div>

                {(event?.explanation ||
                  event?.summary) && (
                  <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                    {event
                      ?.explanation ||
                      event
                        ?.summary}
                  </p>
                )}

                {event?.memory && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                    <Brain
                      size={14}
                    />
                    {
                      event.memory
                    }
                  </div>
                )}
              </div>
            </article>
          ),
        )}
      </div>
    </div>
  );
}

function Comparisons({
  comparisons,
}) {
  const list =
    toArray(comparisons);

  if (!list.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      {list.map(
        (
          item,
          index,
        ) => (
          <article
            key={`${item?.a}-${item?.b}-${index}`}
            className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto_1fr] md:items-center"
          >
            <div className="rounded-2xl bg-white p-4 text-center text-sm font-black">
              {item?.a}
            </div>

            <div className="text-center">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800">
                مقابل
              </span>
            </div>

            <div className="rounded-2xl bg-white p-4 text-center text-sm font-black">
              {item?.b}
            </div>

            <p className="text-center text-xs font-semibold leading-6 text-slate-500 md:col-span-3">
              {
                item
                  ?.difference
              }
            </p>
          </article>
        ),
      )}
    </div>
  );
}



function TermCards({
  terms,
}) {
  const list = toArray(terms);

  if (!list.length) return null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {list.map((item, index) => (
        <article
          key={`${item?.term || index}-${index}`}
          className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              {item?.family && (
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                  {item.family}
                </span>
              )}

              <h4 className="mt-2 text-lg font-black text-slate-950">
                {item?.term}
              </h4>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <BookOpen size={18} />
            </div>
          </div>

          <p className="mt-3 text-sm font-semibold leading-8 text-slate-700">
            {item?.definition}
          </p>

          {item?.micro_example && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start gap-2">
                <Lightbulb className="mt-1 shrink-0 text-slate-400" size={15} />
                <p className="text-xs font-bold leading-6 text-slate-600">
                  {item.micro_example}
                </p>
              </div>
            </div>
          )}

          {item?.memory && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-amber-900">
              <Brain className="mt-0.5 shrink-0" size={16} />
              <div>
                <p className="text-[10px] font-black text-amber-700">
                  مفتاح الحفظ
                </p>
                <p className="mt-1 text-sm font-black">
                  {item.memory}
                </p>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function DateMemoryCard({
  data,
}) {
  if (!data) return null;

  return (
    <div className="rounded-[28px] border border-amber-100 bg-amber-50/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black text-amber-700">
            قصة السنة
          </p>
          <h4 className="mt-1 text-xl font-black text-slate-950">
            {data?.year} — {data?.label}
          </h4>
        </div>

        <Brain className="text-amber-700" size={22} />
      </div>

      {data?.story && (
        <p className="mt-4 text-sm font-bold leading-7 text-slate-700">
          {data.story}
        </p>
      )}

      {data?.formula && (
        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-amber-800 shadow-sm">
          {data.formula}
        </div>
      )}

      {toArray(data?.months).length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {toArray(data.months).map((item, index) => (
            <div
              key={`${item?.month}-${index}`}
              className="rounded-2xl border border-amber-100 bg-white p-3 text-center"
            >
              <p className="text-lg font-black text-slate-950">
                {item?.month}
              </p>
              <p className="mt-1 text-[11px] font-black text-slate-500">
                {item?.cue}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DateLadder({
  items,
}) {
  const list = toArray(items);
  if (!list.length) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-2">
      {list.map((item, index) => (
        <div key={`${item?.year}-${index}`}>
          <div className="grid grid-cols-[88px_1fr] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-center bg-slate-950 px-3 py-4 text-lg font-black text-white">
              {item?.year}
            </div>
            <div className="p-4">
              <p className="text-sm font-black text-amber-700">
                {item?.keyword}
              </p>
              <p className="mt-1 text-xs font-bold leading-6 text-slate-600">
                {item?.detail}
              </p>
            </div>
          </div>

          {index < list.length - 1 && (
            <ArrowDown className="mx-auto my-1 text-slate-300" size={17} />
          )}
        </div>
      ))}
    </div>
  );
}

function DateMethod({
  method,
}) {
  if (!method) return null;
  const layers = toArray(method?.layers);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
      <h4 className="text-center text-base font-black text-slate-950">
        {method?.title || "طريقة الحفظ"}
      </h4>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {layers.map((layer, index) => (
          <div
            key={`${layer?.number}-${index}`}
            className="rounded-2xl bg-white p-4 text-center shadow-sm"
          >
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
              {layer?.number}
            </div>
            <p className="mt-2 text-sm font-black text-slate-800">
              {layer?.label}
            </p>
            <p className="mt-1 text-xs font-bold text-amber-700">
              {layer?.example}
            </p>
          </div>
        ))}
      </div>

      {method?.rule && (
        <p className="mt-4 text-center text-sm font-black text-slate-700">
          {method.rule}
        </p>
      )}
    </div>
  );
}


function CharacterCards({
  characters,
}) {
  const list =
    toArray(characters);

  if (!list.length) {
    return null;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {list.map(
        (
          character,
          index,
        ) => (
          <article
            key={`${character?.name || index}-${index}`}
            className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
          >
            <div
              className={cn(
                "border-b px-5 py-4",
                character?.side ===
                  "east"
                  ? "border-slate-200 bg-slate-100"
                  : "border-amber-100 bg-amber-50/70",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
                    character?.side ===
                      "east"
                      ? "bg-slate-700"
                      : "bg-amber-600",
                  )}
                >
                  <Users
                    size={21}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-lg font-black text-slate-950">
                    {
                      character?.name
                    }
                  </p>

                  <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                    {
                      character?.role
                    }
                  </p>

                  {character?.country && (
                    <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-200">
                      {
                        character.country
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5">
              <div>
                <p className="text-[11px] font-black text-slate-400">
                  التعريف
                </p>

                <p className="mt-2 text-sm font-semibold leading-8 text-slate-700">
                  {
                    character?.definition
                  }
                </p>
              </div>

              {toArray(
                character?.source_details,
              ).length > 0 && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-[11px] font-black text-slate-500">
                    أهم ما تعرفه عنه
                  </p>

                  <div className="mt-2 space-y-2">
                    {toArray(
                      character?.source_details,
                    ).map(
                      (
                        detail,
                        detailIndex,
                      ) => (
                        <div
                          key={`${detail}-${detailIndex}`}
                          className="flex items-start gap-2"
                        >
                          <CheckCircle2
                            className="mt-1 shrink-0 text-slate-400"
                            size={14}
                          />

                          <p className="text-xs font-bold leading-6 text-slate-600">
                            {
                              detail
                            }
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {character?.lesson_link && (
                <div className="mt-4 rounded-2xl border border-slate-200 px-4 py-3">
                  <p className="text-[10px] font-black text-slate-400">
                    ارتباطه بالدرس
                  </p>

                  <p className="mt-1 text-sm font-black text-slate-800">
                    {
                      character.lesson_link
                    }
                  </p>
                </div>
              )}

              {character?.memory && (
                <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-amber-950">
                  <Brain
                    className="mt-0.5 shrink-0"
                    size={17}
                  />

                  <div>
                    <p className="text-xs font-black">
                      مفتاح الحفظ
                    </p>

                    <p className="mt-1 text-sm font-black">
                      {
                        character.memory
                      }
                    </p>

                    {character?.memory_sentence && (
                      <p className="mt-1 text-xs font-semibold leading-6 text-amber-800">
                        {
                          character.memory_sentence
                        }
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </article>
        ),
      )}
    </div>
  );
}

function CharacterMindMap({
  map,
}) {
  if (!map) {
    return null;
  }

  const directBranches =
    toArray(map?.branches);

  const groups =
    toArray(map?.groups);

  return (
    <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        {map?.title && (
          <p className="mb-4 text-center text-xs font-black text-amber-700">
            {
              map.title
            }
          </p>
        )}

        <div className="mx-auto flex max-w-sm items-center justify-center rounded-3xl bg-slate-950 px-5 py-4 text-center text-base font-black text-white shadow-lg">
          {map?.center ||
            "الشخصيات"}
        </div>

        <ArrowDown
          className="mx-auto my-3 text-slate-300"
          size={20}
        />

        {directBranches.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {directBranches.map(
              (
                branch,
                index,
              ) => (
                <div
                  key={`${branch?.name || index}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"
                >
                  <p className="text-sm font-black text-slate-950">
                    {
                      branch?.name
                    }
                  </p>

                  <div className="mx-auto my-2 h-4 w-px bg-slate-200" />

                  <p className="text-xs font-black text-amber-700">
                    {
                      branch?.link
                    }
                  </p>
                </div>
              ),
            )}
          </div>
        )}

        {groups.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {groups.map(
              (
                group,
                groupIndex,
              ) => (
                <div
                  key={`${group?.label || groupIndex}-${groupIndex}`}
                  className="rounded-3xl border border-slate-200 bg-white p-4"
                >
                  <div className="mb-4 rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-800">
                    {
                      group?.label
                    }
                  </div>

                  <div className="space-y-2">
                    {toArray(
                      group?.items,
                    ).map(
                      (
                        item,
                        itemIndex,
                      ) => (
                        <div
                          key={`${item?.name || itemIndex}-${itemIndex}`}
                          className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-slate-50 p-3"
                        >
                          <span className="text-right text-xs font-black text-slate-800">
                            {
                              item?.name
                            }
                          </span>

                          <ArrowLeft
                            size={14}
                            className="text-slate-300"
                          />

                          <span className="text-left text-xs font-black text-amber-700">
                            {
                              item?.link
                            }
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function MemoryStory({
  items,
}) {
  const list =
    toArray(items);

  if (!list.length) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map(
        (
          item,
          index,
        ) => (
          <div
            key={`${item?.word || index}-${index}`}
            className="rounded-3xl bg-slate-950 p-5 text-white"
          >
            <p className="text-lg font-black text-amber-300">
              {
                item?.word
              }
            </p>

            <p className="mt-2 text-sm font-semibold leading-7 text-slate-300">
              {item?.means ||
                item?.answer}
            </p>
          </div>
        ),
      )}
    </div>
  );
}

function SummarySections({
  sections,
}) {
  const list =
    toArray(sections);

  if (!list.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      {list.map(
        (
          section,
          index,
        ) => (
          <article
            key={`${section?.title || index}-${index}`}
            className="rounded-3xl bg-slate-50 p-5"
          >
            <h4 className="font-black">
              {
                section?.title ||
                section?.area ||
                `قسم ${index + 1}`
              }
            </h4>

            <div className="mt-3 space-y-2">
              {toArray(
                section?.items,
              ).map(
                (
                  item,
                  itemIndex,
                ) => (
                  <p
                    key={`${getText(item)}-${itemIndex}`}
                    className="text-sm font-semibold leading-7 text-slate-600"
                  >
                    •{" "}
                    {getText(
                      item,
                    )}
                  </p>
                ),
              )}
            </div>
          </article>
        ),
      )}
    </div>
  );
}

/* =========================================================
   Main step renderer
========================================================= */


function normalizeSummaryText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueSummaryLines(values) {
  const seen = new Set();

  return toArray(values).filter((value) => {
    const key = normalizeSummaryText(
      typeof value === "string"
        ? value
        : getText(value),
    );

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function SummaryPetal({
  branch,
}) {
  if (!branch) return null;

  const primary =
    branch?.text || "";

  const explanation =
    branch?.explanation || "";

  // If both exist, use the concise label/detail as the first line and
  // the explanation only when it adds genuinely different information.
  const normalize = (value) =>
    String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[.،؛:]/g, "");

  const sameMeaning =
    normalize(primary) ===
      normalize(explanation) ||
    normalize(explanation).includes(
      normalize(primary),
    ) ||
    normalize(primary).includes(
      normalize(explanation),
    );

  return (
    <div className="rounded-full bg-amber-50 px-4 py-4 text-center">
      <p className="text-sm font-black text-amber-900">
        {branch?.label}
      </p>

      {primary && (
        <p className="mt-1 text-[11px] font-bold leading-5 text-amber-800">
          {primary}
        </p>
      )}

      {explanation &&
        !sameMeaning && (
          <p className="mx-auto mt-2 max-w-xs text-[10px] font-semibold leading-5 text-amber-900/70">
            {explanation}
          </p>
        )}
    </div>
  );
}

function OnePageAxisSummary({
  lesson,
}) {
  const summary =
    lesson?.one_page_summary;

  if (!summary) {
    return null;
  }

  const renderBlock = (block) => {
    if (!block) return null;

    if (block.type === "radial") {
      return (
        <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-black text-slate-950">
            {block.title}
          </h3>

          <div className="mx-auto mt-4 flex max-w-xs items-center justify-center rounded-full bg-slate-950 px-5 py-4 text-center text-sm font-black text-white">
            {block.center}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {toArray(block.branches).map((branch, index) => (
              <article
                key={`${branch?.label}-${index}`}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <p className="text-center text-sm font-black text-amber-700">
                  {branch?.label}
                </p>

                {branch?.explanation && (
                  <p className="mt-2 text-center text-[11px] font-semibold leading-5 text-slate-500">
                    {branch.explanation}
                  </p>
                )}

                <div className="mt-3 space-y-2">
                  {uniqueSummaryLines(branch?.items).map((item, itemIndex) => (
                    <p
                      key={`${getText(item)}-${itemIndex}`}
                      className="text-xs font-bold leading-6 text-slate-600"
                    >
                      • {getText(item)}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <MemoryHook text={block.memory} />
        </section>
      );
    }

    if (block.type === "petals") {
      return (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-black text-slate-950">
            {block.title}
          </h3>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_200px_1fr] lg:items-center">
            <div className="space-y-2">
              {toArray(block.branches)
                .filter((_, index) => index % 2 === 0)
                .map((branch, index) => (
                  <SummaryPetal
                    key={`${branch?.label}-${index}`}
                    branch={branch}
                  />
                ))}
            </div>

            <div className="flex min-h-32 items-center justify-center rounded-full bg-slate-950 p-5 text-center text-sm font-black text-white">
              <div>
                <p>{block.center}</p>
                {block?.center_explanation && (
                  <p className="mt-2 text-[10px] font-semibold leading-5 text-slate-300">
                    {block.center_explanation}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {toArray(block.branches)
                .filter((_, index) => index % 2 === 1)
                .map((branch, index) => (
                  <SummaryPetal
                    key={`${branch?.label}-${index}`}
                    branch={branch}
                  />
                ))}
            </div>
          </div>

          <MemoryHook text={block.memory} />
        </section>
      );
    }

    if (block.type === "pyramid") {
      return (
        <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-black text-slate-950">
            {block.title}
          </h3>

          <div className="mx-auto mt-4 flex max-w-3xl flex-col items-center gap-2">
            {toArray(block.levels).map((level, index) => (
              <div
                key={`${level?.label}-${index}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"
                style={{
                  width: `${Math.min(62 + index * 18, 100)}%`,
                }}
              >
                <p className="text-xs font-black text-amber-700">
                  {level?.label}
                </p>

                {level?.explanation && (
                  <p className="mx-auto mt-2 max-w-xl text-[11px] font-semibold leading-5 text-slate-500">
                    {level.explanation}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {uniqueSummaryLines(level?.items).map((item, itemIndex) => (
                    <span
                      key={`${getText(item)}-${itemIndex}`}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700"
                    >
                      {getText(item)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <MemoryHook text={block.memory} />
        </section>
      );
    }

    if (block.type === "mirror") {
      return (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-black text-slate-950">
            {block.title}
          </h3>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {[block.left, block.right].map((side, sideIndex) => (
              <article
                key={`${side?.title}-${sideIndex}`}
                className="rounded-[24px] bg-slate-50 p-4"
              >
                <h4 className="text-center text-base font-black text-slate-950">
                  {side?.title}
                </h4>

                <p className="mt-1 text-center text-[11px] font-bold text-slate-500">
                  {side?.subtitle}
                </p>

                {side?.summary && (
                  <p className="mx-auto mt-2 max-w-md text-center text-[11px] font-semibold leading-5 text-slate-500">
                    {side.summary}
                  </p>
                )}

                <div className="mt-4 space-y-3">
                  {toArray(side?.rows).map((row, rowIndex) => (
                    <div
                      key={`${row?.label}-${rowIndex}`}
                      className="rounded-2xl bg-white p-4"
                    >
                      <p className="text-xs font-black text-amber-700">
                        {row?.label}
                      </p>

                      {row?.explanation && (
                        <p className="mt-1 text-[10px] font-semibold leading-5 text-slate-500">
                          {row.explanation}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2">
                        {uniqueSummaryLines(row?.items).map((item, itemIndex) => (
                          <span
                            key={`${getText(item)}-${itemIndex}`}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700"
                          >
                            {getText(item)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {toArray(block?.quick_explanations).length > 0 && (
            <div className="mt-4 rounded-[22px] border border-amber-100 bg-amber-50/60 p-4">
              <p className="mb-3 text-xs font-black text-amber-800">
                شرح سريع للمفاهيم داخل الاستراتيجيات
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {toArray(block.quick_explanations).map((item, index) => (
                  <div
                    key={`${item?.term}-${index}`}
                    className="rounded-xl bg-white px-3 py-2"
                  >
                    <span className="text-xs font-black text-slate-900">
                      {item?.term}:
                    </span>{" "}
                    <span className="text-[11px] font-semibold leading-5 text-slate-600">
                      {item?.explanation}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <MemoryHook text={block.memory} />
        </section>
      );
    }

    if (block.type === "split_tree") {
      return (
        <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-black text-slate-950">
            {block.title}
          </h3>

          <div className="mx-auto mt-4 max-w-xs rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white">
            {block.root}
          </div>

          <ArrowDown
            className="mx-auto my-3 text-slate-300"
            size={18}
          />

          <div className="grid gap-3 md:grid-cols-2">
            {toArray(block.branches).map((branch, index) => (
              <article
                key={`${branch?.label}-${index}`}
                className="rounded-[22px] bg-white p-4 shadow-sm"
              >
                <p className="text-center text-sm font-black text-amber-700">
                  {branch?.label}
                </p>

                {branch?.explanation && (
                  <p className="mt-2 text-center text-[11px] font-semibold leading-5 text-slate-500">
                    {branch.explanation}
                  </p>
                )}

                <div className="mt-3 space-y-2">
                  {uniqueSummaryLines(branch?.items).map((item, itemIndex) => (
                    <div
                      key={`${getText(item)}-${itemIndex}`}
                      className="flex items-start gap-2"
                    >
                      <CheckCircle2
                        className="mt-1 shrink-0 text-slate-400"
                        size={14}
                      />

                      <p className="text-xs font-bold leading-6 text-slate-600">
                        {getText(item)}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <MemoryHook text={block.memory} />
        </section>
      );
    }

    return null;
  };

  return (
    <article className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-8">
      <div className="mb-6 rounded-[26px] bg-slate-950 p-5 text-white">
        <p className="text-xs font-black text-amber-300">
          ملخص الدرس
        </p>

        <h2 className="mt-2 text-2xl font-black">
          {summary?.title}
        </h2>

        {lesson?.big_idea && (
          <p className="mt-3 text-sm font-semibold leading-8 text-slate-300">
            {lesson.big_idea}
          </p>
        )}

        {lesson?.memory_chain && (
          <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black leading-7">
            {lesson.memory_chain}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {toArray(summary?.blocks).map((block) => (
          <div key={block?.id}>
            {renderBlock(block)}
          </div>
        ))}
      </div>

      {summary?.final_map && (
        <section className="mt-4 rounded-[26px] bg-slate-950 p-5 text-white">
          <p className="text-center text-sm font-black text-amber-300">
            {summary.final_map.title}
          </p>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
            {uniqueSummaryLines(summary.final_map.items).map((item, index) => (
              <Fragment key={`${item}-${index}`}>
                <div className="flex-1 rounded-2xl bg-white/10 px-3 py-3 text-center text-xs font-black">
                  {item}
                </div>

                {index <
                  summary.final_map.items.length - 1 && (
                  <span className="hidden text-slate-500 lg:block">
                    ←
                  </span>
                )}
              </Fragment>
            ))}
          </div>
        </section>
      )}

      {summary?.final_recall && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-black leading-7 text-amber-950">
          {summary.final_recall}
        </div>
      )}
    </article>
  );
}


function HistoryStepCard({
  step,
}) {
  const content =
    step?.content || {};

  return (
    <article className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-8">
      <p className="text-xs font-black text-amber-700">
        {step?.type ===
        "timeline"
          ? "الخط الزمني"
          : step?.type ===
              "comparison"
            ? "قارن واربط"
            : step?.type ===
                "method"
              ? "منهجية"
              : step?.type ===
                  "memory"
                ? "الحفظ الذكي"
                : step?.type ===
                    "summary"
                  ? "المراجعة"
                  : step?.type ===
                      "master_map"
                    ? "الخريطة النهائية"
                    : step?.type ===
                        "summary_story"
                      ? "القصة الكاملة"
                      : "القصة"}
      </p>

      <h2 className="mt-1 text-2xl font-black leading-9 text-slate-950">
        {step?.title}
      </h2>

      {content?.teacher && (
        <p className="mt-4 text-[15px] font-semibold leading-9 text-slate-700">
          {
            content.teacher
          }
        </p>
      )}

      {content
        ?.central_question && (
        <div className="mt-6 rounded-3xl bg-slate-950 p-5 text-white">
          <p className="text-xs font-black text-amber-300">
            سؤال القصة
          </p>

          <p className="mt-2 text-lg font-black leading-8">
            {
              content
                .central_question
            }
          </p>
        </div>
      )}

      {content
        ?.simple_answer && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-700">
          {
            content
              .simple_answer
          }
        </div>
      )}

      {content?.groups && (
        <div className="mt-6">
          <GroupGrid
            groups={
              content.groups
            }
          />
        </div>
      )}

      {content?.points && (
        <div className="mt-6">
          <PointGrid
            points={
              content.points
            }
          />
        </div>
      )}

      {content
          ?.graph_data
          ?.diagram_type ===
        "balance_shift" && (
        <div className="mt-6">
          <BalanceShift
            graph={
              content
                .graph_data
            }
          />
        </div>
      )}

      {[
        "cause_chain",
        "flow",
      ].includes(
        content
          ?.graph_data
          ?.diagram_type,
      ) && (
        <div className="mt-6 rounded-3xl bg-slate-50 p-5">
          <FlowDiagram
            graph={
              content
                .graph_data
            }
          />
        </div>
      )}

      {content?.graph_data &&
        ![
          "balance_shift",
          "cause_chain",
          "flow",
        ].includes(content.graph_data?.diagram_type) && (
          <div className="mt-6">
            {[
              "staircase",
              "radial",
              "mega_radial",
              "petals",
              "pyramid",
              "mirror",
              "split_tree",
              "orbit_clusters",
              "hub_spokes",
              "timeline_ladder",
            ].includes(content.graph_data?.diagram_type) ? (
              <VariedMindMap graph={content.graph_data} />
            ) : (
              <GenericGraph graph={content.graph_data} />
            )}
          </div>
        )}

      {content?.comparison && (
        <div className="mt-6">
          <StrategyComparison
            comparison={content.comparison}
          />
        </div>
      )}

      {content
        ?.comparisons && (
        <div className="mt-6">
          <Comparisons
            comparisons={
              content
                .comparisons
            }
          />
        </div>
      )}

      {content?.master_map && (
        <div className="mt-6">
          <MasterMindMap
            map={content.master_map}
          />
        </div>
      )}

      {content?.characters && (
        <div className="mt-6">
          <CharacterCards
            characters={
              content.characters
            }
          />
        </div>
      )}

      {content?.character_map && (
        <div className="mt-6">
          <CharacterMindMap
            map={
              content.character_map
            }
          />
        </div>
      )}

      {content?.terms && (
        <div className="mt-6">
          <TermCards
            terms={content.terms}
          />
        </div>
      )}

      {content?.term_map && (
        <div className="mt-6">
          <CharacterMindMap
            map={content.term_map}
          />
        </div>
      )}

      {content?.date_memory && (
        <div className="mt-6">
          <DateMemoryCard
            data={content.date_memory}
          />
        </div>
      )}

      {content?.date_ladder && (
        <div className="mt-6">
          <DateLadder
            items={content.date_ladder}
          />
        </div>
      )}

      {content?.date_method && (
        <div className="mt-6">
          <DateMethod
            method={content.date_method}
          />
        </div>
      )}

      {content?.timeline && (
        <div className="mt-7">
          <Timeline
            events={content.timeline}
          />
        </div>
      )}

      {content?.events && (
        <div className="mt-7">
          <Timeline
            events={content.events}
          />
        </div>
      )}

      {content?.steps && (
        <div className="mt-6 space-y-2">
          {toArray(
            content.steps,
          ).map(
            (
              item,
              index,
            ) => (
              <div
                key={`${getText(item)}-${index}`}
                className="flex gap-3 rounded-2xl bg-slate-50 p-4"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                  {index +
                    1}
                </span>

                <span className="text-sm font-bold leading-7 text-slate-700">
                  {getText(
                    item,
                  )}
                </span>
              </div>
            ),
          )}
        </div>
      )}

      {content
        ?.recognition_keys && (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {toArray(
            content
              .recognition_keys,
          ).map(
            (
              item,
              index,
            ) => (
              <div
                key={`${item?.clue || index}-${index}`}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-xs font-black text-slate-400">
                  إذا وجدت
                </p>

                <p className="mt-1 text-sm font-black text-slate-800">
                  {
                    item
                      ?.clue
                  }
                </p>

                <p className="mt-3 text-xs font-bold text-amber-800">
                  ←{" "}
                  {
                    item
                      ?.answer
                  }
                </p>
              </div>
            ),
          )}
        </div>
      )}

      {content
        ?.memory_story && (
        <div className="mt-6">
          <MemoryStory
            items={
              content
                .memory_story
            }
          />
        </div>
      )}

      {content?.sections && (
        <div className="mt-6">
          <SummarySections
            sections={
              content.sections
            }
          />
        </div>
      )}

      <MemoryHook
        text={
          content
            ?.memory_hook ||
          content
            ?.golden_chain ||
          content
            ?.recall_sentence ||
          content
            ?.final_memory_sentence
        }
      />

      {content?.takeaway && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black leading-7 text-slate-800">
          الخلاصة:{" "}
          {
            content
              .takeaway
          }
        </div>
      )}
    </article>
  );
}

/* =========================================================
   Micro recall / Active recall / BAC
========================================================= */

function MicroRecall({
  item,
}) {
  const [open, setOpen] =
    useState(false);

  return (
    <article className="rounded-[30px] border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-center gap-2 text-amber-900">
        <Brain size={20} />
        <p className="text-xs font-black">
          {item?.label ||
            "استرجاع"}
        </p>
      </div>

      <h3 className="mt-2 text-xl font-black text-amber-950">
        {item?.title}
      </h3>

      <p className="mt-2 text-sm font-bold leading-7 text-amber-950/80">
        {item?.prompt}
      </p>

      <button
        type="button"
        onClick={() =>
          setOpen(
            (value) =>
              !value,
          )
        }
        className="mt-5 rounded-2xl bg-amber-950 px-4 py-3 text-sm font-black text-white"
      >
        {open
          ? "أخفِ الإجابة"
          : "اكشف بعد المحاولة"}
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {toArray(
            item?.answers,
          ).map(
            (
              answer,
              index,
            ) => (
              <p
                key={`${getText(answer)}-${index}`}
                className="rounded-2xl bg-white p-3 text-sm font-bold text-slate-700"
              >
                •{" "}
                {getText(
                  answer,
                )}
              </p>
            ),
          )}

          {toArray(
            item?.pairs,
          ).map(
            (
              pair,
              index,
            ) => (
              <div
                key={`${pair?.cue || index}-${index}`}
                className="rounded-2xl bg-white p-3"
              >
                <span className="text-xs font-black text-slate-400">
                  {
                    pair?.cue
                  }
                </span>

                <p className="mt-1 text-sm font-black text-slate-800">
                  {
                    pair
                      ?.answer
                  }
                </p>
              </div>
            ),
          )}
        </div>
      )}
    </article>
  );
}

function ActiveRecall({
  item,
}) {
  const [
    opened,
    setOpened,
  ] = useState({});

  return (
    <article className="rounded-[30px] bg-slate-950 p-6 text-white">
      <p className="text-xs font-black text-amber-300">
        {item?.label ||
          "استرجاع"}
      </p>

      <h3 className="mt-1 text-2xl font-black">
        {item?.title}
      </h3>

      {item?.subtitle && (
        <p className="mt-2 text-sm font-semibold text-slate-400">
          {
            item.subtitle
          }
        </p>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {toArray(
          item?.items,
        ).map(
          (
            entry,
            index,
          ) => {
            const key =
              `${entry?.word || index}-${index}`;

            return (
              <button
                type="button"
                key={key}
                onClick={() =>
                  setOpened(
                    (prev) => ({
                      ...prev,
                      [key]:
                        !prev[
                          key
                        ],
                    }),
                  )
                }
                className="rounded-3xl border border-white/10 bg-white/5 p-5 text-right"
              >
                <p className="text-lg font-black text-amber-300">
                  {
                    entry
                      ?.word
                  }
                </p>

                <p className="mt-2 min-h-7 text-sm font-semibold leading-7 text-slate-300">
                  {opened[
                    key
                  ]
                    ? entry?.answer
                    : "اضغط بعد أن تحاول الاسترجاع"}
                </p>
              </button>
            );
          },
        )}
      </div>
    </article>
  );
}

function TeachBack({
  item,
}) {
  return (
    <article className="rounded-[30px] border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <Sparkles
          size={19}
        />

        <p className="text-xs font-black text-slate-500">
          {item?.label}
        </p>
      </div>

      <h3 className="mt-2 text-2xl font-black">
        {item?.title}
      </h3>

      {item?.subtitle && (
        <p className="mt-2 text-sm font-semibold text-slate-500">
          {
            item.subtitle
          }
        </p>
      )}

      <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-white">
        <p className="text-lg font-black leading-8">
          {item?.prompt}
        </p>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-2">
        {toArray(
          item?.checkpoints,
        ).map(
          (
            point,
            index,
          ) => (
            <div
              key={`${getText(point)}-${index}`}
              className="flex items-start gap-2 rounded-2xl bg-slate-50 p-4"
            >
              <CheckCircle2
                className="mt-1 shrink-0 text-slate-400"
                size={16}
              />

              <span className="text-sm font-bold leading-6 text-slate-700">
                {getText(
                  point,
                )}
              </span>
            </div>
          ),
        )}
      </div>
    </article>
  );
}

function SpacedReview({
  item,
}) {
  return (
    <article className="rounded-[30px] border border-slate-200 bg-white p-6">
      <p className="text-xs font-black text-amber-700">
        {item?.label}
      </p>

      <h3 className="mt-1 text-2xl font-black">
        {item?.title}
      </h3>

      <div className="mt-5 space-y-2">
        {toArray(
          item?.schedule,
        ).map(
          (
            entry,
            index,
          ) => (
            <div
              key={`${entry?.when || index}-${index}`}
              className="grid gap-2 rounded-2xl bg-slate-50 p-4 md:grid-cols-[130px_1fr]"
            >
              <span className="text-xs font-black text-slate-950">
                {
                  entry?.when
                }
              </span>

              <span className="text-sm font-semibold leading-6 text-slate-600">
                {
                  entry?.task
                }
              </span>
            </div>
          ),
        )}
      </div>
    </article>
  );
}

function BacChallenge({
  item,
}) {
  const [
    answers,
    setAnswers,
  ] = useState({});

  return (
    <article className="rounded-[30px] bg-slate-950 p-6 text-white">
      <div className="flex items-center gap-2 text-amber-300">
        <Target
          size={19}
        />

        <p className="text-xs font-black">
          {item?.label}
        </p>
      </div>

      <h3 className="mt-2 text-2xl font-black">
        {item?.title}
      </h3>

      <div className="mt-6 space-y-5">
        {toArray(
          item?.questions,
        ).map(
          (
            question,
            index,
          ) => {
            const qid =
              question?.id ||
              `q-${index}`;

            const selected =
              answers[qid];

            return (
              <article
                key={qid}
                className="rounded-3xl bg-white p-5 text-slate-950"
              >
                <p className="font-black leading-7">
                  {
                    question
                      ?.prompt
                  }
                </p>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {toArray(
                    question
                      ?.options,
                  ).map(
                    (
                      option,
                    ) => {
                      const picked =
                        normalizeComparable(
                          selected,
                        ) ===
                        normalizeComparable(
                          option,
                        );

                      const correct =
                        normalizeComparable(
                          option,
                        ) ===
                        normalizeComparable(
                          question
                            ?.answer,
                        );

                      return (
                        <button
                          key={getText(option)}
                          type="button"
                          onClick={() =>
                            setAnswers(
                              (
                                prev,
                              ) => ({
                                ...prev,
                                [qid]:
                                  getText(
                                    option,
                                  ),
                              }),
                            )
                          }
                          className={cn(
                            "rounded-2xl border p-3 text-right text-sm font-bold",
                            selected &&
                              correct
                              ? "border-slate-950 bg-slate-950 text-white"
                              : selected &&
                                  picked
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-slate-200 bg-white",
                          )}
                        >
                          {getText(
                            option,
                          )}
                        </button>
                      );
                    },
                  )}
                </div>

                {selected && (
                  <div className="mt-3 rounded-2xl bg-amber-50 p-3">
                    <p className="text-xs font-black text-amber-950">
                      الإجابة:{" "}
                      {
                        question
                          ?.answer
                      }
                    </p>

                    {question?.why && (
                      <p className="mt-1 text-xs font-bold leading-6 text-amber-900">
                        {
                          question
                            ?.why
                        }
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          },
        )}
      </div>
    </article>
  );
}

function QuizStep({
  step,
}) {
  const questions =
    toArray(
      step?.content
        ?.questions,
    );

  const [index, setIndex] =
    useState(0);

  const [open, setOpen] =
    useState(false);

  if (!questions.length) {
    return (
      <HistoryStepCard
        step={step}
      />
    );
  }

  const current =
    questions[index];

  return (
    <article className="rounded-[30px] bg-slate-950 p-6 text-white">
      <p className="text-xs font-black text-amber-300">
        الاختبار النهائي
      </p>

      <h3 className="mt-1 text-2xl font-black">
        {step?.title}
      </h3>

      <div className="mt-6 rounded-3xl bg-white p-5 text-slate-950">
        <p className="text-xs font-black text-slate-400">
          {index + 1} /{" "}
          {questions.length}
        </p>

        <p className="mt-2 text-lg font-black leading-8">
          {
            current
              ?.question
          }
        </p>

        <button
          type="button"
          onClick={() =>
            setOpen(
              (value) =>
                !value,
            )
          }
          className="mt-5 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
        >
          {open
            ? "أخفِ الجواب"
            : "اكشف الجواب"}
        </button>

        {open && (
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-950">
            {
              current
                ?.answer
            }
          </p>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            disabled={
              index === 0
            }
            onClick={() => {
              setIndex(
                (value) =>
                  Math.max(
                    0,
                    value -
                      1,
                  ),
              );
              setOpen(false);
            }}
            className="inline-flex items-center gap-1 text-xs font-black text-slate-500 disabled:opacity-30"
          >
            <ChevronRight
              size={16}
            />
            السابق
          </button>

          <button
            type="button"
            disabled={
              index ===
              questions.length -
                1
            }
            onClick={() => {
              setIndex(
                (value) =>
                  Math.min(
                    questions.length -
                      1,
                    value +
                      1,
                  ),
              );
              setOpen(false);
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-30"
          >
            التالي
            <ChevronLeft
              size={16}
            />
          </button>
        </div>
      </div>
    </article>
  );
}

function RenderPhaseItem({
  item,
  stepMap,
  axis,
  axisId,
  data,
  lesson,
  onReExplain,
}) {
  if (
    item?.kind ===
    "micro_recall"
  ) {
    return (
      <MicroRecall
        item={item}
      />
    );
  }

  if (
    item?.kind ===
    "active_recall"
  ) {
    return (
      <ActiveRecall
        item={item}
      />
    );
  }

  if (
    item?.kind ===
    "teach_back"
  ) {
    return (
      <TeachBack
        item={item}
      />
    );
  }

  if (
    item?.kind ===
    "spaced_review"
  ) {
    return (
      <SpacedReview
        item={item}
      />
    );
  }

  if (
    item?.kind ===
    "bac_challenge"
  ) {
    return (
      <BacChallenge
        item={item}
      />
    );
  }

  const step =
    item?.ref
      ? stepMap[
          String(
            item.ref,
          )
        ]
      : null;

  if (!step) {
    return null;
  }

  const enrichedStep = {
    ...step,
    axis_tag:
      lesson?.axis_tag ||
      axis?.tag ||
      "",
    chapter_code:
      lesson
        ?.chapter_code ||
      "",
  };

  const isQuiz =
    [
      "quiz",
      "final_quiz",
      "quick_check",
    ].includes(
      step?.type,
    );

  const isOnePageSummary =
    step?.type ===
      "one_page_summary" ||
    item?.kind ===
      "one_page_summary";

  return (
    <div>
      {isOnePageSummary ? (
        <OnePageAxisSummary
          lesson={lesson}
        />
      ) : isQuiz ? (
        <QuizStep
          step={
            enrichedStep
          }
        />
      ) : (
        <HistoryStepCard
          step={
            enrichedStep
          }
        />
      )}

      {!isQuiz &&
        !isOnePageSummary && (
        <HistoryAIHelpPanel
          step={
            enrichedStep
          }
          axis={axis}
          axisId={
            axisId
          }
          initialHistory={getStepAIHistory(
            data,
            step?.id,
          )}
          onReExplain={
            onReExplain
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   Header / navigation
========================================================= */

function LessonHeader({
  axis,
  lesson,
  mastery,
  phaseIndex,
  totalPhases,
}) {
  const progress =
    totalPhases > 0
      ? ((phaseIndex + 1) /
          totalPhases) *
        100
      : 0;

  return (
    <header
      id="history-course-card-top"
      className="overflow-hidden rounded-[32px] bg-slate-950 text-white shadow-xl"
    >
      <div className="p-6 md:p-9">
        <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-300">
          {lesson
            ?.unit_number && (
            <span className="rounded-full bg-white/10 px-3 py-1">
              الوحدة{" "}
              {
                lesson
                  .unit_number
              }
            </span>
          )}

          {lesson
            ?.chapter_title && (
            <span className="rounded-full bg-white/10 px-3 py-1">
              {
                lesson
                  .chapter_title
              }
            </span>
          )}

          {lesson
            ?.estimated_minutes && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
              <Clock3
                size={13}
              />

              {
                lesson
                  .estimated_minutes
              }{" "}
              دقيقة
            </span>
          )}
        </div>

        <p className="mt-6 text-sm font-black text-amber-300">
          {mastery?.intro
            ?.eyebrow ||
            "التاريخ"}
        </p>

        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">
          {axis?.title ||
            mastery?.intro
              ?.title ||
            "درس التاريخ"}
        </h1>

        <p className="mt-4 max-w-3xl text-sm font-semibold leading-8 text-slate-300 md:text-base">
          {mastery?.intro
            ?.subtitle ||
            lesson
              ?.lesson_goal}
        </p>

        {toArray(
          mastery
            ?.memory_chain,
        ).length > 0 && (
          <div className="mt-7 flex flex-wrap gap-2">
            {mastery.memory_chain.map(
              (
                item,
                index,
              ) => (
                <div
                  key={`${item?.word || index}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <strong className="text-sm text-white">
                    {
                      item
                        ?.word
                    }
                  </strong>

                  <span className="mr-2 text-[11px] font-bold text-slate-400">
                    {
                      item
                        ?.label
                    }
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-6 py-4 md:px-9">
        <div className="mb-2 flex items-center justify-between text-[11px] font-black text-slate-400">
          <span>
            {Math.round(
              progress,
            )}
            %
          </span>

          <span>
            تقدمك في الدرس
          </span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white transition-all duration-500"
            style={{
              width:
                `${progress}%`,
            }}
          />
        </div>
      </div>
    </header>
  );
}

function PhaseSidebar({
  phases,
  activePhase,
  onChange,
}) {
  return (
    <aside className="h-fit lg:sticky lg:top-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
        <p className="px-3 pb-3 pt-2 text-xs font-black text-slate-400">
          مراحل القصة
        </p>

        <div className="space-y-1">
          {phases.map(
            (
              phase,
              index,
            ) => {
              const active =
                index ===
                activePhase;

              return (
                <button
                  key={
                    phase?.id ||
                    index
                  }
                  type="button"
                  onClick={() =>
                    onChange(
                      index,
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right transition",
                    active
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black",
                      active
                        ? "bg-white/10"
                        : "bg-slate-100 text-slate-700",
                    )}
                  >
                    {phase
                      ?.number ||
                      String(
                        index +
                          1,
                      ).padStart(
                        2,
                        "0",
                      )}
                  </span>

                  <span className="min-w-0">
                    <span className="block text-[11px] font-black opacity-60">
                      {
                        phase
                          ?.label
                      }
                    </span>

                    <span className="mt-0.5 block line-clamp-2 text-xs font-black leading-5">
                      {
                        phase
                          ?.title
                      }
                    </span>
                  </span>
                </button>
              );
            },
          )}
        </div>
      </div>
    </aside>
  );
}

function PhaseHeader({
  phase,
}) {
  return (
    <div className="mb-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
          {phase?.number ||
            "01"}
        </div>

        <div>
          <p className="text-xs font-black text-amber-700">
            {phase?.label}
          </p>

          <h2 className="mt-1 text-2xl font-black text-slate-950">
            {phase?.title}
          </h2>

          {phase
            ?.description && (
            <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">
              {
                phase
                  .description
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Main component
========================================================= */

/*
Usage:
<HistoryLesson
  data={apiResponse}
  axisId={axisId}
  onReExplain={optionalCustomHandler}
/>

يمكن أن تكون data:
{
  id,
  tag,
  title,
  content: {...},
  re_explanations: [...]
}

أو:
{
  axis: {
    id,
    tag,
    title,
    content: {...}
  },
  re_explanations: [...]
}
*/
export default function HistoryLesson({
  data,
  axisId: axisIdProp,
  onReExplain,
}) {
  const lesson =
    useMemo(
      () =>
        normalizeLesson(
          data,
        ),
      [data],
    );

  const axis =
    useMemo(
      () =>
        normalizeAxis(
          data,
          lesson,
        ),
      [
        data,
        lesson,
      ],
    );

  const mastery =
    useMemo(
      () =>
        normalizeMastery(
          lesson || {},
        ),
      [lesson],
    );

  const stepMap =
    useMemo(
      () =>
        buildStepMap(
          lesson || {},
        ),
      [lesson],
    );

  const phases =
    toArray(
      mastery?.phases,
    );

  const [
    phaseIndex,
    setPhaseIndex,
  ] = useState(0);

  /*
   * إذا API جلب محورًا جديدًا:
   * نرجع تلقائيًا لأول مرحلة.
   */
  useEffect(() => {
    setPhaseIndex(0);
  }, [
    axis?.id,
    axis?.tag,
  ]);

  const safePhaseIndex =
    Math.max(
      0,
      Math.min(
        phaseIndex,
        Math.max(
          phases.length -
            1,
          0,
        ),
      ),
    );

  const phase =
    phases[
      safePhaseIndex
    ];

  const resolvedAxisId =
    axisIdProp ??
    axis?.id ??
    data?.axis_id ??
    null;

  function changePhase(
    nextIndex,
  ) {
    const safe =
      Math.max(
        0,
        Math.min(
          phases.length -
            1,
          nextIndex,
        ),
      );

    setPhaseIndex(safe);
    scrollToHistoryTop();
  }

  if (!lesson) {
    return (
      <section
        dir="rtl"
        className="rounded-3xl border border-slate-200 bg-white p-8 text-center"
      >
        <BookOpen
          className="mx-auto text-slate-300"
          size={38}
        />

        <h2 className="mt-4 text-lg font-black text-slate-900">
          لا توجد بيانات للدرس
        </h2>

        <p className="mt-2 text-sm font-semibold text-slate-500">
          تأكد أن API يرجع
          content أو
          axis.content.
        </p>
      </section>
    );
  }

  if (!phases.length) {
    return (
      <section
        dir="rtl"
        className="rounded-3xl border border-slate-200 bg-white p-8 text-center"
      >
        <AlertTriangle
          className="mx-auto text-amber-500"
          size={38}
        />

        <h2 className="mt-4 text-lg font-black text-slate-900">
          لا توجد مراحل داخل الدرس
        </h2>

        <p className="mt-2 text-sm font-semibold text-slate-500">
          أضف learning_path أو
          mastery_experience.phases
          إلى JSON.
        </p>
      </section>
    );
  }

  return (
    <section
      dir={
        lesson?.direction ||
        "rtl"
      }
      className="min-h-screen bg-[#f7f6f3] text-slate-950"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        <LessonHeader
          axis={axis}
          lesson={
            lesson
          }
          mastery={
            mastery
          }
          phaseIndex={
            safePhaseIndex
          }
          totalPhases={
            phases.length
          }
        />

        <div className="mt-5 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <PhaseSidebar
            phases={
              phases
            }
            activePhase={
              safePhaseIndex
            }
            onChange={
              changePhase
            }
          />

          <main className="min-w-0">
            <PhaseHeader
              phase={
                phase
              }
            />

            <div
              key={
                phase?.id ||
                safePhaseIndex
              }
              className="space-y-5"
            >
              {toArray(
                phase?.items,
              ).map(
                (
                  item,
                  index,
                ) => (
                  <RenderPhaseItem
                    key={
                      item?.id ||
                      `${phase?.id}-${index}`
                    }
                    item={
                      item
                    }
                    stepMap={
                      stepMap
                    }
                    axis={
                      axis
                    }
                    axisId={
                      resolvedAxisId
                    }
                    data={
                      data
                    }
                    lesson={
                      lesson
                    }
                    onReExplain={
                      onReExplain
                    }
                  />
                ),
              )}
            </div>

            <div className="sticky bottom-2 z-20 mt-6 rounded-[24px] border border-white/90 bg-white/95 p-3 shadow-[0_18px_60px_-34px_rgba(15,23,42,.5)] ring-1 ring-amber-100/80 backdrop-blur-xl sm:p-4">
              <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <button
                  type="button"
                  onClick={() =>
                    changePhase(
                      safePhaseIndex -
                        1,
                    )
                  }
                  disabled={
                    safePhaseIndex ===
                    0
                  }
                  className={cn(
                    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition",
                    safePhaseIndex ===
                      0
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-slate-950 text-white shadow-lg hover:bg-slate-800",
                  )}
                >
                  <ArrowRight
                    size={19}
                  />
                  السابق
                </button>

                <div className="order-first col-span-2 px-2 text-center sm:order-none sm:col-span-1">
                  <p className="text-[10px] font-black tracking-[0.16em] text-slate-400">
                    المرحلة الحالية
                  </p>

                  <p className="mx-auto mt-1 max-w-[300px] truncate text-sm font-black text-slate-950">
                    {
                      phase
                        ?.title
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    changePhase(
                      safePhaseIndex +
                        1,
                    )
                  }
                  disabled={
                    safePhaseIndex ===
                    phases.length -
                      1
                  }
                  className={cn(
                    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition",
                    safePhaseIndex ===
                      phases.length -
                        1
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-gradient-to-l from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20 hover:-translate-y-0.5",
                  )}
                >
                  التالي
                  <ArrowLeft
                    size={19}
                  />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-start gap-2 overflow-x-auto pb-1 sm:justify-center">
                {phases.map(
                  (
                    currentPhase,
                    index,
                  ) => {
                    const active =
                      safePhaseIndex ===
                      index;

                    return (
                      <button
                        key={
                          currentPhase?.id ||
                          index
                        }
                        type="button"
                        onClick={() =>
                          changePhase(
                            index,
                          )
                        }
                        title={
                          currentPhase?.title
                        }
                        className={cn(
                          "flex h-9 shrink-0 items-center justify-center rounded-xl border px-3 text-[11px] font-black transition",
                          active
                            ? "border-amber-200 bg-amber-50 text-amber-700 shadow-sm"
                            : "border-slate-200 bg-white text-slate-400 hover:border-amber-200 hover:text-amber-600",
                        )}
                      >
                        {
                          currentPhase?.number ||
                          index +
                            1
                        }
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}
