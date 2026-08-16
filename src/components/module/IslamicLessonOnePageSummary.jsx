// src/components/islamicCourse/IslamicLessonElegant.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Eye,
  GraduationCap,
  Heart,
  Lightbulb,
  Loader2,
  AlertCircle,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  Trophy,
  X,
} from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function arr(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (v === null || v === undefined || v === "") return [];
  return [v];
}

function normalizeLesson(data) {
  return (
    data?.axis?.content ||
    data?.lesson?.content ||
    data?.content ||
    data?.lesson ||
    data ||
    null
  );
}

function normalizeApiPayload(responseData) {
  if (!responseData) return null;

  // أكثر الأشكال شيوعًا في DRF:
  // { axis: {...} }
  // { lesson: {...} }
  // { data: {...} }
  // {...}
  if (responseData?.data) return responseData.data;
  return responseData;
}

function getAccessToken() {
  return (
    Cookies.get("access_token") ||
    Cookies.get("access") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    ""
  );
}

const tone = {
  rose: {
    shell: "from-rose-50 via-white to-orange-50",
    border: "border-rose-200",
    badge: "bg-rose-100 text-rose-800",
    strong: "bg-rose-600",
    text: "text-rose-700",
  },
  violet: {
    shell: "from-violet-50 via-white to-indigo-50",
    border: "border-violet-200",
    badge: "bg-violet-100 text-violet-800",
    strong: "bg-violet-600",
    text: "text-violet-700",
  },
  emerald: {
    shell: "from-emerald-50 via-white to-teal-50",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-800",
    strong: "bg-emerald-700",
    text: "text-emerald-700",
  },
  amber: {
    shell: "from-amber-50 via-white to-yellow-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800",
    strong: "bg-amber-500",
    text: "text-amber-700",
  },
};

function Pill({ children, className = "" }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm",
      className
    )}>
      {children}
    </span>
  );
}

function SoftCard({ children, className = "" }) {
  return (
    <div className={cn(
      "rounded-[26px] border border-white bg-white/90 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,.35)] ring-1 ring-slate-100",
      className
    )}>
      {children}
    </div>
  );
}

function SectionIntro({ eyebrow, title, desc, icon: Icon = Sparkles }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-800 to-teal-600 text-white shadow-lg">
        <Icon size={21} />
      </div>
      <div>
        <p className="text-[11px] font-black tracking-[.18em] text-emerald-700">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-black leading-9 text-slate-950">{title}</h2>
        {desc && <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">{desc}</p>}
      </div>
    </div>
  );
}

