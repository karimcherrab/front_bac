// src/components/mathCourse/MathLessonCard.jsx

import {
  Play,
  CheckCircle2,
  Clock3,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

const colorStyles = {
  green: {
    icon: "from-emerald-400 to-green-600",
    dot: "bg-emerald-500",
    progress: "bg-emerald-500",
  },

  blue: {
    icon: "from-sky-400 to-blue-600",
    dot: "bg-blue-500",
    progress: "bg-blue-500",
  },

  purple: {
    icon: "from-violet-400 to-purple-600",
    dot: "bg-violet-500",
    progress: "bg-violet-500",
  },

  pink: {
    icon: "from-pink-400 to-fuchsia-600",
    dot: "bg-pink-500",
    progress: "bg-pink-500",
  },

  orange: {
    icon: "from-orange-400 to-amber-500",
    dot: "bg-orange-500",
    progress: "bg-orange-500",
  },
};

export default function LessonCard({ lesson }) {
  const navigate = useNavigate();

  const styles =
    colorStyles[lesson.color] || colorStyles.purple;

  const openLesson = () => {
    navigate(`/lesson/${lesson.chapter}`);
  };

  return (
    <article
      dir="rtl"
      className="
        group grid gap-5 rounded-2xl
        border border-slate-100 bg-white p-4
        shadow-card transition-all duration-300
        hover:-translate-y-0.5 hover:border-violet-200
        hover:shadow-lg
        lg:grid-cols-[100px_minmax(0,1fr)_180px]
        lg:items-center
      "
    >
      {/* الرقم والأيقونة */}
      <div className="flex items-center gap-4 lg:justify-start">
        <span className="text-xl font-extrabold text-slate-800">
          {lesson.number}
        </span>

        <div
          className={`
            flex h-16 w-16 shrink-0 items-center
            justify-center rounded-2xl
            bg-gradient-to-br text-lg
            font-bold text-white shadow-lg
            transition group-hover:scale-105
            ${styles.icon}
          `}
        >
          {lesson.iconText}
        </div>
      </div>

      {/* معلومات الدرس */}
      <div>
        <h3 className="text-base font-extrabold text-slate-900">
          {lesson.title}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${styles.dot}`}
            />
            {lesson.level}
          </span>

          <span className="flex items-center gap-1.5">
            <Clock3 size={14} />
            {lesson.duration}
          </span>
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {lesson.description}
        </p>
      </div>

      {/* التقدم والزر */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${styles.progress}`}
              style={{
                width: `${lesson.progress}%`,
              }}
            />
          </div>

          <span className="w-10 text-xs font-bold text-slate-700">
            {lesson.progress}%
          </span>
        </div>

        <button
          type="button"
          onClick={openLesson}
          className="
            flex h-11 items-center justify-center gap-2
            rounded-xl border border-violet-200
            bg-white text-sm font-bold text-violet-600
            transition hover:bg-violet-600
            hover:text-white
          "
        >
          {lesson.progress === 100 ? (
            <>
              <CheckCircle2 size={17} />
              مراجعة الدرس
            </>
          ) : lesson.progress > 0 ? (
            <>
              <Play size={17} />
              متابعة الدرس
            </>
          ) : (
            <>
              <Play size={17} />
              ابدأ الدرس
            </>
          )}
        </button>
      </div>
    </article>
  );
}