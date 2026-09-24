// Table themes, ball skins and cue skins. All cosmetic: they swap textures,
// shader parameters, lights and props on the same geometry.

import { rng } from '../render/textures.js';

// ---------------------------------------------------------------------------
// TABLE THEMES
export const THEMES = [
  {
    id: 'midnight', name: 'MIDNIGHT CLUB', desc: 'Green felt. Rain on the windows. The neon never sleeps.',
    unlock: { level: 1 },
    felt: '#17804a', cushion: '#126a3c', wood: ['#5a2a12', '#230c04'], metal: '#c8b070',
    carpet: ['#1a0f2a', '#e0306a', '#20c0d0', '#f0c030', '#5030a0'], seed: 11,
    wall: ['#241a38', '#34285a', '#3a1c10'],
    sky: ['#0a0c24', '#2a1840'], building: '#07060f',
    neon: ['#ff2bd6', '#2bf0ff', '#ffe23b', '#7a5cff'],
    env: ['#201838', '#382860', '#402040'], lamp: '#fff0c8', felt2: '#17804a',
    lampColor: [1.35, 1.12, 0.82], ambient: [0.05, 0.035, 0.08], skyC: [0.10, 0.07, 0.17], ground: [0.03, 0.02, 0.03],
    fog: [0.035, 0.02, 0.07], fogNear: 3.2, fogFar: 10,
    signs: [['POOL', '#ff2bd6'], ['OPEN 24H', '#2bf0ff'], ['ビリヤード', '#ffe23b']],
    windows: 'rain', props: 'club',
    grade: { lift: [0.035, 0.012, 0.06], gain: [1.05, 1.0, 1.08], sat: 1.25 },
  },
  {
    id: 'hell', name: 'HELL TABLE', desc: 'Dark red felt, a thousand candles, and something breathing under the floor.',
    unlock: { level: 4 },
    felt: '#4e0a14', cushion: '#3a0610', wood: ['#2a0c08', '#080202'], metal: '#e0a040',
    carpet: ['#140404', '#6a0c0c', '#ff5a10', '#2a0808'], seed: 31,
    wall: ['#1c0606', '#3a0a0a', '#120202'],
    sky: ['#1a0000', '#ff3000'], building: '#0a0000',
    neon: ['#ff3a10', '#ffb020', '#ff0040'],
    env: ['#200404', '#601008', '#ff4010'], lamp: '#ffb070', felt2: '#7a1016',
    lampColor: [1.4, 1.0, 0.72], ambient: [0.06, 0.015, 0.012], skyC: [0.16, 0.03, 0.02], ground: [0.05, 0.0, 0.0],
    fog: [0.09, 0.012, 0.005], fogNear: 2.6, fogFar: 9,
    signs: [['ABANDON', '#ff3a10'], ['地獄', '#ffb020'], ['NO REFUNDS', '#ff0040']],
    windows: 'fire', props: 'hell',
    grade: { lift: [0.04, 0.0, 0.0], gain: [1.06, 0.98, 0.95], sat: 1.2 },
  },
  {
    id: 'aquarium', name: 'AQUARIUM', desc: 'The walls are glass. Things with too many teeth drift past.',
    unlock: { level: 7 },
    felt: '#12607a', cushion: '#0c4a60', wood: ['#1c2c38', '#0a141a'], metal: '#80e0ff',
    carpet: ['#061828', '#10a0b0', '#f0e080', '#0a3050'], seed: 51,
    wall: ['#062030', '#0c3048', '#081820'],
    sky: ['#021828', '#084060'], building: '#010a12',
    neon: ['#3bf0ff', '#80ffcf', '#ffa040'],
    env: ['#04304a', '#0a5070', '#0a3040'], lamp: '#c8f4ff', felt2: '#12607a',
    lampColor: [0.75, 1.15, 1.35], ambient: [0.01, 0.05, 0.08], skyC: [0.02, 0.10, 0.16], ground: [0.0, 0.02, 0.04],
    fog: [0.01, 0.07, 0.11], fogNear: 2.8, fogFar: 9.5,
    signs: [['DEEP END', '#3bf0ff'], ['水族館', '#80ffcf'], ['FEED ME', '#ffa040']],
    windows: 'aquarium', props: 'aquarium',
    grade: { lift: [0.0, 0.03, 0.06], gain: [0.95, 1.05, 1.1], sat: 1.2 },
  },
  {
    id: 'arcade', name: 'ARCADE', desc: 'Bright carpet, screaming cabinets, and a table somebody spilled soda on.',
    unlock: { level: 10 },
    felt: '#3a2ab0', cushion: '#2a1e8a', wood: ['#101010', '#000000'], metal: '#ff40c0',
    carpet: ['#0c0620', '#ff2080', '#30f0ff', '#fff030', '#40ff60'], seed: 71,
    wall: ['#120a28', '#ff20a0', '#0a0616'],
    sky: ['#100030', '#ff2080'], building: '#08001a',
    neon: ['#ff2080', '#30f0ff', '#fff030', '#40ff60'],
    env: ['#301060', '#ff2080', '#3020a0'], lamp: '#ffffff', felt2: '#3a2ab0',
    lampColor: [1.2, 1.05, 1.3], ambient: [0.07, 0.04, 0.10], skyC: [0.14, 0.06, 0.20], ground: [0.05, 0.02, 0.06],
    fog: [0.06, 0.02, 0.10], fogNear: 3.6, fogFar: 11,
    signs: [['GAME OVER', '#ff2080'], ['INSERT COIN', '#30f0ff'], ['HI SCORE', '#fff030']],
    windows: 'city', props: 'arcade',
    grade: { lift: [0.03, 0.0, 0.06], gain: [1.08, 1.02, 1.1], sat: 1.4 },
  },
  {
    id: 'void', name: 'THE VOID', desc: 'No walls. No floor. Just the table, and the stars, and you.',
    unlock: { level: 13, ach: 'deep' },
    felt: '#2a1450', cushion: '#1e0e3c', wood: ['#0c0818', '#020104'], metal: '#b080ff',
    carpet: ['#000000', '#000000'], seed: 91,
    wall: ['#000000', '#000000', '#000000'],
    sky: ['#000000', '#100020'], building: '#000000',
    neon: ['#b080ff', '#40ffe0', '#ff60c0'],
    env: ['#02010a', '#20104a', '#100830'], lamp: '#e0d0ff', felt2: '#2a1450',
    lampColor: [1.05, 0.95, 1.45], ambient: [0.03, 0.02, 0.07], skyC: [0.07, 0.04, 0.14], ground: [0.0, 0.0, 0.02],
    fog: [0.01, 0.005, 0.03], fogNear: 4, fogFar: 14,
    signs: [],
    windows: 'none', props: 'void',
    grade: { lift: [0.02, 0.0, 0.05], gain: [1.0, 0.98, 1.1], sat: 1.2 },
  },
  {
    id: 'afterhours', name: 'CLOSING TIME', desc: 'Chairs up on the tables, one lamp still on, and a clock that says 03:77.',
    unlock: { ach: 'last_game' },
    felt: '#0f5a34', cushion: '#0b4428', wood: ['#3a1a0a', '#140602'], metal: '#a09060',
    carpet: ['#120a18', '#5a2040', '#1a6070', '#806020'], seed: 77,
    wall: ['#16101e', '#221a30', '#2a120a'],
    sky: ['#04040c', '#141028'], building: '#040308',
    neon: ['#6a2050', '#1a5a66', '#6a5a1a'],
    env: ['#100c1c', '#1c1430', '#201018'], lamp: '#ffe0b0', felt2: '#0f5a34',
    lampColor: [1.2, 0.95, 0.7], ambient: [0.02, 0.015, 0.03], skyC: [0.05, 0.04, 0.08], ground: [0.01, 0.01, 0.015],
    fog: [0.012, 0.008, 0.025], fogNear: 2.4, fogFar: 8.5,
    signs: [['CLOSED', '#ff3b5c'], ['03:77', '#f0e6c8'], ['閉店', '#6a5cff']],
    windows: 'rain', props: 'afterhours',
    grade: { lift: [0.01, 0.0, 0.03], gain: [1.0, 0.96, 1.02], sat: 0.95 },
  },
  {
    id: 'command', name: 'RADAR TABLE', desc: 'Radar screens, warning lights and a map table that is also a pool table.',
    unlock: { ach: 'system_online' }, rajis: true,
    felt: '#34401e', cushion: '#262f14', wood: ['#23261c', '#08090a'], metal: '#8fd14f',
    carpet: ['#0a0c08', '#1a2210', '#2a3418', '#3a2a0a'], seed: 131,
    wall: ['#1c211a', '#2a3024', '#3a3a2a'],
    sky: ['#020a04', '#0a2410'], building: '#010502',
    neon: ['#8fd14f', '#ff3b30', '#f5c542'],
    env: ['#0a140a', '#1a2a14', '#141a10'], lamp: '#e8ffd8', felt2: '#34401e',
    lampColor: [1.0, 1.15, 0.85], ambient: [0.02, 0.045, 0.02], skyC: [0.03, 0.08, 0.03], ground: [0.01, 0.02, 0.01],
    fog: [0.01, 0.03, 0.012], fogNear: 3.2, fogFar: 10,
    signs: [['RAJIS', '#8fd14f'], ['DEFCON 3', '#ff3b30'], ['司令部', '#f5c542']],
    windows: 'none', props: 'rajis', view: 'screens',
    grade: { lift: [0.0, 0.03, 0.0], gain: [0.98, 1.06, 0.95], sat: 1.05 },
  },
];

