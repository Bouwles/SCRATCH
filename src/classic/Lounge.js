// The private billiards lounge for SCRATCH CLASSIC: walnut, brass, leather,
// warm pendant light over the table, a quiet bar, the city beyond the glass.
// Built from the same shader family as the club, always in its modern path.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ps1Material, disposeTree } from '../render/materials.js';
import { canvas, toTex, rng, glowTexture, coneTexture } from '../render/textures.js';
import { FLOOR_Y } from '../world/Table.js';
import { cueSkin } from './look.js';

const RX = 5.2, RZ = 4.2, CEIL = 2.15;
const H = CEIL - FLOOR_Y;
const WAINS = 1.0;                // wainscot height
export const PENDANTS = [-0.66, 0, 0.66];
const LAMP_Y = 1.08;

// ------------------------------------------------------------ textures
function tex(w, h, paint, opts) { const c = canvas(w, h), x = c.getContext('2d'); paint(x, w, h); return toTex(c, opts); }
function noise(x, w, h, amt, seed) {
  const d = x.getImageData(0, 0, w, h), r = rng(seed);
  for (let i = 0; i < d.data.length; i += 4) { const n = 1 + (r() - 0.5) * amt; d.data[i] *= n; d.data[i + 1] *= n; d.data[i + 2] *= n; }
  x.putImageData(d, 0, 0);
}
function grainLines(x, x0, y0, w, h, dark, light, seed, n = 30) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const py = y0 + r() * h, amp = 1 + r() * 2.5, f = 0.01 + r() * 0.02;
    x.strokeStyle = r() > 0.5 ? dark : light; x.globalAlpha = 0.12 + r() * 0.2; x.lineWidth = 0.5 + r() * 1.2;
    x.beginPath();
    for (let xx = x0; xx <= x0 + w; xx += 10) x.lineTo(xx, py + Math.sin(xx * f + i) * amp);
    x.stroke();
  }
  x.globalAlpha = 1;
}

const floorTex = () => tex(1024, 1024, (x, w, h) => {
  const r = rng(71), rows = 8, ph = h / rows;
  for (let j = 0; j < rows; j++) {
    let xx = -r() * 400;
    while (xx < w) {
      const len = 300 + r() * 400, k = 0.82 + r() * 0.3;
      x.fillStyle = `rgb(${86 * k | 0},${52 * k | 0},${30 * k | 0})`;
      x.fillRect(xx, j * ph, len, ph);
      grainLines(x, xx, j * ph, len, ph, '#2a160a', '#8a5a36', j * 31 + xx | 0, 10);
      x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(xx, j * ph, 2, ph);
      xx += len;
    }
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(0, j * ph, w, 2);
  }
  noise(x, w, h, 0.06, 5);
});

// three interiors for the same room
export const ROOM_STYLES = {
  lounge: { fabric: '#2a3a31', rug: ['#3e1216', '#171c2c', '#9a7440'], curtain: [62, 16, 22], leather: '#4a1c14', wood: 0xffffff, floor: 0xffffff },
  parlour: { fabric: '#1b2a44', damask: true, rug: ['#16281c', '#3a1418', '#b08a4a'], curtain: [20, 42, 32], leather: '#1f3a2a', wood: 0xd8b898, floor: 0xe0d0c0 },
  loft: { fabric: '#23252b', rug: ['#2a2a2c', '#141416', '#7a7a80'], curtain: [36, 36, 40], leather: '#18181a', wood: 0x6a6a70, floor: 0x7a7a80 },
  hall: { fabric: '#121a2c', rug: ['#16213a', '#0c1222', '#c8a45a'], curtain: [20, 26, 44], leather: '#1a1a1e', wood: 0x8a8a90, floor: 0xa0a0a8, hall: true },
};

// the Tournament Hall's scoreboard
const scoreTex = () => tex(1024, 256, (x, w, h) => {
  x.fillStyle = '#07080c'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#c8a45a'; x.lineWidth = 4; x.strokeRect(8, 8, w - 16, h - 16);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#e4c992'; x.font = '500 34px Inter, Arial, sans-serif'; x.letterSpacing = '14px';
  x.fillText('SCRATCH CLASSIC OPEN', w / 2, 70);
  x.fillStyle = '#f1ebdf'; x.font = '300 92px Inter, Arial, sans-serif'; x.letterSpacing = '6px';
  x.fillText('8 · BALL', w / 2, 168);
}, { wrap: false });
const bannerTex = (i) => tex(128, 512, (x, w, h) => {
  x.fillStyle = ['#141c34', '#2a1418', '#10281e'][i % 3]; x.fillRect(0, 0, w, h);
  x.fillStyle = '#c8a45a'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 40, w, 4);
  x.beginPath(); x.moveTo(0, h - 36); x.lineTo(w / 2, h); x.lineTo(w, h - 36); x.fill();
  x.save(); x.translate(w / 2, h / 2 - 20); x.rotate(-Math.PI / 2);
  x.fillStyle = '#e4c992'; x.font = '500 40px "Cormorant Garamond", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(['EST. 1998', 'CHAMPIONS', 'EIGHT BALL'][i % 3], 0, 0);
  x.restore();
}, { wrap: false });

