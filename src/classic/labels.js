// What a Classic shot was, in the words a commentator would use: BANK, DOUBLE
// BANK, COMBINATION, CAROM, LONG POT, BREAK POT, GOOD POSITION, SAFETY.
// Recognition only: nothing here changes the rules or the score.

import { tableQuality } from './ai.js';

const OPP_SIGMA = 0.0065;            // a competent player's aim, for judging a leave

// r: the shot record, out: the rules' verdict, p / opp: shooter and opponent (after groups are assigned)
export function readShot(physics, r, out, p, opp) {
  const labels = [];
  const own = r.potBalls.filter(b => b.kind !== 'cue');
  const legal = !out.foul && !out.lose && !out.rerack;
  let banks = 0, longest = 0, safety = false;
  if (legal && r.isBreak && own.length) labels.push(own.length > 1 ? `BREAK POT ×${own.length}` : 'BREAK POT');
  if (legal && !r.isBreak) {
    for (const b of own) {
      if (b.cushions >= 2) { labels.push('DOUBLE BANK'); banks++; }
      else if (b.cushions === 1) { labels.push('BANK'); banks++; }
      const toucher = b.lastToucher;
      if (toucher && toucher.kind !== 'cue' && r.firstHit !== b.num) labels.push('COMBINATION');
      else if (r.firstHit != null && r.firstHit !== b.num && toucher?.kind === 'cue') labels.push('CAROM');
      if (b.travel >= 1.3) labels.push('LONG POT');
      longest = Math.max(longest, b.travel || 0);
    }
  }
  const cue = physics.cue;
  const balls = physics.balls.filter(b => b.state === 'table');
  if (legal && cue && cue.state === 'table' && !r.isBreak) {
    if (!own.length && !out.continueTurn && r.firstHit != null) {
      // nothing potted, a legal hit: what did it leave the other player?
      const q = tableQuality(cue, balls, opp.group, physics.pockets, OPP_SIGMA);
      if (q.best < 0.14) { labels.push(p.ai ? 'SAFETY' : 'GOOD SAFETY'); safety = true; }
    } else if (own.length && out.continueTurn && !out.win) {
      const q = tableQuality(cue, balls, p.group, physics.pockets, OPP_SIGMA);
      if (q.best >= 0.82 && (cue.travel || 0) >= 0.35) labels.push('GOOD POSITION');
    }
  }
  return { labels: [...new Set(labels)].slice(0, 2), banks, longest, safety };
}
