// Procedural low-res textures drawn on canvases. Everything is nearest-filtered
// and deliberately small so it reads as authentic 1998 texture memory.

import * as THREE from 'three';
import { ballColor } from '../config.js';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Same coordinates, 4x the pixels in modern mode (for vector-ish art: signs, posters...)
function hcanvas(w, h) {
  const k = hiRes ? 4 : 1;
  const c = canvas(w * k, h * k);
  const x = c.getContext('2d');
  x.scale(k, k);
  return [c, x];
}

// All generated textures are tracked so the graphics style can switch between
// crunchy nearest-neighbour (PS1) and smooth mipmapped sampling (MODERN).
const texRegistry = new Set();
let smooth = false;
export let hiRes = false;          // modern mode draws some textures at 2x

function applyFilter(t) {
  const lin = smooth || t.userData.alwaysLinear;
  t.magFilter = lin ? THREE.LinearFilter : THREE.NearestFilter;
  t.minFilter = smooth ? THREE.LinearMipmapLinearFilter : (t.userData.alwaysLinear ? THREE.LinearFilter : THREE.NearestFilter);
  t.generateMipmaps = smooth;
  t.anisotropy = smooth ? 8 : 1;
}

export function setTextureMode(modern) {
  smooth = modern; hiRes = modern;
  for (const t of texRegistry) { applyFilter(t); t.needsUpdate = true; }
}

export function toTex(c, { repeat = [1, 1], wrap = true, linear = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.userData.alwaysLinear = linear;
  applyFilter(t);
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.NoColorSpace;
  texRegistry.add(t);
  t.addEventListener('dispose', () => texRegistry.delete(t));
  return t;
}

// deterministic rng for stable textures
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h) => '#' + new THREE.Color(h).getHexString();
function shade(col, k) {
  const c = new THREE.Color(col);
  c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
  return '#' + c.getHexString();
}

function noiseFill(ctx, w, h, base, amt, seed, px = 1, x0 = 0, y0 = 0) {
  const r = rng(seed);
  const c = new THREE.Color(base);
  for (let y = y0; y < y0 + h; y += px) for (let x = x0; x < x0 + w; x += px) {
    const n = 1 + (r() - 0.5) * amt;
    ctx.fillStyle = `rgb(${Math.min(255, c.r * 255 * n) | 0},${Math.min(255, c.g * 255 * n) | 0},${Math.min(255, c.b * 255 * n) | 0})`;
    ctx.fillRect(x, y, px, px);
  }
}

export function feltTexture(color = '#1b7a45', seed = 3) {
  if (hiRes) {
    // fine cloth for modern mode: low-amplitude fibre noise + weave
    const S = 256, c = canvas(S, S), x = c.getContext('2d');
    noiseFill(x, S, S, color, 0.06, seed);
    // soft mottling so large areas read as cloth, not flat plastic
    const r = rng(seed + 9);
    for (let i = 0; i < 40; i++) {
      const g = x.createRadialGradient(r() * S, r() * S, 0, r() * S, r() * S, 20 + r() * 40);
      g.addColorStop(0, r() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.035)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
    }
    return toTex(c, { repeat: [6, 3] });
  }
  const c = canvas(64, 64), x = c.getContext('2d');
  noiseFill(x, 64, 64, color, 0.16, seed);
  // faint weave
  x.globalAlpha = 0.06;
  x.fillStyle = '#000';
  for (let i = 0; i < 64; i += 2) x.fillRect(0, i, 64, 1);
  x.globalAlpha = 1;
  return toTex(c, { repeat: [6, 3] });
}

export function woodTexture(base = '#5a2c14', dark = '#2a1208', seed = 7) {
  const c = canvas(64, 128), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 64, 128);
  const r = rng(seed);
  for (let i = 0; i < 40; i++) {
    const px = r() * 64;
    x.strokeStyle = r() > 0.5 ? dark : shade(base, 1.25);
    x.globalAlpha = 0.25 + r() * 0.35;
    x.lineWidth = 1 + (r() * 2 | 0);
    x.beginPath();
    x.moveTo(px, 0);
    for (let y = 0; y <= 128; y += 8) x.lineTo(px + Math.sin(y * 0.08 + i) * 3 * r(), y);
    x.stroke();
  }
  x.globalAlpha = 1;
  // knots
  for (let i = 0; i < 3; i++) {
    x.fillStyle = dark;
    x.beginPath();
    x.ellipse(r() * 64, r() * 128, 2 + r() * 2, 4 + r() * 4, 0, 0, 7);
    x.fill();
  }
  return toTex(c);
}

