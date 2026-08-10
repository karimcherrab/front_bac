// src/layouts/AppLayout.jsx

import {
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

export default function AppLayout({
  children,
}) {
  const {
    id_subjects,
    id_chapter,
  } = useParams();

  const [
    collapsed,
    setCollapsed,
  ] = useState(false);

  const [
    mobileSidebarOpen,
    setMobileSidebarOpen,
  ] = useState(false);

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
            aria-label="فتح قائمة الدرس"
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
            <h1
              className="
                truncate
                text-sm
                font-black
                text-slate-900

                sm:text-base
              "
            >
              الدرس التعليمي
            </h1>

            <p
              className="
                mt-0.5
                hidden
                truncate
                text-[11px]
                font-semibold
                text-slate-400

                min-[360px]:block

                sm:text-xs
              "
            >
              اختر المحور من القائمة الجانبية
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
