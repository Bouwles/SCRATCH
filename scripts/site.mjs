// npm run site — the GitHub Pages site in _site/:
//   index.html     landing page (site/index.html) with the PLAY button
//   play/          the game (the production build)
//   media/         banner, GIFs, screenshots, icon and the page's two fonts
// The deploy workflow (.github/workflows/deploy.yml) runs this and publishes _site/.
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');
const r = (...p) => path.join(root, ...p);
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.cpSync(from, to, { recursive: true }); };

await build({ root, logLevel: 'warn' });

fs.rmSync(out, { recursive: true, force: true });
copy(r('site/index.html'), path.join(out, 'index.html'));
copy(r('dist'), path.join(out, 'play'));
const media = {
  'banner.png': 'release/itch/banner-1920x600.png',
  'icon.png': 'release/itch/icon-512.png',
  'break.gif': 'release/itch/gifs/break.gif',
  'switch.gif': 'release/itch/gifs/switch.gif',
  'screens': 'docs/screenshots',
  'break.mp4': 'docs/media/break.mp4', 'break.jpg': 'docs/media/break.jpg',
  'switch.mp4': 'docs/media/switch.mp4', 'switch.jpg': 'docs/media/switch.jpg',
  'fonts/dela-gothic-one.woff2': 'node_modules/@fontsource/dela-gothic-one/files/dela-gothic-one-latin-400-normal.woff2',
  'fonts/press-start-2p.woff2': 'node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2',
};
for (const [to, from] of Object.entries(media)) copy(r(from), path.join(out, 'media', to));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

// every local file the landing page points at must exist
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href|poster)="([^"#]+)"/g), ...html.matchAll(/url\('([^']+)'\)/g)].map(m => m[1]).filter(u => !/^(https?:|mailto:|data:)/.test(u));
const missing = refs.filter(u => !fs.existsSync(path.join(out, u.endsWith('/') ? u + 'index.html' : u)));
if (missing.length) { console.error('\n  site check failed, missing:', missing.join(', '), '\n'); process.exit(1); }

let n = 0, bytes = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { n++; bytes += fs.statSync(p).size; } } })(out);
console.log(`\n  site: _site/ (${n} files, ${(bytes / 1048576).toFixed(1)} MB) — landing page + play/\n`);
