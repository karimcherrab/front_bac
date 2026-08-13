// src/pages/TutorChatPage.jsx

import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import axios from "axios";

import { MathJax } from "better-react-mathjax";

import {
  Bot,
  BookOpen,
  Clock3,
  History,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  User,
} from "lucide-react";

import { UserContext } from "../Utils/UserContext";

// ======================================================
// API
// ======================================================

const RAW_API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

const API_BASE_URL =
  RAW_API_BASE_URL.replace(/\/+$/, "");

const URL_TUTOR_CHAT =
  `${API_BASE_URL}/api/tutor/chat/`;

const URL_TUTOR_SESSIONS =
  `${API_BASE_URL}/api/tutor/sessions/`;


// ======================================================
// Helpers
// ======================================================



function formatSessionDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(
      "ar-DZ",
      {
        day: "numeric",
        month: "short",
      },
    ).format(
      new Date(value),
    );
  } catch {
    return "";
  }
}


function getErrorMessage(error) {
  if (
    error?.name === "CanceledError" ||
    error?.code === "ERR_CANCELED"
  ) {
    return "";
  }

  if (
    error?.response?.status === 401
  ) {
    return "انتهت جلسة تسجيل الدخول، سجل الدخول من جديد.";
  }

  if (
    error?.response?.data?.detail
  ) {
    return error.response.data.detail;
  }

  if (
    error?.response?.data?.question?.[0]
  ) {
    return error.response.data.question[0];
  }

  if (
    error?.code === "ECONNABORTED"
  ) {
    return "استغرق المساعد وقتًا طويلًا في الرد.";
  }

  return "حدث خطأ أثناء التواصل مع المساعد.";
}


// ======================================================
// Welcome
// ======================================================

function Welcome() {
  return (
    <div
      className="
        flex
        min-h-full
        items-center
        justify-center
        px-6
        py-16
      "
    >
      <div
        className="
          w-full
          max-w-[720px]
          text-center
        "
      >
        <div
          className="
            mx-auto
            mb-6
            flex
            h-[72px]
            w-[72px]
            items-center
            justify-center
            rounded-[22px]
            border
            border-slate-200
            bg-white
            text-violet-600
            shadow-[0_10px_30px_rgba(15,23,42,0.06)]
          "
        >
          <Bot size={32} strokeWidth={1.8} />
        </div>

        <h1
          className="
            text-[34px]
            font-black
            tracking-[-0.02em]
            text-slate-950
            sm:text-[40px]
          "
        >
          كيف يمكنني مساعدتك؟
        </h1>

        <p
          className="
            mx-auto
            mt-4
            max-w-[560px]
            text-[14px]
            leading-8
            text-slate-500
          "
        >
          اسأل عن درس، تمرين، مفهوم أو سؤال بكالوريا.
          سأبحث في محتوى المنصة وأشرح لك الإجابة بطريقة واضحة وبسيطة.
        </p>
      </div>
    </div>
  );
}


// ======================================================
// Sources
// ======================================================

function Sources({
  sources,
}) {
  if (
    !Array.isArray(sources) ||
    sources.length === 0
  ) {
    return null;
  }

  return (
    <div
      className="
        mt-4
        flex
        flex-wrap
        gap-2
      "
    >
      {sources
        .slice(0, 4)
        .map(
          (source, index) => (
            <div
              key={
                source.rag_chunk_id ||
                source.id ||
                index
              }
              className="
                flex
                items-center
                gap-1.5
                rounded-full
                border
                border-violet-100
                bg-violet-50
                px-3
                py-1.5
                text-[11px]
                font-bold
                text-violet-700
              "
            >
              <BookOpen size={12} />

              <span
                className="
                  max-w-[220px]
                  truncate
                "
              >
                {source.title ||
                  `مصدر ${index + 1}`}
              </span>
            </div>
          ),
        )}
    </div>
  );
}



// ======================================================
// Structured AI Answer
// ======================================================

