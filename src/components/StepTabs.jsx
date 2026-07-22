import { Lightbulb, HelpCircle, BookOpen, Sigma, PenLine, Trophy } from "lucide-react";

const ICONS = {
  lightbulb: Lightbulb,
  help: HelpCircle,
  book: BookOpen,
  sigma: Sigma,
  pencil: PenLine,
  trophy: Trophy,
};

export default function StepTabs({ steps, activeId, onSelect }) {
  return (
    <div className="flex items-stretch justify-between gap-1 border-b border-slate-100 px-4 pt-5">
      {steps.map((step) => {
        const Icon = ICONS[step.icon];
        const isActive = step.id === activeId;
        return (
          <button
            key={step.id}
            onClick={() => onSelect(step.id)}
            className="flex flex-1 flex-col items-center gap-2 pb-4"
          >
            <span
              className={[
                "flex h-12 w-12 items-center justify-center rounded-full transition",
                isActive
                  ? "bg-brand-500 text-white shadow-soft"
                  : "bg-slate-100 text-slate-400",
              ].join(" ")}
            >
              <Icon size={20} />
            </span>
            <span
              className={[
                "text-xs font-bold transition",
                isActive ? "text-ink-900" : "text-slate-400",
              ].join(" ")}
            >
              {step.label}
            </span>
            <span
              className={[
                "h-0.5 w-10 rounded-full transition",
                isActive ? "bg-brand-500" : "bg-transparent",
              ].join(" ")}
            />
          </button>
        );
      })}
    </div>
  );
}
