import { useState } from "react";

import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import DashboardTopbar from "../components/dashboard/DashboardTopbar";

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#fafbff]">
    
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopbar />

        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>

        <DashboardSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

    </div>
  );
}