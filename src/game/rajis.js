// ████ RAJIS ████
// A second game behind the first one. Same table, same physics, same relic
// hooks, different war: missions instead of tables, protocols instead of
// relics, a command room instead of a club. Everything here is presentation
// and content layered over the run system; the billiards never changes.

import * as THREE from 'three';
import { TABLE } from '../config.js';
import { ps1Material } from '../render/materials.js';
import { rand, withSeed } from './rng.js';
import { ENCOUNTERS, rackTriangle, rackScatter, makeEncounter } from './encounters.js';
import { rollRelics, relicById, PROTOCOLS } from './relics.js';
import { rollMods, modCount, gradeRun } from './mastery.js';
import { THEMES } from './cosmetics.js';
import { takeOverScreens } from '../render/textures.js';

const R = TABLE.R;

// ------------------------------------------------------------ the lexicon
// The same game in another language. Longest phrases first.
const LEX = [
  ['TABLE CLEARED', 'MISSION COMPLETE'], ['BOSS DEFEATED', 'TARGET NEUTRALISED'], ['OUT OF SHOTS', 'SYSTEM FAILURE'],
  ['OUT OF ATTEMPTS', 'SYSTEM FAILURE'], ['TIME UP', 'WINDOW CLOSED'], ['TRIPLE BANK', 'TRIPLE RICOCHET'], ['DOUBLE BANK', 'DOUBLE RICOCHET'],
  ['BANK SHOTS', 'RICOCHET INTERCEPTS'], ['KICK SHOTS', 'BLIND STRIKES'], ['BANK SHOT', 'RICOCHET INTERCEPT'], ['KICK SHOT', 'BLIND STRIKE'], ['COMBINATION', 'CHAIN DETONATION'], ['LONG POT', 'LONG-RANGE KILL'],
  ['PERFECT POSITION', 'TACTICAL POSITION'], ['RAZOR CUT', 'SURGICAL STRIKE'], ['PAPER CUT', 'SURGICAL STRIKE'], ['CAROM', 'DEFLECTION'],
  ['TABLE PURSE', 'MISSION PAY'], ['ELITE PURSE', 'MISSION PAY'], ['BOSS BOUNTY', 'COMMAND BONUS'], ['TABLE SCORE', 'MISSION SCORE'],
  ['GOLDEN BALL', 'HIGH-VALUE TARGET'], ['GOLDEN!', 'HIGH VALUE TARGET!'], ['8-BALL FINISH', 'CORE KILL'], ['THE CHALK SHOP', 'COMMAND'],
  ['SCRATCH', 'SYSTEM FAILURE'], ['DOUBLE!', 'MULTI INTERCEPT!'], ['TRIPLE!!', 'MULTI INTERCEPT x3!!'], ['QUAD!!!', 'MULTI INTERCEPT x4!!!'], ['BANK!', 'RICOCHET INTERCEPT'],
  ['BALLS', 'TARGETS'], ['BALL', 'TARGET'], ['POCKETS', 'DROP ZONES'], ['POCKET', 'DROP ZONE'], ['SINK', 'DESTROY'], ['POTS', 'HITS'], ['POT', 'HIT'],
  ['SHOTS', 'ROUNDS'], ['CHIPS', 'CREDITS'], ['RELICS', 'PROTOCOLS'], ['RELIC', 'PROTOCOL'], ['HEARTS', 'HULL'], ['HEART', 'HULL'],
  ['FLOOR', 'SECTOR'], ['HEAT', 'ALERT'], ['TABLE', 'MISSION'],
].map(([a, b]) => [new RegExp(`(?<![A-Z-])${a.replace(/[!?.*+]/g, '\\$&')}(?![A-Z])`, 'g'), b]);
export function lex(text) {
  if (typeof text !== 'string') return text;
  // leave HTML attributes and tags alone: only rewrite the text between them
  return text.replace(/(^|>)([^<]*)/g, (m, open, body) => open + LEX.reduce((t, [re, to]) => t.replace(re, to), body));
}

// ----------------------------------------------------------- locations
// Backdrops for the same command table. The room and the war never change.
export const LOCATIONS = {
  command: { name: 'COMMAND CENTER', jp: '司令部', sky: ['#020a04', '#0a2410'], building: '#010502', windows: 'none', neon: ['#8fd14f', '#ff3b30', '#f5c542'], lamp: [1.0, 1.15, 0.85], fog: [0.01, 0.03, 0.012], view: 'screens' },
  dubai: { name: 'DUBAI', jp: 'ドバイ', sky: ['#2a1206', '#f08a2a'], building: '#1a0c06', windows: 'city', neon: ['#f5c542', '#ff8a1b', '#8fd14f'], lamp: [1.35, 1.1, 0.75], fog: [0.06, 0.03, 0.015], view: 'towers' },
  beirut: { name: 'BEIRUT', jp: 'ベイルート', sky: ['#0a0c20', '#3a2a50'], building: '#08060e', windows: 'city', neon: ['#ff3b30', '#f5c542', '#8fd14f'], lamp: [1.25, 1.05, 0.85], fog: [0.03, 0.02, 0.05], view: 'coast' },
  sweden: { name: 'SWEDEN', jp: 'スウェーデン', sky: ['#0c1624', '#40607a'], building: '#08101a', windows: 'snow', neon: ['#8fd1ff', '#8fd14f', '#ffffff'], lamp: [0.95, 1.1, 1.3], fog: [0.04, 0.06, 0.09], view: 'pines' },
  convoy: { name: 'CONVOY', jp: '輸送隊', sky: ['#1a1408', '#6a5028'], building: '#0e0a04', windows: 'road', neon: ['#f5c542', '#8fd14f', '#ff3b30'], lamp: [1.3, 1.1, 0.8], fog: [0.07, 0.05, 0.02], view: 'road' },
  silo: { name: 'MISSILE SILO', jp: 'ミサイルサイロ', sky: ['#0a0a0a', '#1a1a1a'], building: '#050505', windows: 'none', neon: ['#ff3b30', '#f5c542', '#ffffff'], lamp: [1.2, 1.0, 0.9], fog: [0.03, 0.02, 0.02], view: 'silo' },
};
const MISSION_LOCS = ['dubai', 'beirut', 'sweden', 'convoy', 'silo'];

// the command-room theme: a real table theme, re-tinted per location
export function rajisTheme(loc = 'command') {
  const L = LOCATIONS[loc] || LOCATIONS.command;
  const base = THEMES.find(t => t.id === 'command');
  return {
    ...base, id: `rajis_${loc}`, loc, seed: 131 + MISSION_LOCS.indexOf(loc) * 7,
    sky: L.sky, building: L.building, windows: L.windows, neon: L.neon, lampColor: L.lamp, fog: L.fog, view: L.view,
  };
}

