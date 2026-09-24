// Custom 2D billiards physics with 3D spin.
// The table surface is the XZ plane; balls slide/roll with proper
// sliding→rolling friction, english on cushions, and follow/draw emerging
// naturally from the spin model.

import { TABLE, PHYS } from '../config.js';

const R = TABLE.R;
const SQ2 = Math.SQRT1_2;

let nextBallId = 1;

export class Ball {
  constructor(num, x, z) {
    this.id = nextBallId++;
    this.num = num;           // 0 = cue ball, 8 = eight ball, 16+ = special
    this.x = x; this.z = z;
    this.vx = 0; this.vz = 0;
    this.wx = 0; this.wy = 0; this.wz = 0;
    this.y = 0;               // visual height offset (drop-in / falling)
    this.vy = 0;
    this.state = 'table';     // table | falling | pocketed
    this.fall = null;
    this.kind = num === 0 ? 'cue' : 'object'; // cue | object | golden | clone
    this.tags = {};           // encounter tags (target, forbidden...)
    this.ghost = 0;           // number of balls this ball may pass through
    this.r = R;               // radius (anomaly tables scale some balls)
    this.m = 1;               // mass
    this.resetShotStats();
  }
  resetShotStats() {
    this.relicMoved = false;
    this.bumped = false;
    this.cushions = 0;
    this.lastToucher = null;
    this.hitThisShot = false;
    this.travel = 0;
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get active() { return this.state === 'table'; }
}

export class Pocket {
  constructor(index, kind, x, z, mouthA, mouthB, out) {
    this.index = index;
    this.kind = kind;         // corner | side
    this.x = x; this.z = z;   // hole centre
    this.a = mouthA; this.b = mouthB; // jaw tips
    this.out = out;           // unit vector pointing into the pocket
    this.mid = { x: (mouthA.x + mouthB.x) / 2, z: (mouthA.z + mouthB.z) / 2 };
    this.half = Math.hypot(mouthA.x - mouthB.x, mouthA.z - mouthB.z) / 2;
    this.open = true;
    this.scale = 1;           // capture circle multiplier
    this.baseCapture = kind === 'corner' ? 0.074 : 0.07;
    this.pull = 0;            // magnet strength
    this.hungry = 0;          // seconds of extra pull after swallowing a ball (combo tables)
    this.gravity = 0;         // black-hole style inverse square pull
    this.spit = false;        // mimic pocket: ejects balls
    this.devour = false;      // pots here don't count
    this.holeR = kind === 'corner' ? 0.072 : 0.066;
  }
  get captureR() { return this.baseCapture * this.scale; }
}

export class Physics {
  constructor() {
    this.balls = [];
    this.obstacles = [];
    this.pockets = [];
    this.segments = [];
    this.forces = [];         // extra per-ball force callbacks (ball, dt) => void
    this.listener = () => {};
    this.params = {};
    this.resetParams();
    this.ghostPairs = new Set();
    this.buildPockets();
    this.buildSegments();
  }

  resetParams() {
    Object.assign(this.params, {
      muSlide: PHYS.muSlide,
      muRoll: PHYS.muRoll,
      muSpin: PHYS.muSpin,
      cushionRest: PHYS.cushionRest,
      cushionFric: PHYS.cushionFric,
      ballRest: PHYS.ballRest,
      tiltX: 0, tiltZ: 0,       // acceleration from table tilt (m/s²)
      windX: 0, windZ: 0,
      chaos: 0,                 // random deflection on ball-ball hits (radians)
      hungry: 0,                // pockets pull hard for this long after a pot (combo tables)
      crawl: 14,                // extra rolling resistance at crawling speed (crisp arcade stops)
      maxSpeed: 16,
    });
  }

  buildPockets() {
    const { L, W, cornerMouth, sideMouth } = TABLE;
    const a = cornerMouth * SQ2;
    const s = sideMouth / 2;
    const e = 0.012;
    const P = [];
    const corner = (idx, sx, sz) => {
      const A = { x: sx * (L - a), z: sz * W };
      const B = { x: sx * L, z: sz * (W - a) };
      P.push(new Pocket(idx, 'corner', sx * (L + e), sz * (W + e), A, B, { x: sx * SQ2, z: sz * SQ2 }));
    };
    const side = (idx, sz) => {
      const A = { x: -s, z: sz * W };
      const B = { x: s, z: sz * W };
      P.push(new Pocket(idx, 'side', 0, sz * (W + 0.05), A, B, { x: 0, z: sz }));
    };
    corner(0, -1, -1); side(1, -1); corner(2, 1, -1);
    corner(3, -1, 1); side(4, 1); corner(5, 1, 1);
    this.pockets = P;
  }

