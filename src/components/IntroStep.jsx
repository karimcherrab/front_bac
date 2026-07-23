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
    title: lesson?.axis_title || lesson?.title,
    tag: lesson?.axis_tag,
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
      .replace(/\\\\(frac|dfrac|tfrac|sqrt|ln|log|exp|times|cdot|div|geq?|leq?|neq|in|notin|mathbb|mathrm|text|left|right|begin|end|boxed|overline|underline|sum|prod|lim|infty|ldots|cdots|quad|qquad)/g, "\\$1");

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

function normalizeMathText(value) {
  let text = decodeLatexEscapes(value);
  if (!text) return "";

  text = text
    .replace(/\$\$([\s\S]*?)\$\$/g, "\\[$1\\]")
    .replace(/\$([^$\n]+?)\$/g, "\\($1\\)");

  return wrapBareMathExpressions(text);
}

function getPureMathExpression(value) {
  let text = decodeLatexEscapes(value).trim();

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

  return text;
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
      {open && <div className="border-t border-current/10 bg-white/35 p-5">{children}</div>}
    </div>
  );
}

function InfoBox({ icon: Icon = Lightbulb, title, children, tone = "indigo" }) {
  const tones = {
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    sky: "border-sky-200 bg-sky-50 text-sky-950",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  };

  return (
    <div className={cn("rounded-[22px] border p-5 shadow-sm ring-1 ring-white/60", tones[tone])}>
      <div className="flex items-start gap-3.5">
        <Icon size={19} className="mt-1 shrink-0 rounded-lg bg-white/70 p-1 shadow-sm" />
        <div className="min-w-0 flex-1">
          {title && <h4 className="mb-1.5 text-[15px] font-black">{title}</h4>}
          {children}
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
      item.hint ||
      item.instruction ||
      item.question ||
      item.answer ||
      item.result ||
      item.meaning ||
      item.statement ||
      item.title ||
      item.label ||
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

function MotivationStep({ content }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <InfoBox title="هدف هذه البداية" tone="amber" icon={Target}>
        <MathText className="font-bold">{content.goal}</MathText>
      </InfoBox>

      <div className="rounded-[28px] bg-gradient-to-l from-amber-400 via-orange-500 to-rose-500 p-[1px] shadow-xl shadow-orange-500/10">
        <div className="rounded-[27px] bg-white p-5 sm:p-7">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 font-black text-orange-700">
            <Sparkles size={19} />
            الأستاذ يشرح
          </div>
          <MathText className="text-base font-semibold text-slate-700">
            {content.teacher}
          </MathText>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(content.real_life_examples || []).map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
          >
            <Zap className="mt-1 shrink-0 text-amber-600" size={17} />
            <MathText className="text-sm font-bold text-amber-950">{item}</MathText>
          </div>
        ))}
      </div>

      <InfoBox title="علاقتها بالبكالوريا" tone="indigo" icon={GraduationCap}>
        <MathText>{content.bac_relevance}</MathText>
      </InfoBox>
    </div>
  );
}

function ObservationStep({ content }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <MathText className="text-slate-700">{content.situation}</MathText>

      {Array.isArray(content.table) && content.table.length > 0 && (
        <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-center text-sm">
              <thead className="bg-gradient-to-l from-slate-950 to-indigo-950 text-white">
                <tr>
                  <th className="px-4 py-4 text-sm font-black">الدليل</th>
                  <th className="px-4 py-4 text-sm font-black">الحد</th>
                  <th className="px-4 py-4 text-sm font-black">الترميز</th>
                </tr>
              </thead>
              <tbody>
                {content.table.map((row, index) => (
                  <tr key={index} className="border-t border-slate-200 even:bg-slate-50">
                    <td className="px-4 py-4 font-black text-indigo-700">{row.index}</td>
                    <td className="px-4 py-4 font-black text-slate-800">{row.term}</td>
                    <td className="px-4 py-4">
                      <MathText className="font-bold text-slate-800">{row.notation}</MathText>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {Array.isArray(content.examples) && content.examples.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {content.examples.map((item, index) => (
            <div key={index} className="rounded-[24px] border border-sky-100 bg-gradient-to-b from-sky-50 to-white p-5 shadow-sm">
              <MathPanel>{item.sequence}</MathPanel>
              <MathText className="mt-4 text-sm font-semibold text-slate-600">{item.observation}</MathText>
              <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-center font-black text-emerald-800">
                {item.conclusion}
              </div>
            </div>
          ))}
        </div>
      )}

      {(content.question || content.expected_answer) && (
        <RevealBox label={content.question || "فكّر ثم أظهر الجواب"} tone="indigo">
          <MathText className="font-black">{content.expected_answer}</MathText>
        </RevealBox>
      )}

      <InfoBox title="ما الذي اكتشفناه؟" tone="emerald" icon={Lightbulb}>
        <MathText className="font-bold">{content.discovery}</MathText>
      </InfoBox>
    </div>
  );
}

function GuidedExplanationStep({ content }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <MathText className="text-slate-700">{content.teacher}</MathText>

      {content.mapping && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["المدخل", content.mapping.input, Hash],
            ["القاعدة", content.mapping.rule, Brain],
            ["المخرج", content.mapping.output, CheckCircle2],
          ].map(([label, value, Icon]) => (
            <div key={label} className="group rounded-[26px] border border-indigo-100 bg-gradient-to-b from-indigo-50 to-white p-5 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg">
              <Icon className="mx-auto rounded-2xl bg-indigo-600 p-2 text-white shadow-lg shadow-indigo-500/20" size={24} />
              <p className="mt-3 text-xs font-black text-indigo-500">{label}</p>
              <MathText className="mt-1 font-black text-indigo-950">{value}</MathText>
            </div>
          ))}
        </div>
      )}

      {content.notation && <MathPanel>{content.notation}</MathPanel>}

      <InfoBox title="المعنى البسيط" tone="sky" icon={Lightbulb}>
        <MathText className="font-bold">{content.simple_meaning}</MathText>
      </InfoBox>

      <InfoBox title="التعريف الرياضي" tone="indigo" icon={BookOpen}>
        <MathText className="font-semibold">{content.formal_statement}</MathText>
      </InfoBox>

      {content.checkpoint_question && (
        <RevealBox label={content.checkpoint_question} tone="emerald">
          <MathText className="font-black">{content.checkpoint_answer}</MathText>
        </RevealBox>
      )}
    </div>
  );
}

function NotationStep({ content }) {
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

      <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb}>
        <MathText className="font-bold">{content.memory_tip}</MathText>
      </InfoBox>
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

