import { useState } from "react";
import {
  useLocation,
  useParams,
} from "react-router-dom";

import LessonCard from "../components/LessonCard";
import ChatPanel from "../components/ChatPanel";
import { TutorPageProvider } from "../Utils/TutorPageContext";

export default function LessonPage() {
  const { id_chapter } = useParams();
  const location = useLocation();

  const [chatCollapsed, setChatCollapsed] = useState(true);

  const chapterId = Number(id_chapter) || 0;
  const chapterTitle =
    location.state?.chapterTitle ||
    location.state?.chapter?.title ||
    "الدرس الحالي";

  return (
    <TutorPageProvider
      chapterId={chapterId}
      chapterTitle={chapterTitle}
    >
      <div
        dir="rtl"
        className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-50"
      >
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <main
            className="
              min-h-0 min-w-0 flex-1
              overflow-x-hidden overflow-y-auto overscroll-contain
              bg-slate-50 px-2 py-3
              min-[360px]:px-3 sm:px-4 sm:py-4
              md:px-5 md:py-5 lg:px-6 lg:py-6
              xl:px-8 2xl:px-10
              [scrollbar-width:thin]
              [scrollbar-color:rgb(203_213_225)_rgb(241_245_249)]
              [&::-webkit-scrollbar]:w-[7px]
              [&::-webkit-scrollbar-track]:bg-slate-100
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-slate-300
              hover:[&::-webkit-scrollbar-thumb]:bg-slate-400
            "
          >
            <div className="mx-auto w-full min-w-0 max-w-[1500px]">
              <LessonCard />
            </div>
          </main>

          <ChatPanel
            collapsed={chatCollapsed}
            setCollapsed={setChatCollapsed}
            chapterId={chapterId}
            chapterTitle={chapterTitle}
          />
        </div>
      </div>
    </TutorPageProvider>
  );
}
