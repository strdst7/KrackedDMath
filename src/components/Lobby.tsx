import { useEffect, useMemo, useRef, useState } from "react";
import { inviteLink, normalizeCode, type LinkStatus } from "../game/net";
import { audio } from "../game/audio";
import { BrandMark } from "./Brand";

type Tab = "host" | "join";

export interface LobbyProps {
  open: boolean;
  status: LinkStatus;
  detail: string;
  code: string;
  role: "host" | "guest" | null;
  rtt: number;
  peerName: string;
  presetCode: string;
  handle: string;
  onHandle: (v: string) => void;
  onHost: () => void;
  onJoin: (code: string) => void;
  onCancel: () => void;
  onClose: () => void;
  onStart: () => void;
}

const STATUS_COPY: Record<LinkStatus, { label: string; tone: string }> = {
  idle: { label: "STANDBY", tone: "#8b99ad" },
  opening: { label: "OPENING LINK…", tone: "#ffb020" },
  waiting: { label: "ROOM OPEN · AWAITING CHALLENGER", tone: "#25d9ff" },
  online: { label: "OPPONENT LINKED", tone: "#b6f24a" },
  error: { label: "LINK FAILED", tone: "#ff2d55" },
  closed: { label: "LINK CLOSED", tone: "#ff2d55" },
};

