// RANDOM EVENTS — tiny text choices between tables. act() returns the
// outcome text shown afterwards.

import { rollRelics, ITEMS } from './relics.js';
import { rand } from './rng.js';

const coin = () => rand() < 0.5;

export const EVENTS = [
  {
    id: 'chalk_man', title: 'A MAN OFFERS YOU SOME CHALK.',
    text: 'His hands are blue to the elbow. He does not blink.',
    choices: [
      { label: 'TAKE IT', act(G) {
        if (rand() < 0.55) { const r = rollRelics(1, G.run.relics, { rarityBoost: 0.5 })[0]; if (r) { G.gainRelic(r); return `IT'S GOOD CHALK. YOU GAIN ${r.name}.`; } }
        const c = rollRelics(1, G.run.relics, { forceRarity: 'cursed' })[0];
        if (c) { G.gainRelic(c); return `IT BURNS. YOU GAIN ${c.name}.`; }
        G.addChips(5); return 'IT WAS JUST CHALK. YOU FIND 5 CHIPS IN THE BOX.';
      } },
      { label: 'IGNORE HIM', act() { return 'HE KEEPS STARING AS YOU WALK AWAY.'; } },
    ],
  },
  {
    id: 'machine', title: 'THE MACHINE WANTS 30 CHIPS.',
    text: 'A cabinet with no screen. A slot that breathes warm air.',
    choices: [
      { label: 'PAY 30', can: G => G.run.chips >= 30, act(G) {
        G.addChips(-30);
        const r = rand();
        if (r < 0.45) { const x = rollRelics(1, G.run.relics, { forceRarity: 'legendary' })[0]; if (x) { G.gainRelic(x); return `IT DISPENSES ${x.name}. STILL WARM.`; } }
        if (r < 0.8) { const x = rollRelics(1, G.run.relics, { forceRarity: 'rare' })[0]; if (x) { G.gainRelic(x); return `IT DISPENSES ${x.name}.`; } }
        return 'IT HUMS APPRECIATIVELY. NOTHING ELSE HAPPENS.';
      } },
      { label: 'LEAVE', act() { return 'THE HUM FOLLOWS YOU DOWN THE HALL.'; } },
    ],
  },
  {
    id: 'vending', title: 'THE VENDING MACHINE IS GLOWING.',
    text: 'One can inside is spinning slowly by itself.',
    choices: [
      { label: 'KICK IT', act(G) {
        if (rand() < 0.6) { G.addChips(18); return 'A CASCADE OF CHIPS. +18.'; }
        G.loseHeart('VENDING MACHINE'); return 'IT FALLS ON YOU. -1 HEART.';
      } },
      { label: 'BUY A DRINK (8)', can: G => G.run.chips >= 8, act(G) { G.addChips(-8); G.heal(1); return 'TASTES LIKE BATTERIES. +1 HEART.'; } },
      { label: 'WALK AWAY', act() { return 'THE CAN STOPS SPINNING WHEN YOU LEAVE.'; } },
    ],
  },
  {
    id: 'hustler', title: 'A HUSTLER WANTS TO GO DOUBLE OR NOTHING.',
    text: '"Coin flip. Half your chips. Easy money, friend."',
    choices: [
      { label: 'FLIP', can: G => G.run.chips >= 4, act(G) {
        const bet = Math.floor(G.run.chips / 2);
        if (coin()) { G.addChips(bet); return `HEADS. YOU WIN ${bet} CHIPS.`; }
        G.addChips(-bet); return `TAILS. HE TAKES ${bet} CHIPS AND VANISHES.`;
      } },
      { label: 'NO THANKS', act() { return '"YOUR LOSS," HE SAYS, TO NO ONE.'; } },
    ],
  },
  {
    id: 'tv', title: 'A TV IS PLAYING A MATCH FROM 1987.',
    text: 'The player on screen looks exactly like you.',
    choices: [
      { label: 'WATCH', act(G) { const r = rollRelics(1, G.run.relics, { forceRarity: 'common' })[0]; if (r) { G.gainRelic(r); return `YOU LEARN SOMETHING. YOU GAIN ${r.name}.`; } G.addChips(6); return 'YOU LEARN NOTHING. +6 CHIPS FOR YOUR TIME.'; } },
      { label: 'UNPLUG IT', act(G) { G.addChips(8); return 'THERE WERE 8 CHIPS BEHIND THE SET.'; } },
    ],
  },
  {
    id: 'hooded', title: 'A HOODED FIGURE WANTS TO TRADE.',
    text: '"Give me one of yours. I\'ll give you something... better."',
    choices: [
      { label: 'TRADE A RELIC', can: G => G.run.relics.length > 0, act(G) {
        const give = G.run.relics[Math.floor(rand() * G.run.relics.length)];
        G.loseRelic(give);
        const up = give.rarity === 'common' ? 'rare' : 'legendary';
        const r = rollRelics(1, G.run.relics, { forceRarity: up, exclude: [give.id] })[0];
        if (r) { G.gainRelic(r); return `YOU GIVE ${give.name}. YOU GET ${r.name}.`; }
        return `YOU GIVE ${give.name}. THE FIGURE IS GONE.`;
      } },
      { label: 'DECLINE', act() { return 'IT BOWS, SLIGHTLY TOO LOW.'; } },
    ],
  },
  {
    id: 'jukebox', title: 'THE JUKEBOX TAKES REQUESTS.',
    text: 'Three buttons. Two of them are labelled.',
    choices: [
      { label: 'JUNGLE', act(G) { G.run.nextShotBonus = (G.run.nextShotBonus || 0) + 2; return 'THE BASS RATTLES YOUR TEETH. +2 SHOTS NEXT TABLE.'; } },
      { label: 'LOUNGE', act(G) { G.heal(1); return 'SMOOTH. YOU FEEL BETTER. +1 HEART.'; } },
      { label: '???', act(G) {
        const c = rollRelics(1, G.run.relics, { forceRarity: 'cursed' })[0];
        if (c) { G.gainRelic(c); G.addChips(15); return `A SONG NOBODY SHOULD HEAR. +15 CHIPS AND ${c.name}.`; }
        G.addChips(15); return 'SILENCE. THEN 15 CHIPS.';
      } },
    ],
  },
  {
    id: 'mirror', title: 'THE BATHROOM MIRROR SHOWS A DIFFERENT ROOM.',
    text: 'In it, you are winning.',
    choices: [
      { label: 'WASH YOUR HANDS', can: G => G.run.relics.some(r => r.rarity === 'cursed'), sub: 'REMOVE A CURSE', act(G) {
        const c = G.run.relics.find(r => r.rarity === 'cursed');
        G.loseRelic(c); return `THE WATER RUNS BLACK. ${c.name} IS GONE.`;
      } },
      { label: 'TOUCH THE GLASS', act(G) {
        if (coin()) { G.run.maxHearts++; G.heal(1); return 'IT\'S WARM. +1 MAX HEART.'; }
        G.addChips(-Math.min(G.run.chips, 10)); return 'IT BITES. YOU LOSE UP TO 10 CHIPS.';
      } },
      { label: 'LEAVE', act() { return 'YOUR REFLECTION STAYS BEHIND.'; } },
    ],
  },
  {
    id: 'cat', title: 'A CAT IS SLEEPING ON THE TABLE.',
    text: 'It is curled up exactly over the side pocket.',
    choices: [
      { label: 'PET IT', act(G) {
        if (rand() < 0.7) { G.heal(1); G.addChips(4); return 'IT PURRS. +1 HEART, +4 CHIPS.'; }
        G.loseHeart('CAT'); return 'IT WAS NOT A CAT. -1 HEART.';
      } },
      { label: 'SHOO IT', act(G) { G.addChips(3); return 'IT GLARES AT YOU. +3 CHIPS UNDER WHERE IT SLEPT.'; } },
    ],
  },
  {
    id: 'tournament', title: 'A SIGN-UP SHEET FOR A SIDE BET.',
    text: '"Pot the 8 on your next table and we pay 25."',
    choices: [
      { label: 'SIGN (5 CHIPS)', can: G => G.run.chips >= 5, act(G) { G.addChips(-5); G.run.eightBet = true; return 'YOUR NAME IS ALREADY ON THE LIST.'; } },
      { label: 'PASS', act() { return 'THE PEN FOLLOWS YOU WITH ITS EYES.'; } },
    ],
  },
];

