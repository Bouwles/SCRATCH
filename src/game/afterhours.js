// AFTERHOURS — the run systems added in 2.0: Table States, Contracts, Rivals,
// hidden relic synergies, Overcharge, risk handicaps, build names, commentary.
// Everything here is data plus small hooks; run.js and shot.js call into it at
// fixed points so the billiards stays in charge.

import { rand } from './rng.js';

// ------------------------------------------------------------ table states
// A state bends the whole club for a few tables. Only one at a time.
// Hooks (all optional): encounterStart(G, e), mods(G, P), shotStart(G, S),
// pot(G, S, pot), shotEnd(G, S, A, e), afterShot(G, e, S).
export const TABLE_STATES = [
  {
    id: 'blackout', name: 'BLACKOUT', jp: '停電', line: 'THE CLUB HAS LOST POWER.', color: '#8fb8ff', tables: 3, reward: 1.35,
    desc: 'The room goes dark and the balls glow. Every pot lights the place up. Purses +35%.',
    encounterStart(G) { G.blackout = 'deep'; },
    afterShot(G) { G.blackout = 'deep'; },
    pot(G, S, pot) { G.blackoutPulse = 1; G.lights.flash(G.worldPos(pot.pocket.x, pot.pocket.z, 0.6), 0xfff0d0, 3.4, 3.2, 0.9); },
  },
  {
    id: 'overtime', name: 'OVERTIME', jp: '延長戦', line: 'THE CLOCK IS RUNNING.', color: '#ff8a1b', tables: 3, reward: 1.25,
    desc: 'Two fewer shots a table. Every multi-pot hands one back. Quick shots score more.',
    encounterStart(G, e) { if (e.def.id !== 'blitz') { e.shots = Math.max(e.goal + 1, e.shots - 2); e.shotsMax = e.shots; } },
    shotEnd(G, S, A, e) {
      const n = S.pots.filter(p => !p.house && p.counted).length;
      if (n >= 2 && (e.otRefunds || 0) < 3) { e.otRefunds = (e.otRefunds || 0) + 1; e.shots++; G.ui.popup('+1 SHOT  OVERTIME', { color: '#ff8a1b', scale: 1.2 }); }
      if (S.quick && n) S.lines.push(['QUICK DRAW', 250 * n]);
    },
  },
  {
    id: 'jackpot', name: 'JACKPOT', jp: '大当たり', line: 'THE HOUSE IS PAYING OUT.', color: '#ffd040', tables: 3, reward: 1,
    desc: 'Golden balls everywhere. Chips pay double. Shops charge 40% more.',
    chipsMul: 2, priceMul: 1.4,
    encounterStart(G) { G.later(1.0, () => G.spawnGolden()); },
    afterShot(G) { if (!G.physics.balls.some(b => b.kind === 'golden' && b.state === 'table') && Math.random() < 0.6) G.spawnGolden(); },
    pot(G, S, pot) { if (pot.ball.kind === 'golden') { const greed = G.run.relics.filter(r => r.tags?.includes('GREED')).length; if (greed) { S.chips += greed * 2; G.ui.worldPop(`GREED +${greed * 2}`, G.worldPos(pot.pocket.x, pot.pocket.z, 0.2), '#ffd040'); } } },
  },
  {
    id: 'static', name: 'STATIC', jp: '砂嵐', line: 'SOMETHING IS WRONG WITH THE WIRING.', color: '#a0e8ff', tables: 3, reward: 1.25,
    desc: 'Stray arcs jump across the table. Relics surge and short out. Lightning hits twice as hard.',
    shotStart(G, S) {
      S.static = true;
      const rs = G.run.relics.filter(r => !r.stack);
      if (rs.length && Math.random() < 0.3) {
        const r = rs[Math.floor(Math.random() * rs.length)];
        if (Math.random() < 0.65) { S.surge = r.id; S.multX *= 1.5; G.ui.popup(`${r.name} SURGES`, { color: '#a0e8ff', scale: 1.1 }); }
        else { S.shorted = r.id; G.ui.popup(`${r.name} SHORTED OUT`, { color: '#8a90a8', scale: 1.0 }); }
        G.ui.pulseRelic(r.id);
      }
    },
    afterShot(G) {
      if (Math.random() > 0.4) return;
      const objs = G.physics.balls.filter(b => b.state === 'table' && b.kind !== 'cue');
      if (objs.length < 2) return;
      const a = objs[Math.floor(Math.random() * objs.length)];
      G.fx.lightning(a.x, a.z, a.x + (Math.random() - 0.5) * 0.3, a.z + (Math.random() - 0.5) * 0.3, 0xa0e8ff);
      G.audio.zap();
    },
  },
  {
    id: 'lowgrav', name: 'LOW GRAVITY', jp: '低重力', line: 'THE FLOOR FEELS FURTHER AWAY.', color: '#b080ff', tables: 3, reward: 1.2,
    desc: 'Balls keep their speed and cushions give everything back. Explosions are enormous.',
    mods(G, P) { P.muRoll *= 0.45; P.muSlide *= 0.8; P.cushionRest = Math.max(P.cushionRest, 0.93); },
    shotEnd(G, S) { const banks = S.pots.filter(p => p.bank && p.counted && !p.house).length; if (banks) S.mult += 0.5 * banks; },
  },
  {
    id: 'redline', name: 'REDLINE', jp: 'レッドライン', line: 'THE NEEDLE IS STUCK.', color: '#ff3b5c', tables: 3, reward: 1.25,
    desc: 'HEAT cannot drop and pays double. The club offers more bets.',
    heatLock: true, betBoost: 0.4,
    shotEnd(G, S) { S.multX *= 1 + 0.15 * (G.run.heat || 0); },
  },
  {
    id: 'quiet', name: 'QUIET HOURS', jp: '静寂', line: 'EVERYONE STOPPED TALKING.', color: '#c8ccd8', tables: 3, reward: 1.2,
    desc: 'No crowd, almost no music. Precise shots earn enormous STYLE.',
    quiet: true,
    shotEnd(G, S, A) {
      const precise = A && S.pots.some(p => p.counted) && ['cut', 'long', 'bank', 'pos', 'kick'].some(c => A.cats.has(c));
      if (precise) { S.multX *= 1.5; G.run.style = Math.min(100, (G.run.style || 0) + 12); S.lines.push(['PRECISION', 400]); }
    },
  },
  {
    id: 'houserules', name: 'HOUSE RULES', jp: 'ハウスルール', line: 'THE MANAGEMENT HAS CHANGED THE RULES.', color: '#34e070', tables: 3, reward: 1.6,
    desc: 'Every table gets one extra rule. Purses +60%.',
    extraMods: 1,
  },
];
export const stateById = (id) => TABLE_STATES.find(s => s.id === id) || null;

