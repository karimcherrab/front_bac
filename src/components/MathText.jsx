import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

function normalizeMathText(value = "") {
  let s = String(value);

  s = s.replace(/\u200B|\u200C|\u200D|\uFEFF/g, "");
  s = s.replace(/\\tmspace\+\d+mu\.\d+em/g, " ");
  s = s.replace(/\\t/g, " ");
  s = s.replace(/\t/g, " ");

  s = s.replace(/u0/g, "u_0");
  s = s.replace(/u1/g, "u_1");
  s = s.replace(/u2/g, "u_2");
  s = s.replace(/u3/g, "u_3");
  s = s.replace(/un\+1/g, "u_{n+1}");
  s = s.replace(/un/g, "u_n");
  s = s.replace(/vn\+1/g, "v_{n+1}");
  s = s.replace(/vn/g, "v_n");

  s = s.replace(/\\frac\s*([0-9]+)\s*([0-9]+)/g, "\\frac{$1}{$2}");
  s = s.replace(/\\frac([0-9])([0-9])/g, "\\frac{$1}{$2}");

  return s.trim();
}

function autoWrapMath(text = "") {
  let s = normalizeMathText(text);

  if (s.includes("$") || s.includes("\\(") || s.includes("\\[")) return s;

  s = s.replace(
    /((?:u|v)_\{[^}]+\}|(?:u|v)_\d+|(?:u|v)_n)\s*([=<>≤≥].*?)(?=،|\.|؛|\n|$)/g,
    (_, left, rest) => `$${left} ${rest.trim()}$`
  );

  s = s.replace(
    /(\\frac\{[^}]+\}\{[^}]+\})/g,
    "`$1`"
  );

  return s;
}

export function MathBlock({ math, value }) {
  const content = normalizeMathText(math || value);
  if (!content) return null;

  const clean = content
    .replace(/\$\$/g, "")
    .replace(/\$/g, "")
    .replace(/^\\\[/, "")
    .replace(/\\\]$/, "")
    .trim();

  return (
    <div dir="ltr" className="my-3 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-center">
      <BlockMath math={clean} errorColor="#cc0000" />
    </div>
  );
}

export function TextBlock({ children, className = "" }) {
  if (!children) return null;

  const text = autoWrapMath(children);

  return (
    <div dir="rtl" className={`leading-9 text-slate-700 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ children }) {
            return (
              <span dir="ltr" className="mx-1 rounded bg-slate-100 px-1 font-mono">
                {children}
              </span>
            );
          },
          p({ children }) {
            return <p className="mb-2">{children}</p>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}