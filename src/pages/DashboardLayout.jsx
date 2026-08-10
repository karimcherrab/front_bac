// src/layouts/DashboardLayout.jsx

import {
  useEffect,
  useState,
} from "react";

import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import DashboardTopbar from "../components/dashboard/DashboardTopbar";

export default function DashboardLayout({
  children,
}) {
  const [collapsed, setCollapsed] =
    useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);

  // Fermer le menu mobile avec la touche Escape.
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  // Empêcher le scroll du body lorsque
  // la sidebar mobile est ouverte.
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  return (
    <div
      dir="rtl"
      className="
        flex
        h-dvh
        min-h-dvh
        w-full
        overflow-hidden
        bg-[#fafbff]
      "
    >
      {/* Sidebar */}
      <DashboardSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() =>
          setMobileSidebarOpen(false)
        }
      />

      {/* Main content */}
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
        <DashboardTopbar
          onOpenSidebar={() =>
            setMobileSidebarOpen(true)
          }
        />

        <main
          className="
            min-h-0
            min-w-0
            flex-1
            overflow-x-hidden
            overflow-y-auto
            overscroll-contain
          "
        >
          {children}
        </main>
      </div>
    </div>
  );
}