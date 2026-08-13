// src/layouts/DashboardLayout.jsx

import DashboardTopbar from "../components/dashboard/DashboardTopbar";

export default function DashboardLayout({
  children,
}) {
  return (
    <div
      dir="rtl"
      className="
        flex
        min-h-dvh
        w-full
        flex-col
        bg-[#fbfcff]
      "
    >
      <DashboardTopbar />

      <main
        className="
          min-h-0
          min-w-0
          flex-1
          overflow-x-hidden
        "
      >
        {children}
      </main>
    </div>
  );
}