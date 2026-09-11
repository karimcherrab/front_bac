import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import {
  AlertTriangle,
  Bot,
  BookOpen,
  BrainCircuit,
  ChevronDown,
  Lightbulb,
  Loader2,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import ChatMessage from "./ChatMessage";
import { UserContext } from "../Utils/UserContext";
import { useTutorPageContext } from "../Utils/TutorPageContext";

const API_BASE_URL = String(
  import.meta.env.VITE_BASE_URL || "",
).replace(/\/$/, "");

const URL_TUTOR_CHAT = `${API_BASE_URL}/api/tutor-chat/chat/`;
const getSessionUrl = (chapterId) =>
  `${API_BASE_URL}/api/tutor-chat/sessions/current/${chapterId}/`;
const getCloseSessionUrl = (sessionId) =>
  `${API_BASE_URL}/api/tutor-chat/sessions/${sessionId}/close/`;

function getCurrentTime() {
  return new Date().toLocaleTimeString("ar-DZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createLocalMessage({
  from,
  text,
  type = "message",
  metadata = {},
}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    from,
    text,
    type,
    time: getCurrentTime(),
    metadata,
  };
}

function getApiErrorMessage(error) {
  if (!error?.response) {
    if (error?.code === "ERR_NETWORK") {
      return "تعذر الاتصال بالخادم. تأكد من تشغيل Django ومن إعدادات CORS.";
    }
    return error?.message || "حدث خطأ أثناء الاتصال بالمساعد الذكي.";
  }

  const status = error.response.status;
  const data = error.response.data;

  if (typeof data === "string" && data.trim()) return data;
  if (data?.error) return data.error;
  if (data?.detail) return data.detail;

  for (const key of [
    "question",
    "chapter_id",
    "session_id",
    "page_context",
  ]) {
    if (data?.[key]) {
      return Array.isArray(data[key])
        ? data[key].join(" ")
        : String(data[key]);
    }
  }

  if (status === 400) return "الطلب غير صالح. تحقق من سياق الصفحة والسؤال.";
  if (status === 401) return "انتهت جلسة تسجيل الدخول. سجّل الدخول من جديد.";
  if (status === 403) return "لا تملك صلاحية استعمال المساعد الذكي.";
  if (status === 404) return "الجلسة أو الفصل المطلوب غير موجود.";
  if (status === 502) return "تعذر الحصول على إجابة من نموذج الذكاء الاصطناعي.";
  if (status >= 500) return "حدث خطأ في الخادم أثناء معالجة السؤال.";

  return "حدث خطأ غير متوقع أثناء إرسال السؤال.";
}

