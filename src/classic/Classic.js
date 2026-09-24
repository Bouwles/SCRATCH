// SCRATCH CLASSIC — normal 8-ball, played straight.
// Shares the physics, cue, camera and ball rendering with the roguelite, and
// replaces everything else: the room, the rules, the sound, the interface.

import * as THREE from 'three';
import { TABLE, PHYS } from '../config.js';
import { shared } from '../render/materials.js';
import { envTexture } from '../render/textures.js';
import { Lounge } from './Lounge.js';
import { ClassicAim } from './aim.js';
import { ClassicUI } from './ClassicUI.js';
import { FELTS, LIGHTS, CUES, byId, tableTheme, ballSkin, cueSkin } from './look.js';
import { evaluate, groupOf, otherGroup, legalTargets, SOLIDS, STRIPES } from './rules.js';
import { plan, execute, LEVELS, STYLES, powerForSpeed, BREAK_SPEED } from './ai.js';

// the four-player house tournament: you and three regulars
const REGULARS = [
  { name: 'Marguerite', style: 'positional' }, { name: 'Ossie', style: 'aggressive' }, { name: 'Deacon', style: 'cautious' },
  { name: 'Juno', style: 'trickster' }, { name: 'Rafe', style: 'aggressive' }, { name: 'Ilse', style: 'positional' },
  { name: 'Tobias', style: 'cautious' }, { name: 'Nell', style: 'balanced' },
];
const STRENGTH = { easy: 1, normal: 2, hard: 3, expert: 4 };

const R = TABLE.R;

