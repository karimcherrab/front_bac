// src/components/islamicCourse/IslamicLessonMastery10.jsx
// Mastery Focus UI: 5 phases + micro recall + BAC practice.
// React + TailwindCSS + lucide-react only.

import { useMemo, useRef, useState } from "react";
import {
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
  Eye,
  GraduationCap,
  Heart,
  Lightbulb,
  ListChecks,
  Menu,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";

/* =========================================================
   Helpers
========================================================= */

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function arr(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function normalizeLesson(data) {
  return data?.axis?.content || data?.content || data?.lesson || data || null;
}

function getTitle(data, lesson) {
  return data?.axis?.title || data?.title || lesson?.title || "درس العلوم الإسلامية";
}

function stepIndexById(lesson) {
  const map = new Map();
  arr(lesson?.learning_path).forEach((step) => map.set(step.id, step));
  return map;
}

function textOf(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    return (
      value.text ||
      value.title ||
      value.label ||
      value.term ||
      value.definition ||
      value.description ||
      value.explanation ||
      value.answer ||
      value.case ||
      value.group ||
      ""
    );
  }
  return String(value);
}

const EXCLUDED_GENERIC_KEYS = new Set([
  "teacher",
  "central_question",
  "simple_answer",
  "memory_hook",
  "takeaway",
  "definitions",
  "attention",
  "points",
  "groups",
  "graph_data",
  "simple_formula",
  "example",
  "examples",
  "quran_evidence",
  "how_to_recognize",
  "memory_word",
  "cases",
  "memory_story",
  "recall_sentence",
  "practice",
  "steps",
  "recognition_keys",
  "bac_answer_template",
  "comparisons",
  "definition",
  "importance",
  "means_8",
  "golden_chain",
  "exam_rule",
  "instructions",
  "questions",
  "mastery_rule",
]);

/* =========================================================
   Small UI primitives
========================================================= */

function SoftButton({ children, onClick, disabled, active = false, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition",
        active
          ? "border-emerald-900 bg-emerald-900 text-white"
          : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50",
        disabled && "cursor-not-allowed opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[11px] font-black tracking-wide text-stone-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />
      {children}
    </div>
  );
}

function QuietPanel({ children, className = "" }) {
  return (
    <div className={cn("rounded-3xl border border-stone-200 bg-white p-5 sm:p-6", className)}>
      {children}
    </div>
  );
}

function Emphasis({ children }) {
  return (
    <div className="rounded-3xl bg-stone-950 px-5 py-5 text-white sm:px-6">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-stone-200" />;
}

/* =========================================================
   Header + progress
========================================================= */

function CourseHeader({ title, lesson, onOpenOverview }) {
  return (
    <header className="border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-[11px] font-black text-emerald-800">
            الوحدة {lesson?.unit_number || "—"} · {lesson?.chapter_title || "العلوم الإسلامية"}
          </p>
          <h1 className="mt-1 truncate text-sm font-black text-stone-950 sm:text-base">{title}</h1>
        </div>

        <button
          type="button"
          onClick={onOpenOverview}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-50"
          aria-label="معلومات الدرس"
        >
          <Menu size={18} />
        </button>
      </div>
    </header>
  );
}

function ProgressRail({ screens, index, onSelect }) {
  return (
    <div className="sticky top-0 z-30 border-b border-stone-200 bg-[#f7f6f2]/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="scrollbar-none flex gap-1 overflow-x-auto py-3">
          {screens.map((screen, i) => {
            const done = i < index;
            const active = i === index;
            return (
              <button
                type="button"
                key={screen.id}
                onClick={() => onSelect(i)}
                className={cn(
                  "group flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition",
                  active
                    ? "bg-stone-950 text-white"
                    : done
                      ? "text-emerald-900 hover:bg-white"
                      : "text-stone-400 hover:bg-white hover:text-stone-700",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                    active
                      ? "border-white/30 bg-white/10"
                      : done
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-stone-300 bg-white",
                  )}
                >
                  {done ? <Check size={11} /> : i + 1}
                </span>
                <span>{screen.nav_label || `مرحلة ${i + 1}`}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Intro screen
========================================================= */

function IntroScreen({ experience, title, lesson, onStart, onOverview }) {
  const intro = experience?.intro || {};

  return (
    <main className="min-h-[calc(100vh-73px)] bg-[#f7f6f2] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[68vh] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="text-xs font-black text-emerald-800">
            {intro.eyebrow || `الوحدة ${lesson?.unit_number || ""}`}
          </p>
          <h2 className="mt-5 max-w-4xl text-4xl font-black leading-[1.35] text-stone-950 sm:text-5xl lg:text-6xl">
            {intro.title || title}
          </h2>
          <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-stone-600 sm:text-lg">
            {intro.subtitle || lesson?.lesson_goal}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-6 py-3.5 text-sm font-black text-white transition hover:bg-stone-800"
            >
              {intro.primary_action || "ابدأ الدرس"}
              <ArrowLeft size={17} />
            </button>
            <SoftButton onClick={onOverview}>{intro.secondary_action || "ماذا سأتعلم؟"}</SoftButton>
          </div>
        </div>

        <div className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-[0_18px_60px_rgba(28,25,23,.06)] sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black text-stone-400">خطة التعلم</p>
              <p className="mt-1 text-lg font-black text-stone-950">فكرة واحدة في كل مرة</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
              <Target size={20} />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {(arr(intro.plan).length
              ? intro.plan
              : ["افهم الأساس", "تعلّم المحتوى", "ثبّت الحفظ", "طبّق في البكالوريا", "اختبر الإتقان"]
            ).map((item, i) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-200 text-xs font-black text-stone-500">
                    {i + 1}
                  </span>
                  <span className="text-sm font-bold text-stone-700">{item}</span>
                </div>
              ),
            )}
          </div>

          <Divider />
          <div className="mt-5 flex items-center justify-between text-xs font-bold text-stone-500">
            <span className="inline-flex items-center gap-2"><Clock3 size={14} /> {lesson?.estimated_minutes || 45} دقيقة</span>
            <span>{arr(experience?.phases).length} مراحل رئيسية</span>
          </div>
        </div>
      </div>
    </main>
  );
}

/* =========================================================
   Common lesson blocks
========================================================= */

function FocusHeading({ screen, step }) {
  const raw = step?.title || screen?.title || "";
  const cleanTitle = raw.replace(/^\d+\s*[—-]\s*/, "");

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3">
        {screen?.number && (
          <span className="text-xs font-black tracking-[0.22em] text-emerald-800">{screen.number}</span>
        )}
        <span className="h-px w-9 bg-stone-300" />
        <span className="text-[11px] font-black text-stone-400">{screen?.label || screen?.nav_label || step?.type}</span>
      </div>
      <h2 className="mt-4 text-3xl font-black leading-[1.45] text-stone-950 sm:text-4xl">{cleanTitle}</h2>
    </div>
  );
}

function TeacherText({ value }) {
  if (!value) return null;
  return (
    <div className="max-w-4xl text-[17px] font-semibold leading-9 text-stone-700 sm:text-lg sm:leading-10">
      {value}
    </div>
  );
}

function FlowLine({ value }) {
  if (!value) return null;
  const pieces = String(value).split(/→|←|\|/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="mt-7">
      <SectionLabel>المسار الذهني</SectionLabel>
      <div className="flex flex-wrap items-center gap-2">
        {pieces.map((part, index) => (
          <div className="contents" key={`${part}-${index}`}>
            <span className="rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-black text-stone-800">
              {part}
            </span>
            {index < pieces.length - 1 && <ArrowLeft size={15} className="text-stone-300" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuranEvidence({ evidence }) {
  if (!evidence) return null;
  return (
    <div className="mt-8 border-r-2 border-emerald-800 pr-5 sm:pr-6">
      <SectionLabel>الدليل القرآني</SectionLabel>
      <p className="max-w-4xl text-xl font-black leading-[2.15] text-stone-950 sm:text-2xl">{evidence.text}</p>
      {evidence.reference && <p className="mt-2 text-xs font-black text-emerald-800">{evidence.reference}</p>}
      {evidence.connection && (
        <div className="mt-5 max-w-3xl text-sm font-semibold leading-8 text-stone-600">
          <strong className="text-stone-900">وجه الاستدلال: </strong>{evidence.connection}
        </div>
      )}
    </div>
  );
}

function MemoryWord({ word }) {
  if (!word) return null;
  return (
    <div className="mt-8 inline-flex items-baseline gap-3 rounded-full bg-emerald-950 px-5 py-3 text-white">
      <span className="text-[10px] font-black text-emerald-200">كلمة الحفظ</span>
      <span className="text-xl font-black">{word}</span>
    </div>
  );
}

function Takeaway({ value }) {
  if (!value) return null;
  return (
    <Emphasis>
      <p className="text-[11px] font-black text-emerald-300">ما الذي يجب أن يبقى في ذاكرتك؟</p>
      <p className="mt-2 text-base font-black leading-8 sm:text-lg">{value}</p>
    </Emphasis>
  );
}

function BacRecognition({ value }) {
  if (!value) return null;
  return (
    <div className="mt-8">
      <SectionLabel>كيف أتعرف عليها في البكالوريا؟</SectionLabel>
      <p className="max-w-4xl text-sm font-bold leading-8 text-stone-700">{value}</p>
    </div>
  );
}

/* =========================================================
   Minimal visuals — not a global mind map
========================================================= */

const visualIcon = {
  emotion: Heart,
  reasoning: Brain,
  distress: ShieldCheck,
  correction: Search,
  monitoring: Eye,
  story: BookOpen,
  contrast: Scale,
  power: Sparkles,
};

function ConceptVisual({ type, content }) {
  if (!type) return null;
  const Icon = visualIcon[type] || Lightbulb;

  if (type === "contrast" && arr(content?.cases).length) {
    return (
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {content.cases.map((item, index) => (
          <QuietPanel key={index} className="relative overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black text-stone-400">{index === 0 ? "اقترب" : "ابتعد"}</p>
                <h3 className="mt-1 text-lg font-black text-stone-950">{item.case}</h3>
              </div>
              <Scale size={20} className="text-emerald-800" />
            </div>
            <p className="mt-4 text-sm font-semibold leading-8 text-stone-600">{item.description}</p>
            {item.effect && <p className="mt-4 border-t border-stone-100 pt-4 text-sm font-black leading-7 text-stone-900">{item.effect}</p>}
          </QuietPanel>
        ))}
      </div>
    );
  }

  if (type === "story") {
    const parts = ["قصة", "ابتلاء", "ثبات", "نصر", "عبرة"];
    return (
      <div className="mt-8">
        <SectionLabel>كيف تعمل الفكرة؟</SectionLabel>
        <div className="relative grid gap-3 sm:grid-cols-5">
          {parts.map((part, index) => (
            <div key={part} className="relative rounded-2xl border border-stone-200 bg-white px-3 py-4 text-center text-sm font-black text-stone-800">
              <span className="mb-2 block text-[10px] font-bold text-stone-400">0{index + 1}</span>
              {part}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "distress") {
    return (
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <QuietPanel>
          <p className="text-[11px] font-black text-stone-400">في الرخاء</p>
          <p className="mt-2 text-lg font-black text-stone-950">قد يغفل الإنسان</p>
          <p className="mt-2 text-sm font-semibold leading-7 text-stone-600">تضعف ملاحظة حاجته إلى الله.</p>
        </QuietPanel>
        <QuietPanel className="border-emerald-200">
          <p className="text-[11px] font-black text-emerald-800">عند الشدة</p>
          <p className="mt-2 text-lg font-black text-stone-950">يشعر بضعفه ويلجأ إلى الله</p>
          <p className="mt-2 text-sm font-semibold leading-7 text-stone-600">فتظهر حقيقة العبودية والحاجة إلى الخالق.</p>
        </QuietPanel>
      </div>
    );
  }

  if (type === "correction") {
    return (
      <div className="mt-8 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {[
          ["فكرة منحرفة", "تُعرض بوضوح"],
          ["المناقشة", "دليل وعقل"],
          ["ظهور الحق", "إبطال التناقض"],
        ].map(([title, subtitle], index) => (
          <div className="contents" key={title}>
            <QuietPanel className="p-4 text-center">
              <p className="text-sm font-black text-stone-900">{title}</p>
              <p className="mt-1 text-xs font-bold text-stone-400">{subtitle}</p>
            </QuietPanel>
            {index < 2 && <ArrowLeft className="mx-auto text-stone-300" size={17} />}
          </div>
        ))}
      </div>
    );
  }

  if (type === "monitoring") {
    return (
      <div className="mt-8 flex max-w-3xl items-center gap-5 rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-900"><Eye size={24} /></span>
        <div>
          <p className="text-base font-black text-stone-950">الله يعلم → أنا مسؤول → أراقب سلوكي</p>
          <p className="mt-2 text-sm font-semibold leading-7 text-stone-600">الإيمان هنا ينتقل من المعرفة إلى السلوك اليومي.</p>
        </div>
      </div>
    );
  }

  if (type === "power") {
    return (
      <div className="mt-8 flex max-w-3xl flex-wrap items-center gap-3">
        {["الخلق", "الرزق", "الإحياء", "الإماتة", "التدبير"].map((item) => (
          <span key={item} className="rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-black text-stone-800">{item}</span>
        ))}
        <ArrowLeft size={16} className="text-stone-300" />
        <span className="rounded-full bg-emerald-950 px-4 py-2.5 text-sm font-black text-white">تعظيم قدرة الله</span>
      </div>
    );
  }

  return (
    <div className="mt-8 flex max-w-3xl items-center gap-5 rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-900"><Icon size={24} /></span>
      <div>
        <p className="text-xs font-black text-stone-400">الفكرة بصريًا</p>
        <p className="mt-1 text-base font-black leading-7 text-stone-950">{content?.simple_formula || content?.takeaway}</p>
      </div>
    </div>
  );
}

/* =========================================================
   Step-specific renderers
========================================================= */

function OpeningRenderer({ content }) {
  return (
    <div className="space-y-8">
      <TeacherText value={content.teacher} />
      {content.central_question && (
        <QuietPanel className="max-w-4xl">
          <div className="flex items-start gap-4">
            <CircleHelp className="mt-1 shrink-0 text-emerald-800" size={22} />
            <div>
              <p className="text-xs font-black text-stone-400">السؤال المركزي</p>
              <p className="mt-2 text-xl font-black leading-9 text-stone-950">{content.central_question}</p>
              {content.simple_answer && <p className="mt-4 text-sm font-semibold leading-8 text-stone-600">{content.simple_answer}</p>}
            </div>
          </div>
        </QuietPanel>
      )}
      {content.memory_hook && <p className="max-w-4xl text-sm font-black leading-8 text-emerald-900">{content.memory_hook}</p>}
      <Takeaway value={content.takeaway} />
    </div>
  );
}

function DefinitionRenderer({ content }) {
  return (
    <div className="space-y-7">
      <TeacherText value={content.teacher} />
      <div className="grid gap-4 md:grid-cols-2">
        {arr(content.definitions).map((item, index) => (
          <QuietPanel key={index}>
            <p className="text-xs font-black text-emerald-800">{item.term}</p>
            <p className="mt-3 text-lg font-black leading-9 text-stone-950">{item.definition}</p>
            {item.memory_tip && <p className="mt-4 text-sm font-bold leading-7 text-stone-500">{item.memory_tip}</p>}
          </QuietPanel>
        ))}
      </div>
      {content.attention && <p className="text-sm font-black text-stone-900"><span className="text-emerald-800">انتبه: </span>{content.attention}</p>}
      <Takeaway value={content.takeaway} />
    </div>
  );
}

function ImportanceRenderer({ content }) {
  return (
    <div className="space-y-8">
      <TeacherText value={content.teacher} />
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {arr(content.points).map((item, index) => (
          <div key={index} className="border-r border-stone-200 pr-4">
            <span className="text-[11px] font-black text-stone-400">0{index + 1}</span>
            <h3 className="mt-1 text-lg font-black text-stone-950">{item.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-7 text-stone-600">{item.explanation}</p>
          </div>
        ))}
      </div>
      {content.memory_hook && <p className="text-sm font-black text-emerald-900">مفتاح الحفظ: {content.memory_hook}</p>}
      <Takeaway value={content.takeaway} />
    </div>
  );
}

function OverviewRenderer({ content }) {
  return (
    <div className="space-y-8">
      <TeacherText value={content.teacher} />
      <div className="divide-y divide-stone-200 rounded-3xl border border-stone-200 bg-white">
        {arr(content.groups).map((group, index) => (
          <div key={index} className="grid gap-4 p-5 sm:grid-cols-[190px_1fr] sm:p-6">
            <div>
              <span className="text-[11px] font-black text-stone-400">مجموعة {index + 1}</span>
              <h3 className="mt-1 text-base font-black text-stone-950">{group.group?.replace(/^\d+\s*[—-]\s*/, "")}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {arr(group.items).map((item) => (
                <span key={item} className="rounded-full bg-stone-100 px-3 py-2 text-xs font-black text-stone-700">{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {content.memory_hook && <p className="text-sm font-black text-emerald-900">{content.memory_hook}</p>}
      <Takeaway value={content.takeaway} />
    </div>
  );
}

function MeanRenderer({ screen, content }) {
  return (
    <div>
      <TeacherText value={content.teacher} />
      <ConceptVisual type={screen.visual} content={content} />
      <FlowLine value={content.simple_formula} />

      {content.example && (
        <div className="mt-8 max-w-4xl">
          <SectionLabel>مثال بسيط</SectionLabel>
          <p className="text-sm font-semibold leading-8 text-stone-700">{content.example}</p>
        </div>
      )}

      {arr(content.examples).length > 0 && (
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {content.examples.map((item, index) => (
            <QuietPanel key={index} className="p-4 text-sm font-semibold leading-8 text-stone-700">{item}</QuietPanel>
          ))}
        </div>
      )}

      <QuranEvidence evidence={content.quran_evidence} />
      <BacRecognition value={content.how_to_recognize} />
      <MemoryWord word={content.memory_word} />
      <div className="mt-8"><Takeaway value={content.takeaway} /></div>
    </div>
  );
}

function MemoryRenderer({ content }) {
  const [hidden, setHidden] = useState(false);
  return (
    <div className="space-y-8">
      <TeacherText value={content.teacher} />
      <div className="flex justify-end">
        <SoftButton onClick={() => setHidden((v) => !v)} active={hidden}>
          <Eye size={15} /> {hidden ? "اكشف الكلمات" : "اختبر ذاكرتي"}
        </SoftButton>
      </div>
      <div className="divide-y divide-stone-200 overflow-hidden rounded-3xl border border-stone-200 bg-white">
        {arr(content.memory_story).map((item, index) => (
          <div key={index} className="grid grid-cols-[52px_110px_1fr] items-center gap-3 px-4 py-4 sm:grid-cols-[64px_150px_1fr] sm:px-6">
            <span className="text-xs font-black text-stone-300">0{index + 1}</span>
            <span className="text-lg font-black text-emerald-900">{hidden ? "؟" : item.word}</span>
            <span className="text-sm font-bold leading-7 text-stone-700">{hidden ? (content.recall_placeholder || "حاول استرجاع الفكرة") : item.means}</span>
          </div>
        ))}
      </div>
      {content.recall_sentence && <Emphasis><p className="text-sm font-black leading-8">{content.recall_sentence}</p></Emphasis>}
      {content.practice && <p className="text-sm font-semibold leading-8 text-stone-600">{content.practice}</p>}
      <Takeaway value={content.takeaway} />
    </div>
  );
}

function BacMethodRenderer({ content }) {
  return (
    <div className="space-y-8">
      <TeacherText value={content.teacher} />
      <div className="space-y-4">
        {arr(content.steps).map((item, index) => (
          <div key={index} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-950 text-xs font-black text-white">{index + 1}</span>
            <p className="pt-1 text-sm font-bold leading-7 text-stone-700">{item}</p>
          </div>
        ))}
      </div>

      {arr(content.recognition_keys).length > 0 && (
        <QuietPanel>
          <SectionLabel>مفاتيح سريعة</SectionLabel>
          <div className="divide-y divide-stone-100">
            {content.recognition_keys.map((row, index) => (
              <div key={index} className="grid gap-2 py-3 sm:grid-cols-[1fr_220px]">
                <span className="text-sm font-semibold text-stone-600">{row.clue}</span>
                <span className="text-sm font-black text-emerald-900">{row.answer}</span>
              </div>
            ))}
          </div>
        </QuietPanel>
      )}

      {content.bac_answer_template && (
        <Emphasis>
          <p className="text-[11px] font-black text-emerald-300">قالب الإجابة</p>
          <p className="mt-2 text-lg font-black leading-8">{content.bac_answer_template}</p>
        </Emphasis>
      )}
      <Takeaway value={content.takeaway} />
    </div>
  );
}

function ComparisonRenderer({ content }) {
  return (
    <div className="space-y-8">
      <TeacherText value={content.teacher} />
      <div className="divide-y divide-stone-200 overflow-hidden rounded-3xl border border-stone-200 bg-white">
        {arr(content.comparisons).map((item, index) => (
          <div key={index} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-sm font-black">
              <span className="text-emerald-900">{item.a}</span>
              <span className="text-stone-300">≠</span>
              <span className="text-stone-900">{item.b}</span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-8 text-stone-600">{item.difference}</p>
          </div>
        ))}
      </div>
      <Takeaway value={content.takeaway} />
    </div>
  );
}

function ActiveRecallRenderer({ screen }) {
  const [visible, setVisible] = useState({});
  const revealAll = Object.keys(visible).length === arr(screen.items).length;

  const toggle = (index) => setVisible((v) => ({ ...v, [index]: !v[index] }));
  const toggleAll = () => {
    if (revealAll) return setVisible({});
    const next = {};
    arr(screen.items).forEach((_, i) => { next[i] = true; });
    setVisible(next);
  };

  return (
    <div className="space-y-7">
      <p className="max-w-3xl text-base font-semibold leading-8 text-stone-600">{screen.subtitle}</p>
      <div className="flex justify-end"><SoftButton onClick={toggleAll}>{revealAll ? "أخفِ الإجابات" : "اكشف الجميع"}</SoftButton></div>
      <div className="divide-y divide-stone-200 overflow-hidden rounded-3xl border border-stone-200 bg-white">
        {arr(screen.items).map((item, index) => (
          <button
            type="button"
            onClick={() => toggle(index)}
            key={index}
            className="grid w-full grid-cols-[44px_110px_1fr] items-center gap-3 px-4 py-4 text-right transition hover:bg-stone-50 sm:grid-cols-[60px_150px_1fr] sm:px-6"
          >
            <span className="text-xs font-black text-stone-300">0{index + 1}</span>
            <span className="text-lg font-black text-emerald-900">{item.word}</span>
            <span className={cn("text-sm font-bold leading-7", visible[index] ? "text-stone-800" : "text-stone-300")}>
              {visible[index] ? item.answer : "اضغط بعد أن تحاول التذكر"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TeachBackRenderer({ screen }) {
  const [text, setText] = useState("");
  const [checks, setChecks] = useState({});
  return (
    <div className="space-y-7">
      <p className="max-w-3xl text-base font-semibold leading-8 text-stone-600">{screen.subtitle}</p>
      <QuietPanel>
        <p className="text-xs font-black text-emerald-800">اشرح الآن</p>
        <p className="mt-2 text-lg font-black leading-8 text-stone-950">{screen.prompt}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="اكتب شرحك هنا من ذاكرتك..."
          className="mt-5 w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm font-semibold leading-8 text-stone-800 outline-none transition focus:border-emerald-700 focus:bg-white"
        />
        <p className="mt-2 text-left text-[11px] font-bold text-stone-400">{text.trim().length} حرف</p>
      </QuietPanel>

      <div>
        <SectionLabel>راجع شرحك بنفسك</SectionLabel>
        <div className="space-y-2">
          {arr(screen.checkpoints).map((item, index) => (
            <button
              type="button"
              key={index}
              onClick={() => setChecks((c) => ({ ...c, [index]: !c[index] }))}
              className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-right transition hover:bg-white"
            >
              <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", checks[index] ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-300 bg-white")}>{checks[index] && <Check size={12} />}</span>
              <span className="text-sm font-bold leading-7 text-stone-700">{item}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpacedReviewRenderer({ screen }) {
  return (
    <div className="space-y-7">
      <p className="max-w-3xl text-base font-semibold leading-8 text-stone-600">{screen.subtitle}</p>
      <div className="space-y-0">
        {arr(screen.schedule).map((item, index) => (
          <div key={index} className="grid grid-cols-[32px_1fr] gap-4">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-3 w-3 rounded-full border-[3px] border-emerald-800 bg-[#f7f6f2]" />
              {index < screen.schedule.length - 1 && <span className="h-full w-px bg-stone-200" />}
            </div>
            <div className="pb-7">
              <p className="text-xs font-black text-emerald-800">{item.when}</p>
              <p className="mt-1 text-sm font-bold leading-7 text-stone-700">{item.task}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryRenderer({ content }) {
  const sections = arr(content.sections);

  if (sections.length > 0) {
    return (
      <div className="space-y-8">
        <div className="grid gap-5 lg:grid-cols-2">
          {sections.map((section, index) => (
            <QuietPanel key={section.id || section.title || index}>
              <SectionLabel>{section.title || `المحور ${index + 1}`}</SectionLabel>
              <div className="space-y-2">
                {arr(section.items).map((item, itemIndex) => (
                  <p key={itemIndex} className="text-sm font-bold leading-7 text-stone-700">
                    {itemIndex + 1}. {textOf(item)}
                  </p>
                ))}
              </div>
            </QuietPanel>
          ))}
        </div>

        {content.golden_chain && (
          <Emphasis>
            <p className="text-[11px] font-black text-emerald-300">سلسلة الحفظ</p>
            <p className="mt-2 text-base font-black leading-8">{content.golden_chain}</p>
          </Emphasis>
        )}

        {content.exam_rule && (
          <p className="text-sm font-black leading-8 text-emerald-900">
            قاعدة الامتحان: {content.exam_rule}
          </p>
        )}

        <Takeaway value={content.takeaway} />
      </div>
    );
  }

  // Backward compatibility with lesson 1 JSON.
  return (
    <div className="space-y-8">
      {content.definition && (
        <div>
          <SectionLabel>التعريف</SectionLabel>
          <p className="text-lg font-black leading-9 text-stone-950">{content.definition}</p>
        </div>
      )}
      <Divider />
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionLabel>أهمية العقيدة</SectionLabel>
          <div className="space-y-2">
            {arr(content.importance).map((item, index) => (
              <p key={index} className="text-sm font-bold leading-7 text-stone-700">
                {index + 1}. {item}
              </p>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>الوسائل الثماني</SectionLabel>
          <div className="space-y-2">
            {arr(content.means_8).map((item, index) => (
              <p key={index} className="text-sm font-bold leading-7 text-stone-700">
                {index + 1}. {item}
              </p>
            ))}
          </div>
        </div>
      </div>
      {content.golden_chain && (
        <Emphasis>
          <p className="text-[11px] font-black text-emerald-300">السلسلة الذهبية</p>
          <p className="mt-2 text-base font-black leading-8">{content.golden_chain}</p>
        </Emphasis>
      )}
      {content.exam_rule && (
        <p className="text-sm font-black leading-8 text-emerald-900">
          قاعدة الامتحان: {content.exam_rule}
        </p>
      )}
      <Takeaway value={content.takeaway} />
    </div>
  );
}

function QuizRenderer({ content }) {
  const [revealed, setRevealed] = useState({});
  const [mastered, setMastered] = useState({});
  const score = Object.values(mastered).filter(Boolean).length;
  const total = arr(content.questions).length;

  return (
    <div className="space-y-7">
      {content.instructions && <p className="text-base font-semibold leading-8 text-stone-600">{content.instructions}</p>}
      <div className="space-y-3">
        {arr(content.questions).map((q, index) => (
          <QuietPanel key={q.id || index}>
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-black text-stone-500">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-black leading-8 text-stone-950">{q.question}</p>
                {!revealed[index] ? (
                  <button type="button" onClick={() => setRevealed((r) => ({ ...r, [index]: true }))} className="mt-4 text-sm font-black text-emerald-800 hover:text-emerald-950">اكشف الإجابة</button>
                ) : (
                  <div className="mt-4 border-t border-stone-100 pt-4">
                    <p className="text-sm font-semibold leading-8 text-stone-700">{q.answer}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <SoftButton active={mastered[index] === true} onClick={() => setMastered((m) => ({ ...m, [index]: true }))}><CheckCircle2 size={15} /> عرفتها</SoftButton>
                      <SoftButton active={mastered[index] === false} onClick={() => setMastered((m) => ({ ...m, [index]: false }))}><RotateCcw size={15} /> أراجعها</SoftButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </QuietPanel>
        ))}
      </div>
      <Emphasis>
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-[11px] font-black text-emerald-300">إتقانك الحالي</p><p className="mt-1 text-2xl font-black">{score} / {total}</p></div>
          <Trophy size={28} className="text-emerald-300" />
        </div>
        {content.mastery_rule && <p className="mt-4 text-sm font-semibold leading-7 text-stone-300">{content.mastery_rule}</p>}
      </Emphasis>
    </div>
  );
}

/* =========================================================
   Fallback renderer for any extra JSON fields
========================================================= */

function GenericValue({ value, depth = 0 }) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <p className="text-sm font-semibold leading-8 text-stone-700">{String(value)}</p>;
  }
  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className={cn(depth === 0 && "rounded-2xl border border-stone-200 bg-white p-4")}>
            <GenericValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <div className="space-y-3">
        {Object.entries(value).map(([key, val]) => (
          <div key={key}>
            <p className="mb-1 text-[11px] font-black text-stone-400">{key.replaceAll("_", " ")}</p>
            <GenericValue value={val} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function ExtraFields({ content }) {
  const extras = Object.entries(content || {}).filter(([key]) => !EXCLUDED_GENERIC_KEYS.has(key));
  if (!extras.length) return null;
  return (
    <details className="mt-10 rounded-3xl border border-stone-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-black text-stone-700">معلومات إضافية من ملف الدرس</summary>
      <div className="mt-5 space-y-5">
        {extras.map(([key, value]) => (
          <div key={key}>
            <SectionLabel>{key.replaceAll("_", " ")}</SectionLabel>
            <GenericValue value={value} />
          </div>
        ))}
      </div>
    </details>
  );
}


/* =========================================================
   Mastery interactions: micro recall + BAC challenge
========================================================= */

function MicroRecallRenderer({ screen }) {
  const [revealed, setRevealed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const pairs = arr(screen?.pairs);
  const answers = arr(screen?.answers);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-[32px] border border-stone-200 bg-white p-6 sm:p-9">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-950 text-white">
            <Brain size={19} />
          </span>
          <div>
            <p className="text-[11px] font-black text-emerald-800">استرجاع نشط</p>
            <h3 className="mt-1 text-xl font-black text-stone-950">{screen?.title || "بدون النظر"}</h3>
          </div>
        </div>

        <p className="mt-6 text-lg font-black leading-9 text-stone-800">{screen?.prompt}</p>
        <p className="mt-2 text-sm font-semibold leading-7 text-stone-500">
          حاول قول الإجابة بصوتك أو كتابتها على ورقة، ثم اكشف الحل.
        </p>

        {pairs.length > 0 && (
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {pairs.map((item, index) => (
              <div key={`${item.cue}-${index}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-black text-stone-400">كلمة الذاكرة</p>
                <p className="mt-2 text-2xl font-black text-stone-950">{item.cue}</p>
                <div className="mt-4 min-h-14 border-t border-dashed border-stone-300 pt-4">
                  {revealed ? (
                    <p className="text-sm font-black leading-7 text-emerald-900">{item.answer}</p>
                  ) : (
                    <p className="text-sm font-bold text-stone-300">ما الوسيلة؟</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {answers.length > 0 && revealed && (
          <div className="mt-7 space-y-2">
            {answers.map((answer, index) => (
              <p key={index} className="flex gap-2 text-sm font-semibold leading-8 text-stone-700">
                <CheckCircle2 size={16} className="mt-1.5 shrink-0 text-emerald-800" />
                {answer}
              </p>
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          {!attempted && (
            <button type="button" onClick={() => setAttempted(true)} className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-black text-stone-800 hover:bg-stone-50">
              حاولت من ذاكرتي
            </button>
          )}
          <button
            type="button"
            disabled={!attempted}
            onClick={() => setRevealed((v) => !v)}
            className={cn(
              "rounded-full px-5 py-3 text-sm font-black transition",
              attempted ? "bg-stone-950 text-white hover:bg-stone-800" : "cursor-not-allowed bg-stone-100 text-stone-400",
            )}
          >
            {revealed ? "أخفِ الإجابة" : "اكشف الإجابة"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BacChallengeRenderer({ screen }) {
  const questions = arr(screen?.questions);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});

  const correctCount = questions.reduce((n, q) => n + (checked[q.id] && answers[q.id] === q.answer ? 1 : 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="mb-8">
        <p className="text-[11px] font-black text-emerald-800">تطبيق امتحاني</p>
        <h3 className="mt-2 text-2xl font-black text-stone-950">{screen?.title || "تحدي البكالوريا"}</h3>
      </div>

      {questions.map((q, index) => {
        const isChecked = Boolean(checked[q.id]);
        const isCorrect = answers[q.id] === q.answer;
        return (
          <div key={q.id} className="rounded-[28px] border border-stone-200 bg-white p-5 sm:p-7">
            <div className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-950 text-xs font-black text-white">{index + 1}</span>
              <p className="text-base font-black leading-8 text-stone-900">{q.prompt}</p>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {arr(q.options).map((option) => {
                const selected = answers[q.id] === option;
                const showRight = isChecked && option === q.answer;
                const showWrong = isChecked && selected && option !== q.answer;
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => !isChecked && setAnswers((prev) => ({ ...prev, [q.id]: option }))}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-right text-sm font-bold leading-7 transition",
                      showRight ? "border-emerald-700 bg-emerald-50 text-emerald-950" :
                      showWrong ? "border-rose-300 bg-rose-50 text-rose-900" :
                      selected ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!answers[q.id] || isChecked}
                onClick={() => setChecked((prev) => ({ ...prev, [q.id]: true }))}
                className={cn(
                  "rounded-full px-4 py-2.5 text-xs font-black",
                  answers[q.id] && !isChecked ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-400",
                )}
              >
                تحقق من الإجابة
              </button>
              {isChecked && (
                <span className={cn("text-xs font-black", isCorrect ? "text-emerald-800" : "text-rose-700")}>
                  {isCorrect ? "إجابة صحيحة" : `الصحيح: ${q.answer}`}
                </span>
              )}
            </div>

            {isChecked && q.why && (
              <div className="mt-5 border-r-2 border-emerald-700 pr-4 text-sm font-semibold leading-8 text-stone-700">
                <strong className="text-stone-950">لماذا؟ </strong>{q.why}
              </div>
            )}
          </div>
        );
      })}

      {questions.length > 0 && Object.keys(checked).length === questions.length && (
        <div className="rounded-3xl bg-stone-950 p-5 text-white">
          <p className="text-xs font-black text-emerald-300">نتيجة التطبيق</p>
          <p className="mt-2 text-xl font-black">{correctCount} / {questions.length}</p>
        </div>
      )}
    </div>
  );
}

function PhaseRail({ phases, phaseIndex, completedPhases, onSelect }) {
  return (
    <div className="sticky top-0 z-30 border-b border-stone-200 bg-[#f7f6f2]/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 overflow-x-auto py-3">
          {phases.map((phase, i) => {
            const active = i === phaseIndex;
            const done = completedPhases.has(i);
            const accessible = i <= phaseIndex || done;
            return (
              <button
                key={phase.id}
                type="button"
                disabled={!accessible}
                onClick={() => accessible && onSelect(i)}
                className={cn(
                  "flex min-w-max items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition",
                  active ? "bg-stone-950 text-white" : done ? "text-emerald-900 hover:bg-white" : "text-stone-400",
                  !accessible && "cursor-not-allowed opacity-50",
                )}
              >
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border text-[10px]", active ? "border-white/25" : "border-stone-300 bg-white")}>{done && !active ? <Check size={11}/> : phase.number}</span>
                {phase.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PhaseIntro({ phase, itemIndex, itemCount }) {
  return (
    <div className="mx-auto mb-2 max-w-5xl pt-7 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <p className="text-[11px] font-black text-emerald-800">المرحلة {phase.number} من 05 · {phase.label}</p>
          <h2 className="mt-2 text-xl font-black text-stone-950 sm:text-2xl">{phase.title}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-stone-500">{phase.description}</p>
        </div>
        <div className="flex gap-1.5" aria-label="تقدم المرحلة">
          {Array.from({ length: itemCount }).map((_, i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-all", i === itemIndex ? "w-8 bg-stone-950" : i < itemIndex ? "w-4 bg-emerald-700" : "w-4 bg-stone-200")} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Main screen resolver
========================================================= */

function ScreenContent({ screen, step }) {
  const content = step?.content || {};

  if (screen.kind === "opening") return <OpeningRenderer content={content} />;
  if (screen.kind === "definition") return <DefinitionRenderer content={content} />;
  if (screen.kind === "importance") return <ImportanceRenderer content={content} />;
  if (screen.kind === "overview") return <OverviewRenderer content={content} />;
  if (screen.kind === "mean") return <MeanRenderer screen={screen} content={content} />;
  if (screen.kind === "memory") return <MemoryRenderer content={content} />;
  if (screen.kind === "bac_method") return <BacMethodRenderer content={content} />;
  if (screen.kind === "comparison") return <ComparisonRenderer content={content} />;
  if (screen.kind === "active_recall") return <ActiveRecallRenderer screen={screen} />;
  if (screen.kind === "micro_recall") return <MicroRecallRenderer screen={screen} />;
  if (screen.kind === "bac_challenge") return <BacChallengeRenderer screen={screen} />;
  if (screen.kind === "teach_back") return <TeachBackRenderer screen={screen} />;
  if (screen.kind === "spaced_review") return <SpacedReviewRenderer screen={screen} />;
  if (screen.kind === "summary") return <SummaryRenderer content={content} />;
  if (screen.kind === "quiz") return <QuizRenderer content={content} />;

  return <GenericValue value={content} />;
}

function FocusStage({ screen, step }) {
  return (
    <section className="mx-auto w-full max-w-5xl py-8 sm:py-12 lg:py-14">
      <FocusHeading screen={screen} step={step} />
      <ScreenContent screen={screen} step={step} />
      {step?.content && <ExtraFields content={step.content} />}
    </section>
  );
}

/* =========================================================
   Overview drawer
========================================================= */

function OverviewDrawer({ open, onClose, lesson, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="إغلاق" onClick={onClose} className="absolute inset-0 bg-stone-950/25 backdrop-blur-sm" />
      <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-[11px] font-black text-emerald-800">معلومات الدرس</p><h2 className="mt-1 text-lg font-black text-stone-950">{title}</h2></div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200"><X size={18} /></button>
        </div>

        <div className="mt-8 space-y-7">
          {lesson.lesson_goal && <div><SectionLabel>هدف الدرس</SectionLabel><p className="text-sm font-semibold leading-8 text-stone-700">{lesson.lesson_goal}</p></div>}
          {arr(lesson.prerequisites).length > 0 && <div><SectionLabel>ما تحتاجه قبل البدء</SectionLabel><div className="space-y-2">{lesson.prerequisites.map((x,i)=><p key={i} className="text-sm font-semibold leading-7 text-stone-700">• {x}</p>)}</div></div>}
          {arr(lesson.learning_outcomes).length > 0 && <div><SectionLabel>بعد الدرس تستطيع</SectionLabel><div className="space-y-2">{lesson.learning_outcomes.map((x,i)=><p key={i} className="flex gap-2 text-sm font-semibold leading-7 text-stone-700"><CheckCircle2 size={15} className="mt-1.5 shrink-0 text-emerald-800" />{x}</p>)}</div></div>}
          {lesson.figure_policy && <div><SectionLabel>سياسة الرسومات</SectionLabel><p className="text-sm font-semibold leading-8 text-stone-600">{lesson.figure_policy}</p></div>}
        </div>
      </aside>
    </div>
  );
}

/* =========================================================
   Main component
========================================================= */

export default function IslamicLessonMastery10({ data, onComplete }) {
  const lesson = normalizeLesson(data);
  const title = getTitle(data, lesson);
  const experience = lesson?.mastery_experience;
  const phases = arr(experience?.phases);
  const steps = useMemo(() => stepIndexById(lesson), [lesson]);

  const [started, setStarted] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [completedPhases, setCompletedPhases] = useState(new Set());
  const stageRef = useRef(null);

  if (!lesson) {
    return <div dir="rtl" className="p-8 text-center font-bold text-stone-600">لا توجد بيانات للدرس.</div>;
  }

  if (!experience || phases.length === 0) {
    return (
      <div dir="rtl" className="mx-auto max-w-3xl p-8">
        <QuietPanel>
          <p className="font-black text-stone-950">هذا الملف لا يحتوي على mastery_experience.</p>
          <p className="mt-2 text-sm font-semibold leading-7 text-stone-600">استخدم ملف JSON المرفق مع هذا المكوّن.</p>
        </QuietPanel>
      </div>
    );
  }

  const phase = phases[phaseIndex];
  const items = arr(phase?.items);
  const current = items[itemIndex] || items[0];
  const currentStep = current?.ref ? steps.get(current.ref) : null;

  const scrollTop = () => requestAnimationFrame(() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  const goPhase = (nextPhase) => {
    const safe = Math.max(0, Math.min(nextPhase, phases.length - 1));
    setPhaseIndex(safe);
    setItemIndex(0);
    scrollTop();
  };

  const next = () => {
    if (itemIndex < items.length - 1) {
      setItemIndex((v) => v + 1);
      scrollTop();
      return;
    }

    setCompletedPhases((prev) => {
      const nextSet = new Set(prev);
      nextSet.add(phaseIndex);
      return nextSet;
    });

    if (phaseIndex < phases.length - 1) {
      setPhaseIndex((v) => v + 1);
      setItemIndex(0);
      scrollTop();
    } else {
      onComplete?.();
    }
  };

  const previous = () => {
    if (itemIndex > 0) {
      setItemIndex((v) => v - 1);
      scrollTop();
      return;
    }
    if (phaseIndex > 0) {
      const prevPhase = phases[phaseIndex - 1];
      setPhaseIndex((v) => v - 1);
      setItemIndex(Math.max(0, arr(prevPhase?.items).length - 1));
      scrollTop();
    }
  };

  const isFirst = phaseIndex === 0 && itemIndex === 0;
  const isLast = phaseIndex === phases.length - 1 && itemIndex === items.length - 1;

  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f6f2] text-stone-950">
      <CourseHeader title={title} lesson={lesson} onOpenOverview={() => setOverviewOpen(true)} />

      {!started ? (
        <IntroScreen
          experience={experience}
          title={title}
          lesson={lesson}
          onStart={() => setStarted(true)}
          onOverview={() => setOverviewOpen(true)}
        />
      ) : (
        <>
          <PhaseRail phases={phases} phaseIndex={phaseIndex} completedPhases={completedPhases} onSelect={goPhase} />
          <main ref={stageRef} className="px-4 sm:px-6 lg:px-8">
            <PhaseIntro phase={phase} itemIndex={itemIndex} itemCount={items.length} />
            <FocusStage screen={current} step={currentStep} />
          </main>

          <footer className="border-t border-stone-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
              <SoftButton onClick={previous} disabled={isFirst}>
                <ArrowRight size={16} /> السابق
              </SoftButton>

              <div className="hidden text-center sm:block">
                <p className="text-[11px] font-black text-stone-400">{phase.label}</p>
                <p className="mt-1 text-xs font-bold text-stone-600">{current?.label || current?.nav_label || "محطة تعلم"}</p>
              </div>

              <button
                type="button"
                onClick={next}
                className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-black text-white transition hover:bg-stone-800"
              >
                {isLast ? "إنهاء الدرس" : itemIndex === items.length - 1 ? "المرحلة التالية" : "التالي"}
                {isLast ? <CheckCircle2 size={16} /> : <ArrowLeft size={16} />}
              </button>
            </div>
          </footer>
        </>
      )}

      <OverviewDrawer open={overviewOpen} onClose={() => setOverviewOpen(false)} lesson={lesson} title={title} />
    </div>
  );
}

