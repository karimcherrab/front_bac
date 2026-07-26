import LessonCard from "../components/LessonCard";
import ChatPanel from "../components/ChatPanel";
import { useState } from "react";

export default function LessonPage() {
  const [chatCollapsed, setChatCollapsed] = useState(true);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main
          className={[
            "min-w-0 flex-1 overflow-y-auto",
            "bg-slate-50 px-4 py-6 sm:px-6",
            "[&::-webkit-scrollbar]:w-[10px]",
            "[&::-webkit-scrollbar-track]:bg-slate-100",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-slate-300",
            "hover:[&::-webkit-scrollbar-thumb]:bg-slate-400",
          ].join(" ")}
        >
          <LessonCard />
        </main>

        <ChatPanel
          collapsed={chatCollapsed}
          setCollapsed={setChatCollapsed}
          chapterId={1}
          chapterTitle="المتتاليات العددية"
        />
      </div>
    </div>
  );
}