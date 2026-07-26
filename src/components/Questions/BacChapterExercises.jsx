import { useContext, useEffect, useMemo, useState } from "react";
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
  Hash,
  School,
  Lightbulb,
  ListChecks,
  Loader2,
  RefreshCcw,
  Sparkles,
  Target,
  PenLine,
  TriangleAlert,
} from "lucide-react";
import { MathJax, MathJaxContext } from "better-react-mathjax";

import { UserContext } from "../../Utils/UserContext";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const STEP_REEXPLANATION_URL =
  `${API_BASE_URL}/api/bac/exercises/re-explain-step/`;

const MATHJAX_CONFIG = {
  loader: { load: ["input/tex", "output/chtml"] },
  tex: {
    inlineMath: [["\\(", "\\)"], ["$", "$"]],
    displayMath: [["\\[", "\\]"], ["$$", "$$"]],
    processEscapes: true,
    packages: { "[+]": ["ams"] },
  },
  options: {
    skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
  },
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function getExerciseBranches(exercise) {
  const directBranches = asArray(exercise?.branches);

  if (directBranches.length > 0) {
    return directBranches
      .map((branch) => {
        if (typeof branch === "string") {
          return {
            code: branch.trim().toLowerCase(),
            name: branch.trim(),
          };
        }

        return {
          id: branch?.id ?? null,
          code: String(branch?.code ?? "").trim().toLowerCase(),
          name: String(branch?.name ?? branch?.code ?? "").trim(),
        };
      })
      .filter((branch) => branch.code);
  }

  const branchCodes = asArray(
    exercise?.branch_codes || exercise?.content?.branch_codes
  );

  return branchCodes
    .map((code) => ({
      code: String(code ?? "").trim().toLowerCase(),
      name: String(code ?? "").trim(),
    }))
    .filter((branch) => branch.code);
}

function exerciseBelongsToBranch(exercise, branchCode) {
  if (!branchCode || branchCode === "all") return true;

  return getExerciseBranches(exercise).some(
    (branch) => branch.code === branchCode
  );
}

/**
 * تدعم الخطوات سواء جاءت كمصفوفة:
 * steps: [{...}]
 *
 * أو ككائن:
 * steps: { step_1: {...}, step_2: {...} }
 */
function normalizeSteps(value) {
  if (Array.isArray(value)) return value;

  if (value && typeof value === "object") {
    return Object.entries(value)
      .sort(([keyA], [keyB]) => {
        const numberA = Number(String(keyA).match(/\d+/)?.[0] ?? 0);
        const numberB = Number(String(keyB).match(/\d+/)?.[0] ?? 0);
        return numberA - numberB;
      })
      .map(([key, step], index) => {
        if (typeof step === "string") {
          return {
            step_number: index + 1,
            title: key.replaceAll("_", " "),
            explanation: step,
          };
        }

        return {
          step_number: step?.step_number ?? index + 1,
          ...asObject(step),
        };
      });
  }

  return [];
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? item
          : item?.text || item?.content || item?.title || ""
      )
      .filter(hasText);
  }

  if (hasText(value)) return [value];
  return [];
}

function getMethodology(question, solution) {
  return asObject(solution?.methodology || question?.methodology);
}

function getFormalWriting(question, solution, methodology) {
  return normalizeStringList(
    methodology?.formal_writing ||
      solution?.formal_writing ||
      question?.formal_writing
  );
}

function getConstructionValues(question, solution) {
  return asArray(
    solution?.construction_values ||
      question?.construction_values
  );
}

function getSolutionTables(solution) {
  const values = [
    solution?.table_data,
    solution?.table,
    solution?.variation_table,
    solution?.sign_table,
  ].filter(Boolean);

  return values;
}

function getExerciseStatementSections(exercise) {
  return asArray(
    exercise?.statement_sections || exercise?.content?.statement_sections
  ).filter((section) => hasText(section?.text || section?.content));
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeEscapedLatex(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\u00a0/gi, " ")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\\{2,}(?=[()[\]])/g, "\\")
    .replace(
      /\\{2,}(?=(?:displaystyle|textstyle|scriptstyle|frac|dfrac|tfrac|sqrt|alpha|beta|gamma|Delta|delta|lambda|mu|pi|theta|omega|times|cdot|cdots|ldots|dots|leq|le|geq|ge|neq|in|notin|infty|to|rightarrow|leftarrow|sum|prod|lim|forall|exists|left|right|begin|end|text|mathrm|mathbf|mathbb|mathcal|overline|underline|quad|qquad|,|;|!|:|vert|lvert|rvert|pm|mp)\b)/g,
      "\\"
    )
    .replace(/\$\$([\s\S]*?)\$\$/g, "\\[$1\\]")
    .replace(/(^|[^$])\$([^$\n]+?)\$(?!\$)/g, "$1\\($2\\)")
    .replace(/(?:\\\(\s*){2,}/g, "\\(")
    .replace(/(?:\s*\\\)){2,}/g, "\\)")
    .replace(/(?:\\\[\s*){2,}/g, "\\[")
    .replace(/(?:\s*\\\]){2,}/g, "\\]")
    .replace(/\\\(\s*\\\[/g, "\\[")
    .replace(/\\\]\s*\\\)/g, "\\]")
    .replace(/\\\(\s*\\\)/g, "")
    .replace(/\\\[\s*\\\]/g, "");
}

const ARABIC_RE = /[\u0600-\u06ff]/;
const LATEX_COMMAND_RE = /\\(?:displaystyle|textstyle|scriptstyle|frac|dfrac|tfrac|sqrt|alpha|beta|gamma|Delta|delta|lambda|mu|pi|theta|omega|times|cdot|cdots|ldots|dots|leq|le|geq|ge|neq|in|notin|infty|to|rightarrow|leftarrow|sum|prod|lim|forall|exists|left|right|begin|end|mathrm|mathbf|mathbb|mathcal|overline|underline|quad|qquad|vert|lvert|rvert|pm|mp)\b/;

function isLikelyMath(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate || ARABIC_RE.test(candidate)) return false;

  return (
    LATEX_COMMAND_RE.test(candidate) ||
    /[=<>+\-*/^_{}]/.test(candidate) ||
    /(?:^|\s)[A-Za-z](?:_[A-Za-z0-9{}+\-]+|\^[A-Za-z0-9{}+\-]+)?(?:\s|$)/.test(candidate) ||
    /^\s*(?:[A-Za-z]|\d)+(?:\s*[,;:]\s*(?:[A-Za-z]|\d)+)*\s*$/.test(candidate)
  );
}

function extractBalancedGroup(text, startIndex) {
  if (text[startIndex] !== "{") return null;

  let depth = 0;
  for (let index = startIndex; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") depth -= 1;

    if (depth === 0) {
      return {
        content: text.slice(startIndex + 1, index),
        endIndex: index + 1,
      };
    }
  }

  return null;
}

function splitArabicTextCommands(raw) {
  const parts = [];
  let cursor = 0;
  const regex = /\\text\s*\{/g;
  let match;

  while ((match = regex.exec(raw)) !== null) {
    const groupStart = raw.indexOf("{", match.index);
    const group = extractBalancedGroup(raw, groupStart);
    if (!group) break;

    if (match.index > cursor) {
      parts.push({ type: "candidate", value: raw.slice(cursor, match.index) });
    }

    if (ARABIC_RE.test(group.content)) {
      parts.push({ type: "text", value: group.content });
    } else {
      parts.push({
        type: "candidate",
        value: raw.slice(match.index, group.endIndex),
      });
    }

    cursor = group.endIndex;
    regex.lastIndex = group.endIndex;
  }

  if (cursor < raw.length) {
    parts.push({ type: "candidate", value: raw.slice(cursor) });
  }

  return parts.length ? parts : [{ type: "candidate", value: raw }];
}

function splitLooseCandidate(rawValue) {
  const raw = String(rawValue ?? "");
  const segments = [];
  let buffer = "";
  let mode = "text";
  let braceDepth = 0;

  const flush = () => {
    if (!buffer) return;
    const value = buffer;
    buffer = "";

    if (mode === "math" && isLikelyMath(value)) {
      segments.push({ type: "inline", value: `\\(${value.trim()}\\)` });
    } else {
      segments.push({ type: "text", value });
    }
  };

  const shouldStartMath = (index) => {
    const rest = raw.slice(index);
    if (rest.startsWith("\\")) return LATEX_COMMAND_RE.test(rest);

    if (/[A-Za-z0-9]/.test(raw[index])) {
      const lookAhead = rest.slice(0, 80);
      return /^(?:[A-Za-z]|\d)+(?:\s*)?(?:_|\^|=|<|>|\+|\-|\*|\/|\\)/.test(lookAhead) ||
        /^[A-Za-z](?:_[A-Za-z0-9{}+\-]+)?\s*(?:,|،|؛|:|\.|\)|$)/.test(lookAhead);
    }

    return false;
  };

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (mode === "text") {
      if (shouldStartMath(index)) {
        flush();
        mode = "math";
        index -= 1;
        continue;
      }

      buffer += char;
      continue;
    }

    if (char === "{") braceDepth += 1;
    if (char === "}") braceDepth = Math.max(0, braceDepth - 1);

    const previous = raw[index - 1] || "";
    const isArabicBoundary = ARABIC_RE.test(char) && braceDepth === 0;
    const isStrongBoundary = /[؟!\n]/.test(char) && braceDepth === 0;
    const isPunctuationBoundary = /[،؛]/.test(char) && braceDepth === 0;
    const isColonBeforeArabic =
      char === ":" && braceDepth === 0 && ARABIC_RE.test(raw.slice(index + 1).trimStart()[0] || "");

    if (isArabicBoundary || isStrongBoundary || isPunctuationBoundary || isColonBeforeArabic) {
      flush();
      mode = "text";
      index -= 1;
      continue;
    }

    buffer += char;

    if (
      braceDepth === 0 &&
      /[.]/.test(char) &&
      !/\d/.test(previous) &&
      !/\d/.test(raw[index + 1] || "")
    ) {
      flush();
      mode = "text";
    }
  }

  flush();
  return segments;
}