function HeroMap({ content }) {
  return (
    <div className="space-y-6">
      <SoftCard className="overflow-hidden bg-gradient-to-l from-emerald-950 via-emerald-900 to-teal-800 text-white ring-0">
        <div className="relative">
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl" />
          <p className="relative text-lg font-black leading-9">{content.hook}</p>
          <p className="relative mt-4 text-sm font-semibold leading-8 text-emerald-50/90">
            {content.big_idea}
          </p>
        </div>
      </SoftCard>

      <div className="relative mx-auto max-w-5xl py-4">
        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-[7px] border-white bg-gradient-to-br from-emerald-800 to-teal-600 px-4 text-center text-base font-black text-white shadow-2xl ring-8 ring-emerald-100">
          {content.visual_map?.center}
        </div>

        <div className="mx-auto mt-8 grid gap-4 md:grid-cols-2">
          {arr(content.visual_map?.branches).map((b, i) => {
            const t = tone[b.tone] || tone.emerald;
            return (
              <div key={i} className={cn(
                "relative overflow-hidden rounded-[28px] border bg-gradient-to-br p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg",
                t.shell,
                t.border
              )}>
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                    {b.emoji}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-950">{b.title}</h3>
                    <p className="mt-2 text-sm font-bold leading-7 text-slate-600">{b.subtitle}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <SoftCard className="border-amber-200 bg-gradient-to-l from-amber-50 via-white to-emerald-50">
        <p className="text-center text-xs font-black text-amber-700">السلسلة الذهبية</p>
        <p className="mt-3 text-center text-base font-black leading-9 text-slate-950">
          {content.memory_phrase}
        </p>
      </SoftCard>
    </div>
  );
}

function Concept({ content }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {arr(content.cards).map((c, i) => (
          <SoftCard key={i} className="border-violet-100">
            <div className="flex items-center gap-3">
              <Brain className="text-violet-600" size={20}/>
              <h3 className="font-black text-slate-950">{c.title}</h3>
            </div>
            <p className="mt-3 text-sm font-semibold leading-8 text-slate-700">{c.text}</p>
            {c.memory && (
              <div className="mt-4 rounded-2xl bg-violet-50 p-3 text-xs font-black text-violet-800">
                🧠 {c.memory}
              </div>
            )}
          </SoftCard>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {arr(content.importance).map((item, i) => (
          <div key={i} className="rounded-[24px] border border-slate-200 bg-white p-4 text-center shadow-sm">
            <div className="text-3xl">{item.icon}</div>
            <div className="mt-2 font-black text-slate-950">{item.title}</div>
            <p className="mt-2 text-xs font-semibold leading-6 text-slate-600">{item.text}</p>
          </div>
        ))}
      </div>

      {content.quick_recall && (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 text-center font-black text-emerald-900">
          {content.quick_recall}
        </div>
      )}
    </div>
  );
}

function MemoryFamily({ content }) {
  const t = tone[content.family_color] || tone.emerald;
  return (
    <div className="space-y-5">
      <div className={cn("rounded-[30px] border bg-gradient-to-br p-5", t.shell, t.border)}>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-4xl shadow-sm">
            {content.family_emoji}
          </div>
          <div>
            <Pill className={cn("border-0", t.badge)}>باب الحفظ</Pill>
            <h3 className="mt-2 text-2xl font-black text-slate-950">{content.family}</h3>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {arr(content.items).map((item) => (
          <div key={item.number} className="group overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="grid md:grid-cols-[120px_1fr]">
              <div className={cn("flex flex-col items-center justify-center p-5 text-white", t.strong)}>
                <span className="text-xs font-black opacity-80">المفتاح</span>
                <span className="mt-2 text-2xl font-black">{item.keyword}</span>
                <span className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-black">
                  {item.number}
                </span>
              </div>

              <div className="p-5">
                <h4 className="text-lg font-black text-slate-950">{item.title}</h4>
                <p className="mt-2 text-sm font-semibold leading-8 text-slate-700">{item.simple}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm font-black leading-7 text-slate-700">
                    <span className="text-slate-400">المسار:</span> {item.formula}
                  </div>
                  <div className={cn("rounded-2xl p-3 text-sm font-bold leading-7", t.badge)}>
                    <span className="font-black">أتعرف عليها عندما:</span> {item.recognize}
                  </div>
                </div>

                {item.evidence && (
                  <div className="mt-4 rounded-[22px] border border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-4">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-700">
                      <BookOpen size={15}/> دليل
                    </div>
                    <p className="mt-3 text-center text-base font-black leading-9 text-slate-950">
                      {item.evidence.text}
                    </p>
                    <p className="mt-1 text-center text-xs font-black text-emerald-700">
                      {item.evidence.reference}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {content.mini_test && (
        <div className={cn("rounded-[22px] border p-4 text-sm font-black", t.border, t.badge)}>
          ⚡ اختبار 10 ثوانٍ: {content.mini_test}
        </div>
      )}
    </div>
  );
}

function Comparison({ content }) {
  return (
    <div className="space-y-4">
      {arr(content.pairs).map((p, i) => (
        <div key={i} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-2xl bg-emerald-50 p-4 text-center">
              <div className="text-xs font-black text-emerald-600">{p.a_key}</div>
              <div className="mt-1 font-black text-emerald-950">{p.a}</div>
            </div>
            <div className="text-center text-xl font-black text-slate-300">VS</div>
            <div className="rounded-2xl bg-amber-50 p-4 text-center">
              <div className="text-xs font-black text-amber-600">{p.b_key}</div>
              <div className="mt-1 font-black text-amber-950">{p.b}</div>
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold leading-8 text-slate-700">{p.difference}</p>
        </div>
      ))}

      <SoftCard className="border-violet-200 bg-violet-50">
        <div className="flex items-start gap-3">
          <CircleHelp className="mt-1 shrink-0 text-violet-700" size={20}/>
          <p className="text-sm font-black leading-8 text-violet-950">{content.golden_question}</p>
        </div>
      </SoftCard>
    </div>
  );
}

function ExamMethod({ content }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        {arr(content.steps).map((s) => (
          <div key={s.n} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">{s.n}</div>
            <div className="mt-3 font-black text-slate-950">{s.title}</div>
            <p className="mt-2 text-xs font-semibold leading-6 text-slate-600">{s.text}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-5">
        <p className="text-xs font-black text-emerald-700">قالب الجواب</p>
        <p className="mt-2 text-lg font-black text-slate-950">{content.answer_template}</p>
      </div>

      <div className="overflow-hidden rounded-[26px] border border-slate-200">
        {arr(content.clues).map((r, i) => (
          <div key={i} className={cn("grid gap-2 p-4 sm:grid-cols-2", i % 2 ? "bg-slate-50" : "bg-white")}>
            <div className="text-sm font-semibold text-slate-600">{r.clue}</div>
            <div className="text-sm font-black text-emerald-800">← {r.answer}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Flashcards({ content }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cards = arr(content.cards);
  const card = cards[index];

  if (!card) return null;

  function go(delta) {
    setIndex((v) => Math.max(0, Math.min(cards.length - 1, v + delta)));
    setFlipped(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between text-xs font-black text-slate-500">
        <span>بطاقة {index + 1} / {cards.length}</span>
        <span>حاول الإجابة قبل القلب</span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className={cn(
          "relative flex min-h-[330px] w-full items-center justify-center overflow-hidden rounded-[34px] border p-8 text-center shadow-[0_28px_80px_-45px_rgba(15,23,42,.5)] transition duration-500",
          flipped
            ? "border-emerald-200 bg-gradient-to-br from-emerald-800 to-teal-700 text-white"
            : "border-amber-200 bg-gradient-to-br from-white via-amber-50 to-emerald-50 text-slate-950"
        )}
      >
        <div>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-sm">
            {flipped ? <CheckCircle2 className="text-emerald-700"/> : <Brain className="text-amber-600"/>}
          </div>
          <p className="text-xs font-black opacity-70">{flipped ? "الإجابة" : "السؤال"}</p>
          <p className="mt-4 text-xl font-black leading-10">{flipped ? card.back : card.front}</p>
          <p className="mt-6 text-xs font-bold opacity-60">اضغط لقلب البطاقة</p>
        </div>
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
        >
          السابق
        </button>
        <button
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
        >
          التالي
        </button>
      </div>
    </div>
  );
}

function Summary({ content }) {
  return (
    <div className="space-y-5">
      <SoftCard className="border-violet-200 bg-violet-50">
        <div className="text-xs font-black text-violet-700">التعريف</div>
        <div className="mt-2 text-lg font-black text-violet-950">{content.definition}</div>
      </SoftCard>

      <div className="grid gap-4 md:grid-cols-2">
        {arr(content.families).map((f, i) => (
          <SoftCard key={i}>
            <h3 className="font-black text-slate-950">{f.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {arr(f.items).map((x) => <Pill key={x}>{x}</Pill>)}
            </div>
          </SoftCard>
        ))}
      </div>

      <SoftCard className="border-amber-200 bg-gradient-to-l from-amber-50 via-white to-emerald-50">
        <div className="text-center text-xs font-black text-amber-700">السلسلة الذهبية</div>
        <div className="mt-3 text-center text-lg font-black leading-9 text-slate-950">{content.chain}</div>
      </SoftCard>

      <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-sm font-black leading-8 text-emerald-950">
        🎓 {content.exam_rule}
      </div>
    </div>
  );
}

function Quiz({ content }) {
  const questions = arr(content.questions);
  const [open, setOpen] = useState({});
  const [mastered, setMastered] = useState({});

  const score = Object.values(mastered).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={q.id || i} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">{i + 1}</span>
            <p className="text-sm font-black leading-8 text-slate-950">{q.question}</p>
          </div>

          <button
            onClick={() => setOpen((v) => ({ ...v, [q.id]: !v[q.id] }))}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800"
          >
            <Eye size={14}/> {open[q.id] ? "إخفاء" : "إظهار الإجابة"}
          </button>

          {open[q.id] && (
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
              <p className="text-sm font-semibold leading-7 text-emerald-950">{q.answer}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setMastered((v) => ({ ...v, [q.id]: true }))}
                  className={cn("rounded-xl px-3 py-2 text-xs font-black", mastered[q.id] ? "bg-emerald-700 text-white" : "bg-white text-emerald-700")}
                >
                  <Check size={13} className="inline ml-1"/> حفظتها
                </button>
                <button
                  onClick={() => setMastered((v) => ({ ...v, [q.id]: false }))}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700"
                >
                  <X size={13} className="inline ml-1"/> أراجعها
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black text-amber-700">الاسترجاع</div>
            <div className="mt-1 text-3xl font-black text-amber-950">{score}/{questions.length}</div>
          </div>
          <button
            onClick={() => { setOpen({}); setMastered({}); }}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-700"
          >
            <RotateCcw size={14}/> إعادة
          </button>
        </div>
        {content.mastery && <p className="mt-3 text-sm font-bold leading-7 text-amber-900">{content.mastery}</p>}
      </div>
    </div>
  );
}


function LessonLoadingState() {
  return (
    <main
      dir="rtl"
      className="flex min-h-[560px] items-center justify-center bg-[radial-gradient(circle_at_top_right,#d1fae5_0%,transparent_28%),linear-gradient(180deg,#fbfffd_0%,#f8fafc_100%)] p-5"
    >
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] border border-emerald-100 bg-white shadow-xl">
          <Loader2
            size={38}
            className="animate-spin text-emerald-700"
          />
        </div>

        <h2 className="mt-5 text-lg font-black text-slate-950">
          جاري تحميل الدرس...
        </h2>

        <p className="mt-2 text-sm font-semibold text-slate-500">
          نحضر الخريطة الذهنية ومراحل الحفظ
        </p>
      </div>
    </main>
  );
}

function LessonErrorState({ message, onRetry }) {
  return (
    <main
      dir="rtl"
      className="flex min-h-[560px] items-center justify-center bg-[#f8fafc] p-5"
    >
      <div className="w-full max-w-lg rounded-[30px] border border-rose-100 bg-white p-7 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
          <AlertCircle
            size={30}
            className="text-rose-600"
          />
        </div>

        <h2 className="mt-4 text-xl font-black text-slate-950">
          تعذر عرض الدرس
        </h2>

        <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
          {message}
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-800 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-900"
        >
          <RefreshCcw size={17} />
          إعادة المحاولة
        </button>
      </div>
    </main>
  );
}

const stepMeta = {
  hero_map: ["الخريطة الكبرى", Sparkles],
  concept: ["الفهم", BookOpen],
  memory_family: ["الحفظ البصري", Brain],
  comparison: ["التمييز", Target],
  exam_method: ["البكالوريا", GraduationCap],
  flashcards: ["الاسترجاع", Heart],
  summary: ["المراجعة", Star],
  quiz: ["الإتقان", Trophy],
};

export default function IslamicLessonElegant({
  axisId: axisIdProp,
  endpoint,
}) {
  const { axisId: routeAxisId } = useParams();

  const resolvedAxisId = axisIdProp || routeAxisId;
  const API_BASE_URL = import.meta.env.VITE_BASE_URL || "";

  const [lessonData, setLessonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);

  const fetchLesson = useCallback(async () => {
    if (!resolvedAxisId) {
      setLessonData(null);
      setError("معرف المحور غير موجود.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const token = getAccessToken();

      // إذا كان endpoint يمرر من الأب نستعمله،
      // وإلا نستعمل مسار الدرس الافتراضي.
      const lessonUrl =
        typeof endpoint === "function"
          ? endpoint(resolvedAxisId)
          : endpoint ||
            `${API_BASE_URL}/api/axes/${resolvedAxisId}/lesson/`;

      const response = await axios.get(lessonUrl, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      const normalized = normalizeApiPayload(response.data);

      if (!normalized) {
        throw new Error("EMPTY_LESSON_RESPONSE");
      }

      setLessonData(normalized);
    } catch (requestError) {
      console.error("Islamic lesson request error:", requestError);
      setLessonData(null);

      if (requestError?.response?.status === 401) {
        setError("انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول من جديد.");
      } else if (requestError?.response?.status === 404) {
        setError("لا يوجد درس محفوظ لهذا المحور.");
      } else if (requestError?.response?.status === 403) {
        setError("ليس لديك صلاحية لعرض هذا الدرس.");
      } else {
        setError(
          requestError?.response?.data?.detail ||
            requestError?.response?.data?.message ||
            "تعذر تحميل الدرس. تحقق من اتصال الخادم ثم حاول من جديد."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, endpoint, resolvedAxisId]);

  useEffect(() => {
    fetchLesson();
  }, [fetchLesson]);

  const lesson = useMemo(
    () => normalizeLesson(lessonData),
    [lessonData]
  );

  const steps = useMemo(
    () => arr(lesson?.learning_path),
    [lesson]
  );

  useEffect(() => {
    setPage(0);
  }, [resolvedAxisId, lesson?.axis_tag, lesson?.title]);

  if (loading) {
    return <LessonLoadingState />;
  }

  if (error) {
    return (
      <LessonErrorState
        message={error}
        onRetry={fetchLesson}
      />
    );
  }

  if (!lesson) {
    return (
      <LessonErrorState
        message="تم جلب البيانات لكن محتوى الدرس غير موجود."
        onRetry={fetchLesson}
      />
    );
  }

  if (!steps.length) {
    return (
      <LessonErrorState
        message="الدرس موجود، لكن learning_path فارغ."
        onRetry={fetchLesson}
      />
    );
  }

  const safePage = Math.min(page, steps.length - 1);
  const current = steps[safePage];
  const [stageLabel, StageIcon] = stepMeta[current?.type] || ["الدرس", BookOpen];
  const progress = steps.length ? Math.round(((safePage + 1) / steps.length) * 100) : 0;

  function renderStep() {
    if (!current) return null;
    switch (current.type) {
      case "hero_map": return <HeroMap content={current.content} />;
      case "concept": return <Concept content={current.content} />;
      case "memory_family": return <MemoryFamily content={current.content} />;
      case "comparison": return <Comparison content={current.content} />;
      case "exam_method": return <ExamMethod content={current.content} />;
      case "flashcards": return <Flashcards content={current.content} />;
      case "summary": return <Summary content={current.content} />;
      case "quiz": return <Quiz content={current.content} />;
      default: return null;
    }
  }

  return (
    <section
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,#d1fae5_0%,transparent_28%),radial-gradient(circle_at_bottom_left,#fef3c7_0%,transparent_25%),linear-gradient(180deg,#fbfffd_0%,#f8fafc_55%,#fffdf6_100%)] px-3 py-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-5 overflow-hidden rounded-[34px] border border-white bg-white/95 shadow-[0_25px_90px_-48px_rgba(15,23,42,.45)] ring-1 ring-emerald-100">
          <div className="h-1.5 bg-gradient-to-l from-emerald-900 via-emerald-600 to-amber-400" />
          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Pill className="border-emerald-100 bg-emerald-50 text-emerald-800">
                    <BookOpen size={14} className="ml-2"/>
                    {lesson.chapter_title}
                  </Pill>
                  <Pill className="border-amber-100 bg-amber-50 text-amber-800">
                    الوحدة {lesson.unit_number}
                  </Pill>
                  <Pill className="border-violet-100 bg-violet-50 text-violet-800">
                    هدفنا 20/20
                  </Pill>
                </div>

                <h1 className="mt-4 max-w-4xl text-2xl font-black leading-[1.6] text-slate-950 sm:text-4xl">
                  {lessonData?.axis?.title || lessonData?.lesson?.title || lessonData?.title || lesson.title || "درس العلوم الإسلامية"}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-black text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <StageIcon size={15} className="text-emerald-700"/>
                    {stageLabel}
                  </span>
                  <span>•</span>
                  <span>{safePage + 1} / {steps.length}</span>
                  <span>•</span>
                  <span>{lesson.estimated_minutes} دقيقة تقريبًا</span>
                </div>
              </div>

              <div className="min-w-[210px] rounded-[28px] border border-emerald-100 bg-gradient-to-l from-emerald-50 to-amber-50 p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400">التقدم</p>
                    <p className="mt-1 text-3xl font-black text-slate-950">{progress}%</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-lg">
                    <Trophy size={20}/>
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-gradient-to-l from-emerald-800 to-amber-400 transition-all duration-500" style={{width: `${progress}%`}} />
                </div>
              </div>
            </div>
          </div>
        </header>

        <article className="rounded-[34px] border border-white bg-white/95 p-5 shadow-[0_30px_100px_-55px_rgba(15,23,42,.40)] ring-1 ring-slate-100 sm:p-7">
          <SectionIntro
            eyebrow={stageLabel}
            title={current?.title}
            desc={current?.type === "flashcards" ? "لا تعيد القراءة. حاول الاسترجاع من الذاكرة أولًا." : ""}
            icon={StageIcon}
          />
          {renderStep()}
        </article>

        <div className="sticky bottom-3 z-20 mt-5 rounded-[26px] border border-white bg-white/95 p-3 shadow-[0_18px_70px_-36px_rgba(15,23,42,.5)] ring-1 ring-emerald-100 backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <button
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <ArrowRight size={18}/> السابق
            </button>

            <div className="order-first col-span-2 text-center sm:order-none sm:col-span-1">
              <div className="flex max-w-[520px] gap-2 overflow-x-auto px-2 pb-1">
                {steps.map((s, i) => (
                  <button
                    key={s.id || i}
                    onClick={() => setPage(i)}
                    className={cn(
                      "h-2.5 shrink-0 rounded-full transition-all",
                      i === safePage ? "w-10 bg-emerald-700" : i < safePage ? "w-5 bg-emerald-300" : "w-5 bg-slate-200"
                    )}
                    title={s.title}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => setPage(Math.min(steps.length - 1, safePage + 1))}
              disabled={safePage === steps.length - 1}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-800 to-teal-700 px-4 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              التالي <ArrowLeft size={18}/>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
