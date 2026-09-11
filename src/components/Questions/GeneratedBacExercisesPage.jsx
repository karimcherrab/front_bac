import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  useRef,
} from "react";

import axios from "axios";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilePlus2,
  History,
  HelpCircle,
  Loader2,
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

const RAW_API_BASE_URL =
  import.meta.env.VITE_BASE_URL || "";

const API_BASE_URL =
  RAW_API_BASE_URL.replace(/\/+$/, "");

const GENERATED_BAC_BASE_URL =
  `${API_BASE_URL}/api/bac`;

const RAW_MEDIA_BASE_URL =
  import.meta.env.VITE_MEDIA_URL ||
  (API_BASE_URL
    ? `${API_BASE_URL}/media`
    : "/media");

const MEDIA_BASE_URL =
  RAW_MEDIA_BASE_URL.replace(/\/+$/, "");

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

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(String(value ?? ""));
}

function looksLikePureMath(value) {
  const text = String(value ?? "").trim();

  if (!text || containsArabic(text)) {
    return false;
  }

  return (
    /[=+\-*/^_<>]/.test(text) ||
    /\\(?:frac|dfrac|sqrt|times|cdot|text|mathrm|vec|Delta|sum|lim|sin|cos|tan)\b/.test(text) ||
    /\d/.test(text)
  );
}

/*
 * إصلاح أوامر LaTeX التي قد تصل من JSON/AI بدون backslash.
 *
 * أمثلة يتم إصلاحها:
 * v0cosalpha        -> v_0\cos\alpha
 * v0sinalpha        -> v_0\sin\alpha
 * 18.9times0.82     -> 18.9\times 0.82
 * approx1.94        -> \approx 1.94
 * tqquad            -> t\qquad
 * quady(t)          -> \quad y(t)
 *
 * aggressive=true يستعمل فقط داخل حقول latex المعروفة،
 * لذلك يمكننا إصلاح الأوامر بقوة أكبر دون لمس النص العربي.
 */