EVENTS.push(
  {
    id: 'lights_out', title: 'THE LIGHTS GO OUT.',
    text: 'Somewhere a breaker trips. The felt glows faintly in the dark. Nobody moves.',
    choices: [
      { label: 'KEEP PLAYING', sub: '+12 CHIPS · NEXT TABLE IS DARK', act(G) { G.addChips(12); G.run.nextDark = true; return 'YOU PLAY BY FEEL. SOMEONE PRESSES CHIPS INTO YOUR HAND.'; } },
      { label: 'WAIT', act(G) { G.heal(1); return 'THEY COME BACK ON. YOU FEEL RESTED. +1 HEART.'; } },
    ],
  },
  {
    id: 'cue_left', title: 'SOMEONE LEFT A CUE BEHIND.',
    text: 'Beautiful inlay. Still warm. There is a name on it, scratched out.',
    choices: [
      { label: 'TAKE IT', act(G) {
        const cursed = rand() < 0.35;
        const r = rollRelics(1, G.run.relics, cursed ? { forceRarity: 'cursed' } : { forceRarity: 'rare' })[0];
        if (r) { G.gainRelic(r); return cursed ? `IT WAS NEVER YOURS. YOU GAIN ${r.name}.` : `IT FEELS RIGHT IN YOUR HANDS. YOU GAIN ${r.name}.`; }
        G.addChips(10); return 'YOU PAWN IT. +10 CHIPS.';
      } },
      { label: 'LEAVE IT', act(G) { G.run.maxHearts++; G.heal(1); return 'GOOD KARMA. +1 MAX HEART.'; } },
    ],
  },
  {
    id: 'all_in', title: 'DOUBLE OR NOTHING?',
    text: 'A dealer in a green visor slides a tray toward you. "Everything you have. On your next table."',
    choices: [
      { label: 'ALL IN', sub: 'CLEAR THE NEXT TABLE: DOUBLE · LOSE IT: NOTHING', can: G => G.run.chips >= 6, act(G) { G.run.allIn = G.run.chips; G.addChips(-G.run.chips); return 'THE TRAY CLOSES. THE DEALER SMILES.'; } },
      { label: 'WALK AWAY', act() { return '"SUIT YOURSELF."'; } },
    ],
  },
  {
    id: 'whisper', title: 'THE 8-BALL WHISPERS SOMETHING.',
    text: 'It is sitting alone on an empty table. You are fairly sure it said your name.',
    choices: [
      { label: 'LISTEN', act(G) {
        const r = rand();
        if (r < 0.4) { G.run.nextBoost = (G.run.nextBoost || 0) + 2; return 'IT TELLS YOU WHERE THE GOOD STUFF IS. YOUR NEXT RELIC CHOICE IS BETTER.'; }
        if (r < 0.7) { G.run.maxHearts++; G.heal(1); return 'IT TELLS YOU TO BREATHE. +1 MAX HEART.'; }
        const c = rollRelics(1, G.run.relics, { forceRarity: 'cursed' })[0];
        if (c) { G.gainRelic(c); return `IT TELLS YOU A SECRET YOU CAN'T FORGET. YOU GAIN ${c.name}.`; }
        return 'IT SAYS NOTHING ELSE. EVER.';
      } },
      { label: 'IGNORE IT', act() { return 'IT STOPS. YOU ARE NOT SURE IT EVER STARTED.'; } },
    ],
  },
  {
    id: 'janitor', title: 'THE JANITOR HAS BEEN MOPPING THE SAME SPOT SINCE 1998.',
    text: '"Every night," he says. "Every night somebody scratches right here."',
    choices: [
      { label: 'TALK TO HIM', can: G => G.run.items.length < 3, sub: 'ITEM SLOTS NEEDED', act(G) {
        const it = ITEMS[Math.floor(rand() * ITEMS.length)];
        G.run.items.push(it); return `HE HANDS YOU SOMETHING FROM HIS POCKET: ${it.name}.`;
      } },
      { label: 'HELP HIM MOP', act(G) { G.heal(2); return 'IT IS STRANGELY CALMING. +2 HEARTS.'; } },
    ],
  },
  {
    id: 'fortune', title: 'A FORTUNE COOKIE ON THE RAIL.',
    text: 'Nobody ordered food. The cookie is warm.',
    choices: [
      { label: 'OPEN IT', act(G) {
        const r = rand();
        const upg = G.run.relics.filter(x => x.up && !G.relicUpgraded(x.id));
        if (r < 0.25 && upg.length) { const x = upg[Math.floor(rand() * upg.length)]; G.upgradeRelic(x); return `"YOUR ${x.name} WILL IMPROVE." IT DOES.`; }
        if (r < 0.5) { G.run.nextShotBonus = (G.run.nextShotBonus || 0) + 2; return '"PATIENCE IS A SHOT." +2 SHOTS NEXT TABLE.'; }
        if (r < 0.75) { G.addChips(9); return '"MONEY FINDS THE CAREFUL." +9 CHIPS.'; }
        return '"YOU WILL SINK THE 8 TOO EARLY." NOTHING HAPPENS. YET.';
      } },
      { label: 'EAT IT WHOLE', act(G) { G.heal(1); return 'PAPER AND ALL. +1 HEART.'; } },
    ],
  },
  {
    id: 'arcade_cab', title: 'A BROKEN ARCADE CABINET STILL TAKES CHIPS.',
    text: 'The screen shows a pool table. The balls are moving on their own.',
    choices: [
      { label: 'PLAY (5 CHIPS)', can: G => G.run.chips >= 5, act(G) {
        G.addChips(-5);
        const r = rand();
        if (r < 0.4) { G.addChips(20); return 'HIGH SCORE. IT PAYS OUT 20 CHIPS.'; }
        if (r < 0.6) { const x = rollRelics(1, G.run.relics, { forceRarity: 'rare' })[0]; if (x) { G.gainRelic(x); return `A PRIZE FALLS OUT: ${x.name}.`; } }
        return 'GAME OVER. IT KEEPS YOUR CHIPS.';
      } },
      { label: 'SMASH IT', act(G) {
        G.addChips(12);
        if (rand() < 0.5) { const c = rollRelics(1, G.run.relics, { forceRarity: 'cursed' })[0]; if (c) { G.gainRelic(c); return `+12 CHIPS. SOMETHING WAS SEALED INSIDE: ${c.name}.`; } }
        return '+12 CHIPS FROM THE COIN BOX. NOBODY SAW.';
      } },
    ],
  },
  {
    id: 'rival', title: 'A KID IN A VARSITY JACKET CHALLENGES YOU.',
    text: '"Next table. One more ball than you\'re used to. Scared?"',
    choices: [
      { label: 'ACCEPT', sub: 'NEXT TABLE +1 BALL · BIGGER PURSE · BETTER RELIC', act(G) { G.run.nextHarder = true; return '"YOU\'RE ON." HE CRACKS HIS KNUCKLES.'; } },
      { label: 'DECLINE', act() { return 'HE CALLS YOU CHICKEN. YOU DON\'T CARE.'; } },
    ],
  },
  {
    id: 'no_doors', title: 'THE ROOM WITH NO DOORS.', rare: true,
    text: 'You are not sure how you got in. The table in here has no pockets. Somebody has been playing anyway.',
    choices: [
      { label: 'SIT DOWN', act(G) { G.run.maxHearts++; G.heal(9); G.addChips(13); return 'TIME PASSES. WHEN YOU LEAVE IT IS LATER THAN IT SHOULD BE. YOU FEEL WHOLE.'; } },
      { label: 'RACK THEM', act(G) { const r = rollRelics(1, G.run.relics, { forceRarity: 'legendary' })[0]; if (r) { G.gainRelic(r); return `THE BALLS ARRANGE THEMSELVES. ONE OF THEM IS ${r.name}.`; } return 'THE BALLS WILL NOT BE RACKED.'; } },
    ],
  },
);

