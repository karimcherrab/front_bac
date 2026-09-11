// src/components/civilEngineering/CivilEngineeringLesson.jsx
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Eye,
  GraduationCap,
  Layers3,
  Lightbulb,
  Map,
  RotateCcw,
  Route,
  Sparkles,
  Target,
  TriangleAlert,
  Trophy,
  X,
} from "lucide-react";

/* =========================================================
   Helpers
========================================================= */

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return [value];
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

function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ar");
}

function isCorrect(question, value) {
  return (
    normalizeComparable(value) ===
    normalizeComparable(
      question?.correct_answer ??
        question?.answer ??
        "",
    )
  );
}

function scrollToTop() {
  window.requestAnimationFrame(() => {
    document
      .getElementById("civil-course-card-top")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  });
}

/* =========================================================
   Shared UI
========================================================= */

const TONES = {
  amber: {
    border: "border-amber-200",
    soft: "bg-amber-50",
    text: "text-amber-800",
    icon: "from-amber-500 to-orange-600",
  },
  sky: {
    border: "border-sky-200",
    soft: "bg-sky-50",
    text: "text-sky-800",
    icon: "from-sky-500 to-cyan-600",
  },
  indigo: {
    border: "border-indigo-200",
    soft: "bg-indigo-50",
    text: "text-indigo-800",
    icon: "from-indigo-500 to-violet-600",
  },
  emerald: {
    border: "border-emerald-200",
    soft: "bg-emerald-50",
    text: "text-emerald-800",
    icon: "from-emerald-500 to-teal-600",
  },
  rose: {
    border: "border-rose-200",
    soft: "bg-rose-50",
    text: "text-rose-800",
    icon: "from-rose-500 to-red-600",
  },
};

