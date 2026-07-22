import { useContext, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Eye,
  EyeOff,
  GraduationCap,
  Hash,
  Lightbulb,
  Loader2,
  RefreshCcw,
  Sparkles,
  Trophy,
} from "lucide-react";

import { UserContext } from "../Utils/UserContext";
import { MathJax } from "better-react-mathjax";



const API_KNOWLEDGE_URL = import.meta.env.VITE_KNOWLEDGE_URL;


// const SIMPLE_EXPLANATION_URL =
//   "http://127.0.0.1:8000/api/knowledge/bac-exercises/solve/";
const SIMPLE_EXPLANATION_URL = `${API_KNOWLEDGE_URL}bac-exercises/solve/`;

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(String(value || ""));
}


function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isNonEmptyObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function normalizeObject(value) {
  return isNonEmptyObject(value) ? value : {};
}

function getQuestionDisplayText(question) {
  if (!question) return "";

  if (question.is_standalone && hasText(question.standalone_text)) {
    return question.standalone_text;
  }

  if (hasText(question.displayed_text)) {
    return question.displayed_text;
  }

  return question.text || "";
}


function getStandaloneSupportLines(value) {
  const supports = normalizeArray(value);
  const lines = [];

  supports.forEach((item) => {
    if (typeof item === "string") {
      if (item.trim()) lines.push(item.trim());
      return;
    }

    if (!item || typeof item !== "object") return;

    normalizeArray(item.preliminary_results_to_prove).forEach((result) => {
      if (hasText(result)) lines.push(result.trim());
    });

    normalizeArray(item.previous_results).forEach((result) => {
      if (hasText(result)) lines.push(result.trim());
    });

    if (
      hasText(item.content) &&
      !lines.includes(item.content.trim())
    ) {
      lines.push(item.content.trim());
    }

    if (
      hasText(item.text) &&
      !lines.includes(item.text.trim())
    ) {
      lines.push(item.text.trim());
    }
  });

  return [...new Set(lines)];
}

function getOriginalQuestionText(question) {
  if (!question) return "";

  if (hasText(question.original_text)) {
    return question.original_text.trim();
  }

  if (hasText(question.text)) {
    return question.text.trim();
  }

  return "";
}

