import "./style.css";
import { COLS } from "./config";
import { Game } from "./game";
import { draw, layoutWell } from "./render";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
const app = document.querySelector<HTMLElement>("#app")!;
const scoreEl = document.querySelector<HTMLElement>("#score")!;
const bestEl = document.querySelector<HTMLElement>("#best")!;
const hintEl = document.querySelector<HTMLElement>("#hint")!;
const titleEl = document.querySelector<HTMLElement>("#title")!;
const overEl = document.querySelector<HTMLElement>("#over")!;
const finalEl = document.querySelector<HTMLElement>("#final-score")!;
const newBestEl = document.querySelector<HTMLElement>("#new-best")!;
const playBtn = document.querySelector<HTMLButtonElement>("#play")!;
const againBtn = document.querySelector<HTMLButtonElement>("#again")!;

const game = new Game();
bestEl.textContent = String(game.best);
(window as unknown as { __bloom: Game }).__bloom = game;

let width = 0;
let height = 0;

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const L = layoutWell(width, height);
  game.setLayout(L.x, L.y, L.cell, L.w, L.h);
  game.fx.seedAmbient(width, height);
}

resize();
window.addEventListener("resize", resize);

function syncDom(): void {
  app.dataset.state = game.screen;
  app.classList.toggle("hint-on", game.hint && game.screen === "play");
  scoreEl.textContent = String(game.score);
  bestEl.textContent = String(game.best);
  titleEl.classList.toggle("hidden", game.screen !== "title");
  overEl.classList.toggle("hidden", game.screen !== "over");
  if (game.screen === "over") {
    finalEl.textContent = String(game.score);
    newBestEl.classList.toggle("hidden", !game.overNewBest);
  }
  hintEl.textContent = "Move · Drop";
}

playBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  game.start();
  syncDom();
});

againBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  game.restart();
  syncDom();
});

const keys = new Set<string>();
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code) || e.key === " ") {
    e.preventDefault();
  }
  if (keys.has(e.code)) return;
  keys.add(e.code);
  if (e.code === "ArrowLeft" || e.code === "KeyA") game.nudge(-1);
  if (e.code === "ArrowRight" || e.code === "KeyD") game.nudge(1);
  if (e.code === "Space" || e.code === "Enter") game.drop();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

let holding = false;
let holdMoved = false;

function aimFromEvent(e: PointerEvent): void {
  game.aimAt(game.pointerToCol(e.clientX));
}

canvas.addEventListener("pointerdown", (e) => {
  if ((e.target as HTMLElement).closest("button")) return;
  game.audio.unlock();
  holding = true;
  holdMoved = false;
  aimFromEvent(e);
});

canvas.addEventListener("pointermove", (e) => {
  if (!holding && e.pointerType === "mouse") {
    game.aimAt(game.pointerToCol(e.clientX));
    return;
  }
  if (!holding) return;
  const prev = Math.round(game.aimX);
  aimFromEvent(e);
  if (Math.round(game.aimX) !== prev) holdMoved = true;
});

window.addEventListener("pointerup", (e) => {
  if (!holding) return;
  holding = false;
  if ((e.target as HTMLElement).closest("button")) return;
  if (e.pointerType === "mouse" || !holdMoved) game.drop();
});

canvas.addEventListener("pointercancel", () => {
  holding = false;
});

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.034, (now - last) / 1000);
  last = now;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) {
    /* nudge is edge-triggered; hold slides aim */
    game.aimCol = Math.max(0, game.aimCol - dt * 7);
  }
  if (keys.has("ArrowRight") || keys.has("KeyD")) {
    game.aimCol = Math.min(COLS - 1, game.aimCol + dt * 7);
  }
  game.update(dt);
  draw(ctx, game);
  syncDom();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