// ------------------------------------------------------------- contracts
// One optional run-long challenge at a time. until: when the deadline hits.
export const CONTRACTS = [
  { id: 'clean_hands', name: 'CLEAN HANDS', desc: 'Finish the next 4 tables without a single scratch.', goal: 4, until: 'self', reward: 'legendary', rewardText: 'A LEGENDARY RELIC CHOICE' },
  { id: 'banker', name: 'BANKER', desc: 'Pot 8 balls with bank shots before this floor\'s boss falls.', goal: 8, until: 'boss', reward: 'chips45', rewardText: '+45 CHIPS' },
  { id: 'hot_run', name: 'HOT RUN', desc: 'Reach HEAT IV before this floor\'s boss falls.', goal: 4, until: 'boss', reward: 'upgrade', rewardText: 'A FREE RELIC UPGRADE', needsHeat: true },
  { id: 'no_fear', name: 'NO FEAR', desc: 'Clear an ELITE table on this floor with the aim guide on SHORT or OFF.', goal: 1, until: 'boss', reward: 'slot', rewardText: '+1 RELIC SLOT FOR THIS RUN' },
  { id: 'perfect_customer', name: 'PERFECT CUSTOMER', desc: 'Spend 60 chips in shops before this floor\'s boss falls.', goal: 60, until: 'boss', reward: 'discount', rewardText: '25% OFF IN EVERY SHOP FOR THE REST OF THE RUN' },
  { id: 'sharpshooter', name: 'SHARPSHOOTER', desc: 'Land 5 long pots (over 1.2 m of travel) before this floor\'s boss falls.', goal: 5, until: 'boss', reward: 'chips30', rewardText: '+30 CHIPS' },
  { id: 'chain_gang', name: 'CHAIN GANG', desc: 'Pot on 6 shots in a row before this floor\'s boss falls.', goal: 6, until: 'boss', reward: 'rare', rewardText: 'A RARE RELIC CHOICE' },
  { id: 'untouched', name: 'UNTOUCHED', desc: 'Clear 2 tables in a row without missing a shot.', goal: 2, until: 'self', reward: 'heart', rewardText: '+1 MAX HEART' },
];
export const contractById = (id) => CONTRACTS.find(c => c.id === id) || null;

