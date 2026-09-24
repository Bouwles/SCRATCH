// Physics edge cases, run against the game's own solver in Node:
//   node scripts/physics-tests.mjs
// Every case checks the same invariants: positions stay finite, nothing ends up
// outside the table unless it went down a pocket, the table always comes to
// rest, and no two balls are left overlapping.

import { Physics } from '../src/physics/Physics.js';
import { TABLE, PHYS } from '../src/config.js';

const { L, W, R } = TABLE;
const H = 1 / 240;
let failures = 0, passed = 0;

function settle(ph, maxT = 30) {
  let t = 0;
  while (t < maxT) { ph.step(H); t += H; if (!ph.isMoving()) return t; }
  return -1;
}

function invariants(name, ph, t) {
  const bad = [];
  if (t < 0) bad.push('never came to rest');
  const live = ph.balls.filter(b => b.state === 'table');
  for (const b of live) {
    if (![b.x, b.z, b.vx, b.vz].every(Number.isFinite)) bad.push(`ball ${b.num} has a non-finite value`);
    const inMouth = ph.pockets.some(p => Math.hypot(b.x - p.x, b.z - p.z) < p.holeR + b.r + 0.03);     // resting in a pocket's throat is fine
    if (!inMouth && (Math.abs(b.x) > L - b.r + 0.004 || Math.abs(b.z) > W - b.r + 0.004)) bad.push(`ball ${b.num} outside the cushions at ${b.x.toFixed(3)},${b.z.toFixed(3)}`);
    if (Math.abs(b.x) > L + 0.03 || Math.abs(b.z) > W + 0.03) bad.push(`ball ${b.num} escaped the table at ${b.x.toFixed(3)},${b.z.toFixed(3)}`);
  }
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j], d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < a.r + b.r - 0.002) bad.push(`balls ${a.num} and ${b.num} overlap by ${((a.r + b.r - d) * 1000).toFixed(1)} mm`);
  }
  for (const o of ph.obstacles) for (const b of live) if (Math.hypot(b.x - o.x, b.z - o.z) < b.r + o.r - 0.002) bad.push(`ball ${b.num} inside an obstacle`);
  if (bad.length) { failures++; console.log(`FAIL ${name}: ${[...new Set(bad)].slice(0, 4).join('; ')}`); }
  else passed++;
}

