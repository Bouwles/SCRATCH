// SCRATCH icon art: every relic, item, achievement and UI glyph is a 16x16
// pixel map composed from a small set of motifs (pool balls, cues, pockets,
// bolts, bursts...). One palette, one frame style, dithered shading and a CRT
// highlight, so everything looks like it shipped on the same disc.
//
// PS1 mode renders the map as crunchy pixels; MODERN mode renders the same map
// as clean rounded mosaic tiles at high resolution (same identity, crisp).

export const C = {
  k: '#0e0a18', K: '#221a38', d: '#3a3450', s: '#8a90a8', S: '#c8ccd8', w: '#ffffff',
  r: '#ff3040', R: '#a01024', o: '#ff8a1b', O: '#a04a00', y: '#ffe23b', Y: '#c09000',
  g: '#34e070', G: '#128040', c: '#2bf0ff', C: '#1080a0', b: '#2b6bff', B: '#142e90',
  p: '#9a4bff', P: '#4a1a90', m: '#ff2bd6', M: '#90106e', n: '#a05a28', N: '#5a2a10',
  l: '#ffd8a0', f: '#1b8a4a',
};
const DARK = { r: 'R', o: 'O', y: 'Y', g: 'G', c: 'C', b: 'B', p: 'P', m: 'M', n: 'N', s: 'd', S: 's', w: 'S', l: 'o', f: 'G', k: 'k', d: 'k' };

class Pix {
  constructor(n = 16) { this.n = n; this.a = new Array(n * n).fill(null); }
  // c === null erases; undefined/'' is ignored
  set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.n && y < this.n && (c || c === null)) this.a[y * this.n + x] = c; return this; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.n && y < this.n ? this.a[y * this.n + x] : null; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
  line(x0, y0, x1, y1, c, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) this.set(x + a, y + b, c);
    }
    return this;
  }
  disc(cx, cy, r, c, shade = true) {
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.hypot(x + 0.5 - 0.5, y);
      if (d > r + 0.35) continue;
      // dithered terminator: lower-right is the shadow side
      const t = (x + y) / (r * 1.6);
      const dark = shade && (t > 0.45 || (t > 0.15 && ((x + y) & 1)));
      this.set(cx + x, cy + y, dark ? (DARK[c] || c) : c);
    }
    return this;
  }
  ring(cx, cy, r, c) {
    for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; this.set(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), c); }
    return this;
  }
  hi(x, y) { return this.set(x, y, 'w'); }
  // 1px dark outline around everything drawn (the "sticker" edge)
  outline(c = 'k') {
    const add = [];
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.a[y * this.n + x] = c;
    return this;
  }
}

