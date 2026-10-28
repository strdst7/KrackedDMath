import Peer, { type DataConnection } from "peerjs";
import type { OnlineSnap } from "./types";

export const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const PROTO = "kdmirah";
const SNAPSHOT_V = 1;

export function makeCode(len = 5): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 6);
}

function mid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export type LinkStatus =
  | "idle"
  | "opening"
  | "waiting"
  | "online"
  | "error"
  | "closed";

export type NetMsg =
  | { t: "hello"; name: string; v: number; mid: string }
  | { t: "welcome"; name: string; youSide: "right"; mid: string }
  | { t: "answer"; idx: number; mid: string }
  | { t: "rematch"; mid: string }
  | { t: "snap"; s: OnlineSnap; mid: string }
  | { t: "ping"; ts: number; mid: string }
  | { t: "pong"; ts: number; mid: string }
  | { t: "bye"; mid: string };

export interface LinkHooks {
  onStatus?: (status: LinkStatus, detail?: string) => void;
  onMessage?: (m: NetMsg, via: "p2p" | "local") => void;
  onPeerName?: (name: string) => void;
  onRtt?: (ms: number) => void;
}

/**
 * Dual-transport room link.
 *  - WebRTC via the public PeerJS broker (true cross-device play)
 *  - BroadcastChannel (two tabs / windows on the same browser, always works)
 * Every message is sent on both channels and de-duplicated by id, so the
 * duel stays alive even when the public relay is unreachable.
 */
export class NetLink {
  readonly role: "host" | "guest";
  code: string;
  name: string;
  status: LinkStatus = "idle";
  detail = "";
  rtt = 0;

  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private bc: BroadcastChannel | null = null;
  private bcLive = false;
  private p2pLive = false;
  private seen = new Set<string>();
  private hooks: LinkHooks;
  private helloTimer: number | null = null;
  private beatTimer: number | null = null;
  private watchTimer: number | null = null;
  private lastInbound = 0;
  private retries = 0;
  private destroyed = false;

  constructor(role: "host" | "guest", code: string, name: string, hooks: LinkHooks) {
    this.role = role;
    this.code = code;
    this.name = name;
    this.hooks = hooks;
  }

  get connected(): boolean {
    return this.status === "online";
  }

  private setStatus(s: LinkStatus, detail = "") {
    if (this.destroyed) return;
    this.status = s;
    this.detail = detail;
    this.hooks.onStatus?.(s, detail);
  }

  private peerId(): string {
    return `${PROTO}-${this.code.toLowerCase()}`;
  }

  start() {
    this.setStatus("opening");
    this.openLocal();
    this.openP2P();
    this.beatTimer = window.setInterval(() => this.beat(), 2000);
    this.watchTimer = window.setInterval(() => this.watchdog(), 1500);
  }

  /* ---------------- BroadcastChannel (same-browser fallback) -------------- */

  private openLocal() {
    if (typeof BroadcastChannel === "undefined") return;
    try {
      this.bc = new BroadcastChannel(`${PROTO}-${this.code}`);
      this.bc.onmessage = (ev: MessageEvent) => this.receive(ev.data, "local");
    } catch {
      this.bc = null;
    }
  }

  /* --------------------------- WebRTC / PeerJS --------------------------- */

  private openP2P() {
    let peer: Peer;
    try {
      peer =
        this.role === "host"
          ? new Peer(this.peerId(), { debug: 0 })
          : new Peer({ debug: 0 });
    } catch (e) {
      this.noteP2PDown(e instanceof Error ? e.message : "relay unavailable");
      return;
    }
    this.peer = peer;

    const timeout = window.setTimeout(() => {
      if (!this.p2pLive) this.noteP2PDown("relay timeout");
    }, 9000);

    peer.on("open", () => {
      window.clearTimeout(timeout);
      if (this.role === "host") {
        if (!this.p2pLive) this.setStatus(this.bcLive ? "online" : "waiting");
      } else {
        this.dial();
      }
    });

    peer.on("connection", (conn) => {
      this.attach(conn);
    });

    peer.on("error", (err: Error & { type?: string }) => {
      const type = err.type ?? "unknown";
      if (type === "peer-unavailable") {
        this.noteP2PDown("Room code not found on the relay");
        return;
      }
      if (type === "unavailable-id" && this.role === "host" && this.retries < 4) {
        this.retries++;
        this.regenerate();
        return;
      }
      this.noteP2PDown(`Relay: ${type}`);
    });

    peer.on("disconnected", () => {
      if (!this.destroyed && !this.p2pLive) {
        try {
          peer.reconnect();
        } catch {
          /* ignore */
        }
      }
    });
  }

