import type { Career } from "../game/types";
import { BrandMark } from "./Brand";

export function Stat({
  label,
  value,
  tone = "#eef2f8",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="border border-[#2c3846] bg-[#0a0d12] px-2.5 py-2">
      <div className="num text-[8px] uppercase tracking-[0.2em] text-[#8b99ad]">{label}</div>
      <div className="font-display mt-1 text-[19px] leading-none" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

export function WinOverlay({
  winner,
  redScore,
  blueScore,
  redName,
  blueName,
  online,
  onRematch,
  onExit,
}: {
  winner: "left" | "right";
  redScore: number;
  blueScore: number;
  redName: string;
  blueName: string;
  online: boolean;
  onRematch: () => void;
  onExit: () => void;
}) {
  const red = winner === "left";
  const winnerName = red ? redName : blueName;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#05070a]/72 p-3">
      <div className={`slab w-full max-w-[440px] pop ${red ? "slab-amber" : "slab-cyan"}`}>
        <div className="face p-5 text-center">
          <div className="num text-[9px] tracking-[0.34em] text-[#8b99ad]">MATCH CONCLUDED</div>
          <div className="font-display mt-2 text-[44px] leading-none sm:text-[52px]" style={{ color: red ? "#ff2d55" : "#25d9ff" }}>
            {winnerName}
          </div>
          <div className="font-display text-[15px] tracking-wide text-white">DRAGGED ACROSS THE LINE</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left">
            <Stat label={`${redName} · RED`} value={redScore} tone="#ff2d55" />
            <Stat label={`${blueName} · BLUE`} value={blueScore} tone="#25d9ff" />
          </div>
          <button className="btn btn-primary mt-5 w-full py-3 text-[13px]" onClick={onRematch}>
            ⚡ REMATCH
          </button>
          {online && (
            <button className="btn mt-2 w-full text-[11px] uppercase" onClick={onExit}>
              Leave room
            </button>
          )}
          <div className="num mt-2 text-[9px] tracking-[0.2em] text-[#8b99ad]">
            SPACE / ENTER / R
          </div>
        </div>
      </div>
    </div>
  );
}

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#05070a]/85 p-3">
      <div className="slab slab-amber w-full max-w-[560px] pop">
        <div className="face max-h-[94dvh] overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandMark size={40} />
              <div>
                <h1 className="font-display text-[26px] leading-none text-[#ffb020]">
                  KRACKED<span className="text-[#ff2d55]">D</span>MATH
                </h1>
                <div className="num mt-1.5 text-[9px] tracking-[0.3em] text-[#8b99ad]">
                  MENTAL MATH TUG-OF-WAR · KDMIRAH.GAME
                </div>
              </div>
            </div>
            <button className="pill" onClick={onClose}>
              Close ✕
            </button>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-[#c3ccda]">
            Two contenders, one rope, one equation. Solve faster than your opponent and your
            heave drags them toward your boundary line. Cross the line and the match is yours.
          </p>

          <div className="mt-4 space-y-2">
            <Row n="01" title="Real-time speed duel">
              Both sides solve simultaneously — no turns. Every correct answer instantly heaves
              the rope. Beat the bot's countdown, or your opponent's keystroke.
            </Row>
            <Row n="02" title="Three ways to answer">
              Tap an option card, hit hotkeys <kbd>1</kbd>
              <kbd>2</kbd>
              <kbd>3</kbd>
              <kbd>4</kbd> (P2 uses <kbd>←</kbd>
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <kbd>→</kbd>), or type the number straight from the keyboard.{" "}
              <kbd>Q W E R</kbd> and <kbd>A S D F</kbd> also map to the four options.
            </Row>
            <Row n="03" title="Streaks & Power Surge">
              Sub-1.4s solves pay a <span className="text-[#ffb020]">FAST! +20%</span> bonus.
              Chain correct answers to fill the surge meter — at 100% your next heave is a{" "}
              <span className="text-[#ffb020]">SUPER HEAVE</span> at 1.75× force. A miss costs
              surge and drops your tier.
            </Row>
            <Row n="04" title="Online rooms">
              Open <span className="text-[#b6f24a]">ONLINE DUEL</span>, create a room, and send
              the five-character code or invite link. Your challenger joins as BLUE from any
              device. Both of you race the same equation; the host's arena is authoritative.
            </Row>
          </div>

          <button className="btn btn-primary mt-5 w-full py-3 text-[13px]" onClick={onClose}>
            ⚡ ENTER THE ARENA
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border border-[#2c3846] bg-[#0a0d12] p-3">
      <span className="font-display text-[15px] leading-none text-[#ffb020]">{n}</span>
      <div>
        <div className="text-[13px] font-semibold text-white">{title}</div>
        <p className="num mt-1 text-[10.5px] leading-relaxed tracking-[0.02em] text-[#8b99ad]">
          {children}
        </p>
      </div>
    </div>
  );
}

export function StatsOverlay({
  career,
  redScore,
  blueScore,
  onClose,
  onReset,
}: {
  career: Career;
  redScore: number;
  blueScore: number;
  onClose: () => void;
  onReset: () => void;
}) {
  const pct = (a: number, b: number) => (b === 0 ? "—" : `${Math.round((a / b) * 100)}%`);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#05070a]/85 p-3">
      <div className="slab w-full max-w-[520px] pop">
        <div className="face max-h-[94dvh] overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="num text-[9px] tracking-[0.3em] text-[#ffb020]">
                CAREER PERFORMANCE
              </div>
              <h2 className="font-display mt-1 text-[22px] leading-none text-white">
                RECORD BOOK
              </h2>
            </div>
            <button className="pill" onClick={onClose}>
              Close ✕
            </button>
          </div>

          <div className="num mt-3 border border-[#2c3846] bg-[#0a0d12] px-3 py-2 text-[10px] tracking-[0.12em] text-[#8b99ad]">
            LIVE SCORE · <span className="text-[#ff2d55]">RED {redScore}</span> —{" "}
            <span className="text-[#25d9ff]">BLUE {blueScore}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Matches" value={career.matchesPlayed} />
            <Stat label="Win rate" value={pct(career.matchesWon, career.matchesPlayed)} tone="#b6f24a" />
            <Stat label="Record" value={`${career.matchesWon}W–${career.matchesLost}L`} />
            <Stat label="Solved" value={career.problemsCorrect} />
            <Stat
              label="Accuracy"
              value={pct(career.problemsCorrect, career.problemsAttempted)}
              tone="#25d9ff"
            />
            <Stat
              label="Fastest solve"
              value={career.fastestSolveSec >= 99 ? "—" : `${career.fastestSolveSec.toFixed(2)}s`}
              tone="#ffb020"
            />
            <Stat label="Win streak" value={career.currentWinStreak} />
            <Stat label="Best streak" value={career.bestWinStreak} tone="#ffb020" />
            <Stat
              label="Online"
              value={`${career.onlineWins}W–${career.onlineLosses}L`}
              tone="#b6f24a"
            />
          </div>

          <button
            className="btn mt-4 w-full text-[11px] uppercase"
            style={{ borderColor: "#ff2d55", color: "#ff8098" }}
            onClick={onReset}
          >
            Wipe career stats
          </button>
        </div>
      </div>
    </div>
  );
}
