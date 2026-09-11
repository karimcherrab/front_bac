// src/layouts/AppLayout.jsx

import {
  useContext,
  useEffect,
  useState,
} from "react";

import {
  Menu,
} from "lucide-react";

import {
  useParams,
} from "react-router-dom";

import Sidebar from "../components/Sidebar";

import {
  UserContext,
} from "../Utils/UserContext";

export default function AppLayout({
  children,
}) {
  const {
    id_subjects,
    id_chapter,
  } = useParams();

  const {
    current_axis,
  } =
    useContext(UserContext) ||
    {};

  const [
    collapsed,
    setCollapsed,
  ] = useState(false);

  const [
    mobileSidebarOpen,
    setMobileSidebarOpen,
  ] = useState(false);

  /*
   * لا نعرض رقم الفصل كعنوان.
   * العنوان الحقيقي يصل من Sidebar بعد قراءة الـ API.
   */
  const [
    currentUnit,
    setCurrentUnit,
  ] = useState({
    id: id_chapter,
    title: "الوحدة الحالية",
    description: "",
  });

  useEffect(() => {
    setCurrentUnit({
      id: id_chapter,
      title: "الوحدة الحالية",
      description: "",
    });
  }, [id_chapter]);

  /*
   * إغلاق القائمة على الهاتف باستعمال Escape.
   */
  useEffect(() => {
    const handleEscape = (
      event,
    ) => {
      if (
        event.key === "Escape"
      ) {
        setMobileSidebarOpen(
          false,
        );
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, []);

  /*
   * منع تحريك الصفحة الخلفية عندما
   * تكون القائمة مفتوحة على الهاتف.
   */
  useEffect(() => {
    if (
      mobileSidebarOpen
    ) {
      document.body.style.overflow =
        "hidden";
    } else {
      document.body.style.overflow =
        "";
    }

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [
    mobileSidebarOpen,
  ]);

  /*
   * عند الانتقال إلى شاشة الحاسوب،
   * نغلق حالة القائمة الخاصة بالهاتف.
   */
  useEffect(() => {
    const handleResize = () => {
      if (
        window.innerWidth >= 1024
      ) {
        setMobileSidebarOpen(
          false,
        );
      }
    };

    window.addEventListener(
      "resize",
      handleResize,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize,
      );
    };
  }, []);

  const axisTitle =
    current_axis?.title ||
    current_axis?.name ||
    current_axis?.axis_title ||
    "";

  return (
    <div
      dir="rtl"
      className="
        flex
        h-dvh
        min-h-dvh
        w-full
        overflow-hidden
        bg-slate-50
      "
    >
      <Sidebar
        collapsed={collapsed}
        setCollapsed={
          setCollapsed
        }
        id_subjects={
          id_subjects
        }
        id_chapter={
          id_chapter
        }
        mobileOpen={
          mobileSidebarOpen
        }
        onCloseMobile={() =>
          setMobileSidebarOpen(
            false,
          )
        }
        onUnitChange={
          setCurrentUnit
        }
      />

      <div
        className="
          flex
          min-h-0
          min-w-0
          flex-1
          flex-col
          overflow-hidden
        "
      >
        {/* Mobile header */}
        <header
          className="
            relative
            z-30
            flex
            h-[60px]
            shrink-0
            items-center
            justify-between
            border-b
            border-slate-200
            bg-white
            px-3
            shadow-sm

            min-[380px]:h-[64px]
            min-[380px]:px-4

            sm:h-[70px]
            sm:px-5

            lg:hidden
          "
        >
          <button
            type="button"
            onClick={() =>
              setMobileSidebarOpen(
                true,
              )
            }
            aria-label="فتح قائمة الوحدة"
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              border
              border-slate-200
              bg-white
              text-slate-600
              shadow-sm
              transition

              hover:border-blue-200
              hover:bg-blue-50
              hover:text-blue-600

              active:scale-95
            "
          >
            <Menu size={21} />
          </button>

          <div
            className="
              min-w-0
              flex-1
              px-2
              text-center

              min-[380px]:px-3
            "
          >
            <p
              className="
                text-[10px]
                font-black
                text-blue-500
              "
            >
              الوحدة الحالية
            </p>

            <h1
              title={
                currentUnit?.title
              }
              className="
                mt-0.5
                truncate
                text-sm
                font-black
                text-slate-900

                sm:text-base
              "
            >
              {currentUnit?.title ||
                "الوحدة الحالية"}
            </h1>

            <p
              title={axisTitle}
              className="
                mt-0.5
                hidden
                truncate
                text-[11px]
                font-semibold
                text-slate-400

                min-[390px]:block

                sm:text-xs
              "
            >
              {axisTitle ||
                "اختر المحور من القائمة الجانبية"}
            </p>
          </div>

          <div
            aria-hidden="true"
            className="
              h-10
              w-10
              shrink-0
            "
          />
        </header>

        <div
          className="
            min-h-0
            min-w-0
            flex-1
            overflow-hidden
          "
        >
          {children}
        </div>
      </div>
    </div>
  );
}
