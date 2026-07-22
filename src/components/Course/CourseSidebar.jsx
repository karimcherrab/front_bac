// src/components/mathCourse/MathCourseSidebar.jsx

import {
  BookOpen,
  PenLine,
  ClipboardCheck,
  BarChart3,
  Clock3,
  CalendarDays,
  Trophy,
  Sparkles,
} from "lucide-react";

export default function CourseSidebar({ course }) {
  return (
    <aside dir="rtl" className="space-y-5">
      {/* تقدم المادة */}
      <div
        className="
          rounded-3xl border border-slate-100
          bg-white p-6 shadow-soft
        "
      >
        <h3 className="text-center text-lg font-extrabold text-slate-900">
          تقدم المادة
        </h3>

        <div className="relative mx-auto mt-6 h-36 w-36">
          <svg
            viewBox="0 0 120 120"
            className="-rotate-90"
          >
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#ede9fe"
              strokeWidth="10"
            />

            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#6c4ef5"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${course.progress * 3.14} 314`}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold text-slate-900">
              {course.progress}%
            </span>

            <span className="text-xs text-slate-500">
              مكتمل
            </span>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 text-center">
          <CourseStat
            value={course.lessonsCount}
            label="درس"
            icon={BookOpen}
          />

          <CourseStat
            value={course.exercisesCount}
            label="تمرين"
            icon={PenLine}
          />

          <CourseStat
            value={course.examsCount}
            label="اختبار"
            icon={ClipboardCheck}
          />
        </div>

        <button
          type="button"
          className="
            mt-6 flex h-12 w-full items-center
            justify-center gap-2 rounded-xl
            bg-gradient-to-l from-violet-600
            to-purple-500 text-sm font-bold
            text-white shadow-lg shadow-violet-200
            transition hover:brightness-110
          "
        >
          <PlayIcon />
          متابعة التعلم
        </button>
      </div>

      {/* معلومات المادة */}
      <div
        className="
          rounded-3xl border border-slate-100
          bg-white p-6 shadow-soft
        "
      >
        <h3 className="text-lg font-extrabold text-slate-900">
          معلومات المادة
        </h3>

        <div className="mt-5 space-y-5">
          <InfoRow
            icon={BarChart3}
            label="المستوى"
            value={course.level}
          />

          <InfoRow
            icon={BookOpen}
            label="عدد الدروس"
            value={`${course.lessonsCount} درس`}
          />

          <InfoRow
            icon={Clock3}
            label="مدة التعلم"
            value={`حوالي ${course.duration}`}
          />

          <InfoRow
            icon={CalendarDays}
            label="آخر تحديث"
            value={course.lastUpdate}
          />
        </div>
      </div>

      {/* الإنجازات */}
      <div
        className="
          rounded-3xl border border-slate-100
          bg-white p-6 text-center shadow-soft
        "
      >
        <h3 className="text-lg font-extrabold text-slate-900">
          إنجازاتك
        </h3>

        <div
          className="
            mx-auto mt-5 flex h-16 w-16
            items-center justify-center rounded-full
            bg-gradient-to-br from-violet-500
            to-indigo-700 text-white
            shadow-lg shadow-violet-200
          "
        >
          <Trophy size={30} />
        </div>

        <p className="mt-4 text-2xl font-extrabold text-slate-900">
          5
        </p>

        <p className="text-sm text-slate-500">
          شارات محققة
        </p>

        <button
          type="button"
          className="
            mt-4 flex w-full items-center
            justify-center gap-2 rounded-xl
            py-3 text-sm font-bold text-violet-600
            transition hover:bg-violet-50
          "
        >
          <Sparkles size={17} />
          عرض جميع الشارات
        </button>
      </div>
    </aside>
  );
}

function CourseStat({ value, label, icon: Icon }) {
  return (
    <div>
      <Icon
        size={17}
        className="mx-auto mb-2 text-violet-500"
      />

      <p className="text-lg font-extrabold text-violet-600">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {label}
      </p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="
          flex h-10 w-10 shrink-0 items-center
          justify-center rounded-xl bg-violet-50
          text-violet-600
        "
      >
        <Icon size={18} />
      </div>

      <div>
        <p className="text-xs text-slate-400">
          {label}
        </p>

        <p className="mt-1 text-sm font-bold text-slate-700">
          {value}
        </p>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
      ▶
    </span>
  );
}