export function carpetTexture(theme) {
  const [c, x] = hcanvas(64, 64);
  const p = theme.carpet;
  x.fillStyle = p[0]; x.fillRect(0, 0, 64, 64);
  const r = rng(theme.seed || 11);
  // 90s bowling-alley carpet: squiggles, triangles, dots
  for (let i = 0; i < 16; i++) {
    x.strokeStyle = p[1 + (i % (p.length - 1))];
    x.lineWidth = 2;
    const cx = r() * 64, cy = r() * 64;
    x.beginPath();
    for (let k = 0; k < 6; k++) x.lineTo(cx + k * 3, cy + Math.sin(k * 1.4) * 4);
    x.stroke();
  }
  for (let i = 0; i < 10; i++) {
    x.fillStyle = p[1 + ((i + 1) % (p.length - 1))];
    const cx = r() * 64, cy = r() * 64, s = 3 + r() * 4;
    x.beginPath(); x.moveTo(cx, cy - s); x.lineTo(cx + s, cy + s); x.lineTo(cx - s, cy + s); x.fill();
  }
  for (let i = 0; i < 14; i++) {
    x.fillStyle = p[1 + ((i + 2) % (p.length - 1))];
    x.fillRect(r() * 64 | 0, r() * 64 | 0, 2, 2);
  }
  // grime
  const d = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = 0.8 + r() * 0.3;
    d.data[i] *= n; d.data[i + 1] *= n; d.data[i + 2] *= n;
  }
  x.putImageData(d, 0, 0);
  return toTex(c, { repeat: [7, 7] });
}

export function wallTexture(theme) {
  const c = canvas(64, 64), x = c.getContext('2d');
  const [a, b, trim] = theme.wall;
  // upper: patterned wallpaper, lower: wood panelling
  noiseFill(x, 64, 40, a, 0.1, 5, 2);
  x.fillStyle = b;
  for (let yy = 4; yy < 40; yy += 10) for (let xx = (Math.floor(yy / 10) % 2) * 8; xx < 64; xx += 16) {
    x.fillRect(xx + 3, yy, 2, 6); x.fillRect(xx + 1, yy + 2, 6, 2);
  }
  noiseFill(x, 64, 21, shade(trim, 0.6), 0.2, 9, 1, 0, 43);
  x.fillStyle = trim; x.fillRect(0, 40, 64, 3);
  x.fillStyle = 'rgba(0,0,0,0.35)';
  for (let xx = 0; xx < 64; xx += 16) x.fillRect(xx, 43, 1, 21);
  return toTex(c, { repeat: [8, 1] });
}

export function ceilingTexture() {
  const c = canvas(32, 32), x = c.getContext('2d');
  noiseFill(x, 32, 32, '#1a1a22', 0.25, 13, 2);
  x.fillStyle = '#0a0a0e';
  x.fillRect(0, 0, 32, 1); x.fillRect(0, 0, 1, 32);
  return toTex(c, { repeat: [10, 10] });
}