// ---------------------------------------------------------------- motifs
const M = {
  ball(p, cx, cy, r, c, { stripe = false, dot = true } = {}) {
    p.disc(cx, cy, r, stripe ? 'w' : c);
    if (stripe) for (let y = -1; y <= 1; y++) for (let x = -r; x <= r; x++) if (Math.hypot(x, y) <= r) p.set(cx + x, cy + y, (x + y > r * 0.6) ? DARK[c] : c);
    if (dot && r >= 3) { p.set(cx, cy, 'w'); p.set(cx - 1, cy, 'w'); }
    p.hi(cx - Math.ceil(r / 2), cy - Math.ceil(r / 2));
    return p;
  },
  cue(p, x0, y0, x1, y1) {
    p.line(x0, y0, x1, y1, 'l');
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    const bx = x0 + Math.round((x1 - x0) * 0.45), by = y0 + Math.round((y1 - y0) * 0.45);
    p.line(x0, y0, bx, by, 'N', 1);
    p.set(x1, y1, 'b');
    return p;
  },
  pocket(p, cx, cy, r) { p.disc(cx, cy, r, 'k', false); p.ring(cx, cy, r + 1, 'Y'); return p; },
  bolt(p, x, y, c = 'y') {
    [[3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3], [2, 4], [1, 5], [0, 6]].forEach(([i, j]) => { p.set(x + i, y + j, c); p.set(x + i + 1, y + j, c); });
    return p;
  },
  burst(p, cx, cy, r, c1 = 'y', c2 = 'o') {
    for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; p.line(cx, cy, Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), a % 2 ? c2 : c1); }
    p.disc(cx, cy, Math.max(1, r / 3 | 0), 'w', false);
    return p;
  },
  star(p, cx, cy, c = 'y') {
    p.set(cx, cy - 3, c).set(cx, cy - 2, c).set(cx, cy + 2, c).set(cx - 3, cy, c).set(cx - 2, cy, c).set(cx + 2, cy, c).set(cx + 3, cy, c);
    p.rect(cx - 1, cy - 1, 3, 3, c); p.set(cx - 2, cy + 2, c); p.set(cx + 2, cy + 2, c); p.set(cx, cy, 'w');
    return p;
  },
  arrow(p, x0, y0, x1, y1, c = 'c') {
    p.line(x0, y0, x1, y1, c);
    const a = Math.atan2(y1 - y0, x1 - x0);
    for (const s of [-1, 1]) p.line(x1, y1, Math.round(x1 - Math.cos(a + s * 0.6) * 3), Math.round(y1 - Math.sin(a + s * 0.6) * 3), c);
    return p;
  },
  chip(p, cx, cy, r = 5, c = 'y') {
    p.disc(cx, cy, r, c);
    p.ring(cx, cy, r - 2, 'k');
    for (let a = 0; a < 4; a++) { const t = a / 4 * Math.PI * 2 + 0.4; p.set(Math.round(cx + Math.cos(t) * (r - 0.5)), Math.round(cy + Math.sin(t) * (r - 0.5)), 'w'); }
    return p;
  },
  heart(p, x, y, c = 'r') {
    ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'x') p.set(x + i, y + j, (i > 4 && j > 1) ? DARK[c] : c); }));
    p.set(x + 1, y + 1, 'w');
    return p;
  },
  magnet(p, x, y) {
    p.rect(x, y, 3, 7, 'r'); p.rect(x + 7, y, 3, 7, 'b');
    p.rect(x, y + 6, 10, 3, 's'); p.rect(x + 3, y + 6, 4, 1, null);
    p.rect(x, y, 3, 2, 'S'); p.rect(x + 7, y, 3, 2, 'S');
    return p;
  },
  spiral(p, cx, cy, r, c = 'p') {
    for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 4; const rr = (i / 40) * r; p.set(Math.round(cx + Math.cos(t) * rr), Math.round(cy + Math.sin(t) * rr), c); }
    return p;
  },
  flame(p, x, y) {
    ['...r....', '..rro...', '.rrooo..', '.roooy..', 'rroyyyo.', 'rooyyyo.', 'rooyywo.', '.rooyo..'].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') p.set(x + i, y + j, ch); }));
    return p;
  },
  eye(p, cx, cy, c = 'r') {
    for (let x = -4; x <= 4; x++) { const h = Math.round(Math.sqrt(1 - (x / 4.5) ** 2) * 2.4); for (let y = -h; y <= h; y++) p.set(cx + x, cy + y, 'w'); }
    p.disc(cx, cy, 2, c, false); p.set(cx, cy, 'k'); p.set(cx - 1, cy - 1, 'w');
    return p;
  },
  skull(p, x, y) {
    ['.wwwww.', 'wwwwwww', 'wkwwwkw', 'wkkwkkw', 'wwwkwww', '.wwwww.', '.w.w.w.'].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') p.set(x + i, y + j, ch === 'w' ? 'S' : 'k'); }));
    return p;
  },
  clock(p, cx, cy, r = 5) { p.disc(cx, cy, r, 'S'); p.ring(cx, cy, r, 'd'); p.line(cx, cy, cx, cy - r + 2, 'k'); p.line(cx, cy, cx + 2, cy, 'r'); return p; },
  moon(p, cx, cy, r = 5) { p.disc(cx, cy, r, 'S'); p.disc(cx + 3, cy - 2, r - 1, null, false); p.set(cx - 2, cy + 1, 'd'); p.set(cx - 1, cy + 3, 'd'); return p; },
  ghost(p, x, y) {
    ['..www..', '.wwwww.', 'wwkwkww', 'wwwwwww', 'wwwwwww', 'wwwwwww', 'w.w.w.w'].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') p.set(x + i, y + j, ch === 'w' ? (i > 4 ? 'S' : 'w') : 'k'); }));
    return p;
  },
  num(p, x, y, digit, c = 'w') {
    const F = { 7: ['xxxx', '...x', '..x.', '.x..', '.x..'], 8: ['.xx.', 'x..x', '.xx.', 'x..x', '.xx.'], 2: ['xxx.', '...x', '.xx.', 'x...', 'xxxx'], 3: ['xxx.', '...x', '.xx.', '...x', 'xxx.'], $: ['.xxx', 'x.x.', '.xx.', '..xx', 'xxx.'], x: ['x..x', '.xx.', '.xx.', '.xx.', 'x..x'] };
    (F[digit] || F[8]).forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'x') p.set(x + i, y + j, c); }));
    return p;
  },
  sparkle(p, x, y, c = 'w') { p.set(x, y, c); p.set(x - 1, y, c); p.set(x + 1, y, c); p.set(x, y - 1, c); p.set(x, y + 1, c); return p; },
  cloth(p, c = 'f') { for (let y = 10; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, ((x + y) % 5 === 0) ? DARK[c] : c); return p; },
  wall(p, x, y, w, h, c = 'g') { p.rect(x, y, w, h, c); p.rect(x, y, w, 1, 'w'); return p; },
  trophy(p, c = 'y') {
    p.rect(4, 2, 8, 6, c); p.rect(5, 8, 6, 1, c); p.rect(7, 9, 2, 3, c); p.rect(5, 12, 6, 2, DARK[c]);
    p.set(3, 3, c); p.set(2, 4, c); p.set(3, 5, c); p.set(12, 3, c); p.set(13, 4, c); p.set(12, 5, c);
    p.set(5, 3, 'w'); p.set(5, 4, 'w'); p.rect(9, 3, 3, 5, DARK[c]);
    return p;
  },
};