function MathBlock({ latex }) {
  if (!latex) {
    return null;
  }

  return (
    <div
      dir="ltr"
      className="
        my-4
        overflow-x-auto
        rounded-2xl
        border
        border-violet-100
        bg-violet-50/60
        px-5
        py-4
        text-center
      "
    >
      <MathJax dynamic>
        {`\\[${latex}\\]`}
      </MathJax>
    </div>
  );
}


function StepsBlock({ items }) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return null;
  }

  return (
    <div className="my-4 space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="
            flex
            items-start
            gap-3
            rounded-xl
            border
            border-slate-100
            bg-slate-50
            px-4
            py-3
          "
        >
          <div
            className="
              flex
              h-7
              w-7
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-violet-100
              text-xs
              font-black
              text-violet-700
            "
          >
            {index + 1}
          </div>

          <div
            className="
              min-w-0
              flex-1
              pt-0.5
              text-[14px]
              leading-7
              text-slate-700
            "
          >
            <MathJax dynamic>
              {String(item)}
            </MathJax>
          </div>
        </div>
      ))}
    </div>
  );
}


function GraphBlock({ graph }) {
  if (
    !graph ||
    !Array.isArray(graph.series)
  ) {
    return null;
  }

  const allPoints = graph.series.flatMap(
    (serie) =>
      Array.isArray(serie?.points)
        ? serie.points
            .map((point) => ({
              x: Number(point?.x),
              y: Number(point?.y),
            }))
            .filter(
              (point) =>
                Number.isFinite(point.x) &&
                Number.isFinite(point.y),
            )
        : [],
  );

  if (!allPoints.length) {
    return null;
  }

  const WIDTH = 640;
  const HEIGHT = 320;
  const PAD = 48;

  const xs = allPoints.map((point) => point.x);
  const ys = allPoints.map((point) => point.y);

  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }

  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  const extraX = (maxX - minX) * 0.08;
  const extraY = (maxY - minY) * 0.12;

  minX -= extraX;
  maxX += extraX;
  minY -= extraY;
  maxY += extraY;

  const xRange = maxX - minX;
  const yRange = maxY - minY;

  const mapX = (x) =>
    PAD +
    ((x - minX) / xRange) *
      (WIDTH - PAD * 2);

  const mapY = (y) =>
    HEIGHT -
    PAD -
    ((y - minY) / yRange) *
      (HEIGHT - PAD * 2);

  const xAxisY =
    minY <= 0 && maxY >= 0
      ? mapY(0)
      : HEIGHT - PAD;

  const yAxisX =
    minX <= 0 && maxX >= 0
      ? mapX(0)
      : PAD;

  return (
    <div
      className="
        my-5
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
      "
    >
      <div
        className="
          border-b
          border-slate-100
          px-4
          py-3
          text-[12px]
          font-extrabold
          text-slate-600
        "
      >
        التمثيل البياني
      </div>

      <div className="overflow-x-auto p-4">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="mx-auto min-w-[560px]"
          role="img"
          aria-label="تمثيل بياني"
        >
          {/* Axes */}
          <line
            x1={PAD}
            y1={xAxisY}
            x2={WIDTH - PAD}
            y2={xAxisY}
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />

          <line
            x1={yAxisX}
            y1={PAD}
            x2={yAxisX}
            y2={HEIGHT - PAD}
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />

          {graph.series.map((serie, seriesIndex) => {
            const points = Array.isArray(serie?.points)
              ? serie.points
                  .map((point) => ({
                    x: Number(point?.x),
                    y: Number(point?.y),
                  }))
                  .filter(
                    (point) =>
                      Number.isFinite(point.x) &&
                      Number.isFinite(point.y),
                  )
              : [];

            if (!points.length) {
              return null;
            }

            const path = points
              .map((point, index) => {
                const x = mapX(point.x);
                const y = mapY(point.y);

                return index === 0
                  ? `M ${x} ${y}`
                  : `L ${x} ${y}`;
              })
              .join(" ");

            return (
              <g key={seriesIndex}>
                <path
                  d={path}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {points.map((point, pointIndex) => (
                  <circle
                    key={pointIndex}
                    cx={mapX(point.x)}
                    cy={mapY(point.y)}
                    r="3.5"
                    fill="#7c3aed"
                  />
                ))}
              </g>
            );
          })}

          <text
            x={WIDTH - PAD + 8}
            y={xAxisY + 4}
            fontSize="13"
            fill="#64748b"
          >
            {graph.x_label || "x"}
          </text>

          <text
            x={yAxisX + 7}
            y={PAD - 10}
            fontSize="13"
            fill="#64748b"
          >
            {graph.y_label || "y"}
          </text>
        </svg>
      </div>
    </div>
  );
}