function getStoredSimpleSolution(solution) {
  const simple = solution?.simple_solution;

  if (typeof simple === "string") {
    return { explanation: simple };
  }

  return normalizeObject(simple);
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function toDisplayString(value) {
  if (value === null || value === undefined) return "";

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  if (typeof value === "object") {
    return String(
      value.text ??
      value.content ??
      value.title ??
      value.description ??
      value.explanation ??
      value.result ??
      value.answer ??
      value.value ??
      ""
    );
  }

  return String(value);
}

/*
 * محرك موحد لتنظيف وعرض العربية وLaTeX.
 * لا يرسل أي نص عربي إلى MathJax، ويصلح أشهر أخطاء JSON/AI.
 */
function decodeBrokenText(value) {
  let text = toDisplayString(value);
  if (!text) return "";

  for (let pass = 0; pass < 3; pass += 1) {
    const previous = text;
    text = text
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16)),
      )
      .replace(/&#(\d+);?/g, (_, code) =>
        String.fromCodePoint(Number(code)),
      )
      .replace(/&#x([0-9a-fA-F]+);?/gi, (_, code) =>
        String.fromCodePoint(parseInt(code, 16)),
      )
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'");

    if (text === previous) break;
  }

  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\\r\\n/g, "\n")
    // نحول \\n المكتوبة حرفيًا إلى سطر فقط عندما لا تكون بداية أمر مثل \\neq.
    .replace(/\\n(?=\s|[0-9\u0600-\u06FF([{]|$)/g, "\n")
    .replace(/\\t(?=\s|[0-9\u0600-\u06FF([{]|$)/g, " ")
    .replace(/\u000c\s*rac/gi, "\\frac")
    .replace(/\u0009\s*imes/gi, "\\times")
    .replace(/\u0008\s*egin/gi, "\\begin")
    .replace(/\u0007\s*lpha/gi, "\\alpha")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\u2028|\u2029/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function balanceMathBraces(value) {
  const text = String(value || "");
  let result = "";
  let depth = 0;
  let escaped = false;

  for (const character of text) {
    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      result += character;
      escaped = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      result += character;
      continue;
    }

    if (character === "}") {
      if (depth > 0) {
        depth -= 1;
        result += character;
      }
      continue;
    }

    result += character;
  }

  return result + "}".repeat(depth);
}

function repairLatexCommands(value) {
  let text = decodeBrokenText(value);
  if (!text) return "";

  for (let pass = 0; pass < 5; pass += 1) {
    const previous = text;
    text = text
      .replace(/\\\\+(?=[()[\]{}$])/g, "\\")
      .replace(/\\\\+(?=[A-Za-z])/g, "\\");
    if (text === previous) break;
  }

  text = text
    // تحويل النص العربي الموجود داخل أوامر LaTeX إلى سطر عربي مستقل.
    .replace(/\\q?quad\s*\\(?:text|mathrm|operatorname)\s*\{([^{}]*[\u0600-\u06FF][^{}]*)\}\s*\\q?quad/gi, "\n$1\n")
    .replace(/\\(?:text|mathrm|operatorname)\s*\{([^{}]*[\u0600-\u06FF][^{}]*)\}/g, "\n$1\n")
    .replace(/\\boxed\s*\{([^{}]*[\u0600-\u06FF][^{}]*)\}/g, "\n$1\n")
    // أوامر وصلت بحروف مفصولة أو بلا backslash.
    .replace(/\\?f\s*rac\b/gi, "\\frac")
    .replace(/\\?s\s*qrt\b/gi, "\\sqrt")
    .replace(/\\?s\s*um\b/gi, "\\sum")
    .replace(/\\?p\s*rod\b/gi, "\\prod")
    .replace(/\\?n\s*eq\b/gi, "\\neq")
    .replace(/\\?g\s*eq\b/gi, "\\geq")
    .replace(/\\?l\s*eq\b/gi, "\\leq")
    .replace(/(^|[^A-Za-z\\])frac(?=\s*(?:\{|[-+]?\d|[A-Za-z]))/g, "$1\\frac")
    .replace(/(^|[^A-Za-z\\])sqrt(?=\s*(?:\[|\{|[-+]?\d|[A-Za-z]))/g, "$1\\sqrt")
    .replace(/(^|[^A-Za-z\\])sum(?=\s*(?:_|\^|\{))/g, "$1\\sum")
    .replace(/(^|[^A-Za-z\\])prod(?=\s*(?:_|\^|\{))/g, "$1\\prod")
    .replace(/(^|[^A-Za-z\\])times(?=$|[^A-Za-z])/g, "$1\\times")
    .replace(/(^|[^A-Za-z\\])cdot(?=$|[^A-Za-z])/g, "$1\\cdot")
    .replace(/(^|[^A-Za-z\\])Rightarrow(?=$|[^A-Za-z])/g, "$1\\Rightarrow")
    .replace(/(^|[^A-Za-z\\])Leftrightarrow(?=$|[^A-Za-z])/g, "$1\\Leftrightarrow")
    // متغيرات عادية وصلت مسبوقة بشرطة مائلة.
    .replace(/\\([A-Za-z])(?=_(?:\{|[A-Za-z0-9]))/g, "$1")
    .replace(/\\([A-Z])(?=\s*[=\[])/g, "$1")
    // الكسور المختصرة.
    .replace(/\\frac\s*([-+]?\d+)\s*([-+]?\d+)/g, "\\frac{$1}{$2}")
    .replace(/\\frac\s*([-+]?\d+)\s*\{([^{}]+)\}/g, "\\frac{$1}{$2}")
    .replace(/\\frac\s*\{([^{}]+)\}\s*([-+]?\d+)/g, "\\frac{$1}{$2}")
    // العلاقات والرموز.
    .replace(/≤/g, "\\leq ")
    .replace(/≥/g, "\\geq ")
    .replace(/≠/g, "\\neq ")
    .replace(/∞/g, "\\infty ")
    .replace(/→/g, "\\to ")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/−/g, "-")
    // منع خطأ Missing delimiter.
    .replace(/\\left\s*/g, "")
    .replace(/\\right\s*/g, "")
    .replace(/\\(?:left|right)(?=$|\s)/g, "")
    .replace(/\bnoinfty\b/gi, "n\\to\\infty")
    .replace(/\boinfty\b/gi, "\\to\\infty")
    .replace(/\blim\s*_?\s*n\s*(?:→|\\to)?\s*\+?\s*(?:∞|\\infty)/gi, "\\lim_{n\\to+\\infty}")
    // أوامر المسافة لا يجب أن تظهر كنص.
    .replace(/\\q?quad\b/g, " ")
    .replace(/\bq?quad\s*[,،]?/gi, " ")
    // تنظيف الأقواس الزائدة حول النص العربي.
    .replace(/\{+\s*([^{}]*[\u0600-\u06FF][^{}]*)\s*\}+/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return text;
}

function stripOuterMathDelimiter(value) {
  const text = String(value || "").trim();
  if (text.startsWith("\\[") && text.endsWith("\\]")) {
    return text.slice(2, -2).trim();
  }
  if (text.startsWith("\\(") && text.endsWith("\\)")) {
    return text.slice(2, -2).trim();
  }
  if (text.startsWith("$$") && text.endsWith("$$")) {
    return text.slice(2, -2).trim();
  }
  if (text.startsWith("$") && text.endsWith("$")) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function normalizeMathFormula(value) {
  let text = repairLatexCommands(value);
  text = stripOuterMathDelimiter(text)
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/^\$+|\$+$/g, "")
    .replace(/\$+/g, "")
    .trim();

  // لا نسمح للعربية بالدخول إلى MathJax.
  if (containsArabic(text)) return "";
  return balanceMathBraces(text);
}

function repairMathDelimiters(value) {
  let text = repairLatexCommands(value);
  if (!text) return "";

  // توحيد delimiters المكررة.
  text = text
    .replace(/\\\\+\(/g, "\\(")
    .replace(/\\\\+\)/g, "\\)")
    .replace(/\\\\+\[/g, "\\[")
    .replace(/\\\\+\]/g, "\\]")
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, body) => `\\[${body.trim()}\\]`)
    .replace(/\$([^$\n]+?)\$/g, (_, body) => `\\(${body.trim()}\\)`);

  // إخراج النص العربي من أوامر LaTeX حتى لا يُرسل إلى MathJax.
  for (let pass = 0; pass < 6; pass += 1) {
    const previous = text;
    text = text
      .replace(/\\q?quad\s*\\(?:text|mathrm|operatorname)\s*\{([^{}]*[\u0600-\u06FF][^{}]*)\}\s*\\q?quad/g, " $1 ")
      .replace(/\\(?:text|mathrm|operatorname)\s*\{([^{}]*[\u0600-\u06FF][^{}]*)\}/g, " $1 ")
      .replace(/\\boxed\s*\{([^{}]*[\u0600-\u06FF][^{}]*)\}/g, " $1 ")
      .replace(/\\q?quad\b/g, " ");
    if (text === previous) break;
  }

  // إزالة علامات الدولار المفردة المتبقية حتى لا تظهر كنص.
  text = text
    .replace(/\$(?=\s|$)|(?<=\s)\$/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([،؛:,.!?؟])/g, "$1")
    .trim();

  return text;
}

function looksLikeMathFragment(value) {
  const text = String(value || "").trim();
  if (!text || containsArabic(text)) return false;

  const compact = text.replace(/\s+/g, "");
  if (!compact) return false;

  return (
    /\\(?:frac|dfrac|tfrac|sqrt|sum|prod|lim|infty|cdot|times|div|leq?|geq?|neq|to|Rightarrow|Leftrightarrow|mathbb|forall|exists|boxed)\b/.test(text) ||
    /[A-Za-z](?:_\{?[^}\s]+\}?|\^\{?[^}\s]+\}?)/.test(text) ||
    /[A-Za-z0-9})\]]\s*(?:=|<|>|\\leq|\\geq|\\neq)\s*[A-Za-z0-9({\\+-]/.test(text) ||
    /^[A-Za-z](?:'|_\{?[^}\s]+\}?)?\s*=/.test(text) ||
    /^[-+]?\d+(?:[.,]\d+)?$/.test(compact)
  );
}

function splitBareMathFromText(value) {
  const text = String(value || "");
  const segments = [];
  let plain = "";
  let index = 0;

  const flushPlain = () => {
    if (plain) {
      segments.push({ type: "text", value: plain });
      plain = "";
    }
  };

  while (index < text.length) {
    const startCharacter = text[index] || "";
    const startsMath =
      startCharacter === "\\" ||
      /[A-Za-z0-9]/.test(startCharacter) ||
      (["(", "[", "+", "-"].includes(startCharacter) &&
        /[A-Za-z0-9\\]/.test(text[index + 1] || ""));

    if (!startsMath || containsArabic(startCharacter)) {
      plain += startCharacter;
      index += 1;
      continue;
    }

    const start = index;
    let braceDepth = 0;
    let parenthesisDepth = 0;
    let bracketDepth = 0;

    while (index < text.length) {
      const current = text[index];
      const next = text[index + 1] || "";

      if (containsArabic(current) || ["،", "؛", "؟", "\n"].includes(current)) {
        break;
      }

      const allowed =
        /[A-Za-z0-9_{}^=+\-*/().,\[\]|<>!'\\]/.test(current) ||
        /\s/.test(current);

      if (!allowed) break;
      if (current === "\\" && !/[A-Za-z()[\]]/.test(next)) break;

      if (current === "{") braceDepth += 1;
      if (current === "}") braceDepth = Math.max(0, braceDepth - 1);
      if (current === "(") parenthesisDepth += 1;
      if (current === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      if (current === "[") bracketDepth += 1;
      if (current === "]") bracketDepth = Math.max(0, bracketDepth - 1);

      if (
        [".", ":", "!"].includes(current) &&
        braceDepth === 0 &&
        parenthesisDepth === 0 &&
        bracketDepth === 0 &&
        !/\d/.test(next)
      ) {
        break;
      }

      index += 1;
    }

    let candidate = text.slice(start, index);
    const trailing = candidate.match(/\s+$/)?.[0] || "";
    candidate = candidate.slice(0, candidate.length - trailing.length);

    if (looksLikeMathFragment(candidate)) {
      flushPlain();
      segments.push({ type: "math", value: candidate });
      plain += trailing;
    } else {
      plain += candidate + trailing;
    }

    if (index === start) {
      plain += text[index];
      index += 1;
    }
  }

  flushPlain();
  return segments;
}

function splitExplicitMath(value) {
  const text = repairMathDelimiters(value);
  const pattern = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...splitBareMathFromText(text.slice(lastIndex, match.index)));
    }

    const inner = stripOuterMathDelimiter(match[0]);
    if (containsArabic(inner)) {
      // إذا وضع الـAI جملة عربية كاملة داخل delimiters، نفصلها بدل إرسالها إلى MathJax.
      segments.push(...splitBareMathFromText(inner));
    } else if (inner.trim()) {
      segments.push({ type: "math", value: inner });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(...splitBareMathFromText(text.slice(lastIndex)));
  }

  return segments.length ? segments : [{ type: "text", value: text }];
}

function cleanPlainTextSegment(value) {
  return String(value || "")
    .replace(/\\+[()[\]]/g, "")
    .replace(/\\+([A-Za-z])(?=_(?:\{|[A-Za-z0-9]))/g, "$1")
    .replace(/\\+(?=[{}])/g, "")
    .replace(/\\(?:text|mathrm|operatorname|boxed)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\q?quad\b|\bq?quad\b/gi, " ")
    .replace(/\{+\s*([^{}]*[\u0600-\u06FF][^{}]*)\s*\}+/g, "$1")
    .replace(/\$(?=\s|$)|(?<=\s)\$/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function shouldUseDisplayMath(value) {
  const repaired = repairMathDelimiters(value).trim();
  if (!repaired || containsArabic(repaired)) return false;

  const formula = normalizeMathFormula(repaired);
  return Boolean(formula && looksLikeMathFragment(formula));
}

function normalizeMathText(value, display = false) {
  const formula = normalizeMathFormula(value);
  if (!formula) return "";
  return display ? `\\[${formula}\\]` : `\\(${formula}\\)`;
}

function splitRenderableLines(value) {
  const repaired = repairMathDelimiters(value);
  if (!repaired.trim()) return [];

  return repaired
    .replace(/\s*\\q?quad\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function InlineMathSegments({ value, dir = "rtl" }) {
  const segments = splitExplicitMath(value);

  return (
    <span
      dir={dir}
      className="inline whitespace-pre-wrap break-words"
      style={{
        direction: dir,
        unicodeBidi: "isolate",
        textAlign: dir === "rtl" ? "right" : "left",
      }}
    >
      {segments.map((segment, index) => {
        if (segment.type === "math") {
          const formula = normalizeMathFormula(segment.value);
          if (!formula) {
            return (
              <span key={`fallback-${index}`}>
                {cleanPlainTextSegment(segment.value)}
              </span>
            );
          }

          return (
            <bdi
              key={`math-${index}`}
              dir="ltr"
              className="mx-1 inline-block max-w-full align-middle"
              style={{ direction: "ltr", unicodeBidi: "isolate" }}
            >
              <MathJax dynamic hideUntilTypeset="first">
                <span dir="ltr">{`\\(${formula}\\)`}</span>
              </MathJax>
            </bdi>
          );
        }

        const plain = cleanPlainTextSegment(segment.value);
        if (!plain) return null;

        return (
          <span
            key={`text-${index}`}
            dir={dir}
            style={{ direction: dir, unicodeBidi: "isolate" }}
          >
            {plain}
          </span>
        );
      })}
    </span>
  );
}

function MathTextParser({
  text,
  className = "",
  display = false,
  dir = "rtl",
  as: Component,
}) {
  const lines = splitRenderableLines(text);
  if (!lines.length) return null;

  const Tag = Component || (lines.length > 1 ? "div" : "span");

  return (
    <Tag
      dir={dir}
      className={cn(
        lines.length > 1 ? "block space-y-2" : "whitespace-pre-wrap break-words",
        className,
      )}
      style={{
        direction: dir,
        textAlign: dir === "rtl" ? "right" : "left",
        unicodeBidi: "isolate",
        letterSpacing: "normal",
        wordSpacing: "normal",
      }}
    >
      {lines.map((line, lineIndex) => {
        const formulaOnly = shouldUseDisplayMath(line);

        if (formulaOnly || (display && !containsArabic(line))) {
          const formula = normalizeMathFormula(line);
          if (!formula) return null;

          return (
            <div
              key={`display-${lineIndex}`}
              dir="ltr"
              className="w-full overflow-x-auto py-1 text-center"
              style={{ direction: "ltr", unicodeBidi: "isolate" }}
            >
              <MathJax dynamic hideUntilTypeset="first">
                <span dir="ltr">{`\\[${formula}\\]`}</span>
              </MathJax>
            </div>
          );
        }

        return (
          <div
            key={`line-${lineIndex}`}
            dir={dir}
            className="min-w-0 whitespace-pre-wrap break-words"
            style={{ direction: dir, unicodeBidi: "plaintext" }}
          >
            <InlineMathSegments value={line} dir={dir} />
          </div>
        );
      })}
    </Tag>
  );
}

function getErrorMessage(error) {
  if (error?.response?.status === 401) {
    return "انتهت صلاحية تسجيل الدخول. سجّل الدخول من جديد.";
  }

  if (error?.response?.status === 404) {
    return "لم يتم العثور على هذا التمرين.";
  }

  if (error?.response?.status >= 500) {
    return "حدث خطأ في الخادم أثناء إنشاء الشرح المبسط.";
  }

  if (error?.code === "ERR_NETWORK") {
    return "تعذر الاتصال بالخادم. تأكد من تشغيل Django.";
  }

  return (
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    "حدث خطأ أثناء إنشاء الشرح المبسط."
  );
}

function parseAIResponse(value) {
  if (!value) return null;

  if (typeof value === "object") {
    if (value.answer && typeof value.answer === "object") {
      return value.answer;
    }

    if (value.data && typeof value.data === "object") {
      return value.data;
    }

    return value;
  }

  if (typeof value !== "string") return null;

  const cleanText = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleanText);
  } catch {
    const start = cleanText.indexOf("{");
    const end = cleanText.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleanText.slice(start, end + 1));
      } catch {
        return {
          detailed_explanation: cleanText,
        };
      }
    }

    return {
      detailed_explanation: cleanText,
    };
  }
}

export default function BacExercisesList({ data }) {
  const { token } = useContext(UserContext);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleStoredSolutions, setVisibleStoredSolutions] = useState({});
  const [simpleExplanations, setSimpleExplanations] = useState({});
  const [visibleSimpleExplanations, setVisibleSimpleExplanations] = useState({});
  const [loadingQuestionId, setLoadingQuestionId] = useState(null);
  const [errors, setErrors] = useState({});

  /*
   * data correspond directement à response.data :
   *
   * {
   *   axis: {...},
   *   count: 8,
   *   filters: {...},
   *   questions: [...]
   * }
   */
  const axis = data?.axis || null;

  const questions = useMemo(() => {
    return Array.isArray(data?.questions) ? data.questions : [];
  }, [data]);

  const currentQuestion = questions[currentIndex] || null;

  const currentGraphData = normalizeObject(
    currentQuestion?.graph_data,
  );

  const hasCurrentGraph = isNonEmptyObject(
    currentGraphData,
  );

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;

  const goToPrevious = () => {
    setCurrentIndex((previous) => Math.max(previous - 1, 0));
  };

  const goToNext = () => {
    setCurrentIndex((previous) =>
      Math.min(previous + 1, questions.length - 1)
    );
  };

  const questionKey =
    currentQuestion?.id || currentQuestion?.code || currentIndex;

  const storedSolution = normalizeObject(currentQuestion?.solution);
  const hasStoredSolution = isNonEmptyObject(storedSolution);

  const isStoredSolutionVisible =
    Boolean(visibleStoredSolutions[questionKey]);

  const simpleExplanation = simpleExplanations[questionKey] || null;

  const isSimpleExplanationVisible =
    Boolean(visibleSimpleExplanations[questionKey]);

  const isLoading = loadingQuestionId === questionKey;

  const currentError = errors[questionKey] || "";

  const toggleStoredSolution = () => {
    setVisibleStoredSolutions((previous) => ({
      ...previous,
      [questionKey]: !previous[questionKey],
    }));
  };

  const toggleSimpleExplanation = () => {
    setVisibleSimpleExplanations((previous) => ({
      ...previous,
      [questionKey]: !previous[questionKey],
    }));
  };

  const setQuestionError = (message) => {
    setErrors((previous) => ({
      ...previous,
      [questionKey]: message,
    }));
  };

  const clearQuestionError = () => {
    setErrors((previous) => {
      const next = { ...previous };
      delete next[questionKey];
      return next;
    });
  };

  const handleSimpleExplanation = async (forceRegenerate = false) => {
    if (!currentQuestion) return;

    if (!forceRegenerate && simpleExplanation) {
      toggleSimpleExplanation();
      return;
    }

    if (!token) {
      setQuestionError("يجب تسجيل الدخول للحصول على شرح مبسط.");
      return;
    }

    try {
      setLoadingQuestionId(questionKey);
      clearQuestionError();

      const response = await axios.post(
        SIMPLE_EXPLANATION_URL,
        {
          question_id: currentQuestion.id,
          exercise_id: currentQuestion.code,
          axis_id: axis?.id,
          mode: "simplified_explanation",
          explanation_style: "very_simple",
          language: "ar",
          question: {
            code: currentQuestion.code,
            text: currentQuestion.text,
            displayed_text: getQuestionDisplayText(currentQuestion),
            standalone_text: currentQuestion.standalone_text,
            context: currentQuestion.context,
            standalone_support:
              currentQuestion.standalone_support || {},
            original_text: currentQuestion.original_text,
            is_standalone: currentQuestion.is_standalone,
            year: currentQuestion.year,
            number: currentQuestion.number,
            skill: currentQuestion.skill,
            difficulty: currentQuestion.difficulty,
            graph_data: currentQuestion.graph_data || {},
            question_graph_data:
              currentQuestion.graph_data || {},
            solution_graph_data:
              storedSolution.graph_data || {},
          },
          stored_solution: storedSolution,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 120000,
        }
      );

      const parsed = parseAIResponse(response.data);

      if (!parsed) {
        setQuestionError("تعذر قراءة الشرح المبسط من الخادم.");
        return;
      }

      setSimpleExplanations((previous) => ({
        ...previous,
        [questionKey]: parsed,
      }));

      setVisibleSimpleExplanations((previous) => ({
        ...previous,
        [questionKey]: true,
      }));
    } catch (error) {
      console.error("Simple explanation error:", error);
      setQuestionError(getErrorMessage(error));
    } finally {
      setLoadingQuestionId(null);
    }
  };

  if (!data || questions.length === 0) {
    return (
      <EmptyState
        title="لا توجد تمارين"
        description="لا توجد تمارين بكالوريا مضافة إلى هذا المحور حالياً."
      />
    );
  }

  return (
    <section
      dir="rtl"
      className="min-h-full bg-gradient-to-b from-slate-50 via-blue-50/30 to-slate-50 px-4 py-6 sm:px-6"
    >
      <div className="mx-auto max-w-5xl">
        <ExercisesHeader
          axis={axis}
          currentIndex={currentIndex}
          total={questions.length}
        />

        <article className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_20px_70px_-38px_rgba(15,23,42,0.4)]">
          <ExerciseNavigation
            currentIndex={currentIndex}
            total={questions.length}
            isFirst={isFirst}
            isLast={isLast}
            onPrevious={goToPrevious}
            onNext={goToNext}
          />

          <div className="p-4 sm:p-6 lg:p-7">
            <ExerciseQuestion question={currentQuestion} />

            {hasCurrentGraph && (
              <SequenceGraphRenderer
                graphData={currentGraphData}
                eyebrow="الرسم المعطى"
                title="الرسم الموجود في نص التمرين"
                description="هذا الرسم جزء من معطيات التمرين، لذلك يظهر قبل فتح الحل."
              />
            )}

            {currentError && (
              <ErrorMessage
                message={currentError}
                loading={isLoading}
                onRetry={() => handleSimpleExplanation(true)}
              />
            )}

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <StoredSolutionButton
                hasSolution={hasStoredSolution}
                visible={isStoredSolutionVisible}
                onClick={toggleStoredSolution}
              />

              <SimpleExplanationButton
                loading={isLoading}
                hasExplanation={Boolean(simpleExplanation)}
                visible={isSimpleExplanationVisible}
                onClick={() => handleSimpleExplanation(false)}
              />
            </div>

            {hasStoredSolution && isStoredSolutionVisible && (
              <StoredSolution
                key={`stored-${questionKey}`}
                solution={storedSolution}
              />
            )}

            {simpleExplanation && isSimpleExplanationVisible && (
              <SimpleExplanation
                key={`simple-${questionKey}`}
                explanation={simpleExplanation}
                loading={isLoading}
                onRegenerate={() => handleSimpleExplanation(true)}
              />
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function ExercisesHeader({ axis, currentIndex, total }) {
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  return (
    <header className="mb-5 overflow-hidden rounded-[30px] border border-blue-100 bg-white shadow-sm">
      <div className="bg-gradient-to-l from-blue-600 via-indigo-600 to-violet-600 px-5 py-7 text-white sm:px-7">
        <div className="flex items-start gap-4">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-white/15 p-3 backdrop-blur">
            <GraduationCap size={29} />
          </div>

          <div className="min-w-0">
            <p className="mb-1 text-sm font-bold text-blue-100">
              تمارين بكالوريا محلولة
            </p>

            <h1 className="text-2xl font-black leading-9 sm:text-3xl">
              تعلم طريقة الحل خطوة بخطوة
            </h1>

            {axis?.title && (
              <div className="mt-2 text-sm font-bold leading-7 text-blue-100">
                <MathTextParser text={axis.title} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 sm:px-7">
        <div className="mb-2 flex items-center justify-between text-sm font-extrabold">
          <span className="text-slate-700">
            التمرين {currentIndex + 1} من {total}
          </span>

          <span className="text-blue-700">{Math.round(progress)}%</span>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-l from-blue-600 to-violet-600 transition-all duration-500"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>
    </header>
  );
}

function ExerciseNavigation({
  currentIndex,
  total,
  isFirst,
  isLast,
  onPrevious,
  onNext,
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-6">
      <NavigationButton
        onClick={onPrevious}
        disabled={isFirst}
        icon={<ChevronRight size={18} />}
      >
        السابق
      </NavigationButton>

      <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm">
        {currentIndex + 1} / {total}
      </div>

      <NavigationButton
        onClick={onNext}
        disabled={isLast}
        iconPosition="left"
        icon={<ChevronLeft size={18} />}
      >
        التالي
      </NavigationButton>
    </div>
  );
}

function NavigationButton({
  children,
  icon,
  iconPosition = "right",
  ...props
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
      {...props}
    >
      {iconPosition === "right" && icon}
      {children}
      {iconPosition === "left" && icon}
    </button>
  );
}


function splitQuestionBlocks(value) {
  let text = repairMathDelimiters(value).trim();
  if (!text) return [];

  // فصل المعطيات، العلاقات، ثم المطالب المرقمة بطريقة مستقرة.
  text = text
    .replace(/\s+(?=(?:\(?\d{1,2}\)?|[أبجدهـوزحطيكلمنسعفصقرشتثخذضظغ])\s*[\)）.\-]\s+)/g, "\n")
    .replace(/\s+(?=(?:استنتج|أثبت|بيّن|بين|احسب|ادرس|تحقق|برهن|أوجد|حدد)\s+)/g, "\n")
    .replace(/\s*(\\\[[\s\S]*?\\\])\s*/g, "\n$1\n")
    .replace(/\n{3,}/g, "\n\n");

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^((?:\(?\d{1,2}\)?|[أبجدهـوزحطيكلمنسعفصقرشتثخذضظغ])\s*[\)）.\-])\s*(.*)$/);
      return {
        id: index,
        marker: match?.[1] || "",
        content: match?.[2] || line,
        formulaOnly: shouldUseDisplayMath(match?.[2] || line),
      };
    });
}

function StructuredQuestionText({ value }) {
  const blocks = splitQuestionBlocks(value);
  if (!blocks.length) return null;

  return (
    <div
      dir="rtl"
      className="divide-y divide-blue-100"
      style={{ direction: "rtl", unicodeBidi: "isolate" }}
    >
      {blocks.map((block, index) => {
        if (block.marker) {
          return (
            <div
              key={block.id}
              className="flex min-w-0 items-start gap-3 py-4 first:pt-0 last:pb-0"
            >
              <span className="mt-1 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 px-2 text-sm font-black text-white">
                {block.marker.replace(/[\)）.\-]/g, "")}
              </span>

              <div className="min-w-0 flex-1 text-right text-[17px] font-bold leading-10 text-slate-900">
                <MathTextParser
                  text={block.content}
                  display={block.formulaOnly}
                />
              </div>
            </div>
          );
        }

        if (block.formulaOnly) {
          return (
            <div
              key={block.id}
              className="w-full overflow-x-auto py-4 text-center first:pt-0 last:pb-0"
            >
              <MathTextParser text={block.content} display />
            </div>
          );
        }

        return (
          <div
            key={block.id}
            className="min-w-0 py-4 text-right text-[17px] font-semibold leading-10 text-slate-900 first:pt-0 last:pb-0"
          >
            <MathTextParser text={block.content} />
          </div>
        );
      })}
    </div>
  );
}

function ExerciseQuestion({ question }) {
  const questionText = getQuestionDisplayText(question);

  return (
    <div>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <BookOpen size={24} />
        </div>

        <div className="min-w-0">
          <p className="mb-1 text-xs font-extrabold text-blue-600">
            تمرين بكالوريا
          </p>

          <div className="text-xl font-black leading-9 text-slate-900">
            <MathTextParser
              text={
                question?.title ||
                question?.skill ||
                question?.exercise ||
                "دراسة اتجاه تغير متتالية"
              }
            />
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {question?.year && (
          <MetaBadge icon={<Calendar size={14} />} variant="blue">
            بكالوريا {question.year}
          </MetaBadge>
        )}

        {question?.number && (
          <MetaBadge icon={<Hash size={14} />} variant="violet">
            السؤال {question.number}
          </MetaBadge>
        )}

        {question?.skill && (
          <MetaBadge icon={<Award size={14} />} variant="amber">
            {question.skill}
          </MetaBadge>
        )}

        {question?.difficulty && (
          <MetaBadge icon={<Trophy size={14} />} variant="green">
            {translateDifficulty(question.difficulty)}
          </MetaBadge>
        )}

      </div>

      <div className="border-t border-blue-100 pt-5">
        <div className="mb-4 flex items-center gap-2 text-blue-800">
          <BookOpen size={19} />
          <p className="font-black">نص التمرين</p>
        </div>

        <StructuredQuestionText value={questionText} />
      </div>
    </div>
  );
}

function translateDifficulty(value) {
  const labels = {
    easy: "سهل",
    medium: "متوسط",
    hard: "صعب",
  };

  return labels[value] || value;
}

function MetaBadge({ icon, variant = "blue", children }) {
  const variants = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    violet: "border-violet-100 bg-violet-50 text-violet-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold ${
        variants[variant] || variants.blue
      }`}
    >
      {icon}
      {children}
    </span>
  );
}


function getGraphReactData(graphData) {
  const normalizedGraph = normalizeObject(graphData);
  const reactData = normalizeObject(normalizedGraph.react_data);

  if (isNonEmptyObject(reactData)) {
    return reactData;
  }

  const viewport = normalizeObject(normalizedGraph.viewport);
  const directSeries = normalizeArray(normalizedGraph.series);

  return {
    schema_version: "fallback",
    graph_type: normalizedGraph.graph_type || "cartesian",
    coordinate_system: "cartesian",
    axes: {
      x: {
        label: "x",
        min: Number.isFinite(Number(viewport.xMin))
          ? Number(viewport.xMin)
          : 0,
        max: Number.isFinite(Number(viewport.xMax))
          ? Number(viewport.xMax)
          : 10,
      },
      y: {
        label: "y",
        min: Number.isFinite(Number(viewport.yMin))
          ? Number(viewport.yMin)
          : 0,
        max: Number.isFinite(Number(viewport.yMax))
          ? Number(viewport.yMax)
          : 10,
      },
    },
    series: directSeries,
    annotations: normalizeArray(normalizedGraph.annotations),
  };
}

function normalizeGraphPoint(point) {
  if (!point || typeof point !== "object") return null;

  const x = Number(point.x);
  const y = Number(point.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    ...point,
    x,
    y,
  };
}

function getSeriesPoints(series) {
  return normalizeArray(series?.data)
    .map(normalizeGraphPoint)
    .filter(Boolean);
}

function getAxisRange(axis, fallbackMin, fallbackMax) {
  const min = Number(axis?.min);
  const max = Number(axis?.max);

  if (
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    max > min
  ) {
    return { min, max };
  }

  return {
    min: fallbackMin,
    max: fallbackMax,
  };
}

function getGraphBounds(reactData) {
  const allPoints = normalizeArray(reactData?.series)
    .flatMap(getSeriesPoints);

  const annotationPoints = normalizeArray(
    reactData?.annotations,
  )
    .map(normalizeGraphPoint)
    .filter(Boolean);

  const points = [...allPoints, ...annotationPoints];

  const calculatedX = points.map((point) => point.x);
  const calculatedY = points.map((point) => point.y);

  const fallbackXMin = calculatedX.length
    ? Math.min(...calculatedX)
    : 0;
  const fallbackXMax = calculatedX.length
    ? Math.max(...calculatedX)
    : 10;
  const fallbackYMin = calculatedY.length
    ? Math.min(...calculatedY)
    : 0;
  const fallbackYMax = calculatedY.length
    ? Math.max(...calculatedY)
    : 10;

  const xRange = getAxisRange(
    reactData?.axes?.x,
    fallbackXMin,
    fallbackXMax === fallbackXMin
      ? fallbackXMin + 1
      : fallbackXMax,
  );

  const yRange = getAxisRange(
    reactData?.axes?.y,
    fallbackYMin,
    fallbackYMax === fallbackYMin
      ? fallbackYMin + 1
      : fallbackYMax,
  );

  return {
    xMin: xRange.min,
    xMax: xRange.max,
    yMin: yRange.min,
    yMax: yRange.max,
  };
}

function createTicks(min, max, preferredTicks) {
  const validTicks = normalizeArray(preferredTicks)
    .map(Number)
    .filter(Number.isFinite);

  if (validTicks.length > 0) {
    return validTicks;
  }

  const count = 6;
  const step = (max - min) / count;

  return Array.from(
    { length: count + 1 },
    (_, index) => min + step * index,
  );
}

function formatGraphNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "";

  if (Math.abs(number) >= 1000) {
    return number.toExponential(1);
  }

  const rounded = Math.round(number * 100) / 100;
  return String(rounded);
}

function getSeriesStroke(index) {
  const strokes = [
    "#2563eb",
    "#7c3aed",
    "#059669",
    "#dc2626",
    "#d97706",
    "#0891b2",
    "#4f46e5",
  ];

  return strokes[index % strokes.length];
}

function SequenceGraphRenderer({
  graphData,
  eyebrow = "التمثيل البياني",
  title = "الرسم المرتبط بالتمرين",
  description = "",
  variant = "question",
}) {
  const reactData = useMemo(
    () => getGraphReactData(graphData),
    [graphData],
  );

  const series = normalizeArray(reactData.series).filter(
    (item) =>
      item &&
      typeof item === "object" &&
      (
        getSeriesPoints(item).length > 0 ||
        Number.isFinite(Number(item.y))
      ),
  );

  if (series.length === 0) {
    return null;
  }

  const bounds = getGraphBounds(reactData);

  const width = 900;
  const height = 560;
  const padding = {
    top: 36,
    right: 54,
    bottom: 72,
    left: 78,
  };

  const plotWidth =
    width - padding.left - padding.right;
  const plotHeight =
    height - padding.top - padding.bottom;

  const xScale = (value) =>
    padding.left +
    ((Number(value) - bounds.xMin) /
      (bounds.xMax - bounds.xMin)) *
      plotWidth;

  const yScale = (value) =>
    padding.top +
    (1 -
      (Number(value) - bounds.yMin) /
        (bounds.yMax - bounds.yMin)) *
      plotHeight;

  const xTicks = createTicks(
    bounds.xMin,
    bounds.xMax,
    reactData?.axes?.x?.ticks,
  );

  const yTicks = createTicks(
    bounds.yMin,
    bounds.yMax,
    reactData?.axes?.y?.ticks,
  );

  const xAxisY =
    bounds.yMin <= 0 && bounds.yMax >= 0
      ? yScale(0)
      : yScale(bounds.yMin);

  const yAxisX =
    bounds.xMin <= 0 && bounds.xMax >= 0
      ? xScale(0)
      : xScale(bounds.xMin);

  const annotations = normalizeArray(
    reactData.annotations,
  );

  const isSolutionGraph = variant === "solution";

  return (
    <section
      className={cn(
        "mt-7 overflow-hidden rounded-[28px] bg-white shadow-[0_18px_55px_-35px_rgba(79,70,229,0.45)]",
        isSolutionGraph
          ? "border border-emerald-200"
          : "border border-indigo-100"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6",
          isSolutionGraph
            ? "border-emerald-100 bg-gradient-to-l from-emerald-50 via-teal-50 to-white"
            : "border-indigo-100 bg-gradient-to-l from-indigo-50 via-blue-50 to-white"
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-black",
              isSolutionGraph
                ? "text-emerald-700"
                : "text-indigo-600"
            )}
          >
            {eyebrow}
          </p>

          <h3 className="mt-1 text-lg font-black text-slate-900">
            {title}
          </h3>

          {description && (
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              {description}
            </p>
          )}
        </div>

        <span
          className={cn(
            "rounded-full border bg-white px-3 py-1.5 text-xs font-black",
            isSolutionGraph
              ? "border-emerald-200 text-emerald-700"
              : "border-indigo-200 text-indigo-700"
          )}
        >
          {reactData.graph_type === "cobweb"
            ? "مخطط السلم"
            : "معلم متعامد"}
        </span>
      </div>

      <div className="overflow-x-auto p-3 sm:p-5">
        <div className="min-w-[680px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label="التمثيل البياني للمتتالية"
          >
            <rect
              x={padding.left}
              y={padding.top}
              width={plotWidth}
              height={plotHeight}
              rx="16"
              fill="#ffffff"
              stroke="#dbeafe"
              strokeWidth="2"
            />

            {xTicks.map((tick, index) => {
              const x = xScale(tick);

              return (
                <g key={`x-grid-${index}`}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + plotHeight}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={padding.top + plotHeight + 28}
                    textAnchor="middle"
                    fontSize="15"
                    fontWeight="700"
                    fill="#475569"
                  >
                    {formatGraphNumber(tick)}
                  </text>
                </g>
              );
            })}

            {yTicks.map((tick, index) => {
              const y = yScale(tick);

              return (
                <g key={`y-grid-${index}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + plotWidth}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 14}
                    y={y + 5}
                    textAnchor="end"
                    fontSize="15"
                    fontWeight="700"
                    fill="#475569"
                  >
                    {formatGraphNumber(tick)}
                  </text>
                </g>
              );
            })}

            <line
              x1={padding.left}
              y1={xAxisY}
              x2={padding.left + plotWidth}
              y2={xAxisY}
              stroke="#0f172a"
              strokeWidth="2.2"
            />

            <line
              x1={yAxisX}
              y1={padding.top}
              x2={yAxisX}
              y2={padding.top + plotHeight}
              stroke="#0f172a"
              strokeWidth="2.2"
            />

            <text
              x={padding.left + plotWidth + 24}
              y={xAxisY + 6}
              textAnchor="middle"
              fontSize="18"
              fontWeight="900"
              fill="#0f172a"
            >
              {reactData?.axes?.x?.label || "x"}
            </text>

            <text
              x={yAxisX - 10}
              y={padding.top - 14}
              textAnchor="middle"
              fontSize="18"
              fontWeight="900"
              fill="#0f172a"
            >
              {reactData?.axes?.y?.label || "y"}
            </text>

            {series.map((item, seriesIndex) => {
              const points = getSeriesPoints(item);
              const stroke =
                item.color || getSeriesStroke(seriesIndex);
              const type = String(item.type || "line")
                .trim()
                .toLowerCase();

              if (
                type === "horizontal_line" &&
                Number.isFinite(Number(item.y))
              ) {
                const y = yScale(Number(item.y));

                return (
                  <line
                    key={item.id || `series-${seriesIndex}`}
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + plotWidth}
                    y2={y}
                    stroke={stroke}
                    strokeWidth="3"
                    strokeDasharray="10 7"
                  />
                );
              }

              if (type === "scatter") {
                return (
                  <g key={item.id || `series-${seriesIndex}`}>
                    {points.map((point, pointIndex) => (
                      <g key={`${point.x}-${point.y}-${pointIndex}`}>
                        <circle
                          cx={xScale(point.x)}
                          cy={yScale(point.y)}
                          r="6"
                          fill={stroke}
                          stroke="#ffffff"
                          strokeWidth="2.5"
                        />

                        {(point.label ||
                          item.show_numeric_value) && (
                          <text
                            x={xScale(point.x)}
                            y={yScale(point.y) - 12}
                            textAnchor="middle"
                            fontSize="13"
                            fontWeight="800"
                            fill={stroke}
                          >
                            {point.label ||
                              formatGraphNumber(
                                point.value ?? point.y,
                              )}
                          </text>
                        )}
                      </g>
                    ))}
                  </g>
                );
              }

              const pointString = points
                .map(
                  (point) =>
                    `${xScale(point.x)},${yScale(point.y)}`,
                )
                .join(" ");

              if (!pointString) return null;

              return (
                <polyline
                  key={item.id || `series-${seriesIndex}`}
                  points={pointString}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={
                    type === "polyline" ? "3.5" : "3"
                  }
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={
                    item.dashed ? "10 7" : undefined
                  }
                />
              );
            })}

            {annotations.map((annotation, index) => {
              const point = normalizeGraphPoint(annotation);

              if (!point) return null;

              return (
                <g key={annotation.id || `annotation-${index}`}>
                  <circle
                    cx={xScale(point.x)}
                    cy={yScale(point.y)}
                    r="7"
                    fill="#dc2626"
                    stroke="#ffffff"
                    strokeWidth="3"
                  />

                  {annotation.label && (
                    <text
                      x={xScale(point.x) + 10}
                      y={yScale(point.y) - 12}
                      textAnchor="start"
                      fontSize="14"
                      fontWeight="900"
                      fill="#991b1b"
                    >
                      {annotation.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <GraphLegend series={series} />
    </section>
  );
}

function GraphLegend({ series }) {
  const visibleItems = normalizeArray(series).filter(
    (item) => hasText(item?.label),
  );

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
      {visibleItems.map((item, index) => (
        <div
          key={item.id || index}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700"
        >
          <span
            className="h-2.5 w-6 rounded-full"
            style={{
              backgroundColor:
                item.color || getSeriesStroke(index),
            }}
          />
          <MathTextParser text={item.label} />
        </div>
      ))}
    </div>
  );
}


function StoredSolutionButton({
  hasSolution,
  visible,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!hasSolution}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {visible ? <EyeOff size={21} /> : <Eye size={21} />}

      {!hasSolution
        ? "لا يوجد حل محفوظ"
        : visible
          ? "إخفاء الحل المفصل"
          : "عرض الحل المفصل"}
    </button>
  );
}

function SimpleExplanationButton({
  loading,
  hasExplanation,
  visible,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-blue-600 to-violet-600 px-5 py-3.5 font-black text-white shadow-sm transition hover:from-blue-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <>
          <Loader2 size={21} className="animate-spin" />
          جاري إعداد شرح أبسط...
        </>
      ) : hasExplanation ? (
        <>
          {visible ? <EyeOff size={21} /> : <Eye size={21} />}
          {visible ? "إخفاء الشرح المبسط" : "عرض الشرح المبسط"}
        </>
      ) : (
        <>
          <Sparkles size={21} />
          لم أفهم، اشرح لي بطريقة أبسط
        </>
      )}
    </button>
  );
}


function StoredSolution({ solution }) {
  const normalizedSolution = normalizeObject(solution);
  const simpleSolution = getStoredSimpleSolution(normalizedSolution);

  /*
   * في JSON الجديد:
   *
   * - الرسم المعطى في نص التمرين:
   *   question.graph_data
   *
   * - الرسم الذي يتم إنشاؤه أو شرحه داخل الحل:
   *   question.solution.graph_data
   *
   * لا نستعمل fallback من رسم السؤال هنا حتى لا يظهر رسم داخل الحل
   * إلا عندما يكون موجودًا فعلًا داخل solution.graph_data.
   */
  const solutionGraphData = normalizeObject(
    normalizedSolution.graph_data
  );

  const hasSolutionGraph = isNonEmptyObject(
    solutionGraphData
  );

  const simpleSteps = normalizeArray(
    simpleSolution.steps || simpleSolution.solution_steps
  );
  const rootSteps = normalizeArray(normalizedSolution.steps);

  /*
   * في البنية الجديدة توجد الخطوات نفسها داخل:
   * solution.steps
   * solution.simple_solution.steps
   *
   * لذلك نعرض نسخة واحدة فقط حتى لا يتكرر الحل مرتين.
   */
  const displayedSteps =
    simpleSteps.length > 0 ? simpleSteps : rootSteps;

  const intro =
    simpleSolution.intro ||
    simpleSolution.explanation ||
    normalizedSolution.student_friendly_intro ||
    normalizedSolution.detailed_explanation;

  const strategy =
    normalizedSolution.main_idea ||
    normalizedSolution.strategy ||
    normalizedSolution.why_this_method ||
    normalizedSolution.method_name ||
    simpleSolution.method;

  const whatWeKnow = normalizeArray(normalizedSolution.what_we_know).filter(
    (item) => hasText(toDisplayString(item))
  );

  const mistakes = normalizeArray(normalizedSolution.common_mistakes);
  const hints = normalizeArray(normalizedSolution.hints);
  const bacWriting = normalizeArray(normalizedSolution.bac_writing);
  const understandingCheck = normalizeArray(
    normalizedSolution.understanding_check
  );

  const finalAnswer =
    normalizedSolution.final_answer ||
    simpleSolution.final_answer ||
    simpleSolution.answer;

  return (
    <div className="mt-7 overflow-hidden rounded-[32px] border border-emerald-200 bg-white shadow-[0_18px_60px_-30px_rgba(15,118,110,0.45)]">
      <div className="relative overflow-hidden bg-gradient-to-l from-emerald-700 via-teal-700 to-cyan-700 px-5 py-6 text-white sm:px-7">
        <div className="absolute -left-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 right-0 h-44 w-44 rounded-full bg-cyan-300/15 blur-2xl" />

        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-inner backdrop-blur">
            <CheckCircle2 size={29} />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-extrabold tracking-wide text-emerald-100">
              الحل المعتمد في المنصة
            </p>

            <h2 className="mt-1 text-xl font-black sm:text-2xl">
              {normalizedSolution.title ||
                "نفهم الفكرة ثم نحل خطوة بخطوة"}
            </h2>

            <p className="mt-2 text-sm font-semibold leading-7 text-emerald-50/90">
              لا نستعمل أي نتيجة قبل إثباتها، وكل خطوة تحتوي على شرح وحساب ونتيجة.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 bg-gradient-to-b from-emerald-50/45 via-white to-white p-4 sm:p-6 lg:p-7">
        {intro && (
          <SolutionSection
            title="قبل أن نبدأ"
            description="نقرأ الفكرة بهدوء قبل الدخول في الحساب."
            icon={<Sparkles size={20} />}
            variant="violet"
          >
            <MathTextParser
              text={intro}
              className="text-base font-semibold leading-9 text-slate-800"
            />
          </SolutionSection>
        )}

        {strategy && (
          <SolutionSection
            title={normalizedSolution.method_name || "خطة الحل"}
            description="هذه هي الطريق التي سنتبعها من البداية إلى النهاية."
            icon={<Brain size={20} />}
            variant="blue"
          >
            <MathTextParser
              text={strategy}
              className="text-base font-semibold leading-9 text-slate-800"
            />
          </SolutionSection>
        )}

        {normalizeArray(normalizedSolution.before_start).length > 0 && (
          <ListSolutionSection
            title="قبل بدء الحل"
            items={normalizeArray(normalizedSolution.before_start)}
            icon={<Lightbulb size={20} />}
            variant="amber"
          />
        )}

        {whatWeKnow.length > 0 && (
          <ListSolutionSection
            title="المعطيات التي سنستعملها"
            items={whatWeKnow}
            icon={<BookOpen size={20} />}
            variant="blue"
          />
        )}

        {normalizedSolution.what_we_need_to_show && (
          <SolutionSection
            title="المطلوب"
            description="نحدد الهدف حتى لا نضيع أثناء الحل."
            icon={<CircleHelp size={20} />}
            variant="amber"
          >
            <MathTextParser
              text={normalizedSolution.what_we_need_to_show}
              className="text-base font-semibold leading-9 text-slate-800"
            />
          </SolutionSection>
        )}

        {hasSolutionGraph && (
          <SequenceGraphRenderer
            graphData={solutionGraphData}
            eyebrow="الرسم في الحل"
            title="إنشاء الرسم وقراءة النتيجة"
            description="هذا الرسم تابع للحل، ويظهر فقط بعد فتح الحل المفصل."
            variant="solution"
          />
        )}

        {displayedSteps.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                  <Brain size={21} />
                </div>

                <div>
                  <p className="font-black text-emerald-950">
                    مراحل الحل
                  </p>
                  <p className="mt-0.5 text-sm font-semibold leading-6 text-emerald-700">
                    اقرأ الشرح، ثم تابع الحساب، وبعده احفظ النتيجة.
                  </p>
                </div>
              </div>

              <span className="hidden rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-700 sm:inline-flex">
                {displayedSteps.length} خطوات
              </span>
            </div>

            <div className="relative space-y-4 before:absolute before:bottom-5 before:right-[25px] before:top-5 before:w-0.5 before:bg-emerald-100 sm:before:right-[29px]">
              {displayedSteps.map((step, index) => (
                <StoredSolutionStep
                  key={`${step?.order || index}-${step?.title || "step"}`}
                  step={step}
                  index={index}
                />
              ))}
            </div>
          </section>
        )}

        {finalAnswer && (
          <div className="overflow-hidden rounded-[26px] border border-emerald-200 bg-emerald-50 shadow-sm">
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-600 px-5 py-4 text-white">
              <Award size={22} />
              <div>
                <p className="text-xs font-bold text-emerald-100">
                  النتيجة النهائية
                </p>
                <h3 className="font-black">
                  هذا هو الجواب الذي نصل إليه
                </h3>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <MathBox text={finalAnswer} variant="green" />
            </div>
          </div>
        )}

        {normalizedSolution.verification && (
          <SolutionSection
            title="كيف نتأكد أن الحل صحيح؟"
            icon={<CheckCircle2 size={20} />}
            variant="green"
          >
            <MathTextParser
              text={normalizedSolution.verification}
              className="font-semibold leading-9 text-slate-800"
            />
          </SolutionSection>
        )}

        {bacWriting.length > 0 && (
          <ListSolutionSection
            title="الكتابة المنظمة في ورقة البكالوريا"
            items={bacWriting}
            icon={<GraduationCap size={20} />}
            variant="blue"
          />
        )}

        {mistakes.length > 0 && (
          <SolutionSection
            title="انتبه إلى هذه الأخطاء"
            icon={<AlertTriangle size={20} />}
            variant="red"
          >
            <div className="space-y-3">
              {mistakes.map((item, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-2xl border border-red-100 bg-white"
                >
                  <div className="border-b border-red-100 bg-red-50 px-4 py-3">
                    <p className="font-black text-red-800">
                      الخطأ {index + 1}
                    </p>
                  </div>

                  <div className="space-y-3 p-4">
                    <MathTextParser
                      text={item?.mistake || toDisplayString(item)}
                      className="font-semibold leading-8 text-red-950"
                    />

                    {item?.correction && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                        <p className="mb-1 text-xs font-black text-emerald-700">
                          التصحيح
                        </p>
                        <MathTextParser
                          text={item.correction}
                          className="font-semibold leading-8 text-emerald-950"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SolutionSection>
        )}


        {understandingCheck.length > 0 && (
          <ListSolutionSection
            title="اختبر فهمك بسرعة"
            items={understandingCheck}
            icon={<CircleHelp size={20} />}
            variant="amber"
          />
        )}
      </div>
    </div>
  );
}


function SimpleStoredSolution({ solution }) {
  const steps = normalizeArray(
    solution.steps || solution.solution_steps
  );

  const intro =
    solution.intro ||
    solution.explanation ||
    solution.detailed_explanation;

  const finalAnswer =
    solution.final_answer ||
    solution.answer ||
    solution.final_math;

  return (
    <SolutionSection
      title={solution.title || "الحل البسيط والمشروح"}
      description={
        solution.method
          ? `الطريقة المستعملة: ${solution.method}`
          : "نقرأ الفكرة، ثم نشرح كل خطوة، ثم ننجز الحساب."
      }
      icon={<Sparkles size={20} />}
      variant="violet"
    >
      <div className="space-y-4">
        {intro && (
          <MathTextParser
            text={intro}
            className="font-semibold leading-8 text-slate-800"
          />
        )}

        {steps.length > 0 && (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <StoredSolutionStep
                key={`simple-${index}`}
                step={step}
                index={index}
                compact
              />
            ))}
          </div>
        )}

        {finalAnswer && (
          <MathBox text={finalAnswer} variant="green" />
        )}
      </div>
    </SolutionSection>
  );
}

function ListSolutionSection({
  title,
  items,
  icon,
  variant = "blue",
}) {
  return (
    <SolutionSection
      title={title}
      icon={icon}
      variant={variant}
    >
      <div className="space-y-3">
        {normalizeArray(items).map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
          >
            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-slate-700 shadow-sm">
              {index + 1}
            </span>

            <MathTextParser
              text={toDisplayString(item)}
              className="font-semibold leading-8 text-slate-800"
            />
          </div>
        ))}
      </div>
    </SolutionSection>
  );
}


