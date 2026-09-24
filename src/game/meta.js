// META PROGRESSION — XP, levels, unlocks, achievements, stats and settings,
// all persisted to localStorage.

import { THEMES, BALL_SKINS, CUE_SKINS, FELTS, TRAILS, POCKET_FX, COSMETICS, KIND_NAME, BALL_RENAMED, CUE_RENAMED } from './cosmetics.js';
import { RELICS } from './relics.js';

const KEY = 'scratch_save_v1';            // storage slot (the format inside is versioned)
export const SAVE_VERSION = 3;
export const GAME_VERSION = '2.1.0';
export const UPDATE_NAME = 'AFTERHOURS';

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'FIRST BLOOD', desc: 'Pot your first ball.' },
  { id: 'bankrupt', name: 'BANKRUPT', desc: 'Perform 10 bank shots.', stat: ['banks', 10] },
  { id: 'how', name: 'HOW?', desc: 'Pot three balls in one shot.', reward: 'EYEBALLS balls' },
  { id: 'scratch_master', name: 'SCRATCH', desc: 'Scratch 10 times. It\'s in the name.', stat: ['scratches', 10], reward: 'BLOOD balls' },
  { id: 'nuclear', name: 'NUCLEAR', desc: 'Trigger three explosions from one shot.', reward: 'DRAGON cue' },
  { id: 'perfect', name: 'PERFECT GAME', desc: 'Clear a table without a single missed shot.', reward: 'GLASS balls' },
  { id: 'boss_slayer', name: 'BOSS SLAYER', desc: 'Defeat a boss table.', reward: 'CHROME balls' },
  { id: 'gold_rush', name: 'GOLD RUSH', desc: 'Pot 5 golden balls.', stat: ['golds', 5], reward: 'GOLD balls' },
  { id: 'ghost', name: 'PHANTOM', desc: 'Pass straight through a ball.', reward: 'TRANSPARENT cue' },
  { id: 'champion', name: 'CHAMPION', desc: 'Beat The House and win a run.', reward: 'GOLDEN cue' },
  { id: 'high_roller', name: 'HIGH ROLLER', desc: 'Hold 60 chips at once.' },
  { id: 'collector', name: 'COLLECTOR', desc: 'Fill all 8 relic slots in a single run.' },
  { id: 'cursed', name: 'HEXED', desc: 'Hold 3 cursed relics at once.' },
  { id: 'lucky', name: 'LUCKY', desc: 'Pot the 7-ball while holding Lucky Seven.' },
  { id: 'break_master', name: 'BREAK DANCER', desc: 'Pot 3 or more balls on a break.' },
  { id: 'call_it', name: 'CALL IT', desc: 'Finish a table by sinking the 8 last.' },
  { id: 'trick', name: 'SHOWBOAT', desc: 'Land a trick shot: cushion first, then pot.' },
  { id: 'mega', name: 'MEGA SHOT', desc: 'Score 5,000 in a single shot.' },
  { id: 'speed_demon', name: 'SPEED DEMON', desc: 'Finish a Blitz with 30+ seconds left.' },
  { id: 'clean_break', name: 'CLEAN BREAK', desc: 'Pot 2 or more balls on a break.' },
  { id: 'why', name: 'WHY WOULD YOU DO THAT?', desc: 'Scratch three times on one table.' },
  { id: 'geometry', name: 'GEOMETRY', desc: 'Pot a ball off three cushions.' },
  { id: 'domino', name: 'DOMINO EFFECT', desc: 'Pot three balls in one shot through a chain reaction.' },
  { id: 'what', name: 'WHAT JUST HAPPENED?', desc: 'Trigger five different effects in a single shot.' },
  { id: 'untouchable', name: 'UNTOUCHABLE', desc: 'Beat a boss without missing a shot.' },
  { id: 'all_in', name: 'ALL IN', desc: 'Win a High Stakes table.' },
  { id: 'upgraded', name: 'TUNED UP', desc: 'Upgrade a relic.' },
  { id: 'too_hot', name: 'TOO HOT', desc: 'Reach HEAT V.', reward: 'MOLTEN balls' },
  { id: 'daily', name: 'DAILY GRIND', desc: 'Complete a Daily Scratch.', reward: 'DAYBREAK balls' },
  { id: 'deep', name: 'DEEPER', desc: 'Reach floor 5 in Endless.', reward: 'THE VOID table' },
  { id: 'breaker', name: 'BREAK POINT', desc: 'Win a run at BREAK 1 or higher.', reward: 'THE BREAKER cue' },
  { id: 'classic_win', name: 'CLASSIC', desc: 'Win your first normal 8-ball match.' },
  { id: 'hustler', name: 'HUSTLER', desc: 'Beat the Expert AI at normal 8-ball.', reward: 'EBONY classic cue' },
  { id: 'tourney', name: 'HOUSE CHAMPION', desc: 'Win a four-player Classic tournament.', reward: 'GOLD INLAY classic cue' },
  { id: 'break_run', name: 'BREAK & RUN', desc: 'At the Classic table, break and clear your group and the 8 without your opponent taking a shot.' },
  { id: 'flashback', name: 'WE\'VE MET BEFORE', desc: 'Play the table from 1987.', secret: true },
  { id: 'eights', name: 'EIGHT OF EIGHT', desc: 'Wake the eight on the title screen.', secret: true, reward: 'ALL EIGHTS balls' },
  { id: 'curious', name: 'CURIOUS', desc: 'Ask who made this. Five times.', secret: true },
  // ---- AFTERHOURS
  { id: 'state_first', name: 'SOMETHING CHANGED', desc: 'Live through your first Table State.' },
  { id: 'contractor', name: 'CONTRACTOR', desc: 'Complete 5 contracts.', stat: ['contracts', 5], reward: 'THE FINE PRINT cue' },
  { id: 'whale', name: 'WHALE', desc: 'Win a HIGH ROLLER table after going ALL IN.' },
  { id: 'rival_beat', name: 'NOT TODAY', desc: 'Beat a rival at their own table.' },
  { id: 'nemesis', name: 'OLD FRIENDS', desc: 'Defeat your Nemesis.', reward: 'GRUDGE cue' },
  { id: 'synergist', name: 'CHEMIST', desc: 'Discover 5 hidden synergies.', reward: 'ALCHEMY balls' },
  { id: 'mad_science', name: 'MAD SCIENCE', desc: 'Discover every hidden synergy.', secret: true },
  { id: 'overcharged', name: 'OVERCHARGED', desc: 'Overcharge a relic.' },
  { id: 'trick_table', name: 'SHOWSTOPPER', desc: 'Solve a Trick Table.' },
  { id: 'remixed', name: 'REMIXED', desc: 'Beat a boss remix.' },
  { id: 'boss_rush', name: 'RUSH HOUR', desc: 'Clear Boss Rush.' },
  { id: 'one_cue', name: 'ONE CUE', desc: 'Clear a One Cue run.' },
  { id: 'chaos_win', name: 'AGENT OF CHAOS', desc: 'Win a Chaos run.' },
  { id: 'risky', name: 'NO RISK, NO RELIC', desc: 'Win a run holding 2 risk relics.' },
  { id: 'afterhours', name: 'AFTER HOURS', desc: 'Stay after closing.', secret: true },
  { id: 'last_game', name: 'LAST GAME', desc: 'Beat The Owner.', secret: true, reward: 'CLOSING TIME table' },
  { id: 'insomniac', name: 'INSOMNIAC', desc: 'Something is awake at 03:77.', secret: true },
  { id: 'regular', name: 'THE REGULAR', desc: 'Finish 10 runs.', stat: ['finished', 10] },
  // ---- (hidden entirely until you find it)
  { id: 'rajis_found', name: 'RAJIS?', desc: 'Find RAJIS.', secret: true, rajis: true },
  { id: 'intercepted', name: 'INTERCEPTED', desc: 'Defeat Richard.', secret: true, rajis: true, reward: 'MISSILE cue' },
  { id: 'supply_chain', name: 'SUPPLY CHAIN', desc: 'Defeat Neil.', secret: true, rajis: true, reward: 'RADAR balls' },
  { id: 'machine_learning', name: 'MACHINE LEARNING', desc: 'Defeat Paul.', secret: true, rajis: true, reward: 'CYBER BULLET cue' },
  { id: 'heavy_industry', name: 'HEAVY INDUSTRY', desc: 'Defeat Yahya.', secret: true, rajis: true, reward: 'WARNING STRIPE cue' },
  { id: 'system_online', name: 'SYSTEM ONLINE', desc: 'Complete RAJIS.', secret: true, rajis: true, reward: 'COMMAND table' },
  { id: 'paulyamin', name: 'TWO OF A KIND', desc: 'Defeat PAULYAMIN.', secret: true, rajis: true, reward: 'ROBOT balls' },
];