// --------------------------------------------------------------- rivals
// An unseen player at the next table. After each of your shots they take a
// turn (simulated); first to the goal wins. No models, just a name and a pace.
export const RIVALS = [
  { id: 'hustler', name: 'THE HUSTLER', color: '#34e070', icon: 'rival_hustler', mod: null, sting: [392, 523],
    style: 'Steady. Never misses the easy one.', taunt: '"TAKE YOUR TIME. I\'LL TAKE YOUR CHIPS."',
    turn: (k, r) => (r() < 0.66 ? 1 : 0) },
  { id: 'lunatic', name: 'THE LUNATIC', color: '#ff2bd6', icon: 'rival_lunatic', mod: 'fever', sting: [311, 740],
    style: 'Brilliant or terrible. Never both at once.', taunt: '"WATCH THIS. NO — WATCH THIS."',
    turn: (k, r) => { const x = r(); return x < 0.6 ? 0 : x < 0.78 ? 1 : x < 0.9 ? 2 : 3; } },
  { id: 'banker', name: 'THE BANKER', color: '#ffc21c', icon: 'rival_banker', mod: 'bounce', sting: [262, 392],
    style: 'Every rail pays. Your bank shots count double here too.', taunt: '"THE CUSHION IS A FRIEND."',
    turn: (k, r) => (r() < 0.48 ? (r() < 0.3 ? 2 : 1) : 0), bankDouble: true },
  { id: 'ghost', name: 'THE GHOST', color: '#c8ccd8', icon: 'rival_ghost', mod: 'dark', sting: [220, 233],
    style: 'You will not see the score until it is over.', taunt: '"…"', hidden: true,
    turn: (k, r) => (r() < 0.64 ? 1 : 0) },
  { id: 'shark', name: 'THE SHARK', color: '#2bf0ff', icon: 'rival_shark', mod: null, sting: [440, 587],
    style: 'Fast out of the gate. Fades if you hang on.', taunt: '"THIS WON\'T TAKE LONG."',
    turn: (k, r) => (r() < (k < 3 ? 0.92 : 0.45) ? 1 : 0) },
  { id: 'professor', name: 'THE PROFESSOR', color: '#9a4bff', icon: 'rival_professor', mod: 'heavy', sting: [196, 247],
    style: 'Slow start. Relentless finish. Build your lead early.', taunt: '"PATIENCE IS A FORM OF ARITHMETIC."',
    turn: (k, r) => (r() < (k < 3 ? 0.35 : 0.88) ? 1 : 0) },
];
export const rivalById = (id) => RIVALS.find(r => r.id === id) || null;

