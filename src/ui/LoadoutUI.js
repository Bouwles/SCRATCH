// LOADOUT: what you play with, per mode (the roguelite's, and RAJIS's once it
// exists). A live preview on the left, the choices on the right, filters for
// ALL / OWNED / ANIMATED / FAVOURITES / NEW. Also the unlock presentation that
// shows a newly earned cosmetic turning slowly in the dark.

import './loadout.css';
import { THEMES, BALL_SKINS, CUE_SKINS, FELTS, TRAILS, POCKET_FX, KIND_NAME, ballSkinById, cueSkinById } from '../game/cosmetics.js';
import { STARTER_RELICS } from '../game/meta.js';
import { RARITY, relicById } from '../game/relics.js';
import { ballSwatch } from '../render/ballpaint.js';
import { Showcase } from './Showcase.js';
import { relicIcon, glyphHTML } from './art.js';

function h(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

// a tiny picture of any cosmetic for grids, cards and shops
export function cosmeticThumb(item) {
  if (item.kind === 'ball') { const c = ballSwatch(item, [0, 1, 8, 9, 15], 14); c.className = 'cos-sw'; return c; }
  if (item.kind === 'cue') {
    const c = document.createElement('canvas'); c.width = 128; c.height = 8; c.className = 'cos-sw cue';
    const tmp = document.createElement('canvas'); tmp.width = 16; tmp.height = 256; item.paint(tmp.getContext('2d'), 16, 256);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.save(); x.translate(128, 0); x.rotate(Math.PI / 2); x.drawImage(tmp, 0, 0, 16, 256, 0, 0, 8, 128); x.restore();
    return c;
  }
  if (item.kind === 'felt') return h('i', 'cos-sw felt', item.felt ? `<b style="background:${item.felt}"></b><b style="background:${item.cushion}"></b>` : '<b class="club"></b>');
  if (item.kind === 'theme') return h('i', 'cos-sw felt', [item.felt, item.wood[0], ...item.neon.slice(0, 3)].map(c => `<b style="background:${c}"></b>`).join(''));
  const icon = { off: '—', light: '≈', pixel: '▪▪', electric: 'ϟ', fire: '✶', void: '◌', radar: '⌖', classic: '✺', quiet: '·', sparks: '✳', neon: '◎', holo: '◍', smoke: '☁', lockon: '⌜⌟' }[item.id] || '•';
  return h('i', 'cos-sw glyphs', icon);
}

const TABS = [
  { key: 'ball', name: 'BALLS', list: () => BALL_SKINS },
  { key: 'cue', name: 'CUES', list: () => CUE_SKINS },
  { key: 'felt', name: 'FELTS', list: () => FELTS },
  { key: 'theme', name: 'TABLES', list: () => THEMES, rogue: true },
  { key: 'trail', name: 'TRAILS', list: () => TRAILS },
  { key: 'pocket', name: 'POCKET FX', list: () => POCKET_FX },
  { key: 'starter', name: 'STARTER', rogue: true },
];
const FILTERS = ['ALL', 'OWNED', 'ANIMATED', 'FAVOURITES', 'NEW'];

export const LoadoutUI = {
  showcase() { return (this.sc = this.sc || new Showcase(this.g)); },

  showLoadout(opts = {}) {
    const g = this.g, meta = g.meta, d = meta.data;
    let mode = opts.mode || (this.rajis ? 'rajis' : 'rogue');
    if (mode === 'rajis' && !d.rajis?.found) mode = 'rogue';
    let tab = 0, filter = 'ALL', focus = null;
    const el = h('div', 'screen dim');
    const box = h('div', 'panel wide loadout');
    box.innerHTML = `<div class="title-bar chrome">LOADOUT</div><div class="title-jp">装備</div>
      <div class="lo-modes"></div><div class="tabs"></div>
      <div class="lo-body"><div class="lo-prev"><div class="lo-cv"></div><div class="lo-info"></div></div><div class="lo-right"><div class="lo-filters"></div><div class="scroll"><div class="grid lo-grid"></div></div></div></div>
      <div class="foot"><span class="hint">CLICK TO EQUIP · RIGHT-CLICK OR F TO FAVOURITE · TAB FILTERS · DRAG / SCROLL THE PREVIEW</span><button class="btn small">BACK</button></div>`;
    el.appendChild(box);
    const q = (s) => box.querySelector(s);
    const modesEl = q('.lo-modes'), tabsEl = q('.tabs'), grid = q('.lo-grid'), info = q('.lo-info'), filEl = q('.lo-filters'), cvBox = q('.lo-cv');
    const sc = this.showcase();
    cvBox.appendChild(sc.canvas);
    const load = () => (mode === 'rajis' ? (d.loadouts.rajis = d.loadouts.rajis || { ...g.activeLoadout('rajis') }) : d.selected);
    const tabs = () => TABS.filter(t => mode === 'rogue' || !t.rogue);
    const key = (it) => `${it.kind}:${it.id}`;
    const equipped = (it) => {
      const L = load();
      if (it.kind === 'theme') return !L.shuffle && L.theme === it.id;
      return (L[it.kind] || ({ felt: 'theme', trail: 'light', pocket: 'classic' })[it.kind]) === it.id;
    };
    const tags = (it) => [it.animated ? '<span class="ct anim">ANIMATED</span>' : '', it.classy ? '<span class="ct classy">CLASSIC</span>' : '', it.rajis ? '<span class="ct rj">???</span>' : ''].join('');
    const preview = (it) => {
      focus = it;
      if (it.kind === 'theme') { cvBox.classList.add('flat'); sc.stop(); cvBox.querySelector('.theme-note')?.remove(); cvBox.appendChild(h('div', 'theme-note', 'THE TABLE BEHIND THIS MENU SHOWS IT')); }
      else {
        cvBox.classList.remove('flat'); cvBox.querySelector('.theme-note')?.remove();
        sc.show({ kind: it.kind, item: it, skin: it.kind === 'cue' ? it : null, ballSet: ballSkinById(load().ball) });
      }
      const un = meta.isUnlocked(it), secret = !un && meta.unlockText(it) === 'A SECRET';
      info.innerHTML = `<div class="li-k">${KIND_NAME[it.kind]}${it.animated ? ' · ANIMATED' : ''}</div><div class="li-n">${secret ? '???' : it.name}</div><div class="li-d">${un ? it.desc : secret ? 'A secret. Keep playing.' : it.desc}</div>
        <div class="li-u">${un ? (equipped(it) ? `${glyphHTML('check')} EQUIPPED` : 'OWNED') : `${glyphHTML('lock')} ${meta.unlockText(it)}`}</div>`;
      if (un && !d.cosSeen[key(it)]) { d.cosSeen[key(it)] = 1; meta.save(); }
    };
    const equip = (it) => {
      if (!meta.isUnlocked(it)) { g.audio.ui('deny'); return; }
      const L = load();
      if (it.kind === 'theme') { L.theme = it.id; L.shuffle = false; } else L[it.kind] = it.id;
      meta.save();
      if (mode === (this.rajis ? 'rajis' : 'rogue')) g.applyCosmetics(mode === 'rajis' ? g.theme?.base || g.theme : undefined);
      g.audio.ui('select');
      render();
      preview(it);
    };
    const fav = (it) => { const k = key(it); if (d.cosFav[k]) delete d.cosFav[k]; else d.cosFav[k] = 1; meta.save(); g.audio.ui('move'); render(); };
    const render = () => {
      modesEl.innerHTML = '';
      if (d.rajis?.found) ['rogue', 'rajis'].forEach(m => { const b = h('div', 'lo-mode' + (m === mode ? ' sel' : '') + (m === 'rajis' ? ' rj' : ''), m === 'rogue' ? 'ROGUELITE' : 'RAJIS'); b.onclick = () => { mode = m; tab = 0; g.audio.ui('move'); render(); }; modesEl.appendChild(b); });
      const T = tabs();
      tab = Math.min(tab, T.length - 1);
      tabsEl.innerHTML = '';
      T.forEach((t, i) => { const e = h('div', 'tab' + (i === tab ? ' sel' : ''), t.name); e.onclick = () => { tab = i; filter = 'ALL'; g.audio.ui('move'); render(); }; tabsEl.appendChild(e); });
      filEl.innerHTML = '';
      const cur = T[tab];
      grid.innerHTML = '';
      if (cur.key === 'starter') { filEl.style.display = 'none'; this.loadoutStarters(grid, render); q('.lo-prev').style.display = 'none'; return; }
      filEl.style.display = ''; q('.lo-prev').style.display = '';
      FILTERS.forEach(f => { const e = h('div', 'lo-f' + (f === filter ? ' sel' : ''), f === 'FAVOURITES' ? `${glyphHTML('star')}` : f); e.title = f; e.onclick = () => { filter = f; g.audio.ui('move'); render(); }; filEl.appendChild(e); });
      let list = cur.list().filter(it => meta.visible(it));
      const un = (it) => meta.isUnlocked(it);
      if (filter === 'OWNED') list = list.filter(un);
      if (filter === 'ANIMATED') list = list.filter(it => it.animated);
      if (filter === 'FAVOURITES') list = list.filter(it => d.cosFav[key(it)]);
      if (filter === 'NEW') list = list.filter(it => un(it) && !d.cosSeen[key(it)]);
      if (!list.length) grid.innerHTML = `<div class="hint" style="grid-column:1/-1;text-align:center;padding:calc(var(--px)*10)">${filter === 'NEW' ? 'NOTHING NEW. GO EARN SOMETHING.' : filter === 'FAVOURITES' ? 'NO FAVOURITES YET · RIGHT-CLICK ONE' : 'NOTHING HERE YET.'}</div>`;
      for (const it of list) {
        const u = un(it), secret = !u && meta.unlockText(it) === 'A SECRET';
        const o = h('div', 'opt lo-opt' + (equipped(it) ? ' sel' : '') + (u ? '' : ' locked'));
        o.appendChild(cosmeticThumb(it));
        o.insertAdjacentHTML('beforeend', `<div class="nm">${secret ? '???' : it.name}</div><div class="lo-tags">${tags(it)}</div>${u && !d.cosSeen[key(it)] ? '<span class="lo-new">NEW</span>' : ''}${d.cosFav[key(it)] ? `<span class="lo-fav">${glyphHTML('star')}</span>` : ''}`);
        if (!u) o.insertAdjacentHTML('beforeend', `<div class="lk">${glyphHTML('lock')} ${meta.unlockText(it)}</div>`);
        o.onmouseenter = () => preview(it);
        o.onclick = () => equip(it);
        o.oncontextmenu = (e) => { e.preventDefault(); fav(it); };
        grid.appendChild(o);
      }
      const eq = list.find(equipped) || list[0];
      if (eq && (!focus || focus.kind !== cur.key)) preview(eq); else if (focus) preview(focus);
    };
    render();
    const back = () => { g.audio.ui('back'); sc.stop(); this.close(entry); };
    q('.btn').onclick = back;
    const entry = this.open(el, { keys: (c) => {
      if (c === 'Escape' || c === 'Backspace') { back(); return true; }
      const n = tabs().length;
      if (c === 'ArrowRight' || c === 'KeyE') { tab = (tab + 1) % n; filter = 'ALL'; focus = null; render(); return true; }
      if (c === 'ArrowLeft' || c === 'KeyQ') { tab = (tab + n - 1) % n; filter = 'ALL'; focus = null; render(); return true; }
      if (c === 'KeyF' && focus) { fav(focus); return true; }
      if (c === 'Tab') { const i = FILTERS.indexOf(filter); filter = FILTERS[(i + 1) % FILTERS.length]; render(); return true; }
      return false;
    } });
  },

  loadoutStarters(grid, render) {
    const g = this.g, meta = g.meta, sel = meta.data.selected;
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
  },

  // ------------------------------------------------ unlock presentation
  // background dims, the item turns slowly, one small sound. No boxes, no chests.
  queueUnlocks(items) {
    this.unlockQ = this.unlockQ || [];
    for (const it of items) if (it && !this.unlockQ.includes(it) && (!it.rajis || this.g.meta.data.rajis?.found)) this.unlockQ.push(it);
  },
  // only at quiet moments: menus, results, the end of a run
  flushUnlocks(done = () => {}) {
    const it = this.unlockQ?.shift();
    if (!it) { done(); return; }
    const g = this.g;
    const el = h('div', 'screen unlock-show');
    el.innerHTML = `<div class="us-k">${KIND_NAME[it.kind]} UNLOCKED</div><div class="us-cv"></div><div class="us-n">${it.name}</div><div class="us-t">${it.animated ? '<span class="ct anim">ANIMATED</span>' : ''}${it.classy ? '<span class="ct classy">CLASSIC</span>' : ''}</div><div class="us-d">${it.desc}</div><div class="hint">FIND IT IN THE LOADOUT · CLICK TO CONTINUE</div>`;
    const sc = this.showcase();
    if (it.kind !== 'theme') { el.querySelector('.us-cv').appendChild(sc.canvas); sc.show({ kind: it.kind, item: it, skin: it.kind === 'cue' ? it : null }); }
    else el.querySelector('.us-cv').appendChild(cosmeticThumb(it));
    g.audio.tone(660, { type: 'triangle', dur: 0.12, vol: 0.07 });
    g.audio.tone(990, { t: g.audio.now + 0.1, type: 'triangle', dur: 0.3, vol: 0.07, verb: 0.5 });
    let fin = false;
    const next = () => { if (fin) return; fin = true; sc.stop(); this.close(entry); this.flushUnlocks(done); };
    const entry = this.open(el, { keys: () => { next(); return true; }, click: next });
    el.addEventListener('click', next);
  },
  // every cosmetic an achievement just unlocked
  unlocksFor(achId) {
    return [BALL_SKINS, CUE_SKINS, FELTS, TRAILS, POCKET_FX, THEMES].flat().filter(it => it.unlock?.ach === achId);
  },
};
