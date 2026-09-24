// DOM user interface: title & menus, HUD, popups, cards, shop, events,
// results, loadout, collection and settings. Styled like a 1998 import.

import './style.css';
import { RELICS, RARITY, relicById, MAX_RELICS, TAG_COLORS } from '../game/relics.js';
import { ACHIEVEMENTS, xpForLevel, STARTER_RELICS } from '../game/meta.js';
import { THEMES, BALL_SKINS, CUE_SKINS } from '../game/cosmetics.js';
import { ballColor } from '../config.js';
import { floorName } from '../game/run.js';
import { relicIcon, achIcon, glyph, glyphHTML, glyphURL, setArtMode } from './art.js';
import { STYLE_GRADES, STYLE_COL, ROMAN, HEAT_DESC, styleGrade, styleProgress, heatProgress, stakeText, ANOMALIES, SECRET_ANOMALY } from '../game/mastery.js';
import { BOSSES } from '../game/encounters.js';
import { GAME_VERSION, UPDATE_NAME } from '../game/meta.js';
import { AfterUI } from './AfterUI.js';
import { SYNERGIES, RIVALS, rivalById, buildName, handicapMul } from '../game/afterhours.js';
import { MISSIONS, LOCATIONS } from '../game/rajis.js';

// contextual tips: each shows once, the first time it matters (resettable in Settings)
const TIPS = {
  relics: ['RELICS', 'Relics bend the rules of your run. Stack them: the best runs get ridiculous.'],
  upgrade: ['UPGRADES', 'Picking a relic you already own upgrades it to NAME+.'],
  shop: ['THE SHOP', 'Chips buy relics, items and hearts. You can also SELL a relic you are done with.'],
  event: ['STRANGE EVENTS', 'Things happen between tables. Not every choice is safe.'],
  path: ['THE ROAD FORKS', 'Pick what your run needs. A MYSTERY could be anything.'],
  style: ['STYLE', 'Interesting shots raise your STYLE grade and multiply your score. Repeating easy shots lets it fade.'],
  heat: ['HEAT', 'You are dominating, so the club turns up the HEAT: harder tables, better rewards. Losing a table cools it.'],
  bet: ['DOUBLE OR NOTHING', 'Optional. Keep the condition for double chips. Break it and the table pays nothing.'],
  rival: ['RIVALS', 'A race. After every shot you take, they take theirs. First to the goal wins the table.'],
  roller: ['HIGH ROLLER', 'Bet your own chips on a harder table. Win and they come back doubled.'],
  trick: ['TRICK TABLES', 'A puzzle with three attempts. Losing one costs nothing but the prize.'],
  labels: ['READ THE TABLE', 'Some tables mark balls and pockets. The labels follow them around.'],
  stakes: ['HIGH STAKES', 'One rule you must not break. Break it and the table is lost. Keep it for a much better reward.'],
  boss: ['BOSS TABLES', 'Bosses escalate as you close in. Only a few pots count per shot, so no build can one-shot them.'],
  items: ['ITEMS', 'Press 1, 2 or 3 during a table to use an item.'],
  eight: ['THE 8-BALL', 'The 8 goes last. Sink it early and you lose shots.'],
  anomaly: ['ANOMALY', 'Something is very wrong with this table. The reward is worth it.'],
  scratch: ['SCRATCH', 'Potting the cue ball costs a shot. You place it again anywhere on the table.'],
};

// ------------------------------------------------------------ helpers
function h(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
const fmt = (n) => Math.round(n).toLocaleString('en-US');

function heartIcon(full) { const i = glyph(full ? 'heart' : 'heartOff'); i.classList.add('heart'); return i; }
const CHIP = () => glyphHTML('chip', 'chip-ico');

// little pixel preview of a cosmetic for shop cards
function cosmeticPreview(cos) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16; c.className = 'px-icon';
  const x = c.getContext('2d');
  if (cos.kind === 'ball') {
    const col = cos.item.tex.color || ballColor;
    [[4, 4, 1], [11, 4, 3], [4, 11, 8], [11, 11, 6]].forEach(([cx, cy, n]) => {
      x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, 3.6, 0, 7); x.fill();
      x.fillStyle = col(n); x.beginPath(); x.arc(cx, cy, 3, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.8)'; x.fillRect(cx - 2, cy - 2, 1, 1);
    });
  } else {
    const tmp = document.createElement('canvas'); tmp.width = 16; tmp.height = 256;
    cos.item.paint(tmp.getContext('2d'), 16, 256);
    // lay the cue (texture y = length) along the diagonal
    x.save(); x.translate(1, 15); x.rotate(-Math.PI / 4);
    x.transform(0, 3 / 16, 21 / 256, 0, 0, -1.5);
    x.drawImage(tmp, 0, 0);
    x.restore();
  }
  return c;
}

const QUARTERMASTER = [
  'SIGN HERE. AND HERE. AND ON THE MISSILE.',
  'EVERYTHING IS CLASSIFIED EXCEPT THE PRICES.',
  'THE ROBOT WANTS TO KNOW IF YOU NEED A RECEIPT.',
  'RICHARD ALREADY TOOK THE GOOD ONES.',
  'NO REFUNDS. THIS IS A WAR.',
];

const SHOPKEEP = [
  'WELCOME, WELCOME. NO REFUNDS.',
  'THE CHALK IS FRESH. THE CUES ARE NOT.',
  'YOU LOOK LIKE SOMEONE WHO SCRATCHES.',
  'EVERYTHING HAS A PRICE. MOSTLY CHIPS.',
  'I USED TO PLAY. THEN THE TABLE PLAYED ME.',
  'DON\'T TOUCH THE EIGHT BALL IN THE JAR.',
  'BUY SOMETHING. THE LIGHTS ARE WATCHING.',
];

