// SCRATCH — entry point.
import './core/setup.js';
// Only the subsets the game actually draws: Latin everywhere, plus Japanese for
// DotGothic16 (floor, boss and menu subtitles). Files ship unmodified.
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/dela-gothic-one/latin-400.css';
import '@fontsource/dotgothic16/latin-400.css';
import dotJp from '@fontsource/dotgothic16/files/dotgothic16-japanese-400-normal.woff2?url';
import delaJp from '@fontsource/dela-gothic-one/files/dela-gothic-one-japanese-400-normal.woff2?url';
import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
// SCRATCH CLASSIC typography
import '@fontsource/inter/latin-300.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import { Game } from './game/Game.js';
import { RELICS, relicById } from './game/relics.js';
import { ENCOUNTERS, BOSSES, makeEncounter } from './game/encounters.js';
import { MODS, CHALLENGES, ANOMALIES, SECRET_ANOMALY } from './game/mastery.js';
import { RAJIS_BOSSES } from './game/rajis.js';
import { TABLE_STATES, CONTRACTS, RIVALS, SYNERGIES } from './game/afterhours.js';

// Japanese faces (subtitles, neon signs) are only fetched when kana/kanji are drawn
const JP_RANGE = 'U+3000-30FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF';
for (const [family, url] of [['DotGothic16', dotJp], ['Dela Gothic One', delaJp]]) {
  try {
    document.fonts.add(new FontFace(family, `url(${url}) format('woff2')`, { weight: '400', style: 'normal', display: 'swap', unicodeRange: JP_RANGE }));
  } catch (e) { /* the system font draws them instead */ }
}

// a real loading screen: only shows tips if loading actually takes a moment
const TIPS = ['BANK SHOTS ARE A BUILD STYLE.', 'CURSED DOESN\'T MEAN BAD.', 'THE HOUSE ALWAYS WINS.', 'KEEP THE 8 SAFE.', 'A DUPLICATE RELIC IS AN UPGRADE.', 'HIGH STAKES: DON\'T BREAK THE RULE.', 'PRESS C FOR THE TOP-DOWN VIEW.'];
const bootEl = document.getElementById('boot');
let tipTimer = setTimeout(function cycle() {
  const t = bootEl?.querySelector('.tip');
  if (!t) return;
  t.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  t.classList.add('on');
  tipTimer = setTimeout(cycle, 2200);
}, 1200);
function bootDone() {
  clearTimeout(tipTimer);
  if (!bootEl) return;
  bootEl.classList.add('done');
  setTimeout(() => bootEl.remove(), 500);
}
function bootFail(msg) {
  clearTimeout(tipTimer);
  if (!bootEl) return;
  bootEl.querySelector('.bar')?.remove();
  bootEl.querySelector('.tip').outerHTML = `<div class="err">${msg}</div>`;
}

async function boot() {
  // make sure the bitmap fonts are ready before canvases draw text into textures
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('16px "Press Start 2P"'),
        document.fonts.load('16px "Dela Gothic One"'),
        // Japanese subsets used by neon signs / posters (canvas text needs them loaded up front)
        document.fonts.load('16px "Dela Gothic One"', 'ビリヤード地獄水族館毎週金曜ハスラー'),
        document.fonts.load('16px "DotGothic16"', 'スクラッチ装備図鑑設定'),
        document.fonts.load('600 16px "Chakra Petch"'),
        document.fonts.load('700 16px Inter'),
        document.fonts.load('500 16px "Cormorant Garamond"'),
      ]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fall back to system fonts */ }
  // no WebGL, no pool: say so plainly instead of showing a black page
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!gl) { bootFail('SCRATCH needs WebGL, which this browser has switched off or does not support. Try an up-to-date Chrome, Firefox, Edge or Safari, and check that hardware acceleration is enabled.'); return; }
  let game;
  try { game = new Game(document.getElementById('game')); }
  catch (e) { console.error(e); bootFail('SCRATCH could not start its renderer on this device. Updating your browser or graphics drivers usually fixes this.'); return; }
  // developer handles only exist when explicitly asked for (?debug)
  if (/[?&]debug\b/.test(location.search)) {
    window.__scratch = game;
    window.__scratchData = { RELICS, relicById, ENCOUNTERS, BOSSES, MODS, CHALLENGES, ANOMALIES, SECRET_ANOMALY, makeEncounter, RAJIS_BOSSES, TABLE_STATES, CONTRACTS, RIVALS, SYNERGIES };
  }
  game.setupMenuTable();
  game.state = 'title';
  game.camMode = 'menu';
  game.ui.showTitle();
  bootDone();
}

boot();
