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

const RAW_API_BASE_URL = import.meta.env.VITE_BASE_URL || "";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");
// Les images référencées dans les JSON sont placées dans:
// public/images/<année>/exercise_<numéro>/...
//
// Exemple JSON:
// {
//   "type": "image",
//   "path": "images/2017/exercise_20/document_01.png"
// }
//
// import.meta.env.BASE_URL permet aussi de fonctionner si Vite est déployé
// sous un sous-chemin au lieu de "/".
const PUBLIC_BASE_URL = import.meta.env.BASE_URL || "/";
const RAW_DOCUMENT_BASE_URL =
  import.meta.env.VITE_BAC_DOCUMENT_BASE_URL ||
  (API_BASE_URL ? `${API_BASE_URL}/media/` : PUBLIC_BASE_URL);

function resolvePublicAssetPath(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // URL externe, data URL ou blob: on ne touche pas.
  if (/^(?:https?:)?\/\//i.test(raw) || /^(?:data|blob):/i.test(raw)) {
    return raw;
  }

  // Normalise les slashs Windows éventuels présents dans un JSON.
  const normalized = raw.replace(/\\+/g, "/");

  // Un chemin absolu "/images/..." doit rester absolu.
  if (normalized.startsWith("/")) {
    return normalized;
  }

  if (/^bac\//i.test(normalized)) {
    const documentBase = RAW_DOCUMENT_BASE_URL.endsWith("/")
      ? RAW_DOCUMENT_BASE_URL
      : `${RAW_DOCUMENT_BASE_URL}/`;
    return `${documentBase}${normalized.replace(/^\/+/, "")}`;
  }

  const base = PUBLIC_BASE_URL.endsWith("/")
    ? PUBLIC_BASE_URL
    : `${PUBLIC_BASE_URL}/`;

  return `${base}${normalized.replace(/^\/+/, "")}`;
}

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

function normalizeDocumentReferences(...candidates) {
  const seen = new Set();

  return candidates
    .flatMap((candidate) => asArray(candidate))
    .map((document, index) => {
      const item = asObject(document);
      const path = String(
        item.path || item.src || item.url || item.image_path || ""
      ).trim();

      if (!path) return null;

      return {
        ...item,
        id: item.id || `document_reference_${index + 1}`,
        type: "image",
        usage: "statement",
        placement: "statement",
        path,
        title: item.title || item.label || `الوثيقة ${index + 1}`,
      };
    })
    .filter((document) => {
      if (!document || seen.has(document.path)) return false;
      seen.add(document.path);
      return true;
    });
}

function normalizeGeneratedExercise(exercise, index = 0) {
  const item = asObject(exercise);
  const normalizedRaw = asObject(
    asObject(item.raw_ai_response).normalized_exercise
  );
  const documentReferences = normalizeDocumentReferences(
    item.document_references,
    normalizedRaw.document_references
  );

  const isGeneratedShape =
    hasText(item.question) &&
    !Array.isArray(item.questions) &&
    (
      Array.isArray(item.solution_steps) ||
      hasText(item.final_answer) ||
      hasText(item.exercise_type)
    );

  if (!isGeneratedShape) {
    return { ...item, document_references: documentReferences };
  }

  const generatedQuestion = {
    id: `generated-${item.id ?? index + 1}`,
    number: 1,
    display_order: 1,
    text: item.question,
    solution: {
      strategy:
        item.solution_strategy || normalizedRaw.solution_strategy || "",
      detailed_explanation:
        item.solution_explanation || normalizedRaw.solution_explanation || "",
      steps: asArray(item.solution_steps),
      final_answer: item.final_answer || "",
      verification: item.verification || "",
      common_mistakes:
        item.common_mistakes || normalizedRaw.common_mistakes || [],
      alternative_method:
        item.alternative_method || normalizedRaw.alternative_method || "",
      hints: asArray(item.hints),
    },
  };

  return {
    ...item,
    id: item.id ?? `generated-exercise-${index + 1}`,
    code: item.code || `generated-exercise-${item.id ?? index + 1}`,
    title: item.title || `التمرين المولد ${index + 1}`,
    statement: item.question,
    questions: [generatedQuestion],
    document_references: documentReferences,
    figures: normalizeGraphCollection(item.figures, documentReferences),
    is_generated: true,
    is_active: item.is_active !== false,
  };
}


function getChapterTitleFromCode(code) {
  const normalized = String(code ?? "").trim().toLowerCase();

  const titles = {
    limits_continuity: "النهايات والاستمرارية",
    derivatives: "الاشتقاقية ودراسة الدوال",
    functions: "الدوال",
    exponential_logarithmic_functions: "الدوال الأسية واللوغاريتمية",
    exponential_functions: "الدوال الأسية",
    logarithmic_functions: "الدوال اللوغاريتمية",
    exp_definition_properties: "الدالة الأسية: التعريف والخواص",
  };

  return titles[normalized] || "تمارين البكالوريا";
}

function normalizeAxisExercisePayload(payload) {
  const source = asObject(payload);

  // 1) Format API classique:
  // { chapter: {...}, exercises: [...] }
  if (Array.isArray(source.exercises)) {
    return {
      ...source,
      exercises: source.exercises.map((exercise, index) =>
        normalizeGeneratedExercise(exercise, index)
      ),
      chapter: source.chapter || {
        code: source.chapter_code || source.axis?.tag || "",
        title:
          source.title ||
          source.axis?.title ||
          getChapterTitleFromCode(source.chapter_code),
      },
    };
  }

  /*
   * 2) Structure BAC utilisée par les nouveaux fichiers de limites:
   *
   * {
   *   chapter_code: "limits_continuity",
   *   year: 2014,
   *   exercise_number: 4,
   *   title: "...",
   *   statement: "...",
   *   questions: [...]
   * }
   *
   * IMPORTANT:
   * source.questions appartient ici AU MÊME exercice.
   * On ne doit surtout pas transformer chaque question en exercice séparé.
   */
  const looksLikeSingleBacExercise =
    Array.isArray(source.questions) &&
    (
      source.year != null ||
      source.exercise_number != null ||
      hasText(source.statement) ||
      hasText(source.source_reference)
    );

  if (looksLikeSingleBacExercise) {
    const inheritedBranches =
      asArray(source.branches).length > 0
        ? source.branches
        : source.branch
          ? [source.branch]
          : [];

    const exerciseId =
      source.id ??
      source.code ??
      `${source.chapter_code || "bac"}-${source.year || "year"}-${source.exercise_number || 1}`;

    const exercise = {
      ...source,
      id: exerciseId,
      code: source.code || exerciseId,
      title:
        source.title ||
        `التمرين رقم ${source.exercise_number || 1}`,
      year: source.year ?? null,
      exercise_number: source.exercise_number ?? 1,
      source_page: source.source_page ?? null,
      source_pages: source.source_pages || [],
      source_reference: source.source_reference || "",
      is_active: source.is_active !== false,
      branches: inheritedBranches,
      branch_codes:
        source.branch_codes ||
        inheritedBranches
          .map((branch) =>
            typeof branch === "string" ? branch : branch?.code
          )
          .filter(Boolean),

      statement: source.statement || "",
      document_references: normalizeDocumentReferences(
        source.document_references,
        asObject(source.raw_ai_response).normalized_exercise?.document_references
      ),
      figures: normalizeGraphCollection(
        source.figures,
        normalizeDocumentReferences(
          source.document_references,
          asObject(source.raw_ai_response).normalized_exercise?.document_references
        )
      ),
      statement_sections: source.statement_sections || [],
      statement_graph_data: source.statement_graph_data ?? null,
      graph_data: source.graph_data ?? source.statement_graph_data ?? null,
      tables: source.tables || source.statement_tables || [],
      table_data: source.table_data ?? null,

      questions: source.questions.map((question, index) => ({
        ...question,
        number:
          question?.number ??
          question?.display_order ??
          index + 1,
        display_order:
          question?.display_order ??
          index + 1,
        text:
          question?.text ||
          question?.standalone_text ||
          "",
        axis_tags:
          question?.axis_tags ||
          source.axis_tags ||
          [],
      })),
    };

    return {
      ...source,
      chapter: source.chapter || {
        code: source.chapter_code || "",
        title:
          hasText(source.chapter_title) &&
          /[\u0600-\u06ff]/u.test(source.chapter_title)
            ? source.chapter_title
            : getChapterTitleFromCode(
                source.chapter_title || source.chapter_code
              ),
      },
      exercises: [exercise],
    };
  }

  /*
   * 3) Ancien format d'axe:
   * { title, tag, questions: [...] }
   * Chaque question représente ici un exercice autonome.
   */
  if (Array.isArray(source.questions)) {
    const exercises = source.questions.map((question, index) => ({
      id: question?.id ?? `${source.tag || "axis"}-${index + 1}`,
      code: question?.id ?? `${source.tag || "axis"}-${index + 1}`,
      title: question?.title || `التمرين ${index + 1}`,
      statement: question?.standalone_text || question?.text || "",
      year: question?.year ?? null,
      exercise_number: question?.number ?? index + 1,
      source_reference: question?.source_reference,
      is_active: question?.is_active !== false,
      branches:
        source?.branches ||
        question?.branches ||
        (source?.branch ? [source.branch] : []),
      graph_data: question?.graph_data,
      statement_graph_data: question?.graph_data,
      table_data: question?.table_data,
      tables: question?.tables || question?.statement_tables || [],
      data_table: question?.data_table,
      indicator_table: question?.indicator_table,
      questions: [
        {
          ...question,
          number: question?.number ?? index + 1,
          text: question?.text || question?.standalone_text || "",
        },
      ],
    }));

    return {
      ...source,
      chapter: source.chapter || {
        code: source.chapter_code || source.tag || "",
        title:
          source.title ||
          getChapterTitleFromCode(source.chapter_code || source.tag),
      },
      exercises,
    };
  }

  return source;
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
          : item?.hint ||
            item?.text ||
            item?.content ||
            item?.title ||
            item?.explanation ||
            item?.result ||
            ""
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

function flattenTableCandidates(...candidates) {
  return candidates
    .filter(Boolean)
    .flatMap((candidate) =>
      Array.isArray(candidate) ? candidate : [candidate]
    )
    .filter(Boolean);
}

function getSolutionTables(solution) {
  return flattenTableCandidates(
    solution?.tables,
    solution?.table,
    solution?.table_data,
    solution?.completed_table,
    solution?.progress_tables,
    solution?.progress_table,
    solution?.variation_table,
    solution?.variation_table_data,
    solution?.sign_table,
    solution?.sign_table_data
  );
}

function getExerciseStatementTables(exercise) {
  return flattenTableCandidates(
    exercise?.tables,
    exercise?.content?.tables,

    exercise?.statement_tables,
    exercise?.content?.statement_tables,

    exercise?.statement_table,
    exercise?.content?.statement_table,

    exercise?.data_table,
    exercise?.content?.data_table,

    exercise?.indicator_table,
    exercise?.content?.indicator_table,

    exercise?.table_data,
    exercise?.content?.table_data
  );
}

function normalizeStatementSectionForDedup(value) {
  return normalizeEscapedLatex(value)
    // \dfrac و \tfrac هما نفس \frac من ناحية المحتوى.
    .replace(/\\(?:dfrac|tfrac)/g, "\\frac")
    .replace(/\\(?:displaystyle|textstyle|scriptstyle)/g, "")
    // نحذف فقط أغلفة MathJax والمسافات وعلامات الوقف غير المؤثرة.
    .replace(/\\[()[\]]/g, "")
    .replace(/[.،؛:]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function getStatementSectionCore(value) {
  const text = normalizeDisplayText(value);
  if (!text) return "";

  /*
   * statement_sections من النوع definition يأتي غالبًا هكذا:
   *   \\(f(x)=...\\) على \\(I=...\\).
   * بينما نفس التعريف موجود أصلًا داخل statement.
   * نأخذ تعريف الدالة قبل كلمة "على" حتى نقارن جوهر المعلومة فقط.
   */
  const beforeDomain = text.split(/\s+على\s+/u)[0]?.trim() || text;

  const mathMatch = beforeDomain.match(
    /(?:\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\])/u
  );

  return (mathMatch?.[1] || mathMatch?.[2] || beforeDomain).trim();
}

function isStatementSectionDuplicate(section, statement) {
  const sectionText = section?.text || section?.content || "";
  if (!hasText(sectionText) || !hasText(statement)) return false;

  const statementKey = normalizeStatementSectionForDedup(statement);
  const sectionKey = normalizeStatementSectionForDedup(sectionText);
  const coreKey = normalizeStatementSectionForDedup(
    getStatementSectionCore(sectionText)
  );

  // تطابق كامل/احتواء مباشر.
  if (sectionKey.length >= 10 && statementKey.includes(sectionKey)) {
    return true;
  }

  // الحالة الأهم: نفس تعريف f(x)=... أو g(x)=... موجود في statement.
  if (coreKey.length >= 7 && statementKey.includes(coreKey)) {
    return true;
  }

  return false;
}

function getExerciseStatementSections(exercise) {
  const statement = String(exercise?.statement ?? "");

  return asArray(
    exercise?.statement_sections || exercise?.content?.statement_sections
  )
    .filter((section) => hasText(section?.text || section?.content))
    // لا نعرض section إذا كان يعيد معلومة موجودة أصلًا داخل statement.
    .filter((section) => !isStatementSectionDuplicate(section, statement));
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}


function getIndeterminateForm(value) {
  const text = normalizeEscapedLatex(value)
    .replace(/\s+/g, "")
    .replace(/\\left|\\right/g, "");

  const explicit = /حالةعدم(?:التعيين|تعيين)|شكلغيرمعين/.test(text);

  if (/0\s*\/\s*0|\\frac\{0\}\{0\}/.test(text)) {
    return { type: "zero_over_zero", label: "حالة عدم تعيين 0/0" };
  }

  if (
    /\\infty\s*\/\s*\\infty/.test(text) ||
    /\\frac\{[^{}]*\\infty[^{}]*\}\{[^{}]*\\infty[^{}]*\}/.test(text)
  ) {
    return { type: "infinity_over_infinity", label: "حالة عدم تعيين ∞/∞" };
  }

  if (
    /\\infty\s*-\s*\\infty/.test(text) ||
    /\+\\infty-\\infty/.test(text) ||
    /-\\infty\+\\infty/.test(text)
  ) {
    return { type: "infinity_minus_infinity", label: "حالة عدم تعيين ∞ − ∞" };
  }

  if (
    /0(?:\\times|\\cdot)\s*\\infty/.test(text) ||
    /\\infty(?:\\times|\\cdot)0/.test(text)
  ) {
    return { type: "zero_times_infinity", label: "حالة عدم تعيين 0 × ∞" };
  }

  if (explicit) {
    return { type: "generic", label: "حالة عدم تعيين" };
  }

  return null;
}

function getStepIndeterminateForm(step) {
  return getIndeterminateForm(
    [
      step?.title,
      step?.explanation,
      step?.latex,
      step?.calculation,
      step?.why,
      step?.result,
      step?.student_tip,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getSolutionIndeterminateForm(solution) {
  const stepForms = normalizeSteps(solution?.steps)
    .map(getStepIndeterminateForm)
    .filter(Boolean);

  if (stepForms.length > 0) return stepForms[0];

  return getIndeterminateForm(
    [
      solution?.strategy,
      solution?.main_idea,
      solution?.detailed_explanation,
      solution?.final_answer,
    ]
      .filter(Boolean)
      .join(" ")
  );
}



function normalizeDisplayText(value) {
  return normalizeEscapedLatex(value)
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isGenericQuestionText(value) {
  const text = normalizeDisplayText(value).replace(/[.،؛:]/g, "").trim();
  if (!text) return true;

  return [
    "المطلوب أجب عن جميع أسئلة التمرين المبينة في نص التمرين أعلاه",
    "أجب عن جميع أسئلة التمرين",
    "حل التمرين",
  ].includes(text);
}

function getVisibleQuestions(exercise, questions) {
  const list = asArray(questions);
  const statement = normalizeDisplayText(exercise?.statement);

  return list.filter((question) => {
    const text = normalizeDisplayText(question?.text);
    if (!text) return false;
    if (isGenericQuestionText(text)) return false;
    if (statement && text === statement) return false;
    return true;
  });
}

const ARABIC_SUBQUESTION_LETTERS = [
  "أ",
  "ب",
  "ج",
  "د",
  "هـ",
  "و",
  "ز",
  "ح",
  "ط",
  "ي",
];

const LATIN_TO_ARABIC_SUBQUESTION = {
  a: "أ",
  b: "ب",
  c: "ج",
  d: "د",
  e: "هـ",
  f: "و",
  g: "ز",
  h: "ح",
  i: "ط",
  j: "ي",
};

function normalizeQuestionNumber(value, fallbackNumber) {
  const raw = String(value ?? fallbackNumber ?? "").trim();
  const match = raw.match(/\d+/);
  return match ? match[0] : String(fallbackNumber ?? "");
}

function normalizeQuestionLabel(value) {
  return String(value ?? "")
    .trim()
    .replace(/[()]/g, "")
    .replace(/جـ/g, "ج")
    .replace(/\s*[-–—ـ.:)]\s*/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

/**
 * يستخرج ترقيم السؤال من بداية النص ويعيد النص بدون الترقيم.
 * يدعم أمثلة من ملفات البكالوريا المختلفة:
 * 1) ...
 * 1) أ- ...
 * (2) ب- ...
 * I-1) أ- ...
 * II-2) ...
 * أ- ...
 */
function extractQuestionPrefix(value) {
  const text = normalizeDisplayText(value);
  if (!text) return { label: "", text: "", hasPrefix: false };

  const arabicLetters = "أابتثجحخدذرزسشصضطظعغفقكلمنهوي";
  const patterns = [
    new RegExp(
      `^\\s*((?:I{1,3}|IV|V|VI{0,3}|IX|X))\\s*[-–—ـ.:)]\\s*(\\d+)?\\s*[)\\-–—ـ.:]*\\s*(?:(جـ|هـ|[${arabicLetters}])\\s*[-–—ـ.:)]\\s*)?`,
      "u"
    ),
    new RegExp(
      `^\\s*\\(?(\\d+)\\)?\\s*[)\\-–—ـ.:]*\\s*(?:(جـ|هـ|[${arabicLetters}])\\s*[-–—ـ.:)]\\s*)?`,
      "u"
    ),
    new RegExp(
      `^\\s*(جـ|هـ|[${arabicLetters}])\\s*[-–—ـ.:)]\\s*`,
      "u"
    ),
  ];

  for (let patternIndex = 0; patternIndex < patterns.length; patternIndex += 1) {
    const match = text.match(patterns[patternIndex]);
    if (!match || !match[0]) continue;

    let label = "";

    if (patternIndex === 0) {
      const roman = match[1] || "";
      const number = match[2] || "";
      const letter = match[3] || "";
      label = [roman, number, letter].filter(Boolean).join("-");
    } else if (patternIndex === 1) {
      const number = match[1] || "";
      const letter = match[2] || "";
      label = [number, letter].filter(Boolean).join("-");
    } else {
      label = match[1] || "";
    }

    const rest = text.slice(match[0].length).trim();

    // لا نعتبر الرقم جزءًا من ترقيم السؤال إذا ابتلع regex السطر كاملًا
    // أو لم يبق بعده نص فعلي.
    if (!rest) continue;

    return {
      label: normalizeQuestionLabel(label),
      text: rest,
      hasPrefix: true,
    };
  }

  return { label: "", text, hasPrefix: false };
}

function stripLeadingQuestionNumber(value, expectedNumber) {
  const text = normalizeDisplayText(value);
  if (!text) return "";

  const extracted = extractQuestionPrefix(text);
  if (extracted.hasPrefix) return extracted.text;

  const expected = normalizeQuestionNumber(expectedNumber, "");
  if (!expected) return text;

  const pattern = new RegExp(
    `^\\s*${expected}\\s*(?:[-–—ـ.)،:؛]|\\))\\s*`,
    "u"
  );

  return text.replace(pattern, "").trim();
}

function hasExplicitQuestionPrefix(value) {
  return extractQuestionPrefix(value).hasPrefix;
}

function getQuestionLabelFromId(question) {
  const id = String(question?.id ?? question?.question_id ?? "").trim();
  if (!id) return "";

  const qIndex = id.toLowerCase().lastIndexOf("_q");
  if (qIndex < 0) return "";

  const suffix = id.slice(qIndex + 2);
  const match = suffix.match(/^((?:I{1,3}|IV|V|VI{0,3}|IX|X))?(\d+)?([a-j])?$/i);
  if (!match) return "";

  const roman = match[1] || "";
  const number = match[2] || "";
  const letter = LATIN_TO_ARABIC_SUBQUESTION[String(match[3] || "").toLowerCase()] || "";

  return [roman, number, letter].filter(Boolean).join("-");
}

function getQuestionDisplayLabel(question, fallbackNumber) {
  // Atomic BAC JSON can provide the exact official label explicitly.
  if (hasText(String(question?.display_label ?? ""))) {
    return normalizeQuestionLabel(question.display_label);
  }

  const arabicPart = extractArabicNamedPartPrefix(question?.text);
  if (arabicPart.hasPrefix && arabicPart.section) {
    return [arabicPart.section, arabicPart.localLabel]
      .filter(Boolean)
      .join("-");
  }

  const explicit = extractQuestionPrefix(question?.text);
  if (explicit.hasPrefix && explicit.label) return explicit.label;

  const fromId = getQuestionLabelFromId(question);
  if (fromId) return fromId;

  return String(
    question?.number ??
      question?.display_order ??
      fallbackNumber ??
      ""
  ).trim();
}

function stripQuestionPreludeAlreadyInStatement(questionText, statementText) {
  const question = normalizeDisplayText(questionText);
  const statement = normalizeDisplayText(statementText);

  if (!question || !statement) return question;

  /*
   * بعض ملفات BAC تكرر تعريف الدالة داخل question.text رغم أن التعريف
   * موجود أصلًا في statement. نعرض التعريف مرة واحدة في نص التمرين،
   * ثم نعرض المطلوب فقط داخل قائمة الأسئلة.
   */
  const cueRegex =
    /(?:^|\n)(?=(?:احسب|أحسب|ادرس|أدرس|أنشئ|انشئ|ارسم|أرسم|برهن|أثبت|اثبت|بيّن|بين|استنتج|اكتب|أكتب|عين|عيّن|تحقق|علل|علّل|حل|حلّ|حدد|حدّد)\s*[:：]?)/u;

  const cueMatch = question.match(cueRegex);
  if (!cueMatch || cueMatch.index == null || cueMatch.index <= 0) {
    return question;
  }

  const prelude = question.slice(0, cueMatch.index).trim();
  const rest = question.slice(cueMatch.index).trim();
  if (!prelude || !rest) return question;

  const statementKey = normalizeStatementSectionForDedup(statement);
  const preludeKey = normalizeStatementSectionForDedup(prelude);

  if (preludeKey.length >= 12 && statementKey.includes(preludeKey)) {
    return rest;
  }

  return question;
}

function getQuestionDisplayText(question, fallbackNumber, exerciseStatement = "") {
  const text = normalizeDisplayText(question?.text);
  if (!text) return "";

  const arabicPart = extractArabicNamedPartPrefix(text);

  let withoutPrefix = "";

  if (arabicPart.hasPrefix) {
    withoutPrefix = arabicPart.text;
  } else {
    const extracted = extractQuestionPrefix(text);
    withoutPrefix = extracted.hasPrefix
      ? extracted.text
      : stripLeadingQuestionNumber(text, fallbackNumber);
  }

  return stripQuestionPreludeAlreadyInStatement(
    withoutPrefix,
    exerciseStatement
  );
}

function getQuestionSectionTitle(question) {
  return String(
    question?.section_title ||
      question?.section_label ||
      ""
  ).trim();
}

function getQuestionContextBefore(question) {
  return String(
    question?.context ||
      question?.context_before ||
      question?.prelude ||
      ""
  ).trim();
}

function getQuestionContextAfter(question) {
  return String(
    question?.context_after ||
      question?.post_context ||
      ""
  ).trim();
}


function isStandaloneDisplayMath(value) {
  const text = String(value ?? "").trim();
  return /^\\\[[\s\S]*\\\]$/u.test(text);
}

function unwrapDisplayMath(value) {
  const text = String(value ?? "").trim();
  return isStandaloneDisplayMath(text) ? text.slice(2, -2).trim() : text;
}

function isStandaloneArabicConnector(value) {
  return /^(?:و|أو|ثم)$/u.test(String(value ?? "").trim());
}

function isShortQuestionCue(value) {
  const text = String(value ?? "").trim();
  return /^(?:احسب|أحسب|عين|عيّن|استنتج|برهن|أثبت|اثبت|بيّن|بين|ادرس|أدرس|حل|حلّ|ارسم|أرسم|اكتب|أكتب|تحقق|علل|علّل)\s*[:：]?\s*$/u.test(
    text
  );
}

/**
 * عرض خاص لنص السؤال.
 *
 * السبب:
 * بعض ملفات BAC تحفظ السؤال هكذا:
 *
 * "احسب النهايتين:
 *  \[...\]
 *  و
 *  \[...\]"
 *
 * MathText العام يحافظ على \n باستعمال whitespace-pre-wrap، وهذا مناسب
 * للفقرات لكنه يصنع فراغات عمودية كبيرة داخل بطاقات الأسئلة.
 *
 * هنا نحول النص إلى كتل:
 * - شرح عربي عادي.
 * - صيغ مستقلة compact.
 * - الصيغ المتتالية تربط بـ "و" في صف مرن بدل أسطر متباعدة.
 */
function normalizeQuestionPromptForPaper(value) {
  let text = normalizeDisplayText(value);
  if (!text) return "";

  /*
   * بعض ملفات JSON تكتب السؤال هكذا:
   *
   * احسب:
   * \\[formula 1\\]
   * و
   * \\[formula 2\\]
   *
   * هذا مناسب كمصدر بيانات، لكنه إذا عُرض حرفيًا يصنع فراغات ضخمة.
   * داخل السؤال نحول display-math إلى inline-math، ثم نجمع الأسطر في
   * فقرة واحدة. MathJax يبقى مسؤولًا عن الصيغ، والعربية تبقى RTL.
   */
  text = text
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, inside) => `\\(${inside.trim()}\\)`)
    .replace(/\n+/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([،؛:.؟!])/g, "$1")
    .replace(/([،؛:])(?=[^\s])/g, "$1 ")
    .trim();

  return text;
}

function QuestionPromptText({ value }) {
  const text = normalizeQuestionPromptForPaper(value);
  if (!text) return null;

  return (
    <MathText
      block
      className="question-prompt font-semibold leading-[2.15rem] text-slate-950 sm:text-[1.03rem] sm:leading-[2.35rem]"
    >
      {text}
    </MathText>
  );
}

function normalizeQuestionMatchText(value) {
  const namedPart = extractArabicNamedPartPrefix(value);
  const extracted = extractQuestionPrefix(value);
  const source = namedPart.hasPrefix
    ? namedPart.text
    : extracted.hasPrefix
      ? extracted.text
      : normalizeDisplayText(value);

  return source
    .replace(/\\(?:left|right|displaystyle|textstyle)/g, "")
    .replace(/\\[()[\]]/g, "")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[“”"'`´]/g, "")
    .replace(/[(){}\[\]،؛:,.!?؟/\\|<>+=*^_\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const QUESTION_COMMAND_RE = /^(?:احسب|أحسب|ادرس|أدرس|أنشئ|انشئ|ارسم|أرسم|برهن|أثبت|اثبت|بيّن|بين|استنتج|اكتب|أكتب|عين|عيّن|تحقق|تأكد|شكل|شكّل|حل|حلّ|ناقش|علل|علّل|حدد|حدّد|أعط|اعط|أوجد|اوجد|قارن|استعمل|باستعمال|بقراءة|فسر|فسّر|أكمل|اكمل|استخرج|استنبط)(?:\s|$|[،:])/u;

function questionTextSimilarity(leftValue, rightValue) {
  const left = normalizeQuestionMatchText(leftValue);
  const right = normalizeQuestionMatchText(rightValue);

  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length >= 18 && right.includes(left)) return 0.96;
  if (right.length >= 18 && left.includes(right)) return 0.96;

  const leftTokens = new Set(left.split(/\s+/).filter((token) => token.length > 1));
  const rightTokens = new Set(right.split(/\s+/).filter((token) => token.length > 1));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let common = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) common += 1;
  });

  return common / Math.min(leftTokens.size, rightTokens.size);
}

function isEmbeddedQuestionLine(line, questions) {
  const raw = normalizeDisplayText(line);
  if (!raw) return false;

  // المعادلات والتعاريف الصرفة جزء من معطيات التمرين، ولا يجوز حذفها.
  if (/^(?:\\\[[\s\S]*\\\]|\\\([\s\S]*\\\))$/u.test(raw)) {
    return false;
  }

  const bulletMatch = raw.match(/^\s*[•▪◦\-–—]\s*(.+)$/u);
  const withoutBullet = bulletMatch?.[1]?.trim() || raw;
  const namedPart = extractArabicNamedPartPrefix(withoutBullet);
  const extracted = extractQuestionPrefix(withoutBullet);
  const body = namedPart.hasPrefix
    ? namedPart.text
    : extracted.hasPrefix
      ? extracted.text
      : withoutBullet;
  const startsWithCommand = QUESTION_COMMAND_RE.test(body);

  const similarities = asArray(questions).map((question) => {
    const candidate = question?.text || question?.standalone_text || "";
    if (!hasText(candidate)) return 0;

    return Math.max(
      questionTextSimilarity(raw, candidate),
      questionTextSimilarity(withoutBullet, candidate),
      questionTextSimilarity(body, candidate)
    );
  });

  const bestSimilarity =
    similarities.length > 0 ? Math.max(...similarities) : 0;

  /*
   * - سؤال مرقم/فرعي يبدأ بفعل تعليمة: نحذفه من statement.
   * - أسئلة مثل:
   *   "III- لتكن k... باستعمال مشتقة... عين..."
   *   أو "و) H الدالة... عين α وβ..."
   *   لا تبدأ مباشرة بفعل تعليمة، لكنها تطابق question.text تقريبًا.
   *   نحذفها من statement لأنها ستظهر كاملة من questions[].
   * - مقدمات الأقسام مثل "II- نعتبر الدالة g..." لا تطابق سؤالًا كاملًا،
   *   لذلك تبقى ظاهرة قبل الأسئلة.
   */
  if (bulletMatch || extracted.hasPrefix || namedPart.hasPrefix) {
    if (startsWithCommand) return true;
    if (bestSimilarity >= 0.86) return true;
    return false;
  }

  if (!startsWithCommand) {
    return false;
  }

  return bestSimilarity >= 0.93;
}

function normalizeArabicOrdinalExerciseWord(value) {
  return String(value ?? "")
    .trim()
    .replace(/[،,:：]/g, " ")
    .replace(/\s+/g, " ");
}

function isRedundantStatementHeading(line, exercise) {
  const text = normalizeArabicOrdinalExerciseWord(
    normalizeDisplayText(line)
  );
  if (!text) return false;

  /*
   * نحذف عنوان التمرين من جسم الورقة إذا كان موجودًا في أول statement،
   * سواء كُتب بالرقم أو بالترتيب العربي.
   */
  if (
    /^(?:التمرين|تمرين)\s+(?:رقم\s+)?(?:\d+|الأول|الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)\b.*(?:نقط|نقطة|نقاط)/u.test(
      text
    )
  ) {
    return true;
  }

  const number = String(exercise?.exercise_number ?? "").trim();
  if (!number) return false;

  return new RegExp(
    `^\\s*(?:التمرين|تمرين)\\s*(?:رقم\\s*)?${number}\\s*[:：-]?\\s*(?:\\([^)]*نقاط?[^)]*\\))?\\s*$`,
    "u"
  ).test(text);
}

/**
 * ملفات BAC القديمة تخزن أحيانًا الأسئلة مرتين:
 * - مرة داخل statement
 * - ومرة في questions[]
 *
 * هذا الدالة تبقي المعطيات والتعاريف والصيغ والوثائق في نص التمرين،
 * وتحذف فقط أسطر الأسئلة المكررة لأننا سنعرض questions[] بشكل منظم أسفلها.
 */


function getStatementWithoutExerciseHeading(exercise) {
  const raw = String(exercise?.statement ?? "").replace(/\r\n?/g, "\n");
  if (!raw.trim()) return "";

  const lines = raw.split("\n");
  const firstNonEmptyIndex = lines.findIndex((line) => hasText(line));

  if (
    firstNonEmptyIndex >= 0 &&
    isRedundantStatementHeading(lines[firstNonEmptyIndex], exercise)
  ) {
    lines.splice(firstNonEmptyIndex, 1);
  }

  return normalizeDisplayText(lines.join("\n"));
}

function getStatementQuestionCoverage(statement, questions) {
  const text = normalizeDisplayText(statement);
  const list = asArray(questions).filter((question) =>
    hasText(question?.text || question?.standalone_text)
  );

  if (!text || list.length === 0) return 0;

  const matched = list.filter((question) => {
    const candidate = question?.text || question?.standalone_text || "";
    const extracted = extractQuestionPrefix(candidate);
    const body = extracted.hasPrefix ? extracted.text : candidate;

    return (
      questionTextSimilarity(text, candidate) >= 0.62 ||
      questionTextSimilarity(text, body) >= 0.72
    );
  }).length;

  return matched / list.length;
}

/**
 * ملفات BAC المصدرية (schema 4.5-bac-source) تحفظ نص الورقة الرسمي كاملًا
 * داخل statement، بما في ذلك الأسئلة وترقيمها. في هذه الحالة أفضل تصميم
 * وأدق تصميم هو عرض statement نفسه كورقة الامتحان وعدم إعادة تركيب
 * الأسئلة من questions[]، لأن questions[] مخصص أساسًا لربط كل مطلب بحله.
 *
 * نستخدم نسبة تغطية بدل الاعتماد على schema_version فقط حتى يبقى الكود
 * متوافقًا مع الملفات القديمة والجديدة.
 */
function shouldRenderCanonicalSourceStatement(exercise, questions) {
  const statement = normalizeDisplayText(exercise?.statement);
  const list = asArray(questions);

  if (!statement || list.length < 2) return false;

  const schema = String(exercise?.schema_version || "").toLowerCase();
  const sourceFaithful =
    exercise?.source_reference?.source_faithful_statement === true ||
    exercise?.review_status?.statement_compared_with_original_pdf === true ||
    schema.includes("bac-source");

  const coverage = getStatementQuestionCoverage(statement, list);

  return sourceFaithful
    ? coverage >= 0.55
    : coverage >= 0.78;
}

function isPureDisplayMathStatementLine(value) {
  const text = normalizeDisplayText(value);
  if (!text) return false;

  return (
    /^\\\[[\s\S]*\\\]$/u.test(text) ||
    /^\\\([\s\S]*\\\)$/u.test(text)
  );
}

function isDefinitionLeadStatementLine(value) {
  const text = normalizeDisplayText(value);
  if (!text) return false;

  return /(?:لتكن|نعتبر|الدالة|الدالتان|المعرف(?:ة|تان)|كما يلي|كما يأتي|بـ|حيث|وليكن|التمثيلان البيانيان|في الشكل المرفق|الشكل المقابل)\s*[:：]?\s*$/u.test(
    text
  );
}

function statementLineIsQuestionContinuation(line, question) {
  const raw = normalizeDisplayText(line);
  const questionText = normalizeDisplayText(
    question?.text || question?.standalone_text || ""
  );

  if (!raw || !questionText) return false;

  const rawKey = normalizeQuestionMatchText(raw);
  const questionKey = normalizeQuestionMatchText(questionText);

  if (!rawKey || !questionKey) return false;

  if (rawKey.length >= 5 && questionKey.includes(rawKey)) {
    return true;
  }

  if (questionTextSimilarity(raw, questionText) >= 0.78) {
    return true;
  }

  if (
    /^(?:ثم|و\s|حيث|على المجال|استنتج|ثم\s+استنتج|فسر|فسّر|ثم\s+فسر|وفسر|ارسم|ثم\s+ارسم|معادلة|علما أن|نأخذ|يعطى|وتحقق|ثم تحقق)/u.test(
      raw
    )
  ) {
    const cueKey = normalizeQuestionMatchText(raw);
    return cueKey.length >= 5 && questionKey.includes(cueKey);
  }

  return false;
}

function findEmbeddedQuestionForStatementLine(line, questions) {
  const raw = normalizeDisplayText(line);
  if (!raw) return null;

  const bulletMatch = raw.match(/^\s*[•▪◦\-–—]\s*(.+)$/u);
  const withoutBullet = bulletMatch?.[1]?.trim() || raw;
  const namedPart = extractArabicNamedPartPrefix(withoutBullet);
  const extracted = extractQuestionPrefix(withoutBullet);
  const body = namedPart.hasPrefix
    ? namedPart.text
    : extracted.hasPrefix
      ? extracted.text
      : withoutBullet;

  const startsWithCommand = QUESTION_COMMAND_RE.test(body);

  let best = null;
  let bestScore = 0;

  asArray(questions).forEach((question) => {
    const candidate = question?.text || question?.standalone_text || "";
    if (!hasText(candidate)) return;

    const score = Math.max(
      questionTextSimilarity(raw, candidate),
      questionTextSimilarity(withoutBullet, candidate),
      questionTextSimilarity(body, candidate)
    );

    if (score > bestScore) {
      bestScore = score;
      best = question;
    }
  });

  if (bulletMatch || extracted.hasPrefix || namedPart.hasPrefix) {
    if (startsWithCommand && bestScore >= 0.34) return best;
    if (bestScore >= 0.82) return best;
    return null;
  }

  if (startsWithCommand && bestScore >= 0.88) {
    return best;
  }

  return null;
}

/**
 * ينظف statement من تكرار questions[] دون حذف تعريفات الدوال.
 * كما يحذف الأسطر التابعة للسؤال المكرر، مثل صيغة LaTeX التي تأتي
 * في السطر التالي بعد "أثبت أن:" أو "احسب:".
 */
function getStatementDisplayText(exercise, questions) {
  const raw = String(exercise?.statement ?? "").replace(/\r\n?/g, "\n");
  if (!raw.trim()) return "";

  const lines = raw.split("\n");
  const kept = [];

  let pendingQuestion = null;
  let previousNonEmptySourceLine = "";
  let blankAfterQuestion = 0;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      if (pendingQuestion) {
        blankAfterQuestion += 1;
        if (blankAfterQuestion > 1) pendingQuestion = null;
      }

      if (kept.length > 0 && kept[kept.length - 1] !== "") kept.push("");
      return;
    }

    if (index <= 1 && isRedundantStatementHeading(trimmed, exercise)) {
      previousNonEmptySourceLine = trimmed;
      return;
    }

    const matchedQuestion = findEmbeddedQuestionForStatementLine(
      trimmed,
      questions
    );

    if (matchedQuestion) {
      pendingQuestion = matchedQuestion;
      blankAfterQuestion = 0;
      previousNonEmptySourceLine = trimmed;
      return;
    }

    if (pendingQuestion) {
      const definitionContext =
        isDefinitionLeadStatementLine(previousNonEmptySourceLine);

      const belongsToRemovedQuestion =
        statementLineIsQuestionContinuation(trimmed, pendingQuestion);

      if (
        belongsToRemovedQuestion &&
        !(
          definitionContext &&
          isPureDisplayMathStatementLine(trimmed)
        )
      ) {
        previousNonEmptySourceLine = trimmed;
        blankAfterQuestion = 0;
        return;
      }

      pendingQuestion = null;
      blankAfterQuestion = 0;
    }

    kept.push(line);
    previousNonEmptySourceLine = trimmed;
  });

  while (kept[0] === "") kept.shift();
  while (kept[kept.length - 1] === "") kept.pop();

  const cleaned = normalizeDisplayText(kept.join("\n"));

  return hasText(cleaned)
    ? cleaned
    : normalizeDisplayText(exercise?.statement);
}

function getCleanExerciseTitle(exercise) {
  const fallback = `التمرين رقم ${exercise?.exercise_number || ""}`.trim();
  const title = normalizeDisplayText(exercise?.title);

  if (!title) return fallback;

  const number = String(exercise?.exercise_number ?? "").trim();
  if (!number) return title;

  // إذا كان العنوان نفسه مجرد "التمرين 1" أو "التمرين رقم 1"
  // نعرض صيغة واحدة موحدة فقط.
  const simpleExerciseTitle = new RegExp(
    `^\\s*التمرين\\s*(?:رقم\\s*)?${number}\\s*$`,
    "u"
  );

  if (simpleExerciseTitle.test(title)) {
    return `التمرين رقم ${number}`;
  }

  return title;
}


const ROMAN_SECTION_RE = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/i;

/*
 * بعض ملفات البكالوريا لا تستعمل I / II / III داخل questions[]،
 * بل تخزن النص بهذا الشكل:
 *   "الجزء الأول - 1) ..."
 *   "الجزء الثاني - 1 أ) ..."
 *
 * إذا لم نفهم هذا التركيب، يظهر رقم تسلسلي عام (1..12) إضافة إلى
 * "الجزء الأول - 1" داخل النص، فتبدو الورقة كقائمة تطبيق لا كورقة امتحان.
 *
 * نحول أسماء الأجزاء العربية إلى مفاتيح داخلية Roman فقط للتجميع،
 * مع الاحتفاظ بالعنوان العربي الأصلي عند العرض.
 */
const ARABIC_PART_META = {
  "الأول": { roman: "I", canonical: "الأول" },
  "الاول": { roman: "I", canonical: "الأول" },
  "الثاني": { roman: "II", canonical: "الثاني" },
  "الثالث": { roman: "III", canonical: "الثالث" },
  "الرابع": { roman: "IV", canonical: "الرابع" },
  "الخامس": { roman: "V", canonical: "الخامس" },
  "السادس": { roman: "VI", canonical: "السادس" },
  "السابع": { roman: "VII", canonical: "السابع" },
  "الثامن": { roman: "VIII", canonical: "الثامن" },
  "التاسع": { roman: "IX", canonical: "التاسع" },
  "العاشر": { roman: "X", canonical: "العاشر" },
};

const ARABIC_PART_ORDINALS_RE =
  "الأول|الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر";

function extractArabicNamedPartPrefix(value) {
  const text = normalizeDisplayText(value);
  if (!text) {
    return {
      hasPrefix: false,
      section: "",
      sectionLabel: "",
      localLabel: "",
      text: "",
    };
  }

  const pattern = new RegExp(
    `^\\s*[\\(\\[]?\\s*(?:الجزء|القسم)\\s+(${ARABIC_PART_ORDINALS_RE})\\s*(?:[-–—ـ.:：]|\\))\\s*(.*)$`,
    "u"
  );

  const match = text.match(pattern);
  if (!match) {
    return {
      hasPrefix: false,
      section: "",
      sectionLabel: "",
      localLabel: "",
      text,
    };
  }

  const ordinal = match[1];
  const meta = ARABIC_PART_META[ordinal];
  if (!meta) {
    return {
      hasPrefix: false,
      section: "",
      sectionLabel: "",
      localLabel: "",
      text,
    };
  }

  let remainder = normalizeDisplayText(match[2] || "");

  // بعض المصادر تكتب: "الجزء الثاني - (1) أ- ..."
  remainder = remainder.replace(/^\s*[\)\]]\s*/u, "").trim();

  const localPrefix = extractQuestionPrefix(remainder);

  return {
    hasPrefix: true,
    section: meta.roman,
    sectionLabel: `الجزء ${meta.canonical}`,
    localLabel: localPrefix.hasPrefix ? localPrefix.label : "",
    text: localPrefix.hasPrefix ? localPrefix.text : remainder,
  };
}

