import { Fragment, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/* =========================================================
   أدوات مساعدة
========================================================= */

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  if (typeof value === "object") {
    return String(
      value.text ??
      value.content ??
      value.title ??
      value.description ??
      value.explanation ??
      value.value ??
      ""
    );
  }

  return String(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/*
 * إصلاح الصيغ التي تصل ناقصة مثل:
 *
 * v_2=5\) و\(v_3=\frac{27}{2}\).
 * q=3\) أو \(q=\frac13
 *
 * النتيجة:
 *
 * \(v_2=5\) و\(v_3=\frac{27}{2}\).
 * \(q=3\) أو \(q=\frac13\)
 */
function repairBrokenMathDelimiters(input) {
  let text = toSafeString(input)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  if (!text.trim()) {
    return "";
  }

  /*
   * تحويل delimiters المكتوبة أحيانًا بصورة مضاعفة.
   */
  text = text
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]");

  /*
   * إصلاح وجود \) من دون \( قبله.
   * نبحث عن بداية الجزء النصي بعد علامات الفصل العربية أو الإنجليزية.
   */
  let balance = 0;
  let result = "";
  let segmentStart = 0;

  for (let index = 0; index < text.length; index += 1) {
    const twoChars = text.slice(index, index + 2);

    if (twoChars === "\\(") {
      balance += 1;
      result += twoChars;
      index += 1;
      continue;
    }

    if (twoChars === "\\)") {
      if (balance > 0) {
        balance -= 1;
        result += twoChars;
      } else {
        /*
         * يوجد إغلاق بلا افتتاح:
         * نضيف \( قبل الجزء الرياضي الأقرب.
         */
        const currentChunk = result.slice(segmentStart);
        const leadingSpaceMatch =
          currentChunk.match(/^\s*/)?.[0] || "";

        const chunkBody = currentChunk.slice(
          leadingSpaceMatch.length
        );

        result =
          result.slice(0, segmentStart) +
          leadingSpaceMatch +
          "\\(" +
          chunkBody +
          "\\)";

        balance = 0;
      }

      index += 1;
      continue;
    }

    result += text[index];

    /*
     * بداية جزء جديد بعد علامات الفصل.
     */
    if (
      text[index] === "\n" ||
      text[index] === "،" ||
      text[index] === ";" ||
      text[index] === ":" ||
      text[index] === "؛"
    ) {
      segmentStart = result.length;
    }
  }

  /*
   * إغلاق أي \( بقي بلا \)
   */
  if (balance > 0) {
    result += "\\)".repeat(balance);
  }

  /*
   * إصلاح \[ من دون \]
   */
  const displayOpenCount =
    (result.match(/\\\[/g) || []).length;
  const displayCloseCount =
    (result.match(/\\\]/g) || []).length;

  if (displayOpenCount > displayCloseCount) {
    result += "\\]".repeat(
      displayOpenCount - displayCloseCount
    );
  }

  /*
   * إصلاح $$ غير المتوازنة.
   */
  const doubleDollarCount =
    (result.match(/\$\$/g) || []).length;

  if (doubleDollarCount % 2 !== 0) {
    result += "$$";
  }

  return result;
}

function renderKatex(latex, displayMode = false) {
  const cleanLatex = String(latex || "").trim();

  if (!cleanLatex) {
    return "";
  }

  try {
    return katex.renderToString(cleanLatex, {
      throwOnError: false,
      displayMode,
      strict: false,
      trust: false,
      output: "html",
    });
  } catch (error) {
    console.error("MathTextParser KaTeX error:", {
      latex: cleanLatex,
      error,
    });

    return escapeHtml(cleanLatex);
  }
}

function cleanDisplayExpression(text) {
  return String(text)
    .trim()
    .replace(/^\\\[/, "")
    .replace(/\\\]$/, "")
    .replace(/^\\\(/, "")
    .replace(/\\\)$/, "")
    .replace(/^\$\$/, "")
    .replace(/\$\$$/, "")
    .replace(/^\$/, "")
    .replace(/\$$/, "")
    .trim();
}

/* =========================================================
   المكوّن الرئيسي
========================================================= */

export default function MathTextParser({
  text,
  className = "",
  display = false,
  dir = "auto",
}) {
  const normalizedText = useMemo(
    () => repairBrokenMathDelimiters(text),
    [text]
  );

  if (!normalizedText.trim()) {
    return null;
  }

  /*
   * عندما تكون القيمة كلها معادلة واحدة.
   */
  if (display) {
    const latex = cleanDisplayExpression(
      normalizedText
    );

    return (
      <div
        dir="ltr"
        className={`max-w-full overflow-x-auto ${className}`}
      >
        <div
          className="min-w-max py-1 text-center"
          dangerouslySetInnerHTML={{
            __html: renderKatex(latex, true),
          }}
        />
      </div>
    );
  }

  /*
   * استخراج الصيغ:
   * \[...\]
   * $$...$$
   * \(...\)
   * $...$
   */
  const mathPattern =
    /(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|\$[^$\n]+?\$)/g;

  const parts = normalizedText.split(mathPattern);

  return (
    <span
      dir={dir}
      className={`whitespace-pre-wrap break-words ${className}`}
    >
      {parts.map((part, index) => {
        if (!part) {
          return null;
        }

        const isBracketDisplay =
          part.startsWith("\\[") &&
          part.endsWith("\\]");

        const isDollarDisplay =
          part.startsWith("$$") &&
          part.endsWith("$$");

        const isBracketInline =
          part.startsWith("\\(") &&
          part.endsWith("\\)");

        const isDollarInline =
          part.startsWith("$") &&
          part.endsWith("$") &&
          !isDollarDisplay;

        if (isBracketDisplay || isDollarDisplay) {
          const latex = part.slice(2, -2);

          return (
            <span
              key={`${index}-${part.slice(0, 12)}`}
              dir="ltr"
              className="my-3 block max-w-full overflow-x-auto text-center"
            >
              <span
                className="inline-block min-w-max"
                dangerouslySetInnerHTML={{
                  __html: renderKatex(latex, true),
                }}
              />
            </span>
          );
        }

        if (isBracketInline || isDollarInline) {
          const latex = isBracketInline
            ? part.slice(2, -2)
            : part.slice(1, -1);

          return (
            <span
              key={`${index}-${part.slice(0, 12)}`}
              dir="ltr"
              className="mx-1 inline-block max-w-full align-middle"
              dangerouslySetInnerHTML={{
                __html: renderKatex(latex, false),
              }}
            />
          );
        }

        return (
          <Fragment key={`${index}-text`}>
            {part}
          </Fragment>
        );
      })}
    </span>
  );
}