// ------------------------------------------------------ hidden synergies
// Never listed anywhere until you trigger them. relics: every entry must be
// owned ('a|b' = either). cursed: that many cursed relics at once.
export const SYNERGIES = [
  { id: 'railgun', name: 'RAILGUN', relics: ['thunder_cue', 'hot_rail'], desc: 'Hard cushion hits send lightning down the rail into the nearest ball.' },
  { id: 'afterburn', name: 'AFTERBURN', relics: ['explosive_chalk', 'aftershock'], desc: 'Every explosion rolls out a second shockwave.' },
  { id: 'event_horizon', name: 'EVENT HORIZON', relics: ['magnet_pocket', 'black_hole'], desc: 'After a combo the black-hole pocket drags the table toward it.' },
  { id: 'solid_gold', name: 'SOLID GOLD', relics: ['midas', 'piggy_bank|pocket_change|lucky_seven'], desc: 'Golden balls pay their chips twice.' },
  { id: 'bad_decisions', name: 'BAD DECISIONS', cursed: 3, desc: 'Three curses at once. Curses bite harder, and every shot scores x1.5.' },
  { id: 'kick_drum', name: 'KICK DRUM', relics: ['ricochet', 'trickster'], desc: 'Kick shots add +2x and pay 3 chips.' },
  { id: 'ghost_protocol', name: 'GHOST PROTOCOL', relics: ['ghost_ball', 'homing'], desc: 'A ghost shot that still pots something scores x2 and gives the ghost charge back.' },
  { id: 'slow_burn', name: 'SLOW BURN', relics: ['moon_gravity', 'hot_streak'], desc: 'Every long pot adds a streak level, and the streak pays extra.' },
  { id: 'orbital_strike', name: 'ORBITAL STRIKE', relics: ['orbit', 'explosive_chalk'], desc: 'A curved shot\'s first hit explodes twice as hard.' },
  { id: 'dead_reckoning', name: 'DEAD RECKONING', relics: ['dead_center', 'deadeye'], desc: 'Dead-centre long pots score x2 and fill STYLE.' },
  { id: 'safety_glass', name: 'SAFETY GLASS', relics: ['insurance', 'glass_cannon'], desc: 'Insurance covers two scratches per table and pays 5 chips each time.' },
  { id: 'blackjack', name: 'BLACKJACK', relics: ['lucky_seven', 'loaded_dice'], desc: 'Win a bet on a table where you sank the 7: +21 chips.' },
];
export const synergyById = (id) => SYNERGIES.find(s => s.id === id) || null;
// (a relic the Collector has borrowed does not count)
export function hasSynergy(G, id) {
  const s = synergyById(id), rel = G.run?.relics || [];
  if (!s) return false;
  if (s.cursed) return rel.filter(r => r.rarity === 'cursed' && !G.relicOff?.(r.id)).length >= s.cursed;
  return s.relics.every(k => k.split('|').some(x => G.hasRelic(x)));
}

// ----------------------------------------------------------- overcharge
// A rare late-run event turns one relic into something absurd until the next
// boss falls. It never replaces the normal NAME+ upgrade.
export const OVERCHARGES = {
  explosive_chalk: { name: 'NUCLEAR CHALK', desc: 'The first hit detonates with a colossal radius. Mind the cue ball.' },
  magnet_pocket: { name: 'SINGULARITY', desc: 'The magnet pocket bends the whole table toward it.' },
  thunder_cue: { name: 'STORMBRINGER', desc: 'Every shot chains lightning, and every arc jumps twice.' },
  heavy_cue: { name: 'SLEDGEHAMMER', desc: 'Double shot power. Pots on full-power shots x2.' },
  bucket_pockets: { name: 'SINKHOLES', desc: 'Pockets swallow from twice as far away.' },
  hot_streak: { name: 'WILDFIRE', desc: 'Streak bonuses doubled and uncapped.' },
  trickster: { name: 'GRANDMASTER', desc: 'Every cushion hit adds +0.5x, uncapped.' },
  piggy_bank: { name: 'FORT KNOX', desc: '+4 chips for every ball you pot.' },
  nitro: { name: 'MELTDOWN', desc: 'Every collision explodes (up to 12 a shot).' },
  moon_gravity: { name: 'ZERO-G', desc: 'Friction almost disappears. LONG POTS score x5.' },
  deadeye: { name: 'SNIPER', desc: 'Long pots pay +1500 and score x2.' },
  ricochet: { name: 'PINBALL GOD', desc: 'The cue ball gains 35% speed off every cushion.' },
};

