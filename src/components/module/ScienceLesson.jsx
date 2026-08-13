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


/* =========================================================
   Amino-acid visual scene
========================================================= */

function AminoAcidScene({
  highlighted = [],
  rootValue = "R",
  rootKind = "",
  badge = "",
  compact = false,
}) {
  const isActive = (id) => highlighted.includes(id);
  const hasSelection = highlighted.length > 0;

  const rootTone =
    rootKind === "acidic"
      ? "border-rose-300 bg-rose-50 text-rose-800"
      : rootKind === "basic"
        ? "border-sky-300 bg-sky-50 text-sky-800"
        : "border-amber-300 bg-amber-50 text-amber-800";

  function groupClass(id, tone) {
    const active = isActive(id);
    const muted = hasSelection && !active;

    return cn(
      "relative z-10 flex min-h-16 min-w-[92px] items-center justify-center rounded-2xl border-2 px-4 text-center font-black shadow-sm transition-all duration-500 sm:min-w-[112px] sm:text-lg",
      tone,
      active && "scale-110 ring-8 ring-current/10 shadow-lg",
      muted && "scale-95 opacity-25 grayscale",
    );
  }

  return (
    <div
      className={cn(
        "relative mx-auto overflow-hidden rounded-[30px] border border-sky-100 bg-gradient-to-br from-white via-sky-50/60 to-emerald-50/70 shadow-inner",
        compact ? "min-h-[300px]" : "min-h-[390px] sm:min-h-[430px]",
      )}
      dir="ltr"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.08),transparent_48%)]" />

      <div className="relative flex min-h-[390px] items-center justify-center px-4 py-10 sm:min-h-[430px]">
        <div className="grid grid-cols-[1fr_auto_1fr] grid-rows-[auto_auto_auto] items-center gap-x-5 gap-y-5 sm:gap-x-8 sm:gap-y-7">
          <div />
          <div className={groupClass("hydrogen", "border-slate-300 bg-white text-slate-700")}>H</div>
          <div />

          <div className={groupClass("amino", "border-violet-300 bg-violet-50 text-violet-800")}>NH₂</div>

          <div
            className={cn(
              "relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-4 border-emerald-400 bg-emerald-600 text-2xl font-black text-white shadow-xl transition-all duration-500 sm:h-28 sm:w-28",
              isActive("central") && "scale-110 ring-8 ring-emerald-200/70",
              hasSelection && !isActive("central") && "opacity-45",
            )}
          >
            Cα
          </div>

          <div className={groupClass("carboxyl", "border-rose-300 bg-rose-50 text-rose-800")}>COOH</div>

          <div />
          <div className={groupClass("root", rootTone)}>
            <span className="max-w-[150px] break-words">{rootValue || "R"}</span>
          </div>
          <div />
        </div>

        <span className="absolute left-1/2 top-[31%] h-9 w-1 -translate-x-1/2 bg-slate-300" />
        <span className="absolute left-[calc(50%-112px)] top-1/2 h-1 w-16 -translate-y-1/2 bg-slate-300 sm:left-[calc(50%-145px)] sm:w-24" />
        <span className="absolute right-[calc(50%-112px)] top-1/2 h-1 w-16 -translate-y-1/2 bg-slate-300 sm:right-[calc(50%-145px)] sm:w-24" />
        <span className="absolute bottom-[28%] left-1/2 h-9 w-1 -translate-x-1/2 bg-slate-300" />

        {badge && (
          <span className={cn("absolute left-5 top-5 rounded-full border px-4 py-2 text-sm font-black shadow-sm", rootTone)}>
            {badge}
          </span>
        )}

        <span className="absolute bottom-4 right-5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-slate-500 shadow-sm" dir="rtl">
          البنية العامة لحمض أميني α
        </span>
      </div>
    </div>
  );
}


function AminoAcidPHScene({
  aminoLabel = "NH₃⁺",
  carboxylLabel = "COO⁻",
  netCharge = "0",
  phLabel = "pH = pHi",
  protonMode = "balanced",
  badge = "",
}) {
  const chargeTone =
    netCharge === "+"
      ? "border-sky-300 bg-sky-50 text-sky-800"
      : netCharge === "−" || netCharge === "-"
        ? "border-rose-300 bg-rose-50 text-rose-800"
        : "border-emerald-300 bg-emerald-50 text-emerald-800";

  return (
    <div
      className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-sky-100 bg-gradient-to-br from-white via-sky-50/60 to-violet-50/60 shadow-inner sm:min-h-[430px]"
      dir="ltr"
    >
      <div className="absolute inset-x-6 top-5 flex items-center justify-between gap-3" dir="rtl">
        <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm">
          {phLabel}
        </span>
        {badge && (
          <span className={cn("rounded-full border px-4 py-2 text-sm font-black shadow-sm", chargeTone)}>
            {badge}
          </span>
        )}
      </div>

      <div className="relative flex min-h-[390px] items-center justify-center px-4 pb-16 pt-20 sm:min-h-[430px]">
        <div className="grid grid-cols-[1fr_auto_1fr] grid-rows-[auto_auto_auto] items-center gap-x-5 gap-y-6 sm:gap-x-8">
          <div />
          <div className="rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 font-black text-slate-700 shadow-sm">
            H
          </div>
          <div />

          <div className={cn(
            "rounded-2xl border-2 px-5 py-4 text-lg font-black shadow-sm transition-all duration-500",
            aminoLabel.includes("⁺")
              ? "border-sky-300 bg-sky-50 text-sky-800 ring-8 ring-sky-100/60"
              : "border-violet-300 bg-violet-50 text-violet-800",
          )}>
            {aminoLabel}
          </div>

          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-emerald-400 bg-emerald-600 text-2xl font-black text-white shadow-xl sm:h-28 sm:w-28">
            Cα
          </div>

          <div className={cn(
            "rounded-2xl border-2 px-5 py-4 text-lg font-black shadow-sm transition-all duration-500",
            carboxylLabel.includes("⁻")
              ? "border-rose-300 bg-rose-50 text-rose-800 ring-8 ring-rose-100/60"
              : "border-amber-300 bg-amber-50 text-amber-800",
          )}>
            {carboxylLabel}
          </div>

          <div />
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 font-black text-amber-800 shadow-sm">
            R
          </div>
          <div />
        </div>

        <div className={cn(
          "absolute bottom-5 left-1/2 -translate-x-1/2 rounded-2xl border px-5 py-3 text-center font-black shadow-sm",
          chargeTone,
        )} dir="rtl">
          المحصلة الكهربائية = {netCharge}
        </div>

        {protonMode === "gain" && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2 animate-pulse rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white shadow-lg">
            + H⁺
          </div>
        )}

        {protonMode === "loss" && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2 animate-pulse rounded-full bg-rose-600 px-4 py-2 text-sm font-black text-white shadow-lg">
            − H⁺
          </div>
        )}
      </div>
    </div>
  );
}

