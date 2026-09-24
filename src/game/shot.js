// Shot flow: charging → cue thrust → strike → simulation (physics events,
// relic effects, juice) → resolve (scoring tally, objective progress).

import * as THREE from 'three';
import { TABLE, PHYS, ballColor } from '../config.js';
import { objectiveInfo, invalidPot, gainText } from './objectives.js';
import { analyzeShot, heatFromSkill, styleAfterShot, styleGrade, STYLE_GRADES, STYLE_MULT, STYLE_COL, heatLevel, ROMAN, reactionWord } from './mastery.js';

const R = TABLE.R;

export const ShotMixin = {
  newShot(house = false) {
    return {
      house, power: 0, speed: 0, angle: 0, side: 0, top: 0, spinMul: 1,
      firstHit: null, cueCushionFirst: 0, cueCushions: 0, cushionHits: 0, cueContacts: new Set(), cutDeg: 0,
      pots: [], counted: 0, scratch: false, eight: false, forbidden: [], devoured: [],
      explosions: 0, zaps: 0, bumpers: 0, golds: 0,
      lines: [], mult: 1, multX: 1, chips: 0,
      doubleTap: 0, nuke: false, bigPockets: false, isBreak: false,
      simTime: 0, settle: 0,
    };
  },

  relicHook(name, ...args) {
    if (!this.run) return;
    const S = this.shot;
    const sig = () => S ? `${S.lines.length}|${S.chips}|${S.mult}|${S.multX}|${S.speed}|${S.explosions}|${S.angle}|${S.spinMul}|${S.doubleTap}` : '';
    this.synPre(name, ...args);
    for (const r of this.run.relics) {
      if (!r[name] || this.relicOff(r.id)) continue;
      const before = sig();
      r[name](this, ...args);
      if (S && sig() !== before && !['mods', 'pockets'].includes(name)) this.ui.pulseRelic(r.id);
    }
    if (this.chaosRule && this.chaosRule[name] && ['shotStart', 'shotEnd'].includes(name)) this.chaosRule[name](this, ...args);
    if (name === 'shotStart' || name === 'pot') this.stateHook(name, ...args);
    this.synPost(name, ...args);
    this.overHook(name, ...args);
    if (name === 'shotStart') this.handicapApply(S);
  },

  // ----------------------------------------------------------- firing
  fireShot() {
    const cue = this.physics.cue;
    const e = this.enc;
    const S = this.newShot(false);
    S.power = this.charge;
    S.angle = this.displayAngle();
    S.speed = PHYS.minShotSpeed + (PHYS.maxShotSpeed - PHYS.minShotSpeed) * Math.pow(S.power, 1.55);
    S.side = this.spin.x; S.top = this.spin.y;
    S.isBreak = e && e.shotsTaken === 0 && e.layout === 'triangle';
    S.quick = this.time - (this.aimStart ?? this.time) < 4;
    if (this.armed?.nuke) { S.nuke = true; this.armed.nuke = false; }
    if (this.armed?.big) { S.bigPockets = true; this.armed.big = false; }
    if (this.armed?.guide) this.armed.guide = false;
    if (this.ghostArmed && e && e.ghostCharges > 0) { cue.ghost = 1; e.ghostCharges--; this.ghostArmed = false; }
    this.shot = S;
    this.applyRules();
    this.relicHook('shotStart', S);
    e?.stake?.shotStart?.(this, S);
    if (e) { e.shots--; e.shotsTaken++; }
    const tbl = this.run?.inTable;
    if (e && tbl) { tbl.left = e.shots; if (e.def.id === 'blitz') tbl.timer = e.timer; this.saveRun(); }
    if (e?.challenge?.start) this.challengeCheck(e.challenge.start(this, e, S));
    if (e?.stake?.start) this.stakeCheck(e.stake.start(this, e, S));
    // snapshot for REWIND
    this.snapshot = this.physics.balls.map(b => ({ b, x: b.x, z: b.z, state: b.state }));
    for (const b of this.physics.balls) b.resetShotStats();
    this.startThrust(S);
    this.tutorialShot = true;
    this.ui.onShot();
  },

  fireHouseShot() {
    const cue = this.physics.cue;
    const targets = this.physics.balls.filter(b => b.state === 'table' && b.kind !== 'cue');
    if (!cue || cue.state !== 'table' || !targets.length) { this.beginAim(); return; }
    // the House likes easy pots: pick the target ball nearest a pocket
    let best = targets[0], bd = 1e9;
    for (const t of targets) for (const p of this.physics.pockets) {
      if (!p.open) continue;
      const d = Math.hypot(t.x - p.x, t.z - p.z) + Math.random() * 0.4;
      if (d < bd) { bd = d; best = t; }
    }
    const S = this.newShot(true);
    S.angle = Math.atan2(best.z - cue.z, best.x - cue.x) + (Math.random() - 0.5) * 0.06;
    S.power = 0.55 + Math.random() * 0.3;
    S.speed = PHYS.minShotSpeed + (PHYS.maxShotSpeed - PHYS.minShotSpeed) * Math.pow(S.power, 1.55);
    S.top = (Math.random() - 0.5) * 0.6;
    this.shot = S;
    this.aimAngle = S.angle;
    for (const b of this.physics.balls) b.resetShotStats();
    this.cue.mesh.material.uniforms.uColor.value.set(0xff3040);
    this.cue.mesh.material.uniforms.uEmissive.value.set(0x801020);
    this.startThrust(S);
  },

  startThrust(S) {
    this.state = 'shooting';
    this.thrustT = 0;
    this.thrustFrom = S.house ? 0.2 : 0.02 + this.charge * 0.24;
    this.charge = 0;
    this.cue.visible = true;
    if (this.mode !== 'classic') this.audio.whoosh(0.3 + S.power * 0.7);
  },

  updateThrust(dt) {
    const S = this.shot;
    const cue = this.physics.cue;
    const dur = 0.085 - S.power * 0.03;
    this.thrustT += dt;
    const k = Math.min(1, this.thrustT / dur);
    const pull = this.thrustFrom * (1 - k * k) - 0.004 * k;
    this.cue.place(cue.x, cue.z, S.angle, pull, 0.09 + S.top * 0.04);
    if (this.mode === 'classic') {
      this.camMode = this.classic.match?.isBreak ? 'charge' : 'aim';
      if (k >= 1) this.classic.strike();
      return;
    }
    this.camMode = S.house ? 'watch' : 'charge';
    if (k >= 1) this.strike();
  },

  strike() {
    const S = this.shot;
    const cue = this.physics.cue;
    const dx = Math.cos(S.angle), dz = Math.sin(S.angle);
    const sm = Math.min(1.8, S.spinMul);
    this.physics.strike(cue, dx, dz, S.speed, S.side * sm, S.top * sm);
    this.state = S.house ? 'house' : 'sim';
    this.cueFollow = 0.22;
    const p = S.power;
    // juice
    if (p > 0.45) this.freeze(0.02 + p * 0.05);
    this.shake(0.05 + p * p * 0.35);
    this.bump(-dx, -dz, 0.015 + p * 0.03);
    this.fovPunch = p * 0.8;
    this.audio.cueStrike(p);
    this.ballView.flash(cue, 0.5 + p * 0.5);
    this.fx.spray(cue.x - dx * R, 0.03, cue.z - dz * R, -dx, -dz, 0x4aa8ff, 6 + Math.floor(p * 14), 0.5 + p, 1.2, { life: 0.6, grav: 1.5 });
    if (p > 0.8) {
      this.fx.burst(cue.x, 0.03, cue.z, [0xffffff, 0xffe23b], 16, 1.8, { life: 0.35 });
      this.screenFlash(0xffffff, 0.12);
      this.table.sway += 0.25;
    }
    // shot trails (the loadout's TRAIL slot); they only draw while balls are fast
    this.startTrails(S.house);
    if (S.doubleTap) {
      this.later(0.35, () => {
        if (cue.state !== 'table') return;
        const sp = S.speed * S.doubleTap;
        this.physics.impulse(cue, dx * sp, dz * sp);
        this.audio.cueStrike(0.5);
        this.fx.burst(cue.x, 0.03, cue.z, 0xffe23b, 14, 1.2);
        this.ui.worldPop('DOUBLE TAP', this.worldPos(cue.x, cue.z, 0.08), '#ffe23b');
        this.shake(0.12);
      }, true);
    }
    if (S.house) {
      this.later(0.4, () => {
        const m = this.cue.mesh.material.uniforms;
        m.uColor.value.set(0xffffff); m.uEmissive.value.setScalar(this.cue.baseEmit || 0);
      });
    }
  },

  // ----------------------------------------------------------- simulation
  simTick(dt) {
    const S = this.shot;
    if (!S) return;
    S.simTime += dt;
    S.recAcc = (S.recAcc || 0) + dt;
    if (S.recAcc >= 1 / 30) { S.recAcc = 0; this.recTick(S); }
    if (this.blackHole) {
      this.blackHole.t -= dt;
      const p = this.physics.pockets[this.blackHole.i];
      if (this.blackHole.t <= 0) { this.blackHole = null; this.applyRules(); }
      else if (p.open) p.scale = Math.max(p.scale, 2.8);
    }
    const busy = this.timers.some(t => t.block);
    if (!this.physics.isMoving() && !busy) {
      S.settle += dt;
      if (S.settle > 0.25) this.resolveShot();
    } else S.settle = 0;
    // safety valve for runaway tables
    if (S.simTime > 22) {
      for (const b of this.physics.balls) { b.vx = b.vz = 0; b.wx = b.wy = b.wz = 0; }
    }
    this.trailTick(dt);
    if (this.enc?.feverXL) this.physics.pockets.forEach((p, i) => { if (p.open) p.scale = 1.4 + Math.sin(this.time * 1.3 + i * 1.7) * 0.8; });
    // music reacts to table speed
    const sp = this.physics.maxSpeed();
    this.audio.setIntensity(Math.min(1, 0.55 + sp * 0.12 + (this.enc?.def.boss ? 0.3 : 0)));
  },

  onPhysics(type, a, b, c, d, e) {
    const S = this.shot;
    if (type === 'ballBall') {
      const rel = c, x = d, z = e;
      this.audio.clack(rel, x);
      if (!S) return;
      const cueHit = a.kind === 'cue' ? b : b.kind === 'cue' ? a : null;
      if (cueHit) S.cueContacts.add(cueHit.id);
      if (cueHit && !S.firstHit) {
        S.firstHit = cueHit;
        const cue = a.kind === 'cue' ? a : b;
        const nx = cueHit.x - cue.x, nz = cueHit.z - cue.z, nl = Math.hypot(nx, nz) || 1;
        const dot = Math.abs(Math.cos(S.angle) * nx / nl + Math.sin(S.angle) * nz / nl);
        S.cutDeg = Math.acos(Math.min(1, dot)) * 180 / Math.PI;
        if (S.isBreak && !S.house) this.breakBurst(cueHit, S.power);
        if (!S.house) {
          this.relicHook('firstHit', S, cueHit);
          if (S.nuke) { S.nuke = false; this.explode(cueHit.x, cueHit.z, 0.42, 2.8, cueHit); }
        }
        this.ballView.flash(cueHit, 0.6);
      }
      if (!S.house) this.relicHook('ballHit', S, a, b, rel);
      this.enc?.def.onBallHit?.(this, a, b, rel);
      if (rel > 0.9) {
        const n = Math.min(14, Math.floor(rel * 3));
        this.fx.burst(x, 0.035, z, [0xffffff, 0xfff0a0], n, 0.4 + rel * 0.25, { life: 0.25, size: 1, grav: 2 });
      }
      if (rel > 2.4) { this.shake(0.05 + rel * 0.02); this.fx.ring(x, z, 0xffffff, 0.08 + rel * 0.02, 0.2, 0.03); }
      if (rel > 3.8) this.freeze(0.025);
    } else if (type === 'cushion') {
      const ball = a, sp = b;
      this.audio.rail(sp, ball.x);
      if (sp > 0.9) this.fx.burst(c, 0.02, d, this.theme.cushion, Math.floor(sp * 3), 0.35, { life: 0.4, size: 1 });
      if (!S) return;
      S.cushionHits++;
      if (ball.kind === 'cue') { S.cueCushions++; if (!S.firstHit) S.cueCushionFirst++; }
      if (!S.house) this.relicHook('cushion', S, ball, sp);
    } else if (type === 'pocket') {
      this.handlePot(a, b, c);
    } else if (type === 'spit') {
      this.audio.tone(70, { type: 'sawtooth', dur: 0.5, vol: 0.35, slide: 40, filter: 500 });
      this.audio.noise({ dur: 0.3, vol: 0.3, type: 'lowpass', freq: 800 });
      this.fx.burst(b.x, 0.03, b.z, [0xff2030, 0x400000], 30, 1.4);
      this.shake(0.3);
      this.ui.worldPop('SPAT OUT!', this.worldPos(b.x, b.z, 0.1), '#ff3040');
    } else if (type === 'ghost') {
      if (S) S.ghosted = true;
      this.meta.achieve('ghost') && this.ui.achievement(this.meta.data, 'ghost');
      this.fx.burst(a.x, 0.03, a.z, [0xffffff, 0xa0e0ff], 20, 0.8, { life: 0.5 });
      this.audio.tone(900, { type: 'sine', dur: 0.4, vol: 0.12, slide: 300, verb: 0.6 });
      this.ui.worldPop('GHOST!', this.worldPos(a.x, a.z, 0.1), '#a0e0ff');
    } else if (type === 'obstacle') {
      const ball = a, o = b, sp = c;
      if (o.kind === 'bumper') {
        if (this.hasRelic('pinball')) ball.bumped = true; else ball.relicMoved = true;
        this.audio.bumper();
        this.ballView.popObstacle(o);
        this.fx.burst(o.x, 0.04, o.z, [0xff2bd6, 0xffffff], 12, 0.8);
        this.lights.flash(this.worldPos(o.x, o.z, 0.2), 0xff2bd6, 1.0, 1.5, 0.2);
        if (S && !S.house) { S.bumpers++; S.lines.push(['BUMPER', 150]); this.ui.worldPop('+150', this.worldPos(o.x, o.z, 0.1), '#ff2bd6'); }
      } else {
        if (o.wall) ball.walled = true;
        this.audio.rail(sp * 1.2, ball.x);
        this.fx.burst(ball.x, 0.03, ball.z, 0x808090, 6, 0.4, { life: 0.3 });
      }
    } else if (type === 'land') {
      if (b > 0.3) this.audio.clack(b * 0.6, a.x);
      this.fx.burst(a.x, 0.005, a.z, 0xc0c0c0, 4, 0.3, { life: 0.3, size: 1 });
    }
  },

  handlePot(b, p, sp) {
    const S = this.shot;
    const pos = this.worldPos(p.x, p.z, 0.02);
    const col = b.kind === 'golden' ? 0xffd040 : new THREE.Color(ballColor(b.num)).getHex();
    this.audio.pocket(sp, p.x);
    this.pocketFx(p, col, sp);
    this.bump(p.x - this.physics.cue?.x || 0, p.z - (this.physics.cue?.z || 0), 0.01);

    if (b.kind === 'cue') {
      if (S) { S.scratch = true; S.scratchPocket = p; }
      this.audio.scratch();
      this.ui.popup('SCRATCH!', { color: '#ff3040', scale: 1.2 });
      this.shake(0.2);
      this.screenFlash(0xff0020, 0.18);
      this.audio.groan();
      if (S && !S.house) this.relicHook('scratch', S);
      return;
    }
    if (!S) return;
    if (this.physics.params.hungry > 0) {
      this.audio.tone(140, { type: 'sawtooth', dur: 0.5, vol: 0.14, slide: 40, filter: 700 });
      this.fx.ring(p.x, p.z, 0xff2bd6, 0.45, 0.6);
    }
    const pot = { ball: b, pocket: p, bank: b.cushions > 0, kiss: !!(b.lastToucher && b.lastToucher.kind !== 'cue'), travel: b.travel, house: S.house, counted: false };
    const def = this.enc?.def;
    if (p.devour) {
      pot.devoured = true;
      S.devoured.push(b);
      S.pots.push(pot);
      this.ui.worldPop('DEVOURED', pos, '#9a4bff');
      this.ui.encFeedback('DEVOURED · DOES NOT COUNT', 'bad', 1800); S.explained = true;
      this.audio.tone(50, { type: 'sine', dur: 0.8, vol: 0.5, slide: 25 });
      return;
    }
    if (S.house) {
      S.pots.push(pot);
      this.ui.worldPop('STOLEN', pos, '#2bf0ff');
      this.audio.groan();
      return;
    }
    let counted = b.kind !== 'cue' && !b.tags.forbidden && (def?.counts ? def.counts(this, S, pot) : true);
    pot.counted = counted;
    if (b.num === 8 && b.kind === 'object') S.eight = true;
    S.pots.push(pot);
    if (counted) S.counted++;
    if (b.tags.forbidden) { S.forbidden.push(b); this.ui.popup('FORBIDDEN BALL!', { color: '#ff3040' }); this.audio.ui('deny'); }
    if (b.kind === 'golden') {
      S.golds++; S.chips += 10;
      this.ui.popup('GOLDEN!', { color: '#ffd040', scale: 1.4 });
      this.audio.coin(6);
      this.fx.burst(p.x, 0.05, p.z, [0xffd040, 0xffffff, 0xffa000], 50, 1.8, { up: 2, life: 1.0 });
      this.meta.stat('golds').forEach(a => this.ui.achievement(this.meta.data, a.id));
    }
    this.relicHook('pot', S, pot);
    if (counted) this.contractEvent('pot', pot);
    if (b.walled && counted) S.lines.push(['ARCHITECTURE', 300]);
    if (b.kind === 'bonus') { S.chips += 2; S.lines.push(['BONUS BALL', 300]); }
    if (b.tags.heavy && counted) { S.lines.push(['HEAVY POT', 500]); this.ui.popup('HEAVY!', { color: '#c0a080', scale: 1.4 }); this.shake(0.2); }
    if (p.bonus && counted) {
      S.lines.push(['BONUS POCKET', 300]); S.mult += 1; S.chips += 1;
      this.ui.worldPop('BONUS x2', pos, '#ffd040', 1.2);
      this.audio.coin(3);
    }
    if (p.mark === 'hi' && counted) { S.dealerHi = (S.dealerHi || 0) + 1; this.ui.worldPop('HIGH CARD', pos, '#ffd040', 1.2); this.audio.coin(4); }
    if (p.mark === 'bad' && counted) { pot.counted = false; S.counted--; S.dealerBad = (S.dealerBad || 0) + 1; this.ui.worldPop('BUSTED', pos, '#ff3040', 1.2); this.audio.groan(); counted = false; }
    // a pot that does not count says why, right above the bar
    if (!counted && this.enc && !this.enc.done) { const why = invalidPot(this, this.enc, S, pot); if (why) { this.ui.encFeedback(why, 'bad', 1900); S.explained = true; } }
    else if (counted) this.audio.countBlip?.();
    if (b.tags.giant) { S.lines.push(['GIANT POT', 1500]); this.ui.popup('GIANT!', { color: '#ff8a1b', scale: 1.6 }); }
    if (this.enc?.challenge?.pot) this.challengeCheck(this.enc.challenge.pot(this, this.enc, S, pot));
    if (this.enc?.stake?.pot) this.stakeCheck(this.enc.stake.pot(this, this.enc, S, pot));

    const k = S.pots.filter(q => !q.house && !q.devoured).length;
    this.freeze(0.03 + Math.min(0.04, sp * 0.01));
    this.audio.potJingle(k);
    let label = counted ? (this.run?.mode === 'rajis' ? 'TARGET DESTROYED' : '+100') : 'NO COUNT';
    if (pot.bank && counted) label = 'BANK!';
    if (pot.kiss && counted) label = 'CAROM!';
    this.ui.worldPop(label, pos, counted ? '#ffffff' : '#808090');
    this.shake(0.06 + k * 0.05);
    this.meta.stat('pots');
    this.run.stats.pots++;
    this.achieve('first_blood');
    if (pot.bank) this.meta.stat('banks').forEach(a => this.ui.achievement(this.meta.data, a.id));
    if (counted && b.cushions >= 3) this.achieve('geometry');
    if (k === 2) {
      this.slowmo(0.3, 0.8);
      this.ui.popup('DOUBLE!', { color: '#2bf0ff', scale: 1.6 });
      this.audio.combo(1);
      this.screenFlash(0x2bf0ff, 0.15);
      this.room.cheerNow(0.4);
      this.audio.crowd(0.35);
    } else if (k === 3) {
      this.slowmo(0.22, 1.1);
      this.ui.popup('TRIPLE!!', { color: '#ffe23b', scale: 2.0 });
      this.audio.combo(3);
      this.audio.bigHit(1);
      this.screenFlash(0xffe23b, 0.25);
      this.room.cheerNow(1);
      this.achieve('how');
      this.table.sway += 0.6;
    } else if (k >= 4) {
      this.slowmo(0.18, 1.3);
      this.ui.popup(k >= 5 ? 'HOW?!' : 'QUAD!!!', { color: '#ff2bd6', scale: 2.4 });
      this.audio.combo(5);
      this.audio.bigHit(2);
      this.screenFlash(0xff2bd6, 0.35);
      this.room.cheerNow(1.5);
      this.table.sway += 1;
    }
    // clutch: the ball that wins the table
    const e = this.enc;
    if (e && counted && !e.done && e.progress + S.counted >= e.goal && def.id !== 'combo') {
      this.slowmo(0.35, 0.6);
    }
  },

  // ---- cosmetics: shot trails and pocket effects (the loadout decides which)
  startTrails(house = false) {
    const kind = house ? 'light' : this.trailKind || 'light';
    if (kind === 'off') return;
    const ribbon = { light: null, electric: '#6ac8ff', fire: '#ff6a18', void: '#9a4bff' };
    if (!(kind in ribbon)) return;                      // pixel / radar leave marks, not ribbons
    const skin = this.ballView.skin;
    for (const b of this.physics.balls) {
      if (b.state !== 'table') continue;
      const col = ribbon[kind] || (b.kind === 'cue' ? '#ffffff' : skin.trail || (b.kind === 'golden' ? '#ffd040' : ballColor(b.num)));
      this.fx.trail(b, col, (b.kind === 'cue' ? 0.042 : 0.032) * (kind === 'electric' ? 0.6 : 1));
    }
  },
  trailTick(dt) {
    const kind = this.trailKind;
    if (!kind || kind === 'off' || kind === 'light' || this.shot?.house) return;
    this.trailAcc = (this.trailAcc || 0) + dt;
    if (this.trailAcc < 1 / 40) return;
    this.trailAcc = 0;
    for (const b of this.physics.balls) if (b.state === 'table') this.trailMark(this.fx, kind, b);
  },
  // one tick of a trail's marks behind one ball (also used by the loadout preview)
  trailMark(fx, kind, b) {
    const sp = Math.hypot(b.vx, b.vz);
    if (sp < 1.1) return;
    // marks go down behind the ball, never on top of it
    const bx = b.x - b.vx / sp * b.r * 1.6, bz = b.z - b.vz / sp * b.r * 1.6;
    const R = Math.random;
    if (kind === 'pixel' && R() < 0.8) fx.spawn(bx, 0.02, bz, 0, 0, 0, b.kind === 'cue' ? 0xffffff : new THREE.Color(ballColor(b.num)).getHex(), 0.3, 3, { grav: 0 });
    else if (kind === 'electric' && R() < 0.25) fx.spawn(bx, 0.03, bz, (R() - 0.5) * 0.8, R() * 0.4, (R() - 0.5) * 0.8, 0xa0e8ff, 0.18, 1, { flicker: true, grav: 0 });
    else if (kind === 'fire' && R() < 0.5) fx.spawn(bx, 0.03, bz, (R() - 0.5) * 0.2, 0.3 + R() * 0.3, (R() - 0.5) * 0.2, R() < 0.5 ? 0xff6010 : 0xffc040, 0.3, 2, { grav: -0.6, drag: 3 });
    else if (kind === 'void' && R() < 0.35) fx.spawn(bx, 0.05, bz, 0, -0.08, 0, R() < 0.5 ? 0x9a4bff : 0x40ffe0, 0.45, 1, { grav: 0.1, drag: 1 });
    else if (kind === 'radar' && R() < 0.5) fx.spawn(bx, 0.004, bz, 0, 0, 0, 0x8fd14f, 0.55, 2, { grav: 0 });
  },
  pocketFx(p, col, sp) { this.pocketEffect(this.fx, this.pocketKind || 'classic', p, col, sp, true); },
  // a ball dropping, the way the loadout's POCKET FX slot says (lights only on the real table)
  pocketEffect(fx, kind, p, col, sp, lit = false) {
    const flash = (c, k = 1) => { if (lit) this.lights.flash(this.worldPos(p.x, p.z, 0.25), c, 1.4 * k, 2.2, 0.35); };
    const later = (d, fn) => (lit ? this.later(d, fn) : setTimeout(fn, d * 1000));
    if (kind === 'quiet') { fx.ring(p.x, p.z, 0xffffff, 0.12, 0.25); return; }
    if (kind === 'pixel') { fx.burst(p.x, 0.02, p.z, [col, 0xffffff], 10 + Math.floor(sp * 4), 0.7, { up: 1.2, minUp: 0.4, life: 0.5, size: 3 }); flash(col, 0.7); return; }
    if (kind === 'sparks') { fx.burst(p.x, 0.02, p.z, [0xffffff, 0xffe8a0, col], 22, 2.2, { up: 1.1, minUp: 0.3, life: 0.28, size: 1, flicker: true, grav: 5 }); flash(0xfff0c0, 0.8); return; }
    if (kind === 'neon') { fx.ring(p.x, p.z, 0xff2bd6, 0.26, 0.35); fx.ring(p.x, p.z, 0x2bf0ff, 0.18, 0.45); flash(0xff2bd6, 1.3); return; }
    if (kind === 'holo') { [0, 0.09, 0.18].forEach((d, i) => later(d, () => fx.ring(p.x, p.z, i === 1 ? 0xffffff : 0x40e8ff, 0.16 + i * 0.07, 0.45))); flash(0x40e8ff, 0.8); return; }
    if (kind === 'smoke') { for (let i = 0; i < 12; i++) fx.spawn(p.x + (Math.random() - 0.5) * 0.04, 0.02, p.z + (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.1, 0.15 + Math.random() * 0.15, (Math.random() - 0.5) * 0.1, Math.random() < 0.5 ? 0x8a8a90 : 0x5a5a60, 0.9 + Math.random() * 0.5, 3, { grav: -0.05, drag: 1.2 }); return; }
    if (kind === 'lockon') { fx.lockon(p.x, p.z); if (lit) this.audio.tone(1760, { type: 'square', dur: 0.05, vol: 0.05, filter: 5000 }); flash(0xff3b30, 0.8); return; }
    fx.burst(p.x, 0.02, p.z, [col, 0xffffff], 18 + Math.floor(sp * 8), 0.8 + sp * 0.4, { up: 1.6, minUp: 0.5, life: 0.7 });
    fx.ring(p.x, p.z, col, 0.22, 0.35);
    flash(col);
  },

  // arcade break: the rack bursts outward on a hard break
  breakBurst(hit, p) {
    const k0 = 1.1 * p * p;
    for (const q of this.physics.balls) {
      if (q.kind === 'cue' || q.state !== 'table') continue;
      const dx = q.x - hit.x + 0.08, dz = q.z - hit.z;
      const d = Math.hypot(dx, dz) || 1;
      const k = k0 * (0.4 + Math.random() * 0.6);
      q.vx += dx / d * k; q.vz += dz / d * k;
    }
    if (p > 0.6) {
      this.ui.popup('BREAK!', { color: '#ffffff', scale: 1.3 + p * 0.5 });
      this.shake(0.25 + p * 0.3);
      this.freeze(0.05);
      this.screenFlash(0xffffff, 0.2 * p);
      this.fx.ring(hit.x, hit.z, 0xffffff, 0.3, 0.3);
      this.fx.burst(hit.x, 0.03, hit.z, [0xffffff, 0xffe23b, 0x2bf0ff], 30, 1.8, { life: 0.5 });
      this.table.sway += 0.4;
      this.audio.explosion(0.5);
      this.room.cheerNow(0.3);
    }
  },

  // two relics just worked together: pulse both, call it out (once per label per shot)
  synergy(a, b, label) {
    const S = this.shot;
    if (S) { S.syn = S.syn || new Set(); if (S.syn.has(label)) return; S.syn.add(label); }
    if (a) this.ui.pulseRelic(a);
    if (b) this.ui.pulseRelic(b);
    this.ui.synergy(label);
    this.audio.tone(1320, { type: 'square', dur: 0.08, vol: 0.06, filter: 4000 });
    this.audio.tone(1760, { t: this.audio.now + 0.07, type: 'square', dur: 0.12, vol: 0.06, filter: 4000 });
  },

  achieve(id) {
    const a = this.meta.achieve(id);
    if (a) this.ui.achievement(this.meta.data, id);
  },

  // --------------------------------------------------------- relic FX
  explode(x, z, radius, strength, source) {
    const S = this.shot;
    if (this.enc?.tstate?.id === 'lowgrav') { radius *= 1.3; strength *= 1.5; }
    if (S && !S.house && (S.afterburns || 0) < 2 && this.synOn('afterburn')) {
      S.afterburns = (S.afterburns || 0) + 1;
      this.later(0.24, () => { if (this.shot === S) { this.explode(x, z, radius * 1.35, strength * 0.55, null); this.discoverSynergy('afterburn'); } });
    }
    this.fx.scar?.(x, z, 'scorch', radius * 0.7);
    if (strength > 2) this.chaosHit(1 + (strength - 2) * 0.4, x, z);
    if (S) {
      S.explosions++;
      S.lines.push(['EXPLOSION', 150]);
      if (S.explosions >= 3) this.achieve('nuclear');
    }
    for (const b of this.physics.balls) {
      if (b.state !== 'table' || b === source) continue;
      const dx = b.x - x, dz = b.z - z;
      const d = Math.hypot(dx, dz) || 1e-4;
      if (d > radius + R) continue;
      const f = strength * Math.sqrt(1 - d / (radius + R));
      b.vx += dx / d * f; b.vz += dz / d * f;
      b.relicMoved = true;
      b.vy = Math.max(b.vy, 0.5 * f); b.y = Math.max(b.y, 0.001);
    }
    if (source) { source.vy = 0.9; source.y = 0.001; }
    const big = strength > 2;
    this.fx.burst(x, 0.04, z, [0xffffff, 0xffe23b, 0xff8a1b, 0xff3040], big ? 90 : 45, big ? 2.6 : 1.8, { up: 1.5, life: 0.7, size: 2 });
    this.fx.burst(x, 0.04, z, [0x404040, 0x202020], 16, 0.6, { up: 1, life: 1.2, grav: -0.3, drag: 2 });
    this.fx.ring(x, z, 0xffa040, radius * 1.7, 0.35);
    this.fx.ring(x, z, 0xffffff, radius * 1.1, 0.2);
    this.lights.flash(this.worldPos(x, z, 0.25), 0xff8030, big ? 1.6 : 1.1, big ? 2.2 : 1.5, 0.45);
    this.screenFlash(0xffb060, big ? 0.3 : 0.14);
    this.shake(big ? 0.7 : 0.4);
    this.freeze(big ? 0.09 : 0.05);
    this.fovPunch = 1.2;
    this.table.sway += 0.5;
    this.audio.explosion(big ? 1.6 : 1);
    this.ui.worldPop(big ? 'NUKE!!' : 'BOOM!', this.worldPos(x, z, 0.12), '#ff8a1b', 1.4);
    // synergy: explosions arc lightning when you also hold THUNDER CUE
    if (S && this.hasRelic('thunder_cue') && (S.arcs || 0) < 2) {
      S.arcs = (S.arcs || 0) + 1;
      const near = this.physics.balls.filter(b => b.state === 'table' && b.kind !== 'cue').sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
      if (near) { this.later(0.05, () => this.thunder(near, 2)); this.synergy('explosive_chalk', 'thunder_cue', 'THUNDERCLAP'); }
    }
  },

  thunder(src, n = 4) {
    const S = this.shot;
    this.ui.pulseRelic('thunder_cue');
    const cand = this.physics.balls.filter(b => b.state === 'table' && b.kind !== 'cue' && b !== src)
      .sort((a, b) => Math.hypot(a.x - src.x, a.z - src.z) - Math.hypot(b.x - src.x, b.z - src.z)).slice(0, n);
    let prev = src;
    cand.forEach((b, i) => {
      this.later(i * 0.06, () => {
        this.fx.lightning(prev.x, prev.z, b.x, b.z, 0xa0e8ff);
        const dx = b.x - prev.x, dz = b.z - prev.z, d = Math.hypot(dx, dz) || 1;
        b.vx += dx / d * 0.9; b.vz += dz / d * 0.9;
        b.relicMoved = true;
        this.ballView.flash(b, 1);
        this.lights.flash(this.worldPos(b.x, b.z, 0.15), 0x80d0ff, 1.2, 2.5, 0.2);
        this.audio.zap();
        if (S) { S.zaps++; S.lines.push(['ZAP', 100]); }
        prev = b;
      }, true);
    });
    this.screenFlash(0xa0e8ff, 0.2);
    this.shake(0.2);
  },

  // ------------------------------------------------------------ resolve
  resolveShot() {
    const S = this.shot;
    const e = this.enc;
    if (this.runEnding || this.state === 'runend') { this.shot = null; return; }
    if (!S || !e) { this.beginAim(); return; }
    this.shot = null;
    for (const b of this.physics.balls) { b.vx = b.vz = 0; b.wx = b.wy = b.wz = 0; }
    const def = e.def;
    const playerPots = S.pots.filter(p => !p.house && !p.devoured);

    // REWIND: undo a blank shot
    if (!S.house && playerPots.length === 0 && (e.rewinds || 0) > 0 && e.shots >= 0) {
      e.rewinds--;
      for (const s of this.snapshot) { s.b.x = s.x; s.b.z = s.z; s.b.state = s.state; s.b.y = 0; s.b.vy = 0; s.b.ghost = 0; }
      this.physics.balls = this.physics.balls.filter(b => this.snapshot.some(s => s.b === b));
      e.shots++;
      this.renderer.grade.desat = 1;
      this.audio.tone(800, { type: 'sawtooth', dur: 0.6, vol: 0.08, slide: 100, filter: 2000 });
      this.ui.popup('REWIND', { color: '#2bf0ff', scale: 1.4 });
      this.beginAim();
      return;
    }

    if (S.house) { this.resolveHouse(S); return; }

    this.relicHook('shotEnd', S);
    def.shotEnd?.(this, S, e);

    // ---- progress
    let delta = def.progress ? def.progress(this, S, e) : S.counted;
    if (e.book) delta += this.bookieSettle(e, S);
    if (def.rajisProgress) delta = def.rajisProgress(this, S, e, delta);
    let won = e.progress + delta >= e.goal;
    let eightFinish = false;
    if (S.eight && !def.classic) {
      if (!won) {
        const eightPot = S.pots.find(p => p.ball.num === 8 && p.ball.kind === 'object');
        if (eightPot?.counted) {
          eightPot.counted = false; S.counted--;
          delta = def.progress ? def.progress(this, S, e) : S.counted;
        }
        S.lines.push(['EARLY EIGHT', -300]);
        this.audio.fail();
        this.ui.showTip('eight');
        if (e.mods?.some(m => m.danger8)) {
          this.ui.popup('DANGEROUS 8!  -1 HEART', { color: '#ff3040', scale: 1.4 });
          this.loseHeart('DANGEROUS 8', true);
          if (this.run.hearts <= 0) { this.shot = null; this.after(1.0, () => this.endRun(false)); return; }
        } else {
          e.shots = Math.max(0, e.shots - 2);
          this.ui.popup('EARLY EIGHT!', { color: '#ff3040', scale: 1.2 });
          this.ui.encFeedback('THE 8 WENT DOWN EARLY · -2 SHOTS · IT COMES BACK', 'bad', 2600);
        }
        S.explained = true;
        this.later(0.4, () => this.spawnDropBall(8, 'object', TABLE.footX, 0));
      } else eightFinish = true;
    }
    if (def.classic && S.eight && !won) {
      e.shots = Math.max(0, e.shots - 3);
      S.lines.push(['EARLY EIGHT', -300]);
      this.ui.popup('EARLY EIGHT!', { color: '#ff3040', scale: 1.2 });
      this.ui.encFeedback('THE 8 BEFORE THE SOLIDS · -3 SHOTS · IT COMES BACK', 'bad', 2600);
      S.explained = true;
      this.later(0.4, () => this.spawnDropBall(8, 'object', TABLE.footX, 0));
    }
    if (def.cap && delta > def.cap) {
      delta = def.cap;
      this.ui.encFeedback(`ONLY ${def.cap} POTS COUNT PER SHOT HERE`, 'warn', 2200);
    }
    const before = e.progress;
    e.progress = Math.max(0, e.progress + delta);
    won = e.progress >= e.goal;

    // forbidden balls (assassin)
    if (S.forbidden.length) {
      e.shots = Math.max(0, e.shots - 2 * S.forbidden.length);
      S.lines.push(['FORBIDDEN', -250 * S.forbidden.length]);
      S.forbidden.forEach((b, i) => this.later(0.4 + i * 0.2, () => { const nb = this.spawnDropBall(b.num, 'object'); nb.tags.forbidden = true; this.ballView.setTag(nb, 0xff2030, true); }));
    }
    if (def.id === 'assassin' && !won && S.pots.some(p => p.counted)) this.later(0.3, () => this.markAssassin(true));

    // devoured (void) balls come back somewhere
    S.devoured.forEach((b, i) => { if (b.kind === 'object') this.later(0.3 + i * 0.2, () => this.spawnDropBall(b.num, 'object')); });

    // ---- scoring: base pots + recognised technique + effects
    const L = [];
    const pots = playerPots.filter(p => p.ball.kind !== 'cue');
    const npots = pots.length;
    const A = analyzeShot(this, S, e);
    this.stateHook('shotEnd', S, A, e);
    if (npots) {
      const base = pots.reduce((s, p) => s + (p.ball.kind === 'golden' ? 500 : p.ball.num === 8 ? 250 : 100), 0);
      L.push([npots > 1 ? `POT x${npots}` : 'POT', base]);
      for (const [label, pts] of A.T) L.push([label, pts]);
      if (npots === 2) L.push(['DOUBLE POT', 500]);
      else if (npots === 3) L.push(['COMBO x3', 1200]);
      else if (npots === 4) L.push(['QUAD COMBO', 2500]);
      else if (npots >= 5) L.push(['HOW?!', 5000]);
      if (S.cueCushionFirst > 0 && S.firstHit) this.achieve('trick');
      if (S.isBreak) { L.push(['BREAK', 300 * npots]); if (npots >= 3) this.achieve('break_master'); }
      if (S.golds) L.push(['GOLDEN BALL', 1000 * S.golds]);
    }
    if (eightFinish) { L.push(['8-BALL FINISH', 800]); S.multX *= 2; this.achieve('call_it'); if (this.run.eightBet) { S.chips += 25; this.run.eightBet = false; } }
    // relic / effect lines (merge duplicates)
    const merged = {};
    for (const [k, v] of S.lines) { merged[k] = merged[k] || [0, 0]; merged[k][0] += v; merged[k][1]++; }
    for (const [k, [v, n]] of Object.entries(merged)) L.push([n > 1 && v > 0 ? `${k} x${n}` : k, v]);
    if (Object.keys(merged).length >= 5) this.achieve('what');
    this.run.stats.mostTriggers = Math.max(this.run.stats.mostTriggers || 0, Object.keys(merged).length);
    for (const p of pots) if (p.bank && p.counted) this.run.stats.longestBank = Math.max(this.run.stats.longestBank || 0, p.ball.cushions);
    if (S.isBreak && npots >= 2) this.achieve('clean_break');
    if (npots >= 3 && (S.explosions || S.zaps || pots.some(p => p.kiss))) this.achieve('domino');
    if (S.scratch) L.push(['SCRATCH', -200]);

    // streak
    const potted = npots > 0 && (!S.scratch || S.insured);
    if (potted) this.run.streak++; else this.run.streak = 0;
    this.run.stats.maxStreak = Math.max(this.run.stats.maxStreak || 0, this.run.streak);
    this.run.stats.mostBalls = Math.max(this.run.stats.mostBalls || 0, npots);
    if (!potted) { e.misses++; this.run.stats.misses = (this.run.stats.misses || 0) + 1; }
    this.contractEvent('shot', potted);
    if (this.run.streak >= 2) S.mult += 0.25 * (this.run.streak - 1);

    // the headline technique gets its own popup; truly exceptional shots get the works
    // (first, so style/heat announcements queue up behind the reaction instead of piling on it)
    const headline = A.T.filter(t => t[2] >= 3).sort((a, b) => b[2] - a[2])[0];
    if (A.skill >= 9 || (npots >= 3 && A.skill >= 4)) { this.exceptionalShot(A); this.later(1.5, () => this.comment('great')); }
    else if (headline) this.ui.popup(headline[0] + '!', { color: '#2bf0ff', scale: 1.25 });
    if (npots >= 3) this.comment('combo');
    else if (A.cats.has('bank') && Math.random() < 0.35) this.comment('bank');
    else if (won && e.shots <= 0 && e.def.id !== 'blitz') this.comment('clutch');
    else if (S.scratch && Math.random() < 0.4) this.comment('scratch');

    // STYLE: rewards interesting shots, fades with misses and repetition
    const run = this.run;
    const gBefore = styleGrade(run.style);
    const styleBefore = run.style;
    run.style = styleAfterShot(run, potted, A.skill, S.scratch && !S.insured && !this.hasRelic('cashback'));
    if (this.hasRelic('blind_faith') && run.style > styleBefore) run.style = Math.min(100, run.style + (run.style - styleBefore) * 0.5);
    const gAfter = styleGrade(run.style);
    run.stylePeak = Math.max(run.stylePeak || 0, gAfter);
    S.multX *= STYLE_MULT[gAfter];
    if (potted && gAfter >= 4) S.chips += gAfter - 3;
    if (gAfter > gBefore) this.styleUp(gAfter);
    else if (gAfter < gBefore) this.ui.styleDrop(gAfter);

    // HEAT: only real technique heats the run up
    if (potted && A.skill > 1) this.addHeat(heatFromSkill(A.skill));
    S.multX *= 1 + 0.15 * (run.heat || 0);
    // aim assist handicap bonus
    const aimLvl = e.challenge?.id === 'noguide' || e.stake?.id === 'noguide' || this.hasRelic('blind_faith') || this.run.hand?.includes('noguide') ? 'none' : this.meta.s.aim;
    if (aimLvl === 'reduced') S.multX *= 1.05;
    else if (aimLvl === 'minimal') S.multX *= 1.15;
    else if (aimLvl === 'none') S.multX *= 1.25;

    const sum = L.reduce((s, l) => s + l[1], 0);
    const mult = S.mult * S.multX * (this.run.rewardMul || 1);
    const total = Math.max(0, Math.round(sum * mult));
    this.run.score += total;
    e.score = (e.score || 0) + total;
    if (total > this.run.stats.bestShot) {
      this.run.stats.bestShot = total;
      const top = A.T.filter(t => t[2] > 0).sort((a, b) => b[1] - a[1])[0];
      this.run.stats.bestShotLabel = top ? top[0] : npots > 1 ? `${npots}-BALL POT` : 'POT';
    }
    if (total >= 5000) this.achieve('mega');
    if (L.length) this.ui.tally(L, total, mult, this.run.streak);
    this.recKeep(S, total, A, npots);


    // chips
    S.chips += Math.min(3, pots.filter(p => p.counted).length);
    if (e.tstate?.chipsMul && S.chips > 0) S.chips = Math.round(S.chips * e.tstate.chipsMul);
    if (S.chips > 0) { this.addChips(S.chips); this.ui.chipGain(S.chips); }

    // big-shot celebration
    if (total >= 2000) {
      this.after(0.5, () => { this.audio.bigHit(Math.min(3, Math.floor(total / 2000))); this.room.cheerNow(1.2); this.shake(0.4); });
    } else if (npots >= 1) this.room.cheerNow(0.15 + gAfter * 0.08);

    // scratch penalty (INSURANCE covers the first one on each table)
    if (S.scratch) {
      if (!S.insured) this.contractEvent('scratch');
      this.meta.stat('scratches').forEach(a => this.ui.achievement(this.meta.data, a.id));
      this.run.stats.scratches = (this.run.stats.scratches || 0) + 1;
      e.scratches = (e.scratches || 0) + 1;
      if (e.scratches >= 3) this.achieve('why');
      const cost = S.insured ? 0 : e.mods?.some(m => m.scratchCost) ? 3 : 1;
      if (!won) e.shots = Math.max(0, e.shots - cost);
      const left = won || def.id === 'blitz' || this.run.oneCue ? '' : e.shots === 1 ? ' · FINAL SHOT NEXT' : ` · ${e.shots} SHOTS LEFT`;
      this.ui.encFeedback(cost ? `SCRATCH · -${cost} SHOT${cost > 1 ? 'S' : ''}${left}` : 'SCRATCH · INSURED · NO SHOT LOST', cost ? 'bad' : 'info', 2300);
      if (e.challenge?.scratch) this.challengeCheck(e.challenge.scratch(this, e, S));
      if (e.stake?.scratch) this.stakeCheck(e.stake.scratch(this, e, S));
    }
    if (e.challenge?.shot) this.challengeCheck(e.challenge.shot(this, e, S, potted));
    if (e.stake?.shot) this.stakeCheck(e.stake.shot(this, e, S, potted));

    // ONE CUE: a miss (or a scratch) costs a life, never a shot
    if (this.run.oneCue && !won && (!potted || (S.scratch && !S.insured)) && def.id !== 'blitz') {
      this.later(0.3, () => this.ui.popup(S.scratch ? 'SCRATCH  -1 LIFE' : 'MISS  -1 LIFE', { color: '#ff3b5c', scale: 1.3 }));
      this.loseHeart('ONE CUE', true);
      if (this.run.hearts <= 0) { this.saveRun(); this.after(1.2, () => this.endRun(false)); return; }
    }

    this.shotFeedback(S, e, e.progress - before, npots);
    this.ui.updateHUD(true);

    // THE CLOCK: trick shots buy time back
    if (def.id === 'clock' && potted && (A.skill >= 2 || S.cueCushionFirst > 0)) { e.clockBank = (e.clockBank || 0) + 4; this.ui.popup('+4 SECONDS', { color: '#ff8a1b', scale: 1.2 }); }
    // THE DEALER, phase III: busting costs a shot
    if (def.id === 'dealer' && S.dealerBad && (e.phase >= 3 || e.bossPlus)) { e.shots = Math.max(0, e.shots - 1); this.ui.popup('BUST  -1 SHOT', { color: '#ff3040' }); }
    // boss phases
    if (def.boss && !won) {
      const ph = e.progress >= Math.ceil(e.goal * 2 / 3) ? 3 : e.progress >= Math.ceil(e.goal / 3) ? 2 : 1;
      if (ph > (e.phase || 1)) { e.phase = ph; this.bossPhase(ph); }
    }

    // RIVALS: they take their turn after yours
    if (e.rivalDef && !e.rivalDef.mirror && !won && !e.stakeBroken) {
      this.rivalTurn(e);
      if (e.rivalScore >= e.goal) { this.saveRun(); this.after(0.8, () => this.failEncounter(`${e.rivalDef.name} WINS`)); this.state = 'result'; return; }
    }

    // the save follows the table shot by shot (penalties and refunds included)
    const tbl = this.run?.inTable;
    if (tbl) { tbl.left = e.shots; tbl.chBroken = e.chBroken || null; if (def.id === 'blitz') tbl.timer = e.timer; this.saveRun(); }

    // ---- end conditions
    if (e.stakeBroken) { this.failEncounter('STAKE BROKEN'); return; }
    if (won) { this.winEncounter(); return; }
    if (def.id === 'blitz' ? e.timer <= 0 : e.shots <= 0) { this.failEncounter(def.id === 'blitz' ? 'TIME UP' : e.puzzle ? 'OUT OF ATTEMPTS' : 'OUT OF SHOTS'); return; }

    def.afterShot?.(this, e, S);
    for (const m of e.mods || []) m.afterShot?.(this, e, S);
    e.anomaly?.afterShot?.(this, e, S);
    this.stateHook('afterShot', e, S);
    if (e.inferno) this.rollChaos();
    if (e.puzzle) { this.beginAim(); return; }
    this.ensureBalls();
    // some tables take a turn of their own (missiles, the car, the tank)
    if (def.enemyTurn?.(this, e, S)) return;

    // THE HOUSE plays after your misses — and, as it gets angrier, after your pots too
    if (def.house && potted) e.housePots = (e.housePots || 0) + 1;
    const houseEvery = [0, 0, 3, 2][Math.min(3, (e.phase || 1) + (e.bossPlus ? 1 : 0))];
    if (def.house && (!potted || (houseEvery && e.housePots % houseEvery === 0))) {
      this.after(0.6, () => this.houseTurn(S.scratch));
      this.state = 'houseWait';
      return;
    }
    if (S.scratch) this.after(0.5, () => this.beginPlace());
    else this.beginAim();
  },

  // what that shot did for the objective, in words (feedback line above the bar)
  shotFeedback(S, e, gained, npots) {
    const ui = this.ui, def = e.def;
    if (e.done) return;
    const o = objectiveInfo(this, e);
    const quiet = def.id === 'blitz' || this.run.oneCue || e.kind === 'trickshot';
    const left = quiet || e.progress >= e.goal ? '' : e.shots === 1 ? ' · FINAL SHOT NEXT' : e.shots <= 0 ? '' : ` · ${e.shots} SHOTS LEFT`;
    if (gained > 0) { ui.encFeedback(gainText(o, gained), 'good', 1800); return; }
    if (gained < 0) { ui.encFeedback(def.id === 'chain' ? 'NOTHING POTTED · THE CHAIN BREAKS · BACK TO 0' : def.id === 'route' ? 'MISSED THE ROUTE · THE ROUTE RESETS' : `PROGRESS LOST${left}`, 'bad', 2300); return; }
    if (S.scratch || S.explained) return;
    if (!npots) { ui.encFeedback(e.kind === 'trickshot' ? 'NOT QUITE · TRY AGAIN' : `MISS${left}`, 'bad', 1800); return; }
    if (def.id === 'trick' && S.counted > 0) { ui.encFeedback('YOUR CUE BALL NEVER HIT A CUSHION · NO COUNT', 'bad', 2400); return; }
    if (def.id === 'combo') { ui.encFeedback('ONLY 1 BALL · A COMBO NEEDS 2 OR MORE', 'bad', 2200); return; }
    if (e.kind === 'trickshot') { ui.encFeedback('NOT QUITE · TRY AGAIN', 'bad', 1800); return; }
    ui.encFeedback(`NO PROGRESS${left}`, 'bad', 1800);
  },

  houseTurn(playerScratched) {
    this.ui.popup('THE HOUSE PLAYS', { color: '#2bf0ff', scale: 1.3 });
    this.audio.tone(55, { type: 'sawtooth', dur: 0.8, vol: 0.2, filter: 400 });
    const cue = this.physics.cue;
    if (playerScratched || !cue || cue.state !== 'table') this.respawnCue();
    this.state = 'houseWait';
    this.after(1.0, () => this.fireHouseShot());
  },

  resolveHouse(S) {
    const e = this.enc;
    const stolen = S.pots.filter(p => p.ball.kind !== 'cue' && !p.devoured).length;
    if (stolen) {
      e.progress = Math.max(0, e.progress - stolen);
      this.ui.popup(`THE HOUSE STEALS ${stolen}`, { color: '#2bf0ff', scale: 1.3 });
      this.ui.encFeedback(`THE HOUSE STOLE ${stolen} · ${objectiveInfo(this, e).count}`, 'bad', 2400);
      this.audio.fail();
    } else {
      this.ui.popup('THE HOUSE MISSES', { color: '#ffffff' });
      this.audio.crowd(0.3);
    }
    // stolen eight goes back
    if (S.pots.some(p => p.ball.num === 8)) this.later(0.3, () => this.spawnDropBall(8, 'object', TABLE.footX, 0));
    this.ui.updateHUD(true);
    this.ensureBalls();
    if (S.scratch) {
      this.ui.popup('HOUSE SCRATCH — BALL IN HAND', { color: '#2bf0ff' });
      this.after(0.5, () => this.beginPlace());
    } else this.beginAim();
  },

  // -------------------------------------------------------- aim / place
  beginAim() {
    if (this.runEnding || !this.enc || this.enc.done) return;
    // a boss that just changed phase holds the table for a moment
    if (this.enc.holdUntil && this.time < this.enc.holdUntil) {
      this.state = 'hold';
      this.cue.visible = false;
      const wait = this.enc.holdUntil - this.time;
      this.enc.holdUntil = 0;
      this.after(wait, () => this.beginAim());
      return;
    }
    this.state = 'aim';
    this.charge = 0;
    this.aimStart = this.time;
    this.applyRules();
    this.room.setMood?.(this.crowdMood());
    this.enc.def.beforeAim?.(this, this.enc);
    const cue = this.physics.cue;
    if (!cue || cue.state !== 'table') { this.beginPlace(); return; }
    this.cue.visible = true;
    this.pointAim();
    this.audio.setIntensity(this.enc?.def.boss ? 0.9 : 0.55);
    const e = this.enc;
    if (e.def.id !== 'blitz' && e.shots === 1 && !e.lastShotWarned && !this.run?.oneCue) {
      e.lastShotWarned = true;
      this.ui.encFeedback(e.kind === 'trickshot' ? 'LAST ATTEMPT' : 'FINAL SHOT · MAKE IT COUNT', 'bad', 2400);
      this.audio.heartbeat();
      this.audio.setIntensity(1);
    }
    this.ui.updateHUD(true);
    this.ui.onAim();
  },

  respawnCue() {
    let cue = this.physics.cue;
    const spot = this.physics.findFreeSpot(TABLE.headX, 0, cue);
    if (!cue) cue = this.physics.addBall(0, spot.x, spot.z);
    cue.state = 'table'; cue.x = spot.x; cue.z = spot.z; cue.y = 0; cue.vy = 0; cue.vx = cue.vz = 0; cue.fall = null; cue.ghost = 0;
    return cue;
  },

  beginPlace() {
    this.respawnCue();
    this.state = 'place';
    this.cue.visible = false;
    this.camMode = 'place';
    this.ui.onPlace();
    this.applyRules();
  },

  updatePlace() {
    const cue = this.physics.cue;
    const p = this.tablePoint();
    this.cue.visible = false;
    this.camMode = 'place';
    this.aim.hide();
    if (!p || !cue) return;
    const { L, W } = TABLE;
    const x = Math.max(-L + R + 0.005, Math.min(L - R - 0.005, p.x));
    const z = Math.max(-W + R + 0.005, Math.min(W - R - 0.005, p.z));
    this.placeValid = this.physics.isFree(x, z, 0.002, cue);
    if (this.placeValid) { cue.x = x; cue.z = z; }
    this.ballView.flash(cue, this.placeValid ? 0.15 + Math.sin(this.time * 8) * 0.1 : 0.6);
  },

  tryPlaceCue() {
    if (!this.placeValid) { this.audio.ui('deny'); return; }
    this.audio.clack(0.8);
    this.beginAim();
  },

  // ------------------------------------------------------------ abilities
  toggleGhost() {
    const e = this.enc;
    if (!e || !(e.ghostCharges > 0)) { this.audio.ui('deny'); return; }
    this.ghostArmed = !this.ghostArmed;
    const cue = this.physics.cue;
    if (cue) cue.ghost = this.ghostArmed ? 1 : 0;
    this.audio.tone(this.ghostArmed ? 900 : 400, { type: 'sine', dur: 0.25, vol: 0.12, verb: 0.5 });
    this.ui.updateHUD(true);
  },

  useItem(i) {
    const it = this.run?.items[i];
    if (!it) return;
    this.armed = this.armed || {};
    if (it.id === 'extra_shot') { this.enc.shots++; this.ui.popup('+1 SHOT', { color: '#2bf0ff' }); }
    else if (it.id === 'big_pockets') { this.armed.big = true; this.ui.popup('GIANT POCKETS ARMED', { color: '#9a4bff' }); }
    else if (it.id === 'nuke') { this.armed.nuke = true; this.ui.popup('NUKE ARMED', { color: '#ff8a1b' }); }
    else if (it.id === 'guide') { this.armed.guide = true; this.ui.popup('GUIDE LINE', { color: '#2bf0ff' }); }
    else if (it.id === 'rerack') { this.rerackRemaining(); }
    this.run.items.splice(i, 1);
    this.audio.ui('select');
    this.applyRules();
    this.ui.updateHUD(true);
  },
};
