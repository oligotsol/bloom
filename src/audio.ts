export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
  }

  get ready(): boolean {
    return !!this.ctx && !this.muted;
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain = 0.2,
    when = 0,
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.now() + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain = 0.08, freq = 400): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.now();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  drop(): void {
    this.tone(220, 0.08, "sine", 0.1);
    this.tone(330, 0.1, "triangle", 0.06, 0.02);
  }

  land(): void {
    this.noise(0.07, 0.05, 280);
    this.tone(140, 0.09, "sine", 0.12);
  }

  bloom(tier: number, combo: number): void {
    const base = 330 + tier * 80 + Math.min(combo, 6) * 30;
    this.tone(base, 0.22, "sine", 0.16);
    this.tone(base * 1.26, 0.28, "triangle", 0.1, 0.04);
    this.tone(base * 1.5, 0.32, "sine", 0.08, 0.08);
    if (combo >= 2) this.tone(base * 2, 0.18, "triangle", 0.06, 0.12);
  }

  clear(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.tone(n, 0.35, "sine", 0.12, i * 0.06));
  }

  over(): void {
    this.tone(196, 0.28, "sine", 0.14);
    this.tone(155, 0.4, "triangle", 0.1, 0.12);
    this.tone(98, 0.55, "sine", 0.1, 0.28);
  }

  start(): void {
    this.tone(392, 0.16, "sine", 0.1);
    this.tone(523, 0.22, "triangle", 0.08, 0.08);
    this.tone(659, 0.28, "sine", 0.07, 0.16);
  }
}