// Pool ball texture: equirectangular 64x32 (u around, v top→bottom).
export function ballTexture(num, skin) {
  const W = 128, H = 64;
  const k = hiRes ? 4 : 1;
  const c = canvas(W * k, H * k), x = c.getContext('2d');
  x.scale(k, k);
  const col = skin.color ? skin.color(num) : ballColor(num);
  const white = skin.white || '#f4efe0';
  const stripe = num >= 9 && num <= 15;
  if (num === 0) {
    x.fillStyle = skin.cue || white; x.fillRect(0, 0, W, H);
    if (skin.cueDot !== false) {
      x.fillStyle = skin.cueDot || '#d02020';
      for (const u of [0.25, 0.75]) { x.beginPath(); x.arc(u * W, H / 2, 3, 0, 7); x.fill(); }
    }
  } else if (stripe) {
    x.fillStyle = white; x.fillRect(0, 0, W, H);
    x.fillStyle = col; x.fillRect(0, H * 0.28, W, H * 0.44);
  } else {
    x.fillStyle = col; x.fillRect(0, 0, W, H);
  }
  if (skin.pattern) skin.pattern(x, W, H, num, col);
  if (num > 0 && skin.numbers !== false) {
    for (const u of [0.25, 0.75]) {
      const cx = u * W, cy = H / 2;
      x.fillStyle = skin.numBg || white;
      x.beginPath(); x.ellipse(cx, cy, 11, 10, 0, 0, 7); x.fill();
      x.fillStyle = skin.numFg || '#111';
      x.font = hiRes ? `700 ${num > 9 ? 13 : 15}px "Chakra Petch", Arial, sans-serif` : `bold ${num > 9 ? 11 : 13}px "Press Start 2P", monospace`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(num), cx + 0.5, cy + 1);
    }
  }
  if (skin.post) {
    // post passes read pixels, so run them on an unscaled copy
    if (k > 1) {
      const lo = canvas(W, H), lx = lo.getContext('2d');
      lx.drawImage(c, 0, 0, W, H);
      skin.post(lx, W, H, num, col);
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.imageSmoothingEnabled = false;
      x.drawImage(lo, 0, 0, W * k, H * k);
    } else skin.post(x, W, H, num, col);
  }
  return toTex(c, { wrap: false });
}

export function neonTextTexture(text, color = '#ff2bd6', { w = 128, h = 32, font = 'bold 18px "Dela Gothic One", sans-serif', glow = 6 } = {}) {
  const [c, x] = hcanvas(w, h);
  if (hiRes) glow *= 4;
  x.clearRect(0, 0, w, h);
  x.font = font;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = color; x.shadowBlur = glow;
  x.fillStyle = color;
  x.fillText(text, w / 2, h / 2 + 1);
  x.shadowBlur = 0;
  x.fillStyle = '#ffffff';
  x.globalAlpha = 0.85;
  x.fillText(text, w / 2, h / 2 + 1);
  x.globalAlpha = 1;
  return toTex(c, { wrap: false });
}

const POSTERS = [
  { t: 'NINE BALL\nNIGHTS', s: '毎週金曜', bg: ['#ff3b6b', '#2a0a3a'], fg: '#ffe95a' },
  { t: 'NO\nSCRATCHING', s: 'HOUSE RULES', bg: ['#1fe0ff', '#0a1840'], fg: '#ffffff' },
  { t: 'TOURNEY\n1998', s: '¥500 ENTRY', bg: ['#ffb400', '#401a00'], fg: '#1a0a00' },
  { t: 'CUE\nMASTER', s: 'VOL.2', bg: ['#7cff5a', '#08300a'], fg: '#08300a' },
  { t: 'EIGHT\nIS LAST', s: 'ハスラー', bg: ['#b36bff', '#1a0540'], fg: '#ffffff' },
  { t: 'CHALK\nUP!', s: 'ZERO CRASH', bg: ['#ff6a1f', '#3a0a00'], fg: '#fff2c0' },
  { t: 'HOUSE\nCHAMPION', s: 'YOU. APPARENTLY', bg: ['#ffd040', '#402a00'], fg: '#1a0c00' },
];

export function posterTexture(i) {
  const p = POSTERS[i % POSTERS.length];
  const [c, x] = hcanvas(48, 64);
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, p.bg[0]); g.addColorStop(1, p.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, 48, 64);
  // big ball graphic
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.beginPath(); x.arc(34, 46, 14, 0, 7); x.fill();
  x.fillStyle = p.fg;
  x.beginPath(); x.arc(32, 44, 13, 0, 7); x.fill();
  x.fillStyle = p.bg[1];
  x.beginPath(); x.arc(32, 44, 6, 0, 7); x.fill();
  x.fillStyle = p.fg;
  x.font = 'bold 7px "Press Start 2P", monospace';
  x.textAlign = 'center';
  x.fillText(i % 2 ? '9' : '8', 32, 47);
  x.font = 'bold 8px "Dela Gothic One", sans-serif';
  x.textAlign = 'left';
  p.t.split('\n').forEach((line, k) => x.fillText(line, 3, 11 + k * 9));
  x.font = '5px "Press Start 2P", monospace';
  x.fillText(p.s, 3, 60);
  // wear
  const r = rng(i * 17 + 3);
  x.fillStyle = 'rgba(255,255,255,0.12)';
  for (let k = 0; k < 30; k++) x.fillRect(r() * 48 | 0, r() * 64 | 0, 1, 1 + (r() * 3 | 0));
  return toTex(c, { wrap: false });
}

