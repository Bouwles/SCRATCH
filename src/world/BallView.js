// Visual representation of physics balls: chunky low-poly spheres with the
// skin shader, rolling rotation from angular velocity, pixel blob shadows.

import * as THREE from 'three';
import { TABLE } from '../config.js';
import { ballMaterial, ps1Material } from '../render/materials.js';
import { circleTexture, canvas, toTex } from '../render/textures.js';
import { paintBall, hueFor } from '../render/ballpaint.js';

const R = TABLE.R;

function goldenTexture() {
  const c = canvas(128, 64), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#fff6c0'); g.addColorStop(0.5, '#ffc020'); g.addColorStop(1, '#a06000');
  x.fillStyle = g; x.fillRect(0, 0, 128, 64);
  x.fillStyle = '#fff8e0';
  for (const u of [32, 96]) {
    x.beginPath();
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r = k % 2 ? 5 : 11; x.lineTo(u + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    x.fill();
  }
  return toTex(c, { wrap: false });
}

function obstacleTexture(kind) {
  const c = canvas(32, 32), x = c.getContext('2d');
  if (kind === 'bumper') {
    x.fillStyle = '#ff2bd6'; x.fillRect(0, 0, 32, 32);
    x.fillStyle = '#ffffff'; for (let i = 0; i < 32; i += 8) x.fillRect(i, 0, 4, 32);
  } else {
    x.fillStyle = '#4a4a54'; x.fillRect(0, 0, 32, 32);
    x.fillStyle = '#2a2a30'; for (let i = 0; i < 12; i++) x.fillRect(Math.random() * 32, Math.random() * 32, 4, 2);
    x.fillStyle = '#ffcc00'; x.fillRect(0, 26, 32, 3);
  }
  return toTex(c);
}

function bonusTexture() {
  const c = canvas(128, 64), x = c.getContext('2d');
  for (let i = 0; i < 128; i += 16) { x.fillStyle = (i / 16) % 2 ? '#ff2bd6' : '#2bf0ff'; x.fillRect(i, 0, 16, 64); }
  x.fillStyle = '#fff';
  for (const u of [32, 96]) { x.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r = k % 2 ? 5 : 11; x.lineTo(u + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill(); }
  return toTex(c, { wrap: false });
}

function softShadowTexture() {
  const c = canvas(64, 64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.75)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return toTex(c, { wrap: false, linear: true });
}

export class BallView {
  constructor(parent, physics) {
    this.physics = physics;
    this.group = new THREE.Group();
    parent.add(this.group);
    this.geo = new THREE.SphereGeometry(R, 14, 10);
    this.shadowGeo = new THREE.PlaneGeometry(R * 3.2, R * 3.2);
    this.shadowGeo.rotateX(-Math.PI / 2);
    this.shadowMat = ps1Material({ map: circleTexture(16, false, '#000'), transparent: true, unlit: true, opacity: 0.6, depthWrite: false, fog: 0 });
    this.views = new Map();
    this.skin = null;
    this.texCache = new Map();
    this.golden = goldenTexture();
    this.obstacleViews = new Map();
    this.lampPos = [{ x: -0.66, z: 0 }, { x: 0, z: 0 }, { x: 0.66, z: 0 }];
    this.modern = false;
    this.castShadows = true;   // classic mode can switch the per-lamp shadows off
    // modern mode: soft contact shadow + one soft cast shadow per lamp
    this.softTex = softShadowTexture();
    this.softMat = ps1Material({ map: this.softTex, transparent: true, unlit: true, opacity: 0.55, depthWrite: false, fog: 0 });
    this.castMat = ps1Material({ map: this.softTex, transparent: true, unlit: true, opacity: 0.22, depthWrite: false, fog: 0 });
  }

  // swap geometry detail and shadow style for the graphics mode
  setModern(modern) {
    if (this.modern === modern) return;
    this.modern = modern;
    this.geo.dispose();
    this.geo = modern ? new THREE.SphereGeometry(R, 40, 28) : new THREE.SphereGeometry(R, 14, 10);
    for (const t of this.texCache.values()) t.dispose();
    this.texCache.clear();
    for (const [, v] of this.views) this.dropView(v);
    this.views.clear();
  }

  dropView(v) {
    this.group.remove(v.mesh, v.shadow, ...(v.casts || []));
    if (v.ring) { this.group.remove(v.ring); v.ring.geometry.dispose(); v.ring.material.dispose(); }
    v.mat.dispose();
  }

  setSkin(skin) {
    this.skin = skin;
    for (const t of this.texCache.values()) t.dispose();
    this.texCache.clear();
    for (const [, v] of this.views) this.dropView(v);
    this.views.clear();
  }

  texFor(ball) {
    const key = ball.kind === 'golden' ? 'gold' : ball.kind === 'bonus' ? 'bonus' : ball.num;
    if (key === 'gold') return this.golden;
    if (key === 'bonus') return this.bonus || (this.bonus = bonusTexture());
    if (!this.texCache.has(key)) this.texCache.set(key, this.skin.texture ? this.skin.texture(ball.num) : paintBall(ball.num, this.skin, this.modern ? 'modern' : 'pixel'));
    return this.texCache.get(key);
  }

  viewFor(ball) {
    let v = this.views.get(ball.id);
    if (!v) {
      const skinMat = ball.kind === 'golden' ? { reflect: 0.8, spec: 2, rim: 0xffd040, rimAmt: 1, emissiveAmt: 0.4 }
        : ball.kind === 'bonus' ? { reflect: 0.4, spec: 1.6, rim: 0xff2bd6, rimAmt: 1, emissiveAmt: 0.6, fx: 3 } : this.skin.mat;
      const mat = ballMaterial(this.texFor(ball), { ...skinMat, fx: ball.kind === 'golden' || ball.kind === 'bonus' ? skinMat.fx : this.skin.fx ?? skinMat.fx });
      // which part of the ball the set's effect may touch (see ballpaint.js)
      const n = ball.num;
      mat.uniforms.uKind.value = ball.kind === 'golden' || ball.kind === 'bonus' ? 4 : n === 0 ? 0 : n === 8 ? 3 : n >= 9 ? 2 : 1;
      if (this.skin.pal) mat.uniforms.uHue.value.set(hueFor(this.skin, n));
      mat.uniforms.uSeed.value = (n * 7.31) % 10;
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      const shadow = new THREE.Mesh(this.shadowGeo, this.modern ? this.softMat : this.shadowMat);
      this.group.add(mesh, shadow);
      const casts = [];
      if (this.modern) for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(this.shadowGeo, this.castMat); casts.push(c); this.group.add(c); }
      // tag rings (target / forbidden)
      v = { mesh, shadow, casts, mat, flash: 0, ring: null, baseEmit: mat.uniforms.uEmissiveAmt.value };
      this.views.set(ball.id, v);
    }
    return v;
  }

  // a round ring marks a target; a square one marks a ball you must not sink (shape, not just colour)
  setTag(ball, color, square = false) {
    const v = this.viewFor(ball);
    if (v.ring) { this.group.remove(v.ring); v.ring.geometry.dispose(); v.ring.material.dispose(); v.ring = null; }
    if (color == null) return;
    const geo = square ? new THREE.RingGeometry(R * 1.45, R * 1.95, 4, 1, Math.PI / 4) : new THREE.RingGeometry(R * 1.35, R * 1.75, 12);
    const ring = new THREE.Mesh(geo, ps1Material({ color, additive: true, unlit: true, fog: 0 }));
    ring.rotation.x = -Math.PI / 2;
    this.group.add(ring);
    v.ring = ring;
  }

  flash(ball, amt = 1) { const v = this.views.get(ball.id); if (v) v.flash = amt; }

  syncObstacles() {
    const seen = new Set();
    for (const o of this.physics.obstacles) {
      seen.add(o);
      if (!this.obstacleViews.has(o)) {
        const h = o.kind === 'bumper' ? 0.05 : 0.07;
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r * 1.1, h, 8), ps1Material({ map: obstacleTexture(o.kind), emissive: o.kind === 'bumper' ? 0x401030 : 0 }));
        mesh.position.set(o.x, h / 2, o.z);
        mesh.userData.h = h;
        mesh.scale.y = 0.01;
        this.group.add(mesh);
        this.obstacleViews.set(o, { mesh, pop: 0, t: 0 });
      }
    }
    for (const [o, v] of this.obstacleViews) {
      if (!seen.has(o)) {
        this.group.remove(v.mesh);
        v.mesh.geometry.dispose();
        v.mesh.material.uniforms.map.value?.dispose();
        v.mesh.material.dispose();
        this.obstacleViews.delete(o);
      }
    }
  }

  popObstacle(o) { const v = this.obstacleViews.get(o); if (v) v.pop = 1; }

  update(dt, t) {
    const q = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    const alive = new Set();
    for (const b of this.physics.balls) {
      if (b.state === 'pocketed') continue;
      alive.add(b.id);
      const v = this.viewFor(b);
      v.mesh.visible = true;
      v.mesh.position.set(b.x, b.r + b.y, b.z);
      const rs = b.r / R;
      // rolling rotation
      const w = Math.hypot(b.wx, b.wy, b.wz);
      if (w > 1e-4 && b.state === 'table') {
        axis.set(b.wx / w, b.wy / w, b.wz / w);
        q.setFromAxisAngle(axis, w * dt);
        v.mesh.quaternion.premultiply(q);
      }
      if (b.state === 'falling') {
        const k = Math.max(0, 1 + b.y * 3);
        v.mesh.scale.setScalar(Math.max(0.3, k) * rs);
      } else v.mesh.scale.setScalar(rs);
      // shadow: offset away from nearest lamp, fades as the ball drops
      let lx = 0, lz = 0, bd = 1e9;
      for (const L of this.lampPos) { const d = Math.hypot(b.x - L.x, b.z - L.z); if (d < bd) { bd = d; lx = L.x; lz = L.z; } }
      const ox = (b.x - lx) * 0.06, oz = (b.z - lz) * 0.06;
      v.shadow.visible = b.state === 'table';
      v.shadow.position.set(b.x + ox, 0.0025, b.z + oz);
      const hs = 1 + b.y * 6;
      v.shadow.scale.setScalar(Math.max(0.5, hs) * rs * (this.modern ? 0.8 : 1));
      if (this.modern) {
        // stretched soft shadows cast away from each of the three lamps
        v.casts.forEach((c, i) => {
          const L = this.lampPos[i];
          const dx = b.x - L.x, dz = b.z - L.z, d = Math.hypot(dx, dz) || 1e-3;
          const len = 1 + Math.min(1.6, d * 1.8);
          c.visible = b.state === 'table' && this.castShadows;
          c.position.set(b.x + dx / d * R * 0.9 * len * rs, 0.0022 + i * 0.0002, b.z + dz / d * R * 0.9 * len * rs);
          c.rotation.set(0, -Math.atan2(dz, dx), 0);
          c.scale.set(len * rs * (1 + b.y * 4), 1, rs * (1 + b.y * 4));
        });
        v.shadow.position.set(b.x, 0.0026, b.z);
      }
      v.flash = Math.max(0, v.flash - dt * 4);
      v.mat.uniforms.uFlash.value = v.flash;
      if (this.glow || v.glowing) { v.mat.uniforms.uEmissiveAmt.value = v.baseEmit + (this.glow || 0) * (b.kind === 'cue' ? 0.6 : 1.4); v.glowing = this.glow > 0.001; }
      v.mat.uniforms.uOpacity.value = b.ghost > 0 && b.kind === 'cue' ? 0.55 : (this.skin.mat.opacity ?? 1);
      if (v.ring) {
        v.ring.visible = b.state === 'table';
        v.ring.position.set(b.x, 0.004, b.z);
        v.ring.rotation.z = t * 2;
        v.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
      }
    }
    for (const [id, v] of this.views) {
      if (!alive.has(id)) { v.mesh.visible = false; v.shadow.visible = false; for (const c of v.casts || []) c.visible = false; if (v.ring) v.ring.visible = false; }
    }
    // obstacles grow in
    for (const [o, v] of this.obstacleViews) {
      v.t = Math.min(1, v.t + dt * 3);
      v.pop = Math.max(0, v.pop - dt * 5);
      const s = 1 - Math.pow(1 - v.t, 3);
      v.mesh.scale.set(1 + v.pop * 0.3, s * (1 + v.pop * 0.5), 1 + v.pop * 0.3);
      v.mesh.position.y = v.mesh.userData.h / 2 * s;
      if (o.kind === 'bumper') v.mesh.rotation.y = t * 1.5;
    }
  }

  prune() {
    // remove views for balls no longer in physics
    const ids = new Set(this.physics.balls.map(b => b.id));
    for (const [id, v] of this.views) {
      if (!ids.has(id)) { this.dropView(v); this.views.delete(id); }
    }
  }
}