// ------------------------------------------------------------- handicaps
// Optional rules before a run (after your first win). Each one raises the
// reward multiplier that applies to score and purses.
export const HANDICAPS = [
  { id: 'speed', name: 'DOUBLE SPEED', desc: 'Every shot hits twice as hard and rolls further.', bonus: 0.25 },
  { id: 'small', name: 'SMALL POCKETS', desc: 'Every pocket is 20% smaller.', bonus: 0.3 },
  { id: 'cursed', name: 'CURSED ONLY', desc: 'Every relic you are offered is cursed.', bonus: 0.4 },
  { id: 'noguide', name: 'NO AIM GUIDE', desc: 'The aim guide is off for the whole run.', bonus: 0.3 },
  { id: 'random', name: 'RANDOM RELIC', desc: 'After every boss, one of your relics is swapped for a random one.', bonus: 0.2 },
  { id: 'highheat', name: 'HIGH HEAT', desc: 'Start at HEAT II. Heat builds 50% faster.', bonus: 0.3 },
];
export function handicapMul(ids = []) { return 1 + HANDICAPS.filter(h => ids.includes(h.id)).reduce((s, h) => s + h.bonus, 0); }

// ------------------------------------------------------------ build names
const ADJ = { BANK: ['RICOCHET', 'CUSHION'], CHAOS: ['NUCLEAR', 'THUNDER'], CONTROL: ['SURGICAL', 'CLOCKWORK'], GREED: ['MIDAS', 'GOLDEN'], CURSED: ['CURSED', 'HEXED'], COMBO: ['DOMINO', 'CHAIN'] };
const NOUN = { BANK: ['BANKER', 'RICOCHET'], CHAOS: ['STORM', 'REACTOR'], CONTROL: ['SNIPER', 'SURGEON'], GREED: ['HOARD', 'TYCOON'], CURSED: ['ENGINE', 'BARGAIN'], COMBO: ['CASCADE', 'CHAIN'] };
const ADJ_RELIC = { thunder_cue: 'THUNDER', black_hole: 'VOID', explosive_chalk: 'NUCLEAR', nitro: 'NUCLEAR', midas: 'MIDAS', ghost_ball: 'PHANTOM', moon_gravity: 'LUNAR', glass_cannon: 'GLASS', orbit: 'ORBITAL' };
// "NUCLEAR BANKER", "MIDAS STORM", "VOID RICOCHET"… only for real builds (4+ relics)
export function buildName(relics = [], seed = 0) {
  if (relics.length < 4) return '';
  const count = {};
  for (const r of relics) for (const t of r.tags || []) count[t] = (count[t] || 0) + 1;
  const tags = Object.keys(count).sort((a, b) => count[b] - count[a] || a.localeCompare(b));
  if (!tags.length) return '';
  const top = tags[0], second = tags[1] || top;
  const pickW = (arr, k) => arr[(seed + k) % arr.length];
  const star = relics.find(r => ADJ_RELIC[r.id] && r.tags?.includes(top)) || relics.find(r => ADJ_RELIC[r.id]);
  let adj = star ? ADJ_RELIC[star.id] : pickW(ADJ[top], 0);
  let noun = pickW(NOUN[second], 1);
  if (noun === adj) noun = pickW(NOUN[second], 2);
  return `${adj} ${noun}`;
}

// ------------------------------------------------------------ commentary
// Text only. The game is better silent than with bad voice acting.
export const COMMENTARY = {
  great: ['BEAUTIFUL.', 'PERFECT.', 'UNBELIEVABLE.', 'THAT WAS DISGUSTING.', 'MEANT THAT.', 'TEXTBOOK.', 'OH, COME ON.'],
  bank: ['BANKED.', 'OFF THE RAIL.', 'GEOMETRY.'],
  combo: ['ALL OF THEM.', 'HOW MANY WAS THAT?', 'CLEARED HOUSE.'],
  scratch: ['SCRATCH.', 'OH NO.', 'NOT LIKE THIS.'],
  miss: ['NO CHANCE.', 'CLOSE.', 'NOT TODAY.'],
  clutch: ['CLUTCH.', 'ICE COLD.', 'WHEN IT MATTERS.'],
  rival: ['IT\'S A RACE NOW.', 'NECK AND NECK.'],
};
export function commentLine(kind) { const l = COMMENTARY[kind] || COMMENTARY.great; return l[Math.floor(Math.random() * l.length)]; }

