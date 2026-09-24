// RELICS — simple hooks that bend billiards. The fun is in the stacking.
//
// Hooks (all optional), G = Game, S = current shot record:
//   mods(G, P)             physics params, rebuilt every shot
//   pockets(G, pockets)    pocket params, rebuilt every shot
//   shotStart(G, S)        tweak S.speed / S.angle / S.spin
//   firstHit(G, S, ball)   cue ball's first contact this shot
//   ballHit(G, S, a, b, v) any ball-ball contact
//   cushion(G, S, ball, v)
//   pot(G, S, pot)         an object ball dropped
//   scratch(G, S)
//   shotEnd(G, S)          add score lines / chips before the tally
//   encounterStart(G)
//
// tags: the build styles a relic belongs to (shown on its card) — BANK, CHAOS,
// CONTROL, GREED, CURSED, COMBO. Builds are never chosen, they just happen.
// up: an upgrade. Picking a relic you already own tunes it up to NAME+.

import { rand } from './rng.js';

export const MAX_RELICS = 8;

export const RARITY = {
  common: { name: 'COMMON', color: '#b8c4d8', weight: 60, price: 7 },
  rare: { name: 'RARE', color: '#3bb4ff', weight: 28, price: 11 },
  cursed: { name: 'CURSED', color: '#ff3b5c', weight: 9, price: 8 },
  legendary: { name: 'LEGENDARY', color: '#ffc21c', weight: 5, price: 22 },
};

export const TAG_COLORS = { BANK: '#2bf0ff', CHAOS: '#ff8a1b', CONTROL: '#e8ecf4', GREED: '#ffc21c', CURSED: '#ff3b5c', COMBO: '#ff2bd6' };

// Helpers the synergies use (G is the Game)
const has = (G, id) => G.hasRelic(id);
const heat = (G) => (G.run?.heat || 0);
const styleG = (G) => { const v = G.run?.style || 0; return v >= 86 ? 5 : v >= 68 ? 4 : v >= 50 ? 3 : v >= 32 ? 2 : v >= 15 ? 1 : 0; };
const up = (G, id) => (G.run?.relicLv?.[id] || 1) >= 2;          // upgraded?
const curse = (G) => (has(G, 'black_label') ? 1.5 : 1);            // BLACK LABEL feeds curses

