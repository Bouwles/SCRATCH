// MASTERY — the skill game underneath the arcade chaos.
//
//  * Technique analysis: recognises real billiards skill (banks, kicks,
//    combinations, caroms, razor cuts, long pots, cue-ball position) and
//    scores it. Balls shoved by relic effects don't count as *skill*.
//  * STYLE (C → ???): rises with interesting shots, falls with misses and
//    repetitive basic pots. Multiplies score, adds chips and intensity.
//  * HEAT (0 → V): how hard the player is dominating the run. Raises rewards,
//    unlocks elite tables, extra modifiers, boss mechanics. Never rises from
//    basic play, so beginners don't feel it.
//  * Double-or-Nothing challenges, rule-combination modifiers, Anomaly tables.
//  * End-of-run grade and personal bests.

import { TABLE } from '../config.js';
import { rand } from './rng.js';

const R = TABLE.R;

// ------------------------------------------------------------ techniques
export function analyzeShot(G, S, e) {
  const pots = S.pots.filter(p => !p.house && !p.devoured && p.ball.kind !== 'cue');
  const T = [];               // [label, points, skill]
  let skill = 0;
  const cats = new Set();
  const add = (label, pts, sk, cat) => { T.push([label, pts, sk]); if (pts > 0 && sk > 0) skill += sk; if (cat) cats.add(cat); };
  const clean = pots.filter(p => !p.ball.relicMoved);       // skill only from balls you moved
  // banks
  let b1 = 0, b2 = 0, b3 = 0;
  for (const p of clean) { const c = p.ball.cushions; if (c >= 3) b3++; else if (c === 2) b2++; else if (c === 1) b1++; }
  for (const p of pots) if (p.ball.relicMoved && p.ball.cushions > 0) T.push(['BANK', 150, 0]);
  if (b1) add(b1 > 1 ? `BANK SHOT x${b1}` : 'BANK SHOT', 250 * b1, 2 * b1, 'bank');
  if (b2) add(b2 > 1 ? `DOUBLE BANK x${b2}` : 'DOUBLE BANK', 650 * b2, 4 * b2, 'bank');
  if (b3) add(b3 > 1 ? `TRIPLE BANK x${b3}` : 'TRIPLE BANK', 1400 * b3, 7 * b3, 'bank');
  // combinations (object ball sunk by another object ball)
  const combos = clean.filter(p => p.kiss).length;
  if (combos) add(combos > 1 ? `COMBINATION x${combos}` : 'COMBINATION', 400 * combos, 3 * combos, 'combo');
  // kick: cue hits a cushion before any ball, then something drops
  if (S.cueCushionFirst > 0 && S.firstHit && clean.length) add('KICK SHOT', 700, 3, 'kick');
  // carom: cue ball glances off 2+ balls in a potting shot
  if (S.cueContacts && S.cueContacts.size >= 2 && clean.length) add('CAROM', 350, 2, 'carom');
  // razor cut on the first ball hit
  const fh = S.firstHit;
  if (fh && S.cutDeg >= 55 && !S.cueCushionFirst && clean.some(p => p.ball === fh)) add(S.cutDeg >= 70 ? 'PAPER CUT' : 'RAZOR CUT', S.cutDeg >= 70 ? 550 : 300, S.cutDeg >= 70 ? 3 : 2, 'cut');
  // long pots
  const longs = clean.filter(p => p.ball.travel >= 1.2).length;
  if (longs) add(longs > 1 ? `LONG POT x${longs}` : 'LONG POT', 220 * longs * (S.longX || 1), longs, 'long');
  // pinball wizard: bumper-assisted pots count as skill
  const pins = clean.filter(p => p.ball.bumped).length;
  if (pins) add('PINBALL POT', 300 * pins, 2 * pins, 'pinball');
  // several techniques in one shot = trick shot
  if (cats.size >= 2) add('TRICK SHOT', 700, 2);
  // cue-ball position: an easy next shot is waiting (only matters if the table goes on)
  if (clean.length && !S.scratch && e && e.progress < e.goal) {
    const nxt = easyShotAvailable(G);
    if (nxt) add('PERFECT POSITION', 250 * (S.posX || 1), 1, 'pos');
  }
  if (skill >= 10) add('INSANE SHOT', 1500, 0);
  return { T, skill, cats, pots, clean };
}

