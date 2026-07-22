import { useCallback, useContext, useEffect, useState } from "react";
import { LayoutGrid, Loader2 } from "lucide-react";
import axios from "axios";

import Logo from "./Logo";
import {
  ChapterSelector,
  ProgressCard,
} from "./SidebarWidgets";
import LessonPartsList from "./LessonPartsList";
import { useNavigate } from "react-router-dom";
import {
  currentChapter,
  chapterProgress,
} from "../data/lessonData";

import { UserContext } from "../Utils/UserContext";

// const API_BASE_URL = "http://127.0.0.1:8000";
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function Sidebar({
  collapsed,
  setCollapsed,
  chapterId = 1,
}) {
  const { token } = useContext(UserContext);

  const [lessonParts, setLessonParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [partsError, setPartsError] = useState("");

  const getLessonParts = useCallback(async () => {
    try {
      setLoadingParts(true);
      setPartsError("");

      const response = await axios.get(
        `${API_BASE_URL}/api/course/axes/`,
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

      if (error?.response?.status === 401) {
        setPartsError("انتهت صلاحية تسجيل الدخول.");
      } else if (error?.code === "ERR_NETWORK") {
        setPartsError("تعذر الاتصال بالخادم.");
      } else {
        setPartsError("تعذر تحميل أجزاء الدرس.");
      }
    } finally {
      setLoadingParts(false);
    }
  }, [token]);

  useEffect(() => {
    getLessonParts();
  }, [getLessonParts]);



    const navigate = useNavigate();

  const openCours = () => {
    navigate(`/cour`);



  };
  return (
    <aside
      dir="rtl"
      className={[
        "relative flex h-screen shrink-0 flex-col",
        "overflow-hidden bg-gradient-to-b",
        "from-blue-600 via-blue-700 to-indigo-800",
        "text-white shadow-[8px_0_35px_-18px_rgba(15,23,42,0.65)]",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[78px]" : "w-[300px]",
      ].join(" ")}
    >
      {/* زخرفة خلفية */}
      <div className="pointer-events-none absolute -right-20 top-24 h-56 w-56 rounded-full bg-violet-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-20 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />

      {/* Logo */}
      <button
        type="button"
        onClick={() => setCollapsed((previous) => !previous)}
        className="relative z-10 w-full text-right"
        aria-label={
          collapsed ? "فتح القائمة الجانبية" : "تصغير القائمة الجانبية"
        }
      >
        <Logo collapsed={collapsed} />
      </button>

      {collapsed ? (
        <CollapsedSidebar
          chapterId={chapterId}
          lessonParts={lessonParts}
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
            <ChapterSelector chapter={currentChapter} />

            {/* <ProgressCard
              percent={chapterProgress.percent}
              message={chapterProgress.message}
            /> */}

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
                chapterId={chapterId}
              />
            )}
          </div>

          <div className="relative z-10 border-t border-white/10 bg-blue-900/20 p-4 backdrop-blur-xl">
            <button
              type="button"
                onClick={openCours}
              className={[
                "flex w-full items-center justify-center gap-2",
                "rounded-2xl border border-white/10",
                "bg-white/10 px-4 py-3.5",
                "text-sm font-black text-white",
                "transition duration-200",
                "hover:-translate-y-0.5 hover:bg-white/15",
                "hover:shadow-lg",
              ].join(" ")}
            >
              <LayoutGrid size={18}
              
              
              />
              عرض كل الدروس
            </button>
          </div>
        </>
      )}
    </aside>
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

function SidebarError({ message, onRetry }) {
  return (
    <div className="mx-5 mt-8 rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-center">
      <p className="text-sm font-bold leading-6 text-red-100">
        {message}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/20"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}

function CollapsedSidebar({
  chapterId,
  lessonParts,
}) {
  return (
    <div className="relative z-10 flex flex-1 flex-col items-center gap-3 overflow-y-auto px-2 py-5">
      {lessonParts.slice(0, 7).map((part) => (
        <div
          key={part.id}
          title={part.title}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sm font-black text-white"
        >
          {part.order}
        </div>
      ))}

      <a
        href={`/bac/chapter/${chapterId}`}
        title="تمارين البكالوريا"
        className="mt-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-lg shadow-lg"
      >
        🎓
      </a>
    </div>
  );
}