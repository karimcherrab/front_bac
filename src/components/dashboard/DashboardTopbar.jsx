// src/components/dashboard/DashboardTopbar.jsx

import {
  Bell,
  ChevronDown,
  Menu,
  Moon,
  Search,
  X,
} from "lucide-react";

import {
  useContext,
  useEffect,
  useState,
} from "react";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import Cookies from "js-cookie";

import {
  UserContext,
} from "../../Utils/UserContext";


const navigationItems = [
  {
    label: "الرئيسية",
    path: "/home",
  },
  // {
  //   label: "الدروس",
  //   path: "/subjects",
  // },
  {
    label: "بكالوريا تجيريبية",
    path: "/bac",
  },
  {
    label: "المساعد الذكي",
    path: "/tutor",
  },
  {
    label: "المواد",
    path: "/subjects",
  },
];


export default function DashboardTopbar() {
  const {
    user,
  } = useContext(UserContext);

  const navigate =
    useNavigate();

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const username =
    user?.username ||
    user?.first_name ||
    "الطالب";

  const firstLetter =
    username
      ?.trim()
      ?.charAt(0)
      ?.toUpperCase() ||
    "ط";


  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const handleEscape = (
      event,
    ) => {
      if (
        event.key === "Escape"
      ) {
        setMobileOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape,
      );

      document.body.style.overflow =
        "";
    };
  }, [
    mobileOpen,
  ]);


  function logout() {
    Cookies.remove(
      "access_token",
    );

    Cookies.remove(
      "refresh_token",
    );

    navigate(
      "/login",
      {
        replace: true,
      },
    );
  }


  return (
    <>
      <header
        dir="rtl"
        className="
          sticky
          top-0
          z-40

          h-[88px]

          shrink-0

          border-b
          border-slate-100

          bg-white/95

          backdrop-blur-xl

          sm:h-[94px]

          lg:h-[104px]
        "
      >
        <div
          className="
            mx-auto

            flex

            h-full
            w-full

            max-w-[1720px]

            items-center
            justify-between

            gap-5

            px-4

            sm:px-7

            lg:px-10

            2xl:px-12
          "
        >

          {/* =================================================
              LOGO
          ================================================= */}

          <button
            type="button"
            onClick={() =>
              navigate("/home")
            }
            className="
              group

              flex
              shrink-0

              items-center

              gap-3.5

              transition
            "
          >
            <div
              className="
                flex

                h-[54px]
                w-[54px]

                items-center
                justify-center

                rounded-[18px]

                bg-gradient-to-br
                from-violet-600
                to-blue-600

                text-[21px]
                font-black
                text-white

                shadow-[0_10px_28px_rgba(99,102,241,0.22)]

                transition-transform
                duration-200

                group-hover:-translate-y-0.5

                sm:h-[58px]
                sm:w-[58px]

                lg:h-[62px]
                lg:w-[62px]
                lg:text-[24px]
              "
            >
              M
            </div>

            <div
              className="
                hidden
                text-right

                sm:block
              "
            >
              <h1
                className="
                  text-[20px]
                  font-black

                  tracking-tight

                  text-slate-950

                  lg:text-[23px]
                "
              >
                MathMaster
              </h1>

              <p
                className="
                  mt-1

                  text-[10px]
                  font-medium

                  text-slate-400

                  lg:text-[11px]
                "
              >
                منصة التعلم الذكي
              </p>
            </div>
          </button>


          {/* =================================================
              NAVIGATION DESKTOP
          ================================================= */}

          <nav
            className="
              hidden

              h-full

              items-center

              gap-1

              lg:flex

              xl:gap-2
            "
          >
            {navigationItems.map(
              (item) => (
                <NavLink
                  key={
                    `${item.label}-${item.path}`
                  }
                  to={item.path}
                  end={
                    item.path ===
                    "/home"
                  }
                  className={({
                    isActive,
                  }) => `
                    relative

                    flex

                    h-full

                    items-center
                    justify-center

                    rounded-xl

                    px-4

                    text-[14px]
                    font-extrabold

                    transition-colors
                    duration-200

                    xl:px-5
                    xl:text-[15px]

                    ${
                      isActive
                        ? "text-violet-600"
                        : "text-slate-600 hover:text-violet-600"
                    }
                  `}
                >
                  {({
                    isActive,
                  }) => (
                    <>
                      {
                        item.label
                      }

                      {isActive && (
                        <span
                          className="
                            absolute

                            bottom-[14px]

                            left-1/2

                            h-[3px]
                            w-9

                            -translate-x-1/2

                            rounded-full

                            bg-gradient-to-l
                            from-violet-600
                            to-blue-600
                          "
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ),
            )}
          </nav>


          {/* =================================================
              ACTIONS
          ================================================= */}

          <div
            className="
              flex

              shrink-0

              items-center

              gap-1.5

              sm:gap-2
            "
          >

            {/* Search */}

            <button
              type="button"
              aria-label="البحث"
              className="
                hidden

                h-11
                w-11

                items-center
                justify-center

                rounded-[14px]

                text-slate-500

                transition-all
                duration-200

                hover:bg-violet-50
                hover:text-violet-600

                sm:flex

                lg:h-12
                lg:w-12
              "
            >
              <Search
                size={21}
              />
            </button>


            {/* Notification */}

            <button
              type="button"
              aria-label="الإشعارات"
              className="
                relative

                hidden

                h-11
                w-11

                items-center
                justify-center

                rounded-[14px]

                text-slate-500

                transition-all
                duration-200

                hover:bg-violet-50
                hover:text-violet-600

                sm:flex

                lg:h-12
                lg:w-12
              "
            >
              <Bell
                size={21}
              />

              <span
                className="
                  absolute

                  end-0
                  top-0

                  flex

                  h-[19px]
                  min-w-[19px]

                  items-center
                  justify-center

                  rounded-full

                  bg-pink-500

                  px-1

                  text-[9px]
                  font-black

                  text-white

                  ring-2
                  ring-white
                "
              >
                3
              </span>
            </button>


            {/* Dark mode */}

            <button
              type="button"
              aria-label="الوضع الداكن"
              className="
                hidden

                h-11
                w-11

                items-center
                justify-center

                rounded-[14px]

                text-slate-500

                transition-all
                duration-200

                hover:bg-violet-50
                hover:text-violet-600

                md:flex

                lg:h-12
                lg:w-12
              "
            >
              <Moon
                size={20}
              />
            </button>


            {/* =================================================
                USER
            ================================================= */}

            <button
              type="button"
              className="
                hidden

                items-center

                gap-3

                rounded-[18px]

                border
                border-transparent

                py-2
                ps-3
                pe-2

                transition-all

                hover:border-slate-100
                hover:bg-slate-50

                sm:flex
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

                  rounded-full

                  bg-gradient-to-br
                  from-violet-500
                  to-blue-600

                  text-[15px]
                  font-black

                  text-white

                  shadow-sm

                  lg:h-12
                  lg:w-12
                  lg:text-[16px]
                "
              >
                {
                  firstLetter
                }
              </div>

              <div
                className="
                  hidden

                  min-w-0

                  text-right

                  xl:block
                "
              >
                <p
                  className="
                    max-w-[130px]

                    truncate

                    text-[14px]
                    font-black

                    text-slate-900
                  "
                >
                  {
                    username
                  }
                </p>

                <p
                  className="
                    mt-0.5

                    text-[10px]

                    text-slate-400
                  "
                >
                  حساب الطالب
                </p>
              </div>

              <ChevronDown
                size={16}
                className="
                  hidden

                  text-slate-400

                  xl:block
                "
              />
            </button>


            {/* Mobile menu */}

            <button
              type="button"
              onClick={() =>
                setMobileOpen(
                  true,
                )
              }
              aria-label="فتح القائمة"
              className="
                flex

                h-11
                w-11

                items-center
                justify-center

                rounded-[14px]

                border
                border-slate-200

                bg-white

                text-slate-600

                shadow-sm

                transition-all

                hover:border-violet-200
                hover:bg-violet-50
                hover:text-violet-600

                lg:hidden
              "
            >
              <Menu
                size={22}
              />
            </button>

          </div>

        </div>
      </header>


      {/* =================================================
          MOBILE OVERLAY
      ================================================= */}

      <button
        type="button"
        onClick={() =>
          setMobileOpen(false)
        }
        aria-label="إغلاق القائمة"
        className={`
          fixed

          inset-0

          z-40

          bg-slate-950/35

          backdrop-blur-[3px]

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


      {/* =================================================
          MOBILE MENU
      ================================================= */}

      <aside
        dir="rtl"
        className={`
          fixed

          inset-y-0
          right-0

          z-50

          flex

          w-[min(88vw,360px)]

          flex-col

          bg-white

          shadow-[-24px_0_70px_rgba(15,23,42,0.18)]

          transition-transform
          duration-300
          ease-out

          lg:hidden

          ${
            mobileOpen
              ? "translate-x-0"
              : "translate-x-full"
          }
        `}
      >

        {/* Mobile header */}

        <div
          className="
            flex

            h-[92px]

            shrink-0

            items-center
            justify-between

            border-b
            border-slate-100

            px-5
          "
        >
          <button
            type="button"
            onClick={() => {
              setMobileOpen(
                false,
              );

              navigate(
                "/home",
              );
            }}
            className="
              flex
              items-center
              gap-3
            "
          >
            <div
              className="
                flex

                h-12
                w-12

                items-center
                justify-center

                rounded-[15px]

                bg-gradient-to-br
                from-violet-600
                to-blue-600

                text-lg
                font-black

                text-white
              "
            >
              M
            </div>

            <div
              className="
                text-right
              "
            >
              <span
                className="
                  block

                  text-[18px]
                  font-black

                  text-slate-900
                "
              >
                MathMaster
              </span>

              <span
                className="
                  mt-0.5
                  block

                  text-[9px]

                  text-slate-400
                "
              >
                منصة التعلم الذكي
              </span>
            </div>
          </button>


          <button
            type="button"
            onClick={() =>
              setMobileOpen(
                false,
              )
            }
            aria-label="إغلاق القائمة"
            className="
              flex

              h-11
              w-11

              items-center
              justify-center

              rounded-xl

              bg-slate-50

              text-slate-500

              transition

              hover:bg-red-50
              hover:text-red-500
            "
          >
            <X size={21} />
          </button>

        </div>


        {/* User mobile */}

        <div
          className="
            shrink-0

            border-b
            border-slate-100

            px-5
            py-5
          "
        >
          <div
            className="
              flex
              items-center
              gap-3.5
            "
          >
            <div
              className="
                flex

                h-[52px]
                w-[52px]

                items-center
                justify-center

                rounded-full

                bg-gradient-to-br
                from-violet-500
                to-blue-600

                text-[17px]
                font-black

                text-white
              "
            >
              {
                firstLetter
              }
            </div>

            <div>
              <p
                className="
                  text-[15px]
                  font-black

                  text-slate-900
                "
              >
                {
                  username
                }
              </p>

              <p
                className="
                  mt-1

                  text-[11px]

                  text-slate-400
                "
              >
                مرحبًا بعودتك
              </p>
            </div>

          </div>
        </div>


        {/* Mobile navigation */}

        <nav
          className="
            min-h-0
            flex-1

            space-y-2

            overflow-y-auto

            p-5
          "
        >
          {navigationItems.map(
            (item) => (
              <NavLink
                key={
                  `${item.label}-mobile`
                }
                to={item.path}
                end={
                  item.path ===
                  "/home"
                }
                onClick={() =>
                  setMobileOpen(
                    false,
                  )
                }
                className={({
                  isActive,
                }) => `
                  flex

                  h-[56px]

                  items-center

                  rounded-[16px]

                  px-4

                  text-[15px]
                  font-extrabold

                  transition-all

                  ${
                    isActive
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-violet-600"
                  }
                `}
              >
                {
                  item.label
                }
              </NavLink>
            ),
          )}
        </nav>


        {/* Logout */}

        <div
          className="
            shrink-0

            border-t
            border-slate-100

            p-5
          "
        >
          <button
            type="button"
            onClick={logout}
            className="
              h-[52px]
              w-full

              rounded-[16px]

              bg-red-50

              text-[14px]
              font-extrabold

              text-red-500

              transition

              hover:bg-red-100
            "
          >
            تسجيل الخروج
          </button>
        </div>

      </aside>

    </>
  );
}