// src/components/dashboard/DashboardTopbar.jsx

import {
  Bell,
  ChevronDown,
  Mail,
  Menu,
  Search,
} from "lucide-react";

import {
  useContext,
} from "react";

import {
  UserContext,
} from "../../Utils/UserContext";

export default function DashboardTopbar({
  onOpenSidebar,
}) {
  const { user } = useContext(UserContext);

  const username =
    user?.username ||
    user?.first_name ||
    "الطالب";

  const firstLetter =
    username?.trim()?.charAt(0) || "ط";

  return (
    <header
      dir="rtl"
      className="
        relative z-30
        flex h-[72px]
        shrink-0 items-center
        justify-between gap-2
        border-b border-slate-100
        bg-white px-3

        sm:h-[80px]
        sm:gap-4
        sm:px-5

        lg:h-[96px]
        lg:gap-6
        lg:px-8

        xl:px-10
      "
    >
      {/* User and mobile menu */}
      <div
        className="
          flex min-w-0
          shrink-0 items-center
          gap-2 sm:gap-3
        "
      >
        {/* Mobile sidebar button */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="فتح القائمة الجانبية"
          className="
            flex h-10 w-10
            shrink-0 items-center
            justify-center rounded-xl
            border border-slate-200
            bg-white text-slate-600
            shadow-sm transition

            hover:border-violet-200
            hover:bg-violet-50
            hover:text-violet-600

            active:scale-95

            lg:hidden
          "
        >
          <Menu size={21} />
        </button>

        {/* Avatar */}
        <div
          className="
            flex h-10 w-10
            shrink-0 items-center
            justify-center rounded-full
            bg-gradient-to-br
            from-blue-100 to-violet-100
            text-base font-extrabold
            text-violet-700

            sm:h-12 sm:w-12
            sm:text-lg

            lg:h-14 lg:w-14
          "
        >
          {firstLetter}
        </div>

        {/* User information */}
        <div
          className="
            hidden min-w-0
            sm:block
          "
        >
          <h2
            className="
              max-w-[150px]
              truncate text-sm
              font-extrabold
              text-slate-900

              md:max-w-[180px]

              lg:max-w-[220px]
              lg:text-base

              xl:text-lg
            "
          >
            {username}
          </h2>

          <p
            className="
              mt-1 hidden
              text-xs text-slate-500
              lg:block
            "
          >
            مستعد لمواصلة التعلم اليوم؟
          </p>
        </div>

        <button
          type="button"
          aria-label="عرض قائمة المستخدم"
          className="
            hidden h-9 w-9
            shrink-0 items-center
            justify-center rounded-lg
            text-slate-600 transition

            hover:bg-slate-50
            hover:text-violet-600

            sm:flex
          "
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {/* Search desktop */}
      <div
        className="
          hidden min-w-0
          max-w-[600px]
          flex-1 md:block
        "
      >
        <div className="relative">
          <Search
            size={19}
            className="
              pointer-events-none
              absolute end-4
              top-1/2
              -translate-y-1/2
              text-slate-400

              lg:end-5
            "
          />

          <input
            type="search"
            placeholder="ابحث عن درس، تمرين، أو موضوع..."
            className="
              h-11 w-full
              rounded-xl border
              border-violet-100
              bg-white pe-12 ps-4
              text-sm text-slate-700
              shadow-sm outline-none
              transition

              placeholder:text-slate-400

              focus:border-violet-400
              focus:ring-4
              focus:ring-violet-50

              lg:h-13
              lg:rounded-2xl
              lg:pe-14
              lg:ps-5
            "
          />
        </div>
      </div>

      {/* Notifications */}
      <div
        className="
          flex shrink-0
          items-center gap-1
          sm:gap-2
        "
      >
        {/* Mobile search */}
        <button
          type="button"
          aria-label="البحث"
          className="
            flex h-10 w-10
            items-center justify-center
            rounded-xl text-slate-700
            transition

            hover:bg-slate-50
            hover:text-violet-600

            md:hidden
          "
        >
          <Search size={20} />
        </button>

        {/* Notifications */}
        <button
          type="button"
          aria-label="الإشعارات"
          className="
            relative flex
            h-10 w-10
            items-center justify-center
            rounded-xl text-slate-700
            transition

            hover:bg-slate-50
            hover:text-violet-600

            sm:h-11 sm:w-11
          "
        >
          <Bell size={21} />

          <span
            className="
              absolute end-0.5
              top-0.5 flex
              h-[18px] min-w-[18px]
              items-center justify-center
              rounded-full
              bg-pink-500 px-1
              text-[9px] font-bold
              leading-none text-white

              sm:end-1 sm:top-1
              sm:h-5 sm:min-w-5
              sm:text-[10px]
            "
          >
            3
          </span>
        </button>

        {/* Messages */}
        <button
          type="button"
          aria-label="الرسائل"
          className="
            hidden h-11 w-11
            items-center justify-center
            rounded-xl text-slate-700
            transition

            hover:bg-slate-50
            hover:text-violet-600

            sm:flex
          "
        >
          <Mail size={21} />
        </button>
      </div>
    </header>
  );
}