// --------------------------------------------------------------------- UI
export class UI {
  constructor(game) {
    this.g = game;
    this.root = document.getElementById('ui');
    this.hud = h('div'); this.hud.id = 'hud';
    this.pops = h('div'); this.pops.id = 'pops';
    this.screens = h('div'); this.screens.id = 'screens';
    this.toasts = h('div'); this.toasts.id = 'toasts';
    this.wipe = h('div'); this.wipe.id = 'wipe';
    for (let i = 0; i < 144; i++) { const c = h('i'); c.style.animationDelay = `${((i % 16) + Math.floor(i / 16)) * 0.012}s`; this.wipe.appendChild(c); }
    this.loading = h('div', 'loading', 'NOW LOADING...');
    this.tip = h('div', 'tooltip panel');
    this.root.append(this.hud, this.pops, this.screens, this.toasts, this.wipe, this.loading);
    document.body.appendChild(this.tip);
    this.stack = [];
    this.worldPops = [];
    this.activePops = [];
    this.pauseOpen = false;
    this.buildHUD();
    this.applyScale();
    window.addEventListener('resize', () => this.scale());
    window.matchMedia?.('(resolution: 2dppx)').addEventListener?.('change', () => this.scale());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  // UI units: the layout is authored for a 640x360 "virtual screen". --px is
  // how many CSS pixels one unit gets, snapped to device-pixel steps so the
  // bitmap fonts stay crisp, and never rounded UP (that is what overflowed
  // laptop screens).
  scale() {
    const g = this.g;
    const pref = g?.meta?.s?.uiScale ?? 'auto';
    const W = window.innerWidth, H = window.innerHeight;
    let fit = Math.min(W / 640, H / 360);
    if (pref === 'auto') fit *= W < 1100 ? 0.95 : 1;
    else fit *= +pref;
    const dpr = window.devicePixelRatio || 1;
    const step = dpr >= 2 ? 0.5 : dpr >= 1.5 ? 1 / 1.5 : 1;
    let s = Math.floor(fit / step + 1e-6) * step;
    s = Math.max(W < 560 || H < 330 ? 0.5 : 1, Math.min(5, s));
    const root = document.documentElement;
    root.style.setProperty('--px', `${s}px`);
    root.style.setProperty('--safe', `${(g?.meta?.s?.safe === 'large' ? 20 : 8) * s}px`);
    this.px = s;
  }

  applyScale() {
    this.scale();
    const modern = this.g?.meta?.s?.gfx === 'modern';
    if (this.artModern !== modern) {
      this.artModern = modern;
      setArtMode(modern);
      this.sig = {};                                   // force HUD icons to re-render
      document.documentElement.style.setProperty('--g-arrow', `url(${glyphURL('arrowR')})`);
      if (this.h) this.updateHUD(true);
    }
  }


  // ---------------------------------------------------- screen stack
  open(el, { keys = null, modal = true, click = null } = {}) {
    el.classList.add('ia');
    // only the top screen is shown; covered screens hide so panels don't stack up
    for (const s of this.stack) s.el.style.visibility = 'hidden';
    this.screens.appendChild(el);
    const entry = { el, keys, modal, click };
    this.stack.push(entry);
    return entry;
  }
  close(entry) {
    const i = this.stack.indexOf(entry);
    if (i >= 0) this.stack.splice(i, 1);
    entry.el.remove();
    const top = this.stack[this.stack.length - 1];
    if (top) top.el.style.visibility = '';
  }
  closeAll() { while (this.stack.length) this.close(this.stack[this.stack.length - 1]); }
  modalOpen() { return this.stack.some(s => s.modal) || this.pauseOpen; }
  get clickAdvance() { const top = this.stack[this.stack.length - 1]; return top?.click || null; }

  onKey(e) {
    const top = this.stack[this.stack.length - 1];
    if (top?.keys) {
      const handled = top.keys(e.code === 'NumpadEnter' ? 'Enter' : e.code, e);   // keypad Enter works like Enter
      if (handled) e.preventDefault();
    }
  }

  // keyboard + mouse navigable vertical/horizontal list
  navList(items, { onSelect, horizontal = false, onMove = null, start = -1 } = {}) {
    if (start < 0) start = Math.max(0, items.findIndex(it => !it.classList.contains('disabled')));
    let sel = start;
    const set = (i, sound = true) => {
      sel = (i + items.length) % items.length;
      items.forEach((it, k) => it.classList.toggle('sel', k === sel));
      if (sound) this.g.audio.ui('move');
      onMove?.(sel);
    };
    items.forEach((it, k) => {
      it.addEventListener('mouseenter', () => { if (sel !== k) set(k); });
      it.addEventListener('click', (ev) => { ev.stopPropagation(); set(k, false); onSelect(k); });
    });
    set(start, false);
    return (code) => {
      const prev = horizontal ? ['ArrowLeft', 'KeyA'] : ['ArrowUp', 'KeyW'];
      const next = horizontal ? ['ArrowRight', 'KeyD'] : ['ArrowDown', 'KeyS'];
      if (prev.includes(code)) { set(sel - 1); return true; }
      if (next.includes(code)) { set(sel + 1); return true; }
      if (code === 'Enter' || code === 'Space') { onSelect(sel); return true; }
      return false;
    };
  }

  transition(mid) {
    this.g.audio.whoosh(0.4);
    this.wipe.className = 'in';
    this.loading.classList.add('on');
    setTimeout(() => {
      mid?.();
      setTimeout(() => {
        this.wipe.className = 'out';
        this.loading.classList.remove('on');
        setTimeout(() => { this.wipe.className = ''; }, 420);
      }, 200);
    }, 420);
  }

  // ---------------------------------------------------------- title
  showTitle() {
    const el = h('div', 'screen dim2');
    el.innerHTML = `
      <div class="logo-wrap">
        <div class="logo chrome">SCRATCH</div>
        <div class="logo-8"><span>8</span></div>
        <div class="logo-sub">スクラッチ</div>
        <div class="logo-tag">8-BALL · ROGUE · DELUXE</div>
      </div>
      <div class="press shadow">PRESS ANY BUTTON</div>
      <div class="copyright">© 1998 ZERO CRASH SOFTWARE · LICENSED FOR HOME ENTERTAINMENT ONLY</div>`;
    let done = false;
    const go = () => {
      if (done) return; done = true;
      this.g.audio.init();
      this.g.audio.ui('select');
      this.g.audio.playMusic('menu');
      this.close(entry);
      this.showMainMenu();
    };
    // a few words the title screen answers to
    const SECRETS = { BREAK: () => this.titleBreak(), '0377': () => this.titleClock(el) };
    const CH = { KeyB: 'B', KeyR: 'R', KeyE: 'E', KeyA: 'A', KeyK: 'K', Digit0: '0', Digit3: '3', Digit7: '7', Numpad0: '0', Numpad3: '3', Numpad7: '7' };
    let typed = '';
    const keys = (code) => {
      const ch = CH[code];
      if (ch && Object.keys(SECRETS).some(w => w.startsWith(typed + ch))) {
        typed += ch;
        this.g.audio.init();
        this.g.audio.tick();
        if (SECRETS[typed]) { SECRETS[typed](); typed = ''; }
        return true;
      }
      typed = '';
      go();
      return true;
    };
    const entry = this.open(el, { keys, click: go });
    el.addEventListener('click', go);
    const cr = el.querySelector('.copyright');
    cr.classList.add('ia');
    let crN = 0;
    cr.addEventListener('click', (e) => {
      e.stopPropagation();
      this.g.audio.init();
      if (++crN < 3) { this.g.audio.ui('move'); return; }
      crN = 0;
      const d = this.g.meta.data;
      cr.textContent = d.afterhours?.found ? '© 1998 ZERO CRASH SOFTWARE · THE CLUB NEVER REALLY CLOSES' : '© 1998 ZERO CRASH SOFTWARE · NOBODY HAS PLAYED THIS DISC SINCE 1999. HELLO.';
      d.secrets.copyright = 1; this.g.meta.save();
      this.g.audio.levelUp();
    });
    // (the eight on the logo does not like being poked)
    const eight = el.querySelector('.logo-8');
    let pokes = 0;
    eight.classList.add('ia');
    eight.addEventListener('click', (e) => {
      e.stopPropagation();
      this.g.audio.init();
      pokes++;
      this.g.audio.tone(200 + pokes * 60, { type: 'square', dur: 0.08, vol: 0.08, filter: 2000 });
      eight.style.animationDuration = `${Math.max(0.2, 4 - pokes * 0.45)}s`;
      if (pokes === 8) {
        eight.classList.add('awake');
        this.g.audio.bossStinger?.();
        const a = this.g.meta.achieve('eights');
        if (a) { this.achievement(this.g.meta.data, 'eights'); this.toast('ALL EIGHTS BALL SET', '#9a4bff', 'UNLOCKED'); }
        else this.toast('IT REMEMBERS YOU', '#9a4bff', '8');
      }
    });
  }

  // small print on both home screens
  footer(el) {
    const g = this.g;
    const f = h('div', 'menu-foot');
    f.innerHTML = `<span class="ver ia">v${GAME_VERSION} · <span class="aft">${UPDATE_NAME}</span> · <u>CREDITS</u></span><span class="sig ia">MADE BY PAUL NERCESSIAN</span>`;
    el.appendChild(f);
    f.querySelector('.ver').onclick = (e) => { e.stopPropagation(); g.audio.ui('select'); this.showCredits(); };
    let n = 0;
    f.querySelector('.sig').onclick = (e) => {
      e.stopPropagation();
      if (++n === 5) {
        g.audio.levelUp();
        const a = g.meta.achieve('curious');
        if (a) this.achievement(g.meta.data, 'curious');
        this.toast('HELLO. THANKS FOR PLAYING.', '#ffc21c', 'PAUL SAYS');
      } else g.audio.ui('move');
    };
    const fs = h('div', 'fs-btn ia', document.fullscreenElement ? 'EXIT FULLSCREEN' : 'FULLSCREEN');
    fs.onclick = (e) => { e.stopPropagation(); g.setFullscreen(!document.fullscreenElement); setTimeout(() => { fs.textContent = document.fullscreenElement ? 'EXIT FULLSCREEN' : 'FULLSCREEN'; }, 300); };
    el.appendChild(fs);
  }

  showCredits() {
    const el = h('div', 'screen dim');
    const box = h('div', 'panel credits-box');
    box.innerHTML = `<div class="title-bar chrome" style="text-align:center">SCRATCH: ${UPDATE_NAME}</div><div class="title-jp" style="text-align:center">クレジット</div>
      <div class="cr-main">CREATED BY<br><b>PAUL NERCESSIAN</b></div>
      <div class="cr-sec">VERSION ${GAME_VERSION} · THE ${UPDATE_NAME} UPDATE</div>
      <div class="cr-sec">BUILT WITH <b>THREE.JS</b> (MIT LICENSE) AND <b>VITE</b></div>
      <div class="cr-sec">TYPEFACES (SIL OPEN FONT LICENSE)<br>PRESS START 2P · DELA GOTHIC ONE · DOTGOTHIC16<br>CHAKRA PETCH · INTER · CORMORANT GARAMOND</div>
      <div class="cr-sec">EVERY SOUND AND EVERY NOTE OF MUSIC<br>IS SYNTHESISED BY THE GAME AS YOU PLAY</div>
      <div class="cr-sec" style="color:var(--gold)">THANK YOU FOR PLAYING</div>
      <div style="text-align:center;margin-top:calc(var(--px)*6)"><button class="btn small">BACK</button></div>`;
    el.appendChild(box);
    let entry;
    const back = () => { this.g.audio.ui('back'); this.close(entry); };
    box.querySelector('.btn').onclick = (e) => { e.stopPropagation(); back(); };
    entry = this.open(el, { keys: (c) => { if (['Escape', 'Backspace', 'Enter'].includes(c)) { back(); return true; } return false; } });
  }

  showMainMenu() {
    this.closeAll();
    this.setRajis(false);
    const d = this.g.meta.data;
    const el = h('div', 'screen dim2');
    el.innerHTML = `
      <div class="logo-wrap"><div class="logo chrome" style="font-size:calc(var(--px)*30)">SCRATCH</div><div class="logo-sub" style="font-size:calc(var(--px)*6)">スクラッチ</div><div class="logo-tag">ROGUELITE</div></div>
      <div class="menu"></div>
      <div class="copyright">LV ${d.level} · BEST RUN ${fmt(d.stats.bestScore)} · ${d.stats.wins} WIN${d.stats.wins === 1 ? '' : 'S'}</div>`;
    const menu = el.querySelector('.menu');
    const g = this.g;
    const sus = g.suspended, saved = !sus && g.hasSavedRun() ? g.meta.data.savedRun : null;
    const cont = sus || saved;
    const contRun = sus ? sus.run : saved;
    const MODE_NAME = { daily: 'DAILY · ', endless: 'ENDLESS · ', bossrush: 'BOSS RUSH · ', onecue: 'ONE CUE · ', chaos: 'CHAOS · ' };
    const contSub = !cont ? '' : contRun.mode === 'rajis' ? `RAJIS · OPERATION ${contRun.op || ''} · STOP ${contRun.node + 1}/9`
      : `${MODE_NAME[contRun.mode] || ''}${contRun.after ? 'AFTERHOURS' : `FLOOR ${contRun.floor}`} · ${contRun.chips} CHIPS · ${contRun.relics.length} RELICS`;
    const modes = ['onecue', 'chaos', 'bossrush'].some(m => g.gate(m));
    const defs = [
      cont ? ['CONTINUE RUN', contSub, () => { this.close(entry); if (!sus && contRun.mode === 'rajis') this.setRajis(true); this.transition(() => (sus ? g.resumeRun() : g.continueSavedRun())); }] : null,
      ['PLAY', `NEW RUN · DAILY SCRATCH · ENDLESS${modes ? ' · MODES' : ''}`, () => this.showPlayMenu()],
      ['LOADOUT', 'BALLS · CUES · TABLES', () => this.showLoadout()],
      ['COLLECTION', 'RELICS · SYNERGIES · RECORDS · HISTORY', () => this.showCollection()],
      ['SETTINGS', 'VIDEO · AUDIO · SAVE', () => this.showSettings()],
      ['PLAY NORMAL 8-BALL', 'SCRATCH CLASSIC · STRAIGHT POOL', () => this.confirmClassic(), 'gold'],
    ].filter(Boolean);
    const items = defs.map(([t, s, , cls]) => { const m = h('div', 'mi shadow' + (cls ? ' ' + cls : ''), s ? `${t}<span class="sub">${s}</span>` : t); menu.appendChild(m); return m; });
    const keys = this.navList(items, {
      onSelect: (i) => { this.g.audio.ui('select'); defs[i][2](); },
    });
    this.footer(el);
    // something small in the corner, for the people who found it
    if (d.rajis?.found) {
      const dot = h('div', 'rajis-dot ia');
      dot.onclick = (e) => { e.stopPropagation(); g.audio.radarPing(); this.rajisEnter(); };
      el.appendChild(dot);
    }
    const entry = this.open(el, { keys });
    this.g.state = 'menu';
    this.announceUnlocks();
    if (g.meta.problem === 'corrupt') { g.meta.problem = null; this.toast('A NEW SAVE WAS STARTED', '#ff3b5c', 'YOUR SAVE COULD NOT BE READ'); }
    if (g.meta.problem === 'nostorage' && !g.meta.warnedStorage) { g.meta.warnedStorage = true; this.toast('PROGRESS LASTS UNTIL YOU CLOSE THE TAB', '#ffc21c', 'THIS BROWSER IS BLOCKING SAVES'); }
  }

  // PLAY: new run (with BREAK level), today's Daily Scratch, Endless
  showPlayMenu() {
    const g = this.g, d = g.meta.data;
    const el = h('div', 'screen dim');
    el.innerHTML = `<div class="title-bar chrome">PLAY</div><div class="title-jp">遊ぶ</div><div class="menu play-menu"></div><div class="hint play-hint"></div>`;
    const menu = el.querySelector('.menu'), hint = el.querySelector('.play-hint');
    const busy = g.suspended || g.hasSavedRun();
    const warn = busy ? '<span class="warnline">STARTS OVER · YOUR RUN IN PROGRESS WILL BE LOST</span>' : '';
    const breakMax = d.breakMax || 0;
    let brk = Math.min(breakMax, d.lastBreak || 0);
    const BREAK_DESC = ['THE GAME AS INTENDED', '+1 BALL ON EVERY TABLE', 'MORE HIGH STAKES AND BETS · EARLIER RULES', 'SHOP PRICES +25%', 'BOSSES ALWAYS GET THEIR EXTRA MECHANIC', 'HEAT BUILDS 50% FASTER'];
    const dr = g.dailyRecord();
    const endlessOn = !!d.unlocks?.endless;
    const E = d.endless || {};
    const items = [];
    const add = (html, cls = '') => { const m = h('div', 'mi shadow' + cls, html); menu.appendChild(m); items.push(m); return m; };
    const newRun = add('');
    const drawNew = () => {
      newRun.innerHTML = `NEW RUN${breakMax ? ` <span class="brk">${glyphHTML('arrowL')} BREAK ${brk} ${glyphHTML('arrowR')}</span>` : ''}<span class="sub">${breakMax ? BREAK_DESC.slice(1, brk + 1).join(' · ') || BREAK_DESC[0] : '3 FLOORS · RELICS · BOSSES'}</span>${warn}`;
    };
    drawNew();
    add(`DAILY SCRATCH<span class="sub">${dr.date} · ${dr.played ? `BEST ${fmt(dr.best)} · HEAT ${ROMAN[dr.bestHeat || 0]}${dr.completed ? ' · COMPLETED' : ''}` : 'THE SAME ROAD FOR EVERYONE TODAY'}</span>${warn}`);
    add(endlessOn ? `ENDLESS<span class="sub">${E.deepest ? `DEEPEST FLOOR ${E.deepest} · BEST ${fmt(E.best || 0)}` : 'BEYOND THE HOUSE · HOW FAR DOWN DOES IT GO?'}</span>${warn}` : `ENDLESS<span class="sub">${glyphHTML('lock')} WIN A RUN TO UNLOCK</span>`, endlessOn ? '' : ' disabled');
    // AFTERHOURS: more ways in, as they are earned
    const modesOn = ['onecue', 'chaos', 'bossrush'].some(m => g.gate(m));
    const handOn = g.gate('handicaps');
    const extra = [];
    if (modesOn) { add('MODES<span class="sub">BOSS RUSH · ONE CUE · CHAOS</span>'); extra.push('modes'); }
    let handItem = null;
    const drawHand = () => {
      const sel = (d.handSel || []);
      handItem.innerHTML = `HANDICAPS<span class="sub">${sel.length ? `${sel.length} ON · REWARD x${handicapMul(sel).toFixed(2)} · FOR NEW RUN AND ENDLESS` : 'OPTIONAL RULES FOR A BIGGER REWARD'}</span>`;
    };
    if (handOn) { handItem = add(''); drawHand(); extra.push('hand'); }
    add('BACK');
    hint.innerHTML = breakMax ? `${glyphHTML('arrowL')}${glyphHTML('arrowR')} CHANGE BREAK LEVEL` : '';
    let entry;
    const start = (opts) => { this.close(entry); const m = this.stack.find(x => x.el.querySelector('.logo')); if (m) this.close(m); g.suspended = null; this.transition(() => g.startRun(opts)); };
    const hand = () => (handOn ? d.handSel || [] : []);
    const keys = this.navList(items, {
      onSelect: (i) => {
        if (i === 0) { d.lastBreak = brk; g.meta.save(); g.audio.ui('select'); start({ mode: 'standard', breakLv: brk, hand: hand() }); }
        else if (i === 1) { g.audio.ui('select'); start({ mode: 'daily' }); }
        else if (i === 2) { if (!endlessOn) { g.audio.ui('deny'); return; } g.audio.ui('select'); start({ mode: 'endless', hand: hand() }); }
        else if (extra[i - 3] === 'modes') { g.audio.ui('select'); this.showModes(); }
        else if (extra[i - 3] === 'hand') { g.audio.ui('select'); this.showHandicaps(drawHand); }
        else { g.audio.ui('back'); this.close(entry); }
      },
    });
    const step = (dir) => { if (!breakMax) return false; brk = (brk + dir + breakMax + 1) % (breakMax + 1); drawNew(); g.audio.ui('move'); return true; };
    newRun.addEventListener('contextmenu', (e) => { e.preventDefault(); step(1); });
    entry = this.open(el, { keys: (c) => { if (c === 'Escape' || c === 'Backspace') { g.audio.ui('back'); this.close(entry); return true; } if (items[0].classList.contains('sel') && (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'KeyA' || c === 'KeyD')) return step(c === 'ArrowLeft' || c === 'KeyA' ? -1 : 1); return keys(c); } });
    newRun.querySelectorAll('.brk .gi').forEach((gi, k) => gi.addEventListener('click', (e) => { e.stopPropagation(); step(k === 0 ? -1 : 1); }));
  }

  // the door to the other game
  confirmClassic() {
    const g = this.g;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel leave-box');
    const saved = g.run || g.suspended;
    box.innerHTML = `<div class="title-bar chrome">LEAVE THE ROGUELITE?</div>
      <div class="leave-text">Normal 8-Ball is a completely separate game mode.<br>${saved ? 'Your current run will remain saved.' : 'Your progress will remain saved.'}</div>
      <div class="row"><button class="btn gold">ENTER CLASSIC</button><button class="btn">CANCEL</button></div>`;
    el.appendChild(box);
    const [ok, no] = box.querySelectorAll('.btn');
    const done = (go) => {
      g.audio.ui(go ? 'select' : 'back');
      this.close(entry);
      if (go) { if (this.pauseOpen) this.closePause(); g.enterClassic(); }
    };
    const keys = this.navList([ok, no], { horizontal: true, onSelect: (i) => done(i === 0), start: 1 });
    const entry = this.open(el, { keys: (c) => { if (c === 'Escape' || c === 'Backspace') { done(false); return true; } return keys(c); } });
  }

  // --------------------------------------------------------- loadout
  showLoadout() {
    const g = this.g, meta = g.meta, sel = meta.data.selected;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel wide');
    box.innerHTML = `<div class="title-bar chrome">LOADOUT</div><div class="title-jp">装備</div><div class="tabs"></div><div class="scroll"><div class="grid"></div></div><div class="foot"><span class="hint">CHANGES PREVIEW ON THE TABLE</span><button class="btn small">BACK</button></div>`;
    el.appendChild(box);
    const tabs = box.querySelector('.tabs'), grid = box.querySelector('.grid');
    const names = ['BALLS', 'CUES', 'TABLES', 'STARTER RELIC'];
    let tab = 0;
    const secretAch = (it) => { const a = ACHIEVEMENTS.find(x => x.id === it.unlock?.ach); return a?.secret && !meta.data.achievements[a.id]; };
    const lockText = (it) => it.unlock.level ? `LOCKED · REACH LV ${it.unlock.level}` : it.unlock.ach ? (secretAch(it) ? 'LOCKED · A SECRET' : `LOCKED · ${ACHIEVEMENTS.find(a => a.id === it.unlock.ach)?.name}`) : 'LOCKED';
    const nm = (it) => (secretAch(it) && !meta.isUnlocked(it) ? '???' : it.name);
    const render = () => {
      tabs.innerHTML = '';
      names.forEach((n, i) => { const t = h('div', 'tab' + (i === tab ? ' sel' : ''), n); t.onclick = () => { tab = i; g.audio.ui('move'); render(); }; tabs.appendChild(t); });
      grid.innerHTML = '';
      if (tab === 0) BALL_SKINS.filter(b => meta.visible(b)).forEach(b => {
        const un = meta.isUnlocked(b);
        const o = h('div', 'opt' + (sel.ball === b.id ? ' sel' : '') + (un ? '' : ' locked'));
        const sw = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `<i style="background:${b.tex.color ? b.tex.color(n) : ballColor(n)}"></i>`).join('');
        o.innerHTML = `<div class="nm">${nm(b)}</div><div class="sw">${sw}</div><div class="${un ? 'ds' : 'lk'}">${un ? b.desc : lockText(b)}</div>`;
        o.onclick = () => { if (!un) { g.audio.ui('deny'); return; } sel.ball = b.id; meta.save(); g.applyCosmetics(); g.audio.ui('select'); render(); };
        grid.appendChild(o);
      });
      if (tab === 1) CUE_SKINS.filter(c => meta.visible(c)).forEach(c => {
        const un = meta.isUnlocked(c);
        const o = h('div', 'opt' + (sel.cue === c.id ? ' sel' : '') + (un ? '' : ' locked'));
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 8; cv.className = 'px-icon';
        const tmp = document.createElement('canvas'); tmp.width = 16; tmp.height = 256; c.paint(tmp.getContext('2d'), 16, 256);
        const x = cv.getContext('2d'); x.save(); x.translate(64, 0); x.rotate(Math.PI / 2); x.drawImage(tmp, 0, 0, 16, 256, 0, 0, 8, 64); x.restore();
        cv.style.width = '100%'; cv.style.height = 'calc(var(--px)*6)'; cv.style.float = 'none'; cv.style.margin = 'calc(var(--px)*2) 0';
        o.innerHTML = `<div class="nm">${nm(c)}</div>`;
        o.appendChild(cv);
        o.appendChild(h('div', un ? 'ds' : 'lk', un ? c.desc : lockText(c)));
        o.onclick = () => { if (!un) { g.audio.ui('deny'); return; } sel.cue = c.id; meta.save(); g.applyCosmetics(); g.audio.ui('select'); render(); };
        grid.appendChild(o);
      });
      if (tab === 2) {
        THEMES.filter(t => meta.visible(t)).forEach(t => {
          const un = meta.isUnlocked(t);
          const o = h('div', 'opt' + (!sel.shuffle && sel.theme === t.id ? ' sel' : '') + (un ? '' : ' locked'));
          const sw = [t.felt, t.wood[0], ...t.neon, t.carpet[1]].slice(0, 6).map(c => `<i style="background:${c}"></i>`).join('');
          o.innerHTML = `<div class="nm">${nm(t)}</div><div class="sw">${sw}</div><div class="${un ? 'ds' : 'lk'}">${un ? t.desc : lockText(t)}</div>`;
          o.onclick = () => { if (!un) { g.audio.ui('deny'); return; } sel.theme = t.id; sel.shuffle = false; meta.save(); g.applyCosmetics(); g.audio.ui('select'); render(); };
          grid.appendChild(o);
        });
        const o = h('div', 'opt' + (sel.shuffle ? ' sel' : ''));
        o.innerHTML = `<div class="nm">SHUFFLE</div><div class="sw"><i style="background:#ff2bd6"></i><i style="background:#2bf0ff"></i><i style="background:#ffe23b"></i><i style="background:#9a4bff"></i></div><div class="ds">A random unlocked table theme on every floor.</div>`;
        o.onclick = () => { sel.shuffle = !sel.shuffle; meta.save(); g.audio.ui('select'); render(); };
        grid.appendChild(o);
      }
      if (tab === 3) {
        const none = h('div', 'opt' + (!sel.starter ? ' sel' : ''), `<div class="nm">NONE</div><div class="ds">Start with empty pockets. Purist.</div>`);
        none.onclick = () => { sel.starter = null; meta.save(); g.audio.ui('select'); render(); };
        grid.appendChild(none);
        STARTER_RELICS.forEach(s => {
          const r = relicById(s.id); if (!r) return;
          const un = meta.level >= s.level;
          const o = h('div', 'opt' + (sel.starter === r.id ? ' sel' : '') + (un ? '' : ' locked'));
          o.appendChild(relicIcon(r.id, RARITY[r.rarity].color));
          o.appendChild(h('div', 'nm', r.name));
          o.appendChild(h('div', un ? 'ds' : 'lk', un ? r.desc : `LOCKED · REACH LV ${s.level}`));
          o.onclick = () => { if (!un) { g.audio.ui('deny'); return; } sel.starter = r.id; meta.save(); g.audio.ui('select'); render(); };
          grid.appendChild(o);
        });
      }
    };
    render();
    const back = () => { g.audio.ui('back'); this.close(entry); };
    box.querySelector('.btn').onclick = back;
    const entry = this.open(el, { keys: (c) => { if (c === 'Escape' || c === 'Backspace') { back(); return true; } if (c === 'ArrowRight' || c === 'KeyE') { tab = (tab + 1) % 4; render(); return true; } if (c === 'ArrowLeft' || c === 'KeyQ') { tab = (tab + 3) % 4; render(); return true; } return false; } });
  }

