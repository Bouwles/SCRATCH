// Computer opponents. They look at the table the way a player would — which
// balls are pottable, how thin the cut is, where the cue ball will end up —
// test their ideas on a private copy of the physics, then play the chosen
// shot on the real table with human error in aim, pace and spin.
// They never move balls, never touch the physics, never peek at randomness.

import { TABLE, PHYS } from '../config.js';
import { Sim } from './sim.js';
import { evaluate, legalTargets, otherGroup } from './rules.js';

const { L, W, R } = TABLE;

export const LEVELS = {
  easy: {
    name: 'EASY', aim: 0.013, pow: 0.16, spins: [{ top: 0, side: 0 }], position: 0, lookahead: false,
    safety: false, banks: false, kicks: false, pots: 4, blunder: 0.3, think: [1.0, 1.7], breakPow: 0.8,
  },
  normal: {
    name: 'NORMAL', aim: 0.0065, pow: 0.08, spins: [{ top: 0, side: 0 }, { top: 0.35, side: 0 }], position: 0.45, lookahead: false,
    safety: 'basic', banks: false, kicks: true, pots: 6, blunder: 0.06, think: [1.0, 1.5], breakPow: 0.9,
  },
  hard: {
    name: 'HARD', aim: 0.0033, pow: 0.045, spins: [{ top: 0, side: 0 }, { top: 0.5, side: 0 }, { top: -0.6, side: 0 }], position: 1.0, lookahead: false,
    safety: 'full', banks: true, kicks: true, pots: 7, blunder: 0, think: [1.1, 1.7], breakPow: 0.96,
  },
  expert: {
    name: 'EXPERT', aim: 0.0018, pow: 0.028, spins: [{ top: 0, side: 0 }, { top: 0.5, side: 0 }, { top: -0.65, side: 0 }, { top: 0.35, side: 0.45 }, { top: -0.4, side: -0.45 }], position: 1.3, lookahead: true,
    safety: 'full', banks: true, kicks: true, pots: 8, blunder: 0, think: [1.2, 1.9], breakPow: 1,
  },
};

// How an opponent likes to play, separate from how well: the same hands,
// different decisions.
export const STYLES = {
  balanced: { name: 'Balanced', desc: 'Takes the percentage shot. No surprises.' },
  cautious: { name: 'Cautious', desc: 'Plays safe whenever a pot is doubtful. Hates leaving you anything.', miss: -430, safety: 170, oppW: 1.35 },
  aggressive: { name: 'Aggressive', desc: 'Goes for everything, hits it hard, rarely plays safe.', miss: -170, safety: -380, pace: [1, 1.45, 1.9] },
  positional: { name: 'Positional', desc: 'Thinks two shots ahead. Always wants the next ball easy.', pos: 1.7, lookahead: true },
  trickster: { name: 'Trickster', desc: 'Loves a bank or a kick. Would rather be clever than safe.', banks: true, kicks: true, trick: 90 },
};

const OPP_SIGMA = 0.0065;          // assume a competent opponent when judging a leave
export const BREAK_SPEED = 9.6;    // a full break is harder than any normal stroke

// --------------------------------------------------------------- geometry
function segDist(px, pz, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az;
  const l2 = ex * ex + ez * ez || 1e-9;
  let t = ((px - ax) * ex + (pz - az) * ez) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
}
function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const inTable = (x, z, m = R) => x > -L + m && x < L - m && z > -W + m && z < W - m;

export function aimPoint(p) { return { x: p.mid.x + p.out.x * 0.012, z: p.mid.z + p.out.z * 0.012 }; }