// ---------------------------------------------------------------------------
// BALL SETS — one list for both games (see render/ballpaint.js for the
// readability rules every set obeys). fx animates the coloured areas in the
// shader; classy sets are the ones SCRATCH Classic offers by default.
export const BALL_FX = { none: 0, galaxy: 1, neon: 2, plasma: 3, lava: 4, digital: 5, hologram: 6, radar: 7, liquid: 8, void: 9, cyber: 10, afterhours: 11 };
const F = BALL_FX;

export const BALL_SKINS = [
  {
    id: 'classic', name: 'CLASSIC', desc: 'Phenolic resin, the colours everybody knows.', unlock: { level: 1 }, classy: true,
    pal: {}, cueMark: 'dot', mat: {},
  },
  {
    id: 'tournament', name: 'TOURNAMENT', desc: 'Brighter pro colours and the spotted cue ball from the TV tables.', unlock: { level: 2 }, classy: true, buy: true,
    pal: { cue: '#fbfbf6', stripe: '#fbfbf6', disc: '#fbfbf6', mark: '#c8202a', hues: ['#ffc300', '#0f50e0', '#e6151f', '#5a2ea6', '#ff6a00', '#0a8a4a', '#8e1418'], eight: '#08080a' },
    cueMark: 'measle', mat: { spec: 1.2 },
  },
  {
    id: 'vintage', name: 'VINTAGE', desc: 'Earthy colours, softly yellowed. A set that has seen some rooms.', unlock: { level: 5 }, classy: true, buy: true,
    pal: { cue: '#ebdfc4', stripe: '#ebdfc4', disc: '#ebdfc4', mark: '#8a3a2a', hues: ['#d6a238', '#2c4a88', '#b23a31', '#5a3a6d', '#cd7036', '#2f6a4a', '#6c2a25'], eight: '#161412' },
    cueMark: 'dot', mat: { spec: 0.8, reflect: 0.14 },
  },
  {
    id: 'ivory', name: 'IVORY', desc: 'Warm cream and deep, rich colours. For running a whole rack from the break.', unlock: { ach: 'break_run' }, classy: true,
    pal: { cue: '#f5ecd4', stripe: '#f0e4c6', disc: '#f5ecd4', mark: '#b8923a', ink: '#1a140c', hues: ['#e2a82c', '#23478f', '#b3302a', '#5e3480', '#d0661f', '#1f6e45', '#6e2320'], eight: '#0e0b08' },
    cueMark: 'ring', discRing: '#b8923a', mat: { spec: 1.3, reflect: 0.3 },
  },
  {
    id: 'neon', name: 'NEON', desc: 'Club colours that glow a little in the dark. The white stays white.', unlock: { level: 3 }, buy: true, animated: true,
    pal: { cue: '#f4fbff', mark: '#2bf0ff', hues: ['#ffe23b', '#2b9bff', '#ff2b4a', '#b03bff', '#ff8a1b', '#2bff7a', '#ff2bd6'], eight: '#0c0a14' },
    cueMark: 'ring', fx: F.neon, mat: { rim: 0xff2bd6, rimAmt: 0.45, reflect: 0.18 }, trail: '#ff2bd6',
  },
  {
    id: 'chrome', name: 'CHROME', desc: 'Coloured metal, polished to a mirror.', unlock: { ach: 'boss_slayer' },
    pal: { cue: '#f0f2f8', stripe: '#e8ecf4', disc: '#f4f6fa', mark: '#5a6070', hues: ['#e8c24a', '#4a78d8', '#d84a4a', '#8a5ad8', '#e8884a', '#4ab87a', '#a84848'], eight: '#26262e' },
    cueMark: 'ring', mat: { reflect: 0.85, spec: 2.0, rimAmt: 0.25, bands: 5 },
  },
  {
    id: 'gold', name: 'GOLD LEAF', desc: 'Jewel colours with gold trim. Terribly impractical, entirely readable.', unlock: { ach: 'gold_rush' },
    pal: { cue: '#fbf5e6', stripe: '#fbf3e2', disc: '#fff8e8', mark: '#c89a2a', ink: '#2a1a00', hues: ['#f0c030', '#1e4fb8', '#c81e2a', '#5a2a9a', '#e0701a', '#128a48', '#7a1418'], eight: '#141008' },
    cueMark: 'ring', discRing: '#d8a83a',
    decor: (x, W, H, num, hue, stripe) => { if (stripe) { x.fillStyle = '#d8a83a'; x.fillRect(0, H * 0.27 - 1, W, 1.2); x.fillRect(0, H * 0.73, W, 1.2); } },
    mat: { reflect: 0.45, spec: 1.6, rim: 0xffd040, rimAmt: 0.35 }, trail: '#ffd040',
  },
  {
    id: 'galaxy', name: 'GALAXY', desc: 'Each ball holds a slowly drifting nebula. The cue ball holds a few stars.', unlock: { level: 11 }, animated: true,
    pal: { cue: '#f2f2ff', mark: '#8a9cff', hues: ['#f0c040', '#3a6aff', '#ff3a5a', '#a040ff', '#ff8a2a', '#30d890', '#e04aa0'], eight: '#05030c' },
    cueMark: 'core', fx: F.galaxy, mat: { rim: 0x8060ff, rimAmt: 0.45, reflect: 0.25 }, trail: '#8060ff',
  },
  {
    id: 'plasma', name: 'PLASMA', desc: 'Energy moving under the surface. For running a table at HEAT V.', unlock: { ach: 'too_hot' }, animated: true,
    pal: { cue: '#fbf8ff', mark: '#ff6af0', hues: ['#ffd23a', '#3aa0ff', '#ff3a4a', '#c05aff', '#ff8030', '#40ff90', '#ff4ab0'], eight: '#0a0610' },
    cueMark: 'core', fx: F.plasma, mat: { rim: 0xff60ff, rimAmt: 0.4, reflect: 0.2 }, trail: '#ff60ff',
  },
  {
    id: 'lava', name: 'LAVA', desc: 'Cooled rock with slow cracks of heat. The cue ball is white ash.', unlock: { level: 14 }, animated: true,
    pal: { cue: '#efe8e0', mark: '#e0702a', hues: ['#ffb020', '#2a60c0', '#e03020', '#7a3aa0', '#ff6a10', '#2a9a50', '#a02010'], eight: '#0a0604' },
    cueMark: 'dot', fx: F.lava, mat: { reflect: 0.12, spec: 0.9, rim: 0xff4010, rimAmt: 0.3 }, trail: '#ff5010',
  },
  {
    id: 'digital', name: 'DIGITAL', desc: 'A pixel grid that never stops scrolling. Rendered on a machine with 2KB of RAM.', unlock: { level: 8 }, animated: true,
    pal: { cue: '#f0fff8', mark: '#30c8a0', hues: ['#fff030', '#30a0ff', '#ff3040', '#b040ff', '#ff9020', '#30ff70', '#ff40c0'], eight: '#080c08' },
    cueMark: 'grid', fx: F.digital, mat: { reflect: 0.1, spec: 0.8, bands: 3 }, trail: '#30ff70',
  },
  {
    id: 'hologram', name: 'HOLOGRAM', desc: 'Scanlines and a sheen that slides over it. For a table without a single miss.', unlock: { ach: 'perfect' }, animated: true,
    pal: { cue: '#f4fcff', mark: '#5adcff', hues: ['#ffe86a', '#5ab8ff', '#ff6a8a', '#c08aff', '#ffaa5a', '#6affb0', '#ff7ad0'], eight: '#101828' },
    cueMark: 'ring', fx: F.hologram, mat: { rim: 0x60e0ff, rimAmt: 0.6, reflect: 0.3 }, trail: '#60e0ff',
  },
  {
    id: 'liquid', name: 'LIQUID', desc: 'A surface that never quite settles. For finding five hidden synergies.', unlock: { ach: 'synergist' }, animated: true,
    pal: { cue: '#f4f6fa', mark: '#8aa0b8', hues: ['#f8d060', '#5a90e8', '#e85a6a', '#a070e0', '#f0a060', '#60d0a0', '#c0506a'], eight: '#1a1a22' },
    cueMark: 'ring', fx: F.liquid, mat: { reflect: 0.75, spec: 1.8, rimAmt: 0.3 }, trail: '#a0c0e8',
  },
  {
    id: 'void', name: 'VOID', desc: 'Colour falling slowly inward. For three balls in one shot.', unlock: { ach: 'how' }, animated: true,
    pal: { cue: '#f2f0ff', mark: '#9a60ff', hues: ['#ffd040', '#4070ff', '#ff4060', '#b050ff', '#ff8a30', '#40e090', '#ff50c0'], eight: '#000000' },
    cueMark: 'ring', fx: F.void, mat: { rim: 0x9a4bff, rimAmt: 0.75, reflect: 0.15 }, trail: '#9a4bff',
  },
  {
    id: 'afterhours', name: 'AFTERHOURS', desc: 'Late-night colours, and a lamp passing somewhere. For beating The Owner.', unlock: { ach: 'last_game' }, animated: true,
    pal: { cue: '#f0e8d8', mark: '#6a5cff', hues: ['#d8b050', '#3a5a9a', '#b8404a', '#6a4a8a', '#c87840', '#3a8a6a', '#8a3a4a'], eight: '#0e0c14' },
    cueMark: 'dot', fx: F.afterhours, mat: { reflect: 0.22, spec: 1.1, rim: 0x6a5cff, rimAmt: 0.3 }, trail: '#6a5cff',
  },
  // ---- these stay out of every list until their mode is found
  {
    id: 'cyber', name: 'CYBER', desc: 'Brushed steel with circuits that light up. Taken from the machine.', unlock: { ach: 'machine_learning' }, rajis: true, animated: true,
    pal: { cue: '#e8ecf2', mark: '#2bf0ff', hues: ['#ffd040', '#40a0ff', '#ff4050', '#c060ff', '#ff9030', '#40ff90', '#ff50c0'], eight: '#1a1c20' },
    cueMark: 'eye', fx: F.cyber, mat: { reflect: 0.55, spec: 1.7, rim: 0x2bf0ff, rimAmt: 0.3, bands: 5 }, trail: '#2bf0ff',
  },
  {
    id: 'armored', name: 'ARMORED', desc: 'Riveted plates in every colour. Heavy industry.', unlock: { ach: 'heavy_industry' }, rajis: true,
    pal: { cue: '#e8e4d8', mark: '#f5c542', hues: ['#d8b040', '#3a6ab0', '#c03a30', '#6a4a90', '#d07a30', '#3a8a4a', '#8a3028'], eight: '#1a1a16' },
    cueMark: 'ring',
    decor: (x, W, H, num, hue, stripe) => {
      x.fillStyle = 'rgba(0,0,0,0.35)';
      const y0 = stripe ? H * 0.27 : 0, y1 = stripe ? H * 0.73 : H;
      for (let u = 0; u < W; u += 16) x.fillRect(u, y0, 1, y1 - y0);
      x.fillStyle = 'rgba(255,255,255,0.4)';
      for (let u = 4; u < W; u += 16) { x.fillRect(u, y0 + 3, 1.4, 1.4); x.fillRect(u, y1 - 5, 1.4, 1.4); }
    },
    mat: { reflect: 0.3, spec: 1.2, bands: 3 }, trail: '#f5c542',
  },
  {
    id: 'rajis', name: 'RAJIS', desc: 'A radar sweep that never stops. Somebody is still watching.', unlock: { ach: 'paulyamin' }, rajis: true, animated: true,
    pal: { cue: '#e8ffe0', mark: '#8fd14f', hues: ['#e8d040', '#3a90ff', '#ff4040', '#b050ff', '#ff9030', '#50ff70', '#ff50b0'], eight: '#041004' },
    cueMark: 'core', fx: F.radar, mat: { rim: 0x8fd14f, rimAmt: 0.4, reflect: 0.18 }, trail: '#8fd14f',
  },
];
// old ids from earlier saves → their closest successor
export const BALL_RENAMED = { marble: 'ivory', '8bit': 'digital', toxic: 'neon', orbs: 'plasma', blood: 'classic', eyes: 'classic', glass: 'hologram', molten: 'lava', daybreak: 'classic', eights: 'classic', alchemy: 'liquid', radar: 'rajis', robot: 'cyber' };

