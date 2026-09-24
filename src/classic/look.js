// SCRATCH CLASSIC — the look of a private billiards lounge. Everything is
// painted procedurally at high resolution: numbered balls, cues, felt and wood.
// Cosmetics are deliberately few and realistic.

import { canvas, toTex, rng } from '../render/textures.js';
import { paintBall } from '../render/ballpaint.js';
import { ballSkinById, cueSkinById, FELTS as ALL_FELTS, CUE_SKINS, BALL_SKINS } from '../game/cosmetics.js';

// ------------------------------------------------------------ choices
// felts, cues and ball sets are shared with the roguelite (game/cosmetics.js);
// Classic shows the classy ones unless COSMETICS is set to ALL COMPATIBLE
export const FELTS = ALL_FELTS.filter(f => !f.rogueOnly);
export const CUES = CUE_SKINS;
export const BALLS = BALL_SKINS;

// the room around the table: same lounge, three interiors
export const ROOMS = [
  { id: 'lounge', name: 'Midnight Lounge', desc: 'Walnut, leather and rain on the tall windows.', unlock: {}, kind: 'room' },
  { id: 'parlour', name: 'Private Club', desc: 'Damask walls, green leather, a clock that ticks.', unlock: {}, kind: 'room' },
  { id: 'loft', name: 'Penthouse', desc: 'The city at your feet and the air conditioning humming.', unlock: { clevel: 2 }, kind: 'room' },
  { id: 'hall', name: 'Tournament Hall', desc: 'Bright lights, a scoreboard and a crowd that keeps its voice down.', unlock: { clevel: 3 }, kind: 'room' },
];

export const LIGHTS = [
  { id: 'warm', name: 'Warm Lounge', lamp: [1.42, 1.15, 0.82], ambient: [0.068, 0.053, 0.042], sky: [0.09, 0.072, 0.056], ground: [0.036, 0.027, 0.02], accent: 1.25, window: 0.65, fog: [0.02, 0.016, 0.012] },
  { id: 'evening', name: 'Evening', lamp: [1.32, 1.06, 0.78], ambient: [0.045, 0.042, 0.05], sky: [0.06, 0.06, 0.08], ground: [0.022, 0.02, 0.024], accent: 0.95, window: 1.2, fog: [0.018, 0.018, 0.024] },
  { id: 'midnight', name: 'Midnight', lamp: [1.38, 1.22, 0.98], ambient: [0.026, 0.026, 0.034], sky: [0.035, 0.035, 0.05], ground: [0.012, 0.012, 0.016], accent: 0.62, window: 0.85, fog: [0.01, 0.01, 0.014] },
];


export const byId = (list, id) => list.find(x => x.id === id) || list[0];

// ------------------------------------------------------------ helpers
function grain(x, w, h, base, dark, light, seed, { lines = 90, wave = 6, alpha = 0.22 } = {}) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let i = 0; i < lines; i++) {
    const px = r() * w, amp = wave * (0.4 + r()), f = 0.004 + r() * 0.01, ph = r() * 6;
    x.strokeStyle = r() > 0.45 ? dark : light;
    x.globalAlpha = alpha * (0.3 + r() * 0.7);
    x.lineWidth = 0.6 + r() * 1.8;
    x.beginPath();
    for (let y = 0; y <= h; y += 8) x.lineTo(px + Math.sin(y * f + ph) * amp + Math.sin(y * f * 3.1) * amp * 0.25, y);
    x.stroke();
  }
  x.globalAlpha = 1;
}

function noise(x, w, h, amt, seed, cell = 1) {
  const d = x.getImageData(0, 0, w, h), r = rng(seed);
  for (let yy = 0; yy < h; yy += cell) for (let xx = 0; xx < w; xx += cell) {
    const n = 1 + (r() - 0.5) * amt;
    for (let j = 0; j < cell && yy + j < h; j++) for (let i = 0; i < cell && xx + i < w; i++) {
      const k = ((yy + j) * w + xx + i) * 4;
      d.data[k] *= n; d.data[k + 1] *= n; d.data[k + 2] *= n;
    }
  }
  x.putImageData(d, 0, 0);
}

// ------------------------------------------------------------ table
export function feltTex(color, seed = 5) {
  const S = 512, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, S, S);
  noise(x, S, S, 0.045, seed);
  // cloth, not plastic: a few very soft, low-frequency variations in the weave
  const r = rng(seed + 3);
  for (let i = 0; i < 24; i++) {
    const cx = r() * S, cy = r() * S, rr = 60 + r() * 120;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, r() > 0.5 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.025)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  }
  return toTex(c, { repeat: [6, 3] });
}

