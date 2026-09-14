import {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Bot,
  Check,
  Crown,
  GraduationCap,
  Loader2,
  MessageCircleMore,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  TriangleAlert,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import PurchaseOfferModal from "../components/payments/PurchaseOfferModal";

import {
  UserContext,
} from "../Utils/UserContext";

import {
  formatDzd,
  getApiErrorMessage,
  getPacks,
} from "../services/paymentApi";

function Benefit({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 sm:text-xs">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
        <Icon size={14} />
      </span>
      <span>{children}</span>
    </div>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    token,
  } = useContext(UserContext);

  const subjectId =
    searchParams.get("subject") || "";

  const highlightedChapterId =
    searchParams.get("chapter") || "";

  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOffer, setSelectedOffer] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const result = await getPacks({
          token,
          subjectId: subjectId || undefined,
          signal: controller.signal,
        });

        setPacks(result);
      } catch (requestError) {
        if (
          requestError?.name === "CanceledError" ||
          requestError?.code === "ERR_CANCELED"
        ) {
          return;
        }

        setPacks([]);
        setError(
          getApiErrorMessage(
            requestError,
            "تعذر تحميل العروض والأسعار.",
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [refreshKey, subjectId, token]);

  const subjectPacks = useMemo(
    () =>
      packs.filter(
        (pack) => pack.pack_type === "subject",
      ),
    [packs],
  );

  const chapterPacks = useMemo(
    () =>
      packs.filter(
        (pack) => pack.pack_type === "chapter",
      ),
    [packs],
  );

  const scopedSubjectPack = useMemo(() => {
    if (!subjectId) {
      return null;
    }

    return (
      subjectPacks.find(
        (pack) =>
          String(pack.target_id) === String(subjectId) ||
          String(pack.subject_id) === String(subjectId),
      ) || subjectPacks[0] || null
    );
  }, [subjectId, subjectPacks]);

  const scopedTotal = useMemo(
    () =>
      chapterPacks.reduce(
        (sum, pack) =>
          sum + Number(pack.price_dzd || 0),
        0,
      ),
    [chapterPacks],
  );

  const scopedSaving = scopedSubjectPack
    ? Math.max(
        0,
        scopedTotal - Number(scopedSubjectPack.price_dzd || 0),
      )
    : 0;

  const openSubjectPack = (pack) => {
    setSelectedOffer({
      mode: "subject",
      subjectPack: pack,
      chapterPack: null,
      chapter: null,
    });
  };

  const openChapterPack = (pack) => {
    const chapter = {
      id: pack.target_id,
      title: pack.target_title || pack.name,
      axes_count:
        Number(pack.metadata?.axes_count || 0),
      exercises_count:
        Number(pack.metadata?.exercises_count || 0),
      bac_exercises_count:
        Number(pack.metadata?.bac_exercises_count || 0),
      pack,
    };

    setSelectedOffer({
      mode: "chapter",
      subjectPack: scopedSubjectPack,
      chapterPack: pack,
      chapter,
    });
  };

  useEffect(() => {
    if (
      loading ||
      !highlightedChapterId ||
      selectedOffer
    ) {
      return;
    }

    const pack = chapterPacks.find(
      (item) =>
        String(item.target_id) ===
        String(highlightedChapterId),
    );

    if (pack) {
      openChapterPack(pack);
    }
  }, [
    chapterPacks,
    highlightedChapterId,
    loading,
    selectedOffer,
  ]);

  return (
    <div
      dir="rtl"
      className="min-h-full w-full bg-[#f7f8fc]"
    >
      <section className="relative overflow-hidden border-b border-violet-100 bg-white">
        <div className="absolute inset-x-0 top-0 h-[330px] bg-gradient-to-b from-violet-50 via-blue-50/50 to-transparent" />
        <div className="absolute -left-24 top-4 h-64 w-64 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />

        <div className="relative mx-auto max-w-[1500px] px-4 pb-9 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-9">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/80 bg-white/80 px-3.5 text-xs font-black text-slate-600 shadow-sm backdrop-blur transition hover:text-violet-600"
          >
            <ArrowRight size={16} />
            رجوع
          </button>

          <div className="mx-auto mt-7 max-w-3xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-xl shadow-violet-200/80">
              <Crown size={27} />
            </div>

            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-[10px] font-black text-violet-700 shadow-sm">
              <Sparkles size={13} />
              Backey Premium
            </div>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              اختر العرض الذي يناسب طريقة مراجعتك
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-500 sm:text-base">
              يمكنك فتح وحدة واحدة فقط، أو اختيار المادة كاملة بسعر أفضل عندما تريد مراجعة كل البرنامج.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[10px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-100">
                <ShieldCheck size={14} className="text-emerald-600" />
                دفع آمن
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[10px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-100">
                <GraduationCap size={14} className="text-violet-600" />
                تمارين بكالوريا
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[10px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-100">
                <Bot size={14} className="text-blue-600" />
                مساعدة AI
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        {loading && (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-slate-100 bg-white shadow-sm">
            <Loader2 size={34} className="animate-spin text-violet-600" />
            <p className="mt-4 text-sm font-black text-slate-600">
              جاري تجهيز أفضل العروض لك...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="flex min-h-[330px] flex-col items-center justify-center rounded-[28px] border border-red-100 bg-white p-6 text-center shadow-sm">
            <TriangleAlert size={34} className="text-red-500" />
            <p className="mt-4 max-w-xl text-sm font-black leading-7 text-slate-700">
              {error}
            </p>
            <button
              type="button"
              onClick={() =>
                setRefreshKey((current) => current + 1)
              }
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white"
            >
              <RefreshCw size={17} />
              إعادة المحاولة
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-9">
            {subjectPacks.length > 0 && (
              <section>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-violet-600">
                      <Star size={18} fill="currentColor" />
                      <span className="text-[11px] font-black">
                        العرض الأقوى
                      </span>
                    </div>
                    <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                      المادة كاملة
                    </h2>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {subjectPacks.map((pack) => {
                    const isScopedPack =
                      scopedSubjectPack?.id === pack.id;
                    const saving = isScopedPack
                      ? scopedSaving
                      : 0;

                    return (
                      <article
                        key={pack.id}
                        className="group relative overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_15px_45px_rgba(76,29,149,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_60px_rgba(76,29,149,0.14)]"
                      >
                        <div className="relative overflow-hidden bg-gradient-to-l from-violet-700 via-violet-600 to-blue-600 p-5 text-white sm:p-6">
                          <div className="absolute -left-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

                          <div className="relative flex items-start justify-between gap-4">
                            <div>
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-black text-violet-100">
                                <Crown size={12} />
                                المادة كاملة
                              </span>
                              <h3 className="mt-3 text-xl font-black leading-tight">
                                {pack.target_title || pack.name}
                              </h3>
                            </div>

                            {pack.owned && (
                              <BadgeCheck size={27} className="text-emerald-300" />
                            )}
                          </div>

                          <div className="relative mt-6 flex flex-wrap items-end gap-2">
                            <span className="text-3xl font-black">
                              {formatDzd(pack.price_dzd)}
                            </span>
                            {saving > 0 && scopedTotal > Number(pack.price_dzd || 0) && (
                              <span className="pb-1 text-xs font-bold text-violet-200 line-through">
                                {formatDzd(scopedTotal)}
                              </span>
                            )}
                          </div>

                          {saving > 0 && (
                            <p className="relative mt-1 text-[10px] font-black text-emerald-300">
                              توفير {formatDzd(saving)} مقارنة بشراء الوحدات منفردة
                            </p>
                          )}
                        </div>

                        <div className="p-5 sm:p-6">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Benefit icon={BookOpenCheck}>كل الوحدات والمحاور</Benefit>
                            <Benefit icon={GraduationCap}>تمارين وبكالوريا</Benefit>
                            <Benefit icon={Bot}>تمارين مشابهة للبكالوريا</Benefit>
                            <Benefit icon={MessageCircleMore}>مساعد وإعادة شرح</Benefit>
                          </div>

                          <button
                            type="button"
                            disabled={pack.owned}
                            onClick={() => openSubjectPack(pack)}
                            className={`mt-5 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition ${
                              pack.owned
                                ? "cursor-default bg-emerald-50 text-emerald-700"
                                : "bg-slate-950 text-white shadow-lg hover:-translate-y-0.5 hover:bg-violet-700"
                            }`}
                          >
                            {pack.owned ? (
                              <>
                                <Check size={18} />
                                المادة مفعّلة
                              </>
                            ) : (
                              <>
                                اكتشف العرض واشتر الآن
                                <ArrowLeft size={18} />
                              </>
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {chapterPacks.length > 0 && (
              <section>
                <div className="mb-4">
                  <p className="text-[11px] font-black text-violet-600">
                    مرونة أكثر
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                    افتح وحدة واحدة فقط
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500 sm:text-sm">
                    مناسب إذا كنت تحتاج إلى مراجعة جزء محدد من المادة الآن.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {chapterPacks.map((pack) => {
                    const highlighted =
                      String(pack.target_id) ===
                      String(highlightedChapterId);

                    return (
                      <article
                        key={pack.id}
                        className={`relative overflow-hidden rounded-[24px] border bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] ${
                          highlighted
                            ? "border-violet-400 ring-4 ring-violet-100"
                            : "border-slate-200"
                        }`}
                      >
                        {highlighted && (
                          <span className="absolute left-3 top-3 rounded-full bg-violet-600 px-2.5 py-1 text-[9px] font-black text-white">
                            العرض الذي اخترته
                          </span>
                        )}

                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                            <BookOpenCheck size={20} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black text-slate-400">
                              وحدة مستقلة
                            </p>
                            <h3 className="mt-1 line-clamp-2 text-sm font-black leading-6 text-slate-900">
                              {pack.target_title || pack.name}
                            </h3>
                          </div>
                        </div>

                        <div className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400">
                              سعر الوحدة
                            </p>
                            <p className="mt-0.5 text-xl font-black text-slate-950">
                              {formatDzd(pack.price_dzd)}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={pack.owned}
                            onClick={() => openChapterPack(pack)}
                            className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-black transition ${
                              pack.owned
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-violet-600 text-white hover:bg-violet-700"
                            }`}
                          >
                            {pack.owned ? "مفعّلة" : "عرض الوحدة"}
                            {!pack.owned && <ArrowLeft size={15} />}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {packs.length === 0 && (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
                <p className="text-base font-black text-slate-800">
                  لا توجد عروض مفعلة حاليًا
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-400">
                  أضف Packs من لوحة الإدارة أو Swagger وستظهر هنا تلقائيًا.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <PurchaseOfferModal
        open={Boolean(selectedOffer)}
        onClose={() => setSelectedOffer(null)}
        token={token}
        course={{
          id: subjectId,
          name:
            selectedOffer?.subjectPack?.target_title ||
            "المادة",
        }}
        chapter={selectedOffer?.chapter || null}
        chapterPack={selectedOffer?.chapterPack || null}
        subjectPack={selectedOffer?.subjectPack || null}
        chapterPacks={subjectId ? chapterPacks : []}
        defaultMode={selectedOffer?.mode || "chapter"}
      />
    </div>
  );
}