// ---------------------------------------------------------------------------
// CUES  (paint: x, w, h — v runs butt (0) → tip (h), drawn on a 16x256 grid)
// hi: SCRATCH Classic paints these ones itself at high resolution.
// anim: subtle movement on the stick — never while it would distract the aim.
function band(x, w, y, h, c) { x.fillStyle = c; x.fillRect(0, y, w, h); }
function woodGrain(x, w, h, y0, y1, base, dark) {
  band(x, w, y0, y1 - y0, base);
  const r = rng(y0 + 3);
  x.fillStyle = dark;
  for (let i = 0; i < 30; i++) x.fillRect(r() * w | 0, y0 + r() * (y1 - y0) | 0, 1, 4 + r() * 12);
}
function tip(x, w, h, ferrule = '#f0ece0', tipC = '#2a6ad0') {
  band(x, w, h - 10, 8, ferrule);
  band(x, w, h - 2, 2, tipC);
}
function shaft(x, w, h, y0 = 106, a = '#e8c890', b = '#d8b478') {
  const g = x.createLinearGradient(0, y0, 0, h - 10);
  g.addColorStop(0, b); g.addColorStop(1, a);
  x.fillStyle = g; x.fillRect(0, y0, w, h - 10 - y0);
}
function metal(x, w, y0, y1, lo, hi) {
  for (let i = 0; i < w; i++) { const v = Math.sin(i / w * Math.PI * 2); const c = lo.map((l, k) => Math.round(l + (hi[k] - l) * (0.5 + 0.5 * v))); x.fillStyle = `rgb(${c})`; x.fillRect(i, y0, 1, y1 - y0); }
}
function points(x, w, y0, y1, col) {
  for (let i = 0; i < 4; i++) { x.fillStyle = col; x.beginPath(); x.moveTo(i * 4, y0); x.lineTo(i * 4 + 2, y1); x.lineTo(i * 4 + 4, y0); x.fill(); }
}

