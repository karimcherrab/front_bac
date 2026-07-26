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
} from "lucide-react";

import axios from "axios";
import { useNavigate } from "react-router-dom";

import Logo from "./Logo";

import {
  ChapterSelector,
} from "./SidebarWidgets";

import LessonPartsList from "./LessonPartsList";

import {
  currentChapter,
} from "../data/lessonData";

import { UserContext } from "../Utils/UserContext";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function Sidebar({
  collapsed,
  setCollapsed,
  id_chapter,
}) {
  const navigate = useNavigate();

  const {
    token,
    user,
    setActiveId,
  } = useContext(UserContext);

  const [lessonParts, setLessonParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [partsError, setPartsError] = useState("");

  const branchCode = user?.branch?.code;

  const getLessonParts = useCallback(async () => {
    if (!id_chapter) {
      setLessonParts([]);
      setPartsError("معرّف الفصل غير موجود.");
      setLoadingParts(false);
      return;
    }

    if (!branchCode) {
      setLessonParts([]);
      setPartsError("لم يتم العثور على شعبة التلميذ.");
      setLoadingParts(false);
      return;
    }

    try {
      setLoadingParts(true);
      setPartsError("");

      const response = await axios.get(
        `${API_BASE_URL}/api/course/axes/${id_chapter}/branch/${branchCode}/`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      const axes = Array.isArray(response?.data?.axes)
        ? response.data.axes
        : Array.isArray(response?.data)
          ? response.data
          : [];

      const orderedAxes = [...axes].sort(
        (firstAxis, secondAxis) =>
          Number(firstAxis?.order ?? 0) -
          Number(secondAxis?.order ?? 0)
      );

      setLessonParts(orderedAxes);
    } catch (error) {
      console.error("GET AXES ERROR:", error);

      setLessonParts([]);

      if (error?.response?.status === 401) {
        setPartsError("انتهت صلاحية تسجيل الدخول.");
      } else if (error?.response?.status === 403) {
        setPartsError("ليس لديك صلاحية لعرض هذه الدروس.");
      } else if (error?.response?.status === 404) {
        setPartsError("لم يتم العثور على محاور هذا الفصل.");
      } else if (error?.code === "ERR_NETWORK") {
        setPartsError("تعذر الاتصال بالخادم.");
      } else {
        setPartsError("تعذر تحميل أجزاء الدرس.");
      }
    } finally {
      setLoadingParts(false);
    }
  }, [
    token,
    id_chapter,
    branchCode,
  ]);

  useEffect(() => {
    getLessonParts();
  }, [getLessonParts]);

  const openAllLessons = () => {
    navigate(`/subjects`);
  };

  const openBacExercises = () => {
    setActiveId("bac")
    // navigate(`/bac/chapter/${id_chapter}`);
  };

  const openBacLikeExercises = () => {
    setActiveId("generete-bac")

    // navigate(`/bac-like/chapter/${id_chapter}`);
  };

  return (
    <aside
      dir="rtl"
      className={[
        "relative flex h-screen shrink-0 flex-col",
        "overflow-hidden bg-gradient-to-b",
        "from-blue-600 via-blue-700 to-indigo-800",
        "text-white",
        "shadow-[8px_0_35px_-18px_rgba(15,23,42,0.65)]",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[78px]" : "w-[300px]",
      ].join(" ")}
    >
      {/* زخرفة الخلفية */}
      <div className="pointer-events-none absolute -right-20 top-24 h-56 w-56 rounded-full bg-violet-400/10 blur-3xl" />

      <div className="pointer-events-none absolute -left-24 bottom-20 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />

      {/* الشعار وزر تصغير القائمة */}
      <button
        type="button"
        onClick={() =>
          setCollapsed((previous) => !previous)
        }
        className="relative z-10 w-full text-right"
        aria-label={
          collapsed
            ? "فتح القائمة الجانبية"
            : "تصغير القائمة الجانبية"
        }
      >
        <Logo collapsed={collapsed} />
      </button>

      {collapsed ? (
        <CollapsedSidebar
          chapterId={id_chapter}
          lessonParts={lessonParts}
          onOpenBac={openBacExercises}
          onOpenBacLike={openBacLikeExercises}
          onOpenAllLessons={openAllLessons}
        />
      ) : (
        <>
          <div
            className={[
              "relative z-10 flex-1 overflow-y-auto pb-6",
              "[scrollbar-width:thin]",
              "[scrollbar-color:rgba(255,255,255,0.30)_transparent]",
              "[&::-webkit-scrollbar]:w-[9px]",
              "[&::-webkit-scrollbar-track]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:rounded-full",
              "[&::-webkit-scrollbar-thumb]:bg-white/20",
              "hover:[&::-webkit-scrollbar-thumb]:bg-white/35",
              "[&::-webkit-scrollbar-thumb]:border-2",
              "[&::-webkit-scrollbar-thumb]:border-transparent",
              "[&::-webkit-scrollbar-thumb]:bg-clip-padding",
            ].join(" ")}
          >
            <ChapterSelector
              chapter={currentChapter}
            />

            {loadingParts ? (
              <SidebarLoading />
            ) : partsError ? (
              <SidebarError
                message={partsError}
                onRetry={getLessonParts}
              />
            ) : (
              <LessonPartsList
                parts={lessonParts}
                chapterId={id_chapter}
              />
            )}

            {/* قسم التمارين */}
            <SidebarExercisesSection
              onOpenBac={openBacExercises}
              onOpenBacLike={openBacLikeExercises}
            />
          </div>

          {/* أزرار أسفل Sidebar */}
          <div className="relative z-10 space-y-2 border-t border-white/10 bg-blue-900/20 p-4 backdrop-blur-xl">
            {/* <button
              type="button"
              onClick={openBacLikeExercises}
              className={[
                "flex w-full items-center justify-center gap-2",
                "rounded-2xl border border-emerald-300/20",
                "bg-emerald-400/15 px-4 py-3.5",
                "text-sm font-black text-white",
                "transition duration-200",
                "hover:-translate-y-0.5",
                "hover:bg-emerald-400/25",
                "hover:shadow-lg",
              ].join(" ")}
            >
              <BookOpenCheck size={18} />

              تمارين مشابهة للبكالوريا
            </button> */}

            <button
              type="button"
              onClick={openAllLessons}
              className={[
                "flex w-full items-center justify-center gap-2",
                "rounded-2xl border border-white/10",
                "bg-white/10 px-4 py-3.5",
                "text-sm font-black text-white",
                "transition duration-200",
                "hover:-translate-y-0.5",
                "hover:bg-white/15",
                "hover:shadow-lg",
              ].join(" ")}
            >
              <LayoutGrid size={18} />

              عرض كل الدروس
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

function SidebarExercisesSection({
  onOpenBac,
  onOpenBacLike,
}) {
  return (
    <div className="mx-4 mt-7">
      <div className="mb-3 flex items-center gap-2 px-1">
        <GraduationCap
          size={17}
          className="text-amber-300"
        />

        <h3 className="text-sm font-black text-white">
          التمارين والتدريب
        </h3>
      </div>

      <div className="space-y-2">
        {/* تمارين البكالوريا الحقيقية */}
        <button
          type="button"
          onClick={onOpenBac}
          className={[
            "group flex w-full items-center gap-3",
            "rounded-2xl border border-amber-300/20",
            "bg-amber-300/10 px-3 py-3",
            "text-right transition duration-200",
            "hover:-translate-y-0.5",
            "hover:bg-amber-300/20",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-10 w-10 shrink-0",
              "items-center justify-center rounded-xl",
              "bg-gradient-to-br",
              "from-amber-300 to-orange-500",
              "text-white shadow-lg",
            ].join(" ")}
          >
            <GraduationCap size={20} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">
              تمارين البكالوريا
            </p>

            <p className="mt-0.5 text-[11px] font-semibold text-blue-100/80">
              تمارين رسمية من السنوات السابقة
            </p>
          </div>
        </button>

        {/* تمارين مشابهة للبكالوريا */}
        <button
          type="button"
          onClick={onOpenBacLike}
          className={[
            "group flex w-full items-center gap-3",
            "rounded-2xl border border-emerald-300/20",
            "bg-emerald-300/10 px-3 py-3",
            "text-right transition duration-200",
            "hover:-translate-y-0.5",
            "hover:bg-emerald-300/20",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-10 w-10 shrink-0",
              "items-center justify-center rounded-xl",
              "bg-gradient-to-br",
              "from-emerald-300 to-teal-500",
              "text-white shadow-lg",
            ].join(" ")}
          >
            <BookOpenCheck size={20} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">
              تمارين مشابهة للبكالوريا
            </p>

            <p className="mt-0.5 text-[11px] font-semibold text-blue-100/80">
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
    <div className="mx-5 mt-8 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-6">
      <Loader2
        size={20}
        className="animate-spin text-violet-200"
      />

      <span className="text-sm font-bold text-blue-100">
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
    <div className="mx-5 mt-8 rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-center">
      <p className="text-sm font-bold leading-6 text-red-100">
        {message}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:bg-white/20"
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
    <div className="relative z-10 flex flex-1 flex-col items-center gap-3 overflow-y-auto px-2 py-5">
      {lessonParts
        .slice(0, 7)
        .map((part) => (
          <div
            key={part.id}
            title={part.title}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sm font-black text-white"
          >
            {part.order}
          </div>
        ))}

      {/* تمارين البكالوريا */}
      <button
        type="button"
        onClick={onOpenBac}
        title="تمارين البكالوريا"
        disabled={!chapterId}
        className={[
          "mt-3 flex h-12 w-12",
          "items-center justify-center",
          "rounded-2xl",
          "bg-gradient-to-br",
          "from-amber-300 to-orange-500",
          "text-white shadow-lg",
          "transition hover:scale-105",
          "disabled:cursor-not-allowed",
          "disabled:opacity-50",
        ].join(" ")}
      >
        <GraduationCap size={21} />
      </button>

      {/* تمارين مشابهة للبكالوريا */}
      <button
        type="button"
        onClick={onOpenBacLike}
        title="تمارين مشابهة للبكالوريا"
        disabled={!chapterId}
        className={[
          "flex h-12 w-12",
          "items-center justify-center",
          "rounded-2xl",
          "bg-gradient-to-br",
          "from-emerald-300 to-teal-500",
          "text-white shadow-lg",
          "transition hover:scale-105",
          "disabled:cursor-not-allowed",
          "disabled:opacity-50",
        ].join(" ")}
      >
        <BookOpenCheck size={21} />
      </button>

      {/* كل الدروس */}
      <button
        type="button"
        onClick={onOpenAllLessons}
        title="عرض كل الدروس"
        className="mt-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition hover:bg-white/20"
      >
        <LayoutGrid size={19} />
      </button>
    </div>
  );
}