// The underground club around the table: walls, carpet, windows with rain,
// neon signs, CRTs, vending machines, arcade cabinets, posters, spectators and
// smoke. Themes swap textures, props and lights on the same layout.

import * as THREE from 'three';
import { ps1Material, disposeTree } from '../render/materials.js';
import {
  carpetTexture, wallTexture, ceilingTexture, cityTexture, rainTexture, neonTextTexture, posterTexture,
  vendingTexture, arcadeTexture, animatedScreen, smokeTexture, starTexture, glowTexture, woodTexture, rng, canvas, toTex,
} from '../render/textures.js';
import { FLOOR_Y } from './Table.js';

const RX = 4.6, RZ = 3.6, CEIL = 2.3;

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

function fishTexture() {
  const c = canvas(32, 16), x = c.getContext('2d');
  x.fillStyle = '#000';
  x.beginPath(); x.ellipse(14, 8, 11, 5, 0, 0, 7); x.fill();
  x.beginPath(); x.moveTo(24, 8); x.lineTo(31, 2); x.lineTo(31, 14); x.fill();
  // teeth
  x.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) x.fillRect(4 + i * 2, 9, 1, 2);
  x.fillStyle = '#ff4040'; x.fillRect(6, 6, 2, 2);
  return toTex(c, { wrap: false });
}

function candleFlameTexture() {
  const c = canvas(8, 16), x = c.getContext('2d');
  const g = x.createRadialGradient(4, 11, 0, 4, 10, 7);
  g.addColorStop(0, '#fff8c0'); g.addColorStop(0.4, '#ffa020'); g.addColorStop(1, 'rgba(255,40,0,0)');
  x.fillStyle = g; x.beginPath(); x.ellipse(4, 10, 3, 6, 0, 0, 7); x.fill();
  return toTex(c, { wrap: false });
}

export class Room {
  constructor(lights) {
    this.lights = lights;
    this.group = new THREE.Group();
    this.anim = [];          // per-frame callbacks
    this.screens = [];
    this.spectators = [];
    this.smoke = [];
    this.cheer = 0;
    this.lightning = 0;
  }

  build(theme, liveFeedTex) {
    this.theme = theme;
    disposeTree(this.group);
    this.anim = []; this.screens = []; this.spectators = []; this.smoke = [];
    this.liveFeedTex = liveFeedTex;
    const r = rng(theme.seed);
    this.r = r;

    if (theme.props === 'void') this.buildVoid(theme);
    else this.buildShell(theme);

    // accent lights (slots 3–6)
    const n = theme.neon;
    this.lights.set(3, new THREE.Vector3(-2.6, 1.4, -RZ + 0.6), n[0], 4.6, 1.35, 0.6);
    this.lights.set(4, new THREE.Vector3(2.8, 1.2, -RZ + 0.7), n[1 % n.length], 4.4, 1.25, 0.2);
    this.lights.set(5, new THREE.Vector3(-RX + 0.8, 0.9, 1.2), n[2 % n.length], 4.0, 1.1, 0.35);
    this.lights.set(6, new THREE.Vector3(RX - 0.9, 0.7, -0.4), n[3 % n.length] || n[0], 4.2, 1.1, 0.1);

    if (theme.props === 'club') this.propsClub(theme);
    if (theme.props === 'hell') this.propsHell(theme);
    if (theme.props === 'aquarium') this.propsAquarium(theme);
    if (theme.props === 'arcade') this.propsArcade(theme);
    if (theme.props === 'void') this.propsVoidExtras(theme);

    this.buildSpectators(theme);
    this.buildSmoke(theme);
  }

  // ------------------------------------------------------------------ shell
  buildShell(theme) {
    const g = this.group;
    const floorGeo = new THREE.PlaneGeometry(RX * 2, RZ * 2, 18, 14);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, ps1Material({ map: carpetTexture(theme), affine: 0.8 }));
    floor.position.y = FLOOR_Y;
    const fu = floorGeo.attributes.uv;
    for (let i = 0; i < fu.count; i++) fu.setXY(i, fu.getX(i) * 7, fu.getY(i) * 6);
    floor.material.uniforms.map.value.repeat.set(1, 1);
    g.add(floor);