// ---------------------------------------------------------------- relic art
const ART = {
  // common
  heavy_cue: p => { M.cue(p, 2, 13, 12, 3); p.line(1, 14, 5, 10, 'd', 2); M.ball(p, 13, 3, 2, 'w', { dot: false }); M.sparkle(p, 12, 8, 'o'); },
  moon_gravity: p => { M.moon(p, 7, 6, 5); M.ball(p, 12, 12, 3, 'b'); p.line(2, 14, 8, 14, 'c'); },
  extra_chalk: p => { p.rect(4, 5, 8, 9, 'b'); p.rect(5, 3, 6, 3, 'c'); p.rect(5, 6, 2, 7, 'c'); p.rect(4, 13, 8, 1, 'B'); M.sparkle(p, 12, 3, 'w'); },
  bucket_pockets: p => { M.pocket(p, 8, 9, 6); M.ball(p, 8, 4, 2, 'o'); M.arrow(p, 2, 2, 5, 5, 'c'); M.arrow(p, 14, 2, 11, 5, 'c'); },
  laser_sight: p => { M.ball(p, 4, 11, 3, 'w'); p.line(6, 9, 14, 1, 'r'); p.line(7, 9, 14, 2, 'm'); M.sparkle(p, 13, 2, 'w'); },
  piggy_bank: p => { p.disc(8, 9, 5, 'm'); p.rect(3, 8, 2, 2, 'm'); p.set(5, 7, 'k'); p.rect(7, 3, 3, 1, 'k'); M.chip(p, 8, 2, 2); p.rect(5, 13, 2, 2, 'M'); p.rect(10, 13, 2, 2, 'M'); },
  rubber_rails: p => { M.wall(p, 0, 12, 16, 3, 'g'); M.ball(p, 8, 5, 3, 'r'); p.line(2, 2, 6, 10, 'c'); p.line(10, 10, 14, 2, 'c'); },
  cashback: p => { M.chip(p, 7, 8, 6); M.arrow(p, 14, 13, 14, 3, 'g'); },
  lucky_seven: p => { M.ball(p, 8, 8, 6, 'R'); p.disc(8, 8, 3, 'w', false); M.num(p, 6, 6, 7, 'k'); M.sparkle(p, 14, 2, 'y'); },
  trickster: p => { M.wall(p, 0, 0, 2, 16, 'g'); M.wall(p, 14, 0, 2, 16, 'g'); p.line(2, 14, 7, 3, 'c'); p.line(7, 3, 13, 13, 'c'); M.ball(p, 12, 12, 2, 'y'); },
  bankers_delight: p => { M.wall(p, 0, 0, 16, 2, 'g'); p.line(3, 14, 8, 2, 'y'); p.line(8, 2, 13, 14, 'y'); M.chip(p, 8, 10, 3); },
  spin_doctor: p => { M.ball(p, 8, 8, 6, 'w', { dot: false }); p.disc(10, 6, 1, 'r', false); M.spiral(p, 8, 8, 5, 'b'); },
  // rare
  explosive_chalk: p => { M.burst(p, 8, 8, 7); M.ball(p, 8, 8, 2, 'r', { dot: false }); },
  magnet_pocket: p => { M.magnet(p, 3, 1); M.pocket(p, 8, 13, 2); },
  ghost_ball: p => { M.ghost(p, 4, 4); p.ring(12, 12, 2, 's'); },
  double_tap: p => { M.cue(p, 1, 14, 9, 6); M.ball(p, 11, 4, 2, 'w'); M.arrow(p, 4, 4, 8, 1, 'y'); M.arrow(p, 12, 9, 15, 7, 'o'); },
  hot_streak: p => { M.flame(p, 4, 4); M.ball(p, 12, 12, 2, 'o', { dot: false }); },
  clone_ball: p => { M.ball(p, 5, 6, 4, 'r'); M.ball(p, 11, 10, 4, 'b'); M.sparkle(p, 12, 2, 'p'); },
  black_hole: p => { p.disc(8, 8, 6, 'P'); M.spiral(p, 8, 8, 6, 'm'); p.disc(8, 8, 2, 'k', false); },
  thunder_cue: p => { M.bolt(p, 6, 3, 'y'); M.ball(p, 3, 12, 2, 'w'); M.ball(p, 13, 3, 2, 'c'); },
  glass_balls: p => { M.ball(p, 8, 8, 6, 'c'); p.line(5, 4, 10, 12, 'w'); p.line(10, 4, 7, 9, 'S'); },
  pinball: p => { p.disc(8, 8, 6, 'm'); p.disc(8, 8, 3, 'w', false); p.disc(8, 8, 1, 'm', false); M.sparkle(p, 2, 2, 'y'); M.sparkle(p, 14, 13, 'y'); },
  homing: p => { M.ball(p, 3, 12, 2, 'w'); p.line(4, 10, 6, 6, 'c'); p.line(6, 6, 10, 4, 'c'); M.ball(p, 12, 4, 2, 'r'); p.ring(12, 4, 3, 'y'); },
  // cursed
  demon_chalk: p => { p.rect(3, 6, 10, 8, 'r'); M.skull(p, 4, 6); p.set(3, 3, 'r'); p.set(4, 4, 'r'); p.set(12, 3, 'r'); p.set(11, 4, 'r'); },
  blood_pact: p => { M.heart(p, 1, 3, 'r'); p.line(10, 2, 14, 12, 's'); p.set(9, 13, 'r'); p.set(9, 14, 'r'); M.num(p, 11, 11, 'x', 'y'); },
  cursed_felt: p => { M.cloth(p, 'f'); M.skull(p, 5, 1); p.rect(2, 12, 3, 1, 'k'); p.rect(10, 13, 4, 1, 'k'); },
  hungry_pockets: p => { M.pocket(p, 8, 9, 6); for (let i = 0; i < 5; i++) p.set(4 + i * 2, 5, 'w'); for (let i = 0; i < 5; i++) p.set(4 + i * 2, 13, 'w'); M.arrow(p, 1, 1, 4, 4, 'r'); },
  glass_cannon: p => { p.rect(2, 6, 10, 4, 'c'); p.rect(12, 5, 2, 6, 'C'); p.line(4, 6, 7, 10, 'w'); M.burst(p, 14, 8, 2); },
  // legendary
  nitro: p => { p.rect(5, 3, 6, 11, 'r'); p.rect(6, 1, 4, 2, 's'); p.rect(5, 6, 6, 3, 'y'); M.num(p, 6, 6, 'x', 'r'); M.burst(p, 13, 13, 2); },
  midas: p => { M.ball(p, 8, 8, 6, 'y'); M.star(p, 8, 8, 'w'); M.sparkle(p, 14, 2, 'w'); },
  multiball: p => { M.ball(p, 4, 4, 3, 'r'); M.ball(p, 12, 4, 3, 'b'); M.ball(p, 8, 11, 3, 'y'); },
  rewind: p => { M.clock(p, 8, 8, 6); M.arrow(p, 13, 3, 9, 1, 'c'); },
  ricochet: p => { M.wall(p, 0, 13, 16, 3, 'g'); p.line(1, 2, 7, 12, 'w'); p.line(7, 12, 14, 2, 'y'); M.ball(p, 14, 2, 1, 'w', { dot: false }); M.sparkle(p, 7, 11, 'y'); },
  // v1.0 relics
  dead_center: p => { p.ring(8, 8, 6, 'r'); p.ring(8, 8, 3, 'w'); p.disc(8, 8, 1, 'r', false); p.line(8, 0, 8, 3, 's'); p.line(8, 13, 8, 15, 's'); p.line(0, 8, 3, 8, 's'); p.line(13, 8, 15, 8, 's'); },
  kiss_shot: p => { M.ball(p, 5, 9, 4, 'm'); M.ball(p, 11, 7, 4, 'b'); M.heart(p, 5, 0, 'r'); },
  orbit: p => { M.ball(p, 8, 8, 3, 'w', { dot: false }); p.disc(9, 7, 1, 'r', false); for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 1.6; p.set(Math.round(8 + Math.cos(t) * 6.5), Math.round(8 + Math.sin(t) * 4), 'c'); } M.arrow(p, 3, 11, 1, 9, 'c'); },
  aftershock: p => { M.wall(p, 0, 0, 3, 16, 'g'); p.ring(3, 8, 4, 'o'); p.ring(3, 8, 7, 'y'); M.ball(p, 12, 8, 2, 'w'); M.sparkle(p, 9, 3, 'w'); },
  encore: p => { M.ball(p, 5, 10, 3, 'y'); M.ball(p, 11, 10, 3, 'r'); p.line(3, 4, 13, 4, 'w'); M.arrow(p, 13, 4, 10, 1, 'g'); M.arrow(p, 13, 4, 10, 7, 'g'); },
  pocket_change: p => { M.pocket(p, 5, 11, 3); M.pocket(p, 12, 11, 3); M.chip(p, 5, 4, 3); M.chip(p, 12, 4, 3); M.arrow(p, 7, 4, 10, 4, 'g'); },
  deadeye: p => { M.eye(p, 8, 8, 'c'); p.line(0, 8, 3, 8, 'r'); p.line(13, 8, 15, 8, 'r'); },
  insurance: p => { p.rect(4, 2, 8, 9, 'b'); p.rect(4, 11, 8, 1, 'B'); for (let i = 0; i < 4; i++) p.rect(4 + i, 12 + i, 8 - i * 2, 1, 'b'); p.line(6, 7, 7, 9, 'w'); p.line(7, 9, 10, 4, 'w'); },
  hot_rail: p => { M.wall(p, 0, 12, 16, 4, 'r'); M.flame(p, 5, 3); p.line(1, 10, 14, 10, 'o'); },
  final_destination: p => { M.pocket(p, 8, 11, 4); M.ball(p, 8, 4, 3, 'k'); p.disc(8, 4, 1, 'w', false); M.star(p, 13, 3, 'y'); },
  loaded_dice: p => { ART_DICE(p); M.skull(p, 9, 9); },
  black_label: p => { p.rect(5, 2, 6, 12, 'k'); p.rect(6, 1, 4, 1, 'd'); p.rect(5, 6, 6, 5, 'K'); M.skull(p, 5, 6); p.rect(5, 13, 6, 1, 'R'); },
  // shop specials
  mystery: p => { p.disc(8, 8, 6, 'P'); p.rect(6, 4, 4, 1, 'y'); p.rect(10, 5, 1, 2, 'y'); p.rect(8, 7, 2, 1, 'y'); p.rect(8, 8, 1, 2, 'y'); p.rect(8, 12, 1, 1, 'y'); },
  upgrade: p => { M.arrow(p, 8, 14, 8, 2, 'y'); M.sparkle(p, 3, 5, 'w'); M.sparkle(p, 13, 9, 'w'); },
  sell: p => { M.chip(p, 8, 9, 5); M.arrow(p, 8, 6, 8, 0, 'g'); },
  // items
  extra_shot: p => { M.cue(p, 2, 13, 13, 2); p.rect(10, 9, 5, 1, 'g'); p.rect(12, 7, 1, 5, 'g'); },
  big_pockets: p => { M.pocket(p, 8, 9, 6); M.arrow(p, 8, 8, 2, 2, 'y'); M.arrow(p, 8, 8, 14, 2, 'y'); },
  nuke: p => { p.disc(8, 8, 6, 'y'); p.disc(8, 8, 1, 'k', false); for (let a = 0; a < 3; a++) { const t = a * 2.094 - 1.57; for (let r = 2; r <= 5; r++) for (let w = -0.45; w <= 0.45; w += 0.15) p.set(Math.round(8 + Math.cos(t + w) * r), Math.round(8 + Math.sin(t + w) * r), 'k'); } },
  guide: p => { M.ball(p, 3, 13, 2, 'w'); for (let i = 0; i < 6; i++) p.set(5 + i * 2, 11 - i * 2, 'c'); p.ring(14, 1, 1, 'w'); },
  rerack: p => { [[8, 3], [6, 6], [10, 6], [4, 9], [8, 9], [12, 9]].forEach(([x, y], i) => M.ball(p, x, y, 1, ['y', 'b', 'r', 'p', 'k', 'g'][i], { dot: false })); p.line(2, 12, 14, 12, 'l'); p.line(2, 12, 8, 1, 'l'); p.line(14, 12, 8, 1, 'l'); },
  heal: p => { M.heart(p, 4, 5, 'r'); M.sparkle(p, 13, 3, 'w'); },
};

