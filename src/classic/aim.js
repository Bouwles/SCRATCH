// Classic aiming aids: hairline guides, a quiet ghost ball, the ball-in-hand
// ring and the head string. Nothing glows; the table should stay clean.

import * as THREE from 'three';
import { TABLE } from '../config.js';
import { ps1Material } from '../render/materials.js';

const R = TABLE.R;
const Y = 0.0032;

export class ClassicAim {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    const mat = (color, opacity) => ps1Material({ color, unlit: true, fog: 0, transparent: true, opacity, depthWrite: false });
    const lineGeo = new THREE.PlaneGeometry(1, 1);
    lineGeo.rotateX(-Math.PI / 2);
    lineGeo.translate(0.5, 0, 0);            // starts at the origin, runs along +x
    this.lineMat = mat(0xf4efe4, 0.42);
    this.objMat = mat(0xf4efe4, 0.36);
    this.tanMat = mat(0xf4efe4, 0.16);
    this.line = new THREE.Mesh(lineGeo, this.lineMat);
    this.obj = new THREE.Mesh(lineGeo, this.objMat);
    this.tan = new THREE.Mesh(lineGeo, this.tanMat);
    const ringGeo = new THREE.RingGeometry(R * 0.955, R, 64);
    ringGeo.rotateX(-Math.PI / 2);
    this.ghostMat = mat(0xf4efe4, 0.55);
    this.ghost = new THREE.Mesh(ringGeo, this.ghostMat);
    const fillGeo = new THREE.CircleGeometry(R * 0.955, 48);
    fillGeo.rotateX(-Math.PI / 2);
    this.ghostFill = new THREE.Mesh(fillGeo, mat(0xf4efe4, 0.05));
    const placeGeo = new THREE.RingGeometry(R * 1.18, R * 1.3, 64);
    placeGeo.rotateX(-Math.PI / 2);
    this.placeMat = mat(0xf4efe4, 0.6);
    this.place = new THREE.Mesh(placeGeo, this.placeMat);
    // the head string (kitchen line) for a break or a break scratch
    const head = new THREE.PlaneGeometry(0.0024, TABLE.W * 2);
    head.rotateX(-Math.PI / 2);
    this.head = new THREE.Mesh(head, mat(0xf4efe4, 0.22));
    this.head.position.set(TABLE.headX, Y - 0.0004, 0);
    this.group.add(this.line, this.obj, this.tan, this.ghost, this.ghostFill, this.place, this.head);
    this.level = 'full';
    this.hide();
    this.hidePlace();
    this.showHead(false);
  }

  seg(mesh, x, z, dx, dz, len, width) {
    mesh.visible = len > 0.002;
    mesh.position.set(x, Y, z);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.scale.set(Math.max(0.001, len), 1, width);
  }

  show(cx, cz, dx, dz, pred, warn = false) {
    const lvl = this.level;
    const on = lvl !== 'off';
    this.line.visible = this.obj.visible = this.tan.visible = this.ghost.visible = this.ghostFill.visible = false;
    if (!on) return;
    const tint = warn ? 0xe07a6a : 0xf4efe4;
    for (const m of [this.lineMat, this.objMat, this.tanMat, this.ghostMat]) m.uniforms.uColor.value.set(tint);
    const len = Math.max(0, pred.t - R);
    if (lvl === 'short') {
      this.seg(this.line, cx + dx * R, cz + dz * R, dx, dz, Math.min(len, 0.32), 0.0026);
      return;
    }
    this.seg(this.line, cx + dx * R, cz + dz * R, dx, dz, len, 0.0026);
    this.ghost.visible = this.ghostFill.visible = true;
    this.ghost.position.set(pred.x, Y + 0.0002, pred.z);
    this.ghostFill.position.set(pred.x, Y + 0.0001, pred.z);
    if (pred.type === 'ball') {
      const b = pred.ball, nx = pred.nx, nz = pred.nz;
      const cos = Math.max(0, dx * nx + dz * nz);
      this.seg(this.obj, b.x + nx * b.r, b.z + nz * b.r, nx, nz, 0.06 + 0.26 * cos, 0.0026);
      let tx = dx - nx * cos, tz = dz - nz * cos;
      const tl = Math.hypot(tx, tz);
      if (tl > 0.05) this.seg(this.tan, pred.x, pred.z, tx / tl, tz / tl, 0.05 + 0.12 * tl, 0.0022);
    }
  }

  hide() { this.line.visible = this.obj.visible = this.tan.visible = this.ghost.visible = this.ghostFill.visible = false; }

  showPlace(x, z, valid, t) {
    this.place.visible = true;
    this.place.position.set(x, Y, z);
    this.placeMat.uniforms.uColor.value.set(valid ? 0xf4efe4 : 0xe06a5a);
    this.placeMat.uniforms.uOpacity.value = valid ? 0.45 + Math.sin(t * 4) * 0.15 : 0.75;
  }
  hidePlace() { this.place.visible = false; }
  showHead(on) { this.head.visible = on; }
}
