export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="bolt shrink-0"
    >
      <path
        d="M4 8h31l-6 9h15L18 44l6-16H8L14 8"
        fill="url(#kdm-bolt)"
        stroke="#0a0d12"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="17" r="3" fill="#0a0d12" />
      <circle cx="35" cy="31" r="3" fill="#0a0d12" />
      <defs>
        <linearGradient id="kdm-bolt" x1="4" y1="6" x2="44" y2="44">
          <stop stopColor="#ffe08a" />
          <stop offset="0.45" stopColor="#ffb020" />
          <stop offset="1" stopColor="#ff4d2e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Wordmark({
  scale = 1,
  showDomain = true,
}: {
  scale?: number;
  showDomain?: boolean;
}) {
  return (
    <div className="leading-none" style={{ transform: `scale(${scale})`, transformOrigin: "left center" }}>
      <div className="flex items-center gap-1.5">
        <span className="font-display text-[15px] text-[#ffb020]">KRACKED</span>
        <span className="relative inline-flex h-[19px] w-[19px] items-center justify-center bg-[#ff2d55]">
          <span className="font-display text-[13px] leading-none text-white">D</span>
          <span className="absolute -right-[3px] -top-[3px] h-[7px] w-[7px] rotate-45 bg-[#ffb020]" />
        </span>
        <span className="font-display text-[15px] text-[#eef2f8]">MATH</span>
      </div>
      {showDomain && (
        <div className="num mt-[3px] text-[8px] tracking-[0.34em] text-[#8b99ad]">
          KDMIRAH.GAME
        </div>
      )}
    </div>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={compact ? 28 : 34} />
      <Wordmark scale={compact ? 0.9 : 1} showDomain={!compact} />
    </div>
  );
}