// what each achievement unlocks, read from the cosmetics themselves
for (const a of ACHIEVEMENTS) {
  const got = Object.entries(COSMETICS).flatMap(([kind, list]) => list.filter(it => it.unlock?.ach === a.id).map(it => `${it.name} ${KIND_NAME[kind].toLowerCase()}`));
  if (got.length) a.reward = got.join(' · '); else delete a.reward;
}

// Level → what it unlocks (in addition to cosmetic unlock.level fields).
export const STARTER_RELICS = [
  { level: 5, id: 'bucket_pockets' }, { level: 5, id: 'laser_sight' }, { level: 6, id: 'heavy_cue' },
  { level: 8, id: 'piggy_bank' }, { level: 9, id: 'spin_doctor' }, { level: 11, id: 'explosive_chalk' },
  { level: 12, id: 'moon_gravity' }, { level: 14, id: 'thunder_cue' }, { level: 17, id: 'demon_chalk' },
  { level: 19, id: 'pinball' }, { level: 20, id: 'nitro' },
];

export function xpForLevel(l) { return Math.round(300 + (l - 1) * 180 + Math.pow(l - 1, 1.6) * 30); }

// SCRATCH CLASSIC keeps its own settings, looks and records (master volume,
// UI scale and display mode are shared with the roguelite).
export function classicDefaults() {
  return {
    settings: { quality: 'high', shadows: true, reflections: true, aa: true, aim: 'full', camera: '3d', follow: false, ambience: true, music: 0.5, sfx: 0.9, cosmetics: 'classic' },
    look: { felt: 'green', cue: 'wood', light: 'warm', balls: 'classic', room: 'lounge', trail: 'off', pocket: 'quiet' },
    names: { p1: 'Player 1', p2: 'Player 2' },
    ai: 'normal', bestOf: 1, style: 'balanced', clock: 0, format: 'single',
    quick: { level: 'normal' },
    custom: { opp: 'marcus', level: 'normal', style: 'auto', format: 'single', clock: 0 },
    rivals: {},               // regular's id → { w, l } against you
    drills: {},               // practice challenge id → best score
    xp: 0, level: 1,          // CLASSIC LEVEL: unlocks looks only
    introDone: false,
    stats: { played: 0, won: 0, streak: 0, bestStreak: 0, breakRuns: 0, potted: 0, longest: 0, frames: 0, localMatches: 0, aiWins: { easy: 0, normal: 0, hard: 0, expert: 0 }, framesWon: 0, fouls: 0, clockFouls: 0, highRun: 0, tourneys: 0, tourneysPlayed: 0, banks: 0, safeties: 0, playtime: 0 },
  };
}