// Tiny equirect environment for pixelated ball reflections.
export function envTexture(theme) {
  const W = 64, H = 32;
  const c = canvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, theme.env[0]);
  g.addColorStop(0.5, theme.env[1]);
  g.addColorStop(0.55, theme.env[2]);
  g.addColorStop(1, '#000000');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // overhead lamps
  x.fillStyle = '#fff4d8';
  for (let i = 0; i < 4; i++) x.fillRect(i * 16 + 6, 2, 4, 2);
  x.fillStyle = theme.lamp;
  x.fillRect(0, 0, W, 1);
  // neon streaks on the horizon
  theme.neon.forEach((n, i) => {
    x.fillStyle = n;
    x.fillRect((i * 23 + 5) % W, 12 + (i % 3), 6 + i * 2, 1);
  });
  // felt below
  x.fillStyle = theme.felt;
  x.globalAlpha = 0.5;
  x.fillRect(0, 20, W, 12);
  x.globalAlpha = 1;
  return toTex(c, { wrap: false });
}

export function cityTexture(theme, seed = 21) {
  const c = canvas(128, 64), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, theme.sky[0]); g.addColorStop(1, theme.sky[1]);
  x.fillStyle = g; x.fillRect(0, 0, 128, 64);
  const r = rng(seed);
  if (theme.id === 'aquarium') {
    // water caustic bands + kelp
    for (let i = 0; i < 12; i++) {
      x.fillStyle = `rgba(80,220,255,${0.05 + r() * 0.08})`;
      x.fillRect(0, r() * 64, 128, 1 + r() * 2);
    }
    x.fillStyle = '#021a22';
    for (let i = 0; i < 9; i++) {
      const bx = r() * 128;
      for (let y = 64; y > 20 + r() * 20; y -= 2) x.fillRect(bx + Math.sin(y * 0.3) * 2, y, 2, 2);
    }
    return toTex(c, { wrap: false });
  }
  if (theme.id === 'hell') {
    for (let i = 0; i < 30; i++) {
      x.fillStyle = `rgba(255,${80 + r() * 100 | 0},20,${0.2 + r() * 0.4})`;
      const bx = r() * 128;
      x.fillRect(bx, 40 + r() * 24, 2 + r() * 4, 64);
    }
  }
  // RAJIS locations: what is outside the command room today
  if (theme.view === 'pines') {
    for (let i = 0; i < 26; i++) {
      const tx = r() * 128, th = 10 + r() * 22;
      x.fillStyle = '#0a1a14';
      for (let k = 0; k < th; k += 2) x.fillRect(tx - (th - k) * 0.25, 64 - k - 4, (th - k) * 0.5, 2);
    }
    x.fillStyle = '#c8d8e8'; x.fillRect(0, 58, 128, 6);
    return toTex(c, { wrap: false });
  }
  if (theme.view === 'road') {
    x.fillStyle = '#3a2a14'; x.fillRect(0, 40, 128, 24);
    x.fillStyle = '#1a1410'; x.beginPath(); x.moveTo(50, 64); x.lineTo(62, 40); x.lineTo(66, 40); x.lineTo(90, 64); x.fill();
    x.fillStyle = '#f5c542'; for (let y = 42; y < 64; y += 5) x.fillRect(63 + (y - 40) * 0.12, y, 1, 2);
    for (let i = 0; i < 3; i++) { x.fillStyle = '#2a2e20'; x.fillRect(60 - i * 2, 44 + i * 6, 6 + i * 2, 3 + i); x.fillStyle = '#ffd98a'; x.fillRect(60 - i * 2, 46 + i * 7, 1, 1); }
    return toTex(c, { wrap: false });
  }
  if (theme.view === 'towers') {
    x.fillStyle = theme.building;
    x.fillRect(60, 2, 4, 62); x.fillRect(57, 20, 10, 44); x.fillRect(54, 36, 16, 28);
    x.fillStyle = '#ffd98a'; for (let y = 6; y < 62; y += 3) if (r() > 0.4) x.fillRect(61, y, 1, 1);
  }
  if (theme.view === 'coast') {
    x.fillStyle = '#0c1430'; x.fillRect(0, 50, 128, 14);
    x.fillStyle = 'rgba(255,220,160,0.25)'; for (let i = 0; i < 20; i++) x.fillRect(r() * 128, 52 + r() * 10, 3, 1);
  }
  // skyline
  let bx = 0;
  const maxH = theme.view === 'coast' ? 22 : theme.view === 'towers' ? 26 : 36;
  while (bx < 128) {
    if (theme.view === 'towers' && bx > 50 && bx < 72) { bx += 4; continue; }
    const bw = 8 + (r() * 14 | 0), bh = 16 + (r() * maxH | 0);
    x.fillStyle = theme.building;
    x.fillRect(bx, 64 - bh, bw, bh);
    for (let wy = 64 - bh + 3; wy < 62; wy += 4) for (let wx = bx + 2; wx < bx + bw - 2; wx += 3) {
      if (r() > 0.55) { x.fillStyle = r() > 0.8 ? theme.neon[(r() * theme.neon.length) | 0] : '#ffd98a'; x.fillRect(wx, wy, 1, 2); }
    }
    bx += bw + 1;
  }
  return toTex(c, { wrap: false });
}

