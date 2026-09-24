// OBJECTIVES — every table in plain words: what to do, how far along you are,
// what a shot just did, and why a table ended. The objective intro, the
// encounter bar and the feedback line above it all read from here, so the
// same thing is always called the same thing.

import { lex } from './rajis.js';

const s = (n, one, many = one + 'S') => `${n} ${n === 1 ? one : many}`;

// First-time explanations: shown once in the objective intro, then never
// again (until tutorials are reset in Settings).
export const LEARN = {
  eight: ['THE 8 GOES LAST', 'Any ball counts, but the black 8 must be your final ball. Pot it early and it comes back and costs 2 shots.'],
  bank: ['BANK SHOT', 'Send the ball into a cushion first, then into the pocket. A ball that drops straight in does not count.'],
  kick: ['KICK SHOT', 'Your cue ball has to touch a cushion at some point in the shot, before or after it hits a ball.'],
  combo: ['COMBO', 'Two or more balls potted with the same shot. After a pot, that pocket glows hungry for a moment.'],
  gold: ['GOLD BALL', 'A gold ball turns up every couple of shots and vanishes again. Sink it for 10 chips.'],
  pillar: ['PILLARS', 'A shot that pots nothing drops a stone pillar onto the felt. The table gets harder the more you miss.'],
  chaos: ['CHAOS', 'After every shot a new random rule takes over the table. The current rule is shown at the top.'],
  marked: ['MARKED BALL', 'Only the ball in the gold ring counts. Balls in red square rings cost you 2 shots if they drop.'],
  blitz: ['AGAINST THE CLOCK', 'Unlimited shots, but the timer never stops, not even while the balls are rolling.'],
  classic8: ['SOLIDS, THEN THE 8', 'Solid balls 1 to 7 count. Stripes do nothing. The 8 counts only once all seven solids are down.'],
  sequence: ['IN ORDER', 'The numbers over the balls are the order. Pot 1, then 2, then 3. Out of order, it comes back and costs a shot.'],
  territory: ['POCKET VALUES', 'Each pocket is marked x1, x2 or x3: that is how many points a ball scores there. The values move every 3 shots.'],
  bounty: ['BOUNTY', 'Every ball scores 1. The ball marked x3 scores 3. Leave it alone for 3 shots and the bounty moves.'],
  escalation: ['ESCALATION', 'Every pot shrinks all the pockets a little and raises your score multiplier.'],
  hot: ['HOT BALL', 'The burning ball counts double. The number is its fuse: after 3 shots it explodes and costs you 2 shots.'],
  lockdown: ['LOCKDOWN', 'The pocket marked CLOSING seals for good after your next shot. Every second shot, another one goes.'],
  route: ['PERFECT ROUTE', 'Only the ROUTE balls count. A shot that misses them brings back every route ball you already sank.'],
  chain: ['CHAIN', 'Pot at least one ball on every shot. A shot that pots nothing drops the chain back to zero.'],
  race: ['RACE', 'Someone else is playing your table. After each of your shots they take one of theirs. First to the goal wins.'],
  puzzle: ['TRICK TABLE', 'A set-up shot with a real solution. Three attempts, no clock, and no heart at risk.'],
  boss: ['BOSS TABLE', 'The table fights back and gets nastier as you close in. Lose and you lose a heart, then try again.'],
};

// what each boss does, in one sentence a newcomer can act on
const BOSS_LINE = {
  crooked: 'The whole table tilts. Balls roll downhill, so aim a little uphill of the pocket.',
  mimic: 'Pockets close and open somewhere else. A pocket with red eyes spits balls back out.',
  void: 'One pocket is a black hole. It bends shots toward it, and what it eats does not count.',
  house: 'Miss, and the House takes a shot of its own and steals what it pots. Only 2 of your pots count per shot.',
  dealer: 'Each shot, one pocket is GOLD (counts double) and one is RED (counts nothing).',
  clock: 'You get a few seconds to aim, then the cue fires by itself. Clever shots buy time back.',
  collector: 'It borrows one of your relics each phase. Sink its gold-ringed ball to win one back.',
  architect: 'It builds walls across the felt between your shots. Pots that bounce off a wall pay extra.',
  bookie: 'Before every shot it offers a side bet. Press B to take it: win and you gain extra progress.',
  owner: 'Every pocket you use closes behind you.',
  // RAJIS
  richard: 'Locked targets take a missile after your shot. Destroy a locked target first: it counts double.',
  neil: 'A SUPPORT unit buffs the others. Destroy it for 2 and every buff goes with it.',
  paul: 'The machine blocks the obvious shot (the COUNTER pocket). Banks and caroms get past it.',
  yahya: 'Armoured targets shrug off soft hits. Hit them hard to crack the armour, then destroy them.',
  core: 'Every system at once. Destroy the targets, then the CORE itself.',
  paulyamin: 'Your reflection copies every target you destroy. First to the goal wins.',
};

