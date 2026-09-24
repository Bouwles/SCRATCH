// AFTERHOURS run systems, mixed into Game next to RunMixin and ShotMixin:
// Table States, Contracts, High Roller tables, Rivals and Nemeses, the new
// table objectives, hidden synergies, Overcharge, Shot of the Run, run
// history, the extra modes and the act that starts after closing time.
// run.js and shot.js call in at a handful of fixed points; everything else
// stays where it was.

import { TABLE } from '../config.js';
import { rand, withSeed } from './rng.js';
import { ENCOUNTERS, BOSSES, rackTriangle } from './encounters.js';
import { rollRelics, relicById, RELICS, RARITY, MAX_RELICS } from './relics.js';
import { rollMods, MODS, ROMAN } from './mastery.js';
import {
  TABLE_STATES, stateById, CONTRACTS, contractById, RIVALS, rivalById, pickRival, SYNERGIES, synergyById, hasSynergy,
  OVERCHARGES, HANDICAPS, handicapMul, buildName, commentLine, TRICK_PUZZLES,
} from './afterhours.js';

const R = TABLE.R;
const NON_BOSS_KINDS = ['table', 'elite', 'stakes', 'highroller', 'rival', 'trickshot'];
// the six pockets in clockwise order around the table
const RING = [0, 1, 2, 5, 4, 3];