const rugTex = (st = ROOM_STYLES.lounge) => tex(1024, 736, (x, w, h) => {
  x.fillStyle = st.rug[0]; x.fillRect(0, 0, w, h);
  // lattice of small diamonds, low contrast
  x.strokeStyle = 'rgba(160,110,60,0.13)'; x.lineWidth = 2;
  for (let i = -h; i < w + h; i += 46) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); x.beginPath(); x.moveTo(i + h, 0); x.lineTo(i, h); x.stroke(); }
  // borders
  const b = (m, wdt, col) => { x.strokeStyle = col; x.lineWidth = wdt; x.strokeRect(m, m, w - 2 * m, h - 2 * m); };
  x.fillStyle = st.rug[1];
  x.fillRect(0, 0, w, 58); x.fillRect(0, h - 58, w, 58); x.fillRect(0, 0, 58, h); x.fillRect(w - 58, 0, 58, h);
  b(8, 3, st.rug[2]); b(52, 4, st.rug[2]); b(64, 2, st.rug[2]);
  // border motif
  x.fillStyle = 'rgba(154,116,64,0.55)';
  for (let i = 90; i < w - 60; i += 44) { x.beginPath(); x.arc(i, 29, 6, 0, 7); x.fill(); x.beginPath(); x.arc(i, h - 29, 6, 0, 7); x.fill(); }
  for (let i = 90; i < h - 60; i += 44) { x.beginPath(); x.arc(29, i, 6, 0, 7); x.fill(); x.beginPath(); x.arc(w - 29, i, 6, 0, 7); x.fill(); }
  // medallion
  const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 220);
  g.addColorStop(0, 'rgba(120,70,40,0.35)'); g.addColorStop(1, 'rgba(120,70,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  noise(x, w, h, 0.12, 9);
}, { wrap: false });

const fabricTex = (st = ROOM_STYLES.lounge) => tex(512, 512, (x, w, h) => {
  x.fillStyle = st.fabric; x.fillRect(0, 0, w, h);
  if (st.brick) {
    // exposed brick: staggered courses with dark mortar
    const bh = 32, bw = 96;
    for (let y = 0; y < h; y += bh) {
      const off = (y / bh) % 2 ? bw / 2 : 0;
      for (let xx = -bw; xx < w + bw; xx += bw) {
        const k = 0.8 + ((xx * 7 + y * 13) % 17) / 60;
        x.fillStyle = `rgb(${106 * k | 0},${52 * k | 0},${36 * k | 0})`;
        x.fillRect(xx + off + 3, y + 3, bw - 6, bh - 6);
      }
    }
    x.fillStyle = 'rgba(30,24,20,0.5)';
    for (let y = 0; y < h; y += bh) x.fillRect(0, y, w, 3);
  } else if (st.damask) {
    // a quiet repeating medallion wallpaper
    x.fillStyle = 'rgba(220,200,150,0.08)';
    for (let yy = 0; yy < h; yy += 128) for (let xx = (yy / 128) % 2 ? 64 : 0; xx < w + 64; xx += 128) {
      x.beginPath(); x.ellipse(xx, yy + 64, 22, 40, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(xx, yy + 64, 40, 14, 0, 0, 7); x.fill();
    }
  } else for (let i = 0; i < w; i += 32) { x.fillStyle = 'rgba(210,190,130,0.07)'; x.fillRect(i, 0, 2, h); }
  noise(x, w, h, 0.1, 13);
});

const wainscotTex = () => tex(512, 512, (x, w, h) => {
  x.fillStyle = '#4e2e19'; x.fillRect(0, 0, w, h);
  grainLines(x, 0, 0, w, h, '#1c0e06', '#6e4628', 3, 60);
  // one raised panel per texture tile
  const m = 46;
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(m - 6, m - 6, w - 2 * m + 12, h - 2 * m + 12);
  x.fillStyle = 'rgba(255,220,170,0.08)'; x.fillRect(m - 6, m - 6, w - 2 * m + 12, 5); x.fillRect(m - 6, m - 6, 5, h - 2 * m + 12);
  x.fillStyle = '#5a341c'; x.fillRect(m, m, w - 2 * m, h - 2 * m);
  grainLines(x, m, m, w - 2 * m, h - 2 * m, '#1c0e06', '#6a4428', 7, 30);
  noise(x, w, h, 0.05, 17);
});

const leatherTex = (base = '#4a1c14') => tex(512, 512, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  noise(x, w, h, 0.14, 19);
  // diamond tufting: creases between buttons
  const s = 64;
  x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 3;
  for (let j = 0; j <= h / s * 2; j++) for (let i = 0; i <= w / s; i++) {
    const cx = i * s + (j % 2) * s / 2, cy = j * s / 2;
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + s / 2, cy + s / 2); x.stroke();
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx - s / 2, cy + s / 2); x.stroke();
  }
  for (let j = 0; j <= h / s * 2; j++) for (let i = 0; i <= w / s; i++) {
    const cx = i * s + (j % 2) * s / 2, cy = j * s / 2;
    const g = x.createRadialGradient(cx, cy + 16, 2, cx, cy + 16, 26);
    g.addColorStop(0, 'rgba(255,220,190,0.12)'); g.addColorStop(1, 'rgba(255,220,190,0)');
    x.fillStyle = g; x.fillRect(cx - 30, cy - 10, 60, 60);
    x.fillStyle = 'rgba(0,0,0,0.7)'; x.beginPath(); x.arc(cx, cy, 5, 0, 7); x.fill();
  }
});

