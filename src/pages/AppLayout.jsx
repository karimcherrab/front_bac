import { useState } from "react";
import Sidebar from "../components/Sidebar";

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
   
      <div className="flex-1 overflow-hidden transition-all duration-300">
        {children}
      </div>
         <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

    </div>
  );
}