function StructuredAnswer({ answer }) {
  if (!answer) {
    return null;
  }

  // Backward compatibility: old assistant messages were strings.
  if (typeof answer === "string") {
    return (
      <MathJax dynamic>
        <div
          className="
            whitespace-pre-wrap
            text-[14px]
            leading-8
            text-slate-700
          "
        >
          {answer}
        </div>
      </MathJax>
    );
  }

  if (typeof answer !== "object") {
    return null;
  }

  const blocks = Array.isArray(answer.blocks)
    ? answer.blocks
    : [];

  return (
    <div className="min-w-0">
      {answer.title ? (
        <h3
          className="
            mb-3
            text-[16px]
            font-black
            leading-7
            text-slate-900
          "
        >
          {answer.title}
        </h3>
      ) : null}

      {answer.intro ? (
        <MathJax dynamic>
          <div
            className="
              mb-4
              whitespace-pre-wrap
              text-[14px]
              leading-8
              text-slate-700
            "
          >
            {answer.intro}
          </div>
        </MathJax>
      ) : null}

      {blocks.map((block, index) => {
        if (!block || typeof block !== "object") {
          return null;
        }

        if (block.type === "text") {
          return (
            <MathJax dynamic key={index}>
              <div
                className="
                  my-3
                  whitespace-pre-wrap
                  text-[14px]
                  leading-8
                  text-slate-700
                "
              >
                {block.content || ""}
              </div>
            </MathJax>
          );
        }

        if (block.type === "math") {
          return (
            <MathBlock
              key={index}
              latex={block.latex}
            />
          );
        }

        if (block.type === "steps") {
          return (
            <StepsBlock
              key={index}
              items={block.items}
            />
          );
        }

        return null;
      })}

      <GraphBlock graph={answer.graph} />

      {answer.summary ? (
        <div
          className="
            mt-5
            rounded-xl
            border
            border-emerald-100
            bg-emerald-50
            px-4
            py-3
            text-[13px]
            font-semibold
            leading-7
            text-emerald-900
          "
        >
          <MathJax dynamic>
            {answer.summary}
          </MathJax>
        </div>
      ) : null}
    </div>
  );
}


// ======================================================
// Message
// ======================================================