function mergeAdjacentSegments(segments) {
  return segments.reduce((result, segment) => {
    if (!segment?.value) return result;
    const previous = result[result.length - 1];

    if (previous && previous.type === segment.type) {
      previous.value += segment.value;
    } else {
      result.push({ ...segment });
    }

    return result;
  }, []);
}

function splitMathSegments(value) {
  const text = normalizeEscapedLatex(value);
  const segments = [];
  const explicitRegex = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
  let cursor = 0;
  let match;

  const pushLooseText = (part) => {
    splitArabicTextCommands(part).forEach((piece) => {
      if (piece.type === "text") {
        segments.push(piece);
        return;
      }
      segments.push(...splitLooseCandidate(piece.value));
    });
  };

  while ((match = explicitRegex.exec(text)) !== null) {
    if (match.index > cursor) {
      pushLooseText(text.slice(cursor, match.index));
    }

    const inside = match[0].slice(2, -2);
    if (ARABIC_RE.test(inside)) {
      pushLooseText(inside);
    } else {
      segments.push({
        type: match[0].startsWith("\\[") ? "display" : "inline",
        value: match[0],
      });
    }

    cursor = explicitRegex.lastIndex;
  }

  if (cursor < text.length) {
    pushLooseText(text.slice(cursor));
  }

  return mergeAdjacentSegments(segments);
}

function MathText({ children, className = "", block = false }) {
  const segments = splitMathSegments(children);

  if (!segments.some((segment) => String(segment?.value ?? "").trim())) {
    return null;
  }

  const Tag = block ? "div" : "span";

  /*
   * الحل الصحيح للنص المختلط عربي + LaTeX:
   * 1) لا نرسل الجملة العربية كاملة إلى MathJax، لأن MathJax قد يعامل
   *    الحروف العربية كرموز رياضية فتظهر متقطعة أو معكوسة.
   * 2) لا نستعمل unicodeBidi: plaintext على الحاوية، لأنه قد يغيّر
   *    ترتيب المقاطع العربية والرياضية.
   * 3) كل معادلة توضع داخل bdi مستقل باتجاه LTR، بينما النص العربي
   *    يبقى RTL. بهذا نحافظ على ترتيب الجملة وعلى اتصال الحروف العربية.
   */
  return (
    <Tag
      dir="rtl"
      className={cn(
        "math-content text-right",
        block
          ? "block w-full max-w-full whitespace-pre-wrap break-words leading-[2.4rem]"
          : "inline whitespace-pre-wrap break-words",
        className
      )}
      style={{
        direction: "rtl",
        unicodeBidi: "isolate",
        textAlign: "right",
        overflowWrap: "anywhere",
      }}
    >
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return (
            <span
              key={`text-${index}`}
              dir="rtl"
              style={{
                direction: "rtl",
                unicodeBidi: "isolate",
              }}
            >
              {segment.value}
            </span>
          );
        }

        const isDisplay = segment.type === "display";

        return (
          <bdi
            key={`math-${index}`}
            dir="ltr"
            className={cn(
              isDisplay
                ? "my-4 block w-full max-w-full overflow-x-auto py-1 text-center"
                : "mx-1 inline-block max-w-full align-middle"
            )}
            style={{
              direction: "ltr",
              unicodeBidi: "isolate",
            }}
          >
            <MathJax dynamic hideUntilTypeset="first" inline={!isDisplay}>
              <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate" }}>
                {segment.value}
              </span>
            </MathJax>
          </bdi>
        );
      })}
    </Tag>
  );
}


function MathLTR({ children, className = "", block = false }) {
  const raw = normalizeEscapedLatex(children);
  if (!String(raw ?? "").trim()) return null;

  const Tag = block ? "div" : "span";
  const alreadyWrapped =
    raw.startsWith("\\(") ||
    raw.startsWith("\\[") ||
    raw.startsWith("$$");

  const content = alreadyWrapped
    ? raw
    : block
      ? `\\[${raw}\\]`
      : `\\(${raw}\\)`;

  return (
    <Tag
      dir="ltr"
      className={cn(
        block
          ? "block w-full overflow-x-auto text-center"
          : "inline-block align-middle",
        className
      )}
      style={{
        direction: "ltr",
        unicodeBidi: "isolate",
        textAlign: block ? "center" : "inherit",
      }}
    >
      <MathJax dynamic hideUntilTypeset="first" inline={!block}>
        <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate" }}>
          {content}
        </span>
      </MathJax>
    </Tag>
  );
}

function getErrorMessage(error, action = "تحميل التمارين") {
  if (error?.response?.status === 401) {
    return "انتهت صلاحية تسجيل الدخول. سجّل الدخول من جديد.";
  }

  if (error?.response?.status === 404) {
    return "لم يتم العثور على تمارين هذا الفصل.";
  }

  if (error?.response?.status >= 500) {
    return `حدث خطأ في الخادم أثناء ${action}.`;
  }

  if (error?.code === "ERR_NETWORK") {
    return "تعذر الاتصال بالخادم. تأكد من تشغيل Django ومن إعدادات CORS.";
  }

  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    `حدث خطأ أثناء ${action}.`
  );
}

function parseAIResponse(value) {
  if (!value) return null;

  if (typeof value === "object") {
    return value.answer && typeof value.answer === "object"
      ? value.answer
      : value.data && typeof value.data === "object"
        ? value.data
        : value;
  }

  const clean = String(value)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(clean);
  } catch {
    return { detailed_explanation: clean };
  }
}

function questionKey(exercise, question, index) {
  return `${exercise?.id ?? exercise?.code ?? "exercise"}-${
    question?.id ?? index
  }`;
}

function getExerciseStatementGraph(exercise) {
  return (
    exercise?.statement_graph_data ||
    exercise?.content?.statement_graph_data ||
    null
  );
}

function getQuestionStatementGraph(question) {
  return (
    question?.statement_graph_data ||
    question?.content?.statement_graph_data ||
    null
  );
}

function getSolutionGraph(solution) {
  return solution?.graph_data || solution?.graph || null;
}

function getQuestionTable(question) {
  return (
    question?.table_data ||
    question?.table ||
    null
  );
}

