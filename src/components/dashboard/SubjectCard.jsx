// src/components/dashboard/SubjectCard.jsx

import {
  ArrowLeft,
  BookOpen,
  PenLine,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

const themeStyles = {
  purple: {
    card:
      "border-violet-100 bg-gradient-to-br from-violet-50/80 to-white",
    icon:
      "from-violet-500 to-indigo-600",
    progress:
      "from-violet-600 to-purple-400",
    button:
      "border-violet-500 text-violet-600 hover:bg-violet-600",
  },

  blue: {
    card:
      "border-blue-100 bg-gradient-to-br from-blue-50/80 to-white",
    icon:
      "from-cyan-400 to-blue-600",
    progress:
      "from-blue-600 to-sky-400",
    button:
      "border-blue-500 text-blue-600 hover:bg-blue-600",
  },

  green: {
    card:
      "border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-white",
    icon:
      "from-green-400 to-emerald-600",
    progress:
      "from-emerald-600 to-green-400",
    button:
      "border-emerald-500 text-emerald-600 hover:bg-emerald-600",
  },

  orange: {
    card:
      "border-orange-100 bg-gradient-to-br from-orange-50/80 to-white",
    icon:
      "from-amber-400 to-orange-500",
    progress:
      "from-orange-500 to-amber-400",
    button:
      "border-orange-500 text-orange-500 hover:bg-orange-500",
  },

  pink: {
    card:
      "border-pink-100 bg-gradient-to-br from-pink-50/80 to-white",
    icon:
      "from-pink-400 to-rose-500",
    progress:
      "from-pink-500 to-rose-400",
    button:
      "border-pink-500 text-pink-500 hover:bg-pink-500",
  },

  violet: {
    card:
      "border-purple-100 bg-gradient-to-br from-purple-50/80 to-white",
    icon:
      "from-purple-500 to-violet-600",
    progress:
      "from-violet-600 to-purple-400",
    button:
      "border-violet-500 text-violet-600 hover:bg-violet-600",
  },

  teal: {
    card:
      "border-teal-100 bg-gradient-to-br from-teal-50/80 to-white",
    icon:
      "from-teal-400 to-emerald-600",
    progress:
      "from-teal-600 to-emerald-400",
    button:
      "border-teal-500 text-teal-600 hover:bg-teal-600",
  },

  sky: {
    card:
      "border-sky-100 bg-gradient-to-br from-sky-50/80 to-white",
    icon:
      "from-blue-400 to-blue-600",
    progress:
      "from-blue-600 to-sky-400",
    button:
      "border-blue-500 text-blue-600 hover:bg-blue-600",
  },
};

export default function SubjectCard({
  subject,
}) {
  const navigate = useNavigate();

  const Icon =
    subject.icon || BookOpen;

  const styles =
    themeStyles[subject.theme] ||
    themeStyles.purple;

  const progress =
    Number(subject.progress) || 0;

  const lessons =
    Number(subject.lessons) || 0;

  const exercises =
    Number(subject.exercises) || 0;

  return (
    <article
      dir="rtl"
      className={`
        group flex min-h-[272px] flex-col
        rounded-2xl border p-5
        shadow-card transition-all duration-300
        hover:-translate-y-1 hover:shadow-xl
        ${styles.card}
      `}
    >
      <div
        className={`
          mx-auto flex h-16 w-16 items-center justify-center
          rounded-full bg-gradient-to-br text-white
          shadow-lg transition duration-300
          group-hover:scale-105
          ${styles.icon}
        `}
      >
        <Icon
          size={30}
          strokeWidth={2}
        />
      </div>

      <div className="mt-4 text-center">
        <h3 className="text-lg font-extrabold text-slate-900">
          {subject.title}
        </h3>

        <p className="mx-auto mt-2 max-w-[250px] text-sm leading-7 text-slate-600">
          {subject.description}
        </p>
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-3">
          {/* <span className="text-xs font-bold text-slate-700">
            {progress}%
          </span>

          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className={`
                h-full rounded-full bg-gradient-to-l
                ${styles.progress}
              `}
              style={{
                width: `${progress}%`,
              }}
            />
          </div> */}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
            {/* <span className="flex items-center gap-1">
              <BookOpen size={14} />
              {lessons} درس
            </span>

            <span className="flex items-center gap-1">
              <PenLine size={14} />
              {exercises} تمرين
            </span> */}
          </div>

          <button
            type="button"
            onClick={() =>
              navigate(subject.path)
            }
            className={`
              flex h-8 w-8 items-center justify-center
              rounded-full border bg-white
              transition hover:text-white
              ${styles.button}
            `}
            aria-label={`فتح مادة ${subject.title}`}
          >
            <ArrowLeft size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}