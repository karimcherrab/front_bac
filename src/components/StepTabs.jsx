// src/components/StepTabs.jsx

import {
  BookOpen,
  HelpCircle,
  Lightbulb,
  PenLine,
  Sigma,
  Trophy,
} from "lucide-react";

const ICONS = {
  lightbulb: Lightbulb,
  help: HelpCircle,
  book: BookOpen,
  sigma: Sigma,
  pencil: PenLine,
  trophy: Trophy,
};

export default function StepTabs({
  steps = [],
  activeId,
  onSelect,
}) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return null;
  }

  return (
    <div
      dir="rtl"
      className="
        w-full
        min-w-0
        border-b
        border-slate-100
        bg-white
      "
    >
      {/* Mobile scroll container */}
      <div
        className="
          w-full
          min-w-0
          overflow-x-auto
          overflow-y-hidden
          overscroll-x-contain

          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        <div
          className="
            flex
            min-w-max
            items-stretch
            gap-1
            px-2
            pt-3

            min-[360px]:px-3
            min-[360px]:pt-4

            sm:min-w-0
            sm:justify-between
            sm:gap-1.5
            sm:px-4
            sm:pt-5

            md:gap-2

            lg:px-5
          "
        >
          {steps.map((step) => {
            const Icon =
              ICONS[step.icon] || BookOpen;

            const isActive =
              step.id === activeId;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (
                    typeof onSelect === "function"
                  ) {
                    onSelect(step.id);
                  }
                }}
                aria-pressed={isActive}
                title={step.label}
                className={`
                  group
                  relative
                  flex
                  min-h-[82px]
                  w-[78px]
                  shrink-0
                  flex-col
                  items-center
                  justify-start
                  gap-1.5
                  rounded-t-2xl
                  px-1.5
                  pb-3
                  pt-1
                  text-center
                  outline-none
                  transition-all
                  duration-200

                  min-[360px]:w-[84px]
                  min-[360px]:gap-2
                  min-[360px]:px-2
                  min-[360px]:pb-4

                  sm:min-h-[92px]
                  sm:w-auto
                  sm:min-w-0
                  sm:flex-1
                  sm:px-2

                  md:px-3

                  focus-visible:ring-4
                  focus-visible:ring-violet-100

                  ${
                    isActive
                      ? `
                        bg-violet-50/60
                      `
                      : `
                        hover:bg-slate-50
                      `
                  }
                `}
              >
                {/* Icon */}
                <span
                  className={`
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    transition-all
                    duration-200

                    min-[360px]:h-11
                    min-[360px]:w-11

                    sm:h-12
                    sm:w-12

                    ${
                      isActive
                        ? `
                          scale-105
                          bg-brand-500
                          text-white
                          shadow-soft
                        `
                        : `
                          bg-slate-100
                          text-slate-400

                          group-hover:bg-violet-50
                          group-hover:text-violet-500
                        `
                    }
                  `}
                >
                  <Icon
                    size={19}
                    strokeWidth={
                      isActive ? 2.4 : 2
                    }
                    className="
                      min-[360px]:h-5
                      min-[360px]:w-5
                    "
                  />
                </span>

                {/* Label */}
                <span
                  className={`
                    block
                    w-full
                    overflow-hidden
                    text-ellipsis
                    whitespace-nowrap
                    text-[10px]
                    font-extrabold
                    leading-5
                    transition

                    min-[360px]:text-[11px]

                    sm:whitespace-normal
                    sm:text-xs
                    sm:leading-5

                    md:text-[13px]

                    ${
                      isActive
                        ? "text-slate-900"
                        : `
                          text-slate-400
                          group-hover:text-slate-600
                        `
                    }
                  `}
                >
                  {step.label}
                </span>

                {/* Active indicator */}
                <span
                  className={`
                    absolute
                    bottom-0
                    left-1/2
                    h-[3px]
                    -translate-x-1/2
                    rounded-full
                    transition-all
                    duration-200

                    ${
                      isActive
                        ? `
                          w-10
                          bg-brand-500

                          sm:w-12
                        `
                        : `
                          w-0
                          bg-transparent
                        `
                    }
                  `}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile scroll hint */}
      {steps.length > 4 && (
        <div
          className="
            flex
            items-center
            justify-center
            border-t
            border-slate-50
            py-1
            text-[9px]
            font-semibold
            text-slate-300

            sm:hidden
          "
        >
          اسحب لعرض باقي الأقسام
        </div>
      )}
    </div>
  );
}