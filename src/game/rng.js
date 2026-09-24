// Generation randomness. Everything that decides WHAT a run contains (floors,
// table offers, relic choices, shops, events, rack layouts) draws from rand(),
// which can be pinned to a seed. Every run has a seed: Daily Scratch derives it
// from the date, and a restored autosave re-creates exactly the same offers.
// Physics and juice keep using Math.random.

let gen = Math.random;
export const rand = () => gen();

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// stable 32-bit hash of any list of parts
export function hashParts(...parts) {
  let h = 2166136261 >>> 0;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// run fn with generation pinned to a seed derived from the parts, then unpin
export function withSeed(parts, fn) {
  const prev = gen;
  gen = seeded(hashParts(...parts));
  try { return fn(); } finally { gen = prev; }
}

export const randInt = (n) => Math.floor(rand() * n);
export const pick = (arr) => arr[randInt(arr.length)];

// today's date in the player's local time, as YYYY-MM-DD
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
