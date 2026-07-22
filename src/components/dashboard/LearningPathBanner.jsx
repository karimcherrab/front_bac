// src/components/dashboard/LearningPathBanner.jsx

import {
  BarChart3,
  Target,
  BookOpen,
  Trophy,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

const steps = [
  {
    id: 1,
    title: "تقييم مستواك",
    icon: BarChart3,
  },
  {
    id: 2,
    title: "خطة مخصصة",
    icon: Target,
  },
  {
    id: 3,
    title: "تعلم وتقدم",
    icon: BookOpen,
  },
  {
    id: 4,
    title: "حقق أهدافك",
    icon: Trophy,
  },
];

export default function LearningPathBanner() {
  return (
    <section
      dir="rtl"
      className="
        mt-5 grid gap-6 overflow-hidden
        rounded-2xl border border-violet-100
        bg-gradient-to-l from-violet-50 via-white to-indigo-50
        p-6 shadow-soft
        xl:grid-cols-[1.3fr_1fr]
      "
    >
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className="relative flex flex-col items-center text-center"
            >
              <div
                className="
                  flex h-14 w-14 items-center justify-center
                  rounded-full bg-white text-violet-600
                  shadow-md shadow-violet-100
                "
              >
                <Icon size={24} />
              </div>

              <span className="mt-3 text-xs font-bold text-slate-700">
                {step.title}
              </span>

              {index < steps.length - 1 && (
                <ArrowLeft
                  size={20}
                  className="
                    absolute -left-4 top-5
                    hidden text-violet-300 md:block
                  "
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col justify-center text-center xl:text-start">
        <h2 className="text-xl font-extrabold text-slate-900">
          لا تعرف من أين تبدأ؟
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          اختر مساراً تعليمياً مقترحاً يناسب مستواك
        </p>

        <button
          type="button"
          className="
            mx-auto mt-4 flex w-fit items-center gap-2
            rounded-xl bg-gradient-to-l
            from-violet-600 to-purple-500
            px-7 py-3 text-sm font-bold text-white
            shadow-lg shadow-violet-200
            transition hover:-translate-y-0.5
            hover:brightness-110
            xl:mx-0
          "
        >
          <Sparkles size={17} />
          اكتشف المسارات
        </button>
      </div>
    </section>
  );
}