// src/components/dashboard/DashboardSidebar.jsx

import {
  BookOpen,
  Bookmark,
  Bot,
  ClipboardList,
  Home,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
} from "lucide-react";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import Cookies from "js-cookie";

const navigationItems = [
  {
    label: "الرئيسية",
    icon: Home,
    path: "/",
  },
  {
    label: "المواد",
    icon: BookOpen,
    path: "/subjects",
  },
  {
    label: "البكالوريا التجريبية",
    icon: ClipboardList,
    path: "/exams",
  },
  {
    label: "الملاحظات",
    icon: Bookmark,
    path: "/notes",
  },
  {
    label: "المساعد الذكي",
    icon: Bot,
    path: "/assistant",
  },
];

export default function DashboardSidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  onCloseMobile,
}) {
  const navigate = useNavigate();

  const logout = () => {
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");

    onCloseMobile?.();

    navigate("/login", {
      replace: true,
    });
  };

  const handleNavigation = () => {
    onCloseMobile?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      <button
        type="button"
        aria-label="إغلاق القائمة الجانبية"
        onClick={onCloseMobile}
        className={`
          fixed inset-0
          z-40 bg-slate-950/40
          backdrop-blur-[2px]
          transition-opacity
          duration-300

          lg:hidden

          ${
            mobileOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }
        `}
      />

      {/* Sidebar */}
      <aside
        dir="rtl"
        className={`
          fixed inset-y-0
          right-0 z-50
          flex h-dvh
          w-[min(86vw,320px)]
          shrink-0 flex-col
          overflow-hidden
          border-l border-slate-100
          bg-white
          shadow-[-12px_0_40px_rgba(15,23,42,0.14)]
          transition-transform
          duration-300 ease-out

          lg:relative
          lg:inset-auto
          lg:z-30
          lg:h-dvh
          lg:translate-x-0
          lg:shadow-[-4px_0_30px_rgba(15,23,42,0.03)]
          lg:transition-[width]
          lg:duration-300

          ${
            mobileOpen
              ? "translate-x-0"
              : "translate-x-full"
          }

          ${
            collapsed
              ? "lg:w-[92px]"
              : "lg:w-[270px]"
          }
        `}
      >
        {/* Logo */}
        <div
          className={`
            flex h-[88px]
            shrink-0 items-center
            border-b border-slate-50
            px-4

            sm:h-[96px]

            lg:h-[112px]

            ${
              collapsed
                ? "lg:justify-center lg:px-3"
                : "lg:justify-start lg:px-6"
            }
          `}
        >
          <div
            className="
              flex min-w-0
              flex-1 items-center
              gap-3 overflow-hidden
              lg:gap-4
            "
          >
            <div
              className="
                flex h-12 w-12
                shrink-0 items-center
                justify-center rounded-2xl
                bg-gradient-to-br
                from-violet-500
                to-blue-600
                text-xl font-black
                text-white
                shadow-lg
                shadow-violet-200

                lg:h-14 lg:w-14
                lg:text-2xl
              "
            >
              M
            </div>

            <div
              className={`
                min-w-0
                whitespace-nowrap

                ${
                  collapsed
                    ? "lg:hidden"
                    : ""
                }
              `}
            >
              <h1
                className="
                  truncate text-xl
                  font-black
                  tracking-tight
                  text-slate-900

                  lg:text-[22px]
                "
              >
                MathMaster
              </h1>

              <p
                className="
                  mt-1 truncate
                  text-xs font-medium
                  text-slate-500
                "
              >
                تعلم بذكاء، تفوق بثقة
              </p>
            </div>
          </div>

          {/* Mobile close */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="إغلاق القائمة"
            className="
              flex h-10 w-10
              shrink-0 items-center
              justify-center rounded-xl
              border border-slate-200
              bg-white text-slate-500
              transition

              hover:border-red-200
              hover:bg-red-50
              hover:text-red-500

              lg:hidden
            "
          >
            <X size={20} />
          </button>
        </div>

        {/* Desktop collapse button */}
        <button
          type="button"
          onClick={() =>
            setCollapsed(
              (current) => !current
            )
          }
          aria-label={
            collapsed
              ? "توسيع القائمة"
              : "تصغير القائمة"
          }
          className="
            absolute -left-3.5
            top-[123px] z-40
            hidden h-8 w-8
            items-center justify-center
            rounded-full
            border border-slate-200
            bg-white text-slate-500
            shadow-md
            transition duration-200

            hover:border-violet-200
            hover:bg-violet-50
            hover:text-violet-600

            lg:flex
          "
        >
          {collapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
        </button>

        {/* Navigation */}
        <nav
          className="
            min-h-0 flex-1
            space-y-2
            overflow-y-auto
            overscroll-contain
            px-3 py-4

            sm:px-4 sm:py-5

            lg:space-y-3
          "
        >
          {navigationItems.map(
            (item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  onClick={
                    handleNavigation
                  }
                  title={
                    collapsed
                      ? item.label
                      : undefined
                  }
                  className={({
                    isActive,
                  }) => `
                    group flex
                    h-[52px] w-full
                    items-center
                    rounded-xl
                    text-[15px]
                    font-bold
                    transition-all
                    duration-200

                    sm:h-[56px]
                    sm:rounded-2xl
                    sm:text-[16px]

                    ${
                      collapsed
                        ? `
                          gap-4 px-4
                          lg:justify-center
                          lg:gap-0
                          lg:px-0
                        `
                        : `
                          gap-4 px-4
                          lg:px-5
                        `
                    }

                    ${
                      isActive
                        ? `
                          bg-gradient-to-l
                          from-violet-600
                          to-violet-500
                          text-white
                          shadow-lg
                          shadow-violet-200/70
                        `
                        : `
                          text-slate-600

                          hover:bg-violet-50
                          hover:text-violet-700

                          lg:hover:-translate-x-0.5
                        `
                    }
                  `}
                >
                  <Icon
                    size={22}
                    strokeWidth={2}
                    className="shrink-0"
                  />

                  <span
                    className={`
                      min-w-0
                      truncate
                      whitespace-nowrap

                      ${
                        collapsed
                          ? "lg:hidden"
                          : ""
                      }
                    `}
                  >
                    {item.label}
                  </span>
                </NavLink>
              );
            }
          )}
        </nav>

        {/* Bottom actions */}
        <div
          className="
            shrink-0 space-y-2
            border-t border-slate-100
            bg-white px-3 py-4

            sm:px-4 sm:py-5
          "
        >
          <NavLink
            to="/settings"
            onClick={handleNavigation}
            title={
              collapsed
                ? "الإعدادات"
                : undefined
            }
            className={({
              isActive,
            }) => `
              flex h-[52px]
              w-full items-center
              rounded-xl
              text-[15px]
              font-bold
              transition-all
              duration-200

              sm:h-[54px]
              sm:rounded-2xl

              ${
                collapsed
                  ? `
                    gap-4 px-4
                    lg:justify-center
                    lg:gap-0
                    lg:px-0
                  `
                  : `
                    gap-4 px-4
                    lg:px-5
                  `
              }

              ${
                isActive
                  ? `
                    bg-violet-50
                    text-violet-700
                  `
                  : `
                    text-slate-600

                    hover:bg-violet-50
                    hover:text-violet-700
                  `
              }
            `}
          >
            <Settings
              size={22}
              strokeWidth={2}
              className="shrink-0"
            />

            <span
              className={`
                whitespace-nowrap

                ${
                  collapsed
                    ? "lg:hidden"
                    : ""
                }
              `}
            >
              الإعدادات
            </span>
          </NavLink>

          <button
            type="button"
            onClick={logout}
            title={
              collapsed
                ? "تسجيل الخروج"
                : undefined
            }
            className={`
              flex h-[52px]
              w-full items-center
              rounded-xl
              text-[15px]
              font-bold text-slate-600
              transition-all
              duration-200

              hover:bg-red-50
              hover:text-red-500

              sm:h-[54px]
              sm:rounded-2xl

              ${
                collapsed
                  ? `
                    gap-4 px-4
                    lg:justify-center
                    lg:gap-0
                    lg:px-0
                  `
                  : `
                    gap-4 px-4
                    lg:px-5
                  `
              }
            `}
          >
            <LogOut
              size={22}
              strokeWidth={2}
              className="shrink-0"
            />

            <span
              className={`
                whitespace-nowrap

                ${
                  collapsed
                    ? "lg:hidden"
                    : ""
                }
              `}
            >
              تسجيل الخروج
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}