export function rainTexture() {
  const c = canvas(32, 64), x = c.getContext('2d');
  const r = rng(99);
  x.clearRect(0, 0, 32, 64);
  for (let i = 0; i < 26; i++) {
    x.fillStyle = `rgba(170,200,255,${0.25 + r() * 0.5})`;
    x.fillRect(r() * 32 | 0, r() * 64 | 0, 1, 3 + (r() * 6 | 0));
  }
  return toTex(c);
}

export function circleTexture(size = 32, soft = true, color = '#000000') {
  const c = canvas(size, size), x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(soft ? 0.55 : 0.9, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return toTex(c, { wrap: false });
}

export function glowTexture(size = 32) {
  const c = canvas(size, size), x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return toTex(c, { wrap: false, linear: false });
}

export function coneTexture() {
  const c = canvas(16, 32), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 16, 32);
  return toTex(c, { wrap: false });
}

export function vendingTexture(color = '#ff2b4a', label = 'DRINK') {
  const [c, x] = hcanvas(32, 64);
  x.fillStyle = color; x.fillRect(0, 0, 32, 64);
  x.fillStyle = '#e8f6ff'; x.fillRect(3, 8, 20, 36);
  const r = rng(color.length * 13);
  const cans = ['#ff3030', '#30a0ff', '#ffe030', '#30ff80', '#ff80ff', '#ffffff'];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    x.fillStyle = cans[(r() * cans.length) | 0];
    x.fillRect(4 + col * 5, 10 + row * 9, 3, 6);
    x.fillStyle = '#222'; x.fillRect(4 + col * 5, 17 + row * 9, 4, 1);
  }
  x.fillStyle = '#111'; x.fillRect(25, 12, 5, 16);
  x.fillStyle = '#ffdd33'; x.fillRect(26, 14, 3, 2);
  x.fillStyle = '#0a0a0a'; x.fillRect(4, 50, 18, 8);
  x.fillStyle = '#ffffff';
  x.font = 'bold 6px "Press Start 2P", monospace';
  x.fillText(label.slice(0, 5), 2, 6);
  return toTex(c, { wrap: false });
}

