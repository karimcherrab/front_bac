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


function normalizeAxisExercisePayload(payload) {
  const source = asObject(payload);

  // Format Bac classique: { chapter, exercises: [...] }
  if (Array.isArray(source.exercises)) return source;

  // Nouveau format des fichiers d'axes:
  // { title, tag, question_count, questions: [{ text, graph_data, solution... }] }
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
      branches: source?.branches || question?.branches || [],
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
        title: source.title || "تمارين المحور",
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

function getExerciseStatementSections(exercise) {
  return asArray(
    exercise?.statement_sections || exercise?.content?.statement_sections
  ).filter((section) => hasText(section?.text || section?.content));
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
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


function normalizeQuestionNumber(value, fallbackNumber) {
  const raw = String(value ?? fallbackNumber ?? "").trim();
  const match = raw.match(/\d+/);
  return match ? match[0] : String(fallbackNumber ?? "");
}

function stripLeadingQuestionNumber(value, expectedNumber) {
  const text = normalizeDisplayText(value);
  if (!text) return "";

  const expected = normalizeQuestionNumber(expectedNumber, "");
  if (!expected) return text;

  // يحذف فقط ترقيم نفس السؤال من بداية النص:
  // 1- ... / 1) ... / 1. ... / 1 ـ ... / 1: ...
  const pattern = new RegExp(
    `^\\s*${expected}\\s*(?:[-–—ـ.)،:؛]|\\))\\s*`,
    "u"
  );

  return text.replace(pattern, "").trim();
}


function hasExplicitQuestionPrefix(value) {
  const text = normalizeDisplayText(value);
  if (!text) return false;

  /*
   * Cas déjà numérotés dans le texte du JSON:
   *
   * I-1- ...
   * I-2-أ- ...
   * II-1-ب- ...
   * III- ...
   * 1-أ- ...
   * 2-ب- ...
   *
   * Dans ces cas, on ne doit PAS ajouter automatiquement
   * (1), (2), (3)... devant la question.
   */
  return /^(?:(?:I{1,3}|IV|V|VI{0,3}|IX|X)\s*[-–—ـ]\s*(?:\d+\s*[-–—ـ]\s*)?(?:[أابتثجحخدذرزسشصضطظعغفقكلمنهوي]\s*[-–—ـ]\s*)?|\d+\s*[-–—ـ]\s*[أابتثجحخدذرزسشصضطظعغفقكلمنهوي]\s*[-–—ـ])/u.test(
    text
  );
}

function getQuestionDisplayText(question, fallbackNumber) {
  const text = normalizeDisplayText(question?.text);
  if (!text) return "";

  /*
   * Si le JSON contient déjà une numérotation pédagogique structurée
   * (I-1, II-2-b, III...), on la conserve telle quelle.
   *
   * Sinon, on retire uniquement la répétition éventuelle du numéro simple
   * qui sera affiché dans la colonne de numérotation.
   */
  if (hasExplicitQuestionPrefix(text)) {
    return text;
  }

  return stripLeadingQuestionNumber(text, fallbackNumber);
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

function RichExerciseText({ children, className = "" }) {
  const text = normalizeDisplayText(children);
  if (!text) return null;

  /*
   * لا نحاول استخراج الجداول آليًا من النص.
   * الاستخراج التلقائي كان يعتبر الأرقام والمعادلات صفوف جدول،
   * فيحوّل أجزاء من نص التمرين إلى جدول غير صحيح.
   *
   * الجداول الآن تأتي صراحة من JSON عبر table_data،
   * لذلك يبقى النص كما هو، وتظهر الجداول بدقة منفصلة عنه.
   */
  return (
    <MathText
      block
      className={cn(
        "whitespace-pre-wrap break-words font-semibold leading-[2.45rem] text-slate-950",
        className
      )}
    >
      {text}
    </MathText>
  );
}

function normalizeEscapedLatex(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\u00a0/gi, " ")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")

    /*
     * بعض ملفات JSON القديمة قد تحتوي على أوامر LaTeX
     * بعد ضياع الـ backslash، مثل:
     * dfrac{1}{2} أو cdot أو sqrt{x}
     *
     * نعيد الـ backslash فقط للأوامر المعروفة عندما لا يكون
     * أمامها backslash أصلًا، حتى لا نكسر النص العربي.
     */
    .replace(
      /(^|[^\\A-Za-z])(?=(?:dfrac|tfrac|frac|sqrt|cdot|times|leq|geq|neq|infty|rightarrow|leftarrow|Delta|alpha|beta|gamma|theta|lambda|mu|pi|omega|mathrm|mathbf|mathbb|mathcal|overline|underline)\b)/g,
      "$1\\"
    )

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
    if (currentExercise?.id) {
      fetchSavedExplanations(currentExercise.id);
    }
  }, [currentExercise?.id, token]);

  const handleQuestionReExplanation = async (
    exercise,
    question,
    questionIndex,
    forceRegenerate = false
  ) => {
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
          padding: 0.25rem 0;
        }

        .math-content mjx-container:not([display="true"]) {
          max-width: 100%;
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

        @media (max-width: 359px) {
          .math-content {
            font-size: 0.9rem;
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
          bg-[#f4f6f8]
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
          sm:space-y-5
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

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowFullSolution((previous) => !previous)}
                className={cn(
                  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition sm:w-auto sm:px-6",
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
    <header className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-900 px-4 py-5 text-white min-[360px]:px-5 sm:px-8 sm:py-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 sm:h-12 sm:w-12">
              <GraduationCap size={27} />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-300">
                تمارين البكالوريا
              </p>
              <h1 className="mt-1 break-words text-xl font-black leading-8 min-[360px]:text-2xl sm:text-3xl">
                {chapter?.title || "تمارين الفصل"}
              </h1>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap gap-2">
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
        <div className="
          flex
          min-w-0
          items-center
          gap-2
          overflow-x-auto
          border-t
          border-slate-100
          px-4
          py-3
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
          sm:flex-wrap
          sm:overflow-visible
          sm:px-8
          sm:py-4
        ">
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
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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

      <div className="grid min-w-0 grid-cols-1 gap-3 p-3 min-[360px]:p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
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
        "group relative min-w-0 overflow-hidden rounded-2xl border p-3 text-right transition duration-200 min-[360px]:p-4",
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
    <div className="
      grid
      min-w-0
      grid-cols-[1fr_auto_1fr]
      items-center
      gap-2
      rounded-xl
      border
      border-slate-200
      bg-white
      p-2
      shadow-sm
      min-[360px]:gap-3
      min-[360px]:p-3
    ">
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className="
          inline-flex
          min-h-10
          min-w-0
          items-center
          justify-center
          gap-1
          rounded-lg
          border
          border-slate-200
          px-2
          py-2
          text-xs
          font-black
          text-slate-700
          transition
          hover:bg-slate-50
          disabled:cursor-not-allowed
          disabled:opacity-40
          min-[360px]:gap-2
          min-[360px]:px-3
          min-[360px]:text-sm
          sm:px-4
        "
      >
        <ChevronRight size={18} />
        السابق
      </button>

      <div className="min-w-0 text-center">
        <p className="text-xs font-bold text-slate-500">التمرين</p>
        <p className="text-base font-black text-slate-900">
          {currentIndex + 1} / {total}
        </p>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex >= total - 1}
        className="
          inline-flex
          min-h-10
          min-w-0
          items-center
          justify-center
          gap-1
          rounded-lg
          border
          border-slate-200
          px-2
          py-2
          text-xs
          font-black
          text-slate-700
          transition
          hover:bg-slate-50
          disabled:cursor-not-allowed
          disabled:opacity-40
          min-[360px]:gap-2
          min-[360px]:px-3
          min-[360px]:text-sm
          sm:px-4
        "
      >
        التالي
        <ChevronLeft size={18} />
      </button>
    </div>
  );
}


function ExamPaper({ exercise, questions }) {
  const statementGraphs = getExerciseStatementGraphs(exercise);
  const statementSections = getExerciseStatementSections(exercise);
  const statementTables = getExerciseStatementTables(exercise);
  const hasMainStatement = hasText(exercise?.statement);
  const branches = getExerciseBranches(exercise);
  const visibleQuestions = getVisibleQuestions(exercise, questions);

  return (
    <article
      dir="rtl"
      className="
        mx-auto
        w-full
        min-w-0
        max-w-[980px]
        overflow-hidden
        rounded-2xl
        border
        border-slate-300
        bg-white
        shadow-[0_24px_70px_-35px_rgba(15,23,42,0.45)]
        sm:rounded-[1.25rem]
      "
    >
      {/* رأس ورقة البكالوريا */}
      <header className="border-b-2 border-slate-900 px-3 py-4 min-[360px]:px-4 sm:px-8 sm:py-5">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start sm:gap-4">
          <div className="text-right text-[0.78rem] font-bold leading-6 text-slate-700">
            <p>الجمهورية الجزائرية الديمقراطية الشعبية</p>
            <p>وزارة التربية الوطنية</p>
            {branches.length > 0 && (
              <p className="mt-1 text-slate-500">
                الشعبة: {branches.map((branch) => branch.name).join("، ")}
              </p>
            )}
          </div>

          <div className="text-center">
            <p className="text-xs font-black tracking-wide text-slate-500">
              امتحان البكالوريا
            </p>
            <h2 className="mt-1 break-words text-lg font-black leading-8 text-slate-950 min-[360px]:text-xl sm:text-2xl">
              {getCleanExerciseTitle(exercise)}
            </h2>
          </div>

          <div className="text-left text-[0.78rem] font-bold leading-6 text-slate-700">
            {exercise?.year && <p>الدورة: {exercise.year}</p>}
            {(exercise?.source_page || asArray(exercise?.source_pages).length > 0) && (
              <p>
                الصفحة: {exercise?.source_page || asArray(exercise?.source_pages).join("، ")}
              </p>
            )}
            {exercise?.points && <p>النقطة: {exercise.points}</p>}
          </div>
        </div>
      </header>

      {/* النص والأسئلة في كتلة واحدة مثل ورقة البكالوريا */}
      <div className="px-3 py-5 min-[360px]:px-4 min-[360px]:py-6 sm:px-10 sm:py-10">
        <div className="mx-auto max-w-[860px]">
          <div className="mb-6 flex items-center justify-center">
            <span className="border-b-2 border-slate-900 px-5 pb-1 text-lg font-black text-slate-950">
              نص التمرين
            </span>
          </div>

          <div className="min-w-0 space-y-4 text-[0.94rem] font-semibold leading-8 text-slate-950 min-[360px]:text-base min-[360px]:leading-9 sm:space-y-5 sm:text-[1.08rem] sm:leading-[2.45rem]">
            {hasMainStatement && (
              <RichExerciseText className="text-slate-950">
                {exercise.statement}
              </RichExerciseText>
            )}

            {statementSections.map((section, index) => {
              const sectionText = section?.text || section?.content;

              if (!hasText(sectionText)) return null;

              return (
                <div
                  key={section?.id ?? index}
                  className="break-inside-avoid"
                >
                  {hasText(section?.title) && (
                    <h3 className="mb-1 font-black text-slate-950">
                      {section.title}
                    </h3>
                  )}

                  <MathText block className="leading-[2.45rem] text-slate-950">
                    {sectionText}
                  </MathText>
                </div>
              );
            })}

            {statementGraphs.map((graph, graphIndex) => (
              <div
                key={graph?.id ?? graph?.path ?? `exercise-statement-graph-${graphIndex}`}
                className="my-8 break-inside-avoid"
              >
                <GraphRenderer graph={graph} compact />
              </div>
            ))}

            {/* الجداول المعطاة أصلًا في نص التمرين */}
            {statementTables.length > 0 && (
              <div className="my-7 space-y-5 break-inside-avoid">
                {statementTables.map((table, tableIndex) => (
                  <SmartMathTable
                    key={`exercise-statement-table-${tableIndex}`}
                    table={table}
                  />
                ))}
              </div>
            )}

            {/* الأسئلة متصلة بالنص من دون بطاقات منفصلة */}
            {visibleQuestions.length > 0 && (
              <ol className="mt-5 space-y-4">
              {visibleQuestions.map((question, index) => {
                const graphs = getQuestionStatementGraphs(question).filter(
                  (graph) => !statementGraphs.some((statementGraph) =>
                    (statementGraph?.id && graph?.id && statementGraph.id === graph.id) ||
                    (statementGraph === graph)
                  )
                );
                const tables = getQuestionTables(question);
                const number =
                  question?.display_label ||
                  question?.number ||
                  index + 1;

                const explicitPrefix = hasExplicitQuestionPrefix(question?.text);

                const questionText = getQuestionDisplayText(
                  question,
                  normalizeQuestionNumber(number, index + 1)
                );

                return (
                  <li
                    key={question?.id ?? index}
                    className={cn(
                      "min-w-0 break-inside-avoid",
                      explicitPrefix
                        ? "block"
                        : "grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 min-[360px]:gap-x-3"
                    )}
                  >
                    {!explicitPrefix && (
                      <span className="pt-0.5 font-black text-slate-950">
                        {String(number).endsWith(")")
                          ? number
                          : `(${number})`}
                      </span>
                    )}

                    <div className="min-w-0">
                      <MathText
                        block
                        className="font-semibold leading-[2.45rem] text-slate-950"
                      >
                        {questionText}
                      </MathText>

                      {graphs.map((graph, graphIndex) => (
                        <div
                          key={`question-graph-${question?.id ?? index}-${graphIndex}`}
                          className="my-6"
                        >
                          <GraphRenderer graph={graph} compact />
                        </div>
                      ))}

                      {tables.map((table, tableIndex) => (
                        <div
                          key={`question-table-${question?.id ?? index}-${tableIndex}`}
                          className="my-6"
                        >
                          <SmartMathTable table={table} />
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
              </ol>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-center text-xs font-bold text-slate-500">
        انتهى التمرين
      </footer>
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
  const exerciseSolutionGraphs = getExerciseSolutionGraphs(exercise);

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-2xl border border-emerald-300 bg-white shadow-sm">
      <div className="border-b-2 border-emerald-700 bg-emerald-50 px-4 py-4 sm:px-9 sm:py-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-emerald-700" size={27} />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
              التصحيح النموذجي
            </p>
            <h2 className="mt-1 break-words text-lg font-black leading-8 text-slate-950 min-[360px]:text-xl sm:text-2xl">
              الحل الكامل للتمرين
            </h2>
          </div>
        </div>
      </div>

      <div className="min-w-0 px-3 py-5 min-[360px]:px-4 sm:px-10 sm:py-9">
        {questions.map((question, index) => {
          const key = questionKey(exercise, question, index);
          const solution = asObject(question?.solution);

          return (
            <section
              key={key}
              className={cn(
                "min-w-0 py-5 first:pt-0 last:pb-0 sm:py-7",
                index > 0 && "border-t border-slate-300"
              )}
            >
              <div className="mb-4 min-w-0 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 min-[360px]:px-4 min-[360px]:py-4 sm:mb-5">
                <p className="mb-2 text-xs font-black text-blue-700">
                  حل السؤال
                </p>
                {!isGenericQuestionText(question?.text) ? (
                  <MathText
                    block
                    className="text-base font-black leading-9 text-slate-950 sm:text-lg"
                  >
                    {getQuestionDisplayText(
                      question,
                      question?.display_label ||
                        question?.number ||
                        index + 1
                    )}
                  </MathText>
                ) : (
                  <p className="text-base font-black text-slate-950 sm:text-lg">
                    الحل النموذجي الكامل للتمرين
                  </p>
                )}
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
                onQuestionReExplanation={onQuestionReExplanation}
                onSelectSavedExplanation={onSelectSavedExplanation}
              />
            </section>
          );
        })}

        {/* {exerciseSolutionGraphs.length > 0 && (
          <section className="mt-8 space-y-5 border-t border-slate-300 pt-7">
            <div className="flex items-center gap-2">
              <FileText size={19} className="text-emerald-700" />
              <h3 className="font-black text-slate-950">
                الرسومات والوثائق الخاصة بالحل
              </h3>
            </div>

            {exerciseSolutionGraphs.map((graph, index) => (
              <GraphRenderer
                key={graph?.id ?? graph?.path ?? `exercise-solution-graph-${index}`}
                graph={graph}
              />
            ))}
          </section>
        )} */}
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
  onQuestionReExplanation,
  onSelectSavedExplanation,
}) {
  const methodology = getMethodology(question, solution);
  const constructionValues = getConstructionValues(question, solution);
  const solutionTables = getSolutionTables(solution);
  const steps = normalizeSteps(solution?.steps);
  const mistakes = normalizeStringList(solution?.common_mistakes);
  const solutionGraphs = getSolutionGraphs(solution);

  if (
    steps.length === 0 &&
    !hasText(solution?.final_answer) &&
    solutionTables.length === 0 &&
    solutionGraphs.length === 0
  ) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
        <TriangleAlert className="mt-0.5 shrink-0" size={18} />
        لا يوجد حل محفوظ لهذا السؤال.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {(hasText(solution?.main_idea) || hasText(solution?.detailed_explanation)) && (
        <section className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-4">
          <div className="mb-2 flex items-center gap-2 text-blue-800">
            <Lightbulb size={17} />
            <h3 className="text-sm font-black">الفكرة قبل الحساب</h3>
          </div>
          {hasText(solution?.main_idea) && (
            <MathText block className="font-bold leading-8 text-slate-900">
              {solution.main_idea}
            </MathText>
          )}
          {hasText(solution?.detailed_explanation) && (
            <MathText block className="mt-2 font-medium leading-8 text-slate-700">
              {solution.detailed_explanation}
            </MathText>
          )}
        </section>
      )}


      {steps.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-3 sm:px-5">
            <Target size={19} className="text-slate-800" />
            <h3 className="text-base font-black text-slate-950">
              خطوات الحل والحساب
            </h3>
          </div>

          <div className="min-w-0 space-y-3 p-3 min-[360px]:p-4 sm:space-y-4 sm:p-5">
            {steps.map((step, index) => (
              <SolutionStep
                key={step?.id ?? step?.step_number ?? index}
                step={step}
                fallbackNumber={index + 1}
              />
            ))}
          </div>
        </section>
      )}


      {solutionTables.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <ListChecks size={19} className="text-blue-700" />
            <h3 className="font-black text-slate-950">الجداول والحسابات المنظمة</h3>
          </div>
          {solutionTables.map((table, index) => (
            <SmartMathTable key={`solution-table-${index}`} table={table} />
          ))}
        </section>
      )}

      {solutionGraphs.map((graph, index) => (
        <GraphRenderer key={`solution-graph-${index}`} graph={graph} />
      ))}

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

      {exercise?.id && (
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

  const stepGraphs = getStepGraphs(step);
  const stepTables = getStepTables(step);

  return (
    <article
      dir="rtl"
      className="
        min-w-0
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        shadow-sm
      "
    >
      <div
        className="
          flex
          min-w-0
          items-start
          gap-3
          px-4
          py-4
          sm:gap-4
          sm:px-5
          sm:py-5
        "
      >
        <div
          className="
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-violet-700
            text-sm
            font-black
            text-white
            shadow-sm
          "
        >
          {number}
        </div>

        <div className="min-w-0 flex-1">
          {hasText(step?.title) && (
            <h4
              className="
                mb-3
                break-words
                text-base
                font-black
                leading-8
                text-slate-950
                sm:text-lg
              "
            >
              {step.title}
            </h4>
          )}

          {hasText(step?.explanation) && (
            <RichExerciseText
              className="
                max-w-full
                font-medium
                leading-9
                text-slate-800
              "
            >
              {step.explanation}
            </RichExerciseText>
          )}

          {hasText(ruleUsed) && (
            <div
              className="
                mt-4
                min-w-0
                overflow-x-auto
                rounded-xl
                border
                border-amber-100
                bg-amber-50
                px-4
                py-3
              "
            >
              <p className="mb-1 text-xs font-black text-amber-700">
                القانون المستعمل
              </p>

              <MathText
                block
                className="
                  min-w-0
                  font-bold
                  leading-8
                  text-amber-950
                "
              >
                {ruleUsed}
              </MathText>
            </div>
          )}

          {hasText(why) && (
            <div
              className="
                mt-3
                flex
                min-w-0
                items-start
                gap-2
                rounded-xl
                bg-violet-50
                px-4
                py-3
                text-sm
                leading-7
                text-slate-700
              "
            >
              <Lightbulb
                size={16}
                className="
                  mt-1.5
                  shrink-0
                  text-violet-600
                "
              />

              <MathText
                block
                className="min-w-0 font-medium"
              >
                {why}
              </MathText>
            </div>
          )}

          {stepGraphs.length > 0 && (
            <div className="mt-5 min-w-0 space-y-4">
              {stepGraphs.map((graph, graphIndex) => (
                <GraphRenderer
                  key={`step-graph-${number}-${graphIndex}`}
                  graph={graph}
                />
              ))}
            </div>
          )}

          {stepTables.length > 0 && (
            <div className="mt-4 min-w-0 space-y-4">
              {stepTables.map((table, tableIndex) => (
                <SmartMathTable
                  key={`step-table-${number}-${tableIndex}`}
                  table={table}
                />
              ))}
            </div>
          )}

          {hasText(mainLatex) && (
            <div className="mt-4 min-w-0 overflow-x-auto">
              <CalculationBox value={mainLatex} />
            </div>
          )}

          {calculations.length > 0 && (
            <div className="mt-4 min-w-0 space-y-3">
              <p className="text-xs font-black text-slate-600">
                تفاصيل الحساب
              </p>

              {calculations.map(
                (calculation, calculationIndex) => (
                  <div
                    key={calculationIndex}
                    className="min-w-0 overflow-x-auto"
                  >
                    <CalculationBox
                      value={calculation}
                      order={calculationIndex + 1}
                    />
                  </div>
                )
              )}
            </div>
          )}

          {hasText(result) && (
            <div
              className="
                mt-4
                flex
                min-w-0
                items-start
                gap-2
                rounded-xl
                border
                border-emerald-100
                bg-emerald-50
                px-4
                py-3
              "
            >
              <CheckCircle2
                size={17}
                className="
                  mt-1.5
                  shrink-0
                  text-emerald-600
                "
              />

              <MathText
                block
                className="
                  min-w-0
                  font-black
                  leading-8
                  text-emerald-950
                "
              >
                {result}
              </MathText>
            </div>
          )}
        </div>
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

  if (!src) return null;

  const title =
    graph?.title ||
    graph?.label ||
    graph?.name ||
    "وثيقة التمرين";

  const alt =
    graph?.alt ||
    graph?.description ||
    title;

  return (
    <figure
      className={cn(
        "mx-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        compact ? "max-w-4xl" : "max-w-5xl"
      )}
    >
      {hasText(title) && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <h4 className="text-center text-sm font-black text-slate-900 sm:text-base">
            {title}
          </h4>
        </div>
      )}

      <div className="flex w-full items-center justify-center bg-white p-2 min-[360px]:p-3 sm:p-4">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn(
            "block h-auto max-h-[78vh] w-auto max-w-full object-contain",
            compact ? "rounded-lg" : "rounded-xl"
          )}
          onError={(event) => {
            // On garde l'élément visible pour faciliter le diagnostic
            // si le fichier n'existe pas dans public/.
            event.currentTarget.dataset.loadError = "true";
          }}
        />
      </div>

      {hasText(graph?.caption) && (
        <figcaption className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <MathText
            block
            className="text-center text-sm font-semibold text-slate-600"
          >
            {graph.caption}
          </MathText>
        </figcaption>
      )}
    </figure>
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
    Boolean(table?.directions)
  );
}

function SmartMathTable({ table }) {
  if (!table) return null;
  return isVariationTable(table)
    ? <VariationTable table={table?.variation_table || table} />
    : <DataTable table={table} />;
}


function normalizeVariationDirection(value) {
  const normalized = String(value ?? "").trim().toLowerCase();

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

  return normalized.includes("تناقص") || normalized.includes("down")
    ? "down"
    : "up";
}

function cleanVariationLabel(value) {
  return String(value ?? "")
    .replace(/^\\\(|\\\)$/g, "")
    .trim();
}

function normalizeVariationTable(table) {
  // Nouveau format simple utilisé dans les fichiers JSON générés :
  // rows: [{ label: "x", cells: [...] }, { label: "f'(x)", ... }, ...]
  if (Array.isArray(table?.rows)) {
    const rowList = table.rows.map((row) => asObject(row));
    const findRow = (matcher) =>
      rowList.find((row) => matcher(String(row?.label ?? "").replace(/\\/g, "")));

    const xRow = findRow((label) => /^x$/i.test(label.trim()));
    const derivativeRow = findRow((label) =>
      /f\s*['’′]?\s*\(x\)|مشتق/i.test(label)
    );
    const functionRow = findRow((label) =>
      /f\s*\(x\)|الدالة/i.test(label) &&
      !/['’′]/.test(label)
    );

    const rawXCells = asArray(xRow?.cells).map((value) => String(value ?? "").trim());
    const rawDerivativeCells = asArray(derivativeRow?.cells).map((value) => String(value ?? "").trim());
    const rawFunctionCells = asArray(functionRow?.cells).map((value) => String(value ?? "").trim());

    const xValues = rawXCells.filter(hasText);
    const safeXValues = xValues.length >= 2 ? xValues : ["-\\infty", "+\\infty"];
    const intervalCount = Math.max(safeXValues.length - 1, 1);

    // Dans ce format, la flèche se trouve généralement entre les deux valeurs
    // de f(x). On conserve aussi les valeurs de début et de fin.
    const arrows = rawFunctionCells.filter((cell) => ["↗", "↘"].includes(cell));
    const functionValues = rawFunctionCells.filter(
      (cell) => hasText(cell) && !["↗", "↘"].includes(cell)
    );
    const derivativeSigns = rawDerivativeCells.filter((cell) =>
      ["+", "-", "0", "+\\infty", "-\\infty"].includes(cell)
    );

    const branches = Array.from({ length: intervalCount }, (_, index) => ({
      id: `branch-${index}`,
      startX: safeXValues[index] ?? "",
      endX: safeXValues[index + 1] ?? "",
      startValue: functionValues[index] ?? "",
      endValue: functionValues[index + 1] ?? "",
      direction: normalizeVariationDirection(arrows[index] || "up"),
    }));

    return {
      title: table?.title || "جدول تغيرات الدالة",
      functionName: functionRow?.label || table?.function_name || "f",
      derivativeName: derivativeRow?.label || table?.derivative_name || "f'(x)",
      domain: table?.domain || table?.interval || "",
      xValues: safeXValues,
      signs: Array.from(
        { length: branches.length },
        (_, index) => derivativeSigns[index] ?? ""
      ),
      branches,
      discontinuities: asArray(table?.discontinuities),
      notes: normalizeStringList(table?.notes),
    };
  }

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
    derivative?.interval_signs ||
      derivative?.signs ||
      derivative?.values ||
      table?.derivative_signs ||
      table?.signs
  );

  const explicitBranches = asArray(fn?.branches)
    .map((branch, index) => ({
      id: String(branch?.id ?? `branch-${index}`),
      startX: String(branch?.start_x ?? branch?.startX ?? xValues[index] ?? ""),
      endX: String(branch?.end_x ?? branch?.endX ?? xValues[index + 1] ?? ""),
      startValue: String(
        branch?.start_value ?? branch?.startValue ?? ""
      ),
      endValue: String(
        branch?.end_value ?? branch?.endValue ?? ""
      ),
      direction: normalizeVariationDirection(branch?.direction),
    }))
    .filter(
      (branch) =>
        hasText(branch.startX) &&
        hasText(branch.endX)
    );

  const fallbackDirections = normalizeStringList(
    fn?.directions ||
      table?.directions ||
      table?.variation_directions
  ).map(normalizeVariationDirection);

  const fallbackValues = normalizeStringList(
    fn?.values ||
      table?.function_values ||
      table?.values ||
      table?.limits
  );

  const safeXValues =
    xValues.length >= 2
      ? xValues
      : ["-\\infty", "+\\infty"];

  const intervalCount = Math.max(safeXValues.length - 1, 1);

  const fallbackBranches = Array.from(
    { length: intervalCount },
    (_, index) => ({
      id: `branch-${index}`,
      startX: safeXValues[index] ?? "",
      endX: safeXValues[index + 1] ?? "",
      startValue: fallbackValues[index] ?? "",
      endValue: fallbackValues[index + 1] ?? "",
      direction: fallbackDirections[index] ?? "up",
    })
  );

  const branches =
    explicitBranches.length > 0
      ? explicitBranches
      : fallbackBranches;

  return {
    title: table?.title || "جدول تغيرات الدالة",
    functionName: table?.function_name || table?.functionName || "f",
    derivativeName: table?.derivative_name || "f'(x)",
    domain: table?.domain || table?.interval || "",
    xValues: safeXValues,
    signs: Array.from(
      { length: branches.length },
      (_, index) => signs[index] ?? ""
    ),
    branches,
    discontinuities: asArray(table?.discontinuities),
    notes: normalizeStringList(table?.notes),
  };
}

function VariationArrow({
  direction = "up",
  startLabel = "",
  endLabel = "",
  id,
}) {
  const normalizedDirection = normalizeVariationDirection(direction);
  const isUp = normalizedDirection === "up";
  const yStart = isUp ? 78 : 22;
  const yEnd = isUp ? 22 : 78;
  const markerId = `variation-arrow-${String(id).replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div
      dir="ltr"
      className="relative h-36 min-w-[250px]"
      style={{ direction: "ltr", unicodeBidi: "isolate" }}
    >
      {hasText(startLabel) && (
        <div
          className={cn(
            "absolute left-4 z-10 rounded bg-white/95 px-1 text-sm font-black text-slate-950",
            isUp ? "bottom-2" : "top-2"
          )}
        >
          <MathLTR>{startLabel}</MathLTR>
        </div>
      )}

      {hasText(endLabel) && (
        <div
          className={cn(
            "absolute right-4 z-10 rounded bg-white/95 px-1 text-sm font-black text-slate-950",
            isUp ? "top-2" : "bottom-2"
          )}
        >
          <MathLTR>{endLabel}</MathLTR>
        </div>
      )}

      <svg
        viewBox="0 0 300 110"
        preserveAspectRatio="none"
        className="absolute inset-x-5 top-5 h-[105px] w-[calc(100%-2.5rem)] overflow-visible text-blue-800"
        aria-hidden="true"
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="9"
            markerHeight="9"
            refX="8"
            refY="4.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L9,4.5 L0,9 Z" fill="currentColor" />
          </marker>
        </defs>

        <line
          x1="18"
          y1={yStart}
          x2="282"
          y2={yEnd}
          stroke="currentColor"
          strokeWidth="3.5"
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
      className="relative grid min-h-24"
      style={{
        gridTemplateColumns: `repeat(${intervalCount}, minmax(260px, 1fr))`,
      }}
    >
      {Array.from({ length: intervalCount }, (_, index) => (
        <div
          key={`header-interval-${index}`}
          className={cn(
            "relative border-l border-slate-400 first:border-l-0",
            index > 0 &&
              isDiscontinuityPoint(discontinuities, index) &&
              "border-l-[5px] border-double border-slate-900"
          )}
        >
          {index === 0 && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <MathLTR className="text-base font-black">
                {xValues[0]}
              </MathLTR>
            </div>
          )}

          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2",
              index === intervalCount - 1
                ? "right-4"
                : "right-0 translate-x-1/2"
            )}
          >
            <MathLTR className="text-base font-black">
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
  className = "",
}) {
  return (
    <div
      className={cn(
        "relative min-w-0",
        separated
          ? "border-l-[5px] border-double border-slate-900"
          : "border-l border-slate-400 first:border-l-0",
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
  const minWidth = Math.max(760, 135 + intervalCount * 320);

  return (
    <figure
      dir="ltr"
      className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border-2 border-slate-800 bg-white shadow-sm"
      style={{ direction: "ltr", unicodeBidi: "isolate" }}
    >
      <figcaption
        dir="rtl"
        className="border-b-2 border-slate-800 bg-slate-50 px-4 py-3 text-center text-base font-black text-slate-950"
      >
        {data.title || "جدول تغيرات الدالة"}
      </figcaption>

      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <div
            className="grid border-b-2 border-slate-800"
            style={{
              gridTemplateColumns: "135px minmax(0, 1fr)",
            }}
          >
            <VariationLabelCell value="x" />

            <VariationIntervalsHeader
              xValues={data.xValues}
              discontinuities={data.discontinuities}
            />
          </div>

          <div
            className="grid border-b-2 border-slate-800"
            style={{
              gridTemplateColumns: `135px repeat(${intervalCount}, minmax(260px, 1fr))`,
            }}
          >
            <VariationLabelCell value={data.derivativeName || "f'(x)"} />

            {data.branches.map((branch, index) => (
              <VariationIntervalCell
                key={`sign-${branch.id || index}`}
                separated={
                  index > 0 &&
                  isDiscontinuityPoint(data.discontinuities, index)
                }
              >
                <div className="flex min-h-24 items-center justify-center px-4 text-xl font-black">
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

          <div
            className="grid"
            style={{
              gridTemplateColumns: `135px repeat(${intervalCount}, minmax(320px, 1fr))`,
            }}
          >
            <VariationLabelCell value={data.functionName || "f(x)"} />

            {data.branches.map((branch, index) => (
              <VariationIntervalCell
                key={`branch-${branch.id || index}`}
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
    </figure>
  );
}

function VariationLabelCell({ value }) {
  return (
    <div className="flex min-h-20 items-center justify-center border-r-2 border-slate-800 bg-slate-100 px-3 font-black text-slate-950">
      <MathLTR className="text-lg">{value}</MathLTR>
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