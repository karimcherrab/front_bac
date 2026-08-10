import { useContext, useEffect, useMemo, useState } from "react";
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



const BASE_URL = (import.meta.env.VITE_BASE_URL || "").replace(/\/+$/, "");

// يفضّل أن تكون VITE_COURSE_URL مثل:
// http://127.0.0.1:8000/api/course
const API_COURSE_URL = (
  import.meta.env.VITE_COURSE_URL ||
  (BASE_URL ? `${BASE_URL}/api/course` : "/api/course")
).replace(/\/+$/, "");


/*
 * أصل الخادم الذي تُحمَّل منه الصور/الوثائق.
 *
 * المشكلة الشائعة هنا:
 * - الـ API يعمل على http://127.0.0.1:8000
 * - React يعمل على http://localhost:5173
 * - قاعدة البيانات ترجع /media/... أو media/...
 *
 * عند تمرير /media/... مباشرة إلى <img> سيبحث المتصفح عنها في خادم React،
 * لذلك تظهر أيقونة الصورة المكسورة. هذه الدوال تحوّل المسارات النسبية إلى
 * رابط كامل على خادم Django مع الإبقاء على الروابط الكاملة كما هي.
 */
function getBackendOrigin() {
  const explicitBase = String(import.meta.env.VITE_BASE_URL || "").trim();

  if (explicitBase) {
    try {
      return new URL(explicitBase, window.location.origin).origin;
    } catch {
      // نكمل بالمصدر التالي.
    }
  }

  const courseUrl = String(import.meta.env.VITE_COURSE_URL || "").trim();

  if (courseUrl) {
    try {
      return new URL(courseUrl, window.location.origin).origin;
    } catch {
      // نكمل بالمصدر الافتراضي.
    }
  }

  return window.location.origin;
}

const BACKEND_ORIGIN = getBackendOrigin();

function getVisualSource(value) {
  if (!value) return "";

  let raw = value;

  // دعم أكثر من شكل JSON محتمل.
  if (typeof raw === "object") {
    raw =
      raw.src ??
      raw.url ??
      raw.image_url ??
      raw.image ??
      raw.file_url ??
      raw.file ??
      raw.path ??
      raw.media_url ??
      "";
  }

  let source = String(raw || "").trim();
  if (!source) return "";

  // تنظيف قيم تأتي أحيانًا من JSON أو Windows.
  source = source
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\\\/g, "/")
    .replace(/^\.\//, "");

  // روابط جاهزة لا نغيّرها.
  if (
    /^(?:https?:)?\/\//i.test(source) ||
    /^(?:data|blob):/i.test(source)
  ) {
    return source.startsWith("//") ? `${window.location.protocol}${source}` : source;
  }

  // لو كانت القيمة نفسها URL مشفّرًا.
  if (/^https?%3A%2F%2F/i.test(source)) {
    try {
      return decodeURIComponent(source);
    } catch {
      return source;
    }
  }

  // media/... أو static/... أو uploads/... إلخ.
  const normalizedPath = source.startsWith("/") ? source : `/${source}`;

  return `${BACKEND_ORIGIN}${normalizedPath}`;
}

function getVisualAlt(item, fallback = "وثيقة علمية") {
  if (!item || typeof item !== "object") return fallback;

  return (
    item.alt ||
    item.description ||
    item.caption ||
    item.title ||
    fallback
  );
}

