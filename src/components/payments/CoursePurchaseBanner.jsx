import {
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  Bot,
  GraduationCap,
  Loader2,
  MessageCircleMore,
  Sparkles,
} from "lucide-react";

import {
  formatDzd,
} from "../../services/paymentApi";

export default function CoursePurchaseBanner({
  course,
  packs = [],
  loading = false,
  error = "",
  onOpenOffer,
}) {
  const subjectPack = packs.find(
    (pack) => pack.pack_type === "subject",
  );

  const chapterPacks = packs.filter(
    (pack) => pack.pack_type === "chapter",
  );

  const chaptersTotal = chapterPacks.reduce(
    (sum, pack) => sum + Number(pack.price_dzd || 0),
    0,
  );

  const saving = subjectPack
    ? Math.max(
        0,
        chaptersTotal - Number(subjectPack.price_dzd || 0),
      )
    : 0;

  if (loading) {
    return (
      <div className="flex min-h-[150px] items-center justify-center rounded-[26px] border border-violet-100 bg-white shadow-sm">
        <Loader2 size={26} className="animate-spin text-violet-600" />
      </div>
    );
  }

  if (!subjectPack) {
    return error ? (
      <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-sm font-bold text-amber-700">
        {error}
      </div>
    ) : null;
  }

  if (subjectPack.owned) {
    return (
      <section className="relative overflow-hidden rounded-[26px] border border-emerald-100 bg-gradient-to-l from-emerald-50 via-white to-white p-5 shadow-sm sm:p-6">
        <div className="absolute -left-8 -top-12 h-36 w-36 rounded-full bg-emerald-100/60 blur-3xl" />

        <div className="relative flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <BadgeCheck size={25} />
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
              Premium مفعّل
            </p>
            <h2 className="mt-1 text-base font-black text-slate-950 sm:text-lg">
              كل {course?.name || "المادة"} مفتوحة في حسابك
            </h2>
            <p className="mt-1.5 text-xs font-semibold leading-6 text-slate-500 sm:text-sm">
              ادخل إلى الوحدات وابدأ الدروس والتمارين والبكالوريا والمساعدة الذكية دون شراء إضافي داخل المادة.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-violet-200/70 bg-[#171129] shadow-[0_22px_55px_rgba(76,29,149,0.20)]">
      <div className="absolute inset-0 bg-gradient-to-l from-violet-950 via-[#2b1856] to-[#17224d]" />
      <div className="absolute -left-16 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute -bottom-28 right-20 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl" />

      <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-center lg:p-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black text-violet-100 backdrop-blur">
              <Sparkles size={13} />
              عرض المادة الكاملة
            </span>

            {saving > 0 && (
              <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-[10px] font-black text-emerald-300">
                وفّر {formatDzd(saving)}
              </span>
            )}
          </div>

          <h2 className="mt-3 text-xl font-black leading-tight text-white sm:text-2xl">
            افتح {course?.name || "المادة"} كاملة بدل شراء كل وحدة وحدها
          </h2>

          <p className="mt-2 max-w-3xl text-xs font-semibold leading-6 text-violet-100/80 sm:text-sm">
            كل الدروس والمحاور والتمارين والبكالوريا، مع تمارين مشابهة ومساعدة AI وإعادة شرح الخطوات الصعبة بطريقة أبسط.
          </p>

          <div className="mt-4 grid gap-2.5 text-[11px] font-bold text-white/90 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <BookOpenCheck size={16} className="text-violet-300" />
              كل الوحدات والمحاور
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap size={16} className="text-violet-300" />
              تمارين + بكالوريا
            </div>
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-violet-300" />
              تمارين مشابهة
            </div>
            <div className="flex items-center gap-2">
              <MessageCircleMore size={16} className="text-violet-300" />
              مساعد ذكي أثناء الدراسة
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
          <p className="text-[10px] font-bold text-violet-200">
            المادة كاملة بسعر العرض
          </p>

          <div className="mt-1 flex flex-wrap items-end gap-2">
            <span className="text-3xl font-black text-white">
              {formatDzd(subjectPack.price_dzd)}
            </span>

            {chaptersTotal > Number(subjectPack.price_dzd || 0) && (
              <span className="pb-1 text-xs font-bold text-violet-300 line-through">
                {formatDzd(chaptersTotal)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenOffer}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-violet-800 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-violet-50"
          >
            شاهد العرض وابدأ
            <ArrowLeft size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
