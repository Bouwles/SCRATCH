// The cue stick and the aim guide (dotted line, ghost ball, short deflection
// hints — deliberately not a full trajectory prediction).

import * as THREE from 'three';
import { TABLE } from '../config.js';
import { ps1Material } from '../render/materials.js';
import { cueTexture } from '../render/textures.js';

const R = TABLE.R;
const CUE_LEN = 1.45;

export class Cue {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    const geo = new THREE.CylinderGeometry(0.0062, 0.0145, CUE_LEN, 8, 6);
    // put tip at origin, butt along -y... we then rotate so tip points +x
    geo.translate(0, -CUE_LEN / 2, 0);
    geo.rotateZ(-Math.PI / 2);    // tip at origin, butt towards -x
    // flip uv so v=1 is tip
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, ps1Material({}));
    this.pivot = new THREE.Group();
    this.pivot.add(this.mesh);
    this.group.add(this.pivot);
    this.visible = true;
    this.pull = 0;        // current pull-back distance
    this.thrust = 0;      // animation state
    this.alpha = 1;
    this.elev = 0.09;
  }

  setModern(modern) {
    const geo = new THREE.CylinderGeometry(0.0062, 0.0145, CUE_LEN, modern ? 28 : 8, modern ? 12 : 6);
    geo.translate(0, -CUE_LEN / 2, 0);
    geo.rotateZ(-Math.PI / 2);
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    if (this.skin) this.setSkin(this.skin);
  }

  setSkin(skin) {
    this.skin = skin;
    const tex = skin.texture ? skin.texture() : cueTexture(skin);
    const m = skin.mat || {};
    const glassy = (m.opacity ?? 1) < 1;
    const mat = ps1Material({ map: tex, emissive: new THREE.Color(1, 1, 1).multiplyScalar(m.emissive || 0), affine: 0.2, opacity: m.opacity ?? 1, screenDoor: glassy, gloss: m.gloss ?? 0.9, shine: m.shine ?? 80 });
    this.mesh.material.uniforms?.map?.value?.dispose();
    this.mesh.material.dispose();
    this.mesh.material = mat;
  }

  // place the cue behind (x,z) aiming along angle, pulled back by `pull`
  place(x, z, angle, pull, elev = this.elev) {
    this.pivot.position.set(x, R * 1.05, z);
    this.pivot.rotation.set(0, -angle, 0);
    this.mesh.rotation.set(0, 0, -elev);
    this.mesh.position.set(-(R + 0.006 + pull) * Math.cos(elev), 0, 0);
    this.mesh.position.y = (R + 0.006 + pull) * Math.sin(elev);
  }

  update(dt, t) {
    if (this.skin?.mat?.glitch) {
      this.mesh.position.z = Math.random() < 0.05 ? (Math.random() - 0.5) * 0.01 : 0;
    }
    this.group.visible = this.visible;
  }
}