export const AfterMixin = {
  // ------------------------------------------------------------ gates
  // Daily Scratch is the same road for everyone, so it gets the whole club.
  gate(name) {
    if (this.run?.mode === 'daily' && name !== 'afterhours' && name !== 'rajis') return true;
    return this.meta.unlocked(name);
  },
  maxRelics() { return MAX_RELICS + (this.run?.extraSlots || 0); },
  relicOff(id) { return !!this.enc?.disabled?.[id]; },
  isOver(id) { return this.run?.over?.id === id && this.hasRelic(id); },
  absNode() { return (this.run?.floor || 0) * 20 + (this.run?.node || 0); },

  // the club remembers what this save has done (menu personality)
  menuFlags() {
    const d = this.meta?.data;
    if (!d) return {};
    return { champion: (d.stats.wins || 0) >= 1, heat5: (d.bests.highestHeat || 0) >= 5, clock: !!d.afterhours?.found, radar: !!d.rajis?.found, oddPoster: !d.rajis?.found && (d.rajis?.clues || 0) >= 2 };
  },
  // a build gets a name once it has enough relics to be one
  buildCheck() {
    const run = this.run;
    if (!run || run.mode === 'rajis' || run.relics.length < 4) return;
    const name = buildName(run.relics, run.seed);
    if (!name || name === run.buildName) return;
    run.buildName = name;
    this.later(1.2, () => this.ui.toast(name, '#2bf0ff', 'YOUR BUILD'));
  },

  // ----------------------------------------------------- table states
  activeState() {
    const s = this.run?.tstate;
    return s ? stateById(s.id) : null;
  },
  // A state can arrive at a table stop. Returns true when it showed a banner
  // and will call go() itself.
  maybeTableState(nodeType, go) {
    const run = this.run;
    if (!run || run.mode === 'rajis' || run.after || !['table', 'elite'].includes(nodeType) || run.tstate) return false;
    const chaos = run.mode === 'chaos';
    if (!chaos) {
      if (!this.gate('states')) return false;
      if (run.floor === 1 && run.node < 4) return false;
      if ((run.tstateCool || 0) > this.absNode()) return false;
    } else if ((run.tstateCool || 0) > this.absNode()) return false;
    const chance = chaos ? 1 : (run.floor === 1 ? 0.12 : 0.26) + 0.03 * (run.heat || 0);
    const pick = withSeed([run.seed, run.floor, run.node, 'tstate'], () => {
      if (rand() > chance) return null;
      const pool = TABLE_STATES.filter(s => s.id !== run.lastState && !(s.id === 'redline' && this.meta.s.heat === false));
      return pool[Math.floor(rand() * pool.length)];
    });
    if (!pick) return false;
    run.tstate = { id: pick.id, left: chaos ? 2 : pick.tables };
    run.lastState = pick.id;
    this.saveRun();
    this.stateWorld(pick, true);
    this.ui.stateBanner(pick, run.tstate.left, go);
    return true;
  },
  // one table lived through; the state winds down
  stateTick() {
    const run = this.run, s = this.activeState();
    if (!s || !run.tstate) return;
    run.tstate.left--;
    if (run.tstate.left > 0) return;
    run.tstate = null;
    run.tstateCool = this.absNode() + (run.mode === 'chaos' ? 1 : 3);
    const d = this.meta.data;
    d.states[s.id] = (d.states[s.id] || 0) + 1;
    this.achieve('state_first');
    this.meta.save();
    this.stateWorld(s, false);
    this.ui.toast(s.id === 'blackout' ? 'THE LIGHTS COME BACK ON' : 'THE CLUB SETTLES DOWN', s.color, `${s.name} IS OVER`);
  },
  // lights, music and crowd for a state (also restored after a reload)
  stateWorld(s, on) {
    this.quiet = !!(on && s?.quiet);
    this.room.setMood?.(this.quiet ? 'quiet' : 'calm');
    this.audio.quiet = this.quiet;
    if (!on) { this.blackout = false; this.renderer.fx.statik = 0; }
  },
  stateHook(name, ...args) {
    const e = this.enc;
    if (!e?.tstate) return;
    e.tstate[name]?.(this, ...args);
  },

  // --------------------------------------------------------- contracts
  // Offered as a floor opens: pick one of two, or play clean.
  floorStart(go) {
    const run = this.run;
    if (!run || run.mode === 'rajis' || run.mode === 'bossrush' || run.after || run.contract || !this.gate('contracts') || run.floor > 3) { go(); return; }
    const offer = withSeed([run.seed, run.floor, 'contract'], () => {
      if (rand() > (run.floor === 1 ? 0.6 : 0.5)) return null;
      const pool = CONTRACTS.filter(c => !(c.needsHeat && this.meta.s.heat === false) && !(run.contractsDone || []).includes(c.id));
      const out = [];
      while (out.length < 2 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
      return out;
    });
    if (!offer?.length) { go(); return; }
    this.ui.contractOffer(offer, (c) => {
      if (c) {
        run.contract = { id: c.id, n: 0 };
        this.ui.toast(c.name, '#ffc21c', 'CONTRACT SIGNED');
        this.saveRun();
      }
      go();
    });
  },
  contractDef() { return this.run?.contract ? contractById(this.run.contract.id) : null; },
  contractEvent(type, data) {
    const run = this.run, c = this.contractDef();
    if (!c || run.contract.done) return;
    const k = run.contract;
    const e = data;
    switch (c.id) {
      case 'clean_hands':
        if (type === 'scratch') return this.contractFail('YOU SCRATCHED');
        if (type === 'tableWon') k.n++;
        break;
      case 'banker': if (type === 'pot' && data.bank && data.counted) k.n++; break;
      case 'sharpshooter': if (type === 'pot' && data.counted && data.ball.travel >= 1.2) k.n++; break;
      case 'hot_run': if (type === 'heat') k.n = Math.max(k.n, data); break;
      case 'chain_gang': if (type === 'shot') k.n = Math.max(k.n, run.streak || 0); break;
      case 'perfect_customer': if (type === 'spend') k.n += data; break;
      case 'no_fear':
        if (type === 'tableWon' && e.kind === 'elite' && (['minimal', 'none'].includes(this.meta.s.aim) || this.hasRelic('blind_faith') || e.challenge?.id === 'noguide')) k.n = 1;
        break;
      case 'untouched':
        if (type === 'tableWon') k.n = e.misses === 0 ? k.n + 1 : 0;
        if (type === 'tableLost') k.n = 0;
        break;
      default: break;
    }
    if (type === 'bossWon' && c.until !== 'self' && k.n < c.goal) return this.contractFail('OUT OF TIME');
    if (k.n >= c.goal) this.contractComplete(c);
    this.ui.updateHUD(true);
  },
  contractFail(why) {
    const c = this.contractDef();
    this.run.contract = null;
    this.ui.contractBanner('CONTRACT FAILED', `${c.name} · ${why}`, false);
    this.audio.fail();
    this.saveRun();
  },
  contractComplete(c) {
    const run = this.run;
    run.contract = null;
    run.contractsDone = [...(run.contractsDone || []), c.id];
    this.meta.stat('contracts').forEach(a => this.ui.achievement(this.meta.data, a.id));
    this.meta.save();
    this.audio.win();
    this.ui.contractBanner('CONTRACT COMPLETE', `${c.name} · ${c.rewardText}`, true);
    switch (c.reward) {
      case 'chips45': this.addChips(45); break;
      case 'chips30': this.addChips(30); break;
      case 'slot': run.extraSlots = (run.extraSlots || 0) + 1; break;
      case 'discount': run.discount = 0.75; break;
      case 'heart': run.maxHearts++; this.heal(1); break;
      default: (run.pending = run.pending || []).push(c.reward);    // relic choices wait for a quiet moment
    }
    this.saveRun();
  },
  // relic rewards are handed out between stops, never mid-table
  flushPending(go) {
    const run = this.run;
    const next = run?.pending?.shift();
    if (!next) { go(); return; }
    this.saveRun();
    const cont = () => this.flushPending(go);
    if (next === 'upgrade') {
      const list = run.relics.filter(r => r.up && !this.relicUpgraded(r.id));
      if (!list.length) { this.addChips(15); cont(); return; }
      this.ui.pickRelic(list, 'CONTRACT: TUNE UP A RELIC', (r) => { if (r) this.upgradeRelic(r); else this.addChips(15); cont(); }, (r) => r.up);
      return;
    }
    const rar = next === 'legendary' ? 'legendary' : 'rare';
    const opts = withSeed([run.seed, run.floor, run.node, 'contract-pay', next], () => rollRelics(3, run.relics, { forceRarity: rar, upgraded: run.relicLv }));
    opts.forEach(r => this.meta.seeRelic(r.id));
    this.ui.relicChoice(opts, (r) => { const got = r ? this.gainRelic(r) : (this.addChips(3), Promise.resolve()); got.then(cont); }, { title: 'CONTRACT PAYOUT' });
  },

  // ------------------------------------------------------ high roller
  highRollerBet(card, go, back) {
    const run = this.run;
    this.ui.highRoller(card, run.chips, (amount) => {
      if (!amount) { back(); return; }
      const allIn = amount === 'all';
      const n = allIn ? run.chips : amount;
      run.chips -= n;
      this.audio.coin(6);
      this.ui.updateHUD(true);
      go({ ...card, hr: n, hrAll: allIn });
    });
  },

  // ------------------------------------------------------------ rivals
  rivalTurn(e) {
    const run = this.run, rv = e.rivalDef;
    const k = withSeed([run.seed, run.floor, run.node, 'rival', e.rivalTurns], () => {
      let n = rv.turn(e.rivalTurns, rand);
      if (e.nemesis && rand() < 0.18) n++;
      return n;
    });
    e.rivalTurns++;
    e.rivalScore = Math.min(e.goal, (e.rivalScore || 0) + k);
    if (run.inTable) run.inTable.rs = e.rivalScore;
    this.ui.rivalTurn(e, k);
    if (k > 0) {
      this.audio.tone(rv.sting[0], { type: 'square', dur: 0.09, vol: 0.07, filter: 2400 });
      this.audio.tone(rv.sting[1], { t: this.audio.now + 0.09, type: 'square', dur: 0.14, vol: 0.07, filter: 2400 });
      if (k >= 2) this.audio.crowd(0.25);
    }
    if (!rv.hidden && e.rivalScore >= e.goal - 1 && e.progress >= e.goal - 1) this.comment('rival');
  },
  rivalResult(e, won) {
    const rv = e.rivalDef;
    if (!rv) return;
    const d = this.meta.data;
    const rec = d.rivals[rv.id] = d.rivals[rv.id] || { wins: 0, losses: 0, nemesis: false, level: 0 };
    if (won) {
      rec.wins++;
      this.achieve('rival_beat');
      if (e.nemesis) { rec.nemesis = false; rec.losses = 0; rec.level++; this.achieve('nemesis'); this.ui.toast(`${rv.name} WILL NOT FORGET THIS`, rv.color, 'NEMESIS DEFEATED'); }
    } else {
      rec.losses++;
      if (!rec.nemesis && rec.losses >= 2) rec.nemesis = true;
    }
    this.meta.save();
  },

  // ------------------------------------------------ table objectives
  labelBall(b, text, color) { b.tags.label = text; b.tags.labelColor = color; },
  markSequence(e) {
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind === 'object' && b.num !== 8);
    const pick = objs.sort(() => rand() - 0.5).slice(0, e.goal);
    pick.forEach((b, i) => { b.tags.seq = i + 1; this.labelBall(b, String(i + 1), '#2bf0ff'); this.ballView.setTag(b, 0x2bf0ff); });
    e.seqNext = 1;
  },
  afterSequence(e, S) {
    if (S.seqAt) e.seqNext = S.seqAt;
    for (const b of S.seqWrong || []) {
      e.shots = Math.max(0, e.shots - 1);
      this.ui.popup(`OUT OF ORDER  -1 SHOT`, { color: '#ff3b5c' });
      this.later(0.35, () => { const nb = this.spawnDropBall(b.num, 'object'); nb.tags.seq = b.tags.seq; this.labelBall(nb, String(b.tags.seq), '#2bf0ff'); this.ballView.setTag(nb, 0x2bf0ff); });
    }
    // keep the next number highlighted
    for (const b of this.physics.balls) if (b.tags.seq) b.tags.labelColor = b.tags.seq === e.seqNext ? '#ffe23b' : '#2bf0ff';
  },
  markBounty(e) {
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind === 'object' && b.num !== 8 && !b.tags.bounty);
    for (const b of this.physics.balls) if (b.tags.bounty) { b.tags.bounty = false; b.tags.label = null; this.ballView.setTag(b, null); }
    const b = objs[Math.floor(Math.random() * objs.length)];
    if (!b) return;
    b.tags.bounty = true;
    this.labelBall(b, 'x3', '#ffd040');
    this.ballView.setTag(b, 0xffd040);
    e.bountyAge = 0;
    this.ui.worldPop('BOUNTY', this.worldPos(b.x, b.z, 0.12), '#ffd040', 1.2);
  },
  afterBounty(e, S) {
    const got = S.pots.some(p => p.counted && p.ball.tags.bounty);
    const alive = this.physics.balls.some(b => b.state === 'table' && b.tags.bounty);
    if (got) { this.audio.coin(5); this.later(0.5, () => this.markBounty(e)); return; }
    if (!alive) { this.later(0.5, () => this.markBounty(e)); return; }
    e.bountyAge = (e.bountyAge || 0) + 1;
    if (e.bountyAge >= 3) { this.ui.popup('THE BOUNTY SLIPPED AWAY', { color: '#ffd040' }); this.markBounty(e); }
  },
  markHot(e) {
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind === 'object' && b.num !== 8);
    for (const b of this.physics.balls) if (b.tags.hot) { b.tags.hot = false; b.tags.label = null; this.ballView.setTag(b, null); }
    const b = objs[Math.floor(Math.random() * objs.length)];
    if (!b) return;
    b.tags.hot = true;
    e.fuse = 3;
    this.labelBall(b, '3', '#ff8a1b');
    this.ballView.setTag(b, 0xff6010);
  },
  afterHot(e, S) {
    const potted = S.pots.some(p => p.counted && p.ball.tags.hot);
    const hot = this.physics.balls.find(b => b.state === 'table' && b.tags.hot);
    if (potted || !hot) { if (potted) this.ui.popup('HOT POTATO x2', { color: '#ff8a1b', scale: 1.2 }); this.later(0.5, () => this.markHot(e)); return; }
    e.fuse--;
    hot.tags.label = String(Math.max(0, e.fuse));
    if (e.fuse <= 0) {
      this.explode(hot.x, hot.z, 0.28, 1.6, hot);
      hot.state = 'pocketed';
      e.shots = Math.max(0, e.shots - 2);
      this.ui.popup('IT BLEW UP  -2 SHOTS', { color: '#ff3b5c', scale: 1.3 });
      this.later(0.9, () => this.markHot(e));
    } else if (e.fuse === 1) this.audio.heartbeat();
  },
  afterLockdown(e) {
    e.lockTick = (e.lockTick || 0) + 1;
    if (e.lockTick % 2) return;
    if (e.lockNext != null && e.closed.length < 4) {
      e.closed.push(e.lockNext);
      this.ui.popup('A POCKET SEALS', { color: '#ff3b5c' });
      this.audio.tone(90, { type: 'square', dur: 0.3, vol: 0.18, filter: 600 });
      this.shake(0.2);
    }
    const open = [0, 1, 2, 3, 4, 5].filter(i => !e.closed.includes(i));
    e.lockNext = e.closed.length < 4 ? open[Math.floor(Math.random() * open.length)] : null;
    this.applyRules();
  },
  markRoute(e) {
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind === 'object' && b.num !== 8 && !b.tags.route);
    const have = this.physics.balls.filter(b => b.state === 'table' && b.tags.route).length;
    const need = Math.max(0, e.goal - e.progress - have);
    objs.sort(() => Math.random() - 0.5).slice(0, need).forEach(b => this.routeBall(b));
  },
  afterRoute(e, S) {
    const hit = S.pots.filter(p => p.counted && p.ball.tags.route);
    if (hit.length) {
      for (const p of hit) (e.routeGone = e.routeGone || []).push(p.ball.num);
    } else if ((e.routeGone || []).length) {
      // a shot that misses the route: every route ball already sunk comes back
      this.ui.popup('ROUTE RESET', { color: '#ff2bd6', scale: 1.2 });
      e.routeGone.forEach((num, i) => this.later(0.3 + i * 0.15, () => { const nb = this.spawnDropBall(num, 'object'); this.routeBall(nb); }));
      e.routeGone = [];
    }
    this.later(0.7, () => this.markRoute(e));
  },
  routeBall(b) { b.tags.route = true; this.labelBall(b, 'ROUTE', '#ff2bd6'); this.ballView.setTag(b, 0xff2bd6); },

  // trick tables: a hand-built layout, reset after every attempt
  buildTrick(e) {
    const pz = e.puzzle || TRICK_PUZZLES[0];
    e.puzzle = pz;
    e.layout = 'puzzle';
    const cue = this.physics.cue;
    if (cue) { cue.x = pz.cue[0]; cue.z = pz.cue[1]; }
    for (const [x, z, num] of pz.target) { const b = this.addBall(num, x, z); b.tags.trick = true; this.ballView.setTag(b, 0xffd040); }
    for (const [x, z, num] of pz.others) this.addBall(num, x, z);
    this.physics.obstacles = (pz.pillars || []).map(([x, z]) => ({ x, z, r: 0.03, rest: 0.55, kind: 'pillar' }));
    this.ballView.syncObstacles();
  },
  resetTrick(e) {
    if (e.done) return;
    this.physics.clearBalls();
    this.physics.addBall(0, 0, 0);
    this.buildTrick(e);
    this.physics.balls.forEach((b, i) => { if (b.kind !== 'cue') { b.y = 0.1 + i * 0.01; b.vy = 0; } });
    this.fx.clearTrails();
    this.ballView.prune();
    this.ui.popup(`ATTEMPT ${e.shotsTaken + 1} / ${e.shotsMax}`, { color: '#ffd040' });
  },

  // --------------------------------------------------------- the bosses
  // THE COLLECTOR: borrows relics, returns them when it falls
  collectorTake(e) {
    const run = this.run;
    const owned = run.relics.filter(r => !e.disabled[r.id]);
    if (!owned.length) return;
    const r = owned[Math.floor(Math.random() * owned.length)];
    e.disabled[r.id] = true;
    this.ui.toast(r.name, '#d8b060', 'THE COLLECTOR BORROWS');
    this.ui.updateHUD(true);
    this.applyRules();
  },
  collectorItem(e) {
    if (this.enc !== e || e.done) return;
    if (this.physics.balls.some(b => b.state === 'table' && b.tags.item)) return;
    const b = this.spawnDropBall(1 + Math.floor(Math.random() * 7), 'object');
    b.tags.item = true;
    this.labelBall(b, 'ITEM', '#d8b060');
    this.ballView.setTag(b, 0xd8b060);
  },
  afterCollector(e, S) {
    if (S.pots.some(p => p.counted && p.ball.tags.item)) {
      const back = Object.keys(e.disabled).find(id => e.disabled[id]);
      if (back) { delete e.disabled[back]; this.ui.toast(relicById(back)?.name || back, '#34e070', 'TAKEN BACK'); this.applyRules(); this.ui.updateHUD(true); }
    }
    this.later(0.8, () => this.collectorItem(e));
  },
  // THE ARCHITECT: walls of stone across the felt
  architectBuild(e, n = 1, rebuild = false) {
    if (this.enc !== e || e.done) return;
    if (rebuild) this.physics.obstacles = this.physics.obstacles.filter(o => !o.wall);
    const walls = this.physics.obstacles.filter(o => o.wall).length / 4;
    for (let w = walls; w < Math.min(3, walls + n); w++) {
      for (let t = 0; t < 40; t++) {
        const x = -0.6 + Math.random() * 1.3, z = (Math.random() - 0.5) * 0.6;
        const vert = Math.random() < 0.5;
        const pts = [0, 1, 2, 3].map(k => vert ? [x, z - 0.09 + k * 0.06] : [x - 0.09 + k * 0.06, z]);
        if (!pts.every(([px, pz]) => this.physics.isFree(px, pz, 0.03))) continue;
        const cue = this.physics.cue;
        if (cue && pts.some(([px, pz]) => Math.hypot(px - cue.x, pz - cue.z) < 0.16)) continue;
        for (const [px, pz] of pts) this.physics.obstacles.push({ x: px, z: pz, r: 0.028, rest: 0.75, kind: 'pillar', wall: true });
        break;
      }
    }
    this.ballView.syncObstacles();
    this.audio.tone(70, { type: 'square', dur: 0.25, vol: 0.14, filter: 500 });
    this.audio.noise({ dur: 0.25, vol: 0.15, type: 'lowpass', freq: 500 });
    this.shake(0.15);
  },
  architectSeal(e) {
    const i = Math.floor(Math.random() * 6);
    e.closed = [i];
    this.applyRules();
    this.ui.popup('A POCKET IS BRICKED IN', { color: '#6ab0ff' });
  },
  // THE BOOKIE: a side bet before every shot
  bookieOffer(e) {
    if (e.done) return;
    const kinds = [
      ['TWO IN ONE SHOT', S => S.counted >= 2, 2],
      ['A BANK SHOT', S => S.pots.some(p => p.counted && p.bank), 2],
      ['A LONG POT', S => S.pots.some(p => p.counted && p.ball.travel >= 1.1), 1],
      ['A CORNER POCKET', S => S.pots.some(p => p.counted && p.pocket.kind === 'corner'), 1],
      ['A SIDE POCKET', S => S.pots.some(p => p.counted && p.pocket.kind === 'side'), 2],
      ['ANY POT', S => S.counted >= 1, 1],
    ];
    const [text, test, pay] = kinds[Math.floor(Math.random() * kinds.length)];
    const dbl = e.phase >= 3 || e.bossPlus ? 2 : 1;
    e.bookTick = (e.bookTick || 0) + 1;
    const forced = e.phase >= 2 && e.bookTick % 2 === 0;
    e.book = { text, test, win: pay * dbl, lose: dbl, accepted: forced, forced };
    this.ui.updateHUD(true);
  },
  bookieAccept() {
    const e = this.enc;
    if (!e?.book || e.book.accepted || !['aim', 'place'].includes(this.state)) return;
    e.book.accepted = true;
    this.audio.coin(2);
    this.ui.updateHUD(true);
  },
  bookieSettle(e, S) {
    const b = e.book;
    if (!b?.accepted) return 0;
    e.book = null;
    if (b.test(S)) { this.ui.popup(`THE BOOKIE PAYS  +${b.win}`, { color: '#b0ff5a', scale: 1.3 }); this.audio.coin(5); return b.win; }
    this.ui.popup(`THE BOOKIE COLLECTS  -${b.lose}`, { color: '#ff3b5c', scale: 1.2 }); this.audio.groan();
    return -b.lose;
  },

  // THE OWNER: the last game of the night
  ownerCounts(e, S, pot) {
    if (e.lastGame) return pot.ball.num === 8 && pot.ball.kind === 'object' && pot.pocket.index === e.lastPocket;
    if (pot.ball.num === 8 && pot.ball.kind === 'object') return false;
    if (e.phase >= 3 && e.litBall) return pot.ball === e.litBall;
    return true;
  },
  afterOwner(e, S) {
    if (e.lastGame) return;
    // phase I+: the pocket you use closes behind you
    for (const p of S.pots) {
      if (!p.counted || p.house || e.closed.includes(p.pocket.index)) continue;
      e.closed.push(p.pocket.index);
      this.audio.tone(80, { type: 'square', dur: 0.35, vol: 0.16, filter: 500 });
    }
    while (e.closed.length > 3) e.closed.shift();
    // phase II+: the closed set turns around the table every shot
    if (e.phase >= 2) e.closed = e.closed.map(i => RING[(RING.indexOf(i) + 1) % 6]);
    if (e.progress >= e.goal - 1) this.ownerLastGame(e);
    else if (e.phase >= 3) this.ownerLight(e);
    this.applyRules();
  },
  ownerPhase(e, n) {
    if (n >= 3) { this.blackout = 'deep'; this.ownerLight(e); }
  },
  ownerLight(e) {
    const objs = this.physics.balls.filter(b => b.state === 'table' && b.kind === 'object' && b.num !== 8);
    for (const b of this.physics.balls) if (b.tags.lit) { b.tags.lit = false; b.tags.label = null; this.ballView.setTag(b, null); }
    const b = objs[Math.floor(Math.random() * objs.length)];
    e.litBall = b || null;
    if (b) { b.tags.lit = true; this.labelBall(b, 'THIS ONE', '#f0e6c8'); this.ballView.setTag(b, 0xf0e6c8); }
  },
  ownerLastGame(e) {
    e.lastGame = true;
    e.litBall = null;
    for (const b of this.physics.balls) if (b.tags.lit) { b.tags.lit = false; b.tags.label = null; this.ballView.setTag(b, null); }
    let eight = this.physics.balls.find(b => b.state === 'table' && b.num === 8 && b.kind === 'object');
    if (!eight) eight = this.spawnDropBall(8, 'object', 0.3, 0);
    this.labelBall(eight, 'LAST', '#f0e6c8');
    this.ballView.setTag(eight, 0xf0e6c8);
    e.lastPocket = Math.floor(Math.random() * 6);
    e.closed = [0, 1, 2, 3, 4, 5].filter(i => i !== e.lastPocket);
    this.blackout = false;
    this.lampTarget = 0.55;
    this.applyRules();
    this.audio.bossPhase(4);
    this.ui.bossPhase(e.def, 4, 'THE 8. THE MARKED POCKET.');
    this.ui.popup('LAST GAME', { color: '#f0e6c8', scale: 2 });
  },

  // -------------------------------------------------- hidden synergies
  synOn(id) { return hasSynergy(this, id); },
  discoverSynergy(id) {
    const s = synergyById(id);
    if (!s) return;
    const S = this.shot;
    if (S) { S.syn = S.syn || new Set(); if (S.syn.has(s.name)) return; S.syn.add(s.name); }
    if (this.run) this.run.synFound = true;
    const d = this.meta.data;
    if (!d.synergies[id]) {
      d.synergies[id] = Date.now();
      this.meta.save();
      this.ui.synergyDiscovered(s);
      this.audio.relicGet('legendary');
      this.freeze(0.08);
      this.screenFlash(0xffc21c, 0.25);
      const n = Object.keys(d.synergies).length;
      if (n >= 5) this.achieve('synergist');
      if (n >= SYNERGIES.length) this.achieve('mad_science');
    } else {
      this.ui.synergy(s.name);
      this.audio.tone(1320, { type: 'square', dur: 0.08, vol: 0.06, filter: 4000 });
      this.audio.tone(1760, { t: this.audio.now + 0.07, type: 'square', dur: 0.12, vol: 0.06, filter: 4000 });
    }
    for (const r of s.relics || []) for (const k of r.split('|')) this.ui.pulseRelic(k);
  },
  // runs before the relics for a hook (so SAFETY GLASS can insure first)
  synPre(name, S) {
    if (name === 'scratch' && S && this.synOn('safety_glass')) {
      const e = this.enc;
      if (e && e.insured && !e.insured2 && !S.insured) { e.insured2 = true; S.insured = true; S.chips += 5; this.discoverSynergy('safety_glass'); }
    }
  },
  // runs after every relic has had its turn
  synPost(name, ...args) {
    const S = this.shot;
    if (!this.run || !S || S.house) return;
    if (name === 'cushion') {
      const [, ball, v] = args;
      if (v > 2.2 && (S.railguns || 0) < 2 && this.synOn('railgun')) {
        S.railguns = (S.railguns || 0) + 1;
        this.later(0.02, () => this.thunder(ball, 1));
        this.discoverSynergy('railgun');
      }
    } else if (name === 'firstHit') {
      const [, ball] = args;
      if (Math.abs(S.side || 0) >= 0.5 && this.synOn('orbital_strike')) {
        this.later(0.03, () => this.explode(ball.x, ball.z, 0.3, 2.1, ball));
        this.discoverSynergy('orbital_strike');
      }
    } else if (name === 'pot') {
      const [, pot] = args;
      if (pot.ball.kind === 'golden' && this.synOn('solid_gold')) { S.chips += 10; this.discoverSynergy('solid_gold'); }
      if (pot.ball.num === 7) { if (this.enc) this.enc.sank7 = true; }
    } else if (name === 'shotEnd') {
      const pots = S.pots.filter(p => !p.house && p.ball.kind !== 'cue');
      if (!pots.length) return;
      if (this.synOn('bad_decisions')) { S.multX *= 1.5; this.discoverSynergy('bad_decisions'); }
      if (S.cueCushionFirst > 0 && S.firstHit && this.synOn('kick_drum')) { S.mult += 2; S.chips += 3; this.discoverSynergy('kick_drum'); }
      if (S.ghosted && this.synOn('ghost_protocol')) { S.multX *= 2; if (this.enc) this.enc.ghostCharges = (this.enc.ghostCharges || 0) + 1; this.discoverSynergy('ghost_protocol'); }
      const longs = pots.filter(p => p.ball.travel >= 1.2).length;
      if (longs && this.synOn('slow_burn')) { this.run.streak += longs; S.mult += 0.25 * this.run.streak; this.discoverSynergy('slow_burn'); }
      if (S.centered && longs && this.synOn('dead_reckoning')) { S.multX *= 2; this.run.style = Math.min(100, (this.run.style || 0) + 20); this.discoverSynergy('dead_reckoning'); }
    }
  },

  // ------------------------------------------------------- overcharge
  overcharge(r) {
    const o = OVERCHARGES[r.id];
    if (!o) return;
    this.run.over = { id: r.id };
    this.achieve('overcharged');
    this.audio.relicGet('legendary');
    this.audio.zap();
    this.screenFlash(0xa0e8ff, 0.4);
    this.ui.toast(o.name, '#a0e8ff', `${r.name} OVERCHARGED`);
    this.ui.updateHUD(true);
    this.saveRun();
  },
  overHook(name, ...args) {
    const o = this.run?.over;
    if (!o || !this.hasRelic(o.id)) return;
    const S = this.shot, id = o.id;
    if (name === 'mods') {
      const P = args[0];
      if (id === 'moon_gravity') { P.muRoll *= 0.5; P.muSlide *= 0.8; }
    } else if (name === 'pockets') {
      const pk = args[0];
      if (id === 'bucket_pockets') for (const p of pk) p.scale *= 1.5;
      if (id === 'magnet_pocket') for (const p of pk) p.pull += 1.4;
    }
    if (!S || S.house) return;
    if (name === 'shotStart') {
      if (id === 'heavy_cue') S.speed *= 1.35;
      if (id === 'moon_gravity') S.longX = 5;
    } else if (name === 'firstHit') {
      const [, ball] = args;
      if (id === 'explosive_chalk') this.explode(ball.x, ball.z, 0.5, 3.2, ball);
      if (id === 'thunder_cue') this.thunder(ball, 7);
    } else if (name === 'cushion') {
      const [, ball] = args;
      if (id === 'ricochet' && ball.kind === 'cue' && (S.pinGod || 0) < 6) { S.pinGod = (S.pinGod || 0) + 1; ball.vx *= 1.2; ball.vz *= 1.2; }
    } else if (name === 'ballHit') {
      const [, a, b, v] = args;
      if (id === 'nitro' && v > 1.2 && (S.melt || 0) < 8) { S.melt = (S.melt || 0) + 1; this.explode((a.x + b.x) / 2, (a.z + b.z) / 2, 0.16, 1.1, null); }
    } else if (name === 'pot') {
      const [, pot] = args;
      if (id === 'piggy_bank') S.chips += 4;
      if (id === 'deadeye' && pot.ball.travel >= 1.2) { S.lines.push(['SNIPER', 1500]); S.sniper = true; }
    } else if (name === 'shotEnd') {
      const pots = S.pots.filter(p => !p.house && p.ball.kind !== 'cue');
      if (!pots.length) return;
      if (id === 'heavy_cue' && S.power >= 0.95) S.multX *= 2;
      if (id === 'hot_streak') S.mult += 0.5 * (this.run.streak || 0);
      if (id === 'trickster') S.mult += 0.5 * S.cushionHits;
      if (id === 'deadeye' && S.sniper) S.multX *= 2;
    }
  },

  // ------------------------------------------------ table damage, crowd
  // a big moment leaves marks on the room (all of it reset between tables)
  chaosHit(level = 1, x = 0, z = 0) {
    const k = Math.min(1, level);
    this.table.sway += 0.3 + k * 0.6;
    this.flicker = Math.max(this.flicker || 0, 0.25 + k * 0.5);
    this.renderer.fx.glitch = Math.max(this.renderer.fx.glitch, 0.12 + k * 0.25);
    this.glitchDecay = true;
    this.room.shakeProps?.(0.4 + k);
    this.fx.dust?.(x, z, 10 + Math.round(k * 24));
    if (level >= 1.4) this.fx.scar?.(x, z, 'crack', 0.08 + Math.random() * 0.05);
  },
  crowdMood() {
    const run = this.run, e = this.enc;
    if (!run || !e) return 'calm';
    if (run.after) return 'gone';
    if (this.quiet) return 'quiet';
    if ((e.def.id !== 'blitz' && e.shots <= 1) || e.lastGame || (e.rivalDef && e.rivalScore >= e.goal - 1)) return 'tense';
    if ((run.streak || 0) >= 3 || (run.style || 0) >= 68) return 'hype';
    return 'calm';
  },
  comment(kind, force = false) {
    if (this.meta.s.commentary === false || this.run?.mode === 'rajis' && !force) return;
    if (!force && this.time - (this.lastComment ?? -99) < 6) return;
    this.lastComment = this.time;
    this.ui.comment(commentLine(kind));
  },

  // ------------------------------------------------ shot of the run
  recTick(S) {
    if (!S || S.house || this.replaying) return;
    S.recT = (S.recT || 0) + 1;
    if (!S.rec) S.rec = { balls: this.physics.balls.map(b => ({ id: b.id, num: b.num, kind: b.kind, r: b.r })), frames: [] };
    if (S.rec.frames.length > 600) return;
    const f = [];
    for (const b of this.physics.balls) {
      if (!S.rec.balls.some(x => x.id === b.id)) S.rec.balls.push({ id: b.id, num: b.num, kind: b.kind, r: b.r });
      f.push(b.id, Math.round(b.x * 1000) / 1000, Math.round(b.z * 1000) / 1000, b.state === 'table' ? Math.round(b.y * 1000) / 1000 : -1);
    }
    S.rec.frames.push(f);
  },
  recKeep(S, total, A, npots) {
    if (!S.rec || !this.run) return;
    if (total < (this.bestRec?.total || 0) || total <= 0) return;
    const techs = A.T.filter(t => t[2] > 0).map(t => t[0]);
    this.bestRec = {
      rec: S.rec, total, balls: npots, cushions: S.cushionHits, techs: techs.slice(0, 4),
      label: this.run.stats.bestShotLabel || 'POT', table: this.enc?.anomaly?.name || this.enc?.def.name || '', floor: this.run.floor,
    };
  },

  // ------------------------------------------------------ run history
  pushHistory(won, grade) {
    const run = this.run, d = this.meta.data;
    const entry = {
      at: Date.now(), mode: run.mode, won: !!won, score: run.score, floor: run.floor, grade: grade || 'D',
      heat: run.heatMax || 0, time: Math.round(run.time || 0), relics: run.relics.map(r => r.id).slice(0, 12),
      build: buildName(run.relics, run.seed) || '', after: !!run.after, bosses: run.stats.bosses || 0, breakLv: run.breakLv || 0,
      best: run.stats.bestShot || 0, bestLabel: run.stats.bestShotLabel || '', hand: run.hand || [],
    };
    d.runHistory = [entry, ...(d.runHistory || [])].slice(0, 10);
    d.stats.finished = (d.stats.finished || 0) + 1;
    this.meta.stat('finished', 0).forEach(a => this.ui.achievement(d, a.id));
  },

  // ------------------------------------------------------ extra modes
  // BOSS RUSH floors: three bosses a floor, a shop in the middle
  bossRushFloor(n) {
    const run = this.run;
    const all = run.rushOrder;
    const out = [];
    const chunk = all.slice((n - 1) * 3, n * 3);
    chunk.forEach((b, i) => { out.push({ type: 'boss', boss: b }); if (i === 0) out.push({ type: 'shop' }); });
    return out;
  },
  chaosStart() {
    const run = this.run;
    const got = withSeed([run.seed, 'chaos-relics'], () => rollRelics(3, [], { rarityBoost: 1.2 }));
    got.forEach(r => this.gainRelic(r, true));
    run.heatPts = 55;
    run.heat = 3;
    run.heatMax = 3;
  },
  handicapApply(S) {
    const h = this.run?.hand;
    if (!h?.length || !S || S.house) return;
    if (h.includes('speed')) S.speed *= 1.45;
  },

  // ------------------------------------------- AFTERHOURS (the secret act)
  afterhoursEligible() {
    const run = this.run;
    if (!run || run.endless || !['standard', 'daily'].includes(run.mode) || run.after) return false;
    return (run.heatMax || 0) >= 3 || run.saw0377 || run.synFound;
  },
  enterAfterhours() {
    const run = this.run, d = this.meta.data;
    run.houseBeaten = true;
    run.after = true;
    run.floor = 4;
    run.node = -1;
    run.themeId = 'afterhours';
    run.tstate = null;
    run.contract = null;
    run.nodes = [{ type: 'table' }, { type: 'event' }, { type: 'elite' }, { type: 'boss', boss: 'owner' }];
    d.afterhours.found = true;
    this.achieve('afterhours');
    this.meta.save();
    this.saveRun();
    this.ui.showHUD(false);
    this.audio.playMusic('none');
    this.ui.afterhoursIntro(() => {
      this.floorTheme();
      this.ui.showHUD(true);
      this.advance();
    });
  },
};

// the hidden synergy for EVENT HORIZON lives with the black-hole relic; this
// replaces its old announcement with a discovery
export function patchRelicsForSynergies(G) {
  const bh = relicById('black_hole');
  if (bh && !bh.patched) {
    bh.patched = true;
    bh.pot = function (G2, S) {
      if (S.pots.length !== 2) return;
      const i = Math.floor(Math.random() * 6);
      G2.blackHole = { i, t: 5, pull: G2.hasRelic('magnet_pocket') };
      if (G2.blackHole.pull) G2.discoverSynergy('event_horizon');
      G2.popText('BLACK HOLE', '#9a4bff', 1.2);
      G2.audio.whoosh(2);
    };
  }
}

export { NON_BOSS_KINDS, RING };