function extractOfficialExerciseHeading(exercise) {
  const rawStatement = String(exercise?.statement ?? "").replace(/\r\n?/g, "\n");
  const firstNonEmptyLine = rawStatement
    .split("\n")
    .map((line) => normalizeDisplayText(line))
    .find(Boolean);

  if (
    firstNonEmptyLine &&
    /^(?:التمرين|تمرين)\b/u.test(firstNonEmptyLine) &&
    /(?:نقط|نقطة|نقاط)/u.test(firstNonEmptyLine)
  ) {
    return firstNonEmptyLine;
  }

  return "";
}

function extractExercisePointsLabel(exercise) {
  const direct =
    exercise?.points ||
    exercise?.score ||
    exercise?.mark ||
    exercise?.total_points ||
    "";

  if (hasText(direct)) {
    const value = String(direct).trim();
    return /^\d+(?:[.,]\d+)?$/u.test(value)
      ? `${value.replace(",", ".")} نقاط`
      : value;
  }

  const sources = [
    extractOfficialExerciseHeading(exercise),
    exercise?.title,
    exercise?.statement,
  ];

  for (const source of sources) {
    const text = normalizeDisplayText(source);
    if (!text) continue;

    const match = text.match(
      /\(\s*(\d+(?:[.,]\d+)?)\s*(?:نقط|نقطة|نقاط)\s*\)/u
    );

    if (match?.[1]) {
      return `${match[1].replace(",", ".")} نقاط`;
    }
  }

  return "";
}

function parseQuestionLabelParts(label) {
  const normalized = normalizeQuestionLabel(label);
  if (!normalized) {
    return { raw: "", section: "", rest: "", parts: [] };
  }

  const parts = normalized.split("-").filter(Boolean);
  const section = ROMAN_SECTION_RE.test(parts[0] || "")
    ? String(parts[0]).toUpperCase()
    : "";

  return {
    raw: normalized,
    section,
    rest: section ? parts.slice(1).join("-") : normalized,
    parts,
  };
}

function getQuestionSection(question, fallbackNumber) {
  const label = getQuestionDisplayLabel(question, fallbackNumber);
  return parseQuestionLabelParts(label).section;
}

function hasRomanQuestionStructure(questions) {
  return asArray(questions).some((question, index) =>
    Boolean(getQuestionSection(question, index + 1))
  );
}


function splitStatementIntoRomanSections(statementText) {
  const text = String(statementText ?? "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");

  const introLines = [];
  const sections = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    current.text = normalizeDisplayText(current.lines.join("\n"));
    delete current.lines;
    sections.push(current);
    current = null;
  };

  lines.forEach((line) => {
    const trimmed = normalizeDisplayText(line);

    const arabicPart = extractArabicNamedPartPrefix(trimmed);

    if (arabicPart.hasPrefix && arabicPart.section) {
      flush();

      current = {
        section: arabicPart.section,
        sectionLabel: arabicPart.sectionLabel,
        lines: [],
      };

      if (hasText(arabicPart.text)) {
        current.lines.push(arabicPart.text);
      }
      return;
    }

    /*
     * نحافظ على شكل عنوان الجزء كما ورد في المصدر:
     * I) / II) / I- / II- / I. ...
     * بدل فرض "-" على جميع الملفات.
     */
    const match = trimmed.match(
      /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\s*([-–—ـ.:)])\s*(.*)$/i
    );

    if (match) {
      flush();

      current = {
        section: String(match[1]).toUpperCase(),
        sectionLabel: `${String(match[1]).toUpperCase()}${match[2]}`,
        lines: [],
      };

      if (hasText(match[3])) {
        current.lines.push(match[3]);
      }
      return;
    }

    if (current) {
      current.lines.push(line);
    } else {
      introLines.push(line);
    }
  });

  flush();

  return {
    intro: normalizeDisplayText(introLines.join("\n")),
    sections,
  };
}

function renderPaperQuestionLabel(label, fallbackNumber, romanMode = false) {
  const parts = parseQuestionLabelParts(label);

  if (!romanMode || !parts.section) {
    const raw = parts.raw || String(fallbackNumber ?? "").trim();
    if (!raw) return "";
    return /[)）.ـ:-]$/.test(raw) ? raw : `${raw})`;
  }

  if (!parts.rest) return "";

  const raw = parts.rest;
  return /[)）.ـ:-]$/.test(raw) ? raw : `${raw})`;
}


function parseSectionLocalQuestionLabel(label) {
  const parts = parseQuestionLabelParts(label);
  const rest = String(parts.rest || "").trim();

  if (!rest) {
    return { major: "", sub: "", raw: "" };
  }

  const match = rest.match(/^(\d+)(?:-(.+))?$/u);
  if (!match) {
    return { major: "", sub: "", raw: rest };
  }

  return {
    major: match[1] || "",
    sub: normalizeQuestionLabel(match[2] || ""),
    raw: rest,
  };
}

function getQuestionNamedSectionMeta(question) {
  const named = extractArabicNamedPartPrefix(question?.text);
  if (!named.hasPrefix || !named.section) return null;

  return {
    section: named.section,
    sectionLabel: named.sectionLabel,
  };
}

function questionExplanationKey(exercise, question, questionIndex) {
  const questionPart = question?.id ?? questionIndex;
  return `${exercise?.id ?? exercise?.code ?? "exercise"}-${questionPart}`;
}

function extractNumbers(value) {
  return String(value ?? "")
    .match(/-?\d+(?:[.,]\d+)?/g)
    ?.map((number) => number.replace(",", ".")) || [];
}