  // ------------------------------------------------------ collection
  showCollection(startTab = 0) {
    const g = this.g, meta = g.meta, d = meta.data;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel wide');
    const need = xpForLevel(d.level);
    box.innerHTML = `<div class="title-bar chrome">COLLECTION</div><div class="title-jp">図鑑</div>
      <div style="display:flex;align-items:center;gap:calc(var(--px)*6);margin-bottom:calc(var(--px)*6)"><div class="lvl">LV ${d.level}</div><div class="xpbar" style="margin:0;flex:1"><i style="width:calc(${Math.min(100, d.xp / need * 100)}% - var(--px)*4)"></i></div><div style="font-size:calc(var(--px)*4);color:var(--dim)">${fmt(d.xp)} / ${fmt(need)} XP</div></div>
      <div class="tabs"></div><div class="scroll"><div class="grid"></div></div><div class="foot"><span class="hint"></span><button class="btn small">BACK</button></div>`;
    el.appendChild(box);
    const tabs = box.querySelector('.tabs'), grid = box.querySelector('.grid'), hint = box.querySelector('.hint');
    const NAMES = ['RELICS', 'SYNERGIES', 'BOSSES', 'ANOMALIES', 'COSMETICS', 'ACHIEVEMENTS', 'RECORDS', 'HISTORY'];
    let tab = Math.min(startTab, NAMES.length - 1);
    const opt = (html, cls = '') => { const o = h('div', 'opt' + cls, html); grid.appendChild(o); return o; };
    const render = () => {
      tabs.innerHTML = '';
      NAMES.forEach((n, i) => { const t = h('div', 'tab' + (i === tab ? ' sel' : ''), n); t.onclick = () => { tab = i; g.audio.ui('move'); render(); }; tabs.appendChild(t); });
      grid.innerHTML = '';
      grid.style.display = 'grid';
      const name = NAMES[tab];
      if (name === 'RELICS') {
        const seen = RELICS.filter(r => d.seenRelics[r.id]).length;
        hint.innerHTML = `DISCOVERED ${seen} / ${RELICS.length} · CLICK A RELIC TO MARK IT ${glyphHTML('star')}`;
        const fav = d.favorites || {};
        const list = [...RELICS].sort((a, b) => (fav[b.id] ? 1 : 0) - (fav[a.id] ? 1 : 0));
        list.forEach(r => {
          const sn = d.seenRelics[r.id];
          const o = h('div', 'opt' + (fav[r.id] ? ' sel' : ''));
          o.appendChild(relicIcon(r.id, RARITY[r.rarity].color, !sn));
          o.appendChild(h('div', 'nm', sn ? r.name : '???'));
          o.appendChild(h('div', 'ds', `<span style="color:${RARITY[r.rarity].color}">${RARITY[r.rarity].name}${r.risk ? ' · RISK' : ''}</span>${sn && r.up ? ' · <span style="color:var(--gold)">UPGRADES</span>' : ''}<br>${sn ? r.desc : 'Not yet discovered.'}${sn && r.tags?.length ? `<div class="rtags">${this.relicTags(r)}</div>` : ''}`));
          if (sn) {
            const star = glyph(fav[r.id] ? 'star' : 'starOff'); star.classList.add('fav');
            o.appendChild(star);
            o.onclick = () => { d.favorites = d.favorites || {}; if (d.favorites[r.id]) delete d.favorites[r.id]; else d.favorites[r.id] = 1; meta.save(); g.audio.ui('move'); render(); };
          }
          grid.appendChild(o);
        });
      } else if (name === 'SYNERGIES') {
        const found = SYNERGIES.filter(x => d.synergies?.[x.id]).length;
        hint.textContent = `DISCOVERED ${found} / ${SYNERGIES.length} · THEY ARE NEVER LISTED ANYWHERE ELSE`;
        for (const x of SYNERGIES) {
          const got = d.synergies?.[x.id];
          const o = h('div', 'opt' + (got ? ' sel' : ''));
          if (got && x.relics) x.relics.slice(0, 2).forEach(k => { const id = k.split('|')[0], r = relicById(id); if (r) o.appendChild(relicIcon(id, RARITY[r.rarity].color)); });
          else if (got) o.appendChild(relicIcon('demon_chalk', RARITY.cursed.color));
          o.insertAdjacentHTML('beforeend', `<div class="nm" style="color:${got ? 'var(--gold)' : 'var(--dim)'}">${got ? x.name : '???'}</div><div class="ds">${got ? x.desc : 'Two things that work better together. You will know it when it happens.'}</div>`);
          grid.appendChild(o);
        }
      } else if (name === 'BOSSES') {
        const all = Object.values(BOSSES).filter(b => !b.secret || d.seen?.bosses?.[b.id]);
        const beaten = all.filter(b => d.bosses?.[b.id]).length;
        hint.textContent = `DEFEATED ${beaten} / ${all.length}`;
        all.forEach(b => {
          const met = d.seen?.bosses?.[b.id], n = d.bosses?.[b.id] || 0, rx = d.remixes?.[b.id] || 0;
          opt(`<div class="nm" style="color:${met ? b.color : 'var(--dim)'}">${met ? b.name : '???'}</div><div class="ds">${met ? b.blurb : 'You have not met this table yet.'}<br><span style="color:${n ? 'var(--green)' : 'var(--dim)'}">${n ? `DEFEATED ${n}x` : met ? 'UNDEFEATED' : ''}${rx ? ` · REMIX BEATEN ${rx}x` : n >= 3 && b.id !== 'owner' ? ' · IT MAY COME BACK REMIXED' : ''}</span></div>`, n ? ' sel' : '');
        });
      } else if (name === 'ANOMALIES') {
        const all = [...ANOMALIES, SECRET_ANOMALY];
        const found = all.filter(a => d.seen?.anomalies?.[a.id]).length;
        hint.textContent = `FOUND ${found} / ${ANOMALIES.length}${d.seen?.anomalies?.flashback ? ' + 1' : ''}`;
        all.forEach(a => {
          const f = d.seen?.anomalies?.[a.id];
          if (a.secret && !f) return;
          opt(`<div class="nm" style="color:${f ? '#c08aff' : 'var(--dim)'}">${f ? a.name : '???'}</div><div class="ds">${f ? a.desc : 'Something very wrong, somewhere.'}</div>`, f ? ' sel' : '');
        });
      } else if (name === 'COSMETICS') {
        const lockText = (it) => it.unlock?.ach ? (ACHIEVEMENTS.find(x => x.id === it.unlock.ach)?.secret && !d.achievements[it.unlock.ach] ? 'A SECRET' : `ACHIEVEMENT · ${ACHIEVEMENTS.find(x => x.id === it.unlock.ach)?.name}`) : it.unlock?.level ? `REACH LV ${it.unlock.level}` : '';
        const all = [['TABLE', THEMES], ['BALLS', BALL_SKINS], ['CUE', CUE_SKINS]];
        let got = 0, tot = 0;
        for (const [kind, list] of all) for (const it of list) {
          if (!meta.visible(it)) continue;
          const un = meta.isUnlocked(it); tot++; if (un) got++;
          const secret = it.unlock?.ach && ACHIEVEMENTS.find(x => x.id === it.unlock.ach)?.secret && !un;
          opt(`<div class="nm" style="color:${un ? 'var(--ink)' : 'var(--dim)'}">${secret ? '???' : it.name}</div><div class="ds"><span style="color:var(--cyan)">${kind}</span><br>${un ? it.desc : lockText(it)}</div>`, un ? ' sel' : ' locked');
        }
        hint.textContent = `UNLOCKED ${got} / ${tot} · CLASSIC COSMETICS LIVE IN SCRATCH CLASSIC`;
      } else if (name === 'ACHIEVEMENTS') {
        const list = meta.achievementList();
        const got = list.filter(a => d.achievements[a.id]).length;
        hint.textContent = `UNLOCKED ${got} / ${list.length}`;
        list.forEach(a => {
          const sn = d.achievements[a.id];
          const hidden = a.secret && !sn;
          const o = h('div', 'opt' + (sn ? ' sel' : ''));
          o.appendChild(achIcon(hidden ? 'secret' : a.id, !!sn));
          o.insertAdjacentHTML('beforeend', `<div class="nm" style="color:${sn ? 'var(--gold)' : 'var(--dim)'}">${hidden ? '???' : a.name}</div><div class="ds">${hidden ? 'A secret. Keep your eyes open.' : a.desc}${a.reward && !hidden ? `<br><span style="color:var(--cyan)">UNLOCKS: ${a.reward}</span>` : ''}</div>`);
          grid.appendChild(o);
        });
      } else if (name === 'RECORDS') {
        hint.textContent = '';
        grid.style.display = 'block';
        const st = d.stats, B = d.bests || {}, E = d.endless || {}, dr = g.dailyRecord(), C = d.classic?.stats || {};
        const tt = (v) => (v ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : '—');
        const rivalsBeaten = Object.values(d.rivals || {}).reduce((a, r) => a + (r.wins || 0), 0);
        const sec = (title, rows) => `<div class="section-h">${title}</div><div class="stats">${rows.filter(Boolean).map(([k, v]) => `<div>${k}</div><div class="v">${v}</div>`).join('')}</div>`;
        grid.innerHTML = sec('PERSONAL BESTS', [['HIGHEST SCORE', fmt(B.highScore || 0)], ['FASTEST WIN', tt(B.fastestWin)], ['HIGHEST HEAT', ROMAN[B.highestHeat || 0]], ['HIGHEST STYLE', B.highestStyle ? `<span style="color:${STYLE_COL[B.highestStyle]}">${STYLE_GRADES[B.highestStyle]}</span>` : '—'], ['LARGEST COMBO', B.largestCombo || 0], ['MOST BALLS IN ONE SHOT', B.mostBalls || 0], ['LONGEST BANK (CUSHIONS)', B.longestBank || '—'], ['MOST EFFECTS IN ONE SHOT', B.mostTriggers || '—'], ['FURTHEST FLOOR', B.furthestFloor ? (B.furthestFloor >= 4 && d.afterhours?.found ? 'AFTERHOURS' : B.furthestFloor) : '—'], ['BEST GRADE', B.bestGrade || '—']])
          + sec('MODES', [['DAILY ' + dr.date, dr.played ? `${fmt(dr.best)} · HEAT ${ROMAN[dr.bestHeat || 0]}${dr.completed ? ' · DONE' : ''}` : 'NOT PLAYED'], ['ENDLESS DEEPEST FLOOR', E.deepest || '—'], ['ENDLESS BEST SCORE', fmt(E.best || 0)], ['ENDLESS MAX HEAT', ROMAN[E.heat || 0]], ['HIGHEST BREAK BEATEN', d.breakBest >= 0 && d.breakBest != null ? d.breakBest : '—'],
            g.gate('bossrush') && ['BOSS RUSH BEST TIME', tt(B.bossRushTime)], g.gate('bossrush') && ['BOSS RUSH BEST SCORE', fmt(B.bossRushScore || 0)], g.gate('bossrush') && ['BOSS RUSH FEWEST MISSES', B.bossRushMisses >= 0 ? B.bossRushMisses : '—'],
            g.gate('onecue') && ['ONE CUE BEST', fmt(B.oneCueBest || 0)], g.gate('chaos') && ['CHAOS BEST', fmt(B.chaosBest || 0)], d.afterhours?.found && ['CLOSING TIME', d.afterhours.cleared ? `SURVIVED ${d.afterhours.cleared}x` : 'NOT YET']])
          + sec('CAREER', [['RUNS STARTED', fmt(st.runs || 0)], ['RUNS FINISHED', fmt(st.finished || 0)], ['RUNS WON', fmt(st.wins || 0)], ['TABLES CLEARED', fmt(st.tables || 0)], ['BOSSES BEATEN', fmt(st.bosses || 0)], ['BALLS POTTED', fmt(st.pots || 0)], ['BANK SHOTS', fmt(st.banks || 0)], ['SCRATCHES', fmt(st.scratches || 0)], ['GOLDEN BALLS', fmt(st.golds || 0)], ['CONTRACTS COMPLETED', fmt(st.contracts || 0)], ['RIVALS BEATEN', fmt(rivalsBeaten)], ['SYNERGIES FOUND', `${Object.keys(d.synergies || {}).length} / ${SYNERGIES.length}`], ['BEST RUN SCORE', fmt(st.bestScore || 0)], ['BEST SINGLE SHOT', fmt(st.bestShot || 0)]])
          + sec('SCRATCH CLASSIC', [['MATCHES PLAYED', C.played || 0], ['MATCHES WON', C.won || 0], ['BEST WIN STREAK', C.bestStreak || 0], ['BREAK AND RUNS', C.breakRuns || 0], ['TOURNAMENTS WON', C.tourneys || 0]]);
        const riv = RIVALS.filter(r => d.rivals?.[r.id]);
        if (riv.length) grid.insertAdjacentHTML('beforeend', sec('RIVALS', riv.map(r => { const x = d.rivals[r.id]; return [`<span style="color:${r.color}">${r.name}</span>`, `${x.wins || 0} W · ${x.losses || 0} L${x.nemesis ? ' · <span style="color:var(--red)">NEMESIS</span>' : ''}`]; })));
      } else if (name === 'HISTORY') {
        grid.style.display = 'block';
        const list = d.runHistory || [];
        hint.textContent = list.length ? 'YOUR LAST 10 RUNS · CLICK ONE FOR THE BUILD' : '';
        if (!list.length) grid.innerHTML = '<div class="hint" style="text-align:center">NO FINISHED RUNS YET.</div>';
        for (const r of list) {
          const x = this.historyRow(r);
          const row = h('div', 'hist-row', `<div class="hg grade-${(r.grade || 'D').replace('+', 'p')}">${r.grade}</div><div><div class="hb">${r.build || x.mode}</div><div class="hm">${x.date} · ${x.mode} · ${x.res}</div></div><div class="hs">${fmt(r.score)}</div><div class="hm">${(r.relics || []).length} RELICS</div>`);
          row.onclick = () => { g.audio.ui('select'); this.showBuild(r); };
          grid.appendChild(row);
        }
      }
    };
    render();
    const back = () => { g.audio.ui('back'); this.close(entry); };
    box.querySelector('.btn').onclick = back;
    const entry = this.open(el, { keys: (c) => { if (c === 'Escape' || c === 'Backspace') { back(); return true; } if (c === 'ArrowRight' || c === 'KeyE') { tab = (tab + 1) % NAMES.length; render(); return true; } if (c === 'ArrowLeft' || c === 'KeyQ') { tab = (tab + NAMES.length - 1) % NAMES.length; render(); return true; } return false; } });
  }