// ------------------------------------------------------------- AFTERHOURS
// when(run, meta): only offered if true. after: only after closing time.
const OVERCHARGEABLE = ['explosive_chalk', 'magnet_pocket', 'thunder_cue', 'heavy_cue', 'bucket_pockets', 'hot_streak', 'trickster', 'piggy_bank', 'nitro', 'moon_gravity', 'deadeye', 'ricochet'];
EVENTS.push(
  {
    id: 'someone_at_table', title: 'SOMEONE IS ALREADY AT YOUR TABLE.', when: (run, meta) => meta?.unlocked('rivals') || run.mode === 'daily',
    text: 'They are chalking a cue that is not theirs. They do not look up. "Next one\'s mine," they say. "Unless you want it."',
    choices: [
      { label: 'CHALLENGE THEM', sub: 'THE NEXT TABLE OFFERS A RIVAL', act(G) { G.run.nextRival = true; return 'THEY SMILE WITHOUT LOOKING AT YOU. "RACK THEM."'; } },
      { label: 'LET THEM PLAY', act(G) { G.addChips(6); return 'THEY LEAVE A TIP ON THE RAIL WHEN THEY GO. +6 CHIPS.'; } },
    ],
  },
  {
    id: 'warm_eight', title: 'THE 8-BALL IS WARM.',
    text: 'Warm like it has been held for a long time. Somebody has scratched a date into it: 03/77.',
    choices: [
      { label: 'POCKET IT', sub: 'THE NEXT TABLE PAYS 25 FOR AN 8-BALL FINISH', act(G) { G.run.eightBet = true; return 'IT IS HEAVIER THAN IT SHOULD BE.'; } },
      { label: 'PUT IT BACK', act(G) { G.heal(1); return 'THE ROOM FEELS A DEGREE COOLER. +1 HEART.'; } },
    ],
  },
  {
    id: 'golden_cue_man', title: 'A MAN WITH A GOLDEN CUE.',
    text: '"I beat The House once," he says. "The club stays open for people who run hot. Remember that." He has a cue for sale.',
    choices: [
      { label: 'BUY THE CUE (20)', can: G => G.run.chips >= 20, act(G) {
        G.addChips(-20);
        const r = rollRelics(1, G.run.relics, { forceRarity: 'legendary' })[0];
        if (r) { G.gainRelic(r); return `IT IS NOT A CUE. IT IS ${r.name}.`; }
        G.addChips(20); return 'HE CHANGES HIS MIND AND GIVES YOUR CHIPS BACK.';
      } },
      { label: 'ASK HIM WHAT HAPPENED', act(G) { G.addChips(4); return '"THE LIGHTS WENT OUT," HE SAYS. "THEN I MET THE OWNER." HE LEAVES 4 CHIPS AND DOES NOT SAY ANYTHING ELSE.'; } },
    ],
  },
  {
    id: 'table_six', title: 'THE LIGHT OVER TABLE 6 IS ON.', when: (run) => run.floor >= 2,
    text: 'Nobody is playing. The balls are racked. The rack is still swinging slightly on its hook.',
    choices: [
      { label: 'PLAY A FRAME', sub: 'YOUR NEXT RELIC CHOICE IS BETTER', act(G) { G.run.nextBoost = (G.run.nextBoost || 0) + 2; return 'YOU BREAK. EVERY BALL GOES DOWN. YOU DID NOT TOUCH THE CUE.'; } },
      { label: 'TURN THE LIGHT OFF', act(G) { G.heal(1); return 'IT COMES BACK ON AS SOON AS YOU TURN AROUND. +1 HEART ANYWAY.'; } },
    ],
  },
  {
    id: 'closed_room', title: 'BALLS ARE COLLIDING IN THE CLOSED ROOM.', when: (run) => run.floor >= 2,
    text: 'The door says STAFF ONLY. Clack. Clack. A long pause. Clack.',
    choices: [
      { label: 'LISTEN AT THE DOOR', act(G) { G.run.saw0377 = G.run.saw0377 || G.run.heatMax >= 2; G.addChips(5); return 'SOMEBODY IN THERE SAYS "NOT YET." YOU FIND 5 CHIPS UNDER THE DOOR.'; } },
      { label: 'KNOCK', act(G) {
        const c = rollRelics(1, G.run.relics, { forceRarity: 'cursed' })[0];
        if (c) { G.gainRelic(c); return `THE CLACKING STOPS. SOMETHING SLIDES UNDER THE DOOR: ${c.name}.`; }
        return 'THE CLACKING STOPS. IT DOES NOT START AGAIN.';
      } },
    ],
  },
  {
    id: 'clock_0377', title: 'THE CLOCK ON THE WALL SAYS 03:77.', rare: true, when: (run) => run.floor >= 2,
    text: 'You check again. 03:77. The second hand is going the wrong way.',
    choices: [
      { label: 'WAIT FOR IT', act(G) { G.run.saw0377 = true; G.achieve('insomniac'); return 'IT NEVER BECOMES 03:78. SOMEWHERE, A DOOR IS UNLOCKED.'; } },
      { label: 'LOOK AWAY', act(G) { G.addChips(5); return 'WHEN YOU LOOK BACK IT IS A NORMAL CLOCK. +5 CHIPS ON THE FLOOR BELOW IT.'; } },
    ],
  },
  {
    id: 'wiring', title: 'THE WIRING IN THE WALL IS HUMMING.', rare: true,
    when: (run) => run.floor >= 2 && run.relics.some(r => OVERCHARGEABLE.includes(r.id)) && !run.over,
    text: 'A fuse box with the door hanging open. One socket is glowing. It would take anything you plugged into it.',
    choices: [
      { label: 'PLUG SOMETHING IN', sub: 'OVERCHARGE A RELIC UNTIL THE NEXT BOSS FALLS', act(G) {
        const list = G.run.relics.filter(r => OVERCHARGEABLE.includes(r.id));
        const r = list[Math.floor(rand() * list.length)];
        G.run.overOffer = r.id;
        return `${r.name} STARTS TO HUM. THE LIGHTS DIM EVERY TIME IT DOES.`;
      } },
      { label: 'SHUT THE DOOR', act(G) { G.addChips(6); return 'SOMEONE HAD TAPED 6 CHIPS INSIDE IT.'; } },
    ],
  },
);

