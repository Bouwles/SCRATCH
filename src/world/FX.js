// Crunchy effects: square pixel particles, shockwave rings, lightning bolts
// and motion trails. All live in the table's local space.

import * as THREE from 'three';
import { particleMaterial, ps1Material } from '../render/materials.js';
import { canvas, toTex, rng } from '../render/textures.js';

const MAXP = 3000;
const MAX_SCARS = 24;

// scorch marks and cracks left on the felt by the loudest moments
let scorchTex = null, crackTex = null;
function scarTextures() {
  if (scorchTex) return;
  const a = canvas(32, 32), x = a.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.55, 'rgba(10,4,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  const r = rng(5);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.4})`; const ang = r() * 6.28, d = r() * 14; x.fillRect(16 + Math.cos(ang) * d, 16 + Math.sin(ang) * d, 1, 1); }
  scorchTex = toTex(a, { wrap: false });
  const c = canvas(32, 32), y = c.getContext('2d');
  y.strokeStyle = 'rgba(0,0,0,0.8)'; y.lineWidth = 1;
  const q = rng(9);
  for (let k = 0; k < 5; k++) {
    y.beginPath(); let px = 16, pz = 16; y.moveTo(px, pz);
    const ang = k * 1.25 + q();
    for (let j = 0; j < 5; j++) { px += Math.cos(ang + (q() - 0.5)) * 3.2; pz += Math.sin(ang + (q() - 0.5)) * 3.2; y.lineTo(px, pz); }
    y.stroke();
  }
  crackTex = toTex(c, { wrap: false });
}

