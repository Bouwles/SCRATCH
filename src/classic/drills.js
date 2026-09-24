// PRACTICE CHALLENGES: short drills on the normal table with the normal
// physics. Each one sets up the balls, reads every shot and keeps a best score.
//   setup(c, d)          put the balls down (d: the drill's running state)
//   read(c, d, r) → { say, ok, over }   what that shot did; over = the drill has ended

import { TABLE } from '../config.js';
import { tableQuality } from './ai.js';

const { L, W, R } = TABLE;
const rnd = (a, b) => a + Math.random() * (b - a);

function put(c, n, x, z) { const b = c.g.physics.addBall(n, x, z); b.y = 0.04; return b; }
function clear(c) { c.g.physics.clearBalls(); c.g.ballView.prune(); }
function free(c, x, z) { return c.g.physics.findFreeSpot(x, z); }

// how evenly a break spread the rack: mean distance to the nearest neighbour
function spread(c) {
  const bs = c.g.physics.balls.filter(b => b.state === 'table' && b.kind !== 'cue');
  if (bs.length < 2) return 1;
  let s = 0;
  for (const a of bs) { let m = 9; for (const b of bs) if (a !== b) m = Math.min(m, Math.hypot(a.x - b.x, a.z - b.z)); s += m; }
  return s / bs.length;
}

