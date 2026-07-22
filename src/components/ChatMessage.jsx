import {
  AlertCircle,
  Bot,
  BookOpen,
  User,
} from "lucide-react";

import { MathJax } from "better-react-mathjax";


/**
 * توحيد بعض الصيغ التي قد يعيدها الذكاء الاصطناعي.
 *
 * يدعم:
 * $u_n$
 * $$u_n = 2n + 1$$
 * \(u_n\)
 * \[u_n = 2n + 1\]
 */
function normalizeMathText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value);

  // معالجة أسطر Windows.
  text = text.replace(/\r\n?/g, "\n");

  // إزالة المسافات الغريبة المحيطة بفواصل LaTeX.
  text = text
    .replace(/\\\(\s+/g, "\\(")
    .replace(/\s+\\\)/g, "\\)")
    .replace(/\\\[\s+/g, "\\[")
    .replace(/\s+\\\]/g, "\\]");

  /*
   * تحويل code fences الخاصة بـ LaTeX إلى display math.
   *
   * مثال:
   * ```latex
   * u_n = 2n + 1
   * ```
   */
  text = text.replace(
    /```(?:latex|tex|math)?\s*([\s\S]*?)```/gi,
    (_, formula) => {
      return `\n$$${formula.trim()}$$\n`;
    },
  );

  return text;
}


/**
 * تقسيم الرسالة إلى:
 * - نص عربي عادي
 * - صيغة رياضية inline
 * - صيغة رياضية display
 */
function parseMessageContent(value) {
  const text = normalizeMathText(value);

  if (!text) {
    return [];
  }

  const mathPattern =
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\$)\$(?!\$)[\s\S]*?(?<!\$)\$(?!\$))/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mathPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(
          lastIndex,
          match.index,
        ),
      });
    }

    const rawMath = match[0];

    const isDisplay =
      rawMath.startsWith("$$") ||
      rawMath.startsWith("\\[");

    parts.push({
      type: isDisplay
        ? "display-math"
        : "inline-math",
      content: rawMath,
    });

    lastIndex =
      match.index + rawMath.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return parts;
}


/**
 * تقسيم النص العادي حسب الأسطر حتى نحافظ
 * على الفقرات والأسطر الجديدة.
 */
function PlainText({ content }) {
  const lines = String(content).split("\n");

  return (
    <>
      {lines.map((line, index) => (
        <span
          key={`${index}-${line.slice(0, 20)}`}
          className="contents"
        >
          {line && (
            <span
              dir="auto"
              className={[
                "whitespace-pre-wrap",
                "break-words",
                "[unicode-bidi:plaintext]",
              ].join(" ")}
            >
              {line}
            </span>
          )}

          {index < lines.length - 1 && (
            <br />
          )}
        </span>
      ))}
    </>
  );
}


/**
 * عرض النص والصيغ الرياضية داخل الرسالة.
 */
function MessageContent({ text }) {
  const parts = parseMessageContent(text);

  if (parts.length === 0) {
    return null;
  }

  return (
    <div
      dir="rtl"
      className={[
        "min-w-0 max-w-full",
        "text-right",
      ].join(" ")}
    >
      {parts.map((part, index) => {
        const key =
          `${part.type}-${index}-${part.content.slice(0, 20)}`;

        if (part.type === "display-math") {
          return (
            <div
              key={key}
              dir="ltr"
              className={[
                "my-3 w-full max-w-full",
                "overflow-x-auto overflow-y-hidden",
                "rounded-xl border border-slate-200/70",
                "bg-white/80 px-3 py-3",
                "text-center",
                "[unicode-bidi:isolate]",
                "[&_.MathJax]:max-w-full",
                "[&_.MathJax]:overflow-x-auto",
                "[&_.MathJax]:overflow-y-hidden",
                "[&_.mjx-container]:my-0",
                "[&_.mjx-container]:max-w-full",
                "[&_.mjx-container]:overflow-x-auto",
                "[&_.mjx-container]:overflow-y-hidden",
                "[&_.mjx-container]:text-left",
              ].join(" ")}
            >
              <MathJax
                dynamic
                hideUntilTypeset="first"
              >
                {part.content}
              </MathJax>
            </div>
          );
        }

        if (part.type === "inline-math") {
          return (
            <span
              key={key}
              dir="ltr"
              className={[
                "mx-1 inline-flex max-w-full",
                "align-middle",
                "[unicode-bidi:isolate]",
                "[&_.MathJax]:max-w-full",
                "[&_.mjx-container]:inline-block",
                "[&_.mjx-container]:max-w-full",
                "[&_.mjx-container]:overflow-x-auto",
                "[&_.mjx-container]:overflow-y-hidden",
              ].join(" ")}
            >
              <MathJax
                inline
                dynamic
                hideUntilTypeset="first"
              >
                {part.content}
              </MathJax>
            </span>
          );
        }

        return (
          <PlainText
            key={key}
            content={part.content}
          />
        );
      })}
    </div>
  );
}