const plainLeather = (base) => tex(256, 256, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); noise(x, w, h, 0.14, 23); });

const cityTex = (seed) => tex(512, 1024, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#070a14'); g.addColorStop(0.55, '#141a30'); g.addColorStop(1, '#2a2436');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = rng(seed);
  // far towers
  for (let i = 0; i < 9; i++) {
    const bw = 40 + r() * 90, bx = r() * w, bh = 250 + r() * 500;
    x.fillStyle = `rgba(${10 + r() * 10},${12 + r() * 10},${24 + r() * 14},1)`;
    x.fillRect(bx, h - bh, bw, bh);
    for (let y = h - bh + 12; y < h - 10; y += 16) for (let xx = bx + 6; xx < bx + bw - 6; xx += 12) {
      if (r() < 0.32) { x.fillStyle = r() < 0.8 ? `rgba(255,${190 + r() * 40 | 0},${110 + r() * 40 | 0},${0.35 + r() * 0.4})` : 'rgba(170,200,255,0.5)'; x.fillRect(xx, y, 6, 8); }
    }
  }
  // out-of-focus lights close to the glass
  for (let i = 0; i < 26; i++) {
    const bx = r() * w, by = h * (0.45 + r() * 0.55), rr = 10 + r() * 34;
    const gg = x.createRadialGradient(bx, by, 0, bx, by, rr);
    const warm = r() < 0.7;
    gg.addColorStop(0, warm ? 'rgba(255,190,120,0.28)' : 'rgba(150,180,255,0.24)');
    gg.addColorStop(0.7, warm ? 'rgba(255,170,100,0.12)' : 'rgba(130,160,255,0.1)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gg; x.fillRect(bx - rr, by - rr, rr * 2, rr * 2);
  }
}, { wrap: false });

const curtainTex = (st = ROOM_STYLES.lounge) => tex(256, 512, (x, w, h) => {
  const [cr, cg, cb] = st.curtain;
  for (let i = 0; i < w; i++) {
    const k = 0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(i / w * Math.PI * 7), 1.3);
    x.fillStyle = `rgb(${cr * k | 0},${cg * k | 0},${cb * k | 0})`;
    x.fillRect(i, 0, 1, h);
  }
  noise(x, w, h, 0.08, 29);
}, { wrap: false });

function paintingTex(seed) {
  return tex(512, 384, (x, w, h) => {
    const r = rng(seed);
    const pals = [['#2a1a14', '#8a3a1c', '#c8883a', '#e8c890'], ['#141c22', '#2a4a58', '#b86a3a', '#e0c8a0'], ['#1e1612', '#5a2a22', '#a8743c', '#d8b070']];
    const p = pals[seed % pals.length];
    x.fillStyle = p[0]; x.fillRect(0, 0, w, h);
    // soft colour fields
    for (let i = 0; i < 3; i++) {
      const y0 = 30 + i * (h - 60) / 3 + r() * 10, hh = (h - 80) / 3 - 10;
      x.fillStyle = p[1 + i];
      x.globalAlpha = 0.85;
      x.fillRect(34 + r() * 8, y0, w - 68, hh);
      x.globalAlpha = 1;
    }
    x.filter = 'blur(6px)'; x.drawImage(x.canvas, 0, 0); x.filter = 'none';
    noise(x, w, h, 0.12, seed + 3);
  }, { wrap: false });
}

const marbleTex = () => tex(512, 256, (x, w, h) => {
  x.fillStyle = '#161616'; x.fillRect(0, 0, w, h);
  const r = rng(41);
  for (let i = 0; i < 14; i++) {
    x.strokeStyle = `rgba(220,215,205,${0.08 + r() * 0.15})`; x.lineWidth = 0.6 + r() * 1.4;
    x.beginPath(); let px = r() * w, py = r() * h; x.moveTo(px, py);
    for (let k = 0; k < 10; k++) { px += 20 + r() * 40; py += (r() - 0.5) * 40; x.lineTo(px, py); }
    x.stroke();
  }
  noise(x, w, h, 0.08, 43);
});

const letteringTex = () => tex(1024, 256, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const g = x.createLinearGradient(0, 40, 0, 170);
  g.addColorStop(0, '#f2d9a0'); g.addColorStop(0.5, '#b88a44'); g.addColorStop(1, '#e8c98a');
  x.fillStyle = g;
  x.font = '500 128px "Cormorant Garamond", Georgia, serif';
  x.letterSpacing = '28px';
  x.fillText('SCRATCH', w / 2 + 14, 104);
  x.font = '500 30px "Cormorant Garamond", Georgia, serif';
  x.letterSpacing = '14px';
  x.fillText('BILLIARDS  ·  EST. 1998', w / 2 + 7, 206);
  x.fillRect(w / 2 - 250, 172, 500, 2);
}, { wrap: false });

const leafTex = () => tex(128, 256, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  x.fillStyle = '#1d3a1e';
  x.beginPath(); x.moveTo(w / 2, h); x.quadraticCurveTo(-10, h * 0.45, w / 2, 4); x.quadraticCurveTo(w + 10, h * 0.45, w / 2, h); x.fill();
  x.strokeStyle = 'rgba(160,200,120,0.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, 10); x.stroke();
}, { wrap: false });

// ------------------------------------------------------------ builder
export class Lounge {
  constructor(lights) {
    this.lights = lights;
    this.group = new THREE.Group();
    this.fadeMats = [];
    this.lampFade = 1;
  }