// ---- AFTERHOURS: risk relics
Object.assign(ART, {
  double_edge: p => { p.line(3, 13, 12, 2, 'S', 2); p.line(4, 13, 13, 2, 's'); p.rect(1, 12, 4, 3, 'n'); M.sparkle(p, 13, 2, 'r'); M.sparkle(p, 9, 6, 'w'); },
  debt: p => { p.rect(3, 2, 10, 12, 'S'); p.rect(3, 2, 10, 2, 'r'); for (let y = 6; y < 13; y += 2) p.rect(5, y, 6, 1, 'd'); M.chip(p, 12, 12, 3); p.set(12, 12, 'r'); },
  blind_faith: p => { M.eye(p, 8, 8, 'c'); p.rect(2, 7, 12, 3, 'k'); p.rect(2, 7, 12, 1, 'd'); M.sparkle(p, 13, 3, 'y'); },
  final_form: p => { M.flame(p, 4, 1); M.burst(p, 8, 12, 3, 'r', 'y'); },
  last_life: p => { M.heart(p, 4, 4, 'r'); p.line(8, 3, 6, 12, 'k'); M.sparkle(p, 13, 2, 'w'); },
  // ---- the protocols
  p_missile: p => { p.line(2, 13, 11, 4, 'S', 2); p.rect(11, 2, 3, 3, 'r'); p.set(3, 11, 'o'); p.set(2, 13, 'y'); p.set(1, 14, 'o'); M.sparkle(p, 14, 13, 'y'); },
  p_radar: p => { p.ring(8, 8, 6, 'G'); p.ring(8, 8, 3, 'G'); p.line(8, 8, 13, 4, 'g'); p.set(11, 10, 'y'); p.set(5, 5, 'g'); },
  p_supply: p => { p.rect(3, 6, 10, 8, 'n'); p.rect(3, 6, 10, 1, 'l'); p.line(3, 6, 12, 13, 'N'); p.line(12, 6, 3, 13, 'N'); p.line(8, 1, 8, 5, 's'); p.line(4, 2, 12, 2, 's'); },
  p_armor: p => { p.rect(3, 2, 10, 7, 's'); for (let j = 0; j < 5; j++) p.rect(3 + j, 9 + j, 10 - j * 2, 1, 's'); p.rect(7, 4, 2, 7, 'S'); p.rect(4, 6, 8, 2, 'S'); },
  p_drone: p => { p.rect(6, 7, 4, 3, 's'); for (const [x, y] of [[3, 5], [12, 5], [3, 11], [12, 11]]) { p.rect(x - 2, y, 5, 1, 'd'); p.line(x, y, 8, 8, 'd'); } p.set(8, 8, 'g'); },
  p_overwatch: p => { p.ring(8, 8, 6, 'g'); p.line(8, 1, 8, 15, 'g'); p.line(1, 8, 15, 8, 'g'); p.disc(8, 8, 1, 'r', false); },
  p_chain: p => { for (let i = 0; i < 3; i++) p.ring(4 + i * 4, 8, 2, i === 1 ? 'y' : 's'); M.arrow(p, 2, 13, 14, 13, 'g'); },
  p_counter: p => { M.burst(p, 8, 8, 6, 'y', 'o'); p.ring(8, 8, 7, 'c'); p.disc(8, 8, 2, 'c', false); },
  p_shock: p => { M.burst(p, 8, 9, 7, 'r', 'y'); M.bolt(p, 5, 1, 'w'); },
  p_repair: p => { p.rect(7, 2, 2, 10, 's'); p.rect(4, 2, 8, 3, 'S'); p.rect(6, 12, 4, 3, 'n'); M.sparkle(p, 13, 4, 'g'); M.sparkle(p, 3, 10, 'g'); },
  p_intel: p => { p.rect(2, 3, 12, 10, 'l'); p.rect(2, 3, 12, 2, 'n'); for (let y = 7; y < 12; y += 2) p.rect(4, y, 8, 1, 'N'); p.rect(9, 9, 4, 3, 'r'); },
  p_omega: p => { p.ring(8, 8, 5, 'r'); p.rect(3, 12, 3, 2, 'r'); p.rect(10, 12, 3, 2, 'r'); p.rect(3, 8, 10, 4, null); p.ring(8, 7, 4, 'r'); M.sparkle(p, 14, 2, 'y'); },
  // ---- rivals (the icon on their table card)
  rival_hustler: p => { M.cue(p, 2, 14, 13, 3); M.chip(p, 5, 5, 3); M.chip(p, 11, 11, 2); },
  rival_lunatic: p => { M.spiral(p, 8, 8, 6, 'm'); M.eye(p, 8, 8, 'm'); },
  rival_banker: p => { M.wall(p, 0, 0, 16, 2, 'g'); p.line(2, 14, 8, 2, 'y'); p.line(8, 2, 14, 14, 'y'); M.chip(p, 8, 11, 3); },
  rival_ghost: p => { M.ghost(p, 4, 4); p.set(6, 6, 'c'); p.set(8, 6, 'c'); },
  rival_shark: p => { p.rect(2, 10, 12, 2, 'b'); for (let i = 0; i < 6; i++) p.rect(7 - i, 4 + i, 1 + i, 1, 's'); p.set(13, 9, 'w'); },
  rival_professor: p => { p.rect(3, 4, 10, 2, 'k'); p.rect(5, 2, 6, 2, 'k'); p.line(12, 5, 14, 11, 'y'); p.disc(8, 10, 3, 'l'); p.set(7, 10, 'k'); p.set(9, 10, 'k'); },
  // ---- the car (a grey coupe, nobody's in particular)
  car: p => { p.rect(1, 8, 14, 4, 's'); p.rect(4, 5, 7, 3, 'k'); p.rect(5, 6, 5, 1, 'd'); p.disc(4, 12, 1, 'k', false); p.disc(12, 12, 1, 'k', false); p.set(15, 9, 'w'); p.set(0, 9, 'r'); p.rect(2, 9, 12, 1, 'S'); },
});