  // Build cushion collision segments from pocket geometry.
  buildSegments() {
    const { L, W, cornerMouth, sideMouth } = TABLE;
    const a = cornerMouth * SQ2;
    const s = sideMouth / 2;
    const segs = [];
    const add = (ax, az, bx, bz, kind = 'rail') => segs.push({ ax, az, bx, bz, kind });
    // long rails
    for (const sz of [-1, 1]) {
      add(-L + a, sz * W, -s, sz * W);
      add(s, sz * W, L - a, sz * W);
    }
    // short rails
    for (const sx of [-1, 1]) add(sx * L, -W + a, sx * L, W - a);
    // jaws / closures
    const jl = 0.075;
    for (const p of this.pockets) {
      if (!p.open) { add(p.a.x, p.a.z, p.b.x, p.b.z, 'closed'); continue; }
      if (p.kind === 'corner') {
        const sx = Math.sign(p.out.x), sz = Math.sign(p.out.z);
        add(p.a.x, p.a.z, p.a.x + sx * 0.804 * jl, p.a.z + sz * 0.594 * jl, 'jaw');
        add(p.b.x, p.b.z, p.b.x + sx * 0.594 * jl, p.b.z + sz * 0.804 * jl, 'jaw');
      } else {
        const sz = Math.sign(p.out.z);
        add(p.a.x, p.a.z, p.a.x + 0.014, p.a.z + sz * 0.07, 'jaw');
        add(p.b.x, p.b.z, p.b.x - 0.014, p.b.z + sz * 0.07, 'jaw');
      }
    }
    for (const sg of segs) {
      const dx = sg.bx - sg.ax, dz = sg.bz - sg.az;
      sg.len2 = dx * dx + dz * dz;
    }
    this.segments = segs;
  }

  setPocketOpen(i, open) {
    this.pockets[i].open = open;
    this.buildSegments();
  }

  clearBalls() { this.balls = []; this.ghostPairs.clear(); }

  addBall(num, x, z) {
    const b = new Ball(num, x, z);
    this.balls.push(b);
    return b;
  }

  get cue() { return this.balls.find(b => b.kind === 'cue'); }

  activeBalls() { return this.balls.filter(b => b.state === 'table'); }

  isMoving() {
    for (const b of this.balls) {
      if (b.state === 'falling') return true;
      if (b.state === 'table' && (b.vx !== 0 || b.vz !== 0 || Math.abs(b.y) > 0.001 || b.vy !== 0)) return true;
    }
    return false;
  }

  maxSpeed() {
    let m = 0;
    for (const b of this.balls) if (b.state === 'table') m = Math.max(m, b.vx * b.vx + b.vz * b.vz);
    return Math.sqrt(m);
  }

  // Strike a ball. dir is a unit vector; side/top in [-1,1] tip offset (fraction of max).
  strike(ball, dx, dz, speed, side = 0, top = 0) {
    const max = this.params.maxSpeed;
    speed = Math.min(speed, max);
    ball.vx = dx * speed;
    ball.vz = dz * speed;
    // tip offset up to 0.5R; ω = 5 v b / (2R²)
    const r = ball.r;
    const b = top * 0.5 * r;
    const s = 5 * speed * b / (2 * r * r);
    ball.wx = dz * s;
    ball.wz = -dx * s;
    const a = side * 0.5 * r;
    ball.wy = 5 * speed * a / (2 * r * r);
  }

  impulse(ball, ix, iz) {
    ball.vx += ix; ball.vz += iz;
  }

  step(dt) {
    const maxV = Math.max(this.maxSpeed(), 0.5);
    let minR = R;
    for (const b of this.balls) if (b.r < minR) minR = b.r;
    const sub = Math.min(80, Math.max(1, Math.ceil(dt * maxV / (minR * 0.3))));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) this.substep(h);
    for (const p of this.pockets) if (p.hungry > 0) p.hungry = Math.max(0, p.hungry - dt);
    // falling / hop animation
    for (const b of this.balls) {
      if (b.state === 'falling') this.updateFall(b, dt);
      else if (b.state === 'table' && (b.y > 0 || b.vy !== 0)) {
        b.vy -= 9.8 * dt;
        b.y += b.vy * dt;
        if (b.y <= 0) {
          b.y = 0;
          if (b.vy < -0.6) { b.vy = -b.vy * 0.35; this.listener('land', b, Math.abs(b.vy)); }
          else b.vy = 0;
        }
      }
    }
  }