export class AimGuide {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    const dotGeo = new THREE.PlaneGeometry(0.013, 0.013);
    dotGeo.rotateX(-Math.PI / 2);
    this.max = 90;
    this.dots = new THREE.InstancedMesh(dotGeo, ps1Material({ color: 0xffffff, unlit: true, additive: true, fog: 0 }), this.max);
    this.dots.frustumCulled = false;
    this.objDots = new THREE.InstancedMesh(dotGeo, ps1Material({ color: 0xffe23b, unlit: true, additive: true, fog: 0 }), 40);
    this.objDots.frustumCulled = false;
    this.cueDots = new THREE.InstancedMesh(dotGeo, ps1Material({ color: 0x2bf0ff, unlit: true, additive: true, fog: 0 }), 30);
    this.cueDots.frustumCulled = false;
    // object-ball bank preview (laser sight / bank tables): where it comes off the rail
    this.bankDots = new THREE.InstancedMesh(dotGeo, ps1Material({ color: 0xff9a2b, unlit: true, additive: true, fog: 0 }), 40);
    this.bankDots.frustumCulled = false;
    this.ghost = new THREE.Mesh(new THREE.RingGeometry(R * 0.78, R * 1.02, 16), ps1Material({ color: 0xffffff, unlit: true, additive: true, fog: 0 }));
    this.ghost.rotation.x = -Math.PI / 2;
    this.cross = new THREE.Mesh(new THREE.RingGeometry(0.0, R * 0.25, 4), ps1Material({ color: 0xff2b4a, unlit: true, additive: true, fog: 0 }));
    this.cross.rotation.x = -Math.PI / 2;
    this.group.add(this.dots, this.objDots, this.cueDots, this.bankDots, this.ghost, this.cross);
    this.m = new THREE.Matrix4();
    this.visible = false;
    this.extend = 1;   // Laser Sight relic multiplier
    this.level = 'full';   // full | reduced | minimal | none
  }

  setDots(mesh, x0, z0, dx, dz, len, spacing, max, y = 0.003, phase = 0) {
    const n = Math.min(max, Math.floor(len / spacing));
    for (let i = 0; i < max; i++) {
      if (i < n) {
        const d = (i + phase) * spacing;
        this.m.makeTranslation(x0 + dx * d, y, z0 + dz * d);
      } else this.m.makeScale(0, 0, 0);
      mesh.setMatrixAt(i, this.m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  // pred from Physics.predict
  show(cx, cz, dx, dz, pred, t, colorWarn = false, bank = null) {
    const lvl = this.level;
    if (bank && lvl === 'full') {
      // object ball: dots to the cushion, then a short reflected leg
      const phase0 = (t * 2.5) % 1;
      this.setDots(this.objDots, bank.ox, bank.oz, bank.dx, bank.dz, bank.t, 0.022, 40, 0.004, phase0);
      this.setDots(this.bankDots, bank.hx, bank.hz, bank.rx, bank.rz, 0.3 * this.extend, 0.022, 40, 0.004, phase0);
    } else this.setDots(this.bankDots, 0, 0, 0, 0, 0, 1, 40);
    this.group.visible = lvl !== 'none';
    if (lvl === 'none') return;
    const phase = (t * 2.5) % 1;
    const len = Math.max(0, pred.t);
    if (lvl === 'minimal') {
      // just a short pointer from the cue ball: you read the angle yourself
      this.setDots(this.dots, cx + dx * TABLE.R, cz + dz * TABLE.R, dx, dz, Math.min(len - TABLE.R, 0.12), 0.03, this.max, 0.003, phase);
      this.ghost.visible = false; this.cross.visible = false;
      this.setDots(this.objDots, 0, 0, 0, 0, 0, 1, 40);
      this.setDots(this.cueDots, 0, 0, 0, 0, 0, 1, 30);
      return;
    }
    this.setDots(this.dots, cx + dx * TABLE.R, cz + dz * TABLE.R, dx, dz, len - TABLE.R, 0.03, this.max, 0.003, phase);
    this.ghost.visible = true;
    this.ghost.position.set(pred.x, 0.004, pred.z);
    this.ghost.material.uniforms.uColor.value.set(colorWarn ? 0xff3040 : 0xffffff);
    this.cross.visible = false;
    if (pred.type === 'ball') {
      const ox = pred.ball.x, oz = pred.ball.z;
      const nx = pred.nx, nz = pred.nz;
      // cut angle factor: object ball goes along n with speed ∝ cos
      const cos = Math.max(0, dx * nx + dz * nz);
      const objLen = lvl === 'reduced' ? 0.05 : (0.07 + 0.2 * cos) * this.extend;
      if (!bank || lvl !== 'full') this.setDots(this.objDots, ox + nx * pred.ball.r, oz + nz * pred.ball.r, nx, nz, objLen, 0.022, 40, 0.004, phase);
      // cue tangent direction
      let tx = dx - nx * cos, tz = dz - nz * cos;
      const tl = Math.hypot(tx, tz);
      if (tl > 0.05 && lvl === 'full') {
        tx /= tl; tz /= tl;
        this.setDots(this.cueDots, pred.x, pred.z, tx, tz, (0.05 + 0.1 * tl) * this.extend, 0.022, 30, 0.004, phase);
      } else this.setDots(this.cueDots, 0, 0, 0, 0, 0, 1, 30);
    } else {
      this.setDots(this.objDots, 0, 0, 0, 0, 0, 1, 40);
      if (pred.type === 'cushion' && this.extend > 1) {
        // Laser Sight: show the first cushion bounce direction
        const sg = pred.seg;
        const ex = sg.bx - sg.ax, ez = sg.bz - sg.az;
        const l = Math.hypot(ex, ez);
        let nx = -ez / l, nz = ex / l;
        if (nx * dx + nz * dz > 0) { nx = -nx; nz = -nz; }
        const dot = dx * nx + dz * nz;
        const rx = dx - 2 * dot * nx, rz = dz - 2 * dot * nz;
        this.setDots(this.cueDots, pred.x, pred.z, rx, rz, 0.35, 0.022, 30, 0.004, phase);
      } else this.setDots(this.cueDots, 0, 0, 0, 0, 0, 1, 30);
    }
  }

  hide() { this.group.visible = false; }
}