function PHScaleScene({
  ph = 6,
  phi = 6,
  netCharge = "0",
  badge = "",
}) {
  const min = 0;
  const max = 14;
  const pos = (value) => `${Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))}%`;

  const tone =
    netCharge === "+"
      ? "border-sky-300 bg-sky-50 text-sky-800"
      : netCharge === "−" || netCharge === "-"
        ? "border-rose-300 bg-rose-50 text-rose-800"
        : "border-emerald-300 bg-emerald-50 text-emerald-800";

  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/50 to-sky-50/60 p-6 shadow-inner sm:min-h-[430px]" dir="rtl">
      <div className="mx-auto mt-8 max-w-3xl">
        <div className="flex items-center justify-between text-xs font-black text-slate-500">
          <span>حمضي</span>
          <span>قاعدي</span>
        </div>

        <div className="relative mt-14 h-5 rounded-full bg-gradient-to-l from-violet-400 via-emerald-300 to-rose-400 shadow-inner">
          <span
            className="absolute top-1/2 h-12 w-1 -translate-y-1/2 bg-slate-900"
            style={{ left: pos(phi) }}
          />
          <span
            className="absolute -top-10 -translate-x-1/2 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white"
            style={{ left: pos(phi) }}
          >
            pHi = {phi}
          </span>

          <span
            className="absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-sky-600 text-xs font-black text-white shadow-xl transition-all duration-700"
            style={{ left: pos(ph) }}
          >
            pH
          </span>
          <span
            className="absolute top-10 -translate-x-1/2 whitespace-nowrap text-sm font-black text-sky-700"
            style={{ left: pos(ph) }}
          >
            {ph}
          </span>
        </div>

        <div className="mt-28 grid gap-3 sm:grid-cols-3">
          <div className={cn("rounded-2xl border p-4 text-center", ph < phi ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white opacity-50")}>
            <div className="font-black text-sky-800">pH &lt; pHi</div>
            <div className="mt-1 text-sm font-bold text-slate-600">موجب (+)</div>
          </div>
          <div className={cn("rounded-2xl border p-4 text-center", ph === phi ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white opacity-50")}>
            <div className="font-black text-emerald-800">pH = pHi</div>
            <div className="mt-1 text-sm font-bold text-slate-600">المحصلة 0</div>
          </div>
          <div className={cn("rounded-2xl border p-4 text-center", ph > phi ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white opacity-50")}>
            <div className="font-black text-rose-800">pH &gt; pHi</div>
            <div className="mt-1 text-sm font-bold text-slate-600">سالب (−)</div>
          </div>
        </div>

        <div className={cn("mx-auto mt-5 w-fit rounded-full border px-5 py-2 text-sm font-black shadow-sm", tone)}>
          {badge || `الشحنة = ${netCharge}`}
        </div>
      </div>
    </div>
  );
}


function ElectrophoresisBase({
  children,
  badge = "",
  showField = true,
}) {
  return (
    <div
      className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-cyan-100 bg-gradient-to-br from-white via-cyan-50/70 to-violet-50/60 shadow-inner sm:min-h-[430px]"
      dir="ltr"
    >
      <div className="absolute inset-x-5 top-5 flex items-center justify-between">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-rose-300 bg-rose-50 text-3xl font-black text-rose-700 shadow-sm">
          +
        </div>

        {badge && (
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm" dir="rtl">
            {badge}
          </div>
        )}

        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-sky-300 bg-sky-50 text-3xl font-black text-sky-700 shadow-sm">
          −
        </div>
      </div>

      <div className="absolute inset-x-[10%] top-[56%] h-2 -translate-y-1/2 rounded-full bg-slate-200 shadow-inner" />

      <div className="absolute left-1/2 top-[34%] h-[48%] w-px -translate-x-1/2 border-l-2 border-dashed border-slate-400">
        <span
          className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600 shadow-sm"
          dir="rtl"
        >
          نقطة الانطلاق
        </span>
      </div>

      {showField && (
        <div className="absolute left-1/2 top-[23%] flex -translate-x-1/2 items-center gap-2 text-xs font-black text-slate-500" dir="rtl">
          <span>المجال الكهربائي</span>
          <span className="text-lg">⇆</span>
        </div>
      )}

      {children}
    </div>
  );
}

function MovingSpot({
  x = 50,
  y = 56,
  label,
  charge,
  tone = "sky",
}) {
  const tones = {
    sky: "border-sky-300 bg-sky-600 shadow-sky-500/30",
    rose: "border-rose-300 bg-rose-600 shadow-rose-500/30",
    emerald: "border-emerald-300 bg-emerald-600 shadow-emerald-500/30",
    violet: "border-violet-300 bg-violet-600 shadow-violet-500/30",
    amber: "border-amber-300 bg-amber-600 shadow-amber-500/30",
  };

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full border-4 border-white text-xl font-black text-white shadow-xl",
          tones[tone] || tones.sky,
        )}
      >
        {charge}
      </div>
      {label && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-700 shadow-sm" dir="rtl">
          {label}
        </div>
      )}
    </div>
  );
}

function ElectrophoresisScene({
  positiveX = 50,
  neutralX = 50,
  negativeX = 50,
  showField = true,
  badge = "",
}) {
  return (
    <ElectrophoresisBase badge={badge} showField={showField}>
      <MovingSpot
        x={positiveX}
        y={46}
        label="حمض أميني موجب"
        charge="+"
        tone="sky"
      />
      <MovingSpot
        x={neutralX}
        y={58}
        label="متعادل كهربائيا"
        charge="0"
        tone="emerald"
      />
      <MovingSpot
        x={negativeX}
        y={70}
        label="حمض أميني سالب"
        charge="−"
        tone="rose"
      />
    </ElectrophoresisBase>
  );
}

function SingleElectrophoresisScene({
  x = 50,
  charge = "0",
  relation = "pH = pHi",
  badge = "",
}) {
  const tone =
    charge === "+"
      ? "sky"
      : charge === "−" || charge === "-"
        ? "rose"
        : "emerald";

  return (
    <ElectrophoresisBase badge={badge} showField>
      <MovingSpot
        x={x}
        y={57}
        label={relation}
        charge={charge}
        tone={tone}
      />

      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-700 shadow-sm"
        dir="rtl"
      >
        {relation}
        <span className="mx-2 text-slate-300">|</span>
        الشحنة = {charge}
      </div>
    </ElectrophoresisBase>
  );
}

function ThreeAminoElectrophoresisScene({
  aspX = 50,
  alaX = 50,
  lysX = 50,
  badge = "",
}) {
  return (
    <ElectrophoresisBase badge={badge} showField>
      <MovingSpot
        x={aspX}
        y={45}
        label="Asp"
        charge="−"
        tone="rose"
      />
      <MovingSpot
        x={alaX}
        y={58}
        label="Ala"
        charge="0"
        tone="emerald"
      />
      <MovingSpot
        x={lysX}
        y={71}
        label="Lys"
        charge="+"
        tone="sky"
      />
    </ElectrophoresisBase>
  );
}


function PeptideBondScene({ stage = "separate", badge = "" }) {
  const bonded = stage === "bond" || stage === "dipeptide";
  const water = stage === "water" || stage === "dipeptide";
  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/60 to-sky-50/60 p-5 shadow-inner sm:min-h-[430px]" dir="ltr">
      <div className="absolute inset-x-5 top-5 flex justify-center">
        {badge && <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-sm" dir="rtl">{badge}</span>}
      </div>
      <div className="flex min-h-[360px] items-center justify-center gap-3 pt-12 text-center font-black sm:gap-6">
        <div className="rounded-3xl border-2 border-sky-200 bg-white p-4 shadow-lg">
          <div className="text-xs text-slate-500">حمض أميني 1</div>
          <div className="mt-3 text-base sm:text-xl">H₂N–CH(R₁)–<span className="rounded-lg bg-amber-100 px-1 text-amber-800">COOH</span></div>
        </div>
        <div className="text-2xl text-slate-400">{bonded ? "⟶" : "+"}</div>
        <div className="rounded-3xl border-2 border-violet-200 bg-white p-4 shadow-lg">
          <div className="text-xs text-slate-500">حمض أميني 2</div>
          <div className="mt-3 text-base sm:text-xl"><span className="rounded-lg bg-violet-100 px-1 text-violet-800">H₂N</span>–CH(R₂)–COOH</div>
        </div>
      </div>
      {stage === "water" && <div className="absolute bottom-20 left-1/2 -translate-x-1/2 animate-pulse rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-3 font-black text-cyan-800">OH + H ⟶ H₂O</div>}
      {bonded && <div className="absolute bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 font-black text-emerald-900 shadow-sm">H₂N–CH(R₁)–<span className="rounded bg-emerald-200 px-1">CO–NH</span>–CH(R₂)–COOH</div>}
      {water && stage === "dipeptide" && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm font-black text-cyan-700">+ H₂O</div>}
    </div>
  );
}

function PeptideChainScene({ count = 1, badge = "" }) {
  const names=["Ala","Gly","Ser","Lys","Val"];
  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/50 to-emerald-50/50 p-6 shadow-inner sm:min-h-[430px]" dir="ltr">
      <div className="flex justify-center">{badge && <span className="rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-black text-violet-800 shadow-sm" dir="rtl">{badge}</span>}</div>
      <div className="mt-24 flex flex-wrap items-center justify-center gap-2">
        {Array.from({length:count}).map((_,i)=><div key={i} className="flex items-center gap-2">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-emerald-600 font-black text-white shadow-xl">{names[i]}</div>
          {i<count-1 && <div className="rounded-xl bg-amber-100 px-2 py-1 text-xs font-black text-amber-800">–CO–NH–</div>}
        </div>)}
      </div>
      <div className="absolute bottom-8 inset-x-0 text-center text-sm font-black text-slate-600" dir="rtl">{count} أحماض أمينية ← {Math.max(0,count-1)} روابط ببتيدية</div>
    </div>
  );
}

function PeptideDirectionScene({ focus="chain", badge="" }) {
  return <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-sky-100 bg-gradient-to-br from-white via-sky-50/60 to-amber-50/50 p-6 shadow-inner sm:min-h-[430px]" dir="ltr">
    <div className="flex justify-center">{badge && <span className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-800 shadow-sm" dir="rtl">{badge}</span>}</div>
    <div className="mt-28 flex items-center justify-center gap-2 font-black">
      <div className={cn("rounded-2xl border-2 px-4 py-3 transition",focus==="N"?"scale-110 border-sky-400 bg-sky-100 text-sky-900":"border-slate-200 bg-white")}>N</div>
      <span>→ Ala → Gly → Ser → Lys →</span>
      <div className={cn("rounded-2xl border-2 px-4 py-3 transition",focus==="C"?"scale-110 border-rose-400 bg-rose-100 text-rose-900":"border-slate-200 bg-white")}>C</div>
    </div>
    <div className="mt-10 text-center text-sm font-black text-slate-600" dir="rtl">القراءة: N → C</div>
  </div>;
}

function PrimaryStructureScene({ sequence=[], badge="", highlightChange=false }) {
  return <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/50 to-violet-50/50 p-6 shadow-inner sm:min-h-[430px]" dir="ltr">
    <div className="flex justify-center">{badge && <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-sm">{badge}</span>}</div>
    <div className="mt-28 flex items-center justify-center gap-2">
      <span className="font-black text-sky-700">N</span>
      {sequence.map((x,i)=><div key={`${x}-${i}`} className="flex items-center gap-2">
        <div className={cn("flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-emerald-600 font-black text-white shadow-xl",highlightChange&&i>0?"ring-8 ring-amber-100":"")}>{x}</div>
        {i<sequence.length-1&&<span className="font-black text-slate-400">—</span>}
      </div>)}
      <span className="font-black text-rose-700">C</span>
    </div>
    <div className="mt-10 text-center text-sm font-black text-slate-600" dir="rtl">البنية الأولية = ترتيب الوحدات، وليس شكلها في الفراغ</div>
  </div>;
}

function SecondaryStructureScene({ shape="line", badge="", showBonds=false }) {
  const helix=Array.from({length:9},(_,i)=>({x:50+Math.sin(i*1.3)*22,y:20+i*7}));
  return <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/50 to-sky-50/50 p-6 shadow-inner sm:min-h-[430px]" dir="ltr">
    <div className="flex justify-center">{badge && <span className="rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-black text-violet-800 shadow-sm">{badge}</span>}</div>
    <div className="relative mx-auto mt-10 h-[280px] max-w-2xl">
      {shape==="line" && <div className="absolute left-[12%] right-[12%] top-1/2 h-2 rounded-full bg-emerald-500"/>}
      {shape==="helix" && helix.map((p,i)=><div key={i} className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-emerald-600 shadow" style={{left:`${p.x}%`,top:`${p.y}%`}} />)}
      {shape==="sheet" && <>
        {[30,50,70].map((y,i)=><div key={y} className="absolute left-[18%] right-[18%] h-8 rounded-r-full bg-sky-500 shadow" style={{top:`${y}%`,transform:i%2?"rotate(180deg)":"none"}} />)}
      </>}
      {showBonds && [32,44,56,68].map((x,i)=><div key={x} className="absolute top-[30%] h-[42%] border-l-2 border-dashed border-amber-500" style={{left:`${x}%`}} />)}
    </div>
    <div className="text-center text-sm font-black text-slate-600" dir="rtl">{shape==="helix"?"حلزون α":shape==="sheet"?"وريقات β":"سلسلة ممتدة"}{showBonds?" — الخطوط المتقطعة تمثل روابط هيدروجينية":""}</div>
  </div>;
}


function TertiaryFoldingScene({ stage = "secondary", badge = "" }) {
  const folded = stage === "folding" || stage === "tertiary";

  const points = folded
    ? [
        [43, 22], [56, 27], [62, 40], [54, 52],
        [39, 49], [33, 62], [47, 72], [62, 66],
      ]
    : [
        [18, 48], [28, 38], [38, 52], [48, 34],
        [58, 50], [68, 36], [78, 48], [86, 40],
      ];

  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/60 to-sky-50/60 shadow-inner sm:min-h-[430px]" dir="ltr">
      <div className="absolute inset-x-5 top-5 flex justify-center">
        {badge && (
          <span className="rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-black text-violet-800 shadow-sm" dir="rtl">
            {badge}
          </span>
        )}
      </div>

      <div className="relative mx-auto mt-20 h-[285px] max-w-2xl">
        {points.map(([x, y], index) => (
          <div
            key={index}
            className={cn(
              "absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white font-black text-white shadow-xl transition-all duration-700",
              index % 3 === 0
                ? "bg-violet-600"
                : index % 3 === 1
                  ? "bg-sky-600"
                  : "bg-emerald-600",
            )}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {index + 1}
          </div>
        ))}

        {stage === "secondary" && (
          <>
            <div className="absolute left-[18%] top-[67%] rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-800">
              α
            </div>
            <div className="absolute right-[18%] top-[67%] rounded-full bg-sky-100 px-4 py-2 text-xs font-black text-sky-800">
              β
            </div>
          </>
        )}

        {stage === "tertiary" && (
          <div className="absolute left-1/2 top-1/2 h-[78%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-[45%] border-4 border-dashed border-violet-300 bg-violet-100/20" />
        )}
      </div>

      <div className="absolute bottom-6 inset-x-0 text-center text-sm font-black text-slate-600" dir="rtl">
        {stage === "secondary"
          ? "سلسلة واحدة تحتوي عناصر من البنية الثانوية"
          : stage === "folding"
            ? "نفس السلسلة تبدأ في الانطواء"
            : "سلسلة واحدة مطوية = بنية ثالثية"}
      </div>
    </div>
  );
}

function QuaternaryAssemblyScene({
  subunits = 1,
  assembled = false,
  badge = "",
}) {
  const positions = [
    [38, 38],
    [62, 38],
    [38, 64],
    [62, 64],
  ];

  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/60 to-violet-50/60 shadow-inner sm:min-h-[430px]" dir="ltr">
      <div className="absolute inset-x-5 top-5 flex justify-center">
        {badge && (
          <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-sm" dir="rtl">
            {badge}
          </span>
        )}
      </div>

      <div className="relative mx-auto mt-20 h-[285px] max-w-2xl">
        {positions.slice(0, Math.max(1, subunits)).map(([x, y], index) => {
          const finalX = assembled ? [45,55,45,55][index] : x;
          const finalY = assembled ? [44,44,58,58][index] : y;
          const labels = ["α", "β", "α", "β"];

          return (
            <div
              key={index}
              className={cn(
                "absolute flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[38%] border-4 border-white text-2xl font-black text-white shadow-xl transition-all duration-700",
                index % 2 ? "bg-sky-600" : "bg-violet-600",
              )}
              style={{ left: `${finalX}%`, top: `${finalY}%` }}
            >
              {labels[index]}
            </div>
          );
        })}

        {assembled && (
          <div className="absolute left-1/2 top-1/2 h-[72%] w-[48%] -translate-x-1/2 -translate-y-1/2 rounded-[35%] border-4 border-dashed border-emerald-400" />
        )}
      </div>

      <div className="absolute bottom-6 inset-x-0 text-center text-sm font-black text-slate-600" dir="rtl">
        {subunits <= 1
          ? "تحت وحدة واحدة"
          : assembled
            ? "تجمع عدة تحت وحدات = بنية رابعية"
            : `${subunits} تحت وحدات مطوية`}
      </div>
    </div>
  );
}

function ProteinLevelsScene({
  level = 1,
  badge = "",
}) {
  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-amber-100 bg-gradient-to-br from-white via-amber-50/40 to-violet-50/60 p-6 shadow-inner sm:min-h-[430px]" dir="rtl">
      <div className="flex justify-center">
        {badge && (
          <span className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-black text-amber-800 shadow-sm">
            {badge}
          </span>
        )}
      </div>

      <div className="mx-auto mt-16 grid max-w-4xl gap-3 sm:grid-cols-4">
        {[
          ["1", "أولية", "ترتيب"],
          ["2", "ثانوية", "α / β"],
          ["3", "ثالثية", "سلسلة مطوية"],
          ["4", "رابعية", "عدة سلاسل"],
        ].map(([n, title, desc], index) => {
          const active = level === index + 1;
          return (
            <div
              key={n}
              className={cn(
                "rounded-[24px] border p-5 text-center transition-all duration-500",
                active
                  ? "scale-105 border-violet-300 bg-violet-100 shadow-xl ring-8 ring-violet-50"
                  : "border-slate-200 bg-white opacity-60",
              )}
            >
              <div className={cn(
                "mx-auto flex h-12 w-12 items-center justify-center rounded-full text-lg font-black",
                active ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500",
              )}>
                {n}
              </div>
              <div className="mt-3 font-black text-slate-900">{title}</div>
              <div className="mt-1 text-xs font-bold text-slate-500">{desc}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center text-sm font-black text-slate-600">
        أولية → ثانوية → ثالثية → رابعية
      </div>
    </div>
  );
}


function RGroupFoldingScene({ stage = "far", badge = "" }) {
  const close = stage === "close";
  const approaching = stage === "approach";
  const left = close ? 45 : approaching ? 36 : 25;
  const right = close ? 55 : approaching ? 64 : 75;

  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/60 to-violet-50/50 shadow-inner sm:min-h-[430px]" dir="ltr">
      <div className="absolute inset-x-5 top-5 flex justify-center">
        {badge && <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-sm" dir="rtl">{badge}</span>}
      </div>

      <div className="absolute left-[15%] right-[15%] top-[54%] h-2 rounded-full bg-slate-200" />

      <div className="absolute top-[54%] -translate-x-1/2 -translate-y-1/2 transition-all duration-700" style={{left:`${left}%`}}>
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-violet-600 font-black text-white shadow-xl">R₁</div>
      </div>

      <div className="absolute top-[54%] -translate-x-1/2 -translate-y-1/2 transition-all duration-700" style={{left:`${right}%`}}>
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-sky-600 font-black text-white shadow-xl">R₂</div>
      </div>

      {close && <div className="absolute left-1/2 top-[54%] w-16 -translate-x-1/2 border-t-4 border-dashed border-amber-500" />}

      <div className="absolute bottom-8 inset-x-0 text-center text-sm font-black text-slate-600" dir="rtl">
        {stage === "far" ? "بعيدان على السلسلة" : stage === "approach" ? "الانطواء يقرّبهما" : "بعد الانطواء: يمكن أن يظهر تآثر بين R"}
      </div>
    </div>
  );
}

function StabilizingBondScene({
  bondType = "disulfide",
  stage = "before",
  badge = "",
}) {
  const forming = stage === "forming" || stage === "after";
  const labels = {
    disulfide: ["Cys–S", "S–Cys", "S–S"],
    ionic: ["COO⁻", "NH₃⁺", "(−) ↔ (+)"],
    hydrogen: ["O / N", "H–O / H–N", "··· H ···"],
  };
  const [leftLabel, rightLabel, bondLabel] = labels[bondType] || labels.disulfide;

  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-sky-100 bg-gradient-to-br from-white via-sky-50/50 to-amber-50/50 shadow-inner sm:min-h-[430px]" dir="ltr">
      <div className="absolute inset-x-5 top-5 flex justify-center">
        {badge && <span className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-800 shadow-sm" dir="rtl">{badge}</span>}
      </div>

      <div className="flex min-h-[380px] items-center justify-center gap-10 pt-8">
        <div className="flex h-28 w-28 items-center justify-center rounded-[32%] border-4 border-white bg-violet-600 text-xl font-black text-white shadow-xl">
          {leftLabel}
        </div>

        <div className={cn(
          "min-w-[90px] text-center text-xl font-black transition-all duration-500",
          forming ? "scale-110 text-amber-700" : "text-slate-300",
        )}>
          {forming ? bondLabel : "···"}
        </div>

        <div className="flex h-28 w-28 items-center justify-center rounded-[32%] border-4 border-white bg-emerald-600 text-xl font-black text-white shadow-xl">
          {rightLabel}
        </div>
      </div>

      <div className="absolute bottom-8 inset-x-0 text-center text-sm font-black text-slate-600" dir="rtl">
        {bondType === "disulfide"
          ? "Cys مع Cys → جسر ثنائي الكبريت"
          : bondType === "ionic"
            ? "شحنتان متعاكستان → رابطة شاردية"
            : "مجموعات قطبية مناسبة → رابطة هيدروجينية"}
      </div>
    </div>
  );
}

function HydrophobicCoreScene({
  inside = false,
  badge = "",
}) {
  const finalInside = inside === true;
  const moving = inside === "moving";

  const positions = finalInside
    ? [[45,45],[55,45],[45,57],[55,57]]
    : moving
      ? [[35,40],[65,40],[38,65],[62,65]]
      : [[20,32],[80,32],[20,70],[80,70]];

  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 shadow-inner sm:min-h-[430px]" dir="ltr">
      <div className="absolute inset-x-5 top-5 flex justify-center">
        {badge && <span className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-black text-cyan-800 shadow-sm" dir="rtl">{badge}</span>}
      </div>

      <div className="absolute left-1/2 top-[55%] h-[230px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-[45%] border-4 border-emerald-300 bg-emerald-100/50">
        <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-800">البروتين</span>
      </div>

      {positions.map(([x,y],i)=>(
        <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700" style={{left:`${x}%`,top:`${y}%`}}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-amber-600 text-xs font-black text-white shadow-lg">R</div>
        </div>
      ))}

      {Array.from({length:10}).map((_,i)=>(
        <span key={i} className="absolute text-xs font-bold text-cyan-500/60" style={{left:`${8+(i*9)%85}%`,top:`${20+(i*17)%65}%`}}>H₂O</span>
      ))}

      <div className="absolute bottom-7 inset-x-0 text-center text-sm font-black text-slate-600" dir="rtl">
        {finalInside ? "الجذور غير القطبية تجمعت في الداخل" : moving ? "تبتعد تدريجيا عن الماء" : "الجذور الكارهة للماء معرضة للوسط المائي"}
      </div>
    </div>
  );
}

function ProteinStabilityMapScene({
  show = "disulfide",
  badge = "",
}) {
  const visible = (id) => show === id || show === "all";

  return (
    <div className="relative mx-auto min-h-[410px] overflow-hidden rounded-[30px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/50 to-emerald-50/50 shadow-inner sm:min-h-[450px]" dir="ltr">
      <div className="absolute inset-x-5 top-5 flex justify-center">
        {badge && <span className="rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-black text-violet-800 shadow-sm" dir="rtl">{badge}</span>}
      </div>

      <div className="absolute left-1/2 top-[57%] h-[270px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-[42%] border-4 border-violet-300 bg-violet-100/30">
        <div className={cn("absolute left-[24%] top-[28%] rounded-xl px-3 py-2 text-sm font-black transition", visible("disulfide") ? "bg-amber-100 text-amber-900 opacity-100" : "opacity-20")}>S–S</div>
        <div className={cn("absolute right-[20%] top-[34%] rounded-xl px-3 py-2 text-sm font-black transition", visible("ionic") ? "bg-sky-100 text-sky-900 opacity-100" : "opacity-20")}>(+) ↔ (−)</div>
        <div className={cn("absolute left-[30%] bottom-[24%] rounded-xl px-3 py-2 text-sm font-black transition", visible("hydrogen") ? "bg-emerald-100 text-emerald-900 opacity-100" : "opacity-20")}>··· H ···</div>
        <div className={cn("absolute right-[26%] bottom-[20%] flex gap-1 transition", visible("hydrophobic") ? "opacity-100" : "opacity-20")}>
          {[1,2,3].map(i=><span key={i} className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-xs font-black text-white">R</span>)}
        </div>
      </div>

      <div className="absolute bottom-7 inset-x-0 text-center text-sm font-black text-slate-600" dir="rtl">
        {show === "all" ? "مجموع التآثرات يساهم في تثبيت الشكل الفراغي" : "كل نوع يعتمد على طبيعة الجذور R"}
      </div>
    </div>
  );
}


function ProteinDenaturationScene({ stage = "native", activity = 100, badge = "" }) {
  const denatured = stage === "denatured";
  const stress = stage === "stress";

  return (
    <div className="relative mx-auto min-h-[400px] overflow-hidden rounded-[30px] border border-rose-100 bg-gradient-to-br from-white via-rose-50/50 to-amber-50/50 shadow-inner sm:min-h-[440px]" dir="rtl">
      <div className="absolute inset-x-5 top-5 flex justify-center">
        {badge && <span className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-black text-rose-800 shadow-sm">{badge}</span>}
      </div>

      <div className="absolute left-1/2 top-[53%] -translate-x-1/2 -translate-y-1/2">
        <div className={cn(
          "relative transition-all duration-700",
          denatured ? "h-20 w-[330px]" : stress ? "h-48 w-64 rotate-6" : "h-56 w-56"
        )}>
          {Array.from({length:9}).map((_,i)=>{
            const nativePos = [
              [42,12],[65,22],[72,45],[60,68],[36,72],[20,54],[24,30],[46,38],[48,55]
            ][i];
            const denatPos = [5+i*11, 45 + (i%2 ? 14 : -14)];
            const p = denatured ? denatPos : nativePos;
            return <span key={i} className={cn(
              "absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white text-xs font-black text-white shadow-lg transition-all duration-700",
              i%3===0 ? "bg-violet-600" : i%3===1 ? "bg-sky-600" : "bg-emerald-600"
            )} style={{left:`${p[0]}%`,top:`${p[1]}%`}}>{i+1}</span>
          })}
        </div>
      </div>

      {stress && <div className="absolute right-[16%] top-[30%] text-5xl animate-pulse">♨</div>}

      <div className="absolute bottom-7 left-1/2 w-[80%] -translate-x-1/2">
        <div className="mb-2 flex justify-between text-xs font-black text-slate-600">
          <span>النشاط</span><span>{activity}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{width:`${activity}%`}} />
        </div>
      </div>
    </div>
  );
}

function PrimaryStructurePreservedScene({ folded = true, badge = "" }) {
  const aa = ["Ala","Gly","Ser","Val"];
  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-sky-100 bg-gradient-to-br from-white via-sky-50/50 to-violet-50/40 shadow-inner" dir="rtl">
      <div className="absolute inset-x-5 top-5 flex justify-center">
        {badge && <span className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-800 shadow-sm">{badge}</span>}
      </div>
      <div className={cn(
        "absolute left-1/2 top-[52%] flex -translate-x-1/2 -translate-y-1/2 items-center transition-all duration-700",
        folded ? "w-[260px] flex-wrap justify-center gap-2 rotate-3" : "gap-2"
      )} dir="ltr">
        {aa.map((x,i)=><div key={x} className="flex items-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-violet-600 text-xs font-black text-white shadow-lg">{x}</span>
          {i<aa.length-1 && <span className="mx-1 font-black text-slate-400">—</span>}
        </div>)}
      </div>
      <div className="absolute bottom-8 inset-x-0 text-center text-sm font-black text-slate-600">
        الترتيب نفسه محفوظ: Ala → Gly → Ser → Val
      </div>
    </div>
  );
}

function AnfinsenExperimentScene({ stage = "native", activity = 100, badge = "" }) {
  const unfolded = stage === "denatured";
  const refolding = stage === "refolding";
  const native = stage === "native" || stage === "renatured";

  return (
    <div className="relative mx-auto min-h-[420px] overflow-hidden rounded-[30px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/50 to-emerald-50/50 shadow-inner" dir="rtl">
      <div className="absolute inset-x-5 top-5 flex justify-center">
        {badge && <span className="rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-black text-violet-800 shadow-sm">{badge}</span>}
      </div>

      <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2">
        <div className={cn(
          "relative transition-all duration-700",
          unfolded ? "h-24 w-[340px]" : refolding ? "h-44 w-[280px]" : "h-56 w-56"
        )}>
          {Array.from({length:8}).map((_,i)=>{
            const folded = [[45,12],[68,28],[67,52],[53,72],[30,68],[18,46],[28,24],[47,42]][i];
            const flat = [5+i*13, 50+(i%2?12:-12)];
            const partial = [[20,35],[35,22],[52,35],[68,28],[72,55],[55,68],[38,60],[27,50]][i];
            const p = unfolded ? flat : refolding ? partial : folded;
            return <span key={i} className={cn(
              "absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white font-black text-white shadow-lg transition-all duration-700",
              i%2 ? "bg-sky-600" : "bg-violet-600"
            )} style={{left:`${p[0]}%`,top:`${p[1]}%`}}>{i+1}</span>
          })}
          {native && <>
            <span className="absolute left-[30%] top-[38%] rounded-lg bg-amber-100 px-2 py-1 text-xs font-black text-amber-800">S–S</span>
            <span className="absolute right-[20%] bottom-[28%] rounded-lg bg-amber-100 px-2 py-1 text-xs font-black text-amber-800">S–S</span>
          </>}
        </div>
      </div>

      <div className="absolute bottom-7 left-1/2 w-[82%] -translate-x-1/2">
        <div className="mb-2 flex justify-between text-xs font-black text-slate-600"><span>النشاط الإنزيمي</span><span>{activity}%</span></div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{width:`${activity}%`}} /></div>
      </div>
    </div>
  );
}

function ShapeFunctionScene({ shape = "correct", works = true, badge = "" }) {
  const correct = shape === "correct";
  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-amber-100 bg-gradient-to-br from-white via-amber-50/50 to-sky-50/50 shadow-inner" dir="rtl">
      <div className="absolute inset-x-5 top-5 flex justify-center">
        {badge && <span className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-black text-amber-800 shadow-sm">{badge}</span>}
      </div>
      <div className="absolute left-1/2 top-[53%] flex -translate-x-1/2 -translate-y-1/2 items-center gap-12" dir="ltr">
        <div className={cn(
          "relative h-40 w-40 border-[18px] shadow-xl transition-all duration-700",
          correct ? "rounded-[45%] border-violet-500" : "rotate-12 rounded-[25%] border-rose-500"
        )}>
          <div className={cn("absolute right-[-20px] top-[46px] h-48 w-16 bg-white", correct ? "rounded-l-full" : "rotate-12 rounded-xl")} />
        </div>
        <div className={cn(
          "h-20 w-20 rounded-full border-4 border-white shadow-xl transition-all duration-700",
          works ? "bg-emerald-500" : "translate-y-16 bg-slate-400"
        )} />
      </div>
      <div className="absolute bottom-8 inset-x-0 text-center text-sm font-black text-slate-600">
        {works ? "الشكل مناسب → الوظيفة ممكنة" : "تغير الشكل → فقدان الملاءمة → تغير النشاط"}
      </div>
    </div>
  );
}


function StructureFunctionChainScene({ level = 1, badge = "" }) {
  const steps = [
    ["AA", "التتابع"],
    ["R", "الجذور"],
    ["↔", "التآثرات"],
    ["3D", "الشكل"],
    ["✓", "الوظيفة"],
  ];
  return (
    <div className="relative mx-auto min-h-[400px] overflow-hidden rounded-[30px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/50 to-sky-50/50 p-6 shadow-inner" dir="rtl">
      <div className="flex justify-center">{badge && <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-sm">{badge}</span>}</div>
      <div className="mx-auto mt-24 flex max-w-4xl flex-wrap items-center justify-center gap-2">
        {steps.map(([icon,label],i)=><div key={label} className="flex items-center gap-2">
          <div className={cn("flex h-24 w-24 flex-col items-center justify-center rounded-[28px] border transition-all duration-500",
            level===i+1 ? "scale-110 border-violet-300 bg-violet-100 shadow-xl ring-8 ring-violet-50" : "border-slate-200 bg-white opacity-55")}>
            <span className="text-xl font-black text-violet-700">{icon}</span>
            <span className="mt-1 text-xs font-black text-slate-700">{label}</span>
          </div>
          {i<steps.length-1 && <span className="text-2xl font-black text-slate-300">←</span>}
        </div>)}
      </div>
      <div className="mt-14 text-center text-sm font-black text-slate-600">التتابع ← R ← التآثرات ← الشكل ← الوظيفة</div>
    </div>
  );
}

function FunctionalSiteFoldingScene({ stage = "linear", badge = "" }) {
  const folded = stage !== "linear";
  const site = stage === "site";
  const points = folded
    ? [[42,22],[62,30],[70,50],[57,67],[36,65],[27,45],[44,46],[53,48]]
    : [[12,50],[24,50],[36,50],[48,50],[60,50],[72,50],[84,50],[94,50]];
  const important = [1,4,7];

  return (
    <div className="relative mx-auto min-h-[400px] overflow-hidden rounded-[30px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/50 to-amber-50/40 shadow-inner" dir="rtl">
      <div className="absolute inset-x-5 top-5 flex justify-center">{badge && <span className="rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-black text-violet-800 shadow-sm">{badge}</span>}</div>
      <div className="relative mx-auto mt-20 h-[290px] max-w-2xl" dir="ltr">
        {points.map(([x,y],i)=><span key={i} className={cn(
          "absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white text-xs font-black text-white shadow-lg transition-all duration-700",
          important.includes(i) ? "bg-rose-600 ring-4 ring-rose-100" : "bg-sky-600"
        )} style={{left:`${x}%`,top:`${y}%`}}>{important.includes(i) ? "★" : i+1}</span>)}
        {site && <div className="absolute left-[48%] top-[48%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-dashed border-rose-400 bg-rose-100/30" />}
      </div>
      <div className="absolute bottom-7 inset-x-0 text-center text-sm font-black text-slate-600">
        {stage==="linear" ? "بعيدة في التتابع" : stage==="folding" ? "الانطواء يقرّبها" : "تجاورت في الفراغ → موقع وظيفي"}
      </div>
    </div>
  );
}

function ActiveSiteFitScene({ site = "normal", binds = true, badge = "" }) {
  const normal = site === "normal";
  return (
    <div className="relative mx-auto min-h-[390px] overflow-hidden rounded-[30px] border border-sky-100 bg-gradient-to-br from-white via-sky-50/50 to-emerald-50/50 shadow-inner" dir="rtl">
      <div className="absolute inset-x-5 top-5 flex justify-center">{badge && <span className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-800 shadow-sm">{badge}</span>}</div>
      <div className="absolute left-1/2 top-[54%] flex -translate-x-1/2 -translate-y-1/2 items-center gap-16" dir="ltr">
        <div className={cn("relative h-44 w-44 border-[22px] shadow-xl transition-all duration-700",
          normal ? "rounded-[46%] border-violet-500" : "rotate-12 rounded-[28%] border-rose-500")}>
          <div className={cn("absolute right-[-24px] top-[45px] h-60 w-20 bg-white", normal ? "rounded-l-full" : "rotate-12 rounded-xl")} />
        </div>
        <div className={cn("h-20 w-20 rounded-full border-4 border-white shadow-xl transition-all duration-700",
          binds ? "bg-emerald-500" : "translate-y-20 bg-slate-400")} />
      </div>
      <div className="absolute bottom-7 inset-x-0 text-center text-sm font-black text-slate-600">
        {binds ? "الموقع مناسب → الارتباط ممكن" : "الموقع تغير → الملاءمة أقل → النشاط قد ينخفض"}
      </div>
    </div>
  );
}

function AminoAcidSubstitutionScene({ stage = "normal_sequence", badge = "" }) {
  const steps = {
    normal_sequence: 1, mutation: 2, interaction: 3, shape: 4, activity: 5
  };
  const level = steps[stage] || 1;
  const labels = ["AA مشحون","R جديد","تآثر","شكل","نشاط"];
  return (
    <div className="relative mx-auto min-h-[410px] overflow-hidden rounded-[30px] border border-rose-100 bg-gradient-to-br from-white via-rose-50/40 to-violet-50/50 p-6 shadow-inner" dir="rtl">
      <div className="flex justify-center">{badge && <span className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-black text-rose-800 shadow-sm">{badge}</span>}</div>
      <div className="mx-auto mt-24 flex max-w-4xl flex-wrap items-center justify-center gap-2">
        {labels.map((label,i)=><div key={label} className="flex items-center gap-2">
          <div className={cn("flex h-24 w-24 items-center justify-center rounded-3xl border p-2 text-center text-xs font-black transition-all duration-500",
            level===i+1 ? "scale-110 border-rose-300 bg-rose-100 text-rose-900 shadow-xl ring-8 ring-rose-50" :
            level>i+1 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-400")}>{label}</div>
          {i<labels.length-1 && <span className="text-xl font-black text-slate-300">←</span>}
        </div>)}
      </div>
      <div className="mt-14 text-center text-sm font-black text-slate-600">تغير صغير في البداية قد يمتد أثره عبر السلسلة السببية</div>
    </div>
  );
}

function BacCausalChainScene({ level = 1, badge = "" }) {
  const labels = ["تغير AA","تغير R","تغير التآثرات","تغير الشكل","تغير الوظيفة"];
  return (
    <div className="relative mx-auto min-h-[400px] overflow-hidden rounded-[30px] border border-amber-100 bg-gradient-to-br from-white via-amber-50/40 to-emerald-50/40 p-6 shadow-inner" dir="rtl">
      <div className="flex justify-center">{badge && <span className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-black text-amber-800 shadow-sm">{badge}</span>}</div>
      <div className="mx-auto mt-20 max-w-2xl space-y-2">
        {labels.map((label,i)=><div key={label}>
          <div className={cn("mx-auto flex min-h-12 max-w-md items-center justify-center rounded-2xl border px-5 py-3 text-center text-sm font-black transition-all duration-500",
            level===i+1 ? "scale-105 border-violet-300 bg-violet-100 text-violet-900 shadow-lg" :
            level>i+1 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-400")}>{label}</div>
          {i<labels.length-1 && <div className="text-center text-xl font-black text-slate-300">↓</div>}
        </div>)}
      </div>
    </div>
  );
}

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
          {content.scene === "amino_acid" ? (
            <AminoAcidScene
              highlighted={highlighted}
              rootValue={currentFrame.root_value || "R"}
              rootKind={currentFrame.root_kind || ""}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "amino_acid_ph" ? (
            <AminoAcidPHScene
              aminoLabel={currentFrame.amino_label || "NH₃⁺"}
              carboxylLabel={currentFrame.carboxyl_label || "COO⁻"}
              netCharge={currentFrame.net_charge || "0"}
              phLabel={currentFrame.ph_label || "pH = pHi"}
              protonMode={currentFrame.proton_mode || "balanced"}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "ph_scale" ? (
            <PHScaleScene
              ph={Number(currentFrame.ph ?? 6)}
              phi={Number(currentFrame.phi ?? 6)}
              netCharge={currentFrame.net_charge || "0"}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "electrophoresis" ? (
            <ElectrophoresisScene
              positiveX={Number(currentFrame.positive_x ?? 50)}
              neutralX={Number(currentFrame.neutral_x ?? 50)}
              negativeX={Number(currentFrame.negative_x ?? 50)}
              showField={Boolean(currentFrame.show_field)}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "electrophoresis_single" ? (
            <SingleElectrophoresisScene
              x={Number(currentFrame.x ?? 50)}
              charge={currentFrame.charge || "0"}
              relation={currentFrame.ph_relation || "pH = pHi"}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "electrophoresis_three" ? (
            <ThreeAminoElectrophoresisScene
              aspX={Number(currentFrame.asp_x ?? 50)}
              alaX={Number(currentFrame.ala_x ?? 50)}
              lysX={Number(currentFrame.lys_x ?? 50)}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "peptide_bond" ? (
            <PeptideBondScene stage={currentFrame.stage || "separate"} badge={currentFrame.badge || ""} />
          ) : content.scene === "peptide_chain" ? (
            <PeptideChainScene count={Number(currentFrame.count ?? 1)} badge={currentFrame.badge || ""} />
          ) : content.scene === "peptide_direction" ? (
            <PeptideDirectionScene focus={currentFrame.focus || "chain"} badge={currentFrame.badge || ""} />
          ) : content.scene === "primary_structure" ? (
            <PrimaryStructureScene sequence={currentFrame.sequence || []} badge={currentFrame.badge || ""} highlightChange={Boolean(currentFrame.highlight_change)} />
          ) : content.scene === "secondary_structure" || content.scene === "hydrogen_bonds" ? (
            <SecondaryStructureScene shape={currentFrame.shape || "line"} badge={currentFrame.badge || ""} showBonds={Boolean(currentFrame.show_bonds)} />
          ) : content.scene === "tertiary_folding" ? (
            <TertiaryFoldingScene
              stage={currentFrame.stage || "secondary"}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "quaternary_assembly" ? (
            <QuaternaryAssemblyScene
              subunits={Number(currentFrame.subunits ?? 1)}
              assembled={Boolean(currentFrame.assembled)}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "protein_levels" ? (
            <ProteinLevelsScene
              level={Number(currentFrame.level ?? 1)}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "r_group_folding" ? (
            <RGroupFoldingScene
              stage={currentFrame.stage || "far"}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "stabilizing_bond" ? (
            <StabilizingBondScene
              bondType={currentFrame.bond_type || "disulfide"}
              stage={currentFrame.stage || "before"}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "hydrophobic_core" ? (
            <HydrophobicCoreScene
              inside={currentFrame.inside ?? false}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "protein_stability_map" ? (
            <ProteinStabilityMapScene
              show={currentFrame.show || "disulfide"}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "protein_denaturation" ? (
            <ProteinDenaturationScene
              stage={currentFrame.stage || "native"}
              activity={Number(currentFrame.activity ?? 100)}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "primary_structure_preserved" ? (
            <PrimaryStructurePreservedScene
              folded={Boolean(currentFrame.folded)}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "anfinsen_experiment" ? (
            <AnfinsenExperimentScene
              stage={currentFrame.stage || "native"}
              activity={Number(currentFrame.activity ?? 100)}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "shape_function" ? (
            <ShapeFunctionScene
              shape={currentFrame.shape || "correct"}
              works={Boolean(currentFrame.works)}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "structure_function_chain" ? (
            <StructureFunctionChainScene
              level={Number(currentFrame.level ?? 1)}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "functional_site_folding" ? (
            <FunctionalSiteFoldingScene
              stage={currentFrame.stage || "linear"}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "active_site_fit" ? (
            <ActiveSiteFitScene
              site={currentFrame.site || "normal"}
              binds={Boolean(currentFrame.binds)}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "amino_acid_substitution" ? (
            <AminoAcidSubstitutionScene
              stage={currentFrame.stage || "normal_sequence"}
              badge={currentFrame.badge || ""}
            />
          ) : content.scene === "bac_causal_chain" ? (
            <BacCausalChainScene
              level={Number(currentFrame.level ?? 1)}
              badge={currentFrame.badge || ""}
            />
          ) : (
            <CellScene highlighted={highlighted} />
          )}

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
          {content.scene === "amino_acid" ? (
            <AminoAcidScene
              highlighted={active?.id ? [active.id] : []}
              rootValue={active?.root_value || "R"}
              rootKind={active?.root_kind || ""}
              compact
            />
          ) : (
            <CellScene
              highlighted={highlightFor(active)}
            />
          )}

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
   نفس مبدأ IntroStep:
   - شرح مبسط
   - مثال
   - حفظ وعرض آخر 3 شروحات لكل مرحلة
========================================================= */

const SCIENCE_REEXPLAIN_ACTIONS = [
  {
    id: "explanation",
    requestType: "explanation",
    label: "أعد شرح المرحلة",
    shortLabel: "شرح مبسط",
    description: "نفس الفكرة بكلمات أسهل",
    icon: Brain,
    prompt:
      "أعد شرح هذه المرحلة فقط بطريقة بسيطة جدًا وواضحة، كأنني لم أفهمها من البداية. اشرح الفكرة العلمية خطوة بخطوة وبكلمات سهلة، ولا تضف مثالًا مستقلًا، ولا تخرج عن محتوى المرحلة.",
  },
  {
    id: "example",
    requestType: "example",
    label: "أعطني مثالًا",
    shortLabel: "مثال",
    description: "مثال واحد يثبت الفكرة",
    icon: Lightbulb,
    prompt:
      "أعطني مثالًا واحدًا بسيطًا وواضحًا من نفس المرحلة في العلوم الطبيعية، ثم اشرحه خطوة بخطوة حتى أصل إلى الفكرة أو الاستنتاج. لا تعِد شرح الدرس كاملًا ولا تخرج عن محتوى المرحلة.",
  },
];

/* =========================================================
   Helpers History
========================================================= */

function normalizeScienceReExplanationAnswer(payload) {
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

    if (!text) return null;

    const requestType =
      payload?.request_type ??
      payload?.requestType ??
      "";

    return {
      type:
        requestType === "example"
          ? "example"
          : "explanation",
      content: text,
    };
  }

  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    return null;
  }

  const rawType =
    candidate.type ??
    payload?.request_type ??
    payload?.requestType ??
    "";

  const type =
    rawType === "example"
      ? "example"
      : "explanation";

  const content =
    candidate.content ||
    (type === "example"
      ? candidate.example
      : candidate.explanation) ||
    candidate.simple_explanation ||
    candidate.direct_answer ||
    candidate.teacher_message ||
    candidate.text ||
    "";

  if (!String(content || "").trim()) {
    return null;
  }

  return {
    type,
    content: String(content).trim(),
  };
}

function extractScienceReExplanation(payload) {
  return (
    normalizeScienceReExplanationAnswer(
      payload,
    )?.content || ""
  );
}

function normalizeScienceHistoryItem(
  item,
  index = 0,
) {
  if (!item) return null;

  const answerData =
    normalizeScienceReExplanationAnswer(
      item,
    );

  const answer =
    extractScienceReExplanation(item);

  if (!answerData && !answer) {
    return null;
  }

  const question =
    item?.student_question ??
    item?.question ??
    item?.student_message ??
    "";

  const detectedType =
    item?.request_type ??
    item?.requestType ??
    answerData?.type ??
    (String(question).includes("مثال")
      ? "example"
      : "explanation");

  return {
    id:
      item?.id ??
      item?.history_id ??
      item?.re_explanation_id ??
      `science-history-${index}-${String(
        item?.created_at ||
          item?.createdAt ||
          "",
      )}`,

    stepId:
      item?.step_id ??
      item?.stepId ??
      item?.step?.id ??
      item?.lesson_step_id ??
      "",

    question,

    answer,

    answerData: {
      ...(answerData || {
        content: answer,
      }),

      type:
        detectedType === "example"
          ? "example"
          : "explanation",
    },

    requestType:
      detectedType === "example"
        ? "example"
        : "explanation",

    model:
      item?.model ??
      item?.model_name ??
      item?.ai_model ??
      "",

    createdAt:
      item?.created_at ??
      item?.createdAt ??
      item?.date_created ??
      item?.timestamp ??
      "",

    pending:
      Boolean(item?.pending),

    raw: item,
  };
}

function extractScienceHistoryArray(source) {
  if (!source) return [];

  if (Array.isArray(source)) {
    return source;
  }

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

  return (
    candidates.find(Array.isArray) || []
  );
}

function getScienceStepHistory(
  source,
  stepId,
) {
  const allItems =
    extractScienceHistoryArray(source);

  return allItems
    .map((item, index) =>
      normalizeScienceHistoryItem(
        item,
        index,
      ),
    )
    .filter(Boolean)
    .filter(
      (item) =>
        !item.stepId ||
        String(item.stepId) ===
          String(stepId || ""),
    );
}

function formatScienceHistoryDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "ar-DZ",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

/* =========================================================
   Text display helpers
========================================================= */

function normalizeScienceAssistantText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(
      /\\text\{([^{}]*)\}/g,
      "$1",
    )
    .replace(
      /\\mathrm\{([^{}]*)\}/g,
      "$1",
    )
    .replace(
      /\\\(([\s\S]*?)\\\)/g,
      "$1",
    )
    .replace(
      /\\\[([\s\S]*?)\\\]/g,
      "$1",
    )
    .replace(/\\alpha\b/g, "α")
    .replace(/\\beta\b/g, "β")
    .replace(/\\gamma\b/g, "γ")
    .replace(
      /\\longrightarrow\b/g,
      "→",
    )
    .replace(
      /\\rightarrow\b/g,
      "→",
    )
    .replace(
      /\\leftrightarrow\b/g,
      "↔",
    )
    .replace(/\\times\b/g, "×")
    .replace(/\\cdot\b/g, "·")
    .replace(/\\pm\b/g, "±")
    .replace(
      /\_\{([0-9]+)\}/g,
      (_, digits) =>
        String(digits)
          .replace(/0/g, "₀")
          .replace(/1/g, "₁")
          .replace(/2/g, "₂")
          .replace(/3/g, "₃")
          .replace(/4/g, "₄")
          .replace(/5/g, "₅")
          .replace(/6/g, "₆")
          .replace(/7/g, "₇")
          .replace(/8/g, "₈")
          .replace(/9/g, "₉"),
    )
    .replace(
      /\_([0-9]+)/g,
      (_, digits) =>
        String(digits)
          .replace(/0/g, "₀")
          .replace(/1/g, "₁")
          .replace(/2/g, "₂")
          .replace(/3/g, "₃")
          .replace(/4/g, "₄")
          .replace(/5/g, "₅")
          .replace(/6/g, "₆")
          .replace(/7/g, "₇")
          .replace(/8/g, "₈")
          .replace(/9/g, "₉"),
    )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ScienceAssistantAnswer({
  answer,
  requestType = "explanation",
}) {
  const answerObject =
    answer &&
    typeof answer === "object"
      ? answer
      : null;

  const rawContent =
    answerObject?.content ??
    answerObject?.answer ??
    answerObject?.explanation ??
    answerObject?.example ??
    answerObject?.text ??
    answer ??
    "";

  const normalized =
    normalizeScienceAssistantText(
      rawContent,
    );

  if (!normalized) return null;

  const type =
    answerObject?.type ??
    requestType ??
    "explanation";

  const isExample =
    type === "example";

  const blocks = normalized
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const isStepLine = (line) =>
    /^(?:الخطوة|خطوة|أولًا|أولا|ثانيًا|ثانيا|ثالثًا|ثالثا|رابعًا|رابعا|خامسًا|خامسا|سادسًا|سادسا|\d+[.)-])/u.test(
      line,
    );

  const isConclusion = (line) =>
    /^(?:الخلاصة|الاستنتاج|إذن|وبالتالي|النتيجة|نستنتج|تذكّر|تذكر|المهم)/u.test(
      line,
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            isExample
              ? "bg-amber-100 text-amber-700"
              : "bg-indigo-100 text-indigo-700",
          )}
        >
          {isExample ? (
            <Lightbulb size={17} />
          ) : (
            <Brain size={17} />
          )}
        </span>

        <div className="min-w-0">
          <p className="text-sm font-black text-slate-950">
            {isExample
              ? "مثال توضيحي"
              : "شرح مبسط"}
          </p>

          <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
            {isExample
              ? "مثال يساعدك على تثبيت الفكرة"
              : "نفس الفكرة بكلمات أبسط"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {blocks.map(
          (line, index) => {
            if (
              isConclusion(line)
            ) {
              return (
                <div
                  key={`assistant-conclusion-${index}`}
                  className="
                    flex
                    items-start
                    gap-3
                    rounded-2xl
                    border
                    border-emerald-200
                    bg-emerald-50/70
                    px-4
                    py-3.5
                  "
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <CheckCircle2
                      size={14}
                    />
                  </span>

                  <p className="text-[14px] font-bold leading-8 text-emerald-950 sm:text-[15px]">
                    {line}
                  </p>
                </div>
              );
            }

            if (isStepLine(line)) {
              return (
                <div
                  key={`assistant-step-${index}`}
                  className="
                    flex
                    items-start
                    gap-3
                    rounded-2xl
                    border
                    border-slate-200
                    bg-slate-50/70
                    px-4
                    py-3.5
                  "
                >
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-[11px] font-black text-white">
                    {index + 1}
                  </span>

                  <p className="text-[14px] font-semibold leading-8 text-slate-700 sm:text-[15px]">
                    {line}
                  </p>
                </div>
              );
            }

            return (
              <p
                key={`assistant-text-${index}`}
                className="
                  px-1
                  text-[14px]
                  font-semibold
                  leading-8
                  text-slate-700
                  sm:text-[15px]
                  sm:leading-9
                "
              >
                {line}
              </p>
            );
          },
        )}
      </div>
    </div>
  );
}

/* =========================================================
   Panel
========================================================= */

function ScienceReExplainPanel({
  step,
  axis,
  axisId,
  initialHistory = [],
  onReExplain,
}) {
  const COURSE_URL =
    import.meta.env.VITE_COURSE_URL;

  const endpoint =
    `${COURSE_URL}axes/re-explication/`;

  const { token } =
    useContext(UserContext);

  const [open, setOpen] =
    useState(false);

  const [
    loadingAction,
    setLoadingAction,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [history, setHistory] =
    useState([]);

  const abortRef = useRef(null);

  const requestIdRef =
    useRef(0);

  const activeStepIdRef =
    useRef(step?.id || "");

  const messagesEndRef =
    useRef(null);

  const shouldAutoScrollRef =
    useRef(false);

  const loading =
    Boolean(loadingAction);

  /*
   * عندما تتغير المرحلة:
   * - نقرأ الشروحات المحفوظة القادمة من الـ API
   * - نعرض فقط الشروحات الخاصة بهذه المرحلة
   * - آخر 3 فقط مثل IntroStep
   */
  useEffect(() => {
    const normalized =
      (
        Array.isArray(initialHistory)
          ? initialHistory
          : []
      )
        .map((item, index) =>
          normalizeScienceHistoryItem(
            item,
            index,
          ),
        )
        .filter(Boolean)
        .filter(
          (item) =>
            !item.stepId ||
            String(item.stepId) ===
              String(step?.id || ""),
        )
        .sort((a, b) => {
          const first =
            new Date(
              a.createdAt || 0,
            ).getTime();

          const second =
            new Date(
              b.createdAt || 0,
            ).getTime();

          return first - second;
        });

    activeStepIdRef.current =
      step?.id || "";

    requestIdRef.current += 1;

    abortRef.current?.abort();
    abortRef.current = null;

    setOpen(false);

    setLoadingAction("");
    setError("");

    shouldAutoScrollRef.current =
      false;

    setHistory(
      normalized.slice(-3),
    );

    return () => {
      abortRef.current?.abort();
    };
  }, [
    step?.id,
    initialHistory,
  ]);

  /*
   * Scroll seulement après une nouvelle demande.
   * L'ouverture du panneau ne fait pas descendre automatiquement.
   */
  useEffect(() => {
    if (
      !open ||
      !shouldAutoScrollRef.current
    ) {
      return;
    }

    messagesEndRef.current
      ?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });

    if (!loading) {
      shouldAutoScrollRef.current =
        false;
    }
  }, [
    history,
    loading,
    open,
  ]);

  async function ask(action) {
    if (!action || loading) {
      return;
    }

    if (
      !step ||
      typeof step !== "object" ||
      !step?.id
    ) {
      setError(
        "المرحلة الحالية غير صالحة.",
      );

      setOpen(true);

      return;
    }

    const resolvedAxisId =
      axisId ??
      axis?.id ??
      null;

    if (
      resolvedAxisId === null ||
      resolvedAxisId ===
        undefined ||
      resolvedAxisId === ""
    ) {
      setError(
        "معرف المحور غير موجود.",
      );

      setOpen(true);

      return;
    }

    const requestedStep = {
      id: step.id,

      type:
        step.type ||
        "lesson_step",

      title:
        step.title ||
        "شرح المرحلة",

      content:
        step.content ||
        {},
    };

    const requestedStepId =
      String(requestedStep.id);

    const currentRequestId =
      requestIdRef.current + 1;

    requestIdRef.current =
      currentRequestId;

    abortRef.current?.abort();

    const controller =
      new AbortController();

    abortRef.current =
      controller;

    const optimisticId =
      `science-pending-${currentRequestId}-${Date.now()}`;

    const optimisticItem = {
      id: optimisticId,

      stepId:
        requestedStepId,

      question:
        action.label,

      answer: "",

      answerData: {
        type:
          action.requestType,
        content: "",
      },

      requestType:
        action.requestType,

      model: "",

      createdAt:
        new Date().toISOString(),

      pending: true,
    };

    shouldAutoScrollRef.current =
      true;

    setOpen(true);
    setError("");

    setLoadingAction(
      action.id,
    );

    /*
     * نضيف رسالة مؤقتة بدون مسح الشروحات السابقة.
     */
    setHistory((current) =>
      [
        ...current.filter(
          (item) =>
            !item.pending,
        ),
        optimisticItem,
      ].slice(-3),
    );

    const payload = {
      step: requestedStep,

      student_question:
        action.prompt,

      request_type:
        action.requestType,

      axis_id:
        Number(
          resolvedAxisId,
        ),
    };

    try {
      let result;

      if (
        typeof onReExplain ===
        "function"
      ) {
        result =
          await onReExplain(
            payload,
            {
              signal:
                controller.signal,

              stepId:
                requestedStepId,

              actionId:
                action.id,
            },
          );
      } else {
        const response =
          await axios.post(
            endpoint,
            payload,
            {
              signal:
                controller.signal,

              headers: {
                "Content-Type":
                  "application/json",

                ...(token
                  ? {
                      Authorization:
                        `Bearer ${token}`,
                    }
                  : {}),
              },
            },
          );

        result =
          response.data;
      }

      if (
        controller.signal
          .aborted ||
        requestIdRef.current !==
          currentRequestId ||
        String(
          activeStepIdRef.current,
        ) !==
          requestedStepId
      ) {
        return;
      }

      const savedSource =
        result?.saved_explanation ||
        result;

      const normalizedAnswer =
        normalizeScienceReExplanationAnswer(
          {
            ...savedSource,
            ...result,

            request_type:
              action.requestType,
          },
        );

      if (
        !normalizedAnswer
      ) {
        throw new Error(
          "وصل جواب فارغ من الخادم.",
        );
      }

      const savedItem =
        normalizeScienceHistoryItem(
          {
            ...savedSource,
            ...result,

            step_id:
              result?.step_id ??
              savedSource?.step_id ??
              requestedStepId,

            student_question:
              action.label,

            request_type:
              action.requestType,

            answer:
              result?.answer ??
              savedSource?.answer ??
              normalizedAnswer,

            model:
              result?.model ??
              savedSource
                ?.model_name ??
              "",

            created_at:
              savedSource
                ?.created_at ||
              savedSource
                ?.updated_at ||
              new Date()
                .toISOString(),
          },
          currentRequestId,
        );

      if (!savedItem) {
        throw new Error(
          "وصل جواب فارغ من الخادم.",
        );
      }

      /*
       * نحذف العنصر المؤقت ثم نضيف الشرح المحفوظ.
       * نبقي آخر 3 فقط، مثل IntroStep.
       */
      setHistory(
        (current) => {
          const withoutPending =
            current.filter(
              (item) =>
                item.id !==
                optimisticId,
            );

          const withoutDuplicate =
            withoutPending.filter(
              (item) =>
                String(
                  item.id,
                ) !==
                String(
                  savedItem.id,
                ),
            );

          return [
            ...withoutDuplicate,
            savedItem,
          ].slice(-3);
        },
      );
    } catch (
      requestError
    ) {
      setHistory(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              optimisticId,
          ),
      );

      if (
        axios.isCancel(
          requestError,
        ) ||
        requestError?.code ===
          "ERR_CANCELED" ||
        controller.signal.aborted
      ) {
        return;
      }

      const responseData =
        requestError?.response
          ?.data;

      let serializerMessage =
        "";

      if (
        responseData &&
        typeof responseData ===
          "object"
      ) {
        serializerMessage =
          Object.values(
            responseData,
          )
            .flat()
            .find(
              (value) =>
                typeof value ===
                "string",
            );
      }

      setError(
        responseData?.detail ||
          responseData?.error ||
          responseData?.message ||
          serializerMessage ||
          requestError?.message ||
          "حدث خطأ أثناء إنشاء المساعدة.",
      );
    } finally {
      if (
        requestIdRef.current ===
          currentRequestId &&
        String(
          activeStepIdRef.current,
        ) ===
          requestedStepId
      ) {
        setLoadingAction("");
      }
    }
  }

  return (
    <section
      dir="rtl"
      className="
        mt-6
        overflow-hidden
        rounded-[26px]
        border
        border-slate-200/90
        bg-white
        shadow-[0_18px_55px_-32px_rgba(15,23,42,0.45)]
      "
    >
      {/* رأس المساعد */}
      <button
        type="button"
        onClick={() =>
          setOpen(
            (value) => !value,
          )
        }
        className="
          group
          flex
          w-full
          items-center
          justify-between
          gap-3
          bg-white
          px-4
          py-3
          text-right
          transition
          hover:bg-slate-50/80
          sm:px-5
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="
              relative
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-gradient-to-br
              from-indigo-600
              via-violet-600
              to-fuchsia-600
              text-white
              shadow-lg
              shadow-indigo-500/25
            "
          >
            <WandSparkles
              size={19}
            />

            <span
              className="
                absolute
                -bottom-0.5
                -left-0.5
                h-3
                w-3
                rounded-full
                border-2
                border-white
                bg-emerald-400
              "
            />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-black text-slate-950">
                المساعد الذكي
              </h3>

              {history.filter(
                (item) =>
                  !item.pending,
              ).length > 0 && (
                <span
                  className="
                    rounded-full
                    bg-indigo-50
                    px-2
                    py-0.5
                    text-[10px]
                    font-black
                    text-indigo-700
                  "
                >
                  {
                    history.filter(
                      (item) =>
                        !item.pending,
                    ).length
                  }
                  /3
                </span>
              )}
            </div>

            <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
              لم تفهم؟ اختر شرحًا أبسط أو شاهد مثالًا
            </p>
          </div>
        </div>

        <span
          className="
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-xl
            border
            border-slate-200
            bg-slate-50
            text-slate-600
            transition
            group-hover:border-indigo-200
            group-hover:bg-indigo-50
            group-hover:text-indigo-700
          "
        >
          {open ? (
            <ChevronUp
              size={16}
            />
          ) : (
            <ChevronDown
              size={16}
            />
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-3 sm:p-4">
          {/* الخيارات */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SCIENCE_REEXPLAIN_ACTIONS.map(
              (action) => {
                const Icon =
                  action.icon;

                const isLoading =
                  loadingAction ===
                  action.id;

                return (
                  <button
                    key={
                      action.id
                    }
                    type="button"
                    onClick={() =>
                      ask(action)
                    }
                    disabled={
                      loading
                    }
                    className={cn(
                      `
                        group/action
                        flex
                        min-h-[66px]
                        items-center
                        gap-3
                        rounded-2xl
                        border
                        bg-white
                        px-4
                        py-3
                        text-right
                        shadow-sm
                        transition
                        duration-200
                      `,
                      isLoading
                        ? "border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-100"
                        : "border-slate-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md",

                      loading &&
                        !isLoading &&
                        "cursor-not-allowed opacity-45",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition",

                        action.id ===
                          "example"
                          ? "bg-amber-500 group-hover/action:bg-amber-600"
                          : "bg-indigo-600 group-hover/action:bg-indigo-700",
                      )}
                    >
                      {isLoading ? (
                        <Loader2
                          className="animate-spin"
                          size={17}
                        />
                      ) : (
                        <Icon
                          size={17}
                        />
                      )}
                    </span>

                    <span className="min-w-0">
                      <span className="block text-xs font-black text-slate-900 sm:text-[13px]">
                        {
                          action.shortLabel
                        }
                      </span>

                      <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-500 sm:text-[11px]">
                        {
                          action.description
                        }
                      </span>
                    </span>
                  </button>
                );
              },
            )}
          </div>

          {/* الخطأ */}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-rose-800">
              <AlertTriangle
                className="mt-0.5 shrink-0"
                size={15}
              />

              <p className="text-[11px] font-bold leading-5">
                {error}
              </p>
            </div>
          )}

          {/* History */}
          {history.length >
            0 && (
            <div className="mt-4 space-y-3">
              {history.map(
                (
                  item,
                  index,
                ) => {
                  const itemType =
                    item
                      ?.answerData
                      ?.type ??
                    item
                      ?.requestType ??
                    "explanation";

                  const isExample =
                    itemType ===
                    "example";

                  return (
                    <article
                      key={
                        item.id ||
                        index
                      }
                      className="
                        overflow-hidden
                        rounded-[24px]
                        border
                        border-slate-200
                        bg-white
                        shadow-sm
                      "
                    >
                      <header
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3
                          border-b
                          border-slate-100
                          bg-white
                          px-3.5
                          py-2.5
                          sm:px-4
                        "
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",

                              item.pending
                                ? "bg-indigo-50 text-indigo-700"
                                : isExample
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-indigo-50 text-indigo-700",
                            )}
                          >
                            {item.pending ? (
                              <Loader2
                                className="animate-spin"
                                size={14}
                              />
                            ) : isExample ? (
                              <Lightbulb
                                size={14}
                              />
                            ) : (
                              <Brain
                                size={14}
                              />
                            )}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-black text-slate-900">
                              {item.question ||
                                (isExample
                                  ? "مثال"
                                  : "شرح مبسط")}
                            </p>

                            {item.model && (
                              <p className="truncate text-[9px] font-semibold text-slate-400">
                                {
                                  item.model
                                }
                              </p>
                            )}
                          </div>
                        </div>

                        {item.createdAt &&
                          !item.pending && (
                            <span className="shrink-0 text-[9px] font-semibold text-slate-400">
                              {formatScienceHistoryDate(
                                item.createdAt,
                              )}
                            </span>
                          )}
                      </header>

                      <div className="p-4 sm:p-5">
                        {item.pending ? (
                          <div
                            className="
                              flex
                              items-center
                              gap-3
                              rounded-2xl
                              border
                              border-indigo-100
                              bg-indigo-50/70
                              px-4
                              py-3
                            "
                          >
                            <Loader2
                              className="animate-spin text-indigo-600"
                              size={16}
                            />

                            <div>
                              <p className="text-xs font-black text-indigo-950">
                                {isExample
                                  ? "أحضّر لك مثالًا بسيطًا..."
                                  : "أعيد صياغة الفكرة بطريقة أسهل..."}
                              </p>

                              <p className="mt-0.5 text-[10px] font-semibold text-indigo-600">
                                سيظهر الجواب هنا مباشرة
                              </p>
                            </div>
                          </div>
                        ) : (
                          <ScienceAssistantAnswer
                            answer={
                              item.answerData ||
                              item.answer
                            }
                            requestType={
                              itemType
                            }
                          />
                        )}
                      </div>
                    </article>
                  );
                },
              )}

              <div
                ref={
                  messagesEndRef
                }
              />
            </div>
          )}

          {!loading &&
            history.length ===
              0 &&
            !error && (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-4 text-center">
                <p className="text-[11px] font-bold text-slate-400">
                  اختر أحد الخيارين وسيظهر الشرح هنا، وسيبقى محفوظًا عند العودة إلى المرحلة.
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
                    initialHistory={getScienceStepHistory(
                      data,
                      activePage?.id,
                    )}
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
