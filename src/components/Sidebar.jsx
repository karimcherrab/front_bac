// src/components/Sidebar.jsx

import {
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  BookOpenCheck,
  GraduationCap,
  LayoutGrid,
  Loader2,
  X,
} from "lucide-react";

import axios from "axios";

import {
  useNavigate,
} from "react-router-dom";

import Logo from "./Logo";

import {
  ChapterSelector,
} from "./SidebarWidgets";

import LessonPartsList from "./LessonPartsList";

import {
  currentChapter,
} from "../data/lessonData";

import {
  UserContext,
} from "../Utils/UserContext";

const API_BASE_URL =
  import.meta.env.VITE_BASE_URL
    ?.replace(/\/+$/, "");

export default function Sidebar({
  collapsed,
  setCollapsed,
  id_chapter,
  mobileOpen,
  onCloseMobile,
}) {
  const navigate =
    useNavigate();

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

  const branchCode =
    user?.branch?.code;

  const getLessonParts =
    useCallback(async () => {
      if (!id_chapter) {
        setLessonParts([]);

        setPartsError(
          "معرّف الفصل غير موجود.",
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
         * مهم:
         * عند دخول صفحة فصل جديد نمسح المحور القديم فورًا،
         * حتى لا يظهر محتوى الفصل/المحور السابق أثناء التحميل.
         */
        setCurrent_axis(null);
        setActiveId("intro");

        setLoadingParts(true);
        setPartsError("");

        const response =
          await axios.get(
            `${API_BASE_URL}/api/course/axes/${id_chapter}/branch/${branchCode}/`,
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

        const axes =
          Array.isArray(
            response?.data?.axes,
          )
            ? response.data.axes
            : Array.isArray(
                  response?.data,
                )
              ? response.data
              : [];

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
         * بعد تحميل المحاور وترتيبها:
         * نفتح المحور الأول تلقائيًا.
         *
         * بهذا عند:
         * محور 5 -> عرض كل الدروس -> اختيار الدرس مرة أخرى
         * سيتم فتح المحور 1 مباشرة بدل بقاء المحور 5.
         */
        if (orderedAxes.length > 0) {
          setCurrent_axis(
            orderedAxes[0],
          );
          setActiveId("intro");
        } else {
          setCurrent_axis(null);
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
            "لم يتم العثور على محاور هذا الفصل.",
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
      id_chapter,
      branchCode,
      setCurrent_axis,
      setActiveId,
    ]);

  useEffect(() => {
    getLessonParts();
  }, [getLessonParts]);

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
    /*
     * لا نترك المحور الحالي محفوظًا بعد الخروج.
     * هذا يمنع ظهور محتوى المحور السابق عند العودة.
     */
    setCurrent_axis(null);
    setActiveId("intro");

    closeMobileSidebar();

    navigate("/subjects");
  };

  const openBacExercises =
    () => {
      setActiveId("bac");

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
        window.innerWidth >= 1024
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
          /*
           * Mobile layout.
           */
          "fixed inset-y-0 right-0 z-50",
          "flex h-dvh min-h-dvh shrink-0 flex-col",
          "overflow-hidden",
          "bg-gradient-to-b",
          "from-blue-600 via-blue-700 to-indigo-800",
          "text-white",
          "shadow-[-12px_0_45px_rgba(15,23,42,0.35)]",
          "transition-transform duration-300 ease-out",

          /*
           * عرض متوافق مع الهواتف الصغيرة والكبيرة.
           */
          "w-[min(88vw,320px)]",
          "min-[430px]:w-[320px]",

          mobileOpen
            ? "translate-x-0"
            : "translate-x-full",

          /*
           * Desktop layout.
           *
           * مهم جدًا:
           * نثبت العرض + min-width + max-width.
           * بهذا طول عنوان المحور لن يستطيع تكبير أو تصغير الـ Sidebar.
           */
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

        {/* Mobile close button */}
        <button
          type="button"
          onClick={
            closeMobileSidebar
          }
          aria-label="إغلاق القائمة"
          className="
            absolute
            left-3
            top-3
            z-50
            flex
            h-10
            w-10
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
          <X size={20} />
        </button>

        {/* Logo */}
        <button
          type="button"
          onClick={
            toggleDesktopSidebar
          }
          className="
            relative
            z-10
            w-full
            shrink-0
            text-right
          "
          aria-label={
            collapsed
              ? "فتح القائمة الجانبية"
              : "تصغير القائمة الجانبية"
          }
        >
          <Logo
            collapsed={
              collapsed
            }
          />
        </button>

        {/* Desktop collapsed sidebar */}
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
                id_chapter
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

        {/* Full sidebar */}
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
            <ChapterSelector
              chapter={
                currentChapter
              }
            />

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
                  id_chapter
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