// SCRATCH CLASSIC interface: quiet type, hairlines, one gold accent.
// Its own DOM layer (#classic) so it never shares a pixel with the club UI.

import './classic.css';
import { FELTS, LIGHTS, CUES, BALLS, ROOMS, byId } from './look.js';
import { LEVELS, STYLES } from './ai.js';
import { SOLIDS, STRIPES } from './rules.js';
import { GAME_VERSION } from '../game/meta.js';

function h(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
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
    const el = h('div', 'c-screen c-side');
    el.innerHTML = `
      <div class="c-col">
        <div class="c-brand"><div class="w">SCRATCH</div><div class="k">CLASSIC</div></div>
        <div class="c-menu"></div>
      </div>
      <div class="c-foot"><span class="c-ver">v${GAME_VERSION} · <u>Credits</u></span><span class="c-sig">Made by Paul Nercessian</span></div>
      <div class="c-fs">Fullscreen</div>`;
    const menu = el.querySelector('.c-menu');
    const defs = [
      ['VS AI', () => this.setupAI()],
      ['LOCAL VERSUS', () => this.setupLocal()],
      ['TOURNAMENT', () => this.setupTourney()],
      ['PRACTICE', () => this.c.startMatch({ type: 'practice' })],
      null,
      ['APPEARANCE', () => this.appearance()],
      ['STATISTICS', () => this.stats()],
      ['RULES', () => this.rules()],
      ['SETTINGS', () => this.settings()],
      null,
      ['RETURN TO ROGUELITE', () => this.g.exitClassic()],
    ];
    const items = [], acts = [];
    for (const d of defs) {
      if (!d) { menu.appendChild(h('div', 'c-gap')); continue; }
      const it = h('div', 'c-item' + (d[0].startsWith('RETURN') ? ' ret' : ''), d[0]);
      menu.appendChild(it); items.push(it); acts.push(d[1]);
    }
    const keys = this.nav(items, (i) => { this.g.audio.cUi('select'); acts[i](); });
    el.querySelector('.c-ver').addEventListener('click', (e) => { e.stopPropagation(); this.g.audio.cUi('select'); this.credits(); });
    const fs = el.querySelector('.c-fs');
    const drawFs = () => { fs.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; };
    drawFs();
    fs.addEventListener('click', (e) => { e.stopPropagation(); this.g.setFullscreen(!document.fullscreenElement); setTimeout(drawFs, 300); });
    this.open(el, { keys });
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

  clockRow(get, set) { return this.optRow('Shot clock', [0, 45, 30, 20], ['Off', '45 seconds', '30 seconds', '20 seconds'], get, set, 'Run out: ball in hand to your opponent'); }

  setupAI() {
    const d = this.c.data;
    let name = d.names.p1, level = d.ai || 'normal', bestOf = d.bestOf || 1, style = d.style || 'balanced', clock = d.clock || 0;
    const lvDesc = { easy: 'Makes mistakes. Happy to leave you shots.', normal: 'A decent club player. Pots what’s in front of it.', hard: 'Plays position and spin. Will play safe.', expert: 'Plans ahead, rarely misses, controls the cue ball.' };
    const lvRow = this.optRow('Opponent', ['easy', 'normal', 'hard', 'expert'], ['Easy', 'Normal', 'Hard', 'Expert'], () => level, (v) => { level = v; desc.textContent = lvDesc[v]; });
    const desc = h('div', 'c-desc', lvDesc[level]);
    const styRow = this.optRow('Playing style', Object.keys(STYLES), Object.values(STYLES).map(x => x.name), () => style, (v) => { style = v; sdesc.textContent = STYLES[v].desc; });
    const sdesc = h('div', 'c-desc', STYLES[style].desc);
    const f = this.form('VS AI', [
      this.inputRow('Your name', name, (v) => { name = v; }),
      lvRow,
      styRow,
      this.optRow('Frames', [1, 3, 5, 7], ['Single frame', 'Best of 3', 'Best of 5', 'Best of 7'], () => bestOf, (v) => { bestOf = v; }),
      this.clockRow(() => clock, (v) => { clock = v; }),
    ], [
      ['Start match', () => {
        d.names.p1 = (name || '').trim() || 'Player'; d.ai = level; d.bestOf = bestOf; d.style = style; d.clock = clock; this.c.save();
        this.c.startMatch({ type: 'ai', names: [d.names.p1], level, bestOf, style, clock });
      }, 'primary'],
      ['Back', () => { this.g.audio.cUi('back'); f.close(); }],
    ], { sub: 'Difficulty is how well it plays. Style is how it thinks.' });
    const rowsEl = f.el.querySelector('.c-rows');
    rowsEl.insertBefore(desc, lvRow.nextSibling);
    rowsEl.insertBefore(sdesc, styRow.nextSibling);
  }

  setupTourney() {
    const d = this.c.data;
    let name = d.names.p1, level = d.ai || 'normal', bestOf = 1, clock = d.clock || 0;
    const f = this.form('TOURNAMENT', [
      this.inputRow('Your name', name, (v) => { name = v; }),
      this.optRow('Field', ['easy', 'normal', 'hard', 'expert'], ['Easy', 'Normal', 'Hard', 'Expert'], () => level, (v) => { level = v; }, 'One of them is a notch better'),
      this.optRow('Semi-final', [1, 3], ['Single frame', 'Best of 3'], () => bestOf, (v) => { bestOf = v; }, 'The final is always at least best of 3'),
      this.clockRow(() => clock, (v) => { clock = v; }),
    ], [
      ['Draw the bracket', () => {
        d.names.p1 = (name || '').trim() || 'Player'; this.c.save();
        this.closeAll();
        this.c.startTourney({ names: [d.names.p1], level, bestOf, clock });
      }, 'primary'],
      ['Back', () => { this.g.audio.cUi('back'); f.close(); }],
    ], { sub: 'Four players. Two semi-finals. One final.' });
  }

  // the draw, before and after each round
  bracket(T, next, reason = '') {
    this.closeAll();
    this.hud(false);
    const g = this.g, f = T.field;
    g.state = 'cmenu';
    g.camMode = 'lounge';
    const nm = (i) => (i == null ? '—' : esc(f[i].name) + (f[i].you ? '' : ` <small>${LEVELS[f[i].level].name[0] + LEVELS[f[i].level].name.slice(1).toLowerCase()} · ${STYLES[f[i].style].name}</small>`));
    const win = (i) => (i != null && (T.winners.includes(i) || T.champion === i) ? ' won' : '');
    const title = T.round === 'semi' ? 'The draw' : T.round === 'final' ? 'The final' : T.champion === 0 ? 'Champion' : 'Knocked out';
    const el = h('div', 'c-screen c-side');
    el.innerHTML = `<div class="c-col"><div class="c-title">${title.toUpperCase()}</div>${reason ? `<div class="c-subt">${esc(reason)}</div>` : ''}
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
    let n1 = d.names.p1, n2 = d.names.p2, bestOf = d.bestOf || 1, clock = d.clock || 0;
    const f = this.form('LOCAL VERSUS', [
      this.inputRow('Player 1', n1, (v) => { n1 = v; }),
      this.inputRow('Player 2', n2, (v) => { n2 = v; }),
      this.optRow('Frames', [1, 3, 5, 7], ['Single frame', 'Best of 3', 'Best of 5', 'Best of 7'], () => bestOf, (v) => { bestOf = v; }),
      this.clockRow(() => clock, (v) => { clock = v; }),
    ], [
      ['Start match', () => {
        d.names.p1 = (n1 || '').trim() || 'Player 1'; d.names.p2 = (n2 || '').trim() || 'Player 2'; d.bestOf = bestOf; d.clock = clock; this.c.save();
        this.c.startMatch({ type: 'local', names: [d.names.p1, d.names.p2], bestOf, clock });
      }, 'primary'],
      ['Back', () => { this.g.audio.cUi('back'); f.close(); }],
    ], { sub: 'Same table, same mouse. Take turns.' });
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
      this.optRow('Camera', ['3d', 'top'], ['3D', 'Top down'], () => s.camera, (v) => { s.camera = v; this.g.camStyle = v === 'top' ? 'top' : 'cinematic'; apply(); }, 'C to switch'),
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

  appearance() {
    const c = this.c, L = c.data.look;
    const g = this.g;
    const prev = g.camMode;
    g.camMode = 'showcase';
    const set = (k, v) => { L[k] = v; c.save(); if (k === 'light') c.applyLook(false); else if (k === 'felt') c.applyLook(false); else if (k === 'balls') { c.applyLook(false); } else c.applyLook(false); };
    const f = this.form('APPEARANCE', [
      this.optRow('Felt', FELTS.map(x => x.id), FELTS.map(x => x.name), () => L.felt, (v) => set('felt', v)),
      this.optRow('Cue', CUES.map(x => x.id), CUES.map(x => (x.ach && !g.meta.data.achievements[x.ach] ? `${x.name} (locked)` : x.name)), () => L.cue, (v) => {
        const c = CUES.find(x => x.id === v);
        if (c.ach && !g.meta.data.achievements[c.ach]) { L.cue = v; c.lockedPreview = true; }
        set('cue', v);
      }, 'Ebony: beat the Expert AI · Gold Inlay: win a tournament'),
      this.optRow('Balls', BALLS.map(x => x.id), BALLS.map(x => x.name), () => L.balls, (v) => set('balls', v)),
      this.optRow('Lighting', LIGHTS.map(x => x.id), LIGHTS.map(x => x.name), () => L.light, (v) => set('light', v)),
      this.optRow('Room', ROOMS.map(x => x.id), ROOMS.map(x => x.name), () => L.room || 'lounge', (v) => set('room', v)),
    ], [['Done', () => { g.audio.cUi('back'); g.camMode = prev; f.close(); }]], {
      sub: 'Changes show on the table.',
      back: () => { g.audio.cUi('back'); g.camMode = prev; f.close(); },
    });
  }

  stats() {
    const st = this.c.data.stats;
    const el = h('div', 'c-screen c-side');
    const pct = st.played ? Math.round(st.won / st.played * 100) : 0;
    const rows = [
      ['Matches played', st.played], ['Matches won', `${st.won}${st.played ? `  <small>${pct}%</small>` : ''}`], ['Current streak', st.streak], ['Best win streak', st.bestStreak],
      ['Frames played', st.frames], ['Frames won vs AI', st.framesWon || 0], ['Break and runs', st.breakRuns], ['Best run in one visit', st.highRun ? `${st.highRun} ball${st.highRun === 1 ? '' : 's'}` : '—'],
      ['Balls potted', st.potted], ['Longest pot', st.longest ? `${st.longest.toFixed(2)} m` : '—'], ['Fouls', st.fouls || 0], ['Shot clock violations', st.clockFouls || 0],
      ['Tournaments won', `${st.tourneys || 0}${st.tourneysPlayed ? ` <small>of ${st.tourneysPlayed}</small>` : ''}`], ['Local matches', st.localMatches],
    ];
    const lv = ['easy', 'normal', 'hard', 'expert'].map(k => `<div><span>${LEVELS[k].name[0] + LEVELS[k].name.slice(1).toLowerCase()}</span><b>${st.aiWins[k] || 0}</b></div>`).join('');
    el.innerHTML = `<div class="c-col"><div class="c-title">STATISTICS</div><div class="c-stats">${rows.map(([k, v]) => `<div class="k">${k}</div><div class="v">${v}</div>`).join('')}</div><div class="c-subh">Wins against the AI</div><div class="c-lv">${lv}</div><div class="c-btns"><div class="c-btn sel">Back</div></div></div>`;
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
  matchIntro(m, cb) {
    const el = h('div', 'c-intro');
    const p = m.players;
    el.innerHTML = `<div class="b">SCRATCH</div><div class="t">8-Ball</div><div class="p">${esc(p[0].name)}</div><div class="vs">vs</div><div class="p">${esc(p[1].name)}</div>${m.bestOf > 1 ? `<div class="bo">Best of ${m.bestOf}</div>` : ''}`;
    this.layer.appendChild(el);
    this.g.audio.cUi('select');
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); }, 1900);
    setTimeout(() => { el.remove(); cb(); }, 2400);
  }

  frameResult(title, reason, wins) {
    const el = h('div', 'c-frame');
    el.innerHTML = `<div class="t">${esc(title)}</div><div class="r">${esc(reason)}</div><div class="s">${wins[0]} — ${wins[1]}</div>`;
    this.layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 600); }, 3000);
  }

  matchEnd(info) {
    const c = this.c;
    const el = h('div', 'c-screen c-end');
    el.innerHTML = `<div class="c-endbox"><div class="t">${esc(info.title)}</div><div class="r">${esc(info.reason)}</div>${info.score ? `<div class="s">${esc(info.players[0].name)} <b>${info.score[0]}</b> — <b>${info.score[1]}</b> ${esc(info.players[1].name)}</div>` : ''}<div class="c-btns row"></div></div>`;
    const row = el.querySelector('.c-btns');
    const defs = [['Rematch', () => c.rematch()], ['Main menu', () => c.toMenu()], ['Return to roguelite', () => this.g.exitClassic()]];
    const items = defs.map(([t]) => { const b = h('div', 'c-btn' + (t === 'Rematch' ? ' primary' : ''), t === 'Rematch' ? 'Rematch <small>R</small>' : t); row.appendChild(b); return b; });
    let entry;
    const nav = this.nav(items, (i) => { this.g.audio.cUi('select'); this.close(entry); defs[i][1](); });
    setTimeout(() => {
      entry = this.open(el, { keys: (code) => { if (code === 'KeyR') { this.g.audio.cUi('select'); this.close(entry); c.rematch(); return true; } if (code === 'ArrowLeft') return nav('ArrowUp'); if (code === 'ArrowRight') return nav('ArrowDown'); return nav(code); } });
    }, 900);
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
    if (prac) { this.hx.ly.textContent = { rack: 'Full rack', banks: 'Bank drill', spin: 'Cue ball control' }[m.layout] || ''; return; }
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
    this.hx.fr.textContent = m.bestOf > 1 ? `${m.wins[0]} — ${m.wins[1]}` : '';
    this.hx.lbl.textContent = m.bestOf > 1 ? `Best of ${m.bestOf}` : '8-Ball';
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

  banner(text) {
    const el = h('div', 'c-banner', esc(text));
    this.layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 700); }, 1500);
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
