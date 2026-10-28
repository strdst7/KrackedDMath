import { useCallback, useEffect, useRef, useState } from "react";
import arenaArt from "./assets/arena.jpg";
import { audio } from "./game/audio";
import {
  COMPLEXITY,
  generateProblem,
  MODES,
  tierForStreak,
  type Problem,
} from "./game/math";
import {
  codeFromUrl,
  makeCode,
  NetLink,
  normalizeCode,
  type LinkStatus,
  type NetMsg,
} from "./game/net";
import type {
  CardView,
  Career,
  DustBit,
  Floater,
  NetEvent,
  OnlineSnap,
  SideId,
  SideState,
  SnapSide,
} from "./game/types";
import { Brand } from "./components/Brand";
import { CombatCard } from "./components/CombatCard";
import { Jumbotron } from "./components/Jumbotron";
import { Lobby } from "./components/Lobby";
import { HelpOverlay, StatsOverlay, WinOverlay } from "./components/Overlays";

const STATS_KEY = "kdmirah_career_v1";
const boyArt = `${import.meta.env.BASE_URL}images/boy.png`;
const girlArt = `${import.meta.env.BASE_URL}images/girl.png`;
const ONBOARD_KEY = "kdmirah_onboarded_v1";
const SOUND_KEY = "kdmirah_sound_v1";
const HANDLE_KEY = "kdmirah_handle_v1";

const BOT_ACCURACY = 0.94;
const CORRECT_LOCK = 620;
const WRONG_LOCK = 800;
const PX = 2.2;
const WIN_AT = 100;
const SNAP_INTERVAL = 1 / 15;

const DEFAULT_CAREER: Career = {
  matchesPlayed: 0,
  matchesWon: 0,
  matchesLost: 0,
  problemsAttempted: 0,
  problemsCorrect: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  fastestSolveSec: 99,
  onlineWins: 0,
  onlineLosses: 0,
};

function loadCareer(): Career {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...DEFAULT_CAREER, ...JSON.parse(raw) } : { ...DEFAULT_CAREER };
  } catch {
    return { ...DEFAULT_CAREER };
  }
}
const saveCareer = (c: Career) => localStorage.setItem(STATS_KEY, JSON.stringify(c));

function makeSide(tier: number, isAI: boolean, now: number): SideState {
  const cx = COMPLEXITY[Math.max(0, Math.min(3, tier - 1))];
  return {
    problem: generateProblem(tier),
    streak: 0,
    surge: 0,
    score: 0,
    tier,
    correctCount: 0,
    attempts: 0,
    lockedUntil: 0,
    aiThink: cx.minThinkMs + Math.random() * cx.spanThinkMs,
    aiElapsed: 0,
    problemStart: now,
    typed: "",
    flash: null,
    picked: null,
    status: isAI ? "BOT SOLVING…" : "SOLVE TO HEAVE",
  };
}

function freshSnapSide(): SnapSide {
  return {
    score: 0,
    streak: 0,
    surge: 0,
    solved: 0,
    locked: 0,
    status: "SOLVE TO HEAVE",
    flash: null,
    picked: null,
  };
}

interface NetRuntime {
  role: "host" | "guest";
  snap: OnlineSnap;
  locks: { left: number; right: number };
  flashUntil: { left: number; right: number };
  starts: { left: number; right: number };
  eid: number;
  lastEid: number;
  acc: number;
  recvAt: number;
  guestLock: number;
  gotSnap: boolean;
  typed: { left: string; right: string };
}

let fid = 1;
let did = 1;