  substep(h) {
    const P = this.params;
    const g = PHYS.g;
    const balls = this.balls;
    const n = balls.length;
    // --- forces & integration
    for (let i = 0; i < n; i++) {
      const b = balls[i];
      if (b.state !== 'table') continue;
      this.applyFriction(b, h, P, g);
      const moving = b.vx !== 0 || b.vz !== 0;
      if (moving) {
        const sp = Math.hypot(b.vx, b.vz);
        if (sp > 0.03) {
          b.vx += (P.tiltX + P.windX) * h;
          b.vz += (P.tiltZ + P.windZ) * h;
        }
      }
      for (const p of this.pockets) {
        if (!p.open) continue;
        const pull = p.pull + (p.hungry > 0 ? 3.4 : 0);
        if (pull > 0 || p.gravity > 0) {
          const dx = p.x - b.x, dz = p.z - b.z;
          const d2 = dx * dx + dz * dz;
          const d = Math.sqrt(d2) || 1e-6;
          let acc = 0;
          if (pull > 0 && d < 0.45) acc += pull * (1 - d / 0.45);
          if (p.gravity > 0) acc += p.gravity * 0.02 / (d2 + 0.02);
          // resting balls only get dragged by a pull strong enough to beat friction,
          // otherwise they would creep forever and the shot would never settle
          const spd = Math.hypot(b.vx, b.vz);
          if (acc > 0 && (spd > 0.03 || acc > 1.0)) {
            b.vx += dx / d * acc * h;
            b.vz += dz / d * acc * h;
          }
        }
      }
      for (const f of this.forces) f(b, h);
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > P.maxSpeed) { b.vx *= P.maxSpeed / sp; b.vz *= P.maxSpeed / sp; }
      b.x += b.vx * h;
      b.z += b.vz * h;
      b.travel += sp * h;
    }
    // --- ball-ball collisions
    for (let i = 0; i < n; i++) {
      const a = balls[i];
      if (a.state !== 'table') continue;
      for (let j = i + 1; j < n; j++) {
        const b = balls[j];
        if (b.state !== 'table') continue;
        const D = a.r + b.r;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= D * D) {
          if (this.ghostPairs.size && d2 > D * D * 1.1) this.ghostPairs.delete(a.id + ':' + b.id);
          continue;
        }
        this.collideBalls(a, b, dx, dz, Math.sqrt(d2), P);
      }
    }
    // --- cushions, obstacles, pockets
    for (let i = 0; i < n; i++) {
      const b = balls[i];
      if (b.state !== 'table') continue;
      if (this.checkPockets(b)) continue;
      this.collideCushions(b, P);
      this.collideObstacles(b);
      this.containBall(b);
    }
  }

  applyFriction(b, h, P, g) {
    const R = b.r;
    const ux = b.vx + R * b.wz;
    const uz = b.vz - R * b.wx;
    const slip = Math.hypot(ux, uz);
    if (slip > 1e-3) {
      const dv = P.muSlide * g * h;
      if (3.5 * dv >= slip) {
        b.vx -= ux / 3.5; b.vz -= uz / 3.5;
        b.wz = -b.vx / R; b.wx = b.vz / R;
      } else {
        const nx = ux / slip, nz = uz / slip;
        b.vx -= nx * dv; b.vz -= nz * dv;
        b.wx += 2.5 * dv * nz / R;
        b.wz -= 2.5 * dv * nx / R;
      }
    } else {
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 0) {
        // rolling resistance, a little stronger when crawling so shots end crisply
        let dec = P.muRoll * g * h;
        if (sp < 0.12) dec *= 1 + (0.12 - sp) * P.crawl;
        if (dec >= sp || sp < PHYS.stopSpeed) { b.vx = 0; b.vz = 0; }
        else { const k = (sp - dec) / sp; b.vx *= k; b.vz *= k; }
      }
      b.wz = -b.vx / R; b.wx = b.vz / R;
    }
    if (b.wy !== 0) {
      const d = P.muSpin * g * h * 2.5 / R;
      b.wy = Math.abs(b.wy) <= d ? 0 : b.wy - Math.sign(b.wy) * d;
    }
    if (b.vx === 0 && b.vz === 0 && slip <= 1e-3) { b.wx = 0; b.wz = 0; }
  }

  collideBalls(a, b, dx, dz, d, P) {
    if (d < 1e-9) { dx = 1e-4; dz = 0; d = 1e-4; }
    const nx = dx / d, nz = dz / d;
    if (this.ghostPairs.size && this.ghostPairs.has(a.id + ':' + b.id)) return;
    const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (rel > 0) {
      // ghost ball: let the cue pass through its first contact
      const ghost = a.ghost > 0 ? a : b.ghost > 0 ? b : null;
      if (ghost) {
        ghost.ghost--;
        this.ghostPairs.add(a.id + ':' + b.id);
        this.listener('ghost', ghost, ghost === a ? b : a);
        return;
      }
      const ia = 1 / a.m, ib = 1 / b.m;
      const j = (1 + P.ballRest) * rel / (ia + ib);
      a.vx -= j * ia * nx; a.vz -= j * ia * nz;
      b.vx += j * ib * nx; b.vz += j * ib * nz;
      if (P.chaos > 0) {
        for (const q of [a, b]) {
          const ang = (Math.random() - 0.5) * 2 * P.chaos;
          const c = Math.cos(ang), s = Math.sin(ang);
          const vx = q.vx * c - q.vz * s, vz = q.vx * s + q.vz * c;
          q.vx = vx * 1.06; q.vz = vz * 1.06;
        }
      }
      a.lastToucher = b; b.lastToucher = a;
      this.listener('ballBall', a, b, rel, (a.x + b.x) / 2, (a.z + b.z) / 2);
    }
    const overlap = a.r + b.r - d;
    if (overlap > 0) {
      const ka = b.m / (a.m + b.m), kb = a.m / (a.m + b.m);
      a.x -= nx * overlap * ka; a.z -= nz * overlap * ka;
      b.x += nx * overlap * kb; b.z += nz * overlap * kb;
    }
  }

  collideCushions(b, P) {
    const R = b.r;
    for (const sg of this.segments) {
      const ex = sg.bx - sg.ax, ez = sg.bz - sg.az;
      let t = ((b.x - sg.ax) * ex + (b.z - sg.az) * ez) / sg.len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = sg.ax + ex * t, cz = sg.az + ez * t;
      let dx = b.x - cx, dz = b.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      const d = Math.sqrt(d2) || 1e-6;
      const nx = dx / d, nz = dz / d;
      const vn = b.vx * nx + b.vz * nz;
      // push out
      b.x = cx + nx * R; b.z = cz + nz * R;
      if (vn >= 0) continue;
      const tx = -nz, tz = nx;
      const vt = b.vx * tx + b.vz * tz;
      const rest = P.cushionRest * (sg.kind === 'jaw' ? 0.7 : 1);
      const Jn = (1 + rest) * -vn;
      // english: contact tangential slip = vt + wy*R
      const ut = vt + b.wy * R;
      let Jt = -ut / 3.5;
      const lim = P.cushionFric * Jn;
      if (Jt > lim) Jt = lim; else if (Jt < -lim) Jt = -lim;
      const nvn = -vn * rest;
      const nvt = vt + Jt;
      b.vx = nx * nvn + tx * nvt;
      b.vz = nz * nvn + tz * nvt;
      b.wy += 2.5 * Jt / R;
      // cushion contact above centre kills most of the rolling spin into the rail
      const rvx = -R * b.wz, rvz = R * b.wx;      // "rolling velocity" equivalent
      const rn = rvx * nx + rvz * nz, rt = rvx * tx + rvz * tz;
      const rn2 = rn * -0.25, rt2 = rt * 0.9;
      const fx = nx * rn2 + tx * rt2, fz = nz * rn2 + tz * rt2;
      b.wz = -fx / R; b.wx = fz / R;
      b.cushions++;
      this.listener('cushion', b, -vn, cx, cz, sg);
    }
  }

  collideObstacles(b) {
    for (const o of this.obstacles) {
      const dx = b.x - o.x, dz = b.z - o.z;
      const rr = b.r + o.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 1e-6;
      const nx = dx / d, nz = dz / d;
      b.x = o.x + nx * rr; b.z = o.z + nz * rr;
      const vn = b.vx * nx + b.vz * nz;
      if (vn >= 0) continue;
      let e = o.rest ?? 0.7;
      b.vx -= (1 + e) * vn * nx;
      b.vz -= (1 + e) * vn * nz;
      if (o.kick) { b.vx += nx * o.kick; b.vz += nz * o.kick; }
      this.listener('obstacle', b, o, -vn);
    }
  }

  // Safety net: nothing may escape the table except through an open pocket.
  containBall(b) {
    const { L, W } = TABLE;
    const lim = 0.02;
    if (b.x < -L - lim || b.x > L + lim || b.z < -W - lim || b.z > W + lim) {
      // find nearest open pocket; if it's close, sink it, otherwise clamp
      let best = null, bd = 1e9;
      for (const p of this.pockets) {
        if (!p.open) continue;
        const d = Math.hypot(p.x - b.x, p.z - b.z);
        if (d < bd) { bd = d; best = p; }
      }
      if (best && bd < 0.16) { this.capture(b, best); return; }
      b.x = Math.max(-L + b.r, Math.min(L - b.r, b.x));
      b.z = Math.max(-W + b.r, Math.min(W - b.r, b.z));
      b.vx *= -0.5; b.vz *= -0.5;
    }
  }

  checkPockets(b) {
    for (const p of this.pockets) {
      if (!p.open) continue;
      const rx = b.x - p.mid.x, rz = b.z - p.mid.z;
      const depth = rx * p.out.x + rz * p.out.z;
      const lat = Math.abs(rx * -p.out.z + rz * p.out.x);
      const dc = Math.hypot(b.x - p.x, b.z - p.z);
      if ((depth > 0.004 && lat < p.half + 0.01) || dc < p.captureR) {
        if (p.spit) { this.spitBall(b, p); return true; }
        // tight pockets: an off-centre ball rattles in the jaws and comes back out
        if (p.scale < 1 && lat > p.half * p.scale + 0.006 && dc > p.captureR) {
          const vn = b.vx * p.out.x + b.vz * p.out.z;
          if (vn > 0) { b.vx -= 1.55 * vn * p.out.x; b.vz -= 1.55 * vn * p.out.z; }
          b.x -= p.out.x * 0.006; b.z -= p.out.z * 0.006;
          if (vn > 0.2) this.listener('cushion', b, vn, b.x, b.z, null);
          return false;
        }
        this.capture(b, p);
        return true;
      }
    }
    return false;
  }

  spitBall(b, p) {
    // fire the ball back out across the table
    const sp = 2.2 + Math.random() * 1.2;
    const ang = Math.atan2(-p.out.z, -p.out.x) + (Math.random() - 0.5) * 0.9;
    b.x = p.mid.x - p.out.x * R * 1.6;
    b.z = p.mid.z - p.out.z * R * 1.6;
    b.vx = Math.cos(ang) * sp; b.vz = Math.sin(ang) * sp;
    b.wx = b.wz = 0;
    b.vy = 1.4; b.y = 0.01;
    this.listener('spit', b, p);
  }

  capture(b, p) {
    if (this.params.hungry > 0 && b.kind !== 'cue') p.hungry = this.params.hungry;
    b.state = 'falling';
    const sp = Math.min(b.speed, 3);
    b.fall = { t: 0, p, sx: b.x, sz: b.z, sp, dir: Math.atan2(b.vz, b.vx) };
    this.listener('pocket', b, p, sp);
  }

  updateFall(b, dt) {
    const f = b.fall;
    f.t += dt;
    const k = Math.min(1, f.t / 0.16);
    const e = 1 - (1 - k) * (1 - k);
    b.x = f.sx + (f.p.x - f.sx) * e;
    b.z = f.sz + (f.p.z - f.sz) * e;
    b.y = -Math.max(0, f.t - 0.05) * 0.9 - f.t * f.t * 3;
    b.vx = b.vz = 0;
    if (f.t > 0.45) {
      b.state = 'pocketed';
      b.y = -1;
    }
  }

  // --- helpers for spawning ---
  isFree(x, z, margin = 0.002, ignore = null) {
    const { L, W } = TABLE;
    if (x < -L + R || x > L - R || z < -W + R || z > W - R) return false;
    for (const b of this.balls) {
      if (b === ignore || b.state !== 'table') continue;
      if (Math.hypot(b.x - x, b.z - z) < R + b.r + margin) return false;
    }
    for (const o of this.obstacles) {
      if (Math.hypot(o.x - x, o.z - z) < R + o.r + margin) return false;
    }
    for (const p of this.pockets) {
      if (Math.hypot(p.x - x, p.z - z) < p.captureR + R + 0.02) return false;
    }
    return true;
  }

  findFreeSpot(x, z, ignore = null) {
    if (this.isFree(x, z, 0.004, ignore)) return { x, z };
    for (let r = 0.02; r < 1.2; r += 0.02) {
      const steps = Math.ceil(r * 40);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (this.isFree(px, pz, 0.004, ignore)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  randomFreeSpot(margin = 0.08, tries = 200) {
    const { L, W } = TABLE;
    for (let i = 0; i < tries; i++) {
      const x = (Math.random() * 2 - 1) * (L - margin);
      const z = (Math.random() * 2 - 1) * (W - margin);
      if (this.isFree(x, z, 0.03)) return { x, z };
    }
    return this.findFreeSpot(0, 0);
  }

  // Sweep a circle from the cue ball to find the first thing it hits.
  predict(ox, oz, dx, dz, ignoreBall, maxDist = 4) {
    let best = { t: maxDist, type: 'none' };
    const cr = ignoreBall ? ignoreBall.r : R;
    for (const b of this.balls) {
      if (b === ignoreBall || b.state !== 'table') continue;
      const D = cr + b.r;
      const fx = b.x - ox, fz = b.z - oz;
      const proj = fx * dx + fz * dz;
      if (proj < 0) continue;
      const perp2 = fx * fx + fz * fz - proj * proj;
      if (perp2 > D * D) continue;
      const t = proj - Math.sqrt(D * D - perp2);
      if (t < best.t && t > -R) best = { t, type: 'ball', ball: b };
    }
    for (const o of this.obstacles) {
      const fx = o.x - ox, fz = o.z - oz;
      const rr = R + o.r;
      const proj = fx * dx + fz * dz;
      if (proj < 0) continue;
      const perp2 = fx * fx + fz * fz - proj * proj;
      if (perp2 > rr * rr) continue;
      const t = proj - Math.sqrt(rr * rr - perp2);
      if (t < best.t && t > 0) best = { t, type: 'obstacle', obstacle: o };
    }
    // cushion: march along the ray against segments (inflated by R)
    for (const sg of this.segments) {
      const t = raySegDist(ox, oz, dx, dz, sg, R);
      if (t !== null && t < best.t) best = { t, type: 'cushion', seg: sg };
    }
    // pockets (mouth line crossing)
    for (const p of this.pockets) {
      if (!p.open) continue;
      const denom = dx * p.out.x + dz * p.out.z;
      if (denom <= 0) continue;
      const t = ((p.mid.x - ox) * p.out.x + (p.mid.z - oz) * p.out.z) / denom;
      if (t <= 0 || t >= best.t) continue;
      const px = ox + dx * t, pz = oz + dz * t;
      const lat = Math.abs((px - p.mid.x) * -p.out.z + (pz - p.mid.z) * p.out.x);
      if (lat < p.half) best = { t, type: 'pocket', pocket: p };
    }
    best.x = ox + dx * best.t;
    best.z = oz + dz * best.t;
    if (best.type === 'ball') {
      const D = cr + best.ball.r;
      const nx = (best.ball.x - best.x) / D, nz = (best.ball.z - best.z) / D;
      best.nx = nx; best.nz = nz;
    }
    return best;
  }
}

// distance along ray (o + d t) until a circle of radius r touches segment sg.
function raySegDist(ox, oz, dx, dz, sg, r) {
  // sample-free analytic: test against segment line offset by r on both sides, plus endpoint circles
  let best = null;
  const ex = sg.bx - sg.ax, ez = sg.bz - sg.az;
  const len = Math.sqrt(sg.len2);
  const nx = -ez / len, nz = ex / len;
  for (const s of [1, -1]) {
    const px = sg.ax + nx * r * s, pz = sg.az + nz * r * s;
    const denom = dx * nx + dz * nz;
    if (Math.abs(denom) < 1e-9) continue;
    const t = ((px - ox) * nx + (pz - oz) * nz) / denom;
    if (t <= 1e-4) continue;
    const hx = ox + dx * t - px, hz = oz + dz * t - pz;
    const u = (hx * ex + hz * ez) / sg.len2;
    if (u >= 0 && u <= 1 && (best === null || t < best)) best = t;
  }
  for (const [cx, cz] of [[sg.ax, sg.az], [sg.bx, sg.bz]]) {
    const fx = cx - ox, fz = cz - oz;
    const proj = fx * dx + fz * dz;
    if (proj < 0) continue;
    const perp2 = fx * fx + fz * fz - proj * proj;
    if (perp2 > r * r) continue;
    const t = proj - Math.sqrt(r * r - perp2);
    if (t > 1e-4 && (best === null || t < best)) best = t;
  }
  return best;
}
