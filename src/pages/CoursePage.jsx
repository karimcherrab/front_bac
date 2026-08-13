// src/pages/MathCoursePage.jsx

import {
  useContext,
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
  RefreshCw,
} from "lucide-react";

import axios from "axios";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import CourseHero from "../components/Course/CourseHero";
import CourseSidebar from "../components/Course/CourseSidebar";
import LessonCard from "../components/Course/LessonCard";

import {
  UserContext,
} from "../Utils/UserContext";

import {
  mathCourse,
} from "../data/CourseData";

export default function MathCoursePage() {
  const navigate = useNavigate();

  const {
    token,
  } = useContext(UserContext);

  const {
    id_subjects,
  } = useParams();

  const baseURL =
    import.meta.env.VITE_BASE_URL;

  const [
    chapters,
    setChapters,
  ] = useState([]);

  const [
    subjectDetails,
    setSubjectDetails,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  useEffect(() => {
    const controller =
      new AbortController();

    const fetchPageData = async () => {
      if (!id_subjects) {
        setError(
          "معرّف المادة غير موجود"
        );

        setLoading(false);

        return;
      }

      if (!baseURL) {
        setError(
          "رابط الخادم غير مضبوط. تحقق من VITE_BASE_URL"
        );

        setLoading(false);

        return;
      }

      try {
        setLoading(true);
        setError("");

        const headers = {};

        if (token) {
          headers.Authorization =
            `Bearer ${token}`;
        }

        /*
         * نجلب في نفس الوقت:
         *
         * 1) تفاصيل المادة والإحصائيات:
         *    /subjects/:id/
         *
         * 2) قائمة الفصول:
         *    /subjects/:id/chapters/
         */
        const [
          subjectResponse,
          chaptersResponse,
        ] = await Promise.all([
          axios.get(
            `${baseURL}/api/course/subjects/${id_subjects}/`,
            {
              signal:
                controller.signal,
              headers,
            }
          ),

          axios.get(
            `${baseURL}/api/course/subjects/${id_subjects}/chapters/`,
            {
              signal:
                controller.signal,
              headers,
            }
          ),
        ]);

        const receivedSubject =
          subjectResponse?.data?.subject ??
          subjectResponse?.data ??
          null;

        const responseChapters =
          Array.isArray(
            chaptersResponse.data?.chapters
          )
            ? chaptersResponse.data.chapters
            : Array.isArray(
                  chaptersResponse.data
                )
              ? chaptersResponse.data
              : [];

        setSubjectDetails(
          receivedSubject
        );

        setChapters(
          responseChapters
        );
      } catch (err) {
        if (
          err.name ===
            "CanceledError" ||
          axios.isCancel(err)
        ) {
          return;
        }

        console.error(
          "Erreur lors du chargement des chapitres :",
          err
        );

        const status =
          err.response?.status;

        if (status === 401) {
          setError(
            "يجب تسجيل الدخول للوصول إلى الفصول"
          );
        } else if (
          status === 403
        ) {
          setError(
            "ليس لديك صلاحية للوصول إلى هذه المادة"
          );
        } else if (
          status === 404
        ) {
          setError(
            "المادة المطلوبة غير موجودة"
          );
        } else if (
          !err.response
        ) {
          setError(
            "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت أو إعدادات الخادم"
          );
        } else {
          setError(
            err.response?.data
              ?.detail ||
              err.response?.data
                ?.message ||
              "حدث خطأ أثناء تحميل الفصول"
          );
        }

        setChapters([]);
        setSubjectDetails(null);
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    };

    fetchPageData();

    return () => {
      controller.abort();
    };
  }, [
    baseURL,
    id_subjects,
    refreshKey,
    token,
  ]);

  const chapterLessons =
    useMemo(() => {
      return chapters
        .slice()
        .sort(
          (first, second) =>
            (first.order ?? 0) -
            (second.order ?? 0)
        )
        .map((chapter) => {
          const axesCount =
            Number(
              chapter.axes_count ??
                chapter.axes?.length ??
                0
            );

          return {
            id: chapter.id,
            code: chapter.code,
            title: chapter.title,
            order: chapter.order,
            is_active:
              chapter.is_active,
            axes_count:
              axesCount,

            category:
              "chapter",

            description:
              axesCount === 1
                ? "محور واحد"
                : `${axesCount} محاور`,

            lessonsCount:
              axesCount,

            progress:
              chapter.progress ?? 0,

            path:
              `/subjects/${id_subjects}/lesson/${chapter.id}`,
          };
        });
    }, [
      chapters,
      id_subjects,
    ]);

  /*
   * البيانات النهائية التي نمررها إلى
   * CourseHero و CourseSidebar.
   *
   * statistics تأتي من SubjectDetailSerializer.
   */
  const courseData = useMemo(() => {
    const statistics =
      subjectDetails?.statistics ?? {};

    const branch =
      subjectDetails?.user_branch ?? null;

    return {
      ...mathCourse,

      id:
        subjectDetails?.id ??
        mathCourse?.id,

      code:
        subjectDetails?.code ??
        mathCourse?.code,

      title:
        subjectDetails?.name ??
        mathCourse?.title ??
        "المادة",

      name:
        subjectDetails?.name ??
        mathCourse?.name ??
        "المادة",

      description:
        subjectDetails?.description ??
        mathCourse?.description ??
        "",

      branch,

      branchName:
        branch?.name ?? "غير محددة",

      branchCode:
        branch?.code ?? null,

      chaptersCount:
        Number(
          statistics?.chapters_count ??
          chapters.length ??
          0
        ),

      axesCount:
        Number(
          statistics?.axes_count ?? 0
        ),

      lessonsCount:
        Number(
          statistics?.axes_count ?? 0
        ),

      exercisesCount:
        Number(
          statistics?.exercises_count ?? 0
        ),

      bacExercisesCount:
        Number(
          statistics?.bac_exercises_count ?? 0
        ),

      statistics,
    };
  }, [
    chapters.length,
    subjectDetails,
  ]);

  const handleChapterClick = (chapter) => {
  if (chapter.is_active === false) {
    return;
  }

  console.log("Nom matière envoyé :", courseData.name);

  navigate(
    `/subjects/${id_subjects}/lesson/${chapter.id}`,
    {
      state: {
        courseName: courseData.name,
        subjectName: courseData.name,
        subjectId: courseData.id,
      },
    }
  );
};

  const handleChapterKeyDown = (
    event,
    chapter
  ) => {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      handleChapterClick(
        chapter
      );
    }
  };

  const handleRefresh = () => {
    setRefreshKey(
      (current) =>
        current + 1
    );
  };

  return (
    <div
      dir="rtl"
      className="
        min-h-full
        w-full
        bg-[#fafbff]
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-[1600px]
          px-3
          py-4

          sm:px-5
          sm:py-5

          md:px-6

          lg:px-8
          lg:py-7

          xl:px-10

          2xl:px-12
        "
      >
        {/* Page header */}
        <header
          className="
            mb-4
            flex flex-col
            gap-4

            sm:mb-5

            md:flex-row
            md:items-center
            md:justify-between

            lg:mb-6
          "
        >
          <div className="min-w-0">
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
                  flex h-11 w-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-gradient-to-br
                  from-violet-500
                  to-blue-600
                  text-white
                  shadow-lg
                  shadow-violet-200/60

                  sm:h-12
                  sm:w-12

                  lg:h-14
                  lg:w-14
                  lg:rounded-2xl
                "
              >
                <Calculator
                  size={24}
                />
              </div>

              <div className="min-w-0">
                <h1
                  className="
                    truncate
                    text-xl
                    font-black
                    text-slate-900

                    sm:text-2xl

                    lg:text-3xl
                  "
                >
                  {courseData.name}
                </h1>

                <p
                  className="
                    mt-1
                    text-xs
                    font-semibold
                    text-slate-400

                    sm:text-sm
                  "
                >
                  {loading
                    ? "جاري تحميل الفصول..."
                    : error
                      ? "تعذر تحميل الفصول"
                      : `${courseData.chaptersCount} فصل متوفر`}
                </p>
              </div>
            </div>

            {/* Breadcrumb */}
            <div
              className="
                mt-3
                flex
                min-w-0
                flex-wrap
                items-center
                gap-1.5
                text-[11px]
                font-semibold
                text-slate-400

                sm:gap-2
                sm:text-xs
              "
            >
              <button
                type="button"
                onClick={() =>
                  navigate("/")
                }
                className="
                  transition
                  hover:text-violet-600
                "
              >
                الرئيسية
              </button>

              <ChevronLeft
                size={13}
              />

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/subjects"
                  )
                }
                className="
                  transition
                  hover:text-violet-600
                "
              >
                المواد
              </button>

              <ChevronLeft
                size={13}
              />

              <span
                className="
                  max-w-[160px]
                  truncate
                  text-violet-600

                  sm:max-w-none
                "
              >
                {courseData.name}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/subjects"
              )
            }
            className="
              flex h-11
              w-full
              shrink-0
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-slate-200
              bg-white
              px-4
              text-sm
              font-bold
              text-slate-600
              shadow-sm
              transition

              hover:border-violet-300
              hover:bg-violet-50
              hover:text-violet-600

              active:scale-[0.98]

              sm:w-auto
            "
          >
            <ArrowRight
              size={18}
            />

            <span>
              العودة إلى المواد
            </span>
          </button>
        </header>

        {/* Main responsive grid */}
        <div
          className="
            grid
            min-w-0
            gap-4

            lg:gap-5

            xl:grid-cols-[minmax(0,1fr)_280px]
            xl:gap-6

            2xl:grid-cols-[minmax(0,1fr)_300px]
          "
        >
          {/* Main content */}
          <section
            className="
              min-w-0
              space-y-4

              sm:space-y-5
            "
          >
            <CourseHero
              course={
                mathCourse
              }
            />

            {/* Chapters title */}
            <div
              className="
                flex
                items-center
                justify-between
                gap-3
                rounded-2xl
                border
                border-slate-100
                bg-white
                p-4
                shadow-sm

                sm:px-5
                sm:py-4
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
                    flex h-10 w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-violet-50
                    text-violet-600
                  "
                >
                  <BookOpen
                    size={20}
                  />
                </div>

                <div className="min-w-0">
                  <h2
                    className="
                      truncate
                      text-sm
                      font-extrabold
                      text-slate-900

                      sm:text-base
                    "
                  >
                    فصول المادة
                  </h2>

                  <p
                    className="
                      mt-1
                      hidden
                      text-xs
                      font-semibold
                      text-slate-400

                      sm:block
                    "
                  >
                    اختر الفصل الذي تريد دراسته
                  </p>
                </div>
              </div>

              {!loading &&
                !error && (
                  <span
                    className="
                      shrink-0
                      rounded-full
                      bg-violet-50
                      px-3
                      py-1.5
                      text-[11px]
                      font-extrabold
                      text-violet-600

                      sm:text-xs
                    "
                  >
                    {courseData.chaptersCount}
                    {" "}
                    فصل
                  </span>
                )}
            </div>

            {/* Loading */}
            {loading && (
              <div
                className="
                  flex
                  min-h-[220px]
                  flex-col
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-slate-100
                  bg-white
                  p-6
                  text-center
                  shadow-sm

                  sm:min-h-[260px]
                  sm:p-10
                "
              >
                <div
                  className="
                    flex h-14 w-14
                    items-center
                    justify-center
                    rounded-2xl
                    bg-violet-50
                  "
                >
                  <Loader2
                    size={30}
                    className="
                      animate-spin
                      text-violet-600
                    "
                  />
                </div>

                <p
                  className="
                    mt-4
                    text-sm
                    font-bold
                    text-slate-600

                    sm:text-base
                  "
                >
                  جاري تحميل الفصول...
                </p>

                <p
                  className="
                    mt-2
                    text-xs
                    text-slate-400
                  "
                >
                  يرجى الانتظار قليلًا
                </p>
              </div>
            )}

            {/* Error */}
            {!loading &&
              error && (
                <div
                  className="
                    flex
                    min-h-[220px]
                    flex-col
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-red-100
                    bg-white
                    p-6
                    text-center
                    shadow-sm

                    sm:min-h-[260px]
                    sm:p-10
                  "
                >
                  <div
                    className="
                      flex h-14 w-14
                      items-center
                      justify-center
                      rounded-2xl
                      bg-red-50
                      text-red-500
                    "
                  >
                    <AlertCircle
                      size={27}
                    />
                  </div>

                  <p
                    className="
                      mt-4
                      max-w-lg
                      text-sm
                      font-extrabold
                      leading-7
                      text-slate-700

                      sm:text-base
                    "
                  >
                    {error}
                  </p>

                  <div
                    className="
                      mt-5
                      flex
                      w-full
                      flex-col
                      gap-2

                      sm:w-auto
                      sm:flex-row
                    "
                  >
                    <button
                      type="button"
                      onClick={
                        handleRefresh
                      }
                      className="
                        flex h-11
                        items-center
                        justify-center
                        gap-2
                        rounded-xl
                        bg-violet-600
                        px-5
                        text-sm
                        font-bold
                        text-white
                        transition

                        hover:bg-violet-700

                        active:scale-[0.98]
                      "
                    >
                      <RefreshCw
                        size={17}
                      />

                      إعادة المحاولة
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          "/subjects"
                        )
                      }
                      className="
                        flex h-11
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-5
                        text-sm
                        font-bold
                        text-slate-600
                        transition

                        hover:border-violet-200
                        hover:bg-violet-50
                        hover:text-violet-600
                      "
                    >
                      العودة للمواد
                    </button>
                  </div>
                </div>
              )}

            {/* Chapters */}
            {!loading &&
              !error &&
              chapterLessons.length >
                0 && (
                <div
                  className="
                    grid
                    min-w-0
                    grid-cols-1
                    gap-3

                    2xl:gap-4
                  "
                >
                  {chapterLessons.map(
                    (chapter) => {
                      const disabled =
                        chapter.is_active ===
                        false;

                      return (
                        <div
                          key={
                            chapter.id
                          }
                          role="button"
                          tabIndex={
                            disabled
                              ? -1
                              : 0
                          }
                          aria-disabled={
                            disabled
                          }
                          onClick={() =>
                            handleChapterClick(
                              chapter
                            )
                          }
                          onKeyDown={(
                            event
                          ) =>
                            handleChapterKeyDown(
                              event,
                              chapter
                            )
                          }
                          className={`
                            min-w-0
                            rounded-2xl
                            outline-none
                            transition

                            focus-visible:ring-4
                            focus-visible:ring-violet-100

                            ${
                              disabled
                                ? `
                                  cursor-not-allowed
                                  opacity-60
                                `
                                : `
                                  cursor-pointer

                                  hover:-translate-y-0.5
                                `
                            }
                          `}
                        >
                          <LessonCard
  lesson={chapter}
  courseName={courseData.name}
  onOpen={() => handleChapterClick(chapter)}
/>
                        </div>
                      );
                    }
                  )}
                </div>
              )}

            {/* Empty */}
            {!loading &&
              !error &&
              chapterLessons.length ===
                0 && (
                <div
                  className="
                    flex
                    min-h-[230px]
                    flex-col
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-dashed
                    border-slate-200
                    bg-white
                    p-6
                    text-center
                    shadow-sm

                    sm:min-h-[270px]
                    sm:p-10
                  "
                >
                  <div
                    className="
                      flex h-14 w-14
                      items-center
                      justify-center
                      rounded-2xl
                      bg-slate-50
                      text-slate-400
                    "
                  >
                    <BookOpen
                      size={27}
                    />
                  </div>

                  <p
                    className="
                      mt-4
                      text-sm
                      font-extrabold
                      text-slate-700

                      sm:text-base
                    "
                  >
                    لا توجد فصول متاحة لهذه المادة
                  </p>

                  <p
                    className="
                      mt-2
                      max-w-sm
                      text-xs
                      leading-6
                      text-slate-400

                      sm:text-sm
                    "
                  >
                    ستظهر الفصول هنا بعد إضافتها وتفعيلها من لوحة الإدارة.
                  </p>
                </div>
              )}
          </section>

          {/* Course sidebar */}
          <aside
            className="
              min-w-0

              xl:sticky
              xl:top-6
              xl:self-start
            "
          >
            <CourseSidebar
              course={
                courseData
              }
            />
          </aside>
        </div>
      </div>
    </div>
  );
}