export const RELICS = [
  // ------------------------------------------------------------ COMMON
  {
    id: 'heavy_cue', name: 'HEAVY CUE', rarity: 'common', tags: ['CHAOS'],
    desc: '+40% shot power, slightly shaky aim. Pots on 80%+ power shots get +0.5x.',
    shotStart(G, S) { S.speed *= 1.4; },
    shotEnd(G, S) { if (S.power >= 0.8 && S.pots.length) S.mult += 0.5; },
    wobble: 0.004,
  },
  {
    id: 'moon_gravity', name: 'MOON GRAVITY', rarity: 'common', tags: ['BANK'],
    desc: 'Balls barely slow down. LONG POTS score double.',
    up: 'LONG POTS score triple.',
    mods(G, P) { P.muRoll *= 0.4; P.muSlide *= 0.75; },
    shotStart(G, S) { S.longX = up(G, 'moon_gravity') ? 3 : 2; },
  },
  {
    id: 'extra_chalk', name: 'EXTRA CHALK', rarity: 'common', stack: true,
    desc: '+1 shot every table. Stacks.',
    extraShots: 1,
  },
  {
    id: 'bucket_pockets', name: 'BUCKET POCKETS', rarity: 'common', tags: ['CONTROL'],
    desc: 'Pockets swallow from 35% further away.',
    up: 'Pockets swallow from 70% further away.',
    pockets(G, pk) { for (const p of pk) p.scale *= up(G, 'bucket_pockets') ? 1.7 : 1.35; },
  },
  {
    id: 'laser_sight', name: 'LASER SIGHT', rarity: 'common', tags: ['CONTROL'],
    desc: 'Longer aim hints and the first cushion bounce. PERFECT POSITION pays double.',
    up: 'Even longer hints. PERFECT POSITION pays triple.',
    laser: true,
    shotStart(G, S) { S.posX = up(G, 'laser_sight') ? 3 : 2; },
  },
  {
    id: 'piggy_bank', name: 'PIGGY BANK', rarity: 'common', tags: ['GREED'],
    desc: '+1 chip for every ball you pot (+2 from HEAT III).',
    up: '+2 chips for every ball you pot (+3 from HEAT III).',
    pot(G, S) { S.chips += (heat(G) >= 3 ? 2 : 1) + (up(G, 'piggy_bank') ? 1 : 0); },
  },
  {
    id: 'rubber_rails', name: 'RUBBER RAILS', rarity: 'common', tags: ['BANK', 'CHAOS'],
    desc: 'Ridiculously bouncy cushions. With TRICKSTER, every rail hit is worth double.',
    mods(G, P) { P.cushionRest = 0.97; },
  },
  {
    id: 'cashback', name: 'CASHBACK', rarity: 'common', tags: ['GREED', 'CURSED'],
    desc: 'Scratching pays 6 chips and never costs STYLE. Holding a cursed relic? The scratch detonates the pocket.',
    scratch(G, S) {
      S.chips += 6; G.popText('CASHBACK +6', '#ffe23b');
      const p = S.scratchPocket;
      if (p && G.run.relics.some(r => r.rarity === 'cursed')) { G.later(0.1, () => G.explode(p.mid.x, p.mid.z, 0.3, 1.8, null)); G.synergy('cashback', G.run.relics.find(r => r.rarity === 'cursed').id, 'CURSED CASHBACK'); }
    },
  },
  {
    id: 'lucky_seven', name: 'LUCKY SEVEN', rarity: 'common', tags: ['GREED'],
    desc: 'Sink the 7: +777 and +8 chips. Sink it together with a golden ball: JACKPOT x7.',
    pot(G, S, pot) {
      if (pot.ball.num === 7) { S.lines.push(['LUCKY SEVEN', 777]); S.chips += 8; S.seven = true; G.achieve('lucky'); G.popText('LUCKY 7!', '#ffe23b', 1.4); }
    },
    shotEnd(G, S) { if (S.seven && S.golds) { S.multX *= 7; S.lines.push(['JACKPOT', 7777]); G.synergy('lucky_seven', null, 'JACKPOT x7'); } },
  },
  {
    id: 'trickster', name: 'TRICKSTER', rarity: 'common', tags: ['BANK'],
    desc: 'Every cushion hit adds +0.2x to a pot (max 3x). Banked balls count double.',
    up: '+0.3x per cushion hit (max 4.5x).',
    shotEnd(G, S) {
      if (!S.cushionHits || !S.pots.length) return;
      const banks = S.pots.filter(p => p.bank).length;
      let hits = S.cushionHits + banks;
      if (has(G, 'rubber_rails')) { hits *= 2; G.synergy('trickster', 'rubber_rails', 'RUBBER TRICKS'); }
      const k = up(G, 'trickster') ? 0.3 : 0.2;
      S.mult += Math.min(k * 15, hits * k);
    },
  },
  {
    id: 'bankers_delight', name: "BANKER'S DELIGHT", rarity: 'common', tags: ['BANK', 'GREED'],
    desc: 'Bank shots pay triple chips and +250. Every bank also recharges GHOST BALL and REWIND.',
    pot(G, S, pot) {
      if (!pot.bank) return;
      S.chips += 3; S.lines.push(['BANKER', 250]);
      const e = G.enc;
      if (has(G, 'ghost_ball') && (e.ghostCharges || 0) < 2) { e.ghostCharges = (e.ghostCharges || 0) + 1; G.synergy('bankers_delight', 'ghost_ball', 'GHOST RECHARGED'); }
      if (has(G, 'rewind') && (e.rewinds || 0) < 2) { e.rewinds = (e.rewinds || 0) + 1; G.synergy('bankers_delight', 'rewind', 'REWIND RECHARGED'); }
    },
  },
  {
    id: 'spin_doctor', name: 'SPIN DOCTOR', rarity: 'common', tags: ['CONTROL', 'CHAOS'],
    desc: 'Spin is 80% stronger. Heavy spin (60%+) charges static: the cue ball zaps every ball it touches.',
    up: 'Static charges from 40% spin and zaps twice as many balls.',
    shotStart(G, S) { S.spinMul *= 1.8; S.static = Math.hypot(S.side, S.top) >= (up(G, 'spin_doctor') ? 0.4 : 0.6); },
    ballHit(G, S, a, b) {
      if (!S.static || (S.statics || 0) >= (up(G, 'spin_doctor') ? 8 : 4)) return;
      const cue = a.kind === 'cue' ? a : b.kind === 'cue' ? b : null;
      if (!cue) return;
      const o = cue === a ? b : a;
      S.statics = (S.statics || 0) + 1;
      G.fx.lightning(cue.x, cue.z, o.x, o.z, 0x80e0ff);
      G.audio.zap();
      S.lines.push(['STATIC', 60]);
    },
  },
  {
    id: 'dead_center', name: 'DEAD CENTER', rarity: 'common', tags: ['CONTROL'],
    desc: 'No spin and a near-full hit (under 10° of cut): the ball leaves 35% faster. Pot it that way for +0.5x.',
    up: 'The ball leaves 60% faster, and +1x.',
    firstHit(G, S, ball) {
      if (Math.hypot(S.side, S.top) > 0.08 || S.cutDeg > 10) return;
      S.centered = true;
      const k = up(G, 'dead_center') ? 1.6 : 1.35;
      ball.vx *= k; ball.vz *= k;
      G.ballView.flash(ball, 1);
      G.ui.worldPop('DEAD CENTER', G.worldPos(ball.x, ball.z, 0.1), '#ffffff');
    },
    shotEnd(G, S) { if (S.centered && S.pots.length) S.mult += up(G, 'dead_center') ? 1 : 0.5; },
  },
  {
    id: 'encore', name: 'ENCORE', rarity: 'common', tags: ['COMBO'],
    desc: 'Your first multi-pot on each table refunds 2 shots.',
    up: 'Refunds 3 shots.',
    shotEnd(G, S) {
      const e = G.enc;
      if (!e || e.encored || S.pots.filter(p => !p.house && p.ball.kind !== 'cue').length < 2) return;
      e.encored = true;
      const n = up(G, 'encore') ? 3 : 2;
      e.shots += n;
      G.popText(`ENCORE  +${n} SHOTS`, '#ff2bd6', 1.3);
    },
  },
  {
    id: 'pocket_change', name: 'POCKET CHANGE', rarity: 'common', tags: ['GREED'],
    desc: 'Pot into a different pocket than your last pot: +1 chip, and it grows (+1, +2, +3…). Same pocket twice resets it.',
    up: 'The bonus grows twice as fast.',
    pot(G, S, pot) {
      const run = G.run;
      if (run.pcLast === pot.pocket.index) run.pcChain = 0;
      else run.pcChain = Math.min(8, (run.pcChain || 0) + (up(G, 'pocket_change') ? 2 : 1));
      run.pcLast = pot.pocket.index;
      if (run.pcChain > 0) { S.chips += run.pcChain; G.ui.worldPop(`+${run.pcChain}`, G.worldPos(pot.pocket.x, pot.pocket.z, 0.15), '#ffe23b'); }
    },
  },
  {
    id: 'deadeye', name: 'DEADEYE', rarity: 'common', tags: ['CONTROL'],
    desc: 'Long pots (over 1.2 m of travel) pay +300 and jolt STYLE upward.',
    up: '+600 and a much bigger STYLE jolt.',
    pot(G, S, pot) {
      if (pot.ball.travel < 1.2) return;
      S.lines.push(['DEADEYE', up(G, 'deadeye') ? 600 : 300]);
      G.run.style = Math.min(100, (G.run.style || 0) + (up(G, 'deadeye') ? 18 : 10));
    },
  },
  {
    id: 'insurance', name: 'INSURANCE', rarity: 'common', tags: ['CONTROL'],
    desc: 'The first scratch on each table is free: no lost shot, no lost STYLE, streak intact.',
    scratch(G, S) { if (!G.enc || G.enc.insured) return; G.enc.insured = true; S.insured = true; G.popText('INSURED', '#2b6bff', 1.2); },
  },
  // ------------------------------------------------------------- RARE
  {
    id: 'explosive_chalk', name: 'EXPLOSIVE CHALK', rarity: 'rare', tags: ['CHAOS'],
    desc: 'The first ball you hit explodes. With THUNDER CUE, explosions arc lightning; with NITRO, blasts chain further.',
    up: 'A much bigger, harder blast.',
    firstHit(G, S, ball) { const u = up(G, 'explosive_chalk'); G.explode(ball.x, ball.z, u ? 0.34 : 0.24, u ? 2.2 : 1.7, ball); },
  },
  {
    id: 'magnet_pocket', name: 'MAGNET POCKET', rarity: 'rare', tags: ['COMBO'],
    desc: 'One pocket pulls balls in. After a multi-pot, EVERY pocket pulls during your next shot.',
    up: 'Two magnet pockets, pulling harder.',
    pockets(G, pk) {
      const i = G.enc?.magnetPocket ?? 0;
      const u = up(G, 'magnet_pocket');
      if (pk[i]) pk[i].pull += u ? 2.2 : 1.6;
      if (u && pk[(i + 3) % 6]) pk[(i + 3) % 6].pull += 2.2;
      if (G.enc?.magnetAll) for (const p of pk) p.pull += 1.1;
    },
    encounterStart(G) { G.enc.magnetPocket = [0, 2, 3, 5, 1, 4][Math.floor(Math.random() * 6)]; },
    shotEnd(G, S) {
      const multi = S.pots.filter(p => !p.house && p.ball.kind !== 'cue').length >= 2;
      if (multi && !G.enc.magnetAll) G.synergy('magnet_pocket', null, 'ALL POCKETS MAGNETISED');
      G.enc.magnetAll = multi;
    },
  },
  {
    id: 'ghost_ball', name: 'GHOST BALL', rarity: 'rare', tags: ['CONTROL'],
    desc: 'Once per table, press [G] so the cue ball passes through the first ball it meets.',
    up: 'Twice per table.',
    encounterStart(G) { G.enc.ghostCharges = (G.enc.ghostCharges || 0) + (up(G, 'ghost_ball') ? 2 : 1); },
  },
  {
    id: 'double_tap', name: 'DOUBLE TAP', rarity: 'rare', tags: ['CHAOS'],
    desc: 'Every third shot fires a second impulse into the cue ball. At STYLE S+, every shot does.',
    shotStart(G, S) {
      G.run.doubleTapCount = (G.run.doubleTapCount || 0) + 1;
      if (G.run.doubleTapCount % 3 === 0 || styleG(G) >= 4) S.doubleTap = 0.45;
    },
  },
  {
    id: 'hot_streak', name: 'HOT STREAK', rarity: 'rare', tags: ['COMBO'],
    desc: 'Potting streaks add +12% power and +0.5x each (max 5). Doubled at STYLE S or higher.',
    up: 'The streak counts up to 8.',
    shotStart(G, S) { S.speed *= 1 + 0.12 * Math.min(up(G, 'hot_streak') ? 8 : 5, G.run.streak); },
    shotEnd(G, S) {
      if (!S.pots.length || G.run.streak <= 0) return;
      const k = styleG(G) >= 3 ? 2 : 1;
      S.mult += 0.5 * Math.min(up(G, 'hot_streak') ? 8 : 5, G.run.streak) * k;
    },
  },
  {
    id: 'clone_ball', name: 'CLONE BALL', rarity: 'rare', tags: ['COMBO', 'CHAOS'],
    desc: 'The first ball you sink each table drops back in as a clone. Golden balls clone as gold.',
    up: 'The first TWO balls clone.',
    pot(G, S, pot) {
      const e = G.enc;
      if ((e.clones || 0) < (up(G, 'clone_ball') ? 2 : 1) && pot.ball.kind !== 'clone') {
        e.clones = (e.clones || 0) + 1;
        const gold = pot.ball.kind === 'golden';
        G.later(0.6, () => G.spawnDropBall(pot.ball.num, gold ? 'golden' : 'clone'));
        G.popText(gold ? 'GOLDEN CLONE' : 'CLONED', gold ? '#ffd040' : '#9a4bff');
      }
    },
  },
  {
    id: 'black_hole', name: 'BLACK HOLE POCKET', rarity: 'rare', tags: ['COMBO'],
    desc: 'After a combo, a pocket becomes enormous for 5 s. With MAGNET POCKET, it also drags balls in.',
    pot(G, S) {
      if (S.pots.length === 2) {
        const i = Math.floor(Math.random() * 6);
        G.blackHole = { i, t: 5, pull: has(G, 'magnet_pocket') };
        if (G.blackHole.pull) G.synergy('black_hole', 'magnet_pocket', 'EVENT HORIZON');
        G.popText('BLACK HOLE', '#9a4bff', 1.2);
        G.audio.whoosh(2);
      }
    },
  },
  {
    id: 'thunder_cue', name: 'THUNDER CUE', rarity: 'rare', tags: ['CHAOS'],
    desc: 'Shots over 70% power chain lightning. Heavy-spin shots (with SPIN DOCTOR) trigger it at any power.',
    up: 'Triggers from 50% power and chains to 7 balls.',
    firstHit(G, S, ball) {
      const u = up(G, 'thunder_cue');
      if (S.power >= (u ? 0.5 : 0.7)) G.thunder(ball, u ? 7 : 4);
      else if (S.static) { G.thunder(ball, u ? 7 : 4); G.synergy('thunder_cue', 'spin_doctor', 'STATIC STORM'); }
    },
  },
  {
    id: 'glass_balls', name: 'GLASS BALLS', rarity: 'rare', tags: ['CHAOS'],
    desc: 'Faster, wildly chaotic collisions. Every collision over 2 m/s adds +0.1x (max +2x).',
    mods(G, P) { P.ballRest = 1.0; P.chaos += 0.12; },
    ballHit(G, S, a, b, v) { if (v > 2) S.glassMult = Math.min(2, (S.glassMult || 0) + 0.1); },
    shotEnd(G, S) { if (S.glassMult && S.pots.length) S.mult += S.glassMult; },
  },
  {
    id: 'pinball', name: 'PINBALL WIZARD', rarity: 'rare', tags: ['CHAOS', 'BANK'],
    desc: 'Two bumpers on every table (+150 a hit). Pots off a bumper count as real skill.',
    encounterStart(G) { G.addBumpers(2); },
  },
  {
    id: 'homing', name: 'HOMING CHALK', rarity: 'rare', tags: ['CONTROL'],
    desc: 'The cue ball curves toward the nearest ball until it hits something.',
    homing: true,
  },
  {
    id: 'kiss_shot', name: 'KISS SHOT', rarity: 'rare', tags: ['COMBO', 'GREED'],
    desc: 'A ball potted by ANOTHER object ball (carom or combination) pays +400 and +3 chips.',
    up: '+800 and +5 chips.',
    pot(G, S, pot) {
      if (!pot.kiss || !pot.counted) return;
      const u = up(G, 'kiss_shot');
      S.lines.push(['KISS', u ? 800 : 400]); S.chips += u ? 5 : 3;
      G.ui.worldPop('KISS', G.worldPos(pot.pocket.x, pot.pocket.z, 0.15), '#ff2bd6', 1.2);
    },
  },
  {
    id: 'orbit', name: 'ORBIT', rarity: 'rare', tags: ['CONTROL'],
    desc: 'Heavy side spin (50%+) bends the cue ball\'s path before it hits anything. Curve around blockers.',
    up: 'Bends from 30% side spin, and harder.',
    orbit: true,
  },
  {
    id: 'aftershock', name: 'AFTERSHOCK', rarity: 'rare', tags: ['BANK', 'CHAOS'],
    desc: 'Hard cushion impacts (2.5 m/s+) send a shockwave that shoves nearby balls. 3 per shot.',
    up: 'A wider shockwave, 5 per shot.',
    cushion(G, S, ball, v) {
      const u = up(G, 'aftershock');
      if (v < 2.5 || (S.shocks || 0) >= (u ? 5 : 3)) return;
      S.shocks = (S.shocks || 0) + 1;
      const rad = u ? 0.4 : 0.28;
      for (const b of G.physics.balls) {
        if (b === ball || b.state !== 'table') continue;
        const dx = b.x - ball.x, dz = b.z - ball.z, d = Math.hypot(dx, dz);
        if (d > rad || d < 1e-4) continue;
        const f = 0.9 * (1 - d / rad);
        b.vx += dx / d * f; b.vz += dz / d * f;
        b.relicMoved = true;
      }
      G.fx.ring(ball.x, ball.z, 0xff8a1b, rad, 0.3);
      G.shake(0.1);
      G.audio.rail(v * 0.6, ball.x);
      S.lines.push(['AFTERSHOCK', 80]);
    },
  },
  {
    id: 'hot_rail', name: 'HOT RAIL', rarity: 'rare', tags: ['BANK'],
    desc: 'Every ball speeds up 8% each time it hits a cushion (4 times each). Banked pots add +0.25x.',
    up: '12% per cushion, 6 times each, +0.4x per banked pot.',
    cushion(G, S, ball) {
      const u = up(G, 'hot_rail');
      if ((ball.hotRail || 0) >= (u ? 6 : 4)) return;
      ball.hotRail = (ball.hotRail || 0) + 1;
      ball.vx *= u ? 1.12 : 1.08; ball.vz *= u ? 1.12 : 1.08;
    },
    shotStart(G) { for (const b of G.physics.balls) b.hotRail = 0; },
    shotEnd(G, S) { const n = S.pots.filter(p => p.bank && p.counted).length; if (n) S.mult += n * (up(G, 'hot_rail') ? 0.4 : 0.25); },
  },
  // ----------------------------------------------------------- CURSED
  {
    id: 'demon_chalk', name: 'DEMON CHALK', rarity: 'cursed', tags: ['CURSED', 'CHAOS'],
    desc: '+100% shot strength (+20% per HEAT). BUT every shot is slightly off-aim.',
    shotStart(G, S) { S.speed *= 1 + (1.0 + 0.2 * heat(G)) * curse(G); S.angle += (Math.random() - 0.5) * 0.085; },
  },
  {
    id: 'blood_pact', name: 'BLOOD PACT', rarity: 'cursed', tags: ['CURSED'],
    desc: 'x2 score (+0.5x per HEAT) and +50% chips. BUT -1 shot every table.',
    extraShots: -1,
    shotEnd(G, S) { S.multX *= (2 + 0.5 * heat(G)) * curse(G); S.chips = Math.ceil(S.chips * 1.5); },
  },
  {
    id: 'cursed_felt', name: 'CURSED FELT', rarity: 'cursed', tags: ['CURSED'],
    desc: 'Pockets 60% bigger (+10% per HEAT). BUT the felt is sticky as tar.',
    mods(G, P) { P.muRoll *= 2.1; },
    pockets(G, pk) { for (const p of pk) p.scale *= 1 + (0.6 + 0.1 * heat(G)) * curse(G); },
  },
  {
    id: 'hungry_pockets', name: 'HUNGRY POCKETS', rarity: 'cursed', tags: ['CURSED', 'COMBO'],
    desc: 'Every pocket pulls (harder with HEAT) — the cue ball too. A scratch starts a FEEDING FRENZY: next shot scores x3.',
    pockets(G, pk) { for (const p of pk) p.pull += (1.1 + 0.15 * heat(G)) * curse(G); },
    scratch(G) { G.run.frenzy = true; G.popText('FEEDING FRENZY', '#ff3040', 1.2); },
    shotEnd(G, S) { if (G.run.frenzy && !S.scratch) { G.run.frenzy = false; if (S.pots.length) { S.multX *= 3; S.lines.push(['FRENZY', 500]); } } },
  },
  {
    id: 'glass_cannon', name: 'GLASS CANNON', rarity: 'cursed', tags: ['CURSED'],
    desc: 'Pots score x3 (+0.5x per HEAT) and pay double chips. BUT a scratch costs a HEART.',
    shotEnd(G, S) { if (S.pots.length) { S.multX *= (3 + 0.5 * heat(G)) * curse(G); S.chips *= 2; } },
    scratch(G, S) { if (!S.insured) G.loseHeart('GLASS CANNON'); },
  },
  {
    id: 'loaded_dice', name: 'LOADED DICE', rarity: 'cursed', tags: ['CURSED', 'GREED'],
    desc: 'Every table offers a Double-or-Nothing bet, and winning one pays TRIPLE. BUT a lost bet also costs 5 chips.',
  },
  // -------------------------------------------------------- LEGENDARY
  {
    id: 'nitro', name: 'NITRO', rarity: 'legendary', tags: ['CHAOS'],
    desc: 'Every hard collision explodes (4 per shot; 7 with EXPLOSIVE CHALK).',
    up: '6 explosions per shot (10 with EXPLOSIVE CHALK).',
    ballHit(G, S, a, b, v) {
      const u = up(G, 'nitro');
      const cap = (has(G, 'explosive_chalk') ? 7 : 4) + (u ? 3 : 0);
      if (v > 1.7 && (S.nitro || 0) < cap) {
        S.nitro = (S.nitro || 0) + 1;
        if (S.nitro === 5) G.synergy('nitro', 'explosive_chalk', 'CHAIN REACTION');
        G.explode((a.x + b.x) / 2, (a.z + b.z) / 2, 0.18, 1.2, null);
      }
    },
  },
  {
    id: 'midas', name: 'MIDAS TOUCH', rarity: 'legendary', tags: ['GREED'],
    desc: 'Every 4th pot is gold (+5 chips, +1x). A golden ball in the shot DOUBLES every relic bonus.',
    pot(G, S) {
      G.run.midas = (G.run.midas || 0) + 1;
      if (G.run.midas % 4 === 0) { S.chips += 5; S.mult += 1; G.popText('MIDAS!', '#ffe23b', 1.3); }
    },
    shotEnd(G, S) {
      if (!S.golds || !S.lines.length) return;
      S.lines = S.lines.map(([k, v]) => [k, v > 0 ? v * 2 : v]);
      G.synergy('midas', null, 'GOLDEN RELICS x2');
    },
    encounterStart(G) { G.later(1.0, () => G.spawnGolden()); },
  },
  {
    id: 'multiball', name: 'MULTIBALL', rarity: 'legendary', tags: ['COMBO', 'CHAOS'],
    desc: 'Three extra balls rain down every table, and +1 shot. Any 3-ball pot rains a bonus ball.',
    extraShots: 1,
    encounterStart(G) { for (let i = 0; i < 3; i++) G.later(0.8 + i * 0.25, () => G.spawnDropBall(9 + Math.floor(Math.random() * 7), 'object')); },
    shotEnd(G, S) { if (S.pots.filter(p => !p.house && p.ball.kind !== 'cue').length >= 3) { G.later(0.5, () => G.spawnDropBall(20, 'bonus')); G.popText('BONUS BALL!', '#ff2bd6'); } },
  },
  {
    id: 'rewind', name: 'REWIND', rarity: 'legendary', tags: ['CONTROL'],
    desc: 'Once per table, a shot that pots nothing is undone and refunded.',
    up: 'Twice per table.',
    encounterStart(G) { G.enc.rewinds = (G.enc.rewinds || 0) + (up(G, 'rewind') ? 2 : 1); },
  },
  {
    id: 'ricochet', name: 'RICOCHET', rarity: 'legendary', tags: ['BANK'],
    desc: 'The cue ball gains speed off cushions (+100 a hit). KICK SHOTS score x2.',
    up: 'More speed per cushion. KICK SHOTS score x3.',
    cushion(G, S, ball, v) {
      if (ball.kind === 'cue' && v > 0.3 && (S.ricochet || 0) < 8) {
        S.ricochet = (S.ricochet || 0) + 1;
        const k = up(G, 'ricochet') ? 1.2 : 1.12;
        ball.vx *= k; ball.vz *= k;
        S.lines.push(['RICOCHET', 100]);
      }
    },
    shotEnd(G, S) { if (S.cueCushionFirst > 0 && S.firstHit && S.pots.length) { S.multX *= up(G, 'ricochet') ? 3 : 2; G.synergy('ricochet', null, 'KICK SHOT BONUS'); } },
  },
  {
    id: 'final_destination', name: 'FINAL DESTINATION', rarity: 'legendary', tags: ['COMBO'],
    desc: 'The shot that clears the table scores x5 (+1x per HEAT).',
    up: 'x8 (+1x per HEAT).',
    shotEnd(G, S) {
      const e = G.enc;
      if (!e) return;
      const delta = e.def.progress ? e.def.progress(G, S, e) : S.counted;
      if (e.progress + delta < e.goal) return;
      S.multX *= (up(G, 'final_destination') ? 8 : 5) + heat(G);
      S.lines.push(['FINAL DESTINATION', 1000]);
      G.synergy('final_destination', null, 'FINAL DESTINATION');
    },
  },
  {
    id: 'black_label', name: 'BLACK LABEL', rarity: 'legendary', tags: ['CURSED'],
    desc: 'Cursed relics are 50% stronger (the good part), and turn up twice as often.',
  },
  // ------------------------------------------------------------- RISK
  // Cursed relics with a bigger upside and a sharper edge (AFTERHOURS).
  {
    id: 'double_edge', name: 'DOUBLE EDGE', rarity: 'cursed', risk: true, tags: ['CURSED', 'CONTROL'],
    desc: 'Every pot scores x2. BUT every pocket is 12% smaller.',
    pockets(G, pk) { for (const p of pk) p.scale *= 0.88; },
    shotEnd(G, S) { if (S.pots.some(p => !p.house && p.counted)) S.multX *= 2 * (curse(G) > 1 ? 1.25 : 1); },
  },
  {
    id: 'debt', name: 'DEBT', rarity: 'cursed', risk: true, tags: ['CURSED', 'GREED'],
    desc: '+35 chips the moment you take it. BUT the next two shops charge double.',
    gain(G) { G.addChips(35); G.run.debtShops = (G.run.debtShops || 0) + 2; G.popText('+35 CHIPS  ON CREDIT', '#ffc21c', 1.2); },
  },
  {
    id: 'blind_faith', name: 'BLIND FAITH', rarity: 'cursed', risk: true, tags: ['CURSED', 'CONTROL'],
    desc: 'The aim guide is gone for good. Every shot scores x1.4 and STYLE climbs 50% faster.',
    blind: true,
    shotEnd(G, S) { if (S.pots.length) S.multX *= 1.4 * (curse(G) > 1 ? 1.2 : 1); },
  },
  {
    id: 'final_form', name: 'FINAL FORM', rarity: 'cursed', risk: true, tags: ['CURSED', 'COMBO'],
    desc: 'Score x(1 + 0.4 per HEAT). BUT a shot that pots nothing cools the HEAT.',
    shotEnd(G, S) {
      if (S.pots.some(p => !p.house && p.ball.kind !== 'cue')) S.multX *= (1 + 0.4 * heat(G)) * curse(G);
      else if (heat(G) > 0) G.later(0.2, () => G.coolHeat(0.82));
    },
  },
  {
    id: 'last_life', name: 'LAST LIFE', rarity: 'cursed', risk: true, tags: ['CURSED'],
    desc: 'On your last heart every pot scores x3 and pays double chips. BUT it costs a max heart to take.',
    gain(G) { G.run.maxHearts = Math.max(1, G.run.maxHearts - 1); G.run.hearts = Math.min(G.run.hearts, G.run.maxHearts); },
    shotEnd(G, S) { if (G.run.hearts === 1 && S.pots.length) { S.multX *= 3 * curse(G); S.chips *= 2; S.lines.push(['LAST LIFE', 500]); } },
  },
];

