import {
  CLEAR_BONUS,
  COLORS,
  COLS,
  DANGER_ROW,
  FALL_MS,
  GRAVITY_MS,
  GROW_MS,
  LAND_MS,
  MAX_TIER,
  MERGE_MIN,
  PULSE_MS,
  BURST_MS,
  ROWS,
  STORAGE_BEST,
  TIER_SCORE,
} from "./config";
import { Synth } from "./audio";
import { Fx } from "./fx";

export type Screen = "title" | "play" | "over";

export interface Piece {
  id: number;
  col: number;
  row: number;
  color: number;
  tier: number;
  y: number;
  squash: number;
  grow: number;
  pulse: number;
}

interface Group {
  cells: { c: number; r: number }[];
  color: number;
  tier: number;
}

type Anim =
  | { kind: "idle" }
  | { kind: "fall"; t: number; fromY: number; toRow: number }
  | { kind: "land"; t: number }
  | { kind: "pulse"; t: number; groups: Group[] }
  | { kind: "burst"; t: number; groups: Group[] }
  | { kind: "grow"; t: number }
  | { kind: "gravity"; t: number; movers: { piece: Piece; from: number; to: number }[] };

export class Game {
  screen: Screen = "title";
  grid: (Piece | null)[][] = [];
  current: Piece | null = null;
  nextColor = 0;
  nextTier = 0;
  aimCol = 2;
  aimX = 2;
  score = 0;
  best = 0;
  combo = 1;
  hint = true;
  drops = 0;
  anim: Anim = { kind: "idle" };
  busy = false;
  overNewBest = false;
  readonly fx = new Fx();
  readonly audio = new Synth();

  private id = 1;
  private bag: number[] = [];
  private layout = { x: 0, y: 0, cell: 48, w: 0, h: 0 };
  private demoWait = 0.4;
  time = 0;

  constructor() {
    this.best = Number(localStorage.getItem(STORAGE_BEST) || 0) || 0;
    this.resetBoard();
    this.rollNext();
  }

  setLayout(x: number, y: number, cell: number, w: number, h: number): void {
    this.layout = { x, y, cell, w, h };
  }

  get well() {
    return this.layout;
  }

  cellCenter(c: number, r: number): { x: number; y: number } {
    const { x, y, cell } = this.layout;
    return {
      x: x + (c + 0.5) * cell,
      y: y + (r + 0.5) * cell,
    };
  }

  private resetBoard(): void {
    this.grid = Array.from({ length: ROWS }, () => Array<Piece | null>(COLS).fill(null));
  }

  private makePiece(col: number, row: number, color: number, tier: number): Piece {
    return {
      id: this.id++,
      col,
      row,
      color,
      tier,
      y: row,
      squash: 0,
      grow: 1,
      pulse: 0,
    };
  }

