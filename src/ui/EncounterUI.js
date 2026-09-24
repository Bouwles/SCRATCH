// The objective layer, mixed into UI: the objective intro before every table,
// the encounter bar at the bottom of the screen, the feedback line above it
// ("DIRECT POT · DOES NOT COUNT"), and the banners that say how a table ended.
// All words come from game/objectives.js.

import './encounter.css';
import { objectiveInfo, LEARN, phaseLine, endText } from '../game/objectives.js';
import { glyphHTML } from './art.js';
import { ROMAN, stakeText } from '../game/mastery.js';
import { LOCATIONS, MISSIONS, STAFF, staffFor } from '../game/rajis.js';
import { portraitIcon } from './art.js';

function h(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const TABLE_STATES = ['intro', 'aim', 'charge', 'shooting', 'sim', 'place', 'house', 'houseWait', 'result', 'enemy', 'hold'];

// tiny animated diagrams for the first-time explanations (SVG, 120x60)
const FELT = '<rect x="4" y="4" width="112" height="52" rx="3" fill="#10602f" stroke="#4a2a14" stroke-width="4"/>'
  + [[6, 6], [60, 5], [114, 6], [6, 54], [60, 55], [114, 54]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#050505"/>`).join('');
const ball = (x, y, c, extra = '') => `<circle cx="${x}" cy="${y}" r="3.4" fill="${c}" stroke="#000" stroke-width="0.6">${extra}</circle>`;
const move = (path, dur = 2.4, begin = 0) => `<animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${path}" keyTimes="0;0.75;1" keyPoints="0;1;1" calcMode="linear"/>`;
const DIAGRAMS = {
  bank: `${FELT}<path d="M40 38 L64 51 L106 12" stroke="#ffe23b" stroke-dasharray="2 2" fill="none" stroke-width="0.8"/>${ball(0, 0, '#e0262a', move('M40 38 L64 51 L110 9'))}${ball(22, 30, '#f2f0e6', move('M22 30 L36 36', 0.6 * 4, 0))}`,
  kick: `${FELT}<path d="M20 20 L50 51 L80 22" stroke="#2bf0ff" stroke-dasharray="2 2" fill="none" stroke-width="0.8"/>${ball(84, 18, '#1d4fd6')}${ball(0, 0, '#f2f0e6', move('M20 20 L50 51 L81 21'))}`,
  combo: `${FELT}${ball(0, 0, '#f2f0e6', move('M20 30 L60 30'))}${ball(0, 0, '#f6c21c', move('M66 30 L66 30 L112 8', 2.4))}${ball(0, 0, '#6a2fa8', move('M74 36 L74 36 L112 52', 2.4))}`,
  marked: `${FELT}${ball(40, 26, '#e0262a')}<rect x="34" y="20" width="12" height="12" fill="none" stroke="#ff2030" stroke-width="1"/>${ball(76, 30, '#1d4fd6')}<circle cx="76" cy="30" r="6.5" fill="none" stroke="#ffe23b" stroke-width="1.2"/>${ball(58, 44, '#139a4a')}<rect x="52" y="38" width="12" height="12" fill="none" stroke="#ff2030" stroke-width="1"/>`,
  eight: `${FELT}${ball(30, 30, '#f6c21c')}${ball(50, 22, '#1d4fd6')}${ball(70, 34, '#121216')}<text x="70" y="35.5" font-size="3.6" fill="#fff" text-anchor="middle" font-family="monospace">8</text><text x="70" y="47" font-size="5" fill="#ffe23b" text-anchor="middle" font-family="monospace">LAST</text>`,
  sequence: `${FELT}${[[30, 30, '1'], [58, 20, '2'], [86, 36, '3']].map(([x, y, n]) => `${ball(x, y, '#1d4fd6')}<text x="${x}" y="${y - 6}" font-size="6" fill="#2bf0ff" text-anchor="middle" font-family="monospace">${n}</text>`).join('')}`,
  territory: `${FELT}<text x="13" y="15" font-size="6" fill="#8a86a8" font-family="monospace">x1</text><text x="55" y="16" font-size="6" fill="#2bf0ff" font-family="monospace">x2</text><text x="98" y="15" font-size="6" fill="#ffc21c" font-family="monospace">x3</text>${ball(0, 0, '#e0262a', move('M40 38 L110 9'))}`,
};

export const EncounterUI = {
  // ------------------------------------------------------------ the bar
  buildEncBar() {
    const el = this.eb = h('div', 'enc-bar hold');
    el.innerHTML = `<div class="eb-feed"></div>
      <div class="eb-head"><div class="eb-left"><div class="eb-kick"></div><div class="eb-title"></div></div><div class="eb-right"></div></div>
      <div class="eb-track main"><i class="lag"></i><i class="fill"></i><i class="tent"></i><div class="ticks"></div><div class="notches"></div></div>
      <div class="eb-track riv"><i class="fill"></i></div>
      <div class="eb-foot"><div class="eb-count"></div><div class="eb-rule"></div></div>`;
    this.hud.appendChild(el);
    const q = (s) => el.querySelector(s);
    this.ebx = {
      feed: q('.eb-feed'), kick: q('.eb-kick'), title: q('.eb-title'), right: q('.eb-right'),
      track: q('.eb-track.main'), fill: q('.main .fill'), lag: q('.main .lag'), tent: q('.main .tent'), ticks: q('.main .ticks'), notches: q('.main .notches'),
      riv: q('.eb-track.riv'), rivFill: q('.riv .fill'), count: q('.eb-count'), rule: q('.eb-rule'),
    };
    this.ebSig = {};
  },

  tableIndex() {
    const run = this.g.run;
    if (!run?.nodes) return null;
    const isT = (n) => ['table', 'elite', 'boss'].includes(n.type);
    const i = run.nodes.slice(0, run.node + 1).filter(isT).length;
    return i ? { i, n: run.nodes.filter(isT).length } : null;
  },

  kindTag(e) {
    if (e.def.boss) return ['boss', e.remix ? 'BOSS · REMIX' : 'BOSS'];
    if (e.anomaly) return ['anomaly', 'ANOMALY'];
    if (e.kind === 'elite') return ['elite', 'ELITE'];
    if (e.stake) return ['stakes', 'HIGH STAKES'];
    if (e.kind === 'highroller') return ['elite', `HIGH ROLLER · ${e.hr}`];
    if (e.rivalDef) return ['rival', e.nemesis ? 'NEMESIS' : 'RIVAL'];
    if (e.kind === 'trickshot') return ['puzzle', 'TRICK TABLE'];
    return ['', ''];
  },

  updateEncBar(force = false) {
    const g = this.g, e = g.enc, run = g.run;
    if (!this.eb) return;
    const atTable = !!e && TABLE_STATES.includes(g.state);
    this.eb.classList.toggle('off', !atTable);
    if (!atTable) return;
    const o = objectiveInfo(g, e);
    const S = g.shot;
    const raw = S && !S.house && !e.done ? (e.def.progress ? e.def.progress(g, S, e) : S.counted) : 0;
    const tent = Math.max(0, Math.min(e.goal - e.progress, raw || 0));
    const [kcls, ktag] = this.kindTag(e);
    const shots = Math.max(0, e.shots);
    const blitz = e.def.id === 'blitz';
    const oneCue = run?.oneCue && !blitz && e.kind !== 'trickshot';
    const final = !e.done && (blitz ? e.timer <= 10 : oneCue ? run.hearts <= 1 : e.kind !== 'trickshot' && shots <= 1 && !e.def.house);
    const rj = run?.mode === 'rajis';
    // --- static parts
    const sig = [o.name, o.title, o.count, o.line, kcls, ktag, e.phase, e.goal, o.kind, rj, o.rival?.score, o.rival?.hidden].join('|');
    if (force || sig !== this.ebSig.main) {
      this.ebSig.main = sig;
      const ti = this.tableIndex();
      const where = rj ? (e.issuedBy ? `ISSUED BY ${STAFF[e.issuedBy].name}` : '') : ti && !e.def.boss ? `TABLE ${ti.i} / ${ti.n}` : '';
      const nm = e.anomaly ? e.anomaly.name : rj && MISSIONS[e.def.id] ? MISSIONS[e.def.id] : o.name;
      const phase = e.def.boss && (e.def.phases?.length) ? ` · PHASE ${ROMAN[Math.min(3, e.phase || 1)]}` : '';
      this.ebx.kick.innerHTML = this.L(`${ktag ? `<span class="tag ${kcls}">${ktag}${phase}</span>` : ''}<span class="nm">${o.kind === 'boss' ? o.title : nm}</span>${where ? `<span class="wh">${where}</span>` : ''}`);
      this.ebx.title.textContent = this.L(o.kind === 'boss' ? o.name : o.title);
      if (o.kind === 'race') {
        this.eb.style.setProperty('--rc', o.rival.color);
        this.ebx.count.innerHTML = this.L(`<span class="you">YOU ${Math.min(e.goal, e.progress)}</span> · <span class="riv">${o.rival.name} ${o.rival.hidden ? '?' : o.rival.score}</span> <span class="of">OF ${e.goal}</span>`);
      } else this.ebx.count.textContent = o.count;
      this.ebx.rule.textContent = o.kind === 'boss' ? (e.lastGame ? o.line : `${phaseLine(e) ? phaseLine(e) + '. ' : ''}${o.line}`) : o.line;
      for (const c of [...this.eb.classList]) if (/^[kc]-/.test(c)) this.eb.classList.remove(c);
      this.eb.classList.add(`k-${o.kind}`);
      if (kcls) this.eb.classList.add(`c-${kcls}`);
      if (e.def.boss) this.eb.style.setProperty('--bc', e.def.color || '#ff3b5c'); else this.eb.style.removeProperty('--bc');
      // one tick per point on short goals; phase notches on bosses
      const n = e.goal;
      this.ebx.ticks.innerHTML = n <= 14 && o.kind !== 'boss' ? Array.from({ length: n - 1 }, (_, i) => `<b style="left:${(i + 1) / n * 100}%"></b>`).join('') : '';
      this.ebx.notches.innerHTML = e.def.boss && e.def.phases ? [Math.ceil(n / 3), Math.ceil(n * 2 / 3)].map(t => `<b style="left:${(n - t) / n * 100}%"></b>`).join('') : '';
      // the race: a second bar under yours
      this.ebx.riv.style.display = o.kind === 'race' ? '' : 'none';
      if (o.kind === 'race') {
        this.ebx.rivFill.style.width = o.rival.hidden ? '0%' : `${o.rival.score / e.goal * 100}%`;
      }
    }
    // --- the fill (committed progress, then this shot's tentative pots)
    const fsig = `${o.frac}|${tent}|${e.goal}`;
    if (force || fsig !== this.ebSig.fill) {
      this.ebSig.fill = fsig;
      if (o.kind === 'boss') {
        this.ebx.fill.style.width = `${o.frac * 100}%`;
        this.ebx.lag.style.width = `${o.frac * 100}%`;
        this.ebx.tent.style.left = `${Math.max(0, o.frac - tent / e.goal) * 100}%`;
        this.ebx.tent.style.width = `${Math.min(o.frac, tent / e.goal) * 100}%`;
      } else {
        this.ebx.fill.style.width = `${o.frac * 100}%`;
        this.ebx.lag.style.width = '0%';
        this.ebx.tent.style.left = `${o.frac * 100}%`;
        this.ebx.tent.style.width = `${Math.min(1 - o.frac, tent / e.goal) * 100}%`;
      }
    }
    // --- committed progress changed: say so
    const key = e;
    if (this.ebLast?.e === key && this.ebLast.p !== e.progress) {
      const up = e.progress > this.ebLast.p;
      this.pulseBar(up ? 'gain' : 'loss');
      if (up) this.g.audio.progress?.(e.progress / e.goal);
    }
    this.ebLast = { e: key, p: e.progress };
    // --- shots / time on the right
    const rsig = [shots, e.shotsMax, final, blitz ? Math.ceil(e.timer) : '', e.def.id === 'clock' ? Math.ceil(Math.max(0, e.clock)) : '', oneCue ? run.hearts : '', e.kind].join('|');
    if (force || rsig !== this.ebSig.right) {
      this.ebSig.right = rsig;
      let html;
      if (blitz) html = `<div class="sn${final ? ' fin' : ''}">${Math.floor(Math.max(0, e.timer) / 60)}:${String(Math.ceil(Math.max(0, e.timer)) % 60).padStart(2, '0')}</div><div class="sl">TIME LEFT</div>`;
      else if (oneCue) html = `<div class="sn">∞</div><div class="sl">${final ? 'LAST LIFE' : 'A MISS COSTS A LIFE'}</div>`;
      else if (e.kind === 'trickshot') html = `<div class="sn${final ? ' fin' : ''}">${shots}</div><div class="sl">ATTEMPT${shots === 1 ? '' : 'S'} LEFT</div>`;
      else if (final) html = `<div class="sn fin">${shots}</div><div class="sl fin">${shots ? 'FINAL SHOT' : 'NO SHOTS LEFT'}</div>`;
      else {
        const cues = Array.from({ length: Math.min(14, Math.max(e.shotsMax, shots)) }, (_, i) => `<i class="${i < shots ? '' : 'used'}"></i>`).join('');
        html = `<div class="sn">${shots}</div><div class="sl">SHOTS LEFT</div><div class="cues">${cues}</div>`;
      }
      if (e.def.id === 'clock') html = `<div class="aimclock${e.clock <= 4 ? ' fin' : ''}">${Math.ceil(Math.max(0, e.clock))}s TO AIM</div>` + html;
      this.ebx.right.innerHTML = this.L(html);
      this.eb.classList.toggle('final', final);
      if (final && !e.finalShown) { e.finalShown = true; this.pulseBar('danger'); }
    }
  },

  pulseBar(kind) {
    const el = this.eb;
    if (!el) return;
    el.classList.remove('gain', 'loss', 'danger', 'phase');
    void el.offsetWidth;
    el.classList.add(kind);
    clearTimeout(this.pulseT);
    this.pulseT = setTimeout(() => el.classList.remove(kind), 900);
  },

  // a line of feedback just above the bar: what that shot did, and why
  encFeedback(text, tone = 'bad', ms = 2100) {
    if (!this.eb || !text) return;
    const f = this.ebx.feed;
    const el = h('div', `fb ${tone}`, this.L(text));
    f.appendChild(el);
    while (f.children.length > 2) f.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
  },

  // the bar slides up (a boss's fills like a health bar)
  encArrive() {
    const el = this.eb;
    if (!el) return;
    el.classList.remove('hold', 'arrive', 'won', 'lost');
    this.ebSig = {};
    this.updateEncBar(true);
    void el.offsetWidth;
    el.classList.add('arrive');
    setTimeout(() => el.classList.remove('arrive'), 1600);
  },
  encHold(on) { this.eb?.classList.toggle('hold', on); },

  // ----------------------------------------------------- objective intro
  // Darken the room, say what this table wants in big plain words, then fly
  // the objective down into the bar where it lives for the rest of the table.
  objectiveIntro(e, go) {
    const g = this.g, run = g.run, d = g.meta.data;
    const o = objectiveInfo(g, e);
    const rj = run.mode === 'rajis';
    const [kcls, ktag] = this.kindTag(e);
    const ti = this.tableIndex();
    const where = rj ? `OPERATION ${run.op} · ${LOCATIONS[run.nodes[run.node]?.loc]?.name || ''}` : run.after ? '03:77 · AFTERHOURS' : `FLOOR ${run.floor}`;
    const name = e.anomaly ? e.anomaly.name : rj && MISSIONS[e.def.id] ? MISSIONS[e.def.id] : o.name;
    const budget = e.def.id === 'blitz' ? `<b>${e.timer}</b> SECONDS` : e.kind === 'trickshot' ? `<b>${e.shots}</b> ATTEMPTS · NO CLOCK` : run.oneCue ? '<b>∞</b> SHOTS · A MISS COSTS A LIFE' : `<b>${e.shots}</b> SHOTS`;
    const extra = [
      e.rivalDef ? `<span style="color:${e.rivalDef.color}">${e.nemesis ? `${e.rivalDef.name} REMEMBERS YOU.` : `${e.rivalDef.name}: ${e.rivalDef.taunt}`}</span>` : '',
      e.hr ? `${glyphHTML('roller')} YOUR BET: ${e.hr} CHIPS${e.hrAll ? ' · ALL IN' : ''}` : '',
      e.tstate ? `<span style="color:${e.tstate.color}">${e.tstate.name}: ${e.tstate.desc}</span>` : '',
      e.anomaly ? `<span style="color:#c08aff">${e.anomaly.desc}</span>` : '',
      ...(e.mods || []).map(m => `${glyphHTML('diamond')} ${m.name}: ${m.desc}`),
      e.challenge ? `${glyphHTML('dice')} BET: ${e.challenge.name}` : '',
      e.stake ? `<span class="stk">${glyphHTML('warn')} DO NOT BREAK: ${e.stake.name} · ${stakeText(e.stake, e)}</span>` : '',
    ].filter(Boolean);
    const learnKey = o.learn && !d.learned?.[o.learn] ? o.learn : null;
    const L = learnKey ? LEARN[learnKey] : null;
    const el = h('div', `screen obj-intro ${kcls ? 'c-' + kcls : ''}${rj ? ' rj' : ''}`);
    el.innerHTML = this.L(`<div class="oi">
      <div class="oi-kick">${where}${ti ? ` · <span class="oi-tn">TABLE ${ti.i} / ${ti.n}</span>` : ''}</div>
      <div class="oi-name chrome">${name}</div>${ktag ? `<div class="oi-tag ${kcls}">${ktag}</div>` : ''}
      <div class="oi-box panel"><div class="oi-label">OBJECTIVE</div><div class="oi-title">${o.title}</div><div class="oi-line">${o.line}</div><div class="oi-shots">${budget}</div></div>
      ${extra.length ? `<div class="oi-extra">${extra.map(t => `<div>${t}</div>`).join('')}</div>` : ''}
      ${rj && !e.def.boss ? '<div class="oi-comms"></div>' : ''}
      ${L ? `<div class="oi-learn panel">${DIAGRAMS[learnKey] ? `<svg viewBox="0 0 120 60" class="oi-dia">${DIAGRAMS[learnKey]}</svg>` : ''}<div><div class="lk">NEW · ${L[0]}</div><div class="lt">${L[1]}</div></div></div>` : ''}
      <div class="oi-hint">CLICK OR PRESS ANY KEY</div></div>`);
    if (learnKey) { d.learned = d.learned || {}; d.learned[learnKey] = 1; g.meta.save(); }
    // RAJIS: somebody on the staff issued this mission
    const cm = el.querySelector('.oi-comms');
    if (cm) {
      const who = staffFor(run, run.node), S = STAFF[who];
      e.issuedBy = who;
      const line = S.issue[(run.seed + run.node * 7) % S.issue.length];
      cm.innerHTML = `<div class="rc-face"></div><div><div class="rc-n" style="color:${S.color}">${S.name} <span>· ${S.title}</span></div><div class="rc-l">"${line}"</div></div>`;
      cm.querySelector('.rc-face').appendChild(portraitIcon(who));
    }
    // a clue: for a moment the table has another number
    if (e.rajisClue) {
      const tn = el.querySelector('.oi-tn');
      if (tn) setTimeout(() => { const was = tn.textContent; tn.textContent = 'RAJIS-01'; tn.style.color = '#8fd14f'; g.audio.staticBurst(0.08, 0.03); setTimeout(() => { tn.textContent = was; tn.style.color = ''; }, 320); }, 700);
    }
    const prevLamp = g.lampTarget;
    g.lampTarget = 0.35;
    this.encHold(true);
    this.updateHUD(true);
    g.audio.tone(220, { type: 'square', dur: 0.1, vol: 0.07, filter: 2000 });
    g.audio.tone(330, { t: g.audio.now + 0.09, type: 'square', dur: 0.1, vol: 0.07, filter: 2000 });
    g.audio.tone(440, { t: g.audio.now + 0.18, type: 'square', dur: 0.22, vol: 0.07, filter: 2000 });
    if (e.rivalDef && e.nemesis) g.audio.tone(110, { type: 'sawtooth', dur: 1.2, vol: 0.15, filter: 500, verb: 0.6 });
    let done = false;
    const fin = () => {
      if (done) return; done = true;
      g.lampTarget = prevLamp;
      const t = el.querySelector('.oi-title');
      const bar = this.ebx.title;
      this.updateEncBar(true);
      const a = t.getBoundingClientRect(), b = bar.getBoundingClientRect();
      el.classList.add('out');
      if (!reduced() && a.height && b.height) {
        const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
        t.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${b.height / a.height})` }], { duration: 460, easing: g.modernGfx ? 'cubic-bezier(.55,0,.25,1)' : 'steps(9)', fill: 'forwards' });
      }
      setTimeout(() => { this.close(entry); this.encArrive(); go(); }, reduced() ? 60 : 430);
    };
    const entry = this.open(el, { keys: () => { fin(); return true; }, click: fin });
    el.addEventListener('click', fin);
    const ms = Math.min(7000, 2100 + extra.length * 450 + (learnKey ? 3200 : 0) + (kcls === 'elite' ? 300 : 0) + (kcls === 'stakes' ? 500 : 0));
    setTimeout(fin, ms);
  },

  // a contract finishing (or breaking) gets its own short banner
  contractBanner(title, sub, good = true) {
    const el = h('div', `enc-end contract ${good ? 'won' : 'lost'}`);
    el.innerHTML = `<div class="ee-t">${this.L(title)}</div><div class="ee-s">${this.L(sub)}</div>`;
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 1350);
  },

  // --------------------------------------------------------- endings
  // ~1 second that says how the table ended, before the result screen
  encResolve(won, reason = '') {
    const g = this.g, e = g.enc;
    if (!e) return;
    const t = endText(e, won, reason);
    this.eb?.classList.add(won ? 'won' : 'lost');
    if (won && this.ebx) { this.ebx.fill.style.width = e.def.boss ? '0%' : '100%'; this.ebx.tent.style.width = '0%'; }
    const el = h('div', `enc-end ${won ? 'won' : 'lost'}${e.def.boss ? ' boss' : ''}`);
    el.innerHTML = `<div class="ee-t">${this.L(t.title)}</div><div class="ee-s">${this.L(t.sub)}</div>`;
    if (e.def.boss) el.style.setProperty('--bc', e.def.color);
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 1350);
  },
};
