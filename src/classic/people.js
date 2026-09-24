// The regulars at the Classic table, the match formats, and the small
// CLASSIC LEVEL that unlocks only looks (rooms, cues, felts, ball sets).

export const OPPONENTS = [
  { id: 'marcus', name: 'Marcus', style: 'positional', color: '#3a6ab0', hair: 0, bio: 'Thinks two shots ahead. Never in a hurry.' },
  { id: 'maya', name: 'Maya', style: 'aggressive', color: '#b0443a', hair: 1, bio: 'Goes for everything, and usually gets it.' },
  { id: 'leon', name: 'Leon', style: 'trickster', color: '#6a4aa8', hair: 2, bio: 'Would rather bank it than pot it straight.' },
  { id: 'elsie', name: 'Elsie', style: 'safe', color: '#3a8a6a', hair: 3, bio: 'Will not leave you a thing. Ever.' },
  { id: 'viktor', name: 'Viktor', style: 'pressure', color: '#8a6a2a', hair: 4, bio: 'Plays fast. Makes you feel slow.' },
  { id: 'marguerite', name: 'Marguerite', style: 'positional', color: '#a0506a', hair: 5, bio: 'Has played in this room since it opened.' },
  { id: 'ossie', name: 'Ossie', style: 'aggressive', color: '#c0782a', hair: 6, bio: 'Breaks like he means it.' },
  { id: 'deacon', name: 'Deacon', style: 'safe', color: '#4a5a6a', hair: 7, bio: 'Quiet. Patient. Annoying.' },
  { id: 'juno', name: 'Juno', style: 'trickster', color: '#2a8aa0', hair: 8, bio: 'Sees angles nobody else does.' },
  { id: 'rafe', name: 'Rafe', style: 'pressure', color: '#7a2a3a', hair: 9, bio: 'Chalks before you have finished your shot.' },
];
export const oppById = (id) => OPPONENTS.find(o => o.id === id) || OPPONENTS[0];

// single frame, best-of and race-to: `need` is how many frames win the match
export const FORMATS = [
  { id: 'single', name: 'Single frame', short: '8-Ball', need: 1 },
  { id: 'bo3', name: 'Best of 3', short: 'Best of 3', need: 2 },
  { id: 'bo5', name: 'Best of 5', short: 'Best of 5', need: 3 },
  { id: 'race3', name: 'Race to 3', short: 'Race to 3', need: 3 },
  { id: 'race5', name: 'Race to 5', short: 'Race to 5', need: 5 },
];
export const formatById = (id) => FORMATS.find(f => f.id === id) || FORMATS[0];
// 2.0 saved a best-of number
export const formatFromBestOf = (n) => ({ 1: 'single', 3: 'bo3', 5: 'bo5', 7: 'race5' }[n] || 'single');

export const CLEVEL_XP = (l) => 300 + (l - 1) * 150;

// a small painted portrait: shoulders, head, hair, in the regular's colour
export function portrait(o, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const x = c.getContext('2d'), S = size * 2;
  x.scale(S / 128, S / 128);
  const g = x.createRadialGradient(64, 40, 10, 64, 64, 90);
  g.addColorStop(0, o.color); g.addColorStop(1, '#0c0a08');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const skin = ['#e0b896', '#c89470', '#8a5a3c', '#f0cfb0', '#a86c48'][o.hair % 5];
  const hair = ['#1a120c', '#3a2414', '#c8a060', '#0c0c0e', '#8a8a90', '#5a2a18', '#e0d8c8', '#2a1a10', '#a04a2a', '#141010'][o.hair % 10];
  // shoulders + collar
  x.fillStyle = '#16140f'; x.beginPath(); x.moveTo(14, 128); x.quadraticCurveTo(20, 88, 64, 86); x.quadraticCurveTo(108, 88, 114, 128); x.fill();
  x.fillStyle = '#e8e2d4'; x.beginPath(); x.moveTo(54, 88); x.lineTo(64, 104); x.lineTo(74, 88); x.fill();
  x.fillStyle = o.color; x.fillRect(62, 94, 4, 20);
  // neck + head
  x.fillStyle = skin; x.fillRect(56, 70, 16, 18);
  x.beginPath(); x.ellipse(64, 54, 19, 23, 0, 0, 7); x.fill();
  // hair, ten ways
  x.fillStyle = hair;
  const H = o.hair % 10;
  if (H === 0 || H === 7) { x.beginPath(); x.ellipse(64, 38, 20, 11, 0, Math.PI, 0); x.fill(); }
  else if (H === 1 || H === 5) { x.beginPath(); x.ellipse(64, 44, 23, 20, 0, Math.PI * 0.95, Math.PI * 0.05); x.fill(); x.fillRect(41, 44, 7, 30); x.fillRect(80, 44, 7, 30); }
  else if (H === 2 || H === 8) { x.beginPath(); for (let i = 0; i < 7; i++) x.arc(46 + i * 6, 36 + (i % 2) * 3, 7, 0, 7); x.fill(); }
  else if (H === 3) { x.beginPath(); x.ellipse(64, 40, 21, 15, 0, Math.PI, 0); x.fill(); x.beginPath(); x.arc(64, 26, 8, 0, 7); x.fill(); }
  else if (H === 4) { x.fillRect(45, 32, 38, 6); x.fillStyle = '#2a2620'; x.fillRect(48, 50, 32, 3); }
  else if (H === 6) { x.beginPath(); x.ellipse(64, 36, 19, 8, 0, Math.PI, 0); x.fill(); x.fillRect(50, 66, 28, 8); }
  else { x.beginPath(); x.ellipse(64, 40, 21, 14, -0.2, Math.PI, 0); x.fill(); }
  // eyes
  x.fillStyle = '#1a1410'; x.fillRect(55, 54, 4, 3); x.fillRect(69, 54, 4, 3);
  // vignette + frame line
  const v = x.createRadialGradient(64, 64, 40, 64, 64, 92);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = v; x.fillRect(0, 0, 128, 128);
  c.className = 'c-portrait';
  return c;
}
