// src/components/Sidebar.jsx

import {
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  BookMarked,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LayoutGrid,
  Loader2,
  X,
} from "lucide-react";

import axios from "axios";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import Logo from "./Logo";
import LessonPartsList from "./LessonPartsList";

import {
  UserContext,
} from "../Utils/UserContext";


const API_BASE_URL =
  import.meta.env.VITE_BASE_URL
    ?.replace(/\/+$/, "");


/*
 * Seulement un fallback.
 *
 * Le vrai titre sera récupéré depuis:
 * GET /api/course/chapters/:id/
 */
const DEFAULT_UNIT_TITLE =
  "الوحدة الحالية";


function firstNonEmpty(...values) {
  return values.find(
    (value) =>
      typeof value === "string" &&
      value.trim().length > 0,
  );
}


/*
 * Transforme la réponse Chapter Django:
 *
 * {
 *   id: 12,
 *   subject: 2,
 *   subject_name: "...",
 *   code: "...",
 *   title: "...",
 *   order: 1,
 *   is_active: true
 * }
 *
 * vers le format utilisé par CurrentUnitCard.
 */
function normalizeChapter(
  chapter,
  chapterId,
) {
  if (!chapter) {
    return null;
  }

  const title =
    firstNonEmpty(
      chapter.title,
      chapter.chapter_title,
      chapter.chapter_name,
      chapter.name,
      chapter.label,
    );

  if (!title) {
    return null;
  }

  return {
    id:
      chapter.id ??
      chapter.pk ??
      chapterId,

    title,

    description:
      firstNonEmpty(
        chapter.description,
        chapter.summary,
        chapter.subtitle,
      ) || "",

    code:
      chapter.code || "",

    subject:
      chapter.subject ?? null,

    subjectName:
      chapter.subject_name || "",

    order:
      chapter.order ?? 0,

    isActive:
      chapter.is_active ?? true,
  };
}


