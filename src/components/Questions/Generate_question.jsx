import { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { MathJax, MathJaxContext } from "better-react-mathjax";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCcw,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import { UserContext } from "../../Utils/UserContext";
const BASE_URL = import.meta.env.VITE_BASE_URL;
// const API_BASE_URL =
//   "http://127.0.0.1:8000/api/exercise-generation";


const API_BASE_URL = `${BASE_URL}/api/exercise-generation`;
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toText(value) {
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
        value.hint ??
        value.explanation ??
        value.calculation ??
        value.result ??
        value.title ??
        value.answer ??
        value.value ??
        "",
    );
  }

  return String(value);
}

const MATHJAX_CONFIG = {
  loader: { load: ["[tex]/ams", "[tex]/textmacros"] },
  tex: {
    inlineMath: [["\\(", "\\)"], ["$", "$"]],
    displayMath: [["\\[", "\\]"], ["$$", "$$"]],
    processEscapes: true,
    processEnvironments: true,
    packages: { "[+]": ["ams", "textmacros"] },
  },
  chtml: {
    matchFontHeight: false,
    displayAlign: "center",
    displayIndent: "0",
  },
  options: {
    skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
  },
};

function decodeHtmlEntities(value) {
  return toText(value)
    .replace(/&#(\d+);?/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);?/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}


function repairCorruptedMathDelimiters(value) {
  let text = toText(value);
  if (!text) return "";

  /*
   * بعض إجابات الـ API تصل فيها محددات MathJax مشوهة، مثل:
   *   \\|[ ... \\]   بدل   \\[ ... \\]
   *   |[ ... \\]     بدل   \\[ ... \\]
   *   \\|(...\\)     بدل   \\(...\\)
   *
   * نعالجها فقط عندما تكون في بداية سطر/قطعة أو بعد مسافة، حتى لا
   * نفسد رمز القيمة المطلقة |x| أو شرط المجموعات.
   */
  return String(text)
    .replace(/(^|[\n\r\t ])\\+\|\s*\[/g, "$1\\[")
    .replace(/(^|[\n\r\t ])\|\s*\[/g, "$1\\[")
    .replace(/(^|[\n\r\t ])\\+\|\s*\(/g, "$1\\(")
    .replace(/(^|[\n\r\t ])\|\s*\(/g, "$1\\(")
    // أشكال أخرى شائعة ناتجة عن النسخ أو JSON غير السليم.
    .replace(/(^|[\n\r\t ])\\+l\s*\[/gi, "$1\\[")
    .replace(/(^|[\n\r\t ])\\+l\s*\(/gi, "$1\\(")
    .replace(/\\+\]\s*\|(?=$|[\n\r\t ])/g, "\\]")
    .replace(/\\+\)\s*\|(?=$|[\n\r\t ])/g, "\\)");
}


function repairLatexCommandNames(value) {
  let text = toText(value);
  if (!text) return "";

  /*
   * إصلاح أسماء أوامر LaTeX التي تصل من الـ API دون backslash أو بشكل
   * متضرر بسبب JSON، مثل:
   *   displaystylelim  -> \\displaystyle \\lim
   *   \\]ight          -> \\right
   *   rac{a}{b}        -> \\frac{a}{b}
   */
  text = String(text)
    // \right قد يتحول إلى carriage-return + ight أو إلى \]ight.
    .replace(/\r\s*ight\b/gi, "\\right")
    .replace(/\\r\s*ight\b/gi, "\\right")
    .replace(/\\\]\s*ight\b/gi, "\\right")
    .replace(/\\r\s*ight\b/gi, "\\right")
    .replace(/\\\]\s*ight\b/gi, "\\right")
    .replace(/(^|[^A-Za-z\\])\]\s*ight\b/gi, "$1\\right")
    .replace(/(^|[^A-Za-z\\])ight(?=\s*[)\]}.|])/gi, "$1\\right")

    // أوامر متلاصقة أو فاقدة للـ backslash.
    .replace(/(^|[^A-Za-z\\])displaystyle\s*lim(?=\s*[_^({]|$)/gi, "$1\\displaystyle \\lim")
    .replace(/(^|[^A-Za-z\\])displaystyle\b/gi, "$1\\displaystyle")
    .replace(/(^|[^A-Za-z\\])lim(?=\s*[_^({]|$)/gi, "$1\\lim")
    .replace(/(^|[^A-Za-z\\])frac(?=\s*\{)/gi, "$1\\frac")
    .replace(/(^|[^A-Za-z\\])sqrt(?=\s*(?:\[|\{))/gi, "$1\\sqrt")
    .replace(/(^|[^A-Za-z\\])cdot\b/gi, "$1\\cdot")
    .replace(/(^|[^A-Za-z\\])times\b/gi, "$1\\times")
    .replace(/(^|[^A-Za-z\\])infty\b/gi, "$1\\infty")
    .replace(/(^|[^A-Za-z\\])Rightarrow\b/g, "$1\\Rightarrow")
    .replace(/(^|[^A-Za-z\\])Leftrightarrow\b/g, "$1\\Leftrightarrow")

    // أوامر فقدت أول حرف بسبب محارف التحكم في JSON.
    .replace(/(^|[^A-Za-z\\])rac(?=\s*\{)/gi, "$1\\frac")
    .replace(/(^|[^A-Za-z\\])qrt(?=\s*(?:\[|\{))/gi, "$1\\sqrt")
    .replace(/(^|[^A-Za-z\\])ext(?=\s*\{)/gi, "$1\\text")
    .replace(/(^|[^A-Za-z\\])imes\b/gi, "$1\\times")

    // إزالة التكرار الناتج عن الإصلاح أكثر من مرة.
    .replace(/\\displaystyle\s*\\displaystyle\b/g, "\\displaystyle")
    .replace(/\\lim\s*\\lim\b/g, "\\lim")
    .replace(/\\frac\s*\\frac(?=\s*\{)/g, "\\frac")
    .replace(/[ \t]{2,}/g, " ");

  return text;
}

function recoverJsonEscapedLatex(value) {
  let text = repairLatexCommandNames(repairCorruptedMathDelimiters(value));
  if (!text) return "";

  /*
   * عندما يرسل الخادم LaTeX داخل JSON دون مضاعفة backslash تتحول بعض
   * الأوامر إلى محارف تحكم فعلية:
   *   \\right -> carriage return + "ight"
   *   \\times  -> tab + "imes"
   *   \\text   -> tab + "ext"
   *   \\frac   -> form-feed + "rac"
   *   \\begin  -> backspace + "egin"
   * نعيد بناء الأمر قبل أي تحويل للأسطر أو المسافات.
   */
  return String(text)
    .replace(/\r\s*ight\b/gi, "\\\\right")
    .replace(/\t\s*imes\b/gi, "\\\\times")
    .replace(/\t\s*ext\b/gi, "\\\\text")
    .replace(/\f\s*rac\b/gi, "\\\\frac")
    .replace(/\x08\s*egin\b/gi, "\\\\begin")
    .replace(/\x08\s*eta\b/gi, "\\\\beta")
    .replace(/\x07\s*lpha\b/gi, "\\\\alpha")
    .replace(/\x0b\s*ert\b/gi, "\\\\vert");
}

function normalizeMalformedMathText(value) {
  let text = recoverJsonEscapedLatex(value);
  if (!text) return "";

  return String(text)
    .replace(/\r\n?/g, "\n")
    // تحويل \\n الحرفية القادمة من API إلى مسافة، مع حماية أوامر LaTeX الصحيحة.
    // مثال المشكلة: L(L+2)=...\\nL^2 تتحول إلى L(L+2)=... L^2.
    .replace(/\\n(?!(?:eq|e\b|ot\b|u\b|abla\b))/gi, " ")
    .replace(/\\n\s*(?=[\-•▪◦]|\d+[.)]|[\u0600-\u06FF])/g, "\n")
    .replace(/\\r\\n|\\r/g, "\n")
    // Tab حرفي متكرر. لا نمس أوامر LaTeX الصحيحة مثل \\times و\\text.
    .replace(/(?:\\t){2,}/g, " ")
    .replace(/\\t(?=\s|$|[×+\-=0-9\u0600-\u06FF])/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function repairBrokenContent(value) {
  let text = repairLatexCommandNames(
    recoverJsonEscapedLatex(decodeHtmlEntities(value)),
  );
  if (!text) return "";

  text = String(text)
    // محارف التحكم الناتجة عن JSON غير المهرب.
    .replace(/\u0009\s*ext\b/gi, "\\text")
    .replace(/\u0009\s*imes\b/gi, "\\times")
    .replace(/\u000c\s*rac\b/gi, "\\frac")
    .replace(/\u0008\s*egin\b/gi, "\\begin")
    .replace(/\u0008\s*eta\b/gi, "\\beta")
    .replace(/\u0007\s*lpha\b/gi, "\\alpha")
    .replace(/\u000b\s*ert\b/gi, "\\vert")
    // إزالة محارف تحكم أخرى لا فائدة لها.
    .replace(/[\u0000-\u0008\u000B\u000E-\u001F\u007F]/g, "")
    // النمط الظاهر في الصور: 2\\t\\t... × 3
    .replace(/(?:\\t\s*)+(?=×|\\times\b|\*)/g, "")
    .replace(/(?:\\t\s*)+(?=\d)/g, " ")
    // إصلاح أوامر فقدت الحرف الأول.
    .replace(/(^|[^A-Za-z\\])imes(?=$|[^A-Za-z])/gi, "$1\\times")
    .replace(/(^|[^A-Za-z\\])rac(?=\s*\{)/gi, "$1\\frac")
    .replace(/(^|[^A-Za-z\\])qrt(?=\s*[\[{])/gi, "$1\\sqrt")
    .replace(/(^|[^A-Za-z\\])ext\s*\{([^{}]*)\}/gi, "$1\\text{$2}")
    // لا نحول كلمة عربية ملتصقة بـ ext إلى LaTeX؛ نحذف البقايا فقط.
    .replace(/(^|[\s،؛:])ext(?=[\u0600-\u06FF])/gi, "$1")
    // أوامر مكتوبة على شكل \\t imes أو \\t ext.
    .replace(/\\t\s*imes\b/gi, "\\times")
    .replace(/\\t\s*ext\b/gi, "\\text")
    .replace(/\\f\s*rac\b/gi, "\\frac")
    .replace(/\\b\s*egin\b/gi, "\\begin")
    .replace(/\\n\s*eq\b/gi, "\\neq")
    .replace(/\\g\s*eq?\b/gi, "\\geq")
    .replace(/\\l\s*eq?\b/gi, "\\leq")
    .replace(/\\c\s*dot\b/gi, "\\cdot")
    // ترميز n>=0 المكسور.
    .replace(/\\n\s*\\?g(?:e|eo|eq)\b/gi, "n\\geq")
    .replace(/\\n\s*\\?l(?:e|eo|eq)\b/gi, "n\\leq")
    .replace(/\\geo\b/gi, "\\geq")
    .replace(/\\leo\b/gi, "\\leq")
    // Unicode والرموز.
    .replace(/≤/g, "\\leq ")
    .replace(/≥/g, "\\geq ")
    .replace(/≠/g, "\\neq ")
    .replace(/∞/g, "\\infty ")
    .replace(/→/g, "\\to ")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/−/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\u2028|\u2029/g, "\n")
    // إصلاح \\n الحرفية داخل الصيغ، مع عدم كسر \\neq و\\not و\\nabla.
    .replace(/\\n(?!(?:eq|e\b|ot\b|u\b|abla\b))/gi, " ");

  // فك double escaping دون المساس بـ backslash مفرد صحيح.
  for (let pass = 0; pass < 3; pass += 1) {
    const previous = text;
    text = text
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16)),
      )
      .replace(/\\\\(?=[A-Za-z[(\]])/g, "\\");
    if (text === previous) break;
  }

  text = repairLatexCommandNames(normalizeMalformedMathText(text))
    // أوامر شائعة بدون backslash.
    .replace(/(^|[^A-Za-z\\])frac\s*(?=\{)/gi, "$1\\frac")
    .replace(/(^|[^A-Za-z\\])sqrt\s*(?=\[|\{)/gi, "$1\\sqrt")
    .replace(/(^|[^A-Za-z\\])sum\s*(?=_|\^|\{)/gi, "$1\\sum")
    .replace(/(^|[^A-Za-z\\])prod\s*(?=_|\^|\{)/gi, "$1\\prod")
    .replace(/(^|[^A-Za-z\\])times(?=$|[^A-Za-z])/gi, "$1\\times")
    .replace(/(^|[^A-Za-z\\])cdot(?=$|[^A-Za-z])/gi, "$1\\cdot")
    .replace(/(^|[^A-Za-z\\])neq(?=$|[^A-Za-z])/gi, "$1\\neq")
    .replace(/(^|[^A-Za-z\\])geq?(?=$|[^A-Za-z])/gi, "$1\\geq")
    .replace(/(^|[^A-Za-z\\])leq?(?=$|[^A-Za-z])/gi, "$1\\leq")
    // تنظيف المسافات حول الضرب.
    .replace(/(?:\\t\s*)+(?=\\times\b)/g, "")
    .replace(/\\times\s*\\times/g, "\\times")
    .replace(/\s*\\times\s*/g, " \\times ")
    // ترميز المتتالية المقلوب.
    .replace(/\{\s*n\s*\\g(?:e|eo|eq)\s*0\s*\}_\s*\{\s*\(?\s*u_n\s*\)?\s*\}/gi, "(u_n)_{n\\ge 0}")
    .replace(/\{\s*\\?n\s*\\?g(?:e|eo|eq)\s*0?\s*\}_\s*\{\s*\(?\s*u_n\s*\)?\s*\}/gi, "(u_n)_{n\\ge 0}")
    // Delimiters مكررة.
    .replace(/\\\\+\(/g, "\\(")
    .replace(/\\\\+\)/g, "\\)")
    .replace(/\\\\+\[/g, "\\[")
    .replace(/\\\\+\]/g, "\\]")
    .replace(/\\\(\s*\\\(([\s\S]*?)\\\)\s*\\\)/g, "\\($1\\)")
    .replace(/\\\[\s*\\\[([\s\S]*?)\\\]\s*\\\]/g, "\\[$1\\]")
    // إزالة dollars المنفردة التي تفسد MathJax.
    .replace(/\$\s*\n\s*\$/g, "\n")
    .replace(/\${3,}/g, "$$")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const dollarCount = (text.match(/\$/g) || []).length;
  if (dollarCount % 2 !== 0) text = text.replace(/\$/g, "");

  return text;
}

function cleanText(value) {
  return repairBrokenContent(value);
}

function containsArabic(value) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(toText(value));
}

function detectDirection(value) {
  const firstStrong = toText(value).match(/[\u0600-\u06FFA-Za-zÀ-ÖØ-öø-ÿ]/)?.[0];
  if (!firstStrong) return "rtl";
  return containsArabic(firstStrong) ? "rtl" : "ltr";
}

function sanitizeLeftRight(value) {
  let text = toText(value);

  // left/right only resize delimiters. Removing them prevents unmatched-pair errors.
  text = text
    .replace(/\\left\s*/g, "")
    .replace(/\\right\s*/g, "")
    .replace(/(^|[^A-Za-z\\])left(?=\s*[([{.|])/gi, "$1")
    .replace(/(^|[^A-Za-z\\])right(?=\s*[)\]}.|])/gi, "$1");

  return text;
}

function stripOuterMathDelimiters(value) {
  let text = toText(value);
  if (!text) return "";

  /*
   * إزالة أغلفة MathJax من الصيغة قبل إعادة تغليفها داخل MathRenderer.
   * يدعم هذه الحالات حتى مع backslash مكرر أو محارف اتجاه خفية:
   *   \\[ ... \\]
   *   \\( ... \\)
   *   \\\\[ ... \\\\]
   */
  text = String(text)
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .trim();

  // توحيد backslash المكرر حول المحددات فقط.
  text = text
    .replace(/\\{2,}(?=\s*[\[(])/g, "\\")
    .replace(/\\{2,}(?=\s*[\])])/g, "\\");

  // حذف الغلاف الخارجي فقط، ولا نحذف الأقواس الرياضية العادية داخل الصيغة.
  for (let pass = 0; pass < 3; pass += 1) {
    const previous = text;

    text = text
      .replace(/^\s*\\+\s*\[\s*/, "")
      .replace(/\s*\\+\s*\]\s*$/, "")
      .replace(/^\s*\\+\s*\(\s*/, "")
      .replace(/\s*\\+\s*\)\s*$/, "")
      .replace(/^\s*\$\$?\s*/, "")
      .replace(/\s*\$\$?\s*$/, "")
      .trim();

    if (text === previous) break;
  }

  return text;
}

function normalizeLatex(value) {
  let text = repairLatexCommandNames(repairBrokenContent(value)).trim();
  if (!text) return "";

  text = repairLatexCommandNames(repairCorruptedMathDelimiters(text));

  // MathRenderer يضيف delimiters بنفسه، لذلك نحذف الغلاف الخارجي أولًا.
  // هذه الخطوة تعالج الصيغة التي كانت تظهر حرفيًا بالشكل: \[ ... \]
  text = stripOuterMathDelimiters(text);

  text = text
    // تنظيف أي محددات متبقية بسبب بيانات API مشوهة.
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
    .replace(/\$/g, "")
    .replace(/≤/g, "\\leq ")
    .replace(/≥/g, "\\geq ")
    .replace(/≠/g, "\\neq ")
    .replace(/∞/g, "\\infty ")
    .replace(/→/g, "\\to ")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/−/g, "-")
    .replace(/\s*;\s*(?=\\(?:Rightarrow|Leftrightarrow|to)\b)/g, " ")
    .replace(/(\\(?:Rightarrow|Leftrightarrow|to)\b)\s*;\s*/g, "$1\\; ")
    .replace(/(^|[^\\])\b(leq|geq|neq)\b/g, "$1\\$2")
    .replace(/\\text\s*\{\s*\}/g, "")
    // إزالة النقطة والفاصلة خارج نهاية الصيغة؛ تعرض كنص خارج MathJax.
    .replace(/[،,.؛;]+\s*$/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  text = sanitizeLeftRight(text);
  return balanceBraces(text);
}

function balanceBraces(value) {
  const text = toText(value);
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
    if (character === "{") depth += 1;
    if (character === "}") {
      if (depth === 0) continue;
      depth -= 1;
    }
    result += character;
  }

  return depth > 0 ? result + "}".repeat(depth) : result;
}

function stripLatexTextForDetection(value) {
  return toText(value).replace(/\\text\s*\{[^{}]*\}/g, "");
}

function looksLikeBareMath(value) {
  const text = toText(value).trim();
  if (!text) return false;

  // نسمح بالعربية عندما تكون داخل \text{...} ضمن صيغة رياضية.
  const detectionText = stripLatexTextForDetection(text);
  const hasArabicOutsideLatexText = containsArabic(detectionText);

  const hasMathCommand =
    /\\(?:frac|sqrt|sum|prod|lim|infty|cdot|times|div|leq?|geq?|neq|to|Rightarrow|Leftrightarrow|begin|end|left|right|mathbb|mathrm|text)\b/.test(
      text,
    );

  const hasEquationStructure =
    /[=<>_^]/.test(detectionText) &&
    /[A-Za-z0-9]/.test(detectionText);

  const startsLikeEquation =
    /^[A-Za-z](?:_[{]?[A-Za-z0-9+\-]+[}]?)?\s*=/.test(
      detectionText,
    );

  if (hasMathCommand && (hasEquationStructure || /\\(?:Rightarrow|Leftrightarrow|frac|sqrt)/.test(text))) {
    return true;
  }

  if (hasArabicOutsideLatexText) return false;
  return hasEquationStructure || startsLikeEquation;
}

function isArabicCharacter(character) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(
    character,
  );
}

function isMathChunk(value) {
  const text = toText(value).trim();
  if (!text) return false;

  const detectionText = stripLatexTextForDetection(text);
  if (containsArabic(detectionText)) return false;

  const hasMathCommand =
    /\\(?:frac|sqrt|sum|prod|lim|infty|cdot|times|div|leq?|geq?|neq|to|Rightarrow|Leftrightarrow|alpha|beta|gamma|theta|text|mathrm|mathbb)\b/.test(
      text,
    );

  const hasMathStructure =
    /[=<>_^{}]/.test(text) ||
    /[A-Za-z]\s*[+\-*/]\s*(?:[A-Za-z0-9]|\\)/.test(text) ||
    /(?:^|\s)[A-Za-z](?:_\{?[^\s,،؛:]+\}?)?\s*=/.test(text);

  return (
    /[A-Za-z0-9]/.test(text) &&
    (hasMathCommand || hasMathStructure)
  );
}

function pushPlainOrMathSegment(result, value) {
  const raw = toText(value);
  if (!raw) return;

  // نفصل علامات الترقيم الخارجية عن الصيغة حتى لا تدخل إلى MathJax.
  const match = raw.match(
    /^(\s*[،؛:,.!?؟()\[\]]*\s*)([\s\S]*?)(\s*[،؛:,.!?؟()\[\]]*\s*)$/,
  );

  const prefix = match?.[1] || "";
  const core = match?.[2] ?? raw;
  const suffix = match?.[3] || "";

  if (prefix) {
    result.push({ type: "text", value: prefix });
  }

  if (core.trim()) {
    result.push(
      isMathChunk(core)
        ? {
            type: "inline-math",
            value: normalizeLatex(core),
          }
        : { type: "text", value: core },
    );
  }

  if (suffix) {
    result.push({ type: "text", value: suffix });
  }
}

function protectMathDelimiters(value) {
  return repairCorruptedMathDelimiters(value)
    .replace(/\\\\+\(/g, "\\(")
    .replace(/\\\\+\)/g, "\\)")
    .replace(/\\\\+\[/g, "\\[")
    .replace(/\\\\+\]/g, "\\]")
    .replace(/\\\(\s*\\\(([\s\S]*?)\\\)\s*\\\)/g, "\\($1\\)")
    .replace(/\\\[\s*\\\[([\s\S]*?)\\\]\s*\\\]/g, "\\[$1\\]");
}

function splitUndelimitedMixedText(value) {
  const text = toText(value);
  if (!text) return [];

  /*
   * نعزل كل كتلة غير عربية تحتوي إشارة رياضية قوية.
   * هذه الطريقة أكثر ثباتًا من محاولة تحليل LaTeX بتعبير منتظم واحد،
   * لأنها تدعم الكسور والجذور ذات الأقواس المتداخلة مثل:
   * \frac{q^{6}-1}{q-1} و \sqrt[3]{u_3/u_0}.
   */
  const nonArabicRun = /[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g;
  const result = [];
  let lastIndex = 0;
  let match;

  while ((match = nonArabicRun.exec(text)) !== null) {
    const rawRun = match[0];
    const candidate = rawRun.trim();

    const hasStrongMathSignal =
      /[=_^<>≤≥≠]/.test(candidate) ||
      /\\(?:frac|sqrt|sum|prod|lim|neq|leq|geq|times|cdot|to|infty|Rightarrow|Leftrightarrow)\b/.test(candidate) ||
      /[A-Za-z]_(?:\{|[A-Za-z0-9])/.test(candidate) ||
      /[A-Za-z]\^(?:\{|[A-Za-z0-9])/.test(candidate) ||
      /\d\s*[+\-*/×·]\s*\d/.test(candidate);

    if (!candidate || !hasStrongMathSignal) {
      continue;
    }

    const leading = rawRun.length - rawRun.trimStart().length;
    const trailing = rawRun.length - rawRun.trimEnd().length;
    const actualStart = match.index + leading;
    const actualEnd = match.index + rawRun.length - trailing;

    if (actualStart > lastIndex) {
      result.push({
        type: "text",
        value: text.slice(lastIndex, actualStart),
      });
    }

    // نفصل النقطة والفاصلة العربية الواقعة خارج الصيغة.
    const punctuationMatch = candidate.match(
      /^([،؛:,.!?؟()\[\]]*)([\s\S]*?)([،؛:,.!?؟()\[\]]*)$/,
    );

    const prefix = punctuationMatch?.[1] || "";
    const core = punctuationMatch?.[2] || candidate;
    const suffix = punctuationMatch?.[3] || "";

    if (prefix) {
      result.push({ type: "text", value: prefix });
    }

    if (core.trim()) {
      result.push({
        type: "inline-math",
        value: normalizeLatex(core),
      });
    }

    if (suffix) {
      result.push({ type: "text", value: suffix });
    }

    lastIndex = actualEnd;
  }

  if (lastIndex < text.length) {
    result.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return result.length
    ? result
    : [{ type: "text", value: text }];
}

function normalizeMathBlockDelimiters(value) {
  let text = repairLatexCommandNames(
    protectMathDelimiters(repairBrokenContent(value)),
  );
  if (!text) return "";

  return String(text)
    // إصلاح بدايات MathJax المشوهة فقط، من دون لمس \[ الصحيحة.
    .replace(
      /(^|\n)([ \t]*)(?:\\+\|[ \t]*|\|[ \t]*|\/[ \t]*)\[/g,
      "$1$2\\[",
    )
    .replace(
      /(^|\n)([ \t]*)(?:\\+\|[ \t]*|\|[ \t]*|\/[ \t]*)\(/g,
      "$1$2\\(",
    )
    // إصلاح النهايات المشوهة فقط مثل \]| و \)/.
    // لا نستبدل ] العادية لأن ذلك كان يضاعف backslash في \].
    .replace(/\\\][ \t]*[|/]+(?=\s*(?:$|\n))/g, "\\]")
    .replace(/\\\)[ \t]*[|/]+(?=\s*(?:$|\n))/g, "\\)")
    // توحيد backslash المكرر حول المحددات.
    .replace(/\\\\+\[/g, "\\[")
    .replace(/\\\\+\]/g, "\\]")
    .replace(/\\\\+\(/g, "\\(")
    .replace(/\\\\+\)/g, "\\)")
    // حذف backslash منفرد في سطر مستقل.
    .replace(/^\s*\\\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitRichSegments(value) {
  const text = normalizeMathBlockDelimiters(value);
  if (!text) return [];

  /*
   * معالجة مباشرة للصيغة التي تشغل القطعة كاملة. هذه الخطوة تمنع عرض
   * \[ ... \] كنص خام حتى لو احتوت البيانات على مسافات أو محارف خفية.
   */
  const wholeDisplay = text.match(/^\s*\\\[([\s\S]*?)\\\]\s*$/);
  if (wholeDisplay) {
    return [
      {
        type: "display-math",
        value: normalizeLatex(wholeDisplay[1]),
      },
    ];
  }

  const wholeInline = text.match(/^\s*\\\(([\s\S]*?)\\\)\s*$/);
  if (wholeInline) {
    return [
      {
        type: "inline-math",
        value: normalizeLatex(wholeInline[1]),
      },
    ];
  }

  const delimiterPattern = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = delimiterPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(
        ...splitUndelimitedMixedText(
          text.slice(lastIndex, match.index),
        ),
      );
    }

    const rawMath = match[0];
    const isDisplay =
      rawMath.startsWith("\\[") || rawMath.startsWith("$$");

    segments.push({
      type: isDisplay ? "display-math" : "inline-math",
      value: normalizeLatex(rawMath),
    });

    lastIndex = match.index + rawMath.length;
  }

  if (lastIndex < text.length) {
    segments.push(
      ...splitUndelimitedMixedText(text.slice(lastIndex)),
    );
  }

  const filtered = segments.filter((segment) =>
    hasValue(segment.value),
  );

  if (
    filtered.length === 1 &&
    filtered[0].type === "text" &&
    looksLikeBareMath(filtered[0].value)
  ) {
    return [
      {
        type: "display-math",
        value: normalizeLatex(filtered[0].value),
      },
    ];
  }

  return filtered;
}

function hasBalancedLatexBraces(value) {
  const text = toText(value);
  let depth = 0;
  let escaped = false;

  for (const character of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth < 0) return false;
  }

  return depth === 0;
}

function isSafeLatex(value) {
  const math = toText(value).trim();
  if (!math) return false;

  // لا نرسل العربية الخام إلى MathJax؛ يجب أن تكون داخل \\text{...}.
  if (containsArabic(stripLatexTextForDetection(math))) return false;

  // نمنع بقايا الأوامر المكسورة التي ظهرت في الصور.
  if (/(^|[^A-Za-z])(?:imes|ext|rac|qrt)(?=$|[^A-Za-z])/i.test(math)) {
    return false;
  }

  if (!hasBalancedLatexBraces(math)) return false;

  const begins = (math.match(/\\begin\s*\{/g) || []).length;
  const ends = (math.match(/\\end\s*\{/g) || []).length;
  if (begins !== ends) return false;

  // بعد normalizeLatex يجب ألا تبقى delimiters أو دولارات أو left/right.
  if (/\$|\\(?:left|right)\b|\\[()[\]]/.test(math)) return false;

  return true;
}

function MathRenderer({ value, display = false, className = "" }) {
  const firstPass = normalizeLatex(value);
  const math = normalizeLatex(stripOuterMathDelimiters(firstPass));
  if (!math) return null;

  // عند بقاء صيغة غير سليمة، نعرضها كنص بدل ظهور Math input error.
  if (!isSafeLatex(math)) {
    return (
      <bdi
        dir="ltr"
        className={cn(
          display
            ? "block w-full whitespace-pre-wrap break-words text-center"
            : "mx-1 inline whitespace-pre-wrap break-words",
          className,
        )}
        style={{ direction: "ltr", unicodeBidi: "isolate" }}
      >
        {repairBrokenContent(value)}
      </bdi>
    );
  }

  if (display) {
    return (
      <div
        dir="ltr"
        className={cn(
          "min-w-max px-2 py-1 text-center",
          className,
        )}
        style={{ direction: "ltr", unicodeBidi: "isolate" }}
      >
        <MathJax dynamic hideUntilTypeset="first">
          {`\\[${math}\\]`}
        </MathJax>
      </div>
    );
  }

  return (
    <bdi
      dir="ltr"
      className={cn(
        "mx-1 inline-block max-w-full align-baseline",
        className,
      )}
      style={{
        direction: "ltr",
        unicodeBidi: "isolate",
        whiteSpace: "nowrap",
      }}
    >
      <MathJax dynamic hideUntilTypeset="first">
        <span dir="ltr">{`\\(${math}\\)`}</span>
      </MathJax>
    </bdi>
  );
}

function isMathDominantLine(value) {
  const text = repairBrokenContent(value).trim();
  if (!text || containsArabic(text)) return false;

  const compact = text.replace(/\s+/g, "");
  return (
    looksLikeBareMath(text) ||
    /(?:[A-Za-z](?:_\{?[^\s=,;،؛]+\}?)?\s*=)/.test(text) ||
    /\\(?:frac|sqrt|sum|lim|begin|left|right)/.test(text) ||
    (/[=+\-*/^_<>]/.test(compact) && /[A-Za-z0-9]/.test(compact))
  );
}

function InlineRichText({ value, className = "" }) {
  const text = repairBrokenContent(value);
  if (!text) return null;

  const segments = splitRichSegments(text);
  if (segments.length === 0) return null;

  const baseDirection = containsArabic(text) ? "rtl" : detectDirection(text);

  return (
    <span
      dir={baseDirection}
      className={cn("whitespace-pre-wrap break-words", className)}
      style={{
        direction: baseDirection,
        // plaintext يحافظ على ترتيب الجملة العربية، بينما تبقى الصيغ
        // الرياضية معزولة داخل MathRenderer باتجاه LTR.
        unicodeBidi: "plaintext",
        letterSpacing: "normal",
        wordSpacing: "normal",
      }}
    >
      {segments.map((segment, index) => {
        if (segment.type === "inline-math") {
          return (
            <MathRenderer
              key={`im-${index}`}
              value={segment.value}
            />
          );
        }

        if (segment.type === "display-math") {
          return (
            <span
              key={`dm-${index}`}
              className="my-2 block w-full overflow-x-auto"
            >
              <MathRenderer value={segment.value} display />
            </span>
          );
        }

        const segmentText = toText(segment.value);
        if (!segmentText) return null;

        // لا نعزل كل قطعة نصية باستعمال bdi؛ عزل كل قطعة على حدة كان
        // يعكس ترتيب الجملة المختلطة بين العربية والصيغ الرياضية.
        const segmentDirection = containsArabic(segmentText)
          ? "rtl"
          : detectDirection(segmentText);

        return (
          <bdi
            key={`tx-${index}`}
            dir={segmentDirection}
            style={{ unicodeBidi: "isolate" }}
          >
            {segmentText}
          </bdi>
        );
      })}
    </span>
  );
}

function SmartText({ children, className = "", as: Component = "div" }) {
  const text = repairBrokenContent(children);
  if (!text) return null;

  return (
    <Component className={cn("space-y-2", className)}>
      {text.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
        <div key={paragraphIndex} className="space-y-2">
          {paragraph.split("\n").map((line, lineIndex) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={lineIndex} className="h-1" />;

            if (isMathDominantLine(trimmed)) {
              return (
                <div
                  key={lineIndex}
                  dir="ltr"
                  className="w-full overflow-x-auto py-1 text-center"
                  style={{
                    direction: "ltr",
                    unicodeBidi: "isolate",
                  }}
                >
                  <MathRenderer value={trimmed} display />
                </div>
              );
            }

            const direction = detectDirection(trimmed);

            return (
              <p
                key={lineIndex}
                dir={direction}
                className={cn(
                  "min-w-0 whitespace-pre-wrap break-words",
                  direction === "rtl" ? "text-right" : "text-left",
                )}
                style={{
                  direction,
                  unicodeBidi: "plaintext",
                  letterSpacing: "normal",
                  wordSpacing: "normal",
                  lineHeight: "2",
                }}
              >
                <InlineRichText value={line} />
              </p>
            );
          })}
        </div>
      ))}
    </Component>
  );
}

function splitExerciseStatementLines(value) {
  let text = repairBrokenContent(value);
  if (!text) return [];

  // نحافظ على الجملة الأصلية، ونفصل فقط فروع السؤال الواضحة.
  text = text
    // إزالة سطر backslash منفرد ناتج عن delimiter مكسور.
    .replace(/^\s*\\\s*$/gm, "")
    .replace(/\s+([أبجدهـوزحطيكلمنسعفصقرشتثخذضظغ])\s*[\)）]\s*/g, "\n$1) ")
    .replace(/\s+([0-9]+)\s*[\)）]\s*/g, "\n$1) ")
    .replace(/\s+(المطلوب\s*:)/g, "\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isQuestionBranch(value) {
  return /^([أبجدهـوزحطيكلمنسعفصقرشتثخذضظغ]|[0-9]+)\s*[\)）]/.test(
    toText(value).trim(),
  );
}

function normalizeStatementTextPart(value) {
  return toText(value)
    .replace(/\s+/g, " ")
    .replace(/\s+([،؛:,.!?؟])/g, "$1")
    .trim();
}

function splitStatementClauses(value) {
  const text = repairBrokenContent(value);
  if (!text) return [];

  // نفصل فقط عند نهاية جملة حقيقية. لا نفصل داخل الصيغ الرياضية.
  const clauses = [];
  let buffer = "";
  let braceDepth = 0;
  let delimiter = null;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1] || "";

    if (!delimiter && character === "\\" && ["(", "["].includes(next)) {
      delimiter = next === "(" ? "\\)" : "\\]";
      buffer += character + next;
      index += 1;
      continue;
    }

    if (delimiter && character === "\\" && `${character}${next}` === delimiter) {
      buffer += character + next;
      index += 1;
      delimiter = null;
      continue;
    }

    if (!delimiter) {
      if (character === "{") braceDepth += 1;
      if (character === "}") braceDepth = Math.max(0, braceDepth - 1);
    }

    buffer += character;

    const isSentenceEnd =
      !delimiter &&
      braceDepth === 0 &&
      [".", "؟", "!", ";", "؛"].includes(character) &&
      (next === "" || /\s/.test(next));

    if (isSentenceEnd) {
      const clause = buffer.trim();
      if (clause) clauses.push(clause);
      buffer = "";
    }
  }

  if (buffer.trim()) clauses.push(buffer.trim());
  return clauses;
}

function StatementSegmentFlow({ value }) {
  const text = repairBrokenContent(value);
  if (!text) return null;

  if (isMathDominantLine(text)) {
    return (
      <div
        dir="ltr"
        className="w-full overflow-x-auto py-1 text-center text-slate-950"
        style={{
          direction: "ltr",
          unicodeBidi: "isolate",
        }}
      >
        <MathRenderer
          value={text}
          display
          className="text-[17px] font-semibold sm:text-lg"
        />
      </div>
    );
  }

  return (
    <p
      dir="rtl"
      className="min-w-0 whitespace-pre-wrap break-words text-right text-[17px] font-medium leading-[2.15] text-slate-950 sm:text-lg"
      style={{
        direction: "rtl",
        unicodeBidi: "isolate",
        letterSpacing: "normal",
        wordSpacing: "normal",
      }}
    >
      <InlineRichText value={text} />
    </p>
  );
}

function ExerciseStatement({ value }) {
  const lines = splitExerciseStatementLines(value);
  if (!lines.length) return null;

  return (
    <div
      dir="rtl"
      className="space-y-4 text-slate-950"
      style={{ direction: "rtl", unicodeBidi: "isolate" }}
    >
      {lines.map((line, index) => {
        const branchMatch = isQuestionBranch(line)
          ? line.match(
              /^(([أبجدهـوزحطيكلمنسعفصقرشتثخذضظغ]|[0-9]+)\s*[\)）])\s*(.*)$/,
            )
          : null;

        if (branchMatch) {
          return (
            <div
              key={`statement-line-${index}`}
              dir="rtl"
              className="flex min-w-0 items-start gap-2 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0"
              style={{ direction: "rtl", unicodeBidi: "isolate" }}
            >
              <span
                dir="rtl"
                className="shrink-0 pt-0.5 text-[17px] font-black leading-[2.15] text-slate-950 sm:text-lg"
                style={{ unicodeBidi: "isolate" }}
              >
                {branchMatch[1]}
              </span>

              <div className="min-w-0 flex-1 space-y-2">
                {splitStatementClauses(branchMatch[3]).map(
                  (clause, clauseIndex) => (
                    <StatementSegmentFlow
                      key={`branch-clause-${clauseIndex}`}
                      value={clause}
                    />
                  ),
                )}
              </div>
            </div>
          );
        }

        return (
          <div
            key={`statement-line-${index}`}
            className="min-w-0 space-y-2"
          >
            {splitStatementClauses(line).map((clause, clauseIndex) => (
              <StatementSegmentFlow
                key={`statement-clause-${clauseIndex}`}
                value={clause}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MathBox({ children, className = "" }) {
  const text = repairBrokenContent(children);
  if (!text) return null;

  // ممنوع إرسال جملة عربية كاملة إلى MathJax.
  // MathJax يستقبل الصيغ فقط من خلال SmartText/InlineRichText.
  const containsArabicText = containsArabic(
    stripLatexTextForDetection(text),
  );

  if (!containsArabicText && looksLikeBareMath(text)) {
    return (
      <div
        dir="ltr"
        className={cn(
          "w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-slate-950",
          className,
        )}
      >
        <MathRenderer
          value={text}
          display
          className="text-lg font-bold sm:text-xl"
        />
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={cn(
        "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4",
        className,
      )}
      style={{ direction: "rtl", unicodeBidi: "plaintext" }}
    >
      <SmartText className="font-semibold text-slate-800">
        {text}
      </SmartText>
    </div>
  );
}

function getErrorMessage(error, fallback) {
  if (error?.response?.status === 401) {
    return "انتهت صلاحية تسجيل الدخول. سجّل الدخول من جديد.";
  }

  if (error?.response?.status === 404) {
    return "لم يتم العثور على العنصر المطلوب أو أن رابط API غير صحيح.";
  }

  if (error?.response?.status === 413) {
    return "حجم الطلب كبير جدًا. قلّل السياق المرسل إلى نموذج الذكاء الاصطناعي.";
  }

  if (error?.code === "ERR_NETWORK") {
    return "تعذر الاتصال بالخادم. تأكد من تشغيل Django.";
  }

  const responseData = error?.response?.data;

  if (typeof responseData === "string") {
    return responseData;
  }

  const details = normalizeArray(responseData?.details)
    .map((item) => toText(item).trim())
    .filter(Boolean);

  const mainMessage =
    responseData?.error ||
    responseData?.detail ||
    responseData?.message ||
    error?.message ||
    fallback;

  return details.length > 0
    ? `${mainMessage}\n${details.join("\n")}`
    : mainMessage;
}

function normalizeStep(step, index) {
  if (
    typeof step === "string" ||
    typeof step === "number"
  ) {
    return {
      title: `الخطوة ${index + 1}`,
      explanation: toText(step),
      formula: "",
      result: "",
    };
  }

  const source =
    step && typeof step === "object" ? step : {};

  return {
    title:
      source.title ||
      source.name ||
      source.label ||
      `الخطوة ${index + 1}`,
    explanation:
      source.explanation ||
      source.description ||
      source.content ||
      source.text ||
      source.reasoning ||
      source.method ||
      "",
    formula:
      source.formula ||
      source.calculation ||
      source.equation ||
      source.math ||
      "",
    result:
      source.result ||
      source.conclusion ||
      source.answer ||
      "",
  };
}

function normalizeSolutionPayload(value) {
  if (!value) {
    return {
      title: "",
      strategy: "",
      steps: [],
      finalAnswer: "",
      verification: "",
      commonMistake: "",
    };
  }

  let source = value;

  if (typeof source === "string") {
    try {
      source = JSON.parse(
        source
          .trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, ""),
      );
    } catch {
      source = {
        explanation: source,
      };
    }
  }

  if (
    !source ||
    typeof source !== "object" ||
    Array.isArray(source)
  ) {
    source = {};
  }

  const nested =
    source.alternative_solution ||
    source.simplified_solution ||
    source.second_solution ||
    source.solution ||
    source.answer ||
    source.data ||
    source;

  const normalized =
    nested &&
    typeof nested === "object" &&
    !Array.isArray(nested)
      ? nested
      : {
          explanation: toText(nested),
        };

  let steps = normalizeArray(
    normalized.steps ||
      normalized.solution_steps ||
      normalized.method_steps ||
      normalized.detailed_steps,
  ).map(normalizeStep);

  if (
    steps.length === 0 &&
    hasValue(
      normalized.explanation ||
        normalized.detailed_explanation,
    )
  ) {
    steps = [
      {
        title: normalized.title || "الشرح",
        explanation:
          normalized.explanation ||
          normalized.detailed_explanation,
        formula: "",
        result: "",
      },
    ];
  }

  return {
    title:
      normalized.title ||
      normalized.method_name ||
      normalized.name ||
      "حل أبسط",
    strategy:
      normalized.strategy ||
      normalized.method ||
      normalized.idea ||
      normalized.intro ||
      "",
    steps,
    finalAnswer:
      normalized.final_answer ||
      normalized.finalAnswer ||
      normalized.result ||
      normalized.conclusion ||
      "",
    verification:
      normalized.verification ||
      normalized.check ||
      normalized.proof ||
      "",
    commonMistake:
      normalized.common_mistake ||
      normalized.commonMistake ||
      "",
  };
}

function hasSolutionContent(solution) {
  return Boolean(
    solution &&
      (normalizeArray(solution.steps).length > 0 ||
        hasValue(solution.strategy) ||
        hasValue(solution.finalAnswer) ||
        hasValue(solution.verification)),
  );
}


function toFiniteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeGraphPoint(value) {
  if (!value || typeof value !== "object") return null;

  const x = toFiniteNumber(value.x);
  const y = toFiniteNumber(value.y);

  if (x === null || y === null) return null;

  return { x, y };
}

function normalizeGraphData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  // بعض نسخ الـ API تضع البيانات داخل graph_data أو data.
  const source =
    value.graph_data && typeof value.graph_data === "object"
      ? value.graph_data
      : value.data && typeof value.data === "object"
        ? value.data
        : value;

  const functions = normalizeArray(source.functions)
    .map((fn, index) => {
      if (!fn || typeof fn !== "object") return null;

      const points = normalizeArray(fn.points)
        .map(normalizeGraphPoint)
        .filter(Boolean);

      if (points.length < 2) return null;

      return {
        id: fn.id || `function-${index + 1}`,
        label: fn.label || fn.name || `الدالة ${index + 1}`,
        expression: fn.expression || "",
        points,
      };
    })
    .filter(Boolean);

  const sequenceValues = normalizeArray(source.sequence_values || source.sequenceValues)
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const n = toFiniteNumber(item.n);
      const sequenceValue = toFiniteNumber(item.value);

      if (n === null || sequenceValue === null) return null;

      return {
        n,
        value: sequenceValue,
      };
    })
    .filter(Boolean);

  const constructionSteps = normalizeArray(source.construction_steps || source.constructionSteps)
    .map((step, index) => {
      if (!step || typeof step !== "object") return null;

      const description = toText(
        step.description ||
          step.explanation ||
          step.text,
      ).trim();

      if (!description) return null;

      return {
        order: toFiniteNumber(step.order, index + 1),
        title:
          toText(step.title).trim() ||
          `المرحلة ${index + 1}`,
        description,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  const cobwebSegments = normalizeArray(source.cobweb_segments || source.cobwebSegments)
    .map((segment, index) => {
      if (!segment || typeof segment !== "object") return null;

      const from = normalizeGraphPoint(segment.from);
      const to = normalizeGraphPoint(segment.to);

      if (!from || !to) return null;

      return {
        order: toFiniteNumber(segment.order, index + 1),
        segmentType:
          segment.segment_type ||
          segment.segmentType ||
          "line",
        from,
        to,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  const xDomainSource = source.x_domain || source.xDomain || {};
  const yDomainSource = source.y_domain || source.yDomain || {};

  // لا نعتبر {} أو بيانات المحاور وحدها رسمًا صالحًا.
  // يجب وجود نقاط فعلية يمكن رسمها.
  const hasFunctionPoints = functions.some(
    (fn) => normalizeArray(fn.points).length >= 2,
  );
  const hasSequencePoints = sequenceValues.length >= 2;
  const hasCobwebSegments = cobwebSegments.length >= 1;

  if (
    !hasFunctionPoints &&
    !hasSequencePoints &&
    !hasCobwebSegments
  ) {
    return null;
  }

  return {
    graphType:
      source.graph_type ||
      source.graphType ||
      "function",
    title:
      source.title ||
      "التمثيل البياني",
    xLabel: source.x_label || source.xLabel || "x",
    yLabel: source.y_label || source.yLabel || "y",
    xDomain: {
      min: toFiniteNumber(xDomainSource.min),
      max: toFiniteNumber(xDomainSource.max),
      step: toFiniteNumber(xDomainSource.step),
    },
    yDomain: {
      min: toFiniteNumber(yDomainSource.min),
      max: toFiniteNumber(yDomainSource.max),
    },
    functions,
    sequenceValues,
    constructionSteps,
    cobwebSegments,
  };
}

function hasDrawableGraphData(graphData) {
  if (!graphData || typeof graphData !== "object") return false;

  const functionHasShape = normalizeArray(graphData.functions).some((fn) => {
    const points = normalizeArray(fn?.points).map(normalizeGraphPoint).filter(Boolean);
    if (points.length < 2) return false;
    const unique = new Set(points.map((p) => `${p.x.toFixed(10)}:${p.y.toFixed(10)}`));
    if (unique.size < 2) return false;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return Math.max(...xs) - Math.min(...xs) > 1e-9 || Math.max(...ys) - Math.min(...ys) > 1e-9;
  });

  const sequencePoints = normalizeArray(graphData.sequenceValues)
    .map((item) => ({ x: toFiniteNumber(item?.n), y: toFiniteNumber(item?.value) }))
    .filter((p) => p.x !== null && p.y !== null);
  const sequenceHasShape = sequencePoints.length >= 2 && new Set(sequencePoints.map((p) => `${p.x.toFixed(10)}:${p.y.toFixed(10)}`)).size >= 2;

  const cobwebHasShape = normalizeArray(graphData.cobwebSegments).some((segment) => {
    const from = normalizeGraphPoint(segment?.from);
    const to = normalizeGraphPoint(segment?.to);
    return Boolean(from && to && (Math.abs(from.x - to.x) > 1e-9 || Math.abs(from.y - to.y) > 1e-9));
  });

  return functionHasShape || sequenceHasShape || cobwebHasShape;
}

function normalizeExercise(item) {
  if (!item || typeof item !== "object") return null;

  const candidateGraphData = normalizeGraphData(
    item.graph_data ||
      item.graphData ||
      item.solution?.graph_data ||
      item.solution?.graphData,
  );

  const normalizedGraphData = hasDrawableGraphData(candidateGraphData)
    ? candidateGraphData
    : null;

  const storedAlternativeSource =
    item.simplified_solution ||
    item.alternative_solution ||
    item.second_solution ||
    normalizeArray(item.alternative_solutions)[0] ||
    item.solution?.simplified_solution ||
    item.solution?.alternative_solution ||
    item.solution?.second_solution ||
    null;

  const storedAlternative = normalizeSolutionPayload(
    storedAlternativeSource,
  );

  return {
    id: item.id,
    axisId: item.axis_id ?? item.axis?.id,
    axisTitle: item.axis_title ?? item.axis?.title,
    title:
      item.title ||
      "تمرين مشابه للبكالوريا بالذكاء الاصطناعي",
    question:
      item.question ||
      item.text ||
      item.statement ||
      "",
    skill: item.skill || "",
    hints: normalizeArray(
      item.hints ||
        item.solution?.hints,
    ),
    solutionSteps: normalizeArray(
      item.solution_steps ||
        item.steps ||
        item.solution?.steps,
    ).map(normalizeStep),
    finalAnswer:
      item.final_answer ||
      item.solution?.final_answer ||
      "",
    commonMistakes: normalizeArray(
      item.common_mistakes ||
        item.solution?.common_mistakes,
    ),
    verification:
      item.verification ||
      item.solution?.verification ||
      "",
    strategy:
      item.solution_strategy ||
      item.strategy ||
      item.solution?.strategy ||
      "",
    solutionExplanation:
      item.solution_explanation ||
      item.detailed_explanation ||
      item.solution?.detailed_explanation ||
      "",
    alternativeMethod:
      item.alternative_method ||
      item.solution?.alternative_method ||
      "",
    referenceQuestionIds: normalizeArray(
      item.reference_question_ids,
    ),
    alternativeSolution: hasSolutionContent(
      storedAlternative,
    )
      ? storedAlternative
      : null,
    graphData: normalizedGraphData,
    // حتى لو قال الخادم requires_graph=true، لا نعرض الرسم
    // إلا إذا كانت هناك نقاط فعلية صالحة.
    requiresGraph: Boolean(normalizedGraphData),
    modelName: item.model_name || item.model || "",
    createdAt: item.created_at || "",
  };
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function GeneratedAIExercises({
  axisId,
  data,
  apiBaseUrl = API_BASE_URL,
  alternativeSolutionEndpoint,
}) {
  const { token } = useContext(UserContext);

  const resolvedAxisId =
    axisId ??
    data?.axis?.id ??
    data?.axis_id ??
    data?.id ??
    null;

  const axis = data?.axis || data || null;

  const [exercises, setExercises] = useState([]);
  const [currentIndex, setCurrentIndex] =
    useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] =
    useState(false);
  const [error, setError] = useState("");

  const [showSolutionById, setShowSolutionById] =
    useState({});
  const [visibleHintsById, setVisibleHintsById] =
    useState({});
  const [
    alternativeSolutionsById,
    setAlternativeSolutionsById,
  ] = useState({});
  const [
    showAlternativeById,
    setShowAlternativeById,
  ] = useState({});
  const [
    loadingAlternativeId,
    setLoadingAlternativeId,
  ] = useState(null);
  const [
    alternativeErrorsById,
    setAlternativeErrorsById,
  ] = useState({});

  const currentExercise =
    exercises[currentIndex] || null;

  const currentKey =
    currentExercise?.id ?? currentIndex;

  const solutionVisible = Boolean(
    showSolutionById[currentKey],
  );

  const visibleHints = Number(
    visibleHintsById[currentKey] || 0,
  );

  const alternativeSolution =
    alternativeSolutionsById[currentKey] ||
    currentExercise?.alternativeSolution ||
    null;

  const alternativeVisible = Boolean(
    showAlternativeById[currentKey],
  );

  const alternativeLoading =
    loadingAlternativeId === currentKey;

  const alternativeError =
    alternativeErrorsById[currentKey] || "";

  const progress = useMemo(() => {
    if (exercises.length === 0) return 0;

    return (
      ((currentIndex + 1) / exercises.length) *
      100
    );
  }, [currentIndex, exercises.length]);

  useEffect(() => {
    setExercises([]);
    setCurrentIndex(0);
    setShowSolutionById({});
    setVisibleHintsById({});
    setAlternativeSolutionsById({});
    setShowAlternativeById({});
    setAlternativeErrorsById({});
    setLoadingAlternativeId(null);
    setError("");

    if (resolvedAxisId) {
      loadExercises();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedAxisId]);

  function getAlternativeSolutionEndpoint(
    exerciseId,
  ) {
    const normalizedId = Number(exerciseId);

    if (
      !Number.isInteger(normalizedId) ||
      normalizedId <= 0
    ) {
      return "";
    }

    if (
      typeof alternativeSolutionEndpoint ===
      "function"
    ) {
      return alternativeSolutionEndpoint(
        normalizedId,
      );
    }

    if (
      typeof alternativeSolutionEndpoint ===
      "string"
    ) {
      if (
        alternativeSolutionEndpoint.includes(
          "{exercise_id}",
        )
      ) {
        return alternativeSolutionEndpoint.replace(
          "{exercise_id}",
          String(normalizedId),
        );
      }

      const custom =
        alternativeSolutionEndpoint.replace(
          /\/+$/,
          "",
        );

      if (
        /\/exercises\/\d+\/alternative-solution$/.test(
          custom,
        )
      ) {
        return `${custom}/`;
      }
    }

    const base = apiBaseUrl.replace(/\/+$/, "");

    return `${base}/exercises/${normalizedId}/alternative-solution/`;
  }

  async function loadExercises() {
    if (!resolvedAxisId) return;

    if (!token) {
      setError(
        "يجب تسجيل الدخول لعرض التمارين المولدة.",
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await axios.get(
        `${apiBaseUrl}/axes/${resolvedAxisId}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 120000,
        },
      );

      const items = normalizeArray(
        response.data?.exercises,
      )
        .map(normalizeExercise)
        .filter(Boolean);

      setExercises(items);
      setCurrentIndex(0);

      const storedAlternatives = {};

      items.forEach((item, index) => {
        if (item.alternativeSolution) {
          storedAlternatives[item.id ?? index] =
            item.alternativeSolution;
        }
      });

      setAlternativeSolutionsById(
        storedAlternatives,
      );
    } catch (requestError) {
      console.error(
        "Generated exercises loading error:",
        requestError?.response?.data ||
          requestError,
      );

      setError(
        getErrorMessage(
          requestError,
          "حدث خطأ أثناء تحميل التمارين المولدة.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateExercise() {
    if (!resolvedAxisId || generating) return;

    if (!token) {
      setError(
        "يجب تسجيل الدخول لإنشاء تمرين جديد.",
      );
      return;
    }

    try {
      setGenerating(true);
      setError("");

      const response = await axios.post(
        `${apiBaseUrl}/generate/`,
        {
          axis_id: Number(resolvedAxisId),
          count: 1,
          save_to_database: true,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 180000,
        },
      );

      const generatedItems = normalizeArray(
        response.data?.exercises,
      )
        .map(normalizeExercise)
        .filter(Boolean);

      if (generatedItems.length === 0) {
        throw new Error(
          "الخادم لم يرجع تمرينًا صالحًا.",
        );
      }

      setExercises((previous) => {
        const generatedIds = new Set(
          generatedItems.map((item) => item.id),
        );

        const oldItems = previous.filter(
          (item) => !generatedIds.has(item.id),
        );

        return [...generatedItems, ...oldItems];
      });

      setCurrentIndex(0);

      const generatedKey =
        generatedItems[0].id ?? 0;

      setShowSolutionById((previous) => ({
        ...previous,
        [generatedKey]: false,
      }));

      setVisibleHintsById((previous) => ({
        ...previous,
        [generatedKey]: 0,
      }));
    } catch (requestError) {
      console.error(
        "Exercise generation error:",
        requestError?.response?.data ||
          requestError,
      );

      setError(
        getErrorMessage(
          requestError,
          "حدث خطأ أثناء إنشاء التمرين.",
        ),
      );
    } finally {
      setGenerating(false);
    }
  }

  function goPrevious() {
    setCurrentIndex((previous) =>
      Math.max(previous - 1, 0),
    );
  }

  function goNext() {
    setCurrentIndex((previous) =>
      Math.min(
        previous + 1,
        exercises.length - 1,
      ),
    );
  }

  function toggleSolution() {
    if (!currentExercise) return;

    setShowSolutionById((previous) => ({
      ...previous,
      [currentKey]: !previous[currentKey],
    }));
  }

  function revealNextHint() {
    if (!currentExercise) return;

    setVisibleHintsById((previous) => ({
      ...previous,
      [currentKey]: Math.min(
        Number(previous[currentKey] || 0) + 1,
        currentExercise.hints.length,
      ),
    }));
  }

  async function handleAlternativeSolution() {
    if (
      !currentExercise ||
      alternativeLoading
    ) {
      return;
    }

    if (alternativeSolution) {
      setShowAlternativeById((previous) => ({
        ...previous,
        [currentKey]: !previous[currentKey],
      }));
      return;
    }

    if (!token) {
      setAlternativeErrorsById((previous) => ({
        ...previous,
        [currentKey]:
          "يجب تسجيل الدخول لطلب حل أبسط.",
      }));
      return;
    }

    try {
      setLoadingAlternativeId(currentKey);

      setAlternativeErrorsById((previous) => {
        const next = { ...previous };
        delete next[currentKey];
        return next;
      });

      const exerciseId = Number(
        currentExercise.id,
      );

      if (
        !Number.isInteger(exerciseId) ||
        exerciseId <= 0
      ) {
        throw new Error(
          "لا يمكن طلب حل أبسط لأن التمرين غير محفوظ في قاعدة البيانات.",
        );
      }

      const endpoint =
        getAlternativeSolutionEndpoint(
          exerciseId,
        );

      const response = await axios.post(
        endpoint,
        {
          simplification_level: "very_simple",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 180000,
        },
      );

      const normalizedAlternative =
        normalizeSolutionPayload(response.data);

      if (
        !hasSolutionContent(
          normalizedAlternative,
        )
      ) {
        throw new Error(
          "الخادم لم يرجع حلًا مبسطًا صالحًا.",
        );
      }

      setAlternativeSolutionsById(
        (previous) => ({
          ...previous,
          [currentKey]:
            normalizedAlternative,
        }),
      );

      setShowAlternativeById((previous) => ({
        ...previous,
        [currentKey]: true,
      }));
    } catch (requestError) {
      console.error(
        "Simplified solution error:",
        requestError?.response?.data ||
          requestError,
      );

      setAlternativeErrorsById(
        (previous) => ({
          ...previous,
          [currentKey]: getErrorMessage(
            requestError,
            "تعذر إنشاء حل أبسط.",
          ),
        }),
      );
    } finally {
      setLoadingAlternativeId(null);
    }
  }

  if (!resolvedAxisId) {
    return (
      <EmptyState
        title="معرّف المحور غير موجود"
        description="مرّر axisId إلى المكوّن حتى يمكن جلب التمارين."
      />
    );
  }

  return (
    <MathJaxContext version={3} config={MATHJAX_CONFIG}>
      <section
      dir="rtl"
      className="min-h-full bg-slate-50 px-3 py-5 font-[Tajawal,Cairo,Arial,sans-serif] sm:px-6"
      style={{ unicodeBidi: "plaintext" }}
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <ExercisesHeader
          axis={axis}
          currentIndex={currentIndex}
          total={exercises.length}
          progress={progress}
        />

        <GeneratorControls
          generating={generating}
          loading={loading}
          onGenerate={generateExercise}
          onReload={loadExercises}
        />

        {error && (
          <ErrorMessage
            message={error}
            loading={loading || generating}
            onRetry={loadExercises}
          />
        )}

        {loading ? (
          <LoadingState />
        ) : !currentExercise ? (
          <EmptyExercises
            onGenerate={generateExercise}
            generating={generating}
          />
        ) : (
          <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <ExerciseNavigation
              currentIndex={currentIndex}
              total={exercises.length}
              onPrevious={goPrevious}
              onNext={goNext}
            />

            <div className="space-y-6 p-4 sm:p-6">
              <ExerciseQuestion
                exercise={currentExercise}
              />

              {currentExercise.hints.length >
                0 && (
                <HintsSection
                  hints={
                    currentExercise.hints
                  }
                  visibleCount={visibleHints}
                  onRevealNext={
                    revealNextHint
                  }
                />
              )}

              <button
                type="button"
                onClick={toggleSolution}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white transition hover:bg-emerald-700"
              >
                {solutionVisible ? (
                  <EyeOff size={21} />
                ) : (
                  <Eye size={21} />
                )}

                {solutionVisible
                  ? "إخفاء الحل"
                  : "عرض الحل المنظم"}
              </button>

              {solutionVisible && (
                <GeneratedSolution
                  exercise={
                    currentExercise
                  }
                  alternativeSolution={
                    alternativeSolution
                  }
                  alternativeVisible={
                    alternativeVisible
                  }
                  alternativeLoading={
                    alternativeLoading
                  }
                  alternativeError={
                    alternativeError
                  }
                  onAlternativeSolution={
                    handleAlternativeSolution
                  }
                />
              )}
            </div>
          </article>
        )}
      </div>
      </section>
    </MathJaxContext>
  );
}

function ExercisesHeader({
  axis,
  currentIndex,
  total,
  progress,
}) {
  return (
    <header className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">
      <div className="bg-gradient-to-l from-indigo-700 to-violet-700 px-5 py-6 text-white sm:px-7">
        <div
          dir="rtl"
          className="flex items-start gap-4"
        >
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-white/15 p-3">
            <Brain size={27} />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-indigo-100">
              تمارين مشابهة للبكالوريا
            </p>

            <h1 className="mt-1 text-2xl font-black leading-9">
              تمرين بكالوريا جديد مع حل مفصل
            </h1>

            {axis?.title && (
              <div className="mt-2 text-sm font-bold text-indigo-100">
                <SmartText>
                  {axis.title}
                </SmartText>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        dir="rtl"
        className="px-5 py-4 sm:px-7"
      >
        <div className="mb-2 flex items-center justify-between text-sm font-extrabold">
          <span className="text-slate-700">
            {total > 0
              ? `التمرين ${currentIndex + 1} من ${total}`
              : "لا توجد تمارين"}
          </span>

          <span className="text-indigo-700">
            {total > 0
              ? `${Math.round(progress)}%`
              : "0%"}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>
    </header>
  );
}

function GeneratorControls({
  generating,
  loading,
  onGenerate,
  onReload,
}) {
  return (
    <section
      dir="rtl"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <Sparkles size={21} />
          </div>

          <div>
            <h2 className="text-lg font-black text-slate-950">
              إنشاء تمرين مشابه للبكالوريا
            </h2>

            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
              يُنشأ التمرين تلقائيًا بالاعتماد على أسئلة البكالوريا
              الموجودة في هذا المحور، مع حل كامل ومفصل.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating || loading}
            className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3.5 font-black text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {generating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                جاري الإنشاء...
              </>
            ) : (
              <>
                <Plus size={20} />
                إنشاء تمرين بكالوريا
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onReload}
            disabled={loading || generating}
            className="flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3.5 font-black text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
          >
            <RefreshCcw
              size={20}
              className={loading ? "animate-spin" : ""}
            />
            تحديث
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <GenerationFeature
          title="أسلوب البكالوريا"
          description="يعتمد على أسئلة حقيقية من المحور نفسه."
        />
        <GenerationFeature
          title="حل كامل"
          description="استراتيجية، شرح، خطوات، جواب نهائي وتحقق."
        />
        <GenerationFeature
          title="دعم الرسم"
          description="يُعرض المنحنى أو مخطط السلم عند الحاجة."
        />
      </div>
    </section>
  );
}

function GenerationFeature({ title, description }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
      <CheckCircle2
        size={20}
        className="mt-0.5 shrink-0 text-emerald-700"
      />
      <div>
        <p className="font-black text-emerald-950">
          {title}
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-emerald-800">
          {description}
        </p>
      </div>
    </div>
  );
}

function ExerciseNavigation({
  currentIndex,
  total,
  onPrevious,
  onNext,
}) {
  return (
    <div
      dir="rtl"
      className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6"
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 disabled:opacity-40"
      >
        <ChevronRight size={18} />
        السابق
      </button>

      <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
        {currentIndex + 1} / {total}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex === total - 1}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 disabled:opacity-40"
      >
        التالي
        <ChevronLeft size={18} />
      </button>
    </div>
  );
}

function ExerciseQuestion({ exercise }) {
  return (
    <section className="space-y-4">
      <div
        dir="rtl"
        className="flex items-start gap-3"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
          <BookOpen size={24} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-indigo-600">
            تمرين مشابه للبكالوريا
          </p>

          <div className="mt-1 text-xl font-black text-slate-900">
            <SmartText>
              {exercise.title}
            </SmartText>
          </div>
        </div>
      </div>

      <div
        dir="rtl"
        className="flex flex-wrap gap-2"
      >
        <MetaBadge>
          مشابه لتمارين البكالوريا
        </MetaBadge>

        {exercise.skill && (
          <MetaBadge>
            {exercise.skill}
          </MetaBadge>
        )}

        {exercise.graphData && (
          <MetaBadge>
            تمرين بياني
          </MetaBadge>
        )}
      </div>

      <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-white">
        <div
          dir="rtl"
          className="flex items-center gap-3 border-b border-indigo-100 bg-indigo-50 px-5 py-4"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Target size={18} />
          </div>

          <div>
            <p className="text-xs font-bold text-indigo-500">
              Énoncé / نص التمرين
            </p>
            <h2 className="font-black text-indigo-900">
              اقرأ المطلوب جيدًا
            </h2>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <ExerciseStatement value={exercise.question} />
        </div>
      </section>

      {exercise.createdAt && (
        <p
          dir="ltr"
          className="text-left text-xs font-semibold text-slate-400"
        >
          {formatDate(exercise.createdAt)}
        </p>
      )}
    </section>
  );
}

function HintsSection({
  hints,
  visibleCount,
  onRevealNext,
}) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
      <div
        dir="rtl"
        className="mb-4 flex items-center gap-2 font-black text-amber-900"
      >
        <Lightbulb size={20} />
        تلميحات
      </div>

      <div className="space-y-3">
        {hints
          .slice(0, visibleCount)
          .map((hint, index) => (
            <div
              key={index}
              className="rounded-2xl border border-amber-200 bg-white p-4"
            >
              <p
                dir="rtl"
                className="mb-2 text-xs font-black text-amber-700"
              >
                التلميح {index + 1}
              </p>

              <SmartText className="font-semibold text-amber-950">
                {toText(hint)}
              </SmartText>
            </div>
          ))}

        {visibleCount < hints.length && (
          <button
            type="button"
            onClick={onRevealNext}
            dir="rtl"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-amber-600"
          >
            <Lightbulb size={17} />
            {visibleCount === 0
              ? "إظهار تلميح"
              : "التلميح التالي"}
          </button>
        )}
      </div>
    </section>
  );
}


function getGraphBounds(graphData) {
  const points = [
    ...normalizeArray(graphData?.functions).flatMap(
      (fn) => normalizeArray(fn.points),
    ),
    ...normalizeArray(graphData?.sequenceValues).map(
      (item) => ({
        x: item.n,
        y: item.value,
      }),
    ),
    ...normalizeArray(graphData?.cobwebSegments).flatMap(
      (segment) => [segment.from, segment.to],
    ),
  ].filter(Boolean);

  const xValues = points
    .map((point) => toFiniteNumber(point.x))
    .filter((value) => value !== null);

  const yValues = points
    .map((point) => toFiniteNumber(point.y))
    .filter((value) => value !== null);

  const explicitXMin = graphData?.xDomain?.min;
  const explicitXMax = graphData?.xDomain?.max;
  const explicitYMin = graphData?.yDomain?.min;
  const explicitYMax = graphData?.yDomain?.max;

  let xMin =
    explicitXMin ??
    (xValues.length ? Math.min(...xValues) : -5);

  let xMax =
    explicitXMax ??
    (xValues.length ? Math.max(...xValues) : 5);

  let yMin =
    explicitYMin ??
    (yValues.length ? Math.min(...yValues) : -5);

  let yMax =
    explicitYMax ??
    (yValues.length ? Math.max(...yValues) : 5);

  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }

  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  const xPadding = Math.max((xMax - xMin) * 0.08, 0.25);
  const yPadding = Math.max((yMax - yMin) * 0.08, 0.25);

  return {
    xMin: explicitXMin ?? xMin - xPadding,
    xMax: explicitXMax ?? xMax + xPadding,
    yMin: explicitYMin ?? yMin - yPadding,
    yMax: explicitYMax ?? yMax + yPadding,
  };
}

function buildTicks(min, max, count = 6) {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) return [];

  const rawStep = range / count;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / power;

  let multiplier = 1;
  if (normalized >= 5) multiplier = 5;
  else if (normalized >= 2) multiplier = 2;

  const step = multiplier * power;
  const first = Math.ceil(min / step) * step;
  const ticks = [];

  for (
    let value = first;
    value <= max + step * 0.001;
    value += step
  ) {
    ticks.push(Number(value.toFixed(10)));
  }

  return ticks.slice(0, 20);
}

function formatGraphNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.001 && value !== 0) {
    return value.toExponential(1);
  }

  return Number(value.toFixed(3)).toString();
}

function GraphLegend({ functions, showCobweb }) {
  return (
    <div
      dir="rtl"
      className="flex flex-wrap justify-center gap-3"
    >
      {functions.map((fn, index) => (
        <div
          key={fn.id || index}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700"
        >
          <span
            className={cn(
              "h-1 w-7 rounded-full",
              index % 3 === 0
                ? "bg-indigo-600"
                : index % 3 === 1
                  ? "bg-emerald-600"
                  : "bg-amber-500",
            )}
          />
          <span>{fn.label}</span>
        </div>
      ))}

      {showCobweb && (
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
          <span className="h-1 w-7 rounded-full bg-rose-500" />
          <span>مخطط السلم</span>
        </div>
      )}
    </div>
  );
}

function ExerciseGraph({ exercise }) {
  const graphData = exercise?.graphData;

  // لا نظهر أي بطاقة أو رسالة عندما يكون الرسم فارغًا.
  // normalizeGraphData يعيد null إذا لم توجد نقاط فعلية.
  if (!graphData || !hasDrawableGraphData(graphData)) return null;

  const width = 900;
  const height = 520;
  const margin = {
    top: 30,
    right: 35,
    bottom: 55,
    left: 70,
  };

  const bounds = getGraphBounds(graphData);
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const scaleX = (x) =>
    margin.left +
    ((x - bounds.xMin) /
      (bounds.xMax - bounds.xMin)) *
      plotWidth;

  const scaleY = (y) =>
    margin.top +
    ((bounds.yMax - y) /
      (bounds.yMax - bounds.yMin)) *
      plotHeight;

  const xTicks = buildTicks(bounds.xMin, bounds.xMax);
  const yTicks = buildTicks(bounds.yMin, bounds.yMax);

  const axisX =
    bounds.yMin <= 0 && bounds.yMax >= 0
      ? scaleY(0)
      : scaleY(bounds.yMin);

  const axisY =
    bounds.xMin <= 0 && bounds.xMax >= 0
      ? scaleX(0)
      : scaleX(bounds.xMin);

  const functionColors = [
    "#4f46e5",
    "#059669",
    "#d97706",
    "#7c3aed",
  ];

  const sequencePoints =
    graphData.graphType === "sequence"
      ? graphData.sequenceValues
      : [];

  return (
    <section className="overflow-hidden rounded-3xl border border-sky-200 bg-white">
      <div
        dir="rtl"
        className="flex items-center gap-3 border-b border-sky-100 bg-sky-50 px-5 py-4"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white">
          <Target size={20} />
        </div>

        <div>
          <p className="text-xs font-bold text-sky-600">
            Graphique / الرسم
          </p>
          <h3 className="font-black text-sky-950">
            <InlineRichText value={graphData.title} />
          </h3>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[700px] w-full"
            role="img"
            aria-label=<InlineRichText value={graphData.title} />
            dir="ltr"
            style={{ direction: "ltr", unicodeBidi: "isolate" }}
          >
            <rect
              x={margin.left}
              y={margin.top}
              width={plotWidth}
              height={plotHeight}
              fill="#ffffff"
              stroke="#cbd5e1"
            />

            {xTicks.map((tick) => (
              <g key={`x-grid-${tick}`}>
                <line
                  x1={scaleX(tick)}
                  y1={margin.top}
                  x2={scaleX(tick)}
                  y2={margin.top + plotHeight}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={scaleX(tick)}
                  y={margin.top + plotHeight + 24}
                  textAnchor="middle"
                  fontSize="13"
                  fill="#475569"
                >
                  {formatGraphNumber(tick)}
                </text>
              </g>
            ))}

            {yTicks.map((tick) => (
              <g key={`y-grid-${tick}`}>
                <line
                  x1={margin.left}
                  y1={scaleY(tick)}
                  x2={margin.left + plotWidth}
                  y2={scaleY(tick)}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={margin.left - 12}
                  y={scaleY(tick) + 4}
                  textAnchor="end"
                  fontSize="13"
                  fill="#475569"
                >
                  {formatGraphNumber(tick)}
                </text>
              </g>
            ))}

            <line
              x1={margin.left}
              y1={axisX}
              x2={margin.left + plotWidth}
              y2={axisX}
              stroke="#334155"
              strokeWidth="2"
            />

            <line
              x1={axisY}
              y1={margin.top}
              x2={axisY}
              y2={margin.top + plotHeight}
              stroke="#334155"
              strokeWidth="2"
            />

            <text
              x={margin.left + plotWidth - 5}
              y={axisX - 10}
              textAnchor="end"
              fontSize="16"
              fontWeight="700"
              fill="#0f172a"
            >
              {graphData.xLabel}
            </text>

            <text
              x={axisY + 12}
              y={margin.top + 18}
              fontSize="16"
              fontWeight="700"
              fill="#0f172a"
            >
              {graphData.yLabel}
            </text>

            {graphData.functions.map((fn, index) => {
              const points = fn.points
                .filter(
                  (point) =>
                    point.x >= bounds.xMin &&
                    point.x <= bounds.xMax &&
                    point.y >= bounds.yMin &&
                    point.y <= bounds.yMax,
                )
                .map(
                  (point) =>
                    `${scaleX(point.x)},${scaleY(point.y)}`,
                )
                .join(" ");

              if (!points) return null;

              return (
                <polyline
                  key={fn.id || index}
                  points={points}
                  fill="none"
                  stroke={
                    functionColors[
                      index % functionColors.length
                    ]
                  }
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            })}

            {sequencePoints.map((point, index) => (
              <g key={`sequence-${point.n}-${index}`}>
                <circle
                  cx={scaleX(point.n)}
                  cy={scaleY(point.value)}
                  r="5"
                  fill="#4f46e5"
                />
                <text
                  x={scaleX(point.n) + 7}
                  y={scaleY(point.value) - 8}
                  fontSize="12"
                  fill="#312e81"
                >
                  {`u${point.n}`}
                </text>
              </g>
            ))}

            {graphData.cobwebSegments.map(
              (segment, index) => (
                <line
                  key={`cobweb-${segment.order}-${index}`}
                  x1={scaleX(segment.from.x)}
                  y1={scaleY(segment.from.y)}
                  x2={scaleX(segment.to.x)}
                  y2={scaleY(segment.to.y)}
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                  strokeDasharray={
                    segment.segmentType === "line"
                      ? "5 4"
                      : undefined
                  }
                />
              ),
            )}
          </svg>
        </div>

        <GraphLegend
          functions={graphData.functions}
          showCobweb={
            graphData.cobwebSegments.length > 0
          }
        />

        {graphData.sequenceValues.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[520px] border-collapse text-center">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-100 px-4 py-3 font-black text-slate-800">
                    n
                  </th>
                  {graphData.sequenceValues.map(
                    (item, index) => (
                      <th
                        key={`n-${item.n}-${index}`}
                        className="border border-slate-200 bg-slate-50 px-4 py-3 font-black text-slate-800"
                      >
                        {item.n}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody>
                <tr>
                  <th className="border border-slate-200 bg-slate-100 px-4 py-3 font-black text-slate-800">
                    uₙ
                  </th>
                  {graphData.sequenceValues.map(
                    (item, index) => (
                      <td
                        key={`value-${item.n}-${index}`}
                        className="border border-slate-200 bg-white px-4 py-3 font-bold text-indigo-800"
                      >
                        {formatGraphNumber(item.value)}
                      </td>
                    ),
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {graphData.constructionSteps.length > 0 && (
          <section className="space-y-3">
            <div
              dir="rtl"
              className="flex items-center gap-2 font-black text-slate-950"
            >
              <Target size={19} className="text-sky-600" />
              خطوات بناء الرسم
            </div>

            {graphData.constructionSteps.map(
              (step, index) => (
                <div
                  key={`${step.order}-${index}`}
                  dir="rtl"
                  className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-black text-white">
                    {step.order || index + 1}
                  </span>

                  <div className="min-w-0">
                    <h4 className="font-black text-sky-950">
                      {step.title}
                    </h4>
                    <SmartText className="mt-1 font-semibold text-sky-900">
                      {step.description}
                    </SmartText>
                  </div>
                </div>
              ),
            )}
          </section>
        )}
      </div>
    </section>
  );
}


function GeneratedSolution({
  exercise,
  alternativeSolution,
  alternativeVisible,
  alternativeLoading,
  alternativeError,
  onAlternativeSolution,
}) {
  const hasAnySolution =
    exercise.solutionSteps.length > 0 ||
    hasValue(exercise.strategy) ||
    hasValue(exercise.finalAnswer) ||
    hasValue(exercise.verification) ||
    hasValue(exercise.solutionExplanation) ||
    exercise.commonMistakes.length > 0;

  if (!hasAnySolution) {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center font-bold text-slate-600"
      >
        لم يتم إنشاء حل لهذا التمرين.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white">
      <div
        dir="rtl"
        className="flex items-center gap-4 bg-emerald-700 px-5 py-5 text-white sm:px-6"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
          <CheckCircle2 size={26} />
        </div>

        <div>
          <p className="text-xs font-bold text-emerald-100">
            Solution / الحل
          </p>
          <h2 className="text-xl font-black">
            الحل خطوة بخطوة
          </h2>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {exercise.strategy && (
          <ContentCard
            title="فكرة الحل"
            subtitle="Méthode"
          >
            <SmartText className="font-semibold text-slate-800">
              {exercise.strategy}
            </SmartText>
          </ContentCard>
        )}

        {exercise.solutionExplanation && (
          <ContentCard
            title="الشرح المفصل"
            subtitle="Explication détaillée"
            tone="violet"
          >
            <SmartText className="font-semibold text-slate-800">
              {exercise.solutionExplanation}
            </SmartText>
          </ContentCard>
        )}

        {exercise.solutionSteps.length >
          0 && (
          <section className="space-y-4">
            {exercise.solutionSteps.map(
              (step, index) => (
                <SolutionStep
                  key={index}
                  step={step}
                  index={index}
                />
              ),
            )}
          </section>
        )}

        {exercise.requiresGraph &&
          hasDrawableGraphData(exercise.graphData) && (
            <ExerciseGraph exercise={exercise} />
          )}

        {exercise.finalAnswer && (
          <FinalAnswerCard
            value={exercise.finalAnswer}
          />
        )}

        {exercise.verification && (
          <ContentCard
            title="التحقق"
            subtitle="Vérification"
            tone="blue"
          >
            <SmartText className="font-semibold text-slate-800">
              {exercise.verification}
            </SmartText>
          </ContentCard>
        )}

        {exercise.commonMistakes.length > 0 && (
          <CommonMistakesCard
            mistakes={exercise.commonMistakes}
          />
        )}

        {exercise.alternativeMethod && (
          <ContentCard
            title="طريقة بديلة"
            subtitle="Méthode alternative"
            tone="violet"
          >
            <SmartText className="font-semibold text-violet-950">
              {exercise.alternativeMethod}
            </SmartText>
          </ContentCard>
        )}

        <section className="rounded-3xl border border-violet-200 bg-violet-50 p-4 sm:p-5">
          <div
            dir="rtl"
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
                <RefreshCcw size={20} />
              </div>

              <div>
                <h3 className="font-black text-violet-950">
                  لم تفهم الحل؟
                </h3>
                <p className="mt-1 text-sm font-semibold text-violet-700">
                  اطلب حلًا واحدًا أبسط وأكثر وضوحًا.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={
                onAlternativeSolution
              }
              disabled={
                alternativeLoading
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {alternativeLoading ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  جاري الإنشاء...
                </>
              ) : alternativeSolution ? (
                <>
                  {alternativeVisible ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                  {alternativeVisible
                    ? "إخفاء الحل الأبسط"
                    : "عرض الحل الأبسط"}
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  حل أبسط
                </>
              )}
            </button>
          </div>

          {alternativeError && (
            <div
              dir="rtl"
              className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />
              {alternativeError}
            </div>
          )}

          {alternativeSolution &&
            alternativeVisible && (
              <SimplifiedSolution
                solution={
                  alternativeSolution
                }
              />
            )}
        </section>
      </div>
    </section>
  );
}


function CommonMistakesCard({ mistakes }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-rose-200 bg-rose-50">
      <div
        dir="rtl"
        className="flex items-center gap-3 border-b border-rose-200 bg-rose-100 px-5 py-4 text-rose-950"
      >
        <AlertTriangle size={21} />
        <div>
          <p className="text-xs font-bold text-rose-600">
            Erreurs fréquentes
          </p>
          <h3 className="font-black">
            أخطاء شائعة يجب تجنبها
          </h3>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {normalizeArray(mistakes).map((item, index) => {
          const source =
            item && typeof item === "object"
              ? item
              : { mistake: toText(item) };

          return (
            <div
              key={`mistake-${index}`}
              dir="rtl"
              className="rounded-2xl border border-rose-200 bg-white p-4"
            >
              <p className="font-black text-rose-950">
                {index + 1}.{" "}
                <InlineRichText
                  value={
                    source.mistake ||
                    source.text ||
                    source.content
                  }
                />
              </p>

              {source.why_wrong && (
                <div className="mt-3 rounded-xl bg-rose-50 p-3">
                  <p className="mb-1 text-xs font-black text-rose-700">
                    لماذا هذا خطأ؟
                  </p>
                  <SmartText className="font-semibold text-rose-900">
                    {source.why_wrong}
                  </SmartText>
                </div>
              )}

              {source.correction && (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3">
                  <p className="mb-1 text-xs font-black text-emerald-700">
                    التصحيح
                  </p>
                  <SmartText className="font-semibold text-emerald-950">
                    {source.correction}
                  </SmartText>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SolutionStep({ step, index }) {
  const normalized = normalizeStep(
    step,
    index,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div
        dir="rtl"
        className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <SmartText className="font-black text-slate-900">
            {normalized.title}
          </SmartText>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {normalized.explanation && (
          <SmartText className="font-semibold text-slate-800">
            {normalized.explanation}
          </SmartText>
        )}

        {normalized.formula && (
          <MathBox>
            {normalized.formula}
          </MathBox>
        )}

        {normalized.result && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <SmartText className="font-bold text-emerald-950">
              {normalized.result}
            </SmartText>
          </div>
        )}
      </div>
    </section>
  );
}

function FinalAnswerCard({ value }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-300 bg-emerald-50">
      <div
        dir="rtl"
        className="flex items-center gap-3 bg-emerald-600 px-5 py-4 text-white"
      >
        <Trophy size={21} />

        <div>
          <p className="text-xs font-bold text-emerald-100">
            Résultat final
          </p>
          <h3 className="font-black">
            الجواب النهائي
          </h3>
        </div>
      </div>

      <div
        dir="rtl"
        className="p-5 text-right"
        style={{ direction: "rtl", unicodeBidi: "plaintext" }}
      >
        <SmartText className="text-lg font-black leading-9 text-emerald-950">
          {value}
        </SmartText>
      </div>
    </section>
  );
}

function SimplifiedSolution({ solution }) {
  return (
    <section className="mt-5 space-y-4 border-t border-violet-200 pt-5">
      <div
        dir="rtl"
        className="flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600 text-white">
          <GraduationCap size={21} />
        </div>

        <div>
          <p className="text-xs font-bold text-violet-600">
            Explication simple
          </p>
          <h3 className="font-black text-violet-950">
            {solution.title ||
              "الحل الأبسط"}
          </h3>
        </div>
      </div>

      {solution.strategy && (
        <ContentCard
          title="الفكرة ببساطة"
          subtitle="Idée"
          tone="violet"
        >
          <SmartText className="font-semibold text-violet-950">
            {solution.strategy}
          </SmartText>
        </ContentCard>
      )}

      {normalizeArray(solution.steps).map(
        (step, index) => (
          <SolutionStep
            key={index}
            step={step}
            index={index}
          />
        ),
      )}

      {solution.finalAnswer && (
        <FinalAnswerCard
          value={solution.finalAnswer}
        />
      )}

      {solution.verification && (
        <ContentCard
          title="التحقق"
          subtitle="Vérification"
          tone="blue"
        >
          <SmartText className="font-semibold text-slate-800">
            {solution.verification}
          </SmartText>
        </ContentCard>
      )}
    </section>
  );
}

function ContentCard({
  title,
  subtitle,
  tone = "slate",
  children,
}) {
  const styles = {
    slate:
      "border-slate-200 bg-slate-50 text-slate-900",
    blue:
      "border-blue-200 bg-blue-50 text-blue-950",
    rose:
      "border-rose-200 bg-rose-50 text-rose-950",
    violet:
      "border-violet-200 bg-violet-50 text-violet-950",
  };

  return (
    <section
      dir="rtl"
      className={cn(
        "rounded-2xl border p-4 text-right sm:p-5",
        styles[tone] || styles.slate,
      )}
      style={{ direction: "rtl", unicodeBidi: "plaintext" }}
    >
      <div
        dir="rtl"
        className="mb-3 flex items-baseline gap-2"
      >
        <h3 className="font-black">
          {title}
        </h3>

        {subtitle && (
          <span
            dir="ltr"
            className="text-xs font-bold opacity-60"
          >
            {subtitle}
          </span>
        )}
      </div>

      {children}
    </section>
  );
}

function MetaBadge({ children }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700">
      {children}
    </span>
  );
}

function ErrorMessage({
  message,
  loading,
  onRetry,
}) {
  return (
    <div
      dir="rtl"
      className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          size={21}
          className="mt-0.5 shrink-0 text-red-600"
        />

        <p className="font-bold text-red-900">
          {message}
        </p>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={loading}
        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      dir="rtl"
      className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8"
    >
      <Loader2
        size={38}
        className="animate-spin text-indigo-600"
      />
      <p className="mt-4 font-black text-slate-800">
        جاري تحميل التمارين...
      </p>
    </div>
  );
}

function EmptyExercises({
  onGenerate,
  generating,
}) {
  return (
    <div
      dir="rtl"
      className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"
    >
      <GraduationCap
        size={45}
        className="mx-auto text-indigo-600"
      />

      <h2 className="mt-4 text-xl font-black text-slate-900">
        لا توجد تمارين بعد
      </h2>

      <p className="mt-2 font-semibold text-slate-500">
        أنشئ أول تمرين لهذا المحور.
      </p>

      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white disabled:opacity-60"
      >
        {generating ? (
          <Loader2
            size={19}
            className="animate-spin"
          />
        ) : (
          <Plus size={19} />
        )}
        إنشاء تمرين
      </button>
    </div>
  );
}

function EmptyState({
  title,
  description,
}) {
  return (
    <div
      dir="rtl"
      className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center"
    >
      <AlertTriangle
        size={42}
        className="mx-auto text-amber-600"
      />

      <h2 className="mt-4 text-xl font-black text-amber-950">
        {title}
      </h2>

      <p className="mt-2 font-semibold text-amber-800">
        {description}
      </p>
    </div>);
}