function mergeClassic(c = {}) {
  const d = classicDefaults();
  const o = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const out = {
    ...d, ...c,
    settings: { ...d.settings, ...o(c.settings) },
    look: { ...d.look, ...o(c.look) },
    names: { ...d.names, ...o(c.names) },
    quick: { ...d.quick, ...o(c.quick) },
    custom: { ...d.custom, ...o(c.custom) },
    rivals: o(c.rivals), drills: o(c.drills),
    stats: { ...d.stats, ...o(c.stats), aiWins: { ...d.stats.aiWins, ...o(c.stats?.aiWins) } },
  };
  // 2.0 → 2.1: a best-of number becomes a format; a Classic record becomes a level
  if (!c.format && c.bestOf) out.format = { 1: 'single', 3: 'bo3', 5: 'bo5', 7: 'race5' }[c.bestOf] || 'single';
  if (out.style === 'cautious') out.style = 'safe';
  if (!Number.isFinite(c.xp)) {
    const st = out.stats;
    let xp = (st.won || 0) * 120 + Math.max(0, (st.played || 0) - (st.won || 0)) * 50 + (st.potted || 0) * 3 + (st.breakRuns || 0) * 150 + (st.tourneys || 0) * 300;
    let lv = 1;
    while (xp >= 300 + (lv - 1) * 150) { xp -= 300 + (lv - 1) * 150; lv++; }
    out.xp = xp; out.level = lv;
    if ((st.played || 0) > 0) out.introDone = true;
  }
  return out;
}