function rack(ph, x0 = TABLE.footX) {
  const dx = 2 * R * Math.cos(Math.PI / 6) + 0.0006, dz = 2 * R + 0.0006;
  let n = 1;
  for (let r = 0; r < 5; r++) for (let i = 0; i <= r; i++) ph.addBall(n++, x0 + r * dx, (i - r / 2) * dz);
}
const speed = (p) => PHYS.minShotSpeed + (PHYS.maxShotSpeed - PHYS.minShotSpeed) * Math.pow(p, 1.55);
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// 1. full-power breaks from many angles, with every kind of spin
for (let i = 0; i < 40; i++) {
  const ph = new Physics();
  const cue = ph.addBall(0, TABLE.headX, (rnd() - 0.5) * 0.3);
  rack(ph);
  ph.strike(cue, 1, (rnd() - 0.5) * 0.06, speed(1) * 1.2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2);
  invariants(`break ${i}`, ph, settle(ph));
}
// 2. maximum-speed shots into the corner jaws and straight down the rails
for (const [x, z, a] of [[0.8, 0.44, 0.785], [-0.8, -0.44, -2.356], [0.0, 0.47, 0], [0.9, 0, 0], [0.5, 0.469, 0.02], [-0.97, 0.46, 0.8]]) {
  const ph = new Physics();
  const cue = ph.addBall(0, x, Math.max(-W + R + 0.001, Math.min(W - R - 0.001, z)));
  ph.strike(cue, Math.cos(a), Math.sin(a), 16, 1, -1);
  invariants(`jaw shot ${x},${z}`, ph, settle(ph));
}
// 3. balls frozen together and frozen to cushions
{
  const ph = new Physics();
  const cue = ph.addBall(0, -0.5, W - R);
  ph.addBall(1, -0.5 + 2 * R, W - R); ph.addBall(2, -0.5 + 4 * R, W - R); ph.addBall(3, -0.5 + 6 * R, W - R);
  ph.strike(cue, 1, 0, 6);
  invariants('frozen line along a rail', ph, settle(ph));
}
// 4. two balls starting slightly overlapped (spawn edge case) must separate
{
  const ph = new Physics();
  ph.addBall(0, 0, 0); ph.addBall(1, 2 * R - 0.004, 0);
  invariants('overlapped spawn', ph, settle(ph));
}
// 5. extreme masses and sizes (giant, heavy, mini balls)
for (let i = 0; i < 12; i++) {
  const ph = new Physics();
  const cue = ph.addBall(0, -0.6, 0);
  const g = ph.addBall(8, 0.2, 0); g.r = R * 2.05; g.m = 5;
  const m = ph.addBall(3, 0.5, 0.2); m.r = R * 0.62; m.m = 0.3;
  const hvy = ph.addBall(4, 0.4, -0.25); hvy.r = R * 1.7; hvy.m = 6;
  ph.strike(cue, Math.cos((rnd() - 0.5) * 0.8), Math.sin((rnd() - 0.5) * 0.8), 8 + rnd() * 8, rnd() - 0.5, rnd() - 0.5);
  invariants(`mass/size mix ${i}`, ph, settle(ph));
}
// 6. obstacles (pillars, walls, bumpers) at speed
for (let i = 0; i < 12; i++) {
  const ph = new Physics();
  const cue = ph.addBall(0, -0.6, (rnd() - 0.5) * 0.4);
  for (let k = 0; k < 4; k++) ph.obstacles.push({ x: -0.1 + k * 0.058, z: 0.05, r: 0.028, rest: 0.75, kind: 'pillar' });
  ph.obstacles.push({ x: 0.4, z: -0.2, r: 0.045, rest: 1.0, kick: 0.5, kind: 'bumper' });
  rack(ph, 0.55);
  ph.strike(cue, Math.cos((rnd() - 0.5)), Math.sin((rnd() - 0.5)), 10 + rnd() * 6);
  invariants(`obstacles ${i}`, ph, settle(ph));
}
// 7. closed pockets, magnets, black-hole gravity, tilt, wind
for (let i = 0; i < 12; i++) {
  const ph = new Physics();
  ph.pockets[1].open = false; ph.pockets[4].open = false;
  ph.buildSegments();
  ph.pockets[0].pull = 2.4; ph.pockets[5].gravity = 3.1;
  Object.assign(ph.params, { tiltX: 0.15, tiltZ: -0.1, windX: 0.2, windZ: 0.1 });
  const cue = ph.addBall(0, -0.5, 0);
  rack(ph);
  ph.strike(cue, 1, (rnd() - 0.5) * 0.2, speed(0.9), rnd() - 0.5, 0);
  invariants(`rule stack ${i}`, ph, settle(ph, 40));
}
// 8. glass-ball chaos and near-zero friction (ZERO FRICTION / LOW GRAVITY)
for (let i = 0; i < 10; i++) {
  const ph = new Physics();
  Object.assign(ph.params, { chaos: 0.32, ballRest: 1.0, muRoll: PHYS.muRoll * 0.18, muSlide: PHYS.muSlide * 0.55, cushionRest: 0.97 });
  const cue = ph.addBall(0, -0.5, 0);
  rack(ph);
  ph.strike(cue, 1, (rnd() - 0.5) * 0.1, speed(1), 0, 0);
  invariants(`chaos and ice ${i}`, ph, settle(ph, 60));
}
// 9. thousands of random shots from random layouts
for (let i = 0; i < 300; i++) {
  const ph = new Physics();
  const cue = ph.addBall(0, (rnd() - 0.5) * 1.8, (rnd() - 0.5) * 0.85);
  for (let k = 1; k <= 1 + Math.floor(rnd() * 14); k++) { const p = ph.randomFreeSpot(0.01); ph.addBall(k, p.x, p.z); }
  const a = rnd() * Math.PI * 2;
  ph.strike(cue, Math.cos(a), Math.sin(a), 0.3 + rnd() * 15, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2);
  invariants(`random ${i}`, ph, settle(ph));
}

console.log(`${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