export default function ChatMessage({
  message,
}) {
  const isBot =
    message?.from === "bot";

  const isError =
    message?.type === "error";

  const axisTitle =
    message?.metadata?.axisTitle || "";

  const mode =
    message?.metadata?.mode || "";

  return (
    <div
      dir="rtl"
      className={[
        "flex min-w-0 items-start gap-2.5",
        isBot ? "" : "flex-row-reverse",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-8 w-8 shrink-0 items-center",
          "justify-center rounded-full",
          isError
            ? "bg-red-100 text-red-600"
            : isBot
              ? "bg-brand-100 text-brand-600"
              : "bg-slate-200 text-slate-600",
        ].join(" ")}
      >
        {isError ? (
          <AlertCircle size={16} />
        ) : isBot ? (
          <Bot size={16} />
        ) : (
          <User size={16} />
        )}
      </div>

      <div
        className={[
          "flex min-w-0 max-w-[86%]",
          "flex-col gap-1",
          isBot
            ? "items-start"
            : "items-end",
        ].join(" ")}
      >
        <div
          className={[
            "w-full min-w-0 max-w-full",
            "break-words rounded-2xl",
            "px-4 py-3 text-sm leading-7",
            "overflow-hidden",
            isError
              ? [
                  "rounded-tr-sm border",
                  "border-red-100 bg-red-50",
                  "text-red-700",
                ].join(" ")
              : isBot
                ? [
                    "rounded-tr-sm border",
                    "border-slate-100",
                    "bg-slate-50 text-slate-900",
                  ].join(" ")
                : [
                    "rounded-tl-sm",
                    "bg-brand-500 text-white",
                  ].join(" "),
          ].join(" ")}
        >
          <MessageContent
            text={message?.text || ""}
          />
        </div>

        {isBot &&
          !isError &&
          (axisTitle || mode) && (
            <div
              className={[
                "flex max-w-full flex-wrap",
                "items-center gap-1.5 px-1",
              ].join(" ")}
            >
              {axisTitle && (
                <span
                  className={[
                    "inline-flex max-w-full",
                    "items-center gap-1",
                    "rounded-md bg-slate-100",
                    "px-2 py-1 text-[10px]",
                    "text-slate-500",
                  ].join(" ")}
                >
                  <BookOpen
                    size={11}
                    className="shrink-0"
                  />

                  <span className="truncate">
                    {axisTitle}
                  </span>
                </span>
              )}

              {mode && (
                <span
                  className={[
                    "rounded-md bg-brand-50",
                    "px-2 py-1 text-[10px]",
                    "text-brand-600",
                  ].join(" ")}
                >
                  {getModeLabel(mode)}
                </span>
              )}
            </div>
          )}

        {message?.time && (
          <span className="px-1 text-[10px] text-slate-400">
            {message.time}
          </span>
        )}
      </div>
    </div>
  );
}


function getModeLabel(mode) {
  const labels = {
    explanation: "شرح",
    definition: "تعريف",
    formula: "صيغة",
    method: "منهجية",
    example: "مثال",
    hint: "تلميح",
    exercise: "تمرين",
    correction: "تصحيح",
    recommendation: "اقتراح",
    bac_question: "سؤال بكالوريا",
    general: "إجابة عامة",
  };

  return labels[mode] || mode;
}