function MethodsOverviewStep({ content }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <MathText className="text-slate-700">{content.teacher}</MathText>

      <div className="grid gap-5 lg:grid-cols-2">
        {(content.methods || []).map((method, index) => (
          <div
            key={index}
            className={cn(
              "rounded-[28px] border p-5",
              index === 0
                ? "border-indigo-200 bg-indigo-50"
                : "border-emerald-200 bg-emerald-50",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black shadow-sm">
                الطريقة {index + 1}
              </span>
              {index === 0 ? <Zap size={21} /> : <Route size={21} />}
            </div>
            <h3 className="mt-4 text-lg font-black text-slate-950">{method.name}</h3>
            <MathText className="mt-3 text-slate-700">{method.idea}</MathText>
            <div className="mt-4">
              <BulletList items={method.needs} tone={index === 0 ? "indigo" : "emerald"} />
            </div>
            <InfoBox title="الميزة" tone={index === 0 ? "indigo" : "emerald"} icon={Trophy}>
              <MathText className="text-sm font-bold">{method.advantage}</MathText>
            </InfoBox>
          </div>
        ))}
      </div>

      <InfoBox title="ملاحظة مهمة" tone="rose" icon={AlertTriangle}>
        <MathText className="font-bold">{content.important_note}</MathText>
      </InfoBox>
    </div>
  );
}

function MethodTimeline({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="relative space-y-4">
      <div className="pointer-events-none absolute bottom-8 right-5 top-8 hidden w-px bg-gradient-to-b from-indigo-200 via-violet-300 to-transparent sm:block" />

      {items.map((item, index) => {
        const stepNumber = item?.step_number ?? index + 1;
        const instruction =
          item?.instruction ||
          item?.text ||
          item?.title ||
          item?.step ||
          "";
        const why =
          item?.why ||
          item?.reason ||
          item?.explanation ||
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
  if (!example) return null;

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_22px_55px_-32px_rgba(15,23,42,0.42)]">
      <div className={cn("p-5 text-white", tone === "emerald" ? "bg-emerald-600" : "bg-indigo-600")}>
        <div className="flex items-center gap-2 font-black">
          <GraduationCap size={20} />
          مثال محلول خطوة بخطوة
        </div>
        <MathText className="mt-3 font-semibold text-white">{example.statement}</MathText>
      </div>
      <div className="space-y-4 bg-gradient-to-b from-white to-slate-50/60 p-5 sm:p-6">
        {(example.steps || []).map((item, index) => (
          <div key={index} className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-sm">
            {item.title && <h4 className="mb-2 font-black text-slate-900">{item.title}</h4>}
            <MathText className="text-sm text-slate-600">{item.explanation}</MathText>
            {item.calculation && <div className="mt-3"><MathPanel>{item.calculation}</MathPanel></div>}
          </div>
        ))}
        {example.conclusion && (
          <InfoBox title="النتيجة" tone="emerald" icon={CheckCircle2}>
            <MathText className="font-black">{example.conclusion}</MathText>
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

function ComparisonStep({ content }) {
  return (
    <div className="space-y-6">
      <BulletList items={content.decision_rule} tone="indigo" icon={Compass} />

      {Array.isArray(content.comparison_table) && (
        <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right">
              <thead className="bg-gradient-to-l from-slate-950 to-indigo-950 text-white">
                <tr>
                  <th className="px-5 py-4 text-sm font-black">المعيار</th>
                  <th className="px-5 py-4 text-sm font-black">الحد العام</th>
                  <th className="px-5 py-4 text-sm font-black">العلاقة التراجعية</th>
                </tr>
              </thead>
              <tbody>
                {content.comparison_table.map((row, index) => (
                  <tr key={index} className="border-t border-slate-200 even:bg-slate-50">
                    <td className="px-5 py-4 font-black text-slate-900">{row.criterion}</td>
                    <td className="px-5 py-4"><MathText className="text-sm text-indigo-800">{row.explicit}</MathText></td>
                    <td className="px-5 py-4"><MathText className="text-sm text-emerald-800">{row.recursive}</MathText></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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

function CommonMistakesStep({ content }) {
  return (
    <div className="space-y-4">
      {(content.mistakes || []).map((mistake, index) => (
        <div key={index} className="overflow-hidden rounded-3xl border border-rose-200 bg-white">
          <div className="flex items-start gap-3 bg-rose-50 p-4">
            <XCircle className="mt-1 shrink-0 text-rose-600" size={20} />
            <MathText className="font-black text-rose-950">{mistake.wrong_idea || mistake.wrong || mistake.mistake}</MathText>
          </div>
          <div className="space-y-3 p-4">
            <MathText className="text-sm text-slate-600">لماذا هو خطأ؟ {mistake.why_wrong || mistake.reason}</MathText>
            <InfoBox title="التصحيح الصحيح" tone="emerald" icon={Check}>
              <MathText className="text-sm font-bold">{mistake.correction || mistake.correct}</MathText>
            </InfoBox>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniQuizStep({ content }) {
  const [answers, setAnswers] = useState({});
  const [showHint, setShowHint] = useState({});

  return (
    <div className="space-y-5 sm:space-y-6">
      {(content.questions || []).map((question, questionIndex) => {
        const selected = answers[question.id || questionIndex];
        const answered = selected !== undefined;
        const correct = String(selected).trim() === String(question.correct_answer).trim();

        return (
          <div key={question.id || questionIndex} className="rounded-3xl border border-fuchsia-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-600 font-black text-white">
                {questionIndex + 1}
              </span>
              <MathText className="font-black text-slate-950">{question.question}</MathText>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(question.choices || []).map((choice, choiceIndex) => {
                const isSelected = selected === choice;
                const isCorrectChoice = String(choice).trim() === String(question.correct_answer).trim();

                return (
                  <button
                    key={choiceIndex}
                    type="button"
                    onClick={() =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id || questionIndex]: choice,
                      }))
                    }
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-right font-bold transition",
                      !answered && "border-slate-200 bg-slate-50 hover:border-fuchsia-300 hover:bg-fuchsia-50",
                      answered && isCorrectChoice && "border-emerald-300 bg-emerald-50 text-emerald-950",
                      answered && isSelected && !isCorrectChoice && "border-rose-300 bg-rose-50 text-rose-950",
                      answered && !isSelected && !isCorrectChoice && "border-slate-200 bg-slate-50 text-slate-400",
                    )}
                  >
                    <MathText as="span">{choice}</MathText>
                  </button>
                );
              })}
            </div>

            {!answered && question.hint && (
              <button
                type="button"
                onClick={() => setShowHint((current) => ({ ...current, [questionIndex]: !current[questionIndex] }))}
                className="mt-4 text-sm font-black text-amber-700"
              >
                {showHint[questionIndex] ? "إخفاء التلميح" : "أحتاج تلميحًا"}
              </button>
            )}

            {showHint[questionIndex] && !answered && (
              <div className="mt-3"><InfoBox tone="amber" title="تلميح"><MathText>{question.hint}</MathText></InfoBox></div>
            )}

            {answered && (
              <div className="mt-4">
                <InfoBox
                  tone={correct ? "emerald" : "rose"}
                  title={correct ? "إجابة صحيحة، أحسنت" : "الإجابة غير صحيحة"}
                  icon={correct ? CheckCircle2 : XCircle}
                >
                  <MathText className="font-semibold">{question.explanation}</MathText>
                </InfoBox>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryStep({ content }) {
  return (
    <div className="space-y-6">
      <BulletList items={content.remember} tone="emerald" icon={CheckCircle2} />

      <div className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#0f172a_0%,#1e1b4b_55%,#312e81_100%)] p-6 text-white shadow-xl shadow-indigo-950/15">
        <div className="mb-4 flex items-center gap-2 font-black text-amber-300">
          <Trophy size={20} />
          المنهجية المختصرة
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(content.method_template || []).map((item, index) => (
            <div key={index} className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white font-black text-slate-950">
                {index + 1}
              </span>
              <MathText className="text-sm font-bold text-white">{item}</MathText>
            </div>
          ))}
        </div>
      </div>

      <InfoBox title="رسالة أخيرة" tone="indigo" icon={Sparkles}>
        <MathText className="font-black">{content.final_sentence}</MathText>
      </InfoBox>
    </div>
  );
}


/* =========================================================
   Structured JSON + graphs
========================================================= */

const FIELD_LABELS = {
  teacher: "شرح الأستاذ",
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
  action: "ماذا أفعل؟",
  problem: "المشكلة",
  if_student_does_not_understand: "ماذا أفعل عندما لا أفهم؟",
  mastery_rule: "علامة الإتقان",
  next_step: "الخطوة التالية",
};

function fieldLabel(key) {
  return FIELD_LABELS[key] || key.replaceAll("_", " ");
}

function GraphRenderer({ graph }) {
  if (!graph || !Array.isArray(graph.series)) return null;

  const width = 820;
  const height = 470;
  const margin = { top: 34, right: 46, bottom: 58, left: 70 };

  const allPoints = graph.series.flatMap((serie) =>
    Array.isArray(serie.data) ? serie.data : [],
  );

  const fallbackX = allPoints.map((point) => Number(point.x)).filter(Number.isFinite);
  const fallbackY = allPoints.map((point) => Number(point.y)).filter(Number.isFinite);

  const xDomain =
    Array.isArray(graph.x_domain) && graph.x_domain.length === 2
      ? graph.x_domain.map(Number)
      : [
          Math.min(...fallbackX, 0),
          Math.max(...fallbackX, 1),
        ];

  const yDomain =
    Array.isArray(graph.y_domain) && graph.y_domain.length === 2
      ? graph.y_domain.map(Number)
      : [
          Math.min(...fallbackY, 0),
          Math.max(...fallbackY, 1),
        ];

  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const scaleX = (x) =>
    margin.left + ((Number(x) - xMin) / Math.max(xMax - xMin, 1e-9)) * plotWidth;

  const scaleY = (y) =>
    margin.top + (1 - (Number(y) - yMin) / Math.max(yMax - yMin, 1e-9)) * plotHeight;

  const tickCount = 6;
  const xTicks = Array.from(
    { length: tickCount + 1 },
    (_, index) => xMin + ((xMax - xMin) * index) / tickCount,
  );
  const yTicks = Array.from(
    { length: tickCount + 1 },
    (_, index) => yMin + ((yMax - yMin) * index) / tickCount,
  );

  const palette = [
    "#4f46e5",
    "#059669",
    "#e11d48",
    "#d97706",
    "#7c3aed",
    "#0891b2",
  ];

  const formatTick = (value) => {
    if (Number.isInteger(value)) return String(value);
    return Number(value.toFixed(2)).toString();
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-gradient-to-l from-indigo-50 to-white px-5 py-4">
        <div>
          <p className="text-xs font-black text-indigo-600">تمثيل بياني تفاعلي</p>
          <h4 className="mt-1 font-black text-slate-950">
            {graph.graph_type === "cobweb"
              ? "مخطط السلم"
              : "تمثيل حدود المتتالية"}
          </h4>
        </div>

        {graph.settings?.show_legend !== false && (
          <div className="flex flex-wrap gap-3">
            {graph.series.map((serie, index) => (
              <span
                key={serie.id || index}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: palette[index % palette.length] }}
                />
                {serie.label || serie.id}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto p-3 sm:p-5" dir="ltr">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[680px] w-full"
          role="img"
          aria-label="رسم بياني للمتتالية"
        >
          <rect x="0" y="0" width={width} height={height} rx="22" fill="#ffffff" />

          {graph.settings?.show_grid !== false &&
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

          {graph.settings?.show_grid !== false &&
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

          <line
            x1={margin.left}
            y1={height - margin.bottom}
            x2={width - margin.right}
            y2={height - margin.bottom}
            stroke="#0f172a"
            strokeWidth="2"
          />
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={height - margin.bottom}
            stroke="#0f172a"
            strokeWidth="2"
          />

          {xTicks.map((tick, index) => (
            <g key={`x-tick-${index}`}>
              <line
                x1={scaleX(tick)}
                y1={height - margin.bottom}
                x2={scaleX(tick)}
                y2={height - margin.bottom + 6}
                stroke="#0f172a"
              />
              <text
                x={scaleX(tick)}
                y={height - margin.bottom + 24}
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
                x1={margin.left - 6}
                y1={scaleY(tick)}
                x2={margin.left}
                y2={scaleY(tick)}
                stroke="#0f172a"
              />
              <text
                x={margin.left - 12}
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
            x={margin.left + plotWidth / 2}
            y={height - 12}
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fill="#0f172a"
          >
            {graph.x_label || "x"}
          </text>

          <text
            x="18"
            y={margin.top + plotHeight / 2}
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fill="#0f172a"
            transform={`rotate(-90 18 ${margin.top + plotHeight / 2})`}
          >
            {graph.y_label || "y"}
          </text>

          {graph.series.map((serie, serieIndex) => {
            const color = palette[serieIndex % palette.length];

            if (serie.type === "horizontal_line" && Number.isFinite(Number(serie.y))) {
              return (
                <line
                  key={serie.id || serieIndex}
                  x1={margin.left}
                  y1={scaleY(serie.y)}
                  x2={width - margin.right}
                  y2={scaleY(serie.y)}
                  stroke={color}
                  strokeWidth="2.5"
                  strokeDasharray="9 7"
                />
              );
            }

            const points = Array.isArray(serie.data)
              ? serie.data.filter(
                  (point) =>
                    Number.isFinite(Number(point.x)) &&
                    Number.isFinite(Number(point.y)),
                )
              : [];

            if (serie.type === "line" || serie.type === "polyline") {
              const path = points
                .map((point) => `${scaleX(point.x)},${scaleY(point.y)}`)
                .join(" ");

              return (
                <g key={serie.id || serieIndex}>
                  <polyline
                    points={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={serie.type === "polyline" ? 2.4 : 3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {serie.type === "polyline" &&
                    points.map((point, pointIndex) => (
                      <circle
                        key={pointIndex}
                        cx={scaleX(point.x)}
                        cy={scaleY(point.y)}
                        r="3.5"
                        fill={color}
                      />
                    ))}
                </g>
              );
            }

            return (
              <g key={serie.id || serieIndex}>
                {graph.settings?.connect_points &&
                  points.length > 1 && (
                    <polyline
                      points={points
                        .map((point) => `${scaleX(point.x)},${scaleY(point.y)}`)
                        .join(" ")}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      strokeDasharray="5 5"
                      opacity="0.65"
                    />
                  )}

                {points.map((point, pointIndex) => (
                  <g key={pointIndex}>
                    <circle
                      cx={scaleX(point.x)}
                      cy={scaleY(point.y)}
                      r="6"
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    {graph.settings?.show_point_labels && (
                      <text
                        x={scaleX(point.x)}
                        y={scaleY(point.y) - 12}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill="#334155"
                      >
                        {point.label || `u${point.n ?? pointIndex}`}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}

          {(graph.annotations || []).map((annotation, index) => {
            if (
              annotation.type !== "text" ||
              !Number.isFinite(Number(annotation.x)) ||
              !Number.isFinite(Number(annotation.y))
            ) {
              return null;
            }

            return (
              <text
                key={index}
                x={scaleX(annotation.x)}
                y={scaleY(annotation.y)}
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="#7c3aed"
              >
                {annotation.text}
              </text>
            );
          })}
        </svg>
      </div>
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

      <div className="space-y-3">
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


function MethodStep({ content }) {
  const algorithm = Array.isArray(content.algorithm) ? content.algorithm : [];

  return (
    <div className="space-y-6">
      {content.method_goal && (
        <InfoBox title="هدف الطريقة" tone="indigo" icon={Target}>
          <MathText className="font-black">{content.method_goal}</MathText>
        </InfoBox>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {content.when_to_use && (
          <InfoBox title="متى نستعمل هذه الطريقة؟" tone="sky" icon={Compass}>
            <MathText className="font-bold">{content.when_to_use}</MathText>
          </InfoBox>
        )}

        {content.central_idea && (
          <InfoBox title="الفكرة الأساسية" tone="emerald" icon={Lightbulb}>
            <MathText className="font-bold">{content.central_idea}</MathText>
          </InfoBox>
        )}
      </div>

      {algorithm.length > 0 && (
        <div>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
              <Route size={20} />
            </div>
            <div>
              <p className="text-xs font-black text-indigo-600">
                خطوات مرتبة
              </p>
              <h3 className="text-lg font-black text-slate-950">
                اتبع المنهجية خطوة بخطوة
              </h3>
            </div>
          </div>

          <MethodTimeline items={algorithm} />
        </div>
      )}

      {Array.isArray(content.conclusion_templates) &&
        content.conclusion_templates.length > 0 && (
          <RevealBox label="قوالب جاهزة لكتابة الخاتمة" tone="emerald">
            <BulletList
              items={content.conclusion_templates}
              tone="emerald"
              icon={CheckCircle2}
            />
          </RevealBox>
        )}

      <div className="grid gap-4 lg:grid-cols-2">
        {content.teacher_tip && (
          <InfoBox title="نصيحة الأستاذ" tone="amber" icon={Lightbulb}>
            <MathText className="font-bold">{content.teacher_tip}</MathText>
          </InfoBox>
        )}

        {content.warning && (
          <InfoBox title="انتبه" tone="rose" icon={AlertTriangle}>
            <MathText className="font-bold">{content.warning}</MathText>
          </InfoBox>
        )}
      </div>

      {content.graph_data && <GraphRenderer graph={content.graph_data} />}
    </div>
  );
}


function WorkedExampleStep({ content }) {
  return (
    <div className="space-y-6">
      {content.statement && (
        <InfoBox title="نص المثال" tone="indigo" icon={BookOpen}>
          <MathText className="font-bold">{content.statement}</MathText>
        </InfoBox>
      )}

      {content.given?.length > 0 && (
        <div>
          <h3 className="mb-3 font-black text-slate-950">المعطيات</h3>
          <BulletList items={content.given} tone="sky" />
        </div>
      )}

      {content.required && (
        <InfoBox title="المطلوب" tone="amber" icon={Target}>
          <MathText className="font-bold">{content.required}</MathText>
        </InfoBox>
      )}

      {content.strategy && (
        <InfoBox title="الاستراتيجية" tone="sky" icon={Compass}>
          <MathText className="font-bold">{content.strategy}</MathText>
        </InfoBox>
      )}

      <div className="space-y-4">
        {(content.steps || []).map((item, index) => (
          <div
            key={index}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-black text-white">
                {item.step_number || index + 1}
              </span>
              <h4 className="font-black text-slate-950">
                {item.title || `الخطوة ${index + 1}`}
              </h4>
            </div>

            <MathText className="text-slate-600">
              {item.teacher_explanation || item.explanation}
            </MathText>

            {item.calculation && (
              <div className="mt-4">
                <MathPanel>{item.calculation}</MathPanel>
              </div>
            )}

            {item.result && (
              <div className="mt-4">
                <InfoBox title="النتيجة" tone="emerald" icon={CheckCircle2}>
                  <MathText className="font-bold">{item.result}</MathText>
                </InfoBox>
              </div>
            )}
          </div>
        ))}
      </div>

      {content.final_conclusion && (
        <InfoBox title="الخلاصة" tone="emerald" icon={CheckCircle2}>
          <MathText className="font-black">{content.final_conclusion}</MathText>
        </InfoBox>
      )}

      {content.bac_writing && (
        <RevealBox label="صياغة مختصرة للبكالوريا" tone="indigo">
          <MathText className="font-bold">{content.bac_writing}</MathText>
        </RevealBox>
      )}

      {content.graph_data && <GraphRenderer graph={content.graph_data} />}
    </div>
  );
}

function GuidedPracticeStep({ content }) {
  return (
    <div className="space-y-6">
      <InfoBox title="التمرين" tone="indigo" icon={BookOpen}>
        <MathText className="font-black">{content.exercise}</MathText>
      </InfoBox>

      {content.objective && (
        <InfoBox title="الهدف" tone="emerald" icon={Target}>
          <MathText className="font-bold">{content.objective}</MathText>
        </InfoBox>
      )}

      {content.guided_prompts?.length > 0 && (
        <div>
          <h3 className="mb-3 font-black text-slate-950">أسئلة توجهك نحو الحل</h3>
          <BulletList items={content.guided_prompts} tone="sky" icon={Compass} />
        </div>
      )}

      <HintLevels items={content.hint_levels} />

      {content.solution_steps?.length > 0 && (
        <RevealBox label="إظهار الحل خطوة بخطوة" tone="emerald">
          <MethodTimeline
            items={content.solution_steps.map((item, index) => ({
              step_number: index + 1,
              instruction: getDisplayText(item),
            }))}
          />
        </RevealBox>
      )}

      {content.final_answer && (
        <InfoBox title="الجواب النهائي" tone="emerald" icon={CheckCircle2}>
          <MathText className="font-black">{content.final_answer}</MathText>
        </InfoBox>
      )}

      {content.graph_data && <GraphRenderer graph={content.graph_data} />}
    </div>
  );
}

function InPathFinalAssessmentStep({ content }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <InfoBox title="التمرين الشامل" tone="amber" icon={Trophy}>
        <MathText className="font-black">{content.exercise}</MathText>
      </InfoBox>

      {content.skills?.length > 0 && (
        <div>
          <h3 className="mb-3 font-black text-slate-950">المهارات المقاسة</h3>
          <BulletList items={content.skills} tone="indigo" icon={Target} />
        </div>
      )}

      {content.guided_prompts?.length > 0 && (
        <HintLevels
          items={content.guided_prompts.map((hint, index) => ({
            level: index + 1,
            hint,
          }))}
        />
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-2xl bg-slate-950 px-5 py-4 font-black text-white transition hover:bg-indigo-700"
      >
        <span>{open ? "إخفاء التصحيح" : "إظهار التصحيح النموذجي"}</span>
        {open ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
      </button>

      {open && (
        <MethodTimeline
          items={(content.solution || []).map((item, index) => ({
            step_number: index + 1,
            instruction: getDisplayText(item),
          }))}
        />
      )}

      {content.success_criteria?.length > 0 && (
        <div>
          <h3 className="mb-3 font-black text-slate-950">معايير النجاح</h3>
          <BulletList
            items={content.success_criteria}
            tone="emerald"
            icon={CheckCircle2}
          />
        </div>
      )}

      {content.graph_data && <GraphRenderer graph={content.graph_data} />}
    </div>
  );
}


const PEDAGOGICAL_KEYS = new Set([
  "why",
  "how_to_think",
  "attention",
  "quick_check",
  "bac_connection",
  "mastery_rule",
  "next_step",
]);

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

function PedagogicalBlocks({ content }) {
  if (!content) return null;

  const hasAny =
    content.why ||
    content.how_to_think ||
    content.attention ||
    content.quick_check ||
    content.bac_connection ||
    content.mastery_rule ||
    content.next_step;

  if (!hasAny) return null;

  return (
    <div className="mt-7 space-y-4 border-t border-slate-200 pt-7">
      <div className="grid gap-4 lg:grid-cols-2">
        {content.why && (
          <InfoBox title="لماذا نتعلم هذه الفكرة؟" tone="amber" icon={Lightbulb}>
            <MathText className="font-bold">{content.why}</MathText>
          </InfoBox>
        )}
        {content.how_to_think && (
          <InfoBox title="كيف أفكر؟" tone="sky" icon={Brain}>
            <MathText className="font-bold">{content.how_to_think}</MathText>
          </InfoBox>
        )}
      </div>

      {content.attention && (
        <InfoBox title="انتبه إلى هذه النقطة" tone="rose" icon={AlertTriangle}>
          <MathText className="font-bold">{content.attention}</MathText>
        </InfoBox>
      )}

      {content.quick_check && <QuickCheckCard check={content.quick_check} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {content.bac_connection && (
          <InfoBox title="صلة الفكرة بالبكالوريا" tone="indigo" icon={GraduationCap}>
            <MathText className="font-bold">{content.bac_connection}</MathText>
          </InfoBox>
        )}
        {content.mastery_rule && (
          <InfoBox title="علامة الإتقان" tone="emerald" icon={Trophy}>
            <MathText className="font-bold">{content.mastery_rule}</MathText>
          </InfoBox>
        )}
        {content.next_step && (
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
          <MathText className="font-black text-slate-950">{item.problem}</MathText>
        </div>
      </div>
      <div className="flex items-start gap-3 px-5 py-4">
        <Route className="mt-1 shrink-0 text-indigo-600" size={19} />
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-black text-indigo-700">ماذا أفعل؟</p>
          <MathText className="font-bold text-slate-700">{item.action}</MathText>
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

function StructuredValue({ value, fieldKey, depth = 0 }) {
  if (isEmpty(value)) return null;

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

  if (fieldKey === "quick_check") {
    return <QuickCheckCard check={value} />;
  }

  if (fieldKey === "graph_data") {
    return <GraphRenderer graph={value} />;
  }

  if (typeof value === "string" || typeof value === "number") {
    const isFormula =
      fieldKey === "formula" ||
      fieldKey === "calculation" ||
      fieldKey === "rule";

    return isFormula ? (
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
    return (
      <div className={cn("space-y-4", depth > 0 && "mt-2")}>
        {Object.entries(value)
          .filter(
            ([key, nestedValue]) =>
              !isEmpty(nestedValue) &&
              key !== "step_number" &&
              key !== "level" &&
              !PEDAGOGICAL_KEYS.has(key),
          )
          .map(([key, nestedValue]) => (
            <div key={key}>
              <p className="mb-2 text-sm font-black text-slate-900">
                {fieldLabel(key)}
              </p>
              <StructuredValue
                value={nestedValue}
                fieldKey={key}
                depth={depth + 1}
              />
            </div>
          ))}
      </div>
    );
  }

  return null;
}

function GenericObjectStep({ content }) {
  const entries = Object.entries(content || {}).filter(
    ([key, value]) => !isEmpty(value) && !PEDAGOGICAL_KEYS.has(key),
  );

  return (
    <div className="space-y-5">
      {entries.map(([key, value]) => (
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
          <StructuredValue value={value} fieldKey={key} />
        </div>
      ))}
    </div>
  );
}


function DiscoveryStep({ content }) {
  return (
    <div className="space-y-5">
      {content.teacher && (
        <InfoBox title="نكتشف الفكرة" tone="sky" icon={Lightbulb}>
          <MathText className="font-bold">{content.teacher}</MathText>
        </InfoBox>
      )}
      {Array.isArray(content.observations) && (
        <BulletList items={content.observations} tone="sky" icon={CheckCircle2} />
      )}
      {content.strict_note && (
        <InfoBox title="ملاحظة حول التغير التام" tone="amber" icon={AlertTriangle}>
          <MathText className="font-bold">{content.strict_note}</MathText>
        </InfoBox>
      )}
      {content.conclusion && (
        <InfoBox title="الاستنتاج" tone="emerald" icon={CheckCircle2}>
          <MathText className="font-black">{content.conclusion}</MathText>
        </InfoBox>
      )}
    </div>
  );
}

function DefinitionStep({ content }) {
  return (
    <div className="space-y-6">
      {content.teacher && (
        <InfoBox title="الفكرة الأساسية" tone="indigo" icon={BookOpen}>
          <MathText className="font-bold">{content.teacher}</MathText>
        </InfoBox>
      )}

      {Array.isArray(content.definitions) && (
        <div className="grid gap-4 md:grid-cols-2">
          {content.definitions.map((item, index) => (
            <div key={index} className="rounded-[24px] border border-indigo-100 bg-gradient-to-b from-indigo-50/80 to-white p-5 shadow-sm">
              <h3 className="font-black text-indigo-950">{item.name}</h3>
              {item.formula && <div className="mt-3"><MathPanel>{item.formula}</MathPanel></div>}
              <MathText className="mt-3 text-sm font-semibold text-slate-700">{item.meaning}</MathText>
            </div>
          ))}
        </div>
      )}

      {Array.isArray(content.symbols) && (
        <div>
          <h3 className="mb-4 font-black text-slate-950">معاني الرموز</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {content.symbols.map((item, index) => (
              <div key={index} className="rounded-[22px] border border-slate-200 bg-white p-4 text-center shadow-sm">
                <MathPanel>{item.symbol}</MathPanel>
                <MathText className="mt-3 text-sm font-bold text-slate-700">{item.meaning}</MathText>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.monotone_definition && (
        <InfoBox title="تعريف المتتالية الرتيبة" tone="emerald" icon={CheckCircle2}>
          <MathText className="font-black">{content.monotone_definition}</MathText>
        </InfoBox>
      )}

      {content.memory_tip && (
        <InfoBox title="حيلة للحفظ" tone="amber" icon={Lightbulb}>
          <MathText className="font-bold">{content.memory_tip}</MathText>
        </InfoBox>
      )}
    </div>
  );
}

function StepBody({ step }) {
  const content = step?.content || {};

  switch (step?.type) {
    case "discovery":
      return <DiscoveryStep content={content} />;
    case "definition":
      return <DefinitionStep content={content} />;
    case "motivation":
      return <MotivationStep content={content} />;
    case "observation":
      return <ObservationStep content={content} />;
    case "guided_explanation":
      return <GuidedExplanationStep content={content} />;
    case "notation":
      return <NotationStep content={content} />;
    case "index_and_rank":
      return <RankStep content={content} />;
    case "definition_methods_overview":
      return <MethodsOverviewStep content={content} />;
    case "explicit_method":
      return <ExplicitMethodStep content={content} />;
    case "recursive_method":
      return <RecursiveMethodStep content={content} />;
    case "method":
      return <MethodStep content={content} />;
    case "worked_example":
      return <WorkedExampleStep content={content} />;
    case "guided_practice":
      return <GuidedPracticeStep content={content} />;
    case "final_assessment":
      return <InPathFinalAssessmentStep content={content} />;
    case "comparison":
      return <ComparisonStep content={content} />;
    case "bac_connection":
      return <BacConnectionStep content={content} />;
    case "common_mistakes":
      return <CommonMistakesStep content={content} />;
    case "mini_quiz":
      return <MiniQuizStep content={content} />;
    case "summary":
      return <SummaryStep content={content} />;
    default:
      return <GenericObjectStep content={content} />;
  }
}


const STEP_META = {
  discovery: { label: "الاكتشاف", icon: Lightbulb, accent: "from-cyan-500 to-sky-600" },
  definition: { label: "التعريف", icon: BookOpen, accent: "from-indigo-500 to-violet-600" },
  property: { label: "خاصية", icon: Sparkles, accent: "from-sky-500 to-indigo-600" },
  theorem: { label: "مبرهنة", icon: GraduationCap, accent: "from-violet-500 to-indigo-700" },
  method: { label: "الطريقة", icon: Route, accent: "from-emerald-500 to-teal-600" },
  worked_example: { label: "مثال محلول", icon: CheckCircle2, accent: "from-emerald-500 to-cyan-600" },
  relationship: { label: "العلاقات", icon: Route, accent: "from-cyan-500 to-indigo-600" },
  special_case: { label: "حالة خاصة", icon: AlertTriangle, accent: "from-amber-500 to-orange-600" },
  graphical_interpretation: { label: "التمثيل البياني", icon: Compass, accent: "from-sky-500 to-violet-600" },
  guided_practice: { label: "تدريب موجه", icon: Target, accent: "from-blue-500 to-indigo-600" },
  final_assessment: { label: "تقويم نهائي", icon: Trophy, accent: "from-amber-500 to-rose-600" },
  motivation: { label: "الانطلاق", icon: Sparkles, accent: "from-amber-500 to-orange-500" },
  observation: { label: "الملاحظة", icon: CircleHelp, accent: "from-sky-500 to-cyan-500" },
  guided_explanation: { label: "بناء المفهوم", icon: Brain, accent: "from-indigo-500 to-violet-500" },
  notation: { label: "الترميز", icon: Hash, accent: "from-violet-500 to-fuchsia-500" },
  index_and_rank: { label: "الدليل والرتبة", icon: ListChecks, accent: "from-sky-500 to-indigo-500" },
  definition_methods_overview: { label: "طرق التعريف", icon: Compass, accent: "from-cyan-500 to-indigo-500" },
  explicit_method: { label: "الحد العام", icon: Zap, accent: "from-indigo-500 to-blue-500" },
  recursive_method: { label: "العلاقة التراجعية", icon: Route, accent: "from-emerald-500 to-teal-500" },
  comparison: { label: "مقارنة", icon: ListChecks, accent: "from-slate-600 to-slate-900" },
  bac_connection: { label: "البكالوريا", icon: GraduationCap, accent: "from-amber-500 to-rose-500" },
  common_mistakes: { label: "أخطاء شائعة", icon: AlertTriangle, accent: "from-rose-500 to-red-600" },
  mini_quiz: { label: "اختبار سريع", icon: Target, accent: "from-fuchsia-500 to-violet-600" },
  summary: { label: "الخلاصة", icon: Trophy, accent: "from-emerald-500 to-indigo-600" },
};


function normalizeReExplanationAnswer(payload) {
  const candidate =
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
    return text ? { simple_explanation: text } : null;
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  // بعض نسخ الـ API تضع الجواب داخل answer.re_explanation
  if (
    candidate.re_explanation &&
    typeof candidate.re_explanation === "object" &&
    !Array.isArray(candidate.re_explanation)
  ) {
    return candidate.re_explanation;
  }

  // وبعضها تعيده كنص داخل re_explanation
  if (typeof candidate.re_explanation === "string") {
    return {
      ...candidate,
      simple_explanation:
        candidate.simple_explanation || candidate.re_explanation,
    };
  }

  return candidate;
}

function extractReExplanation(payload) {
  const answer = normalizeReExplanationAnswer(payload);
  if (!answer) return "";

  return (
    answer.simple_explanation ||
    answer.explanation ||
    answer.teacher_message ||
    answer.summary ||
    answer.example ||
    answer.title ||
    ""
  );
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
    model: item?.model ?? item?.ai_model ?? item?.answer?.model ?? "",
    createdAt:
      item?.created_at ??
      item?.createdAt ??
      item?.date_created ??
      item?.timestamp ??
      "",
    raw: item,
  };
}

function ReExplanationAnswer({ answer }) {
  if (!answer) return null;

  if (typeof answer === "string") {
    return (
      <MathText className="text-sm font-semibold text-slate-700">
        {answer}
      </MathText>
    );
  }

  const steps = Array.isArray(answer.steps) ? answer.steps : [];

  return (
    <div className="space-y-4">
      {answer.title && (
        <div className="rounded-2xl bg-gradient-to-l from-violet-600 to-indigo-600 px-4 py-3 text-white shadow-sm">
          <MathText className="font-black text-white">
            {answer.title}
          </MathText>
        </div>
      )}

      {(answer.simple_explanation || answer.explanation || answer.teacher_message) && (
        <InfoBox title="الشرح المبسط" tone="indigo" icon={Brain}>
          <MathText className="text-sm font-semibold">
            {answer.simple_explanation ||
              answer.explanation ||
              answer.teacher_message}
          </MathText>
        </InfoBox>
      )}

      {answer.example && (
        <InfoBox title="مثال للتوضيح" tone="sky" icon={Lightbulb}>
          <MathText className="text-sm font-semibold">
            {answer.example}
          </MathText>
        </InfoBox>
      )}

      {steps.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2 font-black text-slate-900">
            <ListChecks size={18} className="text-violet-600" />
            خطوات الفهم
          </div>
          <div className="space-y-3">
            {steps.map((stepText, stepIndex) => (
              <div
                key={`${stepIndex}-${getDisplayText(stepText)}`}
                className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4"
              >
                <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 px-2 text-xs font-black text-white">
                  {stepIndex + 1}
                </span>
                <MathText className="text-sm font-semibold text-slate-700">
                  {getDisplayText(stepText)}
                </MathText>
              </div>
            ))}
          </div>
        </div>
      )}

      {answer.check_question && (
        <RevealBox label="تحقق من فهمك" tone="amber" defaultOpen>
          <MathText className="font-bold text-amber-950">
            {answer.check_question}
          </MathText>

          {answer.expected_answer && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-2 text-xs font-black text-emerald-700">
                الإجابة المتوقعة
              </p>
              <MathText className="text-sm font-black text-emerald-950">
                {answer.expected_answer}
              </MathText>
            </div>
          )}
        </RevealBox>
      )}

      {!answer.check_question && answer.expected_answer && (
        <InfoBox title="الإجابة المتوقعة" tone="emerald" icon={CheckCircle2}>
          <MathText className="text-sm font-black">
            {answer.expected_answer}
          </MathText>
        </InfoBox>
      )}

      {answer.encouragement && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <Trophy className="mt-1 shrink-0 text-emerald-600" size={18} />
          <MathText className="text-sm font-black text-emerald-950">
            {answer.encouragement}
          </MathText>
        </div>
      )}

      {answer.summary && (
        <InfoBox title="الخلاصة" tone="slate" icon={Sparkles}>
          <MathText className="text-sm font-semibold">
            {answer.summary}
          </MathText>
        </InfoBox>
      )}
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
    id: "simplify",
    label: "شرح أبسط",
    shortLabel: "شرح",
    icon: Brain,
    prompt: "اشرح محتوى هذه المرحلة بطريقة بسيطة جدًا ومباشرة، مع التركيز على الفكرة الأساسية فقط.",
  },
  {
    id: "example",
    label: "مثال جديد",
    shortLabel: "مثال",
    icon: Lightbulb,
    prompt: "أعطني مثالًا جديدًا واضحًا يطبق فكرة هذه المرحلة خطوة بخطوة.",
  },
  {
    id: "symbols",
    label: "شرح الرموز",
    shortLabel: "الرموز",
    icon: Hash,
    prompt: "اشرح الرموز والتعابير الرياضية الموجودة في هذه المرحلة ومعنى كل رمز ببساطة.",
  },
  {
    id: "steps",
    label: "خطوات الفهم",
    shortLabel: "الخطوات",
    icon: ListChecks,
    prompt: "اشرح هذه المرحلة في خطوات قصيرة ومرتبة، وبيّن ماذا نفعل في كل خطوة.",
  },
  {
    id: "bac",
    label: "طريقة البكالوريا",
    shortLabel: "البكالوريا",
    icon: GraduationCap,
    prompt: "اشرح كيف نستعمل فكرة هذه المرحلة في البكالوريا مع صياغة رياضية قصيرة ومنظمة.",
  },
  {
    id: "summary",
    label: "خلاصة سريعة",
    shortLabel: "الخلاصة",
    icon: Target,
    prompt: "لخّص هذه المرحلة في أهم الأفكار والقواعد التي يجب فهمها وحفظها.",
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

    setOpen(normalized.length > 0);
    setLoadingAction("");
    setError("");
    setHistory(normalized.slice(-3));

    return () => abortControllerRef.current?.abort();
  }, [step?.id, initialHistory]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
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

    setOpen(true);
    setError("");
    setLoadingAction(action.id);
    setHistory((current) => [...current.filter((item) => !item.pending), optimisticItem].slice(-3));

    const payload = {
      step: requestedStep,
      student_question: action.prompt,
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
      const detail =
        responseData?.details ||
        responseData?.detail ||
        responseData?.error ||
        responseData?.message ||
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
              اختر نوع المساعدة لهذه المرحلة
            </p>
          </div>
        </div>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-700">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
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
                    "group/action flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-2xl border bg-white px-2 py-3 text-center shadow-sm transition duration-200",
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
                        يتم إعداد الشرح...
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

  return (
    <article
      id={step.id || `step-${index + 1}`}
      className="scroll-mt-24 overflow-hidden rounded-[36px] border border-white/90 bg-white shadow-[0_28px_90px_-45px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70"
    >
      <div className={cn("relative overflow-hidden bg-gradient-to-l px-5 py-6 text-white sm:px-8 sm:py-7", meta.accent)}>
        <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/20 bg-white/15 shadow-lg backdrop-blur">
              <Icon size={23} />
            </div>
            <div>
              <p className="text-[11px] font-black tracking-[0.14em] text-white/75">{meta.label}</p>
              <h2 className="mt-1 text-xl font-black leading-8 sm:text-[28px]">{step.title}</h2>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/15 px-4 py-2 text-xs font-black shadow-sm backdrop-blur">
            المرحلة {index + 1} من {total}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-white via-white to-slate-50/40 p-5 sm:p-8">
        <StepBody step={step} />
        <PedagogicalBlocks content={step?.content} />
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

function FinalAssessment({ assessment }) {
  const [openAnswers, setOpenAnswers] = useState(false);

  if (!assessment) return null;

  return (
    <section className="overflow-hidden rounded-[36px] border border-amber-200/80 bg-white shadow-[0_28px_80px_-42px_rgba(245,158,11,0.5)]">
      <div className="relative overflow-hidden bg-gradient-to-l from-amber-500 via-orange-500 to-rose-500 p-6 text-white sm:p-9">
        <div className="pointer-events-none absolute -left-10 -top-16 h-44 w-44 rounded-full bg-white/20 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Trophy size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-white/80">التقييم الختامي</p>
            <h2 className="text-2xl font-black">اختبر إتقانك للمحور</h2>
          </div>
        </div>
        <MathText className="mt-5 font-semibold text-white">{assessment.statement}</MathText>
      </div>

      <div className="space-y-6 p-5 sm:p-8">
        <div className="space-y-3.5">
          {(assessment.questions || []).map((question, index) => (
            <div key={index} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-black text-white">
                {index + 1}
              </span>
              <MathText className="font-bold text-slate-800">{question}</MathText>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpenAnswers((value) => !value)}
          className="flex w-full items-center justify-between rounded-2xl bg-slate-950 px-5 py-4 font-black text-white transition hover:bg-indigo-700"
        >
          <span>{openAnswers ? "إخفاء التصحيح" : "إظهار التصحيح النموذجي"}</span>
          {openAnswers ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
        </button>

        {openAnswers && (
          <div className="space-y-3.5">
            {(assessment.answers || []).map((answer, index) => (
              <InfoBox key={index} title={`إجابة السؤال ${index + 1}`} tone="emerald" icon={CheckCircle2}>
                <MathText className="font-bold">{answer}</MathText>
              </InfoBox>
            ))}
          </div>
        )}

        <div>
          <h3 className="mb-4 font-black text-slate-950">معايير النجاح</h3>
          <BulletList items={assessment.success_criteria} tone="emerald" icon={CheckCircle2} />
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Main component
========================================================= */

/* =========================================================
   Card pages
========================================================= */

function CourseIntroCard({ lesson, title, learningPath }) {
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

            {lesson.difficulty && (
              <span className="rounded-full bg-emerald-400/15 px-4 py-2 text-xs font-black text-emerald-200">
                المستوى: {lesson.difficulty}
              </span>
            )}

            {lesson.estimated_duration && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/80">
                <Clock3 size={15} />
                {lesson.estimated_duration}
              </span>
            )}
          </div>

          <h1 className="mt-7 max-w-4xl text-3xl font-black leading-[1.5] sm:text-4xl lg:text-[44px]">
            {title}
          </h1>

          {lesson.lesson_goal && (
            <div className="mt-7 flex max-w-4xl items-start gap-3 rounded-[26px] border border-white/15 bg-white/10 p-5 shadow-inner backdrop-blur sm:p-6">
              <Target className="mt-1 shrink-0 text-amber-300" size={22} />
              <MathText className="font-bold text-slate-100">
                {lesson.lesson_goal}
              </MathText>
            </div>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/15 bg-white/10 p-5 shadow-inner backdrop-blur transition hover:bg-white/15">
              <p className="text-xs font-black text-white/60">مراحل الدرس</p>
              <p className="mt-2 text-3xl font-black">{learningPath.length}</p>
            </div>

            <div className="rounded-[24px] border border-white/15 bg-white/10 p-5 shadow-inner backdrop-blur transition hover:bg-white/15">
              <p className="text-xs font-black text-white/60">خريطة الدرس</p>
              <p className="mt-2 text-3xl font-black">
                {lesson.lesson_map?.length || 0}
              </p>
            </div>

            <div className="rounded-[24px] border border-white/15 bg-white/10 p-5 shadow-inner backdrop-blur transition hover:bg-white/15">
              <p className="text-xs font-black text-white/60">طريقة العرض</p>
              <p className="mt-2 text-lg font-black">بطاقات تفاعلية</p>
            </div>
          </div>
        </div>
      </div>

      {(lesson.lesson_map?.length > 0 ||
        lesson.prerequisites?.length > 0 ||
        lesson.learning_outcomes?.length > 0) && (
        <div className="grid gap-6 bg-gradient-to-b from-white to-slate-50/60 p-5 sm:p-8 lg:grid-cols-2">
          {/* {lesson.lesson_map?.length > 0 && (
            <div className="rounded-[30px] border border-indigo-100 bg-gradient-to-b from-indigo-50/70 to-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                  <Route size={19} />
                </div>
                <div>
                  <p className="text-xs font-black text-indigo-600">الخريطة</p>
                  <h2 className="font-black text-slate-950">مسار التعلم</h2>
                </div>
              </div>

              <div className="space-y-3.5">
                {lesson.lesson_map.slice(0, 4).map((item, index) => (
                  <div
                    key={`${item.part}-${index}`}
                    className="flex items-start gap-3 rounded-[20px] border border-indigo-100/70 bg-white p-4 shadow-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-black text-indigo-700">
                      {item.part || index + 1}
                    </span>
                    <div>
                      <p className="font-black text-slate-900">{item.title}</p>
                      {item.focus && (
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {item.focus}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} */}
    {lesson.prerequisites?.length > 0 && (
              <div className="rounded-[30px] border border-amber-100 bg-gradient-to-b from-amber-50 to-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center gap-2 font-black text-amber-900">
                  <Brain size={20} />
                  المكتسبات القبلية
                </div>
                <BulletList
                  items={lesson.prerequisites.slice(0, 4)}
                  tone="amber"
                  icon={CheckCircle2}
                />
              </div>
            )}
          <div className="space-y-5 sm:space-y-6">
        

            {lesson.learning_outcomes?.length > 0 && (
              <div className="rounded-[30px] border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center gap-2 font-black text-emerald-900">
                  <Target size={20} />
                  أهداف الدرس
                </div>
                <BulletList
                  items={lesson.learning_outcomes.slice(0, 4)}
                  tone="emerald"
                  icon={CheckCircle2}
                />
              </div>
            )}
          </div>
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

export default function CourseAnswer({
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

  const learningPath = useMemo(
    () =>
      Array.isArray(lesson?.learning_path)
        ? lesson.learning_path.filter(Boolean)
        : [],
    [lesson],
  );

  const pages = useMemo(() => {
    if (!lesson) return [];

    const result = [
      {
        id: "lesson-intro",
        type: "lesson_intro",
        title: "مقدمة الدرس",
        label: "البداية",
        icon: Sparkles,
      },
      ...learningPath.map((step, index) => ({
        ...step,
        id: step.id || `step-${index + 1}`,
        label: STEP_META[step.type]?.label || "شرح",
        icon: STEP_META[step.type]?.icon || BookOpen,
      })),
    ];

    if (lesson.final_assessment) {
      result.push({
        id: "final-assessment",
        type: "final_assessment",
        title: "التقييم الختامي",
        label: "التقييم",
        icon: Trophy,
      });
    }

    return result;
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
    lesson.axis_title || axis?.title || lesson.title || "شرح الدرس";

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
      className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,#eef2ff_0%,transparent_34%),radial-gradient(circle_at_bottom_left,#fae8ff_0%,transparent_28%),linear-gradient(180deg,#fbfcff_0%,#f6f7fc_48%,#eef2ff_100%)] px-3 py-5 sm:px-5 lg:px-8"
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
          overflow-x: auto;
          overflow-y: hidden;
          padding-block: 0.2rem;
          direction: ltr !important;
          text-align: inherit;
          unicode-bidi: isolate;
        }

        mjx-container[display="true"] {
          display: block !important;
          margin: 0.45rem 0 !important;
          text-align: center !important;
        }

        .unicode-bidi-plaintext {
          unicode-bidi: plaintext;
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

      <div className="relative mx-auto max-w-[1220px]">
        <header
          id="course-card-top"
          className="relative mb-7 overflow-hidden rounded-[36px] border border-white/90 bg-white/90 p-4 shadow-[0_28px_95px_-46px_rgba(15,23,42,0.42)] ring-1 ring-indigo-100/60 backdrop-blur-xl sm:p-6 lg:p-7"
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-l from-indigo-600 via-violet-500 to-fuchsia-500" />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 ring-1 ring-indigo-100">
                  <GraduationCap size={15} />
                  {data?.axis?.chapter_title || "المتتاليات العددية"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-black text-white shadow-lg shadow-indigo-500/20">
                  <BookOpen size={14} />
                  أكاديمية التميز
                </span>
              </div>

              <h1 className="mt-4 max-w-4xl text-2xl font-black leading-[1.5] text-slate-950 sm:text-3xl lg:text-[38px]">
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

            <div className="flex items-center gap-4 rounded-[30px] border border-indigo-100 bg-gradient-to-l from-indigo-50/80 to-white p-3 shadow-sm sm:p-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white shadow-[inset_0_2px_10px_rgba(99,102,241,0.08),0_10px_25px_-15px_rgba(79,70,229,0.55)] ring-1 ring-indigo-100">
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

            <div key={activePage?.id || safePage} className="relative min-h-[620px] animate-[fadeIn_.35s_ease-out]">
              {pages.length === 0 ? (
                <EmptyLessonCard />
              ) : activePage?.type === "lesson_intro" ? (
                <CourseIntroCard
                  lesson={lesson}
                  title={title}
                  learningPath={learningPath}
                />
              ) : activePage?.type === "final_assessment" ? (
                <FinalAssessment assessment={lesson.final_assessment} />
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
            <div className="sticky bottom-3 z-20 mt-7 rounded-[32px] border border-white/90 bg-white/90 p-3 shadow-[0_22px_80px_-34px_rgba(15,23,42,0.5)] ring-1 ring-indigo-100/70 backdrop-blur-xl sm:p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <button
                  type="button"
                  onClick={goPrevious}
                  disabled={safePage === 0}
                  className={cn(
                    "group inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-4 font-black transition-all duration-300",
                    safePage === 0
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-slate-950 text-white shadow-lg shadow-slate-950/15 hover:-translate-y-0.5 hover:bg-indigo-700",
                  )}
                >
                  <ArrowRight size={20} className="transition group-hover:translate-x-1" />
                  <span>السابق</span>
                </button>

                <div className="min-w-0 px-1 text-center sm:px-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">المرحلة الحالية</p>
                  <p className="mt-1 max-w-[130px] truncate text-sm font-black text-slate-950 sm:max-w-[320px] sm:text-base">
                    {activePage?.title}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={safePage === pages.length - 1}
                  className={cn(
                    "group inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-4 font-black transition-all duration-300",
                    safePage === pages.length - 1
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-gradient-to-l from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 hover:shadow-xl",
                  )}
                >
                  <span>التالي</span>
                  <ArrowLeft size={20} className="transition group-hover:-translate-x-1" />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 overflow-x-auto px-2 pb-1">
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