function repairMissingLatexCommands(
  value,
  aggressive = false,
) {
  let text = String(value ?? "");

  // أوامر تعرضت لتحويل \t إلى Tab حقيقي.
  text = text
    .replace(/\times/g, "\\times")
    .replace(/\text(?=\s*\{)/g, "\\text");

  // أوامر شائعة تصل بدون backslash.
  text = text
    .replace(/(?<!\\)times(?=\s*[-+]?\d|\s*[A-Za-z({])/g, "\\times ")
    .replace(/(?<!\\)approx(?=\s*[-+]?\d|\s*[A-Za-z({])/g, "\\approx ")
    .replace(/(?<!\\)Rightarrow\b/g, "\\Rightarrow ")
    .replace(/(?<!\\)Leftarrow\b/g, "\\Leftarrow ")
    .replace(/(?<!\\)Leftrightarrow\b/g, "\\Leftrightarrow ")
    .replace(/(?<!\\)rightarrow\b/g, "\\rightarrow ")
    .replace(/(?<!\\)leftarrow\b/g, "\\leftarrow ")
    .replace(/(?<!\\)qquad/g, "\\qquad ")
    .replace(/(?<!\\)quad(?=\s*[A-Za-z0-9\\({])/g, "\\quad ")
    .replace(/(?<!\\)cdot/g, "\\cdot ")
    .replace(/(?<!\\)sqrt(?=\s*\{)/g, "\\sqrt")
    .replace(/(?<!\\)frac(?=\s*\{)/g, "\\frac")
    .replace(/(?<!\\)\binfty\b/g, "\\infty")
    .replace(/(?<!\\)\bOmega\b/g, "\\Omega")
    .replace(/(?<!\\)\bmu\b/g, "\\mu")
    .replace(/(?<!\\)\bpi\b/g, "\\pi")
    .replace(/(?<!\\)\btext(?=\s*\{)/g, "\\text")
    .replace(/(?<!\\)\bmathrm(?=\s*\{)/g, "\\mathrm")
    .replace(/(?<=\d)mathrm(?=\s*\{)/g, "\\mathrm")
    .replace(/(?<=\d)text(?=\s*\{)/g, "\\mathrm");

  // صيغ مضغوطة شائعة يرسلها النموذج بدون backslash أو أقواس.
  // sin2alpha -> \sin(2\alpha)
  // cos2alpha -> \cos(2\alpha)
  // sin^2alpha -> \sin^2\alpha
  text = text
    .replace(
      /(?<!\\)\bsin\s*2\s*(?:alpha|α)\b/gi,
      "\\sin(2\\alpha)",
    )
    .replace(
      /(?<!\\)\bcos\s*2\s*(?:alpha|α)\b/gi,
      "\\cos(2\\alpha)",
    )
    .replace(
      /(?<!\\)\btan\s*2\s*(?:alpha|α)\b/gi,
      "\\tan(2\\alpha)",
    )
    .replace(
      /(?<!\\)\bsin\s*\^\s*\{?2\}?\s*(?:alpha|α)\b/gi,
      "\\sin^{2}\\alpha",
    )
    .replace(
      /(?<!\\)\bcos\s*\^\s*\{?2\}?\s*(?:alpha|α)\b/gi,
      "\\cos^{2}\\alpha",
    );

  // الدوال المثلثية مع alpha مكتوبة كنص.
  text = text
    .replace(/(?<!\\)cos\s*(?:alpha|α)\b/gi, "\\cos\\alpha")
    .replace(/(?<!\\)sin\s*(?:alpha|α)\b/gi, "\\sin\\alpha")
    .replace(/(?<!\\)tan\s*(?:alpha|α)\b/gi, "\\tan\\alpha")
    .replace(/(?<!\\)cos\s*(?:theta|θ)\b/gi, "\\cos\\theta")
    .replace(/(?<!\\)sin\s*(?:theta|θ)\b/gi, "\\sin\\theta")
    .replace(/(?<!\\)tan\s*(?:theta|θ)\b/gi, "\\tan\\theta");

  // الرموز اليونانية المكتوبة بالكلمات.
  if (aggressive) {
    text = text
      .replace(/(?<!\\)\balpha\b/gi, "\\alpha")
      .replace(/(?<!\\)\btheta\b/gi, "\\theta")
      .replace(/(?<!\\)\bbeta\b/gi, "\\beta")
      .replace(/(?<!\\)\bgamma\b/gi, "\\gamma")
      .replace(/(?<!\\)\bDelta\b/g, "\\Delta");
  }

  // الفهارس الأكثر شيوعًا في الفيزياء.
  text = text
    .replace(/\bv0\b/g, "v_0")
    .replace(/\bvA\b/g, "v_A")
    .replace(/\btA\b/g, "t_A")
    .replace(/\\infty\s*([0-9]+)/g, "\\infty,$1")
    .replace(/\\text\s*\{\s*([A-Za-zΩ]+)\s*\}/g, "\\mathrm{$1}")
    .replace(/;\s*(?=\\(?:Rightarrow|Leftarrow|Leftrightarrow|rightarrow|leftarrow))/g, "\\; ");

  // إزالة ; المستعملة أحيانًا كبديل للمسافة بين العدد والوحدة.
  if (aggressive) {
    text = text.replace(
      /([0-9}\]])\s*;\s*(?=(?:m|s|kg|g|N|J|Pa|V|A|mol|L)\b)/g,
      "$1\\,",
    );
  }

  // توحيد الفراغات حول بعض الأوامر.
  text = text
    .replace(/\s*\\times\s*/g, " \\times ")
    .replace(/\s*\\approx\s*/g, " \\approx ")
    .replace(/\s*\\cdot\s*/g, " \\cdot ")
    .replace(/\s*\\qquad\s*/g, " \\qquad ")
    .replace(/\s*\\quad\s*/g, " \\quad ");

  return text;
}


function repairUnitLabels(value) {
  return String(value ?? "")
    .replace(
      /([A-Za-z][A-Za-z0-9_{}]*)\s*\\?text\s*\{\s*\(\s*([A-Za-zΩ]+)\s*\)\s*\}/g,
      "$1\\,(\\mathrm{$2})",
    )
    .replace(
      /([A-Za-z][A-Za-z0-9_{}]*)\s*\\?mathrm\s*\{\s*\(\s*([A-Za-zΩ]+)\s*\)\s*\}/g,
      "$1\\,(\\mathrm{$2})",
    );
}

function repairCommonLatex(value) {
  let text = repairUnitLabels(
    repairMissingLatexCommands(
      String(value ?? ""),
      false,
    ),
  );

  text = text
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\u00a0/gi, " ")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\t(?=imes\b)/g, "\\t")
    .replace(/\t(?=ext\s*\{)/g, "\\t")
    .replace(/(^|[\s([{=,:;،])imes(?=\s*[-+]?\d|\s*\{)/g, "$1\\\\times")
    .replace(/(^|[\s([{=,:;،])ext(?=\s*\{)/g, "$1\\\\text")
    .replace(/\\+times\b/g, "\\times")
    .replace(/\\+text(?=\s*\{)/g, "\\text")
    .replace(/\\+mathrm(?=\s*\{)/g, "\\mathrm")
    .replace(/\\+frac(?=\s*\{)/g, "\\frac")
    .replace(/\\+dfrac(?=\s*\{)/g, "\\dfrac")
    .replace(/\\+sqrt(?=\s*\{)/g, "\\sqrt")
    .replace(/\\+cdot\b/g, "\\cdot")
    .replace(/\\+left\b/g, "\\left")
    .replace(/\\+right\b/g, "\\right")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/\\\(\s*\\\(/g, "\\(")
    .replace(/\\\)\s*\\\)/g, "\\)")
    .replace(/\\\[\s*\\\[/g, "\\[")
    .replace(/\\\]\s*\\\]/g, "\\]");

  // مهم: لا نقلب delimiters إذا كان ما بينهما نصًا عربيًا.
  // هذا هو السبب الذي كان يجعل الجملة العربية تدخل داخل MathJax.
  text = text.replace(
    /\\\)\s*([^\n]{1,220}?)\s*\\\(/g,
    (full, inner) =>
      looksLikePureMath(inner)
        ? `\\(${inner.trim()}\\)`
        : full,
  );

  text = text.replace(
    /\\\]\s*([^\n]{1,220}?)\s*\\\[/g,
    (full, inner) =>
      looksLikePureMath(inner)
        ? `\\[${inner.trim()}\\]`
        : full,
  );

  text = text.replace(
    /\\(?=[A-Za-z]\s*=)/g,
    "",
  );

  return text;
}

function protectMathBlocks(value) {
  const blocks = [];
  const pattern =
    /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^$\n]+?\$/g;

  const text = String(value ?? "").replace(
    pattern,
    (match) => {
      const token = `@@MATH_BLOCK_${blocks.length}@@`;
      blocks.push(match);
      return token;
    },
  );

  return {
    text,
    restore(result) {
      return blocks.reduce(
        (current, block, index) =>
          current.replace(
            `@@MATH_BLOCK_${index}@@`,
            block,
          ),
        result,
      );
    },
  };
}

function normalizeExplicitMathDelimiters(value) {
  return String(value ?? "")
    .replace(/\$\$([\s\S]*?)\$\$/g, "\\[$1\\]")
    .replace(
      /(^|[^$])\$([^$\n]+?)\$(?!\$)/g,
      "$1\\($2\\)",
    );
}

function cleanLooseExpression(expression) {
  return repairMissingLatexCommands(
    String(expression ?? ""),
    true,
  )
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\\infty\s*([0-9]+)/g, "\\infty,$1")
    .replace(/\\text\s*\{\s*([A-Za-zΩ]+)\s*\}/g, "\\mathrm{$1}")
    .replace(/\s*\\times\s*/g, " \\times ")
    .replace(/\s*\\div\s*/g, " \\div ")
    .replace(
      /(\d)\s+(?=(?:kg|g|mg|N|Pa|J|W|V|A|mH|H|mF|F|kΩ|Ω|m|cm|mm|s|ms|mol|L)\b)/g,
      "$1\\,",
    )
    .replace(/\s*,\s*/g, ",\\;");
}

function wrapLooseMathExpressions(value) {
  const protectedMath = protectMathBlocks(value);
  let text = protectedMath.text;

  /*
   * 1) المعادلات التي تبدأ برمز لاتيني.
   * نتوقف فور الوصول إلى حرف عربي حتى لا يدخل النص العربي في MathJax.
   * مثال:
   * m = 3.0 kg
   * H = 800 m
   * F_d = k v^{2}
   */
  text = text.replace(
    /(^|[\s:،؛(])([A-Za-zΣΔ][A-Za-z0-9ΣΔ_{}^\\]*(?:\([^\n)]*\))?\s*=\s*[^\u0600-\u06FF،؛.!؟\n]{1,180})(?=$|[\u0600-\u06FF،؛.!؟\n])/g,
    (full, prefix, expression) => {
      if (expression.includes("@@MATH_BLOCK_")) {
        return full;
      }

      const cleaned = cleanLooseExpression(
        expression,
      ).replace(/[،,:;\s]+$/g, "");

      return cleaned
        ? `${prefix}\\(${cleaned}\\)`
        : full;
    },
  );

  /*
   * 2) كميات عددية مع وحدة مكتوبة بـ LaTeX.
   * مثال: 0.85\,\text{kg/m}
   * هذا يمنع ظهور \\text{...} كنص خام.
   */
  text = text.replace(
    /(^|[\s:،؛(])([-+]?\d+(?:[.,]\d+)?(?:\s*\\times\s*10\^\{?[-+]?\d+\}?)?\s*(?:\\,\s*)?(?:\\text\s*\{[^{}\n]+\}|\\mathrm\s*\{[^{}\n]+\}))(?![^\n]*@@MATH_BLOCK_)/g,
    (full, prefix, expression) =>
      `${prefix}\\(${cleanLooseExpression(expression)}\\)`,
  );

  /*
   * 2.5) متتاليات/تيارات ذات فهارس معقدة ووحدات LaTeX.
   *
   * مثال شائع من تمارين الكهرباء:
   * I_{\infty 1}=0.12\text{ A}
   * I_{\infty 2}=0.14\text{ A}
   *
   * هذا النمط كان يبقى كنص خام عندما يأتي وسط جملة عربية.
   */
  text = text.replace(
    /(^|[\s:،؛(])((?:I|U|E|R|L|C|r|i|u)_(?:\{[^}\n]+\}|[A-Za-z0-9]+)\s*=\s*[-+]?\d+(?:[.,]\d+)?(?:\s*\\times\s*10\^\{?[-+]?\d+\}?)?(?:\s*\\,?\s*(?:\\text|\\mathrm)\s*\{[^{}\n]+\})?)(?=$|[\s،؛,).!؟])/g,
    (full, prefix, expression) =>
      `${prefix}\\(${cleanLooseExpression(
        repairMissingLatexCommands(expression, true),
      )}\\)`,
  );

  /*
   * 2.7) معادلات كهربائية قصيرة وسط العربية.
   *
   * أمثلة:
   * E = 12 V
   * R = 260 \Omega
   * L = 25 mH
   *
   * نتوقف عند الفاصلة أو العربية، لذلك يمكن وجود
   * أكثر من معادلة في نفس السطر.
   */
  text = text.replace(
    /(^|[\s:،؛,(])((?:E|R|L|C|r|I|U|i|u)(?:_\{[^}\n]+\})?\s*=\s*[-+]?\d+(?:[.,]\d+)?\s*(?:\\Omega|Ω|kΩ|mH|H|mF|F|V|A)?)(?=$|[\s،؛,).!؟\u0600-\u06FF])/g,
    (full, prefix, expression) => {
      if (
        expression.includes(
          "@@MATH_BLOCK_",
        )
      ) {
        return full;
      }

      const cleaned =
        cleanLooseExpression(expression);

      return cleaned
        ? `${prefix}\\(${cleaned}\\)`
        : full;
    },
  );

  /*
   * 3) كمية رقمية بوحدة عادية.
   * مثال: 800 m أو 9.81 m/s^{2} أو 29.43 N.
   */
  text = text.replace(
    /(^|[\s:،؛(=])([-+]?\d+(?:[.,]\d+)?\s*(?:kg|g|mg|N|Pa|J|W|V|A|mH|H|mF|F|kΩ|Ω|m|cm|mm|s|ms|mol|L)(?:\s*\/\s*(?:kg|g|N|m|s|mol|L))?(?:\^\{?-?\d+\}?)?)(?=$|[\s،؛).!؟])/g,
    (full, prefix, expression) =>
      `${prefix}\\(${cleanLooseExpression(expression)}\\)`,
  );


  /*
   * 3.5) أوامر LaTeX خام تصل داخل جملة عربية بدون delimiters.
   * أمثلة:
   * \displaystyle\lim_{x\to+\infty}\bigl(q(x)-(x-2)\bigr)=0
   * \lim_{x\to2^+}q(x)=+\infty
   * إذا تركناها كما هي ستظهر نصاً خاماً داخل الواجهة.
   */
  text = text.replace(
    /(^|[\s:،؛(])((?:\\displaystyle\s*)?(?:\\lim(?:_[^\s{]+|_\{[^}]+\})?[^\u0600-\u06FF:،؛!?\n]{0,170}?=[^\u0600-\u06FF:،؛!?\n]{1,80}|\\(?:frac|dfrac)\{[^\n]+?\}\{[^\n]+?\}|\\sqrt\{[^\n]+?\}|[A-Za-z]\([^\n]*?\)\s*=\s*[^\u0600-\u06FF:،؛!?\n]{1,80}))(?=$|[\s:،؛,.!؟\u0600-\u06FF\n])/g,
    (full, prefix, expression) => {
      if (expression.includes('@@MATH_BLOCK_')) {
        return full;
      }

      const cleaned = normalizeDisplayLatex(
        cleanLooseExpression(
          expression.replace(/^\\displaystyle\s*/, ''),
        ),
      );

      return cleaned
        ? `${prefix}\\(${cleaned}\\)`
        : full;
    },
  );

  /* 4) مشتقات ورموز بفهرس/أس فقط. */
  text = text.replace(
    /(^|[\s:،؛(])((?:d[A-Za-z]+\/d[A-Za-z]+)|(?:[A-Za-zΣΔ][A-Za-z0-9]*_(?:\{[^}]+\}|[A-Za-z0-9]+)(?:\^\{[^}]+\})?))(?=$|[\s،؛:).!؟])/g,
    (full, prefix, expression) =>
      `${prefix}\\(${expression.trim()}\\)`,
  );

  return protectedMath.restore(text);
}


/*
 * تنظيف كتل الرياضيات الصريحة قبل تمرير النص إلى MathJax.
 *
 * الهدف:
 * - إصلاح \( ... \) الصحيحة كل كتلة على حدة.
 * - عدم السماح لـ delimiter مكسور بابتلاع نص عربي.
 * - إصلاح infty / text / mathrm داخل الكتلة نفسها.
 */
function sanitizeExplicitMathBlocks(value) {
  let text = String(value ?? "");

  // توحيد بعض الأشكال المزدوجة التي قد تأتي من JSON.
  text = text
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]");

  // إصلاح كل inline math block صحيحة بشكل مستقل.
  text = text.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (full, inner) => {
      // إذا دخلت العربية داخل block، فهذه block غير سليمة.
      // نزيل delimiters ونترك النص للمعالج العادي.
      if (containsArabic(inner)) {
        return inner;
      }

      const repaired = normalizeDisplayLatex(inner);

      return repaired
        ? `\\(${repaired}\\)`
        : "";
    },
  );

  // إصلاح display math blocks بالطريقة نفسها.
  text = text.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (full, inner) => {
      if (containsArabic(inner)) {
        return inner;
      }

      const repaired = normalizeDisplayLatex(inner);

      return repaired
        ? `\\[${repaired}\\]`
        : "";
    },
  );

  /*
   * إذا بقي opening delimiter بدون closing delimiter
   * في نفس الجزء، نحذفه. هذا أفضل من ترك MathJax
   * يحاول تفسير بقية الجملة العربية كرياضيات.
   */
  const inlineOpenCount = (
    text.match(/\\\(/g) || []
  ).length;
  const inlineCloseCount = (
    text.match(/\\\)/g) || []
  ).length;

  if (inlineOpenCount !== inlineCloseCount) {
    text = text
      .replace(/\\\(/g, "")
      .replace(/\\\)/g, "");
  }

  const displayOpenCount = (
    text.match(/\\\[/g) || []
  ).length;
  const displayCloseCount = (
    text.match(/\\\]/g) || []
  ).length;

  if (displayOpenCount !== displayCloseCount) {
    text = text
      .replace(/\\\[/g, "")
      .replace(/\\\]/g, "");
  }

  return text;
}

/*
 * إصلاح خاص للسلاسل الفيزيائية/الكهربائية وسط النص العربي.
 *
 * أمثلة:
 * I_{\infty 1}=0.12\text{ A}
 * I_{\infty,2}=0.14mathrm{A}
 * I_infty3=0.13 A
 */
function normalizeElectricalInlineMath(value) {
  let text = String(value ?? "");

  // أوامر قد تصل بدون backslash.
  text = text
    .replace(
      /(?<!\\)\bmathrm\s*\{([^{}\n]+)\}/g,
      "\\mathrm{$1}",
    )
    .replace(
      /(?<!\\)\btext\s*\{([^{}\n]+)\}/g,
      "\\mathrm{$1}",
    )
    .replace(
      /(?<!\\)\binfty\b/g,
      "\\infty",
    );

  // توحيد I_{\infty 1} / I_{\infty1} إلى I_{\infty,1}
  text = text.replace(
    /\b([IU])_\{\s*\\?infty\s*,?\s*([0-9]+)\s*\}/g,
    "$1_{\\infty,$2}",
  );

  text = text.replace(
    /\b([IU])_\\?infty\s*,?\s*([0-9]+)/g,
    "$1_{\\infty,$2}",
  );

  // I_infty1
  text = text.replace(
    /\b([IU])_?infty\s*,?\s*([0-9]+)/gi,
    "$1_{\\infty,$2}",
  );

  /*
   * نلتقط كل قيمة تيار مستقرة بمفردها،
   * ولا نسمح للـ regex بالوصول إلى العربية.
   */
  text = text.replace(
    /(^|[\s:،؛;(])((?:I|U)_\{\\infty,\d+\}\s*=\s*[-+]?\d+(?:[.,]\d+)?\s*(?:(?:\\mathrm|\\text)\s*\{[A-Za-zΩ]+\}|[AV]))(?=$|[\s،؛;,.!؟)])/g,
    (full, prefix, expression) => {
      const repaired = normalizeDisplayLatex(
        expression,
      );

      return repaired
        ? `${prefix}\\(${repaired}\\)`
        : full;
    },
  );

  return text;
}


/*
 * تنظيف آمن للسطر المختلط عربي + رياضيات.
 *
 * الفكرة:
 * - لا نسمح أبداً لـ \( أو \text{...} المكسورة بابتلاع النص العربي.
 * - \text{نص عربي} يتحول إلى نص عربي عادي.
 * - الوحدات فقط تبقى داخل MathJax.
 * - كل سطر يُعالج وحده حتى لا يفسد سطر بقية المحتوى.
 */

/*
 * إصلاح نهائي لصيغ التيار المستمر في النص المختلط.
 *
 * يقبل أشكالاً مكسورة مثل:
 * \(I_{\infty,1}=0\,12\mathrm{A}\)
 * I_{\infty,2}=0\14mathrm{A}
 * I∞3=0.13A
 */

/*
 * إصلاح قوي ونهائي لسلاسل التيار المستقر المكسورة.
 *
 * هذا المعالج لا يعتمد على delimiters الأصلية، لأن النموذج قد يعيد:
 *
 * \(I_{\infty,1} = 0\,12\)\mathrm{A}
 * \(I_{\infty,2} = 0.14\)\mathrm{A}
 * I_{\infty,3} = 0.13mathrm{A}
 *
 * أو يضع \mathrm{A} خارج \( ... \).
 *
 * النتيجة دائماً:
 * \(I_{\infty,1}=0.12\,\mathrm{A}\)
 */
function rebuildSteadyCurrentMath(value) {
  let text = String(value ?? "");

  /*
   * أولاً نحول delimiters إلى مسافات مؤقتاً.
   * هذا يسمح للـ regex برؤية التعبير كاملاً حتى لو
   * كانت \mathrm{A} خارج \( ... \).
   */
  text = text
    .replace(/\\\(/g, " ")
    .replace(/\\\)/g, " ")
    .replace(/\\\[/g, " ")
    .replace(/\\\]/g, " ")
    .replace(/\$\$/g, " ")
    .replace(/\$/g, " ")
    .replace(/\\n+/g, " ");

  // توحيد infty.
  text = text
    .replace(/\\+infty\b/g, "\\infty")
    .replace(/(?<!\\)\binfty\b/g, "\\infty")
    .replace(
      /([IU])_\{\s*\\infty\s*,?\s*(\d+)\s*\}/g,
      "$1_{\\infty,$2}",
    );

  /*
   * توحيد وحدة A/V حتى لو وصلت:
   * mathrm{A}
   * \mathrm{A}
   * text{A}
   * \text{A}
   */
  text = text
    .replace(
      /\\?(?:mathrm|text)\s*\{\s*([AV])\s*\}/g,
      " $1 ",
    );

  /*
   * القيمة العشرية قد تصل:
   * 0\,12
   * 0\;12
   * 0\12
   * 0,12
   */
  text = text
    .replace(
      /(\d)\s*\\[,;:!]\s*(\d{1,3})/g,
      "$1.$2",
    )
    .replace(
      /(\d)\\(\d{1,3})/g,
      "$1.$2",
    );

  /*
   * نعيد بناء كل I_{\infty,n}=value A ككتلة MathJax مستقلة.
   * وجود العربية قبل/بعد التعبير لا يهم.
   */
  text = text.replace(
    /(?:\\?[,;]\s*)?((?:I|U)_\{\\infty,\d+\})\s*=\s*(\d+(?:[.,]\d+)?)\s*([AV])?/g,
    (full, variable, number, unit) => {
      const normalizedNumber =
        String(number).replace(",", ".");

      const normalizedUnit =
        unit || (
          variable.startsWith("I")
            ? "A"
            : "V"
        );

      return (
        `\\(${variable}=${normalizedNumber}` +
        `\\,\\mathrm{${normalizedUnit}}\\)`
      );
    },
  );

  /*
   * إذا بقيت وحدة A/V وحيدة بعد block بسبب رد شديد التلف:
   * \(I...=0.12\) A
   * تصبح الوحدة مكررة خارج block. نحذفها.
   */
  text = text.replace(
    /(\\\((?:I|U)_\{\\infty,\d+\}=[^)]*\\mathrm\{[AV]\}\\\))\s*(?:\\?mathrm\s*\{\s*[AV]\s*\}|[AV])\b/g,
    "$1",
  );

  return text
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function repairSteadyCurrentExpressions(value) {
  let text = rebuildSteadyCurrentMath(value);

  /*
   * تنظيف بقايا أوامر الوحدات التي لا تنتمي لأي تعبير.
   * لا نحذف \mathrm داخل block صحيح.
   */
  text = text
    .replace(
      /(?<!\\)\b(?:mathrm|text)\s*\{\s*([AV])\s*\}/g,
      "$1",
    )
    .replace(
      /\\(?:mathrm|text)\s*\{\s*([AV])\s*\}(?![^\\]*\\\))/g,
      "$1",
    );

  return text;
}

function normalizeMixedArabicMathLine(value) {
  let line = repairSteadyCurrentExpressions(
    String(value ?? ""),
  );

  if (!line.trim()) {
    return "";
  }

  // 1) \text{نص عربي} لا يجب أن يبقى أمراً رياضياً.
  line = line.replace(
    /\\text\s*\{([^{}\n]*[\u0600-\u06FF][^{}\n]*)\}/g,
    "$1",
  );

  // نفس الشيء إذا وصل text بدون backslash.
  line = line.replace(
    /(?<!\\)\btext\s*\{([^{}\n]*[\u0600-\u06FF][^{}\n]*)\}/g,
    "$1",
  );

  /*
   * إذا كان السطر يحتوي العربية، نحذف delimiters الصريحة.
   * wrapLooseMathExpressions سيعيد تغليف المعادلات فقط.
   *
   * هذا يمنع حالات مثل:
   * \(R = 260\Omega ... نص عربي ...
   * من جعل MathJax يفسر السطر كله كرياضيات.
   */
  if (containsArabic(line)) {
    /*
     * نحمي كتل الرياضيات الصحيحة التي أعاد بناءها
     * rebuildSteadyCurrentMath قبل تنظيف delimiters المكسورة.
     */
    const protectedBlocks = [];

    line = line.replace(
      /\\\([^()\n]*\\\)/g,
      (match) => {
        const token =
          `@@SAFE_INLINE_${protectedBlocks.length}@@`;

        protectedBlocks.push(match);
        return token;
      },
    );

    line = line
      .replace(/\\\(/g, "")
      .replace(/\\\)/g, "")
      .replace(/\\\[/g, "")
      .replace(/\\\]/g, "")
      .replace(/\$\$/g, "")
      .replace(/\$/g, "");

    line = protectedBlocks.reduce(
      (current, block, index) =>
        current.replace(
          `@@SAFE_INLINE_${index}@@`,
          block,
        ),
      line,
    );
  }

  // 2) إصلاح أوامر شائعة، لكن بدون تحويل العربية.
  line = repairMissingLatexCommands(
    line,
    false,
  );

  // 3) إصلاح رموز الفيزياء الشائعة المكتوبة خارج math.
  line = line
    .replace(/(?<!\\)\bOmega\b/g, "\\Omega")
    .replace(/(?<!\\)\binfty\b/g, "\\infty")
    .replace(/(?<!\\)\bapprox\b/g, "\\approx")
    .replace(/(?<!\\)\btimes\b/g, "\\times");

  /*
   * 4) تصحيح الصيغ التي تصل بالشكل:
   * E = \12V
   * I = 0\12A
   * أي backslash قبل الجزء العشري.
   */
  line = line.replace(
    /(\d)\\(\d)/g,
    "$1.$2",
  );

  /*
   * 5) إضافة مسافة رياضية للوحدات الملتصقة بالعدد.
   * لا نغلفها هنا؛ سيتم ذلك لاحقاً.
   */
  line = line.replace(
    /(\d)(?=(?:V|A|mH|H|mF|F|kΩ|Ω|ohm|N|J|W|Pa|kg|g|m|s)\b)/g,
    "$1 ",
  );

  // 6) التيار النهائي: I_{\infty 1} => I_{\infty,1}
  line = line
    .replace(
      /([IU])_\{\s*\\?infty\s*,?\s*(\d+)\s*\}/g,
      "$1_{\\infty,$2}",
    )
    .replace(
      /([IU])_\\?infty\s*,?\s*(\d+)/g,
      "$1_{\\infty,$2}",
    );

  /*
   * 7) text/mathrm للوحدات فقط.
   * text{A} -> \mathrm{A}
   * mathrm{A} -> \mathrm{A}
   */
  line = line
    .replace(
      /(?<!\\)\b(?:text|mathrm)\s*\{\s*(mH|mF|ms|A|V|N|J|W|Pa|Hz|kg|g|m|s|mol|L|Ω)\s*\}/g,
      "\\mathrm{$1}",
    )
    .replace(
      /\\text\s*\{\s*(mH|mF|ms|A|V|N|J|W|Pa|Hz|kg|g|m|s|mol|L|Ω)\s*\}/g,
      "\\mathrm{$1}",
    )
    /*
     * حالات مثل:
     * L = 25mathrm{mH}
     * I = 0.12mathrm{A}
     */
    .replace(
      /(\d(?:[.,]\d+)?)\s*\\?mathrm\s*\{\s*(mH|mF|ms|A|V|N|J|W|Pa|Hz|kg|g|m|s|mol|L|Ω)\s*\}/g,
      "$1 $2",
    );

  /*
   * بعض الاستجابات تصل هكذا: \R أو \L أو \E.
   * هذه ليست أوامر LaTeX، لذلك نحذف backslash فقط.
   */
  line = line
    .replace(/\\(?=(?:E|R|L|C|r|I|U|i|u)\b)/g, "")
    .replace(/\\;/g, " ")
    .replace(/\\,/g, " ");

  /*
   * تحويل المعادلات الكهربائية القصيرة إلى كتل MathJax مستقلة.
   * هذا يمنع ظهور \Omega أو mH كنص خام وسط العربية.
   */
  line = line.replace(
    /(^|[\s:،؛;,(])((?:E|R|L|C|r|I|U|i|u)(?:_\{[^}\n]+\})?\s*=\s*[-+]?\d+(?:[.,]\d+)?\s*(?:\\Omega|Ω|kΩ|mH|H|mF|F|V|A)?)(?=$|[\s،؛;,.!؟)\u0600-\u06FF])/g,
    (full, prefix, expression) => {
      const cleaned = normalizeDisplayLatex(
        normalizeShortMathValue(expression),
      );

      return cleaned
        ? `${prefix}\\(${cleaned}\\)`
        : full;
    },
  );

  /*
   * التيارات النهائية قد تصل في نفس السطر بهذا الشكل:
   * I_{\infty,1}=0.12mathrm{A}
   */
  line = line.replace(
    /(^|[\s:،؛;,(])((?:I|U)_\{\\infty,\d+\}\s*=\s*[-+]?\d+(?:[.,]\d+)?\s*(?:A|V|\\?mathrm\s*\{[AV]\})?)(?=$|[\s،؛;,.!؟)\u0600-\u06FF])/g,
    (full, prefix, expression) => {
      const cleaned = normalizeDisplayLatex(
        normalizeShortMathValue(expression),
      );

      return cleaned
        ? `${prefix}\\(${cleaned}\\)`
        : full;
    },
  );

  /*
   * إزالة أي \mathrm{A}/\mathrm{V} بقيت كنص خام
   * خارج block رياضي بسبب رد غير متوازن.
   */
  line = line
    .replace(
      /(^|[\s،؛,])\\?mathrm\s*\{\s*([AV])\s*\}(?=$|[\s،؛,.])/g,
      "$1$2",
    )
    .replace(
      /(^|[\s،؛,])mathrm\s*\{\s*([AV])\s*\}(?=$|[\s،؛,.])/g,
      "$1$2",
    );

  return line;
}

function normalizeMathTextLine(value) {
  let line = normalizeMixedArabicMathLine(value);

  if (!line.trim()) {
    return "";
  }

  /*
   * سطر رياضي خالص:
   * نحافظ على delimiters ونصلحها بشكل طبيعي.
   */
  if (!containsArabic(line)) {
    line = sanitizeExplicitMathBlocks(line);
    line = normalizeExplicitMathDelimiters(line);
    line = wrapLooseMathExpressions(line);
    return line;
  }

  /*
   * سطر مختلط:
   * لا نستعمل sanitizeExplicitMathBlocks لأنه قد يضم العربية.
   * نغلف فقط التعبيرات الرياضية المكتشفة.
   */
  line = normalizeElectricalInlineMath(line);
  line = wrapLooseMathExpressions(line);

  return line;
}

function legacyNormalizeMathText(value) {
  const source = repairCommonLatex(value)
    .replace(
      /\\begin\{tabular\}\{[^}]*\}[\s\S]*?\\end\{tabular\}/g,
      "",
    );

  /*
   * نعالج كل سطر وحده.
   * هذا أهم تغيير في v8:
   * أي delimiter مكسور في سطر لن يستطيع إفساد بقية النص.
   */
  return String(source ?? "")
    .split("\n")
    .map((line) =>
      normalizeMathTextLine(line),
    )
    .join("\n");
}


function normalizeKnownMathCommands(value) {
  let text = String(value ?? "");

  text = text
    // حالات تحولت فيها \t إلى tab فعلي.
    .replace(/\t(?=imes\b)/g, "\\t")
    .replace(/\t(?=ext\s*\{)/g, "\\t")

    // توحيد الأوامر التي تحتوي backslash واحدًا أو أكثر.
    .replace(/\\+times\b/g, "\\times")
    .replace(/\\+approx\b/g, "\\approx")
    .replace(/\\+infty\b/g, "\\infty")
    .replace(/\\+Omega\b/g, "\\Omega")
    .replace(/\\+mathrm(?=\s*\{)/g, "\\mathrm")
    .replace(/\\+text(?=\s*\{)/g, "\\text")
    .replace(/\\+frac(?=\s*\{)/g, "\\frac")
    .replace(/\\+dfrac(?=\s*\{)/g, "\\dfrac")
    .replace(/\\+sqrt(?=\s*\{)/g, "\\sqrt")
    .replace(/\\+displaystyle\b/g, "\\displaystyle")

    // أحيانًا يعيد النموذج الأمر بدون backslash أصلًا.
    .replace(/(?<!\\)\bdisplaystyle\b/g, "\\displaystyle")
    .replace(/(?<!\\)\bfrac(?=\s*\{)/g, "\\frac")
    .replace(/(?<!\\)\bdfrac(?=\s*\{)/g, "\\dfrac")
    .replace(/(?<!\\)\bsqrt(?=\s*\{)/g, "\\sqrt")
    .replace(/(?<!\\)\btext(?=\s*\{)/g, "\\text")
    .replace(/(?<!\\)\bmathrm(?=\s*\{)/g, "\\mathrm")
    .replace(/(?<!\\)\bapprox\b/g, "\\approx")
    .replace(/(?<!\\)\btimes\b/g, "\\times")
    .replace(/(?<!\\)\binfty\b/g, "\\infty")
    .replace(/(?<!\\)\bOmega\b/g, "\\Omega");

  return text;
}

function normalizeFormulaBody(value) {
  let text = normalizeKnownMathCommands(value)
    .replace(/\r\n?/g, " ")
    .replace(/\\n+/g, " ")
    .replace(/\n+/g, " ")
    .replace(/−/g, "-")
    .replace(/∞/g, "\\infty")
    .trim();

  if (!text) {
    return "";
  }

  text = text
    .replace(/^\\\[/, "")
    .replace(/\\\]$/, "")
    .replace(/^\\\(/, "")
    .replace(/\\\)$/, "")
    .replace(/^\$\$/, "")
    .replace(/\$\$$/, "")
    .replace(/^\$/, "")
    .replace(/\$$/, "")
    .trim();

  /*
   * إصلاح الرموز التي يعيدها الـ AI كثيرًا بدون backslash.
   * أهم نقطة هنا هي infinity لأن كتابتها كنص داخل RTL كانت
   * تقلب [0,+infty) بصريًا إلى شكل غير مفهوم.
   */
  text = text
    .replace(/(?<!\\)\binfinity\b/gi, "\\infty")
    .replace(/(?<!\\)\binfty\b/gi, "\\infty")
    .replace(/\\infty\s*\+/g, "+\\infty")
    .replace(/\\infty\s*-/g, "-\\infty")
    .replace(/(?<!\\)\btau\b/g, "\\tau")
    .replace(/(?<!\\)\bOmega\b/g, "\\Omega")
    .replace(/(?<!\\)\bapprox\b/g, "\\approx")
    .replace(/(?<!\\)\btimes\b/g, "\\times")
    .replace(/(?<!\\)\bRightarrow\b/g, "\\Rightarrow")
    .replace(/(?<!\\)\bLeftarrow\b/g, "\\Leftarrow")
    .replace(/(?<!\\)\bLeftrightarrow\b/g, "\\Leftrightarrow")
    .replace(/(?<!\\)\bforall\b/g, "\\forall")
    .replace(/(?<!\\)\bexists\b/g, "\\exists")
    .replace(/(?<!\\)\bgeq\b/g, "\\geq")
    .replace(/(?<!\\)\bleq\b/g, "\\leq")
    .replace(/(?<!\\)\bneq\b/g, "\\neq")
    .replace(/(?<!\\)\bdownarrow\b/g, "\\downarrow")
    .replace(/(?<!\\)\buparrow\b/g, "\\uparrow")
    .replace(/(?<!\\)\btoinfty\b/g, "\\to\\infty")
    .replace(/(?<!\\)\bttoinfty\b/g, "t\\to\\infty")
    .replace(/(?<!\\)\bln\b/g, "\\ln");

  text = text
    .replace(/\bv0\b/g, "v_0")
    .replace(/\bU0\b/g, "U_0")
    .replace(/\buC\b/g, "u_C")
    .replace(/\\tau(?=[A-Za-z])/g, "\\tau ");

  text = text.replace(
    /(\d+(?:\.\d+)?)\s*(ms|mH|mF|kg|mol|Pa|Hz|A|V|N|J|W|H|F|g|m|s|L)\b/g,
    "$1\\,\\mathrm{$2}",
  );

  return text
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExplicitMathBlocks(value) {
  let text = normalizeKnownMathCommands(value)
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n");

  text = text.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (_, inner) =>
      `\\[${normalizeFormulaBody(inner)}\\]`,
  );

  text = text.replace(
    /(^|[^$])\$([^$\n]+?)\$(?!\$)/g,
    (_, prefix, inner) =>
      `${prefix}\\(${normalizeFormulaBody(inner)}\\)`,
  );

  text = text.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_, inner) =>
      `\\(${normalizeFormulaBody(inner)}\\)`,
  );

  text = text.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_, inner) =>
      `\\[${normalizeFormulaBody(inner)}\\]`,
  );

  return text;
}

function extractSteadyCurrentValues(value) {
  let source = String(value ?? "")
    .replace(/\\\\+/g, "\\")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, " ")
    .replace(/\$\$/g, " ")
    .replace(/\$/g, " ")
    .replace(/\\n+/g, " ")
    .replace(
      /\\?(?:mathrm|text)\s*\{\s*A\s*\}/g,
      " A ",
    )
    .replace(/\\?infty\b/g, "infty")
    .replace(
      /(\d)\s*\\[,;]\s*(\d{1,3})/g,
      "$1.$2",
    )
    .replace(
      /(\d)\\(\d{1,3})/g,
      "$1.$2",
    );

  const values = [];
  const pattern =
    /I_\{\s*infty\s*,?\s*(\d+)\s*\}\s*=\s*(\d+(?:[.,]\d+)?)/gi;

  let match;

  while ((match = pattern.exec(source))) {
    values.push({
      index: Number(match[1]),
      value: String(match[2]).replace(",", "."),
    });
  }

  const map = new Map();

  values.forEach((item) => {
    map.set(item.index, item);
  });

  return [...map.values()].sort(
    (a, b) => a.index - b.index,
  );
}

function protectExplicitMath(value) {
  const blocks = [];

  const text = String(value ?? "").replace(
    /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g,
    (match) => {
      const token =
        `@@SAFE_MATH_${blocks.length}@@`;

      blocks.push(match);

      return token;
    },
  );

  return {
    text,
    restore(result) {
      return blocks.reduce(
        (current, block, index) =>
          current.replace(
            `@@SAFE_MATH_${index}@@`,
            block,
          ),
        result,
      );
    },
  };
}

function wrapOnlyClearBareEquations(value) {
  const protectedMath = protectExplicitMath(value);
  let text = protectedMath.text;

  /*
   * نغلف فقط المعادلات الواضحة جدًا.
   * لا نحاول تفسير الجملة العربية كلها.
   */
  text = text.replace(
    /(^|[\s:،؛(])([A-Za-z][A-Za-z0-9_{}]*(?:\([^()\n]*\))?\s*=\s*[^\u0600-\u06FF،؛.!؟\n]{1,160})(?=$|[\u0600-\u06FF،؛.!؟\n])/g,
    (full, prefix, expression) => {
      if (
        expression.includes(
          "@@SAFE_MATH_",
        )
      ) {
        return full;
      }

      const cleaned =
        normalizeFormulaBody(
          expression.replace(
            /[\s,;:]+$/g,
            "",
          ),
        );

      return cleaned
        ? `${prefix}\\(${cleaned}\\)`
        : full;
    },
  );

  return protectedMath.restore(text);
}


function wrapClearLatexRuns(value) {
  const protectedMath = protectExplicitMath(value);
  let text = protectedMath.text;

  /*
   * يلتقط سلاسل LaTeX الصريحة التي يرسلها الـ AI أحياناً
   * داخل جملة عربية بدون $...$ أو \\( ... \\).
   * مثال:
   * \\displaystyle\\lim_{x\\to+\\infty}(q(x)-(x-2))=0
   */
  text = text.replace(
    /(^|[\s:،؛;(])((?:\\(?:displaystyle|lim|dfrac|frac|sqrt|sum|prod|int|ln|log|exp|sin|cos|tan|arctan|big|Big|left|right|infty|to|pm|mp|times|cdot|approx|leq|geq|neq)[^\u0600-\u06FF\n]{1,520}))(?=$|[\u0600-\u06FF\n])/g,
    (full, prefix, expression) => {
      if (expression.includes('@@SAFE_MATH_')) {
        return full;
      }

      const cleaned = normalizeFormulaBody(
        expression
          .replace(/[،؛;,.!?؟\s]+$/g, '')
          .trim(),
      );

      return cleaned
        ? `${prefix}\\(${cleaned}\\)`
        : full;
    },
  );

  return protectedMath.restore(text);
}

/*
 * أوامر \\text{...} تكون صحيحة داخل كتلة MathJax، لكن النموذج
 * يرسلها أحيانًا خارج أي delimiters. في هذه الحالة يجب تحويلها
 * إلى نص عادي بدل عرض "\\text" حرفيًا في الواجهة.
 */
function unwrapLooseTextCommands(value) {
  const protectedMath = protectExplicitMath(
    String(value ?? ""),
  );

  let text = protectedMath.text;

  text = text
    .replace(
      /\\?text\s*\{([^{}\n]*)\}/g,
      "$1",
    )
    .replace(
      /(?<!\\)\btext\s*\{([^{}\n]*)\}/g,
      "$1",
    );

  return protectedMath.restore(text);
}

/*
 * تغليف المجالات الرياضية القصيرة مثل:
 * [0,+infty) ، (-infty,-2) ، ]-2,0]
 * حتى لا يفسد اتجاه RTL ترتيب الأقواس والإشارات.
 */
function wrapClearIntervalFragments(value) {
  const protectedMath = protectExplicitMath(value);
  let text = protectedMath.text;

  const endpoint =
    String.raw`(?:[-+]?\\?infty|[-+]?∞|[-+]?\d+(?:[.,]\d+)?(?:\\?frac\{[^{}]+\}\{[^{}]+\})?|[-+]?\\?frac\{[^{}]+\}\{[^{}]+\})`;

  const intervalPattern = new RegExp(
    String.raw`([\[(\]]\s*${endpoint}\s*,\s*${endpoint}\s*[\])\[])`,
    "g",
  );

  text = text.replace(
    intervalPattern,
    (full) => `\\(${normalizeFormulaBody(full)}\\)`,
  );

  return protectedMath.restore(text);
}

/*
 * المعادلات/المتراجحات داخل جملة عربية لا تبدأ دائمًا بشكل x=...
 * فقد تكون g'(x)>0 أو f'(x)=2-frac{...}. النسخة السابقة لم تكن
 * تلتقط prime ونتيجة ذلك ظهور \\frac و \\ge كنص خام.
 */
function wrapClearComparisonExpressions(value) {
  const protectedMath = protectExplicitMath(value);
  let text = protectedMath.text;

  text = text.replace(
    /(^|[\s:،؛;(])((?:[A-Za-z](?:\s*(?:['′]|\\prime))?\s*(?:\([^()\n]*\))?|[A-Za-z][A-Za-z0-9_{}\\^]*)(?:\s*(?:=|<|>|≤|≥|\\leq?|\\geq?|\\neq)\s*)[^\u0600-\u06FF،؛.!؟\n]{1,300})(?=$|[\u0600-\u06FF،؛.!؟\n])/g,
    (full, prefix, expression) => {
      if (expression.includes("@@SAFE_MATH_")) {
        return full;
      }

      const cleaned = normalizeFormulaBody(
        expression
          .replace(/[،؛;,.!?؟\s]+$/g, "")
          .trim(),
      );

      const trailingSpace = /\s$/.test(expression) ? " " : "";

      return cleaned
        ? `${prefix}\\(${cleaned}\\)${trailingSpace}`
        : full;
    },
  );

  return protectedMath.restore(text);
}

function looksLikeArabicAdjacentMath(value) {
  const text = String(value ?? "").trim();
  if (!text || containsArabic(text)) {
    return false;
  }

  return (
    /\\(?:frac|dfrac|sqrt|lim|to|infty|geq?|leq?|neq|forall|exists|times|cdot|ln|log|exp|sin|cos|tan)\b/.test(text) ||
    /[=<>≤≥^_]/.test(text) ||
    /[A-Za-z]\s*(?:['′]|\([^)]*\))/.test(text) ||
    (/[+\-*/]/.test(text) && /[A-Za-z0-9]/.test(text))
  );
}

/*
 * يعزل كل جزيرة رياضية واقعة بين كلمات عربية. هذا يعالج تحديدًا أسطرًا مثل:
 * لـ x\ge0 يكون (x+2)^2\ge4، وبالتالي \frac{5}{...}\le...
 *
 * إبقاء هذه الأجزاء كنص خام داخل RTL هو ما كان يقلب ترتيبها في الصورة.
 */
function wrapArabicAdjacentMathRuns(value) {
  const source = String(value ?? "");
  if (!containsArabic(source)) {
    return source;
  }

  const protectedMath = protectExplicitMath(source);
  const parts = protectedMath.text.split(/([\u0600-\u06FF]+)/u);

  const wrapped = parts.map((part) => {
    if (
      !part ||
      containsArabic(part) ||
      part.includes("@@SAFE_MATH_")
    ) {
      return part;
    }

    const match = part.match(/^([\s،؛:]*)((?:.|\n)*?)([\s،؛:.!?؟]*)$/u);
    if (!match) {
      return part;
    }

    const [, prefix, rawCore, suffix] = match;
    const core = rawCore.trim();

    if (!looksLikeArabicAdjacentMath(core)) {
      return part;
    }

    const latex = normalizeFormulaBody(core);
    return latex
      ? `${prefix}\\(${latex}\\)${suffix}`
      : part;
  }).join("");

  return protectedMath.restore(wrapped);
}

function containsNaturalLanguageMath(value) {
  const raw = String(value ?? "");

  return (
    containsArabic(raw) ||
    /\\begin\{(?:tabular|array)\}/.test(raw) ||
    /\\?text\s*\{[^{}]*[A-Za-z\u0600-\u06FF][^{}]*\}/.test(raw) ||
    /\b(?:increasing|decreasing|increase|decrease|on|when|therefore|thus|hence|croissante|décroissante|decroissante|sur|donc)\b/i.test(raw)
  );
}

function normalizeMathText(value) {
  // Explicit formulas from the new backend are authoritative: never repair their algebra.
  if (typeof value === "string" && /\$[^$]+\$/.test(value)) return value;

  /*
   * 1) نفصل \\text{...} الحر عن LaTeX.
   * 2) نصلح الأوامر المعروفة.
   * 3) نغلف فقط الأجزاء الرياضية المؤكدة، لا الجملة العربية كلها.
   */
  let text = unwrapLooseTextCommands(
    String(value ?? ""),
  );

  text = normalizeExplicitMathBlocks(text);
  text = wrapOnlyClearBareEquations(text);
  text = wrapClearComparisonExpressions(text);
  text = wrapClearIntervalFragments(text);
  text = wrapClearLatexRuns(text);

  const protectedMath =
    protectExplicitMath(text);

  let plain = protectedMath.text;

  /* x\\to+\\infty / t\\to-\\infty داخل الجملة العربية. */
  plain = plain.replace(
    /(^|[\s:،؛(])([A-Za-z]\s*(?:\\to|to)\s*[-+]?\s*(?:\\infty|infty))(?=$|[\s،؛).!؟])/g,
    (full, prefix, expression) =>
      `${prefix}\\(${normalizeFormulaBody(expression)}\\)`,
  );

  plain = plain.replace(
    /(^|[\s:،؛(])((?:\\?tau|tau)\s*(?:\\?approx|approx|≈)\s*\d+(?:\.\d+)?\s*(?:ms|s)?)(?=$|[\s،؛).!؟])/g,
    (full, prefix, expression) =>
      `${prefix}\\(${normalizeFormulaBody(expression)}\\)`,
  );

  plain = plain.replace(
    /(^|[\s:،؛(])(U_0|u_C(?:\(t\))?|\\tau)(?=$|[\s،؛:).!؟])/g,
    (full, prefix, expression) =>
      `${prefix}\\(${normalizeFormulaBody(expression)}\\)`,
  );

  return wrapArabicAdjacentMathRuns(
    protectedMath.restore(plain),
  );
}

function normalizeDisplayLatex(value) {
  return normalizeFormulaBody(value);
}

function InlineFormula({
  value,
  className = "",
}) {
  const latex = normalizeFormulaBody(value);

  if (!latex) {
    return null;
  }

  return (
    <MathJax dynamic hideUntilTypeset="first">
      <span
        dir="ltr"
        className={cn(
          "inline-block max-w-full",
          className,
        )}
        style={{
          direction: "ltr",
          unicodeBidi: "isolate",
        }}
      >
        {`\\(${latex}\\)`}
      </span>
    </MathJax>
  );
}

function MathResult({
  value,
  className = "",
}) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  /*
   * النتيجة قد تكون جملة مثل:
   * g decreasing on (-infty,-2) and [0,2]
   * لا يجوز إرسال الجملة كاملة إلى MathJax. RichMathText يعزل
   * الرياضيات فقط ويحافظ على النص والاتجاه الصحيحين.
   */
  if (containsNaturalLanguageMath(raw)) {
    return (
      <RichMathText
        className={cn(
          "text-center",
          className,
        )}
        dir={containsArabic(raw) ? "rtl" : "ltr"}
      >
        {raw}
      </RichMathText>
    );
  }

  const latex = normalizeDisplayLatex(raw);

  if (!latex) {
    return null;
  }

  return (
    <div
      dir="ltr"
      className={cn(
        `
          min-w-0 overflow-x-auto
          py-1 text-center
        `,
        className,
      )}
      style={{
        direction: "ltr",
        unicodeBidi: "isolate",
      }}
    >
      <MathJax dynamic hideUntilTypeset="first">
        <div
          dir="ltr"
          className="min-w-max px-2"
          style={{
            direction: "ltr",
            unicodeBidi: "isolate",
          }}
        >
          {`\\[${latex}\\]`}
        </div>
      </MathJax>
    </div>
  );
}

function FormulaBlock({
  value,
  className = "",
}) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  /*
   * مهم جدًا:
   * حقل latex قد يصل أحيانًا وفيه شرح عربي مع صيغة رياضية.
   * تمرير السطر كاملًا داخل \[...\] يجعل MathJax يحاول تفسير العربية
   * كأوامر LaTeX، وهذا هو سبب النص المشوّه الظاهر بجانب المعادلة.
   * في السطر المختلط نترك MathText يعزل الرياضيات عن العربية بأمان.
   */
  if (containsArabic(raw)) {
    return (
      <div
        dir="rtl"
        className={cn(
          `
            mt-3 min-w-0 overflow-hidden
            rounded-xl border border-slate-200
            bg-slate-50 px-4 py-4
          `,
          className,
        )}
      >
        <RichMathText
          className="text-center font-semibold leading-9 text-slate-800"
          dir="rtl"
        >
          {raw}
        </RichMathText>
      </div>
    );
  }

  const latex = normalizeDisplayLatex(raw);

  if (!latex) {
    return null;
  }

  return (
    <div
      dir="ltr"
      className={cn(
        `
          mt-3 min-w-0 overflow-x-auto
          rounded-xl border border-slate-200
          bg-slate-50 px-4 py-4
          text-center
        `,
        className,
      )}
    >
      <MathJax dynamic hideUntilTypeset="first">
        <div
          dir="ltr"
          style={{
            direction: "ltr",
            unicodeBidi: "isolate",
          }}
        >
          {`\\[${latex}\\]`}
        </div>
      </MathJax>
    </div>
  );
}

function normalizeShortMathValue(value) {
  return normalizeFormulaBody(
    String(value ?? "")
      .replace(/\\hline/g, "")
      .replace(/\\n+/g, " ")
      .replace(/\\\\$/g, "")
      .trim(),
  );
}

function ShortMathValue({
  value,
  className = "",
}) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  if (containsArabic(raw)) {
    return (
      <MathText
        dir="rtl"
        className={className}
      >
        {raw}
      </MathText>
    );
  }

  return (
    <InlineFormula
      value={normalizeShortMathValue(raw)}
      className={className}
    />
  );
}

function stripLatexCell(value) {
  return String(value ?? "")
    .replace(/\\hline/g, "")
    .replace(/\\n+/g, " ")
    .replace(/\\\\$/g, "")
    .trim();
}

function parseLatexTabular(value) {
  const source = String(value ?? "");
  const tables = [];

  const cleanedText = source.replace(
    /\\begin\{(tabular|array)\}\{([^}]*)\}([\s\S]*?)\\end\{\1\}/g,
    (full, environment, alignment, body) => {
      const rows = String(body ?? "")
        .replace(/\\hline/g, "")
        .split(/\\\\/)
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) =>
          row
            .split("&")
            .map((cell) =>
              stripLatexCell(cell),
            ),
        )
        .filter(
          (row) => row.length > 0,
        );

      if (rows.length > 0) {
        tables.push({
          id: `latex-table-${tables.length}`,
          rows,
          alignment: String(
            alignment ?? "",
          ),
        });
      }

      return "\n";
    },
  );

  return {
    text: cleanedText,
    tables,
  };
}


function variationFromLatexRows(rows, contextText = "") {
  const normalizedRows = asArray(rows)
    .map((row) => asArray(row).map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.length >= 2);

  if (normalizedRows.length < 2) {
    return null;
  }

  /*
   * الشكل الذي يرجعه مولد الحل غالبًا ليس صفوف x/f'/f الكلاسيكية، بل:
   *
   * الفترة | x | f(x)
   * I1     | a -> b | u ↓ v
   * I2     | b -> c | v ↑ w
   *
   * أو الشكل العمودي:
   * x | g(x)
   * 0 | 5/2
   * ↑ | ↑
   * +∞ | +∞
   *
   * نحوله أولًا إلى النموذج الموحد حتى يصل إلى VariationTable بدل
   * أن يظهر كجدول HTML/MathJax عادي.
   */
  const convertedHeaderTable = variationFromGenericDataTable({
    id: "latex-final-answer-variation",
    type: "variation_table",
    title: "جدول التغيّرات",
    columns: normalizedRows[0],
    rows: normalizedRows.slice(1),
  });

  if (convertedHeaderTable) {
    return convertedHeaderTable;
  }

  const normalizeLabel = (value) =>
    stripMathDelimiters(value)
      .replace(/\s+/g, "")
      .replace(/\left|\right/g, "")
      .toLowerCase();

  const xRow = normalizedRows.find((row) => {
    const label = normalizeLabel(row[0]);
    return label === "x" || label === "t";
  });

  if (!xRow) {
    return null;
  }

  const derivativeRow = normalizedRows.find((row) => {
    const label = normalizeLabel(row[0]);
    return (
      /['′]/.test(label) ||
      /\\prime/.test(label) ||
      /d[a-z]+\/d[a-z]+/.test(label)
    );
  });

  const functionRow = normalizedRows.find((row) => {
    if (row === xRow || row === derivativeRow) {
      return false;
    }

    const label = normalizeLabel(row[0]);
    return (
      /[a-z]+\(x\)/i.test(label) ||
      /[a-z]+\(t\)/i.test(label) ||
      label === "f(x)" ||
      label === "p(x)"
    );
  });

  if (!functionRow) {
    return null;
  }

  const pointLabels = xRow.slice(1).filter(hasText);
  if (pointLabels.length < 2) {
    return null;
  }

  const functionValues = functionRow.slice(1);
  const derivativeCells = derivativeRow ? derivativeRow.slice(1) : [];
  const nonZeroSigns = derivativeCells
    .map(normalizeVariationSign)
    .filter((value) => value === "+" || value === "-");

  const context = String(contextText ?? "");
  const contextDirection = /متزايد|متزايدة|تزايد|croissant|croissante/i.test(context)
    ? "up"
    : /متناقص|متناقصة|تناقص|décroissant|decroissant/i.test(context)
      ? "down"
      : "";

  const points = pointLabels.map((x, index) => ({
    id: `legacy-point-${index}`,
    x,
    derivative:
      normalizeVariationSign(derivativeCells[index]) === "0"
        ? "0"
        : "",
    value: functionValues[index] ?? "",
    excluded: false,
  }));

  const intervals = Array.from(
    { length: pointLabels.length - 1 },
    (_, index) => {
      const sign = nonZeroSigns[index] || (
        contextDirection === "up"
          ? "+"
          : contextDirection === "down"
            ? "-"
            : ""
      );

      return {
        id: `legacy-interval-${index}`,
        sign,
        direction:
          sign === "+"
            ? "up"
            : sign === "-"
              ? "down"
              : contextDirection || "constant",
      };
    },
  );

  const functionLabel = functionRow[0] || "f(x)";
  const derivativeLabel = derivativeRow?.[0] || (
    functionLabel.includes("(x)")
      ? functionLabel.replace("(x)", "'(x)")
      : "f'(x)"
  );

  return {
    type: "variation_table",
    id: "legacy-latex-variation",
    title: "جدول التغيّرات",
    variable_label: xRow[0] || "x",
    derivative_label: derivativeLabel,
    function_label: functionLabel,
    show_derivative: Boolean(derivativeRow),
    points,
    intervals,
  };
}

function LatexTable({
  table,
  contextText = "",
}) {
  const rows = asArray(table?.rows);

  if (rows.length === 0) {
    return null;
  }

  const variation = variationFromLatexRows(
    rows,
    contextText,
  );

  if (variation) {
    return <VariationTable table={variation} />;
  }

  const maxColumns = Math.max(
    1,
    ...rows.map(
      (row) => asArray(row).length,
    ),
  );

  return (
    <div
      className="
        my-4 overflow-hidden
        rounded-xl border
        border-slate-200 bg-white
      "
    >
      <div className="overflow-x-auto">
        <table
          dir="rtl"
          className="
            w-full border-collapse
            text-center text-sm
            sm:text-base
          "
        >
          <tbody>
            {rows.map(
              (row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={
                    rowIndex === 0
                      ? "bg-slate-100 font-black"
                      : rowIndex % 2 === 0
                        ? "bg-slate-50/70"
                        : "bg-white"
                  }
                >
                  {Array.from(
                    {
                      length:
                        maxColumns,
                    },
                    (_, cellIndex) => (
                      <td
                        key={
                          cellIndex
                        }
                        className="
                          border
                          border-slate-200
                          px-4 py-3
                          align-middle
                        "
                      >
                        <ShortMathValue
                          value={
                            asArray(
                              row,
                            )[
                              cellIndex
                            ] ?? "—"
                          }
                          className="
                            text-center
                            font-semibold
                            text-slate-900
                          "
                        />
                      </td>
                    ),
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StableCurrentLine({
  value,
  className = "",
}) {
  const values =
    extractSteadyCurrentValues(value);

  if (values.length === 0) {
    return null;
  }

  return (
    <div
      dir="rtl"
      className={cn(
        `
          flex flex-wrap
          items-center gap-x-2
          gap-y-2 text-right
        `,
        className,
      )}
    >
      <span>
        التيار المستقر المقاس في كل تجربة:
      </span>

      {values.map(
        (item, index) => (
          <span
            key={item.index}
            className="
              inline-flex items-center
              gap-2
            "
          >
            {index > 0 && (
              <span
                className="
                  text-slate-400
                "
              >
                ،
              </span>
            )}

            <InlineFormula
              value={
                `I_{\\infty,${item.index}}=` +
                `${item.value}\\,\\mathrm{A}`
              }
            />
          </span>
        ),
      )}
    </div>
  );
}

function MathText({
  children,
  className = "",
  dir = "rtl",
}) {
  const raw = String(
    children ?? "",
  );

  if (!raw.trim()) {
    return null;
  }

  const currents =
    extractSteadyCurrentValues(raw);

  if (
    currents.length > 0 &&
    (
      raw.includes("التيار") ||
      raw.includes("المستقر") ||
      currents.length >= 2
    )
  ) {
    return (
      <StableCurrentLine
        value={raw}
        className={className}
      />
    );
  }

  const content =
    normalizeMathText(raw);

  return (
    <MathJax
      dynamic
      hideUntilTypeset="first"
    >
      <div
        dir={dir}
        className={cn(
          `
            math-content
            whitespace-pre-wrap
            break-words
          `,
          dir === "rtl"
            ? "text-right"
            : "text-left",
          className,
        )}
        style={{
          direction: dir,
          unicodeBidi: "isolate",
          overflowWrap: "anywhere",
        }}
      >
        {content}
      </div>
    </MathJax>
  );
}

function RichMathText({
  children,
  className = "",
  dir = "rtl",
}) {
  const parsed =
    parseLatexTabular(children);

  const plainText = String(
    parsed.text ?? "",
  ).trim();

  const hasConvertedVariationTable = parsed.tables.some(
    (table) =>
      Boolean(
        variationFromLatexRows(
          table?.rows,
          plainText,
        ),
      ),
  );

  // لا نكرر "جدول التغيّر:" فوق عنوان الجدول المصمم نفسه.
  const visiblePlainText = hasConvertedVariationTable
    ? plainText.replace(
        /^\s*جدول\s*(?:التغيّر|التغير|التغيّرات|التغيرات)\s*[:：]?\s*$/u,
        "",
      )
    : plainText;

  const blocks = splitRichTextBlocks(
    visiblePlainText,
  );

  return (
    <>
      {blocks.map((block, index) =>
        block.type === "formula" ? (
          <FormulaBlock
            key={`formula-${index}`}
            value={block.value}
            className="mt-0"
          />
        ) : (
          <MathText
            key={`text-${index}`}
            className={className}
            dir={dir}
          >
            {block.value}
          </MathText>
        ),
      )}

      {parsed.tables.map(
        (table) => (
          <LatexTable
            key={table.id}
            table={table}
            contextText={plainText}
          />
        ),
      )}
    </>
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

  if (error?.response?.status === 429) {
    return (
      error?.response?.data?.detail ||
      "خدمة التوليد مشغولة مؤقتًا. أعد المحاولة بعد قليل."
    );
  }

  if (error?.response?.status === 422) {
    const detail = String(
      error?.response?.data?.detail || "",
    );

    // لا نعرض أخطاء parser/مزود طويلة للتلميذ. الـbackend V3 يصلحها
    // تلقائيًا، وهذا fallback مفيد إذا كان الخادم ما زال على نسخة أقدم.
    if (
      /json_validate_failed|failed_generation|expecting ['",]|json الناتج|jsondecodeerror/i.test(
        detail,
      )
    ) {
      return (
        "تعذر إكمال الإخراج المنظم للحل. " +
        "أعد المحاولة؛ التمرين وبياناتك محفوظة."
      );
    }

    return (
      detail ||
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

function getRetryAfterSeconds(error) {
  const dataValue = Number(
    error?.response?.data?.retry_after,
  );

  if (Number.isFinite(dataValue) && dataValue > 0) {
    return Math.ceil(dataValue);
  }

  const rawHeader =
    error?.response?.headers?.["retry-after"] ??
    error?.response?.headers?.["Retry-After"];
  const headerValue = Number(rawHeader);

  if (Number.isFinite(headerValue) && headerValue > 0) {
    return Math.ceil(headerValue);
  }

  return error?.response?.status === 429 ? 8 : 0;
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


function replaceLatexFractions(source) {
  let text = String(source ?? '');

  const findGroup = (value, start) => {
    if (value[start] !== '{') {
      return null;
    }

    let depth = 0;
    for (let index = start; index < value.length; index += 1) {
      if (value[index] === '{') depth += 1;
      if (value[index] === '}') depth -= 1;
      if (depth === 0) {
        return {
          content: value.slice(start + 1, index),
          end: index,
        };
      }
    }
    return null;
  };

  for (let guard = 0; guard < 20; guard += 1) {
    const index = text.search(/\\(?:d?frac)\s*\{/);
    if (index < 0) break;

    const commandMatch = text.slice(index).match(/^\\(?:d?frac)\s*/);
    if (!commandMatch) break;

    const numStart = index + commandMatch[0].length;
    const numerator = findGroup(text, numStart);
    if (!numerator) break;

    let denStart = numerator.end + 1;
    while (/\s/.test(text[denStart] || '')) denStart += 1;
    const denominator = findGroup(text, denStart);
    if (!denominator) break;

    const replacement = `(( ${numerator.content} )/( ${denominator.content} ))`;
    text =
      text.slice(0, index) +
      replacement +
      text.slice(denominator.end + 1);
  }

  return text;
}

function latexExpressionToSafeJs(value) {
  let expression = replaceLatexFractions(value)
    .replace(/\\displaystyle\b/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\ln\b/g, 'ln')
    .replace(/\\log\b/g, 'log')
    .replace(/\\exp\b/g, 'exp')
    .replace(/\\sqrt\b/g, 'sqrt')
    .replace(/\\sin\b/g, 'sin')
    .replace(/\\cos\b/g, 'cos')
    .replace(/\\tan\b/g, 'tan')
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\,/g, '')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .replace(/\^\s*\(([-+]?\d+(?:\.\d+)?)\)/g, '**($1)')
    .replace(/\^\s*([-+]?\d+(?:\.\d+)?)/g, '**($1)')
    .replace(/\s+/g, '');

  expression = expression
    .replace(/(\d|x)\(/g, '$1*(')
    .replace(/\)(\d|x)/g, ')*$1')
    .replace(/\)\(/g, ')*(')
    .replace(/(\d)x/g, '$1*x')
    .replace(/x(\d)/g, 'x*$1');

  if (!expression || !/^[0-9A-Za-z_+\-*/().]+$/.test(expression)) {
    return '';
  }

  const allowedNames = new Set([
    'x', 'exp', 'ln', 'log', 'sqrt', 'abs',
    'sin', 'cos', 'tan', 'pi', 'e',
  ]);
  const names = expression.match(/[A-Za-z_]+/g) || [];
  if (names.some((name) => !allowedNames.has(name))) {
    return '';
  }

  return expression
    .replace(/\b(?:ln|log)\b/g, 'Math.log')
    .replace(/\bexp\b/g, 'Math.exp')
    .replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\babs\b/g, 'Math.abs')
    .replace(/\bsin\b/g, 'Math.sin')
    .replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan')
    .replace(/\bpi\b/g, 'Math.PI')
    .replace(/\be\b/g, 'Math.E');
}

// Legacy inference is disabled: graphs must come from verified backend data.
function evaluateSafeXExpression() { return NaN; }

function extractCurveSymbol(statement) {
  const source = String(statement ?? '');
  const match = source.match(/C\s*[_\{(]?\s*([A-Za-z])\s*[}\)]?/i);
  return match?.[1] || '';
}

function extractFunctionDefinition(statement, preferredName = '') {
  const source = String(statement ?? '')
    .replace(/\\\[|\\\]|\\\(|\\\)|\$\$/g, ' ')
    .replace(/\$/g, ' ')
    .replace(/\r\n?/g, '\n');

  const names = [];
  if (preferredName) names.push(preferredName);

  const all = [...source.matchAll(/\b([A-Za-z])\s*\(\s*x\s*\)\s*=\s*/g)];
  all.forEach((item) => {
    if (!names.includes(item[1])) names.push(item[1]);
  });

  for (const name of names) {
    const regex = new RegExp(
      `\\b${name}\\s*\\(\\s*x\\s*\\)\\s*=\\s*([^\\n\\u0600-\\u06FF،؛.]{2,260})`,
      'i',
    );
    const match = source.match(regex);
    if (!match) continue;

    const rawExpression = String(match[1] || '')
      .replace(/[;،؛]+$/g, '')
      .trim();
    const jsExpression = latexExpressionToSafeJs(rawExpression);
    if (jsExpression) {
      return {
        name,
        rawExpression,
        jsExpression,
      };
    }
  }

  return null;
}

function statementSaysCurveIsGiven(statement) {
  const source = String(statement ?? '');
  const curveReference =
    '(?:المنحنى|الشكل\\s+البياني|التمثيل\\s+البياني|' +
    'تمثيل(?:ها|ه)?\\s+البياني|تمثيل\\s+الدالة\\s+البياني|' +
    '\\(?\\s*C\\s*[_\\{(]?\\s*[A-Za-z]\\s*[}\\)]?\\s*\\)?)';
  const givenWord =
    '(?:معط[ىً]|المعط[ىً]|مرفق|المرفق|مرسوم|' +
    'مبي[نّ]|موض[حّ]|ظاهر|يعطى|يُعطى)';

  return (
    new RegExp(
      `${curveReference}[\\s\\S]{0,140}(?:${givenWord}|في\\s+(?:الشكل|الرسم))`,
      'i',
    ).test(source) ||
    new RegExp(
      `${givenWord}[\\s\\S]{0,100}${curveReference}`,
      'i',
    ).test(source) ||
    /اعتمادك?\s+على\s+المنحنى/i.test(source)
  );
}

function hasExplicitGraphPayload(exercise) {
  const visuals = asArray(exercise?.visuals);
  const graphs = asArray(exercise?.statement_graph_data);
  const documents = asArray(exercise?.documents);

  return Boolean(
    graphs.some((graph) => asArray(graph?.series).length > 0 || hasText(graph?.expression)) ||
    visuals.some((item) =>
      String(item?.type || '').toLowerCase() === 'graph' &&
      (asArray(item?.series).length > 0 || hasText(item?.expression)),
    ) ||
    documents.some((item) =>
      String(item?.type || '').toLowerCase() === 'graph' &&
      (asArray(item?.graph?.series).length > 0 || hasText(item?.graph?.expression)),
    )
  );
}

function inferGraphRange(statement) {
  const source = String(statement ?? '')
    .replace(/\\infty/g, '∞')
    .replace(/\s+/g, ' ');

  const leftBound = source.match(/[\]\[]\s*([-+]?\d+(?:[.,]\d+)?)\s*,\s*\+?∞/);
  if (leftBound) {
    const left = Number(String(leftBound[1]).replace(',', '.'));
    if (Number.isFinite(left)) {
      return [left + 0.12, left + 8];
    }
  }

  return [-5, 5];
}

// Never infer a supplied graph from prose or from a requested solution drawing.
function buildFallbackStatementGraph() {
  return null;
}

function filterStatementGraphics(exercise) {
  const policy = exercise?.statement_visual_policy;
  const source = [exercise?.statement, ...asArray(exercise?.statement_sections).map(s => s?.text),
    ...asArray(exercise?.questions).map(q => q?.text)].filter(Boolean).join(" ").replace(/[\u064b-\u065f\u0640]/g, "");
  // Legacy records have no reference policy: only explicit given/reading language is evidence.
  const legacyGiven = /(?:المنحنى|التمثيل البياني|الشكل البياني)\s*(?:ال)?(?:المعطى|معطى|المرفق|مرفق|المبين|مبين|الموضح|موضح)|(?:المنحنى|التمثيل البياني).{0,35}في\s+(?:الشكل|الرسم)|(?:اعتمادا على|بالاعتماد على|انطلاقا من)\s+(?:المنحنى|التمثيل البياني)|(?:اقرأ|عين|حدد|استنتج)\s+بيانيا|يمثل\s+(?:الشكل|الرسم)\s+(?:المقابل|المرفق|التالي)/.test(source);
  const allowGraph = typeof policy?.allow_graph === "boolean" ? policy.allow_graph : legacyGiven;
  const allowTable = typeof policy?.allow_variation_table === "boolean" ? policy.allow_variation_table : true;
  const allowed = v => {
    const type = String(v?.type || "").toLowerCase();
    if (!allowGraph && (["graph", "physics_graph", "function_graph", "curve"].includes(type) || v?.graph)) return false;
    if (!allowTable && ["variation_table", "variations", "sign_variation_table"].includes(type)) return false;
    return true;
  };
  const clean = obj => ({...obj, visuals: asArray(obj?.visuals).filter(allowed),
    documents: asArray(obj?.documents).filter(allowed),
    statement_graph_data: allowGraph ? obj?.statement_graph_data : null});
  return {...clean(exercise), questions: asArray(exercise?.questions).map(clean),
    statement_sections: asArray(exercise?.statement_sections).map(clean)};
}

function extractEquationSignatures(value) {
  const source = String(value ?? '')
    .replace(/\\\[|\\\]|\\\(|\\\)|\$\$/g, ' ')
    .replace(/\$/g, ' ');

  return [...source.matchAll(/\b([A-Za-z])\s*\(\s*x\s*\)\s*=\s*([^\n\u0600-\u06FF،؛.]{2,220})/g)]
    .map((match) =>
      `${match[1].toLowerCase()}(x)=${String(match[2] || '')}`
        .replace(/\s+/g, '')
        .replace(/\\left|\\right|\\displaystyle/g, ''),
    )
    .filter(Boolean);
}

function getExercisePayload(record) {
  const nested = asObject(record?.exercise);

  if (Object.keys(nested).length > 0) {
    return filterStatementGraphics(nested);
  }

  return filterStatementGraphics(asObject(record));
}

function getExerciseQuestions(record) {
  return asArray(
    getExercisePayload(record)?.questions,
  )
    .slice()
    .sort(
      (a, b) =>
        Number(a?.display_order ?? 0) -
        Number(b?.display_order ?? 0),
    );
}


function getExerciseDocuments(record) {
  return asArray(
    getExercisePayload(record)?.documents,
  ).filter(
    (item) => {
      if (!item || typeof item !== "object") {
        return false;
      }

      return Boolean(
        hasText(item?.ref_id) ||
        hasText(item?.title) ||
        hasText(item?.path) ||
        hasText(item?.url) ||
        hasText(item?.src) ||
        Object.keys(asObject(item?.graph)).length > 0 ||
        Object.keys(asObject(item?.table)).length > 0,
      );
    },
  );
}

function normalizeAssetPath(value) {
  return String(value ?? "")
    .trim()
    .replace(/\\/g, "/");
}

function resolveDocumentAssetUrl(value) {
  // Science assets are served from React public, not Django media.
  const original = String(value || "").replace(/\\/g, "/");
  const publicPath = original.replace(/^\/?public\//i, "").replace(/^\/+/, "");
  if (publicPath.startsWith("science/")) return "/" + publicPath.replace(/\/{2,}/g, "/");
  const path = normalizeAssetPath(value);

  if (!path) {
    return "";
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith("/media/")) {
    return API_BASE_URL
      ? `${API_BASE_URL}${path}`
      : path;
  }

  if (path.startsWith("media/")) {
    return `${MEDIA_BASE_URL}/${path.slice(6)}`;
  }

  if (path.startsWith("/")) {
    return API_BASE_URL
      ? `${API_BASE_URL}${path}`
      : path;
  }

  return `${MEDIA_BASE_URL}/${path}`;
}

function getDocumentByRef(documents, refId) {
  const target = String(refId ?? "");
  return asArray(documents).find(
    (document) =>
      String(document?.ref_id ?? "") === target,
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
  const embedded = asObject(
    question?.solution,
  );

  if (Object.keys(embedded).length > 0) {
    return embedded;
  }

  const questionId = String(
    question?.id ?? "",
  );

  return (
    getSolutionQuestions(record).find(
      (item) =>
        String(
          item?.question_id ??
            item?.id ??
            "",
        ) === questionId,
    ) || null
  );
}

function normalizeTables(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return [value];
  }

  return [];
}

function getTableColumns(table) {
  return asArray(
    table?.columns?.length
      ? table.columns
      : table?.headers,
  );
}

function getTableRows(table) {
  return asArray(table?.rows);
}

function stripMathDelimiters(value) {
  return String(value ?? "")
    .replace(/\\\(([\s\S]*?)\\\)/g, "$1")
    .replace(/\\\[([\s\S]*?)\\\]/g, "$1")
    .trim();
}


function normalizeForContentDedupe(value) {
  return stripMathDelimiters(
    normalizeMathText(String(value ?? "")),
  )
    .replace(/[\[\](){}$\\]/g, " ")
    .replace(/[،,:;؛.!?؟\-_=+*/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function unwrapStandaloneMath(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\\\[/, "")
    .replace(/\\\]$/, "")
    .replace(/^\\\(/, "")
    .replace(/\\\)$/, "")
    .replace(/^\$\$/, "")
    .replace(/\$\$$/, "")
    .replace(/^\$/, "")
    .replace(/\$$/, "")
    .trim();
}

function looksLikeStandaloneMathBlock(value) {
  const raw = String(value ?? "").trim();

  if (!raw || containsArabic(raw)) {
    return false;
  }

  const unwrapped = unwrapStandaloneMath(raw);
  return Boolean(unwrapped) && looksLikePureMath(unwrapped);
}

function splitRichTextBlocks(value) {
  const source = String(value ?? "").replace(/\r\n?/g, "\n");
  const lines = source.split("\n");
  const blocks = [];
  let paragraph = [];

  const pushParagraph = () => {
    const joined = paragraph.join("\n").trim();
    if (joined) {
      blocks.push({ type: "text", value: joined });
    }
    paragraph = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      pushParagraph();
      continue;
    }

    if (looksLikeStandaloneMathBlock(trimmed)) {
      pushParagraph();
      blocks.push({ type: "formula", value: trimmed });
      continue;
    }

    paragraph.push(line);
  }

  pushParagraph();
  return blocks;
}

function splitMeasurementValues(value) {
  return stripMathDelimiters(value)
    .replace(/[،,;]/g, " ")
    .replace(/[  \u00a0]+/g, " ")
    .replace(/\\,/g, " ")
    .trim()
    .split(/\s+/)
    .map((item) =>
      item
        .replace(/^[:：]+|[:：]+$/g, "")
        .trim(),
    )
    .filter(Boolean);
}

function parseMeasurementLine(line) {
  const plainLine =
    stripMathDelimiters(line);

  const separatorMatch =
    plainLine.match(/[:：]/);

  if (!separatorMatch) {
    return null;
  }

  const separatorIndex =
    separatorMatch.index;

  const label = plainLine
    .slice(0, separatorIndex)
    .trim();

  const values = splitMeasurementValues(
    plainLine.slice(separatorIndex + 1),
  );

  if (
    !label ||
    values.length < 2
  ) {
    return null;
  }

  return {
    label,
    values,
  };
}

function isTimeMeasurementLabel(value) {
  const label = stripMathDelimiters(value)
    .replace(/\s+/g, "")
    .toLowerCase();

  return (
    /^t(?:\((?:min|s|h|jour|jours|د)\))?$/.test(
      label,
    ) ||
    label.startsWith("الزمن")
  );
}

function isValueMeasurementLabel(value) {
  const label = stripMathDelimiters(value);

  return (
    /\[[^\]]+\]/.test(label) ||
    /(?:التركيز|الحجم|الكتلة|الناقلية|التقدم|سرعة)/.test(
      label,
    ) ||
    /^(?:V|m|x|G|pH|σ|sigma)\b/i.test(
      label.trim(),
    )
  );
}

function extractInlineStatementTable(statement) {
  /*
   * لا نستعمل normalizeMathText هنا لأن النص قد يحتوي
   * على بيئة tabular نحتاج استخراجها لاحقًا كجدول HTML.
   */
  const source = String(statement ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n")
    .trim();

  if (!source.trim()) {
    return {
      text: "",
      table: null,
    };
  }

  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsedLines = lines.map(
    (line, index) => ({
      index,
      line,
      parsed: parseMeasurementLine(
        line,
      ),
    }),
  );

  const timeEntry = parsedLines.find(
    (entry) =>
      entry.parsed &&
      isTimeMeasurementLabel(
        entry.parsed.label,
      ),
  );

  if (!timeEntry) {
    return {
      text: source,
      table: null,
    };
  }

  const valueEntry = parsedLines.find(
    (entry) =>
      entry.index > timeEntry.index &&
      entry.parsed &&
      isValueMeasurementLabel(
        entry.parsed.label,
      ),
  );

  if (!valueEntry) {
    return {
      text: source,
      table: null,
    };
  }

  const timeRow = timeEntry.parsed;
  const valueRow = valueEntry.parsed;

  const maxLength = Math.max(
    timeRow.values.length,
    valueRow.values.length,
  );

  if (maxLength < 2) {
    return {
      text: source,
      table: null,
    };
  }

  const normalizeRowValues = (row) =>
    Array.from(
      { length: maxLength },
      (_, index) =>
        row.values[index] ?? "—",
    );

  const remainingLines = lines.filter(
    (_, index) =>
      index !== timeEntry.index &&
      index !== valueEntry.index,
  );

  return {
    text: remainingLines.join("\n"),
    table: {
      type: "data",
      title: "جدول القياسات التجريبية",
      columns: [
        "الكمية",
        ...normalizeRowValues(timeRow),
      ],
      rows: [
        [
          timeRow.label,
          ...normalizeRowValues(timeRow),
        ],
        [
          valueRow.label,
          ...normalizeRowValues(valueRow),
        ],
      ],
    },
  };
}

function DataTable({
  table,
  compact = false,
}) {
  /*
   * أي جدول تغيّرات، سواء جاء بالصيغة الحديثة variation_table
   * أو بالصيغة القديمة columns/rows، نرسله مباشرة إلى الرسم
   * البكالوري. buildVariationModel يعيد null للجداول العادية.
   *
   * مهم: هذا يجعل parsedStatement.table أيضًا يستفيد من نفس
   * الرسم، وليس فقط الجداول الموجودة داخل TablesBlock.
   */
  const variationModel = buildVariationModel(table);

  if (variationModel) {
    return <VariationTable table={table} />;
  }

  const columns = getTableColumns(table);
  const rows = getTableRows(table);

  if (
    columns.length === 0 &&
    rows.length === 0
  ) {
    return null;
  }

  return (
    <div
      className="
        overflow-hidden rounded-2xl
        border border-slate-200
        bg-white shadow-sm
      "
    >
      {hasText(table?.title) && (
        <div
          className="
            border-b border-slate-200
            bg-slate-50 px-4 py-3
          "
        >
          <MathText
            className="
              text-sm font-black
              text-slate-800
            "
          >
            {table.title}
          </MathText>
        </div>
      )}

      <div className="overflow-x-auto">
        <table
          dir="rtl"
          className={cn(
            "min-w-full border-collapse text-center",
            compact
              ? "text-xs sm:text-sm"
              : "text-sm",
          )}
        >
          {columns.length > 0 && (
            <thead>
              <tr className="bg-slate-900 text-white">
                {columns.map(
                  (column, index) => (
                    <th
                      key={index}
                      className="
                        min-w-[110px]
                        border border-slate-700
                        px-3 py-3 font-black
                      "
                    >
                      <ShortMathValue
                        value={column}
                        className="text-center"
                      />
                    </th>
                  ),
                )}
              </tr>
            </thead>
          )}

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  rowIndex % 2 === 0
                    ? "bg-white"
                    : "bg-slate-50",
                  "hover:bg-blue-50/60",
                )}
              >
                {asArray(row).map(
                  (cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        `
                          min-w-[110px]
                          border border-slate-200
                          px-3 py-3
                          font-semibold
                          text-slate-800
                        `,
                        cellIndex === 0 &&
                          "bg-slate-100 font-black text-slate-950",
                      )}
                    >
                      <ShortMathValue
                        value={String(
                          cell ?? "—",
                        )}
                        className="text-center"
                      />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasText(table?.note) && (
        <div
          className="
            border-t border-slate-200
            bg-amber-50 px-4 py-3
          "
        >
          <MathText
            className="
              text-xs font-bold
              leading-6 text-amber-900
            "
          >
            {table.note}
          </MathText>
        </div>
      )}
    </div>
  );
}


function normalizeVariationDirection(value) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();

  if (raw === "gap" || raw === "break" || raw === "discontinuity") {
    return "gap";
  }

  if (
    [
      "down",
      "decreasing",
      "decrease",
      "decroissante",
      "décroissante",
      "تناقص",
      "متناقصة",
      "ناقص",
      "-",
    ].includes(raw)
  ) {
    return "down";
  }

  if (
    [
      "up",
      "increasing",
      "increase",
      "croissante",
      "تزايد",
      "متزايدة",
      "زائد",
      "+",
    ].includes(raw)
  ) {
    return "up";
  }

  return "constant";
}

function normalizeVariationSign(value) {
  const raw = String(value ?? "").trim();

  if (/^(?:\+|plus|positive|موجب)$/i.test(raw)) {
    return "+";
  }

  if (/^(?:-|−|minus|negative|سالب)$/i.test(raw)) {
    return "-";
  }

  if (/^(?:0|zero|صفر)$/i.test(raw)) {
    return "0";
  }

  return raw;
}

function variationCellText(value) {
  if (value == null) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (typeof value === "object") {
    return String(
      value?.latex ??
      value?.value ??
      value?.text ??
      value?.label ??
      value?.name ??
      value?.title ??
      value?.content ??
      "",
    );
  }

  return String(value);
}

function cleanVariationTableCell(value) {
  return stripMathDelimiters(
    variationCellText(value)
      .replace(/\\?text\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\?mathrm\s*\{([^{}]*)\}/g, "$1")
      .replace(/\$+/g, ""),
  )
    .replace(/\\,+/g, " ")
    .replace(/\\;+?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVariationRows(data, columns) {
  return getTableRows(data)
    .map((row) => {
      if (Array.isArray(row)) {
        return row.map(variationCellText);
      }

      if (!row || typeof row !== "object") {
        return [];
      }

      const embedded =
        asArray(row?.cells).length > 0
          ? row.cells
          : asArray(row?.values).length > 0
            ? row.values
            : asArray(row?.data).length > 0
              ? row.data
              : null;

      if (embedded) {
        return embedded.map(variationCellText);
      }

      return columns.map((column, index) => {
        const columnObject =
          column && typeof column === "object"
            ? column
            : {};

        const keys = [
          columnObject?.key,
          columnObject?.id,
          columnObject?.name,
          variationCellText(column),
          String(index),
          index,
        ].filter(
          (key) =>
            key !== undefined &&
            key !== null &&
            String(key).length > 0,
        );

        for (const key of keys) {
          if (Object.prototype.hasOwnProperty.call(row, key)) {
            return variationCellText(row[key]);
          }
        }

        return "";
      });
    })
    .filter((row) => row.length > 0);
}

function normalizeVariationHeader(value) {
  return cleanVariationTableCell(value)
    .replace(/\\left|\\right/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function isVariationArrow(value) {
  return /\\(?:downarrow|uparrow|searrow|nearrow)|[↓↑↘↗]/.test(
    cleanVariationTableCell(value),
  );
}

function getVariationDirectionFromArrow(value) {
  const raw = cleanVariationTableCell(value);

  if (/\\(?:downarrow|searrow)|[↓↘]/.test(raw)) {
    return "down";
  }

  if (/\\(?:uparrow|nearrow)|[↑↗]/.test(raw)) {
    return "up";
  }

  return "";
}

function splitVariationTransition(value, mode = "x") {
  const raw = cleanVariationTableCell(value)
    .replace(/∞/g, "\\infty")
    .replace(/(?<!\\)\binfty\b/gi, "\\infty");

  if (!raw) {
    return null;
  }

  const pattern = mode === "function"
    ? /(\\downarrow|\\uparrow|\\searrow|\\nearrow|↓|↑|↘|↗)/
    : /(\\longrightarrow|\\rightarrow|\\to|⟶|→|->)/;

  const match = raw.match(pattern);
  if (!match || match.index == null) {
    return null;
  }

  const start = raw.slice(0, match.index).trim();
  const end = raw.slice(match.index + match[0].length).trim();

  if (!start || !end) {
    return null;
  }

  const direction = mode === "function"
    ? getVariationDirectionFromArrow(match[0])
    : "right";

  return { start, end, direction };
}

function buildVariationFromSegments({
  segments,
  functionLabel,
  variableLabel = "x",
  derivativeLabel = "",
  title = "جدول التغيّرات",
  note = "",
  id = "generic-variation-table",
}) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return null;
  }

  const showDerivative =
    hasText(derivativeLabel) ||
    segments.some(
      (segment) =>
        hasText(String(segment?.sign ?? "")) ||
        hasText(String(segment?.startDerivative ?? "")) ||
        hasText(String(segment?.endDerivative ?? "")),
    );

  const points = [];
  const intervals = [];

  const normalizeCompare = (value) =>
    cleanVariationTableCell(value)
      .replace(/\s+/g, "")
      .replace(/∞/g, "\\infty");

  const pushPoint = (x, value, derivative = "", excluded = false) => {
    points.push({
      id: `generic-vp-${points.length}`,
      x: String(x ?? ""),
      value: String(value ?? ""),
      derivative: normalizeVariationSign(derivative),
      excluded: Boolean(excluded),
    });
  };

  pushPoint(
    segments[0].startX,
    segments[0].startValue,
    segments[0].startDerivative,
    segments[0].startExcluded,
  );

  segments.forEach((segment, segmentIndex) => {
    const lastPoint = points[points.length - 1];
    const sameStartX =
      normalizeCompare(lastPoint?.x) ===
      normalizeCompare(segment.startX);
    const sameStartValue =
      normalizeCompare(lastPoint?.value) ===
      normalizeCompare(segment.startValue);

    if (!sameStartX || !sameStartValue) {
      intervals.push({
        id: `generic-gap-${segmentIndex}`,
        sign: "",
        direction: "gap",
      });

      // نقطتا النهاية اليمنى واليسرى لنفس x تمثلان غالبًا قيمة ممنوعة.
      const sameBaseX =
        normalizeVariationBaseX(lastPoint?.x) ===
        normalizeVariationBaseX(segment.startX);

      if (sameBaseX) {
        lastPoint.excluded = true;
      }

      pushPoint(
        segment.startX,
        segment.startValue,
        segment.startDerivative,
        sameBaseX || segment.startExcluded,
      );
    }

    const direction =
      segment.direction === "up" || segment.direction === "down"
        ? segment.direction
        : "constant";

    intervals.push({
      id: `generic-vi-${segmentIndex}`,
      sign:
        segment.sign ||
        (direction === "up"
          ? "+"
          : direction === "down"
            ? "-"
            : "0"),
      direction,
    });

    pushPoint(
      segment.endX,
      segment.endValue,
      segment.endDerivative,
      segment.endExcluded,
    );
  });

  if (points.length < 2 || intervals.length !== points.length - 1) {
    return null;
  }

  // إذا تغير اتجاه الدالة عند نقطة داخلية من - إلى + أو العكس
  // ونقطة المشتقة لم تُعطَ، نضع 0 بالشكل الكلاسيكي فقط عندما
  // لا تكون النقطة ممنوعة.
  for (let index = 1; index < points.length - 1; index += 1) {
    if (hasText(points[index]?.derivative) || points[index]?.excluded) {
      continue;
    }

    const before = intervals[index - 1]?.direction;
    const after = intervals[index]?.direction;

    if (
      (before === "down" && after === "up") ||
      (before === "up" && after === "down")
    ) {
      points[index].derivative = "0";
    }
  }

  const finalFunctionLabel = functionLabel || "f(x)";
  const finalDerivativeLabel = derivativeLabel || String(finalFunctionLabel)
    .replace(/\(x\)/, "'(x)")
    .replace(/\(t\)/, "'(t)");

  return {
    type: "variation_table",
    id: String(id || "generic-variation-table"),
    title: String(title || "جدول التغيّرات"),
    variable_label: variableLabel || "x",
    derivative_label: finalDerivativeLabel || "f'(x)",
    function_label: finalFunctionLabel,
    show_derivative: showDerivative,
    points,
    intervals,
    note: String(note || ""),
  };
}

function variationFromHorizontalTransitionRows({
  data,
  columns,
  rows,
  xIndex,
  functionIndex,
  derivativeIndex,
}) {
  const segments = rows
    .map((row) => {
      const xTransition = splitVariationTransition(
        row[xIndex],
        "x",
      );
      const fTransition = splitVariationTransition(
        row[functionIndex],
        "function",
      );

      if (!xTransition || !fTransition) {
        return null;
      }

      const derivativeCell =
        derivativeIndex >= 0
          ? normalizeVariationSign(row[derivativeIndex])
          : "";

      return {
        startX: xTransition.start,
        endX: xTransition.end,
        startValue: fTransition.start,
        endValue: fTransition.end,
        direction: fTransition.direction,
        sign:
          derivativeCell === "+" || derivativeCell === "-"
            ? derivativeCell
            : "",
      };
    })
    .filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return buildVariationFromSegments({
    segments,
    functionLabel: variationCellText(columns[functionIndex]) || "f(x)",
    variableLabel: variationCellText(columns[xIndex]) || "x",
    derivativeLabel:
      derivativeIndex >= 0
        ? variationCellText(columns[derivativeIndex])
        : "",
    title: String(data?.title || "جدول التغيّرات"),
    note: String(data?.note || ""),
    id: String(data?.id || "generic-horizontal-variation"),
  });
}

/*
 * يدعم الشكل الذي ظهر في لقطة الشاشة:
 *
 * x      | g(x)
 * 0      | 5/2
 * ↑      | ↑
 * +∞     | +∞
 *
 * أي أن كل انتقال موزع على ثلاثة أسطر بدلاً من كتابته داخل خلية واحدة.
 */
function variationFromVerticalTransitionRows({
  data,
  columns,
  rows,
  xIndex,
  functionIndex,
}) {
  if (rows.length < 3) {
    return null;
  }

  const segments = [];

  for (let index = 0; index <= rows.length - 3; index += 1) {
    const startRow = rows[index];
    const arrowRow = rows[index + 1];
    const endRow = rows[index + 2];

    const startX = cleanVariationTableCell(startRow?.[xIndex]);
    const startValue = cleanVariationTableCell(startRow?.[functionIndex]);
    const endX = cleanVariationTableCell(endRow?.[xIndex]);
    const endValue = cleanVariationTableCell(endRow?.[functionIndex]);

    const arrow =
      getVariationDirectionFromArrow(arrowRow?.[functionIndex]) ||
      getVariationDirectionFromArrow(arrowRow?.[xIndex]);

    const startLooksLikePoint =
      hasText(startX) &&
      hasText(startValue) &&
      !isVariationArrow(startX) &&
      !isVariationArrow(startValue);

    const endLooksLikePoint =
      hasText(endX) &&
      hasText(endValue) &&
      !isVariationArrow(endX) &&
      !isVariationArrow(endValue);

    if (!startLooksLikePoint || !endLooksLikePoint || !arrow) {
      continue;
    }

    segments.push({
      startX,
      endX,
      startValue,
      endValue,
      direction: arrow,
    });
  }

  if (segments.length === 0) {
    return null;
  }

  // إزالة المقاطع المكررة في حالة point/arrow/point/arrow/point.
  const uniqueSegments = [];
  const seen = new Set();

  segments.forEach((segment) => {
    const key = [
      segment.startX,
      segment.endX,
      segment.startValue,
      segment.endValue,
      segment.direction,
    ].join("||");

    if (!seen.has(key)) {
      seen.add(key);
      uniqueSegments.push(segment);
    }
  });

  return buildVariationFromSegments({
    segments: uniqueSegments,
    functionLabel: variationCellText(columns[functionIndex]) || "f(x)",
    variableLabel: variationCellText(columns[xIndex]) || "x",
    title: String(data?.title || "جدول التغيّرات"),
    note: String(data?.note || ""),
    id: String(data?.id || "generic-vertical-variation"),
  });
}

/*
 * يدعم الجدول الكلاسيكي إذا وصل على شكل صفوف:
 * x      | -2 | -1 | 2
 * f'(x)  | -  | 0  | +
 * f(x)   | -3 | -4 | 5
 */
function variationFromClassicRows({ data, columns, rows }) {
  if (rows.length < 2) {
    return null;
  }

  const normalized = rows.map((row) =>
    row.map((cell) => cleanVariationTableCell(cell)),
  );

  const label = (row) =>
    normalizeVariationHeader(row?.[0]);

  const xRow = normalized.find((row) => {
    const current = label(row);
    return current === "x" || current === "t";
  });

  const derivativeRow = normalized.find((row) => {
    const current = label(row);
    return (
      /['′]/.test(current) ||
      /\\prime/.test(current) ||
      /d[a-z]+\/d[a-z]+/.test(current)
    );
  });

  const functionRow = normalized.find((row) => {
    if (row === xRow || row === derivativeRow) {
      return false;
    }

    return /[a-z]+\((?:x|t)\)/i.test(label(row));
  });

  if (!xRow || !functionRow) {
    return null;
  }

  const xValues = xRow.slice(1).filter(hasText);
  if (xValues.length < 2) {
    return null;
  }

  const fValues = functionRow.slice(1);
  const derivativeValues = derivativeRow?.slice(1) || [];

  const points = xValues.map((x, index) => ({
    id: `classic-vp-${index}`,
    x,
    derivative:
      normalizeVariationSign(derivativeValues[index]) === "0"
        ? "0"
        : "",
    value: fValues[index] ?? "",
    excluded: false,
  }));

  const nonZeroSigns = derivativeValues
    .map(normalizeVariationSign)
    .filter((item) => item === "+" || item === "-");

  const intervals = Array.from(
    { length: points.length - 1 },
    (_, index) => {
      const sign = nonZeroSigns[index] || "";
      let direction =
        sign === "+"
          ? "up"
          : sign === "-"
            ? "down"
            : "constant";

      // إذا لم يوجد صف مشتقة نحاول الاستفادة من الأسهم الموجودة في f(x).
      if (!sign) {
        const between = functionRow[index + 1];
        const arrowDirection = getVariationDirectionFromArrow(between);
        if (arrowDirection) {
          direction = arrowDirection;
        }
      }

      return {
        id: `classic-vi-${index}`,
        sign:
          sign ||
          (direction === "up"
            ? "+"
            : direction === "down"
              ? "-"
              : ""),
        direction,
      };
    },
  );

  return {
    type: "variation_table",
    id: String(data?.id || "classic-row-variation"),
    title: String(data?.title || "جدول التغيّرات"),
    variable_label: xRow[0] || "x",
    derivative_label:
      derivativeRow?.[0] ||
      String(functionRow[0] || "f(x)")
        .replace(/\(x\)/, "'(x)")
        .replace(/\(t\)/, "'(t)"),
    function_label: functionRow[0] || "f(x)",
    show_derivative: Boolean(derivativeRow),
    points,
    intervals,
    note: String(data?.note || ""),
  };
}

/*
 * تحويل كل الأشكال الشائعة التي قد يرجعها الـAI إلى variation_table.
 * بهذه الطريقة لا يظهر جدول HTML عادي عندما تكون البيانات في الحقيقة
 * جدول تغيّرات.
 */
function variationFromGenericDataTable(value) {
  const data = asObject(value);
  const rawColumns = getTableColumns(data);
  const columns = rawColumns.map(variationCellText);
  const rows = normalizeVariationRows(data, rawColumns);

  if (rows.length === 0) {
    return null;
  }

  // أحيانًا لا توجد headers لكن الصفوف نفسها كلاسيكية x/f'/f.
  const classicRows = variationFromClassicRows({
    data,
    columns,
    rows,
  });

  if (classicRows) {
    return classicRows;
  }

  if (columns.length < 2) {
    return null;
  }

  const normalizedHeaders = columns.map(normalizeVariationHeader);

  const xIndex = normalizedHeaders.findIndex((header) =>
    header === "x" ||
    header === "t" ||
    header === "المتغير" ||
    header === "variable",
  );

  const derivativeIndex = normalizedHeaders.findIndex((header) =>
    /['′]/.test(header) ||
    /\\prime/.test(header) ||
    /d[a-z]+\/d[a-z]+/.test(header),
  );

  const functionIndex = normalizedHeaders.findIndex((header, index) => {
    if (index === derivativeIndex) {
      return false;
    }

    return /[a-z]+\((?:x|t)\)/i.test(header);
  });

  const titleSuggestsVariation = /تغي|variation|variations/i.test(
    String(data?.title ?? ""),
  );

  const hasVariationArrow = rows.some((row) =>
    row.some((cell) => isVariationArrow(cell)),
  );

  if (
    xIndex < 0 ||
    functionIndex < 0 ||
    (!hasVariationArrow && !titleSuggestsVariation)
  ) {
    return null;
  }

  // 1) الفترة | x: a→b | f(x): u↓v
  const horizontal = variationFromHorizontalTransitionRows({
    data,
    columns,
    rows,
    xIndex,
    functionIndex,
    derivativeIndex,
  });

  if (horizontal) {
    return horizontal;
  }

  // 2) x/g(x) على أسطر: قيمة، سهم، قيمة.
  const vertical = variationFromVerticalTransitionRows({
    data,
    columns,
    rows,
    xIndex,
    functionIndex,
  });

  if (vertical) {
    return vertical;
  }

  return null;
}

function isVariationTableData(value) {
  const data = asObject(value);
  const type = String(data?.type || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  return (
    type === "variation_table" ||
    type === "variations" ||
    type === "sign_variation_table" ||
    (
      asArray(data?.points).length >= 2 &&
      asArray(data?.intervals).length >= 1
    ) ||
    Boolean(variationFromGenericDataTable(data))
  );
}

function buildVariationModel(value) {
  let data = asObject(value);

  if (asArray(data?.points).length < 2) {
    const converted = variationFromGenericDataTable(data);
    if (converted) {
      data = converted;
    }
  }

  const rawPoints = asArray(data?.points)
    .filter((item) => item && typeof item === "object")
    .slice(0, 9);
  const rawIntervals = asArray(data?.intervals)
    .filter((item) => item && typeof item === "object")
    .slice(0, 8);

  const hasExplicitDerivativeData =
    rawPoints.some((point) =>
      hasText(String(
        point?.derivative ??
        point?.derivative_value ??
        point?.sign_at_point ??
        "",
      )),
    ) ||
    rawIntervals.some((interval) =>
      hasText(String(
        interval?.sign ??
        interval?.derivative_sign ??
        "",
      )),
    );

  const showDerivative =
    data?.show_derivative !== undefined
      ? Boolean(data.show_derivative)
      : data?.showDerivative !== undefined
        ? Boolean(data.showDerivative)
        : hasExplicitDerivativeData ||
          hasText(String(data?.derivative_label ?? ""));

  if (rawPoints.length < 2) {
    return null;
  }

  const points = rawPoints.map((point, index) => ({
    id: String(point?.id ?? `vp-${index}`),
    x: String(
      point?.x ??
      point?.label ??
      point?.position ??
      "",
    ).trim() || `x_${index}`,
    derivative: normalizeVariationSign(
      point?.derivative ??
      point?.derivative_value ??
      point?.sign_at_point ??
      "",
    ),
    value: String(
      point?.value ??
      point?.function_value ??
      point?.f_value ??
      "",
    ).trim(),
    excluded: Boolean(
      point?.excluded ??
      point?.forbidden ??
      point?.not_in_domain ??
      false,
    ),
  }));

  const intervals = Array.from(
    { length: points.length - 1 },
    (_, index) => {
      const source = rawIntervals[index] || {};
      const direction = normalizeVariationDirection(
        source?.direction ??
        source?.variation ??
        source?.monotonicity ??
        source?.sign ??
        "constant",
      );

      return {
        id: String(source?.id ?? `vi-${index}`),
        from: String(source?.from ?? points[index]?.x ?? ""),
        to: String(source?.to ?? points[index + 1]?.x ?? ""),
        sign: normalizeVariationSign(
          source?.sign ??
          source?.derivative_sign ??
          (
            direction === "up"
              ? "+"
              : direction === "down"
                ? "-"
                : direction === "gap"
                  ? ""
                  : "0"
          ),
        ),
        direction,
      };
    },
  );

  return {
    id: String(data?.id || "variation-table"),
    title: String(data?.title || "جدول التغيّرات"),
    variableLabel: String(
      data?.variable_label ??
      data?.variable ??
      "x",
    ),
    derivativeLabel: String(
      data?.derivative_label ??
      data?.derivative ??
      "f'(x)",
    ),
    functionLabel: String(
      data?.function_label ??
      data?.function ??
      "f(x)",
    ),
    showDerivative,
    points,
    intervals,
    note: String(data?.note || ""),
  };
}

function VariationRowLabel({ value, tall = false }) {
  return (
    <div
      className={cn(
        `
          flex items-center justify-center
          border-r-2 border-slate-900
          bg-slate-100 px-2
          font-black text-slate-950
        `,
        tall ? "min-h-[124px]" : "min-h-[56px]",
      )}
    >
      <ShortMathValue
        value={value}
        className="text-center text-base font-black sm:text-lg"
      />
    </div>
  );
}

/*
 * يعيد مواضع نقاط جدول التغيّرات داخل المجال [left, right].
 * الفاصل discontinuity/gap يأخذ عرضًا صغيرًا فقط؛ لذلك مثلا
 * -2^- و -2^+ يظهران حول نفس المستقيم العمودي بدل أن يبتعدا
 * عن بعضهما كأنهما نقطتان مختلفتان في المجال.
 */
function buildVariationPositions(intervals, count, left = 6, right = 94) {
  if (count <= 1) {
    return [50];
  }

  const weights = Array.from(
    { length: count - 1 },
    (_, index) =>
      intervals[index]?.direction === "gap"
        ? 0.12
        : 1,
  );

  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  const span = right - left;
  const result = [left];
  let cursor = left;

  weights.forEach((weight) => {
    cursor += span * (weight / total);
    result.push(cursor);
  });

  return result;
}

function normalizeVariationBaseX(value) {
  return normalizeFormulaBody(value)
    .replace(/\^\{?[+-]\}?$/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function VariationTable({ table }) {
  const reactId = useId().replace(/:/g, "");
  const model = buildVariationModel(table);

  if (!model) {
    return <DataTable table={table} />;
  }

  const { points, intervals } = model;
  const count = points.length;

  const positions = buildVariationPositions(
    intervals,
    count,
    7,
    93,
  );

  const position = (index) => positions[index] ?? 50;

  const clamp = (value, min, max) =>
    Math.min(max, Math.max(min, value));

  /*
   * مستوى كل قيمة في صف f(x).
   * في SVG: y صغير = أعلى، y كبير = أسفل.
   */
  const levels = [
    intervals[0]?.direction === "down"
      ? 26
      : intervals[0]?.direction === "up"
        ? 74
        : 50,
  ];

  intervals.forEach((interval, index) => {
    const current = levels[index] ?? 50;
    let next = current;

    if (interval.direction === "down") {
      next = clamp(current + 46, 22, 78);
    } else if (interval.direction === "up") {
      next = clamp(current - 46, 22, 78);
    } else if (interval.direction === "gap") {
      const nextDirection = intervals[index + 1]?.direction;
      next =
        nextDirection === "down"
          ? 26
          : nextDirection === "up"
            ? 74
            : current;
    }

    levels.push(next);
  });

  const markerId = `variation-arrow-${model.id}-${reactId}`
    .replace(/[^a-zA-Z0-9_-]/g, "-");

  const gapIndexes = intervals
    .map((interval, index) =>
      interval.direction === "gap" ? index : -1,
    )
    .filter((index) => index >= 0);

  const pointsCoveredByGap = new Set(
    gapIndexes.flatMap((index) => [index, index + 1]),
  );

  // فاصل gap يرسم خطًا مزدوجًا واحدًا؛ لا نكرر خطين إضافيين للنقطتين.
  const excludedIndexes = points
    .map((point, index) => (point.excluded ? index : -1))
    .filter(
      (index) =>
        index >= 0 &&
        !pointsCoveredByGap.has(index),
    );

  const seamPosition = (gapIndex) =>
    (position(gapIndex) + position(gapIndex + 1)) / 2;

  /*
   * في حالة -2^- | gap | -2^+ نعرض -2 مرة واحدة فقط في صف x.
   * أما القيم الجانبية للدالة فتبقى منفصلة حتى نظهر النهايتين.
   */
  const hiddenXIndexes = new Set();
  const mergedXLabels = [];

  gapIndexes.forEach((gapIndex) => {
    const leftPoint = points[gapIndex];
    const rightPoint = points[gapIndex + 1];
    const leftBase = normalizeVariationBaseX(leftPoint?.x);
    const rightBase = normalizeVariationBaseX(rightPoint?.x);

    if (leftBase && leftBase === rightBase) {
      hiddenXIndexes.add(gapIndex);
      hiddenXIndexes.add(gapIndex + 1);
      mergedXLabels.push({
        key: `merged-x-${gapIndex}`,
        x: leftBase,
        position: seamPosition(gapIndex),
      });
    }
  });

  const renderDoubleBar = (key, leftPercent) => (
    <div
      key={key}
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 w-[8px] -translate-x-1/2 bg-white"
      style={{ left: `${leftPercent}%` }}
    >
      <span className="absolute inset-y-0 left-[1px] w-[1.5px] bg-slate-950" />
      <span className="absolute inset-y-0 right-[1px] w-[1.5px] bg-slate-950" />
    </div>
  );

  return (
    <div
      dir="rtl"
      className="mx-auto my-5 w-full max-w-5xl overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-sm"
    >
      {hasText(model.title) && (
        <div className="border-b-2 border-slate-900 bg-slate-50 px-4 py-3 text-center">
          <MathText className="text-center text-base font-black text-slate-950 sm:text-lg">
            {model.title}
          </MathText>
        </div>
      )}

      <div className="w-full overflow-x-auto overflow-y-hidden overscroll-x-contain">
        <div
          dir="ltr"
          className="mx-auto w-full min-w-[520px] overflow-hidden bg-white"
        >
          {/* ========================= صف x ========================= */}
          <div
            className="grid border-b-2 border-slate-900"
            style={{ gridTemplateColumns: "84px minmax(436px, 1fr)" }}
          >
            <VariationRowLabel value={model.variableLabel} />

            <div className="relative min-h-[56px] bg-white">
              {points.map((point, index) => {
                if (hiddenXIndexes.has(index)) {
                  return null;
                }

                return (
                  <div
                    key={point.id}
                    className="absolute inset-y-0 z-10 flex items-center justify-center"
                    style={{
                      left: `${position(index)}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <ShortMathValue
                      value={point.x}
                      className="bg-white px-2 text-base font-black text-slate-950 sm:text-lg"
                    />
                  </div>
                );
              })}

              {mergedXLabels.map((item) => (
                <div
                  key={item.key}
                  className="absolute inset-y-0 z-20 flex items-center justify-center"
                  style={{
                    left: `${item.position}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <ShortMathValue
                    value={item.x}
                    className="bg-white px-2 text-base font-black text-slate-950 sm:text-lg"
                  />
                </div>
              ))}

              {gapIndexes.map((gapIndex) =>
                renderDoubleBar(
                  `x-gap-${gapIndex}`,
                  seamPosition(gapIndex),
                ),
              )}

              {excludedIndexes.map((index) =>
                renderDoubleBar(
                  `x-excluded-${index}`,
                  position(index),
                ),
              )}
            </div>
          </div>

          {/* ====================== صف f'(x) ======================= */}
          {model.showDerivative && (
            <div
              className="grid border-b-2 border-slate-900"
              style={{ gridTemplateColumns: "84px minmax(436px, 1fr)" }}
            >
              <VariationRowLabel value={model.derivativeLabel} />

              <div className="relative min-h-[58px] bg-white">
              {intervals.map((interval, index) => {
                if (interval.direction === "gap") {
                  return null;
                }

                const mid =
                  (position(index) + position(index + 1)) / 2;

                return (
                  <div
                    key={interval.id}
                    className="absolute inset-y-0 z-10 flex items-center justify-center"
                    style={{
                      left: `${mid}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <ShortMathValue
                      value={interval.sign || ""}
                      className="bg-white px-2 text-xl font-black text-slate-950"
                    />
                  </div>
                );
              })}

              {points.map((point, index) => {
                if (!hasText(point.derivative)) {
                  return null;
                }

                return (
                  <div
                    key={`${point.id}-derivative`}
                    className="absolute inset-y-0 z-20 flex items-center justify-center"
                    style={{
                      left: `${position(index)}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <ShortMathValue
                      value={point.derivative}
                      className="bg-white px-2 text-lg font-black text-slate-950"
                    />
                  </div>
                );
              })}

              {gapIndexes.map((gapIndex) =>
                renderDoubleBar(
                  `derivative-gap-${gapIndex}`,
                  seamPosition(gapIndex),
                ),
              )}

              {excludedIndexes.map((index) =>
                renderDoubleBar(
                  `derivative-excluded-${index}`,
                  position(index),
                ),
              )}
              </div>
            </div>
          )}

          {/* ======================= صف f(x) ======================= */}
          <div
            className="grid"
            style={{ gridTemplateColumns: "84px minmax(436px, 1fr)" }}
          >
            <VariationRowLabel value={model.functionLabel} tall />

            <div className="relative h-[124px] overflow-hidden bg-white">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{ maxWidth: "none", height: "100%" }}
                aria-label="جدول تغيرات الدالة"
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
                    <path
                      d="M0,0 L7,3.5 L0,7 Z"
                      fill="#1d4ed8"
                    />
                  </marker>
                </defs>

                {intervals.map((interval, index) => {
                  if (interval.direction === "gap") {
                    return null;
                  }

                  const startX = position(index) + 2.3;
                  const endX = position(index + 1) - 2.8;
                  const startY = levels[index] ?? 50;
                  const endY = levels[index + 1] ?? startY;

                  return (
                    <line
                      key={`${interval.id}-arrow`}
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke="#1d4ed8"
                      strokeWidth="2.75"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      markerEnd={`url(#${markerId})`}
                    />
                  );
                })}
              </svg>

              {/* الخطوط المزدوجة للانقطاع */}
              {gapIndexes.map((gapIndex) =>
                renderDoubleBar(
                  `function-gap-${gapIndex}`,
                  seamPosition(gapIndex),
                ),
              )}

              {excludedIndexes.map((index) =>
                renderDoubleBar(
                  `function-excluded-${index}`,
                  position(index),
                ),
              )}

              {/* قيم f(x) */}
              {points.map((point, index) => {
                if (!hasText(point.value)) {
                  return null;
                }

                const level = levels[index] ?? 50;
                const yTranslate =
                  level <= 36
                    ? "-125%"
                    : level >= 64
                      ? "25%"
                      : "-50%";

                return (
                  <div
                    key={`${point.id}-value`}
                    className="absolute z-30"
                    style={{
                      left: `${position(index)}%`,
                      top: `${level}%`,
                      transform: `translate(-50%, ${yTranslate})`,
                    }}
                  >
                    <div
                      className="bg-white px-2 py-0.5 text-center"
                      style={{
                        boxShadow: "0 0 0 4px rgba(255,255,255,.98)",
                      }}
                    >
                      <ShortMathValue
                        value={point.value}
                        className="text-base font-black text-slate-950 sm:text-lg"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {hasText(model.note) && (
        <div className="border-t border-slate-300 bg-amber-50 px-4 py-2 text-right">
          <MathText className="text-sm font-bold leading-7 text-amber-950">
            {model.note}
          </MathText>
        </div>
      )}
    </div>
  );
}

function TablesBlock({
  value,
  className = "",
}) {
  const tables = normalizeTables(value);

  if (tables.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {tables.map((table, index) =>
        isVariationTableData(table) ? (
          <VariationTable
            key={table?.id ?? index}
            table={table}
          />
        ) : (
          <DataTable
            key={table?.id ?? index}
            table={table}
          />
        ),
      )}
    </div>
  );
}

function GraphBlock({
  graph,
}) {
  const reactId = useId().replace(/:/g, "");
  const data = asObject(graph);
  const graphKey = String(data?.id || "graph")
    .replace(/[^a-zA-Z0-9_-]/g, "-");
  const clipId = `graph-clip-${graphKey}-${reactId}`;
  const axisArrowId = `graph-axis-arrow-${graphKey}-${reactId}`;

  const series = asArray(data?.series)
    .map((item) => {
      const points = asArray(item?.data)
        .map((point) => ({
          ...point,
          x: Number(point?.x),
          y: Number(point?.y),
        }))
        .filter(
          (point) =>
            Number.isFinite(point.x) &&
            Number.isFinite(point.y),
        )
        .sort((a, b) => a.x - b.x);

      const byX = new Map();
      points.forEach((point) => {
        byX.set(point.x, point);
      });

      return {
        ...item,
        data: [...byX.values()].sort(
          (a, b) => a.x - b.x,
        ),
      };
    })
    .filter((item) => item.data.length > 0);

  if (series.length === 0) {
    return null;
  }

  const allPoints = series.flatMap((item) => item.data);
  const xValues = allPoints.map((point) => point.x);
  const yValues = allPoints.map((point) => point.y);

  const dataMinX = Math.min(...xValues);
  const dataMaxX = Math.max(...xValues);
  const dataMinY = Math.min(...yValues);
  const dataMaxY = Math.max(...yValues);

  const quantile = (values, q) => {
    const sorted = values
      .filter(Number.isFinite)
      .slice()
      .sort((a, b) => a - b);

    if (sorted.length === 0) {
      return 0;
    }

    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const left = sorted[base];
    const right = sorted[Math.min(base + 1, sorted.length - 1)];
    return left + (right - left) * rest;
  };

  const parseDomain = (value) => {
    const domain = asArray(value);
    if (domain.length < 2) {
      return null;
    }
    const first = Number(domain[0]);
    const second = Number(domain[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second) || first === second) {
      return null;
    }
    return [Math.min(first, second), Math.max(first, second)];
  };

  const createAutoDomain = (
    dataMin,
    dataMax,
    { paddingRatio = 0.08 } = {},
  ) => {
    if (dataMin === dataMax) {
      const base = Math.max(Math.abs(dataMin), 1);
      const delta = base * 0.12;
      return [dataMin - delta, dataMax + delta];
    }

    const range = dataMax - dataMin;
    const padding = range * paddingRatio;
    return [dataMin - padding, dataMax + padding];
  };

  const providedXDomain = parseDomain(data?.x_domain);
  const providedYDomain = parseDomain(data?.y_domain);

  const autoXDomain = createAutoDomain(dataMinX, dataMaxX, {
    paddingRatio: 0.04,
  });

  const q10 = quantile(yValues, 0.1);
  const q90 = quantile(yValues, 0.9);
  const trimmedRange = Math.max(Math.abs(q90 - q10), 1e-9);
  const fullRange = Math.max(Math.abs(dataMaxY - dataMinY), 1e-9);
  const useRobustY = fullRange > trimmedRange * 6;

  const autoYDomain = useRobustY
    ? createAutoDomain(q10, q90, { paddingRatio: 0.12 })
    : createAutoDomain(dataMinY, dataMaxY, { paddingRatio: 0.08 });

  const [minX, maxX] = providedXDomain || autoXDomain;
  const [minY, maxY] = providedYDomain || autoYDomain;

  const width = 820;
  const height = 430;
  const padding = { top: 26, right: 34, bottom: 68, left: 84 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const safeXRange = Math.max(maxX - minX, 1e-9);
  const safeYRange = Math.max(maxY - minY, 1e-9);

  const toX = (value) =>
    padding.left + ((Number(value) - minX) / safeXRange) * plotWidth;
  const toY = (value) =>
    padding.top + plotHeight - ((Number(value) - minY) / safeYRange) * plotHeight;

  const palette = ["#2563eb", "#059669", "#dc2626", "#7c3aed", "#ea580c"];

  const niceStep = (range, targetTickCount = 5) => {
    const raw = Math.max(range, 1e-9) / Math.max(targetTickCount, 1);
    const power = Math.floor(Math.log10(raw));
    const magnitude = 10 ** power;
    const residual = raw / magnitude;
    let niceResidual = 10;

    if (residual <= 1) {
      niceResidual = 1;
    } else if (residual <= 2) {
      niceResidual = 2;
    } else if (residual <= 2.5) {
      niceResidual = 2.5;
    } else if (residual <= 5) {
      niceResidual = 5;
    }

    return niceResidual * magnitude;
  };

  const parsePositiveStep = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : null;
  };

  const buildTicks = (
    min,
    max,
    count = 5,
    forcedStep = null,
  ) => {
    const step =
      parsePositiveStep(forcedStep) ||
      niceStep(max - min, count);
    const start = Math.ceil(min / step) * step;
    const end = Math.floor(max / step) * step;
    const ticks = [];

    // حماية من إنشاء آلاف العلامات إذا وصل domain غير منطقي.
    let guard = 0;
    for (
      let value = start;
      value <= end + step * 0.5 && guard < 220;
      value += step
    ) {
      ticks.push(Number(value.toFixed(8)));
      guard += 1;
    }

    if (ticks.length < 2) {
      return [min, (min + max) / 2, max].map(
        (value) => Number(value.toFixed(8)),
      );
    }

    return ticks;
  };

  const formatTick = (value, step) => {
    const absStep = Math.abs(step);
    let digits = 0;
    if (absStep < 1) digits = 2;
    if (absStep < 0.1) digits = 3;
    if (absStep < 0.01) digits = 4;
    const rounded = Number(Number(value).toFixed(digits));
    return Object.is(rounded, -0) ? "0" : String(rounded);
  };

  const graphScale = parsePositiveStep(data?.scale) || 1;
  const forcedXStep =
    parsePositiveStep(data?.x_step) ||
    (graphScale === 1 ? 1 : null);
  const forcedYStep =
    parsePositiveStep(data?.y_step) ||
    (graphScale === 1 ? 1 : null);

  const xTicks = buildTicks(
    minX,
    maxX,
    5,
    forcedXStep,
  );
  const yTicks = buildTicks(
    minY,
    maxY,
    5,
    forcedYStep,
  );
  const xStep =
    forcedXStep ||
    (xTicks.length > 1
      ? xTicks[1] - xTicks[0]
      : safeXRange / 5);
  const yStep =
    forcedYStep ||
    (yTicks.length > 1
      ? yTicks[1] - yTicks[0]
      : safeYRange / 5);

  const buildSegments = (points) => {
    if (points.length <= 1) {
      return [points];
    }

    const xGaps = [];
    for (let index = 1; index < points.length; index += 1) {
      xGaps.push(points[index].x - points[index - 1].x);
    }
    const medianGap = quantile(xGaps, 0.5) || 0;

    const segments = [];
    let current = [points[0]];

    for (let index = 1; index < points.length; index += 1) {
      const prev = points[index - 1];
      const point = points[index];
      const xGap = point.x - prev.x;
      const yGap = Math.abs(point.y - prev.y);
      const shouldBreak =
        Boolean(point?.break_before) ||
        !Number.isFinite(point.y) ||
        !Number.isFinite(prev.y) ||
        (medianGap > 0 && xGap > medianGap * 3.5) ||
        yGap > safeYRange * 0.75;

      if (shouldBreak) {
        if (current.length > 0) {
          segments.push(current);
        }
        current = [point];
      } else {
        current.push(point);
      }
    }

    if (current.length > 0) {
      segments.push(current);
    }

    return segments.filter((segment) => segment.length > 0);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-wrap items-center gap-2">
          <MathText className="text-sm font-black text-slate-800">
            {data?.title || "التمثيل البياني"}
          </MathText>
          {graphScale === 1 && (
            <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-600">
              السلم: 1
            </span>
          )}
        </div>

        {series.length > 1 && (
          <div className="flex flex-wrap gap-3">
            {series.map((item, index) => (
              <span
                key={item?.id ?? index}
                className="inline-flex items-center gap-2 text-xs font-black text-slate-600"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: palette[index % palette.length] }}
                />
                {item?.label || `السلسلة ${index + 1}`}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="mx-auto block h-auto w-full max-w-[920px]"
          role="img"
          aria-label={data?.title || "التمثيل البياني"}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x={padding.left}
                y={padding.top}
                width={plotWidth}
                height={plotHeight}
              />
            </clipPath>
            <marker
              id={axisArrowId}
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="5"
              orient="auto"
            >
              <path d="M0,0 L9,5 L0,10 Z" fill="#0f172a" />
            </marker>
          </defs>

          <rect
            x={padding.left}
            y={padding.top}
            width={plotWidth}
            height={plotHeight}
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {xTicks.map((tick, index) => {
            const x = toX(tick);
            return (
              <g key={`x-${index}`}>
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
                  y={padding.top + plotHeight + 26}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#475569"
                  direction="ltr"
                  unicodeBidi="plaintext"
                >
                  {formatTick(tick, xStep)}
                </text>
              </g>
            );
          })}

          {yTicks.map((tick, index) => {
            const y = toY(tick);
            return (
              <g key={`y-${index}`}>
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
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#475569"
                  direction="ltr"
                  unicodeBidi="plaintext"
                >
                  {formatTick(tick, yStep)}
                </text>
              </g>
            );
          })}

          {minX <= 0 && maxX >= 0 && (
            <line
              x1={toX(0)}
              x2={toX(0)}
              y1={padding.top + plotHeight}
              y2={padding.top + 2}
              stroke="#0f172a"
              strokeWidth="1.7"
              markerEnd={`url(#${axisArrowId})`}
            />
          )}

          {minY <= 0 && maxY >= 0 && (
            <line
              x1={padding.left}
              y1={toY(0)}
              x2={padding.left + plotWidth}
              y2={toY(0)}
              stroke="#0f172a"
              strokeWidth="1.7"
              markerEnd={`url(#${axisArrowId})`}
            />
          )}

          <g clipPath={`url(#${clipId})`}>
            {series.map((item, index) => {
              const color = palette[index % palette.length];
              const segments = buildSegments(item.data);
              const showMarkers = item.data.length <= 24;

              return (
                <g key={item?.id ?? index}>
                  {segments.map((segment, segmentIndex) => {
                    const points = segment
                      .map((point) => `${toX(point.x)},${toY(point.y)}`)
                      .join(" ");

                    if (segment.length === 1) {
                      const point = segment[0];
                      return (
                        <circle
                          key={`single-${segmentIndex}`}
                          cx={toX(point.x)}
                          cy={toY(point.y)}
                          r="3.5"
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                      );
                    }

                    return (
                      <polyline
                        key={`segment-${segmentIndex}`}
                        points={points}
                        fill="none"
                        stroke={color}
                        strokeWidth="3.2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    );
                  })}

                  {showMarkers &&
                    item.data.map((point, pointIndex) => (
                      <circle
                        key={pointIndex}
                        cx={toX(point.x)}
                        cy={toY(point.y)}
                        r="3.5"
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    ))}
                </g>
              );
            })}
          </g>

          <text
            x={padding.left + plotWidth / 2}
            y={height - 14}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="#0f172a"
          >
            {data?.x_label || "x"}
          </text>

          <text
            transform={`translate(22 ${padding.top + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="#0f172a"
          >
            {data?.y_label || "y"}
          </text>
        </svg>
      </div>
    </div>
  );
}

function GraphsBlock({
  value,
  className = "",
}) {
  const graphs = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object"
      ? [value]
      : [];

  const valid = graphs.filter(
    (graph) =>
      asArray(graph?.series).length > 0,
  );

  if (valid.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {valid.map((graph, index) => (
        <GraphBlock
          key={graph?.id ?? index}
          graph={graph}
        />
      ))}
    </div>
  );
}


function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getElementBox(element) {
  return {
    x: safeNumber(element?.x, 50),
    y: safeNumber(element?.y, 50),
    width: Math.max(20, safeNumber(element?.width, 90)),
    height: Math.max(20, safeNumber(element?.height, 50)),
  };
}

function getElementCenter(element) {
  const box = getElementBox(element);
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function getConnectionPoint(fromElement, toElement) {
  const fromBox = getElementBox(fromElement);
  const fromCenter = getElementCenter(fromElement);
  const toCenter = getElementCenter(toElement);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? fromBox.x + fromBox.width : fromBox.x,
      y: fromCenter.y,
    };
  }

  return {
    x: fromCenter.x,
    y: dy >= 0 ? fromBox.y + fromBox.height : fromBox.y,
  };
}

function DiagramElement({ element, arrowMarkerId = "visual-arrow" }) {
  const box = getElementBox(element);
  const kind = String(element?.kind || "rectangle").toLowerCase();
  const label = String(
    element?.label || "",
  )
    .replace(/\\Omega/g, "Ω")
    .replace(/\\infty/g, "∞")
    .replace(/\\alpha/g, "α")
    .replace(/\\theta/g, "θ")
    .replace(/\\times/g, "×")
    .replace(/\\_/g, "_");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const horizontal = element?.orientation !== "vertical";
  const stroke = "#0f172a";

  const labelNode = label ? (
    <text
      x={cx}
      y={box.y - 9}
      textAnchor="middle"
      fontSize="14"
      fontWeight="700"
      fill="#0f172a"
    >
      {label}
    </text>
  ) : null;

  if (kind === "resistor") {
    const x1 = box.x;
    const x2 = box.x + box.width;
    const amplitude = Math.min(12, box.height / 3);
    const points = Array.from({ length: 9 }, (_, index) => {
      const x = x1 + ((x2 - x1) * index) / 8;
      const y = index === 0 || index === 8
        ? cy
        : cy + (index % 2 === 0 ? -amplitude : amplitude);
      return `${x},${y}`;
    }).join(" ");
    return <g>{labelNode}<polyline points={points} fill="none" stroke={stroke} strokeWidth="3" /></g>;
  }

  if (kind === "capacitor") {
    const gap = 8;
    return (
      <g>
        {labelNode}
        {horizontal ? (
          <>
            <line x1={cx-gap} y1={box.y} x2={cx-gap} y2={box.y+box.height} stroke={stroke} strokeWidth="3" />
            <line x1={cx+gap} y1={box.y} x2={cx+gap} y2={box.y+box.height} stroke={stroke} strokeWidth="3" />
          </>
        ) : (
          <>
            <line x1={box.x} y1={cy-gap} x2={box.x+box.width} y2={cy-gap} stroke={stroke} strokeWidth="3" />
            <line x1={box.x} y1={cy+gap} x2={box.x+box.width} y2={cy+gap} stroke={stroke} strokeWidth="3" />
          </>
        )}
      </g>
    );
  }

  if (kind === "battery" || kind === "source") {
    return (
      <g>
        {labelNode}
        {horizontal ? (
          <>
            <line x1={cx-7} y1={box.y+5} x2={cx-7} y2={box.y+box.height-5} stroke={stroke} strokeWidth="4" />
            <line x1={cx+8} y1={box.y+14} x2={cx+8} y2={box.y+box.height-14} stroke={stroke} strokeWidth="2" />
          </>
        ) : (
          <>
            <line x1={box.x+5} y1={cy-7} x2={box.x+box.width-5} y2={cy-7} stroke={stroke} strokeWidth="4" />
            <line x1={box.x+14} y1={cy+8} x2={box.x+box.width-14} y2={cy+8} stroke={stroke} strokeWidth="2" />
          </>
        )}
      </g>
    );
  }

  if (kind === "switch") {
    return (
      <g>
        {labelNode}
        <circle cx={box.x+8} cy={cy} r="4" fill={stroke} />
        <circle cx={box.x+box.width-8} cy={cy} r="4" fill={stroke} />
        <line x1={box.x+8} y1={cy} x2={box.x+box.width-18} y2={box.y+8} stroke={stroke} strokeWidth="3" />
      </g>
    );
  }

  if (["lamp", "ammeter", "voltmeter", "motor", "pulley", "circle"].includes(kind)) {
    const radius = Math.max(14, Math.min(box.width, box.height) / 2 - 3);
    const insideLabel = kind === "ammeter" ? "A" : kind === "voltmeter" ? "V" : kind === "motor" ? "M" : label;
    return (
      <g>
        {kind !== "ammeter" && kind !== "voltmeter" && kind !== "motor" ? labelNode : null}
        <circle cx={cx} cy={cy} r={radius} fill="white" stroke={stroke} strokeWidth="3" />
        {kind === "lamp" ? (
          <>
            <line x1={cx-radius*0.55} y1={cy-radius*0.55} x2={cx+radius*0.55} y2={cy+radius*0.55} stroke={stroke} strokeWidth="2" />
            <line x1={cx+radius*0.55} y1={cy-radius*0.55} x2={cx-radius*0.55} y2={cy+radius*0.55} stroke={stroke} strokeWidth="2" />
          </>
        ) : insideLabel ? (
          <text x={cx} y={cy+5} textAnchor="middle" fontSize="16" fontWeight="800" fill={stroke}>{insideLabel}</text>
        ) : null}
      </g>
    );
  }

  if (kind === "inductor" || kind === "coil") {
    const turns = 5;
    const startX = box.x + 8;
    const endX = box.x + box.width - 8;
    const usable = Math.max(20, endX - startX);
    const turnWidth = usable / turns;

    let d = `M ${box.x} ${cy} L ${startX} ${cy}`;

    for (let index = 0; index < turns; index += 1) {
      const x0 = startX + index * turnWidth;
      const x1 = x0 + turnWidth;
      const mid = (x0 + x1) / 2;
      d += ` C ${x0} ${cy - 18}, ${mid} ${cy - 18}, ${mid} ${cy}`;
      d += ` C ${mid} ${cy + 18}, ${x1} ${cy + 18}, ${x1} ${cy}`;
    }

    d += ` L ${box.x + box.width} ${cy}`;

    return (
      <g>
        {labelNode}
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (kind === "oscilloscope") {
    const screenX = box.x + 10;
    const screenY = box.y + 12;
    const screenW = Math.max(45, box.width - 20);
    const screenH = Math.max(28, box.height - 24);
    const waveY = screenY + screenH / 2;

    return (
      <g>
        {labelNode}
        <rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          rx="8"
          fill="white"
          stroke={stroke}
          strokeWidth="3"
        />
        <rect
          x={screenX}
          y={screenY}
          width={screenW}
          height={screenH}
          rx="4"
          fill="#f8fafc"
          stroke="#64748b"
          strokeWidth="1.5"
        />
        <path
          d={`M ${screenX + 5} ${waveY} C ${screenX + screenW * 0.25} ${screenY + 4}, ${screenX + screenW * 0.35} ${screenY + screenH - 4}, ${screenX + screenW * 0.5} ${waveY} C ${screenX + screenW * 0.65} ${screenY + 4}, ${screenX + screenW * 0.75} ${screenY + screenH - 4}, ${screenX + screenW - 5} ${waveY}`}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
        />
      </g>
    );
  }

  if (kind === "terminal") {
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r="5"
          fill="white"
          stroke={stroke}
          strokeWidth="3"
        />
        {label && (
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            fontSize="14"
            fontWeight="800"
            fill={stroke}
          >
            {label}
          </text>
        )}
      </g>
    );
  }

  if (kind === "spring") {
    const points = Array.from({ length: 11 }, (_, index) => {
      const x = box.x + (box.width * index) / 10;
      const y = index === 0 || index === 10 ? cy : cy + (index % 2 === 0 ? -10 : 10);
      return `${x},${y}`;
    }).join(" ");
    return <g>{labelNode}<polyline points={points} fill="none" stroke={stroke} strokeWidth="3" /></g>;
  }

  if (kind === "point") {
    return <g>{labelNode}<circle cx={cx} cy={cy} r="5" fill={stroke} /></g>;
  }

  if (kind === "force" || kind === "vector" || kind === "arrow") {
    const direction = String(element?.direction || "up").toLowerCase();
    const length = Math.max(35, safeNumber(element?.length, 70));
    let x2 = safeNumber(element?.x2, cx);
    let y2 = safeNumber(element?.y2, cy - length);

    if (!Number.isFinite(Number(element?.x2)) || !Number.isFinite(Number(element?.y2))) {
      if (direction === "down") {
        x2 = cx;
        y2 = cy + length;
      } else if (direction === "left") {
        x2 = cx - length;
        y2 = cy;
      } else if (direction === "right") {
        x2 = cx + length;
        y2 = cy;
      } else {
        x2 = cx;
        y2 = cy - length;
      }
    }

    return (
      <g>
        <line
          x1={cx}
          y1={cy}
          x2={x2}
          y2={y2}
          stroke={stroke}
          strokeWidth="3"
          markerEnd={`url(#${arrowMarkerId})`}
        />
        {label && (
          <text
            x={(cx + x2) / 2 + 10}
            y={(cy + y2) / 2 - 8}
            textAnchor="middle"
            fontSize="14"
            fontWeight="800"
            fill={stroke}
          >
            {label}
          </text>
        )}
      </g>
    );
  }

  if (kind === "label") {
    const normalizedLabel = label.replace(/\s+/g, "");
    const looksLikeWeight = /^(?:W|P)=?mg/i.test(normalizedLabel);
    const looksLikeDrag = /^(?:F_?d|f|R)=?/i.test(normalizedLabel);

    // إذا أعاد AI القوة كـ label فقط، نحولها بصريًا إلى سهم بدل نص عائم.
    if (looksLikeWeight || looksLikeDrag) {
      const arrowLength = 58;
      const y1 = looksLikeWeight ? cy - 28 : cy + 28;
      const y2 = looksLikeWeight ? y1 + arrowLength : y1 - arrowLength;

      return (
        <g>
          <line
            x1={cx}
            y1={y1}
            x2={cx}
            y2={y2}
            stroke={stroke}
            strokeWidth="3"
            markerEnd={`url(#${arrowMarkerId})`}
          />
          <text
            x={cx + 16}
            y={(y1 + y2) / 2}
            textAnchor="start"
            fontSize="14"
            fontWeight="800"
            fill={stroke}
          >
            {label}
          </text>
        </g>
      );
    }

    return (
      <text x={cx} y={cy} textAnchor="middle" fontSize="15" fontWeight="700" fill={stroke}>
        {label}
      </text>
    );
  }

  return (
    <g>
      {labelNode}
      <rect x={box.x} y={box.y} width={box.width} height={box.height} rx="6" fill="white" stroke={stroke} strokeWidth="2.5" />
      {label && (
        <text x={cx} y={cy+5} textAnchor="middle" fontSize="14" fontWeight="700" fill={stroke}>{label}</text>
      )}
    </g>
  );
}


function getVisualBounds(
  elements,
  annotations,
  fallbackWidth = 760,
  fallbackHeight = 360,
) {
  const boxes = asArray(elements)
    .map((item) => {
      const box = getElementBox(item);
      const kind = String(
        item?.kind || "",
      ).toLowerCase();

      let minX = box.x;
      let maxX = box.x + box.width;
      let minY = box.y - 28;
      let maxY = box.y + box.height + 18;

      // الأسهم قد تمتد خارج box الأصلي.
      if (
        kind === "force" ||
        kind === "vector" ||
        kind === "arrow"
      ) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const direction = String(
          item?.direction || "up",
        ).toLowerCase();
        const length = Math.max(
          35,
          safeNumber(item?.length, 70),
        );

        let x2 = Number(item?.x2);
        let y2 = Number(item?.y2);

        if (!Number.isFinite(x2) || !Number.isFinite(y2)) {
          x2 = cx;
          y2 = cy;

          if (direction === "down") y2 += length;
          else if (direction === "left") x2 -= length;
          else if (direction === "right") x2 += length;
          else y2 -= length;
        }

        minX = Math.min(minX, cx, x2) - 28;
        maxX = Math.max(maxX, cx, x2) + 55;
        minY = Math.min(minY, cy, y2) - 28;
        maxY = Math.max(maxY, cy, y2) + 28;
      }

      return { minX, minY, maxX, maxY };
    })
    .filter(Boolean);

  const annotationBoxes = asArray(annotations)
    .map((item) => {
      const x = safeNumber(item?.x, 50);
      const y = safeNumber(item?.y, 30);

      return {
        minX: x - 80,
        maxX: x + 80,
        minY: y - 24,
        maxY: y + 18,
      };
    });

  const all = [...boxes, ...annotationBoxes];

  if (all.length === 0) {
    return {
      x: 0,
      y: 0,
      width: Math.max(320, fallbackWidth),
      height: Math.max(180, fallbackHeight),
    };
  }

  const minX = Math.min(
    ...all.map((item) => item.minX),
  );
  const minY = Math.min(
    ...all.map((item) => item.minY),
  );
  const maxX = Math.max(
    ...all.map((item) => item.maxX),
  );
  const maxY = Math.max(
    ...all.map((item) => item.maxY),
  );

  const paddingX = 42;
  const paddingY = 36;

  const x = minX - paddingX;
  const y = minY - paddingY;
  const width = Math.max(
    280,
    maxX - minX + paddingX * 2,
  );
  const height = Math.max(
    150,
    maxY - minY + paddingY * 2,
  );

  return {
    x,
    y,
    width,
    height,
  };
}

function DiagramVisual({ visual }) {
  const reactId = useId().replace(/:/g, "");
  const data = asObject(visual);
  const arrowMarkerId = `visual-arrow-${String(data?.id || "diagram")}-${reactId}`
    .replace(/[^a-zA-Z0-9_-]/g, "-");
  const originalWidth = Math.max(
    320,
    safeNumber(data?.width, 760),
  );
  const originalHeight = Math.max(
    180,
    safeNumber(data?.height, 360),
  );
  const elements = asArray(data?.elements);
  const connections = asArray(data?.connections);
  const annotations = asArray(data?.annotations);
  const byId = new Map(
    elements.map((item) => [
      String(item?.id || ""),
      item,
    ]),
  );

  if (
    elements.length === 0 &&
    annotations.length === 0
  ) {
    return null;
  }

  /*
   * لا نستعمل width/height المرسلة من AI كمساحة بيضاء ثابتة.
   * نحسب إطار الرسم من العناصر نفسها حتى تبقى الدارة
   * في وسط البطاقة وبحجم مقروء.
   */
  const bounds = getVisualBounds(
    elements,
    annotations,
    originalWidth,
    originalHeight,
  );

  const displayAspect =
    bounds.width / Math.max(1, bounds.height);

  const maxDiagramWidth = Math.min(
    900,
    Math.max(420, bounds.width * 1.15),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {hasText(data?.title) && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <MathText className="text-sm font-black text-slate-800">{data.title}</MathText>
        </div>
      )}
      <div
        className="
          flex justify-center
          overflow-x-auto px-4 py-5
        "
      >
        <svg
          viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="
            block h-auto w-full
          "
          style={{
            maxWidth: `${maxDiagramWidth}px`,
            aspectRatio: `${displayAspect}`,
            minHeight: "150px",
            maxHeight: "430px",
          }}
          role="img"
          aria-label={
            data?.title || "رسم توضيحي"
          }
        >
          <defs>
            <marker id={arrowMarkerId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#0f172a" />
            </marker>
          </defs>

          {connections.map((connection, index) => {
            const from = byId.get(String(connection?.from || ""));
            const to = byId.get(String(connection?.to || ""));
            if (!from || !to) return null;
            const p1 = getConnectionPoint(from, to);
            const p2 = getConnectionPoint(to, from);
            const style = String(connection?.style || "wire");
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            return (
              <g key={index}>
                <line
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="#0f172a" strokeWidth="2.5"
                  strokeDasharray={style === "dashed" ? "8 6" : undefined}
                  markerEnd={style === "arrow" ? `url(#${arrowMarkerId})` : undefined}
                />
                {hasText(connection?.label) && (
                  <text x={midX} y={midY-8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#334155">
                    {connection.label}
                  </text>
                )}
              </g>
            );
          })}

          {elements.map((element, index) => (
            <DiagramElement
              key={element?.id ?? index}
              element={element}
              arrowMarkerId={arrowMarkerId}
            />
          ))}

          {annotations.map((annotation, index) => (
            <text
              key={index}
              x={safeNumber(annotation?.x, 50)}
              y={safeNumber(annotation?.y, 30)}
              fontSize="14"
              fontWeight="700"
              fill="#334155"
              textAnchor="middle"
            >
              {annotation?.text || ""}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function VisualsBlock({ value, className = "" }) {
  const visuals = asArray(value).filter((item) => item && typeof item === "object");
  if (visuals.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {visuals.map((visual, index) => {
        if (visual?.renderer === "server-math-v1" && typeof visual?.svg === "string") {
          return <ServerMathVisual key={visual.id ?? index} visual={visual} />;
        }
        const type = String(visual?.type || "").toLowerCase();
        if (
          type === "variation_table" ||
          type === "variations" ||
          type === "sign_variation_table" ||
          isVariationTableData(visual)
        ) {
          return (
            <VariationTable
              key={visual?.id ?? index}
              table={visual}
            />
          );
        }
        if (type === "graph") {
          return <GraphBlock key={visual?.id ?? index} graph={visual} />;
        }
        if (type === "table") {
          return <DataTable key={visual?.id ?? index} table={visual} />;
        }
        if (visual?.coordinate_system === "complex_plane") {
          return <ComplexPlaneVisual key={visual?.id ?? index} visual={visual} />;
        }
        if (type === "circuit" || type === "diagram") {
          return <DiagramVisual key={visual?.id ?? index} visual={visual} />;
        }
        return null;
      })}
    </div>
  );
}


function DocumentAssetCard({ document, number }) {
  if (!document || typeof document !== "object") {
    return null;
  }

  const type = String(
    document?.type || "document",
  ).toLowerCase();

  const title =
    document?.title ||
    `الوثيقة ${number}`;

  const caption =
    document?.caption ||
    document?.description ||
    "";

  const path =
    document?.path ||
    document?.url ||
    document?.src ||
    "";

  const assetUrl =
    resolveDocumentAssetUrl(path);

  const table = asObject(document?.table);
  const graph = asObject(document?.graph);

  return (
    <article
      className="
        overflow-hidden rounded-2xl
        border border-slate-200
        bg-white shadow-sm
      "
    >
      <div
        className="
          flex items-center justify-between
          gap-3 border-b border-slate-200
          bg-slate-50 px-4 py-3
        "
      >
        <div>
          <p className="text-xs font-black text-blue-700">
            {document?.reuse_unchanged ? "وثيقة أصلية" : `الوثيقة ${number}`}
          </p>
          <h4 className="mt-1 font-black text-slate-950">
            {title}
          </h4>
        </div>

        {hasText(document?.ref_id) && (
          <span
            className="
              rounded-full bg-blue-100
              px-3 py-1 text-[11px]
              font-black text-blue-700
            "
          >
            مرجع أصلي
          </span>
        )}
      </div>

      <div className="p-3 sm:p-4">
        {type === "image" && assetUrl && (
          <a
            href={assetUrl}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-xl border border-slate-200 bg-white"
            title="فتح الوثيقة بالحجم الكامل"
          >
            <img
              src={assetUrl}
              alt={title}
              loading="lazy"
              className="
                mx-auto max-h-[560px]
                w-full object-contain
                p-2 sm:p-3
              "
            />
          </a>
        )}

        {type === "table" && Object.keys(table).length > 0 && (
          <DataTable
            table={{
              title,
              ...table,
            }}
          />
        )}

        {type === "graph" && Object.keys(graph).length > 0 && (
          <GraphBlock
            graph={{
              title,
              ...graph,
            }}
          />
        )}

        {type !== "image" &&
          type !== "table" &&
          type !== "graph" &&
          assetUrl && (
            <a
              href={assetUrl}
              target="_blank"
              rel="noreferrer"
              className="
                inline-flex min-h-10
                items-center rounded-xl
                border border-blue-200
                bg-blue-50 px-4 py-2
                text-sm font-black
                text-blue-800
                transition hover:bg-blue-100
              "
            >
              فتح الوثيقة
            </a>
          )}

        {hasText(caption) && (
          <MathText
            className="
              mt-3 text-sm font-semibold
              leading-7 text-slate-600
            "
          >
            {caption}
          </MathText>
        )}
      </div>
    </article>
  );
}

function DocumentAssetsBlock({ documents, className = "" }) {
  const items = asArray(documents).filter(
    (item) => item && typeof item === "object",
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <BookOpen size={18} className="text-blue-700" />
        <h4 className="font-black text-slate-950">
          الوثائق المستعملة في التمرين
        </h4>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((document, index) => (
          <DocumentAssetCard
            key={document?.ref_id ?? index}
            document={document}
            number={index + 1}
          />
        ))}
      </div>
    </section>
  );
}

function DocumentReferenceChips({
  refs,
  documents,
  className = "",
}) {
  const items = asArray(refs)
    .map((ref) => ({
      ref,
      document: getDocumentByRef(documents, ref),
    }))
    .filter((item) => item.document);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map(({ ref, document }) => (
        <span
          key={String(ref)}
          className="
            rounded-full border border-blue-200
            bg-blue-50 px-3 py-1
            text-xs font-black text-blue-800
          "
        >
          {document?.title || "وثيقة"}
        </span>
      ))}
    </div>
  );
}

export default function GeneratedBacExercisesPage({
  chapterId,
  branchCode,
  subjectCode = "",
  onTutorExerciseChange,
  onTutorQuestionChange,
  onTutorStepChange,
  onTutorViewStateChange,
}) {
  const { token } = useContext(UserContext);

  const solutionInFlight = useRef(false);
  const pendingGeneration = useRef(null);
  const generationInFlight = useRef(false);
  const currentScope = useRef("");
  currentScope.current = `${chapterId}:${branchCode}:${subjectCode}:${token}`;
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
  const [aiCooldownSeconds, setAiCooldownSeconds] =
    useState(0);

  useEffect(() => {
    if (aiCooldownSeconds <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setAiCooldownSeconds((previous) =>
        Math.max(0, previous - 1),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [aiCooldownSeconds]);

  const registerRateLimit = useCallback(
    (requestError) => {
      const seconds = getRetryAfterSeconds(requestError);
      if (seconds > 0) {
        setAiCooldownSeconds((previous) =>
          Math.max(previous, seconds),
        );
      }
    },
    [],
  );

  // حالة إعادة شرح حل السؤال. التاريخ نفسه يأتي من قاعدة البيانات
  // داخل currentRecord.re_explanations.
  const [reExplainLoading, setReExplainLoading] =
    useState({});
  const [reExplainErrors, setReExplainErrors] =
    useState({});

  const currentRecord =
    records[activeIndex] || null;

  useEffect(() => {
    if (!currentRecord) {
      onTutorExerciseChange?.(null);
      onTutorQuestionChange?.(null);
      onTutorStepChange?.(null);
      return;
    }

    const payload = getExercisePayload(currentRecord);

    onTutorExerciseChange?.({
      kind: "generated_bac_exercise",
      id: currentRecord.id,
      title:
        currentRecord.title ||
        payload.title ||
        `تمرين شبيه بالبكالوريا ${activeIndex + 1}`,
      text:
        payload.statement ||
        payload.text ||
        "",
      branch:
        currentRecord?.branch?.code ||
        payload?.branch_code ||
        branchCode ||
        "",
      reference_exercise_ids:
        currentRecord.reference_exercise_ids || [],
      subject_key:
        payload?.meta?.subject_key ||
        currentRecord?.subject_key ||
        subjectCode ||
        "generic",
      document_refs:
        asArray(payload?.document_refs),
    });

    onTutorQuestionChange?.(null);
    onTutorStepChange?.(null);
  }, [
    currentRecord,
    activeIndex,
    branchCode,
    subjectCode,
    onTutorExerciseChange,
    onTutorQuestionChange,
    onTutorStepChange,
  ]);

  useEffect(() => {
    onTutorViewStateChange?.({
      solution_visible: showSolution,
      alternative_solution_visible: false,
      visible_hints: 0,
      showing_reexplanation: false,
    });
  }, [showSolution, onTutorViewStateChange]);

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
    hasText(branchCode) &&
    aiCooldownSeconds <= 0,
  );

  const fetchGeneratedExercises =
    useCallback(async () => {
      const listScope = currentScope.current;
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
          response.data?.results ??
            response.data,
        );

        if (currentScope.current !== listScope) return;
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
        if (currentScope.current === listScope) setLoadingList(false);
      }
    }, [
      token,
      chapterId,
      branchCode,
      authHeaders,
    ]);

  useEffect(() => {
    setRecords([]);
    setShowSolution(false);
    fetchGeneratedExercises();
  }, [fetchGeneratedExercises]);

  const handleGenerateExercise =
    async () => {
      if (generationInFlight.current || creatingExercise) {
        return;
      }

      if (aiCooldownSeconds > 0) {
        setError(
          `تم الوصول مؤقتًا إلى حد التوليد. أعد المحاولة بعد ${aiCooldownSeconds} ثانية.`,
        );
        return;
      }

      if (!canGenerate) {
        setError(
          "يجب تسجيل الدخول وتحديد الوحدة والشعبة.",
        );
        return;
      }

      const scope = `${chapterId}:${branchCode}:${subjectCode}:${token}`;
      if (!pendingGeneration.current || pendingGeneration.current.scope !== scope) {
        pendingGeneration.current = {
          scope,
          key: globalThis.crypto?.randomUUID?.() ||
            `bac-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
      }
      generationInFlight.current = true;
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
            subject_code: hasText(subjectCode)
              ? subjectCode
              : "auto",
            // قالب بكالوريا واحد فقط حتى يبقى نفس نوع الأسئلة ولا تختلط
            // بنيات مواضيع مختلفة داخل تمرين واحد.
            references_count: 1,
            selection_strategy:
              "random",
          },
          {
            headers: {
              ...authHeaders,
              "Content-Type":
                "application/json",
            },
            timeout: 300000,
          },
        );

        const created = response.data;
        if (currentScope.current !== scope) return;
        pendingGeneration.current = null;

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
          "التمرين وحله جاهزان. يمكنك البدء ثم فتح الحل عند الحاجة.",
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

        if (requestError?.response?.status === 429) {
          registerRateLimit(requestError);
        }

        setError(
          getErrorMessage(
            requestError,
            "تعذر إنشاء التمرين.",
          ),
        );
      } finally {
        generationInFlight.current = false;
        setCreatingExercise(false);
      }
    };

  const handleGenerateSolution = async () => {
    if (!currentRecord?.id || creatingSolution || solutionInFlight.current) {
      return;
    }

    const existingSolution =
      getSolutionPayload(currentRecord);

    if (Object.keys(existingSolution).length > 0) {
      setError("");
      setSuccessMessage("");
      setShowSolution((previous) => !previous);
      return;
    }

    if (aiCooldownSeconds > 0) {
      setError(
        `مزود الذكاء الاصطناعي في فترة تهدئة. أعد المحاولة بعد ${aiCooldownSeconds} ثانية.`,
      );
      return;
    }

    try {
      setCreatingSolution(true);
      setError("");
      setSuccessMessage("");
      setShowSolution(false);

      solutionInFlight.current = true;
      const solutionScope = currentScope.current;
      const targetId = currentRecord.id;
      const total = getExerciseQuestions(currentRecord).length;
      let done = false;
      for (let attempt = 0; attempt < total + 2; attempt += 1) {
        if (currentScope.current !== solutionScope) break;
        const response = await axios.post(
          `${GENERATED_BAC_BASE_URL}/${targetId}/generate-solution/`,
          {regenerate: false},
          {headers: {...authHeaders, "Content-Type": "application/json"}, timeout: 150000},
        );
        if (currentScope.current !== solutionScope) break;
        const updated = response.data;
        setRecords(previous => previous.map(item => Number(item?.id) === Number(updated?.id) ? updated : item));
        const progress = updated.solution_progress;
        done = progress ? progress.complete : updated.has_solution;
        if (done) {
          setShowSolution(true);
          setSuccessMessage("تم إنشاء الحل كاملًا وحفظه.");
          break;
        }
        setSuccessMessage(`تم حفظ حل ${progress?.completed || 0} من ${progress?.total || total} أسئلة. جارٍ الاستكمال…`);
      }
      if (!done && currentScope.current === solutionScope) {
        setSuccessMessage("حُفظ التقدم. اضغط إنشاء الحل للاستكمال.");
      }
    } catch (requestError) {
      console.error(
        "Generate bac solution error:",
        requestError,
      );

      if (requestError?.response?.status === 429) {
        registerRateLimit(requestError);
      }

      setError(
        getErrorMessage(
          requestError,
          "تعذر إنشاء الحل.",
        ),
      );
    } finally {
      solutionInFlight.current = false;
      setCreatingSolution(false);
    }
  };

  const handleReExplainSolution = async (
    question,
  ) => {
    if (question) {
      onTutorQuestionChange?.({
        id: question.id,
        code: question.code || "",
        number:
          question.number ??
          question.display_order ??
          "",
        title: question.title || "",
        text:
          question.text ||
          question.statement ||
          "",
      });
      onTutorStepChange?.(null);
      onTutorViewStateChange?.({
        showing_reexplanation: true,
      });
    }
    if (
      !currentRecord?.id ||
      !question?.id
    ) {
      return;
    }

    const key =
      `${currentRecord.id}:${question.id}`;

    if (reExplainLoading[key]) {
      return;
    }

    if (aiCooldownSeconds > 0) {
      setReExplainErrors((previous) => ({
        ...previous,
        [key]: `أعد المحاولة بعد ${aiCooldownSeconds} ثانية.`,
      }));
      return;
    }

    try {
      setReExplainLoading((previous) => ({
        ...previous,
        [key]: true,
      }));

      setReExplainErrors((previous) => ({
        ...previous,
        [key]: "",
      }));

      const response = await axios.post(
        `${GENERATED_BAC_BASE_URL}/${currentRecord.id}/questions/${question.id}/re-explain-solution/`,
        {},
        {
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          timeout: 120000,
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

    } catch (requestError) {
      console.error(
        "Re-explain question solution error:",
        requestError,
      );

      if (requestError?.response?.status === 429) {
        registerRateLimit(requestError);
      }

      setReExplainErrors((previous) => ({
        ...previous,
        [key]: getErrorMessage(
          requestError,
          "تعذر إعادة شرح الحل حاليًا.",
        ),
      }));
    } finally {
      setReExplainLoading((previous) => ({
        ...previous,
        [key]: false,
      }));
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
      <style>{`
        .math-content,
        .math-content * {
          max-width: 100%;
        }

        .math-content mjx-container[display="true"] {
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0.35rem 0;
        }

        .math-content mjx-container {
          direction: ltr;
          text-align: center;
          unicode-bidi: isolate;
        }

        .math-content mjx-container:not([display="true"]) {
          display: inline-block !important;
          margin-inline: 0.18rem !important;
          vertical-align: middle;
        }

        img,
        svg,
        canvas {
          max-width: 100%;
          height: auto;
        }

        @media (max-width: 359px) {
          .math-content {
            font-size: 0.92rem;
          }
        }
      `}</style>

      <main
        dir="rtl"
        className="
          min-h-full w-full min-w-0
          overflow-x-hidden bg-slate-100
          px-2 py-3 min-[360px]:px-3
          min-[360px]:py-4 sm:px-5
          sm:py-5 lg:px-8
        "
      >
        <div
          className="
            mx-auto w-full min-w-0
            max-w-7xl
          "
        >
          <GeneratedPageHeader
            chapterId={chapterId}
            branchCode={branchCode}
            count={records.length}
            creating={creatingExercise}
            disabled={!canGenerate}
            cooldownSeconds={aiCooldownSeconds}
            onGenerate={handleGenerateExercise}
          />

          <div
            className="
              mt-4 grid min-w-0
              grid-cols-1 items-start
              gap-4 sm:mt-5 sm:gap-5
              lg:grid-cols-[280px_minmax(0,1fr)]
              xl:grid-cols-[300px_minmax(0,1fr)]
            "
          >
            <GeneratedHistorySidebar
              records={records}
              activeIndex={activeIndex}
              creating={creatingExercise}
              cooldownSeconds={aiCooldownSeconds}
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
                  cooldownSeconds={aiCooldownSeconds}
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
                    cooldownSeconds={aiCooldownSeconds}
                    showSolution={showSolution}
                    onClick={
                      handleGenerateSolution
                    }
                  />

                  {showSolution && (
                    <GeneratedSolutionDocument
                      record={currentRecord}
                      reExplainLoading={
                        reExplainLoading
                      }
                      reExplainErrors={
                        reExplainErrors
                      }
                      onReExplain={
                        handleReExplainSolution
                      }
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
  cooldownSeconds = 0,
  onGenerate,
}) {
  return (
    <header
      className="
        w-full min-w-0 overflow-hidden
        rounded-2xl border
        border-slate-200 bg-white
        shadow-sm sm:rounded-3xl
      "
    >
      <div
        className="
          bg-gradient-to-l
          from-[#15123a] via-slate-900
          to-blue-950 px-4 py-5
          text-white min-[360px]:px-5
          min-[360px]:py-6 sm:px-8
          sm:py-7
        "
      >
        <div
          className="
            flex flex-col justify-between
            gap-6 lg:flex-row
            lg:items-center
          "
        >
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
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

            <div className="min-w-0">
              <div
                className="
                  inline-flex items-center gap-2
                  rounded-full bg-blue-500/15
                  px-3 py-1 text-xs
                  font-black text-blue-100
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
                  mt-2 max-w-2xl
                  text-sm font-semibold
                  leading-7 text-slate-300
                "
              >
                عرض منظم للأسئلة والجداول
                والمنحنيات، مع حل مفصل لكل
                سؤال بصورة مستقلة.
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
              transition hover:bg-blue-500
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
            ) : cooldownSeconds > 0 ? (
              <>
                <Clock3 size={20} />
                أعد المحاولة بعد {cooldownSeconds} ث
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
          flex flex-wrap items-center
          gap-3 border-t
          border-slate-100 px-5
          py-4 sm:px-8
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
          label="التمارين"
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
        rounded-xl border
        border-slate-200 bg-slate-50
        px-3 py-2
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
  cooldownSeconds = 0,
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
                    bg-blue-50 shadow-sm
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

                {(record?.has_solution ||
                  getExerciseQuestions(
                    record,
                  ).some(
                    (item) =>
                      Object.keys(
                        asObject(
                          item?.solution,
                        ),
                      ).length > 0,
                  )) && (
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
                  getExercisePayload(record)
                    ?.title ||
                  "تمرين مولد"}
              </p>

              <p
                className="
                  mt-2 flex items-center
                  gap-1 text-[11px]
                  font-bold text-slate-400
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
          disabled={creating || cooldownSeconds > 0}
          className="
            inline-flex w-full
            items-center justify-center
            gap-2 rounded-xl
            bg-slate-900 px-4 py-3
            text-sm font-black text-white
            transition hover:bg-slate-800
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
          {cooldownSeconds > 0
            ? `انتظر ${cooldownSeconds} ث`
            : "تمرين جديد"}
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
        gap-3 rounded-xl border
        border-slate-200 bg-white
        p-3 shadow-sm
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
          px-4 py-2 text-sm
          font-black text-slate-700
          transition hover:bg-slate-50
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
          px-4 py-2 text-sm
          font-black text-slate-700
          transition hover:bg-slate-50
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
  const documents = getExerciseDocuments(record);

  const parsedStatement =
    extractInlineStatementTable(
      exercise?.statement,
    );

  const normalizedStatement =
    normalizeMathText(
      parsedStatement.text,
    ).trim();

  const fallbackStatementGraph =
    buildFallbackStatementGraph(exercise);

  const statementEquationSignatures =
    new Set(
      extractEquationSignatures(
        exercise?.statement,
      ),
    );

  const normalizedStatementForDedupe =
    normalizeForContentDedupe(
      exercise?.statement,
    );

  const sections = asArray(
    exercise?.statement_sections,
  ).filter((section) => {
    if (!hasText(section?.text)) {
      return false;
    }

    const sectionText =
      normalizeMathText(
        section.text,
      ).trim();

    if (!sectionText) {
      return false;
    }

    const sectionForDedupe =
      normalizeForContentDedupe(
        sectionText,
      );

    if (!sectionForDedupe) {
      return false;
    }

    const sectionSignatures =
      extractEquationSignatures(
        section?.text,
      );

    if (
      sectionSignatures.length > 0 &&
      sectionSignatures.every((signature) =>
        statementEquationSignatures.has(signature),
      )
    ) {
      return false;
    }

    /*
     * منع تكرار نص التمرين نفسه داخل
     * statement_sections حتى لو اختلفت
     * delimiters أو الفراغات أو شكل الصيغة.
     */
    return (
      sectionForDedupe !==
        normalizedStatementForDedupe &&
      !normalizedStatementForDedupe.includes(
        sectionForDedupe,
      )
    );
  });

  return (
    <article
      data-tutor-context
      data-tutor-exercise-kind="generated_bac_exercise"
      data-tutor-exercise-id={record?.id ?? ""}
      data-tutor-title={record?.title || exercise?.title || "تمرين شبيه بالبكالوريا"}
      className="
        overflow-hidden rounded-2xl
        border border-slate-300
        bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)]
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
                  px-3 py-1 text-xs
                  font-black text-violet-700
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
                  exercise?.branch?.name ||
                  record?.branch?.code ||
                  exercise?.branch_code ||
                  "—"}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="min-w-0 px-3 py-5 min-[360px]:px-4 sm:px-9 sm:py-9">
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
            {hasText(parsedStatement.text) && (
              <RichMathText
                className="
                  text-[1.03rem]
                  font-semibold leading-10
                  text-slate-950 sm:text-lg
                "
              >
                {parsedStatement.text}
              </RichMathText>
            )}

            {parsedStatement.table && (
              <DataTable
                table={parsedStatement.table}
              />
            )}

            {fallbackStatementGraph && (
              <GraphBlock
                graph={fallbackStatementGraph}
              />
            )}

            {sections.map(
              (section, index) => (
                <div
                  key={section?.id ?? index}
                  className="
                    rounded-xl border-r-4
                    border-blue-500
                    bg-blue-50/60 px-4 py-3
                  "
                >
                  {hasText(
                    section?.title,
                  ) && (
                    <p className="mb-2 text-sm font-black text-blue-800">
                      {section.title}
                    </p>
                  )}

                  <RichMathText
                    className="
                      font-semibold leading-9
                      text-slate-900
                    "
                  >
                    {section?.text}
                  </RichMathText>
                </div>
              ),
            )}

            <DocumentAssetsBlock
              documents={documents}
              className="pt-2"
            />

            <GraphsBlock
              value={
                exercise?.statement_graph_data
              }
            />

            <VisualsBlock
              value={exercise?.visuals}
            />
          </div>
        </section>

        <section
          className="
            mt-6 overflow-hidden
            rounded-2xl border
            border-blue-200
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
            {questions.map((item, index) => (
              <article
                key={item?.id ?? index}
                data-tutor-context
                data-tutor-exercise-kind="generated_bac_exercise"
                data-tutor-exercise-id={record?.id ?? ""}
                data-tutor-question-id={item?.id ?? item?.question_id ?? index + 1}
                data-tutor-question-number={item?.number ?? item?.display_order ?? index + 1}
                data-tutor-question-title={item?.title || `السؤال ${index + 1}`}
                className="
                  bg-white px-4 py-5
                  sm:px-6
                "
              >
                <div className="flex items-start gap-4">
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
                      {item?.text}
                    </MathText>

                    <DocumentReferenceChips
                      refs={item?.document_refs}
                      documents={documents}
                      className="mt-3"
                    />

                    <VisualsBlock
                      value={item?.visuals}
                      className="mt-4"
                    />

                    <TablesBlock
                      value={item?.table_data}
                      className="mt-5"
                    />

                    <GraphsBlock
                      value={item?.graph_data}
                      className="mt-5"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

function SolutionAction({
  record,
  loading = false,
  cooldownSeconds = 0,
  showSolution,
  onClick,
}) {
  const hasSolution = Boolean(
    Object.keys(
      getSolutionPayload(record),
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
            ? "الحل جاهز"
            : "هل تريد مشاهدة الحل؟"}
        </h3>

        <p
          className="
            mt-1 text-sm font-semibold
            leading-7 text-slate-500
          "
        >
          {hasSolution
            ? "يمكنك إظهار الحل أو إخفاؤه دون إعادة توليده."
            : "حاول حل التمرين أولًا، ثم أنشئ الحل عندما تحتاجه."}
        </p>
      </div>

      <button
        type="button"
        onClick={onClick}
        disabled={loading || (!hasSolution && cooldownSeconds > 0)}
        className={cn(
          `
            inline-flex min-h-12
            items-center justify-center
            gap-2 rounded-xl
            px-6 py-3 text-sm
            font-black transition
          `,
          loading
            ? "cursor-not-allowed bg-slate-300 text-slate-600"
            : showSolution
              ? `
                border border-slate-300
                bg-white text-slate-700
                hover:bg-slate-50
              `
              : `
                bg-emerald-700 text-white
                shadow-md hover:bg-emerald-800
              `,
        )}
      >
        {loading ? (
          <Loader2
            size={19}
            className="animate-spin"
          />
        ) : (
          <CheckCircle2 size={19} />
        )}
        {loading
          ? "جارٍ إنشاء الحل..."
          : hasSolution
            ? showSolution
              ? "إخفاء الحل"
              : "إظهار الحل"
            : cooldownSeconds > 0
              ? `أعد المحاولة بعد ${cooldownSeconds} ث`
              : "إنشاء الحل"}
      </button>
    </div>
  );
}

function GeneratedSolutionDocument({
  record,
  reExplainLoading = {},
  reExplainErrors = {},
  onReExplain,
}) {
  const solution =
    getSolutionPayload(record);
  const questions =
    getExerciseQuestions(record);
  const documents =
    getExerciseDocuments(record);

  const hasAnySolution =
    Object.keys(solution).length > 0 ||
    questions.some(
      (item) =>
        Object.keys(
          asObject(item?.solution),
        ).length > 0,
    );

  if (!hasAnySolution) {
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

      <div className="min-w-0 px-3 py-5 min-[360px]:px-4 sm:px-9 sm:py-7">
        {hasText(
          solution?.general_strategy,
        ) && (
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
                mt-3 font-semibold
                leading-9 text-slate-800
              "
            >
              {solution.general_strategy}
            </MathText>
          </div>
        )}

        <div className="min-w-0 space-y-7">
          {questions.map(
            (item, index) => (
              <QuestionSolution
                key={item?.id ?? index}
                recordId={record?.id}
                number={index + 1}
                question={item}
                solution={getQuestionSolution(
                  record,
                  item,
                )}
                documents={documents}
                reExplanations={
                  asArray(
                    record?.re_explanations,
                  ).filter(
                    (entry) =>
                      String(entry?.question_id) ===
                      String(item?.id),
                  )
                }
                reExplainLoading={Boolean(
                  reExplainLoading[
                    `${record?.id}:${item?.id}`
                  ],
                )}
                reExplainError={
                  reExplainErrors[
                    `${record?.id}:${item?.id}`
                  ] || ""
                }
                onReExplain={() =>
                  onReExplain?.(item)
                }
              />
            ),
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
  recordId,
  number,
  question,
  solution,
  documents = [],
  reExplanations = [],
  reExplainLoading = false,
  reExplainError = "",
  onReExplain,
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
    solution?.bac_writing ??
      solution?.methodology
        ?.formal_writing,
  );

  return (
    <section
      data-tutor-context
      data-tutor-exercise-kind="generated_bac_exercise"
      data-tutor-exercise-id={recordId ?? ""}
      data-tutor-question-id={question?.id ?? question?.question_id ?? number}
      data-tutor-question-number={question?.number ?? question?.display_order ?? number}
      data-tutor-question-title={question?.title || `السؤال ${number}`}
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
            mt-5 rounded-xl border
            border-slate-200 bg-slate-50
            px-4 py-4
          "
        >
          <p
            className="
              text-xs font-black
              text-slate-600
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

      <DocumentReferenceChips
        refs={solution?.document_refs}
        documents={documents}
        className="mt-5"
      />

      <DocumentAssetsBlock documents={solution?.documents} />
      <VisualsBlock
        value={solution?.visuals}
        className="mt-5"
      />

      {solution?.visual_required && solution?.visual_missing && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold leading-7 text-amber-900">
            هذا السؤال يحتاج تمثيلًا بصريًا، لكن النموذج لم يرجع بيانات الرسم. أعد توليد الحل إذا أردت الرسم الكامل.
          </p>
        </div>
      )}

      {steps.length > 0 && (
        <div className="mt-6 space-y-5">
          {steps.map((step, index) => (
            <div
              key={
                step?.step_number ?? index
              }
              data-tutor-context
              data-tutor-exercise-kind="generated_bac_exercise"
              data-tutor-exercise-id={recordId ?? ""}
              data-tutor-question-id={question?.id ?? question?.question_id ?? number}
              data-tutor-question-number={question?.number ?? question?.display_order ?? number}
              data-tutor-step-id={step?.id ?? step?.step_id ?? step?.step_number ?? index + 1}
              data-tutor-step-number={step?.step_number ?? step?.number ?? index + 1}
              data-tutor-step-title={step?.title || `الخطوة ${index + 1}`}
              data-tutor-step-type="generated_bac_solution_step"
              className="
                rounded-xl border
                border-slate-200
                bg-white px-4 py-4
                sm:px-5
              "
            >
              <div className="flex items-start gap-3">
                <span
                  className="
                    flex h-8 w-8 shrink-0
                    items-center justify-center
                    rounded-full bg-slate-900
                    text-sm font-black
                    text-white
                  "
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  {hasText(
                    step?.title,
                  ) && (
                    <MathText
                      className="
                        font-black
                        text-slate-950
                      "
                    >
                      {step.title}
                    </MathText>
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

                  <FormulaBlock
                    value={step?.latex}
                  />

                  <TablesBlock
                    value={
                      step?.table_data
                    }
                    className="mt-4"
                  />

                  <GraphsBlock
                    value={
                      step?.graph_data
                    }
                    className="mt-4"
                  />

                  <DocumentReferenceChips
                    refs={step?.document_refs}
                    documents={documents}
                    className="mt-4"
                  />

                  <VisualsBlock
                    value={step?.visuals}
                    className="mt-4"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TablesBlock
        value={solution?.table_data}
        className="mt-6"
      />

      <GraphsBlock
        value={solution?.graph_data}
        className="mt-6"
      />

      {hasText(
        solution?.detailed_explanation,
      ) && (
        <div
          className="
            mt-6 rounded-xl
            border border-slate-200
            bg-slate-50 px-4 py-4
          "
        >
          <p className="text-xs font-black text-slate-500">
            شرح إضافي
          </p>
          <MathText
            className="
              mt-2 font-semibold
              leading-8 text-slate-700
            "
          >
            {solution.detailed_explanation}
          </MathText>
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
            <MathResult
              value={solution.final_answer}
              className="
                font-black leading-9
                text-emerald-950
              "
            />
          </div>
        </div>
      )}

      <div
        className="
          mt-5 grid gap-4
          md:grid-cols-2
        "
      >
        {hasText(
          solution?.verification,
        ) && (
          <InfoCard
            type="success"
            title="التحقق"
            items={[
              solution.verification,
            ]}
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

      <QuestionSolutionReExplainSection
        history={reExplanations}
        loading={reExplainLoading}
        error={reExplainError}
        onClick={onReExplain}
      />
    </section>
  );
}

function QuestionSolutionReExplainSection({
  history,
  loading,
  error,
  onClick,
}) {
  const items = asArray(history)
    .slice()
    .sort(
      (a, b) =>
        Number(a?.attempt_number ?? 0) -
        Number(b?.attempt_number ?? 0),
    );

  return (
    <div
      className="
        mt-7 rounded-2xl border
        border-blue-200 bg-blue-50/40
        px-4 py-4 sm:px-5
      "
    >
      <div
        className="
          flex flex-col gap-3
          sm:flex-row sm:items-center
          sm:justify-between
        "
      >
        <div>
          <h4 className="font-black text-slate-950">
            هل الحل ما زال غير واضح؟
          </h4>
          <p
            className="
              mt-1 text-sm font-semibold
              leading-7 text-slate-600
            "
          >
            أعد شرح حل هذا السؤال كاملًا بطريقة أبسط جدًا.
          </p>
        </div>

        <button
          type="button"
          onClick={onClick}
          disabled={loading}
          className="
            inline-flex min-h-11 shrink-0
            items-center justify-center gap-2
            rounded-xl bg-blue-700
            px-5 py-2.5 text-sm
            font-black text-white
            transition hover:bg-blue-800
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {loading ? (
            <Loader2
              size={18}
              className="animate-spin"
            />
          ) : (
            <HelpCircle size={18} />
          )}

          {loading
            ? "جارٍ إعادة الشرح..."
            : items.length > 0
              ? "أعد الشرح مرة أخرى"
              : "لم أفهم الحل"}
        </button>
      </div>

      {error && (
        <p
          className="
            mt-3 rounded-xl bg-rose-50
            px-3 py-2 text-sm
            font-bold text-rose-700
          "
        >
          {error}
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-5 space-y-5">
          {items.map((entry) => (
            <SolutionReExplanationCard
              key={entry?.id}
              entry={entry}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SolutionReExplanationCard({
  entry,
}) {
  const data = asObject(entry?.explanation);
  const steps = asArray(data?.steps);

  return (
    <article
      className="
        overflow-hidden rounded-2xl
        border border-blue-200 bg-white
      "
    >
      <div
        className="
          flex items-center justify-between
          gap-3 border-b border-blue-100
          bg-blue-50 px-4 py-3
        "
      >
        <div>
          <p className="text-sm font-black text-blue-950">
            إعادة الشرح {entry?.attempt_number || 1}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-blue-700">
            محفوظة ويمكنك الرجوع إليها لاحقًا
          </p>
        </div>

        {entry?.created_at && (
          <span className="text-xs font-semibold text-slate-500">
            {formatDate(entry.created_at)}
          </span>
        )}
      </div>

      <div className="space-y-5 px-4 py-4 sm:px-5">
        {hasText(data?.simple_idea) && (
          <div
            className="
              rounded-xl border border-amber-200
              bg-amber-50 px-4 py-3
            "
          >
            <p className="text-xs font-black text-amber-800">
              الفكرة ببساطة
            </p>
            <MathText
              className="
                mt-2 font-semibold leading-8
                text-slate-800
              "
            >
              {data.simple_idea}
            </MathText>
          </div>
        )}

        <DocumentAssetsBlock documents={data?.documents} />
        <VisualsBlock value={data?.visuals} />

        {steps.length > 0 && (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={
                  step?.step_number ?? index
                }
                className="
                  rounded-xl border
                  border-slate-200 bg-slate-50
                  px-4 py-4
                "
              >
                <div className="flex items-start gap-3">
                  <span
                    className="
                      flex h-7 w-7 shrink-0
                      items-center justify-center
                      rounded-full bg-blue-700
                      text-xs font-black text-white
                    "
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    {hasText(step?.title) && (
                      <MathText className="font-black text-slate-950">
                        {step.title}
                      </MathText>
                    )}

                    {hasText(step?.explanation) && (
                      <MathText
                        className="
                          mt-1 font-semibold
                          leading-8 text-slate-700
                        "
                      >
                        {step.explanation}
                      </MathText>
                    )}

                    <FormulaBlock value={step?.latex} />

                    <VisualsBlock
                      value={step?.visuals}
                      className="mt-3"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasText(data?.final_answer) && (
          <div
            className="
              rounded-xl border
              border-emerald-200 bg-emerald-50
              px-4 py-3
            "
          >
            <p className="text-xs font-black text-emerald-800">
              النتيجة
            </p>
            <MathResult
              value={data.final_answer}
              className="mt-2 font-black text-emerald-950"
            />
          </div>
        )}
      </div>
    </article>
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
          (item, index) => {
            const text =
              typeof item === "string"
                ? item
                : item?.text;

            if (!hasText(text)) {
              return null;
            }

            return (
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
                  {text}
                </MathText>
              </li>
            );
          },
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

  const labels = {
    all_questions_answered: "اكتمال الحل",
    mathematical_consistency: "الاتساق الرياضي",
    dependency_consistency: "ترابط النتائج",
    units_consistency: "التحقق من الوحدات",
    final_result_consistency: "صحة النتيجة النهائية",
  };

  const entries = Object.entries(data)
    .map(([key, value]) => {
      if (typeof value === "boolean") {
        return {
          key,
          title: labels[key] || "التحقق",
          text: value
            ? "تم التحقق بنجاح."
            : "يحتاج إلى مراجعة.",
          ok: value,
        };
      }

      if (!hasText(value)) {
        return null;
      }

      return {
        key,
        title:
          labels[key] ||
          key
            .replaceAll("_", " ")
            .replace(/\b\w/g, (char) =>
              char.toUpperCase(),
            ),
        text: value,
        ok: true,
      };
    })
    .filter(Boolean);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section
      className="
        mt-8 border-t border-slate-200
        pt-6
      "
    >
      <div className="flex items-center gap-2">
        <span
          className="
            flex h-8 w-8 items-center
            justify-center rounded-full
            bg-emerald-50
          "
        >
          <CheckCircle2
            size={19}
            className="text-emerald-700"
          />
        </span>
        <div>
          <h3 className="font-black text-slate-950">
            التحقق النهائي
          </h3>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            مراجعة مختصرة لاتساق الحل والنتائج
          </p>
        </div>
      </div>

      <div
        className="
          mt-4 grid gap-3
          md:grid-cols-2
        "
      >
        {entries.map((item) => (
          <VerificationItem
            key={item.key}
            title={item.title}
            text={item.text}
            ok={item.ok}
          />
        ))}
      </div>
    </section>
  );
}

function VerificationItem({
  title,
  text,
  ok = true,
}) {
  return (
    <div
      className={cn(
        `
          rounded-xl border bg-white
          px-4 py-4
        `,
        ok
          ? "border-slate-200"
          : "border-amber-300 bg-amber-50",
      )}
    >
      <div className="flex items-center gap-2">
        <CheckCircle2
          size={16}
          className={
            ok
              ? "text-emerald-600"
              : "text-amber-600"
          }
        />
        <p className="text-xs font-black text-slate-600">
          {title}
        </p>
      </div>
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
  cooldownSeconds = 0,
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
          items-center justify-center
          gap-2 rounded-2xl
          bg-blue-700 px-7 py-3
          text-sm font-black text-white
          shadow-md transition
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
        ) : cooldownSeconds > 0 ? (
          <>
            <Clock3 size={20} />
            أعد المحاولة بعد {cooldownSeconds} ث
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
          px-2 py-1 text-xs
          font-black hover:bg-black/5
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



function ComplexPlaneVisual({ visual }) {
  const points = asArray(visual?.points);
  const circles = asArray(visual?.circles);
  const segments = asArray(visual?.segments);
  const byId = new Map(points.map(p => [p.id, p]));
  const xs = [0, ...points.map(p => Number(p.x)), ...circles.flatMap(c => [c.x-c.radius,c.x+c.radius])];
  const ys = [0, ...points.map(p => Number(p.y)), ...circles.flatMap(c => [c.y-c.radius,c.y+c.radius])];
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const span = Math.max(xmax-xmin, ymax-ymin, 2)*1.3;
  const cx = (xmin+xmax)/2, cy = (ymin+ymax)/2;
  const scale = 440/span;
  const X = x => 260+(x-cx)*scale, Y = y => 260-(y-cy)*scale;
  const step = Math.max(1, Math.ceil(span/16));
  const ticks = [];
  for(let n=Math.floor(Math.min(cx,cy)-span/2);n<=Math.max(cx,cy)+span/2;n++) {
    if(n%step===0) ticks.push(n);
  }
  return <figure className="rounded-2xl border bg-white p-3" dir="ltr">
    <figcaption className="text-center font-bold" dir="rtl">{visual.title || "المستوى المركب"}</figcaption>
    <svg viewBox="0 0 520 520" role="img" aria-label={visual.title || "المستوى المركب"}
      style={{width:"100%",maxWidth:620,display:"block",margin:"auto"}}>
      {ticks.map(n=><g key={n} stroke="#e2e8f0">
        {X(n)>=20 && X(n)<=500 && <line x1={X(n)} y1={20} x2={X(n)} y2={500}/>}
        {Y(n)>=20 && Y(n)<=500 && <line x1={20} y1={Y(n)} x2={500} y2={Y(n)}/>}</g>)}
      <path d={`M20 ${Y(0)} H500 M${X(0)} 20 V500`} stroke="#334155" fill="none"/>
      <text x={492} y={Y(0)-8} fontSize={13}>Re</text><text x={X(0)+8} y={25} fontSize={13}>Im</text>
      {ticks.filter(n=>n!==0).map(n=><g key={n} fontSize={11} fill="#64748b">
        {X(n)>25 && X(n)<490 && <text x={X(n)} y={Y(0)+15}>{n}</text>}
        {Y(n)>30 && Y(n)<490 && <text x={X(0)+5} y={Y(n)-3}>{n}</text>}</g>)}
      {circles.map((c,i)=><circle key={i} cx={X(c.x)} cy={Y(c.y)} r={c.radius*scale} fill="none" stroke="#2563eb" strokeWidth={2}/>)}
      {segments.map((s,i)=> {const a=byId.get(s.from), b=byId.get(s.to);return a&&b?<line key={i} x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} stroke="#2563eb" strokeWidth={2}/>:null;})}
      {points.map(p=><g key={p.id}><circle cx={X(p.x)} cy={Y(p.y)} r={4} fill="#dc2626"/>
        <text x={X(p.x)+7} y={Y(p.y)-8} fontSize={15} fill="#0f172a">{p.label || p.id}</text></g>)}
    </svg>
  </figure>;
}



function ServerMathVisual({ visual }) {
  const source = useMemo(() => {
    if (typeof visual.svg !== "string" || !visual.svg.startsWith("<svg ")) return "";
    // SVG is an image resource, not injected HTML. Browser image context disables scripts.
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(visual.svg);
  }, [visual.svg]);
  if (!source) return <p role="alert">تعذر عرض الرسم.</p>;
  const isTable = visual.type === "variation_table";
  return (
    <figure dir="ltr" className="my-4 rounded-xl border border-slate-200 bg-white p-3">
      {visual.title && <figcaption dir="rtl" className="mb-3 text-center font-semibold">{visual.title}</figcaption>}
      <div style={{overflowX: "auto", WebkitOverflowScrolling: "touch"}}>
        <img src={source} alt={visual.title || "رسم رياضي"}
          style={{display: "block", margin: "0 auto", width: "100%", minWidth: isTable ? 720 : 520, height: "auto"}} />
      </div>
    </figure>
  );
}