export default function BacChapterExercises({ chapterId = 1 }) {
  const { token } = useContext(UserContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  const [showFullSolution, setShowFullSolution] = useState(false);
  const [stepExplanations, setStepExplanations] = useState({});
  const [visibleStepExplanations, setVisibleStepExplanations] = useState({});
  const [loadingStepKey, setLoadingStepKey] = useState(null);
  const [stepErrors, setStepErrors] = useState({});
  const [stepHistories, setStepHistories] = useState({});
  const [loadingSavedExplanations, setLoadingSavedExplanations] = useState(false);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get(
        `${API_BASE_URL}/api/bac/exercises/chapter/${chapterId}/`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );
      console.log("exercice bac")
      console.log(response.data)
      setData(response.data);
      setCurrentExerciseIndex(0);
      setShowFullSolution(false);
    } catch (requestError) {
      console.error("Bac chapter exercises error:", requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, [chapterId, token]);

  const allExercises = useMemo(
    () =>
      asArray(data?.exercises).filter(
        (exercise) => exercise?.is_active !== false
      ),
    [data]
  );

  const branches = useMemo(() => {
    const branchMap = new Map();

    allExercises.forEach((exercise) => {
      getExerciseBranches(exercise).forEach((branch) => {
        if (!branchMap.has(branch.code)) {
          branchMap.set(branch.code, branch);
        }
      });
    });

    return [...branchMap.values()].sort((branchA, branchB) =>
      branchA.name.localeCompare(branchB.name, "ar")
    );
  }, [allExercises]);

  const branchFilteredExercises = useMemo(
    () =>
      allExercises.filter((exercise) =>
        exerciseBelongsToBranch(exercise, selectedBranch)
      ),
    [allExercises, selectedBranch]
  );

  const years = useMemo(
    () =>
      [
        ...new Set(
          branchFilteredExercises
            .map((exercise) => exercise?.year)
            .filter(Boolean)
        ),
      ].sort((a, b) => b - a),
    [branchFilteredExercises]
  );

  const exercises = useMemo(() => {
    if (selectedYear === "all") return branchFilteredExercises;

    return branchFilteredExercises.filter(
      (exercise) => String(exercise?.year) === String(selectedYear)
    );
  }, [branchFilteredExercises, selectedYear]);

  useEffect(() => {
    if (
      selectedYear !== "all" &&
      !years.some((year) => String(year) === String(selectedYear))
    ) {
      setSelectedYear("all");
    }
  }, [selectedBranch, selectedYear, years]);

  useEffect(() => {
    setCurrentExerciseIndex(0);
    setShowFullSolution(false);
  }, [selectedBranch, selectedYear]);

  const currentExercise = exercises[currentExerciseIndex] || null;
  const questions = asArray(currentExercise?.questions);

  const goPrevious = () => {
    setCurrentExerciseIndex((previous) => Math.max(previous - 1, 0));
    setShowFullSolution(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    setCurrentExerciseIndex((previous) =>
      Math.min(previous + 1, exercises.length - 1)
    );
    setShowFullSolution(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fetchSavedExplanations = async (exerciseId) => {
    if (!token || !exerciseId) {
      setStepExplanations({});
      setVisibleStepExplanations({});
      setStepHistories({});
      return;
    }

    try {
      setLoadingSavedExplanations(true);

      const response = await axios.get(
        STEP_REEXPLANATION_URL,
        {
          params: {
            exercise_id: Number(exerciseId),
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        }
      );

      const savedItems = asArray(response.data?.explanations);
      const explanationsMap = {};
      const historiesMap = {};
      const visibleMap = {};

      savedItems.forEach((item) => {
        const key = `${item.exercise_id}-${item.question_id}-${item.step_number}`;

        if (!historiesMap[key]) {
          historiesMap[key] = [];
        }

        historiesMap[key].push(item);

        if (!explanationsMap[key] && item?.explanation) {
          explanationsMap[key] = item.explanation;
          visibleMap[key] = false;
        }
      });

      setStepExplanations(explanationsMap);
      setStepHistories(historiesMap);
      setVisibleStepExplanations(visibleMap);
    } catch (requestError) {
      console.error("Saved explanations error:", requestError);

      if (requestError?.response?.status !== 404) {
        setStepErrors((previous) => ({
          ...previous,
          __history__: getErrorMessage(
            requestError,
            "تحميل الشروحات المحفوظة"
          ),
        }));
      }
    } finally {
      setLoadingSavedExplanations(false);
    }
  };

  useEffect(() => {
    if (currentExercise?.id) {
      fetchSavedExplanations(currentExercise.id);
    }
  }, [currentExercise?.id, token]);

  const handleStepReExplanation = async (
    exercise,
    question,
    questionIndex,
    step,
    stepIndex,
    forceRegenerate = false
  ) => {
    const questionPart = question?.id ?? questionIndex;
    const stepPart = step?.step_number ?? stepIndex + 1;
    const key = `${exercise?.id}-${questionPart}-${stepPart}`;
    const existing = stepExplanations[key];

    if (!forceRegenerate && existing) {
      setVisibleStepExplanations((previous) => ({
        ...previous,
        [key]: !previous[key],
      }));
      return;
    }

    if (!token) {
      setStepErrors((previous) => ({
        ...previous,
        [key]: "يجب تسجيل الدخول للحصول على شرح مبسط.",
      }));
      return;
    }

    try {
      setLoadingStepKey(key);

      setStepErrors((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });

      const response = await axios.post(
        STEP_REEXPLANATION_URL,
        {
          exercise_id: Number(exercise?.id),
          question_id: String(question?.id ?? ""),
          step_number: Number(stepPart),
          request_type: "very_simple",
          force_regenerate: Boolean(forceRegenerate),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 120000,
        }
      );

      const parsed = parseAIResponse(
        response.data?.explanation ?? response.data
      );

      if (!parsed) {
        throw new Error("EMPTY_AI_RESPONSE");
      }

      setStepExplanations((previous) => ({
        ...previous,
        [key]: parsed,
      }));

      const responseHistory = asArray(response.data?.history);

      if (responseHistory.length > 0) {
        setStepHistories((previous) => ({
          ...previous,
          [key]: responseHistory,
        }));
      } else if (response.data?.history_id) {
        const createdItem = {
          id: response.data.history_id,
          exercise_id: Number(exercise?.id),
          question_id: String(question?.id ?? ""),
          step_number: Number(stepPart),
          explanation: parsed,
          model: response.data?.model || "",
          created_at: response.data?.created_at || new Date().toISOString(),
        };

        setStepHistories((previous) => ({
          ...previous,
          [key]: [createdItem, ...asArray(previous[key])].slice(0, 3),
        }));
      }

      setVisibleStepExplanations((previous) => ({
        ...previous,
        [key]: true,
      }));
    } catch (requestError) {
      console.error("Step re-explanation error:", requestError);

      setStepErrors((previous) => ({
        ...previous,
        [key]: getErrorMessage(
          requestError,
          "إعادة شرح هذه الخطوة"
        ),
      }));
    } finally {
      setLoadingStepKey(null);
    }
  };

  const handleSelectSavedExplanation = (key, historyItem) => {
    if (!key || !historyItem?.explanation) return;

    setStepExplanations((previous) => ({
      ...previous,
      [key]: historyItem.explanation,
    }));

    setVisibleStepExplanations((previous) => ({
      ...previous,
      [key]: true,
    }));
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchExercises} />;

  if (allExercises.length === 0) {
    return (
      <EmptyState
        title="لا توجد تمارين"
        description="لا توجد تمارين بكالوريا مضافة إلى هذا الفصل حاليا."
      />
    );
  }

  return (
    <MathJaxContext version={3} config={MATHJAX_CONFIG}>
      <section
        dir="rtl"
        className="min-h-screen bg-slate-100 px-3 py-5 sm:px-5 lg:px-8"
      >
      <div className="mx-auto max-w-6xl space-y-5">
        <ChapterHeader
          chapter={data?.chapter}
          count={exercises.length}
          totalCount={allExercises.length}
          years={years}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
        />

        <BranchSelector
          branches={branches}
          exercises={allExercises}
          selectedBranch={selectedBranch}
          onBranchChange={setSelectedBranch}
        />

        {currentExercise ? (
          <>
            <ExerciseNavigation
              currentIndex={currentExerciseIndex}
              total={exercises.length}
              onPrevious={goPrevious}
              onNext={goNext}
            />

            <ExamPaper exercise={currentExercise} questions={questions} />

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowFullSolution((previous) => !previous)}
                className={cn(
                  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-black transition",
                  showFullSolution
                    ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    : "bg-blue-700 text-white shadow-md hover:bg-blue-800"
                )}
              >
                {showFullSolution ? <EyeOff size={19} /> : <Eye size={19} />}
                {showFullSolution
                  ? "إخفاء الحل النموذجي الكامل"
                  : "إظهار الحل النموذجي الكامل"}
              </button>
            </div>

            {showFullSolution && (
              <FullSolutionDocument
                exercise={currentExercise}
                questions={questions}
                stepExplanations={stepExplanations}
                visibleStepExplanations={visibleStepExplanations}
                loadingStepKey={loadingStepKey}
                stepErrors={stepErrors}
                stepHistories={stepHistories}
                loadingSavedExplanations={loadingSavedExplanations}
                onStepReExplanation={handleStepReExplanation}
                onSelectSavedExplanation={handleSelectSavedExplanation}
              />
            )}

            <ExerciseNavigation
              currentIndex={currentExerciseIndex}
              total={exercises.length}
              onPrevious={goPrevious}
              onNext={goNext}
            />
          </>
        ) : (
          <FilteredEmptyState
            onReset={() => {
              setSelectedBranch("all");
              setSelectedYear("all");
            }}
          />
        )}
        </div>
      </section>
    </MathJaxContext>
  );
}

function ChapterHeader({
  chapter,
  count,
  totalCount,
  years,
  selectedYear,
  onYearChange,
}) {
  return (
    <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-900 px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <GraduationCap size={27} />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-300">
                تمارين البكالوريا
              </p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                {chapter?.title || "تمارين الفصل"}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <HeaderBadge icon={<BookOpen size={16} />}>
              {count} تمرين معروض من أصل {totalCount}
            </HeaderBadge>

            {chapter?.code && (
              <HeaderBadge icon={<Hash size={16} />}>
                {chapter.code}
              </HeaderBadge>
            )}
          </div>
        </div>
      </div>

      {years.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4 sm:px-8">
          <span className="ml-2 text-sm font-black text-slate-600">
            السنة:
          </span>

          <YearButton
            active={selectedYear === "all"}
            onClick={() => onYearChange("all")}
          >
            الكل
          </YearButton>

          {years.map((year) => (
            <YearButton
              key={year}
              active={String(selectedYear) === String(year)}
              onClick={() => onYearChange(year)}
            >
              {year}
            </YearButton>
          ))}
        </div>
      )}
    </header>
  );
}

function BranchSelector({
  branches,
  exercises,
  selectedBranch,
  onBranchChange,
}) {
  const getCount = (branchCode) =>
    exercises.filter((exercise) =>
      exerciseBelongsToBranch(exercise, branchCode)
    ).length;

  if (branches.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-gradient-to-l from-blue-50 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm">
            <School size={21} />
          </span>
          <div>
            <h2 className="font-black text-slate-950">اختر الشعبة</h2>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              ستظهر فقط تمارين البكالوريا التابعة للشعبة المختارة
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        <BranchCard
          active={selectedBranch === "all"}
          name="كل الشعب"
          code="all"
          count={exercises.length}
          onClick={() => onBranchChange("all")}
        />

        {branches.map((branch) => (
          <BranchCard
            key={branch.code}
            active={selectedBranch === branch.code}
            name={branch.name || branch.code}
            code={branch.code}
            count={getCount(branch.code)}
            onClick={() => onBranchChange(branch.code)}
          />
        ))}
      </div>
    </section>
  );
}

function BranchCard({
  active,
  name,
  code,
  count,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 text-right transition duration-200",
        active
          ? "border-blue-600 bg-blue-700 text-white shadow-lg shadow-blue-200"
          : "border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            active
              ? "bg-white/15 text-white"
              : "bg-blue-50 text-blue-700"
          )}
        >
          <GraduationCap size={23} />
        </span>

        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-black",
            active
              ? "bg-white/15 text-white"
              : "bg-slate-100 text-slate-600"
          )}
        >
          {count} تمرين
        </span>
      </div>

      <h3 className="mt-4 text-base font-black">{name}</h3>
      <p
        dir="ltr"
        className={cn(
          "mt-1 text-left text-xs font-bold uppercase tracking-wide",
          active ? "text-blue-100" : "text-slate-400"
        )}
      >
        {code}
      </p>

      {active && (
        <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-blue-700">
          <CheckCircle2 size={16} />
        </span>
      )}
    </button>
  );
}

