// Table themes, ball skins and cue skins. All cosmetic: they swap textures,
// shader parameters, lights and props on the same geometry.

import { ballColor } from '../config.js';
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
    id: 'command', name: 'COMMAND', desc: 'Radar screens, warning lights and a map table that is also a pool table.',
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
// BALL SKINS
const solid = (n) => ballColor(n);
const neonCols = ['#fff', '#ffe23b', '#2b9bff', '#ff2b4a', '#b03bff', '#ff8a1b', '#2bff7a', '#ff2bd6', '#111'];

export const BALL_SKINS = [
  { id: 'classic', name: 'CLASSIC', desc: 'Phenolic resin. Timeless.', unlock: { level: 1 }, tex: {}, mat: {} },
  {
    id: 'neon', name: 'NEON', desc: 'Glow-in-the-dark club set.', unlock: { level: 2 },
    tex: { color: n => n === 8 ? '#141018' : neonCols[((n - 1) % 7) + 1], white: '#1a1024', numBg: '#1a1024', numFg: '#ffffff', cue: '#e8fbff', cueDot: '#2bf0ff' },
    mat: { emissiveAmt: 0.9, rim: 0xff2bd6, rimAmt: 0.8, reflect: 0.15 }, trail: '#ff2bd6',
  },
  {
    id: 'marble', name: 'MARBLE', desc: 'Cold, heavy, expensive-looking stone.', unlock: { level: 5 },
    tex: {
      pattern: (x, W, H, n, col) => {
        const r = rng(n * 7 + 1);
        x.globalAlpha = 0.45;
        for (let i = 0; i < 14; i++) {
          x.strokeStyle = r() > 0.5 ? '#ffffff' : '#000000';
          x.lineWidth = 1;
          x.beginPath();
          let px = r() * W, py = r() * H;
          x.moveTo(px, py);
          for (let k = 0; k < 8; k++) { px += (r() - 0.3) * 14; py += (r() - 0.5) * 8; x.lineTo(px, py); }
          x.stroke();
        }
        x.globalAlpha = 1;
      },
    },
    mat: { reflect: 0.4, spec: 1.3, rimAmt: 0.2 },
  },
  {
    id: '8bit', name: '8-BIT', desc: 'Rendered on a machine with 2KB of RAM.', unlock: { level: 8 },
    tex: {
      post: (x, W, H) => {
        const d = x.getImageData(0, 0, W, H);
        for (let y = 0; y < H; y += 8) for (let xx = 0; xx < W; xx += 8) {
          const i = (y * W + xx) * 4;
          const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
          x.fillStyle = `rgb(${r & 0xc0 | 0x20},${g & 0xc0 | 0x20},${b & 0xc0 | 0x20})`;
          x.fillRect(xx, y, 8, 8);
        }
      },
    },
    mat: { bands: 2, reflect: 0, spec: 0.6, rimAmt: 0 },
  },
  {
    id: 'galaxy', name: 'GALAXY', desc: 'Each ball contains a small, doomed universe.', unlock: { level: 11 },
    tex: {
      color: n => n === 0 ? '#e8e8ff' : n === 8 ? '#05030c' : ['#1a0840', '#081a4a', '#3a0830', '#08302a', '#2a1a50', '#401010', '#102a40'][(n - 1) % 7],
      white: '#0a0620', numBg: '#e0d8ff', numFg: '#1a0840',
      pattern: (x, W, H, n) => {
        const r = rng(n * 31 + 5);
        for (let i = 0; i < 12; i++) {
          const g = x.createRadialGradient(r() * W, r() * H, 0, r() * W, r() * H, 18);
          g.addColorStop(0, r() > 0.5 ? 'rgba(255,60,200,0.35)' : 'rgba(60,160,255,0.35)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = g; x.fillRect(0, 0, W, H);
        }
      },
    },
    mat: { fx: 1, rim: 0x8060ff, rimAmt: 0.7, reflect: 0.25, emissiveAmt: 0.35 }, trail: '#8060ff',
  },
  {
    id: 'toxic', name: 'TOXIC', desc: 'Do not lick. Do not pot the green one.', unlock: { level: 14 },
    tex: {
      color: n => n === 0 ? '#e8ffd0' : n === 8 ? '#0a1a04' : ['#8aff00', '#d4ff00', '#30ff60', '#a0ff40', '#60d000', '#f0ff60', '#00ff90'][(n - 1) % 7],
      white: '#1a2a08', numBg: '#101a04', numFg: '#b0ff30',
      pattern: (x, W, H, n) => {
        const r = rng(n * 13 + 2);
        for (let i = 0; i < 20; i++) { x.fillStyle = 'rgba(10,40,0,0.5)'; x.beginPath(); x.arc(r() * W, r() * H, 1 + r() * 3, 0, 7); x.fill(); }
      },
    },
    mat: { fx: 2, rim: 0x80ff20, rimAmt: 0.9, emissiveAmt: 0.55, reflect: 0.1 }, trail: '#80ff20',
  },
  {
    id: 'orbs', name: 'ENERGY ORBS', desc: 'Collect all seven. Something might happen.', unlock: { level: 16 },
    tex: {
      color: n => n === 0 ? '#fff8e0' : n === 8 ? '#301000' : '#ff9a10',
      white: '#ffb830', numbers: false,
      pattern: (x, W, H, n) => {
        if (n === 0) return;
        const stars = n === 8 ? 8 : ((n - 1) % 7) + 1;
        x.fillStyle = '#e01010';
        const star = (cx, cy, s) => {
          x.beginPath();
          for (let k = 0; k < 10; k++) {
            const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? s * 0.45 : s;
            x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9);
          }
          x.fill();
        };
        for (const u of [0.25, 0.75]) for (let k = 0; k < stars; k++) {
          const a = (k / stars) * Math.PI * 2;
          const rr = stars === 1 ? 0 : 7;
          star(u * W + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr * 0.8, 4);
        }
      },
    },
    mat: { fx: 3, rim: 0xffd040, rimAmt: 1.0, emissiveAmt: 0.5, reflect: 0.3, opacity: 0.85 }, trail: '#ffb020',
  },
  {
    id: 'gold', name: 'GOLD', desc: 'Solid gold. Terribly impractical.', unlock: { ach: 'gold_rush' },
    tex: {
      color: n => n === 0 ? '#fff4d0' : n === 8 ? '#2a1a00' : ['#ffd040', '#e0a020', '#ffe070', '#c08010', '#ffc030', '#d09020', '#fff0a0'][(n - 1) % 7],
      white: '#fff0c0', numBg: '#2a1a00', numFg: '#ffd040',
    },
    mat: { reflect: 0.75, spec: 1.6, rim: 0xffd040, rimAmt: 0.6, tint: 0xffe8a0 }, trail: '#ffd040',
  },
  {
    id: 'chrome', name: 'CHROME', desc: 'Liquid metal. Reflects your mistakes.', unlock: { ach: 'boss_slayer' },
    tex: { color: n => n === 8 ? '#303038' : '#c8ccd8', white: '#e8ecf4', numBg: '#101018', numFg: '#e8ecf4', cueDot: false },
    mat: { reflect: 0.95, spec: 2.0, rimAmt: 0.3, bands: 5 },
  },
  {
    id: 'blood', name: 'BLOOD', desc: 'Awarded for your many, many scratches.', unlock: { ach: 'scratch_master' },
    tex: {
      color: n => n === 0 ? '#f0e0e0' : n === 8 ? '#0a0000' : ['#a00010', '#600008', '#d01020', '#400004', '#ff2030', '#800010', '#300000'][(n - 1) % 7],
      white: '#e8d8d0', numBg: '#1a0000', numFg: '#ff3030',
      pattern: (x, W, H, n) => {
        const r = rng(n * 3 + 9);
        x.fillStyle = '#5a0006';
        for (let i = 0; i < 6; i++) { const px = r() * W; x.fillRect(px, 0, 2, 4 + r() * 16); x.beginPath(); x.arc(px + 1, 4 + r() * 16, 2, 0, 7); x.fill(); }
      },
    },
    mat: { reflect: 0.35, spec: 1.4, rim: 0xff0020, rimAmt: 0.5 }, trail: '#ff0020',
  },
  {
    id: 'eyes', name: 'EYEBALLS', desc: 'They are watching the shot too.', unlock: { ach: 'how' },
    tex: {
      color: () => '#f4f0ec', white: '#f4f0ec', numbers: false, cueDot: false,
      pattern: (x, W, H, n) => {
        const iris = n === 0 ? '#60c0ff' : n === 8 ? '#000000' : ballColor(n);
        // veins
        const r = rng(n * 5 + 3);
        x.strokeStyle = 'rgba(200,20,30,0.6)';
        for (let i = 0; i < 10; i++) {
          x.beginPath(); let px = r() * W, py = r() > 0.5 ? 0 : H; x.moveTo(px, py);
          for (let k = 0; k < 5; k++) { px += (r() - 0.5) * 12; py += (py < H / 2 ? 1 : -1) * 4; x.lineTo(px, py); }
          x.stroke();
        }
        const cx = W * 0.25, cy = H / 2;
        x.fillStyle = iris; x.beginPath(); x.ellipse(cx, cy, 13, 12, 0, 0, 7); x.fill();
        x.fillStyle = '#000'; x.beginPath(); x.ellipse(cx, cy, 6, 6, 0, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.fillRect(cx - 4, cy - 5, 3, 3);
        if (n > 0 && n !== 8) {
          x.fillStyle = '#111'; x.font = 'bold 7px "Press Start 2P", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText(String(n), W * 0.75, H / 2);
        }
      },
    },
    mat: { reflect: 0.3, spec: 1.6, rimAmt: 0.2 },
  },
  {
    id: 'glass', name: 'GLASS', desc: 'Fragile-looking. Perfectly unbreakable. Probably.', unlock: { ach: 'perfect' },
    tex: { white: '#dff4ff', numBg: '#dff4ff' },
    mat: { opacity: 0.45, reflect: 0.6, spec: 1.8, rim: 0xa0e0ff, rimAmt: 0.9 }, trail: '#a0e0ff',
  },
  {
    id: 'molten', name: 'MOLTEN', desc: 'Cooled rock with a furnace inside. For those who ran it at HEAT V.', unlock: { ach: 'too_hot' },
    tex: {
      color: n => n === 0 ? '#3a3230' : '#1c1614', white: '#2a2220', numBg: '#ff6a10', numFg: '#1a0800', cue: '#4a403c', cueDot: '#ff6a10',
      pattern: (x, W, H, n) => {
        const r = rng(n * 11 + 5);
        x.strokeStyle = n === 8 ? '#ff2010' : '#ff7a18'; x.lineWidth = 1.5;
        for (let i = 0; i < 9; i++) {
          x.beginPath(); let px = r() * W, py = r() * H; x.moveTo(px, py);
          for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 20; py += (r() - 0.5) * 14; x.lineTo(px, py); }
          x.stroke();
        }
      },
    },
    mat: { emissive: 0xff6a10, emissiveAmt: 0.35, reflect: 0.2, spec: 1.2, rim: 0xff4010, rimAmt: 0.6 }, trail: '#ff5010',
  },
  {
    id: 'daybreak', name: 'DAYBREAK', desc: 'Pastel morning colours. Earned by finishing a Daily Scratch.', unlock: { ach: 'daily' },
    tex: { color: n => n === 0 ? '#fff8f0' : n === 8 ? '#3a3050' : ['#ffd8a0', '#a8c8ff', '#ffa8b0', '#c8b0ff', '#ffc890', '#a8e8c0', '#e8a0a8'][(n - 1) % 7], white: '#fff8f0', numBg: '#fff8f0', numFg: '#3a3050' },
    mat: { reflect: 0.25, spec: 1.1, rim: 0xffc0a0, rimAmt: 0.4 }, trail: '#ffc8a0',
  },
  {
    id: 'eights', name: 'ALL EIGHTS', desc: 'It is always the 8. It was always the 8.', unlock: { ach: 'eights' },
    tex: { color: n => n === 0 ? '#f4f0e6' : '#101014', white: '#f4f0e6', numBg: '#f4f0e6', numFg: '#101014' },
    mat: { reflect: 0.3, spec: 1.4, rim: 0x7060ff, rimAmt: 0.5 }, trail: '#7060ff',
  },
  {
    id: 'alchemy', name: 'ALCHEMY', desc: 'Swirled metals that never quite settle. For finding five hidden synergies.', unlock: { ach: 'synergist' },
    tex: {
      color: n => n === 0 ? '#f0f4ff' : n === 8 ? '#141018' : ['#c08a30', '#6ab0c0', '#b04a6a', '#80a040', '#a060c0', '#d0a050', '#4a8aa0'][(n - 1) % 7],
      white: '#e8e0d0', numBg: '#201810', numFg: '#ffe0a0',
      pattern: (x, W, H, n) => {
        const r = rng(n * 19 + 7);
        x.globalAlpha = 0.5;
        for (let i = 0; i < 10; i++) { x.strokeStyle = r() > 0.5 ? '#ffe8a0' : '#40ffe0'; x.beginPath(); x.arc(r() * W, r() * H, 3 + r() * 10, 0, 3 + r() * 3); x.stroke(); }
        x.globalAlpha = 1;
      },
    },
    mat: { reflect: 0.55, spec: 1.6, rim: 0x40ffe0, rimAmt: 0.6, fx: 1 }, trail: '#40ffe0',
  },
  // ---- (these stay out of every list until their mode is found)
  {
    id: 'radar', name: 'RADAR', desc: 'Green phosphor targets with a sweep line that never stops.', unlock: { ach: 'supply_chain' }, rajis: true,
    tex: {
      color: n => n === 0 ? '#e8ffe0' : n === 8 ? '#041004' : '#0c2a0c', white: '#081808', numBg: '#8fd14f', numFg: '#041004',
      pattern: (x, W, H) => { x.strokeStyle = 'rgba(143,209,79,0.8)'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(W * 0.25, H / 2, 4 + i * 5, 0, 7); x.stroke(); } x.fillStyle = 'rgba(143,209,79,0.6)'; x.fillRect(W * 0.25, H / 2 - 1, 14, 2); },
    },
    mat: { emissive: 0x8fd14f, emissiveAmt: 0.45, rim: 0x8fd14f, rimAmt: 0.7, reflect: 0.2, fx: 2 }, trail: '#8fd14f',
  },
  {
    id: 'robot', name: 'ROBOT', desc: 'Brushed steel with one red eye. Two of a kind.', unlock: { ach: 'paulyamin' }, rajis: true,
    tex: {
      color: n => n === 0 ? '#e0e4ec' : '#8a909c', white: '#c0c4cc', numbers: false, cueDot: false,
      pattern: (x, W, H, n) => {
        x.fillStyle = '#50545c'; for (let i = 0; i < W; i += 8) x.fillRect(i, 0, 1, H);
        x.fillStyle = n === 0 ? '#2bf0ff' : '#ff2020'; x.fillRect(W * 0.25 - 4, H / 2 - 2, 8, 4);
        x.fillStyle = '#ffffff'; x.fillRect(W * 0.25 - 3, H / 2 - 1, 2, 1);
      },
    },
    mat: { reflect: 0.7, spec: 1.8, rim: 0xff2020, rimAmt: 0.4, bands: 5 }, trail: '#ff2020',
  },
];

