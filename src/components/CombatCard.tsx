import type { CardView } from "../game/types";

const KEYS_LEFT = ["1", "2", "3", "4"];
const KEYS_RIGHT = ["←", "↑", "↓", "→"];

export function CombatCard({
  view,
  onPick,
  hotkeys,
  shake,
  compactStatus,
}: {
  view: CardView;
  onPick: (i: number) => void;
  hotkeys: "left" | "right";
  shake: boolean;
  compactStatus?: string;
}) {
  const red = view.accent === "red";
  const accent = red ? "#ff2d55" : "#25d9ff";
  const keys = hotkeys === "left" ? KEYS_LEFT : KEYS_RIGHT;
  const surge = Math.min(100, Math.round(view.surge));
  const ready = surge >= 100;
  const botPct =
    view.botRemain === null
      ? null
      : Math.max(0, Math.min(100, 100 - (view.botRemain / 4.6) * 100));

  const statusTone = view.status.includes("HEAV")
    ? "#b6f24a"
    : view.status.includes("IMMINENT") || view.status.includes("INBOUND")
      ? "#ffb020"
      : view.status.includes("PENALTY") || view.status.includes("MISS")
        ? "#ff2d55"
        : view.status.includes("WAIT") || view.status.includes("LINK")
          ? "#8b99ad"
          : accent;

  return (
    <div
      className={`combat-card slab absolute bottom-2 z-30 pointer-events-auto ${
        red ? "left-2 sm:left-3" : "right-2 sm:right-3"
      } ${shake ? "shake" : ""} ${ready ? "surge-ready" : ""}`}
      style={ready ? { background: "linear-gradient(140deg,#ffb020,#ff2d55)" } : undefined}
    >
      <div className="face">
        {/* header */}
        <div
          className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5"
          style={{ borderColor: "#2c3846", background: red ? "#20121a" : "#0f1c24" }}
        >
          <span className="num truncate text-[10px] font-bold tracking-[0.12em]" style={{ color: accent }}>
            {view.role}
          </span>
          <span className="num shrink-0 text-[9px] tracking-[0.1em] text-[#8b99ad]">
            {compactStatus ?? (view.botRemain !== null ? `${view.botRemain.toFixed(1)}s` : "")}
          </span>
        </div>

        {/* equation */}
        <div className="px-2.5 pb-1 pt-2.5">
          <div className="font-display text-center text-[21px] leading-tight text-white sm:text-[25px]">
            {view.equation}
          </div>
          {view.typed && (
            <div className="num mt-0.5 text-center text-[10px] tracking-[0.2em] text-[#ffb020]">
              ▸ {view.typed}
            </div>
          )}
        </div>

        {/* options */}
        <div className="grid grid-cols-2 gap-1 px-2 pb-2 pt-1">
          {view.options.map((opt, i) => {
            const picked = view.picked === i;
            const cls =
              picked && view.flash === "correct"
                ? "opt-correct"
                : picked && view.flash === "wrong"
                  ? "opt-wrong"
                  : "";
            return (
              <button
                key={`${view.equation}-${opt}-${i}`}
                disabled={!view.interactive}
                onClick={() => onPick(i)}
                className={`opt-btn px-2 py-2.5 ${cls}`}
              >
                <span
                  className="num absolute left-1.5 top-1 text-[9px]"
                  style={{ color: picked && view.flash ? "inherit" : "#8b99ad", opacity: 0.9 }}
                >
                  {keys[i]}
                </span>
                <span className="num block text-center text-[19px] font-bold leading-none sm:text-[21px]">
                  {opt}
                </span>
              </button>
            );
          })}
        </div>

        {/* status row */}
        <div className="flex items-center justify-between gap-2 border-t border-[#2c3846] px-2.5 py-1.5">
          <span
            className="num min-w-0 truncate text-[9px] font-bold tracking-[0.1em]"
            style={{ color: statusTone }}
          >
            {view.status}
          </span>
          <span
            className="num shrink-0 text-[9px] tracking-[0.1em]"
            style={{ color: view.streak >= 3 ? "#ffb020" : "#8b99ad" }}
          >
            {view.streak}× STREAK
          </span>
        </div>

        {/* surge */}
        <div className="px-2.5 pb-2.5">
          <div className="num mb-1 flex items-center justify-between text-[8px] tracking-[0.22em] text-[#8b99ad]">
            <span>POWER SURGE</span>
            <span style={{ color: ready ? "#ffb020" : "#8b99ad" }}>{surge}%</span>
          </div>
          <div className="h-[7px] w-full overflow-hidden bg-[#0a0d12] ring-1 ring-inset ring-[#2c3846]">
            <div
              className="h-full transition-[width] duration-200 ease-out"
              style={{
                width: `${surge}%`,
                background: ready
                  ? "linear-gradient(90deg,#ffb020,#ff2d55)"
                  : `linear-gradient(90deg, ${accent}, ${red ? "#ff8a2b" : "#7ef0ff"})`,
              }}
            />
          </div>
          {botPct !== null && (
            <div className="mt-1 h-[3px] w-full overflow-hidden bg-[#0a0d12]">
              <div
                className="h-full bg-[#25d9ff] transition-[width] duration-100"
                style={{ width: `${botPct}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
