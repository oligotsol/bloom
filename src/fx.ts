export type ParticleKind = "petal" | "spark" | "puff" | "ring";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: ParticleKind;
  rot: number;
  spin: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  color: string;
  scale: number;
}

export class Fx {
  particles: Particle[] = [];
  floaters: Floater[] = [];
  shake = 0;
  flash = 0;
  pulse = 0;

  private ambient: Particle[] = [];

  seedAmbient(w: number, h: number): void {
    this.ambient = [];
    const palette = ["#6ef0c4", "#ff8b74", "#c4a6ff", "#ffe08a", "#ff6ec7"];
    for (let i = 0; i < 28; i++) {
      this.ambient.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 8,
        vy: -6 - Math.random() * 14,
        life: 1,
        max: 1,
        size: 3 + Math.random() * 7,
        color: palette[i % palette.length]!,
        kind: "petal",
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.4,
      });
    }
  }

  get backdrop(): Particle[] {
    return this.ambient;
  }

  burst(x: number, y: number, color: string, power = 1, petals = 14): void {
    const n = Math.round(petals * power);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const s = 40 + Math.random() * 140 * power;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        life: 0.55 + Math.random() * 0.45,
        max: 1,
        size: 4 + Math.random() * 7 * power,
        color,
        kind: "petal",
        rot: a,
        spin: (Math.random() - 0.5) * 6,
      });
    }
    for (let i = 0; i < 8 * power; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 220 * power;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.25,
        max: 1,
        size: 1.5 + Math.random() * 2,
        color: "#fff6e8",
        kind: "spark",
        rot: 0,
        spin: 0,
      });
    }
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.45,
      max: 0.45,
      size: 18 * power,
      color,
      kind: "ring",
      rot: 0,
      spin: 0,
    });
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.3,
      max: 0.3,
      size: 12 * power,
      color,
      kind: "puff",
      rot: 0,
      spin: 0,
    });
  }

  popup(x: number, y: number, text: string, color: string, scale = 1): void {
    this.floaters.push({
      x,
      y,
      text,
      life: 0.9,
      max: 0.9,
      color,
      scale,
    });
  }

  rumble(amount: number): void {
    this.shake = Math.min(22, this.shake + amount);
    this.flash = Math.min(0.35, this.flash + amount * 0.012);
    this.pulse = Math.min(1, this.pulse + amount * 0.04);
  }

  update(dt: number, w: number, h: number): void {
    this.shake *= Math.pow(0.04, dt);
    if (this.shake < 0.15) this.shake = 0;
    this.flash *= Math.pow(0.08, dt);
    this.pulse = Math.max(0, this.pulse - dt * 1.4);

    const next: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.kind === "petal") {
        p.vy += 90 * dt;
        p.vx *= 1 - 0.8 * dt;
      } else if (p.kind === "spark") {
        p.vy += 40 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      next.push(p);
    }
    this.particles = next;

    const floats: Floater[] = [];
    for (const f of this.floaters) {
      f.life -= dt;
      if (f.life <= 0) continue;
      f.y -= 42 * dt;
      floats.push(f);
    }
    this.floaters = floats;

    if (this.ambient.length === 0) this.seedAmbient(w, h);
    for (const a of this.ambient) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.spin * dt;
      if (a.y < -20) {
        a.y = h + 20;
        a.x = Math.random() * w;
      }
      if (a.x < -20) a.x = w + 10;
      if (a.x > w + 20) a.x = -10;
    }
  }

  offsets(): { x: number; y: number } {
    if (!this.shake) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shake,
      y: (Math.random() - 0.5) * this.shake,
    };
  }
}
