// src/components/mathCourse/MathCourseHero.jsx

import {
  Calculator,
  BookOpen,
  PenLine,
  ClipboardCheck,
  Triangle,
  Sigma,
} from "lucide-react";

export default function CourseHero({ course }) {
  return (
    <section
      dir="rtl"
      className="
        relative overflow-hidden rounded-3xl
        border border-violet-100 bg-white
        p-6 shadow-soft
      "
    >
      {/* زخارف الخلفية */}
      <div
        className="
          absolute -left-10 -top-10
          h-52 w-52 rounded-full
          bg-violet-100/50 blur-3xl
        "
      />

      <div
        className="
          absolute bottom-0 right-1/3
          h-36 w-36 rounded-full
          bg-blue-100/40 blur-3xl
        "
      />

      <div
        className="
          relative z-10 flex flex-col gap-7
          lg:flex-row lg:items-center
          lg:justify-between
        "
      >
        {/* معلومات المادة */}
        <div className="flex items-center gap-5">
          <div
            className="
              flex h-24 w-24 shrink-0 items-center
              justify-center rounded-3xl
              bg-gradient-to-br from-violet-500
              to-indigo-700 text-white
              shadow-xl shadow-violet-200
            "
          >
            <Calculator size={45} />
          </div>

          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">
              {course.title}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              {course.description}
            </p>

            <div className="mt-5 flex max-w-lg items-center gap-4">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-violet-100">
                <div
                  className="
                    h-full rounded-full
                    bg-gradient-to-l
                    from-violet-600 to-purple-400
                  "
                  style={{
                    width: `${course.progress}%`,
                  }}
                />
              </div>

              <span className="text-sm font-bold text-slate-700">
                {course.progress}% مكتمل
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-5 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <BookOpen size={15} />
                {course.lessonsCount} درس
              </span>

              <span className="flex items-center gap-1.5">
                <PenLine size={15} />
                {course.exercisesCount} تمرين
              </span>

              <span className="flex items-center gap-1.5">
                <ClipboardCheck size={15} />
                {course.examsCount} اختبارات
              </span>
            </div>
          </div>
        </div>

        {/* رسم رياضي */}
        <div
          className="
            relative mx-auto flex h-44 w-full
            max-w-[330px] items-center justify-center
            rounded-3xl bg-gradient-to-br
            from-violet-50 to-indigo-50
          "
        >
          <div
            className="
              absolute left-7 top-6
              text-4xl font-extrabold
              text-violet-300
            "
          >
            x² + y²
          </div>

          <Sigma
            size={65}
            className="absolute bottom-5 left-8 text-violet-300"
          />

          <Triangle
            size={58}
            className="absolute bottom-4 right-8 text-indigo-300"
          />

          <div
            className="
              flex h-28 w-24 items-center justify-center
              rounded-2xl bg-gradient-to-br
              from-violet-500 to-indigo-700
              shadow-xl shadow-violet-200
            "
          >
            <Calculator size={50} className="text-white" />
          </div>
        </div>
      </div>
    </section>
  );
}