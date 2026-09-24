// AFTERHOURS screens, mixed into UI: Table State banners, contracts, High
// Roller bets, rivals, synergy discoveries, commentary, persistent labels,
// the modes, handicaps, Shot of the Run, closing time and everything behind
// the arcade machine. Same panels, same fonts, same keys as the rest.

import './after.css';
import { RELICS, PROTOCOLS, RARITY, relicById } from '../game/relics.js';
import { ACHIEVEMENTS, xpForLevel } from '../game/meta.js';
import { SYNERGIES, HANDICAPS, handicapMul, RIVALS, rivalById, buildName, contractById, TABLE_STATES } from '../game/afterhours.js';
import { RAJIS_BOSSES, RAJIS_ORDER, lex, LOCATIONS, MISSIONS, STAFF, STAFF_ORDER, staffFor } from '../game/rajis.js';
import { relicIcon, achIcon, glyphHTML, glyph, portraitIcon } from './art.js';
import { takeOverScreens } from '../render/textures.js';
import { ROMAN, STYLE_GRADES, STYLE_COL } from '../game/mastery.js';

function h(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

export const AfterUI = {
  // ------------------------------------------------------ RAJIS language
  setRajis(on) {
    this.rajis = !!on;
    document.documentElement.classList.toggle('rajis', this.rajis);
  },
  L(t) { return this.rajis ? lex(t) : t; },

  // ----------------------------------------------------- persistent labels
  // numbers over sequence balls, pocket values, LOCK markers…
  updateLabels() {
    const g = this.g;
    this.labelEls = this.labelEls || new Map();
    const seen = new Set();
    const show = g.enc && !g.enc.done && ['aim', 'charge', 'shooting', 'sim', 'place', 'house', 'houseWait', 'enemy'].includes(g.state) && !this.stack.length;
    if (show) {
      const put = (key, text, color, pos, small = false) => {
        seen.add(key);
        let el = this.labelEls.get(key);
        if (!el) { el = h('div', 'blabel' + (small ? ' small' : '')); this.pops.appendChild(el); this.labelEls.set(key, el); }
        if (el.textContent !== text) el.textContent = this.L(text);
        el.style.color = color || '#fff';
        const s = g.renderer.project(pos, g.camera);
        el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      };
      for (const b of g.physics.balls) {
        if (b.state !== 'table' || !b.tags.label) continue;
        put(`b${b.id}`, b.tags.label, b.tags.labelColor, g.worldPos(b.x, b.z, b.r * 2.6 + 0.02));
      }
      for (const p of g.physics.pockets) {
        if (!p.label) continue;
        put(`p${p.index}`, p.label, p.labelColor, g.worldPos(p.x, p.z, 0.06), true);
      }
    }
    for (const [k, el] of this.labelEls) if (!seen.has(k)) { el.remove(); this.labelEls.delete(k); }
  },

  // ------------------------------------------------------- table states
  stateBanner(st, left, go) {
    const g = this.g;
    const el = h('div', 'screen state-screen');
    el.style.setProperty('--sc', st.color);
    el.innerHTML = `<div class="state-banner"><div class="sk">${glyphHTML('state')} TABLE STATE ${glyphHTML('state')}</div><div class="st">${st.name}</div><div class="sj">${st.jp}</div><div class="sl"></div><div class="sd">${st.desc}</div><div class="sn">${left} TABLE${left === 1 ? '' : 'S'}</div></div>`;
    g.audio.stateSting(st.id);
    g.screenFlash(st.id === 'blackout' ? 0x000000 : 0xffffff, 0.35);
    g.renderer.fx.glitch = 0.5; g.glitchDecay = true;
    if (st.id === 'blackout') g.blackout = true;
    g.shake(0.3);
    let done = false;
    const fin = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => { this.close(entry); go(); }, 260); };
    const entry = this.open(el, { keys: (c) => { if (c === 'Enter' || c === 'Space' || c === 'Escape') { fin(); return true; } return false; }, click: fin });
    el.addEventListener('click', fin);
    this.type(el.querySelector('.sl'), st.line, 32, 500);
    setTimeout(fin, 4200);
  },

  // ---------------------------------------------------------- contracts
  contractOffer(list, cb) {
    const g = this.g;
    const el = h('div', 'screen dim');
    el.innerHTML = `<div class="title-bar chrome">A CONTRACT</div><div class="title-jp">契約</div><div class="hint" style="margin:0 0 calc(var(--px)*6)">OPTIONAL · ONE AT A TIME · SIGN ONE, OR PLAY CLEAN</div><div class="row cards"></div><div style="margin-top:calc(var(--px)*8)"><button class="btn small">NO CONTRACT</button></div>`;
    const row = el.querySelector('.row');
    const cards = list.map(c => {
      const card = h('div', 'card panel contract-card');
      card.innerHTML = `<div class="rr" style="color:var(--gold)">${glyphHTML('contract')} CONTRACT</div><div class="big chrome">${c.name}</div><div class="ds">${c.desc}</div><div class="kv"><span>DEADLINE</span><b>${c.until === 'self' ? 'NONE' : 'THIS FLOOR'}</b></div><div class="rew">${glyphHTML('star')} ${c.rewardText}</div>`;
      row.appendChild(card);
      return card;
    });
    const btn = el.querySelector('.btn');
    let done = false;
    const fin = (c) => { if (done) return; done = true; g.audio.ui(c ? 'select' : 'back'); this.close(entry); cb(c); };
    const keys = this.navList([...cards, btn], { horizontal: true, onSelect: (i) => fin(list[i] || null) });
    const entry = this.open(el, { keys: (c) => { if (c === 'Escape') { fin(null); return true; } return keys(c); } });
    g.audio.tone(392, { type: 'square', dur: 0.1, vol: 0.07, filter: 2000 });
    g.audio.tone(523, { t: g.audio.now + 0.1, type: 'square', dur: 0.2, vol: 0.07, filter: 2000 });
  },
  contractLine() {
    const k = this.g.run?.contract;
    if (!k) return '';
    const c = contractById(k.id);
    if (!c) return '';
    return `<div class="contract-line">${glyphHTML('contract')} ${c.name} <b>${Math.min(k.n, c.goal)}/${c.goal}</b></div>`;
  },

  // -------------------------------------------------------- high roller
  highRoller(card, chips, cb) {
    const g = this.g, e = card.enc;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel offer-box roller-box');
    const amounts = [25, 50, 100];
    box.innerHTML = `<div class="offer-k">${glyphHTML('roller')} HIGH ROLLER ${glyphHTML('roller')}</div>
      <div class="title-bar chrome" style="text-align:center">PLACE YOUR BET</div>
      <div class="offer-sub">${this.L(e.def.name)} — ${this.L(e.def.objective({ ...e, progress: 0 }))} · ${e.shots} SHOTS</div>
      <div class="offer-rew"><div>${glyphHTML('check')} WIN: <b>YOUR STAKE BACK, DOUBLED</b> (ALL IN PAYS <b>x2.5</b>)</div><div>${glyphHTML('star')} <b>A MUCH BETTER RELIC</b></div><div class="lose">${glyphHTML('cross')} LOSE: THE STAKE AND A HEART</div></div>
      <div class="roller-have">YOU HAVE ${glyphHTML('chip', 'chip-ico')} <b>${chips}</b></div>
      <div class="offer-btns roller-btns"></div><div class="roller-fine">PLAYED FOR CLUB CHIPS. NOTHING HERE IS REAL MONEY.</div>`;
    el.appendChild(box);
    const row = box.querySelector('.roller-btns');
    const opts = [...amounts.map(a => ({ label: `${a}`, v: a, ok: chips >= a })), { label: `ALL IN (${chips})`, v: 'all', ok: chips >= 5, cls: 'gold' }, { label: 'WALK AWAY', v: 0, ok: true }];
    const btns = opts.map(o => { const b = h('button', `btn ${o.cls || ''}${o.ok ? '' : ' off'}`, o.label); row.appendChild(b); return b; });
    let done = false;
    const fin = (v) => { if (done) return; done = true; g.audio.ui(v ? 'select' : 'back'); this.close(entry); cb(v); };
    const keys = this.navList(btns, { horizontal: true, start: opts.findIndex(o => o.ok), onSelect: (i) => { if (!opts[i].ok) { g.audio.ui('deny'); return; } fin(opts[i].v); } });
    const entry = this.open(el, { keys: (c) => { if (c === 'Escape') { fin(0); return true; } return keys(c); } });
    g.audio.coin(3);
  },

  // ------------------------------------------------------------ rivals
  rivalTurn(e, k) {
    const rv = e.rivalDef;
    if (!rv) return;
    const txt = rv.hidden ? `${rv.name} TAKES A SHOT` : k > 0 ? `${rv.name} SINKS ${k}` : `${rv.name} MISSES`;
    this.popup(this.L(txt), { color: rv.color, scale: k >= 2 ? 1.2 : 0.9 });
    this.updateHUD(true);
  },
  rivalPanel(e) {
    const rv = e.rivalDef;
    if (!rv) return '';
    const hid = rv.hidden && !e.done;
    const pips = Array.from({ length: e.goal }, (_, i) => `<div class="pip${!hid && i < (e.rivalScore || 0) ? ' on rival' : ''}"></div>`).join('');
    return `<div class="rival-panel" style="--rc:${rv.color}"><div class="rn">${e.nemesis ? 'NEMESIS · ' : ''}${rv.name}</div><div class="pips">${hid ? '<span class="rq">? ? ?</span>' : pips}</div></div>`;
  },

  // ---------------------------------------------------------- synergies
  synergyDiscovered(s) {
    const el = h('div', 'syn-found');
    const icons = (s.relics || []).map(k => k.split('|').find(x => this.g.hasRelic(x)) || k.split('|')[0]);
    el.innerHTML = `<div class="sk">${glyphHTML('syn')} SYNERGY DISCOVERED ${glyphHTML('syn')}</div><div class="icons"></div><div class="sn">${s.name}</div><div class="sd">${s.desc}</div>`;
    const ic = el.querySelector('.icons');
    if (icons.length) icons.forEach((id, i) => { if (i) ic.insertAdjacentHTML('beforeend', '<span class="plus">+</span>'); const r = relicById(id); ic.appendChild(relicIcon(id, r ? RARITY[r.rarity].color : '#ffc21c')); });
    else ic.appendChild(relicIcon('demon_chalk', RARITY.cursed.color));
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  },

  // -------------------------------------------------------- commentary
  comment(text) {
    const el = h('div', 'comment', `<span>${this.L(text)}</span>`);
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  },

  // --------------------------------------------------- closing time
  async afterhoursIntro(cb) {
    const g = this.g;
    this.closeAll();
    const el = h('div', 'screen after-intro');
    el.innerHTML = `<div class="ai-line l1"></div><div class="ai-clock">03:77</div><div class="ai-line l2"></div><div class="ai-line l3"></div>`;
    const entry = this.open(el, {});
    g.camMode = 'menu';
    g.audio.playMusic('none');
    this.type(el.querySelector('.l1'), 'THE HOUSE HAS FALLEN.', 45, 300);
    await wait(2200);
    g.audio.lightsOff();
    g.lampTarget = 0;
    g.accentTarget = 0.1;
    g.renderer.fx.glitch = 0.4; g.glitchDecay = true;
    await wait(900);
    el.querySelector('.ai-clock').classList.add('on');
    g.audio.tone(55, { type: 'sine', dur: 2.2, vol: 0.3, slide: 52 });
    await wait(1600);
    this.type(el.querySelector('.l2'), 'THE CLUB IS CLOSED.', 45);
    await wait(1600);
    this.type(el.querySelector('.l3'), 'YOU ARE STILL HERE.', 55);
    await wait(2400);
    g.audio.doorLock();
    el.classList.add('out');
    await wait(500);
    this.close(entry);
    g.lampTarget = 0.6;
    g.accentTarget = 0.35;
    this.transition(() => { cb(); });
  },
  async ownerIntro(def, go) {
    const g = this.g;
    const el = h('div', 'screen letterbox owner-intro');
    el.innerHTML = `<div class="boss-name chrome" style="opacity:0">${def.name}</div><div class="boss-jp" style="color:${def.color};opacity:0">${def.jp}</div><div class="boss-intro shadow"></div><div class="hint" style="opacity:0">${def.blurb}</div>`;
    let skip = false;
    const entry = this.open(el, { keys: () => { skip = true; return true; }, click: () => { skip = true; } });
    const step = async (ms) => { const t0 = performance.now(); while (!skip && performance.now() - t0 < ms) await wait(50); };
    g.audio.playMusic('none');
    await step(600);
    g.audio.doorLock();
    await step(900);
    g.audio.lightsOff();
    g.lights.lampMul = 0; g.lampTarget = 0; g.accentTarget = 0;
    await step(1200);
    g.lampTarget = 0.45;
    g.audio.tone(1760, { type: 'sine', dur: 0.05, vol: 0.05 });
    el.querySelector('.boss-name').style.opacity = 1;
    el.querySelector('.boss-jp').style.opacity = 1;
    await step(900);
    this.type(el.querySelector('.boss-intro'), def.intro, 90);
    el.querySelector('.hint').style.opacity = 1;
    await step(2600);
    this.close(entry);
    g.accentTarget = 0.25;
    g.lampTarget = 0.8;
    g.audio.bossStinger();
    go();
  },

  // ------------------------------------------ the arcade machine (RAJIS)
  // The machine. Coins drop, nothing happens, then everything happens at once.
  async rajisFound(cb) {
    const g = this.g, R = g.renderer;
    this.closeAll();
    const el = h('div', 'screen rj-found');
    el.innerHTML = `<div class="rjf-warn">${glyphHTML('warn')} MISSILE WARNING ${glyphHTML('warn')}</div><div class="rjf-crt">RAJIS PROTOCOL DETECTED</div><div class="rjf-text"></div><div class="rjf-sub"></div>`;
    const entry = this.open(el, {});
    g.audio.playMusic('none');
    // the screen flickers…
    g.audio.staticBurst(0.4, 0.08);
    for (let i = 0; i < 8; i++) { R.fx.glitch = 0.2 + Math.random() * 0.4; await wait(60); }
    R.fx.glitch = 0;
    // …then nothing, for about a second
    await wait(1100);
    // missile warning, red lights, every CRT in the room
    g.audio.siren(2.2);
    el.classList.add('alarm');
    g.tintLights?.('#ff1a10', 0.85);
    g.accentTarget = 0.3;
    takeOverScreens(['RAJIS', 'PROTOCOL', 'DETECTED'], 2400);
    for (let i = 0; i < 5; i++) { g.screenFlash(0xff1010, 0.35); await wait(420); }
    // hard cut to black
    el.classList.remove('alarm'); el.classList.add('black');
    g.audio.lightsOff();
    await wait(900);
    this.type(el.querySelector('.rjf-text'), 'WHAT THE HELL?', 55);
    await wait(1700);
    const d = g.meta.data;
    d.rajis.found = true;
    d.rajis.how = d.rajis.how || 'arcade';
    g.meta.save();
    g.achieve('rajis_found');
    this.type(el.querySelector('.rjf-sub'), 'SOMETHING IS WAITING ON THE MAIN MENU.', 28);
    await wait(2600);
    g.tintLights?.(null);
    g.accentTarget = 1;
    this.close(entry);
    g.audio.playMusic(g.run?.after ? 'afterhours' : g.run ? 'shop' : 'menu');
    cb();
  },

  // a small missile-warning sign, for half a second, in the corner (a clue)
  missileGlyph() {
    const el = h('div', 'rj-glyph', `${glyphHTML('warn')}`);
    this.root.appendChild(el);
    this.g.audio.tone(1760, { type: 'square', dur: 0.04, vol: 0.02, filter: 5000 });
    setTimeout(() => el.remove(), 520);
  },

  // ------------------------------------------------------ RAJIS: menus
  // The menu freezes, the music stops, a beep, red, UNKNOWN PROTOCOL, the
  // missile warning, black, one heavy hit: RAJIS. About four seconds.
  async rajisEnter() {
    const g = this.g, R = g.renderer;
    if (g.state === 'transition') return;
    g.state = 'transition';
    this.stack.forEach(s => s.el.classList.add('frozen'));
    g.audio.playMusic('none');
    await wait(250);
    g.audio.radarPing();
    await wait(450);
    for (let i = 0; i < 2; i++) { g.screenFlash(0xff1010, 0.45); await wait(160); }
    this.closeAll();
    const el = h('div', 'screen rj-enter');
    el.innerHTML = '<div class="rje-a">UNKNOWN PROTOCOL</div><div class="rje-b">MISSILE WARNING</div><div class="rje-logo">RAJIS</div>';
    const entry = this.open(el, {});
    takeOverScreens(['UNKNOWN', 'PROTOCOL'], 1400);
    g.audio.staticBurst(0.3, 0.06);
    await wait(700);
    el.classList.add('warn');
    g.audio.siren(1.2);
    await wait(1100);
    el.classList.add('black');
    R.fade = 1;
    await wait(420);
    g.audio.explosion(1.6);
    g.audio.tone(42, { type: 'sine', dur: 1.4, vol: 0.5, slide: 28 });
    g.shake(0.4);
    el.classList.add('logo');
    this.setRajis(true);
    g.rajisTheme('command');
    g.setupMenuTable();
    await wait(1100);
    g.audio.playMusic('rajis');
    this.close(entry);
    for (let k = 0; k <= 10; k++) { R.fade = 1 - k / 10; await wait(35); }
    R.fade = 0;
    // the first time in, the staff introduce themselves
    const d = g.meta.data;
    if (!d.rajis.metStaff) { d.rajis.metStaff = true; g.meta.save(); this.rajisRollCall(() => this.showRajisMenu()); return; }
    this.showRajisMenu();
  },

  // COMMAND STAFF: four faces, four lines, one after another
  rajisRollCall(cb) {
    const g = this.g;
    this.closeAll();
    g.state = 'menu';
    const el = h('div', 'screen dim rj-roll');
    el.innerHTML = `<div class="rj-k">${glyphHTML('radar')} COMMAND STAFF ${glyphHTML('radar')}</div><div class="title-bar chrome">THEY RUN THIS WAR</div><div class="rr-row"></div><div class="hint">CLICK TO REPORT FOR DUTY</div>`;
    const row = el.querySelector('.rr-row');
    STAFF_ORDER.forEach((id, i) => {
      const S = STAFF[id];
      const c = h('div', 'rs-card big', `<div class="rs-face"></div><div class="rs-n" style="color:${S.color}">${S.name}</div><div class="rs-t">${S.title}</div><div class="rs-l"></div>`);
      c.querySelector('.rs-face').appendChild(portraitIcon(id));
      c.style.animationDelay = `${i * 0.45}s`;
      row.appendChild(c);
      setTimeout(() => { if (el.isConnected) { g.audio.radarPing(); this.type(c.querySelector('.rs-l'), `"${S.hello}"`, 18); } }, 200 + i * 450);
    });
    let done = false, ready = false;
    setTimeout(() => { ready = true; }, 1200);
    const fin = () => { if (done || !ready) return; done = true; g.audio.ui('select'); this.close(entry); cb(); };
    const entry = this.open(el, { keys: () => { fin(); return true; }, click: fin });
    el.addEventListener('click', fin);
  },

  rajisStaff(id) { return STAFF[id]; },

  // a word on the radio from one of the staff (bottom left, a few seconds)
  rajisComms(id, text, ms = 4200) {
    const S = STAFF[id];
    if (!S) return;
    this.root.querySelectorAll('.rj-comms').forEach(n => n.remove());
    const el = h('div', 'rj-comms', `<div class="rc-face"></div><div><div class="rc-n" style="color:${S.color}">${S.name} <span>· ${S.title}</span></div><div class="rc-l"></div></div>`);
    el.querySelector('.rc-face').appendChild(portraitIcon(id));
    this.root.appendChild(el);
    this.type(el.querySelector('.rc-l'), `"${text}"`, 20);
    this.g.audio.radarPing();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
  },
  async rajisExit() {
    const g = this.g, R = g.renderer;
    g.state = 'transition';
    this.closeAll();
    const el = h('div', 'screen rj-boot');
    el.innerHTML = '<div class="rjb-text">SIGNAL LOST</div>';
    const entry = this.open(el, {});
    g.audio.staticBurst(0.6, 0.14);
    for (let i = 0; i < 10; i++) { R.fx.statik = 0.3 + Math.random() * 0.6; await wait(60); }
    R.fx.statik = 0;
    this.close(entry);
    this.setRajis(false);
    g.toMenu();
  },
  showRajisMenu() {
    const g = this.g, d = g.meta.data, R0 = d.rajis;
    this.closeAll();
    this.setRajis(true);
    g.state = 'menu';
    g.camMode = 'menu';
    if (!g.theme?.id?.startsWith('rajis_')) { g.rajisTheme('command'); g.setupMenuTable(); }
    g.audio.playMusic('rajis');
    const saved = g.hasSavedRun() && g.meta.data.savedRun?.mode === 'rajis' ? g.meta.data.savedRun : null;
    const el = h('div', 'screen dim2 rj-menu');
    el.innerHTML = `<div class="rj-logo">RAJIS</div><div class="rj-sub">COMMAND ACCESS · OPERATOR LV ${d.level}</div><div class="menu"></div>
      <div class="rj-staff">${STAFF_ORDER.map(id => `<div class="rs-card" data-id="${id}"><div class="rs-face"></div><div class="rs-n" style="color:${STAFF[id].color}">${STAFF[id].name}</div><div class="rs-t">${STAFF[id].title}</div><div class="rs-s">${R0.bosses?.[id] ? `DEFEATED ×${R0.bosses[id]}` : 'UNDEFEATED'}</div></div>`).join('')}</div>
      <div class="rj-stats">OPERATIONS ${R0.runs || 0} · COMPLETED ${R0.clears || 0}${R0.fastest ? ' · FASTEST ' + clock(R0.fastest) : ''}${R0.best ? ' · BEST ' + fmt(R0.best) : ''}</div>`;
    el.querySelectorAll('.rs-card').forEach(c => c.querySelector('.rs-face').appendChild(portraitIcon(c.dataset.id)));
    const menu = el.querySelector('.menu');
    const defs = [
      saved ? ['CONTINUE OPERATION', `OPERATION ${saved.op || '—'} · STOP ${saved.node + 1}/${saved.nodes?.length || 8}`, () => { this.close(entry); this.transition(() => g.continueSavedRun()); }] : null,
      ['START OPERATION', `8 STOPS · 2 BOSSES · RAJIS CORE${saved ? ' · REPLACES THE ONE IN PROGRESS' : ''}`, () => { this.close(entry); this.transition(() => g.startRun({ mode: 'rajis' })); }],
      ['DOSSIER', 'COMMAND STAFF · PROTOCOLS · RECORDS', () => this.showRajisDossier()],
      ['RETURN TO THE CLUB', 'SIGNAL WILL BE LOST', () => this.rajisExit()],
    ].filter(Boolean);
    const items = defs.map(([t, s]) => { const m = h('div', 'mi shadow', `${t}<span class="sub">${s}</span>`); menu.appendChild(m); return m; });
    const keys = this.navList(items, { onSelect: (i) => { g.audio.ui('select'); defs[i][2](); } });
    const entry = this.open(el, { keys: (c) => { if (c === 'Escape') { this.rajisExit(); return true; } return keys(c); } });
  },
  showRajisDossier() {
    const g = this.g, d = g.meta.data;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel wide');
    box.innerHTML = `<div class="title-bar chrome">DOSSIER</div><div class="title-jp">機密</div><div class="tabs"></div><div class="scroll"><div class="grid"></div></div><div class="foot"><span class="hint"></span><button class="btn small">BACK</button></div>`;
    el.appendChild(box);
    const tabs = box.querySelector('.tabs'), grid = box.querySelector('.grid'), hint = box.querySelector('.hint');
    const NAMES = ['COMMAND STAFF', 'PROTOCOLS', 'RECORDS'];
    let tab = 0;
    const render = () => {
      tabs.innerHTML = '';
      NAMES.forEach((n, i) => { const t = h('div', 'tab' + (i === tab ? ' sel' : ''), n); t.onclick = () => { tab = i; g.audio.ui('move'); render(); }; tabs.appendChild(t); });
      grid.innerHTML = ''; grid.style.display = 'grid';
      if (tab === 0) {
        const all = [...RAJIS_ORDER, 'core', 'paulyamin'].map(id => RAJIS_BOSSES[id]);
        hint.textContent = `DEFEATED ${all.filter(b => d.rajis.bosses?.[b.id]).length} / ${all.length}`;
        for (const b of all) {
          const n = d.rajis.bosses?.[b.id] || 0;
          if (b.secret && !n) continue;
          const o = h('div', 'opt' + (n ? ' sel' : ''));
          o.appendChild(portraitIcon(b.id));
          o.insertAdjacentHTML('beforeend', `<div class="nm" style="color:${b.color}">${b.name}</div><div class="ds"><span style="color:var(--cyan)">${b.title}</span><br>${b.blurb}<br><span style="color:${n ? 'var(--green)' : 'var(--dim)'}">${n ? `DEFEATED ${n}x` : 'UNDEFEATED'}</span></div>`);
          grid.appendChild(o);
        }
      } else if (tab === 1) {
        hint.textContent = `FOUND ${PROTOCOLS.filter(r => d.seenRelics[r.id]).length} / ${PROTOCOLS.length}`;
        for (const r of PROTOCOLS) {
          const sn = d.seenRelics[r.id];
          const o = h('div', 'opt');
          o.appendChild(relicIcon(r.id, RARITY[r.rarity].color, !sn));
          o.appendChild(h('div', 'nm', sn ? r.name : '???'));
          o.appendChild(h('div', 'ds', `<span style="color:${RARITY[r.rarity].color}">${RARITY[r.rarity].name}</span><br>${sn ? r.desc : 'Not yet issued.'}`));
          grid.appendChild(o);
        }
      } else {
        hint.textContent = '';
        grid.style.display = 'block';
        const R0 = d.rajis;
        const rows = [['OPERATIONS STARTED', R0.runs || 0], ['OPERATIONS COMPLETED', R0.clears || 0], ['FASTEST OPERATION', R0.fastest ? clock(R0.fastest) : '—'], ['BEST SCORE', fmt(R0.best || 0)]];
        const ach = ACHIEVEMENTS.filter(a => a.rajis);
        grid.innerHTML = `<div class="section-h">SERVICE RECORD</div><div class="stats">${rows.map(([k, v]) => `<div>${k}</div><div class="v">${v}</div>`).join('')}</div><div class="section-h">COMMENDATIONS</div>`;
        const wrap = h('div', 'grid');
        for (const a of ach) {
          const got = d.achievements[a.id];
          const o = h('div', 'opt' + (got ? ' sel' : ''));
          o.appendChild(achIcon(got ? a.id : 'secret', !!got));
          o.insertAdjacentHTML('beforeend', `<div class="nm" style="color:${got ? 'var(--gold)' : 'var(--dim)'}">${got ? a.name : '???'}</div><div class="ds">${got ? a.desc : 'Classified.'}${a.reward && got ? `<br><span style="color:var(--cyan)">UNLOCKED ${a.reward}</span>` : ''}</div>`);
          wrap.appendChild(o);
        }
        grid.appendChild(wrap);
      }
    };
    render();
    const back = () => { g.audio.ui('back'); this.close(entry); };
    box.querySelector('.btn').onclick = back;
    const entry = this.open(el, { keys: (c) => { if (c === 'Escape' || c === 'Backspace') { back(); return true; } if (c === 'ArrowRight' || c === 'KeyE') { tab = (tab + 1) % NAMES.length; render(); return true; } if (c === 'ArrowLeft' || c === 'KeyQ') { tab = (tab + NAMES.length - 1) % NAMES.length; render(); return true; } return false; } });
  },
  rajisBriefing(run, cb) {
    const g = this.g;
    const el = h('div', 'screen dim rj-brief');
    const label = (n, i) => n.type === 'table' ? `MISSION · ${LOCATIONS[n.loc]?.name || ''} <small>ISSUED BY ${STAFF[staffFor(run, i)].name}</small>` : n.type === 'event' ? 'COMMAND · SITUATION' : n.type === 'shop' ? 'COMMAND · REQUISITIONS' : `${n.mini ? 'MINIBOSS' : n.boss === 'core' ? 'FINAL' : 'BOSS'} · ${RAJIS_BOSSES[n.boss].name}${n.boss === 'core' ? ' <small>EVERYONE, AT ONCE</small>' : ''}`;
    el.innerHTML = `<div class="panel rjb-box"><div class="rj-k">${glyphHTML('radar')} BRIEFING ${glyphHTML('radar')}</div><div class="title-bar chrome">OPERATION ${run.op}</div>
      <ol class="rj-route">${run.nodes.map((n, i) => `<li class="${n.type === 'boss' ? 'boss' : ''}">${label(n, i)}</li>`).join('')}</ol>
      <div class="hint">HULL ${run.hearts} · CREDITS ${run.chips} · CLICK TO DEPLOY</div></div>`;
    let done = false;
    const fin = () => { if (done) return; done = true; g.audio.ui('select'); this.close(entry); cb(); };
    const entry = this.open(el, { keys: (c) => { if (c === 'Enter' || c === 'Space') { fin(); return true; } return false; }, click: fin });
    el.addEventListener('click', fin);
    g.audio.radarPing();
  },
  rajisBossIntro(def, e, go) {
    const g = this.g;
    const el = h('div', 'screen letterbox rj-transmission');
    el.innerHTML = `<div class="rjt-k">${glyphHTML('warn')} INCOMING TRANSMISSION ${glyphHTML('warn')}</div><div class="rjt-row"><div class="rjt-face"></div><div><div class="boss-name chrome" style="text-align:left">${def.name}</div><div class="rjt-title" style="color:${def.color}">${def.title}</div></div></div><div class="rjt-lines"></div><div class="hint">${def.blurb}</div>`;
    el.querySelector('.rjt-face').appendChild(portraitIcon(def.id));
    if (def.id === 'core') {
      const row = h('div', 'rjt-all');
      STAFF_ORDER.forEach((id, i) => { const c = h('div', 'rs-card mini', `<div class="rs-n" style="color:${STAFF[id].color}">${STAFF[id].name}</div>`); c.prepend(portraitIcon(id)); c.style.animationDelay = `${0.15 + i * 0.18}s`; row.appendChild(c); });
      el.querySelector('.rjt-row').after(row);
    }
    g.audio.siren(1.2);
    g.lights.lampMul = 0;
    g.room.alarm = true;
    let done = false;
    const fin = () => {
      if (done) return; done = true;
      this.close(entry);
      g.room.alarm = false;
      g.lights.lampMul = 0.3;
      g.screenFlash(0xff2010, 0.4);
      g.shake(0.5);
      g.audio.explosion(1.2);
      go();
    };
    const entry = this.open(el, { keys: () => { fin(); return true; }, click: fin });
    el.addEventListener('click', fin);
    const lines = el.querySelector('.rjt-lines');
    def.intro.forEach((t, i) => setTimeout(() => { const l = h('div', 'rjt-line'); lines.appendChild(l); this.type(l, t, 34); }, 900 + i * 1500));
    setTimeout(fin, 1600 + def.intro.length * 1500 + 1200);
  },
  rajisSignal(cb) {
    const g = this.g;
    const el = h('div', 'screen dim');
    el.innerHTML = `<div class="panel event-box" style="text-align:center"><div class="rj-k">${glyphHTML('radar')} ANOMALOUS SIGNAL ${glyphHTML('radar')}</div><div class="event-title chrome">SOMETHING ELSE IS ON THIS CHANNEL.</div><div class="event-text">It is using your voice.</div><div class="menu"></div></div>`;
    const menu = el.querySelector('.menu');
    const items = ['ENGAGE', 'RETURN TO BASE'].map(t => { const m = h('div', 'mi shadow', t); menu.appendChild(m); return m; });
    let done = false;
    const keys = this.navList(items, { onSelect: (i) => { if (done) return; done = true; g.audio.ui('select'); this.close(entry); cb(i === 0); } });
    const entry = this.open(el, { keys });
    g.audio.radarPing();
  },
  cyberWarning() {
    const el = h('div', 'cyber-warn', `<div class="track"><span class="car"></span></div><div class="cw">CYBER BULLET INBOUND</div>`);
    el.querySelector('.car').appendChild(glyph('car'));
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  },
  rajisEnd({ won, run, xp, lvl }, done) {
    const g = this.g;
    this.closeAll();
    const el = h('div', 'screen dim');
    const box = h('div', 'panel runend-box');
    box.innerHTML = `<div class="go-title chrome">${won ? 'OPERATION COMPLETE' : 'OPERATION FAILED'}</div><div class="title-jp" style="text-align:center">${won ? '任務完了' : '任務失敗'}</div>
      <div class="stats" style="max-width:calc(var(--px)*220);margin-left:auto;margin-right:auto">
        <div>OPERATION</div><div class="v">${run.op}</div>
        <div>SCORE</div><div class="v">${fmt(run.score)}</div>
        <div>MISSIONS</div><div class="v">${run.stats.tables}</div>
        <div>TARGETS NEUTRALISED</div><div class="v">${run.stats.bosses}</div>
        <div>BEST STRIKE</div><div class="v">${this.L(run.stats.bestShotLabel || '—')} · ${fmt(run.stats.bestShot)}</div>
        <div>TIME</div><div class="v">${clock(run.time || 0)}</div>
        ${run.twoOfAKind ? '<div>SIGNAL</div><div class="v" style="color:#c0a0ff">TWO OF A KIND</div>' : ''}
      </div>
      <div class="lvl">LV ${lvl.to} <span style="font-size:calc(var(--px)*4);color:var(--cyan)">+${fmt(xp)} XP</span></div>
      <div class="runend-btns"><button class="btn gold again">NEW OPERATION</button><button class="btn menu-btn">COMMAND MENU</button></div>`;
    el.appendChild(box);
    let left = false;
    const fin = (again) => {
      if (left) return; left = true;
      g.audio.ui('select'); this.close(entry);
      this.transition(() => { done(); if (again) { this.closeAll(); g.startRun({ mode: 'rajis' }); } });
    };
    box.querySelector('.again').onclick = (e) => { e.stopPropagation(); fin(true); };
    box.querySelector('.menu-btn').onclick = (e) => { e.stopPropagation(); fin(false); };
    const entry = this.open(el, { keys: (c) => { if (c === 'Enter') { fin(true); return true; } if (c === 'Escape') { fin(false); return true; } return false; } });
    if (!won) g.audio.fail(); else g.audio.win();
  },

  // ------------------------------------------------------------- modes
  showModes() {
    const g = this.g, d = g.meta.data, B = d.bests;
    const el = h('div', 'screen dim');
    el.innerHTML = `<div class="title-bar chrome">MODES</div><div class="title-jp">モード</div><div class="menu"></div><div class="hint">MODES ARE THEIR OWN RUNS · RECORDS ARE KEPT SEPARATELY</div>`;
    const menu = el.querySelector('.menu');
    const busy = g.suspended || g.hasSavedRun();
    const warn = busy ? '<span class="warnline">STARTS OVER · YOUR RUN IN PROGRESS WILL BE LOST</span>' : '';
    const MODES = [
      { id: 'bossrush', name: 'BOSS RUSH', gate: 'bossrush', need: 'WIN 3 RUNS OR BEAT 5 DIFFERENT BOSSES', sub: B.bossRushTime ? `BEST TIME ${clock(B.bossRushTime)} · BEST SCORE ${fmt(B.bossRushScore || 0)}` : 'EVERY BOSS, BACK TO BACK · 5 HEARTS' },
      { id: 'onecue', name: 'ONE CUE', gate: 'onecue', need: 'WIN A RUN', sub: B.oneCueBest ? `BEST ${fmt(B.oneCueBest)}` : 'NO SHOT LIMIT · 5 LIVES · EVERY MISS COSTS ONE' },
      { id: 'chaos', name: 'CHAOS', gate: 'chaos', need: 'WIN 2 RUNS OR REACH HEAT V', sub: B.chaosBest ? `BEST ${fmt(B.chaosBest)}` : '3 RANDOM RELICS · HEAT III · A TABLE STATE AT EVERY TURN' },
    ];
    const items = [];
    for (const m of MODES) {
      const ok = g.gate(m.gate);
      const it = h('div', 'mi shadow' + (ok ? '' : ' disabled'), ok ? `${m.name}<span class="sub">${m.sub}</span>${warn}` : `???<span class="sub">${glyphHTML('lock')} ${m.need}</span>`);
      menu.appendChild(it); items.push(it);
    }
    const back = h('div', 'mi shadow', 'BACK'); menu.appendChild(back); items.push(back);
    let entry;
    const keys = this.navList(items, {
      onSelect: (i) => {
        if (i >= MODES.length) { g.audio.ui('back'); this.close(entry); return; }
        if (!g.gate(MODES[i].gate)) { g.audio.ui('deny'); return; }
        g.audio.ui('select');
        this.closeAll();
        g.suspended = null;
        this.transition(() => g.startRun({ mode: MODES[i].id }));
      },
    });
    entry = this.open(el, { keys: (c) => { if (c === 'Escape' || c === 'Backspace') { g.audio.ui('back'); this.close(entry); return true; } return keys(c); } });
  },
  showHandicaps(onChange) {
    const g = this.g, d = g.meta.data;
    d.handSel = Array.isArray(d.handSel) ? d.handSel : [];
    const el = h('div', 'screen dim');
    const box = h('div', 'panel settings-box');
    box.innerHTML = `<div class="title-bar chrome">HANDICAPS</div><div class="title-jp">ハンデ</div><div class="hint" style="margin:0 0 calc(var(--px)*4)">MAKE THE NEXT NEW RUN HARDER · SCORE AND PURSES PAY MORE</div><div class="rows scroll"></div><div class="foot"><span class="hint mulv"></span><button class="btn small">DONE</button></div>`;
    el.appendChild(box);
    const rows = box.querySelector('.rows'), mulv = box.querySelector('.mulv');
    let rowEls = [];
    const draw = () => {
      rows.innerHTML = '';
      rowEls = HANDICAPS.map(hc => {
        const on = d.handSel.includes(hc.id);
        const r = h('div', 'set-row', `<span class="nm">${hc.name}<small>${hc.desc}</small></span><span class="val">${on ? `<span style="color:var(--green)">ON</span>` : '<span style="color:var(--dim)">OFF</span>'} <span style="color:var(--gold)">+${Math.round(hc.bonus * 100)}%</span></span>`);
        rows.appendChild(r);
        return r;
      });
      mulv.textContent = `REWARD x${handicapMul(d.handSel).toFixed(2)}`;
      keysNav = this.navList(rowEls, { start: cur, onSelect: (i) => toggle(i), onMove: (i) => { cur = i; } });
    };
    let cur = 0, keysNav = null;
    const toggle = (i) => {
      const id = HANDICAPS[i].id;
      d.handSel = d.handSel.includes(id) ? d.handSel.filter(x => x !== id) : [...d.handSel, id];
      g.meta.save(); g.audio.ui('move'); cur = i; draw(); onChange?.();
    };
    draw();
    const back = () => { g.audio.ui('back'); this.close(entry); onChange?.(); };
    box.querySelector('.btn').onclick = back;
    const entry = this.open(el, { keys: (c) => { if (c === 'Escape' || c === 'Backspace') { back(); return true; } return keysNav(c); } });
  },

  // ------------------------------------------------ title screen secrets
  titleBreak() {
    const g = this.g;
    g.audio.explosion(1.4);
    g.audio.crowd?.(0.6);
    g.shake(0.8);
    g.screenFlash(0xffffff, 0.3);
    for (const b of g.physics.balls) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3;
      b.vx = Math.cos(a) * sp; b.vz = Math.sin(a) * sp;
      g.fx.burst(b.x, 0.05, b.z, [0xffffff, 0xffe23b, 0x2bf0ff], 12, 1.4, { life: 0.5 });
    }
    g.table.sway += 1.2;
    this.popup('BREAK!', { color: '#ffe23b', scale: 2.2 });
    const d = g.meta.data;
    if (!d.secrets.break) { d.secrets.break = 1; g.meta.save(); this.toast('YOU FOUND A SECRET', '#9a4bff', 'THE TITLE SCREEN'); }
    setTimeout(() => { if (g.state === 'title') g.setupMenuTable(); }, 4500);
  },
  titleClock(el) {
    const g = this.g, d = g.meta.data;
    const sub = el.querySelector('.logo-sub');
    const was = sub.textContent;
    sub.textContent = '03:77';
    sub.style.color = '#c01818';
    g.renderer.fx.glitch = 0.6; g.glitchDecay = true;
    g.audio.tone(55, { type: 'sine', dur: 2, vol: 0.3, slide: 50 });
    g.audio.tick();
    setTimeout(() => { sub.textContent = was; sub.style.color = ''; }, 2200);
    g.achieve('insomniac');
    this.toast(d.afterhours?.found ? 'THE OWNER IS WAITING' : 'IT IS LATER THAN YOU THINK', '#c01818', '03:77');
    if (!d.secrets.clock) { d.secrets.clock = 1; g.meta.save(); }
  },

  // ------------------------------------------ progressive discovery
  // new parts of the club are announced once, the first time they open
  announceUnlocks() {
    const g = this.g, d = g.meta.data;
    const news = [
      ['newtables', 'CONTRACTS, RIVALS, HIGH ROLLERS AND NEW TABLES', 'THE CLUB OPENS UP'],
      ['onecue', 'ONE CUE · HANDICAPS · IN THE PLAY MENU', 'NEW WAYS TO PLAY'],
      ['states', 'THE CLUB HAS MOODS NOW. YOU WILL SEE.', 'TABLE STATES'],
      ['chaos', 'CHAOS MODE · IN PLAY → MODES', 'NEW MODE'],
      ['bossrush', 'BOSS RUSH · IN PLAY → MODES', 'NEW MODE'],
    ];
    let k = 0;
    for (const [feat, text, kind] of news) {
      if (d.announced[feat] || !g.meta.unlocked(feat)) continue;
      d.announced[feat] = Date.now();
      setTimeout(() => this.toast(text, '#ffc21c', kind), 600 + k++ * 1400);
    }
    if (k) g.meta.save();
  },

  // ----------------------------------------------------- run history
  historyRow(r) {
    const when = new Date(r.at);
    const date = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
    const mode = { daily: 'DAILY', endless: 'ENDLESS', bossrush: 'BOSS RUSH', onecue: 'ONE CUE', chaos: 'CHAOS', rajis: 'RAJIS' }[r.mode] || (r.breakLv ? `BREAK ${r.breakLv}` : 'RUN');
    return { date, mode, res: r.after && r.won ? 'CLOSING TIME' : r.won ? 'WON' : `FLOOR ${r.floor}` };
  },
  showBuild(r) {
    const g = this.g;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel event-box');
    const x = this.historyRow(r);
    box.innerHTML = `<div class="rr" style="font-size:calc(var(--px)*4);color:var(--cyan);letter-spacing:0.3em">${x.date} · ${x.mode}</div><div class="event-title chrome">${r.build || 'NO NAME YET'}</div>
      <div class="stats" style="margin:calc(var(--px)*4) 0"><div>RESULT</div><div class="v">${x.res}</div><div>SCORE</div><div class="v">${fmt(r.score)}</div><div>GRADE</div><div class="v">${r.grade}</div><div>HEAT</div><div class="v">${ROMAN[r.heat || 0]}</div><div>TIME</div><div class="v">${clock(r.time || 0)}</div><div>BEST SHOT</div><div class="v">${r.bestLabel || '—'} · ${fmt(r.best || 0)}</div></div>
      <div class="build-relics"></div><div style="text-align:center;margin-top:calc(var(--px)*6)"><button class="btn small">BACK</button></div>`;
    el.appendChild(box);
    const wrap = box.querySelector('.build-relics');
    for (const id of r.relics || []) {
      const rel = relicById(id);
      if (!rel) continue;
      const c = h('div', 'relic');
      c.appendChild(relicIcon(id, RARITY[rel.rarity].color));
      this.tooltip(c, () => `<div class="t" style="color:${RARITY[rel.rarity].color}">${rel.name}</div>${rel.desc}`);
      wrap.appendChild(c);
    }
    if (!wrap.children.length) wrap.innerHTML = '<span class="hint">NO RELICS</span>';
    let entry;
    const back = () => { g.audio.ui('back'); this.close(entry); };
    box.querySelector('.btn').onclick = (e) => { e.stopPropagation(); back(); };
    entry = this.open(el, { keys: (c) => { if (c === 'Escape' || c === 'Backspace' || c === 'Enter') { back(); return true; } return false; } });
  },

  // -------------------------------------------------- shot of the run
  shotCard(best) {
    if (!best) return '';
    const techs = best.techs.length ? best.techs.join(' · ') : `${best.balls}-BALL POT`;
    return `<div class="shot-card"><div class="sk">${glyphHTML('star')} SHOT OF THE RUN</div><div class="sv chrome">${fmt(best.total)}</div><div class="sd">${this.L(techs)}</div><div class="sd dim">${best.balls} BALL${best.balls === 1 ? '' : 'S'} · ${best.cushions} CUSHION${best.cushions === 1 ? '' : 'S'} · ${this.L(best.table)}</div><button class="btn small replay">WATCH IT AGAIN</button></div>`;
  },
  replayShot(best, panel, done) {
    const g = this.g;
    panel.style.visibility = 'hidden';
    const cap = h('div', 'replay-cap', `<div class="rk">${glyphHTML('star')} SHOT OF THE RUN</div><div class="rv">${fmt(best.total)}</div><div class="rt">${this.L(best.techs.join(' · '))}</div>`);
    this.root.appendChild(cap);
    this.root.classList.add('replaying');
    g.playReplay(best.rec, () => {
      cap.remove();
      this.root.classList.remove('replaying');
      panel.style.visibility = '';
      done?.();
    });
  },
};