function ART_DICE(p) { p.rect(2, 2, 11, 11, 'w'); p.rect(2, 12, 11, 1, 'S'); [[4, 4], [10, 4], [7, 7]].forEach(([x, y]) => p.set(x, y, 'k')); }

// Achievements: a trophy/medal with a motif badge.
const ACH = {
  first_blood: p => { M.pocket(p, 8, 9, 5); M.ball(p, 8, 4, 2, 'r'); },
  bankrupt: p => { M.wall(p, 0, 0, 16, 2, 'g'); p.line(3, 14, 8, 2, 'y'); p.line(8, 2, 13, 14, 'y'); },
  how: p => { M.ball(p, 4, 5, 3, 'r'); M.ball(p, 11, 5, 3, 'b'); M.ball(p, 8, 11, 3, 'y'); M.sparkle(p, 14, 13, 'w'); },
  scratch_master: p => { M.pocket(p, 8, 9, 5); M.ball(p, 8, 5, 3, 'w'); M.num(p, 11, 1, 'x', 'r'); },
  nuclear: p => ART.nuke(p),
  perfect: p => { M.star(p, 8, 8, 'y'); M.sparkle(p, 3, 3, 'w'); M.sparkle(p, 13, 13, 'w'); },
  boss_slayer: p => { M.skull(p, 4, 3); p.line(1, 14, 14, 1, 's'); },
  gold_rush: p => ART.midas(p),
  ghost: p => ART.ghost_ball(p),
  champion: p => M.trophy(p, 'y'),
  high_roller: p => { M.chip(p, 6, 10, 4); M.chip(p, 10, 7, 4); M.chip(p, 8, 4, 3); },
  collector: p => { for (let i = 0; i < 4; i++) p.rect(1 + i * 4, 5, 3, 6, ['r', 'b', 'y', 'p'][i]); },
  cursed: p => { M.skull(p, 4, 4); p.set(2, 2, 'r'); p.set(13, 2, 'r'); },
  lucky: p => ART.lucky_seven(p),
  break_master: p => { M.burst(p, 8, 8, 7, 'w', 'c'); },
  call_it: p => { M.ball(p, 8, 8, 6, 'k'); p.disc(8, 8, 3, 'w', false); M.num(p, 6, 6, 8, 'k'); },
  trick: p => ART.trickster(p),
  mega: p => { M.burst(p, 8, 8, 7, 'm', 'y'); },
  speed_demon: p => { M.clock(p, 8, 8, 6); M.flame(p, 9, 7); },
  clean_break: p => { M.burst(p, 8, 8, 7, 'w', 'y'); M.ball(p, 4, 12, 2, 'r'); M.ball(p, 12, 12, 2, 'b'); },
  why: p => { M.pocket(p, 8, 10, 5); M.ball(p, 8, 5, 3, 'w'); M.num(p, 1, 1, 3, 'r'); },
  geometry: p => { M.wall(p, 0, 0, 16, 1, 'g'); M.wall(p, 0, 15, 16, 1, 'g'); p.line(1, 13, 5, 1, 'y'); p.line(5, 1, 10, 14, 'y'); p.line(10, 14, 14, 2, 'y'); },
  domino: p => { for (let i = 0; i < 4; i++) p.rect(1 + i * 4, 3 + i * 2, 2, 8, ['w', 's', 'S', 'd'][i]); },
  what: p => { M.burst(p, 8, 8, 7, 'm', 'c'); M.bolt(p, 6, 4, 'y'); },
  untouchable: p => { M.skull(p, 4, 3); p.ring(8, 8, 7, 'y'); },
  all_in: p => { M.chip(p, 5, 10, 4); M.chip(p, 11, 10, 4); M.chip(p, 8, 5, 4); M.star(p, 13, 2, 'y'); },
  upgraded: p => ART.upgrade(p),
  too_hot: p => { M.flame(p, 4, 3); M.num(p, 11, 10, 5, 'y'); },
  daily: p => { p.disc(8, 10, 6, 'o'); p.rect(0, 11, 16, 5, null); p.rect(1, 11, 14, 1, 'y'); for (let i = 0; i < 5; i++) p.line(8, 4, 2 + i * 3, 1, 'y'); },
  deep: p => { for (let i = 0; i < 5; i++) p.rect(3 + i, 2 + i * 3, 10 - i * 2, 1, 's'); M.arrow(p, 8, 4, 8, 15, 'r'); },
  breaker: p => { M.ball(p, 5, 8, 3, 'w'); M.burst(p, 11, 8, 4, 'r', 'y'); },
  classic_win: p => { M.ball(p, 8, 8, 6, 'k'); p.disc(8, 8, 3, 'w', false); M.num(p, 6, 6, 8, 'k'); M.star(p, 14, 2, 'y'); },
  hustler: p => { M.cue(p, 2, 14, 14, 2); M.star(p, 4, 4, 'y'); M.chip(p, 12, 12, 3); },
  flashback: p => { p.rect(2, 3, 12, 10, 'd'); p.rect(3, 4, 10, 8, 's'); M.ball(p, 8, 8, 2, 'k'); p.line(3, 6, 12, 6, 'S'); },
  eights: p => { M.ball(p, 5, 5, 3, 'k'); M.ball(p, 11, 5, 3, 'k'); M.ball(p, 5, 11, 3, 'k'); M.ball(p, 11, 11, 3, 'k'); },
  curious: p => { M.eye(p, 8, 8, 'y'); M.sparkle(p, 14, 2, 'w'); },
  secret: p => { p.rect(6, 3, 4, 1, 's'); p.rect(10, 4, 1, 3, 's'); p.rect(8, 7, 2, 1, 's'); p.rect(8, 8, 1, 3, 's'); p.rect(8, 13, 1, 1, 's'); },
  // AFTERHOURS
  state_first: p => { M.moon(p, 8, 7, 5); M.sparkle(p, 13, 12, 'y'); },
  contractor: p => { p.rect(3, 2, 10, 12, 'l'); for (let y = 5; y < 12; y += 2) p.rect(5, y, 6, 1, 'N'); p.line(8, 12, 13, 8, 'b'); },
  whale: p => { M.chip(p, 5, 11, 4); M.chip(p, 11, 11, 4); M.chip(p, 8, 6, 4); M.chip(p, 8, 2, 2); },
  rival_beat: p => { M.cue(p, 1, 14, 7, 4); M.cue(p, 14, 14, 9, 4); M.star(p, 8, 4, 'y'); },
  nemesis: p => { M.skull(p, 4, 4); p.ring(8, 8, 7, 'r'); },
  synergist: p => { M.ball(p, 5, 8, 3, 'c'); M.ball(p, 11, 8, 3, 'm'); M.sparkle(p, 8, 3, 'y'); M.sparkle(p, 8, 13, 'y'); },
  mad_science: p => { p.rect(6, 1, 4, 4, 'S'); for (let j = 0; j < 8; j++) p.rect(6 - (j >> 1), 5 + j, 4 + (j >> 1) * 2, 1, j > 3 ? 'g' : 'S'); M.sparkle(p, 12, 3, 'g'); },
  overcharged: p => { M.bolt(p, 6, 3, 'c'); p.ring(8, 8, 7, 'c'); },
  trick_table: p => { M.wall(p, 0, 0, 2, 16, 'g'); p.line(3, 14, 13, 2, 'y'); M.ball(p, 13, 2, 1, 'y', { dot: false }); M.star(p, 5, 5, 'y'); },
  remixed: p => { M.skull(p, 4, 3); M.arrow(p, 2, 13, 13, 13, 'm'); M.arrow(p, 13, 11, 2, 11, 'c'); },
  boss_rush: p => { for (let i = 0; i < 3; i++) M.skull(p, 1 + i * 5, 4 + (i % 2) * 4); },
  one_cue: p => { M.cue(p, 2, 14, 14, 2); p.ring(12, 12, 3, 'y'); M.num(p, 11, 10, 2, 'y'); },
  chaos_win: p => { M.burst(p, 8, 8, 7, 'm', 'c'); M.spiral(p, 8, 8, 4, 'y'); },
  risky: p => { M.heart(p, 4, 5, 'r'); M.burst(p, 12, 3, 2, 'y', 'o'); },
  afterhours: p => { M.clock(p, 8, 8, 6); p.rect(10, 9, 1, 1, 'r'); M.moon(p, 13, 3, 2); },
  last_game: p => { M.ball(p, 8, 8, 6, 'k'); p.disc(8, 8, 3, 'w', false); M.num(p, 6, 6, 8, 'k'); p.ring(8, 8, 7, 'l'); },
  insomniac: p => { M.clock(p, 8, 8, 6); M.eye(p, 8, 8, 'r'); },
  regular: p => { M.cue(p, 1, 14, 12, 3); p.rect(10, 9, 5, 6, 'n'); p.rect(11, 10, 3, 1, 'l'); },
  rajis_found: p => { p.ring(8, 8, 6, 'g'); p.line(8, 8, 13, 5, 'g'); p.set(10, 11, 'r'); p.set(5, 5, 'g'); },
  intercepted: p => ART.p_missile(p),
  supply_chain: p => ART.p_supply(p),
  machine_learning: p => ART.car(p),
  heavy_industry: p => { p.rect(2, 8, 12, 4, 'n'); p.rect(5, 5, 6, 3, 'n'); p.line(10, 6, 15, 4, 's', 1); for (let i = 0; i < 5; i++) p.disc(3 + i * 2.5, 13, 1, 'k', false); },
  system_online: p => { p.disc(8, 8, 6, 'r'); M.eye(p, 8, 8, 'y'); },
  paulyamin: p => { M.ball(p, 5, 8, 3, 's'); M.ball(p, 11, 8, 3, 's'); p.set(5, 8, 'r'); p.set(11, 8, 'r'); p.line(8, 2, 8, 14, 'd'); },
};

