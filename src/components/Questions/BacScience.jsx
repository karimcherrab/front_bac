import { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  GraduationCap,
  ImageIcon,
  Layers3,
  Lightbulb,
  ListChecks,
  Microscope,
  Printer,
  RefreshCcw,
  X,
} from "lucide-react";

import { UserContext } from "../../Utils/UserContext";

const RAW_API_BASE_URL = import.meta.env.VITE_BASE_URL || "";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");
const PUBLIC_BASE_URL = import.meta.env.BASE_URL || "/";

const RAW_DOCUMENT_BASE_URL =
  import.meta.env.VITE_BAC_DOCUMENT_BASE_URL ||
  (API_BASE_URL ? `${API_BASE_URL}/media/` : "/media/");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function joinUrl(base, path) {
  const safeBase = String(base || "").replace(/\/+$/, "");
  const safePath = String(path || "").replace(/^\/+/, "");
  return safeBase ? `${safeBase}/${safePath}` : `/${safePath}`;
}

/**
 * يدعم:
 * - رابط خارجي كامل
 * - /media/...
 * - media/...
 * - science/bac/...
 * - bac/...
 * - الصور الموجودة داخل public/
 */
function resolveScienceDocumentPath(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (/^(?:https?:)?\/\//i.test(raw) || /^(?:data|blob):/i.test(raw)) {
    return raw;
  }

  const normalized = raw.replace(/\\+/g, "/");

  if (normalized.startsWith("/media/")) {
    return API_BASE_URL
      ? `${API_BASE_URL}${normalized}`
      : normalized;
  }

  if (/^media\//i.test(normalized)) {
    return API_BASE_URL
      ? joinUrl(API_BASE_URL, normalized)
      : `/${normalized}`;
  }

  if (/^(?:science\/bac|bac)\//i.test(normalized)) {
    return joinUrl(RAW_DOCUMENT_BASE_URL, normalized);
  }

  if (normalized.startsWith("/")) {
    return normalized;
  }

  return joinUrl(PUBLIC_BASE_URL, normalized);
}

function getErrorMessage(error) {
  if (error?.code === "ERR_NETWORK") {
    return "تعذر الاتصال بالخادم. تأكد من تشغيل Django ومن قيمة VITE_BASE_URL.";
  }

  if (error?.response?.status === 401) {
    return "انتهت صلاحية تسجيل الدخول. سجّل الدخول من جديد.";
  }

  if (error?.response?.status === 404) {
    return "لم يتم العثور على اختبارات بكالوريا لهذا الفصل.";
  }

  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    "حدث خطأ أثناء تحميل اختبارات العلوم."
  );
}

function normalizePayload(payload) {
  if (Array.isArray(payload)) {
    return {
      chapter: {},
      exercises: payload,
    };
  }

  const source = asObject(payload);

  if (Array.isArray(source.exercises)) {
    return {
      ...source,
      chapter: asObject(source.chapter),
      exercises: source.exercises,
    };
  }

  if (Array.isArray(source.results)) {
    return {
      chapter: asObject(source.chapter),
      exercises: source.results,
    };
  }

  if (source.data) {
    const nested = normalizePayload(source.data);
    if (nested.exercises.length > 0) return nested;
  }

  // يدعم مباشرة JSON واحد من ملفات البكالوريا التي أرسلتها
  if (
    hasText(source.statement) ||
    Array.isArray(source.questions) ||
    Array.isArray(source.figures)
  ) {
    return {
      chapter: {
        id: source.chapter_id ?? null,
        code: source.chapter_code || "",
        title: source.chapter_title || "",
      },
      exercises: [source],
    };
  }

  return {
    chapter: asObject(source.chapter),
    exercises: [],
  };
}

function getFigureUsage(figure) {
  return String(figure?.usage || "")
    .trim()
    .toLowerCase();
}

function isStatementFigure(figure) {
  const usage = getFigureUsage(figure);
  return !usage || ["statement", "exercise", "question"].includes(usage);
}

function isSolutionFigure(figure) {
  const usage = getFigureUsage(figure);
  return ["solution", "answer", "correction"].includes(usage);
}

function getStatementFigures(exercise) {
  return asArray(exercise?.figures).filter(isStatementFigure);
}

function getSolutionFigures(exercise) {
  return asArray(exercise?.figures).filter(isSolutionFigure);
}