export default function App() {
  /* ------------------------------ preferences ----------------------------- */
  const [modeIndex, setModeIndex] = useState(0);
  const [cxIndex, setCxIndex] = useState(1);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem(SOUND_KEY) !== "off");
  const [showHelp, setShowHelp] = useState(
    () => localStorage.getItem(ONBOARD_KEY) !== "1" && !codeFromUrl(),
  );
  const [showStats, setShowStats] = useState(false);
  const [career, setCareer] = useState<Career>(loadCareer);
  const [handle, setHandle] = useState(
    () => localStorage.getItem(HANDLE_KEY) || "YOU",
  );

  /* --------------------------------- netcode ------------------------------- */
  const [lobbyOpen, setLobbyOpen] = useState(() => Boolean(codeFromUrl()));
  const [netStatus, setNetStatus] = useState<LinkStatus>("idle");
  const [netDetail, setNetDetail] = useState("");
  const [netCode, setNetCode] = useState("");
  const [netRole, setNetRole] = useState<"host" | "guest" | null>(null);
  const [rtt, setRtt] = useState(0);
  const [peerName, setPeerName] = useState("");
  const [presetCode] = useState(codeFromUrl);

  /* ---------------------------------- match -------------------------------- */
  const [winner, setWinner] = useState<SideId | null>(null);
  const [ticker, setTicker] = useState("KDMIRAH.GAME ★ CHAMPIONSHIP ARENA ★ READY");
  const [pull, setPull] = useState(1);
  const [lastPull, setLastPull] = useState("");
  const [deadlock, setDeadlock] = useState(true);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [dust, setDust] = useState<DustBit[]>([]);
  const [shake, setShake] = useState(false);
  const [, setFrame] = useState(0);

  /* ----------------------------------- refs -------------------------------- */
  const world = useRef({ x: 0, vel: 0 });
  const over = useRef(false);
  const sides = useRef<Record<SideId, SideState>>({
    left: makeSide(2, false, performance.now()),
    right: makeSide(2, true, performance.now()),
  });
  const modeRef = useRef<(typeof MODES)[number]>(MODES[0]);
  const cxRef = useRef<(typeof COMPLEXITY)[number]>(COMPLEXITY[1]);
  const pullRef = useRef(1);
  const deadlockRef = useRef(true);
  const pausedRef = useRef(true);
  const linkRef = useRef<NetLink | null>(null);
  const netRef = useRef<NetRuntime | null>(null);
  const handleRef = useRef(handle);
  const peerRef = useRef("");
  const roleRef = useRef<"host" | "guest" | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<HTMLImageElement>(null);
  const ropeARef = useRef<SVGPathElement>(null);
  const ropeBRef = useRef<SVGPathElement>(null);
  const ropeCRef = useRef<SVGPathElement>(null);
  const flagRef = useRef<SVGGElement>(null);
  const boyRef = useRef<HTMLDivElement>(null);
  const girlRef = useRef<HTMLDivElement>(null);

  modeRef.current = MODES[modeIndex];
  cxRef.current = COMPLEXITY[cxIndex];
  handleRef.current = handle;
  pausedRef.current = showHelp || showStats || lobbyOpen;



  /* ---------------------------------- fx ---------------------------------- */
  const pushFloat = useCallback((text: string, color: string, side: SideId) => {
    const id = fid++;
    setFloaters((f) => [...f.slice(-5), { id, text, color, side }]);
    window.setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1000);
  }, []);

  const pushDust = useCallback((side: SideId, power = 1) => {
    const baseX = side === "left" ? 34 : 66;
    const tint = side === "left" ? "#d8a86f" : "#cfe3ee";
    const bits: DustBit[] = [];
    for (let i = 0; i < Math.ceil(6 * power); i++) {
      bits.push({
        id: did++,
        x: baseX + (Math.random() - 0.5) * 9,
        y: 66 + (Math.random() - 0.5) * 5,
        dx: `${(side === "left" ? -1 : 1) * (20 + Math.random() * 44)}px`,
        dy: `${-10 - Math.random() * 26}px`,
        size: 4 + Math.random() * 8,
        tint,
      });
    }
    setDust((d) => [...d.slice(-18), ...bits]);
    const ids = new Set(bits.map((b) => b.id));
    window.setTimeout(() => setDust((d) => d.filter((x) => !ids.has(x.id))), 620);
  }, []);

  const lastTicker = useRef("");
  const lastPullShown = useRef(1);
  const lastPullLabel = useRef("");
  const setTickerAll = useCallback((text: string) => {
    const rt = netRef.current;
    if (rt) rt.snap.ticker = text;
    lastTicker.current = text;
    setTicker(text);
  }, []);

  const fighterFx = useCallback((side: SideId, win: "heave" | "cheer") => {
    const mine = document.querySelector(`#fighter-${side} img`);
    const theirs = document.querySelector(
      `#fighter-${side === "left" ? "right" : "left"} img`,
    );
    const cls = win === "cheer" ? "cheering" : "heaving";
    mine?.classList.remove("heaving", "cheering");
    theirs?.classList.remove("stumbling");
    void (mine as HTMLElement | null)?.offsetWidth;
    mine?.classList.add(cls);
    theirs?.classList.add("stumbling");
    if (win === "heave") {
      window.setTimeout(() => {
        mine?.classList.remove("heaving");
        theirs?.classList.remove("stumbling");
      }, 620);
    }
  }, []);

  const heaveFx = useCallback(
    (side: SideId, streak: number, superHeave: boolean) => {
      const dir = side === "left" ? -1 : 1;
      const near = side === "left" ? world.current.x <= -65 : world.current.x >= 65;
      const m = 1 + Math.min(Math.max(streak - 1, 0), 4) * 0.05;
      const h = superHeave ? 1.75 : 1;
      world.current.vel += dir * 68 * m * h * (near ? 0.5 : 1);
      pushDust(side, superHeave ? 2 : 1.1);
      fighterFx(side, "heave");
      if (superHeave) {
        audio.playSuperHeave(side);
        setShake(true);
        window.setTimeout(() => setShake(false), 440);
        pushFloat("SUPER HEAVE!", "#ffb020", side);
        setTickerAll(
          side === "left"
            ? "POWER SURGE UNLEASHED ★ RED ADVANCING"
            : "POWER SURGE UNLEASHED ★ BLUE ADVANCING",
        );
      } else {
        audio.playPop(streak, side);
        window.setTimeout(() => audio.playHeave(side), 90);
      }
    },
    [fighterFx, pushDust, pushFloat, setTickerAll],
  );

  const bumpPull = useCallback((side: SideId) => {
    pullRef.current += 1;
    setPull(pullRef.current);
    setLastPull(side === "left" ? "RED +1 PULL" : "BLUE +1 PULL");
  }, []);

  /* ------------------------------ career bookkeeping ---------------------- */
  const recordProblem = useCallback((correct: boolean, secs: number) => {
    setCareer((c) => {
      const next: Career = {
        ...c,
        problemsAttempted: c.problemsAttempted + 1,
        problemsCorrect: c.problemsCorrect + (correct ? 1 : 0),
        fastestSolveSec:
          correct && secs > 0 ? Math.min(c.fastestSolveSec, secs) : c.fastestSolveSec,
      };
      saveCareer(next);
      return next;
    });
  }, []);

  const recordMatch = useCallback((playerWon: boolean, online: boolean) => {
    setCareer((c) => {
      const next: Career = {
        ...c,
        matchesPlayed: c.matchesPlayed + 1,
        matchesWon: c.matchesWon + (playerWon ? 1 : 0),
        matchesLost: c.matchesLost + (playerWon ? 0 : 1),
        currentWinStreak: playerWon ? c.currentWinStreak + 1 : 0,
        bestWinStreak: playerWon ? Math.max(c.bestWinStreak, c.currentWinStreak + 1) : c.bestWinStreak,
        onlineWins: online && playerWon ? c.onlineWins + 1 : c.onlineWins,
        onlineLosses: online && !playerWon ? c.onlineLosses + 1 : c.onlineLosses,
      };
      saveCareer(next);
      return next;
    });
  }, []);

  /* ============================== OFFLINE ENGINE =========================== */

  const issueProblem = useCallback((id: SideId, keep: Partial<SideState>) => {
    const m = modeRef.current;
    const isAI = id === "left" ? m.leftAI : m.rightAI;
    const prev = sides.current[id];
    const tier = keep.tier ?? prev.tier;
    const cx = cxRef.current;
    sides.current[id] = {
      ...prev,
      ...keep,
      problem: generateProblem(tier),
      tier,
      lockedUntil: 0,
      aiThink: cx.minThinkMs + Math.random() * cx.spanThinkMs,
      aiElapsed: 0,
      problemStart: performance.now(),
      typed: "",
      flash: null,
      picked: null,
      status: isAI ? "BOT SOLVING…" : "SOLVE TO HEAVE",
    };
  }, []);

  const finishMatch = useCallback(
    (redWins: boolean, online: boolean) => {
      if (over.current) return;
      over.current = true;
      world.current.x = redWins ? -WIN_AT : WIN_AT;
      world.current.vel = 0;
      const side: SideId = redWins ? "left" : "right";
      setWinner(side);
      setTickerAll(
        redWins
          ? "RED CONTENDER VICTORY ★ MATCH CONCLUDED"
          : "BLUE CONTENDER VICTORY ★ MATCH CONCLUDED",
      );
      audio.playWin(side);
      fighterFx(side, "cheer");
      const role = roleRef.current;
      const m = modeRef.current;
      const playerWon = online
        ? role === "host"
          ? redWins
          : !redWins
        : m.leftAI
          ? !redWins
          : redWins;
      recordMatch(playerWon, online);
    },
    [fighterFx, recordMatch, setTickerAll],
  );

  const resolveOffline = useCallback(
    (id: SideId, idx: number, fromAI: boolean) => {
      if (over.current) return;
      const s = sides.current[id];
      const now = performance.now();
      if (now < s.lockedUntil || idx < 0 || idx >= 4) return;
      if (!fromAI && id === "left" && modeRef.current.id === "ai-vs-ai") setModeIndex(0);

      const correct = s.problem.options[idx] === s.problem.answer;
      const elapsed = (now - s.problemStart) / 1000;

      if (correct) {
        const streak = s.streak + 1;
        const fast = elapsed < 1.4;
        const bonus = fast ? 20 : elapsed < 2.2 ? 10 : 0;
        const pts = 10 + Math.round(bonus / 2) + Math.min(streak * 2, 10);
        let surge = s.surge;
        let superHeave = false;
        if (surge >= 100) {
          superHeave = true;
          surge = 0;
        } else {
          surge = Math.min(100, surge + 35 + bonus + Math.min(streak * 4, 16));
          if (surge >= 100) audio.playSurgeReady(id);
        }
        const tier = streak >= 3 && s.tier < 4 ? Math.min(4, s.tier + 1) : s.tier;
        const score = s.score + pts;

        sides.current[id] = {
          ...s,
          streak,
          surge,
          score,
          tier,
          correctCount: s.correctCount + 1,
          attempts: s.attempts + 1,
          flash: "correct",
          picked: idx,
          lockedUntil: now + CORRECT_LOCK,
          status: "HEAVING ROPE!",
        };
        if (!fromAI) recordProblem(true, elapsed);
        if (!superHeave) {
          if (fast) pushFloat("FAST! +20%", "#b6f24a", id);
          else if (streak >= 3)
            pushFloat(`${streak}× STREAK!`, id === "left" ? "#ff2d55" : "#25d9ff", id);
        }
        bumpPull(id);
        heaveFx(id, streak, superHeave);
        window.setTimeout(() => {
          if (!over.current && !netRef.current)
            issueProblem(id, {
              streak,
              surge,
              score,
              tier,
              correctCount: s.correctCount + 1,
              attempts: s.attempts + 1,
            });
        }, CORRECT_LOCK);
      } else {
        const surge = Math.max(0, s.surge - 15);
        const tier = Math.max(1, s.tier - 1);
        sides.current[id] = {
          ...s,
          streak: 0,
          surge,
          tier,
          attempts: s.attempts + 1,
          flash: "wrong",
          picked: idx,
          lockedUntil: now + WRONG_LOCK,
          typed: "",
          status: "PENALTY COOLDOWN",
        };
        if (!fromAI) recordProblem(false, elapsed);
        audio.playError(id);
        pushFloat("MISSED!", "#ff2d55", id);
        window.setTimeout(() => {
          if (!over.current && !netRef.current)
            issueProblem(id, {
              streak: 0,
              surge,
              score: s.score,
              tier,
              correctCount: s.correctCount,
              attempts: s.attempts + 1,
            });
        }, WRONG_LOCK);
      }
    },
    [bumpPull, heaveFx, issueProblem, pushFloat, recordProblem],
  );

  const typeDigitOffline = useCallback(
    (id: SideId, d: string) => {
      if (over.current) return;
      const s = sides.current[id];
      if (performance.now() < s.lockedUntil) return;
      if ("1234".includes(d)) {
        resolveOffline(id, Number(d) - 1, false);
        return;
      }
      const buf = (s.typed + d).slice(-4);
      s.typed = buf;
      if (buf === s.problem.answerStr) {
        const i = s.problem.options.indexOf(s.problem.answer);
        if (i >= 0) {
          s.typed = "";
          resolveOffline(id, i, false);
        }
      }
    },
    [resolveOffline],
  );

  const resetOffline = useCallback(() => {
    over.current = false;
    world.current.x = 0;
    world.current.vel = 0;
    const now = performance.now();
    const tier = cxRef.current.id;
    const m = modeRef.current;
    sides.current = {
      left: makeSide(tier, m.leftAI, now),
      right: makeSide(tier, m.rightAI, now),
    };
    pullRef.current = 1;
    setPull(1);
    setLastPull("");
    setWinner(null);
    setTickerAll("CHAMPIONSHIP ARENA ★ MATCH RESET");
    window.setTimeout(
      () => setTickerAll("KDMIRAH.GAME ★ CHAMPIONSHIP ARENA ★ READY"),
      1400,
    );
    document
      .querySelectorAll("#fighter-left img, #fighter-right img")
      .forEach((el) => el.classList.remove("cheering", "stumbling", "heaving"));
    audio.playStart();
  }, [setTickerAll]);

  /* =============================== ONLINE ENGINE ========================== */

  const broadcast = useCallback(() => {
    const rt = netRef.current;
    const link = linkRef.current;
    if (!rt || !link || rt.role !== "host") return;
    link.send({ t: "snap", s: rt.snap });
  }, []);

  const pushEvent = useCallback((rt: NetRuntime, kind: NetEvent["kind"], side: SideId, text?: string) => {
    rt.eid += 1;
    rt.snap.events = [...rt.snap.events.slice(-3), { eid: rt.eid, kind, side, text }];
  }, []);

  const buildRuntime = useCallback((role: "host" | "guest", tier: number): NetRuntime => {
    const problem: Problem = generateProblem(tier);
    return {
      role,
      snap: {
        v: 1,
        problem,
        tier,
        worldX: 0,
        worldVel: 0,
        over: null,
        ticker: "ROOM LINKED ★ WAITING FOR THE DROP",
        pull: 1,
        lastPull: "",
        left: freshSnapSide(),
        right: freshSnapSide(),
        events: [],
        hostName: handleRef.current,
        guestName: peerRef.current || "CHALLENGER",
      },
      locks: { left: 0, right: 0 },
      flashUntil: { left: 0, right: 0 },
      starts: { left: performance.now(), right: performance.now() },
      eid: 0,
      lastEid: 0,
      acc: 0,
      recvAt: performance.now(),
      guestLock: 0,
      gotSnap: role === "host",
      typed: { left: "", right: "" },
    };
  }, []);

  const resolveOnline = useCallback(
    (side: SideId, idx: number) => {
      const rt = netRef.current;
      if (!rt || rt.role !== "host") return;
      const now = performance.now();
      if (over.current || now < rt.locks[side] || idx < 0 || idx >= 4) return;

      const snapSide = rt.snap[side];
      const correct = rt.snap.problem.options[idx] === rt.snap.problem.answer;
      const elapsed = (now - rt.starts[side]) / 1000;

      if (correct) {
        const streak = snapSide.streak + 1;
        const fast = elapsed < 1.4;
        const bonus = fast ? 20 : elapsed < 2.2 ? 10 : 0;
        const pts = 10 + Math.round(bonus / 2) + Math.min(streak * 2, 10);
        let surge = snapSide.surge;
        let superHeave = false;
        if (surge >= 100) {
          superHeave = true;
          surge = 0;
        } else {
          surge = Math.min(100, surge + 35 + bonus + Math.min(streak * 4, 16));
          if (surge >= 100) pushEvent(rt, "surgeReady", side);
        }
        const hotStreak = Math.max(rt.snap.left.streak, streak);
        const tier = tierForStreak(cxRef.current.id, hotStreak);

        snapSide.streak = streak;
        snapSide.surge = surge;
        snapSide.score += pts;
        snapSide.solved += 1;
        snapSide.flash = "correct";
        snapSide.picked = idx;
        snapSide.status = "HEAVING ROPE!";
        rt.flashUntil[side] = now + CORRECT_LOCK;
        rt.locks.left = now + CORRECT_LOCK;
        rt.locks.right = now + CORRECT_LOCK;
        rt.snap.tier = tier;
        rt.snap.problem = generateProblem(tier);
        rt.snap.pull += 1;
        rt.snap.lastPull = side === "left" ? "RED +1 PULL" : "BLUE +1 PULL";
        rt.starts.left = now + CORRECT_LOCK;
        rt.starts.right = now + CORRECT_LOCK;

        if (side === "left") recordProblem(true, elapsed);
        pushEvent(rt, superHeave ? "super" : "heave", side);
        if (!superHeave) {
          if (fast) pushEvent(rt, "fast", side, "FAST! +20%");
          else if (streak >= 3) pushEvent(rt, "streak", side, `${streak}× STREAK!`);
        }
        pullRef.current = rt.snap.pull;
        setPull(rt.snap.pull);
        setLastPull(rt.snap.lastPull);
        heaveFx(side, streak, superHeave);
        broadcast();
      } else {
        snapSide.streak = 0;
        snapSide.surge = Math.max(0, snapSide.surge - 15);
        snapSide.flash = "wrong";
        snapSide.picked = idx;
        snapSide.status = "PENALTY COOLDOWN";
        rt.flashUntil[side] = now + WRONG_LOCK;
        rt.locks[side] = now + WRONG_LOCK;
        if (side === "left") recordProblem(false, elapsed);
        pushEvent(rt, "miss", side, "MISSED!");
        broadcast();
      }
    },
    [broadcast, heaveFx, pushEvent, recordProblem],
  );

  const startOnlineMatch = useCallback(() => {
    const rt = netRef.current;
    if (!rt) return;
    over.current = false;
    world.current.x = 0;
    world.current.vel = 0;
    setWinner(null);
    setFloaters([]);
    setDust([]);
    document
      .querySelectorAll("#fighter-left img, #fighter-right img")
      .forEach((el) => el.classList.remove("cheering", "stumbling", "heaving"));
    if (rt.role === "host") {
      const now = performance.now();
      const tier = cxRef.current.id;
      rt.snap.problem = generateProblem(tier);
      rt.snap.tier = tier;
      rt.snap.worldX = 0;
      rt.snap.worldVel = 0;
      rt.snap.over = null;
      rt.snap.pull = 1;
      rt.snap.lastPull = "";
      rt.snap.ticker = "DUEL LIVE ★ SAME EQUATION ★ FIRST HEAVE WINS";
      rt.snap.left = freshSnapSide();
      rt.snap.right = freshSnapSide();
      rt.snap.left.status = "SOLVE TO HEAVE";
      rt.snap.right.status = "SOLVE TO HEAVE";
      rt.snap.events = [];
      rt.locks = { left: 0, right: 0 };
      rt.flashUntil = { left: 0, right: 0 };
      rt.starts = { left: now, right: now };
      rt.typed = { left: "", right: "" };
      pullRef.current = 1;
      lastPullShown.current = 1;
      lastPullLabel.current = "";
      setPull(1);
      setLastPull("");
      setTickerAll(rt.snap.ticker);
      broadcast();
    }
    audio.playStart();
  }, [broadcast, setTickerAll]);

  const leaveRoom = useCallback(() => {
    linkRef.current?.destroy();
    linkRef.current = null;
    netRef.current = null;
    roleRef.current = null;
    peerRef.current = "";
    setNetRole(null);
    setNetCode("");
    setNetStatus("idle");
    setNetDetail("");
    setPeerName("");
    setRtt(0);
    setLobbyOpen(false);
    over.current = false;
    setWinner(null);
    world.current.x = 0;
    world.current.vel = 0;
    resetOffline();
  }, [resetOffline]);

  const hostRoom = useCallback(() => {
    linkRef.current?.destroy();
    const code = makeCode();
    const link = new NetLink("host", code, handleRef.current || "HOST", {
      onStatus: (s, d) => {
        setNetStatus(s);
        if (d !== undefined) setNetDetail(d);
          if (s === "closed") {
          audio.playDrop();
          setWinner(null);
          setTickerAll("OPPONENT DISCONNECTED ★ ROOM CLOSED");
        }
      },
      onPeerName: (n) => {
        peerRef.current = n;
        setPeerName(n);
        if (netRef.current) netRef.current.snap.guestName = n;
        audio.playJoin();
      },
      onRtt: (ms) => setRtt(ms),
      onMessage: (m: NetMsg) => {
        if (m.t === "answer") resolveOnline("right", m.idx);
        if (m.t === "rematch") {
          startOnlineMatch();
          setLobbyOpen(false);
        }
      },
    });
    linkRef.current = link;
    roleRef.current = "host";
    netRef.current = buildRuntime("host", cxRef.current.id);
    setNetRole("host");
    setNetCode(code);
    link.start();
    audio.playKey();
  }, [buildRuntime, resolveOnline, startOnlineMatch]);

  const joinRoom = useCallback(
    (rawCode: string) => {
      const code = normalizeCode(rawCode);
      if (code.length < 4) return;
      linkRef.current?.destroy();
      const link = new NetLink("guest", code, handleRef.current || "GUEST", {
        onStatus: (s, d) => {
          setNetStatus(s);
          if (d !== undefined) setNetDetail(d);
          if (s === "closed") {
            audio.playDrop();
            setTickerAll("HOST DISCONNECTED ★ ROOM CLOSED");
          }
        },
        onPeerName: (n) => {
          peerRef.current = n;
          setPeerName(n);
          if (netRef.current) netRef.current.snap.hostName = n;
          audio.playJoin();
        },
        onRtt: (ms) => setRtt(ms),
        onMessage: (m: NetMsg) => {
          const rt = netRef.current;
          if (m.t === "snap" && rt && rt.role === "guest") {
            rt.snap = m.s;
            rt.recvAt = performance.now();
            rt.guestLock = 0;
            rt.gotSnap = true;
          }
        },
      });
      linkRef.current = link;
      roleRef.current = "guest";
      netRef.current = buildRuntime("guest", cxRef.current.id);
      setNetRole("guest");
      setNetCode(code);
      link.start();
      link.startHandshake();
      audio.playKey();
    },
    [buildRuntime],
  );

  const sendOnlineAnswer = useCallback((idx: number) => {
    const rt = netRef.current;
    const link = linkRef.current;
    if (!rt || !link || rt.role !== "guest") return;
    const now = performance.now();
    if (over.current || now < rt.guestLock || !rt.gotSnap) return;
    if (rt.snap.right.locked > 0 || rt.snap.over) return;
    rt.guestLock = now + 780;
    rt.snap.right.picked = idx;
    rt.snap.right.status = "HEAVE INBOUND…";
    link.send({ t: "answer", idx });
  }, []);

  /* -------------------------------- net wiring ---------------------------- */

  useEffect(() => {
    if (netStatus === "online" && netRef.current) {
      netRef.current.snap.hostName =
        roleRef.current === "host" ? handleRef.current : peerRef.current || "HOST";
      netRef.current.snap.guestName =
        roleRef.current === "guest" ? handleRef.current : peerRef.current || "CHALLENGER";
      if (roleRef.current === "host") broadcast();
    }
  }, [netStatus, broadcast]);

  useEffect(() => {
    audio.setMuted(!soundOn);
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  }, [soundOn]);

  useEffect(() => {
    localStorage.setItem(HANDLE_KEY, handle);
  }, [handle]);

  useEffect(() => {
    if (netRef.current) return;
    const now = performance.now();
    const tier = COMPLEXITY[cxIndex].id;
    const m = MODES[modeIndex];
    sides.current = {
      left: makeSide(tier, m.leftAI, now),
      right: makeSide(tier, m.rightAI, now),
    };
    over.current = false;
    world.current = { x: 0, vel: 0 };
    setWinner(null);
  }, [modeIndex, cxIndex]);

  const applyNetEvent = useCallback(
    (ev: NetEvent, isOver: boolean) => {
      if (ev.kind === "win" || isOver) return;
      const mine = netRef.current?.role === "guest" && ev.side === "right";
      if (mine && (ev.kind === "heave" || ev.kind === "super" || ev.kind === "miss")) {
        recordProblem(ev.kind !== "miss", 0);
      }
      switch (ev.kind) {
        case "heave":
          heaveFx(ev.side, 1, false);
          bumpPull(ev.side);
          break;
        case "super":
          heaveFx(ev.side, 4, true);
          bumpPull(ev.side);
          break;
        case "miss":
          audio.playError(ev.side);
          pushFloat(ev.text ?? "MISSED!", "#ff2d55", ev.side);
          break;
        case "fast":
          pushFloat(ev.text ?? "FAST! +20%", "#b6f24a", ev.side);
          break;
        case "streak":
          pushFloat(ev.text ?? "STREAK!", ev.side === "left" ? "#ff2d55" : "#25d9ff", ev.side);
          break;
        case "surgeReady":
          audio.playSurgeReady(ev.side);
          break;
      }
    },
    [bumpPull, heaveFx, pushFloat, recordProblem],
  );

  /* -------------------------------- main loop ----------------------------- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastFrame = 0;

    const stepOffline = (t: number, dt: number) => {
      if (!over.current && !pausedRef.current) {
        world.current.x += world.current.vel * dt;
        world.current.vel *= Math.exp(-3.2 * dt);
        if (world.current.x <= -WIN_AT || world.current.x >= WIN_AT) {
          finishMatch(world.current.x <= -WIN_AT, false);
        }
        const m = modeRef.current;
        (["left", "right"] as SideId[]).forEach((id) => {
          const isAI = id === "left" ? m.leftAI : m.rightAI;
          if (!isAI) return;
          const s = sides.current[id];
          if (t < s.lockedUntil) return;
          s.aiElapsed += dt * 1000;
          if (s.aiElapsed > s.aiThink * 0.78 && s.status !== "HEAVE IMMINENT!") {
            s.status = "HEAVE IMMINENT!";
          }
          if (s.aiElapsed >= s.aiThink) {
            const idx = s.problem.options.indexOf(s.problem.answer);
            const hit = Math.random() < BOT_ACCURACY;
            const wrong = [0, 1, 2, 3].filter((i) => i !== idx);
            resolveOffline(id, hit && idx >= 0 ? idx : wrong[Math.floor(Math.random() * wrong.length)] ?? 0, true);
          }
        });
      }
      const dl = Math.abs(world.current.x) < 10;
      if (dl !== deadlockRef.current) {
        deadlockRef.current = dl;
        setDeadlock(dl);
      }
    };

    const stepOnline = (t: number, dt: number) => {
      const rt = netRef.current;
      if (!rt) return;
      if (rt.role === "host") {
        if (!over.current && !pausedRef.current) {
          world.current.x += world.current.vel * dt;
          world.current.vel *= Math.exp(-3.2 * dt);
          if (world.current.x <= -WIN_AT || world.current.x >= WIN_AT) {
            finishMatch(world.current.x <= -WIN_AT, true);
            rt.snap.over = world.current.x <= -WIN_AT ? "left" : "right";
            rt.snap.worldX = world.current.x;
            rt.snap.ticker =
              rt.snap.over === "left"
                ? "RED CONTENDER VICTORY ★ MATCH CONCLUDED"
                : "BLUE CONTENDER VICTORY ★ MATCH CONCLUDED";
            pushEvent(rt, "win", rt.snap.over);
            broadcast();
          }
        }
        rt.snap.worldX = world.current.x;
        rt.snap.worldVel = world.current.vel;
        rt.snap.left.locked = Math.max(0, rt.locks.left - t);
        rt.snap.right.locked = Math.max(0, rt.locks.right - t);
        (["left", "right"] as SideId[]).forEach((id) => {
          if (t > rt.flashUntil[id]) {
            rt.snap[id].flash = null;
            rt.snap[id].picked = null;
            if (rt.snap[id].status === "PENALTY COOLDOWN") rt.snap[id].status = "SOLVE TO HEAVE";
            if (rt.snap[id].status === "HEAVING ROPE!") rt.snap[id].status = "SOLVE TO HEAVE";
          }
        });
        rt.acc += dt;
        if (rt.acc >= SNAP_INTERVAL) {
          rt.acc = 0;
          broadcast();
        }
      } else {
        rt.snap.left.locked = Math.max(0, rt.snap.left.locked - dt * 1000);
        rt.snap.right.locked = Math.max(0, rt.snap.right.locked - dt * 1000);
        world.current.x += (rt.snap.worldX - world.current.x) * Math.min(1, dt * 11);
        for (const ev of rt.snap.events) {
          if (ev.eid <= rt.lastEid) continue;
          rt.lastEid = ev.eid;
          applyNetEvent(ev, rt.snap.over !== null);
        }
        if (rt.snap.over && !over.current) {
          over.current = true;
          setWinner(rt.snap.over);
        }
        if (!rt.snap.over && over.current) {
          over.current = false;
          setWinner(null);
        }
      }
      const dl = Math.abs(world.current.x) < 10;
      if (dl !== deadlockRef.current) {
        deadlockRef.current = dl;
        setDeadlock(dl);
      }
      if (rt.snap.ticker !== lastTicker.current) {
        lastTicker.current = rt.snap.ticker;
        setTicker(rt.snap.ticker);
      }
      if (rt.snap.pull !== lastPullShown.current) {
        lastPullShown.current = rt.snap.pull;
        pullRef.current = rt.snap.pull;
        setPull(rt.snap.pull);
      }
      if (rt.snap.lastPull !== lastPullLabel.current) {
        lastPullLabel.current = rt.snap.lastPull;
        setLastPull(rt.snap.lastPull);
      }
    };

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (netRef.current) stepOnline(t, dt);
      else stepOffline(t, dt);

      const x = world.current.x * PX;
      if (stageRef.current) stageRef.current.style.transform = `translateX(${x}px)`;
      if (arenaRef.current)
        arenaRef.current.style.transform = `translateX(${-x * 0.12}px) scale(1.06)`;
      const lean = Math.max(-9, Math.min(9, world.current.x * 0.09));
      if (boyRef.current) boyRef.current.style.transform = `rotate(${lean}deg)`;
      if (girlRef.current) girlRef.current.style.transform = `rotate(${-lean}deg)`;
      const sag = 13 + Math.sin(t / 190) * 3 + Math.min(14, Math.abs(world.current.vel) * 0.05);
      const d = `M 196 126 Q 460 ${126 + sag} 724 130`;
      ropeARef.current?.setAttribute("d", d);
      ropeBRef.current?.setAttribute("d", d);
      ropeCRef.current?.setAttribute("d", d);
      flagRef.current?.setAttribute(
        "transform",
        `translate(${460 + world.current.x * 0.16} ${126 + sag * 0.5})`,
      );

      if (t - lastFrame > 55) {
        lastFrame = t;
        setFrame((f) => f + 1);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast, finishMatch, pushEvent, resolveOffline]);

  /* -------------------------------- keyboard ------------------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const code = e.code;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (showHelp || showStats) {
        if (k === "Escape") {
          setShowHelp(false);
          setShowStats(false);
          localStorage.setItem(ONBOARD_KEY, "1");
        }
        return;
      }
      if (lobbyOpen) {
        if (k === "Escape") {
          if (linkRef.current) leaveRoom();
          else setLobbyOpen(false);
        }
        return;
      }
      if (over.current && (k === " " || k === "Enter" || code === "KeyR")) {
        e.preventDefault();
        rematch();
        return;
      }
      audio.unlock();

      const online = netRef.current;
      const m = modeRef.current;

      const pickLocal = (side: SideId, idx: number) => {
        if (online) {
          if (online.role === "host" && side === "left") resolveOnline("left", idx);
          else if (online.role === "guest" && side === "right") sendOnlineAnswer(idx);
        } else {
          resolveOffline(side, idx, false);
        }
      };
      const typeLocal = (side: SideId, d: string) => {
        if (online) {
          const rt = online;
          const buf = (rt.typed[side] + d).slice(-4);
          rt.typed[side] = buf;
          if ("1234".includes(d) && buf.length === 1) {
            pickLocal(side, Number(d) - 1);
            rt.typed[side] = "";
            return;
          }
          if (buf === rt.snap.problem.answerStr) {
            const i = rt.snap.problem.options.indexOf(rt.snap.problem.answer);
            rt.typed[side] = "";
            if (i >= 0) pickLocal(side, i);
          }
        } else {
          typeDigitOffline(side, d);
        }
      };

      if (code.startsWith("Numpad")) {
        const side: SideId = !online && m.id === "2p-duel" ? "right" : "left";
        const map: Record<string, number> = {
          Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad7: 0, Numpad8: 1,
        };
        if (map[code] !== undefined) {
          e.preventDefault();
          pickLocal(side, map[code]);
          return;
        }
        const mm = code.match(/^Numpad([0-9])$/);
        if (mm?.[1]) {
          e.preventDefault();
          typeLocal(side, mm[1]);
          return;
        }
      }

      if (!online && m.id === "2p-duel" && code.startsWith("Arrow")) {
        const map: Record<string, number> = {
          ArrowLeft: 0, ArrowUp: 1, ArrowDown: 2, ArrowRight: 3,
        };
        if (map[code] !== undefined) {
          e.preventDefault();
          pickLocal("right", map[code]);
          return;
        }
      }

      if (online && online.role === "guest" && code.startsWith("Arrow")) {
        const map: Record<string, number> = {
          ArrowLeft: 0, ArrowUp: 1, ArrowDown: 2, ArrowRight: 3,
        };
        if (map[code] !== undefined) {
          e.preventDefault();
          pickLocal("right", map[code]);
          return;
        }
      }

      if (k === "1" || k === "2" || k === "3" || k === "4") {
        e.preventDefault();
        pickLocal(online ? (online.role === "host" ? "left" : "right") : "left", Number(k) - 1);
        return;
      }
      const hot: Record<string, number> = { q: 0, w: 1, e: 2, r: 3, a: 0, s: 1, d: 2, f: 3 };
      const lower = k.toLowerCase();
      if (hot[lower] !== undefined) {
        e.preventDefault();
        pickLocal(online ? (online.role === "host" ? "left" : "right") : "left", hot[lower]);
        return;
      }
      if (/^[0-9]$/.test(k)) {
        e.preventDefault();
        typeLocal(online ? (online.role === "host" ? "left" : "right") : "left", k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyOpen, leaveRoom, resolveOffline, resolveOnline, sendOnlineAnswer, typeDigitOffline]);

  const rematch = useCallback(() => {
    if (netRef.current) {
      linkRef.current?.send({ t: "rematch" });
      if (netRef.current.role === "host") startOnlineMatch();
      else {
        over.current = false;
        setWinner(null);
      }
    } else {
      resetOffline();
    }
  }, [resetOffline, startOnlineMatch]);

  /* --------------------------------- views -------------------------------- */
  const now = performance.now();
  const rt = netRef.current;

  const offlineView = (side: SideId): CardView => {
    const s = sides.current[side];
    const m = MODES[modeIndex];
    const isAI = side === "left" ? m.leftAI : m.rightAI;
    const name =
      side === "left"
        ? m.leftAI
          ? "BOT 1"
          : handle
        : m.rightAI
          ? "BOT"
          : m.id === "2p-duel"
            ? "P2"
            : peerName || "BOT";
    return {
      role: `${name} · ${side === "left" ? "RED" : "BLUE"}`,
      handle: name,
      equation: s.problem.equation,
      options: s.problem.options,
      score: s.score,
      streak: s.streak,
      surge: s.surge,
      status: s.status,
      flash: s.flash && now < s.lockedUntil ? s.flash : null,
      picked: s.flash && now < s.lockedUntil ? s.picked : null,
      typed: s.typed,
      interactive: !over.current && !isAI && now >= s.lockedUntil && !pausedRef.current,
      botRemain: isAI ? Math.max(0, (s.aiThink - s.aiElapsed) / 1000) : null,
      accent: side === "left" ? "red" : "blue",
      side,
    };
  };

  const onlineView = (side: SideId): CardView => {
    if (!rt) return offlineView(side);
    const snapSide = rt.snap[side];
    const locked =
      rt.role === "host"
        ? now < rt.locks[side]
        : snapSide.locked > 0 || (side === "right" && now < rt.guestLock);
    const showFlash = rt.role === "host" ? now < rt.flashUntil[side] : snapSide.flash !== null;
    const name = side === "left" ? rt.snap.hostName : rt.snap.guestName;
    const mine = rt.role === "host" ? side === "left" : side === "right";
    return {
      role: `${name} · ${side === "left" ? "RED" : "BLUE"}`,
      handle: name,
      equation: rt.snap.problem.equation,
      options: rt.snap.problem.options,
      score: snapSide.score,
      streak: snapSide.streak,
      surge: snapSide.surge,
      status: mine && rt.role === "guest" && now < rt.guestLock && !snapSide.flash ? "HEAVE INBOUND…" : snapSide.status,
      flash: showFlash ? snapSide.flash : null,
      picked: showFlash ? snapSide.picked : null,
      typed: rt.typed[side],
      interactive:
        mine && !locked && rt.gotSnap && !rt.snap.over && !over.current && !pausedRef.current,
      botRemain: null,
      accent: side === "left" ? "red" : "blue",
      side,
    };
  };

  const viewFor = (side: SideId) => (rt ? onlineView(side) : offlineView(side));
  const leftView = viewFor("left");
  const rightView = viewFor("right");

  const onPick = (side: SideId) => (idx: number) => {
    audio.unlock();
    if (!rt) {
      resolveOffline(side, idx, false);
      return;
    }
    if (rt.role === "host" && side === "left") resolveOnline("left", idx);
    if (rt.role === "guest" && side === "right") sendOnlineAnswer(idx);
  };

  const modeLabel = rt ? "Mode: Online Duel" : MODES[modeIndex].label;
  const tierLabel = rt ? `Tier: ${COMPLEXITY[rt.snap.tier - 1]?.name ?? "Standard"}` : COMPLEXITY[cxIndex].label;

  const netBadge = rt ? (
    <span
      className="num flex items-center gap-1.5 border px-2 py-[3px] text-[9px] tracking-[0.16em]"
      style={{
        borderColor: netStatus === "online" ? "#b6f24a55" : "#ffb02055",
        color: netStatus === "online" ? "#b6f24a" : "#ffb020",
        background: "#0a0d12",
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5"
        style={{
          background: "currentColor",
          animation: netStatus === "online" ? "none" : "dotPulse 1s infinite",
        }}
      />
      {netStatus === "online" ? `LINKED ${rtt ? `${rtt}MS` : ""}` : "LINKING"}
      <span className="text-[#8b99ad]">· {netCode}</span>
    </span>
  ) : null;

  return (
    <div
      className={`relative h-[100dvh] w-screen overflow-hidden bg-[#0a0d12] ${shake ? "screen-shake" : ""}`}
      onPointerDown={() => audio.unlock()}
    >
      {/* ------------------------------ arena art ---------------------------- */}
      <img
        ref={arenaRef}
        src={arenaArt}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full scale-[1.06] object-cover will-change-transform"
      />
      <div className="crowd pointer-events-none absolute inset-x-0 top-[8%] h-[38%] grain" />
      <div className="flood pointer-events-none absolute -left-[8%] top-[-12%] h-[52%] w-[42%] rounded-full bg-[radial-gradient(circle,rgba(255,224,150,0.42),transparent_65%)] blur-[6px]" />
      <div
        className="flood pointer-events-none absolute -right-[8%] top-[-12%] h-[52%] w-[42%] rounded-full bg-[radial-gradient(circle,rgba(190,235,255,0.4),transparent_65%)] blur-[6px]"
        style={{ animationDelay: "1.6s" }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="scanline absolute inset-x-0 h-[28%] bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.05),transparent)]" />
      </div>
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.5]" />
      <div className="vignette pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(to_top,rgba(6,8,12,0.86),transparent)]" />

      {/* --------------------------------- HUD ------------------------------- */}
      <header className="game-header absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div className="game-header-info flex flex-wrap items-center gap-1.5">
          <div className="slab slab-sm">
            <div className="face flex items-center gap-2.5 px-2.5 py-1.5">
              <Brand compact />
            </div>
          </div>
          <div
            className="num px-2 py-[7px] text-[10px] font-bold tracking-[0.14em] text-[#2a1a00]"
            style={{ background: "linear-gradient(120deg,#ffb020,#ff6a2b)" }}
          >
            PULL #{pull}
          </div>
          {lastPull && (
            <div className="num border border-[#2c3846] bg-[#0a0d12]/85 px-2 py-[6px] text-[9.5px] tracking-[0.14em] text-[#25d9ff]">
              {lastPull}
            </div>
          )}
          {netBadge}
        </div>

        <div className="game-header-actions flex flex-wrap items-center justify-end gap-1 sm:gap-1.5">
          <button
            className="pill"
            style={{
              borderColor: rt ? "#b6f24a66" : "#ffb02066",
              color: rt ? "#b6f24a" : "#ffb020",
            }}
            onClick={() => {
              audio.playKey();
              setLobbyOpen(true);
            }}
          >
            {rt ? "Room" : "⚡ Online duel"}
          </button>
          <button className="pill" onClick={() => { audio.playKey(); setShowStats(true); }}>
            Stats
          </button>
          <button className="pill" onClick={() => { audio.playKey(); setShowHelp(true); }}>
            How to play
          </button>
          <button
            className="pill hidden sm:inline-block"
            disabled={!!rt}
            onClick={() => {
              audio.playKey();
              if (!rt) setModeIndex((i) => (i + 1) % MODES.length);
            }}
            style={rt ? { opacity: 0.45 } : undefined}
          >
            {modeLabel}
          </button>
          <button
            className="pill hidden sm:inline-block"
            disabled={!!rt}
            onClick={() => {
              audio.playKey();
              if (!rt) setCxIndex((i) => (i + 1) % COMPLEXITY.length);
            }}
            style={rt ? { opacity: 0.45 } : undefined}
          >
            {tierLabel}
          </button>
          <button
            className="pill"
            onClick={() => {
              setSoundOn((v) => !v);
              audio.playKey();
            }}
          >
            Sfx {soundOn ? "on" : "off"}
          </button>
          <button className="pill" onClick={() => { audio.playKey(); rematch(); }}>
            {winner ? "Rematch" : "Reset"}
          </button>
        </div>
      </header>

      <Jumbotron
        redScore={leftView.score}
        blueScore={rightView.score}
        redName={leftView.handle}
        blueName={rightView.handle}
        ticker={ticker}
        pull={pull}
        deadlock={deadlock}
      />

      {/* tug meter */}
      <div className="tug-meter pointer-events-none absolute left-1/2 top-[27%] z-20 w-[min(420px,72vw)] -translate-x-1/2 sm:top-[28%]">
        <div className="relative h-[9px] w-full border border-[#2c3846] bg-[#0a0d12]/85">
          <div className="absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(90deg,rgba(255,45,85,0.42),transparent)]" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(270deg,rgba(37,217,255,0.42),transparent)]" />
          <div className="absolute inset-y-[-3px] left-1/2 w-px bg-[#ffb020]" />
          <div
            className="absolute top-[-4px] h-[15px] w-[7px] -translate-x-1/2 bg-[#ffb020] shadow-[0_0_12px_#ffb020]"
            style={{ left: `${50 + Math.max(-50, Math.min(50, (world.current.x / WIN_AT) * 50))}%` }}
          />
        </div>
        <div className="num mt-1 flex justify-between text-[8px] tracking-[0.2em] text-[#8b99ad]">
          <span style={{ color: "#ff8098" }}>◀ RED BOUNDARY</span>
          <span>BLUE BOUNDARY ▶</span>
        </div>
      </div>

      {/* ------------------------------ fighters ----------------------------- */}
      <div className="fighters-stage absolute inset-x-0 top-[36%] z-10 h-[46%]">
        <div
          ref={stageRef}
          className="relative mx-auto h-full w-[min(940px,97vw)] will-change-transform"
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            viewBox="0 0 920 280"
            preserveAspectRatio="none"
          >
            <path ref={ropeARef} d="M 196 126 Q 460 139 724 130" fill="none" stroke="#4a2f16" strokeWidth="27" strokeLinecap="round" />
            <path ref={ropeBRef} d="M 196 126 Q 460 139 724 130" fill="none" stroke="#c9a26a" strokeWidth="18" strokeLinecap="round" />
            <path ref={ropeCRef} d="M 196 126 Q 460 139 724 130" fill="none" stroke="#7a4e24" strokeWidth="18" strokeLinecap="round" strokeDasharray="8 12" opacity="0.5" />
            <g ref={flagRef} transform="translate(460 133)">
              <line x1="0" y1="-26" x2="0" y2="20" stroke="#2a1a0c" strokeWidth="2.5" />
              <polygon points="0,-26 20,-20 0,-13" fill="#ffb020" />
            </g>
          </svg>

          <div id="fighter-left" ref={boyRef} className="absolute bottom-[8%] left-[1%] w-[min(225px,31vw)] origin-bottom">
            <div className="absolute bottom-0 left-1/2 h-4 w-[58%] -translate-x-1/2 rounded-[100%] bg-black/45 blur-[7px]" />
            <img src={boyArt} alt="Red contender" draggable={false} className="relative w-full drop-shadow-[0_20px_14px_rgba(0,0,0,0.5)]" />
          </div>
          <div id="fighter-right" ref={girlRef} className="absolute bottom-[6%] right-[-1%] w-[min(165px,22vw)] origin-bottom">
            <div className="absolute bottom-0 left-1/2 h-4 w-[58%] -translate-x-1/2 rounded-[100%] bg-black/45 blur-[7px]" />
            <img src={girlArt} alt="Blue contender" draggable={false} className="relative w-full drop-shadow-[0_20px_14px_rgba(0,0,0,0.5)]" />
          </div>
        </div>
      </div>

      {/* court marks */}
      <div className="pointer-events-none absolute left-1/2 top-[64%] z-[9] h-24 w-px -translate-x-1/2 bg-white/45" />
      <div className="pointer-events-none absolute left-1/2 top-[70%] z-[9] h-10 w-10 -translate-x-1/2 rounded-full border border-white/35" />

      {dust.map((p) => (
        <span
          key={p.id}
          className="dust pointer-events-none absolute z-20 rounded-full"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              background: p.tint,
              "--dx": p.dx,
              "--dy": p.dy,
            } as React.CSSProperties
          }
        />
      ))}

      {floaters.map((f) => (
        <div
          key={f.id}
          className="float-text absolute z-30 text-[20px] sm:text-[23px]"
          style={{ left: f.side === "left" ? "24%" : "76%", top: "40%", color: f.color }}
        >
          {f.text}
        </div>
      ))}

      <CombatCard view={leftView} onPick={onPick("left")} hotkeys="left" shake={leftView.flash === "wrong"} />
      <CombatCard view={rightView} onPick={onPick("right")} hotkeys="right" shake={rightView.flash === "wrong"} />

      <footer className="num pointer-events-none absolute bottom-[2px] left-1/2 z-20 -translate-x-1/2 text-[8px] tracking-[0.28em] text-[#8b99ad]/70">
        KDMIRAH.GAME · KRACKED·D·MATH
      </footer>

      {winner && (
        <WinOverlay
          winner={winner}
          redScore={leftView.score}
          blueScore={rightView.score}
          redName={leftView.handle}
          blueName={rightView.handle}
          online={!!rt}
          onRematch={rematch}
          onExit={leaveRoom}
        />
      )}

      <Lobby
        open={lobbyOpen}
        status={netStatus}
        detail={netDetail}
        code={netCode}
        role={netRole}
        rtt={rtt}
        peerName={peerName}
        presetCode={presetCode}
        handle={handle}
        onHandle={setHandle}
        onHost={hostRoom}
        onJoin={joinRoom}
        onCancel={leaveRoom}
        onClose={() => setLobbyOpen(false)}
        onStart={() => {
          setLobbyOpen(false);
          startOnlineMatch();
        }}
      />

      {showHelp && (
        <HelpOverlay
          onClose={() => {
            setShowHelp(false);
            localStorage.setItem(ONBOARD_KEY, "1");
            audio.unlock();
            audio.playStart();
          }}
        />
      )}

      {showStats && (
        <StatsOverlay
          career={career}
          redScore={leftView.score}
          blueScore={rightView.score}
          onClose={() => setShowStats(false)}
          onReset={() => {
            const fresh = { ...DEFAULT_CAREER };
            setCareer(fresh);
            saveCareer(fresh);
          }}
        />
      )}
    </div>
  );
}