// believable table: a touch more roll, softer crawl, rails a hair livelier
export const CLASSIC_PHYS = { muSlide: 0.2, muRoll: 0.0165, muSpin: 0.045, cushionRest: 0.78, cushionFric: 0.2, ballRest: 0.95, crawl: 7 };
const QUALITY = { low: 0.55, medium: 0.75, high: 'auto' };

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class Classic {
  constructor(game) {
    this.g = game;
    this.lounge = new Lounge(game.lights);
    this.aim = new ClassicAim(game.table.group);
    this.ui = new ClassicUI(game, this);
    this.match = null;
    this.paused = false;
    this.ai = null;
    this.rec = null;
  }

  get data() { return this.g.meta.data.classic; }
  get s() { return this.data.settings; }
  get active() { return this.g.mode === 'classic'; }

  // ============================================================ world
  mount() {
    const g = this.g;
    g.mode = 'classic';
    g.theme = null;                          // the club gets rebuilt on the way back
    g.room.group.visible = false;
    g.scene.add(this.lounge.group);
    g.setGraphicsStyle(true);
    document.documentElement.classList.remove('modern');
    document.documentElement.classList.add('classic');
    g.clearTableFx();
    g.tint = null;
    g.lampTarget = 1; g.accentTarget = 1;
    g.lights.master = 1;
    const P = g.physics;
    P.resetParams();
    Object.assign(P.params, CLASSIC_PHYS);
    P.forces = [];
    P.obstacles = [];
    for (const p of P.pockets) { p.open = true; p.scale = 1; p.pull = 0; p.gravity = 0; p.spit = false; p.devour = false; p.hungry = 0; p.bonus = false; p.mark = null; }
    P.buildSegments();
    g.ballView.syncObstacles();
    this.applyRender();                      // modern path first, so new materials are built for it
    this.applyLook(true);
    g.camStyle = this.s.camera === 'top' ? 'top' : 'cinematic';
    g.audio.loops(true);
    g.audio.setAmbience(this.s.ambience);
    this.menuTable();
    g.camMode = 'lounge';
    this.ui.show(true);
  }

  unmount() {
    const g = this.g;
    this.match = null;
    this.ai = null;
    this.paused = false;
    this.aim.hide(); this.aim.hidePlace(); this.aim.showHead(false);
    this.ui.closeAll();
    this.ui.hud(false);
    this.ui.show(false);
    g.scene.remove(this.lounge.group);
    this.lounge.dispose();
    g.room.group.visible = true;
    g.table.lampGroup.visible = true;
    document.documentElement.classList.remove('classic');
    const Rr = g.renderer;
    delete Rr.settings.vignette; delete Rr.settings.bloomThreshold;
    Rr.configure({ msaa: true });
    Rr.grade.desat = 0;
    g.ballView.castShadows = true;
    g.lampTarget = 1; g.accentTarget = 1;
    for (let i = 7; i < 10; i++) g.lights.clear(i);    // the club's flash slots
    g.audio.loops(false);
    g.physics.resetParams();
    g.physics.clearBalls();
    g.mode = 'rogue';
    g.theme = null;
    g.applySettings();
    document.documentElement.classList.toggle('modern', g.meta.s.gfx === 'modern');
    g.applyCosmetics();
    g.camStyle = g.meta.s.camera === 'top' ? 'top' : 'cinematic';
  }

  // felt, cue, balls and lighting from the appearance choices
  applyLook(rebuildRoom = false) {
    const g = this.g, d = this.data.look;
    const light = byId(LIGHTS, d.light);
    g.table.build(tableTheme(d.felt));
    g.table.lampGroup.visible = false;
    if (rebuildRoom || !this.lounge.group.children.length || this.lounge.roomId !== (d.room || 'lounge')) this.lounge.build(light, d.room || 'lounge');
    else this.lounge.setLighting(light);
    shared.uAmbient.value.setRGB(...light.ambient);
    shared.uSky.value.setRGB(...light.sky);
    shared.uGround.value.setRGB(...light.ground);
    shared.uFogColor.value.setRGB(...light.fog);
    shared.uFogNear.value = 7; shared.uFogFar.value = 20;
    g.scene.background = new THREE.Color().setRGB(...light.fog);
    shared.uEnvMap.value?.dispose();
    shared.uEnvMap.value = envTexture({ env: ['#2a2018', '#4a3626', '#2a1c14'], lamp: '#fff0d8', neon: ['#c8a060', '#8a6a40'], felt: byId(FELTS, d.felt).felt });
    g.ballView.setSkin(ballSkin(d.balls));
    const cue = CUES.find(c => c.id === d.cue);
    const cueOk = !cue?.ach || g.meta.data.achievements[cue.ach] || g.state === 'cmenu';
    g.cue.setSkin(cueSkin(cueOk ? d.cue : 'wood'));
    const G = g.renderer.grade;
    G.lift.set(0.008, 0.006, 0.004); G.gain.set(1.03, 1.0, 0.96); G.sat = 1.04; G.desat = 0;
    g.envDirty = true;
  }

  applyRender() {
    const g = this.g, s = this.s, Rr = g.renderer;
    Object.assign(Rr.settings, { crt: false, ca: 0, grain: 0.006, bloom: 0.42, jitter: 0, vignette: 0.28, bloomThreshold: 0.74 });
    Rr.configure({ mode: 'modern', resScale: QUALITY[s.quality] ?? 'auto', msaa: !!s.aa });
    g.ballView.castShadows = !!s.shadows;
    if (!s.reflections) shared.uHasCube.value = 0; else g.envDirty = true;
    const A = g.audio;
    A.vol.master = g.meta.s.master ?? 0.8; A.vol.music = s.music; A.vol.sfx = s.sfx;
    A.applyVolumes();
    A.setAmbience(!!s.ambience);
    this.aim.level = s.aim;
    this.ui.scale();
    g.ui.scale();
  }

  save() { this.g.meta.save(); }

  // ============================================================ menus
  menuTable() {
    const g = this.g, P = g.physics;
    P.clearBalls();
    g.ballView.prune();
    // a frame in progress, left mid-game
    P.addBall(0, -0.42, 0.18);
    const spots = [[0.35, -0.12, 1], [0.62, 0.2, 9], [-0.1, -0.3, 3], [0.8, -0.35, 8], [0.15, 0.28, 12], [-0.55, -0.2, 6], [0.46, 0.05, 14]];
    for (const [x, z, n] of spots) P.addBall(n, x, z);
  }

  toMenu() {
    const g = this.g;
    this.match = null; this.ai = null; this.paused = false;
    g.lampTarget = 1; g.accentTarget = 1;
    g.renderer.grade.desat = 0;
    if (g.audio.music) g.audio.music.mood = null;
    this.aim.hide(); this.aim.hidePlace(); this.aim.showHead(false);
    g.cue.visible = false;
    this.ui.hud(false);
    this.menuTable();
    g.state = 'cmenu';
    g.camMode = 'lounge';
    g.audio.playMusic('lounge');
    this.ui.menu();
  }

  // ============================================================ matches
  aiName(level, style = 'balanced') {
    const lv = `${LEVELS[level].name[0]}${LEVELS[level].name.slice(1).toLowerCase()} AI`;
    return style && style !== 'balanced' ? `${lv} · ${STYLES[style].name}` : lv;
  }

  startMatch(cfg) {
    const g = this.g;
    this.cfg = cfg;
    const cue = CUES.find(c => c.id === this.data.look.cue);
    if (cue?.ach && !g.meta.data.achievements[cue.ach]) { this.data.look.cue = 'wood'; this.save(); g.cue.setSkin(cueSkin('wood')); }
    const players = cfg.type === 'ai'
      ? [{ name: cfg.names[0] || 'Player', ai: false }, { name: cfg.oppName || this.aiName(cfg.level, cfg.style), ai: true, style: cfg.style || 'balanced' }]
      : cfg.type === 'local' ? [{ name: cfg.names[0] || 'Player 1', ai: false }, { name: cfg.names[1] || 'Player 2', ai: false }]
      : [{ name: 'Practice', ai: false }];
    this.match = {
      type: cfg.type, level: cfg.level || 'normal', bestOf: cfg.bestOf || 1, clock: cfg.type === 'practice' ? 0 : cfg.clock || 0,
      players: players.map(p => ({ ...p, group: null })), wins: [0, 0], frame: 0, breaker: 0, turn: 0,
      inHand: false, kitchen: false, isBreak: false, layout: 'rack', tourney: cfg.tourney || null, visit: 0, clockLeft: 0,
    };
    this.paused = false;
    this.ui.closeAll();
    g.lampTarget = 1; g.accentTarget = 1;
    if (g.audio.music) g.audio.music.mood = null;
    g.state = 'cmenu';
    g.cue.visible = false;
    if (cfg.type === 'practice') {
      this.ui.hud(true);
      this.practiceRack('rack');
      return;
    }
    g.camMode = 'intro';
    g.physics.clearBalls();
    g.ballView.prune();
    this.ui.matchIntro(this.match, () => this.startFrame());
  }

  rematch() { if (this.cfg?.tourney) { this.toMenu(); return; } this.startMatch(this.cfg); }

  startFrame() {
    const g = this.g, m = this.match;
    m.frame++;
    m.players.forEach(p => { p.group = null; });
    m.turn = m.breaker;
    m.isBreak = true; m.inHand = true; m.kitchen = true;
    m.breakRun = true; m.breakerNow = m.breaker;
    this.rack();
    g.spin.x = 0; g.spin.y = 0;
    g.power = 1;
    g.camMode = 'intro';
    this.ui.hud(true);
    this.ui.updateHUD();
    g.after(1.0, () => {
      if (this.match !== m) return;
      this.ui.banner(`${m.players[m.turn].name} to break`);
      this.beginTurn();
    });
  }

  // standard triangle: 8 in the middle, a solid and a stripe in the back corners
  rack() {
    const g = this.g, P = g.physics;
    P.clearBalls();
    g.ballView.prune();
    const gap = 0.0003;
    const dx = (2 * R + gap) * Math.cos(Math.PI / 6), dz = 2 * R + gap;
    const slots = [];
    for (let r = 0; r < 5; r++) for (let i = 0; i <= r; i++) slots.push([TABLE.footX + r * dx, (i - r / 2) * dz]);
    const solids = shuffle([...SOLIDS]), stripes = shuffle([...STRIPES]);
    const order = new Array(15).fill(null);
    order[4] = 8;
    const sFirst = Math.random() < 0.5;
    order[10] = sFirst ? solids.pop() : stripes.pop();
    order[14] = sFirst ? stripes.pop() : solids.pop();
    const rest = shuffle([...solids, ...stripes]);
    for (let i = 0; i < 15; i++) if (order[i] == null) order[i] = rest.pop();
    order.forEach((n, i) => {
      const b = P.addBall(n, slots[i][0], slots[i][1]);
      b.y = 0.06 + i * 0.005; b.vy = 0;
    });
    P.addBall(0, TABLE.headX - 0.02, 0);
    this.fullRackCount = 15;
  }

  beginTurn() {
    const g = this.g, m = this.match;
    if (!m) return;
    g.shot = null;
    this.rec = null;
    const p = m.players[m.turn];
    this.ui.updateHUD();
    const cue = g.physics.cue;
    if (!cue || cue.state !== 'table') this.respawnCue();
    this.aim.showHead(m.inHand && m.kitchen);
    m.clockLeft = m.clock;
    m.clockTick = Math.ceil(m.clock);
    if (m.type !== 'practice' && p.ai) { this.startAI(); return; }
    g.charge = 0;
    if (m.inHand && !m.isBreak) {
      g.state = 'place';
      this.dragging = false;
      this.ui.hint(m.kitchen ? 'Ball in hand behind the line · click to place' : 'Ball in hand · click to place the cue ball');
    } else {
      g.state = 'aim';
      g.pointAim();
      this.ui.hint(m.isBreak ? 'Break · drag the cue ball to move it behind the line' : this.aimHint());
    }
    g.camMode = 'aim';
  }

  aimHint() { return 'Hold click to shoot · Wheel power · WASD spin · C view'; }

  respawnCue() {
    const g = this.g, P = g.physics, m = this.match;
    let cue = P.cue;
    const spot = P.findFreeSpot(TABLE.headX - 0.02, 0, cue);
    if (!cue) cue = P.addBall(0, spot.x, spot.z);
    Object.assign(cue, { state: 'table', x: spot.x, z: spot.z, y: 0, vy: 0, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0, fall: null, ghost: 0 });
    if (m) m.inHand = true;
    return cue;
  }

  // ---------------------------------------------------- human input
  isHumanTurn() {
    const m = this.match;
    return !!m && (m.type === 'practice' || !m.players[m.turn].ai);
  }

  onPrimaryDown() {
    const g = this.g, m = this.match;
    if (this.ui.modalOpen() || this.paused || !this.isHumanTurn()) return;
    if (g.state === 'place') {
      if (this.placeValid) this.confirmPlace();
      else g.audio.cUi('deny');
    } else if (g.state === 'aim') {
      const p = g.tablePoint(), cue = g.physics.cue;
      if (m.inHand && p && cue && Math.hypot(p.x - cue.x, p.z - cue.z) < R * 2.4) {
        g.state = 'place';
        this.dragging = true;
        return;
      }
      g.state = 'charge';
      g.charge = 0;
    }
  }

  onPrimaryUp() {
    const g = this.g;
    if (g.state === 'place' && this.dragging) {
      this.dragging = false;
      if (this.placeValid) this.confirmPlace();
      return;
    }
    if (g.state === 'charge') {
      if (this.paused || this.ui.modalOpen()) { g.state = 'aim'; g.charge = 0; return; }
      if (g.charge < 0.03) { g.state = 'aim'; g.charge = 0; return; }
      this.fireHuman();
    }
  }

  confirmPlace() {
    const g = this.g, m = this.match;
    g.audio.cClack(0.5);
    this.aim.hidePlace();
    g.state = 'aim';
    g.pointAim();
    this.ui.hint(m.isBreak ? 'Break · drag the cue ball to move it behind the line' : 'Drag the cue ball to move it again · ' + this.aimHint());
  }

  updatePlace() {
    const g = this.g, m = this.match, cue = g.physics.cue;
    g.cue.visible = false;
    this.aim.hide();
    const p = g.tablePoint();
    if (!p || !cue) return;
    const { L, W } = TABLE;
    let x = Math.max(-L + R + 0.004, Math.min(L - R - 0.004, p.x));
    const z = Math.max(-W + R + 0.004, Math.min(W - R - 0.004, p.z));
    const kitchenOk = !m.kitchen || x <= TABLE.headX;
    const valid = kitchenOk && g.physics.isFree(x, z, 0.002, cue);
    this.placeValid = valid;
    if (valid) { cue.x = x; cue.z = z; }
    this.aim.showPlace(valid ? cue.x : x, valid ? cue.z : z, valid, g.time);
    g.camMode = 'aim';
  }

  // called by Game.updateState while aiming / charging
  showAim(cue, dx, dz, pred) {
    const m = this.match;
    if (!m || !this.isHumanTurn()) { this.aim.hide(); return; }
    let warn = false;
    if (m.type !== 'practice' && pred.type === 'ball' && !m.isBreak) {
      const on = this.onTableSet();
      warn = !legalTargets(m.players[m.turn].group, on).includes(pred.ball.num);
    }
    this.aim.show(cue.x, cue.z, dx, dz, pred, warn);
    if (m.inHand) this.aim.showPlace(cue.x, cue.z, true, this.g.time); else this.aim.hidePlace();
  }

  aimCamMode() {
    const g = this.g, m = this.match;
    return g.state === 'charge' && m?.isBreak ? 'charge' : 'aim';
  }

  onTableSet() { return new Set(this.g.physics.balls.filter(b => b.state === 'table' && b.kind !== 'cue').map(b => b.num)); }

  fireHuman() {
    const g = this.g;
    const power = g.charge;
    const max = this.match.isBreak ? BREAK_SPEED : PHYS.maxShotSpeed;
    this.beginShot({ power, speed: PHYS.minShotSpeed + (max - PHYS.minShotSpeed) * Math.pow(power, 1.55), angle: g.aimAngle, side: g.spin.x, top: g.spin.y });
  }

  beginShot(S) {
    const g = this.g, m = this.match;
    S.house = false; S.simTime = 0; S.settle = 0;
    this.rec = { firstHit: null, pots: [], potBalls: [], railAfter: false, rails: new Set(), isBreak: m.isBreak, power: S.power, broke: false };
    this.onTableBefore = this.onTableSet();
    this.snapshot = g.physics.balls.filter(b => b.state === 'table').map(b => ({ num: b.num, x: b.x, z: b.z }));
    for (const b of g.physics.balls) b.resetShotStats();
    m.inHand = false;
    this.aim.hide(); this.aim.hidePlace(); this.aim.showHead(false);
    this.ui.hint('');
    g.shot = S;
    g.startThrust(S);
  }

  // Game.updateThrust hands over at the moment of contact
  strike() {
    const g = this.g, S = g.shot, cue = g.physics.cue;
    const dx = Math.cos(S.angle), dz = Math.sin(S.angle);
    g.physics.strike(cue, dx, dz, S.speed, S.side, S.top);
    g.state = 'sim';
    g.cueFollow = 0.25;
    g.audio.cCue(S.power);
    if (this.rec?.isBreak) { g.fovPunch = 0.25 + S.power * 0.35; g.bump(-dx, -dz, 0.01); }
  }

  simTick(dt) {
    const g = this.g, S = g.shot;
    if (!S) return;
    S.simTime += dt;
    if (!g.physics.isMoving()) {
      S.settle += dt;
      if (S.settle > 0.3) this.resolve();
    } else S.settle = 0;
    if (S.simTime > 25) for (const b of g.physics.balls) { b.vx = b.vz = 0; b.wx = b.wy = b.wz = 0; }
    let roll = 0;
    for (const b of g.physics.balls) if (b.state === 'table') roll += Math.hypot(b.vx, b.vz);
    g.audio.setRoll(roll);
  }

  onPhysics(type, a, b, c, d) {
    const g = this.g, r = this.rec;
    const pan = (x) => Math.max(-0.8, Math.min(0.8, x * 0.6));
    if (type === 'ballBall') {
      g.audio.cClack(c, pan(d));
      if (!r) return;
      const hit = a.kind === 'cue' ? b : b.kind === 'cue' ? a : null;
      if (hit && r.firstHit == null) {
        r.firstHit = hit.num;
        if (r.isBreak && !r.broke && r.power > 0.5) {
          r.broke = true;
          g.audio.cBreak(r.power);
          g.shake(0.08 + r.power * 0.16);
          g.freeze(0.03);
          g.fovPunch = 0.6;
        }
      }
    } else if (type === 'cushion') {
      g.audio.cRail(b, pan(a.x));
      if (!r) return;
      if (r.firstHit != null) r.railAfter = true;
      if (a.kind !== 'cue') r.rails.add(a.id);
    } else if (type === 'pocket') {
      g.audio.cPocket(c, pan(b.x));
      if (!r) return;
      r.pots.push(a.kind === 'cue' ? 0 : a.num);
      r.potBalls.push(a);
    } else if (type === 'land') {
      if (b > 0.3) g.audio.cClack(Math.min(1, b) * 0.5, pan(a.x));
    }
  }

  // ---------------------------------------------------- resolve a shot
  resolve() {
    const g = this.g, m = this.match, r = this.rec;
    g.shot = null;
    g.audio.setRoll(0);
    for (const b of g.physics.balls) { b.vx = b.vz = 0; b.wx = b.wy = b.wz = 0; }
    g.spin.x = 0; g.spin.y = 0;
    if (!m || !r) return;
    this.rec = null;
    if (m.type === 'practice') { this.practiceResolve(r); return; }

    const p = m.players[m.turn], opp = m.players[1 - m.turn];
    const out = evaluate({ group: p.group, isBreak: m.isBreak, onTable: this.onTableBefore }, { firstHit: r.firstHit, pots: r.pots, railAfter: r.railAfter, breakRails: r.rails.size });
    const scratch = r.pots.includes(0);

    // statistics for the humans at the table
    if (!p.ai) {
      const st = this.data.stats;
      const own = r.potBalls.filter(b => b.kind !== 'cue');
      st.potted += own.length;
      for (const b of own) st.longest = Math.max(st.longest, Math.round(b.travel * 100) / 100);
    }

    if (out.rerack) {
      this.ui.notice('Illegal break', out.reason + ` ${opp.name} breaks.`);
      g.audio.cFoul();
      m.breaker = 1 - m.breaker;
      m.frame--;
      g.state = 'cmenu';
      g.after(2.6, () => { if (this.match === m) this.startFrame(); });
      return;
    }
    if (out.respot8) {
      const spot = g.physics.findFreeSpot(TABLE.footX, 0);
      const b8 = g.physics.addBall(8, spot.x, spot.z);
      b8.y = 0.25;
      g.ballView.prune();
      this.ui.notice('8-ball on the break', 'It comes back to the foot spot.');
    }
    if (out.win || out.lose) {
      const winner = out.win ? m.turn : 1 - m.turn;
      this.endFrame(winner, `${p.name} ${out.endReason}.`);
      return;
    }
    if (out.assign) {
      p.group = out.assign;
      opp.group = otherGroup(out.assign);
      this.ui.notice(`${p.name} · ${out.assign === 'solids' ? 'Solids' : 'Stripes'}`, `${opp.name} has ${opp.group}.`, 'soft');
    }
    const wasBreak = m.isBreak;
    m.isBreak = false;
    if (scratch) this.respawnCue();
    const before = m.turn;
    if (!p.ai) {
      const st = this.data.stats;
      if (out.foul) st.fouls = (st.fouls || 0) + 1;
      else if (out.continueTurn) { m.visit += r.potBalls.filter(b => b.kind !== 'cue').length; st.highRun = Math.max(st.highRun || 0, m.visit); }
    }
    if (out.foul) {
      m.turn = 1 - m.turn;
      m.inHand = true;
      m.kitchen = !!out.kitchen;
      if (!m.kitchen) m.kitchen = false;
      this.ui.foul(out.reason, `Ball in hand · ${m.players[m.turn].name}`);
      g.audio.cFoul();
    } else if (!out.continueTurn) {
      m.turn = 1 - m.turn;
      m.inHand = false;
    }
    if (m.turn !== before) { m.breakRun = false; m.visit = 0; }
    this.ui.updateHUD();
    const delay = out.foul ? 1.9 : wasBreak ? 0.9 : 0.55;
    g.state = 'cwait';
    g.after(delay, () => {
      if (this.match !== m) return;
      if (m.turn !== before) { this.ui.banner(`${m.players[m.turn].name}’s turn`); g.audio.cTurn(); }
      this.beginTurn();
    });
  }

  endFrame(winner, reason) {
    const g = this.g, m = this.match;
    const w = m.players[winner];
    m.wins[winner]++;
    const st = this.data.stats;
    st.frames++;
    if (!w.ai && m.type === 'ai') st.framesWon = (st.framesWon || 0) + 1;
    if (winner === m.breakerNow && m.breakRun && !w.ai) { st.breakRuns++; reason = 'Break and run.'; }
    this.save();
    this.ui.updateHUD();
    g.state = 'cwait';
    this.aim.hide();
    const need = Math.ceil(m.bestOf / 2);
    if (m.wins[winner] >= need) { g.after(1.2, () => this.endMatch(winner, reason)); return; }
    g.audio.cWin();
    g.after(0.9, () => {
      this.ui.frameResult(`${w.name} takes the frame`, reason, m.wins);
      m.breaker = 1 - m.breaker;
      g.after(3.4, () => { if (this.match === m) this.startFrame(); });
    });
  }

  endMatch(winner, reason) {
    const g = this.g, m = this.match;
    const w = m.players[winner];
    g.state = 'cend';
    g.camMode = 'end';
    g.cue.visible = false;
    this.ui.hud(false);
    g.lampTarget = 0.72; g.accentTarget = 0.45;
    g.renderer.grade.desat = 0.18;
    if (g.audio.music) g.audio.music.mood = 'end';
    g.audio.cWin();
    const st = this.data.stats;
    const earn = (id) => { const a = g.meta.achieve(id); if (a) this.ui.achievement(a.name); };
    if (m.type === 'ai') {
      st.played++;
      if (winner === 0) {
        st.won++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak);
        st.aiWins[m.level] = (st.aiWins[m.level] || 0) + 1;
        earn('classic_win');
        if (m.level === 'expert') earn('hustler');
      } else st.streak = 0;
    } else { st.localMatches++; earn('classic_win'); }
    this.save();
    if (m.tourney) { this.tourneyResult(winner === 0, reason); return; }
    this.ui.matchEnd({ title: `${w.name} wins`, reason, score: m.bestOf > 1 ? m.wins : null, players: m.players });
  }

  // ============================================================ tournament
  // four players, two semi-finals, one final. The other semi is played out of sight.
  startTourney(cfg) {
    const pool = shuffle([...REGULARS]).slice(0, 3);
    const lv = cfg.level;
    const up = { easy: 'normal', normal: 'hard', hard: 'expert', expert: 'expert' }[lv];
    const field = [
      { name: cfg.names[0] || 'Player', you: true },
      { ...pool[0], level: lv }, { ...pool[1], level: lv }, { ...pool[2], level: up },
    ];
    this.tourney = { field, round: 'semi', semis: [[0, 1], [2, 3]], winners: [null, null], champion: null, cfg };
    this.data.stats.tourneysPlayed = (this.data.stats.tourneysPlayed || 0) + 1;
    this.save();
    this.ui.bracket(this.tourney, () => this.tourneyMatch());
  }
  tourneyMatch() {
    const T = this.tourney, f = T.field;
    const oppIdx = T.round === 'semi' ? 1 : T.winners[1];
    const o = f[oppIdx];
    this.startMatch({ type: 'ai', names: [f[0].name], level: o.level, style: o.style, oppName: o.name, bestOf: T.round === 'final' ? Math.max(3, T.cfg.bestOf) : T.cfg.bestOf, clock: T.cfg.clock, tourney: T });
  }
  tourneyResult(won, reason) {
    const T = this.tourney, g = this.g;
    if (T.round === 'semi') {
      T.winners[0] = won ? 0 : 1;
      // the other semi: the stronger player usually wins, not always
      const [a, b] = T.semis[1], sa = STRENGTH[T.field[a].level], sb = STRENGTH[T.field[b].level];
      T.winners[1] = Math.random() < sa / (sa + sb) ? a : b;
      T.round = won ? 'final' : 'done';
      if (!won) { const fa = T.winners[0], fb = T.winners[1]; const s1 = STRENGTH[T.field[fa].level], s2 = STRENGTH[T.field[fb].level]; T.champion = Math.random() < s1 / (s1 + s2) ? fa : fb; }
    } else {
      T.round = 'done';
      T.champion = won ? 0 : T.winners[1];
      if (won) {
        this.data.stats.tourneys = (this.data.stats.tourneys || 0) + 1;
        const a = g.meta.achieve('tourney');
        if (a) this.ui.achievement(a.name);
      }
    }
    this.save();
    g.after(1.4, () => this.ui.bracket(T, T.round === 'final' ? () => this.tourneyMatch() : null, reason));
  }

  // ============================================================ AI
  startAI() {
    const g = this.g, m = this.match, p = m.players[m.turn];
    g.state = 'aiThink';
    g.charge = 0;
    g.cue.visible = false;
    this.ui.thinking(true);
    this.ui.hint('');
    const lv = LEVELS[m.level];
    this.ai = {
      gen: plan({ physics: g.physics, group: p.group, isBreak: m.isBreak, inHand: m.inHand, kitchen: m.kitchen, level: m.level, style: p.style }),
      t: 0, min: lv.think[0] + Math.random() * (lv.think[1] - lv.think[0]), result: null,
    };
  }

  updateAI(dt) {
    const g = this.g, A = this.ai, m = this.match;
    if (!A || !m || this.paused) return;
    const cue = g.physics.cue;
    A.t += dt;
    if (g.state === 'aiThink') {
      const t0 = performance.now();
      while (!A.result && performance.now() - t0 < 7) {
        const r = A.gen.next();
        if (r.done) A.result = r.value;
      }
      if (A.result && A.t >= A.min) {
        A.shot = execute(A.result, m.level);
        this.ui.thinking(false);
        if (A.result.cuePos) {
          A.from = { x: cue.x, z: cue.z }; A.to = A.result.cuePos; A.pt = 0;
          g.state = 'aiPlace';
        } else { g.state = 'aiAim'; A.at = 0; }
      }
      g.camMode = 'aim';
    } else if (g.state === 'aiPlace') {
      A.pt = Math.min(1, A.pt + dt / 0.55);
      const e = A.pt * A.pt * (3 - 2 * A.pt);
      cue.x = A.from.x + (A.to.x - A.from.x) * e;
      cue.z = A.from.z + (A.to.z - A.from.z) * e;
      this.aim.showPlace(cue.x, cue.z, true, g.time);
      if (A.pt >= 1) { g.audio.cClack(0.5); this.aim.hidePlace(); g.state = 'aiAim'; A.at = 0; }
      g.camMode = 'aim';
    } else if (g.state === 'aiAim') {
      A.at += dt;
      let d = A.shot.angle - g.aimAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      g.aimAngle += d * (1 - Math.exp(-dt * 5.5));
      g.spin.x += (A.shot.side - g.spin.x) * Math.min(1, dt * 4);
      g.spin.y += (A.shot.top - g.spin.y) * Math.min(1, dt * 4);
      g.cue.visible = true;
      g.cue.place(cue.x, cue.z, g.aimAngle, 0.035 + Math.sin(g.time * 3) * 0.004, 0.09 + g.spin.y * 0.04);
      if (A.at > 0.75 && Math.abs(d) < 0.0015) {
        g.aimAngle = A.shot.angle;
        g.state = 'aiCharge';
        g.charge = 0;
        A.power = powerForSpeed(A.shot.speed, m.isBreak ? BREAK_SPEED : PHYS.maxShotSpeed);
      }
      g.camMode = 'aim';
    } else if (g.state === 'aiCharge') {
      g.charge = Math.min(A.power, g.charge + dt * (0.8 + g.charge * 0.6));
      g.cue.place(cue.x, cue.z, g.aimAngle, 0.02 + g.charge * 0.24, 0.09 + g.spin.y * 0.04);
      g.camMode = m.isBreak ? 'charge' : 'aim';
      if (g.charge >= A.power - 1e-4) {
        const shot = A.shot;
        this.ai = null;
        this.beginShot({ power: A.power, speed: shot.speed, angle: shot.angle, side: shot.side, top: shot.top });
      }
    }
  }

  // ============================================================ practice
  practiceRack(layout = 'rack') {
    const g = this.g, m = this.match, P = g.physics;
    m.layout = layout;
    g.state = 'cwait';
    if (layout === 'rack') { this.rack(); }
    else {
      P.clearBalls(); g.ballView.prune();
      const put = (n, x, z) => { const b = P.addBall(n, x, z); b.y = 0.05; return b; };
      if (layout === 'banks') {
        [[1, 0.45, 0.42], [3, -0.25, -0.43], [9, 0.72, -0.3], [11, -0.72, 0.35], [5, 0.1, 0.44]].forEach(([n, x, z]) => put(n, x, z));
        put(0, -0.2, 0.05);
      } else {
        [1, 2, 3, 4, 5, 6, 7].forEach((n, i) => put(n, -0.6 + i * 0.2, (i % 2 ? 0.14 : -0.14)));
        put(0, -0.85, 0);
      }
    }
    m.inHand = true; m.kitchen = false; m.isBreak = false;
    this.snapshot = null;
    this.ui.updateHUD();
    g.camMode = 'aim';
    g.after(0.6, () => { if (this.match === m) this.beginTurn(); });
  }

  practiceResolve(r) {
    const g = this.g, m = this.match;
    const own = r.potBalls.filter(b => b.kind !== 'cue');
    const st = this.data.stats;
    st.potted += own.length;
    for (const b of own) st.longest = Math.max(st.longest, Math.round(b.travel * 100) / 100);
    if (r.pots.includes(0)) { this.respawnCue(); this.ui.notice('Scratch', 'Place the cue ball anywhere.', 'soft'); }
    this.ui.updateHUD();
    g.state = 'cwait';
    g.after(0.4, () => { if (this.match === m) this.beginTurn(); });
  }

  practiceUndo() {
    const g = this.g, m = this.match;
    if (!this.snapshot || !['aim', 'place'].includes(g.state)) { g.audio.cUi('deny'); return; }
    const P = g.physics;
    P.clearBalls(); g.ballView.prune();
    for (const s of this.snapshot) P.addBall(s.num, s.x, s.z);
    this.snapshot = null;
    m.inHand = false;
    g.audio.cUi('back');
    this.ui.notice('Shot undone', '', 'soft');
    this.beginTurn();
  }

  practiceMove() {
    const g = this.g, m = this.match;
    if (!['aim', 'place'].includes(g.state)) return;
    m.inHand = true; m.kitchen = false;
    this.beginTurn();
  }

  practiceLayout() {
    const order = ['rack', 'banks', 'spin'];
    const next = order[(order.indexOf(this.match.layout) + 1) % order.length];
    this.g.audio.cUi('select');
    this.practiceRack(next);
    this.ui.notice({ rack: 'Full rack', banks: 'Bank drill', spin: 'Cue ball control' }[next], { rack: 'Break and run it out.', banks: 'Balls on the rails: one cushion into the pocket.', spin: 'A line of balls: stun, draw and follow through.' }[next], 'soft');
  }

  // ============================================================ loop + keys
  update(dt, simDt) {
    const g = this.g;
    this.lounge.update(dt, g.camera, ['lounge', 'showcase', 'intro', 'end'].includes(g.camMode));
    if (this.ai) this.updateAI(dt);
    this.tickClock(dt);
    if (g.state !== 'place' && !(g.state === 'aim' && this.match?.inHand)) this.aim.hidePlace();
    this.ui.update(dt);
  }

  // SHOT CLOCK: run out of time and it is a foul, ball in hand to the other player
  tickClock(dt) {
    const g = this.g, m = this.match;
    if (!m || !m.clock || this.paused || this.ui.modalOpen() || !this.isHumanTurn() || !['aim', 'charge', 'place'].includes(g.state)) return;
    m.clockLeft -= dt;
    const n = Math.ceil(m.clockLeft);
    if (n !== m.clockTick) { m.clockTick = n; if (n <= 5 && n > 0) g.audio.cUi('move'); }
    this.ui.clock(m.clockLeft / m.clock, Math.max(0, n));
    if (m.clockLeft > 0) return;
    g.state = 'cwait';
    g.charge = 0;
    this.aim.hide(); this.aim.hidePlace();
    g.cue.visible = false;
    const st = this.data.stats;
    st.clockFouls = (st.clockFouls || 0) + 1; st.fouls = (st.fouls || 0) + 1;
    this.save();
    m.turn = 1 - m.turn; m.inHand = true; m.kitchen = false; m.isBreak = false; m.breakRun = false; m.visit = 0;
    this.ui.foul('Shot clock', `Ball in hand · ${m.players[m.turn].name}`);
    g.audio.cFoul();
    g.after(1.9, () => { if (this.match === m) this.beginTurn(); });
  }

  onKey(code) {
    const g = this.g, m = this.match;
    if (g.state === 'transition') return;
    if (code === 'Escape') { this.togglePause(); return; }
    if (this.ui.modalOpen() || this.paused) return;
    const inPlay = ['aim', 'charge', 'place'].includes(g.state) && this.isHumanTurn();
    if (inPlay) {
      if (code === 'KeyR') { g.spin.x = 0; g.spin.y = 0; }
      if (code === 'KeyQ') { if (g.camStyle === 'top') g.topZoom = Math.min(1.6, (g.topZoom || 1) + 0.1); else g.camDist = Math.max(1.3, g.camDist - 0.25); }
      if (code === 'KeyE') { if (g.camStyle === 'top') g.topZoom = Math.max(0.85, (g.topZoom || 1) - 0.1); else g.camDist = Math.min(3.4, g.camDist + 0.25); }
      if (m?.type === 'practice') {
        if (code === 'KeyN') { g.audio.cUi('select'); this.practiceRack(m.layout); }
        if (code === 'KeyU') this.practiceUndo();
        if (code === 'KeyM') this.practiceMove();
        if (code === 'KeyL') this.practiceLayout();
      }
    }
    if ((code === 'KeyC' || code === 'Tab') && m) this.toggleCamera();
  }

  toggleCamera() {
    const g = this.g;
    g.camStyle = g.camStyle === 'top' ? 'cinematic' : 'top';
    this.s.camera = g.camStyle === 'top' ? 'top' : '3d';
    this.save();
    this.ui.notice(g.camStyle === 'top' ? 'Top down' : '3D view', '', 'soft');
    g.audio.cUi('move');
  }

  togglePause() {
    const g = this.g;
    if (!this.match || ['cend', 'transition'].includes(g.state)) return;
    if (this.paused) { this.ui.closePause(); return; }
    if (this.ui.modalOpen()) return;
    if (g.state === 'charge') { g.state = 'aim'; g.charge = 0; }
    this.ui.pause();
  }

  setPaused(on) {
    const g = this.g;
    this.paused = on;
    g.audio.music?.muffle(on);
    if (on) { this.prevSlow = g.slowTarget; g.slowTarget = 0.0001; g.timeScale = 0.0001; }
    else { g.slowTarget = 1; g.timeScale = 1; }
  }

  // leave the match for the classic menu
  quitMatch() {
    this.setPaused(false);
    this.ui.closeAll();
    this.g.timers = [];
    this.toMenu();
  }
}

export { groupOf };
