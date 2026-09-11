import {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  RefreshCcw,
  School,
  Sparkles,
  Target,
} from "lucide-react";

import { UserContext } from "../../Utils/UserContext";


// =====================================================
// API
// =====================================================

const RAW_API_BASE_URL =
  import.meta.env.VITE_BASE_URL || "";

const API_BASE_URL =
  RAW_API_BASE_URL.replace(/\/+$/, "");

const PUBLIC_BASE_URL =
  import.meta.env.BASE_URL || "/";

const RAW_DOCUMENT_BASE_URL =
  import.meta.env.VITE_BAC_DOCUMENT_BASE_URL ||
  (
    API_BASE_URL
      ? `${API_BASE_URL}/media/`
      : PUBLIC_BASE_URL
  );


// =====================================================
// Helpers
// =====================================================

function cn(...classes) {
  return classes
    .filter(Boolean)
    .join(" ");
}


function asArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}


function asObject(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    ? value
    : {};
}


function hasText(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}


function parseMaybeJson(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value === "object"
  ) {
    return value;
  }

  if (
    typeof value !== "string"
  ) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}


function normalizeArabicText(value = "") {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


function normalizeCourseName(value = "") {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي");
}


function isHistoryCourse(courseName = "") {
  const name =
    normalizeCourseName(courseName);

  return (
    name === "التاريخ" ||
    name === "تاريخ" ||
    name.includes("التاريخ")
  );
}


function getSubjectDisplayName(courseName) {
  if (
    isHistoryCourse(courseName)
  ) {
    return "التاريخ";
  }

  return "العلوم الإسلامية";
}


function getErrorMessage(error) {
  if (
    error?.code === "ERR_NETWORK"
  ) {
    return (
      "تعذر الاتصال بالخادم. "
      + "تأكد من تشغيل Django ومن قيمة VITE_BASE_URL."
    );
  }

  if (
    error?.response?.status === 401
  ) {
    return (
      "انتهت صلاحية تسجيل الدخول. "
      + "سجّل الدخول من جديد."
    );
  }

  if (
    error?.response?.status === 403
  ) {
    return (
      "ليس لديك صلاحية لعرض هذه البيانات."
    );
  }

  if (
    error?.response?.status === 404
  ) {
    return (
      "لم يتم العثور على تمارين بكالوريا لهذا الدرس."
    );
  }

  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    "حدث خطأ أثناء تحميل تمارين البكالوريا."
  );
}


function resolveAssetPath(value) {
  const raw =
    String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  if (
    /^(?:https?:)?\/\//i.test(raw) ||
    /^(?:data|blob):/i.test(raw)
  ) {
    return raw;
  }

  const normalized =
    raw.replace(/\\+/g, "/");

  if (
    normalized.startsWith("/")
  ) {
    return normalized;
  }

  if (
    /^bac\//i.test(normalized)
  ) {
    const base =
      RAW_DOCUMENT_BASE_URL.endsWith("/")
        ? RAW_DOCUMENT_BASE_URL
        : `${RAW_DOCUMENT_BASE_URL}/`;

    return (
      `${base}${normalized.replace(/^\/+/, "")}`
    );
  }

  const publicBase =
    PUBLIC_BASE_URL.endsWith("/")
      ? PUBLIC_BASE_URL
      : `${PUBLIC_BASE_URL}/`;

  return (
    `${publicBase}${normalized.replace(/^\/+/, "")}`
  );
}


// =====================================================
// Branches
// =====================================================

function normalizeBranches(value) {
  return asArray(value)
    .map((branch) => {
      if (
        typeof branch === "string"
      ) {
        const code =
          branch.trim().toLowerCase();

        return {
          code,
          name: branch.trim(),
        };
      }

      const item =
        asObject(branch);

      const code =
        String(
          item.code ??
          item.slug ??
          ""
        )
          .trim()
          .toLowerCase();

      if (!code) {
        return null;
      }

      return {
        id:
          item.id ?? null,

        code,

        name:
          String(
            item.name ??
            item.title ??
            item.code ??
            ""
          ).trim(),
      };
    })
    .filter(Boolean);
}


function getExerciseBranches(exercise) {
  const direct =
    normalizeBranches(
      exercise?.branches
    );

  if (
    direct.length > 0
  ) {
    return direct;
  }

  const codes =
    asArray(
      exercise?.branch_codes
    );

  return codes
    .map((code) => ({
      code:
        String(code ?? "")
          .trim()
          .toLowerCase(),

      name:
        String(code ?? "")
          .trim(),
    }))
    .filter(
      (branch) =>
        branch.code
    );
}


function exerciseBelongsToBranch(
  exercise,
  branchCode
) {
  if (
    !branchCode ||
    branchCode === "all"
  ) {
    return true;
  }

  const branches =
    getExerciseBranches(exercise);

  // في بعض ملفات العلوم الإسلامية القديمة
  // لا توجد branches إطلاقا.
  // لا نخفي التمرين في هذه الحالة.
  if (
    branches.length === 0
  ) {
    return true;
  }

  return branches.some(
    (branch) =>
      branch.code === branchCode
  );
}


// =====================================================
// Steps / solutions
// =====================================================

