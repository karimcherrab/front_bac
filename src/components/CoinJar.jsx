export default function CoinJar({ coins = 1, size = 72 }) {
  const stackHeights = [0, 6, 12, 18]; // extra height per coin level, clamps at 4
  const level = Math.min(coins, 4);

  return (
    <svg width={size} height={size} viewBox="0 0 80 90" fill="none">
      {/* jar lid */}
      <rect x="28" y="6" width="24" height="8" rx="2" fill="#7da7c9" />
      <rect x="32" y="2" width="16" height="6" rx="2" fill="#5d8aab" />
      {/* jar body */}
      <path
        d="M22 16h36l4 56a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8l4-56Z"
        fill="#eaf4fb"
        stroke="#bcd9ea"
        strokeWidth="2"
      />
      {/* coins */}
      <g>
        {Array.from({ length: level }).map((_, i) => (
          <ellipse
            key={i}
            cx="40"
            cy={74 - i * 8 - stackHeights[level - 1] / level}
            rx="14"
            ry="6"
            fill="#fbbf24"
            stroke="#f59e0b"
            strokeWidth="1.5"
          />
        ))}
      </g>
      {/* jar shine */}
      <path d="M27 22c-2 14-2 28 0 50" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

