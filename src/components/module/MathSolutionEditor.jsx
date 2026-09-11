import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Keyboard,
  Minus,
  Plus,
  Sigma,
  Trash2,
} from "lucide-react";

import "mathlive";

const QUICK_SYMBOLS = [
  ["كسر", "\\frac{#0}{#?}"],
  ["√", "\\sqrt{#0}"],
  ["x²", "#0^{2}"],
  ["xⁿ", "#0^{#?}"],
  ["( )", "\\left(#0\\right)"],
  ["|x|", "\\left|#0\\right|"],
  ["→", "\\to"],
  ["∞", "\\infty"],
  ["π", "\\pi"],
];

const EXTRA_GROUPS = [
  {
    title: "الاشتقاق",
    items: [
      ["f′(x)", "f'\\left(x\\right)"],
      ["d/dx", "\\frac{d}{dx}\\left(#0\\right)"],
      ["مشتقة ثانية", "\\frac{d^2}{dx^2}\\left(#0\\right)"],
    ],
  },
  {
    title: "التكامل",
    items: [
      ["∫", "\\int #0\\,dx"],
      ["∫ من a إلى b", "\\int_{#?}^{#?} #0\\,dx"],
      ["dx", "\\,dx"],
    ],
  },
  {
    title: "النهايات",
    items: [
      ["lim", "\\lim_{x\\to #?} #0"],
      ["+∞", "+\\infty"],
      ["−∞", "-\\infty"],
      ["±∞", "\\pm\\infty"],
    ],
  },
  {
    title: "علاقات ومجموعات",
    items: [
      ["≤", "\\le"],
      ["≥", "\\ge"],
      ["≠", "\\ne"],
      ["∈", "\\in"],
      ["ℝ", "\\mathbb{R}"],
      ["×", "\\times"],
    ],
  },
];

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

function MathInput({ value, onChange, disabled, inputRef, onFocus }) {
  const localRef = useRef(null);

  useEffect(() => {
    const element = localRef.current;
    if (!element) return;

    if (inputRef) inputRef.current = element;

    element.value = value || "";
    element.readOnly = Boolean(disabled);
    element.smartFence = true;
    element.mathVirtualKeyboardPolicy = "manual";

    const handleInput = () => onChange(element.value || "");
    const handleFocus = () => onFocus?.();

    element.addEventListener("input", handleInput);
    element.addEventListener("focus", handleFocus);

    return () => {
      element.removeEventListener("input", handleInput);
      element.removeEventListener("focus", handleFocus);
    };
  }, [disabled, inputRef, onChange, onFocus]);

  useEffect(() => {
    const element = localRef.current;
    if (element && element.value !== (value || "")) {
      element.value = value || "";
    }
  }, [value]);

  return (
    <math-field
      ref={localRef}
      dir="ltr"
      className="block min-h-[62px] w-full border-0 bg-transparent px-1 py-2 text-xl outline-none sm:text-2xl"
    />
  );
}

export default function MathSolutionEditor({
  steps,
  onChange,
  disabled = false,
}) {
  const normalizedSteps = useMemo(
    () =>
      Array.isArray(steps) && steps.length
        ? steps
        : [{ latex: "" }],
    [steps],
  );

  const fieldRefs = useRef([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (activeIndex >= normalizedSteps.length) {
      setActiveIndex(Math.max(0, normalizedSteps.length - 1));
    }
  }, [activeIndex, normalizedSteps.length]);

  const updateStep = useCallback(
    (index, latex) => {
      onChange(
        normalizedSteps.map((step, currentIndex) =>
          currentIndex === index ? { ...step, latex } : step,
        ),
      );
    },
    [normalizedSteps, onChange],
  );

  function addStep() {
    if (disabled) return;

    const nextIndex = normalizedSteps.length;
    onChange([...normalizedSteps, { latex: "" }]);
    setActiveIndex(nextIndex);

    requestAnimationFrame(() => {
      fieldRefs.current[nextIndex]?.focus?.();
    });
  }

  function removeStep(index) {
    if (disabled || normalizedSteps.length <= 1) return;

    onChange(
      normalizedSteps.filter((_, currentIndex) => currentIndex !== index),
    );
    setActiveIndex((value) =>
      Math.max(0, Math.min(value > index ? value - 1 : value, normalizedSteps.length - 2)),
    );
  }

  function insertTemplate(latex) {
    if (disabled) return;

    const field = fieldRefs.current[activeIndex];
    if (!field) return;

    field.focus();

    try {
      field.executeCommand(["insert", latex]);
    } catch {
      field.insert?.(latex);
    }
  }

  function showKeyboard() {
    const field = fieldRefs.current[activeIndex];
    if (!field) return;

    field.focus();
    window.mathVirtualKeyboard?.show?.();
  }

  return (
    <div dir="rtl" className="space-y-3">
      <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-900">ورقة الحل</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">
                كل سطر يمثل خطوة. لا تحتاج لكتابة شرح طويل داخل الحقل.
              </p>
            </div>

            {!disabled && (
              <button
                type="button"
                onClick={showKeyboard}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:border-emerald-300"
              >
                <Keyboard size={15} />
                لوحة الرياضيات
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {normalizedSteps.map((step, index) => {
            const active = activeIndex === index;

            return (
              <div
                key={index}
                className={cn(
                  "group flex items-start gap-2 px-3 py-2 transition sm:px-4",
                  active && !disabled && "bg-emerald-50/35",
                )}
                onClick={() => setActiveIndex(index)}
              >
                <span
                  className={cn(
                    "mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black",
                    active
                      ? "bg-[#10382f] text-white"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <MathInput
                    value={step.latex || ""}
                    disabled={disabled}
                    inputRef={{
                      get current() {
                        return fieldRefs.current[index];
                      },
                      set current(value) {
                        fieldRefs.current[index] = value;
                      },
                    }}
                    onFocus={() => setActiveIndex(index)}
                    onChange={(latex) => updateStep(index, latex)}
                  />
                </div>

                {!disabled && normalizedSteps.length > 1 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeStep(index);
                    }}
                    className="mt-3 rounded-lg p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                    aria-label={`حذف الخطوة ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!disabled && (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ml-1 inline-flex items-center gap-1.5 text-[11px] font-black text-slate-500">
              <Sigma size={14} />
              للخطوة {activeIndex + 1}
            </span>

            {QUICK_SYMBOLS.map(([label, latex]) => (
              <button
                key={label}
                type="button"
                onClick={() => insertTemplate(latex)}
                className="min-w-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                {label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowMore((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:border-emerald-300"
            >
              {showMore ? <Minus size={14} /> : <Plus size={14} />}
              {showMore ? "إخفاء" : "رموز إضافية"}
            </button>
          </div>

          {showMore && (
            <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2">
              {EXTRA_GROUPS.map((group) => (
                <div key={group.title} className="rounded-2xl bg-white p-3">
                  <p className="mb-2 text-[10px] font-black text-slate-400">
                    {group.title}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map(([label, latex]) => (
                      <button
                        key={`${group.title}-${label}`}
                        type="button"
                        onClick={() => insertTemplate(latex)}
                        className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-black text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-900"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!disabled && (
        <button
          type="button"
          onClick={addStep}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/70 px-4 py-2.5 text-xs font-black text-emerald-900 transition hover:bg-emerald-100"
        >
          <Plus size={15} />
          خطوة جديدة
        </button>
      )}
    </div>
  );
}
