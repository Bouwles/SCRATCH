// Run flow: floors of tables, shops, events and bosses; encounter lifecycle;
// rewards; the table-manipulation helpers encounters and relics call.

import { TABLE } from '../config.js';
import { ENCOUNTERS, BOSSES, CHAOS, makeEncounter, pickEncounterTypes, rackTriangle } from './encounters.js';
import { rollRelics, relicById, ITEMS, RARITY, MAX_RELICS } from './relics.js';
import { pickEvent } from './events.js';
import { themeById } from './cosmetics.js';
import { rand, withSeed, hashParts, today } from './rng.js';
import { rollMods, modCount, pickChallenge, pickStake, pickAnomaly, MODS, ANOMALIES, SECRET_ANOMALY, CHALLENGES, STAKES, anomalyChance, heatLevel, gradeRun, betterGrade, ROMAN, reactionWord } from './mastery.js';

const R = TABLE.R;
export const FLOOR_NAMES = ['THE BASEMENT', 'THE DEEP END', 'THE HOUSE', 'THE UNDERCROFT', 'THE STATIC', 'THE SUBBASEMENT', 'THE FLOOR BELOW THE FLOOR', 'NOWHERE', 'THE LAST TABLE'];
const FLOOR_JP = ['地下室', '深淵', '胴元', '地下聖堂', '砂嵐', '最下層', '床の下の床', '無', '最後の台'];
export const floorName = (n) => FLOOR_NAMES[n - 1] || `FLOOR ${n}`;
const floorJp = (n) => FLOOR_JP[n - 1] || '∞';
export const ALL_BOSSES = ['crooked', 'mimic', 'void', 'dealer', 'clock'];

// A floor is a short road with two forks in it. Everything is decided by the
// run's seed, so a restored autosave or today's Daily sees the same road.
function makeFloor(n, usedBosses) {
  let bossPool;
  if (n === 3) bossPool = ['house'];
  else if (n > 3) bossPool = (n % 3 === 0 ? ['house'] : [...ALL_BOSSES]).filter(b => b !== usedBosses[usedBosses.length - 1]);
  else bossPool = ALL_BOSSES.filter(b => !usedBosses.includes(b));
  const boss = bossPool[Math.floor(rand() * bossPool.length)] || 'crooked';
  return [
    { type: 'table' }, { type: 'table' },
    { type: 'fork', options: ['event', 'mystery'] },
    { type: 'shop' },
    { type: 'table' }, { type: 'elite' },
    { type: 'fork', options: ['shop', 'backroom'] },
    { type: 'table' },
    { type: 'boss', boss },
  ];
}

// runs are saved as plain data: relics and items by id
function serializeRun(run) {
  const o = {};
  for (const [k, v] of Object.entries(run)) {
    if (k === 'relics') o.relics = v.map(r => r.id);
    else if (k === 'items') o.items = v.map(i => i.id);
    else o[k] = v;
  }
  return JSON.parse(JSON.stringify(o));
}
function restoreRun(o) {
  const run = JSON.parse(JSON.stringify(o));
  run.relics = (o.relics || []).map(id => relicById(id)).filter(Boolean);
  run.items = (o.items || []).map(id => ITEMS.find(i => i.id === id)).filter(Boolean);
  if (!Array.isArray(run.nodes) || typeof run.floor !== 'number') throw new Error('bad run save');
  return run;
}

// A table in progress lives in the save as ids only (run.inTable), so closing
// the tab never hands out a free retry: the same rack comes back with only the
// shots that were left, a lost table stays lost and a won table pays once.
function tableFromSave(t) {
  const def = ENCOUNTERS[t.def] || BOSSES[t.def];
  if (!def) return null;
  const find = (list, id) => (id ? list.find(x => x.id === id) || null : null);
  return {
    def, kind: t.kind,
    opts: {
      mods: (t.mods || []).map(id => MODS.find(m => m.id === id)).filter(Boolean),
      anomaly: find([...ANOMALIES, SECRET_ANOMALY], t.anomaly),
      challenge: find(CHALLENGES, t.challenge),
      stake: find(STAKES, t.stake),
    },
  };
}