function normalizeCalculationLines(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeCalculationLines(item))
      .filter(Boolean)
      .join("\n");
  }

  if (typeof value === "object") {
    const directValue =
      value.math ??
      value.calculation ??
      value.formula ??
      value.expression ??
      value.equation ??
      value.text ??
      value.content ??
      value.value ??
      value.result ??
      "";

    return normalizeCalculationLines(directValue);
  }

  return String(value).trim();
}

function StoredSolutionStep({ step, index, compact = false }) {
  const normalizedStep =
    typeof step === "string" ? { explanation: step } : step || {};

  const number =
    normalizedStep.order ||
    normalizedStep.number ||
    normalizedStep.step_number ||
    index + 1;

  const explanation =
    normalizedStep.explanation ||
    normalizedStep.teacher_explanation ||
    normalizedStep.description ||
    normalizedStep.instruction;

  const why =
    normalizedStep.why ||
    normalizedStep.goal ||
    normalizedStep.rule_used;

  /*
   * calculation_lines في JSON الجديد عبارة عن قائمة:
   *
   * [
   *   "نص عربي",
   *   "\\[",
   *   "u_{n+1}=...",
   *   "\\]"
   * ]
   *
   * الكود القديم كان يقرأ فقط:
   * calculation_lines?.[0]?.math
   *
   * لذلك كانت الحسابات لا تظهر. هنا نجمع كل الأسطر
   * ونرسلها كاملة إلى MathBox.
   */
  const calculation = normalizeCalculationLines(
    normalizedStep.calculation_lines ??
    normalizedStep.calculation ??
    normalizedStep.math ??
    normalizedStep.formula ??
    normalizedStep.equation
  );

  const result =
    normalizedStep.result ||
    normalizedStep.conclusion ||
    normalizedStep.answer ||
    normalizedStep.final_answer;

  return (
    <article className="relative pr-14 sm:pr-16">
      <div className="absolute right-0 top-4 z-10 flex h-[52px] w-[52px] items-center justify-center rounded-2xl border-4 border-white bg-emerald-600 text-lg font-black text-white shadow-md sm:h-[60px] sm:w-[60px]">
        {number}
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md",
          compact ? "p-3" : "p-4 sm:p-5"
        )}
      >
        <div className="mb-4 border-b border-slate-100 pb-4">
          <p className="text-xs font-black text-emerald-600">
            الخطوة {number}
          </p>

          <div className="mt-1 text-lg font-black leading-8 text-slate-950">
            <MathTextParser
              text={normalizedStep.title || `الخطوة ${number}`}
            />
          </div>
        </div>

        {explanation && (
          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-blue-700">
              <BookOpen size={16} />
              <p className="text-xs font-black">
                ماذا نفعل في هذه الخطوة؟
              </p>
            </div>

            <MathTextParser
              text={explanation}
              className="font-semibold leading-9 text-blue-950"
            />
          </div>
        )}

        {why && (
          <div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-violet-700">
              <Lightbulb size={16} />
              <p className="text-xs font-black">
                لماذا نفعل ذلك؟
              </p>
            </div>

            <MathTextParser
              text={why}
              className="font-semibold leading-9 text-violet-950"
            />
          </div>
        )}

        {calculation && (
          <div className="mb-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-black text-slate-600">
              <Hash size={15} />
              الحساب
            </p>
            <MathBox text={calculation} />
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-emerald-700">
              <CheckCircle2 size={17} />
              <p className="text-sm font-black">
                ماذا نستنتج؟
              </p>
            </div>

            <MathTextParser
              text={result}
              className="font-bold leading-9 text-emerald-950"
            />
          </div>
        )}
      </div>
    </article>
  );
}