// mission names for the familiar table types
const MISSIONS = {
  standard: 'SEARCH AND DESTROY', precision: 'CORNER EXTRACTION', bank: 'RICOCHET RUN', golden: 'HIGH-VALUE TARGET', combo: 'CHAIN DETONATION',
  trick: 'BLIND STRIKE', survival: 'HOLD THE LINE', assassin: 'ASSASSINATION', sequence: 'LAUNCH SEQUENCE', territory: 'SECTOR CONTROL',
  bounty: 'MOST WANTED', hotpotato: 'LIVE ORDNANCE', lockdown: 'LOCKDOWN', chain: 'SUPPLY CHAIN', blitz: 'RAPID RESPONSE', escalation: 'ESCALATION',
};
const CODENAMES = ['SALT', 'COPPER', 'GLASS', 'NIGHTJAR', 'ANVIL', 'TIDEWATER', 'PARALLAX', 'HALCYON', 'IRONWOOD', 'SANDGLASS', 'BLUE LANTERN', 'GRANITE', 'KESTREL', 'LOW TIDE', 'CINDER'];

// ---------------------------------------------------------- the bosses
// RICHARD (missiles) · NEIL (support) · PAUL (machines) · YAHYA (armour)
// RAJIS CORE (all of it) · PAULYAMIN (optional)
export const RAJIS_BOSSES = {
  richard: {
    id: 'richard', name: 'RICHARD', title: 'MISSILE COMMAND', boss: true, rajis: true, jp: 'リチャード', cap: 3, loc: 'silo', ach: 'intercepted',
    blurb: 'Targets get locked. After your shot, every lock still on the table takes a missile. Destroy a locked target first to intercept it: it counts double.',
    intro: ['I HAVE REQUESTED MORE MISSILES.', 'THE REQUEST WAS APPROVED.', 'THE REQUEST WAS ALSO A MISSILE.'],
    params: { goal: [6, 6, 6], shots: [10, 10, 10], rack: [15, 15, 15] },
    color: '#ff3b30',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); e.salvo = 0; },
    beforeAim(G, e) { G.rjLock(e, e.phase >= 3 ? 3 : e.phase >= 2 ? 2 : 1); },
    rajisProgress(G, S, e, d) { const n = S.pots.filter(p => p.counted && p.ball.tags.lock).length; if (n) G.popText(n > 1 ? `INTERCEPTED x${n}` : 'INTERCEPTED', '#8fd14f', 1.3); return d + n; },
    enemyTurn(G, e) { return G.rjMissiles(e); },
    phases: ['ONE LOCK A TURN', 'TWO LOCKS', 'SALVO'],
    objective: e => `DESTROY ${e.goal} — INTERCEPT THE LOCKS`,
  },
  neil: {
    id: 'neil', name: 'NEIL', title: 'SUPPORT', boss: true, rajis: true, jp: 'ニール', cap: 3, loc: 'convoy', ach: 'supply_chain',
    blurb: 'A support unit hides among the targets and buffs the rest: SHIELDED, ACCELERATED, REPAIRED, LINKED. Find the support unit and destroy it for 2.',
    intro: ['I HAVE A PLAN.', 'IT IS ON A WHITEBOARD.', 'YOU ARE THE ARROW.'],
    params: { goal: [6, 6, 6], shots: [10, 10, 10], rack: [15, 15, 15] },
    color: '#8fd14f',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); G.later(1.0, () => G.rjSupport(e)); },
    counts(G, S, pot) { return G.rjCountsNeil(G.enc, S, pot); },
    rajisProgress(G, S, e, d) { return G.rjNeilProgress(e, S, d); },
    afterShot(G, e, S) { G.rjNeilTurn(e, S); },
    onBallHit(G, a, b, v) { G.rjFast(a, b, v); },
    phases: ['ONE BUFF A TURN', 'TWO BUFFS A TURN', 'THE SUPPORT UNIT MOVES'],
    objective: e => `DESTROY ${e.goal} — FIND THE SUPPORT UNIT`,
  },
  paul: {
    id: 'paul', name: 'PAUL', title: 'MACHINES', boss: true, rajis: true, jp: 'ポール', cap: 3, loc: 'command', ach: 'machine_learning',
    blurb: 'The machine predicts your obvious shot and counters it. Every few turns the CYBER BULLET crosses the table. Later, it locks onto a drop zone.',
    intro: ['MY ROBOT HAS BEEN WATCHING YOU PLAY.', 'IT HAS SOME NOTES.', 'NOTE ONE: PREDICTABLE.'],
    params: { goal: [6, 6, 6], shots: [10, 10, 10], rack: [15, 15, 15] },
    color: '#8fd1ff',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); e.carTick = 0; },
    beforeAim(G, e) { G.rjPredict(e); if (e.phase >= 3) G.rjLockOn(e); },
    counts(G, S, pot) { return G.rjCountsPaul(G.enc, S, pot); },
    pockets(G, pk, e) {
      if (e?.pred) { pk[e.pred.pocket].label = 'COUNTER'; pk[e.pred.pocket].labelColor = '#8fd1ff'; }
      if (e?.lockPocket != null) { pk[e.lockPocket].label = 'LOCK ON'; pk[e.lockPocket].labelColor = '#ff3b30'; }
    },
    enemyTurn(G, e) { e.carTick++; if (e.carTick % (e.phase >= 2 ? 2 : 3) === 0) return G.rjCyberBullet(e); return false; },
    phases: ['PREDICTION', 'THE CYBER BULLET RUNS MORE OFTEN', 'LOCK ON'],
    objective: e => `DESTROY ${e.goal} — DON'T TAKE THE OBVIOUS SHOT`,
  },
  yahya: {
    id: 'yahya', name: 'YAHYA', title: 'ARMOUR', boss: true, rajis: true, jp: 'ヤヒヤ', cap: 3, loc: 'sweden', ach: 'heavy_industry',
    blurb: 'Armoured targets shrug off soft hits. Crack the armour with hard contact, then destroy them. Later a tank rolls in, and then the shelling starts.',
    intro: ['I PARKED THE TANK IN THE BRIEFING ROOM.', 'NOBODY KNOWS HOW.', 'INCLUDING ME.'],
    params: { goal: [6, 6, 6], shots: [11, 11, 11], rack: [15, 15, 15] },
    color: '#f5c542',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); G.rjArmor(e, 4); },
    counts(G, S, pot) { return G.rjCountsArmor(S, pot); },
    onBallHit(G, a, b, v) { G.rjCrack(a, b, v); },
    onPhase(G, e, n) { if (n === 2) G.rjTank(e); },
    enemyTurn(G, e) { return G.rjYahyaTurn(e); },
    phases: ['ARMOUR', 'THE TANK', 'SHELLING'],
    objective: e => `DESTROY ${e.goal} — CRACK THE ARMOUR FIRST`,
  },
  core: {
    id: 'core', name: 'RAJIS CORE', title: 'ALL SYSTEMS', boss: true, rajis: true, final: true, jp: 'ラジス・コア', cap: 2, loc: 'command', ach: 'system_online',
    blurb: 'Everything at once. Locks and armour, then shields and prediction, then the Cyber Bullet. At the end, the CORE itself.',
    intro: ['ALL SYSTEMS ONLINE.', 'ALL SYSTEMS HOSTILE.', 'THIS IS THE LAST ROOM.'],
    params: { goal: [8, 8, 8], shots: [14, 14, 14], rack: [15, 15, 15] },
    color: '#ff2020',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); G.rjArmor(e, 2); e.carTick = 0; e.salvo = 0; },
    beforeAim(G, e) {
      if (e.coreTime) return;
      G.rjLock(e, e.phase >= 3 ? 2 : 1);
      if (e.phase >= 2) G.rjPredict(e);
    },
    counts(G, S, pot) { return G.rjCountsCore(G.enc, S, pot); },
    rajisProgress(G, S, e, d) {
      if (e.coreTime) return S.pots.some(p => p.counted && p.ball.tags.core) ? e.goal - e.progress : 0;
      const n = S.pots.filter(p => p.counted && p.ball.tags.lock).length;
      return Math.min(e.goal - 1 - e.progress, d + n);
    },
    onBallHit(G, a, b, v) { G.rjCrack(a, b, v); },
    onPhase(G, e, n) { if (n === 2) G.later(0.8, () => G.rjSupport(e)); },
    afterShot(G, e, S) { if (e.phase >= 2 && !e.coreTime) G.rjNeilTurn(e, S, 1); if (e.progress >= e.goal - 1) G.rjCoreTime(e); },
    enemyTurn(G, e) {
      if (e.coreTime) return false;
      e.carTick++;
      if (e.phase >= 3 && e.carTick % 2 === 0) return G.rjCyberBullet(e);
      return G.rjMissiles(e);
    },
    phases: ['LOCKS AND ARMOUR', 'SHIELDS AND PREDICTION', 'THE CYBER BULLET'],
    objective: e => e.coreTime ? 'DESTROY THE CORE' : `DESTROY ${e.goal - 1} — THEN THE CORE`,
  },
  paulyamin: {
    id: 'paulyamin', name: 'PAULYAMIN', title: 'TWO OF A KIND', boss: true, rajis: true, secret: true, jp: 'ポーリャミン', cap: 3, loc: 'command', ach: 'paulyamin',
    blurb: 'A race against your own reflection. Every target you destroy, it copies on the other side of the table. Later it copies your misses too.',
    intro: ['WE HAVE MET.', 'YOU JUST DID NOT KNOW IT WAS A MIRROR.'],
    params: { goal: [7, 7, 7], shots: [12, 12, 12], rack: [15, 15, 15] },
    color: '#c0a0ff',
    setup(G, e) { e.layout = rackTriangle(G, e.p.rack); e.rivalScore = 0; e.rivalTurns = 0; e.rivalDef = MIRROR; },
    enemyTurn(G, e, S) { return G.rjMirror(e, S); },
    phases: ['IT COPIES YOUR HITS', 'IT COPIES YOUR MISSES', 'IT COPIES TWICE'],
    objective: e => `FIRST TO ${e.goal} — IT PLAYS YOUR SHOTS BACK`,
  },
};
// ---------------------------------------------------------- the staff
// The four run the war between their own boss fights: they introduce
// themselves, issue the missions, and have opinions on the radio.
export const STAFF = {
  richard: { name: 'RICHARD', title: 'MISSILE COMMAND', color: '#ff3b30', hello: 'I HAVE REQUESTED MORE MISSILES. THEY SAID YES.',
    issue: ['DESTROY THE TARGETS. QUIETLY. THEN LOUDLY.', 'I HAVE A MISSILE FOR THIS. I HAVE A MISSILE FOR EVERYTHING.', 'IF IT MOVES, INTERCEPT IT. IF IT DOES NOT MOVE, ALSO INTERCEPT IT.', 'THIS ONE IS SIMPLE. I HAVE STILL PREPARED A SALVO.'],
    won: 'CLEAN. I WILL ADD IT TO THE WALL.', lost: 'WE HAVE MORE MISSILES. I CHECKED.' },
  neil: { name: 'NEIL', title: 'SUPPORT', color: '#8fd14f', hello: 'I HAVE A PLAN. IT IS ON A WHITEBOARD.',
    issue: ['THE PLAN IS ARROWS. FOLLOW THE ARROWS.', 'I HAVE SUPPORT ON STANDBY. THE SUPPORT IS ME.', 'STEP ONE: POT THINGS. STEP TWO: I WILL TELL YOU AFTER STEP ONE.', 'I DREW THIS ONE WITH A RULER. IT WILL GO FINE.'],
    won: 'THAT WENT TO PLAN. MOSTLY.', lost: 'NEW PLAN. SAME WHITEBOARD.' },
  paul: { name: 'PAUL', title: 'MACHINES', color: '#8fd1ff', hello: 'MY ROBOT HAS BEEN WATCHING YOU PLAY. IT HAS NOTES.',
    issue: ['THE ROBOT RAN THE NUMBERS. THE NUMBERS SAY GO.', 'DO NOT TAKE THE OBVIOUS SHOT. THE ROBOT HATES THE OBVIOUS SHOT.', 'THE CYBER BULLET IS FUELLED AND WAITING. JUST IN CASE.', 'MY ROBOT SAYS THIS ONE IS EASY. MY ROBOT HAS BEEN WRONG ONCE.'],
    won: 'THE ROBOT APPROVES. IT BEEPED TWICE.', lost: 'THE ROBOT HAS ADDED THAT TO ITS NOTES.' },
  yahya: { name: 'YAHYA', title: 'ARMOUR', color: '#f5c542', hello: 'I PARKED THE TANK IN THE BRIEFING ROOM. NOBODY KNOWS HOW.',
    issue: ['HIT IT HARD. IF THAT FAILS, HIT IT HARDER.', 'I HAVE ARMOURED THE TARGETS. BY ACCIDENT. SORRY.', 'THE TANK IS OUTSIDE IF YOU NEED IT. IT IS ALWAYS OUTSIDE.', 'NOTHING HERE IS ARMOURED. PROBABLY. I WOULD HIT IT HARD ANYWAY.'],
    won: 'GOOD. HEAVY. I LIKE IT.', lost: 'THE TANK WOULD HAVE DONE BETTER. THE TANK IS NOT ALLOWED IN.' },
};
export const STAFF_ORDER = ['richard', 'neil', 'paul', 'yahya'];
// who issues a mission at a given stop: everyone gets the radio in turn
export const staffFor = (run, node) => STAFF_ORDER[((run?.seed || 0) + node) % 4];