// RAJIS portraits: 16px helmets and visors, nobody real
export const PORTRAIT = {
  richard: p => { p.disc(8, 9, 5, 'l'); p.rect(3, 3, 10, 4, 'G'); p.rect(3, 6, 10, 1, 'k'); p.rect(6, 9, 1, 1, 'k'); p.rect(10, 9, 1, 1, 'k'); p.rect(7, 12, 3, 1, 'N'); M.p_missileBadge(p); },
  neil: p => { p.disc(8, 9, 5, 'l'); p.rect(3, 4, 10, 3, 'N'); p.ring(8, 8, 6, 'd'); p.rect(2, 7, 2, 4, 's'); p.line(3, 11, 6, 13, 's'); p.rect(6, 9, 1, 1, 'k'); p.rect(10, 9, 1, 1, 'k'); },
  paul: p => { p.disc(8, 9, 5, 'S'); p.rect(4, 7, 9, 3, 'k'); p.rect(5, 8, 7, 1, 'c'); p.rect(7, 2, 2, 3, 's'); p.set(8, 1, 'r'); p.rect(6, 12, 5, 1, 'd'); },
  yahya: p => { p.disc(8, 9, 5, 'l'); p.rect(2, 3, 12, 4, 'G'); p.rect(3, 2, 10, 1, 'G'); p.rect(4, 7, 8, 2, 'k'); p.rect(5, 7, 2, 1, 'y'); p.rect(9, 7, 2, 1, 'y'); p.rect(7, 12, 3, 1, 'N'); },
  core: p => { p.disc(8, 8, 7, 'R'); p.disc(8, 8, 5, 'r'); M.eye(p, 8, 8, 'y'); },
  paulyamin: p => { p.disc(5, 9, 4, 'S'); p.disc(11, 9, 4, 's'); p.rect(3, 8, 4, 1, 'c'); p.rect(9, 8, 4, 1, 'r'); },
};
M.p_missileBadge = (p) => { p.set(13, 13, 'r'); p.set(14, 12, 'r'); p.set(12, 14, 'y'); };