export class FX {
  constructor(parent) {
    this.root = new THREE.Group();
    parent.add(this.root);
    // --- particles
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAXP * 3);
    this.col = new Float32Array(MAXP * 4);
    this.size = new Float32Array(MAXP);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geo, particleMaterial());
    this.points.frustumCulled = false;
    this.root.add(this.points);
    this.parts = [];
    this.free = [];
    for (let i = MAXP - 1; i >= 0; i--) this.free.push(i);
    // --- rings
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.8, 1, 24);
    this.ringGeo.rotateX(-Math.PI / 2);
    // --- lightning
    this.bolts = [];
    // --- trails
    this.trails = new Map();
    this.density = 1;       // particle setting multiplier
    // --- scars (reset between tables)
    this.scars = [];
    this.scarGeo = new THREE.PlaneGeometry(1, 1);
    this.scarGeo.rotateX(-Math.PI / 2);
  }

  scar(x, z, kind = 'scorch', r = 0.12) {
    if (Math.abs(x) > 1 || Math.abs(z) > 0.5) return;
    scarTextures();
    const m = new THREE.Mesh(this.scarGeo, ps1Material({ map: kind === 'crack' ? crackTex : scorchTex, transparent: true, depthWrite: false, fog: 0.6 }));
    m.position.set(x, 0.0012 + this.scars.length * 0.00002, z);
    m.rotation.y = Math.random() * 6.28;
    m.scale.setScalar(Math.max(0.05, r * 2));
    m.renderOrder = 1;
    this.root.add(m);
    this.scars.push(m);
    if (this.scars.length > MAX_SCARS) { const old = this.scars.shift(); this.root.remove(old); old.material.dispose(); }
  }

  clearScars() {
    for (const m of this.scars) { this.root.remove(m); m.material.dispose(); }
    this.scars = [];
  }

  // dust shaken down from the ceiling onto the table
  dust(x = 0, z = 0, n = 16) {
    n = Math.max(1, Math.round(n * this.density));
    for (let k = 0; k < n; k++) {
      const px = x + (Math.random() - 0.5) * 1.6, pz = z + (Math.random() - 0.5) * 0.9;
      this.spawn(px, 0.9 + Math.random() * 0.5, pz, (Math.random() - 0.5) * 0.05, -0.1, (Math.random() - 0.5) * 0.05, Math.random() < 0.5 ? 0x9a9488 : 0x6a655c, 1.6 + Math.random(), 1, { grav: 0.35, drag: 2.5 });
    }
  }

  spawn(x, y, z, vx, vy, vz, color, life = 0.6, size = 2, opts = {}) {
    if (!this.free.length) return;
    const i = this.free.pop();
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    this.parts.push({ i, x, y, z, vx, vy, vz, r: c.r, g: c.g, b: c.b, life, max: life, size, grav: opts.grav ?? 3.5, drag: opts.drag ?? 1.5, floor: opts.floor ?? 0.002, flicker: opts.flicker ?? false });
  }

  burst(x, y, z, color, n = 20, speed = 1.2, opts = {}) {
    n = Math.max(1, Math.round(n * this.density));
    const cols = Array.isArray(color) ? color : [color];
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const up = opts.up ?? 0.8;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, z, Math.cos(a) * s, (Math.random() * up + (opts.minUp ?? 0.1)) * s * 1.2, Math.sin(a) * s,
        cols[k % cols.length], (opts.life ?? 0.6) * (0.5 + Math.random() * 0.8), opts.size ?? (1 + (Math.random() * 2 | 0)), opts);
    }
  }

  // directional spray (e.g. chalk dust from the cue tip)
  spray(x, y, z, dx, dz, color, n = 10, speed = 0.6, spread = 0.8, opts = {}) {
    n = Math.max(1, Math.round(n * this.density));
    for (let k = 0; k < n; k++) {
      const a = Math.atan2(dz, dx) + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, z, Math.cos(a) * s, Math.random() * 0.4 * s, Math.sin(a) * s, color, (opts.life ?? 0.5) * (0.5 + Math.random()), opts.size ?? 1, opts);
    }
  }

  ring(x, z, color, maxR = 0.4, life = 0.4, y = 0.004) {
    const m = new THREE.Mesh(this.ringGeo, ps1Material({ color, additive: true, unlit: true, fog: 0 }));
    m.position.set(x, y, z);
    m.scale.setScalar(0.01);
    this.root.add(m);
    this.rings.push({ m, life, max: life, maxR });
  }

  lightning(ax, az, bx, bz, color = 0xa0e0ff, y = 0.03) {
    const pts = [];
    const segs = 7;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const j = k === 0 || k === segs ? 0 : 0.04;
      pts.push(new THREE.Vector3(ax + (bx - ax) * t + (Math.random() - 0.5) * j, y + Math.random() * j, az + (bz - az) * t + (Math.random() - 0.5) * j));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    this.root.add(line);
    this.bolts.push({ line, life: 0.25, max: 0.25 });
    for (const p of pts) if (Math.random() < 0.5) this.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 0.6, Math.random() * 0.6, (Math.random() - 0.5) * 0.6, color, 0.3, 1, { grav: 1 });
  }

  // RAJIS lock-on: four brackets snap shut on a pocket, then fade
  lockon(x, z, color = 0xff3b30) {
    const mat = ps1Material({ color, additive: true, unlit: true, fog: 0 });
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const br = new THREE.Group();
      const h = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.006).rotateX(-Math.PI / 2), mat); h.position.x = -0.012;
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.006, 0.03).rotateX(-Math.PI / 2), mat); v.position.z = -0.012;
      br.add(h, v);
      br.rotation.y = -a + Math.PI / 4;
      br.userData.dir = [Math.cos(a), Math.sin(a)];
      g.add(br);
    }
    g.position.set(x, 0.006, z);
    this.root.add(g);
    this.locks = this.locks || [];
    this.locks.push({ g, mat, t: 0 });
  }

  // --- trails: ribbon following a ball
  trail(ball, color, width = 0.05) {
    let tr = this.trails.get(ball.id);
    if (!tr) {
      const N = 24;
      const geo = new THREE.BufferGeometry();
      // three verts per point (edge, centre, edge) so the ribbon glows in the middle and fades out
      const pos = new Float32Array(N * 3 * 3);
      const col = new Float32Array(N * 3 * 3);
      const idx = [];
      for (let i = 0; i < N - 1; i++) {
        const a = i * 3, b = a + 3;
        idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
      }
      geo.setIndex(idx);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.root.add(mesh);
      tr = { mesh, pts: [], N, color: new THREE.Color(color), width, ball, energy: 0 };
      this.trails.set(ball.id, tr);
    }
    tr.color.set(color);
    tr.width = width;
    return tr;
  }

  updateTrails(dt) {
    for (const [id, tr] of this.trails) {
      const b = tr.ball;
      const sp = b.state === 'table' ? Math.hypot(b.vx, b.vz) : 0;
      const target = sp > 1.6 ? Math.min(1, (sp - 1.6) / 2.5) : 0;
      tr.energy += (target - tr.energy) * Math.min(1, dt * (target > tr.energy ? 20 : 4));
      if (b.state === 'table') {
        tr.pts.unshift([b.x, 0.025 + b.y, b.z]);
        if (tr.pts.length > tr.N) tr.pts.pop();
      } else if (tr.pts.length) tr.pts.pop();
      const pos = tr.mesh.geometry.attributes.position.array;
      const col = tr.mesh.geometry.attributes.color.array;
      const n = tr.pts.length;
      for (let i = 0; i < tr.N; i++) {
        const p = tr.pts[Math.min(i, n - 1)] || [b.x, 0, b.z];
        const q = tr.pts[Math.min(i + 1, n - 1)] || p;
        let dx = p[0] - q[0], dz = p[2] - q[2];
        const l = Math.hypot(dx, dz) || 1;
        const k = 1 - i / tr.N;
        const w = tr.width * k * tr.energy;
        const nx = -dz / l * w, nz = dx / l * w;
        pos.set([p[0] + nx, p[1], p[2] + nz, p[0], p[1], p[2], p[0] - nx, p[1], p[2] - nz], i * 9);
        const c = k * k * tr.energy * (i < n ? 1 : 0);
        col.set([0, 0, 0, tr.color.r * c, tr.color.g * c, tr.color.b * c, 0, 0, 0], i * 9);
      }
      tr.mesh.geometry.attributes.position.needsUpdate = true;
      tr.mesh.geometry.attributes.color.needsUpdate = true;
      if (b.state === 'pocketed' && n === 0) {
        this.root.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        this.trails.delete(id);
      }
    }
  }

  clearTrails() {
    for (const [, tr] of this.trails) { this.root.remove(tr.mesh); tr.mesh.geometry.dispose(); }
    this.trails.clear();
  }

  update(dt) {
    const P = this.pos, C = this.col, S = this.size;
    for (let k = this.parts.length - 1; k >= 0; k--) {
      const p = this.parts[k];
      p.life -= dt;
      if (p.life <= 0) {
        C[p.i * 4 + 3] = 0; S[p.i] = 0;
        this.free.push(p.i);
        this.parts.splice(k, 1);
        continue;
      }
      p.vy -= p.grav * dt;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor && p.floor > -10) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      const a = Math.min(1, p.life / p.max * 1.6) * (p.flicker ? (Math.random() > 0.3 ? 1 : 0.2) : 1);
      P[p.i * 3] = p.x; P[p.i * 3 + 1] = p.y; P[p.i * 3 + 2] = p.z;
      C[p.i * 4] = p.r; C[p.i * 4 + 1] = p.g; C[p.i * 4 + 2] = p.b; C[p.i * 4 + 3] = a;
      S[p.i] = p.size;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.pcolor.needsUpdate = true;
    g.attributes.size.needsUpdate = true;

    for (let k = this.rings.length - 1; k >= 0; k--) {
      const r = this.rings[k];
      r.life -= dt;
      const t = 1 - r.life / r.max;
      r.m.scale.setScalar(0.02 + r.maxR * (1 - (1 - t) * (1 - t)));
      r.m.material.uniforms.uOpacity.value = Math.max(0, 1 - t);
      if (r.life <= 0) { this.root.remove(r.m); r.m.material.dispose(); this.rings.splice(k, 1); }
    }
    for (let k = this.bolts.length - 1; k >= 0; k--) {
      const b = this.bolts[k];
      b.life -= dt;
      b.line.material.opacity = Math.random() > 0.3 ? b.life / b.max : 0.1;
      if (b.life <= 0) { this.root.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); this.bolts.splice(k, 1); }
    }
    this.updateTrails(dt);
    for (let k = (this.locks || []).length - 1; k >= 0; k--) {
      const L = this.locks[k];
      L.t += dt;
      const close = Math.min(1, L.t / 0.18), d = 0.09 - 0.05 * (1 - Math.pow(1 - close, 3));
      for (const br of L.g.children) br.position.set(br.userData.dir[0] * d, 0, br.userData.dir[1] * d);
      L.mat.uniforms.uOpacity.value = L.t < 0.45 ? 1 : Math.max(0, 1 - (L.t - 0.45) / 0.3);
      if (L.t > 0.75) { this.root.remove(L.g); L.g.traverse(o => o.geometry?.dispose()); L.mat.dispose(); this.locks.splice(k, 1); }
    }
  }
}