export const CUE_SKINS = [
  {
    id: 'wood', name: 'CLASSIC WOOD', desc: 'Rosewood butt, maple shaft. The honest choice.', unlock: { level: 1 }, classy: true, hi: 'wood',
    paint: (x, w, h) => {
      woodGrain(x, w, h, 0, 100, '#4a1c0c', '#240a04');
      band(x, w, 100, 6, '#e8dcc0');
      points(x, w, 100, 64, '#e8dcc0');
      shaft(x, w, h);
      band(x, w, 20, 2, '#c0a060'); band(x, w, 24, 1, '#c0a060');
      tip(x, w, h);
    },
  },
  {
    id: 'carbon', name: 'CARBON', desc: 'Woven carbon fibre and a black shaft. Quiet and very straight.', unlock: { level: 4 }, classy: true, buy: true, hi: 'carbon',
    paint: (x, w, h) => {
      for (let y = 0; y < 104; y += 4) for (let i = 0; i < w; i += 4) { x.fillStyle = ((i + y) / 4) % 2 ? '#2a2c30' : '#141517'; x.fillRect(i, y, 4, 2); x.fillStyle = '#1a1b1d'; x.fillRect(i, y + 2, 4, 2); }
      band(x, w, 104, 2, '#9ea3aa');
      band(x, w, 106, h - 116, '#18191c');
      band(x, w, h - 26, 1, '#d8dce2');
      tip(x, w, h, '#1a1a1a', '#2f4e7a');
    },
    mat: { gloss: 1.1, shine: 90 },
  },
  {
    id: 'ebony', name: 'EBONY', desc: 'Black ebony, silver rings and pearl dots. For beating the Expert AI.', unlock: { ach: 'hustler' }, classy: true, hi: 'ebony',
    paint: (x, w, h) => {
      woodGrain(x, w, h, 0, 104, '#15110f', '#070504');
      for (const y of [8, 40, 70, 100]) band(x, w, y, 2, '#c9ccd2');
      for (let i = 0; i < 4; i++) { x.fillStyle = '#e8ecf0'; x.fillRect(i * 4 + 1, 54, 2, 2); }
      shaft(x, w, h);
      tip(x, w, h);
    },
    mat: { gloss: 1.0, shine: 80 },
  },
  {
    id: 'ivory', name: 'IVORY STYLE', desc: 'Cream inlay and black points. A club-room classic.', unlock: { clevel: 4 }, classy: true, hi: 'ivory',
    paint: (x, w, h) => {
      band(x, w, 0, 104, '#e9e0cc');
      points(x, w, 104, 70, '#15110f');
      for (const y of [10, 44, 48]) band(x, w, y, 1, '#141210');
      band(x, w, 104, 2, '#141210');
      shaft(x, w, h);
      tip(x, w, h, '#f6f3ea', '#2d4a73');
    },
  },
  {
    id: 'birdseye', name: 'BIRD’S-EYE MAPLE', desc: 'Pale figured maple covered in tiny eyes.', unlock: { clevel: 2 }, classy: true, buy: true, hi: 'birdseye',
    paint: (x, w, h) => {
      woodGrain(x, w, h, 0, 104, '#d9b98a', '#a8825a');
      const r = rng(62);
      for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(90,60,30,0.5)'; x.fillRect(r() * w | 0, r() * 100 | 0, 1, 1); }
      band(x, w, 104, 2, '#2a1a10');
      shaft(x, w, h);
      tip(x, w, h);
    },
  },
  {
    id: 'goldinlay', name: 'GOLD INLAY', desc: 'Dark wood, gold points, gold rings. For winning a Classic tournament.', unlock: { ach: 'tourney' }, classy: true, hi: 'goldinlay',
    paint: (x, w, h) => {
      woodGrain(x, w, h, 0, 104, '#1a0e08', '#0a0503');
      points(x, w, 104, 70, '#d8b060');
      for (const y of [6, 36, 66, 100]) band(x, w, y, 2, '#d8b060');
      shaft(x, w, h);
      tip(x, w, h, '#f4f1e8', '#1a1a1a');
    },
    mat: { gloss: 1.0, shine: 85 },
  },
  {
    id: 'bone', name: 'BONE', desc: 'Carved from something large. Do not ask.', unlock: { level: 7 }, buy: true,
    paint: (x, w, h) => {
      band(x, w, 0, h, '#e8e0c8');
      const r = rng(4);
      x.fillStyle = '#b8a888';
      for (let i = 0; i < 60; i++) x.fillRect(r() * w | 0, r() * h | 0, 1, 2 + r() * 5);
      for (let y = 10; y < h - 20; y += 28) { band(x, w, y, 4, '#c8b898'); band(x, w, y + 1, 2, '#8a7a60'); }
      tip(x, w, h, '#fff8e8', '#402818');
    },
  },
  {
    id: 'chrome', name: 'CHROME', desc: 'Polished steel end to end. Hands off.', unlock: { level: 9 },
    paint: (x, w, h) => {
      metal(x, w, 0, h, [70, 74, 84], [230, 234, 242]);
      band(x, w, 96, 3, '#303038'); band(x, w, 30, 1, '#303038');
      tip(x, w, h, '#ffffff', '#303038');
    },
    mat: { emissive: 0.15, gloss: 1.6, shine: 110 },
  },
  {
    id: 'volt', name: 'VOLT', desc: 'A dark shaft with a current running through it. It hums.', unlock: { level: 6 }, animated: true,
    paint: (x, w, h) => {
      band(x, w, 0, h, '#0c1020');
      const r = rng(17);
      x.fillStyle = '#4ac8ff';
      let px = w / 2;
      for (let y = 0; y < h - 12; y += 2) { px = Math.max(1, Math.min(w - 2, px + (r() - 0.5) * 3)); x.fillRect(px | 0, y, 1, 2); if (r() < 0.08) x.fillRect((px | 0) - 2, y, 5, 1); }
      band(x, w, 100, 3, '#2a4a8a');
      tip(x, w, h, '#e0f4ff', '#4ac8ff');
    },
    mat: { emissive: 0.35 }, anim: { kind: 'pulse', speed: 7, amt: 0.3, flicker: true },
  },
  {
    id: 'ember', name: 'EMBER', desc: 'Charred wood with coals still glowing in the cracks.', unlock: { level: 15 }, animated: true,
    paint: (x, w, h) => {
      woodGrain(x, w, h, 0, h - 10, '#1c100a', '#0a0402');
      const r = rng(23);
      for (let i = 0; i < 26; i++) {
        const y0 = r() * (h - 30);
        x.fillStyle = r() < 0.6 ? '#ff5a10' : '#ffb030';
        let px = r() * w;
        for (let k = 0; k < 6; k++) { x.fillRect(px | 0, y0 + k * 2, 1, 2); px += (r() - 0.5) * 2; }
      }
      tip(x, w, h, '#3a2a20', '#ff5a10');
    },
    mat: { emissive: 0.4 }, anim: { kind: 'pulse', speed: 1.3, amt: 0.35 },
  },
  {
    id: 'nebula', name: 'NEBULA', desc: 'Deep space, drifting very slowly down the shaft.', unlock: { level: 12 }, animated: true,
    paint: (x, w, h) => {
      band(x, w, 0, h, '#08061a');
      const r = rng(31);
      for (let i = 0; i < 26; i++) {
        const cy = r() * h, rr = 6 + r() * 18;
        const g = x.createRadialGradient(w / 2, cy, 0, w / 2, cy, rr);
        g.addColorStop(0, r() > 0.5 ? 'rgba(255,70,200,0.45)' : 'rgba(70,150,255,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(0, cy - rr, w, rr * 2);
      }
      x.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) x.fillRect(r() * w | 0, r() * h | 0, 1, 1);
    },
    mat: { emissive: 0.45 }, anim: { kind: 'scroll', v: 0.012 }, tipPaint: ['#e8e0ff', '#6a5cff'],
  },
  {
    id: 'void', name: 'VOID', desc: 'A black shaft with a violet edge that swirls toward the tip.', unlock: { level: 18 }, animated: true,
    paint: (x, w, h) => {
      band(x, w, 0, h, '#050308');
      for (let y = 0; y < h; y += 8) { x.fillStyle = 'rgba(154,75,255,0.55)'; x.fillRect(((y / 8) % 4) * 4, y, 4, 3); x.fillStyle = 'rgba(64,255,224,0.25)'; x.fillRect(((y / 8 + 2) % 4) * 4, y + 3, 4, 2); }
    },
    mat: { emissive: 0.5 }, anim: { kind: 'scroll', v: -0.05 }, tipPaint: ['#b080ff', '#050308'],
  },
  {
    id: 'glass', name: 'GLASS', desc: 'A crystal cue with a glint that travels down it.', unlock: { ach: 'ghost' }, animated: true,
    paint: (x, w, h) => {
      band(x, w, 0, h, '#c0f0ff');
      for (let y = 0; y < h; y += 12) band(x, w, y, 1, '#ffffff');
      tip(x, w, h, '#ffffff', '#80c0ff');
    },
    mat: { opacity: 0.5, emissive: 0.35 }, anim: { kind: 'glint', speed: 0.35 },
  },
  {
    id: 'katana', name: 'KATANA', desc: 'Wrapped handle, polished blade. Cuts the cloth.', unlock: { level: 13 },
    paint: (x, w, h) => {
      band(x, w, 0, 90, '#101010');
      for (let y = 0; y < 90; y += 6) { x.fillStyle = '#c0a030'; x.fillRect(0, y, w, 1); x.fillStyle = '#301818'; x.fillRect(w / 2 - 2, y + 1, 4, 3); }
      band(x, w, 90, 8, '#c0a030');
      metal(x, w, 98, h, [110, 110, 120], [240, 240, 250]);
      band(x, w, h - 40, 1, '#ffffff');
      tip(x, w, h, '#e0e0e8', '#e0e0e8');
    },
  },
  {
    id: 'dragon', name: 'DRAGON', desc: 'Scales that shimmer red and gold.', unlock: { ach: 'nuclear' },
    paint: (x, w, h) => {
      band(x, w, 0, h - 10, '#500808');
      for (let y = 0; y < h - 20; y += 5) for (let i = (y / 5 % 2) * 2; i < w; i += 4) { x.fillStyle = '#c02010'; x.fillRect(i, y, 3, 3); x.fillStyle = '#ffc040'; x.fillRect(i, y, 1, 1); }
      band(x, w, 100, 6, '#ffc040');
      tip(x, w, h, '#ffe8a0', '#801010');
    },
    mat: { emissive: 0.2 },
  },
  {
    id: 'breaker', name: 'THE BREAKER', desc: 'Black and red. For winning a run at BREAK 1 or higher.', unlock: { ach: 'breaker' },
    paint: (x, w, h) => {
      band(x, w, 0, h, '#0c0c10');
      for (let y = 8; y < h - 20; y += 22) { band(x, w, y, 6, '#c01020'); band(x, w, y + 7, 1, '#ff6060'); }
      band(x, w, 96, 8, '#e8e0d0');
      tip(x, w, h, '#f0ece0', '#c01020');
    },
    mat: { emissive: 0.1 },
  },
  {
    id: 'golden', name: 'GOLDEN CUE', desc: 'For those who beat the House.', unlock: { ach: 'champion' },
    paint: (x, w, h) => {
      metal(x, w, 0, h, [180, 120, 20], [255, 220, 110]);
      for (let y = 20; y < h - 30; y += 30) band(x, w, y, 2, '#fff8c0');
      tip(x, w, h, '#fff8e0', '#c08010');
    },
    mat: { emissive: 0.3, gloss: 1.4, shine: 100 },
  },
  {
    id: 'eight', name: 'THE EIGHT', desc: 'Black lacquer with an 8 on the butt. It was always the 8.', unlock: { ach: 'eights' },
    paint: (x, w, h) => {
      band(x, w, 0, h - 10, '#0c0c10');
      x.fillStyle = '#f4f0e6'; x.beginPath(); x.ellipse(w / 2, 26, 6, 9, 0, 0, 7); x.fill();
      x.fillStyle = '#0c0c10'; x.font = 'bold 9px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('8', w / 2, 27);
      band(x, w, 100, 2, '#f4f0e6');
      tip(x, w, h, '#f4f0e6', '#0c0c10');
    },
    mat: { gloss: 1.2, shine: 90 },
  },
  {
    id: 'fineprint', name: 'THE FINE PRINT', desc: 'Covered in tiny clauses nobody reads. For five completed contracts.', unlock: { ach: 'contractor' },
    paint: (x, w, h) => {
      band(x, w, 0, h, '#f0ead8');
      const r = rng(21);
      x.fillStyle = '#3a3428';
      for (let y = 4; y < h - 12; y += 3) for (let i = 1; i < w - 1; i += 2) if (r() > 0.35) x.fillRect(i, y, 1, 1);
      band(x, w, 96, 6, '#1a1408');
      tip(x, w, h, '#fff8e8', '#1a1408');
    },
  },
  {
    id: 'grudge', name: 'GRUDGE', desc: 'Scratched with a tally of every loss. For beating your Nemesis.', unlock: { ach: 'nemesis' },
    paint: (x, w, h) => {
      band(x, w, 0, h, '#180808');
      x.fillStyle = '#c02020';
      for (let y = 10; y < h - 20; y += 12) { for (let i = 0; i < 4; i++) x.fillRect(2 + i * 3, y, 1, 7); x.fillRect(1, y + 3, 12, 1); }
      tip(x, w, h, '#e8d8c8', '#c02020');
    },
    mat: { emissive: 0.15 },
  },
  // ---- (these stay out of every list until their mode is found)
  {
    id: 'missile', name: 'MISSILE', desc: 'Stencilled, finned and very much not regulation. Richard signed it.', unlock: { ach: 'intercepted' }, rajis: true,
    paint: (x, w, h) => {
      band(x, w, 0, h, '#e8e8e0');
      band(x, w, 0, 18, '#303830');
      for (let y = 30; y < h - 30; y += 40) band(x, w, y, 3, '#c02020');
      x.fillStyle = '#303830'; x.fillRect(w / 2 - 2, 60, 4, 30);
      tip(x, w, h, '#c02020', '#c02020');
    },
    mat: { emissive: 0.1 },
  },
  {
    id: 'radar', name: 'RADAR', desc: 'Phosphor green, with a sweep that runs down the shaft.', unlock: { ach: 'supply_chain' }, rajis: true, animated: true,
    paint: (x, w, h) => {
      band(x, w, 0, h, '#061408');
      x.fillStyle = 'rgba(143,209,79,0.55)';
      for (let y = 0; y < h - 10; y += 10) x.fillRect(0, y, w, 1);
      for (let i = 0; i < w; i += 4) x.fillRect(i, 0, 1, h - 10);
      tip(x, w, h, '#8fd14f', '#061408');
    },
    mat: { emissive: 0.45 }, anim: { kind: 'glint', speed: 0.5, color: 0x8fd14f },
  },
  {
    id: 'cyberbullet', name: 'CYBER BULLET', desc: 'Grey paint, a racing stripe and two red tail lights on the butt.', unlock: { ach: 'machine_learning' }, rajis: true,
    paint: (x, w, h) => {
      metal(x, w, 0, h, [70, 74, 80], [150, 154, 160]);
      band(x, w, 0, 4, '#ff2020');
      x.fillStyle = '#e8ecf0'; x.fillRect(w / 2 - 1, 8, 2, h - 30);
      tip(x, w, h, '#e8ecf0', '#2a2e36');
    },
    mat: { emissive: 0.15 },
  },
  {
    id: 'stripe', name: 'WARNING STRIPE', desc: 'Black and yellow all the way down. Heavy machinery.', unlock: { ach: 'heavy_industry' }, rajis: true,
    paint: (x, w, h) => {
      for (let y = 0; y < h - 10; y += 2) { const k = Math.floor((y / 2) / 4) % 2; x.fillStyle = k ? '#f5c542' : '#141414'; x.fillRect(0, y, w, 2); }
      tip(x, w, h, '#f5c542', '#141414');
    },
    mat: { emissive: 0.1 },
  },
];
for (const c of CUE_SKINS) if (c.tipPaint) { const p = c.paint, [f, t] = c.tipPaint; c.paint = (x, w, h) => { p(x, w, h); tip(x, w, h, f, t); }; }
export const CUE_RENAMED = { neon: 'volt', flame: 'ember', glitch: 'void' };

