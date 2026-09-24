// A small live preview for cosmetics: its own little WebGL canvas, the game's
// own materials and shaders (so PS1 stays PS1 and Modern stays Modern).
//   ball set → the cue ball, 1, 8, 9 and 15, turning slowly
//   cue      → the stick, drag to turn it, wheel to zoom
//   felt     → a corner of cloth with a few balls on it
//   trail / pocket fx → a ball running a loop, a pocket going off
// One renderer is created on first use and reused; it only draws while shown.

import * as THREE from 'three';
import { TABLE } from '../config.js';
import { ballMaterial, ps1Material, shared } from '../render/materials.js';
import { feltTexture } from '../render/textures.js';
import { paintBall, hueFor } from '../render/ballpaint.js';
import { ballSkinById } from '../game/cosmetics.js';
import { Cue } from '../world/Cue.js';
import { FX } from '../world/FX.js';
import { feltFxMaterial } from '../world/Table.js';

const R = TABLE.R;

export class Showcase {
  constructor(game) {
    this.g = game;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'showcase-cv';
    this.renderer = null;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.yaw = 0; this.pitch = 0.35; this.zoom = 1; this.spin = 0;
    this.running = false;
    this.bind();
  }

  bind() {
    let drag = null;
    this.canvas.addEventListener('mousedown', (e) => { e.stopPropagation(); drag = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      this.yaw += (e.clientX - drag.x) * 0.012; this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + (e.clientY - drag.y) * 0.008));
      drag = { x: e.clientX, y: e.clientY }; this.touched = 2.5;
    });
    window.addEventListener('mouseup', () => { drag = null; });
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); this.zoom = Math.max(0.55, Math.min(2.2, this.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  }

  ensure() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
  }

  clear() {
    this.root.traverse(o => { if (o.isMesh && o.userData.own) { o.geometry.dispose(); o.material.dispose(); } });
    this.root.clear();
    this.cue = null; this.fx = null; this.balls = []; this.mover = null;
  }

  // what to show: { kind: 'ball'|'cue'|'felt'|'trail'|'pocket', item, classic }
  show(spec) {
    this.ensure();
    this.clear();
    this.spec = spec;
    this.yaw = 0; this.pitch = spec.kind === 'cue' ? 0.25 : 0.42; this.zoom = 1; this.t = 0;
    const modern = shared.uModern.value > 0.5;
    const res = spec.classic ? 'classic' : modern ? 'modern' : 'pixel';
    const put = (set, num, x, z) => {
      const mat = ballMaterial(paintBall(num, set, res), { ...(set.mat || {}), fx: set.fx || 0 });
      mat.uniforms.uKind.value = num === 0 ? 0 : num === 8 ? 3 : num >= 9 ? 2 : 1;
      mat.uniforms.uHue.value.set(hueFor(set, num));
      mat.uniforms.uSeed.value = (num * 7.31) % 10;
      const m = new THREE.Mesh(new THREE.SphereGeometry(R, modern || spec.classic ? 40 : 14, modern || spec.classic ? 28 : 10), mat);
      m.userData.own = true;
      m.position.set(x, R, z);
      m.rotation.set(0.25, -Math.PI / 2 + 0.2, 0);
      this.root.add(m);
      this.balls.push(m);
      return m;
    };
    const ballSet = spec.ballSet || ballSkinById(this.g.activeLoadout?.().ball);
    if (spec.kind === 'ball') {
      [0, 1, 8, 9, 15].forEach((n, i) => put(spec.item, n, (i - 2) * R * 2.5, 0));
      this.frame = { dist: 0.42, target: new THREE.Vector3(0, R, 0) };
    } else if (spec.kind === 'cue') {
      this.cue = new Cue(this.root);
      this.cue.setModern(modern || !!spec.classic);
      this.cue.setSkin(spec.skin);
      this.cue.visible = true;
      // the whole stick on a gentle diagonal; zooming in slides toward the butt
      this.cue.pivot.position.set(0.725, 0, 0);
      this.cue.mesh.rotation.set(0, 0, 0);
      this.cue.mesh.position.set(0, 0, 0);
      this.cue.group.rotation.set(0, 0, 0.3);
      this.frame = { dist: 1.75, target: new THREE.Vector3(0, 0, 0) };
    } else if (spec.kind === 'felt') {
      const f = spec.item;
      const tex = feltTexture(f.felt || '#17804a', 3);
      tex.repeat.set(1.2, 0.8);
      const bed = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32).rotateX(-Math.PI / 2), ps1Material({ map: tex, affine: 0.3, gloss: 0.03, shine: 6 }));
      bed.userData.own = true; this.root.add(bed);
      if (f.fx) {
        const k = { sweep: 1, sparkle: 2, radar: 3 }[f.fx] || 0, c = { sweep: 0xffe0b0, sparkle: 0xc8f0ff, radar: 0x8fd14f }[f.fx];
        const ov = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32).rotateX(-Math.PI / 2), feltFxMaterial(k, c));
        ov.position.y = 0.0009; ov.userData.own = true; ov.scale.set(4, 1, 4); this.root.add(ov);
      }
      put(ballSet, 0, -0.08, 0.03); put(ballSet, 8, 0.02, -0.04); put(ballSet, 3, 0.1, 0.04); put(ballSet, 11, 0.05, 0.08);
      this.frame = { dist: 0.62, target: new THREE.Vector3(0, 0, 0) };
      this.pitch = 0.75;
    } else {
      const bed = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5).rotateX(-Math.PI / 2), ps1Material({ map: feltTexture('#17604a', 3), affine: 0.3 }));
      bed.userData.own = true; this.root.add(bed);
      this.fx = new FX(this.root);
      this.fx.density = 1;
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16).rotateX(-Math.PI / 2), ps1Material({ color: 0x000000, unlit: true }));
      hole.position.set(0.3, 0.001, 0); hole.userData.own = true; this.root.add(hole);
      const b = put(ballSet, spec.kind === 'trail' ? 0 : 3, 0, 0);
      this.mover = { mesh: b, id: 'sc' + Math.random(), num: spec.kind === 'trail' ? 0 : 3, kind: spec.kind === 'trail' ? 'cue' : 'object', r: R, x: 0, y: 0, z: 0, vx: 0, vz: 0, state: 'table', tags: {} };
      this.frame = { dist: 0.9, target: new THREE.Vector3(0, 0, 0) };
      this.pitch = 0.9;
    }
    this.start();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.tick(dt);
    };
    requestAnimationFrame(loop);
  }
  stop() { this.running = false; }

  tick(dt) {
    if (!this.canvas.isConnected) { this.stop(); return; }
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const modern = shared.uModern.value > 0.5 || this.spec?.classic;
    const scale = modern ? Math.min(2, window.devicePixelRatio || 1) : 0.45;       // PS1: a low-res image, scaled up crisp
    const cw = Math.max(2, Math.round(w * scale)), ch = Math.max(2, Math.round(h * scale));
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.renderer.setSize(cw, ch, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.canvas.classList.toggle('px', !modern);
    this.t += dt;
    this.touched = Math.max(0, (this.touched || 0) - dt);
    if (!this.touched) this.yaw += dt * (this.spec?.kind === 'cue' ? 0.35 : 0.25);
    for (const b of this.balls) if (b !== this.mover?.mesh) b.rotation.y += dt * 0.5;
    if (this.cue) {
      this.cue.update(dt, this.t);
      this.cue.mesh.rotation.x = this.yaw * 1.4;
      const k = Math.max(0, 1 - this.zoom);               // zoomed in: look at the butt
      this.frame.target.set(-0.52 * k * Math.cos(0.3) / 0.45, -0.52 * k * Math.sin(0.3) / 0.45, 0);
    }
    if (this.mover) this.moveDemo(dt);
    const f = this.frame, d = f.dist * this.zoom;
    const yaw = this.cue ? 0 : this.yaw, pitch = this.cue ? 0.18 : this.pitch;
    this.camera.position.set(f.target.x + Math.sin(yaw) * Math.cos(pitch) * d, f.target.y + Math.sin(pitch) * d, f.target.z + Math.cos(yaw) * Math.cos(pitch) * d);
    this.camera.lookAt(f.target);
    // the game's lights are shared: they sit above the table, so the preview is lit like the table
    this.renderer.render(this.scene, this.camera);
  }

  // a ball running a figure of eight (trails) or dropping into a pocket (pocket fx)
  moveDemo(dt) {
    const m = this.mover, t = this.t;
    if (this.spec.kind === 'trail') {
      const k = t * 5.5;
      const x = Math.sin(k) * 0.32, z = Math.sin(k * 2) * 0.12;
      m.vx = (x - m.x) / Math.max(dt, 1e-3); m.vz = (z - m.z) / Math.max(dt, 1e-3);
      m.x = x; m.z = z;
      if (!this.trailOn) { this.trailOn = true; }
      const kind = this.spec.item.id;
      if (['light', 'electric', 'fire', 'void'].includes(kind)) this.fx.trail(m, { light: '#ffffff', electric: '#6ac8ff', fire: '#ff6a18', void: '#9a4bff' }[kind], kind === 'electric' ? 0.026 : 0.042);
      this.g.trailMark?.(this.fx, kind, m);
    } else {
      const cyc = t % 1.6;
      const x = cyc < 0.9 ? -0.3 + cyc / 0.9 * 0.6 : 0.3;
      m.x = x; m.z = 0;
      m.mesh.visible = cyc < 0.9;
      if (cyc >= 0.9 && !this.fired) { this.fired = true; this.g.pocketEffect?.(this.fx, this.spec.item.id, { x: 0.3, z: 0 }, 0xe0262a, 1, null); }
      if (cyc < 0.9) this.fired = false;
    }
    m.mesh.position.set(m.x, R, m.z);
    this.fx.update(dt);
  }
}