export function arcadeTexture(color = '#2b8bff') {
  const [c, x] = hcanvas(32, 64);
  x.fillStyle = '#111018'; x.fillRect(0, 0, 32, 64);
  x.fillStyle = color; x.fillRect(0, 0, 32, 10);
  x.fillStyle = '#fff'; x.font = '5px "Press Start 2P", monospace'; x.fillText('SHOOT', 3, 7);
  // side art stripes
  x.fillStyle = color;
  for (let i = 0; i < 6; i++) x.fillRect(0, 40 + i * 4, 32, 1);
  x.fillStyle = '#222'; x.fillRect(4, 36, 24, 4);
  x.fillStyle = '#ff3040'; x.fillRect(8, 37, 2, 2);
  x.fillStyle = '#40ff60'; x.fillRect(20, 37, 2, 2);
  x.fillStyle = '#ffe040'; x.fillRect(24, 37, 2, 2);
  return toTex(c, { wrap: false });
}

// Animated screen: returns {tex, draw(t)} that repaints a tiny canvas.
export function animatedScreen(kind, seed = 1) {
  const W = 32, H = 24;
  const c = canvas(W, H), x = c.getContext('2d');
  const tex = toTex(c, { wrap: false });
  const r = rng(seed);
  const stars = Array.from({ length: 18 }, () => [r() * W, r() * H, 0.3 + r()]);
  let last = -1;
  const draw = (t) => {
    const frame = Math.floor(t * 12);
    if (frame === last) return;
    last = frame;
    if (kind === 'static') {
      const d = x.createImageData(W, H);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = Math.random() * 200 | 0;
        d.data[i] = v * 0.8; d.data[i + 1] = v * 0.9; d.data[i + 2] = v; d.data[i + 3] = 255;
      }
      x.putImageData(d, 0, 0);
      x.fillStyle = 'rgba(0,0,0,0.4)';
      x.fillRect(0, (frame * 3) % H, W, 3);
    } else if (kind === 'bars') {
      const cols = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
      cols.forEach((cc, i) => { x.fillStyle = cc; x.fillRect(i * W / 7, 0, W / 7 + 1, H * 0.7); });
      x.fillStyle = '#111'; x.fillRect(0, H * 0.7, W, H);
      x.fillStyle = frame % 12 < 6 ? '#fff' : '#f33';
      x.font = '5px "Press Start 2P", monospace';
      x.fillText('NO SIGNAL', 1, H - 3);
    } else if (kind === 'eye') {
      x.fillStyle = '#100418'; x.fillRect(0, 0, W, H);
      const blink = (frame % 40) < 2;
      x.fillStyle = '#e8e0ff';
      if (!blink) { x.beginPath(); x.ellipse(W / 2, H / 2, 11, 6, 0, 0, 7); x.fill(); }
      x.fillStyle = '#b01060';
      const lx = Math.sin(t * 0.7) * 5;
      if (!blink) { x.beginPath(); x.arc(W / 2 + lx, H / 2, 4, 0, 7); x.fill(); }
      x.fillStyle = '#000';
      if (!blink) x.fillRect(W / 2 + lx - 1, H / 2 - 1, 2, 2);
    } else if (kind === 'stars') {
      x.fillStyle = '#05030c'; x.fillRect(0, 0, W, H);
      for (const s of stars) {
        s[0] -= s[2] * 0.8; if (s[0] < 0) { s[0] = W; s[1] = Math.random() * H; }
        x.fillStyle = s[2] > 1 ? '#fff' : '#88a';
        x.fillRect(s[0] | 0, s[1] | 0, 1, 1);
      }
      x.fillStyle = '#ff3fd0';
      const sx = 4, sy = H / 2 + Math.sin(t * 2) * 5;
      x.fillRect(sx, sy, 5, 2); x.fillRect(sx + 1, sy - 1, 2, 4);
      if (frame % 4 < 2) { x.fillStyle = '#ffe040'; x.fillRect(sx + 6 + (frame % 8) * 2, sy, 2, 1); }
    } else if (kind === 'pong') {
      x.fillStyle = '#021006'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#40ff70';
      const bx = (Math.abs(((t * 20) % (2 * (W - 4))) - (W - 4))) + 2;
      const by = (Math.abs(((t * 13) % (2 * (H - 4))) - (H - 4))) + 2;
      x.fillRect(bx | 0, by | 0, 2, 2);
      x.fillRect(1, (by - 3) | 0, 1, 6); x.fillRect(W - 2, (by - 3 + Math.sin(t) * 2) | 0, 1, 6);
      for (let y = 0; y < H; y += 3) x.fillRect(W / 2, y, 1, 1);
    } else if (kind === 'radar') {
      x.fillStyle = '#020a02'; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#1a4a10';
      for (const rr of [4, 8, 11]) { x.beginPath(); x.arc(W / 2, H / 2, rr, 0, 7); x.stroke(); }
      x.fillRect(W / 2, 0, 1, H); x.fillRect(0, H / 2, W, 1);
      const a = t * 2.2;
      x.strokeStyle = '#8fd14f'; x.beginPath(); x.moveTo(W / 2, H / 2); x.lineTo(W / 2 + Math.cos(a) * 12, H / 2 + Math.sin(a) * 12); x.stroke();
      for (const s0 of stars.slice(0, 5)) {
        const ba = Math.atan2(s0[1] - H / 2, s0[0] - W / 2), da = ((a - ba) % 6.283 + 6.283) % 6.283;
        if (Math.hypot(s0[0] - W / 2, s0[1] - H / 2) < 11 && da < 1.2) { x.fillStyle = da < 0.3 ? '#d0ff90' : '#4a8a28'; x.fillRect(s0[0] | 0, s0[1] | 0, 2, 1); }
      }
    } else if (kind === 'map') {
      x.fillStyle = '#041008'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#1a3a14';
      for (const s0 of stars) x.fillRect(s0[0] | 0, s0[1] | 0, 3 + (s0[2] * 3 | 0), 2);
      x.strokeStyle = '#2a5a1c'; for (let i = 0; i < W; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
      const k = (t * 0.4) % 1;
      x.fillStyle = frame % 8 < 4 ? '#ff3b30' : '#6a1008';
      x.fillRect(4 + k * (W - 10), 6 + Math.sin(k * 6) * 5 + 6, 2, 2);
      x.fillStyle = '#f5c542'; x.fillRect(W - 6, 4, 2, 2);
    } else if (kind === 'fish') {
      x.fillStyle = '#021a2a'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#ffa030';
      const fx = (t * 6) % (W + 10) - 5;
      x.fillRect(fx | 0, 10, 5, 3); x.fillRect((fx - 2) | 0, 9, 2, 5);
    }
    tex.needsUpdate = true;
  };
  draw(0);
  return { tex, draw };
}