// is there a straightforward pot for the next shot? (cut ≤ 28°, short, clear)
export function easyShotAvailable(G) {
  const ph = G.physics, cue = ph.cue;
  if (!cue || cue.state !== 'table') return false;
  const objs = ph.balls.filter(b => b.state === 'table' && b.kind !== 'cue' && !b.tags.forbidden);
  const clear = (ax, az, bx, bz, ignore) => {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    for (const o of ph.balls) {
      if (o.state !== 'table' || ignore.includes(o)) continue;
      const t = ((o.x - ax) * dx + (o.z - az) * dz) / L2;
      if (t < 0 || t > 1) continue;
      if (Math.hypot(o.x - (ax + dx * t), o.z - (az + dz * t)) < R + o.r) return false;
    }
    return true;
  };
  for (const b of objs) {
    if (b.num === 8 && G.enc && G.enc.progress < G.enc.goal - 1) continue;
    for (const p of ph.pockets) {
      if (!p.open || p.spit) continue;
      const tx = p.mid.x - b.x, tz = p.mid.z - b.z, tl = Math.hypot(tx, tz);
      if (tl > 0.8) continue;
      const ux = tx / tl, uz = tz / tl;
      const gx = b.x - ux * (R + b.r), gz = b.z - uz * (R + b.r);
      const cx = gx - cue.x, cz = gz - cue.z, cl = Math.hypot(cx, cz);
      if (cl > 0.6 || cl < 0.05) continue;
      if ((cx * ux + cz * uz) / cl < Math.cos(20 * Math.PI / 180)) continue;
      if (clear(cue.x, cue.z, gx, gz, [cue, b]) && clear(b.x, b.z, p.mid.x, p.mid.z, [cue, b])) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- style
export const STYLE_GRADES = ['C', 'B', 'A', 'S', 'S+', '???'];
const STYLE_AT = [0, 15, 32, 50, 68, 86];
export const STYLE_MULT = [1, 1.1, 1.25, 1.5, 2, 3];
export const STYLE_COL = ['#8a86a8', '#2bf0ff', '#34e070', '#ffc21c', '#ff8a1b', '#ff2bd6'];
export function styleGrade(v) { let g = 0; for (let i = 0; i < STYLE_AT.length; i++) if (v >= STYLE_AT[i]) g = i; return g; }
export function styleProgress(v) {
  const g = styleGrade(v);
  if (g >= STYLE_AT.length - 1) return 1;
  return (v - STYLE_AT[g]) / (STYLE_AT[g + 1] - STYLE_AT[g]);
}
// returns the new style value
export function styleAfterShot(run, potted, skill, scratch) {
  let v = run.style - 1.5;                          // style has to be sustained
  if (scratch) v -= 16;
  else if (!potted) v -= 10;
  else if (skill <= 1) {
    run.basicRun = (run.basicRun || 0) + 1;
    v += run.basicRun >= 3 ? -2 : 2 + skill;         // the same easy pot over and over gets stale
  } else { run.basicRun = 0; v += Math.min(24, 1 + skill * 4); }
  return Math.max(0, Math.min(100, v));
}
// heat only comes from real technique: a lone long pot or position play doesn't count
export function heatFromSkill(skill) { return Math.max(0, skill - 1); }

// ----------------------------------------------------------------- heat
const HEAT_AT = [0, 12, 30, 55, 85, 120];
export const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V'];
export function heatLevel(pts) { let h = 0; for (let i = 0; i < HEAT_AT.length; i++) if (pts >= HEAT_AT[i]) h = i; return h; }
export function heatProgress(pts) {
  const h = heatLevel(pts);
  if (h >= 5) return 1;
  return (pts - HEAT_AT[h]) / (HEAT_AT[h + 1] - HEAT_AT[h]);
}
export const HEAT_DESC = [
  'Normal run.',
  'More bets on offer. Score and purses climb.',
  'Elite tables start showing up.',
  'Tables gain an extra rule.',
  'Bosses gain an extra mechanic.',
  'INFERNO. Chaos every shot. Enormous scores.',
];

// ----------------------------------------------------------- challenges
export const CHALLENGES = [
  { id: 'bankonly', name: 'BANK SHOTS ONLY', desc: 'Every ball you pot must touch a cushion first.', not: ['bank'],
    pot(G, e, S, pot) { if (!pot.bank) return 'A DIRECT POT'; } },
  { id: 'nomiss', name: 'NO MISSES', desc: 'Every shot must pot a ball.',
    shot(G, e, S, potted) { if (!potted) return 'MISSED'; } },
  { id: 'cushion', name: 'ONE CUSHION MINIMUM', desc: 'The cue ball must touch a cushion every shot.',
    shot(G, e, S) { if (S.cueCushions < 1) return 'NO CUSHION'; } },
  { id: 'multipot', name: 'POT 2 IN ONE SHOT', desc: 'Land a multi-pot at least once before the table ends.', not: ['combo'],
    shot(G, e, S) { if (S.pots.filter(p => !p.house && p.ball.kind !== 'cue').length >= 2) e.chMet = true; },
    win(G, e) { if (!e.chMet) return 'NO MULTI-POT'; } },
  { id: 'nospin', name: 'NO SPIN', desc: 'Dead-centre hits only. Any english breaks the bet.',
    start(G, e, S) { if (Math.abs(S.side) > 0.06 || Math.abs(S.top) > 0.06) return 'SPIN USED'; } },
  { id: 'speed', name: 'SPEED RUN', desc: 'Clear the table within {N} shots.', not: ['blitz'],
    setup(G, e) { e.chN = Math.max(e.goal, e.goal + 3 - Math.floor((G.run.heat || 0) / 2)); },
    shot(G, e) { if (e.shotsTaken >= e.chN && e.progress < e.goal) return 'TOO SLOW'; } },
  { id: 'noguide', name: 'NO AIM GUIDE', desc: 'The aim guide is switched off. Trust your eyes.' },
  { id: 'noscratch', name: 'NO SCRATCHES', desc: 'Scratch once and the bet is off.',
    scratch() { return 'SCRATCHED'; } },
  { id: 'longonly', name: 'LONG POTS ONLY', desc: 'Every ball you pot must travel at least a metre.',
    pot(G, e, S, pot) { if (pot.ball.travel < 1.0) return 'SHORT POT'; } },
  { id: 'corners', name: 'CORNERS ONLY', desc: 'A side-pocket pot breaks the bet.', not: ['precision'],
    pot(G, e, S, pot) { if (pot.pocket.kind === 'side') return 'SIDE POCKET'; } },
];
export function pickChallenge(def, heat) {
  const pool = CHALLENGES.filter(c => !(c.not || []).includes(def.id) && !(def.boss));
  // high heat favours the nastier bets
  const hard = ['nomiss', 'bankonly', 'speed', 'longonly', 'noguide'];
  const weighted = pool.flatMap(c => (hard.includes(c.id) && heat >= 2 ? [c, c] : [c]));
  return weighted[Math.floor(rand() * weighted.length)];
}
export function challengeText(ch, e) { return ch.desc.replace('{N}', e.chN ?? '?'); }

// ------------------------------------------------------------ high stakes
// Optional tables with one rule you must not break. Break it and the table is
// lost (a heart). Keep it and the purse, the relic and the heat are all better.
export const STAKES = [
  { id: 'noscratch', name: 'NO SCRATCHES', desc: 'Scratch once and the table is lost.', scratch() { return 'SCRATCHED'; } },
  { id: 'nomiss', name: 'ONE MISS = FAILURE', desc: 'Every single shot must pot a ball.', not: ['combo', 'blitz', 'trick'],
    shot(G, e, S, potted) { if (!potted) return 'MISSED'; } },
  { id: 'bankonly', name: 'BANK SHOTS ONLY', desc: 'Every ball you pot must come off a cushion.', not: ['bank', 'combo', 'assassin'],
    pot(G, e, S, pot) { if (!pot.bank && pot.ball.kind !== 'cue') return 'A DIRECT POT'; } },
  { id: 'tight', name: 'NO SPARE SHOTS', desc: 'You get {N} shots. Make them count.', not: ['blitz', 'combo', 'trick', 'assassin'],
    setup(G, e) { e.shots = e.shotsMax = e.goal + 2; e.chN = e.shots; } },
  { id: 'noguide', name: 'NO AIM GUIDE', desc: 'The aim guide is switched off. Trust your eyes.' },
  { id: 'fast', name: '2X BALL SPEED', desc: 'Everything hits harder and rolls further.',
    mods(G, P) { P.muRoll *= 0.55; P.muSlide *= 0.75; }, shotStart(G, S) { S.speed *= 1.45; } },
  { id: 'sealed', name: 'TWO POCKETS SEALED', desc: 'Two pockets stay welded shut all table.', not: ['precision'],
    setup(G, e) { const all = [0, 1, 2, 3, 4, 5].sort(() => rand() - 0.5); e.closed = all.slice(0, 2); } },
  { id: 'danger8', name: 'DANGEROUS 8', desc: 'Pot the 8-ball at any time and the table is lost.',
    pot(G, e, S, pot) { if (pot.ball.num === 8 && pot.ball.kind === 'object') return 'POTTED THE 8'; } },
];
export function pickStake(def) {
  const pool = STAKES.filter(st => !(st.not || []).includes(def.id));
  return pool[Math.floor(rand() * pool.length)] || null;
}
export const stakeText = (st, e) => st.desc.replace('{N}', e.chN ?? '?');

// ------------------------------------------------------------ modifiers
// Rule layers built from systems that already exist. diff drives the purse.
export const MODS = [
  { id: 'moon', name: 'MOON GRAVITY', desc: 'Balls barely slow down.', diff: 1, tag: 'friction', mods(G, P) { P.muRoll *= 0.4; P.muSlide *= 0.75; } },
  { id: 'heavy', name: 'HEAVY FELT', desc: 'Everything rolls like it\'s through mud.', diff: 1, tag: 'friction', mods(G, P) { P.muRoll *= 1.7; } },
  { id: 'tilted', name: 'TILTED TABLE', desc: 'The table leans. It always has.', diff: 1, tag: 'tilt', setup(G) { const a = rand() * 6.28; G.setTilt(Math.cos(a) * 0.15, Math.sin(a) * 0.15); } },
  { id: 'shifting', name: 'SHIFTING POCKETS', desc: 'Two pockets close every shot.', diff: 2, tag: 'pockets', setup(G) { G.shufflePockets(4); }, afterShot(G) { G.shufflePockets(4); } },
  { id: 'moving', name: 'MOVING POCKET', desc: 'One pocket seals itself every shot.', diff: 1, tag: 'pockets', setup(G) { G.shufflePockets(5); }, afterShot(G) { G.shufflePockets(5); } },
  { id: 'fever', name: 'POCKET FEVER', desc: 'Pocket sizes change between shots.', diff: 1, tag: 'size', setup(G, e) { G.pocketFever(e, 0.8, 1.55); }, afterShot(G, e) { G.pocketFever(e, 0.8, 1.55); } },
  { id: 'pillars', name: 'STONEHENGE', desc: 'Stone pillars block the felt.', diff: 1, tag: 'obst', setup(G) { for (let i = 0; i < 3; i++) G.addPillar(true); } },
  { id: 'bumpers', name: 'PINBALL FELT', desc: 'Two bumpers kick balls away.', diff: 0, tag: 'obst', setup(G) { G.addBumpers(2); } },
  { id: 'noscratch', name: 'NO SCRATCHING', desc: 'A scratch costs 3 shots.', diff: 1, tag: 'rule', scratchCost: 3 },
  { id: 'limit', name: 'SHOT LIMIT', desc: 'Two fewer shots. Bigger purse.', diff: 2, tag: 'limit', shots: -2 },
  { id: 'dark', name: 'LIGHTS OUT', desc: 'The lamp is dying.', diff: 1, tag: 'light', setup(G) { G.blackout = true; }, afterShot(G) { G.blackout = true; } },
  { id: 'bounce', name: 'SUPERBOUNCE', desc: 'Cushions return everything.', diff: 0, tag: 'rail', mods(G, P) { P.cushionRest = 0.97; } },
  { id: 'gold', name: 'GOLD RUSH', desc: 'A golden ball joins the table.', diff: -1, tag: 'gold', setup(G) { G.later(1.0, () => G.spawnGolden()); } },
  { id: 'tight', name: 'TIGHT POCKETS', desc: 'Cut small. Anything off-centre rattles out.', diff: 2, tag: 'size', pockets(G, pk) { for (const p of pk) p.scale *= 0.74; } },
  { id: 'giantpocket', name: 'ONE GIANT POCKET', desc: 'One pocket is absurdly large.', diff: -1, tag: 'size',
    setup(G, e) { e.giantPocket = Math.floor(rand() * 6); }, pockets(G, pk, e) { if (e?.giantPocket != null) pk[e.giantPocket].scale *= 2.4; } },
  { id: 'bonuspocket', name: 'BONUS POCKET', desc: 'The gold pocket pays double. It moves every shot.', diff: 0, tag: 'bonus',
    setup(G, e) { e.bonusPocket = Math.floor(rand() * 6); },
    afterShot(G, e) { e.bonusPocket = (e.bonusPocket + 1 + Math.floor(Math.random() * 4)) % 6; },
    pockets(G, pk, e) { if (e?.bonusPocket != null && pk[e.bonusPocket].open) pk[e.bonusPocket].bonus = true; } },
  { id: 'heavyball', name: 'HEAVY BALL', desc: 'One ball weighs a ton. Sinking it pays +500.', diff: 1, tag: 'ball',
    setup(G) {
      const objs = G.physics.balls.filter(b => b.kind === 'object' && b.num !== 8 && !b.tags.giant);
      const b = objs[Math.floor(rand() * objs.length)];
      if (!b) return;
      b.m = 4; b.r = R * 1.28; b.tags.heavy = true;
      const s = G.physics.findFreeSpot(b.x, b.z, b); b.x = s.x; b.z = s.z;
    } },
  { id: 'danger8', name: 'DANGEROUS 8', desc: 'Sink the 8 early and it costs a HEART, not shots.', diff: 1, tag: 'rule', danger8: true },
];
export function rollMods(n, def) {
  const out = [];
  const tags = new Set();
  const pool = MODS.filter(m => !(def.id === 'precision' && m.tag === 'pockets') && !(def.id === 'blitz' && m.id === 'limit') && !(def.id === 'golden' && m.id === 'gold'));
  for (let i = 0; i < 20 && out.length < n; i++) {
    const m = pool[Math.floor(rand() * pool.length)];
    if (tags.has(m.tag) || out.includes(m)) continue;
    tags.add(m.tag); out.push(m);
  }
  return out;
}
// how many rule layers a table gets: readable early, combinatorial late
export function modCount(floor, node, heat, kind, breakLv = 0) {
  let n = 0;
  if (floor === 1) n = node >= 4 && rand() < 0.35 ? 1 : 0;
  else if (floor === 2) n = rand() < 0.55 ? 1 : 0;
  else n = 1 + (rand() < 0.4 ? 1 : 0);
  if (floor === 1 && breakLv >= 2 && node >= 2) n = Math.max(n, 1);
  if (floor >= 6) n++;
  if (heat >= 3) n++;
  if (kind === 'elite') n++;
  return Math.min(3, n);
}

// ------------------------------------------------------------ anomalies
export const ANOMALIES = [
  { id: 'mirror', name: 'MIRROR TABLE', desc: 'Everything is reversed. Even your hands.',
    setup(G) { G.renderer.mirror = true; }, cleanup(G) { G.renderer.mirror = false; } },
  { id: 'giant', name: 'GIANT BALL', desc: 'One ball is ridiculous. Sinking it pays triple.',
    setup(G) {
      const objs = G.physics.balls.filter(b => b.kind === 'object' && b.num !== 8);
      const b = objs[Math.floor(rand() * objs.length)];
      if (!b) return;
      b.r = R * 2.05; b.m = 5; b.tags.giant = true;
      const s = G.physics.findFreeSpot(0.1, 0, b); b.x = s.x; b.z = s.z;
    } },
  { id: 'mini', name: 'MINI BALLS', desc: 'Half the rack shrank in the wash.',
    setup(G) { G.physics.balls.filter(b => b.kind === 'object' && b.num !== 8).forEach((b, i) => { if (i % 2 === 0) { b.r = R * 0.62; b.m = 0.3; } }); } },
  { id: 'storm', name: 'STORM', desc: 'Lightning in the club. The felt changes every flash.',
    setup(G, e) { G.stormFlash(e); }, afterShot(G, e) { G.stormFlash(e); } },
  { id: 'zero', name: 'ZERO FRICTION', desc: 'Nothing wants to stop. Ever.',
    mods(G, P) { P.muRoll *= 0.18; P.muSlide *= 0.55; P.cushionRest = Math.max(P.cushionRest, 0.9); } },
  { id: 'feverxl', name: 'POCKET FEVER XL', desc: 'The pockets breathe. Wildly.',
    setup(G, e) { e.feverXL = true; } },
  { id: 'multiball', name: 'MULTIBALL', desc: 'Bonus balls keep raining down. Each one pays.',
    setup(G) { for (let i = 0; i < 3; i++) G.later(1 + i * 0.3, () => G.spawnDropBall(16 + i, 'bonus')); },
    afterShot(G, e) { e.mbTick = (e.mbTick || 0) + 1; if (e.mbTick % 2 === 0) G.spawnDropBall(16 + e.mbTick, 'bonus'); } },
];
// a very rare table nobody quite remembers
// (Game.update holds the colour drained and the tape warbling while it lasts)
export const SECRET_ANOMALY = { id: 'flashback', name: 'THE TABLE FROM 1987', secret: true, desc: 'You have been here before. You lost.',
  setup(G) { G.audio.tone(220, { type: 'sine', dur: 2.5, vol: 0.1, slide: 180, verb: 0.9 }); G.achieve('flashback'); } };
export function pickAnomaly() {
  if (rand() < 0.035) return SECRET_ANOMALY;
  return ANOMALIES[Math.floor(rand() * ANOMALIES.length)];
}

export function anomalyChance(floor, node, heat) {
  if (floor === 1 && node < 2) return 0;
  return Math.min(0.22, 0.06 + heat * 0.03);
}

// ------------------------------------------------------------ run grade
export function gradeRun(run, won) {
  const floorsDone = run.floor - 1 + (won ? 1 : 0);
  let pts = floorsDone * 18 + (won ? 16 : 0) + (run.heatMax || 0) * 6 + (run.stylePeak || 0) * 4;
  pts += Math.min(20, run.score / 60000 * 20);
  pts -= Math.min(8, run.stats.scratches || 0);
  const g = pts >= 92 ? 'S+' : pts >= 78 ? 'S' : pts >= 62 ? 'A' : pts >= 46 ? 'B' : pts >= 30 ? 'C' : 'D';
  return { grade: g, pts };
}
const GRADE_ORDER = ['D', 'C', 'B', 'A', 'S', 'S+'];
export function betterGrade(a, b) { return GRADE_ORDER.indexOf(a) > GRADE_ORDER.indexOf(b || ''); }

// words for genuinely exceptional shots (never repeats back-to-back)
const WORDS = ['FILTHY.', 'NO WAY.', 'PERFECT.', 'CALCULATED.', 'ABSURD.', 'JACKPOT.', 'WHAT?', 'SURGICAL.', 'DISGUSTING.', 'UNREAL.'];
let lastWord = '';
export function reactionWord() {
  let w;
  do { w = WORDS[Math.floor(rand() * WORDS.length)]; } while (w === lastWord);
  lastWord = w;
  return w;
}
