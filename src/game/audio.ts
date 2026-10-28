export class GameAudio {
  private ctx: AudioContext | null = null;
  muted = false;

  setMuted(v: boolean) {
    this.muted = v;
  }

  private ac(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.ac();
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain = 0.08,
    at = 0,
    slideTo?: number,
  ) {
    const ctx = this.ac();
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain = 0.04, at = 0, hp = 400) {
    const ctx = this.ac();
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = n.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = n;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  playPop(streak: number, side: "left" | "right") {
    const base = side === "left" ? 520 : 620;
    const f = base + Math.min(streak, 8) * 40;
    this.tone(f, 0.09, "square", 0.06);
    this.tone(f * 2, 0.07, "triangle", 0.03, 0.02);
  }

  playHeave(side: "left" | "right") {
    const f = side === "left" ? 90 : 110;
    this.tone(f, 0.22, "sawtooth", 0.07, 0, 50);
    this.noise(0.16, 0.045, 0.02, 200);
  }

  playSuperHeave(side: "left" | "right") {
    const f = side === "left" ? 70 : 84;
    this.tone(f, 0.45, "sawtooth", 0.1, 0, 40);
    this.tone(f * 2, 0.35, "square", 0.05, 0.04, 80);
    this.tone(880, 0.18, "triangle", 0.05, 0.02);
    this.tone(1320, 0.16, "triangle", 0.04, 0.08);
    this.noise(0.28, 0.07, 0, 150);
  }

  playError(_side: "left" | "right") {
    this.tone(220, 0.16, "square", 0.06, 0, 90);
    this.tone(160, 0.2, "sawtooth", 0.04, 0.05, 70);
  }

  playSurgeReady(_side: "left" | "right") {
    this.tone(523, 0.12, "triangle", 0.06);
    this.tone(659, 0.12, "triangle", 0.06, 0.08);
    this.tone(784, 0.18, "triangle", 0.07, 0.16);
  }

  playWin(side: "left" | "right") {
    const root = side === "left" ? 392 : 440;
    this.tone(root, 0.18, "square", 0.07);
    this.tone(root * 1.25, 0.18, "square", 0.06, 0.12);
    this.tone(root * 1.5, 0.22, "square", 0.07, 0.24);
    this.tone(root * 2, 0.35, "triangle", 0.08, 0.36);
  }

  playClick() {
    this.tone(1400, 0.04, "square", 0.03);
  }

  playStart() {
    this.tone(330, 0.1, "square", 0.05);
    this.tone(440, 0.12, "square", 0.05, 0.1);
    this.tone(660, 0.18, "triangle", 0.06, 0.2);
  }

  playKey() {
    this.tone(1180, 0.035, "square", 0.025);
  }

  playJoin() {
    this.tone(440, 0.09, "triangle", 0.05);
    this.tone(660, 0.09, "triangle", 0.05, 0.09);
    this.tone(880, 0.16, "square", 0.05, 0.18);
  }

  playLink() {
    this.tone(240, 0.1, "sawtooth", 0.04, 0, 720);
    this.tone(720, 0.14, "triangle", 0.05, 0.08);
  }

  playDrop() {
    this.tone(330, 0.16, "sawtooth", 0.05, 0, 110);
    this.tone(150, 0.26, "square", 0.04, 0.1, 70);
  }

  playCountdown(step: number) {
    this.tone(step === 0 ? 880 : 520, 0.12, "square", 0.06);
  }
}

export const audio = new GameAudio();