const MIRROR = { id: 'paulyamin', name: 'PAULYAMIN', color: '#c0a0ff', hidden: false, sting: [330, 311], turn: () => 0, mirror: true };
export const RAJIS_ORDER = ['richard', 'neil', 'paul', 'yahya'];

// ------------------------------------------------------------- events
export const RAJIS_EVENTS = [
  {
    id: 'r_missiles', who: 'richard', title: 'RICHARD HAS REQUESTED MORE MISSILES.',
    text: 'He has filled out the form in triplicate. The form is also a missile.',
    choices: [
      { label: 'APPROVE', act(G) { const r = relicById('p_missile'); if (r && !G.hasRelic('p_missile')) { G.gainRelic(r); return 'HE SALUTES THE FORM. YOU GAIN MISSILE STRIKE.'; } G.addChips(8); return 'HE ALREADY HAD THEM. HE GIVES YOU 8 CREDITS NOT TO ASK WHERE.'; } },
      { label: 'DENY', act(G) { G.heal(1); return 'HE SULKS. THE BASE IS QUIETER. +1 HULL.'; } },
    ],
  },
  {
    id: 'r_plan', who: 'neil', title: 'NEIL SAYS HE HAS A PLAN.',
    text: 'It is on a whiteboard. It is mostly arrows. One of the arrows points at you.',
    choices: [
      { label: 'LISTEN', sub: '+2 ROUNDS NEXT MISSION', act(G) { G.run.nextShotBonus = (G.run.nextShotBonus || 0) + 2; return 'YOU FOLLOW THE ARROW. IT WORKS. NOBODY KNOWS WHY.'; } },
      { label: 'IGNORE', act(G) { G.addChips(6); return 'HE DRAWS ANOTHER ARROW ANYWAY. +6 CREDITS FOR YOUR PATIENCE.'; } },
    ],
  },
  {
    id: 'r_robot', who: 'paul', title: 'PAUL\'S ROBOT IS LOOKING AT THE TABLE.',
    text: 'It has been looking at the table for forty minutes. "WHAT IS A POCKET," it asks. "WHY DO YOU PUT THINGS IN IT."',
    choices: [
      { label: 'LET IT COOK', act(G) { const r = rollRelics(1, G.run.relics, { pool: 'rajis', forceRarity: 'rare' })[0]; if (r) { G.gainRelic(r); return `IT UNDERSTANDS. IT IMPROVES SOMETHING WHILE IT IS AT IT: ${r.name}.`; } G.addChips(8); return 'IT UNDERSTANDS. IT PAYS 8 CREDITS FOR THE LESSON.'; } },
      { label: 'TURN IT OFF', act(G) { G.addChips(10); return 'IT TURNS ITSELF BACK ON. IT REMEMBERS. +10 CREDITS FROM ITS BATTERY TRAY.'; } },
    ],
  },
  {
    id: 'r_tank', who: 'yahya', title: 'YAHYA PARKED THE TANK IN THE BRIEFING ROOM.',
    text: 'The door is smaller than the tank. Nobody saw it happen. Yahya is eating a sandwich on the turret.',
    choices: [
      { label: 'RIDE IT', sub: '-1 HULL · A LEGENDARY PROTOCOL', act(G) { G.loseHeart('THE TANK'); const r = rollRelics(1, G.run.relics, { pool: 'rajis', forceRarity: 'legendary' })[0]; if (r) { G.gainRelic(r); return `YOU ARRIVE EARLY. ALSO THROUGH A WALL. YOU GAIN ${r.name}.`; } return 'YOU ARRIVE EARLY. ALSO THROUGH A WALL.'; } },
      { label: 'LEAVE A NOTE', act(G) { G.run.maxHearts++; G.heal(1); return 'HE WRITES BACK "OK". +1 MAX HULL.'; } },
    ],
  },
  {
    id: 'r_armor', who: 'yahya', title: 'YAHYA HAS REQUESTED MORE ARMOR.',
    text: 'He has already welded it to the tank, the door and, for some reason, the kettle.',
    choices: [
      { label: 'APPROVE', sub: '+1 MAX HULL', act(G) { G.run.maxHearts++; G.heal(1); return 'THE BASE IS NOW ARMOURED. SO IS THE KETTLE. +1 MAX HULL.'; } },
      { label: 'ABSOLUTELY NOT', act(G) { G.addChips(9); return 'HE SELLS THE SPARE PLATING. YOU GET A CUT. +9 CREDITS.'; } },
    ],
  },
  {
    id: 'r_coffee', title: 'THE COFFEE MACHINE IS CLASSIFIED.',
    text: 'A laminated sign: LATTE REQUIRES CLEARANCE LEVEL 4.',
    choices: [
      { label: 'HACK IT', act(G) { if (rand() < 0.55) { G.heal(2); return 'ACCESS GRANTED. IT IS THE BEST COFFEE YOU HAVE EVER HAD. +2 HULL.'; } G.addChips(-Math.min(G.run.chips, 4)); return 'ACCESS DENIED. IT CHARGES YOU 4 CREDITS FOR TRYING.'; } },
      { label: 'DRINK THE WATER', act(G) { G.heal(1); return 'THE WATER IS NOT CLASSIFIED. +1 HULL.'; } },
    ],
  },
  {
    id: 'r_map', title: 'A MAP WITH ONE PIN IN IT.',
    text: 'The pin is in the middle of the ocean. Somebody has written YES next to it.',
    choices: [
      { label: 'MOVE THE PIN', sub: 'YOUR NEXT PROTOCOL CHOICE IS BETTER', act(G) { G.run.nextBoost = (G.run.nextBoost || 0) + 2; return 'NOBODY NOTICES. THE WAR CHANGES SLIGHTLY.'; } },
      { label: 'LEAVE IT', act(G) { G.addChips(5); return 'YES. +5 CREDITS.'; } },
    ],
  },
];

