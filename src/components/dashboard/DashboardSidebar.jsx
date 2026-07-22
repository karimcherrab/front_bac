// src/components/dashboard/DashboardSidebar.jsx

import {
  Home,
  BookOpen,
  Network,
  GraduationCap,
  PenLine,
  ClipboardList,
  Bookmark,
  Bot,
  Settings,
  LogOut,
  Crown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
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
    label: "المحاور",
    icon: Network,
    path: "/axes",
  },
  {
    label: "دروسي",
    icon: GraduationCap,
    path: "/my-lessons",
  },
  {
    label: "التمارين",
    icon: PenLine,
    path: "/exercises",
  },
  {
    label: "الامتحانات",
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
}) {
  const navigate = useNavigate();

  const logout = () => {
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <aside
      dir="rtl"
      className={`
        relative z-30 flex h-screen shrink-0 flex-col
        border-e border-slate-100 bg-white
        transition-all duration-300
        ${collapsed ? "w-[86px]" : "w-[230px]"}
      `}
    >
      {/* Logo */}
      <div className="flex h-[100px] items-center justify-between px-5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 text-2xl font-black text-white shadow-lg shadow-violet-200">
            M
          </div>

          {!collapsed && (
            <div className="whitespace-nowrap">
              <h1 className="text-xl font-extrabold text-slate-900">
                MathMaster
              </h1>

              <p className="mt-0.5 text-[11px] text-slate-500">
                تعلم بذكاء، تفوق بثقة
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse button */}
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="
          absolute -end-3 top-[110px] z-40
          flex h-7 w-7 items-center justify-center
          rounded-full border border-slate-200
          bg-white text-slate-500 shadow-sm
          transition hover:text-violet-600
        "
      >
        {collapsed ? (
          <PanelLeftOpen size={15} />
        ) : (
          <PanelLeftClose size={15} />
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `
                flex h-12 items-center rounded-xl
                text-sm font-bold transition-all duration-200
                ${
                  collapsed
                    ? "justify-center px-0"
                    : "gap-3 px-4"
                }
                ${
                  isActive
                    ? "bg-gradient-to-l from-violet-600 to-violet-500 text-white shadow-md shadow-violet-200"
                    : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                }
              `}
            >
              <Icon size={20} />

              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Premium */}
      {/* {!collapsed && (
        <div className="mx-4 mb-5 rounded-2xl bg-gradient-to-br from-[#20105f] to-[#4f26b9] p-4 text-center text-white shadow-xl shadow-violet-100">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-amber-300">
            <Crown size={23} fill="currentColor" />
          </div>

          <h3 className="text-sm font-extrabold">
            النسخة المميزة
          </h3>

          <p className="mt-2 text-xs leading-5 text-violet-100">
            تجربة تعليمية متكاملة بدون حدود
          </p>

          <button
            type="button"
            className="
              mt-3 w-full rounded-xl
              bg-gradient-to-l from-violet-500 to-purple-500
              py-2.5 text-xs font-bold
              transition hover:brightness-110
            "
          >
            ترقية الآن
          </button>
        </div>
      )} */}

      {/* Bottom actions */}
      <div className="space-y-1 border-t border-slate-100 p-3">
        <NavLink
          to="/settings"
          className={`
            flex h-11 items-center rounded-xl
            text-sm font-semibold text-slate-600
            transition hover:bg-slate-50
            ${collapsed ? "justify-center" : "gap-3 px-4"}
          `}
        >
          <Settings size={19} />

          {!collapsed && <span>الإعدادات</span>}
        </NavLink>

        <button
          type="button"
          onClick={logout}
          className={`
            flex h-11 w-full items-center rounded-xl
            text-sm font-semibold text-slate-600
            transition hover:bg-red-50 hover:text-red-500
            ${collapsed ? "justify-center" : "gap-3 px-4"}
          `}
        >
          <LogOut size={19} />

          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  );
}