// Everything the HUD needs to show one table.
//   name   the table's name        title  the objective headline
//   line   one plain sentence      count  progress in words
//   frac   0..1 of the bar         kind   'goal' | 'boss' | 'race' | 'puzzle'
//   unit   what one point is called (for "+1 BANK SHOT")
//   learn  first-time explanation key
export function objectiveInfo(G, e) {
  const def = e.def, g = e.goal, p = Math.max(0, Math.min(g, e.progress || 0)), id = def.id;
  const rj = G?.run?.mode === 'rajis';
  const potted = `${p} / ${g} POTTED`;
  let o = { name: def.name, title: `POT ${s(g, 'BALL')}`, line: `Pot any ${g} balls before your shots run out.`, count: potted, frac: p / g, kind: 'goal', unit: 'POTTED', learn: null };
  switch (id) {
    case 'standard': o.line = `Pot any ${g} balls before your shots run out. Save the 8 for last.`; o.learn = 'eight'; break;
    case 'combo': o = { ...o, title: g === 1 ? 'LAND A COMBO' : `LAND ${g} COMBOS`, line: 'A combo is 2 or more balls potted with one shot.', count: `${p} / ${g} COMBOS`, unit: 'COMBO', learn: 'combo' }; break;
    case 'precision': o = { ...o, title: `POT ${g} IN THE CORNERS`, line: 'The side pockets are closed. Only the four corner pockets are open.' }; break;
    case 'blitz': o = { ...o, title: `POT ${g} BEFORE TIME RUNS OUT`, line: 'Unlimited shots. The clock never stops, even while the balls roll.', learn: 'blitz' }; break;
    case 'trick': o = { ...o, title: `POT ${g} KICK SHOTS`, line: 'A pot only counts if your cue ball also hits a cushion during the shot.', count: `${p} / ${g} COMPLETE`, unit: 'KICK SHOT', learn: 'kick' }; break;
    case 'bank': o = { ...o, title: `POT ${g} BANK SHOTS`, line: 'The ball must touch a cushion before it drops. Straight pots do not count.', count: `${p} / ${g} COMPLETE`, unit: 'BANK SHOT', learn: 'bank' }; break;
    case 'golden': o = { ...o, line: `Pot ${g} balls. A gold ball appears now and then: sink it for 10 chips.`, learn: 'gold' }; break;
    case 'survival': o = { ...o, line: 'Every shot that pots nothing drops a stone pillar onto the table.', learn: 'pillar' }; break;
    case 'chaos': o = { ...o, line: 'A random rule changes the table after every shot.', learn: 'chaos' }; break;
    case 'assassin': o = { ...o, title: g === 1 ? 'SINK THE MARKED BALL' : `SINK ${g} MARKED BALLS`, line: 'Only the ball in the gold ring counts. Red square balls cost 2 shots.', count: `${p} / ${g} ${g === 1 ? 'TARGET' : 'TARGETS'}`, unit: 'TARGET', learn: 'marked' }; break;
    case 'classic': {
      const sol = Math.min(7, p);
      o = { ...o, title: p >= 7 ? 'NOW POT THE 8' : 'POT SOLIDS 1-7, THEN THE 8', line: 'Solid balls count. Stripes do nothing. The 8 counts only after all seven.', count: p >= 7 ? '7 / 7 SOLIDS · THE 8 IS NEXT' : `${sol} / 7 SOLIDS`, unit: 'SOLID', learn: 'classic8' };
      break;
    }
    case 'sequence': o = { ...o, title: `POT ${g} IN ORDER`, line: 'Pot the numbered balls 1, 2, 3... Out of order it comes back and costs a shot.', count: `${p} / ${g} · NEXT: ${Math.min(g, e.seqNext || 1)}`, unit: 'IN ORDER', learn: 'sequence' }; break;
    case 'territory': o = { ...o, title: `SCORE ${g} POINTS`, line: 'Each pocket pays x1, x2 or x3 points. The value is shown by the pocket.', count: `${p} / ${g} POINTS`, unit: 'POINT', learn: 'territory' }; break;
    case 'bounty': o = { ...o, title: `SCORE ${g} POINTS`, line: 'Every ball scores 1 point. The ball marked x3 scores 3.', count: `${p} / ${g} POINTS`, unit: 'POINT', learn: 'bounty' }; break;
    case 'escalation': o = { ...o, line: 'Every pot shrinks the pockets and raises your score multiplier.', learn: 'escalation' }; break;
    case 'hotpotato': o = { ...o, line: 'The burning ball counts double. Leave it 3 shots and it explodes: -2 shots.', count: `${p} / ${g} COUNTED`, unit: 'COUNTED', learn: 'hot' }; break;
    case 'lockdown': o = { ...o, title: `POT ${g} BEFORE THE POCKETS SEAL`, line: 'Every second shot, the pocket marked CLOSING seals for good.', learn: 'lockdown' }; break;
    case 'route': o = { ...o, title: `SINK THE ${g} ROUTE BALLS`, line: 'Only ROUTE balls count. A shot that misses them brings the sunk ones back.', count: `${p} / ${g} ON ROUTE`, unit: 'ON ROUTE', learn: 'route' }; break;
    case 'chain': o = { ...o, title: `POT ON ${g} SHOTS IN A ROW`, line: 'Pot at least one ball every shot. A shot that pots nothing resets the chain.', count: `CHAIN ${p} / ${g}`, unit: 'IN THE CHAIN', learn: 'chain' }; break;
    case 'rival': {
      const rv = e.rivalDef, short = rv ? rv.name.replace(/^THE /, '') : 'RIVAL';
      const rs = Math.min(g, e.rivalScore || 0);
      o = { ...o, name: rv ? rv.name : def.name, title: `FIRST TO ${g}`, line: `${rv ? rv.name : 'A rival'} plays this table too, one shot after each of yours. Pot ${g} first.`, count: `YOU ${p} · ${short} ${rv?.hidden && !e.done ? '?' : rs}`, kind: 'race', rival: { name: short, color: rv?.color || '#ff3b5c', score: rs, hidden: !!rv?.hidden && !e.done }, learn: 'race' };
      break;
    }
    case 'trickshot': {
      const left = Math.max(0, e.shots);
      o = { ...o, name: e.puzzle?.name || def.name, title: e.puzzle ? e.puzzle.hint.toUpperCase() : 'SOLVE THE TABLE', line: 'One shot, set up just so. The layout resets after every attempt. No heart at risk.', count: `${s(left, 'ATTEMPT')} LEFT`, kind: 'puzzle', unit: 'SOLVED', learn: 'puzzle' };
      break;
    }
    default: break;
  }
  if (def.boss) {
    const left = g - p;
    o = {
      ...o, name: def.name, kind: 'boss', frac: left / g, learn: 'boss',
      title: `POT ${s(g, 'BALL')} TO BREAK IT`,
      line: BOSS_LINE[id] || def.blurb,
      count: `${s(left, 'BALL')} REMAIN`,
      unit: 'HIT',
    };
    if (id === 'owner') {
      o.line = e.lastGame ? 'The 8. The marked pocket. Nothing else.' : e.phase >= 3 ? 'The lights are out. Only the lit ball counts.' : e.phase >= 2 ? 'Pockets close behind you. The pattern has changed.' : BOSS_LINE.owner;
      o.count = e.lastGame ? 'LAST GAME' : `${s(left, 'BALL')} REMAIN`;
    }
    if (id === 'house') o.line = BOSS_LINE.house;
    if (id === 'paulyamin') {
      const rs = Math.min(g, e.rivalScore || 0);
      o = { ...o, kind: 'race', frac: p / g, title: `FIRST TO ${g}`, count: `YOU ${p} · REFLECTION ${rs}`, rival: { name: 'REFLECTION', color: def.color, score: rs, hidden: false } };
    }
    if (id === 'core') { o.title = e.coreTime ? 'DESTROY THE CORE' : `DESTROY ${g - 1}, THEN THE CORE`; if (e.coreTime) o.count = 'THE CORE IS EXPOSED'; }
    if (id === 'richard') o.count = `${s(left, 'TARGET')} REMAIN · SALVO ${e.salvo || 0}`;
  }
  if (rj) o = rajisWords(o, e);
  return o;
}