  // -------------------------------------------------------- settings
  showSettings() {
    const g = this.g, st = g.meta.s;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel settings-box');
    box.innerHTML = `<div class="title-bar chrome">SETTINGS</div><div class="title-jp">設定</div><div class="tabs"></div><div class="rows scroll"></div><div class="foot"><span class="hint">${glyphHTML('arrowL')}${glyphHTML('arrowR')} CHANGE · Q/E TABS</span><button class="btn small">BACK</button></div>`;
    el.appendChild(box);
    const tabsEl = box.querySelector('.tabs'), rowsEl = box.querySelector('.rows');
    const pct = (v) => `<div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div><span class="num">${Math.round(v * 100)}%</span>`;
    const opt = (k, name, vals, labels, note) => ({ k, name, vals, label: v => labels[vals.indexOf(v)] ?? String(v), note });
    const TABS = {
      GAMEPLAY: [
        opt('camera', 'CAMERA', ['cinematic', 'top'], ['CINEMATIC 3D', 'TOP DOWN'], 'PRESS C IN-GAME TO SWITCH'),
        opt('aim', 'AIM GUIDE', ['full', 'reduced', 'minimal', 'none'], ['FULL', 'REDUCED  +5% SCORE', 'SHORT  +15% SCORE', 'OFF  +25% SCORE']),
        { k: 'shake', name: 'CAMERA SHAKE', slider: true },
        opt('flash', 'SCREEN FLASH', ['full', 'reduced', 'off'], ['FULL', 'REDUCED', 'OFF']),
        opt('heat', 'HEAT SYSTEM', [true, false], ['ON', 'OFF'], 'THE GAME RAMPS UP WHEN YOU DOMINATE'),
        opt('commentary', 'COMMENTARY', [true, false], ['ON', 'OFF'], 'A FEW WORDS ON YOUR BEST AND WORST SHOTS'),
        { k: 'tips', name: 'TUTORIAL TIPS', tips: true },
      ],
      GRAPHICS: [
        opt('gfx', 'STYLE', ['ps1', 'modern'], ['PS1 (DEFAULT)', 'MODERN']),
        { k: 'quality', name: 'QUALITY PRESET', preset: true },
        opt('resScale', 'RESOLUTION', ['auto', 0.5, 0.75, 1], ['AUTO', '50%', '75%', '100%']),
        opt('crt', 'CRT FILTER', [true, false], ['ON', 'OFF']),
        opt('bloom', 'BLOOM', [true, false], ['ON', 'OFF']),
        opt('particles', 'PARTICLES', ['low', 'med', 'high'], ['LOW', 'MEDIUM', 'HIGH']),
      ],
      UI: [
        opt('uiScale', 'UI SCALE', ['auto', 0.8, 0.9, 1, 1.1], ['AUTO', '80%', '90%', '100%', '110%']),
        opt('safe', 'SAFE AREA', ['normal', 'large'], ['NORMAL', 'LARGE']),
        { k: 'fullscreen', name: 'DISPLAY', display: true },
        { k: 'credits', name: 'CREDITS', link: () => this.showCredits() },
      ],
      SAVE: [
        { k: 'export', name: 'EXPORT SAVE', link: () => this.saveTransfer('export') },
        { k: 'import', name: 'IMPORT SAVE', link: () => this.saveTransfer('import') },
        { k: 'reset', name: 'ERASE SAVE DATA', link: () => this.confirmErase(), danger: true },
      ],
      AUDIO: [
        { k: 'master', name: 'MASTER', slider: true },
        { k: 'music', name: 'MUSIC', slider: true },
        { k: 'sfx', name: 'SOUND FX', slider: true },
      ],
    };
    const names = Object.keys(TABS);
    let tab = 0, cur = 0, armedReset = false, rowEls = [], keysNav = null, tipsReset = false;
    const PRESETS = { LOW: { resScale: 0.5, bloom: false, particles: 'low' }, MEDIUM: { resScale: 0.75, bloom: true, particles: 'med' }, HIGH: { resScale: 'auto', bloom: true, particles: 'high' } };
    const presetName = () => Object.keys(PRESETS).find(k => Object.entries(PRESETS[k]).every(([kk, vv]) => st[kk] === vv)) || 'CUSTOM';
    const render = () => {
      tabsEl.innerHTML = '';
      names.forEach((n, i) => { const t = h('div', 'tab' + (i === tab ? ' sel' : ''), n); t.onclick = () => { tab = i; cur = 0; g.audio.ui('move'); render(); }; tabsEl.appendChild(t); });
      const defs = TABS[names[tab]];
      rowsEl.innerHTML = '';
      rowEls = defs.map(() => { const r = h('div', 'set-row'); rowsEl.appendChild(r); return r; });
      const draw = () => defs.forEach((d, i) => {
        let v;
        if (d.slider) v = pct(st[d.k] ?? 1);
        else if (d.display) v = `<span class="arr">${glyphHTML('arrowL')}</span>${document.fullscreenElement ? 'FULLSCREEN' : 'WINDOW'}<span class="arr">${glyphHTML('arrowR')}</span>`;
        else if (d.preset) v = `<span class="arr">${glyphHTML('arrowL')}</span>${presetName()}<span class="arr">${glyphHTML('arrowR')}</span>`;
        else if (d.tips) v = tipsReset ? '<span style="color:var(--green)">RESET — THEY WILL SHOW AGAIN</span>' : 'RESET';
        else if (d.link) v = `<span style="color:${d.danger ? 'var(--red)' : 'var(--cyan)'}">OPEN ${glyphHTML('arrowR')}</span>`;
        else if (d.action) v = armedReset ? '<span style="color:var(--red)">PRESS AGAIN TO ERASE</span>' : '';
        else v = `<span class="arr">${glyphHTML('arrowL')}</span>${d.label(st[d.k])}<span class="arr">${glyphHTML('arrowR')}</span>`;
        rowEls[i].innerHTML = `<span class="nm">${d.name}${d.note ? `<small>${d.note}</small>` : ''}</span><span class="val">${v}</span>`;
      });
      this._settingsDraw = draw;
      draw();
      keysNav = this.navList(rowEls, { start: Math.min(cur, rowEls.length - 1), onSelect: (i) => { cur = i; change(i, 1); }, onMove: (i) => { cur = i; } });
      rowEls.forEach((r, i) => r.addEventListener('contextmenu', (e) => { e.preventDefault(); change(i, -1); }));
    };
    const change = (i, dir) => {
      const d = TABS[names[tab]][i];
      if (d.display) { g.setFullscreen(!document.fullscreenElement); g.audio.ui('move'); setTimeout(() => this._settingsDraw(), 250); return; }
      if (d.link) { g.audio.ui('select'); d.link(); return; }
      if (d.tips) { g.meta.data.tips = {}; g.meta.data.tutorialDone = false; tipsReset = true; g.meta.save(); g.audio.ui('select'); this._settingsDraw(); return; }
      if (d.preset) {
        const keys = Object.keys(PRESETS), cur = keys.indexOf(presetName());
        Object.assign(st, PRESETS[keys[((cur < 0 ? 2 : cur) + dir + keys.length) % keys.length]]);
        g.meta.save(); g.applySettings(); g.audio.ui('move'); this._settingsDraw(); return;
      }
      if (d.action) {
        if (armedReset) { g.meta.reset(); g.applySettings(); g.applyCosmetics(); armedReset = false; this.toast('SAVE ERASED', '#ff3b5c'); }
        else armedReset = true;
      } else if (d.slider) st[d.k] = Math.max(0, Math.min(1, Math.round(((st[d.k] ?? 1) + dir * 0.1) * 10) / 10));
      else { const idx = d.vals.indexOf(st[d.k]); st[d.k] = d.vals[((idx < 0 ? 0 : idx) + dir + d.vals.length) % d.vals.length]; }
      g.meta.save(); g.applySettings(); g.audio.ui('move');
      this._settingsDraw();
    };
    render();
    const back = () => { g.audio.ui('back'); this.close(entry); };
    box.querySelector('.btn').onclick = back;
    const entry = this.open(el, {
      keys: (c) => {
        if (c === 'Escape' || c === 'Backspace') { back(); return true; }
        if ((c === 'ArrowLeft' || c === 'KeyA') && TABS[names[tab]][cur]?.link) return true;
        if (c === 'ArrowLeft' || c === 'KeyA') { change(cur, -1); return true; }
        if (c === 'ArrowRight' || c === 'KeyD') { change(cur, 1); return true; }
        if (c === 'KeyE' || c === 'Tab') { tab = (tab + 1) % names.length; cur = 0; render(); return true; }
        if (c === 'KeyQ') { tab = (tab + names.length - 1) % names.length; cur = 0; render(); return true; }
        return keysNav(c);
      },
    });
  }

  // serious: this deletes everything
  confirmErase() {
    const g = this.g;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel leave-box');
    box.innerHTML = `<div class="title-bar chrome" style="color:var(--red)">ERASE EVERYTHING?</div>
      <div class="leave-text">Levels, unlocks, achievements, records, Classic statistics, settings and any run in progress will be deleted.<br><b style="color:var(--red)">THIS CANNOT BE UNDONE.</b><br>Tip: EXPORT SAVE first if you might want it back.</div>
      <div class="row"><button class="btn">CANCEL</button><button class="btn danger">ERASE</button></div>`;
    el.appendChild(box);
    const [no, yes] = box.querySelectorAll('.btn');
    let armed = false, entry;
    const close = () => { g.audio.ui('back'); this.close(entry); };
    no.onclick = (e) => { e.stopPropagation(); close(); };
    yes.onclick = (e) => {
      e.stopPropagation();
      if (!armed) { armed = true; yes.textContent = 'CLICK AGAIN TO ERASE'; g.audio.ui('deny'); return; }
      g.meta.reset();
      try { localStorage.removeItem('scratch_save_v1_unreadable'); } catch (err) { /* ignore */ }
      location.reload();
    };
    entry = this.open(el, { keys: (c) => { if (c === 'Escape') { close(); return true; } return false; } });
  }