// only after closing time
export const AFTER_EVENTS = [
  {
    id: 'arcade_signal', title: 'AN ARCADE MACHINE NOBODY PLUGGED IN.',
    text: 'The screen reads INSERT 8 CHIPS. The marquee is blank. The cable is lying on the floor, a metre from the wall.',
    choices: [
      { label: 'INSERT 8 CHIPS', can: G => G.run.chips >= 8, act(G) { G.addChips(-8); G.run.rajisTrigger = true; return 'THE SCREEN GOES BLACK. THEN IT GOES VERY, VERY RED.'; } },
      { label: 'WALK AWAY', act() { return 'THE SCREEN FOLLOWS YOU ACROSS THE ROOM.'; } },
    ],
  },
  {
    id: 'chairs_up', title: 'THE CHAIRS ARE UP ON THE TABLES.',
    text: 'Every table except yours. The cleaner is gone. The mop is still moving.',
    choices: [
      { label: 'TAKE A CHAIR DOWN', act(G) { G.heal(2); return 'YOU SIT FOR A MINUTE. +2 HEARTS.'; } },
      { label: 'CHECK THE TILL', act(G) { G.addChips(14); return 'IT IS OPEN. IT HAS BEEN OPEN FOR A WHILE. +14 CHIPS.'; } },
    ],
  },
  {
    id: 'last_orders', title: 'LAST ORDERS WERE AN HOUR AGO.',
    text: 'The barman is polishing one glass. He has been polishing it since you came in.',
    choices: [
      { label: 'ORDER ONE MORE', act(G) {
        const r = rollRelics(1, G.run.relics, { forceRarity: 'rare' })[0];
        if (r) { G.gainRelic(r); return `HE SLIDES IT OVER WITHOUT LOOKING. AT THE BOTTOM OF THE GLASS: ${r.name}.`; }
        G.addChips(8); return 'HE POURS NOTHING INTO THE GLASS. +8 CHIPS.';
      } },
      { label: 'ASK ABOUT THE OWNER', act(G) { G.addChips(4); return '"HE ONLY PLAYS ONE GAME A NIGHT," HE SAYS. "THIS ONE."'; } },
    ],
  },
];

export function pickEvent(seen = [], run = null, meta = null) {
  if (run?.after) {
    // the machine turns up for anyone who has not found what is inside it yet
    const pool = AFTER_EVENTS.filter(e => !seen.includes(e.id) && (e.id !== 'arcade_signal' || !meta?.data?.rajis?.found));
    const arcade = pool.find(e => e.id === 'arcade_signal');
    if (arcade && rand() < 0.6) return arcade;
    const rest = pool.filter(e => e !== arcade);
    return rest[Math.floor(rand() * rest.length)] || AFTER_EVENTS[1];
  }
  const ok = (e) => !e.when || (run && e.when(run, meta));
  const pool = EVENTS.filter(e => !seen.includes(e.id) && ok(e));
  const src = pool.length ? pool : EVENTS.filter(e => !e.rare && ok(e));
  const w = src.map(e => (e.rare ? 0.12 : 1));
  let x = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < src.length; i++) { x -= w[i]; if (x <= 0) return src[i]; }
  return src[0];
}
