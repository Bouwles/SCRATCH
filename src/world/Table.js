// The pool table: felt bed, cushions built from the physics segments, wooden
// rails with pocket cut-outs, pockets, diamonds, cabinet, legs and the lamp.

import * as THREE from 'three';
import { TABLE } from '../config.js';
import { ps1Material, disposeTree } from '../render/materials.js';
import { feltTexture, woodTexture, coneTexture, glowTexture, circleTexture, canvas, toTex } from '../render/textures.js';

const { L, W, R } = TABLE;
const D = TABLE.cushionDepth;
const RW = TABLE.railWidth;
export const FLOOR_Y = -0.78;

function hazardTexture() {
  const c = canvas(32, 8), x = c.getContext('2d');
  x.fillStyle = '#111'; x.fillRect(0, 0, 32, 8);
  x.fillStyle = '#ffcc00';
  for (let i = -8; i < 40; i += 8) { x.beginPath(); x.moveTo(i, 8); x.lineTo(i + 4, 0); x.lineTo(i + 8, 0); x.lineTo(i + 4, 8); x.fill(); }
  return toTex(c);
}

function vortexTexture() {
  const c = canvas(64, 64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.45, 'rgba(10,0,30,1)');
  g.addColorStop(0.75, 'rgba(120,40,255,0.8)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(200,120,255,0.8)';
  x.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    x.beginPath();
    for (let t = 0; t < 1; t += 0.02) {
      const a = k * Math.PI / 2 + t * 5, r = 6 + t * 24;
      x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    x.stroke();
  }
  return toTex(c, { wrap: false });
}

export class Table {
  constructor(physics) {
    this.physics = physics;
    this.group = new THREE.Group();       // tilts for the Crooked Table
    this.static = new THREE.Group();      // table geometry (rebuilt per theme)
    this.group.add(this.static);
    this.pocketFx = [];
    this.lampLights = [];
    this.lampGroup = new THREE.Group();
    this.pocketGroup = new THREE.Group();  // per-pocket fx layers (rebuilt per theme)
    this.group.add(this.pocketGroup);
    this.vortexTex = vortexTexture();
    this.hazardTex = hazardTexture();
    this.lidTex = hazardTexture();
    this.lidTex.repeat.set(3, 3);
    for (const t of [this.vortexTex, this.hazardTex, this.lidTex]) t.userData.keep = true;
    this.tilt = { x: 0, z: 0, tx: 0, tz: 0 };
    this.sway = 0;
  }

  build(theme) {
    this.theme = theme;
    // dispose old
    disposeTree(this.static);
    disposeTree(this.pocketGroup);
    disposeTree(this.lampGroup);
    this.pocketFx = [];
    this.glowMats = [];

    // a theme may bring its own (high resolution) surfaces — Classic mode does
    const T = theme.tex || {};
    const feltTex = T.felt ? T.felt() : feltTexture(theme.felt, 3);
    const felt = ps1Material({ map: feltTex, affine: 0.3, gloss: 0.03, shine: 6, vertexColors: true });
    this.feltMat = felt;
    const cushionMat = ps1Material({ map: T.cushion ? T.cushion() : feltTexture(theme.cushion, 4), affine: 0.3, gloss: 0.04, shine: 8 });
    const woodTex = T.wood ? T.wood() : woodTexture(theme.wood[0], theme.wood[1], 7);
    const wood = ps1Material({ map: woodTex, affine: 0.6, gloss: T.woodGloss ?? 0.5, shine: T.woodShine ?? 60 });
    const woodDark = ps1Material({ map: T.woodDark ? T.woodDark() : woodTexture(theme.wood[1], '#000000', 9), affine: 0.6, gloss: 0.25, shine: 30 });
    const black = ps1Material({ color: 0x000000, unlit: true, fog: 0 });
    const metal = ps1Material({ color: theme.metal, emissive: new THREE.Color(theme.metal).multiplyScalar(0.15), gloss: 1.2, shine: 70 });

    // --- felt bed (subdivided for smooth vertex lighting)
    const bedW = 2 * (L + D), bedH = 2 * (W + D);
    const bedGeo = new THREE.PlaneGeometry(bedW, bedH, 84, 44);
    bedGeo.rotateX(-Math.PI / 2);
    const uv = bedGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 3);
    // baked ambient occlusion: the felt darkens where it tucks under the cushions
    const bp = bedGeo.attributes.position, ao = [];
    for (let i = 0; i < bp.count; i++) {
      const d = Math.max(0, Math.min(L - Math.abs(bp.getX(i)), W - Math.abs(bp.getZ(i))));
      const k = 1 - 0.38 * Math.exp(-d / 0.045);
      ao.push(k, k, k);
    }
    bedGeo.setAttribute('color', new THREE.Float32BufferAttribute(ao, 3));
    feltTex.repeat.set(1, 1);
    const bed = new THREE.Mesh(bedGeo, felt);
    this.static.add(bed);

    // --- pocket holes (black discs + throats)
    for (const p of this.physics.pockets) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(p.holeR, theme.classic ? 48 : 12), black);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(p.x, 0.0015, p.z);
      this.static.add(disc);
      const throat = new THREE.Mesh(new THREE.CylinderGeometry(p.holeR, p.holeR * 0.9, 0.12, theme.classic ? 48 : 12, 1, true), black);
      throat.position.set(p.x, -0.06, p.z);
      this.static.add(throat);
      // metal pocket cap on the rail
      const ring = new THREE.Mesh(new THREE.RingGeometry(p.holeR + 0.004, p.holeR + (theme.ringW ?? 0.022), theme.classic ? 48 : 12, 1, 0, Math.PI * 2), theme.ringMat ? ps1Material(theme.ringMat) : metal);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, TABLE.railHeight + 0.001, p.z);
      this.static.add(ring);
      // fx layers: glow ring (magnet), vortex (black hole), shutter (closed)
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.1, 16), ps1Material({ color: 0xa040ff, additive: true, unlit: true, opacity: 0.8, fog: 0 }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(p.x, 0.003, p.z);
      glow.visible = false;
      this.pocketGroup.add(glow);
      const vortex = new THREE.Mesh(new THREE.CircleGeometry(1, 20), ps1Material({ map: this.vortexTex, transparent: true, unlit: true, fog: 0, depthWrite: false }));
      vortex.rotation.x = -Math.PI / 2;
      vortex.position.set(p.x, 0.004, p.z);
      vortex.visible = false;
      this.pocketGroup.add(vortex);
      const shutter = this.makeShutter(p);
      shutter.visible = !p.open;
      this.pocketGroup.add(shutter);
      const eyes = this.makeEyes(p);
      eyes.visible = false;
      this.pocketGroup.add(eyes);
      this.pocketFx.push({ glow, vortex, shutter, eyes, shut: p.open ? 0 : 1 });
    }

    // --- cushions from rail segments
    const segs = this.physics.segments;
    const jaws = segs.filter(s => s.kind === 'jaw');
    for (const s of segs.filter(s => s.kind === 'rail')) {
      this.static.add(this.makeCushion(s, jaws, cushionMat));
    }

    // --- wooden rails with pocket cutouts
    const outerX = L + D + RW, outerZ = W + D + RW;
    const shape = new THREE.Shape();
    shape.moveTo(-outerX, -outerZ); shape.lineTo(outerX, -outerZ); shape.lineTo(outerX, outerZ); shape.lineTo(-outerX, outerZ); shape.closePath();
    const hole = new THREE.Path();
    const ix = L + D, iz = W + D;
    const perim = [];
    const N = 480;
    const P = 2 * (2 * ix + 2 * iz);
    for (let i = 0; i < N; i++) {
      let d = (i / N) * P;
      let x, z, nx, nz;
      if (d < 2 * ix) { x = -ix + d; z = -iz; nx = 0; nz = -1; }
      else if ((d -= 2 * ix) < 2 * iz) { x = ix; z = -iz + d; nx = 1; nz = 0; }
      else if ((d -= 2 * iz) < 2 * ix) { x = ix - d; z = iz; nx = 0; nz = 1; }
      else { d -= 2 * ix; x = -ix; z = iz - d; nx = -1; nz = 0; }
      // push points inside a pocket circle outward (along the edge normal) onto its far side
      for (const p of this.physics.pockets) {
        const cr = p.holeR + 0.006;
        const qx = x - p.x, qz = z - p.z;
        if (qx * qx + qz * qz < cr * cr) {
          const qn = qx * nx + qz * nz;
          const t = -qn + Math.sqrt(qn * qn - (qx * qx + qz * qz) + cr * cr);
          x += nx * t; z += nz * t;
        }
      }
      perim.push(new THREE.Vector2(x, z));
    }
    hole.setFromPoints(perim);
    shape.holes.push(hole);
    const railGeo = new THREE.ExtrudeGeometry(shape, { depth: TABLE.railHeight, bevelEnabled: false, curveSegments: 4 });
    railGeo.rotateX(Math.PI / 2);          // shape XY → XZ, extrude goes down
    railGeo.translate(0, TABLE.railHeight, 0);
    // flip because rotateX(+90) maps shape y → z (good) and extrusion depth → -y
    const ru = railGeo.attributes.uv;
    for (let i = 0; i < ru.count; i++) ru.setXY(i, ru.getX(i) * 1.5, ru.getY(i) * 1.5);
    const rails = new THREE.Mesh(railGeo, wood);
    this.static.add(rails);

    // --- diamonds
    const pearl = theme.diamondMat ? ps1Material(theme.diamondMat) : ps1Material({ color: 0xfff6e0, unlit: true, emissive: 0x302820 });
    const dGeo = new THREE.CircleGeometry(theme.classic ? 0.0065 : 0.009, 4);
    dGeo.rotateX(-Math.PI / 2);
    const railMid = RW / 2 + D;
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue;
      const x = -L + (i / 4) * L;
      for (const sz of [-1, 1]) {
        const m = new THREE.Mesh(dGeo, pearl);
        m.position.set(x, TABLE.railHeight + 0.0015, sz * (W + railMid));
        this.static.add(m);
      }
    }
    for (let i = 1; i < 4; i++) {
      const z = -W + (i / 2) * W;
      for (const sx of [-1, 1]) {
        const m = new THREE.Mesh(dGeo, pearl);
        m.position.set(sx * (L + railMid), TABLE.railHeight + 0.0015, z);
        this.static.add(m);
      }
    }

    // --- cabinet + legs
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2 * outerX - 0.04, 0.22, 2 * outerZ - 0.04), woodDark);
    cab.position.y = -0.145;
    this.static.add(cab);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(2 * outerX, 0.06, 2 * outerZ), wood);
    skirt.position.y = -0.04;
    this.static.add(skirt);
    const legH = -FLOOR_Y - 0.2;
    // classic tables get turned legs; the club keeps its chunky posts
    const legGeo = theme.turnedLegs ? new THREE.LatheGeometry([
      [0.0, 0], [0.075, 0], [0.078, 0.05], [0.06, 0.09], [0.05, 0.16], [0.07, 0.24], [0.058, 0.3], [0.044, legH - 0.12], [0.06, legH - 0.07], [0.072, legH - 0.03], [0.072, legH], [0, legH],
    ].map(([r, y]) => new THREE.Vector2(r, y - legH / 2)), 24) : new THREE.CylinderGeometry(0.07, 0.05, legH, 6);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, woodDark);
      leg.position.set(sx * (outerX - 0.14), (FLOOR_Y - 0.2) / 2, sz * (outerZ - 0.12));
      this.static.add(leg);
      const foot = new THREE.Mesh(theme.turnedLegs ? new THREE.CylinderGeometry(0.075, 0.08, 0.03, 24) : new THREE.BoxGeometry(0.16, 0.06, 0.16), theme.turnedLegs ? woodDark : metal);
      foot.position.set(sx * (outerX - 0.14), FLOOR_Y + 0.03, sz * (outerZ - 0.12));
      this.static.add(foot);
    }
    // blob shadow under table on the floor
    const floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(2 * outerX * 1.3, 2 * outerZ * 1.5), ps1Material({ map: circleTexture(32, true, '#000'), transparent: true, unlit: true, opacity: 0.8, depthWrite: false }));
    floorShadow.rotation.x = -Math.PI / 2;
    floorShadow.position.y = FLOOR_Y + 0.004;
    this.static.add(floorShadow);

    this.buildLamp(theme);
    this.syncPockets(true);
  }

  makeCushion(seg, jaws, mat) {
    // nose line s.a→s.b; back line offset outward by D. End faces follow jaws.
    let s = seg;
    let ex = s.bx - s.ax, ez = s.bz - s.az;
    const len = Math.hypot(ex, ez);
    let nx = -ez / len, nz = ex / len;         // one normal
    // outward normal points away from the table centre
    const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2;
    if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
    // keep winding consistent: the front face normal (-ez, ex) must face the table
    if (-ez * nx + ex * nz > 0) s = { ax: seg.bx, az: seg.bz, bx: seg.ax, bz: seg.az };
    const endPoint = (px, pz, other) => {
      const jaw = jaws.find(j => Math.abs(j.ax - px) < 1e-6 && Math.abs(j.az - pz) < 1e-6);
      if (jaw) {
        const jx = jaw.bx - jaw.ax, jz = jaw.bz - jaw.az;
        const dn = jx * nx + jz * nz;
        const t = D / dn;
        return [px + jx * t, pz + jz * t];
      }
      return [px + nx * D, pz + nz * D];
    };
    const [bax, baz] = endPoint(s.ax, s.az);
    const [bbx, bbz] = endPoint(s.bx, s.bz);
    const h = TABLE.cushionHeight, hb = TABLE.railHeight;
    // vertices: nose bottom, nose top, back top (for A and B)
    const A0 = [s.ax, 0.0, s.az], A1 = [s.ax - nx * 0.004, h, s.az - nz * 0.004], A2 = [bax, hb, baz];
    const B0 = [s.bx, 0.0, s.bz], B1 = [s.bx - nx * 0.004, h, s.bz - nz * 0.004], B2 = [bbx, hb, bbz];
    const A3 = [bax, 0, baz], B3 = [bbx, 0, bbz];
    const pos = [];
    const quad = (a, b, c, d) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); };
    const tri = (a, b, c) => pos.push(...a, ...b, ...c);
    quad(A0, B0, B1, A1);      // face toward table
    quad(A1, B1, B2, A2);      // top slope
    tri(A0, A1, A2); tri(A0, A2, A3);  // end A
    tri(B0, B2, B1); tri(B0, B3, B2);  // end B
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    // planar uvs
    const uvs = [];
    for (let i = 0; i < pos.length; i += 3) uvs.push(pos[i] * 3 + pos[i + 1] * 3, pos[i + 2] * 3 + pos[i + 1] * 3);
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    mat.side = THREE.DoubleSide;
    return m;
  }

  makeShutter(p) {
    const g = new THREE.Group();
    const len = Math.hypot(p.a.x - p.b.x, p.a.z - p.b.z) + 0.01;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len, TABLE.cushionHeight, 0.03), ps1Material({ map: this.hazardTex, affine: 0.3 }));
    bar.geometry.attributes.uv.array.forEach((v, i, arr) => { if (i % 2 === 0) arr[i] = v * 3; });
    bar.position.y = TABLE.cushionHeight / 2;
    const ang = Math.atan2(p.b.z - p.a.z, p.b.x - p.a.x);
    g.position.set(p.mid.x + p.out.x * 0.015, 0, p.mid.z + p.out.z * 0.015);
    g.rotation.y = -ang;
    g.add(bar);
    // teeth on top
    const toothMat = ps1Material({ color: 0xf4ecd8 });
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.03, 4), toothMat);
      t.position.set(-len / 2 + (i + 0.5) * len / 6, TABLE.cushionHeight + 0.012, 0);
      g.add(t);
    }
    g.userData.bar = bar;
    // a hazard lid over the hole so a closed pocket reads instantly from above
    const lid = new THREE.Mesh(new THREE.CircleGeometry(p.holeR * 1.02, 12), ps1Material({ map: this.lidTex, color: 0xb0a080, affine: 0.2 }));
    lid.rotation.x = -Math.PI / 2;
    lid.position.set(p.x - g.position.x, 0.004, p.z - g.position.z);
    lid.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    g.add(lid);
    return g;
  }

  makeEyes(p) {
    const g = new THREE.Group();
    const mat = ps1Material({ color: 0xff2020, unlit: true, additive: true, fog: 0 });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.CircleGeometry(0.008, 5), mat);
      e.rotation.x = -Math.PI / 2;
      const tx = -p.out.z, tz = p.out.x;
      e.position.set(p.x + tx * s * 0.02, 0.005, p.z + tz * s * 0.02);
      g.add(e);
    }
    return g;
  }

  buildLamp(theme) {
    const lg = this.lampGroup;
    const shadeMat = ps1Material({ color: theme.id === 'void' ? 0x201040 : 0x0a4a26, emissive: 0x000000, side: THREE.DoubleSide, screenDoor: true });
    if (theme.id === 'hell') shadeMat.uniforms.uColor.value.set(0x3a0606);
    if (theme.id === 'aquarium') shadeMat.uniforms.uColor.value.set(0x0a3040);
    if (theme.id === 'arcade') shadeMat.uniforms.uColor.value.set(0x301050);
    const bulbMat = ps1Material({ color: new THREE.Color(theme.lamp), unlit: true, fog: 0, screenDoor: true });
    const coneMat = ps1Material({ map: coneTexture(), color: new THREE.Color(theme.lamp).multiplyScalar(0.075), additive: true, unlit: true, fog: 0.5, side: THREE.FrontSide });
    const barMat = ps1Material({ color: 0x1a1410, screenDoor: true });
    this.lampMats = [shadeMat, bulbMat, barMat];
    this.coneMat = coneMat;
    const y = 1.22;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.05), barMat);
    bar.position.y = y + 0.12;
    lg.add(bar);
    for (const sx of [-1, 1]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 2, 4), barMat);
      rod.position.set(sx * 0.7, y + 1.12, 0);
      lg.add(rod);
    }
    this.lampLights = [];
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.66;
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, 0.15, 6, 1, true), shadeMat);
      shade.position.set(x, y, 0);
      lg.add(shade);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 6), shadeMat);
      top.position.set(x, y + 0.08, 0);
      lg.add(top);
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.17, 6), bulbMat);
      bulb.rotation.x = Math.PI / 2;
      bulb.position.set(x, y - 0.07, 0);
      lg.add(bulb);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.42, 1.1, 6, 1, true), coneMat);
      cone.position.set(x, y - 0.63, 0);
      lg.add(cone);
      const glowMat = ps1Material({ map: glowTexture(), color: new THREE.Color(theme.lamp).multiplyScalar(0.5), additive: true, unlit: true, fog: 0 });
      this.glowMats = [...(this.glowMats || []), glowMat];
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x, y - 0.075, 0);
      lg.add(glow);
      this.lampLights.push({ x, y: y - 0.12, z: 0 });
    }
  }

  // Update pocket visual state from physics pockets.
  syncPockets(immediate = false) {
    this.physics.pockets.forEach((p, i) => {
      const fx = this.pocketFx[i];
      if (!fx) return;
      fx.target = p.open ? 0 : 1;
      if (immediate) fx.shut = fx.target;
    });
  }

  // dither the lamp away when the camera is above it (it would block the table)
  fadeLamp(cameraY, dt) {
    if (!this.lampMats) return;
    const target = cameraY > 1.1 ? 0 : 1;
    this.lampFade = this.lampFade ?? 1;
    this.lampFade += (target - this.lampFade) * Math.min(1, dt * 6);
    for (const m of this.lampMats) m.uniforms.uOpacity.value = this.lampFade;
    this.coneMat.uniforms.uOpacity.value = this.lampFade;
    for (const m of this.glowMats || []) m.uniforms.uOpacity.value = this.lampFade;
  }

  update(dt, t) {
    this.physics.pockets.forEach((p, i) => {
      const fx = this.pocketFx[i];
      if (!fx) return;
      fx.shut += ((p.open ? 0 : 1) - fx.shut) * Math.min(1, dt * 10);
      fx.shutter.visible = fx.shut > 0.02;
      fx.shutter.scale.set(1, Math.max(0.01, fx.shut), 1);
      fx.shutter.position.y = (1 - fx.shut) * -0.03;
      fx.glow.visible = p.open && (p.pull > 0 || p.hungry > 0 || p.bonus || !!p.mark);
      if (fx.glow.visible) {
        fx.glow.material.uniforms.uColor.value.set(p.mark === 'bad' ? 0xff2030 : (p.bonus || p.mark === 'hi') ? 0xffc21c : 0xa040ff);
        // a bust pocket stutters and spins backwards, so it reads without colour
        const bad = p.mark === 'bad';
        const s = (p.mark || p.bonus ? 1.55 : 1) * (bad ? (Math.sin(t * 9 + i) > 0 ? 1.12 : 0.8) : 1 + Math.sin(t * 5 + i) * 0.15);
        fx.glow.scale.set(s, s, s);
        fx.glow.rotation.z = bad ? -t * 3 : t;
      }
      const big = p.open && (p.scale > 1.05 || p.gravity > 0);
      fx.vortex.visible = big;
      if (big) {
        const r = Math.max(p.captureR, p.gravity > 0 ? 0.12 : 0) * 1.1;
        fx.vortex.scale.setScalar(r);
        fx.vortex.rotation.z = -t * 4;
      }
      fx.eyes.visible = p.open && p.spit && Math.sin(t * 1.3 + i) > 0.2;
    });
    // tilt
    const k = Math.min(1, dt * 1.5);
    this.tilt.x += (this.tilt.tx - this.tilt.x) * k;
    this.tilt.z += (this.tilt.tz - this.tilt.z) * k;
    this.group.rotation.set(this.tilt.z, 0, -this.tilt.x);
    // lamp sway after big hits
    this.sway *= Math.exp(-dt * 1.2);
    this.lampGroup.rotation.z = Math.sin(t * 2.2) * this.sway * 0.08;
    this.lampGroup.rotation.x = Math.cos(t * 1.7) * this.sway * 0.05;
  }
}
