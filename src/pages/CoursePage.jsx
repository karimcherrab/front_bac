// src/pages/MathCoursePage.jsx

import { useMemo, useState } from "react";
import {
  Calculator,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import CourseHero from "../components/Course/CourseHero";
import CourseSidebar from "../components/Course/CourseSidebar";
import LessonFilters from "../components/Course/LessonFilters";
import LessonCard from "../components/Course/LessonCard";

import {
  mathCourse,
  mathLessons,
} from "../data/CourseData";

export default function MathCoursePage() {
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] =
    useState("all");

  const filteredLessons = useMemo(() => {
    if (activeFilter === "all") {
      return mathLessons;
    }

    return mathLessons.filter(
      (lesson) => lesson.category === activeFilter
    );
  }, [activeFilter]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#fafbff]">
   
      <main
        dir="rtl"
        className="
          flex-1 overflow-y-auto px-4 py-6
          sm:px-6 lg:px-9
        "
      >
        <div className="mx-auto max-w-[1500px]">
          {/* عنوان الصفحة */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div
                  className="
                    flex h-11 w-11 items-center justify-center
                    rounded-xl bg-violet-600 text-white
                  "
                >
                  <Calculator size={23} />
                </div>

                <h1 className="text-2xl font-extrabold text-slate-900">
                  الرياضيات
                </h1>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                <span>الرئيسية</span>
                <ChevronLeft size={14} />
                <span>المواد</span>
                <ChevronLeft size={14} />
                <span className="text-violet-600">
                  الرياضيات
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/subjects")}
              className="
                flex h-11 items-center gap-2
                rounded-xl border border-slate-200
                bg-white px-4 text-sm font-bold
                text-slate-600 shadow-sm transition
                hover:border-violet-300
                hover:text-violet-600
              "
            >
              <ArrowRight size={18} />
              العودة إلى المواد
            </button>
          </div>

          <div
            className="
              grid gap-6
              xl:grid-cols-[minmax(0,1fr)_280px]
            "
          >
            {/* المحتوى الرئيسي */}
            <section className="min-w-0 space-y-5">
              <CourseHero course={mathCourse} />

              <LessonFilters
                activeFilter={activeFilter}
                onChange={setActiveFilter}
              />

              <div className="space-y-3">
                {filteredLessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                  />
                ))}
              </div>

              {filteredLessons.length === 0 && (
                <div
                  className="
                    rounded-2xl border border-slate-100
                    bg-white p-12 text-center shadow-soft
                  "
                >
                  <p className="font-bold text-slate-600">
                    لا توجد دروس في هذا التصنيف
                  </p>
                </div>
              )}
            </section>

            {/* العمود الجانبي */}
            <CourseSidebar course={mathCourse} />
          </div>
        </div>
      </main>
    </div>
  );
}