function defaults() {
  return {
    xp: 0, level: 1,
    selected: { ball: 'classic', cue: 'wood', theme: 'midnight', shuffle: false, starter: null, felt: 'theme', trail: 'light', pocket: 'classic' },
    loadouts: { rajis: null },  // the RAJIS loadout, once RAJIS exists
    cosFav: {},               // 'kind:id' → true (Loadout ★)
    cosSeen: {},              // 'kind:id' → true once looked at (the NEW filter)
    learned: {},              // first-time objective explanations already shown
    bought: [],             // cosmetics bought in shops
    achievements: {},
    seenRelics: {},
    stats: { pots: 0, banks: 0, scratches: 0, golds: 0, runs: 0, wins: 0, bestScore: 0, bestShot: 0, tables: 0, bosses: 0, contracts: 0, finished: 0 },
    settings: {
      // gameplay
      camera: 'cinematic', aim: 'full', shake: 1, flash: 'full', heat: true, commentary: true,
      // graphics
      gfx: 'ps1', resScale: 'auto', crt: true, bloom: true, particles: 'high', trails: true,
      // ui
      uiScale: 'auto', safe: 'normal',
      // audio
      master: 0.8, music: 0.55, sfx: 0.9,
    },
    bests: { highScore: 0, fastestWin: 0, highestHeat: 0, largestCombo: 0, mostBalls: 0, bestGrade: '', highestStyle: 0, longestBank: 0, mostTriggers: 0, furthestFloor: 0, bossRushTime: 0, bossRushScore: 0, bossRushMisses: -1, chaosBest: 0, oneCueBest: 0 },
    tutorialDone: false,
    tips: {},                 // contextual tips already shown
    bosses: {},               // boss id → times beaten
    seen: { bosses: {}, anomalies: {} },
    unlocks: {},              // endless …
    breakMax: 0,              // highest BREAK level unlocked
    daily: null,              // { date, best, bestHeat, completed, played }
    endless: { deepest: 0, best: 0, heat: 0 },
    classic: classicDefaults(),
    // ---- AFTERHOURS (save v3)
    synergies: {},            // hidden synergy id → when it was first discovered
    rivals: {},               // rival id → { wins, losses, nemesis, level }
    runHistory: [],           // the last 10 finished runs, newest first
    favorites: {},            // relic id → true (Collection ★ — cosmetic only)
    remixes: {},              // boss id → remixes beaten
    states: {},               // table state id → times lived through
    afterhours: { found: false, cleared: 0 },
    rajis: { found: false, clears: 0, runs: 0, bosses: {}, fastest: 0, best: 0, clues: 0, clueKinds: {}, how: null },
    secrets: {},              // small things found (title easter eggs…)
    announced: {},            // unlock notices already shown
    handSel: [],              // handicaps chosen for the next run
    v: SAVE_VERSION,
  };
}

// Merge a (possibly old or partial) save into today's shape. Unknown keys are
// kept; wrong-typed values fall back to defaults instead of crashing the game.
// cosmetics renamed or retired in 2.1 become their closest successor
function fixSelected(sel) {
  if (sel.ball) sel.ball = BALL_RENAMED[sel.ball] || sel.ball;
  if (sel.cue) sel.cue = CUE_RENAMED[sel.cue] || sel.cue;
  if (!BALL_SKINS.some(b => b.id === sel.ball)) sel.ball = 'classic';
  if (!CUE_SKINS.some(c => c.id === sel.cue)) sel.cue = 'wood';
  if (sel.felt && !FELTS.some(f => f.id === sel.felt)) sel.felt = 'theme';
  if (sel.trail && !TRAILS.some(f => f.id === sel.trail)) sel.trail = 'light';
  if (sel.pocket && !POCKET_FX.some(f => f.id === sel.pocket)) sel.pocket = 'classic';
  return sel;
}
function fixBought(k) {
  const [kind, id] = k.split(':');
  if (kind === 'ball') return `ball:${BALL_RENAMED[id] || id}`;
  if (kind === 'cue') return `cue:${CUE_RENAMED[id] || id}`;
  return k;
}