export function walnutTex(dark = false, seed = 21) {
  const w = 512, h = 1024, c = canvas(w, h), x = c.getContext('2d');
  if (dark) grain(x, w, h, '#2a170d', '#140a05', '#3a2214', seed, { lines: 70, alpha: 0.25 });
  else grain(x, w, h, '#54301a', '#2a160b', '#7a4a2a', seed, { lines: 120, alpha: 0.2 });
  // figure: soft darker flames
  const r = rng(seed + 7);
  for (let i = 0; i < 14; i++) {
    const g = x.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 60 + r() * 140);
    g.addColorStop(0, `rgba(20,8,2,${0.12 + r() * 0.1})`); g.addColorStop(1, 'rgba(20,8,2,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  noise(x, w, h, 0.05, seed + 1);
  return toTex(c, { repeat: [1, 1] });
}

// the table theme handed to Table.build
export function tableTheme(felt) {
  const f = byId(FELTS, felt);
  return {
    id: 'classic', classic: true, turnedLegs: true,
    felt: f.felt, cushion: f.cushion, wood: ['#54301a', '#2a170d'], metal: '#8a7248', lamp: '#fff0d8', feltFx: f.fx || null, feltLine: f.line || null,
    ringW: 0.011, ringMat: { color: 0x141110, gloss: 0.7, shine: 50 },       // leather pocket liners
    diamondMat: { color: 0xd8ccb0, gloss: 1.2, shine: 80 },                 // mother-of-pearl sights, lit like the rails
    tex: {
      felt: () => feltTex(f.felt, 5),
      cushion: () => feltTex(f.cushion, 9),
      wood: () => walnutTex(false, 21),
      woodDark: () => walnutTex(true, 33),
      woodGloss: 0.55, woodShine: 70,
    },
  };
}

// ------------------------------------------------------------ balls
// Classic paints the shared ball sets (game/cosmetics.js) at full resolution.
export function ballSkin(id) {
  const set = ballSkinById(id);
  return { ...set, id: 'classic-' + set.id, texture: (num) => paintBall(num, set, 'classic'), mat: { reflect: 0.2, spec: 1.1, rimAmt: 0, rim: 0x000000, ...set.mat, bands: 4 } };
}

// ------------------------------------------------------------ cues
// canvas y = 0 is the butt, y = h is the tip (see Cue.js)
function cueTex(id) {
  const w = 64, h = 1024, c = canvas(w, h), x = c.getContext('2d');
  const band = (y, hh, col) => { x.fillStyle = col; x.fillRect(0, y, w, hh); };
  const woodBand = (y0, y1, base, dark, light, seed) => {
    const t = canvas(w, y1 - y0), tx = t.getContext('2d');
    grain(tx, w, y1 - y0, base, dark, light, seed, { lines: 26, wave: 2, alpha: 0.3 });
    x.drawImage(t, 0, y0);
  };
  const points = (y0, y1, col, edge) => {
    for (let i = 0; i < 4; i++) {
      const cx = (i + 0.5) * w / 4;
      x.fillStyle = edge;
      x.beginPath(); x.moveTo(cx - 6.5, y0); x.lineTo(cx, y1 + 3); x.lineTo(cx + 6.5, y0); x.fill();
      x.fillStyle = col;
      x.beginPath(); x.moveTo(cx - 5, y0); x.lineTo(cx, y1); x.lineTo(cx + 5, y0); x.fill();
    }
  };
  const linen = (y0, y1, col, thread) => {
    band(y0, y1 - y0, col);
    x.globalAlpha = 0.35;
    for (let y = y0; y < y1; y += 3) { x.fillStyle = thread; x.fillRect(0, y, w, 1); }
    for (let xx = 0; xx < w; xx += 4) { x.fillStyle = '#000'; x.fillRect(xx, y0, 1, y1 - y0); }
    x.globalAlpha = 1;
  };
  const shaft = (col = '#e9d3a6', col2 = '#dcc08c') => {
    const g = x.createLinearGradient(0, 520, 0, 998);
    g.addColorStop(0, col2); g.addColorStop(1, col);
    x.fillStyle = g; x.fillRect(0, 520, w, 478);
    x.globalAlpha = 0.18;
    const r = rng(8);
    for (let i = 0; i < 18; i++) { x.fillStyle = '#b89968'; x.fillRect(r() * w, 520, 1, 478); }
    x.globalAlpha = 1;
  };
  const tipEnd = (ferrule = '#f4f1e8', tip = '#3b5a86') => { band(998, 20, ferrule); band(1018, 6, tip); };

  if (id === 'ebony') {
    band(0, 12, '#0b0b0b'); band(12, 14, '#c9ccd2');
    woodBand(26, 170, '#15110f', '#070504', '#2a221d', 41);
    band(170, 4, '#c9ccd2');
    linen(174, 395, '#0d0c0b', '#262422');
    band(395, 4, '#c9ccd2');
    woodBand(399, 505, '#15110f', '#070504', '#2a221d', 43);
    for (const y of [420, 470]) band(y, 2, '#c9ccd2');
    for (let i = 0; i < 4; i++) { x.fillStyle = '#e8ecf0'; x.beginPath(); x.arc((i + 0.5) * w / 4, 445, 3.2, 0, 7); x.fill(); }
    band(505, 15, '#b9bcc2'); band(510, 2, '#6e7176');
    shaft(); tipEnd();
  } else if (id === 'ivory') {
    band(0, 12, '#141210'); band(12, 14, '#1a1614');
    band(26, 144, '#e9e0cc');
    for (const y of [40, 150, 160]) band(y, 2, '#141210');
    band(170, 4, '#141210');
    linen(174, 395, '#3a2618', '#5a3f2a');
    band(395, 4, '#141210');
    band(399, 106, '#e9e0cc');
    points(399, 488, '#15110f', '#8a6a3a');
    band(505, 15, '#efe7d6'); band(507, 1, '#141210'); band(517, 1, '#141210');
    shaft(); tipEnd('#f6f3ea', '#2d4a73');
  } else if (id === 'carbon') {
    const weave = (y0, y1) => {
      band(y0, y1 - y0, '#1a1b1d');
      for (let y = y0; y < y1; y += 6) for (let xx = 0; xx < w; xx += 6) {
        x.fillStyle = ((xx + y) / 6) % 2 ? '#2a2c30' : '#141517';
        x.fillRect(xx, y, 6, 3);
      }
    };
    band(0, 12, '#0a0a0a');
    weave(12, 175);
    band(175, 3, '#9ea3aa');
    linen(178, 392, '#0f0f10', '#1e1f21');
    band(392, 3, '#9ea3aa');
    weave(395, 505);
    band(505, 15, '#a6abb2'); band(511, 2, '#3a3d42');
    const g = x.createLinearGradient(0, 520, 0, 998);
    g.addColorStop(0, '#151618'); g.addColorStop(1, '#1d1e21');
    x.fillStyle = g; x.fillRect(0, 520, w, 478);
    band(980, 3, '#d8dce2');
    tipEnd('#1a1a1a', '#2f4e7a');
  } else if (id === 'birdseye') {
    // pale figured maple: the butt is covered in tiny 'eyes'
    band(0, 12, '#0b0b0b'); band(12, 14, '#2a1a10');
    woodBand(26, 505, '#d9b98a', '#a8825a', '#efd8b0', 61);
    const r = rng(62);
    for (let i = 0; i < 260; i++) { const ex = r() * w, ey = 30 + r() * 470; x.fillStyle = `rgba(90,60,30,${0.25 + r() * 0.3})`; x.beginPath(); x.ellipse(ex, ey, 1.2 + r() * 1.4, 0.8 + r(), 0, 0, 7); x.fill(); }
    for (const y of [170, 395]) band(y, 4, '#2a1a10');
    band(505, 15, '#e8dfc8'); band(509, 1, '#2a1a10');
    shaft(); tipEnd();
  } else if (id === 'goldinlay') {
    band(0, 12, '#0b0b0b'); band(12, 14, '#c9a24a');
    woodBand(26, 505, '#1a0e08', '#0a0503', '#2e1a10', 71);
    points(399, 492, '#d8b060', '#6a4a18');
    for (const y of [40, 170, 395, 470]) band(y, 3, '#d8b060');
    for (let i = 0; i < 4; i++) { x.fillStyle = '#e8c878'; x.beginPath(); x.moveTo((i + 0.5) * w / 4, 250); x.lineTo((i + 0.5) * w / 4 + 5, 280); x.lineTo((i + 0.5) * w / 4, 310); x.lineTo((i + 0.5) * w / 4 - 5, 280); x.fill(); }
    band(505, 15, '#d8b060'); band(510, 2, '#6a4a18');
    shaft(); tipEnd('#f4f1e8', '#1a1a1a');
  } else {
    // classic wood: rosewood butt, maple points, black linen
    band(0, 12, '#0b0b0b'); band(12, 14, '#d9c9a0');
    woodBand(26, 170, '#5a2615', '#2c1008', '#7a3a20', 51);
    band(170, 4, '#d9c9a0');
    linen(174, 395, '#161616', '#2c2c2c');
    band(395, 4, '#d9c9a0');
    woodBand(399, 505, '#5a2615', '#2c1008', '#7a3a20', 53);
    points(399, 492, '#e2c38f', '#0d0d0d');
    band(505, 15, '#e8dfc8'); band(508, 1, '#5a2615'); band(516, 1, '#5a2615');
    shaft(); tipEnd();
  }
  const t = toTex(c, { wrap: false });
  t.flipY = false;
  return t;
}

export function cueSkin(id) {
  const c = cueSkinById(id);
  if (!c.hi) {
    // a roguelite cue at the Classic table: its pixel art, scaled up crisply
    return { ...c, id: 'classic-' + c.id, texture: () => {
      const lo = canvas(16, 256); c.paint(lo.getContext('2d'), 16, 256);
      const hi = canvas(64, 1024), x = hi.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(lo, 0, 0, 64, 1024);
      const t = toTex(hi, { wrap: false }); t.flipY = false; return t;
    } };
  }
  const shiny = id === 'carbon' ? { gloss: 0.9, shine: 90 } : id === 'ebony' || id === 'goldinlay' ? { gloss: 0.85, shine: 80 } : { gloss: 0.6, shine: 60 };
  return { ...c, id: 'classic-' + c.hi, texture: () => cueTex(c.hi), mat: shiny };
}