    const ceilGeo = new THREE.PlaneGeometry(RX * 2, RZ * 2, 8, 6);
    ceilGeo.rotateX(Math.PI / 2);
    const cu = ceilGeo.attributes.uv;
    for (let i = 0; i < cu.count; i++) cu.setXY(i, cu.getX(i) * 10, cu.getY(i) * 8);
    const ceilTex = ceilingTexture(); ceilTex.repeat.set(1, 1);
    const ceil = new THREE.Mesh(ceilGeo, ps1Material({ map: ceilTex }));
    ceil.position.y = CEIL;
    g.add(ceil);

    const wt = wallTexture(theme); wt.repeat.set(1, 1);
    const wallMat = ps1Material({ map: wt, affine: 0.8 });
    const H = CEIL - FLOOR_Y;
    const mkWall = (w, x, z, ry) => {
      const geo = new THREE.PlaneGeometry(w, H, Math.ceil(w * 3), 6);
      const u = geo.attributes.uv;
      for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * w / 1.2, u.getY(i));
      const m = new THREE.Mesh(geo, wallMat);
      m.position.set(x, FLOOR_Y + H / 2, z);
      m.rotation.y = ry;
      g.add(m);
      return m;
    };
    mkWall(RX * 2, 0, -RZ, 0);
    mkWall(RX * 2, 0, RZ, Math.PI);
    mkWall(RZ * 2, -RX, 0, Math.PI / 2);
    mkWall(RZ * 2, RX, 0, -Math.PI / 2);

    // ceiling pipes
    const pipeMat = ps1Material({ color: 0x302830 });
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, RX * 2, 5), pipeMat);
      p.rotation.z = Math.PI / 2;
      p.position.set(0, CEIL - 0.12 - i * 0.02, -2.2 + i * 1.9);
      g.add(p);
    }

    // windows on the back wall
    if (theme.windows !== 'none') {
      const wins = theme.windows === 'aquarium' ? [-3, -1, 1, 3] : [-3.1, 3.1];
      wins.forEach((x, i) => this.window(theme, x, -RZ + 0.02, 0, i));
      if (theme.windows === 'aquarium') {
        [-2, 0.5, 2.5].forEach((z, i) => this.window(theme, -RX + 0.02, z, Math.PI / 2, i + 5));
        [-1.5, 1.5].forEach((z, i) => this.window(theme, RX - 0.02, z, -Math.PI / 2, i + 9));
      }
    }
  }

  window(theme, x, z, ry, idx) {
    const g = new THREE.Group();
    g.position.set(x, 0.75, z);
    g.rotation.y = ry;
    const w = theme.windows === 'aquarium' ? 1.6 : 1.3, h = theme.windows === 'aquarium' ? 1.6 : 1.1;
    const frameMat = ps1Material({ color: 0x151015 });
    const city = cityTexture(theme, 21 + idx);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ps1Material({ map: city, unlit: true, fog: 0.3, color: 0xb0b0c0 }));
    back.position.z = 0.01;
    g.add(back);
    this.anim.push((dt, t) => {
      const f = 0.7 + this.lightning * 1.8;
      back.material.uniforms.uColor.value.setRGB(f * 0.8, f * 0.82, f * 0.9);
    });
    if (theme.windows === 'rain' || theme.windows === 'city') {
      const rt = rainTexture();
      rt.repeat.set(3, 1.5);
      const rain = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ps1Material({ map: rt, additive: true, unlit: true, scroll: [0.05, 1.6], fog: 0.2, color: 0x8090b0 }));
      rain.position.z = 0.02;
      g.add(rain);
    }
    if (theme.windows === 'fire') {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ps1Material({ map: glowTexture(), additive: true, unlit: true, color: 0xff4010 }));
      glow.position.z = 0.02;
      g.add(glow);
      this.anim.push((dt, t) => { glow.material.uniforms.uOpacity.value = 0.5 + Math.sin(t * 7 + idx) * 0.2 + Math.sin(t * 13) * 0.1; });
    }
    if (theme.windows === 'aquarium') {
      const ft = fishTexture();
      for (let k = 0; k < 2; k++) {
        const fish = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), ps1Material({ map: ft, transparent: true, unlit: true, alphaTest: 0.5, color: 0x102030 }));
        fish.position.z = 0.015;
        g.add(fish);
        const sp = 0.15 + this.r() * 0.2, ph = this.r() * 10, y0 = (this.r() - 0.5) * 0.9;
        this.anim.push((dt, t) => {
          const u = ((t * sp + ph) % 2.4) - 1.2;
          fish.position.x = u * w * 0.8;
          fish.position.y = y0 + Math.sin(t * 0.8 + ph) * 0.1;
          fish.visible = Math.abs(fish.position.x) < w / 2 - 0.2;
          fish.scale.x = 1;
        });
      }
    }
    // frame
    const fw = 0.06;
    [[w + fw * 2, fw, 0, h / 2 + fw / 2], [w + fw * 2, fw, 0, -h / 2 - fw / 2], [fw, h, -w / 2 - fw / 2, 0], [fw, h, w / 2 + fw / 2, 0], [fw * 0.6, h, 0, 0], [w, fw * 0.6, 0, 0]].forEach(([bw, bh, bx, by]) => {
      const b = box(bw, bh, 0.06, frameMat);
      b.position.set(bx, by, 0.03);
      g.add(b);
    });
    this.group.add(g);
  }

  neonSign(text, color, x, y, z, ry, scale = 1, w = 128) {
    const tex = neonTextTexture(text, color, { w, h: 32 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * scale * (w / 128), 0.3 * scale), ps1Material({ map: tex, additive: true, unlit: true, fog: 0.15 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.group.add(m);
    const seed = this.r() * 100;
    const flickery = this.r() > 0.5;
    this.anim.push((dt, t) => {
      let k = 1;
      if (flickery) {
        const n = Math.sin(t * 17 + seed) * Math.sin(t * 3.1 + seed);
        if (n > 0.93) k = 0.15;
      }
      m.material.uniforms.uOpacity.value = k;
    });
    // backing board
    const board = box(1.25 * scale * (w / 128), 0.34 * scale, 0.03, ps1Material({ color: 0x0a0810 }));
    board.position.set(x - Math.sin(ry) * 0.03, y, z - Math.cos(ry) * 0.03);
    board.rotation.y = ry;
    this.group.add(board);
    return m;
  }

  poster(i, x, y, z, ry, s = 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.45 * s, 0.6 * s), ps1Material({ map: posterTexture(i), affine: 0.9 }));
    m.position.set(x, y, z); m.rotation.y = ry;
    m.rotation.z = (this.r() - 0.5) * 0.08;
    this.group.add(m);
  }

  crt(x, y, z, ry, kind, s = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry;
    const body = box(0.5 * s, 0.4 * s, 0.42 * s, ps1Material({ color: 0x2a2a30 }));
    g.add(body);
    const backB = box(0.34 * s, 0.28 * s, 0.2 * s, ps1Material({ color: 0x222228 }));
    backB.position.z = -0.28 * s;
    g.add(backB);
    let tex;
    if (kind === 'live' && this.liveFeedTex) tex = this.liveFeedTex;
    else { const sc = animatedScreen(kind, Math.floor(this.r() * 100)); this.screens.push(sc); tex = sc.tex; }
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4 * s, 0.3 * s), ps1Material({ map: tex, unlit: true, fog: 0.2 }));
    screen.position.z = 0.215 * s;
    g.add(screen);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * s, 0.7 * s), ps1Material({ map: glowTexture(), additive: true, unlit: true, color: kind === 'live' ? 0x406040 : 0x404868 }));
    glow.position.z = 0.23 * s;
    g.add(glow);
    this.group.add(g);
    return g;
  }

  vending(x, z, ry, color, label) {
    const g = new THREE.Group();
    g.position.set(x, FLOOR_Y + 0.9, z); g.rotation.y = ry;
    const body = box(0.8, 1.8, 0.7, ps1Material({ color: 0x202028 }));
    g.add(body);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 1.76), ps1Material({ map: vendingTexture(color, label), unlit: true, color: 0xe0e0e0 }));
    front.position.z = 0.352;
    g.add(front);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), ps1Material({ map: glowTexture(), additive: true, unlit: true, color: new THREE.Color(color).multiplyScalar(0.35) }));
    glow.position.z = 0.36;
    g.add(glow);
    this.group.add(g);
  }

  cabinet(x, z, ry, color, kind) {
    const g = new THREE.Group();
    g.position.set(x, FLOOR_Y, z); g.rotation.y = ry;
    const side = arcadeTexture(color);
    const bodyMat = ps1Material({ map: side });
    const body = box(0.62, 1.7, 0.7, bodyMat);
    body.position.y = 0.85;
    g.add(body);
    const sc = animatedScreen(kind, Math.floor(this.r() * 999));
    this.screens.push(sc);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.36), ps1Material({ map: sc.tex, unlit: true }));
    screen.position.set(0, 1.22, 0.36);
    screen.rotation.x = -0.2;
    g.add(screen);
    const marquee = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.14), ps1Material({ color: new THREE.Color(color), unlit: true }));
    marquee.position.set(0, 1.58, 0.36);
    g.add(marquee);
    const panel = box(0.62, 0.06, 0.3, ps1Material({ color: 0x18181c }));
    panel.position.set(0, 0.95, 0.45);
    panel.rotation.x = 0.3;
    g.add(panel);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), ps1Material({ map: glowTexture(), additive: true, unlit: true, color: new THREE.Color(color).multiplyScalar(0.4) }));
    glow.position.set(0, 1.25, 0.38);
    g.add(glow);
    this.group.add(g);
  }

  stool(x, z) {
    const mat = ps1Material({ color: 0x802020 });
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 5), ps1Material({ color: 0x404048 }));
    leg.position.set(x, FLOOR_Y + 0.3, z);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 7), mat);
    seat.position.set(x, FLOOR_Y + 0.62, z);
    this.group.add(leg, seat);
  }

  bar(theme) {
    // bar counter along the front wall with bottles
    const woodMat = ps1Material({ map: woodTexture(theme.wood[0], theme.wood[1], 3) });
    const counter = box(3.2, 1.05, 0.6, woodMat);
    counter.position.set(-1.2, FLOOR_Y + 0.52, RZ - 0.9);
    this.group.add(counter);
    const top = box(3.3, 0.05, 0.7, ps1Material({ color: 0x1a0a06 }));
    top.position.set(-1.2, FLOOR_Y + 1.07, RZ - 0.9);
    this.group.add(top);
    const shelf = box(3.0, 0.04, 0.25, ps1Material({ color: 0x201010 }));
    shelf.position.set(-1.2, 0.8, RZ - 0.15);
    this.group.add(shelf);
    const cols = [0x40a060, 0xa06020, 0x8080d0, 0xd0d0a0, 0x60c0c0, 0xc04060];
    for (let i = 0; i < 16; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.26 + this.r() * 0.1, 5), ps1Material({ color: cols[i % cols.length], emissive: new THREE.Color(cols[i % cols.length]).multiplyScalar(0.15) }));
      b.position.set(-2.6 + i * 0.18, 0.95, RZ - 0.15);
      this.group.add(b);
    }
    for (let i = 0; i < 4; i++) this.stool(-2.3 + i * 0.75, RZ - 1.5);
  }

  cueRack(x, z, ry) {
    const g = new THREE.Group();
    g.position.set(x, 0.3, z); g.rotation.y = ry;
    const board = box(0.9, 1.4, 0.04, ps1Material({ map: woodTexture('#3a1a0a', '#1a0804', 2) }));
    g.add(board);
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 1.35, 5), ps1Material({ color: [0xe8c890, 0x301008, 0xc0c0c8, 0x802010, 0xe8c890, 0x202020][i] }));
      c.position.set(-0.35 + i * 0.14, 0, 0.05);
      g.add(c);
    }
    this.group.add(g);
  }

  // ----------------------------------------------------------------- themes
  propsClub(theme) {
    const [s1, s2, s3] = theme.signs;
    this.neonSign(s1[0], s1[1], -1.0, 1.5, -RZ + 0.08, 0, 1.3);
    this.neonSign(s2[0], s2[1], 1.2, 1.55, -RZ + 0.08, 0, 0.9);
    this.neonSign(s3[0], s3[1], -RX + 0.08, 1.3, 1.4, Math.PI / 2, 1.0);
    this.poster(0, -1.9, 0.5, -RZ + 0.03, 0);
    this.poster(1, 1.9, 0.45, -RZ + 0.03, 0);
    this.poster(2, RX - 0.03, 0.8, 1.9, -Math.PI / 2);
    this.poster(4, -RX + 0.03, 0.4, -1.6, Math.PI / 2);
    this.vending(-RX + 0.5, -0.6, Math.PI / 2, '#ff2b4a', 'DRINK');
    this.vending(-RX + 0.5, 0.35, Math.PI / 2, '#2b7bff', 'COLD');
    this.cabinet(RX - 0.5, -1.2, -Math.PI / 2, '#2bf0ff', 'stars');
    this.cabinet(RX - 0.5, -0.4, -Math.PI / 2, '#ff2bd6', 'pong');
    this.cabinet(RX - 0.5, 0.4, -Math.PI / 2, '#ffe23b', 'stars');
    // TV stack in the corner
    this.crt(RX - 0.6, FLOOR_Y + 0.2, RZ - 0.7, -2.4, 'live', 1.1);
    this.crt(RX - 0.6, FLOOR_Y + 0.64, RZ - 0.7, -2.3, 'static', 1.0);
    this.crt(RX - 1.2, FLOOR_Y + 0.2, RZ - 0.5, -2.8, 'bars', 1.0);
    this.crt(-RX + 0.8, FLOOR_Y + 1.1, -RZ + 0.5, 0.7, 'eye', 0.9);
    this.bar(theme);
    this.cueRack(RX - 0.03, 1.4, -Math.PI / 2);
    // small round table + ashtray
    const tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 8), ps1Material({ color: 0x301818 }));
    tbl.position.set(2.6, FLOOR_Y + 0.72, 2.0);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 0.72, 5), ps1Material({ color: 0x202024 }));
    pole.position.set(2.6, FLOOR_Y + 0.36, 2.0);
    this.group.add(tbl, pole);
  }

  propsHell(theme) {
    const [s1, s2, s3] = theme.signs;
    this.neonSign(s1[0], s1[1], -1.0, 1.5, -RZ + 0.08, 0, 1.3);
    this.neonSign(s2[0], s2[1], 1.5, 1.55, -RZ + 0.08, 0, 0.8);
    this.neonSign(s3[0], s3[1], RX - 0.08, 1.3, 0, -Math.PI / 2, 1.1);
    const flame = candleFlameTexture();
    const waxMat = ps1Material({ color: 0xe8d8c0, emissive: 0x201008 });
    const flameMat = ps1Material({ map: flame, additive: true, unlit: true, fog: 0.2 });
    // candle clusters around the room
    const clusters = [[-3.8, -2.8], [3.8, -2.8], [-3.8, 2.8], [3.8, 2.8], [-2, 3.0], [2, 3.0], [0, -3.1], [-4.1, 0], [4.1, 0]];
    for (const [cx, cz] of clusters) {
      for (let i = 0; i < 7; i++) {
        const h = 0.1 + this.r() * 0.45;
        const x = cx + (this.r() - 0.5) * 0.6, z = cz + (this.r() - 0.5) * 0.5;
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, h, 5), waxMat);
        c.position.set(x, FLOOR_Y + h / 2, z);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.12), flameMat);
        f.position.set(x, FLOOR_Y + h + 0.05, z);
        this.group.add(c, f);
        const ph = this.r() * 10;
        this.anim.push((dt, t, cam) => {
          f.quaternion.copy(cam.quaternion);
          const s = 0.8 + Math.sin(t * 17 + ph) * 0.15 + Math.sin(t * 7.3 + ph) * 0.1;
          f.scale.set(s, s * 1.1, 1);
        });
      }
    }
    // pentagram-ish glowing rune on the floor
    const rc = canvas(64, 64), x = rc.getContext('2d');
    x.strokeStyle = '#ff3010'; x.lineWidth = 2;
    x.beginPath(); x.arc(32, 32, 28, 0, 7); x.stroke();
    x.beginPath();
    for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 4 / 5; x.lineTo(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28); }
    x.stroke();
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), ps1Material({ map: toTex(rc, { wrap: false }), additive: true, unlit: true, color: 0xa02010 }));
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = FLOOR_Y + 0.01;
    this.group.add(rune);
    this.anim.push((dt, t) => { rune.material.uniforms.uOpacity.value = 0.5 + Math.sin(t * 1.5) * 0.3; rune.rotation.z = t * 0.05; });
    this.poster(5, -1.9, 0.5, -RZ + 0.03, 0);
    this.crt(-RX + 0.6, FLOOR_Y + 0.2, -RZ + 0.7, 0.8, 'eye', 1.1);
    this.crt(RX - 0.6, FLOOR_Y + 0.2, RZ - 0.7, -2.4, 'live', 1.1);
    this.vending(-RX + 0.5, 0.2, Math.PI / 2, '#ff3010', 'SOULS');
    // bone pillars
    const bone = ps1Material({ color: 0xd8c8a8 });
    for (const [px, pz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, CEIL - FLOOR_Y, 6), bone);
      p.position.set(px * 1.2, (CEIL + FLOOR_Y) / 2, pz * 1.35);
      this.group.add(p);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), bone);
      skull.position.set(px * 1.2, 1.2, pz * 1.35 + (pz > 0 ? -0.15 : 0.15));
      this.group.add(skull);
    }
  }

  propsAquarium(theme) {
    const [s1, s2, s3] = theme.signs;
    this.neonSign(s1[0], s1[1], 0, 1.65, -RZ + 0.08, 0, 1.1);
    this.neonSign(s2[0], s2[1], RX - 0.08, 1.7, 0, -Math.PI / 2, 0.8);
    this.neonSign(s3[0], s3[1], 0, 1.6, RZ - 0.08, Math.PI, 0.9);
    this.crt(-RX + 0.8, FLOOR_Y + 0.2, RZ - 0.7, 2.4, 'fish', 1.0);
    this.crt(RX - 0.6, FLOOR_Y + 0.2, RZ - 0.7, -2.4, 'live', 1.1);
    this.bar(theme);
    // bubble columns
    const bubMat = ps1Material({ color: 0x80e0ff, additive: true, unlit: true, fog: 0.4 });
    const bubGeo = new THREE.SphereGeometry(0.02, 4, 3);
    for (let c = 0; c < 4; c++) {
      const bx = (c - 1.5) * 2, bz = -RZ + 0.25;
      for (let i = 0; i < 10; i++) {
        const b = new THREE.Mesh(bubGeo, bubMat);
        const ph = this.r() * 3, sp = 0.3 + this.r() * 0.3;
        this.group.add(b);
        this.anim.push((dt, t) => {
          const y = ((t * sp + ph) % 3);
          b.position.set(bx + Math.sin(t * 2 + ph * 5) * 0.05, FLOOR_Y + 0.2 + y, bz);
          b.visible = y < 2.6;
        });
      }
    }
    // caustic shimmer on the floor
    const cc = canvas(64, 64), x = cc.getContext('2d');
    x.strokeStyle = 'rgba(120,230,255,0.6)'; x.lineWidth = 1;
    const r = rng(4);
    for (let i = 0; i < 24; i++) { x.beginPath(); x.arc(r() * 64, r() * 64, 4 + r() * 8, 0, 3 + r() * 3); x.stroke(); }
    const ct = toTex(cc); ct.repeat.set(6, 5);
    const caustic = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), ps1Material({ map: ct, additive: true, unlit: true, scroll: [0.02, 0.013], color: 0x205060 }));
    caustic.rotation.x = -Math.PI / 2;
    caustic.position.y = FLOOR_Y + 0.01;
    this.group.add(caustic);
  }

  propsArcade(theme) {
    const [s1, s2, s3] = theme.signs;
    this.neonSign(s1[0], s1[1], -1.2, 1.55, -RZ + 0.08, 0, 1.2);
    this.neonSign(s2[0], s2[1], 1.4, 1.5, -RZ + 0.08, 0, 1.0, 160);
    this.neonSign(s3[0], s3[1], -RX + 0.08, 1.6, 0, Math.PI / 2, 1.0);
    const cols = theme.neon;
    const kinds = ['stars', 'pong', 'stars', 'eye', 'pong', 'stars'];
    for (let i = 0; i < 5; i++) this.cabinet(RX - 0.5, -2.2 + i * 0.8, -Math.PI / 2, cols[i % cols.length], kinds[i]);
    for (let i = 0; i < 4; i++) this.cabinet(-RX + 0.5, -1.8 + i * 0.8, Math.PI / 2, cols[(i + 2) % cols.length], kinds[i + 1]);
    for (let i = 0; i < 3; i++) this.cabinet(-1.6 + i * 1.6, RZ - 0.5, Math.PI, cols[(i + 1) % cols.length], kinds[i + 2]);
    // CRT wall
    const tvKinds = ['live', 'static', 'bars', 'stars', 'eye', 'static', 'pong', 'live'];
    for (let i = 0; i < 8; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      this.crt(-2.4 + col * 0.52 + 3.5, FLOOR_Y + 0.25 + row * 0.44, -RZ + 0.35, 0, tvKinds[i], 1.0);
    }
    this.poster(3, -2.6, 0.5, -RZ + 0.03, 0);
    this.poster(2, -3.3, 0.55, -RZ + 0.03, 0);
  }

  // ------------------------------------------------------------------ void
  buildVoid(theme) {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 10), ps1Material({ map: starTexture(), unlit: true, fog: 0, side: THREE.BackSide }));
    sky.material.uniforms.map.value.repeat.set(3, 2);
    this.group.add(sky);
    this.anim.push((dt, t) => { sky.rotation.y = t * 0.01; });
    // giant planet
    const pc = canvas(64, 32), x = pc.getContext('2d');
    for (let y = 0; y < 32; y++) { x.fillStyle = `hsl(${270 + Math.sin(y * 0.7) * 30},60%,${20 + Math.sin(y * 0.4) * 10}%)`; x.fillRect(0, y, 64, 1); }
    const planet = new THREE.Mesh(new THREE.SphereGeometry(6, 14, 10), ps1Material({ map: toTex(pc), unlit: true, fog: 0 }));
    planet.position.set(-14, 4, -18);
    this.group.add(planet);
    const ring = new THREE.Mesh(new THREE.RingGeometry(7.5, 10, 24), ps1Material({ color: 0x604090, unlit: true, fog: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.5, screenDoor: true }));
    ring.position.copy(planet.position);
    ring.rotation.set(1.2, 0.3, 0);
    this.group.add(ring);
    // floating rocks
    const rockMat = ps1Material({ color: 0x302440 });
    for (let i = 0; i < 26; i++) {
      const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 + this.r() * 0.35, 0), rockMat);
      const a = this.r() * Math.PI * 2, d = 3 + this.r() * 5;
      const y0 = -2 + this.r() * 4;
      rk.position.set(Math.cos(a) * d, y0, Math.sin(a) * d);
      this.group.add(rk);
      const sp = (this.r() - 0.5) * 0.6, ph = this.r() * 6;
      this.anim.push((dt, t) => { rk.rotation.x += sp * dt; rk.rotation.y += sp * dt * 0.7; rk.position.y = y0 + Math.sin(t * 0.3 + ph) * 0.15; });
    }
    // a glowing grid disc under the table
    const gc = canvas(64, 64), gx = gc.getContext('2d');
    gx.strokeStyle = '#b080ff'; gx.lineWidth = 1;
    for (let i = 0; i <= 64; i += 8) { gx.beginPath(); gx.moveTo(i, 0); gx.lineTo(i, 64); gx.stroke(); gx.beginPath(); gx.moveTo(0, i); gx.lineTo(64, i); gx.stroke(); }
    const gt = toTex(gc); gt.repeat.set(4, 4);
    const grid = new THREE.Mesh(new THREE.CircleGeometry(4, 24), ps1Material({ map: gt, additive: true, unlit: true, color: 0x402060 }));
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = FLOOR_Y - 0.3;
    this.group.add(grid);
  }

  propsVoidExtras(theme) {
    // floating CRTs in the dark
    this.crt(-2.4, 0.6, -2.2, 0.6, 'eye', 1.3);
    this.crt(2.6, 0.9, -1.8, -0.7, 'live', 1.2);
    this.crt(2.2, -0.3, 2.4, -2.4, 'static', 1.0);
    this.crt(-2.8, -0.1, 2.0, 2.2, 'stars', 1.0);
    this.screensFloat = true;
  }

  // ------------------------------------------------------------- spectators
  buildSpectators(theme) {
    const bodyMat = ps1Material({ color: theme.props === 'void' ? 0x0a0614 : 0x060508 });
    const eyeMat = ps1Material({ color: theme.props === 'hell' ? 0xff3010 : theme.props === 'void' ? 0xb080ff : 0xf0f0ff, unlit: true, fog: 0.3 });
    const hornMat = ps1Material({ color: 0x1a0404 });
    const spots = [
      [-2.1, -1.7], [-0.6, -1.95], [0.9, -1.9], [2.3, -1.6],
      [-2.6, 1.5], [-1.0, 1.9], [0.6, 2.0], [2.2, 1.7],
      [-3.0, 0.2], [3.1, -0.3],
    ];
    const count = theme.props === 'void' ? 7 : 10;
    for (let i = 0; i < count; i++) {
      const [x, z] = spots[i];
      const g = new THREE.Group();
      const h = 0.85 + this.r() * 0.3;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, h, 6), bodyMat);
      body.position.y = h / 2;
      g.add(body);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.2), bodyMat);
      sh.position.y = h - 0.05;
      g.add(sh);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), bodyMat);
      head.position.y = h + 0.14;
      g.add(head);
      for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.018), eyeMat);
        e.position.set(s * 0.045, h + 0.16, 0.115);
        g.add(e);
        if (theme.props === 'hell') {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 4), hornMat);
          horn.position.set(s * 0.07, h + 0.28, 0);
          horn.rotation.z = -s * 0.4;
          g.add(horn);
        }
      }
      // arms (raised when cheering)
      const arms = [];
      for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), bodyMat);
        arm.geometry.translate(0, -0.25, 0);
        arm.position.set(s * 0.22, h - 0.05, 0);
        g.add(arm);
        arms.push(arm);
      }
      const baseY = theme.props === 'void' ? -0.9 + this.r() * 0.6 : FLOOR_Y;
      g.position.set(x * 1.05, baseY, z * 1.15);
      g.lookAt(0, baseY, 0);
      this.group.add(g);
      this.spectators.push({ g, arms, baseY, ph: this.r() * 10, jump: 0, jv: 0 });
    }
  }

  buildSmoke(theme) {
    const tex = smokeTexture();
    const col = theme.props === 'hell' ? 0x401008 : theme.props === 'aquarium' ? 0x0a3040 : theme.props === 'void' ? 0x201040 : 0x2a2440;
    const mat = ps1Material({ map: tex, transparent: true, unlit: true, color: col, opacity: 0.32, fog: 0.5, depthWrite: false });
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), mat);
      m.renderOrder = 2;
      const a = this.r() * Math.PI * 2, d = 2.3 + this.r() * 1.8;
      const s = { m, x: Math.cos(a) * d, z: Math.sin(a) * d * 0.8, y: 0.3 + this.r() * 1.5, sp: 0.05 + this.r() * 0.08, ph: this.r() * 10 };
      this.group.add(m);
      this.smoke.push(s);
    }
  }

  cheerNow(amount = 1) {
    for (const s of this.spectators) {
      if (Math.random() < 0.35 + amount * 0.5) {
        s.jv = 1.2 + Math.random() * 1.2 * amount;
        s.cheer = 1.2 + amount;
      }
    }
  }

  update(dt, t, camera) {
    for (const f of this.anim) f(dt, t, camera);
    for (const s of this.screens) s.draw(t);
    this.lightning = Math.max(0, this.lightning - dt * 3);
    if (this.theme && this.theme.windows === 'rain' && Math.random() < dt * 0.04) {
      this.lightning = 1;
      this.lights.flash(new THREE.Vector3(0, 1.5, -3.5), 0xb0c0ff, 7, 2.2, 0.35);
    }
    for (const s of this.spectators) {
      s.jv -= 9 * dt;
      s.jump = Math.max(0, s.jump + s.jv * dt);
      if (s.jump === 0 && s.jv < 0) s.jv = 0;
      s.g.position.y = s.baseY + s.jump + (this.theme.props === 'void' ? Math.sin(t * 0.7 + s.ph) * 0.1 : 0);
      s.g.rotation.z = Math.sin(t * 0.9 + s.ph) * 0.03;
      s.cheer = Math.max(0, (s.cheer || 0) - dt);
      const up = s.cheer > 0 ? Math.PI * 0.85 + Math.sin(t * 14 + s.ph) * 0.3 : 0.1 + Math.sin(t * 1.3 + s.ph) * 0.05;
      s.arms.forEach((a, i) => { a.rotation.z += ((i ? -up : up) * -1 - a.rotation.z) * Math.min(1, dt * 12); });
    }
    for (const s of this.smoke) {
      s.m.position.set(s.x + Math.sin(t * s.sp + s.ph) * 0.6, s.y + Math.sin(t * s.sp * 0.7 + s.ph) * 0.2, s.z + Math.cos(t * s.sp + s.ph) * 0.6);
      s.m.quaternion.copy(camera.quaternion);
    }
  }
}
