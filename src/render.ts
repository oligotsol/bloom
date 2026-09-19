import { COLORS, COLS, DANGER_ROW, PINK, ROWS, TIER_SIZE } from "./config";
import type { Game, Piece } from "./game";
import type { Particle } from "./fx";

export function layoutWell(w: number, h: number) {
  const top = Math.min(92, h * 0.12);
  const bottom = Math.min(36, h * 0.06);
  const maxH = h - top - bottom;
  const maxW = Math.min(w * 0.88, 460);
  const cell = Math.max(28, Math.min(maxW / COLS, maxH / (ROWS + 1.35)));
  const wellW = cell * COLS;
  const wellH = cell * ROWS;
  const x = (w - wellW) / 2;
  const y = top + (h - top - bottom - wellH - cell * 0.15) * 0.42;
  return { x, y, cell, w, h, wellW, wellH };
}

export function draw(ctx: CanvasRenderingContext2D, game: Game): void {
  const { w, h, x, y, cell, wellW, wellH } = game.well as {
    w: number;
    h: number;
    x: number;
    y: number;
    cell: number;
  } & { wellW?: number; wellH?: number };
  const ww = wellW ?? cell * COLS;
  const wh = wellH ?? cell * ROWS;
  const shake = game.fx.offsets();

  ctx.clearRect(0, 0, w, h);
  drawBackdrop(ctx, w, h, game);
  drawAmbient(ctx, game);

  ctx.save();
  ctx.translate(shake.x, shake.y);

  drawWell(ctx, x, y, ww, wh, cell, game);
  drawGhost(ctx, game, x, y, cell);
  drawPieces(ctx, game, x, y, cell);
  if (game.current && game.screen === "play") {
    drawNext(ctx, game, x, y, cell);
  }
  drawParticles(ctx, game.fx.particles);
  drawFloaters(ctx, game);

  ctx.restore();

  if (game.fx.flash > 0.01) {
    ctx.fillStyle = `rgba(255, 214, 240, ${game.fx.flash * 0.45})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, game: Game): void {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.38, 20, w * 0.5, h * 0.4, Math.max(w, h) * 0.7);
  const pulse = game.fx.pulse;
  g.addColorStop(0, mix("#2a1f42", "#4a2a58", pulse * 0.6));
  g.addColorStop(0.55, "#161222");
  g.addColorStop(1, "#0c0a12");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const g2 = ctx.createRadialGradient(w * 0.22, h * 0.18, 0, w * 0.22, h * 0.18, w * 0.45);
  g2.addColorStop(0, "rgba(110, 240, 196, 0.07)");
  g2.addColorStop(1, "rgba(110, 240, 196, 0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);

  const g3 = ctx.createRadialGradient(w * 0.82, h * 0.72, 0, w * 0.82, h * 0.72, w * 0.4);
  g3.addColorStop(0, "rgba(255, 110, 199, 0.06)");
  g3.addColorStop(1, "rgba(255, 110, 199, 0)");
  ctx.fillStyle = g3;
  ctx.fillRect(0, 0, w, h);
}

function drawAmbient(ctx: CanvasRenderingContext2D, game: Game): void {
  for (const p of game.fx.backdrop) {
    drawPetal(ctx, p, 0.18);
  }
}

function drawWell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ww: number,
  wh: number,
  cell: number,
  game: Game,
): void {
  const r = Math.min(28, cell * 0.45);
  ctx.save();
  ctx.shadowColor = "rgba(196, 166, 255, 0.28)";
  ctx.shadowBlur = 34;
  roundRect(ctx, x - 8, y - 8, ww + 16, wh + 16, r + 8);
  ctx.fillStyle = "rgba(18, 14, 28, 0.88)";
  ctx.fill();
  ctx.restore();

  const inner = ctx.createLinearGradient(x, y, x, y + wh);
  inner.addColorStop(0, "rgba(42, 32, 62, 0.92)");
  inner.addColorStop(0.5, "rgba(22, 18, 34, 0.96)");
  inner.addColorStop(1, "rgba(14, 12, 22, 0.98)");
  roundRect(ctx, x, y, ww, wh, r);
  ctx.fillStyle = inner;
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 230, 255, 0.1)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, ww, wh, r);
  ctx.clip();

  for (let c = 0; c < COLS; c++) {
    if (c % 2 === 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
      ctx.fillRect(x + c * cell, y, cell, wh);
    }
  }

  const dangerY = y + DANGER_ROW * cell;
  ctx.fillStyle = "rgba(255, 110, 199, 0.045)";
  ctx.fillRect(x, y, ww, DANGER_ROW * cell);

  ctx.save();
  ctx.setLineDash([5, 7]);
  ctx.strokeStyle = "rgba(255, 176, 220, 0.55)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x + 10, dangerY);
  ctx.lineTo(x + ww - 10, dangerY);
  ctx.stroke();
  ctx.restore();

  if (game.screen === "play" && game.anim.kind === "idle" && game.current) {
    const col = Math.round(game.aimX);
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.fillRect(x + col * cell, y, cell, wh);
  }

  ctx.restore();
}

function drawGhost(ctx: CanvasRenderingContext2D, game: Game, x: number, y: number, cell: number): void {
  const row = game.ghostRow();
  if (row === null || !game.current) return;
  const col = Math.round(game.aimX);
  const piece = { ...game.current, col, row, y: row, squash: 0, pulse: 0, grow: 1 };
  ctx.globalAlpha = 0.22;
  drawCandy(ctx, piece, x, y, cell, true);
  ctx.globalAlpha = 1;
}

function drawNext(ctx: CanvasRenderingContext2D, game: Game, x: number, y: number, cell: number): void {
  const side = game.aimX < COLS - 1.15 ? 0.82 : -0.82;
  const dummy: Piece = {
    id: -1,
    col: game.aimX + side,
    row: -1.28,
    color: game.nextColor,
    tier: game.nextTier,
    y: -1.28,
    squash: 0,
    grow: 0.42,
    pulse: 0,
  };
  ctx.save();
  ctx.globalAlpha = 0.42;
  drawCandy(ctx, dummy, x, y, cell, true);
  ctx.restore();
}

function drawPieces(ctx: CanvasRenderingContext2D, game: Game, x: number, y: number, cell: number): void {
  const bursting = game.anim.kind === "burst" ? new Set(game.anim.groups.flatMap((g) => g.cells.map((c) => `${c.c}:${c.r}`))) : null;
  const pulsing = game.anim.kind === "pulse" ? game.anim.t / 200 : 0;

  const list = game.pieces().slice().sort((a, b) => a.y - b.y || a.col - b.col);
  for (const p of list) {
    const key = `${p.col}:${p.row}`;
    const vanish = bursting?.has(key);
    ctx.save();
    if (vanish) {
      const t = Math.min(1, game.anim.kind === "burst" ? game.anim.t / 280 : 1);
      ctx.globalAlpha = 1 - t;
      p.grow = 1 + t * 0.35;
    } else if (pulsing && p.pulse > 0) {
      p.grow = 1 + Math.sin(pulsing * Math.PI) * 0.08;
    }
    drawCandy(ctx, p, x, y, cell, false);
    ctx.restore();
  }
}

function drawCandy(
  ctx: CanvasRenderingContext2D,
  p: Piece,
  x: number,
  y: number,
  cell: number,
  ghost: boolean,
): void {
  const pal = COLORS[p.color] ?? COLORS[0];
  const size = cell * TIER_SIZE[p.tier]! * (0.86 + p.grow * 0.14);
  const cx = x + (p.col + 0.5) * cell;
  const cy = y + (p.y + 0.5) * cell;
  const sx = 1 + p.squash * 0.55;
  const sy = 1 - p.squash * 0.62;
  const pulse = 1 + p.pulse * 0.06;
  const w = size * sx * pulse;
  const h = size * sy * pulse;
  const rad = Math.min(w, h) * (0.3 + p.tier * 0.02);

  ctx.save();
  ctx.translate(cx, cy);

  if (!ghost) {
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 22 + p.tier * 10 + p.pulse * 18;
  }

  const grd = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  grd.addColorStop(0, "#fff8ef");
  grd.addColorStop(0.16, pal.fill);
  grd.addColorStop(0.72, pal.fill);
  grd.addColorStop(1, pal.deep);
  roundRect(ctx, -w / 2, -h / 2, w, h, rad);
  ctx.fillStyle = grd;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  roundRect(ctx, -w * 0.32, -h * 0.38, w * 0.42, h * 0.22, rad * 0.5);
  ctx.fill();

  if (p.tier >= 2) {
    ctx.strokeStyle = `${pal.glow}aa`;
    ctx.lineWidth = 2;
    roundRect(ctx, -w * 0.58, -h * 0.58, w * 1.16, h * 1.16, rad * 1.15);
    ctx.stroke();
  }
  if (p.tier >= MAX_VISIBLE_SHIMMER) {
    ctx.strokeStyle = PINK.glow;
    ctx.globalAlpha = 0.45 + Math.sin(performance.now() / 240) * 0.15;
    ctx.lineWidth = 1.4;
    roundRect(ctx, -w * 0.68, -h * 0.68, w * 1.36, h * 1.36, rad * 1.3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

const MAX_VISIBLE_SHIMMER = 3;

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const t = p.life / (p.max || 1);
    if (p.kind === "petal") drawPetal(ctx, p, 0.35 + t * 0.65);
    else if (p.kind === "spark") {
      ctx.fillStyle = `rgba(255, 246, 232, ${Math.max(0, t)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "ring") {
      const u = 1 - t;
      ctx.strokeStyle = hexAlpha(p.color, 0.55 * t);
      ctx.lineWidth = 3 * t;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size + u * 46, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === "puff") {
      const u = 1 - t;
      const rad = p.size + u * 28;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      g.addColorStop(0, hexAlpha(p.color, 0.35 * t));
      g.addColorStop(1, hexAlpha(p.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha * (p.life < 1 ? p.life / (p.max || 1) : 1)));
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-p.size * 0.1, -p.size * 0.2, p.size * 0.22, p.size * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFloaters(ctx: CanvasRenderingContext2D, game: Game): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of game.fx.floaters) {
    const t = f.life / f.max;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.4);
    ctx.font = `700 ${Math.round(16 * f.scale + 4)}px Fredoka, Nunito, system-ui, sans-serif`;
    ctx.fillStyle = "#1a1224";
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 12;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function hexAlpha(hex: string, a: number): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const m = (i: number) => Math.round(pa[i]! + (pb[i]! - pa[i]!) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