// UI glyphs (replace fallback-font symbols like ★ ♥ ⚠ ▶)
const GLYPH = {
  arrowR: p => { for (let i = 0; i < 4; i++) p.rect(5 + i, 4 + i, 1, 8 - i * 2, 'y'); },
  arrowL: p => { for (let i = 0; i < 4; i++) p.rect(10 - i, 4 + i, 1, 8 - i * 2, 's'); },
  star: p => M.star(p, 8, 8, 'y'),
  starOff: p => M.star(p, 8, 8, 'd'),
  heart: p => M.heart(p, 4, 5, 'r'),
  heartOff: p => M.heart(p, 4, 5, 'd'),
  chip: p => M.chip(p, 8, 8, 6),
  warn: p => { for (let j = 0; j < 12; j++) p.rect(8 - (j >> 1), 2 + j, (j >> 1) * 2 + 1, 1, 'y'); p.rect(8, 5, 1, 5, 'k'); p.set(8, 11, 'k'); },
  diamond: p => { for (let j = 0; j < 6; j++) { p.rect(8 - j, 2 + j, j * 2 + 1, 1, 'm'); p.rect(8 - j, 13 - j, j * 2 + 1, 1, 'M'); } p.set(7, 4, 'w'); },
  lock: p => { p.ring(8, 6, 3, 's'); p.rect(4, 7, 9, 7, 'y'); p.rect(8, 9, 1, 3, 'k'); },
  check: p => { p.line(3, 8, 6, 11, 'g', 2); p.line(6, 11, 12, 4, 'g', 2); },
  cross: p => { p.line(3, 3, 12, 12, 'r', 2); p.line(12, 3, 3, 12, 'r', 2); },
  flame: p => M.flame(p, 4, 4),
  bolt: p => M.bolt(p, 5, 4, 'y'),
  eye: p => M.eye(p, 8, 8, 'm'),
  skull: p => M.skull(p, 4, 4),
  trophy: p => M.trophy(p, 'y'),
  cue: p => M.cue(p, 2, 13, 13, 2),
  target: p => { p.ring(8, 8, 6, 'r'); p.ring(8, 8, 3, 'w'); p.set(8, 8, 'r'); },
  anomaly: p => { p.disc(8, 8, 6, 'P'); M.eye(p, 8, 8, 'c'); },
  dice: p => { p.rect(3, 3, 10, 10, 'w'); p.rect(3, 12, 10, 1, 'S'); [[5, 5], [10, 5], [8, 8], [5, 10], [10, 10]].forEach(([x, y]) => p.set(x, y, 'k')); },
  contract: p => { p.rect(4, 2, 9, 12, 'l'); for (let y = 5; y < 12; y += 2) p.rect(6, y, 5, 1, 'N'); p.line(9, 13, 13, 9, 'b'); },
  state: p => { M.moon(p, 8, 8, 5); },
  rival: p => { M.cue(p, 1, 14, 7, 4); M.cue(p, 14, 14, 9, 4); },
  puzzle: p => { M.wall(p, 0, 0, 2, 16, 'g'); p.line(3, 14, 13, 2, 'y'); M.ball(p, 13, 2, 1, 'y', { dot: false }); },
  roller: p => { M.chip(p, 6, 10, 4); M.chip(p, 10, 6, 4); },
  car: p => ART.car(p),
  syn: p => { M.ball(p, 5, 8, 3, 'c'); M.ball(p, 11, 8, 3, 'm'); M.sparkle(p, 8, 3, 'y'); },
  heartOn: p => M.heart(p, 4, 5, 'r'),
  radar: p => ART.p_radar(p),
  over: p => M.bolt(p, 5, 4, 'c'),
  lamp: p => { p.rect(5, 2, 6, 4, 'y'); p.rect(7, 6, 2, 8, 's'); p.rect(4, 14, 8, 1, 's'); },
};

