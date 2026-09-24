# SCRATCH: AFTERHOURS

## v2.0.0 · 24 September 2026

The club stays open later now.

AFTERHOURS is the first big update to SCRATCH. It adds new ways for a run to go
wrong (and right), three new bosses, three new modes, a proper Classic
tournament, and a few things that only happen very late at night.

Your save carries over. Every level, unlock, record and achievement from 1.0 is
kept, and a run you left in progress picks up where you left it.

### The club has moods

- **Table States** can take over the club for several tables at a time. There
  are 8 of them, and each gets a banner when it arrives:
  - **Blackout**: the power goes and the balls glow.
  - **Overtime**: fewer shots, but multi-pots buy them back.
  - **Jackpot**: gold everywhere, and the shops raise their prices.
  - **Static**: relics surge and short out.
  - **Low Gravity**: nothing wants to stop, and explosions get enormous.
  - **Redline**: HEAT can't cool down.
  - **Quiet Hours**: the crowd goes silent, and precise shots pay a lot of STYLE.
  - **House Rules**: an extra rule on every table, and bigger purses.
- **Contracts.** At the start of a floor you may be offered two, and you can
  sign one. Each is a challenge that runs across several tables, such as
  *Banker* (8 bank pots before the boss) or *Untouched* (two clean tables in a
  row). The rewards are big: legendary relics, an extra relic slot, a permanent
  shop discount.
- **High Roller tables.** Bet 25, 50, 100 or everything you have on a harder
  table. Win and your stake comes back doubled (ALL IN pays x2.5). The chips are
  the game's own; no real money is involved.
- **Rivals.** Six regulars race you to the goal, taking a turn after every shot
  you take. Each has their own style: *The Hustler*, *The Lunatic*, *The Banker*,
  *The Ghost*, *The Shark* and *The Professor*. Lose to one twice and they
  become your **Nemesis**.

### More pool to play

- **8 new table types:**
  - **Sequence**: sink them in order.
  - **Territory**: every pocket is worth something different.
  - **Bounty**: one ball is worth three, until it slips away.
  - **Escalation**: every pot shrinks the pockets and raises the multiplier.
  - **Hot Potato**: one ball is on a three-shot fuse.
  - **Lockdown**: the pockets seal one by one.
  - **Perfect Route**: three marked balls and no misses.
  - **Chain**: pot something on shot after shot.
- **Trick Tables.** Six hand-built puzzle layouts with three attempts, no clock
  and no heart at risk. A script checks every one of them against the real
  physics to prove it can be solved.
- **3 new bosses:**
  - **The Collector** borrows your relics.
  - **The Architect** builds walls across the felt.
  - **The Bookie** offers a side bet before every shot.
- **Boss Remixes.** Beat a boss three times and it may come back harder.

### Relics that talk to each other

- **12 hidden synergies.** Some pairs of relics do something neither does
  alone. They aren't listed anywhere until you discover them, and the first
  time one fires you'll know.
- **5 risk relics**: *Double Edge*, *Debt*, *Blind Faith*, *Final Form* and
  *Last Life*. Each has a bigger upside and a sharper edge.
- **Overcharge.** Late in a run, something in the wall may offer to overcharge
  one of your relics until the next boss falls.
- **Build names.** Once you're holding four relics, the game names your build,
  for example *NUCLEAR BANKER* or *MIDAS STORM*.

### Presentation

- **The table takes damage.** After the loudest moments you get scorch marks
  and cracks on the felt, dust from the ceiling, flickering lights, a swinging
  lamp and rattling posters. It all resets between tables.
- **The crowd reacts.** It leans in when a shot is tense, bounces when you're on
  a streak, and goes silent during Quiet Hours.
- **Commentary.** A few words, as text, on your best and worst shots. It can be
  turned off in Settings.
- **Shot of the Run.** At the end of a run your best shot is shown with its
  numbers, and you can watch it again.
- **The menus move now**: entrance animations, and cards dealt onto the table.
  Everything respects *reduce motion*.
- The club notices what you've done, and so does the title screen.
- **10 new events.** Some of them are about something other than pool.

### New modes

- **Boss Rush**: every boss, back to back.
- **One Cue**: no shot limit, five lives, and every miss costs one.
- **Chaos**: three random relics, HEAT III, and a Table State at every turn.
- **Handicaps**: six optional rules (Double Speed, Small Pockets, Cursed Only,
  No Aim Guide, Random Relic, High Heat) that multiply your score and purses.

These open up gradually as you play. So do Contracts, Rivals, High Rollers,
Table States and the new tables: a first run is still the game it was in 1.0.

### Progress

- **Records** now also track your highest style, longest bank, most effects in
  one shot and furthest floor, plus best time, score and misses for each mode.
- **Run history**: your last 10 runs, with the full build of each.
- **Favourites**: mark relics with a star in the Collection.
- **A Synergies page** in the Collection, which shows ??? until you discover each one.
- New achievements and new balls, cues and a table to unlock.

### SCRATCH Classic

- **AI styles** are now separate from difficulty: Balanced, Cautious,
  Aggressive, Positional and Trickster. It's the same aim, with different
  decisions.
- **Tournament**: a four-player bracket against three regulars, with semi-finals
  and a final.
- **Shot clock**: off, 45, 30 or 20 seconds. Run out and it's a foul.
- **Best of 7** matches.
- **Three rooms**: the Lounge, the Parlour and the Loft.
- **Three new felts**: Championship Red, Teal and Slate Grey.
- **Two new cues**: Bird's-eye Maple, and Gold Inlay for winning a tournament.
- **More statistics**: best visit, fouls, shot-clock violations, tournaments.
- **Rematch in one key**: press R on the result screen.

### Under the hood

- **Save format v3**, with migration from every earlier save and nothing wiped.
- **A physics edge-case suite** (`npm run test:physics`) covering:
  - full-power breaks;
  - jaw hits;
  - frozen balls;
  - giant and tiny balls;
  - obstacles and closed pockets;
  - magnets, tilt and wind;
  - 300 random layouts.
- **A trick table solver** (`npm run check:tricks`).
- **Performance**: a steady 60 fps with every effect stacked, in both PS1 and
  Modern modes.

### Secrets

Some runs don't end when The House falls.

...and there are several things we aren't going to tell you about.