export const RunMixin = {
  // ---------------------------------------------------------- run
  // opts.mode: 'standard' | 'daily' | 'endless';  opts.breakLv: 0..5
  startRun(opts = {}) {
    const sel = this.meta.data.selected, d = this.meta.data;
    const mode = opts.mode || 'standard';
    const dailyDate = mode === 'daily' ? today() : null;
    const seed = mode === 'daily' ? hashParts('SCRATCH-DAILY', dailyDate) : (Math.random() * 4294967296) >>> 0;
    const rookie = mode === 'standard' && !(opts.breakLv > 0) && d.stats.wins === 0 && d.stats.runs < 3;
    const hearts = rookie ? 4 : 3;
    this.suspended = null;
    this.run = {
      floor: 1, node: -1, nodes: [], hearts, maxHearts: hearts, chips: 8, score: 0,
      relics: [], items: [], streak: 0, seenEvents: [], usedBosses: [], lastType: null,
      stats: { bestShot: 0, tables: 0, pots: 0, bosses: 0, scratches: 0, maxStreak: 0, mostBalls: 0, bestShotLabel: '' }, doubleTapCount: 0,
      style: 10, stylePeak: 0, basicRun: 0, heatPts: 0, heat: 0, heatMax: 0, time: 0,
      seed, mode, daily: dailyDate, endless: mode === 'endless', breakLv: mode === 'standard' ? (opts.breakLv || 0) : 0,
      rookie, relicLv: {}, attempts: {},
    };
    this.run.nodes = withSeed([seed, 1, 'floor'], () => makeFloor(1, []));
    if (mode === 'standard' && sel.starter) { const r = relicById(sel.starter); if (r) this.gainRelic(r, true); }
    d.stats.runs++;
    if (mode === 'daily') { this.dailyRecord(); d.daily.played = (d.daily.played || 0) + 1; }
    this.clearSavedRun(false);
    this.meta.save();
    this.floorTheme();
    this.ui.showHUD(true);
    this.ui.floorCard(1, floorName(1), floorJp(1), () => {
      // Daily Scratch opens with a seeded relic choice, the same for everyone today
      if (mode === 'daily') {
        const opts3 = withSeed([seed, 'starter'], () => rollRelics(3, [], { rarityBoost: 0.6 }));
        opts3.forEach(r => this.meta.seeRelic(r.id));
        this.ui.relicChoice(opts3, (r) => { const got = r ? this.gainRelic(r) : Promise.resolve(); got.then(() => this.ui.transition(() => this.advance())); }, { title: 'DAILY STARTER', skip: false });
      } else this.advance();
    });
  },

  dailyRecord() {
    const d = this.meta.data, t = today();
    if (!d.daily || d.daily.date !== t) d.daily = { date: t, best: 0, bestHeat: 0, completed: false, played: 0 };
    return d.daily;
  },

  floorTheme() {
    const sel = this.meta.data.selected, run = this.run;
    let theme;
    if (run?.themeId) theme = themeById(run.themeId);
    else if (sel.shuffle) { const pool = this.meta.unlockedThemes(); theme = pool[Math.floor(Math.random() * pool.length)]; }
    else theme = themeById(sel.theme);
    if (run) run.themeId = theme.id;
    this.applyCosmetics(theme);
  },

  // ---------------------------------------------------- autosave
  // The run is saved at every stop on the road (never mid-table), so closing the
  // browser and coming back puts you at the same stop with the same offers.
  saveRun() {
    const run = this.run;
    if (!run || this.runEnding) return;
    try { this.meta.data.savedRun = serializeRun(run); this.meta.save(); } catch (e) { /* storage full or unavailable */ }
  },
  clearSavedRun(save = true) {
    if (this.meta.data.savedRun) { delete this.meta.data.savedRun; if (save) this.meta.save(); }
  },
  hasSavedRun() { return !!this.meta.data.savedRun; },
  continueSavedRun() {
    let run;
    try { run = restoreRun(this.meta.data.savedRun); } catch (e) {
      this.clearSavedRun();
      this.toMenu();
      this.ui.toast('IT COULD NOT BE READ', '#ff3b5c', 'SAVED RUN LOST');
      return false;
    }
    this.suspended = null;
    this.run = run;
    this.enc = null;
    this.runEnding = false;
    this.floorTheme();
    this.ui.showHUD(true);
    if (run.hearts <= 0) { this.endRun(false); return true; }
    const t = run.inTable;
    const back = t && t.key === `${run.floor}:${run.node}` ? tableFromSave(t) : null;
    run.inTable = null;
    if (back && t.won) { run.inTable = t; this.state = 'reward'; this.collectWin(t.won); return true; }
    if (back && t.lost) {
      if (t.lost === 'pending') run.hearts--;            // the heart that table cost was never taken
      run.streak = 0;
      if (run.hearts <= 0) { this.endRun(false); return true; }
      this.ui.toast(`${run.hearts} HEART${run.hearts === 1 ? '' : 'S'} LEFT`, '#ff3b5c', 'THAT TABLE WAS LOST');
      if (back.def.boss) this.startEncounter(back.def, back.kind, { mods: back.opts.mods, anomaly: back.opts.anomaly });
      else this.advance();
      return true;
    }
    if (back) {
      this.startEncounter(back.def, back.kind, { ...back.opts, resume: t });
      this.ui.toast('THE RACK WAS RESET', '#ffc21c', 'SHOTS TAKEN STILL COUNT');
      return true;
    }
    run.node = Math.max(-1, run.node - 1);
    this.advance();
    return true;
  },

  advance() {
    const run = this.run;
    run.inTable = null;
    run.node++;
    if (run.node >= run.nodes.length) {
      // floor complete
      if (run.floor >= 3 && !run.endless) { this.endRun(true); return; }
      run.floor++;
      run.node = -1;
      run.themeId = null;
      run.nodes = withSeed([run.seed, run.floor, 'floor'], () => makeFloor(run.floor, run.usedBosses));
      this.heal(1);
      this.saveRun();
      this.ui.transition(() => {
        this.floorTheme();
        this.ui.floorCard(run.floor, floorName(run.floor), floorJp(run.floor), () => this.advance());
      });
      return;
    }
    this.saveRun();
    const node = run.nodes[run.node];
    this.presentNode(node);
  },

  presentNode(node) {
    const run = this.run;
    this.clearTableFx();
    const heat = run.heat || 0;
    const seedParts = [run.seed, run.floor, run.node, node.type];
    const card = (def, kind, extra = {}) => {
      const mods = extra.mods ?? rollMods(modCount(run.floor, run.node, heat, kind, run.breakLv), def);
      const enc = makeEncounter(def, run.floor, kind);
      this.decorateEncounter(enc, { mods, anomaly: extra.anomaly || null, stake: extra.stake || null });
      return { def, kind, mods, anomaly: extra.anomaly || null, stake: extra.stake || null, enc, heatElite: !!extra.heatElite };
    };
    const pick = (c) => this.maybeChallenge(c, () => this.startEncounter(c.def, c.kind, { mods: c.mods, anomaly: c.anomaly, challenge: c.challenge, stake: c.stake }));
    if (node.type === 'fork') {
      this.idleTable();
      this.ui.choosePath(node.options, (type) => { run.nodes[run.node] = { type, chosen: true }; this.saveRun(); this.presentNode({ type }); });
    } else if (node.type === 'table') {
      const choices = withSeed(seedParts, () => {
        if (run.floor === 1 && run.node === 0 && !run.firstTableDone) return [card(ENCOUNTERS.standard, 'table', { mods: [] })];
        const types = pickEncounterTypes(run.floor, 2, run.lastType ? [run.lastType] : []);
        const out = types.map(def => card(def, 'table'));
        // HIGH STAKES: a hard rule you must not break, for a much better reward
        const stakesOk = run.floor > 1 || run.node >= 3;
        if (stakesOk && rand() < 0.55 + (run.breakLv >= 2 ? 0.3 : 0)) {
          const st = pickStake(types[1]);
          if (st) out[1] = card(types[1], 'stakes', { stake: st, mods: rollMods(run.floor >= 2 ? 1 : 0, types[1]).filter(m => m.tag !== 'pockets') });
        }
        // HEAT II+: the club starts offering elite tables to players who can take it
        if (heat >= 2) out.push(card(pickEncounterTypes(run.floor, 1, ['blitz'])[0], 'elite', { heatElite: true }));
        // rarely: something is very wrong with one of the tables
        if (rand() < anomalyChance(run.floor, run.node, heat)) {
          const an = pickAnomaly();
          const base = [ENCOUNTERS.standard, ENCOUNTERS.golden, ENCOUNTERS.combo][Math.floor(rand() * 3)];
          out[0] = card(base, 'table', { mods: [], anomaly: an });
        }
        return out;
      });
      this.idleTable();
      this.ui.chooseTable(choices, pick);
    } else if (node.type === 'elite') {
      const choices = withSeed(seedParts, () => {
        const out = pickEncounterTypes(run.floor, 2, ['blitz']).map(def => card(def, 'elite'));
        if (rand() < 0.35) out[1] = card(ENCOUNTERS.classic, 'elite', { mods: rollMods(heat >= 3 ? 1 : 0, ENCOUNTERS.classic) });
        return out;
      });
      this.idleTable();
      this.ui.chooseTable(choices, pick);
    } else if (node.type === 'boss') {
      const def = BOSSES[node.boss];
      if (!run.usedBosses.includes(node.boss)) run.usedBosses.push(node.boss);
      this.startEncounter(def, 'boss');
    } else if (node.type === 'shop') {
      this.openShop();
    } else if (node.type === 'event') {
      this.openEvent();
    } else if (node.type === 'mystery') {
      this.openMystery();
    } else if (node.type === 'backroom') {
      this.openBackRoom();
    }
  },

  // MYSTERY: you don't know what's behind the door until you open it
  openMystery() {
    const run = this.run;
    this.idleTable();
    const r = withSeed([run.seed, run.floor, run.node, 'mystery'], () => rand());
    const kind = r < 0.42 ? 'event' : r < 0.68 ? 'treasure' : r < 0.88 ? 'ambush' : 'bargain';
    this.ui.mysteryReveal(kind, () => {
      if (kind === 'event') this.openEvent();
      else if (kind === 'treasure') this.offerRelics('treasure', 1.2);
      else if (kind === 'ambush') {
        const an = withSeed([run.seed, run.floor, run.node, 'ambush'], () => pickAnomaly());
        this.startEncounter(ENCOUNTERS.standard, 'table', { mods: [], anomaly: an });
      } else {
        const c = withSeed([run.seed, run.floor, run.node, 'bargain'], () => rollRelics(1, run.relics, { forceRarity: 'cursed' })[0]);
        this.ui.bargain(c, (take) => {
          if (take && c) { this.gainRelic(c).then(() => { this.addChips(25); this.ui.transition(() => this.advance()); }); }
          else this.ui.transition(() => this.advance());
        });
      }
    });
  },

  // BACK ROOM: rest, or have a relic tuned up
  openBackRoom() {
    this.idleTable();
    this.state = 'event';
    this.camMode = 'shop';
    this.audio.playMusic('shop');
    this.ui.backRoom({
      canRest: this.run.hearts < this.run.maxHearts,
      upgradeable: this.run.relics.filter(r => r.up && !this.relicUpgraded(r.id)),
    }, (choice, relic) => {
      if (choice === 'rest') { this.heal(2); this.audio.levelUp(); }
      else if (choice === 'tune' && relic) this.upgradeRelic(relic);
      else if (choice === 'chips') this.addChips(12);
      this.ui.transition(() => this.advance());
    });
  },

  clearTableFx() {
    this.tiltVec = { x: 0, z: 0 };
    this.table.tilt.tx = 0; this.table.tilt.tz = 0;
    this.blackout = false;
    this.blackHole = null;
    this.chaosRule = null;
    this.chaosWind = null;
    this.armed = {};
    this.ghostArmed = false;
    this.lights.clear(9);
    this.renderer.grade.desat = 0;
    if (this.theme) this.tintLights(null);
  },

  // a decorative table state for menus / shops
  idleTable() {
    if (this.physics.balls.length > 3) return;
    this.physics.clearBalls();
    this.physics.obstacles = [];
    this.ballView.syncObstacles();
    this.physics.addBall(0, TABLE.headX, 0.05);
    rackTriangle(this, 15);
    this.enc = null;
    this.applyRules();
  },

  setupMenuTable() {
    this.physics.clearBalls();
    this.physics.obstacles = [];
    this.ballView.syncObstacles();
    this.physics.addBall(0, -0.55, 0.1);
    const nums = [1, 9, 3, 8, 11, 6, 14, 2, 5];
    nums.forEach((n, i) => {
      const a = i * 2.4, r = 0.15 + i * 0.05;
      const p = this.physics.findFreeSpot(0.2 + Math.cos(a) * r, Math.sin(a) * r * 0.7);
      this.physics.addBall(n, p.x, p.z);
    });
    this.enc = null;
    this.clearTableFx();
    this.applyRules();
  },

  // ---------------------------------------------------- encounters
  // modifiers / anomaly shape the purse and shot budget (also used for card previews)
  decorateEncounter(e, { mods = [], anomaly = null, challenge = null, stake = null } = {}) {
    const run = this.run;
    e.mods = mods; e.anomaly = anomaly; e.challenge = challenge; e.stake = stake;
    for (const m of mods) if (m.shots) e.shots += m.shots;
    const diff = mods.reduce((s, m) => s + m.diff, 0);
    // BREAK 1+: tables ask for one more ball
    if (run?.breakLv >= 1 && !e.def.boss && !['combo', 'trick', 'assassin', 'classic'].includes(e.def.id)) e.goal += 1;
    // endless: every floor below the House digs deeper
    const deep = Math.max(0, (run?.floor || 1) - 3);
    if (deep && !['combo', 'trick', 'assassin', 'classic'].includes(e.def.id)) e.goal += Math.min(3, Math.ceil(deep / 2));
    e.reward = Math.max(2, e.reward + diff * 2);
    if (anomaly) e.reward *= 2;
    if (stake) { e.reward = Math.round(e.reward * 1.5) + 3; stake.setup?.(this, e); }
    e.reward = Math.round(e.reward * (1 + 0.1 * (run?.heat || 0)) * (1 + 0.2 * deep));
    return e;
  },

  // Double-or-nothing: an optional bet offered before some tables
  maybeChallenge(c, go) {
    const run = this.run;
    const heat = run.heat || 0;
    const first = run.floor === 1 && run.node === 0 && !run.firstTableDone;
    const odds = this.hasRelic('loaded_dice') ? 1 : 0.25 + heat * 0.1 + (run.breakLv >= 2 ? 0.15 : 0);
    const roll = withSeed([run.seed, run.floor, run.node, 'bet', c.def.id], () => rand());
    if (first || c.anomaly || c.stake || roll > odds) { go(); return; }
    const ch = withSeed([run.seed, run.floor, run.node, 'betpick'], () => pickChallenge(c.def, heat));
    if (!ch) { go(); return; }
    const preview = { ...c.enc };
    ch.setup?.(this, preview);
    this.ui.challengeOffer(ch, preview, (accept) => {
      if (accept) { c.challenge = ch; c.chN = preview.chN; }
      go();
    });
  },

  startEncounter(def, kind, opts = {}) {
    const run = this.run;
    this.clearTableFx();
    this.physics.clearBalls();
    this.physics.obstacles = [];
    this.fx.clearTrails();
    this.ballView.prune();
    const e = this.enc = makeEncounter(def, run.floor, kind);
    this.decorateEncounter(e, opts);
    e.opts = opts;
    const key = `${run.floor}:${run.node}`;
    const resume = opts.resume || null;
    const att = resume ? (run.attempts[key] || 1) : (run.attempts[key] = (run.attempts[key] || 0) + 1);
    this.meta.markSeen?.(def.boss ? 'bosses' : null, def.id);
    if (e.anomaly) this.meta.markSeen?.('anomalies', e.anomaly.id);
    for (const r of run.relics) if (r.extraShots) e.shots += r.extraShots;
    if (run.nextShotBonus) { e.shots += run.nextShotBonus; run.nextShotBonus = 0; }
    e.shots = Math.max(2, e.shots);
    e.shotsMax = e.shots;
    // event aftermath: the lights, the rival
    if (run.nextDark && !def.boss) { run.nextDark = false; e.mods = [...e.mods, MODS.find(m => m.id === 'dark')]; }
    if (run.nextHarder && !def.boss) { run.nextHarder = false; e.goal += 1; e.reward += 8; e.rival = true; }
    if (resume?.rival && !e.rival) { e.goal += 1; e.reward += 8; e.rival = true; }
    e.bossPlus = def.boss && ((run.heat || 0) >= 4 || run.breakLv >= 4 || run.floor > 3);
    e.inferno = !def.boss && (run.heat || 0) >= 5;
    e.phase = 1;
    run.style = Math.round(run.style * 0.7);            // style cools between tables
    // the table itself (rack, rule set-ups) is part of the run's seed
    withSeed([run.seed, run.floor, run.node, def.id, att], () => {
      this.physics.addBall(0, TABLE.headX, (rand() - 0.5) * 0.1);
      def.setup(this, e);
      if (e.challenge?.setup) e.challenge.setup(this, e);
      for (const m of e.mods) m.setup?.(this, e);
      e.anomaly?.setup?.(this, e);
    });
    if (resume) {
      e.shotsMax = resume.max || e.shotsMax;
      e.shots = Math.max(1, resume.left ?? e.shots);
      if (resume.timer != null && e.timer != null) e.timer = Math.min(e.timer, Math.max(5, resume.timer));
      if (resume.chBroken) e.chBroken = resume.chBroken;
    }
    run.inTable = resume || {
      key, def: def.id, kind, mods: e.mods.map(m => m.id), anomaly: e.anomaly?.id || null,
      challenge: e.challenge?.id || null, stake: e.stake?.id || null, rival: !!e.rival, max: e.shotsMax, left: e.shots,
    };
    this.saveRun();
    if (e.inferno) this.rollChaos();
    this.relicHook('encounterStart');
    // drop the rack in from above
    this.physics.balls.forEach((b, i) => { if (b.kind !== 'cue' && b.y === 0) { b.y = 0.12 + i * 0.012; b.vy = 0; } });
    this.ballView.syncObstacles();
    this.ballView.prune();
    this.applyRules();
    run.lastType = def.id;
    this.state = 'intro';
    this.cue.visible = false;
    this.aim.hide();
    const go = () => {
      this.ui.showHUD(true);
      this.audio.flavor = (run.floor - 1) % 3;              // each floor's tables sound different
      this.audio.playMusic(def.boss ? 'boss' : 'table');
      this.beginAim();
      this.ui.startTutorialIfNeeded();
    };
    if (def.boss) {
      this.tintLights(def.color, 0.32);
      this.camMode = 'boss';
      this.bossCamT = 0;
      this.audio.playMusic('none');
      this.audio.bossStinger();
      this.lights.lampMul = 0;
      this.ui.bossIntro(def, go);
    } else {
      this.camMode = 'result';
      this.ui.encounterIntro(e, go);
    }
  },

  winEncounter() {
    const e = this.enc, run = this.run;
    e.done = true;
    this.state = 'result';
    this.camMode = 'result';
    this.cue.visible = false;
    this.aim.hide();
    run.stats.tables++;
    this.meta.data.stats.tables++;
    run.firstTableDone = true;
    if (e.misses === 0 && e.shotsTaken > 0) this.achieve('perfect');
    if (e.def.id === 'blitz' && e.timer >= 30) this.achieve('speed_demon');
    if (e.def.boss) {
      run.stats.bosses++;
      this.meta.data.stats.bosses++;
      this.achieve('boss_slayer');
    }
    this.meta.save();
    this.audio.win();
    this.audio.crowd(0.9);
    this.room.cheerNow(1.5);
    this.screenFlash(0xffffff, 0.3);
    for (let i = 0; i < 6; i++) this.after(i * 0.12, () => {
      const x = (Math.random() - 0.5) * 1.6, z = (Math.random() - 0.5) * 0.8;
      this.fx.burst(x, 0.3, z, [0xff2bd6, 0x2bf0ff, 0xffe23b, 0x34e070], 30, 1.6, { up: 2, life: 1.4, grav: 2.5 });
    });
    this.ui.popup(e.def.boss ? 'BOSS DEFEATED!' : 'TABLE CLEARED!', { color: e.def.boss ? '#ffc21c' : '#34e070', scale: 2.0 });
    if (e.def.boss) {
      this.freeze(0.18);
      this.audio.bigHit(3);
      this.shake(0.8);
      this.tintLights(null);
      this.lights.flash(this.worldPos(0, 0, 0.6), 0xffe6a0, 3, 3.5, 1.2);
    }
    e.anomaly?.cleanup?.(this);
    if (e.challenge?.win) this.challengeCheck(e.challenge.win(this, e));
    // heat from clean play
    if (e.misses === 0 && e.shotsTaken > 0) this.addHeat(e.def.boss ? 7 : 4);
    else if (e.def.boss) this.addHeat(3);
    if (e.anomaly) this.addHeat(3);
    if (e.stake) { this.addHeat(4); this.achieve('all_in'); }
    if (e.def.boss && e.misses === 0) this.achieve('untouchable');
    if (e.def.boss) { const b = this.meta.data.bosses = this.meta.data.bosses || {}; b[e.def.id] = (b[e.def.id] || 0) + 1; }
    // rewards
    const lines = [];
    const betLost = e.challenge && e.chBroken;
    const betWon = e.challenge && !e.chBroken;
    if (betLost) lines.push(['BET LOST — NO PURSE', 0]);
    else lines.push([e.def.boss ? 'BOSS BOUNTY' : e.stake ? 'HIGH STAKES PURSE' : e.anomaly ? 'ANOMALY PURSE' : e.kind === 'elite' ? 'ELITE PURSE' : 'TABLE PURSE', e.reward]);
    if (betWon) { lines.push([this.hasRelic('loaded_dice') ? 'LOADED DICE x3' : 'DOUBLE OR NOTHING', e.reward * (this.hasRelic('loaded_dice') ? 2 : 1)]); this.addHeat(5); }
    if (betLost && this.hasRelic('loaded_dice')) lines.push(['LOADED DICE', -5]);
    const left = e.def.id === 'blitz' ? Math.min(3, Math.floor(e.timer / 15)) : Math.min(3, Math.floor(e.shots / 2));
    if (left > 0) lines.push([e.def.id === 'blitz' ? 'TIME LEFT' : 'SHOTS LEFT', left]);
    if (e.misses === 0) lines.push(['PERFECT', 2]);
    if (run.allIn) { lines.push(['ALL IN — DOUBLED', run.allIn * 2]); run.allIn = 0; }
    const interest = Math.min(2, Math.floor(run.chips / 15));
    if (interest) lines.push(['INTEREST', interest]);
    const total = lines.reduce((s, l) => s + l[1], 0);
    const extra = (run.nextBoost || 0) + (e.rival ? 2 : 0);
    run.nextBoost = 0;
    const pay = { total, kind: e.kind, boss: !!e.def.boss, bonus: (betWon ? 1.5 : 0) + (e.anomaly ? 2 : 0) + (e.stake ? 2.5 : 0) + extra };
    if (run.inTable) run.inTable.won = pay;
    this.saveRun();
    this.after(1.3, () => {
      this.ui.encounterResult({ won: true, lines, total, score: e.score || 0 }, () => this.collectWin(pay));
    });
  },

  // the purse, the boss heal and the relic offer, each exactly once (also after a reload)
  collectWin(pay) {
    const run = this.run;
    if (!pay.paid) { pay.paid = true; this.addChips(pay.total); if (pay.boss) this.heal(1); this.saveRun(); }
    if (pay.boss && run.floor === 3 && !run.endless) { this.endRun(true); return; }
    if (pay.boss && run.floor === 3 && run.endless && !run.houseFell) {
      run.houseFell = true;
      this.ui.toast('THE STAIRS KEEP GOING DOWN', '#ff3b5c', 'THE HOUSE HAS FALLEN');
      this.saveRun();
    }
    this.offerRelics(pay.kind, pay.bonus);
  },

  failEncounter(reason) {
    const e = this.enc;
    if (e.done) return;
    e.done = true;
    this.state = 'result';
    this.camMode = 'result';
    this.cue.visible = false;
    this.aim.hide();
    this.audio.fail();
    this.audio.groan();
    this.ui.popup(reason, { color: '#ff3040', scale: 1.8 });
    this.coolHeat(0.6);
    e.anomaly?.cleanup?.(this);
    if (e.challenge && !e.chBroken) e.chBroken = 'TABLE LOST';
    if (this.run.allIn) { this.ui.toast(`${this.run.allIn} CHIPS GONE`, '#ff3b5c', 'ALL IN — LOST'); this.run.allIn = 0; }
    const t = this.run.inTable;
    if (t) { t.lost = 'pending'; this.saveRun(); }
    this.after(1.4, () => {
      this.loseHeart(reason, true);
      if (t) { t.lost = 'taken'; this.saveRun(); }
      if (this.run.hearts <= 0) { this.endRun(false); return; }
      const retry = !!e.def.boss;   // bosses must be beaten; other tables are simply lost
      this.ui.encounterResult({ won: false, reason, hearts: this.run.hearts, retry }, () => {
        this.run.streak = 0;
        if (retry) this.startEncounter(e.def, e.kind, { mods: e.mods, anomaly: e.anomaly });
        else this.ui.transition(() => this.advance());
      });
    });
  },

  offerRelics(kind, bonus = 0) {
    const run = this.run;
    const hb = (run.heat || 0) * 0.3 + bonus;
    const boost = kind === 'boss' ? 2.5 + hb : kind === 'elite' ? 1.2 + hb : run.floor * 0.15 + hb;
    const opts = withSeed([run.seed, run.floor, run.node, 'relics', kind], () => rollRelics(3, run.relics, { rarityBoost: boost, upgraded: run.relicLv, cursedX: this.hasRelic('black_label') ? 2 : 1 }));
    opts.forEach(r => this.meta.seeRelic(r.id));
    this.ui.relicChoice(opts, (r) => {
      const got = r ? this.gainRelic(r) : (this.addChips(3), Promise.resolve());
      got.then(() => this.ui.transition(() => this.advance()));
    });
  },

  // Returns a promise: when the slots are full the player picks a relic to discard first.
  gainRelic(r, silent = false) {
    const run = this.run;
    if (r.up && run.relics.some(x => x.id === r.id)) {
      if (!this.relicUpgraded(r.id)) this.upgradeRelic(r);
      else this.addChips(8);
      return Promise.resolve(true);
    }
    const add = () => {
      run.relics.push(r);
      this.meta.seeRelic(r.id);
      if (!silent) { this.audio.relicGet(r.rarity); this.ui.toast(`${r.name}`, RARITY[r.rarity].color, 'RELIC ACQUIRED'); if (r.rarity === 'legendary') { this.screenFlash(0xffc21c, 0.3); this.shake(0.25); } }
      this.ui.showTip?.('relics');
      if (run.relics.length >= MAX_RELICS) this.achieve('collector');
      if (run.relics.filter(x => x.rarity === 'cursed').length >= 3) this.achieve('cursed');
      this.ui.updateHUD(true);
    };
    if (run.relics.length < MAX_RELICS) { add(); return Promise.resolve(true); }
    return new Promise(res => this.ui.discardRelic(run.relics, r, (victim) => {
      if (victim === r) { this.ui.toast(`${r.name}`, '#8a86a8', 'LEFT BEHIND'); res(false); return; }
      this.loseRelic(victim);
      this.ui.toast(`${victim.name}`, '#8a86a8', 'DISCARDED');
      add();
      res(true);
    }));
  },

  relicUpgraded(id) { return (this.run?.relicLv?.[id] || 1) >= 2; },
  upgradeRelic(r) {
    const run = this.run;
    run.relicLv = run.relicLv || {};
    run.relicLv[r.id] = 2;
    this.audio.relicGet('upgrade');
    this.ui.toast(`${r.name}+`, '#ffe23b', 'RELIC UPGRADED');
    this.screenFlash(0xffe23b, 0.2);
    this.achieve('upgraded');
    this.ui.updateHUD(true);
  },

  loseRelic(r) {
    const i = this.run.relics.indexOf(r);
    if (i >= 0) this.run.relics.splice(i, 1);
    this.ui.updateHUD(true);
  },

  addChips(n) {
    this.run.chips = Math.max(0, this.run.chips + n);
    if (n > 0) this.audio.coin(Math.min(8, Math.ceil(n / 2)));
    if (this.run.chips >= 60) this.achieve('high_roller');
    this.ui.updateHUD(true);
  },

  heal(n) {
    this.run.hearts = Math.min(this.run.maxHearts, this.run.hearts + n);
    this.ui.updateHUD(true);
  },

  loseHeart(reason, silentEnd = false) {
    this.run.hearts--;
    this.audio.heartbeat();
    this.screenFlash(0xff0020, 0.4);
    this.shake(0.5);
    this.ui.heartLost();
    this.ui.updateHUD(true);
    if (!silentEnd && this.run.hearts <= 0) this.after(1.0, () => this.endRun(false));
  },

  // --------------------------------------------------------- shop/event
  openShop() {
    const run = this.run;
    this.state = 'shop';
    this.camMode = 'shop';
    this.idleTable();
    this.audio.playMusic('shop');
    const stock = this.rollShop();
    this.ui.shop(stock, {
      buy: (item) => {
        if (run.chips < item.price) { this.audio.ui('deny'); return false; }
        if (item.type === 'item' && run.items.length >= 3) { this.audio.ui('deny'); this.ui.toast('ITEM SLOTS FULL', '#ff3040'); return false; }
        if (item.type === 'heal' && run.hearts >= run.maxHearts) { this.audio.ui('deny'); return false; }
        run.chips -= item.price;
        this.audio.ui('buy');
        if (item.type === 'relic' || item.type === 'bargain') this.gainRelic(item.relic);
        else if (item.type === 'mystery') {
          const r = rollRelics(1, run.relics, { rarityBoost: 0.8, upgraded: run.relicLv, cursedX: 1.6 })[0];
          if (r) { this.meta.seeRelic(r.id); this.gainRelic(r); item.revealed = r; }
        } else if (item.type === 'upgrade') this.upgradeRelic(item.relic);
        else if (item.type === 'item') run.items.push(item.item);
        else if (item.type === 'heal') this.heal(1);
        else if (item.type === 'maxheart') { run.maxHearts++; this.heal(1); this.ui.toast('+1 MAX HEART', '#ff3b5c', 'VITALITY'); }
        else if (item.type === 'cosmetic') {
          this.meta.buyCosmetic(item.cos.item);
          this.ui.toast(`${item.cos.item.name} UNLOCKED`, '#ffc21c', item.cos.kind === 'ball' ? 'BALL SET' : 'CUE');
        }
        this.ui.updateHUD(true);
        return true;
      },
      reroll: () => {
        const cost = 3 + (run.rerolls || 0) * 2;
        if (run.chips < cost) { this.audio.ui('deny'); return null; }
        run.chips -= cost;
        run.rerolls = (run.rerolls || 0) + 1;
        this.audio.ui('select');
        this.ui.updateHUD(true);
        return this.rollShop();
      },
      rerollCost: () => 3 + (run.rerolls || 0) * 2,
      sellPrice: (r) => r.rarity === 'cursed' ? 1 : Math.max(2, Math.round(RARITY[r.rarity].price * 0.5)),
      sell: (r) => {
        const price = r.rarity === 'cursed' ? 1 : Math.max(2, Math.round(RARITY[r.rarity].price * 0.5));
        this.loseRelic(r);
        this.addChips(price);
        this.ui.toast(`${r.name}  +${price}`, '#8a86a8', 'SOLD');
        return true;
      },
      leave: () => { this.ui.transition(() => this.advance()); },
    });
  },

  rollShop() {
    const run = this.run;
    return withSeed([run.seed, run.floor, run.node, 'shop', run.rerolls || 0], () => {
      const fl = Math.min(run.floor, 5);
      const hk = (1 + 0.1 * (run.heat || 0)) * (run.breakLv >= 3 ? 1.25 : 1);
      const price = (base) => Math.round(base * hk);
      const relics = rollRelics(2, run.relics, { rarityBoost: 0.3 + fl * 0.2, cursedX: this.hasRelic('black_label') ? 2 : 1, noCursed: true });
      const stock = relics.map(r => ({ type: 'relic', relic: r, price: price(RARITY[r.rarity].price + (fl - 1) * 2 + Math.floor(rand() * 3)) }));
      // a gamble: could be anything, including something you'll regret
      stock.push({ type: 'mystery', price: price(8 + fl * 2) });
      // now and then the shopkeeper will tune up something you already own
      const upg = run.relics.filter(r => r.up && !this.relicUpgraded(r.id));
      if (upg.length && rand() < 0.6) { const r = upg[Math.floor(rand() * upg.length)]; stock.push({ type: 'upgrade', relic: r, price: price(15 + fl * 3) }); }
      // a cursed relic, and he pays YOU to take it
      if (rand() < 0.45) { const c = rollRelics(1, run.relics, { forceRarity: 'cursed' })[0]; if (c && c.rarity === 'cursed') stock.push({ type: 'bargain', relic: c, price: -12 - fl * 2 }); }
      const items = [...ITEMS].sort(() => rand() - 0.5).slice(0, 2);
      items.forEach(it => stock.push({ type: 'item', item: it, price: it.price }));
      stock.push({ type: 'heal', price: 7 + fl * 2 });
      if (run.maxHearts < 5) stock.push({ type: 'maxheart', price: 22 + run.maxHearts * 6 });
      const locked = this.meta.lockedCosmetics().filter(c => !c.item.unlock.ach);
      if (locked.length && rand() < 0.5) {
        const c = locked[Math.floor(rand() * locked.length)];
        stock.push({ type: 'cosmetic', cos: c, price: 20 });
      }
      return stock;
    });
  },

  openEvent() {
    const run = this.run;
    this.state = 'event';
    this.camMode = 'shop';
    this.idleTable();
    this.audio.playMusic('shop');
    const key = `${run.floor}:${run.node}`;
    if (run.eventDone === key) { this.advance(); return; }    // already answered before a reload
    const ev = withSeed([run.seed, run.floor, run.node, 'event'], () => pickEvent(run.seenEvents, run));
    run.seenEvents.push(ev.id);
    this.ui.event(ev, (choice) => {
      // the dice are part of the run's seed, and the answer is saved at once
      const txt = withSeed([run.seed, run.floor, run.node, 'event-act', ev.id, choice.label], () => choice.act(this));
      run.eventDone = key;
      this.saveRun();
      this.ui.updateHUD(true);
      return txt;
    }, () => {
      if (run.hearts <= 0) { this.endRun(false); return; }
      this.ui.transition(() => this.advance());
    });
  },

  // ------------------------------------------------------------ end
  endRun(won) {
    if (this.runEnding) return;
    this.runEnding = true;
    const run = this.run;
    this.state = 'runend';
    this.camMode = 'result';
    this.cue.visible = false;
    this.aim.hide();
    this.audio.playMusic(won ? 'menu' : 'none');
    this.clearSavedRun(false);
    const d = this.meta.data;
    if (won) {
      this.achieve('champion'); d.stats.wins++; this.audio.win(); this.audio.crowd(1);
      d.unlocks = d.unlocks || {};
      d.unlocks.endless = true;
      // BREAK levels: beat your current level to open the next one
      if (run.mode === 'standard') {
        d.breakMax = Math.max(d.breakMax || 0, Math.min(5, (run.breakLv || 0) + 1));
        d.breakBest = Math.max(d.breakBest ?? -1, run.breakLv || 0);
        if ((run.breakLv || 0) >= 1) this.achieve('breaker');
      }
    }
    if (run.mode === 'daily') {
      const dr = this.dailyRecord();
      if (dr.date === run.daily) {
        dr.best = Math.max(dr.best || 0, run.score);
        dr.bestHeat = Math.max(dr.bestHeat || 0, run.heatMax || 0);
        if (won) { dr.completed = true; this.achieve('daily'); }
      }
    }
    if (run.endless) {
      const E = d.endless = d.endless || { deepest: 0, best: 0, heat: 0 };
      E.deepest = Math.max(E.deepest, run.floor);
      E.best = Math.max(E.best, run.score);
      E.heat = Math.max(E.heat, run.heatMax || 0);
      if (run.floor >= 5) this.achieve('deep');
    }
    const st = d.stats;
    st.bestScore = Math.max(st.bestScore, run.score);
    st.bestShot = Math.max(st.bestShot, run.stats.bestShot);
    const floorsDone = Math.min(run.floor, 6) - 1 + (won ? 1 : 0);
    const xp = Math.round(run.score / 40 + run.stats.tables * 25 + floorsDone * 120 + run.stats.bosses * 80 + (won ? 600 : 0) + (run.heatMax || 0) * 60);
    const lvl = this.meta.addXP(xp);
    // grade + personal bests
    const { grade } = gradeRun(run, won);
    const B = this.meta.data.bests, nb = {};
    const best = (k, v, better = (a, b) => a > b) => { if (better(v, B[k] || 0)) { B[k] = v; nb[k] = true; } };
    best('highScore', run.score);
    if (won && run.mode === 'standard') best('fastestWin', Math.round(run.time), (a, b) => !b || a < b);
    best('highestHeat', run.heatMax || 0);
    best('largestCombo', run.stats.maxStreak || 0);
    best('mostBalls', run.stats.mostBalls || 0);
    if (betterGrade(grade, B.bestGrade)) { B.bestGrade = grade; nb.bestGrade = true; }
    this.meta.save();
    this.ui.showHUD(false);
    this.ui.runEnd({ won, run, xp, lvl, grade, newBests: nb }, () => {
      this.runEnding = false;
      this.run = null;
      this.enc = null;
      this.toMenu();
    });
  },

  toMenu() {
    this.state = 'menu';
    this.camMode = 'menu';
    this.run = null;
    this.enc = null;
    this.ui.showHUD(false);
    this.applyCosmetics();
    this.setupMenuTable();
    this.audio.playMusic('menu');
    this.ui.showMainMenu();
  },

  // ------------------------------------------------------------ rules
  applyRules() {
    const P = this.physics.params;
    this.physics.resetParams();
    const pk = this.physics.pockets;
    const before = pk.map(p => p.open);
    for (const p of pk) { p.open = true; p.scale = 1; p.pull = 0; p.gravity = 0; p.spit = false; p.devour = false; p.bonus = false; p.mark = null; }
    const e = this.enc;
    let laser = false;
    if (e) {
      const def = e.def;
      def.pockets?.(this, pk, e);
      def.mods?.(this, P, e);
      for (const m of e.mods || []) { m.mods?.(this, P, e); m.pockets?.(this, pk, e); }
      e.anomaly?.mods?.(this, P, e);
      e.stake?.mods?.(this, P, e);
      if (e.fever) pk.forEach((p, i) => { p.scale *= e.fever[i]; });
      if (e.storm) P.muRoll *= e.storm;
      if (e.mimic) pk.forEach((p, i) => { p.open = e.mimic.open.includes(i); p.spit = i === e.mimic.spit; });
      if (e.voidPocket != null) { const p = pk[e.voidPocket]; p.gravity = e.phase >= 2 ? 3.1 : 2.4; p.devour = true; p.scale = 1.35; }
      if (e.dealer) { pk[e.dealer.hi].mark = 'hi'; for (const i of e.dealer.bad) pk[i].mark = 'bad'; }
      if (e.voidPocket2 != null && e.voidPocket2 !== e.voidPocket) { const p = pk[e.voidPocket2]; p.gravity = 1.3; p.devour = true; }
      if (e.closed) for (const i of e.closed) pk[i].open = false;
      if (def.laser) laser = true;
    }
    if (this.chaosRule) { this.chaosRule.mods?.(this, P); this.chaosRule.pockets?.(this, pk); }
    let homing = false, orbit = false;
    for (const r of this.run?.relics || []) {
      r.mods?.(this, P);
      r.pockets?.(this, pk);
      if (r.laser) laser = true;
      if (r.homing) homing = true;
      if (r.orbit) orbit = true;
    }
    if (this.armed?.big || this.shot?.bigPockets) for (const p of pk) p.scale *= 2.3;
    if (this.blackHole && pk[this.blackHole.i].open) {
      pk[this.blackHole.i].scale = Math.max(pk[this.blackHole.i].scale, 2.8);
      if (this.blackHole.pull) pk[this.blackHole.i].pull += 2.5;
    }
    P.tiltX = this.tiltVec.x; P.tiltZ = this.tiltVec.z;
    this.physics.forces = [homing && this.homingForce, orbit && this.orbitForce].filter(Boolean);
    if (pk.some((p, i) => p.open !== before[i])) this.physics.buildSegments();
    this.table.syncPockets();
    this.aim.extend = this.armed?.guide ? 4 : laser ? (this.relicUpgraded('laser_sight') ? 3 : 2.2) : 1;
  },

  homingForce: null,

  // ----------------------------------------------------- table helpers
  addBall(num, x, z, kind = 'object') {
    const b = this.physics.addBall(num, x, z);
    if (kind !== 'object') b.kind = kind;
    return b;
  },

  spawnDropBall(num, kind = 'object', x = null, z = null) {
    const p = x != null ? this.physics.findFreeSpot(x, z) : this.physics.randomFreeSpot(0.1);
    const b = this.addBall(num, p.x, p.z, kind);
    b.y = 0.45; b.vy = 0;
    this.fx.burst(p.x, 0.01, p.z, 0xffffff, 8, 0.4, { life: 0.4 });
    this.audio.whoosh(0.4);
    this.ballView.prune();
    return b;
  },

  spawnGolden() {
    if (this.physics.balls.some(b => b.kind === 'golden' && b.state === 'table')) return;
    const b = this.spawnDropBall(99, 'golden');
    this.ui.worldPop('GOLDEN BALL!', this.worldPos(b.x, b.z, 0.15), '#ffd040', 1.2);
    this.audio.coin(3);
    this.lights.flash(this.worldPos(b.x, b.z, 0.3), 0xffd040, 1.5, 3, 0.8);
  },

  removeGolden() {
    for (const b of this.physics.balls) if (b.kind === 'golden' && b.state === 'table') {
      b.state = 'pocketed';
      this.fx.burst(b.x, 0.03, b.z, [0xffd040, 0xffffff], 24, 0.9);
      this.ui.worldPop('GONE...', this.worldPos(b.x, b.z, 0.1), '#ffd040');
    }
  },

  addBumpers(n) {
    for (let i = 0; i < n; i++) {
      const p = this.physics.randomFreeSpot(0.2);
      this.physics.obstacles.push({ x: p.x, z: p.z, r: 0.045, rest: 1.0, kick: 0.5, kind: 'bumper' });
    }
    this.ballView.syncObstacles();
  },

  addPillar(quiet = false) {
    let p = null;
    for (let t = 0; t < 80; t++) {
      const q = this.physics.randomFreeSpot(0.15);
      if (Math.abs(q.x - TABLE.headX) > 0.12 || Math.abs(q.z) > 0.12) { p = q; break; }
    }
    if (!p) return;
    this.physics.obstacles.push({ x: p.x, z: p.z, r: 0.04, rest: 0.55, kind: 'pillar' });
    this.ballView.syncObstacles();
    if (!quiet) {
      this.audio.tone(60, { type: 'sine', dur: 0.4, vol: 0.5, slide: 30 });
      this.audio.noise({ dur: 0.3, vol: 0.3, type: 'lowpass', freq: 400 });
      this.fx.burst(p.x, 0.02, p.z, [0x808090, 0x404048], 26, 0.8);
      this.shake(0.3);
      this.ui.worldPop('PILLAR!', this.worldPos(p.x, p.z, 0.12), '#a8b0c0');
    }
  },

  markAssassin(retarget = false) {
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind === 'object');
    for (const b of objs) { if (b.tags.target) { b.tags.target = false; this.ballView.setTag(b, null); } }
    const free = objs.filter(b => !b.tags.forbidden);
    if (!free.length) return;
    const t = free[Math.floor(Math.random() * free.length)];
    t.tags.target = true;
    this.ballView.setTag(t, 0xffe23b);
    if (!retarget) {
      const others = objs.filter(b => b !== t).sort(() => Math.random() - 0.5).slice(0, 3);
      for (const o of others) { o.tags.forbidden = true; this.ballView.setTag(o, 0xff2030, true); }
    } else this.ui.worldPop('NEW TARGET', this.worldPos(t.x, t.z, 0.12), '#ffe23b');
  },

  setTilt(x, z) {
    this.tiltVec = { x, z };
    // physics tilt stays below rolling resistance (~0.2 m/s²) so balls curve but still stop;
    // the visual tilt is exaggerated so you can read the slope
    this.table.tilt.tx = x * 0.24;
    this.table.tilt.tz = z * 0.24;
    this.applyRules();
  },

  // ------------------------------------------------ mastery helpers
  hasRelic(id) { return !!this.run?.relics.some(r => r.id === id); },

  // HIGH STAKES: break the rule and the table is lost (after the shot settles)
  stakeCheck(reason) {
    const e = this.enc;
    if (!reason || !e?.stake || e.stakeBroken) return;
    e.stakeBroken = reason;
    this.ui.popup(`STAKE BROKEN — ${reason}`, { color: '#ff3b5c', scale: 1.3 });
    this.audio.fail();
    this.ui.updateHUD(true);
  },

  challengeCheck(reason) {
    const e = this.enc;
    if (!reason || !e?.challenge || e.chBroken) return;
    e.chBroken = reason;
    this.ui.popup(`BET BROKEN — ${reason}`, { color: '#ff3b5c', scale: 1.15 });
    this.audio.fail();
    this.ui.updateHUD(true);
  },

  styleUp(g) {
    this.ui.styleUp(g, this.time < (this.reactUntil || 0));
    this.audio.combo(Math.min(5, g + 1));
    if (g >= 4) { this.room.cheerNow(0.9); this.audio.crowd(0.5); }
  },

  addHeat(pts) {
    const run = this.run;
    if (!run || this.meta.s.heat === false) return;
    const before = run.heat || 0;
    run.heatPts = (run.heatPts || 0) + pts * (run.breakLv >= 5 ? 1.5 : 1);
    run.heat = heatLevel(run.heatPts);
    run.heatMax = Math.max(run.heatMax || 0, run.heat);
    if (run.heat > before) { this.heatUp(run.heat); this.ui.showTip?.('heat'); }
    if (run.heat >= 5) this.achieve('too_hot');
    this.ui.updateHUD(true);
  },

  coolHeat(k) {
    const run = this.run;
    if (!run) return;
    const before = run.heat || 0;
    run.heatPts = (run.heatPts || 0) * k;
    run.heat = heatLevel(run.heatPts);
    if (run.heat < before) this.ui.toast(`HEAT ${ROMAN[run.heat]}`, '#ff8a1b', 'THE CLUB COOLS OFF');
  },

  heatUp(h) {
    // never talk over a reaction: the banner lands as the reaction fades
    if (this.time < (this.reactUntil || 0)) return this.after(this.reactUntil - this.time, () => this.heatUp(h));
    this.ui.heatUp(h);
    this.audio.heatUp(h);
    this.screenFlash(0xff5010, 0.25 + h * 0.04);
    this.shake(0.3 + h * 0.06);
    for (let i = 0; i < 4; i++) this.after(i * 0.1, () => this.fx.burst((Math.random() - 0.5) * 1.8, 0.05, (Math.random() - 0.5) * 0.9, [0xff3010, 0xff8a1b, 0xffe23b], 26, 1.3, { up: 2.2, life: 1.2, grav: -0.4, drag: 1.8 }));
  },

  // the strongest reaction, reserved for genuinely exceptional shots
  exceptionalShot(A) {
    if (this.time - (this.lastReaction ?? -99) < 8) {
      const t = A.T.filter(x => x[2] >= 3).sort((a, b) => b[2] - a[2])[0];
      if (t) this.ui.popup(t[0] + '!', { color: '#2bf0ff', scale: 1.3 });
      return;
    }
    this.lastReaction = this.time;
    this.reactUntil = this.time + 1.35;
    this.freeze(0.09);
    this.audio.music?.duck(0.9);
    this.audio.bigHit(3);
    this.fovPunch = 1.6;
    this.shake(0.6);
    this.room.cheerNow(1.8);
    this.audio.crowd(1);
    this.screenFlash(0xffffff, 0.25);
    this.ui.reaction(reactionWord(), A.T.filter(x => x[2] > 0).map(x => x[0]).slice(0, 3));
    for (let i = 0; i < 5; i++) this.after(0.1 + i * 0.12, () => this.fx.burst((Math.random() - 0.5) * 1.6, 0.25, (Math.random() - 0.5) * 0.8, [0xff2bd6, 0x2bf0ff, 0xffe23b, 0xffffff], 34, 1.8, { up: 2.4, life: 1.3, grav: 2.2 }));
  },

  pocketFever(e, lo, hi) {
    e.fever = this.physics.pockets.map(() => lo + Math.random() * (hi - lo));
    this.applyRules();
    this.audio.tone(300, { type: 'sine', dur: 0.5, vol: 0.1, slide: 600, verb: 0.4 });
  },

  stormFlash(e) {
    e.storm = [0.55, 0.8, 1.3, 1.7][Math.floor(Math.random() * 4)];
    this.applyRules();
    this.room.lightning = 1;
    this.lights.flash(this.worldPos(0, 0, 1.4), 0xc0d0ff, 6, 3, 0.4);
    this.screenFlash(0xd0e0ff, 0.35);
    this.audio.noise({ dur: 1.4, vol: 0.4, type: 'lowpass', freq: 400, slide: 60, attack: 0.02, verb: 0.6 });
    this.ui.popup(e.storm < 1 ? 'SLICK FELT' : 'STICKY FELT', { color: '#c0d0ff' });
  },

  crookedTilt(mag = null, label = 'THE TABLE SHIFTS') {
    const a = Math.random() * Math.PI * 2;
    // physics tilt stays below rolling resistance so balls always stop
    const m = Math.min(0.19, mag ?? (0.11 + Math.random() * 0.05 + Math.min(3, this.run?.floor || 1) * 0.012));
    this.setTilt(Math.cos(a) * m, Math.sin(a) * m);
    if (this.enc?.bossPlus) this.shufflePockets(5);
    const big = m > 0.17;
    this.table.sway += big ? 1.4 : 0.7;
    this.shake(big ? 0.55 : 0.25);
    this.audio.tone(90, { type: 'sawtooth', dur: 0.9, vol: big ? 0.2 : 0.12, slide: 60, filter: 300 });
    this.audio.noise({ dur: 0.8, vol: big ? 0.2 : 0.12, type: 'bandpass', freq: 300, q: 3 });
    this.ui.popup(label, { color: '#ffb020', scale: big ? 1.5 : 1 });
  },

  // THE DEALER: one gold pocket (counts double), one or two red ones (bust)
  dealerDeal() {
    const e = this.enc;
    const order = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
    const nBad = e.phase >= 2 || e.bossPlus ? 2 : 1;
    e.dealer = { hi: order[0], bad: order.slice(1, 1 + nBad) };
    this.applyRules();
    const pk = this.physics.pockets;
    this.ui.worldPop('GOLD x2', this.worldPos(pk[e.dealer.hi].x, pk[e.dealer.hi].z, 0.14), '#ffd040', 1.2);
    for (const i of e.dealer.bad) this.ui.worldPop('BUST', this.worldPos(pk[i].x, pk[i].z, 0.14), '#ff3040', 1.2);
    this.audio.tone(1500, { type: 'square', dur: 0.03, vol: 0.05, filter: 4000 });
    this.audio.tone(1900, { t: this.audio.now + 0.06, type: 'square', dur: 0.03, vol: 0.05, filter: 4000 });
  },

  // boss phases: the table escalates as you close in on it
  bossPhase(n) {
    const e = this.enc, def = e.def;
    this.ui.bossPhase(def, n, def.phases?.[n - 1] || '');
    this.audio.bossPhase(n);
    this.shake(0.45);
    this.freeze(0.08);
    this.screenFlash(new (this.renderer.flash.color.constructor)(def.color).getHex(), 0.3);
    this.tintLights(def.color, 0.32 + 0.14 * (n - 1));
    this.audio.setIntensity(1);
    this.lights.flash(this.worldPos(0, 0, 0.8), new (this.renderer.flash.color.constructor)(def.color).getHex(), 3, 3, 0.6);
  },

  mimicShuffle() {
    const e = this.enc;
    const corners = [0, 2, 3, 5].sort(() => Math.random() - 0.5);
    const others = [0, 1, 2, 3, 4, 5].filter(i => i !== corners[0]).sort(() => Math.random() - 0.5);
    const ph = Math.min(3, (e.phase || 1) + (e.bossPlus ? 1 : 0));
    const open = ph <= 1 ? [corners[0], others[0], others[1], others[2]] : [corners[0], others[0], others[1]];
    const spit = ph <= 1 ? -1 : (ph >= 3 || Math.random() < 0.75) ? open[1 + Math.floor(Math.random() * 2)] : -1;
    e.mimic = { open, spit };
    this.applyRules();
    this.audio.tone(140, { type: 'square', dur: 0.08, vol: 0.2, filter: 800 });
    this.audio.tone(110, { t: this.audio.now + 0.1, type: 'square', dur: 0.08, vol: 0.2, filter: 800 });
    this.shake(0.15);
  },

  voidMove() {
    const e = this.enc;
    let i;
    do { i = Math.floor(Math.random() * 6); } while (i === e.voidPocket);
    e.voidPocket = i;
    if (e.bossPlus || e.phase >= 3) { let j; do { j = Math.floor(Math.random() * 6); } while (j === i); e.voidPocket2 = j; }
    this.applyRules();
    this.audio.tone(45, { type: 'sine', dur: 1.2, vol: 0.4, slide: 30 });
    this.audio.noise({ dur: 1.0, vol: 0.12, type: 'lowpass', freq: 200, slide: 1500, attack: 0.6 });
  },

  shufflePockets(nOpen) {
    const all = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
    this.enc.closed = all.slice(nOpen);
    this.applyRules();
    this.audio.tone(200, { type: 'square', dur: 0.1, vol: 0.1, filter: 900 });
  },

  rollChaos() {
    const prev = this.chaosRule;
    this.blackout = false;
    this.chaosWind = null;
    if (prev?.id === 'tilt') this.setTilt(0, 0);
    let r;
    do { r = CHAOS[Math.floor(Math.random() * CHAOS.length)]; } while (r === prev);
    this.chaosRule = r;
    r.apply?.(this);
    this.applyRules();
    this.ui.chaosCard(r);
    this.audio.combo(0);
  },

  ensureBalls() {
    const e = this.enc;
    if (!e) return;
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind !== 'cue' && b.kind !== 'golden');
    const remaining = e.goal - e.progress;
    let need = e.def.id === 'combo' ? remaining * 2 + 1 : remaining + 1;
    if (e.def.id === 'assassin') {
      if (!objs.some(b => b.tags.target)) this.later(0.6, () => { const b = this.spawnDropBall(1 + Math.floor(Math.random() * 7)); this.markAssassin(true); });
      return;
    }
    if (e.def.classic) return;
    if (objs.length >= need) return;
    const n = Math.min(10, Math.max(6, need + 3 - objs.length));
    this.ui.popup('RE-RACK!', { color: '#2bf0ff', scale: 1.3 });
    const nums = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) this.later(0.3 + i * 0.07, () => this.spawnDropBall(nums[i % nums.length], 'object', 0.35 + (i % 4) * 0.08, ((i >> 2) - 1) * 0.1));
  },

  rerackRemaining() {
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind !== 'cue');
    const dx = 2 * R * Math.cos(Math.PI / 6) + 0.0006, dz = 2 * R + 0.0006;
    let k = 0;
    for (let r = 0; k < objs.length; r++) {
      for (let i = 0; i <= r && k < objs.length; i++) {
        const b = objs[k++];
        const x = TABLE.footX + r * dx, z = (i - r / 2) * dz;
        b.x = x; b.z = z; b.y = 0.2 + k * 0.01; b.vy = 0;
      }
    }
    // keep the cue out of the rack
    const cue = this.physics.cue;
    if (cue && !this.physics.isFree(cue.x, cue.z, 0.002, cue)) { const s = this.physics.findFreeSpot(TABLE.headX, 0, cue); cue.x = s.x; cue.z = s.z; }
    this.ui.popup('RE-RACK!', { color: '#ff2bd6' });
  },
};