function normalizeSteps(value) {
  if (Array.isArray(value)) return value;

  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, step], index) => {
      if (step && typeof step === "object") {
        return {
          step_number: step.step_number ?? key ?? index + 1,
          ...step,
        };
      }

      return {
        step_number: key ?? index + 1,
        explanation: String(step ?? ""),
      };
    });
  }

  return [];
}

function getBranches(exercise) {
  const values = asArray(exercise?.branches);

  return values
    .map((branch, index) => {
      if (typeof branch === "string") {
        return {
          code: branch,
          name: branch,
        };
      }

      const item = asObject(branch);
      return {
        code: item.code || `branch-${index + 1}`,
        name: item.name || item.title || item.code || "",
      };
    })
    .filter((branch) => hasText(branch.name));
}

function getQuestionFigureRefs(question) {
  const solution = asObject(question?.solution);

  return [
    ...asArray(solution.figure_refs),
    ...asArray(solution.figure_ids),
    ...asArray(solution.document_refs),
    ...asArray(question?.solution_figure_refs),
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function getQuestionSolutionFigures(exercise, question) {
  const refs = new Set(getQuestionFigureRefs(question));

  if (refs.size === 0) return [];

  return asArray(exercise?.figures).filter((figure) => {
    if (!isSolutionFigure(figure)) return false;

    const id = String(
      figure?.id ||
        figure?.key ||
        figure?.document_key ||
        ""
    ).trim();

    return id && refs.has(id);
  });
}

function formatSession(value) {
  const session = String(value || "").toLowerCase();

  if (["ordinary", "normal", "main"].includes(session)) {
    return "الدورة العادية";
  }

  if (["replacement", "makeup", "special"].includes(session)) {
    return "الدورة الاستثنائية";
  }

  return hasText(value) ? String(value) : "";
}

function StatPill({ icon: Icon, children }) {
  if (!children) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
      <Icon className="h-3.5 w-3.5" />
      <span>{children}</span>
    </span>
  );
}

function LoadingState() {
  return (
    <div
      dir="rtl"
      className="flex min-h-[420px] items-center justify-center bg-slate-50 px-4"
    >
      <div className="rounded-3xl border border-emerald-100 bg-white px-8 py-10 text-center shadow-sm">
        <RefreshCcw className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
        <p className="mt-4 text-base font-black text-slate-800">
          جاري تحميل اختبارات العلوم...
        </p>
        <p className="mt-1 text-sm text-slate-500">
          يتم تجهيز نص التمرين والوثائق والتصحيح النموذجي.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      dir="rtl"
      className="flex min-h-[420px] items-center justify-center bg-slate-50 px-4"
    >
      <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Microscope className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-4 text-xl font-black text-slate-900">
          لا توجد اختبارات علوم حاليًا
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          أضف اختبارات البكالوريا إلى هذا الفصل، وستظهر هنا مع الوثائق
          والحلول النموذجية.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div
      dir="rtl"
      className="flex min-h-[420px] items-center justify-center bg-slate-50 px-4"
    >
      <div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
        <h2 className="mt-4 text-lg font-black text-slate-900">
          تعذر تحميل اختبارات العلوم
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
        >
          <RefreshCcw className="h-4 w-4" />
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

function ScienceDocument({
  figure,
  index,
  onOpen,
  compact = false,
}) {
  const src = resolveScienceDocumentPath(
    figure?.path ||
      figure?.url ||
      figure?.src ||
      figure?.image
  );

  if (!src) return null;

  return (
    <figure
      className={cn(
        "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <figcaption className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-black text-emerald-700">
            <ImageIcon className="h-4 w-4 shrink-0" />
            وثيقة علمية
          </div>
          <div className="mt-1 text-sm font-bold leading-6 text-slate-800">
            {figure?.title || `الوثيقة ${index + 1}`}
          </div>
        </figcaption>

        <button
          type="button"
          onClick={() => onOpen?.({ ...figure, __src: src })}
          className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          title="تكبير الوثيقة"
        >
          <Eye className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onOpen?.({ ...figure, __src: src })}
        className="block w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-50"
      >
        <img
          src={src}
          alt={figure?.title || `الوثيقة ${index + 1}`}
          loading="lazy"
          className="mx-auto max-h-[760px] w-auto max-w-full object-contain"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            const fallback = event.currentTarget.nextElementSibling;
            if (fallback) fallback.classList.remove("hidden");
          }}
        />
        <div className="hidden p-6 text-center text-sm font-bold text-rose-600">
          تعذر عرض هذه الوثيقة. تحقق من مسار الصورة في JSON ومن إعداد
          VITE_BAC_DOCUMENT_BASE_URL.
        </div>
      </button>
    </figure>
  );
}

function DocumentViewer({ figure, onClose }) {
  if (!figure) return null;

  const src =
    figure.__src ||
    resolveScienceDocumentPath(
      figure?.path ||
        figure?.url ||
        figure?.src ||
        figure?.image
    );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="text-xs font-black text-emerald-700">
              عرض الوثيقة
            </div>
            <div className="truncate text-sm font-black text-slate-900 sm:text-base">
              {figure?.title || "وثيقة البكالوريا"}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(94vh-68px)] overflow-auto bg-slate-100 p-3 sm:p-6">
          <img
            src={src}
            alt={figure?.title || "وثيقة البكالوريا"}
            className="mx-auto h-auto max-w-full rounded-xl bg-white object-contain shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}

function ModelSolution({
  exercise,
  onOpenDocument,
  onQuestionFocus,
}) {
  const questions = asArray(exercise?.questions);
  const allSolutionFigures = getSolutionFigures(exercise);

  const referencedFigureIds = new Set();

  questions.forEach((question) => {
    getQuestionSolutionFigures(exercise, question).forEach((figure) => {
      const id = String(figure?.id || "").trim();
      if (id) referencedFigureIds.add(id);
    });
  });

  const unreferencedFigures = allSolutionFigures.filter((figure) => {
    const id = String(figure?.id || "").trim();
    return !id || !referencedFigureIds.has(id);
  });

  if (questions.length === 0 && allSolutionFigures.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold leading-7 text-amber-900">
        لا يوجد تصحيح نموذجي مفصل محفوظ لهذا التمرين بعد.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-600 p-2.5 text-white shadow-sm">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">
              الحل النموذجي
            </h3>
            <p className="mt-1 text-sm leading-7 text-slate-600">
              التصحيح مرتب حسب مطالب التمرين، مع خطوات الحل والنتيجة النهائية
              والوثائق الخاصة بالتصحيح عند توفرها.
            </p>
          </div>
        </div>
      </div>

      {questions.map((question, questionIndex) => {
        const solution = asObject(question?.solution);
        const steps = normalizeSteps(solution?.steps);
        const figures = getQuestionSolutionFigures(exercise, question);

        return (
          <article
            key={question?.id || `science-question-${questionIndex}`}
            onClick={() =>
              onQuestionFocus?.({
                id:
                  question?.id ??
                  question?.question_id ??
                  questionIndex + 1,
                number:
                  question?.display_order ??
                  question?.number ??
                  questionIndex + 1,
                title: question?.title || "",
                text:
                  question?.text ||
                  question?.standalone_text ||
                  "",
              })
            }
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white">
                  {question?.display_order ??
                    question?.number ??
                    questionIndex + 1}
                </span>
                <p className="whitespace-pre-wrap text-sm font-black leading-8 text-slate-900 sm:text-base">
                  {question?.text ||
                    question?.standalone_text ||
                    `السؤال ${questionIndex + 1}`}
                </p>
              </div>
            </div>

            <div className="space-y-5 p-4 sm:p-6">
              {hasText(solution?.introduction) && (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs font-black text-sky-700">
                    <BookOpen className="h-4 w-4" />
                    مدخل الحل
                  </div>
                  <p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">
                    {solution.introduction}
                  </p>
                </div>
              )}

              {hasText(solution?.strategy) && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs font-black text-violet-700">
                    <Lightbulb className="h-4 w-4" />
                    فكرة الحل
                  </div>
                  <p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">
                    {solution.strategy}
                  </p>
                </div>
              )}

              {steps.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <Layers3 className="h-4 w-4 text-emerald-600" />
                    خطوات الحل
                  </div>

                  {steps.map((step, stepIndex) => (
                    <div
                      key={
                        step?.step_number ||
                        `solution-step-${questionIndex}-${stepIndex}`
                      }
                      className="relative rounded-2xl border border-slate-200 bg-white p-4 pr-12"
                    >
                      <span className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-800">
                        {step?.step_number ?? stepIndex + 1}
                      </span>

                      {hasText(step?.title) && (
                        <h4 className="text-sm font-black text-slate-900">
                          {step.title}
                        </h4>
                      )}

                      {hasText(step?.explanation) && (
                        <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">
                          {step.explanation}
                        </p>
                      )}

                      {hasText(step?.result) && (
                        <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold leading-7 text-emerald-900">
                          {step.result}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {hasText(solution?.final_answer) && (
                <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs font-black text-emerald-700">
                    <Award className="h-4 w-4" />
                    الإجابة النموذجية
                  </div>
                  <p className="whitespace-pre-wrap text-sm font-black leading-8 text-slate-900">
                    {solution.final_answer}
                  </p>
                </div>
              )}

              {figures.length > 0 && (
                <div className="space-y-3 border-t border-slate-100 pt-5">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <ImageIcon className="h-4 w-4 text-emerald-600" />
                    وثائق التصحيح
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {figures.map((figure, figureIndex) => (
                      <ScienceDocument
                        key={
                          figure?.id ||
                          `solution-document-${questionIndex}-${figureIndex}`
                        }
                        figure={figure}
                        index={figureIndex}
                        compact
                        onOpen={onOpenDocument}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </article>
        );
      })}

      {unreferencedFigures.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-900">
            <ImageIcon className="h-4 w-4 text-emerald-600" />
            رسوم ووثائق إضافية في التصحيح
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {unreferencedFigures.map((figure, index) => (
              <ScienceDocument
                key={figure?.id || `unreferenced-solution-${index}`}
                figure={figure}
                index={index}
                compact
                onOpen={onOpenDocument}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BacScience({
  chapterId = 1,
  axisId = null,
  endpoint = "",
  onTutorExerciseChange,
  onTutorQuestionChange,
  onTutorStepChange,
  onTutorViewStateChange,
}) {
  const { token } = useContext(UserContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [activePanel, setActivePanel] = useState("exercise");
  const [openedDocument, setOpenedDocument] = useState(null);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      setError("");

      const requestUrl =
        endpoint ||
        (axisId
          ? `${API_BASE_URL}/api/exercise-generation/axes/${axisId}/`
          : `${API_BASE_URL}/api/bac/exercises/chapter/${chapterId}/`);

      const response = await axios.get(requestUrl, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      setData(normalizePayload(response.data));
      setCurrentExerciseIndex(0);
      setActivePanel("exercise");
    } catch (requestError) {
      console.error("BacScience error:", requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, [chapterId, axisId, endpoint, token]);

  const allExercises = useMemo(
    () =>
      asArray(data?.exercises).filter(
        (exercise) => exercise?.is_active !== false
      ),
    [data]
  );

  const years = useMemo(
    () =>
      [
        ...new Set(
          allExercises
            .map((exercise) => exercise?.year)
            .filter((year) => year !== null && year !== undefined && year !== "")
        ),
      ].sort((a, b) => Number(b) - Number(a)),
    [allExercises]
  );

  const exercises = useMemo(() => {
    if (selectedYear === "all") return allExercises;

    return allExercises.filter(
      (exercise) => String(exercise?.year) === String(selectedYear)
    );
  }, [allExercises, selectedYear]);

  useEffect(() => {
    setCurrentExerciseIndex(0);
    setActivePanel("exercise");
  }, [selectedYear]);

  const currentExercise = exercises[currentExerciseIndex] || null;

  useEffect(() => {
    if (!currentExercise) {
      onTutorExerciseChange?.(null);
      onTutorQuestionChange?.(null);
      onTutorStepChange?.(null);
      return;
    }

    onTutorExerciseChange?.({
      kind: "bac_science_exercise",
      id:
        currentExercise?.id ??
        currentExercise?.code ??
        `${currentExercise?.year || "bac"}-${currentExercise?.exercise_number || currentExerciseIndex + 1}`,
      code: currentExercise?.code || currentExercise?.version || "",
      title:
        currentExercise?.title ||
        `بكالوريا ${currentExercise?.year || ""} - التمرين ${
          currentExercise?.exercise_number || currentExerciseIndex + 1
        }`,
      text: currentExercise?.statement || "",
      year: currentExercise?.year ?? null,
      exercise_number:
        currentExercise?.exercise_number ?? currentExerciseIndex + 1,
      axis_tags: asArray(currentExercise?.axis_tags),
    });

    onTutorQuestionChange?.(null);
    onTutorStepChange?.(null);
  }, [
    currentExercise,
    currentExerciseIndex,
    onTutorExerciseChange,
    onTutorQuestionChange,
    onTutorStepChange,
  ]);

  useEffect(() => {
    onTutorViewStateChange?.({
      solution_visible: activePanel === "solution",
      alternative_solution_visible: false,
      visible_hints: 0,
      showing_reexplanation: false,
    });
  }, [activePanel, onTutorViewStateChange]);

  const goPrevious = () => {
    setCurrentExerciseIndex((previous) => Math.max(previous - 1, 0));
    setActivePanel("exercise");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    setCurrentExerciseIndex((previous) =>
      Math.min(previous + 1, exercises.length - 1)
    );
    setActivePanel("exercise");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchExercises} />;
  if (allExercises.length === 0) return <EmptyState />;

  const statementFigures = getStatementFigures(currentExercise);
  const questionsCount = asArray(currentExercise?.questions).length;
  const branches = getBranches(currentExercise);
  const branchLabel = branches.map((branch) => branch.name).join(" • ");
  const sessionLabel = formatSession(currentExercise?.session);
  const chapterTitle =
    currentExercise?.chapter_title ||
    data?.chapter?.title ||
    "العلوم الطبيعية";
  const exerciseTitle =
    currentExercise?.title ||
    `التمرين ${currentExercise?.exercise_number || currentExerciseIndex + 1}`;

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          .science-bac-print,
          .science-bac-print * {
            visibility: visible !important;
          }

          .science-bac-print {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }

          .science-bac-screen-only {
            display: none !important;
          }
        }
      `}</style>

      <section
        dir="rtl"
        className="min-h-full w-full overflow-x-hidden bg-[linear-gradient(180deg,#f0fdf4_0%,#f8fafc_28%,#f8fafc_100%)] px-2 py-3 sm:px-5 sm:py-6 lg:px-8"
      >
        <div className="mx-auto w-full max-w-7xl">
          {/* HEADER */}
          <header className="science-bac-screen-only overflow-hidden rounded-[2rem] border border-emerald-200 bg-white shadow-sm">
            <div className="relative overflow-hidden bg-gradient-to-l from-emerald-950 via-emerald-800 to-teal-700 px-5 py-6 text-white sm:px-7 sm:py-8">
              <div className="absolute -left-12 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-20 right-1/3 h-44 w-44 rounded-full bg-emerald-300/10 blur-2xl" />

              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black">
                    <FlaskConical className="h-4 w-4" />
                    اختبارات البكالوريا — العلوم
                  </div>

                  <h1 className="text-2xl font-black leading-tight sm:text-3xl">
                    اختبارات العلوم والحلول النموذجية
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-emerald-50/90">
                    تصفح تمارين البكالوريا حسب السنة، اقرأ الوثائق الأصلية
                    داخل التمرين، ثم افتح التصحيح النموذجي خطوة بخطوة.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                    <div className="text-[11px] font-bold text-emerald-100">
                      عدد الاختبارات
                    </div>
                    <div className="mt-0.5 text-xl font-black">
                      {allExercises.length}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                    <div className="text-[11px] font-bold text-emerald-100">
                      السنوات
                    </div>
                    <div className="mt-0.5 text-xl font-black">
                      {years.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-emerald-100 bg-white px-4 py-4 sm:px-6">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedYear("all")}
                  className={cn(
                    "shrink-0 rounded-2xl px-4 py-2.5 text-sm font-black transition",
                    selectedYear === "all"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                  )}
                >
                  كل السنوات
                </button>

                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setSelectedYear(String(year))}
                    className={cn(
                      "shrink-0 rounded-2xl px-4 py-2.5 text-sm font-black transition",
                      String(selectedYear) === String(year)
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {exercises.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <CalendarDays className="mx-auto h-9 w-9 text-slate-400" />
              <p className="mt-3 font-black text-slate-800">
                لا توجد اختبارات في هذه السنة.
              </p>
              <button
                type="button"
                onClick={() => setSelectedYear("all")}
                className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white"
              >
                عرض كل السنوات
              </button>
            </div>
          ) : (
            <>
              {/* NAVIGATION */}
              <div className="science-bac-screen-only mt-5 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={goPrevious}
                  disabled={currentExerciseIndex === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                  التمرين السابق
                </button>

                <div className="text-center">
                  <div className="text-xs font-bold text-slate-400">
                    التمرين الحالي
                  </div>
                  <div className="mt-0.5 text-sm font-black text-slate-900">
                    {currentExerciseIndex + 1} من {exercises.length}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={currentExerciseIndex >= exercises.length - 1}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  التمرين التالي
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              {/* PAPER */}
              <main className="science-bac-print mt-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
                <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-7 sm:py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <StatPill icon={CalendarDays}>
                          {currentExercise?.year
                            ? `بكالوريا ${currentExercise.year}`
                            : "بكالوريا"}
                        </StatPill>

                        <StatPill icon={FileText}>
                          {currentExercise?.subject_number
                            ? `الموضوع ${currentExercise.subject_number}`
                            : ""}
                        </StatPill>

                        <StatPill icon={GraduationCap}>
                          {branchLabel}
                        </StatPill>

                        <StatPill icon={Award}>
                          {currentExercise?.points
                            ? `${currentExercise.points} نقاط`
                            : ""}
                        </StatPill>
                      </div>

                      <div className="text-xs font-black text-emerald-700">
                        {chapterTitle}
                        {sessionLabel ? ` • ${sessionLabel}` : ""}
                      </div>

                      <h2 className="mt-1 text-xl font-black leading-9 text-slate-950 sm:text-2xl">
                        {exerciseTitle}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="science-bac-screen-only inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      <Printer className="h-4 w-4" />
                      طباعة
                    </button>
                  </div>
                </div>

                {/* PANEL SWITCH */}
                <div className="science-bac-screen-only border-b border-slate-200 bg-white px-3 py-3 sm:px-6">
                  <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setActivePanel("exercise")}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition",
                        activePanel === "exercise"
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <Microscope className="h-4 w-4" />
                      نص التمرين والوثائق
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePanel("solution")}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition",
                        activePanel === "solution"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      {activePanel === "solution" ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      الحل النموذجي
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-7 lg:p-9">
                  {activePanel === "exercise" ? (
                    <div className="space-y-7">
                      <section>
                        <div className="mb-4 flex items-center gap-2">
                          <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                            <BookOpen className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-950">
                              نص التمرين
                            </h3>
                            <p className="text-xs font-semibold text-slate-400">
                              اقرأ المعطيات والأسئلة كما وردت في اختبار البكالوريا.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-5 sm:px-6 sm:py-7">
                          <p className="whitespace-pre-wrap text-[15px] font-semibold leading-[2.15] text-slate-800 sm:text-base">
                            {currentExercise?.statement ||
                              "لا يوجد نص محفوظ لهذا التمرين."}
                          </p>
                        </div>
                      </section>

                      {statementFigures.length > 0 && (
                        <section>
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                              <div>
                                <h3 className="text-base font-black text-slate-950">
                                  الوثائق المرفقة
                                </h3>
                                <p className="text-xs font-semibold text-slate-400">
                                  {statementFigures.length} وثيقة داخل التمرين
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-5 xl:grid-cols-2">
                            {statementFigures.map((figure, index) => (
                              <ScienceDocument
                                key={figure?.id || `statement-document-${index}`}
                                figure={figure}
                                index={index}
                                onOpen={setOpenedDocument}
                              />
                            ))}
                          </div>
                        </section>
                      )}

                      <section className="science-bac-screen-only rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-sm font-black text-emerald-900">
                              <ListChecks className="h-4 w-4" />
                              أنهيت محاولة التمرين؟
                            </div>
                            <p className="mt-1 text-xs font-semibold leading-6 text-emerald-800/80">
                              حاول الإجابة أولًا، ثم افتح التصحيح النموذجي للمقارنة.
                              {questionsCount > 0
                                ? ` يحتوي التصحيح على ${questionsCount} مطالب.`
                                : ""}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setActivePanel("solution");
                              window.scrollTo({
                                top: 0,
                                behavior: "smooth",
                              });
                            }}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            عرض الحل النموذجي
                          </button>
                        </div>
                      </section>
                    </div>
                  ) : (
                    <ModelSolution
                      exercise={currentExercise}
                      onOpenDocument={setOpenedDocument}
                      onQuestionFocus={onTutorQuestionChange}
                    />
                  )}
                </div>
              </main>
            </>
          )}
        </div>
      </section>

      <DocumentViewer
        figure={openedDocument}
        onClose={() => setOpenedDocument(null)}
      />
    </>
  );
}