// Probability of potting ball T in pocket P from cue position c, for an aim error sigma (radians).
// Returns 0 when the shot is blocked or impossible.
export function potChance(c, T, P, balls, sigma) {
  const A = aimPoint(P);
  let dx = A.x - T.x, dz = A.z - T.z;
  const dObj = Math.hypot(dx, dz);
  if (dObj < 1e-4) return 0;
  const ux = dx / dObj, uz = dz / dObj;
  const cosA = ux * P.out.x + uz * P.out.z;
  if (cosA < (P.kind === 'corner' ? 0.62 : 0.8)) return 0;
  const D = T.r + R;
  const gx = T.x - ux * D, gz = T.z - uz * D;
  if (!inTable(gx, gz, R * 0.98)) return 0;
  const cx = gx - c.x, cz = gz - c.z, dCue = Math.hypot(cx, cz);
  if (dCue < 1e-4) return 0;
  const cosCut = (cx * ux + cz * uz) / dCue;
  if (cosCut < 0.17) return 0;
  for (const B of balls) {
    if (B === T || B.kind === 'cue') continue;
    if (segDist(B.x, B.z, c.x, c.z, gx, gz) < B.r + R - 0.001) return 0;
    if (segDist(B.x, B.z, T.x, T.z, A.x, A.z) < B.r + T.r - 0.001) return 0;
  }
  const tol = Math.max(0.006, P.half * cosA - R * 0.55);
  const eps = (tol / dObj) * D * cosCut / Math.max(dCue, 0.05);
  let p = erf(eps / (sigma * Math.SQRT2));
  p *= 1 - Math.min(0.22, (dObj + dCue) * 0.045);
  return p;
}

// Best (and second best) pot chance for whoever plays `group` from cue position c.
export function tableQuality(c, balls, group, pockets, sigma) {
  if (!c) return { best: 0, second: 0 };
  const on = new Set(balls.filter(b => b.kind !== 'cue').map(b => b.num));
  const legal = new Set(legalTargets(group, on));
  let best = 0, second = 0;
  for (const T of balls) {
    if (T.kind === 'cue' || !legal.has(T.num)) continue;
    let bt = 0;
    for (const P of pockets) bt = Math.max(bt, potChance(c, T, P, balls, sigma));
    if (bt > best) { second = best; best = bt; } else if (bt > second) second = bt;
  }
  return { best, second };
}

// cue speed that sends the object ball dObj metres with some pace to spare
function paceFor(dCue, dObj, cosCut) {
  const vObj = Math.sqrt(2 * 0.26 * (dObj + 0.08)) + 0.22;
  const vHit = vObj / (0.975 * Math.max(0.22, cosCut));
  return Math.min(PHYS.maxShotSpeed * 0.9, Math.max(0.45, Math.sqrt(vHit * vHit + 2 * 0.75 * dCue)));
}
export const powerForSpeed = (v, max = PHYS.maxShotSpeed) => Math.pow(Math.max(0, Math.min(1, (v - PHYS.minShotSpeed) / (max - PHYS.minShotSpeed))), 1 / 1.55);

