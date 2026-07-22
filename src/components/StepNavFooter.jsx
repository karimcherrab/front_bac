import { ArrowLeft, FastForward } from "lucide-react";

export default function StepNavFooter({ onNext, onSkip }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
      <button
        onClick={onNext}
        className="flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-soft hover:bg-brand-600"
      >
        <ArrowLeft size={16} className="rotate-180" />
        التالي
      </button>

      <button
        onClick={onSkip}
        className="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50"
      >
        تخطي الشرح
        <FastForward size={16} />
      </button>
    </div>
  );
}
