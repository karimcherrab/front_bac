import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BadgeCheck,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  Check,
  CreditCard,
  FileQuestion,
  GraduationCap,
  Loader2,
  LockKeyhole,
  MessageCircleMore,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";

import {
  createCheckout,
  formatDzd,
  getApiErrorMessage,
} from "../../services/paymentApi";

function safeNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);

    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}

function FeatureItem({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-100 bg-white/80 p-3.5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
        <Icon size={19} strokeWidth={2.2} />
      </div>

      <div className="min-w-0">
        <p className="text-[13px] font-black text-slate-900 sm:text-sm">
          {title}
        </p>

        {description && (
          <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500 sm:text-xs">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function OfferChoice({
  active,
  badge,
  title,
  subtitle,
  price,
  oldPrice,
  saving,
  bestValue = false,
  owned = false,
  onClick,
}) {
  return (
    <button
      type="button"
      disabled={owned}
      onClick={onClick}
      className={`
        relative w-full overflow-hidden rounded-[22px] border p-4 text-right
        transition duration-200
        ${
          active
            ? "border-violet-400 bg-violet-50/80 shadow-[0_16px_42px_rgba(124,58,237,0.13)] ring-4 ring-violet-100/70"
            : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30"
        }
        ${owned ? "cursor-default opacity-75" : "cursor-pointer"}
      `}
    >
      {bestValue && (
        <div className="absolute left-0 top-0 rounded-br-2xl bg-gradient-to-l from-violet-600 to-indigo-600 px-3 py-1.5 text-[10px] font-black text-white sm:text-[11px]">
          الأفضل قيمة
        </div>
      )}

      <div className="flex items-start gap-3">
        <span
          className={`
            mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2
            ${
              active
                ? "border-violet-600 bg-violet-600"
                : "border-slate-300 bg-white"
            }
          `}
        >
          {active && (
            <Check
              size={12}
              strokeWidth={3.3}
              className="text-white"
            />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-slate-900 sm:text-[15px]">
              {title}
            </p>

            {badge && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-500 sm:text-[10px]">
                {badge}
              </span>
            )}

            {owned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">
                <BadgeCheck size={12} />
                مفعّل
              </span>
            )}
          </div>

          <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500 sm:text-xs">
            {subtitle}
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
            <span className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              {price}
            </span>

            {oldPrice && (
              <span className="pb-0.5 text-xs font-bold text-slate-400 line-through">
                {oldPrice}
              </span>
            )}

            {saving > 0 && (
              <span className="mb-0.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                وفّر {formatDzd(saving)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function PurchaseOfferModal({
  open,
  onClose,
  token,
  course,
  chapter,
  chapterPack,
  subjectPack,
  chapterPacks = [],
  defaultMode = "chapter",
  onShowAllOffers,
}) {
  const [selectedMode, setSelectedMode] = useState(
    defaultMode,
  );
  const [loadingPackId, setLoadingPackId] = useState(null);
  const [error, setError] = useState("");

  const chapterCount = safeNumber(
    chapter?.axes_count,
    chapter?.axesCount,
    chapter?.lessonsCount,
    chapterPack?.metadata?.axes_count,
  );

  const chapterExercisesCount = safeNumber(
    chapter?.exercises_count,
    chapter?.questions_count,
    chapterPack?.metadata?.exercises_count,
  );

  const bacExercisesCount = safeNumber(
    chapter?.bac_exercises_count,
    chapterPack?.metadata?.bac_exercises_count,
  );

  const chaptersTotal = useMemo(
    () =>
      chapterPacks.reduce(
        (sum, pack) =>
          sum + Number(pack?.price_dzd || 0),
        0,
      ),
    [chapterPacks],
  );

  const subjectSaving = subjectPack
    ? Math.max(
        0,
        chaptersTotal - Number(subjectPack.price_dzd || 0),
      )
    : 0;

  const canChooseChapter = Boolean(
    chapterPack && chapterPack.owned !== true,
  );

  const canChooseSubject = Boolean(
    subjectPack && subjectPack.owned !== true,
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setError("");

    const preferred =
      defaultMode === "subject" && canChooseSubject
        ? "subject"
        : canChooseChapter
          ? "chapter"
          : canChooseSubject
            ? "subject"
            : "chapter";

    setSelectedMode(preferred);

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    open,
    defaultMode,
    canChooseChapter,
    canChooseSubject,
  ]);

  if (!open) {
    return null;
  }

  const selectedPack =
    selectedMode === "subject"
      ? subjectPack
      : chapterPack;

  const title =
    chapter?.title ||
    chapterPack?.target_title ||
    subjectPack?.target_title ||
    course?.name ||
    "محتوى Backey";

  const startCheckout = async () => {
    if (!selectedPack) {
      setError("هذا العرض غير متوفر حاليًا.");
      return;
    }

    if (!token) {
      setError("يجب تسجيل الدخول قبل إتمام عملية الشراء.");
      return;
    }

    try {
      setError("");
      setLoadingPackId(selectedPack.id);

      const checkout = await createCheckout({
        token,
        packId: selectedPack.id,
      });

      if (checkout?.owned === true) {
        window.location.reload();
        return;
      }

      if (!checkout?.checkout_url) {
        throw new Error("لم يُرجع الخادم رابط الدفع.");
      }

      window.location.assign(checkout.checkout_url);
    } catch (requestError) {
      if (requestError?.response?.data?.owned) {
        window.location.reload();
        return;
      }

      setError(
        getApiErrorMessage(
          requestError,
          "تعذر بدء عملية الدفع. حاول مرة أخرى.",
        ),
      );
    } finally {
      setLoadingPackId(null);
    }
  };

  const featureRows = [
    {
      icon: BookOpenCheck,
      title:
        chapterCount > 0
          ? `${chapterCount} ${chapterCount === 1 ? "محور" : "محاور"} داخل الوحدة`
          : "دروس ومحاور الوحدة كاملة",
      description:
        "شرح مرتب من الفكرة الأساسية إلى التطبيق خطوة بخطوة.",
    },
    {
      icon: FileQuestion,
      title:
        chapterExercisesCount > 0
          ? `${chapterExercisesCount} تمرينًا تدريبيًا داخل الوحدة`
          : "تمارين تدريبية لكل محور",
      description:
        "تتدرّب بعد كل فكرة بدل الاكتفاء بقراءة الدرس.",
    },
    {
      icon: GraduationCap,
      title:
        bacExercisesCount > 0
          ? `${bacExercisesCount} تمرين بكالوريا مع الحل`
          : "تمارين بكالوريا مع حلول واضحة",
      description:
        "تتدرّب على نمط الأسئلة التي تواجهها في البكالوريا.",
    },
    {
      icon: RefreshCcw,
      title: "تمارين جديدة مشابهة للبكالوريا",
      description:
        "أنشئ تدريبًا إضافيًا بنفس الفكرة عندما تحتاج إلى المزيد من التطبيق.",
    },
    {
      icon: MessageCircleMore,
      title: "اسأل المساعد إذا لم تفهم",
      description:
        "اكتب سؤالك أثناء الدراسة واحصل على مساعدة مرتبطة بما تراجعه.",
    },
    {
      icon: BrainCircuit,
      title: "إعادة شرح أي خطوة بطريقة أبسط",
      description:
        "إذا توقفت عند خطوة في الحل، اطلب شرحها بأسلوب أوضح وأبسط.",
    },
  ];

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="عرض شراء المحتوى"
      className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-5"
    >
      <button
        type="button"
        aria-label="إغلاق نافذة الشراء"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[5px]"
      />

      <div className="relative z-10 flex max-h-[94dvh] w-full max-w-[1040px] flex-col overflow-hidden rounded-t-[30px] border border-white/70 bg-[#f8f9ff] shadow-[0_32px_100px_rgba(15,23,42,0.35)] sm:max-h-[90dvh] sm:rounded-[30px]">
        <div className="relative overflow-hidden bg-gradient-to-l from-[#5b21b6] via-[#6d28d9] to-[#2563eb] px-5 pb-6 pt-5 text-white sm:px-7 sm:pb-7 sm:pt-6">
          <div className="pointer-events-none absolute -left-14 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 right-10 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black backdrop-blur sm:text-[11px]">
                <Sparkles size={14} />
                عرض Backey للدراسة الذكية
              </div>

              <h2 className="mt-3 max-w-[760px] text-xl font-black leading-tight sm:text-2xl lg:text-[28px]">
                {chapter
                  ? `افتح ${title} وابدأ التدريب الكامل`
                  : `افتح ${course?.name || title} كاملة`}
              </h2>

              <p className="mt-2 max-w-2xl text-xs font-semibold leading-6 text-violet-100 sm:text-sm">
                الدرس ليس فيديو أو نص فقط؛ تحصل على مسار دراسة، تمارين، بكالوريا ومساعدة ذكية عندما تتوقف عند أي فكرة.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white/95">
              <ShieldCheck size={13} />
              دفع آمن عبر Chargily
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white/95">
              <CreditCard size={13} />
              CIB / Edahabia
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white/95">
              <LockKeyhole size={13} />
              التفعيل بعد تأكيد الدفع
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_360px] lg:gap-7">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <Bot size={19} className="text-violet-600" />
                <h3 className="text-sm font-black text-slate-900 sm:text-base">
                  ماذا ستحصل عليه؟
                </h3>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {featureRows.map((feature) => (
                  <FeatureItem
                    key={feature.title}
                    {...feature}
                  />
                ))}
              </div>

              <div className="mt-4 rounded-[22px] border border-amber-100 bg-gradient-to-l from-amber-50 to-white p-4">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Trophy size={19} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 sm:text-sm">
                      الهدف: لا تبقى عالقًا في الدرس
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500 sm:text-xs">
                      افهم الفكرة، طبّق عليها، جرّب سؤال بكالوريا، ثم اطلب شرحًا أبسط أو تمرينًا جديدًا عندما تحتاج إليه.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="min-w-0 lg:sticky lg:top-0 lg:self-start">
              <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.13em] text-violet-600">
                      اختر العرض
                    </p>
                    <h3 className="mt-1 text-base font-black text-slate-950">
                      ادفع فقط لما تحتاجه
                    </h3>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <CreditCard size={20} />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {chapterPack && (
                    <OfferChoice
                      active={selectedMode === "chapter"}
                      badge="هذه الوحدة"
                      title={chapter?.title || chapterPack.target_title || chapterPack.name}
                      subtitle="افتح هذه الوحدة فقط وجميع محتوياتها التدريبية."
                      price={formatDzd(chapterPack.price_dzd)}
                      owned={chapterPack.owned === true}
                      onClick={() => setSelectedMode("chapter")}
                    />
                  )}

                  {subjectPack && (
                    <OfferChoice
                      active={selectedMode === "subject"}
                      badge="المادة كاملة"
                      title={subjectPack.target_title || subjectPack.name}
                      subtitle="كل الوحدات الحالية التابعة للمادة في عرض واحد."
                      price={formatDzd(subjectPack.price_dzd)}
                      oldPrice={
                        chaptersTotal > Number(subjectPack.price_dzd || 0)
                          ? formatDzd(chaptersTotal)
                          : ""
                      }
                      saving={subjectSaving}
                      bestValue={subjectSaving > 0 || Boolean(chapterPack)}
                      owned={subjectPack.owned === true}
                      onClick={() => setSelectedMode("subject")}
                    />
                  )}
                </div>

                {error && (
                  <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-3.5 py-3 text-[11px] font-bold leading-5 text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  disabled={
                    !selectedPack ||
                    selectedPack?.owned === true ||
                    loadingPackId !== null
                  }
                  onClick={startCheckout}
                  className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 to-indigo-600 px-5 text-sm font-black text-white shadow-[0_14px_32px_rgba(109,40,217,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(109,40,217,0.32)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {loadingPackId !== null ? (
                    <Loader2 size={19} className="animate-spin" />
                  ) : (
                    <CreditCard size={19} />
                  )}

                  {loadingPackId !== null
                    ? "جاري تحضير صفحة الدفع..."
                    : selectedPack
                      ? `تابع للدفع • ${formatDzd(selectedPack.price_dzd)}`
                      : "العرض غير متوفر"}
                </button>

                <p className="mt-3 text-center text-[10px] font-semibold leading-5 text-slate-400">
                  لن يتم فتح المحتوى إلا بعد تأكيد عملية الدفع من الخادم.
                </p>

                {onShowAllOffers && (
                  <button
                    type="button"
                    onClick={onShowAllOffers}
                    className="mt-2 w-full py-2 text-xs font-black text-violet-600 transition hover:text-violet-800"
                  >
                    مشاهدة جميع العروض والأسعار
                  </button>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
