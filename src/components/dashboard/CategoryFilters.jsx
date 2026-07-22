// src/components/dashboard/CategoryFilters.jsx

import {
  Grid2X2,
  FlaskConical,
  PenLine,
  Monitor,
  Globe2,
  ChevronDown,
} from "lucide-react";

const categoryIcons = {
  all: Grid2X2,
  science: FlaskConical,
  literary: PenLine,
  technical: Monitor,
};

export default function CategoryFilters({
  categories,
  activeCategory,
  onChange,
}) {
  return (
    <div
      dir="rtl"
      className="
        flex flex-col gap-4 rounded-2xl
        border border-slate-100 bg-white p-2
        shadow-soft
        lg:flex-row lg:items-center lg:justify-between
      "
    >
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((category) => {
          const Icon = categoryIcons[category.id] || Globe2;
          const isActive = activeCategory === category.id;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onChange(category.id)}
              className={`
                flex h-11 items-center gap-2 rounded-xl
                px-5 text-sm font-bold transition
                ${
                  isActive
                    ? "bg-gradient-to-l from-violet-600 to-violet-500 text-white shadow-md shadow-violet-200"
                    : "border border-slate-100 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-600"
                }
              `}
            >
              <Icon size={17} />
              {category.label}
            </button>
          );
        })}

        <button
          type="button"
          className="
            flex h-11 w-11 items-center justify-center
            rounded-xl border border-slate-100
            text-slate-500 transition
            hover:border-violet-200 hover:text-violet-600
          "
        >
          <Globe2 size={18} />
        </button>
      </div>

      <button
        type="button"
        className="
          flex h-11 min-w-[200px] items-center justify-between
          rounded-xl border border-slate-200
          px-4 text-sm font-semibold text-slate-600
          transition hover:border-violet-300
        "
      >
        <span>ترتيب حسب: الأكثر دراسة</span>
        <ChevronDown size={17} />
      </button>
    </div>
  );
}