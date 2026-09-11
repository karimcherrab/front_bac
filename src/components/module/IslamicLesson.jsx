// src/components/islamicCourse/IslamicLessonMastery10.jsx
// واجهة احترافية لدروس العلوم الإسلامية
// React + TailwindCSS + lucide-react فقط

import { useEffect, useMemo, useState } from "react";
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
  Lightbulb,
  ListChecks,
  Menu,
  RotateCcw,
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
  return Array.isArray(value) ? value : value ? [value] : [];
}

function normalizeLesson(data) {
  return data?.lesson || data?.axis?.content || data?.content || data || null;
}

function getLessonTitle(lesson) {
  return lesson?.title || "درس العلوم الإسلامية";
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function axisQuestionIds(axis) {
  return arr(axis?.quick_check).map((q) => q.id).filter(Boolean);
}

function normalizeArabic(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0621-\u064A0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordCoverage(answer, keywords) {
  const list = arr(keywords);
  if (!answer.trim() || !list.length) return null;
  const haystack = normalizeArabic(answer);
  const hits = list.filter((word) => haystack.includes(normalizeArabic(word))).length;
  return {
    hits,
    total: list.length,
    value: Math.round((hits / list.length) * 100),
  };
}

/* =========================================================
   UI primitives
========================================================= */

function SoftButton({
  children,
  onClick,
  disabled = false,
  active = false,
  className = "",
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition",
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

function SectionLabel({ children, icon: Icon = null }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[11px] font-black text-stone-400">
      {Icon ? <Icon size={14} className="text-emerald-800" /> : <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />}
      {children}
    </div>
  );
}

function Panel({ children, className = "" }) {
  return (
    <div className={cn("rounded-[28px] border border-stone-200 bg-white p-5 sm:p-6", className)}>
      {children}
    </div>
  );
}

function DarkPanel({ children, className = "" }) {
  return (
    <div className={cn("rounded-[28px] bg-stone-950 p-5 text-white sm:p-6", className)}>
      {children}
    </div>
  );
}

function TinyBadge({ children, tone = "stone" }) {
  const styles = {
    stone: "bg-stone-100 text-stone-600",
    emerald: "bg-emerald-50 text-emerald-900",
    dark: "bg-stone-950 text-white",
    amber: "bg-amber-50 text-amber-900",
  };

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-black", styles[tone] || styles.stone)}>
      {children}
    </span>
  );
}

function ProgressBar({ value }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
      <div
        className="h-full rounded-full bg-emerald-800 transition-all duration-300"
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

/* =========================================================
   Header + overview drawer
========================================================= */

function Header({ lesson, progress, onOpenInfo, onGoHome }) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onGoHome}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-950 text-white"
          aria-label="العودة إلى بداية الدرس"
        >
          <BookOpen size={18} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black text-emerald-800">
                العلوم الإسلامية · الدرس {lesson?.order || lesson?.unit_number || 1}
              </p>
              <h1 className="mt-0.5 truncate text-sm font-black text-stone-950 sm:text-base">
                {getLessonTitle(lesson)}
              </h1>
            </div>
            <span className="hidden text-xs font-black text-stone-500 sm:block">{progress}% إتقان</span>
          </div>
          <div className="mt-2 max-w-xl">
            <ProgressBar value={progress} />
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenInfo}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-50"
          aria-label="معلومات الدرس"
        >
          <Menu size={18} />
        </button>
      </div>
    </header>
  );
}