function MessageBubble({
  message,
}) {
  const isUser =
    message.role === "user";

  if (isUser) {
    return (
      <div
        className="
          flex
          justify-start
          gap-3
        "
      >
        <div
          className="
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-[9px]
            bg-slate-100
            text-slate-500
          "
        >
          <User size={17} />
        </div>

        <div
          className="
            max-w-[72%]
            rounded-[18px]
            rounded-tr-[5px]
            bg-slate-100
            px-4
            py-3
            text-[14px]
            leading-7
            text-slate-800
          "
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        flex
        items-start
        gap-3
      "
    >
      <div
        className="
          flex
          h-8
          w-8
          shrink-0
          items-center
          justify-center
          rounded-[9px]
          bg-violet-600
          text-white
        "
      >
        <Bot size={19} />
      </div>

      <div
        className="
          max-w-[88%]
          px-1
          py-1
        "
      >
        <div
          className="
            mb-2
            flex
            items-center
            gap-1.5
            text-[10px]
            font-extrabold
            text-slate-400
          "
        >
          <Sparkles size={12} />

          المساعد الذكي
        </div>

        <StructuredAnswer
          answer={message.content}
        />

        {message.mode !== "general" ? (
          <Sources
            sources={message.sources}
          />
        ) : null}
      </div>
    </div>
  );
}


// ======================================================
// Typing
// ======================================================

function TypingIndicator() {
  return (
    <div
      className="
        flex
        items-start
        gap-3
      "
    >
      <div
        className="
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-[14px]
          bg-gradient-to-br
          from-violet-500
          to-blue-600
          text-white
        "
      >
        <Bot size={19} />
      </div>

      <div
        className="
          flex
          items-center
          gap-3
          rounded-[12px]
          bg-slate-50
          px-3.5
          py-2.5
          text-xs
          font-semibold
          text-slate-500
        "
      >
        <Loader2
          size={16}
          className="animate-spin"
        />

        أبحث في المحتوى...
      </div>
    </div>
  );
}


// ======================================================
// Sessions Sidebar
// ======================================================

function SessionsSidebar({
  sessions,
  loading,
  currentSessionId,
  onSelect,
  onNew,
}) {
  return (
    <aside
      className="
        hidden
        h-full
        w-[300px]
        shrink-0
        flex-col
        border-l
        border-slate-200/70
        bg-[#f7f7f8]
        md:flex
      "
    >
      <div
        className="
          shrink-0
          border-b
          border-slate-200/60
          p-3
        "
      >
        <button
          type="button"
          onClick={onNew}
          className="
            flex
            h-[46px]
            w-full
            items-center
            justify-start
            gap-2.5
            rounded-[12px]
            border
            border-slate-300/70
            bg-white
            px-3.5
            text-[13px]
            font-extrabold
            text-slate-800
            shadow-sm
            transition

            hover:bg-slate-50
          "
        >
          <Plus size={17} />

          محادثة جديدة
        </button>
      </div>

      <div
        className="
          flex
          shrink-0
          items-center
          gap-2
          px-4
          pb-2
          pt-4
          text-[11px]
          font-extrabold
          text-slate-400
        "
      >
        <History size={15} />

        المحادثات السابقة
      </div>

      <div
        className="
          tutor-scrollbar
          min-h-0
          flex-1
          overflow-y-auto
          px-2
          pb-3
        "
      >
        {loading ? (
          <div
            className="
              flex
              justify-center
              py-10
            "
          >
            <Loader2
              size={19}
              className="
                animate-spin
                text-violet-500
              "
            />
          </div>
        ) : sessions.length === 0 ? (
          <div
            className="
              px-5
              py-10
              text-center
            "
          >
            <div
              className="
                mx-auto
                mb-3
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                bg-slate-50
                text-slate-300
              "
            >
              <MessageCircle
                size={18}
              />
            </div>

            <p
              className="
                text-[11px]
                leading-5
                text-slate-400
              "
            >
              لا توجد محادثات
              سابقة بعد.
            </p>
          </div>
        ) : (
          <div
            className="
              space-y-1
            "
          >
            {sessions.map(
              (session) => {
                const active =
                  String(
                    session.id,
                  ) ===
                  String(
                    currentSessionId,
                  );

                return (
                  <button
                    key={
                      session.id
                    }
                    type="button"
                    onClick={() =>
                      onSelect(
                        session.id,
                      )
                    }
                    className={`
                      w-full
                      rounded-[12px]
                      px-2.5
                      py-2.5
                      text-right
                      transition

                      ${
                        active
                          ? "bg-white shadow-sm ring-1 ring-slate-200/70"
                          : "hover:bg-white/70"
                      }
                    `}
                  >
                    <div
                      className="
                        flex
                        items-start
                        gap-2.5
                      "
                    >
                      <div
                        className={`
                          mt-0.5
                          flex
                          h-8
                          w-8
                          shrink-0
                          items-center
                          justify-center
                          rounded-[9px]

                          ${
                            active
                              ? "bg-violet-50 text-violet-600"
                              : "bg-white text-slate-400 ring-1 ring-slate-200/60"
                          }
                        `}
                      >
                        <MessageCircle
                          size={14}
                        />
                      </div>

                      <div
                        className="
                          min-w-0
                          flex-1
                        "
                      >
                        <p
                          className="
                            truncate
                            text-[12px]
                            font-semibold
                            text-slate-700
                          "
                        >
                          {session.title ||
                            "محادثة جديدة"}
                        </p>

                        <div
                          className="
                            mt-1
                            flex
                            items-center
                            gap-1
                            text-[9px]
                            text-slate-400
                          "
                        >
                          <Clock3
                            size={9}
                          />

                          {formatSessionDate(
                            session.updated_at,
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        )}
      </div>
    </aside>
  );
}


// ======================================================
// Main Page
// ======================================================

export default function TutorChatPage() {
  // IMPORTANT:
  // Hooks must only be called at the top level of the React component.
  // We read the authenticated token once here and reuse it in all handlers.
  const { token } = useContext(UserContext);

  // IMPORTANT:
  // Hooks must only be called at the top level of the React component.
  // We read the authenticated token once here and reuse it in all handlers.
const [
    sessions,
    setSessions,
  ] = useState([]);

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    currentSessionId,
    setCurrentSessionId,
  ] = useState(null);

  const [
    input,
    setInput,
  ] = useState("");

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    sessionsLoading,
    setSessionsLoading,
  ] = useState(false);

  const [
    conversationLoading,
    setConversationLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const messagesEndRef =
    useRef(null);

  const textareaRef =
    useRef(null);

  const requestControllerRef =
    useRef(null);


  // ====================================================
  // Scroll
  // ====================================================

  const scrollToBottom =
    useCallback(
      (behavior = "smooth") => {
        requestAnimationFrame(
          () => {
            messagesEndRef.current
              ?.scrollIntoView({
                behavior,
                block: "end",
              });
          },
        );
      },
      [],
    );


  useEffect(() => {
    if (
      messages.length > 0 ||
      sending
    ) {
      scrollToBottom();
    }
  }, [
    messages,
    sending,
    scrollToBottom,
  ]);


  // ====================================================
  // Sessions
  // ====================================================

  const loadSessions =
    useCallback(
      async () => {
if (!token) {
          return;
        }

        setSessionsLoading(true);

        try {
          const response =
            await axios.get(
              URL_TUTOR_SESSIONS,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                  Accept: "application/json",
                },
              },
            );

          const data =
            response.data;

          setSessions(
            Array.isArray(data)
              ? data
              : data?.results || [],
          );
        } catch (err) {
          console.error(
            "Tutor sessions error:",
            err,
          );
        } finally {
          setSessionsLoading(
            false,
          );
        }
      },
      [token],
    );


  useEffect(() => {
    loadSessions();
  }, [loadSessions]);


  // ====================================================
  // Load Conversation
  // ====================================================

  async function loadConversation(
    sessionId,
  ) {
if (!token) {
      setError(
        "يجب تسجيل الدخول أولًا.",
      );
      return;
    }

    setConversationLoading(true);
    setError("");

    try {
      const response =
        await axios.get(
          `${URL_TUTOR_SESSIONS}${sessionId}/`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
              Accept: "application/json",
            },
          },
        );

      setCurrentSessionId(
        response.data.id,
      );

      const loadedMessages = (
        Array.isArray(
          response.data.messages,
        )
          ? response.data.messages
          : []
      ).map((message) => ({
        ...message,

        content:
          message.role === "assistant" &&
          message.metadata?.answer_payload
            ? message.metadata.answer_payload
            : message.content,

        mode:
          message.metadata?.answer_mode ||
          message.metadata?.answer_payload?.mode ||
          "rag",
      }));

      setMessages(loadedMessages);

      setTimeout(
        () =>
          scrollToBottom(
            "auto",
          ),
        50,
      );
    } catch (err) {
      setError(
        getErrorMessage(err),
      );
    } finally {
      setConversationLoading(
        false,
      );
    }
  }


  // ====================================================
  // New Chat
  // ====================================================

  function startNewChat() {
    if (
      requestControllerRef.current
    ) {
      requestControllerRef.current.abort();
    }

    setCurrentSessionId(null);
    setMessages([]);
    setInput("");
    setError("");
    setSending(false);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }


  // ====================================================
  // Send
  // ====================================================

  async function sendQuestion(
    forcedQuestion = null,
  ) {
    const question = (
      forcedQuestion ??
      input
    ).trim();

    if (
      !question ||
      sending
    ) {
      return;
    }
if (!token) {
      setError(
        "يجب تسجيل الدخول أولًا.",
      );

      return;
    }

    setError("");
    setSending(true);
    setInput("");

    const userMessage = {
      id:
        `temp-${Date.now()}`,

      role: "user",
      content: question,
      sources: [],
    };

    setMessages(
      (previous) => [
        ...previous,
        userMessage,
      ],
    );

    const controller =
      new AbortController();

    requestControllerRef.current =
      controller;

    try {
      const requestPayload = {
        question,

        ...(currentSessionId
          ? {
              session_id:
                currentSessionId,
            }
          : {}),
      };

      // ==============================================
      // POST بالطريقة التي طلبتها
      // ==============================================

      const response =
        await axios.post(
          URL_TUTOR_CHAT,
          requestPayload,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            signal:
              controller.signal,
          },
        );

      const data =
        response.data;

      if (
        data.session_id &&
        !currentSessionId
      ) {
        setCurrentSessionId(
          data.session_id,
        );
      }

      setMessages(
        (previous) => [
          ...previous,
          {
            id:
              data.message_id ||
              `assistant-${Date.now()}`,

            role:
              "assistant",

            content:
              data.answer ||
              {
                mode: data.mode || "general",
                title: "",
                intro: "لم يتم إنشاء جواب.",
                blocks: [],
                graph: null,
                summary: "",
              },

            sources:
              Array.isArray(
                data.sources,
              )
                ? data.sources
                : [],

            mode:
              data.mode ||
              data.answer?.mode ||
              "general",
          },
        ],
      );

      await loadSessions();
    } catch (err) {
      if (
        err?.name ===
          "CanceledError" ||
        err?.code ===
          "ERR_CANCELED"
      ) {
        return;
      }

      console.error(
        "Tutor chat error:",
        err,
      );

      setError(
        getErrorMessage(err),
      );

      // نحذف الرسالة المؤقتة
      setMessages(
        (previous) =>
          previous.filter(
            (message) =>
              message.id !==
              userMessage.id,
          ),
      );

      // نعيد السؤال للحقل
      setInput(question);
    } finally {
      setSending(false);

      requestControllerRef.current =
        null;

      textareaRef.current?.focus();
    }
  }


  // ====================================================
  // Textarea auto height
  // ====================================================

  useEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height =
      "auto";

    textarea.style.height =
      `${Math.min(
        textarea.scrollHeight,
        120,
      )}px`;
  }, [input]);


  // ====================================================
  // Keyboard
  // ====================================================

  function handleKeyDown(
    event,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendQuestion();
    }
  }


  // ====================================================
  // Render
  // ====================================================

  return (
  <div
    dir="rtl"
    className="
      tutor-chat-page

      flex

      h-[calc(100dvh-88px)]
      w-full

      min-h-0

      overflow-hidden

      bg-white

      lg:h-[calc(100dvh-104px)]
    "
  >
    {/* ==============================================
        SESSIONS SIDEBAR
        ثابتة ولا تتحرك مع الرسائل
    =============================================== */}

    <div
      className="
        hidden
        h-full
        min-h-0
        shrink-0

        md:block
      "
    >
      <SessionsSidebar
        sessions={sessions}
        loading={sessionsLoading}
        currentSessionId={
          currentSessionId
        }
        onSelect={
          loadConversation
        }
        onNew={
          startNewChat
        }
      />
    </div>


    {/* ==============================================
        CHAT
    =============================================== */}

    <main
      className="
        flex
        h-full
        min-h-0
        min-w-0
        flex-1
        flex-col

        overflow-hidden
      "
    >

      {/* ==========================================
          HEADER
          ثابت
      ========================================== */}

      <header
        className="
          flex
          h-[68px]
          shrink-0

          items-center
          justify-between

          border-b
          border-slate-100

          bg-white

          px-5

          md:px-7
        "
      >
        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <div
            className="
              flex
              h-9
              w-9

              items-center
              justify-center

              rounded-[11px]

              bg-violet-50

              text-violet-600
            "
          >
            <Bot size={19} />
          </div>

          <div>
            <h2
              className="
                text-[14px]
                font-black
                text-slate-900
              "
            >
              المساعد الذكي
            </h2>

            <div
              className="
                mt-0.5
                flex
                items-center
                gap-1.5

                text-[10px]
                font-semibold
                text-slate-400
              "
            >
              <span
                className="
                  h-[6px]
                  w-[6px]

                  rounded-full

                  bg-emerald-500
                "
              />

              جاهز لمساعدتك
            </div>
          </div>
        </div>


        <button
          type="button"
          onClick={
            startNewChat
          }
          className="
            flex
            h-9

            items-center
            gap-2

            rounded-[10px]

            border
            border-slate-200

            bg-white

            px-3

            text-[11px]
            font-semibold
            text-slate-600

            transition

            hover:bg-slate-50
          "
        >
          <Plus size={15} />

          محادثة جديدة
        </button>
      </header>


      {/* ==========================================
          MESSAGES

          هذا الجزء وحده الذي يعمل Scroll
      ========================================== */}

      <section
        className="
          tutor-scrollbar

          min-h-0
          flex-1

          overflow-y-auto
          overflow-x-hidden

          overscroll-contain

          bg-white
        "
      >
        <div
          className="
            mx-auto

            min-h-full
            w-full
            max-w-[860px]

            px-5

            md:px-8
          "
        >
          {conversationLoading ? (
            <div
              className="
                flex
                min-h-full

                items-center
                justify-center
              "
            >
              <Loader2
                size={26}
                className="
                  animate-spin
                  text-violet-600
                "
              />
            </div>
          ) : messages.length === 0 ? (
            <Welcome />
          ) : (
            <div
              className="
                space-y-8

                py-8
              "
            >
              {messages.map(
                (message) => (
                  <MessageBubble
                    key={
                      message.id
                    }
                    message={
                      message
                    }
                  />
                ),
              )}

              {sending && (
                <TypingIndicator />
              )}

              <div
                ref={
                  messagesEndRef
                }
                className="h-1"
              />
            </div>
          )}
        </div>
      </section>


      {/* ==========================================
          ERROR
      ========================================== */}

      {error && (
        <div
          className="
            shrink-0

            border-t
            border-red-100

            bg-red-50

            px-5
            py-2

            text-center

            text-[11px]
            font-bold

            text-red-600
          "
        >
          {error}
        </div>
      )}


      {/* ==========================================
          INPUT

          ثابت دائمًا في الأسفل
      ========================================== */}

      <footer
        className="
          shrink-0

          bg-white

          px-5
          pb-5
          pt-3

          md:px-8
        "
      >
        <div
          className="
            mx-auto

            w-full
            max-w-[860px]
          "
        >
          <div
            className="
              flex

              items-end
              gap-2

              rounded-[24px]

              border
              border-slate-300

              bg-white

              p-2

              shadow-[0_8px_28px_rgba(15,23,42,0.08)]

              transition

              focus-within:border-violet-300
              focus-within:ring-4
              focus-within:ring-violet-50
            "
          >
            <textarea
              ref={
                textareaRef
              }
              value={input}
              onChange={(
                event,
              ) =>
                setInput(
                  event.target.value,
                )
              }
              onKeyDown={
                handleKeyDown
              }
              disabled={sending}
              rows={1}
              maxLength={4000}
              placeholder="اكتب سؤالك هنا..."
              className="
                min-h-[50px]

                flex-1

                resize-none

                overflow-y-auto

                border-0
                bg-transparent

                px-4
                py-[13px]

                text-[14px]
                leading-6

                text-slate-800

                outline-none

                placeholder:text-slate-400
              "
            />


            <button
              type="button"
              onClick={() =>
                sendQuestion()
              }
              disabled={
                sending ||
                !input.trim()
              }
              className="
                flex

                h-[46px]
                w-[46px]

                shrink-0

                items-center
                justify-center

                rounded-full

                bg-slate-900

                text-white

                transition

                hover:bg-violet-600

                disabled:cursor-not-allowed
                disabled:opacity-30
              "
            >
              {sending ? (
                <Loader2
                  size={18}
                  className="
                    animate-spin
                  "
                />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </footer>

    </main>
  </div>
);
}