// ------------------------------------------------------------- planning
// ctx: { physics, group, isBreak, inHand, kitchen, level }
// A generator: yields after every simulated shot so the game can spread the
// thinking over several frames. The final value is the chosen shot.
export function* plan(ctx) {
  const base = LEVELS[ctx.level] || LEVELS.normal;
  const sty = STYLES[ctx.style] || STYLES.balanced;
  const lv = { ...base, position: base.position * (sty.pos || 1), lookahead: base.lookahead || !!sty.lookahead, banks: base.banks || !!sty.banks, kicks: base.kicks || !!sty.kicks };
  const phys = ctx.physics;
  const pockets = phys.pockets;
  const cue0 = phys.cue;
  const balls = phys.balls.filter(b => b.state === 'table').map(b => ({ num: b.num, x: b.x, z: b.z, r: b.r, kind: b.kind }));
  const onTable = new Set(balls.filter(b => b.kind !== 'cue').map(b => b.num));
  const group = ctx.group;
  const legal = new Set(legalTargets(group, onTable));
  const sim = new Sim();
  sim.load(phys);

  // ---- the break: from the kitchen, full ball on the head of the rack
  if (ctx.isBreak) {
    const apex = balls.filter(b => b.kind !== 'cue').sort((a, b) => a.x - b.x)[0];
    const z = (Math.random() - 0.5) * 0.24;
    const cuePos = { x: TABLE.headX - 0.02, z };
    const angle = Math.atan2(apex.z - z, apex.x - cuePos.x) + (Math.random() - 0.5) * 0.004;
    return { cuePos, angle, speed: BREAK_SPEED * lv.breakPow, top: 0.15, side: 0, kind: 'break' };
  }

  const score = (res, st) => {
    const out = evaluate(st, { ...res, breakRails: 0 });
    if (out.win) return { v: 6000, out };
    if (out.lose) return { v: -6000, out };
    if (out.foul) return { v: -650, out };
    if (out.continueTurn) {
      const g = out.assign || group;
      const q = tableQuality(res.cue, res.balls, g, pockets, lv.aim);
      let v = 420 + lv.position * 320 * q.best;
      if (lv.lookahead) v += 140 * q.second;
      if (q.best === 0) v -= 90 * lv.position;
      return { v, out };
    }
    const opp = tableQuality(res.cue, res.balls, group ? otherGroup(group) : null, pockets, OPP_SIGMA);
    return { v: (-340 * opp.best - 60 * opp.second) * (sty.oppW || 1), out };
  };
  const st = { group, isBreak: false, onTable };

  // ---- ball in hand: choose where to put the cue ball
  let cuePos = null;
  if (ctx.inHand) {
    const spots = [];
    for (const T of balls) {
      if (T.kind === 'cue' || !legal.has(T.num)) continue;
      for (const P of pockets) {
        const A = aimPoint(P);
        const d = Math.hypot(A.x - T.x, A.z - T.z), ux = (A.x - T.x) / d, uz = (A.z - T.z) / d;
        const gx = T.x - ux * (T.r + R), gz = T.z - uz * (T.r + R);
        for (const dist of [0.18, 0.3, 0.42]) for (const off of [0.12, -0.12, 0.3, -0.3, 0]) {
          const c = Math.cos(off), s = Math.sin(off);
          const vx = ux * c - uz * s, vz = ux * s + uz * c;
          const p = { x: gx - vx * dist, z: gz - vz * dist };
          if (!inTable(p.x, p.z, R + 0.01)) continue;
          if (ctx.kitchen && p.x > TABLE.headX - 0.01) continue;
          if (!phys.isFree(p.x, p.z, 0.006, cue0)) continue;
          const q = potChance(p, T, P, balls, lv.aim);
          if (q > 0) spots.push({ p, q: q + (Math.abs(off) > 0.05 ? 0.04 : 0) });
        }
      }
    }
    spots.sort((a, b) => b.q - a.q);
    if (spots.length) cuePos = spots[Math.floor(Math.random() * Math.min(lv.position > 0.5 ? 1 : 3, spots.length))].p;
    else {
      // nothing pottable anywhere: park it somewhere sensible in the kitchen / middle
      const tries = [[TABLE.headX - 0.05, 0], [TABLE.headX - 0.2, 0.2], [TABLE.headX - 0.2, -0.2], [0, 0.3], [0, -0.3]];
      for (const [x, z] of tries) if ((!ctx.kitchen || x <= TABLE.headX) && phys.isFree(x, z, 0.006, cue0)) { cuePos = { x, z }; break; }
      cuePos = cuePos || phys.findFreeSpot(TABLE.headX - 0.1, 0, cue0);
    }
  }
  const c = cuePos || { x: cue0.x, z: cue0.z };
  for (const b of balls) if (b.kind === 'cue') { b.x = c.x; b.z = c.z; }

  // ---- 1. pots (direct, then banks for the stronger players)
  const cands = [];
  for (const T of balls) {
    if (T.kind === 'cue' || !legal.has(T.num)) continue;
    for (const P of pockets) {
      const p = potChance(c, T, P, balls, lv.aim);
      if (p <= 0.02) continue;
      const A = aimPoint(P);
      const dObj = Math.hypot(A.x - T.x, A.z - T.z);
      const ux = (A.x - T.x) / dObj, uz = (A.z - T.z) / dObj;
      const gx = T.x - ux * (T.r + R), gz = T.z - uz * (T.r + R);
      const dCue = Math.hypot(gx - c.x, gz - c.z);
      const cosCut = ((gx - c.x) * ux + (gz - c.z) * uz) / dCue;
      cands.push({ T, P, p, angle: Math.atan2(gz - c.z, gx - c.x), pace: paceFor(dCue, dObj, cosCut), kind: 'pot' });
    }
  }
  if (lv.banks) {
    const lines = [['x', -L + R], ['x', L - R], ['z', -W + R], ['z', W - R]];
    for (const T of balls) {
      if (T.kind === 'cue' || !legal.has(T.num)) continue;
      for (const P of pockets) for (const [ax, v] of lines) {
        const A = aimPoint(P);
        const Am = ax === 'x' ? { x: 2 * v - A.x, z: A.z } : { x: A.x, z: 2 * v - A.z };
        const dx = Am.x - T.x, dz = Am.z - T.z, d = Math.hypot(dx, dz);
        const ux = dx / d, uz = dz / d;
        const k = ax === 'x' ? (v - T.x) / (ux || 1e-9) : (v - T.z) / (uz || 1e-9);
        if (k <= 0.05 || k >= d) continue;
        const Q = { x: T.x + ux * k, z: T.z + uz * k };
        if (ax === 'z' && (Math.abs(Q.x) > L - 0.14 || Math.abs(Q.x) < 0.12)) continue;
        if (ax === 'x' && Math.abs(Q.z) > W - 0.14) continue;
        let blocked = false;
        for (const B of balls) {
          if (B === T || B.kind === 'cue') continue;
          if (segDist(B.x, B.z, T.x, T.z, Q.x, Q.z) < B.r + T.r || segDist(B.x, B.z, Q.x, Q.z, A.x, A.z) < B.r + T.r) { blocked = true; break; }
        }
        if (blocked) continue;
        const gx = T.x - ux * (T.r + R), gz = T.z - uz * (T.r + R);
        if (!inTable(gx, gz, R)) continue;
        const cx = gx - c.x, cz = gz - c.z, dCue = Math.hypot(cx, cz);
        const cosCut = (cx * ux + cz * uz) / dCue;
        if (cosCut < 0.35) continue;
        if (balls.some(B => B !== T && B.kind !== 'cue' && segDist(B.x, B.z, c.x, c.z, gx, gz) < B.r + R)) continue;
        const dObj = d;
        const tol = Math.max(0.006, P.half * 0.7 - R * 0.55);
        const eps = (tol / dObj) * (T.r + R) * cosCut / Math.max(dCue, 0.05) * 0.7;
        const p = erf(eps / (lv.aim * Math.SQRT2)) * 0.8;
        if (p > 0.05) cands.push({ T, P, p, angle: Math.atan2(gz - c.z, gx - c.x), pace: paceFor(dCue, dObj * 1.25, cosCut), kind: 'bank' });
      }
    }
  }
  cands.sort((a, b) => b.p - a.p);
  const top = cands.slice(0, lv.pots);

  let best = null;
  const consider = (shot, v, p) => { if (!best || v > best.v) best = { ...shot, v, p }; };
  const MISS = sty.miss ?? -300;

  for (const cd of top) {
    // banks need their line found on the real cushions: try a few fine offsets
    const offsets = cd.kind === 'bank' ? [0, 0.004, -0.004, 0.009, -0.009] : [0];
    for (const off of offsets) {
      for (const spin of lv.spins) {
        for (const k of sty.pace || [1, 1.45]) {
          const shot = { angle: cd.angle + off, speed: Math.min(PHYS.maxShotSpeed * 0.92, cd.pace * k * (spin.top < 0 ? 1.25 : 1)), top: spin.top, side: spin.side, kind: cd.kind, target: cd.T.num };
          const res = sim.run(shot, c);
          yield 1;
          const s = score(res, st);
          const made = res.pots.includes(cd.T.num) && !s.out.foul && !s.out.lose;
          const p = made ? cd.p : cd.p * 0.15;
          consider(shot, p * s.v + (1 - p) * MISS + (cd.kind === 'bank' ? sty.trick || 0 : 0), p);
        }
      }
      if (cd.kind === 'bank' && best?.target === cd.T.num && best.p > 0.1) break;
    }
  }

  // ---- 2. safeties when the pot is a gamble
  const wantSafety = lv.safety && (!best || best.v < (lv.safety === 'full' ? 120 : -60) + (sty.safety || 0));
  if (wantSafety || !best) {
    const targets = balls.filter(b => b.kind !== 'cue' && legal.has(b.num)).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z)).slice(0, lv.safety === 'full' ? 4 : 2);
    for (const T of targets) {
      const d = Math.hypot(T.x - c.x, T.z - c.z), base = Math.atan2(T.z - c.z, T.x - c.x);
      for (const frac of lv.safety === 'full' ? [0.8, -0.8, 0.45, -0.45, 0] : [0.5, -0.5, 0]) {
        const off = Math.asin(Math.max(-0.99, Math.min(0.99, frac * (T.r + R) / d)));
        for (const sp of [0.9, 1.6, 2.6]) {
          const shot = { angle: base + off, speed: sp + d * 0.6, top: 0, side: 0, kind: 'safety', target: T.num };
          const res = sim.run(shot, c);
          yield 1;
          const s = score(res, st);
          consider(shot, s.v, 1);
        }
      }
    }
  }

  // ---- 3. snookered: kick at a legal ball off one cushion
  if ((!best || best.v < -500) && lv.kicks !== false) {
    const lines = [['x', -L + R], ['x', L - R], ['z', -W + R], ['z', W - R]];
    for (const T of balls.filter(b => b.kind !== 'cue' && legal.has(b.num)).slice(0, 5)) {
      for (const [ax, v] of lines) {
        const Tm = ax === 'x' ? { x: 2 * v - T.x, z: T.z } : { x: T.x, z: 2 * v - T.z };
        const angle = Math.atan2(Tm.z - c.z, Tm.x - c.x);
        for (const sp of [1.6, 2.6, 3.8]) {
          const shot = { angle, speed: sp, top: 0, side: 0, kind: 'kick', target: T.num };
          const res = sim.run(shot, c);
          yield 1;
          const s = score(res, st);
          consider(shot, s.v + (sty.trick ? sty.trick * 0.5 : 0), 1);
        }
      }
    }
  }

  // ---- 4. nothing sensible: just hit the nearest legal ball
  if (!best) {
    const T = balls.filter(b => b.kind !== 'cue' && legal.has(b.num)).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0] || balls.find(b => b.kind !== 'cue');
    best = { angle: Math.atan2(T.z - c.z, T.x - c.x), speed: 2.2, top: 0, side: 0, kind: 'hit', v: -999, p: 0 };
  }

  // ---- beginners sometimes go for the wrong thing entirely
  if (lv.blunder && top.length > 1 && Math.random() < lv.blunder) {
    const cd = top[1 + Math.floor(Math.random() * (top.length - 1))];
    best = { angle: cd.angle, speed: cd.pace * (0.8 + Math.random() * 0.9), top: 0, side: 0, kind: 'pot', v: 0, p: cd.p };
  }
  return { ...best, cuePos };
}

// Human hands: every shot leaves the cue with a little error.
export function execute(shot, level) {
  const lv = LEVELS[level] || LEVELS.normal;
  if (shot.kind === 'break') return { ...shot, angle: shot.angle + gauss() * lv.aim * 0.6, speed: Math.min(BREAK_SPEED, shot.speed * (1 + gauss() * lv.pow * 0.4)) };
  return {
    ...shot,
    angle: shot.angle + gauss() * lv.aim,
    speed: Math.max(0.3, Math.min(PHYS.maxShotSpeed, shot.speed * (1 + gauss() * lv.pow))),
    top: Math.max(-1, Math.min(1, shot.top + gauss() * lv.pow * 0.6)),
    side: Math.max(-1, Math.min(1, shot.side + gauss() * lv.pow * 0.6)),
  };
}
