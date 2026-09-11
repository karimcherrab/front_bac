// src/components/Logo.jsx

import React from "react";

/**
 * شعار Bacly داخل الـ Sidebar.
 *
 * الفكرة:
 * - رمز B بسيط يدمج "التشغيل + الكتاب".
 * - بدون خلفية مربعة حول الرمز.
 * - بدون عبارة تسويقية.
 * - عند تصغير الـ Sidebar يظهر الرمز فقط.
 */
export default function Logo({
  collapsed = false,
  iconOnly = false,
  variant = "dark",
  className = "",
}) {
  const hideWordmark =
    iconOnly || collapsed;

  return (
    <div
      dir="ltr"
      className={[
        "flex min-w-0 items-center",
        hideWordmark
          ? "justify-center"
          : "gap-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="
          relative
          flex
          h-11
          w-11
          shrink-0
          items-center
          justify-center

          sm:h-12
          sm:w-12
        "
      >
        <BaclyMark />
      </div>

      {!hideWordmark && (
        <div className="min-w-0">
          <div className="flex items-start">
            <span
              className={[
                "whitespace-nowrap",
                "text-[29px]",
                "font-black",
                "lowercase",
                "leading-none",
                "tracking-[-0.055em]",
                variant === "light"
                  ? "text-slate-950"
                  : "text-white",
              ].join(" ")}
              style={{
                fontFamily:
                  "'Poppins', 'Inter', 'Segoe UI', Arial, sans-serif",
              }}
            >
              bacly
            </span>

            <span
              aria-hidden="true"
              className="
                ml-1
                mt-[2px]
                h-2
                w-2
                shrink-0
                rounded-full
                bg-cyan-300
                shadow-[0_0_12px_rgba(103,232,249,0.75)]
              "
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BaclyMark() {
  return (
    <svg
      viewBox="0 0 72 72"
      role="img"
      aria-label="Bacly"
      className="
        block
        h-full
        w-full
        overflow-visible
        drop-shadow-[0_7px_16px_rgba(15,23,42,0.3)]
      "
    >
      <defs>
        <linearGradient
          id="bacly-mark-gradient"
          x1="9"
          y1="6"
          x2="63"
          y2="67"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset="0%"
            stopColor="#31D6FF"
          />
          <stop
            offset="47%"
            stopColor="#4C74FF"
          />
          <stop
            offset="100%"
            stopColor="#9A5CFF"
          />
        </linearGradient>

        <linearGradient
          id="bacly-book-gradient"
          x1="20"
          y1="48"
          x2="57"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset="0%"
            stopColor="#FFFFFF"
          />
          <stop
            offset="100%"
            stopColor="#E8E7FF"
          />
        </linearGradient>
      </defs>

      {/* B monogram */}
      <path
        d="
          M14 9
          C14 5.7 16.7 3 20 3
          H38
          C49.3 3 57 9.2 57 18.7
          C57 24.4 54.2 29.1 49.1 32.1
          C58.3 34.3 63 40.7 63 49
          C63 60.2 54.5 67 41.8 67
          H20
          C16.7 67 14 64.3 14 61
          Z
        "
        fill="url(#bacly-mark-gradient)"
      />

      {/* subtle highlight */}
      <path
        d="
          M21 8
          H37
          C45.7 8 51 12.3 51 19
          C51 24 47.3 27.8 41.1 28.8
        "
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.18"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* play */}
      <path
        d="
          M27.6 18.8
          C27.6 16.5 30.2 15.1 32.1 16.4
          L45.2 25.2
          C46.9 26.4 46.9 28.9 45.2 30.1
          L32.1 38.9
          C30.2 40.2 27.6 38.8 27.6 36.5
          Z
        "
        fill="#FFFFFF"
      />

      {/* book */}
      <path
        d="
          M19.5 52.7
          C26.3 46.3 34.6 43.8 44.6 44.6
          C49.2 45 53.1 43.9 57 41.4
          C54.3 48.6 48.6 52.7 40.9 53.8
          C32.8 55 25.7 57.8 19.5 62.5
          Z
        "
        fill="url(#bacly-book-gradient)"
      />

      <path
        d="
          M20.8 57.6
          C28.3 52.5 36.1 50.7 44.7 51.4
          C48.2 51.7 51.5 51.1 54.5 49.8
        "
        fill="none"
        stroke="#5B45E8"
        strokeOpacity="0.68"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