function normalizeSteps(value) {
  const parsed =
    parseMaybeJson(value);

  if (
    Array.isArray(parsed)
  ) {
    return parsed
      .map((step, index) => {
        if (
          typeof step === "string"
        ) {
          return {
            step_number:
              index + 1,

            title:
              `الخطوة ${index + 1}`,

            explanation:
              step,
          };
        }

        const item =
          asObject(step);

        return {
          ...item,

          step_number:
            item.step_number ??
            item.number ??
            index + 1,

          title:
            item.title ||
            item.label ||
            `الخطوة ${index + 1}`,

          explanation:
            item.explanation ||
            item.text ||
            item.content ||
            item.result ||
            "",
        };
      })
      .filter(
        (step) =>
          hasText(step.explanation) ||
          hasText(step.title)
      );
  }

  if (
    parsed &&
    typeof parsed === "object"
  ) {
    return Object.entries(parsed)
      .sort(
        ([keyA], [keyB]) => {
          const numberA =
            Number(
              String(keyA)
                .match(/\d+/)?.[0] ?? 0
            );

          const numberB =
            Number(
              String(keyB)
                .match(/\d+/)?.[0] ?? 0
            );

          return numberA - numberB;
        }
      )
      .map(
        ([key, step], index) => {
          if (
            typeof step === "string"
          ) {
            return {
              step_number:
                index + 1,

              title:
                key.replaceAll(
                  "_",
                  " "
                ),

              explanation:
                step,
            };
          }

          const item =
            asObject(step);

          return {
            ...item,

            step_number:
              item.step_number ??
              index + 1,

            title:
              item.title ||
              key.replaceAll(
                "_",
                " "
              ),

            explanation:
              item.explanation ||
              item.text ||
              item.content ||
              item.result ||
              "",
          };
        }
      );
  }

  return [];
}


function normalizeSolution(value) {
  const parsed =
    parseMaybeJson(value);

  if (
    typeof parsed === "string"
  ) {
    return {
      strategy: "",
      steps: [],
      detailed_explanation:
        parsed,
      final_answer:
        parsed,
    };
  }

  const item =
    asObject(parsed);

  return {
    ...item,

    strategy:
      normalizeArabicText(
        item.strategy ||
        item.solution_strategy ||
        item.main_idea ||
        ""
      ),

    detailed_explanation:
      normalizeArabicText(
        item.detailed_explanation ||
        item.explanation ||
        item.solution_explanation ||
        ""
      ),

    steps:
      normalizeSteps(
        item.steps ||
        item.solution_steps
      ),

    final_answer:
      normalizeArabicText(
        item.final_answer ||
        item.answer ||
        item.result ||
        ""
      ),
  };
}


function normalizeQuestion(
  question,
  index,
  inheritedAxisTags = []
) {
  const parsed =
    parseMaybeJson(question);

  const item =
    typeof parsed === "object"
      ? asObject(parsed)
      : {
          text:
            String(parsed ?? ""),
        };

  return {
    ...item,

    id:
      item.id ??
      item.question_id ??
      `question-${index + 1}`,

    display_order:
      item.display_order ??
      item.number ??
      index + 1,

    number:
      item.number ??
      item.display_order ??
      index + 1,

    text:
      normalizeArabicText(
        item.text ||
        item.standalone_text ||
        item.question ||
        ""
      ),

    points:
      item.points ??
      item.mark ??
      item.score ??
      null,

    axis_tags:
      asArray(
        item.axis_tags
      ).length > 0
        ? item.axis_tags
        : inheritedAxisTags,

    solution:
      normalizeSolution(
        item.solution ||
        item.answer ||
        item.correction
      ),
  };
}


// =====================================================
// Media
// =====================================================

function normalizeMediaItem(
  media,
  index
) {
  if (
    typeof media === "string"
  ) {
    return {
      id:
        `media-${index + 1}`,

      path:
        media,

      title:
        `الوثيقة ${index + 1}`,
    };
  }

  const item =
    asObject(media);

  const path =
    String(
      item.path ||
      item.src ||
      item.url ||
      item.image_path ||
      ""
    ).trim();

  if (!path) {
    return null;
  }

  return {
    ...item,

    id:
      item.id ||
      `media-${index + 1}`,

    path,

    title:
      item.title ||
      item.label ||
      item.caption ||
      `الوثيقة ${index + 1}`,
  };
}


function getExerciseMedia(exercise) {
  const candidates = [
    ...asArray(
      exercise?.statement_graphs
    ),

    ...asArray(
      exercise?.document_references
    ),

    ...asArray(
      exercise?.figures
    ),

    ...asArray(
      exercise?.images
    ),
  ];

  const seen =
    new Set();

  return candidates
    .map(normalizeMediaItem)
    .filter(Boolean)
    .filter((item) => {
      if (
        seen.has(item.path)
      ) {
        return false;
      }

      seen.add(item.path);
      return true;
    });
}


// =====================================================
// Tables
// =====================================================

function normalizeTable(value) {
  const table =
    parseMaybeJson(value);

  if (
    Array.isArray(table)
  ) {
    if (
      table.every(
        (row) =>
          Array.isArray(row)
      )
    ) {
      return {
        headers:
          table[0] || [],

        rows:
          table.slice(1),
      };
    }

    return null;
  }

  const item =
    asObject(table);

  const headers =
    asArray(
      item.headers ||
      item.columns
    );

  const rows =
    asArray(
      item.rows ||
      item.data
    );

  if (
    headers.length === 0 &&
    rows.length === 0
  ) {
    return null;
  }

  return {
    title:
      item.title || "",

    headers,

    rows:
      rows.map((row) => {
        if (
          Array.isArray(row)
        ) {
          return row;
        }

        const rowObject =
          asObject(row);

        if (
          headers.length > 0
        ) {
          return headers.map(
            (header) =>
              rowObject[header] ?? ""
          );
        }

        return Object.values(
          rowObject
        );
      }),
  };
}


function getExerciseTables(exercise) {
  const candidates = [
    ...asArray(
      exercise?.tables
    ),

    ...asArray(
      exercise?.statement_tables
    ),

    exercise?.table_data,
  ].filter(Boolean);

  return candidates
    .map(normalizeTable)
    .filter(Boolean);
}


// =====================================================
// Exercise normalisation
// =====================================================

