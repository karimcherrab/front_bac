// src/components/Course/CourseSidebar.jsx

import {
  BookMarked,
  GraduationCap,
  Layers3,
  PenLine,
  School,
} from "lucide-react";

export default function CourseSidebar({
  course,
}) {
  const chaptersCount =
    toSafeNumber(
      course?.chaptersCount ??
      course?.statistics?.chapters_count
    );

  const axesCount =
    toSafeNumber(
      course?.axesCount ??
      course?.statistics?.axes_count
    );

  const exercisesCount =
    toSafeNumber(
      course?.exercisesCount ??
      course?.statistics?.exercises_count
    );

  const bacExercisesCount =
    toSafeNumber(
      course?.bacExercisesCount ??
      course?.statistics?.bac_exercises_count
    );

  const courseName =
    course?.name ??
    course?.title ??
    "المادة";

  const branchName =
    course?.branchName ??
    course?.branch?.name ??
    course?.user_branch?.name ??
    "غير محددة";

  return (
    <aside
      dir="rtl"
      className="
        w-full
        min-w-0
      "
    >
      <div
        className="
          overflow-hidden
          rounded-3xl
          border
          border-slate-100
          bg-white
          shadow-sm
        "
      >
        {/* Header */}
        <div
          className="
            border-b
            border-slate-100
            px-5
            py-5

            sm:px-6
          "
        >
          <div
            className="
              flex
              min-w-0
              items-center
              gap-3
            "
          >
            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-2xl
                bg-violet-50
                text-violet-600
              "
            >
              <School size={21} />
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className="
                  truncate
                  text-base
                  font-black
                  text-slate-900

                  sm:text-lg
                "
                title={courseName}
              >
                {courseName}
              </h3>

              <p
                className="
                  mt-1
                  truncate
                  text-xs
                  font-bold
                  text-slate-400
                "
                title={branchName}
              >
                {branchName}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          className="
            grid
            grid-cols-2
            gap-px
            bg-slate-100
          "
        >
          <StatItem
            icon={BookMarked}
            value={chaptersCount}
            label="فصل"
          />

          <StatItem
            icon={Layers3}
            value={axesCount}
            label="محور"
          />

          <StatItem
            icon={PenLine}
            value={exercisesCount}
            label="تمرين"
          />

          <StatItem
            icon={GraduationCap}
            value={bacExercisesCount}
            label="تمرين بكالوريا"
          />
        </div>
      </div>
    </aside>
  );
}

function StatItem({
  value,
  label,
  icon: Icon,
}) {
  return (
    <div
      className="
        min-w-0
        bg-white
        px-4
        py-5
        text-center
      "
    >
      <div
        className="
          mx-auto
          flex
          h-9
          w-9
          items-center
          justify-center
          rounded-xl
          bg-violet-50
          text-violet-600
        "
      >
        <Icon size={17} />
      </div>

      <p
        className="
          mt-3
          text-2xl
          font-black
          leading-none
          text-slate-900
        "
      >
        {value}
      </p>

      <p
        className="
          mt-2
          truncate
          text-[11px]
          font-bold
          text-slate-400
        "
        title={label}
      >
        {label}
      </p>
    </div>
  );
}

function toSafeNumber(value) {
  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue
  )
    ? numberValue
    : 0;
}
