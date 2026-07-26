// src/pages/MathCoursePage.jsx

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calculator,
  ChevronLeft,
  Loader2,
} from "lucide-react";

import axios from "axios";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import CourseHero from "../components/Course/CourseHero";
import CourseSidebar from "../components/Course/CourseSidebar";
import LessonCard from "../components/Course/LessonCard";
import { UserContext } from "../Utils/UserContext";
import {  useContext} from "react";

import {
  mathCourse,
} from "../data/CourseData";

export default function MathCoursePage() {
  const navigate = useNavigate();
  const { token } = useContext(UserContext);

  const { id_subjects } = useParams();

  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const fetchChapters = async () => {
      if (!id_subjects) {
        setError("معرّف المادة غير موجود");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await axios.get(
          `http://127.0.0.1:8000/api/course/subjects/${id_subjects}/chapters/`,
          {
            signal: controller.signal,

            // Active cette partie si ton endpoint exige JWT.
            
            headers: {
              Authorization: `Bearer ${token}`,
            },
            
          }
        );
        console.log(response)

        setChapters(
          Array.isArray(response.data?.chapters)
            ? response.data.chapters
            : []
        );
      } catch (err) {
        if (
          err.name === "CanceledError" ||
          axios.isCancel(err)
        ) {
          return;
        }

        console.error(
          "Erreur lors du chargement des chapitres :",
          err
        );

        if (err.response?.status === 401) {
          setError(
            "يجب تسجيل الدخول للوصول إلى الفصول"
          );
        } else if (err.response?.status === 404) {
          setError(
            "المادة المطلوبة غير موجودة"
          );
        } else {
          setError(
            err.response?.data?.detail ||
              "حدث خطأ أثناء تحميل الفصول"
          );
        }

        setChapters([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChapters();

    return () => {
      controller.abort();
    };
  }, [id_subjects]);

  /*
   * Transformation des chapitres vers la structure
   * pouvant être utilisée par LessonCard.
   *
   * Adapte les propriétés si ton composant LessonCard
   * utilise d'autres noms.
   */
  const chapterLessons = useMemo(() => {
    return chapters.map((chapter) => ({
      id: chapter.id,
      code: chapter.code,
      title: chapter.title,
      order: chapter.order,
      is_active: chapter.is_active,
      axes_count: chapter.axes_count,

      // Propriétés utiles pour LessonCard.
      category: "chapter",
      description: `${chapter.axes_count} محاور`,
      lessonsCount: chapter.axes_count,
      progress: 0,

      // URL ouverte lorsque l'utilisateur clique.
      path: `/lesson/${chapter.id}`,
    }));
  }, [chapters, id_subjects]);

  const handleChapterClick = (chapter) => {
    navigate(
      `/subjects/${id_subjects}/lesson/${chapter.id}`
    );
  };

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
                    flex h-11 w-11 items-center
                    justify-center rounded-xl
                    bg-violet-600 text-white
                  "
                >
                  <Calculator size={23} />
                </div>

                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">
                    الرياضيات
                  </h1>

                  {!loading && !error && (
                    <p className="mt-1 text-sm font-semibold text-slate-400">
                      {chapters.length} فصل متوفر
                    </p>
                  )}
                </div>
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

              {/* عنوان قائمة الفصول */}
              <div
                className="
                  flex items-center justify-between
                  rounded-2xl border border-slate-100
                  bg-white px-5 py-4 shadow-sm
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      flex h-10 w-10 items-center
                      justify-center rounded-xl
                      bg-violet-50 text-violet-600
                    "
                  >
                    <BookOpen size={20} />
                  </div>

                  <div>
                    <h2 className="font-extrabold text-slate-900">
                      فصول المادة
                    </h2>

                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      اختر الفصل الذي تريد دراسته
                    </p>
                  </div>
                </div>

                {!loading && !error && (
                  <span
                    className="
                      rounded-full bg-violet-50
                      px-3 py-1 text-xs font-extrabold
                      text-violet-600
                    "
                  >
                    {chapters.length} فصل
                  </span>
                )}
              </div>

              {/* Loading */}
              {loading && (
                <div
                  className="
                    flex min-h-[240px] flex-col
                    items-center justify-center
                    rounded-2xl border border-slate-100
                    bg-white p-10 shadow-sm
                  "
                >
                  <Loader2
                    size={34}
                    className="animate-spin text-violet-600"
                  />

                  <p className="mt-4 font-bold text-slate-500">
                    جاري تحميل الفصول...
                  </p>
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div
                  className="
                    flex min-h-[220px] flex-col
                    items-center justify-center
                    rounded-2xl border border-red-100
                    bg-white p-10 text-center shadow-sm
                  "
                >
                  <div
                    className="
                      flex h-12 w-12 items-center
                      justify-center rounded-full
                      bg-red-50 text-red-500
                    "
                  >
                    <AlertCircle size={25} />
                  </div>

                  <p className="mt-4 font-extrabold text-slate-700">
                    {error}
                  </p>

                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="
                      mt-5 rounded-xl bg-violet-600
                      px-5 py-2.5 text-sm font-bold
                      text-white transition
                      hover:bg-violet-700
                    "
                  >
                    إعادة المحاولة
                  </button>
                </div>
              )}

              {/* Chapters */}
              {!loading &&
                !error &&
                chapterLessons.length > 0 && (
                  <div className="space-y-3">
                    {chapterLessons.map((chapter) => (
                      <div
                        key={chapter.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          handleChapterClick(chapter)
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " "
                          ) {
                            handleChapterClick(chapter);
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <LessonCard
                          lesson={chapter}
                        />
                      </div>
                    ))}
                  </div>
                )}

              {/* Empty */}
              {!loading &&
                !error &&
                chapterLessons.length === 0 && (
                  <div
                    className="
                      rounded-2xl border border-slate-100
                      bg-white p-12 text-center shadow-sm
                    "
                  >
                    <div
                      className="
                        mx-auto flex h-14 w-14
                        items-center justify-center
                        rounded-full bg-slate-50
                        text-slate-400
                      "
                    >
                      <BookOpen size={27} />
                    </div>

                    <p className="mt-4 font-bold text-slate-600">
                      لا توجد فصول متاحة لهذه المادة
                    </p>
                  </div>
                )}
            </section>

            {/* العمود الجانبي */}
            <CourseSidebar
              course={{
                ...mathCourse,
                lessonsCount: chapters.length,
                chaptersCount: chapters.length,
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}