function InfoCard({
  title,
  children,
  icon: Icon = Lightbulb,
  tone = "amber",
}) {
  const t = TONES[tone] || TONES.amber;

  return (
    <div
      className={cn(
        "rounded-[24px] border p-4 sm:p-5",
        t.border,
        t.soft,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Icon size={18} className={t.text} />
        </span>

        <div className="min-w-0 flex-1">
          {title && (
            <h3 className="mb-1 font-black text-slate-950">
              {title}
            </h3>
          )}

          <div className="text-sm font-semibold leading-7 text-slate-700 sm:text-base">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Reveal({
  title,
  children,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right font-black text-slate-800"
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
          <div className="border-t border-slate-100 bg-slate-50/60 p-4 text-sm font-semibold leading-7 text-slate-700">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Takeaway({ children }) {
  if (!children) return null;

  return (
    <div className="mt-5 flex items-start gap-3 rounded-[22px] border border-amber-200 bg-amber-50 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
        <Lightbulb size={18} />
      </span>
      <p className="font-black leading-7 text-amber-950">
        {children}
      </p>
    </div>
  );
}

/* =========================================================
   Building SVG
========================================================= */

const ELEMENT_STYLES = {
  foundation: "fill-slate-500",
  column: "fill-amber-500",
  beam: "fill-sky-500",
  floor: "fill-indigo-400",
  wall: "fill-stone-200",
  roof: "fill-emerald-500",
  opening: "fill-cyan-300",
  stairs: "fill-orange-300",
};

function BuildingDiagram({ items = [] }) {
  const [selected, setSelected] = useState("column");

  const itemMap = useMemo(
    () =>
      Object.fromEntries(
        items.map((item) => [item.id, item]),
      ),
    [items],
  );

  const active = itemMap[selected] || items[0];

  function partClass(id) {
    return cn(
      "cursor-pointer transition-all duration-300",
      ELEMENT_STYLES[id] || "fill-slate-300",
      selected === id
        ? "opacity-100 drop-shadow-[0_6px_8px_rgba(15,23,42,.22)]"
        : "opacity-65 hover:opacity-100",
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-amber-50 p-3 sm:p-5">
        <svg
          viewBox="0 0 900 580"
          className="h-auto w-full"
          role="img"
          aria-label="رسم مبسط لبناية يوضح الأساس والعمود والرافدة والأرضية والجدار والسطح والفتحة والمدرج"
        >
          <rect
            x="50"
            y="510"
            width="800"
            height="20"
            rx="10"
            className="fill-stone-300"
          />

          {/* Foundations */}
          <g
            onClick={() => setSelected("foundation")}
            className={partClass("foundation")}
          >
            <path d="M150 470 H260 L285 510 H125 Z" />
            <path d="M625 470 H735 L760 510 H600 Z" />
          </g>

          {/* Columns */}
          <g
            onClick={() => setSelected("column")}
            className={partClass("column")}
          >
            <rect x="170" y="205" width="44" height="275" rx="6" />
            <rect x="660" y="205" width="44" height="275" rx="6" />
            <rect x="390" y="205" width="38" height="275" rx="6" />
          </g>

          {/* Beams */}
          <g
            onClick={() => setSelected("beam")}
            className={partClass("beam")}
          >
            <rect x="150" y="190" width="575" height="42" rx="7" />
            <rect x="150" y="325" width="575" height="34" rx="7" />
          </g>

          {/* Floors */}
          <g
            onClick={() => setSelected("floor")}
            className={partClass("floor")}
          >
            <path d="M135 305 L740 305 L700 325 L165 325 Z" />
          </g>

          {/* Walls */}
          <g
            onClick={() => setSelected("wall")}
            className={partClass("wall")}
          >
            <rect x="225" y="232" width="150" height="93" rx="4" />
            <rect x="445" y="232" width="200" height="93" rx="4" />
            <rect x="225" y="359" width="420" height="111" rx="4" />
          </g>

          {/* Openings */}
          <g
            onClick={() => setSelected("opening")}
            className={partClass("opening")}
          >
            <rect x="270" y="252" width="62" height="73" rx="4" />
            <rect x="510" y="252" width="72" height="54" rx="4" />
            <rect x="510" y="388" width="72" height="58" rx="4" />
          </g>

          {/* Roof */}
          <g
            onClick={() => setSelected("roof")}
            className={partClass("roof")}
          >
            <path d="M120 190 L435 70 L760 190 L720 205 L435 108 L155 205 Z" />
          </g>

          {/* Stairs */}
          <g
            onClick={() => setSelected("stairs")}
            className={partClass("stairs")}
          >
            <path d="M300 470 h38 v-20 h38 v-20 h38 v-20 h38 v-20 h38 v80 Z" />
          </g>

          {/* labels */}
          <g className="pointer-events-none fill-slate-700 text-[18px] font-bold">
            <text x="445" y="42" textAnchor="middle">
              اضغط على أجزاء البناية
            </text>
          </g>
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((item) => {
          const isActive = item.id === selected;
          const upper = item.group === "upper";

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.id)}
              className={cn(
                "rounded-2xl border px-3 py-3 text-right transition",
                isActive
                  ? "border-amber-400 bg-amber-50 ring-4 ring-amber-100"
                  : "border-slate-200 bg-white hover:bg-slate-50",
              )}
            >
              <span className="block text-sm font-black text-slate-900">
                {item.label}
              </span>
              <span
                className={cn(
                  "mt-1 block text-[11px] font-black",
                  upper
                    ? "text-emerald-600"
                    : "text-slate-500",
                )}
              >
                {upper ? "منشأ علوي" : "منشأ سفلي"}
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-lg text-slate-950">
              {active.label}
            </strong>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-black",
                active.group === "upper"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-700",
              )}
            >
              {active.group === "upper"
                ? "المنشأ العلوي"
                : "المنشأ السفلي"}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-7 text-slate-700">
            {active.short} — {active.detail}
          </p>
        </div>
      )}
    </div>
  );
}


/* =========================================================
   Generic educational media / structured content
========================================================= */

function sanitizeSvg(svg = "") {
  return String(svg)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, "")
    .replace(/javascript:/gi, "");
}

function EducationalGraph({ graph }) {
  if (!graph) return null;

  const safeSvg = graph?.svg ? sanitizeSvg(graph.svg) : "";

  return (
    <figure className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-3 sm:p-5">
      {graph?.title && (
        <figcaption className="mb-3 text-center font-black text-slate-950">
          {graph.title}
        </figcaption>
      )}

      {safeSvg ? (
        <div
          className="[&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full text-slate-700"
          role="img"
          aria-label={graph?.alt_text || graph?.title || "رسم تعليمي"}
          dangerouslySetInnerHTML={{ __html: safeSvg }}
        />
      ) : graph?.url || graph?.src ? (
        <img
          src={graph.url || graph.src}
          alt={graph?.alt_text || graph?.title || ""}
          loading="lazy"
          className="mx-auto h-auto max-h-[560px] w-full rounded-2xl object-contain"
        />
      ) : null}

      {graph?.description && (
        <p className="mt-3 text-center text-xs font-semibold leading-6 text-slate-500">
          {graph.description}
        </p>
      )}
    </figure>
  );
}


const FIELD_LABELS = {
  central_idea: "الفكرة المركزية",
  objectives_of_structure: "أهداف هيكلة القارعة",
  groups: "المجموعات",
  source_note: "ملاحظة من المصدر",
  term: "المصطلح",
  foreign_name: "المصطلح بالفرنسية",
  function: "الوظيفة",
  functions: "الوظائف",
  position: "الموضع",
  important_note: "ملاحظة مهمة",
  functions_and_properties: "الوظائف والخصائص",
  components: "المكونات",
  types: "الأنواع",
  factors: "العوامل المؤثرة",
  recognition_features: "خصائص التعرّف",
  recognition_clue: "مفتاح التعرّف",
  position_between_types: "موضعه بين الأنواع",
  subtypes: "الأنواع الفرعية",
  examples: "أمثلة تطبيقية",
  memory_tip: "مفتاح الحفظ",
  memory_pattern: "نمط الحفظ",
  method_template: "قالب المنهجية",
  answer_template: "قالب الإجابة",
  answer_templates: "قوالب الإجابة",
  definition: "التعريف",
  description: "الشرح",
  features: "الخصائص",
  key_points: "نقاط أساسية",
  observations: "ملاحظات",
  algorithm: "المنهجية",
  steps: "الخطوات",
  statement: "المطلوب",
  final_answer: "الجواب النهائي",
  attention: "انتبه",
  takeaway: "الخلاصة المهمة",
  classification_basis: "أساس التصنيف",
  where_used: "أين يستعمل؟",
  purpose: "الهدف",
  preparation: "طريقة الإعداد",
  importance: "الأهمية",
  main_information: "أهم المعلومات",
  main_clue: "مفتاح التعرّف",
  recognition: "طريقة التعرّف",
  reading_rule: "قاعدة القراءة",
  rules: "القواعد",
  data: "البيانات",
  elements: "العناصر",
  formulas: "العلاقات",
  formula: "العلاقة",
  variables: "الرموز والمعاني",
  source_example: "مثال من المصدر",
  example: "مثال",
  source_colors: "ألوان التمثيل في المصدر",
  source_colors_in_source: "ألوان التمثيل في المصدر",
  source_note: "ملاحظة من المصدر",
  source_colors: "ألوان المصدر",
  memory_sentence: "جملة للحفظ",
  rule: "القاعدة",
  load_path: "مسار الحمل",
  diagram: "الرسم",
  graph: "الرسم التعليمي",
};

const HIDDEN_GENERIC_KEYS = new Set([
  "teacher",
  "graph",
  "diagram",
  "definition",
  "categories",
  "comparison",
  "key_points",
  "observations",
  "features",
  "algorithm",
  "steps",
  "answer_templates",
  "statement",
  "final_answer",
  "attention",
  "takeaway",
]);

function humanizeKey(key) {
  return (
    FIELD_LABELS[key] ||
    String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
  );
}

function isPrimitive(value) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function PrimitiveValue({ value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700 sm:text-base">
      {typeof value === "boolean" ? (value ? "نعم" : "لا") : String(value)}
    </p>
  );
}

function ObjectDetails({ value, depth = 0 }) {
  if (value === null || value === undefined) return null;

  if (isPrimitive(value)) {
    return <PrimitiveValue value={value} />;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;

    const primitivesOnly = value.every((item) => isPrimitive(item));
    if (primitivesOnly) {
      return (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div
              key={`${String(item)}-${index}`}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">
                {index + 1}
              </span>
              <PrimitiveValue value={item} />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-2">
        {value.map((item, index) => (
          <div
            key={index}
            className="rounded-[22px] border border-slate-200 bg-white p-4"
          >
            {typeof item === "object" && item !== null &&
            (item.name || item.title || item.term || item.type || item.state) ? (
              <h4 className="mb-3 font-black text-slate-950">
                {item.name || item.title || item.term || item.type || item.state}
              </h4>
            ) : null}
            <ObjectDetails value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(value).filter(
    ([, item]) => item !== null && item !== undefined && item !== "",
  );
  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      {entries.map(([key, item]) => {
        if (["name", "title", "term", "type", "state"].includes(key)) {
          return null;
        }

        return (
          <div key={key} className="rounded-2xl bg-slate-50 p-3">
            <p className="mb-1 text-xs font-black text-slate-500">
              {humanizeKey(key)}
            </p>
            <ObjectDetails value={item} depth={depth + 1} />
          </div>
        );
      })}
    </div>
  );
}

function ExtraContentFields({ content }) {
  const entries = Object.entries(content || {}).filter(
    ([key, value]) =>
      !HIDDEN_GENERIC_KEYS.has(key) &&
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0),
  );

  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      {entries.map(([key, value], index) => (
        <div
          key={key}
          className={cn(
            "rounded-[26px] border p-4 sm:p-5",
            index % 3 === 0
              ? "border-sky-100 bg-sky-50/50"
              : index % 3 === 1
                ? "border-indigo-100 bg-indigo-50/40"
                : "border-amber-100 bg-amber-50/40",
          )}
        >
          <h3 className="mb-3 font-black text-slate-950">
            {humanizeKey(key)}
          </h3>
          <ObjectDetails value={value} />
        </div>
      ))}
    </div>
  );
}

function StructuredLessonStep({ content }) {
  const categories = toArray(content?.categories);
  const comparison = toArray(content?.comparison);
  const keyPoints = toArray(
    content?.key_points || content?.observations || content?.features,
  );
  const algorithm = toArray(content?.algorithm);
  const steps = toArray(content?.steps);
  const templates = toArray(content?.answer_templates);

  return (
    <div className="space-y-5">
      {content?.teacher && (
        <p className="text-base font-semibold leading-8 text-slate-700">
          {content.teacher}
        </p>
      )}

      {content?.definition && (
        <InfoCard title="التعريف" icon={BookOpen} tone="sky">
          {content.definition}
        </InfoCard>
      )}

      {keyPoints.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {keyPoints.map((item, index) => (
            <div
              key={`${getText(item)}-${index}`}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-700 shadow-sm">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                {typeof item === "object" && item !== null ? (
                  <ObjectDetails value={item} />
                ) : (
                  <p className="text-sm font-bold leading-7 text-slate-700">
                    {getText(item)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {categories.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category, index) => (
            <div
              key={`${category?.name || category?.title}-${index}`}
              className="rounded-[26px] border border-indigo-100 bg-indigo-50/50 p-5"
            >
              <h3 className="font-black text-slate-950">
                {category?.name || category?.title || `العنصر ${index + 1}`}
              </h3>
              <div className="mt-3">
                <ObjectDetails value={category} />
              </div>
            </div>
          ))}
        </div>
      )}

      {comparison.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {comparison.map((item, index) => (
            <div
              key={`${item?.item || item?.title || item?.type || index}-${index}`}
              className="rounded-[26px] border border-sky-200 bg-sky-50/60 p-5"
            >
              <h3 className="font-black text-slate-950">
                {item?.item || item?.title || item?.type || item?.state || `مقارنة ${index + 1}`}
              </h3>
              <div className="mt-3">
                <ObjectDetails value={item} />
              </div>
            </div>
          ))}
        </div>
      )}

      {content?.graph && <EducationalGraph graph={content.graph} />}
      {content?.diagram?.graph && (
        <EducationalGraph graph={content.diagram.graph} />
      )}

      {content?.statement && (
        <InfoCard title="المطلوب" icon={Target} tone="amber">
          {content.statement}
        </InfoCard>
      )}

      {steps.length > 0 && (
        <div className="space-y-3">
          {steps.map((item, index) => (
            <div
              key={`${index}-${getText(item)}`}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-sm font-black text-indigo-700">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <ObjectDetails value={item} />
              </div>
            </div>
          ))}
        </div>
      )}

      {algorithm.length > 0 && (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/60 p-5">
          <h3 className="font-black text-emerald-950">المنهجية</h3>
          <div className="mt-4 space-y-3">
            {algorithm.map((item, index) => (
              <div key={`${getText(item)}-${index}`} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <ObjectDetails value={item} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {content?.final_answer && (
        <InfoCard title="الجواب النهائي" icon={CheckCircle2} tone="emerald">
          {content.final_answer}
        </InfoCard>
      )}

      {templates.length > 0 && (
        <Reveal title="قوالب جاهزة لصياغة الإجابة">
          <div className="space-y-2">
            {templates.map((item, index) => (
              <div key={`${getText(item)}-${index}`}>
                <ObjectDetails value={item} />
              </div>
            ))}
          </div>
        </Reveal>
      )}

      <ExtraContentFields content={content} />

      {content?.attention && (
        <InfoCard title="انتبه" icon={TriangleAlert} tone="rose">
          {content.attention}
        </InfoCard>
      )}

      <Takeaway>{content?.takeaway}</Takeaway>
    </div>
  );
}


/* =========================================================
   Step renderers
========================================================= */

function MotivationStep({ content }) {
  const [answer, setAnswer] = useState("");
  const hasQuestion = Boolean(content?.question && toArray(content?.choices).length);
  const answered = Boolean(answer);
  const correct =
    answered &&
    normalizeComparable(answer) ===
      normalizeComparable(content?.correct_answer);

  if (!hasQuestion) {
    return <StructuredLessonStep content={content} />;
  }

  return (
    <div className="space-y-5">
      {content?.teacher && (
        <InfoCard title="ابدأ بصورة بسيطة" icon={Sparkles} tone="amber">
          {content.teacher}
        </InfoCard>
      )}

      <div className="rounded-[28px] border border-slate-200 bg-white p-5">
        <p className="text-lg font-black leading-8 text-slate-950">
          {content.question}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {toArray(content?.choices).map((choice) => {
            const chosen = answer === choice;
            const choiceCorrect =
              normalizeComparable(choice) ===
              normalizeComparable(content?.correct_answer);

            return (
              <button
                key={choice}
                type="button"
                onClick={() => setAnswer(choice)}
                className={cn(
                  "rounded-2xl border px-4 py-4 text-right font-black transition",
                  chosen && correct
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : chosen
                      ? "border-rose-300 bg-rose-50 text-rose-800"
                      : answered && choiceCorrect
                        ? "border-emerald-200 bg-emerald-50/60"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white",
                )}
              >
                {choice}
              </button>
            );
          })}
        </div>

        {answered && (
          <div
            className={cn(
              "mt-4 rounded-2xl border p-4 text-sm font-bold leading-7",
              correct
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800",
            )}
          >
            {correct ? "أحسنت. " : "ليس تمامًا. "}
            {content?.explanation}
          </div>
        )}
      </div>

      <ExtraContentFields content={content} />
      <Takeaway>{content?.takeaway}</Takeaway>
    </div>
  );
}


function ConceptStep({ content }) {
  return <StructuredLessonStep content={content} />;
}


function LoadPath({ items }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex];

  return (
    <div className="rounded-[30px] border border-sky-200 bg-gradient-to-br from-white to-sky-50 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm font-black transition",
                activeIndex === index
                  ? "border-sky-400 bg-sky-600 text-white shadow-lg"
                  : "border-slate-200 bg-white text-slate-700",
              )}
            >
              {item.label}
            </button>

            {index < items.length - 1 && (
              <ArrowLeft
                size={20}
                className="text-slate-400"
              />
            )}
          </div>
        ))}
      </div>

      {active && (
        <div className="mt-5 rounded-2xl border border-sky-100 bg-white p-4 text-center">
          <p className="font-black text-slate-950">
            {active.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {active.action}
          </p>
        </div>
      )}

      <p className="mt-4 text-center text-xs font-bold text-slate-500">
        اضغط على كل مرحلة لتتبع الحمل من الأعلى إلى الأسفل.
      </p>
    </div>
  );
}

function InteractiveDiagramStep({ content }) {
  return (
    <div className="space-y-5">
      <p className="font-semibold leading-8 text-slate-700">
        {content?.teacher}
      </p>

      <BuildingDiagram items={content?.diagram?.items || []} />

      {content?.challenge && (
        <InfoCard
          title="تحدٍ صغير"
          icon={Target}
          tone="emerald"
        >
          {content.challenge}
        </InfoCard>
      )}

      <Takeaway>{content?.takeaway}</Takeaway>
    </div>
  );
}

function VisualCatalogStep({ content }) {
  return (
    <div className="space-y-5">
      <p className="font-semibold leading-8 text-slate-700">
        {content?.teacher}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {toArray(content?.elements).map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              {item.icon === "stairs" ? (
                <Route size={19} />
              ) : (
                <Layers3 size={19} />
              )}
            </span>
            <h3 className="font-black text-slate-950">
              {item.name}
            </h3>
            <p className="mt-1 text-xs font-bold leading-6 text-slate-500">
              {item.cue}
            </p>
          </div>
        ))}
      </div>

      {content?.memory_map && (
        <div className="rounded-[30px] border border-indigo-200 bg-indigo-50/70 p-5">
          <div className="mx-auto w-fit rounded-full bg-indigo-600 px-5 py-3 font-black text-white">
            {content.memory_map.center}
          </div>

          <div className="mx-auto h-8 w-px bg-indigo-300" />

          <div className="grid gap-3 md:grid-cols-3">
            {toArray(content.memory_map.branches).map((branch) => (
              <div
                key={branch}
                className="rounded-2xl border border-indigo-100 bg-white p-4 text-center text-sm font-black leading-7 text-slate-700"
              >
                {branch}
              </div>
            ))}
          </div>
        </div>
      )}

      {content?.attention && (
        <Reveal title="لماذا جمّعنا العناصر هكذا؟">
          {content.attention}
        </Reveal>
      )}

      <Takeaway>{content?.takeaway}</Takeaway>
    </div>
  );
}

function QuizBlock({ content, final = false }) {
  const questions = toArray(content?.questions);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const score = questions.reduce(
    (total, q) =>
      total + (isCorrect(q, answers[q.id]) ? 1 : 0),
    0,
  );

  function choose(questionId, choice) {
    setAnswers((current) => ({
      ...current,
      [questionId]: choice,
    }));
  }

  function reset() {
    setAnswers({});
    setSubmitted(false);
  }

  return (
    <div className="space-y-5">
      {(content?.instruction || content?.instructions) && (
        <InfoCard
          title={final ? "اختبر نفسك" : "تحقق بسرعة"}
          icon={Target}
          tone={final ? "indigo" : "sky"}
        >
          {content.instruction || content.instructions}
        </InfoCard>
      )}

      {questions.map((question, qIndex) => {
        const selected = answers[question.id];
        const answered = Boolean(selected);

        return (
          <div
            key={question.id}
            className="rounded-[28px] border border-slate-200 bg-white p-5"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-700">
                {qIndex + 1}
              </span>
              <p className="font-black leading-7 text-slate-950">
                {question.question}
              </p>
            </div>

            <div className="mt-4 grid gap-2">
              {toArray(question.choices).map((choice) => {
                const chosen = selected === choice;
                const choiceCorrect = isCorrect(
                  question,
                  choice,
                );
                const showState = !final || submitted;

                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() =>
                      choose(question.id, choice)
                    }
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right text-sm font-bold transition",
                      showState && chosen && choiceCorrect
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : showState && chosen
                          ? "border-rose-300 bg-rose-50 text-rose-800"
                          : showState &&
                              submitted &&
                              choiceCorrect
                            ? "border-emerald-200 bg-emerald-50/50"
                            : chosen
                              ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white",
                    )}
                  >
                    <span>{choice}</span>
                    {showState &&
                      chosen &&
                      (choiceCorrect ? (
                        <Check size={18} />
                      ) : (
                        <X size={18} />
                      ))}
                  </button>
                );
              })}
            </div>

            {question?.hint && !submitted && final && (
              <Reveal title="تلميح">
                {question.hint}
              </Reveal>
            )}

            {(!final && answered) ||
            (final && submitted) ? (
              <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-700">
                {question?.hint && (
                  <p><strong>التلميح:</strong> {question.hint}</p>
                )}
                <p><strong>التفسير:</strong> {question.explanation}</p>
              </div>
            ) : null}
          </div>
        );
      })}

      {final && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setSubmitted(true)}
            disabled={
              questions.length > 0 &&
              Object.keys(answers).length < questions.length
            }
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trophy size={18} />
            صحّح الاختبار
          </button>

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-700"
          >
            <RotateCcw size={18} />
            أعد المحاولة
          </button>
        </div>
      )}

      {final && submitted && (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-center">
          <Trophy
            size={34}
            className="mx-auto text-amber-600"
          />
          <p className="mt-3 text-sm font-black text-amber-700">
            نتيجتك
          </p>
          <p className="mt-1 text-3xl font-black text-slate-950">
            {score} / {questions.length}
          </p>
          {content?.mastery_threshold !== undefined && (
            <p className="mt-2 text-xs font-black text-amber-700">
              عتبة الإتقان: {content.mastery_threshold} / {questions.length}
            </p>
          )}
          <p className="mt-2 text-sm font-semibold text-slate-600">
            {score >= (content?.mastery_threshold ?? questions.length)
              ? "ممتاز، حققت عتبة الإتقان المطلوبة لهذا المحور."
              : `تحتاج إلى ${content?.mastery_threshold ?? questions.length} إجابات صحيحة على الأقل. راجع النقاط التي أخطأت فيها ثم أعد المحاولة.`}
          </p>
        </div>
      )}

      {!final && (
        <Takeaway>{content?.takeaway}</Takeaway>
      )}
    </div>
  );
}

