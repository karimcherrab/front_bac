import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  GraduationCap,
  History,
  ImagePlus,
  Keyboard,
  PenLine,
  Sigma,
  Undo2,
  Lightbulb,
  ListChecks,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  X,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import Cookies from "js-cookie";
import "mathlive";

import { UserContext } from "../../Utils/UserContext";

const بطاقة =
  "rounded-[30px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.055)]";

function دمج(...القيم) {
  return القيم.filter(Boolean).join(" ");
}

function رمز_الدخول() {
  return Cookies.get("access_token") || localStorage.getItem("access_token") || "";
}

function رابط_الخادم() {
  const raw = (
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BASE_URL ||
    "http://127.0.0.1:8000/api"
  ).replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

const الخادم = axios.create({
  baseURL: رابط_الخادم(),
  timeout: 180000,
  headers: { "Content-Type": "application/json" },
});

الخادم.interceptors.request.use((config) => {
  const token = رمز_الدخول();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Axios must generate the multipart boundary itself for photographed solutions.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    if (typeof config.headers?.delete === "function") {
      config.headers.delete("Content-Type");
    } else if (config.headers) {
      delete config.headers["Content-Type"];
    }
  }
  return config;
});

function رسالة_الخطأ(error) {
  const data = error?.response?.data;
  const candidates = [data?.detail, data?.message, data?.error];
  const arabic = candidates.find(
    (value) => typeof value === "string" && /[\u0600-\u06FF]/.test(value),
  );
  if (arabic) return arabic;

  const status = Number(error?.response?.status || 0);
  if (!error?.response) {
    return "تعذر الاتصال بالخادم الآن. تحقق من الاتصال ثم أعد المحاولة.";
  }
  if (status === 401 || status === 403) {
    return "انتهت جلسة الدخول أو لا تملك صلاحية تنفيذ هذا الإجراء.";
  }
  if (status === 404) {
    return "تعذر العثور على بيانات الاختبار المطلوبة.";
  }
  if (status === 409) {
    return "لا توجد أفكار صالحة للاختبار في هذا المحور حاليًا.";
  }
  if (status === 422) {
    return "تعذر إنشاء التمرين بصيغة صحيحة. أعد المحاولة بعد قليل.";
  }
  if (status === 429) {
    return "خدمة إنشاء التمارين مشغولة قليلًا. أعد المحاولة بعد لحظات، ولن يضيع تقدمك.";
  }
  if (status >= 500) {
    return "حدث عطل مؤقت أثناء تجهيز الاختبار. تقدمك محفوظ ويمكنك إعادة المحاولة.";
  }
  return "حدث خطأ غير متوقع. أعد المحاولة من فضلك.";
}

function تهيئة_الاختبار(data) {
  if (!data) return null;
  const test = data.test && data.test.id ? data.test : data;
  return {
    ...test,
    test_questions: test.test_questions || test.questions || [],
    sequence_progress: data.sequence_progress || test.sequence_progress || null,
  };
}

function تهيئة_الإجابة(data) {
  if (!data) return null;
  return {
    ...data,
    score: Number(data.score || 0),
    percentage: Number(data.percentage ?? Number(data.score || 0) * 100),
    teacher_feedback: data.teacher_feedback || {},
  };
}

function تقدم_الاختبار(test) {
  if (test?.sequence_progress) return test.sequence_progress;
  const blueprint = test?.blueprint || {};
  const slots = blueprint.slots || [];
  const runtime = blueprint.runtime || {};
  const cursor = Math.min(Number(runtime.cursor_index || 0), slots.length);
  const current = slots[cursor] || null;
  return {
    total_targets: slots.length,
    completed_targets: cursor,
    remaining_targets: Math.max(slots.length - cursor, 0),
    current_target_number: current ? cursor + 1 : slots.length,
    current_target: current,
    current_target_label:
      current?.skill_idea_name ||
      current?.variant_title ||
      current?.bac_idea_title ||
      "",
    current_difficulty: current?.difficulty ?? null,
    progress_percentage: slots.length ? Math.round((cursor / slots.length) * 100) : 100,
    axis_mastered: Boolean(slots.length && cursor >= slots.length),
  };
}

function وصف_الصعوبة(value) {
  const n = Number(value || 1);
  if (n <= 1) return "سهل";
  if (n === 2) return "متوسط";
  if (n === 3) return "متوسط متقدم";
  if (n === 4) return "صعب";
  return "متقدم";
}

function تنظيف_لاتكس(value) {
  let text = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!text) return "";

  // بعض النماذج قد ترجع المحددات نفسها داخل القيمة.
  if (
    (text.startsWith("\\(") && text.endsWith("\\)")) ||
    (text.startsWith("\\[") && text.endsWith("\\]"))
  ) {
    text = text.slice(2, -2).trim();
  } else if (text.startsWith("$$") && text.endsWith("$$")) {
    text = text.slice(2, -2).trim();
  } else if (text.startsWith("$") && text.endsWith("$")) {
    text = text.slice(1, -1).trim();
  }

  // إصلاحات دفاعية لأخطاء شائعة في النص المولد.
  // لا تغير المعنى الرياضي، بل تصلح أوامر TeX غير الصحيحة الأكثر شيوعًا.
  return text
    .replace(/\\lge\b/g, "\\ge")
    .replace(/\\lle\b/g, "\\le")
    .replace(/\\geqslant\b/g, "\\ge")
    .replace(/\\leqslant\b/g, "\\le")
    .replace(/\\operatorname\s*\{ln\}/g, "\\ln")
    .replace(/\\operatorname\s*\{log\}/g, "\\log")
    .replace(/\\{2,}(?=[A-Za-z])/g, "\\");
}

function رياضيات_ثابتة({ latex, className = "", display = false }) {
  const ref = useRef(null);
  const value = useMemo(() => تنظيف_لاتكس(latex), [latex]);

  useEffect(() => {
    const field = ref.current;
    if (!field) return;

    field.value = value;
    field.readOnly = true;

    // MathLive API تختلف قليلًا بين الإصدارات؛ هذه الخصائص آمنة عند توفرها.
    try {
      field.setOptions?.({
        readOnly: true,
        smartMode: false,
        virtualKeyboardMode: "off",
      });
    } catch {
      // لا شيء: العرض يظل يعمل على الإصدارات القديمة.
    }
  }, [value]);

  if (!value) return null;

  return (
    <math-field
      ref={ref}
      read-only
      tabIndex={-1}
      dir="ltr"
      virtual-keyboard-mode="off"
      className={دمج(
        "pointer-events-none max-w-full border-0 bg-transparent p-0 text-slate-900 outline-none",
        display ? "block w-max min-w-0 text-[22px] sm:text-[25px]" : "inline-block text-[18px] sm:text-[19px]",
        className,
      )}
      style={{
        "--caret-color": "transparent",
        "--selection-background-color": "transparent",
        "--contains-highlight-background-color": "transparent",
        "--smart-fence-color": "currentColor",
      }}
    />
  );
}