function normalizeMessage(item, index, sessionId) {
  const role = String(
    item?.role ||
      item?.sender ||
      item?.from ||
      item?.message_type ||
      "",
  ).toLowerCase();

  const from = ["user", "student", "human"].includes(role)
    ? "user"
    : "bot";

  const text =
    item?.content ??
    item?.text ??
    item?.message ??
    item?.answer ??
    item?.question ??
    "";

  if (!String(text).trim()) return null;

  const createdAt =
    item?.created_at ||
    item?.timestamp ||
    item?.date ||
    null;

  return {
    id: item?.id || `${sessionId || "session"}-${index}`,
    from,
    text: String(text),
    type: item?.type || "message",
    time: createdAt
      ? new Date(createdAt).toLocaleTimeString("ar-DZ", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : getCurrentTime(),
    metadata: {
      ...(item?.metadata || {}),
      contextSnapshot: item?.context_snapshot || null,
    },
  };
}

function ContextChip({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  };

  if (!value) return null;

  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 ${tones[tone]}`}
      title={`${label}: ${value}`}
    >
      <Icon size={12} className="shrink-0" />
      <span className="max-w-[150px] truncate text-[10px] font-black">
        {value}
      </span>
    </div>
  );
}

export default function ChatPanel({
  collapsed,
  setCollapsed,
  chapterId = 0,
  currentChapter = null,
  chapterTitle = "الدرس الحالي",
}) {
  const { token } = useContext(UserContext);
  const {
    pageContext,
    transportContext,
    clearSelection,
  } = useTutorPageContext();

  const resolvedChapterId = Number(
    currentChapter?.id ?? currentChapter ?? chapterId ?? 0,
  );

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [lastResponseInfo, setLastResponseInfo] = useState(null);
  const [contextExpanded, setContextExpanded] = useState(false);

  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const sessionControllerRef = useRef(null);
  const chatControllerRef = useRef(null);

  const resolvedTitle =
    lastResponseInfo?.chapterTitle ||
    pageContext?.chapter_title ||
    chapterTitle;

  const activeAxisTitle =
    pageContext?.axis_title ||
    lastResponseInfo?.axisTitle ||
    "";

  const activeSectionTitle =
    pageContext?.section_title ||
    lastResponseInfo?.sectionTitle ||
    "";

  const activeExerciseTitle =
    pageContext?.exercise?.title ||
    lastResponseInfo?.exercise?.title ||
    (pageContext?.exercise ? "التمرين المفتوح" : "");

  const activeQuestionTitle =
    pageContext?.question?.title ||
    (pageContext?.question?.number
      ? `السؤال ${pageContext.question.number}`
      : "") ||
    lastResponseInfo?.question?.title ||
    (lastResponseInfo?.question?.number
      ? `السؤال ${lastResponseInfo.question.number}`
      : "");

  const activeStepTitle =
    pageContext?.step?.title ||
    (pageContext?.step?.number
      ? `الخطوة ${pageContext.step.number}`
      : "") ||
    lastResponseInfo?.step?.title ||
    (lastResponseInfo?.step?.number
      ? `الخطوة ${lastResponseInfo.step.number}`
      : "");

  const quickActions = useMemo(() => {
    const actions = [];

    if (pageContext?.step || pageContext?.selection) {
      actions.push({
        label: "اشرح هذه الخطوة",
        icon: BrainCircuit,
      });
    }

    if (pageContext?.question) {
      actions.push({
        label: "ما الفكرة المطلوبة في هذا السؤال؟",
        icon: Target,
      });
    }

    if (pageContext?.exercise) {
      actions.push(
        { label: "أعطني تلميحًا فقط", icon: Lightbulb },
        { label: "أين يمكن أن أخطئ هنا؟", icon: AlertTriangle },
      );
    }

    actions.push({ label: "اختبرني بسؤال قصير", icon: Target });
    return actions.slice(0, 4);
  }, [
    pageContext?.exercise,
    pageContext?.question,
    pageContext?.selection,
    pageContext?.step,
  ]);

  const normalizeSessionMessages = useCallback((data) => {
    const session = data?.session || (data?.id ? data : null);
    const rawMessages =
      data?.messages ||
      data?.history ||
      session?.messages ||
      session?.history ||
      [];

    if (Array.isArray(rawMessages)) {
      return rawMessages
        .map((item, index) =>
          normalizeMessage(item, index, session?.id),
        )
        .filter(Boolean);
    }

    return [];
  }, []);

  const loadChapterSession = useCallback(async () => {
    sessionControllerRef.current?.abort();

    setSessionId(null);
    setMessages([]);
    setLastResponseInfo(null);

    if (!resolvedChapterId || !token) return;

    setInitialLoading(true);
    const controller = new AbortController();
    sessionControllerRef.current = controller;

    try {
      const response = await axios.get(
        getSessionUrl(resolvedChapterId),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        },
      );

      const data = response.data || {};
      const session = data?.session || (data?.id ? data : null);

      if (!session?.id) return;

      setSessionId(session.id);
      setMessages(normalizeSessionMessages(data));

      setLastResponseInfo({
        mode: session.metadata?.mode || "",
        intent: session.current_intent || "",
        model: session.metadata?.model || "",
        chapterTitle: session.chapter_title || "",
        axisId: session.axis_id ?? null,
        axisTag: session.axis_tag || "",
        axisTitle: session.axis_title || "",
        sectionTitle: session.context_snapshot?.section?.title || "",
        exercise: session.context_snapshot?.exercise || null,
        question: session.context_snapshot?.question || null,
        step: session.context_snapshot?.step || null,
        studentLevel: session.metadata?.student_level || "",
        masteryScore: session.metadata?.mastery_score ?? null,
        recentMistakesCount:
          session.metadata?.recent_mistakes_count ?? 0,
        suggestions: [],
      });
    } catch (error) {
      if (
        axios.isCancel(error) ||
        error?.code === "ERR_CANCELED"
      ) {
        return;
      }

      const errorMessage = createLocalMessage({
        from: "bot",
        type: "error",
        text: getApiErrorMessage(error),
      });
      setMessages([errorMessage]);
    } finally {
      if (sessionControllerRef.current === controller) {
        sessionControllerRef.current = null;
      }
      setInitialLoading(false);
    }
  }, [resolvedChapterId, token, normalizeSessionMessages]);

  useEffect(() => {
    loadChapterSession();
  }, [loadChapterSession]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, initialLoading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);

  useEffect(() => {
    return () => {
      sessionControllerRef.current?.abort();
      chatControllerRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    async (text) => {
      const trimmedQuestion = String(text || "").trim();
      if (!trimmedQuestion || loading) return;

      if (!token) {
        setMessages((previous) => [
          ...previous,
          createLocalMessage({
            from: "bot",
            type: "error",
            text: "يجب تسجيل الدخول أولًا لاستعمال المساعد الذكي.",
          }),
        ]);
        return;
      }

      if (!resolvedChapterId) {
        setMessages((previous) => [
          ...previous,
          createLocalMessage({
            from: "bot",
            type: "error",
            text: "لم يتم تحديد الفصل الدراسي.",
          }),
        ]);
        return;
      }

      setMessages((previous) => [
        ...previous,
        createLocalMessage({
          from: "user",
          text: trimmedQuestion,
          metadata: {
            pageContext: transportContext,
          },
        }),
      ]);

      setDraft("");
      setLoading(true);

      const controller = new AbortController();
      chatControllerRef.current = controller;

      const requestPayload = {
        chapter_id: resolvedChapterId,
        question: trimmedQuestion,
        session_id: sessionId || null,
        page_context: transportContext,
      };

      try {
        const response = await axios.post(
          URL_TUTOR_CHAT,
          requestPayload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          },
        );

        const data = response.data || {};
        if (data?.success === false) {
          throw new Error(
            data?.error || "لم يتمكن المساعد من معالجة السؤال.",
          );
        }

        const returnedSessionId =
          data?.session_id || data?.session?.id || null;
        if (returnedSessionId) setSessionId(returnedSessionId);

        const responseInfo = {
          mode: data.mode || "",
          intent: data.intent || "",
          model: data.model || "",
          chapterTitle: data.chapter_title || "",
          axisId: data.axis_id ?? null,
          axisTag: data.axis_tag || "",
          axisTitle: data.axis_title || "",
          sectionTitle: data.section_title || "",
          exercise: data.exercise || null,
          question: data.question || null,
          step: data.step || null,
          studentLevel: data.student_level || "",
          masteryScore: data.mastery_score ?? null,
          recentMistakesCount: data.recent_mistakes_count ?? 0,
          contextUsed: data.context_used || {},
          sources: Array.isArray(data.sources) ? data.sources : [],
          suggestions: Array.isArray(data.suggestions)
            ? data.suggestions
            : [],
        };

        setLastResponseInfo(responseInfo);

        setMessages((previous) => [
          ...previous,
          createLocalMessage({
            from: "bot",
            text:
              data?.answer ||
              data?.message?.content ||
              data?.response ||
              "لم أستطع توليد إجابة مناسبة.",
            metadata: {
              sessionId: returnedSessionId,
              ...responseInfo,
            },
          }),
        ]);
      } catch (error) {
        if (
          axios.isCancel(error) ||
          error?.code === "ERR_CANCELED"
        ) {
          return;
        }

        setMessages((previous) => [
          ...previous,
          createLocalMessage({
            from: "bot",
            type: "error",
            text: getApiErrorMessage(error),
          }),
        ]);
      } finally {
        if (chatControllerRef.current === controller) {
          chatControllerRef.current = null;
        }
        setLoading(false);

        requestAnimationFrame(() => {
          textareaRef.current?.focus();
        });
      }
    },
    [
      loading,
      token,
      resolvedChapterId,
      sessionId,
      transportContext,
    ],
  );

  const resetConversation = useCallback(async () => {
    chatControllerRef.current?.abort();

    const oldSessionId = sessionId;
    setSessionId(null);
    setMessages([]);
    setDraft("");
    setLoading(false);
    setLastResponseInfo(null);

    if (oldSessionId && token) {
      try {
        await axios.post(
          getCloseSessionUrl(oldSessionId),
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      } catch {
        // لا مشكلة: أول POST بدون session_id سينشئ جلسة جديدة ويعطل القديمة.
      }
    }

    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [sessionId, token]);

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(draft);
  };

  const handleTextareaKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      sendMessage(draft);
    }
  };

  const handleCollapse = () => {
    setCollapsed((previous) => !previous);
  };

  return (
    <>
      {collapsed && (
        <button
          type="button"
          onClick={handleCollapse}
          title="فتح المساعد السياقي"
          aria-label="فتح المساعد السياقي"
          className="fixed bottom-6 left-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_12px_35px_rgba(37,99,235,0.35)] transition duration-200 hover:-translate-y-1 hover:bg-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-200"
        >
          <MessageCircle size={25} />
          {!!messages.length && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
              {Math.min(messages.length, 99)}
            </span>
          )}
        </button>
      )}

      {!collapsed && (
        <button
          type="button"
          aria-label="إغلاق المحادثة"
          onClick={handleCollapse}
          className="fixed inset-0 z-[59] bg-slate-950/20 backdrop-blur-[2px] sm:hidden"
        />
      )}

      <aside
        dir="rtl"
        className={[
          "fixed z-[60] flex flex-col overflow-hidden",
          "border border-slate-200 bg-white",
          "shadow-[0_24px_80px_rgba(15,23,42,0.22)]",
          "transition-all duration-300 ease-out",
          "bottom-3 left-3 right-3 h-[calc(100dvh-1.5rem)] rounded-3xl",
          "sm:bottom-24 sm:left-6 sm:right-auto",
          "sm:h-[min(720px,calc(100vh-7rem))] sm:w-[410px] sm:rounded-[28px]",
          collapsed
            ? "pointer-events-none translate-y-8 scale-95 opacity-0"
            : "translate-y-0 scale-100 opacity-100",
        ].join(" ")}
      >
        <header className="border-b border-slate-100 bg-gradient-to-l from-brand-50 via-white to-white">
          <div className="flex min-h-[72px] items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-sm">
                <Sparkles size={20} />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-black text-slate-900">
                    مساعد الدرس الذكي
                  </h2>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">
                    سياقي
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                  {resolvedTitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!!messages.length && (
                <button
                  type="button"
                  onClick={resetConversation}
                  disabled={loading || initialLoading}
                  title="بدء محادثة جديدة"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw size={17} />
                </button>
              )}

              <button
                type="button"
                onClick={handleCollapse}
                title="إغلاق المساعد"
                aria-label="إغلاق المساعد"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-900"
              >
                <X size={19} />
              </button>
            </div>
          </div>

          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={() => setContextExpanded((previous) => !previous)}
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-right shadow-sm transition hover:border-brand-200"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <BrainCircuit size={15} className="shrink-0 text-brand-600" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-brand-700">
                      أفهم مكانك في المنصة الآن
                    </p>
                    <p className="truncate text-[10px] font-medium text-slate-500">
                      {activeAxisTitle || "حدد محورًا"}
                      {activeSectionTitle ? ` • ${activeSectionTitle}` : ""}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  size={15}
                  className={`shrink-0 text-slate-400 transition ${
                    contextExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>

              {contextExpanded && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <ContextChip
                    icon={BookOpen}
                    label="المحور"
                    value={activeAxisTitle}
                    tone="blue"
                  />
                  <ContextChip
                    icon={Target}
                    label="القسم"
                    value={activeSectionTitle}
                  />
                  <ContextChip
                    icon={BrainCircuit}
                    label="التمرين"
                    value={activeExerciseTitle}
                    tone="emerald"
                  />
                  <ContextChip
                    icon={MessageCircle}
                    label="السؤال"
                    value={activeQuestionTitle}
                    tone="blue"
                  />
                  <ContextChip
                    icon={BrainCircuit}
                    label="الخطوة"
                    value={activeStepTitle}
                    tone="emerald"
                  />
                  <ContextChip
                    icon={Sparkles}
                    label="المستوى"
                    value={lastResponseInfo?.studentLevel}
                    tone="amber"
                  />
                </div>
              )}
            </button>
          </div>
        </header>

        {pageContext?.selection && (
          <div className="border-b border-brand-100 bg-brand-50/60 px-4 py-2.5">
            <div className="flex items-start gap-2">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-brand-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black text-brand-700">
                  نص محدد من الصفحة
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-5 text-slate-600">
                  {pageContext.selection}
                </p>
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                title="إلغاء التحديد"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto scroll-smooth px-4 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200"
        >
          <div className="space-y-5">
            {!initialLoading && messages.length === 0 && (
              <div className="flex min-h-[285px] flex-col items-center justify-center px-4 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-600">
                  <Bot size={30} />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  لا تحتاج إلى إعادة نسخ السؤال
                </h3>
                <p className="mt-2 max-w-[300px] text-sm font-medium leading-6 text-slate-500">
                  أنا أعرف الدرس والمحور وما فتحته الآن. يمكنك أن تقول:
                  «اشرح هذه الخطوة» أو «أين أخطأت؟».
                </p>

                <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
                  {quickActions.map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => sendMessage(label)}
                      disabled={loading || initialLoading}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {(loading || initialLoading) && (
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                  <Bot size={16} />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tr-sm bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  <span>
                    {initialLoading
                      ? "جارٍ تحميل المحادثة..."
                      : "أحلل سياقك وأجهز الشرح..."}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {!!messages.length && !loading && (
          <div className="border-t border-slate-100 px-3 py-2">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(lastResponseInfo?.suggestions?.length
                ? lastResponseInfo.suggestions
                : quickActions.map((item) => item.label)
              )
                .slice(0, 4)
                .map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => sendMessage(label)}
                    className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    {label}
                  </button>
                ))}
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-200 bg-white p-3"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 shadow-sm transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              disabled={loading || initialLoading}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={
                pageContext?.selection
                  ? "مثال: اشرح لي النص المحدد..."
                  : pageContext?.step
                    ? "مثال: لماذا قمنا بهذه الخطوة؟"
                    : pageContext?.question
                      ? "مثال: ما الفكرة المطلوبة في هذا السؤال؟"
                      : pageContext?.exercise
                        ? "مثال: أعطني تلميحًا لهذا التمرين..."
                        : "اسأل عن الدرس الحالي..."
              }
              className="max-h-40 min-h-[42px] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm font-medium leading-6 text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />

            {loading ? (
              <button
                type="button"
                onClick={() => chatControllerRef.current?.abort()}
                title="إيقاف الطلب"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white transition hover:bg-red-600"
              >
                <X size={17} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim() || !token || initialLoading}
                title="إرسال"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send size={17} className="-rotate-90" />
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between px-1">
            <p className="text-[10px] font-medium text-slate-400">
              Enter للإرسال • Shift + Enter لسطر جديد
            </p>
            <span
              className={`text-[10px] font-medium ${
                draft.length > 1800
                  ? "text-amber-500"
                  : "text-slate-400"
              }`}
            >
              {draft.length}/2000
            </span>
          </div>
        </form>
      </aside>
    </>
  );
}
