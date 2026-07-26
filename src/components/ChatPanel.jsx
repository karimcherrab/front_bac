import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import axios from "axios";
import {
  Bot,
  Loader2,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import ChatMessage from "./ChatMessage";
import { UserContext } from "../Utils/UserContext";

// const API_BASE_URL = "http://127.0.0.1:8000";
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const URL_TUTOR_CHAT =
  `${API_BASE_URL}/api/knowledge/tutor/chat/`;

const getSessionUrl = (chapterId) =>
  `${API_BASE_URL}/api/knowledge/session/${chapterId}/`;

/**
 * Retourne l'heure actuelle pour l'affichage local
 * des messages.
 */
function getCurrentTime() {
  return new Date().toLocaleTimeString("ar-DZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Crée un message local pour l'afficher immédiatement
 * dans l'interface.
 */
function createLocalMessage({
  from,
  text,
  type = "message",
  metadata = {},
}) {
  return {
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`,
    from,
    text,
    type,
    time: getCurrentTime(),
    metadata,
  };
}

/**
 * Extrait un message d'erreur lisible depuis Axios.
 */
function getApiErrorMessage(error) {
  if (!error.response) {
    if (error.code === "ERR_NETWORK") {
      return (
        "تعذر الاتصال بالخادم. تأكد من تشغيل Django " +
        "ومن إعدادات CORS."
      );
    }

    return "حدث خطأ أثناء الاتصال بالمساعد الذكي.";
  }

  const status = error.response.status;
  const data = error.response.data;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data?.error) {
    return data.error;
  }

  if (data?.detail) {
    return data.detail;
  }

  if (data?.question) {
    return Array.isArray(data.question)
      ? data.question.join(" ")
      : data.question;
  }

  if (data?.chapter_id) {
    return Array.isArray(data.chapter_id)
      ? data.chapter_id.join(" ")
      : data.chapter_id;
  }

  if (data?.session_id) {
    return Array.isArray(data.session_id)
      ? data.session_id.join(" ")
      : data.session_id;
  }

  if (status === 400) {
    return "الطلب غير صالح. تحقق من السؤال والفصل المحدد.";
  }

  if (status === 401) {
    return (
      "انتهت جلسة تسجيل الدخول. " +
      "يرجى تسجيل الدخول من جديد."
    );
  }

  if (status === 403) {
    return "لا تملك صلاحية استعمال المساعد الذكي.";
  }

  if (status === 404) {
    return "الفصل أو المسار المطلوب غير موجود.";
  }

  if (status === 502) {
    return (
      "تعذر الحصول على إجابة من نموذج " +
      "الذكاء الاصطناعي."
    );
  }

  if (status >= 500) {
    return "حدث خطأ في الخادم أثناء معالجة السؤال.";
  }

  return "حدث خطأ غير متوقع أثناء إرسال السؤال.";
}

export default function ChatPanel({
  collapsed,
  setCollapsed,

  // Identifiant du chapitre actuel.
  chapterId = 1,
  currentChapter = null,

  // Titre affiché dans l'en-tête du chat.
  chapterTitle = "المتتاليات العددية",
}) {
  const { token } = useContext(UserContext);

  const resolvedChapterId = Number(
    currentChapter?.id ?? currentChapter ?? chapterId ?? 0,
  );

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [lastResponseInfo, setLastResponseInfo] =
    useState(null);

  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const sessionControllerRef = useRef(null);
  const chatControllerRef = useRef(null);

  /**
   * Transforme les messages renvoyés par Django dans le
   * format attendu par le composant ChatMessage.
   *
   * Formats acceptés :
   * - response.messages
   * - response.history
   * - response.session.messages
   * - response.session.history
   *
   * Si l'API ne renvoie que last_question/last_answer,
   * on affiche au minimum ce dernier échange.
   */
  const normalizeSessionMessages = useCallback((data) => {
    const session = data?.session || null;

    const rawMessages =
      data?.messages ||
      data?.history ||
      session?.messages ||
      session?.history ||
      [];

    if (Array.isArray(rawMessages) && rawMessages.length > 0) {
      return rawMessages
        .map((item, index) => {
          const role = String(
            item?.role ||
            item?.sender ||
            item?.from ||
            item?.message_type ||
            "",
          ).toLowerCase();

          const from =
            role === "user" ||
            role === "student" ||
            role === "human"
              ? "user"
              : "bot";

          const text =
            item?.content ??
            item?.text ??
            item?.message ??
            item?.answer ??
            item?.question ??
            "";

          if (!String(text).trim()) {
            return null;
          }

          const createdAt =
            item?.created_at ||
            item?.timestamp ||
            item?.date ||
            null;

          return {
            id:
              item?.id ||
              `${session?.id || "session"}-${index}`,
            from,
            text: String(text),
            type: item?.type || "message",
            time: createdAt
              ? new Date(createdAt).toLocaleTimeString(
                  "ar-DZ",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )
              : getCurrentTime(),
            metadata: item?.metadata || {},
          };
        })
        .filter(Boolean);
    }

    const fallbackMessages = [];

    if (session?.last_question) {
      fallbackMessages.push(
        createLocalMessage({
          from: "user",
          text: session.last_question,
          metadata: {
            restoredFromSession: true,
          },
        }),
      );
    }

    if (session?.last_answer) {
      fallbackMessages.push(
        createLocalMessage({
          from: "bot",
          text: session.last_answer,
          metadata: {
            ...(session.metadata || {}),
            restoredFromSession: true,
            sessionId: session.id || null,
          },
        }),
      );
    }

    return fallbackMessages;
  }, []);

  /**
   * Charge depuis Django la session active du chapitre
   * et tous ses messages. Aucun localStorage n'est utilisé.
   */
  const loadChapterSession = useCallback(async () => {
    sessionControllerRef.current?.abort();

    setSessionId(null);
    setMessages([]);
    setLastResponseInfo(null);

    if (!resolvedChapterId || !token) {
      return;
    }

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
      const session = data?.session ||
        (data?.id ? data : null);

      if (!session?.id) {
        setSessionId(null);
        setMessages([]);
        return;
      }

      setSessionId(session.id);
      setMessages(normalizeSessionMessages(data));

      setLastResponseInfo({
        mode: session.metadata?.mode || "",
        intent: session.current_intent || "",
        model: session.metadata?.model || "",
        chapterId:
          session.chapter ??
          session.metadata?.chapter_id ??
          null,
        chapterCode:
          session.metadata?.chapter_code || "",
        chapterTitle:
          session.metadata?.chapter_title || "",
        axisId:
          session.current_axis ??
          session.metadata?.axis_id ??
          null,
        axisTag:
          session.metadata?.axis_tag || "",
        axisTitle:
          session.metadata?.axis_title || "",
        sources: [],
      });
    } catch (error) {
      if (
        axios.isCancel(error) ||
        error.code === "ERR_CANCELED"
      ) {
        return;
      }

      /*
       * 404 signifie simplement qu'aucune session n'existe
       * encore pour ce chapitre. Le premier POST sera donc
       * envoyé avec session_id: null et Django la créera.
       */
      if (error.response?.status === 404) {
        setSessionId(null);
        setMessages([]);
        return;
      }

      const errorMessage = createLocalMessage({
        from: "bot",
        type: "error",
        text: getApiErrorMessage(error),
      });

      setMessages([errorMessage]);

      console.error(
        "Session loading failed:",
        error.response?.data || error,
      );
    } finally {
      if (
        sessionControllerRef.current === controller
      ) {
        sessionControllerRef.current = null;
      }

      setInitialLoading(false);
    }
  }, [
    resolvedChapterId,
    token,
    normalizeSessionMessages,
  ]);

  useEffect(() => {
    loadChapterSession();
  }, [loadChapterSession]);

  /**
   * Descend automatiquement vers le dernier message.
   */
  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, initialLoading]);

  /**
   * Ajuste automatiquement la hauteur du textarea.
   */
  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      160,
    )}px`;
  }, [draft]);

  /**
   * Annule la requête si le composant est démonté.
   */
  useEffect(() => {
    return () => {
      sessionControllerRef.current?.abort();
      chatControllerRef.current?.abort();
    };
  }, []);

  /**
   * Garde uniquement le session_id dans l'état React.
   * La source de vérité reste la base de données.
   */
  const saveSessionId = useCallback(
    (newSessionId) => {
      setSessionId(newSessionId || null);
    },
    [],
  );

  /**
   * Envoie un message au backend.
   */
  const sendMessage = useCallback(
    async (text) => {
      const trimmedQuestion = String(
        text || "",
      ).trim();

      if (!trimmedQuestion || loading) {
        return;
      }

      if (!token) {
        const authenticationMessage =
          createLocalMessage({
            from: "bot",
            type: "error",
            text:
              "يجب تسجيل الدخول أولًا لاستعمال " +
              "المساعد الذكي.",
          });

        setMessages((previousMessages) => [
          ...previousMessages,
          authenticationMessage,
        ]);

        return;
      }

      if (!resolvedChapterId) {
        const chapterErrorMessage =
          createLocalMessage({
            from: "bot",
            type: "error",
            text: "لم يتم تحديد الفصل الدراسي.",
          });

        setMessages((previousMessages) => [
          ...previousMessages,
          chapterErrorMessage,
        ]);

        return;
      }

      const userMessage = createLocalMessage({
        from: "user",
        text: trimmedQuestion,
      });

      setMessages((previousMessages) => [
        ...previousMessages,
        userMessage,
      ]);

      setDraft("");
      setLoading(true);
      setLastResponseInfo(null);

      const controller = new AbortController();
      chatControllerRef.current = controller;

      /**
       * Ce payload doit rester sous cette forme pour
       * continuer l'ancienne session.
       */
      const requestPayload = {
        chapter_id: resolvedChapterId,
        question: trimmedQuestion,
        session_id: sessionId || null,
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

        const data = response.data;

        if (data?.success === false) {
          throw new Error(
            data?.error ||
              "لم يتمكن المساعد من معالجة السؤال.",
          );
        }

        /**
         * Sauvegarde obligatoire de la session renvoyée
         * après chaque réponse.
         */
        const returnedSessionId =
          data?.session_id || data?.session?.id || null;

        if (returnedSessionId) {
          saveSessionId(returnedSessionId);
        }

        setLastResponseInfo({
          mode: data.mode || "",
          intent: data.intent || "",
          model: data.model || "",

          chapterId: data.chapter_id ?? null,
          chapterCode: data.chapter_code || "",
          chapterTitle: data.chapter_title || "",

          axisId: data.axis_id ?? null,
          axisTag: data.axis_tag || "",
          axisTitle: data.axis_title || "",

          sources: Array.isArray(data.sources)
            ? data.sources
            : [],
        });

        const assistantMessage =
          createLocalMessage({
            from: "bot",
            text:
              data?.answer ||
              data?.message?.content ||
              data?.response ||
              "لم أستطع توليد إجابة مناسبة.",
            metadata: {
              sessionId: returnedSessionId,
              mode: data.mode || "",
              intent: data.intent || "",
              model: data.model || "",

              chapterId: data.chapter_id ?? null,
              chapterCode:
                data.chapter_code || "",
              chapterTitle:
                data.chapter_title || "",

              axisId: data.axis_id ?? null,
              axisTag: data.axis_tag || "",
              axisTitle: data.axis_title || "",

              sources: Array.isArray(data.sources)
                ? data.sources
                : [],
            },
          });

        setMessages((previousMessages) => [
          ...previousMessages,
          assistantMessage,
        ]);
      } catch (error) {
        if (
          axios.isCancel(error) ||
          error.code === "ERR_CANCELED"
        ) {
          return;
        }

        const errorText =
          error instanceof Error &&
          !error.response &&
          error.message
            ? error.message
            : getApiErrorMessage(error);

        const errorMessage = createLocalMessage({
          from: "bot",
          type: "error",
          text: errorText,
        });

        setMessages((previousMessages) => [
          ...previousMessages,
          errorMessage,
        ]);

        console.error(
          "Tutor chat request failed:",
          error.response?.data || error,
        );
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
      saveSessionId,
    ],
  );

  /**
   * Démarre une nouvelle conversation côté interface.
   * Le prochain message est envoyé avec session_id: null ;
   * Django créera alors une nouvelle session.
   */
  const resetConversation = useCallback(() => {
    chatControllerRef.current?.abort();

    setSessionId(null);
    setMessages([]);
    setDraft("");
    setLoading(false);
    setInitialLoading(false);
    setLastResponseInfo(null);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

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
    setCollapsed((previousValue) => !previousValue);
  };

  return (
    <>
      {/* زر المحادثة العائم */}
      {collapsed && (
        <button
          type="button"
          onClick={handleCollapse}
          title="فتح المساعد الذكي"
          aria-label="فتح المساعد الذكي"
          className={[
            "fixed bottom-6 left-6 z-[60]",
            "flex h-14 w-14 items-center justify-center",
            "rounded-full bg-brand-500 text-white",
            "shadow-[0_12px_35px_rgba(37,99,235,0.35)]",
            "transition duration-200",
            "hover:-translate-y-1 hover:bg-brand-600",
            "focus:outline-none focus:ring-4 focus:ring-brand-200",
          ].join(" ")}
        >
          <MessageCircle size={25} />

          {messages.length > 0 && (
            <span
              className={[
                "absolute -right-1 -top-1",
                "flex h-6 min-w-6 items-center justify-center",
                "rounded-full border-2 border-white",
                "bg-red-500 px-1 text-[10px] font-bold text-white",
              ].join(" ")}
            >
              {Math.min(messages.length, 99)}
            </span>
          )}
        </button>
      )}

      {/* خلفية شفافة على الهاتف */}
      {!collapsed && (
        <button
          type="button"
          aria-label="إغلاق المحادثة"
          onClick={handleCollapse}
          className={[
            "fixed inset-0 z-[59] bg-slate-950/20",
            "backdrop-blur-[2px] sm:hidden",
          ].join(" ")}
        />
      )}

      {/* نافذة المحادثة العائمة */}
      <aside
        dir="rtl"
        className={[
          "fixed z-[60] flex flex-col overflow-hidden",
          "border border-slate-200 bg-white",
          "shadow-[0_24px_80px_rgba(15,23,42,0.22)]",
          "transition-all duration-300 ease-out",

          "bottom-3 left-3 right-3 h-[calc(100dvh-1.5rem)]",
          "rounded-3xl",

          "sm:bottom-24 sm:left-6 sm:right-auto",
          "sm:h-[min(680px,calc(100vh-8rem))]",
          "sm:w-[390px] sm:rounded-[28px]",

          collapsed
            ? "pointer-events-none translate-y-8 scale-95 opacity-0"
            : "translate-y-0 scale-100 opacity-100",
        ].join(" ")}
      >
        {/* رأس النافذة */}
        <header
          className={[
            "flex min-h-[72px] items-center justify-between",
            "border-b border-slate-100 px-4",
            "bg-gradient-to-l from-brand-50 to-white",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center",
                "rounded-2xl bg-brand-500 text-white shadow-sm",
              ].join(" ")}
            >
              <Sparkles size={19} />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-900">
                مساعدك الذكي
              </h2>

              <p className="truncate text-xs text-slate-500">
                {chapterTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={resetConversation}
                disabled={loading || initialLoading}
                title="بدء محادثة جديدة"
                className={[
                  "flex h-9 w-9 items-center justify-center",
                  "rounded-xl text-slate-500 transition",
                  "hover:bg-white hover:text-slate-800",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                ].join(" ")}
              >
                <RotateCcw size={17} />
              </button>
            )}

            <button
              type="button"
              onClick={handleCollapse}
              title="إغلاق المساعد"
              aria-label="إغلاق المساعد"
              className={[
                "flex h-9 w-9 items-center justify-center",
                "rounded-xl text-slate-500 transition",
                "hover:bg-white hover:text-slate-900",
              ].join(" ")}
            >
              <X size={19} />
            </button>
          </div>
        </header>

        {/* منطقة الرسائل */}
        <div
          ref={messagesContainerRef}
          className={[
            "flex-1 overflow-y-auto scroll-smooth px-4 py-4",
            "[&::-webkit-scrollbar]:w-1.5",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-slate-200",
          ].join(" ")}
        >
          <div className="space-y-5">
            {!initialLoading && messages.length === 0 && (
              <div className="flex h-full min-h-[310px] flex-col items-center justify-center px-5 text-center">
                <div
                  className={[
                    "mb-4 flex h-16 w-16 items-center justify-center",
                    "rounded-3xl bg-brand-50 text-brand-600",
                  ].join(" ")}
                >
                  <Bot size={29} />
                </div>

                <h3 className="text-base font-bold text-slate-900">
                  كيف يمكنني مساعدتك؟
                </h3>

                <p className="mt-2 max-w-[270px] text-sm leading-6 text-slate-500">
                  اطرح سؤالًا حول الدرس، اطلب شرحًا مبسطًا أو مثالًا إضافيًا.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
              />
            ))}

            {(loading || initialLoading) && (
              <div className="flex items-start gap-2.5">
                <div
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center",
                    "rounded-full bg-brand-100 text-brand-600",
                  ].join(" ")}
                >
                  <Bot size={16} />
                </div>

                <div
                  className={[
                    "flex items-center gap-2 rounded-2xl rounded-tr-sm",
                    "bg-slate-50 px-4 py-3 text-sm text-slate-500",
                  ].join(" ")}
                >
                  <Loader2 size={16} className="animate-spin" />

                  <span>
                    {initialLoading
                      ? "جارٍ تحميل المحادثة..."
                      : "المساعد يكتب..."}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* معلومات المحور المستعمل */}
        {lastResponseInfo?.axisTitle && (
          <div className="border-t border-slate-100 px-4 py-2">
            <div
              className={[
                "flex items-center justify-between gap-2",
                "rounded-xl bg-slate-50 px-3 py-2",
              ].join(" ")}
            >
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400">
                  المحور المستعمل
                </p>

                <p className="truncate text-xs font-medium text-slate-700">
                  {lastResponseInfo.axisTitle}
                </p>
              </div>

              {lastResponseInfo.mode && (
                <span
                  className={[
                    "shrink-0 rounded-lg bg-brand-100 px-2 py-1",
                    "text-[10px] font-medium text-brand-700",
                  ].join(" ")}
                >
                  {lastResponseInfo.mode}
                </span>
              )}
            </div>
          </div>
        )}

        {/* حقل الكتابة */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-200 bg-white p-3"
        >
          <div
            className={[
              "flex items-end gap-2 rounded-2xl border",
              "border-slate-200 bg-slate-50 px-2 py-2",
              "shadow-sm transition",
              "focus-within:border-brand-400",
              "focus-within:bg-white",
              "focus-within:ring-2 focus-within:ring-brand-100",
            ].join(" ")}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              disabled={loading || initialLoading}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="اكتب سؤالك هنا..."
              className={[
                "max-h-40 min-h-[42px] flex-1 resize-none",
                "overflow-y-auto bg-transparent px-2 py-2",
                "text-sm leading-6 text-slate-800",
                "placeholder:text-slate-400 focus:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-60",
              ].join(" ")}
            />

            {loading ? (
              <button
                type="button"
                onClick={() => {
                  chatControllerRef.current?.abort();
                }}
                title="إيقاف الطلب"
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center",
                  "rounded-xl bg-red-500 text-white transition",
                  "hover:bg-red-600",
                ].join(" ")}
              >
                <X size={17} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim() || !token || initialLoading}
                title="إرسال"
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center",
                  "rounded-xl bg-brand-500 text-white transition",
                  "hover:bg-brand-600",
                  "disabled:cursor-not-allowed disabled:bg-slate-300",
                ].join(" ")}
              >
                <Send size={17} className="-rotate-90" />
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between px-1">
            <p className="text-[10px] text-slate-400">
              Enter للإرسال • Shift + Enter لسطر جديد
            </p>

            <span
              className={[
                "text-[10px]",
                draft.length > 1800
                  ? "text-amber-500"
                  : "text-slate-400",
              ].join(" ")}
            >
              {draft.length}/2000
            </span>
          </div>
        </form>
      </aside>
    </>
  );
}