// ---------------------------------------------------------------------------
// FELTS — the cloth, separate from the room. 'theme' keeps each table's own.
// fx: a very quiet animated layer on the cloth (never over the balls' contrast)
export const FELTS = [
  { id: 'theme', name: 'CLUB DEFAULT', desc: 'Whatever cloth each room comes with.', unlock: { level: 1 }, rogueOnly: true },
  { id: 'green', name: 'EMERALD', desc: 'Tournament green. The one your eyes expect.', felt: '#1f6441', cushion: '#1a5537', unlock: { level: 1 }, classy: true },
  { id: 'burgundy', name: 'BURGUNDY', desc: 'Deep wine red, like an old private club.', felt: '#6a1c29', cushion: '#581722', unlock: { level: 3 }, classy: true, buy: true },
  { id: 'navy', name: 'NAVY', desc: 'Dark blue and calm. Balls look brighter on it.', felt: '#1c2d57', cushion: '#172649', unlock: { level: 4 }, classy: true, buy: true },
  { id: 'blue', name: 'ROYAL BLUE', desc: 'The bright blue of televised pool. For finishing a Daily Scratch.', felt: '#1d5a8f', cushion: '#184c79', unlock: { ach: 'daily' }, classy: true },
  { id: 'black', name: 'BLACK', desc: 'Black cloth. Everything on it looks expensive.', felt: '#1d1d20', cushion: '#18181a', unlock: { level: 7 }, classy: true, buy: true },
  { id: 'red', name: 'CHAMPIONSHIP RED', desc: 'A red you only see at finals.', felt: '#7a1a1e', cushion: '#661519', unlock: { clevel: 3 }, classy: true },
  { id: 'teal', name: 'TEAL', desc: 'Somewhere between the green and the blue.', felt: '#12575c', cushion: '#0f494d', unlock: { level: 5 }, classy: true, buy: true },
  { id: 'slate', name: 'SLATE GREY', desc: 'Cool grey. Easy on the eyes after midnight.', felt: '#454a50', cushion: '#3a3e43', unlock: { clevel: 5 }, classy: true },
  { id: 'tournament', name: 'TOURNAMENT', desc: 'Championship blue-green with a gold head string. For winning a Classic tournament.', felt: '#16585e', cushion: '#124a4f', unlock: { ach: 'tourney' }, classy: true, line: '#c8a24a' },
  { id: 'afterhours', name: 'AFTERHOURS', desc: 'Worn green cloth. Now and then a lamp passes over it that is not in the room.', felt: '#0f5a34', cushion: '#0b4428', unlock: { ach: 'last_game' }, animated: true, fx: 'sweep' },
  { id: 'arcade', name: 'ARCADE', desc: 'Purple cloth with the odd pixel of light glinting in the weave.', felt: '#3a2ab0', cushion: '#2a1e8a', unlock: { level: 10 }, animated: true, fx: 'sparkle' },
  { id: 'tactical', name: 'TACTICAL', desc: 'Olive cloth with a map grid and a radar sweep. Command issue.', felt: '#34401e', cushion: '#262f14', unlock: { ach: 'system_online' }, rajis: true, animated: true, fx: 'radar' },
];