  dispose() { disposeTree(this.group); this.fadeMats = []; }

  build(preset, roomId = 'lounge') {
    disposeTree(this.group);
    this.fadeMats = [];
    this.lampFade = 1;
    this.roomId = roomId;
    const st = ROOM_STYLES[roomId] || ROOM_STYLES.lounge;
    const g = this.group;
    const M = (o) => ps1Material({ affine: 0, ...o });
    const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
    const uvScale = (geo, su, sv) => { const u = geo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * su, u.getY(i) * sv); return geo; };

    // shared materials
    const walnut = M({ map: wainscotTex(), color: st.wood, gloss: 0.35, shine: 40 });
    const trimWood = M({ color: 0x3a2214, gloss: 0.5, shine: 60 });
    const brass = M({ color: 0xb8955a, emissive: 0x100a04, gloss: 1.4, shine: 90 });
    const bronze = M({ color: 0x3a2c1e, gloss: 1.0, shine: 70 });
    const black = M({ color: 0x0c0b0a, gloss: 0.4, shine: 40 });

    // ---- floor + rug
    const floor = add(uvScale(new THREE.PlaneGeometry(RX * 2, RZ * 2), RX, RZ), M({ map: floorTex(), color: st.floor, gloss: 0.35, shine: 45 }), 0, FLOOR_Y, 0);
    floor.rotation.x = -Math.PI / 2;
    const rug = add(new THREE.PlaneGeometry(4.6, 3.3), M({ map: rugTex(st), gloss: 0.02, shine: 4 }), 0, FLOOR_Y + 0.006, 0);
    rug.rotation.x = -Math.PI / 2;

    // ---- walls: panelled wainscot, fabric above, rails and crown
    const fabric = M({ map: fabricTex(st), gloss: st.brick ? 0.02 : 0.05, shine: 8 });
    const walls = [[RX * 2, 0, -RZ, 0], [RX * 2, 0, RZ, Math.PI], [RZ * 2, -RX, 0, Math.PI / 2], [RZ * 2, RX, 0, -Math.PI / 2]];
    for (const [w, x, z, ry] of walls) {
      add(uvScale(new THREE.PlaneGeometry(w, WAINS), w / 0.9, 1), walnut, x, FLOOR_Y + WAINS / 2, z, ry);
      add(uvScale(new THREE.PlaneGeometry(w, H - WAINS), w / 1.2, (H - WAINS) / 1.2), fabric, x, FLOOR_Y + WAINS + (H - WAINS) / 2, z, ry);
      const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
      const rail = add(new THREE.BoxGeometry(w, 0.05, 0.05), trimWood, x + n.x * 0.02, FLOOR_Y + WAINS, z + n.z * 0.02, ry);
      rail.scale.x = 0.999;
      add(new THREE.BoxGeometry(w, 0.15, 0.03), trimWood, x + n.x * 0.012, FLOOR_Y + 0.075, z + n.z * 0.012, ry);
      add(new THREE.BoxGeometry(w, 0.12, 0.09), trimWood, x + n.x * 0.04, CEIL - 0.06, z + n.z * 0.04, ry);
    }
    // ceiling with beams
    const ceil = add(new THREE.PlaneGeometry(RX * 2, RZ * 2), M({ color: 0x17110d, gloss: 0.05 }), 0, CEIL, 0);
    ceil.rotation.x = Math.PI / 2;
    for (const bx of [-3.2, -1.6, 1.6, 3.2]) add(new THREE.BoxGeometry(0.18, 0.16, RZ * 2), trimWood, bx, CEIL - 0.08, 0);