  private refillBag(): void {
    this.bag = [0, 1, 2, 3];
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j]!, this.bag[i]!];
    }
  }

  private drawColor(): number {
    const almost = this.colorsWithCount(2);
    if (almost.length && Math.random() < 0.36) {
      return almost[Math.floor(Math.random() * almost.length)]!;
    }
    if (!this.bag.length) this.refillBag();
    return this.bag.pop()!;
  }

  private colorsWithCount(target: number): number[] {
    const seen = new Set<string>();
    const hits: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.grid[r]![c];
        if (!p || seen.has(`${c}:${r}`)) continue;
        const g = this.flood(c, r, p.color, p.tier, seen);
        if (g.length === target) hits.push(p.color);
      }
    }
    return hits;
  }

  private rollNext(): void {
    this.nextColor = this.drawColor();
    this.nextTier = 0;
  }

  private spawnCurrent(): void {
    const col = Math.max(0, Math.min(COLS - 1, Math.round(this.aimCol)));
    this.current = this.makePiece(col, -1, this.nextColor, this.nextTier);
    this.current.y = -1.15;
    this.rollNext();
  }

  start(): void {
    this.audio.unlock();
    this.audio.start();
    this.score = 0;
    this.combo = 1;
    this.hint = true;
    this.drops = 0;
    this.busy = false;
    this.overNewBest = false;
    this.anim = { kind: "idle" };
    this.resetBoard();
    this.bag = [];
    this.aimCol = 2;
    this.aimX = 2;
    this.rollNext();
    this.spawnCurrent();
    this.screen = "play";
  }

  restart(): void {
    this.start();
  }

  pointerToCol(px: number): number {
    const { x, cell } = this.layout;
    const col = Math.floor((px - x) / cell);
    return Math.max(0, Math.min(COLS - 1, col));
  }

  aimAt(col: number): void {
    if (this.screen !== "play" || this.busy) return;
    this.aimCol = Math.max(0, Math.min(COLS - 1, col));
  }

  nudge(dir: number): void {
    if (this.screen !== "play" || this.busy) return;
    this.aimCol = Math.max(0, Math.min(COLS - 1, Math.round(this.aimX) + dir));
  }

  drop(): void {
    if (this.screen === "title") {
      this.start();
      return;
    }
    if (this.screen === "over") {
      this.restart();
      return;
    }
    this.tryDrop(true);
  }

  private tryDrop(fromPlayer: boolean): void {
    if (this.busy || !this.current || this.anim.kind !== "idle") return;
    if (fromPlayer) {
      this.audio.unlock();
      this.audio.drop();
      this.hint = false;
      this.drops += 1;
    }
    const col = Math.round(this.aimX);
    this.current.col = col;
    const toRow = this.landingRow(col);
    this.busy = true;
    this.anim = {
      kind: "fall",
      t: 0,
      fromY: this.current.y,
      toRow,
    };
  }

  private landingRow(col: number): number {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!this.grid[r]![col]) return r;
    }
    return -1;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.screen === "title") this.tickDemo(dt);
    this.aimX += (this.aimCol - this.aimX) * Math.min(1, dt * 14);
    if (this.current && this.anim.kind === "idle") {
      this.current.col = Math.round(this.aimX);
      const bob = Math.sin(this.time * 3.2) * 0.05;
      this.current.y += (-1.08 + bob - this.current.y) * Math.min(1, dt * 10);
      this.current.squash *= Math.pow(0.02, dt);
    }

    for (const row of this.grid) {
      for (const p of row) {
        if (!p) continue;
        p.squash *= Math.pow(0.04, dt);
        p.pulse = Math.max(0, p.pulse - dt * 3);
        if (p.grow < 1) p.grow = Math.min(1, p.grow + dt * 4);
      }
    }

    const a = this.anim;
    if (a.kind === "fall" && this.current) {
      a.t += dt * 1000;
      const dest = a.toRow < 0 ? -0.15 : a.toRow;
      const u = Math.min(1, a.t / FALL_MS);
      const e = u * u * (3 - 2 * u);
      const eased = u * u;
      this.current.y = a.fromY + (dest - a.fromY) * (0.35 * e + 0.65 * eased);
      if (u >= 1) {
        this.current.row = a.toRow;
        this.current.y = dest;
        this.anim = { kind: "land", t: 0 };
        this.audio.land();
        this.fx.rumble(2.2);
      }
    } else if (a.kind === "land" && this.current) {
      a.t += dt * 1000;
      const u = Math.min(1, a.t / LAND_MS);
      this.current.squash = Math.sin(u * Math.PI) * 0.28;
      if (u >= 1) {
        const piece = this.current;
        this.current = null;
        if (piece.row < 0) {
          if (this.screen === "title") {
            this.resetBoard();
            this.spawnCurrent();
            this.busy = false;
            this.anim = { kind: "idle" };
            return;
          }
          this.endGame();
          return;
        }
        this.grid[piece.row]![piece.col] = piece;
        piece.y = piece.row;
        this.beginResolve();
      }
    } else if (a.kind === "pulse") {
      a.t += dt * 1000;
      const u = Math.min(1, a.t / PULSE_MS);
      for (const g of a.groups) {
        for (const cell of g.cells) {
          const p = this.grid[cell.r]![cell.c];
          if (p) p.pulse = 0.4 + u * 0.8;
        }
      }
      if (u >= 1) {
        this.detonate(a.groups);
        this.anim = { kind: "burst", t: 0, groups: a.groups };
      }
    } else if (a.kind === "burst") {
      a.t += dt * 1000;
      if (a.t >= BURST_MS) {
        this.applyMerges(a.groups);
        this.anim = { kind: "grow", t: 0 };
      }
    } else if (a.kind === "grow") {
      a.t += dt * 1000;
      if (a.t >= GROW_MS) this.startGravity();
    } else if (a.kind === "gravity") {
      a.t += dt * 1000;
      const u = Math.min(1, a.t / GRAVITY_MS);
      const e = u * u;
      for (const m of a.movers) {
        m.piece.y = m.from + (m.to - m.from) * e;
        m.piece.squash = u < 0.85 ? 0 : Math.sin(((u - 0.85) / 0.15) * Math.PI) * 0.2;
      }
      if (u >= 1) {
        for (const m of a.movers) {
          m.piece.row = m.to;
          m.piece.y = m.to;
          m.piece.col = m.piece.col;
        }
        this.beginResolve();
      }
    }

    this.fx.update(dt, this.layout.w, this.layout.h);
  }

  private beginResolve(): void {
    const groups = this.findGroups();
    if (groups.length) {
      this.anim = { kind: "pulse", t: 0, groups };
      return;
    }
    this.combo = 1;
    if (this.isOverflow()) {
      if (this.screen === "title") {
        this.resetBoard();
        this.spawnCurrent();
        this.busy = false;
        this.anim = { kind: "idle" };
        return;
      }
      this.endGame();
      return;
    }
    this.spawnCurrent();
    this.busy = false;
    this.anim = { kind: "idle" };
  }

  private tickDemo(dt: number): void {
    if (!this.current && this.anim.kind === "idle") this.spawnCurrent();
    if (this.busy) return;
    this.demoWait -= dt;
    if (this.demoWait > 0) return;
    this.demoWait = 0.45 + Math.random() * 0.25;
    this.aimCol = this.pickDemoCol();
    this.aimX = this.aimCol;
    if (this.current) this.current.col = this.aimCol;
    this.tryDrop(false);
  }

  private pickDemoCol(): number {
    const color = this.current?.color ?? this.nextColor;
    const tier = this.current?.tier ?? 0;
    for (let c = 0; c < COLS; c++) {
      const top = this.topPiece(c);
      if (top && top.color === color && top.tier === tier) return c;
    }
    const roomy: number[] = [];
    for (let c = 0; c < COLS; c++) {
      if (this.landingRow(c) >= DANGER_ROW + 1) roomy.push(c);
    }
    if (roomy.length) return roomy[Math.floor(Math.random() * roomy.length)]!;
    return Math.floor(Math.random() * COLS);
  }

  private topPiece(col: number): Piece | null {
    for (let r = 0; r < ROWS; r++) {
      const p = this.grid[r]![col];
      if (p) return p;
    }
    return null;
  }

  private flood(
    c: number,
    r: number,
    color: number,
    tier: number,
    seen: Set<string>,
  ): { c: number; r: number }[] {
    const stack = [{ c, r }];
    const out: { c: number; r: number }[] = [];
    while (stack.length) {
      const cur = stack.pop()!;
      const key = `${cur.c}:${cur.r}`;
      if (seen.has(key)) continue;
      const p = this.grid[cur.r]?.[cur.c];
      if (!p || p.color !== color || p.tier !== tier) continue;
      seen.add(key);
      out.push(cur);
      stack.push(
        { c: cur.c + 1, r: cur.r },
        { c: cur.c - 1, r: cur.r },
        { c: cur.c, r: cur.r + 1 },
        { c: cur.c, r: cur.r - 1 },
      );
    }
    return out;
  }

  private findGroups(): Group[] {
    const seen = new Set<string>();
    const groups: Group[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.grid[r]![c];
        if (!p || seen.has(`${c}:${r}`)) continue;
        const cells = this.flood(c, r, p.color, p.tier, seen);
        if (cells.length >= MERGE_MIN) {
          groups.push({ cells, color: p.color, tier: p.tier });
        }
      }
    }
    return groups;
  }

  private detonate(groups: Group[]): void {
    let power = 0;
    for (const g of groups) {
      const cleared = g.tier >= MAX_TIER;
      power += g.cells.length + g.tier * 2;
      for (const cell of g.cells) {
        const pos = this.cellCenter(cell.c, cell.r);
        const hex = COLORS[g.color]!.glow;
        this.fx.burst(pos.x, pos.y, hex, cleared ? 1.8 : 1 + g.tier * 0.25, cleared ? 22 : 14);
      }
      const mid = g.cells[Math.floor(g.cells.length / 2)]!;
      const pos = this.cellCenter(mid.c, mid.r);
      const pts = this.scoreGroup(g);
      this.fx.popup(pos.x, pos.y - 8, `+${pts}`, COLORS[g.color]!.fill, 1 + this.combo * 0.12);
      if (this.combo >= 2) {
        this.fx.popup(pos.x, pos.y + 18, `x${this.combo}`, "#ff6ec7", 1.15);
      }
      if (cleared) this.audio.clear();
      else this.audio.bloom(g.tier, this.combo);
    }
    this.fx.rumble(4 + power * 0.9 + this.combo * 2);
    if (groups.length > 1) {
      const g0 = groups[0]!.cells[0]!;
      const pos = this.cellCenter(g0.c, g0.r);
      this.fx.popup(pos.x, pos.y - 36, "DUAL", "#ffe08a", 1.3);
    }
  }

  private scoreGroup(g: Group): number {
    const base = TIER_SCORE[g.tier]! * g.cells.length;
    const clear = g.tier >= MAX_TIER ? CLEAR_BONUS : 0;
    const pts = (base + clear) * this.combo;
    this.score += pts;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE_BEST, String(this.best));
    }
    return pts;
  }

  private applyMerges(groups: Group[]): void {
    for (const g of groups) {
      const dest = this.pickCell(g.cells);
      for (const cell of g.cells) {
        this.grid[cell.r]![cell.c] = null;
      }
      if (g.tier < MAX_TIER) {
        const grown = this.makePiece(dest.c, dest.r, g.color, g.tier + 1);
        grown.grow = 0.2;
        grown.pulse = 1;
        this.grid[dest.r]![dest.c] = grown;
      }
    }
    this.combo += 1;
  }

  private pickCell(cells: { c: number; r: number }[]): { c: number; r: number } {
    const ac = cells.reduce((s, x) => s + x.c, 0) / cells.length;
    const ar = cells.reduce((s, x) => s + x.r, 0) / cells.length;
    return cells.slice().sort((a, b) => {
      const da = (a.c - ac) ** 2 + (a.r - ar) ** 2;
      const db = (b.c - ac) ** 2 + (b.r - ar) ** 2;
      if (da !== db) return da - db;
      return b.r - a.r;
    })[0]!;
  }

  private startGravity(): void {
    const movers: { piece: Piece; from: number; to: number }[] = [];
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        const p = this.grid[r]![c];
        if (!p) continue;
        if (r !== write) {
          this.grid[r]![c] = null;
          this.grid[write]![c] = p;
          p.col = c;
          movers.push({ piece: p, from: p.y, to: write });
        }
        write -= 1;
      }
    }
    if (!movers.length) {
      this.beginResolve();
      return;
    }
    this.anim = { kind: "gravity", t: 0, movers };
  }

  private isOverflow(): boolean {
    for (let r = 0; r < DANGER_ROW; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r]![c]) return true;
      }
    }
    return false;
  }

  private endGame(): void {
    this.screen = "over";
    this.busy = true;
    this.anim = { kind: "idle" };
    this.current = null;
    this.overNewBest = this.score >= this.best && this.score > 0;
    this.audio.over();
    this.fx.rumble(10);
  }

  pieces(): Piece[] {
    const out: Piece[] = [];
    for (const row of this.grid) {
      for (const p of row) if (p) out.push(p);
    }
    if (this.current) out.push(this.current);
    return out;
  }

  ghostRow(): number | null {
    if (!this.current || this.anim.kind !== "idle" || this.screen !== "play") return null;
    const col = Math.round(this.aimX);
    const row = this.landingRow(col);
    return row < 0 ? null : row;
  }
}