function looksLikeTableRow(line) {
  const numbers = extractNumbers(line);
  const hasKnownLabel = /(t\s*\(?min|V\s*[_ ]?H|V\s*[_ ]?O|x\s*\(|\[?H\s*2\s*O|n\s*\(|pH|mol|mL)/i.test(line);
  return numbers.length >= 3 && hasKnownLabel;
}

function parseLegacyTable(lines, startIndex) {
  const rows = [];
  let cursor = startIndex;

  while (cursor < lines.length && rows.length < 8) {
    const raw = lines[cursor].trim();
    if (!raw) {
      if (rows.length >= 2) break;
      cursor += 1;
      continue;
    }

    const numbers = extractNumbers(raw);
    if (!looksLikeTableRow(raw)) break;

    const firstNumberIndex = raw.search(/-?\d/);
    const label = firstNumberIndex >= 0
      ? raw.slice(0, firstNumberIndex).replace(/[()]/g, " ").trim()
      : `السطر ${rows.length + 1}`;

    rows.push({
      label: label || `السطر ${rows.length + 1}`,
      values: numbers,
    });
    cursor += 1;
  }

  if (rows.length < 2) return null;

  const columnCount = Math.max(...rows.map((row) => row.values.length));
  if (columnCount < 3) return null;

  return { rows, columnCount, nextIndex: cursor };
}

function LegacyTable({ parsedTable }) {
  const { rows, columnCount } = parsedTable;

  return (
    <div className="my-6 w-full overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-black text-slate-800">جدول المعطيات</p>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
          {columnCount} قيم
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <table dir="ltr" className="min-w-max w-full border-collapse text-center text-sm">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${row.label}-${rowIndex}`} className={rowIndex % 2 ? "bg-slate-50" : "bg-white"}>
                <th
                  dir="rtl"
                  className="sticky right-0 z-10 min-w-36 border border-slate-200 bg-slate-100 px-4 py-3 text-right font-black text-slate-800"
                >
                  <MathText>{row.label}</MathText>
                </th>
                {Array.from({ length: columnCount }).map((_, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="min-w-16 border border-slate-200 px-3 py-3 font-bold text-slate-800"
                  >
                    {row.values[columnIndex] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function countArabicCharacters(value) {
  return (String(value ?? "").match(/[\u0600-\u06ff]/g) || []).length;
}

function countLatinMathCharacters(value) {
  return (String(value ?? "").match(/[A-Za-z0-9=+\-−–—_^{}()[\]\\/]/g) || []).length;
}

function looksLikeFormulaFragment(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;

  const arabicCount = countArabicCharacters(raw);
  const mathCount = countLatinMathCharacters(raw);
  const chemicalSignals = (raw.match(/(?:COOH|COO|NH|CH|H_?\{?2\}?N|R(?:Met)?)/gi) || []).length;
  const operatorSignals = (raw.match(/(?:=|→|←|\+|\-|−|–|—|\\(?:frac|sqrt|lim|times|cdot|rightarrow|leftarrow))/g) || []).length;

  // الصيغ الكيميائية مثل:
  // H2N-CH(RMet)-CO-NH-CH(R)-COOH
  if (chemicalSignals >= 3 && mathCount >= 8) return true;

  // صيغة رياضية/علمية عامة طويلة نسبيًا.
  if (mathCount >= 10 && operatorSignals >= 1 && mathCount > arabicCount * 1.35) {
    return true;
  }

  return false;
}

function cleanFormulaEdge(value) {
  return String(value ?? "")
    .trim()
    .replace(/^[\s:：؛،•▪◦]+/u, "")
    .replace(/[\s:：؛،•▪◦]+$/u, "")
    .trim();
}

function splitExplanationAndFormula(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // نفصل فقط عند فاصل واضح إذا كان أحد الطرفين شرحًا عربيًا
  // والطرف الآخر صيغة رياضية/كيميائية. لا نغيّر النص العادي.
  const separatorMatch = raw.match(/[:：]/u);
  if (!separatorMatch || separatorMatch.index == null) return null;

  const index = separatorMatch.index;
  const left = raw.slice(0, index).trim();
  const right = raw.slice(index + separatorMatch[0].length).trim();

  if (!left || !right) return null;

  const leftFormula = looksLikeFormulaFragment(left);
  const rightFormula = looksLikeFormulaFragment(right);
  const leftArabic = countArabicCharacters(left) >= 3;
  const rightArabic = countArabicCharacters(right) >= 3;

  if (leftArabic && rightFormula) {
    return {
      explanation: left,
      formula: cleanFormulaEdge(right),
      formulaFirst: false,
    };
  }

  if (leftFormula && rightArabic) {
    return {
      explanation: right,
      formula: cleanFormulaEdge(left),
      formulaFirst: true,
    };
  }

  return null;
}

function StandaloneFormula({ value }) {
  const formula = cleanFormulaEdge(value);
  if (!formula) return null;

  /*
   * في ورقة البكالوريا لا نضع كل صيغة داخل Card أو خلفية رمادية.
   * الصيغة فقط تتمركز في السطر مع مسافة خفيفة كما في ورقة الامتحان.
   */
  return (
    <div
      dir="ltr"
      className="my-1.5 w-full min-w-0 overflow-x-auto px-1 text-center sm:my-2"
      style={{ direction: "ltr", unicodeBidi: "isolate" }}
    >
      <MathLTR
        block
        className="mx-auto min-w-max text-[1rem] font-semibold leading-7 text-slate-950 sm:text-[1.08rem]"
      >
        {formula}
      </MathLTR>
    </div>
  );
}

function StructuredRichLine({ value, showBullet = false }) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const mixed = splitExplanationAndFormula(raw);

  if (mixed) {
    return (
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-2">
          {showBullet && (
            <span className="mt-[0.95rem] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
          )}

          <div className="min-w-0 flex-1">
            <MathText
              block
              className="font-semibold leading-8 text-slate-950 sm:leading-9"
            >
              {mixed.explanation}
            </MathText>

            <StandaloneFormula value={mixed.formula} />
          </div>
        </div>
      </div>
    );
  }

  if (looksLikeFormulaFragment(raw) && countArabicCharacters(raw) <= 2) {
    return (
      <div className="min-w-0">
        {showBullet ? (
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-[1.25rem] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
            <div className="min-w-0 flex-1">
              <StandaloneFormula value={raw} />
            </div>
          </div>
        ) : (
          <StandaloneFormula value={raw} />
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-start gap-2">
      {showBullet && (
        <span className="mt-[1rem] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
      )}
      <MathText
        block
        className="min-w-0 flex-1 font-semibold leading-8 text-slate-950 sm:leading-9"
      >
        {raw}
      </MathText>
    </div>
  );
}

function RichExerciseText({ children, className = "" }) {
  const text = normalizeDisplayText(children);
  if (!text) return null;

  /*
   * معالجة خاصة للنص المختلط عربي + صيغ علمية طويلة:
   * - الشرح العربي يبقى RTL في سطر واضح.
   * - الصيغة الطويلة تصبح كتلة LTR مستقلة بدل أن تدخل وسط الجملة.
   * - عناصر • تعرض كسطور منفصلة حتى لا تتشابك اتجاهات الكتابة.
   * - لا يتم تغيير النص الأصلي أو محتواه، بل طريقة عرضه فقط.
   */
  const logicalLines = text
    .split("\n")
    .flatMap((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return [{ spacer: true, value: "", bullet: false }];
      }

      const bulletParts = trimmed
        .split(/\s*[•▪◦]\s*/u)
        .map((part) => part.trim())
        .filter(Boolean);

      if (bulletParts.length <= 1) {
        return [{ value: trimmed, bullet: false, spacer: false }];
      }

      return bulletParts.map((part) => ({
        value: part,
        bullet: true,
        spacer: false,
      }));
    })
    .filter((line, index, list) => {
      if (!line.spacer) return true;
      if (index === 0 || index === list.length - 1) return false;
      return !list[index - 1]?.spacer;
    });

  return (
    <div
      dir="rtl"
      className={cn(
        "min-w-0 space-y-1.5 whitespace-pre-wrap break-words text-right",
        className
      )}
      style={{ direction: "rtl", unicodeBidi: "isolate" }}
    >
      {logicalLines.map((line, index) =>
        line.spacer ? (
          <div
            key={`spacer-${index}`}
            className="h-2 sm:h-2.5"
            aria-hidden="true"
          />
        ) : (
          <StructuredRichLine
            key={`${index}-${line.value.slice(0, 30)}`}
            value={line.value}
            showBullet={line.bullet}
          />
        )
      )}
    </div>
  );
}


const BAC_STATEMENT_SECTION_WORDS = [
  "المعطيات",
  "تعطى",
  "يعطى",
  "المطلوب",
  "ملاحظة",
  "ملاحظة هامة",
  "أولا",
  "أولاً",
  "أولًا",
  "ثانيا",
  "ثانياً",
  "ثانيًا",
  "ثالثا",
  "ثالثاً",
  "ثالثًا",
  "رابعا",
  "رابعاً",
  "رابعًا",
  "خامسا",
  "خامساً",
  "خامسًا",
];

const BAC_STATEMENT_SECTION_PREFIX_RE = new RegExp(
  `^\\s*(${BAC_STATEMENT_SECTION_WORDS.join("|")})\\s*[:：]\\s*(.*)$`,
  "u"
);

const BAC_STATEMENT_SECTION_ONLY_RE = new RegExp(
  `^\\s*(?:${BAC_STATEMENT_SECTION_WORDS.join("|")})\\s*[:：]?\\s*$`,
  "u"
);

const BAC_ROMAN_SECTION_ONLY_RE =
  /^\s*(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\s*(?:[/\\.:：\-–—ـ])?\s*$/i;

const BAC_MARKDOWN_SEPARATOR_RE =
  /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/u;

function stripBacBulletPrefix(value) {
  return String(value ?? "")
    .replace(/^\s*[•▪◦●◆◇■□]\s*/u, "")
    .trim();
}

function isBacBulletLine(value) {
  return /^\s*[•▪◦●◆◇■□]\s+/u.test(String(value ?? ""));
}

function isBacMarkdownTableLine(value) {
  const text = String(value ?? "").trim();
  if (!text || !text.includes("|")) return false;
  return /^\|.*\|$/u.test(text) || text.split("|").length >= 3;
}

function parseBacMarkdownTable(lines) {
  const rows = asArray(lines)
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .filter((line) => !BAC_MARKDOWN_SEPARATOR_RE.test(line))
    .map((line) =>
      line
        .replace(/^\|/u, "")
        .replace(/\|$/u, "")
        .split("|")
        .map((cell) => cell.trim())
    )
    .filter((row) => row.length > 0);

  if (rows.length === 0) return null;

  const columnCount = Math.max(...rows.map((row) => row.length));
  if (columnCount < 2) return null;

  return { rows, columnCount };
}

function BacMarkdownTable({ lines }) {
  const table = parseBacMarkdownTable(lines);
  if (!table) return null;

  return (
    <div className="my-4 w-full overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm sm:my-5">
      <div className="w-full overflow-x-auto">
        <table className="min-w-full border-collapse text-center text-sm sm:text-[0.95rem]">
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr
                key={`bac-md-row-${rowIndex}`}
                className={rowIndex === 0 ? "bg-slate-100" : "bg-white"}
              >
                {Array.from({ length: table.columnCount }).map((_, columnIndex) => {
                  const cell = row[columnIndex] ?? "";
                  const Tag = rowIndex === 0 ? "th" : "td";

                  return (
                    <Tag
                      key={`bac-md-cell-${rowIndex}-${columnIndex}`}
                      className={cn(
                        "min-w-28 border border-slate-200 px-3 py-2.5 align-middle text-slate-900 sm:px-4 sm:py-3",
                        rowIndex === 0 ? "font-black" : "font-semibold"
                      )}
                    >
                      <MathText block className="leading-7 sm:leading-8">
                        {cell}
                      </MathText>
                    </Tag>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getBacStatementLinePrefix(value) {
  const text = normalizeDisplayText(value);
  if (!text) return null;

  /*
   * لا نعامل أي رقم في بداية السطر كسؤال تلقائيا.
   * يجب أن يظهر فاصل ترقيم واضح مثل 1) أو 2- أو (3)،
   * وإلا قد تتحول قيمة مثل 1000m إلى سؤال رقم 1000.
   */
  const hasExplicitNumericPrefix =
    /^\s*\(?\d+\)?\s*(?:[)\-–—ـ.:：]|\s+(?:جـ|هـ|[أ-ي])\s*[)\-–—ـ.:：])/u.test(
      text
    );
  const hasExplicitLetterPrefix =
    /^\s*(?:جـ|هـ|[أ-ي])\s*[)\-–—ـ.:：]\s*/u.test(text);
  const hasExplicitRomanPrefix =
    /^\s*(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\s*[)\-–—ـ.:：]\s*/iu.test(
      text
    );

  const namedPart = extractArabicNamedPartPrefix(text);
  if (namedPart.hasPrefix && namedPart.text) {
    const label = [namedPart.sectionLabel, namedPart.localLabel]
      .filter(Boolean)
      .join(" — ");

    return {
      label,
      text: namedPart.text,
      nested: Boolean(namedPart.localLabel),
    };
  }

  if (
    !hasExplicitNumericPrefix &&
    !hasExplicitLetterPrefix &&
    !hasExplicitRomanPrefix
  ) {
    return null;
  }

  const extracted = extractQuestionPrefix(text);
  if (!extracted.hasPrefix || !extracted.label || !extracted.text) {
    return null;
  }

  const label = normalizeQuestionLabel(extracted.label);
  const hasNumber = /\d/u.test(label);
  const onlyLetter = /^(?:جـ|هـ|[أ-ي])$/u.test(label);

  return {
    label,
    text: extracted.text,
    nested: onlyLetter || (!hasNumber && label.length <= 4),
  };
}

function tokenizeBacStatement(value) {
  const text = normalizeDisplayText(value);
  if (!text) return [];

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const tokens = [];
  let paragraphLines = [];
  let displayMathLines = null;
  let tableLines = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const paragraph = paragraphLines
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+([،؛:.؟!])/gu, "$1")
      .trim();

    if (paragraph) tokens.push({ type: "paragraph", value: paragraph });
    paragraphLines = [];
  };

  const flushTable = () => {
    if (!tableLines || tableLines.length === 0) return;
    tokens.push({ type: "table", lines: tableLines });
    tableLines = null;
  };

  lines.forEach((sourceLine) => {
    const line = String(sourceLine ?? "");
    const trimmed = line.trim();

    if (displayMathLines) {
      displayMathLines.push(trimmed);
      if (/\\\]\s*$/u.test(trimmed)) {
        const value = displayMathLines.join("\n");
        tokens.push({ type: "formula", value });
        displayMathLines = null;
      }
      return;
    }

    if (tableLines && !isBacMarkdownTableLine(trimmed)) {
      flushTable();
    }

    if (!trimmed) {
      flushParagraph();
      flushTable();
      if (tokens[tokens.length - 1]?.type !== "spacer") {
        tokens.push({ type: "spacer" });
      }
      return;
    }

    if (isBacMarkdownTableLine(trimmed)) {
      flushParagraph();
      if (!tableLines) tableLines = [];
      tableLines.push(trimmed);
      return;
    }

    if (/^\\\[/u.test(trimmed) && !/\\\]\s*$/u.test(trimmed)) {
      flushParagraph();
      displayMathLines = [trimmed];
      return;
    }

    if (isPureDisplayMathStatementLine(trimmed)) {
      flushParagraph();
      tokens.push({ type: "formula", value: trimmed });
      return;
    }

    const sectionWithText = trimmed.match(BAC_STATEMENT_SECTION_PREFIX_RE);
    if (sectionWithText) {
      flushParagraph();
      tokens.push({
        type: "lead",
        label: sectionWithText[1],
        value: sectionWithText[2] || "",
      });
      return;
    }

    if (
      BAC_STATEMENT_SECTION_ONLY_RE.test(trimmed) ||
      BAC_ROMAN_SECTION_ONLY_RE.test(trimmed)
    ) {
      flushParagraph();
      tokens.push({
        type: "section",
        value: trimmed.replace(/[:：]\s*$/u, ""),
      });
      return;
    }

    const questionPrefix = getBacStatementLinePrefix(trimmed);
    if (questionPrefix) {
      flushParagraph();
      tokens.push({ type: "question", ...questionPrefix });
      return;
    }

    if (isBacBulletLine(trimmed)) {
      flushParagraph();
      tokens.push({
        type: "bullet",
        value: stripBacBulletPrefix(trimmed),
      });
      return;
    }

    if (looksLikeFormulaFragment(trimmed) && countArabicCharacters(trimmed) <= 2) {
      flushParagraph();
      tokens.push({ type: "formula", value: trimmed });
      return;
    }

    paragraphLines.push(trimmed);
  });

  if (displayMathLines?.length) {
    tokens.push({ type: "formula", value: displayMathLines.join("\n") });
  }

  flushParagraph();
  flushTable();

  while (tokens[0]?.type === "spacer") tokens.shift();
  while (tokens[tokens.length - 1]?.type === "spacer") tokens.pop();

  return tokens.filter(
    (token, index, list) =>
      token.type !== "spacer" || list[index - 1]?.type !== "spacer"
  );
}

function BacStatementMedia({ graphs = [], tables = [] }) {
  if (graphs.length === 0 && tables.length === 0) return null;

  return (
    <div className="my-5 break-inside-avoid rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:my-6 sm:p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2 text-sm font-black text-slate-700">
        <FileText className="h-4 w-4" />
        <span>الأشكال والوثائق المرفقة</span>
      </div>

      <div className="space-y-4 sm:space-y-5">
        {graphs.map((graph, graphIndex) => (
          <GraphRenderer
            key={
              graph?.id ??
              graph?.path ??
              `beautiful-statement-graph-${graphIndex}`
            }
            graph={graph}
            compact
          />
        ))}

        {tables.map((table, tableIndex) => (
          <SmartMathTable
            key={`beautiful-statement-table-${tableIndex}`}
            table={table}
          />
        ))}
      </div>
    </div>
  );
}

function BacStatementToken({ token }) {
  if (!token) return null;

  if (token.type === "spacer") {
    return <div className="h-1.5 sm:h-2" aria-hidden="true" />;
  }

  if (token.type === "formula") {
    return (
      <div className="my-2.5 rounded-xl bg-slate-50/80 px-2 py-1 sm:my-3 sm:px-3">
        <StandaloneFormula value={token.value} />
      </div>
    );
  }

  if (token.type === "table") {
    return <BacMarkdownTable lines={token.lines} />;
  }

  if (token.type === "section") {
    return (
      <div className="mt-5 flex items-center gap-3 first:mt-0 sm:mt-6">
        <span className="h-5 w-1 shrink-0 rounded-full bg-slate-900" />
        <h3 className="text-[1.02rem] font-black leading-8 text-slate-950 sm:text-[1.08rem]">
          {token.value}
        </h3>
        <span className="h-px min-w-8 flex-1 bg-slate-200" />
      </div>
    );
  }

  if (token.type === "lead") {
    return (
      <div className="my-3 rounded-xl border border-slate-200 border-r-slate-900 bg-slate-50/80 px-3.5 py-3 sm:my-4 sm:px-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="shrink-0 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-black text-white sm:text-sm">
            {token.label}
          </span>
          {hasText(token.value) && (
            <MathText
              block
              className="min-w-0 flex-1 font-semibold leading-8 text-slate-950 sm:leading-9"
            >
              {token.value}
            </MathText>
          )}
        </div>
      </div>
    );
  }

  if (token.type === "question") {
    return (
      <div
        className={cn(
          "my-2.5 grid min-w-0 items-start break-inside-avoid sm:my-3",
          token.nested
            ? "grid-cols-[2rem_minmax(0,1fr)] gap-2 sm:ps-6"
            : "grid-cols-[2.35rem_minmax(0,1fr)] gap-2.5"
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex items-center justify-center font-black",
            token.nested
              ? "h-7 min-w-7 rounded-lg border border-slate-300 bg-white text-[0.92rem] text-slate-900"
              : "h-8 min-w-8 rounded-xl bg-slate-950 px-1 text-[0.92rem] text-white shadow-sm"
          )}
        >
          {token.label}
        </span>

        <MathText
          block
          className={cn(
            "min-w-0 text-slate-950",
            token.nested
              ? "font-semibold leading-8 sm:leading-9"
              : "font-bold leading-8 sm:leading-9"
          )}
        >
          {token.text}
        </MathText>
      </div>
    );
  }

  if (token.type === "bullet") {
    return (
      <div className="flex min-w-0 items-start gap-2.5 ps-1 sm:ps-2">
        <span className="mt-[0.82rem] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
        <MathText
          block
          className="min-w-0 flex-1 font-semibold leading-8 text-slate-900 sm:leading-9"
        >
          {token.value}
        </MathText>
      </div>
    );
  }

  return (
    <MathText
      block
      className="font-medium leading-[2.05rem] text-slate-950 sm:text-[1.03rem] sm:leading-[2.25rem]"
    >
      {token.value}
    </MathText>
  );
}

function BacStatementText({
  children,
  className = "",
  media = null,
  insertMediaBeforeQuestions = false,
}) {
  const tokens = tokenizeBacStatement(children);
  if (tokens.length === 0) return null;

  const firstQuestionIndex = insertMediaBeforeQuestions
    ? tokens.findIndex((token) => token.type === "question")
    : -1;

  const shouldAppendMedia = Boolean(media) && firstQuestionIndex < 0;

  return (
    <div
      dir="rtl"
      className={cn(
        "min-w-0 space-y-1 text-right [text-wrap:pretty]",
        className
      )}
      style={{ direction: "rtl", unicodeBidi: "isolate" }}
    >
      {tokens.map((token, index) => (
        <div className="contents" key={`bac-statement-token-${index}-${token.type}`}>
          {media && index === firstQuestionIndex ? media : null}
          <BacStatementToken token={token} />
        </div>
      ))}

      {shouldAppendMedia ? media : null}
    </div>
  );
}

/**
 * يصلح محددات LaTeX غير المتوازنة قبل إرسال النص إلى MathJax.
 *
 * ظهور \\] أو \\) كنص في الصفحة يعني غالبًا أن JSON يحتوي على
 * delimiter إغلاق يتيم، أو delimiter فتح لم يُغلق. نحذف فقط المحدد
 * التالف ونترك محتوى النص والمعادلة كما هو.
 */
function restoreJsonDamagedLatexEscapes(value) {
  /*
   * عندما يصل LaTeX من JSON غير مهرب جيدًا قد يتحول جزء من الأمر إلى
   * control character:  \\frac -> form-feed + "rac" و \\times -> tab + "imes".
   * نصلح الحالات المعروفة فقط حتى لا نغيّر أسطر النص العادية.
   */
  return String(value ?? "")
    .replace(/\u0008(?=eta\b)/g, "\\b")
    .replace(/\f(?=(?:rac|orall)\b)/g, "\\f")
    .replace(/\t(?=(?:imes|frac|ext|heta|o)\b)/g, "\\t")
    .replace(/\r(?=(?:ight|rightarrow)\b)/g, "\\r")
    .replace(/\n(?=(?:eq|otin)\b)/g, "\\n");
}

function repairLatexDelimiters(value) {
  const source = String(value ?? "");
  if (!source) return "";

  let output = "";
  const stack = [];

  for (let index = 0; index < source.length; index += 1) {
    const token = source.slice(index, index + 2);

    if (token === "\\[" || token === "\\(") {
      stack.push({ token, outputIndex: output.length });
      output += token;
      index += 1;
      continue;
    }

    if (token === "\\]" || token === "\\)") {
      const expectedOpen = token === "\\]" ? "\\[" : "\\(";
      const lastOpen = stack[stack.length - 1];

      if (lastOpen?.token === expectedOpen) {
        stack.pop();
        output += token;
      }

      // delimiter إغلاق يتيم: لا نعرضه كنص.
      index += 1;
      continue;
    }

    output += source[index];
  }

  // نحذف delimiters الفتح التي لم تجد إغلاقًا مطابقًا.
  [...stack]
    .sort((a, b) => b.outputIndex - a.outputIndex)
    .forEach(({ outputIndex }) => {
      output = output.slice(0, outputIndex) + output.slice(outputIndex + 2);
    });

  return output;
}

function normalizeEscapedLatex(value) {
  const normalized = restoreJsonDamagedLatexEscapes(value)
    .replace(/\r\n?/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\u00a0/gi, " ")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")

    /*
     * بعض ملفات JSON القديمة قد تحتوي على أوامر LaTeX
     * بعد ضياع الـ backslash، مثل:
     * dfrac{1}{2} أو cdot أو sqrt{x}
     */
    .replace(
      /(^|[^\\A-Za-z])(?=(?:dfrac|tfrac|frac|sqrt|cdot|times|leq|geq|neq|infty|rightarrow|leftarrow|Delta|alpha|beta|gamma|theta|lambda|mu|pi|omega|mathrm|mathbf|mathbb|mathcal|overline|underline)\b)/g,
      "$1\\"
    )

    // توحيد backslashes المتكررة في JSON القديم.
    .replace(/\\{2,}(?=[()[\]])/g, "\\")

    // إصلاح حالات مثل "\\ ]" أو "\\ [".
    .replace(/\\\s+([()[\]])/g, "\\$1")

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

  return repairLatexDelimiters(normalized)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

const ARABIC_RE = /[\u0600-\u06ff]/;
const LATEX_COMMAND_RE = /\\(?:displaystyle|textstyle|scriptstyle|frac|dfrac|tfrac|sqrt|alpha|beta|gamma|Delta|delta|lambda|mu|pi|theta|omega|times|cdot|cdots|ldots|dots|leq|le|geq|ge|neq|in|notin|infty|to|rightarrow|leftarrow|sum|prod|lim|forall|exists|left|right|begin|end|mathrm|mathbf|mathbb|mathcal|overline|underline|quad|qquad|vert|lvert|rvert|pm|mp)\b/;

function repairLatexBraces(value) {
  const source = String(value ?? "");
  let output = "";
  let depth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1] || "";

    // \\{ و \\} رمزان مطبوعان وليسا مجموعتي LaTeX.
    if ((char === "{" || char === "}") && previous === "\\") {
      output += char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      output += char;
      continue;
    }

    if (char === "}") {
      // نحذف القوس اليتيم بدل ترك MathJax يعرض Math input error.
      if (depth === 0) continue;
      depth -= 1;
      output += char;
      continue;
    }

    output += char;
  }

  return output + "}".repeat(depth);
}

function hasBalancedLatexEnvironments(value) {
  const source = String(value ?? "");
  const tokenRegex = /\\(begin|end)\s*\{([^{}]+)\}/g;
  const stack = [];
  let match;

  while ((match = tokenRegex.exec(source)) !== null) {
    const [, type, environment] = match;

    if (type === "begin") {
      stack.push(environment);
      continue;
    }

    if (stack.pop() !== environment) return false;
  }

  return stack.length === 0;
}

function latexToReadableText(value) {
  let text = String(value ?? "")
    .replace(/^\\\(|\\\)$/g, "")
    .replace(/^\\\[|\\\]$/g, "")
    .replace(/\\(?:left|right|displaystyle|textstyle|scriptstyle)\b/g, "")
    .replace(/\\infty\b/g, "∞")
    .replace(/\\(?:times|cdot)\b/g, "×")
    .replace(/\\leq?\b/g, "≤")
    .replace(/\\geq?\b/g, "≥")
    .replace(/\\neq\b/g, "≠")
    .replace(/\\rightarrow|\\to\b/g, "→")
    .replace(/\\leftarrow\b/g, "←")
    .replace(/\\text\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");

  // أربع دورات تكفي للكسور المتداخلة المعتادة في تمارين البكالوريا.
  for (let pass = 0; pass < 4; pass += 1) {
    text = text.replace(
      /\\(?:dfrac|tfrac|frac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
      "($1)/($2)"
    );
  }

  return text
    .replace(/\\([A-Za-z]+)\b/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function prepareMathForRender(value, display = false) {
  let source = normalizeEscapedLatex(value).trim();
  if (!source) return { valid: false, content: "", fallback: "" };

  const displayWrapped = source.startsWith("\\[") && source.endsWith("\\]");
  const inlineWrapped = source.startsWith("\\(") && source.endsWith("\\)");

  if (displayWrapped || inlineWrapped) {
    source = source.slice(2, -2).trim();
  }

  source = repairLatexBraces(source)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();

  const valid =
    Boolean(source) &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source) &&
    hasBalancedLatexEnvironments(source);

  return {
    valid,
    content: `${display || displayWrapped ? "\\[" : "\\("}${source}${
      display || displayWrapped ? "\\]" : "\\)"
    }`,
    fallback: latexToReadableText(source),
  };
}

function SafeMathOutput({ value, display = false }) {
  const prepared = prepareMathForRender(value, display);

  if (!prepared.valid) {
    return (
      <span dir="ltr" className="font-mono" style={{ unicodeBidi: "isolate" }}>
        {prepared.fallback || String(value ?? "")}
      </span>
    );
  }

  return (
    <MathJax dynamic hideUntilTypeset="first" inline={!display}>
      <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate" }}>
        {prepared.content}
      </span>
    </MathJax>
  );
}

function isLikelyMath(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate || ARABIC_RE.test(candidate)) return false;

  return (
    LATEX_COMMAND_RE.test(candidate) ||
    /[=<>+\-*/^_{}∈∉≤≥∞∪∩]/.test(candidate) ||
    /[A-Za-z]\s*\([^)]*\)/.test(candidate) ||
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
      const lookAhead = rest.slice(0, 100);
      return /^(?:[A-Za-z]|\d)+(?:\s*)?(?:_|\^|=|<|>|≤|≥|∈|∉|\+|\-|\*|\/|\\)/.test(lookAhead) ||
        /^[A-Za-z](?:_[A-Za-z0-9{}+\-]+)?\s*\([^)]*\)\s*(?:=|<|>|≤|≥|∈|∉|\+|\-|,|،|؛|:|\.|\)|$)/.test(lookAhead) ||
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

function isOnlyLatexDelimiter(value) {
  const text = String(value ?? "").trim();
  return Boolean(text) && /^(?:\\[\[\]()]+\s*)+$/u.test(text);
}

function mergeAdjacentSegments(segments) {
  return segments.reduce((result, segment) => {
    if (!segment?.value) return result;

    // حماية إضافية حتى لا يظهر \\] أو \\) منفردًا مهما كان مصدر البيانات.
    if (segment.type === "text" && isOnlyLatexDelimiter(segment.value)) {
      return result;
    }

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
            <SafeMathOutput value={segment.value} display={isDisplay} />
          </bdi>
        );
      })}
    </Tag>
  );
}


function MathLTR({ children, className = "", block = false }) {
  const raw = normalizeEscapedLatex(children).trim();
  if (!raw) return null;

  const isDisplayWrapped = raw.startsWith("\\[") && raw.endsWith("\\]");
  const isInlineWrapped = raw.startsWith("\\(") && raw.endsWith("\\)");
  const shouldDisplay = block || isDisplayWrapped;

  let content = raw;
  if (!isDisplayWrapped && !isInlineWrapped) {
    content = shouldDisplay ? `\\[${raw}\\]` : `\\(${raw}\\)`;
  }

  const Tag = shouldDisplay ? "div" : "span";

  return (
    <Tag
      dir="ltr"
      className={cn(
        shouldDisplay
          ? "block w-full max-w-full overflow-x-auto text-center"
          : "inline-block max-w-full align-middle",
        className
      )}
      style={{
        direction: "ltr",
        unicodeBidi: "isolate",
        textAlign: shouldDisplay ? "center" : "inherit",
      }}
    >
      <SafeMathOutput value={content} display={shouldDisplay} />
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

function normalizeGraphCollection(...candidates) {
  const result = [];

  candidates.forEach((candidate) => {
    if (!candidate) return;

    if (Array.isArray(candidate)) {
      candidate.forEach((item) => {
        if (item && typeof item === "object") result.push(item);
      });
      return;
    }

    if (typeof candidate === "object") {
      result.push(candidate);
    }
  });

  // منع تكرار نفس الرسم عندما يكون موجودًا تحت أكثر من مفتاح للتوافق القديم.
  const seen = new Set();

  return result.filter((graph) => {
    const key =
      graph?.id ||
      graph?.code ||
      [
        graph?.diagram_type || "",
        graph?.type || "",
        graph?.title || "",
        graph?.path || graph?.src || graph?.url || "",
        graph?.svg || "",
        JSON.stringify(graph?.series || []),
      ].join("::");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


function normalizeFigureUsage(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isStatementFigure(graph) {
  const usage = normalizeFigureUsage(
    graph?.usage ||
    graph?.placement ||
    graph?.scope
  );

  /*
   * Compatibilité:
   * - usage: "statement" => visible dans l'énoncé.
   * - usage: "solution"  => jamais visible dans l'énoncé.
   * - absence de usage   => ancien JSON, on continue à l'afficher.
   */
  return !usage || ["statement", "exercise", "question"].includes(usage);
}

function isSolutionFigure(graph) {
  const usage = normalizeFigureUsage(
    graph?.usage ||
    graph?.placement ||
    graph?.scope
  );

  return ["solution", "answer", "correction"].includes(usage);
}

function getExerciseStatementGraphs(exercise) {
  return normalizeGraphCollection(
    normalizeDocumentReferences(
      exercise?.document_references,
      exercise?.content?.document_references,
      asObject(exercise?.raw_ai_response).normalized_exercise?.document_references
    ),
    exercise?.statement_graphs,
    exercise?.content?.statement_graphs,

    // structure des nouveaux JSON BAC.
    // IMPORTANT: on ne garde ici que les documents de l'énoncé.
    asArray(exercise?.figures).filter(isStatementFigure),
    asArray(exercise?.content?.figures).filter(isStatementFigure),

    // compatibilité avec les anciens fichiers
    exercise?.graph_data,
    exercise?.content?.graph_data,
    exercise?.statement_graph_data,
    exercise?.content?.statement_graph_data,
    exercise?.statement_figure,
    exercise?.content?.statement_figure,
    exercise?.figure,
    exercise?.content?.figure
  ).filter(isStatementFigure);
}

function getExerciseSolutionGraphs(exercise) {
  return normalizeGraphCollection(
    asArray(exercise?.figures).filter(isSolutionFigure),
    asArray(exercise?.content?.figures).filter(isSolutionFigure),
    exercise?.solution_figures,
    exercise?.content?.solution_figures
  ).filter(isSolutionFigure);
}

function getQuestionStatementGraphs(question) {
  return normalizeGraphCollection(
    question?.graph_data,
    question?.content?.graph_data,
    question?.statement_graphs,
    question?.content?.statement_graphs,
    question?.figures,
    question?.content?.figures,
    question?.statement_graph_data,
    question?.content?.statement_graph_data,
    question?.statement_figure,
    question?.content?.statement_figure,
    question?.figure,
    question?.content?.figure
  );
}

function getSolutionGraphs(solution) {
  return normalizeGraphCollection(
    solution?.graphs,
    solution?.graph_data_list,
    solution?.figures,
    solution?.solution_figures,
    solution?.graph_data,
    solution?.graph,
    solution?.figure
  );
}


function normalizeFigureReferenceIds(value) {
  const items = Array.isArray(value) ? value : value ? [value] : [];

  return items
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") {
        return String(item).trim();
      }

      if (item && typeof item === "object") {
        return String(
          item.id ||
            item.figure_id ||
            item.ref ||
            item.code ||
            item.document_key ||
            item.path ||
            ""
        ).trim();
      }

      return "";
    })
    .filter(Boolean);
}

function getFigureIdentity(graph, fallbackIndex = 0) {
  const item = asObject(graph);
  return String(
    item.id ||
      item.figure_id ||
      item.code ||
      item.metadata?.document_key ||
      item.path ||
      item.src ||
      item.url ||
      `solution-figure-${fallbackIndex}`
  ).trim();
}

function getGraphReferenceCandidates(graph) {
  const item = asObject(graph);

  return [
    item.id,
    item.figure_id,
    item.code,
    item.path,
    item.src,
    item.url,
    item.metadata?.document_key,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim());
}

function getQuestionSolutionFigureRefs(question) {
  const solution = asObject(question?.solution);

  return normalizeFigureReferenceIds(
    solution?.figure_refs ||
      solution?.figure_ids ||
      solution?.document_refs ||
      question?.solution_figure_refs ||
      question?.figure_refs
  );
}

function questionRefersToGraph(question, graph) {
  const refs = new Set(getQuestionSolutionFigureRefs(question));
  if (refs.size === 0) return false;

  return getGraphReferenceCandidates(graph).some((candidate) =>
    refs.has(candidate)
  );
}

function getSolutionReferenceGraphs(exercise, question) {
  const refs = getQuestionSolutionFigureRefs(question);
  if (refs.length === 0) return [];

  const pool = normalizeGraphCollection(
    exercise?.figures,
    exercise?.content?.figures,
    exercise?.solution_figures,
    exercise?.content?.solution_figures,
    exercise?.document_references,
    exercise?.content?.document_references
  );

  const byRef = new Map();

  pool.forEach((graph) => {
    getGraphReferenceCandidates(graph).forEach((candidate) => {
      if (!byRef.has(candidate)) byRef.set(candidate, graph);
    });
  });

  // Dans la correction on ne montre que les images usage="solution".
  return normalizeGraphCollection(
    refs.map((ref) => byRef.get(ref)).filter(Boolean).filter(isSolutionFigure)
  );
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreSolutionFigureForQuestion(graph, question, questionIndex) {
  const solution = asObject(question?.solution);

  // Le placement doit surtout dépendre de la CONSIGNE de la question.
  // On n'utilise pas les explications du corrigé pour éviter qu'un mot comme
  // "pH" présent dans la solution d'une autre question déplace l'image.
  const questionText = normalizeSearchText(
    [question?.text, question?.title].filter(Boolean).join(" ")
  );

  const graphText = normalizeSearchText(
    [
      graph?.id,
      graph?.figure_id,
      graph?.title,
      graph?.path,
      graph?.metadata?.document_type,
      ...asArray(graph?.metadata?.scientific_focus),
    ]
      .filter(Boolean)
      .join(" ")
  );

  let score = 100; // la question référence déjà explicitement cette image

  const asksForDrawing =
    /(رسم|تخطيطي|مخطط|ارسم|تمثيل بياني|منحنى)/u.test(questionText);
  const asksForFormula =
    /(الصيغة|صيغة|كيميائي|شارد|شاردية|بنية كيميائية)/u.test(questionText);
  const asksForElectrophoresis =
    /(هجرة|كهربائي|phi|ph|قطب|الشحنة|شحنة)/u.test(questionText);
  const asksForProperty = /(خاصية|خصائص)/u.test(questionText);
  const asksForTranscription =
    /(استنساخ|arnm|تشكل العنصر 1|التعبير المورثي)/u.test(questionText);

  const graphIsFormula =
    /(ionic|chemical|formula|formulas|صيغة|شارد)/u.test(graphText);
  const graphIsElectrophoresis =
    /(electrophoresis|electrophorese|هجرة)/u.test(graphText);
  const graphIsTranslationOrTranscription =
    /(translation|transcription|استنساخ|ترجمة)/u.test(graphText);
  const graphLooksLikeDiagram =
    /(diagram|schema|schematic|drawing|graph|translation|transcription)/u.test(
      graphText
    );

  // الرسم الرسمي يوضع مع السؤال الذي يطلب رسماً، وليس مع الأسئلة السابقة.
  if (asksForDrawing && graphLooksLikeDiagram) score += 700;
  if (asksForDrawing && graphIsTranslationOrTranscription) score += 500;
  if (asksForTranscription && graphIsTranslationOrTranscription) score += 260;

  // صورة الصيغ الشاردية توضع مع سؤال الصيغة الكيميائية.
  if (asksForFormula && graphIsFormula) score += 700;

  // صورة الهجرة الكهربائية توضع مع سؤال pHi / اتجاه الهجرة.
  if (asksForElectrophoresis && graphIsElectrophoresis) score += 600;
  if (asksForProperty && graphIsElectrophoresis) score += 80;

  // ترتيب ثابت عند التعادل.
  score -= questionIndex * 0.001;

  return score;
}

/**
 * Affecte chaque image de correction à UNE SEULE question.
 * Ainsi une même image référencée par q1, q2, q3, q4 ne se répète pas.
 */
function buildSolutionFigureAssignments(exercise, questions) {
  const list = asArray(questions);
  const solutionFigures = getExerciseSolutionGraphs(exercise);
  const assignments = new Map();

  solutionFigures.forEach((graph, graphIndex) => {
    const candidates = list
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => questionRefersToGraph(question, graph));

    if (candidates.length === 0) return;

    const best = candidates.reduce((currentBest, candidate) => {
      const score = scoreSolutionFigureForQuestion(
        graph,
        candidate.question,
        candidate.index
      );

      if (!currentBest || score > currentBest.score) {
        return { ...candidate, score };
      }

      return currentBest;
    }, null);

    if (!best) return;

    const figureId = getFigureIdentity(graph, graphIndex);
    const current = assignments.get(best.index) || new Set();
    current.add(figureId);
    assignments.set(best.index, current);
  });

  return assignments;
}

function filterAssignedReferenceGraphs(graphs, assignedFigureIds) {
  const list = normalizeGraphCollection(graphs);

  if (assignedFigureIds == null) return list;

  const allowed =
    assignedFigureIds instanceof Set
      ? assignedFigureIds
      : new Set(asArray(assignedFigureIds));

  if (allowed.size === 0) return [];

  return list.filter((graph, index) =>
    allowed.has(getFigureIdentity(graph, index))
  );
}

function getStepGraphs(step) {
  return normalizeGraphCollection(
    step?.graphs,
    step?.graph_data_list,
    step?.figures,
    step?.graph_data,
    step?.graph,
    step?.diagram,
    step?.figure
  );
}

function getQuestionTables(question) {
  return flattenTableCandidates(
    question?.tables,
    question?.table,
    question?.table_data,

    question?.statement_tables,
    question?.statement_table,

    question?.content?.tables,
    question?.content?.table,
    question?.content?.table_data
  );
}

function getStepTables(step) {
  return flattenTableCandidates(
    step?.tables,
    step?.table,
    step?.table_data,
    step?.progress_table,
    step?.variation_table,
    step?.sign_table
  );
}

export default function BacChapterExercises({
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

      const requestUrl = endpoint || (
        axisId
          ? `${API_BASE_URL}/api/exercise-generation/axes/${axisId}/`
          : `${API_BASE_URL}/api/bac/exercises/chapter/${chapterId}/`
      );

      const response = await axios.get(
        requestUrl,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );
      setData(normalizeAxisExercisePayload(response.data));
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
  }, [chapterId, axisId, endpoint, token]);

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

  useEffect(() => {
    if (!currentExercise) {
      onTutorExerciseChange?.(null);
      onTutorQuestionChange?.(null);
      onTutorStepChange?.(null);
      return;
    }

    onTutorExerciseChange?.({
      kind: "bac_exercise",
      id: currentExercise.id,
      code: currentExercise.code || "",
      title:
        currentExercise.title ||
        `بكالوريا ${currentExercise.year || ""} - التمرين ${currentExercise.exercise_number || currentExerciseIndex + 1}`,
      text: currentExercise.statement || "",
      year: currentExercise.year ?? null,
      exercise_number:
        currentExercise.exercise_number ??
        currentExerciseIndex + 1,
      axis_tags: currentExercise.axis_tags || [],
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
      solution_visible: showFullSolution,
      alternative_solution_visible: false,
      visible_hints: 0,
      showing_reexplanation: Object.values(visibleStepExplanations).some(Boolean),
    });
  }, [
    showFullSolution,
    visibleStepExplanations,
    onTutorViewStateChange,
  ]);

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
      setStepErrors({});
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
        const key = `${item.exercise_id}-${item.question_id}`;

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
      console.error("Saved question explanations error:", requestError);

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
    if (currentExercise?.id && !currentExercise?.is_generated) {
      fetchSavedExplanations(currentExercise.id);
    } else {
      setStepExplanations({});
      setVisibleStepExplanations({});
      setStepHistories({});
      setStepErrors({});
    }
  }, [currentExercise?.id, currentExercise?.is_generated, token]);

  const handleQuestionReExplanation = async (
    exercise,
    question,
    questionIndex,
    forceRegenerate = false
  ) => {
    onTutorQuestionChange?.({
      id: question?.id ?? question?.question_id ?? questionIndex + 1,
      number: question?.number ?? question?.display_order ?? questionIndex + 1,
      title: question?.title || "",
      text: question?.text || question?.standalone_text || "",
    });
    onTutorStepChange?.(null);
    onTutorViewStateChange?.({ showing_reexplanation: true });

    const key = questionExplanationKey(
      exercise,
      question,
      questionIndex
    );

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

    if (!question?.id) {
      setStepErrors((previous) => ({
        ...previous,
        [key]: "لا يوجد معرّف صالح لهذا السؤال.",
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
          question_id: String(question.id),

          // يبقى هذا الحقل فقط للتوافق مع serializer القديم.
          // الـbackend المعدل أدناه لا يستعمله لاختيار خطوة.
          step_number: 1,

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
          question_id: String(question.id),
          step_number: 0,
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
      console.error("Question re-explanation error:", requestError);

      setStepErrors((previous) => ({
        ...previous,
        [key]: getErrorMessage(
          requestError,
          "إعادة شرح هذا السؤال"
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
      <style>{`
        .math-content,
        .math-content * {
          max-width: 100%;
        }

        .math-content mjx-container[display="true"] {
          overflow-x: auto;
          overflow-y: hidden;
          max-width: 100%;
          margin: 0.35rem 0 !important;
          padding: 0.1rem 0;
        }

        .math-content mjx-container {
          line-height: 1.35;
        }

        .math-content > span:empty,
        .math-content bdi:empty {
          display: none !important;
        }

        .math-content mjx-container:not([display="true"]) {
          max-width: 100%;
        }

        /* داخل السؤال نريد سطر امتحان طبيعي، لا كتل MathJax متباعدة */
        .question-prompt mjx-container {
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }

        .question-prompt bdi {
          vertical-align: middle;
        }

        table {
          max-width: 100%;
        }

        img,
        svg,
        canvas {
          max-width: 100%;
          height: auto;
        }

        .bac-paper {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .bac-paper ::selection {
          background: #dbeafe;
          color: #0f172a;
        }

        .question-prompt mjx-container {
          margin: 0 !important;
        }

        .question-formula-group mjx-container {
          margin: 0 !important;
        }

        .question-formula-group mjx-container[display="true"] {
          display: inline-block !important;
          width: auto !important;
          padding: 0 !important;
        }

        @media (max-width: 359px) {
          .math-content {
            font-size: 0.9rem;
          }
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          .bac-paper,
          .bac-paper * {
            visibility: visible !important;
          }

          .bac-paper {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .bac-screen-only {
            display: none !important;
          }
        }
      `}</style>
      <section
        dir="rtl"
        className="
          min-h-full
          w-full
          min-w-0
          overflow-x-hidden
          bg-[linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)]
          px-2
          py-3
          min-[360px]:px-3
          min-[360px]:py-4
          sm:px-5
          sm:py-6
          lg:px-8
        "
      >
      <div className="
          mx-auto
          w-full
          min-w-0
          max-w-7xl
          space-y-4
          sm:space-y-6
        ">
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

            <div className="bac-screen-only flex justify-center">
              <button
                type="button"
                onClick={() => setShowFullSolution((previous) => !previous)}
                className={cn(
                  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition sm:w-auto sm:px-7",
                  showFullSolution
                    ? "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                    : "bg-slate-950 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
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
                onQuestionReExplanation={handleQuestionReExplanation}
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
    <header className="bac-screen-only w-full min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm sm:h-14 sm:w-14">
            <GraduationCap size={29} />
          </div>

          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
                بنك تمارين البكالوريا
              </span>
              <span className="text-xs font-bold text-slate-400">
                {count} من {totalCount} تمرين
              </span>
            </div>
            <h1 className="truncate text-xl font-black text-slate-950 sm:text-2xl">
              {chapter?.title || "تمارين الفصل"}
            </h1>
          </div>
        </div>

        {chapter?.code && (
          <div dir="ltr" className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-500 md:block">
            {chapter.code}
          </div>
        )}
      </div>

      {years.length > 0 && (
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto border-t border-slate-100 bg-slate-50/70 px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:px-7">
          <span className="ml-1 shrink-0 text-xs font-black text-slate-500">
            اختر الدورة:
          </span>

          <YearButton
            active={selectedYear === "all"}
            onClick={() => onYearChange("all")}
          >
            كل السنوات
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
    <section className="bac-screen-only w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center gap-2 px-1">
        <School size={17} className="text-blue-700" />
        <h2 className="text-sm font-black text-slate-800">الشعبة</h2>
        <span className="text-xs font-bold text-slate-400">اختر لفلترة التمارين</span>
      </div>

      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
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
        "inline-flex shrink-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-right transition sm:px-4",
        active
          ? "border-slate-950 bg-slate-950 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <span className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg",
        active ? "bg-white/10 text-white" : "bg-blue-50 text-blue-700"
      )}>
        <GraduationCap size={17} />
      </span>

      <span className="min-w-0">
        <span className="block whitespace-nowrap text-xs font-black sm:text-sm">{name}</span>
        <span className={cn(
          "mt-0.5 block whitespace-nowrap text-[10px] font-bold",
          active ? "text-slate-300" : "text-slate-400"
        )}>
          {count} تمرين
        </span>
      </span>

      {active && <CheckCircle2 size={16} className="shrink-0" />}
    </button>
  );
}

function FilteredEmptyState({ onReset }) {
  return (
    <div className="w-full min-w-0 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center shadow-sm sm:px-5 sm:py-12">
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
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 sm:w-auto"
      >
        <RefreshCcw size={17} />
        عرض كل التمارين
      </button>
    </div>
  );
}

function HeaderBadge({ icon, children }) {
  return (
    <div className="flex max-w-full items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-black sm:text-sm">
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
        "shrink-0 rounded-lg px-3 py-2 text-xs font-black transition sm:px-4 sm:text-sm",
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
    <div className="bac-screen-only mx-auto flex w-full max-w-[1040px] items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 sm:px-4 sm:text-sm"
      >
        <ChevronRight size={18} />
        السابق
      </button>

      <div className="min-w-0 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
          التمرين الحالي
        </p>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <span className="text-base font-black text-slate-950">{currentIndex + 1}</span>
          <span className="text-xs font-bold text-slate-300">/</span>
          <span className="text-xs font-black text-slate-500">{total}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex >= total - 1}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-4 sm:text-sm"
      >
        التالي
        <ChevronLeft size={18} />
      </button>
    </div>
  );
}


function getExamSessionLabel(value) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (["exceptional", "special", "استثنائية", "استثنائي"].includes(normalized)) {
    return "الدورة الاستثنائية";
  }

  if (["ordinary", "normal", "عادية", "عادي"].includes(normalized)) {
    return "الدورة العادية";
  }

  return "";
}

function getSubjectNumberLabel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";

  const names = {
    1: "الموضوع الأول",
    2: "الموضوع الثاني",
    3: "الموضوع الثالث",
  };

  return names[number] || `الموضوع ${number}`;
}

function getSourceReferenceFile(exercise) {
  const source = exercise?.source_reference;

  if (typeof source === "string") {
    return normalizeDisplayText(source);
  }

  if (source && typeof source === "object") {
    return normalizeDisplayText(
      source?.file ||
      source?.filename ||
      source?.source_file ||
      source?.reference ||
      ""
    );
  }

  return "";
}

function ExamPaper({ exercise, questions }) {
  const statementGraphs = getExerciseStatementGraphs(exercise);
  const statementSections = getExerciseStatementSections(exercise);
  const statementTables = getExerciseStatementTables(exercise);
  const branches = getExerciseBranches(exercise);
  const visibleQuestions = getVisibleQuestions(exercise, questions);

  const filteredStatementText = getStatementDisplayText(
    exercise,
    visibleQuestions
  );
  const originalStatementText = normalizeDisplayText(exercise?.statement);

  const canonicalSourceStatement = shouldRenderCanonicalSourceStatement(
    exercise,
    visibleQuestions
  );

  const canonicalStatementText =
    getStatementWithoutExerciseHeading(exercise);

  /*
   * إذا كان statement هو نص الورقة الرسمي الكامل، نستعمله مباشرة.
   * أما الملفات التي تحفظ المعطيات فقط داخل statement والأسئلة في
   * questions[] فنستعمل النسخة المنظفة ثم نعرض الأسئلة أسفلها.
   */
  const statementText = canonicalSourceStatement
    ? canonicalStatementText
    : hasText(filteredStatementText)
      ? filteredStatementText
      : originalStatementText;

  const hasMainStatement = hasText(statementText);

  const exerciseNumber = exercise?.exercise_number || 1;
  const branchLabel = branches
    .map((branch) => branch.name)
    .filter(Boolean)
    .join("، ");

  const pageLabel =
    exercise?.source_page ||
    asArray(exercise?.source_pages).join("، ");

  const pointsLabel = extractExercisePointsLabel(exercise);
  const durationLabel =
    exercise?.duration ||
    exercise?.time ||
    exercise?.estimated_time ||
    "";

  const sessionLabel = getExamSessionLabel(exercise?.session);
  const subjectNumberLabel = getSubjectNumberLabel(exercise?.subject_number);
  const sourceReferenceFile = getSourceReferenceFile(exercise);

  const officialHeading = extractOfficialExerciseHeading(exercise);
  const headingIncludesPoints =
    hasText(officialHeading) &&
    /(?:نقط|نقطة|نقاط)/u.test(officialHeading);

  const hasStatementMaterial =
    hasMainStatement ||
    statementSections.length > 0 ||
    statementGraphs.length > 0 ||
    statementTables.length > 0;

  /*
   * في canonicalSourceStatement لا نحتاج إلى إعادة تركيب I/II/III من
   * questions[] لأن الترقيم الأصلي موجود أصلًا داخل statement.
   */
  const romanMode =
    !canonicalSourceStatement &&
    hasRomanQuestionStructure(visibleQuestions);


  const romanStatement = romanMode
    ? splitStatementIntoRomanSections(statementText)
    : { intro: statementText, sections: [] };

  const statementSectionMap = new Map(
    romanStatement.sections.map((section) => [
      section.section,
      section.text,
    ])
  );

  const statementSectionLabelMap = new Map(
    romanStatement.sections
      .filter((section) => hasText(section?.sectionLabel))
      .map((section) => [section.section, section.sectionLabel])
  );

  const questionSectionLabelMap = new Map();
  visibleQuestions.forEach((question) => {
    const meta = getQuestionNamedSectionMeta(question);
    if (
      meta?.section &&
      meta?.sectionLabel &&
      !questionSectionLabelMap.has(meta.section)
    ) {
      questionSectionLabelMap.set(meta.section, meta.sectionLabel);
    }
  });

  const romanSectionOrder = [];
  const seenRomanSections = new Set();

  romanStatement.sections.forEach((section) => {
    if (!seenRomanSections.has(section.section)) {
      seenRomanSections.add(section.section);
      romanSectionOrder.push(section.section);
    }
  });

  visibleQuestions.forEach((question, index) => {
    const section = getQuestionSection(question, index + 1);
    if (section && !seenRomanSections.has(section)) {
      seenRomanSections.add(section);
      romanSectionOrder.push(section);
    }
  });

  const nonRomanQuestions = romanMode
    ? visibleQuestions.filter(
        (question, index) => !getQuestionSection(question, index + 1)
      )
    : visibleQuestions;

  const renderQuestionMedia = (question, index) => {
    const graphs = getQuestionStatementGraphs(question).filter(
      (graph) =>
        !statementGraphs.some(
          (statementGraph) =>
            (statementGraph?.id &&
              graph?.id &&
              statementGraph.id === graph.id) ||
            statementGraph === graph
        )
    );

    const tables = getQuestionTables(question);

    if (graphs.length === 0 && tables.length === 0) return null;

    return (
      <div className="mt-3 min-w-0 space-y-4 break-inside-avoid sm:mt-4">
        {graphs.map((graph, graphIndex) => (
          <GraphRenderer
            key={`question-graph-${question?.id ?? index}-${graphIndex}`}
            graph={graph}
            compact
          />
        ))}

        {tables.map((table, tableIndex) => (
          <SmartMathTable
            key={`question-table-${question?.id ?? index}-${tableIndex}`}
            table={table}
          />
        ))}
      </div>
    );
  };

  const renderQuestionRow = (
    question,
    index,
    {
      romanSubQuestion = false,
      labelOverride = undefined,
      forceHideLabel = false,
      nested = false,
    } = {}
  ) => {
    const label = getQuestionDisplayLabel(question, index + 1);
    const labelParts = parseQuestionLabelParts(label);

    const questionText = getQuestionDisplayText(
      question,
      index + 1,
      exercise?.statement || ""
    );

    const computedLabel = renderPaperQuestionLabel(
      label,
      index + 1,
      romanSubQuestion
    );

    const visibleLabel =
      labelOverride !== undefined ? labelOverride : computedLabel;

    const hideInlineLabel =
      forceHideLabel ||
      (romanSubQuestion &&
        labelParts.section &&
        !labelParts.rest);

    return (
      <li
        key={question?.id ?? index}
        data-tutor-context
        data-tutor-exercise-kind="bac_exercise"
        data-tutor-exercise-id={exercise?.id ?? ""}
        data-tutor-question-id={
          question?.id ?? question?.question_id ?? index + 1
        }
        data-tutor-question-number={
          question?.number ?? question?.display_order ?? index + 1
        }
        data-tutor-question-title={
          question?.title || `السؤال ${index + 1}`
        }
        className="min-w-0 break-inside-avoid"
      >
        {hasText(getQuestionSectionTitle(question)) && (
          <div className="mb-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm font-black text-blue-950 sm:px-4">
            {getQuestionSectionTitle(question)}
          </div>
        )}

        {hasText(getQuestionContextBefore(question)) && (
          <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/75 px-3.5 py-3 sm:px-4">
            <p className="mb-1 text-[10px] font-black text-slate-500">
              معطيات هذا الجزء
            </p>
            <BacStatementText className="text-sm font-semibold leading-8 text-slate-800 sm:text-[0.98rem]">
              {getQuestionContextBefore(question)}
            </BacStatementText>
          </div>
        )}

        <div
          className={cn(
            "min-w-0",
            hideInlineLabel || !visibleLabel
              ? "block"
              : nested
                ? "grid grid-cols-[1.8rem_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[2rem_minmax(0,1fr)]"
                : "grid grid-cols-[2.2rem_minmax(0,1fr)] items-start gap-2.5 sm:grid-cols-[2.6rem_minmax(0,1fr)]"
          )}
        >
          {!hideInlineLabel && visibleLabel && (
            <span
              dir="rtl"
              className="pt-[0.05rem] text-[0.98rem] font-black leading-[2.05rem] text-slate-950 sm:text-[1.03rem] sm:leading-[2.2rem]"
            >
              {visibleLabel}
            </span>
          )}

          <div className="min-w-0">
            <QuestionPromptText value={questionText} />
            {renderQuestionMedia(question, index)}
          </div>
        </div>

        {hasText(getQuestionContextAfter(question)) && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/75 px-3.5 py-3 sm:px-4">
            <BacStatementText className="text-sm font-semibold leading-8 text-slate-800 sm:text-[0.98rem]">
              {getQuestionContextAfter(question)}
            </BacStatementText>
          </div>
        )}
      </li>
    );
  };

  const renderStructuredSectionQuestions = (sectionQuestions) => {
    const groups = [];

    sectionQuestions.forEach((item) => {
      const label = getQuestionDisplayLabel(
        item.question,
        item.originalIndex + 1
      );
      const local = parseSectionLocalQuestionLabel(label);

      if (!local.major) {
        groups.push({
          type: "single",
          key: `single-${item.question?.id ?? item.originalIndex}`,
          item,
        });
        return;
      }

      const previous = groups[groups.length - 1];
      if (
        previous?.type === "major" &&
        previous.major === local.major
      ) {
        previous.items.push({ ...item, local });
        return;
      }

      groups.push({
        type: "major",
        key: `major-${local.major}-${item.originalIndex}`,
        major: local.major,
        items: [{ ...item, local }],
      });
    });

    return (
      <ol className="m-0 list-none space-y-2.5 p-0 sm:space-y-3">
        {groups.map((group) => {
          if (group.type === "single") {
            return renderQuestionRow(
              group.item.question,
              group.item.originalIndex,
              { romanSubQuestion: true }
            );
          }

          const hasSubQuestions = group.items.some(
            (entry) => hasText(entry.local?.sub)
          );

          if (!hasSubQuestions && group.items.length === 1) {
            const entry = group.items[0];
            return renderQuestionRow(
              entry.question,
              entry.originalIndex,
              {
                romanSubQuestion: true,
                labelOverride: `${group.major})`,
              }
            );
          }

          return (
            <li
              key={group.key}
              className="grid min-w-0 grid-cols-[2.2rem_minmax(0,1fr)] items-start gap-2.5 break-inside-avoid sm:grid-cols-[2.6rem_minmax(0,1fr)]"
            >
              <span className="pt-[0.05rem] text-[0.98rem] font-black leading-[2.05rem] text-slate-950 sm:text-[1.03rem] sm:leading-[2.2rem]">
                {group.major})
              </span>

              <ol className="m-0 min-w-0 list-none space-y-1.5 p-0 sm:space-y-2">
                {group.items.map((entry) => {
                  const sub = entry.local?.sub || "";

                  if (!sub) {
                    return renderQuestionRow(
                      entry.question,
                      entry.originalIndex,
                      {
                        romanSubQuestion: true,
                        forceHideLabel: true,
                        nested: true,
                      }
                    );
                  }

                  return renderQuestionRow(
                    entry.question,
                    entry.originalIndex,
                    {
                      romanSubQuestion: true,
                      labelOverride: `${sub})`,
                      nested: true,
                    }
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    );
  };

  return (
    <article
      dir="rtl"
      data-tutor-context
      data-tutor-exercise-kind="bac_exercise"
      data-tutor-exercise-id={exercise?.id ?? ""}
      data-tutor-title={
        exercise?.title || `بكالوريا ${exercise?.year || ""}`
      }
      className="bac-paper mx-auto w-full min-w-0 max-w-[1080px] overflow-hidden rounded-[1.4rem] border border-slate-200 bg-slate-50/30 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]"
    >
      <header className="border-b border-slate-200 bg-white px-5 pb-4 pt-5 sm:px-8 sm:pb-5 sm:pt-6 lg:px-10">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
          <div className="order-2 text-right text-[11px] font-bold leading-5 text-slate-700 md:order-1 sm:text-xs sm:leading-6">
            <p className="font-black text-slate-950">
              الجمهورية الجزائرية الديمقراطية الشعبية
            </p>
            <p>وزارة التربية الوطنية</p>

            {branchLabel && (
              <p className="mt-1">الشعبة: {branchLabel}</p>
            )}
          </div>

          <div className="order-1 text-center md:order-2 md:min-w-[300px]">
            <p className="text-[10px] font-black tracking-[0.11em] text-slate-500 sm:text-xs">
              امتحان شهادة البكالوريا
            </p>

            <h1 className="mt-1 break-words text-lg font-black leading-8 text-slate-950 sm:text-xl">
              {officialHeading || getCleanExerciseTitle(exercise)}
            </h1>

            {(exercise?.year || sessionLabel || subjectNumberLabel) && (
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-slate-600 sm:text-xs">
                {exercise?.year && <span>بكالوريا {exercise.year}</span>}
                {sessionLabel && <span>• {sessionLabel}</span>}
                {subjectNumberLabel && <span>• {subjectNumberLabel}</span>}
              </div>
            )}
          </div>

          <div className="order-3 text-left text-[11px] font-bold leading-5 text-slate-700 sm:text-xs sm:leading-6">
            <p>التمرين: {exerciseNumber}</p>
            {pageLabel && <p>الصفحة: {pageLabel}</p>}
            {pointsLabel && !headingIncludesPoints && (
              <p>العلامة: {pointsLabel}</p>
            )}
            {durationLabel && <p>المدة: {durationLabel}</p>}
          </div>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-7 sm:py-6 lg:px-9 lg:py-7">
        <div className="mx-auto max-w-[940px] text-[0.98rem] leading-8 text-slate-950 sm:text-[1.04rem] sm:leading-9">
          {romanMode && hasText(romanStatement.intro) && (
            <div className="mb-5 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
              <BacStatementText className="text-slate-950">
                {romanStatement.intro}
              </BacStatementText>
            </div>
          )}

          {!romanMode && hasMainStatement && (
            <section className="mb-6 min-w-0 overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-white">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-950 sm:text-[0.95rem]">
                      نص التمرين
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 sm:text-[11px]">
                      اقرأ المعطيات والمطلوب بالترتيب
                    </p>
                  </div>
                </div>

                {pointsLabel && (
                  <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-700">
                    {pointsLabel}
                  </span>
                )}
              </div>

              <div className="px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
                <BacStatementText
                  className="text-slate-950"
                  media={
                    canonicalSourceStatement ? (
                      <BacStatementMedia
                        graphs={statementGraphs}
                        tables={statementTables}
                      />
                    ) : null
                  }
                  insertMediaBeforeQuestions={canonicalSourceStatement}
                >
                  {statementText}
                </BacStatementText>
              </div>
            </section>
          )}

          {!canonicalSourceStatement && statementSections.map((section, index) => {
            const sectionText = section?.text || section?.content;
            if (!hasText(sectionText)) return null;

            const normalizedSection =
              normalizeStatementSectionForDedup(sectionText);
            const normalizedMain =
              normalizeStatementSectionForDedup(statementText);

            if (
              normalizedSection.length >= 10 &&
              normalizedMain.includes(normalizedSection)
            ) {
              return null;
            }

            return (
              <section
                key={section?.id ?? index}
                className="mb-3 break-inside-avoid"
              >
                {hasText(section?.title) && (
                  <h3 className="mb-1 text-sm font-black text-slate-950 sm:text-base">
                    {section.title}
                  </h3>
                )}

                <MathText
                  block
                  className="font-semibold leading-8 text-slate-950 sm:leading-9"
                >
                  {sectionText}
                </MathText>
              </section>
            );
          })}

          {!canonicalSourceStatement && !romanMode && statementGraphs.length > 0 && (
            <div className="my-5 space-y-5 break-inside-avoid">
              {statementGraphs.map((graph, graphIndex) => (
                <GraphRenderer
                  key={
                    graph?.id ??
                    graph?.path ??
                    `exercise-statement-graph-${graphIndex}`
                  }
                  graph={graph}
                  compact
                />
              ))}
            </div>
          )}

          {!canonicalSourceStatement && !romanMode && statementTables.length > 0 && (
            <div className="my-5 space-y-4 break-inside-avoid">
              {statementTables.map((table, tableIndex) => (
                <SmartMathTable
                  key={`exercise-statement-table-${tableIndex}`}
                  table={table}
                />
              ))}
            </div>
          )}

          {romanMode && romanSectionOrder.length > 0 && (
            <div className="mt-1 space-y-4 sm:space-y-5">
              {romanSectionOrder.map((sectionName) => {
                const sectionPrelude =
                  statementSectionMap.get(sectionName) || "";

                const sectionQuestions = visibleQuestions
                  .map((question, originalIndex) => ({
                    question,
                    originalIndex,
                    parts: parseQuestionLabelParts(
                      getQuestionDisplayLabel(
                        question,
                        originalIndex + 1
                      )
                    ),
                  }))
                  .filter(
                    (item) => item.parts.section === sectionName
                  );

                if (
                  !hasText(sectionPrelude) &&
                  sectionQuestions.length === 0
                ) {
                  return null;
                }

                const sectionDisplayLabel =
                  questionSectionLabelMap.get(sectionName) ||
                  statementSectionLabelMap.get(sectionName) ||
                  `${sectionName}-`;

                const arabicNamedSection = /^(?:الجزء|القسم)\s/u.test(
                  sectionDisplayLabel
                );

                return (
                  <section
                    key={`roman-section-${sectionName}`}
                    className="break-inside-auto"
                  >
                    <div
                      className={cn(
                        "mb-2 font-black text-slate-950 sm:mb-2.5",
                        arabicNamedSection
                          ? "text-[1rem] leading-8 sm:text-[1.06rem]"
                          : "text-[1rem] leading-8 sm:text-[1.06rem]"
                      )}
                    >
                      {arabicNamedSection
                        ? `${sectionDisplayLabel}:`
                        : sectionDisplayLabel}
                    </div>

                    <div className="min-w-0 ps-0 sm:ps-2">
                      {hasText(sectionPrelude) && (
                        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 sm:px-4">
                          <BacStatementText className="text-slate-950">
                            {sectionPrelude}
                          </BacStatementText>
                        </div>
                      )}

                      {sectionName === romanSectionOrder[0] &&
                        statementGraphs.length > 0 && (
                          <div className="my-4 space-y-4 break-inside-avoid sm:my-5">
                            {statementGraphs.map((graph, graphIndex) => (
                              <GraphRenderer
                                key={
                                  graph?.id ??
                                  graph?.path ??
                                  `exercise-statement-graph-${graphIndex}`
                                }
                                graph={graph}
                                compact
                              />
                            ))}
                          </div>
                        )}

                      {sectionName === romanSectionOrder[0] &&
                        statementTables.length > 0 && (
                          <div className="my-4 space-y-4 break-inside-avoid sm:my-5">
                            {statementTables.map((table, tableIndex) => (
                              <SmartMathTable
                                key={`exercise-statement-table-${tableIndex}`}
                                table={table}
                              />
                            ))}
                          </div>
                        )}

                      {sectionQuestions.length > 0 &&
                        renderStructuredSectionQuestions(
                          sectionQuestions
                        )}
                    </div>
                  </section>
                );
              })}

              {nonRomanQuestions.length > 0 && (
                <ol className="m-0 list-none space-y-2.5 border-t border-slate-300 pt-4 sm:space-y-3">
                  {nonRomanQuestions.map((question) => {
                    const originalIndex =
                      visibleQuestions.indexOf(question);

                    return renderQuestionRow(
                      question,
                      originalIndex >= 0 ? originalIndex : 0
                    );
                  })}
                </ol>
              )}
            </div>
          )}

          {!canonicalSourceStatement && !romanMode && visibleQuestions.length > 0 && (
            <section
              className={cn(
                "break-inside-auto",
                hasStatementMaterial &&
                  "mt-5 border-t border-slate-900 pt-4 sm:mt-6"
              )}
            >
              {renderStructuredSectionQuestions(
                visibleQuestions.map((question, originalIndex) => ({
                  question,
                  originalIndex,
                }))
              )}
            </section>
          )}
        </div>
      </div>

      {hasText(sourceReferenceFile) && (
        <footer className="border-t border-slate-200 px-5 py-2 sm:px-8">
          <p
            dir="ltr"
            className="truncate text-left text-[10px] font-bold text-slate-400 sm:text-[11px]"
          >
            المصدر: {sourceReferenceFile}
          </p>
        </footer>
      )}
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
  onQuestionReExplanation,
  onSelectSavedExplanation,
}) {
  const solutionFigureAssignments = useMemo(
    () => buildSolutionFigureAssignments(exercise, questions),
    [exercise, questions]
  );

  return (
    <article className="mx-auto w-full min-w-0 max-w-[1040px] overflow-hidden rounded-[1.6rem] border border-slate-300 bg-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
      <header className="border-b border-slate-200 bg-slate-950 px-4 py-5 text-white sm:px-8 sm:py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <CheckCircle2 size={23} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.16em] text-emerald-300 sm:text-xs">
                التصحيح النموذجي
              </p>
              <h2 className="mt-1 truncate text-lg font-black sm:text-xl">
                الحل الكامل للتمرين رقم {exercise?.exercise_number || 1}
              </h2>
            </div>
          </div>

          {exercise?.year && (
            <span className="hidden rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-slate-200 sm:inline-flex">
              بكالوريا {exercise.year}
            </span>
          )}
        </div>
      </header>

      <div className="min-w-0 px-3 py-5 min-[360px]:px-4 sm:px-8 sm:py-8 lg:px-10">
        {questions.map((question, index) => {
          const key = questionKey(exercise, question, index);
          const solution = asObject(question?.solution);
          const number = getQuestionDisplayLabel(question, index + 1);

          return (
            <section
              key={key}
              data-tutor-context
              data-tutor-exercise-kind="bac_exercise"
              data-tutor-exercise-id={exercise?.id ?? ""}
              data-tutor-question-id={question?.id ?? question?.question_id ?? index + 1}
              data-tutor-question-number={question?.number ?? question?.display_order ?? index + 1}
              data-tutor-question-title={question?.title || `السؤال ${index + 1}`}
              className={cn(
                "min-w-0 py-6 first:pt-0 last:pb-0 sm:py-8",
                index > 0 && "border-t border-dashed border-slate-300"
              )}
            >
              <div className="mb-5 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
                <span className="inline-flex min-h-9 min-w-9 max-w-[8rem] items-center justify-center rounded-xl bg-slate-950 px-2.5 text-xs font-black text-white sm:min-h-10 sm:text-sm">
                  {number}
                </span>
                <div className="min-w-0 pt-0.5">
                  {hasText(getQuestionSectionTitle(question)) && (
                    <p className="mb-1 text-[10px] font-black text-blue-700 sm:text-xs">
                      {getQuestionSectionTitle(question)}
                    </p>
                  )}
                  <p className="mb-1 text-[10px] font-black text-emerald-700 sm:text-xs">حل السؤال</p>
                  {!isGenericQuestionText(question?.text) ? (
                    <MathText block className="text-sm font-black leading-8 text-slate-950 sm:text-base sm:leading-9">
                      {getQuestionDisplayText(question, number, exercise?.statement || "")}
                    </MathText>
                  ) : (
                    <p className="text-sm font-black text-slate-950 sm:text-base">
                      الحل النموذجي الكامل للتمرين
                    </p>
                  )}

                  {hasText(getQuestionContextBefore(question)) && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <p className="mb-1 text-[10px] font-black text-slate-500">
                        معطيات مرتبطة بالسؤال
                      </p>
                      <BacStatementText className="text-sm font-semibold leading-7 text-slate-700">
                        {getQuestionContextBefore(question)}
                      </BacStatementText>
                    </div>
                  )}

                  {hasText(getQuestionContextAfter(question)) && (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <BacStatementText className="text-sm font-semibold leading-7 text-slate-700">
                        {getQuestionContextAfter(question)}
                      </BacStatementText>
                    </div>
                  )}
                </div>
              </div>

              <StoredSolution
                exercise={exercise}
                question={question}
                questionIndex={index}
                solution={solution}
                assignedSolutionFigureIds={solutionFigureAssignments.get(index) || new Set()}
                stepExplanations={stepExplanations}
                visibleStepExplanations={visibleStepExplanations}
                loadingStepKey={loadingStepKey}
                stepErrors={stepErrors}
                stepHistories={stepHistories}
                loadingSavedExplanations={loadingSavedExplanations}
                onQuestionReExplanation={onQuestionReExplanation}
                onSelectSavedExplanation={onSelectSavedExplanation}
              />
            </section>
          );
        })}
      </div>
    </article>
  );
}


function translateSolutionSign(value) {
  const normalized = String(value ?? "").trim().toLowerCase();

  const labels = {
    negative: "سالب",
    positive: "موجب",
    zero: "منعدم",
    null: "منعدم",
    "0": "منعدم",
  };

  return labels[normalized] || String(value ?? "").trim();
}

function ParameterDiscussionCard({ discussion }) {
  const data = asObject(discussion);
  const cases = asArray(data?.cases);

  if (cases.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 bg-violet-50/80 px-4 py-3.5 sm:px-5">
        <div>
          <p className="text-[11px] font-black text-violet-600">
            المناقشة البيانية
          </p>
          <h3 className="text-sm font-black text-slate-950 sm:text-base">
            عدد وإشارة الحلول حسب قيم{" "}
            <MathText>{data?.parameter || "m"}</MathText>
          </h3>
        </div>

        {hasText(data?.equivalent_equation) && (
          <div className="max-w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
            <MathText>{data.equivalent_equation}</MathText>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3 text-right font-black">
                شرط الوسيط
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-center font-black">
                عدد الحلول
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right font-black">
                إشارة الحلول
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right font-black">
                حلول مميزة
              </th>
            </tr>
          </thead>

          <tbody>
            {cases.map((item, index) => {
              const signs = asArray(item?.signs)
                .map(translateSolutionSign)
                .filter(Boolean);

              const specialSolutions = asArray(item?.special_solutions)
                .map((value) => String(value ?? "").trim())
                .filter(Boolean);

              return (
                <tr
                  key={`parameter-case-${index}`}
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <td className="px-4 py-3 font-bold text-slate-900">
                    <MathText>{item?.condition || "—"}</MathText>
                  </td>
                  <td className="px-4 py-3 text-center font-black text-slate-950">
                    {item?.solutions_count ?? "—"}
                    {item?.multiplicity === "double" && (
                      <span className="mr-1 text-xs font-bold text-slate-500">
                        (مضاعف)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    {signs.length > 0 ? signs.join("، ") : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    {specialSolutions.length > 0 ? (
                      <MathText>{specialSolutions.join(" ، ")}</MathText>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StoredSolution({
  exercise,
  question,
  questionIndex,
  solution,
  assignedSolutionFigureIds = null,
  stepExplanations,
  visibleStepExplanations,
  loadingStepKey,
  stepErrors,
  stepHistories,
  loadingSavedExplanations,
  onQuestionReExplanation,
  onSelectSavedExplanation,
}) {
  const methodology = getMethodology(question, solution);
  const constructionValues = getConstructionValues(question, solution);
  const solutionTables = getSolutionTables(solution);
  const steps = normalizeSteps(solution?.steps);
  const mistakes = normalizeStringList(solution?.common_mistakes);
  const hints = normalizeStringList(solution?.hints);
  const formalWriting = getFormalWriting(question, solution, methodology);

  // 1) Images placées directement dans solution.figures restent sous ce السؤال.
  const directSolutionGraphs = getSolutionGraphs(solution);

  // 2) Les images référencées par figure_refs sont résolues depuis exercise.figures,
  // puis filtrées pour n'apparaître que sous LA question la plus pertinente.
  const referencedSolutionGraphs = filterAssignedReferenceGraphs(
    getSolutionReferenceGraphs(exercise, question),
    assignedSolutionFigureIds
  );

  const solutionGraphs = normalizeGraphCollection(
    directSolutionGraphs,
    referencedSolutionGraphs
  );

  const indeterminateForm = getSolutionIndeterminateForm(solution);
  const parameterDiscussion = asObject(solution?.parameter_discussion);

  if (
    steps.length === 0 &&
    !hasText(solution?.final_answer) &&
    solutionTables.length === 0 &&
    solutionGraphs.length === 0
  ) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold text-amber-950">
        <TriangleAlert className="mt-0.5 shrink-0" size={19} />
        <span>لا يوجد حل محفوظ لهذا السؤال.</span>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* بطاقة الطريقة */}
      {(hasText(solution?.strategy) ||
        hasText(solution?.main_idea) ||
        hasText(solution?.detailed_explanation)) && (
        <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-indigo-100 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 text-indigo-950">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-700 text-white shadow-sm">
                <Lightbulb size={18} />
              </span>
              <div>
                <p className="text-[11px] font-black text-indigo-500">
                  قبل أن نبدأ الحساب
                </p>
                <h3 className="text-sm font-black sm:text-base">
                  فكرة الحل
                </h3>
              </div>
            </div>

            {indeterminateForm && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-[11px] font-black text-amber-900">
                <TriangleAlert size={14} />
                {indeterminateForm.label}
              </span>
            )}
          </div>

          <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
            {hasText(solution?.strategy) && (
              <div className="rounded-2xl border border-indigo-100 bg-white/90 px-4 py-3 shadow-sm">
                <p className="mb-1 text-[11px] font-black text-indigo-600">
                  الطريقة
                </p>
                <MathText block className="font-bold leading-8 text-slate-900">
                  {solution.strategy}
                </MathText>
              </div>
            )}

            {hasText(solution?.main_idea) && (
              <MathText block className="font-black leading-8 text-slate-950">
                {solution.main_idea}
              </MathText>
            )}

            {hasText(solution?.detailed_explanation) && (
              <MathText block className="font-medium leading-8 text-slate-700">
                {solution.detailed_explanation}
              </MathText>
            )}
          </div>
        </section>
      )}

      {/* حالة عدم التعيين: تظهر بارزة قبل الخطوات */}
      {indeterminateForm && (
        <section className="overflow-hidden rounded-3xl border border-amber-300 bg-amber-50 shadow-sm">
          <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
              <TriangleAlert size={22} />
            </span>

            <div className="min-w-0">
              <p className="text-xs font-black text-amber-700">
                انتبه قبل إعطاء النتيجة
              </p>
              <h3 className="mt-0.5 text-base font-black text-amber-950 sm:text-lg">
                {indeterminateForm.label}
              </h3>
              <p className="mt-1 text-sm font-semibold leading-7 text-amber-900">
                لا نحسب هذا الشكل مباشرة. نتبع خطوات الحل أدناه لإزالة حالة عدم التعيين أولًا، ثم نحسب النهاية.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* خطوات الحل — تنظيم هادئ وواضح مثل ورقة التصحيح النموذجية */}
      {steps.length > 0 && (
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
                <Target size={20} />
              </span>

              <div className="min-w-0">
                <p className="text-[11px] font-black tracking-wide text-slate-500">
                  التصحيح النموذجي
                </p>
                <h3 className="truncate text-base font-black text-slate-950 sm:text-lg">
                  الحل خطوة بخطوة
                </h3>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <ListChecks size={16} className="text-slate-500" />
              <span className="text-xs font-black text-slate-700">
                {steps.length} {steps.length === 1 ? "خطوة" : "خطوات"}
              </span>
            </div>
          </div>

          <div className="min-w-0 space-y-3 bg-slate-50/40 p-3 sm:space-y-4 sm:p-5">
            {steps.map((step, index) => (
              <SolutionStep
                key={step?.id ?? step?.step_number ?? index}
                step={step}
                fallbackNumber={index + 1}
                isLast={index === steps.length - 1}
                exerciseId={exercise?.id}
                questionId={question?.id ?? question?.question_id ?? questionIndex + 1}
                questionNumber={question?.number ?? question?.display_order ?? questionIndex + 1}
              />
            ))}
          </div>
        </section>
      )}

      {solutionTables.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <ListChecks size={19} className="text-blue-700" />
            <h3 className="font-black text-slate-950">
              الجداول والحسابات المنظمة
            </h3>
          </div>
          {solutionTables.map((table, index) => (
            <SmartMathTable key={`solution-table-${index}`} table={table} />
          ))}
        </section>
      )}

      {solutionGraphs.length > 0 && (
        <section className="overflow-hidden rounded-3xl border border-sky-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-sky-100 bg-sky-50/70 px-4 py-3.5 sm:px-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-700 text-white">
              <FileText size={18} />
            </span>

            <div className="min-w-0">
              <p className="text-[11px] font-black text-sky-600">
                جزء من حل هذا السؤال
              </p>
              <h3 className="text-sm font-black text-slate-950 sm:text-base">
                {/(رسم|تخطيطي|مخطط|ارسم)/u.test(String(question?.text || ""))
                  ? "الرسم التخطيطي المطلوب"
                  : /(الصيغة|صيغة|كيميائية|شاردية)/u.test(String(question?.text || ""))
                    ? "الصيغة المرفقة بالحل"
                    : "الوثيقة المناسبة لهذا السؤال"}
              </h3>
            </div>
          </div>

          <div className="min-w-0 space-y-4 bg-slate-50/35 p-3 sm:p-5">
            {solutionGraphs.map((graph, index) => (
              <GraphRenderer
                key={`solution-graph-${graph?.id ?? index}`}
                graph={graph}
              />
            ))}
          </div>
        </section>
      )}

      {asArray(parameterDiscussion?.cases).length > 0 && (
        <ParameterDiscussionCard discussion={parameterDiscussion} />
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

      {/* النتيجة النهائية */}
      {hasText(solution?.final_answer) && (
        <section className="overflow-hidden rounded-3xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-sm">
          <div className="flex items-center gap-3 border-b border-emerald-200 bg-emerald-100/70 px-4 py-3 sm:px-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <CheckCircle2 size={19} />
            </span>
            <div>
              <p className="text-[11px] font-black text-emerald-600">
                ما نكتبه في ورقة البكالوريا
              </p>
              <h3 className="text-sm font-black text-emerald-950 sm:text-base">
                النتيجة النهائية
              </h3>
            </div>
          </div>

          <div className="px-4 py-5 sm:px-6 sm:py-6">
            <MathText
              block
              className="font-black leading-10 text-emerald-950 sm:text-lg"
            >
              {solution.final_answer}
            </MathText>
          </div>
        </section>
      )}

      {/* التحقق */}
      {hasText(solution?.verification) && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-4">
          <div className="mb-2 flex items-center gap-2 text-emerald-800">
            <CheckCircle2 size={17} />
            <h3 className="text-sm font-black">التحقق من النتيجة</h3>
          </div>
          <MathText block className="font-semibold leading-8 text-slate-700">
            {solution.verification}
          </MathText>
        </div>
      )}

      {/* نصائح */}
      {hints.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/60">
          <div className="flex items-center gap-2 border-b border-sky-100 px-4 py-3">
            <Lightbulb size={17} className="text-sky-700" />
            <h3 className="text-sm font-black text-sky-950">
              تلميحات تساعدك
            </h3>
          </div>
          <div className="space-y-2 p-4">
            {hints.map((hint, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-xl bg-white px-3 py-2.5"
              >
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-black text-sky-700">
                  {index + 1}
                </span>
                <MathText block className="font-semibold leading-7 text-slate-700">
                  {hint}
                </MathText>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* كتابة منظمة */}
      {formalWriting.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/50">
          <div className="flex items-center gap-2 border-b border-violet-100 px-4 py-3">
            <PenLine size={17} className="text-violet-700" />
            <h3 className="text-sm font-black text-violet-950">
              منهجية الكتابة
            </h3>
          </div>
          <div className="space-y-2 p-4">
            {formalWriting.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-xl bg-white px-3 py-2.5"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-700 text-[11px] font-black text-white">
                  {index + 1}
                </span>
                <MathText block className="font-semibold leading-7 text-slate-700">
                  {item}
                </MathText>
              </div>
            ))}
          </div>
        </section>
      )}

      {mistakes.length > 0 && (
        <PlainList
          icon={<TriangleAlert size={18} />}
          title="أخطاء شائعة يجب تجنبها"
          items={mistakes}
        />
      )}

      {exercise?.id && !exercise?.is_generated && (
        <QuestionReExplanationPanel
          exercise={exercise}
          question={question}
          questionIndex={questionIndex}
          stepExplanations={stepExplanations}
          visibleStepExplanations={visibleStepExplanations}
          loadingStepKey={loadingStepKey}
          stepErrors={stepErrors}
          stepHistories={stepHistories}
          loadingSavedExplanations={loadingSavedExplanations}
          onQuestionReExplanation={onQuestionReExplanation}
          onSelectSavedExplanation={onSelectSavedExplanation}
        />
      )}
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

function SolutionStep({
  step,
  fallbackNumber,
  isLast = false,
  exerciseId,
  questionId,
  questionNumber,
}) {
  const number =
    step?.step_number ??
    step?.order ??
    step?.number ??
    fallbackNumber;

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

  const ruleUsed =
    step?.rule_used ||
    step?.rule ||
    step?.formula_used ||
    "";

  const why =
    step?.why ||
    step?.reason ||
    step?.goal ||
    "";

  const result =
    step?.result ||
    step?.conclusion ||
    step?.answer ||
    "";

  const studentTip =
    step?.student_tip ||
    step?.tip ||
    step?.note ||
    "";

  const stepGraphs = getStepGraphs(step);
  const stepTables = getStepTables(step);
  const indeterminateForm = getStepIndeterminateForm(step);

  return (
    <article
      dir="rtl"
      data-tutor-context
      data-tutor-exercise-kind="bac_exercise"
      data-tutor-exercise-id={exerciseId ?? ""}
      data-tutor-question-id={questionId ?? ""}
      data-tutor-question-number={questionNumber ?? ""}
      data-tutor-step-id={step?.id ?? step?.step_id ?? number}
      data-tutor-step-number={number}
      data-tutor-step-title={step?.title || `الخطوة ${number}`}
      data-tutor-step-type="bac_solution_step"
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        indeterminateForm
          ? "border-amber-300"
          : isLast
            ? "border-emerald-200"
            : "border-slate-200"
      )}
    >
      {/* رأس الخطوة */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5",
          indeterminateForm
            ? "border-amber-200 bg-amber-50/80"
            : isLast
              ? "border-emerald-100 bg-emerald-50/50"
              : "border-slate-100 bg-slate-50/75"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm",
              indeterminateForm
                ? "bg-amber-500"
                : isLast
                  ? "bg-emerald-700"
                  : "bg-indigo-700"
            )}
          >
            {number}
          </span>

          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400">
              الخطوة {number}
            </p>
            <h4 className="mt-0.5 break-words text-[15px] font-black leading-7 text-slate-950 sm:text-base">
              {hasText(step?.title) ? step.title : `المرحلة ${number}`}
            </h4>
          </div>
        </div>

        {isLast && !indeterminateForm && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-black text-emerald-700">
            <CheckCircle2 size={14} />
            آخر خطوة
          </span>
        )}
      </div>

      {indeterminateForm && (
        <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50/45 px-4 py-3 sm:px-5">
          <TriangleAlert size={16} className="mt-1 shrink-0 text-amber-700" />
          <p className="text-xs font-bold leading-6 text-amber-900">
            {indeterminateForm.label} — يجب رفعها قبل متابعة الحساب.
          </p>
        </div>
      )}

      {/* محتوى الخطوة */}
      <div className="min-w-0 space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        {hasText(step?.explanation) && (
          <div className="min-w-0">
            <RichExerciseText className="max-w-full text-[15px] font-semibold leading-9 text-slate-700 sm:text-base">
              {step.explanation}
            </RichExerciseText>
          </div>
        )}

        {/* القاعدة المستعملة */}
        {hasText(ruleUsed) && (
          <div className="grid min-w-0 gap-2 rounded-xl border border-amber-100 bg-amber-50/55 px-4 py-3 sm:grid-cols-[130px_minmax(0,1fr)] sm:items-center">
            <p className="text-xs font-black text-amber-700">
              القاعدة المستعملة
            </p>
            <MathText block className="min-w-0 font-bold leading-8 text-slate-900">
              {ruleUsed}
            </MathText>
          </div>
        )}

        {/* الحساب الرئيسي */}
        {hasText(mainLatex) && (
          <div className="min-w-0 space-y-2">
            <p className="px-1 text-xs font-black text-slate-500">
              الحساب
            </p>
            <CalculationBox value={mainLatex} />
          </div>
        )}

        {/* تفاصيل الحساب */}
        {calculations.length > 0 && (
          <div className="min-w-0 space-y-2.5">
            <p className="px-1 text-xs font-black text-slate-500">
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

        {/* الشرح والنصيحة في صف منظم على الشاشات الكبيرة */}
        {(hasText(why) || hasText(studentTip)) && (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {hasText(why) && (
              <div className="flex min-w-0 items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/55 px-4 py-3">
                <Lightbulb
                  size={17}
                  className="mt-1.5 shrink-0 text-indigo-600"
                />
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-black text-indigo-600">
                    لماذا هذه الخطوة؟
                  </p>
                  <MathText block className="min-w-0 font-semibold leading-8 text-slate-700">
                    {why}
                  </MathText>
                </div>
              </div>
            )}

            {hasText(studentTip) && (
              <div className="flex min-w-0 items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
                <Sparkles
                  size={16}
                  className="mt-1.5 shrink-0 text-sky-600"
                />
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-black text-sky-700">
                    نصيحة للتلميذ
                  </p>
                  <MathText block className="min-w-0 font-semibold leading-8 text-slate-700">
                    {studentTip}
                  </MathText>
                </div>
              </div>
            )}
          </div>
        )}

        {stepGraphs.length > 0 && (
          <div className="min-w-0 space-y-4 border-t border-slate-100 pt-4">
            {stepGraphs.map((graph, graphIndex) => (
              <GraphRenderer
                key={`step-graph-${number}-${graphIndex}`}
                graph={graph}
              />
            ))}
          </div>
        )}

        {stepTables.length > 0 && (
          <div className="min-w-0 space-y-4 border-t border-slate-100 pt-4">
            {stepTables.map((table, tableIndex) => (
              <SmartMathTable
                key={`step-table-${number}-${tableIndex}`}
                table={table}
              />
            ))}
          </div>
        )}

        {/* نتيجة الخطوة */}
        {hasText(result) && (
          <div className="flex min-w-0 items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/75 px-4 py-3.5">
            <CheckCircle2
              size={18}
              className="mt-1.5 shrink-0 text-emerald-700"
            />
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-black text-emerald-700">
                نتيجة هذه الخطوة
              </p>
              <MathText block className="min-w-0 font-black leading-8 text-emerald-950">
                {result}
              </MathText>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function QuestionReExplanationPanel({
  exercise,
  question,
  questionIndex,
  stepExplanations,
  visibleStepExplanations,
  loadingStepKey,
  stepErrors,
  stepHistories,
  loadingSavedExplanations,
  onQuestionReExplanation,
  onSelectSavedExplanation,
}) {
  const key = questionExplanationKey(
    exercise,
    question,
    questionIndex
  );

  const explanation = stepExplanations[key];
  const explanationVisible =
    Boolean(visibleStepExplanations[key]);

  const isLoading = loadingStepKey === key;
  const error = stepErrors[key];
  const history = asArray(stepHistories?.[key]);

  return (
    <section
      className="
        mt-2
        rounded-2xl
        border
        border-violet-200
        bg-gradient-to-l
        from-violet-50
        to-white
        p-4
        sm:p-5
      "
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            onQuestionReExplanation(
              exercise,
              question,
              questionIndex,
              false
            )
          }
          disabled={isLoading}
          className="
            inline-flex
            min-h-11
            items-center
            gap-2
            rounded-xl
            bg-violet-700
            px-5
            py-2.5
            text-sm
            font-black
            text-white
            shadow-sm
            transition
            hover:bg-violet-800
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Sparkles size={16} />
          )}

          {explanation
            ? explanationVisible
              ? "إخفاء الشرح المبسط"
              : "إظهار الشرح المبسط"
            : "لم أفهم السؤال"}
        </button>

        {explanation && (
          <button
            type="button"
            onClick={() =>
              onQuestionReExplanation(
                exercise,
                question,
                questionIndex,
                true
              )
            }
            disabled={isLoading}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={15} />
            شرح آخر للسؤال
          </button>
        )}
      </div>

      {loadingSavedExplanations && !explanation && (
        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500">
          <Loader2 className="animate-spin" size={14} />
          جاري البحث عن شرح محفوظ لهذا السؤال...
        </div>
      )}

      {history.length > 1 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-3">
          <p className="mb-2 text-xs font-black text-slate-700">
            الشروحات المحفوظة لهذا السؤال
          </p>

          <div className="flex flex-wrap gap-2">
            {history.map((item, historyIndex) => (
              <button
                key={item?.id ?? historyIndex}
                type="button"
                onClick={() =>
                  onSelectSavedExplanation(key, item)
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
              >
                شرح {history.length - historyIndex}
                {item?.created_at
                  ? ` - ${new Date(
                      item.created_at
                    ).toLocaleDateString("ar-DZ")}`
                  : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
          <AlertCircle
            className="mt-0.5 shrink-0"
            size={17}
          />
          <span>{error}</span>
        </div>
      )}

      {explanationVisible && explanation && (
        <SimpleExplanation explanation={explanation} />
      )}
    </section>
  );
}

function CalculationBox({ value, order = null }) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  return (
    <div
      dir="ltr"
      className="relative min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/85 px-4 py-3.5 text-center sm:px-6 sm:py-4"
    >
      {order !== null && (
        <span className="absolute left-2.5 top-2.5 flex h-6 min-w-6 items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-black text-slate-600 shadow-sm">
          {order}
        </span>
      )}

      <MathLTR
        block
        className="min-w-max px-2 text-base font-bold text-slate-950 sm:text-lg"
      >
        {normalized}
      </MathLTR>
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



function PhysicsDiagramFrame({ graph, children, ariaLabel }) {
  return (
    <figure className="mx-auto my-5 max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {hasText(graph?.title) && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h4 className="text-center text-sm font-black text-slate-950 sm:text-base">
            {graph.title}
          </h4>
        </div>
      )}

      <div className="p-3 sm:p-5">
        <svg
          viewBox="0 0 640 360"
          role="img"
          aria-label={ariaLabel}
          className="mx-auto h-auto w-full max-w-[640px]"
        >
          <defs>
            <marker id="p-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
              <path d="M0,0 L0,9 L9,4.5 z" fill="#111827" />
            </marker>
          </defs>
          {children}
        </svg>
      </div>

      {hasText(graph?.description) && (
        <figcaption className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-center text-xs font-bold leading-6 text-slate-600">
          {graph.description}
        </figcaption>
      )}
    </figure>
  );
}

function SvgLabel({
  x,
  y,
  children,
  anchor = "middle",
  size = 17,
  weight = 700,
  fill = "#111827",
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      fill={fill}
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      {children}
    </text>
  );
}

function PhysicsDiagram({ graph }) {
  const type = graph?.diagram_type;

  if (type === "satellite_earth_force" || type === "orbital_force") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوة جذب الأرض للقمر الاصطناعي">
        <circle cx="285" cy="190" r="105" fill="none" stroke="#111827" strokeWidth="2.5" />
        <circle cx="285" cy="190" r="24" fill="#f8fafc" stroke="#111827" strokeWidth="2.5" />
        <circle cx="285" cy="190" r="7" fill="#111827" />

        <line x1="285" y1="310" x2="285" y2="38" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)" />
        <line x1="285" y1="190" x2="430" y2="190" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)" />

        <circle cx="360" cy="116" r="7" fill="#fff" stroke="#111827" strokeWidth="2.5" />
        <line x1="285" y1="190" x2="360" y2="116" stroke="#111827" strokeWidth="2" />
        <line x1="356" y1="120" x2="318" y2="158" stroke="#111827" strokeWidth="3.5" markerEnd="url(#p-arrow)" />

        <SvgLabel x="270" y="184">O</SvgLabel>
        <SvgLabel x="303" y="215">T</SvgLabel>
        <SvgLabel x="330" y="232">الأرض</SvgLabel>
        <SvgLabel x="374" y="111" anchor="start">S</SvgLabel>
        <SvgLabel x="393" y="111" anchor="start">قمر اصطناعي</SvgLabel>
        <SvgLabel x="322" y="143">r</SvgLabel>
        <SvgLabel x="343" y="151" anchor="start">F</SvgLabel>
        <SvgLabel x="298" y="34" anchor="start" size="14">نجم ثابت</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "inclined_circular_track") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="المسار المائل والدائري">
        <line x1="70" y1="80" x2="260" y2="205" stroke="#111827" strokeWidth="3" />
        <path d="M260 205 Q335 285 410 205" fill="none" stroke="#111827" strokeWidth="3" />
        <line x1="410" y1="205" x2="565" y2="205" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="335" y1="105" x2="260" y2="205" stroke="#111827" strokeDasharray="7 6" strokeWidth="2" />
        <line x1="335" y1="105" x2="410" y2="205" stroke="#111827" strokeDasharray="7 6" strokeWidth="2" />
        <line x1="335" y1="105" x2="335" y2="245" stroke="#111827" strokeDasharray="7 6" strokeWidth="2" />
        <line x1="410" y1="260" x2="410" y2="105" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)" />
        <path d="M215 205 A45 45 0 0 1 226 177" fill="none" stroke="#111827" strokeWidth="1.8" />

        <SvgLabel x="70" y="68">A</SvgLabel>
        <SvgLabel x="250" y="225">B</SvgLabel>
        <SvgLabel x="420" y="225">C</SvgLabel>
        <SvgLabel x="335" y="98">O</SvgLabel>
        <SvgLabel x="335" y="269">I</SvgLabel>
        <SvgLabel x="292" y="150">r</SvgLabel>
        <SvgLabel x="376" y="150">r</SvgLabel>
        <SvgLabel x="225" y="199">α</SvgLabel>
        <SvgLabel x="577" y="211">M</SvgLabel>
        <SvgLabel x="425" y="105" anchor="start">y</SvgLabel>
        <SvgLabel x="580" y="204" anchor="start">x</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "inclined_plane_forces") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="القوى على جسم فوق مستوى مائل">
        <line x1="95" y1="105" x2="500" y2="300" stroke="#111827" strokeWidth="3" />
        <circle cx="285" cy="197" r="8" fill="#fff" stroke="#111827" strokeWidth="2.5" />
        <line x1="285" y1="197" x2="285" y2="300" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="285" y1="197" x2="330" y2="105" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="285" y1="197" x2="340" y2="82" stroke="#64748b" strokeDasharray="7 6" strokeWidth="1.8" />
        <path d="M430 300 A55 55 0 0 0 405 270" fill="none" stroke="#111827" strokeWidth="1.8" />

        <SvgLabel x="274" y="188">S</SvgLabel>
        <SvgLabel x="274" y="324">P</SvgLabel>
        <SvgLabel x="343" y="100">R₁</SvgLabel>
        <SvgLabel x="410" y="291">α</SvgLabel>
        <SvgLabel x="84" y="96">A</SvgLabel>
        <SvgLabel x="510" y="309">B</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "circular_low_point_forces") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="القوى عند أخفض نقطة I">
        <path d="M170 145 Q320 330 470 145" fill="none" stroke="#111827" strokeWidth="3" />
        <circle cx="320" cy="100" r="5" fill="#111827" />
        <circle cx="320" cy="285" r="7" fill="#fff" stroke="#111827" strokeWidth="2.5" />
        <line x1="320" y1="285" x2="320" y2="145" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="320" y1="285" x2="320" y2="340" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="320" y1="100" x2="320" y2="285" stroke="#64748b" strokeDasharray="7 6" strokeWidth="1.8" />

        <SvgLabel x="338" y="96" anchor="start">O</SvgLabel>
        <SvgLabel x="338" y="291" anchor="start">I</SvgLabel>
        <SvgLabel x="338" y="155" anchor="start">R₂</SvgLabel>
        <SvgLabel x="338" y="345" anchor="start">P</SvgLabel>
        <SvgLabel x="300" y="200">r</SvgLabel>
        <SvgLabel x="166" y="140">B</SvgLabel>
        <SvgLabel x="474" y="140">C</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "saturn_orbit" || type === "saturn_force") {
    const showForce = type === "saturn_force";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مدار زحل حول الشمس">
        <circle cx="300" cy="185" r="110" fill="none" stroke="#111827" strokeWidth="2.5" />
        <circle cx="300" cy="185" r="25" fill="#f1f5f9" stroke="#111827" strokeWidth="2.5" />
        <circle cx="300" cy="185" r="6" fill="#111827" />
        <circle cx="375" cy="105" r="7" fill="#111827" />
        <line x1="300" y1="185" x2="375" y2="105" stroke="#111827" strokeWidth="1.8" />
        {showForce && (
          <line x1="371" y1="110" x2="335" y2="148" stroke="#111827" strokeWidth="3.5" markerEnd="url(#p-arrow)" />
        )}

        <SvgLabel x="286" y="180">O</SvgLabel>
        <SvgLabel x="300" y="226">S الشمس</SvgLabel>
        <SvgLabel x="388" y="101" anchor="start">J زحل</SvgLabel>
        <SvgLabel x="338" y="137">r</SvgLabel>
        {showForce && <SvgLabel x="360" y="145" anchor="start">F</SvgLabel>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "car_braking_forces") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى السيارة أثناء الكبح">
        <line x1="85" y1="245" x2="555" y2="245" stroke="#111827" strokeWidth="3" />
        <circle cx="320" cy="205" r="7" fill="#111827" />
        <line x1="320" y1="205" x2="320" y2="100" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="320" y1="205" x2="320" y2="300" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="320" y1="205" x2="190" y2="205" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="320" y1="205" x2="510" y2="205" stroke="#64748b" strokeDasharray="8 6" strokeWidth="2" />
        <line x1="500" y1="170" x2="560" y2="170" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)" />

        <SvgLabel x="335" y="99" anchor="start">R</SvgLabel>
        <SvgLabel x="335" y="304" anchor="start">P</SvgLabel>
        <SvgLabel x="180" y="197" anchor="end">Ff/G</SvgLabel>
        <SvgLabel x="568" y="176" anchor="start">منحى الحركة</SvgLabel>
        <SvgLabel x="316" y="198" anchor="end">G</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "projectile_initial_conditions") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="شروط انطلاق الكرة">
        <line x1="120" y1="300" x2="545" y2="300" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="150" y1="320" x2="150" y2="70" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <circle cx="150" cy="185" r="7" fill="#fff" stroke="#111827" strokeWidth="2.5" />
        <line x1="150" y1="185" x2="255" y2="130" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="150" y1="185" x2="300" y2="185" stroke="#64748b" strokeDasharray="7 6" strokeWidth="1.8" />
        <line x1="115" y1="300" x2="115" y2="185" stroke="#64748b" strokeDasharray="7 6" strokeWidth="1.8" />
        <path d="M205 185 A55 55 0 0 0 198 161" fill="none" stroke="#111827" strokeWidth="1.8" />

        <SvgLabel x="135" y="180">A</SvgLabel>
        <SvgLabel x="267" y="127" anchor="start">v₀</SvgLabel>
        <SvgLabel x="205" y="174">α</SvgLabel>
        <SvgLabel x="101" y="245" anchor="end">h₀</SvgLabel>
        <SvgLabel x="137" y="325">O</SvgLabel>
        <SvgLabel x="560" y="306">i</SvgLabel>
        <SvgLabel x="137" y="68">j</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "falling_balloon_forces") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="القوى المؤثرة على البالونة أثناء السقوط">
        <circle cx="320" cy="180" r="34" fill="#fff" stroke="#111827" strokeWidth="2.5" />
        <circle cx="320" cy="180" r="5" fill="#111827" />
        <line x1="320" y1="180" x2="320" y2="300" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="305" y1="180" x2="305" y2="85" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="335" y1="180" x2="335" y2="100" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="225" y1="70" x2="225" y2="305" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)" />

        <SvgLabel x="337" y="305" anchor="start">P</SvgLabel>
        <SvgLabel x="290" y="80">Π</SvgLabel>
        <SvgLabel x="350" y="96">f</SvgLabel>
        <SvgLabel x="337" y="176" anchor="start">G</SvgLabel>
        <SvgLabel x="210" y="68">z′</SvgLabel>
        <SvgLabel x="210" y="320">z</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }


  if (type === "basketball_shot_setup") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="رسم تسديدة كرة السلة">
        {/* المحوران */}
        <line
          x1="95"
          y1="305"
          x2="565"
          y2="305"
          stroke="#111827"
          strokeWidth="3"
          markerEnd="url(#p-arrow)"
        />
        <line
          x1="115"
          y1="325"
          x2="115"
          y2="55"
          stroke="#111827"
          strokeWidth="3"
          markerEnd="url(#p-arrow)"
        />

        {/* نقطة الرمي A */}
        <circle
          cx="115"
          cy="190"
          r="10"
          fill="#ffffff"
          stroke="#111827"
          strokeWidth="2.5"
        />

        {/* السرعة الابتدائية */}
        <line
          x1="122"
          y1="184"
          x2="205"
          y2="115"
          stroke="#111827"
          strokeWidth="3"
          markerEnd="url(#p-arrow)"
        />

        {/* الأفق المار من A */}
        <line
          x1="115"
          y1="190"
          x2="245"
          y2="190"
          stroke="#64748b"
          strokeDasharray="7 6"
          strokeWidth="1.8"
        />

        {/* ارتفاع h0 */}
        <line
          x1="195"
          y1="305"
          x2="195"
          y2="190"
          stroke="#64748b"
          strokeDasharray="7 6"
          strokeWidth="1.8"
        />

        {/* مركز السلة C وموضعها */}
        <ellipse
          cx="470"
          cy="110"
          rx="42"
          ry="13"
          fill="#ffffff"
          stroke="#111827"
          strokeWidth="2.4"
        />
        <line
          x1="512"
          y1="110"
          x2="530"
          y2="110"
          stroke="#111827"
          strokeWidth="2.5"
        />
        <line
          x1="530"
          y1="88"
          x2="530"
          y2="132"
          stroke="#111827"
          strokeWidth="4"
        />

        {/* xc و zc */}
        <line
          x1="470"
          y1="305"
          x2="470"
          y2="123"
          stroke="#64748b"
          strokeDasharray="7 6"
          strokeWidth="1.8"
        />
        <line
          x1="115"
          y1="305"
          x2="470"
          y2="305"
          stroke="#64748b"
          strokeDasharray="9 7"
          strokeWidth="1.7"
        />

        {/* زاوية alpha */}
        <path
          d="M165 190 A50 50 0 0 0 155 158"
          fill="none"
          stroke="#111827"
          strokeWidth="1.8"
        />

        <SvgLabel x="98" y="188" anchor="end">A</SvgLabel>
        <SvgLabel x="213" y="111" anchor="start">v₀</SvgLabel>
        <SvgLabel x="160" y="177">α</SvgLabel>
        <SvgLabel x="182" y="252" anchor="end">h₀</SvgLabel>
        <SvgLabel x="470" y="88">C</SvgLabel>
        <SvgLabel x="488" y="220" anchor="start">z_C</SvgLabel>
        <SvgLabel x="292" y="326">x_C</SvgLabel>
        <SvgLabel x="101" y="328">O</SvgLabel>
        <SvgLabel x="575" y="311">x</SvgLabel>
        <SvgLabel x="101" y="55">z</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }



  if (type === "inclined_plane_2010" || type === "inclined_forces_no_friction_2010" || type === "inclined_forces_with_friction_2010") {
    const withForces = type !== "inclined_plane_2010";
    const withFriction = type === "inclined_forces_with_friction_2010";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مستوى مائل">
        <line x1="90" y1="290" x2="520" y2="130" stroke="#111827" strokeWidth="3"/>
        <line x1="120" y1="290" x2="540" y2="134" stroke="#64748b" strokeDasharray="8 6" strokeWidth="1.6"/>
        <rect x="270" y="195" width="56" height="42" rx="4" transform="rotate(-20 298 216)" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <path d="M115 290 A55 55 0 0 1 165 270" fill="none" stroke="#111827" strokeWidth="1.8"/>
        <SvgLabel x="155" y="284">α</SvgLabel><SvgLabel x="300" y="205">S</SvgLabel>
        <SvgLabel x="548" y="135">x′</SvgLabel><SvgLabel x="95" y="310">x</SvgLabel>
        {withForces && <>
          <circle cx="298" cy="215" r="4" fill="#111827"/>
          <line x1="298" y1="215" x2="298" y2="330" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="298" y1="215" x2="255" y2="105" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <SvgLabel x="312" y="335">P</SvgLabel><SvgLabel x="245" y="95">R</SvgLabel>
          {withFriction && <><line x1="298" y1="215" x2="205" y2="250" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/><SvgLabel x="190" y="258">f</SvgLabel></>}
        </>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "kepler_ellipse_2010") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مدار إهليلجي">
        <ellipse cx="320" cy="190" rx="210" ry="90" fill="none" stroke="#111827" strokeWidth="2.5"/>
        <line x1="110" y1="190" x2="530" y2="190" stroke="#94a3b8" strokeDasharray="7 6"/>
        <circle cx="235" cy="190" r="6" fill="#111827"/><circle cx="405" cy="190" r="5" fill="#111827"/>
        <SvgLabel x="235" y="215">F₁</SvgLabel><SvgLabel x="405" y="215">F₂</SvgLabel><SvgLabel x="235" y="175">الشمس</SvgLabel>
        <circle cx="420" cy="112" r="5" fill="#111827"/><circle cx="450" cy="118" r="5" fill="#111827"/>
        <circle cx="150" cy="165" r="5" fill="#111827"/><circle cx="140" cy="205" r="5" fill="#111827"/>
        <SvgLabel x="420" y="98">C</SvgLabel><SvgLabel x="452" y="104">C′</SvgLabel>
        <SvgLabel x="150" y="152">D</SvgLabel><SvgLabel x="132" y="226">D′</SvgLabel>
        <SvgLabel x="390" y="145">S₁</SvgLabel><SvgLabel x="175" y="185">S₂</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "planet_circular_2010" || type === "planet_force_2010") {
    const force = type === "planet_force_2010";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مدار دائري لكوكب حول الشمس">
        <circle cx="320" cy="190" r="120" fill="none" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="320" cy="190" r="7" fill="#111827"/>
        <circle cx="410" cy="110" r="7" fill="#111827"/>
        <line x1="320" y1="190" x2="410" y2="110" stroke="#64748b" strokeDasharray="7 6"/>
        {force && <line x1="405" y1="115" x2="350" y2="164" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>}
        <SvgLabel x="320" y="216">O</SvgLabel><SvgLabel x="320" y="238">الشمس</SvgLabel>
        <SvgLabel x="425" y="106">الكوكب</SvgLabel><SvgLabel x="365" y="145">r</SvgLabel>
        {force && <SvgLabel x="385" y="157">F</SvgLabel>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "falling_forces_archimedes_2010" || type === "falling_forces_no_archimedes_2010") {
    const arch = type === "falling_forces_archimedes_2010";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى جسم يسقط شاقوليا">
        <circle cx="320" cy="185" r="28" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="320" cy="185" r="4" fill="#111827"/>
        <line x1="320" y1="185" x2="320" y2="310" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1={arch?305:320} y1="185" x2={arch?305:320} y2="95" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        {arch && <line x1="335" y1="185" x2="335" y2="110" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>}
        <SvgLabel x="337" y="315">P</SvgLabel><SvgLabel x={arch?290:340} y="88">{arch?"Π":"f"}</SvgLabel>
        {arch && <SvgLabel x="352" y="104">f</SvgLabel>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "football_free_kick_2010") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="تنفيذ مخالفة كرة قدم">
        <line x1="90" y1="290" x2="555" y2="290" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="110" y1="310" x2="110" y2="70" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <circle cx="110" cy="290" r="6" fill="#111827"/>
        <line x1="110" y1="290" x2="205" y2="235" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="480" y1="290" x2="480" y2="190" stroke="#111827" strokeWidth="4"/>
        <line x1="480" y1="190" x2="540" y2="190" stroke="#111827" strokeWidth="4"/>
        <path d="M165 290 A55 55 0 0 0 158 263" fill="none" stroke="#111827" strokeWidth="1.8"/>
        <SvgLabel x="98" y="309">O</SvgLabel><SvgLabel x="215" y="230">v₀</SvgLabel><SvgLabel x="163" y="280">α</SvgLabel>
        <SvgLabel x="480" y="310">B</SvgLabel><SvgLabel x="480" y="180">A</SvgLabel><SvgLabel x="512" y="245">h</SvgLabel><SvgLabel x="295" y="315">d</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }



  if (type === "shot_put_2011") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="رمي الجلة">
        <line x1="95" y1="295" x2="560" y2="295" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="115" y1="315" x2="115" y2="60" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <circle cx="115" cy="220" r="6" fill="#111827" />
        <line x1="115" y1="220" x2="195" y2="155" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="115" y1="220" x2="205" y2="220" stroke="#64748b" strokeDasharray="7 6" />
        <path d="M115 220 Q315 45 505 295" fill="none" stroke="#111827" strokeWidth="2.5" />
        <line x1="90" y1="295" x2="90" y2="220" stroke="#64748b" strokeDasharray="7 6" />
        <path d="M165 220 A50 50 0 0 0 155 188" fill="none" stroke="#111827" strokeWidth="1.7" />
        <SvgLabel x="102" y="215" anchor="end">z₀</SvgLabel>
        <SvgLabel x="205" y="150">v₀</SvgLabel>
        <SvgLabel x="162" y="208">α</SvgLabel>
        <SvgLabel x="505" y="318">M</SvgLabel>
        <SvgLabel x="575" y="301">x</SvgLabel>
        <SvgLabel x="102" y="58">z</SvgLabel>
        <SvgLabel x="100" y="316">O</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "cart_pulley_2011" || type === "cart_pulley_forces_2011") {
    const forces = type === "cart_pulley_forces_2011";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="عربة وكتلة معلقة">
        <line x1="80" y1="300" x2="390" y2="125" stroke="#111827" strokeWidth="3"/>
        <circle cx="420" cy="105" r="22" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <line x1="290" y1="180" x2="400" y2="118" stroke="#111827" strokeWidth="2.5"/>
        <line x1="442" y1="105" x2="442" y2="255" stroke="#111827" strokeWidth="2.5"/>
        <rect x="250" y="180" width="58" height="42" rx="4" transform="rotate(-29 279 201)" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <rect x="417" y="245" width="50" height="55" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <path d="M95 300 A48 48 0 0 1 137 276" fill="none" stroke="#111827" strokeWidth="1.6"/>
        <SvgLabel x="280" y="194">S₁</SvgLabel><SvgLabel x="442" y="278">S₂</SvgLabel><SvgLabel x="125" y="292">α</SvgLabel>
        <SvgLabel x="158" y="278">A</SvgLabel><SvgLabel x="360" y="145">B</SvgLabel>
        {forces && <>
          <line x1="279" y1="201" x2="279" y2="315" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="279" y1="201" x2="228" y2="110" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="279" y1="201" x2="360" y2="155" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="279" y1="201" x2="205" y2="243" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="442" y1="272" x2="442" y2="185" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="442" y1="272" x2="442" y2="345" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <SvgLabel x="292" y="330">P₁</SvgLabel><SvgLabel x="215" y="100">R₁</SvgLabel>
          <SvgLabel x="366" y="150">T₁</SvgLabel><SvgLabel x="195" y="255">f</SvgLabel>
          <SvgLabel x="457" y="180">T₂</SvgLabel><SvgLabel x="457" y="350">P₂</SvgLabel>
        </>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "cart_candidate_graphs_2011") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="البيانات الثلاثة x بدلالة t²">
        {[0,1,2].map((i) => {
          const x0 = 55 + i*195;
          return <g key={i}>
            <line x1={x0} y1="285" x2={x0+145} y2="285" stroke="#111827" strokeWidth="2"/>
            <line x1={x0} y1="285" x2={x0} y2="95" stroke="#111827" strokeWidth="2"/>
            {i===0 && <line x1={x0} y1="285" x2={x0+130} y2="150" stroke="#111827" strokeWidth="3"/>}
            {i===1 && <path d={`M${x0} 285 Q${x0+45} 155 ${x0+130} 125`} fill="none" stroke="#111827" strokeWidth="3"/>}
            {i===2 && <line x1={x0} y1="125" x2={x0+130} y2="285" stroke="#111827" strokeWidth="3"/>}
            <SvgLabel x={x0+125} y="80">{`(${i+1})`}</SvgLabel>
            <SvgLabel x={x0-8} y="90" anchor="end">x</SvgLabel>
            <SvgLabel x={x0+150} y="304">t²</SvgLabel>
          </g>
        })}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "box_xt_vt_2011") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="منحنيان للفاصلة والسرعة">
        <g>
          <line x1="70" y1="160" x2="290" y2="160" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
          <line x1="70" y1="160" x2="70" y2="45" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
          <path d="M70 160 Q145 65 230 65 L275 65" fill="none" stroke="#111827" strokeWidth="3"/>
          <SvgLabel x="250" y="55">(1)</SvgLabel><SvgLabel x="296" y="165">t</SvgLabel>
        </g>
        <g>
          <line x1="70" y1="330" x2="290" y2="330" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
          <line x1="70" y1="330" x2="70" y2="205" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
          <line x1="70" y1="230" x2="235" y2="330" stroke="#111827" strokeWidth="3"/>
          <line x1="235" y1="330" x2="275" y2="330" stroke="#111827" strokeWidth="3"/>
          <SvgLabel x="250" y="220">(2)</SvgLabel><SvgLabel x="296" y="335">t</SvgLabel>
        </g>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "box_forces_2011") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="القوى على صندوق أفقي">
        <line x1="100" y1="250" x2="540" y2="250" stroke="#111827" strokeWidth="3"/>
        <rect x="270" y="195" width="85" height="55" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="312" cy="220" r="4" fill="#111827"/>
        <line x1="312" y1="220" x2="312" y2="115" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="312" y1="220" x2="312" y2="325" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="312" y1="220" x2="190" y2="220" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="355" y1="190" x2="470" y2="190" stroke="#64748b" strokeDasharray="7 6"/>
        <SvgLabel x="328" y="110">R</SvgLabel><SvgLabel x="328" y="330">P</SvgLabel><SvgLabel x="180" y="212">f</SvgLabel><SvgLabel x="480" y="196">x</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "alsat_force_2011") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوة جذب الأرض للقمر Alsat1">
        <circle cx="300" cy="190" r="115" fill="none" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="300" cy="190" r="28" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <SvgLabel x="300" y="196">T</SvgLabel>
        <circle cx="400" cy="130" r="7" fill="#111827"/>
        <line x1="395" y1="134" x2="340" y2="167" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="400" y1="130" x2="448" y2="208" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="300" y1="190" x2="400" y2="130" stroke="#64748b" strokeDasharray="7 6"/>
        <SvgLabel x="414" y="126">S</SvgLabel><SvgLabel x="365" y="145">F</SvgLabel><SvgLabel x="455" y="214">v</SvgLabel><SvgLabel x="345" y="154">r</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "falling_ball_two_graphs_2011") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="بيانا السرعة والتسارع">
        <g>
          <line x1="70" y1="160" x2="290" y2="160" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
          <line x1="70" y1="160" x2="70" y2="45" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
          <path d="M70 160 Q125 65 235 65 L275 65" fill="none" stroke="#111827" strokeWidth="3"/>
          <SvgLabel x="250" y="55">(1)</SvgLabel><SvgLabel x="297" y="165">t</SvgLabel>
        </g>
        <g>
          <line x1="70" y1="330" x2="290" y2="330" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
          <line x1="70" y1="330" x2="70" y2="205" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
          <line x1="70" y1="230" x2="235" y2="330" stroke="#111827" strokeWidth="3"/>
          <SvgLabel x="250" y="220">(2)</SvgLabel><SvgLabel x="297" y="335">t</SvgLabel>
        </g>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "falling_ball_forces_phases_2011") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى كرية خلال مراحل السقوط">
        {[0,1,2].map((i) => {
          const x = 150 + i*170;
          return <g key={i}>
            <circle cx={x} cy="185" r="18" fill="#fff" stroke="#111827" strokeWidth="2.2"/>
            <line x1={x} y1="185" x2={x} y2="285" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
            <line x1={x-10} y1="185" x2={x-10} y2="105" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
            {i>0 && <line x1={x+10} y1="185" x2={x+10} y2={i===1 ? 125 : 95} stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>}
            <SvgLabel x={x+18} y="290">P</SvgLabel>
            <SvgLabel x={x-24} y="100">Π</SvgLabel>
            {i>0 && <SvgLabel x={x+25} y={i===1 ? 120 : 90}>f</SvgLabel>}
            <SvgLabel x={x} y="335" size="14">{i===0 ? "البداية" : i===1 ? "انتقالي" : "دائم"}</SvgLabel>
          </g>
        })}
      </PhysicsDiagramFrame>
    );
  }



  if (type === "helicopter_drop_2012") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="سقوط صندوق من مروحية">
        <line x1="120" y1="95" x2="555" y2="95" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="120" y1="90" x2="120" y2="310" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <circle cx="120" cy="95" r="6" fill="#111827" />
        <rect x="55" y="65" width="95" height="35" rx="12" fill="#fff" stroke="#111827" strokeWidth="2.3" />
        <line x1="75" y1="60" x2="155" y2="60" stroke="#111827" strokeWidth="2.3" />
        <line x1="65" y1="54" x2="165" y2="54" stroke="#111827" strokeWidth="2.3" />
        <path d="M120 95 Q330 135 470 285" fill="none" stroke="#111827" strokeWidth="2.5" strokeDasharray="8 6" />
        <line x1="85" y1="95" x2="85" y2="285" stroke="#64748b" strokeDasharray="7 6" />
        <line x1="70" y1="285" x2="535" y2="285" stroke="#64748b" strokeWidth="2" />
        <circle cx="470" cy="285" r="6" fill="#111827" />
        <SvgLabel x="105" y="115" anchor="end">O</SvgLabel>
        <SvgLabel x="565" y="101">x</SvgLabel>
        <SvgLabel x="105" y="320">z</SvgLabel>
        <SvgLabel x="68" y="198" anchor="end">h</SvgLabel>
        <SvgLabel x="483" y="302">M</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "phobos_orbit_2012" || type === "phobos_force_2012") {
    const force = type === "phobos_force_2012";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مدار فوبوس حول المريخ">
        <circle cx="315" cy="190" r="120" fill="none" stroke="#111827" strokeWidth="2.5" strokeDasharray="4 4" />
        <circle cx="315" cy="190" r="30" fill="#fff" stroke="#111827" strokeWidth="2.5" />
        <circle cx="315" cy="190" r="5" fill="#111827" />
        <circle cx="405" cy="110" r="7" fill="#111827" />
        <line x1="315" y1="190" x2="405" y2="110" stroke="#111827" strokeWidth="2" />
        {force && (
          <line x1="400" y1="115" x2="345" y2="164" stroke="#111827" strokeWidth="3.2" markerEnd="url(#p-arrow)" />
        )}
        <SvgLabel x="300" y="184">O</SvgLabel>
        <SvgLabel x="315" y="228">M</SvgLabel>
        <SvgLabel x="420" y="106">P</SvgLabel>
        <SvgLabel x="360" y="143">r</SvgLabel>
        {force && <SvgLabel x="382" y="158">F</SvgLabel>}
      </PhysicsDiagramFrame>
    );
  }

  if (
    type === "inclined_body_2012" ||
    type === "inclined_smooth_forces_2012" ||
    type === "inclined_friction_forces_2012"
  ) {
    const smoothForces = type === "inclined_smooth_forces_2012";
    const frictionForces = type === "inclined_friction_forces_2012";
    const forces = smoothForces || frictionForces;
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="جسم على مستوى مائل">
        <line x1="95" y1="285" x2="535" y2="125" stroke="#111827" strokeWidth="3" />
        <line x1="100" y1="285" x2="545" y2="123" stroke="#64748b" strokeDasharray="8 6" />
        <rect x="280" y="190" width="62" height="44" rx="4" transform="rotate(-20 311 212)" fill="#fff" stroke="#111827" strokeWidth="2.5" />
        <path d="M105 285 A55 55 0 0 1 155 267" fill="none" stroke="#111827" strokeWidth="1.7" />
        <SvgLabel x="145" y="280">α</SvgLabel>
        <SvgLabel x="310" y="205">S</SvgLabel>
        <SvgLabel x="550" y="122">x</SvgLabel>
        <SvgLabel x="85" y="300">x′</SvgLabel>
        <SvgLabel x="112" y="269">O</SvgLabel>
        {forces && <>
          <circle cx="311" cy="212" r="4" fill="#111827" />
          <line x1="311" y1="212" x2="311" y2="330" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
          <line x1="311" y1="212" x2="270" y2="105" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
          <SvgLabel x="325" y="335">P</SvgLabel>
          <SvgLabel x="257" y="98">Rₙ</SvgLabel>
          {frictionForces && <>
            <line x1="311" y1="212" x2="220" y2="245" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
            <SvgLabel x="205" y="255">f</SvgLabel>
          </>}
        </>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "inclined_velocity_choices_2012") {
    const graphData = [
      {n:1, x1:0, y1:0, x2:100, y2:-100, x3:200, y3:0},
      {n:2, x1:0, y1:-100, x2:100, y2:0, x3:200, y3:100},
      {n:3, x1:0, y1:100, x2:100, y2:0, x3:200, y3:-100},
      {n:4, x1:0, y1:0, x2:100, y2:100, x3:200, y3:0},
    ];
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مخططات السرعة الأربعة">
        {graphData.map((g, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const ox = 75 + col * 285;
          const oy = 145 + row * 170;
          const scaleY = 0.55;
          return (
            <g key={g.n}>
              <line x1={ox} y1={oy} x2={ox+210} y2={oy} stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)" />
              <line x1={ox} y1={oy+65} x2={ox} y2={oy-75} stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)" />
              <polyline
                points={`${ox+g.x1},${oy-g.y1*scaleY} ${ox+g.x2},${oy-g.y2*scaleY} ${ox+g.x3},${oy-g.y3*scaleY}`}
                fill="none" stroke="#111827" strokeWidth="3"
              />
              <SvgLabel x={ox+178} y={oy-67}>({g.n})</SvgLabel>
              <SvgLabel x={ox-10} y={oy-78} anchor="end">v</SvgLabel>
              <SvgLabel x={ox+218} y={oy+18}>t</SvgLabel>
              <SvgLabel x={ox+100} y={oy+18} size="13">1</SvgLabel>
              <SvgLabel x={ox+200} y={oy+18} size="13">2</SvgLabel>
            </g>
          );
        })}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "shot_put_beijing_2012") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="رمي الجلة في ألعاب بكين">
        <line x1="90" y1="300" x2="560" y2="300" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="115" y1="320" x2="115" y2="65" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <circle cx="115" cy="220" r="6" fill="#111827" />
        <line x1="115" y1="220" x2="190" y2="145" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)" />
        <line x1="115" y1="220" x2="205" y2="220" stroke="#64748b" strokeDasharray="7 6" />
        <path d="M115 220 Q315 45 505 300" fill="none" stroke="#111827" strokeWidth="2.5" strokeDasharray="5 4" />
        <line x1="115" y1="335" x2="505" y2="335" stroke="#111827" strokeWidth="1.8" />
        <circle cx="505" cy="300" r="6" fill="#111827" />
        <path d="M165 220 A50 50 0 0 0 151 184" fill="none" stroke="#111827" strokeWidth="1.7" />
        <SvgLabel x="102" y="216" anchor="end">A</SvgLabel>
        <SvgLabel x="198" y="141">v₀</SvgLabel>
        <SvgLabel x="159" y="206">α</SvgLabel>
        <SvgLabel x="102" y="318">O</SvgLabel>
        <SvgLabel x="505" y="322">C</SvgLabel>
        <SvgLabel x="310" y="354">d = xC = 21.51 m</SvgLabel>
        <SvgLabel x="574" y="306">x</SvgLabel>
        <SvgLabel x="102" y="63">z</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }



  if (type === "motorcycle_ditch_2013") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مسلك دراجة نارية وخندق">
        <line x1="65" y1="250" x2="230" y2="250" stroke="#111827" strokeWidth="3"/>
        <line x1="230" y1="250" x2="365" y2="200" stroke="#111827" strokeWidth="3"/>
        <line x1="365" y1="200" x2="420" y2="200" stroke="#111827" strokeDasharray="7 6" strokeWidth="2"/>
        <line x1="420" y1="200" x2="420" y2="305" stroke="#111827" strokeWidth="2.5"/>
        <line x1="420" y1="305" x2="515" y2="305" stroke="#111827" strokeWidth="2.5"/>
        <line x1="515" y1="305" x2="515" y2="200" stroke="#111827" strokeWidth="2.5"/>
        <line x1="515" y1="200" x2="585" y2="200" stroke="#111827" strokeWidth="3"/>
        <line x1="365" y1="200" x2="365" y2="95" stroke="#111827" strokeDasharray="7 6" strokeWidth="2" markerEnd="url(#p-arrow)"/>
        <line x1="365" y1="200" x2="525" y2="200" stroke="#111827" strokeDasharray="7 6" strokeWidth="2" markerEnd="url(#p-arrow)"/>
        <line x1="365" y1="200" x2="440" y2="155" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <path d="M270 250 A45 45 0 0 0 266 232" fill="none" stroke="#111827" strokeWidth="1.6"/>
        <SvgLabel x="60" y="270">A</SvgLabel><SvgLabel x="228" y="270">B</SvgLabel>
        <SvgLabel x="355" y="220">C</SvgLabel><SvgLabel x="545" y="220">P</SvgLabel>
        <SvgLabel x="270" y="243">α</SvgLabel><SvgLabel x="448" y="148">vC</SvgLabel>
        <SvgLabel x="447" y="330">الخندق</SvgLabel><SvgLabel x="468" y="192">d</SvgLabel>
        <SvgLabel x="535" y="205">x</SvgLabel><SvgLabel x="350" y="93">y</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "motorcycle_forces_incline_2013") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى الدراجة فوق المسار المائل">
        <line x1="90" y1="290" x2="525" y2="140" stroke="#111827" strokeWidth="3"/>
        <rect x="275" y="200" width="65" height="42" rx="4" transform="rotate(-19 307 221)" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="307" cy="221" r="4" fill="#111827"/>
        <line x1="307" y1="221" x2="307" y2="330" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="307" y1="221" x2="270" y2="115" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="307" y1="221" x2="410" y2="185" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="307" y1="221" x2="215" y2="253" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="323" y="335">P</SvgLabel><SvgLabel x="258" y="108">Rₙ</SvgLabel>
        <SvgLabel x="420" y="182">F</SvgLabel><SvgLabel x="202" y="263">f</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "satellite_orbit_direction_2013" || type === "satellite_force_2013") {
    const force = type === "satellite_force_2013";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قمر اصطناعي حول الأرض">
        <circle cx="320" cy="190" r="125" fill="none" stroke="#111827" strokeWidth="2.5" strokeDasharray="10 6"/>
        <circle cx="320" cy="190" r="38" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="320" cy="190" r="5" fill="#111827"/>
        <circle cx="400" cy="95" r="8" fill="#111827"/>
        <path d="M205 135 Q180 170 195 205" fill="none" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        {force && <line x1="395" y1="101" x2="350" y2="155" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>}
        <SvgLabel x="320" y="242">الأرض</SvgLabel><SvgLabel x="415" y="92">S</SvgLabel>
        {force && <SvgLabel x="382" y="145">F</SvgLabel>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "parachutist_freefall_force_2013" || type === "parachutist_open_force_2013") {
    const opened = type === "parachutist_open_force_2013";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى المظلي">
        <circle cx="320" cy="180" r="16" fill="#fff" stroke="#111827" strokeWidth="2.4"/>
        <line x1="320" y1="180" x2="320" y2="300" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        {opened && <line x1="320" y1="180" x2="320" y2="75" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>}
        <line x1="225" y1="70" x2="225" y2="310" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="338" y="305">P</SvgLabel>
        {opened && <SvgLabel x="338" y="72">f</SvgLabel>}
        <SvgLabel x="210" y="325">z</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "satellite_normal_2013" || type === "satellite_acceleration_2013") {
    const acc = type === "satellite_acceleration_2013";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="القمر وشعاع الوحدة والتسارع">
        <circle cx="255" cy="235" r="70" fill="#fff" stroke="#111827" strokeWidth="2.7"/>
        <circle cx="255" cy="235" r="5" fill="#111827"/>
        <circle cx="420" cy="85" r="18" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <line x1="255" y1="235" x2="420" y2="85" stroke="#111827" strokeWidth="2.5"/>
        <line x1="300" y1="194" x2="392" y2="110" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        {acc && <line x1="410" y1="95" x2="345" y2="154" stroke="#111827" strokeWidth="3.5" markerEnd="url(#p-arrow)"/>}
        <SvgLabel x="238" y="230">O</SvgLabel><SvgLabel x="255" y="270">الأرض</SvgLabel>
        <SvgLabel x="445" y="88">S</SvgLabel><SvgLabel x="350" y="140">n</SvgLabel>
        {acc && <SvgLabel x="378" y="145">a</SvgLabel>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "box_pull_path_2013") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="جر صندوق على طريق أفقي">
        <line x1="80" y1="260" x2="560" y2="260" stroke="#111827" strokeWidth="3"/>
        <rect x="240" y="210" width="80" height="50" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="280" cy="235" r="4" fill="#111827"/>
        <line x1="280" y1="235" x2="390" y2="170" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="280" y1="235" x2="400" y2="235" stroke="#64748b" strokeDasharray="7 6"/>
        <path d="M340 235 A60 60 0 0 0 331 205" fill="none" stroke="#111827" strokeWidth="1.7"/>
        <line x1="390" y1="190" x2="500" y2="190" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="280" y="228">G</SvgLabel><SvgLabel x="400" y="164">F</SvgLabel>
        <SvgLabel x="340" y="223">α</SvgLabel><SvgLabel x="510" y="196">جهة الحركة</SvgLabel>
        <SvgLabel x="80" y="282">A</SvgLabel><SvgLabel x="410" y="282">B</SvgLabel><SvgLabel x="555" y="282">C</SvgLabel>
        <line x1="410" y1="260" x2="560" y2="260" stroke="#111827" strokeWidth="6" strokeDasharray="5 5"/>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "box_forces_ab_2013" || type === "box_forces_bc_2013") {
    const rough = type === "box_forces_bc_2013";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى الصندوق">
        <line x1="95" y1="255" x2="545" y2="255" stroke="#111827" strokeWidth="3"/>
        <rect x="280" y="205" width="80" height="50" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="320" cy="230" r="4" fill="#111827"/>
        <line x1="320" y1="230" x2="320" y2="115" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="320" y1="230" x2="320" y2="330" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="320" y1="230" x2="420" y2="170" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        {rough && <line x1="320" y1="230" x2="210" y2="230" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>}
        <SvgLabel x="338" y="110">R</SvgLabel><SvgLabel x="338" y="335">P</SvgLabel>
        <SvgLabel x="430" y="165">F</SvgLabel>{rough && <SvgLabel x="198" y="222">f</SvgLabel>}
      </PhysicsDiagramFrame>
    );
  }



  if (type === "alsat2_elliptic_orbit_2014" || type === "alsat2_force_2014") {
    const force = type === "alsat2_force_2014";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مدار Alsat 2 حول الأرض">
        <circle cx="320" cy="190" r="92" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <ellipse cx="320" cy="190" rx="155" ry="125" fill="none" stroke="#111827" strokeWidth="2.5" strokeDasharray="9 6"/>
        <circle cx="320" cy="190" r="5" fill="#111827"/>
        <g transform="translate(205 92)">
          <rect x="-10" y="-5" width="20" height="10" fill="#111827"/>
          <line x1="-28" y1="-12" x2="-10" y2="-5" stroke="#111827" strokeWidth="3"/>
          <line x1="10" y1="5" x2="28" y2="12" stroke="#111827" strokeWidth="3"/>
        </g>
        {force && <line x1="208" y1="97" x2="280" y2="160" stroke="#111827" strokeWidth="3.2" markerEnd="url(#p-arrow)"/>}
        <line x1="418" y1="87" x2="390" y2="113" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
        <line x1="210" y1="287" x2="235" y2="260" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="320" y="220">الأرض</SvgLabel>
        <SvgLabel x="188" y="82" anchor="end">Alsat 2</SvgLabel>
        <SvgLabel x="443" y="82">1000 km</SvgLabel>
        <SvgLabel x="194" y="305">600 km</SvgLabel>
        {force && <SvgLabel x="250" y="125">F</SvgLabel>}
      </PhysicsDiagramFrame>
    );
  }

  if (
    type === "two_bodies_pulley_2014" ||
    type === "two_bodies_forces_no_friction_2014" ||
    type === "two_bodies_forces_with_friction_2014"
  ) {
    const forces = type !== "two_bodies_pulley_2014";
    const friction = type === "two_bodies_forces_with_friction_2014";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="جسمان مربوطان بخيط">
        <line x1="95" y1="290" x2="430" y2="115" stroke="#111827" strokeWidth="3"/>
        <circle cx="465" cy="95" r="23" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <line x1="285" y1="190" x2="446" y2="105" stroke="#111827" strokeWidth="2.5"/>
        <line x1="488" y1="95" x2="488" y2="265" stroke="#111827" strokeWidth="2.5"/>
        <rect x="245" y="183" width="67" height="48" rx="4" transform="rotate(-28 279 207)" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <rect x="457" y="250" width="62" height="62" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <path d="M108 290 A55 55 0 0 1 158 267" fill="none" stroke="#111827" strokeWidth="1.6"/>
        <SvgLabel x="278" y="200">S₁</SvgLabel><SvgLabel x="488" y="286">S₂</SvgLabel>
        <SvgLabel x="146" y="282">α</SvgLabel><SvgLabel x="110" y="270">A</SvgLabel><SvgLabel x="370" y="145">B</SvgLabel>
        {forces && <>
          <circle cx="279" cy="207" r="4" fill="#111827"/>
          <line x1="279" y1="207" x2="279" y2="330" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="279" y1="207" x2="235" y2="105" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="279" y1="207" x2="370" y2="160" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="488" y1="280" x2="488" y2="190" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="488" y1="280" x2="488" y2="345" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <SvgLabel x="293" y="335">P₁</SvgLabel><SvgLabel x="222" y="98">Rₙ</SvgLabel>
          <SvgLabel x="380" y="155">T₁</SvgLabel><SvgLabel x="503" y="185">T₂</SvgLabel><SvgLabel x="503" y="350">P₂</SvgLabel>
          {friction && <>
            <line x1="279" y1="207" x2="205" y2="246" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
            <SvgLabel x="192" y="257">f</SvgLabel>
          </>}
        </>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "horizontal_circular_track_2014") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مسار أفقي ثم دائري">
        <line x1="80" y1="105" x2="355" y2="105" stroke="#111827" strokeWidth="3"/>
        <path d="M355 105 A130 130 0 0 1 485 235" fill="none" stroke="#111827" strokeWidth="3"/>
        <line x1="355" y1="235" x2="485" y2="235" stroke="#111827" strokeWidth="3"/>
        <circle cx="355" cy="235" r="5" fill="#111827"/>
        <circle cx="405" cy="115" r="6" fill="#111827"/>
        <line x1="355" y1="235" x2="405" y2="115" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <line x1="355" y1="105" x2="355" y2="235" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <path d="M355 165 A70 70 0 0 1 383 171" fill="none" stroke="#111827" strokeWidth="1.7"/>
        <rect x="150" y="82" width="45" height="23" fill="#fff" stroke="#111827" strokeWidth="2"/>
        <SvgLabel x="77" y="95">A</SvgLabel><SvgLabel x="350" y="95">B</SvgLabel>
        <SvgLabel x="355" y="260">O</SvgLabel><SvgLabel x="495" y="240">C</SvgLabel>
        <SvgLabel x="420" y="108">N</SvgLabel><SvgLabel x="380" y="158">θ</SvgLabel>
        <SvgLabel x="173" y="77">S</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "horizontal_friction_forces_2014") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى جسم على سطح أفقي خشن">
        <line x1="95" y1="250" x2="545" y2="250" stroke="#111827" strokeWidth="3"/>
        <rect x="285" y="205" width="75" height="45" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="322" cy="228" r="4" fill="#111827"/>
        <line x1="322" y1="228" x2="322" y2="120" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="322" y1="228" x2="322" y2="330" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="322" y1="228" x2="215" y2="228" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="338" y="115">R</SvgLabel><SvgLabel x="338" y="335">P</SvgLabel><SvgLabel x="202" y="220">f</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "circular_forces_at_n_2014") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="القوى عند نقطة N على المسار الدائري">
        <path d="M190 100 A155 155 0 0 1 500 255" fill="none" stroke="#111827" strokeWidth="3"/>
        <circle cx="345" cy="255" r="5" fill="#111827"/>
        <circle cx="405" cy="115" r="7" fill="#111827"/>
        <line x1="345" y1="255" x2="405" y2="115" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <line x1="405" y1="115" x2="365" y2="207" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="405" y1="115" x2="405" y2="250" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="418" y="108">N</SvgLabel><SvgLabel x="340" y="278">O</SvgLabel>
        <SvgLabel x="368" y="195">R</SvgLabel><SvgLabel x="420" y="255">P</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "velocity_components_triangle_2014") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مركبات السرعة الابتدائية">
        <line x1="170" y1="285" x2="500" y2="285" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="170" y1="285" x2="170" y2="70" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="170" y1="285" x2="390" y2="135" stroke="#111827" strokeWidth="3.5" markerEnd="url(#p-arrow)"/>
        <line x1="170" y1="285" x2="390" y2="285" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <line x1="390" y1="285" x2="390" y2="135" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <path d="M245 285 A75 75 0 0 0 232 243" fill="none" stroke="#111827" strokeWidth="1.7"/>
        <SvgLabel x="400" y="130">v₀</SvgLabel><SvgLabel x="280" y="307">v₀x</SvgLabel>
        <SvgLabel x="410" y="215">v₀y</SvgLabel><SvgLabel x="240" y="272">α</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "horizontal_then_projectile_2014") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="حركة أفقية ثم قذف">
        <line x1="75" y1="110" x2="365" y2="110" stroke="#111827" strokeWidth="3"/>
        <rect x="125" y="77" width="55" height="33" fill="#fff" stroke="#111827" strokeWidth="2.3"/>
        <circle cx="365" cy="110" r="5" fill="#111827"/>
        <path d="M365 110 Q470 145 515 270" fill="none" stroke="#111827" strokeWidth="2.4" strokeDasharray="7 5"/>
        <line x1="365" y1="270" x2="560" y2="270" stroke="#111827" strokeWidth="5" strokeDasharray="7 5"/>
        <line x1="365" y1="110" x2="365" y2="300" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
        <line x1="365" y1="110" x2="565" y2="110" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="72" y="100">A</SvgLabel><SvgLabel x="360" y="100">B</SvgLabel>
        <SvgLabel x="350" y="287">D</SvgLabel><SvgLabel x="525" y="292">E</SvgLabel>
        <SvgLabel x="580" y="116">x</SvgLabel><SvgLabel x="350" y="315">y</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "horizontal_body_forces_2014") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="القوى على الجسم فوق AB">
        <line x1="95" y1="250" x2="545" y2="250" stroke="#111827" strokeWidth="3"/>
        <rect x="280" y="200" width="80" height="50" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="320" cy="225" r="4" fill="#111827"/>
        <line x1="320" y1="225" x2="320" y2="110" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="320" y1="225" x2="320" y2="335" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="320" y1="225" x2="205" y2="225" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="338" y="105">Rₙ</SvgLabel><SvgLabel x="338" y="340">P</SvgLabel><SvgLabel x="192" y="217">f</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "projectile_force_from_b_2014") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوة الثقل أثناء القذف">
        <line x1="100" y1="100" x2="365" y2="100" stroke="#111827" strokeWidth="3"/>
        <path d="M365 100 Q470 140 515 275" fill="none" stroke="#111827" strokeWidth="2.5" strokeDasharray="7 5"/>
        <circle cx="430" cy="145" r="8" fill="#fff" stroke="#111827" strokeWidth="2.3"/>
        <line x1="430" y1="145" x2="430" y2="265" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="365" y="88">B</SvgLabel><SvgLabel x="447" y="270">P</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }



  if (type === "falling_sphere_linear_drag_2015") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى كرية تسقط في الهواء">
        <circle cx="320" cy="180" r="24" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="320" cy="180" r="4" fill="#111827"/>
        <line x1="320" y1="180" x2="320" y2="305" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="320" y1="180" x2="320" y2="80" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="225" y1="65" x2="225" y2="315" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="338" y="310">P</SvgLabel>
        <SvgLabel x="338" y="75">f</SvgLabel>
        <SvgLabel x="210" y="330">z</SvgLabel>
        <SvgLabel x="210" y="60">O</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "skier_track_2015") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مسلك متزلج ثم سقوط">
        <line x1="80" y1="90" x2="270" y2="220" stroke="#111827" strokeWidth="3.2"/>
        <line x1="270" y1="220" x2="455" y2="220" stroke="#111827" strokeWidth="3.2"/>
        <line x1="455" y1="220" x2="455" y2="320" stroke="#111827" strokeWidth="2.5"/>
        <line x1="455" y1="320" x2="575" y2="320" stroke="#111827" strokeWidth="3.2" markerEnd="url(#p-arrow)"/>
        <line x1="455" y1="220" x2="455" y2="80" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <path d="M215 220 A55 55 0 0 1 232 190" fill="none" stroke="#111827" strokeWidth="1.7"/>
        <SvgLabel x="72" y="83">A</SvgLabel>
        <SvgLabel x="270" y="245">B</SvgLabel>
        <SvgLabel x="455" y="210">C</SvgLabel>
        <SvgLabel x="440" y="342">O</SvgLabel>
        <SvgLabel x="560" y="342">E</SvgLabel>
        <SvgLabel x="225" y="211">α</SvgLabel>
        <SvgLabel x="438" y="270" anchor="end">h</SvgLabel>
        <SvgLabel x="590" y="326">x</SvgLabel>
        <SvgLabel x="470" y="80">y</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "skier_incline_forces_2015") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى المتزلج على المستوى المائل">
        <line x1="95" y1="105" x2="520" y2="295" stroke="#111827" strokeWidth="3"/>
        <circle cx="305" cy="200" r="10" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <line x1="305" y1="200" x2="305" y2="325" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="305" y1="200" x2="350" y2="100" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="305" y1="200" x2="220" y2="162" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="320" y="330">P</SvgLabel>
        <SvgLabel x="365" y="95">R</SvgLabel>
        <SvgLabel x="208" y="157">f</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "tennis_court_plan_2015") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="منطقة إرسال كرة التنس">
        <rect x="90" y="75" width="460" height="220" fill="#fff" stroke="#111827" strokeWidth="2.8"/>
        <line x1="320" y1="75" x2="320" y2="295" stroke="#111827" strokeWidth="2.5"/>
        <line x1="320" y1="185" x2="550" y2="185" stroke="#111827" strokeWidth="2.2"/>
        <line x1="440" y1="75" x2="440" y2="295" stroke="#111827" strokeWidth="2" strokeDasharray="8 6"/>
        <circle cx="75" cy="185" r="9" fill="#111827"/>
        <circle cx="455" cy="115" r="9" fill="#111827"/>
        <line x1="83" y1="182" x2="447" y2="118" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <SvgLabel x="60" y="190" anchor="end">O</SvgLabel>
        <SvgLabel x="470" y="110">B</SvgLabel>
        <SvgLabel x="260" y="132">L</SvgLabel>
        <SvgLabel x="325" y="320">الشبكة</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "tennis_serve_setup_2015") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="هندسة إرسال كرة التنس">
        <line x1="100" y1="300" x2="560" y2="300" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="120" y1="320" x2="120" y2="60" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <circle cx="120" cy="170" r="7" fill="#111827"/>
        <line x1="120" y1="170" x2="220" y2="170" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="405" y1="300" x2="405" y2="205" stroke="#111827" strokeWidth="5"/>
        <line x1="500" y1="300" x2="500" y2="275" stroke="#111827" strokeWidth="2.5"/>
        <SvgLabel x="104" y="165" anchor="end">D</SvgLabel>
        <SvgLabel x="230" y="165">v₀</SvgLabel>
        <SvgLabel x="105" y="322">O</SvgLabel>
        <SvgLabel x="405" y="195">الشبكة</SvgLabel>
        <SvgLabel x="405" y="325">F</SvgLabel>
        <SvgLabel x="500" y="325">B</SvgLabel>
        <SvgLabel x="575" y="306">x</SvgLabel>
        <SvgLabel x="105" y="60">y</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "tennis_ball_weight_2015") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوة الثقل على كرة التنس">
        <line x1="95" y1="300" x2="550" y2="300" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <line x1="115" y1="315" x2="115" y2="60" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <path d="M115 145 Q320 165 480 285" fill="none" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <circle cx="300" cy="190" r="11" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <line x1="300" y1="190" x2="300" y2="295" stroke="#111827" strokeWidth="3.2" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="318" y="300">P</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "two_carts_setup_2015" || type === "two_carts_forces_2015") {
    const forces = type === "two_carts_forces_2015";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="عربتان مربوطتان بخيط">
        <line x1="80" y1="160" x2="335" y2="160" stroke="#111827" strokeWidth="3"/>
        <circle cx="365" cy="160" r="20" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <line x1="385" y1="165" x2="530" y2="275" stroke="#111827" strokeWidth="3"/>
        <rect x="135" y="125" width="70" height="35" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <rect x="455" y="205" width="58" height="40" transform="rotate(37 484 225)" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <line x1="205" y1="142" x2="345" y2="153" stroke="#111827" strokeWidth="2.2"/>
        <line x1="385" y1="167" x2="455" y2="215" stroke="#111827" strokeWidth="2.2"/>
        <path d="M460 275 A58 58 0 0 0 505 255" fill="none" stroke="#111827" strokeWidth="1.7"/>
        <SvgLabel x="170" y="120">(A)</SvgLabel>
        <SvgLabel x="490" y="200">(B)</SvgLabel>
        <SvgLabel x="485" y="270">α</SvgLabel>
        <SvgLabel x="245" y="180">D</SvgLabel>
        {forces && <>
          <circle cx="170" cy="143" r="4" fill="#111827"/>
          <line x1="170" y1="143" x2="170" y2="70" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="170" y1="143" x2="170" y2="225" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="170" y1="143" x2="260" y2="143" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="170" y1="143" x2="90" y2="143" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <SvgLabel x="185" y="65">Rₐ</SvgLabel><SvgLabel x="185" y="230">Pₐ</SvgLabel>
          <SvgLabel x="270" y="138">Tₐ</SvgLabel><SvgLabel x="78" y="138">f</SvgLabel>

          <circle cx="484" cy="225" r="4" fill="#111827"/>
          <line x1="484" y1="225" x2="440" y2="155" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="484" y1="225" x2="484" y2="330" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="484" y1="225" x2="415" y2="172" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <SvgLabel x="425" y="150">Rᵦ</SvgLabel><SvgLabel x="500" y="335">Pᵦ</SvgLabel><SvgLabel x="405" y="165">Tᵦ</SvgLabel>
        </>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "planet_orbit_u_2015" || type === "planet_sun_force_2015") {
    const force = type === "planet_sun_force_2015";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مدار كوكب حول الشمس">
        <circle cx="320" cy="190" r="125" fill="none" stroke="#111827" strokeWidth="2.5" strokeDasharray="3 4"/>
        <circle cx="320" cy="190" r="6" fill="#111827"/>
        <circle cx="420" cy="115" r="7" fill="#111827"/>
        <line x1="320" y1="190" x2="420" y2="115" stroke="#111827" strokeWidth="2"/>
        <line x1="350" y1="168" x2="395" y2="134" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        {force && <line x1="415" y1="120" x2="360" y2="161" stroke="#111827" strokeWidth="3.2" markerEnd="url(#p-arrow)"/>}
        <SvgLabel x="305" y="185">O</SvgLabel>
        <SvgLabel x="435" y="112">A</SvgLabel>
        <SvgLabel x="365" y="145">r</SvgLabel>
        <SvgLabel x="390" y="145">u</SvgLabel>
        {force && <SvgLabel x="382" y="178">Fₛ/ₚ</SvgLabel>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "abcd_track_2015") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="المسار ABCD">
        <line x1="85" y1="90" x2="260" y2="205" stroke="#111827" strokeWidth="3.2"/>
        <line x1="260" y1="205" x2="430" y2="205" stroke="#111827" strokeWidth="3.2"/>
        <line x1="430" y1="205" x2="430" y2="305" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <line x1="430" y1="305" x2="570" y2="305" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <line x1="430" y1="305" x2="430" y2="85" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <rect x="128" y="103" width="45" height="28" transform="rotate(33 150 117)" fill="#fff" stroke="#111827" strokeWidth="2.3"/>
        <path d="M210 205 A50 50 0 0 1 225 178" fill="none" stroke="#111827" strokeWidth="1.7"/>
        <SvgLabel x="78" y="85">A</SvgLabel>
        <SvgLabel x="260" y="229">B</SvgLabel>
        <SvgLabel x="430" y="195">C</SvgLabel>
        <SvgLabel x="415" y="327">O</SvgLabel>
        <SvgLabel x="540" y="327">D</SvgLabel>
        <SvgLabel x="220" y="196">α</SvgLabel>
        <SvgLabel x="415" y="260" anchor="end">h</SvgLabel>
        <SvgLabel x="590" y="311">x</SvgLabel>
        <SvgLabel x="445" y="85">z</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "abcd_ab_forces_2015") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى الجسم على AB">
        <line x1="90" y1="100" x2="525" y2="300" stroke="#111827" strokeWidth="3"/>
        <rect x="280" y="190" width="60" height="44" transform="rotate(25 310 212)" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="310" cy="212" r="4" fill="#111827"/>
        <line x1="310" y1="212" x2="310" y2="335" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="310" y1="212" x2="355" y2="105" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="310" y1="212" x2="225" y2="173" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="325" y="340">P</SvgLabel>
        <SvgLabel x="370" y="100">R</SvgLabel>
        <SvgLabel x="212" y="167">f</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "abcd_bc_forces_2015") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى الجسم على BC">
        <line x1="100" y1="250" x2="540" y2="250" stroke="#111827" strokeWidth="3"/>
        <rect x="285" y="205" width="70" height="45" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="320" cy="225" r="4" fill="#111827"/>
        <line x1="320" y1="225" x2="320" y2="110" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="320" y1="225" x2="320" y2="335" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="338" y="105">R</SvgLabel>
        <SvgLabel x="338" y="340">P</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "abcd_projectile_weight_2015") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوة الثقل أثناء القذف من C">
        <line x1="105" y1="300" x2="550" y2="300" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <line x1="145" y1="320" x2="145" y2="70" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <circle cx="145" cy="120" r="6" fill="#111827"/>
        <line x1="145" y1="120" x2="240" y2="120" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <path d="M145 120 Q320 145 450 300" fill="none" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <circle cx="300" cy="180" r="9" fill="#fff" stroke="#111827" strokeWidth="2.4"/>
        <line x1="300" y1="180" x2="300" y2="285" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="130" y="112">C</SvgLabel>
        <SvgLabel x="250" y="115">vC</SvgLabel>
        <SvgLabel x="318" y="290">P</SvgLabel>
        <SvgLabel x="450" y="322">D</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }



  if (type === "kepler_equal_areas_2016") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مدار إهليلجي وقانون المساحات">
        <ellipse cx="320" cy="190" rx="235" ry="95" fill="none" stroke="#111827" strokeWidth="2.7"/>
        <line x1="85" y1="190" x2="555" y2="190" stroke="#94a3b8" strokeDasharray="8 6" strokeWidth="1.6"/>
        <circle cx="225" cy="190" r="6" fill="#111827"/>
        <circle cx="415" cy="190" r="5" fill="#111827"/>

        {/* قطاع قريب من الحضيض */}
        <path d="M225 190 L465 115 A235 95 0 0 1 500 133 Z" fill="#e5e7eb" stroke="#111827" strokeWidth="1.6"/>
        {/* قطاع بعيد قرب الأوج */}
        <path d="M225 190 L104 157 A235 95 0 0 0 103 220 Z" fill="#e5e7eb" stroke="#111827" strokeWidth="1.6"/>

        <circle cx="465" cy="115" r="5" fill="#111827"/>
        <circle cx="500" cy="133" r="5" fill="#111827"/>
        <circle cx="104" cy="157" r="5" fill="#111827"/>
        <circle cx="103" cy="220" r="5" fill="#111827"/>

        <SvgLabel x="225" y="214">F₁</SvgLabel>
        <SvgLabel x="415" y="214">F₂</SvgLabel>
        <SvgLabel x="475" y="103">M₁′</SvgLabel>
        <SvgLabel x="515" y="128">M₁</SvgLabel>
        <SvgLabel x="94" y="146">M₂</SvgLabel>
        <SvgLabel x="92" y="242">M₂′</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "incline_launch_to_ground_2016") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="جسم يغادر مستوى مائلا ويسقط على الأرض">
        <line x1="100" y1="90" x2="330" y2="220" stroke="#111827" strokeWidth="3.2"/>
        <line x1="80" y1="220" x2="330" y2="220" stroke="#111827" strokeWidth="2.4"/>
        <line x1="80" y1="320" x2="555" y2="320" stroke="#111827" strokeWidth="3"/>
        <rect x="170" y="115" width="55" height="35" rx="4" transform="rotate(29 198 132)" fill="#fff" stroke="#111827" strokeWidth="2.4"/>
        <circle cx="330" cy="220" r="5" fill="#111827"/>

        <line x1="330" y1="220" x2="570" y2="220" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <line x1="330" y1="220" x2="330" y2="340" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <line x1="330" y1="220" x2="395" y2="258" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <path d="M330 220 Q435 245 495 320" fill="none" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <line x1="300" y1="220" x2="300" y2="320" stroke="#64748b" strokeDasharray="7 6" strokeWidth="1.8"/>

        <SvgLabel x="90" y="83">A</SvgLabel>
        <SvgLabel x="205" y="117">S</SvgLabel>
        <SvgLabel x="315" y="214" anchor="end">O</SvgLabel>
        <SvgLabel x="505" y="340">N</SvgLabel>
        <SvgLabel x="405" y="260">v₀</SvgLabel>
        <SvgLabel x="315" y="272" anchor="end">h</SvgLabel>
        <SvgLabel x="585" y="226">x</SvgLabel>
        <SvgLabel x="315" y="350">y</SvgLabel>
        <SvgLabel x="285" y="214">α</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "incline_friction_forces_2016") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى جسم على مستوى مائل مع احتكاك">
        <line x1="95" y1="95" x2="525" y2="300" stroke="#111827" strokeWidth="3"/>
        <rect x="275" y="185" width="66" height="44" transform="rotate(26 308 207)" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="308" cy="207" r="4" fill="#111827"/>
        <line x1="308" y1="207" x2="308" y2="335" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="308" y1="207" x2="355" y2="100" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="308" y1="207" x2="220" y2="165" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="325" y="340">P</SvgLabel>
        <SvgLabel x="370" y="95">R</SvgLabel>
        <SvgLabel x="207" y="160">f</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "football_header_2016") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="رأسية كرة القدم نحو المرمى">
        <line x1="85" y1="305" x2="565" y2="305" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="105" y1="325" x2="105" y2="60" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <circle cx="105" cy="190" r="7" fill="#111827"/>
        <line x1="105" y1="190" x2="205" y2="130" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="105" y1="190" x2="220" y2="190" stroke="#64748b" strokeDasharray="7 6"/>
        <path d="M165 190 A60 60 0 0 0 157 160" fill="none" stroke="#111827" strokeWidth="1.7"/>
        <line x1="485" y1="305" x2="485" y2="170" stroke="#111827" strokeWidth="5"/>
        <line x1="470" y1="170" x2="500" y2="170" stroke="#111827" strokeWidth="4"/>
        <line x1="485" y1="305" x2="485" y2="170" stroke="#64748b" strokeDasharray="5 5"/>
        <SvgLabel x="90" y="184" anchor="end">B</SvgLabel>
        <SvgLabel x="215" y="125">v₀</SvgLabel>
        <SvgLabel x="162" y="178">α</SvgLabel>
        <SvgLabel x="88" y="252" anchor="end">hB</SvgLabel>
        <SvgLabel x="505" y="240">L</SvgLabel>
        <SvgLabel x="295" y="330">d</SvgLabel>
        <SvgLabel x="580" y="311">x</SvgLabel>
        <SvgLabel x="90" y="60">y</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (
    type === "inclined_recording_2016" ||
    type === "inclined_no_friction_forces_2016" ||
    type === "inclined_with_friction_forces_2016"
  ) {
    const forces = type !== "inclined_recording_2016";
    const friction = type === "inclined_with_friction_forces_2016";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="جسم على مستوى مائل">
        <line x1="100" y1="80" x2="525" y2="300" stroke="#111827" strokeWidth="3.2"/>
        <line x1="105" y1="80" x2="540" y2="305" stroke="#64748b" strokeDasharray="8 6"/>
        <rect x="285" y="182" width="68" height="46" transform="rotate(27 319 205)" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <path d="M455 300 A65 65 0 0 0 430 267" fill="none" stroke="#111827" strokeWidth="1.7"/>
        <SvgLabel x="90" y="75">A</SvgLabel>
        <SvgLabel x="530" y="325">B</SvgLabel>
        <SvgLabel x="319" y="198">S</SvgLabel>
        <SvgLabel x="440" y="291">α</SvgLabel>
        <SvgLabel x="550" y="305">x</SvgLabel>

        {forces && <>
          <circle cx="319" cy="205" r="4" fill="#111827"/>
          <line x1="319" y1="205" x2="319" y2="335" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1="319" y1="205" x2="370" y2="103" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <SvgLabel x="335" y="340">P</SvgLabel>
          <SvgLabel x="383" y="98">R</SvgLabel>
          {friction && <>
            <line x1="319" y1="205" x2="230" y2="159" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
            <SvgLabel x="216" y="153">f</SvgLabel>
          </>}
        </>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "truck_stone_car_2016") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="حجر تقذفه عجلة شاحنة نحو سيارة خلفها">
        <line x1="55" y1="285" x2="590" y2="285" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>

        {/* شاحنة مبسطة */}
        <rect x="75" y="220" width="165" height="48" rx="5" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <rect x="75" y="200" width="60" height="68" rx="6" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="110" cy="278" r="14" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="195" cy="278" r="14" fill="#fff" stroke="#111827" strokeWidth="2.5"/>

        {/* السيارة */}
        <rect x="470" y="235" width="95" height="33" rx="10" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <path d="M490 235 L510 210 L540 210 L555 235" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="493" cy="278" r="12" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
        <circle cx="548" cy="278" r="12" fill="#fff" stroke="#111827" strokeWidth="2.5"/>

        {/* الأصل والمحاور */}
        <circle cx="250" cy="285" r="5" fill="#111827"/>
        <line x1="250" y1="285" x2="250" y2="75" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <line x1="250" y1="285" x2="340" y2="220" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="250" y1="285" x2="345" y2="285" stroke="#64748b" strokeDasharray="7 6"/>
        <path d="M300 285 A50 50 0 0 0 290 255" fill="none" stroke="#111827" strokeWidth="1.7"/>

        {/* المسافة d إلى M */}
        <line x1="250" y1="120" x2="500" y2="120" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
        <line x1="500" y1="120" x2="250" y2="120" stroke="#111827" strokeWidth="2" markerEnd="url(#p-arrow)"/>
        <line x1="500" y1="120" x2="500" y2="245" stroke="#64748b" strokeDasharray="7 6"/>
        <line x1="250" y1="120" x2="250" y2="285" stroke="#64748b" strokeDasharray="7 6"/>

        <SvgLabel x="235" y="305">O</SvgLabel>
        <SvgLabel x="350" y="215">v₀</SvgLabel>
        <SvgLabel x="296" y="273">α=37°</SvgLabel>
        <SvgLabel x="375" y="112">d</SvgLabel>
        <SvgLabel x="500" y="200">M</SvgLabel>
        <SvgLabel x="605" y="291">x</SvgLabel>
        <SvgLabel x="235" y="70">z</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }



  if (type === "galileo_orbit_2017" || type === "galileo_force_2017") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قمر اصطناعي حول الأرض">
        <circle cx="205" cy="205" r="85" fill="#fff" stroke="#111827" strokeWidth="3"/>
        <circle cx="205" cy="205" r="5" fill="#111827"/>
        <path d="M480 70 Q560 205 480 340" fill="none" stroke="#111827" strokeWidth="2.2" strokeDasharray="7 6"/>
        <circle cx="500" cy="205" r="7" fill="#111827"/>
        <line x1="205" y1="205" x2="500" y2="205" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <line x1="500" y1="205" x2="365" y2="205" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="165" y="198">MT</SvgLabel><SvgLabel x="225" y="260">RT</SvgLabel>
        <SvgLabel x="515" y="200">S</SvgLabel><SvgLabel x="350" y="195">h</SvgLabel>
        <SvgLabel x="400" y="225">F(T/S)</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "incline_projectile_2017") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مستوى مائل ثم سقوط">
        <line x1="90" y1="85" x2="330" y2="245" stroke="#111827" strokeWidth="3"/>
        <line x1="330" y1="245" x2="330" y2="335" stroke="#64748b" strokeDasharray="7 6"/>
        <line x1="330" y1="335" x2="570" y2="335" stroke="#111827" strokeWidth="3"/>
        <path d="M330 245 Q430 270 500 335" fill="none" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <SvgLabel x="80" y="78">A</SvgLabel><SvgLabel x="315" y="240">B</SvgLabel>
        <SvgLabel x="510" y="355">D</SvgLabel><SvgLabel x="315" y="295">h</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "incline_friction_forces_2017" || type === "incline_no_friction_forces_2017") {
    const friction = type === "incline_friction_forces_2017";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى جسم على مستوى مائل">
        <line x1="100" y1="100" x2="530" y2="310" stroke="#111827" strokeWidth="3"/>
        <rect x="285" y="190" width="62" height="42" transform="rotate(26 316 211)" fill="#fff" stroke="#111827" strokeWidth="2.4"/>
        <line x1="316" y1="211" x2="316" y2="340" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="316" y1="211" x2="365" y2="105" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        {friction && <line x1="316" y1="211" x2="225" y2="167" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>}
        <SvgLabel x="330" y="345">P</SvgLabel><SvgLabel x="378" y="100">R</SvgLabel>
        {friction && <SvgLabel x="212" y="160">f</SvgLabel>}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "velocity_components_2017") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مركبتا السرعة بدلالة الزمن">
        <line x1="85" y1="205" x2="570" y2="205" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <line x1="105" y1="340" x2="105" y2="65" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/>
        <line x1="105" y1="145" x2="520" y2="145" stroke="#111827" strokeWidth="3"/>
        <line x1="105" y1="245" x2="520" y2="330" stroke="#111827" strokeWidth="3"/>
        <SvgLabel x="390" y="135">vx</SvgLabel><SvgLabel x="390" y="300">vy</SvgLabel>
        <SvgLabel x="580" y="211">t</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "energy_balance_friction_2017") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="حصيلة طاقوية">
        <ellipse cx="325" cy="205" rx="95" ry="130" fill="none" stroke="#111827" strokeWidth="2.5"/>
        <rect x="300" y="125" width="50" height="160" fill="#fff" stroke="#111827" strokeWidth="2"/>
        <line x1="150" y1="205" x2="225" y2="205" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="425" y1="205" x2="505" y2="205" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="145" y="190">W(P)</SvgLabel><SvgLabel x="515" y="190">W(f)</SvgLabel>
        <SvgLabel x="325" y="115">EcB</SvgLabel><SvgLabel x="325" y="305">EcA</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "quarter_circle_rough_2017") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="ربع دائرة وطريق أفقي خشن">
        <path d="M150 90 A170 170 0 0 0 320 260" fill="none" stroke="#111827" strokeWidth="3"/>
        <circle cx="320" cy="90" r="5" fill="#111827"/>
        <line x1="320" y1="90" x2="320" y2="260" stroke="#64748b" strokeDasharray="7 6"/>
        <circle cx="205" cy="210" r="15" fill="#fff" stroke="#111827" strokeWidth="2.4"/>
        <line x1="320" y1="90" x2="205" y2="210" stroke="#64748b" strokeDasharray="7 6"/>
        <line x1="320" y1="260" x2="555" y2="260" stroke="#111827" strokeWidth="3"/>
        <SvgLabel x="135" y="85">A</SvgLabel><SvgLabel x="330" y="82">O</SvgLabel>
        <SvgLabel x="330" y="280">B</SvgLabel><SvgLabel x="565" y="280">C</SvgLabel>
        <SvgLabel x="185" y="210">M</SvgLabel><SvgLabel x="292" y="145">θ</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "quarter_circle_forces_2017") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى كرية على قوس دائري">
        <path d="M140 80 A180 180 0 0 0 320 260" fill="none" stroke="#111827" strokeWidth="3"/>
        <circle cx="320" cy="80" r="5" fill="#111827"/><circle cx="205" cy="205" r="15" fill="#fff" stroke="#111827" strokeWidth="2"/>
        <line x1="205" y1="205" x2="205" y2="330" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="205" y1="205" x2="285" y2="120" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="220" y="335">P</SvgLabel><SvgLabel x="295" y="115">R</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "rough_horizontal_forces_2017") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى جسم على سطح أفقي خشن">
        <line x1="90" y1="255" x2="565" y2="255" stroke="#111827" strokeWidth="3"/>
        <circle cx="325" cy="235" r="16" fill="#fff" stroke="#111827" strokeWidth="2"/>
        <line x1="325" y1="235" x2="325" y2="100" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="325" y1="235" x2="325" y2="350" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="325" y1="235" x2="205" y2="235" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="340" y="95">R</SvgLabel><SvgLabel x="340" y="350">P</SvgLabel><SvgLabel x="190" y="225">f</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "tennis_half_circle_2017") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مسلك نصف دائري لكرة">
        <path d="M250 300 A125 125 0 0 1 250 50" fill="none" stroke="#111827" strokeWidth="3"/>
        <line x1="250" y1="300" x2="570" y2="300" stroke="#111827" strokeWidth="3"/>
        <line x1="375" y1="50" x2="570" y2="50" stroke="#64748b" strokeDasharray="7 6"/>
        <line x1="375" y1="50" x2="375" y2="300" stroke="#64748b" strokeDasharray="7 6"/>
        <circle cx="375" cy="175" r="5" fill="#111827"/>
        <SvgLabel x="235" y="320">B</SvgLabel><SvgLabel x="108" y="180">C</SvgLabel>
        <SvgLabel x="235" y="45">D</SvgLabel><SvgLabel x="390" y="180">O</SvgLabel>
        <SvgLabel x="455" y="320">A</SvgLabel><SvgLabel x="550" y="320">N</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "half_circle_force_D_2017" || type === "horizontal_launch_D_2017") {
    const launch = type === "horizontal_launch_D_2017";
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="الحركة عند النقطة D">
        <circle cx="220" cy="105" r="7" fill="#111827"/>
        <line x1="220" y1="105" x2="220" y2="285" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        {!launch && <line x1="220" y1="105" x2="220" y2="45" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>}
        {launch && <line x1="220" y1="105" x2="390" y2="105" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>}
        <SvgLabel x="235" y="300">P</SvgLabel>
        {!launch && <SvgLabel x="235" y="40">R</SvgLabel>}
        {launch && <SvgLabel x="405" y="100">vD</SvgLabel>}
        <SvgLabel x="200" y="95">D</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "fall_force_candidates_2017") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="تمثيلات القوى الثلاث">
        {[150,325,500].map((cx,i)=><g key={cx}>
          <circle cx={cx} cy="205" r="16" fill="#fff" stroke="#111827" strokeWidth="2"/>
          <line x1={cx} y1="205" x2={cx} y2="335" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1={cx} y1="205" x2={cx} y2="90" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <SvgLabel x={cx+18} y="340">P</SvgLabel><SvgLabel x={cx+18} y="85">f</SvgLabel>
          {i===0 && <><line x1={cx} y1="205" x2={cx+28} y2="120" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/><SvgLabel x={cx+40} y="120">Π</SvgLabel></>}
          {i===2 && <><line x1={cx} y1="205" x2={cx+28} y2="290" stroke="#111827" strokeWidth="2.5" markerEnd="url(#p-arrow)"/><SvgLabel x={cx+40} y="290">Π</SvgLabel></>}
          <SvgLabel x={cx} y="375">{i+1}</SvgLabel>
        </g>)}
      </PhysicsDiagramFrame>
    );
  }

  if (type === "incline_then_rough_2017") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مستوى مائل ثم سطح أفقي خشن">
        <line x1="100" y1="95" x2="330" y2="260" stroke="#111827" strokeWidth="3"/>
        <line x1="330" y1="260" x2="565" y2="260" stroke="#111827" strokeWidth="3"/>
        <rect x="180" y="140" width="58" height="38" transform="rotate(36 209 159)" fill="#fff" stroke="#111827" strokeWidth="2.3"/>
        <SvgLabel x="90" y="90">A</SvgLabel><SvgLabel x="315" y="280">B</SvgLabel>
        <SvgLabel x="490" y="280">C</SvgLabel><SvgLabel x="565" y="280">D</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "parachute_forces_2017") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى المظلة والعلبة">
        {[230,440].map((cx,i)=><g key={cx}>
          <circle cx={cx} cy="205" r="17" fill="#fff" stroke="#111827" strokeWidth="2"/>
          <line x1={cx} y1="205" x2={cx} y2="340" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <line x1={cx} y1="205" x2={cx} y2="105" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
          <SvgLabel x={cx+18} y="345">P</SvgLabel><SvgLabel x={cx+18} y="100">Π</SvgLabel>
          {i===1 && <><line x1={cx} y1="205" x2={cx+35} y2="120" stroke="#111827" strokeWidth="2.7" markerEnd="url(#p-arrow)"/><SvgLabel x={cx+48} y="120">f</SvgLabel></>}
        </g>)}
        <SvgLabel x="230" y="385">بداية السقوط</SvgLabel><SvgLabel x="440" y="385">النظام الدائم</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }



  if (type === "alcomsat_ellipse_solution_2018") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مدار إهليلجي مع الأوج والحضيض">
        <ellipse cx="330" cy="200" rx="235" ry="105" fill="none" stroke="#111827" strokeWidth="2.7" strokeDasharray="8 6"/>
        <circle cx="220" cy="200" r="48" fill="#fff" stroke="#111827" strokeWidth="2.7"/>
        <circle cx="220" cy="200" r="5" fill="#111827"/>
        <circle cx="95" cy="200" r="7" fill="#111827"/>
        <circle cx="565" cy="200" r="7" fill="#111827"/>
        <line x1="95" y1="200" x2="95" y2="300" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="565" y1="200" x2="565" y2="100" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="220" y1="200" x2="565" y2="200" stroke="#64748b" strokeDasharray="7 6" strokeWidth="1.7"/>
        <SvgLabel x="220" y="260">الأرض T</SvgLabel>
        <SvgLabel x="75" y="190" anchor="end">الحضيض</SvgLabel>
        <SvgLabel x="580" y="190">الأوج</SvgLabel>
        <SvgLabel x="112" y="305">vP</SvgLabel>
        <SvgLabel x="580" y="95">vA</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "balloon_forces_2018") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوى بالون أثناء السقوط">
        {[220,440].map((cx, i) => (
          <g key={cx}>
            <circle cx={cx} cy="205" r="28" fill="#fff" stroke="#111827" strokeWidth="2.5"/>
            <circle cx={cx} cy="205" r="4" fill="#111827"/>
            <line x1={cx} y1="205" x2={cx} y2="335" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
            <line x1={cx} y1="205" x2={cx} y2="90" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
            <SvgLabel x={cx+18} y="340">P</SvgLabel>
            <SvgLabel x={cx+18} y="85">Π</SvgLabel>
            {i === 1 && <>
              <line x1={cx+13} y1="205" x2={cx+13} y2="120" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
              <SvgLabel x={cx+35} y="115">f</SvgLabel>
            </>}
          </g>
        ))}
        <SvgLabel x="220" y="390">t = 0</SvgLabel>
        <SvgLabel x="440" y="390">خلال الحركة</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "shot_put_setup_2018") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="وضعية رمي الجلة">
        <line x1="100" y1="310" x2="560" y2="310" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="125" y1="330" x2="125" y2="60" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <circle cx="125" cy="190" r="7" fill="#111827"/>
        <line x1="125" y1="190" x2="225" y2="125" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <line x1="125" y1="190" x2="230" y2="190" stroke="#64748b" strokeDasharray="7 6"/>
        <line x1="95" y1="310" x2="95" y2="190" stroke="#64748b" strokeDasharray="7 6"/>
        <path d="M180 190 A55 55 0 0 0 169 159" fill="none" stroke="#111827" strokeWidth="1.7"/>
        <SvgLabel x="235" y="120">v₀</SvgLabel>
        <SvgLabel x="176" y="178">α</SvgLabel>
        <SvgLabel x="80" y="255" anchor="end">h</SvgLabel>
        <SvgLabel x="110" y="330">O</SvgLabel>
        <SvgLabel x="580" y="316">x</SvgLabel>
        <SvgLabel x="110" y="58">y</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "shot_put_energy_balance_2018") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="مخطط الحصيلة الطاقوية للجلة">
        <ellipse cx="335" cy="205" rx="110" ry="135" fill="none" stroke="#111827" strokeWidth="2.6"/>
        <rect x="305" y="120" width="60" height="170" fill="#fff" stroke="#111827" strokeWidth="2.2"/>
        <line x1="130" y1="205" x2="220" y2="205" stroke="#111827" strokeWidth="3" markerEnd="url(#p-arrow)"/>
        <SvgLabel x="125" y="190">W(P)</SvgLabel>
        <SvgLabel x="335" y="108">EcB</SvgLabel>
        <SvgLabel x="335" y="310">Ec0</SvgLabel>
        <SvgLabel x="380" y="145">الجلة</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "impact_velocity_2018") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="شعاع السرعة عند ارتطام الجلة">
        <line x1="90" y1="300" x2="565" y2="300" stroke="#111827" strokeWidth="3"/>
        <path d="M110 105 Q330 55 500 300" fill="none" stroke="#64748b" strokeDasharray="7 6" strokeWidth="2"/>
        <circle cx="500" cy="300" r="7" fill="#111827"/>
        <line x1="500" y1="300" x2="570" y2="385" stroke="#111827" strokeWidth="3.2" markerEnd="url(#p-arrow)"/>
        <line x1="500" y1="300" x2="585" y2="300" stroke="#64748b" strokeDasharray="7 6"/>
        <path d="M550 300 A50 50 0 0 1 532 338" fill="none" stroke="#111827" strokeWidth="1.7"/>
        <SvgLabel x="575" y="390">v</SvgLabel>
        <SvgLabel x="548" y="325">β ≈ 50°</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }

  if (type === "circular_satellite_force_2018") {
    return (
      <PhysicsDiagramFrame graph={graph} ariaLabel="قوة جذب الأرض لقمر على مدار دائري">
        <circle cx="315" cy="205" r="72" fill="#fff" stroke="#111827" strokeWidth="2.7"/>
        <circle cx="315" cy="205" r="5" fill="#111827"/>
        <circle cx="315" cy="205" r="145" fill="none" stroke="#111827" strokeWidth="2.4" strokeDasharray="8 6"/>
        <circle cx="425" cy="110" r="8" fill="#111827"/>
        <line x1="420" y1="115" x2="350" y2="175" stroke="#111827" strokeWidth="3.2" markerEnd="url(#p-arrow)"/>
        <line x1="315" y1="205" x2="425" y2="110" stroke="#64748b" strokeDasharray="7 6" strokeWidth="1.8"/>
        <SvgLabel x="300" y="198">O</SvgLabel>
        <SvgLabel x="315" y="245">الأرض</SvgLabel>
        <SvgLabel x="442" y="105">S</SvgLabel>
        <SvgLabel x="385" y="150">F(T/S)</SvgLabel>
      </PhysicsDiagramFrame>
    );
  }


  return null;
}

function sanitizeSvgMarkup(value) {
  const raw = String(value ?? "").trim();
  if (!raw || !raw.toLowerCase().startsWith("<svg")) return "";

  // في المتصفح نستعمل DOMParser لحذف العناصر والخصائص غير الآمنة.
  // ملفات الرسومات في المنصة موثوقة، لكن هذا يمنع script/event handlers
  // إذا وصل SVG غير متوقع من API.
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
      .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, "")
      .replace(/\s(?:href|xlink:href)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, "");
  }

  try {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(raw, "image/svg+xml");
    const root = documentNode.documentElement;

    if (!root || root.nodeName.toLowerCase() !== "svg") return "";
    if (documentNode.querySelector("parsererror")) return "";

    root
      .querySelectorAll("script, foreignObject, iframe, object, embed")
      .forEach((node) => node.remove());

    root.querySelectorAll("*").forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const valueText = String(attribute.value || "").trim().toLowerCase();

        if (name.startsWith("on")) {
          node.removeAttribute(attribute.name);
          return;
        }

        if (
          (name === "href" || name === "xlink:href") &&
          valueText.startsWith("javascript:")
        ) {
          node.removeAttribute(attribute.name);
        }
      });
    });

    // نحافظ على viewBox الموجود في JSON ونجعل الرسم responsive.
    root.removeAttribute("width");
    root.removeAttribute("height");
    root.setAttribute("preserveAspectRatio", "xMidYMid meet");

    return new XMLSerializer().serializeToString(root);
  } catch {
    return "";
  }
}

function InlineSvgGraph({ graph, compact = false }) {
  const safeSvg = useMemo(
    () => sanitizeSvgMarkup(graph?.svg),
    [graph?.svg]
  );

  if (!safeSvg) return null;

  return (
    <figure
      className={cn(
        "mx-auto overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm",
        compact ? "max-w-2xl" : "max-w-3xl"
      )}
    >
      {(hasText(graph?.title) || hasText(graph?.description)) && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          {hasText(graph?.title) && (
            <h4 className="text-center text-sm font-black text-slate-950 sm:text-base">
              {graph.title}
            </h4>
          )}

          {hasText(graph?.description) && (
            <MathText
              block
              className="mt-1 text-center text-xs font-semibold leading-6 text-slate-600 sm:text-sm"
            >
              {graph.description}
            </MathText>
          )}
        </div>
      )}

      <div
        dir="ltr"
        className="w-full overflow-x-auto bg-white p-2 sm:p-4
          [&>svg]:mx-auto
          [&>svg]:block
          [&>svg]:h-auto
          [&>svg]:w-full
          [&>svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: safeSvg }}
      />

      {hasText(graph?.caption) && (
        <figcaption className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <MathText
            block
            className="text-center text-xs font-semibold leading-6 text-slate-600 sm:text-sm"
          >
            {graph.caption}
          </MathText>
        </figcaption>
      )}
    </figure>
  );
}


function BacPhysicsDiagramSvg({ graph, compact = false }) {
  const data = asObject(graph?.react_data);
  const elements = asArray(data?.elements);
  if (data?.renderer !== "BacPhysicsDiagramSvg" || elements.length === 0) {
    return null;
  }

  const width = Number(data?.width) || 900;
  const height = Number(data?.height) || 500;
  const markerId = `bac-arrow-${String(graph?.id || graph?.title || "diagram")
    .replace(/[^\w-]/g, "-")
    .slice(0, 36)}`;

  const renderElement = (element, index) => {
    if (!element || typeof element !== "object") return null;
    const key = element?.id || `${element?.type || "item"}-${index}`;
    const stroke = element?.stroke || "#111827";
    const strokeWidth = Number(element?.width) || 2.6;
    const dash = element?.dashed ? "9 7" : undefined;
    const fill =
      element?.fill === "none"
        ? "none"
        : element?.fill || "none";

    if (element.type === "line") {
      return (
        <line
          key={key}
          x1={element.x1}
          y1={element.y1}
          x2={element.x2}
          y2={element.y2}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      );
    }

    if (element.type === "arrow") {
      return (
        <g key={key}>
          <line
            x1={element.x1}
            y1={element.y1}
            x2={element.x2}
            y2={element.y2}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            strokeLinecap="round"
            markerEnd={`url(#${markerId})`}
          />
          {hasText(element?.label) && (
            <text
              x={element?.label_x ?? Number(element.x2) + 12}
              y={element?.label_y ?? Number(element.y2) - 10}
              fontSize={element?.label_size || 18}
              fontWeight="700"
              fill="#111827"
              textAnchor={element?.anchor || "middle"}
              direction={ARABIC_RE.test(String(element.label)) ? "rtl" : "ltr"}
            >
              {element.label}
            </text>
          )}
        </g>
      );
    }

    if (element.type === "rect") {
      const cx = element?.cx ?? Number(element.x) + Number(element.w) / 2;
      const cy = element?.cy ?? Number(element.y) + Number(element.h) / 2;
      const transform = Number.isFinite(Number(element?.rotate))
        ? `rotate(${element.rotate} ${cx} ${cy})`
        : undefined;

      return (
        <rect
          key={key}
          x={element.x}
          y={element.y}
          width={element.w}
          height={element.h}
          rx={element.rx || 0}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          transform={transform}
        />
      );
    }

    if (element.type === "circle") {
      return (
        <circle
          key={key}
          cx={element.cx}
          cy={element.cy}
          r={element.r}
          fill={element?.fill || "none"}
          stroke={
            element?.stroke ??
            (element?.fill && element.fill !== "none" ? "none" : stroke)
          }
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
        />
      );
    }

    if (element.type === "ellipse") {
      return (
        <ellipse
          key={key}
          cx={element.cx}
          cy={element.cy}
          rx={element.rx}
          ry={element.ry}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
        />
      );
    }

    if (element.type === "path") {
      return (
        <path
          key={key}
          d={element.d}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }

    if (element.type === "polyline") {
      return (
        <polyline
          key={key}
          points={element.points}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }

    if (element.type === "text") {
      const value = String(element?.text || "");
      return (
        <text
          key={key}
          x={element.x}
          y={element.y}
          fontSize={element?.size || 18}
          fontWeight={element?.bold ? "800" : "600"}
          fill={element?.fill || "#111827"}
          textAnchor={element?.anchor || "middle"}
          direction={ARABIC_RE.test(value) ? "rtl" : "ltr"}
        >
          {value}
        </text>
      );
    }

    return null;
  };

  return (
    <figure
      dir="rtl"
      className={cn(
        "mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        compact ? "max-w-3xl" : "max-w-4xl"
      )}
    >
      {hasText(graph?.title) && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h4 className="text-center text-sm font-black text-slate-900 sm:text-base">
            {graph.title}
          </h4>
        </div>
      )}

      <div className="overflow-x-auto p-2 sm:p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto min-w-[620px] w-full"
          role="img"
          aria-label={graph?.title || "رسم فيزيائي"}
        >
          <defs>
            <marker
              id={markerId}
              markerWidth="11"
              markerHeight="11"
              refX="9"
              refY="5.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L11,5.5 L0,11 z" fill="#111827" />
            </marker>
          </defs>

          <rect
            x="1"
            y="1"
            width={width - 2}
            height={height - 2}
            rx="8"
            fill="#ffffff"
            stroke="#e5e7eb"
          />

          {elements.map(renderElement)}
        </svg>
      </div>

      {hasText(graph?.caption) && (
        <figcaption className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <MathText block className="text-center text-sm font-semibold text-slate-600">
            {graph.caption}
          </MathText>
        </figcaption>
      )}
    </figure>
  );
}

function ImageFigureRenderer({ graph, compact = false }) {
  const rawPath =
    graph?.path ||
    graph?.src ||
    graph?.url ||
    graph?.image_path ||
    graph?.image ||
    "";

  const src = resolvePublicAssetPath(rawPath);
  const [loadError, setLoadError] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setLoadError(false);
    setZoomed(false);
  }, [src]);

  useEffect(() => {
    if (!zoomed) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setZoomed(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [zoomed]);

  if (!src) return null;

  const title = graph?.title || graph?.label || graph?.name || "وثيقة التمرين";
  const alt = graph?.alt || graph?.description || title;

  return (
    <>
      <figure
        className={cn(
          "mx-auto w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm",
          compact ? "max-w-[900px]" : "max-w-[980px]"
        )}
      >
        {hasText(title) && (
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
            <h4 className="min-w-0 flex-1 text-center text-xs font-black text-slate-800 sm:text-sm">
              {title}
            </h4>
            <span className="bac-screen-only hidden shrink-0 text-[10px] font-bold text-slate-400 sm:inline">
              اضغط للتكبير
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => !loadError && setZoomed(true)}
          className="block w-full cursor-zoom-in bg-white p-2.5 text-center outline-none sm:p-4"
          aria-label={`تكبير ${title}`}
        >
          {loadError ? (
            <div className="flex w-full cursor-default flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-8 text-center">
              <TriangleAlert size={28} className="text-amber-700" />
              <p className="mt-3 text-sm font-black text-amber-950">تعذر تحميل الوثيقة العلمية</p>
              <p dir="ltr" className="mt-2 max-w-full break-all text-xs font-bold text-amber-800">{src}</p>
              <span
                onClick={(event) => {
                  event.stopPropagation();
                  setLoadError(false);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-xs font-black text-white"
              >
                <RefreshCcw size={15} />
                إعادة المحاولة
              </span>
            </div>
          ) : (
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="mx-auto block h-auto max-h-[80vh] w-full max-w-[900px] object-contain"
              onError={() => setLoadError(true)}
            />
          )}
        </button>

        {hasText(graph?.caption) && (
          <figcaption className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <MathText block className="text-center text-xs font-semibold leading-6 text-slate-600 sm:text-sm">
              {graph.caption}
            </MathText>
          </figcaption>
        )}
      </figure>

      {zoomed && !loadError && (
        <div
          className="bac-screen-only fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setZoomed(false)}
        >
          <div className="relative flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <h4 className="min-w-0 truncate text-sm font-black text-slate-900 sm:text-base">{title}</h4>
              <button
                type="button"
                onClick={() => setZoomed(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg font-black text-slate-700 transition hover:bg-slate-200"
                aria-label="إغلاق الوثيقة"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-2 sm:p-4">
              <img src={src} alt={alt} className="mx-auto block h-auto max-w-none object-contain" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GraphRenderer({ graph, compact = false }) {
  if (!graph || typeof graph !== "object") return null;

  // Les nouveaux JSON de mathématiques peuvent stocker un tableau de
  // variations dans solution.figures avec type: "variation_table".
  // Dans ce cas il ne faut pas essayer de le traiter comme un graphe SVG.
  if (isVariationTable(graph)) {
    return <VariationTable table={graph} />;
  }

  /*
   * Nouveau format utilisé par les exercices BAC 2008+:
   *
   * {
   *   "id": "document_01",
   *   "usage": "statement",
   *   "type": "image",
   *   "title": "الوثيقة (1)",
   *   "path": "images/2017/exercise_20/document_01.png"
   * }
   *
   * Les fichiers physiques sont dans:
   * public/images/2017/exercise_20/document_01.png
   */
  const imagePath =
    graph?.path ||
    graph?.src ||
    graph?.url ||
    graph?.image_path ||
    graph?.image;

  const isImage =
    String(graph?.type ?? "").toLowerCase() === "image" ||
    String(graph?.renderer ?? "").toLowerCase() === "image" ||
    hasText(imagePath);

  if (isImage) {
    return <ImageFigureRenderer graph={graph} compact={compact} />;
  }

  if (graph?.react_data?.renderer === "BacPhysicsDiagramSvg") {
    return <BacPhysicsDiagramSvg graph={graph} compact={compact} />;
  }

  /*
   * ترتيب التحقق مهم:
   * 1) الصور الخارجية/المقصوصة من PDF.
   * 2) SVG جاهز داخل JSON.
   * 3) series = منحنى إحداثي.
   * 4) الرسومات الفيزيائية القديمة.
   */
  if (hasText(graph?.svg)) {
    return <InlineSvgGraph graph={graph} compact={compact} />;
  }

  if (
    Array.isArray(graph?.series) &&
    graph.series.some(
      (serie) =>
        asArray(serie?.data).length > 0 ||
        asArray(serie?.points).length > 0
    )
  ) {
    return <CoordinateGraph graph={graph} compact={compact} />;
  }

  if (hasText(graph?.diagram_type)) {
    return <PhysicsDiagram graph={graph} compact={compact} />;
  }

  // Ne pas essayer de dessiner un graphe vide.
  return null;
}


function CoordinateGraph({ graph }) {
  const series = asArray(graph?.series)
    .map((serie, index) => {
      // Compatibilité avec les deux schémas utilisés dans les JSON :
      // ancien : series[].data ; nouveau : series[].points.
      const rawPoints =
        asArray(serie?.data).length > 0
          ? asArray(serie?.data)
          : asArray(serie?.points);

      return {
        ...serie,
        id: serie?.id ?? `series-${index}`,
        type: serie?.type || serie?.kind || "curve",
        data: rawPoints.filter(
          (point) =>
            Number.isFinite(Number(point?.x)) &&
            Number.isFinite(Number(point?.y))
        ),
      };
    })
    .filter((serie) => serie.data.length > 0);

  if (series.length === 0) return null;

  const allPoints = series.flatMap((serie) => serie.data);
  const configuredX =
    asArray(graph?.x_domain).length === 2
      ? asArray(graph?.x_domain)
      : asArray(graph?.x_range);
  const configuredY =
    asArray(graph?.y_domain).length === 2
      ? asArray(graph?.y_domain)
      : asArray(graph?.y_range);

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
            <marker
              id="vector-arrow"
              markerWidth="12"
              markerHeight="12"
              refX="10"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L0,8 L11,4 z" fill="context-stroke" />
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

          {(graph?.show_grid ?? graph?.axes?.grid) !== false && xTicks.map((tick, index) => (
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

          {(graph?.show_grid ?? graph?.axes?.grid) !== false && yTicks.map((tick, index) => (
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
            {graph?.x_label || graph?.axes?.x_label || "x"}
          </text>

          <text
            x={yAxisX + 10}
            y={margin.top - 14}
            fontSize="15"
            fontWeight="700"
            fill="#0f172a"
          >
            {graph?.y_label || graph?.axes?.y_label || "y"}
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
                  markerEnd={serie?.type === "arrow" ? "url(#vector-arrow)" : undefined}
                />

                {(serie?.show_points || serie?.type === "points" || serie?.type === "scatter") &&
                  serie.data.map((point, pointIndex) => (
                    <g key={pointIndex}>
                      <circle
                        cx={scaleX(point.x)}
                        cy={scaleY(point.y)}
                        r={Number(point?.radius || serie?.point_radius || 4)}
                        fill={point?.color || color}
                      />
                      {hasText(point?.label) && (
                        <text
                          x={scaleX(point.x) + Number(point?.label_dx ?? 10)}
                          y={scaleY(point.y) + Number(point?.label_dy ?? -10)}
                          fontSize="13"
                          fontWeight="700"
                          fill={point?.label_color || "#111827"}
                        >
                          {point.label}
                        </text>
                      )}
                    </g>
                  ))}
              </g>
            );
          })}

          {asArray(graph?.annotations).map((annotation, index) => {
            const type = String(annotation?.type || "point").toLowerCase();
            const hasX = Number.isFinite(Number(annotation?.x));
            const hasY = Number.isFinite(Number(annotation?.y));

            if (type === "vertical_tangent" || type === "vertical_line") {
              if (!hasX) return null;
              const x = scaleX(annotation.x);
              const fromY = Number.isFinite(Number(annotation?.from_y))
                ? scaleY(annotation.from_y)
                : margin.top + plotHeight;
              const toY = Number.isFinite(Number(annotation?.to_y))
                ? scaleY(annotation.to_y)
                : margin.top;

              return (
                <g key={`annotation-${index}`}>
                  <line
                    x1={x}
                    y1={fromY}
                    x2={x}
                    y2={toY}
                    stroke="#7c3aed"
                    strokeWidth="2.5"
                    strokeDasharray="8 6"
                  />
                  {hasText(annotation?.label) && (
                    <text
                      x={x + 10}
                      y={Math.min(fromY, toY) + 18}
                      fontSize="13"
                      fontWeight="700"
                      fill="#6d28d9"
                    >
                      {annotation.label}
                    </text>
                  )}
                </g>
              );
            }

            if (!hasX || !hasY) return null;

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
              {serie?.label || serie?.name || serie?.id}
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
    Boolean(table?.directions) ||
    Boolean(
      Array.isArray(table?.columns) &&
        (table?.function_row || table?.arrows || table?.function_values)
    )
  );
}

function SmartMathTable({ table }) {
  if (!table) return null;
  return isVariationTable(table)
    ? <VariationTable table={table?.variation_table || table} />
    : <DataTable table={table} />;
}


function normalizeVariationDirection(value) {
  const normalized = cleanVariationLabel(value).toLowerCase();

  if (
    ["↗", "up", "increase", "increasing", "asc", "croissante", "متزايدة", "تزايد"].includes(
      normalized
    )
  ) {
    return "up";
  }

  if (
    ["↘", "down", "decrease", "decreasing", "desc", "décroissante", "متناقصة", "تناقص"].includes(
      normalized
    )
  ) {
    return "down";
  }

  return normalized.includes("تناقص") ||
    normalized.includes("down") ||
    normalized.includes("decreas")
    ? "down"
    : "up";
}

function cleanVariationLabel(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value.value ??
        value.label ??
        value.text ??
        value.content ??
        value.x ??
        value.y ??
        value.sign ??
        ""
      : value;

  return restoreJsonDamagedLatexEscapes(source)
    .replace(/^\s*(?:\\\(|\\\[)/, "")
    .replace(/(?:\\\)|\\\])\s*$/, "")
    .trim();
}

function normalizeVariationList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanVariationLabel).filter(hasText);
}

function getVariationRowValues(row) {
  if (Array.isArray(row)) return normalizeVariationList(row);

  const item = asObject(row);
  return normalizeVariationList(
    item.cells ||
      item.values ||
      item.data ||
      item.entries ||
      item.points ||
      item.signs ||
      item.directions
  );
}

function stripVariationRowLabel(values, labelPattern) {
  const list = [...values];
  if (list.length > 0 && labelPattern.test(list[0].replace(/\\/g, ""))) {
    list.shift();
  }
  return list;
}

function firstVariationList(...candidates) {
  for (const candidate of candidates) {
    const list = getVariationRowValues(candidate);
    if (list.length > 0) return list;
  }
  return [];
}

function isVariationArrowValue(value) {
  const normalized = cleanVariationLabel(value).toLowerCase();
  return [
    "↗",
    "↘",
    "up",
    "down",
    "increase",
    "increasing",
    "decrease",
    "decreasing",
    "croissante",
    "décroissante",
    "متزايدة",
    "متناقصة",
    "تزايد",
    "تناقص",
  ].includes(normalized);
}

function isDerivativeVariationLabel(value) {
  const label = cleanVariationLabel(value)
    .replace(/\\(?:left|right)/g, "")
    .replace(/\\prime/g, "'")
    .replace(/\s+/g, "");

  return /مشتق/u.test(label) || /f(?:['’′])+\(x\)/i.test(label);
}

function isFunctionVariationLabel(value) {
  const label = cleanVariationLabel(value)
    .replace(/\\(?:left|right)/g, "")
    .replace(/\s+/g, "");

  return (
    (/f\(x\)/i.test(label) && !/['’′]/.test(label)) ||
    /(?:تغيرات|الدالة)/u.test(label)
  );
}

function normalizeIntervalSigns(values, intervalCount) {
  const signs = values
    .map(cleanVariationLabel)
    .filter((value) => ["+", "-", "−", "0"].includes(value))
    .map((value) => (value === "−" ? "-" : value));

  // الصفر الموجود عند نقطة حرجة ليس إشارة مجال، لذلك نحذفه إذا كان
  // عدد الإشارات أكبر من عدد المجالات.
  const withoutPointZeros = signs.filter((sign) => sign !== "0");
  const selected =
    signs.length > intervalCount && withoutPointZeros.length >= intervalCount
      ? withoutPointZeros
      : signs;

  return Array.from(
    { length: intervalCount },
    (_, index) => selected[index] ?? ""
  );
}

function normalizeVariationTable(table) {
  const source = asObject(table?.variation_table || table);
  const rowList = Array.isArray(source.rows)
    ? source.rows.map((row) => (Array.isArray(row) ? row : asObject(row)))
    : [];
  const rowMap = asObject(Array.isArray(source.rows) ? null : source.rows);
  const rowLabel = (row) =>
    Array.isArray(row)
      ? cleanVariationLabel(row[0])
      : cleanVariationLabel(row?.label || row?.name || row?.key);
  const findRow = (matcher) => rowList.find((row) => matcher(rowLabel(row)));

  const xRow = findRow((label) =>
    /^(?:x|المتغير)$/iu.test(label.replace(/\\/g, "").trim())
  );
  // علامة الاشتقاق مطلوبة هنا؛ عدم جعلها اختيارية يمنع خلط f(x) مع f'(x).
  const derivativeRow = findRow(isDerivativeVariationLabel);
  const functionRow = findRow(isFunctionVariationLabel);

  const derivativeSource =
    derivativeRow ||
    rowMap.derivative ||
    rowMap["f'(x)"] ||
    source.derivative ||
    source.derivative_row;
  const functionSource =
    functionRow ||
    rowMap.function ||
    rowMap["f(x)"] ||
    source.function ||
    source.function_row;
  const derivativeObject = asObject(derivativeSource);
  const functionObject = asObject(functionSource);

  let xValues = stripVariationRowLabel(
    firstVariationList(
      xRow,
      rowMap.x,
      source.x_values,
      source.x,
      source.breakpoints,
      source.critical_points,
      source.points,
      source.columns
    ),
    /^(?:x|المتغير)$/iu
  );

  let derivativeCells = stripVariationRowLabel(
    firstVariationList(
      derivativeSource,
      derivativeObject.interval_signs,
      derivativeObject.signs,
      source.derivative_signs,
      source.signs
    ),
    /^(?:f['’′]+\(x\)|المشتقة)$/iu
  );

  let functionCells = stripVariationRowLabel(
    firstVariationList(
      functionSource,
      functionObject.values,
      source.function_values,
      source.values,
      source.limits
    ),
    /^(?:f\(x\)|f|الدالة)$/iu
  );

  const inlineDirections = functionCells.filter(isVariationArrowValue);
  const directions = firstVariationList(
    functionObject.directions,
    functionObject.arrows,
    source.directions,
    source.variation_directions,
    source.arrows,
    inlineDirections
  ).map(normalizeVariationDirection);

  functionCells = functionCells.filter(
    (cell) => !isVariationArrowValue(cell)
  );

  const rawExplicitBranches = asArray(
    functionObject.branches || source.branches
  );
  let explicitBranches = rawExplicitBranches.map((rawBranch, index) => {
    const branch = asObject(rawBranch);
    return {
      id: String(branch.id ?? `branch-${index}`),
      startX: cleanVariationLabel(
        branch.start_x ?? branch.startX ?? xValues[index] ?? ""
      ),
      endX: cleanVariationLabel(
        branch.end_x ?? branch.endX ?? xValues[index + 1] ?? ""
      ),
      startValue: cleanVariationLabel(
        branch.start_value ?? branch.startValue ?? branch.from ?? ""
      ),
      endValue: cleanVariationLabel(
        branch.end_value ?? branch.endValue ?? branch.to ?? ""
      ),
      direction: normalizeVariationDirection(
        branch.direction ?? branch.arrow ?? directions[index] ?? "up"
      ),
    };
  });

  if (xValues.length < 2 && explicitBranches.length > 0) {
    xValues = [
      explicitBranches[0].startX,
      ...explicitBranches.map((branch) => branch.endX),
    ].filter(hasText);
  }

  if (xValues.length < 2) xValues = ["-\\infty", "+\\infty"];

  const intervalCount = Math.max(
    xValues.length - 1,
    explicitBranches.length,
    directions.length,
    functionCells.length - 1,
    1
  );

  // إذا كانت branches المرسلة ناقصة، نكملها دون تكرار القيم عند الحدود.
  const branches = Array.from({ length: intervalCount }, (_, index) => {
    const explicit = explicitBranches[index];
    return {
      id: explicit?.id || `branch-${index}`,
      startX: explicit?.startX || xValues[index] || "",
      endX: explicit?.endX || xValues[index + 1] || "",
      startValue: explicit?.startValue || functionCells[index] || "",
      endValue: explicit?.endValue || functionCells[index + 1] || "",
      direction:
        explicit?.direction || directions[index] || "up",
    };
  });

  // عدد نقاط x يجب أن يساوي عدد المجالات + 1 حتى تبقى الأعمدة متطابقة.
  const safeXValues = Array.from(
    { length: branches.length + 1 },
    (_, index) =>
      xValues[index] ||
      (index === 0
        ? branches[0]?.startX
        : branches[index - 1]?.endX) ||
      ""
  );

  derivativeCells = derivativeCells.filter(
    (cell) => !isVariationArrowValue(cell)
  );
  const signs = normalizeIntervalSigns(derivativeCells, branches.length);
  const hasDerivativeRow =
    Boolean(derivativeSource) && signs.some(hasText);

  return {
    title: source.title || "جدول تغيرات الدالة",
    functionName:
      cleanVariationLabel(
        rowLabel(functionRow) ||
          source.function_name ||
          source.functionName ||
          "f(x)"
      ) || "f(x)",
    derivativeName:
      cleanVariationLabel(
        rowLabel(derivativeRow) ||
          source.derivative_name ||
          "f'(x)"
      ) || "f'(x)",
    domain: cleanVariationLabel(source.domain || source.interval || ""),
    xValues: safeXValues,
    signs,
    branches,
    hasDerivativeRow,
    discontinuities: asArray(source.discontinuities),
    notes: normalizeStringList(source.notes || source.note),
  };
}

function VariationArrow({
  direction = "up",
  startLabel = "",
  endLabel = "",
  id,
  showStart = true,
  showEnd = true,
}) {
  const normalizedDirection = normalizeVariationDirection(direction);
  const isUp = normalizedDirection === "up";
  const yStart = isUp ? 76 : 24;
  const yEnd = isUp ? 24 : 76;
  const markerId = `variation-arrow-${String(id).replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div
      dir="ltr"
      className="relative h-[124px] w-full min-w-[170px] overflow-hidden"
      style={{ direction: "ltr", unicodeBidi: "isolate" }}
    >
      {showStart && hasText(startLabel) && (
        <div
          className={cn(
            "absolute left-2 z-10 rounded-md bg-white/95 px-1.5 py-0.5 text-sm font-black text-slate-950",
            isUp ? "bottom-1.5" : "top-1.5"
          )}
        >
          <MathLTR>{startLabel}</MathLTR>
        </div>
      )}

      {showEnd && hasText(endLabel) && (
        <div
          className={cn(
            "absolute right-2 z-10 rounded-md bg-white/95 px-1.5 py-0.5 text-sm font-black text-slate-950",
            isUp ? "top-1.5" : "bottom-1.5"
          )}
        >
          <MathLTR>{endLabel}</MathLTR>
        </div>
      )}

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full text-blue-800"
        style={{ maxWidth: "none", height: "100%" }}
        aria-hidden="true"
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="7"
            markerHeight="7"
            refX="6.4"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor" />
          </marker>
        </defs>

        <line
          x1="12"
          y1={yStart}
          x2="88"
          y2={yEnd}
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          markerEnd={`url(#${markerId})`}
        />
      </svg>
    </div>
  );
}

function isDiscontinuityPoint(discontinuities, pointIndex) {
  return discontinuities.some((item) => {
    const index = Number(
      item?.point_index ??
      item?.pointIndex ??
      item?.column_index ??
      item?.columnIndex
    );

    return Number.isFinite(index) && index === pointIndex;
  });
}

function VariationIntervalsHeader({
  xValues,
  discontinuities,
}) {
  const intervalCount = Math.max(xValues.length - 1, 1);

  return (
    <div
      className="relative grid min-h-[56px]"
      style={{
        gridTemplateColumns: `repeat(${intervalCount}, minmax(180px, 1fr))`,
      }}
    >
      {Array.from({ length: intervalCount }, (_, index) => (
        <div
          key={`header-interval-${index}`}
          className={cn(
            "relative",
            index > 0 && "border-l border-slate-300",
            index > 0 &&
              isDiscontinuityPoint(discontinuities, index) &&
              "border-l-[5px] border-double border-slate-900"
          )}
        >
          {index === 0 && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <MathLTR className="text-sm font-black sm:text-base">
                {xValues[0]}
              </MathLTR>
            </div>
          )}

          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2",
              index === intervalCount - 1
                ? "right-3"
                : "right-0 translate-x-1/2"
            )}
          >
            <MathLTR className="text-sm font-black sm:text-base">
              {xValues[index + 1]}
            </MathLTR>
          </div>
        </div>
      ))}
    </div>
  );
}

function VariationIntervalCell({
  children,
  separated = false,
  divider = false,
  className = "",
}) {
  return (
    <div
      className={cn(
        "relative min-w-0",
        separated
          ? "border-l-[5px] border-double border-slate-900"
          : divider && "border-l border-slate-300",
        className
      )}
    >
      {children}
    </div>
  );
}

function VariationTable({ table }) {
  const data = normalizeVariationTable(table);
  const intervalCount = Math.max(data.branches.length, 1);
  const minWidth = Math.max(500, 84 + intervalCount * 180);

  return (
    <figure
      dir="ltr"
      className="mx-auto my-5 w-full max-w-4xl overflow-hidden rounded-2xl border-2 border-slate-800 bg-white shadow-sm"
      style={{ direction: "ltr", unicodeBidi: "isolate" }}
    >
      <figcaption
        dir="rtl"
        className="border-b-2 border-slate-800 bg-slate-50 px-4 py-3 text-center text-base font-black text-slate-950"
      >
        {data.title || "جدول تغيرات الدالة"}
      </figcaption>

      <div className="w-full overflow-x-auto overflow-y-hidden overscroll-x-contain">
        <div className="w-full" style={{ minWidth }}>
          <div
            className="grid border-b-2 border-slate-800"
            style={{
              gridTemplateColumns: "84px minmax(0, 1fr)",
            }}
          >
            <VariationLabelCell value="x" className="min-h-[56px]" />

            <VariationIntervalsHeader
              xValues={data.xValues}
              discontinuities={data.discontinuities}
            />
          </div>

          {data.hasDerivativeRow && (
            <div
              className="grid border-b-2 border-slate-800"
              style={{
                gridTemplateColumns: `84px repeat(${intervalCount}, minmax(180px, 1fr))`,
              }}
            >
              <VariationLabelCell
                value={data.derivativeName || "f'(x)"}
                className="min-h-[58px]"
              />

              {data.branches.map((branch, index) => (
                <VariationIntervalCell
                  key={`sign-${branch.id || index}`}
                  divider={index > 0}
                  separated={
                    index > 0 &&
                    isDiscontinuityPoint(data.discontinuities, index)
                  }
                >
                  <div className="flex min-h-[58px] items-center justify-center px-3 text-lg font-black">
                    {hasText(data.signs[index]) && (
                      <MathLTR
                        className={cn(
                          data.signs[index] === "+"
                            ? "text-emerald-700"
                            : data.signs[index] === "-"
                              ? "text-rose-700"
                              : "text-slate-900"
                        )}
                      >
                        {data.signs[index]}
                      </MathLTR>
                    )}
                  </div>
                </VariationIntervalCell>
              ))}
            </div>
          )}

          <div
            className="grid"
            style={{
              gridTemplateColumns: `84px repeat(${intervalCount}, minmax(180px, 1fr))`,
            }}
          >
            <VariationLabelCell
              value={data.functionName || "f(x)"}
              className="min-h-[124px]"
            />

            {data.branches.map((branch, index) => (
              <VariationIntervalCell
                key={`branch-${branch.id || index}`}
                divider={index > 0}
                separated={
                  index > 0 &&
                  isDiscontinuityPoint(data.discontinuities, index)
                }
              >
                <VariationArrow
                  id={`${branch.id || index}-${data.functionName}`}
                  direction={branch.direction}
                  startLabel={branch.startValue}
                  endLabel={branch.endValue}
                  showStart={
                    index === 0 ||
                    isDiscontinuityPoint(data.discontinuities, index)
                  }
                />
              </VariationIntervalCell>
            ))}
          </div>
        </div>
      </div>

      {hasText(data.domain) && (
        <div
          dir="rtl"
          className="flex items-center justify-center gap-2 border-t-2 border-slate-800 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700"
        >
          <span>مجال الدراسة:</span>
          <MathLTR>{data.domain}</MathLTR>
        </div>
      )}

      {data.notes.length > 0 && (
        <div
          dir="rtl"
          className="border-t border-slate-300 bg-amber-50 px-4 py-2 text-right text-xs font-bold leading-6 text-amber-950 sm:text-sm"
        >
          {data.notes.map((note, index) => (
            <MathText block key={`${index}-${note.slice(0, 24)}`}>
              {note}
            </MathText>
          ))}
        </div>
      )}
    </figure>
  );
}

function VariationLabelCell({ value, className = "" }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center border-r-2 border-slate-800 bg-slate-100 px-2 font-black text-slate-950",
        className
      )}
    >
      <MathLTR className="text-base sm:text-lg">{value}</MathLTR>
    </div>
  );
}

function VariationValueCell({
  value,
  className = "",
  emphasize = false,
}) {
  return (
    <div
      className={cn(
        "flex min-h-20 items-center justify-center border-r border-slate-400 px-4 font-black text-slate-950 last:border-r-0",
        emphasize && "bg-slate-50",
        className
      )}
    >
      {hasText(String(value ?? "")) && (
        <MathLTR className="text-base">{String(value)}</MathLTR>
      )}
    </div>
  );
}

function DataTable({ table }) {
  if (!table) return null;

  const nestedData =
    table?.data &&
    typeof table.data === "object" &&
    !Array.isArray(table.data)
      ? table.data
      : null;

  const isProgressTable =
    table?.type === "progress" ||
    table?.source_kind === "solution_reconstruction";

  /*
   * ندعم البنيتين:
   *
   * 1) القديمة:
   * {
   *   headers: [...],
   *   rows: [...]
   * }
   *
   * 2) الجديدة المستعملة في ملفات 2009-2013:
   * {
   *   title: "...",
   *   data: {
   *     headers: [...],
   *     rows: [...]
   *   }
   * }
   */
  const headers = asArray(
    nestedData?.headers ||
      nestedData?.columns ||
      nestedData?.column_names ||
      nestedData?.cols ||
      table?.headers ||
      table?.columns ||
      table?.column_names ||
      table?.cols
  );

  let rawRows =
    nestedData?.rows ??
    nestedData?.values ??
    nestedData?.body ??
    table?.rows ??
    table?.values ??
    table?.body ??
    [];

  /*
   * table.data قد يكون قديمًا عبارة عن rows مباشرة.
   * أما إذا كان كائنًا {headers, rows} فلا نمرره كصفوف.
   */
  if (
    !nestedData &&
    Array.isArray(table?.data)
  ) {
    rawRows = table.data;
  }

  const rows = asArray(rawRows);

  if (headers.length === 0 && rows.length === 0) return null;

  const maxColumns = Math.max(
    headers.length,
    ...rows.map((row) =>
      Array.isArray(row)
        ? row.length
        : row && typeof row === "object"
          ? Object.keys(row).length
          : 1
    ),
    1
  );

  return (
    <div
      className={cn(
        "my-5 w-full overflow-hidden rounded-2xl border bg-white shadow-sm",
        isProgressTable ? "border-blue-300" : "border-slate-300"
      )}
    >
      {hasText(table?.title) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-300 bg-gradient-to-l from-slate-100 to-white px-4 py-3">
          <p className="font-black text-slate-900">
            <MathText>{table.title}</MathText>
          </p>

          <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
            جدول
          </span>
        </div>
      )}

      <div className="w-full overflow-x-auto overscroll-x-contain">
        <table
          dir="ltr"
          className="min-w-max w-full border-collapse text-center text-sm sm:text-base"
        >
          {headers.length > 0 && (
            <thead>
              <tr className="bg-slate-100">
                {headers.map((header, index) => (
                  <th
                    key={index}
                    dir={index === 0 ? "rtl" : "ltr"}
                    className={cn(
                      "min-w-20 border border-slate-300 px-3 py-3 font-black text-slate-950",
                      index === 0 &&
                        "sticky left-0 z-20 min-w-36 bg-slate-100 text-right"
                    )}
                  >
                    <MathText>{String(header ?? "")}</MathText>
                  </th>
                ))}
              </tr>
            </thead>
          )}

          <tbody>
            {rows.map((row, rowIndex) => {
              const rowObject = asObject(row);

              let cells = Array.isArray(row)
                ? row
                : headers.length > 0
                  ? headers.map((header) => {
                      const directValue = rowObject?.[header];

                      if (directValue !== undefined) {
                        return directValue;
                      }

                      const normalizedHeader = String(header)
                        .trim()
                        .toLowerCase();

                      const matchingKey = Object.keys(rowObject).find(
                        (key) =>
                          String(key).trim().toLowerCase() ===
                          normalizedHeader
                      );

                      return matchingKey
                        ? rowObject[matchingKey]
                        : "";
                    })
                  : Object.values(rowObject);

              /*
               * مهم جدًا لجدول بكالوريا 2009:
               * headers = []
               * وكل صف عبارة عن:
               * [اسم الكمية, القيمة1, القيمة2, ...]
               */
              cells = [
                ...cells,
                ...Array(
                  Math.max(0, maxColumns - cells.length)
                ).fill("")
              ];

              return (
                <tr
                  key={rowIndex}
                  className={
                    rowIndex % 2 === 0
                      ? "bg-white"
                      : "bg-slate-50"
                  }
                >
                  {cells.map((cell, cellIndex) => {
                    const firstColumnWithoutHeader =
                      headers.length === 0 &&
                      cellIndex === 0;

                    const emptyCell =
                      cell === "" ||
                      cell === null ||
                      cell === undefined;

                    return (
                      <td
                        key={cellIndex}
                        dir={cellIndex === 0 ? "rtl" : "ltr"}
                        className={cn(
                          "min-w-20 border border-slate-300 px-3 py-3 font-bold text-slate-800",
                          (cellIndex === 0 || firstColumnWithoutHeader) &&
                            "sticky left-0 z-10 min-w-40 bg-inherit text-right font-black",
                          firstColumnWithoutHeader &&
                            "bg-indigo-50 text-indigo-950"
                        )}
                      >
                        {emptyCell ? (
                          <span
                            aria-label="خانة فارغة مطلوبة"
                            className="mx-auto block h-8 min-w-16 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50"
                          />
                        ) : (
                          <MathText>{String(cell)}</MathText>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasText(table?.note) && (
        <div className="border-t border-slate-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <MathText block>{table.note}</MathText>
        </div>
      )}
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
