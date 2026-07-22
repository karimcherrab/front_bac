import Navbar from "../components/Navbar";
import LessonCard from "../components/LessonCard";
import QuestionBac from "../components/QuestionBac";

import LessonFooterGrid from "../components/LessonFooterGrid";
import ChatPanel from "../components/ChatPanel";
import { breadcrumb } from "../data/lessonData";
import { useState } from "react";

export default function LessonPage() {
    const [chatCollapsed, setChatCollapsed] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* <Navbar breadcrumb={breadcrumb} /> */}

      <div className="flex flex-1 overflow-hidden">
               <ChatPanel
          collapsed={chatCollapsed}
          setCollapsed={setChatCollapsed}

          chapterId={1}
          chapterTitle={"sequence"}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6 
              flex-1 overflow-y-auto 

              [&::-webkit-scrollbar]:w-[12px]

              [&::-webkit-scrollbar-track]:bg-white/5
              [&::-webkit-scrollbar-track]:rounded-full

              [&::-webkit-scrollbar-thumb]:bg-white/20
              [&::-webkit-scrollbar-thumb]:backdrop-blur-xl
              [&::-webkit-scrollbar-thumb]:rounded-full

              hover:[&::-webkit-scrollbar-thumb]:bg-white/40

              [&::-webkit-scrollbar-thumb]:border-2
              [&::-webkit-scrollbar-thumb]:border-brand-100">
          <LessonCard />
          {/* <LessonFooterGrid /> */}
        </main>

 
      </div>
    </div>
  );
}
