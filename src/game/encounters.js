// ENCOUNTERS — small billiards challenges. Each one is a goal, a shot budget
// and a rule twist. Bosses are encounters where the TABLE fights back.

import { TABLE } from '../config.js';
import { rand } from './rng.js';

const R = TABLE.R;

// ------------------------------------------------------------------ layouts
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function numbersFor(n, withEight = true) {
  const pool = shuffle([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
  const nums = pool.slice(0, withEight ? n - 1 : n);
  if (withEight) nums.splice(Math.min(nums.length, n >= 6 ? 4 : nums.length), 0, 8);
  return nums;
}

export function rackTriangle(G, n = 15, x0 = TABLE.footX, withEight = true) {
  const rows = n <= 3 ? 2 : n <= 6 ? 3 : n <= 10 ? 4 : 5;
  const nums = numbersFor(n, withEight);
  const dx = 2 * R * Math.cos(Math.PI / 6) + 0.0006, dz = 2 * R + 0.0006;
  let k = 0;
  for (let r = 0; r < rows && k < n; r++) {
    for (let i = 0; i <= r && k < n; i++) {
      G.addBall(nums[k++], x0 + r * dx, (i - r / 2) * dz + (rand() - 0.5) * 0.0004);
    }
  }
  return 'triangle';
}

export function rackDiamond(G, x0 = TABLE.footX) {
  const rows = [1, 2, 3, 2, 1];
  const nums = numbersFor(9, true);
  const dx = 2 * R * Math.cos(Math.PI / 6) + 0.0006, dz = 2 * R + 0.0006;
  let k = 0;
  rows.forEach((c, r) => { for (let i = 0; i < c; i++) G.addBall(nums[k++], x0 + r * dx, (i - (c - 1) / 2) * dz); });
  return 'triangle';
}

export function rackScatter(G, n = 9, withEight = true) {
  const nums = numbersFor(n, withEight);
  for (const num of nums) {
    const p = G.physics.randomFreeSpot(0.12);
    if (p.x < -0.45 && Math.abs(p.z) < 0.2) { p.x += 0.5; }
    const q = G.physics.findFreeSpot(p.x, p.z);
    G.addBall(num, q.x, q.z);
  }
  return 'scatter';
}

export function rackClusters(G, k = 3, withEight = true) {
  const nums = numbersFor(k * 3, withEight);
  let idx = 0;
  for (let c = 0; c < k; c++) {
    let p = null;
    for (let t = 0; t < 60; t++) {
      const x = -0.25 + rand() * 1.05, z = (rand() * 2 - 1) * 0.3;
      if (G.physics.isFree(x, z, 0.12) && G.physics.isFree(x + 0.06, z, 0.1)) { p = { x, z }; break; }
    }
    if (!p) p = G.physics.randomFreeSpot(0.15);
    const a = rand() * Math.PI;
    for (let i = 0; i < 3; i++) {
      const ang = a + i * Math.PI * 2 / 3;
      G.addBall(nums[idx++], p.x + Math.cos(ang) * R * 1.16, p.z + Math.sin(ang) * R * 1.16);
    }
  }
  return 'scatter';
}

// tight 3-ball clusters parked near pockets — set pieces for combos
export function rackPocketClusters(G, k = 4, withEight = true) {
  const nums = numbersFor(k * 3, withEight);
  const spots = G.physics.pockets.filter(p => p.open).sort(() => rand() - 0.5).slice(0, k);
  let idx = 0;
  for (const p of spots) {
    const d = 0.1 + rand() * 0.08;
    const cx = p.mid.x - p.out.x * d, cz = p.mid.z - p.out.z * d;
    const a = Math.atan2(-p.out.z, -p.out.x);
    for (let i = 0; i < 3; i++) {
      const ang = a + Math.PI / 3 + i * Math.PI * 2 / 3;
      const q = G.physics.findFreeSpot(cx + Math.cos(ang) * R * 1.17, cz + Math.sin(ang) * R * 1.17);
      G.addBall(nums[idx++], q.x, q.z);
    }
  }
  while (idx < nums.length) { const q = G.physics.randomFreeSpot(0.15); G.addBall(nums[idx++], q.x, q.z); }
  return 'scatter';
}

export function rackLine(G, n = 7, withEight = true) {
  const nums = numbersFor(n, withEight);
  const z = (rand() - 0.5) * 0.4;
  nums.forEach((num, i) => G.addBall(num, 0.05 + i * (2 * R + 0.012), z + Math.sin(i) * 0.02));
  return 'scatter';
}

function randomRack(G, n) {
  const r = rand();
  if (n >= 9 && r < 0.2) return rackDiamond(G);
  if (r < 0.62) return rackTriangle(G, n);
  if (r < 0.82) return rackClusters(G, Math.max(2, Math.round(n / 3)));
  return rackScatter(G, n);
}

// ----------------------------------------------------------- chaos rules
export const CHAOS = [
  { id: 'tilt', name: 'EARTHQUAKE', desc: 'The table lurches.', apply(G) { const a = rand() * 6.28; G.setTilt(Math.cos(a) * 0.17, Math.sin(a) * 0.17); } },
  { id: 'moon', name: 'MOON GRAVITY', desc: 'Nothing wants to stop.', mods(G, P) { P.muRoll *= 0.3; P.muSlide *= 0.7; } },
  { id: 'mega', name: 'MEGA POCKETS', desc: 'The pockets are hungry.', pockets(G, pk) { for (const p of pk) p.scale *= 2.0; } },
  { id: 'bounce', name: 'SUPERBOUNCE', desc: 'Cushions return everything.', mods(G, P) { P.cushionRest = 1.0; } },
  { id: 'magnet', name: 'MAGNET STORM', desc: 'Every pocket pulls.', pockets(G, pk) { for (const p of pk) p.pull += 1.3; } },
  { id: 'wind', name: 'HURRICANE', desc: 'A strange wind blows across the felt.', apply(G) { const a = rand() * 6.28; G.chaosWind = [Math.cos(a) * 0.45, Math.sin(a) * 0.45]; }, mods(G, P) { if (G.chaosWind) { P.windX = G.chaosWind[0]; P.windZ = G.chaosWind[1]; } } },
  { id: 'glass', name: 'GLASS TABLE', desc: 'Collisions go haywire.', mods(G, P) { P.chaos += 0.2; P.ballRest = 1.0; } },
  { id: 'power', name: 'OVERDRIVE', desc: 'Double shot power.', shotStart(G, S) { S.speed *= 1.7; } },
  { id: 'sticky', name: 'TAR PIT', desc: 'Sticky felt. Pots score double.', mods(G, P) { P.muRoll *= 2.2; }, shotEnd(G, S) { if (S.pots.length) S.multX *= 2; } },
  { id: 'blackout', name: 'BLACKOUT', desc: 'Who turned off the lights?', apply(G) { G.blackout = true; } },
];

// ------------------------------------------------------------ encounters
// per-floor params are arrays indexed by floor-1
export const ENCOUNTERS = {
  standard: {
    id: 'standard', name: 'STANDARD', tag: 'SINK', minFloor: 1, weight: 10,
    blurb: 'Sink the balls before you run out of shots.',
    params: { goal: [4, 5, 6], shots: [8, 8, 8], rack: [10, 15, 15] },
    setup(G, e) { e.layout = randomRack(G, e.p.rack); },
    objective: e => `SINK ${e.goal} BALLS`,
  },
  combo: {
    id: 'combo', name: 'COMBO', tag: 'COMBO', minFloor: 1, weight: 7,
    blurb: 'Every pot makes its pocket hungry for a moment. Start a chain reaction — sink 2+ in one shot.',
    params: { goal: [1, 2, 3], shots: [7, 8, 9], rack: [15, 15, 15] },
    setup(G, e) { e.layout = rand() < 0.4 ? rackTriangle(G, e.p.rack) : rackPocketClusters(G, 4); },
    pockets(G, pk) { for (const p of pk) p.scale *= 1.3; },
    mods(G, P) { P.hungry = 1.3; },
    progress(G, S, e) { return S.counted >= 2 ? 1 : 0; },
    objective: e => e.goal === 1 ? 'LAND A COMBO (2+ BALLS IN ONE SHOT)' : `LAND ${e.goal} COMBOS (2+ BALLS IN ONE SHOT)`,
  },
  precision: {
    id: 'precision', name: 'PRECISION', tag: 'CORNERS', minFloor: 1, weight: 7,
    blurb: 'The side pockets are welded shut. Corners only.',
    params: { goal: [4, 5, 5], shots: [8, 7, 7], rack: [9, 10, 11] },
    setup(G, e) { e.layout = rackScatter(G, e.p.rack); },
    pockets(G, pk) { pk[1].open = false; pk[4].open = false; },
    objective: e => `SINK ${e.goal} BALLS — CORNERS ONLY`,
  },
  blitz: {
    id: 'blitz', name: 'BLITZ', tag: 'TIMER', minFloor: 1, weight: 6,
    blurb: 'Unlimited shots. The clock is the enemy.',
    params: { goal: [5, 6, 7], shots: [99, 99, 99], rack: [10, 15, 15], time: [75, 80, 85] },
    setup(G, e) { e.timer = e.p.time; e.layout = randomRack(G, e.p.rack); },
    objective: e => `SINK ${e.goal} BEFORE THE CLOCK DIES`,
  },
  trick: {
    id: 'trick', name: 'TRICK SHOT', tag: 'KICK', minFloor: 1, weight: 5,
    blurb: 'Pots only count if the cue ball also touches a cushion during the shot.',
    params: { goal: [2, 3, 3], shots: [8, 8, 9], rack: [9, 10, 11] },
    laser: true,
    setup(G, e) { e.layout = rackScatter(G, e.p.rack); },
    progress(G, S) { return S.cueCushions > 0 ? S.counted : 0; },
    objective: e => `SINK ${e.goal} — CUE BALL MUST HIT A CUSHION`,
  },
  bank: {
    id: 'bank', name: 'BANK SHOT', tag: 'BANK', minFloor: 1, weight: 6,
    blurb: 'Direct pots don\'t count. Every scored ball must touch a cushion first.',
    params: { goal: [2, 3, 3], shots: [8, 8, 9], rack: [9, 10, 12] },
    laser: true,
    setup(G, e) { e.layout = rackScatter(G, e.p.rack); },
    counts(G, S, pot) { return pot.bank; },
    objective: e => `BANK ${e.goal} BALLS OFF A CUSHION`,
  },
  golden: {
    id: 'golden', name: 'GOLDEN BALL', tag: 'GOLD', minFloor: 1, weight: 6,
    blurb: 'A golden ball keeps appearing. It\'s worth a fortune.',
    params: { goal: [4, 5, 6], shots: [8, 8, 8], rack: [10, 12, 15] },
    setup(G, e) { e.layout = randomRack(G, e.p.rack); G.later(1.0, () => G.spawnGolden()); },
    afterShot(G, e) {
      e.goldTick = (e.goldTick || 0) + 1;
      const hasGold = G.physics.balls.some(b => b.kind === 'golden' && b.state === 'table');
      if (hasGold && e.goldTick % 3 === 0) G.removeGolden();
      else if (!hasGold && e.goldTick % 2 === 0) G.spawnGolden();
    },
    objective: e => `SINK ${e.goal} BALLS — GRAB THE GOLD`,
  },
  survival: {
    id: 'survival', name: 'SURVIVAL', tag: 'MISS', minFloor: 2, weight: 6,
    blurb: 'Every shot that misses drops a stone pillar onto the table.',
    params: { goal: [6, 6, 7], shots: [11, 11, 12], rack: [15, 15, 15] },
    setup(G, e) { e.layout = randomRack(G, e.p.rack); },
    afterShot(G, e, S) { if (!S.pots.length) G.addPillar(); },
    objective: e => `SINK ${e.goal} — EVERY MISS ADDS A PILLAR`,
  },
  chaos: {
    id: 'chaos', name: 'CHAOS', tag: 'CHAOS', minFloor: 2, weight: 6,
    blurb: 'A random table rule activates after every shot.',
    params: { goal: [5, 5, 6], shots: [8, 8, 8], rack: [12, 15, 15] },
    setup(G, e) { e.layout = randomRack(G, e.p.rack); G.rollChaos(); },
    afterShot(G, e) { G.rollChaos(); },
    objective: e => `SINK ${e.goal} — CHAOS REIGNS`,
  },
  assassin: {
    id: 'assassin', name: 'ASSASSIN', tag: 'HIT', minFloor: 1, weight: 5,
    blurb: 'Sink the marked ball. Touch the red ones and you pay.',
    params: { goal: [1, 2, 2], shots: [5, 7, 7], rack: [9, 10, 12] },
    setup(G, e) { e.layout = rackScatter(G, e.p.rack, false); G.markAssassin(); },
    counts(G, S, pot) { return !!pot.ball.tags.target; },
    objective: e => `SINK THE MARKED BALL (${e.goal}) — AVOID RED`,
  },
  classic: {
    id: 'classic', name: 'CLASSIC 8', tag: '8-BALL', minFloor: 1, weight: 0,
    blurb: 'Solids 1-7, then the 8. Like your uncle taught you.',
    params: { goal: [8, 8, 8], shots: [13, 13, 13], rack: [15, 15, 15] },
    setup(G, e) { e.layout = rackTriangle(G, 15); },
    counts(G, S, pot) {
      const n = pot.ball.num;
      if (n >= 1 && n <= 7) return true;
      return n === 8 && G.enc.progress >= 7;
    },
    classic: true,
    objective: e => e.progress >= 7 ? 'NOW SINK THE 8' : `SINK SOLIDS 1-7 (${e.progress}/7), THEN THE 8`,
  },
};

// --------------------------------------------------------------- bosses
export const BOSSES = {
  crooked: {
    id: 'crooked', name: 'THE CROOKED TABLE', boss: true, jp: '歪んだ台', cap: 3,
    blurb: 'The whole table tilts between shots. Read the slope.',
    intro: 'IT LEANS. IT LISTENS. IT NEVER STOPS MOVING.',
    params: { goal: [5, 6, 7], shots: [9, 9, 10], rack: [15, 15, 15] },
    color: '#ffb020',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); G.crookedTilt(0.075); },
    // I: a gentle lean  II: it shifts every shot  III: every pot makes it heave
    afterShot(G, e, S) {
      if (e.phase >= 3 && S?.counted > 0) G.crookedTilt(0.19, 'THE TABLE HEAVES');
      else if (e.phase >= 2 || e.bossPlus) G.crookedTilt();
    },
    phases: ['A GENTLE LEAN', 'THE SLOPE MOVES EVERY SHOT', 'EVERY POT MAKES IT HEAVE'],
    objective: e => `SINK ${e.goal} ON A MOVING SLOPE`,
  },
  mimic: {
    id: 'mimic', name: 'THE MIMIC', boss: true, jp: 'ミミック', cap: 3,
    blurb: 'Pockets snap shut and reopen elsewhere. One of them bites back.',
    intro: 'NOT EVERY POCKET IS A POCKET.',
    params: { goal: [5, 6, 7], shots: [9, 9, 10], rack: [15, 15, 15] },
    color: '#ff3b5c',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); G.mimicShuffle(); },
    afterShot(G) { G.mimicShuffle(); },
    phases: ['FOUR POCKETS OPEN', 'ONE OF THEM BITES BACK', 'IT BITES EVERY TIME'],
    objective: e => `SINK ${e.goal} — BEWARE THE RED EYES`,
  },
  void: {
    id: 'void', name: 'THE VOID', boss: true, jp: '虚無', cap: 3,
    blurb: 'One pocket is a black hole. It bends every shot and devours what it eats.',
    intro: 'THE FELT IS THIN HERE. SOMETHING IS UNDERNEATH.',
    params: { goal: [5, 6, 7], shots: [9, 9, 10], rack: [15, 15, 15] },
    color: '#9a4bff',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); G.voidMove(); },
    afterShot(G) { G.voidMove(); },
    counts(G, S, pot) { return !pot.pocket.devour; },
    phases: ['ONE HOLE IN THE WORLD', 'IT PULLS HARDER', 'A SECOND VOID OPENS'],
    objective: e => `SINK ${e.goal} — THE VOID DEVOURS`,
  },
  house: {
    id: 'house', name: 'THE HOUSE', boss: true, jp: '胴元', cap: 2,
    blurb: 'Miss, and the table takes its own shot. What it sinks, it steals. Only 2 of your pots count per shot.',
    intro: 'THE HOUSE ALWAYS WINS.',
    params: { goal: [6, 7, 7], shots: [10, 10, 11], rack: [15, 15, 15] },
    color: '#2bf0ff',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); },
    house: true,
    phases: ['THE HOUSE PLAYS YOUR MISSES', 'IT ALSO PLAYS EVERY THIRD POT', 'IT PLAYS EVERY SECOND POT'],
    objective: e => `SINK ${e.goal} — THE HOUSE PLAYS YOUR MISSES`,
  },
  dealer: {
    id: 'dealer', name: 'THE DEALER', boss: true, jp: 'ディーラー', cap: 3,
    blurb: 'Before every shot the Dealer marks one pocket GOLD and one RED. Gold pots count double. Red pots count for nothing.',
    intro: 'THE DECK IS STACKED. SO IS THE TABLE.',
    params: { goal: [5, 6, 7], shots: [9, 9, 10], rack: [15, 15, 15] },
    color: '#34e070',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); G.dealerDeal(); },
    afterShot(G) { G.dealerDeal(); },
    progress(G, S) { return S.counted + (S.dealerHi || 0); },
    phases: ['ONE GOLD, ONE RED', 'TWO RED POCKETS', 'BUSTING COSTS A SHOT'],
    objective: e => `SINK ${e.goal} — GOLD COUNTS DOUBLE, RED BUSTS`,
  },
  clock: {
    id: 'clock', name: 'THE CLOCK', boss: true, jp: '時計', cap: 3,
    blurb: 'You only get a few seconds to aim. When time runs out the cue fires itself. Trick shots buy time back.',
    intro: 'TICK. TICK. TICK.',
    params: { goal: [5, 6, 7], shots: [10, 10, 11], rack: [15, 15, 15] },
    color: '#ff8a1b',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); e.clock = 15; e.clockBank = 0; },
    afterShot(G, e) { e.clock = (e.phase >= 3 ? 7 : e.phase >= 2 ? 10 : 15) - (e.bossPlus ? 2 : 0) + (e.clockBank || 0); e.clockBank = 0; },
    phases: ['FIFTEEN SECONDS A SHOT', 'TEN SECONDS', 'SEVEN'],
    objective: e => `SINK ${e.goal} BEFORE THE CLOCK FIRES FOR YOU`,
  },
};

export function makeEncounter(def, floor, kind = 'table') {
  const f = Math.max(0, Math.min(2, floor - 1));
  const p = {};
  for (const [k, v] of Object.entries(def.params)) p[k] = Array.isArray(v) ? v[f] : v;
  const e = {
    def, kind, p, floor,
    goal: p.goal, shots: p.shots, shotsMax: p.shots,
    progress: 0, timer: p.time || 0,
    misses: 0, shotsTaken: 0,
  };
  if (kind === 'elite') {
    e.goal += def.id === 'combo' || def.id === 'trick' || def.id === 'assassin' ? 0 : 1;
    e.reward = 8;
  } else if (kind === 'boss') e.reward = 12;
  else e.reward = 5;
  return e;
}

export function pickEncounterTypes(floor, n = 2, exclude = []) {
  const pool = Object.values(ENCOUNTERS).filter(d => d.weight > 0 && d.minFloor <= floor && !exclude.includes(d.id));
  const out = [];
  while (out.length < n && pool.length) {
    const tot = pool.reduce((a, d) => a + d.weight, 0);
    let x = rand() * tot;
    let i = 0;
    for (; i < pool.length; i++) { x -= pool[i].weight; if (x <= 0) break; }
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  return out;
}
