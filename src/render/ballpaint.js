// One painter for every ball set, in both games. The readability rules live
// here, not in each set, so no set can break them:
//   · the cue ball is always predominantly white and marked unlike any other
//   · the 8 is always dark with a light disc and a clear 8
//   · solids are one colour all over; stripes are a light ball with a broad band
//   · every number sits in a light disc, the same place on every set
// A set only chooses colours, a cue-ball mark, an optional static decoration,
// and the shader effect that animates its coloured areas (see materials.js).
//
// Texture layout: equirectangular, u around the equator, v top → bottom.
// The number discs sit at u = 0.25 / 0.75 on the equator; stripe bands span
// v 0.27–0.73. materials.js masks its effects with the same numbers.

import { canvas, toTex } from './textures.js';

export const DISC = { u: [0.25, 0.75], rx: 0.078, ry: 0.156 };
export const BAND = [0.27, 0.73];

export const CLASSIC_HUES = ['#f6c21c', '#1d4fd6', '#e0262a', '#6a2fa8', '#ff7418', '#139a4a', '#8e1e22'];

export function hueFor(set, num) {
  if (num === 0) return set.pal.cue || '#f4f1e6';
  if (num === 8) return set.pal.eight || '#121216';
  const hues = set.pal.hues || CLASSIC_HUES;
  return hues[((num >= 9 ? num - 8 : num) - 1) % 7];
}

// res: 'pixel' (PS1 128x64), 'modern' (512x256), 'classic' (1024x512)
const RES = {
  pixel: { W: 128, H: 64, k: 1, font: (n) => `bold ${n > 9 ? 11 : 13}px "Press Start 2P", monospace`, dy: 1 },
  modern: { W: 128, H: 64, k: 4, font: (n) => `700 ${n > 9 ? 13 : 15}px "Chakra Petch", Arial, sans-serif`, dy: 1 },
  classic: { W: 128, H: 64, k: 8, font: (n) => `700 ${n > 9 ? 7.8 : 8.8}px Inter, "Helvetica Neue", Arial, sans-serif`, dy: 0.45 },
};

export function paintBall(num, set, res = 'pixel') {
  const R = RES[res] || RES.pixel;
  const { W, H, k } = R;
  const c = canvas(W * k, H * k), x = c.getContext('2d');
  x.scale(k, k);
  const P = set.pal;
  const light = P.stripe || '#f4efe4';
  const hue = hueFor(set, num);
  const stripe = num >= 9 && num <= 15;
  if (num === 0) {
    x.fillStyle = P.cue || '#f4f1e6'; x.fillRect(0, 0, W, H);
    cueMark(x, W, H, set.cueMark || 'dot', P.mark || '#d02020', res);
  } else if (stripe) {
    x.fillStyle = light; x.fillRect(0, 0, W, H);
    x.fillStyle = hue; x.fillRect(0, H * BAND[0], W, H * (BAND[1] - BAND[0]));
  } else {
    x.fillStyle = hue; x.fillRect(0, 0, W, H);
  }
  if (num > 0) set.decor?.(x, W, H, num, hue, stripe);
  if (num === 0) set.cueDecor?.(x, W, H);
  if (num > 0) {
    for (const u of DISC.u) {
      const cx = u * W, cy = H / 2;
      x.fillStyle = P.disc || light;
      x.beginPath(); x.ellipse(cx, cy, DISC.rx * W, DISC.ry * H * 0.93, 0, 0, 7); x.fill();
      if (set.discRing) { x.strokeStyle = set.discRing; x.lineWidth = res === 'pixel' ? 1 : 0.6; x.beginPath(); x.ellipse(cx, cy, DISC.rx * W + 0.6, DISC.ry * H * 0.93 + 0.6, 0, 0, 7); x.stroke(); }
      x.fillStyle = num === 8 ? (P.ink8 || P.ink || '#111') : (P.ink || '#111');
      x.font = R.font(num);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(num), cx + 0.3, cy + R.dy);
      // the underline that tells a 6 from a 9
      if ((num === 6 || num === 9) && res !== 'pixel') x.fillRect(cx - 2.2, cy + 5.4, 4.4, 0.8);
    }
  }
  const t = toTex(c, { wrap: false });
  if (res === 'classic') t.anisotropy = 8;
  return t;
}

// what makes the cue ball the cue ball in each set (never a colour wash)
function cueMark(x, W, H, kind, col, res) {
  const dot = (u, v, r) => { x.beginPath(); x.ellipse(u * W, v * H, r, r * (res === 'pixel' ? 1 : 0.95), 0, 0, 7); x.fill(); };
  x.fillStyle = col; x.strokeStyle = col;
  if (kind === 'dot') { for (const u of [0.25, 0.75]) dot(u, 0.5, 3); }
  else if (kind === 'measle') {
    for (const u of [0.125, 0.375, 0.625, 0.875]) dot(u, 0.5, 1.9);
    for (const v of [0.14, 0.86]) for (const u of [0.25, 0.75]) { x.beginPath(); x.ellipse(u * W, v * H, 1.9 / Math.sin(v * Math.PI), 1.9, 0, 0, 7); x.fill(); }
  } else if (kind === 'ring') {
    x.lineWidth = res === 'pixel' ? 2 : 1.4;
    x.fillRect(0, H * 0.18, W, res === 'pixel' ? 2 : 1.2); x.fillRect(0, H * 0.82 - 1, W, res === 'pixel' ? 2 : 1.2);
  } else if (kind === 'core') {
    for (const u of [0.25, 0.75]) { const g = x.createRadialGradient(u * W, H / 2, 0, u * W, H / 2, 6); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(u * W - 7, H / 2 - 7, 14, 14); }
  } else if (kind === 'grid') {
    x.globalAlpha = 0.45;
    for (let u = 0; u < W; u += 8) x.fillRect(u, 0, 1, H);
    for (let v = 0; v < H; v += 8) x.fillRect(0, v, W, 1);
    x.globalAlpha = 1;
    for (const u of [0.25, 0.75]) dot(u, 0.5, 2.5);
  } else if (kind === 'eye') {
    for (const u of [0.25, 0.75]) { x.fillRect(u * W - 4, H / 2 - 1.5, 8, 3); }
  }
}

// the little flat preview used by cards and swatches (cue, 1, 8, 9, 15)
export function ballSwatch(set, nums = [0, 1, 8, 9, 15], size = 16) {
  const c = canvas(size * nums.length + (nums.length - 1) * 2, size), x = c.getContext('2d');
  nums.forEach((n, i) => {
    const cx = i * (size + 2) + size / 2, cy = size / 2, r = size / 2 - 1;
    x.save();
    x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip();
    const hue = hueFor(set, n);
    x.fillStyle = n >= 9 ? (set.pal.stripe || '#f4efe4') : hue; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (n >= 9) { x.fillStyle = hue; x.fillRect(cx - r, cy - r * 0.5, r * 2, r); }
    if (n === 0) { x.fillStyle = set.pal.mark || '#d02020'; x.fillRect(cx - 1, cy - 1, 2, 2); }
    else { x.fillStyle = set.pal.disc || set.pal.stripe || '#f4efe4'; x.beginPath(); x.arc(cx, cy, r * 0.42, 0, 7); x.fill(); }
    const g = x.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 0, cx, cy, r * 1.2);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    x.restore();
    x.strokeStyle = '#000'; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
  });
  return c;
}