// ---------------------------------------------------------------------------
// CUE SKINS  (paint: x, w, h — v runs butt (0) → tip (h))
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

export const CUE_SKINS = [
  {
    id: 'wood', name: 'CLASSIC WOOD', desc: 'Maple shaft, ebony butt. The honest choice.', unlock: { level: 1 },
    paint: (x, w, h) => {
      woodGrain(x, w, h, 0, 100, '#2a120a', '#120604');
      band(x, w, 100, 6, '#e8dcc0');
      for (let i = 0; i < 4; i++) { x.fillStyle = '#e8dcc0'; x.beginPath(); x.moveTo(i * 4, 100); x.lineTo(i * 4 + 2, 60); x.lineTo(i * 4 + 4, 100); x.fill(); }
      woodGrain(x, w, h, 106, h - 10, '#e8c890', '#b89060');
      band(x, w, 20, 2, '#c0a060'); band(x, w, 24, 1, '#c0a060');
      tip(x, w, h);
    },
  },
  {
    id: 'neon', name: 'NEON', desc: 'A tube of pink gas with delusions of grandeur.', unlock: { level: 3 },
    paint: (x, w, h) => {
      band(x, w, 0, h, '#16081e');
      for (let y = 0; y < h - 10; y += 16) { band(x, w, y, 3, '#ff2bd6'); band(x, w, y + 8, 2, '#2bf0ff'); }
      tip(x, w, h, '#ffffff', '#ff2bd6');
    },
    mat: { emissive: 0.9 }, trail: { color: '#ff2bd6', kind: 'spark' },
  },
  {
    id: 'bone', name: 'BONE CUE', desc: 'Carved from something large. Do not ask.', unlock: { level: 6 },
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
    id: 'chrome', name: 'CHROME', desc: 'Polished to a mirror. Hands off.', unlock: { level: 9 },
    paint: (x, w, h) => {
      for (let i = 0; i < w; i++) { const v = 120 + Math.sin(i / w * Math.PI * 2) * 100; x.fillStyle = `rgb(${v},${v + 5},${v + 15})`; x.fillRect(i, 0, 1, h); }
      band(x, w, 90, 4, '#303038');
      tip(x, w, h, '#ffffff', '#303038');
    },
    mat: { emissive: 0.3 },
  },
  {
    id: 'katana', name: 'KATANA', desc: 'Folded one thousand times. Cuts the cloth.', unlock: { level: 12 },
    paint: (x, w, h) => {
      band(x, w, 0, 90, '#101010');
      for (let y = 0; y < 90; y += 6) { x.fillStyle = '#c0a030'; x.fillRect(0, y, w, 1); x.fillStyle = '#301818'; x.fillRect(w / 2 - 2, y + 1, 4, 3); }
      band(x, w, 90, 8, '#c0a030');
      for (let i = 0; i < w; i++) { const v = 170 + Math.sin(i / w * Math.PI * 2) * 70; x.fillStyle = `rgb(${v},${v},${v + 10})`; x.fillRect(i, 98, 1, h - 98); }
      band(x, w, h - 40, 1, '#ffffff');
      tip(x, w, h, '#e0e0e8', '#e0e0e8');
    },
    trail: { color: '#e0f0ff', kind: 'slash' },
  },
  {
    id: 'flame', name: 'FLAMING CUE', desc: 'Hot rod decals. Actually on fire.', unlock: { level: 15 },
    paint: (x, w, h) => {
      band(x, w, 0, h, '#140404');
      const r = rng(8);
      for (let y = 0; y < 150; y += 2) {
        const k = y / 150;
        x.fillStyle = k < 0.5 ? '#ff3010' : k < 0.8 ? '#ff9010' : '#ffe040';
        const fw = (1 - k) * w * (0.6 + r() * 0.4);
        x.fillRect((w - fw) / 2, y, fw, 2);
      }
      tip(x, w, h, '#ffe0a0', '#ff3010');
    },
    mat: { emissive: 0.5 }, trail: { color: '#ff6010', kind: 'fire' },
  },
  {
    id: 'glitch', name: 'GLITCH CUE', desc: 'ERR_CUE_NOT_FOUND. Shoots fine though.', unlock: { level: 18 },
    paint: (x, w, h) => {
      const r = rng(66);
      for (let y = 0; y < h; y += 2) {
        const c = ['#ff00ff', '#00ffff', '#ffffff', '#101010', '#00ff40'][(r() * 5) | 0];
        x.fillStyle = r() > 0.6 ? c : '#101018';
        x.fillRect(0, y, w, 2);
      }
      tip(x, w, h, '#00ffff', '#ff00ff');
    },
    mat: { emissive: 0.6, glitch: true }, trail: { color: '#00ffff', kind: 'glitch' },
  },
  {
    id: 'dragon', name: 'DRAGON', desc: 'Scales that shimmer red and gold.', unlock: { ach: 'nuclear' },
    paint: (x, w, h) => {
      band(x, w, 0, h - 10, '#500808');
      for (let y = 0; y < h - 20; y += 5) for (let i = (y / 5 % 2) * 2; i < w; i += 4) {
        x.fillStyle = '#c02010'; x.fillRect(i, y, 3, 3); x.fillStyle = '#ffc040'; x.fillRect(i, y, 1, 1);
      }
      band(x, w, 100, 6, '#ffc040');
      tip(x, w, h, '#ffe8a0', '#801010');
    },
    mat: { emissive: 0.25 }, trail: { color: '#ff4020', kind: 'fire' },
  },
  {
    id: 'glass', name: 'TRANSPARENT', desc: 'A crystal cue. You can see the balls through it.', unlock: { ach: 'ghost' },
    paint: (x, w, h) => {
      band(x, w, 0, h, '#c0f0ff');
      for (let y = 0; y < h; y += 12) band(x, w, y, 1, '#ffffff');
      tip(x, w, h, '#ffffff', '#80c0ff');
    },
    mat: { opacity: 0.45, emissive: 0.4 }, trail: { color: '#a0e0ff', kind: 'spark' },
  },
  {
    id: 'breaker', name: 'THE BREAKER', desc: 'Black and red. For winning a run at BREAK 1 or higher.', unlock: { ach: 'breaker' },
    paint: (x, w, h) => {
      band(x, w, 0, h, '#0c0c10');
      for (let y = 8; y < h - 20; y += 22) { band(x, w, y, 6, '#c01020'); band(x, w, y + 7, 1, '#ff6060'); }
      band(x, w, 96, 8, '#e8e0d0');
      tip(x, w, h, '#f0ece0', '#c01020');
    },
    mat: { emissive: 0.15 }, trail: { color: '#ff2030', kind: 'spark' },
  },
  {
    id: 'golden', name: 'GOLDEN CUE', desc: 'For those who beat the House.', unlock: { ach: 'champion' },
    paint: (x, w, h) => {
      for (let i = 0; i < w; i++) { const v = Math.sin(i / w * Math.PI * 2); x.fillStyle = `rgb(${220 + v * 35},${170 + v * 40},${40 + v * 30})`; x.fillRect(i, 0, 1, h); }
      for (let y = 20; y < h - 30; y += 30) band(x, w, y, 2, '#fff8c0');
      tip(x, w, h, '#fff8e0', '#c08010');
    },
    mat: { emissive: 0.45 }, trail: { color: '#ffd040', kind: 'spark' },
  },
];