// ------------------------------------------------------------ PROTOCOLS
// A second relic set that only exists somewhere else. Same hooks, same slots.
export const PROTOCOLS = [
  {
    id: 'p_missile', name: 'MISSILE STRIKE', rarity: 'rare', rajis: true, tags: ['CHAOS'],
    desc: 'Every third shot, the first target you hit takes a missile.',
    shotStart(G, S) { G.run.pMissile = (G.run.pMissile || 0) + 1; S.pMissile = G.run.pMissile % 3 === 0; },
    firstHit(G, S, ball) { if (S.pMissile) { G.explode(ball.x, ball.z, 0.27, 1.9, ball); G.popText('MISSILE STRIKE', '#ff3b30', 1.2); } },
  },
  {
    id: 'p_radar', name: 'RADAR SWEEP', rarity: 'common', rajis: true, tags: ['CONTROL'],
    desc: 'Long aim hints and the first rebound. PERFECT POSITION pays double.',
    laser: true,
    shotStart(G, S) { S.posX = Math.max(S.posX || 1, 2); },
  },
  {
    id: 'p_supply', name: 'SUPPLY DROP', rarity: 'common', rajis: true, tags: ['GREED'],
    desc: '+1 round every mission, and a supply crate drops onto the table. Sink it for +2 credits.',
    extraShots: 1,
    encounterStart(G) { G.later(0.9, () => G.spawnDropBall(20, 'bonus')); },
  },
  {
    id: 'p_armor', name: 'ARMOR PLATING', rarity: 'common', rajis: true, tags: ['CONTROL'],
    desc: 'The first friendly fire each mission is free. Your cue ball is 30% heavier.',
    encounterStart(G) { const c = G.physics.cue; if (c) c.m = 1.3; },
    scratch(G, S) { if (!G.enc || G.enc.armorUsed) return; G.enc.armorUsed = true; S.insured = true; G.popText('ARMOR HOLDS', '#8fd14f', 1.2); },
  },
  {
    id: 'p_drone', name: 'DRONE SUPPORT', rarity: 'rare', rajis: true, tags: ['COMBO'],
    desc: 'Every target you destroy sends a drone to nudge the nearest target toward its nearest drop zone.',
    pot(G, S, pot) {
      if (!pot.counted || (S.drones || 0) >= 3) return;
      S.drones = (S.drones || 0) + 1;
      G.later(0.15, () => G.droneNudge?.(pot.pocket));
    },
  },
  {
    id: 'p_overwatch', name: 'OVERWATCH', rarity: 'common', rajis: true, tags: ['CONTROL'],
    desc: 'Long-range kills (over 1.2 m) score x2 and pay +2 credits.',
    pot(G, S, pot) { if (pot.counted && pot.ball.travel >= 1.2) { S.chips += 2; S.overwatch = true; } },
    shotEnd(G, S) { if (S.overwatch) S.multX *= 2; },
  },
  {
    id: 'p_chain', name: 'CHAIN OF COMMAND', rarity: 'rare', rajis: true, tags: ['COMBO'],
    desc: 'Every consecutive successful shot adds +0.5x (max +4x).',
    shotEnd(G, S) { if (S.pots.length && G.run.streak > 0) S.mult += Math.min(4, 0.5 * G.run.streak); },
  },
  {
    id: 'p_counter', name: 'COUNTERMEASURES', rarity: 'rare', rajis: true, tags: ['CONTROL'],
    desc: 'Enemy missiles, shoves and shells hit 60% softer. Armor cracks from any hit.',
    counter: true,
  },
  {
    id: 'p_shock', name: 'SHOCK AND AWE', rarity: 'legendary', rajis: true, tags: ['CHAOS'],
    desc: 'The first shot of every mission detonates every hard collision.',
    ballHit(G, S, a, b, v) {
      const e = G.enc;
      if (!e || e.shotsTaken > 1 || v < 1.2 || (S.awe || 0) >= 8) return;
      S.awe = (S.awe || 0) + 1;
      G.explode((a.x + b.x) / 2, (a.z + b.z) / 2, 0.16, 1.1, null);
    },
  },
  {
    id: 'p_repair', name: 'EMERGENCY REPAIRS', rarity: 'common', rajis: true, tags: ['CONTROL'],
    desc: '+1 max hull now. Every boss you beat repairs 1 hull.',
    gain(G) { G.run.maxHearts++; G.heal(1); },
    bossWin(G) { G.heal(1); G.popText('REPAIRS', '#8fd14f'); },
  },
  {
    id: 'p_intel', name: 'FIELD INTEL', rarity: 'common', rajis: true, tags: ['GREED'],
    desc: '+3 credits per mission. The enemy\'s next move is shown on your HUD.',
    intel: true,
    encounterStart(G) { G.later(0.5, () => G.addChips(3)); },
  },
  {
    id: 'p_omega', name: 'PROTOCOL OMEGA', rarity: 'legendary', rajis: true, risk: true, tags: ['CURSED'],
    desc: 'Everything scores x2.5. BUT friendly fire costs a hull.',
    shotEnd(G, S) { if (S.pots.length) S.multX *= 2.5; },
    scratch(G, S) { if (!S.insured) G.loseHeart('PROTOCOL OMEGA'); },
  },
];

