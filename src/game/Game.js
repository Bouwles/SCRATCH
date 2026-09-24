// Game core: owns the scene, the loop, the camera, input and the state
// machine. Shot flow lives in shot.js, run/encounter flow in run.js.

import '../core/setup.js';
import * as THREE from 'three';
import { TABLE } from '../config.js';
import { PS1Renderer } from '../render/PS1Renderer.js';
import { shared } from '../render/materials.js';
import { envTexture, setTextureMode } from '../render/textures.js';
import { setMaterialMode } from '../render/materials.js';
import { LightRig } from '../render/lights.js';
import { Physics } from '../physics/Physics.js';
import { Table } from '../world/Table.js';
import { Room } from '../world/Room.js';
import { BallView } from '../world/BallView.js';
import { Cue, AimGuide } from '../world/Cue.js';
import { FX } from '../world/FX.js';
import { AudioEngine } from '../audio/Audio.js';
import { Meta } from './meta.js';
import { themeById, ballSkinById, cueSkinById } from './cosmetics.js';
import { UI } from '../ui/UI.js';
import { ShotMixin } from './shot.js';
import { RunMixin, makeHoming, makeOrbit } from './run.js';
import { AfterMixin, patchRelicsForSynergies } from './after.js';
import { RajisMixin } from './rajis.js';
import { setRelicGate } from './relics.js';
import { ReplayMixin } from '../ui/AfterUI.js';
import { Classic } from '../classic/Classic.js';
import { toClassic, toRogue } from '../classic/transition.js';

