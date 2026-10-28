import type { Problem } from "./math";

export type SideId = "left" | "right";

export interface SideState {
  problem: Problem;
  streak: number;
  surge: number;
  score: number;
  tier: number;
  correctCount: number;
  attempts: number;
  lockedUntil: number;
  aiThink: number;
  aiElapsed: number;
  problemStart: number;
  typed: string;
  flash: "correct" | "wrong" | null;
  picked: number | null;
  status: string;
}

export interface Floater {
  id: number;
  text: string;
  color: string;
  side: SideId;
}

export interface DustBit {
  id: number;
  x: number;
  y: number;
  dx: string;
  dy: string;
  size: number;
  tint: string;
}

export interface Career {
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  problemsAttempted: number;
  problemsCorrect: number;
  currentWinStreak: number;
  bestWinStreak: number;
  fastestSolveSec: number;
  onlineWins: number;
  onlineLosses: number;
}

/** One contender's state as seen across the wire. */
export interface SnapSide {
  score: number;
  streak: number;
  surge: number;
  solved: number;
  locked: number;
  status: string;
  flash: "correct" | "wrong" | null;
  picked: number | null;
}

export type NetEventKind =
  | "heave"
  | "super"
  | "miss"
  | "fast"
  | "streak"
  | "win"
  | "surgeReady";

export interface NetEvent {
  eid: number;
  kind: NetEventKind;
  side: SideId;
  text?: string;
}

/** Authoritative match snapshot broadcast by the host. */
export interface OnlineSnap {
  v: number;
  problem: Problem;
  tier: number;
  worldX: number;
  worldVel: number;
  over: SideId | null;
  ticker: string;
  pull: number;
  lastPull: string;
  left: SnapSide;
  right: SnapSide;
  events: NetEvent[];
  hostName: string;
  guestName: string;
}

/** Normalised props fed to a combat card, from either local or net state. */
export interface CardView {
  role: string;
  handle: string;
  equation: string;
  options: number[];
  score: number;
  streak: number;
  surge: number;
  status: string;
  flash: "correct" | "wrong" | null;
  picked: number | null;
  typed: string;
  interactive: boolean;
  botRemain: number | null;
  accent: "red" | "blue";
  side: SideId;
}
