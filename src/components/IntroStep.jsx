import { useEffect, useMemo, useRef, useState, useContext } from "react";
import axios from "axios";
import { MathJax } from "better-react-mathjax";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clock3,
  Compass,
  GraduationCap,
  Hash,
  Lightbulb,
  ListChecks,
  Loader2,
  RefreshCw,
  Route,
  Sparkles,
  Target,
  Trophy,
  WandSparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { UserContext } from "../Utils/UserContext";

/* =========================================================
   Helpers
========================================================= */

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isEmpty(value) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}


// لا نعرض حقول التخزين، إعدادات الواجهة، أو بيانات المراجعة داخل الدرس.
// واجهة التلميذ تعرض الشرح التعليمي فقط.
const HIDDEN_PRESENTATION_FIELDS = new Set([
  "stage_ui",
  "ui",
  "ui_preferences",
  "presentation",
  "presentation_config",
  "dynamic_profile",
  "quality_review",
  "source_note",
  "schema_version",
  "content_status",
  "pedagogical_style",
  "version",
  "language",
  "direction",
  "chapter_code",
  "chapter_title",
  "axis_tag",
  "axis_title",
  "estimated_duration",
  "estimated_minutes",
  "axis_order",
  "branches",
  "order",
  "is_active",
]);

// حقول تقنية يرسلها الخادم ولا يجب طباعتها كنص داخل الدرس.
// خصوصًا graph.svg: عند طباعته مباشرة يظهر كود <svg ...> بدل الرسم.
const TECHNICAL_PRESENTATION_FIELDS = new Set([
  // بيانات تقنية خاصة بالرسم
  "svg",
  "raw_svg",
  "svg_markup",
  "svg_content",
  "html",
  "raw_html",
  "graph_position",
  "graph_display",
  "graph_ref",
  "graphref",
  "graph_id",
  "graphid",
  "render_mode",
  "responsive",
  "diagram_type",
  "graph_type",

  // إعدادات واجهة المرحلة: لا تُعرض كنص داخل الدرس
  "stage_ui",
  "one_idea_only",
  "show_quick_check",
  "show_understood_button",
  "understood_label",
  "transition_message",

  // أسئلة التفاعل والتقويم منفصلة عن صفحة شرح الدرس
  "pre_question",
  "quick_check",
  "attempt_instruction",
  "law_guides",
  "law_guide",

  // إعدادات عرض عامة محتملة
  "ui",
  "ui_config",
  "display_config",
  "presentation",
  "presentation_config",
  "renderer",
  "component",
  "component_type",
  "layout",
  "debug",
  "debug_info",
]);

function normalizeFieldKey(fieldKey) {
  return String(fieldKey || "")
    .trim()
    .toLowerCase()
    .replace(/[\\s-]+/g, "_");
}

function isTechnicalPresentationField(fieldKey) {
  return TECHNICAL_PRESENTATION_FIELDS.has(
    normalizeFieldKey(fieldKey),
  );
}

function looksLikeSvgMarkup(value) {
  return (
    typeof value === "string" &&
    /^\s*(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(value)
  );
}

function normalizeComparableText(value) {
  return String(value ?? "")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ar");
}

function uniqueLimitedItems(items, limit = 5) {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  const result = [];

  for (const item of items) {
    const text = getDisplayText(item);
    const key = normalizeComparableText(text);

    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(item);

    if (result.length >= limit) break;
  }

  return result;
}

function isHiddenBacPage(step) {
  const title = normalizeComparableText(step?.title);
  const type = normalizeComparableText(step?.type);

  return (
    title.includes("كيف يظهر المحور في البكالوريا") ||
    title.includes("ظهور المحور في البكالوريا") ||
    type === "bac_connection"
  );
}

function normalizeLesson(data) {
  return (
    data?.axis?.content ||
    data?.content ||
    data?.answer ||
    data?.lesson ||
    data ||
    null
  );
}

function normalizeAxis(data, lesson) {
  return data?.axis || {
    id: data?.id ?? lesson?.axis_id ?? null,
    title:
      data?.title ||
      lesson?.axis_title ||
      lesson?.title ||
      "شرح الدرس",
    tag:
      data?.tag ||
      lesson?.axis_tag ||
      "",
  };
}


/* =========================================================
   Graph references
   يدعم:
   - content.graph مباشرة
   - content.graph_ref = "graph-id"
   - content.graph_ref = { id: "graph-id" }
   - lesson.graphs كمصفوفة أو كائن
   - رسم معرّف داخل مرحلة سابقة ثم استعماله في مراحل أخرى
========================================================= */

function getGraphIdentifier(graph, fallbackKey = "") {
  if (!graph || typeof graph !== "object") return String(fallbackKey || "").trim();

  return String(
    graph.id ||
      graph.graph_id ||
      graph.graphId ||
      graph.key ||
      graph.name ||
      fallbackKey ||
      "",
  ).trim();
}

function getGraphReferenceId(reference) {
  if (typeof reference === "string" || typeof reference === "number") {
    return String(reference).trim();
  }

  if (reference && typeof reference === "object") {
    return String(
      reference.id ||
        reference.graph_id ||
        reference.graphId ||
        reference.key ||
        reference.ref ||
        "",
    ).trim();
  }

  return "";
}

function buildLessonGraphRegistry(lesson) {
  const registry = new Map();

  const register = (graph, fallbackKey = "") => {
    if (!graph || typeof graph !== "object" || Array.isArray(graph)) return;

    const id = getGraphIdentifier(graph, fallbackKey);
    if (!id) return;

    // أول تعريف للرسم هو المرجع الأساسي. هذا يمنع استبداله بنسخة ناقصة لاحقًا.
    if (!registry.has(id)) {
      registry.set(id, graph);
    }
  };

  const registerCollection = (collection) => {
    if (Array.isArray(collection)) {
      collection.forEach((graph, index) =>
        register(graph, `lesson-graph-${index + 1}`),
      );
      return;
    }

    if (collection && typeof collection === "object") {
      Object.entries(collection).forEach(([key, graph]) => register(graph, key));
    }
  };

  registerCollection(lesson?.graphs);
  registerCollection(lesson?.graph_library);
  registerCollection(lesson?.graphLibrary);
  registerCollection(lesson?.graph_registry);

  register(lesson?.graph, "lesson-main-graph");
  register(lesson?.graph_data, "lesson-main-graph-data");

  if (Array.isArray(lesson?.learning_path)) {
    lesson.learning_path.forEach((step, index) => {
      const content = step?.content || {};
      register(content.graph, `step-${index + 1}-graph`);
      register(content.graph_data, `step-${index + 1}-graph-data`);
    });
  }

  return registry;
}

function resolveStepGraphReference(step, graphRegistry) {
  if (!step || typeof step !== "object") return step;

  const content = step.content || {};

  // الرسم المباشر له الأولوية، سواء وصل باسم graph أو graph_data.
  if (
    (content.graph && typeof content.graph === "object") ||
    (content.graph_data && typeof content.graph_data === "object")
  ) {
    return step;
  }

  const reference =
    content.graph_ref ??
    content.graphRef ??
    content.graph_id ??
    content.graphId ??
    null;

  const referenceId = getGraphReferenceId(reference);
  if (!referenceId) return step;

  const resolvedGraph = graphRegistry.get(referenceId);
  if (!resolvedGraph) {
    // نبقي المرجع عند عدم إيجاده حتى يظهر الخطأ أثناء التطوير بدل إخفائه.
    return step;
  }

  const cleanedContent = { ...content, graph: resolvedGraph };

  delete cleanedContent.graph_ref;
  delete cleanedContent.graphRef;
  delete cleanedContent.graph_id;
  delete cleanedContent.graphId;

  return {
    ...step,
    content: cleanedContent,
  };
}

function decodeLatexEscapes(value) {
  if (value === null || value === undefined) return "";

  let text = String(value).replace(/\r\n?/g, "\n");

  // بعض واجهات API تعيد LaTeX مهروبًا مرتين أو ثلاث مرات.
  // نفك التهريب تدريجيًا بدون المساس بأوامر LaTeX الصحيحة.
  for (let index = 0; index < 3; index += 1) {
    const previous = text;

    text = text
      .replace(/\\\\\\\\/g, "\\\\")
      .replace(/\\\\\(/g, "\\(")
      .replace(/\\\\\)/g, "\\)")
      .replace(/\\\\\[/g, "\\[")
      .replace(/\\\\\]/g, "\\]")
      .replace(/\\\\(frac|dfrac|tfrac|sqrt|ln|log|exp|times|cdot|div|geq?|leq?|neq|in|notin|mathbb|mathrm|text|longrightarrow|rightarrow|longleftarrow|leftarrow|leftrightarrow|rightleftharpoons|Rightarrow|Leftarrow|Leftrightarrow|left|right|begin|end|boxed|overline|underline|sum|prod|lim|infty|ldots|cdots|quad|qquad)/g, "\\$1");

    if (text === previous) break;
  }

  return text;
}

function protectMathBlocks(text) {
  const blocks = [];

  const protectedText = text.replace(
    /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$\n]+?\$/g,
    (match) => {
      const token = `@@MATH_BLOCK_${blocks.length}@@`;
      blocks.push(match);
      return token;
    },
  );

  return { protectedText, blocks };
}

function restoreMathBlocks(text, blocks) {
  let result = text;

  blocks.forEach((block, index) => {
    result = result.replace(`@@MATH_BLOCK_${index}@@`, block);
  });

  return result;
}

function wrapBareMathExpressions(value) {
  const { protectedText, blocks } = protectMathBlocks(value);
  let text = protectedText;

  // معادلات أو متراجحات كاملة مكتوبة دون محددات MathJax.
  text = text.replace(
    /(^|[\s،؛:؟])((?:[A-Za-z]|\\[A-Za-z]+)(?:_\{[^{}]+\}|_[A-Za-z0-9]+|\^\{[^{}]+\}|\^[A-Za-z0-9]+|\([^\n،؛؟]*?\))?(?:\s*(?:=|≠|≤|≥|<|>|\+|-|×|÷|\/|\\in|\\notin|\\geq?|\\leq?)\s*(?:[A-Za-z0-9]|\\[A-Za-z]+|\([^\n،؛؟]*?\)|\{[^{}]+\})(?:_\{[^{}]+\}|_[A-Za-z0-9]+|\^\{[^{}]+\}|\^[A-Za-z0-9]+|\([^\n،؛؟]*?\))?)+)(?=$|[\s،؛.!؟])/g,
    (full, prefix, formula) => `${prefix}\\(${formula.trim()}\\)`,
  );

  // رموز المتتاليات المفردة مثل u_n وu_{n+1} وn_0.
  text = text.replace(
    /(^|[\s،؛:؟(])([A-Za-z](?:_\{[^{}]+\}|_[A-Za-z0-9]+|\^\{[^{}]+\}|\^[A-Za-z0-9]+))(?=$|[\s،؛.!؟)])/g,
    (full, prefix, symbol) => `${prefix}\\(${symbol}\\)`,
  );

  // اسم المتتالية بين قوسين مثل (u_n).
  text = text.replace(
    /\(([A-Za-z](?:_\{[^{}]+\}|_[A-Za-z0-9]+))\)/g,
    (full, symbol) => `\\((${symbol})\\)`,
  );

  return restoreMathBlocks(text, blocks);
}

function protectArabicInsideMathGroups(value) {
  return String(value || "").replace(
    /([_^])\{([^{}]*[\u0600-\u06FF][^{}]*)\}/g,
    (full, operator, inner) => {
      const cleaned = inner
        .replace(/\\text\{([^{}]*)\}/g, "$1")
        .replace(/\s+/g, " ")
        .trim();

      return `${operator}{\\text{${cleaned}}}`;
    },
  );
}

function normalizeMathText(value) {
  let text = decodeLatexEscapes(value);
  if (!text) return "";

  text = text
    .replace(/\$\$([\s\S]*?)\$\$/g, "\\[$1\\]")
    .replace(/\$([^$\n]+?)\$/g, "\\($1\\)");

  text = protectArabicInsideMathGroups(text);

  return wrapBareMathExpressions(text);
}

function getPureMathExpression(value) {
  let text = decodeLatexEscapes(value).trim();

  // إزالة محددات الصيغة حتى عند وجود نقطة أو فاصلة بعد \(...\).
  // إبقاء المحددات ثم تغليفها مرة ثانية داخل \[...\] يجعل MathJax
  // يعرض \( و\) باللون الأحمر كما في بطاقة القاعدة الأساسية.
  const inlineDelimited = text.match(
    /^\\\(([\s\S]*?)\\\)\s*[.،,؛;:]?\s*$/,
  );
  const displayDelimited = text.match(
    /^\\\[([\s\S]*?)\\\]\s*[.،,؛;:]?\s*$/,
  );

  if (inlineDelimited || displayDelimited) {
    text = (inlineDelimited?.[1] ?? displayDelimited?.[1] ?? "").trim();
  }

  if (
    (text.startsWith("\\(") && text.endsWith("\\)")) ||
    (text.startsWith("\\[") && text.endsWith("\\]"))
  ) {
    text = text.slice(2, -2).trim();
  }

  if (text.startsWith("$$") && text.endsWith("$$")) {
    text = text.slice(2, -2).trim();
  } else if (text.startsWith("$") && text.endsWith("$")) {
    text = text.slice(1, -1).trim();
  }

  return wrapArabicRunsInsideLatex(text);
}

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(String(value || ""));
}

function isSingleDelimitedMath(value) {
  const text = decodeLatexEscapes(value).trim();

  return (
    /^\\\([\s\S]*\\\)$/.test(text) ||
    /^\\\[[\s\S]*\\\]$/.test(text) ||
    /^\$\$[\s\S]*\$\$$/.test(text) ||
    /^\$[^$\n]+\$$/.test(text)
  );
}

function isPureMathContent(value) {
  const text = decodeLatexEscapes(value).trim();
  if (!text) return false;

  if (isSingleDelimitedMath(text)) return true;
  if (containsArabic(text)) return false;

  // النص غير العربي يُعامل كصيغة فقط إذا احتوى على مؤشرات رياضية واضحة.
  return /(?:\\[A-Za-z]+|[_^=<>+\-*/]|\d)/.test(text);
}


function escapeLatexTextContent(value) {
  return String(value || "")
    .replace(/\\/g, "")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapArabicRunsInsideLatex(value) {
  let text = String(value || "");
  if (!text) return "";

  // أحيانًا يصل النص على شكل \لكل أو \متزايدة.
  // نحذف الشرطة المائلة غير الصحيحة قبل الحرف العربي.
  text = text.replace(/\\(?=[\u0600-\u06FF])/g, "");

  const protectedTextBlocks = [];

  // حماية \text{...} الموجودة أصلًا حتى لا نغلفها مرة ثانية.
  text = text.replace(/\\text\{[^{}]*\}/g, (match) => {
    const token = `@@LATEX_TEXT_${protectedTextBlocks.length}@@`;
    protectedTextBlocks.push(match);
    return token;
  });

  // تحويل المقاطع العربية داخل الصيغة إلى \text{...}.
  text = text.replace(
    /([\u0600-\u06FF][\u0600-\u06FF\u064B-\u065F\u0670\s،؛؟]*)/g,
    (match) => {
      const leading = match.match(/^\s*/)?.[0] || "";
      const trailing = match.match(/\s*$/)?.[0] || "";
      const content = escapeLatexTextContent(match);

      if (!content) return match;

      return `${leading}\\text{${content}}${trailing}`;
    },
  );

  protectedTextBlocks.forEach((block, index) => {
    text = text.replace(`@@LATEX_TEXT_${index}@@`, block);
  });

  return text
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeInlineLatexFormula(value) {
  let text = decodeLatexEscapes(value).trim();
  if (!text) return "";

  text = getPureMathExpression(text)
    .replace(/\*\*/g, "^")
    .replace(/\^\s*\(([^()]+)\)/g, "^{$1}")
    .replace(/\^\s*(-?\d+(?:\.\d+)?)/g, "^{$1}")
    .replace(/\s+/g, " ")
    .trim();

  return wrapArabicRunsInsideLatex(text);
}


function cleanMixedMathSource(value) {
  return decodeLatexEscapes(value)
    .replace(/\\(?=[\u0600-\u06FF])/g, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, "\\[$1\\]")
    .replace(/\$([^$\n]+?)\$/g, "\\($1\\)")
    .trim();
}

function normalizeMixedMathToken(value) {
  return String(value || "")
    .replace(/\*\*/g, "^")
    .replace(/\^\s*\(([^()]+)\)/g, "^{$1}")
    .replace(/\^\s*(-?\d+(?:\.\d+)?)/g, "^{$1}")
    .replace(/\s+/g, " ")
    .trim();
}

// MathJax يتعامل جيدًا مع الصيغ الرياضية، لكن إدخال العربية داخل
// \\text{...} داخل نفس الصيغة قد يؤدي إلى قلب الحروف أو ترتيبها بصورة خاطئة.
// لذلك نفصل النص العربي عن الصيغة الرياضية ونترك المتصفح يعرضه RTL طبيعيًا.
function splitArabicTextInsideLatex(value) {
  const source = String(value || "");
  if (!source) return [];

  const result = [];
  const arabicInsideMathPattern =
    /\\(?:text|mbox)\{([^{}]*)\}|([\u0600-\u06FF][\u0600-\u06FF\u064B-\u065F\u0670\s،؛؟]*)/g;

  let cursor = 0;
  let match;

  const pushMath = (chunk) => {
    const normalized = normalizeMixedMathToken(chunk);
    if (normalized) result.push({ type: "math", value: normalized });
  };

  const pushArabic = (chunk) => {
    const cleaned = String(chunk || "")
      .replace(/\\(?=[\u0600-\u06FF])/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned) result.push({ type: "text", value: cleaned });
  };

  while ((match = arabicInsideMathPattern.exec(source)) !== null) {
    const latexTextContent = match[1];
    const rawArabicContent = match[2];
    const candidate = latexTextContent ?? rawArabicContent ?? "";

    // لا نفصل \\text{...} إذا لم يكن عربيًا، حتى تبقى صيغ مثل \\text{if} سليمة.
    if (!containsArabic(candidate)) continue;

    pushMath(source.slice(cursor, match.index));
    pushArabic(candidate);
    cursor = arabicInsideMathPattern.lastIndex;
  }

  pushMath(source.slice(cursor));

  return result;
}

function splitMixedArabicMath(value) {
  const source = cleanMixedMathSource(value);
  if (!source) return [];

  const tokens = [];
  const explicitMathPattern = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
  let cursor = 0;
  let match;

  const pushPlainPart = (plainValue) => {
    const plain = String(plainValue || "");
    if (!plain) return;

    const pieces = plain.split(
      /([\u0600-\u06FF][\u0600-\u06FF\u064B-\u065F\u0670\s،؛؟]*)/g,
    );

    pieces.forEach((piece) => {
      const cleaned = piece
        .replace(/\\(?=[\u0600-\u06FF])/g, "")
        .replace(/\\[()[\]]/g, "")
        .trim();

      if (!cleaned) return;

      if (/[\u0600-\u06FF]/.test(cleaned)) {
        tokens.push({ type: "text", value: cleaned });
        return;
      }

      if (/^[،,؛;:.؟!?⇒→←]+$/.test(cleaned)) {
        tokens.push({ type: "separator", value: cleaned });
        return;
      }

      const normalizedMath = normalizeMixedMathToken(cleaned);
      if (normalizedMath) {
        tokens.push({ type: "math", value: normalizedMath });
      }
    });
  };

  const pushMathPart = (mathValue) => {
    const splitTokens = splitArabicTextInsideLatex(mathValue);
    if (splitTokens.length > 0) {
      tokens.push(...splitTokens);
      return;
    }

    const normalizedMath = normalizeMixedMathToken(mathValue);
    if (normalizedMath) {
      tokens.push({ type: "math", value: normalizedMath });
    }
  };

  while ((match = explicitMathPattern.exec(source)) !== null) {
    pushPlainPart(source.slice(cursor, match.index));

    const mathValue = (match[1] ?? match[2] ?? "").trim();
    if (mathValue) pushMathPart(mathValue);

    cursor = explicitMathPattern.lastIndex;
  }

  pushPlainPart(source.slice(cursor));

  return tokens.filter((token) => token.value);
}

function MixedArabicMath({
  value,
  className = "",
  compact = false,
  centered = true,
  dark = false,
}) {
  const tokens = splitMixedArabicMath(value);

  if (tokens.length === 0) return null;

  return (
    <div
      dir="ltr"
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2",
        centered ? "justify-center text-center" : "justify-start",
        compact ? "text-sm" : "text-base sm:text-lg",
        className,
      )}
    >
      {tokens.map((token, index) => {
        if (token.type === "text") {
          return (
            <span
              key={`mixed-text-${index}`}
              dir="rtl"
              className={cn(
                "inline-flex max-w-full whitespace-normal text-right font-bold leading-7 [unicode-bidi:isolate]",
                dark ? "text-white" : "text-slate-800",
              )}
            >
              {token.value}
            </span>
          );
        }

        if (token.type === "separator") {
          return (
            <span
              key={`mixed-separator-${index}`}
              dir="ltr"
              className={cn(
                "inline-flex font-black [unicode-bidi:isolate]",
                dark ? "text-white/70" : "text-slate-500",
              )}
            >
              {token.value}
            </span>
          );
        }

        return (
          <MathJax
            key={`mixed-math-${index}`}
            dynamic
            hideUntilTypeset="first"
          >
            <span
              dir="ltr"
              className={cn(
                "inline-flex whitespace-nowrap font-black [unicode-bidi:isolate] [&_mjx-container]:m-0",
                dark ? "text-white" : "text-slate-950",
              )}
            >
              {`\\(${token.value}\\)`}
            </span>
          </MathJax>
        );
      })}
    </div>
  );
}

function splitGraphTitle(value, fallbackFormula = "") {
  const raw = decodeLatexEscapes(value).trim();
  const formulaPattern = /(?:f|g|h|u|v)\s*\(\s*x\s*\)\s*=\s*[^،؛\n]+/i;
  const match = raw.match(formulaPattern);

  const formula = normalizeInlineLatexFormula(
    match?.[0] || fallbackFormula,
  );

  const title = raw
    .replace(formulaPattern, "")
    .replace(/[\s:：\-–—]+$/g, "")
    .trim();

  return {
    title: title || "منحنى الدالة",
    formula,
  };
}

function MathText({ children, as: Component = "div", className = "" }) {
  if (isEmpty(children)) return null;

  const content = normalizeMathText(children);

  return (
    <MathJax dynamic hideUntilTypeset="first">
      <Component
        dir="rtl"
        className={cn(
          "whitespace-pre-line text-[15px] leading-8 sm:text-base sm:leading-9",
          "[&_.MathJax]:mx-1 [&_mjx-container]:inline-block",
          "[&_mjx-container]:overflow-visible [&_mjx-container]:max-w-none",
          "[&_mjx-container]:align-middle [&_mjx-container]:whitespace-normal",
          "[&_mjx-container]:[unicode-bidi:isolate] [&_mjx-container]:direction-ltr",
          "[&_mjx-container]:text-left",
          className,
        )}
      >
        {content}
      </Component>
    </MathJax>
  );
}

function SectionTitle({ eyebrow, title, description, icon: Icon = BookOpen }) {
  return (
    <div className="mb-6 flex items-start gap-4 rounded-[24px] border border-indigo-100/80 bg-gradient-to-l from-indigo-50/80 via-white to-white p-4 sm:p-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 ring-4 ring-indigo-50">
        <Icon size={22} />
      </div>
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] font-black tracking-[0.16em] text-indigo-600">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-black leading-8 text-slate-950 sm:text-[26px]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-3xl text-sm font-medium leading-7 text-slate-500">{description}</p>
        )}
      </div>
    </div>
  );
}

function AnimatedCollapse({ open, children, className = "" }) {
  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
      aria-hidden={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity,transform] duration-500 ease-out",
        open
          ? "grid-rows-[1fr] translate-y-0 opacity-100"
          : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0",
        className,
      )}
    >
        <div className="min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}

function RevealBox({ label, children, tone = "indigo", defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  const tones = {
    indigo: "border-indigo-200 bg-indigo-50/70 text-indigo-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  };

  return (
    <div className={cn("overflow-hidden rounded-[22px] border shadow-sm transition-all duration-300 hover:shadow-md", tones[tone])}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right font-black transition hover:bg-white/40"
      >
        <span>{label}</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      <AnimatedCollapse open={open}>
        <div className="border-t border-current/10 bg-white/35 p-5">
          {children}
        </div>
      </AnimatedCollapse>
    </div>
  );
}

function InfoBox({
  icon: Icon = Lightbulb,
  title,
  children,
  tone = "indigo",
  compact = true,
  stretch = false,
  className = "",
}) {
  const tones = {
    indigo: "border-indigo-200 bg-indigo-50/80 text-indigo-950",
    amber: "border-amber-200 bg-amber-50/80 text-amber-950",
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
    rose: "border-rose-200 bg-rose-50/80 text-rose-950",
    sky: "border-sky-200 bg-sky-50/80 text-sky-950",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  };

  return (
    <div
      className={cn(
        // لا نضع h-full افتراضيًا: داخل بطاقات grid كان يجعل InfoBox
        // يأخذ ارتفاع البطاقة كاملًا ثم يفيض فوق العناصر التالية.
        "min-w-0 border shadow-sm ring-1 ring-white/60",
        stretch && "h-full",
        compact
          ? "rounded-2xl p-3.5 sm:p-4"
          : "rounded-[22px] p-5",
        tones[tone],
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon
          size={compact ? 16 : 19}
          className="mt-0.5 shrink-0 rounded-lg bg-white/75 p-1 shadow-sm"
        />

        <div className="min-w-0 flex-1">
          {title && (
            <h4
              className={cn(
                "font-black leading-6",
                compact ? "mb-1 text-xs sm:text-[13px]" : "mb-1.5 text-[15px]",
              )}
            >
              {title}
            </h4>
          )}

          <div
            className={cn(
              "min-w-0 [&_.MathJax]:mx-0",
              compact &&
                "[&_p]:text-sm [&_p]:leading-7 [&_mjx-container]:text-[95%]",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function getDisplayText(item) {
  if (item === null || item === undefined) return "";
  if (typeof item === "string" || typeof item === "number") return String(item);

  if (typeof item === "object") {
    return (
      item.text ||
      item.formula ||
      item.calculation ||
      item.expression ||
      item.relation ||
      item.equation ||
      item.hint ||
      item.instruction ||
      item.teacher_explanation ||
      item.explanation ||
      item.solution ||
      item.question ||
      item.answer ||
      item.result ||
      item.meaning ||
      item.statement ||
      item.action ||
      item.correction ||
      item.correct ||
      item.wrong ||
      item.why ||
      item.reason ||
      item.statement ||
      item.title ||
      item.label ||
      item.name ||
      item.term ||
      item.description ||
      item.classification ||
      item.dominant_species ||
      item.deduction ||
      item.range ||
      ""
    );
  }

  return String(item);
}

function BulletList({ items, icon: Icon = CheckCircle2, tone = "indigo" }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const iconColors = {
    indigo: "text-indigo-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    sky: "text-sky-600",
  };

  return (
    <div className="space-y-3.5">
      {items.map((item, index) => {
        const text = getDisplayText(item);
        if (!text) return null;

        return (
          <div
            key={`${text}-${index}`}
            className="group flex items-start gap-3 rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
          >
            <Icon
              className={cn(
                "mt-0.5 shrink-0 rounded-lg bg-slate-50 p-1",
                iconColors[tone],
              )}
              size={18}
            />

            <div className="min-w-0 flex-1">
              {item && typeof item === "object" && item.level !== undefined && (
                <span className="mb-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-800">
                  التلميح {item.level}
                </span>
              )}

              <MathText className="text-sm font-semibold text-slate-700">
                {text}
              </MathText>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MathPanel({ children, className = "" }) {
  if (isEmpty(children)) return null;

  const rawContent = decodeLatexEscapes(children).trim();
  const pureMath = isPureMathContent(rawContent);

  return (
    <div
      dir={pureMath ? "ltr" : "rtl"}
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-indigo-400/20",
        "bg-[linear-gradient(135deg,#111827_0%,#1e1b4b_55%,#312e81_100%)]",
        "px-5 py-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_35px_-18px_rgba(79,70,229,0.65)]",
        "ring-1 ring-white/5 sm:px-7",
        className,
      )}
    >
      {pureMath ? (
        <MathJax dynamic hideUntilTypeset="first">
          <div
            dir="ltr"
            className={cn(
              "w-full min-w-0 overflow-x-auto overflow-y-hidden px-1 text-center",
              "text-base font-bold leading-10 [unicode-bidi:isolate] sm:text-lg",
              "[&_mjx-container]:mx-auto [&_mjx-container]:block",
              "[&_mjx-container]:w-fit [&_mjx-container]:min-w-0",
              "[&_mjx-container]:overflow-visible",
              "[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20",
            )}
          >
            {`\\[${getPureMathExpression(rawContent)}\\]`}
          </div>
        </MathJax>
      ) : (
        <MathText className="text-center text-base font-bold leading-10 text-white sm:text-lg">
          {rawContent}
        </MathText>
      )}
    </div>
  );
}

/* =========================================================
   Lesson overview
========================================================= */

function LessonMap({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <SectionTitle
        eyebrow="خريطة الدرس"
        title="ماذا ستتعلم خطوة بخطوة؟"
        description="تقسيم واضح يساعد التلميذ على رؤية الطريق قبل بداية الشرح."
        icon={Route}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item, index) => (
          <div
            key={`${item.part}-${index}`}
            className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-lg"
          >
            <span className="absolute -left-2 -top-5 text-8xl font-black text-slate-200/60 transition group-hover:text-indigo-100">
              {item.part || index + 1}
            </span>
            <div className="relative">
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-600 shadow-sm ring-1 ring-slate-200">
                {item.focus}
              </span>
              <h3 className="mt-5 text-lg font-black leading-8 text-slate-900">
                {item.title}
              </h3>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================================================
   Step renderers
========================================================= */

function MotivationStep({ content = {} }) {
  const introCards = [
    {
      key: "welcome",
      title: "في هذا المحور",
      value: content.welcome,
      icon: Sparkles,
    },
    {
      key: "big_idea",
      title: "الفكرة الأساسية",
      value: content.big_idea || content.central_idea,
      icon: Brain,
    },
    {
      key: "student_promise",
      title: "ماذا ستتعلم؟",
      value: content.student_promise || content.goal,
      icon: Target,
    },
  ].filter((item) => !isEmpty(item.value));

  const examplesSource =
    content.real_life_examples ?? content.examples ?? content.example ?? [];

  const examples = Array.isArray(examplesSource)
    ? examplesSource.filter((item) => !isEmpty(item))
    : !isEmpty(examplesSource)
      ? [examplesSource]
      : [];

  const manuallyRenderedKeys = new Set([
    "welcome",
    "big_idea",
    "central_idea",
    "student_promise",
    "goal",
    "teacher",
    "real_life_examples",
    "examples",
    "example",
    "mini_example",
    "attention",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {content.teacher && (
        <section className="relative overflow-hidden rounded-[28px] border border-indigo-100 bg-gradient-to-l from-indigo-50/90 via-white to-white p-5 shadow-sm sm:p-7">
          <div className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full bg-indigo-100/70 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <Brain size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-black text-indigo-700">لماذا نبدأ بهذه الفكرة؟</p>
              <MathText className="text-[15px] font-semibold leading-8 text-slate-700 sm:text-base">
                {content.teacher}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {introCards.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {introCards.map(({ key, title, value, icon: Icon }) => (
            <div
              key={key}
              className="rounded-[24px] border border-indigo-100 bg-gradient-to-b from-indigo-50/70 to-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-2 text-indigo-700">
                <Icon size={18} />
                <h3 className="font-black">{title}</h3>
              </div>
              <MathText className="text-sm font-semibold text-slate-700">
                {value}
              </MathText>
            </div>
          ))}
        </div>
      )}

      {examples.length > 0 && (
        <section className="rounded-[26px] border border-amber-100 bg-amber-50/35 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-amber-800">
            <Lightbulb size={18} />
            <div>
              <h3 className="font-black text-slate-950">مثال يوضح سبب الحاجة إلى الخطة</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">لا نختار التحويل قبل تشخيص شكل النهاية.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {examples.map((item, index) => (
              <div
                key={`motivation-example-${index}`}
                className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-sm font-black text-white">
                  {index + 1}
                </span>
                <MathText className="text-sm font-bold leading-7 text-amber-950">
                  {getDisplayText(item)}
                </MathText>
              </div>
            ))}
          </div>
        </section>
      )}

      {content.mini_example && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-600" />
            <h3 className="font-black text-slate-950">
              مثال تطبيقي
            </h3>
          </div>
          <SemanticExampleValue value={content.mini_example} />
        </section>
      )}

      {/* {content.attention && (
        <InfoBox title="انتبه قبل أن تبدأ" tone="rose" icon={AlertTriangle} compact={false}>
          <MathText className="font-black leading-8">{content.attention}</MathText>
        </InfoBox>
      )} */}

      {Object.keys(remainingContent).length > 0 && (
        <StructuredValue value={remainingContent} depth={1} />
      )}
    </div>
  );
}

function DynamicDataTable({
  rows,
  preferredColumns = [],
  title = "",
}) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const objectRows = rows.filter(
    (row) => row && typeof row === "object" && !Array.isArray(row),
  );

  if (objectRows.length === 0) {
    return <BulletList items={rows} tone="indigo" />;
  }

  const discoveredColumns = Array.from(
    new Set(
      objectRows.flatMap((row) =>
        Object.keys(row).filter(
          (key) =>
            key !== "id" &&
            key !== "step_number" &&
            key !== "level" &&
            !isEmpty(row[key]),
        ),
      ),
    ),
  );

  const columns = [
    ...preferredColumns.filter((key) =>
      discoveredColumns.includes(key),
    ),
    ...discoveredColumns.filter(
      (key) => !preferredColumns.includes(key),
    ),
  ];

  if (columns.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
      {title && (
        <div className="border-b border-indigo-100 bg-gradient-to-l from-indigo-50 to-white px-5 py-4">
          <h3 className="font-black text-slate-950">{title}</h3>
        </div>
      )}

      <div className="overflow-x-auto">
        <table
          dir="rtl"
          className="w-full min-w-[620px] table-auto text-right text-sm"
        >
          <thead className="bg-gradient-to-l from-slate-950 to-indigo-950 text-white">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap px-5 py-4 text-center font-black"
                >
                  {fieldLabel(column)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {objectRows.map((row, rowIndex) => (
              <tr
                key={row.id || `dynamic-row-${rowIndex}`}
                className="border-t border-slate-200 even:bg-indigo-50/35"
              >
                {columns.map((column) => {
                  const cellValue = row[column];

                  return (
                    <td
                      key={`${rowIndex}-${column}`}
                      className="min-w-[180px] px-5 py-4 align-top"
                    >
                      {isEmpty(cellValue) ? (
                        <span className="block text-center text-slate-300">
                          —
                        </span>
                      ) : typeof cellValue === "object" ? (
                        <StructuredValue
                          value={cellValue}
                          fieldKey={column}
                          depth={1}
                        />
                      ) : (
                        <MathText className="text-center font-bold text-slate-800">
                          {String(cellValue)}
                        </MathText>
                      )}
                    </td>
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



function isObjectRow(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function isComplexPartsExampleRows(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        isObjectRow(item) &&
        ("z" in item || "number" in item) &&
        ("real" in item || "imaginary" in item),
    )
  );
}

function ExampleCollection({ value, title = "" }) {
  const items = Array.isArray(value)
    ? value.filter((item) => !isEmpty(item))
    : !isEmpty(value)
      ? [value]
      : [];

  if (items.length === 0) return null;

  const allObjects = items.every(isObjectRow);
  const allPrimitive = items.every(
    (item) =>
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean",
  );

  if (isComplexPartsExampleRows(items)) {
    return (
      <DynamicDataTable
        rows={items}
        preferredColumns={["z", "real", "imaginary"]}
        title={title}
      />
    );
  }

  if (allObjects) {
    const discoveredColumns = Array.from(
      new Set(
        items.flatMap((item) =>
          Object.keys(item).filter(
            (key) =>
              !["id", "step_number", "level"].includes(key) &&
              !isEmpty(item[key]) &&
              !isTechnicalPresentationField(key),
          ),
        ),
      ),
    );

    const scalarOnly = items.every((item) =>
      discoveredColumns.every((key) => {
        const nestedValue = item[key];
        return (
          isEmpty(nestedValue) ||
          typeof nestedValue === "string" ||
          typeof nestedValue === "number" ||
          typeof nestedValue === "boolean"
        );
      }),
    );

    if (scalarOnly && discoveredColumns.length > 0 && discoveredColumns.length <= 5) {
      return (
        <DynamicDataTable
          rows={items}
          preferredColumns={discoveredColumns}
          title={title}
        />
      );
    }

    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <SemanticExampleValue
            key={item?.id || `example-object-${index}`}
            value={item}
          />
        ))}
      </div>
    );
  }

  if (allPrimitive) {
    return (
      <div
        className={cn(
          "grid gap-3",
          items.length === 1
            ? "grid-cols-1"
            : items.length === 2
              ? "sm:grid-cols-2"
              : items.length === 3
                ? "sm:grid-cols-3"
                : "sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {items.map((item, index) => (
          <div
            key={`example-value-${index}`}
            className="flex min-h-[72px] items-center justify-center rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/70 to-white px-4 py-3 text-center shadow-sm"
          >
            <MathText className="font-black text-slate-900">
              {String(item)}
            </MathText>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`mixed-example-${index}`}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <StructuredValue value={item} fieldKey="example" depth={1} />
        </div>
      ))}
    </div>
  );
}


function FlexibleTable({ table, title = "", className = "" }) {
  if (!table) return null;

  if (Array.isArray(table)) {
    return (
      <DynamicDataTable
        rows={table}
        title={title}
      />
    );
  }

  if (typeof table !== "object") return null;

  const headers = Array.isArray(table.headers)
    ? table.headers
    : Array.isArray(table.columns)
      ? table.columns
      : [];

  const rows = Array.isArray(table.rows)
    ? table.rows
    : Array.isArray(table.data)
      ? table.data
      : [];

  const caption = table.caption || table.description || "";
  const resolvedTitle = title || table.title || "";

  const extraTableEntries = Object.entries(table).filter(
    ([key, value]) =>
      ![
        "headers",
        "columns",
        "rows",
        "data",
        "caption",
        "description",
        "title",
      ].includes(key) &&
      !isEmpty(value) &&
      !isTechnicalPresentationField(key) &&
      !looksLikeSvgMarkup(value),
  );

  if (headers.length === 0 && rows.length === 0) {
    return <StructuredValue value={table} depth={1} />;
  }

  return (
    <div className={cn(
      "overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm",
      className,
    )}>
      {(resolvedTitle || caption) && (
        <div className="border-b border-indigo-100 bg-gradient-to-l from-indigo-50 to-white px-5 py-4">
          {resolvedTitle && (
            <h3 className="font-black text-slate-950">{resolvedTitle}</h3>
          )}
          {caption && (
            <MathText className="mt-1 text-sm font-semibold text-slate-600">
              {caption}
            </MathText>
          )}
        </div>
      )}

      {extraTableEntries.length > 0 && (
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
          {extraTableEntries.map(([key, value]) => (
            <div
              key={key}
              className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5"
            >
              <p className="mb-1.5 text-[11px] font-black text-slate-500">
                {fieldLabel(key)}
              </p>
              <StructuredValue value={value} fieldKey={key} depth={1} />
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table dir="rtl" className="w-full min-w-[520px] text-center text-sm">
          {headers.length > 0 && (
            <thead className="bg-gradient-to-l from-slate-950 to-indigo-950 text-white">
              <tr>
                {headers.map((header, index) => (
                  <th
                    key={`${getDisplayText(header)}-${index}`}
                    className="whitespace-nowrap px-5 py-4 font-black"
                  >
                    <MathText as="span" className="font-black text-white">
                      {getDisplayText(header)}
                    </MathText>
                  </th>
                ))}
              </tr>
            </thead>
          )}

          <tbody>
            {rows.map((row, rowIndex) => {
              const cells = Array.isArray(row)
                ? row
                : headers.length > 0 && row && typeof row === "object"
                  ? headers.map((header) =>
                      row[
                        typeof header === "string"
                          ? header
                          : header?.key || header?.field || header?.label
                      ]
                    )
                  : row && typeof row === "object"
                    ? Object.values(row)
                    : [row];

              return (
                <tr
                  key={`flex-row-${rowIndex}`}
                  className="border-t border-slate-200 even:bg-indigo-50/35"
                >
                  {cells.map((cell, cellIndex) => (
                    <td
                      key={`flex-cell-${rowIndex}-${cellIndex}`}
                      className="min-w-[130px] px-5 py-4 align-middle"
                    >
                      {cell && typeof cell === "object" ? (
                        <StructuredValue
                          value={cell}
                          depth={1}
                        />
                      ) : (
                        <MathText className="font-bold text-slate-800">
                          {String(cell ?? "")}
                        </MathText>
                      )}
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


function DecisionTreeCards({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const condition =
          typeof item === "object"
            ? item.condition || item.if || item.question || item.title
            : String(item);

        const action =
          typeof item === "object"
            ? item.action || item.then || item.answer || item.result
            : "";

        return (
          <div
            key={`decision-${index}`}
            className="overflow-hidden rounded-[24px] border border-indigo-100 bg-white shadow-sm"
          >
            <div className="flex items-start gap-3 bg-indigo-50 px-5 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 font-black text-white">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-black text-indigo-700">إذا كان</p>
                <MathText className="font-black text-slate-950">
                  {condition}
                </MathText>
              </div>
            </div>

            {action && (
              <div className="flex items-start gap-3 px-5 py-4">
                <Route className="mt-1 shrink-0 text-emerald-600" size={19} />
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-black text-emerald-700">فإننا نقوم بـ</p>
                  <MathText className="font-bold text-slate-700">
                    {action}
                  </MathText>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


function ObservationStep({ content = {} }) {
  const valueTable = Array.isArray(content.value_table)
    ? content.value_table.filter(Boolean)
    : [];

  const legacyTable = content.table || null;
  const parts = Array.isArray(content.parts)
    ? content.parts.filter(Boolean)
    : [];

  const quickCheck = content.quick_check;

  // الحقول التي يتم عرضها يدويًا داخل هذا المكوّن.
  const manuallyRenderedKeys = new Set([
    "teacher",
    "situation",
    "formula",
    "meaning",
    "geometric_meaning",
    "parts",
    "why",
    "how_to_think",
    "attention",
    "takeaway",
    "value_table",
    "table",
    "table_title",
    "examples",
    "discovery",
    "observation",
    "conclusion",
    "quick_check",
    "question",
    "expected_answer",
  ]);

  // أي حقل جديد يصل من JSON سيظهر تلقائيًا بدل أن يختفي.
  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5">
      {(content.teacher || content.situation) && (
        <section className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-sky-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50">
              <Brain size={17} />
            </span>
            شرح الملاحظة
          </div>

          <MathText className="max-w-5xl text-[15px] font-semibold leading-8 text-slate-700">
            {content.teacher || content.situation}
          </MathText>
        </section>
      )}

      {(content.formula || content.meaning || content.geometric_meaning) && (
        <section className="overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[0.9fr_1.6fr]">
            {content.formula && (
              <div className="flex min-h-[180px] flex-col justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-5 text-white sm:p-6">
                <div className="mb-3 flex items-center gap-2 text-xs font-black text-indigo-200">
                  <Hash size={16} />
                  الصيغة
                </div>

                <MathJax dynamic hideUntilTypeset="first">
                  <div
                    dir="ltr"
                    className="overflow-x-auto text-center text-xl font-black sm:text-2xl [&_mjx-container]:mx-auto [&_mjx-container]:block"
                  >
                    {`\\[${getPureMathExpression(content.formula)}\\]`}
                  </div>
                </MathJax>
              </div>
            )}

            <div className="divide-y divide-slate-100">
              {content.meaning && (
                <div className="p-5 sm:p-6">
                  <div className="mb-2 flex items-center gap-2 text-sm font-black text-emerald-700">
                    <BookOpen size={17} />
                    المعنى
                  </div>
                  <MathText className="text-[15px] font-semibold leading-8 text-slate-700">
                    {content.meaning}
                  </MathText>
                </div>
              )}

              {content.geometric_meaning && (
                <div className="p-5 sm:p-6">
                  <div className="mb-2 flex items-center gap-2 text-sm font-black text-sky-700">
                    <Compass size={17} />
                    المعنى الهندسي
                  </div>
                  <MathText className="text-[15px] font-semibold leading-8 text-slate-700">
                    {content.geometric_meaning}
                  </MathText>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {parts.length > 0 && (
        <section className="rounded-[24px] border border-violet-100 bg-violet-50/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-violet-800">
            <ListChecks size={17} />
            نفكك العبارة
          </div>

          <div className="flex flex-wrap gap-3">
            {parts.map((part, index) => (
              <div
                key={part.id || `observation-part-${index}`}
                className="min-w-[220px] flex-1 rounded-2xl border border-violet-100 bg-white px-4 py-3 shadow-sm"
              >
                {part.expression && (
                  <MathJax dynamic hideUntilTypeset="first">
                    <div
                      dir="ltr"
                      className="mb-2 overflow-x-auto text-center text-base font-black text-violet-800 [&_mjx-container]:mx-auto [&_mjx-container]:block"
                    >
                      {`\\[${getPureMathExpression(part.expression)}\\]`}
                    </div>
                  </MathJax>
                )}

                {part.meaning && (
                  <MathText className="text-center text-sm font-semibold leading-7 text-slate-700">
                    {part.meaning}
                  </MathText>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {valueTable.length > 0 && (
        <DynamicDataTable
          rows={valueTable}
          preferredColumns={["x", "x_cubed", "two_x", "constant", "f_x"]}
          title={content.table_title || "جدول القيم"}
        />
      )}

      {legacyTable && (
        <FlexibleTable
          table={legacyTable}
          title={content.table_title || legacyTable?.title || "جدول توضيحي"}
        />
      )}

      {content.observation && (
        <InfoBox title="الملاحظة" tone="sky" icon={Brain}>
          <MathText className="text-sm font-bold leading-7">
            {content.observation}
          </MathText>
        </InfoBox>
      )}

      {content.discovery && (
        <InfoBox title="ما الذي اكتشفناه؟" tone="emerald" icon={Lightbulb}>
          <MathText className="text-sm font-bold leading-7">
            {content.discovery}
          </MathText>
        </InfoBox>
      )}

      {content.conclusion && (
        <InfoBox title="الاستنتاج" tone="emerald" icon={CheckCircle2}>
          <MathText className="text-sm font-black leading-7">
            {content.conclusion}
          </MathText>
        </InfoBox>
      )}

      {Array.isArray(content.examples) && content.examples.length > 0 && (
        <section className="rounded-[26px] border border-sky-100 bg-sky-50/35 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-sky-800">
            <ListChecks size={18} />
            <div>
              <h3 className="font-black text-slate-950">تطبيق العملية على النهايات</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                نكتب العبارة، ثم نهايات أجزائها، ثم النتيجة النهائية.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {content.examples.map((item, index) => {
              const expression =
                item?.expression ??
                item?.operation ??
                item?.question ??
                item?.statement ??
                "";

              const limits =
                item?.limits ??
                item?.parts_limits ??
                item?.intermediate_result ??
                item?.calculation ??
                "";

              const conclusion =
                item?.conclusion ??
                item?.answer ??
                item?.result ??
                item?.final_answer ??
                "";

              const knownKeys = new Set([
                "id",
                "expression",
                "operation",
                "question",
                "statement",
                "limits",
                "parts_limits",
                "intermediate_result",
                "calculation",
                "conclusion",
                "answer",
                "result",
                "final_answer",
              ]);

              const extraContent = Object.fromEntries(
                Object.entries(item || {}).filter(
                  ([key, value]) =>
                    !knownKeys.has(key) &&
                    !isEmpty(value) &&
                    !isTechnicalPresentationField(key) &&
                    !looksLikeSvgMarkup(value),
                ),
              );

              return (
                <article
                  key={item?.id || `observation-example-${index}`}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-l from-sky-50 to-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-sm font-black text-white">
                        {index + 1}
                      </span>
                      <h4 className="font-black text-slate-950">المثال {index + 1}</h4>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    {!isEmpty(expression) && (
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3.5">
                        <p className="mb-2 text-xs font-black text-indigo-700">العبارة المدروسة</p>
                        <MathText className="text-center text-base font-black leading-8 text-slate-950">
                          {expression}
                        </MathText>
                      </div>
                    )}

                    {!isEmpty(limits) && (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50/65 p-3.5">
                        <p className="mb-2 text-xs font-black text-amber-700">نهايات الأجزاء</p>
                        <MathText className="text-center text-base font-black leading-8 text-amber-950">
                          {limits}
                        </MathText>
                      </div>
                    )}

                    {!isEmpty(conclusion) && (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5">
                        <p className="mb-2 text-xs font-black text-emerald-700">النتيجة النهائية</p>
                        <MathText className="text-center text-base font-black leading-8 text-emerald-950">
                          {conclusion}
                        </MathText>
                      </div>
                    )}

                    {Object.keys(extraContent).length > 0 && (
                      <div className="border-t border-slate-100 pt-3">
                        <StructuredValue value={extraContent} depth={1} />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {(content.why || content.how_to_think || content.attention) && (
        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          {content.why && (
            <div className="flex gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Lightbulb size={16} />
              </span>
              <div className="min-w-0">
                <h4 className="mb-1 text-sm font-black text-slate-900">
                  لماذا نتعلم هذه الفكرة؟
                </h4>
                <MathText className="text-sm font-semibold leading-7 text-slate-700">
                  {content.why}
                </MathText>
              </div>
            </div>
          )}

          {content.how_to_think && (
            <div className="flex gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <Brain size={16} />
              </span>
              <div className="min-w-0">
                <h4 className="mb-1 text-sm font-black text-slate-900">
                  كيف أفكر؟
                </h4>
                <MathText className="text-sm font-semibold leading-7 text-slate-700">
                  {content.how_to_think}
                </MathText>
              </div>
            </div>
          )}

          {content.attention && (
            <div className="flex gap-3 px-4 py-4 sm:px-5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                <AlertTriangle size={16} />
              </span>
              <div className="min-w-0">
                <h4 className="mb-1 text-sm font-black text-rose-900">
                  انتبه
                </h4>
                <MathText className="text-sm font-semibold leading-7 text-rose-900">
                  {content.attention}
                </MathText>
              </div>
            </div>
          )}
        </section>
      )}

      {content.takeaway && (
        <section className="flex items-start gap-3 rounded-[22px] border border-indigo-100 bg-indigo-50/70 px-4 py-4 sm:px-5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm">
            <CheckCircle2 size={17} />
          </span>
          <div>
            <h4 className="mb-1 text-sm font-black text-indigo-950">الخلاصة</h4>
            <MathText className="text-sm font-black leading-7 text-indigo-950">
              {content.takeaway}
            </MathText>
          </div>
        </section>
      )}

      {quickCheck?.question && (
        <RevealBox label={quickCheck.question} tone="emerald">
          <MathText className="font-black">
            {quickCheck.answer || "لم تُرسل الإجابة من الخادم."}
          </MathText>
        </RevealBox>
      )}

      {(content.question || content.expected_answer) && (
        <RevealBox
          label={content.question || "فكّر ثم أظهر الجواب"}
          tone="indigo"
        >
          <MathText className="font-black">
            {content.expected_answer}
          </MathText>
        </RevealBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <StructuredValue value={remainingContent} depth={1} />
        </section>
      )}
    </div>
  );
}

function GuidedExplanationStep({ content = {} }) {
  const mapping = content.mapping || {};

  const mappingCards = [
    {
      label: "المدخل",
      value:
        mapping.input ||
        mapping.given ||
        mapping.domain ||
        mapping.start ||
        "",
      icon: Hash,
    },
    {
      label: "الخاصية",
      value:
        mapping.property ||
        mapping.rule ||
        mapping.expression ||
        mapping.statement ||
        "",
      icon: Brain,
    },
    {
      label: "الهدف",
      value:
        mapping.truth_goal ||
        mapping.output ||
        mapping.goal ||
        mapping.result ||
        "",
      icon: CheckCircle2,
    },
  ].filter((item) => !isEmpty(item.value));

  const rows = Array.isArray(content.rows)
    ? content.rows.filter(Boolean)
    : [];

  const symbols = Array.isArray(content.symbols)
    ? content.symbols.filter(Boolean)
    : [];

  const examples = Array.isArray(content.examples)
    ? content.examples.filter(Boolean)
    : [];

  const simpleMeaning =
    content.simple_meaning ||
    content.central_idea ||
    "";

  const formalStatement =
    content.formal_statement ||
    content.definition ||
    content.property ||
    "";

  const quickCheck =
    content.quick_check ||
    (content.checkpoint_question || content.checkpoint_answer
      ? {
          question: content.checkpoint_question,
          answer: content.checkpoint_answer,
        }
      : null);

  const rowTone = (index) => {
    const tones = [
      {
        border: "border-slate-300",
        bg: "bg-slate-50",
        badge: "bg-slate-800",
        text: "text-slate-800",
      },
      {
        border: "border-indigo-200",
        bg: "bg-indigo-50/70",
        badge: "bg-indigo-600",
        text: "text-indigo-800",
      },
      {
        border: "border-emerald-200",
        bg: "bg-emerald-50/70",
        badge: "bg-emerald-600",
        text: "text-emerald-800",
      },
    ];

    return tones[index % tones.length];
  };

  return (
    <div className="space-y-5">
      {content.teacher && (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-l from-indigo-50/80 via-white to-white p-4 shadow-sm">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-black text-indigo-800">
            <Brain size={14} />
            شرح الفكرة
          </div>

          <MathText className="text-sm font-semibold leading-7 text-slate-700 sm:text-[15px]">
            {content.teacher}
          </MathText>
        </div>
      )}

      {simpleMeaning && (
        <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm">
          <Sparkles
            size={18}
            className="mt-1 shrink-0 text-violet-600"
          />

          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-violet-700">
              الفكرة الأساسية
            </p>

            <MathText className="text-sm font-black leading-7 text-slate-900">
              {simpleMeaning}
            </MathText>
          </div>
        </div>
      )}

      {formalStatement && (
        <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-black text-indigo-700">
            الصياغة الرياضية
          </p>

          <MixedArabicMath value={formalStatement} />
        </div>
      )}

      {rows.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <ListChecks size={18} className="text-indigo-600" />

            <div>
              <h3 className="font-black text-slate-950">
                الأسطر الأساسية في جدول التغيرات
              </h3>

              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                لكل سطر وظيفة مختلفة، والسطر الثاني يبرر السطر الثالث.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-sm">
            <table
              dir="rtl"
              className="w-full border-collapse text-right"
            >
              <thead>
                <tr className="bg-slate-950 text-white">
                  <th className="w-20 border-l border-white/20 px-4 py-3 text-center text-sm font-black">
                    الرقم
                  </th>

                  <th className="w-48 border-l border-white/20 px-4 py-3 text-sm font-black">
                    اسم السطر
                  </th>

                  <th className="px-4 py-3 text-sm font-black">
                    ماذا يحتوي؟
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((item, index) => {
                  const tone = rowTone(index);

                  return (
                    <tr
                      key={item?.row || `variation-row-${index}`}
                      className="border-t-2 border-slate-900"
                    >
                      <td className="border-l border-slate-300 px-4 py-4 text-center">
                        <span
                          className={cn(
                            "mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-white",
                            tone.badge,
                          )}
                        >
                          {index + 1}
                        </span>
                      </td>

                      <th
                        className={cn(
                          "border-l border-slate-300 px-4 py-4 text-sm font-black",
                          tone.bg,
                          tone.text,
                        )}
                      >
                        <MathText className="font-black">
                          {item?.row || item?.name || ""}
                        </MathText>
                      </th>

                      <td className="px-4 py-4">
                        <MathText className="text-sm font-semibold leading-7 text-slate-700">
                          {item?.contains ||
                            item?.meaning ||
                            item?.description ||
                            ""}
                        </MathText>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {symbols.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Hash size={18} className="text-violet-600" />

            <h3 className="font-black text-slate-950">
              الرموز المستعملة في جدول التغيرات
            </h3>
          </div>

          <div
            className={cn(
              "grid auto-rows-fr gap-3",
              symbols.length === 1 && "grid-cols-1",
              symbols.length === 2 && "sm:grid-cols-2",
              symbols.length >= 3 && "sm:grid-cols-3",
            )}
          >
            {symbols.map((item, index) => (
              <article
                key={item?.symbol || `variation-symbol-${index}`}
                className="flex h-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-3xl font-black text-white shadow-lg shadow-indigo-500/20">
                  <span dir="ltr">{item?.symbol}</span>
                </div>

                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-black text-violet-700">
                    المعنى
                  </p>

                  <MathText className="text-sm font-semibold leading-7 text-slate-700">
                    {item?.meaning || ""}
                  </MathText>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {mappingCards.length > 0 && (
        <div
          className={cn(
            "grid gap-3",
            mappingCards.length === 1 && "grid-cols-1",
            mappingCards.length === 2 && "sm:grid-cols-2",
            mappingCards.length >= 3 && "md:grid-cols-3",
          )}
        >
          {mappingCards.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon size={16} className="text-indigo-600" />
                <p className="text-xs font-black text-indigo-700">
                  {label}
                </p>
              </div>

              <MathText className="text-sm font-black leading-7 text-indigo-950">
                {value}
              </MathText>
            </div>
          ))}
        </div>
      )}

      {examples.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {examples.map((item, index) => (
            <article
              key={item?.id || index}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <StructuredValue value={item} depth={1} />
            </article>
          ))}
        </div>
      )}

      {(content.why || content.how_to_think) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {content.why && (
            <InfoBox
              title="لماذا نتعلم هذه الفكرة؟"
              tone="amber"
              icon={CircleHelp}
            >
              <MathText className="text-sm font-semibold leading-7">
                {content.why}
              </MathText>
            </InfoBox>
          )}

          {content.how_to_think && (
            <InfoBox
              title="كيف أفكر؟"
              tone="sky"
              icon={Brain}
            >
              <MathText className="text-sm font-semibold leading-7">
                {content.how_to_think}
              </MathText>
            </InfoBox>
          )}
        </div>
      )}

      {content.attention && (
        <InfoBox
          title="انتبه إلى هذه النقطة"
          tone="rose"
          icon={AlertTriangle}
        >
          <MathText className="text-sm font-semibold leading-7">
            {content.attention}
          </MathText>
        </InfoBox>
      )}

      {content.example &&
        typeof content.example === "object" &&
        !Array.isArray(content.example) && (
          <MethodExplicitExample
            example={content.example}
            title="مثال تطبيقي"
          />
        )}

      {content.takeaway && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-50 to-white p-4 shadow-sm">
          <CheckCircle2
            size={19}
            className="mt-1 shrink-0 text-indigo-600"
          />

          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-indigo-700">
              الخلاصة
            </p>

            <MathText className="text-sm font-black leading-7 text-slate-900">
              {content.takeaway}
            </MathText>
          </div>
        </div>
      )}

      {quickCheck?.question && (
        <RevealBox label={quickCheck.question} tone="emerald">
          <MathText className="font-black">
            {quickCheck.answer ||
              "لم تُرسل الإجابة من الخادم."}
          </MathText>
        </RevealBox>
      )}
    </div>
  );
}

function NotationStep({ content = {} }) {
  const handledKeys = new Set([
    "teacher",
    "symbols",
    "comparison",
    "memory_tip",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !handledKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <MathText className="text-slate-700">{content.teacher}</MathText>

      <div className="grid gap-4 sm:grid-cols-2">
        {(content.symbols || []).map((item, index) => (
          <div key={index} className="rounded-[28px] border border-violet-100 bg-gradient-to-b from-violet-50 to-white p-5 shadow-sm">
            <MathPanel className="border-violet-900 bg-violet-950">{item.symbol}</MathPanel>
            <MathText className="mt-4 text-sm font-semibold text-violet-950">
              {item.meaning}
            </MathText>
          </div>
        ))}
      </div>

      {Array.isArray(content.comparison) && (
        <div className="grid gap-4 md:grid-cols-2">
          {content.comparison.map((item, index) => (
            <div key={index} className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-24px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg">
              <MathText className="text-lg font-black text-indigo-700">{item.expression}</MathText>
              <p className="mt-2 font-black text-slate-900">{item.is}</p>
              <MathText className="mt-2 text-sm text-slate-600">{item.example}</MathText>
            </div>
          ))}
        </div>
      )}

      {!isEmpty(content.memory_tip) && (
        <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb}>
          <MathText className="font-bold">{content.memory_tip}</MathText>
        </InfoBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <GenericObjectStep content={remainingContent} />
      )}
    </div>
  );
}

function RankStep({ content }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <MathText className="text-slate-700">{content.teacher}</MathText>
      <MathPanel>{content.rule}</MathPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        {(content.cases || []).map((item, index) => (
          <div key={index} className="rounded-[26px] border border-sky-100 bg-gradient-to-b from-sky-50 to-white p-5 shadow-sm">
            <p className="text-sm font-black text-sky-700">{item.start}</p>
            <MathText className="mt-3 font-black text-sky-950">{item.example}</MathText>
            <MathText className="mt-3 text-sm text-slate-700">{item.conclusion}</MathText>
          </div>
        ))}
      </div>

      <RevealBox label={content.checkpoint_question} tone="emerald">
        <MathText className="font-black">{content.checkpoint_answer}</MathText>
      </RevealBox>
    </div>
  );
}

function MethodsOverviewStep({ content = {} }) {
  const methods = Array.isArray(content.methods)
    ? content.methods.filter(
        (method) => method && typeof method === "object" && !Array.isArray(method),
      )
    : [];

  return (
    <div className="space-y-5 sm:space-y-6">
      {!isEmpty(content.teacher) && (
        <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <Brain size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-black text-indigo-700">
                كيف تُعرَّف المتتالية؟
              </p>
              <MathText className="font-semibold leading-8 text-slate-700">
                {content.teacher}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {methods.length > 0 && (
        <div className="grid items-stretch gap-5 lg:grid-cols-2">
          {methods.map((method, index) => {
            const isExplicit = index === 0;
            const MethodIcon = isExplicit ? Zap : Route;
            const needs = Array.isArray(method.needs)
              ? method.needs.filter((item) => !isEmpty(item))
              : !isEmpty(method.needs)
                ? [method.needs]
                : [];

            return (
              <article
                key={method.id || method.name || `definition-method-${index}`}
                className={cn(
                  "relative flex min-w-0 flex-col overflow-hidden rounded-[30px] border p-5 shadow-sm sm:p-6",
                  isExplicit
                    ? "border-indigo-200 bg-gradient-to-b from-indigo-50/90 to-white"
                    : "border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white",
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full blur-3xl",
                    isExplicit ? "bg-indigo-200/35" : "bg-emerald-200/35",
                  )}
                />

                <div className="relative flex items-center justify-between gap-3">
                  <span className="inline-flex items-center rounded-full border border-white/90 bg-white/90 px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm">
                    الطريقة {index + 1}
                  </span>
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1",
                      isExplicit
                        ? "text-indigo-700 ring-indigo-100"
                        : "text-emerald-700 ring-emerald-100",
                    )}
                  >
                    <MethodIcon size={20} />
                  </span>
                </div>

                <div className="relative mt-5 min-w-0">
                  {!isEmpty(method.name) && (
                    <h3 className="text-lg font-black leading-8 text-slate-950 sm:text-xl">
                      {method.name}
                    </h3>
                  )}

                  {!isEmpty(method.idea) && (
                    <MathText className="mt-2 font-semibold leading-8 text-slate-700">
                      {method.idea}
                    </MathText>
                  )}
                </div>

                {needs.length > 0 && (
                  <div className="relative mt-5 flex-1">
                    <p
                      className={cn(
                        "mb-2.5 text-xs font-black",
                        isExplicit ? "text-indigo-700" : "text-emerald-700",
                      )}
                    >
                      ما الذي نحتاجه؟
                    </p>

                    <div className="space-y-2.5">
                      {needs.map((need, needIndex) => {
                        const needText = getDisplayText(need);
                        if (!needText) return null;

                        return (
                          <div
                            key={`${needText}-${needIndex}`}
                            className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm"
                          >
                            <CheckCircle2
                              size={17}
                              className={cn(
                                "mt-1 shrink-0",
                                isExplicit ? "text-indigo-600" : "text-emerald-600",
                              )}
                            />
                            <MathText className="min-w-0 flex-1 text-sm font-bold leading-7 text-slate-700">
                              {needText}
                            </MathText>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!isEmpty(method.advantage) && (
                  <InfoBox
                    title="الميزة"
                    tone={isExplicit ? "indigo" : "emerald"}
                    icon={Trophy}
                    className="relative mt-5 shrink-0"
                  >
                    <MathText className="text-sm font-bold leading-7">
                      {method.advantage}
                    </MathText>
                  </InfoBox>
                )}
              </article>
            );
          })}
        </div>
      )}

      {!isEmpty(content.important_note) && (
        <InfoBox
          title="ملاحظة مهمة"
          tone="rose"
          icon={AlertTriangle}
          compact={false}
          className="relative z-0"
        >
          <MathText className="font-bold leading-8">
            {content.important_note}
          </MathText>
        </InfoBox>
      )}
    </div>
  );
}

function MethodTimeline({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="relative space-y-4">
      <div className="pointer-events-none absolute bottom-8 right-5 top-8 hidden w-px bg-gradient-to-b from-indigo-200 via-violet-300 to-transparent sm:block" />

      {items.map((item, index) => {
        const isPrimitive =
          typeof item === "string" || typeof item === "number";

        const stepNumber =
          !isPrimitive && item?.step_number !== undefined
            ? item.step_number
            : index + 1;

        const instruction = isPrimitive
          ? String(item)
          : item?.instruction ||
            item?.text ||
            item?.title ||
            item?.step ||
            item?.action ||
            item?.statement ||
            item?.content ||
            "";

        const why = isPrimitive
          ? ""
          : item?.why ||
            item?.reason ||
            item?.explanation ||
            item?.justification ||
            "";

        if (!instruction && !why) return null;

        return (
          <div
            key={`${stepNumber}-${index}`}
            className="group relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg sm:pr-20"
          >
            <div className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-b from-indigo-500 to-violet-600" />

            <div className="mb-4 flex items-center gap-3 sm:absolute sm:right-5 sm:top-5 sm:mb-0">
              <div className="flex h-11 min-w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-3 font-black text-white shadow-lg shadow-indigo-500/20">
                {stepNumber}
              </div>
            </div>

            <div className="min-w-0">
              {instruction && (
                <div>
                  <p className="mb-1.5 text-[11px] font-black tracking-wide text-indigo-600">
                    ماذا أفعل؟
                  </p>
                  <MathText className="font-black text-slate-950">
                    {instruction}
                  </MathText>
                </div>
              )}

              {why && (
                <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-black text-sky-700">
                    <Lightbulb size={15} />
                    لماذا نقوم بهذه الخطوة؟
                  </div>
                  <MathText className="text-sm font-semibold text-slate-700">
                    {why}
                  </MathText>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WorkedExample({ example, tone = "emerald" }) {
  if (!example || typeof example !== "object") return null;

  const statement =
    example.statement ||
    example.question ||
    example.exercise ||
    example.prompt ||
    example.teacher ||
    example.given ||
    "";

  const stepsSource = Array.isArray(example.steps)
    ? example.steps.filter(Boolean)
    : example.steps
      ? [example.steps]
      : [];

  const conclusion =
    example.conclusion ||
    example.final_conclusion ||
    example.final_answer ||
    example.takeaway ||
    "";

  const ignoredKeys = new Set([
    "statement",
    "question",
    "exercise",
    "prompt",
    "teacher",
    "given",
    "steps",
    "conclusion",
    "final_conclusion",
    "final_answer",
    "takeaway",
  ]);

  const extraEntries = Object.entries(example).filter(
    ([key, value]) => !ignoredKeys.has(key) && !isEmpty(value),
  );

  const hasUsefulContent =
    !isEmpty(statement) ||
    stepsSource.length > 0 ||
    !isEmpty(conclusion) ||
    extraEntries.length > 0;

  if (!hasUsefulContent) return null;

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_22px_55px_-32px_rgba(15,23,42,0.42)]">
      <div className={cn("p-5 text-white", tone === "emerald" ? "bg-emerald-600" : "bg-indigo-600")}>
        <div className="flex items-center gap-2 font-black">
          <GraduationCap size={20} />
          مثال محلول خطوة بخطوة
        </div>
        {!isEmpty(statement) && (
          <MathText className="mt-3 font-semibold text-white">
            {statement}
          </MathText>
        )}
      </div>

      <div className="space-y-4 bg-gradient-to-b from-white to-slate-50/60 p-5 sm:p-6">
        {stepsSource.map((item, index) => {
          const primitive =
            typeof item === "string" ||
            typeof item === "number";

          const title = primitive
            ? `الخطوة ${index + 1}`
            : item?.title || `الخطوة ${index + 1}`;

          const explanation = primitive
            ? String(item)
            : item?.explanation ||
              item?.teacher_explanation ||
              item?.instruction ||
              item?.text ||
              "";

          const details =
            !primitive && Array.isArray(item?.details)
              ? item.details
              : [];

          const calculation =
            !primitive
              ? item?.calculation ||
                item?.formula ||
                item?.expression ||
                ""
              : "";

          const result =
            !primitive
              ? item?.result || item?.answer || ""
              : "";

          return (
            <div
              key={item?.id || `worked-step-${index}`}
              className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-indigo-600 px-2 font-black text-white">
                  {item?.step_number || index + 1}
                </span>
                <h4 className="font-black text-slate-900">{title}</h4>
              </div>

              {explanation && (
                <MathText className="text-sm font-semibold text-slate-600">
                  {explanation}
                </MathText>
              )}

              {details.length > 0 && (
                <div className="mt-4">
                  <BulletList
                    items={details}
                    tone="indigo"
                    icon={CheckCircle2}
                  />
                </div>
              )}

              {calculation && (
                <div className="mt-3">
                  <MathPanel>{calculation}</MathPanel>
                </div>
              )}

              {!isEmpty(result) && (
                <div className="mt-4">
                  <InfoBox title="نتيجة الخطوة" tone="emerald" icon={CheckCircle2}>
                    {typeof result === "string" || typeof result === "number" ? (
                      <MathText className="font-bold">{String(result)}</MathText>
                    ) : (
                      <StructuredValue
                        value={result}
                        fieldKey="result"
                        depth={1}
                      />
                    )}
                  </InfoBox>
                </div>
              )}
            </div>
          );
        })}

        {extraEntries.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {extraEntries.map(([key, value]) => (
              <div
                key={key}
                className="rounded-[22px] border border-indigo-100 bg-white p-5 shadow-sm"
              >
                <p className="mb-3 text-xs font-black text-indigo-700">
                  {fieldLabel(key)}
                </p>
                <StructuredValue value={value} fieldKey={key} depth={1} />
              </div>
            ))}
          </div>
        )}

        {!isEmpty(conclusion) && (
          <InfoBox title="النتيجة" tone="emerald" icon={CheckCircle2}>
            <MathText className="font-black">{conclusion}</MathText>
          </InfoBox>
        )}
      </div>
    </div>
  );
}

function ExplicitMethodStep({ content }) {
  return (
    <div className="space-y-6">
      <InfoBox title="التعريف" tone="indigo" icon={BookOpen}>
        <MathText className="font-bold">{content.definition}</MathText>
      </InfoBox>
      <MethodTimeline items={content.method} />
      <WorkedExample example={content.worked_example} tone="indigo" />

      {content.second_example && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <MathText className="font-bold text-amber-950">{content.second_example.statement}</MathText>
          <MathText className="mt-3 text-sm text-amber-900">{content.second_example.domain_note}</MathText>
        </div>
      )}
    </div>
  );
}

function RecursiveMethodStep({ content }) {
  return (
    <div className="space-y-6">
      <InfoBox title="التعريف" tone="emerald" icon={BookOpen}>
        <MathText className="font-bold">{content.definition}</MathText>
      </InfoBox>
      <MethodTimeline items={content.method} />
      <WorkedExample example={content.worked_example} tone="emerald" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="mb-3 font-black text-indigo-800">علاقة من الرتبة الأولى</p>
          <MathPanel>{content.first_order_form}</MathPanel>
        </div>
        <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
          <p className="mb-3 font-black text-violet-800">علاقة من الرتبة الثانية</p>
          <MathPanel>{content.second_order_form}</MathPanel>
        </div>
      </div>

      {content.second_order_example && (
        <div className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm">
          <p className="font-black text-violet-800">{content.second_order_example.key_idea}</p>
          <MathText className="mt-3 text-slate-700">{content.second_order_example.statement}</MathText>
          <div className="mt-4"><MathPanel>{content.second_order_example.calculation}</MathPanel></div>
        </div>
      )}

      <InfoBox title="لماذا نحتاج حدًا ابتدائيًا؟" tone="rose" icon={AlertTriangle}>
        <MathText className="font-bold">{content.why_initial_terms_are_required}</MathText>
      </InfoBox>
    </div>
  );
}

function ComparisonStep({ content = {} }) {
  /*
   * هذا النوع من المراحل يصل بأكثر من بنية JSON:
   * - comparisons: [...]  (البنية القديمة)
   * - items: [...]        (البنية الجديدة)
   *
   * لذلك نوحّد المصدر هنا بدل إسقاط المحتوى إذا تغيّر اسم الحقل.
   */
  const comparisonSource = Array.isArray(content.comparisons)
    ? content.comparisons
    : Array.isArray(content.comparison)
      ? content.comparison
      : Array.isArray(content.items)
        ? content.items
        : [];

  const comparisons = comparisonSource.filter(Boolean);

  const comparisonTable = Array.isArray(content.comparison_table)
    ? content.comparison_table.filter(Boolean)
    : [];

  const decisionRule = Array.isArray(content.decision_rule)
    ? content.decision_rule.filter(Boolean)
    : [];

  const quadrants = Array.isArray(content.quadrants)
    ? content.quadrants.filter(Boolean)
    : [];

  const manuallyRenderedKeys = new Set([
    "comparisons",
    "comparison",
    "items",
    "quadrants",
    "comparison_table",
    "decision_rule",
    "main_difference",
    "memory_tip",

    // هذه الحقول يعرضها LessonStepCard مركزيًا عبر PedagogicalBlocks.
    "why",
    "how_to_think",
    "attention",
    "quick_check",
    "takeaway",
    "mastery_rule",
    "next_step",
  ]);

  /*
   * لا نخفي أي حقل جديد غير معروف مستقبلًا.
   * أي بيانات إضافية في JSON ستظهر تلقائيًا في نهاية المرحلة.
   */
  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {comparisons.length > 0 && (
        <section className="rounded-[28px] border border-slate-200 bg-slate-50/45 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <ListChecks size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">
                مقارنة منظمة
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                قارن العناصر بندًا بندًا مع الحفاظ على الصيغ الرياضية واضحة.
              </p>
            </div>
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-4",
              comparisons.length >= 2 && "lg:grid-cols-2",
              comparisons.length >= 3 && "xl:grid-cols-3",
            )}
          >
            {comparisons.map((rawItem, index) => {
              const item =
                rawItem && typeof rawItem === "object" && !Array.isArray(rawItem)
                  ? rawItem
                  : { concept: getDisplayText(rawItem) };

              const isFirst = index === 0;
              const definition =
                item.definition ||
                item.meaning ||
                item.description ||
                item.idea ||
                "";

              const keyCondition =
                item.key_condition ||
                item.condition ||
                item.requirement ||
                item.when_to_use ||
                "";

              const knownItemKeys = new Set([
                "id",
                "concept",
                "title",
                "name",
                "item",
                "notation",
                "definition",
                "meaning",
                "description",
                "idea",
                "example",
                "key_condition",
                "condition",
                "requirement",
                "when_to_use",
              ]);

              const extraItemContent = Object.fromEntries(
                Object.entries(item).filter(
                  ([key, value]) =>
                    !knownItemKeys.has(key) &&
                    !isEmpty(value) &&
                    !isTechnicalPresentationField(key) &&
                    !looksLikeSvgMarkup(value),
                ),
              );

              return (
                <article
                  key={
                    item?.id ||
                    item?.concept ||
                    item?.title ||
                    item?.item ||
                    item?.notation ||
                    `comparison-${index}`
                  }
                  className={cn(
                    "flex min-w-0 flex-col overflow-hidden rounded-[24px] border bg-white shadow-sm",
                    isFirst
                      ? "border-indigo-200"
                      : "border-emerald-200",
                  )}
                >
                  <div
                    className={cn(
                      "flex min-h-[88px] items-center justify-between gap-3 border-b px-4 py-4 sm:px-5",
                      isFirst
                        ? "border-indigo-100 bg-gradient-to-l from-indigo-50 to-white"
                        : "border-emerald-100 bg-gradient-to-l from-emerald-50 to-white",
                    )}
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-[11px] font-black",
                          isFirst
                            ? "text-indigo-600"
                            : "text-emerald-600",
                        )}
                      >
                        النوع {index + 1}
                      </p>

                      <MathText
                        as="h4"
                        className="mt-1 text-base font-black leading-7 text-slate-950 sm:text-lg"
                      >
                        {item?.concept ||
                          item?.title ||
                          item?.name ||
                          item?.item ||
                          `العنصر ${index + 1}`}
                      </MathText>
                    </div>

                    {item?.notation && (
                      <div
                        dir="ltr"
                        className={cn(
                          "shrink-0 rounded-xl border bg-white px-3 py-2 shadow-sm",
                          isFirst
                            ? "border-indigo-200"
                            : "border-emerald-200",
                        )}
                      >
                        <MathText
                          as="span"
                          className={cn(
                            "font-black",
                            isFirst
                              ? "text-indigo-800"
                              : "text-emerald-800",
                          )}
                        >
                          {item.notation}
                        </MathText>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col space-y-3 p-4 sm:p-5">
                    {!isEmpty(definition) && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <BookOpen
                            size={16}
                            className={
                              isFirst ? "text-indigo-600" : "text-emerald-600"
                            }
                          />
                          <p className="text-xs font-black text-slate-600">
                            التعريف / طريقة الرسم
                          </p>
                        </div>
                        <MathText className="text-sm font-semibold leading-7 text-slate-800">
                          {definition}
                        </MathText>
                      </div>
                    )}

                    {!isEmpty(item?.example) && (
                      <div
                        className={cn(
                          "rounded-2xl border p-4",
                          isFirst
                            ? "border-indigo-100 bg-indigo-50/60"
                            : "border-emerald-100 bg-emerald-50/60",
                        )}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Hash
                            size={16}
                            className={
                              isFirst ? "text-indigo-700" : "text-emerald-700"
                            }
                          />
                          <p
                            className={cn(
                              "text-xs font-black",
                              isFirst
                                ? "text-indigo-700"
                                : "text-emerald-700",
                            )}
                          >
                            مثال
                          </p>
                        </div>
                        <MathText className="text-sm font-black leading-7 text-slate-900">
                          {item.example}
                        </MathText>
                      </div>
                    )}

                    {!isEmpty(keyCondition) && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/75 p-4">
                        <div className="mb-2 flex items-center gap-2 text-amber-800">
                          <Target size={16} />
                          <p className="text-xs font-black">الشرط الأساسي</p>
                        </div>
                        <MathText className="text-sm font-bold leading-7 text-amber-950">
                          {keyCondition}
                        </MathText>
                      </div>
                    )}

                    {Object.keys(extraItemContent).length > 0 && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <StructuredValue
                          value={extraItemContent}
                          fieldKey="comparison_item_details"
                          depth={1}
                        />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!isEmpty(content.main_difference) && (
        <section className="overflow-hidden rounded-[26px] border border-indigo-200 bg-gradient-to-l from-indigo-50 via-white to-violet-50 shadow-sm">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <Route size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-xs font-black text-indigo-700">
                الفرق الأساسي
              </p>
              <MathText className="text-[15px] font-black leading-8 text-slate-900 sm:text-base">
                {content.main_difference}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {decisionRule.length > 0 && (
        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-indigo-700">
            <Compass size={18} />
            <h3 className="font-black text-slate-950">قاعدة الاختيار</h3>
          </div>
          <BulletList
            items={decisionRule}
            tone="indigo"
            icon={Compass}
          />
        </section>
      )}

      {comparisonTable.length > 0 && (
        <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right">
              <thead className="bg-gradient-to-l from-slate-950 to-indigo-950 text-white">
                <tr>
                  <th className="px-5 py-4 text-sm font-black">
                    المعيار
                  </th>
                  <th className="px-5 py-4 text-sm font-black">
                    العنصر الأول
                  </th>
                  <th className="px-5 py-4 text-sm font-black">
                    العنصر الثاني
                  </th>
                </tr>
              </thead>

              <tbody>
                {comparisonTable.map((row, index) => (
                  <tr
                    key={row?.id || index}
                    className="border-t border-slate-200 even:bg-slate-50"
                  >
                    <td className="px-5 py-4 font-black text-slate-900">
                      {row?.criterion || row?.label || row?.name}
                    </td>

                    <td className="px-5 py-4">
                      <MathText className="text-sm text-indigo-800">
                        {row?.explicit ||
                          row?.first ||
                          row?.left ||
                          ""}
                      </MathText>
                    </td>

                    <td className="px-5 py-4">
                      <MathText className="text-sm text-emerald-800">
                        {row?.recursive ||
                          row?.second ||
                          row?.right ||
                          ""}
                      </MathText>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isEmpty(content.memory_tip) && (
        <InfoBox
          title="حيلة للحفظ"
          tone="amber"
          icon={Lightbulb}
          compact={false}
        >
          <MathText className="font-black leading-8">
            {content.memory_tip}
          </MathText>
        </InfoBox>
      )}

      {quadrants.length > 0 && (
        <section className="rounded-[26px] border border-violet-100 bg-violet-50/35 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Compass size={18} className="text-violet-600" />
            <div>
              <h3 className="font-black text-slate-950">إشارات الأرباع</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                الربع، إشارات الجزأين، وصيغة الزاوية في جدول واحد واضح.
              </p>
            </div>
          </div>
          <DynamicDataTable
            rows={quadrants}
            preferredColumns={["quadrant", "signs", "angle_form"]}
          />
        </section>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <section className="rounded-[26px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <StructuredValue
            value={remainingContent}
            fieldKey="comparison_extra_content"
            depth={1}
          />
        </section>
      )}
    </div>
  );
}

function BacConnectionStep({ content }) {
  return (
    <div className="space-y-6">
      <InfoBox title="حيلة البكالوريا" tone="amber" icon={Lightbulb}>
        <MathText className="font-black">{content.exam_tip}</MathText>
      </InfoBox>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-4 font-black text-slate-900">قالب كتابة الإجابة</h3>
          <MethodTimeline
            items={(content.answer_template || []).map((instruction, index) => ({
              step_number: index + 1,
              instruction,
            }))}
          />
        </div>
        <div>
          <h3 className="mb-4 font-black text-slate-900">أسئلة متكررة</h3>
          <BulletList items={content.frequent_questions} tone="indigo" icon={GraduationCap} />
        </div>
      </div>
    </div>
  );
}

function CommonMistakesStep({ content = {} }) {
  const mistakes = Array.isArray(content.mistakes)
    ? content.mistakes.filter(Boolean)
    : [];

  const knownKeys = new Set([
    "title",
    "wrong_idea",
    "wrong",
    "mistake",
    "why_wrong",
    "reason",
    "correction",
    "correct",
  ]);

  return (
    <div className="space-y-5">
      {mistakes.map((mistake, index) => {
        const title = mistake?.title || `الخطأ ${index + 1}`;
        const wrong =
          mistake?.wrong_idea ||
          mistake?.wrong ||
          mistake?.mistake ||
          "";
        const reason =
          mistake?.why_wrong ||
          mistake?.reason ||
          "";
        const correct =
          mistake?.correction ||
          mistake?.correct ||
          "";

        const extra = Object.fromEntries(
          Object.entries(mistake || {}).filter(
            ([key, value]) =>
              !knownKeys.has(key) &&
              !isEmpty(value) &&
              !isTechnicalPresentationField(key),
          ),
        );

        return (
          <article
            key={mistake?.id || `mistake-${index}`}
            className="overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-sm"
          >
            <div className="border-b border-rose-100 bg-rose-50 px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2">
                <XCircle className="shrink-0 text-rose-600" size={19} />
                <MathText
                  as="h3"
                  className="text-sm font-black text-rose-950 sm:text-base"
                >
                  {title}
                </MathText>
              </div>
            </div>

            <div className="space-y-3 p-4 sm:p-5">
              {!isEmpty(wrong) && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-3.5">
                  <p className="mb-1 text-[11px] font-black text-rose-700">
                    الفكرة الخاطئة
                  </p>
                  <MathText className="text-sm font-bold text-rose-950">
                    {wrong}
                  </MathText>
                </div>
              )}

              {!isEmpty(reason) && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3.5">
                  <p className="mb-1 text-[11px] font-black text-amber-700">
                    لماذا هو خطأ؟
                  </p>
                  <MathText className="text-sm font-semibold text-amber-950">
                    {reason}
                  </MathText>
                </div>
              )}

              {!isEmpty(correct) && (
                <InfoBox title="التصحيح الصحيح" tone="emerald" icon={Check}>
                  <MathText className="text-sm font-bold">
                    {correct}
                  </MathText>
                </InfoBox>
              )}

              {Object.keys(extra).length > 0 && (
                <StructuredValue
                  value={extra}
                  fieldKey="mistake_details"
                  depth={1}
                />
              )}
            </div>
          </article>
        );
      })}

      {!isEmpty(content.takeaway) && (
        <InfoBox
          title="الخلاصة"
          tone="emerald"
          icon={CheckCircle2}
          compact={false}
        >
          <MathText className="font-black">
            {content.takeaway}
          </MathText>
        </InfoBox>
      )}
    </div>
  );
}

function normalizeQuizComparable(value) {
  return String(value ?? "")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveQuizCorrectIndex(question = {}, choices = []) {
  if (!Array.isArray(choices) || choices.length === 0) return -1;

  const rawAnswer =
    question.correct_answer ??
    question.correctAnswer ??
    question.answer ??
    question.expected_answer ??
    null;

  // الأولوية دائمًا لمطابقة نص الإجابة نفسها.
  if (rawAnswer !== null && rawAnswer !== undefined && rawAnswer !== "") {
    const normalizedAnswer = normalizeQuizComparable(rawAnswer);
    const byValue = choices.findIndex(
      (choice) => normalizeQuizComparable(choice) === normalizedAnswer,
    );

    if (byValue >= 0) return byValue;
  }

  // دعم البنى التي تخزن موضع الإجابة بدل نصها.
  const rawIndex =
    question.correct_index ??
    question.correctIndex ??
    question.answer_index ??
    question.answerIndex ??
    question.correct_choice_index ??
    null;

  if (rawIndex !== null && rawIndex !== undefined && rawIndex !== "") {
    const numericIndex = Number(rawIndex);

    if (Number.isInteger(numericIndex)) {
      // المشروع الحالي يستعمل correct_index بصيغة 0-based.
      if (numericIndex >= 0 && numericIndex < choices.length) {
        return numericIndex;
      }

      // fallback فقط للملفات القديمة التي قد تستعمل 1-based.
      if (numericIndex >= 1 && numericIndex <= choices.length) {
        return numericIndex - 1;
      }
    }
  }

  // أحيانًا يصل correct_answer نفسه كرقم index.
  if (rawAnswer !== null && rawAnswer !== undefined && rawAnswer !== "") {
    const numericAnswer = Number(rawAnswer);

    if (Number.isInteger(numericAnswer)) {
      if (numericAnswer >= 0 && numericAnswer < choices.length) {
        return numericAnswer;
      }

      if (numericAnswer >= 1 && numericAnswer <= choices.length) {
        return numericAnswer - 1;
      }
    }
  }

  return -1;
}

function quizSeedHash(value) {
  const text = String(value ?? "");
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function shuffleQuizEntries(entries, seed) {
  const result = [...entries];
  let state = seed || 1;

  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function buildQuizChoiceEntries(question = {}, questionIndex = 0, sourceKey = "") {
  const choices = Array.isArray(question.choices)
    ? question.choices
    : Array.isArray(question.options)
      ? question.options
      : [];

  if (choices.length === 0) {
    return {
      choices,
      correctOriginalIndex: -1,
      displayChoices: [],
    };
  }

  const correctOriginalIndex = resolveQuizCorrectIndex(question, choices);
  const entries = choices.map((value, originalIndex) => ({
    value,
    originalIndex,
    isCorrect: originalIndex === correctOriginalIndex,
  }));

  // إذا لم نستطع تحديد الإجابة الصحيحة، نحافظ على الترتيب الأصلي بدل التخمين.
  if (correctOriginalIndex < 0) {
    return {
      choices,
      correctOriginalIndex,
      displayChoices: entries,
    };
  }

  const correctEntry = entries[correctOriginalIndex];
  const distractors = entries.filter(
    (entry) => entry.originalIndex !== correctOriginalIndex,
  );

  const seed = quizSeedHash(
    `${sourceKey}|${question?.id ?? ""}|${question?.question ?? question?.prompt ?? ""}|${questionIndex}`,
  );

  const shuffledDistractors = shuffleQuizEntries(distractors, seed);

  // نغيّر موضع الإجابة الصحيحة من سؤال لآخر بدل بقائها دائمًا في الموضع نفسه.
  const targetIndex = (seed + questionIndex) % choices.length;
  const displayChoices = [...shuffledDistractors];
  displayChoices.splice(targetIndex, 0, correctEntry);

  return {
    choices,
    correctOriginalIndex,
    displayChoices,
  };
}

function MiniQuizStep({ content }) {
  const [answers, setAnswers] = useState({});
  const [showHint, setShowHint] = useState({});

  const questions = Array.isArray(content?.questions)
    ? content.questions
    : [];

  const quizHandledKeys = new Set([
    "id",
    "title",
    "instruction",
    "questions",
    "mastery_threshold",
    "success_message",
    "review_message",
  ]);

  const extraQuizContent = Object.fromEntries(
    Object.entries(content || {}).filter(
      ([key, value]) =>
        !quizHandledKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  const preparedQuestions = useMemo(
    () =>
      questions.map((question, questionIndex) => ({
        question,
        questionIndex,
        ...buildQuizChoiceEntries(
          question,
          questionIndex,
          content?.id || content?.title || "mini-quiz",
        ),
      })),
    [questions, content?.id, content?.title],
  );

  const answeredCount = preparedQuestions.filter(({ question, questionIndex }) => {
    const key = question?.id ?? questionIndex;
    return answers[key] !== undefined;
  }).length;

  const correctCount = preparedQuestions.reduce(
    (total, { question, questionIndex, correctOriginalIndex }) => {
      const key = question?.id ?? questionIndex;
      const selectedOriginalIndex = answers[key];

      return (
        total +
        (selectedOriginalIndex !== undefined &&
        correctOriginalIndex >= 0 &&
        selectedOriginalIndex === correctOriginalIndex
          ? 1
          : 0)
      );
    },
    0,
  );

  const masteryThreshold =
    Number(content?.mastery_threshold) ||
    Math.max(1, Math.ceil(preparedQuestions.length * 0.75));

  const optionLabels = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];

  return (
    <div className="space-y-5 sm:space-y-6">
      {content?.instruction && (
        <InfoBox tone="indigo" title="تعليمة الاختبار" icon={ListChecks}>
          <MathText className="font-semibold">{content.instruction}</MathText>
        </InfoBox>
      )}

      {preparedQuestions.map(
        ({
          question,
          questionIndex,
          correctOriginalIndex,
          displayChoices,
        }) => {
          const answerKey = question?.id ?? questionIndex;
          const selectedOriginalIndex = answers[answerKey];
          const answered = selectedOriginalIndex !== undefined;
          const correct =
            answered &&
            correctOriginalIndex >= 0 &&
            selectedOriginalIndex === correctOriginalIndex;

          return (
            <div
              key={answerKey}
              className="rounded-3xl border border-fuchsia-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-600 font-black text-white">
                  {questionIndex + 1}
                </span>

                <MathText className="font-black text-slate-950">
                  {question.question || question.prompt}
                </MathText>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayChoices.map((choiceEntry, displayIndex) => {
                  const isSelected =
                    selectedOriginalIndex === choiceEntry.originalIndex;
                  const isCorrectChoice =
                    correctOriginalIndex >= 0 &&
                    choiceEntry.originalIndex === correctOriginalIndex;

                  return (
                    <button
                      key={`${choiceEntry.originalIndex}-${displayIndex}`}
                      type="button"
                      disabled={answered}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [answerKey]: choiceEntry.originalIndex,
                        }))
                      }
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-4 py-3 text-right font-bold transition",
                        !answered &&
                          "border-slate-200 bg-slate-50 hover:-translate-y-0.5 hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:shadow-sm",
                        answered &&
                          isCorrectChoice &&
                          "border-emerald-300 bg-emerald-50 text-emerald-950",
                        answered &&
                          isSelected &&
                          !isCorrectChoice &&
                          "border-rose-300 bg-rose-50 text-rose-950",
                        answered &&
                          !isSelected &&
                          !isCorrectChoice &&
                          "border-slate-200 bg-slate-50 text-slate-400",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-black",
                          answered && isCorrectChoice
                            ? "border-emerald-300 bg-emerald-600 text-white"
                            : answered && isSelected && !isCorrectChoice
                              ? "border-rose-300 bg-rose-600 text-white"
                              : "border-slate-200 bg-white text-slate-600",
                        )}
                      >
                        {answered && isCorrectChoice ? (
                          <Check size={16} />
                        ) : answered && isSelected && !isCorrectChoice ? (
                          <XCircle size={16} />
                        ) : (
                          optionLabels[displayIndex] || displayIndex + 1
                        )}
                      </span>

                      <MathText as="span" className="min-w-0 flex-1">
                        {choiceEntry.value}
                      </MathText>
                    </button>
                  );
                })}
              </div>

              {correctOriginalIndex < 0 && (
                <div className="mt-4">
                  <InfoBox tone="amber" title="تنبيه في بيانات السؤال" icon={AlertTriangle}>
                    <MathText className="font-semibold">
                      تعذر تحديد الإجابة الصحيحة لهذا السؤال. تحقق من correct_answer أو correct_index.
                    </MathText>
                  </InfoBox>
                </div>
              )}

              {!answered && question.hint && (
                <button
                  type="button"
                  onClick={() =>
                    setShowHint((current) => ({
                      ...current,
                      [answerKey]: !current[answerKey],
                    }))
                  }
                  className="mt-4 text-sm font-black text-amber-700"
                >
                  {showHint[answerKey]
                    ? "إخفاء التلميح"
                    : "أحتاج تلميحًا"}
                </button>
              )}

              {showHint[answerKey] && !answered && (
                <div className="mt-3">
                  <InfoBox tone="amber" title="تلميح">
                    <MathText>{question.hint}</MathText>
                  </InfoBox>
                </div>
              )}

              {answered && (
                <div className="mt-4">
                  <InfoBox
                    tone={correct ? "emerald" : "rose"}
                    title={
                      correct
                        ? "إجابة صحيحة، أحسنت"
                        : "الإجابة غير صحيحة"
                    }
                    icon={correct ? CheckCircle2 : XCircle}
                  >
                    <MathText className="font-semibold">
                      {question.explanation ||
                        (correct
                          ? "إجابة صحيحة."
                          : "راجع الفكرة ثم حاول من جديد.")}
                    </MathText>
                  </InfoBox>

                  {!correct && (
                    <button
                      type="button"
                      onClick={() =>
                        setAnswers((current) => {
                          const next = { ...current };
                          delete next[answerKey];
                          return next;
                        })
                      }
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-fuchsia-700"
                    >
                      <RefreshCw size={15} />
                      أعد المحاولة
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        },
      )}

      {preparedQuestions.length > 0 && (
        <div className="rounded-[28px] border border-indigo-200 bg-gradient-to-l from-indigo-50 to-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-slate-950">
                النتيجة الحالية
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                أجبت عن {answeredCount} من {preparedQuestions.length} أسئلة.
              </p>
            </div>

            <span className="rounded-2xl bg-indigo-600 px-5 py-3 text-lg font-black text-white">
              {correctCount} / {preparedQuestions.length}
            </span>
          </div>

          {answeredCount === preparedQuestions.length && (
            <div className="mt-4">
              <InfoBox
                tone={
                  correctCount >= masteryThreshold
                    ? "emerald"
                    : "amber"
                }
                title={
                  correctCount >= masteryThreshold
                    ? "أحسنت، وصلت إلى مستوى الإتقان"
                    : "تحتاج إلى مراجعة سريعة"
                }
                icon={
                  correctCount >= masteryThreshold
                    ? Trophy
                    : RefreshCw
                }
              >
                <MathText className="font-semibold">
                  {correctCount >= masteryThreshold
                    ? content?.success_message ||
                      "نتيجتك جيدة ويمكنك الانتقال إلى المرحلة التالية."
                    : content?.review_message ||
                      "راجع الأسئلة التي أخطأت فيها ثم أعد المحاولة."}
                </MathText>
              </InfoBox>
            </div>
          )}
        </div>
      )}

      {Object.keys(extraQuizContent).length > 0 && (
        <section className="rounded-[26px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <ListChecks size={17} className="text-indigo-600" />
            <h3 className="font-black text-slate-950">معلومات الاختبار</h3>
          </div>
          <GenericObjectStep content={extraQuizContent} />
        </section>
      )}
    </div>
  );
}

function SummaryStep({ content = {} }) {
  const keyIdeas =
    content.remember ||
    content.key_ideas ||
    content.summary_points ||
    [];

  const methodItems =
    content.method_template ||
    content.method ||
    content.decision_steps ||
    [];

  const normalizedMethodItems = Array.isArray(methodItems)
    ? methodItems
    : methodItems
      ? [methodItems]
      : [];

  const extraSummaryEntries = Object.entries(content).filter(
    ([key, value]) =>
      ![
        "remember",
        "key_ideas",
        "summary_points",
        "method_template",
        "method",
        "decision_steps",
        "memory_tip",
        "takeaway",
        "final_sentence",
        "final_message",
        "key_sentence",
      ].includes(key) &&
      !isEmpty(value) &&
      !isTechnicalPresentationField(key),
  );

  const finalMessage =
    content.final_sentence ||
    content.final_message ||
    content.key_sentence ||
    "";

  return (
    <div className="space-y-6">
      {Array.isArray(keyIdeas) && keyIdeas.length > 0 && (
        <BulletList
          items={keyIdeas}
          tone="emerald"
          icon={CheckCircle2}
        />
      )}

      {normalizedMethodItems.length > 0 && (
        <div className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#0f172a_0%,#1e1b4b_55%,#312e81_100%)] p-6 text-white shadow-xl shadow-indigo-950/15">
          <div className="mb-4 flex items-center gap-2 font-black text-amber-300">
            <Trophy size={20} />
            المنهجية المختصرة
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {normalizedMethodItems.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-2xl bg-white/10 p-4"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white font-black text-slate-950">
                  {index + 1}
                </span>
                <MathText className="text-sm font-bold text-white">
                  {getDisplayText(item)}
                </MathText>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isEmpty(content.memory_tip) && (
        <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb}>
          <MathText className="font-black">
            {content.memory_tip}
          </MathText>
        </InfoBox>
      )}

      {!isEmpty(content.takeaway) &&
        normalizeComparableText(content.takeaway) !==
          normalizeComparableText(content.memory_tip) && (
          <InfoBox
            title="الخلاصة النهائية"
            tone="emerald"
            icon={CheckCircle2}
          >
            <MathText className="font-black">
              {content.takeaway}
            </MathText>
          </InfoBox>
        )}

      {!isEmpty(finalMessage) &&
        ![
          normalizeComparableText(content.memory_tip),
          normalizeComparableText(content.takeaway),
        ].includes(normalizeComparableText(finalMessage)) && (
          <InfoBox title="رسالة أخيرة" tone="indigo" icon={Sparkles}>
            <MathText className="font-black">
              {finalMessage}
            </MathText>
          </InfoBox>
        )}

      {extraSummaryEntries.length > 0 && (
        <StructuredValue
          value={Object.fromEntries(extraSummaryEntries)}
          fieldKey="summary_details"
          depth={1}
        />
      )}
    </div>
  );
}

/* =========================================================
   Structured JSON + graphs
========================================================= */

const FIELD_LABELS = {
  law_guides: "شرح القوانين والرموز",
  law_guide: "شرح القانون والرموز",
  why: "لماذا نحتاجه؟",
  symbols: "معنى الرموز",
  law: "القانون",
  how_to_use: "كيف أستعمله؟",
  simple_example: "مثال بسيط",
  warning: "انتبه",
  teacher: "شرح ",
  example: "مثال",
  examples: "أمثلة",
  goal: "الهدف",
  why: "لماذا نتعلم هذه الفكرة؟",
  how_to_think: "كيف أفكر؟",
  attention: "انتبه",
  quick_check: "تحقق سريع",
  bac_relevance: "علاقتها بالبكالوريا",
  bac_connection: "صلة الفكرة بالبكالوريا",
  statement: "نص المثال",
  required: "المطلوب",
  strategy: "الاستراتيجية",
  conclusion: "الاستنتاج",
  final_conclusion: "النتيجة النهائية",
  bac_writing: "صياغة البكالوريا",
  method_goal: "هدف الطريقة",
  when_to_use: "متى نستعملها؟",
  central_idea: "الفكرة الأساسية",
  teacher_tip: "نصيحة الأستاذ",
  warning: "تنبيه مهم",
  important_warning: "تنبيه مهم",
  strict_note: "ملاحظة حول التغير التام",
  meaning: "المعنى",
  why_useful: "لماذا هي مفيدة؟",
  formula: "الصيغة",
  relation: "العلاقة",
  relations: "العلاقات الأساسية",
  conservation: "مبدأ الانحفاظ",
  measured_quantity: "الكمية المقاسة",
  mother_solution: "المحلول الأم",
  daughter_solution: "المحلول البنت",
  rate: "علاقة السرعة",
  measurement: "طريقة القياس",
  question: "السؤال",
  expected_answer: "الإجابة المتوقعة",
  answer: "الإجابة",
  hint: "تلميح",
  explanation: "الشرح",
  exercise: "التمرين",
  objective: "المهارة المستهدفة",
  final_answer: "الجواب النهائي",
  interpretation: "الاستنتاج من الرسم",
  memory_tip: "حيلة للحفظ",
  final_sentence: "الجملة الختامية",
  case: "الحالة",
  condition: "الشرط",
  result: "النتيجة",
  definitions: "التعريفات",
  monotone_definition: "تعريف المتتالية الرتيبة",
  symbols: "الرموز",
  conditions: "الشروط",
  algorithm: "خطوات الطريقة",
  given: "المعطيات",
  given_data: "المعطيات",
  steps: "خطوات الحل",
  observations: "الملاحظات",
  construction_steps: "خطوات الإنشاء",
  important_results: "نتائج مهمة",
  frequent_questions: "أسئلة متكررة",
  expected_writing: "الكتابة المنتظرة",
  method_selection: "اختيار الطريقة",
  decision_guide: "دليل اختيار الطريقة",
  mistakes: "الأخطاء الشائعة",
  questions: "الأسئلة",
  guided_prompts: "أسئلة موجهة",
  hint_levels: "التلميحات",
  solution_steps: "خطوات الحل",
  solution: "الحل",
  success_criteria: "معايير النجاح",
  remember: "ما يجب حفظه",
  method_template: "قالب الطريقة",
  formulas: "الصيغ الأساسية",
  graph_data: "التمثيل البياني",
  function_graph: "منحنى الدالة",
  graphical_representation: "التمثيل البياني",
  interactive_graph: "الرسم التفاعلي",
  coordinate_system: "إعدادات المعلم",
  special_points: "النقاط المميزة",
  parameter_lines: "مستقيمات الوسيط",
  graph_instructions: "تعليمات قراءة الرسم",
  variation_table: "جدول التغيرات",
  table_of_variations: "جدول التغيرات",
  variations_table: "جدول التغيرات",
  sign_table: "جدول الإشارة",
  derivative_sign_table: "جدول إشارة المشتقة",
  discussion_table: "جدول المناقشة",
  monotonicity_table: "جدول اتجاه التغير",
  action: "ماذا أفعل؟",
  problem: "المشكلة",
  if_student_does_not_understand: "ماذا أفعل عندما لا أفهم؟",
  mastery_rule: "علامة الإتقان",
  next_step: "الخطوة التالية",
  induction_element: "عنصر الاستدلال بالتراجع",
  mathematical_meaning: "المعنى الرياضي",
  index: "الدليل",
  term: "الحد",
  notation: "الترميز",
  points: "النقاط",
  mark: "العلامة",
  score: "التنقيط",
  rule: "القاعدة",
  rules: "القواعد",
  reading: "طريقة القراءة",
  plain_language: "المعنى المبسط",
  definition: "التعريف",
  vocabulary: "المفردات",
  method: "المنهجية",
  table: "الجدول",
  visualization: "الرسم التفاعلي",
  graph: "الرسم البياني",
  series: "السلاسل البيانية",
  axes: "إعدادات المحاور",
  settings: "إعدادات الرسم",
  function: "الدالة",
  derivative: "المشتقة",
  domain: "المجال",
  domain_segments: "أجزاء المجال",
  special_points: "النقاط المميزة",
  intersection_points: "نقاط التقاطع",
  asymptotes: "المستقيمات المقاربة",
  cases: "الحالات",
  flow: "تسلسل الحل",
  tree: "شجرة القرار",
  checklist: "قائمة المراجعة",
  guidelines: "إرشادات",
  items: "العناصر",
  issue: "المشكلة",
  recommendation: "الاقتراح",
  source_note: "ملاحظة المصدر",
  estimated_minutes: "المدة المتوقعة",
  difficulty: "المستوى",
  content_status: "حالة المحتوى",
  schema_version: "نسخة البنية",
  lesson_profile: "نمط الدرس",
  profile_reason: "سبب اختيار النمط",
  recommended_ui_blocks: "مكوّنات الواجهة المقترحة",
  start_question: "سؤال البداية",
  branches: "فروع القرار",
  golden_rule: "القاعدة الذهبية",
  final_message: "الرسالة الختامية",
  essential_reflex: "الرد الفعلي الأساسي",
  ready_for_next_lesson: "الجاهزية للدرس التالي",
  important_corrections: "تصحيحات مهمة",
  mathematical_accuracy_checked: "تم التحقق الرياضي",
  pedagogical_progression_checked: "تم التحقق من التدرج",
  latex_consistency_checked: "تم التحقق من LaTeX",
  json_validity_checked: "تم التحقق من JSON",
  empty_text_values_removed: "تم حذف القيم الفارغة",
  headers: "عناوين الجدول",
  rows: "بيانات الجدول",
  caption: "ملاحظة الجدول",
  comparison_table: "جدول المقارنة",
  table: "جدول",
  equivalent_forms: "صيغ مكافئة",
  rules: "القواعد",
  special_case: "حالة خاصة",
  general_rule: "القاعدة العامة",
  alternative_factorization: "تحويل بديل",
  comparison_table: "جدول المقارنة",
  decision_tree: "خطة اتخاذ القرار",
  condition: "الشرط",
  action: "الإجراء",
  derivation: "الاشتقاق خطوة بخطوة",
  worked_example: "مثال محلول",
  final_conclusion: "الخلاصة النهائية",
  final_answer: "الجواب النهائي",
  success_criteria: "معايير النجاح",
  expected_answer: "الإجابة المنتظرة",
  skill: "المهارة",
  method_goal: "هدف الطريقة",
  comparison_table: "جدول المقارنة",
  lesson_map: "خريطة الدرس",

  // حقول الدروس الجديدة
  central_idea: "الفكرة الأساسية",
  simple_diagram: "مخطط مبسط",
  example: "مثال",
  teacher: "شرح الأستاذ",
  memory_tip: "حيلة للحفظ",
  takeaway: "الخلاصة",
  pre_question: "سؤال تمهيدي",
  quick_check: "تحقق سريع",
  welcome: "مقدمة المحور",
  big_idea: "الفكرة الأساسية",
  student_promise: "ما الذي ستتعلمه؟",
  comparison: "مقارنة",
  situation: "الحالة",
  classification: "التصنيف",
  categories: "تصنيف التحولات",
  name: "نوع التحول",
  duration: "المدة",
  observation: "الملاحظة",
  measurable_quantities: "الكميات القابلة للمتابعة",
  quantity: "الكمية الفيزيائية",
  use_when: "متى نستعملها؟",
  recognition_signs: "علامات التعرّف",
  answer_template: "صياغة الإجابة",
  decision_rules: "قواعد الاختيار",
  choice: "الاختيار المناسب",
  comparison_rule: "قاعدة المقارنة",
  description: "الوصف",
  alt_text: "وصف الرسم",
  horizontal_guides: "المستويات المرجعية",
  label: "التسمية",
  known: "المعلوم",
  unknown: "المجهول",
  concept: "المفهوم",
  input: "المدخل",
  output: "الناتج",
  role: "الدور",
  action: "الإجراء",
  property: "الخاصية",
  goal: "الهدف",
  prompt: "السؤال",
  choices: "الاختيارات",
  correct_index: "رقم الإجابة الصحيحة",
  passing_score: "علامة النجاح",
  success_message: "رسالة النجاح",
  review_message: "رسالة المراجعة",
  graph_ref: "مرجع الرسم",
  graph_id: "معرّف الرسم",
  law: "القانون",
  meaning: "المعنى",
  finite_limit: "النهاية المنتهية",
  infinite_limit: "النهاية غير المنتهية",
  formulas: "الصيغ",
  symbols: "معاني الرموز",
  why: "لماذا نحتاجه؟",
  how_to_use: "طريقة الاستعمال",
  simple_example: "مثال بسيط",
  warning: "تنبيه",
  student_promise: "ماذا ستتعلم؟",
  big_idea: "الفكرة الأساسية",
  welcome: "مقدمة الدرس",
  teacher: "شرح الأستاذ",
  central_idea: "الفكرة الأساسية",
  memory_tip: "حيلة للحفظ",
  takeaway: "الخلاصة",
  example: "مثال",
  examples: "أمثلة",
  definition: "التعريف",
  rule: "القاعدة",
  formula: "الصيغة",
  equation: "المعادلة",
  expression: "العبارة",
  result: "النتيجة",
  conclusion: "الاستنتاج",
  attention: "انتبه",
  x: "قيمة \\(x\\)",
  x_cubed: "قيمة \\(x^3\\)",
  two_x: "قيمة \\(2x\\)",
  constant: "الحد الثابت",
  f_x: "قيمة \\(f(x)\\)",

  // ===== حقول محاور الكيمياء الجديدة =====
  general_reaction: "المعادلة العامة",
  reaction: "معادلة التفاعل",
  interpretation: "التفسير",
  interpretations: "التفسيرات",
  pairs: "الثنائيات حمض/أساس",
  ways_to_find: "طرق إيجاد القيمة",
  relation_example: "مثال على العلاقة",
  species_present: "الأنواع الموجودة في الحالة النهائية",
  key_points: "النقاط الأساسية",
  include: "الأنواع التي تدخل في العبارة",
  exclude: "الأنواع التي لا تدخل في العبارة",
  determined_example: "مثال تطبيقي",
  determined_examples: "أمثلة تطبيقية",
  starting_relation: "العلاقة التي ننطلق منها",
  final_relation: "العلاقة النهائية",
  consequences: "النتائج",
  evolution: "التطور",
  answer_templates: "صياغات جاهزة للإجابة",
  vocabulary: "مصطلحات مهمة",
  term: "المصطلح",
  description: "الشرح",
  classification: "التصنيف",
  dominant_species: "النوع الغالب",
  deduction: "الاستنتاج",
  regions: "مناطق المنحنى",
  indicators: "الكواشف الملونة",
  range: "مجال التغير",
  principle: "المبدأ",
  general_result: "العلاقة النهائية للحساب",
  methods: "الطرق",
  reaction_type: "نوع التفاعل",
  species: "الأنواع الكيميائية",
  acid: "الحمض",
  base: "الأساس",
  pair: "الثنائية",
  acid_form: "الصيغة الحمضية",
  base_form: "الصيغة الأساسية",
  concentration: "التركيز",
  initial_state: "الحالة الابتدائية",
  final_state: "الحالة النهائية",
  equilibrium_state: "حالة التوازن",
  equivalence: "التكافؤ",
  half_equivalence: "نصف التكافؤ",
  method_name: "اسم الطريقة",
  name: "الاسم",
  calculation: "الحساب",

  // ===== حقول محاور الأعداد المركبة الجديدة =====
  z: "العدد المركب",
  real: "الجزء الحقيقي",
  imaginary: "الجزء التخيلي",
  quadrants: "الأرباع",
  item: "العنصر",
  title: "العنوان",
  pattern: "النمط",
  correct_answer: "الإجابة الصحيحة",
  learning_outcomes: "نواتج التعلم",
  prerequisites: "المتطلبات السابقة",
  lesson_goal: "هدف الدرس",
  relation: "العلاقة",
  relations: "العلاقات",
  properties: "الخواص",
  cycle_rule: "دورية القوى",
  method: "الطريقة",
  algorithm: "خطوات الحل",
  steps: "الخطوات",
  checks: "التحقق",
  categories: "الحالات",
  definitions: "التعاريف",
  notation: "الترميز",
  equivalence: "التكافؤ",
  general_formula: "الصيغة العامة",
  boundary_note: "ملاحظة حول حدود المحور",
  patterns: "حالات نموذجية",
  items: "تطبيقات",
  consequences: "النتائج الهندسية",
  classification: "التصنيف",
  condition: "الشرط",
  interpretation: "التفسير",
  transformation: "التحويل",
  quadrant: "الربع",
  signs: "الإشارات",
  angle_form: "صيغة الزاوية",
  role: "الدور",
  difference: "ما يميزه",
  rule: "القاعدة",
  center: "المركز",
  ratio: "النسبة",
  angle: "الزاوية",
  transformation_type: "نوع التحويل",
  boundary_note: "تنبيه منهجي",

  // ===== حقول الهندسة في الفضاء =====
  mini_example: "مثال تطبيقي",
  quick_example: "مثال سريع",
  experiment: "التجربة",
  outcomes: "النتائج الممكنة",
  universe: "المجموعة الشاملة",
  event_text: "الحادثة",
  event: "الحادثة",
  certain: "الحادثة الأكيدة",
  impossible: "الحادثة المستحيلة",
  intersection: "التقاطع",
  union: "الاتحاد",
  matching_outcomes: "النتائج الموافقة",
  matching_values: "القيم الموافقة",
  probability: "الاحتمال",
  favorable: "الحالات الملائمة",
  possible: "الحالات الممكنة",
  idea: "الفكرة",
  entry_fee: "ثمن المشاركة",
  prize: "الجائزة",
  net_win: "الربح الصافي",
  net_loss: "الخسارة الصافية",
  probability_law: "قانون احتمال المتغير العشوائي",
  x: "قيمة X",
  p: "الاحتمال",
  order_matters: "هل الترتيب مهم؟",
  repetition: "هل التكرار ممكن؟",
  model: "نموذج العد",
  count: "عدد الحالات",
  sampling: "نوع السحب",
  phrase: "العبارة",
  translation: "الترجمة الرياضية",
  known_event: "الحادثة المعلومة",
  target_event: "الحادثة المطلوبة",
  position: "الموضع",
  weight: "الوزن",
  effect: "الأثر",
  focus: "ما الذي نركز عليه؟",
  operation: "العملية",
  mapping: "الربط",
  tool_choice: "الأداة المناسبة",
  sign_rule: "قاعدة الإشارة",
  diagnosis: "تشخيص الوضعية",
  decision: "القرار",
  situations: "وضعيات للتصنيف",
  branch_scope: "حسب الشعبة",
  axis_limits: "حدود المحور",
  central_skill: "المهارة المركزية",
  central_question: "السؤال المركزي",
  decision_table: "خريطة اختيار نموذج العد",
  sampling_map: "ربط نوع السحب بنموذج العد",
  translation_patterns: "أنماط الترجمة",
  translation_table: "جدول الترجمة",
  effects: "الآثار",
  equivalent_when_nonzero: "صيغة مكافئة عند عدم الانعدام",
  exactly_one: "بالضبط واحد",
  at_least_one: "على الأقل واحد",
  at_most_one: "على الأكثر واحد",
  reason: "السبب",
  correct: "الصحيح",
  wrong: "الخاطئ",
  mastery_criterion: "معيار الإتقان",
  assessment_method: "طريقة التقييم",
  axis_role: "دور المحور",
  prerequisites_by_branch: "المتطلبات حسب الشعبة",
  enrichment_not_required_for_mastery: "إثراء غير مطلوب للإتقان",
  A: "الحادثة A",
  B: "الحادثة B",
  worked_check: "تحقق محلول",
  central_relation: "العلاقة الأساسية",
  criterion: "المعيار",
  why_non_parallel: "لماذا يجب ألا يكونا متوازيين؟",
  equivalent_form: "صيغة مكافئة",
  equivalent_condition: "شرط مكافئ",
  shortcut_note: "ملاحظة مختصرة",
  example_rule: "قاعدة المثال",
  important: "معلومة مهمة",
  important_note: "ملاحظة مهمة",
  key_rule: "القاعدة الأساسية",
  setup: "الإعداد",
  tangency_condition: "شرط التماس",
  consequence: "النتيجة المباشرة",
  geometric_meaning: "المعنى الهندسي",
  general_form: "الشكل العام",
  example_form: "صيغة المثال",
  chain: "سلسلة الحل",
  scenario: "سيناريو التطبيق",
  mastery_threshold: "عتبة الإتقان",
  learning_path: "مسار التعلم",
  features: "الخصائص",
  connection: "الربط",

  // ===== حقول الكيمياء الحركية والمتابعة الزمنية =====
  lesson_summary: "ملخص الدرس",
  lesson_intro: "مقدمة الدرس",
  math_format: "صيغة الرياضيات",
  prerequisites_title: "عنوان المكتسبات القبلية",
  simple_model: "النموذج المبسط",
  simple_diagram: "مخطط مبسط",
  roles: "الأدوار",
  action: "الفعل",
  electron_action: "التعامل مع الإلكترونات",
  undergoes: "العملية التي يخضع لها",
  simple_word: "الكلمة المفتاحية",
  general_half_equation: "الصيغة العامة لنصف المعادلة",
  how_to_identify: "كيف أتعرف عليها؟",
  general_equation: "المعادلة العامة",
  states: "حالات التقدم",
  state: "الحالة",
  value: "القيمة",
  conservation: "قانون الانحفاظ",
  progress_table: "جدول التقدم",
  xmax_definition: "تعريف التقدم الأعظمي",
  limiting_reactant_rule: "قاعدة المتفاعل المحد",
  excess_reactant_formula: "علاقة المتفاعل الفائض",
  non_negative_conditions: "شروط عدم السلبية",
  complete_or_not: "هل التحول تام؟",
  initial_value: "القيمة الابتدائية",
  final_value: "القيمة النهائية",
  general_relation: "العلاقة العامة",
  derived_formulas: "العلاقات المستنتجة",
  dilution_factor: "عامل التمديد",
  equipment: "الزجاجيات والأدوات",
  equipment_rules: "قواعد اختيار الأدوات",
  protocol: "البروتوكول التجريبي",
  titration_protocol: "بروتوكول المعايرة",
  safety: "قواعد السلامة",
  precision_rule: "قاعدة الدقة",
  precision_errors: "أخطاء الدقة",
  question_types: "أنواع الأسئلة",
  recognition: "كيف أتعرف على السؤال؟",
  measured_quantity: "الكمية المقاسة",
  measurable_quantities: "الكميات القابلة للقياس",
  decision_rules: "قواعد الاختيار",
  pressure: "الضغط",
  conductivity: "الناقلية",
  gas: "الغاز",
  gas_method: "المتابعة بحجم الغاز",
  mass_method: "المتابعة بالكتلة",
  pressure_graph: "منحنى الضغط",
  conductivity_graph: "منحنى الناقلية",
  mass_graph: "منحنى الكتلة",
  graphs: "الرسوم البيانية",
  gas_cases: "حالات متابعة الغاز",
  measurement_cases: "حالات القياس",
  pressure_and_conductivity: "الضغط والناقلية",
  pressure_attention: "تنبيه حول الضغط",
  concentration_example: "مثال على التركيز",
  pressure_example: "مثال على الضغط",
  reactant_example: "مثال لمتفاعل",
  product_example: "مثال لناتج",
  product_relation: "علاقة الناتج",
  reactant_graph_method: "طريقة استثمار منحنى المتفاعل",
  trend_cases: "حالات اتجاه التغير",
  trend: "اتجاه التغير",
  reading: "القراءة",
  reading_steps: "خطوات القراءة",
  graph_reading: "قراءة الرسم",
  end_method: "طريقة تحديد النهاية",
  half_time_method: "طريقة تحديد زمن النصف",
  half_time_relations: "علاقات زمن نصف التفاعل",
  speed_algorithm: "منهجية حساب السرعة",
  speed_relation: "علاقة السرعة",
  average_method: "طريقة السرعة المتوسطة",
  unit_attention: "تنبيه حول الوحدات",
  factors: "العوامل الحركية",
  factor: "العامل",
  stirring_role: "دور التحريك",
  kinetic_factors: "العوامل الحركية",
  comparison_rule: "قاعدة المقارنة",
  comparison_rules: "قواعد المقارنة",
  question_families: "عائلات الأسئلة",
  answer_template: "نموذج الإجابة",
  answer_templates: "نماذج الإجابة",
  complete_example: "مثال كامل",
  instant_example: "مثال مباشر",
  derivation_steps: "خطوات الاشتقاق",
  wrong_example: "مثال خاطئ",
  checklist: "قائمة التحقق",
  scoring: "سلم التنقيط",
  total: "المجموع",
  passing_score: "علامة النجاح",
  levels: "مستويات الأداء",
  score: "العلامة",
  level: "المستوى",
  message: "الرسالة",
  instructions: "التعليمات",
  instruction: "التعليمة",
  review_message: "رسالة المراجعة",
  success_message: "رسالة النجاح",
  formulas_title: "عنوان العلاقات",
  general_rule: "القاعدة العامة",
  important_rule: "قاعدة مهمة",
  sign_rules: "قواعد الإشارة",
  sign_rule: "قاعدة الإشارة",
  equivalence_relation: "علاقة التكافؤ",
  concentration: "التركيز",
  concentration_example: "مثال على التركيز",
  formula: "العلاقة",
  units: "الوحدات",
  reading_steps: "خطوات القراءة",
  method_template: "الخطة المنهجية",
  mastery_threshold: "عتبة الإتقان",
};


function fieldLabel(key) {
  const normalizedKey = normalizeFieldKey(key);

  if (FIELD_LABELS[normalizedKey]) {
    return FIELD_LABELS[normalizedKey];
  }

  const readable = String(key || "")
    .replace(/[_-]+/g, " ")
    .trim();

  if (!readable) return "تفصيل";

  /*
   * لا نخفي الحقل غير المعروف.
   * إذا لم نملك ترجمة عربية بعد، نعطيه عنوانًا عامًا بدل إسقاطه من الواجهة.
   * محتوى الحقل نفسه يبقى ظاهرًا كاملًا بواسطة StructuredValue.
   */
  if (/^[A-Za-z0-9 ]+$/.test(readable)) {
    return "تفاصيل إضافية";
  }

  return readable;
}


function asFiniteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizePoint(point, index = 0) {
  if (point === null || point === undefined) return null;

  if (Array.isArray(point) && point.length >= 2) {
    const x = asFiniteNumber(point[0]);
    const y = asFiniteNumber(point[1]);
    return x === null || y === null ? null : { x, y };
  }

  if (typeof point !== "object") return null;

  const x = asFiniteNumber(
    point.x ?? point.n ?? point.index ?? point.input ?? index,
  );
  const y = asFiniteNumber(
    point.y ??
      point.value ??
      point.u_n ??
      point.un ??
      point.f_x ??
      point.fx ??
      point.output,
  );

  if (x === null || y === null) return null;

  return {
    ...point,
    x,
    y,
    label:
      point.label ??
      point.name ??
      point.point_label ??
      point.annotation ??
      null,
  };
}

function normalizeGraph(graph) {
  if (!graph || typeof graph !== "object") return null;

  const coordinateSystem =
    graph.coordinate_system ||
    graph.coordinateSystem ||
    graph.settings?.coordinate_system ||
    {};

  const normalizedSeries = [];

  const pushSeries = (serie, fallback = {}) => {
    if (!serie || typeof serie !== "object") return;

    let rawData =
      serie.data ||
      serie.points ||
      serie.values ||
      serie.coordinates ||
      [];

    if (
      (!Array.isArray(rawData) || rawData.length === 0) &&
      Number.isFinite(Number(serie.y))
    ) {
      const xMin =
        asFiniteNumber(
          coordinateSystem.x_min ??
            graph.x_min ??
            graph.x_domain?.[0],
          -10,
        );
      const xMax =
        asFiniteNumber(
          coordinateSystem.x_max ??
            graph.x_max ??
            graph.x_domain?.[1],
          10,
        );

      rawData = [
        { x: xMin, y: Number(serie.y) },
        { x: xMax, y: Number(serie.y) },
      ];
    }

    const points = Array.isArray(rawData)
      ? rawData.map(normalizePoint).filter(Boolean)
      : [];

    if (points.length === 0) return;

    normalizedSeries.push({
      ...fallback,
      ...serie,
      id:
        serie.id ||
        fallback.id ||
        `series-${normalizedSeries.length + 1}`,
      label:
        serie.label ||
        serie.name ||
        fallback.label ||
        `المنحنى ${normalizedSeries.length + 1}`,
      type:
        serie.type ||
        fallback.type ||
        (points.length > 1 ? "curve" : "points"),
      data: points,
    });
  };

  if (Array.isArray(graph.series)) {
    const seriesLooksLikePointList =
      graph.series.length > 0 &&
      graph.series.every(
        (point) =>
          point &&
          typeof point === "object" &&
          !Array.isArray(point) &&
          (
            point.x !== undefined ||
            point.t !== undefined ||
            point.n !== undefined ||
            point.index !== undefined
          ) &&
          (
            point.y !== undefined ||
            point.value !== undefined ||
            point.u_n !== undefined ||
            point.un !== undefined
          ),
      );

    if (seriesLooksLikePointList) {
      pushSeries({
        id: graph.id || "main-series",
        label: graph.label || graph.title || "المنحنى",
        type: graph.kind || graph.type || "curve",
        data: graph.series,
      });
    } else {
      graph.series.forEach((serie) => pushSeries(serie));
    }
  }

  if (graph.function) {
    pushSeries(graph.function, {
      id: "main-function",
      label:
        graph.function.label ||
        graph.function.expression ||
        "منحنى الدالة",
      type: graph.function.type || "curve",
    });
  }

  if (graph.curve) {
    pushSeries(graph.curve, {
      id: "main-curve",
      label: graph.curve.label || "المنحنى",
      type: graph.curve.type || "curve",
    });
  }

  if (Array.isArray(graph.parameter_lines)) {
    graph.parameter_lines.forEach((line, index) =>
      pushSeries(line, {
        id: line?.id || `parameter-line-${index + 1}`,
        label:
          line?.label ||
          (line?.parameter_value !== undefined
            ? `m = ${line.parameter_value}`
            : `مستقيم ${index + 1}`),
        type: line?.type || "horizontal_line",
        dashed: true,
      }),
    );
  }

  if (Array.isArray(graph.lines)) {
    graph.lines.forEach((line, index) =>
      pushSeries(line, {
        id: line?.id || `line-${index + 1}`,
        label: line?.label || `مستقيم ${index + 1}`,
        type: line?.type || "line",
      }),
    );
  }

  if (
    normalizedSeries.length === 0 &&
    Array.isArray(graph.data)
  ) {
    pushSeries(
      {
        data: graph.data,
        label: graph.label || graph.title || "التمثيل البياني",
        type: graph.type || "curve",
      },
      { id: "graph-data" },
    );
  }

  if (normalizedSeries.length === 0) return null;

  const allPoints = normalizedSeries.flatMap((serie) => serie.data);

  const fallbackX = allPoints.map((point) => point.x);
  const fallbackY = allPoints.map((point) => point.y);

  const rawXMin =
    coordinateSystem.x_min ??
    graph.x_min ??
    graph.x_domain?.[0] ??
    Math.min(...fallbackX, 0);
  const rawXMax =
    coordinateSystem.x_max ??
    graph.x_max ??
    graph.x_domain?.[1] ??
    Math.max(...fallbackX, 1);
  const rawYMin =
    coordinateSystem.y_min ??
    graph.y_min ??
    graph.y_domain?.[0] ??
    Math.min(...fallbackY, 0);
  const rawYMax =
    coordinateSystem.y_max ??
    graph.y_max ??
    graph.y_domain?.[1] ??
    Math.max(...fallbackY, 1);

  let xMin = asFiniteNumber(rawXMin, -1);
  let xMax = asFiniteNumber(rawXMax, 1);
  let yMin = asFiniteNumber(rawYMin, -1);
  let yMax = asFiniteNumber(rawYMax, 1);

  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }

  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  const xPadding = (xMax - xMin) * 0.04;
  const yPadding = (yMax - yMin) * 0.08;

  if (
    coordinateSystem.x_min === undefined &&
    graph.x_min === undefined &&
    !graph.x_domain
  ) {
    xMin -= xPadding;
    xMax += xPadding;
  }

  if (
    coordinateSystem.y_min === undefined &&
    graph.y_min === undefined &&
    !graph.y_domain
  ) {
    yMin -= yPadding;
    yMax += yPadding;
  }

  return {
    ...graph,
    title:
      graph.title ||
      graph.graph_title ||
      graph.function?.label ||
      graph.curve?.label ||
      "التمثيل البياني",
    description:
      graph.description ||
      graph.caption ||
      graph.graph_instructions?.student_action ||
      "",
    series: normalizedSeries,
    special_points: Array.isArray(graph.special_points)
      ? graph.special_points.map(normalizePoint).filter(Boolean)
      : [],
    annotations: Array.isArray(graph.annotations)
      ? graph.annotations
      : [],
    x_domain: [xMin, xMax],
    y_domain: [yMin, yMax],
    x_label:
      graph.x_label ||
      coordinateSystem.x_label ||
      "x",
    y_label:
      graph.y_label ||
      coordinateSystem.y_label ||
      "y",
    settings: {
      show_grid:
        graph.settings?.show_grid ??
        coordinateSystem.show_grid ??
        true,
      show_axes:
        graph.settings?.show_axes ??
        coordinateSystem.show_axes ??
        true,
      show_legend:
        graph.settings?.show_legend ??
        true,
      show_point_labels:
        graph.settings?.show_point_labels ??
        true,
      connect_points:
        graph.settings?.connect_points ??
        true,
    },
  };
}

function GraphRenderer({ graph }) {
  const normalizedGraph = normalizeGraph(graph);
  if (!normalizedGraph) return null;

  const width = 860;
  const height = 500;
  const margin = { top: 38, right: 48, bottom: 64, left: 72 };

  const [xMin, xMax] = normalizedGraph.x_domain;
  const [yMin, yMax] = normalizedGraph.y_domain;

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const scaleX = (x) =>
    margin.left +
    ((Number(x) - xMin) / Math.max(xMax - xMin, 1e-9)) *
      plotWidth;

  const scaleY = (y) =>
    margin.top +
    (1 -
      (Number(y) - yMin) /
        Math.max(yMax - yMin, 1e-9)) *
      plotHeight;

  const makeTicks = (min, max, requestedStep) => {
    const step = asFiniteNumber(requestedStep);
    if (step && step > 0) {
      const start = Math.ceil(min / step) * step;
      const values = [];
      for (
        let value = start;
        value <= max + step * 0.001 && values.length < 30;
        value += step
      ) {
        values.push(Number(value.toFixed(10)));
      }
      return values;
    }

    const count = 7;
    return Array.from(
      { length: count + 1 },
      (_, index) => min + ((max - min) * index) / count,
    );
  };

  const coordinateSystem =
    normalizedGraph.coordinate_system || {};

  const xTicks = makeTicks(
    xMin,
    xMax,
    coordinateSystem.x_step,
  );
  const yTicks = makeTicks(
    yMin,
    yMax,
    coordinateSystem.y_step,
  );

  const palette = [
    "#4f46e5",
    "#059669",
    "#e11d48",
    "#d97706",
    "#7c3aed",
    "#0891b2",
    "#be123c",
    "#0f766e",
  ];

  const shouldDrawSeriesArrow = (serie) => {
    if (serie?.arrow === true || serie?.show_arrow === true) return true;
    if (serie?.arrow === false || serie?.show_arrow === false) return false;
    if (!Array.isArray(serie?.data) || serie.data.length !== 2) return false;

    const searchable = `${serie?.id || ""} ${serie?.label || ""}`.toLowerCase();

    return /(force|weight|reaction|friction|gravity|velocity|acceleration|buoyancy|drag|tension|vector|thrust|normal|parallel_component|normal_component|جهة|قوة|ثقل|احتكاك|سرعة|تسارع|دافعة|شد|رد الفعل)/i.test(
      searchable,
    );
  };

  const formatTick = (value) => {
    if (Number.isInteger(value)) return String(value);
    return Number(value.toFixed(2)).toString();
  };

  const axisX = yMin <= 0 && yMax >= 0
    ? scaleY(0)
    : height - margin.bottom;
  const axisY = xMin <= 0 && xMax >= 0
    ? scaleX(0)
    : margin.left;

  const graphHeading = splitGraphTitle(
    normalizedGraph.title || "",
    normalizedGraph.function || normalizedGraph.equation || "",
  );

  return (
    <div className="overflow-hidden rounded-[30px] border border-indigo-100 bg-white shadow-[0_18px_50px_-30px_rgba(79,70,229,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-100 bg-gradient-to-l from-indigo-50/90 via-white to-violet-50/50 px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1 text-[11px] font-black text-indigo-700 shadow-sm">
            <Compass size={14} />
            المنحنى المرجعي
          </div>
          <h4 className="text-base font-black leading-8 text-slate-950 sm:text-lg">
            {graphHeading.title}
          </h4>
          {graphHeading.formula && (
            <MathJax dynamic hideUntilTypeset="first">
              <div
                dir="ltr"
                className="mt-2 w-fit max-w-full overflow-x-auto rounded-xl border border-indigo-100 bg-white px-4 py-2 text-base font-black text-indigo-950 shadow-sm"
              >
                {`\\(${graphHeading.formula}\\)`}
              </div>
            </MathJax>
          )}
          {normalizedGraph.description && (
            <MathText className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-500">
              {normalizedGraph.description}
            </MathText>
          )}
        </div>

        {normalizedGraph.settings.show_legend !== false && (
          <div className="flex max-w-full flex-wrap gap-2">
            {normalizedGraph.series.map((serie, index) => (
              <span
                key={serie.id || index}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                <span
                  className={cn(
                    "h-2.5 w-5 rounded-full",
                    (serie.dashed ||
                      serie.type === "horizontal_line") &&
                      "border-t-2 border-dashed bg-transparent",
                  )}
                  style={
                    serie.dashed ||
                    serie.type === "horizontal_line"
                      ? {
                          borderColor:
                            palette[index % palette.length],
                        }
                      : {
                          backgroundColor:
                            palette[index % palette.length],
                        }
                  }
                />
                <MathText as="span" className="text-xs font-bold">
                  {serie.label || serie.id}
                </MathText>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto p-3 sm:p-5" dir="ltr">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full min-w-0"
          role="img"
          aria-label={normalizedGraph.title}
        >
          <defs>
            <marker
              id="axis-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L7,3 z" fill="#0f172a" />
            </marker>

            {palette.map((color, index) => (
              <marker
                key={`series-arrow-${index}`}
                id={`series-arrow-${index}`}
                markerWidth="9"
                markerHeight="9"
                refX="7.2"
                refY="3.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,7 L8,3.5 z" fill={color} />
              </marker>
            ))}
          </defs>

          <rect
            x="0"
            y="0"
            width={width}
            height={height}
            rx="22"
            fill="#ffffff"
          />

          {normalizedGraph.settings.show_grid !== false &&
            xTicks.map((tick, index) => (
              <line
                key={`x-grid-${index}`}
                x1={scaleX(tick)}
                y1={margin.top}
                x2={scaleX(tick)}
                y2={height - margin.bottom}
                stroke="#e2e8f0"
                strokeDasharray="4 5"
              />
            ))}

          {normalizedGraph.settings.show_grid !== false &&
            yTicks.map((tick, index) => (
              <line
                key={`y-grid-${index}`}
                x1={margin.left}
                y1={scaleY(tick)}
                x2={width - margin.right}
                y2={scaleY(tick)}
                stroke="#e2e8f0"
                strokeDasharray="4 5"
              />
            ))}

          {normalizedGraph.settings.show_axes !== false && (
            <>
              <line
                x1={margin.left}
                y1={axisX}
                x2={width - margin.right + 4}
                y2={axisX}
                stroke="#0f172a"
                strokeWidth="2"
                markerEnd="url(#axis-arrow)"
              />
              <line
                x1={axisY}
                y1={height - margin.bottom}
                x2={axisY}
                y2={margin.top - 4}
                stroke="#0f172a"
                strokeWidth="2"
                markerEnd="url(#axis-arrow)"
              />
            </>
          )}

          {xTicks.map((tick, index) => (
            <g key={`x-tick-${index}`}>
              <line
                x1={scaleX(tick)}
                y1={axisX - 4}
                x2={scaleX(tick)}
                y2={axisX + 4}
                stroke="#334155"
              />
              <text
                x={scaleX(tick)}
                y={Math.min(axisX + 20, height - 20)}
                textAnchor="middle"
                fontSize="12"
                fill="#475569"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {yTicks.map((tick, index) => (
            <g key={`y-tick-${index}`}>
              <line
                x1={axisY - 4}
                y1={scaleY(tick)}
                x2={axisY + 4}
                y2={scaleY(tick)}
                stroke="#334155"
              />
              <text
                x={Math.max(axisY - 10, 14)}
                y={scaleY(tick) + 4}
                textAnchor="end"
                fontSize="12"
                fill="#475569"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}

          <text
            x={width - margin.right + 20}
            y={axisX - 9}
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fill="#0f172a"
          >
            {normalizedGraph.x_label}
          </text>

          <text
            x={axisY + 15}
            y={margin.top - 15}
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fill="#0f172a"
          >
            {normalizedGraph.y_label}
          </text>

          {normalizedGraph.series.map((serie, serieIndex) => {
            const color = palette[serieIndex % palette.length];
            const points = serie.data;
            const path = points
              .map(
                (point) =>
                  `${scaleX(point.x)},${scaleY(point.y)}`,
              )
              .join(" ");

            const isPointsOnly =
              serie.type === "points" ||
              serie.type === "scatter" ||
              serie.type === "sequence";

            return (
              <g key={serie.id || serieIndex}>
                {!isPointsOnly && points.length > 1 && (
                  <polyline
                    points={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={
                      serie.type === "horizontal_line" ? 2.5 : 3
                    }
                    strokeDasharray={
                      serie.dashed ||
                      serie.type === "horizontal_line"
                        ? "10 7"
                        : undefined
                    }
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    markerEnd={
                      shouldDrawSeriesArrow(serie)
                        ? `url(#series-arrow-${serieIndex % palette.length})`
                        : undefined
                    }
                  />
                )}

                {(isPointsOnly ||
                  serie.show_points ||
                  normalizedGraph.settings.show_point_labels) &&
                  points.map((point, pointIndex) => (
                    <g key={pointIndex}>
                      <circle
                        cx={scaleX(point.x)}
                        cy={scaleY(point.y)}
                        r={isPointsOnly ? 5.5 : 3.2}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      {normalizedGraph.settings.show_point_labels &&
                        point.label && (
                          <text
                            x={scaleX(point.x)}
                            y={scaleY(point.y) - 11}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="700"
                            fill="#334155"
                          >
                            {point.label}
                          </text>
                        )}
                    </g>
                  ))}
              </g>
            );
          })}

          {normalizedGraph.special_points.map(
            (point, pointIndex) => (
              <g key={`special-${pointIndex}`}>
                <circle
                  cx={scaleX(point.x)}
                  cy={scaleY(point.y)}
                  r="7"
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth="3"
                />
                <text
                  x={scaleX(point.x) + 10}
                  y={scaleY(point.y) - 12}
                  textAnchor="start"
                  fontSize="12"
                  fontWeight="800"
                  fill="#92400e"
                >
                  {point.label ||
                    `(${formatTick(point.x)}, ${formatTick(
                      point.y,
                    )})`}
                </text>
              </g>
            ),
          )}

          {normalizedGraph.annotations.map(
            (annotation, index) => {
              const x = asFiniteNumber(annotation?.x);
              const y = asFiniteNumber(annotation?.y);
              if (x === null || y === null) return null;

              return (
                <text
                  key={index}
                  x={scaleX(x)}
                  y={scaleY(y)}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="#7c3aed"
                >
                  {annotation.text ||
                    annotation.label ||
                    annotation.name}
                </text>
              );
            },
          )}
        </svg>
      </div>

      {normalizedGraph.graph_instructions?.solution_reading && (
        <div className="border-t border-indigo-100 bg-indigo-50/60 px-5 py-4">
          <MathText className="text-sm font-bold text-indigo-950">
            {normalizedGraph.graph_instructions.solution_reading}
          </MathText>
        </div>
      )}
    </div>
  );
}

function normalizeVariationColumns(value) {
  if (!value || typeof value !== "object") return [];

  /*
   * البنية المبسطة الجديدة:
   * {
   *   columns: ["x", "-\\infty", "0", "+\\infty"],
   *   derivative_row: ["f'(x)=e^x", "+", "+", "+"],
   *   function_row: ["f(x)=e^x", "0", "1", "+\\infty"],
   *   arrows: ["↗", "↗"]
   * }
   *
   * هذه البنية لها Renderer خاص بالأسفل، لذلك لا نحوّلها
   * إلى DynamicDataTable حتى لا تظهر كروت منفصلة.
   */
  if (
    Array.isArray(value.columns) &&
    (
      Array.isArray(value.derivative_row) ||
      Array.isArray(value.function_row) ||
      Array.isArray(value.arrows)
    )
  ) {
    return [];
  }

  const directRows =
    value.rows ||
    value.table ||
    value.data ||
    value.entries ||
    value.intervals ||
    value.cases;

  if (Array.isArray(directRows)) return directRows;

  const xValues =
    value.x ||
    value.x_values ||
    value.breakpoints ||
    value.critical_points ||
    [];

  const derivativeValues =
    value.derivative ||
    value.derivative_sign ||
    value.f_prime ||
    value.f_prime_sign ||
    value.signs ||
    [];

  const functionValues =
    value.function ||
    value.function_values ||
    value.f ||
    value.variations ||
    value.direction ||
    [];

  if (
    Array.isArray(xValues) ||
    Array.isArray(derivativeValues) ||
    Array.isArray(functionValues)
  ) {
    const length = Math.max(
      xValues.length || 0,
      derivativeValues.length || 0,
      functionValues.length || 0,
    );

    return Array.from({ length }, (_, index) => ({
      x: xValues[index] ?? "",
      derivative_sign: derivativeValues[index] ?? "",
      variation: functionValues[index] ?? "",
    }));
  }

  return [];
}


/* =========================================================
   Compact variation-table renderer
   يدعم مباشرة:
   columns + derivative_row + function_row + arrows
========================================================= */

function normalizeVariationLatex(value) {
  let raw = decodeLatexEscapes(value).trim();

  if (!raw) return "";

  // نحذف محددات MathJax القديمة حتى لا تصبح متداخلة.
  if (
    (raw.startsWith("\\(") && raw.endsWith("\\)")) ||
    (raw.startsWith("\\[") && raw.endsWith("\\]"))
  ) {
    raw = raw.slice(2, -2).trim();
  }

  if (raw.startsWith("$$") && raw.endsWith("$$")) {
    raw = raw.slice(2, -2).trim();
  } else if (raw.startsWith("$") && raw.endsWith("$")) {
    raw = raw.slice(1, -1).trim();
  }

  return raw
    .replace(/[−–—]/g, "-")
    .replace(/\+∞/g, "+\\infty")
    .replace(/-∞/g, "-\\infty")
    .replace(/∞/g, "\\infty")
    // إصلاح قيم تصل أحيانًا بشكل infty+ أو infty-
    .replace(/^infty\+$/i, "+\\infty")
    .replace(/^infty-$/i, "-\\infty")
    .replace(/^\+infty$/i, "+\\infty")
    .replace(/^-infty$/i, "-\\infty")
    .trim();
}


function VariationMathValue({
  value,
  className = "",
  display = false,
}) {
  if (isEmpty(value)) return null;

  const raw = String(value).trim();

  // الأسهم ليست LaTeX؛ نعرضها مباشرة.
  if (["↗", "↘", "→", "←", "↑", "↓"].includes(raw)) {
    return (
      <span
        dir="ltr"
        className={cn(
          "inline-flex items-center justify-center font-black [unicode-bidi:isolate]",
          className,
        )}
      >
        {raw}
      </span>
    );
  }

  const latex = normalizeVariationLatex(raw);
  if (!latex) return null;

  return (
    <MathJax dynamic hideUntilTypeset="first">
      <span
        dir="ltr"
        className={cn(
          "inline-flex max-w-full items-center justify-center whitespace-nowrap",
          "font-black [unicode-bidi:isolate]",
          "[&_mjx-container]:m-0 [&_mjx-container]:direction-ltr",
          className,
        )}
      >
        {display ? `\\[${latex}\\]` : `\\(${latex}\\)`}
      </span>
    </MathJax>
  );
}


function CompactVariationTable({
  table,
  title = "جدول التغيرات",
}) {
  if (!table || typeof table !== "object") return null;

  const columns = Array.isArray(table.columns)
    ? table.columns.filter((value) => value !== undefined)
    : [];

  const derivativeRow = Array.isArray(table.derivative_row)
    ? table.derivative_row.filter((value) => value !== undefined)
    : [];

  const functionRow = Array.isArray(table.function_row)
    ? table.function_row.filter((value) => value !== undefined)
    : [];

  const explicitArrows = Array.isArray(table.arrows)
    ? table.arrows.filter((value) => value !== undefined)
    : [];

  if (columns.length < 2) return null;

  const xLabel = columns[0] ?? "x";
  const xPoints = columns.slice(1);
  const pointCount = xPoints.length;
  const intervalCount = Math.max(pointCount - 1, 0);

  const derivativeLabel = derivativeRow[0] ?? "f'(x)";
  const derivativeTokens = derivativeRow.slice(1);

  const functionLabel = functionRow[0] ?? "f(x)";
  const functionTokens = functionRow.slice(1);

  const normalizeDirection = (value) => {
    const raw = String(value ?? "")
      .replace(/\\text\{([^{}]*)\}/g, "$1")
      .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
      .replace(/\s+/g, "")
      .trim();

    if (["↗", "↑", "تزايد", "متزايدة", "متزايد", "تصاعد", "صاعدة", "صاعد"].some((token) => raw.includes(token))) {
      return "↗";
    }

    if (["↘", "↓", "تناقص", "متناقصة", "متناقص", "نزول", "نازلة", "نازل"].some((token) => raw.includes(token))) {
      return "↘";
    }

    if (["→", "ثابت", "ثابتة"].some((token) => raw.includes(token))) {
      return "→";
    }

    return "";
  };

  const isZeroToken = (value) => {
    const raw = normalizeVariationLatex(value).replace(/\s+/g, "").trim();
    return raw === "0";
  };

  const isForbiddenToken = (value) => {
    const raw = String(value ?? "").replace(/\s+/g, "").trim();
    return ["||", "║", "∥", "غيرمعرفة", "غيرمعرف"].includes(raw);
  };

  const isPlusToken = (value) => String(value ?? "").trim() === "+";
  const isMinusToken = (value) => ["-", "−", "–", "—"].includes(String(value ?? "").trim());

  /* =======================================================
     تحليل صف المشتقة
  ======================================================= */
  const derivativePointValues = Array.from(
    { length: pointCount },
    (_, index) => derivativeTokens[index] ?? "",
  );

  const intervalSigns = Array.from({ length: intervalCount }, (_, index) => {
    const left = derivativeTokens[index] ?? "";
    const right = derivativeTokens[index + 1] ?? "";

    const validSign = (value) => isPlusToken(value) || isMinusToken(value);

    if (validSign(left)) return left;
    if (validSign(right)) return right;

    return left || right || "";
  });

  /* =======================================================
     تحليل صف f

     يدعم:
     ["0", "1", "+\\infty"] + ["↗", "↗"]

     وكذلك:
     ["تناقص", "e^{-3}", "تزايد"]
  ======================================================= */
  const hasDirectionWords = functionTokens.some(
    (value) => normalizeDirection(value) !== "",
  );

  let functionPointValues = Array.from({ length: pointCount }, () => "");
  let normalizedArrows = Array.from(
    { length: intervalCount },
    (_, index) => normalizeDirection(explicitArrows[index]) || explicitArrows[index] || "",
  );

  if (hasDirectionWords) {
    const nonDirectionValues = functionTokens.filter(
      (token) => !normalizeDirection(token),
    );

    // في صيغة تناقص / قيمة / تزايد تكون القيمة وسطية غالبًا.
    if (nonDirectionValues.length === 1 && pointCount >= 3) {
      functionPointValues[Math.floor(pointCount / 2)] = nonDirectionValues[0];
    } else {
      nonDirectionValues.slice(0, pointCount).forEach((value, index) => {
        functionPointValues[index] = value;
      });
    }

    let arrowIndex = 0;
    functionTokens.forEach((token) => {
      const direction = normalizeDirection(token);
      if (direction && arrowIndex < intervalCount) {
        normalizedArrows[arrowIndex] = direction;
        arrowIndex += 1;
      }
    });
  } else {
    functionPointValues = Array.from(
      { length: pointCount },
      (_, index) => functionTokens[index] ?? "",
    );
  }

  normalizedArrows = normalizedArrows.map((arrow) => {
    const direction = normalizeDirection(arrow);
    return direction || String(arrow ?? "").trim() || "→";
  });

  /* =======================================================
     مستويات القيم في صف f
  ======================================================= */
  const pointLevels = [0];

  normalizedArrows.forEach((arrow) => {
    const direction = normalizeDirection(arrow) || arrow;
    const delta = direction === "↗" ? 1 : direction === "↘" ? -1 : 0;
    pointLevels.push(pointLevels[pointLevels.length - 1] + delta);
  });

  const minLevel = Math.min(...pointLevels);
  const maxLevel = Math.max(...pointLevels);
  const levelSpan = Math.max(maxLevel - minLevel, 1);

  const getPointTopPercent = (pointIndex) => {
    const level = pointLevels[pointIndex] ?? 0;
    const normalized = (level - minLevel) / levelSpan;

    // هوامش واضحة أعلى وأسفل الصف.
    return 78 - normalized * 56;
  };

  const getPointLeftPercent = (pointIndex) => {
    if (pointCount <= 1) return 50;
    return 4 + (pointIndex / (pointCount - 1)) * 92;
  };

  const markerIdBase = `variation-arrow-${String(table.id || title || "table")}`
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 36);

  const hasDomain =
    table.domain ||
    table.study_domain ||
    table.domain_text ||
    table.definition_domain;

  const domainValue =
    table.domain ||
    table.study_domain ||
    table.domain_text ||
    table.definition_domain ||
    "";

  return (
    <section
      dir="ltr"
      className="overflow-hidden rounded-[22px] border-2 border-slate-800 bg-white shadow-sm"
    >
      {/* العنوان */}
      <div className="border-b-2 border-slate-800 bg-slate-50/80 px-5 py-3.5 text-center">
        <h3 dir="rtl" className="text-base font-black text-slate-950 sm:text-lg">
          {title}
        </h3>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* ===================================================
              صف x
          =================================================== */}
          <div className="grid grid-cols-[125px_1fr] border-b-2 border-slate-800">
            <div className="flex min-h-[76px] items-center justify-center border-r-2 border-slate-800 bg-slate-100/85">
              <VariationMathValue
                value={xLabel}
                className="text-xl italic text-slate-950"
              />
            </div>

            <div className="relative min-h-[76px] bg-white">
              {xPoints.map((point, pointIndex) => {
                const left = getPointLeftPercent(pointIndex);
                const interior = pointIndex > 0 && pointIndex < pointCount - 1;

                return (
                  <div
                    key={`variation-x-point-${pointIndex}`}
                    className="absolute inset-y-0 -translate-x-1/2"
                    style={{ left: `${left}%` }}
                  >
                    {interior && (
                      <div className="absolute inset-y-0 left-1/2 border-l border-slate-300" />
                    )}

                    <div className="relative z-10 flex h-full items-center justify-center bg-white/95 px-2">
                      <VariationMathValue
                        value={point}
                        className="text-base text-slate-950 sm:text-lg"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===================================================
              صف f'(x)
          =================================================== */}
          {derivativeRow.length > 0 && (
            <div className="grid grid-cols-[125px_1fr] border-b-2 border-slate-800">
              <div className="flex min-h-[86px] items-center justify-center border-r-2 border-slate-800 bg-slate-100/85 px-2">
                <VariationMathValue
                  value={derivativeLabel}
                  className="text-base italic text-slate-950 sm:text-lg"
                />
              </div>

              <div className="relative min-h-[86px] bg-white">
                {/* الإشارات توضع في وسط كل مجال */}
                {intervalSigns.map((sign, intervalIndex) => {
                  const leftPoint = getPointLeftPercent(intervalIndex);
                  const rightPoint = getPointLeftPercent(intervalIndex + 1);
                  const center = (leftPoint + rightPoint) / 2;

                  return (
                    <div
                      key={`variation-derivative-sign-${intervalIndex}`}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${center}%` }}
                    >
                      <VariationMathValue
                        value={sign}
                        className={cn(
                          "text-2xl sm:text-3xl",
                          isPlusToken(sign)
                            ? "text-emerald-600"
                            : isMinusToken(sign)
                              ? "text-rose-600"
                              : "text-slate-800",
                        )}
                      />
                    </div>
                  );
                })}

                {/* 0 أو قيمة ممنوعة عند نقطة حرجة */}
                {derivativePointValues.map((value, pointIndex) => {
                  if (
                    pointIndex <= 0 ||
                    pointIndex >= pointCount - 1 ||
                    (!isZeroToken(value) && !isForbiddenToken(value))
                  ) {
                    return null;
                  }

                  const left = getPointLeftPercent(pointIndex);

                  return (
                    <div
                      key={`variation-derivative-point-${pointIndex}`}
                      className="absolute inset-y-0 -translate-x-1/2"
                      style={{ left: `${left}%` }}
                    >
                      <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-slate-300" />

                      <div className="relative z-10 flex h-full items-center justify-center bg-white px-2">
                        <VariationMathValue
                          value={value}
                          className="text-base text-slate-950 sm:text-lg"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================================================
              صف f — رسم مدرسي حقيقي
          =================================================== */}
          {functionRow.length > 0 && (
            <div className="grid grid-cols-[125px_1fr]">
              <div className="flex min-h-[205px] items-center justify-center border-r-2 border-slate-800 bg-slate-100/85 px-2">
                <VariationMathValue
                  value={functionLabel}
                  className="text-lg italic text-slate-950 sm:text-xl"
                />
              </div>

              <div className="relative min-h-[205px] bg-white">
                {/* الفواصل العمودية عند النقاط الداخلية */}
                {xPoints.map((_, pointIndex) => {
                  if (pointIndex <= 0 || pointIndex >= pointCount - 1) {
                    return null;
                  }

                  const left = getPointLeftPercent(pointIndex);

                  return (
                    <div
                      key={`variation-function-divider-${pointIndex}`}
                      className="pointer-events-none absolute inset-y-0 border-l border-dashed border-slate-300"
                      style={{ left: `${left}%` }}
                    />
                  );
                })}

                {/* SVG واحد فوق كامل صف f */}
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                  aria-hidden="true"
                >
                  <defs>
                    {normalizedArrows.map((_, intervalIndex) => {
                      const markerId = `${markerIdBase}-${intervalIndex}`;
                      return (
                        <marker
                          key={`marker-${intervalIndex}`}
                          id={markerId}
                          viewBox="0 0 10 10"
                          refX="8.5"
                          refY="5"
                          markerWidth="7"
                          markerHeight="7"
                          orient="auto-start-reverse"
                        >
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
                        </marker>
                      );
                    })}
                  </defs>

                  {normalizedArrows.map((arrow, intervalIndex) => {
                    const markerId = `${markerIdBase}-${intervalIndex}`;

                    const startPointX = getPointLeftPercent(intervalIndex);
                    const endPointX = getPointLeftPercent(intervalIndex + 1);
                    const distance = endPointX - startPointX;

                    // نترك فراغًا قرب القيمة حتى لا يلامس السهم النص.
                    const x1 = startPointX + distance * 0.11;
                    const x2 = endPointX - distance * 0.11;

                    const y1 = getPointTopPercent(intervalIndex);
                    const y2 = getPointTopPercent(intervalIndex + 1);

                    return (
                      <line
                        key={`variation-function-line-${intervalIndex}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#2563eb"
                        strokeWidth="2.6"
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        markerEnd={`url(#${markerId})`}
                      />
                    );
                  })}
                </svg>

                {/* قيم f فوق نفس مسار الأسهم */}
                {functionPointValues.map((value, pointIndex) => {
                  if (isEmpty(value)) return null;

                  const left = getPointLeftPercent(pointIndex);
                  const top = getPointTopPercent(pointIndex);

                  return (
                    <div
                      key={`variation-function-value-${pointIndex}`}
                      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white/95 px-2.5 py-1.5"
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                      }}
                    >
                      <VariationMathValue
                        value={value}
                        className="text-base text-slate-950 sm:text-lg"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {hasDomain && (
        <div className="border-t-2 border-slate-800 bg-slate-50/80 px-5 py-3">
          <div
            dir="rtl"
            className="flex flex-wrap items-center justify-center gap-2 text-sm font-black text-slate-700"
          >
            <span>مجال الدراسة:</span>
            <VariationMathValue
              value={domainValue}
              className="text-base text-slate-950"
            />
          </div>
        </div>
      )}

      {table.conclusion && (
        <div className="border-t border-emerald-100 bg-emerald-50/55 px-5 py-4">
          <MathText className="font-bold text-emerald-950">
            {table.conclusion}
          </MathText>
        </div>
      )}
    </section>
  );
}


function VariationTableRenderer({
  value,
  title = "جدول التغيرات",
}) {
  if (!value) return null;

  /*
   * دعم البنية المستعملة حاليًا في JSON:
   *
   * {
   *   columns: ["x", "-\\infty", "0", "+\\infty"],
   *   derivative_row: ["f'(x)=e^x", "+", "+", "+"],
   *   function_row: ["f(x)=e^x", "0", "1", "+\\infty"],
   *   arrows: ["↗", "↗"]
   * }
   */
  const isCompactVariationSchema =
    !Array.isArray(value) &&
    value &&
    typeof value === "object" &&
    Array.isArray(value.columns) &&
    (
      Array.isArray(value.derivative_row) ||
      Array.isArray(value.function_row) ||
      Array.isArray(value.arrows)
    );

  if (isCompactVariationSchema) {
    return (
      <CompactVariationTable
        table={value}
        title={value.title || title}
      />
    );
  }

  if (Array.isArray(value)) {
    return (
      <DynamicDataTable
        rows={value}
        preferredColumns={[
          "interval",
          "x",
          "critical_point",
          "derivative_sign",
          "sign",
          "variation",
          "direction",
          "function_value",
          "value",
        ]}
        title={title}
      />
    );
  }

  const rows = normalizeVariationColumns(value);

  if (rows.length > 0) {
    return (
      <div className="space-y-4">
        {value.title && (
          <MathText className="font-black text-slate-950">
            {value.title}
          </MathText>
        )}

        <DynamicDataTable
          rows={rows}
          preferredColumns={[
            "interval",
            "x",
            "critical_point",
            "derivative_sign",
            "sign",
            "variation",
            "direction",
            "function_value",
            "value",
          ]}
          title={title}
        />

        {value.conclusion && (
          <InfoBox
            title="الاستنتاج من الجدول"
            tone="emerald"
            icon={CheckCircle2}
          >
            <MathText className="font-bold">
              {value.conclusion}
            </MathText>
          </InfoBox>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[26px] border border-cyan-100 bg-gradient-to-b from-cyan-50/60 to-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-cyan-800">
        <Route size={19} />
        <h3 className="font-black">{title}</h3>
      </div>

      <StructuredValue
        value={value}
        fieldKey="variation_table_configuration"
        depth={1}
      />
    </div>
  );
}


function HintLevels({ items }) {
  const [visibleLevel, setVisibleLevel] = useState(0);

  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="rounded-[26px] border border-amber-200 bg-amber-50/70 p-5">
      <div className="mb-4 flex items-center gap-2 font-black text-amber-950">
        <Lightbulb size={19} />
        تلميحات تدريجية
      </div>

      <div className="space-y-2">
        {items.map((item, index) => {
          const level = item?.level ?? index + 1;
          const isVisible = index < visibleLevel;

          return (
            <div key={`${level}-${index}`}>
              {isVisible ? (
                <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                  <span className="mb-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-800">
                    التلميح {level}
                  </span>
                  <MathText className="font-bold text-amber-950">
                    {getDisplayText(item)}
                  </MathText>
                </div>
              ) : index === visibleLevel ? (
                <button
                  type="button"
                  onClick={() => setVisibleLevel((current) => current + 1)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-white px-4 py-3 font-black text-amber-800 transition hover:bg-amber-100"
                >
                  <Lightbulb size={17} />
                  إظهار التلميح {level}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}




function CompactInfoCard({
  title,
  icon: Icon = Lightbulb,
  children,
  tone = "indigo",
  className = "",
}) {
  const tones = {
    indigo: "border-indigo-100 bg-indigo-50/55 text-indigo-700",
    emerald: "border-emerald-100 bg-emerald-50/60 text-emerald-700",
    violet: "border-violet-100 bg-violet-50/60 text-violet-700",
    amber: "border-amber-100 bg-amber-50/65 text-amber-700",
    rose: "border-rose-100 bg-rose-50/65 text-rose-700",
    slate: "border-slate-200 bg-slate-50/70 text-slate-700",
  };

  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border p-3.5 shadow-sm",
        "transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
        tones[tone] || tones.indigo,
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/85 shadow-sm">
          <Icon size={15} />
        </span>
        <h4 className="text-xs font-black">{title}</h4>
      </div>
      <div className="text-slate-700">{children}</div>
    </section>
  );
}

function LawGuideSection({ guides }) {
  const normalizedGuides = Array.isArray(guides)
    ? guides.filter((item) => item && typeof item === "object")
    : guides && typeof guides === "object"
      ? [guides]
      : [];

  if (normalizedGuides.length === 0) return null;

  return (
    <section className="space-y-5">
      {normalizedGuides.map((guide, guideIndex) => {
        const symbols = Array.isArray(guide.symbols)
          ? guide.symbols.filter(Boolean)
          : [];

        const howToUse = Array.isArray(guide.how_to_use)
          ? guide.how_to_use.filter(Boolean)
          : guide.how_to_use
            ? [guide.how_to_use]
            : [];

        const formulaSource = guide.law || "";
        const formula = normalizeInlineLatexFormula(formulaSource);

        const hasContent = Boolean(
          guide.title ||
            guide.why ||
            formula ||
            guide.meaning ||
            symbols.length ||
            howToUse.length ||
            guide.simple_example ||
            guide.warning,
        );

        if (!hasContent) return null;

        return (
          <article
            key={guide.id || `law-guide-${guideIndex}`}
            className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm"
          >
            {(guide.title || guide.why) && (
              <header className="border-b border-slate-100 bg-gradient-to-l from-indigo-50/80 via-white to-white px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                    <Brain size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <MathText
                      as="h3"
                      className="text-[15px] font-black leading-7 text-slate-950 sm:text-base"
                    >
                      {guide.title || "شرح القانون"}
                    </MathText>

                    {guide.why && (
                      <MathText className="mt-0.5 max-w-4xl text-xs font-semibold leading-6 text-slate-500 sm:text-sm">
                        {guide.why}
                      </MathText>
                    )}
                  </div>
                </div>
              </header>
            )}

            <div className="space-y-4 p-4 sm:p-5">
              {(formula || guide.meaning) && (
                <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]">
                  {formula && (
                    <section className="min-w-0 rounded-2xl border border-indigo-100 bg-indigo-50/65 p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-black text-indigo-700">
                        <BookOpen size={15} />
                        القانون
                      </div>

                      <div className="overflow-x-auto rounded-xl bg-white px-3 py-4 ring-1 ring-indigo-100">
                        <MixedArabicMath
                          value={formulaSource}
                          className="min-h-10"
                        />
                      </div>
                    </section>
                  )}

                  {guide.meaning && (
                    <section className="min-w-0 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-black text-emerald-700">
                        <Lightbulb size={15} />
                        المعنى
                      </div>

                      <MathText className="text-sm font-semibold leading-8 text-slate-700 sm:text-[15px]">
                        {guide.meaning}
                      </MathText>
                    </section>
                  )}
                </div>
              )}

              {symbols.length > 0 && (
                <section>
                  <div className="mb-2.5 flex items-center gap-2">
                    <Hash size={16} className="text-violet-600" />
                    <h4 className="text-sm font-black text-slate-900">
                      معاني الرموز
                    </h4>
                  </div>

                  <div className="grid auto-rows-min gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {symbols.map((item, index) => {
                      const symbol =
                        typeof item === "object"
                          ? item.symbol || item.notation || item.key || ""
                          : "";

                      const meaning =
                        typeof item === "object"
                          ? item.meaning ||
                            item.description ||
                            item.explanation ||
                            item.value ||
                            ""
                          : String(item);

                      if (!symbol && !meaning) return null;

                      return (
                        <div
                          key={`${symbol || "symbol"}-${index}`}
                          className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 shadow-sm"
                        >
                          {symbol && (
                            <MathJax dynamic hideUntilTypeset="first">
                              <span
                                dir="ltr"
                                className="inline-flex min-w-[64px] shrink-0 items-center justify-center rounded-xl bg-white px-2.5 py-2 text-sm font-black text-indigo-700 ring-1 ring-slate-200"
                              >
                                {`\\(${normalizeInlineLatexFormula(symbol)}\\)`}
                              </span>
                            </MathJax>
                          )}

                          {meaning && (
                            <MathText className="min-w-0 flex-1 text-sm font-semibold leading-7 text-slate-700">
                              {meaning}
                            </MathText>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {howToUse.length > 0 && (
                <section className="rounded-2xl border border-violet-100 bg-violet-50/55 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-black text-violet-700">
                    <Route size={15} />
                    طريقة الاستعمال
                  </div>

                  <ol className="grid auto-rows-min gap-2.5 sm:grid-cols-2">
                    {howToUse.map((item, index) => (
                      <li
                        key={`law-use-${index}`}
                        className="flex min-w-0 items-start gap-2.5 rounded-xl border border-violet-100 bg-white px-3 py-3"
                      >
                        <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 px-1.5 text-xs font-black text-white">
                          {index + 1}
                        </span>

                        <MathText className="min-w-0 flex-1 text-sm font-semibold leading-7 text-slate-700">
                          {getDisplayText(item)}
                        </MathText>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {(guide.simple_example || guide.warning) && (
                <div className="grid auto-rows-min gap-3 md:grid-cols-2">
                  {guide.simple_example && (
                    <section className="rounded-2xl border border-amber-100 bg-amber-50/65 p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-black text-amber-700">
                        <GraduationCap size={15} />
                        مثال
                      </div>

                      <MathText className="text-sm font-semibold leading-7 text-slate-700">
                        {guide.simple_example}
                      </MathText>
                    </section>
                  )}

                  {guide.warning && (
                    <section className="rounded-2xl border border-rose-100 bg-rose-50/65 p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-black text-rose-700">
                        <AlertTriangle size={15} />
                        تنبيه
                      </div>

                      <MathText className="text-sm font-bold leading-7 text-rose-950">
                        {guide.warning}
                      </MathText>
                    </section>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function RelationCards({ items, title = "العلاقات الأساسية" }) {
  const normalized = Array.isArray(items)
    ? items.filter((item) => !isEmpty(item))
    : items && typeof items === "object"
      ? Object.entries(items).map(([key, value]) => ({
          label: fieldLabel(key),
          value,
        }))
      : !isEmpty(items)
        ? [items]
        : [];

  if (normalized.length === 0) return null;

  return (
    <section className="rounded-[28px] border border-violet-100 bg-gradient-to-b from-violet-50/60 to-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <ListChecks size={19} className="text-violet-600" />
        <h3 className="font-black text-slate-950">{title}</h3>
      </div>

      <div
        className={cn(
          "grid auto-rows-fr gap-3",
          normalized.length === 1 && "grid-cols-1",
          normalized.length === 2 && "md:grid-cols-2",
          normalized.length === 3 && "md:grid-cols-3",
          normalized.length >= 4 && "md:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {normalized.map((item, index) => {
          if (
            typeof item === "string" ||
            typeof item === "number"
          ) {
            return (
              <div
                key={`relation-${index}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <MixedArabicMath value={String(item)} compact />
              </div>
            );
          }

          if (!item || typeof item !== "object") return null;

          const label =
            item.label ||
            item.title ||
            item.measurement ||
            item.case ||
            item.name ||
            "";

          const formula =
            item.formula ||
            item.relation ||
            item.rate ||
            item.expression ||
            item.equation ||
            item.result ||
            item.value ||
            "";

          const details =
            item.meaning ||
            item.explanation ||
            item.description ||
            item.note ||
            "";

          const extraEntries = Object.entries(item).filter(
            ([key, value]) =>
              ![
                "label",
                "title",
                "measurement",
                "case",
                "name",
                "formula",
                "relation",
                "rate",
                "expression",
                "equation",
                "result",
                "value",
                "meaning",
                "explanation",
                "description",
                "note",
              ].includes(key) &&
              !isEmpty(value),
          );

          if (!label && !formula && !details && extraEntries.length === 0) {
            return null;
          }

          return (
            <div
              key={item.id || `relation-${index}`}
              className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm"
            >
              {label && (
                <div className="border-b border-violet-100 bg-violet-50/70 px-5 py-3">
                  <MathText className="text-sm font-black text-violet-800">
                    {label}
                  </MathText>
                </div>
              )}

              <div className="space-y-3 p-4">
                {formula && (
                  <div className="rounded-xl bg-slate-950 px-3 py-4 text-white">
                    <MixedArabicMath
                      value={formula}
                      compact
                      dark
                    />
                  </div>
                )}

                {details && (
                  <MathText className="text-sm font-semibold text-slate-600">
                    {details}
                  </MathText>
                )}

                {extraEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <p className="mb-1 text-xs font-black text-slate-500">
                      {fieldLabel(key)}
                    </p>
                    <StructuredValue
                      value={value}
                      fieldKey={key}
                      depth={1}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


function normalizeSignNumber(value) {
  const text = String(value ?? "")
    .replace(/[−–—]/g, "-")
    .replace(/\\,/g, "")
    .trim();

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function stripMathDelimiters(value) {
  return decodeLatexEscapes(value)
    .replace(/^\\\(|\\\)$/g, "")
    .replace(/^\\\[|\\\]$/g, "")
    .replace(/^\$+|\$+$/g, "")
    .trim();
}

function parseIntervalBounds(value) {
  const raw = stripMathDelimiters(value)
    .replace(/\\infty/g, "∞")
    .replace(/\s+/g, "");

  if (!raw) return null;

  const match = raw.match(
    /^[\]\[]([^,;]+)[,;]([^\]\[]+)[\]\[]$/,
  );

  if (!match) return null;

  const parseBound = (bound) => {
    const normalized = bound.replace(/[−–—]/g, "-");

    if (
      normalized === "-∞" ||
      normalized === "-+∞" ||
      normalized === "-infty"
    ) {
      return -Infinity;
    }

    if (
      normalized === "+∞" ||
      normalized === "∞" ||
      normalized === "+infty"
    ) {
      return Infinity;
    }

    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  };

  const left = parseBound(match[1]);
  const right = parseBound(match[2]);

  if (left === null || right === null) return null;

  return { left, right };
}

function intervalContainsSample(intervalValue, sample) {
  const bounds = parseIntervalBounds(intervalValue);
  if (!bounds) return false;

  return sample > bounds.left && sample < bounds.right;
}

function normalizeIntervalList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => !isEmpty(item));
  }

  return isEmpty(value) ? [] : [value];
}

function getSignAtSample(item, sample) {
  const zero = normalizeSignNumber(
    item?.zero_at ??
      item?.root ??
      item?.zero ??
      item?.critical_value,
  );

  if (zero !== null && sample === zero) return "0";

  const positiveIntervals = normalizeIntervalList(
    item?.positive_on,
  );
  const negativeIntervals = normalizeIntervalList(
    item?.negative_on,
  );

  if (
    positiveIntervals.some((interval) =>
      intervalContainsSample(interval, sample),
    )
  ) {
    return "+";
  }

  if (
    negativeIntervals.some((interval) =>
      intervalContainsSample(interval, sample),
    )
  ) {
    return "−";
  }

  return "";
}

function buildSignTableColumns(roots) {
  const numericRoots = roots
    .map(normalizeSignNumber)
    .filter((value) => value !== null)
    .sort((a, b) => a - b);

  const uniqueRoots = [...new Set(numericRoots)];

  if (uniqueRoots.length === 0) return [];

  const columns = [];

  uniqueRoots.forEach((root, index) => {
    const previous =
      index === 0 ? -Infinity : uniqueRoots[index - 1];

    const sample =
      previous === -Infinity
        ? root - Math.max(1, Math.abs(root) + 1)
        : (previous + root) / 2;

    columns.push({
      type: "interval",
      sample,
      label:
        previous === -Infinity
          ? `\\(]-\\infty,${root}[\\)`
          : `\\(]${previous},${root}[\\)`,
    });

    columns.push({
      type: "root",
      sample: root,
      label: `\\(${root}\\)`,
    });
  });

  const lastRoot = uniqueRoots[uniqueRoots.length - 1];

  columns.push({
    type: "interval",
    sample: lastRoot + Math.max(1, Math.abs(lastRoot) + 1),
    label: `\\(]${lastRoot},+\\infty[\\)`,
  });

  return columns;
}

function ClassicSignCell({ value, root = false }) {
  const normalized =
    value === "-" ? "−" : value === "+" ? "+" : value;

  return (
    <div
      className={cn(
        "flex min-h-12 items-center justify-center text-xl font-black",
        root && "min-w-12",
        normalized === "+"
          ? "text-emerald-700"
          : normalized === "−"
            ? "text-rose-700"
            : normalized === "0"
              ? "text-slate-950"
              : "text-slate-500",
      )}
    >
      {normalized || ""}
    </div>
  );
}

function SignTable({
  expression,
  signAnalysis = [],
  result = null,
}) {
  const resultRoots = result
    ? normalizeIntervalList(
        result.zero_at ?? result.roots ?? result.zeros,
      )
    : [];

  const factorRoots = signAnalysis.flatMap((item) =>
    normalizeIntervalList(
      item?.zero_at ??
        item?.root ??
        item?.zero ??
        item?.critical_value,
    ),
  );

  const roots =
    resultRoots.length > 0 ? resultRoots : factorRoots;

  const columns = buildSignTableColumns(roots);

  if (columns.length === 0 || signAnalysis.length === 0) {
    return null;
  }

  const resultItem = result
    ? {
        zero_at:
          result.zero_at ?? result.roots ?? result.zeros,
        positive_on: result.positive_on,
        negative_on: result.negative_on,
        zero_on: result.zero_on,
      }
    : null;

  const factorLabel = (item, index) =>
    item?.factor ||
    item?.expression ||
    item?.function ||
    item?.term ||
    `العامل ${index + 1}`;

  return (
    <section className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-sm font-black text-slate-950">
          <ListChecks size={17} className="text-indigo-600" />
          جدول الإشارة
        </h4>

        {expression && (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <MixedArabicMath
              value={expression}
              compact
            />
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border-2 border-slate-900 bg-white shadow-sm">
        <table
          dir="ltr"
          className="w-full min-w-[720px] border-collapse text-center"
        >
          <thead>
            <tr>
              <th className="w-36 border-r-2 border-slate-900 bg-white px-3 py-3 text-base font-black text-slate-950">
                <MathText as="span" className="font-black text-slate-950">
                  \(x\)
                </MathText>
              </th>

              {columns.map((column, index) => (
                <th
                  key={`classic-sign-head-${index}`}
                  className={cn(
                    "border-r border-slate-900 bg-white px-3 py-3 text-base font-black text-slate-950",
                    column.type === "root" &&
                      "w-16 border-x-2 border-slate-900 bg-slate-50",
                  )}
                >
                  <MathText
                    as="span"
                    className="font-black text-slate-950"
                  >
                    {column.label}
                  </MathText>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {signAnalysis.map((item, rowIndex) => (
              <tr
                key={`classic-factor-row-${rowIndex}`}
                className="border-t-2 border-slate-900"
              >
                <th className="border-r-2 border-slate-900 bg-white px-3 py-3 text-base font-black text-slate-950">
                  <div dir="rtl" className="text-right">
                    <MixedArabicMath
                      value={factorLabel(item, rowIndex)}
                      compact
                      centered={false}
                    />
                  </div>
                </th>

                {columns.map((column, columnIndex) => (
                  <td
                    key={`classic-factor-sign-${rowIndex}-${columnIndex}`}
                    className={cn(
                      "border-r border-slate-900 bg-white px-2",
                      column.type === "root" &&
                        "border-x-2 border-slate-900 bg-slate-50",
                    )}
                  >
                    <ClassicSignCell
                      value={getSignAtSample(
                        item,
                        column.sample,
                      )}
                      root={column.type === "root"}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {resultItem && (
              <tr className="border-t-[3px] border-slate-950">
                <th className="border-r-2 border-slate-900 bg-indigo-50 px-3 py-3 text-base font-black text-indigo-950">
                  <div
                    dir="rtl"
                    className="flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <span>إشارة</span>
                    <MathText
                      as="span"
                      className="font-black text-indigo-950"
                    >
                      \(f'(x)\)
                    </MathText>
                  </div>
                </th>

                {columns.map((column, columnIndex) => (
                  <td
                    key={`classic-result-sign-${columnIndex}`}
                    className={cn(
                      "border-r border-slate-900 bg-indigo-50 px-2",
                      column.type === "root" &&
                        "border-x-2 border-slate-900 bg-amber-50",
                    )}
                  >
                    <ClassicSignCell
                      value={getSignAtSample(
                        resultItem,
                        column.sample,
                      )}
                      root={column.type === "root"}
                    />
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StrategyOverviewStep({ content = {} }) {
  const stages = Array.isArray(content.stages)
    ? content.stages.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const accents = [
    "from-sky-500 to-cyan-500",
    "from-indigo-500 to-violet-500",
    "from-amber-500 to-orange-500",
    "from-fuchsia-500 to-pink-500",
    "from-emerald-500 to-teal-500",
  ];

  const icons = [Compass, Hash, CircleHelp, WandSparkles, CheckCircle2];

  return (
    <div className="space-y-5">
      {content.teacher && (
        <section className="rounded-[26px] border border-indigo-100 bg-gradient-to-l from-indigo-50/80 via-white to-white p-5 shadow-sm sm:p-6">
          <div className="mb-2 flex items-center gap-2 text-indigo-700">
            <Route size={18} />
            <h3 className="font-black">الخطة التي تتكرر في كل تمرين</h3>
          </div>
          <MathText className="text-[15px] font-semibold leading-8 text-slate-700">
            {content.teacher}
          </MathText>
        </section>
      )}

      {stages.length > 0 && (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-indigo-600">مسار اتخاذ القرار</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">خمس مراحل من السؤال إلى النتيجة</h3>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-200">
              {stages.length} مراحل
            </span>
          </div>

          <div className="relative space-y-4">
            <div className="pointer-events-none absolute bottom-8 right-[25px] top-8 hidden w-0.5 bg-gradient-to-b from-sky-200 via-violet-200 to-emerald-200 sm:block" />
            {stages.map((item, index) => {
              const Icon = icons[index] || Route;
              return (
                <article
                  key={item.stage || `strategy-stage-${index}`}
                  className="relative grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[64px_220px_1fr] sm:items-center sm:p-5"
                >
                  <span className={cn(
                    "relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-lg font-black text-white shadow-lg",
                    accents[index % accents.length],
                  )}>
                    {item.stage || index + 1}
                  </span>

                  <div className="min-w-0 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                    <div className="mb-1 flex items-center gap-2 text-indigo-700">
                      <Icon size={16} />
                      <span className="text-[11px] font-black">اسم المرحلة</span>
                    </div>
                    <h4 className="font-black text-slate-950">{item.name || `المرحلة ${index + 1}`}</h4>
                  </div>

                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-black text-slate-500">ماذا أفعل؟</p>
                    <MathText className="text-sm font-bold leading-7 text-slate-700">
                      {item.content || item.description || item.action}
                    </MathText>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {content.memory_tip && (
        <section className="overflow-hidden rounded-[24px] border border-violet-200 bg-gradient-to-l from-violet-50 to-white shadow-sm">
          <div className="flex items-start gap-3 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <Brain size={19} />
            </span>
            <div>
              <p className="mb-1 text-xs font-black text-violet-700">عبارة الحفظ</p>
              <MathText className="text-base font-black leading-8 text-violet-950">
                {content.memory_tip}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {content.attention && (
        <InfoBox title="متى أتوقف؟" tone="amber" icon={AlertTriangle} compact={false}>
          <MathText className="font-black leading-8">{content.attention}</MathText>
        </InfoBox>
      )}
    </div>
  );
}

function LimitPositionMethodStep({ content = {} }) {
  const cases = Array.isArray(content.cases)
    ? content.cases.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const meta = [
    { label: "عند عدد حقيقي", icon: Target, tone: "indigo" },
    { label: "نهاية جانبية", icon: ArrowLeft, tone: "amber" },
    { label: "عند المالانهاية", icon: Sparkles, tone: "emerald" },
  ];

  const tones = {
    indigo: "border-indigo-200 bg-indigo-50/55 text-indigo-700",
    amber: "border-amber-200 bg-amber-50/60 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
  };

  return (
    <div className="space-y-5">
      {content.method_goal && (
        <section className="rounded-[26px] border border-indigo-100 bg-gradient-to-l from-indigo-50/90 via-white to-white p-5 shadow-sm sm:p-6">
          <div className="mb-2 flex items-center gap-2 text-indigo-700">
            <Target size={18} />
            <h3 className="font-black">هدف هذه المرحلة</h3>
          </div>
          <MathText className="text-[15px] font-black leading-8 text-slate-800">
            {content.method_goal}
          </MathText>
        </section>
      )}

      {cases.length > 0 && (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-black text-indigo-600">اختر السطر الموافق لموضع النهاية</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">أين تتم الدراسة؟ وما أول قرار؟</h3>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {cases.map((item, index) => {
              const itemMeta = meta[index] || meta[0];
              const Icon = itemMeta.icon;
              return (
                <article
                  key={`position-case-${index}`}
                  className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className={cn("border-b p-4", tones[itemMeta.tone])}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
                        <Icon size={18} />
                      </span>
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black">
                        الحالة {index + 1}
                      </span>
                    </div>
                    <p className="mb-1 text-[11px] font-black opacity-80">موضع النهاية</p>
                    <MathText className="text-center text-lg font-black leading-9 text-slate-950">
                      {item.position}
                    </MathText>
                  </div>

                  <div className="p-4">
                    <p className="mb-2 text-[11px] font-black text-slate-500">أول خطوة تقوم بها</p>
                    <MathText className="text-sm font-bold leading-7 text-slate-700">
                      {item.first_action}
                    </MathText>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {content.attention && (
        <InfoBox title="تنبيه مهم" tone="rose" icon={AlertTriangle} compact={false}>
          <MathText className="font-black leading-8">{content.attention}</MathText>
        </InfoBox>
      )}
    </div>
  );
}



function FunctionTypeMethodStep({ content = {} }) {
  const items = Array.isArray(content.function_types)
    ? content.function_types.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const cards = [
    { badge: "كثيرة حدود", tone: "indigo", icon: Hash },
    { badge: "دالة ناطقة", tone: "sky", icon: Route },
    { badge: "دالة مركبة", tone: "violet", icon: Sparkles },
    { badge: "عملية على دوال", tone: "amber", icon: ListChecks },
    { badge: "حصر", tone: "emerald", icon: Target },
  ];

  const toneClasses = {
    indigo: "border-indigo-200 bg-indigo-50/65 text-indigo-800",
    sky: "border-sky-200 bg-sky-50/65 text-sky-800",
    violet: "border-violet-200 bg-violet-50/65 text-violet-800",
    amber: "border-amber-200 bg-amber-50/65 text-amber-800",
    emerald: "border-emerald-200 bg-emerald-50/65 text-emerald-800",
  };

  return (
    <div className="space-y-5">
      {content.method_goal && (
        <InfoBox title="هدف المرحلة" tone="indigo" icon={Target} compact={false}>
          <MathText className="font-black leading-8">{content.method_goal}</MathText>
        </InfoBox>
      )}

      {items.length > 0 && (
        <section className="rounded-[28px] border border-slate-200 bg-slate-50/55 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <Compass size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">اختر القاعدة انطلاقًا من شكل العبارة</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">ابدأ بالعملية الرئيسية، ثم حلّل الأجزاء الموجودة داخلها.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {items.map((item, index) => {
              const meta = cards[index] || cards[0];
              const Icon = meta.icon;
              return (
                <article
                  key={`function-type-${index}`}
                  className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className={cn("flex items-center justify-between gap-3 border-b px-4 py-3", toneClasses[meta.tone])}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/90 shadow-sm">
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black opacity-70">نوع العبارة</p>
                        <h4 className="truncate text-sm font-black text-slate-950">{item.type || meta.badge}</h4>
                      </div>
                    </div>
                    <span className="flex h-8 min-w-8 items-center justify-center rounded-xl bg-white/85 px-2 text-xs font-black shadow-sm">{index + 1}</span>
                  </div>

                  <div className="p-4">
                    <p className="mb-2 text-[11px] font-black text-slate-500">القاعدة التي أبدأ بها</p>
                    <MathText className="text-sm font-bold leading-7 text-slate-700">{item.initial_rule}</MathText>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {content.attention && (
        <InfoBox title="انتبه عند التشخيص" tone="rose" icon={AlertTriangle} compact={false}>
          <MathText className="font-black leading-8">{content.attention}</MathText>
        </InfoBox>
      )}
    </div>
  );
}

function DirectCalculationMethodStep({ content = {} }) {
  const algorithm = Array.isArray(content.algorithm) ? content.algorithm.filter(Boolean) : [];
  const examples = Array.isArray(content.determined_examples)
    ? content.determined_examples.filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      {content.method_goal && (
        <InfoBox title="هدف الحساب المباشر" tone="indigo" icon={Target} compact={false}>
          <MathText className="font-black leading-8">{content.method_goal}</MathText>
        </InfoBox>
      )}

      {algorithm.length > 0 && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200">
              <ListChecks size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">الحساب المباشر في أربع خطوات</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">لا تنتقل إلى المعالجة الجبرية إلا بعد كتابة الشكل الناتج.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {algorithm.map((item, index) => (
              <article key={`direct-step-${index}`} className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/45 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white shadow-sm">{index + 1}</span>
                <div className="min-w-0">
                  <p className="mb-1 text-[10px] font-black text-indigo-600">الخطوة {index + 1}</p>
                  <MathText className="text-sm font-bold leading-7 text-slate-800">{item}</MathText>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {examples.length > 0 && (
        <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/35 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-emerald-800">
            <CheckCircle2 size={19} />
            <div>
              <h3 className="font-black text-slate-950">أشكال معيّنة تنتهي بالقواعد الأساسية</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">عندما يكون الشكل معيّنًا، نكتب النتيجة مباشرة وفق القاعدة المناسبة.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {examples.map((example, index) => (
              <div key={`determined-example-${index}`} className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-800">مثال {index + 1}</span>
                  <CheckCircle2 size={15} className="text-emerald-600" />
                </div>
                <MathText className="text-center text-base font-black leading-9 text-slate-950">{example}</MathText>
              </div>
            ))}
          </div>
        </section>
      )}

      {content.attention && (
        <InfoBox title="ملاحظة أساسية" tone="amber" icon={AlertTriangle} compact={false}>
          <MathText className="font-black leading-8">{content.attention}</MathText>
        </InfoBox>
      )}
    </div>
  );
}

function InfinityRatioMethodSelectionStep({ content = {} }) {
  const cases = Array.isArray(content.degree_cases)
    ? content.degree_cases.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const tones = [
    "border-sky-200 bg-sky-50/65 text-sky-800",
    "border-violet-200 bg-violet-50/65 text-violet-800",
    "border-amber-200 bg-amber-50/65 text-amber-800",
  ];

  return (
    <div className="space-y-5">
      {content.teacher && (
        <div className="rounded-[24px] border border-indigo-100 bg-gradient-to-l from-indigo-50/80 via-white to-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-indigo-700">
            <Brain size={16} />
            شرح اختيار الطريقة
          </div>
          <MathText className="text-sm font-semibold leading-8 text-slate-700 sm:text-[15px]">{content.teacher}</MathText>
        </div>
      )}

      {content.operational_method && (
        <section className="overflow-hidden rounded-[26px] border border-indigo-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-indigo-950 via-indigo-900 to-violet-900 px-5 py-4 text-white">
            <p className="text-[11px] font-black text-indigo-200">الطريقة العملية</p>
            <h3 className="mt-1 text-lg font-black">كيف نعالج الشكل \(\infty/\infty\)؟</h3>
          </div>
          <div className="flex items-start gap-3 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><Route size={19} /></span>
            <MathText className="font-black leading-8 text-slate-800">{content.operational_method}</MathText>
          </div>
        </section>
      )}

      {cases.length > 0 && (
        <section className="rounded-[28px] border border-slate-200 bg-slate-50/55 p-4 shadow-sm sm:p-5">
          <div className="mb-4">
            <h3 className="font-black text-slate-950">القرار حسب مقارنة الدرجتين</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">قارن درجة البسط بدرجة المقام، ثم اقرأ النتيجة المناسبة.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {cases.map((item, index) => (
              <article key={`degree-case-${index}`} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <div className={cn("border-b px-4 py-3", tones[index] || tones[0])}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black">الحالة {index + 1}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 font-black shadow-sm">{index + 1}</span>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  <div>
                    <p className="mb-1 text-[11px] font-black text-slate-500">مقارنة الدرجتين</p>
                    <MathText className="text-sm font-black leading-7 text-slate-900">{item.condition}</MathText>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/65 p-3">
                    <p className="mb-1 text-[11px] font-black text-emerald-700">النتيجة</p>
                    <MathText className="text-sm font-black leading-7 text-emerald-950">{item.result}</MathText>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {content.attention && (
        <InfoBox title="خطأ ممنوع" tone="rose" icon={AlertTriangle} compact={false}>
          <MathText className="font-black leading-8">{content.attention}</MathText>
        </InfoBox>
      )}
    </div>
  );
}


function ZeroOverZeroMethodSelectionStep({ content = {} }) {
  const guides = Array.isArray(content.decision_guide)
    ? content.decision_guide.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const cardStyles = [
    {
      border: "border-indigo-200",
      bg: "bg-indigo-50/65",
      badge: "bg-indigo-600",
      text: "text-indigo-800",
      icon: Route,
    },
    {
      border: "border-violet-200",
      bg: "bg-violet-50/65",
      badge: "bg-violet-600",
      text: "text-violet-800",
      icon: Sparkles,
    },
    {
      border: "border-sky-200",
      bg: "bg-sky-50/65",
      badge: "bg-sky-600",
      text: "text-sky-800",
      icon: ListChecks,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-indigo-200 bg-white shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-l from-indigo-950 via-indigo-900 to-violet-800 px-5 py-5 text-white sm:px-6">
          <div className="pointer-events-none absolute -left-8 -top-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur">
              <Compass size={20} />
            </span>
            <div>
              <p className="text-[11px] font-black text-indigo-200">دليل اختيار التحويل</p>
              <h3 className="mt-1 text-lg font-black sm:text-xl">كيف نعالج حالة \(0/0\)؟</h3>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/55 px-4 py-3">
            <div className="flex items-start gap-3">
              <Brain size={18} className="mt-1 shrink-0 text-indigo-700" />
              <div>
                <p className="mb-1 text-xs font-black text-indigo-700">الفكرة الأساسية</p>
                <p className="text-sm font-bold leading-7 text-slate-700">
                  لا نستعمل طريقة واحدة دائمًا؛ ننظر إلى شكل العبارة ثم نختار التحويل الذي يزيل سبب ظهور الصفر على الصفر.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {guides.length > 0 && (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50/55 p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200">
              <Route size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">اختر الطريقة حسب شكل العبارة</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                ابحث أولًا عن العلامة المميزة، ثم طبّق التحويل المقابل لها.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {guides.map((item, index) => {
              const style = cardStyles[index] || cardStyles[0];
              const Icon = style.icon;

              return (
                <article
                  key={`zero-zero-guide-${index}`}
                  className={cn(
                    "group overflow-hidden rounded-[24px] border bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg",
                    style.border,
                  )}
                >
                  <div className={cn("border-b px-4 py-3", style.border, style.bg)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm", style.badge)}>
                          <Icon size={17} />
                        </span>
                        <span className={cn("text-xs font-black", style.text)}>الحالة {index + 1}</span>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 shadow-sm ring-1 ring-slate-200">
                        قرار مناسب
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <p className="mb-1.5 text-[11px] font-black text-slate-500">شكل العبارة</p>
                      <MathText className="text-sm font-black leading-7 text-slate-950">
                        {item.shape}
                      </MathText>
                    </div>

                    <div className={cn("rounded-2xl border p-3.5", style.border, style.bg)}>
                      <p className={cn("mb-1.5 text-[11px] font-black", style.text)}>الطريقة التي أختارها</p>
                      <MathText className="text-sm font-black leading-7 text-slate-900">
                        {item.method}
                      </MathText>
                    </div>

                    {item.example_signal && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/65 p-3.5">
                        <div className="mb-1.5 flex items-center gap-2 text-amber-800">
                          <Lightbulb size={15} />
                          <p className="text-[11px] font-black">علامة تساعدني على التعرّف</p>
                        </div>
                        <MathText className="text-sm font-bold leading-7 text-amber-950">
                          {item.example_signal}
                        </MathText>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {content.attention && (
        <InfoBox title="قاعدة الاختزال" tone="rose" icon={AlertTriangle} compact={false}>
          <MathText className="font-black leading-8">{content.attention}</MathText>
        </InfoBox>
      )}
    </div>
  );
}


function ZeroTimesInfinityMethodSelectionStep({ content = {} }) {
  const actions = Array.isArray(content.possible_actions)
    ? content.possible_actions.filter((item) => !isEmpty(item))
    : [];

  const actionStyles = [
    {
      border: "border-indigo-200",
      bg: "bg-indigo-50/65",
      badge: "bg-indigo-600",
      text: "text-indigo-800",
      icon: RefreshCw,
      label: "تحويل إلى خارج",
    },
    {
      border: "border-violet-200",
      bg: "bg-violet-50/65",
      badge: "bg-violet-600",
      text: "text-violet-800",
      icon: Sparkles,
      label: "تبسيط القوى",
    },
    {
      border: "border-sky-200",
      bg: "bg-sky-50/65",
      badge: "bg-sky-600",
      text: "text-sky-800",
      icon: Route,
      label: "علاقة جبرية",
    },
  ];

  return (
    <div className="space-y-5">
      {content.teacher && (
        <section className="overflow-hidden rounded-[28px] border border-indigo-200 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-gradient-to-l from-indigo-950 via-violet-900 to-fuchsia-800 px-5 py-5 text-white sm:px-6">
            <div className="pointer-events-none absolute -left-10 -top-14 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur">
                <Compass size={20} />
              </span>
              <div>
                <p className="text-[11px] font-black text-violet-200">اختيار طريقة المعالجة</p>
                <h3 className="mt-1 text-lg font-black sm:text-xl">كيف نعالج الشكل \(0\\times\\infty\)؟</h3>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/55 px-4 py-4">
              <Brain size={18} className="mt-1 shrink-0 text-indigo-700" />
              <div className="min-w-0">
                <p className="mb-1 text-xs font-black text-indigo-700">الفكرة الأساسية</p>
                <MathText className="text-sm font-bold leading-7 text-slate-700">
                  {content.teacher}
                </MathText>
              </div>
            </div>
          </div>
        </section>
      )}

      {content.example_pattern && (
        <section className="overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-sm">
          <div className="border-b border-violet-100 bg-gradient-to-l from-violet-50 to-white px-5 py-4">
            <div className="flex items-center gap-2 text-violet-800">
              <RefreshCw size={18} />
              <div>
                <h3 className="font-black text-slate-950">التحويل المرجعي</h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">نحوّل الجداء إلى خارج حتى ننتقل إلى شكل يمكن معالجته.</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="rounded-[22px] border border-violet-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-5 py-5 text-white shadow-lg shadow-violet-200/40">
              <MathText className="text-center text-base font-black leading-10 text-white sm:text-lg">
                {content.example_pattern}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {actions.length > 0 && (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50/55 p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200">
              <ListChecks size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">الطرق الممكنة</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">اختر التحويل الذي يناسب شكل العبارة المعطاة.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {actions.map((action, index) => {
              const style = actionStyles[index] || actionStyles[0];
              const Icon = style.icon;

              return (
                <article
                  key={`zero-times-infinity-action-${index}`}
                  className={cn(
                    "group overflow-hidden rounded-[24px] border bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg",
                    style.border,
                  )}
                >
                  <div className={cn("border-b px-4 py-3", style.border, style.bg)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm", style.badge)}>
                          <Icon size={17} />
                        </span>
                        <span className={cn("text-xs font-black", style.text)}>الخيار {index + 1}</span>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 shadow-sm ring-1 ring-slate-200">
                        {style.label}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className={cn("rounded-2xl border p-4", style.border, style.bg)}>
                      <p className={cn("mb-1.5 text-[11px] font-black", style.text)}>ماذا أفعل؟</p>
                      <MathText className="text-sm font-black leading-7 text-slate-900">
                        {action}
                      </MathText>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-[26px] border border-emerald-200 bg-emerald-50/45 p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            <CheckCircle2 size={19} />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-emerald-800">الهدف من التحويل</p>
            <p className="text-sm font-bold leading-7 text-emerald-950">
              نزيل الشكل غير المعيّن \(0\\times\\infty\)، ثم نحصل عادة على خارج من الشكل \(0/0\) أو \(\\infty/\\infty\) أو على عبارة مبسطة يمكن حساب نهايتها.
            </p>
          </div>
        </div>
      </section>

      {content.attention && (
        <InfoBox title="خطأ شائع" tone="rose" icon={AlertTriangle} compact={false}>
          <MathText className="font-black leading-8">{content.attention}</MathText>
        </InfoBox>
      )}
    </div>
  );
}

function MethodSelectionStep({ content = {} }) {
  const isZeroOverZeroSelection =
    Array.isArray(content.decision_guide) && content.decision_guide.length > 0;

  const isZeroTimesInfinitySelection =
    Array.isArray(content.possible_actions) &&
    content.possible_actions.length > 0 &&
    !isEmpty(content.example_pattern);

  if (isZeroOverZeroSelection) {
    return <ZeroOverZeroMethodSelectionStep content={content} />;
  }

  if (isZeroTimesInfinitySelection) {
    return <ZeroTimesInfinityMethodSelectionStep content={content} />;
  }

  return <InfinityRatioMethodSelectionStep content={content} />;
}


function ComparisonBoundingMethodStep({ content = {} }) {
  const guides = Array.isArray(content.decision_guide)
    ? content.decision_guide.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const guideMeta = [
    {
      title: "إثبات النهاية نحو الموجب",
      badge: "+∞",
      icon: ArrowRight,
      shell: "border-sky-200 bg-sky-50/60",
      iconClass: "bg-sky-600 text-white",
      badgeClass: "bg-sky-100 text-sky-800",
    },
    {
      title: "إثبات النهاية نحو السالب",
      badge: "−∞",
      icon: ArrowLeft,
      shell: "border-violet-200 bg-violet-50/60",
      iconClass: "bg-violet-600 text-white",
      badgeClass: "bg-violet-100 text-violet-800",
    },
    {
      title: "استعمال مبرهنة الحصر",
      badge: "نهاية منتهية",
      icon: Target,
      shell: "border-emerald-200 bg-emerald-50/55",
      iconClass: "bg-emerald-600 text-white",
      badgeClass: "bg-emerald-100 text-emerald-800",
    },
    {
      title: "دالة محدودة مع عامل صغير",
      badge: "القيمة المطلقة",
      icon: Compass,
      shell: "border-amber-200 bg-amber-50/60",
      iconClass: "bg-amber-500 text-white",
      badgeClass: "bg-amber-100 text-amber-800",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-indigo-100 bg-gradient-to-l from-indigo-50/90 via-white to-white shadow-sm">
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <Compass size={22} />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-indigo-600">دليل اتخاذ القرار</p>
            <h3 className="text-xl font-black leading-8 text-slate-950">
              متى أستعمل المقارنة أو الحصر؟
            </h3>
            <p className="mt-1 text-sm font-semibold leading-7 text-slate-600">
              اختر الهدف أولًا، ثم استعمل نوع المقارنة المناسب لإثبات النهاية.
            </p>
          </div>
        </div>
      </section>

      {guides.length > 0 && (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black text-indigo-600">أربع وضعيات أساسية</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">
                حدّد النتيجة التي تريد إثباتها
              </h3>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-200">
              {guides.length} اختيارات
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {guides.map((item, index) => {
              const meta = guideMeta[index] || guideMeta[2];
              const Icon = meta.icon;
              const target = item.target ?? item.goal ?? item.result ?? "";
              const method = item.method ?? item.action ?? item.description ?? "";

              return (
                <article
                  key={`comparison-guide-${index}`}
                  className={cn(
                    "group overflow-hidden rounded-[24px] border shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg",
                    meta.shell,
                  )}
                >
                  <div className="border-b border-current/10 bg-white/55 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm",
                        meta.iconClass,
                      )}>
                        <Icon size={19} />
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 shadow-sm ring-1 ring-slate-200/70">
                        الحالة {index + 1}
                      </span>
                    </div>

                    <h4 className="mt-4 font-black leading-7 text-slate-950">
                      {meta.title}
                    </h4>
                  </div>

                  <div className="space-y-3 p-4 sm:p-5">
                    {!isEmpty(target) && (
                      <div className="rounded-2xl border border-white/80 bg-white p-3.5 shadow-sm">
                        <p className="mb-2 text-[11px] font-black text-slate-500">
                          الهدف المطلوب
                        </p>
                        <div className={cn(
                          "inline-flex max-w-full rounded-xl px-3 py-2 text-sm font-black",
                          meta.badgeClass,
                        )}>
                          <MathText as="span" className="font-black">
                            {target}
                          </MathText>
                        </div>
                      </div>
                    )}

                    {!isEmpty(method) && (
                      <div className="rounded-2xl border border-white/80 bg-white/85 p-3.5 shadow-sm">
                        <div className="mb-2 flex items-center gap-2 text-indigo-700">
                          <CheckCircle2 size={16} />
                          <p className="text-[11px] font-black">ماذا أفعل؟</p>
                        </div>
                        <MathText className="text-sm font-bold leading-7 text-slate-700">
                          {method}
                        </MathText>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-[24px] border border-indigo-200 bg-indigo-50/55 p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Brain size={17} />
          </span>
          <div>
            <p className="mb-1 text-xs font-black text-indigo-700">قاعدة اختيار سريعة</p>
            <p className="text-sm font-bold leading-7 text-indigo-950">
              إذا أردت إثبات مالانهاية فقارن من جهة واحدة، وإذا أردت نهاية منتهية فاحصر بين طرفين لهما النهاية نفسها.
            </p>
          </div>
        </div>
      </section>

      {content.attention && (
        <InfoBox title="شرط أساسي للحصر" tone="rose" icon={AlertTriangle} compact={false}>
          <MathText className="font-black leading-8">{content.attention}</MathText>
        </InfoBox>
      )}
    </div>
  );
}


/* =========================================================
   Method step — compact formulas + explicit example
========================================================= */

function MethodFormulaGrid({
  items,
  title = "تحويلات مفيدة",
}) {
  const formulas = Array.isArray(items)
    ? items.filter((item) => !isEmpty(item))
    : [];

  if (formulas.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[24px] border border-violet-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-violet-100 bg-gradient-to-l from-violet-50/90 via-white to-white px-4 py-3.5 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
          <Sparkles size={17} />
        </span>

        <div>
          <p className="text-[10px] font-black text-violet-600">
            أدوات سريعة
          </p>
          <h3 className="text-sm font-black text-slate-950 sm:text-base">
            {title}
          </h3>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3 p-4 sm:p-5",
          formulas.length === 1 && "grid-cols-1",
          formulas.length === 2 && "sm:grid-cols-2",
          formulas.length >= 3 && "sm:grid-cols-2 xl:grid-cols-4",
        )}
      >
        {formulas.map((formula, index) => (
          <div
            key={`method-formula-${index}`}
            className="group flex min-h-[82px] items-center justify-center rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50/50 to-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
          >
            <MathJax dynamic hideUntilTypeset="first">
              <div
                dir="ltr"
                className="w-full overflow-x-auto text-center text-[15px] font-black text-slate-950 sm:text-base [&_mjx-container]:mx-auto [&_mjx-container]:inline-block [&_mjx-container]:max-w-full"
              >
                {`\\(${getPureMathExpression(getDisplayText(formula) || formula)}\\)`}
              </div>
            </MathJax>
          </div>
        ))}
      </div>
    </section>
  );
}


function MethodExplicitExample({
  example,
  title = "مثال تطبيقي",
}) {
  if (
    !example ||
    typeof example !== "object" ||
    Array.isArray(example)
  ) {
    return null;
  }

  const problem =
    example.problem ||
    example.question ||
    example.statement ||
    example.exercise ||
    "";

  const rawSteps =
    example.solution ||
    example.steps ||
    example.solution_steps ||
    example.details ||
    [];

  const steps = Array.isArray(rawSteps)
    ? rawSteps.filter((item) => !isEmpty(item))
    : !isEmpty(rawSteps)
      ? [rawSteps]
      : [];

  const finalAnswer =
    example.final_answer ||
    example.answer ||
    example.result ||
    example.conclusion ||
    "";

  if (!problem && steps.length === 0 && !finalAnswer) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-[26px] border border-indigo-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-indigo-100 bg-gradient-to-l from-indigo-50/90 via-white to-white px-4 py-4 sm:px-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/15">
          <Brain size={18} />
        </span>

        <div>
          <p className="text-[10px] font-black text-indigo-600">
            تطبيق مباشر
          </p>
          <h3 className="font-black text-slate-950">
            {title}
          </h3>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {problem && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="mb-2 text-[11px] font-black text-slate-500">
              المطلوب
            </p>

            <MathText className="text-sm font-black leading-8 text-slate-950 sm:text-[15px]">
              {problem}
            </MathText>
          </div>
        )}

        {steps.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ListChecks size={17} className="text-indigo-600" />
              <h4 className="text-sm font-black text-slate-950">
                خطوات الحل
              </h4>
            </div>

            <div className="space-y-2.5">
              {steps.map((step, index) => (
                <div
                  key={`method-example-step-${index}`}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1 pt-0.5">
                    {typeof step === "object" && step !== null ? (
                      <StructuredValue
                        value={step}
                        depth={1}
                      />
                    ) : (
                      <MathText className="text-sm font-semibold leading-7 text-slate-700">
                        {String(step)}
                      </MathText>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {finalAnswer && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <CheckCircle2
              size={18}
              className="mt-1 shrink-0 text-emerald-600"
            />

            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-black text-emerald-700">
                النتيجة
              </p>
              <MathText className="text-sm font-black leading-7 text-emerald-950">
                {finalAnswer}
              </MathText>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}


function MethodStep({ content = {} }) {
  const methods = Array.isArray(content.methods)
    ? content.methods.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          !isEmpty(item),
      )
    : [];

  const recommendedForStudent =
    content.recommended_for_student ||
    content.student_recommendation ||
    content.recommended_method ||
    "";

  const isComparisonBoundingMethod =
    Array.isArray(content.decision_guide) &&
    content.decision_guide.length > 0 &&
    content.decision_guide.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        "target" in item &&
        "method" in item,
    );

  if (isComparisonBoundingMethod) {
    return <ComparisonBoundingMethodStep content={content} />;
  }

  const isFunctionTypeMethod =
    Array.isArray(content.function_types) &&
    content.function_types.length > 0 &&
    content.function_types.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        "type" in item &&
        "initial_rule" in item,
    );

  if (isFunctionTypeMethod) {
    return <FunctionTypeMethodStep content={content} />;
  }

  const isDirectCalculationMethod =
    Array.isArray(content.algorithm) &&
    Array.isArray(content.determined_examples);

  if (isDirectCalculationMethod) {
    return <DirectCalculationMethodStep content={content} />;
  }

  const isLimitPositionMethod =
    Array.isArray(content.cases) &&
    content.cases.length > 0 &&
    content.cases.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        "position" in item &&
        "first_action" in item,
    );

  if (isLimitPositionMethod) {
    return <LimitPositionMethodStep content={content} />;
  }
  const algorithmSource =
    content.algorithm ??
    content.steps ??
    content.method ??
    content.method_steps ??
    content.procedure ??
    [];

  const algorithm = Array.isArray(algorithmSource)
    ? algorithmSource
    : algorithmSource
      ? [algorithmSource]
      : [];

  const usefulTransformations = Array.isArray(content.useful_transformations)
    ? content.useful_transformations.filter((item) => !isEmpty(item))
    : !isEmpty(content.useful_transformations)
      ? [content.useful_transformations]
      : [];

  const usefulIdentitiesSource =
    content.useful_identities ??
    content.identities ??
    content.formulas ??
    content.rules ??
    [];

  const usefulIdentities = Array.isArray(usefulIdentitiesSource)
    ? usefulIdentitiesSource.filter((item) => !isEmpty(item))
    : usefulIdentitiesSource &&
        typeof usefulIdentitiesSource === "object"
      ? Object.entries(usefulIdentitiesSource).map(([key, value]) => ({
          label: fieldLabel(key),
          value,
        }))
      : !isEmpty(usefulIdentitiesSource)
        ? [usefulIdentitiesSource]
        : [];

  const conclusionTemplates =
    content.conclusion_templates ??
    content.conclusion_template ??
    content.answer_template ??
    [];

  const normalizedConclusions = Array.isArray(conclusionTemplates)
    ? conclusionTemplates
    : conclusionTemplates
      ? [conclusionTemplates]
      : [];

  const quickCheck = content.quick_check;

  const conditions = Array.isArray(content.conditions)
    ? content.conditions.filter(Boolean)
    : [];

  const equivalentMethod =
    content.equivalent_method ||
    content.alternative_method ||
    content.other_method ||
    "";

  const signAnalysis = Array.isArray(content.sign_analysis)
    ? content.sign_analysis.filter(Boolean)
    : [];

  const result =
    content.result && typeof content.result === "object"
      ? content.result
      : null;

  const roots = result
    ? Array.isArray(result.zero_at)
      ? result.zero_at
      : Array.isArray(result.roots)
        ? result.roots
        : Array.isArray(result.zeros)
          ? result.zeros
          : []
    : [];

  const positiveOn = result
    ? Array.isArray(result.positive_on)
      ? result.positive_on
      : result.positive_on
        ? [result.positive_on]
        : []
    : [];

  const negativeOn = result
    ? Array.isArray(result.negative_on)
      ? result.negative_on
      : result.negative_on
        ? [result.negative_on]
        : []
    : [];

  const zeroOn = result
    ? Array.isArray(result.zero_on)
      ? result.zero_on
      : result.zero_on
        ? [result.zero_on]
        : []
    : [];

  const hasSignStudy =
    !isEmpty(content.example_expression) ||
    signAnalysis.length > 0 ||
    roots.length > 0 ||
    positiveOn.length > 0 ||
    negativeOn.length > 0 ||
    zeroOn.length > 0;

  const signItemFormula = (item) =>
    item?.factor ||
    item?.expression ||
    item?.function ||
    item?.term ||
    item?.condition ||
    item?.formula ||
    "";

  const signItemRoot = (item) =>
    item?.root ??
    item?.zero ??
    item?.critical_value ??
    item?.vanishes_at ??
    "";

  const signItemMeaning = (item) =>
    item?.meaning ||
    item?.sign ||
    item?.analysis ||
    item?.description ||
    item?.conclusion ||
    "";

  // أي حقل جديد في JSON لا يملك تصميمًا خاصًا هنا يجب ألا يختفي.
  // هذا مهم لمحاور الهندسة في الفضاء التي تستعمل حقولًا مثل:
  // mini_example / worked_check / equivalent_form / shortcut_note / example_rule ...
  const methodHandledKeys = new Set([
    "teacher",
    "introduction",
    "method_goal",
    "methods",
    "recommended_for_student",
    "student_recommendation",
    "recommended_method",
    "central_idea",
    "example_expression",
    "sign_analysis",
    "result",
    "conditions",
    "equivalent_method",
    "alternative_method",
    "other_method",
    "when_to_use",
    "memory_tip",
    "algorithm",
    "steps",
    "method",
    "method_steps",
    "procedure",
    "useful_transformations",
    "useful_transformations_title",
    "useful_identities",
    "identities",
    "formulas",
    "rules",
    "formulas_title",
    "rules_title",
    "relations",
    "relations_title",
    "conclusion_templates",
    "conclusion_template",
    "answer_template",
    "why",
    "how_to_think",
    "teacher_tip",
    "attention",
    "warning",
    "important_warning",
    "takeaway",
    "general_rule",
    "worked_example",
    "alternative_factorization",
    "quick_check",
    "graph_data",
  ]);

  const remainingMethodContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !methodHandledKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5">
      {(content.teacher || content.introduction) && (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-l from-indigo-50/80 via-white to-white p-4 shadow-sm">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-black text-indigo-800">
            <Brain size={14} />
            شرح الطريقة
          </div>

          <MathText className="text-sm font-semibold leading-7 text-slate-700 sm:text-[15px]">
            {content.teacher || content.introduction}
          </MathText>
        </div>
      )}

      {content.method_goal && (
        <InfoBox title="هدف الطريقة" tone="indigo" icon={Target}>
          <MathText className="font-black">
            {content.method_goal}
          </MathText>
        </InfoBox>
      )}

      {methods.length > 0 && (
        <section className="rounded-[26px] border border-emerald-100 bg-gradient-to-b from-emerald-50/70 to-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
              <Route size={19} />
            </div>

            <div>
              <p className="text-[11px] font-black text-emerald-700">
                الطرق الممكنة
              </p>
              <h3 className="font-black text-slate-950">
                كيف نجد النتيجة؟
              </h3>
            </div>
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-4",
              methods.length > 1 && "lg:grid-cols-2",
            )}
          >
            {methods.map((method, methodIndex) => (
              <article
                key={method.id || method.name || `method-${methodIndex}`}
                className="overflow-hidden rounded-[22px] border border-emerald-100 bg-white shadow-sm"
              >
                <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white">
                    {methodIndex + 1}
                  </span>

                  <MathText
                    as="h4"
                    className="font-black text-emerald-950"
                  >
                    {method.name || method.title || `الطريقة ${methodIndex + 1}`}
                  </MathText>
                </div>

                <div className="p-4">
                  <MathText className="text-sm font-semibold leading-8 text-slate-700">
                    {method.description ||
                      method.explanation ||
                      method.method ||
                      method.text ||
                      ""}
                  </MathText>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {recommendedForStudent && (
        <InfoBox
          title="الطريقة الموصى بها للتلميذ"
          tone="amber"
          icon={Lightbulb}
          compact={false}
        >
          <MathText className="font-black leading-8">
            {recommendedForStudent}
          </MathText>
        </InfoBox>
      )}

      {content.central_idea && (
        <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm">
          <Sparkles
            size={18}
            className="mt-1 shrink-0 text-violet-600"
          />

          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-violet-700">
              الفكرة الأساسية
            </p>

            <MathText className="text-sm font-black leading-7 text-slate-900">
              {content.central_idea}
            </MathText>
          </div>
        </div>
      )}

      {hasSignStudy && (
        <section className="rounded-[26px] border border-slate-200 bg-slate-50/65 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <ListChecks size={18} className="text-indigo-600" />

            <div>
              <h3 className="font-black text-slate-950">
                دراسة إشارة المشتقة خطوة بخطوة
              </h3>

              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                نحلل العبارة، نحدد جذور العوامل، ثم نستنتج إشارة الجداء.
              </p>
            </div>
          </div>

          {content.example_expression && (
            <div className="mb-4 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-black text-indigo-700">
                العبارة التي ندرس إشارتها
              </p>

              <div className="rounded-xl bg-gradient-to-l from-slate-950 to-indigo-950 px-4 py-4 text-white">
                <MixedArabicMath
                  value={content.example_expression}
                  dark
                />
              </div>
            </div>
          )}

          <SignTable
            expression={content.example_expression}
            signAnalysis={signAnalysis}
            result={result}
          />

          {result && (
            <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm font-bold text-slate-800">
              <span className="font-black text-indigo-700">
                القراءة:
              </span>{" "}
              المشتقة موجبة خارج الجذور، وسالبة بينهما، وتنعدم عند الجذور.
            </div>
          )}

        </section>
      )}

      {conditions.length > 0 && (
        <section className="rounded-[26px] border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <ListChecks size={19} />
            </div>

            <div>
              <p className="text-[11px] font-black text-indigo-600">
                شروط الطريقة
              </p>

              <h3 className="font-black text-slate-950">
                تحقق من الشروط المطلوبة
              </h3>
            </div>
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-3",
              conditions.length >= 2 && "md:grid-cols-2",
              conditions.length >= 3 && "xl:grid-cols-3",
            )}
          >
            {conditions.map((item, index) => (
              <article
                key={
                  item?.condition ||
                  `method-condition-${index}`
                }
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                    {index + 1}
                  </span>

                  <p className="text-sm font-black text-slate-900">
                    الشرط {index + 1}
                  </p>
                </div>

                <div className="space-y-3 p-4">
                  {item?.condition && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-3">
                      <MixedArabicMath
                        value={item.condition}
                        compact
                      />
                    </div>
                  )}

                  {item?.meaning && (
                    <MathText className="text-sm font-semibold leading-7 text-slate-700">
                      {item.meaning}
                    </MathText>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {equivalentMethod && (
        <InfoBox
          title="طريقة مكافئة"
          tone="emerald"
          icon={RefreshCw}
        >
          <MathText className="text-sm font-semibold leading-7">
            {equivalentMethod}
          </MathText>
        </InfoBox>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {content.when_to_use && (
          <InfoBox
            title="متى نستعمل هذه الطريقة؟"
            tone="sky"
            icon={Compass}
          >
            <MathText className="font-bold">
              {content.when_to_use}
            </MathText>
          </InfoBox>
        )}

        {content.memory_tip && (
          <InfoBox
            title="حيلة للحفظ"
            tone="amber"
            icon={Lightbulb}
          >
            <MathText className="font-bold">
              {content.memory_tip}
            </MathText>
          </InfoBox>
        )}
      </div>

      {algorithm.length > 0 && (
        <section className="rounded-[26px] border border-indigo-100 bg-gradient-to-b from-indigo-50/70 to-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
              <Route size={18} />
            </div>

            <div>
              <p className="text-[11px] font-black text-indigo-600">
                خطوات مرتبة
              </p>

              <h3 className="font-black text-slate-950">
                اتبع المنهجية خطوة بخطوة
              </h3>
            </div>
          </div>

          <MethodTimeline items={algorithm} />
        </section>
      )}

      {usefulTransformations.length > 0 && (
        <MethodFormulaGrid
          items={usefulTransformations}
          title={
            content.useful_transformations_title ||
            "تحويلات مفيدة قبل حساب النهاية"
          }
        />
      )}

      {usefulIdentities.length > 0 && (
        <RelationCards
          items={usefulIdentities}
          title={
            content.formulas_title ||
            content.rules_title ||
            "قوانين وعلاقات مفيدة"
          }
        />
      )}

      {Array.isArray(content.relations) &&
        content.relations.length > 0 && (
          <RelationCards
            items={content.relations}
            title={
              content.relations_title ||
              "العلاقات الأساسية"
            }
          />
        )}

      {normalizedConclusions.length > 0 && (
        <RevealBox
          label="قوالب جاهزة لكتابة الخاتمة"
          tone="emerald"
        >
          <BulletList
            items={normalizedConclusions}
            tone="emerald"
            icon={CheckCircle2}
          />
        </RevealBox>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {content.why && (
          <InfoBox
            title="لماذا تنجح هذه الطريقة؟"
            tone="amber"
            icon={Lightbulb}
          >
            <MathText className="font-bold">
              {content.why}
            </MathText>
          </InfoBox>
        )}

        {content.how_to_think && (
          <InfoBox
            title="كيف أفكر؟"
            tone="sky"
            icon={Brain}
          >
            <MathText className="font-bold">
              {content.how_to_think}
            </MathText>
          </InfoBox>
        )}

        {content.teacher_tip && (
          <InfoBox
            title="نصيحة الأستاذ"
            tone="amber"
            icon={Lightbulb}
          >
            <MathText className="font-bold">
              {content.teacher_tip}
            </MathText>
          </InfoBox>
        )}

        {(content.attention ||
          content.warning ||
          content.important_warning) && (
          <InfoBox
            title="انتبه"
            tone="rose"
            icon={AlertTriangle}
          >
            <MathText className="font-bold">
              {content.attention ||
                content.warning ||
                content.important_warning}
            </MathText>
          </InfoBox>
        )}
      </div>

      {content.takeaway && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-50 to-white p-4 shadow-sm">
          <CheckCircle2
            size={19}
            className="mt-1 shrink-0 text-indigo-600"
          />

          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-indigo-700">
              الخلاصة
            </p>

            <MathText className="text-sm font-black leading-7 text-slate-900">
              {content.takeaway}
            </MathText>
          </div>
        </div>
      )}

      {content.general_rule && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-black text-slate-950">
            <Sparkles
              size={19}
              className="text-indigo-600"
            />
            القاعدة العامة
          </h3>

          <div className="rounded-2xl border border-indigo-100 bg-white p-4">
            <MixedArabicMath value={content.general_rule} />
          </div>
        </div>
      )}

      {content.worked_example &&
        content.worked_example !== content.example && (
          <WorkedExample
            example={content.worked_example}
            tone="indigo"
          />
        )}

      {content.alternative_factorization && (
        <RevealBox
          label="طريقة أو تحويل بديل"
          tone="violet"
        >
          <MixedArabicMath
            value={content.alternative_factorization}
          />
        </RevealBox>
      )}

      {quickCheck?.question && (
        <RevealBox
          label={quickCheck.question}
          tone="emerald"
        >
          <MathText className="font-black">
            {quickCheck.answer ||
              "لم تُرسل الإجابة من الخادم."}
          </MathText>
        </RevealBox>
      )}

      {content.graph_data && (
        <GraphRenderer graph={content.graph_data} />
      )}

      {Object.keys(remainingMethodContent).length > 0 && (
        <section className="rounded-[26px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-indigo-700">
            <Sparkles size={17} />
            <h3 className="font-black text-slate-950">تفاصيل إضافية</h3>
          </div>
          <GenericObjectStep content={remainingMethodContent} />
        </section>
      )}
    </div>
  );
}


function VariationTable({ table }) {
  if (!table || typeof table !== "object") return null;

  const xValues = Array.isArray(table.x)
    ? table.x.filter((value) => value !== undefined)
    : [];

  const derivativeValues = Array.isArray(table.f_prime)
    ? table.f_prime.filter((value) => value !== undefined)
    : [];

  const functionValues = Array.isArray(table.f)
    ? table.f.filter((value) => value !== undefined)
    : [];

  if (xValues.length < 2 || functionValues.length === 0) {
    return null;
  }

  const pointCount = xValues.length;
  const intervalCount = pointCount - 1;

  const normalizeText = (value) =>
    String(value ?? "")
      .replace(/[−–—]/g, "-")
      .replace(/\s+/g, "")
      .trim();

  const isForbiddenMarker = (value) =>
    ["||", "║", "∥", "غيرمعرفة", "غيرمعرف"].includes(
      normalizeText(value),
    );

  const toLatex = (value) => {
    const raw = String(value ?? "").trim();

    if (!raw) return "";

    return raw
      .replace(/[−–—]/g, "-")
      .replace(/\+∞/g, "+\\infty")
      .replace(/-∞/g, "-\\infty")
      .replace(/∞/g, "\\infty")
      .replace(/√\s*([0-9]+)/g, "\\sqrt{$1}")
      .replace(/([0-9])\s*-\s*\\sqrt/g, "$1-\\sqrt")
      .trim();
  };

  function MathValue({
    value,
    className = "",
  }) {
    const latex = toLatex(value);
    if (!latex) return null;

    return (
      <MathJax dynamic hideUntilTypeset="first">
        <span
          dir="ltr"
          className={cn(
            "inline-flex max-w-full whitespace-nowrap font-black [unicode-bidi:isolate] [&_mjx-container]:m-0",
            className,
          )}
        >
          {`\\(${latex}\\)`}
        </span>
      </MathJax>
    );
  }

  /*
   * يبني بيانات صف f انطلاقًا من تسلسل مثل:
   *
   * [
   *   "-∞", "↗", "2-2√2", "↘",
   *   "-∞", "||", "+∞",
   *   "↘", "2+2√2", "↗", "+∞"
   * ]
   *
   * عند وجود ||:
   * - القيمة قبله هي النهاية اليسرى.
   * - القيمة بعده هي النهاية اليمنى.
   */
  const pointData = Array.from(
    { length: pointCount },
    () => ({
      value: "",
      forbidden: false,
      leftLimit: "",
      rightLimit: "",
    }),
  );

  const intervalDirections = Array.from(
    { length: intervalCount },
    () => "",
  );

  let tokenIndex = 0;

  pointData[0].value = functionValues[tokenIndex] ?? "";
  tokenIndex += 1;

  for (
    let intervalIndex = 0;
    intervalIndex < intervalCount;
    intervalIndex += 1
  ) {
    intervalDirections[intervalIndex] =
      functionValues[tokenIndex] ?? "";
    tokenIndex += 1;

    const nextValue = functionValues[tokenIndex] ?? "";
    const possibleSeparator =
      functionValues[tokenIndex + 1] ?? "";

    if (isForbiddenMarker(possibleSeparator)) {
      pointData[intervalIndex + 1] = {
        value: "",
        forbidden: true,
        leftLimit: nextValue,
        rightLimit: functionValues[tokenIndex + 2] ?? "",
      };

      tokenIndex += 3;
    } else {
      pointData[intervalIndex + 1].value = nextValue;
      tokenIndex += 1;
    }
  }

  const derivativeAtPoints = Array.from(
    { length: pointCount },
    () => "",
  );

  const derivativeOnIntervals = Array.from(
    { length: intervalCount },
    () => "",
  );

  /*
   * البنية المعتادة:
   * ["+", "0", "-", "غير معرفة", "-", "0", "+"]
   *
   * أي:
   * مجال، نقطة داخلية، مجال، نقطة داخلية...
   */
  if (derivativeValues.length === pointCount * 2 - 3) {
    let derivativeIndex = 0;

    for (
      let intervalIndex = 0;
      intervalIndex < intervalCount;
      intervalIndex += 1
    ) {
      derivativeOnIntervals[intervalIndex] =
        derivativeValues[derivativeIndex] ?? "";
      derivativeIndex += 1;

      if (intervalIndex < intervalCount - 1) {
        derivativeAtPoints[intervalIndex + 1] =
          derivativeValues[derivativeIndex] ?? "";
        derivativeIndex += 1;
      }
    }
  } else if (derivativeValues.length === pointCount) {
    for (let index = 0; index < pointCount; index += 1) {
      derivativeAtPoints[index] =
        derivativeValues[index] ?? "";
    }

    for (
      let intervalIndex = 0;
      intervalIndex < intervalCount;
      intervalIndex += 1
    ) {
      derivativeOnIntervals[intervalIndex] =
        derivativeValues[
          intervalIndex === 0
            ? 0
            : Math.min(
                intervalIndex + 1,
                derivativeValues.length - 1,
              )
        ] ?? "";
    }
  } else {
    for (
      let intervalIndex = 0;
      intervalIndex < intervalCount;
      intervalIndex += 1
    ) {
      derivativeOnIntervals[intervalIndex] =
        derivativeValues[intervalIndex] ?? "";
    }
  }

  const isIncreasing = (value) =>
    ["↗", "↑", "+"].includes(
      String(value ?? "").trim(),
    );

  const isDecreasing = (value) =>
    ["↘", "↓", "-", "−"].includes(
      String(value ?? "").trim(),
    );

  const getRegularPointPosition = (pointIndex) => {
    const before =
      pointIndex > 0
        ? intervalDirections[pointIndex - 1]
        : "";

    const after =
      pointIndex < intervalCount
        ? intervalDirections[pointIndex]
        : "";

    if (isIncreasing(before) && isDecreasing(after)) {
      return "top";
    }

    if (isDecreasing(before) && isIncreasing(after)) {
      return "bottom";
    }

    if (pointIndex === 0) {
      return isIncreasing(after) ? "bottom" : "top";
    }

    if (pointIndex === pointCount - 1) {
      return isIncreasing(before) ? "top" : "bottom";
    }

    return "middle";
  };

  const isInteriorPoint = (pointIndex) =>
    pointIndex > 0 && pointIndex < pointCount - 1;

  const visualColumns = [];

  xValues.forEach((_, pointIndex) => {
    visualColumns.push({
      type: "point",
      pointIndex,
    });

    if (pointIndex < intervalCount) {
      visualColumns.push({
        type: "interval",
        intervalIndex: pointIndex,
      });
    }
  });

  const gridTemplateColumns = [
    "112px",
    ...visualColumns.map((column) => {
      if (column.type === "interval") {
        return "minmax(175px, 1fr)";
      }

      const data = pointData[column.pointIndex];

      if (data?.forbidden) {
        return "minmax(104px, 118px)";
      }

      if (isInteriorPoint(column.pointIndex)) {
        return "minmax(124px, 150px)";
      }

      return "minmax(86px, 102px)";
    }),
  ].join(" ");

  const regularRootClass =
    "border-x-2 border-slate-950";

  const forbiddenRootClass =
    "border-x-[5px] border-double border-rose-600 bg-rose-50/35";

  const DerivativeSign = ({ value }) => {
    const normalized = String(value ?? "")
      .replace(/-/g, "−")
      .trim();

    if (!normalized || isForbiddenMarker(normalized)) {
      return null;
    }

    return (
      <span
        className={cn(
          "text-xl font-black",
          normalized === "+"
            ? "text-emerald-700"
            : normalized === "0"
              ? "text-slate-950"
              : "text-rose-700",
        )}
      >
        {normalized}
      </span>
    );
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <ListChecks
          size={18}
          className="text-indigo-600"
        />

        <h3 className="font-black text-slate-950">
          جدول التغيرات
        </h3>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border-[3px] border-slate-950 bg-white shadow-sm">
        <div
          dir="ltr"
          className="w-max min-w-full"
          style={{
            display: "grid",
            gridTemplateColumns,
          }}
        >
          {/* سطر x */}
          <div className="flex min-h-14 items-center justify-center border-b-[3px] border-r-[3px] border-slate-950 bg-white">
            <MathValue
              value="x"
              className="text-lg text-rose-700"
            />
          </div>

          {visualColumns.map((column, index) => {
            if (column.type === "interval") {
              return (
                <div
                  key={`x-interval-${index}`}
                  className="min-h-14 border-b-[3px] border-slate-950 bg-white"
                />
              );
            }

            const data = pointData[column.pointIndex];
            const interior = isInteriorPoint(
              column.pointIndex,
            );

            return (
              <div
                key={`x-point-${index}`}
                className={cn(
                  "flex min-h-14 items-center justify-center border-b-[3px] border-slate-950 bg-white px-2",
                  interior &&
                    (data?.forbidden
                      ? forbiddenRootClass
                      : regularRootClass),
                )}
              >
                <MathValue
                  value={xValues[column.pointIndex]}
                  className="text-base text-slate-950 sm:text-lg"
                />
              </div>
            );
          })}

          {/* سطر f'(x) */}
          <div className="flex min-h-14 items-center justify-center border-b-[3px] border-r-[3px] border-slate-950 bg-white">
            <MathValue
              value="f'(x)"
              className="text-lg text-emerald-700"
            />
          </div>

          {visualColumns.map((column, index) => {
            if (column.type === "interval") {
              return (
                <div
                  key={`fp-interval-${index}`}
                  className="flex min-h-14 items-center justify-center border-b-[3px] border-slate-950 bg-white"
                >
                  <DerivativeSign
                    value={
                      derivativeOnIntervals[
                        column.intervalIndex
                      ]
                    }
                  />
                </div>
              );
            }

            const data = pointData[column.pointIndex];
            const interior = isInteriorPoint(
              column.pointIndex,
            );

            return (
              <div
                key={`fp-point-${index}`}
                className={cn(
                  "flex min-h-14 items-center justify-center border-b-[3px] border-slate-950 bg-white",
                  interior &&
                    (data?.forbidden
                      ? forbiddenRootClass
                      : regularRootClass),
                )}
              >
                {!data?.forbidden && (
                  <DerivativeSign
                    value={
                      derivativeAtPoints[
                        column.pointIndex
                      ]
                    }
                  />
                )}
              </div>
            );
          })}

          {/* سطر f(x) */}
          <div className="flex min-h-[188px] items-center justify-center border-r-[3px] border-slate-950 bg-white">
            <MathValue
              value="f(x)"
              className="text-lg text-indigo-800"
            />
          </div>

          {visualColumns.map((column, index) => {
            if (column.type === "interval") {
              const direction =
                intervalDirections[
                  column.intervalIndex
                ];

              const increasing =
                isIncreasing(direction);

              const decreasing =
                isDecreasing(direction);

              const markerId =
                `variation-arrow-${column.intervalIndex}`;

              const leftPoint =
                pointData[column.intervalIndex];

              const rightPoint =
                pointData[column.intervalIndex + 1];

              const startLimit =
                leftPoint?.forbidden
                  ? leftPoint.rightLimit
                  : "";

              const endLimit =
                rightPoint?.forbidden
                  ? rightPoint.leftLimit
                  : "";

              return (
                <div
                  key={`f-interval-${index}`}
                  className="relative min-h-[188px] overflow-hidden bg-white"
                >
                  {(increasing || decreasing) && (
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="absolute inset-[20px] h-[calc(100%-40px)] w-[calc(100%-40px)] overflow-visible"
                      aria-hidden="true"
                    >
                      <defs>
                        <marker
                          id={markerId}
                          markerWidth="5"
                          markerHeight="5"
                          refX="4.2"
                          refY="2.5"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path
                            d="M0,0 L5,2.5 L0,5 z"
                            fill="#1e3a8a"
                          />
                        </marker>
                      </defs>

                      <line
                        x1="4"
                        y1={
                          increasing ? "92" : "8"
                        }
                        x2="96"
                        y2={
                          increasing ? "8" : "92"
                        }
                        stroke="#1e3a8a"
                        strokeWidth="3"
                        strokeLinecap="round"
                        markerEnd={`url(#${markerId})`}
                      />
                    </svg>
                  )}

                  {startLimit && (
                    <div
                      className={cn(
                        "absolute left-2 rounded-md bg-white/95 px-1.5 py-1 shadow-sm",
                        increasing ? "bottom-2" : "top-2",
                      )}
                    >
                      <MathValue
                        value={startLimit}
                        className="text-base text-slate-950"
                      />
                    </div>
                  )}

                  {endLimit && (
                    <div
                      className={cn(
                        "absolute right-2 rounded-md bg-white/95 px-1.5 py-1 shadow-sm",
                        increasing ? "top-2" : "bottom-2",
                      )}
                    >
                      <MathValue
                        value={endLimit}
                        className="text-base text-slate-950"
                      />
                    </div>
                  )}
                </div>
              );
            }

            const pointIndex = column.pointIndex;
            const data = pointData[pointIndex];
            const interior = isInteriorPoint(pointIndex);

            if (data?.forbidden) {
              return (
                <div
                  key={`f-forbidden-${index}`}
                  className={cn(
                    "relative min-h-[188px]",
                    forbiddenRootClass,
                  )}
                  aria-label="قيمة ممنوعة"
                />
              );
            }

            const position =
              getRegularPointPosition(pointIndex);

            return (
              <div
                key={`f-point-${index}`}
                className={cn(
                  "relative min-h-[188px] bg-white",
                  interior && regularRootClass,
                )}
              >
                <div
                  className={cn(
                    "absolute inset-x-1 flex justify-center",
                    position === "top" && "top-3",
                    position === "bottom" && "bottom-3",
                    position === "middle" &&
                      "top-1/2 -translate-y-1/2",
                  )}
                >
                  <div className="rounded-md bg-white/95 px-1.5 py-1">
                    <MathValue
                      value={data?.value}
                      className="text-base text-slate-950"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WorkedExampleStep({ content = {} }) {
  const rawSteps =
    content.steps ??
    content.solution_steps ??
    content.solution ??
    [];

  const steps = Array.isArray(rawSteps)
    ? rawSteps.filter((item) => !isEmpty(item))
    : !isEmpty(rawSteps)
      ? [rawSteps]
      : [];

  const verification = Array.isArray(content.verification)
    ? content.verification.filter(Boolean)
    : [];

  const examples = Array.isArray(content.examples)
    ? content.examples.filter(Boolean)
    : [];

  const manuallyRenderedKeys = new Set([
    "statement",
    "teacher",
    "steps",
    "solution_steps",
    "solution",
    "examples",
    "variation_table",
    "graph",
    "final_conclusion",
    "verification",
    "why",
    "how_to_think",
    "attention",
    "takeaway",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5">
      {content.statement && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm">
          <p className="mb-2 text-xs font-black text-indigo-700">
            نص المثال
          </p>

          <MathText className="text-sm font-black leading-7 text-slate-900 sm:text-[15px]">
            {content.statement}
          </MathText>
        </div>
      )}

      {content.teacher && (
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-l from-sky-50/80 via-white to-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-sky-700">
            <BookOpen size={16} />
            شرح الأستاذ
          </div>

          <MathText className="text-sm font-semibold leading-7 text-slate-700">
            {content.teacher}
          </MathText>
        </div>
      )}

      {examples.length > 0 && (
        <section className="space-y-3">
          <div className="mb-3 flex items-center gap-2">
            <GraduationCap size={18} className="text-indigo-600" />
            <h3 className="font-black text-slate-950">
              أمثلة مباشرة
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {examples.map((exampleItem, index) => {
              const isObject =
                exampleItem &&
                typeof exampleItem === "object" &&
                !Array.isArray(exampleItem);

              if (!isObject) {
                return (
                  <article
                    key={`worked-example-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <MathText className="text-sm font-semibold leading-7 text-slate-700">
                      {String(exampleItem)}
                    </MathText>
                  </article>
                );
              }

              const question =
                exampleItem.question ||
                exampleItem.statement ||
                exampleItem.prompt ||
                "";

              const reasoning =
                exampleItem.reasoning ||
                exampleItem.explanation ||
                exampleItem.method ||
                exampleItem.why ||
                "";

              const answer =
                exampleItem.answer ||
                exampleItem.result ||
                exampleItem.final_answer ||
                exampleItem.solution ||
                "";

              const knownKeys = new Set([
                "question",
                "statement",
                "prompt",
                "reasoning",
                "explanation",
                "method",
                "why",
                "answer",
                "result",
                "final_answer",
                "solution",
              ]);

              const extraFields = Object.fromEntries(
                Object.entries(exampleItem).filter(
                  ([key, value]) =>
                    !knownKeys.has(key) &&
                    !isEmpty(value) &&
                    !isTechnicalPresentationField(key),
                ),
              );

              return (
                <article
                  key={exampleItem.id || `worked-example-${index}`}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                >
                  {question && (
                    <div className="flex items-start gap-3 border-b border-indigo-100 bg-indigo-50/70 p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[11px] font-black text-indigo-700">
                          السؤال
                        </p>
                        <MathText className="text-sm font-black leading-7 text-slate-950">
                          {question}
                        </MathText>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 p-4">
                    {reasoning && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                        <p className="mb-1 text-[11px] font-black text-amber-700">
                          طريقة التفكير
                        </p>
                        <MathText className="text-sm font-semibold leading-7 text-amber-950">
                          {reasoning}
                        </MathText>
                      </div>
                    )}

                    {answer && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                        <p className="mb-1 text-[11px] font-black text-emerald-700">
                          الجواب
                        </p>
                        <MathText className="text-sm font-black leading-7 text-emerald-950">
                          {answer}
                        </MathText>
                      </div>
                    )}

                    {Object.keys(extraFields).length > 0 && (
                      <StructuredValue
                        value={extraFields}
                        fieldKey="example_details"
                        depth={1}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {steps.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Route size={18} className="text-indigo-600" />
            <h3 className="font-black text-slate-950">
              خطوات الحل
            </h3>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => {
              const isPrimitive =
                typeof step === "string" ||
                typeof step === "number" ||
                typeof step === "boolean";

              const stepObject =
                !isPrimitive &&
                step &&
                typeof step === "object" &&
                !Array.isArray(step)
                  ? step
                  : null;

              const stepNumber =
                stepObject?.step_number ??
                stepObject?.number ??
                index + 1;

              const stepTitle =
                stepObject?.title ||
                stepObject?.label ||
                `الخطوة ${stepNumber}`;

              // هذه هي المشكلة الأساسية التي كانت تجعل بطاقات الخطوات فارغة:
              // ملفات JSON الحالية تخزن steps غالبًا كمصفوفة نصوص، وليس كائنات.
              const explanation = isPrimitive
                ? String(step)
                : stepObject?.teacher_explanation ||
                  stepObject?.explanation ||
                  stepObject?.instruction ||
                  stepObject?.text ||
                  stepObject?.action ||
                  stepObject?.statement ||
                  stepObject?.solution ||
                  "";

              const calculation = stepObject
                ? stepObject.calculation ||
                  stepObject.formula ||
                  stepObject.expression ||
                  stepObject.equation ||
                  stepObject.relation ||
                  ""
                : "";

              const result = stepObject
                ? stepObject.result ||
                  stepObject.answer ||
                  stepObject.final_answer ||
                  stepObject.conclusion ||
                  ""
                : "";

              const knownStepKeys = new Set([
                "id",
                "step_number",
                "number",
                "title",
                "label",
                "teacher_explanation",
                "explanation",
                "instruction",
                "text",
                "action",
                "statement",
                "solution",
                "calculation",
                "formula",
                "expression",
                "equation",
                "relation",
                "result",
                "answer",
                "final_answer",
                "conclusion",
              ]);

              const extraStepFields = stepObject
                ? Object.fromEntries(
                    Object.entries(stepObject).filter(
                      ([key, value]) =>
                        !knownStepKeys.has(key) &&
                        !isEmpty(value) &&
                        !isTechnicalPresentationField(key) &&
                        !looksLikeSvgMarkup(value),
                    ),
                  )
                : {};

              return (
                <article
                  key={stepObject?.id || `worked-step-${index}`}
                  className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-l from-indigo-50/70 via-white to-white px-4 py-3.5">
                    <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-2 text-sm font-black text-white shadow-sm">
                      {stepNumber}
                    </span>

                    <h4 className="text-sm font-black text-slate-950">
                      {stepTitle}
                    </h4>
                  </div>

                  <div className="space-y-3 p-4 sm:p-5">
                    {explanation && (
                      <MathText className="block text-sm font-semibold leading-8 text-slate-700 sm:text-[15px]">
                        {explanation}
                      </MathText>
                    )}

                    {calculation && (
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-3">
                        <p className="mb-1.5 text-[11px] font-black text-indigo-700">
                          الحساب
                        </p>
                        <MixedArabicMath value={calculation} />
                      </div>
                    )}

                    {result && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3">
                        <p className="mb-1 text-[11px] font-black text-emerald-700">
                          النتيجة
                        </p>

                        <MathText className="text-sm font-black leading-7 text-emerald-950">
                          {result}
                        </MathText>
                      </div>
                    )}

                    {Object.keys(extraStepFields).length > 0 && (
                      <StructuredValue
                        value={extraStepFields}
                        fieldKey="step_details"
                        depth={1}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {content.variation_table && (
        <VariationTable table={content.variation_table} />
      )}

      {content.graph && (
        <GraphRenderer graph={content.graph} />
      )}

      {content.final_conclusion && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
          <CheckCircle2
            size={19}
            className="mt-1 shrink-0 text-emerald-600"
          />

          <div>
            <p className="mb-1 text-xs font-black text-emerald-700">
              الخلاصة النهائية
            </p>

            <MathText className="text-sm font-black leading-7 text-slate-900">
              {content.final_conclusion}
            </MathText>
          </div>
        </div>
      )}

      {verification.length > 0 && (
        <BulletList
          items={verification}
          tone="emerald"
          icon={CheckCircle2}
        />
      )}

      {(content.why || content.how_to_think) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {content.why && (
            <InfoBox
              title="لماذا حصلنا على هذه النتيجة؟"
              tone="amber"
              icon={CircleHelp}
            >
              <MathText className="text-sm font-semibold leading-7">
                {content.why}
              </MathText>
            </InfoBox>
          )}

          {content.how_to_think && (
            <InfoBox
              title="كيف أفكر؟"
              tone="sky"
              icon={Brain}
            >
              <MathText className="text-sm font-semibold leading-7">
                {content.how_to_think}
              </MathText>
            </InfoBox>
          )}
        </div>
      )}

      {content.attention && (
        <InfoBox
          title="انتبه إلى هذه النقطة"
          tone="rose"
          icon={AlertTriangle}
        >
          <MathText className="text-sm font-semibold leading-7">
            {content.attention}
          </MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm">
          <CheckCircle2
            size={19}
            className="mt-1 shrink-0 text-indigo-600"
          />

          <div>
            <p className="mb-1 text-xs font-black text-indigo-700">
              ما الذي تحفظه؟
            </p>

            <MathText className="text-sm font-black leading-7 text-slate-900">
              {content.takeaway}
            </MathText>
          </div>
        </div>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <GenericObjectStep content={remainingContent} />
      )}
    </div>
  );
}

function GuidedPracticeStep({ content = {} }) {
  const [openHints, setOpenHints] = useState({});
  const [openAnswers, setOpenAnswers] = useState({});

  const statement =
    content.statement ||
    content.exercise ||
    content.question ||
    content.prompt ||
    "";

  const promptsSource =
    content.prompts ??
    content.guided_prompts ??
    content.questions ??
    content.steps ??
    [];

  const prompts = Array.isArray(promptsSource)
    ? promptsSource.filter(Boolean)
    : promptsSource
      ? [promptsSource]
      : [];

  const objective =
    content.objective ||
    content.goal ||
    content.skill ||
    "";

  const thinkingText =
    content.how_to_think ||
    content.strategy ||
    "";

  const whyText =
    content.why ||
    content.benefit ||
    "";

  const quickCheck =
    content.quick_check ||
    (content.checkpoint_question || content.checkpoint_answer
      ? {
          question: content.checkpoint_question,
          answer: content.checkpoint_answer,
        }
      : null);

  function toggleHint(index) {
    setOpenHints((current) => ({
      ...current,
      [index]: !current[index],
    }));
  }

  function toggleAnswer(index) {
    setOpenAnswers((current) => ({
      ...current,
      [index]: !current[index],
    }));
  }

  return (
    <div className="space-y-6">
      {statement && (
        <InfoBox title="التمرين" tone="indigo" icon={BookOpen}>
          <MathText className="font-black">{statement}</MathText>
        </InfoBox>
      )}

      {objective && (
        <InfoBox title="الهدف" tone="emerald" icon={Target}>
          <MathText className="font-bold">{objective}</MathText>
        </InfoBox>
      )}

      {(whyText || thinkingText) && (
        <div className="grid gap-4 md:grid-cols-2">
          {whyText && (
            <InfoBox
              title="لماذا نتعلم هذه الفكرة؟"
              tone="amber"
              icon={Lightbulb}
            >
              <MathText className="font-bold">{whyText}</MathText>
            </InfoBox>
          )}

          {thinkingText && (
            <InfoBox
              title="كيف أفكر؟"
              tone="sky"
              icon={Brain}
            >
              <MathText className="font-bold">
                {thinkingText}
              </MathText>
            </InfoBox>
          )}
        </div>
      )}

      {content.attention && (
        <InfoBox
          title="انتبه إلى هذه النقطة"
          tone="rose"
          icon={AlertTriangle}
        >
          <MathText className="font-bold">
            {content.attention}
          </MathText>
        </InfoBox>
      )}

      {prompts.length > 0 && (
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Route size={21} className="text-indigo-600" />
              <h3 className="font-black text-slate-950">
                مراحل التدريب الموجّه
              </h3>
            </div>

            <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">
              {prompts.length} مراحل
            </span>
          </div>

          <div className="space-y-4">
            {prompts.map((prompt, index) => {
              const promptObject =
                prompt &&
                typeof prompt === "object" &&
                !Array.isArray(prompt)
                  ? prompt
                  : {};

              const stepTitle =
                promptObject.step ||
                promptObject.title ||
                promptObject.label ||
                `المرحلة ${index + 1}`;

              const question =
                promptObject.question ||
                promptObject.instruction ||
                promptObject.prompt ||
                promptObject.text ||
                (typeof prompt === "string" ? prompt : "");

              const hint =
                promptObject.hint ||
                promptObject.help ||
                promptObject.clue ||
                "";

              const expectedAnswer =
                promptObject.expected_answer ||
                promptObject.answer ||
                promptObject.solution ||
                promptObject.result ||
                "";

              if (!question && !hint && !expectedAnswer) return null;

              const hintOpen = Boolean(openHints[index]);
              const answerOpen = Boolean(openAnswers[index]);

              return (
                <article
                  key={promptObject.id || `guided-prompt-${index}`}
                  className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex items-start gap-4 border-b border-slate-100 bg-gradient-to-l from-indigo-50/80 to-white p-5">
                    <span className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-3 font-black text-white shadow-lg shadow-indigo-500/20">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-indigo-600">
                        {stepTitle}
                      </p>

                      {question && (
                        <MathText className="mt-1 font-black text-slate-950">
                          {question}
                        </MathText>
                      )}
                    </div>
                  </div>

                  {(hint || expectedAnswer) && (
                    <div className="space-y-3 p-5">
                      <div className="flex flex-wrap gap-3">
                        {hint && (
                          <button
                            type="button"
                            onClick={() => toggleHint(index)}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition",
                              hintOpen
                                ? "border-amber-300 bg-amber-100 text-amber-900"
                                : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                            )}
                          >
                            <Lightbulb size={17} />
                            {hintOpen
                              ? "إخفاء التلميح"
                              : "أحتاج تلميحًا"}
                          </button>
                        )}

                        {expectedAnswer && (
                          <button
                            type="button"
                            onClick={() => toggleAnswer(index)}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition",
                              answerOpen
                                ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
                            )}
                          >
                            <CheckCircle2 size={17} />
                            {answerOpen
                              ? "إخفاء الإجابة"
                              : "إظهار الإجابة المتوقعة"}
                          </button>
                        )}
                      </div>

                      {hintOpen && hint && (
                        <InfoBox
                          title="تلميح"
                          tone="amber"
                          icon={Lightbulb}
                        >
                          <MathText className="font-bold">
                            {hint}
                          </MathText>
                        </InfoBox>
                      )}

                      {answerOpen && expectedAnswer && (
                        <InfoBox
                          title="الإجابة المتوقعة"
                          tone="emerald"
                          icon={CheckCircle2}
                        >
                          <MathText className="font-black">
                            {expectedAnswer}
                          </MathText>
                        </InfoBox>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {Array.isArray(content.hint_levels) &&
        content.hint_levels.length > 0 && (
          <HintLevels items={content.hint_levels} />
        )}

      {Array.isArray(content.solution_steps) &&
        content.solution_steps.length > 0 && (
          <RevealBox
            label="إظهار الحل خطوة بخطوة"
            tone="emerald"
          >
            <MethodTimeline
              items={content.solution_steps.map((item, index) => ({
                step_number:
                  typeof item === "object" &&
                  item?.step_number !== undefined
                    ? item.step_number
                    : index + 1,
                instruction: getDisplayText(item),
                why:
                  typeof item === "object"
                    ? item.why ||
                      item.explanation ||
                      item.reason ||
                      ""
                    : "",
              }))}
            />
          </RevealBox>
        )}

      {content.final_answer && (
        <InfoBox
          title="الجواب النهائي"
          tone="emerald"
          icon={CheckCircle2}
        >
          <MathText className="font-black">
            {content.final_answer}
          </MathText>
        </InfoBox>
      )}

      {quickCheck?.question && (
        <RevealBox
          label={quickCheck.question}
          tone="emerald"
        >
          <MathText className="font-black">
            {quickCheck.answer ||
              "لم تُرسل الإجابة من الخادم."}
          </MathText>
        </RevealBox>
      )}

      {content.graph_data && (
        <GraphRenderer graph={content.graph_data} />
      )}
    </div>
  );
}


function InPathFinalAssessmentStep({ content = {} }) {
  const [open, setOpen] = useState(false);

  const statement =
    content.exercise ||
    content.statement ||
    content.question ||
    content.prompt ||
    content.title ||
    "";

  const solutionSource =
    content.solution ??
    content.answers ??
    content.solution_steps ??
    content.expected_answer ??
    content.final_answer ??
    [];

  const solutions = (() => {
    if (!solutionSource) return [];

    if (Array.isArray(solutionSource)) {
      return solutionSource.filter(Boolean);
    }

    if (
      typeof solutionSource === "object" &&
      !Array.isArray(solutionSource)
    ) {
      return Object.entries(solutionSource)
        .filter(([, value]) => !isEmpty(value))
        .map(([key, value], index) => ({
          id: key,
          step_number: index + 1,
          title: fieldLabel(key),
          answer: value,
        }));
    }

    return [solutionSource];
  })();

  const skillsSource =
    content.skills ??
    content.measured_skills ??
    content.learning_outcomes ??
    content.skill ??
    [];

  const skills = Array.isArray(skillsSource)
    ? skillsSource
    : skillsSource
      ? [skillsSource]
      : [];

  return (
    <div className="space-y-6">
      {statement && (
        <InfoBox title="التمرين الشامل" tone="amber" icon={Trophy}>
          <MathText className="font-black">{statement}</MathText>
        </InfoBox>
      )}

      {Array.isArray(skills) && skills.length > 0 && (
        <div>
          <h3 className="mb-3 font-black text-slate-950">المهارات المقاسة</h3>
          <BulletList items={skills} tone="indigo" icon={Target} />
        </div>
      )}

      {Array.isArray(content.success_criteria) &&
        content.success_criteria.length > 0 && (
          <div>
            <h3 className="mb-3 font-black text-slate-950">معايير النجاح</h3>
            <BulletList
              items={content.success_criteria}
              tone="emerald"
              icon={CheckCircle2}
            />
          </div>
        )}

      {Array.isArray(content.guided_prompts) &&
        content.guided_prompts.length > 0 && (
          <HintLevels
            items={content.guided_prompts.map((hint, index) => ({
              level: index + 1,
              hint: getDisplayText(hint),
            }))}
          />
        )}

      {Array.isArray(content.hint_levels) &&
        content.hint_levels.length > 0 && (
          <HintLevels items={content.hint_levels} />
        )}

      {solutions.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-2xl bg-slate-950 px-5 py-4 font-black text-white transition hover:bg-indigo-700"
          >
            <span>{open ? "إخفاء التصحيح" : "إظهار التصحيح النموذجي"}</span>
            {open ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
          </button>

          <AnimatedCollapse open={open} className="mt-4">
            <div className="space-y-4 rounded-[28px] border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5">
              {solutions.map((item, index) => {
                const isObject =
                  item && typeof item === "object" && !Array.isArray(item);

                const title = isObject
                  ? item.title || item.label || ""
                  : "";

                const answer = isObject
                  ? item.answer ||
                    item.expected_answer ||
                    item.final_answer ||
                    item.solution ||
                    item.result ||
                    item.text ||
                    item.instruction ||
                    ""
                  : String(item);

                const explanation = isObject
                  ? item.why || item.explanation || item.reason || ""
                  : "";

                if (isEmpty(answer) && isEmpty(explanation)) return null;

                return (
                  <div
                    key={item?.id || `in-path-solution-${index}`}
                    className="animate-[fadeSlideIn_0.45s_ease-out_both] rounded-[24px] border border-emerald-200 bg-white p-5 shadow-sm"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 font-black text-white shadow-sm">
                        {item?.step_number || index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        {title && (
                          <p className="mb-2 text-sm font-black text-emerald-800">
                            {title}
                          </p>
                        )}

                        {answer && (
                          <MathText className="font-black text-slate-950">
                            {answer}
                          </MathText>
                        )}

                        {explanation && (
                          <MathText className="mt-3 text-sm font-semibold text-slate-600">
                            {explanation}
                          </MathText>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </AnimatedCollapse>
        </>
      )}

      {content.verification && (
        <InfoBox title="التحقق" tone="sky" icon={CheckCircle2}>
          <MathText className="font-bold">{content.verification}</MathText>
        </InfoBox>
      )}

      {Array.isArray(content.success_criteria) &&
        content.success_criteria.length > 0 && (
          <div>
            <h3 className="mb-3 font-black text-slate-950">معايير النجاح</h3>
            <BulletList
              items={content.success_criteria}
              tone="emerald"
              icon={CheckCircle2}
            />
          </div>
        )}
    </div>
  );
}


function InteractiveCheckpoint({ activity }) {
  const [selectedOriginalIndex, setSelectedOriginalIndex] = useState(null);
  const [showHint, setShowHint] = useState(false);

  const safeOptions = Array.isArray(activity?.options)
    ? activity.options
    : [];

  const prepared = buildQuizChoiceEntries(
    {
      ...activity,
      choices: safeOptions,
    },
    0,
    activity?.id || activity?.prompt || "interactive-checkpoint",
  );

  if (
    !activity ||
    !activity.prompt ||
    safeOptions.length === 0
  ) {
    return null;
  }

  const answered = selectedOriginalIndex !== null;
  const isCorrect =
    answered &&
    prepared.correctOriginalIndex >= 0 &&
    selectedOriginalIndex === prepared.correctOriginalIndex;

  const optionLabels = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];

  return (
    <section className="mb-7 overflow-hidden rounded-[28px] border border-violet-200 bg-gradient-to-l from-violet-50 via-white to-indigo-50 shadow-sm">
      <div className="border-b border-violet-100 px-5 py-5 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-black text-white shadow-lg shadow-violet-500/20">
            <Brain size={16} />
            فكّر قبل الشرح
          </span>
          <span className="text-xs font-bold text-slate-500">
            اختر إجابة واحدة
          </span>
        </div>
        <MathText className="text-base font-black text-slate-950 sm:text-lg">
          {activity.prompt}
        </MathText>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {prepared.displayChoices.map((entry, displayIndex) => {
          const selected = selectedOriginalIndex === entry.originalIndex;
          const correctOption =
            answered &&
            prepared.correctOriginalIndex >= 0 &&
            entry.originalIndex === prepared.correctOriginalIndex;
          const wrongSelected = answered && selected && !correctOption;

          return (
            <button
              key={`${entry.originalIndex}-${displayIndex}`}
              type="button"
              disabled={answered}
              onClick={() => setSelectedOriginalIndex(entry.originalIndex)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-4 text-right transition-all duration-300",
                !answered &&
                  "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md",
                correctOption &&
                  "border-emerald-300 bg-emerald-50 text-emerald-950",
                wrongSelected &&
                  "border-rose-300 bg-rose-50 text-rose-950",
                answered &&
                  !correctOption &&
                  !wrongSelected &&
                  "border-slate-200 bg-slate-50 text-slate-400",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-black",
                  correctOption
                    ? "border-emerald-300 bg-emerald-600 text-white"
                    : wrongSelected
                      ? "border-rose-300 bg-rose-600 text-white"
                      : "border-slate-200 bg-slate-100 text-slate-600",
                )}
              >
                {correctOption ? (
                  <Check size={18} />
                ) : wrongSelected ? (
                  <XCircle size={18} />
                ) : (
                  optionLabels[displayIndex] || displayIndex + 1
                )}
              </span>
              <MathText className="flex-1 font-bold">{entry.value}</MathText>
            </button>
          );
        })}

        {prepared.correctOriginalIndex < 0 && (
          <InfoBox tone="amber" title="تنبيه في بيانات السؤال" icon={AlertTriangle}>
            <MathText className="font-semibold">
              تعذر تحديد الإجابة الصحيحة. تحقق من correct_answer أو correct_index.
            </MathText>
          </InfoBox>
        )}

        {!answered && activity.hint && (
          <div>
            <button
              type="button"
              onClick={() => setShowHint((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-sm font-black text-amber-900 transition hover:bg-amber-200"
            >
              <Lightbulb size={16} />
              {showHint ? "إخفاء التلميح" : "أعطني تلميحًا"}
            </button>
            {showHint && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <MathText className="font-bold text-amber-950">
                  {activity.hint}
                </MathText>
              </div>
            )}
          </div>
        )}

        {answered && (
          <div
            className={cn(
              "rounded-2xl border p-4",
              isCorrect
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50",
            )}
          >
            <div className="flex items-start gap-3">
              {isCorrect ? (
                <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={20} />
              ) : (
                <AlertTriangle className="mt-1 shrink-0 text-rose-600" size={20} />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "mb-1 text-xs font-black",
                    isCorrect ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {isCorrect ? "إجابة صحيحة" : "لماذا هذه الإجابة غير صحيحة؟"}
                </p>
                <MathText className="font-bold text-slate-800">
                  {isCorrect
                    ? activity.feedback_correct || "إجابة صحيحة."
                    : activity.feedback_wrong || "راجع الفكرة ثم حاول من جديد."}
                </MathText>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedOriginalIndex(null);
                setShowHint(false);
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-violet-700"
            >
              <RefreshCw size={15} />
              أعد المحاولة
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function StepTakeaway({ children }) {
  if (isEmpty(children)) return null;

  return (
    <div className="mt-7 rounded-[26px] border border-indigo-200 bg-gradient-to-l from-indigo-600 to-violet-600 p-[1px] shadow-lg shadow-indigo-500/15">
      <div className="flex items-start gap-3 rounded-[25px] bg-white px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
          <Sparkles size={18} />
        </span>
        <div className="min-w-0">
          <p className="mb-1 text-xs font-black text-indigo-600">خلاصة المرحلة</p>
          <MathText className="font-black text-slate-950">{children}</MathText>
        </div>
      </div>
    </div>
  );
}

function QuickCheckCard({ check }) {
  const [open, setOpen] = useState(false);
  if (!check || (!check.question && !check.answer)) return null;

  return (
    <div className="overflow-hidden rounded-[24px] border border-emerald-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 bg-emerald-50 px-5 py-4 text-right transition hover:bg-emerald-100/70"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
            <CircleHelp size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-black text-emerald-700">تحقق سريع</p>
            <MathText className="mt-0.5 font-black text-slate-950">
              {check.question}
            </MathText>
          </div>
        </div>
        {open ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
      </button>

      {open && (
        <div className="border-t border-emerald-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={20} />
            <div className="min-w-0">
              <p className="mb-1 text-xs font-black text-emerald-700">الإجابة الصحيحة</p>
              <MathText className="font-bold text-slate-800">{check.answer}</MathText>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PEDAGOGICAL_KEYS = new Set([
  "why",
  "how_to_think",
  "attention",
  "quick_check",
  "pre_question",
  "attempt_instruction",
  "takeaway",
  "bac_connection",
  "mastery_rule",
  "next_step",
]);

// حقول يعرضها LessonStepCard خارج StepBody في موضع واحد ثابت.
const CENTRALIZED_PEDAGOGICAL_KEYS = new Set([
  "why",
  "how_to_think",
  "attention",
  "quick_check",
  "pre_question",
  "attempt_instruction",
  "takeaway",
  "mastery_rule",
  "next_step",
]);

const PEDAGOGICAL_FIELDS_RENDERED_BY_STEP = {
  observation: new Set([
    "why",
    "how_to_think",
    "attention",
    "quick_check",
  ]),
  method: new Set([
    "why",
    "how_to_think",
    "attention",
    "takeaway",
    "quick_check",
  ]),
  interpretation: new Set([
    "why",
    "how_to_think",
    "attention",
    "takeaway",
  ]),
  comparison: new Set([
    "why",
    "how_to_think",
    "attention",
    "takeaway",
    "memory_tip",
  ]),
  discovery: new Set([
    "why",
    "how_to_think",
    "attention",
    "takeaway",
  ]),
  concept: new Set([
    "why",
    "how_to_think",
    "attention",
    "takeaway",
  ]),
  graph_reading: new Set([
    "why",
    "how_to_think",
    "attention",
    "takeaway",
  ]),
  guided_explanation: new Set([
    "why",
    "how_to_think",
    "attention",
    "takeaway",
    "quick_check",
  ]),
  worked_example: new Set([
    "why",
    "how_to_think",
    "attention",
    "takeaway",
  ]),
};

function getExcludedPedagogicalFields(stepType) {
  return (
    PEDAGOGICAL_FIELDS_RENDERED_BY_STEP[stepType] ||
    new Set()
  );
}

function PedagogicalBlocks({
  content,
  excludeFields = new Set(),
}) {
  if (!content) return null;

  const canShow = (field) => !excludeFields.has(field);

  const hasAny =
    (canShow("why") && content.why) ||
    (canShow("how_to_think") && content.how_to_think) ||
    (canShow("attention") && content.attention) ||
    (canShow("quick_check") && content.quick_check) ||
    (canShow("mastery_rule") && content.mastery_rule) ||
    (canShow("next_step") && content.next_step);

  if (!hasAny) return null;

  return (
    <div className="mt-7 space-y-4 border-t border-slate-200 pt-7">
      <div className="grid gap-4 lg:grid-cols-2">
        {canShow("why") && content.why && (
          <InfoBox title="لماذا نتعلم هذه الفكرة؟" tone="amber" icon={Lightbulb}>
            <MathText className="font-bold">{content.why}</MathText>
          </InfoBox>
        )}
        {canShow("how_to_think") && content.how_to_think && (
          <InfoBox title="كيف أفكر؟" tone="sky" icon={Brain}>
            <MathText className="font-bold">{content.how_to_think}</MathText>
          </InfoBox>
        )}
      </div>

      {canShow("attention") && content.attention && (
        <InfoBox title="انتبه إلى هذه النقطة" tone="rose" icon={AlertTriangle}>
          <MathText className="font-bold">{content.attention}</MathText>
        </InfoBox>
      )}

      {canShow("quick_check") && content.quick_check && (
        <QuickCheckCard check={content.quick_check} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {canShow("mastery_rule") && content.mastery_rule && (
          <InfoBox title="علامة الإتقان" tone="emerald" icon={Trophy}>
            <MathText className="font-bold">{content.mastery_rule}</MathText>
          </InfoBox>
        )}
        {canShow("next_step") && content.next_step && (
          <InfoBox title="الخطوة التالية" tone="indigo" icon={ArrowLeft}>
            <MathText className="font-bold">{content.next_step}</MathText>
          </InfoBox>
        )}
      </div>
    </div>
  );
}

function SupportItem({ item, index }) {
  if (!item) return null;
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 font-black text-white">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-black text-amber-700">المشكلة</p>
          <MathText className="font-black text-slate-950">{item.problem || item.issue || item.question || "مشكلة غير محددة"}</MathText>
        </div>
      </div>
      <div className="flex items-start gap-3 px-5 py-4">
        <Route className="mt-1 shrink-0 text-indigo-600" size={19} />
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-black text-indigo-700">ماذا أفعل؟</p>
          <MathText className="font-bold text-slate-700">{item.action || item.solution || item.recommendation || "لا توجد خطوة مقترحة."}</MathText>
        </div>
      </div>
    </div>
  );
}

function SupportPathValue({ value }) {
  const items = value?.if_student_does_not_understand;
  if (!Array.isArray(items)) return null;
  return (
    <div className="space-y-4">
      {items.map((item, index) => <SupportItem key={index} item={item} index={index} />)}
    </div>
  );
}

function CompactObjectCards({ items, fieldKey }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const columns =
    fieldKey === "categories"
      ? "lg:grid-cols-3"
      : fieldKey === "measurable_quantities"
        ? "md:grid-cols-2 xl:grid-cols-3"
        : "md:grid-cols-2";

  return (
    <div className={cn("grid gap-4", columns)}>
      {items.map((item, index) => {
        const entries = Object.entries(item || {}).filter(
          ([key, value]) =>
            !isEmpty(value) &&
            !["id", "step_number", "level"].includes(key) &&
            !isTechnicalPresentationField(key),
        );

        const primary =
          item?.name ||
          item?.term ||
          item?.concept ||
          item?.phrase ||
          item?.model ||
          item?.quantity ||
          item?.situation ||
          item?.condition ||
          item?.case ||
          item?.title ||
          `العنصر ${index + 1}`;

        return (
          <article
            key={item?.id || `${fieldKey}-${index}`}
            className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
          >
            <MathText
              as="h4"
              className="mb-2 text-sm font-black leading-7 text-indigo-800"
            >
              {primary}
            </MathText>

            <div className="space-y-2">
              {entries
                .filter(([key]) =>
                  ![
                    "name",
                    "term",
                    "concept",
                    "phrase",
                    "model",
                    "quantity",
                    "situation",
                    "condition",
                    "case",
                    "title",
                  ].includes(key),
                )
                .map(([key, value]) => (
                  <div key={key} className="border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                    <p className="mb-1 text-xs font-black text-slate-500">
                      {fieldLabel(key)}
                    </p>
                    {Array.isArray(value) ? (
                      <BulletList items={value} tone="indigo" />
                    ) : (
                      <MathText className="text-sm font-semibold text-slate-700">
                        {String(value)}
                      </MathText>
                    )}
                  </div>
                ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}


const SEMANTIC_EXAMPLE_ORDER = [
  "situation",
  "experiment",
  "example",
  "question",
  "outcomes",
  "universe",
  "event_text",
  "event",
  "A",
  "B",
  "condition",
  "matching_outcomes",
  "matching_values",
  "certain",
  "impossible",
  "intersection",
  "union",
  "entry_fee",
  "prize",
  "net_win",
  "net_loss",
  "favorable",
  "possible",
  "calculation",
  "probability",
  "answer",
  "idea",
  "meaning",
  "explanation",
];

function getSemanticEntryTone(key) {
  if (["question", "condition"].includes(key)) {
    return {
      border: "border-indigo-100",
      bg: "bg-indigo-50/65",
      label: "text-indigo-700",
    };
  }

  if (["answer", "probability", "calculation"].includes(key)) {
    return {
      border: "border-emerald-100",
      bg: "bg-emerald-50/60",
      label: "text-emerald-700",
    };
  }

  if (["warning", "impossible", "net_loss"].includes(key)) {
    return {
      border: "border-rose-100",
      bg: "bg-rose-50/60",
      label: "text-rose-700",
    };
  }

  if (["idea", "meaning", "explanation"].includes(key)) {
    return {
      border: "border-amber-100",
      bg: "bg-amber-50/55",
      label: "text-amber-700",
    };
  }

  return {
    border: "border-slate-100",
    bg: "bg-white",
    label: "text-slate-500",
  };
}

function SemanticExampleValue({ value }) {
  if (isEmpty(value)) return null;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/55 p-4">
        <MathText className="font-bold text-slate-800">
          {String(value)}
        </MathText>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {value.map((item, index) => (
          <div
            key={`semantic-example-${index}`}
            className="rounded-2xl border border-amber-100 bg-amber-50/35 p-4"
          >
            <SemanticExampleValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value !== "object") return null;

  const entries = Object.entries(value).filter(
    ([key, nestedValue]) =>
      !isEmpty(nestedValue) &&
      !isTechnicalPresentationField(key) &&
      !looksLikeSvgMarkup(nestedValue),
  );

  if (entries.length === 0) return null;

  const rank = (key) => {
    const index = SEMANTIC_EXAMPLE_ORDER.indexOf(key);
    return index === -1 ? 999 : index;
  };

  const orderedEntries = [...entries].sort(
    ([keyA], [keyB]) => rank(keyA) - rank(keyB),
  );

  return (
    <div className="overflow-hidden rounded-[24px] border border-amber-200 bg-gradient-to-b from-amber-50/55 to-white shadow-sm">
      <div className="space-y-2.5 p-4 sm:p-5">
        {orderedEntries.map(([key, nestedValue]) => {
          const tone = getSemanticEntryTone(key);
          const label = fieldLabel(key);

          return (
            <div
              key={key}
              className={cn(
                "rounded-2xl border p-3.5 sm:p-4",
                tone.border,
                tone.bg,
              )}
            >
              {label && (
                <p
                  className={cn(
                    "mb-1.5 text-[11px] font-black",
                    tone.label,
                  )}
                >
                  {label}
                </p>
              )}

              {Array.isArray(nestedValue) ? (
                <BulletList items={nestedValue} tone="indigo" />
              ) : nestedValue && typeof nestedValue === "object" ? (
                <StructuredValue
                  value={nestedValue}
                  fieldKey={key}
                  depth={2}
                />
              ) : (
                <MathText className="text-sm font-bold leading-7 text-slate-800 sm:text-[15px]">
                  {String(nestedValue)}
                </MathText>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProbabilityLawValue({ value }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <StructuredValue value={value} depth={1} />;
  }

  const objectRows = value.filter(
    (item) => item && typeof item === "object" && !Array.isArray(item),
  );

  if (objectRows.length !== value.length) {
    return <BulletList items={value} tone="indigo" />;
  }

  return (
    <DynamicDataTable
      rows={value}
      preferredColumns={["x", "p", "probability"]}
      title=""
    />
  );
}

function SemanticObjectRows({
  rows,
  preferredColumns = [],
}) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const objectRows = rows.filter(
    (item) => item && typeof item === "object" && !Array.isArray(item),
  );

  if (objectRows.length !== rows.length) {
    return <BulletList items={rows} tone="indigo" />;
  }

  return (
    <DynamicDataTable
      rows={rows}
      preferredColumns={preferredColumns}
      title=""
    />
  );
}

function ClassificationDrillStep({ content = {} }) {
  const situations = Array.isArray(content.situations)
    ? content.situations.filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      {content.teacher && (
        <InfoBox title="كيف أتعامل مع التصنيف؟" tone="indigo" icon={Brain}>
          <MathText className="font-semibold">{content.teacher}</MathText>
        </InfoBox>
      )}

      {situations.length > 0 && (
        <div className="space-y-3">
          {situations.map((item, index) => (
            <article
              key={item?.id || `classification-drill-${index}`}
              className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-start gap-3 border-b border-indigo-100 bg-indigo-50/60 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[11px] font-black text-indigo-700">
                    الوضعية
                  </p>
                  <MathText className="font-black text-slate-950">
                    {item?.situation || item?.question || getDisplayText(item)}
                  </MathText>
                </div>
              </div>

              {(item?.answer || item?.result) && (
                <div className="p-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/65 p-3.5">
                    <p className="mb-1 text-[11px] font-black text-emerald-700">
                      التصنيف الصحيح
                    </p>
                    <MathText className="font-black text-emerald-950">
                      {item.answer || item.result}
                    </MathText>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {content.takeaway && (
        <StepTakeaway>{content.takeaway}</StepTakeaway>
      )}
    </div>
  );
}

function BranchGuidanceStep({ content = {} }) {
  const preferredBranches = ["علوم تجريبية", "رياضيات", "تقني رياضي"];

  const entries = Object.entries(content).filter(
    ([key, value]) =>
      !["takeaway", "teacher"].includes(key) &&
      !isEmpty(value) &&
      !isTechnicalPresentationField(key),
  );

  const orderedEntries = [...entries].sort(
    ([a], [b]) =>
      preferredBranches.indexOf(a) - preferredBranches.indexOf(b),
  );

  return (
    <div className="space-y-5">
      {content.teacher && (
        <InfoBox title="حسب الشعبة" tone="indigo" icon={GraduationCap}>
          <MathText className="font-semibold">{content.teacher}</MathText>
        </InfoBox>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {orderedEntries.map(([branch, value], index) => (
          <article
            key={branch}
            className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
          >
            <div
              className={cn(
                "px-4 py-3 text-white",
                index === 0
                  ? "bg-indigo-600"
                  : index === 1
                    ? "bg-violet-600"
                    : "bg-slate-800",
              )}
            >
              <h3 className="font-black">{branch}</h3>
            </div>
            <div className="p-4">
              {Array.isArray(value) ? (
                <BulletList items={value} tone="indigo" />
              ) : (
                <StructuredValue value={value} fieldKey={branch} depth={1} />
              )}
            </div>
          </article>
        ))}
      </div>

      {content.takeaway && (
        <StepTakeaway>{content.takeaway}</StepTakeaway>
      )}
    </div>
  );
}

function DecisionTreeStep({ content = {} }) {
  const decisions = Array.isArray(content.decision)
    ? content.decision.filter(Boolean)
    : content.decision
      ? [content.decision]
      : [];

  return (
    <div className="space-y-5">
      {decisions.length > 0 && (
        <section className="space-y-3">
          {decisions.map((item, index) => (
            <div
              key={`decision-${index}`}
              className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/45 p-4 shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white">
                {index + 1}
              </span>
              <MathText className="font-bold text-slate-800">
                {getDisplayText(item)}
              </MathText>
            </div>
          ))}
        </section>
      )}

      {content.takeaway && (
        <StepTakeaway>{content.takeaway}</StepTakeaway>
      )}
    </div>
  );
}

function StructuredValue({ value, fieldKey, depth = 0 }) {
  if (
    isEmpty(value) ||
    isTechnicalPresentationField(fieldKey) ||
    looksLikeSvgMarkup(value)
  ) {
    return null;
  }

  /*
   * عارض عام آمن:
   * إذا كان أي كائن داخل JSON يشبه رسمًا بيانيًا أو SVG تعليميًا،
   * نعرضه كرسم مهما كان اسم المفتاح (pressure_graph, mass_graph, ...).
   * هذا يمنع ضياع الرسومات الجديدة فقط لأن اسم الحقل لم يكن معروفًا مسبقًا.
   */
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (isSvgGraph(value) || isRenderableSeriesGraph(value))
  ) {
    return <CompleteGraphValue value={value} />;
  }

  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        (isSvgGraph(item) || isRenderableSeriesGraph(item)),
    )
  ) {
    return (
      <div className="space-y-5">
        {value.map((graphItem, index) => (
          <CompleteGraphValue
            key={graphItem?.id || graphItem?.title || `graph-${index}`}
            value={graphItem}
          />
        ))}
      </div>
    );
  }

  if (fieldKey === "support_path" && value?.if_student_does_not_understand) {
    return <SupportPathValue value={value} />;
  }

  if (fieldKey === "if_student_does_not_understand" && Array.isArray(value)) {
    return (
      <div className="space-y-4">
        {value.map((item, index) => (
          <SupportItem key={index} item={item} index={index} />
        ))}
      </div>
    );
  }

  const variationKeys = new Set([
    "variation_table",
    "table_of_variations",
    "variations_table",
    "sign_table",
    "derivative_sign_table",
    "discussion_table",
    "monotonicity_table",
  ]);

  if (variationKeys.has(fieldKey)) {
    const tableTitle =
      fieldKey === "sign_table" ||
      fieldKey === "derivative_sign_table"
        ? "جدول الإشارة"
        : fieldKey === "discussion_table"
          ? "جدول المناقشة"
          : "جدول التغيرات";

    return (
      <VariationTableRenderer
        value={value}
        title={tableTitle}
      />
    );
  }

  if (fieldKey === "quick_check") {
    return <QuickCheckCard check={value} />;
  }

  if (["mini_example", "quick_example"].includes(fieldKey)) {
    return <SemanticExampleValue value={value} />;
  }

  if (fieldKey === "probability_law") {
    return <ProbabilityLawValue value={value} />;
  }

  if (fieldKey === "examples" && Array.isArray(value)) {
    return <ExampleCollection value={value} />;
  }

  if (fieldKey === "quadrants" && Array.isArray(value)) {
    return (
      <SemanticObjectRows
        rows={value}
        preferredColumns={["quadrant", "signs", "angle_form"]}
      />
    );
  }

  if (
    fieldKey === "decision_table" &&
    Array.isArray(value)
  ) {
    return (
      <SemanticObjectRows
        rows={value}
        preferredColumns={["order_matters", "repetition", "model", "count"]}
      />
    );
  }

  if (
    fieldKey === "sampling_map" &&
    Array.isArray(value)
  ) {
    return (
      <SemanticObjectRows
        rows={value}
        preferredColumns={["sampling", "model", "idea"]}
      />
    );
  }

  if (
    fieldKey === "translation_patterns" &&
    Array.isArray(value)
  ) {
    return (
      <SemanticObjectRows
        rows={value}
        preferredColumns={["phrase", "notation", "known_event", "target_event"]}
      />
    );
  }

  if (
    fieldKey === "translation_table" &&
    Array.isArray(value)
  ) {
    return (
      <SemanticObjectRows
        rows={value}
        preferredColumns={["phrase", "translation"]}
      />
    );
  }

  if (
    [
      "graph",
      "graph_data",
      "curve",
      "function_graph",
      "graphical_representation",
      "interactive_graph",
    ].includes(fieldKey) &&
    fieldKey !== "graph_configuration"
  ) {
    return <CompleteGraphValue value={value} />;
  }

  if (
    ["relations", "relation", "formulas", "rules"].includes(fieldKey)
  ) {
    return (
      <RelationCards
        items={value}
        title={fieldLabel(fieldKey)}
      />
    );
  }

  const isStandardTableField =
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (
      ["table", "comparison_table", "rule_table", "reference_table", "cases_table"].includes(fieldKey) ||
      (
        typeof fieldKey === "string" &&
        fieldKey.endsWith("_table") &&
        (Array.isArray(value.headers) || Array.isArray(value.columns)) &&
        (Array.isArray(value.rows) || Array.isArray(value.data))
      )
    );

  if (isStandardTableField) {
    return (
      <FlexibleTable
        table={value}
        title={value?.title || fieldLabel(fieldKey)}
      />
    );
  }

  if (
    ["decision_tree", "branches"].includes(fieldKey) &&
    Array.isArray(value)
  ) {
    return <DecisionTreeCards items={value} />;
  }

  if (fieldKey === "visualization") {
    return (
      <div className="rounded-[26px] border border-violet-100 bg-gradient-to-b from-violet-50/70 to-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-violet-700">
          <Compass size={18} />
          <h3 className="font-black">مواصفات الرسم التفاعلي</h3>
        </div>
        <StructuredValue value={value} fieldKey="visualization_configuration" depth={depth + 1} />
      </div>
    );
  }

  if (typeof value === "string" || typeof value === "number") {
    const mathPanelFields = new Set([
      "formula",
      "calculation",
      "equation",
      "expression",
      "relation",
      "starting_relation",
      "final_relation",
      "general_result",
      "expected_answer",
      "final_answer",
    ]);

    const shouldUseMathPanel =
      mathPanelFields.has(fieldKey) &&
      isPureMathContent(String(value));

    return shouldUseMathPanel ? (
      <MathPanel>{String(value)}</MathPanel>
    ) : (
      <MathText className="font-semibold text-slate-700">
        {String(value)}
      </MathText>
    );
  }

  if (typeof value === "boolean") {
    return (
      <span className="font-black text-slate-700">
        {value ? "نعم" : "لا"}
      </span>
    );
  }

  if (
    Array.isArray(value) &&
    [
      "comparison",
      "cases",
      "categories",
      "measurable_quantities",
      "decision_rules",
      "definitions",
      "vocabulary",
      "indicators",
      "patterns",
      "classification",
    ].includes(fieldKey) &&
    value.every((item) => item && typeof item === "object" && !Array.isArray(item))
  ) {
    return <CompactObjectCards items={value} fieldKey={fieldKey} />;
  }

  if (Array.isArray(value)) {
    if (fieldKey === "hint_levels") {
      return <HintLevels items={value} />;
    }

    if (value.every((item) => typeof item !== "object" || item === null)) {
      return <BulletList items={value} tone="indigo" />;
    }

    return (
      <div className="space-y-4">
        {value.map((item, index) => (
          <div
            key={index}
            className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            {item?.step_number !== undefined && (
              <span className="mb-3 inline-flex h-8 min-w-8 items-center justify-center rounded-xl bg-indigo-600 px-2 font-black text-white">
                {item.step_number}
              </span>
            )}
            {item?.level !== undefined && (
              <span className="mb-3 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-800">
                التلميح {item.level}
              </span>
            )}
            <StructuredValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const visibleEntries = Object.entries(value).filter(
      ([key, nestedValue]) =>
        !isEmpty(nestedValue) &&
        key !== "step_number" &&
        key !== "level" &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(nestedValue),
    );

    if (visibleEntries.length === 0) return null;

    return (
      <div
        className={cn(
          "space-y-3",
          depth > 0 && "mt-2",
        )}
      >
        {visibleEntries.map(([key, nestedValue]) => {
          const label = fieldLabel(key);

          if (!label) {
            return (
              <StructuredValue
                key={key}
                value={nestedValue}
                fieldKey={key}
                depth={depth + 1}
              />
            );
          }

          return (
            <section
              key={key}
              className="min-w-0 rounded-2xl border border-slate-100 bg-white/80 p-3.5"
            >
              <p className="mb-1.5 text-xs font-black text-slate-600">
                {label}
              </p>
              <StructuredValue
                value={nestedValue}
                fieldKey={key}
                depth={depth + 1}
              />
            </section>
          );
        })}
      </div>
    );
  }

  return null;
}



function GraphReadingStep({ content = {} }) {
  const algorithm = Array.isArray(content.algorithm)
    ? content.algorithm.filter(Boolean)
    : [];

  const example =
    content.example && typeof content.example === "object"
      ? content.example
      : null;

  const exampleItems = example
    ? [
        {
          id: "contact_point",
          label: "نقطة التماس",
          value: example.contact_point,
          tone: "indigo",
          icon: Target,
        },
        {
          id: "second_point",
          label: "النقطة الثانية على المماس",
          value: example.second_point,
          tone: "sky",
          icon: Compass,
        },
        {
          id: "slope",
          label: "حساب معامل التوجيه",
          value: example.slope,
          tone: "amber",
          icon: Hash,
        },
        {
          id: "equation",
          label: "معادلة المماس",
          value: example.equation,
          tone: "emerald",
          icon: CheckCircle2,
        },
      ].filter((item) => !isEmpty(item.value))
    : [];

  const toneClasses = {
    indigo: {
      border: "border-indigo-200",
      bg: "bg-indigo-50/70",
      text: "text-indigo-800",
      badge: "bg-indigo-600",
    },
    sky: {
      border: "border-sky-200",
      bg: "bg-sky-50/70",
      text: "text-sky-800",
      badge: "bg-sky-600",
    },
    amber: {
      border: "border-amber-200",
      bg: "bg-amber-50/70",
      text: "text-amber-800",
      badge: "bg-amber-500",
    },
    emerald: {
      border: "border-emerald-200",
      bg: "bg-emerald-50/70",
      text: "text-emerald-800",
      badge: "bg-emerald-600",
    },
  };

  return (
    <div className="space-y-5">
      {content.teacher && (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-l from-indigo-50/80 via-white to-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-indigo-700">
            <BookOpen size={16} />
            شرح الأستاذ
          </div>

          <MathText className="text-sm font-semibold leading-7 text-slate-700 sm:text-[15px]">
            {content.teacher}
          </MathText>
        </div>
      )}

      {exampleItems.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <GraduationCap size={18} className="text-violet-600" />
            <h3 className="font-black text-slate-950">
              مثال تطبيقي من الرسم
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {exampleItems.map((item, index) => {
              const Icon = item.icon;
              const tone = toneClasses[item.tone];

              return (
                <article
                  key={item.id}
                  className={cn(
                    "h-full rounded-2xl border p-4 shadow-sm",
                    tone.border,
                    tone.bg,
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={tone.text} />
                      <p className={cn("text-xs font-black", tone.text)}>
                        {item.label}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-white",
                        tone.badge,
                      )}
                    >
                      {index + 1}
                    </span>
                  </div>

                  <div className="rounded-xl bg-white/80 px-3 py-3 text-center ring-1 ring-black/5">
                    <MathText className="font-black text-slate-900">
                      {item.value}
                    </MathText>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {algorithm.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Route size={18} className="text-indigo-600" />
            <h3 className="font-black text-slate-950">
              خطوات استخراج معادلة المماس من الرسم
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {algorithm.map((item, index) => (
              <div
                key={`graph-reading-step-${index}`}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                  {index + 1}
                </span>

                <MathText className="text-sm font-semibold leading-7 text-slate-700">
                  {getDisplayText(item)}
                </MathText>
              </div>
            ))}
          </div>
        </section>
      )}

      {(content.why || content.how_to_think) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {content.why && (
            <InfoBox
              title="لماذا تنجح هذه الطريقة؟"
              tone="amber"
              icon={CircleHelp}
            >
              <MathText className="text-sm font-semibold leading-7">
                {content.why}
              </MathText>
            </InfoBox>
          )}

          {content.how_to_think && (
            <InfoBox
              title="كيف أفكر؟"
              tone="sky"
              icon={Brain}
            >
              <MathText className="text-sm font-semibold leading-7">
                {content.how_to_think}
              </MathText>
            </InfoBox>
          )}
        </div>
      )}

      {content.attention && (
        <InfoBox
          title="انتبه إلى هذه النقطة"
          tone="rose"
          icon={AlertTriangle}
        >
          <MathText className="text-sm font-semibold leading-7">
            {content.attention}
          </MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-50 to-white p-4 shadow-sm">
          <CheckCircle2
            size={19}
            className="mt-1 shrink-0 text-indigo-600"
          />
          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-indigo-700">
              الخلاصة
            </p>
            <MathText className="text-sm font-black leading-7 text-slate-900">
              {content.takeaway}
            </MathText>
          </div>
        </div>
      )}
    </div>
  );
}


function ReferenceTableStep({ content = {} }) {
  const cases = Array.isArray(content.cases)
    ? content.cases.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const forms = Array.isArray(content.forms)
    ? content.forms.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const notIndeterminate = Array.isArray(content.not_indeterminate)
    ? content.not_indeterminate.filter(Boolean)
    : [];

  const references = Array.isArray(content.references)
    ? content.references.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const symbolGuide = Array.isArray(content.symbol_guide)
    ? content.symbol_guide.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const isIndeterminateFormsTable = forms.length > 0;
  const isFunctionReferencesTable = references.length > 0;

  const manuallyRenderedKeys = new Set([
    "teacher",
    "cases",
    "forms",
    "not_indeterminate",
    "references",
    "symbol_guide",
    "how_to_think",
    "memory_tip",
    "attention",
    "takeaway",
    "conclusion",
    "important_conclusion",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  const isPolynomialInfinityTable = cases.some(
    (item) =>
      "degree" in item ||
      "leading_coefficient" in item ||
      "at_plus_infinity" in item ||
      "at_minus_infinity" in item,
  );

  const isDegreeComparisonTable = cases.some(
    (item) =>
      "comparison" in item ||
      ("result" in item && "memory" in item),
  );

  const renderFormulaCell = (value, className = "") => (
    <div className={cn("min-w-0", className)}>
      <MathText className="text-center text-sm font-black leading-7 text-slate-900 sm:text-[15px]">
        {String(value ?? "")}
      </MathText>
    </div>
  );

  const renderPolynomialTable = () => (
    <>
      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 md:hidden">
        {cases.map((item, index) => {
          const coefficient =
            item.leading_coefficient ?? item.coefficient_sign ?? item.sign ?? "";
          const isPositive = normalizeComparableText(coefficient).includes("موجب");

          return (
            <article
              key={item.id || `polynomial-mobile-case-${index}`}
              className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                  {index + 1}
                </span>
                <div className="flex flex-wrap justify-end gap-2">
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-800 ring-1 ring-violet-100">
                    درجة {item.degree ?? item.parity ?? "—"}
                  </span>
                  <span className={cn(
                    "rounded-full px-3 py-1 text-xs font-black ring-1",
                    isPositive
                      ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                      : "bg-rose-50 text-rose-800 ring-rose-100",
                  )}>
                    معامل {coefficient || "—"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-100">
                <div className="bg-emerald-50/35 p-3 text-center">
                  <MathText className="mb-1 text-xs font-black text-slate-500">
                    {"\\(x\\to+\\infty\\)"}
                  </MathText>
                  <MixedArabicMath
                    value={item.at_plus_infinity ?? item.plus_infinity ?? ""}
                  />
                </div>
                <div className="bg-indigo-50/35 p-3 text-center">
                  <MathText className="mb-1 text-xs font-black text-slate-500">
                    {"\\(x\\to-\\infty\\)"}
                  </MathText>
                  <MixedArabicMath
                    value={item.at_minus_infinity ?? item.minus_infinity ?? ""}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table dir="rtl" className="w-full min-w-[760px] table-fixed text-center text-sm">
        <thead className="bg-gradient-to-l from-slate-950 via-indigo-950 to-violet-950 text-white">
          <tr>
            <th className="w-[80px] px-4 py-4 font-black">الحالة</th>
            <th className="px-4 py-4 font-black">درجة كثيرة الحدود</th>
            <th className="px-4 py-4 font-black">إشارة المعامل الرئيسي</th>
            <th className="px-4 py-4 font-black">
              <MathText as="span" className="font-black text-white">
                {"عند \\(x\\to+\\infty\\)"}
              </MathText>
            </th>
            <th className="px-4 py-4 font-black">
              <MathText as="span" className="font-black text-white">
                {"عند \\(x\\to-\\infty\\)"}
              </MathText>
            </th>
          </tr>
        </thead>

        <tbody>
          {cases.map((item, index) => {
            const degree = item.degree ?? item.parity ?? "";
            const coefficient =
              item.leading_coefficient ??
              item.coefficient_sign ??
              item.sign ??
              "";
            const plusInfinity =
              item.at_plus_infinity ??
              item.plus_infinity ??
              item.limit_at_plus_infinity ??
              "";
            const minusInfinity =
              item.at_minus_infinity ??
              item.minus_infinity ??
              item.limit_at_minus_infinity ??
              "";

            const coefficientIsPositive =
              normalizeComparableText(coefficient).includes("موجب");

            return (
              <tr
                key={item.id || `reference-case-${index}`}
                className="border-t border-slate-200 even:bg-indigo-50/35"
              >
                <td className="px-4 py-4">
                  <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-black text-white shadow-sm">
                    {index + 1}
                  </span>
                </td>

                <td className="px-4 py-4">
                  <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 font-black text-violet-800">
                    {degree}
                  </span>
                </td>

                <td className="px-4 py-4">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1.5 font-black",
                      coefficientIsPositive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-rose-200 bg-rose-50 text-rose-800",
                    )}
                  >
                    {coefficient}
                  </span>
                </td>

                <td className="px-4 py-4">
                  {renderFormulaCell(
                    plusInfinity,
                    "rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2",
                  )}
                </td>

                <td className="px-4 py-4">
                  {renderFormulaCell(
                    minusInfinity,
                    "rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2",
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </>
  );

  const renderDegreeComparisonTable = () => (
    <div className="overflow-x-auto">
      <table dir="rtl" className="w-full min-w-[700px] table-fixed text-center text-sm">
        <thead className="bg-gradient-to-l from-slate-950 via-indigo-950 to-violet-950 text-white">
          <tr>
            <th className="w-[80px] px-4 py-4 font-black">الحالة</th>
            <th className="px-4 py-4 font-black">مقارنة الدرجتين</th>
            <th className="px-4 py-4 font-black">النتيجة</th>
            <th className="px-4 py-4 font-black">كيف أتذكرها؟</th>
          </tr>
        </thead>

        <tbody>
          {cases.map((item, index) => (
            <tr
              key={item.id || `degree-comparison-${index}`}
              className="border-t border-slate-200 even:bg-indigo-50/35"
            >
              <td className="px-4 py-4">
                <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-black text-white shadow-sm">
                  {index + 1}
                </span>
              </td>

              <td className="px-4 py-4">
                {renderFormulaCell(
                  item.comparison,
                  "rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-3",
                )}
              </td>

              <td className="px-4 py-4">
                {renderFormulaCell(
                  item.result,
                  "rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3",
                )}
              </td>

              <td className="px-4 py-4 align-middle">
                <MathText className="text-center text-sm font-semibold leading-7 text-slate-700">
                  {item.memory ?? item.reasoning ?? item.explanation ?? ""}
                </MathText>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderGenericTable = () => {
    const preferredColumns = [
      "comparison",
      "degree",
      "leading_coefficient",
      "result",
      "at_plus_infinity",
      "at_minus_infinity",
      "memory",
    ];

    return (
      <DynamicDataTable
        rows={cases}
        preferredColumns={preferredColumns}
        title=""
      />
    );
  };

  const indeterminateMeta = [
    {
      title: "فرق مالانهايتين",
      accent: "from-rose-500 to-pink-600",
      surface: "border-rose-100 bg-rose-50/60",
    },
    {
      title: "صفر مضروب في مالانهاية",
      accent: "from-amber-500 to-orange-500",
      surface: "border-amber-100 bg-amber-50/60",
    },
    {
      title: "صفر على صفر",
      accent: "from-violet-500 to-indigo-600",
      surface: "border-violet-100 bg-violet-50/60",
    },
    {
      title: "مالانهاية على مالانهاية",
      accent: "from-sky-500 to-cyan-600",
      surface: "border-sky-100 bg-sky-50/60",
    },
  ];

  const renderIndeterminateForms = () => (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-rose-100 bg-gradient-to-l from-rose-50 via-white to-white px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <AlertTriangle size={21} />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-950">
                حالات عدم التعيين الأربع
              </h3>
              <p className="mt-1 text-sm font-semibold leading-7 text-slate-500">
                ظهور إحدى هذه الصيغ لا يعطي النتيجة مباشرة، بل يعني أن العبارة تحتاج إلى تحويل.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-2">
          {forms.map((item, index) => {
            const meta = indeterminateMeta[index] || indeterminateMeta[0];

            return (
              <article
                key={item.id || `indeterminate-form-${index}`}
                className={cn(
                  "group relative overflow-hidden rounded-[24px] border p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-5",
                  meta.surface,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", meta.accent)} />

                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-black text-white shadow-sm",
                      meta.accent,
                    )}>
                      {index + 1}
                    </span>
                    <h4 className="font-black leading-7 text-slate-950">
                      {meta.title}
                    </h4>
                  </div>

                  <span className="shrink-0 rounded-full border border-white/80 bg-white/80 px-2.5 py-1 text-[11px] font-black text-rose-700 shadow-sm">
                    غير معيّنة
                  </span>
                </div>

                <div className="rounded-2xl border border-white/90 bg-white px-4 py-4 text-center shadow-sm">
                  <p className="mb-2 text-[11px] font-black text-slate-500">
                    الاسم المختصر
                  </p>
                  <MathText className="text-center text-xl font-black leading-9 text-slate-950">
                    {item.short_name}
                  </MathText>
                </div>

                <div className="mt-3 rounded-2xl border border-white/90 bg-white/70 px-4 py-3.5">
                  <p className="mb-2 text-[11px] font-black text-slate-500">
                    الصيغ التي تظهر بها
                  </p>
                  <MathText className="text-center text-sm font-bold leading-8 text-slate-800 sm:text-[15px]">
                    {item.form}
                  </MathText>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {notIndeterminate.length > 0 && (
        <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-emerald-50/35 shadow-sm">
          <div className="flex items-start gap-3 border-b border-emerald-100 bg-white/75 px-5 py-4 sm:px-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">
                صيغ ليست حالات عدم تعيين
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                يمكن تطبيق القاعدة المباشرة عليها بعد تحديد الإشارة عند الحاجة.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 sm:p-5 md:grid-cols-2">
            {notIndeterminate.map((item, index) => (
              <div
                key={`not-indeterminate-${index}`}
                className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-4 shadow-sm"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white">
                  <Check size={16} />
                </span>
                <MathText className="min-w-0 flex-1 text-sm font-bold leading-7 text-slate-800">
                  {item}
                </MathText>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  const getReferenceLimitText = (limitItem) => {
    if (isEmpty(limitItem)) return "";

    if (typeof limitItem === "string" || typeof limitItem === "number") {
      return String(limitItem);
    }

    if (typeof limitItem === "object") {
      return (
        limitItem.formula ||
        limitItem.limit ||
        limitItem.expression ||
        limitItem.relation ||
        limitItem.result ||
        limitItem.value ||
        limitItem.text ||
        getDisplayText(limitItem)
      );
    }

    return String(limitItem);
  };

  const getReferenceLimitLabel = (limitText, index) => {
    const comparable = normalizeComparableText(limitText);

    if (
      comparable.includes("x\\to+\\infty") ||
      comparable.includes("x→+∞") ||
      comparable.includes("+infty")
    ) {
      return "عند المالانهاية الموجبة";
    }

    if (
      comparable.includes("x\\to-\\infty") ||
      comparable.includes("x→-∞") ||
      comparable.includes("-infty")
    ) {
      return "عند المالانهاية السالبة";
    }

    return `المرجعية ${index + 1}`;
  };

  const getReferenceTone = (limitText) => {
    const raw = String(limitText || "");

    if (raw.includes("+\\infty") || raw.includes("+∞")) {
      return {
        border: "border-emerald-100",
        bg: "bg-emerald-50/70",
        text: "text-emerald-800",
        badge: "bg-emerald-100 text-emerald-800",
      };
    }

    if (raw.includes("-\\infty") || raw.includes("-∞")) {
      return {
        border: "border-rose-100",
        bg: "bg-rose-50/70",
        text: "text-rose-800",
        badge: "bg-rose-100 text-rose-800",
      };
    }

    return {
      border: "border-sky-100",
      bg: "bg-sky-50/70",
      text: "text-sky-800",
      badge: "bg-sky-100 text-sky-800",
    };
  };

  const renderFunctionReferences = () => (
    <div className="space-y-5">
      {symbolGuide.length > 0 && (
        <section className="overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-sm">
          <div className="border-b border-indigo-100 bg-gradient-to-l from-indigo-50 via-white to-white px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <Compass size={19} />
              </span>
              <div>
                <h3 className="font-black text-slate-950">فهم الرموز المستعملة</h3>
                <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                  نميّز بين اتجاه المتغير والنتيجة التي تأخذها قيم الدالة.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 sm:p-5 md:grid-cols-2">
            {symbolGuide.map((item, index) => (
              <article
                key={item.id || `symbol-guide-${index}`}
                className="group flex min-w-0 items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex min-w-[145px] items-center justify-center border-l border-indigo-100 bg-indigo-50/70 px-4 py-4">
                  <MathText className="text-center text-base font-black text-indigo-950">
                    {item.symbol}
                  </MathText>
                </div>

                <div className="min-w-0 flex-1 p-4">
                  <p className="mb-1 text-[11px] font-black text-slate-500">المعنى</p>
                  <MathText className="text-sm font-semibold leading-7 text-slate-700">
                    {item.meaning}
                  </MathText>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[30px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20">
            <ListChecks size={20} />
          </span>
          <div>
            <h3 className="text-lg font-black text-slate-950">المرجعيات الأساسية للنهايات</h3>
            <p className="mt-1 text-sm font-semibold leading-7 text-slate-500">
              اقرأ الدالة، تذكّر سلوكها، ثم احفظ النهاية في كل جهة.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {references.map((item, index) => {
            // ندعم البنيتين:
            // 1) { function, limits, memory }
            // 2) { formula, meaning }
            const directFormula =
              item.formula ??
              item.limit ??
              item.expression ??
              item.relation ??
              "";

            const directMeaning =
              item.meaning ??
              item.explanation ??
              item.description ??
              "";

            const limits = Array.isArray(item.limits)
              ? item.limits.filter((limitItem) => !isEmpty(limitItem))
              : !isEmpty(item.limits)
                ? [item.limits]
                : !isEmpty(directFormula)
                  ? [directFormula]
                  : [];

            const referenceName =
              item.function ??
              item.name ??
              item.title ??
              `المرجعية ${index + 1}`;

            return (
              <article
                key={item.id || `function-reference-${index}`}
                className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-l from-indigo-50/80 via-white to-white px-4 py-4 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white shadow-sm">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-indigo-600">الدالة المرجعية</p>
                      <MathText className="mt-0.5 text-base font-black text-slate-950">
                        {referenceName}
                      </MathText>
                    </div>
                  </div>

                  <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600 sm:inline-flex">
                    مرجع أساسي
                  </span>
                </div>

                {item.memory && (
                  <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50/55 px-4 py-3.5 sm:px-5">
                    <Lightbulb size={17} className="mt-1 shrink-0 text-amber-600" />
                    <div className="min-w-0">
                      <p className="mb-0.5 text-[11px] font-black text-amber-700">الفكرة التي أتذكرها</p>
                      <MathText className="text-sm font-bold leading-7 text-amber-950">
                        {item.memory}
                      </MathText>
                    </div>
                  </div>
                )}

                <div className={cn(
                  "grid gap-3 p-4 sm:p-5",
                  limits.length > 1 ? "sm:grid-cols-2" : "grid-cols-1",
                )}>
                  {limits.map((limitItem, limitIndex) => {
                    const limitText = getReferenceLimitText(limitItem);
                    const tone = getReferenceTone(limitText);

                    return (
                      <div
                        key={`function-limit-${index}-${limitIndex}`}
                        className={cn(
                          "min-w-0 rounded-2xl border p-4 text-center",
                          tone.border,
                          tone.bg,
                        )}
                      >
                        <span className={cn(
                          "mb-3 inline-flex rounded-full px-3 py-1 text-[11px] font-black",
                          tone.badge,
                        )}>
                          {getReferenceLimitLabel(limitText, limitIndex)}
                        </span>

                        <MathText className={cn(
                          "text-center text-base font-black leading-9 sm:text-lg",
                          tone.text,
                        )}>
                          {limitText}
                        </MathText>
                      </div>
                    );
                  })}
                </div>

                {directMeaning && (
                  <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-5">
                    <div className="flex items-start gap-3">
                      <Lightbulb
                        size={17}
                        className="mt-1 shrink-0 text-amber-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[11px] font-black text-amber-700">
                          المعنى
                        </p>
                        <MathText className="text-sm font-semibold leading-7 text-slate-700">
                          {directMeaning}
                        </MathText>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );

  const tableTitle = isPolynomialInfinityTable
    ? "جدول الحالات الأربع"
    : isDegreeComparisonTable
      ? "جدول الحالات الثلاث"
      : "جدول الحالات";

  const tableDescription = isPolynomialInfinityTable
    ? "نحدد زوجية الدرجة وإشارة المعامل الرئيسي، ثم نقرأ النهايتين."
    : isDegreeComparisonTable
      ? "نقارن درجة البسط بدرجة المقام، ثم نقرأ النتيجة المناسبة."
      : "نقرأ كل حالة حسب المعطيات والنتيجة المرتبطة بها.";

  return (
    <div className="space-y-5">
      {content.teacher && (
        <section className="rounded-[24px] border border-indigo-100 bg-gradient-to-l from-indigo-50/80 via-white to-white p-4 shadow-sm sm:p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-indigo-700">
            <BookOpen size={17} />
            شرح الأستاذ
          </div>
          <MathText className="text-sm font-semibold leading-7 text-slate-700 sm:text-[15px]">
            {content.teacher}
          </MathText>
        </section>
      )}

      {content.how_to_think && (
        <InfoBox title="كيف أفكر؟" tone="sky" icon={Brain}>
          <MathText className="text-sm font-black leading-7">
            {content.how_to_think}
          </MathText>
        </InfoBox>
      )}

      {isIndeterminateFormsTable && renderIndeterminateForms()}

      {!isIndeterminateFormsTable && isFunctionReferencesTable &&
        renderFunctionReferences()}

      {!isIndeterminateFormsTable && !isFunctionReferencesTable && cases.length > 0 && (
        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-indigo-100 bg-gradient-to-l from-indigo-50 to-white px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <ListChecks size={18} className="text-indigo-600" />
              <div>
                <h3 className="font-black text-slate-950">{tableTitle}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {tableDescription}
                </p>
              </div>
            </div>
          </div>

          {isPolynomialInfinityTable
            ? renderPolynomialTable()
            : isDegreeComparisonTable
              ? renderDegreeComparisonTable()
              : renderGenericTable()}
        </section>
      )}

      {content.memory_tip && (
        <InfoBox title="قاعدة سهلة للحفظ" tone="amber" icon={Lightbulb}>
          <MathText className="text-sm font-black leading-7">
            {content.memory_tip}
          </MathText>
        </InfoBox>
      )}

      {content.conclusion && (
        <InfoBox title="الخلاصة" tone="emerald" icon={CheckCircle2}>
          <MathText className="text-sm font-black leading-7">
            {content.conclusion}
          </MathText>
        </InfoBox>
      )}

      {content.important_conclusion && (
        <InfoBox title="الاستنتاج المهم" tone="emerald" icon={CheckCircle2}>
          <MathText className="text-sm font-black leading-7">
            {content.important_conclusion}
          </MathText>
        </InfoBox>
      )}

      {content.attention && (
        <InfoBox title="انتبه إلى هذه النقطة" tone="rose" icon={AlertTriangle}>
          <MathText className="text-sm font-semibold leading-7">
            {content.attention}
          </MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <InfoBox title="ما يجب تذكره" tone="indigo" icon={Sparkles}>
          <MathText className="text-sm font-black leading-7">
            {content.takeaway}
          </MathText>
        </InfoBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <StructuredValue value={remainingContent} depth={1} />
        </section>
      )}
    </div>
  );
}


function DivisionByZeroConceptStep({ content = {} }) {
  const cases = Array.isArray(content.examples)
    ? content.examples.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const signSteps = Array.isArray(content.sign_method)
    ? content.sign_method.filter(Boolean)
    : [];

  const manuallyRenderedKeys = new Set([
    "teacher",
    "setting",
    "examples",
    "sign_method",
    "how_to_think",
    "indeterminate_warning",
    "attention",
    "memory_tip",
    "takeaway",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {content.teacher && (
        <section className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-sm">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
              <BookOpen size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-black text-sky-700">شرح الأستاذ</p>
              <MathText className="text-[15px] font-semibold leading-8 text-slate-700">
                {content.teacher}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {content.setting && (
        <section className="overflow-hidden rounded-[28px] border border-indigo-200 bg-gradient-to-l from-indigo-950 via-violet-950 to-slate-950 p-5 text-white shadow-lg shadow-indigo-500/10 sm:p-7">
          <div className="mb-3 flex items-center gap-2 text-xs font-black text-indigo-200">
            <Target size={17} />
            الوضعية المدروسة
          </div>
          <MathJax dynamic hideUntilTypeset="first">
            <div
              dir="ltr"
              className="overflow-x-auto text-center text-xl font-black leading-10 sm:text-2xl [&_mjx-container]:mx-auto [&_mjx-container]:block"
            >
              {`\\[${getPureMathExpression(content.setting)}\\]`}
            </div>
          </MathJax>
          <p className="mt-3 text-center text-sm font-bold leading-7 text-indigo-100">
            القيمة المطلقة للخارج تصبح كبيرة، وتبقى الإشارة هي التي تحدد النتيجة.
          </p>
        </section>
      )}

      {cases.length > 0 && (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50/65 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <ListChecks size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">الحالات الأربع للإشارة</h3>
              <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                نقرأ إشارة البسط، ثم جهة اقتراب المقام من الصفر، ثم نستنتج إشارة المالانهاية.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {cases.map((item, index) => {
              const form = item.form || item.condition || item.question || "";
              const result = item.result || item.answer || item.conclusion || "";
              const isPositive = String(result).includes("+\\infty");

              return (
                <article
                  key={item.id || `zero-denominator-case-${index}`}
                  className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-l from-indigo-50/80 to-white px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-xs font-black text-indigo-700">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
                        {index + 1}
                      </span>
                      الحالة {index + 1}
                    </span>
                    <span className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-black",
                      isPositive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800",
                    )}>
                      {isPositive ? "النتيجة موجبة" : "النتيجة سالبة"}
                    </span>
                  </div>

                  <div className="grid items-stretch sm:grid-cols-[minmax(0,1fr)_56px_minmax(150px,0.55fr)]">
                    <div className="flex min-h-[130px] flex-col justify-center p-4 sm:p-5">
                      <p className="mb-2 text-[11px] font-black text-slate-500">المعطيات والإشارات</p>
                      <MathText className="text-center text-base font-black leading-9 text-slate-950">
                        {form}
                      </MathText>
                    </div>

                    <div className="hidden items-center justify-center border-x border-slate-100 bg-slate-50/70 sm:flex">
                      <ArrowLeft size={24} className="text-indigo-400 transition group-hover:-translate-x-0.5" />
                    </div>

                    <div className={cn(
                      "flex min-h-[130px] flex-col items-center justify-center border-t border-slate-100 p-4 sm:border-t-0",
                      isPositive ? "bg-emerald-50/75" : "bg-rose-50/75",
                    )}>
                      <p className={cn(
                        "mb-2 text-[11px] font-black",
                        isPositive ? "text-emerald-700" : "text-rose-700",
                      )}>
                        نهاية الخارج
                      </p>
                      <MathJax dynamic hideUntilTypeset="first">
                        <div
                          dir="ltr"
                          className={cn(
                            "text-center text-2xl font-black [&_mjx-container]:m-0",
                            isPositive ? "text-emerald-950" : "text-rose-950",
                          )}
                        >
                          {`\\[${getPureMathExpression(result)}\\]`}
                        </div>
                      </MathJax>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {signSteps.length > 0 && (
        <section className="rounded-[28px] border border-indigo-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
              <Route size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">كيف أحدد الإشارة؟</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">اتبع الخطوات بالترتيب، ولا تنتقل إلى النتيجة مباشرة.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {signSteps.map((stepText, index) => (
              <div
                key={`sign-method-${index}`}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/65 p-4"
              >
                <span className="absolute -left-1 -top-5 text-7xl font-black text-indigo-100/80">
                  {index + 1}
                </span>
                <div className="relative flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <MathText className="text-sm font-black leading-7 text-slate-800">
                    {stepText}
                  </MathText>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {content.how_to_think && (
        <InfoBox title="الفكرة السريعة" tone="sky" icon={Brain} compact={false}>
          <MathText className="font-black leading-8">{content.how_to_think}</MathText>
        </InfoBox>
      )}

      {content.indeterminate_warning && (
        <section className="overflow-hidden rounded-[26px] border border-rose-200 bg-gradient-to-l from-rose-50 to-white shadow-sm">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <XCircle size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1.5 font-black text-rose-950">انتبه: حالة مختلفة تمامًا</h3>
              <MathText className="font-black leading-8 text-rose-950">
                {content.indeterminate_warning}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {content.attention && (
        <section className="flex items-start gap-3 rounded-[26px] border border-amber-200 bg-amber-50/75 p-5 shadow-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
            <AlertTriangle size={19} />
          </span>
          <div className="min-w-0">
            <h3 className="mb-1 text-sm font-black text-amber-950">خطأ يجب تجنبه</h3>
            <MathText className="font-black leading-8 text-amber-950">
              {content.attention}
            </MathText>
          </div>
        </section>
      )}

      {content.memory_tip && (
        <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb} compact={false}>
          <MathText className="font-bold leading-8">{content.memory_tip}</MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <InfoBox title="الخلاصة" tone="emerald" icon={CheckCircle2} compact={false}>
          <MathText className="font-black leading-8">{content.takeaway}</MathText>
        </InfoBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <StructuredValue value={remainingContent} depth={1} />
        </section>
      )}
    </div>
  );
}


function InfinityMinusInfinityConceptStep({ content = {} }) {
  const forms = Array.isArray(content.forms)
    ? content.forms.filter(Boolean)
    : [];

  const directExamples = Array.isArray(content.not_indeterminate_examples)
    ? content.not_indeterminate_examples.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const manuallyRenderedKeys = new Set([
    "teacher",
    "short_form",
    "forms",
    "reason",
    "how_to_think",
    "not_indeterminate_examples",
    "attention",
    "memory_tip",
    "takeaway",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {content.teacher && (
        <section className="overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-sm">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <BookOpen size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-black text-indigo-700">شرح الأستاذ</p>
              <MathText className="text-[15px] font-semibold leading-8 text-slate-700">
                {content.teacher}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {content.short_form && (
        <section className="relative overflow-hidden rounded-[30px] border border-violet-300/30 bg-[linear-gradient(135deg,#111827_0%,#312e81_55%,#5b21b6_100%)] px-5 py-7 text-white shadow-[0_20px_50px_-25px_rgba(79,70,229,0.8)] sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-center gap-2 text-xs font-black text-violet-200">
              <CircleHelp size={17} />
              الشكل المختصر للحالة
            </div>
            <MathJax dynamic hideUntilTypeset="first">
              <div
                dir="ltr"
                className="overflow-x-auto text-center text-3xl font-black leading-[1.7] sm:text-4xl [&_mjx-container]:mx-auto [&_mjx-container]:block"
              >
                {`\\[${getPureMathExpression(content.short_form)}\\]`}
              </div>
            </MathJax>
            <p className="mt-3 text-center text-sm font-bold leading-7 text-violet-100">
              لا نحكم على النتيجة مباشرة، لأن سرعة نمو الحدين قد تكون مختلفة.
            </p>
          </div>
        </section>
      )}

      {forms.length > 0 && (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50/65 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <ListChecks size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">الصيغ التي تمثل هذه الحالة</h3>
              <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                عندما تكون المالانهايتان في الاتجاه نفسه ثم نطرح إحداهما من الأخرى.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {forms.map((form, index) => (
              <article
                key={`infinity-minus-form-${index}`}
                className="group overflow-hidden rounded-[24px] border border-violet-100 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between border-b border-violet-100 bg-gradient-to-l from-violet-50 to-white px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-xs font-black text-violet-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white">
                      {index + 1}
                    </span>
                    الصيغة {index + 1}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800">
                    غير معيّنة مباشرة
                  </span>
                </div>

                <div className="flex min-h-[130px] items-center justify-center p-5">
                  <MathJax dynamic hideUntilTypeset="first">
                    <div
                      dir="ltr"
                      className="overflow-x-auto text-center text-xl font-black text-slate-950 sm:text-2xl [&_mjx-container]:mx-auto [&_mjx-container]:block"
                    >
                      {`\\[${getPureMathExpression(form)}\\]`}
                    </div>
                  </MathJax>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {content.reason && (
        <section className="overflow-hidden rounded-[26px] border border-sky-200 bg-gradient-to-l from-sky-50/90 to-white shadow-sm">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Brain size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 text-sm font-black text-sky-950">لماذا هي حالة عدم تعيين؟</h3>
              <MathText className="font-semibold leading-8 text-sky-950">
                {content.reason}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {directExamples.length > 0 && (
        <section className="rounded-[30px] border border-emerald-200 bg-emerald-50/45 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <CheckCircle2 size={19} />
            </span>
            <div>
              <h3 className="font-black text-emerald-950">أمثلة ليست حالات عدم تعيين</h3>
              <p className="mt-1 text-xs font-semibold leading-6 text-emerald-800/75">
                هنا الإشارات مختلفة أو يوجد عدد حقيقي، لذلك نستطيع تحديد النتيجة مباشرة.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {directExamples.map((item, index) => {
              const form = item.form || item.expression || item.question || "";
              const result = item.result || item.answer || item.conclusion || "";

              return (
                <article
                  key={item.id || `direct-infinity-example-${index}`}
                  className="group overflow-hidden rounded-[24px] border border-emerald-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="border-b border-emerald-100 bg-gradient-to-l from-emerald-50 to-white px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-xs font-black text-emerald-800">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                        {index + 1}
                      </span>
                      مثال مباشر
                    </span>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                      <p className="mb-2 text-[11px] font-black text-slate-500">الصيغة</p>
                      <MathText className="text-center text-base font-black leading-8 text-slate-950">
                        {form}
                      </MathText>
                    </div>

                    <div className="flex items-center justify-center text-emerald-400">
                      <ArrowLeft size={22} />
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5">
                      <p className="mb-2 text-[11px] font-black text-emerald-700">النتيجة</p>
                      <MathText className="text-center text-lg font-black leading-8 text-emerald-950">
                        {result}
                      </MathText>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {content.how_to_think && (
        <InfoBox title="كيف أفكر؟" tone="indigo" icon={Route} compact={false}>
          <MathText className="font-black leading-8">{content.how_to_think}</MathText>
        </InfoBox>
      )}

      {content.attention && (
        <section className="flex items-start gap-3 rounded-[26px] border border-rose-200 bg-rose-50/75 p-5 shadow-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm">
            <AlertTriangle size={19} />
          </span>
          <div className="min-w-0">
            <h3 className="mb-1 text-sm font-black text-rose-950">انتبه إلى الصيغة المكافئة</h3>
            <MathText className="font-black leading-8 text-rose-950">
              {content.attention}
            </MathText>
          </div>
        </section>
      )}

      {content.memory_tip && (
        <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb} compact={false}>
          <MathText className="font-bold leading-8">{content.memory_tip}</MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <InfoBox title="الخلاصة" tone="emerald" icon={CheckCircle2} compact={false}>
          <MathText className="font-black leading-8">{content.takeaway}</MathText>
        </InfoBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <StructuredValue value={remainingContent} depth={1} />
        </section>
      )}
    </div>
  );
}


function ZeroOverZeroConceptStep({ content = {} }) {
  const examples = Array.isArray(content.not_indeterminate_examples)
    ? content.not_indeterminate_examples.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const manuallyRenderedKeys = new Set([
    "teacher",
    "form",
    "reason",
    "how_to_think",
    "important_note",
    "not_indeterminate_examples",
    "attention",
    "memory_tip",
    "takeaway",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {content.teacher && (
        <section className="overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-sm">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <BookOpen size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-black text-indigo-700">شرح الأستاذ</p>
              <MathText className="text-[15px] font-semibold leading-8 text-slate-700">
                {content.teacher}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {content.form && (
        <section className="relative overflow-hidden rounded-[30px] border border-rose-300/30 bg-[linear-gradient(135deg,#111827_0%,#4c1d95_55%,#be123c_100%)] px-5 py-7 text-white shadow-[0_20px_50px_-25px_rgba(190,24,93,0.75)] sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-center gap-2 text-xs font-black text-rose-100">
              <CircleHelp size={17} />
              الشكل غير المعيّن
            </div>
            <MathJax dynamic hideUntilTypeset="first">
              <div
                dir="ltr"
                className="overflow-x-auto text-center text-4xl font-black leading-[1.7] sm:text-5xl [&_mjx-container]:mx-auto [&_mjx-container]:block"
              >
                {`\[${getPureMathExpression(content.form)}\]`}
              </div>
            </MathJax>
            <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-bold leading-7 text-rose-50 backdrop-blur">
              لا نختزل هذا الشكل، لأن البسط والمقام قد يقتربان من الصفر بسرعات مختلفة.
            </div>
          </div>
        </section>
      )}

      {content.reason && (
        <section className="overflow-hidden rounded-[26px] border border-sky-200 bg-gradient-to-l from-sky-50/90 to-white shadow-sm">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Brain size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 text-sm font-black text-sky-950">لماذا لا نحدد النتيجة مباشرة؟</h3>
              <MathText className="font-semibold leading-8 text-sky-950">
                {content.reason}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {content.how_to_think && (
        <section className="rounded-[26px] border border-violet-200 bg-violet-50/55 p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <Route size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 text-sm font-black text-violet-950">كيف أفكر؟</h3>
              <MathText className="font-black leading-8 text-violet-950">
                {content.how_to_think}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {content.important_note && (
        <section className="overflow-hidden rounded-[26px] border border-amber-200 bg-amber-50/70 shadow-sm">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Lightbulb size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 text-sm font-black text-amber-950">ملاحظة مهمة</h3>
              <MathText className="font-semibold leading-8 text-amber-950">
                {content.important_note}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {examples.length > 0 && (
        <section className="rounded-[30px] border border-emerald-200 bg-emerald-50/45 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <CheckCircle2 size={19} />
            </span>
            <div>
              <h3 className="font-black text-emerald-950">أمثلة ليست صفرًا على صفر</h3>
              <p className="mt-1 text-xs font-semibold leading-6 text-emerald-800/75">
                في هذه الأمثلة لا يؤول البسط والمقام معًا إلى الصفر، لذلك النتيجة مباشرة.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {examples.map((item, index) => {
              const form = item.form || item.expression || item.question || "";
              const result = item.result || item.answer || item.conclusion || "";

              return (
                <article
                  key={item.id || `zero-over-zero-direct-${index}`}
                  className="group overflow-hidden rounded-[24px] border border-emerald-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-emerald-100 bg-gradient-to-l from-emerald-50 to-white px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-xs font-black text-emerald-800">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                        {index + 1}
                      </span>
                      مثال مباشر
                    </span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800">
                      معيّن
                    </span>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                      <p className="mb-2 text-[11px] font-black text-slate-500">الصيغة</p>
                      <MathText className="text-center text-lg font-black leading-9 text-slate-950">
                        {form}
                      </MathText>
                    </div>

                    <div className="flex items-center justify-center text-emerald-400">
                      <ArrowLeft size={22} />
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5">
                      <p className="mb-2 text-[11px] font-black text-emerald-700">النتيجة</p>
                      <MathText className="text-center text-xl font-black leading-9 text-emerald-950">
                        {result}
                      </MathText>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {content.attention && (
        <section className="flex items-start gap-3 rounded-[26px] border border-rose-200 bg-rose-50/75 p-5 shadow-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm">
            <AlertTriangle size={19} />
          </span>
          <div className="min-w-0">
            <h3 className="mb-1 text-sm font-black text-rose-950">خطأ يجب تجنبه</h3>
            <MathText className="font-black leading-8 text-rose-950">
              {content.attention}
            </MathText>
          </div>
        </section>
      )}

      {content.memory_tip && (
        <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb} compact={false}>
          <MathText className="font-bold leading-8">{content.memory_tip}</MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <InfoBox title="الخلاصة" tone="emerald" icon={CheckCircle2} compact={false}>
          <MathText className="font-black leading-8">{content.takeaway}</MathText>
        </InfoBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <StructuredValue value={remainingContent} depth={1} />
        </section>
      )}
    </div>
  );
}


function FiniteCompositionConceptStep({ content = {} }) {
  const examples = Array.isArray(content.examples)
    ? content.examples.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const manuallyRenderedKeys = new Set([
    "teacher",
    "setting",
    "examples",
    "application",
    "attention",
    "how_to_think",
    "memory_tip",
    "takeaway",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {content.teacher && (
        <section className="overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-sm">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <BookOpen size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-black text-indigo-700">شرح الأستاذ</p>
              <MathText className="text-[15px] font-semibold leading-8 text-slate-700">
                {content.teacher}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {content.setting && (
        <section className="relative overflow-hidden rounded-[30px] border border-cyan-300/30 bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_52%,#0891b2_100%)] px-5 py-7 text-white shadow-[0_22px_55px_-28px_rgba(8,145,178,0.8)] sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute -left-14 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-10 h-52 w-52 rounded-full bg-cyan-300/15 blur-3xl" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-center gap-2 text-xs font-black text-cyan-100">
              <Target size={17} />
              المعطى الأساسي
            </div>
            <MathJax dynamic hideUntilTypeset="first">
              <div
                dir="ltr"
                className="overflow-x-auto text-center text-2xl font-black leading-[1.8] sm:text-3xl [&_mjx-container]:mx-auto [&_mjx-container]:block"
              >
                {`\\[${getPureMathExpression(content.setting)}\\]`}
              </div>
            </MathJax>
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm font-semibold leading-7 text-cyan-50/90">
              نبدأ بالدالة الداخلية، ثم ننتقل إلى الدالة الخارجية عند العدد الذي حصلنا عليه.
            </p>
          </div>
        </section>
      )}

      {examples.length > 0 && (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50/55 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <Route size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">نتتبع التركيب خطوة بخطوة</h3>
              <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                الدالة الداخلية أولًا، ثم الدالة الخارجية، ثم النتيجة النهائية.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {examples.map((item, index) => {
              const composite =
                item.composite || item.expression || item.form || item.question || "";
              const innerLimit =
                item.inner_limit || item.inner || item.first_step || item.step_1 || "";
              const outerLimit =
                item.outer_limit || item.outer || item.second_step || item.step_2 || "";
              const result =
                item.result || item.answer || item.conclusion || item.final_answer || "";

              const knownKeys = new Set([
                "id",
                "composite",
                "expression",
                "form",
                "question",
                "inner_limit",
                "inner",
                "first_step",
                "step_1",
                "outer_limit",
                "outer",
                "second_step",
                "step_2",
                "result",
                "answer",
                "conclusion",
                "final_answer",
              ]);

              const extraValues = Object.fromEntries(
                Object.entries(item).filter(
                  ([key, value]) => !knownKeys.has(key) && !isEmpty(value),
                ),
              );

              return (
                <article
                  key={item.id || `finite-composition-example-${index}`}
                  className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-violet-100 bg-gradient-to-l from-violet-50 via-white to-cyan-50 px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white">
                        {index + 1}
                      </span>
                      <h4 className="font-black text-slate-950">مثال تطبيقي</h4>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800">
                      تركيب مباشر
                    </span>
                  </div>

                  <div className="p-4 sm:p-5">
                    {composite && (
                      <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-center">
                        <p className="mb-2 text-[11px] font-black text-indigo-700">الدالة المركبة</p>
                        <MathText className="text-xl font-black leading-10 text-indigo-950">
                          {composite}
                        </MathText>
                      </div>
                    )}

                    <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_0.72fr]">
                      {innerLimit && (
                        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                          <div className="mb-2 flex items-center gap-2 text-sky-800">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-xs font-black text-white">1</span>
                            <p className="text-xs font-black">نهاية الداخل</p>
                          </div>
                          <MathText className="text-center text-sm font-bold leading-8 text-sky-950">
                            {innerLimit}
                          </MathText>
                        </div>
                      )}

                      {innerLimit && outerLimit && (
                        <div className="hidden items-center justify-center text-2xl font-black text-slate-300 lg:flex">
                          ←
                        </div>
                      )}

                      {outerLimit && (
                        <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
                          <div className="mb-2 flex items-center gap-2 text-violet-800">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-xs font-black text-white">2</span>
                            <p className="text-xs font-black">نهاية الخارج</p>
                          </div>
                          <MathText className="text-center text-sm font-bold leading-8 text-violet-950">
                            {outerLimit}
                          </MathText>
                        </div>
                      )}

                      {(innerLimit || outerLimit) && result && (
                        <div className="hidden items-center justify-center text-2xl font-black text-slate-300 lg:flex">
                          ←
                        </div>
                      )}

                      {result && (
                        <div className="flex flex-col justify-center rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-center">
                          <div className="mb-2 flex items-center justify-center gap-2 text-emerald-800">
                            <CheckCircle2 size={17} />
                            <p className="text-xs font-black">النتيجة</p>
                          </div>
                          <MathText className="text-2xl font-black leading-10 text-emerald-950">
                            {result}
                          </MathText>
                        </div>
                      )}
                    </div>

                    {Object.keys(extraValues).length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/65 p-4">
                        <StructuredValue value={extraValues} depth={1} />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {content.application && (
        <section className="overflow-hidden rounded-[28px] border border-emerald-200 bg-white shadow-sm">
          <div className="grid items-stretch md:grid-cols-[auto_1fr]">
            <div className="flex min-h-[110px] items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-5 text-white">
              <div className="text-center">
                <Sparkles className="mx-auto mb-2" size={21} />
                <p className="text-xs font-black">القاعدة التطبيقية</p>
              </div>
            </div>
            <div className="flex items-center justify-center p-5 sm:p-6">
              <MathText className="text-center text-lg font-black leading-10 text-emerald-950 sm:text-xl">
                {content.application}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {content.how_to_think && (
        <InfoBox title="كيف أفكر؟" tone="indigo" icon={Brain} compact={false}>
          <MathText className="font-black leading-8">{content.how_to_think}</MathText>
        </InfoBox>
      )}

      {content.attention && (
        <section className="flex items-start gap-3 rounded-[26px] border border-rose-200 bg-rose-50/75 p-5 shadow-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm">
            <AlertTriangle size={19} />
          </span>
          <div className="min-w-0">
            <h3 className="mb-1 text-sm font-black text-rose-950">شرط يجب التحقق منه</h3>
            <MathText className="font-black leading-8 text-rose-950">
              {content.attention}
            </MathText>
          </div>
        </section>
      )}

      {content.memory_tip && (
        <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb} compact={false}>
          <MathText className="font-bold leading-8">{content.memory_tip}</MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <InfoBox title="الخلاصة" tone="emerald" icon={CheckCircle2} compact={false}>
          <MathText className="font-black leading-8">{content.takeaway}</MathText>
        </InfoBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <StructuredValue value={remainingContent} depth={1} />
        </section>
      )}
    </div>
  );
}


function PowerCompositionConceptStep({ content = {} }) {
  const cases = Array.isArray(content.cases)
    ? content.cases.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const manuallyRenderedKeys = new Set([
    "teacher",
    "cases",
    "attention",
    "how_to_think",
    "memory_tip",
    "takeaway",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {content.teacher && (
        <section className="overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-sm">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <BookOpen size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-black text-indigo-700">شرح الأستاذ</p>
              <MathText className="text-[15px] font-semibold leading-8 text-slate-700">
                {content.teacher}
              </MathText>
            </div>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-[30px] border border-violet-300/30 bg-[linear-gradient(135deg,#111827_0%,#312e81_52%,#6d28d9_100%)] px-5 py-7 text-white shadow-[0_22px_55px_-28px_rgba(109,40,217,0.8)] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-12 h-52 w-52 rounded-full bg-fuchsia-300/15 blur-3xl" />
        <div className="relative text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-black text-violet-100">
            <Sparkles size={17} />
            الفكرة العامة
          </div>
          <MathJax dynamic hideUntilTypeset="first">
            <div
              dir="ltr"
              className="overflow-x-auto text-center text-2xl font-black leading-[1.8] sm:text-3xl [&_mjx-container]:mx-auto [&_mjx-container]:block"
            >
              {"\\[[g(x)]^n\\]"}
            </div>
          </MathJax>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-7 text-violet-50/90">
            نحدد أولًا نهاية الدالة الداخلية، ثم ننظر إلى زوجية القوة أو فرديتها عند الحاجة.
          </p>
        </div>
      </section>

      {cases.length > 0 && (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <ListChecks size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">حالات القوة الأربع</h3>
              <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                اقرأ نهاية الداخل، ثم شرط الدرجة إن وُجد، ثم النتيجة.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {cases.map((item, index) => {
              const innerLimit =
                item.inner_limit || item.setting || item.condition || "";
              const degree = item.degree || item.parity || "";
              const result =
                item.result || item.answer || item.conclusion || "";

              const isNegativeResult = /-\\infty|−∞/.test(String(result));
              const resultClasses = isNegativeResult
                ? "border-rose-200 bg-rose-50/80 text-rose-950"
                : "border-emerald-200 bg-emerald-50/80 text-emerald-950";

              return (
                <article
                  key={item.id || `power-composition-case-${index}`}
                  className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-violet-100 bg-gradient-to-l from-violet-50 via-white to-indigo-50 px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white">
                        {index + 1}
                      </span>
                      <h4 className="font-black text-slate-950">الحالة {index + 1}</h4>
                    </div>
                    {degree && (
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-black text-indigo-800">
                        الدرجة: {degree}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 items-stretch gap-3 p-4 sm:p-5 md:grid-cols-[1fr_auto_0.8fr]">
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                      <p className="mb-2 text-xs font-black text-sky-800">نهاية الدالة الداخلية</p>
                      <MathText className="text-center text-base font-black leading-9 text-sky-950">
                        {innerLimit}
                      </MathText>
                    </div>

                    <div className="hidden items-center justify-center text-2xl font-black text-slate-300 md:flex">
                      ←
                    </div>

                    <div className={cn("flex flex-col justify-center rounded-2xl border p-4 text-center", resultClasses)}>
                      <div className="mb-2 flex items-center justify-center gap-2">
                        <CheckCircle2 size={17} />
                        <p className="text-xs font-black">النتيجة</p>
                      </div>
                      <MathText className="text-lg font-black leading-10">
                        {result}
                      </MathText>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {content.how_to_think && (
        <InfoBox title="كيف أفكر؟" tone="indigo" icon={Brain} compact={false}>
          <MathText className="font-black leading-8">{content.how_to_think}</MathText>
        </InfoBox>
      )}

      {content.attention && (
        <section className="flex items-start gap-3 rounded-[26px] border border-rose-200 bg-rose-50/75 p-5 shadow-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm">
            <AlertTriangle size={19} />
          </span>
          <div className="min-w-0">
            <h3 className="mb-1 text-sm font-black text-rose-950">انتبه إلى الأقواس</h3>
            <MathText className="font-black leading-8 text-rose-950">
              {content.attention}
            </MathText>
          </div>
        </section>
      )}

      {content.memory_tip && (
        <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb} compact={false}>
          <MathText className="font-bold leading-8">{content.memory_tip}</MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <InfoBox title="الخلاصة" tone="emerald" icon={CheckCircle2} compact={false}>
          <MathText className="font-black leading-8">{content.takeaway}</MathText>
        </InfoBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <StructuredValue value={remainingContent} depth={1} />
        </section>
      )}
    </div>
  );
}


function ReciprocalCompositionConceptStep({ content = {} }) {
  const cases = Array.isArray(content.cases)
    ? content.cases.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const manuallyRenderedKeys = new Set([
    "teacher",
    "cases",
    "attention",
    "how_to_think",
    "memory_tip",
    "takeaway",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {content.teacher && (
        <section className="rounded-[28px] border border-sky-100 bg-gradient-to-l from-sky-50/80 via-white to-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
              <BookOpen size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-black text-sky-700">شرح الأستاذ</p>
              <MathText className="text-[15px] font-semibold leading-8 text-slate-700">
                {content.teacher}
              </MathText>
            </div>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-[30px] border border-cyan-300/30 bg-[linear-gradient(135deg,#0f172a_0%,#164e63_52%,#0891b2_100%)] px-5 py-7 text-white shadow-[0_22px_55px_-28px_rgba(8,145,178,0.85)] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-black text-cyan-100">
            <Sparkles size={17} />
            الفكرة العامة
          </div>
          <MathJax dynamic hideUntilTypeset="first">
            <div dir="ltr" className="overflow-x-auto text-center text-2xl font-black leading-[1.8] sm:text-3xl [&_mjx-container]:mx-auto [&_mjx-container]:block">
              {"\\[\\frac{1}{g(x)}\\]"}
            </div>
          </MathJax>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-7 text-cyan-50/90">
            نحدد نهاية الدالة الداخلية أولًا، ثم نقرأ سلوك مقلوبها مع الانتباه إلى جهة الاقتراب من الصفر.
          </p>
        </div>
      </section>

      {cases.length > 0 && (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50/65 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-white">
              <ListChecks size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">حالات مقلوب الدالة</h3>
              <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                ابدأ بنهاية الداخل، ثم انتقل مباشرة إلى نهاية المقلوب.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {cases.map((item, index) => {
              const innerLimit = item.inner_limit || item.condition || item.setting || "";
              const result = item.result || item.answer || item.conclusion || "";
              const resultText = String(result);
              const negative = /-\\infty|−∞/.test(resultText);
              const zero = /(?:\\to)?0(?:\\\)|$)/.test(resultText) && !/infty/.test(resultText);
              const resultTone = negative
                ? "border-rose-200 bg-rose-50/80 text-rose-950"
                : zero
                  ? "border-indigo-200 bg-indigo-50/80 text-indigo-950"
                  : "border-emerald-200 bg-emerald-50/80 text-emerald-950";

              return (
                <article key={item.id || `reciprocal-case-${index}`} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center gap-2 border-b border-cyan-100 bg-gradient-to-l from-cyan-50 via-white to-sky-50 px-4 py-3 sm:px-5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-600 text-sm font-black text-white">{index + 1}</span>
                    <h4 className="font-black text-slate-950">الحالة {index + 1}</h4>
                  </div>
                  <div className="grid grid-cols-1 items-stretch gap-3 p-4 sm:p-5 md:grid-cols-[1fr_auto_0.9fr]">
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                      <p className="mb-2 text-xs font-black text-sky-800">نهاية الدالة الداخلية</p>
                      <MathText className="text-center text-base font-black leading-9 text-sky-950">{innerLimit}</MathText>
                    </div>
                    <div className="hidden items-center justify-center text-2xl font-black text-slate-300 md:flex">←</div>
                    <div className={cn("flex flex-col justify-center rounded-2xl border p-4 text-center", resultTone)}>
                      <p className="mb-2 text-xs font-black">نهاية المقلوب</p>
                      <MathText className="text-lg font-black leading-10">{result}</MathText>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {content.how_to_think && (
        <InfoBox title="كيف أفكر؟" tone="sky" icon={Brain} compact={false}>
          <MathText className="font-black leading-8">{content.how_to_think}</MathText>
        </InfoBox>
      )}

      {content.attention && (
        <section className="flex items-start gap-3 rounded-[26px] border border-rose-200 bg-rose-50/75 p-5 shadow-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm"><AlertTriangle size={19} /></span>
          <div className="min-w-0">
            <h3 className="mb-1 text-sm font-black text-rose-950">انتبه إلى جهة الصفر</h3>
            <MathText className="font-black leading-8 text-rose-950">{content.attention}</MathText>
          </div>
        </section>
      )}

      {content.memory_tip && (
        <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb} compact={false}>
          <MathText className="font-bold leading-8">{content.memory_tip}</MathText>
        </InfoBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <StructuredValue value={remainingContent} depth={1} />
        </section>
      )}
    </div>
  );
}

function CompositionDomainConceptStep({ content = {} }) {
  const conditions = Array.isArray(content.common_conditions)
    ? content.common_conditions.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const manuallyRenderedKeys = new Set([
    "teacher",
    "common_conditions",
    "example",
    "attention",
    "how_to_think",
    "memory_tip",
    "takeaway",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {content.teacher && (
        <section className="rounded-[28px] border border-indigo-100 bg-gradient-to-l from-indigo-50/75 via-white to-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm"><BookOpen size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-black text-indigo-700">شرح الأستاذ</p>
              <MathText className="text-[15px] font-semibold leading-8 text-slate-700">{content.teacher}</MathText>
            </div>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-[30px] border border-violet-300/30 bg-[linear-gradient(135deg,#111827_0%,#312e81_55%,#7c3aed_100%)] px-5 py-7 text-white shadow-[0_22px_55px_-28px_rgba(124,58,237,0.8)] sm:px-8 sm:py-9">
        <div className="relative text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-black text-violet-100"><Compass size={17} />الفكرة الأساسية</div>
          <h3 className="text-xl font-black leading-9 sm:text-2xl">قيمة الداخل يجب أن تبقى داخل مجال الدالة الخارجية</h3>
          <p className="mx-auto mt-3 max-w-3xl text-sm font-semibold leading-7 text-violet-50/90">قبل تطبيق قاعدة التركيب، افحص شرط تعريف الدالة الخارجية قرب النقطة أو الجهة المدروسة.</p>
        </div>
      </section>

      {conditions.length > 0 && (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50/65 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white"><ListChecks size={19} /></span>
            <div>
              <h3 className="font-black text-slate-950">شروط شائعة للدالة الخارجية</h3>
              <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">اربط كل دالة خارجية بشرط مجالها قبل حساب النهاية.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {conditions.map((item, index) => {
              const outerFunction = item.outer_function || item.function || item.expression || "";
              const condition = item.condition || item.domain || item.requirement || "";
              return (
                <article key={item.id || `domain-condition-${index}`} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-violet-100 bg-gradient-to-l from-violet-50 to-white px-4 py-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white">{index + 1}</span>
                    <h4 className="font-black text-slate-950">شرط المجال {index + 1}</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-4 sm:p-5 sm:grid-cols-2">
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-center">
                      <p className="mb-2 text-xs font-black text-indigo-700">الدالة الخارجية</p>
                      <MathText className="text-lg font-black leading-10 text-indigo-950">{outerFunction}</MathText>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/75 p-4 text-center">
                      <p className="mb-2 text-xs font-black text-emerald-700">شرط التعريف</p>
                      <MathText className="text-lg font-black leading-10 text-emerald-950">{condition}</MathText>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {content.example && (
        <section className="rounded-[26px] border border-sky-200 bg-sky-50/70 p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sky-800"><GraduationCap size={18} /><h3 className="font-black">مثال توضيحي</h3></div>
          <MathText className="font-black leading-8 text-sky-950">{content.example}</MathText>
        </section>
      )}

      {content.how_to_think && (
        <InfoBox title="كيف أتحقق؟" tone="indigo" icon={Brain} compact={false}>
          <MathText className="font-black leading-8">{content.how_to_think}</MathText>
        </InfoBox>
      )}

      {content.attention && (
        <section className="flex items-start gap-3 rounded-[26px] border border-rose-200 bg-rose-50/75 p-5 shadow-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm"><AlertTriangle size={19} /></span>
          <div className="min-w-0"><h3 className="mb-1 text-sm font-black text-rose-950">انتبه إلى جهة النهاية</h3><MathText className="font-black leading-8 text-rose-950">{content.attention}</MathText></div>
        </section>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5"><StructuredValue value={remainingContent} depth={1} /></section>
      )}
    </div>
  );
}


/* =========================================================
   Compact ln-domain examples
   يعرض valid_examples / invalid_examples بدون بطاقات ضخمة
========================================================= */

function LnDomainExamples({
  validExamples = [],
  invalidExamples = [],
}) {
  const valid = Array.isArray(validExamples)
    ? validExamples.filter((item) => !isEmpty(item))
    : [];

  const invalid = Array.isArray(invalidExamples)
    ? invalidExamples.filter((item) => !isEmpty(item))
    : [];

  if (valid.length === 0 && invalid.length === 0) return null;

  const renderExample = (item, index, tone) => {
    const isValid = tone === "valid";

    return (
      <div
        key={`${tone}-${index}`}
        className={cn(
          "flex min-h-[62px] items-center justify-center rounded-2xl border px-4 py-3 shadow-sm",
          "transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
          isValid
            ? "border-emerald-200 bg-emerald-50/60"
            : "border-rose-200 bg-rose-50/60",
        )}
      >
        <MathJax dynamic hideUntilTypeset="first">
          <div
            dir="ltr"
            className={cn(
              "w-full overflow-x-auto text-center text-[15px] font-black sm:text-base",
              "[&_mjx-container]:mx-auto [&_mjx-container]:inline-block",
              "[&_mjx-container]:max-w-full",
              isValid ? "text-emerald-950" : "text-rose-950",
            )}
          >
            {`\\(${getPureMathExpression(getDisplayText(item) || item)}\\)`}
          </div>
        </MathJax>
      </div>
    );
  };

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {valid.length > 0 && (
        <div className="overflow-hidden rounded-[24px] border border-emerald-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50/80 px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <CheckCircle2 size={18} />
            </span>

            <div>
              <p className="text-[10px] font-black text-emerald-700">
                داخل مجال التعريف
              </p>
              <h3 className="text-sm font-black text-slate-950 sm:text-base">
                أمثلة صحيحة
              </h3>
            </div>
          </div>

          <div
            className={cn(
              "grid gap-3 p-4",
              valid.length === 1 && "grid-cols-1",
              valid.length === 2 && "sm:grid-cols-2",
              valid.length >= 3 && "sm:grid-cols-2",
            )}
          >
            {valid.map((item, index) =>
              renderExample(item, index, "valid"),
            )}
          </div>

          <div className="border-t border-emerald-100 bg-emerald-50/35 px-4 py-3">
            <p className="text-center text-xs font-bold text-emerald-800">
              السبب: العدد داخل ln موجب تمامًا.
            </p>
          </div>
        </div>
      )}

      {invalid.length > 0 && (
        <div className="overflow-hidden rounded-[24px] border border-rose-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-rose-100 bg-rose-50/80 px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
              <XCircle size={18} />
            </span>

            <div>
              <p className="text-[10px] font-black text-rose-700">
                خارج مجال التعريف
              </p>
              <h3 className="text-sm font-black text-slate-950 sm:text-base">
                أمثلة غير معرفة
              </h3>
            </div>
          </div>

          <div
            className={cn(
              "grid gap-3 p-4",
              invalid.length === 1 && "grid-cols-1",
              invalid.length === 2 && "sm:grid-cols-2",
              invalid.length >= 3 && "sm:grid-cols-2",
            )}
          >
            {invalid.map((item, index) =>
              renderExample(item, index, "invalid"),
            )}
          </div>

          <div className="border-t border-rose-100 bg-rose-50/35 px-4 py-3">
            <p className="text-center text-xs font-bold text-rose-800">
              السبب: ln لا تقبل الصفر ولا عددًا سالبًا في ℝ.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}


function PolynomialBehaviorConceptStep({ content = {} }) {
  const cases = Array.isArray(content.cases)
    ? content.cases.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const examples = Array.isArray(content.examples)
    ? content.examples.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const manuallyRenderedKeys = new Set([
    "teacher",
    "cases",
    "examples",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  const caseTone = (index) =>
    index % 2 === 0
      ? {
          border: "border-emerald-200",
          surface: "from-emerald-50 via-white to-white",
          icon: "bg-emerald-600",
          text: "text-emerald-800",
          formula: "border-emerald-100 bg-emerald-50/70",
        }
      : {
          border: "border-violet-200",
          surface: "from-violet-50 via-white to-white",
          icon: "bg-violet-600",
          text: "text-violet-800",
          formula: "border-violet-100 bg-violet-50/70",
        };

  return (
    <div className="space-y-5 sm:space-y-6">
      {content.teacher && (
        <section className="overflow-hidden rounded-[26px] border border-indigo-100 bg-white shadow-sm">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <BookOpen size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-black text-indigo-700">شرح الأستاذ</p>
              <MathText className="font-semibold leading-8 text-slate-700">
                {content.teacher}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {cases.length > 0 && (
        <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-3 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3 px-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Compass size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">اقرأ الحالة ثم استنتج الإشارة</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                كل بطاقة تجمع الشرط والمرجعية ومعناها في مكان واحد.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {cases.map((item, index) => {
              const tone = caseTone(index);
              const heading =
                item.degree_type || item.condition || item.name || `الحالة ${index + 1}`;
              const formula = item.reference || item.formula || item.rule || "";

              return (
                <article
                  key={item.id || `${heading}-${index}`}
                  className={cn(
                    "relative overflow-hidden rounded-[24px] border bg-gradient-to-l p-4 shadow-sm sm:p-5",
                    tone.border,
                    tone.surface,
                  )}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm",
                      tone.icon,
                    )}>
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[11px] font-black text-slate-500">الحالة</p>
                      <MixedArabicMath
                        value={heading}
                        centered={false}
                        className={cn("font-black", tone.text)}
                      />
                    </div>
                  </div>

                  {formula && (
                    <div className={cn("mb-3 rounded-2xl border px-3 py-4", tone.formula)}>
                      <p className={cn("mb-2 text-center text-[11px] font-black", tone.text)}>
                        السلوك عند المالانهاية
                      </p>
                      <MixedArabicMath value={formula} className="font-black" />
                    </div>
                  )}

                  {item.meaning && (
                    <div className="flex items-start gap-2.5 rounded-2xl border border-white bg-white/85 px-3.5 py-3 shadow-sm">
                      <Lightbulb size={17} className="mt-1 shrink-0 text-amber-600" />
                      <div className="min-w-0">
                        <p className="mb-1 text-[11px] font-black text-amber-700">المعنى</p>
                        <MathText className="text-sm font-semibold leading-7 text-slate-700">
                          {item.meaning}
                        </MathText>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {examples.length > 0 && (
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-l from-indigo-50 via-white to-white px-4 py-4 sm:px-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <ListChecks size={19} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">أمثلة تطبيقية سريعة</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                قارن نهاية الحد الرئيسي في الجهتين.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-3 sm:p-5 lg:grid-cols-3">
            {examples.map((item, index) => (
              <article
                key={item.id || item.term || `polynomial-example-${index}`}
                className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50/60 shadow-sm"
              >
                <div className="border-b border-slate-100 bg-white px-4 py-4 text-center">
                  <p className="mb-2 text-[11px] font-black text-indigo-600">الحد الرئيسي</p>
                  <MixedArabicMath value={item.term} />
                </div>
                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-200">
                  <div className="p-3 text-center">
                    <MathText className="mb-1 text-xs font-black text-slate-500">
                      {"\\(x\\to+\\infty\\)"}
                    </MathText>
                    <MixedArabicMath value={item.at_plus_infinity} />
                  </div>
                  <div className="p-3 text-center">
                    <MathText className="mb-1 text-xs font-black text-slate-500">
                      {"\\(x\\to-\\infty\\)"}
                    </MathText>
                    <MixedArabicMath value={item.at_minus_infinity} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <GenericObjectStep content={remainingContent} />
      )}
    </div>
  );
}


function ConceptStep({ content = {} }) {
  const polynomialCases = Array.isArray(content.cases)
    ? content.cases.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const isPolynomialBehaviorConcept = polynomialCases.some(
    (item) =>
      "degree_type" in item ||
      ("condition" in item && /a_n|a_\{n\}/.test(String(item.condition || ""))),
  );

  if (isPolynomialBehaviorConcept) {
    return <PolynomialBehaviorConceptStep content={content} />;
  }

  const validExamples = Array.isArray(content.valid_examples)
    ? content.valid_examples.filter((item) => !isEmpty(item))
    : [];

  const invalidExamples = Array.isArray(content.invalid_examples)
    ? content.invalid_examples.filter((item) => !isEmpty(item))
    : [];

  const isReciprocalCompositionConcept =
    Array.isArray(content.cases) &&
    content.cases.length > 0 &&
    content.cases.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        "inner_limit" in item &&
        "result" in item,
    ) &&
    /1\s*\/?\s*g\s*\(x\)|\\frac\{1\}\{g\(x\)\}/.test(
      String(content.teacher || ""),
    );

  if (isReciprocalCompositionConcept) {
    return <ReciprocalCompositionConceptStep content={content} />;
  }

  const isCompositionDomainConcept =
    Array.isArray(content.common_conditions) &&
    content.common_conditions.length > 0 &&
    content.common_conditions.some(
      (item) =>
        item &&
        typeof item === "object" &&
        ("outer_function" in item || "condition" in item),
    );

  if (isCompositionDomainConcept) {
    return <CompositionDomainConceptStep content={content} />;
  }

  const isPowerCompositionConcept =
    Array.isArray(content.cases) &&
    content.cases.length > 0 &&
    content.cases.some(
      (item) =>
        item &&
        typeof item === "object" &&
        ("inner_limit" in item || "degree" in item) &&
        "result" in item,
    ) &&
    String(content.teacher || "").includes("[g(x)]^n");

  if (isPowerCompositionConcept) {
    return <PowerCompositionConceptStep content={content} />;
  }

  const isFiniteCompositionConcept =
    !isEmpty(content.setting) &&
    !isEmpty(content.application) &&
    Array.isArray(content.examples) &&
    content.examples.some(
      (item) =>
        item &&
        typeof item === "object" &&
        ("inner_limit" in item || "outer_limit" in item || "composite" in item),
    );

  if (isFiniteCompositionConcept) {
    return <FiniteCompositionConceptStep content={content} />;
  }

  const isZeroOverZeroConcept =
    !isEmpty(content.form) &&
    Array.isArray(content.not_indeterminate_examples) &&
    !isEmpty(content.important_note);

  if (isZeroOverZeroConcept) {
    return <ZeroOverZeroConceptStep content={content} />;
  }

  const isInfinityMinusInfinityConcept =
    !isEmpty(content.short_form) &&
    Array.isArray(content.forms) &&
    Array.isArray(content.not_indeterminate_examples);

  if (isInfinityMinusInfinityConcept) {
    return <InfinityMinusInfinityConceptStep content={content} />;
  }

  const isDivisionByZeroConcept =
    !isEmpty(content.setting) &&
    Array.isArray(content.examples) &&
    Array.isArray(content.sign_method);

  if (isDivisionByZeroConcept) {
    return <DivisionByZeroConceptStep content={content} />;
  }

  const machineView = Array.isArray(content.machine_view)
    ? content.machine_view.filter(Boolean)
    : [];

  const algorithm = Array.isArray(content.algorithm)
    ? content.algorithm.filter(Boolean)
    : [];

  const example =
    content.example && typeof content.example === "object"
      ? content.example
      : null;

  const exampleValues = Array.isArray(example?.values)
    ? example.values.filter(Boolean)
    : [];

  const conceptExamples = Array.isArray(content.examples)
    ? content.examples.filter((item) => !isEmpty(item))
    : !isEmpty(content.examples)
      ? [content.examples]
      : [];

  // عرض كل الحقول الجديدة التي لا يملك ConceptStep تصميمًا خاصًا لها.
  const manuallyRenderedKeys = new Set([
    "teacher",
    "central_idea",
    "machine_view",
    "algorithm",
    "why",
    "how_to_think",
    "attention",
    "takeaway",
    "valid_examples",
    "invalid_examples",
    "mini_example",
    "quick_example",
    "examples",
  ]);

  // المثال الكائني يعرضه التصميم الخاص، أما المثال النصي فيمر إلى العارض العام.
  if (example) manuallyRenderedKeys.add("example");

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5">
      {content.teacher && (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-l from-indigo-50/80 via-white to-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-indigo-700">
            <BookOpen size={16} />
            شرح الأستاذ
          </div>

          <MathText className="text-sm font-semibold leading-7 text-slate-700 sm:text-[15px]">
            {content.teacher}
          </MathText>
        </div>
      )}

      {content.central_idea && (
        <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm">
          <Sparkles
            size={18}
            className="mt-1 shrink-0 text-violet-600"
          />

          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-violet-700">
              الفكرة الأساسية
            </p>

            <MathText className="text-sm font-black leading-7 text-slate-900">
              {content.central_idea}
            </MathText>
          </div>
        </div>
      )}

      {(validExamples.length > 0 || invalidExamples.length > 0) && (
        <LnDomainExamples
          validExamples={validExamples}
          invalidExamples={invalidExamples}
        />
      )}

      {content.mini_example && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-600" />
            <h3 className="font-black text-slate-950">
              مثال تطبيقي
            </h3>
          </div>
          <SemanticExampleValue value={content.mini_example} />
        </section>
      )}

      {content.quick_example && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={18} className="text-violet-600" />
            <h3 className="font-black text-slate-950">
              مثال سريع
            </h3>
          </div>
          <SemanticExampleValue value={content.quick_example} />
        </section>
      )}

      {conceptExamples.length > 0 && (
        <section className="rounded-[26px] border border-slate-200 bg-slate-50/55 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <GraduationCap size={18} className="text-indigo-600" />
            <div>
              <h3 className="font-black text-slate-950">
                أمثلة توضيحية
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                عرض منظم للمعطيات والنتائج حتى تبقى العلاقة بين العناصر واضحة.
              </p>
            </div>
          </div>
          <ExampleCollection value={conceptExamples} />
        </section>
      )}

      {machineView.length > 0 && (
        <section className="rounded-[26px] border border-slate-200 bg-slate-50/65 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Route size={18} className="text-indigo-600" />
            <div>
              <h3 className="font-black text-slate-950">
                كيف تُبنى الدالة المركبة؟
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                نتتبع العدد منذ دخوله حتى نحصل على النتيجة النهائية.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {machineView.map((item, index) => (
              <article
                key={item?.stage || `machine-stage-${index}`}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white shadow-sm">
                      {item?.stage || index + 1}
                    </span>

                    <h4 className="text-sm font-black text-slate-950">
                      {index === 0
                        ? "المرحلة الأولى: الدالة الداخلية"
                        : "المرحلة الثانية: الدالة الخارجية"}
                    </h4>
                  </div>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                    {index === 0 ? "داخل" : "خارج"}
                  </span>
                </div>

                <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1.15fr_auto_1fr]">
                  <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-center">
                    <p className="mb-1 text-[11px] font-black text-sky-700">
                      القيمة الداخلة
                    </p>
                    <MathText className="font-black text-slate-900">
                      {item?.input}
                    </MathText>
                  </div>

                  <div className="hidden items-center justify-center text-2xl font-black text-slate-300 md:flex">
                    ←
                  </div>

                  <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3 text-center">
                    <p className="mb-1 text-[11px] font-black text-violet-700">
                      العملية المطبقة
                    </p>
                    <MathText className="font-black text-violet-950">
                      {item?.operation}
                    </MathText>
                  </div>

                  <div className="hidden items-center justify-center text-2xl font-black text-slate-300 md:flex">
                    ←
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-center">
                    <p className="mb-1 text-[11px] font-black text-emerald-700">
                      النتيجة
                    </p>
                    <MathText className="font-black text-emerald-950">
                      {item?.output}
                    </MathText>
                  </div>
                </div>

                {index < machineView.length - 1 && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs font-black text-indigo-700">
                    <ArrowLeft size={15} />
                    نتيجة هذه المرحلة تصبح مدخل المرحلة التالية
                  </div>
                )}
              </article>
            ))}
          </div>

          {machineView.length >= 2 && (
            <div className="mt-4 rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-50 to-white p-4">
              <p className="mb-2 text-xs font-black text-indigo-700">
                السلسلة كاملة
              </p>

              <div
                dir="ltr"
                className="flex flex-wrap items-center justify-center gap-2 text-center"
              >
                <MathText as="span" className="font-black text-slate-900">
                  {machineView[0]?.input}
                </MathText>

                <span className="text-xl font-black text-slate-300">→</span>

                <MathText as="span" className="font-black text-violet-800">
                  {machineView[0]?.output}
                </MathText>

                <span className="text-xl font-black text-slate-300">→</span>

                <MathText as="span" className="font-black text-emerald-800">
                  {machineView[machineView.length - 1]?.output}
                </MathText>
              </div>
            </div>
          )}
        </section>
      )}

      {algorithm.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Route size={18} className="text-indigo-600" />
            <h3 className="font-black text-slate-950">
              خطوات الدراسة على مجال مغلق
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {algorithm.map((item, index) => (
              <div
                key={`closed-interval-step-${index}`}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                  {index + 1}
                </span>

                <MathText className="text-sm font-semibold leading-7 text-slate-700">
                  {item}
                </MathText>
              </div>
            ))}
          </div>
        </section>
      )}

      {example && (
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <GraduationCap size={18} className="text-emerald-600" />
            <h3 className="font-black text-slate-950">
              مثال على مجال مغلق
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {example.function && (
              <div className="rounded-xl bg-white p-3 ring-1 ring-emerald-100">
                <p className="mb-1 text-[11px] font-black text-emerald-700">
                  الدالة
                </p>
                <MixedArabicMath value={example.function} />
              </div>
            )}

            {example.interval && (
              <div className="rounded-xl bg-white p-3 ring-1 ring-emerald-100">
                <p className="mb-1 text-[11px] font-black text-emerald-700">
                  المجال
                </p>
                <MixedArabicMath value={example.interval} />
              </div>
            )}
          </div>

          {exampleValues.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {exampleValues.map((value, index) => (
                <div
                  key={`closed-value-${index}`}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm"
                >
                  <MixedArabicMath value={value} />
                </div>
              ))}
            </div>
          )}

          {example.conclusion && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-4 py-3">
              <p className="mb-1 text-[11px] font-black text-emerald-700">
                النتيجة
              </p>

              <MathText className="text-sm font-black leading-7 text-slate-900">
                {example.conclusion}
              </MathText>
            </div>
          )}
        </section>
      )}

      {(content.why || content.how_to_think) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {content.why && (
            <InfoBox
              title="لماذا هذه الفكرة مهمة؟"
              tone="amber"
              icon={CircleHelp}
            >
              <MathText className="text-sm font-semibold leading-7">
                {content.why}
              </MathText>
            </InfoBox>
          )}

          {content.how_to_think && (
            <InfoBox
              title="كيف أفكر؟"
              tone="sky"
              icon={Brain}
            >
              <MathText className="text-sm font-semibold leading-7">
                {content.how_to_think}
              </MathText>
            </InfoBox>
          )}
        </div>
      )}

      {content.attention && (
        <InfoBox
          title="انتبه إلى هذه النقطة"
          tone="rose"
          icon={AlertTriangle}
        >
          <MathText className="text-sm font-semibold leading-7">
            {content.attention}
          </MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-50 to-white p-4 shadow-sm">
          <CheckCircle2
            size={19}
            className="mt-1 shrink-0 text-indigo-600"
          />

          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-indigo-700">
              الخلاصة
            </p>

            <MathText className="text-sm font-black leading-7 text-slate-900">
              {content.takeaway}
            </MathText>
          </div>
        </div>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <GenericObjectStep content={remainingContent} />
      )}
    </div>
  );
}

function GenericObjectStep({ content }) {
  const entries = Object.entries(content || {}).filter(
    ([key, value]) =>
      !isEmpty(value) &&
      !["graph", "graph_data", "graph_ref", "graphRef", "graph_id", "graphId"].includes(key) &&
      !isTechnicalPresentationField(key) &&
      !looksLikeSvgMarkup(value),
  );

  return (
    <div className="space-y-5">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className={cn(
            [
              "graph_data",
              "graph",
              "curve",
              "function_graph",
              "graphical_representation",
              "variation_table",
              "table_of_variations",
              "sign_table",
              "derivative_sign_table",
              "discussion_table",
            ].includes(key)
              ? ""
              : "rounded-[24px] border border-slate-200 bg-slate-50/70 p-5",
          )}
        >
          {![
            "graph_data",
            "graph",
            "curve",
            "function_graph",
            "graphical_representation",
            "variation_table",
            "table_of_variations",
            "sign_table",
            "derivative_sign_table",
            "discussion_table",
          ].includes(key) && (
            <h3 className="mb-3 font-black text-slate-950">
              {fieldLabel(key)}
            </h3>
          )}
          <StructuredValue value={value} fieldKey={key} />
        </div>
      ))}
    </div>
  );
}



function InterpretationStep({ content = {} }) {
  const handledKeys = new Set([
    "teacher",
    "interpretations",
    "sign_meaning",
    "why",
    "how_to_think",
    "attention",
    "takeaway",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !handledKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  const interpretations = Array.isArray(content.interpretations)
    ? content.interpretations.filter(Boolean)
    : [];

  const signMeanings = Array.isArray(content.sign_meaning)
    ? content.sign_meaning.filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      {content.teacher && (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-l from-indigo-50/80 via-white to-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-indigo-700">
            <BookOpen size={16} />
            شرح الأستاذ
          </div>

          <MathText className="text-sm font-semibold leading-7 text-slate-700 sm:text-[15px]">
            {content.teacher}
          </MathText>
        </div>
      )}

      {interpretations.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Brain size={18} className="text-violet-600" />
            <h3 className="font-black text-slate-950">
              المعنيان الأساسيان للعدد المشتق
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {interpretations.map((item, index) => (
              <article
                key={item?.name || `interpretation-${index}`}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-4 shadow-sm",
                  index % 2 === 0
                    ? "border-indigo-100 bg-indigo-50/65"
                    : "border-emerald-100 bg-emerald-50/65",
                )}
              >
                <div
                  className={cn(
                    "absolute inset-y-0 right-0 w-1",
                    index % 2 === 0
                      ? "bg-indigo-500"
                      : "bg-emerald-500",
                  )}
                />

                <div className="pr-2">
                  {item?.name && (
                    <h4
                      className={cn(
                        "mb-2 text-sm font-black",
                        index % 2 === 0
                          ? "text-indigo-800"
                          : "text-emerald-800",
                      )}
                    >
                      {item.name}
                    </h4>
                  )}

                  {item?.meaning && (
                    <MathText className="text-sm font-semibold leading-7 text-slate-700">
                      {item.meaning}
                    </MathText>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {signMeanings.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Compass size={18} className="text-sky-600" />
            <h3 className="font-black text-slate-950">
              معنى إشارة العدد المشتق
            </h3>
          </div>

          <div className="grid auto-rows-fr grid-cols-1 gap-3 md:grid-cols-3">
            {signMeanings.map((item, index) => {
              const tone =
                index === 0
                  ? {
                      border: "border-emerald-200",
                      bg: "bg-emerald-50/75",
                      text: "text-emerald-800",
                      badge: "bg-emerald-600",
                    }
                  : index === 1
                    ? {
                        border: "border-rose-200",
                        bg: "bg-rose-50/75",
                        text: "text-rose-800",
                        badge: "bg-rose-600",
                      }
                    : {
                        border: "border-amber-200",
                        bg: "bg-amber-50/75",
                        text: "text-amber-800",
                        badge: "bg-amber-500",
                      };

              return (
                <article
                  key={item?.condition || `sign-${index}`}
                  className={cn(
                    "rounded-2xl border p-4 text-center shadow-sm",
                    tone.border,
                    tone.bg,
                  )}
                >
                  {item?.condition && (
                    <div
                      className={cn(
                        "mx-auto mb-3 w-fit rounded-xl px-4 py-2 text-white shadow-sm",
                        tone.badge,
                      )}
                    >
                      <MathText
                        as="span"
                        className="font-black text-white [&_mjx-container]:text-white"
                      >
                        {item.condition}
                      </MathText>
                    </div>
                  )}

                  {item?.meaning && (
                    <MathText
                      className={cn(
                        "text-sm font-black leading-7",
                        tone.text,
                      )}
                    >
                      {item.meaning}
                    </MathText>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {(content.why || content.how_to_think) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {content.why && (
            <InfoBox
              title="لماذا نربط الحساب بالرسم؟"
              tone="amber"
              icon={Lightbulb}
            >
              <MathText className="text-sm font-semibold leading-7">
                {content.why}
              </MathText>
            </InfoBox>
          )}

          {content.how_to_think && (
            <InfoBox title="كيف أفكر؟" tone="sky" icon={Brain}>
              <MathText className="text-sm font-semibold leading-7">
                {content.how_to_think}
              </MathText>
            </InfoBox>
          )}
        </div>
      )}

      {content.attention && (
        <InfoBox
          title="انتبه إلى هذه النقطة"
          tone="rose"
          icon={AlertTriangle}
        >
          <MathText className="text-sm font-semibold leading-7">
            {content.attention}
          </MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-50 to-white p-4 shadow-sm">
          <CheckCircle2
            size={19}
            className="mt-1 shrink-0 text-indigo-600"
          />

          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-indigo-700">
              الخلاصة
            </p>

            <MathText className="text-sm font-black leading-7 text-slate-900">
              {content.takeaway}
            </MathText>
          </div>
        </div>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <GenericObjectStep content={remainingContent} />
      )}
    </div>
  );
}

function DiscoveryStep({ content = {} }) {
  const examples = Array.isArray(content.examples)
    ? content.examples.filter(Boolean)
    : [];

  const observations = Array.isArray(content.observations)
    ? content.observations.filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      {content.teacher && (
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-l from-sky-50/80 via-white to-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-sky-700">
            <Lightbulb size={16} />
            نكتشف الفكرة
          </div>

          <MathText className="text-sm font-semibold leading-7 text-slate-700 sm:text-[15px]">
            {content.teacher}
          </MathText>
        </div>
      )}

      {content.central_idea && (
        <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm">
          <Sparkles
            size={18}
            className="mt-1 shrink-0 text-violet-600"
          />

          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-violet-700">
              الفكرة الأساسية
            </p>

            <MathText className="text-sm font-black leading-7 text-slate-900">
              {content.central_idea}
            </MathText>
          </div>
        </div>
      )}

      {examples.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Route size={18} className="text-indigo-600" />
            <h3 className="font-black text-slate-950">
              نتعرف على شكل الدالة قبل الاشتقاق
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {examples.map((item, index) => (
              <article
                key={
                  item?.function ||
                  item?.main_shape ||
                  `discovery-example-${index}`
                }
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <div>
                    <p className="text-[11px] font-black text-slate-500">
                      الشكل الرئيسي
                    </p>

                    <h4 className="mt-0.5 text-sm font-black text-slate-950">
                      {item?.main_shape || `الحالة ${index + 1}`}
                    </h4>
                  </div>

                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white shadow-sm">
                    {index + 1}
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  {item?.function && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-3 text-center">
                      <MathText className="font-black text-indigo-900">
                        {item.function}
                      </MathText>
                    </div>
                  )}

                  {item?.rule && (
                    <div>
                      <p className="mb-1 text-[11px] font-black text-emerald-700">
                        القاعدة المناسبة
                      </p>

                      <MathText className="text-sm font-semibold leading-7 text-slate-700">
                        {item.rule}
                      </MathText>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {observations.length > 0 && (
        <BulletList
          items={observations}
          tone="sky"
          icon={CheckCircle2}
        />
      )}

      {content.strict_note && (
        <InfoBox
          title="ملاحظة مهمة"
          tone="amber"
          icon={AlertTriangle}
        >
          <MathText className="text-sm font-semibold leading-7">
            {content.strict_note}
          </MathText>
        </InfoBox>
      )}

      {content.conclusion && (
        <InfoBox
          title="الاستنتاج"
          tone="emerald"
          icon={CheckCircle2}
        >
          <MathText className="text-sm font-black leading-7">
            {content.conclusion}
          </MathText>
        </InfoBox>
      )}

      {(content.why || content.how_to_think) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {content.why && (
            <InfoBox
              title="لماذا نتعلم هذه الفكرة؟"
              tone="amber"
              icon={CircleHelp}
            >
              <MathText className="text-sm font-semibold leading-7">
                {content.why}
              </MathText>
            </InfoBox>
          )}

          {content.how_to_think && (
            <InfoBox
              title="كيف أفكر؟"
              tone="sky"
              icon={Brain}
            >
              <MathText className="text-sm font-semibold leading-7">
                {content.how_to_think}
              </MathText>
            </InfoBox>
          )}
        </div>
      )}

      {content.attention && (
        <InfoBox
          title="انتبه إلى هذه النقطة"
          tone="rose"
          icon={AlertTriangle}
        >
          <MathText className="text-sm font-semibold leading-7">
            {content.attention}
          </MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-50 to-white p-4 shadow-sm">
          <CheckCircle2
            size={19}
            className="mt-1 shrink-0 text-indigo-600"
          />

          <div className="min-w-0">
            <p className="mb-1 text-xs font-black text-indigo-700">
              الخلاصة
            </p>

            <MathText className="text-sm font-black leading-7 text-slate-900">
              {content.takeaway}
            </MathText>
          </div>
        </div>
      )}
    </div>
  );
}

function DefinitionStep({ content = {} }) {
  const orderedValues = [
    {
      label: "عندما تكون القيم مرتبة تصاعديًا",
      value: content.increasing_order,
      tone: "indigo",
    },
    {
      label: "عندما تكون القيم مرتبة تنازليًا",
      value: content.decreasing_order,
      tone: "violet",
    },
  ].filter((item) => !isEmpty(item.value));

  const definitionExamples = Array.isArray(content.examples)
    ? content.examples.filter((item) => !isEmpty(item))
    : !isEmpty(content.examples)
      ? [content.examples]
      : [];

  const handledKeys = new Set([
    "teacher",
    "central_idea",
    "general_meaning",
    "increasing_order",
    "decreasing_order",
    "definitions",
    "examples",
    "symbols",
    "monotone_definition",
    "memory_tip",

    // تُعرض في PedagogicalBlocks أسفل المرحلة، لذلك لا نكررها هنا.
    ...PEDAGOGICAL_KEYS,
  ]);

  const remainingEntries = Object.entries(content).filter(
    ([key, value]) =>
      !handledKeys.has(key) &&
      !isEmpty(value) &&
      !isTechnicalPresentationField(key) &&
      !looksLikeSvgMarkup(value),
  );

  return (
    <div className="space-y-6">
      {content.teacher && (
        <InfoBox title="شرح الأستاذ" tone="indigo" icon={BookOpen}>
          <MathText className="font-bold">{content.teacher}</MathText>
        </InfoBox>
      )}

      {content.central_idea && (
        <div className="overflow-hidden rounded-[28px] border border-violet-200 bg-gradient-to-l from-violet-50 via-white to-indigo-50 p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-violet-700">
            <Sparkles size={19} />
            <h3 className="font-black">الفكرة الأساسية</h3>
          </div>
          <MathText className="text-base font-black text-slate-900">
            {content.central_idea}
          </MathText>
        </div>
      )}

      {content.general_meaning && (
        <InfoBox title="المعنى العام" tone="sky" icon={Lightbulb}>
          <MathText className="font-bold">{content.general_meaning}</MathText>
        </InfoBox>
      )}

      {orderedValues.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Route size={19} className="text-indigo-600" />
            <h3 className="font-black text-slate-950">
              ترتيب القيمة بين صورتي طرفي المجال
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {orderedValues.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "rounded-[26px] border bg-white p-5 text-center shadow-sm",
                  item.tone === "violet"
                    ? "border-violet-200"
                    : "border-indigo-200",
                )}
              >
                <p
                  className={cn(
                    "mb-3 text-sm font-black",
                    item.tone === "violet"
                      ? "text-violet-700"
                      : "text-indigo-700",
                  )}
                >
                  {item.label}
                </p>
                <MathPanel>{item.value}</MathPanel>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(content.definitions) &&
        content.definitions.length > 0 && (
          <div
            className={cn(
              "grid gap-4",
              content.definitions.length === 1
                ? "grid-cols-1"
                : content.definitions.length === 2
                  ? "md:grid-cols-2"
                  : "md:grid-cols-2 xl:grid-cols-3",
            )}
          >
            {content.definitions.map((item, index) => {
              const title =
                item?.name ||
                item?.term ||
                item?.title ||
                item?.concept ||
                `التعريف ${index + 1}`;

              const knownKeys = new Set([
                "name",
                "term",
                "title",
                "concept",
                "formula",
                "notation",
                "meaning",
                "condition",
              ]);

              const extraFields = Object.fromEntries(
                Object.entries(item || {}).filter(
                  ([key, value]) =>
                    !knownKeys.has(key) &&
                    !isEmpty(value) &&
                    !isTechnicalPresentationField(key),
                ),
              );

              return (
                <div
                  key={item?.id || title || index}
                  className="rounded-[24px] border border-indigo-100 bg-gradient-to-b from-indigo-50/80 to-white p-5 shadow-sm"
                >
                  <MathText
                    as="h3"
                    className="text-center text-base font-black leading-8 text-indigo-950 sm:text-lg"
                  >
                    {title}
                  </MathText>

                  {item?.notation && (
                    <div className="mt-3 rounded-xl border border-violet-100 bg-white px-3 py-2.5">
                      <p className="mb-1 text-[11px] font-black text-violet-700">
                        الترميز
                      </p>
                      <MathText className="font-black text-slate-950">
                        {item.notation}
                      </MathText>
                    </div>
                  )}

                  {item?.formula && (
                    <div className="mt-3">
                      <MathPanel>{item.formula}</MathPanel>
                    </div>
                  )}

                  {item?.meaning && (
                    <MathText className="mt-3 text-sm font-semibold text-slate-700">
                      {item.meaning}
                    </MathText>
                  )}

                  {item?.condition && (
                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                      <p className="mb-1 text-[11px] font-black text-amber-700">
                        الشرط
                      </p>
                      <MathText className="text-sm font-semibold text-amber-950">
                        {item.condition}
                      </MathText>
                    </div>
                  )}

                  {Object.keys(extraFields).length > 0 && (
                    <div className="mt-3">
                      <StructuredValue
                        value={extraFields}
                        fieldKey="definition_details"
                        depth={1}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {definitionExamples.length > 0 && (
        <section className="rounded-[26px] border border-indigo-100 bg-indigo-50/35 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <GraduationCap size={18} className="text-indigo-600" />
            <div>
              <h3 className="font-black text-slate-950">
                أمثلة سريعة
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                أمثلة قصيرة تثبّت التعريف دون تشتيت أو فراغات كبيرة.
              </p>
            </div>
          </div>
          <ExampleCollection value={definitionExamples} />
        </section>
      )}

      {Array.isArray(content.symbols) && content.symbols.length > 0 && (
        <div>
          <h3 className="mb-4 font-black text-slate-950">
            معاني الرموز
          </h3>

          <div className="grid gap-4 md:grid-cols-3">
            {content.symbols.map((item, index) => (
              <div
                key={item?.symbol || index}
                className="rounded-[22px] border border-slate-200 bg-white p-4 text-center shadow-sm"
              >
                {item?.symbol && <MathPanel>{item.symbol}</MathPanel>}

                {item?.meaning && (
                  <MathText className="mt-3 text-sm font-bold text-slate-700">
                    {item.meaning}
                  </MathText>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {content.monotone_definition && (
        <InfoBox
          title="تعريف المتتالية الرتيبة"
          tone="emerald"
          icon={CheckCircle2}
        >
          <MathText className="font-black">
            {content.monotone_definition}
          </MathText>
        </InfoBox>
      )}

      {content.memory_tip && (
        <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb}>
          <MathText className="font-bold">
            {content.memory_tip}
          </MathText>
        </InfoBox>
      )}

      {remainingEntries.length > 0 && (
        <div className="space-y-4">
          {remainingEntries.map(([key, value]) => (
            <div
              key={key}
              className={cn(
                key === "graph_data"
                  ? ""
                  : "rounded-[24px] border border-slate-200 bg-slate-50/70 p-5",
              )}
            >
              {key !== "graph_data" && (
                <h3 className="mb-3 font-black text-slate-950">
                  {fieldLabel(key)}
                </h3>
              )}

              <StructuredValue
                value={value}
                fieldKey={key}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function normalizeGraphPosition(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  const aliases = {
    top: "before_question",
    before: "before_question",
    before_question: "before_question",
    before_pre_question: "before_question",
    after_question: "after_question",
    after_pre_question: "after_question",
    after_intro: "after_question",
    middle: "after_question",
    before_explanation: "before_explanation",
    before_body: "before_explanation",
    after_explanation: "after_explanation",
    after_body: "after_explanation",
    bottom: "bottom",
    end: "bottom",
    hidden: "hidden",
    none: "hidden",
  };

  return aliases[normalized] || "";
}

function getDefaultGraphPosition(step) {
  if (!step?.content?.graph && !step?.content?.graph_data) return "hidden";

  const type = String(step?.type || "").toLowerCase();
  const hasQuestion = Boolean(step?.content?.pre_question?.prompt);

  // المراحل التي لا يمكن فهم سؤالها دون رؤية المنحنى.
  const graphFirstTypes = new Set([
    "concept",
    "method",
    "worked_example",
    "guided_practice",
    "graph_reading",
    "graph_activity",
    "graphical_interpretation",
    "final_assessment",
    "diagram",
    "derivation",
    "law",
  ]);

  if (hasQuestion && graphFirstTypes.has(type)) {
    return "before_question";
  }

  if (type === "observation" || type === "discovery") {
    return "before_explanation";
  }

  // في مراحل القراءة البيانية يجب أن يرى التلميذ المنحنى قبل الشرح
  // والمقارنة، لا في أسفل البطاقة بعد انتهاء المحتوى.
  if (graphFirstTypes.has(type) || type === "quiz") {
    return "before_explanation";
  }

  return "before_explanation";
}

function resolveGraphPosition(step) {
  const explicit = normalizeGraphPosition(
    step?.content?.graph_position ||
      step?.content?.graph?.position ||
      step?.content?.graph?.placement,
  );

  return explicit || getDefaultGraphPosition(step);
}

function StepGraph({ step, className = "" }) {
  const graph =
    step?.content?.graph ??
    step?.content?.graph_data ??
    null;

  if (!graph || typeof graph !== "object") return null;

  return (
    <div className={cn("scroll-mt-24", className)}>
      <CompleteGraphValue value={graph} />
    </div>
  );
}


const LAW_GUIDE_DUPLICATE_FIELDS = new Set([
  "symbols",
  "parts",
  "definition",
  "formula",
  "meaning",
  "why",
  "how_to_think",
  "attention",
  "memory_tip",
  "takeaway",
  "simple_example",
  "warning",
  "how_to_use",
]);

function normalizeLawGuideList(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(
      (item) => item && typeof item === "object",
    );
  }

  if (typeof value === "object") {
    return [value];
  }

  return [];
}

function prepareStepContent(content = {}) {
  const guides = normalizeLawGuideList(
    content.law_guides || content.law_guide,
  );

  /*
   * graph / graph_data يعرضهما StepGraph في موضع واحد فقط.
   * law_guides يعرضه LawGuideSection.
   * بقية البيانات تبقى كما هي حتى لا يختفي أي محتوى جديد من JSON.
   */
  const displayContent = {};

  Object.entries(content || {}).forEach(([key, value]) => {
    if (
      key === "law_guides" ||
      key === "law_guide" ||
      key === "graph" ||
      key === "graph_data" ||
      key === "graph_ref" ||
      key === "graphRef" ||
      key === "graph_id" ||
      key === "graphId" ||
      key === "graph_position" ||
      key === "graph_display"
    ) {
      return;
    }

    /*
     * هذه الحقول لها عارض مركزي واحد داخل LessonStepCard:
     * - PedagogicalBlocks يعرض why / how_to_think / attention / quick_check...
     * - StepTakeaway يعرض takeaway.
     *
     * عدم تمريرها إلى مكوّن المرحلة المتخصص يمنع ظهور البطاقة نفسها مرتين
     * (مرة داخل ConceptStep/RuleStep/... ومرة داخل PedagogicalBlocks).
     */
    if (CENTRALIZED_PEDAGOGICAL_KEYS.has(key)) {
      return;
    }

    if (key === "intro") {
      if (isEmpty(content.teacher) && !isEmpty(value)) {
        displayContent.teacher = value;
      }
      return;
    }

    displayContent[key] = value;
  });

  return {
    displayContent,
    lawGuides: guides,
  };
}

function RuleStep({ content = {} }) {
  const symbolGuide = Array.isArray(content.symbol_guide)
    ? content.symbol_guide.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  const applicationSteps = Array.isArray(content.application_steps)
    ? content.application_steps.filter(Boolean)
    : [];

  const rawCases = Array.isArray(content.determined_cases)
    ? content.determined_cases
    : Array.isArray(content.cases)
      ? content.cases
      : [];

  const ruleCases = rawCases.filter(
    (item) => item && typeof item === "object" && !Array.isArray(item),
  );

  const manuallyRenderedKeys = new Set([
    "teacher",
    "rule",
    "determined_cases",
    "cases",
    "how_to_think",
    "indeterminate_warning",
    "attention",
    "memory_tip",
    "sign_note",
    "takeaway",
    "general_setting",
    "simplified_form",
    "symbol_guide",
    "application_steps",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  const getCaseData = (item) => {
    const numerator = item.numerator ?? item.top ?? item.dividend ?? "";
    const denominator = item.denominator ?? item.bottom ?? item.divisor ?? "";
    const explicitForm =
      item.form ?? item.expression ?? item.case ?? item.operation ?? "";

    const form =
      explicitForm ||
      (!isEmpty(numerator) && !isEmpty(denominator)
        ? `\\(\\dfrac{${getPureMathExpression(numerator)}}{${getPureMathExpression(denominator)}}\\)`
        : "");

    return {
      form,
      numerator,
      denominator,
      result: item.result ?? item.answer ?? item.conclusion ?? "",
      condition: item.condition ?? item.when ?? item.requirement ?? "",
    };
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {content.teacher && (
        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-indigo-700">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
              <BookOpen size={18} />
            </span>
            شرح الأستاذ
          </div>
          <MathText className="text-[15px] font-semibold leading-8 text-slate-700">
            {content.teacher}
          </MathText>
        </section>
      )}

      {content.general_setting && (
        <section className="rounded-[24px] border border-sky-100 bg-gradient-to-l from-sky-50/80 via-white to-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-black text-sky-700">
            <Compass size={17} />
            المعطيات والرموز المستعملة
          </div>
          <MathText className="text-center font-black leading-9 text-slate-900">
            {content.general_setting}
          </MathText>
        </section>
      )}

      {content.rule && (
        <section className="relative overflow-hidden rounded-[28px] border border-indigo-200 bg-gradient-to-l from-indigo-950 via-indigo-900 to-violet-800 px-5 py-6 text-white shadow-[0_18px_45px_-24px_rgba(79,70,229,0.85)] sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -left-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2 text-xs font-black text-indigo-100">
              <Sparkles size={17} />
              القاعدة الأساسية
            </div>
            {containsArabic(decodeLatexEscapes(content.rule)) ? (
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-5 sm:px-6">
                <MixedArabicMath
                  value={content.rule}
                  dark
                  className="justify-center gap-x-2 text-lg font-black text-white sm:text-2xl [&_mjx-container]:text-white"
                />
              </div>
            ) : (
              <MathJax dynamic hideUntilTypeset="first">
                <div
                  dir="ltr"
                  className="overflow-x-auto py-2 text-center text-xl font-black sm:text-2xl [&_mjx-container]:mx-auto [&_mjx-container]:block [&_mjx-container]:w-fit"
                >
                  {`\\[${getPureMathExpression(content.rule)}\\]`}
                </div>
              </MathJax>
            )}
          </div>
        </section>
      )}

      {content.simplified_form && (
        <section className="overflow-hidden rounded-[26px] border border-emerald-100 bg-white shadow-sm">
          <div className="flex flex-col items-stretch gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-2xl bg-emerald-100 text-emerald-700 sm:self-auto">
              <RefreshCw size={20} />
            </span>
            <div className="min-w-0 flex-1 text-center sm:text-right">
              <p className="mb-2 text-xs font-black text-emerald-700">بعد تبسيط خارج الحدين</p>
              <MixedArabicMath
                value={content.simplified_form}
                centered={false}
                className="justify-center font-black sm:justify-start"
              />
            </div>
          </div>
        </section>
      )}

      {symbolGuide.length > 0 && (
        <section className="rounded-[28px] border border-slate-200 bg-slate-50/65 p-3 shadow-sm sm:p-5">
          <div className="mb-4 flex items-start gap-3 px-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <Hash size={18} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">دليل الرموز</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                تعرّف إلى معنى كل رمز قبل تطبيق القاعدة.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {symbolGuide.map((item, index) => (
              <article
                key={item.id || item.symbol || `rule-symbol-${index}`}
                className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex min-h-[72px] items-center justify-center border-b border-indigo-100 bg-gradient-to-l from-indigo-50 to-violet-50/50 px-4 py-3">
                  <MixedArabicMath
                    value={item.symbol}
                    className="text-lg font-black text-indigo-950"
                  />
                </div>
                <div className="p-4 text-center">
                  <p className="mb-1 text-[11px] font-black text-indigo-600">المعنى</p>
                  <MathText className="text-sm font-semibold leading-7 text-slate-700">
                    {item.meaning}
                  </MathText>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {applicationSteps.length > 0 && (
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-l from-slate-50 via-white to-indigo-50/50 px-4 py-4 sm:px-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Route size={18} />
            </span>
            <div>
              <h3 className="font-black text-slate-950">طريقة تطبيق القاعدة</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                اتبع الخطوات بالترتيب حتى تصل إلى النهاية.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
            {applicationSteps.map((item, index) => (
              <article
                key={`rule-application-step-${index}`}
                className="relative rounded-[22px] border border-indigo-100 bg-indigo-50/45 p-4 pt-5 shadow-sm"
              >
                <span className="absolute -top-2.5 right-4 flex h-7 min-w-7 items-center justify-center rounded-lg bg-indigo-600 px-2 text-xs font-black text-white shadow-sm">
                  {index + 1}
                </span>
                <MathText className="mt-1 text-sm font-bold leading-7 text-slate-800">
                  {item}
                </MathText>
              </article>
            ))}
          </div>
        </section>
      )}

      {ruleCases.length > 0 && (
        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-l from-slate-50 via-white to-indigo-50/60 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
                <ListChecks size={20} />
              </span>
              <div>
                <h3 className="font-black text-slate-950">الحالات التي نطبق عليها القاعدة</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  اقرأ المعطيات من اليمين، ثم اتبع السهم للوصول إلى النتيجة.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 bg-slate-50/45 p-4 sm:p-5">
            {ruleCases.map((item, index) => {
              const { form, numerator, denominator, result, condition } =
                getCaseData(item);

              const usedKeys = new Set([
                "form",
                "expression",
                "case",
                "operation",
                "numerator",
                "top",
                "dividend",
                "denominator",
                "bottom",
                "divisor",
                "result",
                "answer",
                "conclusion",
                "condition",
                "when",
                "requirement",
              ]);

              const extraEntries = Object.entries(item).filter(
                ([key, value]) =>
                  !usedKeys.has(key) &&
                  !isEmpty(value) &&
                  !isTechnicalPresentationField(key),
              );

              return (
                <article
                  key={item.id || `rule-case-${index}`}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_64px_minmax(220px,0.72fr)]">
                    <div className="p-4 sm:p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-[11px] text-white">
                            {index + 1}
                          </span>
                          الحالة {index + 1}
                        </span>

                        {condition && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-800">
                            لها شرط
                          </span>
                        )}
                      </div>

                      {!isEmpty(numerator) && !isEmpty(denominator) ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-sky-100 bg-sky-50/65 p-3.5">
                            <p className="mb-2 text-[11px] font-black text-sky-700">نهاية البسط</p>
                            <MathText className="text-center text-base font-black text-slate-950">
                              {numerator}
                            </MathText>
                          </div>
                          <div className="rounded-2xl border border-violet-100 bg-violet-50/65 p-3.5">
                            <p className="mb-2 text-[11px] font-black text-violet-700">نهاية المقام</p>
                            <MathText className="text-center text-base font-black text-slate-950">
                              {denominator}
                            </MathText>
                          </div>
                        </div>
                      ) : (
                        form && (
                          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/55 p-4">
                            <p className="mb-2 text-[11px] font-black text-indigo-700">الصيغة الناتجة</p>
                            <MathText className="text-center text-lg font-black text-slate-950">
                              {form}
                            </MathText>
                          </div>
                        )
                      )}

                      {condition && (
                        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/60 px-3.5 py-3">
                          <AlertTriangle size={16} className="mt-1 shrink-0 text-amber-700" />
                          <div className="min-w-0">
                            <p className="mb-1 text-[11px] font-black text-amber-700">الشرط</p>
                            <MathText className="text-sm font-black leading-7 text-amber-950">
                              {condition}
                            </MathText>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="hidden items-center justify-center border-x border-slate-100 bg-slate-50/70 lg:flex">
                      <ArrowLeft size={26} className="text-indigo-400" />
                    </div>

                    <div className="flex flex-col justify-center border-t border-slate-100 bg-gradient-to-br from-emerald-50/90 to-white p-4 sm:p-5 lg:border-t-0">
                      <div className="mb-2 flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 size={18} />
                        <p className="text-xs font-black">النتيجة</p>
                      </div>
                      {result ? (
                        <MathText className="text-center text-lg font-black leading-9 text-emerald-950">
                          {result}
                        </MathText>
                      ) : (
                        <span className="text-center text-sm font-bold text-slate-400">—</span>
                      )}
                    </div>
                  </div>

                  {extraEntries.length > 0 && (
                    <div className="border-t border-slate-100 bg-white px-4 py-3 sm:px-5">
                      <StructuredValue value={Object.fromEntries(extraEntries)} depth={2} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {(content.how_to_think || content.memory_tip) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {content.how_to_think && (
            <InfoBox title="كيف أفكر؟" tone="sky" icon={Brain} compact={false}>
              <MathText className="font-bold leading-8">{content.how_to_think}</MathText>
            </InfoBox>
          )}
          {content.memory_tip && (
            <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb} compact={false}>
              <MathText className="font-bold leading-8">{content.memory_tip}</MathText>
            </InfoBox>
          )}
        </div>
      )}

      {content.sign_note && (
        <InfoBox title="ملاحظة حول الإشارة" tone="indigo" icon={Compass} compact={false}>
          <MathText className="font-bold leading-8">{content.sign_note}</MathText>
        </InfoBox>
      )}

      {content.indeterminate_warning && (
        <section className="overflow-hidden rounded-[24px] border border-rose-200 bg-rose-50/65 shadow-sm">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-rose-600 shadow-sm ring-1 ring-rose-100">
              <XCircle size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1.5 font-black text-rose-950">حالة عدم تعيين</h3>
              <MathText className="font-black leading-8 text-rose-950">
                {content.indeterminate_warning}
              </MathText>
            </div>
          </div>
        </section>
      )}

      {content.attention && (
        <section className="flex items-start gap-3 rounded-[24px] border border-amber-200 bg-amber-50/70 p-4 shadow-sm sm:p-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="mb-1 text-sm font-black text-amber-950">انتبه جيدًا</h3>
            <MathText className="font-black leading-8 text-amber-950">
              {content.attention}
            </MathText>
          </div>
        </section>
      )}

      {content.takeaway && (
        <InfoBox title="الخلاصة" tone="emerald" icon={CheckCircle2} compact={false}>
          <MathText className="font-black leading-8">{content.takeaway}</MathText>
        </InfoBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
          <StructuredValue value={remainingContent} depth={1} />
        </section>
      )}
    </div>
  );
}



/* =========================================================
   Renderers for the new Complex Numbers axes
========================================================= */

function ClassificationStep({ content = {} }) {
  const categories = Array.isArray(content.categories)
    ? content.categories.filter(Boolean)
    : [];

  const classification = Array.isArray(content.classification)
    ? content.classification.filter(Boolean)
    : [];

  const rows = categories.length > 0 ? categories : classification;

  const manuallyRenderedKeys = new Set([
    "teacher",
    "categories",
    "classification",
    "takeaway",
    "attention",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5">
      {content.teacher && (
        <InfoBox title="شرح الأستاذ" tone="indigo" icon={BookOpen} compact={false}>
          <MathText className="font-semibold leading-8">
            {content.teacher}
          </MathText>
        </InfoBox>
      )}

      {rows.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((item, index) => (
            <article
              key={item?.name || item?.condition || `classification-${index}`}
              className="rounded-[24px] border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-2 text-indigo-700">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                  {index + 1}
                </span>
                <MathText
                  as="h3"
                  className="font-black leading-7 text-slate-950"
                >
                  {item?.name || item?.condition || `الحالة ${index + 1}`}
                </MathText>
              </div>

              {item?.description && (
                <MathText className="text-sm font-semibold leading-7 text-slate-700">
                  {item.description}
                </MathText>
              )}

              {item?.features && (
                <div className="mt-3">
                  <BulletList items={item.features} tone="indigo" />
                </div>
              )}

              {item && typeof item === "object" && (
                <StructuredValue
                  value={Object.fromEntries(
                    Object.entries(item).filter(
                      ([key]) => !["name", "condition", "description", "features"].includes(key),
                    ),
                  )}
                  depth={1}
                />
              )}
            </article>
          ))}
        </section>
      )}

      {content.attention && (
        <InfoBox title="انتبه" tone="rose" icon={AlertTriangle}>
          <MathText>{content.attention}</MathText>
        </InfoBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <GenericObjectStep content={remainingContent} />
      )}

      {content.takeaway && (
        <StepTakeaway>{content.takeaway}</StepTakeaway>
      )}
    </div>
  );
}


function CheckStep({ content = {} }) {
  const checks = Array.isArray(content.checks)
    ? content.checks.filter(Boolean)
    : [];

  const manuallyRenderedKeys = new Set([
    "teacher",
    "checks",
    "takeaway",
    "attention",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5">
      {content.teacher && (
        <InfoBox title="كيف نتحقق؟" tone="sky" icon={CheckCircle2} compact={false}>
          <MathText className="font-semibold leading-8">
            {content.teacher}
          </MathText>
        </InfoBox>
      )}

      {checks.length > 0 && (
        <section className="rounded-[26px] border border-emerald-100 bg-emerald-50/35 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-emerald-800">
            <ListChecks size={18} />
            <h3 className="font-black">قائمة التحقق</h3>
          </div>
          <BulletList items={checks} tone="emerald" />
        </section>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <GenericObjectStep content={remainingContent} />
      )}

      {content.attention && (
        <InfoBox title="تنبيه" tone="rose" icon={AlertTriangle}>
          <MathText>{content.attention}</MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <StepTakeaway>{content.takeaway}</StepTakeaway>
      )}
    </div>
  );
}


function ApplicationStep({ content = {} }) {
  const items = Array.isArray(content.items)
    ? content.items.filter(Boolean)
    : [];

  const manuallyRenderedKeys = new Set([
    "teacher",
    "items",
    "mini_example",
    "takeaway",
    "attention",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5">
      {content.teacher && (
        <InfoBox title="التطبيق" tone="indigo" icon={Target} compact={false}>
          <MathText className="font-semibold leading-8">
            {content.teacher}
          </MathText>
        </InfoBox>
      )}

      {content.mini_example && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-600" />
            <h3 className="font-black text-slate-950">
              مثال تطبيقي
            </h3>
          </div>
          <SemanticExampleValue value={content.mini_example} />
        </section>
      )}

      {items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item, index) => {
            const question =
              item?.question ||
              item?.statement ||
              item?.transformation ||
              item?.title ||
              `التطبيق ${index + 1}`;

            return (
              <article
                key={item?.id || `application-${index}`}
                className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-indigo-100 bg-indigo-50/60 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                      {index + 1}
                    </span>
                    <MathText className="font-black text-slate-950">
                      {question}
                    </MathText>
                  </div>
                </div>

                <div className="space-y-3 p-5">
                  {item?.answer && (
                    <InfoBox title="النتيجة" tone="emerald" icon={CheckCircle2}>
                      <MathText className="font-black">{item.answer}</MathText>
                    </InfoBox>
                  )}

                  {item?.why && (
                    <InfoBox title="لماذا؟" tone="sky" icon={CircleHelp}>
                      <MathText>{item.why}</MathText>
                    </InfoBox>
                  )}

                  {item?.consequences && (
                    <BulletList items={item.consequences} tone="indigo" />
                  )}

                  <StructuredValue
                    value={Object.fromEntries(
                      Object.entries(item || {}).filter(
                        ([key]) =>
                          ![
                            "id",
                            "question",
                            "statement",
                            "transformation",
                            "title",
                            "answer",
                            "why",
                            "consequences",
                          ].includes(key),
                      ),
                    )}
                    depth={1}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <GenericObjectStep content={remainingContent} />
      )}

      {content.attention && (
        <InfoBox title="انتبه" tone="rose" icon={AlertTriangle}>
          <MathText>{content.attention}</MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <StepTakeaway>{content.takeaway}</StepTakeaway>
      )}
    </div>
  );
}


function BacMethodStep({ content = {} }) {
  const algorithm = Array.isArray(content.algorithm)
    ? content.algorithm.filter(Boolean)
    : content.algorithm
      ? [content.algorithm]
      : [];

  const templates = Array.isArray(content.answer_templates)
    ? content.answer_templates.filter(Boolean)
    : content.answer_templates
      ? [content.answer_templates]
      : [];

  const manuallyRenderedKeys = new Set([
    "teacher",
    "algorithm",
    "answer_templates",
    "takeaway",
    "attention",
  ]);

  const remainingContent = Object.fromEntries(
    Object.entries(content).filter(
      ([key, value]) =>
        !manuallyRenderedKeys.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    ),
  );

  return (
    <div className="space-y-5">
      {content.teacher && (
        <section className="rounded-[26px] border border-amber-200 bg-gradient-to-l from-amber-50 via-white to-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-amber-800">
            <GraduationCap size={19} />
            <h3 className="font-black">منهجية الحل في البكالوريا</h3>
          </div>
          <MathText className="font-semibold leading-8 text-slate-700">
            {content.teacher}
          </MathText>
        </section>
      )}

      {algorithm.length > 0 && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-indigo-700">
            <Route size={19} />
            <h3 className="font-black text-slate-950">الخطة خطوة بخطوة</h3>
          </div>

          <div className="space-y-3">
            {algorithm.map((item, index) => (
              <div
                key={`bac-method-${index}`}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-2 text-sm font-black text-white">
                  {index + 1}
                </span>
                <MathText className="min-w-0 flex-1 font-semibold text-slate-700">
                  {getDisplayText(item)}
                </MathText>
              </div>
            ))}
          </div>
        </section>
      )}

      {templates.length > 0 && (
        <RevealBox label="صياغات جاهزة للإجابة" tone="emerald">
          <BulletList items={templates} tone="emerald" />
        </RevealBox>
      )}

      {Object.keys(remainingContent).length > 0 && (
        <GenericObjectStep content={remainingContent} />
      )}

      {content.attention && (
        <InfoBox title="انتبه" tone="rose" icon={AlertTriangle}>
          <MathText>{content.attention}</MathText>
        </InfoBox>
      )}

      {content.takeaway && (
        <StepTakeaway>{content.takeaway}</StepTakeaway>
      )}
    </div>
  );
}

function StepBody({ step }) {
  const originalContent = step?.content || {};
  const { displayContent: content, lawGuides } =
    prepareStepContent(originalContent);

  let renderedStep = null;

  switch (step?.type) {
    case "discovery":
      renderedStep = <DiscoveryStep content={content} />;
      break;
    case "definition":
      renderedStep = <DefinitionStep content={content} />;
      break;
    case "motivation":
      renderedStep = <MotivationStep content={content} />;
      break;
    case "overview":
      renderedStep = <StrategyOverviewStep content={content} />;
      break;
    case "observation":
      renderedStep = <ObservationStep content={content} />;
      break;
    case "guided_explanation":
      renderedStep = <GuidedExplanationStep content={content} />;
      break;
    case "concept":
      renderedStep = <ConceptStep content={content} />;
      break;
    case "interpretation":
      renderedStep = <InterpretationStep content={content} />;
      break;
    case "notation":
      renderedStep = <NotationStep content={content} />;
      break;
    case "index_and_rank":
      renderedStep = <RankStep content={content} />;
      break;
    case "definition_methods_overview":
      renderedStep = <MethodsOverviewStep content={content} />;
      break;
    case "explicit_method":
      renderedStep = <ExplicitMethodStep content={content} />;
      break;
    case "recursive_method":
      renderedStep = <RecursiveMethodStep content={content} />;
      break;
    case "method":
      renderedStep = <MethodStep content={content} />;
      break;
    case "diagram":
      renderedStep = <MethodStep content={content} />;
      break;
    case "derivation":
      renderedStep = <MethodStep content={content} />;
      break;
    case "law":
      renderedStep = <ConceptStep content={content} />;
      break;
    case "method_selection":
      renderedStep = <MethodSelectionStep content={content} />;
      break;
    case "worked_example":
      renderedStep = <WorkedExampleStep content={content} />;
      break;
    case "reference_table":
      renderedStep = <ReferenceTableStep content={content} />;
      break;
    case "rule":
      renderedStep = <RuleStep content={content} />;
      break;
    case "graph_reading":
      renderedStep = <GraphReadingStep content={content} />;
      break;
    case "guided_practice":
      renderedStep = <GuidedPracticeStep content={content} />;
      break;
    case "final_assessment":
      renderedStep = <InPathFinalAssessmentStep content={content} />;
      break;
    case "comparison":
      renderedStep = <ComparisonStep content={content} />;
      break;
    case "classification":
      renderedStep = <ClassificationStep content={content} />;
      break;
    case "check":
      renderedStep = <CheckStep content={content} />;
      break;
    case "application":
      renderedStep = <ApplicationStep content={content} />;
      break;
    case "bac_method":
    case "exam_method":
      renderedStep = <BacMethodStep content={content} />;
      break;
    case "common_mistakes":
      renderedStep = <CommonMistakesStep content={content} />;
      break;
    case "mini_quiz":
    case "quiz":
      renderedStep = <MiniQuizStep content={content} />;
      break;
    case "summary":
      renderedStep = <SummaryStep content={content} />;
      break;
    case "classification_drill":
      renderedStep = <ClassificationDrillStep content={content} />;
      break;
    case "branch_guidance":
      renderedStep = <BranchGuidanceStep content={content} />;
      break;
    case "decision_tree":
      renderedStep = <DecisionTreeStep content={content} />;
      break;
    default:
      renderedStep = <GenericObjectStep content={content} />;
      break;
  }

  const hasRenderedContent =
    Object.keys(content).some(
      (key) =>
        ![
          "id",
          "graph",
          "graph_data",
          "graph_ref",
          "graphRef",
        ].includes(key),
    );

  const graphPosition = resolveGraphPosition(step);
  const showBeforeExplanation = graphPosition === "before_explanation";
  const showAfterExplanation =
    graphPosition === "after_explanation" ||
    graphPosition === "bottom";

  return (
    <div className="space-y-5">
      {showBeforeExplanation && (
        <StepGraph step={step} />
      )}

      <LawGuideSection guides={lawGuides} />

      {hasRenderedContent && renderedStep}

      {showAfterExplanation && (
        <StepGraph step={step} />
      )}
    </div>
  );
}


const STEP_META = {
  discovery: { label: "الاكتشاف", icon: Lightbulb, accent: "from-cyan-500 to-sky-600" },
  definition: { label: "التعريف", icon: BookOpen, accent: "from-indigo-500 to-violet-600" },
  property: { label: "خاصية", icon: Sparkles, accent: "from-sky-500 to-indigo-600" },
  theorem: { label: "مبرهنة", icon: GraduationCap, accent: "from-violet-500 to-indigo-700" },
  method: { label: "الطريقة", icon: Route, accent: "from-emerald-500 to-teal-600" },
  diagram: { label: "رسم توضيحي", icon: Compass, accent: "from-sky-500 to-indigo-600" },
  derivation: { label: "اشتقاق العلاقة", icon: Hash, accent: "from-violet-500 to-indigo-700" },
  law: { label: "قانون", icon: Sparkles, accent: "from-indigo-500 to-violet-600" },
  worked_example: { label: "مثال محلول", icon: CheckCircle2, accent: "from-emerald-500 to-cyan-600" },
  relationship: { label: "العلاقات", icon: Route, accent: "from-cyan-500 to-indigo-600" },
  special_case: { label: "حالة خاصة", icon: AlertTriangle, accent: "from-amber-500 to-orange-600" },
  graphical_interpretation: { label: "التمثيل البياني", icon: Compass, accent: "from-sky-500 to-violet-600" },
  guided_practice: { label: "تدريب موجه", icon: Target, accent: "from-blue-500 to-indigo-600" },
  final_assessment: { label: "تقويم نهائي", icon: Trophy, accent: "from-amber-500 to-rose-600" },
  quiz: { label: "اختبار الفهم", icon: ListChecks, accent: "from-fuchsia-500 to-violet-600" },
  motivation: { label: "الانطلاق", icon: Sparkles, accent: "from-amber-500 to-orange-500" },
  observation: { label: "الملاحظة", icon: CircleHelp, accent: "from-sky-500 to-cyan-500" },
  concept: { label: "الفكرة", icon: Brain, accent: "from-cyan-500 to-indigo-600" },
  guided_explanation: { label: "بناء المفهوم", icon: Brain, accent: "from-indigo-500 to-violet-500" },
  notation: { label: "الترميز", icon: Hash, accent: "from-violet-500 to-fuchsia-500" },
  index_and_rank: { label: "الدليل والرتبة", icon: ListChecks, accent: "from-sky-500 to-indigo-500" },
  definition_methods_overview: { label: "طرق التعريف", icon: Compass, accent: "from-cyan-500 to-indigo-500" },
  explicit_method: { label: "الحد العام", icon: Zap, accent: "from-indigo-500 to-blue-500" },
  recursive_method: { label: "العلاقة التراجعية", icon: Route, accent: "from-emerald-500 to-teal-500" },
  comparison: { label: "مقارنة", icon: ListChecks, accent: "from-slate-600 to-slate-900" },
  classification: { label: "تصنيف", icon: ListChecks, accent: "from-indigo-500 to-violet-600" },
  check: { label: "تحقق", icon: CheckCircle2, accent: "from-emerald-500 to-teal-600" },
  application: { label: "تطبيق", icon: Target, accent: "from-blue-500 to-indigo-600" },
  bac_connection: { label: "البكالوريا", icon: GraduationCap, accent: "from-amber-500 to-rose-500" },
  common_mistakes: { label: "أخطاء شائعة", icon: AlertTriangle, accent: "from-rose-500 to-red-600" },
  mini_quiz: { label: "اختبار سريع", icon: Target, accent: "from-fuchsia-500 to-violet-600" },
  summary: { label: "الخلاصة", icon: Trophy, accent: "from-emerald-500 to-indigo-600" },
  concept: { label: "مفهوم", icon: Brain, accent: "from-cyan-500 to-indigo-600" },
  rule: { label: "قاعدة", icon: Sparkles, accent: "from-indigo-500 to-violet-600" },
  reference_table: { label: "جدول مرجعي", icon: ListChecks, accent: "from-slate-700 to-indigo-800" },
  graph_reading: { label: "قراءة بيانية", icon: Compass, accent: "from-sky-500 to-indigo-600" },
  visualization: { label: "رسم تفاعلي", icon: Compass, accent: "from-violet-500 to-fuchsia-600" },
  graph_activity: { label: "نشاط بياني", icon: Compass, accent: "from-sky-500 to-indigo-600" },
  bac_method: { label: "منهجية البكالوريا", icon: GraduationCap, accent: "from-amber-500 to-rose-600" },
  exam_method: { label: "منهجية الامتحان", icon: GraduationCap, accent: "from-amber-500 to-rose-600" },
  lesson_summary: { label: "خلاصة الدرس", icon: Trophy, accent: "from-emerald-500 to-indigo-600" },
  sign_table: { label: "جدول إشارة", icon: ListChecks, accent: "from-emerald-500 to-indigo-600" },
  variation_table: { label: "جدول تغيرات", icon: Route, accent: "from-cyan-500 to-violet-600" },
  discussion_table: { label: "جدول مناقشة", icon: ListChecks, accent: "from-fuchsia-500 to-indigo-700" },
  checklist: { label: "قائمة تحقق", icon: CheckCircle2, accent: "from-emerald-500 to-teal-600" },
  strategy: { label: "استراتيجية", icon: Brain, accent: "from-indigo-600 to-slate-900" },
  decision_tree: { label: "شجرة قرار", icon: Route, accent: "from-violet-500 to-indigo-700" },
  classification_drill: { label: "تدريب على التصنيف", icon: ListChecks, accent: "from-indigo-500 to-violet-600" },
  branch_guidance: { label: "حسب الشعبة", icon: GraduationCap, accent: "from-sky-500 to-indigo-600" },
  exam_method: { label: "منهجية الامتحان", icon: GraduationCap, accent: "from-amber-500 to-rose-600" },
  comprehensive_flow: { label: "تسلسل شامل", icon: Route, accent: "from-cyan-600 to-indigo-700" },
  self_check: { label: "مراجعة ذاتية", icon: CheckCircle2, accent: "from-emerald-500 to-indigo-600" },
  time_management: { label: "إدارة الوقت", icon: Clock3, accent: "from-amber-500 to-orange-600" },
  attention: { label: "تنبيه", icon: AlertTriangle, accent: "from-rose-500 to-red-600" },
};


function normalizeReExplanationAnswer(payload) {
  const candidate =
    payload?.saved_explanation?.answer ??
    payload?.answer ??
    payload?.ai_answer ??
    payload?.response ??
    payload?.generated_answer ??
    payload?.re_explanation ??
    payload?.explanation ??
    payload?.message ??
    payload;

  if (typeof candidate === "string") {
    const text = candidate.trim();
    return text
      ? { type: "explanation", content: text, graph: null }
      : null;
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const type = candidate.type === "example" ? "example" : "explanation";
  const content =
    candidate.content ||
    (type === "example" ? candidate.example : candidate.explanation) ||
    candidate.simple_explanation ||
    candidate.direct_answer ||
    candidate.teacher_message ||
    "";

  if (!String(content || "").trim()) return null;

  return {
    type,
    content: String(content).trim(),
    graph:
      candidate.graph && typeof candidate.graph === "object"
        ? candidate.graph
        : null,
  };
}

function extractReExplanation(payload) {
  return normalizeReExplanationAnswer(payload)?.content || "";
}

function normalizeHistoryItem(item, index = 0) {
  if (!item) return null;

  const answerData = normalizeReExplanationAnswer(item);
  const answer = extractReExplanation(item);
  if (!answerData && !answer) return null;

  return {
    id:
      item?.id ??
      item?.history_id ??
      item?.re_explanation_id ??
      `history-${index}-${String(item?.created_at || item?.createdAt || "")}`,
    stepId:
      item?.step_id ??
      item?.stepId ??
      item?.step?.id ??
      item?.lesson_step_id ??
      "",
    question:
      item?.student_question ??
      item?.question ??
      item?.student_message ??
      "",
    answer,
    answerData,
    model: item?.model ?? item?.model_name ?? item?.ai_model ?? "",
    createdAt:
      item?.created_at ??
      item?.createdAt ??
      item?.date_created ??
      item?.timestamp ??
      "",
    raw: item,
  };
}

function splitExplanationContent(value) {
  const text = String(value || "")
    // بعض إجابات API ترجع الرموز \\n بدل أسطر حقيقية.
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) {
    return {
      intro: "",
      sections: [],
      result: "",
    };
  }

  const resultPattern =
    /^(?:النتيجة(?:\s+النهائية)?|إذن|وبالتالي|الخلاصة|نستنتج|الجواب(?:\s+النهائي)?)\s*[:：\-]?\s*/i;

  const sectionPattern =
    /^(?:(?:الخطوة|المرحلة)\s*(\d+)|([١٢٣٤٥٦٧٨٩]+)\s*[.)\-]|(أولًا|أولا|ثانيًا|ثانيا|ثالثًا|ثالثا|رابعًا|رابعا|خامسًا|خامسا|سادسًا|سادسا))\s*[:：\-]?\s*/i;

  const headingPattern =
    /^(الفكرة|التفسير|التطبيق|الحساب|الحل|المطلوب|المعطيات|نلاحظ|نحسب|نعوض|نتحقق)\s*[:：\-]?\s*/i;

  const lines = text
    .split(/\n+/)
    .flatMap((line) => {
      const normalizedLine = line.trim();
      if (!normalizedLine) return [];

      // يفصل الخطوات عندما يضعها النموذج في السطر نفسه: 1. ... 2. ...
      return normalizedLine
        .split(/\s+(?=(?:\d+|[١٢٣٤٥٦٧٨٩]+)[.)]\s+)/)
        .map((item) => item.trim())
        .filter(Boolean);
    });

  const sections = [];
  const introParts = [];
  let result = "";

  lines.forEach((line) => {
    const cleanLine = line
      .replace(/^[-•▪◦–—]\s*/, "")
      .replace(/^\\?n+\s*/i, "")
      .trim();

    if (!cleanLine) return;

    if (resultPattern.test(cleanLine)) {
      const resultText = cleanLine.replace(resultPattern, "").trim();
      result = resultText || cleanLine;
      return;
    }

    const sectionMatch = cleanLine.match(sectionPattern);
    if (sectionMatch) {
      const content = cleanLine.slice(sectionMatch[0].length).trim();
      sections.push({
        title: `الخطوة ${sections.length + 1}`,
        content: content || cleanLine,
      });
      return;
    }

    const headingMatch = cleanLine.match(headingPattern);
    if (headingMatch) {
      const title = headingMatch[1];
      const content = cleanLine.slice(headingMatch[0].length).trim();
      sections.push({
        title,
        content: content || cleanLine,
      });
      return;
    }

    // أول فقرة أو فقرتين قصيرتين تبقيان كمقدمة، والباقي يصبح شرحًا متتابعًا.
    if (sections.length === 0 && introParts.length < 2) {
      introParts.push(cleanLine);
    } else {
      sections.push({
        title: `الخطوة ${sections.length + 1}`,
        content: cleanLine,
      });
    }
  });

  // لا نحول نصًا قصيرًا إلى خطوات مصطنعة.
  if (sections.length === 1 && introParts.length === 0) {
    introParts.push(sections[0].content);
    sections.length = 0;
  }

  return {
    intro: introParts.join("\n\n"),
    sections,
    result,
  };
}

function ReExplanationAnswer({ answer }) {
  const normalized = normalizeReExplanationAnswer(answer);
  if (!normalized) return null;

  const isExample = normalized.type === "example";
  const parsed = splitExplanationContent(normalized.content);

  const theme = isExample
    ? {
        title: "مثال توضيحي",
        label: "تطبيق بسيط على الفكرة",
        Icon: GraduationCap,
        icon: "bg-emerald-100 text-emerald-700",
        line: "bg-emerald-300",
        number: "border-emerald-200 bg-emerald-50 text-emerald-700",
        result: "border-emerald-200 bg-emerald-50/70 text-emerald-950",
      }
    : {
        title: "شرح مبسط",
        label: "لنشرح الفكرة بهدوء",
        Icon: Brain,
        icon: "bg-indigo-100 text-indigo-700",
        line: "bg-indigo-300",
        number: "border-indigo-200 bg-indigo-50 text-indigo-700",
        result: "border-indigo-200 bg-indigo-50/70 text-indigo-950",
      };

  const HeaderIcon = theme.Icon;

  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
      {/* رأس بسيط مثل رسالة Chat، بدون بطاقة كبيرة داخل بطاقة أخرى */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            theme.icon,
          )}
        >
          <HeaderIcon size={20} />
        </span>

        <div className="min-w-0">
          <h4 className="text-base font-black text-slate-950 sm:text-lg">
            {theme.title}
          </h4>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {theme.label}
          </p>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-7 sm:py-6">
        {parsed.intro && (
          <MathText className="text-[15px] font-semibold leading-9 text-slate-800 sm:text-base sm:leading-10">
            {parsed.intro}
          </MathText>
        )}

        {parsed.sections.length > 0 && (
          <div
            className={cn(
              "relative mt-6 space-y-6 border-r-2 pr-5 sm:pr-7",
              isExample ? "border-emerald-100" : "border-indigo-100",
            )}
          >
            {parsed.sections.map((section, index) => (
              <div key={`${section.title}-${index}`} className="relative">
                <span
                  className={cn(
                    "absolute -right-[31px] top-0 flex h-7 min-w-7 items-center justify-center rounded-full border px-1 text-xs font-black sm:-right-[39px]",
                    theme.number,
                  )}
                >
                  {index + 1}
                </span>

                <div className="min-w-0">
                  <p className="mb-1 text-xs font-black text-slate-500">
                    {section.title}
                  </p>
                  <MathText className="text-[15px] font-semibold leading-9 text-slate-800 sm:text-base sm:leading-10">
                    {section.content}
                  </MathText>
                </div>
              </div>
            ))}
          </div>
        )}

        {parsed.result && (
          <div
            className={cn(
              "mt-6 flex items-start gap-3 rounded-2xl border px-4 py-3.5",
              theme.result,
            )}
          >
            <CheckCircle2 size={19} className="mt-1 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-black opacity-70">النتيجة</p>
              <MathText className="font-black leading-8 sm:leading-9">
                {parsed.result}
              </MathText>
            </div>
          </div>
        )}

        {normalized.graph && (
          <div className="mt-7 border-t border-slate-100 pt-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
              <Compass size={18} className="text-indigo-600" />
              الرسم المساعد
            </div>
            <GraphRenderer graph={normalized.graph} />
          </div>
        )}
      </div>
    </div>
  );
}

function extractHistoryArray(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;

  const candidates = [
    source?.re_explain_history,
    source?.re_explanations,
    source?.re_explanation_history,
    source?.explanation_history,
    source?.history,
    source?.histories,
    source?.previous_explanations,
    source?.answers,
    source?.results,
    source?.data,
  ];

  return candidates.find(Array.isArray) || [];
}

function getStepHistory(source, stepId) {
  const allItems = extractHistoryArray(source);

  return allItems
    .map((item, index) => normalizeHistoryItem(item, index))
    .filter(Boolean)
    .filter((item) => !item.stepId || String(item.stepId) === String(stepId));
}

function formatHistoryDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("ar-DZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const RE_EXPLAIN_ACTIONS = [
  {
    id: "explanation",
    requestType: "explanation",
    label: "أعد شرح المرحلة",
    shortLabel: "شرح مبسط",
    icon: Brain,
    prompt:
      "أعد شرح هذه المرحلة فقط بطريقة بسيطة جدًا ومفصلة، كأنني لم أفهمها من البداية. فسّر الفكرة والرموز وسبب كل خطوة تدريجيًا، ولا تضف مثالًا مستقلًا.",
  },
  {
    id: "example",
    requestType: "example",
    label: "أعطني مثالًا",
    shortLabel: "مثال",
    icon: Lightbulb,
    prompt:
      "أعطني مثالًا واحدًا واضحًا من نفس المرحلة، وطبّقه تدريجيًا مع شرح العمليات حتى أصل إلى النتيجة. لا تعِد شرح الدرس كاملًا.",
  },
];

function ReExplainPanel({
  step,
  axis,
  axisId,
  initialHistory = [],
  onReExplain
}) {
    const COURSE_URL = import.meta.env.VITE_COURSE_URL;

  const reExplainEndpoint = `${COURSE_URL}axes/re-explication/`;
  const [open, setOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const { token } = useContext(UserContext);

  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const activeStepIdRef = useRef(step?.id || "");
  const messagesEndRef = useRef(null);
  const shouldAutoScrollRef = useRef(false);
  const loading = Boolean(loadingAction);

  useEffect(() => {
    const normalized = (Array.isArray(initialHistory) ? initialHistory : [])
      .map((item, index) => normalizeHistoryItem(item, index))
      .filter(Boolean)
      .filter(
        (item) =>
          !item.stepId || String(item.stepId) === String(step?.id || ""),
      )
      .sort((a, b) => {
        const first = new Date(a.createdAt || 0).getTime();
        const second = new Date(b.createdAt || 0).getTime();
        return first - second;
      });

    activeStepIdRef.current = step?.id || "";
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // لا نفتح سجل الشروحات تلقائيًا عند العودة إلى المرحلة.
    // يبقى مخفيًا إلى أن يضغط التلميذ على زر المساعد الذكي.
    setOpen(false);
    shouldAutoScrollRef.current = false;
    setLoadingAction("");
    setError("");
    setHistory(normalized.slice(-3));

    return () => abortControllerRef.current?.abort();
  }, [step?.id, initialHistory]);

  useEffect(() => {
    // لا نهبط إلى الشروحات القديمة عند فتح الصفحة أو عند فتح السجل فقط.
    // التمرير يحدث حصريًا بعد أن يطلب التلميذ شرحًا أو مثالًا جديدًا.
    if (!open || !shouldAutoScrollRef.current) return;

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });

    if (!loading) {
      shouldAutoScrollRef.current = false;
    }
  }, [history, loading, open]);

  async function requestExplanation(action) {
    if (!action || loading) return;

    if (!step || typeof step !== "object" || !step.id) {
      setError("المرحلة الحالية غير صالحة.");
      return;
    }

    const resolvedAxisId = axisId ?? axis?.id;
    if (resolvedAxisId === undefined || resolvedAxisId === null || resolvedAxisId === "") {
      setError("معرف المحور غير موجود.");
      return;
    }

    const requestedStep = {
      id: step.id,
      type: step.type || "lesson_step",
      title: step.title || "شرح المرحلة",
      content: step.content || {},
    };

    const requestedStepId = String(requestedStep.id);
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const optimisticId = `pending-${currentRequestId}-${Date.now()}`;
    const optimisticItem = {
      id: optimisticId,
      stepId: requestedStepId,
      question: action.label,
      answer: "",
      answerData: null,
      model: "",
      createdAt: new Date().toISOString(),
      pending: true,
    };

    shouldAutoScrollRef.current = true;
    setOpen(true);
    setError("");
    setLoadingAction(action.id);
    setHistory((current) => [...current.filter((item) => !item.pending), optimisticItem].slice(-3));

    const payload = {
      step: requestedStep,
      student_question: action.prompt,
      request_type: action.requestType,
      axis_id: Number(resolvedAxisId),
    };

    try {
      let result;

      if (typeof onReExplain === "function") {
        result = await onReExplain(payload, {
          signal: controller.signal,
          stepId: requestedStepId,
          actionId: action.id,
        });
      } else {
        const response = await axios.post(reExplainEndpoint, payload, {
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        result = response.data;
      }

      if (
        controller.signal.aborted ||
        requestIdRef.current !== currentRequestId ||
        String(activeStepIdRef.current) !== requestedStepId
      ) {
        return;
      }

      const savedSource = result?.saved_explanation || result;
      const savedItem = normalizeHistoryItem(
        {
          ...savedSource,
          ...result,
          step_id: result?.step_id ?? savedSource?.step_id ?? requestedStepId,
          student_question: action.label,
          answer: result?.answer ?? savedSource?.answer,
          model: result?.model ?? savedSource?.model_name ?? "",
          created_at:
            savedSource?.created_at ||
            savedSource?.updated_at ||
            new Date().toISOString(),
        },
        currentRequestId,
      );

      if (!savedItem) {
        throw new Error("وصل جواب فارغ من الخادم.");
      }

      setHistory((current) => {
        const withoutPending = current.filter((item) => item.id !== optimisticId);
        const withoutDuplicate = withoutPending.filter(
          (item) => String(item.id) !== String(savedItem.id),
        );
        return [...withoutDuplicate, savedItem].slice(-3);
      });
    } catch (requestError) {
      setHistory((current) => current.filter((item) => item.id !== optimisticId));

      if (
        axios.isCancel(requestError) ||
        requestError?.code === "ERR_CANCELED" ||
        controller.signal.aborted
      ) {
        return;
      }

      const responseData = requestError?.response?.data;
      const serializerMessage = responseData && typeof responseData === "object"
        ? Object.values(responseData).flat().find((value) => typeof value === "string")
        : "";

      const detail =
        responseData?.detail ||
        responseData?.error ||
        responseData?.message ||
        serializerMessage ||
        requestError?.message;

      setError(detail || "حدث خطأ أثناء إنشاء الشرح.");
    } finally {
      if (
        requestIdRef.current === currentRequestId &&
        String(activeStepIdRef.current) === requestedStepId
      ) {
        setLoadingAction("");
      }
    }
  }

  return (
    <section
      dir="rtl"
      className="mt-6 overflow-hidden rounded-[26px] border border-slate-200/90 bg-white shadow-[0_18px_55px_-32px_rgba(15,23,42,0.5)]"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-right transition hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-500/25">
            <WandSparkles size={18} />
            <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-black text-slate-950">
                المساعد الذكي
              </h3>
              {history.length > 0 && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700">
                  {history.length}/3
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
              اختر: شرح مبسط أو مثال توضيحي
            </p>
          </div>
        </div>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-700">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3">
            {RE_EXPLAIN_ACTIONS.map((action) => {
              const Icon = action.icon;
              const isLoading = loadingAction === action.id;

              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => requestExplanation(action)}
                  disabled={loading}
                  title={action.label}
                  className={cn(
                    "group/action flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-4 text-center shadow-sm transition duration-200",
                    isLoading
                      ? "border-indigo-400 ring-2 ring-indigo-100"
                      : "border-slate-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md",
                    loading && !isLoading && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-white transition group-hover/action:bg-indigo-600">
                    {isLoading ? (
                      <Loader2 className="animate-spin" size={15} />
                    ) : (
                      <Icon size={15} />
                    )}
                  </span>
                  <span className="text-[10px] font-black leading-4 text-slate-800 sm:text-[11px]">
                    {action.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-rose-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={15} />
              <p className="text-[11px] font-bold leading-5">{error}</p>
            </div>
          )}

          {history.length > 0 && (
            <div className="mt-3 space-y-2.5">
              {history.map((item, index) => (
                <article
                  key={item.id || index}
                  className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm"
                >
                  <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-3.5 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                        {item.pending ? (
                          <Loader2 className="animate-spin" size={14} />
                        ) : (
                          <Sparkles size={14} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-black text-slate-900">
                          {item.question || "شرح المرحلة"}
                        </p>
                        {item.model && (
                          <p className="truncate text-[9px] font-semibold text-slate-400">
                            {item.model}
                          </p>
                        )}
                      </div>
                    </div>

                    {item.createdAt && !item.pending && (
                      <span className="shrink-0 text-[9px] font-semibold text-slate-400">
                        {formatHistoryDate(item.createdAt)}
                      </span>
                    )}
                  </header>

                  <div className="p-3.5 sm:p-4">
                    {item.pending ? (
                      <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-[11px] font-bold text-indigo-700">
                        <Loader2 className="animate-spin" size={15} />
                        يتم إعداد المساعدة...
                      </div>
                    ) : (
                      <ReExplanationAnswer answer={item.answerData || item.answer} />
                    )}
                  </div>
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LessonStepCard({
  step,
  index,
  total,
  lessonTitle,
  axis,
  axisId,
  initialHistory,
  onReExplain,
  reExplainEndpoint,
}) {
  const meta = STEP_META[step.type] || {
    label: "شرح",
    icon: BookOpen,
    accent: "from-slate-600 to-slate-900",
  };

  const Icon = meta.icon;

  /*
   * StepBody هو المسؤول الوحيد عن عرض محتوى المرحلة، بما فيه:
   * graph / graph_data / attention / warning / takeaway.
   *
   * سابقًا كان LessonStepCard يعيد عرض الرسم والتنبيه والخلاصة
   * بعد أن تكون قد ظهرت داخل StepBody، لذلك كانت العناصر تتكرر.
   */
  /*
   * prepareStepContent يستبعد الحقول البيداغوجية من StepBody، لذلك تصبح
   * PedagogicalBlocks وStepTakeaway المالكين الوحيدين لعرضها في كل الأنواع.
   */
  const fieldsRenderedInsideBody = new Set();
  const shouldRenderExternalTakeaway = Boolean(step?.content?.takeaway);

  return (
    <article
      id={step.id || `step-${index + 1}`}
      className="scroll-mt-24 overflow-hidden rounded-[36px] border border-white/90 bg-white shadow-[0_28px_90px_-45px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70"
    >
      <div
        className={cn(
          "relative overflow-hidden bg-gradient-to-l px-5 py-6 text-white sm:px-8 sm:py-7",
          meta.accent,
        )}
      >
        <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/20 bg-white/15 shadow-lg backdrop-blur">
              <Icon size={23} />
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-black tracking-[0.14em] text-white/75">
                {meta.label}
              </p>

              <MathText
                as="h2"
                className="mt-1 text-xl font-black leading-8 text-white sm:text-[28px]"
              >
                {step.title}
              </MathText>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/15 px-4 py-2 text-xs font-black shadow-sm backdrop-blur">
            المرحلة {index + 1} من {total}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-white via-white to-slate-50/40 p-5 sm:p-8">
        <div className="space-y-6">
          {resolveGraphPosition(step) === "before_question" && (
            <StepGraph step={step} />
          )}

          <div>
            <InteractiveCheckpoint activity={step?.content?.pre_question} />

            {step?.content?.attempt_instruction && (
              <div className="mb-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                <MathText className="text-sm font-bold text-sky-900">
                  {step.content.attempt_instruction}
                </MathText>
              </div>
            )}
          </div>

          {resolveGraphPosition(step) === "after_question" && (
            <StepGraph step={step} />
          )}

          {/*
            StepBody يعرض الشرح والرسم في الموضع المحدد:
            before_explanation / after_explanation / bottom.
            أما before_question وafter_question فيتم عرضهما هنا.
          */}
          <StepBody step={step} />

          {/*
            يعرض فقط الحقول البيداغوجية التي لم يعرضها StepBody.
            getExcludedPedagogicalFields يمنع تكرار attention وغيره.
          */}
          <PedagogicalBlocks
            content={step?.content}
            excludeFields={fieldsRenderedInsideBody}
          />

          {shouldRenderExternalTakeaway && (
            <StepTakeaway>{step.content.takeaway}</StepTakeaway>
          )}
        </div>

        <ReExplainPanel
          key={step.id || `re-explain-${index}`}
          step={step}
          lessonTitle={lessonTitle}
          axis={axis}
          axisId={axisId}
          initialHistory={initialHistory}
          onReExplain={onReExplain}
          reExplainEndpoint={reExplainEndpoint}
        />
      </div>
    </article>
  );
}

/* =========================================================
   Final assessment
========================================================= */


function FinalAssessment({ assessment = {} }) {
  const [openAnswers, setOpenAnswers] = useState(false);

  if (
    !assessment ||
    typeof assessment !== "object" ||
    Object.keys(assessment).length === 0
  ) {
    return null;
  }

  const toArray = (value) => {
    if (value === null || value === undefined || value === "") return [];
    return Array.isArray(value) ? value.filter(Boolean) : [value];
  };

  const getAssessmentText = (item) => {
    if (item === null || item === undefined) return "";

    if (typeof item === "string" || typeof item === "number") {
      return String(item);
    }

    if (typeof item !== "object") return String(item);

    return (
      item.text ||
      item.question ||
      item.answer ||
      item.expected_answer ||
      item.final_answer ||
      item.solution ||
      item.correction ||
      item.result ||
      item.statement ||
      item.instruction ||
      item.title ||
      item.label ||
      item.content ||
      Object.values(item)
        .filter(
          (value) =>
            typeof value === "string" ||
            typeof value === "number",
        )
        .join(" — ") ||
      ""
    );
  };

  const statement =
    assessment.statement ||
    assessment.exercise ||
    assessment.question ||
    assessment.prompt ||
    "";

  const instructions =
    assessment.instructions ||
    assessment.instruction ||
    assessment.guidelines ||
    assessment.expected_writing ||
    "";

  const questions = toArray(
    assessment.questions ??
      assessment.tasks ??
      assessment.items,
  );

  const rawAnswers =
    assessment.answers ??
    assessment.solution ??
    assessment.solutions ??
    assessment.solution_steps ??
    assessment.expected_answers ??
    assessment.expected_answer ??
    assessment.final_answer;

  const legacyAnswerOrder = [
    "images",
    "roots",
    "antecedents_of_3",
    "sign",
    "variations",
    "maximum",
  ];

  const normalizeAssessmentAnswers = (value) => {
    if (isEmpty(value)) return [];

    // الصيغة الجديدة الموصى بها:
    // [{ question_number: 1, title: "...", answer: "..." }]
    if (Array.isArray(value)) {
      return value
        .filter((item) => !isEmpty(item))
        .map((item, index) => {
          if (
            item &&
            typeof item === "object" &&
            !Array.isArray(item)
          ) {
            return {
              ...item,
              id: item.id || `assessment-answer-${index + 1}`,
              question_number:
                item.question_number ??
                item.number ??
                item.step_number ??
                index + 1,
              title:
                item.title ||
                item.label ||
                item.question_title ||
                `إجابة السؤال ${index + 1}`,
              answer:
                item.answer ??
                item.expected_answer ??
                item.solution ??
                item.final_answer ??
                item.result ??
                item.text ??
                "",
            };
          }

          return {
            id: `assessment-answer-${index + 1}`,
            question_number: index + 1,
            title: `إجابة السؤال ${index + 1}`,
            answer: item,
          };
        })
        .filter((item) => !isEmpty(item.answer));
    }

    // دعم الملفات القديمة التي كانت ترسل expected_answer ككائن.
    // لا نعتمد على Object.entries وحده لأن ترتيب المفاتيح
    // لا يمثل بالضرورة ترتيب الأسئلة.
    if (value && typeof value === "object") {
      const orderedKeys = [
        ...legacyAnswerOrder.filter((key) =>
          Object.prototype.hasOwnProperty.call(value, key),
        ),
        ...Object.keys(value).filter(
          (key) => !legacyAnswerOrder.includes(key),
        ),
      ];

      const legacyQuestionNumbers = {
        images: 1,
        roots: 2,
        antecedents_of_3: 3,
        sign: 4,
        variations: 5,
        maximum: 5,
      };

      const legacyTitles = {
        images: "قراءة الصور",
        roots: "حل المعادلة f(x)=0",
        antecedents_of_3: "سوابق العدد 3",
        sign: "إشارة الدالة",
        variations: "مجالا التزايد والتناقص",
        maximum: "القيمة العظمى",
      };

      return orderedKeys
        .filter((key) => !isEmpty(value[key]))
        .map((key, index) => ({
          id: key,
          question_number:
            legacyQuestionNumbers[key] ?? index + 1,
          title:
            legacyTitles[key] ||
            fieldLabel(key) ||
            `إجابة السؤال ${index + 1}`,
          answer: value[key],
        }));
    }

    return [
      {
        id: "assessment-answer-1",
        question_number: 1,
        title: "الإجابة",
        answer: value,
      },
    ];
  };

  const answers = normalizeAssessmentAnswers(rawAnswers);

  const successCriteria = toArray(
    assessment.success_criteria ??
      assessment.criteria ??
      assessment.grading?.criteria,
  );

  const measuredSkills = toArray(
    assessment.skills ??
      assessment.measured_skills ??
      assessment.learning_outcomes,
  );

  const guidedPrompts = toArray(
    assessment.guided_prompts ??
      assessment.hints ??
      assessment.hint_levels,
  );

  const grading =
    assessment.grading &&
    typeof assessment.grading === "object" &&
    !Array.isArray(assessment.grading)
      ? assessment.grading
      : null;

  const gradingEntries = grading
    ? Object.entries(grading).filter(
        ([, value]) =>
          value !== null &&
          value !== undefined &&
          value !== "" &&
          !Array.isArray(value) &&
          typeof value !== "object",
      )
    : [];

  const gradingCriteria = grading
    ? toArray(
        grading.criteria ??
          grading.rubric ??
          grading.items ??
          grading.details,
      )
    : [];

  return (
    <section className="overflow-hidden rounded-[36px] border border-amber-200/80 bg-white shadow-[0_28px_80px_-42px_rgba(245,158,11,0.5)]">
      <div className="relative overflow-hidden bg-gradient-to-l from-amber-500 via-orange-500 to-rose-500 p-6 text-white sm:p-9">
        <div className="pointer-events-none absolute -left-10 -top-16 h-44 w-44 rounded-full bg-white/20 blur-2xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Trophy size={24} />
          </div>

          <div>
            <p className="text-xs font-black text-white/80">
              التقييم الختامي
            </p>
            <h2 className="text-2xl font-black">
              {assessment.title || "اختبر إتقانك للمحور"}
            </h2>
          </div>
        </div>

        {statement && (
          <MathText className="mt-5 font-semibold text-white">
            {statement}
          </MathText>
        )}
      </div>

      <div className="space-y-7 p-5 sm:p-8">
        {instructions && (
          <InfoBox
            title="تعليمات الإجابة"
            tone="amber"
            icon={ListChecks}
          >
            <MathText className="font-bold">
              {instructions}
            </MathText>
          </InfoBox>
        )}

        {questions.length > 0 && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <CircleHelp size={20} className="text-indigo-600" />
              <h3 className="font-black text-slate-950">
                أسئلة التقييم
              </h3>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                {questions.length}
              </span>
            </div>

            <div className="space-y-3.5">
              {questions.map((question, index) => {
                const questionText = getAssessmentText(question);
                if (!questionText) return null;

                const points =
                  typeof question === "object"
                    ? question.points ??
                      question.mark ??
                      question.score
                    : null;

                return (
                  <div
                    key={question?.id || `assessment-question-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-black text-white">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <MathText className="font-bold text-slate-800">
                          {questionText}
                        </MathText>

                        {points !== null &&
                          points !== undefined &&
                          points !== "" && (
                            <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">
                              {points} نقطة
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {measuredSkills.length > 0 && (
          <div>
            <h3 className="mb-4 font-black text-slate-950">
              المهارات المقاسة
            </h3>
            <BulletList
              items={measuredSkills}
              tone="indigo"
              icon={Target}
            />
          </div>
        )}

        {guidedPrompts.length > 0 && (
          <div>
            <h3 className="mb-4 font-black text-slate-950">
              توجيهات وتلميحات
            </h3>
            <BulletList
              items={guidedPrompts}
              tone="sky"
              icon={Compass}
            />
          </div>
        )}

        {(gradingEntries.length > 0 ||
          gradingCriteria.length > 0) && (
          <div className="overflow-hidden rounded-[28px] border border-violet-200 bg-violet-50/60">
            <div className="border-b border-violet-200 bg-gradient-to-l from-violet-100 to-white px-5 py-4">
              <div className="flex items-center gap-2">
                <GraduationCap
                  size={20}
                  className="text-violet-700"
                />
                <h3 className="font-black text-violet-950">
                  سلم التنقيط
                </h3>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {gradingEntries.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {gradingEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"
                    >
                      <p className="text-xs font-black text-violet-600">
                        {fieldLabel(key)}
                      </p>
                      <MathText className="mt-1 font-black text-slate-900">
                        {String(value)}
                      </MathText>
                    </div>
                  ))}
                </div>
              )}

              {gradingCriteria.length > 0 && (
                <BulletList
                  items={gradingCriteria}
                  tone="indigo"
                  icon={CheckCircle2}
                />
              )}
            </div>
          </div>
        )}

        {answers.length > 0 && (
          <>
            <button
              type="button"
              onClick={() =>
                setOpenAnswers((value) => !value)
              }
              className="flex w-full items-center justify-between rounded-2xl bg-slate-950 px-5 py-4 font-black text-white transition hover:bg-indigo-700"
            >
              <span>
                {openAnswers
                  ? "إخفاء التصحيح"
                  : `إظهار التصحيح النموذجي (${answers.length})`}
              </span>
              {openAnswers ? (
                <ChevronUp size={19} />
              ) : (
                <ChevronDown size={19} />
              )}
            </button>

            <AnimatedCollapse open={openAnswers} className="mt-4">
              <div className="space-y-4">
                {answers.map((answer, index) => {
                  const answerText =
                    getAssessmentText(answer);

                  if (!answerText) return null;

                  const explanation =
                    typeof answer === "object"
                      ? answer.explanation ||
                        answer.why ||
                        answer.reason ||
                        answer.justification ||
                        ""
                      : "";

                  return (
                    <div
                      key={
                        answer?.id ||
                        `assessment-answer-${index}`
                      }
                      className="animate-[fadeSlideIn_0.45s_ease-out_both] rounded-[24px] border border-emerald-200 bg-emerald-50/50 p-5"
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 font-black text-white">
                          {answer?.question_number ?? index + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          {answer?.title && (
                            <p className="mb-2 text-sm font-black text-emerald-800">
                              {answer.title}
                            </p>
                          )}
                          <p className="mb-1 text-xs font-black text-emerald-700">
                            الإجابة النموذجية
                          </p>
                          <MathText className="font-black text-slate-900">
                            {answerText}
                          </MathText>

                          {explanation && (
                            <div className="mt-3 rounded-2xl border border-sky-100 bg-white p-4">
                              <p className="mb-1 text-xs font-black text-sky-700">
                                التفسير
                              </p>
                              <MathText className="text-sm font-semibold text-slate-700">
                                {explanation}
                              </MathText>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AnimatedCollapse>
          </>
        )}

        {assessment.verification && (
          <InfoBox
            title="التحقق"
            tone="sky"
            icon={CheckCircle2}
          >
            <MathText className="font-bold">
              {assessment.verification}
            </MathText>
          </InfoBox>
        )}

        {successCriteria.length > 0 && (
          <div>
            <h3 className="mb-4 font-black text-slate-950">
              معايير النجاح
            </h3>
            <BulletList
              items={successCriteria}
              tone="emerald"
              icon={CheckCircle2}
            />
          </div>
        )}
      </div>
    </section>
  );
}



/* =========================================================
   BAC exercise renderer
   يدعم ملفات تمارين البكالوريا بالشكل:
   statement + figures/statement_graphs + tables + questions[].solution
========================================================= */

function normalizeBacExercise(data) {
  const candidate =
    data?.exercise ||
    data?.bac_exercise ||
    data?.content?.exercise ||
    data;

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const questions = Array.isArray(candidate.questions)
    ? candidate.questions.filter(Boolean)
    : [];

  const looksLikeBacExercise =
    questions.length > 0 &&
    (
      candidate.exercise_number !== undefined ||
      candidate.year !== undefined ||
      candidate.statement ||
      candidate.title
    ) &&
    !Array.isArray(candidate.learning_path);

  return looksLikeBacExercise ? candidate : null;
}

function dedupeVisuals(...collections) {
  const seen = new Set();
  const result = [];

  collections.flat().filter(Boolean).forEach((item, index) => {
    if (!item || typeof item !== "object") return;

    const svg = getGraphSvgMarkup(item);
    const key =
      item.id ||
      item.graph_id ||
      item.diagram_type ||
      item.title ||
      svg ||
      `visual-${index}`;

    const normalizedKey = String(key).trim();
    if (!normalizedKey || seen.has(normalizedKey)) return;

    seen.add(normalizedKey);
    result.push(item);
  });

  return result;
}

function BacVisualCollection({ items = [] }) {
  const visuals = dedupeVisuals(items);
  if (visuals.length === 0) return null;

  return (
    <div className="space-y-5">
      {visuals.map((visual, index) => (
        <CompleteGraphValue
          key={
            visual.id ||
            visual.graph_id ||
            visual.diagram_type ||
            visual.title ||
            index
          }
          value={visual}
        />
      ))}
    </div>
  );
}

function BacDataTable({ table, index = 0 }) {
  if (!table || typeof table !== "object") return null;

  const data = table.data && typeof table.data === "object"
    ? table.data
    : table;

  const headers = Array.isArray(data.headers) ? data.headers : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];

  if (headers.length === 0 && rows.length === 0) return null;

  return (
    <figure className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
      {(table.title || table.caption) && (
        <figcaption className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <MathText className="font-black text-slate-900">
            {table.title || table.caption}
          </MathText>
        </figcaption>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          {headers.length > 0 && (
            <thead>
              <tr className="bg-indigo-50">
                {headers.map((header, cellIndex) => (
                  <th
                    key={`bac-th-${index}-${cellIndex}`}
                    className="whitespace-nowrap border border-slate-200 px-4 py-3 text-center font-black text-indigo-950"
                  >
                    <MathText>{String(header)}</MathText>
                  </th>
                ))}
              </tr>
            </thead>
          )}

          {rows.length > 0 && (
            <tbody>
              {rows.map((row, rowIndex) => {
                const cells = Array.isArray(row)
                  ? row
                  : row && typeof row === "object"
                    ? Object.values(row)
                    : [row];

                return (
                  <tr
                    key={`bac-row-${index}-${rowIndex}`}
                    className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70"}
                  >
                    {cells.map((cell, cellIndex) => (
                      <td
                        key={`bac-cell-${index}-${rowIndex}-${cellIndex}`}
                        className="min-w-[110px] border border-slate-200 px-4 py-3 text-center font-semibold text-slate-700"
                      >
                        <MathText>{String(cell ?? "")}</MathText>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
    </figure>
  );
}

function BacTables({ exercise }) {
  const rawTables = [
    ...(Array.isArray(exercise?.tables) ? exercise.tables : []),
    ...(exercise?.data_table
      ? [{ title: exercise?.data_table?.title || "المعطيات", data: exercise.data_table }]
      : []),
    ...(exercise?.indicator_table
      ? [{ title: exercise?.indicator_table?.title || "جدول الكواشف", data: exercise.indicator_table }]
      : []),
    ...(exercise?.completed_table
      ? [{ title: "الجدول المكتمل", data: exercise.completed_table }]
      : []),
  ];

  if (rawTables.length === 0) return null;

  return (
    <div className="space-y-5">
      {rawTables.map((table, index) => (
        <BacDataTable key={`bac-table-${index}`} table={table} index={index} />
      ))}
    </div>
  );
}

function BacSolutionStep({ step, index }) {
  if (!step) return null;

  const primitive =
    typeof step === "string" ||
    typeof step === "number";

  const title = primitive
    ? `الخطوة ${index + 1}`
    : step.title || `الخطوة ${step.step_number || index + 1}`;

  const goal = primitive ? "" : step.goal || "";
  const why = primitive ? "" : step.why || "";
  const explanation = primitive
    ? String(step)
    : step.explanation ||
      step.instruction ||
      step.text ||
      step.answer ||
      "";

  const formula = primitive ? "" : step.formula || "";
  const calculation = primitive ? "" : step.calculation || "";
  const result = primitive ? "" : step.result || "";
  const studentTip = primitive
    ? ""
    : step.student_tip || step.memory_tip || step.tip || "";

  const visuals = primitive
    ? []
    : dedupeVisuals(
        step.graph_data ? [step.graph_data] : [],
        step.graph ? [step.graph] : [],
        Array.isArray(step.figures) ? step.figures : [],
      );

  return (
    <article className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_40px_-32px_rgba(15,23,42,0.45)]">
      <div className="flex items-start gap-3 border-b border-slate-200 bg-gradient-to-l from-slate-50 to-indigo-50/60 px-4 py-4 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-black text-white shadow-sm">
          {primitive ? index + 1 : step.step_number || index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <MathText as="h4" className="font-black text-slate-950">
            {title}
          </MathText>

          {!isEmpty(goal) && (
            <MathText className="mt-1 text-sm font-bold leading-7 text-indigo-700">
              {goal}
            </MathText>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {!isEmpty(why) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-black text-amber-800">
              <Lightbulb size={16} />
              لماذا نفعل هذه الخطوة؟
            </div>
            <MathText className="whitespace-pre-line font-semibold leading-7 text-amber-950">
              {why}
            </MathText>
          </div>
        )}

        {!isEmpty(explanation) && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
            <MathText className="whitespace-pre-line font-semibold leading-8 text-slate-700">
              {explanation}
            </MathText>
          </div>
        )}

        {!isEmpty(formula) && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3.5">
            <div className="mb-2 text-xs font-black text-indigo-700">العلاقة المستعملة</div>
            <MathText className="whitespace-pre-line font-black leading-8 text-indigo-950">
              {formula}
            </MathText>
          </div>
        )}

        {!isEmpty(calculation) && (
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 px-4 py-3.5">
            <div className="mb-2 text-xs font-black text-cyan-800">التعويض والحساب</div>
            <MathText className="whitespace-pre-line font-bold leading-8 text-slate-800">
              {calculation}
            </MathText>
          </div>
        )}

        {!isEmpty(result) && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <div className="mb-2 flex items-center gap-2 text-xs font-black text-emerald-800">
              <CheckCircle2 size={16} />
              نتيجة هذه الخطوة
            </div>
            <MathText className="whitespace-pre-line font-black leading-8 text-emerald-950">
              {result}
            </MathText>
          </div>
        )}

        {!isEmpty(studentTip) && (
          <div className="flex items-start gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-violet-950">
            <Sparkles size={17} className="mt-1 shrink-0 text-violet-600" />
            <MathText className="whitespace-pre-line text-sm font-bold leading-7">
              {studentTip}
            </MathText>
          </div>
        )}

        {visuals.length > 0 && <BacVisualCollection items={visuals} />}
      </div>
    </article>
  );
}

function BacSolution({ solution }) {
  if (!solution || typeof solution !== "object") return null;

  const steps = Array.isArray(solution.steps)
    ? solution.steps.filter(Boolean)
    : [];

  const solutionVisuals = dedupeVisuals(
    Array.isArray(solution.figures) ? solution.figures : [],
    solution.graph_data ? [solution.graph_data] : [],
    solution.graph ? [solution.graph] : [],
  );

  const mistakes = Array.isArray(solution.common_mistakes)
    ? solution.common_mistakes.filter(Boolean)
    : [];

  const hints = Array.isArray(solution.hints)
    ? solution.hints.filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      {!isEmpty(solution.introduction) && (
        <InfoBox title="قبل أن نبدأ" tone="indigo" icon={Brain}>
          <MathText className="whitespace-pre-line font-bold leading-8">
            {solution.introduction}
          </MathText>
        </InfoBox>
      )}

      {!isEmpty(solution.strategy) && (
        <InfoBox title="خطة الحل" tone="indigo" icon={ListChecks}>
          <MathText className="whitespace-pre-line font-bold leading-8">
            {solution.strategy}
          </MathText>
        </InfoBox>
      )}

      {steps.length > 0 && (
        <div className="space-y-4">
          {steps.map((step, index) => (
            <BacSolutionStep
              key={step?.id || `bac-solution-step-${index}`}
              step={step}
              index={index}
            />
          ))}
        </div>
      )}

      {Array.isArray(solution.tables) && solution.tables.length > 0 && (
        <div className="space-y-5">
          {solution.tables.map((table, index) => (
            <BacDataTable
              key={table?.id || `bac-solution-table-${index}`}
              table={table}
              index={index}
            />
          ))}
        </div>
      )}

      {solutionVisuals.length > 0 && (
        <BacVisualCollection items={solutionVisuals} />
      )}

      {!isEmpty(solution.summary) && (
        <InfoBox title="ماذا نتذكر من هذا السؤال؟" tone="indigo" icon={Lightbulb}>
          <MathText className="whitespace-pre-line font-bold leading-8">
            {solution.summary}
          </MathText>
        </InfoBox>
      )}

      {!isEmpty(solution.final_answer) && (
        <InfoBox title="الجواب النهائي" tone="emerald" icon={CheckCircle2}>
          <MathText className="whitespace-pre-line font-black">
            {solution.final_answer}
          </MathText>
        </InfoBox>
      )}

      {!isEmpty(solution.source_correction_note) && (
        <InfoBox title="ملاحظة مراجعة المصدر" tone="amber" icon={AlertTriangle}>
          <MathText className="whitespace-pre-line font-bold">
            {solution.source_correction_note}
          </MathText>
        </InfoBox>
      )}

      {hints.length > 0 && (
        <InfoBox title="تلميحات" tone="amber" icon={Lightbulb}>
          <BulletList items={hints} tone="amber" icon={Lightbulb} />
        </InfoBox>
      )}

      {mistakes.length > 0 && (
        <InfoBox title="أخطاء شائعة" tone="rose" icon={AlertTriangle}>
          <BulletList items={mistakes} tone="rose" icon={XCircle} />
        </InfoBox>
      )}
    </div>
  );
}

function BacQuestionCard({ question, index }) {
  const [open, setOpen] = useState(false);

  const text =
    question?.text ||
    question?.question ||
    question?.statement ||
    "";

  const questionVisuals = dedupeVisuals(
    Array.isArray(question?.figures) ? question.figures : [],
    Array.isArray(question?.graphs) ? question.graphs : [],
    question?.graph_data ? [question.graph_data] : [],
    question?.graph ? [question.graph] : [],
  );

  return (
    <article className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_20px_55px_-38px_rgba(15,23,42,0.45)]">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 font-black text-white">
            {question?.display_order || index + 1}
          </span>

          <MathText className="whitespace-pre-line flex-1 text-[15px] font-black leading-8 text-slate-950 sm:text-base">
            {text}
          </MathText>
        </div>

        {questionVisuals.length > 0 && (
          <div className="mt-5">
            <BacVisualCollection items={questionVisuals} />
          </div>
        )}

        {question?.solution && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={cn(
              "mt-5 flex w-full items-center justify-between rounded-2xl px-5 py-3.5 font-black transition",
              open
                ? "bg-emerald-700 text-white"
                : "bg-slate-950 text-white hover:bg-indigo-700",
            )}
          >
            <span>{open ? "إخفاء الحل المفصل" : "إظهار الحل المفصل"}</span>
            {open ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
          </button>
        )}
      </div>

      {question?.solution && (
        <AnimatedCollapse open={open}>
          <div className="border-t border-emerald-100 bg-gradient-to-b from-emerald-50/50 to-white p-5 sm:p-6">
            <BacSolution solution={question.solution} />
          </div>
        </AnimatedCollapse>
      )}
    </article>
  );
}

function BacExerciseView({ exercise }) {
  const statementVisuals = dedupeVisuals(
    Array.isArray(exercise?.figures) ? exercise.figures : [],
    Array.isArray(exercise?.statement_graphs) ? exercise.statement_graphs : [],
    exercise?.graph_data ? [exercise.graph_data] : [],
    exercise?.graph ? [exercise.graph] : [],
  );

  const questions = Array.isArray(exercise?.questions)
    ? exercise.questions.filter(Boolean)
    : [];

  const branchName =
    exercise?.branch?.name ||
    (Array.isArray(exercise?.branches)
      ? exercise.branches.map((item) => item?.name).filter(Boolean).join(" + ")
      : "") ||
    "";

  return (
    <section
      dir="rtl"
      className="relative min-h-full w-full min-w-0 overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#eef2ff_0%,transparent_34%),linear-gradient(180deg,#fbfcff_0%,#f5f7ff_100%)] px-3 py-4 sm:px-5 lg:px-8"
    >
      <style>{`
        .MathJax { max-width: 100%; }
        mjx-container { max-width: 100%; direction: ltr !important; unicode-bidi: isolate; }
        mjx-container[display="true"] {
          overflow-x: auto !important;
          overflow-y: hidden !important;
          width: 100%;
          text-align: center !important;
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1220px] space-y-6">
        <header className="overflow-hidden rounded-[34px] border border-white bg-white shadow-[0_28px_80px_-45px_rgba(15,23,42,0.5)] ring-1 ring-indigo-100">
          <div className="bg-gradient-to-l from-slate-950 via-indigo-950 to-violet-800 px-5 py-7 text-white sm:px-8">
            <div className="flex flex-wrap gap-2 text-xs font-black">
              {exercise?.year && (
                <span className="rounded-full bg-white/10 px-3 py-1.5">
                  بكالوريا {exercise.year}
                </span>
              )}
              {exercise?.exercise_number !== undefined && (
                <span className="rounded-full bg-white/10 px-3 py-1.5">
                  التمرين {exercise.exercise_number}
                </span>
              )}
              {branchName && (
                <span className="rounded-full bg-indigo-400/20 px-3 py-1.5 text-indigo-100">
                  {branchName}
                </span>
              )}
              {exercise?.session && (
                <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-emerald-100">
                  {exercise.session === "ordinary"
                    ? "الدورة العادية"
                    : exercise.session === "exceptional"
                      ? "الدورة الاستثنائية"
                      : exercise.session === "partial"
                        ? "الدورة الجزئية"
                        : exercise.session}
                </span>
              )}
            </div>

            <MathText
              as="h1"
              className="mt-5 whitespace-pre-line text-2xl font-black leading-[1.55] text-white sm:text-3xl"
            >
              {exercise?.title || `تمرين بكالوريا ${exercise?.year || ""}`}
            </MathText>
          </div>

          {!isEmpty(exercise?.statement) && (
            <div className="p-5 sm:p-7">
              <div className="mb-3 flex items-center gap-2 text-indigo-700">
                <BookOpen size={20} />
                <h2 className="font-black">نص التمرين</h2>
              </div>

              <MathText className="whitespace-pre-line text-[15px] font-semibold leading-8 text-slate-800 sm:text-base">
                {exercise.statement}
              </MathText>
            </div>
          )}
        </header>

        {statementVisuals.length > 0 && (
          <section className="space-y-5">
            <BacVisualCollection items={statementVisuals} />
          </section>
        )}

        <BacTables exercise={exercise} />

        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks size={21} className="text-indigo-600" />
              <h2 className="text-xl font-black text-slate-950">الأسئلة</h2>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">
              {questions.length} أسئلة
            </span>
          </div>

          {questions.map((question, index) => (
            <BacQuestionCard
              key={question?.id || `bac-question-${index}`}
              question={question}
              index={index}
            />
          ))}
        </section>
      </div>
    </section>
  );
}


/* =========================================================
   Main component
========================================================= */


/* =========================================================
   Complete lesson information pages
========================================================= */

const TOP_LEVEL_PAGE_META = {
  graph: { title: "الرسم البياني العام", label: "الرسم", icon: Compass },
  lesson_summary: { title: "ملخص الدرس", label: "الملخص", icon: Trophy },
  dynamic_profile: { title: "الملف التعليمي", label: "نمط الدرس", icon: Brain },
  support_path: { title: "مسار الدعم", label: "الدعم", icon: CircleHelp },
  method_decision_tree: { title: "شجرة اختيار الطريقة", label: "شجرة القرار", icon: Route },
  lesson_closure: { title: "خاتمة الدرس", label: "الخاتمة", icon: Sparkles },
  quality_review: { title: "مراجعة جودة المحتوى", label: "الجودة", icon: CheckCircle2 },
  pedagogical_style: { title: "الأسلوب البيداغوجي", label: "الأسلوب", icon: GraduationCap },
  lesson_metadata: { title: "معلومات الدرس", label: "المعلومات", icon: ListChecks },
  concept_map: { title: "الخريطة المفاهيمية", label: "خريطة المفاهيم", icon: Route },
  adaptive_learning: { title: "مسارات التعلم التكيفية", label: "التعلم التكيفي", icon: Brain },
  retrieval_practice: { title: "المراجعة المتباعدة", label: "المراجعة", icon: RefreshCw },
  ux_specification: { title: "تجربة عرض الدرس", label: "تجربة التعلم", icon: Sparkles },
  success_definition: { title: "معايير النجاح", label: "النجاح", icon: Target },
  lesson_strategy: { title: "استراتيجية الدرس", label: "الاستراتيجية", icon: Compass },
  learning_experience_goal: { title: "هدف تجربة التعلم", label: "التجربة", icon: GraduationCap },
  bac_connection: { title: "الارتباط بالبكالوريا", label: "البكالوريا", icon: GraduationCap },
};

// حقول تُعرض داخل مقدمة الدرس أو تتحول إلى صفحات من نوع آخر، لذلك لا نكررها.
const CORE_LESSON_FIELDS = new Set([
  "learning_path",
  "final_assessment",
  "title",
  "axis_title",
  "axis_tag",
  "axis_id",
  "chapter_title",
  "chapter_code",
  "lesson_intro",
  "lesson_goal",
  "prerequisites",
  "learning_outcomes",
  "estimated_duration",
  "estimated_minutes",
  "difficulty",
  "language",
  "direction",
  "schema_version",
  "version",
  "content_status",
  "source_note",
  "re_explain_history",
  "re_explanations",
  "re_explanation_history",
]);

function getTopLevelPageMeta(sectionKey) {
  return (
    TOP_LEVEL_PAGE_META[sectionKey] || {
      title: fieldLabel(sectionKey),
      label: fieldLabel(sectionKey),
      icon: BookOpen,
    }
  );
}

function getGraphSvgMarkup(value) {
  if (!value || typeof value !== "object") return "";

  const candidate =
    value.svg ||
    value.raw_svg ||
    value.svg_markup ||
    value.svg_content ||
    "";

  if (typeof candidate !== "string") return "";

  const svg = candidate
    .trim()
    .replace(/^<\?xml[\s\S]*?\?>\s*/i, "");

  if (!/^<svg(?:\s|>)/i.test(svg)) return "";

  // تنظيف أساسي قبل الإدراج في DOM.
  // الرسومات تأتي من JSON الدرس، ومع ذلك نمنع السكربتات والأحداث والروابط الخطرة.
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s(?:href|xlink:href)\s*=\s*(["'])\s*(?:javascript:|data:text\/html)[\s\S]*?\1/gi,
      "",
    );
}

function isSvgGraph(value) {
  return Boolean(getGraphSvgMarkup(value));
}

function isEducationalDiagram(graph) {
  if (!graph || typeof graph !== "object") return false;

  const type = String(
    graph.diagram_type ||
      graph.graph_type ||
      graph.type ||
      graph.render_mode ||
      "",
  )
    .trim()
    .toLowerCase();

  // وجود SVG دون بيانات series يعني غالبًا أنه رسم دارة/مخطط تعليمي.
  return (
    type.includes("diagram") ||
    type.includes("circuit") ||
    type.includes("schematic") ||
    type.includes("force") ||
    type.includes("inline_step") ||
    (isSvgGraph(graph) && !normalizeGraph(graph))
  );
}

function SvgGraphRenderer({ graph }) {
  const svgMarkup = getGraphSvgMarkup(graph);
  if (!svgMarkup) return null;

  const educationalDiagram = isEducationalDiagram(graph);
  const visualLabel = educationalDiagram
    ? "الرسم التوضيحي"
    : "التمثيل البياني";

  const visualTitle =
    graph?.title ||
    graph?.graph_title ||
    (educationalDiagram ? "رسم مساعد للشرح" : "التمثيل البياني");

  return (
    <figure className="overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-sm">
      <figcaption className="border-b border-indigo-100 bg-gradient-to-l from-indigo-50/90 via-white to-violet-50/50 px-5 py-4 sm:px-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1 text-[11px] font-black text-indigo-700 shadow-sm">
          <Compass size={14} />
          {visualLabel}
        </div>

        <MathText
          as="h4"
          className="text-base font-black leading-8 text-slate-950 sm:text-lg"
        >
          {visualTitle}
        </MathText>

        {graph?.description && (
          <MathText className="mt-1 max-w-4xl text-sm font-semibold leading-7 text-slate-500">
            {graph.description}
          </MathText>
        )}
      </figcaption>

      <div
        dir="ltr"
        className={cn(
          "w-full bg-white p-3 sm:p-5",
          // أهم تعديل: رسومات الدرس تكون responsive بدون min-width إجباري.
          "[&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:w-full",
          "[&_svg]:max-w-[920px] [&_svg]:overflow-visible",
          "[&_svg_text]:select-none",
        )}
      >
        <div
          className="mx-auto w-full"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </div>
    </figure>
  );
}

function isRenderableSeriesGraph(value) {
  return Boolean(normalizeGraph(value));
}


function GraphSupplementalInfo({ graph }) {
  if (!graph || typeof graph !== "object") return null;

  const ignoredKeys = new Set([
    "id",
    "title",
    "graph_title",
    "description",
    "caption",
    "type",
    "kind",
    "diagram_type",
    "graph_type",
    "series",
    "data",
    "function",
    "curve",
    "parameter_lines",
    "lines",
    "coordinate_system",
    "coordinateSystem",
    "settings",
    "special_points",
    "annotations",
    "x_domain",
    "y_domain",
    "x_min",
    "x_max",
    "y_min",
    "y_max",
    "x_label",
    "y_label",
    "svg",
    "raw_svg",
    "svg_markup",
    "svg_content",
    "render_mode",
    "responsive",
  ]);

  const entries = Object.entries(graph).filter(
    ([key, value]) =>
      !ignoredKeys.has(key) &&
      !isEmpty(value) &&
      !looksLikeSvgMarkup(value) &&
      !isTechnicalPresentationField(key),
  );

  if (entries.length === 0) return null;

  return (
    <div className="grid gap-3 border-t border-indigo-100 bg-indigo-50/35 p-4 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="min-w-0 rounded-2xl border border-indigo-100 bg-white p-3.5"
        >
          <p className="mb-1.5 text-[11px] font-black text-indigo-700">
            {fieldLabel(key)}
          </p>
          <StructuredValue value={value} fieldKey={key} depth={1} />
        </div>
      ))}
    </div>
  );
}

function CompleteGraphValue({ value }) {
  if (!value || typeof value !== "object") return null;

  /*
   * إذا احتوى JSON على SVG جاهز، نعرضه أولًا.
   * هذا مهم لرسومات الدارات الكهربائية والمكثفات واتجاهات الأسهم.
   * سابقًا كان series graph يأخذ الأولوية، وهذا قد يحول بعض الرسومات
   * التعليمية إلى محور بياني فارغ أو غير مناسب.
   */
  if (isSvgGraph(value)) {
    return (
      <div className="overflow-hidden rounded-[28px]">
        <SvgGraphRenderer graph={value} />
        <GraphSupplementalInfo graph={value} />
      </div>
    );
  }

  // الرسوم العددية/المنحنيات المبنية من points أو series.
  if (isRenderableSeriesGraph(value)) {
    return (
      <div className="overflow-hidden rounded-[30px]">
        <GraphRenderer graph={value} />
        <GraphSupplementalInfo graph={value} />
      </div>
    );
  }

  return null;
}

function TopLevelLessonPage({ page }) {
  const meta = getTopLevelPageMeta(page?.sectionKey);
  const Icon = meta.icon;

  return (
    <article className="overflow-hidden rounded-[36px] border border-white/90 bg-white shadow-[0_28px_90px_-45px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70">
      <div className="relative overflow-hidden bg-gradient-to-l from-slate-950 via-indigo-950 to-violet-800 px-5 py-6 text-white sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/20 bg-white/15 shadow-lg backdrop-blur">
            <Icon size={23} />
          </div>
          <div>
            <p className="text-[11px] font-black tracking-[0.14em] text-white/70">{meta.label}</p>
            <h2 className="mt-1 text-xl font-black leading-8 sm:text-[28px]">{meta.title}</h2>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-white to-slate-50/50 p-5 sm:p-8">
        {page.sectionKey === "graph" ? (
          <div className="space-y-5">
            <CompleteGraphValue value={page.content} />
            {!isRenderableSeriesGraph(page.content) && !isSvgGraph(page.content) && (
              <StructuredValue value={page.content} fieldKey={page.sectionKey} depth={0} />
            )}
          </div>
        ) : (
          <StructuredValue value={page.content} fieldKey={page.sectionKey} depth={0} />
        )}
      </div>
    </article>
  );
}

function buildLessonMetadata(lesson) {
  const metadata = {
    source_note: lesson?.source_note,
    version: lesson?.version,
    schema_version: lesson?.schema_version,
    language: lesson?.language,
    direction: lesson?.direction,
    chapter_code: lesson?.chapter_code,
    chapter_title: lesson?.chapter_title,
    axis_tag: lesson?.axis_tag,
    axis_title: lesson?.axis_title,
    estimated_minutes: lesson?.estimated_minutes,
    difficulty: lesson?.difficulty,
    content_status: lesson?.content_status,
    math_format: lesson?.math_format,
  };

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => !isEmpty(value)),
  );
}

/* =========================================================
   Card pages
========================================================= */

function CourseIntroCard({ lesson, title }) {
  const learningOutcomes = useMemo(
    () => uniqueLimitedItems(lesson?.learning_outcomes, 100),
    [lesson?.learning_outcomes],
  );

  const prerequisites = useMemo(
    () => uniqueLimitedItems(lesson?.prerequisites, 100),
    [lesson?.prerequisites],
  );

  const hasIntroContent =
    Boolean(lesson?.lesson_intro) ||
    prerequisites.length > 0 ||
    learningOutcomes.length > 0;

  return (
    <article className="overflow-hidden rounded-[38px] border border-white/90 bg-white shadow-[0_32px_100px_-48px_rgba(15,23,42,0.5)] ring-1 ring-slate-200/70">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#1e1b4b_52%,#3730a3_100%)] px-6 py-9 text-white sm:px-10 sm:py-11">
        <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-20 right-8 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black">
              <Sparkles size={15} />
              بداية الدرس
            </span>

            {lesson?.difficulty && (
              <span className="rounded-full bg-emerald-400/15 px-4 py-2 text-xs font-black text-emerald-200">
                المستوى: {lesson.difficulty}
              </span>
            )}

            {(lesson?.estimated_duration || lesson?.estimated_minutes) && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/80">
                <Clock3 size={15} />
                {lesson.estimated_duration || `${lesson.estimated_minutes} دقيقة`}
              </span>
            )}
          </div>

          <h1 className="mt-7 max-w-4xl text-3xl font-black leading-[1.5] sm:text-4xl lg:text-[44px]">
            {title}
          </h1>

          {lesson?.lesson_goal && (
            <div className="mt-7 flex max-w-4xl items-start gap-3 rounded-[26px] border border-white/15 bg-white/10 p-5 shadow-inner backdrop-blur sm:p-6">
              <Target className="mt-1 shrink-0 text-amber-300" size={22} />
              <div className="min-w-0">
                <p className="mb-1 text-xs font-black text-white/60">الهدف العام</p>
                <MathText className="font-bold text-slate-100">
                  {lesson.lesson_goal}
                </MathText>
              </div>
            </div>
          )}
        </div>
      </div>

      {hasIntroContent && (
        <div className="grid gap-6 bg-gradient-to-b from-white to-slate-50/60 p-5 sm:p-8 lg:grid-cols-2">
          {lesson?.lesson_intro && (
            <div className="rounded-[30px] border border-violet-100 bg-gradient-to-l from-violet-50 via-white to-indigo-50 p-5 shadow-sm sm:p-6 lg:col-span-2">
              <div className="mb-4 flex items-center gap-2 font-black text-violet-900">
                <Sparkles size={20} />
                فكرة الدرس
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    key: "welcome",
                    title: "مقدمة المحور",
                    value: lesson.lesson_intro?.welcome,
                    icon: Sparkles,
                  },
                  {
                    key: "big_idea",
                    title: "الفكرة الأساسية",
                    value: lesson.lesson_intro?.big_idea,
                    icon: Brain,
                  },
                  {
                    key: "student_promise",
                    title: "ماذا ستتعلم؟",
                    value: lesson.lesson_intro?.student_promise,
                    icon: Target,
                  },
                ]
                  .filter((item) => !isEmpty(item.value))
                  .map(({ key, title: itemTitle, value, icon: ItemIcon }) => (
                    <div
                      key={key}
                      className="rounded-[24px] border border-violet-100 bg-white/80 p-5 shadow-sm"
                    >
                      <div className="mb-3 flex items-center gap-2 text-violet-800">
                        <ItemIcon size={18} />
                        <h3 className="font-black">{itemTitle}</h3>
                      </div>
                      <MathText className="text-sm font-semibold text-slate-700">
                        {value}
                      </MathText>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {prerequisites.length > 0 && (
            <div className="rounded-[30px] border border-amber-100 bg-gradient-to-b from-amber-50 to-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2 font-black text-amber-900">
                <Brain size={20} />
                {lesson?.prerequisites_title || "المكتسبات القبلية"}
              </div>
              <BulletList
                items={prerequisites}
                tone="amber"
                icon={CheckCircle2}
              />
            </div>
          )}

          {learningOutcomes.length > 0 && (
            <div className="rounded-[30px] border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-black text-emerald-900">
                  <Target size={20} />
                  أهداف الدرس
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                  {learningOutcomes.length} أهداف
                </span>
              </div>
              <BulletList
                items={learningOutcomes}
                tone="emerald"
                icon={CheckCircle2}
              />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function EmptyLessonCard() {
  return (
    <div className="rounded-[38px] border border-slate-200/80 bg-white p-10 text-center shadow-xl shadow-slate-950/5">
      <BookOpen size={44} className="mx-auto text-slate-400" />
      <h2 className="mt-4 text-xl font-black text-slate-900">
        لا توجد مراحل شرح
      </h2>
      <p className="mt-2 text-slate-500">
        تأكد من وجود learning_path داخل data.axis.content.
      </p>
    </div>
  );
}


/* =========================================================
   Main component
========================================================= */


const INTRO_VISIBLE_FIELDS = new Set([
  "lesson_intro",
  "lesson_goal",
  "prerequisites",
  "prerequisites_title",
  "learning_outcomes",
  "estimated_duration",
  "estimated_minutes",
  "difficulty",
  "title",
  "axis_title",
  "chapter_title",
]);

const LESSON_METADATA_FIELDS = new Set([
  "schema_version",
  "version",
  "language",
  "direction",
  "math_format",
  "chapter_code",
  "chapter_title",
  "axis_tag",
  "axis_title",
  "axis_id",
  "estimated_duration",
  "estimated_minutes",
  "difficulty",
  "content_status",
  "source_note",
]);

function buildCompleteLessonMetadata(data, lesson, axis) {
  const rootSource =
    data && typeof data === "object" && !Array.isArray(data)
      ? data
      : {};

  const rawAxis =
    rootSource?.axis && typeof rootSource.axis === "object"
      ? rootSource.axis
      : {};

  const rootMetadata = Object.fromEntries(
    Object.entries(rootSource).filter(
      ([key, value]) =>
        ![
          "content",
          "axis",
          "lesson",
          "answer",
          "learning_path",
          "final_assessment",
          "success",
          "error",
          "errors",
          "message",
          "detail",
          "re_explain_history",
          "re_explanations",
          "re_explanation_history",
          "explanation_history",
          "history",
        ].includes(key) &&
        !isEmpty(value),
    ),
  );

  const axisMetadata = Object.fromEntries(
    Object.entries(rawAxis || {}).filter(
      ([key, value]) =>
        key !== "content" &&
        !isEmpty(value) &&
        ![
          "re_explain_history",
          "re_explanations",
          "re_explanation_history",
        ].includes(key),
    ),
  );

  // عندما تكون البيانات JSON مباشرة وليست داخل data.axis،
  // نضيف خصائص المحور العليا (tag/title/order/branches...) أيضًا.
  const directAxisMetadata =
    !rootSource?.axis && rootSource?.content
      ? Object.fromEntries(
          Object.entries(rootSource).filter(
            ([key, value]) =>
              key !== "content" &&
              !isEmpty(value),
          ),
        )
      : {};

  const lessonMetadata = Object.fromEntries(
    Object.entries(lesson || {}).filter(
      ([key, value]) =>
        LESSON_METADATA_FIELDS.has(key) &&
        !isEmpty(value),
    ),
  );

  const result = {};

  const mergedAxisMetadata = {
    ...directAxisMetadata,
    ...rootMetadata,
    ...axisMetadata,
  };

  if (Object.keys(mergedAxisMetadata).length > 0) {
    result["بيانات المحور"] = mergedAxisMetadata;
  }

  if (Object.keys(lessonMetadata).length > 0) {
    result["بيانات الدرس"] = lessonMetadata;
  }

  if (axis && typeof axis === "object") {
    const normalizedAxisMetadata = Object.fromEntries(
      Object.entries(axis).filter(
        ([key, value]) =>
          key !== "content" &&
          !isEmpty(value),
      ),
    );

    if (
      Object.keys(normalizedAxisMetadata).length > 0 &&
      !result["بيانات المحور"]
    ) {
      result["بيانات المحور"] = normalizedAxisMetadata;
    }
  }

  return result;
}

function buildAdditionalLessonPages(data, lesson, axis) {
  if (!lesson || typeof lesson !== "object") return [];

  const excluded = new Set([
    "learning_path",
    "final_assessment",
    "lesson_intro",
    "lesson_goal",
    "prerequisites",
    "prerequisites_title",
    "learning_outcomes",
    "estimated_duration",
    "estimated_minutes",
    "difficulty",
    "title",
    "axis_title",
    "axis_tag",
    "axis_id",
    "chapter_title",
    "chapter_code",
    "language",
    "direction",
    "schema_version",
    "version",
    "math_format",
    "content_status",
    "source_note",
    "re_explain_history",
    "re_explanations",
    "re_explanation_history",
  ]);

  const pages = Object.entries(lesson)
    .filter(
      ([key, value]) =>
        !excluded.has(key) &&
        !isEmpty(value) &&
        !isTechnicalPresentationField(key) &&
        !looksLikeSvgMarkup(value),
    )
    .map(([sectionKey, content], index) => {
      const meta = getTopLevelPageMeta(sectionKey);
      return {
        id: `top-level-${sectionKey}-${index}`,
        type: "top_level_section",
        pageRole: "top_level_section",
        sectionKey,
        title: meta.title || fieldLabel(sectionKey) || "معلومات إضافية",
        label: meta.label || "معلومات",
        icon: meta.icon || BookOpen,
        content,
      };
    });

  const metadata = buildCompleteLessonMetadata(data, lesson, axis);

  if (Object.keys(metadata).length > 0) {
    pages.push({
      id: "lesson-all-metadata",
      type: "top_level_section",
      pageRole: "top_level_section",
      sectionKey: "lesson_metadata",
      title: "معلومات الدرس والبيانات",
      label: "المعلومات",
      icon: ListChecks,
      content: metadata,
    });
  }

  return pages;
}

function LessonCourseAnswer({
  data,
  axisId,
  onReExplain
}) {
  const COURSE_URL = import.meta.env.VITE_COURSE_URL;

  const reExplainEndpoint = `${COURSE_URL}axes/re-explication/`;


  const lesson = useMemo(() => normalizeLesson(data), [data]);
  const axis = useMemo(() => normalizeAxis(data, lesson), [data, lesson]);

  const resolvedAxisId = useMemo(
    () =>
      axisId ??
      data?.axis_id ??
      data?.axis?.id ??
      axis?.id ??
      lesson?.axis_id ??
      null,
    [axisId, data, axis, lesson],
  );

  const reExplanationHistorySource = useMemo(
    () =>
      data?.re_explain_history ??
      data?.re_explanations ??
      data?.re_explanation_history ??
      data?.explanation_history ??
      data?.history ??
      data?.axis?.re_explain_history ??
      data?.axis?.re_explanations ??
      data?.axis?.re_explanation_history ??
      lesson?.re_explain_history ??
      lesson?.re_explanations ??
      lesson?.re_explanation_history ??
      data?.axis?.content?.re_explain_history ??
      lesson?.content?.re_explain_history ??
      [],
    [data, lesson],
  );

  const [currentPage, setCurrentPage] = useState(0);

  const graphRegistry = useMemo(
    () => buildLessonGraphRegistry(lesson),
    [lesson],
  );

  const learningPath = useMemo(
    () =>
      Array.isArray(lesson?.learning_path)
        ? lesson.learning_path
            .filter(Boolean)
            .map((step) => resolveStepGraphReference(step, graphRegistry))
        : [],
    [lesson, graphRegistry],
  );

  const pages = useMemo(() => {
    if (!lesson) return [];

    /*
     * قاعدة العرض النهائية:
     * - نعرض فقط العناصر الموجودة فعليًا داخل lesson.learning_path.
     * - لا ننشئ صفحات من lesson_intro أو lesson_goal أو metadata أو أي حقل علوي آخر.
     * - لا نضيف final_assessment من خارج learning_path.
     * - إذا كان final_assessment موجودًا داخل learning_path فسيظهر طبيعيًا كأي مرحلة أخرى.
     *
     * بهذه القاعدة يصبح عدد البطاقات في الواجهة مطابقًا 100% لعدد مراحل learning_path.
     */
    return learningPath.map((step, index) => ({
      ...step,
      id: step?.id || `step-${index + 1}`,
      label:
        STEP_META[step?.type]?.label ||
        fieldLabel(step?.type) ||
        `المرحلة ${index + 1}`,
      icon: STEP_META[step?.type]?.icon || BookOpen,
    }));
  }, [lesson, learningPath]);

  if (!lesson) return null;

  if (data?.success === false) {
    return (
      <div dir="rtl" className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-8 text-center">
          <AlertTriangle size={42} className="mx-auto text-rose-500" />
          <h2 className="mt-4 text-2xl font-black text-rose-950">
            تعذر عرض الدرس
          </h2>
          <p className="mt-2 leading-8 text-rose-700">
            تحقق من بنية البيانات المرجعة من الخادم.
          </p>
        </div>
      </div>
    );
  }

  const title =
    data?.title ||
    lesson?.axis_title ||
    lesson?.title ||
    axis?.title ||
    data?.axis?.title ||
    "شرح الدرس";

  const chapterTitle =
    lesson?.chapter_title ||
    lesson?.chapter?.title ||
    data?.content?.chapter_title ||
    data?.axis?.content?.chapter_title ||
    data?.axis?.chapter_title ||
    data?.chapter_title ||
    "دراسة الدوال";

  const safePage = Math.min(currentPage, Math.max(pages.length - 1, 0));
  const activePage = pages[safePage];
  const progress =
    pages.length > 0 ? Math.round(((safePage + 1) / pages.length) * 100) : 0;

  function goToPage(index) {
    if (index < 0 || index >= pages.length) return;
    setCurrentPage(index);
    window.requestAnimationFrame(() => {
      document
        .getElementById("course-card-top")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function goPrevious() {
    goToPage(safePage - 1);
  }

  function goNext() {
    goToPage(safePage + 1);
  }

  return (
    <section
      dir="rtl"
      className="relative min-h-full w-full min-w-0 overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#eef2ff_0%,transparent_34%),radial-gradient(circle_at_bottom_left,#fae8ff_0%,transparent_28%),linear-gradient(180deg,#fbfcff_0%,#f6f7fc_48%,#eef2ff_100%)] px-2 py-3 min-[360px]:px-3 min-[360px]:py-4 sm:px-5 sm:py-5 lg:px-8"
    >

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.995);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .MathJax {
          max-width: 100%;
        }

        mjx-container {
          max-width: 100%;
          overflow: visible !important;
          padding-block: 0.08rem;
          direction: ltr !important;
          text-align: inherit;
          unicode-bidi: isolate;
          vertical-align: middle;
        }

        mjx-container:not([display="true"]) {
          display: inline-block !important;
          width: auto !important;
          min-width: 0 !important;
          margin-inline: 0.18rem !important;
        }

        mjx-container[display="true"] {
          display: block !important;
          width: 100%;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          margin: 0.55rem 0 !important;
          padding-block: 0.25rem;
          text-align: center !important;
        }

        .unicode-bidi-plaintext {
          unicode-bidi: plaintext;
        }

        #course-card-top,
        #course-card-top * {
          min-width: 0;
        }

        img,
        video,
        canvas {
          max-width: 100%;
          height: auto;
        }

        svg {
          max-width: 100%;
        }

        table {
          max-width: 100%;
        }

        button,
        a {
          -webkit-tap-highlight-color: transparent;
        }

        @media (max-width: 359px) {
          mjx-container {
            font-size: 88% !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />
        <div className="absolute -left-20 top-1/3 h-80 w-80 rounded-full bg-fuchsia-300/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-cyan-300/15 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full min-w-0 max-w-[1220px]">
        <header
          id="course-card-top"
          className="relative mb-4 min-w-0 overflow-hidden rounded-[22px] border border-white/90 bg-white/90 p-3 shadow-[0_20px_70px_-42px_rgba(15,23,42,0.42)] ring-1 ring-indigo-100/60 backdrop-blur-xl min-[360px]:p-4 sm:mb-6 sm:rounded-[30px] sm:p-6 lg:mb-7 lg:rounded-[36px] lg:p-7"
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-l from-indigo-600 via-violet-500 to-fuchsia-500" />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 ring-1 ring-indigo-100">
                  <GraduationCap size={15} />
                  {chapterTitle}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-black text-white shadow-lg shadow-indigo-500/20">
                  <BookOpen size={14} />
                  أكاديمية التميز
                </span>
              </div>

              <h1 className="mt-3 max-w-4xl break-words text-xl font-black leading-[1.55] text-slate-950 min-[360px]:text-2xl sm:mt-4 sm:text-3xl lg:text-[38px]">
                {title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-black text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Route size={15} className="text-indigo-600" />
                  البطاقة {safePage + 1} من {pages.length}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={15} className="text-fuchsia-500" />
                  {activePage?.label || "شرح"}
                </span>
              </div>
            </div>

            <div className="flex w-full min-w-0 items-center gap-3 rounded-[22px] border border-indigo-100 bg-gradient-to-l from-indigo-50/80 to-white p-3 shadow-sm sm:w-auto sm:gap-4 sm:rounded-[30px] sm:p-4">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white shadow-[inset_0_2px_10px_rgba(99,102,241,0.08),0_10px_25px_-15px_rgba(79,70,229,0.55)] ring-1 ring-indigo-100 min-[360px]:h-20 min-[360px]:w-20">
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100" />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                    className="text-indigo-600 transition-all duration-500"
                  />
                </svg>
                <span className="relative text-lg font-black text-slate-950">{progress}%</span>
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black text-slate-400">تقدمك في الدرس</p>
                <p className="mt-1 text-base font-black text-slate-950">{activePage?.title}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">تابع خطوة بخطوة بدون تمرير طويل</p>
              </div>
            </div>
          </div>

          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
            <div
              className="h-full rounded-full bg-gradient-to-l from-indigo-600 via-violet-600 to-fuchsia-500 shadow-[0_0_18px_rgba(99,102,241,0.45)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        <main className="min-w-0">
          <div className="relative">
            <div className="pointer-events-none absolute -inset-3 rounded-[42px] bg-gradient-to-l from-indigo-200/35 via-transparent to-fuchsia-200/35 blur-2xl" />

            <div key={activePage?.id || safePage} className="relative min-h-[360px] min-w-0 animate-[fadeIn_.35s_ease-out] sm:min-h-[500px] lg:min-h-[620px]">
              {pages.length === 0 ? (
                <EmptyLessonCard />
              ) : activePage?.type === "lesson_intro" ? (
                <CourseIntroCard
                  lesson={lesson}
                  title={title}
                />
              ) : activePage?.pageRole === "top_level_section" ? (
                <TopLevelLessonPage page={activePage} />
              ) : activePage?.pageRole === "standalone_final_assessment" ? (
                <FinalAssessment
                  assessment={
                    activePage?.content ||
                    lesson.final_assessment
                  }
                />
              ) : (
                <LessonStepCard
                  step={activePage}
                  index={Math.max(safePage - 1, 0)}
                  total={learningPath.length}
                  lessonTitle={title}
                  axis={axis}
                  axisId={resolvedAxisId}
                  initialHistory={[
                    ...(Array.isArray(activePage?.re_explanations)
                      ? activePage.re_explanations
                      : []),
                    ...getStepHistory(
                      reExplanationHistorySource,
                      activePage?.id,
                    ).map((item) => item.raw || item),
                  ]}
                  onReExplain={onReExplain}
                  reExplainEndpoint={reExplainEndpoint}
                />
              )}
            </div>
          </div>

          {pages.length > 0 && (
            <div className="sticky bottom-2 z-20 mt-5 min-w-0 rounded-[20px] border border-white/90 bg-white/95 p-2 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.5)] ring-1 ring-indigo-100/70 backdrop-blur-xl sm:bottom-3 sm:mt-7 sm:rounded-[28px] sm:p-4 lg:rounded-[32px]">
              <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
                <button
                  type="button"
                  onClick={goPrevious}
                  disabled={safePage === 0}
                  className={cn(
                    "group inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-black transition-all duration-300 min-[360px]:px-3 sm:min-h-14 sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-base",
                    safePage === 0
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-slate-950 text-white shadow-lg shadow-slate-950/15 hover:-translate-y-0.5 hover:bg-indigo-700",
                  )}
                >
                  <ArrowRight size={20} className="transition group-hover:translate-x-1" />
                  <span>السابق</span>
                </button>

                <div className="order-first col-span-2 min-w-0 px-1 text-center sm:order-none sm:col-span-1 sm:px-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">المرحلة الحالية</p>
                  <p className="mx-auto mt-1 max-w-[240px] truncate text-xs font-black text-slate-950 min-[360px]:text-sm sm:max-w-[320px] sm:text-base">
                    {activePage?.title}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={safePage === pages.length - 1}
                  className={cn(
                    "group inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-black transition-all duration-300 min-[360px]:px-3 sm:min-h-14 sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-base",
                    safePage === pages.length - 1
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-gradient-to-l from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 hover:shadow-xl",
                  )}
                >
                  <span>التالي</span>
                  <ArrowLeft size={20} className="transition group-hover:-translate-x-1" />
                </button>
              </div>

              <div className="mt-3 flex min-w-0 items-center justify-start gap-2 overflow-x-auto px-1 pb-1 sm:mt-4 sm:justify-center sm:px-2">
                {pages.map((page, index) => {
                  const Icon = page.icon || BookOpen;
                  const active = safePage === index;

                  return (
                    <button
                      key={page.id || index}
                      type="button"
                      onClick={() => goToPage(index)}
                      aria-label={`الانتقال إلى البطاقة ${index + 1}`}
                      title={page.title}
                      className={cn(
                        "flex h-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-300",
                        active
                          ? "w-12 border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
                          : "w-9 border-slate-200 bg-white text-slate-400 hover:border-indigo-200 hover:text-indigo-600",
                      )}
                    >
                      <Icon size={15} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );  
}

export default function IntroStep(props) {
  const exercise = normalizeBacExercise(props?.data);

  if (exercise) {
    return <BacExerciseView exercise={exercise} />;
  }

  return <LessonCourseAnswer {...props} />;
}

