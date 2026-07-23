// src/Utils/UserContext.jsx

import {
  createContext,
  useCallback,
  useMemo,
  useState,
} from "react";

import Cookies from "js-cookie";

export const UserContext = createContext({
  chapter: null,
  setChapter: () => {},

  current_axis: null,
  setCurrent_axis: () => {},

  activeId: "intro",
  setActiveId: () => {},

  token: null,
  setToken: () => {},

  user: null,
  setUser: () => {},

  isAuthenticated: false,

  login: () => {},
  logout: () => {},
});

export function UserProvider({ children }) {
  const [chapter, setChapter] =
    useState(null);

  const [current_axis, setCurrent_axis] =
    useState(null);

  const [activeId, setActiveId] =
    useState("intro");

  /*
   * قراءة الـ token عند تشغيل التطبيق.
   */
  const [token, setToken] = useState(
    () => Cookies.get("access_token") || null,
  );

  const [user, setUser] = useState(() => {
    try {
      const storedUser =
        localStorage.getItem("student");

      return storedUser
        ? JSON.parse(storedUser)
        : null;
    } catch (error) {
      console.error(
        "Error reading stored user:",
        error,
      );

      return null;
    }
  });

  /*
   * تُستعمل مباشرة بعد نجاح تسجيل الدخول.
   * تحفظ الـ token وتحدث Context في نفس اللحظة.
   */
  const login = useCallback(
    ({
      accessToken,
      refreshToken = null,
      userData = null,
      rememberMe = true,
    }) => {
      if (!accessToken) {
        throw new Error(
          "Access token is required.",
        );
      }

      const cookieOptions = {
        path: "/",
        sameSite: "Lax",
        secure: import.meta.env.PROD,
      };

      Cookies.set(
        "access_token",
        accessToken,
        {
          ...cookieOptions,
          expires: rememberMe
            ? 1
            : undefined,
        },
      );

      if (refreshToken) {
        Cookies.set(
          "refresh_token",
          refreshToken,
          {
            ...cookieOptions,
            expires: rememberMe
              ? 7
              : undefined,
          },
        );
      } else {
        Cookies.remove(
          "refresh_token",
          {
            path: "/",
          },
        );
      }

      if (userData) {
        localStorage.setItem(
          "student",
          JSON.stringify(userData),
        );
      } else {
        localStorage.removeItem(
          "student",
        );
      }

      /*
       * أهم سطر لحل مشكلة الـ refresh.
       */
      setToken(accessToken);
      setUser(userData);
    },
    [],
  );

  const logout = useCallback(() => {
    Cookies.remove(
      "access_token",
      {
        path: "/",
      },
    );

    Cookies.remove(
      "refresh_token",
      {
        path: "/",
      },
    );

    localStorage.removeItem("student");

    setToken(null);
    setUser(null);

    setChapter(null);
    setCurrent_axis(null);
    setActiveId("intro");
  }, []);

  const contextValue = useMemo(
    () => ({
      chapter,
      setChapter,

      current_axis,
      setCurrent_axis,

      token,
      setToken,

      activeId,
      setActiveId,

      user,
      setUser,

      isAuthenticated:
        Boolean(token),

      login,
      logout,
    }),
    [
      chapter,
      current_axis,
      token,
      activeId,
      user,
      login,
      logout,
    ],
  );

  return (
    <UserContext.Provider
      value={contextValue}
    >
      {children}
    </UserContext.Provider>
  );
}