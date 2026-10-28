import type { ReactNode } from "react";

export function Jumbotron({
  redScore,
  blueScore,
  ticker,
  pull,
  badge,
  redName,
  blueName,
  deadlock,
}: {
  redScore: number;
  blueScore: number;
  ticker: string;
  pull: number;
  badge?: ReactNode;
  redName: string;
  blueName: string;
  deadlock: boolean;
}) {
  return (
    <div className="scoreboard pointer-events-none absolute left-1/2 top-[9%] z-20 w-[min(370px,76vw)] -translate-x-1/2 sm:top-[10%]">
      <div className="slab slab-amber">
        <div className="face overflow-hidden">
          <div className="flex items-stretch">
            <div className="flex flex-1 flex-col items-center justify-center bg-[#2a0d16] px-2 py-2">
              <span className="num truncate text-[8px] tracking-[0.2em] text-[#ff8098]">
                {redName}
              </span>
              <span className="font-display text-[34px] leading-none text-[#ff2d55] sm:text-[40px]">
                {redScore}
              </span>
            </div>
            <div className="flex w-[54px] flex-col items-center justify-center gap-0.5 bg-[#0a0d12]">
              <span className="font-display text-[13px] text-[#8b99ad]">VS</span>
              <span
                className="num text-[7px] tracking-[0.14em]"
                style={{ color: deadlock ? "#ffb020" : "#8b99ad" }}
              >
                {deadlock ? "DEADLOCK" : `PULL ${pull}`}
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center bg-[#0a1c26] px-2 py-2">
              <span className="num truncate text-[8px] tracking-[0.2em] text-[#7ee3ff]">
                {blueName}
              </span>
              <span className="font-display text-[34px] leading-none text-[#25d9ff] sm:text-[40px]">
                {blueScore}
              </span>
            </div>
          </div>
          <div className="relative overflow-hidden border-t border-[#2c3846] bg-[#070a0e] px-2 py-[5px]">
            <div className="ticker-track">
              <span className="num pr-8 text-[9px] tracking-[0.18em] text-[#ffb020]">
                {ticker} ★ {ticker} ★
              </span>
              <span className="num pr-8 text-[9px] tracking-[0.18em] text-[#ffb020]">
                {ticker} ★ {ticker} ★
              </span>
            </div>
          </div>
        </div>
      </div>
      {badge && <div className="mt-1 flex justify-center">{badge}</div>}
    </div>
  );
}
