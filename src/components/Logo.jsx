import { Brain } from "lucide-react";

export default function Logo({ collapsed }) {
  return (
    <div
      className={`flex items-center py-5 ${
        collapsed ? "justify-center px-0" : "gap-3 px-6"
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-soft">
        <Brain size={22} className="text-white" />
      </div>

      {!collapsed && (
        <div>
          <p className="text-lg font-extrabold text-white">MathMaster</p>
          <p className="text-xs text-brand-200/80">
            تعلم بذكاء، تفوّق في البكالوريا
          </p>
        </div>
      )}
    </div>
  );
}