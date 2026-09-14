import {
  ArrowLeft,
  BookOpenCheck,
  BrainCircuit,
  GraduationCap,
  LockKeyhole,
  MessageCircleMore,
  Sparkles,
} from "lucide-react";

import { formatDzd } from "../../services/paymentApi";

export default function LockedChapterCard({ chapter, onOpenOffer }) {
  const axesCount = Number(chapter?.axes_count || 0);

  return (
    <button
      type="button"
      onClick={onOpenOffer}
      className="group w-full overflow-hidden rounded-[26px] border border-slate-200 bg-white text-right shadow-[0_10px_35px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_18px_48px_rgba(109,40,217,0.13)]"
    >
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-center sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700">
              <LockKeyhole size={12} />
              وحدة مميزة
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
              <Sparkles size={12} />
              عرض متاح
            </span>
          </div>

          <h3 className="mt-3 text-base font-black leading-7 text-slate-950 sm:text-lg">
            {chapter?.title || "الوحدة"}
          </h3>

          <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold text-slate-600 sm:text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2">
              <BookOpenCheck size={13} className="text-violet-600" />
              {axesCount > 0 ? `${axesCount} محاور` : "الدروس والمحاور"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2">
              <GraduationCap size={13} className="text-violet-600" />
              تمارين + بكالوريا
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2">
              <MessageCircleMore size={13} className="text-violet-600" />
              مساعد ذكي
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2">
              <BrainCircuit size={13} className="text-violet-600" />
              إعادة شرح مبسطة
            </span>
          </div>
        </div>

        <div className="rounded-[22px] border border-violet-100 bg-gradient-to-b from-violet-50 to-white p-4 sm:text-center">
          <p className="text-[10px] font-bold text-slate-400">فتح الوحدة كاملة</p>
          <p className="mt-1 text-2xl font-black text-slate-950">
            {chapter?.pack ? formatDzd(chapter.pack.price_dzd) : "عرض"}
          </p>
          <div className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-black text-white shadow-lg shadow-violet-200/70 transition group-hover:bg-violet-700">
            شاهد التفاصيل
            <ArrowLeft size={15} />
          </div>
        </div>
      </div>
    </button>
  );
}
