// Global tuning constants. Units are metres / seconds.

export const TABLE = {
  L: 1.0,          // half length of the playing surface (x axis)
  W: 0.5,          // half width (z axis)
  R: 0.03,         // ball radius
  cornerMouth: 0.138,
  sideMouth: 0.15,
  railWidth: 0.11, // wooden rail width outside the cushion nose
  cushionDepth: 0.045,
  cushionHeight: 0.04,
  railHeight: 0.052,
  headX: -0.5,     // head spot (cue ball)
  footX: 0.5,      // foot spot (rack apex)
};

export const PHYS = {
  g: 9.81,
  muSlide: 0.22,
  muRoll: 0.022,
  muSpin: 0.045,
  cushionRest: 0.8,
  cushionFric: 0.18,
  ballRest: 0.95,
  maxShotSpeed: 8.2,
  minShotSpeed: 0.25,
  stopSpeed: 0.012,
};

// Classic ball colours 1–15 (9–15 are stripes of 1–7).
export const BALL_COLORS = [
  '#f2f0e6', // 0 cue
  '#f6c21c', // 1 yellow
  '#1d4fd6', // 2 blue
  '#e0262a', // 3 red
  '#6a2fa8', // 4 purple
  '#ff7418', // 5 orange
  '#139a4a', // 6 green
  '#8e1e22', // 7 maroon
  '#121216', // 8 black
];

export function ballColor(num) {
  if (num >= 9) return BALL_COLORS[num - 8];
  return BALL_COLORS[num] ?? BALL_COLORS[0];
}

export const RENDER = {
  targetHeight: 240,
};
