import { useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  useParams,
} from "react-router-dom";

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const { id_subjects , id_chapter } = useParams();

  return (
    <div className="flex h-screen overflow-hidden">
   
      <div className="flex-1 overflow-hidden transition-all duration-300">
        {children}
      </div>
         <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        id_chapter = {id_chapter}
      />

    </div>
  );
}