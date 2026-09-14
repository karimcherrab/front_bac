import { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import { UserContext } from "../../Utils/UserContext";

const RAW_API_BASE_URL = import.meta.env.VITE_BASE_URL || "";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");
const MEMORY_BASE_URL = `${API_BASE_URL}/api/bac/memory`;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getErrorMessage(error, fallback) {
  if (error?.code === "ERR_NETWORK") return "تعذر الاتصال بالخادم. تأكد من تشغيل Django.";
  if (error?.response?.status === 401) return "انتهت صلاحية تسجيل الدخول. سجّل الدخول من جديد.";
  return error?.response?.data?.detail || error?.response?.data?.message || fallback;
}

function ScoreBadge({ percentage = 0 }) {
  const value = Number(percentage) || 0;
  const cls = value >= 85
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : value >= 55
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-rose-50 text-rose-700 border-rose-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${cls}`}>
      {Math.round(value)}%
    </span>
  );
}

function FeedbackList({ icon: Icon, title, items, className }) {
  const safeItems = asArray(items).filter(Boolean);
  if (!safeItems.length) return null;

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2 font-bold">
        <Icon className="h-5 w-5" />
        <span>{title}</span>
      </div>
      <ul className="space-y-2 text-sm leading-7">
        {safeItems.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CorrectionCard({ correction }) {
  const data = asObject(correction);
  if (!Object.keys(data).length) return null;

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">تصحيح الذكاء الاصطناعي</div>
          <h3 className="mt-1 text-lg font-black text-slate-900">تحليل إجابتك</h3>
        </div>
        <ScoreBadge percentage={data.percentage} />
      </div>

      <p className="rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-7 text-slate-700">
        {data.feedback || "تم تصحيح الإجابة."}
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        <FeedbackList
          icon={CheckCircle2}
          title="ما أجبت عنه جيدًا"
          items={data.correct_points}
          className="border-emerald-200 bg-emerald-50 text-emerald-800"
        />
        <FeedbackList
          icon={AlertCircle}
          title="ما يجب إضافته"
          items={data.missing_points}
          className="border-amber-200 bg-amber-50 text-amber-800"
        />
        <FeedbackList
          icon={XCircle}
          title="الأخطاء أو الخلط"
          items={data.incorrect_points}
          className="border-rose-200 bg-rose-50 text-rose-800"
        />
      </div>

      {data.improved_answer && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="mb-2 flex items-center gap-2 font-bold text-indigo-800">
            <Sparkles className="h-5 w-5" />
            إجابة نموذجية محسّنة
          </div>
          <p className="whitespace-pre-wrap text-sm leading-8 text-indigo-950">{data.improved_answer}</p>
        </div>
      )}
    </div>
  );
}

function CompletedView({ session, onRestart, restarting }) {
  const answers = asArray(session?.answers);
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Target className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">اكتمل اختبار الحفظ</h2>
            <p className="mt-2 text-sm text-slate-600">راجع النقاط الناقصة ثم أعد الاختبار حتى تصل إلى إتقان ثابت.</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black text-emerald-700">{Math.round(Number(session?.percentage) || 0)}%</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              {Number(session?.score || 0).toFixed(1)} / {Number(session?.max_score || 0).toFixed(1)}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRestart}
          disabled={restarting}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {restarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          اختبار جديد
        </button>
      </div>

      <div className="space-y-3">
        {answers.map((item, index) => {
          const correction = asObject(item.correction);
          return (
            <div key={`${item.question_key}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-black text-slate-900">السؤال {index + 1}</span>
                <ScoreBadge percentage={correction.percentage} />
              </div>
              <p className="text-sm leading-7 text-slate-700">{item?.question_snapshot?.prompt}</p>
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-7 text-slate-600">
                <span className="font-bold">إجابتك: </span>{item.student_answer}
              </p>
              {asArray(correction.missing_points).length > 0 && (
                <div className="mt-3 text-sm leading-7 text-amber-800">
                  <span className="font-bold">راجع: </span>{correction.missing_points.join("، ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function IslamicMemoryTestPage({
  chapterId,
  branchCode,
  onTutorQuestionChange,
  onTutorViewStateChange,
}) {
  const { token } = useContext(UserContext);
  const [session, setSession] = useState(null);
  const [answer, setAnswer] = useState("");
  const [correction, setCorrection] = useState(null);
  const [reviewedQuestion, setReviewedQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = useMemo(
    () => token ? { Authorization: `Bearer ${token}` } : {},
    [token],
  );

  const currentQuestion = asObject(session?.current_question);
  const displayedQuestion = correction ? asObject(reviewedQuestion) : currentQuestion;
  const progress = session?.question_count
    ? Math.round((Number(session.answered_count || 0) / Number(session.question_count)) * 100)
    : 0;

  async function startNewTest() {
    if (!token || !Number(chapterId) || !branchCode) {
      setError("يجب تسجيل الدخول وتحديد الوحدة والشعبة.");
      return;
    }
    try {
      setStarting(true);
      setError("");
      setCorrection(null);
      setReviewedQuestion(null);
      setAnswer("");
      const response = await axios.post(
        `${MEMORY_BASE_URL}/start/`,
        {
          chapter_id: Number(chapterId),
          branch_code: branchCode,
          question_count: 6,
        },
        { headers: { ...authHeaders, "Content-Type": "application/json" }, timeout: 120000 },
      );
      setSession(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "تعذر إنشاء اختبار الحفظ."));
    } finally {
      setStarting(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || !Number(chapterId)) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await axios.get(`${MEMORY_BASE_URL}/active/`, {
          params: { chapter_id: Number(chapterId) },
          headers: authHeaders,
          timeout: 30000,
        });
        if (cancelled) return;
        if (response.data?.session) {
          setSession(response.data.session);
        } else {
          await startNewTest();
        }
      } catch (requestError) {
        if (!cancelled) setError(getErrorMessage(requestError, "تعذر تحميل اختبار الحفظ."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // الاختبار يُبنى في Django من course_axis حسب chapter_id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, chapterId, branchCode]);

  useEffect(() => {
    if (!displayedQuestion?.id) {
      onTutorQuestionChange?.(null);
      return;
    }
    onTutorQuestionChange?.({
      id: displayedQuestion.id,
      title: displayedQuestion.skill || "اختبار الحفظ",
      text: displayedQuestion.prompt || "",
    });
  }, [displayedQuestion?.id, displayedQuestion?.prompt, displayedQuestion?.skill, onTutorQuestionChange]);

  useEffect(() => {
    onTutorViewStateChange?.({
      memory_test: true,
      correction_visible: Boolean(correction),
      solution_visible: Boolean(correction),
    });
  }, [correction, onTutorViewStateChange]);

  async function submitAnswer() {
    if (!text(answer)) {
      setError("اكتب إجابتك أولًا.");
      return;
    }
    if (!session?.id || submitting) return;

    try {
      setSubmitting(true);
      setError("");
      setReviewedQuestion(currentQuestion);
      const response = await axios.post(
        `${MEMORY_BASE_URL}/${session.id}/answer/`,
        { answer },
        { headers: { ...authHeaders, "Content-Type": "application/json" }, timeout: 120000 },
      );
      setSession(response.data.session);
      setCorrection(response.data.correction || null);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "تعذر تصحيح الإجابة."));
    } finally {
      setSubmitting(false);
    }
  }

  function goNextQuestion() {
    setCorrection(null);
    setReviewedQuestion(null);
    setAnswer("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-[420px] items-center justify-center rounded-3xl bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="mt-3 text-sm font-bold text-slate-600">جاري تجهيز اختبار الحفظ...</p>
        </div>
      </div>
    );
  }

  if (session?.status === "completed" && !correction) {
    return (
      <main dir="rtl" className="min-h-full bg-slate-100 px-3 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
          <CompletedView session={session} onRestart={startNewTest} restarting={starting} />
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-full bg-slate-100 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-indigo-600 via-violet-600 to-purple-600 p-5 text-white sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <Brain className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-indigo-100">مواد الحفظ · العلوم الإسلامية</div>
                  <h1 className="mt-1 text-2xl font-black">اختبر حفظك</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-indigo-100">
                    أجب من ذاكرتك. سيصحح AI المعنى، ويخبرك بما أصبت فيه وما نسيته وما يجب إضافته.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={startNewTest}
                disabled={starting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-60"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                اختبار جديد
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>التقدم</span>
              <span>{session?.answered_count || 0} / {session?.question_count || 0}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        {displayedQuestion?.id && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">{displayedQuestion.skill || "استرجاع"}</span>
                <span>{displayedQuestion.source_kind || "الدرس"}</span>
                {displayedQuestion.source_axis_title && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                    {displayedQuestion.source_axis_title}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-slate-400">
                السؤال {correction ? Number(session.current_index || 1) : Number(session.current_index || 0) + 1} من {session.question_count}
              </span>
            </div>

            <h2 className="text-xl font-black leading-9 text-slate-900 sm:text-2xl">
              {displayedQuestion.prompt}
            </h2>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-black text-slate-700">اكتب إجابتك من ذاكرتك</label>
              <textarea
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                disabled={Boolean(correction) || submitting}
                rows={7}
                placeholder="اكتب ما تتذكره هنا..."
                className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base leading-8 text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-70"
              />
            </div>

            {!correction ? (
              <button
                type="button"
                onClick={submitAnswer}
                disabled={submitting || !text(answer)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                صحّح إجابتي
              </button>
            ) : (
              <button
                type="button"
                onClick={goNextQuestion}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-black text-white transition hover:bg-slate-800 sm:w-auto"
              >
                السؤال التالي
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </section>
        )}

        <CorrectionCard correction={correction} />
      </div>
    </main>
  );
}