function mergeSave(d) {
  const def = defaults();
  if (!d || typeof d !== 'object') return def;
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const s = { ...def.settings, ...obj(d.settings) };
  if (typeof s.bloom === 'number') s.bloom = s.bloom > 0;           // v1 → v2
  for (const k of ['res', 'ca', 'grain', 'jitter']) delete s[k];
  const out = {
    ...def, ...d,
    selected: fixSelected({ ...def.selected, ...obj(d.selected) }), stats: { ...def.stats, ...obj(d.stats) }, settings: s,
    loadouts: { rajis: d.loadouts?.rajis && typeof d.loadouts.rajis === 'object' ? fixSelected({ ...d.loadouts.rajis }) : null },
    cosFav: obj(d.cosFav), cosSeen: obj(d.cosSeen), learned: obj(d.learned),
    bests: { ...def.bests, ...obj(d.bests) }, classic: mergeClassic(obj(d.classic)),
    tips: obj(d.tips), bosses: obj(d.bosses), unlocks: obj(d.unlocks),
    seen: { bosses: obj(d.seen?.bosses), anomalies: obj(d.seen?.anomalies) },
    endless: { ...def.endless, ...obj(d.endless) },
    synergies: obj(d.synergies), rivals: obj(d.rivals), favorites: obj(d.favorites), remixes: obj(d.remixes), states: obj(d.states),
    secrets: obj(d.secrets), announced: obj(d.announced),
    runHistory: Array.isArray(d.runHistory) ? d.runHistory.filter(r => r && typeof r === 'object').slice(0, 10) : [],
    handSel: Array.isArray(d.handSel) ? d.handSel.filter(x => typeof x === 'string') : [],
    afterhours: { ...def.afterhours, ...obj(d.afterhours) },
    rajis: { ...def.rajis, ...obj(d.rajis), bosses: obj(d.rajis?.bosses), clueKinds: obj(d.rajis?.clueKinds) },
    achievements: obj(d.achievements), seenRelics: obj(d.seenRelics),
    bought: Array.isArray(d.bought) ? d.bought.filter(x => typeof x === 'string').map(fixBought) : [],
    xp: Number.isFinite(d.xp) ? d.xp : 0, level: Number.isFinite(d.level) && d.level >= 1 ? d.level : 1,
    breakMax: Number.isFinite(d.breakMax) ? d.breakMax : 0,
    v: SAVE_VERSION,
  };
  if (out.savedRun && (typeof out.savedRun !== 'object' || !Array.isArray(out.savedRun.nodes))) delete out.savedRun;
  return out;
}

