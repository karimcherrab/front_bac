// src/pages/SubjectsPage.jsx

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

import {
  Atom,
  Beaker,
  Binary,
  BookOpen,
  Brain,
  Code2,
  FlaskConical,
  Globe2,
  Languages,
  Loader2,
  Microscope,
  Pi,
  RefreshCw,
  Sigma,
  TriangleAlert,
} from "lucide-react";

import CategoryFilters from "../components/dashboard/CategoryFilters";
import SubjectCard from "../components/dashboard/SubjectCard";

import {
  subjectCategories,
} from "../data/subjectsData";

import {
  UserContext,
} from "../Utils/UserContext";

const COURSE_URL =
  import.meta.env.VITE_COURSE_URL;

const NORMALIZED_COURSE_URL =
  COURSE_URL?.replace(/\/+$/, "");

const URL_GET_SUBJECTS =
  NORMALIZED_COURSE_URL
    ? `${NORMALIZED_COURSE_URL}/subjects/my-branch/`
    : "";

const iconMap = {
  Calculator: Sigma,
  BookOpen,
  Atom,
  Beaker,
  Binary,
  Brain,
  Code2,
  FlaskConical,
  Globe2,
  Languages,
  Microscope,
  Pi,
  Sigma,
};

export default function SubjectsPage() {
  const {
    token,
    logout,
  } = useContext(UserContext);

  const [
    subjects,
    setSubjects,
  ] = useState([]);

  const [
    activeCategory,
    setActiveCategory,
  ] = useState("all");

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

  const formatSubjects = useCallback(
    (apiSubjects) => {
      return apiSubjects.map(
        (subject) => {
          const SubjectIcon =
            iconMap[
              subject.icon
            ] || BookOpen;

          return {
            id: subject.id,

            code:
              subject.code,

            title:
              subject.name ||
              subject.title ||
              "مادة بدون اسم",

            description:
              subject.description ||
              "",

            theme:
              subject.theme ||
              "purple",

            icon:
              SubjectIcon,

            progress:
              Math.min(
                100,
                Math.max(
                  0,
                  Number(
                    subject.progress,
                  ) || 0,
                ),
              ),

            lessons:
              Number(
                subject.lessons ??
                  subject.chapters_count ??
                  0,
              ) || 0,

            exercises:
              Number(
                subject.exercises ??
                  subject.exercises_count ??
                  0,
              ) || 0,

            path:
              subject.path ||
              `/subjects/${subject.id}`,

            category:
              subject.category ||
              "all",

            is_active:
              subject.is_active !==
              false,
          };
        },
      );
    },
    [],
  );

  useEffect(() => {
    const controller =
      new AbortController();

    const getSubjects =
      async () => {
        if (!COURSE_URL) {
          setSubjects([]);

          setError(
            "الرابط VITE_COURSE_URL غير موجود في ملف البيئة.",
          );

          setLoading(false);

          return;
        }

        if (!token) {
          setSubjects([]);

          setError(
            "يجب تسجيل الدخول لعرض المواد.",
          );

          setLoading(false);

          return;
        }

        try {
          setLoading(true);
          setError("");

          const response =
            await axios.get(
              URL_GET_SUBJECTS,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                signal:
                  controller.signal,

                timeout: 15000,
              },
            );

          const apiSubjects =
            Array.isArray(
              response.data
                ?.subjects,
            )
              ? response.data
                  .subjects
              : Array.isArray(
                    response.data,
                  )
                ? response.data
                : [];

          const formattedSubjects =
            formatSubjects(
              apiSubjects,
            );

          setSubjects(
            formattedSubjects,
          );
        } catch (requestError) {
          if (
            requestError.code ===
              "ERR_CANCELED" ||
            requestError.name ===
              "CanceledError" ||
            axios.isCancel(
              requestError,
            )
          ) {
            return;
          }

          console.error(
            "Error getting subjects:",
            requestError,
          );

          setSubjects([]);

          const status =
            requestError.response
              ?.status;

          const responseData =
            requestError.response
              ?.data;

          if (status === 401) {
            setError(
              "انتهت صلاحية تسجيل الدخول. سجل الدخول من جديد.",
            );

            if (
              typeof logout ===
              "function"
            ) {
              logout();
            }
          } else if (
            status === 403
          ) {
            setError(
              "ليس لديك صلاحية لعرض المواد.",
            );
          } else if (
            status === 404
          ) {
            setError(
              "رابط المواد غير موجود على الخادم.",
            );
          } else if (
            responseData?.message
          ) {
            setError(
              responseData.message,
            );
          } else if (
            responseData?.detail
          ) {
            setError(
              responseData.detail,
            );
          } else if (
            requestError.code ===
            "ECONNABORTED"
          ) {
            setError(
              "استغرق الاتصال بالخادم وقتاً طويلاً. حاول مرة أخرى.",
            );
          } else if (
            !requestError.response
          ) {
            setError(
              "تعذر الاتصال بالخادم. تحقق من الإنترنت أو إعدادات الخادم.",
            );
          } else {
            setError(
              "حدث خطأ أثناء تحميل المواد.",
            );
          }
        } finally {
          if (
            !controller.signal
              .aborted
          ) {
            setLoading(false);
          }
        }
      };

    getSubjects();

    return () => {
      controller.abort();
    };
  }, [
    token,
    logout,
    refreshKey,
    formatSubjects,
  ]);

  const filteredSubjects =
    useMemo(() => {
      if (
        activeCategory ===
        "all"
      ) {
        return subjects;
      }

      return subjects.filter(
        (subject) =>
          subject.category ===
          activeCategory,
      );
    }, [
      subjects,
      activeCategory,
    ]);

  const handleRetry = () => {
    setRefreshKey(
      (current) =>
        current + 1,
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
            mb-5
            flex flex-col
            gap-4

            sm:mb-6

            md:flex-row
            md:items-center
            md:justify-between
          "
        >
          <div
            className="
              flex min-w-0
              items-start gap-3
            "
          >
            <div
              className="
                flex h-11 w-11
                shrink-0 items-center
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
              <BookOpen
                size={25}
              />
            </div>

            <div className="min-w-0">
              <h1
                className="
                  text-xl
                  font-black
                  text-slate-900

                  sm:text-2xl

                  lg:text-3xl
                "
              >
                المواد
              </h1>

              <p
                className="
                  mt-1
                  text-xs
                  font-medium
                  leading-6
                  text-slate-500

                  sm:text-sm
                "
              >
                استكشف جميع المواد
                المتاحة وابدأ التعلم
              </p>
            </div>
          </div>

          {!loading &&
            !error && (
              <div
                className="
                  flex w-full
                  items-center
                  justify-between
                  gap-3
                  rounded-xl
                  border
                  border-slate-100
                  bg-white
                  px-4
                  py-3
                  shadow-sm

                  sm:w-auto
                  sm:justify-start
                "
              >
                <span
                  className="
                    text-xs
                    font-semibold
                    text-slate-500

                    sm:text-sm
                  "
                >
                  المواد المتوفرة
                </span>

                <span
                  className="
                    flex h-8
                    min-w-8
                    items-center
                    justify-center
                    rounded-lg
                    bg-violet-50
                    px-2
                    text-sm
                    font-extrabold
                    text-violet-600
                  "
                >
                  {subjects.length}
                </span>
              </div>
            )}
        </header>

        {/* Categories */}
        <div
          className="
            min-w-0
            overflow-x-auto
            pb-1
          "
        >
          <CategoryFilters
            categories={
              subjectCategories
            }
            activeCategory={
              activeCategory
            }
            onChange={
              setActiveCategory
            }
          />
        </div>

        {/* Loading */}
        {loading && (
          <div
            className="
              mt-5
              flex min-h-[240px]
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

              sm:mt-6
              sm:min-h-[280px]
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
                font-extrabold
                text-slate-700

                sm:text-base
              "
            >
              جاري تحميل المواد...
            </p>

            <p
              className="
                mt-2
                text-xs
                text-slate-400
              "
            >
              يرجى الانتظار قليلاً
            </p>
          </div>
        )}

        {/* Error */}
        {!loading &&
          error && (
            <div
              className="
                mt-5
                flex min-h-[240px]
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

                sm:mt-6
                sm:min-h-[280px]
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
                <TriangleAlert
                  size={28}
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

              <button
                type="button"
                onClick={
                  handleRetry
                }
                className="
                  mt-5
                  flex h-11
                  w-full
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

                  sm:w-auto
                "
              >
                <RefreshCw
                  size={17}
                />

                إعادة المحاولة
              </button>
            </div>
          )}

        {/* Subjects */}
        {!loading &&
          !error && (
            <>
              {filteredSubjects.length >
              0 ? (
                <section
                  className="
                    mt-5
                    grid
                    min-w-0
                    grid-cols-1
                    gap-3

                    sm:grid-cols-2
                    sm:gap-4

                    lg:grid-cols-2

                    xl:grid-cols-3

                    2xl:grid-cols-4
                  "
                >
                  {filteredSubjects.map(
                    (subject) => (
                      <div
                        key={
                          subject.id
                        }
                        className="
                          min-w-0
                          transition
                          duration-200

                          hover:-translate-y-0.5
                        "
                      >
                        <SubjectCard
                          subject={
                            subject
                          }
                        />
                      </div>
                    ),
                  )}
                </section>
              ) : (
                <div
                  className="
                    mt-5
                    flex min-h-[230px]
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

                    sm:mt-6
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
                    لا توجد مواد في هذا
                    التصنيف حالياً
                  </p>

                  <p
                    className="
                      mt-2
                      max-w-md
                      text-xs
                      leading-6
                      text-slate-400

                      sm:text-sm
                    "
                  >
                    اختر تصنيفاً آخر أو
                    اعرض جميع المواد
                    المتوفرة.
                  </p>

                  {activeCategory !==
                    "all" && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveCategory(
                          "all",
                        )
                      }
                      className="
                        mt-5
                        h-11
                        rounded-xl
                        bg-violet-600
                        px-5
                        text-sm
                        font-bold
                        text-white
                        transition

                        hover:bg-violet-700
                      "
                    >
                      عرض جميع المواد
                    </button>
                  )}
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
}