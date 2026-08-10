// src/components/ScienceLesson.jsx
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import axios from "axios";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Atom,
  Beaker,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Dna,
  Eye,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Loader2,
  Microscope,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Route,
  Sparkles,
  Target,
  TestTube2,
  Trophy,
  WandSparkles,
  X,
  XCircle,
  ZoomIn,
} from "lucide-react";

import { UserContext } from "../../Utils/UserContext";

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
  return (
    data?.axis || {
      id: data?.id ?? lesson?.axis_id ?? null,
      title:
        data?.title ||
        lesson?.axis_title ||
        lesson?.title ||
        "درس العلوم",
      tag:
        data?.tag ||
        lesson?.axis_tag ||
        "",
    }
  );
}

function getText(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object") {
    return (
      value.text ||
      value.description ||
      value.definition ||
      value.answer ||
      value.expected_answer ||
      value.label ||
      value.title ||
      value.term ||
      value.rule ||
      value.caption ||
      value.meaning ||
      ""
    );
  }

  return String(value);
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (isEmpty(value)) return [];
  return [value];
}

function normalizeChoice(choice) {
  if (typeof choice === "string") {
    return { label: choice, value: choice };
  }

  if (choice && typeof choice === "object") {
    return {
      label:
        choice.label ||
        choice.text ||
        choice.value ||
        choice.answer ||
        "",
      value:
        choice.value ||
        choice.label ||
        choice.text ||
        choice.answer ||
        "",
    };
  }

  return {
    label: String(choice ?? ""),
    value: String(choice ?? ""),
  };
}

function normalizeQuestions(content = {}) {
  const source =
    content.questions ||
    content.items ||
    content.quick_questions ||
    [];

  return Array.isArray(source) ? source.filter(Boolean) : [];
}

function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ar");
}

function isCorrectChoice(question, value) {
  const expected =
    question?.correct_answer ??
    question?.answer ??
    question?.expected_answer ??
    "";

  return normalizeComparable(value) === normalizeComparable(expected);
}

function scrollToLessonTop() {
  window.requestAnimationFrame(() => {
    document
      .getElementById("science-course-card-top")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  });
}

/* =========================================================
   Shared UI
========================================================= */