export function Lobby(p: LobbyProps) {
  const [tab, setTab] = useState<Tab>(p.presetCode ? "join" : "host");
  const [draft, setDraft] = useState(p.presetCode);
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (p.presetCode) setDraft(p.presetCode);
  }, [p.presetCode]);

  // Countdown is driven by a ref-held interval so parent re-renders (the game
  // loop ticks ~18x/s) can never tear it down mid-count.
  const startRef = useRef(p.onStart);
  startRef.current = p.onStart;
  const ivRef = useRef<number | null>(null);

  useEffect(() => {
    if (p.status !== "online") {
      startedRef.current = false;
      if (ivRef.current) {
        window.clearInterval(ivRef.current);
        ivRef.current = null;
      }
      setCount(null);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    audio.playLink();
    let n = 3;
    setCount(n);
    audio.playCountdown(n);
    ivRef.current = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (ivRef.current) window.clearInterval(ivRef.current);
        ivRef.current = null;
        setCount(null);
        audio.playStart();
        startRef.current();
      } else {
        setCount(n);
        audio.playCountdown(n);
      }
    }, 750);
  }, [p.status]);

  useEffect(
    () => () => {
      if (ivRef.current) window.clearInterval(ivRef.current);
    },
    [],
  );

  const link = useMemo(() => (p.code ? inviteLink(p.code) : ""), [p.code]);
  const st = STATUS_COPY[p.status];
  const busy = p.status === "opening" || p.status === "waiting";

  const copy = async () => {
    if (!p.code) return;
    audio.playKey();
    try {
      await navigator.clipboard.writeText(link || p.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const openSecondTab = () => {
    audio.playKey();
    window.open(`${window.location.pathname}?join=${p.code}`, "_blank", "noopener");
  };

  if (!p.open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#05070a]/82 p-3">
      <div className="slab slab-amber w-full max-w-[560px] pop">
        <div className="face max-h-[94dvh] overflow-y-auto">
          {/* header */}

          <div className="flex items-center justify-between gap-3 border-b border-[#2c3846] bg-[#0e131a] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <BrandMark size={26} />
              <div>
                <div className="font-display text-[13px] leading-none text-[#ffb020]">
                  ONLINE DUEL
                </div>
                <div className="num mt-1 text-[8px] tracking-[0.3em] text-[#8b99ad]">
                  ROOM MATCHMAKING
                </div>
              </div>
            </div>
            <button className="pill" onClick={p.onClose}>
              Esc ✕
            </button>
          </div>

          <div className="px-4 py-4">
            {/* live status strip */}
            <div className="mb-4 flex items-center justify-between gap-2 border border-[#2c3846] bg-[#0a0d12] px-3 py-2">
              <span className="num flex items-center gap-2 text-[10px] tracking-[0.14em]" style={{ color: st.tone }}>
                <span
                  className="inline-block h-2 w-2"
                  style={{
                    background: st.tone,
                    boxShadow: `0 0 10px ${st.tone}`,
                    animation: p.status === "online" ? "none" : "dotPulse 1s ease-in-out infinite",
                  }}
                />
                {st.label}
              </span>
              <span className="num text-[9px] tracking-[0.14em] text-[#8b99ad]">
                {p.rtt > 0 ? `${p.rtt} MS` : "—"}
                {p.role ? ` · ${p.role.toUpperCase()}` : ""}
              </span>
            </div>

            {count !== null && (
              <div className="mb-4 border border-[#b6f24a]/40 bg-[#101a0c] px-3 py-3 text-center">
                <div className="num text-[9px] tracking-[0.3em] text-[#b6f24a]">
                  CHALLENGER LOCKED IN{p.peerName ? ` · ${p.peerName.toUpperCase()}` : ""}
                </div>
                <div className="font-display mt-1 text-4xl text-white">{count}</div>
              </div>
            )}

            {/* handle */}
            <label className="num mb-1 block text-[9px] tracking-[0.24em] text-[#8b99ad]">
              YOUR HANDLE
            </label>
            <input
              className="handle mb-4 w-full px-3 py-2 text-[13px] tracking-[0.12em]"
              value={p.handle}
              maxLength={12}
              onChange={(e) => p.onHandle(e.target.value.toUpperCase())}
              placeholder="CRUNCHER"
            />

            {/* tabs */}
            <div className="mb-3 grid grid-cols-2 gap-1">
              {(["host", "join"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    audio.playKey();
                    setTab(t);
                  }}
                  className="btn text-[11px] uppercase"
                  style={
                    tab === t
                      ? { background: "#ffb020", borderColor: "#ffd47a", color: "#2a1a00" }
                      : undefined
                  }
                >
                  {t === "host" ? "Create room" : "Join with code"}
                </button>
              ))}
            </div>

            {tab === "host" ? (
              <div className="space-y-3">
                {p.code && (p.status === "waiting" || p.status === "online" || p.status === "opening") ? (
                  <RoomTicket code={p.code} link={link} copied={copied} onCopy={copy} onSecondTab={openSecondTab} />
                ) : (
                  <>
                    <p className="text-[12.5px] leading-relaxed text-[#8b99ad]">
                      Spin up a private arena and get a five-character code. Send it to a
                      friend — whoever joins plays <span className="text-[#25d9ff]">BLUE</span>,
                      you hold <span className="text-[#ff2d55]">RED</span>. Same equation, same
                      rope, first correct heave wins the pull.
                    </p>
                    <button className="btn btn-primary w-full py-3 text-[13px]" onClick={p.onHost}>
                      ⚡ OPEN A ROOM
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <label className="num mb-1 block text-[9px] tracking-[0.24em] text-[#8b99ad]">
                  ROOM CODE
                </label>
                <input
                  className="code-input w-full px-3 py-3.5 text-[26px] uppercase"
                  value={draft}
                  maxLength={6}
                  placeholder="7KQ4M"
                  onChange={(e) => {
                    setDraft(normalizeCode(e.target.value));
                    audio.playKey();
                  }}
                />
                <button
                  className="btn btn-primary w-full py-3 text-[13px] disabled:opacity-40"
                  disabled={draft.length < 4 || busy}
                  onClick={() => p.onJoin(draft)}
                >
                  {busy ? "LINKING…" : "⚔ JOIN DUEL"}
                </button>
              </div>
            )}

            {p.detail && p.status !== "online" && (
              <div className="num mt-3 border border-[#2c3846] bg-[#0a0d12] px-3 py-2 text-[9.5px] leading-relaxed tracking-[0.08em] text-[#8b99ad]">
                {p.detail}
                {p.status === "waiting" && (
                  <span className="mt-1 block text-[#25d9ff]">
                    LOCAL LINK ACTIVE — a second tab on this browser can join with the same code.
                  </span>
                )}
              </div>
            )}
            {p.status === "error" && (
              <div className="num mt-3 border border-[#ff2d55]/40 bg-[#1d0d13] px-3 py-2 text-[9.5px] tracking-[0.08em] text-[#ff8098]">
                No room found for that code. Check the characters, or ask the host to re-open a room.
              </div>
            )}

            {(busy || p.status === "error" || p.status === "closed") && (
              <button className="btn mt-3 w-full text-[11px] uppercase" onClick={p.onCancel}>
                Cancel link
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomTicket({
  code,
  link,
  copied,
  onCopy,
  onSecondTab,
}: {
  code: string;
  link: string;
  copied: boolean;
  onCopy: () => void;
  onSecondTab: () => void;
}) {
  return (
    <div className="border border-[#2c3846] bg-[#0a0d12] p-3">
      <div className="num text-[9px] tracking-[0.3em] text-[#8b99ad]">SHARE THIS CODE</div>
      <div className="font-display code-glow mt-1 text-center text-[46px] leading-none text-[#ffb020]">
        {code.split("").join(" ")}
      </div>
      <div className="num mt-2 truncate text-center text-[9px] tracking-[0.1em] text-[#8b99ad]">
        {link}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button className="btn text-[10.5px] uppercase" onClick={onCopy}>
          {copied ? "✓ Copied" : "Copy invite"}
        </button>
        <button className="btn text-[10.5px] uppercase" onClick={onSecondTab}>
          Open 2nd tab
        </button>
      </div>
      <div className="num mt-3 flex items-center justify-center gap-1.5 text-[9px] tracking-[0.22em] text-[#25d9ff]">
        WAITING FOR CHALLENGER
        <span className="dot-1">●</span>
        <span className="dot-2">●</span>
        <span className="dot-3">●</span>
      </div>
    </div>
  );
}
