// src/Utils/UserContext.jsx

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Cookies from "js-cookie";

export const UserContext =
  createContext(null);

export function UserProvider({
  children,
}) {
  const [chapter, setChapter] =
    useState(null);

  const [
    current_axis,
    setCurrent_axis,
  ] = useState(null);

  const [activeId, setActiveId] =
    useState("intro");

  const [token, setToken] =
    useState(() => {
      return (
        Cookies.get(
          "access_token",
        ) || null
      );
    });

  const [
    refreshToken,
    setRefreshToken,
  ] = useState(() => {
    return (
      Cookies.get(
        "refresh_token",
      ) || null
    );
  });

  const [user, setUser] =
    useState(() => {
      const storedUser =
        localStorage.getItem(
          "student",
        );

      if (!storedUser) {
        return null;
      }

      try {
        return JSON.parse(
          storedUser,
        );
      } catch {
        localStorage.removeItem(
          "student",
        );

        return null;
      }
    });

  useEffect(() => {
    if (user) {
      localStorage.setItem(
        "student",
        JSON.stringify(user),
      );
    } else {
      localStorage.removeItem(
        "student",
      );
    }
  }, [user]);

  const login = useCallback(
    ({
      accessToken,
      refreshToken:
        newRefreshToken,
      userData,
      rememberMe = true,
    }) => {
      if (!accessToken) {
        throw new Error(
          "Access token manquant.",
        );
      }

      const baseCookieOptions = {
        sameSite: "Lax",
        secure:
          window.location.protocol ===
          "https:",
      };

      const accessCookieOptions = {
        ...baseCookieOptions,
      };

      const refreshCookieOptions = {
        ...baseCookieOptions,
      };

      if (rememberMe) {
        accessCookieOptions.expires =
          1;

        refreshCookieOptions.expires =
          7;
      }

      Cookies.set(
        "access_token",
        accessToken,
        accessCookieOptions,
      );

      if (newRefreshToken) {
        Cookies.set(
          "refresh_token",
          newRefreshToken,
          refreshCookieOptions,
        );
      } else {
        Cookies.remove(
          "refresh_token",
        );
      }

      setToken(accessToken);

      setRefreshToken(
        newRefreshToken || null,
      );

      setUser(userData || null);
    },
    [],
  );

  const logout = useCallback(() => {
    Cookies.remove(
      "access_token",
    );

    Cookies.remove(
      "refresh_token",
    );

    localStorage.removeItem(
      "student",
    );

    setToken(null);
    setRefreshToken(null);
    setUser(null);

    setChapter(null);
    setCurrent_axis(null);
    setActiveId("intro");
  }, []);

  const updateUser =
    useCallback(
      (studentData) => {
        setUser(
          studentData || null,
        );
      },
      [],
    );

  const contextValue =
    useMemo(
      () => ({
        chapter,
        setChapter,

        current_axis,
        setCurrent_axis,

        activeId,
        setActiveId,

        token,
        setToken,

        refreshToken,
        setRefreshToken,

        user,
        setUser: updateUser,

        login,
        logout,

        isAuthenticated:
          Boolean(token),
      }),
      [
        chapter,
        current_axis,
        activeId,
        token,
        refreshToken,
        user,
        updateUser,
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