// ---------------------------------------------------------------- render
const cache = new Map();
let modern = false;
export function setArtMode(m) { if (m !== modern) { modern = m; cache.clear(); } }

function paintMap(fn) {
  const p = new Pix(16);
  fn(p);
  p.outline('k');
  return p;
}

// frame: rarity/border colour; bg: background tone
function drawPix(p, { frame = null, bg = true, size = 16 } = {}) {
  const pad = frame ? 2 : 0;
  const N = 16 + pad * 2;
  const k = modern ? 8 : 1;
  const c = document.createElement('canvas');
  c.width = N * k; c.height = N * k;
  const x = c.getContext('2d');
  if (bg) {
    if (modern) {
      const g = x.createLinearGradient(0, 0, 0, N * k);
      g.addColorStop(0, '#241a40'); g.addColorStop(1, '#0c0818');
      x.fillStyle = g;
      roundRect(x, 0, 0, N * k, N * k, k * 2); x.fill();
    } else {
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        x.fillStyle = (i + j) & 1 ? '#150f26' : '#1c1432';
        x.fillRect(i, j, 1, 1);
      }
      x.fillStyle = 'rgba(255,255,255,0.06)';          // CRT highlight band
      x.fillRect(0, 1, N, 3);
    }
  }
  if (frame) {
    if (modern) {
      x.lineWidth = k * 1.2; x.strokeStyle = frame;
      roundRect(x, k * 0.6, k * 0.6, N * k - k * 1.2, N * k - k * 1.2, k * 1.8); x.stroke();
    } else {
      x.fillStyle = '#000'; x.fillRect(0, 0, N, 1); x.fillRect(0, N - 1, N, 1); x.fillRect(0, 0, 1, N); x.fillRect(N - 1, 0, 1, N);
      x.fillStyle = frame; x.fillRect(1, 1, N - 2, 1); x.fillRect(1, 1, 1, N - 2);
      x.fillStyle = shadeHex(frame, 0.55); x.fillRect(1, N - 2, N - 2, 1); x.fillRect(N - 2, 1, 1, N - 2);
    }
  }
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    const col = p.a[j * 16 + i];
    if (!col) continue;
    const hex = C[col] || col;
    if (modern) {
      const g = x.createLinearGradient(0, (j + pad) * k, 0, (j + pad + 1) * k);
      g.addColorStop(0, shadeHex(hex, 1.18)); g.addColorStop(1, hex);
      x.fillStyle = g;
      roundRect(x, (i + pad) * k + 0.4, (j + pad) * k + 0.4, k - 0.8, k - 0.8, k * 0.28); x.fill();
    } else {
      x.fillStyle = hex;
      x.fillRect(i + pad, j + pad, 1, 1);
    }
  }
  c.className = 'px-icon' + (modern ? ' hd' : '');
  return c;
}

function roundRect(x, X, Y, W, H, r) {
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
}

function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k) | 0, g = Math.min(255, ((n >> 8) & 255) * k) | 0, b = Math.min(255, (n & 255) * k) | 0;
  return `rgb(${r},${g},${b})`;
}

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make().toDataURL());
  const img = new Image();
  img.src = cache.get(key);
  img.className = 'px-icon' + (modern ? ' hd' : '');
  img.draggable = false;
  return img;
}

export function relicIcon(id, frame = null, dim = false) {
  const fn = ART[id] || (p => M.ball(p, 8, 8, 6, 's'));
  return cached(`r:${id}:${frame}:${dim}`, () => {
    const p = paintMap(fn);
    if (dim) p.a = p.a.map(c => c ? (c === 'k' ? 'k' : 'K') : null);
    return drawPix(p, { frame: dim ? '#3a3450' : frame });
  });
}
export function glyphURL(name) {
  const key = `g:${name}`;
  if (!cache.has(key)) cache.set(key, drawPix(paintMap(GLYPH[name] || GLYPH.star), { bg: false }).toDataURL());
  return cache.get(key);
}
export function itemIcon(id, frame = null) { return relicIcon(id, frame); }
export function achIcon(id, got = true) {
  const fn = ACH[id] || (p => M.trophy(p));
  return cached(`a:${id}:${got}`, () => {
    const p = paintMap(fn);
    if (!got) p.a = p.a.map(c => c ? (c === 'k' ? 'k' : 'd') : null);
    return drawPix(p, { frame: got ? '#ffc21c' : '#3a3450' });
  });
}
export function portraitIcon(id) {
  const fn = PORTRAIT[id] || (p => M.skull(p, 4, 4));
  return cached(`p:${id}`, () => drawPix(paintMap(fn), { frame: '#8fd14f' }));
}
export function glyph(name) {
  return cached(`g:${name}`, () => drawPix(paintMap(GLYPH[name] || GLYPH.star), { bg: false }));
}
// HTML string for inline use inside text
export function glyphHTML(name, cls = '') {
  const key = `g:${name}`;
  if (!cache.has(key)) cache.set(key, drawPix(paintMap(GLYPH[name] || GLYPH.star), { bg: false }).toDataURL());
  return `<img class="gi ${cls}${modern ? ' hd' : ''}" src="${cache.get(key)}" alt="">`;
}
