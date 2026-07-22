import { FileText, PlayCircle, Target } from "lucide-react";

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function ResourcesCard({ data }) {
  return (
    <Card>
      <p className="mb-4 text-center font-bold text-ink-900">{data.title}</p>
      <ul className="space-y-3">
        {data.items.map((item) => (
          <li key={item.label}>
            <a
              href="#"
              className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-600"
            >
              {item.type === "pdf" ? (
                <FileText size={16} className="text-rose-400" />
              ) : (
                <PlayCircle size={16} className="text-brand-400" />
              )}
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function QuickExampleCard({ data }) {
  return (
    <Card className="text-center">
      <p className="mb-4 font-bold text-ink-900">{data.title}</p>
      <p className="mb-4 text-lg font-bold tracking-wide text-ink-900" dir="ltr">
        {data.sequence}
      </p>
      <p className="mb-4 text-sm text-slate-500">
        {data.note} = <span className="font-bold text-ink-900">3</span>
      </p>
      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
        {data.conclusion} <span dir="ltr">{data.formula}</span>
      </div>
    </Card>
  );
}

export function GoalCard({ data }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-center gap-2">
        <p className="font-bold text-ink-900">{data.title}</p>
        <Target size={18} className="text-brand-500" />
      </div>
      <p className="text-center text-sm leading-relaxed text-slate-500">{data.text}</p>
    </Card>
  );
}