// the Game side of the replay: recorded positions played back on the real table
export const ReplayMixin = {
  playReplay(rec, onEnd) {
    const saved = { balls: this.physics.balls, obstacles: this.physics.obstacles, cam: this.camMode, state: this.state };
    this.replaying = true;
    this.physics.balls = [];
    this.physics.obstacles = [];
    const map = new Map();
    for (const x of rec.balls) { const b = this.physics.addBall(x.num, 0, 0); b.kind = x.kind; b.r = x.r || b.r; b.state = 'pocketed'; map.set(x.id, b); }
    this.ballView.prune();
    this.ballView.syncObstacles();
    this.camMode = 'showcase';
    this.state = 'replay';
    let t = 0;
    const F = rec.frames;
    const apply = (k) => {
      const i = Math.min(F.length - 1, Math.floor(k)), j = Math.min(F.length - 1, i + 1), f = k - i;
      const A = F[i], B = F[j];
      const next = new Map();
      for (let n = 0; n < B.length; n += 4) next.set(B[n], n);
      for (const b of map.values()) b.state = 'pocketed';
      for (let n = 0; n < A.length; n += 4) {
        const b = map.get(A[n]);
        if (!b) continue;
        const bn = next.get(A[n]);
        const ax = A[n + 1], az = A[n + 2], ay = A[n + 3];
        const bx = bn != null ? B[bn + 1] : ax, bz = bn != null ? B[bn + 2] : az;
        const dx = bx - ax, dz = bz - az;
        if (ay < 0) continue;
        b.state = 'table';
        b.x = ax + dx * f; b.z = az + dz * f; b.y = Math.max(0, ay);
        b.wx = dz * 30 / b.r; b.wz = -dx * 30 / b.r; b.wy = 0;
      }
    };
    const end = () => {
      this.replayTick = null;
      this.replaying = false;
      this.physics.balls = saved.balls;
      this.physics.obstacles = saved.obstacles;
      this.ballView.prune();
      this.ballView.syncObstacles();
      this.camMode = saved.cam;
      this.state = saved.state;
      onEnd?.();
    };
    this.replayTick = (dt) => {
      t += dt * 30 * 0.6;               // a little slower than it happened
      if (t >= F.length + 30) { end(); return; }
      apply(Math.min(F.length - 1, t));
    };
    apply(0);
  },
};