function HintsSection({ hints }) {
  const [visibleCount, setVisibleCount] = useState(0);

  const revealNext = () => {
    setVisibleCount((previous) =>
      Math.min(previous + 1, hints.length)
    );
  };

  return (
    <SolutionSection
      title="تلميحات"
      description="استعملها فقط إذا توقفت."
      icon={<Lightbulb size={20} />}
      variant="amber"
    >
      <div className="space-y-3">
        {hints.slice(0, visibleCount).map((hint, index) => (
          <div
            key={index}
            className="rounded-2xl border border-amber-100 bg-amber-50 p-4"
          >
            <p className="mb-1 font-black text-amber-800">
              التلميح {index + 1}
            </p>

            <MathTextParser
              text={
                typeof hint === "string"
                  ? hint
                  : hint?.hint ||
                    hint?.text ||
                    hint?.content ||
                    toDisplayString(hint)
              }
              className="font-semibold leading-8 text-amber-950"
            />
          </div>
        ))}

        {visibleCount < hints.length && (
          <button
            type="button"
            onClick={revealNext}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-amber-600"
          >
            <Lightbulb size={17} />
            {visibleCount === 0
              ? "أظهر أول تلميح"
              : "أظهر التلميح التالي"}
          </button>
        )}
      </div>
    </SolutionSection>
  );
}

