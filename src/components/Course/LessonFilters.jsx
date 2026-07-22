// src/components/mathCourse/MathLessonFilters.jsx

import {
  Grid2X2,
  ChevronDown,
} from "lucide-react";

const filters = [
  {
    id: "all",
    label: "كل الدروس",
  },
  {
    id: "basic",
    label: "الأساسية",
  },
  {
    id: "medium",
    label: "المتوسطة",
  },
  {
    id: "advanced",
    label: "المتقدمة",
  },
];

export default function LessonFilters({
  activeFilter,
  onChange,
}) {
  return (
    <div
      dir="rtl"
      className="
        flex flex-col gap-4 rounded-2xl
        border border-slate-100 bg-white p-3
        shadow-soft lg:flex-row
        lg:items-center lg:justify-between
      "
    >
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const active = activeFilter === filter.id;

          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onChange(filter.id)}
              className={`
                rounded-xl px-6 py-3
                text-sm font-bold transition
                ${
                  active
                    ? "bg-gradient-to-l from-violet-600 to-purple-500 text-white shadow-md shadow-violet-200"
                    : "border border-slate-100 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-600"
                }
              `}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="
            flex h-11 items-center gap-2 rounded-xl
            border border-slate-200 px-4
            text-sm font-semibold text-slate-600
            transition hover:border-violet-300
          "
        >
          ترتيب الدروس
          <ChevronDown size={16} />
        </button>

        <button
          type="button"
          className="
            flex h-11 items-center gap-2 rounded-xl
            border border-slate-200 px-4
            text-sm font-semibold text-slate-600
            transition hover:border-violet-300
          "
        >
          <Grid2X2 size={17} />
          عرض
        </button>
      </div>
    </div>
  );
}