// --------------------------------------------------------- trick tables
// Hand-built puzzles. Positions in table space (x along the length, ±1.0;
// z across, ±0.5). check(G, S, e) decides a successful attempt. Every layout
// is verified solvable by scripts/check-tricks (a brute-force search).
export const TRICK_PUZZLES = [
  {
    id: 'double_bank', name: 'DOUBLE BANK', hint: 'Sink the gold-ringed ball off at least two cushions.',
    cue: [-0.55, 0.12], target: [[0.05, -0.08, 3]], others: [[0.62, 0.36, 12], [0.62, -0.36, 14]],
    check(G, S) { return S.pots.some(p => p.ball.tags.trick && p.ball.cushions >= 2) && !S.scratch; },
  },
  {
    id: 'combination', name: 'COMBINATION', hint: 'Sink the gold-ringed ball using another ball. The cue ball may not touch it.',
    cue: [-0.6, 0.0], target: [[0.82, 0.3, 11]], others: [[0.45, 0.13, 6], [0.2, -0.3, 9]],
    check(G, S) { return S.pots.some(p => p.ball.tags.trick && p.kiss) && !S.scratch; },
  },
  {
    id: 'rail_first', name: 'RAIL FIRST', hint: 'The cue ball must hit a cushion before any ball. Then sink the gold-ringed ball.',
    cue: [-0.6, 0.25], target: [[0.55, 0.22, 7]], others: [[0.1, 0.24, 2], [0.1, 0.16, 10], [0.1, 0.32, 15]],
    check(G, S) { return S.cueCushionFirst > 0 && S.pots.some(p => p.ball.tags.trick) && !S.scratch; },
  },
  {
    id: 'two_ball', name: 'TWO BALL POT', hint: 'Sink both gold-ringed balls in one shot. They are on the same rail.',
    cue: [-0.55, 0.425], target: [[0.02, 0.452, 4], [0.84, 0.462, 13]], others: [[0.3, 0.05, 5], [-0.2, -0.2, 10]],
    check(G, S) { return S.pots.filter(p => p.ball.tags.trick).length >= 2 && !S.scratch; },
  },
  {
    id: 'carom', name: 'CAROM', hint: 'Glance the cue ball off the blue ball first, then sink the gold-ringed ball.',
    cue: [-0.5, -0.25], target: [[0.84, 0.38, 1]], others: [[0.2, -0.05, 2]], carom: 2,
    check(G, S) { return S.firstHit?.num === 2 && S.pots.some(p => p.ball.tags.trick && p.ball.lastToucher?.kind === 'cue') && !S.scratch; },
  },
  {
    id: 'escape', name: 'CUE BALL ESCAPE', hint: 'The cue ball is boxed in. Get it out and sink the gold-ringed ball.',
    cue: [-0.55, 0.0], target: [[0.6, -0.34, 9]], others: [], pillars: [[-0.45, 0.0], [-0.55, 0.1], [-0.55, -0.1], [-0.65, 0.05]],
    check(G, S) { return S.pots.some(p => p.ball.tags.trick) && !S.scratch; },
  },
];

// ---------------------------------------------------------------- helpers
export function pickRival(meta, r = rand) {
  const R = meta.data.rivals || {};
  const nemesis = RIVALS.filter(x => R[x.id]?.nemesis);
  if (nemesis.length && r() < 0.6) return nemesis[Math.floor(r() * nemesis.length)];
  return RIVALS[Math.floor(r() * RIVALS.length)];
}
