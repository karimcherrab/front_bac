import {
  BookMarked,
  CheckCircle2,
  Star,
  TrendingUp,
} from "lucide-react";

import ProgressRing from "./ProgressRing";

export function ChapterSelector({ chapter }) {
  return (
    <div className="px-5 pt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-blue-100/70">
          الفصل الحالي
        </p>

        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black text-blue-100">
          نشط
        </span>
      </div>

      <button
        type="button"
        className={[
          "group flex w-full items-center justify-between gap-3",
          "rounded-2xl border border-white/10",
          "bg-blue-950/45 px-4 py-4",
          "text-right text-white",
          "shadow-[0_14px_35px_-20px_rgba(15,23,42,0.8)]",
          "backdrop-blur-xl transition duration-200",
          "hover:-translate-y-0.5 hover:bg-blue-950/65",
        ].join(" ")}
      >
        <div className="min-w-0">
          <span className="block truncate text-base font-black">
            {chapter}
          </span>

          <span className="mt-1 block text-xs font-medium text-blue-200/70">
            اضغط لعرض معلومات الفصل
          </span>
        </div>

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-violet-200 transition group-hover:bg-white/15">
          <BookMarked size={21} />
        </span>
      </button>
    </div>
  );
}

export function ProgressCard({
  percent = 0,
  message,
}) {
  const safePercent = Math.max(
    0,
    Math.min(100, Number(percent) || 0)
  );

  return (
    <div
      className={[
        "relative mx-5 mt-6 overflow-hidden rounded-[26px]",
        "border border-white/10",
        "bg-blue-950/40 px-5 py-6 text-center",
        "shadow-[0_20px_45px_-25px_rgba(15,23,42,0.9)]",
        "backdrop-blur-xl",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-violet-400/15 blur-2xl" />

      <div className="relative">
        <div className="mb-5 flex items-center justify-center gap-2">
          <TrendingUp
            size={17}
            className="text-blue-200"
          />

          <p className="text-sm font-bold text-blue-100/80">
            تقدمك في هذا الجزء
          </p>
        </div>

        <div className="flex justify-center">
          <ProgressRing percent={safePercent} />
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2.5">
          <CheckCircle2
            size={16}
            className="text-emerald-300"
          />

          <p className="text-sm font-black text-amber-300">
            {message}
          </p>

          <Star
            size={14}
            className="fill-amber-300 text-amber-300"
          />
        </div>
      </div>
    </div>
  );
}