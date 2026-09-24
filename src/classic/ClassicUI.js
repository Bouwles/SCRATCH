// SCRATCH CLASSIC interface: quiet type, hairlines, one gold accent.
// Its own DOM layer (#classic) so it never shares a pixel with the club UI.

import './classic.css';
import { FELTS, LIGHTS, CUES, BALLS, ROOMS, byId } from './look.js';
import { LEVELS, STYLES, STYLE_IDS } from './ai.js';
import { OPPONENTS, oppById, FORMATS, formatById, portrait, CLEVEL_XP } from './people.js';
import { DRILLS, DRILL_IDS } from './drills.js';
import { TRAILS, POCKET_FX } from '../game/cosmetics.js';
import { SOLIDS, STRIPES } from './rules.js';
import { GAME_VERSION } from '../game/meta.js';

function h(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
const tc = (s) => String(s).replace(/[A-Za-z\u2019']+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BALL_HEX = ['#f3eee1', '#f0b20a', '#1b46b4', '#cf1f2a', '#4a2783', '#ef630f', '#0f7041', '#7a1b21', '#0c0c0e'];
const pipStyle = (n) => {
  const c = BALL_HEX[n >= 9 ? n - 8 : n];
  return n >= 9 ? `background:linear-gradient(180deg,#efe9dc 0 30%,${c} 30% 70%,#efe9dc 70%)` : `background:${c}`;
};

export class ClassicUI {
  constructor(game, classic) {
    this.g = game;
    this.c = classic;
    this.root = h('div'); this.root.id = 'classic';
    this.hudEl = h('div', 'c-hud');
    this.layer = h('div', 'c-layer');
    this.screens = h('div', 'c-screens');
    this.logoEl = h('div', 'c-logo', '<div class="w">SCRATCH</div><div class="k">CLASSIC</div>');
    this.root.append(this.hudEl, this.layer, this.screens, this.logoEl);
    document.body.appendChild(this.root);
    this.stack = [];
    this.buildHUD();
    this.scale();
    window.addEventListener('resize', () => this.scale());
    window.addEventListener('keydown', (e) => {
      if (!this.c.active) return;
      const top = this.stack[this.stack.length - 1];
      const code = e.code === 'NumpadEnter' ? 'Enter' : e.code;       // keypad Enter works like Enter
      if (e.target?.tagName === 'INPUT' && !['Enter', 'Escape', 'ArrowUp', 'ArrowDown'].includes(code)) return;
      // a screen that handles a key owns it: the table never sees it too
      if (top?.keys && top.keys(code, e)) { e.preventDefault(); e.stopImmediatePropagation(); }
    });
  }

  scale() {
    const pref = this.g.meta.s.uiScale ?? 'auto';
    const W = window.innerWidth, H = window.innerHeight;
    let u = Math.min(W / 1280, H / 740);
    u = Math.max(0.72, Math.min(1.8, u)) * (pref === 'auto' ? 1 : +pref);
    this.root.style.setProperty('--u', `${u}px`);
  }

  show(on) { this.root.classList.toggle('on', on); }

  // ---------------------------------------------------------- stack
  open(el, { keys = null } = {}) {
    for (const s of this.stack) s.el.classList.add('covered');
    this.screens.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const entry = { el, keys };
    this.stack.push(entry);
    return entry;
  }
  close(entry, instant = false) {
    const i = this.stack.indexOf(entry);
    if (i >= 0) this.stack.splice(i, 1);
    const el = entry.el;
    el.classList.remove('in');
    el.classList.add('out');
    if (instant) el.remove(); else setTimeout(() => el.remove(), 360);
    const top = this.stack[this.stack.length - 1];
    if (top) top.el.classList.remove('covered');
  }
  closeAll() { while (this.stack.length) this.close(this.stack[this.stack.length - 1], true); this.pauseEntry = null; }
  modalOpen() { return this.stack.length > 0; }

  // vertical keyboard + mouse list
  nav(items, onSelect, { start = 0, onMove } = {}) {
    let sel = Math.max(0, Math.min(items.length - 1, start));
    const set = (i, sound = true) => {
      sel = (i + items.length) % items.length;
      items.forEach((it, k) => it.classList.toggle('sel', k === sel));
      if (sound) this.g.audio.cUi('move');
      onMove?.(sel);
    };
    items.forEach((it, k) => {
      it.addEventListener('mouseenter', () => { if (sel !== k) set(k); });
      it.addEventListener('click', (e) => { e.stopPropagation(); set(k, false); onSelect(k); });
    });
    set(sel, false);
    return (code) => {
      if (code === 'ArrowUp' || code === 'KeyW') { set(sel - 1); return true; }
      if (code === 'ArrowDown' || code === 'KeyS') { set(sel + 1); return true; }
      if (code === 'Enter' || code === 'Space') { onSelect(sel); return true; }
      return false;
    };
  }

  // ---------------------------------------------------------- logo (transitions)
  logo(state) {
    const l = this.logoEl;
    l.className = 'c-logo ' + state;
  }

  // ---------------------------------------------------------- main menu
  menu() {
    this.closeAll();
    const c = this.c, d = c.data, st = d.stats;
    const el = h('div', 'c-screen c-side');
    const need = CLEVEL_XP(d.level);
    el.innerHTML = `
      <div class="c-col">
        <div class="c-brand"><div class="w">SCRATCH</div><div class="k">CLASSIC</div></div>
        <div class="c-menu"></div>
      </div>
      <div class="c-card ia"><div class="lv">Classic level <b>${d.level}</b></div><div class="xp"><i style="width:${Math.min(100, d.xp / need * 100)}%"></i></div>
        <div class="kv"><span>Win streak</span><b>${st.streak || 0}</b></div><div class="kv"><span>Best streak</span><b>${st.bestStreak || 0}</b></div><div class="kv"><span>Matches won</span><b>${st.won || 0}</b></div></div>
      <div class="c-foot"><span class="c-ver">v${GAME_VERSION} · <u>Credits</u></span><span class="c-sig">Made by Paul Nercessian</span></div>
      <div class="c-fs">Fullscreen</div>`;
    const menu = el.querySelector('.c-menu');
    const defs = [
      ['QUICK MATCH', () => this.quickMatch()],
      ['CUSTOM MATCH', () => this.setupCustom()],
      ['TOURNAMENT', () => this.setupTourney()],
      ['LOCAL VERSUS', () => this.setupLocal()],
      ['PRACTICE', () => this.practiceMenu()],
      null,
      ['APPEARANCE', () => this.appearance()],
      ['RECORDS', () => this.stats()],
      ['RULES', () => this.rules()],
      ['SETTINGS', () => this.settings()],
      null,
      ['RETURN TO ROGUELITE', () => this.g.exitClassic()],
    ];
    const items = [], acts = [];
    for (const d2 of defs) {
      if (!d2) { menu.appendChild(h('div', 'c-gap')); continue; }
      const it = h('div', 'c-item' + (d2[0].startsWith('RETURN') ? ' ret' : ''), d2[0]);
      menu.appendChild(it); items.push(it); acts.push(d2[1]);
    }
    const keys = this.nav(items, (i) => { this.g.audio.cUi('select'); acts[i](); });
    el.querySelector('.c-ver').addEventListener('click', (e) => { e.stopPropagation(); this.g.audio.cUi('select'); this.credits(); });
    const fs = el.querySelector('.c-fs');
    const drawFs = () => { fs.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; };
    drawFs();
    fs.addEventListener('click', (e) => { e.stopPropagation(); this.g.setFullscreen(!document.fullscreenElement); setTimeout(drawFs, 300); });
    this.open(el, { keys });
    this.showPendingUnlocks();
  }

  // looks unlocked by a new Classic level, said quietly
  showPendingUnlocks() {
    const list = (this.c.pendingUnlocks || []).splice(0);
    list.forEach((it, i) => setTimeout(() => this.notice(`Unlocked · ${it.kind === 'room' ? 'Room' : it.kind === 'felt' ? 'Felt' : it.kind === 'cue' ? 'Cue' : 'Balls'}`, it.name.replace(/\b\w+/g, w => w[0] + w.slice(1).toLowerCase())), 400 + i * 1900));
  }

  // QUICK MATCH: pick how good, then play. Everything else is remembered.
  quickMatch() {
    const c = this.c, d = c.data;
    const el = h('div', 'c-screen c-side');
    el.innerHTML = `<div class="c-col"><div class="c-title">QUICK MATCH</div><div class="c-subt">Pick a difficulty. The next regular at the table takes you on.</div><div class="c-menu c-quick"></div></div>`;
    const menu = el.querySelector('.c-menu');
    const lvDesc = { easy: 'Makes mistakes. Happy to leave you shots.', normal: 'A decent club player. Pots what is in front of it.', hard: 'Plays position and spin. Will play safe.', expert: 'Plans ahead, rarely misses, controls the cue ball.' };
    const lvls = ['easy', 'normal', 'hard', 'expert'];
    const items = lvls.map(l => { const it = h('div', 'c-item', `${LEVELS[l].name}<small>${lvDesc[l]}</small>`); menu.appendChild(it); return it; });
    let entry;
    const go = (i) => {
      const level = lvls[i];
      d.quick.level = level;
      // the regular you have played least goes next
      const opp = [...OPPONENTS].sort((a, b) => ((d.rivals[a.id]?.w || 0) + (d.rivals[a.id]?.l || 0)) - ((d.rivals[b.id]?.w || 0) + (d.rivals[b.id]?.l || 0)) || Math.random() - 0.5)[0];
      c.save();
      c.startMatch({ type: 'ai', names: [d.names.p1], opp: opp.id, level, style: 'auto', format: d.custom.format || 'single', clock: d.custom.clock || 0, quick: true });
    };
    const keys = this.nav(items, (i) => { this.g.audio.cUi('select'); go(i); }, { start: Math.max(0, lvls.indexOf(d.quick.level)) });
    entry = this.open(el, { keys: (code) => { if (code === 'Escape' || code === 'Backspace') { this.g.audio.cUi('back'); this.close(entry); return true; } return keys(code); } });
  }

  credits() {
    const el = h('div', 'c-screen c-side');
    el.innerHTML = `<div class="c-col c-credits"><div class="c-title">SCRATCH</div><div class="c-subt">Classic</div>
      <p class="big">Created by<br><b>Paul Nercessian</b></p>
      <p>Version ${GAME_VERSION}</p>
      <p>Built with three.js (MIT License) and Vite.</p>
      <p>Typefaces under the SIL Open Font License: Inter, Cormorant Garamond, Press Start 2P, Dela Gothic One, DotGothic16, Chakra Petch.</p>
      <p>Every note of music and every sound is synthesised by the game as you play.</p>
      <p class="gold">Thank you for playing.</p>
      <div class="c-btns"><div class="c-btn sel">Back</div></div></div>`;
    let entry;
    const back = () => { this.g.audio.cUi('back'); this.close(entry); };
    el.querySelector('.c-btn').addEventListener('click', back);
    entry = this.open(el, { keys: (code) => { if (['Escape', 'Backspace', 'Enter', 'Space'].includes(code)) { back(); return true; } return false; } });
  }

  // a quiet notice (achievements earned at the Classic table, fullscreen refused…)
  achievement(name) { this.notice('Achievement', name); }
  notice(label, text) {
    const el = h('div', 'c-ach', `<span>${esc(label)}</span>${esc(text)}`);
    this.layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 600); }, 3200);
    this.g.audio.cUi('select');
  }

  // generic option row: ‹ value ›
  optRow(name, values, labels, get, set, note = '') {
    const row = h('div', 'c-row');
    row.innerHTML = `<div class="n">${name}${note ? `<small>${note}</small>` : ''}</div><div class="v"><span class="a l">‹</span><span class="t"></span><span class="a r">›</span></div>`;
    const t = row.querySelector('.t');
    const draw = () => { const i = values.indexOf(get()); t.textContent = labels[i < 0 ? 0 : i]; };
    const step = (d) => { const i = values.indexOf(get()); set(values[((i < 0 ? 0 : i) + d + values.length) % values.length]); draw(); this.g.audio.cUi('move'); };
    row.querySelector('.l').addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
    row.querySelector('.r').addEventListener('click', (e) => { e.stopPropagation(); step(1); });
    draw();
    row.step = step;
    return row;
  }
  sliderRow(name, get, set, note = '') {
    const row = h('div', 'c-row');
    row.innerHTML = `<div class="n">${name}${note ? `<small>${note}</small>` : ''}</div><div class="v"><span class="a l">‹</span><span class="bar"><i></i></span><span class="pct"></span><span class="a r">›</span></div>`;
    const draw = () => { const v = get(); row.querySelector('.bar i').style.width = `${Math.round(v * 100)}%`; row.querySelector('.pct').textContent = `${Math.round(v * 100)}`; };
    const step = (d) => { set(Math.max(0, Math.min(1, Math.round((get() + d * 0.1) * 10) / 10))); draw(); this.g.audio.cUi('move'); };
    row.querySelector('.l').addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
    row.querySelector('.r').addEventListener('click', (e) => { e.stopPropagation(); step(1); });
    draw();
    row.step = step;
    return row;
  }
  inputRow(name, value, onChange) {
    const row = h('div', 'c-row input');
    row.innerHTML = `<div class="n">${name}</div><div class="v"><input maxlength="14" spellcheck="false"></div>`;
    const inp = row.querySelector('input');
    inp.value = value;
    inp.addEventListener('input', () => onChange(inp.value));
    inp.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') inp.blur(); e.stopPropagation(); });
    row.step = () => inp.focus();
    row.focusInput = () => inp.focus();
    return row;
  }

  // a panel of rows + buttons, navigable with keys
  form(title, rows, buttons, { sub = '', back } = {}) {
    const el = h('div', 'c-screen c-side');
    el.innerHTML = `<div class="c-col"><div class="c-title">${title}</div>${sub ? `<div class="c-subt">${sub}</div>` : ''}<div class="c-rows"></div><div class="c-btns"></div></div>`;
    const rowsEl = el.querySelector('.c-rows'), btnEl = el.querySelector('.c-btns');
    rows.forEach(r => rowsEl.appendChild(r));
    const btns = buttons.map(([label, fn, cls]) => { const b = h('div', 'c-btn' + (cls ? ' ' + cls : ''), label); b.fn = fn; btnEl.appendChild(b); return b; });
    const items = [...rows, ...btns];
    const nav = this.nav(items, (i) => {
      const it = items[i];
      if (it.fn) { this.g.audio.cUi('select'); it.fn(); } else it.step?.(1);
    });
    let entry;
    const goBack = back || (() => { this.g.audio.cUi('back'); this.close(entry); });
    entry = this.open(el, {
      keys: (code) => {
        if (code === 'Escape' || code === 'Backspace') { goBack(); return true; }
        const cur = items.findIndex(x => x.classList.contains('sel'));
        const it = items[cur];
        if ((code === 'ArrowLeft' || code === 'KeyA') && it?.step && !it.focusInput) { it.step(-1); return true; }
        if ((code === 'ArrowRight' || code === 'KeyD') && it?.step && !it.focusInput) { it.step(1); return true; }
        return nav(code);
      },
    });
    return { el, entry, close: () => this.close(entry) };
  }

  clockRow(get, set) { return this.optRow('Shot clock', [0, 30, 45, 60], ['Off', '30 seconds', '45 seconds', '60 seconds'], get, set, 'Run out: ball in hand to your opponent'); }
  formatRow(get, set) { return this.optRow('Match', FORMATS.map(f => f.id), FORMATS.map(f => f.name), get, set); }

  // CUSTOM MATCH: who, how good, how they think, how long, and the table
  setupCustom() {
    const c = this.c, d = c.data, g = this.g, L = d.look, C = d.custom;
    let name = d.names.p1;
    const recOf = (id) => { const r = d.rivals[id]; return r ? `You ${r.w} — ${r.l}` : 'Never played'; };
    const oppRow = this.optRow('Opponent', OPPONENTS.map(o => o.id), OPPONENTS.map(o => o.name), () => C.opp, (v) => { C.opp = v; drawOpp(); });
    const who = h('div', 'c-who');
    const drawOpp = () => {
      const o = oppById(C.opp);
      who.innerHTML = '';
      who.appendChild(portrait(o, 44));
      who.insertAdjacentHTML('beforeend', `<div><div class="nm">${o.name} <small>${STYLES[o.style].name}</small></div><div class="bio">${o.bio}</div><div class="rec">${recOf(o.id)}</div></div>`);
    };
    const styRow = this.optRow('Playing style', ['auto', ...STYLE_IDS], ['Their own', ...STYLE_IDS.map(k => STYLES[k].name)], () => C.style || 'auto', (v) => { C.style = v; sdesc.textContent = v === 'auto' ? 'How this regular usually plays.' : STYLES[v].desc; });
    const sdesc = h('div', 'c-desc', !C.style || C.style === 'auto' ? 'How this regular usually plays.' : STYLES[C.style].desc);
    const own = (it) => g.meta.isUnlocked(it) && (c.s.cosmetics === 'all' || it.classy || it.kind === 'room');
    const pick = (list) => list.filter(own);
    const rows = [
      this.inputRow('Your name', name, (v) => { name = v; }),
      oppRow,
      this.optRow('Difficulty', ['easy', 'normal', 'hard', 'expert'], ['Easy', 'Normal', 'Hard', 'Expert'], () => C.level, (v) => { C.level = v; }),
      styRow,
      this.formatRow(() => C.format, (v) => { C.format = v; }),
      this.optRow('Aim guide', ['full', 'short', 'off'], ['Full', 'Short', 'Off'], () => c.s.aim, (v) => { c.s.aim = v; c.applyRender(); }),
      this.clockRow(() => C.clock, (v) => { C.clock = v; }),
      this.optRow('Table', pick(FELTS).map(x => x.id), pick(FELTS).map(x => tc(x.name)), () => L.felt, (v) => { L.felt = v; c.applyLook(false); }),
      this.optRow('Room', pick(ROOMS).map(x => x.id), pick(ROOMS).map(x => x.name), () => L.room || 'lounge', (v) => { L.room = v; c.applyLook(false); }),
      this.optRow('Cue', pick(CUES).map(x => x.id), pick(CUES).map(x => tc(x.name)), () => L.cue, (v) => { L.cue = v; c.applyLook(false); }),
    ];
    const f = this.form('CUSTOM MATCH', rows, [
      ['Start match', () => {
        d.names.p1 = (name || '').trim() || 'Player'; c.save();
        c.startMatch({ type: 'ai', names: [d.names.p1], opp: C.opp, level: C.level, style: C.style, format: C.format, clock: C.clock });
      }, 'primary'],
      ['Back', () => { g.audio.cUi('back'); c.save(); f.close(); }],
    ], { sub: 'Difficulty is how well they play. Style is how they think.' });
    f.el.classList.add('wide');
    const rowsEl = f.el.querySelector('.c-rows');
    rowsEl.insertBefore(who, oppRow.nextSibling);
    rowsEl.insertBefore(sdesc, styRow.nextSibling);
    drawOpp();
  }
  setupAI() { this.setupCustom(); }

  setupTourney() {
    const d = this.c.data;
    let name = d.names.p1, level = d.custom.level || 'normal', format = 'single', clock = d.custom.clock || 0;
    const f = this.form('TOURNAMENT', [
      this.inputRow('Your name', name, (v) => { name = v; }),
      this.optRow('Field', ['easy', 'normal', 'hard', 'expert'], ['Easy', 'Normal', 'Hard', 'Expert'], () => level, (v) => { level = v; }, 'One of them is a notch better'),
      this.optRow('Semi-final', ['single', 'bo3', 'race3'], ['Single frame', 'Best of 3', 'Race to 3'], () => format, (v) => { format = v; }, 'The final is always at least best of 3'),
      this.clockRow(() => clock, (v) => { clock = v; }),
    ], [
      ['Draw the bracket', () => {
        d.names.p1 = (name || '').trim() || 'Player'; this.c.save();
        this.closeAll();
        this.c.startTourney({ names: [d.names.p1], level, format, clock });
      }, 'primary'],
      ['Back', () => { this.g.audio.cUi('back'); f.close(); }],
    ], { sub: `Four players. Two semi-finals. One final. ${d.stats.tourneys ? `You have won ${d.stats.tourneys}.` : 'Win it for a trophy.'}` });
  }

  // the draw, before and after each round
  bracket(T, next, reason = '') {
    this.closeAll();
    this.hud(false);
    const g = this.g, f = T.field;
    g.state = 'cmenu';
    g.camMode = 'lounge';
    const nm = (i) => (i == null ? '—' : esc(f[i].name) + (f[i].you ? '' : ` <small>${LEVELS[f[i].level].name[0] + LEVELS[f[i].level].name.slice(1).toLowerCase()} · ${STYLES[f[i].style]?.name || ''}</small>`));
    const win = (i) => (i != null && (T.winners.includes(i) || T.champion === i) ? ' won' : '');
    const title = T.round === 'semi' ? 'The draw' : T.round === 'final' ? 'The final' : T.champion === 0 ? 'Champion' : 'Knocked out';
    const el = h('div', 'c-screen c-side');
    el.innerHTML = `<div class="c-col"><div class="c-title">${title.toUpperCase()}</div>${reason ? `<div class="c-subt">${esc(reason)}</div>` : ''}
      ${T.round === 'done' && T.champion === 0 ? '<div class="c-trophy"><i></i><b></b><span></span></div>' : ''}
      <div class="c-bracket">
        <div class="rd"><div class="lbl">Semi-final</div><div class="m"><div class="pl${win(0)}">${nm(0)}</div><div class="pl${win(1)}">${nm(1)}</div></div><div class="m"><div class="pl${win(2)}">${nm(2)}</div><div class="pl${win(3)}">${nm(3)}</div></div></div>
        <div class="rd"><div class="lbl">Final</div><div class="m"><div class="pl${T.champion === T.winners[0] && T.champion != null ? ' won' : ''}">${nm(T.winners[0])}</div><div class="pl${T.champion === T.winners[1] && T.champion != null ? ' won' : ''}">${nm(T.winners[1])}</div></div></div>
        <div class="rd"><div class="lbl">Champion</div><div class="m champ"><div class="pl won">${nm(T.champion)}</div></div></div>
      </div>
      <div class="c-btns"></div></div>`;
    const row = el.querySelector('.c-btns');
    const defs = next ? [[T.round === 'semi' ? 'Play your semi-final' : 'Play the final', next, 'primary'], ['Withdraw', () => this.c.toMenu()]] : [['Back to the lounge', () => this.c.toMenu(), 'primary']];
    const items = defs.map(([t, , cls]) => { const b = h('div', 'c-btn' + (cls ? ' ' + cls : ''), t); row.appendChild(b); return b; });
    let entry;
    const nav = this.nav(items, (i) => { g.audio.cUi('select'); this.close(entry); defs[i][1](); });
    entry = this.open(el, { keys: (code) => { if (code === 'Escape') { this.close(entry); this.c.toMenu(); return true; } return nav(code); } });
    if (T.round === 'done' && T.champion === 0) g.audio.cWin();
  }

  setupLocal() {
    const d = this.c.data;
    let n1 = d.names.p1, n2 = d.names.p2, format = d.custom.format || 'single', clock = d.custom.clock || 0;
    const f = this.form('LOCAL VERSUS', [
      this.inputRow('Player 1', n1, (v) => { n1 = v; }),
      this.inputRow('Player 2', n2, (v) => { n2 = v; }),
      this.formatRow(() => format, (v) => { format = v; }),
      this.clockRow(() => clock, (v) => { clock = v; }),
    ], [
      ['Start match', () => {
        d.names.p1 = (n1 || '').trim() || 'Player 1'; d.names.p2 = (n2 || '').trim() || 'Player 2'; this.c.save();
        this.c.startMatch({ type: 'local', names: [d.names.p1, d.names.p2], format, clock });
      }, 'primary'],
      ['Back', () => { this.g.audio.cUi('back'); f.close(); }],
    ], { sub: 'Same table, same mouse. Take turns.' });
  }

  // PRACTICE: free play, or a challenge with a best score to beat
  practiceMenu() {
    const c = this.c, d = c.data;
    const el = h('div', 'c-screen c-side');
    el.innerHTML = `<div class="c-col"><div class="c-title">PRACTICE</div><div class="c-subt">Normal table, normal physics. Just you.</div><div class="c-menu c-quick"></div></div>`;
    const menu = el.querySelector('.c-menu');
    const defs = [['FREE PRACTICE', 'Rack, drills, undo. No score.', null], ...DRILL_IDS.map(id => [DRILLS[id].name.toUpperCase(), `${DRILLS[id].desc}${d.drills[id] ? ` · Best ${d.drills[id]} ${DRILLS[id].unit}` : ''}`, id])];
    const items = defs.map(([t, sub]) => { const it = h('div', 'c-item', `${t}<small>${sub}</small>`); menu.appendChild(it); return it; });
    let entry;
    const keys = this.nav(items, (i) => { this.g.audio.cUi('select'); c.startMatch({ type: 'practice', drill: defs[i][2] }); });
    entry = this.open(el, { keys: (code) => { if (code === 'Escape' || code === 'Backspace') { this.g.audio.cUi('back'); this.close(entry); return true; } return keys(code); } });
  }

  settings() {
    const c = this.c, s = c.s, m = this.g.meta.s;
    const apply = () => { c.save(); c.applyRender(); };
    const onoff = (k, name, note) => this.optRow(name, [true, false], ['On', 'Off'], () => !!s[k], (v) => { s[k] = v; apply(); }, note);
    const rows = [
      this.optRow('Graphics quality', ['low', 'medium', 'high'], ['Low', 'Medium', 'High'], () => s.quality, (v) => { s.quality = v; apply(); }),
      onoff('shadows', 'Shadows'),
      onoff('reflections', 'Reflections'),
      onoff('aa', 'Anti-aliasing'),
      this.optRow('Aim guide', ['full', 'short', 'off'], ['Full', 'Short', 'Off'], () => s.aim, (v) => { s.aim = v; apply(); }),
      this.optRow('Camera', ['3d', 'top', 'cue'], ['3D', 'Top down', 'Cue view'], () => s.camera, (v) => { s.camera = v; this.g.camStyle = v === 'top' ? 'top' : v === 'cue' ? 'cue' : 'cinematic'; apply(); }, 'C to switch'),
      onoff('follow', 'Follow shot', 'The camera rides behind the cue ball'),
      onoff('ambience', 'Room ambience'),
      this.sliderRow('Music', () => s.music, (v) => { s.music = v; apply(); }),
      this.sliderRow('Effects', () => s.sfx, (v) => { s.sfx = v; apply(); }),
      this.sliderRow('Master volume', () => m.master ?? 0.8, (v) => { m.master = v; apply(); }, 'shared'),
      this.optRow('UI scale', ['auto', 0.8, 0.9, 1, 1.1], ['Auto', '80%', '90%', '100%', '110%'], () => m.uiScale, (v) => { m.uiScale = v; apply(); }, 'shared'),
      this.optRow('Display', [false, true], ['Window', 'Fullscreen'], () => !!document.fullscreenElement, (v) => { this.g.setFullscreen(v); }, 'shared'),
    ];
    const f = this.form('SETTINGS', rows, [['Done', () => { this.g.audio.cUi('back'); f.close(); }]], { sub: 'Classic settings never touch the roguelite’s look.' });
    f.el.classList.add('wide');
    f.el.querySelector('.c-rows').classList.add('two');
  }

  // APPEARANCE: Classic keeps to classy things unless you say otherwise
  appearance() {
    const c = this.c, L = c.data.look, g = this.g;
    const prev = g.camMode;
    g.camMode = 'showcase';
    const set = (k, v) => { L[k] = v; c.save(); c.applyLook(false); };
    const opts = (list, kind) => list.filter(it => g.meta.visible(it) && (c.s.cosmetics === 'all' || it.classy || kind === 'room' || kind === 'light'));
    const lab = (it) => (g.meta.isUnlocked({ ...it, kind: it.kind }) ? tc(it.name) : `${tc(it.name)} (${lockWhy(it)})`);
    const lockWhy = (it) => { const t = g.meta.unlockText(it); return t.startsWith('CLASSIC') ? `Classic level ${it.unlock.clevel}` : t === 'A SECRET' ? 'secret' : 'locked'; };
    const guard = (list, k) => (v) => { const it = list.find(x => x.id === v); if (it && !g.meta.isUnlocked(it)) { g.audio.cUi('deny'); this.notice('Locked', `${tc(it.name)} · ${lockWhy(it)}`, 'soft'); return; } set(k, v); };
    let f;
    const build = () => {
      const felts = opts(FELTS, 'felt'), cues = opts(CUES, 'cue'), balls = opts(BALLS, 'ball'), trails = opts(TRAILS, 'trail'), pockets = opts(POCKET_FX, 'pocket');
      const rows = [
        this.optRow('Cosmetics', ['classic', 'all'], ['Classic only', 'All compatible'], () => c.s.cosmetics, (v) => { c.s.cosmetics = v; c.save(); f.close(); build(); }, 'All compatible adds your roguelite unlocks'),
        this.optRow('Felt', felts.map(x => x.id), felts.map(lab), () => L.felt, guard(felts, 'felt')),
        this.optRow('Cue', cues.map(x => x.id), cues.map(lab), () => L.cue, guard(cues, 'cue')),
        this.optRow('Balls', balls.map(x => x.id), balls.map(lab), () => L.balls, guard(balls, 'balls')),
        this.optRow('Lighting', LIGHTS.map(x => x.id), LIGHTS.map(x => x.name), () => L.light, (v) => set('light', v)),
        this.optRow('Room', ROOMS.map(x => x.id), ROOMS.map(lab), () => L.room || 'lounge', guard(ROOMS, 'room')),
        this.optRow('Shot trail', trails.map(x => x.id), trails.map(lab), () => L.trail || 'off', guard(trails, 'trail')),
        this.optRow('Pocket effect', pockets.map(x => x.id), pockets.map(lab), () => L.pocket || 'quiet', guard(pockets, 'pocket')),
      ];
      f = this.form('APPEARANCE', rows, [['Done', () => { g.audio.cUi('back'); g.camMode = prev; f.close(); }]], {
        sub: 'Changes show on the table.',
        back: () => { g.audio.cUi('back'); g.camMode = prev; f.close(); },
      });
    };
    build();
  }

  // RECORDS
  stats() {
    const d = this.c.data, st = d.stats;
    const el = h('div', 'c-screen c-side');
    const pct = st.played ? Math.round(st.won / st.played * 100) : 0;
    const hrs = st.playtime || 0, time = hrs >= 3600 ? `${Math.floor(hrs / 3600)}h ${Math.floor(hrs % 3600 / 60)}m` : `${Math.floor(hrs / 60)}m`;
    const rows = [
      ['Matches', st.played], ['Wins', st.won], ['Win rate', st.played ? `${pct}%` : '—'], ['Current streak', st.streak], ['Best streak', st.bestStreak],
      ['Expert wins', st.aiWins.expert || 0], ['Tournaments won', `${st.tourneys || 0}${st.tourneysPlayed ? ` <small>of ${st.tourneysPlayed}</small>` : ''}`],
      ['Balls potted', st.potted], ['Break and runs', st.breakRuns], ['Bank shots', st.banks || 0], ['Good safeties', st.safeties || 0],
      ['Longest pot', st.longest ? `${st.longest.toFixed(2)} m` : '—'], ['Best visit', st.highRun ? `${st.highRun} ball${st.highRun === 1 ? '' : 's'}` : '—'],
      ['Fouls', st.fouls || 0], ['Shot clock violations', st.clockFouls || 0], ['Frames', st.frames], ['Local matches', st.localMatches], ['Time at the table', time],
    ];
    const riv = OPPONENTS.filter(o => d.rivals[o.id]).map(o => `<div class="c-rv">${portrait(o, 18).outerHTML.replace('<canvas', '<canvas data-o="' + o.id + '"')}<span>${o.name}</span><b>${d.rivals[o.id].w} — ${d.rivals[o.id].l}</b></div>`).join('');
    el.innerHTML = `<div class="c-col c-wide"><div class="c-title">RECORDS</div><div class="c-subt">Classic level ${d.level}</div><div class="c-stats">${rows.map(([k, v]) => `<div class="k">${k}</div><div class="v">${v}</div>`).join('')}</div>${riv ? `<div class="c-subh">Against the regulars</div><div class="c-rivals">${riv}</div>` : ''}<div class="c-btns"><div class="c-btn sel">Back</div></div></div>`;
    // portraits drawn as canvases need repainting after the HTML round trip
    el.querySelectorAll('canvas[data-o]').forEach(cv => { const p = portrait(oppById(cv.dataset.o), 18); cv.replaceWith(p); });
    let entry;
    const back = () => { this.g.audio.cUi('back'); this.close(entry); };
    el.querySelector('.c-btn').addEventListener('click', back);
    entry = this.open(el, { keys: (code) => { if (['Escape', 'Backspace', 'Enter', 'Space'].includes(code)) { back(); return true; } return false; } });
  }

  rules() {
    const el = h('div', 'c-screen c-side');
    el.innerHTML = `<div class="c-col c-rules"><div class="c-title">RULES</div>
      <p><b>The break.</b> Break from behind the line. Pot a ball or drive four balls to a cushion. The table stays open after the break.</p>
      <p><b>Groups.</b> The first ball you legally pot after the break makes you solids (1–7) or stripes (9–15).</p>
      <p><b>Every shot.</b> Hit one of your own balls first. After contact, pot a ball or send any ball to a cushion. Pot one of yours and you keep the table.</p>
      <p><b>Fouls.</b> Scratching, hitting the wrong ball first, or no cushion after contact. Your opponent gets ball in hand.</p>
      <p><b>The 8.</b> Clear your group, then pot the 8 in any pocket to win. Pot it early, or scratch while potting it, and you lose the frame.</p>
      <div class="c-btns"><div class="c-btn sel">Back</div></div></div>`;
    let entry;
    const back = () => { this.g.audio.cUi('back'); this.close(entry); };
    el.querySelector('.c-btn').addEventListener('click', back);
    entry = this.open(el, { keys: (code) => { if (['Escape', 'Backspace', 'Enter', 'Space'].includes(code)) { back(); return true; } return false; } });
  }

  // yes / no
  confirm({ title, text, ok, cancel = 'Cancel' }, cb) {
    const el = h('div', 'c-screen c-center c-dim');
    el.innerHTML = `<div class="c-dialog"><div class="c-title sm">${title}</div><div class="c-text">${text}</div><div class="c-btns row"></div></div>`;
    const row = el.querySelector('.c-btns');
    const bOk = h('div', 'c-btn primary', ok), bNo = h('div', 'c-btn', cancel);
    row.append(bOk, bNo);
    let entry;
    const done = (v) => { this.g.audio.cUi(v ? 'select' : 'back'); this.close(entry); cb(v); };
    const nav = this.nav([bOk, bNo], (i) => done(i === 0), { start: 1 });
    entry = this.open(el, { keys: (code) => { if (code === 'Escape') { done(false); return true; } if (code === 'ArrowLeft' || code === 'ArrowRight') return nav(code === 'ArrowLeft' ? 'ArrowUp' : 'ArrowDown'); return nav(code); } });
  }

  // ---------------------------------------------------------- pause
  pause() {
    const c = this.c, m = c.match;
    c.setPaused(true);
    const el = h('div', 'c-screen c-side c-dim');
    el.innerHTML = `<div class="c-col"><div class="c-title">PAUSED</div><div class="c-subt">${m.type === 'practice' ? 'Practice' : m.type === 'ai' ? `${esc(m.players[0].name)} vs ${esc(m.players[1].name)}` : `${esc(m.players[0].name)} vs ${esc(m.players[1].name)}`}</div><div class="c-menu"></div></div>`;
    const menu = el.querySelector('.c-menu');
    const defs = [
      ['RESUME', () => this.closePause()],
      m.type === 'practice' ? ['NEW RACK', () => { this.closePause(); c.practiceRack(m.layout); }] : null,
      m.type !== 'practice' ? ['RESTART MATCH', () => this.confirm({ title: 'Restart the match?', text: 'The score goes back to nothing.', ok: 'Restart' }, (v) => { if (v) { c.setPaused(false); this.closeAll(); this.g.timers = []; c.rematch(); } })] : null,
      ['SETTINGS', () => this.settings()],
      ['RULES', () => this.rules()],
      ['MAIN MENU', () => {
        if (m.type === 'practice') { c.quitMatch(); return; }
        this.confirm({ title: 'Leave the match?', text: 'This match will end.', ok: 'Leave' }, (v) => { if (v) c.quitMatch(); });
      }],
      ['RETURN TO ROGUELITE', () => this.g.exitClassic()],
    ].filter(Boolean);
    const items = defs.map(([t]) => { const it = h('div', 'c-item' + (t.startsWith('RETURN') ? ' ret' : ''), t); menu.appendChild(it); return it; });
    const keys = this.nav(items, (i) => { this.g.audio.cUi('select'); defs[i][1](); });
    this.pauseEntry = this.open(el, { keys: (code) => { if (code === 'Escape') { this.closePause(); return true; } return keys(code); } });
  }
  closePause() {
    if (this.pauseEntry) { this.close(this.pauseEntry); this.pauseEntry = null; }
    this.c.setPaused(false);
  }

  // ---------------------------------------------------------- match moments
  // "I'm entering a match": the names, the faces, the record, the format
  matchIntro(m, cb) {
    const el = h('div', 'c-intro');
    const p = m.players, d = this.c.data;
    const fmt = formatById(m.format);
    const sub = m.opp ? `${LEVELS[m.level].name[0] + LEVELS[m.level].name.slice(1).toLowerCase()} · ${STYLES[p[1].style]?.name || ''}` : '';
    const r = m.opp ? d.rivals[m.opp.id] : null;
    el.innerHTML = `<div class="b">SCRATCH</div><div class="t">8-Ball</div>
      <div class="vsrow"><div class="side"><div class="p">${esc(p[0].name)}</div></div><div class="vs">vs</div><div class="side opp"><div class="pp"></div><div class="p">${esc(p[1].name)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div></div>
      ${r ? `<div class="rec">You ${r.w} — ${r.l} ${esc(p[1].name)}</div>` : m.opp ? '<div class="rec">First meeting</div>' : ''}
      ${m.need > 1 ? `<div class="bo">${fmt.name}</div>` : ''}${m.tourney ? `<div class="bo">${m.tourney.round === 'final' ? 'The final' : 'Semi-final'}</div>` : ''}`;
    if (m.opp) el.querySelector('.pp').appendChild(portrait(m.opp, 40));
    this.layer.appendChild(el);
    this.g.audio.cUi('select');
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); }, 2300);
    setTimeout(() => { el.remove(); cb(); }, 2800);
  }

  // the first Classic match ever: four lines, then play
  firstTime(go) {
    const el = h('div', 'c-screen c-center c-dim');
    el.innerHTML = `<div class="c-first"><div class="k">SCRATCH CLASSIC</div><div class="l">Normal 8-ball.</div><div class="l">Solids or stripes.</div><div class="l">Clear your group.</div><div class="l">Pot the 8 last.</div><div class="h">Click to play</div></div>`;
    let entry, done = false;
    const fin = () => { if (done) return; done = true; this.close(entry); go(); };
    el.addEventListener('click', fin);
    entry = this.open(el, { keys: () => { fin(); return true; } });
    setTimeout(fin, 6000);
  }

  frameResult(title, reason, wins) {
    const el = h('div', 'c-frame');
    el.innerHTML = `<div class="t">${esc(title)}</div><div class="r">${esc(reason)}</div><div class="s">${wins[0]} — ${wins[1]}</div>`;
    this.layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 600); }, 3000);
  }

  matchEnd(info) {
    const c = this.c, g = this.g;
    const el = h('div', 'c-screen c-end');
    const S = info.stats || [{}, {}];
    const avg = (x) => (x.shots ? `${(x.shotTime / x.shots).toFixed(1)} s` : '—');
    const rows = [['Pots', 'pots'], ['Fouls', 'fouls'], ['Banks', 'banks'], ['Longest pot', 'longest'], ['Safeties', 'safeties'], ['Average shot', 'avg']]
      .map(([k, f]) => `<div class="a">${f === 'avg' ? avg(S[0]) : f === 'longest' ? (S[0].longest ? `${S[0].longest.toFixed(2)} m` : '—') : S[0][f] ?? 0}</div><div class="k">${k}</div><div class="a">${f === 'avg' ? avg(S[1]) : f === 'longest' ? (S[1].longest ? `${S[1].longest.toFixed(2)} m` : '—') : S[1][f] ?? 0}</div>`).join('');
    const lv = info.lv;
    el.innerHTML = `<div class="c-endbox wide"><div class="t">${esc(info.title)}</div>${info.score ? `<div class="s">${info.score[0]} — ${info.score[1]}</div>` : ''}<div class="r">${esc(info.reason)}</div>
      <div class="c-mstats"><div class="h">${esc(info.players[0].name)}</div><div></div><div class="h">${esc(info.players[1].name)}</div>${rows}</div>
      ${info.rec ? `<div class="c-recline">You ${info.rec.w} — ${info.rec.l} ${esc(info.players[1].name)}${info.streak ? ` · Win streak ${info.streak}` : ''}</div>` : ''}
      ${lv ? `<div class="c-xp"><span>Classic level ${lv.to}${lv.to > lv.from ? ' · <b>level up</b>' : ''}</span><i><b style="width:${Math.min(100, lv.xp / lv.need * 100)}%"></b></i><span>+${info.xp} XP</span></div>` : ''}
      <div class="c-btns row"></div></div>`;
    const row = el.querySelector('.c-btns');
    const m = c.match;
    const defs = [['Rematch', () => c.rematch()], m?.type === 'ai' && !m.tourney ? ['Change opponent', () => { c.toMenu(); this.setupCustom(); }] : null, ['Classic menu', () => c.toMenu()]].filter(Boolean);
    const items = defs.map(([t]) => { const b = h('div', 'c-btn' + (t === 'Rematch' ? ' primary' : ''), t === 'Rematch' ? 'Rematch <small>R</small>' : t); row.appendChild(b); return b; });
    let entry;
    const nav = this.nav(items, (i) => { g.audio.cUi('select'); this.close(entry); defs[i][1](); });
    setTimeout(() => {
      entry = this.open(el, { keys: (code) => { if (code === 'KeyR') { g.audio.cUi('select'); this.close(entry); c.rematch(); return true; } if (code === 'ArrowLeft') return nav('ArrowUp'); if (code === 'ArrowRight') return nav('ArrowDown'); return nav(code); } });
      this.showPendingUnlocks();
    }, 900);
  }

  // a subtle name for a good shot: BANK · LONG POT
  shotLabel(labels, good = false) {
    this.layer.querySelectorAll('.c-shot').forEach(n => n.remove());
    const el = h('div', 'c-shot' + (good ? ' good' : ''), labels.map(esc).join('<i>·</i>'));
    this.layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 600); }, 1700);
    this.g.audio.cUi('move');
  }

  breakAndRun() {
    const el = h('div', 'c-bnr', '<div class="t">Break &amp; Run</div><div class="r">The whole rack, one visit.</div>');
    this.layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    this.g.audio.cWin();
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 800); }, 2000);
  }

  drillCard(D, best) {
    this.notice(D.name, `${D.desc}${best ? ` Best: ${best} ${D.unit}.` : ''}`, 'soft');
  }
  drillResult(D, d, best, isBest, say) {
    const c = this.c, g = this.g;
    const el = h('div', 'c-screen c-center c-dim');
    el.innerHTML = `<div class="c-dialog"><div class="c-title sm">${esc(D.name)}</div><div class="c-text">${esc(say)}</div><div class="c-drill"><b>${d.score}</b> ${D.unit}${isBest ? '<span>New best</span>' : `<small>Best ${best}</small>`}</div><div class="c-btns row"></div></div>`;
    const row = el.querySelector('.c-btns');
    const defs = [[d.id === 'break' ? 'Rerack <small>R</small>' : 'Again <small>R</small>', () => c.startDrill(d.id)], ['Practice menu', () => { c.toMenu(); this.practiceMenu(); }]];
    const items = defs.map(([t], i) => { const b = h('div', 'c-btn' + (i === 0 ? ' primary' : ''), t); row.appendChild(b); return b; });
    let entry;
    const nav = this.nav(items, (i) => { g.audio.cUi('select'); this.close(entry, true); defs[i][1](); });
    entry = this.open(el, { keys: (code) => { if (code === 'KeyR' || code === 'KeyN') { this.close(entry, true); c.startDrill(d.id); return true; } if (code === 'Escape') { this.close(entry, true); c.toMenu(); this.practiceMenu(); return true; } if (code === 'ArrowLeft') return nav('ArrowUp'); if (code === 'ArrowRight') return nav('ArrowDown'); return nav(code); } });
  }

  // ---------------------------------------------------------- HUD
  buildHUD() {
    this.hudEl.innerHTML = `
      <div class="c-board">
        <div class="pl p0"><div class="nm"></div><div class="gr"></div><div class="pips"></div><div class="th"><i></i><i></i><i></i></div></div>
        <div class="mid"><div class="fr"></div><div class="lbl"></div></div>
        <div class="pl p1"><div class="nm"></div><div class="gr"></div><div class="pips"></div><div class="th"><i></i><i></i><i></i></div></div>
      </div>
      <div class="c-practice"><div class="t">Practice</div><div class="ly"></div>
        <div class="keys"><span data-k="N"><b>N</b> New rack</span><span data-k="U"><b>U</b> Undo shot</span><span data-k="M"><b>M</b> Move cue ball</span><span data-k="L"><b>L</b> Layout</span></div></div>
      <div class="c-controls ia">
        <div class="c-spin"><div class="dot"></div></div>
        <div class="c-power"><i class="fill"></i><i class="cap"></i></div>
      </div>
      <div class="c-hint"></div>
      <div class="c-clock"><i></i><span></span></div>`;
    const q = (s) => this.hudEl.querySelector(s);
    this.hx = { clock: q('.c-clock'), board: q('.c-board'), practice: q('.c-practice'), p: [q('.p0'), q('.p1')], fr: q('.mid .fr'), lbl: q('.mid .lbl'), spin: q('.c-spin'), dot: q('.c-spin .dot'), fill: q('.c-power .fill'), cap: q('.c-power .cap'), hint: q('.c-hint'), power: q('.c-power'), ly: q('.c-practice .ly') };
    const setSpin = (e) => {
      const r = this.hx.spin.getBoundingClientRect();
      let x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      this.g.spin.x = x; this.g.spin.y = y;
    };
    let drag = false;
    this.hx.spin.addEventListener('mousedown', (e) => { if (!this.c.isHumanTurn()) return; e.stopPropagation(); drag = true; setSpin(e); });
    window.addEventListener('mousemove', (e) => { if (drag) setSpin(e); });
    window.addEventListener('mouseup', () => { drag = false; });
    this.hx.spin.addEventListener('dblclick', () => { this.g.spin.x = 0; this.g.spin.y = 0; });
    this.hudEl.querySelectorAll('.c-practice [data-k]').forEach(s => s.addEventListener('click', () => this.c.onKey('Key' + s.dataset.k)));
    this.hudEl.querySelector('.c-practice').classList.add('ia');
  }

  hud(on) { this.hudEl.classList.toggle('on', on); if (on) this.updateHUD(); }

  updateHUD() {
    const m = this.c.match;
    if (!m) return;
    const prac = m.type === 'practice';
    this.hx.board.style.display = prac ? 'none' : '';
    this.hx.practice.style.display = prac ? '' : 'none';
    if (prac) {
      const dr = m.drill && DRILLS[m.drill.id];
      this.hx.ly.textContent = dr ? `${dr.name} · ${m.drill.score} ${dr.unit}${dr.tries ? ` · ${Math.max(0, dr.tries - m.drill.tries)} left` : ''}` : { rack: 'Full rack', banks: 'Bank drill', spin: 'Cue ball control' }[m.layout] || '';
      this.hx.practice.querySelector('.t').textContent = dr ? 'Practice challenge' : 'Practice';
      this.hx.practice.querySelector('.keys').style.display = dr ? 'none' : '';
      return;
    }
    const on = this.c.onTableSet();
    m.players.forEach((p, i) => {
      const el = this.hx.p[i];
      el.querySelector('.nm').textContent = p.name;
      el.classList.toggle('turn', m.turn === i);
      el.querySelector('.gr').textContent = p.group ? (p.group === 'solids' ? 'Solids' : 'Stripes') : m.isBreak ? (m.turn === i ? 'Breaking' : '') : 'Open table';
      const pips = el.querySelector('.pips');
      const nums = p.group === 'solids' ? SOLIDS : p.group === 'stripes' ? STRIPES : [];
      const sig = nums.map(n => on.has(n) ? 1 : 0).join('') + (nums.length && nums.every(n => !on.has(n)) ? '8' + (on.has(8) ? 1 : 0) : '');
      if (pips.dataset.sig !== sig + p.group) {
        pips.dataset.sig = sig + p.group;
        pips.innerHTML = nums.map(n => `<i class="${on.has(n) ? '' : 'off'}" style="${pipStyle(n)}"></i>`).join('') + (nums.length && nums.every(n => !on.has(n)) ? `<i class="eight" style="${pipStyle(8)}"></i>` : '');
      }
    });
    this.hx.fr.textContent = m.need > 1 ? `${m.wins[0]} — ${m.wins[1]}` : '';
    this.hx.lbl.textContent = m.need > 1 ? formatById(m.format).short : '8-Ball';
  }

  update(dt) {
    const g = this.g;
    if (!this.hudEl.classList.contains('on')) return;
    const charging = g.state === 'charge' || g.state === 'aiCharge';
    this.hx.fill.style.height = `${(charging ? g.charge : 0) * 100}%`;
    this.hx.cap.style.bottom = `${g.power * 100}%`;
    this.hx.power.classList.toggle('ai', !this.c.isHumanTurn());
    this.hx.dot.style.left = `${50 + g.spin.x * 36}%`;
    this.hx.dot.style.top = `${50 - g.spin.y * 36}%`;
    const busy = ['sim', 'shooting', 'cwait', 'cend'].includes(g.state);
    this.hx.hint.style.opacity = busy ? 0 : 1;
    const m = this.c.match;
    const clockOn = !!(m?.clock && this.c.isHumanTurn() && ['aim', 'charge', 'place'].includes(g.state));
    this.hx.clock.classList.toggle('on', clockOn);
  }

  clock(frac, secs) {
    const el = this.hx.clock;
    el.querySelector('i').style.width = `${Math.max(0, frac) * 100}%`;
    el.querySelector('span').textContent = `${secs}`;
    el.classList.toggle('low', secs <= 5);
  }

  flashPower() { this.hx.power.classList.remove('flash'); void this.hx.power.offsetWidth; this.hx.power.classList.add('flash'); }

  thinking(on) {
    const m = this.c.match;
    this.hx.p.forEach((el, i) => el.classList.toggle('thinking', on && m?.turn === i));
  }

  hint(text) { this.hx.hint.textContent = text; }

  banner(text, ms = 1500, cb = null) {
    const el = h('div', 'c-banner', esc(text));
    this.layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 700); }, ms);
    if (cb) setTimeout(cb, ms * 0.6);
  }

  notice(title, text = '', kind = '') {
    this.layer.querySelectorAll('.c-notice').forEach(n => n.remove());
    const el = h('div', 'c-notice ' + kind, `<div class="t">${esc(title)}</div>${text ? `<div class="r">${esc(text)}</div>` : ''}`);
    this.layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 600); }, kind === 'soft' ? 1800 : 2600);
  }

  foul(reason, next) {
    this.layer.querySelectorAll('.c-notice').forEach(n => n.remove());
    const el = h('div', 'c-notice foul', `<div class="t">Foul</div><div class="r">${esc(reason)}</div><div class="n">${esc(next)}</div>`);
    this.layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => el.classList.add('next'), 1100);
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 600); }, 3300);
  }
}
