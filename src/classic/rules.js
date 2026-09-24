// Standard 8-ball, kept readable. No called pockets; everything else follows
// the usual league rules:
//  - open table after the break; the first legal pot (after the break) assigns groups
//  - the cue ball must hit one of your own balls first (the 8 once your group is cleared)
//  - after contact, a ball must be pocketed or some ball must reach a cushion
//  - fouls give the opponent ball in hand (behind the head string after a break scratch)
//  - pocketing the 8 early, or while fouling, loses the frame

export const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
export const STRIPES = [9, 10, 11, 12, 13, 14, 15];

export function groupOf(n) {
  if (n >= 1 && n <= 7) return 'solids';
  if (n >= 9 && n <= 15) return 'stripes';
  if (n === 8) return 'eight';
  return null;
}
export const otherGroup = g => (g === 'solids' ? 'stripes' : g === 'stripes' ? 'solids' : null);
export const groupBalls = g => (g === 'solids' ? SOLIDS : g === 'stripes' ? STRIPES : []);

// Which balls the shooter may legally hit first.
//   onTable: Set of object-ball numbers still on the table
export function legalTargets(group, onTable) {
  if (!group) return [...onTable].filter(n => n !== 8);          // open table: anything but the 8
  const own = groupBalls(group).filter(n => onTable.has(n));
  return own.length ? own : [8];
}

// Evaluate a finished shot.
//  st:  { group: shooter's group or null, isBreak, onTable: Set before the shot }
//  rec: { firstHit: number|null, pots: [numbers in order, 0 = cue], railAfter: bool, breakRails: number }
// Returns { foul, reason, win, lose, endReason, assign, continueTurn, respot8, rerack, kitchen }
export function evaluate(st, rec) {
  const out = { foul: false, reason: null, win: false, lose: false, endReason: null, assign: null, continueTurn: false, respot8: false, rerack: false, kitchen: false };
  const scratch = rec.pots.includes(0);
  const objPots = rec.pots.filter(n => n > 0);
  const eight = objPots.includes(8);
  const foul = (reason) => { if (!out.foul) { out.foul = true; out.reason = reason; } };

  if (st.isBreak) {
    const legal = objPots.length > 0 || rec.breakRails >= 4;
    if (scratch) { foul('Cue ball scratched on the break.'); out.kitchen = true; }
    else if (!rec.firstHit) foul('The break missed the rack.');
    if (eight) out.respot8 = true;                                  // the 8 comes back; nobody loses on a break
    if (!out.foul && !legal) { out.rerack = true; out.reason = 'Illegal break. At least four balls must reach a cushion.'; return out; }
    if (!out.foul && objPots.length) out.continueTurn = true;     // any pot on the break keeps the table
    return out;
  }

  const onEight = st.group && groupBalls(st.group).every(n => !st.onTable.has(n));

  // --- fouls, most important first
  if (rec.firstHit == null) foul('The cue ball didn’t touch another ball.');
  else if (!st.group && rec.firstHit === 8) foul('The 8-ball can’t be hit first on an open table.');
  else if (st.group && onEight && rec.firstHit !== 8) foul('The 8-ball had to be hit first.');
  else if (st.group && !onEight && groupOf(rec.firstHit) !== st.group) foul('Wrong ball contacted first.');
  if (scratch) { const had = out.foul; foul('Cue ball scratched.'); if (had && out.reason !== 'Cue ball scratched.') out.reason += ' And the cue ball scratched.'; }
  if (!out.foul && objPots.length === 0 && !rec.railAfter) foul('No ball reached a cushion after contact.');

  // --- the 8-ball decides frames
  if (eight) {
    if (!onEight) { out.lose = true; out.endReason = 'pocketed the 8-ball early'; }
    else if (scratch) { out.lose = true; out.endReason = 'scratched on the 8-ball'; }
    else if (out.foul) { out.lose = true; out.endReason = 'fouled while potting the 8-ball'; }
    else { out.win = true; out.endReason = 'potted the 8-ball'; }
    return out;
  }
  if (out.foul) return out;

  // --- legal shot: assignment and continuation
  const potted = objPots;
  if (!st.group && potted.length) {
    out.assign = groupOf(potted[0]);
    out.continueTurn = true;
  } else if (st.group) {
    out.continueTurn = potted.some(n => groupOf(n) === st.group);
  }
  return out;
}