// the same table as the war sees it
function rajisWords(o, e) {
  const t = (x) => lex(String(x).replace(/^POT /, 'DESTROY ').replace(/ POTTED$/, ' DESTROYED'));
  const out = { ...o, title: t(o.title), line: lex(o.line), count: t(o.count), unit: t(o.unit) };
  if (o.kind === 'boss') out.count = lex(o.count.replace(/BALLS? REMAIN/, (m) => (m.startsWith('BALLS') ? 'TARGETS REMAIN' : 'TARGET REMAINS')));
  return out;
}

// the rule-line text for the encounter bar during a boss: what the current phase does
export function phaseLine(e) {
  const ph = Math.min(3, e.phase || 1);
  const txt = e.def.phases?.[ph - 1];
  return txt ? `PHASE ${['I', 'II', 'III'][ph - 1]} · ${txt}` : '';
}

// Why a pot did not count, in words. null = no explanation needed.
export function invalidPot(G, e, S, pot) {
  const b = pot.ball, id = e?.def?.id;
  if (pot.devoured) return 'DEVOURED · DOES NOT COUNT';
  if (b.tags.forbidden) return 'FORBIDDEN BALL · -2 SHOTS';
  if (b.kind === 'golden') return null;
  if (b.num === 8 && b.kind === 'object' && id !== 'classic') return null;   // the early-eight rule explains itself at the end of the shot
  switch (id) {
    case 'bank': return 'STRAIGHT POT · NO CUSHION · DOES NOT COUNT';
    case 'assassin': return 'WRONG BALL · ONLY THE MARKED BALL COUNTS';
    case 'route': return 'NOT A ROUTE BALL · DOES NOT COUNT';
    case 'sequence': return b.tags.seq ? 'OUT OF ORDER · IT COMES BACK' : 'NO NUMBER · DOES NOT COUNT';
    case 'classic': return b.num === 8 ? 'TOO EARLY FOR THE 8' : 'STRIPE · ONLY SOLIDS COUNT';
    case 'dealer': return pot.pocket?.mark === 'bad' ? 'RED POCKET · BUSTED' : null;
    case 'owner': return 'THAT POCKET IS CLOSED TO YOU';
    default: return 'DOES NOT COUNT';
  }
}

