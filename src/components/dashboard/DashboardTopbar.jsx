// src/components/dashboard/DashboardTopbar.jsx

import {
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  X,
} from "lucide-react";

import {
  useContext,
  useEffect,
  useRef,
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

import Logo from "../Logo";


const navigationItems = [
  {
    label: "الرئيسية",
    path: "/home",
  },
  {
    label: "بكالوريا تجيريبية",
    path: "/bac",
  },
  {
    label: "المساعد الذكي",
    path: "/tutor",
  },
  {
    label: "العروض والأسعار",
    path: "/pricing",
  },
  {
    label: "المواد",
    path: "/subjects",
  },
];


const AUTH_STORAGE_KEYS = [
  "access_token",
  "refresh_token",
  "access",
  "refresh",
  "token",
  "auth_token",
  "authToken",
  "user",
  "currentUser",
  "auth_user",
];


function removeAuthCookie(name) {
  // حذف بالطريقة العادية
  Cookies.remove(name);

  // أغلب Cookies الخاصة بالمصادقة تكون على المسار /
  Cookies.remove(name, {
    path: "/",
  });

  // محاولة إضافية مفيدة عندما تم إنشاء Cookie مع domain صريح.
  if (typeof window !== "undefined") {
    const hostname =
      window.location.hostname;

    if (hostname) {
      Cookies.remove(name, {
        path: "/",
        domain: hostname,
      });

      // مثال: app.example.com -> .example.com
      const parts =
        hostname.split(".");

      if (parts.length >= 2) {
        const rootDomain =
          `.${parts.slice(-2).join(".")}`;

        Cookies.remove(name, {
          path: "/",
          domain: rootDomain,
        });
      }
    }
  }
}


function clearAuthStorage() {
  if (typeof window === "undefined") {
    return;
  }

  AUTH_STORAGE_KEYS.forEach(
    (key) => {
      try {
        window.localStorage.removeItem(
          key,
        );
      } catch {
        // تجاهل الخطأ إذا كان localStorage غير متاح.
      }

      try {
        window.sessionStorage.removeItem(
          key,
        );
      } catch {
        // تجاهل الخطأ إذا كان sessionStorage غير متاح.
      }
    },
  );
}


export default function DashboardTopbar() {
  const authContext =
    useContext(UserContext) || {};

  const {
    user,
    setUser,
  } = authContext;

  const navigate =
    useNavigate();

  const userMenuRef =
    useRef(null);

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const [
    userMenuOpen,
    setUserMenuOpen,
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


  /* =========================================================
     MOBILE MENU
  ========================================================= */

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
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


  /* =========================================================
     DESKTOP USER DROPDOWN
  ========================================================= */

  useEffect(() => {
    if (!userMenuOpen) {
      return undefined;
    }

    const handleOutsideClick = (
      event,
    ) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(
          event.target,
        )
      ) {
        setUserMenuOpen(false);
      }
    };

    const handleEscape = (
      event,
    ) => {
      if (
        event.key === "Escape"
      ) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );

      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [
    userMenuOpen,
  ]);


  /* =========================================================
     LOGOUT
  ========================================================= */

  function logout() {
    setMobileOpen(false);
    setUserMenuOpen(false);

    // Cookies المستخدمة في المشروع حاليًا.
    removeAuthCookie(
      "access_token",
    );

    removeAuthCookie(
      "refresh_token",
    );

    // تنظيف أي نسخة قديمة من التوكنات في storage.
    clearAuthStorage();

    // مهم: تنظيف المستخدم الموجود داخل React Context.
    // typeof يجعل الكود يعمل حتى لو لم يكن setUser موجودًا في Context.
    if (
      typeof setUser === "function"
    ) {
      setUser(null);
    }

    // replace يمنع الرجوع إلى الصفحة المحمية بزر Back،
    // وإعادة تحميل الصفحة تنظف أي state مصادقة بقي في الذاكرة.
    window.location.replace(
      "/login",
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
            aria-label="العودة إلى الصفحة الرئيسية"
            title="الصفحة الرئيسية"
            className="
              group
              flex
              shrink-0
              items-center
              rounded-[20px]
              border
              border-transparent
              px-2
              py-2
              transition
              duration-200

              hover:border-slate-100
              hover:bg-slate-50

              active:scale-[0.98]
            "
          >
            <Logo
              variant="light"
              className="
                gap-3
                sm:gap-3.5
              "
            />
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
                USER DESKTOP
            ================================================= */}

            <div
              ref={userMenuRef}
              className="
                relative
                hidden

                sm:block
              "
            >
              <button
                type="button"
                onClick={() =>
                  setUserMenuOpen(
                    (current) =>
                      !current,
                  )
                }
                aria-expanded={
                  userMenuOpen
                }
                aria-haspopup="menu"
                className="
                  flex

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
                  className={`
                    hidden

                    text-slate-400

                    transition-transform
                    duration-200

                    xl:block

                    ${
                      userMenuOpen
                        ? "rotate-180"
                        : "rotate-0"
                    }
                  `}
                />
              </button>


              {/* Desktop dropdown */}

              <div
                role="menu"
                className={`
                  absolute

                  left-0
                  top-[calc(100%+10px)]

                  z-[70]

                  w-[230px]

                  origin-top-left

                  rounded-[20px]

                  border
                  border-slate-100

                  bg-white

                  p-2

                  shadow-[0_20px_60px_rgba(15,23,42,0.14)]

                  transition-all
                  duration-200

                  ${
                    userMenuOpen
                      ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
                  }
                `}
              >
                <div
                  className="
                    border-b
                    border-slate-100

                    px-3
                    py-3

                    text-right
                  "
                >
                  <p
                    className="
                      truncate

                      text-[13px]
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

                      text-[10px]

                      text-slate-400
                    "
                  >
                    حساب الطالب
                  </p>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="
                    mt-2

                    flex
                    h-[48px]
                    w-full

                    items-center
                    justify-between

                    rounded-[14px]

                    px-3

                    text-[13px]
                    font-extrabold

                    text-red-500

                    transition-colors

                    hover:bg-red-50
                  "
                >
                  <span>
                    تسجيل الخروج
                  </span>

                  <LogOut
                    size={18}
                  />
                </button>
              </div>
            </div>


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
            aria-label="العودة إلى الصفحة الرئيسية"
            className="
              flex
              min-w-0
              items-center
              rounded-2xl
              px-1
              py-1
              transition

              hover:bg-slate-50

              active:scale-[0.98]
            "
          >
            <Logo
              variant="light"
              className="gap-3"
            />
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
              flex

              h-[52px]
              w-full

              items-center
              justify-center

              gap-2

              rounded-[16px]

              bg-red-50

              text-[14px]
              font-extrabold

              text-red-500

              transition

              hover:bg-red-100
            "
          >
            <LogOut
              size={18}
            />

            <span>
              تسجيل الخروج
            </span>
          </button>
        </div>

      </aside>

    </>
  );
}