function InfoDrawer({ open, onClose, lesson }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/30 backdrop-blur-sm"
      />
      <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-emerald-800">معلومات الدرس</p>
            <h2 className="mt-1 text-xl font-black leading-8 text-stone-950">{getLessonTitle(lesson)}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-stone-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-8 space-y-8">
          {lesson?.lesson_goal && (
            <div>
              <SectionLabel icon={Target}>هدف الدرس</SectionLabel>
              <p className="text-sm font-semibold leading-8 text-stone-700">{lesson.lesson_goal}</p>
            </div>
          )}

          {arr(lesson?.learning_outcomes).length > 0 && (
            <div>
              <SectionLabel icon={CheckCircle2}>بعد الدرس تستطيع</SectionLabel>
              <div className="space-y-2.5">
                {lesson.learning_outcomes.map((item, index) => (
                  <p key={index} className="flex gap-2 text-sm font-semibold leading-7 text-stone-700">
                    <Check size={14} className="mt-1.5 shrink-0 text-emerald-800" />
                    {item}
                  </p>
                ))}
              </div>
            </div>
          )}

          {arr(lesson?.source_basis).length > 0 && (
            <div>
              <SectionLabel icon={BookOpen}>المصادر المستعملة</SectionLabel>
              <div className="space-y-3">
                {lesson.source_basis.map((source) => (
                  <div key={source.id || source.title} className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-sm font-black leading-7 text-stone-900">{source.title}</p>
                    <p className="mt-1 text-xs font-bold text-emerald-800">الصفحة {source.page}</p>
                    <p className="mt-2 text-xs font-semibold leading-6 text-stone-600">{source.role}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lesson?.content_policy?.bac_ideas_note && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-950">
              {lesson.content_policy.bac_ideas_note}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/* =========================================================
   Sidebar navigation
========================================================= */

function NavItem({ active, done, icon: Icon, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl px-3 py-3 text-right transition",
        active ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-white",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
            active
              ? "border-white/20 bg-white/10 text-white"
              : done
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-stone-200 bg-white text-stone-500",
          )}
        >
          {done && !active ? <Check size={14} /> : <Icon size={15} />}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-black leading-6">{title}</span>
          {subtitle && (
            <span className={cn("mt-0.5 block text-[10px] font-bold leading-5", active ? "text-stone-300" : "text-stone-400")}>
              {subtitle}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

function Sidebar({ lesson, screen, axisIndex, completedAxes, onNavigate }) {
  const axes = arr(lesson?.axes);

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-[86px] space-y-2 rounded-[30px] border border-stone-200 bg-stone-50 p-3">
        <NavItem
          active={screen === "home"}
          done={false}
          icon={BookOpen}
          title="نظرة عامة"
          subtitle="الهدف وخريطة الدرس"
          onClick={() => onNavigate("home")}
        />

        <div className="my-2 h-px bg-stone-200" />

        {axes.map((axis, index) => (
          <NavItem
            key={axis.id}
            active={screen === "axis" && axisIndex === index}
            done={completedAxes.has(axis.id)}
            icon={Brain}
            title={`${index + 1}. ${axis.title}`}
            subtitle={axis.objective}
            onClick={() => onNavigate("axis", index)}
          />
        ))}

        <div className="my-2 h-px bg-stone-200" />

        <NavItem
          active={screen === "bac"}
          done={false}
          icon={GraduationCap}
          title="أفكار البكالوريا"
          subtitle="صيغ الأسئلة وطريقة الإجابة"
          onClick={() => onNavigate("bac")}
        />
        <NavItem
          active={screen === "review"}
          done={false}
          icon={RotateCcw}
          title="المراجعة الذكية"
          subtitle="استرجاع متباعد"
          onClick={() => onNavigate("review")}
        />
        <NavItem
          active={screen === "test"}
          done={false}
          icon={Trophy}
          title="اختبار الإتقان"
          subtitle="تأكد أنك أتقنت الدرس"
          onClick={() => onNavigate("test")}
        />
      </div>
    </aside>
  );
}

function MobileNav({ lesson, screen, axisIndex, completedAxes, onNavigate }) {
  const axes = arr(lesson?.axes);

  const items = [
    { id: "home", label: "نظرة عامة", icon: BookOpen },
    ...axes.map((axis, index) => ({ id: `axis-${index}`, label: `محور ${index + 1}`, icon: Brain, axisIndex: index, axisId: axis.id })),
    { id: "bac", label: "البكالوريا", icon: GraduationCap },
    { id: "review", label: "مراجعة", icon: RotateCcw },
    { id: "test", label: "اختبار", icon: Trophy },
  ];

  return (
    <div className="border-b border-stone-200 bg-stone-50 lg:hidden">
      <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-3 sm:px-6">
        {items.map((item) => {
          const active = item.axisIndex !== undefined ? screen === "axis" && axisIndex === item.axisIndex : screen === item.id;
          const done = item.axisId ? completedAxes.has(item.axisId) : false;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => item.axisIndex !== undefined ? onNavigate("axis", item.axisIndex) : onNavigate(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition",
                active ? "bg-stone-950 text-white" : "border border-stone-200 bg-white text-stone-600",
              )}
            >
              {done && !active ? <Check size={13} /> : <Icon size={13} />}
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   Home screen
========================================================= */

function HomeScreen({ lesson, completedAxes, onStartAxis, onNavigate }) {
  const axes = arr(lesson?.axes);
  const completion = percent(completedAxes.size, axes.length);

  return (
    <div className="space-y-8 py-7 sm:py-10">
      <section className="rounded-[34px] border border-stone-200 bg-white p-6 shadow-[0_22px_70px_rgba(28,25,23,.06)] sm:p-8 lg:p-10">
        <div className="grid gap-8 xl:grid-cols-[1fr_320px] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <TinyBadge tone="emerald">الدرس {lesson?.order || 1}</TinyBadge>
              <TinyBadge>{lesson?.difficulty || "أساسي"}</TinyBadge>
              <TinyBadge>{lesson?.estimated_minutes || 50} دقيقة</TinyBadge>
            </div>

            <h2 className="mt-5 max-w-4xl text-3xl font-black leading-[1.55] text-stone-950 sm:text-4xl lg:text-5xl">
              {getLessonTitle(lesson)}
            </h2>
            <p className="mt-5 max-w-3xl text-base font-semibold leading-9 text-stone-600 sm:text-lg">
              {lesson?.lesson_goal}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onStartAxis(0)}
                className="inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-5 py-3 text-sm font-black text-white transition hover:bg-stone-800"
              >
                {completedAxes.size ? "واصل التعلم" : "ابدأ الدرس"}
                <ArrowLeft size={16} />
              </button>
              <SoftButton onClick={() => onNavigate("bac")}>
                <GraduationCap size={16} /> أفكار البكالوريا
              </SoftButton>
            </div>
          </div>

          <DarkPanel>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black text-emerald-300">تقدمك في المحاور</p>
                <p className="mt-2 text-4xl font-black">{completion}%</p>
              </div>
              <Target size={36} className="text-emerald-300" />
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-300" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-4 text-sm font-semibold leading-7 text-stone-300">
              {completedAxes.size} من {axes.length} محاور تم إتقان أسئلتها القصيرة.
            </p>
          </DarkPanel>
        </div>
      </section>

      <section>
        <SectionLabel icon={ListChecks}>خريطة الدرس</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          {axes.map((axis, index) => {
            const done = completedAxes.has(axis.id);
            return (
              <button
                type="button"
                onClick={() => onStartAxis(index)}
                key={axis.id}
                className="group rounded-[28px] border border-stone-200 bg-white p-5 text-right transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-sm sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black", done ? "bg-emerald-900 text-white" : "bg-stone-100 text-stone-600")}>
                    {done ? <Check size={17} /> : index + 1}
                  </span>
                  <ArrowLeft size={17} className="mt-2 text-stone-300 transition group-hover:text-stone-700" />
                </div>
                <h3 className="mt-5 text-lg font-black leading-8 text-stone-950">{axis.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-stone-500">{axis.objective}</p>
                <div className="mt-4">
                  <TinyBadge tone={done ? "emerald" : "stone"}>{done ? "متقن" : "جاهز للتعلم"}</TinyBadge>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {arr(lesson?.learning_outcomes).length > 0 && (
        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Panel>
            <SectionLabel icon={CheckCircle2}>بعد إتمام الدرس</SectionLabel>
            <div className="space-y-3">
              {lesson.learning_outcomes.map((item, index) => (
                <p key={index} className="flex gap-3 text-sm font-semibold leading-7 text-stone-700">
                  <CheckCircle2 size={16} className="mt-1.5 shrink-0 text-emerald-800" />
                  {item}
                </p>
              ))}
            </div>
          </Panel>

          <Panel className="bg-emerald-950 text-white">
            <SectionLabel icon={Sparkles}>طريقة الدراسة في المنصة</SectionLabel>
            <div className="space-y-4">
              {["افهم الفكرة قبل الحفظ", "ثبّت عناصر الحفظ", "اربط الدليل الشرعي بالمعنى", "اختبر نفسك دون النظر", "راجع بصيغ البكالوريا"].map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 text-xs font-black text-emerald-200">{index + 1}</span>
                  <span className="text-sm font-bold text-stone-100">{item}</span>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      )}
    </div>
  );
}

/* =========================================================
   Axis tabs
========================================================= */

const AXIS_TABS = [
  { id: "understand", label: "افهم", icon: Brain },
  { id: "memorize", label: "احفظ", icon: Eye },
  { id: "evidence", label: "الدليل الشرعي", icon: BookOpen },
  { id: "check", label: "اختبر فهمك", icon: Target },
];

function AxisTabs({ active, onChange, axis }) {
  return (
    <div className="mb-7 overflow-x-auto">
      <div className="flex min-w-max gap-2 rounded-2xl bg-stone-100 p-1.5">
        {AXIS_TABS.map((tab) => {
          const Icon = tab.icon;
          const emptyEvidence = tab.id === "evidence" && arr(axis?.evidences).length === 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition",
                active === tab.id ? "bg-white text-stone-950 shadow-sm" : "text-stone-500 hover:text-stone-800",
              )}
            >
              <Icon size={14} />
              {tab.label}
              {emptyEvidence && <span className="text-[9px] text-stone-300">—</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AxisHeader({ axis, index, total }) {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center gap-2">
        <TinyBadge tone="emerald">المحور {index + 1} من {total}</TinyBadge>
        <TinyBadge>مهارة قابلة للإتقان</TinyBadge>
      </div>
      <h2 className="mt-4 text-3xl font-black leading-[1.5] text-stone-950 sm:text-4xl">{axis.title}</h2>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-8 text-stone-600 sm:text-base">{axis.objective}</p>
    </div>
  );
}

function UnderstandPanel({ axis }) {
  return (
    <div className="space-y-7">
      <Panel>
        <SectionLabel icon={Lightbulb}>الشرح المبسط</SectionLabel>
        <div className="space-y-4">
          {arr(axis.explanation).map((paragraph, index) => (
            <p key={index} className="text-[15px] font-semibold leading-9 text-stone-700 sm:text-base">{paragraph}</p>
          ))}
        </div>
      </Panel>

      {arr(axis.key_concepts).length > 0 && (
        <section>
          <SectionLabel icon={Brain}>المفاهيم الأساسية</SectionLabel>
          <div className="grid gap-4 md:grid-cols-2">
            {axis.key_concepts.map((item, index) => (
              <Panel key={`${item.term}-${index}`}>
                <p className="text-xs font-black text-emerald-800">{item.term}</p>
                <p className="mt-3 text-base font-black leading-8 text-stone-950">{item.definition}</p>
              </Panel>
            ))}
          </div>
        </section>
      )}

      {arr(axis.understand).length > 0 && (
        <Panel className="border-emerald-200 bg-emerald-50/60">
          <SectionLabel icon={Sparkles}>افهم الفكرة</SectionLabel>
          <div className="space-y-3">
            {axis.understand.map((item, index) => (
              <div key={index} className="flex gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-[10px] font-black text-white">{index + 1}</span>
                <p className="text-sm font-bold leading-8 text-stone-700">{item}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {arr(axis.exam_focus).length > 0 && (
          <Panel>
            <SectionLabel icon={GraduationCap}>كيف يأتي في البكالوريا؟</SectionLabel>
            <div className="space-y-3">
              {axis.exam_focus.map((item, index) => (
                <p key={index} className="flex gap-2 text-sm font-bold leading-7 text-stone-700">
                  <GraduationCap size={15} className="mt-1.5 shrink-0 text-emerald-800" />
                  {item}
                </p>
              ))}
            </div>
          </Panel>
        )}

        {arr(axis.common_mistakes).length > 0 && (
          <Panel>
            <SectionLabel icon={ShieldCheck}>أخطاء شائعة تجنبها</SectionLabel>
            <div className="space-y-3">
              {axis.common_mistakes.map((item, index) => (
                <p key={index} className="flex gap-2 text-sm font-bold leading-7 text-stone-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  {item}
                </p>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function MemorizePanel({ axis }) {
  const [hidden, setHidden] = useState(false);
  const memory = axis?.memorize;
  const structured = Boolean(memory && !Array.isArray(memory) && typeof memory === "object");

  const blocks = structured
    ? arr(memory.blocks)
    : arr(memory).map((text, index) => ({
        id: `legacy-memory-${index + 1}`,
        label: `العنصر ${index + 1}`,
        badge: "حفظ",
        text,
        cue: [],
      }));

  const map = structured ? memory.mind_map : null;
  const mapBranches = arr(map?.branches);

  const cueParts = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return String(value)
      .split(/←|→|↔|\+|\//)
      .map((part) => part.trim())
      .filter(Boolean);
  };

  if (!blocks.length) {
    return <EmptyState title="لا توجد عناصر حفظ مستقلة في هذا المحور." />;
  }

  return (
    <div className="space-y-8">
      {/* رأس ركن الحفظ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <TinyBadge tone="emerald">حفظ حرفي</TinyBadge>
            <TinyBadge>{blocks.length} عناصر</TinyBadge>
          </div>
          <h3 className="mt-4 text-2xl font-black leading-9 text-stone-950">
            {structured ? memory.title || "ما الذي يجب أن تحفظه حرفيًا؟" : "ما الذي يجب أن تحفظه؟"}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-8 text-stone-500">
            {structured
              ? memory.subtitle || "ابدأ بالخريطة الذهنية، ثم احفظ الصياغة المكتوبة كما هي، وبعدها اختبر نفسك بإخفاء النص."
              : "افهمه أولًا، ثم اختبر ذاكرتك بإخفاء العناصر."}
          </p>
        </div>

        <SoftButton active={hidden} onClick={() => setHidden((value) => !value)}>
          <Eye size={15} /> {hidden ? "اكشف النصوص الحرفية" : "اختبر حفظي"}
        </SoftButton>
      </div>

      {/* الخريطة الذهنية */}
      {map && mapBranches.length > 0 && (
        <section>
          <SectionLabel icon={Brain}>الخريطة الذهنية للحفظ</SectionLabel>

          <div className="overflow-hidden rounded-[32px] border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-5 sm:p-7">
            <div className="mx-auto flex max-w-sm justify-center">
              <div className="rounded-3xl bg-emerald-950 px-6 py-4 text-center text-white shadow-[0_16px_45px_rgba(6,78,59,.14)]">
                <p className="text-[10px] font-black text-emerald-300">مركز الخريطة</p>
                <p className="mt-1 text-lg font-black leading-8">{map.center || axis.title}</p>
              </div>
            </div>

            <div className="mx-auto h-8 w-px bg-emerald-300" />

            <div className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <span className="pointer-events-none absolute left-[8%] right-[8%] top-0 hidden h-px bg-emerald-200 md:block" />

              {mapBranches.map((branch, index) => {
                const parts = cueParts(branch.cue);
                return (
                  <div key={`${branch.label}-${index}`} className="relative pt-0 md:pt-5">
                    <span className="pointer-events-none absolute left-1/2 top-0 hidden h-5 w-px -translate-x-1/2 bg-emerald-200 md:block" />

                    <Panel className="h-full border-emerald-100 bg-white/95 p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-xs font-black text-emerald-950">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black leading-7 text-stone-950">{branch.label}</p>

                          {parts.length > 0 ? (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                              {parts.map((part, partIndex) => (
                                <div key={`${part}-${partIndex}`} className="contents">
                                  <span className="rounded-xl bg-stone-100 px-2.5 py-1.5 text-[11px] font-black leading-5 text-stone-700">
                                    {part}
                                  </span>
                                  {partIndex < parts.length - 1 && (
                                    <ArrowLeft size={12} className="shrink-0 text-emerald-500" />
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs font-bold leading-6 text-stone-500">{branch.cue}</p>
                          )}
                        </div>
                      </div>
                    </Panel>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* النص الحرفي الكامل */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionLabel icon={CheckCircle2}>النص الذي يُحفظ كما هو</SectionLabel>
          <p className="text-[11px] font-bold text-stone-400">
            {hidden ? "النص مخفي الآن — استرجعه من الكلمات المفتاحية" : "اقرأ بصوت مرتفع ثم أعده دون النظر"}
          </p>
        </div>

        <div className="space-y-4">
          {blocks.map((item, index) => {
            const cues = cueParts(item.cue);
            return (
              <Panel key={item.id || index} className="relative overflow-hidden p-0">
                <div className="border-b border-stone-100 bg-stone-50/70 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-stone-950 text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-black leading-7 text-stone-950">{item.label || `العنصر ${index + 1}`}</p>
                      </div>
                    </div>
                    <TinyBadge tone="emerald">{item.badge || "حفظ حرفي"}</TinyBadge>
                  </div>
                </div>

                <div className="px-5 py-5 sm:px-6 sm:py-6">
                  {hidden ? (
                    <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-4 sm:p-5">
                      <p className="text-[11px] font-black text-emerald-800">استرجع النص من هذه المفاتيح</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(cues.length ? cues : ["حاول قول النص كاملًا دون النظر"]).map((cue, cueIndex) => (
                          <span key={`${cue}-${cueIndex}`} className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-black leading-6 text-stone-700">
                            {cue}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[17px] font-black leading-[2.15] text-stone-950 sm:text-lg">
                        {item.text}
                      </p>

                      {cues.length > 0 && (
                        <div className="mt-5 border-t border-stone-100 pt-4">
                          <p className="text-[10px] font-black text-stone-400">مفاتيح الاسترجاع</p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {cues.map((cue, cueIndex) => (
                              <div key={`${cue}-${cueIndex}`} className="contents">
                                <span className="rounded-lg bg-stone-100 px-2.5 py-1.5 text-[11px] font-black text-stone-700">
                                  {cue}
                                </span>
                                {cueIndex < cues.length - 1 && (
                                  <ArrowLeft size={11} className="text-stone-300" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {item.evidence && !hidden && (
                    <div className="mt-5 rounded-2xl border-r-4 border-emerald-700 bg-emerald-50/60 px-4 py-4 sm:px-5">
                      <div className="flex items-center gap-2 text-[11px] font-black text-emerald-900">
                        <BookOpen size={14} /> الدليل المرتبط بهذا العنصر
                      </div>
                      <p className="mt-3 text-base font-black leading-[2] text-stone-950 sm:text-lg">
                        {item.evidence.text}
                      </p>
                      {item.evidence.reference && (
                        <p className="mt-2 text-xs font-black text-emerald-800">{item.evidence.reference}</p>
                      )}
                    </div>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      {/* السلسلة النهائية */}
      {structured && memory.recall_chain && (
        <DarkPanel>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
              <Sparkles size={18} />
            </span>
            <div>
              <p className="text-[11px] font-black text-emerald-300">السلسلة الذهنية الأخيرة</p>
              <p className="mt-2 text-base font-black leading-8 text-white">{memory.recall_chain}</p>
              <p className="mt-2 text-xs font-semibold leading-6 text-stone-300">
                إذا استطعت تحويل هذه السلسلة إلى النصوص الكاملة أعلاه دون النظر، فقد ثبت الحفظ.
              </p>
            </div>
          </div>
        </DarkPanel>
      )}
    </div>
  );
}

function EvidenceCard({ evidence, index }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <TinyBadge tone="emerald">دليل {index + 1}</TinyBadge>
          <p className="mt-4 text-xl font-black leading-[2.1] text-stone-950 sm:text-2xl">{evidence.text}</p>
          {evidence.reference && <p className="mt-2 text-xs font-black text-emerald-800">{evidence.reference}</p>}
        </div>
        <BookOpen size={20} className="mt-1 shrink-0 text-stone-300" />
      </div>

      <div className="mt-5 border-t border-stone-100 pt-5">
        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="text-sm font-black text-emerald-800 hover:text-emerald-950"
          >
            حاول تحديد الأثر ثم اكشف وجه الاستدلال
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-black text-stone-400">الأثر</p>
              <p className="mt-1 text-base font-black leading-7 text-emerald-950">{evidence.effect}</p>
            </div>
            {evidence.connection && (
              <div>
                <p className="text-[11px] font-black text-stone-400">وجه الاستدلال</p>
                <p className="mt-1 text-sm font-semibold leading-8 text-stone-700">{evidence.connection}</p>
              </div>
            )}
            <button type="button" onClick={() => setRevealed(false)} className="text-xs font-black text-stone-400 hover:text-stone-700">
              أخفِ الإجابة
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function EvidencePanel({ axis }) {
  const evidences = arr(axis.evidences);

  if (!evidences.length) {
    return (
      <EmptyState
        icon={BookOpen}
        title="لا يوجد دليل مستقل مطلوب في هذا المحور ضمن الصفحات المرفقة."
        description="ركز هنا على التعريفات والمفاهيم، وستظهر النصوص الشرعية في المحاور التي تتناول آثار العقيدة."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="max-w-3xl">
        <p className="text-lg font-black text-stone-950">الدليل ليس للحفظ المنفصل فقط</p>
        <p className="mt-2 text-sm font-semibold leading-8 text-stone-600">
          المطلوب أن تعرف الكلمة أو المعنى الذي يقودك إلى الأثر الصحيح في السؤال.
        </p>
      </div>
      {evidences.map((evidence, index) => (
        <EvidenceCard key={evidence.id || index} evidence={evidence} index={index} />
      ))}
    </div>
  );
}

function LocalCoverage({ coverage }) {
  if (!coverage) return null;

  const label = coverage.value >= 75 ? "ذكرت معظم الكلمات المفتاحية" : coverage.value >= 40 ? "الإجابة قريبة وتحتاج تدقيقًا" : "راجع الإجابة النموذجية";

  return (
    <div className="rounded-2xl bg-stone-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-black text-stone-700">مؤشر الكلمات المفتاحية</p>
        <span className="text-xs font-black text-emerald-900">{coverage.hits}/{coverage.total}</span>
      </div>
      <div className="mt-2"><ProgressBar value={coverage.value} /></div>
      <p className="mt-2 text-[11px] font-bold leading-5 text-stone-500">{label} — هذا مؤشر مساعد وليس تصحيحًا دلاليًا نهائيًا.</p>
    </div>
  );
}

function QuestionCard({
  question,
  number,
  status,
  onStatus,
  onEvaluateAnswer,
  namespace = "q",
}) {
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [aiState, setAiState] = useState({ loading: false, result: null, error: "" });
  const coverage = revealed ? keywordCoverage(answer, question.keywords) : null;
  const key = `${namespace}:${question.id || number}`;

  const evaluate = async () => {
    if (!onEvaluateAnswer || !answer.trim()) return;
    setAiState({ loading: true, result: null, error: "" });
    try {
      const result = await onEvaluateAnswer({ question, answer, key });
      setAiState({ loading: false, result: result || null, error: "" });
    } catch (error) {
      setAiState({ loading: false, result: null, error: error?.message || "تعذر تصحيح الإجابة الآن." });
    }
  };

  return (
    <Panel>
      <div className="flex items-start gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-stone-950 text-xs font-black text-white">{number}</span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black leading-8 text-stone-950">{question.prompt || question.question}</p>

          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={3}
            placeholder="اكتب إجابتك من ذاكرتك هنا..."
            className="mt-4 w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm font-semibold leading-7 text-stone-800 outline-none transition focus:border-emerald-700 focus:bg-white"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <SoftButton onClick={() => setRevealed((v) => !v)} active={revealed}>
              <Eye size={14} /> {revealed ? "أخفِ الإجابة" : "اكشف الإجابة"}
            </SoftButton>
            {onEvaluateAnswer && (
              <SoftButton onClick={evaluate} disabled={!answer.trim() || aiState.loading}>
                <Sparkles size={14} /> {aiState.loading ? "جاري التصحيح..." : "تصحيح بالذكاء الاصطناعي"}
              </SoftButton>
            )}
          </div>

          {revealed && (
            <div className="mt-5 space-y-4 border-t border-stone-100 pt-5">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-[11px] font-black text-emerald-800">الإجابة النموذجية</p>
                <p className="mt-2 text-sm font-black leading-8 text-emerald-950">{question.answer}</p>
              </div>
              <LocalCoverage coverage={coverage} />
              <div>
                <p className="mb-2 text-xs font-black text-stone-500">قيّم نفسك بعد المقارنة:</p>
                <div className="flex flex-wrap gap-2">
                  <SoftButton active={status === true} onClick={() => onStatus(key, true)}>
                    <CheckCircle2 size={14} /> أتقنتها
                  </SoftButton>
                  <SoftButton active={status === false} onClick={() => onStatus(key, false)}>
                    <RotateCcw size={14} /> أحتاج مراجعة
                  </SoftButton>
                </div>
              </div>
            </div>
          )}

          {aiState.result && (
            <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-[11px] font-black text-violet-800">تصحيح الذكاء الاصطناعي</p>
              {aiState.result.score !== undefined && <p className="mt-1 text-lg font-black text-violet-950">{aiState.result.score}</p>}
              {aiState.result.feedback && <p className="mt-2 text-sm font-semibold leading-7 text-violet-900">{aiState.result.feedback}</p>}
            </div>
          )}

          {aiState.error && <p className="mt-3 text-xs font-bold text-rose-700">{aiState.error}</p>}
        </div>
      </div>
    </Panel>
  );
}

function QuickCheckPanel({ axis, answerStatus, onStatus, onEvaluateAnswer }) {
  const questions = arr(axis.quick_check);
  const ids = questions.map((q, index) => `axis:${axis.id}:${q.id || index}`);
  const mastered = ids.filter((id) => answerStatus[id] === true).length;

  if (!questions.length) {
    return <EmptyState title="لا توجد أسئلة تحقق في هذا المحور." />;
  }

  return (
    <div className="space-y-5">
      <DarkPanel>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-emerald-300">إتقان المحور</p>
            <p className="mt-1 text-2xl font-black">{mastered} / {questions.length}</p>
          </div>
          <Target size={28} className="text-emerald-300" />
        </div>
        <p className="mt-3 text-sm font-semibold leading-7 text-stone-300">
          حاول الإجابة قبل كشف الحل. يُعد المحور متقنًا عندما تضع جميع الأسئلة في «أتقنتها».
        </p>
      </DarkPanel>

      {questions.map((question, index) => (
        <QuestionCard
          key={question.id || index}
          question={question}
          number={index + 1}
          status={answerStatus[`axis:${axis.id}:${question.id || index}`]}
          onStatus={(key, value) => onStatus(key, value, axis)}
          onEvaluateAnswer={onEvaluateAnswer}
          namespace={`axis:${axis.id}`}
        />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon = CircleHelp, title, description = "" }) {
  return (
    <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-900 shadow-sm">
        <Icon size={20} />
      </span>
      <p className="mt-4 text-base font-black text-stone-900">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-7 text-stone-500">{description}</p>}
    </div>
  );
}

function AxisScreen({
  lesson,
  axisIndex,
  activeTab,
  onTabChange,
  answerStatus,
  onStatus,
  onEvaluateAnswer,
  onPrevious,
  onNext,
}) {
  const axes = arr(lesson?.axes);
  const axis = axes[axisIndex];

  if (!axis) return <EmptyState title="المحور غير موجود." />;

  return (
    <div className="py-7 sm:py-10">
      <AxisHeader axis={axis} index={axisIndex} total={axes.length} />
      <AxisTabs active={activeTab} onChange={onTabChange} axis={axis} />

      {activeTab === "understand" && <UnderstandPanel axis={axis} />}
      {activeTab === "memorize" && <MemorizePanel axis={axis} />}
      {activeTab === "evidence" && <EvidencePanel axis={axis} />}
      {activeTab === "check" && (
        <QuickCheckPanel
          axis={axis}
          answerStatus={answerStatus}
          onStatus={onStatus}
          onEvaluateAnswer={onEvaluateAnswer}
        />
      )}

      <div className="mt-9 flex items-center justify-between gap-3 border-t border-stone-200 pt-5">
        <SoftButton onClick={onPrevious} disabled={axisIndex === 0}>
          <ArrowRight size={15} /> المحور السابق
        </SoftButton>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-5 py-3 text-sm font-black text-white transition hover:bg-stone-800"
        >
          {axisIndex === axes.length - 1 ? "أفكار البكالوريا" : "المحور التالي"}
          <ArrowLeft size={15} />
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   BAC ideas
========================================================= */

function BacIdeaCard({ idea, index }) {
  const [open, setOpen] = useState(false);

  return (
    <Panel>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-right">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <TinyBadge tone="emerald">فكرة {index + 1}</TinyBadge>
              <TinyBadge>{idea.skill}</TinyBadge>
            </div>
            <h3 className="mt-4 text-lg font-black leading-8 text-stone-950">{idea.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-8 text-stone-700">{idea.prompt}</p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {open && (
        <div className="mt-5 border-t border-stone-100 pt-5">
          <p className="text-[11px] font-black text-emerald-800">إجابة نموذجية مختصرة</p>
          <p className="mt-2 text-sm font-black leading-8 text-stone-800">{idea.model_answer}</p>
          {idea.source_kind && <p className="mt-4 text-[10px] font-bold text-stone-400">{idea.source_kind}</p>}
        </div>
      )}
    </Panel>
  );
}

function BacIdeasScreen({ lesson, onGoTest }) {
  const ideas = arr(lesson?.bac_ideas);

  return (
    <div className="space-y-7 py-7 sm:py-10">
      <div className="max-w-4xl">
        <div className="flex items-center gap-2">
          <TinyBadge tone="dark">البكالوريا</TinyBadge>
          <TinyBadge>{ideas.length} أفكار</TinyBadge>
        </div>
        <h2 className="mt-4 text-3xl font-black leading-[1.5] text-stone-950 sm:text-4xl">أفكار السؤال التي يجب أن تتقنها</h2>
        <p className="mt-3 text-sm font-semibold leading-8 text-stone-600 sm:text-base">
          لا تحفظ الجواب فقط. تعرّف أولًا على فعل السؤال: عرّف، اذكر، فرّق، استخرج؛ ثم أعطِ جوابًا مباشرًا ومحددًا.
        </p>
      </div>

      {lesson?.content_policy?.bac_ideas_note && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-950">
          {lesson.content_policy.bac_ideas_note}
        </div>
      )}

      <div className="space-y-4">
        {ideas.map((idea, index) => (
          <BacIdeaCard key={idea.id || index} idea={idea} index={index} />
        ))}
      </div>

      <DarkPanel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black text-emerald-300">المرحلة التالية</p>
            <p className="mt-1 text-lg font-black">هل تستطيع الإجابة دون فتح البطاقات؟</p>
          </div>
          <button
            type="button"
            onClick={onGoTest}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-stone-950"
          >
            ابدأ اختبار الإتقان <ArrowLeft size={15} />
          </button>
        </div>
      </DarkPanel>
    </div>
  );
}

/* =========================================================
   Review plan
========================================================= */

function ReviewScreen({ lesson }) {
  const schedule = arr(lesson?.review_plan);
  const axes = arr(lesson?.axes);

  return (
    <div className="space-y-8 py-7 sm:py-10">
      <div className="max-w-4xl">
        <TinyBadge tone="emerald">مراجعة ذكية</TinyBadge>
        <h2 className="mt-4 text-3xl font-black leading-[1.5] text-stone-950 sm:text-4xl">لا تترك الدرس يختفي من الذاكرة</h2>
        <p className="mt-3 text-sm font-semibold leading-8 text-stone-600 sm:text-base">
          المراجعة هنا تعتمد على الاسترجاع من الذاكرة، لا على إعادة قراءة الدرس كاملًا كل مرة.
        </p>
      </div>

      <Panel>
        <SectionLabel icon={Clock3}>خطة المراجعة المتباعدة</SectionLabel>
        <div className="mt-5">
          {schedule.map((item, index) => (
            <div key={index} className="grid grid-cols-[36px_1fr] gap-4">
              <div className="flex flex-col items-center">
                <span className="mt-1 h-3 w-3 rounded-full border-[3px] border-emerald-800 bg-white" />
                {index < schedule.length - 1 && <span className="h-full w-px bg-stone-200" />}
              </div>
              <div className="pb-7">
                <p className="text-xs font-black text-emerald-800">{item.when}</p>
                <p className="mt-2 text-sm font-bold leading-8 text-stone-700">{item.task}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <section>
        <SectionLabel icon={Brain}>استرجاع سريع للمحاور</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          {axes.map((axis, index) => (
            <Panel key={axis.id}>
              <p className="text-[11px] font-black text-stone-400">المحور {index + 1}</p>
              <p className="mt-1 text-base font-black text-stone-950">{axis.title}</p>
              <p className="mt-3 text-sm font-semibold leading-7 text-stone-600">
                أغلق الدرس وحاول شرح هذا المحور في دقيقة واحدة، ثم افتحه وتحقق مما نسيته.
              </p>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   Final test
========================================================= */

function FinalTestScreen({ lesson, answerStatus, onStatus, onEvaluateAnswer, onComplete }) {
  const test = lesson?.final_test || {};
  const questions = arr(test.questions);
  const keys = questions.map((q, index) => `final:${q.id || index}`);
  const mastered = keys.filter((key) => answerStatus[key] === true).length;
  const reviewed = keys.filter((key) => answerStatus[key] !== undefined).length;
  const passScore = Number(test.pass_score) || Math.ceil(questions.length * 0.75);
  const passed = mastered >= passScore;

  return (
    <div className="space-y-6 py-7 sm:py-10">
      <div className="grid gap-5 xl:grid-cols-[1fr_300px] xl:items-start">
        <div>
          <TinyBadge tone="dark">اختبار الإتقان</TinyBadge>
          <h2 className="mt-4 text-3xl font-black leading-[1.5] text-stone-950 sm:text-4xl">{test.title || "اختبار إتقان الدرس"}</h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-8 text-stone-600 sm:text-base">{test.instructions}</p>
        </div>

        <DarkPanel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black text-emerald-300">نتيجتك الذاتية</p>
              <p className="mt-2 text-3xl font-black">{mastered} / {questions.length}</p>
            </div>
            <Trophy size={30} className="text-emerald-300" />
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-300" style={{ width: `${percent(mastered, questions.length)}%` }} />
          </div>
          <p className="mt-3 text-xs font-semibold leading-6 text-stone-300">
            شرط الإتقان في الملف: {passScore}/{questions.length} على الأقل.
          </p>
        </DarkPanel>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id || index}
            question={question}
            number={index + 1}
            status={answerStatus[`final:${question.id || index}`]}
            onStatus={onStatus}
            onEvaluateAnswer={onEvaluateAnswer}
            namespace="final"
          />
        ))}
      </div>

      {reviewed === questions.length && (
        <div className={cn("rounded-[28px] border p-6", passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={cn("text-sm font-black", passed ? "text-emerald-950" : "text-amber-950")}>
                {passed ? "أحسنت، وصلت إلى حد الإتقان المطلوب." : "تحتاج مراجعة الأسئلة التي وضعتها في «أحتاج مراجعة»."}
              </p>
              <p className="mt-1 text-xs font-semibold leading-6 text-stone-600">
                الإتقان هنا تقييم ذاتي ما لم تربط المكوّن بخدمة تصحيح الذكاء الاصطناعي عبر onEvaluateAnswer.
              </p>
            </div>
            {passed && (
              <button
                type="button"
                onClick={() => onComplete?.({ score: mastered, total: questions.length })}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-3 text-sm font-black text-white"
              >
                إنهاء الدرس <CheckCircle2 size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Main component
========================================================= */

export default function IslamicLessonMastery10({
  data,
  onComplete,
  onEvaluateAnswer,
}) {
  const lesson = normalizeLesson(data);
  const axes = useMemo(() => arr(lesson?.axes), [lesson]);

  const [screen, setScreen] = useState("home");
  const [axisIndex, setAxisIndex] = useState(0);
  const [axisTab, setAxisTab] = useState("understand");
  const [infoOpen, setInfoOpen] = useState(false);
  const [answerStatus, setAnswerStatus] = useState({});
  const [completedAxes, setCompletedAxes] = useState(() => new Set());

  useEffect(() => {
    setScreen("home");
    setAxisIndex(0);
    setAxisTab("understand");
    setAnswerStatus({});
    setCompletedAxes(new Set());
  }, [lesson?.id]);

  if (!lesson) {
    return (
      <div dir="rtl" className="min-h-screen bg-stone-50 p-6">
        <EmptyState title="لا توجد بيانات للدرس." description="مرّر ملف JSON إلى الخاصية data." />
      </div>
    );
  }

  if (!axes.length) {
    return (
      <div dir="rtl" className="min-h-screen bg-stone-50 p-6">
        <EmptyState title="ملف الدرس لا يحتوي على محاور." description="يجب أن يحتوي lesson.axes على محور واحد على الأقل." />
      </div>
    );
  }

  const questionTotal = axes.reduce((sum, axis) => sum + axisQuestionIds(axis).length, 0);
  const axisMasteredQuestions = Object.entries(answerStatus).filter(([key, value]) => key.startsWith("axis:") && value === true).length;
  const lessonProgress = percent(axisMasteredQuestions, questionTotal);

  const navigate = (target, nextAxisIndex = axisIndex) => {
    if (target === "axis") {
      const safe = Math.max(0, Math.min(nextAxisIndex, axes.length - 1));
      setAxisIndex(safe);
      setAxisTab("understand");
      setScreen("axis");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setScreen(target);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStatus = (key, value, axis = null) => {
    setAnswerStatus((previous) => {
      const next = { ...previous, [key]: value };

      if (axis?.id) {
        const keys = axisQuestionIds(axis).map((id) => `axis:${axis.id}:${id}`);
        const mastered = keys.length > 0 && keys.every((itemKey) => next[itemKey] === true);
        setCompletedAxes((current) => {
          const updated = new Set(current);
          if (mastered) updated.add(axis.id);
          else updated.delete(axis.id);
          return updated;
        });
      }

      return next;
    });
  };

  const nextAxis = () => {
    if (axisIndex < axes.length - 1) {
      navigate("axis", axisIndex + 1);
    } else {
      navigate("bac");
    }
  };

  const previousAxis = () => {
    if (axisIndex > 0) navigate("axis", axisIndex - 1);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f6f2] text-stone-950">
      <Header
        lesson={lesson}
        progress={lessonProgress}
        onOpenInfo={() => setInfoOpen(true)}
        onGoHome={() => navigate("home")}
      />

      <MobileNav
        lesson={lesson}
        screen={screen}
        axisIndex={axisIndex}
        completedAxes={completedAxes}
        onNavigate={navigate}
      />

      <div className="mx-auto grid max-w-7xl gap-7 px-4 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <Sidebar
          lesson={lesson}
          screen={screen}
          axisIndex={axisIndex}
          completedAxes={completedAxes}
          onNavigate={navigate}
        />

        <main className="min-w-0">
          {screen === "home" && (
            <HomeScreen
              lesson={lesson}
              completedAxes={completedAxes}
              onStartAxis={(index) => navigate("axis", index)}
              onNavigate={navigate}
            />
          )}

          {screen === "axis" && (
            <AxisScreen
              lesson={lesson}
              axisIndex={axisIndex}
              activeTab={axisTab}
              onTabChange={setAxisTab}
              answerStatus={answerStatus}
              onStatus={handleStatus}
              onEvaluateAnswer={onEvaluateAnswer}
              onPrevious={previousAxis}
              onNext={nextAxis}
            />
          )}

          {screen === "bac" && <BacIdeasScreen lesson={lesson} onGoTest={() => navigate("test")} />}
          {screen === "review" && <ReviewScreen lesson={lesson} />}
          {screen === "test" && (
            <FinalTestScreen
              lesson={lesson}
              answerStatus={answerStatus}
              onStatus={handleStatus}
              onEvaluateAnswer={onEvaluateAnswer}
              onComplete={onComplete}
            />
          )}
        </main>
      </div>

      <InfoDrawer open={infoOpen} onClose={() => setInfoOpen(false)} lesson={lesson} />
    </div>
  );
}