// SHOT TRAILS — a fast-fading line behind moving balls (never over them)
export const TRAILS = [
  { id: 'off', name: 'NO TRAIL', desc: 'Clean. Just the balls.', unlock: { level: 1 }, classy: true },
  { id: 'light', name: 'LIGHT', desc: 'A soft ribbon in each ball’s own colour.', unlock: { level: 1 } },
  { id: 'pixel', name: 'PIXEL', desc: 'Square pixels left behind like a crashing sprite.', unlock: { level: 4 } },
  { id: 'electric', name: 'ELECTRIC', desc: 'A thin blue ribbon that crackles at speed.', unlock: { level: 9 }, animated: true },
  { id: 'fire', name: 'FIRE', desc: 'Embers that burn out in a blink.', unlock: { ach: 'nuclear' }, animated: true },
  { id: 'void', name: 'VOID', desc: 'A dark violet wake with motes falling into it.', unlock: { level: 19 }, animated: true },
  { id: 'radar', name: 'RADAR', desc: 'A dotted green track, like a blip being followed.', unlock: { ach: 'supply_chain' }, rajis: true },
];

// POCKET EFFECTS — only when a ball actually drops
export const POCKET_FX = [
  { id: 'classic', name: 'CLASSIC BURST', desc: 'A burst of colour and a ring of light.', unlock: { level: 1 } },
  { id: 'quiet', name: 'QUIET', desc: 'Just the sound of the ball dropping.', unlock: { level: 1 }, classy: true },
  { id: 'pixel', name: 'PIXEL BURST', desc: 'Chunky square pixels, straight out of the cartridge.', unlock: { level: 3 } },
  { id: 'sparks', name: 'SPARKS', desc: 'A short fan of bright sparks.', unlock: { level: 7 } },
  { id: 'neon', name: 'NEON FLASH', desc: 'The pocket flashes pink and cyan.', unlock: { level: 10 } },
  { id: 'holo', name: 'HOLO RIPPLE', desc: 'Three cyan rings ripple out across the felt.', unlock: { level: 13 }, animated: true },
  { id: 'smoke', name: 'SMOKE', desc: 'A puff of smoke rises from the pocket. For scratching ten times.', unlock: { ach: 'scratch_master' } },
  { id: 'lockon', name: 'LOCK-ON', desc: 'Target brackets snap shut on the pocket. TARGET DESTROYED.', unlock: { ach: 'intercepted' }, rajis: true },
];