function SimpleExplanation({
  explanation,
  loading,
  onRegenerate,
}) {
  const normalizedExplanation = isNonEmptyObject(
    explanation?.simple_solution
  )
    ? explanation.simple_solution
    : explanation;

  const steps = normalizeArray(
    normalizedExplanation?.steps ||
      normalizedExplanation?.solution_steps
  );

  return (
    <div className="mt-6 overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-sm">
      <div className="bg-gradient-to-l from-violet-700 to-blue-600 px-5 py-5 text-white sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
            <Brain size={24} />
          </div>

          <div>
            <p className="text-xs font-bold text-violet-100">
              شرح مبسط بالذكاء الاصطناعي
            </p>

            <h2 className="text-xl font-black">
              نفس الفكرة بطريقة أسهل
            </h2>
          </div>
        </div>
      </div>

      <div className="space-y-5 bg-violet-50/30 p-4 sm:p-6">
        {(normalizedExplanation?.intro ||
          normalizedExplanation?.detailed_explanation ||
          normalizedExplanation?.explanation) && (
          <SolutionSection
            title="الشرح المبسط"
            icon={<Sparkles size={20} />}
            variant="violet"
          >
            <MathTextParser
              text={
                normalizedExplanation.intro ||
                normalizedExplanation.detailed_explanation ||
                normalizedExplanation.explanation
              }
              className="font-semibold leading-8 text-slate-800"
            />
          </SolutionSection>
        )}

        {normalizedExplanation?.idea && (
          <SolutionSection
            title="الفكرة بسهولة"
            icon={<Lightbulb size={20} />}
            variant="amber"
          >
            <MathTextParser
              text={normalizedExplanation.idea}
              className="font-semibold leading-8 text-slate-800"
            />
          </SolutionSection>
        )}

        {isNonEmptyObject(
          normalizeObject(normalizedExplanation?.graph_data)
        ) && (
          <SequenceGraphRenderer
            graphData={normalizeObject(
              normalizedExplanation.graph_data
            )}
            eyebrow="الرسم التوضيحي"
            title="الرسم داخل الشرح المبسط"
            description="يساعدك هذا الرسم على فهم خطوات الحل بصريًا."
            variant="solution"
          />
        )}

        {steps.length > 0 && (
          <div className="space-y-4">
            {steps.map((step, index) => (
              <StoredSolutionStep
                key={index}
                step={{
                  order: step.order || step.number || index + 1,
                  title: step.title,
                  explanation:
                    step.explanation ||
                    step.description ||
                    step.instruction,
                  why: step.why,
                  calculation:
                    step.calculation ||
                    step.math ||
                    step.calculation_lines?.[0]?.math,
                  result:
                    step.result ||
                    step.conclusion,
                }}
                index={index}
              />
            ))}
          </div>
        )}

        {(normalizedExplanation?.final_answer ||
          normalizedExplanation?.final_math) && (
          <SolutionSection
            title="النتيجة"
            icon={<CheckCircle2 size={20} />}
            variant="green"
          >
            <MathBox
              text={
                normalizedExplanation.final_answer ||
                normalizedExplanation.final_math
              }
              variant="green"
            />
          </SolutionSection>
        )}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-extrabold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
          >
            <RefreshCcw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            توليد شرح مبسط آخر
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorMessage({
  message,
  onRetry,
  loading,
}) {
  return (
    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 shrink-0 text-red-600"
          size={21}
        />

        <div className="flex-1">
          <p className="font-extrabold text-red-800">
            تعذر إنشاء الشرح المبسط
          </p>

          <p className="mt-1 text-sm font-medium leading-7 text-red-700">
            {message}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={loading}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:opacity-60"
      >
        <RefreshCcw
          size={16}
          className={loading ? "animate-spin" : ""}
        />
        إعادة المحاولة
      </button>
    </div>
  );
}

function MathBox({
  text,
  className = "",
  variant = "default",
}) {
  const variants = {
    default: "border-slate-200 bg-slate-50 text-slate-900",
    green: "border-emerald-200 bg-white text-emerald-950",
    amber: "border-amber-200 bg-white text-amber-950",
  };

  if (!hasText(text)) return null;

  const lines = splitRenderableLines(text);
  if (!lines.length) return null;

  return (
    <div
      dir="rtl"
      className={cn(
        "overflow-hidden rounded-2xl border p-4",
        variants[variant] || variants.default,
        className,
      )}
    >
      <div className="space-y-3">
        {lines.map((line, index) => {
          const formulaOnly = shouldUseDisplayMath(line);

          return (
            <div
              key={`math-box-line-${index}`}
              className={cn(
                "min-w-0",
                formulaOnly
                  ? "overflow-x-auto rounded-xl bg-white/60 px-3 py-2 text-center"
                  : "text-right",
              )}
            >
              <MathTextParser
                text={line}
                display={formulaOnly}
                className={cn(
                  "font-semibold leading-9",
                  formulaOnly ? "text-lg" : "text-base sm:text-lg",
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SolutionSection({
  title,
  description,
  icon,
  variant = "blue",
  children,
}) {
  const variants = {
    blue: {
      wrapper: "border-blue-100",
      icon: "bg-blue-50 text-blue-700",
    },
    violet: {
      wrapper: "border-violet-100",
      icon: "bg-violet-50 text-violet-700",
    },
    amber: {
      wrapper: "border-amber-100",
      icon: "bg-amber-50 text-amber-700",
    },
    green: {
      wrapper: "border-emerald-200",
      icon: "bg-emerald-50 text-emerald-700",
    },
    red: {
      wrapper: "border-red-100",
      icon: "bg-red-50 text-red-700",
    },
  };

  const selected = variants[variant] || variants.blue;

  return (
    <section
      className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${selected.wrapper}`}
    >
      <div className="mb-4 flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${selected.icon}`}
        >
          {icon}
        </div>

        <div>
          <h3 className="font-black text-slate-900">
            {title}
          </h3>

          {description && (
            <p className="mt-0.5 text-sm font-medium leading-6 text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>

      {children}
    </section>
  );
}

function EmptyState({
  title,
  description,
}) {
  return (
    <div
      dir="rtl"
      className="mx-auto mt-10 max-w-xl rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm"
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <BookOpen size={27} />
      </div>

      <h2 className="text-xl font-black text-slate-800">
        {title}
      </h2>

      <p className="mt-2 font-medium leading-7 text-slate-500">
        {description}
      </p>
    </div>
  );
}