function normalizeExercise(
  exercise,
  index
) {
  let parsed =
    parseMaybeJson(exercise);

  if (
    !parsed ||
    typeof parsed !== "object"
  ) {
    parsed = {};
  }

  let item =
    asObject(parsed);

  // بعض الـserializers يحتفظون بملف JSON
  // داخل content أو data.
  const nestedContent =
    parseMaybeJson(
      item.content
    );

  const nestedData =
    parseMaybeJson(
      item.data
    );

  if (
    nestedContent &&
    typeof nestedContent === "object" &&
    Array.isArray(
      nestedContent.questions
    )
  ) {
    item = {
      ...item,
      ...nestedContent,

      id:
        item.id ??
        nestedContent.id,

      code:
        item.code ??
        nestedContent.code,
    };
  } else if (
    nestedData &&
    typeof nestedData === "object" &&
    Array.isArray(
      nestedData.questions
    )
  ) {
    item = {
      ...item,
      ...nestedData,

      id:
        item.id ??
        nestedData.id,

      code:
        item.code ??
        nestedData.code,
    };
  }

  const axisTags =
    asArray(
      item.axis_tags
    );

  const questions =
    asArray(
      item.questions
    ).map(
      (question, questionIndex) =>
        normalizeQuestion(
          question,
          questionIndex,
          axisTags
        )
    );

  return {
    ...item,

    id:
      item.id ??
      item.code ??
      `${item.chapter_code || "bac"}-${item.year || "year"}-${item.exercise_number || index + 1}`,

    code:
      item.code ||
      `${item.chapter_code || "bac"}-${item.year || "year"}-${item.exercise_number || index + 1}`,

    title:
      normalizeArabicText(
        item.title ||
        (
          item.year
            ? `بكالوريا ${item.year}`
            : `تمرين البكالوريا ${index + 1}`
        )
      ),

    chapter_title:
      normalizeArabicText(
        item.chapter_title ||
        item.chapter?.title ||
        ""
      ),

    statement:
      normalizeArabicText(
        item.statement ||
        item.text ||
        ""
      ),

    year:
      item.year ?? null,

    session:
      item.session || "ordinary",

    exercise_number:
      item.exercise_number ??
      index + 1,

    source_pages:
      asArray(
        item.source_pages
      ),

    solution_source_pages:
      asArray(
        item.solution_source_pages
      ),

    branches:
      normalizeBranches(
        item.branches
      ),

    branch_codes:
      asArray(
        item.branch_codes
      ),

    questions,

    media:
      getExerciseMedia(
        item
      ),

    tables:
      getExerciseTables(
        item
      ),

    is_active:
      item.is_active !== false,
  };
}


function dedupeExercises(
  exercises
) {
  const seen =
    new Set();

  return exercises.filter(
    (exercise) => {
      const key = [
        exercise?.id,
        exercise?.code,
        exercise?.year,
        exercise?.exercise_number,
        exercise?.title,
      ]
        .filter(
          (value) =>
            value !== null &&
            value !== undefined &&
            value !== ""
        )
        .join("|");

      const fallbackKey =
        `${exercise?.year || ""}|${exercise?.title || ""}|${exercise?.statement || ""}`;

      const finalKey =
        key || fallbackKey;

      if (
        seen.has(finalKey)
      ) {
        return false;
      }

      seen.add(finalKey);
      return true;
    }
  );
}


function normalizePayload(payload) {
  const parsed =
    parseMaybeJson(payload);

  if (
    Array.isArray(parsed)
  ) {
    return {
      chapter: {},
      exercises:
        dedupeExercises(
          parsed.map(
            normalizeExercise
          )
        ),
    };
  }

  const source =
    asObject(parsed);

  // DRF pagination.
  if (
    Array.isArray(
      source.results
    )
  ) {
    return {
      ...source,

      chapter:
        source.chapter || {},

      exercises:
        dedupeExercises(
          source.results.map(
            normalizeExercise
          )
        ),
    };
  }

  // Format principal.
  if (
    Array.isArray(
      source.exercises
    )
  ) {
    return {
      ...source,

      chapter:
        source.chapter || {},

      exercises:
        dedupeExercises(
          source.exercises.map(
            normalizeExercise
          )
        ),
    };
  }

  // API parfois enveloppée dans data.
  if (
    source.data &&
    Array.isArray(
      source.data.exercises
    )
  ) {
    return {
      ...source,

      chapter:
        source.chapter ||
        source.data.chapter ||
        {},

      exercises:
        dedupeExercises(
          source.data.exercises.map(
            normalizeExercise
          )
        ),
    };
  }

  // Un fichier JSON BAC unique.
  if (
    Array.isArray(
      source.questions
    )
  ) {
    return {
      chapter: {
        code:
          source.chapter_code || "",

        title:
          source.chapter_title || "",
      },

      exercises: [
        normalizeExercise(
          source,
          0
        ),
      ],
    };
  }

  return {
    chapter:
      source.chapter || {},

    exercises: [],
  };
}


// =====================================================
// Presentational helpers
// =====================================================

function getSessionLabel(
  session
) {
  const value =
    String(session ?? "")
      .trim()
      .toLowerCase();

  if (
    value === "exceptional" ||
    value === "special"
  ) {
    return "الدورة الاستثنائية";
  }

  return "الدورة العادية";
}


function getExerciseKey(
  exercise,
  index
) {
  return String(
    exercise?.id ??
    exercise?.code ??
    `${exercise?.year || "year"}-${index}`
  );
}


function getQuestionKey(
  exercise,
  question,
  index
) {
  return (
    `${getExerciseKey(exercise, 0)}::`
    + String(
      question?.id ??
      question?.number ??
      index
    )
  );
}


// =====================================================
// UI small components
// =====================================================

function LoadingState() {
  return (
    <div
      dir="rtl"
      className="
        flex
        min-h-[420px]
        flex-col
        items-center
        justify-center
        gap-4
        p-8
        text-center
      "
    >
      <Loader2
        className="
          h-11
          w-11
          animate-spin
          text-emerald-600
        "
      />

      <p
        className="
          font-bold
          text-slate-600
        "
      >
        جاري تحميل تمارين البكالوريا...
      </p>
    </div>
  );
}