    // ---- pendant lamps over the table
    const shadeOut = M({ color: 0x2e3b2a, gloss: 1.2, shine: 80, side: THREE.FrontSide, screenDoor: true });
    const shadeIn = M({ color: 0x8a7a5c, emissive: 0x3a2c18, side: THREE.BackSide, screenDoor: true });
    const bulb = M({ color: 0xfff1d6, unlit: true, fog: 0, screenDoor: true });
    const rodMat = M({ color: 0xb8955a, gloss: 1.2, shine: 80, screenDoor: true });
    const capMat = M({ color: 0x8a6e42, emissive: 0x100a04, gloss: 1.4, shine: 90, screenDoor: true });
    const glowMat = M({ map: glowTexture(), color: 0x6a5436, additive: true, unlit: true, fog: 0, side: THREE.DoubleSide });
    const coneMat = M({ map: coneTexture(), color: new THREE.Color(0xfff0d0).multiplyScalar(0.03), additive: true, unlit: true, fog: 0.5 });
    this.fadeMats.push(shadeOut, shadeIn, bulb, rodMat, capMat, glowMat, coneMat);
    // lathe profiles run bottom → top so the normals face outward
    const prof = [[0.215, -0.075], [0.2, -0.06], [0.16, 0.0], [0.1, 0.045], [0.05, 0.075], [0.03, 0.08]].map(([r, y]) => new THREE.Vector2(r, y));
    for (const px of PENDANTS) {
      add(new THREE.LatheGeometry(prof, 40), shadeOut, px, LAMP_Y, 0);
      add(new THREE.LatheGeometry(prof.map(v => new THREE.Vector2(v.x * 0.97, v.y - 0.002)), 40), shadeIn, px, LAMP_Y, 0);
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 20), capMat, px, LAMP_Y + 0.095, 0);
      add(new THREE.CylinderGeometry(0.005, 0.005, CEIL - LAMP_Y - 0.1, 8), rodMat, px, (CEIL + LAMP_Y + 0.1) / 2, 0);
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20), capMat, px, CEIL - 0.015, 0);
      const b = add(new THREE.CircleGeometry(0.09, 32), bulb, px, LAMP_Y - 0.02, 0); b.rotation.x = Math.PI / 2;
      const gl = add(new THREE.PlaneGeometry(0.8, 0.8), glowMat, px, LAMP_Y - 0.03, 0); gl.rotation.x = -Math.PI / 2;
      add(new THREE.CylinderGeometry(0.2, 0.5, 1.0, 32, 1, true), coneMat, px, LAMP_Y - 0.58, 0);
    }

    if (st.hall) this.buildHall(g, M, add, trimWood, brass, black);
    // ---- the bar along the back wall
    const bz = -RZ;
    if (!st.hall) {
    const barFront = M({ map: wainscotTex(), gloss: 0.4, shine: 50 });
    add(new RoundedBoxGeometry(3.4, 1.05, 0.6, 3, 0.02), barFront, 0, FLOOR_Y + 0.525, bz + 1.15);
    add(new THREE.BoxGeometry(3.52, 0.05, 0.72), M({ map: marbleTex(), gloss: 0.9, shine: 110 }), 0, FLOOR_Y + 1.075, bz + 1.12);
    const foot = add(new THREE.CylinderGeometry(0.018, 0.018, 3.3, 12), brass, 0, FLOOR_Y + 0.16, bz + 1.54);
    foot.rotation.z = Math.PI / 2;
    // back bar: mirror, shelves with warm light strips, bottles, lettering
    add(new THREE.PlaneGeometry(3.3, 1.5), M({ color: 0x15171a, gloss: 1.6, shine: 140 }), 0, FLOOR_Y + 1.75, bz + 0.03);
    const lett = add(new THREE.PlaneGeometry(1.6, 0.4), M({ map: letteringTex(), transparent: true, emissive: 0x2a1c0c, gloss: 1, shine: 60 }), 0, FLOOR_Y + 2.28, bz + 0.035);
    lett.renderOrder = 2;
    const strip = M({ color: 0xffc88a, unlit: true, fog: 0 });
    const shelfYs = [1.22, 1.58, 1.94];
    for (const sy of shelfYs) {
      add(new THREE.BoxGeometry(3.3, 0.035, 0.26), trimWood, 0, FLOOR_Y + sy, bz + 0.14);
      add(new THREE.BoxGeometry(3.2, 0.008, 0.02), strip, 0, FLOOR_Y + sy - 0.022, bz + 0.2);
    }
    const bottleProf = [[0, 0], [0.038, 0], [0.04, 0.01], [0.04, 0.19], [0.03, 0.23], [0.013, 0.25], [0.012, 0.31], [0.014, 0.32], [0, 0.32]].map(([r, y]) => new THREE.Vector2(r, y));
    const bottleGeo = new THREE.LatheGeometry(bottleProf, 14);
    const glass = [0x7a3a0a, 0x1d4a2a, 0xb8c6c2, 0x3a0e16, 0x9a6a1a].map((c, i) => M({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.25), gloss: 1.6, shine: 120, transparent: true, opacity: i === 2 ? 0.55 : 0.85, depthWrite: false }));
    const r = rng(83);
    const per = glass.map(() => []);
    for (const sy of shelfYs) for (let bx = -1.55; bx < 1.55; bx += 0.09 + r() * 0.07) {
      const s = 0.8 + r() * 0.35;
      per[Math.floor(r() * glass.length)].push(new THREE.Matrix4().compose(new THREE.Vector3(bx, FLOOR_Y + sy + 0.018, bz + 0.13 + (r() - 0.5) * 0.06), new THREE.Quaternion(), new THREE.Vector3(1, s, 1)));
    }
    glass.forEach((mat, i) => {
      const im = new THREE.InstancedMesh(bottleGeo, mat, per[i].length);
      per[i].forEach((m, k) => im.setMatrixAt(k, m));
      im.frustumCulled = false;
      g.add(im);
    });
    // stools
    const seatLeather = M({ map: plainLeather(st.leather), gloss: 0.55, shine: 40 });
    for (const sx of [-1.1, 0, 1.1]) {
      const z = bz + 1.85;
      add(new THREE.CylinderGeometry(0.2, 0.19, 0.08, 28), seatLeather, sx, FLOOR_Y + 0.76, z);
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 10), black, sx, FLOOR_Y + 0.38, z);
      add(new THREE.CylinderGeometry(0.21, 0.23, 0.025, 28), black, sx, FLOOR_Y + 0.012, z);
      const ring = add(new THREE.TorusGeometry(0.16, 0.009, 8, 32), brass, sx, FLOOR_Y + 0.3, z);
      ring.rotation.x = Math.PI / 2;
    }

    }
    // ---- chesterfield along the left wall
    const tuft = M({ map: leatherTex(st.leather), gloss: 0.5, shine: 34 });
    const smooth = M({ map: plainLeather(st.leather), gloss: 0.5, shine: 34 });
    const sx0 = -RX + 0.62, sz0 = 0.2;
    if (!st.hall) {
    add(new RoundedBoxGeometry(0.9, 0.36, 2.3, 3, 0.06), smooth, sx0, FLOOR_Y + 0.26, sz0);
    add(new RoundedBoxGeometry(0.24, 0.5, 2.3, 4, 0.1), tuft, sx0 - 0.36, FLOOR_Y + 0.62, sz0);
    for (const s of [-1, 1]) add(new RoundedBoxGeometry(0.9, 0.5, 0.24, 4, 0.11), tuft, sx0, FLOOR_Y + 0.52, sz0 + s * 1.12);
    for (const s of [-1, 1]) add(new RoundedBoxGeometry(0.66, 0.12, 0.98, 3, 0.05), smooth, sx0 + 0.08, FLOOR_Y + 0.49, sz0 + s * 0.5);
    for (const [fx, fz] of [[-0.35, -1.1], [0.35, -1.1], [-0.35, 1.1], [0.35, 1.1]]) add(new THREE.CylinderGeometry(0.03, 0.022, 0.08, 10), bronze, sx0 + fx, FLOOR_Y + 0.04, sz0 + fz);
    // side tables + lamps
    for (const s of [-1, 1]) {
      const tz = sz0 + s * 1.55;
      add(new THREE.CylinderGeometry(0.24, 0.24, 0.035, 32), trimWood, sx0, FLOOR_Y + 0.58, tz);
      add(new THREE.CylinderGeometry(0.03, 0.05, 0.56, 12), trimWood, sx0, FLOOR_Y + 0.29, tz);
      add(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 24), trimWood, sx0, FLOOR_Y + 0.01, tz);
      add(new THREE.LatheGeometry([[0, 0], [0.07, 0], [0.08, 0.04], [0.05, 0.16], [0.03, 0.3], [0, 0.3]].map(([a, b]) => new THREE.Vector2(a, b)), 20), brass, sx0, FLOOR_Y + 0.6, tz);
      add(new THREE.CylinderGeometry(0.12, 0.18, 0.2, 28, 1, true), M({ color: 0xf2dcb4, emissive: 0x8a6a3c, side: THREE.DoubleSide }), sx0, FLOOR_Y + 0.98, tz);
    }
    }
    // art above the sofa, sconces either side
    const frame = M({ color: 0x8a6a36, gloss: 1.2, shine: 70 });
    const art = (w, h, x, y, z, ry, seed) => {
      const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
      add(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.04), frame, x + n.x * 0.02, y, z + n.z * 0.02, ry);
      add(new THREE.PlaneGeometry(w, h), M({ map: paintingTex(seed), gloss: 0.15, shine: 20 }), x + n.x * 0.045, y, z + n.z * 0.045, ry);
    };
    art(1.5, 0.95, -RX + 0.01, FLOOR_Y + 1.75, sz0, Math.PI / 2, 1);
    const sconce = (x, y, z, ry) => {
      const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
      add(new THREE.BoxGeometry(0.1, 0.16, 0.02), brass, x + n.x * 0.01, y, z + n.z * 0.01, ry);
      add(new THREE.CylinderGeometry(0.045, 0.06, 0.14, 20), M({ color: 0xffe2b0, emissive: 0xb08850, unlit: false }), x + n.x * 0.1, y + 0.06, z + n.z * 0.1);
      const gl = add(new THREE.PlaneGeometry(0.7, 0.7), M({ map: glowTexture(), color: 0x3a2a18, additive: true, unlit: true, fog: 0 }), x + n.x * 0.05, y + 0.05, z + n.z * 0.05, ry);
      gl.renderOrder = 3;
    };
    sconce(-RX + 0.01, FLOOR_Y + 1.8, sz0 - 1.25, Math.PI / 2);
    sconce(-RX + 0.01, FLOOR_Y + 1.8, sz0 + 1.25, Math.PI / 2);

    // ---- right wall: cue rack, scoring beads, armchairs, art
    const rx0 = RX - 0.02;
    add(new THREE.BoxGeometry(0.05, 1.3, 1.05), trimWood, rx0 - 0.025, FLOOR_Y + 1.35, 0);
    for (const yy of [0.82, 1.9]) add(new THREE.BoxGeometry(0.1, 0.05, 1.0), trimWood, rx0 - 0.07, FLOOR_Y + yy, 0);
    ['wood', 'ebony', 'ivory', 'carbon', 'wood', 'ebony'].forEach((id, i) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0145, 1.45, 16), M({ map: cueSkin(id).texture(), gloss: 0.7, shine: 60 }));
      c.position.set(rx0 - 0.09, FLOOR_Y + 1.5, -0.4 + i * 0.16);   // tip up
      g.add(c);
    });
    for (const [wy, n] of [[2.02, 22], [1.94, 22]]) {
      const wire = add(new THREE.CylinderGeometry(0.003, 0.003, 2.6, 6), brass, rx0 - 0.08, FLOOR_Y + wy, 1.9);
      wire.rotation.x = Math.PI / 2;
      for (let i = 0; i < n; i++) {
        const bead = add(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 16), i % 5 === 4 ? black : M({ color: 0xe8dcc0, gloss: 0.8, shine: 60 }), rx0 - 0.08, FLOOR_Y + wy, 0.8 + i * 0.058 + (i > 13 ? 0.4 : 0));
        bead.rotation.x = Math.PI / 2;
      }
    }
    art(0.8, 1.0, rx0 + 0.01, FLOOR_Y + 1.55, -2.2, -Math.PI / 2, 2);
    art(0.8, 1.0, rx0 + 0.01, FLOOR_Y + 1.55, 2.5, -Math.PI / 2, 3);
    sconce(rx0 + 0.01, FLOOR_Y + 1.85, -1.2, -Math.PI / 2);
    const chair = (x, z) => {
      const ry = Math.atan2(-x, -z);      // face the table
      const grp = new THREE.Group();
      const part = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); grp.add(m); };
      part(new RoundedBoxGeometry(0.85, 0.34, 0.85, 3, 0.06), smooth, 0, 0.26, 0);
      part(new RoundedBoxGeometry(0.85, 0.5, 0.22, 4, 0.1), tuft, 0, 0.62, -0.32);
      part(new RoundedBoxGeometry(0.2, 0.46, 0.85, 4, 0.09), tuft, -0.34, 0.5, 0);
      part(new RoundedBoxGeometry(0.2, 0.46, 0.85, 4, 0.09), tuft, 0.34, 0.5, 0);
      grp.position.set(x, FLOOR_Y, z); grp.rotation.y = ry;
      g.add(grp);
    };
    if (!st.hall) { chair(RX - 0.9, -2.9); chair(RX - 0.9, 2.9); }

    // ---- front wall: tall windows over the city, velvet curtains, a plant
    const fz = RZ - 0.02;
    const curtain = M({ map: curtainTex(st), gloss: 0.12, shine: 12 });
    [-2.6, 0, 2.6].forEach((wx, i) => {
      add(new THREE.PlaneGeometry(1.1, 1.95), M({ map: cityTex(11 + i * 7), unlit: true, color: 0xd8d8e0, fog: 0 }), wx, FLOOR_Y + 1.45, fz - 0.01, Math.PI);
      for (const [w, h, ox, oy] of [[1.2, 0.06, 0, 0.98], [1.2, 0.06, 0, -0.98], [0.06, 2.0, -0.58, 0], [0.06, 2.0, 0.58, 0], [0.035, 1.95, 0, 0], [1.1, 0.035, 0, 0.3]]) {
        add(new THREE.BoxGeometry(w, h, 0.05), black, wx + ox, FLOOR_Y + 1.45 + oy, fz - 0.03, Math.PI);
      }
      add(new THREE.BoxGeometry(1.3, 0.04, 0.16), trimWood, wx, FLOOR_Y + 0.45, fz - 0.08);
      for (const s of [-1, 1]) {
        const cu = add(new THREE.PlaneGeometry(0.42, 2.7), curtain, wx + s * 0.78, FLOOR_Y + 1.38, fz - 0.12, Math.PI);
        cu.material.side = THREE.DoubleSide;
      }
    });
    add(new THREE.CylinderGeometry(0.018, 0.018, RX * 2 - 0.4, 10), brass, 0, FLOOR_Y + 2.76, fz - 0.14).rotation.z = Math.PI / 2;
    // plant in the corner
    const pot = add(new THREE.CylinderGeometry(0.22, 0.16, 0.44, 24), M({ color: 0x1a1a1c, gloss: 0.8, shine: 60 }), -RX + 0.55, FLOOR_Y + 0.22, RZ - 0.55);
    const leaf = M({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide, gloss: 0.3, shine: 20 });
    const lr = rng(97);
    for (let i = 0; i < 16; i++) {
      const l = add(new THREE.PlaneGeometry(0.22, 0.44), leaf, pot.position.x + (lr() - 0.5) * 0.25, FLOOR_Y + 0.7 + lr() * 1.0, pot.position.z + (lr() - 0.5) * 0.25, lr() * 6.28);
      l.rotation.x = -0.4 + lr() * 0.8;
    }

    this.setLighting(preset);
  }

  // TOURNAMENT HALL: tiered seats with a quiet crowd, a scoreboard, banners, rope posts
  buildHall(g, M, add, trimWood, brass, black) {
    const seat = M({ color: 0x1c1f28, gloss: 0.2, shine: 20 });
    const step = M({ color: 0x2a2e38, gloss: 0.15, shine: 16 });
    const people = [];
    for (const [side, z0, ry] of [['back', -RZ + 0.5, 0], ['left', -RX + 0.5, Math.PI / 2]]) {
      for (let t = 0; t < 3; t++) {
        const y = FLOOR_Y + 0.22 + t * 0.32, d = 0.5 + t * 0.55;
        const len = side === 'back' ? 6.2 : 5.2;
        const m = side === 'back' ? add(new THREE.BoxGeometry(len, 0.44 + t * 0.32, 0.55), step, 0, FLOOR_Y + (0.44 + t * 0.32) / 2, z0 + (2 - t) * 0.55 - 0.55)
          : add(new THREE.BoxGeometry(0.55, 0.44 + t * 0.32, len), step, z0 + (2 - t) * 0.55 - 0.55, FLOOR_Y + (0.44 + t * 0.32) / 2, 0);
        void m; void d;
        for (let i = 0; i < 16; i++) {
          if (Math.random() < 0.45) continue;
          const u = -len / 2 + 0.3 + i * (len - 0.6) / 15;
          const px = side === 'back' ? u : z0 + (2 - t) * 0.55 - 0.55, pz = side === 'back' ? z0 + (2 - t) * 0.55 - 0.55 : u;
          people.push([px, y + 0.3, pz, ry]);
        }
      }
    }
    // the crowd: dim, still, facing the table
    const body = new THREE.CapsuleGeometry(0.14, 0.34, 3, 8);
    const crowd = new THREE.InstancedMesh(body, M({ color: 0x15161c, gloss: 0.08, shine: 10 }), people.length);
    const headG = new THREE.SphereGeometry(0.1, 10, 8);
    const heads = new THREE.InstancedMesh(headG, M({ color: 0x2a221c, gloss: 0.15, shine: 12 }), people.length);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
    people.forEach(([x, y, z, ry], i) => {
      q.setFromEuler(new THREE.Euler(0, ry, 0));
      mm.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 0.8)); crowd.setMatrixAt(i, mm);
      mm.compose(new THREE.Vector3(x, y + 0.36, z), q, new THREE.Vector3(1, 1.1, 1)); heads.setMatrixAt(i, mm);
    });
    crowd.frustumCulled = false; heads.frustumCulled = false;
    g.add(crowd, heads);
    void seat;
    // scoreboard over the back seats
    add(new THREE.BoxGeometry(2.3, 0.62, 0.06), black, 0, FLOOR_Y + 2.35, -RZ + 0.05);
    add(new THREE.PlaneGeometry(2.2, 0.55), M({ map: scoreTex(), unlit: true, color: 0xd8d8d8, fog: 0 }), 0, FLOOR_Y + 2.35, -RZ + 0.085);
    // banners from the ceiling beams
    [-3.2, 3.2, 1.6].forEach((bx, i) => { const b = add(new THREE.PlaneGeometry(0.42, 1.6), M({ map: bannerTex(i), gloss: 0.1, side: THREE.DoubleSide }), bx, CEIL - 0.95, RZ - 0.6, Math.PI); void b; });
    // rope posts around the table
    const posts = [[-1.55, -1.05], [1.55, -1.05], [-1.55, 1.05], [1.55, 1.05]];
    for (const [px, pz] of posts) {
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 12), brass, px, FLOOR_Y + 0.45, pz);
      add(new THREE.CylinderGeometry(0.12, 0.14, 0.03, 16), brass, px, FLOOR_Y + 0.015, pz);
      add(new THREE.SphereGeometry(0.04, 12, 8), brass, px, FLOOR_Y + 0.92, pz);
    }
    const rope = M({ color: 0x5a1418, gloss: 0.4, shine: 30 });
    for (const [a, b] of [[0, 1], [2, 3], [0, 2], [1, 3]]) {
      const [ax, az] = posts[a], [bx, bz] = posts[b];
      const len = Math.hypot(bx - ax, bz - az);
      const r = add(new THREE.CylinderGeometry(0.012, 0.012, len, 8), rope, (ax + bx) / 2, FLOOR_Y + 0.82, (az + bz) / 2);
      r.rotation.order = 'YXZ';
      r.rotation.set(Math.PI / 2, Math.atan2(bx - ax, bz - az), 0);
    }
    void trimWood;
  }

  // slots 0-2: pendants, 3: bar, 4: sofa lamp, 5: windows, 6: right wall
  setLighting(p) {
    const L = this.lights;
    const lamp = new THREE.Color().setRGB(...p.lamp);
    PENDANTS.forEach((x, i) => L.set(i, new THREE.Vector3(x, LAMP_Y - 0.1, 0), lamp, 2.5, 1.0));
    const a = p.accent * (this.roomId === 'hall' ? 1.35 : 1);
    L.set(3, new THREE.Vector3(0, FLOOR_Y + 1.62, -RZ + 0.6), new THREE.Color(1.0, 0.62, 0.3), 4.0, 1.25 * a);
    L.set(4, new THREE.Vector3(-RX + 0.8, FLOOR_Y + 1.1, 1.6), new THREE.Color(1.0, 0.72, 0.42), 3.6, 1.1 * a);
    L.set(5, new THREE.Vector3(0, FLOOR_Y + 1.7, RZ - 0.7), new THREE.Color(0.38, 0.46, 0.85), 4.6, 0.8 * p.window);
    L.set(6, new THREE.Vector3(RX - 0.6, FLOOR_Y + 1.9, -0.6), new THREE.Color(1.0, 0.75, 0.48), 4.0, 1.05 * a);
    // classic never flashes, so the flash slots light the walls instead
    L.set(7, new THREE.Vector3(-RX + 0.5, FLOOR_Y + 1.95, -1.05), new THREE.Color(1.0, 0.74, 0.45), 3.0, 0.9 * a);
    L.set(8, new THREE.Vector3(-RX + 0.5, FLOOR_Y + 1.95, 1.45), new THREE.Color(1.0, 0.74, 0.45), 3.0, 0.9 * a);
    L.set(9, new THREE.Vector3(2.4, FLOOR_Y + 2.4, RZ - 1.4), new THREE.Color(1.0, 0.8, 0.55), 4.0, 0.7 * a);
  }

  // the pendants dissolve when the camera rises above them (they'd block the table)
  update(dt, camera, keep = false) {
    const target = keep || camera.position.y <= LAMP_Y + 0.05 ? 1 : 0;
    this.lampFade += (target - this.lampFade) * Math.min(1, dt * 6);
    this.applyFade(this.lampFade);
  }
  applyFade(v) { for (const m of this.fadeMats) m.uniforms.uOpacity.value = v; }
}