  // move a save between browsers/computers as one line of text
  saveTransfer(mode) {
    const g = this.g;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel transfer-box');
    const code = mode === 'export' ? g.meta.exportSave() : '';
    box.innerHTML = `<div class="title-bar chrome">${mode === 'export' ? 'EXPORT SAVE' : 'IMPORT SAVE'}</div>
      <div class="leave-text">${mode === 'export' ? 'Copy this code somewhere safe. Paste it into IMPORT SAVE on any browser to bring everything back.' : 'Paste a SCRATCH save code. It replaces your current progress.'}</div>
      <textarea class="save-code ia" spellcheck="false" ${mode === 'export' ? 'readonly' : ''}>${code}</textarea>
      <div class="save-msg"></div>
      <div class="row">${mode === 'export' ? '<button class="btn gold act">COPY</button><button class="btn dl">DOWNLOAD</button>' : '<button class="btn gold act">LOAD</button>'}<button class="btn back">BACK</button></div>`;
    el.appendChild(box);
    const ta = box.querySelector('textarea'), msg = box.querySelector('.save-msg');
    ta.addEventListener('keydown', (e) => e.stopPropagation());
    let entry;
    const back = () => { g.audio.ui('back'); this.close(entry); };
    box.querySelector('.back').onclick = (e) => { e.stopPropagation(); back(); };
    box.querySelector('.act').onclick = async (e) => {
      e.stopPropagation();
      if (mode === 'export') {
        try { await navigator.clipboard.writeText(code); msg.textContent = 'COPIED.'; } catch (err) { ta.select(); msg.textContent = 'SELECTED — PRESS CTRL/CMD+C TO COPY.'; }
      } else {
        try { g.meta.importSave(ta.value); msg.textContent = 'LOADED. RESTARTING...'; setTimeout(() => location.reload(), 700); }
        catch (err) { msg.textContent = String(err.message || 'THAT SAVE COULD NOT BE READ.').toUpperCase(); g.audio.ui('deny'); }
      }
    };
    const dl = box.querySelector('.dl');
    if (dl) dl.onclick = (e) => {
      e.stopPropagation();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
      a.download = `scratch-save-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    entry = this.open(el, { keys: (c) => { if (c === 'Escape') { back(); return true; } return false; } });
  }

  // ----------------------------------------------------------- pause
  openPause() {
    if (this.pauseOpen) return;
    this.pauseOpen = true;
    this.g.audio.music?.muffle(true);
    this.g.prevTimeScale = this.g.slowTarget;
    this.g.slowTarget = 0.0001; this.g.timeScale = 0.0001;
    const el = h('div', 'screen pause-bg');
    el.innerHTML = `<div class="title-bar chrome" style="font-size:calc(var(--px)*20)">PAUSE</div><div class="title-jp">一時停止</div><div class="menu"></div>`;
    const menu = el.querySelector('.menu');
    const canSwitch = this.g.canSuspend() && this.g.run?.mode !== 'rajis';
    const labels = ['RESUME', 'SETTINGS', 'ABANDON RUN', 'PLAY NORMAL 8-BALL', 'QUIT TO MENU'];
    const items = labels.map((t, i) => {
      const sub = i === 3 ? (this.g.run?.mode === 'rajis' ? 'NOT FROM HERE' : canSwitch ? 'YOUR RUN WAITS HERE' : 'FINISH THE SHOT FIRST') : i === 4 ? 'YOUR RUN IS SAVED AT THE LAST STOP' : '';
      const m = h('div', 'mi shadow' + (i === 3 ? ' gold' : '') + (i === 3 && !canSwitch ? ' disabled' : ''), sub ? `${t}<span class="sub">${sub}</span>` : t);
      menu.appendChild(m); return m;
    });
    let confirm = false;
    const keys = this.navList(items, {
      onSelect: (i) => {
        if (i === 0) this.closePause();
        if (i === 1) this.showSettings();
        if (i === 3) { if (canSwitch) this.confirmClassic(); else this.g.audio.ui('deny'); return; }
        if (i === 4) { this.closePause(); this.transition(() => this.g.quitToMenu()); return; }
        if (i === 2) {
          if (!confirm) { confirm = true; items[2].innerHTML = 'ABANDON RUN<span class="sub" style="color:var(--red)">CLICK AGAIN TO CONFIRM</span>'; return; }
          this.closePause();
          this.closeAll();
          this.g.run.hearts = 0;
          this.g.endRun(false);
        }
      },
    });
    this.pauseEntry = this.open(el, { keys: (c) => { if (c === 'Escape') { this.closePause(); return true; } return keys(c); } });
  }
  closePause() {
    if (!this.pauseOpen) return;
    this.pauseOpen = false;
    this.g.audio.music?.muffle(false);
    this.g.slowTarget = 1; this.g.timeScale = 1;
    if (this.pauseEntry) this.close(this.pauseEntry);
  }

  // ------------------------------------------------------------- HUD
  buildHUD() {
    this.hud.innerHTML = `
      <div class="hud-tl panel"><div class="obj"></div></div>
      <div class="hud-tc"></div>
      <div class="hud-meters">
        <div class="meter-style"><div class="ml">STYLE</div><div class="sg">C</div><div class="sbar"><i></i></div></div>
        <div class="meter-heat"><div class="ml">HEAT</div><div class="hg"><span class="hf"></span><b>0</b></div><div class="hbar"><i></i></div></div>
      </div>
      <div class="hud-tr">
        <div class="stat-row"><div class="hearts"></div><div class="chips">${CHIP()}<span>0</span></div></div>
        <div class="score">SCORE <b>0</b></div>
        <div class="floorinfo"></div><div class="nodes"></div>
      </div>
      <div class="hud-bl ia">
        <div><div class="meter"><div class="fill"></div><div class="segs"></div><div class="cap"></div></div><div class="meter-label">PWR</div></div>
        <div class="spin-wrap"><div class="spin"><div class="dot"></div></div><div class="keys"><b>WASD</b> SPIN <b>WHEEL</b> POWER<br><b>SHIFT</b> FINE AIM <b>R-DRAG</b> CAM <b>Q/E</b> ZOOM <b>C</b> VIEW</div></div>
        <div class="items"></div>
      </div>
      <div class="hud-br ia"></div>
      <div class="relic-count"></div>
      <div class="tally panel" style="opacity:0"></div>
      <div class="ff-hint">HOLD <b>SPACE</b> TO FAST-FORWARD</div>`;
    this.h = {
      obj: this.hud.querySelector('.obj'),
      tc: this.hud.querySelector('.hud-tc'),
      hearts: this.hud.querySelector('.hearts'),
      chips: this.hud.querySelector('.chips span'),
      chipsBox: this.hud.querySelector('.chips'),
      score: this.hud.querySelector('.score b'),
      floor: this.hud.querySelector('.floorinfo'),
      nodes: this.hud.querySelector('.nodes'),
      meter: this.hud.querySelector('.meter'),
      fill: this.hud.querySelector('.meter .fill'),
      cap: this.hud.querySelector('.meter .cap'),
      spin: this.hud.querySelector('.spin'),
      dot: this.hud.querySelector('.spin .dot'),
      items: this.hud.querySelector('.items'),
      relics: this.hud.querySelector('.hud-br'),
      relicCount: this.hud.querySelector('.relic-count'),
      tally: this.hud.querySelector('.tally'),
      ff: this.hud.querySelector('.ff-hint'),
      style: this.hud.querySelector('.meter-style'),
      heat: this.hud.querySelector('.meter-heat'),
    };
    // spin widget
    const setSpin = (e) => {
      const r = this.h.spin.getBoundingClientRect();
      let x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      this.g.spin.x = x; this.g.spin.y = y;
    };
    let drag = false;
    this.h.spin.addEventListener('mousedown', (e) => { e.stopPropagation(); drag = true; setSpin(e); });
    window.addEventListener('mousemove', (e) => { if (drag) setSpin(e); });
    window.addEventListener('mouseup', () => { drag = false; });
    this.h.spin.addEventListener('dblclick', () => { this.g.spin.x = 0; this.g.spin.y = 0; });
    this.sig = {};
  }

  showHUD(on) { this.hud.classList.toggle('on', on); if (on) this.updateHUD(true); }

  updateHUD(force = false) {
    const g = this.g, run = g.run, e = g.enc;
    if (!run) return;
    const atTable = e && ['intro', 'aim', 'charge', 'shooting', 'sim', 'place', 'house', 'houseWait', 'result', 'enemy'].includes(g.state);
    this.hud.querySelector('.hud-tl').style.visibility = atTable ? 'visible' : 'hidden';
    this.hud.querySelector('.hud-meters').style.visibility = atTable ? 'visible' : 'hidden';
    if (!this.h.heat.querySelector('.hf').firstChild) this.h.heat.querySelector('.hf').innerHTML = glyphHTML('flame');
    this.hud.querySelector('.hud-bl').style.visibility = atTable ? 'visible' : 'hidden';
    this.h.tc.style.visibility = atTable ? 'visible' : 'hidden';
    // objective
    if (e) {
      const def = e.def;
      const shotsLeft = Math.max(0, e.shots);
      const S = g.shot;
      const tent = S && !S.house ? (def.progress ? def.progress(g, S, e) : S.counted) : 0;
      const sig = [def.id, e.progress, e.goal, shotsLeft, tent, e.ghostCharges, g.ghostArmed, g.chaosRule?.id, e.chBroken, e.shotsTaken, e.stakeBroken, e.phase, e.rivalScore, e.book?.text, e.book?.accepted, e.seqNext, e.lastGame, e.coreTime, run.hearts, run.tstate?.left].join('|');
      if (force || sig !== this.sig.obj) {
        this.sig.obj = sig;
        const tag = def.boss ? `<span class="obj-tag boss">${e.remix ? 'REMIX' : 'BOSS'}${e.phase > 1 ? ' · ' + ROMAN[Math.min(3, e.phase)] : ''}</span>` : e.kind === 'elite' ? '<span class="obj-tag elite">ELITE</span>' : e.stake ? '<span class="obj-tag stakes">HIGH STAKES</span>' : e.kind === 'highroller' ? `<span class="obj-tag elite">HIGH ROLLER · ${e.hr}</span>` : e.rivalDef ? `<span class="obj-tag" style="background:${e.rivalDef.color}">${e.nemesis ? 'NEMESIS' : 'RIVAL'}</span>` : e.kind === 'trickshot' ? '<span class="obj-tag elite">TRICK</span>' : '';
        let pips = '';
        if (def.boss) {
          const hp = Math.max(0, (e.goal - e.progress) / e.goal);
          pips = `<div class="bossbar"><b style="width:${hp * 100}%"></b><i style="width:${Math.max(0, (e.goal - e.progress - tent) / e.goal) * 100}%"></i></div>`;
        } else {
          pips = '<div class="pips">' + Array.from({ length: e.goal }, (_, i) => `<div class="pip${i < e.progress ? ' on' : i < e.progress + tent ? ' tent' : ''}"></div>`).join('') + '</div>';
        }
        let shots = '';
        if (run.oneCue && def.id !== 'blitz' && e.kind !== 'trickshot') shots = `<div class="shots"><span class="n">∞</span><span>SHOTS · EVERY MISS COSTS A LIFE</span></div>`;
        else if (e.kind === 'trickshot') shots = `<div class="shots${shotsLeft <= 1 ? ' low' : ''}"><span class="n">${shotsLeft}</span><span>ATTEMPTS LEFT</span></div>`;
        else if (def.id === 'blitz') shots = `<div class="timer">${Math.ceil(e.timer)}</div>`;
        else if (def.id === 'clock') shots = `<div class="timer clock">${Math.ceil(e.clock)}</div><div class="shots${shotsLeft <= 2 ? ' low' : ''}"><span class="n">${shotsLeft}</span><span>SHOTS</span></div>`;
        else {
          const cues = Array.from({ length: Math.min(14, Math.max(e.shotsMax, shotsLeft)) }, (_, i) => `<i class="${i < shotsLeft ? '' : 'used'}"></i>`).join('');
          shots = `<div class="shots${shotsLeft <= 2 ? ' low' : ''}"><span class="n">${shotsLeft}</span><span>SHOTS</span><div class="cues">${cues}</div></div>`;
        }
        const ghost = e.ghostCharges > 0 || g.ghostArmed ? `<div class="ghost-btn ${g.ghostArmed ? 'armed' : 'ready'}" style="margin-top:calc(var(--px)*3)">[G] GHOST BALL ${g.ghostArmed ? 'ARMED' : 'x' + e.ghostCharges}</div>` : '';
        const mod = def.cap ? `<div class="obj-mod">${glyphHTML('diamond')} MAX ${def.cap} COUNTED POTS PER SHOT</div>` : '';
        const nm = def.boss ? def.name : def.name;
        const mods = (e.mods || []).map(m => `<div class="obj-mod">${glyphHTML('diamond')} ${m.name}</div>`).join('');
        const anom = e.anomaly ? `<div class="obj-mod anom">${glyphHTML('anomaly')} ${e.anomaly.name}</div>` : '';
        let bet = '';
        if (e.challenge) {
          const txt = e.challenge.id === 'speed' ? `${e.challenge.name} (${Math.max(0, (e.chN ?? 0) - e.shotsTaken)} LEFT)` : e.challenge.name;
          bet = `<div class="obj-bet ${e.chBroken ? 'broken' : ''}">${glyphHTML(e.chBroken ? 'cross' : 'dice')} ${e.chBroken ? 'BET LOST' : 'BET'}: ${txt}</div>`;
        }
        if (e.stake) bet += `<div class="obj-bet ${e.stakeBroken ? 'broken' : ''}">${glyphHTML(e.stakeBroken ? 'cross' : 'warn')} ${e.stakeBroken ? 'STAKE BROKEN' : 'STAKE'}: ${e.stake.name}</div>`;
        const name = e.anomaly ? e.anomaly.name : run.mode === 'rajis' && MISSIONS[def.id] ? MISSIONS[def.id] : e.puzzle ? e.puzzle.name : nm;
        const book = e.book ? `<div class="bookie">${glyphHTML('dice')} THE BOOKIE: ${e.book.text} · +${e.book.win} / -${e.book.lose} ${e.book.accepted ? `<span class="bk-btn on">${e.book.forced ? 'FORCED' : 'TAKEN'}</span>` : '<span class="bk-btn ia">[B] TAKE IT</span>'}</div>` : '';
        this.h.obj.innerHTML = this.L(`<div class="obj-name chrome" style="${def.boss ? 'font-size:calc(var(--px)*7)' : ''}">${name}</div>${tag}<div class="obj-text">${def.objective(e)}</div>${mod}${anom}${mods}${bet}${book}${pips}${shots}${ghost}`) + this.rivalPanel(e);
        const bk = this.h.obj.querySelector('.bk-btn.ia');
        if (bk) bk.onclick = (ev) => { ev.stopPropagation(); g.bookieAccept(); };
      }
      if (def.id === 'blitz') {
        const t = this.h.obj.querySelector('.timer');
        if (t) { t.textContent = Math.ceil(e.timer); t.classList.toggle('low', e.timer <= 10); }
      }
      if (def.id === 'clock') {
        const t = this.h.obj.querySelector('.timer');
        if (t) { t.textContent = Math.ceil(Math.max(0, e.clock)); t.classList.toggle('low', e.clock <= 4); }
      }
    }
    // chaos card
    const chaos = g.chaosRule?.id || '';
    if (force || chaos !== this.sig.chaos) {
      this.sig.chaos = chaos;
      this.h.tc.innerHTML = g.chaosRule ? `<div class="panel chaos-card"><b>${g.chaosRule.name}</b>${g.chaosRule.desc}</div>` : '';
    }
    // chips / hearts / score
    const hs = run.hearts + '/' + run.maxHearts;
    if (force || hs !== this.sig.hearts) {
      this.sig.hearts = hs;
      this.h.hearts.innerHTML = '';
      for (let i = 0; i < run.maxHearts; i++) this.h.hearts.appendChild(heartIcon(i < run.hearts));
    }
    this.h.chips.textContent = run.chips;
    this.h.score.textContent = fmt(run.score);
    const fs = run.floor + ':' + run.node;
    if (force || fs !== this.sig.floor) {
      this.sig.floor = fs;
      const mode = run.mode === 'daily' ? 'DAILY · ' : run.endless ? 'ENDLESS · ' : run.breakLv ? `BREAK ${run.breakLv} · ` : '';
      this.h.floor.textContent = run.mode === 'rajis' ? `OPERATION ${run.op} · ${LOCATIONS[run.nodes[run.node]?.loc]?.name || 'COMMAND CENTER'}` : run.after ? '03:77 · AFTERHOURS' : `${mode}FLOOR ${run.floor} · ${floorName(run.floor, run)}`;
      this.h.nodes.innerHTML = run.nodes.map((n, i) => `<i class="${i < run.node ? 'done' : i === run.node ? 'cur' : ''} ${n.type === 'boss' ? 'boss' : ''}"></i>`).join('');
    }
    // the club's mood and your contract, quietly, under the road
    const st = g.activeState?.();
    const extra = `${st ? `${st.id}:${run.tstate.left}` : ''}|${run.contract ? `${run.contract.id}:${run.contract.n}` : ''}|${run.over?.id || ''}`;
    if (force || extra !== this.sig.extra) {
      this.sig.extra = extra;
      if (!this.h.extra) { this.h.extra = h('div', 'hud-extra'); this.hud.querySelector('.hud-tr').appendChild(this.h.extra); }
      this.h.extra.innerHTML = (st ? `<div class="state-badge" style="--sc:${st.color}">${st.name} <b>· ${run.tstate.left} TABLE${run.tstate.left === 1 ? '' : 'S'}</b></div>` : '') + this.contractLine();
    }
    // relics
    const rs = run.relics.map(r => r.id).join(',') + '|' + JSON.stringify(run.relicLv || {}) + '|' + Object.keys(e?.disabled || {}).filter(k => e.disabled[k]).join(',') + '|' + (run.over?.id || '');
    if (force && rs !== this.sig.relics || rs !== this.sig.relics) {
      const grew = this.sig.relics !== undefined && rs.length > this.sig.relics.length;
      this.sig.relics = rs;
      this.h.relics.innerHTML = '';
      this.h.relicCount.textContent = run.relics.length ? this.L(`RELICS ${run.relics.length}/${g.maxRelics()}`) : '';
      const counts = {};
      for (const r of run.relics) counts[r.id] = (counts[r.id] || 0) + 1;
      const shown = new Set();
      run.relics.forEach((r, i) => {
        if (shown.has(r.id)) return;
        shown.add(r.id);
        const el = h('div', 'relic');
        el.dataset.relic = r.id;
        el.style.boxShadow = `inset 0 0 0 var(--px) ${RARITY[r.rarity].color}`;
        el.appendChild(relicIcon(r.id, RARITY[r.rarity].color));
        if (counts[r.id] > 1) el.appendChild(h('div', 'count', 'x' + counts[r.id]));
        if (grew && i === run.relics.length - 1) el.classList.add('pulse');
        this.tooltip(el, () => { const upg = g.relicUpgraded(r.id); return `<div class="t" style="color:${RARITY[r.rarity].color}">${r.name}${upg ? '+' : ''}</div><div class="r" style="color:${RARITY[r.rarity].color}">${RARITY[r.rarity].name}${upg ? ' · UPGRADED' : ''}</div>${r.desc}${upg ? `<br><span style="color:var(--gold)">+ ${r.up}</span>` : ''}${r.tags?.length ? `<div class="rtags">${this.relicTags(r)}</div>` : ''}`; });
        if (g.relicUpgraded(r.id)) el.appendChild(h('div', 'plus', '+'));
        if (e?.disabled?.[r.id]) { el.classList.add('lent'); el.appendChild(h('div', 'lent-k', 'LENT')); }
        if (run.over?.id === r.id) { el.classList.add('over'); el.appendChild(h('div', 'over-k', 'OC')); }
        this.h.relics.appendChild(el);
      });
    }
    // items
    const is = run.items.map(i => i.id).join(',') + JSON.stringify(g.armed || {});
    if (force || is !== this.sig.items) {
      this.sig.items = is;
      this.h.items.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const it = run.items[i];
        const s = h('div', 'slot');
        s.appendChild(h('div', 'k', String(i + 1)));
        if (it) {
          s.appendChild(relicIcon(it.id));
          this.tooltip(s, () => `<div class="t">${it.name}</div>${it.desc}<br><span style="color:var(--dim)">PRESS ${i + 1} TO USE</span>`);
          s.onclick = () => g.useItem(i);
        }
        this.h.items.appendChild(s);
      }
    }
  }

  tooltip(el, html) {
    el.addEventListener('mouseenter', () => {
      this.tip.innerHTML = html();
      this.tip.style.display = 'block';
      const r = el.getBoundingClientRect();
      const tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
      this.tip.style.left = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px';
      this.tip.style.top = Math.max(8, r.top - th - 8) + 'px';
    });
    el.addEventListener('mouseleave', () => { this.tip.style.display = 'none'; });
  }

  pulseRelic(id) {
    const el = this.h.relics.querySelector(`[data-relic="${id}"]`);
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  aimWarning(text) {
    if (text === this.lastWarn) return;
    this.lastWarn = text;
    if (!this.warnEl) { this.warnEl = h('div', 'aim-warn'); this.hud.appendChild(this.warnEl); }
    this.warnEl.innerHTML = text ? glyphHTML('warn') + ' ' + text : '';
    this.warnEl.style.display = text ? 'block' : 'none';
  }

  flashPower() {
    this.h.meter.classList.add('flash');
    clearTimeout(this.pwrT);
    this.pwrT = setTimeout(() => this.h.meter.classList.remove('flash'), 120);
  }

  // per-frame
  update(dt) {
    const g = this.g;
    if (this.hud.classList.contains('on')) {
      const shown = g.state === 'charge' ? g.charge : 0;
      this.h.fill.style.height = `calc(${shown * 100}% - var(--px) * ${4 * shown})`;
      this.h.cap.style.bottom = `calc(${g.power * 100}% - var(--px) * ${g.power * 2})`;
      this.h.dot.style.left = `${50 + g.spin.x * 38}%`;
      this.h.dot.style.top = `${50 - g.spin.y * 38}%`;
      if (g.run) {
        const run = g.run;
        const gr = styleGrade(run.style);
        const sg = this.h.style.querySelector('.sg');
        if (sg.textContent !== STYLE_GRADES[gr]) { sg.textContent = STYLE_GRADES[gr]; sg.style.color = STYLE_COL[gr]; this.h.style.dataset.g = gr; }
        this.h.style.querySelector('.sbar i').style.width = `${styleProgress(run.style) * 100}%`;
        const on = g.meta.s.heat !== false;
        this.h.heat.style.display = on ? '' : 'none';
        const hb = this.h.heat.querySelector('b');
        if (hb.textContent !== ROMAN[run.heat || 0]) { hb.textContent = ROMAN[run.heat || 0]; this.h.heat.dataset.h = run.heat || 0; }
        this.h.heat.querySelector('.hbar i').style.width = `${heatProgress(run.heatPts || 0) * 100}%`;
      }
      const rolling = (g.state === 'sim' || g.state === 'house') && g.shot && g.shot.simTime > 1.2;
      this.h.ff.style.opacity = rolling ? (g.keys.Space ? 1 : 0.7) : 0;
      this.h.ff.classList.toggle('on', !!g.keys.Space);
      this.hudT = (this.hudT || 0) + dt;
      if (this.hudT > 0.1) { this.hudT = 0; this.updateHUD(); }
    }
    // world-anchored pops
    for (let i = this.worldPops.length - 1; i >= 0; i--) {
      const p = this.worldPops[i];
      p.t += dt;
      const s = g.renderer.project(p.pos, g.camera);
      const k = p.t / p.life;
      p.el.style.left = s.x + 'px';
      p.el.style.top = (s.y - 20 - k * 50 * this.px / 2) + 'px';
      p.el.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
      const sc = p.scale * (k < 0.12 ? 0.6 + k / 0.12 * 0.6 : 1.2 - Math.min(0.2, (k - 0.12)));
      p.el.style.transform = `translate(-50%,-50%) scale(${sc})`;
      if (p.t >= p.life) { p.el.remove(); this.worldPops.splice(i, 1); }
    }
    this.updateTutorial(dt);
    this.updateLabels();
  }

  // ---------------------------------------------------------- popups
  popup(text, { color = '#fff', scale = 1 } = {}) {
    text = this.L(text);
    const el = h('div', 'pop');
    const size = 11 * scale;
    el.innerHTML = `<span style="font-size:calc(var(--px)*${size});color:${color};-webkit-text-stroke:calc(var(--px)*0.9) #000;text-shadow:calc(var(--px)*2) calc(var(--px)*2) 0 #000,0 0 calc(var(--px)*8) ${color}">${text}</span>`;
    this.pops.appendChild(el);
    // push older popups up
    for (const p of this.activePops) p.offset += size * this.px * 1.25;
    const rec = { el, offset: 0 };
    this.activePops.push(rec);
    const start = performance.now();
    const life = 1300 + scale * 250;
    const tick = () => {
      const t = (performance.now() - start) / life;
      if (t >= 1) { el.remove(); this.activePops.splice(this.activePops.indexOf(rec), 1); return; }
      let s;
      if (t < 0.08) s = 2.6 - (t / 0.08) * 1.8;
      else if (t < 0.16) s = 0.8 + ((t - 0.08) / 0.08) * 0.25;
      else s = 1.05 - Math.min(0.05, (t - 0.16));
      const y = -rec.offset - (t > 0.7 ? (t - 0.7) * 120 : 0);
      el.style.transform = `translate(-50%, ${y}px) scale(${s}) rotate(${(1 - Math.min(1, t * 8)) * -6}deg)`;
      el.style.opacity = t > 0.75 ? (1 - t) / 0.25 : 1;
      requestAnimationFrame(tick);
    };
    tick();
  }

  worldPop(text, pos, color = '#fff', scale = 1) {
    const el = h('div', 'wpop', this.L(text));
    el.style.color = color;
    this.pops.appendChild(el);
    this.worldPops.push({ el, pos: pos.clone(), t: 0, life: 1.0, scale });
  }

  chipGain(n) {
    const r = this.h.chipsBox.getBoundingClientRect();
    const el = h('div', 'chipgain', `+${n}`);
    el.style.left = (r.left - 10) + 'px'; el.style.top = (r.bottom) + 'px';
    this.pops.appendChild(el);
    el.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${20 * this.px}px)`, opacity: 0 }], { duration: 1200, easing: 'steps(12)' }).onfinish = () => el.remove();
  }

  tally(lines, total, mult, streak) {
    const t = this.h.tally;
    clearTimeout(this.tallyT);
    t.innerHTML = '';
    t.style.opacity = 1;
    lines.forEach(([k, v], i) => {
      setTimeout(() => {
        const l = h('div', 'line' + (v < 0 ? ' neg' : ''), `<span>${this.L(k)}</span><span class="v">${v > 0 ? '+' : ''}${fmt(v)}</span>`);
        t.insertBefore(l, t.querySelector('.total'));
        this.g.audio.tone(900 + i * 90, { type: 'square', dur: 0.04, vol: 0.04, filter: 3000 });
      }, i * 90);
    });
    const tot = h('div', 'total chrome', '0');
    const mul = mult !== 1 ? `<div class="mult">x${mult.toFixed(2).replace(/\.?0+$/, '')} MULT${streak >= 2 ? ` · STREAK ${streak}` : ''}</div>` : (streak >= 2 ? `<div class="mult">STREAK ${streak}</div>` : '');
    setTimeout(() => {
      t.appendChild(tot);
      if (mul) t.insertAdjacentHTML('beforeend', mul);
      const st = performance.now(), dur = Math.min(900, 250 + total / 10);
      const step = () => {
        const k = Math.min(1, (performance.now() - st) / dur);
        tot.textContent = fmt(total * k);
        if (k < 1) requestAnimationFrame(step);
        else if (total >= 1000) tot.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 250, easing: 'steps(5)' });
      };
      step();
    }, lines.length * 90 + 60);
    this.tallyT = setTimeout(() => { t.style.opacity = 0; }, 2600 + lines.length * 90);
  }

  toast(title, color = '#fff', kind = '') {
    title = this.L(title); kind = this.L(kind);
    const el = h('div', 'toast panel', `${kind ? `<div class="k">${kind}</div>` : ''}<div class="t" style="color:${color}">${title}</div>`);
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 3700);
  }

  achievement(data, id) {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;
    this.g.audio.levelUp();
    const el = h('div', 'toast panel', `<div class="k">${glyphHTML('star')} ACHIEVEMENT</div><div class="t" style="color:var(--gold)">${a.name}</div><div style="font-size:calc(var(--px)*4);color:var(--dim);margin-top:calc(var(--px)*2)">${a.desc}${a.reward ? `<br><span style="color:var(--cyan)">UNLOCKED ${a.reward}</span>` : ''}</div>`);
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 3700);
  }

  heartLost() {
    const c = heartIcon(true);
    c.className = 'px-icon heartlost';
    this.pops.appendChild(c);
    setTimeout(() => c.remove(), 1300);
  }

  chaosCard(r) {
    this.popup(r.name, { color: '#ff2bd6', scale: 1.3 });
    this.updateHUD(true);
  }

  // --------------------------------------------------------- tips
  showTip(id) {
    const g = this.g, d = g.meta.data;
    if (!TIPS[id] || d.tips?.[id]) return;
    d.tips = d.tips || {}; d.tips[id] = 1; g.meta.save();
    this.tipQueue = this.tipQueue || [];
    this.tipQueue.push(id);
    if (!this.tipEl) this.nextTip();
  }
  nextTip() {
    const id = this.tipQueue.shift();
    if (!id) { this.tipEl = null; return; }
    const [t, text] = TIPS[id];
    // at the table the right-hand middle is empty; over shops and choices it sits low, under the cards
    const atTable = ['aim', 'charge', 'place', 'sim', 'shooting', 'houseWait', 'house'].includes(this.g.state) && !this.stack.length;
    const el = h('div', 'tipbox panel ia' + (atTable ? '' : ' low'), `<div class="tk">${glyphHTML('star')} TIP</div><div class="tt">${t}</div><div class="tx">${text}</div>`);
    this.root.appendChild(el);
    this.tipEl = el;
    this.g.audio.tone(988, { type: 'square', dur: 0.06, vol: 0.05, filter: 3000 });
    let gone = false;
    const hide = () => { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => { el.remove(); this.nextTip(); }, 300); };
    el.addEventListener('click', (e) => { e.stopPropagation(); hide(); });
    setTimeout(hide, 7500);
  }

  // --------------------------------------------------------- tutorial
  // Five short lines, advanced by what the player actually does, then silence.
  startTutorialIfNeeded() {
    const g = this.g;
    if (g.meta.data.tutorialDone || !g.run || g.run.floor !== 1 || g.run.node !== 0) return;
    this.tut = { step: 0, el: null, t: 0, shots: 0 };
    g.tutorialAim = 0; g.tutorialWheel = false; g.tutorialShot = false;
    this.showTut('<b>MOVE THE MOUSE</b> TO AIM · THE DOTS SHOW WHERE THE CUE BALL GOES');
  }
  showTut(html) {
    if (this.tut?.el) this.tut.el.remove();
    const el = h('div', 'tut panel', html);
    this.root.appendChild(el);
    if (this.tut) this.tut.el = el;
    this.g.audio.ui('move');
  }
  updateTutorial(dt) {
    const t = this.tut, g = this.g;
    if (!t) return;
    const playing = ['aim', 'charge', 'shooting', 'sim', 'place'].includes(g.state) && !this.modalOpen();
    if (t.el) t.el.style.visibility = playing ? 'visible' : 'hidden';
    if (!g.run) { t.el?.remove(); this.tut = null; return; }
    t.t += dt;
    const shot = g.tutorialShot;
    if (shot) { g.tutorialShot = false; t.shots++; }
    const done = () => { if (t.el) t.el.remove(); this.tut = null; g.meta.data.tutorialDone = true; g.meta.save(); };
    if (t.step === 0 && (g.tutorialAim > 250 || t.shots)) { t.step = 1; t.t = 0; this.showTut('<b>HOLD</b> <span class="k">LEFT CLICK</span> TO CHARGE · <b>RELEASE</b> TO SHOOT'); }
    else if (t.step === 1 && t.shots) { t.step = 2; t.t = 0; if (t.el) t.el.remove(); t.el = null; }
    else if (t.step === 2 && g.state === 'aim') { t.step = 3; t.t = 0; this.showTut('<b>SINK THE BALLS</b> BEFORE YOUR <b>SHOTS</b> RUN OUT · YOUR GOAL IS TOP LEFT<br><span class="k">MOUSE WHEEL</span> SETS MAX POWER'); }
    else if (t.step === 3 && (t.shots >= 2 || t.t > 9)) { t.step = 4; t.t = 0; this.showTut('<span class="k">W A S D</span> ADDS <b>SPIN</b> TO THE CUE BALL · <span class="k">R</span> RESETS IT'); }
    else if (t.step === 4 && (t.shots >= 3 || t.t > 9)) { t.step = 5; t.t = 0; this.showTut('<span class="k">RIGHT-DRAG</span> TURNS THE CAMERA · <span class="k">C</span> TOP-DOWN VIEW · HOLD <span class="k">SPACE</span> TO FAST-FORWARD'); }
    else if (t.step === 5 && (t.shots >= 4 || t.t > 8)) done();
  }
  onShot() { }
  onAim() { this.placeHint?.remove(); this.placeHint = null; }
  onPlace() {
    this.placeHint?.remove();
    this.placeHint = h('div', 'tut panel', '<b>BALL IN HAND</b> · MOVE AND <span class="k">CLICK</span> TO PLACE THE CUE BALL');
    this.root.appendChild(this.placeHint);
  }

  // ------------------------------------------------------ run screens
  floorCard(n, name, jp, go) {
    const run = this.g.run;
    const el = h('div', 'screen dim');
    const labels = { table: 'TABLE', elite: 'ELITE', shop: 'SHOP', event: '?', boss: 'BOSS', mystery: '??', backroom: 'REST' };
    const lab = (nd) => nd.type === 'fork' ? nd.options.map(o => labels[o]).join('/') : labels[nd.type];
    const MODE_NOTE = { bossrush: 'BOSS RUSH · EVERY BOSS, BACK TO BACK', onecue: 'ONE CUE · EVERY MISS COSTS A LIFE', chaos: 'CHAOS · NOTHING IS STABLE' };
    const hand = run.hand?.length ? ` · HANDICAPS x${(run.rewardMul || 1).toFixed(2)}` : '';
    const note = n > 1 ? `${glyphHTML('heart')} +1 HEART RESTORED` : run.rookie ? `${glyphHTML('heart')} ROOKIE LUCK: +1 HEART FOR YOUR FIRST RUNS` : run.mode === 'daily' ? `${glyphHTML('star')} DAILY SCRATCH · ${run.daily} · THE SAME ROAD FOR EVERYONE TODAY` : MODE_NOTE[run.mode] ? `${glyphHTML('star')} ${MODE_NOTE[run.mode]}` : run.breakLv ? `${glyphHTML('flame')} BREAK ${run.breakLv}${hand}` : hand ? `${glyphHTML('flame')}${hand.slice(2)}` : '';
    el.innerHTML = `<div class="floor-card"><div class="n">FLOOR ${n}${run.endless ? '' : ' / 3'}${run.endless ? ' · ENDLESS' : ''}</div>${note ? `<div style="color:${n > 1 || run.rookie ? 'var(--red)' : 'var(--gold)'};font-size:calc(var(--px)*4);margin-top:calc(var(--px)*3)">${note}</div>` : ''}<div class="t chrome">${name}</div><div class="jp">${jp}</div>
      <div class="floor-map">${run.nodes.map(nd => `<span class="${nd.type === 'boss' ? 'boss' : nd.type === 'fork' ? 'fork' : ''}">${lab(nd)}</span>`).join('<span style="background:none;box-shadow:none;border:none;padding:0">·</span>')}</div>
      <div class="hint" style="margin-top:calc(var(--px)*12)">CLICK TO CONTINUE</div></div>`;
    this.g.state = 'floor';
    this.g.camMode = 'menu';
    this.g.audio.playMusic('menu');
    this.g.audio.bossStinger && this.g.audio.tone(110, { type: 'sawtooth', dur: 1.2, vol: 0.12, filter: 600, verb: 0.6 });
    let done = false;
    const fin = () => { if (done) return; done = true; this.g.audio.ui('select'); this.close(entry); go(); };
    const entry = this.open(el, { keys: (c) => { if (c === 'Enter' || c === 'Space') { fin(); return true; } return false; }, click: fin });
    el.addEventListener('click', fin);
    this.updateHUD(true);
  }

  chooseTable(choices, onPick) {
    const g = this.g;
    g.state = 'choose';
    g.camMode = 'shop';
    g.audio.playMusic('menu');
    const run = g.run;
    const el = h('div', 'screen dim');
    const node = run.nodes[run.node];
    const rj = run.mode === 'rajis';
    const title = rj ? 'CHOOSE YOUR MISSION' : node.type === 'elite' ? 'ELITE TABLE' : 'CHOOSE YOUR TABLE';
    const jp = rj ? '任務を選べ' : node.type === 'elite' ? '精鋭' : '台を選べ';
    const st = g.activeState?.();
    const where = rj ? `OPERATION ${run.op} · ${LOCATIONS[node.loc]?.name || ''}` : run.after ? '03:77 · AFTERHOURS' : `FLOOR ${run.floor}`;
    el.innerHTML = `<div class="title-bar chrome">${title}</div><div class="title-jp">${jp}</div><div class="row cards"></div><div class="hint">${where} · STOP ${run.node + 1} / ${run.nodes.length}${run.heat ? ` · ${this.L('HEAT')} ${ROMAN[run.heat]}` : ''}${st ? ` · <span style="color:${st.color}">${st.name} · ${run.tstate.left} LEFT</span>` : ''}</div>`;
    const row = el.querySelector('.row');
    const cards = choices.map(c => {
      const e = c.enc;
      const rv = e.rivalDef;
      const cls = c.anomaly ? ' anomaly' : c.kind === 'elite' ? ' legendary' : c.stake ? ' stakes' : c.kind === 'highroller' ? ' roller' : rv ? ' rivalc' : c.kind === 'trickshot' ? ' trickc' : '';
      const card = h('div', 'card panel table-card' + cls);
      if (rv) card.style.setProperty('--rc', rv.color);
      const shots = e.def.id === 'blitz' ? `${e.p.time}s` : run.oneCue && c.kind !== 'trickshot' ? '∞' : `${e.shots}`;
      const tag = c.anomaly ? `${glyphHTML('anomaly')} ${c.anomaly.secret ? '???' : 'ANOMALY'}` : c.kind === 'elite' ? `${glyphHTML('star')} ${c.heatElite ? 'HEAT ELITE' : 'ELITE'}` : c.stake ? `${glyphHTML('dice')} HIGH STAKES`
        : c.kind === 'highroller' ? `${glyphHTML('roller')} HIGH ROLLER` : rv ? `${glyphHTML('rival')} ${e.nemesis ? 'NEMESIS' : 'RIVAL'}` : c.kind === 'trickshot' ? `${glyphHTML('puzzle')} TRICK TABLE` : rj ? `MISSION · ${LOCATIONS[c.loc]?.name || ''}` : e.def.tag;
      const stake = c.stake ? `<div class="stake">${glyphHTML('warn')} ${c.stake.name}<span>${stakeText(c.stake, e)}<br>BREAK IT AND THE TABLE IS LOST.</span></div>` : '';
      const mods = (c.mods || []).map(m => `<div class="mod">${glyphHTML('diamond')} ${m.name}<span>${m.desc}</span></div>`).join('');
      const bigName = c.anomaly ? c.anomaly.name : rv ? rv.name : c.kind === 'trickshot' ? e.puzzle.name : rj ? c.mission : e.def.name;
      const desc = c.anomaly ? c.anomaly.desc : rv ? rv.style : c.kind === 'trickshot' ? e.def.blurb : c.kind === 'highroller' ? 'A harder table. Bet your own chips on it. Win and they come back doubled.' : e.def.blurb;
      const reward = c.anomaly ? 'LEGENDARY ODDS' : c.stake || c.kind === 'highroller' || c.kind === 'trickshot' ? 'RARE+ RELIC' : rv ? (e.nemesis ? 'LEGENDARY ODDS' : 'RARE RELIC') : c.kind === 'elite' ? 'RARE RELIC' : 'RELIC';
      const nemesis = rv && e.nemesis ? `<div class="taunt" style="color:var(--red)">${rv.name.replace('THE ', '')} REMEMBERS YOU.</div>` : rv ? `<div class="taunt">${rv.taunt}</div>` : '';
      card.innerHTML = this.L(`<div class="rr" style="color:${c.anomaly ? '#c08aff' : c.kind === 'elite' || c.kind === 'highroller' ? 'var(--gold)' : c.stake ? 'var(--red)' : rv ? rv.color : 'var(--cyan)'}">${tag}</div>
        <div class="big chrome">${bigName}</div>
        <div class="ds">${desc}</div>${nemesis}
        <div class="tagline">${c.anomaly || rv || c.kind === 'trickshot' ? e.def.name + ' — ' : ''}${e.def.objective({ ...e, progress: 0 })}</div>
        ${stake}${mods}
        <div class="kv"><span>${e.def.id === 'blitz' ? 'TIME' : c.kind === 'trickshot' ? 'ATTEMPTS' : 'SHOTS'}</span><b>${shots}</b></div>
        <div class="kv"><span>PURSE</span><b style="color:var(--gold)">${c.kind === 'highroller' ? `${e.reward} + YOUR BET x2` : `${e.reward} CHIPS`}</b></div>
        <div class="kv"><span>REWARD</span><b>${reward}</b></div>
        ${st && !e.def.boss && c.kind !== 'trickshot' ? `<div class="state-line" style="color:${st.color}">${st.name}${st.reward > 1 ? ` · PURSE x${st.reward}` : st.chipsMul ? ` · CHIPS x${st.chipsMul}` : ''}</div>` : ''}${c.kind === 'trickshot' ? '<div class="state-line" style="color:var(--green)">NO HEART AT RISK</div>' : ''}`);
      if (rv) { const ic = relicIcon(rv.icon, rv.color); ic.classList.add('rival-ico'); card.insertBefore(ic, card.children[1]); }
      row.appendChild(card);
      return card;
    });
    const keys = this.navList(cards, { horizontal: true, onSelect: (i) => { g.audio.ui('select'); this.close(entry); this.transition(() => onPick(choices[i])); } });
    const entry = this.open(el, { keys });
    if (choices.some(c => c.stake)) this.showTip('stakes');
    if (choices.some(c => c.anomaly)) this.showTip('anomaly');
    if (choices.some(c => c.enc.rivalDef)) this.showTip('rival');
    if (choices.some(c => c.kind === 'highroller')) this.showTip('roller');
    if (choices.some(c => c.kind === 'trickshot')) this.showTip('trick');
  }

  // CHOOSE YOUR PATH: a fork in the road
  choosePath(options, onPick) {
    const g = this.g;
    g.state = 'choose';
    g.camMode = 'shop';
    g.audio.playMusic('menu');
    const INFO = {
      event: ['STRANGE EVENT', '?', 'Someone wants something. It might be worth it.', 'var(--hot)'],
      mystery: ['MYSTERY', '??', 'A treasure, a trap, a bargain or a table from another world.', '#c08aff'],
      shop: ['THE CHALK SHOP', 'SHOP', 'Spend your chips. Sell what you don\'t need.', 'var(--gold)'],
      backroom: ['THE BACK ROOM', 'REST', 'Patch up (+2 hearts), tune up a relic, or pocket some chips.', 'var(--green)'],
    };
    const el = h('div', 'screen dim');
    el.innerHTML = `<div class="title-bar chrome">CHOOSE YOUR PATH</div><div class="title-jp">道を選べ</div><div class="row cards"></div><div class="hint">FLOOR ${g.run.floor} · STOP ${g.run.node + 1} / ${g.run.nodes.length}</div>`;
    const row = el.querySelector('.row');
    const cards = options.map(o => {
      const [t, k, d, c] = INFO[o];
      const card = h('div', 'card panel path-card');
      card.innerHTML = `<div class="pk" style="color:${c}">${k}</div><div class="big chrome">${t}</div><div class="ds">${d}</div>`;
      row.appendChild(card);
      return card;
    });
    const keys = this.navList(cards, { horizontal: true, onSelect: (i) => { g.audio.ui('select'); this.close(entry); this.transition(() => onPick(options[i])); } });
    const entry = this.open(el, { keys });
    this.showTip('path');
  }

  mysteryReveal(kind, go) {
    const g = this.g;
    const T = { event: ['A STRANGER', 'Somebody has been waiting for you.'], treasure: ['TREASURE', 'Something shiny under the table.'], ambush: ['AN AMBUSH', 'The table in the back room is not right.'], bargain: ['A BARGAIN', 'A cursed thing, and a pile of chips for taking it.'] };
    const el = h('div', 'screen dim');
    el.innerHTML = `<div class="panel event-box" style="text-align:center"><div class="rr" style="font-size:calc(var(--px)*4);color:#c08aff;letter-spacing:0.3em">?? MYSTERY ??</div><div class="event-title chrome">${T[kind][0]}</div><div class="event-text">${T[kind][1]}</div><div style="margin-top:calc(var(--px)*6)"><button class="btn">OPEN THE DOOR</button></div></div>`;
    g.state = 'event'; g.camMode = 'shop';
    g.audio.tone(330, { type: 'sine', dur: 0.8, vol: 0.12, slide: 660, verb: 0.6 });
    let done = false;
    const fin = () => { if (done) return; done = true; g.audio.ui('select'); this.close(entry); this.transition(go); };
    el.querySelector('.btn').onclick = (e) => { e.stopPropagation(); fin(); };
    const entry = this.open(el, { keys: (c) => { if (c === 'Enter' || c === 'Space') { fin(); return true; } return false; } });
  }

  bargain(relic, cb) {
    const g = this.g;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel event-box');
    el.appendChild(box);
    if (!relic) { cb(false); return; }
    const rar = RARITY[relic.rarity];
    box.innerHTML = `<div class="rr" style="font-size:calc(var(--px)*4);color:var(--red);letter-spacing:0.3em">CURSED BARGAIN</div><div class="event-title chrome">TAKE IT. TAKE THE CHIPS.</div><div class="bargain-relic"></div><div class="menu"></div>`;
    const card = h('div', `card panel ${relic.rarity}`);
    const ic = relicIcon(relic.id, rar.color); ic.classList.add('ico'); card.appendChild(ic);
    card.insertAdjacentHTML('beforeend', `<div class="nm" style="color:${rar.color}">${relic.name}</div><div class="ds">${relic.desc}</div>`);
    box.querySelector('.bargain-relic').appendChild(card);
    const menu = box.querySelector('.menu');
    const items = ['TAKE IT (+25 CHIPS)', 'WALK AWAY'].map(t => { const m = h('div', 'mi shadow', t); menu.appendChild(m); return m; });
    let done = false;
    const keys = this.navList(items, { onSelect: (i) => { if (done) return; done = true; g.audio.ui(i === 0 ? 'select' : 'back'); this.close(entry); cb(i === 0); } });
    const entry = this.open(el, { keys });
  }

  backRoom(opts, cb) {
    const g = this.g;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel event-box');
    box.innerHTML = `<div class="rr" style="font-size:calc(var(--px)*4);color:var(--green);letter-spacing:0.3em">THE BACK ROOM</div><div class="event-title chrome">A QUIET MINUTE.</div><div class="event-text">A sofa, a sink, a man with a very small screwdriver.</div><div class="menu"></div>`;
    el.appendChild(box);
    const menu = box.querySelector('.menu');
    const defs = [
      ['REST', opts.canRest ? '+2 HEARTS' : 'YOU FEEL FINE ALREADY', opts.canRest],
      ['TUNE UP A RELIC', opts.upgradeable.length ? 'UPGRADE ONE RELIC TO +' : 'NOTHING TO TUNE', opts.upgradeable.length > 0],
      ['CHECK THE COUCH', '+12 CHIPS', true],
    ];
    const items = defs.map(([t, sub, ok]) => { const m = h('div', 'mi shadow' + (ok ? '' : ' disabled'), `${t}<span class="sub">${sub}</span>`); menu.appendChild(m); return m; });
    let done = false;
    const keys = this.navList(items, {
      onSelect: (i) => {
        if (done || !defs[i][2]) { g.audio.ui('deny'); return; }
        if (i === 1) {
          this.pickRelic(opts.upgradeable, 'TUNE UP WHICH RELIC?', (r) => { if (!r) return; done = true; this.close(entry); cb('tune', r); }, (r) => r.up);
          return;
        }
        done = true; g.audio.ui('select'); this.close(entry); cb(i === 0 ? 'rest' : 'chips');
      },
    });
    const entry = this.open(el, { keys });
  }

  // choose one of your relics (tune-up, selling)
  pickRelic(list, title, cb, sub = null) {
    const g = this.g;
    const el = h('div', 'screen dim');
    el.innerHTML = `<div class="title-bar chrome">${title}</div><div class="shop-grid"></div><div style="margin-top:calc(var(--px)*6)"><button class="btn small">CANCEL</button></div>`;
    const grid = el.querySelector('.shop-grid');
    let entry;
    const pick = (r) => { g.audio.ui(r ? 'select' : 'back'); this.close(entry); cb(r); };
    list.forEach(r => {
      const rar = RARITY[r.rarity];
      const card = h('div', `card panel ${r.rarity}`);
      const ic = relicIcon(r.id, rar.color); ic.classList.add('ico'); card.appendChild(ic);
      card.insertAdjacentHTML('beforeend', `<div class="nm" style="color:${rar.color}">${this.relicName(r)}</div><div class="ds">${sub ? sub(r) : r.desc}</div>`);
      card.onclick = (e) => { e.stopPropagation(); pick(r); };
      grid.appendChild(card);
    });
    el.querySelector('.btn').onclick = (e) => { e.stopPropagation(); pick(null); };
    entry = this.open(el, { keys: (c) => { if (c === 'Escape') { pick(null); return true; } return false; } });
  }

  relicName(r) { return r.name + (this.g.relicUpgraded?.(r.id) ? '+' : ''); }
  relicTags(r) { return (r.tags || []).map(t => `<span class="rtag" style="color:${TAG_COLORS[t]};border-color:${TAG_COLORS[t]}">${t}</span>`).join('') + (r.risk ? '<span class="rtag risk">RISK</span>' : ''); }

  bossPhase(def, n, text) {
    const el = h('div', 'phase-banner');
    el.style.setProperty('--bc', def.color);
    el.innerHTML = `<div class="pk">${def.name}</div><div class="pt">PHASE ${ROMAN[n]}</div><div class="pd">${text}</div>`;
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 2600);
    this.updateHUD(true);
  }

  challengeOffer(ch, e, cb) {
    const g = this.g;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel offer-box');
    box.innerHTML = `<div class="offer-k">${glyphHTML('dice')} OPTIONAL BET ${glyphHTML('dice')}</div>
      <div class="title-bar chrome" style="text-align:center">DOUBLE OR NOTHING</div>
      <div class="offer-sub">${e.def.name} — complete it with:</div>
      <div class="offer-cond">${ch.name}</div>
      <div class="offer-desc">${ch.desc.replace('{N}', e.chN ?? '?')}</div>
      <div class="offer-rew"><div>${glyphHTML('check')} WIN THE BET: <b>2X CHIPS (+${e.reward})</b></div><div>${glyphHTML('star')} <b>RARE RELIC CHANCE</b></div><div>${glyphHTML('flame')} <b>+HEAT</b></div><div class="lose">${glyphHTML('cross')} BREAK IT: NO PURSE AT ALL</div></div>
      <div class="offer-btns"><button class="btn gold">ACCEPT</button><button class="btn">NORMAL TABLE</button></div>`;
    el.appendChild(box);
    const btns = [...box.querySelectorAll('.btn')];
    let done = false;
    const fin = (acc) => { if (done) return; done = true; g.audio.ui(acc ? 'select' : 'back'); this.close(entry); cb(acc); };
    const keys = this.navList(btns, { horizontal: true, onSelect: (i) => fin(i === 0) });
    const entry = this.open(el, { keys });
    g.audio.tone(330, { type: 'square', dur: 0.12, vol: 0.08, filter: 2000 });
    g.audio.tone(495, { t: g.audio.now + 0.12, type: 'square', dur: 0.2, vol: 0.08, filter: 2000 });
    this.showTip('bet');
  }

  encounterIntro(e, go) {
    const g = this.g, run = g.run;
    const tables = run.nodes.filter(n => ['table', 'elite', 'boss'].includes(n.type)).length;
    const idx = run.nodes.slice(0, run.node + 1).filter(n => ['table', 'elite', 'boss'].includes(n.type)).length;
    const el = h('div', 'screen');
    const extra = [
      e.rivalDef ? `<span style="color:${e.rivalDef.color}">${e.nemesis ? `${e.rivalDef.name} REMEMBERS YOU.` : `${e.rivalDef.name} · ${e.rivalDef.taunt}`}</span>` : '',
      e.hr ? `${glyphHTML('roller')} ${e.hrAll ? 'ALL IN' : 'BET'}: ${e.hr} CHIPS` : '',
      e.tstate ? `<span style="color:${e.tstate.color}">${e.tstate.name} — ${e.tstate.desc}</span>` : '',
      ...(e.mods || []).map(m => `${glyphHTML('diamond')} ${m.name} — ${m.desc}`),
      e.challenge ? `${glyphHTML('dice')} BET: ${e.challenge.name}` : '',
      e.stake ? `${glyphHTML('warn')} HIGH STAKES: ${e.stake.name} — ${stakeText(e.stake, e)}` : '',
    ].filter(Boolean).map(t => `<div class="m">${t}</div>`).join('');
    const rj = run.mode === 'rajis';
    const where = rj ? `OPERATION ${run.op} · ${LOCATIONS[run.nodes[run.node]?.loc]?.name || ''}` : run.after ? '03:77' : `FLOOR ${run.floor}`;
    const title = e.anomaly ? e.anomaly.name : e.rivalDef ? e.rivalDef.name : e.puzzle ? e.puzzle.name : rj && MISSIONS[e.def.id] ? MISSIONS[e.def.id] : e.def.name;
    const budget = e.def.id === 'blitz' ? e.timer + ' SECONDS' : e.puzzle ? `${e.shots} ATTEMPTS · NO CLOCK` : run.oneCue ? 'NO SHOT LIMIT' : e.shots + ' SHOTS';
    el.innerHTML = this.L(`<div class="banner${e.anomaly ? ' anomaly' : ''}"><div class="k">${where} · TABLE ${idx}/${tables}${e.kind === 'elite' ? ' · ELITE' : ''}${e.anomaly ? ' · ANOMALY' : ''}${e.kind === 'highroller' ? ' · HIGH ROLLER' : ''}</div><div class="t chrome">${title}</div><div class="o">${e.def.objective(e)} · ${budget}</div>${e.anomaly ? `<div class="m" style="color:#c08aff">${e.anomaly.desc}</div>` : ''}${extra}</div>`);
    if (e.rivalDef && e.nemesis) { g.audio.tone(110, { type: 'sawtooth', dur: 1.2, vol: 0.15, filter: 500, verb: 0.6 }); }
    g.audio.tone(220, { type: 'square', dur: 0.1, vol: 0.08, filter: 2000 });
    g.audio.tone(440, { t: g.audio.now + 0.1, type: 'square', dur: 0.2, vol: 0.08, filter: 2000 });
    let done = false;
    const fin = () => {
      if (done) return; done = true;
      el.querySelector('.banner').classList.add('out');
      setTimeout(() => { this.close(entry); go(); }, 250);
    };
    const entry = this.open(el, { keys: () => { fin(); return true; }, click: fin });
    el.addEventListener('click', fin);
    setTimeout(fin, 2400 + (e.mods?.length || 0) * 500 + (e.challenge ? 500 : 0) + (e.anomaly ? 600 : 0) + (e.rivalDef ? 700 : 0) + (e.tstate ? 500 : 0));
    this.updateHUD(true);
    if (['sequence', 'territory', 'bounty', 'hotpotato', 'lockdown', 'route'].includes(e.def.id)) this.showTip('labels');
  }

  // ------------------------------------------------ mastery feedback
  synergy(label) {
    const el = h('div', 'synergy', `<span>SYNERGY</span>${label}`);
    this.pops.appendChild(el);
    const n = this.pops.querySelectorAll('.synergy').length;
    el.style.top = `calc(22% + ${(n - 1) * 7}%)`;
    setTimeout(() => el.remove(), 1600);
  }

  styleUp(gr, quiet = false) {
    if (!quiet) this.popup(`STYLE ${STYLE_GRADES[gr]}!`, { color: STYLE_COL[gr], scale: gr >= 4 ? 1.6 : 1.2 });
    this.showTip('style');
    const el = this.h.style;
    if (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }
  styleDrop() {
    const el = this.h.style;
    if (el) { el.classList.remove('drop'); void el.offsetWidth; el.classList.add('drop'); }
  }
  heatUp(hv) {
    const el = h('div', 'heat-banner');
    el.innerHTML = `<div class="hk">${glyphHTML('flame')} THE CLUB IS WATCHING ${glyphHTML('flame')}</div><div class="ht">HEAT <span>${ROMAN[hv]}</span></div><div class="hd">${HEAT_DESC[hv]}</div>`;
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
  reaction(word, techs = []) {
    const el = h('div', 'reaction');
    el.innerHTML = `<div class="rw">${word}</div><div class="rt">${techs.join(' · ')}</div>`;
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  bossIntro(def, go, e = null) {
    const g = this.g;
    const el = h('div', 'screen letterbox');
    el.innerHTML = `<div class="boss-warn">${glyphHTML('warn')} WARNING ${glyphHTML('warn')} ${e?.remix ? 'REMIX' : 'BOSS TABLE'} ${glyphHTML('warn')} WARNING ${glyphHTML('warn')}</div><div class="boss-name chrome" style="filter:drop-shadow(0 0 calc(var(--px)*10) ${def.color})">${def.name}${e?.remix ? '<span style="display:block;font-size:0.4em;letter-spacing:0.3em">(REMIX)</span>' : ''}</div><div class="boss-jp" style="color:${def.color}">${def.jp}</div><div class="boss-intro shadow"></div><div class="hint">${def.blurb}</div>`;
    g.screenFlash(0x000000, 0.6);
    let done = false;
    const fin = () => {
      if (done) return; done = true;
      this.close(entry);
      g.lights.lampMul = 0.3;
      g.screenFlash(new (g.renderer.flash.color.constructor)(def.color).getHex(), 0.5);
      g.shake(0.6);
      g.audio.explosion(1.5);
      go();
    };
    const entry = this.open(el, { keys: () => { fin(); return true; }, click: fin });
    el.addEventListener('click', fin);
    this.type(el.querySelector('.boss-intro'), def.intro, 45, 1400);
    setTimeout(fin, 5200);
    this.showTip('boss');
  }

  type(el, text, speed = 30, delay = 0) {
    let i = 0;
    const tick = () => {
      if (!el.isConnected && i > 0) return;
      el.textContent = text.slice(0, ++i);
      if (i % 2 === 0 && text[i - 1] !== ' ') this.g.audio.tone(1200 + Math.random() * 200, { type: 'square', dur: 0.02, vol: 0.025, filter: 3000 });
      if (i < text.length) setTimeout(tick, speed);
    };
    setTimeout(tick, delay);
  }

  encounterResult(res, cont) {
    const g = this.g;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel');
    box.style.minWidth = 'calc(var(--px)*170)';
    el.appendChild(box);
    let entry;
    if (res.won) {
      box.innerHTML = `<div class="title-bar chrome" style="text-align:center">${this.L(g.enc.def.boss ? 'BOSS DEFEATED' : g.enc.puzzle ? 'SOLVED' : 'TABLE CLEARED')}</div><div class="title-jp" style="text-align:center">勝利</div><div class="result-lines"></div><div class="result-total" style="visibility:hidden"><span>TOTAL</span><span style="display:flex;align-items:center;gap:calc(var(--px)*3)">${CHIP()}<span class="tt">0</span></span></div><div style="text-align:center;margin-top:calc(var(--px)*4);font-size:calc(var(--px)*4);color:var(--dim)">TABLE SCORE ${fmt(res.score)}</div><div style="text-align:center;margin-top:calc(var(--px)*8)"><button class="btn">CONTINUE</button></div>`;
      const lines = box.querySelector('.result-lines');
      res.lines.forEach(([k, v], i) => setTimeout(() => {
        lines.appendChild(h('div', 'line', `<span>${this.L(k)}</span><span class="v">${v < 0 ? '' : '+'}${v} ${CHIP()}</span>`));
        g.audio.coin(1);
      }, 250 + i * 220));
      setTimeout(() => {
        const tt = box.querySelector('.result-total');
        tt.style.visibility = 'visible';
        tt.querySelector('.tt').textContent = res.total;
        tt.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 250, easing: 'steps(4)' });
        g.audio.coin(4);
      }, 350 + res.lines.length * 220);
    } else if (res.free) {
      box.innerHTML = `<div class="title-bar chrome" style="text-align:center">${this.L(res.reason)}</div><div class="title-jp" style="text-align:center">惜しい</div><div class="confirm">THE TRICK TABLE WINS THIS TIME.<br><span style="color:var(--dim)">NO HEART LOST · NO PRIZE · THE NIGHT GOES ON</span></div><div style="text-align:center;margin-top:calc(var(--px)*8)"><button class="btn">MOVE ON</button></div>`;
    } else {
      box.innerHTML = this.L(`<div class="title-bar chrome" style="text-align:center;color:var(--red)">${res.reason}</div><div class="title-jp" style="text-align:center">敗北</div><div class="confirm">YOU LOST A HEART.<br><span style="color:var(--dim)">${res.hearts} HEART${res.hearts === 1 ? '' : 'S'} REMAINING · ${res.retry ? 'THE BOSS AWAITS A REMATCH' : 'NO REWARD — THE NIGHT GOES ON'}</span></div><div class="hearts" style="justify-content:center;margin-top:calc(var(--px)*6);display:flex;gap:calc(var(--px)*2)"></div><div style="text-align:center;margin-top:calc(var(--px)*8)"><button class="btn">${res.retry ? 'REMATCH' : 'MOVE ON'}</button></div>`);
      const hh = box.querySelector('.hearts');
      for (let i = 0; i < g.run.maxHearts; i++) { const c = heartIcon(i < res.hearts); c.style.width = 'calc(var(--px)*14)'; c.style.height = 'calc(var(--px)*12)'; hh.appendChild(c); }
    }
    const fin = () => { g.audio.ui('select'); this.close(entry); cont(); };
    box.querySelector('.btn').onclick = (e) => { e.stopPropagation(); fin(); };
    entry = this.open(el, { keys: (c) => { if (c === 'Enter' || c === 'Space') { fin(); return true; } return false; } });
  }

  relicCard(r) {
    const g = this.g, rar = RARITY[r.rarity];
    const owned = g.run?.relics.some(x => x.id === r.id) && !r.stack;
    const card = h('div', `card panel ${r.rarity}${owned ? ' upgrade' : ''}`);
    const ic = relicIcon(r.id, rar.color); ic.classList.add('ico');
    card.appendChild(ic);
    if (owned) card.insertAdjacentHTML('beforeend', `<div class="nm" style="color:${rar.color}">${r.name}+</div><div class="rr" style="color:var(--gold)">${glyphHTML('star')} UPGRADE ${glyphHTML('star')}</div><div class="ds">${r.up}</div>`);
    else card.insertAdjacentHTML('beforeend', `<div class="nm" style="color:${rar.color}">${r.name}</div><div class="rr" style="color:${rar.color}">${rar.name}</div><div class="ds">${r.desc}</div>`);
    if (r.tags?.length) card.insertAdjacentHTML('beforeend', `<div class="rtags">${this.relicTags(r)}</div>`);
    if (g.meta.data.favorites?.[r.id]) { const fm = glyph('star'); fm.classList.add('fav-mark'); card.appendChild(fm); }
    return card;
  }

  relicChoice(relics, onPick, { title = 'CHOOSE A RELIC', skip = true } = {}) {
    const g = this.g;
    const el = h('div', 'screen dim');
    el.innerHTML = `<div class="title-bar chrome">${title}</div><div class="title-jp">遺物を選べ</div><div class="row"></div>${skip ? '<div style="margin-top:calc(var(--px)*8)"><button class="btn small">SKIP  (+3 CHIPS)</button></div>' : ''}`;
    const row = el.querySelector('.row');
    const cards = relics.map(r => { const card = this.relicCard(r); row.appendChild(card); return card; });
    let done = false;
    const pick = (r) => { if (done) return; done = true; g.audio.ui('select'); this.close(entry); onPick(r); };
    const keys = this.navList(cards, { horizontal: true, onSelect: (i) => pick(relics[i]) });
    if (skip) el.querySelector('.btn').onclick = (e) => { e.stopPropagation(); pick(null); };
    const entry = this.open(el, { keys });
    g.state = 'reward';
    g.camMode = 'result';
    g.audio.combo(2);
    this.showTip('relics');
    if (relics.some(r => g.run?.relics.some(x => x.id === r.id) && !r.stack)) this.showTip('upgrade');
  }

  discardRelic(current, incoming, onDone) {
    const g = this.g;
    const el = h('div', 'screen dim');
    el.innerHTML = `<div class="title-bar chrome">RELIC SLOTS FULL</div><div class="title-jp">捨てる遺物を選べ</div><div class="hint" style="margin:0 0 calc(var(--px)*6)">CHOOSE ONE TO LEAVE BEHIND</div><div class="shop-grid"></div>`;
    const grid = el.querySelector('.shop-grid');
    [...current, incoming].forEach((r, i) => {
      const rar = RARITY[r.rarity];
      const card = h('div', `card panel ${r.rarity}`);
      const ic = relicIcon(r.id, rar.color); ic.classList.add('ico');
      card.appendChild(ic);
      card.insertAdjacentHTML('beforeend', `<div class="nm" style="color:${rar.color}">${r.name}</div><div class="rr" style="color:${r === incoming ? 'var(--gold)' : rar.color}">${r === incoming ? glyphHTML('star') + ' NEW ' + glyphHTML('star') : rar.name}</div><div class="ds">${r.desc}</div><div class="price" style="color:var(--red)">DISCARD</div>`);
      card.onclick = (ev) => { ev.stopPropagation(); g.audio.ui('back'); this.close(entry); onDone(r); };
      grid.appendChild(card);
    });
    const entry = this.open(el, {});
    g.audio.ui('deny');
  }

  shop(stock, H) {
    const g = this.g;
    const el = h('div', 'screen dim');
    const rj = g.run?.mode === 'rajis';
    el.innerHTML = this.L(`<div class="shop-head"><div class="title-bar chrome" style="margin:0">${rj ? 'COMMAND · REQUISITIONS' : 'THE CHALK SHOP'}</div><div class="title-jp" style="margin:0">${rj ? '補給' : '売店'}</div></div><div class="shopkeeper"></div><div class="shop-grid"></div><div class="shop-foot"><button class="btn small reroll"></button><button class="btn small sell">SELL A RELIC</button><button class="btn gold leave">LEAVE ${glyphHTML('arrowR')}</button></div>`);
    const grid = el.querySelector('.shop-grid');
    const lines = rj ? QUARTERMASTER : SHOPKEEP;
    this.type(el.querySelector('.shopkeeper'), '"' + lines[Math.floor(Math.random() * lines.length)] + '"', 30, 200);
    const render = (items) => {
      grid.innerHTML = '';
      items.forEach(it => {
        const card = h('div', 'card panel');
        let icon, name, sub, desc, col = '#fff';
        if (it.type === 'relic') { icon = [it.relic.id, RARITY[it.relic.rarity].color]; name = it.relic.name; col = RARITY[it.relic.rarity].color; sub = RARITY[it.relic.rarity].name; desc = it.relic.desc; card.classList.add(it.relic.rarity); }
        else if (it.type === 'item') { icon = [it.item.id, '#2bf0ff']; name = it.item.name; sub = 'ONE-TIME ITEM'; desc = it.item.desc; col = 'var(--cyan)'; }
        else if (it.type === 'heal') { icon = ['heal', '#ff3b5c']; name = 'HEART'; sub = 'HEAL'; desc = 'Restore one heart.'; col = 'var(--red)'; }
        else if (it.type === 'maxheart') { icon = ['heal', '#ffc21c']; name = 'IRON HEART'; sub = 'PERMANENT'; desc = '+1 max heart for this run.'; col = 'var(--gold)'; }
        else if (it.type === 'mystery') { icon = ['mystery', '#c08aff']; name = 'MYSTERY RELIC'; sub = '???'; desc = 'Could be anything. Could be cursed.'; col = '#c08aff'; }
        else if (it.type === 'upgrade') { icon = [it.relic.id, '#ffe23b']; name = it.relic.name + '+'; sub = 'TUNE-UP'; desc = it.relic.up; col = 'var(--gold)'; card.classList.add('upgrade'); }
        else if (it.type === 'bargain') { icon = [it.relic.id, RARITY.cursed.color]; name = it.relic.name; sub = 'CURSED BARGAIN'; desc = it.relic.desc + ' He pays YOU to take it.'; col = 'var(--red)'; card.classList.add('cursed'); }
        else { const c = it.cos; name = c.item.name; sub = c.kind === 'ball' ? 'BALL SET · PERMANENT' : 'CUE · PERMANENT'; desc = c.item.desc; col = 'var(--gold)'; icon = null; }
        if (icon) { const ic = relicIcon(icon[0], icon[1]); ic.classList.add('ico'); card.appendChild(ic); }
        else { const pv = cosmeticPreview(it.cos); pv.classList.add('ico'); card.appendChild(pv); }
        const priceTxt = it.price < 0 ? `+${-it.price} ${CHIP()}` : `${CHIP()}${it.price}`;
        card.insertAdjacentHTML('beforeend', this.L(`<div class="nm" style="color:${col}">${name}</div><div class="rr" style="color:${col}">${sub}</div><div class="ds">${desc}</div>${it.type === 'relic' && it.relic.tags?.length ? `<div class="rtags">${this.relicTags(it.relic)}</div>` : ''}`) + `<div class="price${it.price < 0 ? ' pays' : ''}">${priceTxt}</div>`);
        const refresh = () => card.classList.toggle('cant', g.run.chips < it.price);
        refresh();
        card.onclick = () => {
          if (it.sold) return;
          if (H.buy(it)) {
            it.sold = true; card.classList.add('sold');
            card.querySelector('.price').innerHTML = it.revealed ? it.revealed.name : 'SOLD';
            if (it.type === 'item') this.showTip('items');
            grid.querySelectorAll('.card').forEach(c => c.dispatchEvent(new Event('refresh')));
          }
        };
        card.addEventListener('refresh', refresh);
        grid.appendChild(card);
      });
    };
    render(stock);
    const rr = el.querySelector('.reroll');
    const drawReroll = () => { rr.textContent = `REROLL (${H.rerollCost()})`; };
    drawReroll();
    rr.onclick = (e) => { e.stopPropagation(); const s = H.reroll(); if (s) { render(s); drawReroll(); } };
    const sellBtn = el.querySelector('.sell');
    const drawSell = () => { sellBtn.classList.toggle('off', !g.run.relics.length); };
    drawSell();
    sellBtn.onclick = (e) => {
      e.stopPropagation();
      if (!g.run.relics.length) { g.audio.ui('deny'); return; }
      this.pickRelic(g.run.relics, 'SELL WHICH RELIC?', (r) => { if (r) { H.sell(r); grid.querySelectorAll('.card').forEach(c => c.dispatchEvent(new Event('refresh'))); drawSell(); } }, (r) => `SELLS FOR ${H.sellPrice(r)} CHIPS`);
    };
    this.showTip('shop');
    const leave = () => { g.audio.ui('back'); this.close(entry); H.leave(); };
    el.querySelector('.leave').onclick = (e) => { e.stopPropagation(); leave(); };
    const entry = this.open(el, { keys: (c) => { if (c === 'Escape') { leave(); return true; } return false; } });
  }

  event(ev, choose, done) {
    const g = this.g;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel event-box');
    box.innerHTML = `<div class="rr" style="font-size:calc(var(--px)*4);color:var(--hot);letter-spacing:0.3em;margin-bottom:calc(var(--px)*4)">? STRANGE EVENT ?</div><div class="event-title chrome"></div><div class="event-text"></div><div class="menu" style="margin-top:calc(var(--px)*4)"></div>`;
    el.appendChild(box);
    box.querySelector('.event-title').textContent = ev.title;
    this.showTip('event');
    this.type(box.querySelector('.event-text'), ev.text, 28, 300);
    const menu = box.querySelector('.menu');
    const avail = ev.choices;
    const items = avail.map(c => {
      const ok = !c.can || c.can(g);
      const m = h('div', 'mi shadow' + (ok ? '' : ' disabled'), `${c.label}${c.sub ? `<span class="sub">${c.sub}</span>` : ''}`);
      menu.appendChild(m);
      return m;
    });
    let stage = 0;
    const keys = this.navList(items, {
      onSelect: (i) => {
        if (stage) return;
        const c = avail[i];
        if (c.can && !c.can(g)) { g.audio.ui('deny'); return; }
        stage = 1;
        g.audio.ui('select');
        const txt = choose(c);
        menu.innerHTML = '';
        const res = h('div', 'event-result');
        menu.appendChild(res);
        this.type(res, txt, 25);
        const b = h('button', 'btn', 'CONTINUE');
        b.style.marginTop = 'calc(var(--px)*6)';
        b.onclick = (e) => { e.stopPropagation(); fin(); };
        setTimeout(() => menu.appendChild(b), 400);
      },
    });
    const fin = () => { g.audio.ui('select'); this.close(entry); done(); };
    const entry = this.open(el, { keys: (c) => { if (stage && (c === 'Enter' || c === 'Space')) { fin(); return true; } return stage ? false : keys(c); } });
  }

  runEnd({ won, run, xp, lvl, grade, newBests = {}, shot = null }, done) {
    const g = this.g;
    this.closeAll();
    const el = h('div', 'screen dim');
    const box = h('div', 'panel runend-box');
    const floor = won && !run.endless ? 3 : run.floor;
    const t = Math.round(run.time || 0);
    const time = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const nb = (k) => newBests[k] ? '<em>NEW BEST</em>' : '';
    const unlockLine = won && run.mode === 'standard' ? `<div class="run-unlock">${glyphHTML('star')} ${(g.meta.data.breakMax || 0) > (run.breakLv || 0) ? `BREAK ${Math.min(5, (run.breakLv || 0) + 1)} UNLOCKED` : 'CHAMPION'}${!run.breakLv ? ' · ENDLESS UNLOCKED' : ''}</div>` : '';
    const build = buildName(run.relics, run.seed);
    const headline = run.afterWon ? 'LAST GAME WON' : run.after ? 'CLOSING TIME' : won ? (run.mode === 'bossrush' ? 'RUSH COMPLETE' : 'RUN COMPLETE') : 'GAME OVER';
    const afterLine = run.after ? `<div class="run-unlock" style="color:#f0e6c8">${run.afterWon ? 'THE OWNER PUTS DOWN HIS CUE. THE LIGHTS COME UP.' : 'THE CLUB CLOSED WITH YOU STILL INSIDE. THE HOUSE STILL FELL.'}</div>` : '';
    box.innerHTML = `<div class="go-title chrome" style="${won ? '' : 'filter:drop-shadow(0 0 calc(var(--px)*8) #ff3b5c)'}">${headline}</div>${unlockLine}${afterLine}${build ? `<div class="run-build"><small>YOUR BUILD</small>${build}</div>` : ''}
      <div class="title-jp" style="text-align:center">${won ? '完全勝利' : 'ゲームオーバー'}</div>
      <div class="runend-grid">
        <div class="stats">
          <div>SCORE</div><div class="v">${fmt(run.score)} ${nb('highScore')}</div>
          <div>${run.mode === 'daily' ? 'DAILY ' + run.daily : run.endless ? 'ENDLESS · DEEPEST' : 'FLOOR REACHED'}</div><div class="v">${floor} — ${floorName(floor)}</div>
          <div>MAX COMBO</div><div class="v">${run.stats.maxStreak || 0} ${nb('largestCombo')}</div>
          <div>BEST SHOT</div><div class="v">${run.stats.bestShotLabel || '—'} · ${fmt(run.stats.bestShot)}</div>
          <div>MOST IN ONE SHOT</div><div class="v">${run.stats.mostBalls || 0} ${nb('mostBalls')}</div>
          <div>HEAT REACHED</div><div class="v">${ROMAN[run.heatMax || 0]} ${nb('highestHeat')}</div>
          <div>STYLE PEAK</div><div class="v" style="color:${STYLE_COL[run.stylePeak || 0]}">${STYLE_GRADES[run.stylePeak || 0]}</div>
          <div>SCRATCHES</div><div class="v">${run.stats.scratches || 0}</div>
          <div>TIME</div><div class="v">${time} ${nb('fastestWin')}</div>
        </div>
        <div class="grade-box"><div class="gk">GRADE</div><div class="gv chrome grade-${(grade || 'D').replace('+', 'p')}">${grade || 'D'}</div>${newBests.bestGrade ? '<em>NEW BEST</em>' : ''}</div>
      </div>
      ${this.shotCard(shot)}
      <div class="lvl">LV <span class="lv">${lvl.from}</span> <span style="font-size:calc(var(--px)*4);color:var(--cyan)">+${fmt(xp)} XP</span></div>
      <div class="xpbar"><i style="width:0"></i></div>
      <div class="unlocks"></div>
      <div class="runend-btns"><button class="btn gold again">PLAY AGAIN</button><button class="btn menu-btn">MAIN MENU</button></div>`;
    el.appendChild(box);
    const rb = box.querySelector('.replay');
    if (rb) rb.onclick = (ev) => { ev.stopPropagation(); g.audio.ui('select'); this.replayShot(shot, box); };
    const bar = box.querySelector('.xpbar i'), lvEl = box.querySelector('.lv'), un = box.querySelector('.unlocks');
    let level = lvl.from;
    const d = g.meta.data;
    const steps = [];
    for (let l = lvl.from; l < lvl.to; l++) steps.push({ level: l, to: 1 });
    steps.push({ level: lvl.to, to: d.xp / xpForLevel(lvl.to) });
    let si = 0;
    const next = () => {
      if (si >= steps.length) {
        if (lvl.unlocks.length) un.innerHTML = lvl.unlocks.map(u => `${glyphHTML('star')} ${u}`).join('<br>');
        return;
      }
      const st = steps[si++];
      bar.style.transition = 'none'; bar.style.width = '0';
      requestAnimationFrame(() => {
        bar.style.transition = 'width 0.7s steps(14)';
        bar.style.width = `calc(${Math.min(1, st.to) * 100}% - var(--px)*4)`;
      });
      setTimeout(() => {
        if (st.to >= 1) { level++; lvEl.textContent = level; g.audio.levelUp(); lvEl.animate([{ transform: 'scale(1.8)', color: '#ffc21c' }, { transform: 'scale(1)' }], { duration: 400, easing: 'steps(6)' }); }
        next();
      }, 800);
    };
    setTimeout(next, 600);
    const gv = box.querySelector('.gv');
    gv.animate([{ transform: 'scale(3) rotate(-12deg)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 500, delay: 400, easing: 'steps(8)', fill: 'backwards' });
    setTimeout(() => g.audio.bigHit(1), 800);
    let left = false;
    const fin = (again) => {
      if (left) return; left = true;
      g.audio.ui('select'); this.close(entry);
      this.transition(() => { done(); if (again) { this.closeAll(); g.startRun({ mode: run.mode === 'daily' ? 'standard' : run.mode, breakLv: run.breakLv || 0, hand: run.hand || [] }); } });
    };
    box.querySelector('.again').onclick = (e) => { e.stopPropagation(); fin(true); };
    box.querySelector('.menu-btn').onclick = (e) => { e.stopPropagation(); fin(false); };
    const entry = this.open(el, { keys: (c) => { if (g.replaying) return true; if (c === 'Enter') { fin(true); return true; } if (c === 'Escape') { fin(false); return true; } return false; } });
    if (!won) g.audio.fail();
  }

  escape() { }
}

Object.assign(UI.prototype, AfterUI);
