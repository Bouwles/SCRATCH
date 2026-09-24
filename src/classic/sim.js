// A private copy of the table physics for planning shots. It runs the exact
// same solver with the same fixed 1/240 s step as the real table, so the AI
// can think about a shot — but it only ever plays through the real table,
// with its own hands shaking a little.

import { Physics, Ball } from '../physics/Physics.js';

const H = 1 / 240;

export class Sim {
  constructor() {
    this.p = new Physics();
    this.pool = [];
    this.rec = null;
    this.p.listener = (type, a, b) => this.on(type, a, b);
  }

  // copy the live table (positions only — everything is at rest between shots)
  load(physics) {
    Object.assign(this.p.params, physics.params);
    const src = physics.balls.filter(b => b.state === 'table');
    this.p.balls = src.map((b, i) => {
      const nb = this.pool[i] || (this.pool[i] = new Ball(b.num, 0, 0));
      nb.id = b.id; nb.num = b.num; nb.kind = b.kind; nb.r = b.r; nb.m = b.m;
      return nb;
    });
    this.base = src.map(b => [b.x, b.z]);
  }

  reset(cueAt = null) {
    this.p.balls.forEach((b, i) => {
      b.x = this.base[i][0]; b.z = this.base[i][1];
      b.vx = b.vz = 0; b.wx = b.wy = b.wz = 0; b.y = 0; b.vy = 0;
      b.state = 'table'; b.fall = null; b.ghost = 0;
      b.resetShotStats();
      if (cueAt && b.kind === 'cue') { b.x = cueAt.x; b.z = cueAt.z; }
    });
    this.p.ghostPairs.clear();
  }

  get cue() { return this.p.balls.find(b => b.kind === 'cue'); }

  on(type, a, b) {
    const r = this.rec;
    if (!r) return;
    if (type === 'ballBall') {
      const hit = a.kind === 'cue' ? b : b.kind === 'cue' ? a : null;
      if (hit && r.firstHit == null) r.firstHit = hit.num;
    } else if (type === 'cushion') {
      if (r.firstHit != null) r.railAfter = true;
      if (a.kind !== 'cue') r.rails.add(a.id);
    } else if (type === 'pocket') {
      r.pots.push(a.kind === 'cue' ? 0 : a.num);
    }
  }

  // play one shot to rest; returns what happened and where everything stopped
  run(shot, cueAt = null, maxT = 14) {
    this.reset(cueAt);
    const cue = this.cue;
    this.rec = { firstHit: null, pots: [], railAfter: false, rails: new Set() };
    this.p.strike(cue, Math.cos(shot.angle), Math.sin(shot.angle), shot.speed, shot.side || 0, shot.top || 0);
    let t = 0;
    while (t < maxT) {
      this.p.step(H);
      t += H;
      if (!this.p.isMoving()) break;
    }
    const r = this.rec;
    this.rec = null;
    return {
      firstHit: r.firstHit, pots: r.pots, railAfter: r.railAfter, breakRails: r.rails.size,
      cue: cue.state === 'table' ? { x: cue.x, z: cue.z } : null,
      balls: this.p.balls.filter(b => b.state === 'table').map(b => ({ num: b.num, x: b.x, z: b.z, r: b.r, kind: b.kind })),
      time: t,
    };
  }
}