export const DRILLS = {
  break: {
    name: 'Break Practice', short: 'BREAK', desc: 'Rack, break, see how it spread. R reracks instantly.', unit: 'balls', tries: 0,
    setup(c) { c.rack(); c.match.isBreak = true; c.match.inHand = true; c.match.kitchen = true; },
    read(c, d, r) {
      const pots = r.pots.filter(n => n !== 0).length, scratch = r.pots.includes(0);
      const sp = spread(c);
      const q = sp >= 0.2 ? 'Excellent' : sp >= 0.15 ? 'Good' : sp >= 0.1 ? 'Fair' : 'Tight';
      const score = scratch ? 0 : pots;
      return { say: [`${pots} potted`, scratch ? 'Scratch' : 'No scratch', `Spread: ${q}`].join(' · '), score, ok: !scratch && pots > 0, over: true, again: true };
    },
  },
  bank: {
    name: 'Bank Practice', short: 'BANKS', desc: 'Ten shots. Only pots that bounce off a cushion first count.', unit: 'banks', tries: 10,
    setup(c) {
      clear(c);
      for (const [n, x, z] of [[1, 0.45, 0.43], [3, -0.25, -0.44], [9, 0.72, -0.36], [11, -0.72, 0.38], [5, 0.1, 0.45]]) put(c, n, x + rnd(-0.05, 0.05), z);
      put(c, 0, -0.2, 0.05);
    },
    read(c, d, r) {
      const banks = r.potBalls.filter(b => b.kind !== 'cue' && b.cushions > 0).length;
      const straight = r.potBalls.filter(b => b.kind !== 'cue' && b.cushions === 0).length;
      d.score += banks;
      if (!c.g.physics.balls.some(b => b.state === 'table' && b.kind !== 'cue')) { this.setup(c); }
      return { say: banks ? `Bank${banks > 1 ? ` ×${banks}` : ''}` : straight ? 'Straight in · does not count' : 'No bank', ok: banks > 0, over: d.tries >= this.tries };
    },
  },
  longpot: {
    name: 'Long Pot', short: 'LONG POTS', desc: 'Ten attempts, the full length of the table, a fresh one every time.', unit: 'pots', tries: 10,
    setup(c) {
      clear(c);
      const sx = Math.random() < 0.5 ? 1 : -1, sz = Math.random() < 0.5 ? 1 : -1;
      put(c, 1 + Math.floor(Math.random() * 7), sx * rnd(0.55, 0.78), sz * rnd(0.12, 0.34));
      put(c, 0, -sx * rnd(0.55, 0.8), rnd(-0.3, 0.3));
      c.match.inHand = false;
    },
    read(c, d, r) {
      const ok = r.potBalls.some(b => b.kind !== 'cue') && !r.pots.includes(0);
      if (ok) d.score++;
      c.g.after(0.6, () => { if (c.match?.drill === d) { this.setup(c); c.beginTurn(); } });
      return { say: ok ? 'Long pot' : r.pots.includes(0) ? 'Scratch' : 'Missed', ok, over: d.tries >= this.tries, hold: true };
    },
  },
  position: {
    name: 'Positioning', short: 'IN ORDER', desc: 'Pot 1 to 7 in order. Every shot sets up the next. One miss ends it.', unit: 'balls', tries: 0,
    setup(c) {
      clear(c);
      for (let n = 1; n <= 7; n++) { const p = free(c, rnd(-0.75, 0.8), rnd(-0.38, 0.38)); put(c, n, p.x, p.z); }
      put(c, 0, -0.85, 0);
      c.match.inHand = true; c.match.kitchen = false;
      c.match.drill.next = 1;
    },
    read(c, d, r) {
      const want = d.next;
      const right = r.firstHit === want && r.pots.includes(want) && !r.pots.includes(0);
      if (right) { d.score++; d.next++; }
      const done = d.next > 7;
      return { say: right ? (done ? 'All seven, in order' : `${want} down · next: ${d.next}`) : r.firstHit !== want ? `Hit the ${want} first` : `The ${want} stayed up`, ok: right, over: done || !right };
    },
  },
  clearance: {
    name: 'Clearance', short: 'CLEARANCE', desc: 'Seven solids and the 8, spread around. Clear the table without missing.', unit: 'balls', tries: 0,
    setup(c) {
      clear(c);
      for (let n = 1; n <= 8; n++) { const p = free(c, rnd(-0.8, 0.85), rnd(-0.4, 0.4)); put(c, n, p.x, p.z); }
      put(c, 0, -0.6, 0);
      c.match.inHand = true; c.match.kitchen = false;
    },
    read(c, d, r) {
      const solids = r.potBalls.filter(b => b.num >= 1 && b.num <= 7).length;
      const eight = r.pots.includes(8), scratch = r.pots.includes(0);
      const left = c.g.physics.balls.filter(b => b.state === 'table' && b.num >= 1 && b.num <= 7).length;
      const early = eight && left > 0;
      if (!early && !scratch) d.score += solids + (eight ? 1 : 0);
      const done = !scratch && !early && eight && left === 0;
      const miss = scratch || early || (solids === 0 && !eight);
      return { say: done ? 'Table cleared' : early ? 'The 8 went early' : scratch ? 'Scratch' : miss ? 'Missed' : `${left} solid${left === 1 ? '' : 's'} to go${left === 0 ? ' · now the 8' : ''}`, ok: !miss, over: done || miss };
    },
  },
  safety: {
    name: 'Safety', short: 'SAFETIES', desc: 'Five attempts. Hit the 1 and leave nothing to pot.', unit: 'safeties', tries: 5,
    setup(c) {
      clear(c);
      const t = free(c, rnd(-0.2, 0.7), rnd(-0.3, 0.3)); put(c, 1, t.x, t.z);
      for (const n of [4, 12, 14]) { const p = free(c, rnd(-0.7, 0.8), rnd(-0.38, 0.38)); put(c, n, p.x, p.z); }
      const q = free(c, rnd(-0.85, -0.45), rnd(-0.3, 0.3)); put(c, 0, q.x, q.z);
      c.match.inHand = false;
    },
    read(c, d, r) {
      const P = c.g.physics, cue = P.cue;
      const legal = r.firstHit === 1 && !r.pots.includes(0) && (r.railAfter || r.pots.length);
      let ok = false, say;
      if (!legal) say = r.firstHit !== 1 ? 'You must hit the 1' : r.pots.includes(0) ? 'Scratch' : 'No cushion after contact';
      else {
        const q = tableQuality(cue, P.balls.filter(b => b.state === 'table'), null, P.pockets, 0.0065);
        ok = q.best < 0.14;
        say = ok ? 'Good safety · nothing to pot' : q.best < 0.35 ? 'Close · a hard pot left on' : 'Left an easy pot';
      }
      if (ok) d.score++;
      c.g.after(0.8, () => { if (c.match?.drill === d) { this.setup(c); c.beginTurn(); } });
      return { say, ok, over: d.tries >= this.tries, hold: true };
    },
  },
};
export const DRILL_IDS = Object.keys(DRILLS);