export class Meta {
  constructor() {
    this.data = defaults();
    this.problem = null;
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { this.problem = 'nostorage'; }
    if (raw) {
      try { this.data = mergeSave(JSON.parse(raw)); }
      catch (e) {
        // unreadable save: keep a copy aside and start fresh rather than crash
        this.problem = 'corrupt';
        try { localStorage.setItem(KEY + '_unreadable', raw); } catch (e2) { /* ignore */ }
      }
    }
    this.listeners = [];
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); }
    catch (e) { if (!this.problem) this.problem = 'nostorage'; }    // blocked or full: play on, warn once
  }
  reset() { this.data = defaults(); this.save(); }

  // save transfer: a single line of text the player can keep or move
  exportSave() {
    const json = JSON.stringify({ game: 'SCRATCH', v: SAVE_VERSION, data: this.data });
    return 'SCRATCH1:' + btoa(unescape(encodeURIComponent(json)));
  }
  importSave(text) {
    const t = String(text || '').trim();
    if (!t.startsWith('SCRATCH1:')) throw new Error('That does not look like a SCRATCH save.');
    let obj;
    try { obj = JSON.parse(decodeURIComponent(escape(atob(t.slice(9).replace(/\s+/g, ''))))); } catch (e) { obj = null; }
    if (!obj || obj.game !== 'SCRATCH' || !obj.data || typeof obj.data !== 'object') throw new Error('That save is damaged or incomplete.');
    this.data = mergeSave(obj.data);
    this.save();
  }

  // What the club shows you. Things open up by playing well, never by grinding:
  // a player who already beat SCRATCH before AFTERHOURS sees most of it at once.
  unlocked(feature) {
    const d = this.data, st = d.stats, B = d.bests;
    const wins = st.wins || 0, heat = B.highestHeat || 0, far = B.furthestFloor || 0;
    switch (feature) {
      case 'contracts': case 'highroller': case 'rivals': case 'newtables':
        return wins >= 1 || far >= 3;
      case 'onecue': case 'handicaps': return wins >= 1;
      case 'states': return wins >= 2 || heat >= 4 || (wins >= 1 && far >= 3 && (st.runs || 0) >= 6);
      case 'chaos': return wins >= 2 || heat >= 5;
      case 'bossrush': return wins >= 3 || Object.keys(d.bosses || {}).length >= 5;
      case 'afterhours': return !!d.afterhours?.found;
      case 'rajis': return !!d.rajis?.found;
      default: return false;
    }
  }

  markSeen(kind, id) {
    if (!kind || !id) return;
    const bag = this.data.seen[kind] = this.data.seen[kind] || {};
    if (!bag[id]) { bag[id] = 1; this.save(); }
  }

  // things that belong to RAJIS do not exist until it has been found
  visible(item) { return !item?.rajis || !!this.data.rajis?.found; }
  achievementList() { return ACHIEVEMENTS.filter(a => this.visible(a)); }

  get level() { return this.data.level; }
  get s() { return this.data.settings; }

  isUnlocked(item) {
    const u = item.unlock || {};
    if (this.data.bought.includes(`${item.kind}:${item.id}`)) return true;
    if (u.level && this.data.level >= u.level) return true;
    if (u.clevel && (this.data.classic?.level || 1) >= u.clevel) return true;
    if (u.ach && this.data.achievements[u.ach]) return true;
    return !u.level && !u.ach && !u.clevel;
  }
  // how a locked cosmetic is earned, in words (secret achievements stay secret)
  unlockText(item) {
    const u = item.unlock || {};
    if (u.ach) { const a = ACHIEVEMENTS.find(x => x.id === u.ach); return a?.secret && !this.data.achievements[a.id] ? 'A SECRET' : `ACHIEVEMENT · ${a?.name || '?'}`; }
    if (u.clevel) return `CLASSIC LEVEL ${u.clevel}`;
    if (u.level) return `REACH LV ${u.level}`;
    return '';
  }
  cosKey(item) { return `${item.kind}:${item.id}`; }
  unlockedBalls() { return BALL_SKINS.filter(b => this.isUnlocked(b)); }
  unlockedCues() { return CUE_SKINS.filter(b => this.isUnlocked(b)); }
  unlockedThemes() { return THEMES.filter(b => this.isUnlocked(b)); }
  starterRelics() { return STARTER_RELICS.filter(s => this.data.level >= s.level).map(s => RELICS.find(r => r.id === s.id)).filter(Boolean); }

  // the plain, basic things a shop may sell for chips (never the earned ones)
  lockedCosmetics() {
    return [
      ...BALL_SKINS.filter(b => b.buy && !this.isUnlocked(b)).map(b => ({ kind: 'ball', item: b })),
      ...CUE_SKINS.filter(b => b.buy && !this.isUnlocked(b)).map(b => ({ kind: 'cue', item: b })),
      ...FELTS.filter(b => b.buy && !this.isUnlocked(b)).map(b => ({ kind: 'felt', item: b })),
    ];
  }
  buyCosmetic(item) { const k = `${item.kind}:${item.id}`; if (!this.data.bought.includes(k)) this.data.bought.push(k); this.save(); }

  // returns list of achievements newly earned
  achieve(id) {
    if (this.data.achievements[id]) return false;
    this.data.achievements[id] = Date.now();
    this.save();
    return ACHIEVEMENTS.find(a => a.id === id);
  }

  stat(key, add = 1) {
    this.data.stats[key] = (this.data.stats[key] || 0) + add;
    const out = [];
    for (const a of ACHIEVEMENTS) {
      if (a.stat && a.stat[0] === key && this.data.stats[key] >= a.stat[1]) { const r = this.achieve(a.id); if (r) out.push(r); }
    }
    return out;
  }

  seeRelic(id) { if (!this.data.seenRelics[id]) { this.data.seenRelics[id] = 1; this.save(); } }

  // Add XP, returns {levels: [newLevel...], unlocks: [strings]}
  addXP(xp) {
    const before = this.data.level;
    this.data.xp += xp;
    while (this.data.xp >= xpForLevel(this.data.level)) {
      this.data.xp -= xpForLevel(this.data.level);
      this.data.level++;
    }
    const unlocks = [];
    this.newCosmetics = this.newCosmetics || [];
    for (let l = before + 1; l <= this.data.level; l++) {
      for (const [kind, list] of Object.entries(COSMETICS)) for (const it of list) if (it.unlock?.level === l && !it.rajis) { unlocks.push(`${KIND_NAME[kind]}: ${it.name}`); this.newCosmetics.push(it); }
      for (const s of STARTER_RELICS) if (s.level === l) { const r = RELICS.find(x => x.id === s.id); if (r) unlocks.push(`STARTER RELIC: ${r.name}`); }
    }
    this.save();
    return { from: before, to: this.data.level, unlocks };
  }
}