function يبدو_رياضيا(value) {
  const text = تنظيف_لاتكس(value);
  if (!text) return false;

  return /(?:\\(?:frac|dfrac|tfrac|sqrt|lim|int|sum|prod|sin|cos|tan|ln|log|exp|vec|overrightarrow|overline|underline|ge|le|neq|approx|sim|infty|cdot|times|div|left|right|Bigl|Bigr|bigl|bigr|displaystyle|mathbb|mathcal|mathrm|text|begin|end)\b|[_^=<>±×÷∞≤≥∑∏√]|[A-Za-z]\s*_[{A-Za-z0-9]|[A-Za-z]\s*\^[{A-Za-z0-9]|\b(?:ln|log|sin|cos|tan|exp)\s*[({]|\b[A-Za-z]\s*=)/.test(text);
}

function نزع_غلاف_الرياضيات(raw) {
  const value = String(raw || "");
  if (value.startsWith("$$") && value.endsWith("$$")) return value.slice(2, -2);
  if (value.startsWith("$") && value.endsWith("$")) return value.slice(1, -1);
  if (value.startsWith("\\(") && value.endsWith("\\)")) return value.slice(2, -2);
  if (value.startsWith("\\[") && value.endsWith("\\]")) return value.slice(2, -2);
  return value;
}

function تقسيم_النص_الصريح(value) {
  const text = String(value || "");
  if (!text) return [];

  // يدعم: $...$ و $$...$$ و \(...\) و \[...\]
  const explicit = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g;
  const pieces = [];
  let last = 0;
  let match;

  while ((match = explicit.exec(text)) !== null) {
    if (match.index > last) {
      pieces.push({ type: "text", value: text.slice(last, match.index) });
    }
    pieces.push({ type: "math", value: نزع_غلاف_الرياضيات(match[0]) });
    last = match.index + match[0].length;
  }

  if (last < text.length) pieces.push({ type: "text", value: text.slice(last) });
  return pieces.length ? pieces : [{ type: "text", value: text }];
}

function تقسيم_تلقائي_للنص_المختلط(value) {
  const text = String(value || "");
  if (!text) return [];

  /*
   * Fallback مهم: أحيانًا يرجع الـAI النص العربي ومعه LaTeX بلا $...$.
   * نفصل المقاطع غير العربية ثم نختبر هل هي صيغة رياضية فعلًا.
   * بهذه الطريقة لا يظهر للمستخدم: 5\\cdot أو \\displaystyle كنص خام.
   */
  const parts = [];
  const nonArabicRun = /[^\u0600-\u06FF]+/g;
  let cursor = 0;
  let match;

  while ((match = nonArabicRun.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, match.index) });
    }

    const raw = match[0];
    const leading = raw.match(/^\s*/)?.[0] || "";
    const trailing = raw.match(/\s*$/)?.[0] || "";
    let core = raw.slice(leading.length, raw.length - trailing.length);

    // افصل علامات الترقيم العربية/العامة عن طرفي الصيغة حتى لا تدخل داخل MathLive.
    const leftPunctuation = core.match(/^[،؛:!?؟.\-–—]+\s*/)?.[0] || "";
    const rightPunctuation = core.match(/\s*[،؛:!?؟.\-–—]+$/)?.[0] || "";
    core = core.slice(
      leftPunctuation.length,
      rightPunctuation ? core.length - rightPunctuation.length : core.length,
    );

    if (leading) parts.push({ type: "text", value: leading });
    if (leftPunctuation) parts.push({ type: "text", value: leftPunctuation });

    if (core) {
      parts.push({
        type: يبدو_رياضيا(core) ? "math" : "text",
        value: core,
      });
    }

    if (rightPunctuation) parts.push({ type: "text", value: rightPunctuation });
    if (trailing) parts.push({ type: "text", value: trailing });
    cursor = match.index + raw.length;
  }

  if (cursor < text.length) parts.push({ type: "text", value: text.slice(cursor) });
  return parts.length ? parts : [{ type: "text", value: text }];
}

function دمج_الأجزاء_المتشابهة(parts) {
  return (parts || []).reduce((acc, part) => {
    if (!part?.value) return acc;
    const previous = acc[acc.length - 1];
    if (previous && previous.type === part.type) {
      previous.value += part.value;
    } else {
      acc.push({ ...part });
    }
    return acc;
  }, []);
}

function أجزاء_النص_الرياضي(value) {
  const text = String(value || "");
  if (!text) return [];

  const explicitParts = تقسيم_النص_الصريح(text);
  const output = [];

  for (const part of explicitParts) {
    if (part.type === "math") {
      output.push({ type: "math", value: تنظيف_لاتكس(part.value) });
      continue;
    }

    // إذا لم تكن هناك محددات في هذا الجزء نطبق fallback على النص المختلط.
    output.push(...تقسيم_تلقائي_للنص_المختلط(part.value));
  }

  return دمج_الأجزاء_المتشابهة(output);
}

function نص_رياضي_ذكي({ children, className = "", block = false }) {
  const parts = useMemo(() => أجزاء_النص_الرياضي(children), [children]);
  const Wrapper = block ? "div" : "span";

  return (
    <Wrapper
      dir="rtl"
      className={دمج(
        "whitespace-pre-wrap break-words text-right [unicode-bidi:plaintext]",
        block ? "leading-[2.15]" : "leading-8",
        className,
      )}
    >
      {parts.map((part, index) =>
        part.type === "math" ? (
          <span
            key={`${index}-${part.value}`}
            dir="ltr"
            className="mx-1 inline-flex max-w-full items-center align-middle"
          >
            <رياضيات_ثابتة
              latex={part.value}
              className="rounded-lg bg-slate-50/90 px-1.5 py-0.5 ring-1 ring-slate-200/60"
            />
          </span>
        ) : (
          <span key={`${index}-${part.value}`}>{part.value}</span>
        ),
      )}
    </Wrapper>
  );
}

function رقم_آمن(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function رسم_منحنى({ visual }) {
  const width = 640;
  const height = 360;
  const pad = 42;
  const xMin = رقم_آمن(visual?.x_min, -5);
  const xMax = رقم_آمن(visual?.x_max, 5);
  const yMin = رقم_آمن(visual?.y_min, -5);
  const yMax = رقم_آمن(visual?.y_max, 5);
  const safeXMax = xMax > xMin ? xMax : xMin + 1;
  const safeYMax = yMax > yMin ? yMax : yMin + 1;
  const sx = (x) => pad + ((x - xMin) / (safeXMax - xMin)) * (width - pad * 2);
  const sy = (y) => height - pad - ((y - yMin) / (safeYMax - yMin)) * (height - pad * 2);
  const xTicks = Array.from({ length: 7 }, (_, i) => xMin + ((safeXMax - xMin) * i) / 6);
  const yTicks = Array.from({ length: 7 }, (_, i) => yMin + ((safeYMax - yMin) * i) / 6);
  const axisX = yMin <= 0 && safeYMax >= 0 ? sy(0) : height - pad;
  const axisY = xMin <= 0 && safeXMax >= 0 ? sx(0) : pad;

  return (
    <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[560px] w-full" role="img" aria-label={visual?.title || "منحنى بياني"}>
        <defs>
          <marker id={`arrow-${visual?.id || "graph"}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill="currentColor" />
          </marker>
        </defs>
        {xTicks.map((value, index) => (
          <g key={`xg-${index}`}>
            <line x1={sx(value)} y1={pad} x2={sx(value)} y2={height - pad} stroke="currentColor" opacity="0.08" />
            <text x={sx(value)} y={height - 16} textAnchor="middle" className="fill-slate-400 text-[11px]">
              {Number(value.toFixed(2))}
            </text>
          </g>
        ))}
        {yTicks.map((value, index) => (
          <g key={`yg-${index}`}>
            <line x1={pad} y1={sy(value)} x2={width - pad} y2={sy(value)} stroke="currentColor" opacity="0.08" />
            <text x={25} y={sy(value) + 4} textAnchor="middle" className="fill-slate-400 text-[11px]">
              {Number(value.toFixed(2))}
            </text>
          </g>
        ))}
        <line x1={pad} y1={axisX} x2={width - pad + 8} y2={axisX} stroke="currentColor" className="text-slate-500" markerEnd={`url(#arrow-${visual?.id || "graph"})`} />
        <line x1={axisY} y1={height - pad} x2={axisY} y2={pad - 8} stroke="currentColor" className="text-slate-500" markerEnd={`url(#arrow-${visual?.id || "graph"})`} />
        {(visual?.series || []).map((serie, index) => {
          const points = (serie?.points || [])
            .filter((point) => Array.isArray(point) && point.length === 2)
            .map(([x, y]) => `${sx(رقم_آمن(x))},${sy(رقم_آمن(y))}`)
            .join(" ");
          return (
            <g key={`series-${index}`}>
              <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className={index % 2 === 0 ? "text-emerald-700" : "text-sky-700"} />
              {serie?.label && (
                <text x={width - pad - 8} y={pad + 18 + index * 18} textAnchor="end" className="fill-slate-600 text-[12px] font-bold">
                  {serie.label}
                </text>
              )}
            </g>
          );
        })}
        {visual?.x_label && <text x={width - 20} y={axisX - 9} className="fill-slate-600 text-[12px] font-bold">{visual.x_label}</text>}
        {visual?.y_label && <text x={axisY + 10} y={20} className="fill-slate-600 text-[12px] font-bold">{visual.y_label}</text>}
      </svg>
    </div>
  );
}

function جدول_مرئي({ visual }) {
  const columns = Array.isArray(visual?.columns) ? visual.columns : [];
  const rows = Array.isArray(visual?.rows) ? visual.rows : [];
  return (
    <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
      <table className="min-w-full border-collapse text-center text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="border-b border-l border-slate-200 px-4 py-3 text-xs font-black text-slate-500">البيان</th>
            {columns.map((column, index) => (
              <th key={index} className="min-w-[90px] border-b border-l border-slate-200 px-4 py-3 font-black text-slate-700">
                <نص_رياضي_ذكي>{column}</نص_رياضي_ذكي>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/45">
              <th className="whitespace-nowrap border-b border-l border-slate-100 px-4 py-3 text-xs font-black text-emerald-800">{row?.label || ""}</th>
              {(row?.cells || []).map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-l border-slate-100 px-4 py-3 font-bold text-slate-700">
                  <نص_رياضي_ذكي>{cell}</نص_رياضي_ذكي>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function تحليل_أمر_رسم(raw) {
  const text = String(raw || "").trim();
  const [head = ""] = text.split(/\s+/, 1);
  const kind = head.toLowerCase();
  const rest = text.slice(head.length).trim();
  if (!kind) return null;

  if (kind === "polyline" || kind === "polygon") {
    const matches = [...rest.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)];
    return { kind, points: matches.map((m) => [رقم_آمن(m[1]), رقم_آمن(m[2])]) };
  }
  if (kind === "text") {
    const match = rest.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(.+)$/);
    return match ? { kind, x: رقم_آمن(match[1]), y: رقم_آمن(match[2]), label: match[3] } : null;
  }

  const required = { line: 4, arrow: 4, point: 2, circle: 3, rect: 4 }[kind];
  if (!required) return null;
  const parts = rest.split(/\s+/);
  if (parts.length < required) return null;
  const nums = parts.slice(0, required).map((value) => رقم_آمن(value));
  const label = parts.slice(required).join(" ");
  return { kind, nums, label };
}

function رسم_مخطط({ visual }) {
  const commands = (visual?.commands || []).map(تحليل_أمر_رسم).filter(Boolean);
  const markerId = `diagram-arrow-${visual?.id || "v"}`;
  const label = (x, y, text, key) => text ? (
    <text key={key} x={x} y={y} textAnchor="middle" className="fill-slate-700 text-[4px] font-bold">{text}</text>
  ) : null;

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-3">
      <svg viewBox="0 0 100 100" className="mx-auto h-auto max-h-[470px] w-full max-w-3xl" role="img" aria-label={visual?.title || "رسم توضيحي"}>
        <defs>
          <marker id={markerId} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L0,5 L5,2.5 z" fill="currentColor" />
          </marker>
        </defs>
        {commands.map((command, index) => {
          if (command.kind === "polyline" || command.kind === "polygon") {
            const points = command.points.map(([x, y]) => `${x},${y}`).join(" ");
            return command.kind === "polygon" ? (
              <polygon key={index} points={points} fill="none" stroke="currentColor" strokeWidth="0.7" className="text-slate-700" />
            ) : (
              <polyline key={index} points={points} fill="none" stroke="currentColor" strokeWidth="0.7" className="text-slate-700" />
            );
          }
          if (command.kind === "text") return label(command.x, command.y, command.label, index);
          const n = command.nums || [];
          if (command.kind === "line" || command.kind === "arrow") {
            return (
              <g key={index}>
                <line x1={n[0]} y1={n[1]} x2={n[2]} y2={n[3]} stroke="currentColor" strokeWidth="0.8" className="text-slate-700" markerEnd={command.kind === "arrow" ? `url(#${markerId})` : undefined} />
                {label((n[0] + n[2]) / 2, (n[1] + n[3]) / 2 - 2, command.label, `${index}-l`)}
              </g>
            );
          }
          if (command.kind === "point") {
            return (
              <g key={index}>
                <circle cx={n[0]} cy={n[1]} r="1.15" className="fill-emerald-800" />
                {label(n[0] + 4, n[1] - 3, command.label, `${index}-l`)}
              </g>
            );
          }
          if (command.kind === "circle") {
            return (
              <g key={index}>
                <circle cx={n[0]} cy={n[1]} r={n[2]} fill="none" stroke="currentColor" strokeWidth="0.8" className="text-slate-700" />
                {label(n[0], n[1] - n[2] - 2, command.label, `${index}-l`)}
              </g>
            );
          }
          if (command.kind === "rect") {
            return (
              <g key={index}>
                <rect x={n[0]} y={n[1]} width={n[2]} height={n[3]} fill="none" stroke="currentColor" strokeWidth="0.8" className="text-slate-700" />
                {label(n[0] + n[2] / 2, n[1] - 2, command.label, `${index}-l`)}
              </g>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}

function رسم_تعليمي({ visual }) {
  if (!visual) return null;
  return (
    <figure className="my-5 rounded-[28px] border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      {(visual.title || visual.caption) && (
        <figcaption className="mb-4">
          {visual.title && <p className="text-sm font-black text-slate-800">{visual.title}</p>}
          {visual.caption && <p className="mt-1 text-xs font-bold leading-6 text-slate-500">{visual.caption}</p>}
        </figcaption>
      )}
      {visual.kind === "function_graph" ? (
        <رسم_منحنى visual={visual} />
      ) : ["variation_table", "sign_table", "data_table"].includes(visual.kind) ? (
        <جدول_مرئي visual={visual} />
      ) : (
        <رسم_مخطط visual={visual} />
      )}
    </figure>
  );
}

function رسومات_التعليم({ visuals, placement, afterStep = null }) {
  const list = (Array.isArray(visuals) ? visuals : []).filter((visual) => {
    if (visual?.placement !== placement) return false;
    if (afterStep === null) return true;
    return Number(visual?.after_step || 0) === Number(afterStep);
  });
  if (!list.length) return null;
  return <div>{list.map((visual, index) => <رسم_تعليمي key={visual?.id || index} visual={visual} />)}</div>;
}

function نص_السؤال({ question }) {
  const blocks = Array.isArray(question?.statement_blocks)
    ? question.statement_blocks.filter((block) => String(block?.value || "").trim())
    : [];

  if (!blocks.length) {
    return (
      <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-sm font-black text-amber-900">تعذر عرض نص التمرين.</p>
        <p className="mt-1 text-xs font-bold leading-6 text-amber-700">
          أعد توليد التمرين حتى يصل نص صالح للعرض.
        </p>
      </div>
    );
  }

  const هل_صيغة_عرض = (block) => {
    if (block?.display === "inline") return false;
    if (block?.display === "block") return true;

    const latex = تنظيف_لاتكس(block?.value);
    return (
      latex.length > 34 ||
      /\\(?:displaystyle|frac|dfrac|sum|prod|int|lim|begin)\b/.test(latex)
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 px-5 py-5 sm:px-7 sm:py-6">
        <div className="space-y-3.5">
          {blocks.map((block, index) => {
            const key = `${index}-${block?.type || "text"}`;

            if (block?.type === "math") {
              const display = هل_صيغة_عرض(block);

              if (!display) {
                return (
                  <div
                    key={key}
                    dir="rtl"
                    className="text-right text-[15px] font-bold leading-9 text-slate-700 sm:text-[16px]"
                  >
                    <span
                      dir="ltr"
                      className="inline-flex max-w-full rounded-xl bg-emerald-50/70 px-2.5 py-1 align-middle ring-1 ring-emerald-100"
                    >
                      <رياضيات_ثابتة latex={block.value} />
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={key}
                  dir="ltr"
                  className="my-4 overflow-x-auto rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:px-7 sm:py-6"
                >
                  <div className="flex min-w-max justify-center">
                    <رياضيات_ثابتة
                      latex={block.value}
                      display
                      className="text-[22px] sm:text-[26px]"
                    />
                  </div>
                </div>
              );
            }

            return (
              <نص_رياضي_ذكي
                key={key}
                block
                className="text-[15px] font-bold text-slate-700 sm:text-[16px]"
              >
                {block?.value || ""}
              </نص_رياضي_ذكي>
            );
          })}
        </div>
      </div>

      <رسومات_التعليم
        visuals={question?.visuals || []}
        placement="question"
        afterStep={0}
      />
    </div>
  );
}

function تنبيه({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-rose-200 bg-rose-50 p-4 text-rose-900 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertCircle size={19} className="mt-0.5 shrink-0" />
        <p className="text-sm font-bold leading-7">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-black transition hover:-translate-y-0.5"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

function حقل_رياضيات({ value, onChange, onFocus, disabled, registerRef }) {
  const ref = useRef(null);

  useEffect(() => {
    registerRef?.(ref.current);
    return () => registerRef?.(null);
  }, [registerRef]);

  useEffect(() => {
    if (!ref.current) return;
    const wanted = String(value || "");
    if (ref.current.value !== wanted) ref.current.value = wanted;
  }, [value]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const handleInput = () => onChange?.(element.value || "");
    const handleFocus = () => onFocus?.();
    element.addEventListener("input", handleInput);
    element.addEventListener("focusin", handleFocus);
    return () => {
      element.removeEventListener("input", handleInput);
      element.removeEventListener("focusin", handleFocus);
    };
  }, [onChange, onFocus]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.readOnly = Boolean(disabled);
  }, [disabled]);

  return (
    <math-field
      ref={ref}
      dir="ltr"
      math-virtual-keyboard-policy="auto"
      className={دمج(
        "block min-h-[66px] w-full rounded-2xl border bg-white px-4 py-3 text-[21px] outline-none transition",
        disabled
          ? "border-slate-200 bg-slate-50"
          : "border-slate-200 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-100",
      )}
    />
  );
}

const أدوات_الرياضيات = [
  { label: "كسر", symbol: "\\frac{a}{b}", value: "\\frac{#0}{#?}" },
  { label: "جذر", symbol: "\\sqrt{x}", value: "\\sqrt{#0}" },
  { label: "قوة", symbol: "x^{n}", value: "^{#0}" },
  { label: "نهاية", symbol: "\\lim_{x\\to a}", value: "\\lim_{#0\\to #?}" },
  { label: "اشتقاق", symbol: "f'(x)", value: "f'(#0)" },
  { label: "تكامل", symbol: "\\int_a^b", value: "\\int_{#0}^{#?}" },
  { label: "مجموع", symbol: "\\sum", value: "\\sum_{#0}^{#?}" },
  { label: "لانهاية", symbol: "\\infty", value: "\\infty" },
  { label: "أكبر أو يساوي", symbol: "\\ge", value: "\\ge" },
  { label: "أصغر أو يساوي", symbol: "\\le", value: "\\le" },
  { label: "متجه", symbol: "\\overrightarrow{AB}", value: "\\overrightarrow{#0}" },
  { label: "ينتمي", symbol: "\\in", value: "\\in" },
];

const بدايات_الشرح = [
  "نحسب", "نعوض", "نستنتج", "إذن", "ومنه", "بما أن", "لدينا", "حسب المعطيات",
];

function محرر_الحل({ steps, onChange, disabled }) {
  const safeSteps = Array.isArray(steps) && steps.length
    ? steps.map((step) => ({ text: String(step?.text || step?.explanation || ""), latex: String(step?.latex || "") }))
    : [{ text: "", latex: "" }];
  const [activeIndex, setActiveIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showSymbols, setShowSymbols] = useState(true);
  const fieldRefs = useRef({});

  useEffect(() => {
    if (activeIndex >= safeSteps.length) setActiveIndex(Math.max(0, safeSteps.length - 1));
  }, [activeIndex, safeSteps.length]);

  function updateStep(index, patch) {
    const next = safeSteps.map((step, i) => (i === index ? { ...step, ...patch } : step));
    onChange(next);
  }

  function addStep() {
    if (disabled) return;
    const next = [...safeSteps, { text: "", latex: "" }];
    onChange(next);
    const nextIndex = next.length - 1;
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => fieldRefs.current[nextIndex]?.focus?.());
  }

  function removeStep(index) {
    if (disabled) return;
    if (safeSteps.length === 1) {
      onChange([{ text: "", latex: "" }]);
      return;
    }
    const next = safeSteps.filter((_, i) => i !== index);
    onChange(next);
    setActiveIndex(Math.max(0, Math.min(index - 1, next.length - 1)));
  }

  function insertMath(value) {
    if (disabled) return;
    const field = fieldRefs.current[activeIndex];
    if (!field) return;
    field.focus?.();
    if (typeof field.insert === "function") {
      field.insert(value, { selectionMode: "replace" });
      updateStep(activeIndex, { latex: field.value || "" });
    } else {
      updateStep(activeIndex, { latex: `${safeSteps[activeIndex]?.latex || ""}${value}` });
    }
  }

  function addExplanationStart(value) {
    if (disabled) return;
    const old = safeSteps[activeIndex]?.text || "";
    updateStep(activeIndex, { text: old ? `${old} ${value}` : value });
  }

  const completed = safeSteps.filter(
    (step) => String(step?.latex || "").trim() || String(step?.text || "").trim(),
  ).length;

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[#fbfcfc] shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
      <div className="border-b border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
              <PenLine size={20} />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900">دفتر الحل الذكي</h4>
              <p className="mt-1 max-w-xl text-xs font-bold leading-6 text-slate-500">
                اكتب كما تكتب في ورقة البكالوريا: جملة قصيرة تشرح فكرتك، ثم السطر الرياضي تحتها. لا تحتاج إلى معرفة أوامر رياضية.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-600">
              {completed} خطوة
            </span>
            <button
              type="button"
              onClick={() => setShowSymbols((value) => !value)}
              disabled={disabled}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:border-emerald-300 disabled:opacity-40"
            >
              {showSymbols ? "إخفاء لوحة الرموز" : "إظهار لوحة الرموز"}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((value) => !value)}
              className="rounded-full bg-emerald-800 px-3.5 py-2 text-[11px] font-black text-white transition hover:bg-emerald-900"
            >
              {showPreview ? "متابعة الكتابة" : "معاينة الحل"}
            </button>
          </div>
        </div>
      </div>

      {!showPreview && showSymbols && !disabled && (
        <div className="border-b border-slate-200 bg-gradient-to-l from-emerald-50/80 to-white px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 text-slate-600">
                <Sigma size={16} className="text-emerald-700" />
                <p className="text-[11px] font-black">رموز رياضية — اضغط لإدراجها في الخطوة الحالية</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {أدوات_الرياضيات.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    title={item.label}
                    onClick={() => insertMath(item.value)}
                    className="group flex min-h-11 min-w-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                  >
                    <رياضيات_ثابتة latex={item.symbol} className="pointer-events-none text-[17px]" />
                  </button>
                ))}
              </div>
            </div>
            <div className="xl:max-w-[300px]">
              <p className="mb-2 text-[11px] font-black text-slate-600">بداية سريعة للشرح</p>
              <div className="flex flex-wrap gap-2">
                {بدايات_الشرح.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => addExplanationStart(item)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-black text-slate-600 transition hover:border-emerald-300 hover:text-emerald-800"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPreview ? (
        <div className="p-5 sm:p-7">
          <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center justify-between border-b border-dashed border-slate-200 pb-4">
              <div>
                <h5 className="font-black text-slate-900">حل التلميذ</h5>
                <p className="mt-1 text-[11px] font-bold text-slate-400">معاينة كما سيقرأ الأستاذ خطواتك</p>
              </div>
              <ListChecks size={20} className="text-emerald-700" />
            </div>
            <div className="space-y-5">
              {safeSteps.map((step, index) => (
                <div key={index} className="relative pr-12">
                  <span className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-800 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  {step.text && (
                    <p dir="rtl" className="mb-2 text-sm font-bold leading-7 text-slate-700">{step.text}</p>
                  )}
                  {step.latex ? (
                    <div dir="ltr" className="overflow-x-auto rounded-2xl bg-slate-50 px-4 py-3 text-center">
                      <رياضيات_ثابتة latex={step.latex} className="text-[21px]" />
                    </div>
                  ) : !step.text ? (
                    <p className="text-sm font-bold text-slate-300">خطوة فارغة</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          <div className="mx-auto max-w-4xl space-y-4">
            {safeSteps.map((step, index) => (
              <article
                key={index}
                onClick={() => setActiveIndex(index)}
                className={دمج(
                  "relative overflow-hidden rounded-[26px] border bg-white transition",
                  activeIndex === index && !disabled
                    ? "border-emerald-400 shadow-[0_14px_36px_rgba(16,185,129,0.10)]"
                    : "border-slate-200",
                )}
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-3">
                    <span className={دمج(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-black",
                      activeIndex === index && !disabled ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-500",
                    )}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-xs font-black text-slate-800">الخطوة {index + 1}</p>
                      <p className="mt-0.5 text-[9px] font-bold text-slate-400">اشرح ثم اكتب العملية</p>
                    </div>
                  </div>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); removeStep(index); }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-rose-50 hover:text-rose-700"
                      aria-label="حذف الخطوة"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <div className="space-y-3 p-4 sm:p-5">
                  <div>
                    <label className="mb-2 block text-[10px] font-black text-slate-500">شرح مختصر — اختياري</label>
                    <input
                      dir="rtl"
                      type="text"
                      value={step.text}
                      disabled={disabled}
                      onFocus={() => setActiveIndex(index)}
                      onChange={(event) => updateStep(index, { text: event.target.value })}
                      placeholder="مثال: بالتعويض في العلاقة نحصل على..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50 disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="text-[10px] font-black text-slate-500">السطر الرياضي</label>
                      <span className="text-[9px] font-bold text-slate-300">تظهر لوحة الرياضيات تلقائيًا عند الكتابة</span>
                    </div>
                    <حقل_رياضيات
                      value={step.latex}
                      onChange={(latex) => updateStep(index, { latex })}
                      onFocus={() => setActiveIndex(index)}
                      disabled={disabled}
                      registerRef={(element) => {
                        if (element) fieldRefs.current[index] = element;
                        else delete fieldRefs.current[index];
                      }}
                    />
                  </div>
                </div>
              </article>
            ))}

            {!disabled && (
              <button
                type="button"
                onClick={addStep}
                className="flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-emerald-200 bg-emerald-50/35 px-4 py-4 text-sm font-black text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-50"
              >
                <Plus size={18} />
                إضافة خطوة إلى الحل
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}


function مصور_الحل({ files, onChange, disabled, notes = [] }) {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const next = (files || []).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => next.forEach((item) => URL.revokeObjectURL(item.url));
  }, [files]);

  function appendFiles(fileList) {
    if (disabled) return;
    const incoming = Array.from(fileList || []).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );
    const merged = [...(files || []), ...incoming].slice(0, 5);
    onChange(merged);
  }

  function removeFile(index) {
    if (disabled) return;
    onChange((files || []).filter((_, i) => i !== index));
  }

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-100 bg-gradient-to-l from-sky-50/80 via-white to-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
            <Camera size={22} />
          </div>
          <div>
            <h4 className="text-base font-black text-slate-900">صوّر ورقة حلك</h4>
            <p className="mt-1 max-w-2xl text-xs font-bold leading-6 text-slate-500">
              حلّ التمرين بالقلم على الورقة ثم صوّر الحل كاملًا من الأعلى. يمكنك إضافة حتى خمس صفحات مرتبة.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {!disabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex min-h-28 items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-sky-200 bg-sky-50/55 px-5 text-sm font-black text-sky-900 transition hover:border-sky-400 hover:bg-sky-50"
            >
              <Camera size={22} />
              فتح الكاميرا
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex min-h-28 items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50/70 px-5 text-sm font-black text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50/40"
            >
              <UploadCloud size={22} />
              اختيار صور من الجهاز
            </button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                appendFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                appendFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
        )}

        {!!notes.length && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-black text-amber-900">قبل إعادة التصوير</p>
            <div className="mt-2 space-y-1.5">
              {notes.map((note, index) => (
                <p key={index} className="text-xs font-bold leading-6 text-amber-800">• {note}</p>
              ))}
            </div>
          </div>
        )}

        {previews.length ? (
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-black text-slate-700">صفحات الحل — بالترتيب</p>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-500">
                {previews.length} من 5
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {previews.map((item, index) => (
                <article key={`${item.file.name}-${index}`} className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    <img
                      src={item.url}
                      alt={`صفحة الحل ${index + 1}`}
                      className="h-full w-full object-contain"
                    />
                    <span className="absolute right-3 top-3 flex h-9 min-w-9 items-center justify-center rounded-xl bg-slate-950/75 px-2 text-xs font-black text-white backdrop-blur">
                      {index + 1}
                    </span>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-rose-700 shadow-sm transition hover:bg-rose-50"
                        aria-label="حذف الصورة"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <div className="px-4 py-3">
                    <p className="truncate text-[11px] font-black text-slate-700">صفحة {index + 1}</p>
                    <p className="mt-1 text-[10px] font-bold text-slate-400">
                      {Math.max(1, Math.round(item.file.size / 1024))} كيلوبايت
                    </p>
                  </div>
                </article>
              ))}
            </div>
            {!disabled && previews.length < 5 && (
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 transition hover:border-sky-300"
              >
                <ImagePlus size={17} />
                إضافة صفحة أخرى
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-[24px] bg-slate-50 p-5 text-center">
            <ImagePlus className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-black text-slate-600">لم تضف صورة بعد</p>
            <p className="mt-1 text-xs font-bold leading-6 text-slate-400">
              اجعل كامل الورقة داخل الإطار وتجنب الظلال والاهتزاز.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function تصحيح_الأستاذ({ answer, question }) {
  if (!answer) return null;
  const feedback = answer.teacher_feedback || {};
  const solutionVisuals = (question?.visuals || []).filter(
    (visual) => visual?.placement === "solution",
  );
  const verdict = feedback.verdict || (answer.is_correct ? "correct" : "incorrect");
  const correct = verdict === "correct" || answer.is_correct;
  const partial = verdict === "partially_correct";

  return (
    <section className="mt-7 space-y-4">
      <div
        className={دمج(
          "rounded-[26px] border p-5 sm:p-6",
          correct
            ? "border-emerald-200 bg-emerald-50"
            : partial
              ? "border-amber-200 bg-amber-50"
              : "border-rose-200 bg-rose-50",
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={دمج(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white",
              correct ? "text-emerald-700" : partial ? "text-amber-700" : "text-rose-700",
            )}
          >
            {correct ? <CheckCircle2 /> : <XCircle />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-slate-900">
              {correct
                ? "أحسنت، أتقنت هذه الفكرة"
                : partial
                  ? "فهمك جيد، لكن توجد نقطة تحتاج تثبيتًا"
                  : "سنثبت هذه الفكرة قبل الانتقال"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-slate-600">
                تقييم الحل: {Math.round(answer.percentage || 0)}٪
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-slate-500">
                التصحيح يعتمد على خطواتك كاملة
              </span>
              {answer.answer_mode === "image" && (
                <span className="rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-black text-sky-700">
                  تم تصحيح الحل من صور الورقة
                </span>
              )}
            </div>
          </div>
        </div>
        {feedback.teacher_message && (
          <div className="mt-5 border-t border-black/5 pt-4 text-sm font-bold text-slate-700">
            <نص_رياضي_ذكي block>{feedback.teacher_message}</نص_رياضي_ذكي>
          </div>
        )}
        {answer.answer_mode === "image" && feedback.observed_solution_summary && (
          <div className="mt-4 rounded-2xl bg-white/75 p-4">
            <p className="text-[10px] font-black text-slate-400">ما قرأه الأستاذ من ورقتك</p>
            <نص_رياضي_ذكي block className="mt-2 text-xs font-bold leading-6 text-slate-600">
              {feedback.observed_solution_summary}
            </نص_رياضي_ذكي>
          </div>
        )}
      </div>

      {!!feedback.what_was_correct?.length && (
        <div className={`${بطاقة} p-5 sm:p-6`}>
          <div className="flex items-center gap-2 text-emerald-800">
            <Check size={18} />
            <h4 className="font-black">النقاط التي أحسنت فيها</h4>
          </div>
          <div className="mt-4 grid gap-2">
            {feedback.what_was_correct.map((item, index) => (
              <div key={index} className="flex items-start gap-3 rounded-2xl bg-emerald-50/55 p-3.5">
                <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-700" />
                <نص_رياضي_ذكي block className="text-sm font-bold text-slate-700">{item}</نص_رياضي_ذكي>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!feedback.errors?.length && (
        <div className={`${بطاقة} p-5 sm:p-6`}>
          <div className="flex items-center gap-2 text-rose-700">
            <Target size={18} />
            <h4 className="font-black">أين تحتاج إلى التصحيح؟</h4>
          </div>
          <div className="mt-4 space-y-3">
            {feedback.errors.map((item, index) => (
              <article key={index} className="overflow-hidden rounded-[22px] border border-rose-100 bg-rose-50/45">
                <div className="flex items-center gap-2 border-b border-rose-100 bg-white/70 px-4 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-[11px] font-black text-rose-700">
                    {item.step_number || index + 1}
                  </span>
                  <p className="text-xs font-black text-rose-800">موضع الخطأ</p>
                </div>
                <div className="p-4">
                  <نص_رياضي_ذكي block className="text-sm font-bold text-slate-800">{item.issue}</نص_رياضي_ذكي>
                  {item.why && (
                    <div className="mt-3 rounded-xl bg-white p-3">
                      <p className="text-[11px] font-black text-slate-500">لماذا؟</p>
                      <نص_رياضي_ذكي block className="mt-1 text-sm font-bold text-slate-700">{item.why}</نص_رياضي_ذكي>
                    </div>
                  )}
                  {item.corrected_latex && (
                    <div className="mt-3">
                      <p className="mb-2 text-[11px] font-black text-emerald-700">الكتابة الصحيحة</p>
                      <div dir="ltr" className="overflow-x-auto rounded-xl bg-white p-3 text-center">
                        <رياضيات_ثابتة latex={item.corrected_latex} />
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {feedback.next_hint && (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-amber-800">
            <Lightbulb size={18} />
            <p className="text-sm font-black">تنبيه الأستاذ قبل المحاولة التالية</p>
          </div>
          <نص_رياضي_ذكي block className="mt-3 text-sm font-bold text-slate-700">{feedback.next_hint}</نص_رياضي_ذكي>
        </div>
      )}

      {(!!feedback.correct_solution_steps?.length || solutionVisuals.length > 0) && (
        <details className={`${بطاقة} group p-5 sm:p-6`}>
          <summary className="cursor-pointer list-none font-black text-slate-900">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <BookOpenCheck size={18} className="text-emerald-700" />
                عرض الحل النموذجي
              </span>
              <ChevronLeft size={17} className="transition group-open:-rotate-90" />
            </div>
          </summary>
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
            <رسومات_التعليم visuals={question?.visuals || []} placement="solution" afterStep={0} />
            {(feedback.correct_solution_steps || []).map((step, index) => (
              <div key={index}>
                <div className="grid grid-cols-[38px_1fr] items-start gap-3 rounded-2xl bg-slate-50 p-3.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-black text-emerald-800 shadow-sm">
                    {index + 1}
                  </span>
                  <div dir="ltr" className="min-w-0 overflow-x-auto pt-1">
                    <رياضيات_ثابتة latex={step} />
                  </div>
                </div>
                <رسومات_التعليم visuals={question?.visuals || []} placement="solution" afterStep={index + 1} />
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function خريطة_المسار({ blueprint }) {
  const slots = blueprint?.slots || [];

  if (!slots.length) {
    return (
      <div className={`${بطاقة} p-5`}>
        <p className="font-black text-emerald-800">لا توجد أفكار غير متقنة متبقية.</p>
      </div>
    );
  }

  return (
    <section className={`${بطاقة} p-5 sm:p-6`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-800">
            <ListChecks size={19} />
            <h3 className="font-black">خريطة إتقان المحور</h3>
          </div>
          <p className="mt-2 max-w-3xl text-xs font-bold leading-6 text-slate-500">
            نبدأ بالأفكار الأسهل ثم نتدرج. كل فكرة لها تمرين مستقل، ولا تنتقل إلى الفكرة التالية حتى تتقن الحالية.
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
          {slots.length} فكرة
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot, index) => (
          <article
            key={`${slot.source_type}-${slot.skill_idea_code || slot.variant_code || slot.bac_idea_code}-${index}`}
            className="rounded-[22px] border border-slate-200 bg-slate-50/65 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[10px] font-black text-emerald-800 shadow-sm">
                  {index + 1}
                </span>
                <p className="text-[10px] font-black text-slate-500">
                  {slot.source_type === "skill" ? "فكرة من المحور" : "فكرة بكالوريا"}
                </p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500">
                {وصف_الصعوبة(slot.difficulty)}
              </span>
            </div>
            <p className="mt-3 text-sm font-black leading-7 text-slate-900">
              {slot.skill_idea_name ||
                slot.variant_title ||
                slot.bac_idea_title ||
                "فكرة تدريبية"}
            </p>
            {slot.source_type === "bac" && (
              <p className="mt-3 inline-flex rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] font-black text-amber-800">
                فكرة واردة في نمط البكالوريا
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function رأس_التقدم({ progress, activeQuestion }) {
  const total = Number(progress?.total_targets || 0);
  const done = Number(progress?.completed_targets || 0);
  const percent = Number(progress?.progress_percentage || 0);
  const currentNumber = Math.min(Number(progress?.current_target_number || done + 1), Math.max(total, 1));
  const label = activeQuestion?.concept_label || progress?.current_target_label || "الفكرة الحالية";

  return (
    <section className="overflow-hidden rounded-[32px] bg-gradient-to-l from-[#0f3b31] to-[#155447] text-white shadow-[0_20px_55px_rgba(15,59,49,0.18)]">
      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black text-emerald-100">
                مسار الإتقان
              </span>
              {total > 0 && (
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black text-white/70">
                  الفكرة {currentNumber} من {total}
                </span>
              )}
            </div>
            <h2 className="mt-4 max-w-3xl text-xl font-black leading-9 sm:text-2xl">{label}</h2>
            <p className="mt-2 text-xs font-bold text-white/60">
              {total ? `أتقنت ${done} فكرة، وبقيت ${Math.max(total - done, 0)} فكرة.` : "جاري إعداد المسار."}
            </p>
          </div>
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-[24px] bg-white/10">
            <p className="text-2xl font-black">{Math.round(percent)}٪</p>
            <p className="mt-1 text-[9px] font-bold text-white/55">نسبة الإتقان</p>
          </div>
        </div>
        <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-300 transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function سجل_المحاولات({ history, onOpen }) {
  if (!history?.length) return null;

  return (
    <section className={`${بطاقة} p-5`}>
      <div className="flex items-center gap-2 text-slate-800">
        <History size={18} />
        <h3 className="font-black">محاولاتك السابقة</h3>
      </div>
      <div className="mt-4 space-y-2">
        {history.slice(0, 8).map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="flex w-full items-center justify-between rounded-2xl border border-transparent bg-slate-50 p-4 text-right transition hover:border-emerald-200 hover:bg-emerald-50/40"
          >
            <div>
              <p className="text-sm font-black">المحاولة {index + 1}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-400">
                {item.status === "completed" ? "مكتملة" : "قيد الإتقان"} • {Math.round(Number(item.mastery_score || 0))}٪
              </p>
            </div>
            <ChevronLeft size={16} />
          </button>
        ))}
      </div>
    </section>
  );
}


function تسمية_حالة_الفكرة(status) {
  if (status === "mastered") return "متقنة";
  if (status === "weak") return "تحتاج تثبيت";
  if (status === "in_progress") return "قيد التعلّم";
  return "لم تبدأ بعد";
}

function مستكشف_أفكار_البكالوريا({ data, loading, onPractice, practicingKey }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recommended");
  const ideas = Array.isArray(data?.ideas) ? data.ideas : [];
  const summary = data?.summary || {};

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = ideas.filter((idea) => {
      const matchesText = !q || [idea.title, idea.description, idea.code]
        .some((value) => String(value || "").toLowerCase().includes(q));
      const status = idea?.student?.status || "new";
      const matchesFilter = filter === "all"
        || (filter === "frequent" && Number(idea.occurrence_count || 0) >= 2)
        || (filter === "weak" && status === "weak")
        || (filter === "mastered" && status === "mastered")
        || (filter === "new" && status === "new");
      return matchesText && matchesFilter;
    });

    return [...list].sort((a, b) => {
      if (sort === "frequency") return Number(b.occurrence_count || 0) - Number(a.occurrence_count || 0);
      if (sort === "mastery") return Number(a?.student?.mastery_score || 0) - Number(b?.student?.mastery_score || 0);
      return Number(b.practice_priority_score || 0) - Number(a.practice_priority_score || 0);
    });
  }, [ideas, query, filter, sort]);

  if (loading) {
    return (
      <section className={`${بطاقة} p-6`}>
        <div className="flex items-center gap-3 text-slate-700">
          <Loader2 size={18} className="animate-spin text-emerald-700" />
          <p className="text-sm font-black">نحمّل إحصائيات أفكار البكالوريا...</p>
        </div>
      </section>
    );
  }

  if (!ideas.length) {
    return (
      <section className={`${بطاقة} p-6 text-center`}>
        <BookOpenCheck className="mx-auto text-slate-300" />
        <h3 className="mt-3 font-black text-slate-700">لا توجد أفكار بكالوريا موثقة لهذا المحور بعد</h3>
        <p className="mt-2 text-xs font-bold leading-6 text-slate-400">عند استيراد أفكار البكالوريا ستظهر هنا تلقائيًا مع السنوات والتكرار.</p>
      </section>
    );
  }

  const statCards = [
    { label: "أفكار موثقة", value: summary.ideas_count || 0, icon: <ListChecks size={18} /> },
    { label: "مرات الظهور", value: summary.total_documented_occurrences || 0, icon: <History size={18} /> },
    { label: "أفكار أتقنتها", value: summary.mastered_ideas || 0, icon: <Trophy size={18} /> },
    { label: "متوسط إتقانك", value: `${Math.round(Number(summary.average_mastery || 0))}٪`, icon: <Target size={18} /> },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-800">
            <Sparkles size={18} />
            <p className="text-xs font-black">بنك أفكار البكالوريا</p>
          </div>
          <h2 className="mt-2 text-2xl font-black text-slate-900">اختر الفكرة التي تريد إتقانها الآن</h2>
          <p className="mt-2 max-w-3xl text-xs font-bold leading-7 text-slate-500">
            ترى تاريخ ظهور كل فكرة في البكالوريا، أنواعها، إتقانك الشخصي، ثم تولّد تدريبًا مخصصًا لها فقط.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold leading-6 text-amber-900 lg:max-w-md">
          {data?.methodology_note || "الإحصائيات تاريخية موثقة وليست تنبؤًا بموضوع البكالوريا القادم."}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <div key={item.label} className={`${بطاقة} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">{item.icon}</span>
              <strong className="text-2xl font-black text-slate-900">{item.value}</strong>
            </div>
            <p className="mt-3 text-[11px] font-black text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>

      <div className={`${بطاقة} p-4 sm:p-5`}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن فكرة..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-300 focus:bg-white"
          />
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 outline-none">
            <option value="all">كل الأفكار</option>
            <option value="frequent">الأكثر تكرارًا</option>
            <option value="weak">تحتاج تثبيت</option>
            <option value="mastered">متقنة</option>
            <option value="new">لم أبدأ بها</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 outline-none">
            <option value="recommended">الأولوية المقترحة</option>
            <option value="frequency">حسب التكرار</option>
            <option value="mastery">حسب أضعف إتقان</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {filtered.map((idea, index) => {
          const status = idea?.student?.status || "new";
          const mastery = Math.round(Number(idea?.student?.mastery_score || 0));
          const years = Array.isArray(idea.years) ? idea.years : [];
          const variants = Array.isArray(idea.variants) ? idea.variants : [];
          const occurrences = Array.isArray(idea.bac_occurrences) ? idea.bac_occurrences : [];
          const mainKey = `idea-${idea.id}`;
          return (
            <article key={idea.id} className={`${بطاقة} overflow-hidden`}>
              <div className="border-b border-slate-100 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-800">فكرة #{index + 1}</span>
                      <span className={دمج(
                        "rounded-full px-3 py-1.5 text-[10px] font-black",
                        status === "mastered" ? "bg-emerald-50 text-emerald-700" : status === "weak" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600",
                      )}>{تسمية_حالة_الفكرة(status)}</span>
                      <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-black text-amber-800">{idea.recommendation}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-black leading-8 text-slate-900">{idea.title}</h3>
                    {idea.description && <p className="mt-2 line-clamp-3 text-xs font-bold leading-7 text-slate-500">{idea.description}</p>}
                  </div>
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[20px] bg-slate-50">
                    <strong className="text-xl font-black text-emerald-800">{idea.occurrence_count}</strong>
                    <span className="text-[9px] font-black text-slate-400">مرات سقوط</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[9px] font-black text-slate-400">التكرار</p>
                    <p className="mt-1 text-xs font-black text-slate-700">{idea.frequency_label}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[9px] font-black text-slate-400">الأولوية</p>
                    <p className="mt-1 text-xs font-black text-slate-700">{idea.priority_label}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[9px] font-black text-slate-400">إتقانك</p>
                    <p className="mt-1 text-xs font-black text-slate-700">{mastery}٪</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[9px] font-black text-slate-400">آخر ظهور موثق</p>
                    <p className="mt-1 text-xs font-black text-slate-700">{idea.last_documented_year || "—"}</p>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${Math.max(0, Math.min(mastery, 100))}%` }} />
                </div>

                {!!years.length && (
                  <div className="mt-4">
                    <p className="text-[10px] font-black text-slate-400">سنوات الظهور الموثقة</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {years.map((year) => <span key={String(year)} className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-600">{year}</span>)}
                    </div>
                  </div>
                )}

                {!!occurrences.length && (
                  <details className="group mt-4 rounded-2xl border border-slate-200 bg-white/80 p-3.5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[10px] font-black text-slate-600">
                      <span>سجل السقوط الموثق ({occurrences.length})</span>
                      <ChevronLeft size={14} className="transition group-open:-rotate-90" />
                    </summary>
                    <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3">
                      {occurrences.slice(0, 10).map((occurrence, occurrenceIndex) => (
                        <div key={occurrenceIndex} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600">
                          {occurrence.year && <span className="font-black text-emerald-800">{occurrence.year}</span>}
                          {occurrence.session && <span>• {occurrence.session}</span>}
                          {occurrence.subject && <span>• {occurrence.subject}</span>}
                          {occurrence.exercise && <span>• تمرين {occurrence.exercise}</span>}
                          {occurrence.question && <span>• سؤال {occurrence.question}</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400">أولوية التدريب الذكية</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{Math.round(Number(idea.practice_priority_score || 0))}/100</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPractice?.(idea.id, null, mainKey)}
                    disabled={Boolean(practicingKey)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#10382f] px-5 py-3.5 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {practicingKey === mainKey ? <Loader2 size={16} className="animate-spin" /> : <GraduationCap size={16} />}
                    تدرّب على هذه الفكرة
                  </button>
                </div>

                {!!variants.length && (
                  <details className="group mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-black text-slate-700">
                      <span>أنواع الفكرة في البكالوريا ({variants.length})</span>
                      <ChevronLeft size={15} className="transition group-open:-rotate-90" />
                    </summary>
                    <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                      {variants.map((variant) => {
                        const key = `variant-${variant.id}`;
                        return (
                          <div key={variant.id} className="flex flex-col gap-3 rounded-2xl bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-black text-slate-800">{variant.title}</p>
                                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">{variant.occurrence_count} مرات</span>
                                <span className={دمج("rounded-lg px-2 py-1 text-[9px] font-black", variant.state === "mastered" ? "bg-emerald-50 text-emerald-700" : variant.state === "weak" ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700")}>{تسمية_حالة_الفكرة(variant.state)}</span>
                              </div>
                              {!!variant.years?.length && <p className="mt-1 text-[10px] font-bold text-slate-400">السنوات: {variant.years.join("، ")}</p>}
                            </div>
                            <button type="button" onClick={() => onPractice?.(idea.id, variant.id, key)} disabled={Boolean(practicingKey)} className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50">
                              {practicingKey === key ? "جاري التحضير..." : "تدريب هذا النوع"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!filtered.length && (
        <div className={`${بطاقة} p-7 text-center`}>
          <p className="text-sm font-black text-slate-700">لا توجد أفكار تطابق الفلتر الحالي.</p>
        </div>
      )}
    </section>
  );
}

export default function AdaptiveAssessment({ axisId }) {
  const { user } = useContext(UserContext);
  const branch = user?.branch || null;

  const [test, setTest] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [history, setHistory] = useState([]);
  const [ideaExplorer, setIdeaExplorer] = useState(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [practicingKey, setPracticingKey] = useState("");
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [stepsByQuestion, setStepsByQuestion] = useState({});
  const [answerByQuestion, setAnswerByQuestion] = useState({});
  const [transition, setTransition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answerMode, setAnswerMode] = useState("write");
  const [solutionImages, setSolutionImages] = useState([]);
  const [imageNotes, setImageNotes] = useState([]);
  const [generatingNext, setGeneratingNext] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(Date.now());

  const questions = useMemo(
    () =>
      [...(test?.test_questions || [])].sort(
        (a, b) => Number(a.order || 0) - Number(b.order || 0),
      ),
    [test],
  );

  const activeQuestion = useMemo(() => {
    if (!questions.length) return null;
    if (test?.status === "completed" && !activeQuestionId) return null;
    if (activeQuestionId) {
      const found = questions.find((q) => q.id === activeQuestionId);
      if (found) return found;
    }
    return questions.find((q) => !q.answer) || questions[questions.length - 1];
  }, [questions, activeQuestionId, test?.status]);

  const activeAnswer = activeQuestion
    ? answerByQuestion[activeQuestion.id] ||
      (activeQuestion.answer ? تهيئة_الإجابة(activeQuestion.answer) : null)
    : null;

  const activeSteps = activeQuestion
    ? stepsByQuestion[activeQuestion.id] ||
      activeQuestion.answer?.answer?.steps || [{ latex: "" }]
    : [{ latex: "" }];

  const progress = تقدم_الاختبار(test);

  useEffect(() => {
    setImageNotes([]);
    setSolutionImages([]);
    if (activeAnswer?.answer_mode === "image") setAnswerMode("image");
    else if (activeAnswer) setAnswerMode("write");
    else setAnswerMode("write");
  }, [activeQuestion?.id]);

  const hydrate = useCallback((normalized) => {
    const solutions = {};
    const answers = {};
    for (const q of normalized?.test_questions || []) {
      if (q.answer?.answer?.steps) solutions[q.id] = q.answer.answer.steps;
      if (q.answer) answers[q.id] = تهيئة_الإجابة(q.answer);
    }
    setStepsByQuestion((old) => ({ ...old, ...solutions }));
    setAnswerByQuestion((old) => ({ ...old, ...answers }));
  }, []);

  const selectUnanswered = useCallback((normalized) => {
    const qs = [...(normalized?.test_questions || [])].sort(
      (a, b) => Number(a.order || 0) - Number(b.order || 0),
    );
    const unanswered = qs.find((q) => !q.answer);
    if (unanswered) {
      setActiveQuestionId(unanswered.id);
      startedAt.current = Date.now();
      return true;
    }
    return false;
  }, []);

  const loadPreview = useCallback(async () => {
    if (!axisId || !branch?.id) return;
    try {
      const response = await الخادم.post(
        `/adaptive-assessment/axes/${axisId}/blueprint/`,
        { branch_id: branch.id },
      );
      setBlueprint(response.data || null);
    } catch {
      setBlueprint(null);
    }
  }, [axisId, branch?.id]);

  const loadHistory = useCallback(async () => {
    if (!axisId || !branch?.id) return;
    try {
      const response = await الخادم.get(
        `/adaptive-assessment/axes/${axisId}/tests/history/`,
        { params: { branch_id: branch.id } },
      );
      setHistory(Array.isArray(response.data) ? response.data : []);
    } catch {
      setHistory([]);
    }
  }, [axisId, branch?.id]);

  const loadIdeas = useCallback(async () => {
    if (!axisId || !branch?.id) {
      setIdeaExplorer(null);
      return;
    }
    try {
      setIdeasLoading(true);
      const response = await الخادم.get(
        `/adaptive-assessment/axes/${axisId}/ideas/`,
        { params: { branch_id: branch.id } },
      );
      setIdeaExplorer(response.data || null);
    } catch {
      setIdeaExplorer(null);
    } finally {
      setIdeasLoading(false);
    }
  }, [axisId, branch?.id]);

  useEffect(() => {
    setTest(null);
    setTransition(null);
    setError("");
    loadPreview();
    loadHistory();
    loadIdeas();
  }, [axisId, branch?.id, loadPreview, loadHistory, loadIdeas]);

  async function startIdeaPractice(ideaId, variantId = null, key = "") {
    if (!axisId || !branch?.id || !ideaId) {
      setError("لا توجد شعبة أو فكرة صالحة لبدء التدريب.");
      return;
    }

    try {
      setPracticingKey(key || `idea-${ideaId}`);
      setError("");
      setTransition(null);
      setActiveQuestionId(null);
      const payload = { branch_id: branch.id };
      if (variantId) payload.variant_id = variantId;
      const response = await الخادم.post(
        `/adaptive-assessment/axes/${axisId}/ideas/${ideaId}/practice/`,
        payload,
      );
      const normalized = تهيئة_الاختبار(response.data);
      setTest(normalized);
      hydrate(normalized);
      selectUnanswered(normalized);
      loadHistory();
      loadIdeas();
    } catch (requestError) {
      const testId = requestError?.response?.data?.test_id;
      setError(رسالة_الخطأ(requestError));
      if (testId) {
        setTest({
          id: testId,
          test_questions: [],
          blueprint: { mode: "idea_practice", runtime: {}, slots: [] },
        });
      }
    } finally {
      setPracticingKey("");
    }
  }

  async function startAssessment() {
    if (!axisId || !branch?.id) {
      setError("لا توجد شعبة أو محور صالح لبدء الاختبار.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setTransition(null);
      setActiveQuestionId(null);
      const response = await الخادم.post(
        `/adaptive-assessment/axes/${axisId}/tests/generate/`,
        { branch_id: branch.id },
      );
      const normalized = تهيئة_الاختبار(response.data);
      setTest(normalized);
      hydrate(normalized);
      selectUnanswered(normalized);
      loadHistory();
      loadIdeas();
    } catch (requestError) {
      const testId = requestError?.response?.data?.test_id;
      setError(رسالة_الخطأ(requestError));
      if (testId) {
        setTest({ id: testId, test_questions: [], blueprint: blueprint || {} });
      }
    } finally {
      setLoading(false);
    }
  }

  async function openHistoricalTest(item) {
    if (!item?.id) return;
    try {
      setLoading(true);
      setError("");
      setTransition(null);
      setActiveQuestionId(null);
      const response = await الخادم.get(`/adaptive-assessment/tests/${item.id}/`);
      const normalized = تهيئة_الاختبار(response.data);
      setTest(normalized);
      hydrate(normalized);
      selectUnanswered(normalized);
    } catch (requestError) {
      setError(رسالة_الخطأ(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function ensureCurrentQuestion() {
    if (!test?.id) return;
    try {
      setGeneratingNext(true);
      setError("");
      const response = await الخادم.post(`/adaptive-assessment/tests/${test.id}/next/`);
      const normalized = تهيئة_الاختبار(response.data);
      setTest(normalized);
      hydrate(normalized);
      selectUnanswered(normalized);
    } catch (requestError) {
      setError(رسالة_الخطأ(requestError));
    } finally {
      setGeneratingNext(false);
    }
  }

  function updateSteps(steps) {
    if (!activeQuestion) return;
    setStepsByQuestion((old) => ({ ...old, [activeQuestion.id]: steps }));
  }

  async function submitCurrent() {
    if (!activeQuestion || activeAnswer || submitting) return;

    const cleanSteps = activeSteps
      .map((step) => ({
        text: String(step?.text || step?.explanation || "").trim(),
        latex: String(step?.latex || "").trim(),
      }))
      .filter((step) => step.latex || step.text);

    if (!cleanSteps.length) {
      setError("اكتب خطوة واحدة على الأقل قبل إرسال الحل.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const seconds = Math.max(0, Math.round((Date.now() - startedAt.current) / 1000));
      const response = await الخادم.post(
        `/adaptive-assessment/test-questions/${activeQuestion.id}/submit/`,
        {
          answer: { format: "math_steps", steps: cleanSteps },
          time_spent_seconds: seconds,
          hints_used: 0,
          solution_viewed: false,
        },
      );

      const normalizedAnswer = تهيئة_الإجابة(response.data.answer);
      const normalizedTest = تهيئة_الاختبار({
        ...response.data.test,
        sequence_progress: response.data.sequence_progress,
      });

      setAnswerByQuestion((old) => ({ ...old, [activeQuestion.id]: normalizedAnswer }));
      setStepsByQuestion((old) => ({ ...old, [activeQuestion.id]: cleanSteps }));
      setTest(normalizedTest);
      hydrate(normalizedTest);
      setActiveQuestionId(activeQuestion.id);
      setTransition({
        action: response.data.action,
        message: response.data.transition_message,
        nextReady: response.data.next_question_ready,
        generationError: response.data.next_generation_error || "",
      });
      loadHistory();
      loadIdeas();
    } catch (requestError) {
      setError(رسالة_الخطأ(requestError));
    } finally {
      setSubmitting(false);
    }
  }


  async function submitImageCurrent() {
    if (!activeQuestion || activeAnswer || submitting) return;
    if (!solutionImages.length) {
      setError("صوّر صفحة واحدة على الأقل من حلك قبل الإرسال.");
      return;
    }

    const formData = new FormData();
    solutionImages.slice(0, 5).forEach((file) => formData.append("images", file));
    formData.append(
      "time_spent_seconds",
      String(Math.max(0, Math.round((Date.now() - startedAt.current) / 1000))),
    );
    formData.append("hints_used", "0");
    formData.append("solution_viewed", "false");

    try {
      setSubmitting(true);
      setError("");
      setImageNotes([]);
      const response = await الخادم.post(
        `/adaptive-assessment/test-questions/${activeQuestion.id}/submit-image/`,
        formData,
        { timeout: 240000 },
      );

      const normalizedAnswer = تهيئة_الإجابة(response.data.answer);
      const normalizedTest = تهيئة_الاختبار({
        ...response.data.test,
        sequence_progress: response.data.sequence_progress,
      });

      setAnswerByQuestion((old) => ({ ...old, [activeQuestion.id]: normalizedAnswer }));
      setTest(normalizedTest);
      hydrate(normalizedTest);
      setActiveQuestionId(activeQuestion.id);
      setTransition({
        action: response.data.action,
        message: response.data.transition_message,
        nextReady: response.data.next_question_ready,
        generationError: response.data.next_generation_error || "",
      });
      loadHistory();
      loadIdeas();
    } catch (requestError) {
      const data = requestError?.response?.data || {};
      if (data.retake_required) {
        setImageNotes(Array.isArray(data.image_quality_notes) ? data.image_quality_notes : []);
      }
      setError(رسالة_الخطأ(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function continueAfterFeedback() {
    if (!test) return;
    if (transition?.action === "completed" || test.status === "completed") {
      setTransition(null);
      return;
    }

    const found = selectUnanswered(test);
    if (found) {
      setTransition(null);
      setError("");
      return;
    }

    await ensureCurrentQuestion();
    setTransition(null);
  }

  function backHome() {
    setTest(null);
    setTransition(null);
    setError("");
    setActiveQuestionId(null);
    loadPreview();
    loadHistory();
    loadIdeas();
  }

  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-[520px] items-center justify-center bg-[#f7f9f7] px-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-sm">
            <Loader2 className="animate-spin text-emerald-800" />
          </div>
          <p className="mt-4 text-sm font-black text-slate-700">نجهز لك التمرين الأول...</p>
          <p className="mt-1 text-xs font-bold text-slate-400">تمرين واحد فقط في كل مرة.</p>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <section dir="rtl" className="min-h-full bg-[#f7f9f7] p-4 sm:p-6">
        <div className="mx-auto max-w-[1380px]">
          <div className="relative overflow-hidden rounded-[38px] bg-gradient-to-l from-[#0e392f] via-[#12483c] to-[#176050] p-7 text-white shadow-[0_24px_70px_rgba(15,59,49,0.22)] sm:p-10 lg:p-12">
            <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-white/5" />
            <div className="absolute -bottom-28 right-1/3 h-60 w-60 rounded-full bg-emerald-300/5" />

            <div className="relative z-10 max-w-4xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-black text-emerald-100">
                <Sparkles size={14} /> مسار إتقان ذكي
              </span>
              <h1 className="mt-5 text-3xl font-black leading-[1.5] sm:text-4xl lg:text-[42px]">
                كل أفكار البكالوريا أمامك... اختر، تدرّب، وأتقن
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-bold leading-8 text-white/70 sm:text-[15px]">
                شاهد تكرار كل فكرة وسنوات ظهورها في البكالوريا وإتقانك الشخصي، ثم اختر أي فكرة لتتدرب عليها بتمرين يولده الذكاء الاصطناعي ويصحح حلك خطوة بخطوة. ويمكنك أيضًا تشغيل المسار الكامل من الأسهل إلى الأصعب.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={startAssessment}
                  disabled={!branch?.id}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-[#10382f] shadow-lg transition hover:-translate-y-0.5 disabled:opacity-40"
                >
                  <GraduationCap size={18} />
                  ابدأ اختبار الإتقان
                </button>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-bold text-white/75">
                  <CircleDot size={15} /> تمرين واحد في كل مرحلة
                </div>
              </div>
            </div>
          </div>

          <تنبيه message={error} />

          <div className="mt-8">
            <مستكشف_أفكار_البكالوريا
              data={ideaExplorer}
              loading={ideasLoading}
              onPractice={startIdeaPractice}
              practicingKey={practicingKey}
            />
          </div>

          <div className="mt-8">
            <div className="mb-4 flex items-center gap-2 text-slate-800">
              <BrainCircuit size={18} className="text-emerald-800" />
              <h2 className="text-lg font-black">أو ابدأ مسار الإتقان الكامل للمحور</h2>
            </div>
            <خريطة_المسار blueprint={blueprint} />
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_360px]">
            <سجل_المحاولات history={history} onOpen={openHistoricalTest} />
            <div className="space-y-4">
              <div className={`${بطاقة} p-5`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                  <BrainCircuit size={20} />
                </div>
                <h3 className="mt-4 font-black">تصحيح يشرح طريقة تفكيرك</h3>
                <p className="mt-2 text-xs font-bold leading-7 text-slate-500">
                  لا نحكم على النتيجة فقط؛ نراجع خطوات الحل ونحدد موضع الخطأ وسببه.
                </p>
              </div>
              <div className={`${بطاقة} p-5`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-800">
                  <LockKeyhole size={20} />
                </div>
                <h3 className="mt-4 font-black">لا نتجاوز فكرة غير متقنة</h3>
                <p className="mt-2 text-xs font-bold leading-7 text-slate-500">
                  إذا أخطأت، تحصل على تدريب جديد في نفس الفكرة قبل الانتقال إلى التالية.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const focusedPractice = test?.blueprint?.mode === "idea_practice";
  const focusTitle = test?.blueprint?.focus?.variant_title || test?.blueprint?.focus?.bac_idea_title || "الفكرة المختارة";

  if (test.status === "completed" && !activeQuestion) {
    return (
      <section dir="rtl" className="min-h-full bg-[#f7f9f7] p-4 sm:p-6">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[38px] bg-gradient-to-l from-[#0f3b31] to-[#155447] p-9 text-center text-white shadow-[0_24px_70px_rgba(15,59,49,0.2)] sm:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-white/10">
            <Trophy size={42} />
          </div>
          <h1 className="mt-6 text-3xl font-black">{focusedPractice ? "أحسنت، أتقنت الفكرة" : "أحسنت، أتقنت المحور كاملًا"}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-8 text-white/65">
            {focusedPractice
              ? `أنهيت تدريب ${focusTitle} بنجاح. عد إلى بنك الأفكار واختر الفكرة التالية التي تريد تثبيتها.`
              : "أنهيت جميع أفكار المحور وأفكار البكالوريا في مسارك بنجاح."}
          </p>
          <button
            type="button"
            onClick={backHome}
            className="mt-7 rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-[#10382f] transition hover:-translate-y-0.5"
          >
            {focusedPractice ? "العودة إلى بنك الأفكار" : "العودة إلى المحور"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section dir="rtl" className="min-h-full bg-[#f7f9f7] p-4 sm:p-6">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={backHome}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:border-emerald-300"
          >
            <ArrowRight size={15} />
            العودة
          </button>
          <p className="text-xs font-black text-slate-400">{focusedPractice ? "تدريب مركز على فكرة واحدة" : "من الأسهل إلى الأصعب"}</p>
        </div>

        <رأس_التقدم progress={progress} activeQuestion={activeQuestion} />
        <تنبيه
          message={error}
          onRetry={!activeQuestion || transition?.generationError ? ensureCurrentQuestion : null}
        />

        {!activeQuestion ? (
          <div className={`${بطاقة} mt-6 p-8 text-center`}>
            {test.status === "completed" ? (
              <>
                <Trophy className="mx-auto text-emerald-700" />
                <h2 className="mt-4 text-xl font-black">اكتمل المحور</h2>
                <button
                  type="button"
                  onClick={() => setActiveQuestionId(null)}
                  className="mt-4 rounded-2xl bg-emerald-900 px-5 py-3 text-sm font-black text-white"
                >
                  عرض النتيجة
                </button>
              </>
            ) : (
              <>
                <Loader2 className={دمج("mx-auto text-emerald-700", generatingNext && "animate-spin")} />
                <h2 className="mt-4 font-black">التمرين الحالي غير جاهز بعد</h2>
                <p className="mt-2 text-xs font-bold text-slate-400">لن يتغير ترتيب أفكارك أو تقدمك.</p>
                <button
                  type="button"
                  onClick={ensureCurrentQuestion}
                  disabled={generatingNext}
                  className="mt-4 rounded-2xl bg-emerald-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  تحضير التمرين
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <main className="space-y-6">
              <article className={`${بطاقة} overflow-hidden`}>
                <div className="border-b border-slate-100 bg-white p-5 sm:p-7">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black text-emerald-700">
                        {activeQuestion.source_type === "bac" ? "فكرة بكالوريا" : "فكرة من المحور"}
                      </p>
                      <h3 className="mt-2 text-lg font-black leading-8 text-slate-900 sm:text-xl">
                        {activeQuestion.concept_label || "الفكرة الحالية"}
                      </h3>
                    </div>
                    <span className="w-fit rounded-full bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-600">
                      {وصف_الصعوبة(activeQuestion.difficulty)}
                    </span>
                  </div>
                </div>

                <div className="p-5 sm:p-7">
                  <div className="mb-5 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <BookOpenCheck size={17} />
                    </span>
                    <h4 className="font-black text-slate-800">التمرين</h4>
                  </div>
                  <نص_السؤال question={activeQuestion.question || {}} />
                </div>
              </article>

              {!activeAnswer && (
                <section className={`${بطاقة} p-4 sm:p-5`}>
                  <p className="mb-3 text-xs font-black text-slate-700">كيف تريد أن تحل التمرين؟</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => { setAnswerMode("write"); setError(""); setImageNotes([]); }}
                      className={دمج(
                        "flex items-center gap-3 rounded-[22px] border p-4 text-right transition",
                        answerMode === "write"
                          ? "border-emerald-300 bg-emerald-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-emerald-200",
                      )}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-800 shadow-sm">
                        <PenLine size={19} />
                      </span>
                      <span>
                        <span className="block text-sm font-black text-slate-900">أكتب حلي هنا</span>
                        <span className="mt-1 block text-[10px] font-bold text-slate-400">دفتر رياضيات ذكي خطوة بخطوة</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAnswerMode("image"); setError(""); }}
                      className={دمج(
                        "flex items-center gap-3 rounded-[22px] border p-4 text-right transition",
                        answerMode === "image"
                          ? "border-sky-300 bg-sky-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-sky-200",
                      )}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-800 shadow-sm">
                        <Camera size={19} />
                      </span>
                      <span>
                        <span className="block text-sm font-black text-slate-900">أصوّر ورقة حلي</span>
                        <span className="mt-1 block text-[10px] font-bold text-slate-400">يقرأ الأستاذ الحل من الصورة ويصححه</span>
                      </span>
                    </button>
                  </div>
                </section>
              )}

              {(answerMode === "write" || (activeAnswer && activeAnswer.answer_mode !== "image")) && (
                <محرر_الحل
                  steps={activeSteps}
                  onChange={updateSteps}
                  disabled={Boolean(activeAnswer)}
                />
              )}

              {(answerMode === "image" || activeAnswer?.answer_mode === "image") && !activeAnswer && (
                <مصور_الحل
                  files={solutionImages}
                  onChange={setSolutionImages}
                  disabled={Boolean(activeAnswer)}
                  notes={imageNotes}
                />
              )}

              {!activeAnswer && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-bold leading-6 text-slate-400">
                    {answerMode === "image"
                      ? "تأكد أن جميع خطوات الحل ظاهرة بوضوح وأن الصفحات مرتبة قبل الإرسال."
                      : "راجع خطواتك قبل الإرسال؛ سيُصحَّح الحل خطوة بخطوة."}
                  </p>
                  <button
                    type="button"
                    onClick={answerMode === "image" ? submitImageCurrent : submitCurrent}
                    disabled={submitting}
                    className="inline-flex min-w-[230px] items-center justify-center gap-2 rounded-2xl bg-[#10382f] px-6 py-4 text-sm font-black text-white shadow-[0_12px_25px_rgba(16,56,47,0.16)] transition hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        {answerMode === "image" ? "جاري قراءة وتصحيح الورقة..." : "جاري تصحيح الحل..."}
                      </>
                    ) : answerMode === "image" ? (
                      <>
                        <Camera size={17} />
                        إرسال صور الحل للأستاذ
                      </>
                    ) : (
                      <>
                        <Send size={17} />
                        إرسال الحل للتصحيح
                      </>
                    )}
                  </button>
                </div>
              )}

              <تصحيح_الأستاذ answer={activeAnswer} question={activeQuestion?.question || {}} />

              {transition && activeAnswer && (
                <div
                  className={دمج(
                    "rounded-[26px] border p-5 sm:p-6",
                    activeAnswer.is_correct
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-200 bg-amber-50",
                  )}
                >
                  <p className="font-black leading-7 text-slate-900">
                    {/[\u0600-\u06FF]/.test(String(transition.message || ""))
                      ? transition.message
                      : activeAnswer.is_correct
                        ? "تم إتقان هذه الفكرة. يمكنك الانتقال إلى الفكرة التالية."
                        : "سنكرر التدريب على نفس الفكرة بتمرين جديد حتى تتقنها."}
                  </p>

                  {transition.generationError && (
                    <p className="mt-2 text-xs font-bold leading-6 text-rose-700">
                      تعذر تجهيز التمرين التالي مؤقتًا، لكن تصحيحك وتقدمك محفوظان.
                    </p>
                  )}

                  {transition.action === "completed" || test.status === "completed" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveQuestionId(null);
                        setTransition(null);
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#10382f] px-5 py-3 text-sm font-black text-white"
                    >
                      <Trophy size={17} />
                      {focusedPractice ? "إنهاء تدريب الفكرة" : "عرض إتمام المحور"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={continueAfterFeedback}
                      disabled={generatingNext}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#10382f] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                    >
                      {generatingNext ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : activeAnswer.is_correct ? (
                        <CheckCircle2 size={17} />
                      ) : (
                        <RefreshCcw size={17} />
                      )}
                      {activeAnswer.is_correct
                        ? "الانتقال إلى الفكرة التالية"
                        : "تمرين جديد في نفس الفكرة"}
                    </button>
                  )}
                </div>
              )}
            </main>

            <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
              <div className={`${بطاقة} p-5`}>
                <div className="flex items-center gap-2 text-emerald-800">
                  <Target size={17} />
                  <h4 className="font-black">هدف هذه المرحلة</h4>
                </div>
                <p className="mt-3 text-sm font-bold leading-7 text-slate-700">
                  {focusedPractice ? "أنت تتدرب على الفكرة التي اخترتها؛ إذا أخطأت سنولّد تمرينًا جديدًا لنفسها." : "إتقان فكرة واحدة فقط قبل الانتقال لما بعدها."}
                </p>
              </div>

              <div className={`${بطاقة} p-5`}>
                <div className="flex items-center gap-2 text-amber-800">
                  <Lightbulb size={17} />
                  <h4 className="font-black">كيف تكتب حلك؟</h4>
                </div>
                <div className="mt-4 space-y-3">
                  {["فكرة أو عملية واحدة في كل خطوة.", "اكتب التحويلات الحسابية بوضوح.", "لا تقفز مباشرة إلى النتيجة النهائية."].map((item, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-50 text-[9px] font-black text-amber-800">
                        {index + 1}
                      </span>
                      <p className="text-xs font-bold leading-6 text-slate-500">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