function SectionHeader({
  eyebrow,
  title,
  description,
  icon: Icon = BookOpen,
  tone = "emerald",
}) {
  const tones = {
    emerald: {
      icon: "from-emerald-500 to-teal-600",
      eyebrow: "text-emerald-700",
      bg: "from-emerald-50 via-white to-white",
      border: "border-emerald-100",
    },
    sky: {
      icon: "from-sky-500 to-cyan-600",
      eyebrow: "text-sky-700",
      bg: "from-sky-50 via-white to-white",
      border: "border-sky-100",
    },
    violet: {
      icon: "from-violet-500 to-indigo-600",
      eyebrow: "text-violet-700",
      bg: "from-violet-50 via-white to-white",
      border: "border-violet-100",
    },
    amber: {
      icon: "from-amber-500 to-orange-600",
      eyebrow: "text-amber-700",
      bg: "from-amber-50 via-white to-white",
      border: "border-amber-100",
    },
    rose: {
      icon: "from-rose-500 to-red-600",
      eyebrow: "text-rose-700",
      bg: "from-rose-50 via-white to-white",
      border: "border-rose-100",
    },
  };

  const current = tones[tone] || tones.emerald;

  return (
    <div
      className={cn(
        "mb-5 flex items-start gap-4 rounded-[24px] border bg-gradient-to-l p-4 sm:p-5",
        current.bg,
        current.border,
      )}
    >
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
          current.icon,
        )}
      >
        <Icon size={22} />
      </span>

      <div className="min-w-0">
        {eyebrow && (
          <p
            className={cn(
              "mb-1 text-[11px] font-black tracking-[0.12em]",
              current.eyebrow,
            )}
          >
            {eyebrow}
          </p>
        )}

        <h2 className="text-xl font-black leading-8 text-slate-950 sm:text-[26px]">
          {title}
        </h2>

        {description && (
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-7 text-slate-500">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  title,
  children,
  tone = "emerald",
  icon: Icon = Lightbulb,
}) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    sky: "border-sky-200 bg-sky-50 text-sky-950",
    violet: "border-violet-200 bg-violet-50 text-violet-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  };

  return (
    <div
      className={cn(
        "rounded-[22px] border p-4 shadow-sm sm:p-5",
        tones[tone] || tones.emerald,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm">
          <Icon size={17} />
        </span>

        <div className="min-w-0 flex-1">
          {title && (
            <h3 className="mb-1 text-sm font-black">
              {title}
            </h3>
          )}

          <div className="text-sm font-semibold leading-7">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function BulletCards({
  items,
  icon: Icon = CheckCircle2,
  tone = "emerald",
}) {
  const colors = {
    emerald: "text-emerald-600 bg-emerald-50",
    sky: "text-sky-600 bg-sky-50",
    violet: "text-violet-600 bg-violet-50",
    amber: "text-amber-600 bg-amber-50",
    rose: "text-rose-600 bg-rose-50",
  };

  const list = toArray(items);
  if (list.length === 0) return null;

  return (
    <div className="space-y-3">
      {list.map((item, index) => {
        const text = getText(item);
        if (!text) return null;

        return (
          <div
            key={`${text}-${index}`}
            className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                colors[tone] || colors.emerald,
              )}
            >
              <Icon size={16} />
            </span>

            <p className="text-sm font-semibold leading-7 text-slate-700">
              {text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Reveal({
  title,
  children,
  defaultOpen = false,
  tone = "emerald",
}) {
  const [open, setOpen] = useState(defaultOpen);

  const tones = {
    emerald: "border-emerald-200 bg-emerald-50/60",
    sky: "border-sky-200 bg-sky-50/60",
    violet: "border-violet-200 bg-violet-50/60",
    amber: "border-amber-200 bg-amber-50/60",
    rose: "border-rose-200 bg-rose-50/60",
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[22px] border",
        tones[tone] || tones.emerald,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right font-black"
      >
        <span>{title}</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300",
          open
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-current/10 bg-white/65 p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Scientific scene
========================================================= */

function CellScene({
  highlighted = [],
  compact = false,
  radiation = false,
}) {
  const isActive = (id) => highlighted.includes(id);

  return (
    <div
      className={cn(
        "relative mx-auto overflow-hidden rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 shadow-inner",
        compact ? "h-[280px]" : "h-[360px] sm:h-[420px]",
      )}
    >
      <div className="absolute left-1/2 top-1/2 h-[78%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-[48%] border-[5px] border-emerald-300 bg-emerald-100/55 shadow-[inset_0_0_50px_rgba(16,185,129,0.13)]">
        <span className="absolute right-5 top-4 rounded-full bg-white/85 px-3 py-1 text-[11px] font-black text-emerald-800 shadow-sm">
          الخلية
        </span>

        <div
          className={cn(
            "absolute left-[15%] top-[24%] h-[44%] w-[36%] rounded-full border-4 bg-violet-100 shadow-[inset_0_0_28px_rgba(139,92,246,0.15)] transition-all duration-500",
            isActive("nucleus")
              ? "scale-105 border-violet-500 ring-8 ring-violet-200/60"
              : "border-violet-300",
          )}
        >
          <span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-violet-800">
            النواة
          </span>

          <div
            className={cn(
              "absolute left-1/2 top-[55%] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 transition-all duration-500",
              isActive("dna") || isActive("gene")
                ? "scale-110"
                : "",
            )}
          >
            <div className="relative h-20 w-20">
              {Array.from({ length: 7 }).map((_, index) => (
                <div
                  key={index}
                  className="absolute left-1/2 top-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${index * 25}deg)`,
                    background:
                      index === 3 && isActive("gene")
                        ? "#f59e0b"
                        : index % 2 === 0
                          ? "#7c3aed"
                          : "#38bdf8",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "absolute bottom-[17%] right-[13%] rounded-3xl border bg-cyan-50/90 px-5 py-4 transition-all duration-500",
            isActive("cytoplasm")
              ? "scale-105 border-cyan-500 ring-8 ring-cyan-200/60"
              : "border-cyan-200",
          )}
        >
          <span className="font-black text-cyan-900">
            الهيولى
          </span>
        </div>

        {radiation && (
          <div className="absolute inset-0">
            {[
              [68, 31],
              [73, 39],
              [61, 48],
              [78, 55],
              [67, 61],
              [82, 44],
              [57, 37],
              [72, 69],
            ].map(([left, top], index) => (
              <span
                key={index}
                className="absolute h-3 w-3 animate-pulse rounded-full bg-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.8)]"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  animationDelay: `${index * 120}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   1. Discovery / Problem
========================================================= */

function DiscoveryQuestionStep({
  content = {},
  onNext,
}) {
  const question =
    content.question ||
    content.central_question ||
    content.problem ||
    content.teacher ||
    "ما الظاهرة التي سنحاول تفسيرها؟";

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-100 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-cyan-100 blur-3xl" />

        <div className="relative">
          <SectionHeader
            eyebrow="ابدأ بالسؤال"
            title="لاحظ قبل أن تحفظ"
            description="في العلوم نبدأ بالمشكلة أو الظاهرة، ثم نبني التفسير."
            icon={CircleHelp}
            tone="emerald"
          />

          <div className="mx-auto max-w-3xl rounded-[26px] bg-gradient-to-l from-slate-950 via-emerald-950 to-teal-950 px-5 py-7 text-center text-white shadow-xl sm:px-8">
            <CircleHelp
              className="mx-auto mb-4 text-emerald-300"
              size={36}
            />

            <p className="text-lg font-black leading-9 sm:text-2xl sm:leading-10">
              {question}
            </p>
          </div>

          {content.teacher && content.teacher !== question && (
            <p className="mx-auto mt-5 max-w-3xl text-center text-sm font-semibold leading-8 text-slate-600">
              {content.teacher}
            </p>
          )}

          {content.visual_hint && (
            <div className="mt-6">
              <CellScene
                highlighted={["nucleus"]}
                compact
              />
            </div>
          )}

          {content.action?.label && onNext && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onNext}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-600 px-6 font-black text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5"
              >
                <Sparkles size={18} />
                {content.action.label}
                <ArrowLeft size={18} />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   2. Scientific animation
========================================================= */

function ScientificAnimationStep({
  content = {},
}) {
  const frames = Array.isArray(content.frames)
    ? content.frames.filter(Boolean)
    : [];

  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || frames.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current >= frames.length - 1) {
          setPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, 1600);

    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  useEffect(() => {
    setFrameIndex(0);
    setPlaying(false);
  }, [content]);

  const currentFrame = frames[frameIndex] || {};
  const highlighted =
    currentFrame.highlight ||
    currentFrame.highlights ||
    [];

  function previous() {
    setPlaying(false);
    setFrameIndex((current) => Math.max(0, current - 1));
  }

  function next() {
    setPlaying(false);
    setFrameIndex((current) =>
      Math.min(frames.length - 1, current + 1),
    );
  }

  function restart() {
    setPlaying(false);
    setFrameIndex(0);
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="مشاهدة الظاهرة"
        title={content.title || "شاهد ما يحدث خطوة بخطوة"}
        description={
          content.instruction ||
          "استعمل السابق والتشغيل والتالي بدل قراءة فقرة طويلة."
        }
        icon={Play}
        tone="sky"
      />

      <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
        <section className="rounded-[28px] border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <CellScene highlighted={highlighted} />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={previous}
              disabled={frameIndex === 0}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-40"
            >
              <ArrowRight size={17} />
              السابق
            </button>

            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              disabled={frames.length <= 1}
              className="inline-flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-black text-white shadow-lg shadow-sky-500/20 disabled:opacity-40"
            >
              {playing ? (
                <>
                  <Pause size={17} />
                  إيقاف
                </>
              ) : (
                <>
                  <Play size={17} />
                  تشغيل
                </>
              )}
            </button>

            <button
              type="button"
              onClick={next}
              disabled={frameIndex >= frames.length - 1}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-40"
            >
              التالي
              <ArrowLeft size={17} />
            </button>

            <button
              type="button"
              onClick={restart}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600"
              title="إعادة"
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </section>

        <aside className="rounded-[28px] border border-sky-100 bg-gradient-to-b from-sky-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-black text-white">
              المرحلة {Math.min(frameIndex + 1, frames.length || 1)}
            </span>

            <span className="text-xs font-black text-slate-400">
              {frames.length || 1} مراحل
            </span>
          </div>

          <h3 className="mt-5 text-xl font-black leading-8 text-slate-950">
            {currentFrame.title || "المشهد العلمي"}
          </h3>

          <p className="mt-2 text-sm font-semibold leading-8 text-slate-600">
            {currentFrame.description ||
              "تابع الرسم ولاحظ تغير العناصر خطوة بخطوة."}
          </p>

          {frames.length > 0 && (
            <div className="mt-6 space-y-2">
              {frames.map((frame, index) => (
                <button
                  key={frame.id || index}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setFrameIndex(index);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-right transition",
                    index === frameIndex
                      ? "border-sky-300 bg-sky-50 text-sky-950"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black",
                      index === frameIndex
                        ? "bg-sky-600 text-white"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {index + 1}
                  </span>

                  <span className="truncate text-sm font-black">
                    {frame.title || `المرحلة ${index + 1}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      {content.takeaway && (
        <InfoCard
          title="ماذا نحتفظ؟"
          tone="emerald"
          icon={CheckCircle2}
        >
          {content.takeaway}
        </InfoCard>
      )}
    </div>
  );
}

/* =========================================================
   3. Short explanation
========================================================= */

function ShortExplanationStep({
  content = {},
}) {
  const blocks = Array.isArray(content.blocks)
    ? content.blocks.filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="تفسير قصير"
        title={content.title || "افهم الفكرة في دقائق"}
        description="بعد المشاهدة نثبت المعنى بعبارات قصيرة، وليس بفقرة طويلة."
        icon={Brain}
        tone="violet"
      />

      {blocks.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {blocks.map((block, index) => (
            <article
              key={block.id || index}
              className="rounded-[26px] border border-violet-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                  {index === 0 ? (
                    <Dna size={19} />
                  ) : (
                    <BookOpen size={19} />
                  )}
                </span>

                <h3 className="font-black text-slate-950">
                  {block.title || block.term || `الفكرة ${index + 1}`}
                </h3>
              </div>

              <p className="text-sm font-semibold leading-8 text-slate-600">
                {block.text ||
                  block.description ||
                  block.definition ||
                  ""}
              </p>
            </article>
          ))}
        </div>
      )}

      {content.teacher && (
        <InfoCard
          title="شرح مبسط"
          tone="violet"
          icon={Brain}
        >
          {content.teacher}
        </InfoCard>
      )}

      {content.attention && (
        <InfoCard
          title="انتبه"
          tone="rose"
          icon={AlertTriangle}
        >
          {content.attention}
        </InfoCard>
      )}

      {content.memory_tip && (
        <InfoCard
          title="طريقة سهلة للتذكر"
          tone="amber"
          icon={Lightbulb}
        >
          {content.memory_tip}
        </InfoCard>
      )}
    </div>
  );
}

/* =========================================================
   4. Interactive diagram
========================================================= */

function InteractiveDiagramStep({
  content = {},
}) {
  const diagram = content.diagram || content;
  const hotspots = Array.isArray(diagram.hotspots)
    ? diagram.hotspots.filter(Boolean)
    : Array.isArray(diagram.nodes)
      ? diagram.nodes.filter(Boolean)
      : [];

  const [activeId, setActiveId] = useState(
    hotspots[0]?.id || "",
  );

  useEffect(() => {
    setActiveId(hotspots[0]?.id || "");
  }, [content]);

  const active =
    hotspots.find((item) => String(item.id) === String(activeId)) ||
    hotspots[0] ||
    null;

  function highlightFor(item) {
    const key = normalizeComparable(
      `${item?.id || ""} ${item?.label || ""}`,
    );

    const result = [];

    if (key.includes("nucleus") || key.includes("نواة")) {
      result.push("nucleus");
    }

    if (key.includes("dna") || key.includes("adn")) {
      result.push("dna");
    }

    if (key.includes("gene") || key.includes("مورثة")) {
      result.push("gene");
    }

    if (
      key.includes("cytoplasm") ||
      key.includes("هيولى")
    ) {
      result.push("cytoplasm");
    }

    return result;
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="رسم قابل للاستكشاف"
        title={content.title || diagram.title || "اضغط واكتشف"}
        description={
          content.instruction ||
          diagram.instruction ||
          "اضغط على العنصر بدل حفظ أسماء الرسم دون فهم."
        }
        icon={ZoomIn}
        tone="emerald"
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-[28px] border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
          <CellScene
            highlighted={highlightFor(active)}
          />

          {hotspots.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {hotspots.map((item) => {
                const selected =
                  String(item.id) === String(active?.id);

                return (
                  <button
                    key={item.id || item.label}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-black transition",
                      selected
                        ? "border-emerald-300 bg-emerald-600 text-white shadow"
                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200",
                    )}
                  >
                    {item.label || item.title || "عنصر"}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="rounded-[28px] border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
            <Eye size={21} />
          </div>

          <p className="mt-4 text-xs font-black text-emerald-700">
            العنصر المحدد
          </p>

          <h3 className="mt-1 text-xl font-black text-slate-950">
            {active?.label || active?.title || "اختر عنصرًا"}
          </h3>

          <p className="mt-3 text-sm font-semibold leading-8 text-slate-600">
            {active?.description ||
              active?.role ||
              "اضغط على أحد العناصر لمعرفة دوره."}
          </p>
        </aside>
      </div>
    </div>
  );
}

/* =========================================================
   5. Key rule
========================================================= */

function KeyRuleStep({
  content = {},
}) {
  const rule =
    content.rule ||
    content.central_idea ||
    content.takeaway ||
    "";

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="قاعدة يجب تثبيتها"
        title={content.title || "الفكرة الأساسية"}
        description="بعد المشاهدة والتفسير نثبت قاعدة واحدة واضحة."
        icon={CheckCircle2}
        tone="emerald"
      />

      {rule && (
        <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-l from-emerald-700 via-teal-700 to-cyan-700 p-6 text-center text-white shadow-xl sm:p-8">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />

          <CheckCircle2
            size={36}
            className="relative mx-auto text-emerald-200"
          />

          <p className="relative mx-auto mt-4 max-w-3xl text-lg font-black leading-9 sm:text-2xl">
            {rule}
          </p>
        </div>
      )}

      {Array.isArray(content.do_not_confuse) &&
        content.do_not_confuse.length > 0 && (
          <InfoCard
            title="لا تخلط بين"
            tone="rose"
            icon={AlertTriangle}
          >
            <BulletCards
              items={content.do_not_confuse}
              icon={XCircle}
              tone="rose"
            />
          </InfoCard>
        )}
    </div>
  );
}

/* =========================================================
   Quiz engine
========================================================= */

function QuestionCard({
  question,
  index,
}) {
  const choices = toArray(question?.choices).map(normalizeChoice);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSelected("");
    setSubmitted(false);
  }, [question]);

  const correct =
    submitted && isCorrectChoice(question, selected);

  const expected =
    question?.correct_answer ??
    question?.answer ??
    question?.expected_answer ??
    "";

  const hasChoices = choices.length > 0;

  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black leading-8 text-slate-950">
            {question.question ||
              question.title ||
              "سؤال"}
          </h3>

          {hasChoices ? (
            <div className="mt-4 grid gap-2">
              {choices.map((choice, choiceIndex) => {
                const active =
                  normalizeComparable(selected) ===
                  normalizeComparable(choice.value);

                const choiceIsCorrect =
                  submitted &&
                  normalizeComparable(choice.value) ===
                    normalizeComparable(expected);

                const choiceIsWrong =
                  submitted &&
                  active &&
                  !choiceIsCorrect;

                return (
                  <button
                    key={`${choice.value}-${choiceIndex}`}
                    type="button"
                    disabled={submitted}
                    onClick={() => setSelected(choice.value)}
                    className={cn(
                      "flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right text-sm font-bold transition",
                      choiceIsCorrect
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                        : choiceIsWrong
                          ? "border-rose-300 bg-rose-50 text-rose-900"
                          : active
                            ? "border-sky-300 bg-sky-50 text-sky-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-sky-200",
                    )}
                  >
                    <span>{choice.label}</span>

                    {choiceIsCorrect && (
                      <CheckCircle2
                        size={18}
                        className="shrink-0 text-emerald-600"
                      />
                    )}

                    {choiceIsWrong && (
                      <XCircle
                        size={18}
                        className="shrink-0 text-rose-600"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={submitted}
              placeholder="اكتب إجابتك هنا..."
              className="mt-4 min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:border-sky-300 focus:bg-white"
            />
          )}

          {!submitted ? (
            <button
              type="button"
              disabled={!String(selected).trim()}
              onClick={() => setSubmitted(true)}
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={17} />
              تحقق
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <InfoCard
                title={correct ? "إجابة صحيحة" : "راجع الفكرة"}
                tone={correct ? "emerald" : "amber"}
                icon={correct ? CheckCircle2 : Lightbulb}
              >
                {question.explanation ||
                  question.feedback_correct ||
                  question.feedback_wrong ||
                  (!hasChoices
                    ? `الإجابة المنتظرة: ${expected}`
                    : correct
                      ? "أحسنت."
                      : `الإجابة الصحيحة: ${expected}`)}
              </InfoCard>

              {question.hint && !correct && (
                <Reveal
                  title="تلميح"
                  tone="amber"
                >
                  <p className="text-sm font-semibold leading-7 text-slate-700">
                    {question.hint}
                  </p>
                </Reveal>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelected("");
                  setSubmitted(false);
                }}
                className="inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-slate-900"
              >
                <RefreshCw size={14} />
                أعد المحاولة
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function QuickCheckStep({
  content = {},
  final = false,
}) {
  const questions = normalizeQuestions(content);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow={final ? "تقويم" : "تحقق سريع"}
        title={
          content.title ||
          (final ? "اختبار نهاية المحور" : "هل فهمت الفكرة؟")
        }
        description={
          content.instruction ||
          (final
            ? "اختبر فهمك بعد إكمال جميع مراحل المحور."
            : "سؤال أو سؤالان فقط قبل الانتقال.")
        }
        icon={final ? Trophy : Target}
        tone={final ? "amber" : "sky"}
      />

      <div className="space-y-4">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id || index}
            question={question}
            index={index}
          />
        ))}
      </div>

      {questions.length === 0 && (
        <InfoCard
          title="لا توجد أسئلة"
          tone="slate"
          icon={CircleHelp}
        >
          أضف مصفوفة <code>questions</code> إلى محتوى هذه المرحلة.
        </InfoCard>
      )}
    </div>
  );
}

/* =========================================================
   6. Experiment simulator
========================================================= */

function ExperimentSimulatorStep({
  content = {},
}) {
  const experiment = content.experiment || content;
  const phases = Array.isArray(experiment.steps)
    ? experiment.steps.filter(Boolean)
    : Array.isArray(experiment.protocol)
      ? experiment.protocol.filter(Boolean)
      : [];

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPhaseIndex(0);
    setPlaying(false);
  }, [content]);

  useEffect(() => {
    if (!playing || phases.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setPhaseIndex((current) => {
        if (current >= phases.length - 1) {
          setPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, 1800);

    return () => window.clearInterval(timer);
  }, [playing, phases.length]);

  const current = phases[phaseIndex] || {};
  const showRadiation =
    phaseIndex >= Math.max(phases.length - 1, 1) ||
    normalizeComparable(current.title).includes("كشف");

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="مختبر البكالوريا"
        title={
          content.title ||
          experiment.title ||
          experiment.name ||
          "جرّب ثم استنتج"
        }
        description={
          content.problem ||
          experiment.objective ||
          "نحول التجربة من فقرة محفوظة إلى مشهد تفاعلي."
        }
        icon={FlaskConical}
        tone="amber"
      />

      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-[30px] border border-amber-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-800">
              <Beaker size={18} />
              <span className="text-sm font-black">
                المحاكاة
              </span>
            </div>

            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">
              {phaseIndex + 1} / {Math.max(phases.length, 1)}
            </span>
          </div>

          <CellScene
            highlighted={
              showRadiation
                ? ["cytoplasm"]
                : phaseIndex === 0
                  ? []
                  : ["cytoplasm"]
            }
            radiation={showRadiation}
          />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={phaseIndex === 0}
              onClick={() => {
                setPlaying(false);
                setPhaseIndex((value) => Math.max(0, value - 1));
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-40"
            >
              <ArrowRight size={17} />
              السابق
            </button>

            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              className="inline-flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-black text-white shadow-lg shadow-amber-500/20"
            >
              {playing ? (
                <>
                  <Pause size={17} />
                  إيقاف
                </>
              ) : (
                <>
                  <Play size={17} />
                  تشغيل
                </>
              )}
            </button>

            <button
              type="button"
              disabled={phaseIndex >= phases.length - 1}
              onClick={() => {
                setPlaying(false);
                setPhaseIndex((value) =>
                  Math.min(phases.length - 1, value + 1),
                );
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-40"
            >
              التالي
              <ArrowLeft size={17} />
            </button>

            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setPhaseIndex(0);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600"
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-amber-100 bg-gradient-to-b from-amber-50 to-white p-5 shadow-sm">
            <span className="inline-flex rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black text-white">
              المرحلة الحالية
            </span>

            <h3 className="mt-4 text-xl font-black text-slate-950">
              {current.title || `المرحلة ${phaseIndex + 1}`}
            </h3>

            <p className="mt-2 text-sm font-semibold leading-8 text-slate-600">
              {current.description ||
                current.animation ||
                "تابع ما يحدث في التجربة."}
            </p>
          </div>

          {experiment.observation && (
            <InfoCard
              title="الملاحظة"
              tone="sky"
              icon={Eye}
            >
              {experiment.observation}
            </InfoCard>
          )}
        </aside>
      </div>

      {Array.isArray(content.interactive_questions) &&
        content.interactive_questions.length > 0 && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-950">
              <Brain
                size={17}
                className="text-amber-600"
              />
              استخرج النتيجة بنفسك
            </h3>

            {content.interactive_questions.map((question, index) => (
              <Reveal
                key={question.id || index}
                title={question.question || `سؤال ${index + 1}`}
                tone="amber"
              >
                <p className="text-sm font-bold leading-8 text-slate-700">
                  {question.expected_answer ||
                    question.answer ||
                    ""}
                </p>
              </Reveal>
            ))}
          </div>
        )}

      {content.takeaway && (
        <InfoCard
          title="الاستنتاج"
          tone="emerald"
          icon={CheckCircle2}
        >
          {content.takeaway}
        </InfoCard>
      )}
    </div>
  );
}

/* =========================================================
   7. Bac method card
========================================================= */

function BacMethodStep({
  content = {},
}) {
  const method = Array.isArray(content.method)
    ? content.method.filter(Boolean)
    : toArray(content.steps);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="منهجية البكالوريا"
        title={content.title || "كيف أكتب الإجابة؟"}
        description={
          content.skill ||
          "في العلوم يجب ربط الملاحظة بالتفسير ثم الاستنتاج."
        }
        icon={GraduationCap}
        tone="violet"
      />

      {method.length > 0 && (
        <div className="relative space-y-3">
          <div className="absolute bottom-5 right-[23px] top-5 w-0.5 bg-violet-100" />

          {method.map((item, index) => (
            <div
              key={item.id || index}
              className="relative flex items-start gap-4"
            >
              <span className="z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-sm font-black text-white shadow-lg shadow-violet-500/20">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1 rounded-[22px] border border-violet-100 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-violet-800">
                  {item.label ||
                    item.title ||
                    `الخطوة ${index + 1}`}
                </h3>

                <p className="mt-1 text-sm font-semibold leading-8 text-slate-600">
                  {item.text ||
                    item.description ||
                    getText(item)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {content.bac_sentence && (
        <div className="rounded-[28px] bg-gradient-to-l from-violet-700 via-indigo-700 to-sky-700 p-5 text-white shadow-xl sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-violet-100">
            <GraduationCap size={18} />
            <span className="text-xs font-black">
              صياغة نموذجية
            </span>
          </div>

          <p className="text-base font-black leading-9">
            {content.bac_sentence}
          </p>
        </div>
      )}

      {content.common_mistake && (
        <InfoCard
          title="خطأ شائع"
          tone="rose"
          icon={AlertTriangle}
        >
          {content.common_mistake}
        </InfoCard>
      )}
    </div>
  );
}

/* =========================================================
   8. Visual comparison
========================================================= */

function VisualComparisonStep({
  content = {},
}) {
  const columns = Array.isArray(content.columns)
    ? content.columns.filter(Boolean)
    : Array.isArray(content.comparison)
      ? content.comparison.filter(Boolean)
      : [];

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="قارن بصريًا"
        title={content.title || "ما الفرق؟"}
        description="المقارنة تساعد على منع الخلط بين المفاهيم المتقاربة."
        icon={Route}
        tone="sky"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {columns.map((column, index) => {
          const items =
            column.items ||
            Object.entries(column)
              .filter(
                ([key]) =>
                  ![
                    "title",
                    "label",
                    "id",
                  ].includes(key),
              )
              .map(
                ([key, value]) =>
                  `${key}: ${getText(value)}`,
              );

          return (
            <section
              key={column.id || index}
              className={cn(
                "overflow-hidden rounded-[28px] border bg-white shadow-sm",
                index % 2 === 0
                  ? "border-violet-100"
                  : "border-emerald-100",
              )}
            >
              <div
                className={cn(
                  "px-5 py-4 text-center text-white",
                  index % 2 === 0
                    ? "bg-gradient-to-l from-violet-600 to-indigo-600"
                    : "bg-gradient-to-l from-emerald-600 to-teal-600",
                )}
              >
                <h3 className="font-black">
                  {column.title ||
                    column.label ||
                    `الحالة ${index + 1}`}
                </h3>
              </div>

              <div className="p-4">
                <BulletCards
                  items={items}
                  tone={
                    index % 2 === 0
                      ? "violet"
                      : "emerald"
                  }
                />
              </div>
            </section>
          );
        })}
      </div>

      {content.final_question && (
        <InfoCard
          title="السؤال الذي يقودنا إلى المحور التالي"
          tone="amber"
          icon={CircleHelp}
        >
          {content.final_question}
        </InfoCard>
      )}
    </div>
  );
}

/* =========================================================
   9. Bac application
========================================================= */

function BacApplicationStep({
  content = {},
}) {
  const questions = Array.isArray(content.questions)
    ? content.questions.filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="تطبيق بكالوريا"
        title={content.title || "طبّق على وثيقة"}
        description="بعد الفهم ننتقل إلى صياغة تشبه سؤال البكالوريا."
        icon={GraduationCap}
        tone="amber"
      />

      {content.document && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
            <Microscope
              size={18}
              className="text-amber-600"
            />
            الوثيقة
          </div>

          <p className="text-sm font-semibold leading-8 text-slate-600">
            {content.document.statement ||
              content.document.description ||
              getText(content.document)}
          </p>
        </section>
      )}

      <div className="space-y-4">
        {questions.map((question, index) => (
          <article
            key={question.id || index}
            className="rounded-[26px] border border-amber-100 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-sm font-black text-white">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black leading-8 text-slate-950">
                  {question.question}
                </h3>

                <Reveal
                  title="أظهر التصحيح"
                  tone="amber"
                >
                  {Array.isArray(question.expected_points) ? (
                    <BulletCards
                      items={question.expected_points}
                      tone="emerald"
                    />
                  ) : (
                    <p className="text-sm font-bold leading-8 text-slate-700">
                      {question.expected_answer ||
                        question.answer ||
                        ""}
                    </p>
                  )}
                </Reveal>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   10. Summary map
========================================================= */

function InteractiveSummaryMapStep({
  content = {},
}) {
  const map = Array.isArray(content.map)
    ? content.map.filter(Boolean)
    : Array.isArray(content.paths)
      ? content.paths.filter(Boolean)
      : [];

  const [active, setActive] = useState(null);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="الخريطة النهائية"
        title={content.title || "اربط كل شيء في مخطط واحد"}
        description="لا نعيد الدرس كله؛ نربط الأفكار الأساسية بصريًا."
        icon={Route}
        tone="emerald"
      />

      <section className="rounded-[30px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5 shadow-sm sm:p-7">
        <div className="space-y-3">
          {map.map((item, index) => (
            <button
              key={item.id || index}
              type="button"
              onClick={() =>
                setActive(
                  active === index ? null : index,
                )
              }
              className="group grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[22px] border border-white bg-white/90 p-3 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200"
            >
              <span className="rounded-xl bg-violet-50 px-3 py-3 text-center text-xs font-black text-violet-800">
                {item.node || item.from}
              </span>

              <span className="flex min-w-[90px] items-center justify-center gap-1 text-[11px] font-black text-slate-500">
                <ArrowLeft size={14} />
                {item.relation || "يرتبط بـ"}
              </span>

              <span className="rounded-xl bg-emerald-50 px-3 py-3 text-center text-xs font-black text-emerald-800">
                {item.target || item.to}
              </span>

              {active === index && item.description && (
                <span className="col-span-3 mt-1 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-6 text-slate-600">
                  {item.description}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {content.memory_tip && (
        <InfoCard
          title="احفظها بهذه الجملة"
          tone="amber"
          icon={Lightbulb}
        >
          {content.memory_tip}
        </InfoCard>
      )}

      {content.next_axis_bridge && (
        <InfoCard
          title={
            content.next_axis_bridge.title ||
            "جسر نحو المحور التالي"
          }
          tone="sky"
          icon={ArrowLeft}
        >
          <div className="space-y-1">
            <p>
              {content.next_axis_bridge.question}
            </p>

            {content.next_axis_bridge.next_concept && (
              <p className="text-xs font-black text-sky-700">
                التالي: {content.next_axis_bridge.next_concept}
              </p>
            )}
          </div>
        </InfoCard>
      )}
    </div>
  );
}

/* =========================================================
   Generic science content
========================================================= */

function GenericScienceStep({
  content = {},
}) {
  const hiddenKeys = new Set([
    "component",
    "render_mode",
    "controls",
    "autoplay",
  ]);

  const entries = Object.entries(content).filter(
    ([key, value]) =>
      !hiddenKeys.has(key) &&
      !isEmpty(value),
  );

  return (
    <div className="space-y-4">
      {entries.map(([key, value]) => {
        if (
          typeof value === "string" ||
          typeof value === "number"
        ) {
          return (
            <InfoCard
              key={key}
              title={humanizeField(key)}
              tone="slate"
              icon={BookOpen}
            >
              {String(value)}
            </InfoCard>
          );
        }

        if (Array.isArray(value)) {
          return (
            <div
              key={key}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
            >
              <h3 className="mb-3 text-sm font-black text-slate-950">
                {humanizeField(key)}
              </h3>

              <BulletCards
                items={value}
                tone="emerald"
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

function humanizeField(key) {
  const labels = {
    teacher: "الشرح",
    attention: "انتبه",
    takeaway: "ما يجب تذكره",
    observation: "الملاحظة",
    conclusion: "الاستنتاج",
    definition: "التعريف",
    definitions: "التعريفات",
    examples: "أمثلة",
    key_facts: "أفكار أساسية",
    why: "لماذا؟",
    problem: "المشكلة",
    protocol: "البروتوكول",
    objective: "الهدف",
    method: "المنهجية",
    steps: "المراحل",
    remember: "تذكر",
  };

  return (
    labels[key] ||
    String(key)
      .replace(/_/g, " ")
      .trim()
  );
}

/* =========================================================
   Common mistakes
========================================================= */

function CommonMistakesStep({
  content = {},
}) {
  const mistakes = Array.isArray(content.mistakes)
    ? content.mistakes.filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="أخطاء شائعة"
        title={content.title || "لا تقع في هذه الأخطاء"}
        description="تعلم كيف تصحح صياغتك قبل البكالوريا."
        icon={AlertTriangle}
        tone="rose"
      />

      <div className="space-y-4">
        {mistakes.map((mistake, index) => (
          <article
            key={mistake.id || index}
            className="overflow-hidden rounded-[26px] border border-rose-100 bg-white shadow-sm"
          >
            <div className="border-b border-rose-100 bg-rose-50 px-5 py-4">
              <h3 className="font-black text-rose-950">
                {mistake.title || `الخطأ ${index + 1}`}
              </h3>
            </div>

            <div className="grid gap-3 p-4 md:grid-cols-2">
              {mistake.wrong && (
                <InfoCard
                  title="خطأ"
                  tone="rose"
                  icon={XCircle}
                >
                  {mistake.wrong}
                </InfoCard>
              )}

              {mistake.correct && (
                <InfoCard
                  title="الصحيح"
                  tone="emerald"
                  icon={CheckCircle2}
                >
                  {mistake.correct}
                </InfoCard>
              )}
            </div>
          </article>
        ))}
      </div>

      {content.takeaway && (
        <InfoCard
          title="قاعدة"
          tone="amber"
          icon={Lightbulb}
        >
          {content.takeaway}
        </InfoCard>
      )}
    </div>
  );
}

/* =========================================================
   AI re-explain
========================================================= */

const SCIENCE_REEXPLAIN_ACTIONS = [
  {
    id: "simplify",
    label: "أعد الشرح ببساطة",
    requestType: "simplify",
    prompt:
      "أعد شرح هذه المرحلة في العلوم الطبيعية ببساطة شديدة، انطلاقا من الظاهرة أو الوثيقة ثم التفسير ثم الاستنتاج. لا تخرج عن محتوى المرحلة.",
    icon: Brain,
  },
  {
    id: "visual",
    label: "اشرح لي الرسم",
    requestType: "visual_explanation",
    prompt:
      "اشرح لي هذه المرحلة بصريا: صف العناصر التي يجب أن ألاحظها في الرسم أو التجربة، ثم اربط كل عنصر بدوره، ثم أعطني الاستنتاج.",
    icon: Eye,
  },
  {
    id: "bac",
    label: "كيف أجيب في البكالوريا؟",
    requestType: "bac_method",
    prompt:
      "حوّل محتوى هذه المرحلة إلى طريقة إجابة بكالوريا مختصرة: ماذا ألاحظ؟ ماذا أفسر؟ ماذا أستنتج؟ مع صياغة نموذجية.",
    icon: GraduationCap,
  },
];

function ScienceReExplainPanel({
  step,
  axis,
  axisId,
  onReExplain,
}) {
  const COURSE_URL = import.meta.env.VITE_COURSE_URL;
  const endpoint = `${COURSE_URL}axes/re-explication/`;

  const { token } = useContext(UserContext);

  const [open, setOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const abortRef = useRef(null);

  useEffect(() => {
    abortRef.current?.abort();
    setOpen(false);
    setLoadingAction("");
    setError("");
    setAnswer("");

    return () => abortRef.current?.abort();
  }, [step?.id]);

  async function ask(action) {
    if (!action || loadingAction) return;

    const resolvedAxisId =
      axisId ??
      axis?.id ??
      null;

    if (
      resolvedAxisId === null ||
      resolvedAxisId === undefined ||
      resolvedAxisId === ""
    ) {
      setError("معرف المحور غير موجود.");
      setOpen(true);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setOpen(true);
    setLoadingAction(action.id);
    setError("");
    setAnswer("");

    const payload = {
      axis_id: Number(resolvedAxisId),
      student_question: action.prompt,
      request_type: action.requestType,
      step: {
        id: step?.id,
        type: step?.type,
        title: step?.title,
        content: step?.content || {},
      },
    };

    try {
      let result;

      if (typeof onReExplain === "function") {
        result = await onReExplain(payload, {
          signal: controller.signal,
          stepId: step?.id,
          actionId: action.id,
        });
      } else {
        const response = await axios.post(
          endpoint,
          payload,
          {
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              ...(token
                ? {
                    Authorization: `Bearer ${token}`,
                  }
                : {}),
            },
          },
        );

        result = response.data;
      }

      if (controller.signal.aborted) return;

      const raw =
        result?.answer ??
        result?.saved_explanation?.answer ??
        result?.explanation ??
        result?.message ??
        "";

      if (typeof raw === "string") {
        setAnswer(raw);
      } else if (raw && typeof raw === "object") {
        setAnswer(
          raw.explanation ||
            raw.answer ||
            raw.text ||
            JSON.stringify(raw, null, 2),
        );
      } else {
        setAnswer("تم إنشاء الشرح، لكن لم يصل نص قابل للعرض.");
      }
    } catch (requestError) {
      if (
        requestError?.code === "ERR_CANCELED" ||
        controller.signal.aborted
      ) {
        return;
      }

      setError(
        requestError?.response?.data?.detail ||
          requestError?.response?.data?.error ||
          requestError?.message ||
          "حدث خطأ أثناء إنشاء الشرح.",
      );
    } finally {
      if (!controller.signal.aborted) {
        setLoadingAction("");
      }
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-500/20">
            <WandSparkles size={18} />
          </span>

          <div>
            <h3 className="text-sm font-black text-slate-950">
              المساعد الذكي للعلوم
            </h3>

            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              شرح بصري • تبسيط • منهجية بكالوريا
            </p>
          </div>
        </div>

        {open ? (
          <ChevronUp size={18} />
        ) : (
          <ChevronDown size={18} />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {SCIENCE_REEXPLAIN_ACTIONS.map((action) => {
              const Icon = action.icon;
              const loading =
                loadingAction === action.id;

              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={Boolean(loadingAction)}
                  onClick={() => ask(action)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 text-xs font-black text-emerald-900 transition hover:border-emerald-300 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Icon size={16} />
                  )}

                  {action.label}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
              {error}
            </div>
          )}

          {answer && (
            <div className="mt-4 rounded-[22px] border border-emerald-100 bg-gradient-to-l from-emerald-50 to-white p-5">
              <p className="whitespace-pre-line text-sm font-semibold leading-8 text-slate-700">
                {answer}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   Step router
========================================================= */

function resolveRenderer(step) {
  const type = step?.type || "";
  const component = step?.component || "";

  if (
    component === "DiscoveryQuestion" ||
    type === "problem" ||
    type === "motivation" ||
    type === "discovery"
  ) {
    return "problem";
  }

  if (
    component === "ScientificAnimation" ||
    type === "scientific_animation" ||
    type === "animation"
  ) {
    return "scientific_animation";
  }

  if (
    component === "ShortExplanation" ||
    type === "short_explanation" ||
    type === "concept" ||
    type === "definition"
  ) {
    return "short_explanation";
  }

  if (
    component === "InteractiveDiagram" ||
    type === "interactive_diagram" ||
    type === "diagram"
  ) {
    return "interactive_diagram";
  }

  if (
    component === "KeyRuleCard" ||
    type === "key_rule" ||
    type === "rule"
  ) {
    return "key_rule";
  }

  if (
    component === "QuickCheck" ||
    type === "quick_check"
  ) {
    return "quick_check";
  }

  if (
    component === "ExperimentSimulator" ||
    type === "experiment" ||
    type === "bac_lab"
  ) {
    return "experiment";
  }

  if (
    component === "BacMethodCard" ||
    type === "bac_method"
  ) {
    return "bac_method";
  }

  if (
    component === "VisualComparison" ||
    type === "comparison"
  ) {
    return "comparison";
  }

  if (
    component === "BacApplication" ||
    type === "bac_application"
  ) {
    return "bac_application";
  }

  if (
    component === "InteractiveSummaryMap" ||
    type === "final_visual_map" ||
    type === "summary_map" ||
    type === "summary"
  ) {
    return "summary_map";
  }

  if (
    component === "FinalQuiz" ||
    type === "quiz" ||
    type === "final_quiz"
  ) {
    return "final_quiz";
  }

  if (type === "common_mistakes") {
    return "common_mistakes";
  }

  return "generic";
}

function ScienceStepBody({
  step,
  onNext,
}) {
  const content = step?.content || {};
  const renderer = resolveRenderer(step);

  switch (renderer) {
    case "problem":
      return (
        <DiscoveryQuestionStep
          content={content}
          onNext={onNext}
        />
      );

    case "scientific_animation":
      return (
        <ScientificAnimationStep content={content} />
      );

    case "short_explanation":
      return (
        <ShortExplanationStep content={content} />
      );

    case "interactive_diagram":
      return (
        <InteractiveDiagramStep content={content} />
      );

    case "key_rule":
      return <KeyRuleStep content={content} />;

    case "quick_check":
      return <QuickCheckStep content={content} />;

    case "experiment":
      return (
        <ExperimentSimulatorStep content={content} />
      );

    case "bac_method":
      return <BacMethodStep content={content} />;

    case "comparison":
      return (
        <VisualComparisonStep content={content} />
      );

    case "bac_application":
      return (
        <BacApplicationStep content={content} />
      );

    case "summary_map":
      return (
        <InteractiveSummaryMapStep content={content} />
      );

    case "final_quiz":
      return (
        <QuickCheckStep
          content={content}
          final
        />
      );

    case "common_mistakes":
      return (
        <CommonMistakesStep content={content} />
      );

    default:
      return (
        <GenericScienceStep content={content} />
      );
  }
}

/* =========================================================
   Step meta
========================================================= */

const SCIENCE_STEP_META = {
  problem: {
    label: "المشكلة",
    icon: CircleHelp,
    accent: "from-emerald-500 to-teal-600",
  },
  motivation: {
    label: "الانطلاق",
    icon: Sparkles,
    accent: "from-emerald-500 to-teal-600",
  },
  discovery: {
    label: "الاكتشاف",
    icon: Eye,
    accent: "from-cyan-500 to-sky-600",
  },
  scientific_animation: {
    label: "مشاهدة",
    icon: Play,
    accent: "from-sky-500 to-cyan-600",
  },
  animation: {
    label: "مشاهدة",
    icon: Play,
    accent: "from-sky-500 to-cyan-600",
  },
  short_explanation: {
    label: "التفسير",
    icon: Brain,
    accent: "from-violet-500 to-indigo-600",
  },
  concept: {
    label: "الفكرة",
    icon: Brain,
    accent: "from-violet-500 to-indigo-600",
  },
  definition: {
    label: "التعريف",
    icon: BookOpen,
    accent: "from-violet-500 to-indigo-600",
  },
  interactive_diagram: {
    label: "رسم تفاعلي",
    icon: ZoomIn,
    accent: "from-emerald-500 to-cyan-600",
  },
  diagram: {
    label: "رسم",
    icon: Microscope,
    accent: "from-emerald-500 to-cyan-600",
  },
  key_rule: {
    label: "قاعدة",
    icon: CheckCircle2,
    accent: "from-emerald-500 to-teal-600",
  },
  rule: {
    label: "قاعدة",
    icon: CheckCircle2,
    accent: "from-emerald-500 to-teal-600",
  },
  quick_check: {
    label: "تحقق",
    icon: Target,
    accent: "from-sky-500 to-indigo-600",
  },
  experiment: {
    label: "مختبر",
    icon: FlaskConical,
    accent: "from-amber-500 to-orange-600",
  },
  bac_lab: {
    label: "مختبر بكالوريا",
    icon: TestTube2,
    accent: "from-amber-500 to-orange-600",
  },
  bac_method: {
    label: "منهجية",
    icon: GraduationCap,
    accent: "from-violet-500 to-indigo-600",
  },
  comparison: {
    label: "مقارنة",
    icon: Route,
    accent: "from-cyan-500 to-sky-600",
  },
  bac_application: {
    label: "بكالوريا",
    icon: GraduationCap,
    accent: "from-amber-500 to-rose-500",
  },
  common_mistakes: {
    label: "أخطاء",
    icon: AlertTriangle,
    accent: "from-rose-500 to-red-600",
  },
  final_visual_map: {
    label: "الخلاصة",
    icon: Route,
    accent: "from-emerald-500 to-cyan-600",
  },
  summary_map: {
    label: "الخلاصة",
    icon: Route,
    accent: "from-emerald-500 to-cyan-600",
  },
  summary: {
    label: "الخلاصة",
    icon: Trophy,
    accent: "from-emerald-500 to-cyan-600",
  },
  quiz: {
    label: "اختبار",
    icon: Trophy,
    accent: "from-amber-500 to-rose-600",
  },
  final_quiz: {
    label: "اختبار",
    icon: Trophy,
    accent: "from-amber-500 to-rose-600",
  },
};

/* =========================================================
   Intro card
========================================================= */

function ScienceIntroCard({
  lesson,
  title,
}) {
  const outcomes = toArray(lesson?.learning_outcomes);
  const prerequisites = toArray(lesson?.prerequisites);

  return (
    <article className="overflow-hidden rounded-[34px] border border-white bg-white shadow-[0_30px_100px_-50px_rgba(15,23,42,0.45)] ring-1 ring-emerald-100/70">
      <div className="relative overflow-hidden bg-gradient-to-l from-emerald-800 via-teal-800 to-cyan-800 px-5 py-8 text-white sm:px-8 sm:py-10">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-300/15 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black ring-1 ring-white/15">
            <Microscope size={15} />
            درس تفاعلي في العلوم الطبيعية
          </span>

          <h2 className="mt-4 max-w-4xl text-2xl font-black leading-[1.55] sm:text-4xl">
            {title}
          </h2>

          {lesson?.lesson_goal && (
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-8 text-emerald-50/90 sm:text-base">
              {lesson.lesson_goal}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-2 text-xs font-black">
            {lesson?.estimated_minutes && (
              <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                حوالي {lesson.estimated_minutes} دقيقة
              </span>
            )}

            {lesson?.difficulty && (
              <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                المستوى: {lesson.difficulty}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2">
        {outcomes.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
              <Target
                size={17}
                className="text-emerald-600"
              />
              بعد هذا المحور ستستطيع
            </h3>

            <BulletCards
              items={outcomes}
              tone="emerald"
            />
          </section>
        )}

        {prerequisites.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
              <BookOpen
                size={17}
                className="text-violet-600"
              />
              قبل أن تبدأ
            </h3>

            <BulletCards
              items={prerequisites}
              tone="violet"
            />
          </section>
        )}
      </div>

      <div className="border-t border-emerald-100 bg-emerald-50/60 px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center gap-2 text-xs font-black text-emerald-900">
          <span>طريقة التعلم:</span>
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-emerald-100">
            مشكلة
          </span>
          <ArrowLeft size={13} />
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-emerald-100">
            مشاهدة
          </span>
          <ArrowLeft size={13} />
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-emerald-100">
            تفسير
          </span>
          <ArrowLeft size={13} />
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-emerald-100">
            تجربة
          </span>
          <ArrowLeft size={13} />
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-emerald-100">
            بكالوريا
          </span>
        </div>
      </div>
    </article>
  );
}

/* =========================================================
   Main component
========================================================= */

export default function ScienceLesson({
  data,
  axisId,
  onReExplain,
}) {
  const lesson = useMemo(
    () => normalizeLesson(data),
    [data],
  );

  const axis = useMemo(
    () => normalizeAxis(data, lesson),
    [data, lesson],
  );

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

    return [
      {
        id: "science-intro",
        type: "lesson_intro",
        title: "مقدمة المحور",
        label: "البداية",
        icon: Microscope,
      },
      ...learningPath.map((step, index) => {
        const meta =
          SCIENCE_STEP_META[step?.type] || {};

        return {
          ...step,
          id: step?.id || `science-step-${index + 1}`,
          label:
            meta.label ||
            step?.label ||
            "شرح",
          icon:
            meta.icon ||
            BookOpen,
        };
      }),
    ];
  }, [lesson, learningPath]);

  useEffect(() => {
    setCurrentPage(0);
  }, [
    resolvedAxisId,
    lesson?.axis_tag,
    lesson?.title,
  ]);

  if (!lesson) {
    return (
      <div
        dir="rtl"
        className="mx-auto max-w-3xl px-4 py-10"
      >
        <div className="rounded-[30px] border border-rose-200 bg-rose-50 p-8 text-center">
          <AlertTriangle
            size={40}
            className="mx-auto text-rose-500"
          />

          <h2 className="mt-4 text-xl font-black text-rose-950">
            لا توجد بيانات درس لعرضها
          </h2>
        </div>
      </div>
    );
  }

  if (data?.success === false) {
    return (
      <div
        dir="rtl"
        className="mx-auto max-w-3xl px-4 py-10"
      >
        <div className="rounded-[30px] border border-rose-200 bg-rose-50 p-8 text-center">
          <AlertTriangle
            size={40}
            className="mx-auto text-rose-500"
          />

          <h2 className="mt-4 text-xl font-black text-rose-950">
            تعذر عرض الدرس
          </h2>
        </div>
      </div>
    );
  }

  const title =
    data?.title ||
    lesson?.axis_title ||
    lesson?.title ||
    axis?.title ||
    "درس العلوم";

  const chapterTitle =
    lesson?.chapter_title ||
    data?.chapter_title ||
    data?.axis?.chapter_title ||
    "علوم الطبيعة والحياة";

  const safePage = Math.min(
    currentPage,
    Math.max(pages.length - 1, 0),
  );

  const activePage = pages[safePage];

  const progress =
    pages.length > 0
      ? Math.round(
          ((safePage + 1) / pages.length) * 100,
        )
      : 0;

  function goToPage(index) {
    if (index < 0 || index >= pages.length) return;

    setCurrentPage(index);
    scrollToLessonTop();
  }

  function goPrevious() {
    goToPage(safePage - 1);
  }

  function goNext() {
    goToPage(safePage + 1);
  }

  const ActiveIcon =
    activePage?.icon ||
    BookOpen;

  return (
    <section
      dir="rtl"
      className="relative min-h-full w-full min-w-0 overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#d1fae5_0%,transparent_28%),radial-gradient(circle_at_bottom_left,#cffafe_0%,transparent_24%),linear-gradient(180deg,#fbfffd_0%,#f4fbf8_55%,#eefbf7_100%)] px-2 py-3 sm:px-5 sm:py-5 lg:px-8"
    >
      <style>{`
        @keyframes scienceFadeIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(.995);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        #science-course-card-top,
        #science-course-card-top * {
          min-width: 0;
        }

        button,
        a {
          -webkit-tap-highlight-color: transparent;
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: .01ms !important;
            transition-duration: .01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-violet-300/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-[1220px]">
        <header
          id="science-course-card-top"
          className="relative mb-5 overflow-hidden rounded-[28px] border border-white/90 bg-white/92 p-4 shadow-[0_20px_70px_-42px_rgba(15,23,42,.42)] ring-1 ring-emerald-100/80 backdrop-blur-xl sm:p-6 lg:rounded-[36px] lg:p-7"
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-l from-emerald-600 via-teal-500 to-cyan-500" />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 ring-1 ring-emerald-100">
                  <Microscope size={15} />
                  {chapterTitle}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-black text-white shadow-lg shadow-emerald-500/20">
                  <Dna size={14} />
                  درس علوم تفاعلي
                </span>
              </div>

              <h1 className="mt-4 max-w-4xl break-words text-2xl font-black leading-[1.55] text-slate-950 sm:text-3xl lg:text-[38px]">
                {title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-black text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Route
                    size={15}
                    className="text-emerald-600"
                  />
                  البطاقة {safePage + 1} من {pages.length}
                </span>

                <span className="h-1 w-1 rounded-full bg-slate-300" />

                <span className="inline-flex items-center gap-2">
                  <ActiveIcon
                    size={15}
                    className="text-cyan-600"
                  />
                  {activePage?.label || "شرح"}
                </span>
              </div>
            </div>

            <div className="flex w-full items-center gap-4 rounded-[26px] border border-emerald-100 bg-gradient-to-l from-emerald-50/80 to-white p-4 shadow-sm sm:w-auto">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white shadow-inner ring-1 ring-emerald-100">
                <svg
                  className="absolute inset-0 h-full w-full -rotate-90"
                  viewBox="0 0 80 80"
                >
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-slate-100"
                  />

                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${
                      2 *
                      Math.PI *
                      34 *
                      (1 - progress / 100)
                    }`}
                    className="text-emerald-600 transition-all duration-500"
                  />
                </svg>

                <span className="relative text-lg font-black text-slate-950">
                  {progress}%
                </span>
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black text-slate-400">
                  تقدمك في المحور
                </p>

                <p className="mt-1 max-w-[220px] truncate text-sm font-black text-slate-950">
                  {activePage?.title}
                </p>

                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  شاهد ← افهم ← جرّب ← استنتج
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
            <div
              className="h-full rounded-full bg-gradient-to-l from-emerald-600 via-teal-500 to-cyan-500 shadow-[0_0_18px_rgba(16,185,129,.35)] transition-all duration-500"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </header>

        <main>
          <div
            key={activePage?.id || safePage}
            className="min-h-[520px] animate-[scienceFadeIn_.35s_ease-out]"
          >
            {activePage?.type === "lesson_intro" ? (
              <ScienceIntroCard
                lesson={lesson}
                title={title}
              />
            ) : (
              <article className="rounded-[34px] border border-white bg-white/95 p-4 shadow-[0_30px_100px_-55px_rgba(15,23,42,.38)] ring-1 ring-emerald-100/70 backdrop-blur-xl sm:p-6 lg:p-7">
                <div className="mb-5 flex items-start gap-4 border-b border-slate-100 pb-5">
                  <span
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
                      SCIENCE_STEP_META[activePage?.type]?.accent ||
                        "from-emerald-500 to-teal-600",
                    )}
                  >
                    <ActiveIcon size={21} />
                  </span>

                  <div>
                    <p className="text-[11px] font-black text-emerald-700">
                      {activePage?.label}
                    </p>

                    <h2 className="mt-1 text-xl font-black leading-8 text-slate-950 sm:text-2xl">
                      {activePage?.title}
                    </h2>
                  </div>
                </div>

                <ScienceStepBody
                  step={activePage}
                  onNext={
                    safePage < pages.length - 1
                      ? goNext
                      : undefined
                  }
                />

                {![
                  "quiz",
                  "final_quiz",
                  "quick_check",
                ].includes(activePage?.type) && (
                  <ScienceReExplainPanel
                    step={activePage}
                    axis={axis}
                    axisId={resolvedAxisId}
                    onReExplain={onReExplain}
                  />
                )}
              </article>
            )}
          </div>

          {pages.length > 0 && (
            <div className="sticky bottom-2 z-20 mt-6 rounded-[24px] border border-white/90 bg-white/96 p-3 shadow-[0_18px_60px_-34px_rgba(15,23,42,.5)] ring-1 ring-emerald-100/80 backdrop-blur-xl sm:bottom-3 sm:p-4">
              <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <button
                  type="button"
                  onClick={goPrevious}
                  disabled={safePage === 0}
                  className={cn(
                    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition",
                    safePage === 0
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-slate-950 text-white shadow-lg hover:bg-emerald-800",
                  )}
                >
                  <ArrowRight size={19} />
                  السابق
                </button>

                <div className="order-first col-span-2 px-2 text-center sm:order-none sm:col-span-1">
                  <p className="text-[10px] font-black tracking-[0.16em] text-slate-400">
                    المرحلة الحالية
                  </p>

                  <p className="mx-auto mt-1 max-w-[300px] truncate text-sm font-black text-slate-950">
                    {activePage?.title}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={safePage === pages.length - 1}
                  className={cn(
                    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition",
                    safePage === pages.length - 1
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5",
                  )}
                >
                  التالي
                  <ArrowLeft size={19} />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-start gap-2 overflow-x-auto pb-1 sm:justify-center">
                {pages.map((page, index) => {
                  const Icon =
                    page.icon ||
                    BookOpen;

                  const active =
                    safePage === index;

                  return (
                    <button
                      key={page.id || index}
                      type="button"
                      onClick={() => goToPage(index)}
                      title={page.title}
                      className={cn(
                        "flex h-9 shrink-0 items-center justify-center rounded-xl border transition",
                        active
                          ? "w-12 border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm"
                          : "w-9 border-slate-200 bg-white text-slate-400 hover:border-emerald-200 hover:text-emerald-600",
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
