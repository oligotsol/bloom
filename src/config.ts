export const COLS = 6;
export const ROWS = 12;
/** Settled pieces on or above this row lose after cascades resolve. */
export const DANGER_ROW = 1;

export const MAX_TIER = 3;
export const MERGE_MIN = 3;

export const COLORS = [
  { name: "mint", fill: "#6ef0c4", deep: "#2bb88a", glow: "#9cffdf", ink: "#10382c" },
  { name: "coral", fill: "#ff8b74", deep: "#e85a4a", glow: "#ffc4b4", ink: "#4a1812" },
  { name: "lilac", fill: "#c4a6ff", deep: "#8b6adf", glow: "#e6d6ff", ink: "#2a1848" },
  { name: "butter", fill: "#ffe08a", deep: "#e0b23a", glow: "#fff3c4", ink: "#3a2c08" },
] as const;

export const PINK = { fill: "#ff6ec7", deep: "#d4459a", glow: "#ffb3e4" };

export const TIER_SIZE = [0.8, 0.88, 0.94, 0.99];
export const TIER_SCORE = [40, 110, 280, 720];
export const CLEAR_BONUS = 2400;

export const STORAGE_BEST = "bloom-best";

export const FALL_MS = 420;
export const PULSE_MS = 200;
export const BURST_MS = 320;
export const GROW_MS = 240;
export const GRAVITY_MS = 280;
export const LAND_MS = 180;