// tag each cosmetic with its kind so unlock keys never collide (e.g. chrome balls vs chrome cue)
THEMES.forEach(t => { t.kind = 'theme'; });
BALL_SKINS.forEach(b => { b.kind = 'ball'; });
CUE_SKINS.forEach(c => { c.kind = 'cue'; });
FELTS.forEach(f => { f.kind = 'felt'; });
TRAILS.forEach(f => { f.kind = 'trail'; });
POCKET_FX.forEach(f => { f.kind = 'pocket'; });

export function themeById(id) { return THEMES.find(t => t.id === id) || THEMES[0]; }
export function ballSkinById(id) { id = BALL_RENAMED[id] || id; return BALL_SKINS.find(t => t.id === id) || BALL_SKINS[0]; }
export function cueSkinById(id) { id = CUE_RENAMED[id] || id; return CUE_SKINS.find(t => t.id === id) || CUE_SKINS[0]; }
export function feltById(id) { return FELTS.find(t => t.id === id) || FELTS[0]; }
export function trailById(id) { return TRAILS.find(t => t.id === id) || TRAILS[1]; }
export function pocketFxById(id) { return POCKET_FX.find(t => t.id === id) || POCKET_FX[0]; }

// every cosmetic list by kind (loadout, collection, unlock notices)
export const COSMETICS = { ball: BALL_SKINS, cue: CUE_SKINS, felt: FELTS, trail: TRAILS, pocket: POCKET_FX, theme: THEMES };
export const KIND_NAME = { ball: 'BALLS', cue: 'CUE', felt: 'FELT', trail: 'TRAIL', pocket: 'POCKET FX', theme: 'TABLE' };
