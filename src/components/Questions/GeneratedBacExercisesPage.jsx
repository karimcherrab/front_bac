import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilePlus2,
  GraduationCap,
  History,
  Loader2,
  RefreshCcw,
  School,
  Sparkles,
  Target,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import {
  MathJax,
  MathJaxContext,
} from "better-react-mathjax";

import { UserContext } from "../../Utils/UserContext";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const GENERATED_BAC_BASE_URL =
  `${API_BASE_URL}/api/bac`;

const MATHJAX_CONFIG = {
  loader: {
    load: ["input/tex", "output/chtml"],
  },
  tex: {
    inlineMath: [
      ["\\(", "\\)"],
      ["$", "$"],
    ],
    displayMath: [
      ["\\[", "\\]"],
      ["$$", "$$"],
    ],
    processEscapes: true,
    packages: {
      "[+]": ["ams"],
    },
  },
  options: {
    skipHtmlTags: [
      "script",
      "noscript",
      "style",
      "textarea",
      "pre",
      "code",
    ],
  },
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function normalizeMathText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\u00a0/gi, " ")
    .replace(
      /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
      "",
    )
    .replace(/\$\$([\s\S]*?)\$\$/g, "\\[$1\\]")
    .replace(
      /(^|[^$])\$([^$\n]+?)\$(?!\$)/g,
      "$1\\($2\\)",
    );
}

function MathText({
  children,
  className = "",
}) {
  const content = normalizeMathText(children);

  if (!content.trim()) {
    return null;
  }

  return (
    <MathJax
      dynamic
      hideUntilTypeset="first"
    >
      <div
        dir="rtl"
        className={cn(
          "whitespace-pre-wrap break-words text-right",
          className,
        )}
        style={{
          direction: "rtl",
          unicodeBidi: "isolate",
          overflowWrap: "anywhere",
        }}
      >
        {content}
      </div>
    </MathJax>
  );
}

function getErrorMessage(
  error,
  fallback = "حدث خطأ غير متوقع.",
) {
  if (error?.response?.status === 401) {
    return (
      "انتهت صلاحية تسجيل الدخول. " +
      "سجّل الدخول من جديد."
    );
  }

  if (error?.response?.status === 404) {
    return "لم يتم العثور على العنصر المطلوب.";
  }

  if (error?.response?.status === 422) {
    return (
      error?.response?.data?.detail ||
      "تعذر إنشاء التمرين بهذه المعطيات."
    );
  }

  if (error?.response?.status >= 500) {
    return (
      error?.response?.data?.detail ||
      "حدث خطأ في الخادم."
    );
  }

  if (error?.code === "ERR_NETWORK") {
    return (
      "تعذر الاتصال بالخادم. " +
      "تحقق من تشغيل Django وإعدادات CORS."
    );
  }

  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    fallback
  );
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(
      "ar-DZ",
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    ).format(new Date(value));
  } catch {
    return "";
  }
}

function getExercisePayload(record) {
  return asObject(record?.exercise);
}

function getExerciseQuestions(record) {
  return asArray(
    getExercisePayload(record)?.questions,
  );
}

function getSolutionPayload(record) {
  return asObject(record?.solution);
}

function getSolutionQuestions(record) {
  return asArray(
    getSolutionPayload(record)?.questions,
  );
}

function getQuestionSolution(
  record,
  question,
) {
  const questionId = String(
    question?.id ?? "",
  );

  return (
    getSolutionQuestions(record).find(
      (item) =>
        String(item?.question_id ?? "") ===
        questionId,
    ) || null
  );
}

/**
 * صفحة مستقلة للتمارين المولدة.
 *
 * Props المطلوبة:
 * - chapterId: رقم الوحدة.
 * - branchCode: رمز الشعبة، مثل science.
 *
 * مثال:
 * <GeneratedBacExercisesPage
 *   chapterId={1}
 *   branchCode="science"
 * />
 */
