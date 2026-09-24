// META PROGRESSION — XP, levels, unlocks, achievements, stats and settings,
// all persisted to localStorage.

import { THEMES, BALL_SKINS, CUE_SKINS } from './cosmetics.js';
import { RELICS } from './relics.js';

const KEY = 'scratch_save_v1';            // storage slot (the format inside is versioned)
export const SAVE_VERSION = 2;
export const GAME_VERSION = '1.0.0';

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
  { id: 'flashback', name: 'WE\'VE MET BEFORE', desc: 'Play the table from 1987.', secret: true },
  { id: 'eights', name: 'EIGHT OF EIGHT', desc: 'Wake the eight on the title screen.', secret: true, reward: 'ALL EIGHTS balls' },
  { id: 'curious', name: 'CURIOUS', desc: 'Ask who made this. Five times.', secret: true },
];

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
    settings: { quality: 'high', shadows: true, reflections: true, aa: true, aim: 'full', camera: '3d', ambience: true, music: 0.5, sfx: 0.9 },
    look: { felt: 'green', cue: 'wood', light: 'warm', balls: 'classic' },
    names: { p1: 'Player 1', p2: 'Player 2' },
    ai: 'normal', bestOf: 1,
    stats: { played: 0, won: 0, streak: 0, bestStreak: 0, breakRuns: 0, potted: 0, longest: 0, frames: 0, localMatches: 0, aiWins: { easy: 0, normal: 0, hard: 0, expert: 0 } },
  };
}

function mergeClassic(c = {}) {
  const d = classicDefaults();
  return {
    ...d, ...c,
    settings: { ...d.settings, ...(c.settings || {}) },
    look: { ...d.look, ...(c.look || {}) },
    names: { ...d.names, ...(c.names || {}) },
    stats: { ...d.stats, ...(c.stats || {}), aiWins: { ...d.stats.aiWins, ...(c.stats?.aiWins || {}) } },
  };
}

function defaults() {
  return {
    xp: 0, level: 1,
    selected: { ball: 'classic', cue: 'wood', theme: 'midnight', shuffle: false, starter: null },
    bought: [],             // cosmetics bought in shops
    achievements: {},
    seenRelics: {},
    stats: { pots: 0, banks: 0, scratches: 0, golds: 0, runs: 0, wins: 0, bestScore: 0, bestShot: 0, tables: 0, bosses: 0 },
    settings: {
      // gameplay
      camera: 'cinematic', aim: 'full', shake: 1, flash: 'full', heat: true,
      // graphics
      gfx: 'ps1', resScale: 'auto', crt: true, bloom: true, particles: 'high',
      // ui
      uiScale: 'auto', safe: 'normal',
      // audio
      master: 0.8, music: 0.55, sfx: 0.9,
    },
    bests: { highScore: 0, fastestWin: 0, highestHeat: 0, largestCombo: 0, mostBalls: 0, bestGrade: '' },
    tutorialDone: false,
    tips: {},                 // contextual tips already shown
    bosses: {},               // boss id → times beaten
    seen: { bosses: {}, anomalies: {} },
    unlocks: {},              // endless …
    breakMax: 0,              // highest BREAK level unlocked
    daily: null,              // { date, best, bestHeat, completed, played }
    endless: { deepest: 0, best: 0, heat: 0 },
    classic: classicDefaults(),
    v: SAVE_VERSION,
  };
}

// Merge a (possibly old or partial) save into today's shape. Unknown keys are
// kept; wrong-typed values fall back to defaults instead of crashing the game.
function mergeSave(d) {
  const def = defaults();
  if (!d || typeof d !== 'object') return def;
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const s = { ...def.settings, ...obj(d.settings) };
  if (typeof s.bloom === 'number') s.bloom = s.bloom > 0;           // v1 → v2
  for (const k of ['res', 'ca', 'grain', 'jitter']) delete s[k];
  const out = {
    ...def, ...d,
    selected: { ...def.selected, ...obj(d.selected) }, stats: { ...def.stats, ...obj(d.stats) }, settings: s,
    bests: { ...def.bests, ...obj(d.bests) }, classic: mergeClassic(obj(d.classic)),
    tips: obj(d.tips), bosses: obj(d.bosses), unlocks: obj(d.unlocks),
    seen: { bosses: obj(d.seen?.bosses), anomalies: obj(d.seen?.anomalies) },
    endless: { ...def.endless, ...obj(d.endless) },
    achievements: obj(d.achievements), seenRelics: obj(d.seenRelics),
    bought: Array.isArray(d.bought) ? d.bought : [],
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

  markSeen(kind, id) {
    if (!kind || !id) return;
    const bag = this.data.seen[kind] = this.data.seen[kind] || {};
    if (!bag[id]) { bag[id] = 1; this.save(); }
  }

  get level() { return this.data.level; }
  get s() { return this.data.settings; }

  isUnlocked(item) {
    const u = item.unlock || {};
    if (this.data.bought.includes(`${item.kind}:${item.id}`)) return true;
    if (u.level && this.data.level >= u.level) return true;
    if (u.ach && this.data.achievements[u.ach]) return true;
    return !u.level && !u.ach;
  }
  unlockedBalls() { return BALL_SKINS.filter(b => this.isUnlocked(b)); }
  unlockedCues() { return CUE_SKINS.filter(b => this.isUnlocked(b)); }
  unlockedThemes() { return THEMES.filter(b => this.isUnlocked(b)); }
  starterRelics() { return STARTER_RELICS.filter(s => this.data.level >= s.level).map(s => RELICS.find(r => r.id === s.id)).filter(Boolean); }

  lockedCosmetics() {
    return [
      ...BALL_SKINS.filter(b => !this.isUnlocked(b)).map(b => ({ kind: 'ball', item: b })),
      ...CUE_SKINS.filter(b => !this.isUnlocked(b)).map(b => ({ kind: 'cue', item: b })),
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
    for (let l = before + 1; l <= this.data.level; l++) {
      for (const t of THEMES) if (t.unlock.level === l) unlocks.push(`TABLE: ${t.name}`);
      for (const b of BALL_SKINS) if (b.unlock.level === l) unlocks.push(`BALLS: ${b.name}`);
      for (const c of CUE_SKINS) if (c.unlock.level === l) unlocks.push(`CUE: ${c.name}`);
      for (const s of STARTER_RELICS) if (s.level === l) { const r = RELICS.find(x => x.id === s.id); if (r) unlocks.push(`STARTER RELIC: ${r.name}`); }
    }
    this.save();
    return { from: before, to: this.data.level, unlocks };
  }
}
