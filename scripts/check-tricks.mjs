// Proves every Trick Table can actually be solved: plays each puzzle with the
// game's own physics (Physics.js runs fine in Node) across a sweep of angles,
// powers and spins, and counts the shots that pass the puzzle's own check.
//   node scripts/check-tricks.mjs          (all puzzles)
//   node scripts/check-tricks.mjs escape   (one puzzle)

import { Physics } from '../src/physics/Physics.js';
import { PHYS } from '../src/config.js';
import { TRICK_PUZZLES } from '../src/game/afterhours.js';

const only = process.argv[2];
const H = 1 / 240;

function setup(pz) {
  const ph = new Physics();
  const cue = ph.addBall(0, pz.cue[0], pz.cue[1]);
  for (const [x, z, num] of pz.target) { const b = ph.addBall(num, x, z); b.tags.trick = true; }
  for (const [x, z, num] of pz.others) ph.addBall(num, x, z);
  ph.obstacles = (pz.pillars || []).map(([x, z]) => ({ x, z, r: 0.03, rest: 0.55, kind: 'pillar' }));
  return { ph, cue };
}

// the fields of the game's shot record that puzzle checks read
function play(pz, angle, power, side, top) {
  const { ph, cue } = setup(pz);
  const S = { pots: [], scratch: false, cueCushionFirst: 0, firstHit: null };
  ph.listener = (type, a, b) => {
    if (type === 'ballBall') {
      const hit = a.kind === 'cue' ? b : b.kind === 'cue' ? a : null;
      if (hit && !S.firstHit) S.firstHit = hit;
    } else if (type === 'cushion') {
      if (a.kind === 'cue' && !S.firstHit) S.cueCushionFirst++;
    } else if (type === 'pocket') {
      if (a.kind === 'cue') S.scratch = true;
      else S.pots.push({ ball: a, pocket: b, bank: a.cushions > 0, kiss: !!(a.lastToucher && a.lastToucher.kind !== 'cue'), counted: true });
    }
  };
  for (const b of ph.balls) b.resetShotStats();
  const speed = PHYS.minShotSpeed + (PHYS.maxShotSpeed - PHYS.minShotSpeed) * Math.pow(power, 1.55);
  ph.strike(cue, Math.cos(angle), Math.sin(angle), speed, side * 0.9, top * 0.9);
  let t = 0;
  while (t < 14) {
    ph.step(H);
    t += H;
    if (!ph.isMoving()) break;
  }
  return pz.check(null, S);
}

const results = [];
for (const pz of TRICK_PUZZLES) {
  if (only && pz.id !== only) continue;
  const t0 = Date.now();
  let tried = 0, solved = 0;
  const hits = [];
  for (let a = 0; a < 720; a++) {
    const angle = (a / 720) * Math.PI * 2;
    for (const power of [0.3, 0.45, 0.6, 0.75, 0.9]) {
      for (const [side, top] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.5], [0, -0.5]]) {
        tried++;
        if (play(pz, angle, power, side, top)) { solved++; if (hits.length < 3) hits.push({ deg: +(angle * 180 / Math.PI).toFixed(1), power, side, top }); }
      }
    }
  }
  const rate = solved / tried;
  results.push({ id: pz.id, solved, tried, rate: (rate * 100).toFixed(2) + '%', ms: Date.now() - t0, examples: hits });
  console.log(`${pz.id.padEnd(14)} ${solved ? 'SOLVABLE' : 'NO SOLUTION'}  ${solved}/${tried} shots (${(rate * 100).toFixed(2)}%)  ${hits.map(h => `${h.deg}° p${h.power} s${h.side}/${h.top}`).join('  ')}`);
}
const bad = results.filter(r => !r.solved);
if (bad.length) { console.error(`UNSOLVABLE: ${bad.map(r => r.id).join(', ')}`); process.exit(1); }