  private regenerate() {
    const fresh = makeCode();
    this.code = fresh;
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
    this.peer = null;
    this.p2pLive = false;
    try {
      this.bc?.close();
    } catch {
      /* ignore */
    }
    this.bcLive = false;
    this.openLocal();
    this.openP2P();
  }

  private dial() {
    if (this.destroyed || !this.peer) return;
    const conn = this.peer.connect(this.peerId(), { reliable: true });
    this.attach(conn);
  }

  private attach(conn: DataConnection) {
    this.conn = conn;
    conn.on("open", () => {
      this.p2pLive = true;
      this.lastInbound = performance.now();
      this.setStatus("online");
      this.send({ t: "hello", name: this.name, v: SNAPSHOT_V, mid: mid() });
    });
    conn.on("data", (data) => this.receive(data, "p2p"));
    conn.on("close", () => this.drop("Opponent disconnected"));
    conn.on("error", () => this.drop("Connection error"));
  }

  private noteP2PDown(reason: string) {
    this.p2pLive = false;
    if (this.bcLive) {
      this.setStatus("online");
      this.detail = reason;
      return;
    }
    if (this.role === "host") {
      this.setStatus("waiting", reason);
    } else {
      this.setStatus("error", reason);
    }
  }

  /* ------------------------------ messaging ------------------------------ */

  private receive(data: unknown, via: "p2p" | "local") {
    if (this.destroyed) return;
    const m = data as NetMsg;
    if (!m || typeof m !== "object" || !("t" in m)) return;
    const key = `${via}:${m.mid}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.seen.size > 600) this.seen.clear();

    this.lastInbound = performance.now();
    if (via === "local") {
      this.bcLive = true;
      if (this.status !== "online") this.setStatus("online");
    }

    switch (m.t) {
      case "hello":
        this.hooks.onPeerName?.(m.name);
        if (this.role === "host") {
          this.send({ t: "welcome", name: this.name, youSide: "right", mid: mid() });
        }
        break;
      case "welcome":
        this.hooks.onPeerName?.(m.name);
        if (!this.p2pLive && !this.bcLive) this.bcLive = true;
        this.setStatus("online");
        break;
      case "ping":
        this.send({ t: "pong", ts: m.ts, mid: mid() });
        break;
      case "pong":
        this.rtt = Math.max(0, Math.round(performance.now() - m.ts));
        this.hooks.onRtt?.(this.rtt);
        break;
      case "bye":
        this.drop("Opponent left the arena");
        return;
      case "rematch":
        break;
      default:
        break;
    }
    this.hooks.onMessage?.(m, via);
  }

  send(m: Omit<NetMsg, "mid"> | NetMsg) {
    if (this.destroyed) return;
    const msg = { ...m, mid: (m as NetMsg).mid ?? mid() } as NetMsg;
    try {
      if (this.conn?.open) this.conn.send(msg);
    } catch {
      /* ignore */
    }
    try {
      if (this.bc && (this.bcLive || this.role === "host")) this.bc.postMessage(msg);
    } catch {
      /* ignore */
    }
  }

  private beat() {
    if (this.destroyed || this.status !== "online") return;
    this.send({ t: "ping", ts: performance.now(), mid: mid() });
  }

  private watchdog() {
    if (this.destroyed || this.status !== "online") return;
    if (performance.now() - this.lastInbound > 11000) {
      this.drop("Connection timed out");
    }
  }

  private drop(reason: string) {
    if (this.destroyed || this.status === "closed") return;
    this.setStatus("closed", reason);
  }

  /** Guest keeps announcing itself until the host answers. */
  startHandshake() {
    if (this.role !== "host") {
      this.send({ t: "hello", name: this.name, v: SNAPSHOT_V, mid: mid() });
      this.helloTimer = window.setInterval(() => {
        if (this.status === "online") {
          if (this.helloTimer) window.clearInterval(this.helloTimer);
          this.helloTimer = null;
          return;
        }
        this.send({ t: "hello", name: this.name, v: SNAPSHOT_V, mid: mid() });
      }, 800);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.send({ t: "bye", mid: mid() });
    if (this.helloTimer) window.clearInterval(this.helloTimer);
    if (this.beatTimer) window.clearInterval(this.beatTimer);
    if (this.watchTimer) window.clearInterval(this.watchTimer);
    try {
      this.conn?.close();
    } catch {
      /* ignore */
    }
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
    try {
      this.bc?.close();
    } catch {
      /* ignore */
    }
    this.conn = null;
    this.peer = null;
    this.bc = null;
    this.p2pLive = false;
    this.bcLive = false;
    this.setStatus("closed", "left");
  }
}

export function inviteLink(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?join=${code}`;
}

export function codeFromUrl(): string {
  try {
    const p = new URLSearchParams(window.location.search);
    return normalizeCode(p.get("join") ?? "");
  } catch {
    return "";
  }
}