// ---------------------------------------------------------------- the run
export const RajisMixin = {
  // ------------------------------------------------ the secret, before it is found
  // Nobody is told. Regulars start to notice small wrong things (a CRT, a beep,
  // a warning sign, a table number), and later an arcade machine turns up.
  rajisEligible() {
    const d = this.meta.data, st = d.stats;
    return (st.wins || 0) >= 2 || ((st.wins || 0) >= 1 && (st.runs || 0) >= 6) || ((st.runs || 0) >= 12 && (d.bests?.furthestFloor || 0) >= 3);
  },
  // at most one clue a run, and rarely; rarer still once RAJIS is found
  maybeRajisClue(e = null) {
    const d = this.meta.data, run = this.run;
    if (!run || run.mode === 'rajis' || run.rajisClue || run.mode === 'daily') return;
    if ((d.stats.runs || 0) < 3 && !run.after) return;
    const p = d.rajis.found ? 0.01 : run.after ? 0.3 : this.rajisEligible() ? 0.06 : 0.025;
    if (Math.random() > p) return;
    run.rajisClue = true;
    const kinds = e ? ['crt', 'beep', 'warn', 'table'] : ['crt', 'beep', 'warn'];
    const k = kinds[Math.floor(Math.random() * kinds.length)];
    if (k === 'table' && e) e.rajisClue = true;
    else this.later(2 + Math.random() * 5, () => this.rajisClueFx(k));
    this.noteClue(k);
  },
  noteClue(k) {
    const R0 = this.meta.data.rajis;
    R0.clues = (R0.clues || 0) + 1;
    R0.clueKinds = R0.clueKinds || {}; R0.clueKinds[k] = (R0.clueKinds[k] || 0) + 1;
    this.meta.save();
  },
  rajisClueFx(k) {
    if (!this.run || this.state === 'runend') return;
    if (k === 'crt') { takeOverScreens(['RAJIS'], 420, '#8fd14f', '#021004'); this.audio.staticBurst(0.15, 0.03); }
    else if (k === 'beep') this.audio.radarPing();
    else if (k === 'warn') this.ui.missileGlyph?.();
  },

  startRajis() {
    const d = this.meta.data;
    const seed = (Math.random() * 4294967296) >>> 0;
    this.suspended = null;
    this.bestRec = null;
    const [mini, boss] = withSeed([seed, 'rajis-bosses'], () => [...RAJIS_ORDER].sort(() => rand() - 0.5).slice(0, 2));
    const locs = withSeed([seed, 'rajis-locs'], () => [...MISSION_LOCS].sort(() => rand() - 0.5));
    this.run = {
      floor: 2, node: -1, hearts: 4, maxHearts: 4, chips: 10, score: 0,
      relics: [], items: [], streak: 0, seenEvents: [], usedBosses: [], lastType: null,
      stats: { bestShot: 0, tables: 0, pots: 0, bosses: 0, scratches: 0, maxStreak: 0, mostBalls: 0, bestShotLabel: '', misses: 0, longestBank: 0, mostTriggers: 0 }, doubleTapCount: 0,
      style: 10, stylePeak: 0, basicRun: 0, heatPts: 0, heat: 0, heatMax: 0, time: 0,
      seed, mode: 'rajis', daily: null, endless: false, breakLv: 0, rookie: false, relicLv: {}, attempts: {}, hand: [], rewardMul: 1,
      op: CODENAMES[seed % CODENAMES.length],
      nodes: [
        { type: 'table', loc: locs[0] }, { type: 'table', loc: locs[1] }, { type: 'event', loc: 'command' }, { type: 'shop', loc: 'command' },
        { type: 'boss', boss: mini, loc: RAJIS_BOSSES[mini].loc, mini: true },
        { type: 'table', loc: locs[2] }, { type: 'boss', boss, loc: RAJIS_BOSSES[boss].loc }, { type: 'boss', boss: 'core', loc: 'command' },
      ],
    };
    d.rajis.runs = (d.rajis.runs || 0) + 1;
    this.clearSavedRun(false);
    this.meta.save();
    this.rajisTheme('command');
    this.ui.showHUD(true);
    this.ui.rajisBriefing(this.run, () => {
      const opts3 = withSeed([seed, 'rajis-starter'], () => rollRelics(3, [], { pool: 'rajis', rarityBoost: 0.6 }));
      this.ui.relicChoice(opts3, (r) => { const got = r ? this.gainRelic(r) : Promise.resolve(); got.then(() => this.ui.transition(() => this.advance())); }, { title: 'CHOOSE A PROTOCOL', skip: false });
    });
  },
  rajisResume() { this.ui.setRajis?.(true); },
  rajisTheme(loc) {
    const t = rajisTheme(loc);
    if (this.theme?.id === t.id) return;
    this.applyCosmetics(t);
  },
  // RAJIS missions: two briefings to choose from, then the war
  presentRajisNode(node) {
    const run = this.run;
    this.rajisTheme(node.loc || 'command');
    if (node.type !== 'table') return false;
    const choices = withSeed([run.seed, run.node, 'mission'], () => {
      const pool = Object.keys(MISSIONS).filter(id => ENCOUNTERS[id] && id !== 'blitz');
      const out = [];
      while (out.length < 2) {
        const id = pool.splice(Math.floor(rand() * pool.length), 1)[0];
        const def = ENCOUNTERS[id];
        const mods = rollMods(modCount(2, run.node, run.heat || 0, 'table', 0), def);
        const enc = makeEncounter(def, run.floor, 'table');
        this.decorateEncounter(enc, { mods });
        out.push({ def, kind: 'table', mods, enc, mission: MISSIONS[id], loc: node.loc });
      }
      return out;
    });
    this.idleTable();
    this.ui.chooseTable(choices, (c) => this.startEncounter(c.def, 'table', { mods: c.mods }));
    return true;
  },
  pickRajisEvent(run) {
    const pool = RAJIS_EVENTS.filter(e => !run.seenEvents.includes(e.id));
    return pool[Math.floor(rand() * pool.length)] || RAJIS_EVENTS[0];
  },
  rajisBossDone(pay) {
    const run = this.run, d = this.meta.data, e = this.enc;
    const def = e?.def;
    if (def) {
      d.rajis.bosses[def.id] = (d.rajis.bosses[def.id] || 0) + 1;
      if (def.ach) this.achieve(def.ach);
    }
    if (def?.id === 'paulyamin') { run.twoOfAKind = true; this.endRun(true); return; }
    if (def?.final) {
      // sometimes something else is listening on the same channel
      const signal = (d.rajis.clears || 0) >= 1 || run.hearts === run.maxHearts;
      if (signal && !run.mirrorAsked) { run.mirrorAsked = true; this.ui.rajisSignal((fight) => (fight ? this.ui.transition(() => this.startEncounter(RAJIS_BOSSES.paulyamin, 'boss')) : this.endRun(true))); return; }
      this.endRun(true);
      return;
    }
    this.offerRelics('boss', pay.bonus);
  },
  endRajis(won) {
    const run = this.run, d = this.meta.data, R0 = d.rajis;
    this.state = 'runend';
    this.camMode = 'result';
    this.cue.visible = false;
    this.aim.hide();
    this.clearSavedRun(false);
    this.audio.playMusic(won ? 'rajis' : 'none');
    const cleared = won && (run.twoOfAKind || this.enc?.def?.final || run.node >= run.nodes.length - 1);
    if (cleared) { R0.clears = (R0.clears || 0) + 1; if (!R0.fastest || run.time < R0.fastest) R0.fastest = Math.round(run.time); }
    R0.best = Math.max(R0.best || 0, run.score);
    const xp = Math.round(run.score / 40 + run.stats.tables * 30 + run.stats.bosses * 100 + (cleared ? 700 : 0));
    const lvl = this.meta.addXP(xp);
    this.pushHistory(cleared, gradeRun({ ...run, floor: cleared ? 3 : 2 }, cleared).grade);
    this.meta.save();
    this.ui.showHUD(false);
    this.ui.rajisEnd({ won: cleared, run, xp, lvl }, () => {
      this.runEnding = false;
      this.run = null;
      this.enc = null;
      this.ui.showRajisMenu?.();
    });
  },

  // -------------------------------------------------- enemy turns
  // the boss acts on the table after your shot; aim resumes when it settles
  enemyAct(fn) {
    this.state = 'enemy';
    this.cue.visible = false;
    this.aim.hide();
    fn();
    const wait = (n = 0) => this.later(0.12, () => {
      if (!this.enc || this.enc.done || this.runEnding) return;
      if (this.physics.isMoving() && n < 120) { wait(n + 1); return; }
      for (const b of this.physics.balls) { b.vx = b.vz = 0; b.wx = b.wy = b.wz = 0; }
      this.ensureBalls();
      const cue = this.physics.cue;
      if (!cue || cue.state !== 'table') this.beginPlace(); else this.beginAim();
    });
    this.later(0.5, () => wait());
    return true;
  },
  shove(b, ang, sp) {
    const k = this.hasRelic('p_counter') ? 0.4 : 1;
    b.vx += Math.cos(ang) * sp * k; b.vz += Math.sin(ang) * sp * k;
  },
  missileFx(x, z) {
    for (let i = 0; i < 10; i++) { const k = i / 10; this.fx.spawn(x + (1 - k) * 0.4, 0.05 + (1 - k) * 1.1, z - (1 - k) * 0.2, 0, -0.5, 0, i % 2 ? 0xffd040 : 0xff3b30, 0.25 + k * 0.2, 2, { grav: 0 }); }
    this.fx.burst(x, 0.04, z, [0xffffff, 0xff8a1b, 0xff3b30], 30, 1.4, { up: 1.4, life: 0.5 });
    this.fx.ring(x, z, 0xff3b30, 0.22, 0.3);
    this.fx.scar?.(x, z, 'scorch', 0.08);
    this.lights.flash(this.worldPos(x, z, 0.25), 0xff5020, 1.2, 1.6, 0.35);
    this.audio.explosion(0.8);
    this.shake(0.25);
  },

  // RICHARD: locks, missiles, salvos
  rjLock(e, n) {
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind !== 'cue' && !b.tags.lock && !b.tags.core);
    const have = this.physics.balls.filter(b => b.state === 'table' && b.tags.lock).length;
    for (const b of objs.sort(() => Math.random() - 0.5).slice(0, Math.max(0, n - have))) {
      b.tags.lock = true; b.tags.label = 'LOCK'; b.tags.labelColor = '#ff3b30';
      this.ballView.setTag(b, 0xff3b30, true);
      this.audio.tone(1760, { type: 'square', dur: 0.05, vol: 0.05, filter: 5000 });
    }
  },
  rjMissiles(e) {
    const locked = this.physics.balls.filter(b => b.state === 'table' && b.tags.lock);
    e.salvo = (e.salvo || 0) + 1;
    const salvo = e.phase >= 3 && e.salvo % 3 === 0;
    const targets = salvo ? this.physics.balls.filter(b => b.state === 'table' && b.kind !== 'cue').sort(() => Math.random() - 0.5).slice(0, 5) : locked;
    if (!targets.length) return false;
    this.ui.popup(salvo ? 'SALVO' : targets.length > 1 ? `${targets.length} MISSILES INBOUND` : 'MISSILE INBOUND', { color: '#ff3b30', scale: salvo ? 1.6 : 1.2 });
    this.audio.siren?.(0.8);
    return this.enemyAct(() => {
      targets.forEach((b, i) => this.later(0.35 + i * 0.22, () => {
        if (b.state !== 'table') return;
        this.missileFx(b.x, b.z);
        this.shove(b, Math.random() * Math.PI * 2, 1.2 + Math.random() * 0.8);
        for (const o of this.physics.balls) if (o !== b && o.state === 'table' && Math.hypot(o.x - b.x, o.z - b.z) < 0.12) this.shove(o, Math.atan2(o.z - b.z, o.x - b.x), 0.5);
        b.tags.lock = false; b.tags.label = null; this.ballView.setTag(b, null);
      }));
    });
  },

  // NEIL: support buffs
  rjSupport(e) {
    if (this.enc !== e || e.done) return;
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind === 'object' && !b.tags.support && !b.tags.core);
    for (const b of this.physics.balls) if (b.tags.support) { b.tags.support = false; b.tags.label = null; this.ballView.setTag(b, null); }
    const b = objs[Math.floor(Math.random() * objs.length)];
    if (!b) return;
    b.tags.support = true; b.tags.label = 'SUPPORT'; b.tags.labelColor = '#8fd14f';
    this.ballView.setTag(b, 0x8fd14f);
  },
  rjBuff(kind) {
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind === 'object' && !b.tags.support && !b.tags.buff && !b.tags.core);
    const b = objs[Math.floor(Math.random() * objs.length)];
    if (!b) return;
    const C = { SHIELDED: ['#8fd1ff', 0x8fd1ff], ACCELERATED: ['#f5c542', 0xf5c542], REPAIRED: ['#8fd14f', 0x8fd14f], LINKED: ['#c0a0ff', 0xc0a0ff] };
    b.tags.buff = kind; b.tags.label = kind; b.tags.labelColor = C[kind][0];
    this.ballView.setTag(b, C[kind][1]);
    if (kind === 'LINKED') {
      const o = objs.find(x => x !== b && !x.tags.buff);
      if (o) { o.tags.buff = kind; o.tags.label = kind; o.tags.labelColor = C[kind][0]; this.ballView.setTag(o, C[kind][1]); b.tags.link = o.id; o.tags.link = b.id; }
      else { b.tags.buff = 'SHIELDED'; b.tags.label = 'SHIELDED'; }
    }
    const sup = this.physics.balls.find(x => x.state === 'table' && x.tags.support);
    if (sup) this.fx.lightning(sup.x, sup.z, b.x, b.z, 0x8fd14f);
    this.audio.tone(990, { type: 'sine', dur: 0.2, vol: 0.06, slide: 1320, verb: 0.3 });
  },
  rjNeilTurn(e, S, n = null) {
    if (!this.physics.balls.some(b => b.state === 'table' && b.tags.support)) { e.supportGone = (e.supportGone || 0) + 1; if (e.supportGone >= 2) { e.supportGone = 0; this.rjSupport(e); } return; }
    const kinds = ['SHIELDED', 'ACCELERATED', 'REPAIRED', 'LINKED'];
    const count = n ?? (e.phase >= 2 ? 2 : 1);
    for (let i = 0; i < count; i++) this.rjBuff(kinds[Math.floor(Math.random() * kinds.length)]);
    if (e.phase >= 3 && e.def.id === 'neil') this.rjSupport(e);
  },
  rjCountsNeil(e, S, pot) {
    const b = pot.ball, t = b.tags;
    if (t.buff === 'SHIELDED') {
      this.popText('SHIELD HOLDS', '#8fd1ff');
      this.later(0.4, () => { const nb = this.spawnDropBall(b.num, 'object'); nb.tags.buff = 'SHIELDED'; nb.tags.label = 'SHIELDED'; nb.tags.labelColor = '#8fd1ff'; this.ballView.setTag(nb, 0x8fd1ff); });
      return false;
    }
    if (t.buff === 'REPAIRED') this.later(0.5, () => { this.spawnDropBall(b.num, 'object'); this.popText('REPAIRED', '#8fd14f'); });
    return true;
  },
  rjNeilProgress(e, S, d) {
    let delta = d;
    for (const p of S.pots) {
      if (!p.counted) continue;
      if (p.ball.tags.support) {
        delta += 1;
        for (const b of this.physics.balls) if (b.tags.buff) { b.tags.buff = null; b.tags.label = null; b.tags.link = null; this.ballView.setTag(b, null); }
        this.ui.popup('SUPPORT DOWN', { color: '#8fd14f', scale: 1.4 });
      }
      if (p.ball.tags.link && !S.pots.some(q => q.counted && q.ball.id === p.ball.tags.link)) {
        delta -= 1;
        this.popText('LINK INTACT', '#c0a0ff');
        const num = p.ball.num;
        this.later(0.4, () => this.spawnDropBall(num, 'object'));
      }
    }
    return delta;
  },
  rjFast(a, b) {
    const S = this.shot;
    if (!S) return;
    for (const q of [a, b]) {
      if (q.tags.buff !== 'ACCELERATED' || q.fastShot === S) continue;
      q.fastShot = S;
      q.vx *= 1.5; q.vz *= 1.5;
      this.fx.burst(q.x, 0.03, q.z, 0xf5c542, 10, 0.8, { life: 0.3 });
    }
  },

  // PAUL: prediction, the Cyber Bullet, lock-on
  rjPredict(e) {
    for (const b of this.physics.balls) if (b.tags.pred) { b.tags.pred = false; if (b.tags.label === 'PREDICTED') b.tags.label = null; this.ballView.setTag(b, null); }
    e.pred = null;
    const ph = this.physics, cue = ph.cue;
    if (!cue || cue.state !== 'table') return;
    let best = null;
    for (const b of ph.balls) {
      if (b.state !== 'table' || b.kind === 'cue' || b.tags.lock || b.tags.core) continue;
      for (const p of ph.pockets) {
        if (!p.open) continue;
        const tx = p.mid.x - b.x, tz = p.mid.z - b.z, tl = Math.hypot(tx, tz);
        const ux = tx / tl, uz = tz / tl;
        const gx = b.x - ux * 2 * R, gz = b.z - uz * 2 * R;
        const cx = gx - cue.x, cz = gz - cue.z, cl = Math.hypot(cx, cz);
        const cos = (cx * ux + cz * uz) / cl;
        if (cos < 0.55) continue;
        const score = cos * 2 - tl - cl * 0.5;
        if (!best || score > best.score) best = { score, b, p };
      }
    }
    if (!best) return;
    e.pred = { ball: best.b, pocket: best.p.index };
    best.b.tags.pred = true;
    if (!best.b.tags.label) { best.b.tags.label = 'PREDICTED'; best.b.tags.labelColor = '#8fd1ff'; }
    this.ballView.setTag(best.b, 0x8fd1ff, true);
    this.applyRules();
  },
  rjCountsPaul(e, S, pot) {
    if (e.pred && pot.ball === e.pred.ball && pot.pocket.index === e.pred.pocket) {
      this.popText('COUNTERED', '#8fd1ff', 1.3);
      const num = pot.ball.num;
      this.later(0.4, () => this.spawnDropBall(num, 'object'));
      return false;
    }
    return true;
  },
  rjLockOn(e) {
    const i = Math.floor(Math.random() * 6);
    e.closed = [i];
    e.lockPocket = i;
    this.applyRules();
  },
  rjCyberBullet(e) {
    const lane = (Math.random() - 0.5) * 0.7;
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.ui.cyberWarning?.();
    this.audio.engine?.(1.4);
    return this.enemyAct(() => {
      const car = this.cyberCar || (this.cyberCar = this.makeCar());
      car.run(lane, dir, (x, z, vx) => {
        for (const b of this.physics.balls) {
          if (b.state !== 'table') continue;
          const dx = b.x - x, dz = b.z - z;
          if (Math.abs(dz) < 0.06 && dx * dir > -0.02 && dx * dir < 0.1 && !b.carHit) {
            b.carHit = true;
            this.shove(b, Math.atan2((dz || 0.01) * 3, dir), 2.2);
            this.audio.clack(2.5, b.x);
            this.fx.burst(b.x, 0.03, b.z, [0xffffff, 0x8fd1ff], 12, 1, { life: 0.3 });
          }
        }
      }, () => { for (const b of this.physics.balls) b.carHit = false; });
    });
  },
  // a grey coupe that crosses the felt: low-poly, flat-shaded, nobody's car
  makeCar() {
    const g = new THREE.Group();
    const mk = (w, h, d, color, x, y, z, unlit = false) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ps1Material({ color, unlit, fog: unlit ? 0 : 1 }));
      m.position.set(x, y, z); g.add(m); return m;
    };
    mk(0.17, 0.028, 0.072, 0x7a7e86, 0, 0.026, 0);                 // body
    mk(0.075, 0.024, 0.062, 0x16181c, -0.012, 0.05, 0);            // cabin glass
    mk(0.05, 0.004, 0.066, 0x5a5e66, 0.05, 0.041, 0);              // bonnet stripe
    for (const [x, z] of [[0.055, 0.034], [0.055, -0.034], [-0.055, 0.034], [-0.055, -0.034]]) mk(0.03, 0.03, 0.012, 0x0a0a0a, x, 0.015, z);
    mk(0.004, 0.008, 0.02, 0xfff4d0, 0.086, 0.028, 0.022, true); mk(0.004, 0.008, 0.02, 0xfff4d0, 0.086, 0.028, -0.022, true);
    mk(0.004, 0.008, 0.024, 0xff2020, -0.086, 0.03, 0.02, true); mk(0.004, 0.008, 0.024, 0xff2020, -0.086, 0.03, -0.02, true);
    const laneMat = ps1Material({ color: 0xff2020, additive: true, unlit: true, fog: 0, opacity: 0.4 });
    const laneMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.11), laneMat);
    laneMesh.rotation.x = -Math.PI / 2;
    laneMesh.position.y = 0.002;
    this.table.group.add(laneMesh);
    g.visible = false; laneMesh.visible = false;
    this.table.group.add(g);
    const self = this;
    return {
      g, laneMesh,
      hide() { g.visible = false; laneMesh.visible = false; self.carRun = null; },
      run(lane, dir, hit, done) {
        laneMesh.position.z = lane; laneMesh.visible = true; g.visible = false;
        g.rotation.y = dir > 0 ? 0 : Math.PI;
        const t0 = self.time;
        self.carRun = (t) => {
          const k = (t - t0 - 0.6) / 1.1;
          laneMesh.material.uniforms.uOpacity.value = k < 0 ? 0.25 + 0.25 * Math.sin(t * 30) : 0.2 * (1 - Math.min(1, k));
          if (k < 0) return;
          g.visible = true;
          const x = -1.25 * dir + k * 2.5 * dir;
          g.position.set(x, 0, lane);
          hit(x, lane, dir);
          if (k >= 1) { this.hide(); done(); }
        };
      },
    };
  },

  // YAHYA: armour, the tank, shelling
  rjArmor(e, n) {
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind === 'object' && b.num !== 8 && !b.tags.armor);
    for (const b of objs.sort(() => rand() - 0.5).slice(0, n)) {
      b.tags.armor = 2; b.m = 2.2; b.tags.label = 'ARMOR 2'; b.tags.labelColor = '#c8ccd8';
      this.ballView.setTag(b, 0xc8ccd8, true);
    }
  },
  rjTank(e) {
    const p = this.physics.randomFreeSpot(0.15);
    const b = this.addBall(8, p.x, p.z);
    b.r = R * 1.7; b.m = 6; b.tags.armor = 3; b.tags.tank = true; b.tags.label = 'TANK 3'; b.tags.labelColor = '#f5c542';
    const s = this.physics.findFreeSpot(p.x, p.z, b); b.x = s.x; b.z = s.z;
    b.y = 0.4; b.vy = 0;
    this.ballView.prune();
    this.ballView.setTag(b, 0xf5c542, true);
    this.ui.popup('THE TANK', { color: '#f5c542', scale: 1.6 });
    this.audio.engine?.(2);
    this.shake(0.5);
  },
  rjCrack(a, b, v) {
    const counter = this.hasRelic('p_counter');
    for (const q of [a, b]) {
      if (!q.tags.armor || (v < 1.4 && !counter)) continue;
      if (q.crackT && this.time - q.crackT < 0.2) continue;
      q.crackT = this.time;
      q.tags.armor--;
      this.fx.burst(q.x, 0.03, q.z, [0xc8ccd8, 0xffffff], 14, 0.9, { life: 0.3 });
      this.audio.tone(1200, { type: 'square', dur: 0.05, vol: 0.08, filter: 3000 });
      if (q.tags.armor <= 0) {
        q.tags.label = q.tags.tank ? 'TANK DOWN' : null; q.m = q.tags.tank ? 4 : 1;
        this.ballView.setTag(q, null);
        this.popText(q.tags.tank ? 'TANK ARMOUR BROKEN' : 'ARMOUR CRACKED', '#c8ccd8');
      } else q.tags.label = `${q.tags.tank ? 'TANK' : 'ARMOR'} ${q.tags.armor}`;
    }
  },
  rjCountsArmor(S, pot) {
    const b = pot.ball;
    if (b.tags.armor > 0) {
      this.popText('ARMOUR DEFLECTS', '#c8ccd8');
      const t = { ...b.tags };
      this.later(0.4, () => { const nb = this.spawnDropBall(b.num, 'object'); Object.assign(nb.tags, t); nb.m = b.m; nb.r = b.r; this.ballView.setTag(nb, t.tank ? 0xf5c542 : 0xc8ccd8, true); });
      return false;
    }
    if (b.tags.tank) S.lines.push(['TANK DESTROYED', 1500]);
    return true;
  },
  rjYahyaTurn(e) {
    const tank = this.physics.balls.find(b => b.state === 'table' && b.tags.tank);
    const shells = e.phase >= 3 ? 2 : 0;
    if (!tank && !shells) return false;
    return this.enemyAct(() => {
      const cue = this.physics.cue;
      if (tank && cue) { this.shove(tank, Math.atan2(cue.z - tank.z, cue.x - tank.x), 0.9); this.audio.engine?.(1); }
      for (let i = 0; i < shells; i++) this.later(0.3 + i * 0.35, () => {
        const p = this.physics.randomFreeSpot(0.02);
        this.missileFx(p.x, p.z);
        for (const b of this.physics.balls) if (b.state === 'table' && Math.hypot(b.x - p.x, b.z - p.z) < 0.18) this.shove(b, Math.atan2(b.z - p.z, b.x - p.x), 1.1);
      });
    });
  },

  // RAJIS CORE: the last target
  rjCountsCore(e, S, pot) {
    const b = pot.ball;
    if (e.coreTime) return !!b.tags.core;
    if (b.tags.armor > 0) return this.rjCountsArmor(S, pot);
    if (e.phase >= 2) { if (!this.rjCountsNeil(e, S, pot)) return false; if (!this.rjCountsPaul(e, S, pot)) return false; }
    return true;
  },
  rjCoreTime(e) {
    if (e.coreTime) return;
    e.coreTime = true;
    for (const b of this.physics.balls) { if (b.tags.lock || b.tags.buff || b.tags.pred) { b.tags.lock = false; b.tags.buff = null; b.tags.pred = false; b.tags.label = null; this.ballView.setTag(b, null); } }
    const p = this.physics.randomFreeSpot(0.15);
    const core = this.addBall(3, p.x, p.z);
    core.r = R * 1.35; core.m = 1.6; core.tags.core = true; core.tags.label = 'CORE'; core.tags.labelColor = '#ff2020';
    const s = this.physics.findFreeSpot(p.x, p.z, core); core.x = s.x; core.z = s.z;
    core.y = 0.6; core.vy = 0;
    this.ballView.prune();
    this.ballView.setTag(core, 0xff2020);
    this.ui.bossPhase(e.def, 4, 'THE CORE IS EXPOSED');
    this.audio.siren?.(1.5);
    this.screenFlash(0xff2020, 0.5);
    this.shake(0.7);
  },

  // PAULYAMIN: the mirror
  rjMirror(e, S) {
    const mine = S.pots.filter(p => p.counted && !p.house).length;
    let k = mine;
    if (e.phase >= 2 && !mine && Math.random() < 0.5) k = 1;
    if (e.phase >= 3 && k) k += Math.random() < 0.35 ? 1 : 0;
    e.rivalTurns++;
    if (!k) { this.ui.rivalTurn(e, 0); return false; }
    return this.enemyAct(() => {
      const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind === 'object').sort(() => Math.random() - 0.5).slice(0, k);
      objs.forEach((b, i) => this.later(0.25 + i * 0.3, () => {
        if (b.state !== 'table') return;
        let best = null, bd = 1e9;
        for (const p of this.physics.pockets) { if (!p.open) continue; const d = Math.hypot(p.mid.x - b.x, p.mid.z - b.z); if (d < bd) { bd = d; best = p; } }
        if (!best) return;
        this.fx.lightning(b.x, b.z, best.mid.x, best.mid.z, 0xc0a0ff);
        const sp = Math.min(3.2, 1 + bd * 3);
        b.vx = (best.mid.x - b.x) / bd * sp; b.vz = (best.mid.z - b.z) / bd * sp;
      }));
      e.rivalScore = Math.min(e.goal, e.rivalScore + objs.length);
      this.ui.rivalTurn(e, objs.length);
      this.audio.tone(330, { type: 'square', dur: 0.1, vol: 0.07, filter: 2000 });
      this.audio.tone(311, { t: this.audio.now + 0.1, type: 'square', dur: 0.2, vol: 0.07, filter: 2000 });
      if (e.rivalScore >= e.goal) this.later(1.6, () => this.failEncounter('PAULYAMIN WINS'));
    });
  },
  // PROTOCOL: DRONE SUPPORT
  droneNudge(pocket) {
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind === 'object');
    if (!objs.length) return;
    const b = objs.sort((a, c) => Math.hypot(a.x - pocket.x, a.z - pocket.z) - Math.hypot(c.x - pocket.x, c.z - pocket.z))[0];
    let best = null, bd = 1e9;
    for (const p of this.physics.pockets) { if (!p.open) continue; const d = Math.hypot(p.mid.x - b.x, p.mid.z - b.z); if (d < bd) { bd = d; best = p; } }
    if (!best) return;
    this.fx.lightning(pocket.x, pocket.z, b.x, b.z, 0x8fd14f);
    b.vx += (best.mid.x - b.x) / bd * 0.55; b.vz += (best.mid.z - b.z) / bd * 0.55;
    b.relicMoved = true;
  },
};

export { MISSIONS, CODENAMES, MISSION_LOCS };