export const relicById = (id) => RELICS.find(r => r.id === id) || PROTOCOLS.find(r => r.id === id);

// what the club is willing to offer this save (risk relics wait for the first win)
let gate = () => true;
export function setRelicGate(fn) { gate = fn || (() => true); }

// options: rarityBoost, forceRarity, exclude, upgraded (run.relicLv: owned relics
// that can still be upgraded may be offered again), cursedX, noCursed,
// pool ('club' or 'rajis': which relic set to draw from)
export function rollRelics(n, owned, { rarityBoost = 0, forceRarity = null, exclude = [], upgraded = null, cursedX = 1, noCursed = false, pool: set = 'club' } = {}) {
  const have = new Set(owned.map(r => r.id));
  const canUp = (r) => upgraded && r.up && have.has(r.id) && !((upgraded[r.id] || 1) >= 2);
  const src = set === 'rajis' ? PROTOCOLS : RELICS.filter(r => gate(r));
  const pool = src.filter(r => (r.stack || !have.has(r.id) || canUp(r)) && !exclude.includes(r.id) && !(noCursed && r.rarity === 'cursed'));
  const out = [];
  for (let k = 0; k < n && pool.length; k++) {
    let cand = pool.filter(r => !out.includes(r));
    if (!cand.length) break;
    if (forceRarity) {
      const f = cand.filter(r => r.rarity === forceRarity);
      if (f.length) cand = f;
    }
    const w = cand.map(r => {
      let base = RARITY[r.rarity].weight;
      if (r.rarity === 'rare') base *= 1 + rarityBoost;
      if (r.rarity === 'legendary') base *= 1 + rarityBoost * 3;
      if (r.rarity === 'cursed') base *= (1 + rarityBoost) * cursedX;
      if (canUp(r)) base *= 0.5;                      // upgrades show up now and then
      return base;
    });
    const tot = w.reduce((a, b) => a + b, 0);
    let x = rand() * tot;
    let pick = cand[0];
    for (let i = 0; i < cand.length; i++) { x -= w[i]; if (x <= 0) { pick = cand[i]; break; } }
    out.push(pick);
  }
  return out;
}

// Consumable one-shot items sold in shops.
export const ITEMS = [
  { id: 'extra_shot', name: 'EXTRA SHOT', desc: '+1 shot on the current table.', price: 4 },
  { id: 'big_pockets', name: 'GIANT POCKETS', desc: 'Pockets are enormous for your next shot.', price: 5 },
  { id: 'nuke', name: 'NUKE CHALK', desc: 'Your next shot\'s first hit detonates. Big.', price: 6 },
  { id: 'guide', name: 'GUIDE LINE', desc: 'A long aim guide for your next shot.', price: 3 },
  { id: 'rerack', name: 'RE-RACK', desc: 'Re-spot all remaining balls in a tight cluster.', price: 4 },
];
export const itemById = (id) => ITEMS.find(i => i.id === id);