function FilteredEmptyState({ onReset }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <BookOpen size={27} />
      </div>
      <h2 className="mt-4 text-lg font-black text-slate-950">
        لا توجد تمارين بهذه التصفية
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-7 text-slate-500">
        غيّر الشعبة أو السنة لعرض التمارين المتاحة.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
      >
        <RefreshCcw size={17} />
        عرض كل التمارين
      </button>
    </div>
  );
}

function HeaderBadge({ icon, children }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-black">
      {icon}
      {children}
    </div>
  );
}

function YearButton({ active, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-black transition",
        active
          ? "bg-blue-700 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function ExerciseNavigation({
  currentIndex,
  total,
  onPrevious,
  onNext,
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight size={18} />
        السابق
      </button>

      <div className="text-center">
        <p className="text-xs font-bold text-slate-500">التمرين</p>
        <p className="text-base font-black text-slate-900">
          {currentIndex + 1} / {total}
        </p>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex >= total - 1}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        التالي
        <ChevronLeft size={18} />
      </button>
    </div>
  );
}

function ExamPaper({ exercise, questions }) {
  const statementGraph = getExerciseStatementGraph(exercise);
  const statementSections = getExerciseStatementSections(exercise);
  const hasMainStatement = hasText(exercise?.statement);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)]">
      <div className="border-b-4 border-slate-900 bg-slate-50 px-5 py-5 sm:px-9">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500">
              الجمهورية الجزائرية الديمقراطية الشعبية
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
              {exercise?.title ||
                `التمرين رقم ${exercise?.exercise_number || ""}`}
            </h2>
          </div>

          <div className="space-y-1 text-sm font-bold text-slate-700 sm:text-left">
            {exercise?.year && (
              <p className="flex items-center gap-2 sm:justify-end">
                <CalendarDays size={16} />
                بكالوريا {exercise.year}
              </p>
            )}

            {exercise?.source_page && (
              <p className="flex items-center gap-2 sm:justify-end">
                <FileText size={16} />
                الصفحة {exercise.source_page}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-6 sm:px-9 sm:py-9">
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
            <FileText size={19} className="text-slate-700" />
            <h3 className="font-black text-slate-950">نص التمرين</h3>
          </div>

          <div className="space-y-5 px-4 py-5 sm:px-7 sm:py-7">
            {hasMainStatement ? (
              <MathText
                block
                className="text-[1.03rem] font-semibold leading-10 text-slate-950 sm:text-lg"
              >
                {exercise.statement}
              </MathText>
            ) : (
              statementSections.map((section, index) => (
                <div
                  key={section?.id ?? index}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-4"
                >
                  {hasText(section?.title) && (
                    <h4 className="mb-2 font-black text-slate-900">
                      {section.title}
                    </h4>
                  )}
                  <MathText
                    block
                    className="text-[1.03rem] font-semibold leading-10 text-slate-950 sm:text-lg"
                  >
                    {section?.text || section?.content}
                  </MathText>
                </div>
              ))
            )}

            {statementGraph && (
              <div className="pt-2">
                <CoordinateGraph graph={statementGraph} />
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/30">
          <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-3 sm:px-6">
            <BookOpen size={19} className="text-blue-700" />
            <h3 className="font-black text-blue-950">الأسئلة</h3>
          </div>

          <div className="space-y-4 px-4 py-5 sm:px-6">
            {questions.map((question, index) => {
              const graph = getQuestionStatementGraph(question);
              const table = getQuestionTable(question);

              return (
                <article
                  key={question?.id ?? index}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5"
                >
                  <MathText
                    block
                    className="text-[1.03rem] font-bold leading-10 text-slate-950 sm:text-lg"
                  >
                    {question?.text}
                  </MathText>

                  {graph && (
                    <div className="mt-5">
                      <CoordinateGraph graph={graph} />
                    </div>
                  )}

                  {table && (
                    <div className="mt-5">
                      <DataTable table={table} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </article>
  );
}

function FullSolutionDocument({
  exercise,
  questions,
  stepExplanations,
  visibleStepExplanations,
  loadingStepKey,
  stepErrors,
  stepHistories,
  loadingSavedExplanations,
  onStepReExplanation,
  onSelectSavedExplanation,
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-emerald-300 bg-white shadow-sm">
      <div className="border-b-2 border-emerald-700 bg-emerald-50 px-5 py-5 sm:px-9">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-emerald-700" size={27} />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
              التصحيح النموذجي
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
              الحل الكامل للتمرين
            </h2>
          </div>
        </div>
      </div>

      <div className="px-5 py-7 sm:px-10 sm:py-9">
        {questions.map((question, index) => {
          const key = questionKey(exercise, question, index);
          const solution = asObject(question?.solution);

          return (
            <section
              key={key}
              className={cn(
                "py-7 first:pt-0 last:pb-0",
                index > 0 && "border-t border-slate-300"
              )}
            >
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-4">
                <p className="mb-2 text-xs font-black text-blue-700">
                  حل السؤال
                </p>
                <MathText
                  block
                  className="text-base font-black leading-9 text-slate-950 sm:text-lg"
                >
                  {question?.text}
                </MathText>
              </div>

              <StoredSolution
                exercise={exercise}
                question={question}
                questionIndex={index}
                solution={solution}
                stepExplanations={stepExplanations}
                visibleStepExplanations={visibleStepExplanations}
                loadingStepKey={loadingStepKey}
                stepErrors={stepErrors}
                stepHistories={stepHistories}
                loadingSavedExplanations={loadingSavedExplanations}
                onStepReExplanation={onStepReExplanation}
                onSelectSavedExplanation={onSelectSavedExplanation}
              />
            </section>
          );
        })}
      </div>
    </article>
  );
}

function StoredSolution({
  exercise,
  question,
  questionIndex,
  solution,
  stepExplanations,
  visibleStepExplanations,
  loadingStepKey,
  stepErrors,
  stepHistories,
  loadingSavedExplanations,
  onStepReExplanation,
  onSelectSavedExplanation,
}) {
  const methodology = getMethodology(question, solution);
  const formalWriting = getFormalWriting(question, solution, methodology);
  const constructionValues = getConstructionValues(question, solution);
  const solutionTables = getSolutionTables(solution);
  const bacTemplate = normalizeStringList(
    methodology?.bac_template ||
      methodology?.steps ||
      methodology?.plan ||
      methodology?.method_steps
  );
  const steps = normalizeSteps(solution?.steps);
  const mistakes = normalizeStringList(solution?.common_mistakes);
  const hints = normalizeStringList(solution?.hints);
  const solutionGraph = getSolutionGraph(solution);

  const hasMethodology =
    Object.keys(methodology).length > 0 ||
    hasText(solution?.strategy);

  if (
    !hasMethodology &&
    steps.length === 0 &&
    !hasText(solution?.final_answer) &&
    !solutionGraph
  ) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
        <TriangleAlert className="mt-0.5 shrink-0" size={18} />
        لا يوجد حل محفوظ لهذا السؤال.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hasMethodology && (
        <MethodologyCard
          methodology={methodology}
          strategy={solution?.strategy}
          bacTemplate={bacTemplate}
          formalWriting={formalWriting}
        />
      )}

      {steps.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-3 sm:px-5">
            <Target size={19} className="text-slate-800" />
            <h3 className="text-base font-black text-slate-950">
              خطوات الحل والحساب
            </h3>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {steps.map((step, index) => (
              <SolutionStep
                key={step?.id ?? step?.step_number ?? index}
                exercise={exercise}
                question={question}
                questionIndex={questionIndex}
                step={step}
                stepIndex={index}
                fallbackNumber={index + 1}
                stepExplanations={stepExplanations}
                visibleStepExplanations={visibleStepExplanations}
                loadingStepKey={loadingStepKey}
                stepErrors={stepErrors}
                stepHistories={stepHistories}
                loadingSavedExplanations={loadingSavedExplanations}
                onStepReExplanation={onStepReExplanation}
                onSelectSavedExplanation={onSelectSavedExplanation}
              />
            ))}
          </div>
        </section>
      )}

      {constructionValues.length > 0 && (
        <ConstructionValuesCard values={constructionValues} />
      )}

      {hasText(solution?.conclusion) && (
        <PlainInfo
          icon={<CheckCircle2 size={18} />}
          title="الخلاصة"
          text={solution.conclusion}
        />
      )}

      {hasText(solution?.final_answer) && (
        <div className="overflow-hidden rounded-2xl border border-emerald-300 bg-emerald-50">
          <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-100/70 px-4 py-3">
            <CheckCircle2 size={19} className="text-emerald-800" />
            <h3 className="text-sm font-black text-emerald-900">
              النتيجة النهائية
            </h3>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <MathText block className="font-black leading-9 text-emerald-950">
              {solution.final_answer}
            </MathText>
          </div>
        </div>
      )}

      {hasText(solution?.verification) && (
        <PlainInfo
          icon={<CheckCircle2 size={18} />}
          title="التحقق من النتيجة"
          text={solution.verification}
        />
      )}

      {mistakes.length > 0 && (
        <PlainList
          icon={<TriangleAlert size={18} />}
          title="أخطاء شائعة يجب تجنبها"
          items={mistakes}
        />
      )}

      {hints.length > 0 && (
        <PlainList
          icon={<Lightbulb size={18} />}
          title="تلميحات منهجية"
          items={hints}
        />
      )}

      {solutionGraph && <CoordinateGraph graph={solutionGraph} />}

      {solutionTables.map((table, index) => (
        <SmartMathTable key={`solution-table-${index}`} table={table} />
      ))}
    </div>
  );
}

function MethodologyCard({
  methodology,
  strategy,
  bacTemplate,
  formalWriting,
}) {
  const goal = methodology?.goal || methodology?.objective || "";
  const method = methodology?.method || methodology?.idea || strategy || "";
  const reason =
    methodology?.why_this_method ||
    methodology?.reason ||
    methodology?.why ||
    "";
  const theorem =
    methodology?.used_theorem ||
    methodology?.theorem ||
    methodology?.rule ||
    "";

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/40">
      <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-100/60 px-4 py-3 sm:px-5">
        <Target size={19} className="text-blue-800" />
        <h3 className="font-black text-blue-950">منهجية الحل في البكالوريا</h3>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
        {hasText(goal) && (
          <MethodologyItem title="الهدف من السؤال" text={goal} />
        )}

        {hasText(method) && (
          <MethodologyItem title="الطريقة المستعملة" text={method} />
        )}

        {hasText(reason) && (
          <MethodologyItem title="لماذا نستعمل هذه الطريقة؟" text={reason} />
        )}

        {hasText(theorem) && (
          <MethodologyItem title="القانون أو المبرهنة" text={theorem} />
        )}

        {/* {bacTemplate.length > 0 && (
          <div className="md:col-span-2 rounded-xl border border-blue-100 bg-white px-4 py-4">
            <h4 className="mb-3 text-sm font-black text-blue-900">
              خطة الكتابة في ورقة البكالوريا
            </h4>
            <ol className="space-y-3">
              {bacTemplate.map((item, index) => (
                <li
                  key={index}
                  className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <MathText block className="font-semibold text-slate-800">
                    {item}
                  </MathText>
                </li>
              ))}
            </ol>
          </div>
        )} */}

        {formalWriting.length > 0 && (
          <MethodologyList
            icon={<PenLine size={18} />}
            title="الكتابة الرياضية النموذجية"
            items={formalWriting}
            tone="violet"
          />
        )}

      </div>
    </section>
  );
}

function MethodologyList({ icon, title, items, tone = "blue" }) {
  const tones = {
    blue: "border-blue-100 bg-white text-blue-900",
    violet: "border-violet-200 bg-violet-50/60 text-violet-950",
    amber: "border-amber-200 bg-amber-50/70 text-amber-950",
  };

  return (
    <div
      className={cn(
        "md:col-span-2 rounded-xl border px-4 py-4",
        tones[tone] || tones.blue
      )}
    >
      <h4 className="mb-3 flex items-center gap-2 text-sm font-black">
        {icon}
        {title}
      </h4>

      <ol className="space-y-3">
        {items.map((item, index) => (
          <li
            key={index}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-3"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
              {index + 1}
            </span>
            <MathText block className="font-semibold leading-8 text-slate-800">
              {item}
            </MathText>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ConstructionValuesCard({ values }) {
  if (values.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-200 bg-cyan-50/40">
      <div className="flex items-center gap-2 border-b border-cyan-200 bg-cyan-100/60 px-4 py-3 sm:px-5">
        <ListChecks size={19} className="text-cyan-900" />
        <h3 className="font-black text-cyan-950">
          القيم المستعملة في الإنشاء البياني
        </h3>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        {values.map((value, index) => {
          const item = asObject(value);
          const label =
            item?.label ||
            item?.name ||
            item?.term ||
            `القيمة ${index + 1}`;

          const rawValue =
            item?.value ??
            item?.y ??
            item?.result ??
            (typeof value === "string" || typeof value === "number"
              ? value
              : "");

          return (
            <div
              key={item?.id ?? index}
              className="rounded-xl border border-cyan-100 bg-white px-4 py-3"
            >
              <p className="mb-1 text-xs font-black text-cyan-800">{label}</p>
              <MathText block className="font-bold text-slate-900">
                {String(rawValue)}
              </MathText>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MethodologyItem({ title, text }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white px-4 py-4">
      <h4 className="mb-2 text-xs font-black text-blue-800">{title}</h4>
      <MathText block className="font-semibold leading-8 text-slate-800">
        {text}
      </MathText>
    </div>
  );
}

function SolutionStep({
  exercise,
  question,
  questionIndex,
  step,
  stepIndex,
  fallbackNumber,
  stepExplanations,
  visibleStepExplanations,
  loadingStepKey,
  stepErrors,
  stepHistories,
  loadingSavedExplanations,
  onStepReExplanation,
  onSelectSavedExplanation,
}) {
  const number = step?.step_number ?? fallbackNumber;
  const questionPart = question?.id ?? questionIndex;
  const key = `${exercise?.id}-${questionPart}-${number}`;
  const explanation = stepExplanations[key];
  const explanationVisible = Boolean(visibleStepExplanations[key]);
  const isLoading = loadingStepKey === key;
  const error = stepErrors[key];
  const history = asArray(stepHistories?.[key]);
  const calculations = normalizeStringList(
    step?.calculations ||
      step?.equations ||
      step?.calculation_steps ||
      step?.operations
  );
  const mainLatex =
    step?.latex ||
    step?.calculation ||
    step?.formula ||
    step?.equation ||
    "";

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-4 pr-12 shadow-sm">
      <span className="absolute right-3 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
        {number}
      </span>

      <div>
        {hasText(step?.title) && (
          <h4 className="mb-1 text-base font-black text-slate-950">
            {step.title}
          </h4>
        )}

        {hasText(step?.explanation) && (
          <MathText block className="font-medium text-slate-800">
            {step.explanation}
          </MathText>
        )}

        {hasText(mainLatex) && (
          <CalculationBox value={mainLatex} />
        )}

        {calculations.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-black text-slate-600">
              تفاصيل الحساب
            </p>
            {calculations.map((calculation, calculationIndex) => (
              <CalculationBox
                key={calculationIndex}
                value={calculation}
                order={calculationIndex + 1}
              />
            ))}
          </div>
        )}

        {hasText(step?.conclusion) && (
          <div className="mt-4 rounded-xl border-r-4 border-emerald-500 bg-emerald-50 px-4 py-3">
            <p className="mb-1 text-xs font-black text-emerald-800">
              استنتاج الخطوة
            </p>
            <MathText block className="font-bold text-emerald-950">
              {step.conclusion}
            </MathText>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              onStepReExplanation(
                exercise,
                question,
                questionIndex,
                step,
                stepIndex,
                false
              )
            }
            disabled={isLoading}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-800 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Sparkles size={15} />
            )}
            {explanation
              ? explanationVisible
                ? "إخفاء الشرح السهل"
                : "إظهار الشرح السهل"
              : "لم أفهم هذه الخطوة"}
          </button>

          {explanation && (
            <button
              type="button"
              onClick={() =>
                onStepReExplanation(
                  exercise,
                  question,
                  questionIndex,
                  step,
                  stepIndex,
                  true
                )
              }
              disabled={isLoading}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCcw size={14} />
              شرح آخر
            </button>
          )}
        </div>

        {loadingSavedExplanations && !explanation && (
          <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500">
            <Loader2 className="animate-spin" size={14} />
            جاري البحث عن شرح محفوظ لهذه الخطوة...
          </div>
        )}

        {history.length > 1 && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-black text-slate-700">
              الشروحات المحفوظة
            </p>

            <div className="flex flex-wrap gap-2">
              {history.map((item, historyIndex) => (
                <button
                  key={item?.id ?? historyIndex}
                  type="button"
                  onClick={() => onSelectSavedExplanation(key, item)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
                >
                  شرح {history.length - historyIndex}
                  {item?.created_at
                    ? ` - ${new Date(item.created_at).toLocaleDateString("ar-DZ")}`
                    : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
            <AlertCircle className="mt-0.5 shrink-0" size={17} />
            <span>{error}</span>
          </div>
        )}

        {explanationVisible && explanation && (
          <SimpleExplanation explanation={explanation} />
        )}
      </div>
    </div>
  );
}

function CalculationBox({ value, order = null }) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  const alreadyWrapped =
    normalized.startsWith("\\[") ||
    normalized.startsWith("\\(") ||
    normalized.startsWith("$$");

  const content = alreadyWrapped ? normalized : `\\[${normalized}\\]`;

  return (
    <div
      dir="ltr"
      className="relative overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center"
    >
      {order !== null && (
        <span className="absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-700 px-1.5 text-[10px] font-black text-white">
          {order}
        </span>
      )}
      <MathText block className="text-lg font-semibold text-slate-950">
        {content}
      </MathText>
    </div>
  );
}

function PlainInfo({ icon, title, text }) {
  return (
    <div className="border-r-4 border-slate-400 pr-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-black text-slate-800">
        {icon}
        {title}
      </h3>

      <MathText block className="font-medium text-slate-700">
        {text}
      </MathText>
    </div>
  );
}

function PlainList({ icon, title, items }) {
  return (
    <div className="border-r-4 border-amber-400 pr-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
        {icon}
        {title}
      </h3>

      <ul className="space-y-2 text-sm font-medium text-slate-700">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
            <MathText block>{String(item)}</MathText>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExplanationSection({ title, children, tone = "violet" }) {
  const toneClasses = {
    violet: "border-violet-200 bg-white/70 text-violet-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
  };

  return (
    <section className={cn("rounded-xl border px-4 py-4", toneClasses[tone])}>
      <h4 className="mb-2 text-sm font-black">{title}</h4>
      {children}
    </section>
  );
}

function SimpleExplanation({ explanation }) {
  const data = asObject(explanation);
  const steps = asArray(data?.steps);

  const mainText =
    data?.simple_explanation ||
    data?.detailed_explanation ||
    data?.explanation ||
    data?.answer ||
    "";

  const example = data?.example || data?.mini_example || "";
  const conclusion = data?.conclusion || data?.summary || "";

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-violet-200 bg-violet-50 shadow-sm">
      <div className="flex items-center gap-2 border-b border-violet-200 bg-violet-100/70 px-4 py-3 text-violet-950">
        <Sparkles size={19} />
        <h3 className="text-base font-black">شرح مبسط ومفصل</h3>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-5">
        {hasText(data?.title) && (
          <h4 className="text-lg font-black text-slate-950">
            {data.title}
          </h4>
        )}

        {hasText(mainText) && (
          <ExplanationSection title="الفكرة ببساطة">
            <MathText block className="font-medium text-slate-800">
              {mainText}
            </MathText>
          </ExplanationSection>
        )}

        {hasText(data?.why_we_do_this) && (
          <ExplanationSection title="لماذا نقوم بهذه الخطوة؟" tone="blue">
            <MathText block className="font-medium text-slate-800">
              {data.why_we_do_this}
            </MathText>
          </ExplanationSection>
        )}

        {steps.length > 0 && (
          <ExplanationSection title="الخطوات بالتفصيل">
            <ol className="space-y-4">
              {steps.map((item, index) => {
                const itemText =
                  typeof item === "string"
                    ? item
                    : item?.explanation || item?.text || item?.content || "";

                return (
                  <li
                    key={index}
                    className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3"
                  >
                    <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-violet-700 text-xs font-black text-white">
                      {index + 1}
                    </span>

                    <div className="min-w-0 rounded-xl border border-violet-100 bg-white px-4 py-3">
                      <MathText block className="font-medium text-slate-800">
                        {itemText}
                      </MathText>
                    </div>
                  </li>
                );
              })}
            </ol>
          </ExplanationSection>
        )}

        {hasText(example) && (
          <ExplanationSection title="مثال صغير مشابه" tone="amber">
            <MathText block className="font-medium text-slate-800">
              {example}
            </MathText>
          </ExplanationSection>
        )}

        {hasText(conclusion) && (
          <ExplanationSection title="الخلاصة" tone="emerald">
            <MathText block className="font-semibold text-slate-800">
              {conclusion}
            </MathText>
          </ExplanationSection>
        )}

        {hasText(data?.final_answer) && (
          <ExplanationSection title="النتيجة" tone="emerald">
            <MathText block className="font-black text-emerald-950">
              {data.final_answer}
            </MathText>
          </ExplanationSection>
        )}

        {hasText(data?.check_question) && (
          <ExplanationSection title="تحقق من فهمك" tone="blue">
            <MathText block className="font-semibold text-slate-800">
              {data.check_question}
            </MathText>
          </ExplanationSection>
        )}
      </div>
    </div>
  );
}

function CoordinateGraph({ graph }) {
  const series = asArray(graph?.series)
    .map((serie, index) => ({
      ...serie,
      id: serie?.id ?? `series-${index}`,
      data: asArray(serie?.data).filter(
        (point) =>
          Number.isFinite(Number(point?.x)) &&
          Number.isFinite(Number(point?.y))
      ),
    }))
    .filter((serie) => serie.data.length > 0);

  if (series.length === 0) return null;

  const allPoints = series.flatMap((serie) => serie.data);
  const configuredX = asArray(graph?.x_domain);
  const configuredY = asArray(graph?.y_domain);

  let minX =
    configuredX.length === 2
      ? Number(configuredX[0])
      : Math.min(...allPoints.map((point) => Number(point.x)));
  let maxX =
    configuredX.length === 2
      ? Number(configuredX[1])
      : Math.max(...allPoints.map((point) => Number(point.x)));
  let minY =
    configuredY.length === 2
      ? Number(configuredY[0])
      : Math.min(...allPoints.map((point) => Number(point.y)));
  let maxY =
    configuredY.length === 2
      ? Number(configuredY[1])
      : Math.max(...allPoints.map((point) => Number(point.y)));

  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }

  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  const xPadding = Math.max((maxX - minX) * 0.06, 0.25);
  const yPadding = Math.max((maxY - minY) * 0.06, 0.25);

  minX -= xPadding;
  maxX += xPadding;
  minY -= yPadding;
  maxY += yPadding;

  const width = 820;
  const height = 500;
  const margin = { top: 30, right: 45, bottom: 55, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const scaleX = (x) =>
    margin.left + ((Number(x) - minX) / (maxX - minX)) * plotWidth;

  const scaleY = (y) =>
    margin.top + ((maxY - Number(y)) / (maxY - minY)) * plotHeight;

  const xAxisY =
    minY <= 0 && maxY >= 0 ? scaleY(0) : scaleY(minY);
  const yAxisX =
    minX <= 0 && maxX >= 0 ? scaleX(0) : scaleX(minX);

  const ticks = 10;
  const xTicks = Array.from({ length: ticks + 1 }, (_, index) => {
    const value = minX + ((maxX - minX) * index) / ticks;
    return { value, position: scaleX(value) };
  });

  const yTicks = Array.from({ length: ticks + 1 }, (_, index) => {
    const value = minY + ((maxY - minY) * index) / ticks;
    return { value, position: scaleY(value) };
  });

  const palette = [
    "#1d4ed8",
    "#dc2626",
    "#059669",
    "#7c3aed",
    "#ea580c",
    "#0891b2",
  ];

  const formatTick = (value) => {
    const rounded = Math.abs(value) < 1e-10 ? 0 : value;
    return Number.isInteger(rounded)
      ? String(rounded)
      : Number(rounded.toFixed(2)).toString();
  };

  return (
    <figure className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
      {(hasText(graph?.title) || hasText(graph?.description)) && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
          {hasText(graph?.title) && (
            <h4 className="text-center text-base font-black text-slate-950 sm:text-lg">
              {graph.title}
            </h4>
          )}
          {hasText(graph?.description) && (
            <MathText block className="mt-2 text-center text-sm font-semibold text-slate-600">
              {graph.description}
            </MathText>
          )}
        </div>
      )}
      <div className="overflow-x-auto bg-white p-2 sm:p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="تمثيل بياني"
          className="h-auto min-w-[620px] w-full"
        >
          <defs>
            <marker
              id="axis-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#0f172a" />
            </marker>
          </defs>

          <rect
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotHeight}
            fill="#ffffff"
            stroke="#cbd5e1"
          />

          {graph?.show_grid !== false && xTicks.map((tick, index) => (
            <g key={`x-grid-${index}`}>
              <line
                x1={tick.position}
                y1={margin.top}
                x2={tick.position}
                y2={margin.top + plotHeight}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={tick.position}
                y={margin.top + plotHeight + 23}
                textAnchor="middle"
                fontSize="12"
                fill="#475569"
              >
                {formatTick(tick.value)}
              </text>
            </g>
          ))}

          {graph?.show_grid !== false && yTicks.map((tick, index) => (
            <g key={`y-grid-${index}`}>
              <line
                x1={margin.left}
                y1={tick.position}
                x2={margin.left + plotWidth}
                y2={tick.position}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={margin.left - 10}
                y={tick.position + 4}
                textAnchor="end"
                fontSize="12"
                fill="#475569"
              >
                {formatTick(tick.value)}
              </text>
            </g>
          ))}

          <line
            x1={margin.left}
            y1={xAxisY}
            x2={margin.left + plotWidth + 10}
            y2={xAxisY}
            stroke="#0f172a"
            strokeWidth="2"
            markerEnd="url(#axis-arrow)"
          />

          <line
            x1={yAxisX}
            y1={margin.top + plotHeight}
            x2={yAxisX}
            y2={margin.top - 10}
            stroke="#0f172a"
            strokeWidth="2"
            markerEnd="url(#axis-arrow)"
          />

          <text
            x={margin.left + plotWidth + 20}
            y={xAxisY + 5}
            fontSize="15"
            fontWeight="700"
            fill="#0f172a"
          >
            {graph?.x_label || "x"}
          </text>

          <text
            x={yAxisX + 10}
            y={margin.top - 14}
            fontSize="15"
            fontWeight="700"
            fill="#0f172a"
          >
            {graph?.y_label || "y"}
          </text>

          {series.map((serie, serieIndex) => {
            const color =
              serie?.color || palette[serieIndex % palette.length];

            const points = serie.data
              .map(
                (point) =>
                  `${scaleX(point.x)},${scaleY(point.y)}`
              )
              .join(" ");

            return (
              <g key={serie.id}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth={serie?.stroke_width || 3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={
                    serie?.type === "dashed" || serie?.dashed
                      ? "10 7"
                      : undefined
                  }
                />

                {(serie?.show_points || serie?.type === "points" || serie?.type === "scatter") &&
                  serie.data.map((point, pointIndex) => (
                    <circle
                      key={pointIndex}
                      cx={scaleX(point.x)}
                      cy={scaleY(point.y)}
                      r="4"
                      fill={color}
                    />
                  ))}
              </g>
            );
          })}

          {asArray(graph?.annotations).map((annotation, index) => {
            if (
              !Number.isFinite(Number(annotation?.x)) ||
              !Number.isFinite(Number(annotation?.y))
            ) {
              return null;
            }

            const x = scaleX(annotation.x);
            const y = scaleY(annotation.y);

            return (
              <g key={`annotation-${index}`}>
                <circle cx={x} cy={y} r="5" fill="#111827" />
                {hasText(annotation?.label) && (
                  <text
                    x={x + 10}
                    y={y - 10}
                    fontSize="13"
                    fontWeight="700"
                    fill="#111827"
                  >
                    {annotation.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <figcaption className="border-t border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap justify-center gap-4 text-sm font-bold text-slate-700">
          {series.map((serie, index) => (
            <span key={serie.id} className="inline-flex items-center gap-2">
              <span
                className="inline-block h-1 w-7 rounded"
                style={{
                  backgroundColor:
                    serie?.color || palette[index % palette.length],
                }}
              />
              {serie?.label || serie?.id}
            </span>
          ))}
        </div>

        {hasText(graph?.caption) && (
          <MathText block className="mt-3 text-center text-sm font-semibold text-slate-600">
            {graph.caption}
          </MathText>
        )}
      </figcaption>
    </figure>
  );
}


function isVariationTable(table) {
  const type = String(table?.type || table?.kind || table?.table_type || "")
    .toLowerCase();

  return (
    type.includes("variation") ||
    type.includes("تغير") ||
    Boolean(table?.variation_table) ||
    Boolean(table?.rows?.function?.directions) ||
    Boolean(table?.directions)
  );
}

function SmartMathTable({ table }) {
  if (!table) return null;
  return isVariationTable(table)
    ? <VariationTable table={table?.variation_table || table} />
    : <DataTable table={table} />;
}

function normalizeVariationTable(table) {
  const rows = asObject(table?.rows);
  const derivative = asObject(
    rows?.derivative ||
    rows?.["f'(x)"] ||
    table?.derivative ||
    table?.derivative_row
  );
  const fn = asObject(
    rows?.function ||
    rows?.["f(x)"] ||
    table?.function ||
    table?.function_row
  );

  const xValues = normalizeStringList(
    rows?.x ||
    table?.x_values ||
    table?.x ||
    table?.breakpoints ||
    table?.points
  );

  const signs = normalizeStringList(
    derivative?.signs ||
    derivative?.values ||
    table?.derivative_signs ||
    table?.signs
  );

  const directions = normalizeStringList(
    fn?.directions ||
    table?.directions ||
    table?.variation_directions
  ).map((value) => {
    const normalized = String(value).toLowerCase().trim();
    if (
      ["up", "increase", "increasing", "asc", "croissante", "متزايدة", "تزايد", "↗"].includes(normalized)
    ) {
      return "up";
    }
    if (
      ["down", "decrease", "decreasing", "desc", "décroissante", "متناقصة", "تناقص", "↘"].includes(normalized)
    ) {
      return "down";
    }
    return normalized.includes("down") || normalized.includes("تناقص")
      ? "down"
      : "up";
  });

  const functionValues = normalizeStringList(
    fn?.values ||
    table?.function_values ||
    table?.values ||
    table?.limits
  );

  const criticalValues = normalizeStringList(
    derivative?.critical_values ||
    derivative?.zeros ||
    table?.critical_values
  );

  const safeXValues =
    xValues.length >= 2
      ? xValues
      : functionValues.length >= 2
        ? functionValues.map((_, index) => String(index))
        : ["0", "+\\infty"];

  const intervalCount = Math.max(safeXValues.length - 1, 1);

  return {
    title: table?.title || "جدول تغيرات الدالة",
    functionName: table?.function_name || table?.functionName || "f",
    domain: table?.domain || table?.interval || "",
    xValues: safeXValues,
    signs: Array.from({ length: intervalCount }, (_, index) =>
      signs[index] ?? signs[0] ?? ""
    ),
    directions: Array.from({ length: intervalCount }, (_, index) =>
      directions[index] ?? directions[0] ?? "up"
    ),
    functionValues: Array.from(
      { length: safeXValues.length },
      (_, index) => functionValues[index] ?? ""
    ),
    criticalValues,
  };
}

function VariationArrow({ direction = "up", startLabel = "", endLabel = "", id }) {
  const isUp = direction !== "down";
  const yStart = isUp ? 76 : 24;
  const yEnd = isUp ? 24 : 76;
  const markerId = `variation-arrow-${id}`;

  return (
    <div
      dir="ltr"
      className="relative h-28 min-w-[150px] overflow-visible"
      style={{ direction: "ltr", unicodeBidi: "isolate" }}
    >
      {hasText(startLabel) && (
        <div className="absolute bottom-1 left-2 max-w-[42%] text-left text-sm font-bold text-slate-900">
          <MathLTR>{startLabel}</MathLTR>
        </div>
      )}

      {hasText(endLabel) && (
        <div className="absolute right-2 top-1 max-w-[42%] text-right text-sm font-bold text-slate-900">
          <MathLTR>{endLabel}</MathLTR>
        </div>
      )}

      <svg
        viewBox="0 0 240 100"
        preserveAspectRatio="none"
        className="absolute inset-x-5 top-3 h-[88px] w-[calc(100%-2.5rem)] overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
          </marker>
        </defs>

        <line
          x1="12"
          y1={yStart}
          x2="228"
          y2={yEnd}
          stroke="currentColor"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          markerEnd={`url(#${markerId})`}
        />
      </svg>
    </div>
  );
}

function VariationTable({ table }) {
  const data = normalizeVariationTable(table);
  const intervalCount = Math.max(data.xValues.length - 1, 1);

  /*
   * جدول التغيرات جدول رياضي، لذلك بنيته الداخلية LTR دائمًا:
   * الخانة الأولى للعناوين x و f'(x) و f(x)، ثم القيم من 0 إلى +∞.
   * لا نعتمد على اتجاه الصفحة RTL ولا على flex-row-reverse.
   */
  return (
    <figure
      dir="ltr"
      className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm"
      style={{ direction: "ltr", unicodeBidi: "isolate" }}
    >
      <figcaption
        dir="rtl"
        className="border-b border-slate-300 bg-slate-100 px-4 py-4 text-center font-black text-slate-950"
      >
        <span>جدول تغيرات الدالة </span>
        <MathLTR>{data.functionName}</MathLTR>
      </figcaption>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div
            className="grid border-b border-slate-300"
            style={{
              gridTemplateColumns: `120px repeat(${data.xValues.length}, minmax(150px, 1fr))`,
            }}
          >
            <VariationLabelCell value="x" />
            {data.xValues.map((value, index) => (
              <VariationValueCell key={`x-${index}`} value={value} />
            ))}
          </div>

          <div
            className="grid min-h-20 border-b border-slate-300"
            style={{
              gridTemplateColumns: `120px repeat(${intervalCount}, minmax(180px, 1fr))`,
            }}
          >
            <VariationLabelCell value="f'(x)" />
            {data.signs.map((sign, index) => (
              <VariationValueCell
                key={`sign-${index}`}
                value={sign}
                className="text-xl"
              />
            ))}
          </div>

          <div
            className="grid min-h-44"
            style={{
              gridTemplateColumns: `120px repeat(${intervalCount}, minmax(220px, 1fr))`,
            }}
          >
            <VariationLabelCell value="f(x)" />
            {data.directions.map((direction, index) => (
              <div
                key={`direction-${index}`}
                className="border-l border-slate-300 first:border-l-0"
              >
                <VariationArrow
                  id={`${index}-${data.functionName}`}
                  direction={direction}
                  startLabel={data.functionValues[index]}
                  endLabel={data.functionValues[index + 1]}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {hasText(data.domain) && (
        <div
          dir="rtl"
          className="flex items-center justify-center gap-2 border-t border-slate-300 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700"
        >
          <span>المجال:</span>
          <MathLTR>{data.domain}</MathLTR>
        </div>
      )}
    </figure>
  );
}

function VariationLabelCell({ value }) {
  return (
    <div className="flex min-h-20 items-center justify-center border-r border-slate-300 bg-slate-50 px-3 font-black text-slate-950">
      <MathLTR className="text-lg">{value}</MathLTR>
    </div>
  );
}

function VariationValueCell({ value, className = "" }) {
  return (
    <div className={cn(
      "flex min-h-20 items-center justify-center border-r border-slate-300 px-4 font-black text-slate-950 last:border-r-0",
      className
    )}>
      {hasText(String(value ?? "")) && <MathLTR>{String(value)}</MathLTR>}
    </div>
  );
}

function DataTable({ table }) {
  const headers = asArray(table?.headers);
  const rows = asArray(table?.rows || table?.data);

  if (headers.length === 0 && rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
      {hasText(table?.title) && (
        <div className="border-b border-slate-300 bg-slate-100 px-4 py-3 text-center font-black text-slate-900">
          <MathText>{table.title}</MathText>
        </div>
      )}
      <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border border-slate-400 text-center text-sm">
        {headers.length > 0 && (
          <thead className="bg-slate-100">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="border border-slate-400 px-4 py-3 font-black text-slate-900"
                >
                  <MathText>{String(header)}</MathText>
                </th>
              ))}
            </tr>
          </thead>
        )}

        <tbody>
          {rows.map((row, rowIndex) => {
            const cells = Array.isArray(row)
              ? row
              : Object.values(asObject(row));

            return (
              <tr key={rowIndex}>
                {cells.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border border-slate-400 px-4 py-3 font-semibold text-slate-800"
                  >
                    <MathText>{String(cell ?? "")}</MathText>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      dir="rtl"
      className="flex min-h-[420px] flex-col items-center justify-center gap-4"
    >
      <Loader2 className="animate-spin text-blue-700" size={42} />
      <p className="font-black text-slate-700">جاري تحميل التمارين...</p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div
      dir="rtl"
      className="mx-auto mt-10 max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-center"
    >
      <AlertCircle className="mx-auto text-red-600" size={40} />

      <h2 className="mt-3 text-lg font-black text-red-900">
        تعذر تحميل التمارين
      </h2>

      <p className="mt-2 font-medium leading-7 text-red-800">
        {message}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-3 text-sm font-black text-white hover:bg-red-800"
      >
        <RefreshCcw size={17} />
        إعادة المحاولة
      </button>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div
      dir="rtl"
      className="mx-auto mt-10 max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm"
    >
      <BookOpen className="mx-auto text-slate-400" size={46} />
      <h2 className="mt-4 text-xl font-black text-slate-900">{title}</h2>
      <p className="mt-2 font-medium leading-7 text-slate-600">
        {description}
      </p>
    </div>
  );
}