export function starTexture() {
  const c = canvas(128, 64), x = c.getContext('2d');
  x.fillStyle = '#020108'; x.fillRect(0, 0, 128, 64);
  const r = rng(5);
  for (let i = 0; i < 140; i++) {
    const v = r();
    x.fillStyle = v > 0.9 ? '#ffffff' : v > 0.6 ? '#a8a0ff' : '#5040a0';
    x.fillRect(r() * 128 | 0, r() * 64 | 0, 1, 1);
  }
  // nebula smudges
  for (let i = 0; i < 6; i++) {
    const g = x.createRadialGradient(r() * 128, r() * 64, 0, r() * 128, r() * 64, 30);
    g.addColorStop(0, i % 2 ? 'rgba(200,40,255,0.18)' : 'rgba(40,160,255,0.15)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 64);
  }
  return toTex(c);
}

export function smokeTexture() {
  const c = canvas(32, 32), x = c.getContext('2d');
  const r = rng(77);
  for (let i = 0; i < 9; i++) {
    const g = x.createRadialGradient(8 + r() * 16, 8 + r() * 16, 0, 16, 16, 10 + r() * 6);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  }
  return toTex(c, { wrap: false });
}

// Cue stick texture (u around, v along the length: v=0 butt, v=1 tip).
export function cueTexture(skin) {
  const c = canvas(16, 256), x = c.getContext('2d');
  skin.paint(x, 16, 256);
  const t = toTex(c, { wrap: false });
  t.flipY = false;
  return t;
}

export function checkerTexture(a = '#fff', b = '#000', n = 8) {
  const c = canvas(n * 2, n * 2), x = c.getContext('2d');
  x.fillStyle = a; x.fillRect(0, 0, n * 2, n * 2);
  x.fillStyle = b; x.fillRect(0, 0, n, n); x.fillRect(n, n, n, n);
  return toTex(c);
}

export { hex, shade };