// homing: steer the cue ball toward the nearest object ball before first contact
RunMixin.homingForce = null;
// ORBIT: heavy side spin bends the cue ball before its first contact (a massé)
export function makeOrbit(G) {
  return (b, h) => {
    const S = G.shot;
    if (b.kind !== 'cue' || !S || S.firstHit || S.house) return;
    const u = G.relicUpgraded('orbit');
    const side = S.side || 0;
    if (Math.abs(side) < (u ? 0.3 : 0.5)) return;
    const sp = Math.hypot(b.vx, b.vz);
    if (sp < 0.15) return;
    const turn = -Math.sign(side) * (Math.abs(side) * (u ? 1.8 : 1.2)) * h;
    const c = Math.cos(turn), s = Math.sin(turn);
    const vx = b.vx * c - b.vz * s, vz = b.vx * s + b.vz * c;
    b.vx = vx; b.vz = vz;
  };
}

export function makeHoming(G) {
  return (b, h) => {
    if (b.kind !== 'cue' || !G.shot || G.shot.firstHit || G.shot.house) return;
    const sp = Math.hypot(b.vx, b.vz);
    if (sp < 0.1) return;
    let best = null, bd = 1e9;
    for (const o of G.physics.balls) {
      if (o.state !== 'table' || o === b) continue;
      const d = Math.hypot(o.x - b.x, o.z - b.z);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best || bd > 0.8) return;
    const want = Math.atan2(best.z - b.z, best.x - b.x);
    const cur = Math.atan2(b.vz, b.vx);
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) > 1.2) return;
    const turn = Math.sign(d) * Math.min(Math.abs(d), 1.6 * h);
    const na = cur + turn;
    b.vx = Math.cos(na) * sp; b.vz = Math.sin(na) * sp;
    const c = Math.cos(turn), s = Math.sin(turn);
    const wx = b.wx * c - b.wz * s, wz = b.wx * s + b.wz * c;
    b.wx = wx; b.wz = wz;
  };
}