CUE_SKINS.push(
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
    mat: { emissive: 0.2 }, trail: { color: '#c02020', kind: 'spark' },
  },
  {
    id: 'missile', name: 'MISSILE', desc: 'Stencilled, finned and very much not regulation.', unlock: { ach: 'intercepted' }, rajis: true,
    paint: (x, w, h) => {
      band(x, w, 0, h, '#e8e8e0');
      band(x, w, 0, 18, '#303830');
      for (let y = 30; y < h - 30; y += 40) { band(x, w, y, 3, '#c02020'); }
      x.fillStyle = '#303830'; x.font = '6px monospace'; x.fillRect(w / 2 - 2, 60, 4, 30);
      tip(x, w, h, '#c02020', '#c02020');
    },
    mat: { emissive: 0.15 }, trail: { color: '#ff3b30', kind: 'fire' },
  },
  {
    id: 'cyberbullet', name: 'CYBER BULLET', desc: 'Grey paint, a racing stripe and two red tail lights on the butt.', unlock: { ach: 'machine_learning' }, rajis: true,
    paint: (x, w, h) => {
      for (let i = 0; i < w; i++) { const v = 110 + Math.sin(i / w * Math.PI * 2) * 40; x.fillStyle = `rgb(${v},${v + 4},${v + 10})`; x.fillRect(i, 0, 1, h); }
      band(x, w, 0, 4, '#ff2020');
      x.fillStyle = '#e8ecf0'; x.fillRect(w / 2 - 1, 8, 2, h - 30);
      tip(x, w, h, '#e8ecf0', '#2a2e36');
    },
    mat: { emissive: 0.25 }, trail: { color: '#c8ccd8', kind: 'spark' },
  },
  {
    id: 'stripe', name: 'WARNING STRIPE', desc: 'Black and yellow all the way down. Heavy machinery.', unlock: { ach: 'heavy_industry' }, rajis: true,
    paint: (x, w, h) => {
      for (let y = 0; y < h - 10; y += 2) { const k = Math.floor((y / 2) / 4) % 2; x.fillStyle = k ? '#f5c542' : '#141414'; x.fillRect(0, y, w, 2); }
      tip(x, w, h, '#f5c542', '#141414');
    },
    mat: { emissive: 0.15 }, trail: { color: '#f5c542', kind: 'spark' },
  },
);

// tag each cosmetic with its kind so unlock keys never collide (e.g. chrome balls vs chrome cue)
THEMES.forEach(t => { t.kind = 'theme'; });
BALL_SKINS.forEach(b => { b.kind = 'ball'; });
CUE_SKINS.forEach(c => { c.kind = 'cue'; });

export function themeById(id) { return THEMES.find(t => t.id === id) || THEMES[0]; }
export function ballSkinById(id) { return BALL_SKINS.find(t => t.id === id) || BALL_SKINS[0]; }
export function cueSkinById(id) { return CUE_SKINS.find(t => t.id === id) || CUE_SKINS[0]; }
