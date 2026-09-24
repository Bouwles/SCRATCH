// npm run release — production build + the itch.io HTML5 upload.
//
// Writes release/itch/SCRATCH-web-v<version>.zip with index.html at the zip
// root. The build is checked first: relative asset paths only, every
// referenced file present, no source maps, and within itch.io's limits.
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dist = path.join(root, 'dist');
const outDir = path.join(root, 'release', 'itch');
const zipName = `SCRATCH-web-v${pkg.version}.zip`;

const fail = (msg) => { console.error(`\n  release check failed: ${msg}\n`); process.exit(1); };

await build({ root, logLevel: 'warn' });

// ---- check the build
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else files.push(path.relative(dist, p).split(path.sep).join('/'));
  }
})(dist);
files.sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));

if (!files.includes('index.html')) fail('dist/index.html is missing');
if (files.some(f => f.endsWith('.map'))) fail('source maps found in dist/');
if (files.length > 900) fail(`${files.length} files (itch.io allows 1000)`);
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => !/^(data:|https?:|#)/.test(u));
for (const u of refs) {
  if (u.startsWith('/')) fail(`absolute path in index.html: ${u} (itch.io serves the game from a sub-folder)`);
  if (!files.includes(u.replace(/^\.\//, '').split('?')[0])) fail(`index.html references a missing file: ${u}`);
}
const css = files.filter(f => f.endsWith('.css')).map(f => fs.readFileSync(path.join(dist, f), 'utf8')).join('\n');
for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
  const u = m[1].replace(/["']/g, '');
  if (u.startsWith('data:')) continue;
  if (u.startsWith('/')) fail(`absolute url() in CSS: ${u}`);
}
const size = files.reduce((s, f) => s + fs.statSync(path.join(dist, f)).size, 0);

// ---- zip it (deflate text, store what is already compressed)
const STORE = /\.(woff2?|png|jpe?g|gif|webp|mp3|ogg|zip)$/i;
const DOS_TIME = ((12 << 11) | (0 << 5)) & 0xffff;                          // 12:00:00
const DOS_DATE = (((2026 - 1980) << 9) | (9 << 5) | 23) & 0xffff;            // 2026-09-23, fixed so builds are reproducible
const chunks = [], central = [];
let offset = 0;
for (const name of files) {
  const data = fs.readFileSync(path.join(dist, name));
  const method = STORE.test(name) ? 0 : 8;
  const body = method ? zlib.deflateRawSync(data, { level: 9 }) : data;
  const crc = zlib.crc32(data) >>> 0;
  const nameBuf = Buffer.from(name, 'utf8');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(method, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
  chunks.push(local, nameBuf, body);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8);
  cd.writeUInt16LE(method, 10); cd.writeUInt16LE(DOS_TIME, 12); cd.writeUInt16LE(DOS_DATE, 14);
  cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(body.length, 20); cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt32LE(offset, 42);
  central.push(cd, nameBuf);
  offset += local.length + nameBuf.length + body.length;
}
const cdSize = central.reduce((s, b) => s + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
fs.mkdirSync(outDir, { recursive: true });
const zipPath = path.join(outDir, zipName);
fs.writeFileSync(zipPath, Buffer.concat([...chunks, ...central, end]));

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
console.log(`\n  SCRATCH v${pkg.version}`);
console.log(`  build: ${files.length} files, ${mb(size)} (dist/)`);
console.log(`  zip:   ${path.relative(root, zipPath)} (${mb(fs.statSync(zipPath).size)})`);
console.log('  upload it to itch.io as an HTML5 game: see release/itch/UPLOAD.md\n');