// A finished table, explained. reason is the short code the run uses.
export function endText(e, won, reason = '') {
  const def = e.def;
  if (won) {
    if (def.boss) return { title: 'BOSS DEFEATED', sub: `${def.name} FALLS` };
    if (e.kind === 'trickshot') return { title: 'SOLVED', sub: 'THE TRICK TABLE IS BEATEN' };
    if (e.rivalDef) return { title: 'RACE WON', sub: `YOU BEAT ${e.rivalDef.name}` };
    const spare = def.id === 'blitz' ? `${Math.ceil(e.timer)} SECONDS TO SPARE` : e.shots > 0 && e.shots < 50 ? `${s(e.shots, 'SHOT')} TO SPARE` : '';
    return { title: 'TABLE CLEARED', sub: [`${e.goal} / ${e.goal}`, spare, e.misses === 0 && e.shotsTaken > 0 ? 'NOT A SINGLE MISS' : ''].filter(Boolean).join(' · ') };
  }
  const T = def.boss ? 'BOSS WINS' : e.kind === 'trickshot' ? 'NOT THIS TIME' : e.rivalDef ? 'RACE LOST' : 'TABLE FAILED';
  let why;
  if (/WINS$/.test(reason) && e.rivalDef) why = `${e.rivalDef.name} reached ${e.goal} first.`;
  else if (reason === 'TIME UP') why = 'The clock ran out.';
  else if (reason === 'OUT OF ATTEMPTS') why = 'All three attempts are used up.';
  else if (reason === 'STAKE BROKEN') why = `You broke the High Stakes rule${e.stake ? `: ${e.stake.name}` : ''}.`;
  else if (reason === 'OUT OF SHOTS') { const k = Math.max(0, e.goal - e.progress); why = `You ran out of shots with ${k} ${k === 1 ? 'ball' : 'balls'} to go.`; }
  else why = reason ? reason.charAt(0) + reason.slice(1).toLowerCase() + '.' : 'The table beat you.';
  return { title: T, sub: why };
}

// what a shot that counted gets told: "+1 BANK SHOT · 2 / 3 COMPLETE"
const COUNTED_UNITS = /^(POINT|COMBO|TARGET|BANK SHOT|KICK SHOT|SOLID|HIT)$/;
export function gainText(o, n) {
  if (o.kind === 'boss') return `${n > 1 ? `${n} HITS` : 'HIT'} · ${o.count}`;
  if (COUNTED_UNITS.test(o.unit)) return `+${n} ${o.unit}${n > 1 ? 'S' : ''} · ${o.count}`;
  return `COUNTED +${n} · ${o.count}`;
}
