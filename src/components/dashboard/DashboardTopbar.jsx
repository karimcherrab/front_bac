// src/components/dashboard/DashboardTopbar.jsx

import {
  Search,
  Bell,
  Mail,
  ChevronDown,
  Menu,
} from "lucide-react";

export default function DashboardTopbar({
  onOpenSidebar,
}) {
  return (
    <header
      dir="rtl"
      className="
        flex min-h-[100px] items-center justify-between gap-5
        border-b border-slate-100 bg-white px-5
        lg:px-10
      "
    >
      {/* User */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="
            flex h-10 w-10 items-center justify-center
            rounded-xl border border-slate-200
            text-slate-600 lg:hidden
          "
        >
          <Menu size={21} />
        </button>

        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-violet-100 text-lg font-extrabold text-violet-700">
          أ
        </div>

        <div className="hidden sm:block">
          <h2 className="text-lg font-extrabold text-slate-900">
            مرحباً أحمد
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            مستعد لمواصلة التعلم اليوم؟
          </p>
        </div>

        <ChevronDown
          size={18}
          className="text-slate-700"
        />
      </div>

      {/* Search */}
      <div className="hidden max-w-[600px] flex-1 md:block">
        <div className="relative">
          <Search
            size={20}
            className="
              absolute end-5 top-1/2
              -translate-y-1/2 text-slate-400
            "
          />

          <input
            type="text"
            placeholder="ابحث عن درس، تمرين، أو موضوع..."
            className="
              h-14 w-full rounded-2xl
              border border-violet-100 bg-white
              pe-14 ps-5 text-sm text-slate-700
              shadow-sm outline-none
              transition
              placeholder:text-slate-400
              focus:border-violet-400
              focus:ring-4 focus:ring-violet-50
            "
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="
            relative flex h-11 w-11 items-center justify-center
            rounded-xl text-slate-700
            transition hover:bg-slate-50
          "
        >
          <Bell size={21} />

          <span className="
            absolute end-1 top-1
            flex h-5 min-w-5 items-center justify-center
            rounded-full bg-pink-500 px-1
            text-[10px] font-bold text-white
          ">
            3
          </span>
        </button>

        <button
          type="button"
          className="
            flex h-11 w-11 items-center justify-center
            rounded-xl text-slate-700
            transition hover:bg-slate-50
          "
        >
          <Mail size={21} />
        </button>
      </div>
    </header>
  );
}