function getSimpleSolutionUrl(questionId) {
  return `${API_COURSE_URL}/questions/${questionId}/simple-solution/`;
}

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
    // إصلاح صيغ السهم القادمة من JSON/AI مثل arrowI_2 و arrow2SO_4.
    // نطبّق الإصلاح هنا مبكرًا حتى تستفيد منه كل أماكن العرض.
    .replace(/\\?leftrightarrow\s*(?=[A-Za-z0-9_\\{(])/gi, "\\leftrightarrow ")
    .replace(/\\?(?:longrightarrow|rightarrow|arrow)\s*(?=[A-Za-z0-9_\\{(])/gi, "\\rightarrow ")
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
      .replace(/\\\\+(?=[A-Za-z])/g, "\\")
      .replace(/\\+(?=[,;! ])/g, "\\");
    if (text === previous) break;
  }

  text = text
    // تحويل النص العربي الموجود داخل أوامر LaTeX إلى سطر عربي مستقل.
    .replace(/\\q?quad\s*\\(?:text|mathrm|operatorname)\s*\{([^{}]*[\u0600-\u06FF][^{}]*)\}\s*\\q?quad/gi, "\n$1\n")
    .replace(/\\(?:text|mathrm|operatorname)\s*\{([^{}]*[\u0600-\u06FF][^{}]*)\}/g, "\n$1\n")
    .replace(/\\boxed\s*\{([^{}]*[\u0600-\u06FF][^{}]*)\}/g, "\n$1\n")
    // أوامر وصلت بحروف مفصولة أو بلا backslash.
    // إصلاح أخطاء شائعة من الـAI مثل \d\frac و dfrac بدون backslash.
    .replace(/\\d\s*\\(?=(?:d?frac|tfrac)\b)/gi, "\\")
    .replace(/\\d(?=\\(?:d?frac|tfrac)\b)/gi, "")
    .replace(/(^|[^A-Za-z\\])dfrac(?=\s*(?:\{|[-+]?\d|[A-Za-z]))/g, "$1\\dfrac")
    .replace(/(^|[^A-Za-z\\])tfrac(?=\s*(?:\{|[-+]?\d|[A-Za-z]))/g, "$1\\tfrac")
    .replace(/\\?d\s*frac\b/gi, "\\dfrac")
    .replace(/\\?t\s*frac\b/gi, "\\tfrac")
    .replace(/\\?f\s*rac\b/gi, "\\frac")
    // التصحيح النهائي بعد قاعدة frac العامة: \d\frac -> \dfrac.
    .replace(/\\d\\frac\b/g, "\\dfrac")
    .replace(/\\t\\frac\b/g, "\\tfrac")
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
    // أسهم مكتوبة كنص عادي أو ملتصقة بالصيغة التالية.
    .replace(/\\?leftrightarrow\s*(?=[A-Za-z0-9_\\{(]|$)/gi, "\\leftrightarrow ")
    .replace(/\\?(?:longrightarrow|rightarrow|arrow)\s*(?=[A-Za-z0-9_\\{(]|$)/gi, "\\rightarrow ")
    .replace(/(^|[^A-Za-z\\])Rightarrow(?=$|[^A-Za-z])/g, "$1\\Rightarrow")
    .replace(/(^|[^A-Za-z\\])Leftrightarrow(?=$|[^A-Za-z])/g, "$1\\Leftrightarrow")
    // توحيد كتابة الشحنات والأسس البسيطة مثل I^- و e-.
    .replace(/\^\s*([+-])(?=$|[\s,;،؛+)=])/g, "^{$1}")
    .replace(/(^|[^A-Za-z])([A-Za-z])([+-])(?=$|[\s,;،؛+)=])/g, "$1$2^{$3}")
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
    // حماية أخيرة قبل إرسال الصيغة إلى MathJax.
    .replace(/\\?leftrightarrow\s*(?=[A-Za-z0-9_\\{(]|$)/gi, "\\leftrightarrow ")
    .replace(/\\?(?:longrightarrow|rightarrow|arrow)\s*(?=[A-Za-z0-9_\\{(]|$)/gi, "\\rightarrow ")
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
    /\\(?:frac|dfrac|tfrac|sqrt|sum|prod|lim|infty|cdot|times|div|leq?|geq?|neq|approx|simeq|sim|pm|mp|to|rightarrow|longrightarrow|leftrightarrow|Rightarrow|Leftrightarrow|mathbb|mathrm|text|operatorname|forall|exists|boxed)\b/.test(text) ||
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
      if (current === "\\" && !/[A-Za-z()[\],;:! ]/.test(next)) break;

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
    .replace(/\\?leftrightarrow\s*(?=[A-Za-z0-9_\\{(]|$)/gi, " ↔ ")
    .replace(/\\?(?:longrightarrow|rightarrow|arrow)\s*(?=[A-Za-z0-9_\\{(]|$)/gi, " → ")
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
      className="inline max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
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
              style={{ direction: "ltr", unicodeBidi: "isolate", overflow: "visible" }}
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
              className="w-full max-w-full overflow-x-auto overscroll-x-contain py-1 text-center"
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
  const [loadedSavedSimpleSolutions, setLoadedSavedSimpleSolutions] = useState({});
  const [loadingQuestionId, setLoadingQuestionId] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setCurrentIndex(0);
    setVisibleStoredSolutions({});
    setSimpleExplanations({});
    setVisibleSimpleExplanations({});
    setLoadedSavedSimpleSolutions({});
    setLoadingQuestionId(null);
    setErrors({});
  }, [data]);

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

  // رسوم وAnimations خاصة بتمارين العلوم.
  const currentScienceVisual = normalizeObject(
    currentQuestion?.science_visual,
  );

  const hasCurrentScienceVisual = isNonEmptyObject(
    currentScienceVisual,
  );

  const currentDocuments = getQuestionDocuments(
    currentQuestion,
  );

  const hasCurrentDocuments = currentDocuments.length > 0;

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

  /*
   * عند فتح السؤال نبحث مرة واحدة عن حل AI محفوظ لهذا الطالب.
   * إذا وجدناه نظهر التصحيح والحل المبسط مباشرة بدون استدعاء AI.
   */
  useEffect(() => {
    const questionId = currentQuestion?.id;

    if (!questionId || !token) return undefined;
    if (loadedSavedSimpleSolutions[questionId]) return undefined;

    let cancelled = false;

    const loadSavedSimpleSolution = async () => {
      try {
        const response = await axios.get(
          getSimpleSolutionUrl(questionId),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: 30000,
          },
        );

        if (cancelled) return;

        const parsed = parseAIResponse(response.data);

        if (
          parsed?.success &&
          parsed?.exists &&
          isNonEmptyObject(parsed?.simple_solution)
        ) {
          setSimpleExplanations((previous) => ({
            ...previous,
            [questionId]: parsed,
          }));

          // المستخدم طلب أن يجد الحل ظاهرًا مباشرة عند الرجوع.
          setVisibleStoredSolutions((previous) => ({
            ...previous,
            [questionId]: true,
          }));

          setVisibleSimpleExplanations((previous) => ({
            ...previous,
            [questionId]: true,
          }));
        }
      } catch (error) {
        // فشل استرجاع المحفوظ لا يمنع الطالب من إنشاء حل جديد يدويًا.
        console.error("Load saved simple solution error:", error);
      } finally {
        if (!cancelled) {
          setLoadedSavedSimpleSolutions((previous) => ({
            ...previous,
            [questionId]: true,
          }));

        }
      }
    };

    loadSavedSimpleSolution();

    return () => {
      cancelled = true;
    };
  }, [
    currentQuestion?.id,
    token,
    loadedSavedSimpleSolutions,
  ]);

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
        getSimpleSolutionUrl(currentQuestion.id),
        {
          regenerate: Boolean(forceRegenerate),
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

      if (currentQuestion?.id) {
        setLoadedSavedSimpleSolutions((previous) => ({
          ...previous,
          [currentQuestion.id]: true,
        }));
      }

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
      className="
        bac-responsive-root
        min-h-full
        w-full
        min-w-0
        overflow-x-hidden
        bg-gradient-to-b
        from-slate-50
        via-blue-50/30
        to-slate-50
        px-2
        py-3
        min-[360px]:px-3
        sm:px-5
        sm:py-5
        lg:px-6
      "
    >
      <style>{`
        @keyframes solutionStepIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .bac-responsive-root,
        .bac-responsive-root * {
          box-sizing: border-box;
        }

        .bac-responsive-root img,
        .bac-responsive-root canvas,
        .bac-responsive-root video {
          max-width: 100%;
          height: auto;
        }

        .bac-responsive-root img {
          display: block;
        }

        .bac-responsive-root mjx-container {
          max-width: 100%;
        }

        /* المعادلات المضمنة لا تنشئ شريط تمرير صغيراً. */
        .bac-responsive-root mjx-container[jax="CHTML"][display="false"] {
          display: inline-block !important;
          overflow: visible !important;
          margin: 0 0.08em !important;
          vertical-align: middle;
        }

        .bac-responsive-root bdi > mjx-container {
          overflow: visible !important;
        }

        @media (max-width: 359px) {
          .bac-responsive-root button {
            touch-action: manipulation;
          }
        }
      `}</style>
      <div className="mx-auto w-full min-w-0 max-w-5xl">
        <ExercisesHeader
          axis={axis}
          currentIndex={currentIndex}
          total={questions.length}
        />

        <article className="overflow-hidden rounded-2xl sm:rounded-[32px] border border-slate-200/80 bg-white shadow-[0_20px_70px_-38px_rgba(15,23,42,0.4)]">
          <ExerciseNavigation
            currentIndex={currentIndex}
            total={questions.length}
            isFirst={isFirst}
            isLast={isLast}
            onPrevious={goToPrevious}
            onNext={goToNext}
          />

          <div className="min-w-0 p-3 min-[360px]:p-4 sm:p-6 lg:p-7">
            <ExerciseQuestion
              question={currentQuestion}
              graphData={hasCurrentGraph ? currentGraphData : {}}
              scienceVisual={hasCurrentScienceVisual ? currentScienceVisual : {}}
              documents={hasCurrentDocuments ? currentDocuments : []}
              revealGraphSolution={isStoredSolutionVisible}
            />

            <div className="mt-5 min-w-0 md:mt-6">
              <StoredSolutionButton
                hasSolution={hasStoredSolution}
                visible={isStoredSolutionVisible}
                onClick={toggleStoredSolution}
              />
            </div>

            {hasStoredSolution && isStoredSolutionVisible && (
              <StoredSolution
                key={`stored-${questionKey}`}
                solution={storedSolution}
              />
            )}

            {((hasStoredSolution && isStoredSolutionVisible) || simpleExplanation) && (
              <>
                <AIHelpCard
                  loading={isLoading}
                  hasExplanation={Boolean(simpleExplanation)}
                  visible={isSimpleExplanationVisible}
                  onClick={() => handleSimpleExplanation(false)}
                />

                {currentError && (
                  <ErrorMessage
                    message={currentError}
                    loading={isLoading}
                    onRetry={() => handleSimpleExplanation(true)}
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
              </>
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
    <header className="mb-5 overflow-hidden rounded-2xl sm:rounded-[30px] border border-blue-100 bg-white shadow-sm">
      <div className="bg-gradient-to-l from-blue-600 via-indigo-600 to-violet-600 px-4 py-5 text-white sm:px-7 sm:py-7">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 p-2.5 backdrop-blur sm:h-13 sm:w-13 sm:rounded-2xl sm:p-3">
            <GraduationCap size={29} />
          </div>

          <div className="min-w-0">
            <p className="mb-1 text-sm font-bold text-blue-100">
              تمارين بكالوريا محلولة
            </p>

            <h1 className="text-lg font-black leading-7 min-[360px]:text-xl sm:text-3xl sm:leading-9">
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

      <div className="px-4 py-4 sm:px-7">
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
    <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-2 py-2.5 min-[360px]:px-3 sm:px-6 sm:py-3">
      <NavigationButton
        onClick={onPrevious}
        disabled={isFirst}
        icon={<ChevronRight size={18} />}
      >
        السابق
      </NavigationButton>

      <div className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-2 text-xs font-black text-slate-700 shadow-sm min-[360px]:px-3 sm:px-4 sm:text-sm">
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
      className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-extrabold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 min-[360px]:gap-2 min-[360px]:px-3 sm:text-sm"
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

  /*
   * نفصل فقط عند بداية سؤال مرقّم.
   * لا نفصل قبل كلمات مثل "حدد" و"احسب" لأن ذلك كان يحول:
   * 1) حدد المتفاعل المحد
   * إلى كتلتين منفصلتين: "1)" ثم "حدد المتفاعل المحد".
   */
  text = text
    .replace(
      /[ \t]+(?=(?:\(\s*\d{1,2}\s*\)|\d{1,2}\s*[\)）.\-]|[أبجدهـوزحطيكلمنسعفصقرشتثخذضظغ]\s*[\)）.\-])\s*)/g,
      "\n",
    )
    .replace(/\s*(\\\[[\s\S]*?\\\])\s*/g, "\n$1\n")
    .replace(/\n{3,}/g, "\n\n");

  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const markerPattern =
    /^(?:\(\s*(\d{1,2})\s*\)|(\d{1,2})\s*[\)）.\-]|([أبجدهـوزحطيكلمنسعفصقرشتثخذضظغ])\s*[\)）.\-])\s*(.*)$/;

  const blocks = [];

  for (let index = 0; index < rawLines.length; index += 1) {
    const line = rawLines[index];
    const match = line.match(markerPattern);

    if (!match) {
      blocks.push({
        id: blocks.length,
        marker: "",
        content: line,
        formulaOnly: shouldUseDisplayMath(line),
      });
      continue;
    }

    const marker = match[1] || match[2] || match[3] || "";
    let content = (match[4] || "").trim();

    // معالجة البيانات القديمة التي تحتوي على رقم السؤال في سطر مستقل.
    if (!content && index + 1 < rawLines.length) {
      const nextLine = rawLines[index + 1];
      if (!markerPattern.test(nextLine)) {
        content = nextLine;
        index += 1;
      }
    }

    blocks.push({
      id: blocks.length,
      marker,
      content,
      formulaOnly: shouldUseDisplayMath(content),
    });
  }

  return blocks.filter((block) => block.marker || block.content);
}

function StructuredQuestionText({ value, graphNode = null }) {
  const blocks = splitQuestionBlocks(value);
  if (!blocks.length) return null;

  /*
   * نحافظ على مقدمة التمرين كنص عادي، ثم نجعل كل سؤال مرقّم
   * في سطر مستقل. لا توجد Cards ولا خطوط فاصلة بين الأسئلة.
   */
  return (
    <div
      dir="rtl"
      className="min-w-0 text-right"
      style={{ direction: "rtl", unicodeBidi: "isolate" }}
    >
      {blocks.map((block, blockIndex) => {
        const firstQuestionIndex = blocks.findIndex((item) => Boolean(item.marker));
        const shouldInsertGraph =
          graphNode &&
          firstQuestionIndex >= 0 &&
          blockIndex === firstQuestionIndex;

        if (block.marker) {
          return (
            <div key={`question-with-graph-${block.id}`}>
              {shouldInsertGraph && (
                <div className="my-5">{graphNode}</div>
              )}
              <div
                className="flex min-w-0 items-start gap-3 py-1.5 sm:gap-3.5 sm:py-2"
              >
                <span className="mt-[4px] flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-1.5 text-[13px] font-black text-slate-800 sm:h-8 sm:min-w-8 sm:text-sm">
                  {block.marker}
                </span>

                <div className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-8 text-slate-900 sm:text-[17px] sm:leading-9">
                  <MathTextParser
                    text={block.content}
                    display={block.formulaOnly}
                  />
                </div>
              </div>
            </div>
          );
        }


        if (block.formulaOnly) {
          return (
            <div
              key={block.id}
              className="my-2 w-full overflow-x-auto bg-white px-0 py-2 text-center"
            >
              <MathTextParser text={block.content} display />
            </div>
          );
        }

        return (
          <div
            key={block.id}
            className="mb-2 min-w-0 break-words bg-white text-[15px] font-semibold leading-8 text-slate-900 last:mb-0 sm:text-[17px] sm:leading-9"
          >
            <MathTextParser text={block.content} />
          </div>
        );
      })}

      {graphNode && !blocks.some((item) => Boolean(item.marker)) && (
        <div className="my-5">{graphNode}</div>
      )}
    </div>
  );
}

function simplifyExerciseText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    // نحافظ على LaTeX كما هو، ونحوّل فقط فواصل الأسطر إلى نص متصل.
    .replace(/[ \t]*\n+[ \t]*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}



function getQuestionDocuments(question) {
  if (!question || typeof question !== "object") return [];

  if (Array.isArray(question.documents)) {
    return question.documents.filter(Boolean);
  }

  const metadataDocuments = question?.metadata?.documents;

  if (Array.isArray(metadataDocuments)) {
    return metadataDocuments.filter(Boolean);
  }

  return [];
}

function EmbeddedSvgElement({ element, index }) {
  if (!element || typeof element !== "object") return null;

  const type = String(element.type || "").toLowerCase().trim();
  const common = {
    key: `${type || "element"}-${index}`,
  };

  if (type === "circle") {
    return (
      <circle
        {...common}
        cx={Number(element.cx) || 0}
        cy={Number(element.cy) || 0}
        r={Number(element.r) || 0}
        fill={element.fill ?? "none"}
        stroke={element.stroke ?? "none"}
        strokeWidth={Number(element.strokeWidth) || 0}
      />
    );
  }

  if (type === "ellipse") {
    return (
      <ellipse
        {...common}
        cx={Number(element.cx) || 0}
        cy={Number(element.cy) || 0}
        rx={Number(element.rx) || 0}
        ry={Number(element.ry) || 0}
        fill={element.fill ?? "none"}
        stroke={element.stroke ?? "none"}
        strokeWidth={Number(element.strokeWidth) || 0}
      />
    );
  }

  if (type === "rect") {
    return (
      <rect
        {...common}
        x={Number(element.x) || 0}
        y={Number(element.y) || 0}
        width={Number(element.width) || 0}
        height={Number(element.height) || 0}
        rx={Number(element.rx) || 0}
        ry={Number(element.ry) || 0}
        fill={element.fill ?? "none"}
        stroke={element.stroke ?? "none"}
        strokeWidth={Number(element.strokeWidth) || 0}
      />
    );
  }

  if (type === "line") {
    return (
      <line
        {...common}
        x1={Number(element.x1) || 0}
        y1={Number(element.y1) || 0}
        x2={Number(element.x2) || 0}
        y2={Number(element.y2) || 0}
        stroke={element.stroke ?? "#000"}
        strokeWidth={Number(element.strokeWidth) || 1}
      />
    );
  }

  if (type === "path") {
    return (
      <path
        {...common}
        d={String(element.d || "")}
        fill={element.fill ?? "none"}
        stroke={element.stroke ?? "#000"}
        strokeWidth={Number(element.strokeWidth) || 1}
        strokeLinecap={element.strokeLinecap || "round"}
        strokeLinejoin={element.strokeLinejoin || "round"}
      />
    );
  }

  if (type === "text") {
    const anchorMap = {
      start: "start",
      middle: "middle",
      end: "end",
    };

    return (
      <text
        {...common}
        x={Number(element.x) || 0}
        y={Number(element.y) || 0}
        fill={element.fill ?? "#000"}
        fontSize={Number(element.fontSize) || 18}
        fontWeight={element.fontWeight || 700}
        textAnchor={anchorMap[element.anchor] || "middle"}
        dominantBaseline={element.dominantBaseline || "middle"}
        direction={containsArabic(element.text) ? "rtl" : "ltr"}
        style={{
          fontFamily: "Tajawal, Cairo, Arial, sans-serif",
          unicodeBidi: "plaintext",
        }}
      >
        {String(element.text || "")}
      </text>
    );
  }

  return null;
}

function EmbeddedSvgDocument({ document }) {
  const normalized = normalizeObject(document);
  const elements = normalizeArray(normalized.elements);
  const width = Number(normalized.width) || 760;
  const height = Number(normalized.height) || 420;
  const viewBox = hasText(normalized.viewBox)
    ? normalized.viewBox
    : `0 0 ${width} ${height}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <Eye size={17} className="shrink-0 text-blue-600" />
        <p className="min-w-0 break-words text-sm font-black text-slate-800">
          {normalized.title || "وثيقة علمية"}
        </p>
      </div>

      <div className="flex w-full items-center justify-center overflow-x-auto bg-white p-3 sm:p-5">
        <svg
          viewBox={viewBox}
          width={width}
          height={height}
          role="img"
          aria-label={normalized.title || normalized.caption || "وثيقة علمية"}
          className="h-auto w-full max-w-[820px]"
          preserveAspectRatio="xMidYMid meet"
          style={{ maxHeight: "520px" }}
        >
          {elements.map((element, index) => (
            <EmbeddedSvgElement
              key={`${normalized.id || "document"}-${index}`}
              element={element}
              index={index}
            />
          ))}
        </svg>
      </div>

      {normalized.caption && (
        <div className="border-t border-slate-100 px-4 py-3 text-sm font-semibold leading-7 text-slate-700">
          <MathTextParser text={normalized.caption} />
        </div>
      )}

      {Array.isArray(normalized.legend) && normalized.legend.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="flex flex-wrap gap-3">
            {normalized.legend.map((item, index) => (
              <div
                key={`legend-${index}`}
                className="flex items-center gap-2 text-xs font-bold text-slate-700"
              >
                <span dir="ltr" className="text-base text-slate-950">
                  {item?.symbol || "●"}
                </span>
                <span>{item?.meaning || ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmbeddedSequenceDocument({ document }) {
  const normalized = normalizeObject(document);
  const stages = normalizeArray(normalized.stages);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    setStageIndex(0);
  }, [document]);

  if (!stages.length) return null;

  const safeIndex = Math.min(stageIndex, stages.length - 1);
  const activeStage = stages[safeIndex];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-600">وثيقة متدرجة</p>
          <p className="mt-0.5 break-words text-sm font-black text-slate-900">
            {normalized.title || "وثيقة علمية"}
          </p>
        </div>

        <span
          dir="ltr"
          className="shrink-0 text-xs font-extrabold text-slate-500"
        >
          {safeIndex + 1} / {stages.length}
        </span>
      </div>

      <div className="p-3 sm:p-5">
        <EmbeddedDocumentRenderer document={activeStage} />
      </div>

      {stages.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={() => setStageIndex((value) => Math.max(value - 1, 0))}
            disabled={safeIndex === 0}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            السابق
          </button>

          <button
            type="button"
            onClick={() =>
              setStageIndex((value) => Math.min(value + 1, stages.length - 1))
            }
            disabled={safeIndex === stages.length - 1}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            التالي
          </button>

          <button
            type="button"
            onClick={() => setStageIndex(0)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
          >
            إعادة
          </button>
        </div>
      )}

      {normalized.caption && (
        <div className="border-t border-slate-100 px-4 py-3 text-sm font-semibold leading-7 text-slate-700">
          <MathTextParser text={normalized.caption} />
        </div>
      )}
    </div>
  );
}

function EmbeddedDocumentRenderer({ document }) {
  const normalized = normalizeObject(document);
  const type = String(normalized.type || "").toLowerCase().trim();
  const render = String(normalized.render || "").toLowerCase().trim();

  if (!isNonEmptyObject(normalized)) return null;

  if (
    type === "sequence_diagram" ||
    (Array.isArray(normalized.stages) && normalized.stages.length > 0)
  ) {
    return <EmbeddedSequenceDocument document={normalized} />;
  }

  if (
    render === "svg" ||
    ["diagram", "process_diagram", "svg"].includes(type) ||
    Array.isArray(normalized.elements)
  ) {
    return <EmbeddedSvgDocument document={normalized} />;
  }

  return (
    <ScienceVisualRenderer
      visual={normalized}
      title={normalized.title || "الوثيقة العلمية"}
    />
  );
}

function DocumentsRenderer({ documents }) {
  const normalizedDocuments = normalizeArray(documents).filter(Boolean);

  if (!normalizedDocuments.length) return null;

  return (
    <div className="mb-5 space-y-4">
      {normalizedDocuments.map((document, index) => (
        <EmbeddedDocumentRenderer
          key={document?.id || `document-${index}`}
          document={document}
        />
      ))}
    </div>
  );
}

function ScienceVisualRenderer({ visual, title = "الوثيقة العلمية" }) {
  const normalized = normalizeObject(visual);
  const type = String(normalized.type || "").toLowerCase().trim();

  const rawFrames = normalizeArray(
    normalized.frames ||
    normalized.images ||
    normalized.steps
  );

  const rawItems = normalizeArray(
    normalized.items ||
    normalized.images ||
    normalized.documents
  );

  const frames = rawFrames.filter(Boolean);
  const items = rawItems.filter(Boolean);

  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(Boolean(normalized.autoplay));
  const [failedSources, setFailedSources] = useState({});

  useEffect(() => {
    setFrameIndex(0);
    setPlaying(Boolean(normalized.autoplay));
    setFailedSources({});
  }, [visual]);

  useEffect(() => {
    if (!playing || frames.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setFrameIndex((previous) => (previous + 1) % frames.length);
    }, Number(normalized.interval_ms) || 1700);

    return () => window.clearInterval(timer);
  }, [playing, frames.length, normalized.interval_ms]);

  const markSourceAsFailed = (source) => {
    if (!source) return;

    setFailedSources((previous) => ({
      ...previous,
      [source]: true,
    }));
  };

  const getItemSource = (item) => {
    if (typeof item === "string") return getVisualSource(item);
    return getVisualSource(item);
  };

  const getItemCaption = (item, fallback = title) => {
    if (!item || typeof item !== "object") return fallback;
    return item.caption || item.title || item.label || fallback;
  };

  const ImageFallback = ({ caption = title }) => (
    <div className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-5 py-8 text-center">
      <AlertTriangle size={28} className="text-amber-500" />
      <div>
        <p className="font-black text-slate-800">تعذر تحميل الوثيقة</p>
        <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
          تأكد أن مسار الصورة موجود وأن Django يقدّم ملفات media بشكل صحيح.
        </p>
      </div>
      {caption && (
        <p className="max-w-xl text-xs font-bold text-slate-600">{caption}</p>
      )}
    </div>
  );

  const ImageCard = ({ item, fallbackCaption = title }) => {
    const source = getItemSource(item);
    const caption = getItemCaption(item, fallbackCaption);
    const alt = getVisualAlt(
      typeof item === "object" ? item : null,
      caption || fallbackCaption
    );
    const failed = !source || Boolean(failedSources[source]);

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <Eye size={17} className="shrink-0 text-slate-600" />
          <p className="min-w-0 break-words text-sm font-black text-slate-800">
            {caption || fallbackCaption}
          </p>
        </div>

        <div className="flex min-h-[220px] items-center justify-center bg-white p-3 sm:p-5">
          {failed ? (
            <ImageFallback caption={caption} />
          ) : (
            <img
              src={source}
              alt={alt}
              loading="eager"
              decoding="async"
              onError={() => markSourceAsFailed(source)}
              className="block max-h-[460px] w-auto max-w-full object-contain"
            />
          )}
        </div>

        {typeof item === "object" && item?.description && item.description !== caption && (
          <div className="border-t border-slate-100 px-4 py-3 text-sm font-semibold leading-7 text-slate-700">
            <MathTextParser text={item.description} />
          </div>
        )}
      </div>
    );
  };

  /*
   * بعض البيانات القديمة لا تحتوي type لكن تحتوي src مباشرة.
   * نعتبرها صورة بدل إخفائها.
   */
  const directSource = getVisualSource(normalized);
  const inferredType =
    type ||
    (frames.length > 0
      ? "animation"
      : items.length > 0
        ? "comparison"
        : directSource
          ? "image"
          : "");

  if (!inferredType) return null;

  if (["image", "document", "figure", "photo"].includes(inferredType)) {
    return <ImageCard item={normalized} fallbackCaption={title} />;
  }

  if (
    ["comparison", "images", "gallery"].includes(inferredType) &&
    items.length > 0
  ) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item, index) => (
          <ImageCard
            key={`${getItemSource(item) || "science"}-${index}`}
            item={item}
            fallbackCaption={`الوثيقة ${index + 1}`}
          />
        ))}
      </div>
    );
  }

  if (
    ["animation", "animated", "frames", "sequence"].includes(inferredType) &&
    frames.length > 0
  ) {
    const safeFrameIndex = Math.min(frameIndex, frames.length - 1);
    const active = frames[safeFrameIndex] || {};
    const activeSource = getItemSource(active);
    const activeTitle = getItemCaption(active, title);
    const activeAlt = getVisualAlt(
      typeof active === "object" ? active : null,
      activeTitle
    );
    const activeFailed =
      !activeSource || Boolean(failedSources[activeSource]);

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black text-blue-600">رسم متحرك</p>
              <p className="mt-0.5 break-words text-sm font-black text-slate-900">
                {activeTitle}
              </p>
            </div>

            <span
              dir="ltr"
              className="shrink-0 text-xs font-extrabold text-slate-500"
            >
              {safeFrameIndex + 1} / {frames.length}
            </span>
          </div>
        </div>

        <div className="flex min-h-[260px] items-center justify-center bg-white p-3 sm:p-5">
          {activeFailed ? (
            <ImageFallback caption={activeTitle} />
          ) : (
            <img
              key={activeSource}
              src={activeSource}
              alt={activeAlt}
              loading="eager"
              decoding="async"
              onError={() => markSourceAsFailed(activeSource)}
              className="block max-h-[440px] w-auto max-w-full object-contain"
            />
          )}
        </div>

        {typeof active === "object" && active?.description && (
          <div className="border-t border-slate-100 px-4 py-3 text-sm font-semibold leading-7 text-slate-700">
            <MathTextParser text={active.description} />
          </div>
        )}

        {frames.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setFrameIndex((previous) => Math.max(previous - 1, 0));
              }}
              disabled={safeFrameIndex === 0}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              السابق
            </button>

            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700"
            >
              {playing ? "إيقاف" : "تشغيل ▶"}
            </button>

            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setFrameIndex((previous) =>
                  Math.min(previous + 1, frames.length - 1)
                );
              }}
              disabled={safeFrameIndex === frames.length - 1}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              التالي
            </button>

            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setFrameIndex(0);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
            >
              إعادة
            </button>
          </div>
        )}
      </div>
    );
  }

  /*
   * fallback: إذا جاء type غير معروف لكن يوجد src،
   * لا نخفي الوثيقة.
   */
  if (directSource) {
    return <ImageCard item={normalized} fallbackCaption={title} />;
  }

  return null;
}

function ExerciseQuestion({
  question,
  graphData = {},
  revealGraphSolution = false,
  scienceVisual = {},
  documents = [],
}) {
  const questionText = getQuestionDisplayText(question);

  return (
    <div>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <BookOpen size={22} />
        </div>

        <div className="min-w-0">
          <p className="mb-1 text-xs font-extrabold text-blue-600">تمرين بكالوريا</p>
          <div className="break-words text-lg font-black leading-8 text-slate-900 sm:text-xl">
            <MathTextParser
              text={
                question?.title ||
                question?.skill ||
                question?.exercise ||
                "تمرين"
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

      {normalizeArray(documents).length > 0 && (
        <DocumentsRenderer documents={documents} />
      )}

      {normalizeArray(documents).length === 0 &&
        isNonEmptyObject(normalizeObject(scienceVisual)) && (
          <div className="mb-5">
            <ScienceVisualRenderer
              visual={scienceVisual}
              title="الوثيقة العلمية للتمرين"
            />
          </div>
        )}

      {/* نص التمرين: المقدمة عادية، وكل سؤال مرقّم يظهر في سطر مستقل. */}
      <div className="border-t border-slate-200 bg-white pt-5">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen size={18} className="text-slate-500" />
          <p className="text-sm font-black text-slate-700">نص التمرين</p>
        </div>

        <StructuredQuestionText
          value={questionText}
          graphNode={
            isNonEmptyObject(normalizeObject(graphData)) ? (
              <SequenceGraphRenderer
                graphData={graphData}
                eyebrow="الرسم المعطى"
                title="الرسم الموجود في نص التمرين"
                description="هذا الرسم جزء من معطيات التمرين."
                revealSolution={revealGraphSolution}
              />
            ) : null
          }
        />
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

  // الشكل الحديث المستعمل في بعض بيانات المنصة.
  if (isNonEmptyObject(reactData)) {
    const modernSeries = normalizeArray(reactData.series);

    return {
      ...reactData,
      title: reactData.title || normalizedGraph.title || "",
      axes: {
        x: {
          ...normalizeObject(normalizedGraph?.axes?.x),
          ...normalizeObject(reactData?.axes?.x),
        },
        y: {
          ...normalizeObject(normalizedGraph?.axes?.y),
          ...normalizeObject(reactData?.axes?.y),
        },
      },
      series: modernSeries,
    };
  }

  const viewport = normalizeObject(normalizedGraph.viewport);
  const sourceAxes = normalizeObject(normalizedGraph.axes);
  const sourceXAxis = normalizeObject(sourceAxes.x);
  const sourceYAxis = normalizeObject(sourceAxes.y);
  const coordinateSystem = normalizeObject(normalizedGraph.coordinate_system);
  const xDomain = normalizeObject(normalizedGraph.x_domain);
  const yDomain = normalizeObject(normalizedGraph.y_domain);

  /*
   * دعم الشكل القديم الموجود في قاعدة البيانات:
   * graph_data.functions[].points
   * graph_data.x_domain / y_domain
   * graph_data.x_label / y_label
   */
  const legacyFunctions = normalizeArray(normalizedGraph.functions);
  const legacySeries = legacyFunctions
    .map((fn, index) => {
      const points = normalizeArray(fn?.points)
        .map(normalizeGraphPoint)
        .filter(Boolean);

      if (points.length < 2) return null;

      return {
        id: fn?.id || `function-${index + 1}`,
        type: "line",
        label: fn?.label || fn?.expression || `f${index + 1}`,
        expression: fn?.expression || "",
        data: points,
      };
    })
    .filter(Boolean);

  // شكل آخر شائع: function.points بدل functions[].points.
  const singleFunction = normalizeObject(normalizedGraph.function);
  const singleFunctionPoints = normalizeArray(singleFunction.points)
    .map(normalizeGraphPoint)
    .filter(Boolean);

  if (singleFunctionPoints.length >= 2 && legacySeries.length === 0) {
    legacySeries.push({
      id: singleFunction.id || "function",
      type: "line",
      label: singleFunction.label || singleFunction.expression || "f",
      expression: singleFunction.expression || "",
      data: singleFunctionPoints,
    });
  }

  // إذا كانت series موجودة أصلًا نفضّلها، وإلا نستعمل الشكل القديم.
  const directSeries = normalizeArray(normalizedGraph.series)
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const points = getSeriesPoints(item);
      if (points.length < 2 && !hasFiniteNumber(item?.y)) return null;

      return {
        ...item,
        id: item.id || `series-${index + 1}`,
        type: item.type || (item.kind === "curve" ? "line" : item.kind) || "line",
        data: points.length ? points : item.data,
      };
    })
    .filter(Boolean);

  const series = directSeries.length > 0 ? directSeries : legacySeries;

  return {
    schema_version: "fallback",
    graph_type: normalizedGraph.graph_type || normalizedGraph.type || "cartesian",
    coordinate_system: isNonEmptyObject(coordinateSystem) ? "cartesian" : (normalizedGraph.coordinate_system || "cartesian"),
    title: normalizedGraph.title || "",
    caption: normalizedGraph.caption || "",
    axes: {
      x: {
        ...sourceXAxis,
        label:
          sourceXAxis.label ||
          coordinateSystem.x_label ||
          normalizedGraph.x_label ||
          "x",
        min: hasFiniteNumber(sourceXAxis.min)
          ? Number(sourceXAxis.min)
          : hasFiniteNumber(xDomain.min)
            ? Number(xDomain.min)
            : hasFiniteNumber(viewport.xMin)
              ? Number(viewport.xMin)
              : undefined,
        max: hasFiniteNumber(sourceXAxis.max)
          ? Number(sourceXAxis.max)
          : hasFiniteNumber(xDomain.max)
            ? Number(xDomain.max)
            : hasFiniteNumber(viewport.xMax)
              ? Number(viewport.xMax)
              : undefined,
        step: hasFiniteNumber(sourceXAxis.step)
          ? Number(sourceXAxis.step)
          : hasFiniteNumber(xDomain.step)
            ? Number(xDomain.step)
            : undefined,
      },
      y: {
        ...sourceYAxis,
        label:
          sourceYAxis.label ||
          coordinateSystem.y_label ||
          normalizedGraph.y_label ||
          "y",
        min: hasFiniteNumber(sourceYAxis.min)
          ? Number(sourceYAxis.min)
          : hasFiniteNumber(yDomain.min)
            ? Number(yDomain.min)
            : hasFiniteNumber(viewport.yMin)
              ? Number(viewport.yMin)
              : undefined,
        max: hasFiniteNumber(sourceYAxis.max)
          ? Number(sourceYAxis.max)
          : hasFiniteNumber(yDomain.max)
            ? Number(yDomain.max)
            : hasFiniteNumber(viewport.yMax)
              ? Number(viewport.yMax)
              : undefined,
        step: hasFiniteNumber(sourceYAxis.step)
          ? Number(sourceYAxis.step)
          : hasFiniteNumber(yDomain.step)
            ? Number(yDomain.step)
            : undefined,
      },
    },
    series,
    annotations: normalizeArray(normalizedGraph.annotations),
    solution_annotations: normalizeArray(
      normalizedGraph.solution_annotations,
    ),
    interaction: normalizeObject(normalizedGraph.interaction),
  };
}

function normalizeGraphPoint(point) {
  if (!point || typeof point !== "object") return null;

  // ندعم كل أشكال النقاط الموجودة في قاعدة البيانات:
  // {x, y} للرياضيات، {t, y} للمنحنيات الزمنية،
  // وكذلك {time, value} أو {x, value} عند الحاجة.
  const rawX =
    point.x ??
    point.t ??
    point.time ??
    point.n ??
    point.abscissa;

  const rawY =
    point.y ??
    point.value ??
    point.i ??
    point.v ??
    point.Vg ??
    point.ordinate;

  const x = Number(rawX);
  const y = Number(rawY);

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
  const source = Array.isArray(series?.data)
    ? series.data
    : Array.isArray(series?.points)
      ? series.points
      : [];

  return source.map(normalizeGraphPoint).filter(Boolean);
}

function hasFiniteNumber(value) {
  return value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value));
}

function niceStep(rawStep) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;

  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / 10 ** exponent;

  let niceFraction = 1;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 2.5) niceFraction = 2.5;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;

  return niceFraction * 10 ** exponent;
}

function buildAutomaticRange(values, axis, includeZero = false) {
  const cleanValues = normalizeArray(values)
    .map(Number)
    .filter(Number.isFinite);

  let dataMin = cleanValues.length ? Math.min(...cleanValues) : 0;
  let dataMax = cleanValues.length ? Math.max(...cleanValues) : 1;

  if (includeZero) {
    dataMin = Math.min(0, dataMin);
    dataMax = Math.max(0, dataMax);
  }

  if (dataMin === dataMax) {
    const delta = Math.abs(dataMin) > 0 ? Math.abs(dataMin) * 0.15 : 1;
    dataMin -= delta;
    dataMax += delta;
  }

  const explicitMin = hasFiniteNumber(axis?.min)
    ? Number(axis.min)
    : null;
  const explicitMax = hasFiniteNumber(axis?.max)
    ? Number(axis.max)
    : null;

  const rawSpan = Math.max(dataMax - dataMin, Number.EPSILON);
  const padding = rawSpan * 0.08;

  let min = explicitMin ?? dataMin - padding;
  let max = explicitMax ?? dataMax + padding;

  if (includeZero && explicitMin === null && dataMin >= 0) {
    min = 0;
  }

  if (includeZero && explicitMax === null && dataMax <= 0) {
    max = 0;
  }

  if (!(max > min)) {
    max = min + 1;
  }

  const step = niceStep((max - min) / 6);

  if (explicitMin === null) {
    min = Math.floor(min / step) * step;
  }

  if (explicitMax === null) {
    max = Math.ceil(max / step) * step;
  }

  if (includeZero && dataMin >= 0 && explicitMin === null) {
    min = 0;
  }

  return { min, max, step };
}

function getGraphBounds(reactData) {
  const allPoints = normalizeArray(reactData?.series)
    .flatMap(getSeriesPoints);

  const horizontalValues = normalizeArray(reactData?.series)
    .filter((item) => String(item?.type || "").toLowerCase() === "horizontal_line")
    .map((item) => Number(item?.y))
    .filter(Number.isFinite);

  const annotationPoints = [
    ...normalizeArray(reactData?.annotations),
    ...normalizeArray(reactData?.solution_annotations),
  ]
    .map(normalizeGraphPoint)
    .filter(Boolean);

  const points = [...allPoints, ...annotationPoints];

  const calculatedX = points.map((point) => point.x);
  const calculatedY = [
    ...points.map((point) => point.y),
    ...horizontalValues,
  ];

  const xRange = buildAutomaticRange(
    calculatedX,
    reactData?.axes?.x,
    calculatedX.every((value) => value >= 0),
  );

  const yRange = buildAutomaticRange(
    calculatedY,
    reactData?.axes?.y,
    calculatedY.every((value) => value >= 0),
  );

  return {
    xMin: xRange.min,
    xMax: xRange.max,
    yMin: yRange.min,
    yMax: yRange.max,
    xStep: xRange.step,
    yStep: yRange.step,
  };
}

function createTicks(min, max, preferredTicks, preferredStep) {
  const validTicks = normalizeArray(preferredTicks)
    .map(Number)
    .filter(
      (value) =>
        Number.isFinite(value) &&
        value >= min - Number.EPSILON &&
        value <= max + Number.EPSILON,
    );

  if (validTicks.length > 0) {
    return validTicks;
  }

  const step =
    Number.isFinite(Number(preferredStep)) &&
    Number(preferredStep) > 0
      ? Number(preferredStep)
      : niceStep((max - min) / 6);

  const first = Math.ceil((min - Number.EPSILON) / step) * step;
  const ticks = [];

  for (
    let value = first, guard = 0;
    value <= max + step * 0.001 && guard < 100;
    value += step, guard += 1
  ) {
    ticks.push(Number(value.toPrecision(12)));
  }

  return ticks.length ? ticks : [min, max];
}

function formatGraphNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "";

  const absolute = Math.abs(number);

  if (
    absolute !== 0 &&
    (absolute >= 10000 || absolute < 0.001)
  ) {
    return number
      .toExponential(2)
      .replace(/\.00e/, "e")
      .replace(/(\.\d*[1-9])0+e/, "$1e");
  }

  const decimals =
    absolute < 0.01 ? 4 :
    absolute < 0.1 ? 3 :
    absolute < 1 ? 2 :
    absolute < 10 ? 2 :
    1;

  return Number(number.toFixed(decimals)).toString();
}

function getAxisCaption(axis, fallback) {
  const label = String(axis?.label || fallback || "").trim();
  const unit = String(axis?.unit || "").trim();

  if (!unit) return label;
  if (!label) return `(${unit})`;

  return `${label} (${unit})`;
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


function BacPhysicsDiagramRenderer({
  graphData,
  eyebrow = "الرسم الفيزيائي",
  title = "الرسم التخطيطي",
  description = "",
  variant = "question",
}) {
  const normalizedGraph = normalizeObject(graphData);
  const scene = normalizeObject(normalizedGraph.react_data);
  const elements = normalizeArray(scene.elements);
  if (scene.renderer !== "BacPhysicsDiagramSvg" || elements.length === 0) {
    return null;
  }

  const width = Number(scene.width) || 900;
  const height = Number(scene.height) || 500;
  const markerId = `bac-arrow-${String(normalizedGraph.id || title)
    .replace(/[^\w-]/g, "-")
    .slice(0, 40)}`;
  const solution = variant === "solution";

  const renderElement = (element, index) => {
    if (!element || typeof element !== "object") return null;
    const key = element.id || `${element.type || "element"}-${index}`;
    const stroke = element.stroke || "#111827";
    const widthValue = Number(element.width) || 2.6;
    const fill = element.fill === "none" ? "none" : (element.fill || "none");
    const dash = element.dashed ? "9 7" : undefined;

    if (element.type === "line") {
      return (
        <line key={key}
          x1={element.x1} y1={element.y1}
          x2={element.x2} y2={element.y2}
          stroke={stroke} strokeWidth={widthValue}
          strokeDasharray={dash} strokeLinecap="round"
        />
      );
    }

    if (element.type === "arrow") {
      return (
        <g key={key}>
          <line
            x1={element.x1} y1={element.y1}
            x2={element.x2} y2={element.y2}
            stroke={stroke} strokeWidth={widthValue || 3}
            strokeDasharray={dash}
            strokeLinecap="round"
            markerEnd={`url(#${markerId})`}
          />
          {hasText(element.label) && (
            <text
              x={element.label_x ?? element.x2 + 12}
              y={element.label_y ?? element.y2 - 10}
              fontSize={element.label_size || 18}
              fontWeight="800"
              fill="#111827"
              textAnchor={element.anchor || "middle"}
              direction={containsArabic(element.label) ? "rtl" : "ltr"}
              unicodeBidi="plaintext"
            >
              {element.label}
            </text>
          )}
        </g>
      );
    }

    if (element.type === "rect") {
      const transform = Number.isFinite(Number(element.rotate))
        ? `rotate(${element.rotate} ${element.cx ?? (Number(element.x)+Number(element.w)/2)} ${element.cy ?? (Number(element.y)+Number(element.h)/2)})`
        : undefined;
      return (
        <rect key={key}
          x={element.x} y={element.y}
          width={element.w} height={element.h}
          rx={element.rx || 0}
          fill={fill}
          stroke={stroke} strokeWidth={widthValue}
          transform={transform}
        />
      );
    }

    if (element.type === "circle") {
      return (
        <circle key={key}
          cx={element.cx} cy={element.cy} r={element.r}
          fill={element.fill || "none"}
          stroke={element.stroke ?? (element.fill && element.fill !== "none" ? "none" : stroke)}
          strokeWidth={widthValue}
          strokeDasharray={dash}
        />
      );
    }

    if (element.type === "ellipse") {
      return (
        <ellipse key={key}
          cx={element.cx} cy={element.cy}
          rx={element.rx} ry={element.ry}
          fill={fill}
          stroke={stroke} strokeWidth={widthValue}
          strokeDasharray={dash}
        />
      );
    }

    if (element.type === "path") {
      return (
        <path key={key}
          d={element.d}
          fill={fill}
          stroke={stroke} strokeWidth={widthValue}
          strokeDasharray={dash}
          strokeLinecap="round" strokeLinejoin="round"
        />
      );
    }

    if (element.type === "polyline") {
      return (
        <polyline key={key}
          points={element.points}
          fill={fill}
          stroke={stroke} strokeWidth={widthValue}
          strokeDasharray={dash}
          strokeLinecap="round" strokeLinejoin="round"
        />
      );
    }

    if (element.type === "text") {
      const text = String(element.text || "");
      return (
        <text key={key}
          x={element.x} y={element.y}
          fontSize={element.size || 18}
          fontWeight={element.bold ? "900" : "700"}
          fill={element.fill || "#111827"}
          textAnchor={element.anchor || "middle"}
          direction={containsArabic(text) ? "rtl" : "ltr"}
          unicodeBidi="plaintext"
        >
          {text}
        </text>
      );
    }

    return null;
  };

  return (
    <section
      className={cn(
        "mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm",
        solution ? "border-emerald-200" : "border-slate-200",
      )}
      dir="rtl"
    >
      <div className={cn(
        "border-b px-4 py-3 sm:px-5",
        solution ? "border-emerald-100 bg-emerald-50/60" : "border-slate-200 bg-slate-50/70"
      )}>
        <p className={cn(
          "text-xs font-black",
          solution ? "text-emerald-700" : "text-slate-600"
        )}>{eyebrow}</p>
        <h3 className="mt-1 text-base font-black text-slate-950 sm:text-lg">
          {normalizedGraph.title || title}
        </h3>
        {(normalizedGraph.caption || description) && (
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
            {normalizedGraph.caption || description}
          </p>
        )}
      </div>

      <div className="overflow-x-auto bg-white p-3 sm:p-5">
        <div className="mx-auto min-w-[620px] max-w-[900px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label={normalizedGraph.title || title}
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

            <rect x="1" y="1" width={width - 2} height={height - 2}
              rx="8" fill="#ffffff" stroke="#e5e7eb" strokeWidth="1.5" />

            {elements.map(renderElement)}
          </svg>
        </div>
      </div>
    </section>
  );
}

function SequenceGraphRenderer({
  graphData,
  eyebrow = "التمثيل البياني",
  title = "الرسم المرتبط بالتمرين",
  description = "",
  variant = "question",
  revealSolution = false,
}) {
  if (graphData?.react_data?.renderer === "BacPhysicsDiagramSvg") {
    return (
      <BacPhysicsDiagramRenderer
        graphData={graphData}
        eyebrow={eyebrow}
        title={title}
        description={description}
        variant={variant}
      />
    );
  }

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
    reactData?.axes?.x?.step ?? bounds.xStep,
  );

  const yTicks = createTicks(
    bounds.yMin,
    bounds.yMax,
    reactData?.axes?.y?.ticks,
    reactData?.axes?.y?.step ?? bounds.yStep,
  );

  const xAxisY =
    bounds.yMin <= 0 && bounds.yMax >= 0
      ? yScale(0)
      : yScale(bounds.yMin);

  const yAxisX =
    bounds.xMin <= 0 && bounds.xMax >= 0
      ? xScale(0)
      : xScale(bounds.xMin);

  const baseAnnotations = normalizeArray(reactData.annotations);
  const solutionAnnotations = normalizeArray(reactData.solution_annotations);

  const annotations = [
    ...baseAnnotations,
    ...(revealSolution || variant === "solution" ? solutionAnnotations : []),
  ].filter((annotation) => {
    const visibility = String(annotation?.visibility || "always");
    if (variant === "solution") return visibility !== "question_only";
    if (!revealSolution && visibility === "solution_only") return false;
    return visibility !== "hidden";
  });

  const isSolutionGraph = variant === "solution";

  return (
    <section
      className={cn(
        "mt-7 overflow-hidden rounded-2xl sm:rounded-[28px] bg-white shadow-[0_18px_55px_-35px_rgba(79,70,229,0.45)]",
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

      <div className="max-w-full overflow-x-auto overscroll-x-contain p-2 sm:p-5">
        <div className="min-w-[620px] sm:min-w-[680px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label={reactData.title || title || "التمثيل البياني"}
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
              {getAxisCaption(reactData?.axes?.x, "x")}
            </text>

            <text
              x={yAxisX - 10}
              y={padding.top - 14}
              textAnchor="middle"
              fontSize="18"
              fontWeight="900"
              fill="#0f172a"
            >
              {getAxisCaption(reactData?.axes?.y, "y")}
            </text>

            {series.map((item, seriesIndex) => {
              const points = getSeriesPoints(item);
              const stroke =
                item.color || (graphData?.settings?.bac_style ? "#111827" : getSeriesStroke(seriesIndex));
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





function normalizeVariationLabel(value) {
  return String(value ?? "")
    .replace(/\\\(|\\\)/g, "")
    .replace(/-\\infty/g, "−∞")
    .replace(/\+\\infty/g, "+∞")
    .replace(/\\infty/g, "∞")
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, "√($1)")
    .replace(/\\,/g, " ")
    .trim();
}

function getVariationReactData(table) {
  const normalizedTable = normalizeObject(table);
  const stored = normalizeObject(normalizedTable.react_data);

  if (
    stored.renderer === "VariationTableSvg" &&
    normalizeArray(stored.points).length >= 2
  ) {
    return stored;
  }

  const criticalPoints = normalizeArray(normalizedTable.critical_points);
  const derivativeSigns = normalizeArray(
    normalizedTable?.derivative_row?.signs
  );
  const functionValues = normalizeArray(
    normalizedTable?.function_row?.values
  );
  const variations = normalizeArray(
    normalizedTable?.function_row?.variations
  );

  const intervalSigns =
    derivativeSigns.length === criticalPoints.length * 2 - 3
      ? derivativeSigns.filter((_, index) => index % 2 === 0)
      : derivativeSigns.slice(0, Math.max(0, criticalPoints.length - 1));

  return {
    renderer: "VariationTableSvg",
    points: criticalPoints.map((point, index) => ({
      index,
      x: normalizeVariationLabel(point),
      function_value: normalizeVariationLabel(functionValues[index]),
      is_excluded: false,
    })),
    segments: criticalPoints.slice(0, -1).map((point, index) => {
      const direction =
        variations[index] ||
        (intervalSigns[index] === "+"
          ? "increasing"
          : intervalSigns[index] === "-"
            ? "decreasing"
            : "constant");

      return {
        index,
        from_index: index,
        to_index: index + 1,
        derivative_sign: intervalSigns[index] || "",
        direction,
        arrow:
          direction === "increasing"
            ? "↗"
            : direction === "decreasing"
              ? "↘"
              : "→",
      };
    }),
  };
}

function VariationTableRenderer({ table }) {
  const normalizedTable = normalizeObject(table);
  const reactData = getVariationReactData(normalizedTable);
  const points = normalizeArray(reactData.points);
  const segments = normalizeArray(reactData.segments);

  if (points.length < 2 || segments.length === 0) return null;

  const width = 900;
  const height = 310;
  const labelWidth = 112;
  const rightPadding = 28;
  const top = 24;
  const xRowBottom = 86;
  const derivativeBottom = 154;
  const functionBottom = 286;
  const usableWidth = width - labelWidth - rightPadding;
  const columnWidth = usableWidth / Math.max(1, points.length - 1);
  const xForPoint = (index) => labelWidth + index * columnWidth;
  const yHigh = 190;
  const yLow = 258;

  const pointY = points.map((point, index) => {
    if (index === 0) {
      return segments[0]?.direction === "increasing" ? yLow : yHigh;
    }

    const previousDirection = segments[index - 1]?.direction;
    if (previousDirection === "increasing") return yHigh;
    if (previousDirection === "decreasing") return yLow;
    return 224;
  });

  const markerId = `variation-arrow-${normalizedTable.id || "table"}`;

  return (
    <section
      dir="rtl"
      className="mt-4 overflow-hidden rounded-2xl sm:rounded-[24px] border border-indigo-100 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50/70 px-4 py-3">
        <div>
          <p className="text-xs font-black text-indigo-600">
            تمثيل بصري
          </p>
          <h4 className="mt-1 font-black text-slate-950">
            {normalizedTable.title || "جدول تغيرات الدالة"}
          </h4>
        </div>

        {normalizedTable.domain && (
          <div className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-sm font-bold text-indigo-800">
            <MathTextParser text={normalizedTable.domain} dir="ltr" />
          </div>
        )}
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <div className="min-w-[720px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label={normalizedTable.title || "جدول تغيرات الدالة"}
          >
            <defs>
              <marker
                id={markerId}
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="#4f46e5" />
              </marker>
            </defs>

            <rect
              x="1"
              y={top}
              width={width - 2}
              height={functionBottom - top}
              rx="18"
              fill="#ffffff"
              stroke="#c7d2fe"
              strokeWidth="2"
            />

            <line
              x1={labelWidth}
              y1={top}
              x2={labelWidth}
              y2={functionBottom}
              stroke="#cbd5e1"
              strokeWidth="2"
            />
            <line
              x1="1"
              y1={xRowBottom}
              x2={width - 1}
              y2={xRowBottom}
              stroke="#cbd5e1"
              strokeWidth="2"
            />
            <line
              x1="1"
              y1={derivativeBottom}
              x2={width - 1}
              y2={derivativeBottom}
              stroke="#cbd5e1"
              strokeWidth="2"
            />

            <text
              x={labelWidth / 2}
              y="60"
              textAnchor="middle"
              fontSize="19"
              fontWeight="800"
              fill="#312e81"
            >
              x
            </text>
            <text
              x={labelWidth / 2}
              y="126"
              textAnchor="middle"
              fontSize="18"
              fontWeight="800"
              fill="#312e81"
            >
              {normalizeVariationLabel(
                normalizedTable?.derivative_row?.label || "f'(x)"
              )}
            </text>
            <text
              x={labelWidth / 2}
              y="225"
              textAnchor="middle"
              fontSize="18"
              fontWeight="800"
              fill="#312e81"
            >
              {normalizeVariationLabel(
                normalizedTable?.function_row?.label || "f(x)"
              )}
            </text>

            {points.map((point, index) => {
              const x = xForPoint(index);
              return (
                <g key={`variation-point-${index}`}>
                  {index > 0 && index < points.length - 1 && (
                    <line
                      x1={x}
                      y1={top}
                      x2={x}
                      y2={functionBottom}
                      stroke={point.is_excluded ? "#ef4444" : "#e2e8f0"}
                      strokeWidth={point.is_excluded ? "3" : "1.5"}
                      strokeDasharray={point.is_excluded ? "7 5" : undefined}
                    />
                  )}

                  <text
                    x={x}
                    y="60"
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="800"
                    fill="#0f172a"
                  >
                    {normalizeVariationLabel(point.x)}
                  </text>

                  {point.function_value && (
                    <text
                      x={x}
                      y={pointY[index] + (pointY[index] === yHigh ? -10 : 23)}
                      textAnchor="middle"
                      fontSize="18"
                      fontWeight="800"
                      fill="#0f172a"
                    >
                      {normalizeVariationLabel(point.function_value)}
                    </text>
                  )}
                </g>
              );
            })}

            {segments.map((segment, index) => {
              const fromX = xForPoint(index) + 34;
              const toX = xForPoint(index + 1) - 34;
              const fromY = pointY[index];
              const toY = pointY[index + 1];
              const middleX = (fromX + toX) / 2;

              return (
                <g key={`variation-segment-${index}`}>
                  <text
                    x={middleX}
                    y="128"
                    textAnchor="middle"
                    fontSize="20"
                    fontWeight="900"
                    fill={
                      segment.derivative_sign === "-"
                        ? "#dc2626"
                        : "#059669"
                    }
                  >
                    {normalizeVariationLabel(segment.derivative_sign)}
                  </text>

                  <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke="#4f46e5"
                    strokeWidth="4"
                    strokeLinecap="round"
                    markerEnd={`url(#${markerId})`}
                  />
                </g>
              );
            })}

            {points.slice(1, -1).map((point, index) => (
              <text
                key={`critical-zero-${index}`}
                x={xForPoint(index + 1)}
                y="128"
                textAnchor="middle"
                fontSize="18"
                fontWeight="900"
                fill="#475569"
              >
                {point.is_excluded ? "∥" : "0"}
              </text>
            ))}
          </svg>
        </div>
      </div>

      <div className="border-t border-indigo-100 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {segments.map((segment, index) => (
            <span
              key={`variation-summary-${index}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
            >
              {normalizeVariationLabel(points[index]?.x)} إلى{" "}
              {normalizeVariationLabel(points[index + 1]?.x)}:{" "}
              {segment.direction === "increasing"
                ? "متزايدة ↗"
                : segment.direction === "decreasing"
                  ? "متناقصة ↘"
                  : "ثابتة →"}
            </span>
          ))}
        </div>
      </div>
    </section>
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
          ? "إخفاء التصحيح النموذجي"
          : "عرض التصحيح النموذجي"}
    </button>
  );
}

function AIHelpCard({
  loading,
  hasExplanation,
  visible,
  onClick,
}) {
  return (
    <section
      dir="rtl"
      className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 sm:mt-6 sm:rounded-[24px]"
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
            <Brain size={21} strokeWidth={2.2} />
            <span className="absolute -left-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-slate-50 bg-indigo-500" />
          </div>

          <div className="min-w-0 pt-0.5">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-black tracking-wide text-indigo-600">
                هل بقيت خطوة غير واضحة؟
              </p>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-600">
                AI
              </span>
            </div>

            <h3 className="text-[15px] font-black leading-7 text-slate-950 sm:text-base">
              أعد لي الحل من البداية بطريقة أبسط
            </h3>

            <p className="mt-1 max-w-2xl text-[13px] font-medium leading-6 text-slate-600 sm:text-sm sm:leading-7">
              سأقسم نفس التمرين إلى خطوات صغيرة جدًا، وأوضح لك ماذا نفعل ولماذا، دون تغيير السؤال أو النتيجة الصحيحة.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClick}
          disabled={loading}
          className="group inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[205px]"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              أشرح التمرين الآن...
            </>
          ) : hasExplanation ? (
            <>
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              {visible ? "إخفاء الحل الأبسط" : "عرض الحل الأبسط"}
            </>
          ) : (
            <>
              <Sparkles size={18} className="transition-transform group-hover:rotate-6" />
              اشرح لي ببساطة
            </>
          )}
        </button>
      </div>
    </section>
  );
}

function StoredSolution({ solution }) {
  const normalizedSolution = normalizeObject(solution);
  const simpleSolution = getStoredSimpleSolution(normalizedSolution);
  const solutionGraphData = normalizeObject(normalizedSolution.graph_data);
  const hasSolutionGraph = isNonEmptyObject(solutionGraphData);
  const solutionScienceVisual = normalizeObject(normalizedSolution.science_visual);
  const hasSolutionScienceVisual = isNonEmptyObject(solutionScienceVisual);

  const simpleSteps = normalizeArray(simpleSolution.steps || simpleSolution.solution_steps);
  const rootSteps = normalizeArray(normalizedSolution.steps);
  const displayedSteps = simpleSteps.length > 0 ? simpleSteps : rootSteps;

  const fallbackExplanation =
    simpleSolution.explanation ||
    normalizedSolution.detailed_explanation ||
    normalizedSolution.explanation;

  const finalAnswer =
    normalizedSolution.final_answer ||
    simpleSolution.final_answer ||
    simpleSolution.answer;

  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm" dir="rtl">
      <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50/60 px-5 py-4 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <CheckCircle2 size={19} strokeWidth={2.6} />
        </span>
        <div>
          <p className="text-xs font-black text-emerald-700">التصحيح النموذجي</p>
          <h2 className="mt-0.5 text-lg font-black text-slate-950">الحل</h2>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-7 sm:py-6">
        {hasSolutionScienceVisual && (
          <div className="mb-7">
            <ScienceVisualRenderer
              visual={solutionScienceVisual}
              title="الوثيقة المستعملة في الحل"
            />
          </div>
        )}

        {hasSolutionGraph && (
          <div className="mb-7">
            <SequenceGraphRenderer
              graphData={solutionGraphData}
              eyebrow="الرسم"
              title="الرسم المستعمل في الحل"
              variant="solution"
            />
          </div>
        )}

        {displayedSteps.length > 0 ? (
          <div>
            {displayedSteps.map((step, index) => (
              <StoredSolutionStep
                key={`${step?.order || index}-${step?.title || "step"}`}
                step={step}
                index={index}
                isLast={index === displayedSteps.length - 1}
              />
            ))}
          </div>
        ) : fallbackExplanation ? (
          <MathTextParser
            text={fallbackExplanation}
            className="text-[15px] font-semibold leading-9 text-slate-800 sm:text-base"
          />
        ) : null}

        {finalAnswer && (
          <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="mt-1 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 text-xs font-black text-emerald-700">النتيجة النهائية</p>
                <MathTextParser
                  text={finalAnswer}
                  className="text-base font-black leading-9 text-slate-950 sm:text-[17px]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SimpleStoredSolution({ solution }) {
  const steps = normalizeArray(solution.steps || solution.solution_steps);
  const explanation =
    solution.intro || solution.explanation || solution.detailed_explanation;
  const finalAnswer =
    solution.final_answer || solution.answer || solution.final_math;

  return (
    <div className="space-y-5" dir="rtl">
      {explanation && (
        <MathTextParser
          text={explanation}
          className="text-[15px] font-semibold leading-9 text-slate-800 sm:text-base"
        />
      )}

      {steps.length > 0 && (
        <div className="divide-y divide-slate-100">
          {steps.map((step, index) => (
            <StoredSolutionStep key={`simple-${index}`} step={step} index={index} />
          ))}
        </div>
      )}

      {finalAnswer && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-4">
          <p className="mb-1 text-xs font-black text-emerald-700">الجواب النهائي</p>
          <MathTextParser text={finalAnswer} className="font-black leading-9 text-slate-950" />
        </div>
      )}
    </div>
  );
}

function isMeaninglessSolutionText(value) {
  const text = String(value ?? "")
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
    .replace(/\\(?:,|;|!|qquad\b|quad\b)/g, " ")
    .replace(/[\s\-–—_=.:؛،]+/g, "")
    .trim();

  return text.length === 0;
}

function cleanSolutionMathText(value) {
  let text = String(value ?? "")
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\r\n?/g, "\n")
    // إصلاح متغيرات مختلطة بالعربية داخل LaTeX مثل t_نهاية.
    // العربية خارج MathJax تبقى كما هي، لكن اسم المتغير يصبح t_f.
    .replace(/t_\{?\s*نهاية\s*\}?/g, "t_f")
    .replace(/t_\{?\s*النهاية\s*\}?/g, "t_f")
    .replace(/t_\{?\s*نهائي\s*\}?/g, "t_f")
    // توحيد أوامر التقريب.
    .replace(/\\approx(?=\s*[-+]?\d)/g, "\\approx ")
    .replace(/\\simeq(?=\s*[-+]?\d)/g, "\\simeq ")
    // 14\\,min -> 14\\,\\mathrm{min}
    .replace(/(\d)\\,\s*min\b/g, "$1\\,\\mathrm{min}")
    .replace(/(\d)\s+min\b/g, "$1\\,\\mathrm{min}")
    .replace(/(\d)\s*min\b/g, "$1\\,\\mathrm{min}")
    // 12\\,s, 5\\,V, ... عند وصول الوحدة كنص عادي.
    .replace(/(\d)\\,\s*(Pa|kPa|MPa|s|ms|V|A|mA|H|F|J|mol|mmol|L|mL|K|W|N|C|Hz)\b/g, "$1\\,\\mathrm{$2}")
    .replace(/\bPa(?=\s*(?:\\,|\\;|\s))/g, "\\mathrm{Pa}")
    .replace(/\bm(?=\^\{?[-+]?\d+\}?)/g, "\\mathrm{m}")
    .replace(/\bmol(?=\^\{?[-+]?\d+\}?|\s*(?:\\,|$))/g, "\\mathrm{mol}")
    .replace(/\bK(?=\^\{?[-+]?\d+\}?|\s*(?:\\,|$))/g, "\\mathrm{K}")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !isMeaninglessSolutionText(line));

  return lines.join("\n");
}

function normalizeCalculationLines(value) {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "string" || typeof value === "number") {
    const cleaned = cleanSolutionMathText(value);
    return isMeaninglessSolutionText(cleaned) ? "" : cleaned;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeCalculationLines(item))
      .filter((item) => item && !isMeaninglessSolutionText(item))
      .join("\n");
  }

  if (typeof value === "object") {
    return normalizeCalculationLines(
      value.math ??
      value.calculation ??
      value.formula ??
      value.expression ??
      value.equation ??
      value.text ??
      value.content ??
      value.value ??
      value.result ??
      ""
    );
  }

  const cleaned = cleanSolutionMathText(String(value));
  return isMeaninglessSolutionText(cleaned) ? "" : cleaned;
}

/*
 * مهم: هذا الـ renderer يتجاهل عمدًا الحقول التعليمية الزائدة مثل:
 * what_to_do / rule / why / used_rule / step_result_label
 * ويعرض فقط الحل الفعلي: عنوان مختصر + شرح مباشر + حساب + نتيجة.
 */
function StoredSolutionStep({ step, index, isLast = false }) {
  const normalizedStep = typeof step === "string" ? { explanation: step } : step || {};

  const number = normalizedStep.order || normalizedStep.number || normalizedStep.step_number || index + 1;
  const rawTitle = normalizedStep.title || normalizedStep.name || normalizedStep.step_title;
  const title = isMeaninglessSolutionText(rawTitle) ? "" : cleanSolutionMathText(rawTitle);

  const rawExplanation =
    normalizedStep.simple_explanation ||
    normalizedStep.explanation ||
    normalizedStep.teacher_explanation ||
    normalizedStep.description ||
    normalizedStep.instruction;

  const explanation = isMeaninglessSolutionText(rawExplanation)
    ? ""
    : cleanSolutionMathText(rawExplanation);

  const calculationBreakdown = normalizeArray(
    normalizedStep.calculation_breakdown ||
    normalizedStep.calculation_details ||
    normalizedStep.breakdown
  )
    .map((item) => cleanSolutionMathText(toDisplayString(item)))
    .filter((item) => item && !isMeaninglessSolutionText(item));

  const calculation = normalizeCalculationLines(
    normalizedStep.calculation_lines ??
    normalizedStep.calculation ??
    normalizedStep.math ??
    normalizedStep.formula ??
    normalizedStep.equation
  );

  const rawResult =
    normalizedStep.result ||
    normalizedStep.answer ||
    normalizedStep.conclusion ||
    normalizedStep.final_result;

  const result = isMeaninglessSolutionText(rawResult)
    ? ""
    : cleanSolutionMathText(rawResult);

  const variationTables = normalizeArray(normalizedStep.variation_tables).filter(
    (table) => isNonEmptyObject(normalizeObject(table))
  );

  const hasContent =
    title || explanation || calculationBreakdown.length > 0 || calculation || result || variationTables.length > 0;
  if (!hasContent) return null;

  return (
    <div className="relative flex gap-4 pb-7 last:pb-0 sm:gap-5">
      {/* مسار الخطوات */}
      <div className="relative flex w-9 shrink-0 justify-center">
        {!isLast && (
          <span className="absolute bottom-0 top-9 w-px bg-slate-200" />
        )}
        <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-sm font-black text-blue-700">
          {number}
        </span>
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        {title && (
          <div className="mb-1.5 text-[15px] font-black leading-8 text-slate-950 sm:text-base">
            <MathTextParser text={title} />
          </div>
        )}

        {explanation && (
          <MathTextParser
            text={explanation}
            className="text-[15px] font-medium leading-8 text-slate-700 sm:text-base"
          />
        )}

        {calculationBreakdown.length > 0 && (
          <div className="mt-3 space-y-2 border-r-2 border-blue-100 pr-3">
            {calculationBreakdown.map((item, itemIndex) => {
              const text = cleanSolutionMathText(item);
              const displayMath = shouldUseDisplayMath(text);
              return (
                <MathTextParser
                  key={`${number}-calc-${itemIndex}`}
                  text={text}
                  display={displayMath}
                  dir={displayMath ? "ltr" : "rtl"}
                  className={cn(
                    "font-semibold leading-8 text-slate-800",
                    displayMath && "overflow-x-auto py-1 text-center"
                  )}
                />
              );
            })}
          </div>
        )}

        {calculation && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <MathTextParser
              text={calculation}
              display={shouldUseDisplayMath(calculation)}
              dir={shouldUseDisplayMath(calculation) ? "ltr" : "rtl"}
              className={cn(
                "font-bold leading-9 text-slate-950",
                shouldUseDisplayMath(calculation) && "text-center"
              )}
            />
          </div>
        )}

        {result && (
          <div className="mt-3 border-r-2 border-emerald-500 pr-3 text-emerald-800">
            <MathTextParser text={result} className="font-bold leading-8" />
          </div>
        )}

        {variationTables.map((table, tableIndex) => (
          <div className="mt-4" key={table?.id || `${number}-variation-${tableIndex}`}>
            <VariationTableRenderer table={table} />
          </div>
        ))}
      </div>
    </div>
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

  const givenItems = normalizeArray(
    normalizedExplanation?.what_is_given
  );

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm sm:rounded-[28px]">
      <div className="border-b border-indigo-100 bg-indigo-50/60 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <Brain size={21} />
          </div>
          <div>
            <p className="text-xs font-black text-indigo-600">شرح بالذكاء الاصطناعي</p>
            <h2 className="mt-0.5 text-lg font-black text-slate-950">
              نحل التمرين من البداية وبأبسط طريقة
            </h2>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-4 py-5 sm:px-7 sm:py-6">
        {normalizedExplanation?.teacher_intro && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5">
            <MathTextParser
              text={normalizedExplanation.teacher_intro}
              className="font-semibold leading-8 text-slate-700"
            />
          </div>
        )}

        {givenItems.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <BookOpen size={18} className="text-blue-600" />
              <h3 className="font-black text-slate-950">ما الذي نملكه؟</h3>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {givenItems.map((item, index) => (
                <div
                  key={`given-${index}`}
                  className="rounded-xl border border-blue-100 bg-blue-50/50 px-3.5 py-3"
                >
                  {item?.label && (
                    <p className="mb-1 text-xs font-black text-blue-700">
                      {item.label}
                    </p>
                  )}
                  {item?.value && (
                    <MathTextParser
                      text={item.value}
                      className="font-bold leading-8 text-slate-950"
                    />
                  )}
                  {item?.meaning && (
                    <MathTextParser
                      text={item.meaning}
                      className="mt-1 text-sm font-medium leading-7 text-slate-600"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {normalizedExplanation?.what_is_required && (
          <div className="rounded-2xl border-r-4 border-r-violet-500 bg-violet-50/60 px-4 py-3.5">
            <p className="mb-1 text-xs font-black text-violet-700">ما المطلوب؟</p>
            <MathTextParser
              text={normalizedExplanation.what_is_required}
              className="font-bold leading-8 text-slate-800"
            />
          </div>
        )}

        {normalizedExplanation?.idea && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-4">
            <div className="mb-2 flex items-center gap-2 font-black text-amber-800">
              <Lightbulb size={18} />
              الفكرة قبل الحساب
            </div>
            <MathTextParser
              text={normalizedExplanation.idea}
              className="font-semibold leading-8 text-amber-950"
            />
          </div>
        )}

        {steps.length > 0 && (
          <div>
            <h3 className="mb-4 font-black text-slate-950">الحل خطوة بخطوة</h3>
            <div>
              {steps.map((step, index) => {
                const formulaAndCalculation = [
                  step?.formula,
                  step?.calculation,
                ].filter(hasText).join("\n");

                return (
                  <StoredSolutionStep
                    key={`ai-step-${index}`}
                    step={{
                      order: step?.order || index + 1,
                      title: step?.title,
                      explanation: step?.explanation,
                      calculation: formulaAndCalculation,
                      result: step?.result,
                    }}
                    index={index}
                    isLast={index === steps.length - 1}
                  />
                );
              })}
            </div>
          </div>
        )}

        {normalizedExplanation?.final_answer && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-2 font-black text-emerald-800">
              <CheckCircle2 size={19} />
              الجواب النهائي
            </div>
            <MathBox text={normalizedExplanation.final_answer} variant="green" />
          </div>
        )}

        {normalizedExplanation?.verification && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="mb-1 text-xs font-black text-slate-500">كيف نتأكد؟</p>
            <MathTextParser
              text={normalizedExplanation.verification}
              className="font-semibold leading-8 text-slate-700"
            />
          </div>
        )}

        {normalizedExplanation?.memory_tip && (
          <div className="flex items-start gap-3 rounded-xl bg-indigo-50 px-4 py-3.5">
            <Sparkles size={18} className="mt-1 shrink-0 text-indigo-600" />
            <div>
              <p className="text-xs font-black text-indigo-600">تذكّر</p>
              <MathTextParser
                text={normalizedExplanation.memory_tip}
                className="font-semibold leading-8 text-indigo-950"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            اشرحها بطريقة أبسط مرة أخرى
          </button>
        </div>
      </div>
    </section>
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

  const formulaOnlyBox = lines.every((line) => shouldUseDisplayMath(line));

  return (
    <div
      dir={formulaOnlyBox ? "ltr" : "rtl"}
      className={cn(
        "overflow-hidden rounded-2xl border p-4",
        variants[variant] || variants.default,
        className,
      )}
      style={{
        direction: formulaOnlyBox ? "ltr" : "rtl",
        unicodeBidi: "isolate",
      }}
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
      className="mx-auto mt-6 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:mt-10 sm:rounded-[28px] sm:p-8"
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