export default function Sidebar({
  collapsed,
  setCollapsed,

  /*
   * On garde les props pour compatibilité.
   * Mais les paramètres URL sont prioritaires.
   */
  id_subjects,
  id_chapter,

  mobileOpen,
  onCloseMobile,
  onUnitChange,
}) {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  /*
   * Route:
   *
   * /subjects/:id_subjects/lesson/:id_chapter
   */
  const params =
    useParams();

  /*
   * On lit les IDs directement dans l'URL.
   *
   * Si jamais Sidebar reçoit encore les IDs par props,
   * on les utilise comme fallback.
   */
  const subjectId =
    params.id_subjects ||
    id_subjects;

  const chapterId =
    params.id_chapter ||
    id_chapter;


  const {
    token,
    user,
    setActiveId,
    setCurrent_axis,
  } = useContext(UserContext);


  const [
    lessonParts,
    setLessonParts,
  ] = useState([]);


  const [
    loadingParts,
    setLoadingParts,
  ] = useState(true);


  const [
    partsError,
    setPartsError,
  ] = useState("");


  /*
   * Chargement séparé des informations Chapter.
   */
  const [
    loadingChapter,
    setLoadingChapter,
  ] = useState(true);


  const [
    chapterError,
    setChapterError,
  ] = useState("");


  /*
   * Le titre réel du Chapter sera mis ici.
   */
  const [
    unitInfo,
    setUnitInfo,
  ] = useState({
    id: chapterId,
    title: DEFAULT_UNIT_TITLE,
    description: "",
  });


  const updateUnitInfo =
    useCallback(
      (nextUnit) => {
        if (!nextUnit) {
          return;
        }

        setUnitInfo(nextUnit);

        if (
          typeof onUnitChange ===
          "function"
        ) {
          onUnitChange(nextUnit);
        }
      },
      [onUnitChange],
    );


  const branchCode =
    user?.branch?.code;


  /*
   * =====================================================
   * GET CHAPTER BY ID
   * =====================================================
   *
   * URL frontend:
   *
   * /subjects/2/lesson/15
   *
   * params.id_chapter = 15
   *
   * Puis:
   *
   * GET /api/course/chapters/15/
   */
  const getChapterInfo =
    useCallback(async () => {
      if (!chapterId) {
        setUnitInfo({
          id: null,
          title: DEFAULT_UNIT_TITLE,
          description: "",
        });

        setChapterError(
          "معرّف الوحدة غير موجود.",
        );

        setLoadingChapter(false);

        return;
      }


      if (!API_BASE_URL) {
        setUnitInfo({
          id: chapterId,
          title: DEFAULT_UNIT_TITLE,
          description: "",
        });

        setChapterError(
          "رابط الخادم غير مضبوط.",
        );

        setLoadingChapter(false);

        return;
      }


      try {
        setLoadingChapter(true);
        setChapterError("");


        const response =
          await axios.get(
            `${API_BASE_URL}/api/course/chapters/${chapterId}/`,
            {
              headers: token
                ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                : {},

              timeout: 15000,
            },
          );


        /*
         * On accepte plusieurs formats éventuels:
         *
         * {
         *    id: 1,
         *    title: "..."
         * }
         *
         * ou
         *
         * {
         *    chapter: {...}
         * }
         *
         * ou
         *
         * {
         *    data: {...}
         * }
         */
        const chapterPayload =
          response?.data?.chapter ??
          response?.data?.data ??
          response?.data;


        const chapter =
          normalizeChapter(
            chapterPayload,
            chapterId,
          );


        if (!chapter) {
          throw new Error(
            "INVALID_CHAPTER_RESPONSE",
          );
        }


        /*
         * Ici le vrai title Django remplace
         * DEFAULT_UNIT_TITLE.
         */
        updateUnitInfo(
          chapter,
        );
      } catch (error) {
        console.error(
          "GET CHAPTER ERROR:",
          error,
        );


        /*
         * Fallback éventuel depuis location.state.
         */
        const routeTitle =
          firstNonEmpty(
            location.state
              ?.chapter?.title,

            location.state
              ?.chapter_title,

            location.state
              ?.title,
          );


        updateUnitInfo({
          id: chapterId,

          title:
            routeTitle ||
            DEFAULT_UNIT_TITLE,

          description:
            firstNonEmpty(
              location.state
                ?.chapter?.description,

              location.state
                ?.description,
            ) || "",
        });


        if (
          error?.response
            ?.status === 401
        ) {
          setChapterError(
            "انتهت صلاحية تسجيل الدخول.",
          );
        } else if (
          error?.response
            ?.status === 403
        ) {
          setChapterError(
            "ليس لديك صلاحية لعرض هذه الوحدة.",
          );
        } else if (
          error?.response
            ?.status === 404
        ) {
          setChapterError(
            "لم يتم العثور على هذه الوحدة.",
          );
        } else if (
          error?.code ===
          "ECONNABORTED"
        ) {
          setChapterError(
            "استغرق تحميل معلومات الوحدة وقتاً طويلاً.",
          );
        } else if (
          error?.code ===
            "ERR_NETWORK" ||
          !error?.response
        ) {
          setChapterError(
            "تعذر الاتصال بالخادم.",
          );
        } else {
          setChapterError(
            "تعذر تحميل معلومات الوحدة.",
          );
        }
      } finally {
        setLoadingChapter(false);
      }
    }, [
      chapterId,
      token,
      location.state,
      updateUnitInfo,
    ]);


  /*
   * =====================================================
   * GET AXES
   * =====================================================
   */
  const getLessonParts =
    useCallback(async () => {
      if (!chapterId) {
        setLessonParts([]);

        setPartsError(
          "معرّف الوحدة غير موجود.",
        );

        setLoadingParts(false);

        return;
      }


      if (!branchCode) {
        setLessonParts([]);

        setPartsError(
          "لم يتم العثور على شعبة التلميذ.",
        );

        setLoadingParts(false);

        return;
      }


      if (!API_BASE_URL) {
        setLessonParts([]);

        setPartsError(
          "رابط الخادم غير مضبوط.",
        );

        setLoadingParts(false);

        return;
      }


      try {
        /*
         * Très important lorsqu'on change Chapter:
         * supprimer immédiatement l'ancien axe.
         */
        setCurrent_axis(null);
        setActiveId("intro");

        setLoadingParts(true);
        setPartsError("");


        const response =
          await axios.get(
            `${API_BASE_URL}/api/course/axes/${chapterId}/branch/${branchCode}/`,
            {
              headers: token
                ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                : {},

              timeout: 15000,
            },
          );


        const payload =
          response?.data;


        const axes =
          Array.isArray(
            payload?.axes,
          )
            ? payload.axes
            : Array.isArray(
                  payload,
                )
              ? payload
              : [];


        /*
         * Trier les axes.
         */
        const orderedAxes = [
          ...axes,
        ].sort(
          (
            firstAxis,
            secondAxis,
          ) =>
            Number(
              firstAxis?.order ??
                0,
            ) -
            Number(
              secondAxis?.order ??
                0,
            ),
        );


        setLessonParts(
          orderedAxes,
        );


        /*
         * IMPORTANT:
         *
         * On ne récupère PLUS le titre Chapter depuis
         * le premier axe.
         *
         * Le titre vient exclusivement de:
         *
         * GET /api/course/chapters/:id/
         */


        /*
         * Ouvrir automatiquement le premier axe.
         */
        if (
          orderedAxes.length >
          0
        ) {
          setCurrent_axis(
            orderedAxes[0],
          );

          setActiveId(
            "intro",
          );
        } else {
          setCurrent_axis(
            null,
          );
        }
      } catch (error) {
        console.error(
          "GET AXES ERROR:",
          error,
        );


        setLessonParts([]);


        if (
          error?.response
            ?.status === 401
        ) {
          setPartsError(
            "انتهت صلاحية تسجيل الدخول.",
          );
        } else if (
          error?.response
            ?.status === 403
        ) {
          setPartsError(
            "ليس لديك صلاحية لعرض هذه الدروس.",
          );
        } else if (
          error?.response
            ?.status === 404
        ) {
          setPartsError(
            "لم يتم العثور على محاور هذه الوحدة.",
          );
        } else if (
          error?.code ===
          "ECONNABORTED"
        ) {
          setPartsError(
            "استغرق الاتصال بالخادم وقتاً طويلاً.",
          );
        } else if (
          error?.code ===
            "ERR_NETWORK" ||
          !error?.response
        ) {
          setPartsError(
            "تعذر الاتصال بالخادم.",
          );
        } else {
          setPartsError(
            "تعذر تحميل أجزاء الدرس.",
          );
        }
      } finally {
        setLoadingParts(false);
      }
    }, [
      token,
      chapterId,
      branchCode,
      setCurrent_axis,
      setActiveId,
    ]);


  /*
   * =====================================================
   * Quand id_chapter dans URL change:
   *
   * 1. effacer ancien Chapter
   * 2. récupérer nouveau Chapter
   * 3. récupérer ses axes
   * =====================================================
   */
  useEffect(() => {
    setUnitInfo({
      id: chapterId,
      title: DEFAULT_UNIT_TITLE,
      description: "",
    });

    setLessonParts([]);

    setCurrent_axis(null);
    setActiveId("intro");

    getChapterInfo();
    getLessonParts();
  }, [
    chapterId,
    getChapterInfo,
    getLessonParts,
    setCurrent_axis,
    setActiveId,
  ]);


  const closeMobileSidebar =
    () => {
      if (
        typeof onCloseMobile ===
        "function"
      ) {
        onCloseMobile();
      }
    };


  const openAllLessons = () => {
    setCurrent_axis(null);
    setActiveId("intro");

    closeMobileSidebar();


    if (subjectId) {
      navigate(
        `/subjects/${subjectId}`,
      );

      return;
    }


    navigate(
      "/subjects",
    );
  };


  const openHome = () => {
    closeMobileSidebar();

    navigate(
      "/home",
    );
  };


  const openBacExercises = () => {
    setActiveId(
      "bac",
    );

    closeMobileSidebar();
  };


  const openBacLikeExercises =
    () => {
      setActiveId(
        "generete-bac",
      );

      closeMobileSidebar();
    };


  const toggleDesktopSidebar =
    () => {
      if (
        window.innerWidth >=
        1024
      ) {
        setCollapsed(
          (previous) =>
            !previous,
        );
      }
    };


  return (
    <>
      {/* Mobile overlay */}
      <button
        type="button"
        onClick={
          closeMobileSidebar
        }
        aria-label="إغلاق القائمة الجانبية"
        className={[
          "fixed inset-0 z-40",
          "bg-slate-950/50",
          "backdrop-blur-[2px]",
          "transition-opacity",
          "duration-300",
          "lg:hidden",

          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        ].join(" ")}
      />


      <aside
        dir="rtl"
        className={[
          "fixed inset-y-0 right-0 z-50",

          "flex h-dvh min-h-dvh shrink-0 flex-col",

          "overflow-hidden",

          "bg-gradient-to-b",
          "from-blue-600 via-blue-700 to-indigo-800",

          "text-white",

          "shadow-[-12px_0_45px_rgba(15,23,42,0.35)]",

          "transition-transform duration-300 ease-out",

          "w-[min(88vw,320px)]",
          "min-[430px]:w-[320px]",

          mobileOpen
            ? "translate-x-0"
            : "translate-x-full",

          "lg:relative",
          "lg:inset-auto",
          "lg:z-30",

          "lg:h-dvh",
          "lg:min-h-dvh",

          "lg:translate-x-0",

          "lg:flex-none",
          "lg:overflow-hidden",

          "lg:shadow-[8px_0_35px_-18px_rgba(15,23,42,0.65)]",

          "lg:transition-[width,min-width,max-width]",
          "lg:duration-300",

          collapsed
            ? [
                "lg:w-[82px]",
                "lg:min-w-[82px]",
                "lg:max-w-[82px]",
              ].join(" ")
            : [
                "lg:w-[310px]",
                "lg:min-w-[310px]",
                "lg:max-w-[310px]",
              ].join(" "),
        ].join(" ")}
      >
        {/* Background decorations */}
        <div
          className="
            pointer-events-none
            absolute
            -right-20
            top-24
            h-56
            w-56
            rounded-full
            bg-violet-400/10
            blur-3xl
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            -left-24
            bottom-20
            h-64
            w-64
            rounded-full
            bg-cyan-300/10
            blur-3xl
          "
        />


        {/* Header */}
        <div
          className="
            relative
            z-30
            shrink-0
            border-b
            border-white/10
            bg-white/[0.035]
            backdrop-blur-md
          "
        >
          <div
            className={[
              "flex min-h-[76px] items-center",

              collapsed
                ? "justify-center px-2"
                : "justify-between gap-3 px-4",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={openHome}
              aria-label="العودة إلى الصفحة الرئيسية"
              title="الصفحة الرئيسية"
              className={[
                "group flex min-w-0 items-center rounded-2xl transition duration-200",

                collapsed
                  ? "justify-center p-1.5"
                  : "justify-start px-1.5 py-2",

                "hover:bg-white/[0.07]",
                "active:scale-[0.98]",
              ].join(" ")}
            >
              <Logo
                collapsed={
                  collapsed
                }
              />
            </button>


            {!collapsed && (
              <button
                type="button"
                onClick={
                  toggleDesktopSidebar
                }
                aria-label="تصغير القائمة الجانبية"
                title="تصغير القائمة"
                className="
                  hidden
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-white/15
                  bg-white/10
                  text-blue-50
                  shadow-[0_8px_20px_rgba(30,64,175,0.18)]
                  backdrop-blur-sm
                  transition
                  duration-200

                  hover:border-white/25
                  hover:bg-white/15
                  hover:text-white

                  active:scale-95

                  lg:flex
                "
              >
                <ChevronRight
                  size={18}
                  strokeWidth={2.4}
                />
              </button>
            )}
          </div>


          {collapsed && (
            <button
              type="button"
              onClick={
                toggleDesktopSidebar
              }
              aria-label="توسيع القائمة الجانبية"
              title="توسيع القائمة"
              className="
                absolute
                -left-3
                top-[56px]
                z-50
                hidden
                h-7
                w-7
                items-center
                justify-center
                rounded-full
                border
                border-white/20
                bg-blue-700
                text-white
                shadow-[0_7px_20px_rgba(30,64,175,0.42)]
                transition
                duration-200

                hover:scale-105
                hover:bg-blue-800

                active:scale-95

                lg:flex
              "
            >
              <ChevronLeft
                size={15}
                strokeWidth={2.5}
              />
            </button>
          )}


          <button
            type="button"
            onClick={
              closeMobileSidebar
            }
            aria-label="إغلاق القائمة"
            className="
              absolute
              left-3
              top-[19px]
              z-50
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              border
              border-white/15
              bg-white/10
              text-white
              backdrop-blur
              transition

              hover:bg-white/20

              active:scale-95

              lg:hidden
            "
          >
            <X size={18} />
          </button>
        </div>


        {/* Collapsed */}
        {collapsed && (
          <div
            className="
              hidden
              min-h-0
              flex-1
              lg:flex
            "
          >
            <CollapsedSidebar
              chapterId={
                chapterId
              }
              lessonParts={
                lessonParts
              }
              onOpenBac={
                openBacExercises
              }
              onOpenBacLike={
                openBacLikeExercises
              }
              onOpenAllLessons={
                openAllLessons
              }
            />
          </div>
        )}


        {/* Full Sidebar */}
        <div
          className={[
            "min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden",

            collapsed
              ? "flex lg:hidden"
              : "flex",
          ].join(" ")}
        >
          <div
            className={[
              "relative z-10",

              "min-h-0 min-w-0 w-full max-w-full flex-1",

              "overflow-x-hidden",
              "overflow-y-auto",

              "overscroll-contain",

              "pb-5",

              "[scrollbar-width:thin]",

              "[scrollbar-color:rgba(255,255,255,0.30)_transparent]",

              "[&::-webkit-scrollbar]:w-[7px]",

              "[&::-webkit-scrollbar-track]:bg-transparent",

              "[&::-webkit-scrollbar-thumb]:rounded-full",

              "[&::-webkit-scrollbar-thumb]:bg-white/20",

              "hover:[&::-webkit-scrollbar-thumb]:bg-white/35",
            ].join(" ")}
          >
            {/*
              هنا unitInfo.title يأتي الآن من:
              Chapter.title
            */}
            <CurrentUnitCard
              unit={unitInfo}
              loading={
                loadingChapter
              }
              axesCount={
                lessonParts.length
              }
            />


            {/*
              لا نمنع المحاور من الظهور إذا فشل فقط
              GET Chapter.
            */}
            {chapterError &&
              !loadingChapter && (
                <p
                  className="
                    mx-4
                    mt-2
                    text-[10px]
                    font-semibold
                    text-amber-100/80
                  "
                >
                  {chapterError}
                </p>
              )}


            {loadingParts ? (
              <SidebarLoading />
            ) : partsError ? (
              <SidebarError
                message={
                  partsError
                }
                onRetry={
                  getLessonParts
                }
              />
            ) : (
              <LessonPartsList
                parts={
                  lessonParts
                }
                chapterId={
                  chapterId
                }
              />
            )}


            <SidebarExercisesSection
              onOpenBac={
                openBacExercises
              }
              onOpenBacLike={
                openBacLikeExercises
              }
            />
          </div>


          {/* Bottom actions */}
          <div
            className="
              relative
              z-10
              shrink-0
              space-y-2
              border-t
              border-white/10
              bg-blue-900/20
              p-3
              backdrop-blur-xl

              min-[380px]:p-4
            "
          >
            <button
              type="button"
              onClick={
                openAllLessons
              }
              className="
                flex
                min-h-[48px]
                w-full
                items-center
                justify-center
                gap-2
                rounded-2xl
                border
                border-white/10
                bg-white/10
                px-3
                py-3
                text-sm
                font-black
                text-white
                transition

                hover:-translate-y-0.5
                hover:bg-white/15
                hover:shadow-lg

                active:scale-[0.98]

                min-[380px]:px-4
                min-[380px]:py-3.5
              "
            >
              <LayoutGrid
                size={18}
              />

              عرض كل الدروس
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}


function CurrentUnitCard({
  unit,
  loading,
  axesCount,
}) {
  /*
   * Maintenant ceci correspond réellement à:
   *
   * Chapter.title
   */
  const title =
    unit?.title ||
    DEFAULT_UNIT_TITLE;


  const description =
    unit?.description || "";


  return (
    <section
      className="
        mx-3
        mt-5

        min-[380px]:mx-4
        min-[380px]:mt-6
      "
    >
      <div
        className="
          mb-2.5
          flex
          items-center
          justify-between
          gap-3
          px-1
        "
      >
        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          <span
            className="
              h-2
              w-2
              rounded-full
              bg-cyan-300
              shadow-[0_0_12px_rgba(103,232,249,0.75)]
            "
          />

          <p
            className="
              text-[11px]
              font-black
              text-blue-100/80
            "
          >
            الوحدة الحالية
          </p>
        </div>


        {!loading &&
          axesCount > 0 && (
            <span
              className="
                rounded-full
                border
                border-white/15
                bg-white/10
                px-2.5
                py-1
                text-[10px]
                font-black
                text-blue-50
                backdrop-blur
              "
            >
              {axesCount} محاور
            </span>
          )}
      </div>


      <div
        className="
          relative
          overflow-hidden
          rounded-2xl
          border
          border-white/12
          bg-blue-950/20
          p-3.5
          shadow-[0_12px_28px_rgba(30,64,175,0.22)]
          backdrop-blur-sm

          min-[380px]:p-4
        "
      >
        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            -left-12
            -top-12
            h-32
            w-32
            rounded-full
            bg-violet-400/15
            blur-3xl
          "
        />

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            -bottom-14
            right-4
            h-28
            w-28
            rounded-full
            bg-cyan-300/10
            blur-3xl
          "
        />


        <div
          className="
            relative
            flex
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
              rounded-xl
              border
              border-white/15
              bg-white/10
              text-white
              shadow-lg
              shadow-blue-950/10
            "
          >
            <BookMarked
              size={20}
            />
          </div>


          <div className="min-w-0">
            {loading ? (
              <>
                <div
                  className="
                    h-4
                    w-32
                    animate-pulse
                    rounded
                    bg-white/15
                  "
                />

                <div
                  className="
                    mt-2
                    h-3
                    w-24
                    animate-pulse
                    rounded
                    bg-white/10
                  "
                />
              </>
            ) : (
              <>
                <h2
                  title={title}
                  className="
                    line-clamp-2
                    text-sm
                    font-black
                    leading-6
                    text-white
                  "
                >
                  {title}
                </h2>


                {description ? (
                  <p
                    className="
                      mt-1
                      line-clamp-2
                      text-[11px]
                      font-semibold
                      leading-5
                      text-blue-100/75
                    "
                  >
                    {description}
                  </p>
                ) : (
                  <p
                    className="
                      mt-1
                      text-[11px]
                      font-semibold
                      leading-5
                      text-blue-100/70
                    "
                  >
                    اختر محوراً من أجزاء الوحدة للبدء
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}


function SidebarExercisesSection({
  onOpenBac,
  onOpenBacLike,
}) {
  return (
    <div
      className="
        mx-3
        mt-6

        min-[380px]:mx-4
        min-[380px]:mt-7
      "
    >
      <div
        className="
          mb-3
          flex
          items-center
          gap-2
          px-1
        "
      >
        <GraduationCap
          size={17}
          className="text-amber-300"
        />

        <h3
          className="
            text-sm
            font-black
            text-white
          "
        >
          التمارين والتدريب
        </h3>
      </div>


      <div className="space-y-2">
        <button
          type="button"
          onClick={onOpenBac}
          className="
            group
            flex
            min-h-[64px]
            w-full
            items-center
            gap-3
            rounded-2xl
            border
            border-amber-300/20
            bg-amber-300/10
            px-3
            py-3
            text-right
            transition
            duration-200

            hover:-translate-y-0.5
            hover:bg-amber-300/20

            active:scale-[0.98]
          "
        >
          <div
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-gradient-to-br
              from-amber-300
              to-orange-500
              text-white
              shadow-lg
            "
          >
            <GraduationCap
              size={20}
            />
          </div>


          <div className="min-w-0">
            <p
              className="
                truncate
                text-sm
                font-black
                text-white
              "
            >
              تمارين البكالوريا
            </p>

            <p
              className="
                mt-0.5
                line-clamp-2
                text-[11px]
                font-semibold
                leading-5
                text-blue-100/80
              "
            >
              تمارين رسمية من السنوات السابقة
            </p>
          </div>
        </button>


        <button
          type="button"
          onClick={
            onOpenBacLike
          }
          className="
            group
            flex
            min-h-[64px]
            w-full
            items-center
            gap-3
            rounded-2xl
            border
            border-emerald-300/20
            bg-emerald-300/10
            px-3
            py-3
            text-right
            transition
            duration-200

            hover:-translate-y-0.5
            hover:bg-emerald-300/20

            active:scale-[0.98]
          "
        >
          <div
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-gradient-to-br
              from-emerald-300
              to-teal-500
              text-white
              shadow-lg
            "
          >
            <BookOpenCheck
              size={20}
            />
          </div>


          <div className="min-w-0">
            <p
              className="
                truncate
                text-sm
                font-black
                text-white
              "
            >
              تمارين مشابهة للبكالوريا
            </p>

            <p
              className="
                mt-0.5
                line-clamp-2
                text-[11px]
                font-semibold
                leading-5
                text-blue-100/80
              "
            >
              تمارين تدريبية خاصة بهذا الفصل
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}


function SidebarLoading() {
  return (
    <div
      className="
        mx-3
        mt-7
        flex
        items-center
        justify-center
        gap-3
        rounded-2xl
        border
        border-white/10
        bg-white/5
        px-3
        py-5
        text-center

        min-[380px]:mx-5
        min-[380px]:mt-8
        min-[380px]:px-4
        min-[380px]:py-6
      "
    >
      <Loader2
        size={20}
        className="
          shrink-0
          animate-spin
          text-violet-200
        "
      />

      <span
        className="
          text-xs
          font-bold
          leading-6
          text-blue-100

          min-[380px]:text-sm
        "
      >
        جاري تحميل أجزاء الدرس...
      </span>
    </div>
  );
}


function SidebarError({
  message,
  onRetry,
}) {
  return (
    <div
      className="
        mx-3
        mt-7
        rounded-2xl
        border
        border-red-300/20
        bg-red-400/10
        p-3
        text-center

        min-[380px]:mx-5
        min-[380px]:mt-8
        min-[380px]:p-4
      "
    >
      <p
        className="
          text-xs
          font-bold
          leading-6
          text-red-100

          min-[380px]:text-sm
        "
      >
        {message}
      </p>


      <button
        type="button"
        onClick={onRetry}
        className="
          mt-3
          min-h-[40px]
          rounded-xl
          bg-white/10
          px-4
          py-2
          text-xs
          font-black
          text-white
          transition

          hover:bg-white/20

          active:scale-95
        "
      >
        إعادة المحاولة
      </button>
    </div>
  );
}


function CollapsedSidebar({
  chapterId,
  lessonParts,
  onOpenBac,
  onOpenBacLike,
  onOpenAllLessons,
}) {
  return (
    <div
      className="
        relative
        z-10
        flex
        min-h-0
        flex-1
        flex-col
        items-center
        gap-3
        overflow-x-hidden
        overflow-y-auto
        px-2
        py-5
      "
    >
      {lessonParts
        .slice(0, 7)
        .map((part) => (
          <div
            key={part.id}
            title={part.title}
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-2xl
              border
              border-white/10
              bg-white/10
              text-sm
              font-black
              text-white
            "
          >
            {part.order}
          </div>
        ))}


      <button
        type="button"
        onClick={onOpenBac}
        title="تمارين البكالوريا"
        disabled={!chapterId}
        className="
          mt-3
          flex
          h-12
          w-12
          shrink-0
          items-center
          justify-center
          rounded-2xl
          bg-gradient-to-br
          from-amber-300
          to-orange-500
          text-white
          shadow-lg
          transition

          hover:scale-105

          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        <GraduationCap
          size={21}
        />
      </button>


      <button
        type="button"
        onClick={
          onOpenBacLike
        }
        title="تمارين مشابهة للبكالوريا"
        disabled={!chapterId}
        className="
          flex
          h-12
          w-12
          shrink-0
          items-center
          justify-center
          rounded-2xl
          bg-gradient-to-br
          from-emerald-300
          to-teal-500
          text-white
          shadow-lg
          transition

          hover:scale-105

          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        <BookOpenCheck
          size={21}
        />
      </button>


      <button
        type="button"
        onClick={
          onOpenAllLessons
        }
        title="عرض كل الدروس"
        className="
          mt-auto
          flex
          h-11
          w-11
          shrink-0
          items-center
          justify-center
          rounded-2xl
          border
          border-white/10
          bg-white/10
          text-white
          transition

          hover:bg-white/20
        "
      >
        <LayoutGrid
          size={19}
        />
      </button>
    </div>
  );
}