function CommonMistakesStep({ content }) {
  return (
    <div className="space-y-4">
      {toArray(content?.mistakes).map((mistake, index) => (
        <div
          key={`${mistake.title}-${index}`}
          className="rounded-[26px] border border-rose-200 bg-white p-5"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertTriangle size={19} />
            </span>
            <h3 className="font-black text-slate-950">
              {mistake.title}
            </h3>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-rose-50 p-4">
              <p className="text-xs font-black text-rose-600">
                خطأ
              </p>
              <p className="mt-1 text-sm font-semibold leading-7 text-rose-900">
                {mistake.wrong}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-black text-emerald-600">
                الصحيح
              </p>
              <p className="mt-1 text-sm font-semibold leading-7 text-emerald-900">
                {mistake.correct}
              </p>
            </div>
          </div>
        </div>
      ))}

      <Takeaway>{content?.takeaway}</Takeaway>
    </div>
  );
}

function SummaryStep({ content }) {
  return (
    <div className="space-y-5">
      <div className="rounded-[32px] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white">
            <Map size={22} />
          </span>
          <div>
            <p className="text-xs font-black text-amber-700">خريطة الحفظ</p>
            <h3 className="text-xl font-black text-slate-950">أهم ما يجب تذكره</h3>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {toArray(content?.remember).map((item, index) => (
            <div
              key={`${getText(item)}-${index}`}
              className="flex items-start gap-3 rounded-2xl border border-white bg-white/90 p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-black text-amber-700">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <ObjectDetails value={item} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {content?.memory_tip && (
        <InfoCard title="مفتاح الحفظ" icon={Lightbulb} tone="indigo">
          {content.memory_tip}
        </InfoCard>
      )}

      {content?.method_template && (
        <InfoCard title="قالب المنهجية" icon={Target} tone="emerald">
          {content.method_template}
        </InfoCard>
      )}

      {content?.memory_formula && (
        <div className="rounded-[24px] bg-slate-950 px-5 py-5 text-center text-lg font-black text-white sm:text-xl">
          {content.memory_formula}
        </div>
      )}

      {content?.next_lesson && (
        <InfoCard title="ماذا بعد؟" icon={ArrowLeft} tone="emerald">
          {content.next_lesson}
        </InfoCard>
      )}

      <ExtraContentFields
        content={{
          ...content,
          remember: undefined,
          memory_tip: undefined,
          method_template: undefined,
          memory_formula: undefined,
          next_lesson: undefined,
        }}
      />

      <Takeaway>{content?.takeaway}</Takeaway>
    </div>
  );
}


function GenericStep({ content }) {
  return <StructuredLessonStep content={content} />;
}


function StepBody({ step }) {
  const content = step?.content || {};

  switch (step?.type) {
    case "motivation":
      return <MotivationStep content={content} />;

    case "concept":
      return <ConceptStep content={content} />;

    case "definition":
    case "classification":
    case "comparison":
    case "diagram":
    case "observation":
    case "method":
    case "bac_method":
    case "worked_example":
    case "application":
      return <StructuredLessonStep content={content} />;

    case "interactive_diagram":
      return <InteractiveDiagramStep content={content} />;

    case "visual_catalog":
      return <VisualCatalogStep content={content} />;

    case "quick_check":
      return <QuizBlock content={content} />;

    case "common_mistakes":
      return <CommonMistakesStep content={content} />;

    case "summary_map":
    case "summary":
      return <SummaryStep content={content} />;

    case "quiz":
    case "final_quiz":
      return <QuizBlock content={content} final />;

    default:
      return <GenericStep content={content} />;
  }
}

/* =========================================================
   Intro
========================================================= */

function LessonIntro({ lesson, title }) {
  return (
    <article className="overflow-hidden rounded-[34px] border border-white bg-white/95 shadow-[0_30px_100px_-55px_rgba(15,23,42,.35)] ring-1 ring-amber-100">
      <div className="bg-gradient-to-l from-amber-500 via-orange-500 to-sky-600 p-6 text-white sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Building2 size={28} />
          </span>

          <div>
            <p className="text-xs font-black text-white/80">
              هندسة مدنية • {lesson?.chapter_title || "الطرق"}
            </p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/90 sm:text-base">
              {lesson?.lesson_goal}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2">
        <div>
          <h2 className="flex items-center gap-2 font-black text-slate-950">
            <Target size={18} className="text-amber-600" />
            ماذا ستفهم؟
          </h2>

          <div className="mt-3 space-y-2">
            {toArray(lesson?.learning_outcomes).map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3"
              >
                <CheckCircle2
                  size={17}
                  className="mt-1 shrink-0 text-emerald-600"
                />
                <p className="text-sm font-semibold leading-7 text-slate-700">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="flex items-center gap-2 font-black text-slate-950">
            <BookOpen size={18} className="text-sky-600" />
            قبل أن تبدأ
          </h2>

          <div className="mt-3 space-y-2">
            {toArray(lesson?.prerequisites).map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sm font-semibold leading-7 text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-black text-amber-700">
              طريقة الدرس
            </p>
            <p className="mt-1 font-black leading-7 text-slate-950">
              افهم الفكرة ← شاهد الرسم ← طبّق ← راجع الأخطاء ← اختبر نفسك
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

/* =========================================================
   Step meta
========================================================= */

const STEP_META = {
  motivation: {
    label: "انطلاق",
    icon: Sparkles,
    accent: "from-amber-500 to-orange-600",
  },
  concept: {
    label: "افهم",
    icon: Lightbulb,
    accent: "from-sky-500 to-cyan-600",
  },
  definition: {
    label: "تعريف",
    icon: BookOpen,
    accent: "from-sky-500 to-indigo-600",
  },
  classification: {
    label: "صنّف",
    icon: Layers3,
    accent: "from-indigo-500 to-violet-600",
  },
  comparison: {
    label: "قارن",
    icon: Route,
    accent: "from-cyan-500 to-sky-600",
  },
  diagram: {
    label: "شاهد",
    icon: Eye,
    accent: "from-amber-500 to-orange-600",
  },
  worked_example: {
    label: "مثال",
    icon: CheckCircle2,
    accent: "from-emerald-500 to-teal-600",
  },
  observation: {
    label: "لاحظ",
    icon: Eye,
    accent: "from-sky-500 to-indigo-600",
  },
  application: {
    label: "طبّق",
    icon: Target,
    accent: "from-emerald-500 to-cyan-600",
  },
  method: {
    label: "منهجية",
    icon: Target,
    accent: "from-emerald-500 to-cyan-600",
  },
  bac_method: {
    label: "منهجية",
    icon: GraduationCap,
    accent: "from-indigo-500 to-sky-600",
  },
  interactive_diagram: {
    label: "اكتشف",
    icon: Eye,
    accent: "from-indigo-500 to-violet-600",
  },
  visual_catalog: {
    label: "خريطة",
    icon: Layers3,
    accent: "from-amber-500 to-yellow-600",
  },
  quick_check: {
    label: "تحقق",
    icon: Target,
    accent: "from-sky-500 to-indigo-600",
  },
  common_mistakes: {
    label: "انتبه",
    icon: AlertTriangle,
    accent: "from-rose-500 to-red-600",
  },
  summary_map: {
    label: "الخلاصة",
    icon: Route,
    accent: "from-emerald-500 to-teal-600",
  },
  summary: {
    label: "الخلاصة",
    icon: Map,
    accent: "from-emerald-500 to-teal-600",
  },
  quiz: {
    label: "اختبار",
    icon: GraduationCap,
    accent: "from-indigo-500 to-violet-600",
  },
};

/* =========================================================
   Main component
========================================================= */

export default function CivilEngineeringLesson({
  data,
}) {
  const lesson = useMemo(
    () => normalizeLesson(data),
    [data],
  );

  const learningPath = useMemo(
    () =>
      Array.isArray(lesson?.learning_path)
        ? lesson.learning_path.filter(Boolean)
        : [],
    [lesson],
  );

  const [currentPage, setCurrentPage] = useState(0);

  const title =
    data?.title ||
    lesson?.axis_title ||
    lesson?.title ||
    "درس الهندسة المدنية";

  const pages = useMemo(
    () => [
      {
        id: "civil-intro",
        type: "lesson_intro",
        title: "بداية الدرس",
        label: "البداية",
        icon: Building2,
      },
      ...learningPath.map((step, index) => {
        const meta = STEP_META[step?.type] || {};
        return {
          ...step,
          id: step?.id || `civil-step-${index + 1}`,
          label: meta.label || "شرح",
          icon: meta.icon || BookOpen,
        };
      }),
    ],
    [learningPath],
  );

  useEffect(() => {
    setCurrentPage(0);
  }, [
    lesson?.axis_tag,
    data?.id,
    data?.axis?.id,
  ]);

  if (!lesson) {
    return (
      <div
        dir="rtl"
        className="mx-auto max-w-4xl px-4 py-10"
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

  const safePage = Math.min(
    currentPage,
    Math.max(pages.length - 1, 0),
  );

  const activePage = pages[safePage];
  const ActiveIcon = activePage?.icon || BookOpen;

  const progress =
    pages.length > 0
      ? Math.round(
          ((safePage + 1) / pages.length) * 100,
        )
      : 0;

  function goTo(index) {
    if (index < 0 || index >= pages.length) return;
    setCurrentPage(index);
    scrollToTop();
  }

  return (
    <section
      dir="rtl"
      className="relative min-h-full w-full min-w-0 overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#fef3c7_0%,transparent_30%),radial-gradient(circle_at_bottom_left,#e0f2fe_0%,transparent_26%),linear-gradient(180deg,#fffdf8_0%,#f8fbff_54%,#fffaf0_100%)] px-2 py-3 sm:px-5 sm:py-5 lg:px-8"
    >
      <style>{`
        @keyframes civilFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        #civil-course-card-top,
        #civil-course-card-top * {
          min-width: 0;
        }

        button {
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

      <div className="mx-auto max-w-6xl">
        <header
          id="civil-course-card-top"
          className="mb-5 rounded-[30px] border border-white bg-white/90 p-4 shadow-[0_22px_80px_-50px_rgba(15,23,42,.45)] ring-1 ring-amber-100 backdrop-blur sm:p-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
                  تقني رياضي • هندسة مدنية
                </span>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-700">
                  {lesson?.estimated_minutes || 25} دقيقة
                </span>
                {lesson?.difficulty && (
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">
                    المستوى: {lesson.difficulty}
                  </span>
                )}
              </div>

              <h1 className="mt-3 truncate text-xl font-black text-slate-950 sm:text-2xl">
                {title}
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {lesson?.chapter_title || "الطرق"}
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-[24px] border border-amber-100 bg-gradient-to-l from-amber-50 to-white p-3">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-amber-100">
                <svg
                  className="absolute inset-0 h-full w-full -rotate-90"
                  viewBox="0 0 64 64"
                >
                  <circle
                    cx="32"
                    cy="32"
                    r="27"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    className="text-slate-100"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="27"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 27}`}
                    strokeDashoffset={`${
                      2 *
                      Math.PI *
                      27 *
                      (1 - progress / 100)
                    }`}
                    className="text-amber-500 transition-all duration-500"
                  />
                </svg>
                <span className="relative text-sm font-black text-slate-950">
                  {progress}%
                </span>
              </div>

              <div>
                <p className="text-xs font-black text-slate-400">
                  تقدم الدرس
                </p>
                <p className="mt-1 max-w-[220px] truncate text-sm font-black text-slate-950">
                  {activePage?.title}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-l from-amber-500 via-orange-500 to-sky-500 transition-all duration-500"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </header>

        <main>
          <div
            key={activePage?.id || safePage}
            className="min-h-[520px] animate-[civilFadeIn_.35s_ease-out]"
          >
            {activePage?.type === "lesson_intro" ? (
              <LessonIntro
                lesson={lesson}
                title={title}
              />
            ) : (
              <article className="rounded-[34px] border border-white bg-white/95 p-4 shadow-[0_30px_100px_-55px_rgba(15,23,42,.38)] ring-1 ring-amber-100/80 backdrop-blur sm:p-6 lg:p-7">
                <div className="mb-5 flex items-start gap-4 border-b border-slate-100 pb-5">
                  <span
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
                      STEP_META[activePage?.type]?.accent ||
                        "from-amber-500 to-orange-600",
                    )}
                  >
                    <ActiveIcon size={21} />
                  </span>

                  <div>
                    <p className="text-[11px] font-black text-amber-700">
                      {activePage?.label}
                    </p>
                    <h2 className="mt-1 text-xl font-black leading-8 text-slate-950 sm:text-2xl">
                      {activePage?.title}
                    </h2>
                  </div>
                </div>

                <StepBody step={activePage} />
              </article>
            )}
          </div>

          <div className="sticky bottom-2 z-20 mt-6 rounded-[24px] border border-white bg-white/95 p-3 shadow-[0_18px_60px_-34px_rgba(15,23,42,.5)] ring-1 ring-amber-100 backdrop-blur sm:p-4">
            <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
              <button
                type="button"
                onClick={() => goTo(safePage - 1)}
                disabled={safePage === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-35 sm:justify-self-start"
              >
                <ArrowRight size={18} />
                السابق
              </button>

              <div className="order-first col-span-2 flex flex-wrap justify-center gap-1.5 sm:order-none sm:col-span-1">
                {pages.map((page, index) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => goTo(index)}
                    aria-label={`الانتقال إلى ${page.title}`}
                    className={cn(
                      "h-2.5 rounded-full transition-all",
                      index === safePage
                        ? "w-8 bg-amber-500"
                        : index < safePage
                          ? "w-2.5 bg-emerald-400"
                          : "w-2.5 bg-slate-200",
                    )}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => goTo(safePage + 1)}
                disabled={safePage === pages.length - 1}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-35 sm:justify-self-end"
              >
                التالي
                <ArrowLeft size={18} />
              </button>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