export default function GeneratedBacExercisesPage({
  chapterId,
  branchCode,
}) {
  const { token } = useContext(UserContext);

  const [records, setRecords] = useState([]);
  const [activeIndex, setActiveIndex] =
    useState(0);

  const [loadingList, setLoadingList] =
    useState(true);
  const [creatingExercise, setCreatingExercise] =
    useState(false);
  const [creatingSolution, setCreatingSolution] =
    useState(false);

  const [showSolution, setShowSolution] =
    useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const currentRecord =
    records[activeIndex] || null;

  const authHeaders = useMemo(
    () =>
      token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    [token],
  );

  const canGenerate = Boolean(
    token &&
    Number(chapterId) > 0 &&
    hasText(branchCode),
  );

  const fetchGeneratedExercises =
    useCallback(async () => {
      if (!token) {
        setLoadingList(false);
        setError(
          "يجب تسجيل الدخول لعرض التمارين المولدة.",
        );
        return;
      }

      if (
        !Number(chapterId) ||
        !hasText(branchCode)
      ) {
        setLoadingList(false);
        setError(
          "يجب تحديد الوحدة والشعبة أولًا.",
        );
        return;
      }

      try {
        setLoadingList(true);
        setError("");

        const response = await axios.get(
          `${GENERATED_BAC_BASE_URL}/my-exercises/`,
          {
            params: {
              chapter_id: Number(chapterId),
              branch_code: branchCode,
            },
            headers: authHeaders,
            timeout: 30000,
          },
        );

        const items = asArray(
          response.data?.results,
        );

        setRecords(items);
        setActiveIndex(0);
        setShowSolution(false);
      } catch (requestError) {
        console.error(
          "Generated bac list error:",
          requestError,
        );

        setError(
          getErrorMessage(
            requestError,
            "تعذر تحميل التمارين المولدة.",
          ),
        );
      } finally {
        setLoadingList(false);
      }
    }, [
      token,
      chapterId,
      branchCode,
      authHeaders,
    ]);

  useEffect(() => {
    fetchGeneratedExercises();
  }, [fetchGeneratedExercises]);

  const handleGenerateExercise =
    async () => {
      if (!canGenerate) {
        setError(
          "يجب تسجيل الدخول وتحديد الوحدة والشعبة.",
        );
        return;
      }

      try {
        setCreatingExercise(true);
        setError("");
        setSuccessMessage("");
        setShowSolution(false);

        const response = await axios.post(
          `${GENERATED_BAC_BASE_URL}/generate/`,
          {
            chapter_id: Number(chapterId),
            branch_code: branchCode,
            references_count: 1,
            selection_strategy:
              "latest_random",
          },
          {
            headers: { 
              ...authHeaders,
              "Content-Type":
                "application/json",
            },
            timeout: 150000,
          },
        );

        const created = response.data;

        setRecords((previous) => [
          created,
          ...previous.filter(
            (item) =>
              Number(item?.id) !==
              Number(created?.id),
          ),
        ]);

        setActiveIndex(0);

        setSuccessMessage(
          "تم إنشاء تمرين جديد بنجاح.",
        );

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      } catch (requestError) {
        console.error(
          "Generate bac exercise error:",
          requestError,
        );

        setError(
          getErrorMessage(
            requestError,
            "تعذر إنشاء التمرين.",
          ),
        );
      } finally {
        setCreatingExercise(false);
      }
    };

  const handleGenerateSolution =
    async () => {
      if (!currentRecord?.id) {
        return;
      }

      if (
        currentRecord?.has_solution &&
        currentRecord?.solution
      ) {
        setShowSolution(
          (previous) => !previous,
        );
        return;
      }

      try {
        setCreatingSolution(true);
        setError("");
        setSuccessMessage("");

        const response = await axios.post(
          `${GENERATED_BAC_BASE_URL}/${
            currentRecord.id
          }/generate-solution/`,
          {
            regenerate: false,
          },
          {
            headers: {
              ...authHeaders,
              "Content-Type":
                "application/json",
            },
            timeout: 180000,
          },
        );

        const updated = response.data;

        setRecords((previous) =>
          previous.map((item) =>
            Number(item?.id) ===
            Number(updated?.id)
              ? updated
              : item,
          ),
        );

        setShowSolution(true);
        setSuccessMessage(
          "تم إنشاء الحل المفصل بنجاح.",
        );
      } catch (requestError) {
        console.error(
          "Generate bac solution error:",
          requestError,
        );

        setError(
          getErrorMessage(
            requestError,
            "تعذر إنشاء الحل.",
          ),
        );
      } finally {
        setCreatingSolution(false);
      }
    };

  const selectRecord = (index) => {
    setActiveIndex(index);
    setShowSolution(false);
    setError("");
    setSuccessMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const goPrevious = () => {
    selectRecord(
      Math.max(activeIndex - 1, 0),
    );
  };

  const goNext = () => {
    selectRecord(
      Math.min(
        activeIndex + 1,
        records.length - 1,
      ),
    );
  };

  if (loadingList) {
    return <GeneratedLoadingState />;
  }

  return (
    <MathJaxContext
      version={3}
      config={MATHJAX_CONFIG}
    >
      <main
        dir="rtl"
        className="
          min-h-screen bg-slate-100
          px-3 py-5 sm:px-5 lg:px-8
        "
      >
        <div className="mx-auto max-w-7xl">
          <GeneratedPageHeader
            chapterId={chapterId}
            branchCode={branchCode}
            count={records.length}
            creating={creatingExercise}
            disabled={!canGenerate}
            onGenerate={handleGenerateExercise}
          />

          <div
            className="
              mt-5 grid items-start gap-5
              lg:grid-cols-[300px_minmax(0,1fr)]
            "
          >
            <GeneratedHistorySidebar
              records={records}
              activeIndex={activeIndex}
              creating={creatingExercise}
              onSelect={selectRecord}
              onGenerate={handleGenerateExercise}
            />

            <section className="min-w-0 space-y-4">
              {error && (
                <MessageBanner
                  type="error"
                  message={error}
                  onClose={() => setError("")}
                />
              )}

              {successMessage && (
                <MessageBanner
                  type="success"
                  message={successMessage}
                  onClose={() =>
                    setSuccessMessage("")
                  }
                />
              )}

              {!currentRecord ? (
                <FirstExerciseState
                  creating={creatingExercise}
                  disabled={!canGenerate}
                  onGenerate={
                    handleGenerateExercise
                  }
                />
              ) : (
                <>
                  <GeneratedNavigation
                    currentIndex={activeIndex}
                    total={records.length}
                    onPrevious={goPrevious}
                    onNext={goNext}
                  />

                  <GeneratedExamPaper
                    record={currentRecord}
                  />

                  <SolutionAction
                    record={currentRecord}
                    loading={creatingSolution}
                    showSolution={showSolution}
                    onClick={
                      handleGenerateSolution
                    }
                  />

                  {showSolution && (
                    <GeneratedSolutionDocument
                      record={currentRecord}
                    />
                  )}

                  <GeneratedNavigation
                    currentIndex={activeIndex}
                    total={records.length}
                    onPrevious={goPrevious}
                    onNext={goNext}
                  />
                </>
              )}
            </section>
          </div>
        </div>
      </main>
    </MathJaxContext>
  );
}

function GeneratedPageHeader({
  chapterId,
  branchCode,
  count,
  creating,
  disabled,
  onGenerate,
}) {
  return (
    <header
      className="
        overflow-hidden rounded-3xl
        border border-slate-200
        bg-white shadow-sm
      "
    >
      <div
        className="
          bg-gradient-to-l
          from-[#15123a] via-slate-900
          to-blue-950
          px-5 py-7 text-white sm:px-8
        "
      >
        <div
          className="
            flex flex-col justify-between
            gap-6 lg:flex-row lg:items-center
          "
        >
          <div className="flex items-start gap-4">
            <div
              className="
                flex h-14 w-14 shrink-0
                items-center justify-center
                rounded-2xl bg-white/10
                ring-1 ring-white/15
              "
            >
              <WandSparkles size={29} />
            </div>

            <div>
              <div
                className="
                  inline-flex items-center gap-2
                  rounded-full bg-blue-500/15
                  px-3 py-1 text-xs font-black
                  text-blue-100
                "
              >
                <Sparkles size={14} />
                تمارين منشأة بالذكاء الاصطناعي
              </div>

              <h1
                className="
                  mt-3 text-2xl font-black
                  sm:text-3xl
                "
              >
                تدريب جديد بأسلوب البكالوريا
              </h1>

              <p
                className="
                  mt-2 max-w-2xl text-sm
                  font-semibold leading-7
                  text-slate-300
                "
              >
                هذه صفحة مستقلة للتمارين
                المولدة. يتم إنشاء تمرين جديد
                انطلاقًا من تمارين بكالوريا
                حقيقية لنفس الوحدة والشعبة.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={creating || disabled}
            className="
              inline-flex min-h-13
              items-center justify-center gap-2
              rounded-2xl bg-blue-600
              px-6 py-3 text-sm font-black
              text-white shadow-lg
              shadow-blue-950/30 transition
              hover:bg-blue-500
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {creating ? (
              <>
                <Loader2
                  size={20}
                  className="animate-spin"
                />
                جارٍ إنشاء التمرين...
              </>
            ) : (
              <>
                <FilePlus2 size={20} />
                إنشاء تمرين جديد
              </>
            )}
          </button>
        </div>
      </div>

      <div
        className="
          flex flex-wrap items-center gap-3
          border-t border-slate-100
          px-5 py-4 sm:px-8
        "
      >
        <HeaderInfoBadge
          icon={<BookOpen size={16} />}
          label="الوحدة"
          value={chapterId || "—"}
        />

        <HeaderInfoBadge
          icon={<School size={16} />}
          label="الشعبة"
          value={branchCode || "—"}
        />

        <HeaderInfoBadge
          icon={<History size={16} />}
          label="التمارين المحفوظة"
          value={count}
        />
      </div>
    </header>
  );
}

function HeaderInfoBadge({
  icon,
  label,
  value,
}) {
  return (
    <div
      className="
        flex items-center gap-2
        rounded-xl border border-slate-200
        bg-slate-50 px-3 py-2
      "
    >
      <span className="text-blue-700">
        {icon}
      </span>
      <span className="text-xs font-bold text-slate-500">
        {label}:
      </span>
      <span className="text-sm font-black text-slate-900">
        {value}
      </span>
    </div>
  );
}

function GeneratedHistorySidebar({
  records,
  activeIndex,
  creating,
  onSelect,
  onGenerate,
}) {
  return (
    <aside
      className="
        overflow-hidden rounded-2xl
        border border-slate-200
        bg-white shadow-sm
        lg:sticky lg:top-5
      "
    >
      <div
        className="
          border-b border-slate-100
          bg-slate-50 px-4 py-4
        "
      >
        <div className="flex items-center gap-3">
          <span
            className="
              flex h-10 w-10 items-center
              justify-center rounded-xl
              bg-blue-700 text-white
            "
          >
            <History size={20} />
          </span>

          <div>
            <h2 className="font-black text-slate-950">
              تماريني المولدة
            </h2>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              اختر تمرينًا محفوظًا
            </p>
          </div>
        </div>
      </div>

      <div
        className="
          max-h-[65vh] space-y-2
          overflow-y-auto p-3
        "
      >
        {records.length === 0 ? (
          <div
            className="
              rounded-xl border
              border-dashed border-slate-300
              px-3 py-8 text-center
            "
          >
            <BookOpen
              size={28}
              className="mx-auto text-slate-400"
            />
            <p
              className="
                mt-3 text-sm font-black
                text-slate-700
              "
            >
              لا توجد تمارين بعد
            </p>
          </div>
        ) : (
          records.map((record, index) => (
            <button
              key={record?.id ?? index}
              type="button"
              onClick={() => onSelect(index)}
              className={cn(
                `
                  w-full rounded-xl border
                  px-3 py-3 text-right
                  transition
                `,
                activeIndex === index
                  ? `
                    border-blue-600
                    bg-blue-50
                    shadow-sm
                  `
                  : `
                    border-slate-200
                    bg-white
                    hover:border-blue-300
                    hover:bg-slate-50
                  `,
              )}
            >
              <div
                className="
                  flex items-start
                  justify-between gap-2
                "
              >
                <span
                  className={cn(
                    `
                      flex h-8 w-8 shrink-0
                      items-center justify-center
                      rounded-lg text-xs
                      font-black
                    `,
                    activeIndex === index
                      ? "bg-blue-700 text-white"
                      : "bg-slate-100 text-slate-600",
                  )}
                >
                  {records.length - index}
                </span>

                {record?.has_solution && (
                  <CheckCircle2
                    size={17}
                    className="
                      mt-1 shrink-0
                      text-emerald-600
                    "
                  />
                )}
              </div>

              <p
                className="
                  mt-2 line-clamp-2
                  text-sm font-black
                  leading-6 text-slate-900
                "
              >
                {record?.title ||
                  "تمرين مولد"}
              </p>

              <p
                className="
                  mt-2 flex items-center gap-1
                  text-[11px] font-bold
                  text-slate-400
                "
              >
                <Clock3 size={12} />
                {formatDate(record?.created_at)}
              </p>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={creating}
          className="
            inline-flex w-full
            items-center justify-center gap-2
            rounded-xl bg-slate-900
            px-4 py-3 text-sm font-black
            text-white transition
            hover:bg-slate-800
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {creating ? (
            <Loader2
              size={18}
              className="animate-spin"
            />
          ) : (
            <Sparkles size={18} />
          )}
          تمرين جديد
        </button>
      </div>
    </aside>
  );
}

function GeneratedNavigation({
  currentIndex,
  total,
  onPrevious,
  onNext,
}) {
  if (total <= 1) {
    return null;
  }

  return (
    <div
      className="
        flex items-center justify-between
        gap-3 rounded-xl
        border border-slate-200
        bg-white p-3 shadow-sm
      "
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className="
          inline-flex min-h-10
          items-center gap-2 rounded-lg
          border border-slate-200
          px-4 py-2 text-sm font-black
          text-slate-700 transition
          hover:bg-slate-50
          disabled:cursor-not-allowed
          disabled:opacity-40
        "
      >
        <ChevronRight size={18} />
        الأحدث
      </button>

      <p className="text-sm font-black text-slate-700">
        {currentIndex + 1} / {total}
      </p>

      <button
        type="button"
        onClick={onNext}
        disabled={
          currentIndex >= total - 1
        }
        className="
          inline-flex min-h-10
          items-center gap-2 rounded-lg
          border border-slate-200
          px-4 py-2 text-sm font-black
          text-slate-700 transition
          hover:bg-slate-50
          disabled:cursor-not-allowed
          disabled:opacity-40
        "
      >
        الأقدم
        <ChevronLeft size={18} />
      </button>
    </div>
  );
}

function GeneratedExamPaper({
  record,
}) {
  const exercise = getExercisePayload(record);
  const questions = getExerciseQuestions(record);
  const sections = asArray(
    exercise?.statement_sections,
  );

  return (
    <article
      className="
        overflow-hidden rounded-2xl
        border border-slate-300
        bg-white
        shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)]
      "
    >
      <div
        className="
          border-b-4 border-slate-900
          bg-slate-50 px-5 py-5
          sm:px-9
        "
      >
        <div
          className="
            flex flex-col gap-4
            sm:flex-row sm:items-start
            sm:justify-between
          "
        >
          <div>
            <p
              className="
                text-sm font-bold
                text-slate-500
              "
            >
              منصة التدريب على البكالوريا
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2
                className="
                  text-xl font-black
                  text-slate-950 sm:text-2xl
                "
              >
                {record?.title ||
                  exercise?.title ||
                  "تمرين مقترح"}
              </h2>

              <span
                className="
                  rounded-full bg-violet-100
                  px-3 py-1 text-xs font-black
                  text-violet-700
                "
              >
                مولد بالذكاء الاصطناعي
              </span>
            </div>
          </div>

          <div
            className="
              rounded-xl border
              border-slate-200 bg-white
              px-4 py-3 text-sm
              font-bold text-slate-700
            "
          >
            <p>
              الوحدة:{" "}
              <span className="font-black">
                {record?.chapter?.title ||
                  record?.chapter?.code ||
                  "—"}
              </span>
            </p>

            <p className="mt-1">
              الشعبة:{" "}
              <span className="font-black">
                {record?.branch?.name ||
                  record?.branch?.code ||
                  "—"}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 sm:px-9 sm:py-9">
        <section
          className="
            overflow-hidden rounded-2xl
            border border-slate-200
          "
        >
          <div
            className="
              flex items-center gap-2
              border-b border-slate-200
              bg-slate-50 px-4 py-3
              sm:px-6
            "
          >
            <BookOpen
              size={19}
              className="text-slate-700"
            />
            <h3 className="font-black text-slate-950">
              نص التمرين
            </h3>
          </div>

          <div
            className="
              space-y-5 px-4 py-5
              sm:px-7 sm:py-7
            "
          >
            {hasText(exercise?.statement) && (
              <MathText
                className="
                  text-[1.03rem] font-semibold
                  leading-10 text-slate-950
                  sm:text-lg
                "
              >
                {exercise.statement}
              </MathText>
            )}

            {sections.map(
              (section, index) => (
                <div
                  key={index}
                  className="
                    border-r-4 border-blue-500
                    bg-blue-50/60
                    px-4 py-3
                  "
                >
                  <MathText
                    className="
                      font-semibold leading-9
                      text-slate-900
                    "
                  >
                    {section?.text}
                  </MathText>
                </div>
              ),
            )}
          </div>
        </section>

        <section
          className="
            mt-6 overflow-hidden
            rounded-2xl
            border border-blue-200
            bg-blue-50/30
          "
        >
          <div
            className="
              flex items-center gap-2
              border-b border-blue-200
              bg-blue-50 px-4 py-3
              sm:px-6
            "
          >
            <Target
              size={19}
              className="text-blue-700"
            />
            <h3 className="font-black text-blue-950">
              الأسئلة
            </h3>
          </div>

          <div className="divide-y divide-slate-200">
            {questions.map(
              (question, index) => (
                <article
                  key={
                    question?.id ?? index
                  }
                  className="
                    bg-white px-4 py-5
                    sm:px-6
                  "
                >
                  <div
                    className="
                      flex items-start gap-4
                    "
                  >
                    <span
                      className="
                        flex h-9 w-9 shrink-0
                        items-center justify-center
                        rounded-full bg-blue-700
                        text-sm font-black
                        text-white
                      "
                    >
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <MathText
                        className="
                          text-[1.03rem]
                          font-bold leading-10
                          text-slate-950
                          sm:text-lg
                        "
                      >
                        {question?.text}
                      </MathText>

                      <div
                        className="
                          mt-3 flex flex-wrap
                          items-center gap-2
                        "
                      >
                        {question?.points != null && (
                          <span
                            className="
                              rounded-full
                              bg-slate-100
                              px-3 py-1 text-xs
                              font-black
                              text-slate-600
                            "
                          >
                            {question.points} نقطة
                          </span>
                        )}

                        {hasText(question?.skill) && (
                          <span
                            className="
                              rounded-full
                              bg-amber-50
                              px-3 py-1 text-xs
                              font-black
                              text-amber-700
                            "
                          >
                            {question.skill}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      </div>
    </article>
  );
}

function SolutionAction({
  record,
  loading,
  showSolution,
  onClick,
}) {
  const hasSolution = Boolean(
    record?.has_solution ||
    Object.keys(
      asObject(record?.solution),
    ).length > 0,
  );

  return (
    <div
      className="
        flex flex-col items-center
        justify-between gap-4
        rounded-2xl border
        border-slate-200 bg-white
        px-5 py-5 shadow-sm
        sm:flex-row
      "
    >
      <div>
        <h3 className="font-black text-slate-950">
          {hasSolution
            ? "الحل المفصل جاهز"
            : "هل انتهيت من المحاولة؟"}
        </h3>

        <p
          className="
            mt-1 text-sm font-semibold
            leading-7 text-slate-500
          "
        >
          {hasSolution
            ? "يمكنك إظهار الحل أو إخفاؤه دون استدعاء الذكاء الاصطناعي من جديد."
            : "لن يتم إنشاء الحل إلا بعد الضغط على الزر."}
        </p>
      </div>

      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={cn(
          `
            inline-flex min-h-12
            items-center justify-center gap-2
            rounded-xl px-6 py-3
            text-sm font-black transition
            disabled:cursor-not-allowed
            disabled:opacity-60
          `,
          hasSolution && showSolution
            ? `
              border border-slate-300
              bg-white text-slate-700
              hover:bg-slate-50
            `
            : `
              bg-emerald-700 text-white
              shadow-md
              hover:bg-emerald-800
            `,
        )}
      >
        {loading ? (
          <>
            <Loader2
              size={19}
              className="animate-spin"
            />
            جارٍ إنشاء الحل...
          </>
        ) : hasSolution ? (
          <>
            <CheckCircle2 size={19} />
            {showSolution
              ? "إخفاء الحل"
              : "إظهار الحل"}
          </>
        ) : (
          <>
            <Sparkles size={19} />
            إنشاء الحل المفصل
          </>
        )}
      </button>
    </div>
  );
}

function GeneratedSolutionDocument({
  record,
}) {
  const solution = getSolutionPayload(record);
  const exercise = getExercisePayload(record);
  const questions = getExerciseQuestions(record);

  if (
    Object.keys(solution).length === 0
  ) {
    return null;
  }

  return (
    <article
      className="
        overflow-hidden rounded-2xl
        border border-emerald-300
        bg-white shadow-sm
      "
    >
      <div
        className="
          border-b-2 border-emerald-700
          bg-emerald-50 px-5 py-5
          sm:px-9
        "
      >
        <div className="flex items-center gap-3">
          <CheckCircle2
            className="text-emerald-700"
            size={27}
          />

          <div>
            <p
              className="
                text-xs font-black
                uppercase tracking-wider
                text-emerald-700
              "
            >
              التصحيح النموذجي
            </p>

            <h2
              className="
                mt-1 text-xl font-black
                text-slate-950 sm:text-2xl
              "
            >
              الحل الكامل للتمرين
            </h2>
          </div>
        </div>
      </div>

      <div className="px-5 py-7 sm:px-9">
        {hasText(solution?.general_strategy) && (
          <div
            className="
              mb-7 rounded-2xl
              border border-blue-200
              bg-blue-50 px-5 py-4
            "
          >
            <div className="flex items-center gap-2">
              <Target
                size={19}
                className="text-blue-700"
              />
              <h3 className="font-black text-blue-950">
                الخطة العامة
              </h3>
            </div>

            <MathText
              className="
                mt-3 font-semibold leading-9
                text-slate-800
              "
            >
              {solution.general_strategy}
            </MathText>
          </div>
        )}

        <div className="space-y-8">
          {questions.map(
            (question, index) => {
              const questionSolution =
                getQuestionSolution(
                  record,
                  question,
                );

              return (
                <QuestionSolution
                  key={
                    question?.id ?? index
                  }
                  number={index + 1}
                  question={question}
                  solution={questionSolution}
                />
              );
            },
          )}
        </div>

        <FinalVerification
          verification={
            solution?.final_verification
          }
        />
      </div>
    </article>
  );
}

function QuestionSolution({
  number,
  question,
  solution,
}) {
  if (!solution) {
    return (
      <section
        className="
          rounded-xl border
          border-amber-200
          bg-amber-50 px-4 py-4
        "
      >
        <div className="flex items-start gap-2">
          <TriangleAlert
            size={18}
            className="
              mt-0.5 shrink-0
              text-amber-700
            "
          />
          <p className="text-sm font-bold text-amber-900">
            لا يوجد حل محفوظ لهذا السؤال.
          </p>
        </div>
      </section>
    );
  }

  const steps = asArray(solution?.steps);
  const hints = asArray(solution?.hints);
  const mistakes = asArray(
    solution?.common_mistakes,
  );
  const bacWriting = asArray(
    solution?.bac_writing,
  );

  return (
    <section
      className="
        border-b border-slate-200
        pb-8 last:border-b-0
        last:pb-0
      "
    >
      <div
        className="
          rounded-xl border
          border-blue-200
          bg-blue-50 px-4 py-4
        "
      >
        <p
          className="
            mb-2 text-xs font-black
            text-blue-700
          "
        >
          حل السؤال {number}
        </p>

        <MathText
          className="
            text-base font-black
            leading-9 text-slate-950
            sm:text-lg
          "
        >
          {question?.text}
        </MathText>
      </div>

      {hasText(solution?.strategy) && (
        <div
          className="
            mt-5 border-r-4
            border-violet-500
            bg-violet-50
            px-4 py-3
          "
        >
          <p
            className="
              text-xs font-black
              text-violet-700
            "
          >
            استراتيجية الحل
          </p>

          <MathText
            className="
              mt-2 font-semibold
              leading-8 text-slate-800
            "
          >
            {solution.strategy}
          </MathText>
        </div>
      )}

      {steps.length > 0 && (
        <div className="mt-6 space-y-5">
          {steps.map((step, index) => (
            <div
              key={
                step?.step_number ?? index
              }
              className="
                relative pr-12
              "
            >
              <span
                className="
                  absolute right-0 top-0
                  flex h-8 w-8
                  items-center justify-center
                  rounded-full bg-slate-900
                  text-xs font-black
                  text-white
                "
              >
                {index + 1}
              </span>

              {index < steps.length - 1 && (
                <span
                  className="
                    absolute right-[15px]
                    top-9 h-[calc(100%-1.5rem)]
                    w-px bg-slate-200
                  "
                />
              )}

              <div className="min-w-0">
                {hasText(step?.title) && (
                  <h4
                    className="
                      font-black
                      text-slate-950
                    "
                  >
                    {step.title}
                  </h4>
                )}

                {hasText(
                  step?.explanation,
                ) && (
                  <MathText
                    className="
                      mt-2 font-semibold
                      leading-9
                      text-slate-700
                    "
                  >
                    {step.explanation}
                  </MathText>
                )}

                {hasText(step?.latex) && (
                  <div
                    dir="ltr"
                    className="
                      mt-3 overflow-x-auto
                      rounded-xl
                      border border-slate-200
                      bg-slate-50
                      px-4 py-3 text-center
                    "
                  >
                    <MathJax
                      dynamic
                      hideUntilTypeset="first"
                    >
                      {`\\[${step.latex}\\]`}
                    </MathJax>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasText(solution?.final_answer) && (
        <div
          className="
            mt-6 overflow-hidden
            rounded-2xl border
            border-emerald-300
            bg-emerald-50
          "
        >
          <div
            className="
              border-b border-emerald-200
              bg-emerald-100/70
              px-4 py-3
            "
          >
            <h4
              className="
                text-sm font-black
                text-emerald-900
              "
            >
              النتيجة النهائية
            </h4>
          </div>

          <div className="px-4 py-4">
            <MathText
              className="
                font-black leading-9
                text-emerald-950
              "
            >
              {solution.final_answer}
            </MathText>
          </div>
        </div>
      )}

      <div
        className="
          mt-5 grid gap-4
          md:grid-cols-2
        "
      >
        {hasText(solution?.verification) && (
          <InfoCard
            type="success"
            title="التحقق"
            items={[solution.verification]}
          />
        )}

        {hints.length > 0 && (
          <InfoCard
            type="info"
            title="تلميحات"
            items={hints}
          />
        )}

        {mistakes.length > 0 && (
          <InfoCard
            type="warning"
            title="أخطاء شائعة"
            items={mistakes}
          />
        )}

        {bacWriting.length > 0 && (
          <InfoCard
            type="neutral"
            title="صياغة البكالوريا"
            items={bacWriting}
          />
        )}
      </div>
    </section>
  );
}

function InfoCard({
  type,
  title,
  items,
}) {
  const styles = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-950",
    info:
      "border-blue-200 bg-blue-50 text-blue-950",
    warning:
      "border-amber-200 bg-amber-50 text-amber-950",
    neutral:
      "border-slate-200 bg-slate-50 text-slate-900",
  };

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4",
        styles[type] || styles.neutral,
      )}
    >
      <h4 className="text-sm font-black">
        {title}
      </h4>

      <ul className="mt-3 space-y-2">
        {asArray(items).map(
          (item, index) => (
            <li
              key={index}
              className="
                flex items-start gap-2
                text-sm font-semibold
                leading-7
              "
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <MathText>
                {typeof item === "string"
                  ? item
                  : item?.text}
              </MathText>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function FinalVerification({
  verification,
}) {
  const data = asObject(verification);

  if (Object.keys(data).length === 0) {
    return null;
  }

  return (
    <section
      className="
        mt-8 rounded-2xl
        border border-slate-200
        bg-slate-50 px-5 py-5
      "
    >
      <div className="flex items-center gap-2">
        <CheckCircle2
          size={20}
          className="text-emerald-700"
        />
        <h3 className="font-black text-slate-950">
          التحقق النهائي من الحل
        </h3>
      </div>

      <div
        className="
          mt-4 grid gap-3
          md:grid-cols-2
        "
      >
        {hasText(
          data?.mathematical_consistency,
        ) && (
          <VerificationItem
            title="الاتساق الرياضي"
            text={
              data.mathematical_consistency
            }
          />
        )}

        {hasText(
          data?.dependency_consistency,
        ) && (
          <VerificationItem
            title="ترابط الأسئلة"
            text={
              data.dependency_consistency
            }
          />
        )}
      </div>
    </section>
  );
}

function VerificationItem({
  title,
  text,
}) {
  return (
    <div
      className="
        rounded-xl border
        border-slate-200 bg-white
        px-4 py-3
      "
    >
      <p className="text-xs font-black text-slate-500">
        {title}
      </p>
      <MathText
        className="
          mt-2 text-sm font-semibold
          leading-7 text-slate-800
        "
      >
        {text}
      </MathText>
    </div>
  );
}

function FirstExerciseState({
  creating,
  disabled,
  onGenerate,
}) {
  return (
    <section
      className="
        rounded-3xl border
        border-dashed border-slate-300
        bg-white px-5 py-16
        text-center shadow-sm
      "
    >
      <div
        className="
          mx-auto flex h-20 w-20
          items-center justify-center
          rounded-3xl bg-blue-50
          text-blue-700
        "
      >
        <WandSparkles size={36} />
      </div>

      <h2
        className="
          mt-5 text-xl font-black
          text-slate-950
        "
      >
        أنشئ أول تمرين تدريبي
      </h2>

      <p
        className="
          mx-auto mt-3 max-w-xl
          text-sm font-semibold
          leading-8 text-slate-500
        "
      >
        سيختار النظام تمارين بكالوريا
        حقيقية من نفس الوحدة والشعبة،
        ثم ينشئ تمرينًا جديدًا بأسلوب
        مشابه دون إظهار الحل مباشرة.
      </p>

      <button
        type="button"
        onClick={onGenerate}
        disabled={creating || disabled}
        className="
          mt-6 inline-flex min-h-13
          items-center justify-center gap-2
          rounded-2xl bg-blue-700
          px-7 py-3 text-sm font-black
          text-white shadow-md transition
          hover:bg-blue-800
          disabled:cursor-not-allowed
          disabled:opacity-60
        "
      >
        {creating ? (
          <>
            <Loader2
              size={20}
              className="animate-spin"
            />
            جارٍ الإنشاء...
          </>
        ) : (
          <>
            <Sparkles size={20} />
            إنشاء تمرين الآن
          </>
        )}
      </button>
    </section>
  );
}

function MessageBanner({
  type,
  message,
  onClose,
}) {
  const success = type === "success";

  return (
    <div
      className={cn(
        `
          flex items-start
          justify-between gap-3
          rounded-xl border
          px-4 py-3
        `,
        success
          ? `
            border-emerald-200
            bg-emerald-50
            text-emerald-900
          `
          : `
            border-red-200
            bg-red-50
            text-red-900
          `,
      )}
    >
      <div className="flex items-start gap-2">
        {success ? (
          <CheckCircle2
            size={19}
            className="mt-0.5 shrink-0"
          />
        ) : (
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
          />
        )}

        <p className="text-sm font-bold leading-7">
          {message}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="
          shrink-0 rounded-lg
          px-2 py-1 text-xs font-black
          hover:bg-black/5
        "
      >
        إغلاق
      </button>
    </div>
  );
}

function GeneratedLoadingState() {
  return (
    <div
      dir="rtl"
      className="
        flex min-h-[65vh]
        items-center justify-center
        bg-slate-100 px-4
      "
    >
      <div className="text-center">
        <div
          className="
            mx-auto flex h-16 w-16
            items-center justify-center
            rounded-2xl bg-white
            text-blue-700 shadow-sm
          "
        >
          <Loader2
            size={30}
            className="animate-spin"
          />
        </div>

        <p
          className="
            mt-4 font-black
            text-slate-800
          "
        >
          جارٍ تحميل التمارين المولدة...
        </p>
      </div>
    </div>
  );
}