const R = TABLE.R;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.meta = new Meta();
    this.renderer = new PS1Renderer(canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.03, 80);
    this.lights = new LightRig();
    this.physics = new Physics();
    this.mode = 'rogue';                     // 'rogue' | 'classic' — two games, one table
    this.physics.listener = (type, ...a) => (this.mode === 'classic' ? this.classic.onPhysics(type, ...a) : this.onPhysics(type, ...a));
    this.table = new Table(this.physics);
    this.scene.add(this.table.group, this.table.lampGroup);
    this.room = new Room(this.lights);
    this.scene.add(this.room.group);
    this.ballView = new BallView(this.table.group, this.physics);
    this.cue = new Cue(this.table.group);
    this.aim = new AimGuide(this.table.group);
    this.fx = new FX(this.table.group);
    this.audio = new AudioEngine();

    // tiny render target for the "live feed" CRTs
    this.liveRT = new THREE.WebGLRenderTarget(96, 64, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.liveCam = new THREE.PerspectiveCamera(40, 1.5, 0.1, 10);
    this.liveCam.position.set(0, 2.6, 0.01);
    this.liveCam.lookAt(0, 0, 0);

    // state
    this.state = 'boot';
    this.time = 0;
    this.timeScale = 1; this.slowTarget = 1; this.slowTimer = 0;
    this.hitStop = 0;
    this.trauma = 0;
    this.kick = new THREE.Vector3();
    this.fovPunch = 0;
    this.timers = [];
    this.power = 0.6;
    this.charge = 0;
    this.spin = { x: 0, y: 0 };
    this.aimAngle = 0;
    this.camYaw = Math.PI; this.camPitch = 0.92; this.camDist = 2.35;
    this.cam = { yaw: Math.PI, pitch: 0.6, dist: 3.4, target: new THREE.Vector3(), fov: 48 };
    this.camMode = 'menu';
    this.mouse = { x: 0, y: 0, down: false, rdown: false, lastX: 0, lastY: 0, moved: false };
    this.keys = {};
    this.run = null;
    this.enc = null;
    this.shot = null;
    this.tiltVec = { x: 0, z: 0 };
    this.blackout = false;
    this.blackHole = null;
    this.chaosRule = null;
    this.raycaster = new THREE.Raycaster();
    this.homingForce = makeHoming(this);
    this.orbitForce = makeOrbit(this);
    this.armed = {};

    // risk relics wait until the save has won once (Daily Scratch gets everything)
    setRelicGate((r) => !r.risk || this.gate('newtables'));
    patchRelicsForSynergies(this);
    this.applyCosmetics();
    this.applySettings();
    this.ui = new UI(this);
    this.classic = new Classic(this);
    this.bindInput();
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  }

  // ------------------------------------------------------------ settings
  applySettings() {
    const s = this.meta.s;
    const modern = s.gfx === 'modern';
    const R = this.renderer;
    R.settings.crt = s.crt;
    R.settings.ca = s.crt ? (modern ? 0.25 : 0.6) : 0;
    R.settings.grain = s.crt ? (modern ? 0.02 : 0.05) : (modern ? 0.012 : 0.02);
    R.settings.jitter = 1;
    R.settings.bloom = s.bloom ? 0.9 : 0;
    const ps1Height = { auto: 240, 0.5: 180, 0.75: 240, 1: 360 }[s.resScale] || 240;
    R.configure({ mode: modern ? 'modern' : 'ps1', ps1Height, resScale: s.resScale });
    this.setGraphicsStyle(modern);
    this.fx.density = { low: 0.35, med: 0.65, high: 1 }[s.particles] ?? 1;
    this.camStyle = s.camera === 'top' ? 'top' : 'cinematic';
    this.audio.vol.master = s.master ?? 0.8; this.audio.vol.music = s.music; this.audio.vol.sfx = s.sfx;
    this.audio.applyVolumes();
    this.ui?.applyScale();
  }

  // PS1 <-> MODERN: same scene; swap shader paths, texture filtering and detail
  setGraphicsStyle(modern) {
    if (this.modernGfx === modern) return;
    this.modernGfx = modern;
    setTextureMode(modern);
    setMaterialMode(modern);
    this.ballView.setModern(modern);
    this.cue.setModern(modern);
    document.documentElement.classList.toggle('modern', modern);
    if (this.theme) {
      // rebuild the table so hi-res felt/ball textures are generated
      const th = this.theme; this.theme = null;
      this.setTheme(th);
      this.ballView.setSkin(this.ballView.skin);
      if (this.tint) this.tintLights(...this.tint);   // keep a boss fight's lighting
    }
    this.envDirty = true;
  }

  // capture the actual club into a cube map for real ball reflections (modern)
  captureEnv() {
    this.envDirty = false;
    if (!this.modernGfx || (this.mode === 'classic' && !this.classic.s.reflections)) { shared.uHasCube.value = 0; return; }
    if (!this.cubeRT) {
      this.cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      this.cubeCam = new THREE.CubeCamera(0.05, 30, this.cubeRT);
    }
    const hide = [this.ballView.group, this.cue.group, this.aim.group, this.fx.root];
    const vis = hide.map(o => o.visible);
    hide.forEach(o => { o.visible = false; });
    // capture with the lamps fully visible, then restore the camera-dependent fade
    const fade = this.table.lampFade ?? 1;
    this.table.lampFade = 1; this.table.fadeLamp(0, 0);
    if (this.mode === 'classic') this.classic.lounge.applyFade(1);
    this.lights.update(0.016, this.time);
    this.cubeCam.position.set(0, 0.15, 0);
    this.cubeCam.update(this.renderer.gl, this.scene);
    hide.forEach((o, i) => { o.visible = vis[i]; });
    this.table.lampFade = fade; this.table.fadeLamp(this.camera.position.y, 0);
    if (this.mode === 'classic') this.classic.lounge.applyFade(this.classic.lounge.lampFade);
    shared.uEnvCube.value = this.cubeRT.texture;
    shared.uHasCube.value = 1;
  }

  applyCosmetics(themeOverride) {
    const sel = this.meta.data.selected;
    const theme = themeOverride || themeById(sel.theme);
    this.setTheme(theme);
    this.ballView.setSkin(ballSkinById(sel.ball));
    this.cue.setSkin(cueSkinById(sel.cue));
  }

  setTheme(theme) {
    const flags = this.menuFlags ? this.menuFlags() : {};
    const sig = JSON.stringify(flags);
    if (this.theme === theme && this.flagSig === sig) return;
    this.flagSig = sig;
    this.theme = theme;
    this.table.build(theme);
    this.room.flags = flags;
    this.room.build(theme, this.liveRT.texture);
    shared.uEnvMap.value?.dispose();
    shared.uEnvMap.value = envTexture(theme);
    shared.uAmbient.value.setRGB(...theme.ambient);
    this.ambSet = 1;
    shared.uSky.value.setRGB(...theme.skyC);
    shared.uGround.value.setRGB(...theme.ground);
    shared.uFogColor.value.setRGB(...theme.fog);
    shared.uFogNear.value = theme.fogNear;
    shared.uFogFar.value = theme.fogFar;
    this.scene.background = new THREE.Color().setRGB(...theme.fog);
    this.envDirty = true;
    const g = theme.grade;
    this.renderer.grade.lift.set(...g.lift);
    this.renderer.grade.gain.set(...g.gain);
    this.renderer.grade.sat = g.sat;
    const lc = new THREE.Color().setRGB(...theme.lampColor);
    this.table.lampLights.forEach((l, i) => this.lights.set(i, new THREE.Vector3(l.x, l.y, l.z), lc, 2.6, 1.0, theme.id === 'hell' ? 0.15 : 0));
  }

  // tint the table lamps + fog (boss fights); null restores the theme
  tintLights(hex, k = 0.6) {
    this.tint = hex ? [hex, k] : null;
    const t = this.theme;
    const base = new THREE.Color().setRGB(...t.lampColor);
    const c = hex ? base.clone().lerp(new THREE.Color(hex).multiplyScalar(1.4), k) : base;
    for (let i = 0; i < 3; i++) this.lights.slots[i].color.copy(c);
    shared.uFogColor.value.setRGB(...t.fog);
    if (hex) shared.uFogColor.value.lerp(new THREE.Color(hex).multiplyScalar(0.14), 0.7);
    this.scene.background = shared.uFogColor.value.clone();
  }

  onResize() {
    this.renderer.resize();
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('mousedown', e => {
      this.audio.init();
      if (e.button === 0) { this.mouse.down = true; this.mode === 'classic' ? this.classic.onPrimaryDown() : this.onPrimaryDown(); }
      if (e.button === 2) {
        this.mouse.rdown = true;
        if (this.state === 'charge') this.cancelCharge();
      }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0 && this.mouse.down) { this.mouse.down = false; this.mode === 'classic' ? this.classic.onPrimaryUp() : this.onPrimaryUp(); }
      if (e.button === 2) this.mouse.rdown = false;
    });
    window.addEventListener('mousemove', e => {
      const dx = e.clientX - this.mouse.x, dy = e.clientY - this.mouse.y;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.mouse.rdown) {
        this.camYaw -= dx * 0.006;
        this.camPitch = Math.max(0.22, Math.min(1.45, this.camPitch + dy * 0.004));
        this.userCam = true;
        return;
      }
      if (this.state === 'aim') {
        if (this.keys.ShiftLeft || this.keys.ShiftRight) this.aimAngle += dx * 0.0009 * (this.renderer.mirror ? -1 : 1);
        else this.pointAim();
        this.tutorialAim = (this.tutorialAim || 0) + Math.abs(dx) + Math.abs(dy);
      }
    });
    c.addEventListener('wheel', e => {
      e.preventDefault();
      if (this.state === 'aim' || this.state === 'charge') {
        if (this.mode === 'classic' && !this.classic.isHumanTurn()) return;
        this.power = Math.max(0.05, Math.min(1, this.power - Math.sign(e.deltaY) * 0.04));
        if (this.mode === 'classic') { this.classic.ui.flashPower(); this.audio.cUi('move'); return; }
        this.ui.flashPower();
        this.tutorialWheel = true;
        this.audio.tick();
      }
    }, { passive: false });
    window.addEventListener('keydown', e => {
      this.audio.init();
      if (e.target?.tagName === 'INPUT') return;          // typing a name
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat && !['ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) return;
      const code = e.code === 'NumpadEnter' ? 'Enter' : e.code;       // keypad Enter works like Enter
      this.keys[code] = true;
      this.onKey(code);
    });
    window.addEventListener('keyup', e => { this.keys[e.code === 'NumpadEnter' ? 'Enter' : e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.rdown = false; if (this.mouse.down) { this.mouse.down = false; if (this.state === 'charge') this.cancelCharge(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.keys = {}; this.autoPause(); } });
  }

  onKey(code) {
    if (this.mode === 'classic') { this.classic.onKey(code); return; }
    if (this.state === 'transition') return;
    if (code === 'Escape') { this.togglePause(); return; }
    if (this.ui.modalOpen()) return;
    const inPlay = this.state === 'aim' || this.state === 'charge' || this.state === 'place';
    if (inPlay) {
      if (code === 'KeyR') { this.spin.x = 0; this.spin.y = 0; }
      if (code === 'KeyG') this.toggleGhost();
      if (code === 'KeyB') this.bookieAccept();
      if (code === 'Digit1') this.useItem(0);
      if (code === 'Digit2') this.useItem(1);
      if (code === 'Digit3') this.useItem(2);
      if (code === 'KeyQ') { if (this.camStyle === 'top') this.topZoom = Math.min(1.6, (this.topZoom || 1) + 0.1); else this.camDist = Math.max(1.3, this.camDist - 0.25); }
      if (code === 'KeyE') { if (this.camStyle === 'top') this.topZoom = Math.max(0.85, (this.topZoom || 1) - 0.1); else this.camDist = Math.min(3.4, this.camDist + 0.25); }
    }
    if ((code === 'KeyC' || code === 'Tab') && this.run && !['menu', 'title'].includes(this.state)) this.toggleCameraStyle();
    if (code === 'Space' && (this.state === 'sim' || this.state === 'house')) this.audio.whoosh(0.5);
  }

  onPrimaryDown() {
    if (this.ui.modalOpen()) return;
    if (this.state === 'aim') {
      this.state = 'charge';
      this.charge = 0;
      this.audio.tone(220, { type: 'triangle', dur: 0.05, vol: 0.05 });
    } else if (this.state === 'place') {
      this.tryPlaceCue();
    } else if (this.ui.clickAdvance) {
      this.ui.clickAdvance();
    }
  }

  onPrimaryUp() {
    if (this.state === 'charge' && this.ui.pauseOpen) { this.cancelCharge(); return; }
    if (this.state === 'charge') {
      if (this.charge < 0.03) { this.state = 'aim'; this.charge = 0; return; }
      this.fireShot();
    }
  }

  toggleCameraStyle() {
    this.camStyle = this.camStyle === 'top' ? 'cinematic' : 'top';
    this.meta.s.camera = this.camStyle;
    this.meta.save();
    this.ui.toast(this.camStyle === 'top' ? 'TOP DOWN' : 'CINEMATIC', '#2bf0ff', 'CAMERA');
    this.audio.ui('move');
  }

  cancelCharge() {
    this.state = 'aim';
    this.charge = 0;
    this.audio.ui('back');
  }

  // aim = direction from cue ball to the mouse's point on the felt
  tablePoint() {
    let nx = this.mouse.x / window.innerWidth * 2 - 1;
    if (this.renderer.mirror) nx = -nx;
    const ndc = new THREE.Vector2(nx, -(this.mouse.y / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const inv = new THREE.Matrix4().copy(this.table.group.matrixWorld).invert();
    const ray = this.raycaster.ray.clone().applyMatrix4(inv);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);
    const hit = new THREE.Vector3();
    return ray.intersectPlane(plane, hit) ? hit : null;
  }

  pointAim() {
    const cue = this.physics.cue;
    if (!cue) return;
    const p = this.tablePoint();
    if (!p) return;
    const dx = p.x - cue.x, dz = p.z - cue.z;
    if (Math.hypot(dx, dz) < 0.04) return;
    this.aimAngle = Math.atan2(dz, dx);
  }

  // ----------------------------------------------------------- helpers
  later(sec, fn, block = false) { this.timers.push({ t: sec, fn, real: false, block }); }
  after(sec, fn) { this.timers.push({ t: sec, fn, real: true }); }

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount * (this.meta.s.shake ?? 1)); }
  bump(dx, dz, amt = 0.02) { this.kick.x += dx * amt; this.kick.z += dz * amt; }
  slowmo(scale, sec) { this.slowTarget = Math.min(this.slowTarget, scale); this.slowTimer = Math.max(this.slowTimer, sec); }
  freeze(sec) { this.hitStop = Math.max(this.hitStop, sec); }

  worldPos(x, z, y = 0.05) {
    return this.table.group.localToWorld(new THREE.Vector3(x, y, z));
  }

  popText(text, color = '#fff', scale = 1) { this.ui.popup(text, { color, scale }); }

  // ---------------------------------------------------------------- loop
  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    let realDt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += realDt;
    const t = this.time;
    shared.uTime.value = t;

    // time control: hit-stop, slow-mo, fast-forward
    let simDt;
    if (this.hitStop > 0) { this.hitStop -= realDt; simDt = 0; }
    else {
      if (this.slowTimer > 0) { this.slowTimer -= realDt; if (this.slowTimer <= 0) this.slowTarget = 1; }
      this.timeScale = damp(this.timeScale, this.slowTarget, this.slowTarget < this.timeScale ? 18 : 4, realDt);
      simDt = realDt * this.timeScale;
      const ff = (this.state === 'sim' || this.state === 'house') && this.keys.Space ? 3 : 1;
      simDt *= ff;
    }

    const classic = this.mode === 'classic';
    if (!this.ui.pauseOpen && !(classic && this.classic.paused)) this.updateState(realDt, simDt);
    if (this.run && !this.ui.pauseOpen && ['aim', 'charge', 'shooting', 'sim', 'place', 'house', 'houseWait', 'enemy'].includes(this.state)) this.run.time += realDt;
    if (this.enc?.feverXL && !this.ui.pauseOpen) this.physics.pockets.forEach((p, i) => { if (p.open) p.scale = 1.4 + Math.sin(this.time * 1.3 + i * 1.7) * 0.8; });

    // timers
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= tm.real ? realDt : simDt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    if (this.carRun && !this.ui.pauseOpen) this.carRun(this.time);
    if (this.replayTick) this.replayTick(realDt);

    // physics: fixed 1/240 s steps so results never depend on frame rate
    if (simDt > 0) {
      const H = 1 / 240;
      this.physAcc = Math.min(0.25, (this.physAcc || 0) + simDt);
      while (this.physAcc >= H) { if (!this.replaying) this.physics.step(H); this.physAcc -= H; }
      if (this.state === 'sim' || this.state === 'house') (classic ? this.classic.simTick(simDt) : this.simTick(simDt));
    }

    this.table.update(realDt, t);
    this.ballView.update(simDt, t);
    this.fx.update(simDt > 0 ? simDt : realDt * 0.05);
    if (!classic) this.room.update(realDt, t, this.camera);
    this.cue.update(realDt, t);
    this.updateLighting(realDt, t);
    this.lights.update(simDt > 0 ? simDt : realDt * 0.2, t);
    this.updateCamera(realDt, t);
    if (classic) this.classic.update(realDt, simDt); else this.ui.update(realDt);

    // renders
    if (this.envDirty) this.captureEnv();
    if ((this.frameCount = (this.frameCount || 0) + 1) % 3 === 0 && !classic) {
      this.renderer.gl.setRenderTarget(this.liveRT);
      this.renderer.gl.render(this.scene, this.liveCam);
    }
    this.renderer.render(this.scene, this.camera);
  }

  updateLighting(dt, t) {
    const L = this.lights;
    const target = this.blackout === 'deep' ? 0.06 : this.blackout ? 0.18 : (this.lampTarget ?? 1);
    L.lampMul = damp(L.lampMul, target, this.mode === 'classic' ? 1.2 : 3, dt);
    // table damage: the room's lights stutter after a big hit
    this.flicker = Math.max(0, (this.flicker || 0) - dt * 0.9);
    const fl = this.flicker > 0 && Math.sin(t * 41) * Math.sin(t * 17.3) > 0.2 ? 1 - this.flicker : 1;
    L.accentMul = damp(L.accentMul, (this.blackout === 'deep' ? 0.12 : this.blackout ? 0.4 : (this.accentTarget ?? 1)) * fl, this.mode === 'classic' ? 1.2 : 3, dt);
    if (this.glitchDecay) { this.renderer.fx.glitch = Math.max(0, this.renderer.fx.glitch - dt * 0.8); if (!this.renderer.fx.glitch) this.glitchDecay = false; }
    if (this.blackout && this.physics.cue && this.physics.cue.state === 'table') {
      const c = this.physics.cue;
      const p = this.worldPos(c.x, c.z, 0.35);
      L.set(9, p, 0xfff0d0, 0.9, 1.3);
    }
    // THE OWNER, phase III: one light in the room, over the only ball that counts
    const lit = this.enc?.litBall;
    if (lit && lit.state === 'table' && !this.enc.done) L.set(8, this.worldPos(lit.x, lit.z, 0.3), 0xf0e6c8, 0.7, 1.6);
    else if (this.litOn) L.clear(8);
    this.litOn = !!(lit && lit.state === 'table');
    // a real power cut takes the room's ambient light with it
    const amb = this.mode !== 'classic' && this.blackout === 'deep' ? 0.25 : 1;
    this.ambK = damp(this.ambK ?? 1, amb, 2.5, dt);
    if (this.theme && this.mode !== 'classic' && Math.abs(this.ambK - (this.ambSet ?? 1)) > 0.004) {
      this.ambSet = this.ambK;
      const k = this.ambK, T = this.theme;
      shared.uAmbient.value.setRGB(T.ambient[0] * k, T.ambient[1] * k, T.ambient[2] * k);
      shared.uSky.value.setRGB(T.skyC[0] * k, T.skyC[1] * k, T.skyC[2] * k);
      shared.uGround.value.setRGB(T.ground[0] * k, T.ground[1] * k, T.ground[2] * k);
    }
    // in the dark, the balls glow a little (BLACKOUT)
    this.ballView.glow = damp(this.ballView.glow || 0, this.blackout && this.enc?.tstate?.id === 'blackout' ? 0.35 : 0, 3, dt);
    this.room.clockText = this.meta.data.afterhours?.found ? '03:77' : null;
    // void boss swirl on screen
    const vp = this.physics.pockets.find(p => p.gravity > 0 && p.open);
    if (vp) {
      const s = this.renderer.project(this.worldPos(vp.x, vp.z, 0), this.camera);
      this.renderer.swirl.set(s.u, s.v, 0.55 + Math.sin(t * 2) * 0.1);
      this.renderer.swirlR = 0.16;
    } else this.renderer.swirl.z = damp(this.renderer.swirl.z, 0, 5, dt);
    // screen flash decay
    this.renderer.flash.amt = Math.max(0, this.renderer.flash.amt - dt * 3);
    // the table from 1987: faded colour and a warbling tape for as long as it lasts
    const fb = this.mode === 'rogue' && this.enc?.anomaly?.id === 'flashback' && !this.enc.done;
    const mus = this.audio.music;
    if (mus && (fb || this.fbOn)) mus.wobble = fb ? 1.4 : 0;     // a track swap resets it, so keep it set
    this.fbOn = fb;
    this.renderer.grade.desat = Math.max(fb ? 0.82 : 0, this.renderer.grade.desat - dt * 1.5);
  }

  screenFlash(color = 0xffffff, amt = 0.4) {
    const k = { full: 1, reduced: 0.3, off: 0 }[this.meta.s.flash] ?? 1;   // accessibility: Screen Flash
    if (!k) return;
    this.renderer.flash.color.set(color);
    this.renderer.flash.amt = Math.max(this.renderer.flash.amt, amt * k);
  }

  // ------------------------------------------------------------- camera
  updateCamera(dt, t) {
    const cam = this.cam;
    const cue = this.physics.cue;
    let target = new THREE.Vector3(), yaw = cam.yaw, pitch = cam.pitch, dist = cam.dist, rate = 3, fov = 48;
    const mode = this.camMode;
    if (mode === 'menu') {
      yaw = t * 0.05 + Math.PI * 0.25; pitch = 0.36; dist = 2.9; target.set(0, -0.05, 0); rate = 1.5;
    } else if (mode === 'lounge') {
      // classic menus: a slow walk around the table
      yaw = t * 0.035 + 0.6; pitch = 0.44 + Math.sin(t * 0.05) * 0.04; dist = 3.5; target.set(0.35, -0.02, 0); rate = 1.1; fov = 40;
    } else if (mode === 'showcase') {
      yaw = t * 0.06 + 0.3; pitch = 0.55; dist = 2.3; target.set(0.2, 0, 0); rate = 1.4; fov = 40;
    } else if (mode === 'intro') {
      yaw = Math.PI * 1.06; pitch = 0.62; dist = 2.7; target.set(-0.1, 0, 0); rate = 1.3; fov = 44;
    } else if (mode === 'end') {
      yaw = cam.yaw + dt * 0.07; pitch = 0.46; dist = 3.1; target.set(0, 0, 0); rate = 0.7; fov = 42;
    } else if (this.camStyle === 'top' && ['aim', 'place', 'charge', 'watch'].includes(mode)) {
      // TOP DOWN: frame the whole table, long axis horizontal, slight pan toward the cue when zoomed
      fov = 34;
      const vf = fov * Math.PI / 180, aspect = window.innerWidth / window.innerHeight;
      const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
      const hx = TABLE.L + 0.2, hz = TABLE.W + 0.2;           // rails + margin
      const fit = Math.max(hx / Math.tan(hf / 2), hz / Math.tan(vf / 2)) * 1.1;
      const zoom = this.topZoom || 1;
      dist = fit / zoom + 0.05;
      pitch = 1.5; yaw = Math.PI / 2; rate = 3.2;
      const pan = (zoom - 1) * 0.9;
      const fx = cue && mode !== 'watch' ? cue.x : 0, fz = cue && mode !== 'watch' ? cue.z : 0;
      target.set(fx * pan, 0, fz * pan);
    } else if (mode === 'aim' || mode === 'place') {
      const cx = cue ? cue.x : 0, cz = cue ? cue.z : 0;
      target.set(cx * 0.4, 0, cz * 0.35);
      yaw = this.camYaw; pitch = this.camPitch; dist = this.camDist;
      rate = 4;
    } else if (mode === 'charge' && cue) {
      const a = this.aimAngle;
      const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      target.set(cue.x + d.x * 0.32, 0, cue.z + d.z * 0.32);
      yaw = a + Math.PI; pitch = 0.3 + this.charge * 0.05; dist = 0.95 - this.charge * 0.08;
      rate = 5.5; fov = 50 - this.charge * 6;
    } else if (mode === 'watch') {
      // follow the action loosely
      let sx = 0, sz = 0, n = 0;
      for (const b of this.physics.balls) {
        if (b.state !== 'table') continue;
        const sp = b.speed;
        if (sp > 0.05) { sx += b.x * sp; sz += b.z * sp; n += sp; }
      }
      const fx = n > 0 ? sx / n : 0, fz = n > 0 ? sz / n : 0;
      this.watchFocus = this.watchFocus || new THREE.Vector3();
      this.watchFocus.x = damp(this.watchFocus.x, fx * 0.35, 1.5, dt);
      this.watchFocus.z = damp(this.watchFocus.z, fz * 0.3, 1.5, dt);
      target.set(this.watchFocus.x, 0, this.watchFocus.z);
      yaw = this.shotYaw ?? this.camYaw; pitch = 1.0; dist = 2.45; rate = 2.2;
    } else if (mode === 'boss') {
      const k = this.bossCamT = (this.bossCamT || 0) + dt;
      yaw = Math.PI * 0.5 + k * 0.5; pitch = 0.35 + k * 0.1; dist = 1.6 + k * 0.4; target.set(0, 0, 0); rate = 2.5;
    } else if (mode === 'shop') {
      yaw = Math.PI * 0.75 + Math.sin(t * 0.1) * 0.2; pitch = 0.42; dist = 2.6; target.set(0.4, 0, 0); rate = 2;
    } else if (mode === 'result') {
      yaw = cam.yaw + dt * 0.15; pitch = 0.7; dist = 2.6; target.set(0, 0, 0); rate = 2;
    }
    cam.yaw += angDiff(cam.yaw, yaw) * (1 - Math.exp(-rate * dt));
    cam.pitch = damp(cam.pitch, pitch, rate, dt);
    cam.dist = damp(cam.dist, dist, rate, dt);
    cam.target.x = damp(cam.target.x, target.x, rate, dt);
    cam.target.y = damp(cam.target.y, target.y, rate, dt);
    cam.target.z = damp(cam.target.z, target.z, rate, dt);
    cam.fov = damp(cam.fov, fov, 4, dt);

    const cp = Math.cos(cam.pitch);
    const pos = new THREE.Vector3(
      cam.target.x + Math.cos(cam.yaw) * cp * cam.dist,
      cam.target.y + Math.sin(cam.pitch) * cam.dist,
      cam.target.z + Math.sin(cam.yaw) * cp * cam.dist,
    );
    // shake & kick
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const top = this.camStyle === 'top' && ['aim', 'place', 'charge', 'watch'].includes(mode);
    const calm = top ? 0.35 : 1;
    const sh = this.trauma * this.trauma * calm;
    const n = (s) => (Math.sin(t * 37.1 + s) * 0.6 + Math.sin(t * 23.7 + s * 2) * 0.4);
    pos.x += n(1) * sh * 0.05 + this.kick.x * calm;
    pos.y += n(2) * sh * 0.04;
    pos.z += n(3) * sh * 0.05 + this.kick.z * calm;
    this.kick.multiplyScalar(Math.exp(-dt * 10));
    this.camera.position.copy(pos);
    this.camera.lookAt(cam.target);
    this.camera.rotation.z += n(4) * sh * 0.035;
    this.fovPunch = damp(this.fovPunch, 0, 6, dt);
    this.camera.fov = cam.fov - this.fovPunch * (top ? 2 : 8);
    this.camera.updateProjectionMatrix();
    this.table.fadeLamp(this.camera.position.y, dt);
  }

  // ------------------------------------------------------------- state
  updateState(dt, simDt) {
    const cue = this.physics.cue;
    if (this.state === 'aim' || this.state === 'charge') {
      // keyboard spin & fine aim
      const sp = dt * 1.6;
      if (this.keys.KeyW) this.spin.y = Math.min(1, this.spin.y + sp);
      if (this.keys.KeyS) this.spin.y = Math.max(-1, this.spin.y - sp);
      if (this.keys.KeyA) this.spin.x = Math.max(-1, this.spin.x - sp);
      if (this.keys.KeyD) this.spin.x = Math.min(1, this.spin.x + sp);
      const l = Math.hypot(this.spin.x, this.spin.y);
      if (l > 1) { this.spin.x /= l; this.spin.y /= l; }
      if (this.state === 'aim') {
        if (this.keys.ArrowLeft) this.aimAngle -= dt * (this.keys.ShiftLeft ? 0.05 : 0.35);
        if (this.keys.ArrowRight) this.aimAngle += dt * (this.keys.ShiftLeft ? 0.05 : 0.35);
      }
    }
    if (this.state === 'aim' || this.state === 'charge') {
      if (!cue || cue.state !== 'table') return;
      if (this.state === 'charge') {
        const rate = 0.9 + this.charge * 0.6;
        this.charge = Math.min(this.power, this.charge + dt * rate);
      }
      const ang = this.displayAngle();
      const dx = Math.cos(ang), dz = Math.sin(ang);
      const pred = this.physics.predict(cue.x, cue.z, dx, dz, cue);
      if (this.mode === 'classic') {
        this.classic.showAim(cue, dx, dz, pred);
        this.cue.visible = true;
        const pull = this.state === 'charge' ? 0.02 + this.charge * 0.24 : 0.035 + Math.sin(this.time * 3) * 0.004;
        this.cue.place(cue.x, cue.z, ang, pull, 0.09 + this.spin.y * 0.04);
        this.camMode = this.classic.aimCamMode();
        return;
      }
      const early8 = pred.type === 'ball' && pred.ball.num === 8 && pred.ball.kind === 'object' && this.enc && !this.enc.def.classic && this.enc.progress < this.enc.goal - 1;
      const forbid = pred.type === 'ball' && pred.ball.tags.forbidden;
      this.aim.level = this.enc?.challenge?.id === 'noguide' || this.enc?.stake?.id === 'noguide' || this.hasRelic('blind_faith') || this.run?.hand?.includes('noguide') ? 'none' : (this.meta.s.aim || 'full');
      // laser sight / bank tables: preview the object ball's first cushion rebound
      let bank = null;
      if (pred.type === 'ball' && (this.aim.extend > 1 || this.enc?.def.id === 'bank')) {
        const ob = pred.ball, bp = this.physics.predict(ob.x, ob.z, pred.nx, pred.nz, ob, 2.5);
        if (bp.type === 'cushion') {
          const sg = bp.seg, ex = sg.bx - sg.ax, ez = sg.bz - sg.az, l = Math.hypot(ex, ez);
          let nx = -ez / l, nz = ex / l;
          if (nx * pred.nx + nz * pred.nz > 0) { nx = -nx; nz = -nz; }
          const d = pred.nx * nx + pred.nz * nz;
          bank = { ox: ob.x, oz: ob.z, dx: pred.nx, dz: pred.nz, t: bp.t, hx: bp.x, hz: bp.z, rx: pred.nx - 2 * d * nx, rz: pred.nz - 2 * d * nz };
        }
      }
      this.aim.show(cue.x, cue.z, dx, dz, pred, this.time, early8 || forbid, bank);
      this.ui.aimWarning(forbid ? 'FORBIDDEN BALL' : early8 ? 'THE 8 GOES LAST' : null);
      this.cue.visible = true;
      const pull = this.state === 'charge' ? 0.02 + this.charge * 0.24 : 0.035 + Math.sin(this.time * 3) * 0.004;
      this.cue.place(cue.x, cue.z, ang, pull, 0.09 + this.spin.y * 0.04);
      this.camMode = 'charge' === this.state ? 'charge' : 'aim';
    } else if (this.state === 'shooting') {
      this.updateThrust(dt);
    } else if (this.state === 'place') {
      if (this.mode === 'classic') this.classic.updatePlace(); else this.updatePlace();
    } else {
      this.aim.hide();
      this.ui.aimWarning(null);
    }
    if (this.state === 'sim' || this.state === 'house') {
      this.camMode = 'watch';
      this.cue.visible = this.cueFollow > 0;
      if (this.cueFollow > 0) this.cueFollow -= dt;
    }
    // THE CLOCK: aim fast, or the cue fires for you
    const ce = this.enc;
    if (ce && ce.def.id === 'clock' && !ce.done && ['aim', 'charge', 'place'].includes(this.state) && !this.ui.modalOpen()) {
      const before = ce.clock;
      ce.clock -= dt;
      if (ce.clock <= 3 && Math.ceil(ce.clock) !== Math.ceil(before) && ce.clock > 0) this.audio.tick();
      if (ce.clock <= 0) { ce.clock = 0; this.clockFire(); }
    }
    if (this.enc && this.enc.def.id === 'blitz' && ['aim', 'charge', 'sim', 'shooting', 'place'].includes(this.state) && !this.enc.done) {
      this.enc.timer -= dt;
      if (this.enc.timer <= 10 && Math.floor(this.enc.timer + dt) !== Math.floor(this.enc.timer)) this.audio.heartbeat();
      if (this.enc.timer <= 0) { this.enc.timer = 0; if (this.state !== 'sim') this.failEncounter('TIME UP'); }
    }
  }

  clockFire() {
    this.ui.popup('TIME!', { color: '#ff8a1b', scale: 1.6 });
    this.audio.bigHit?.(1);
    if (this.state === 'place') { if (!this.placeValid) this.respawnCue(); this.beginAim(); }
    this.charge = this.state === 'charge' ? Math.max(this.charge, 0.2) : Math.max(0.3, this.power * 0.6);
    this.state = 'charge';
    this.fireShot();
  }

  // pause the whole game when the tab/window loses focus
  autoPause() {
    if (this.state === 'transition') return;
    if (this.mode === 'classic') { if (this.classic.match && !this.classic.paused && !this.classic.ui.modalOpen() && this.state !== 'cend') this.classic.ui.pause(); return; }
    if (this.run && !this.ui.pauseOpen && !this.ui.stack.length && !['menu', 'title', 'runend'].includes(this.state)) this.ui.openPause();
  }

  quitToMenu() {
    const rajis = this.run?.mode === 'rajis';
    this.enc?.anomaly?.cleanup?.(this);
    this.renderer.mirror = false;
    this.timers = [];
    this.carRun = null; this.cyberCar?.hide();
    this.stateWorld?.(null, false);
    this.run = null; this.enc = null; this.shot = null;
    this.ui.closeAll();
    this.toMenu();
    if (rajis) this.ui.showRajisMenu();
  }

  displayAngle() {
    let wob = 0;
    for (const r of this.run?.relics || []) if (r.wobble) wob += r.wobble;
    if (!wob) return this.aimAngle;
    return this.aimAngle + Math.sin(this.time * 2.3) * wob + Math.sin(this.time * 3.7 + 1) * wob * 0.6;
  }

  // Inside an embed that does not allow it (or an old Safari) fullscreen is refused:
  // say so instead of failing silently. On itch.io the page's own fullscreen button still works.
  setFullscreen(on) {
    const el = document.documentElement;
    const denied = () => {
      if (this.mode === 'classic') this.classic.ui.notice('Fullscreen is not allowed here', 'Use the page’s fullscreen button');
      else this.ui.toast('USE THE PAGE’S FULLSCREEN BUTTON', '#ffc21c', 'FULLSCREEN IS NOT ALLOWED HERE');
    };
    try {
      if (on && !document.fullscreenElement && !document.webkitFullscreenElement) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req || document.fullscreenEnabled === false) { denied(); return; }
        const p = req.call(el);
        if (p?.catch) p.catch(denied);
      } else if (!on && (document.fullscreenElement || document.webkitFullscreenElement)) {
        const p = (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
        if (p?.catch) p.catch(() => {});
      }
    } catch (e) { denied(); }
  }

  // ---------------------------------------------------- the other game
  // a run can wait while you play normal pool: it is parked, untouched, in memory
  canSuspend() { return !!this.run && ['aim', 'place'].includes(this.state) && !this.shot; }

  suspendRun() {
    this.suspended = {
      run: this.run, enc: this.enc, state: this.state, timers: this.timers,
      balls: this.physics.balls, obstacles: this.physics.obstacles,
      tiltVec: this.tiltVec, tableTilt: { tx: this.table.tilt.tx, tz: this.table.tilt.tz },
      blackout: this.blackout, blackHole: this.blackHole, chaosRule: this.chaosRule, chaosWind: this.chaosWind,
      armed: this.armed, ghostArmed: this.ghostArmed, theme: this.theme, tint: this.tint,
      spin: { ...this.spin }, power: this.power, aimAngle: this.aimAngle,
    };
    this.run = null; this.enc = null; this.timers = [];
    this.physics.balls = []; this.physics.obstacles = [];
    this.ballView.prune(); this.ballView.syncObstacles();
    this.ui.showHUD(false);
  }

  resumeRun() {
    const s = this.suspended;
    if (!s) return;
    this.suspended = null;
    this.ui.closeAll();
    this.run = s.run; this.enc = s.enc; this.timers = s.timers;
    this.physics.balls = s.balls; this.physics.obstacles = s.obstacles;
    this.ballView.prune(); this.ballView.syncObstacles();
    this.tiltVec = s.tiltVec; this.table.tilt.tx = s.tableTilt.tx; this.table.tilt.tz = s.tableTilt.tz;
    this.blackout = s.blackout; this.blackHole = s.blackHole; this.chaosRule = s.chaosRule; this.chaosWind = s.chaosWind;
    this.armed = s.armed; this.ghostArmed = s.ghostArmed;
    Object.assign(this.spin, s.spin); this.power = s.power; this.aimAngle = s.aimAngle;
    this.theme = null;
    this.applyCosmetics(s.theme);
    if (s.tint) this.tintLights(...s.tint);
    this.applyRules();
    this.ui.showHUD(true);
    this.audio.playMusic(this.enc.def.boss ? 'boss' : 'table');
    if (s.state === 'place') this.beginPlace(); else this.beginAim();
  }

  enterClassic() {
    if (this.state === 'transition' || this.mode === 'classic') return;
    if (this.run) this.suspendRun();
    toClassic(this);
  }

  exitClassic() {
    if (this.state === 'transition' || this.mode !== 'classic') return;
    const leave = () => { this.classic.setPaused(false); this.timers = []; toRogue(this); };
    const m = this.classic.match;
    if (m && m.type !== 'practice' && this.state !== 'cend') {
      this.classic.ui.confirm({ title: 'Return to SCRATCH Roguelite?', text: 'Your Classic match progress will end.', ok: 'Return' }, (v) => { if (v) leave(); });
    } else leave();
  }

  togglePause() {
    if (!this.run || ['boot', 'title', 'menu', 'runend'].includes(this.state)) return;
    if (!this.ui.pauseOpen && this.ui.stack.length) return;   // a menu/shop/card handles ESC itself
    if (this.ui.pauseOpen) this.ui.closePause();
    else this.ui.openPause();
  }
}

Object.assign(Game.prototype, ShotMixin, RunMixin, AfterMixin, RajisMixin, ReplayMixin);