function ErrorState({
  message,
  onRetry,
}) {
  return (
    <div
      dir="rtl"
      className="
        flex
        min-h-[420px]
        items-center
        justify-center
        p-6
      "
    >
      <div
        className="
          w-full
          max-w-xl
          rounded-3xl
          border
          border-red-200
          bg-red-50
          p-7
          text-center
        "
      >
        <AlertCircle
          className="
            mx-auto
            h-11
            w-11
            text-red-600
          "
        />

        <h3
          className="
            mt-3
            text-xl
            font-black
            text-red-900
          "
        >
          تعذر تحميل البكالوريا
        </h3>

        <p
          className="
            mt-2
            font-medium
            leading-7
            text-red-700
          "
        >
          {message}
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="
            mt-5
            inline-flex
            items-center
            gap-2
            rounded-xl
            bg-red-600
            px-5
            py-2.5
            font-bold
            text-white
            transition
            hover:bg-red-700
          "
        >
          <RefreshCcw
            className="h-4 w-4"
          />

          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}


function EmptyState({
  courseName,
}) {
  return (
    <div
      dir="rtl"
      className="
        flex
        min-h-[420px]
        items-center
        justify-center
        p-6
      "
    >
      <div
        className="
          w-full
          max-w-xl
          rounded-3xl
          border
          border-slate-200
          bg-slate-50
          p-8
          text-center
        "
      >
        <BookOpen
          className="
            mx-auto
            h-12
            w-12
            text-slate-400
          "
        />

        <h3
          className="
            mt-4
            text-xl
            font-black
            text-slate-800
          "
        >
          لا توجد تمارين بكالوريا
        </h3>

        <p
          className="
            mt-2
            leading-7
            text-slate-500
          "
        >
          لم يتم العثور على تمارين
          {" "}
          {getSubjectDisplayName(courseName)}
          {" "}
          مرتبطة بهذا الدرس حاليًا.
        </p>
      </div>
    </div>
  );
}


function GenericTable({
  table,
}) {
  if (
    !table ||
    (
      asArray(table.headers).length === 0 &&
      asArray(table.rows).length === 0
    )
  ) {
    return null;
  }

  return (
    <div
      className="
        my-5
        overflow-x-auto
        rounded-2xl
        border
        border-slate-200
      "
    >
      {hasText(table.title) && (
        <div
          className="
            border-b
            border-slate-200
            bg-slate-50
            px-4
            py-3
            font-black
            text-slate-800
          "
        >
          {table.title}
        </div>
      )}

      <table
        className="
          w-full
          min-w-[560px]
          border-collapse
          text-right
        "
      >
        {asArray(table.headers).length > 0 && (
          <thead>
            <tr
              className="
                bg-slate-100
              "
            >
              {table.headers.map(
                (header, index) => (
                  <th
                    key={index}
                    className="
                      border-b
                      border-slate-200
                      px-4
                      py-3
                      text-sm
                      font-black
                      text-slate-700
                    "
                  >
                    {String(
                      header ?? ""
                    )}
                  </th>
                )
              )}
            </tr>
          </thead>
        )}

        <tbody>
          {asArray(table.rows).map(
            (row, rowIndex) => (
              <tr
                key={rowIndex}
                className="
                  border-b
                  border-slate-100
                  last:border-b-0
                "
              >
                {asArray(row).map(
                  (cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="
                        px-4
                        py-3
                        align-top
                        text-sm
                        leading-7
                        text-slate-700
                      "
                    >
                      {String(
                        cell ?? ""
                      )}
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}


// =====================================================
// Main component
// =====================================================

export default function BacIslamic({
  chapterId,
  endpoint = "",
  courseName = "العلوم الإسلامية",
  onTutorExerciseChange,
  onTutorQuestionChange,
  onTutorStepChange,
  onTutorViewStateChange,
}) {
  const {
    token,
    user,
  } = useContext(
    UserContext
  );

  const [
    data,
    setData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    selectedYear,
    setSelectedYear,
  ] = useState("all");

  const [
    selectedBranch,
    setSelectedBranch,
  ] = useState(
    user?.branch?.code ||
    "all"
  );

  const [
    currentExerciseIndex,
    setCurrentExerciseIndex,
  ] = useState(0);

  const [
    openSolutions,
    setOpenSolutions,
  ] = useState({});


  // ===================================================
  // Fetch
  // ===================================================

  async function fetchExercises() {
    if (
      !chapterId &&
      !endpoint
    ) {
      setLoading(false);

      setError(
        "رقم الدرس غير موجود."
      );

      return;
    }

    try {
      setLoading(true);
      setError("");

      const requestUrl =
        endpoint ||
        `${API_BASE_URL}/api/bac/exercises/chapter/${chapterId}/`;

      const response =
        await axios.get(
          requestUrl,
          {
            headers:
              token
                ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                : {},
          }
        );

      const normalized =
        normalizePayload(
          response.data
        );

      setData(
        normalized
      );

      setCurrentExerciseIndex(
        0
      );

      setSelectedYear(
        "all"
      );

      setOpenSolutions(
        {}
      );
    } catch (requestError) {
      console.error(
        "BacIslamic error:",
        requestError
      );

      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    fetchExercises();
  }, [
    chapterId,
    endpoint,
    token,
  ]);


  // ===================================================
  // Data
  // ===================================================

  const allExercises =
    useMemo(
      () =>
        asArray(
          data?.exercises
        ).filter(
          (exercise) =>
            exercise?.is_active !== false
        ),
      [data]
    );


  const branches =
    useMemo(() => {
      const map =
        new Map();

      allExercises.forEach(
        (exercise) => {
          getExerciseBranches(
            exercise
          ).forEach(
            (branch) => {
              if (
                !map.has(
                  branch.code
                )
              ) {
                map.set(
                  branch.code,
                  branch
                );
              }
            }
          );
        }
      );

      return [
        ...map.values(),
      ];
    }, [allExercises]);


  useEffect(() => {
    const userBranch =
      String(
        user?.branch?.code ??
        ""
      )
        .trim()
        .toLowerCase();

    if (
      userBranch &&
      branches.some(
        (branch) =>
          branch.code ===
          userBranch
      )
    ) {
      setSelectedBranch(
        userBranch
      );
    } else {
      setSelectedBranch(
        "all"
      );
    }
  }, [
    user?.branch?.code,
    branches.length,
  ]);


  const branchFilteredExercises =
    useMemo(
      () =>
        allExercises.filter(
          (exercise) =>
            exerciseBelongsToBranch(
              exercise,
              selectedBranch
            )
        ),
      [
        allExercises,
        selectedBranch,
      ]
    );


  const years =
    useMemo(
      () => [
        ...new Set(
          branchFilteredExercises
            .map(
              (exercise) =>
                Number(
                  exercise?.year
                )
            )
            .filter(
              (year) =>
                Number.isFinite(
                  year
                ) &&
                year > 0
            )
        ),
      ].sort(
        (a, b) =>
          b - a
      ),
      [branchFilteredExercises]
    );


  const exercises =
    useMemo(
      () => {
        if (
          selectedYear === "all"
        ) {
          return branchFilteredExercises;
        }

        return branchFilteredExercises
          .filter(
            (exercise) =>
              String(
                exercise?.year
              ) ===
              String(
                selectedYear
              )
          );
      },
      [
        branchFilteredExercises,
        selectedYear,
      ]
    );


  useEffect(() => {
    if (
      selectedYear !== "all" &&
      !years.some(
        (year) =>
          String(year) ===
          String(selectedYear)
      )
    ) {
      setSelectedYear(
        "all"
      );
    }
  }, [
    selectedBranch,
    selectedYear,
    years,
  ]);


  useEffect(() => {
    setCurrentExerciseIndex(
      0
    );

    setOpenSolutions(
      {}
    );
  }, [
    selectedBranch,
    selectedYear,
  ]);


  const currentExercise =
    exercises[
      currentExerciseIndex
    ] || null;


  const questions =
    asArray(
      currentExercise?.questions
    );


  // ===================================================
  // Tutor context
  // ===================================================

  useEffect(() => {
    if (
      !currentExercise
    ) {
      onTutorExerciseChange?.(
        null
      );

      onTutorQuestionChange?.(
        null
      );

      onTutorStepChange?.(
        null
      );

      return;
    }

    onTutorExerciseChange?.({
      id:
        currentExercise.id,

      code:
        currentExercise.code,

      title:
        currentExercise.title,

      statement:
        currentExercise.statement,

      year:
        currentExercise.year,

      chapter_title:
        currentExercise.chapter_title,
    });

    onTutorQuestionChange?.(
      null
    );

    onTutorStepChange?.(
      null
    );

    onTutorViewStateChange?.({
      section:
        "bac",

      renderer:
        "BacIslamic",

      subject:
        getSubjectDisplayName(
          courseName
        ),

      exercise_id:
        currentExercise.id,

      year:
        currentExercise.year,

      exercise_index:
        currentExerciseIndex,

      total_exercises:
        exercises.length,
    });
  }, [
    currentExercise?.id,
    currentExerciseIndex,
    exercises.length,
    courseName,
    onTutorExerciseChange,
    onTutorQuestionChange,
    onTutorStepChange,
    onTutorViewStateChange,
  ]);


  // ===================================================
  // Navigation
  // ===================================================

  function goPrevious() {
    setCurrentExerciseIndex(
      (previous) =>
        Math.max(
          0,
          previous - 1
        )
    );

    setOpenSolutions(
      {}
    );
  }


  function goNext() {
    setCurrentExerciseIndex(
      (previous) =>
        Math.min(
          exercises.length - 1,
          previous + 1
        )
    );

    setOpenSolutions(
      {}
    );
  }


  function toggleQuestionSolution(
    question,
    questionIndex
  ) {
    const key =
      getQuestionKey(
        currentExercise,
        question,
        questionIndex
      );

    const nextVisible =
      !openSolutions[key];

    setOpenSolutions(
      (previous) => ({
        ...previous,
        [key]:
          !previous[key],
      })
    );

    onTutorQuestionChange?.({
      ...question,

      exercise_id:
        currentExercise?.id,

      exercise_title:
        currentExercise?.title,
    });

    onTutorStepChange?.(
      null
    );

    onTutorViewStateChange?.({
      section:
        "bac",

      renderer:
        "BacIslamic",

      subject:
        getSubjectDisplayName(
          courseName
        ),

      exercise_id:
        currentExercise?.id,

      question_id:
        question?.id,

      solution_visible:
        nextVisible,
    });
  }


  // ===================================================
  // States
  // ===================================================

  if (loading) {
    return (
      <LoadingState />
    );
  }


  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={
          fetchExercises
        }
      />
    );
  }


  if (
    allExercises.length === 0
  ) {
    return (
      <EmptyState
        courseName={
          courseName
        }
      />
    );
  }


  if (
    exercises.length === 0
  ) {
    return (
      <div
        dir="rtl"
        className="p-6"
      >
        <div
          className="
            rounded-3xl
            border
            border-amber-200
            bg-amber-50
            p-7
            text-center
          "
        >
          <AlertCircle
            className="
              mx-auto
              h-10
              w-10
              text-amber-600
            "
          />

          <h3
            className="
              mt-3
              text-xl
              font-black
              text-amber-900
            "
          >
            لا توجد نتائج لهذه التصفية
          </h3>

          <button
            type="button"
            onClick={() => {
              setSelectedBranch(
                "all"
              );

              setSelectedYear(
                "all"
              );
            }}
            className="
              mt-4
              rounded-xl
              bg-amber-600
              px-4
              py-2
              font-bold
              text-white
            "
          >
            إظهار كل البكالوريات
          </button>
        </div>
      </div>
    );
  }


  // ===================================================
  // Render
  // ===================================================

  const subjectName =
    getSubjectDisplayName(
      courseName
    );

  const chapterTitle =
    normalizeArabicText(
      data?.chapter?.title ||
      currentExercise?.chapter_title ||
      "تمارين البكالوريا"
    );

  return (
    <div
      dir="rtl"
      className="
        min-h-[560px]
        bg-slate-50
      "
    >
      {/* =============================================== */}
      {/* Header */}
      {/* =============================================== */}

      <div
        className="
          border-b
          border-slate-200
          bg-white
          px-4
          py-5
          sm:px-6
        "
      >
        <div
          className="
            mx-auto
            flex
            w-full
            max-w-6xl
            flex-col
            gap-4
          "
        >
          <div
            className="
              flex
              flex-col
              justify-between
              gap-4
              lg:flex-row
              lg:items-center
            "
          >
            <div>
              <div
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  bg-emerald-50
                  px-3
                  py-1.5
                  text-sm
                  font-black
                  text-emerald-700
                "
              >
                <GraduationCap
                  className="
                    h-4
                    w-4
                  "
                />

                بكالوريا
                {" "}
                {subjectName}
              </div>

              <h2
                className="
                  mt-3
                  text-2xl
                  font-black
                  leading-9
                  text-slate-950
                  sm:text-3xl
                "
              >
                {chapterTitle}
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  font-medium
                  text-slate-500
                "
              >
                تمارين رسمية مرتبة حسب السنة مع الحل النموذجي خطوة بخطوة.
              </p>
            </div>

            <div
              className="
                flex
                flex-wrap
                items-center
                gap-2
              "
            >
              <div
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-slate-200
                  bg-slate-50
                  px-3
                  py-2
                  text-sm
                  font-bold
                  text-slate-700
                "
              >
                <BookOpen
                  className="
                    h-4
                    w-4
                  "
                />

                {exercises.length}
                {" "}
                تمرين
              </div>

              {years.length > 0 && (
                <div
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50
                    px-3
                    py-2
                    text-sm
                    font-bold
                    text-slate-700
                  "
                >
                  <CalendarDays
                    className="
                      h-4
                      w-4
                    "
                  />

                  {years.length}
                  {" "}
                  سنة
                </div>
              )}
            </div>
          </div>

          {/* Filters */}

          <div
            className="
              flex
              flex-col
              gap-3
              rounded-2xl
              border
              border-slate-200
              bg-slate-50
              p-3
              sm:flex-row
            "
          >
            <label
              className="
                flex
                flex-1
                items-center
                gap-2
              "
            >
              <CalendarDays
                className="
                  h-5
                  w-5
                  shrink-0
                  text-slate-500
                "
              />

              <select
                value={
                  selectedYear
                }
                onChange={
                  (event) =>
                    setSelectedYear(
                      event.target.value
                    )
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-3
                  py-2.5
                  font-bold
                  text-slate-700
                  outline-none
                  focus:border-emerald-400
                "
              >
                <option
                  value="all"
                >
                  جميع السنوات
                </option>

                {years.map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      بكالوريا
                      {" "}
                      {year}
                    </option>
                  )
                )}
              </select>
            </label>

            {/* {branches.length > 1 && (
              <label
                className="
                  flex
                  flex-1
                  items-center
                  gap-2
                "
              >
                <School
                  className="
                    h-5
                    w-5
                    shrink-0
                    text-slate-500
                  "
                />

                <select
                  value={
                    selectedBranch
                  }
                  onChange={
                    (event) =>
                      setSelectedBranch(
                        event.target.value
                      )
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    px-3
                    py-2.5
                    font-bold
                    text-slate-700
                    outline-none
                    focus:border-emerald-400
                  "
                >
                  <option
                    value="all"
                  >
                    جميع الشعب
                  </option>

                  {branches.map(
                    (branch) => (
                      <option
                        key={
                          branch.code
                        }
                        value={
                          branch.code
                        }
                      >
                        {branch.name}
                      </option>
                    )
                  )}
                </select>
              </label>
            )} */}

            <button
              type="button"
              onClick={
                fetchExercises
              }
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
                py-2.5
                font-bold
                text-slate-700
                transition
                hover:border-emerald-300
                hover:text-emerald-700
              "
            >
              <RefreshCcw
                className="
                  h-4
                  w-4
                "
              />

              تحديث
            </button>
          </div>
        </div>
      </div>


      {/* =============================================== */}
      {/* Exercise */}
      {/* =============================================== */}

      <div
        className="
          mx-auto
          w-full
          max-w-6xl
          p-4
          sm:p-6
        "
      >
        <article
          className="
            overflow-hidden
            rounded-3xl
            border
            border-slate-200
            bg-white
            shadow-sm
          "
        >
          {/* Exercise header */}

          <div
            className="
              border-b
              border-slate-200
              bg-gradient-to-l
              from-emerald-50
              to-white
              px-5
              py-5
              sm:px-7
            "
          >
            <div
              className="
                flex
                flex-col
                justify-between
                gap-4
                md:flex-row
                md:items-start
              "
            >
              <div>
                <div
                  className="
                    flex
                    flex-wrap
                    items-center
                    gap-2
                  "
                >
                  {currentExercise?.year && (
                    <span
                      className="
                        rounded-full
                        bg-emerald-600
                        px-3
                        py-1
                        text-sm
                        font-black
                        text-white
                      "
                    >
                      بكالوريا
                      {" "}
                      {currentExercise.year}
                    </span>
                  )}

                  <span
                    className="
                      rounded-full
                      border
                      border-emerald-200
                      bg-white
                      px-3
                      py-1
                      text-xs
                      font-bold
                      text-emerald-700
                    "
                  >
                    {getSessionLabel(
                      currentExercise?.session
                    )}
                  </span>

                  {currentExercise?.source_pages?.length > 0 && (
                    <span
                      className="
                        rounded-full
                        border
                        border-slate-200
                        bg-white
                        px-3
                        py-1
                        text-xs
                        font-bold
                        text-slate-600
                      "
                    >
                      صفحة المصدر:
                      {" "}
                      {currentExercise.source_pages.join(
                        "، "
                      )}
                    </span>
                  )}
                </div>

                <h3
                  className="
                    mt-3
                    text-xl
                    font-black
                    leading-8
                    text-slate-950
                  "
                >
                  {currentExercise?.title ||
                    `تمرين ${currentExerciseIndex + 1}`}
                </h3>
              </div>

              <div
                className="
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-3
                  text-center
                "
              >
                <div
                  className="
                    text-xs
                    font-bold
                    text-slate-400
                  "
                >
                  التمرين
                </div>

                <div
                  className="
                    mt-1
                    text-lg
                    font-black
                    text-slate-800
                  "
                >
                  {currentExerciseIndex + 1}
                  {" / "}
                  {exercises.length}
                </div>
              </div>
            </div>
          </div>


          {/* Statement */}

          {hasText(
            currentExercise?.statement
          ) && (
            <section
              className="
                border-b
                border-slate-100
                px-5
                py-6
                sm:px-7
              "
            >
              <div
                className="
                  mb-4
                  flex
                  items-center
                  gap-2
                "
              >
                <FileText
                  className="
                    h-5
                    w-5
                    text-emerald-600
                  "
                />

                <h4
                  className="
                    text-lg
                    font-black
                    text-slate-900
                  "
                >
                  نص الموضوع
                </h4>
              </div>

              <div
                className="
                  whitespace-pre-wrap
                  rounded-2xl
                  border
                  border-emerald-100
                  bg-emerald-50/40
                  px-5
                  py-5
                  text-[1.02rem]
                  font-semibold
                  leading-9
                  text-slate-800
                "
              >
                {currentExercise.statement}
              </div>
            </section>
          )}


          {/* Tables */}

          {currentExercise?.tables?.length > 0 && (
            <section
              className="
                border-b
                border-slate-100
                px-5
                py-5
                sm:px-7
              "
            >
              {currentExercise.tables.map(
                (table, index) => (
                  <GenericTable
                    key={index}
                    table={table}
                  />
                )
              )}
            </section>
          )}


          {/* Media */}

          {currentExercise?.media?.length > 0 && (
            <section
              className="
                border-b
                border-slate-100
                px-5
                py-6
                sm:px-7
              "
            >
              <div
                className="
                  mb-4
                  flex
                  items-center
                  gap-2
                "
              >
                <ImageIcon
                  className="
                    h-5
                    w-5
                    text-emerald-600
                  "
                />

                <h4
                  className="
                    text-lg
                    font-black
                    text-slate-900
                  "
                >
                  الوثائق المرفقة
                </h4>
              </div>

              <div
                className="
                  grid
                  gap-4
                  md:grid-cols-2
                "
              >
                {currentExercise.media.map(
                  (media, index) => (
                    <figure
                      key={
                        media.id ||
                        index
                      }
                      className="
                        overflow-hidden
                        rounded-2xl
                        border
                        border-slate-200
                        bg-white
                      "
                    >
                      <img
                        src={
                          resolveAssetPath(
                            media.path
                          )
                        }
                        alt={
                          media.title ||
                          `الوثيقة ${index + 1}`
                        }
                        className="
                          max-h-[560px]
                          w-full
                          object-contain
                          p-2
                        "
                      />

                      <figcaption
                        className="
                          border-t
                          border-slate-100
                          px-4
                          py-3
                          text-sm
                          font-bold
                          text-slate-600
                        "
                      >
                        {media.title ||
                          `الوثيقة ${index + 1}`}
                      </figcaption>
                    </figure>
                  )
                )}
              </div>
            </section>
          )}


          {/* Questions */}

          <section
            className="
              px-5
              py-6
              sm:px-7
            "
          >
            <div
              className="
                mb-5
                flex
                items-center
                gap-2
              "
            >
              <Target
                className="
                  h-5
                  w-5
                  text-emerald-600
                "
              />

              <h4
                className="
                  text-lg
                  font-black
                  text-slate-900
                "
              >
                الأسئلة
              </h4>

              <span
                className="
                  rounded-full
                  bg-slate-100
                  px-2.5
                  py-1
                  text-xs
                  font-black
                  text-slate-600
                "
              >
                {questions.length}
              </span>
            </div>

            {questions.length === 0 ? (
              <div
                className="
                  rounded-2xl
                  border
                  border-dashed
                  border-slate-300
                  bg-slate-50
                  p-6
                  text-center
                  font-bold
                  text-slate-500
                "
              >
                لا توجد أسئلة داخل هذا الملف.
              </div>
            ) : (
              <div
                className="
                  space-y-5
                "
              >
                {questions.map(
                  (
                    question,
                    questionIndex
                  ) => {
                    const key =
                      getQuestionKey(
                        currentExercise,
                        question,
                        questionIndex
                      );

                    const solutionOpen =
                      Boolean(
                        openSolutions[key]
                      );

                    const solution =
                      question.solution ||
                      {};

                    const steps =
                      asArray(
                        solution.steps
                      );

                    return (
                      <div
                        key={key}
                        className="
                          overflow-hidden
                          rounded-2xl
                          border
                          border-slate-200
                          bg-white
                        "
                      >
                        <div
                          className="
                            flex
                            flex-col
                            gap-4
                            px-4
                            py-4
                            sm:px-5
                          "
                        >
                          <div
                            className="
                              flex
                              items-start
                              gap-3
                            "
                          >
                            <div
                              className="
                                flex
                                h-9
                                min-w-9
                                items-center
                                justify-center
                                rounded-xl
                                bg-slate-900
                                px-2
                                text-sm
                                font-black
                                text-white
                              "
                            >
                              {question.display_order ||
                                questionIndex + 1}
                            </div>

                            <div
                              className="
                                min-w-0
                                flex-1
                              "
                            >
                              <div
                                className="
                                  whitespace-pre-wrap
                                  text-[1rem]
                                  font-bold
                                  leading-8
                                  text-slate-900
                                "
                              >
                                {question.text}
                              </div>

                              {question.points !== null &&
                                question.points !== undefined && (
                                  <div
                                    className="
                                      mt-2
                                      inline-flex
                                      items-center
                                      gap-1
                                      rounded-full
                                      bg-amber-50
                                      px-2.5
                                      py-1
                                      text-xs
                                      font-black
                                      text-amber-700
                                    "
                                  >
                                    {question.points}
                                    {" "}
                                    نقطة
                                  </div>
                                )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              toggleQuestionSolution(
                                question,
                                questionIndex
                              )
                            }
                            className={cn(
                              "inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 font-black transition",
                              solutionOpen
                                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                            )}
                          >
                            {solutionOpen ? (
                              <EyeOff
                                className="
                                  h-4
                                  w-4
                                "
                              />
                            ) : (
                              <Eye
                                className="
                                  h-4
                                  w-4
                                "
                              />
                            )}

                            {solutionOpen
                              ? "إخفاء الحل"
                              : "عرض الحل النموذجي"}
                          </button>
                        </div>


                        {solutionOpen && (
                          <div
                            className="
                              border-t
                              border-slate-200
                              bg-slate-50
                              px-4
                              py-5
                              sm:px-5
                            "
                          >
                            {/* Strategy */}

                            {hasText(
                              solution.strategy
                            ) && (
                              <div
                                className="
                                  rounded-2xl
                                  border
                                  border-blue-100
                                  bg-blue-50
                                  p-4
                                "
                              >
                                <div
                                  className="
                                    flex
                                    items-center
                                    gap-2
                                    font-black
                                    text-blue-900
                                  "
                                >
                                  <Sparkles
                                    className="
                                      h-4
                                      w-4
                                    "
                                  />

                                  طريقة الإجابة
                                </div>

                                <p
                                  className="
                                    mt-2
                                    whitespace-pre-wrap
                                    leading-8
                                    text-blue-900
                                  "
                                >
                                  {solution.strategy}
                                </p>
                              </div>
                            )}


                            {/* Detailed explanation */}

                            {hasText(
                              solution.detailed_explanation
                            ) && (
                              <div
                                className="
                                  mt-4
                                  rounded-2xl
                                  border
                                  border-slate-200
                                  bg-white
                                  p-4
                                "
                              >
                                <div
                                  className="
                                    font-black
                                    text-slate-900
                                  "
                                >
                                  الشرح
                                </div>

                                <p
                                  className="
                                    mt-2
                                    whitespace-pre-wrap
                                    leading-8
                                    text-slate-700
                                  "
                                >
                                  {solution.detailed_explanation}
                                </p>
                              </div>
                            )}


                            {/* Steps */}

                            {steps.length > 0 && (
                              <div
                                className="
                                  mt-4
                                  space-y-3
                                "
                              >
                                {steps.map(
                                  (
                                    step,
                                    stepIndex
                                  ) => (
                                    <button
                                      type="button"
                                      key={
                                        step.step_number ||
                                        stepIndex
                                      }
                                      onClick={() =>
                                        onTutorStepChange?.({
                                          ...step,

                                          question_id:
                                            question.id,

                                          exercise_id:
                                            currentExercise?.id,
                                        })
                                      }
                                      className="
                                        block
                                        w-full
                                        rounded-2xl
                                        border
                                        border-slate-200
                                        bg-white
                                        p-4
                                        text-right
                                        transition
                                        hover:border-emerald-200
                                        hover:bg-emerald-50/30
                                      "
                                    >
                                      <div
                                        className="
                                          flex
                                          items-start
                                          gap-3
                                        "
                                      >
                                        <div
                                          className="
                                            flex
                                            h-8
                                            min-w-8
                                            items-center
                                            justify-center
                                            rounded-full
                                            bg-emerald-100
                                            text-sm
                                            font-black
                                            text-emerald-700
                                          "
                                        >
                                          {step.step_number ||
                                            stepIndex + 1}
                                        </div>

                                        <div
                                          className="
                                            min-w-0
                                            flex-1
                                          "
                                        >
                                          {hasText(
                                            step.title
                                          ) && (
                                            <div
                                              className="
                                                font-black
                                                text-slate-900
                                              "
                                            >
                                              {step.title}
                                            </div>
                                          )}

                                          {hasText(
                                            step.explanation
                                          ) && (
                                            <div
                                              className="
                                                mt-1
                                                whitespace-pre-wrap
                                                leading-8
                                                text-slate-700
                                              "
                                            >
                                              {step.explanation}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  )
                                )}
                              </div>
                            )}


                            {/* Final answer */}

                            {hasText(
                              solution.final_answer
                            ) && (
                              <div
                                className="
                                  mt-4
                                  rounded-2xl
                                  border
                                  border-emerald-200
                                  bg-emerald-50
                                  p-4
                                "
                              >
                                <div
                                  className="
                                    flex
                                    items-center
                                    gap-2
                                    font-black
                                    text-emerald-900
                                  "
                                >
                                  <CheckCircle2
                                    className="
                                      h-5
                                      w-5
                                    "
                                  />

                                  الإجابة النهائية
                                </div>

                                <div
                                  className="
                                    mt-2
                                    whitespace-pre-wrap
                                    font-semibold
                                    leading-8
                                    text-emerald-950
                                  "
                                >
                                  {solution.final_answer}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>


          {/* =========================================== */}
          {/* Navigation */}
          {/* =========================================== */}

          <div
            className="
              flex
              flex-col
              items-center
              justify-between
              gap-3
              border-t
              border-slate-200
              bg-slate-50
              px-5
              py-4
              sm:flex-row
              sm:px-7
            "
          >
            <button
              type="button"
              onClick={
                goPrevious
              }
              disabled={
                currentExerciseIndex === 0
              }
              className="
                inline-flex
                items-center
                gap-2
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
                py-2.5
                font-black
                text-slate-700
                transition
                hover:border-emerald-300
                hover:text-emerald-700
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              <ChevronRight
                className="
                  h-4
                  w-4
                "
              />

              السابق
            </button>

            <div
              className="
                text-sm
                font-bold
                text-slate-500
              "
            >
              {currentExerciseIndex + 1}
              {" "}
              من
              {" "}
              {exercises.length}
            </div>

            <button
              type="button"
              onClick={
                goNext
              }
              disabled={
                currentExerciseIndex >=
                exercises.length - 1
              }
              className="
                inline-flex
                items-center
                gap-2
                rounded-xl
                bg-emerald-600
                px-4
                py-2.5
                font-black
                text-white
                transition
                hover:bg-emerald-700
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              التالي

              <ChevronLeft
                className="
                  h-4
                  w-4
                "
              />
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
