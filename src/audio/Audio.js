// Procedural audio: every sound effect is synthesised with WebAudio, and the
// music is a small step sequencer playing late-90s jungle / trip-hop / lounge.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.75, sfx: 0.9, music: 0.55 };
    this.music = null;
    this.lastClack = 0;
    this.clackCount = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.15;
    // brick-wall limiter so juicy moments never clip
    const lim = this.limiter = ctx.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    this.master.connect(comp).connect(lim).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.mus = ctx.createGain(); this.mus.connect(this.master);
    // reverb
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(2.4, 2.2);
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.3;
    this.verbSend.connect(this.verb).connect(this.master);
    // delay for music
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.27;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    this.delaySend = ctx.createGain(); this.delaySend.gain.value = 0.25;
    this.delaySend.connect(this.delay);
    dlp.connect(this.mus);
    // shared noise
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // bitcrush-ish waveshaper for grit
    this.crush = ctx.createWaveShaper();
    this.crush.curve = this.distCurve(18);
    this.crush.connect(this.sfx);
    this.applyVolumes();
    this.music = new Music(this);
    if (this.pendingTrack) this.music.play(this.pendingTrack);
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.sfx.gain.value = this.vol.sfx;
    this.mus.gain.value = this.vol.music;
  }

  impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  distCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return c;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // --- primitives
  tone(freq, { type = 'sine', t = this.now, dur = 0.2, vol = 0.3, attack = 0.002, slide = 0, slideTime = dur, dest = this.sfx, pan = 0, verb = 0, filter = 0, q = 1, detune = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (this.music && dest === this.music.out) { const k = this.music.pitchAt(t); freq *= k; if (slide) slide *= k; }
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + slideTime);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; f.Q.value = q; node.connect(f); node = f; }
    node.connect(g);
    let out = g;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
    out.connect(dest);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; out.connect(s).connect(this.verbSend); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ t = this.now, dur = 0.1, vol = 0.3, type = 'bandpass', freq = 2000, q = 1, slide = 0, attack = 0.001, dest = this.sfx, pan = 0, verb = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (this.music && dest === this.music.out) { const k = this.music.pitchAt(t); freq *= k; if (slide) slide *= k; }
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g);
    let out = g;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
    out.connect(dest);
    if (verb) { const sg = ctx.createGain(); sg.gain.value = verb; out.connect(sg).connect(this.verbSend); }
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  // --- SFX
  cueStrike(power) {
    const v = 0.25 + power * 0.5;
    this.noise({ dur: 0.05, vol: v, type: 'bandpass', freq: 3200, q: 1.2 });
    this.tone(1400 + power * 400, { type: 'triangle', dur: 0.05, vol: v * 0.6, slide: 700 });
    this.tone(180, { type: 'sine', dur: 0.12 + power * 0.1, vol: v * 0.7, slide: 60 });
    if (power > 0.7) {
      this.noise({ dur: 0.35, vol: 0.18 * power, type: 'lowpass', freq: 900, slide: 120, dest: this.crush });
      this.tone(60, { type: 'sine', dur: 0.4, vol: 0.5 * power, slide: 35 });
    }
  }

  clack(speed, pan = 0) {
    if (!this.ctx) return;
    const t = this.now;
    // avoid machine-gunning when a rack is resolving
    if (t - this.lastClack < 0.012) { if (++this.clackCount > 3) return; } else this.clackCount = 0;
    this.lastClack = t;
    const v = Math.min(0.55, 0.05 + speed * 0.14);
    const f = 2600 + Math.random() * 900;
    this.tone(f, { type: 'sine', dur: 0.045, vol: v, pan });
    this.tone(f * 1.52, { type: 'sine', dur: 0.03, vol: v * 0.5, pan });
    this.noise({ dur: 0.02, vol: v * 0.7, type: 'highpass', freq: 3000, pan });
    if (speed > 2.5) this.tone(240, { type: 'sine', dur: 0.08, vol: v * 0.6, slide: 120, pan });
  }

  rail(speed, pan = 0) {
    const v = Math.min(0.45, 0.04 + speed * 0.1);
    this.noise({ dur: 0.09, vol: v, type: 'lowpass', freq: 520, pan });
    this.tone(95 + Math.random() * 20, { type: 'sine', dur: 0.11, vol: v * 0.9, slide: 60, pan });
  }

  pocket(speed = 1, pan = 0) {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(210, { t, type: 'sine', dur: 0.14, vol: 0.45, slide: 90, pan });
    this.noise({ t, dur: 0.06, vol: 0.2, type: 'bandpass', freq: 800, q: 2, pan });
    // rattle down the return
    for (let i = 0; i < 4; i++) {
      const tt = t + 0.1 + i * 0.055 + Math.random() * 0.02;
      this.tone(1600 + Math.random() * 600, { t: tt, type: 'sine', dur: 0.03, vol: 0.09 / (i + 1), pan });
      this.tone(300 + Math.random() * 60, { t: tt, type: 'triangle', dur: 0.05, vol: 0.12 / (i + 1), pan });
    }
  }

  potJingle(n = 1) {
    // bright rising chime, higher for each pot in a shot
    if (!this.ctx) return;
    const t = this.now + 0.05;
    const base = [523.25, 659.25, 783.99, 987.77, 1174.66, 1318.5][Math.min(n - 1, 5)];
    this.tone(base, { t, type: 'square', dur: 0.12, vol: 0.09, filter: 3000, verb: 0.3 });
    this.tone(base * 1.5, { t: t + 0.06, type: 'square', dur: 0.18, vol: 0.08, filter: 3000, verb: 0.4 });
    this.tone(base * 2, { t: t + 0.12, type: 'triangle', dur: 0.4, vol: 0.1, verb: 0.5 });
  }

  scratch() {
    if (!this.ctx) return;
    const t = this.now;
    // record-scratch + sad descending tones
    this.noise({ t, dur: 0.25, vol: 0.3, type: 'bandpass', freq: 1800, slide: 400, q: 4 });
    this.noise({ t: t + 0.25, dur: 0.2, vol: 0.25, type: 'bandpass', freq: 500, slide: 1800, q: 4 });
    this.tone(330, { t: t + 0.1, type: 'square', dur: 0.25, vol: 0.08, filter: 1500 });
    this.tone(247, { t: t + 0.35, type: 'square', dur: 0.4, vol: 0.08, filter: 1500, slide: 200 });
  }

  explosion(size = 1) {
    if (!this.ctx) return;
    const t = this.now;
    this.noise({ t, dur: 0.6 * size, vol: 0.5, type: 'lowpass', freq: 3000, slide: 80, dest: this.crush });
    this.tone(120, { t, type: 'sine', dur: 0.5 * size, vol: 0.7, slide: 30 });
    this.tone(70, { t, type: 'square', dur: 0.2, vol: 0.2, slide: 30, filter: 400 });
  }

  zap() {
    if (!this.ctx) return;
    const t = this.now;
    for (let i = 0; i < 5; i++) this.noise({ t: t + i * 0.03, dur: 0.04, vol: 0.2, type: 'highpass', freq: 2500 + Math.random() * 3000 });
    this.tone(1800, { t, type: 'sawtooth', dur: 0.2, vol: 0.08, slide: 200, filter: 5000 });
  }

  bumper() {
    this.tone(880, { type: 'square', dur: 0.08, vol: 0.12, slide: 1760, filter: 4000 });
    this.tone(440, { type: 'triangle', dur: 0.12, vol: 0.15 });
  }

  coin(n = 1) {
    if (!this.ctx) return;
    const t = this.now;
    for (let i = 0; i < Math.min(n, 8); i++) {
      this.tone(1318.5, { t: t + i * 0.06, type: 'square', dur: 0.05, vol: 0.07, filter: 5000 });
      this.tone(1975.5, { t: t + i * 0.06 + 0.04, type: 'square', dur: 0.12, vol: 0.07, filter: 5000 });
    }
  }

  ui(kind = 'move') {
    if (!this.ctx) return;
    if (kind === 'move') this.tone(880, { type: 'square', dur: 0.04, vol: 0.05, filter: 2500 });
    else if (kind === 'select') { this.tone(660, { type: 'square', dur: 0.06, vol: 0.07, filter: 3000 }); this.tone(1320, { t: this.now + 0.05, type: 'square', dur: 0.1, vol: 0.07, filter: 3000 }); }
    else if (kind === 'back') this.tone(440, { type: 'square', dur: 0.08, vol: 0.06, slide: 220, filter: 2000 });
    else if (kind === 'deny') { this.tone(150, { type: 'square', dur: 0.15, vol: 0.1, filter: 800 }); }
    else if (kind === 'buy') { this.coin(3); }
  }

  whoosh(power = 1) {
    this.noise({ dur: 0.25, vol: 0.1 * power, type: 'bandpass', freq: 600, slide: 3000, q: 2, attack: 0.1 });
  }

  combo(level) {
    if (!this.ctx) return;
    const t = this.now;
    const notes = [0, 4, 7, 12, 16, 19, 24];
    const base = 261.6 * Math.pow(2, Math.min(level, 6) / 12);
    for (let i = 0; i < 4 + level; i++) {
      const f = base * Math.pow(2, notes[i % notes.length] / 12 + Math.floor(i / notes.length));
      this.tone(f, { t: t + i * 0.045, type: 'square', dur: 0.12, vol: 0.07, filter: 4000, verb: 0.3 });
    }
  }

  // The legendary-shot hit: sub drop, crack, crowd
  bigHit(level = 1) {
    if (!this.ctx) return;
    const t = this.now;
    this.noise({ t, dur: 0.15, vol: 0.6, type: 'highpass', freq: 1500, dest: this.crush });
    this.tone(55, { t, type: 'sine', dur: 1.2, vol: 0.9, slide: 28, slideTime: 1.1 });
    this.tone(110, { t, type: 'sawtooth', dur: 0.4, vol: 0.2, slide: 40, filter: 600 });
    this.noise({ t: t + 0.02, dur: 1.4, vol: 0.12, type: 'bandpass', freq: 3000, slide: 500, verb: 0.8 });
    this.crowd(Math.min(1, 0.5 + level * 0.2));
  }

  crowd(amount = 0.5) {
    if (!this.ctx) return;
    const t = this.now;
    const dur = 1.2 + amount * 1.5;
    this.noise({ t, dur, vol: 0.12 * amount + 0.04, type: 'bandpass', freq: 900, q: 0.6, attack: 0.15, verb: 0.5 });
    this.noise({ t: t + 0.05, dur: dur * 0.8, vol: 0.06 * amount, type: 'bandpass', freq: 2200, q: 1.5, attack: 0.2, verb: 0.5 });
    // a few "whoo"s
    for (let i = 0; i < 2 + amount * 4; i++) {
      const f = 500 + Math.random() * 400, tt = t + Math.random() * 0.4;
      this.tone(f, { t: tt, type: 'sawtooth', dur: 0.5 + Math.random() * 0.4, vol: 0.03, slide: f * 1.4, slideTime: 0.3, filter: 1400, q: 4, verb: 0.6, attack: 0.08 });
    }
  }

  groan() {
    if (!this.ctx) return;
    const t = this.now;
    this.noise({ t, dur: 1.0, vol: 0.1, type: 'bandpass', freq: 500, q: 0.8, attack: 0.1, verb: 0.5 });
    for (let i = 0; i < 3; i++) this.tone(300 + Math.random() * 100, { t: t + i * 0.05, type: 'sawtooth', dur: 0.8, vol: 0.025, slide: 180, filter: 900, q: 3, verb: 0.5, attack: 0.1 });
  }

  bossStinger() {
    if (!this.ctx) return;
    const t = this.now;
    this.noise({ t, dur: 1.5, vol: 0.25, type: 'lowpass', freq: 200, slide: 3000, attack: 1.3, verb: 0.6 });
    [55, 58.27, 82.4].forEach((f, i) => this.tone(f, { t: t + 1.4, type: 'sawtooth', dur: 2.5, vol: 0.25, filter: 700, verb: 0.6, detune: i * 7 }));
    this.tone(40, { t: t + 1.4, type: 'sine', dur: 2.5, vol: 0.8, slide: 30 });
    this.noise({ t: t + 1.4, dur: 0.4, vol: 0.5, type: 'highpass', freq: 800, dest: this.crush });
  }

  win() {
    if (!this.ctx) return;
    const t = this.now;
    [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => this.tone(523.25 * Math.pow(2, n / 12), { t: t + i * 0.09, type: 'square', dur: 0.2, vol: 0.08, filter: 3500, verb: 0.3 }));
    this.tone(1046.5, { t: t + 0.65, type: 'triangle', dur: 0.8, vol: 0.12, verb: 0.6 });
  }

  fail() {
    if (!this.ctx) return;
    const t = this.now;
    [0, -1, -3, -6].forEach((n, i) => this.tone(330 * Math.pow(2, n / 12), { t: t + i * 0.22, type: 'square', dur: 0.3, vol: 0.08, filter: 1400 }));
    this.tone(55, { t: t + 0.8, type: 'sine', dur: 1.2, vol: 0.5, slide: 30 });
  }

  levelUp() {
    if (!this.ctx) return;
    const t = this.now;
    [0, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(392 * Math.pow(2, n / 12), { t: t + i * 0.07, type: 'square', dur: 0.25, vol: 0.07, filter: 4000, verb: 0.4 }));
  }

  heartbeat() {
    const t = this.now;
    this.tone(60, { t, type: 'sine', dur: 0.15, vol: 0.5, slide: 40 });
    this.tone(55, { t: t + 0.18, type: 'sine', dur: 0.15, vol: 0.35, slide: 38 });
  }

  tick() { this.tone(2000, { type: 'square', dur: 0.02, vol: 0.04, filter: 4000 }); }

  // relic fanfares scale with rarity so a legendary *sounds* legendary
  relicGet(rarity = 'common') {
    if (!this.ctx) return;
    const t = this.now;
    const seq = {
      common: [0, 7, 12], rare: [0, 4, 7, 12, 16], upgrade: [0, 5, 7, 12, 17, 19],
      legendary: [0, 4, 7, 11, 12, 16, 19, 24], cursed: [0, -1, -6, -13],
    }[rarity] || [0, 7, 12];
    const base = rarity === 'cursed' ? 220 : 392;
    seq.forEach((n, i) => this.tone(base * Math.pow(2, n / 12), { t: t + i * 0.065, type: rarity === 'cursed' ? 'sawtooth' : 'square', dur: 0.22, vol: rarity === 'legendary' ? 0.08 : 0.065, filter: rarity === 'cursed' ? 900 : 4200, verb: 0.4 }));
    if (rarity === 'legendary') { this.tone(1567.98, { t: t + 0.6, type: 'triangle', dur: 1.2, vol: 0.1, verb: 0.7 }); this.crowd(0.5); }
    if (rarity === 'cursed') this.noise({ t, dur: 0.8, vol: 0.12, type: 'lowpass', freq: 300, attack: 0.3, verb: 0.5 });
  }

  bossPhase(n) {
    if (!this.ctx) return;
    const t = this.now;
    this.noise({ t, dur: 0.6, vol: 0.3, type: 'lowpass', freq: 200, slide: 2400, attack: 0.3, verb: 0.5 });
    [0, 3, 7].forEach((k, i) => this.tone(55 * Math.pow(2, (k + n * 2) / 12), { t: t + 0.3, type: 'sawtooth', dur: 1.3, vol: 0.12, filter: 900 + n * 300, verb: 0.6, detune: i * 6 }));
    this.tone(41, { t: t + 0.3, type: 'sine', dur: 1.2, vol: 0.6, slide: 30 });
    this.noise({ t: t + 0.3, dur: 0.2, vol: 0.4, type: 'highpass', freq: 900, dest: this.crush });
  }

  // HEAT level-up: rising roar + power chord
  heatUp(h) {
    if (!this.ctx) return;
    const t = this.now;
    this.noise({ t, dur: 0.9, vol: 0.3, type: 'bandpass', freq: 300, slide: 4000, q: 1.2, attack: 0.5, verb: 0.5 });
    const root = 110 * Math.pow(2, h / 12);
    [1, 1.5, 2, 3].forEach((m, i) => this.tone(root * m, { t: t + 0.55, type: 'sawtooth', dur: 1.1, vol: 0.07, filter: 1800 + h * 300, verb: 0.5, detune: i * 5 }));
    this.tone(root / 2, { t: t + 0.55, type: 'sine', dur: 1.0, vol: 0.5, slide: root / 3 });
    this.noise({ t: t + 0.55, dur: 0.25, vol: 0.35, type: 'highpass', freq: 1200, dest: this.crush });
  }

  // ---------------------------------------------------------------------
  // CLASSIC: clean, realistic table sounds (no crush, no jingles)
  cClack(speed, pan = 0) {
    if (!this.ctx) return;
    const t = this.now;
    if (t - this.lastClack < 0.01) { if (++this.clackCount > 4) return; } else this.clackCount = 0;
    this.lastClack = t;
    const v = Math.min(0.62, 0.035 + Math.pow(Math.max(0, speed), 0.85) * 0.16);
    const f = 3300 + Math.random() * 650 + Math.min(speed, 4) * 110;
    this.tone(f, { t, type: 'sine', dur: 0.03, vol: v, pan, verb: 0.05 });
    this.tone(f * 1.47, { t, type: 'sine', dur: 0.018, vol: v * 0.42, pan });
    this.tone(f * 0.41, { t, type: 'sine', dur: 0.045, vol: v * 0.32, pan });
    this.noise({ t, dur: 0.012, vol: v * 0.5, type: 'highpass', freq: 4800, pan });
    if (speed > 1.6) this.noise({ t, dur: 0.02, vol: v * 0.22, type: 'bandpass', freq: 1900, q: 1.2, pan });
  }
  cRail(speed, pan = 0) {
    if (!this.ctx) return;
    const v = Math.min(0.4, 0.03 + speed * 0.085);
    this.noise({ dur: 0.07, vol: v, type: 'lowpass', freq: 380, pan });
    this.tone(118 + Math.random() * 14, { type: 'sine', dur: 0.09, vol: v * 0.75, slide: 72, pan });
    if (speed > 1.2) this.tone(690, { type: 'triangle', dur: 0.022, vol: v * 0.18, pan });
  }
  cPocket(speed = 1, pan = 0) {
    if (!this.ctx) return;
    const t = this.now, v = Math.min(0.42, 0.2 + speed * 0.06);
    this.tone(190, { t, type: 'sine', dur: 0.17, vol: v, slide: 92, pan });
    this.noise({ t, dur: 0.08, vol: v * 0.45, type: 'lowpass', freq: 620, pan });
    // the ball settles into the leather against the others
    this.tone(430, { t: t + 0.1, type: 'triangle', dur: 0.05, vol: 0.06, pan });
    this.tone(2100, { t: t + 0.1, type: 'sine', dur: 0.02, vol: 0.035, pan });
    this.tone(380, { t: t + 0.19, type: 'triangle', dur: 0.04, vol: 0.03, pan });
  }
  cCue(power) {
    if (!this.ctx) return;
    const v = 0.18 + power * 0.42;
    this.noise({ dur: 0.014, vol: v, type: 'bandpass', freq: 2500, q: 1.5 });
    this.tone(1150 + power * 250, { type: 'sine', dur: 0.03, vol: v * 0.45 });
    this.tone(210, { type: 'sine', dur: 0.07, vol: v * 0.55, slide: 140 });
    if (power > 0.8) this.tone(82, { type: 'sine', dur: 0.16, vol: 0.28 * power, slide: 50 });
  }
  cBreak(power) {
    if (!this.ctx) return;
    const t = this.now;
    for (let i = 0; i < 5; i++) {
      const tt = t + i * 0.011 + Math.random() * 0.008, f = 3100 + Math.random() * 900, v = (0.5 - i * 0.07) * power;
      this.tone(f, { t: tt, type: 'sine', dur: 0.03, vol: v, pan: (Math.random() - 0.5) * 0.6, verb: 0.08 });
      this.noise({ t: tt, dur: 0.012, vol: v * 0.5, type: 'highpass', freq: 4500 });
    }
    this.tone(95, { t, type: 'sine', dur: 0.22, vol: 0.3 * power, slide: 55 });
    this.noise({ t, dur: 0.18, vol: 0.08 * power, type: 'lowpass', freq: 500, verb: 0.25 });
  }
  cUi(kind = 'move') {
    if (!this.ctx) return;
    const t = this.now;
    if (kind === 'move') this.tone(1320, { t, type: 'sine', dur: 0.03, vol: 0.025 });
    else if (kind === 'select') { this.tone(784, { t, type: 'sine', dur: 0.12, vol: 0.045, verb: 0.3 }); this.tone(1175, { t: t + 0.05, type: 'sine', dur: 0.2, vol: 0.035, verb: 0.35 }); }
    else if (kind === 'back') this.tone(587, { t, type: 'sine', dur: 0.12, vol: 0.035, slide: 494, verb: 0.2 });
    else if (kind === 'deny') this.tone(220, { t, type: 'triangle', dur: 0.12, vol: 0.05 });
  }
  cFoul() {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(622, { t, type: 'triangle', dur: 0.3, vol: 0.04, verb: 0.35 });
    this.tone(466, { t: t + 0.16, type: 'triangle', dur: 0.5, vol: 0.04, verb: 0.4 });
  }
  cTurn() { if (this.ctx) this.tone(1568, { type: 'sine', dur: 0.6, vol: 0.022, verb: 0.5 }); }
  cWin() {
    if (!this.ctx) return;
    const t = this.now;
    [60, 64, 67, 71, 74, 79].forEach((m, i) => this.tone(261.63 * Math.pow(2, (m - 60) / 12), { t: t + i * 0.11, type: 'sine', dur: 1.8 - i * 0.1, vol: 0.035, verb: 0.55 }));
  }

  // looped beds: rolling balls and room tone
  loops(on) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (on && !this.loopNodes) {
      const mk = (type, freq, q) => {
        const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0;
        s.connect(f).connect(g).connect(this.sfx); s.start();
        return { s, f, g };
      };
      this.loopNodes = { roll: mk('lowpass', 210, 0.9), room: mk('lowpass', 420, 0.5) };
      this.murmurT = setInterval(() => {
        if (!this.ambienceOn || Math.random() > 0.35) return;
        const t = this.now;
        if (Math.random() < 0.5) this.tone(2400 + Math.random() * 900, { t, type: 'sine', dur: 0.05, vol: 0.006, verb: 0.9 });
        else this.noise({ t, dur: 2.2, vol: 0.006, type: 'bandpass', freq: 380 + Math.random() * 200, q: 0.8, attack: 0.9, verb: 0.5 });
      }, 2500);
    } else if (!on && this.loopNodes) {
      for (const k of Object.values(this.loopNodes)) { try { k.s.stop(); } catch (e) { /* already stopped */ } k.g.disconnect(); }
      this.loopNodes = null;
      clearInterval(this.murmurT);
    }
  }
  setRoll(level) {
    if (!this.loopNodes) return;
    this.loopNodes.roll.g.gain.setTargetAtTime(Math.min(0.14, level * 0.05), this.now, 0.06);
  }
  setAmbience(on) {
    this.ambienceOn = on;
    if (this.loopNodes) this.loopNodes.room.g.gain.setTargetAtTime(on ? 0.016 : 0, this.now, 0.5);
  }

  // ------------------------------------------------ reality switch sounds
  tapeStop(sec = 1.2) {
    if (!this.ctx) return;
    this.music?.warp(0.28, 0.32, sec);
    this.tone(120, { type: 'sawtooth', dur: sec, vol: 0.05, slide: 28, filter: 500, attack: 0.1 });
  }
  crtOff() {
    if (!this.ctx) return;
    const t = this.now;
    this.noise({ t, dur: 0.008, vol: 0.45, type: 'highpass', freq: 3000 });
    this.tone(72, { t, type: 'sine', dur: 0.07, vol: 0.32, slide: 40 });
    this.noise({ t: t + 0.02, dur: 0.28, vol: 0.07, type: 'bandpass', freq: 1400, slide: 180, q: 2 });
    this.tone(8800, { t, type: 'sine', dur: 0.6, vol: 0.012, slide: 7000 });
  }
  staticBurst(dur = 0.4, vol = 0.12) {
    if (!this.ctx) return;
    const t = this.now;
    this.noise({ t, dur, vol, type: 'highpass', freq: 1400, attack: 0.01 });
    for (let i = 0; i < 6; i++) this.noise({ t: t + Math.random() * dur, dur: 0.01, vol: vol * 1.2, type: 'highpass', freq: 3000 });
  }
  powerOn() {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(40, { t, type: 'sine', dur: 0.55, vol: 0.4, slide: 95, slideTime: 0.25 });
    this.noise({ t, dur: 0.3, vol: 0.18, type: 'lowpass', freq: 320 });
    this.tone(5200, { t: t + 0.05, type: 'sine', dur: 0.25, vol: 0.015, slide: 7600 });
  }

  playMusic(track) {
    if (!this.music) { this.pendingTrack = track; return; }
    this.music.play(track);
  }
  setIntensity(x) { if (this.music) this.music.intensity = x; }
}

// ---------------------------------------------------------------------------
// Music: tiny step sequencer. Each track provides a step(i, t) callback.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

class Music {
  constructor(engine) {
    this.e = engine;
    this.ctx = engine.ctx;
    this.track = null;
    this.intensity = 0.5;
    this.step = 0;
    this.nextTime = 0;
    this.bar = 0;
    this.tempo = 1;           // reality-switch tape effects
    this.pitch = 1;
    this.wobble = 0;
    this.mood = null;
    this.gain = this.ctx.createGain();
    this.gain.connect(engine.mus);
    this.lp = this.ctx.createBiquadFilter();
    this.lp.type = 'lowpass'; this.lp.frequency.value = 18000;
    this.lp.connect(this.gain);
    this.out = this.lp;
    setInterval(() => this.schedule(), 25);
  }

  play(name, { fadeIn = 0.6 } = {}) {
    if (this.name === name) return;
    this.name = name;
    const g = this.gain.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.0001, t + 0.4);
    clearTimeout(this.swapT);
    this.swapT = setTimeout(() => {
      this.track = TRACKS[name] || null;
      this.tempo = 1; this.pitch = 1; this.wobble = 0; this.ramp = null; this.mood = null;
      this.muffle(false);
      this.step = 0; this.bar = 0;
      this.nextTime = this.ctx.currentTime + 0.05;
      const tt = this.ctx.currentTime;
      g.cancelScheduledValues(tt);
      g.setValueAtTime(0.0001, tt);
      g.linearRampToValueAtTime(1, tt + fadeIn);
      this.variation = 0;
    }, 420);
  }

  // slow the tape down (tempo and pitch sag together) over `sec`
  warp(tempo, pitch, sec) {
    this.ramp = { t0: this.ctx.currentTime, dur: sec, tempo0: this.tempo, pitch0: this.pitch, tempo, pitch };
    const g = this.gain.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.0001, t + sec * 1.05);
    this.lp.frequency.cancelScheduledValues(t);
    this.lp.frequency.setTargetAtTime(500, t, sec * 0.5);
  }
  fadeOut(sec = 1) {
    const g = this.gain.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.0001, t + sec);
  }
  pitchAt(t) {
    if (!this.wobble) return this.pitch;
    return this.pitch * (1 + this.wobble * (Math.sin(t * 7.3) * 0.035 + Math.sin(t * 19.1) * 0.012));
  }

  // duck the music for a beat so a huge moment can land
  duck(sec = 0.8) {
    const g = this.gain.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.15, t + 0.04);
    g.linearRampToValueAtTime(1, t + sec);
  }

  // muffle the music (menus / pause / slow-mo)
  muffle(on) {
    const t = this.ctx.currentTime;
    this.lp.frequency.cancelScheduledValues(t);
    this.lp.frequency.setTargetAtTime(on ? 700 : 18000, t, 0.15);
  }

  schedule() {
    if (this.ramp) {
      const r = this.ramp, k = Math.min(1, (this.ctx.currentTime - r.t0) / r.dur), e = k * k * (3 - 2 * k);
      this.tempo = r.tempo0 + (r.tempo - r.tempo0) * e;
      this.pitch = r.pitch0 + (r.pitch - r.pitch0) * e;
      if (k >= 1) this.ramp = null;
    }
    if (!this.track || this.ctx.state !== 'running') return;
    const spb = 60 / this.track.bpm / 4 / this.tempo;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const i = this.step % 16;
      if (i === 0) { this.bar++; this.variation = Math.random(); }
      let t = this.nextTime;
      if (this.track.swing && i % 2 === 1) t += spb * this.track.swing;
      try { this.track.step(this, i, t, spb); } catch (err) { console.warn(err); }
      this.nextTime += spb;
      this.step++;
    }
  }

  // --- instruments
  kick(t, v = 0.9) {
    const e = this.e;
    e.tone(140, { t, type: 'sine', dur: 0.22, vol: v, slide: 42, slideTime: 0.1, dest: this.out });
    e.noise({ t, dur: 0.012, vol: v * 0.3, type: 'lowpass', freq: 2000, dest: this.out });
  }
  snare(t, v = 0.5, verb = 0.15) {
    const e = this.e;
    e.noise({ t, dur: 0.16, vol: v, type: 'bandpass', freq: 1900, q: 0.7, dest: this.out, verb });
    e.tone(190, { t, type: 'triangle', dur: 0.08, vol: v * 0.6, slide: 150, dest: this.out });
  }
  hat(t, v = 0.12, open = false) {
    this.e.noise({ t, dur: open ? 0.14 : 0.035, vol: v, type: 'highpass', freq: 7500, dest: this.out });
  }
  ride(t, v = 0.06) {
    this.e.noise({ t, dur: 0.3, vol: v, type: 'bandpass', freq: 9000, q: 3, dest: this.out });
    this.e.tone(5200, { t, type: 'square', dur: 0.2, vol: v * 0.15, dest: this.out });
  }
  reese(t, midi, dur, v = 0.22, cutoff = 420) {
    const ctx = this.ctx;
    const f = NOTE(midi) * this.pitchAt(t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.02);
    g.gain.setValueAtTime(v, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(cutoff * 0.6, t);
    lp.frequency.linearRampToValueAtTime(cutoff * 1.6, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(cutoff * 0.7, t + dur);
    lp.connect(g).connect(this.out);
    for (const d of [-9, 9]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
    const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = f / 2;
    const sg = ctx.createGain(); sg.gain.value = 0.9;
    s.connect(sg).connect(g); s.start(t); s.stop(t + dur + 0.05);
  }
  pad(t, midis, dur, v = 0.035, cutoff = 1400) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
    lp.connect(g);
    g.connect(this.out);
    const vs = ctx.createGain(); vs.gain.value = 0.6; g.connect(vs).connect(this.e.verbSend);
    for (const m of midis) for (const d of [-7, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(m) * this.pitchAt(t); o.detune.value = d;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  pluck(t, midi, v = 0.06, type = 'square', dur = 0.25, delay = true) {
    const e = this.e;
    e.tone(NOTE(midi), { t, type, dur, vol: v, filter: 2600, dest: this.out, verb: 0.2 });
    if (delay) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = NOTE(midi) * this.pitchAt(t);
      const g = ctx.createGain(); g.gain.setValueAtTime(v * 0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(e.delaySend); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  rhodes(t, midis, v = 0.05, dur = 1.4) {
    for (const m of midis) {
      this.e.tone(NOTE(m), { t, type: 'sine', dur, vol: v, attack: 0.005, dest: this.out, verb: 0.35 });
      this.e.tone(NOTE(m) * 2, { t, type: 'triangle', dur: dur * 0.3, vol: v * 0.3, dest: this.out });
    }
  }
  // lounge: two-operator FM electric piano with a little tine
  ep(t, midi, v = 0.04, dur = 1.6, pan = 0) {
    const ctx = this.ctx, f = NOTE(midi) * this.pitchAt(t);
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.5, t); mg.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.4);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(v * 0.38, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const tine = ctx.createOscillator(); tine.type = 'sine'; tine.frequency.value = f * 4.02;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(v * 0.22, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    let out = g;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    car.connect(g); tine.connect(tg).connect(g);
    out.connect(this.out);
    const vs = ctx.createGain(); vs.gain.value = 0.28; out.connect(vs).connect(this.e.verbSend);
    for (const o of [car, mod, tine]) { o.start(t); o.stop(t + dur + 0.05); }
  }
  ubass(t, midi, dur = 0.5, v = 0.2) {
    const ctx = this.ctx, f = NOTE(midi) * this.pitchAt(t);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.018, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1100, t); lp.frequency.exponentialRampToValueAtTime(420, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(v * 0.45, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(this.out);
    for (const x of [o, o2]) { x.start(t); x.stop(t + dur + 0.05); }
    this.e.noise({ t, dur: 0.02, vol: v * 0.25, type: 'lowpass', freq: 1200, dest: this.out });
  }
  jride(t, v = 0.03) {
    this.e.noise({ t, dur: 0.5, vol: v, type: 'bandpass', freq: 7200, q: 1.1, dest: this.out, verb: 0.15 });
    this.e.noise({ t, dur: 0.05, vol: v * 0.8, type: 'highpass', freq: 9500, dest: this.out });
    this.e.tone(3150, { t, type: 'sine', dur: 0.12, vol: v * 0.12, dest: this.out });
    this.e.tone(4730, { t, type: 'sine', dur: 0.08, vol: v * 0.08, dest: this.out });
  }
  brush(t, v = 0.02, dur = 0.32) {
    this.e.noise({ t, dur, vol: v, type: 'bandpass', freq: 2300, q: 0.6, attack: dur * 0.35, dest: this.out });
  }
  chick(t, v = 0.03) {
    this.e.noise({ t, dur: 0.03, vol: v, type: 'highpass', freq: 5200, dest: this.out });
  }

  crackle(t) {
    if (Math.random() < 0.5) this.e.noise({ t: t + Math.random() * 0.1, dur: 0.008, vol: 0.05 + Math.random() * 0.06, type: 'highpass', freq: 3000, dest: this.out });
  }
}

// Amen-ish break building blocks (4 steps each)
const BREAK = {
  K: [['k', 1], null, ['k', 0.9], null],
  S: [['s', 1], null, null, ['g', 0.4]],
  A: [null, ['s', 0.8], ['k', 0.9], null],
  B: [['s', 1], null, null, ['s', 0.7]],
  R: [['s', 0.5], ['s', 0.6], ['s', 0.8], ['s', 1]],
  G: [['g', 0.35], ['s', 0.9], null, ['g', 0.35]],
  X: [['k', 1], ['g', 0.3], ['s', 0.8], ['k', 0.6]],
};
const BREAK_BARS = ['KSAB', 'KSAB', 'KSGB', 'KXAR'];

function playBreak(m, i, t, v, bars = BREAK_BARS) {
  const bar = (m.bar - 1) % bars.length;
  let blocks = bars[bar];
  if (m.variation > 0.75 && bar === bars.length - 1) blocks = 'KRXR';
  const blk = BREAK[blocks[Math.floor(i / 4)]];
  const hit = blk[i % 4];
  if (hit) {
    if (hit[0] === 'k') m.kick(t, 0.85 * hit[1] * v);
    else if (hit[0] === 's') m.snare(t, 0.4 * hit[1] * v, 0.1);
    else m.snare(t, 0.16 * hit[1] * v, 0);
  }
  if (i % 2 === 0) m.hat(t, 0.08 * v, i % 8 === 6);
  else m.hat(t, 0.035 * v);
}

// 8 bars of soft changes in F (rootless voicings around middle C)
const LOUNGE = [
  { root: 41, q: 'maj', v: [57, 60, 64, 67] },                       // Fmaj9
  { root: 46, q: 'dom', v: [56, 60, 62, 67] },                       // Bb13
  { root: 45, q: 'min', v: [55, 60, 64, 67] },                       // Am7
  { root: 38, q: 'dom', v: [54, 60, 63, 69] },                       // D7b9
  { root: 43, q: 'min', v: [58, 62, 65, 69] },                       // Gm9
  { root: 48, q: 'dom', v: [58, 62, 64, 69] },                       // C13
  { root: 41, q: 'maj', v: [57, 60, 64, 67] },                       // Fmaj9
  { root: 43, q: 'min', v: [58, 62, 65, 69], root2: 36, v2: [58, 62, 64, 67] },  // Gm9 | C9
];

// a second tune: a minor ii-V-i cycle in D minor (the trio alternates every 16 bars)
const LOUNGE_B = [
  { root: 40, q: 'min', v: [55, 58, 62, 64] },                       // Em7b5
  { root: 45, q: 'dom', v: [55, 58, 61, 64] },                       // A7b9
  { root: 38, q: 'min', v: [53, 57, 60, 64] },                       // Dm9
  { root: 38, q: 'min', v: [53, 57, 60, 64], root2: 43, v2: [53, 57, 59, 64] },  // Dm9 | G13
  { root: 36, q: 'maj', v: [52, 55, 59, 62] },                       // Cmaj9
  { root: 41, q: 'maj', v: [55, 57, 60, 64] },                       // Fmaj9
  { root: 47, q: 'min', v: [57, 60, 62, 65] },                       // Bm7b5
  { root: 40, q: 'dom', v: [56, 59, 62, 65] },                       // E7b9
];
const loungeTune = (bar) => (Math.floor(bar / 16) % 2 ? LOUNGE_B : LOUNGE);   // bar counted from 0

// the table track changes character floor by floor (Endless cycles through them)
const TABLE_FLAVORS = [
  // THE BASEMENT
  { prog: [[53, 56, 60], [49, 53, 56, 60], [56, 60, 63], [51, 55, 58]], roots: [29, 25, 32, 27], bars: BREAK_BARS, padCut: 900, reeseCut: 260 },
  // THE DEEP END: lower and colder, a bell somewhere far away
  { prog: [[50, 53, 57], [46, 50, 53, 57], [48, 51, 55], [45, 48, 52]], roots: [26, 22, 24, 21], bars: ['KSGB', 'KXAB', 'KSAB', 'KXRR'], padCut: 650, reeseCut: 200,
    extra(m, i, t, spb, I, ch) { if (I > 0.3 && m.bar % 2 === 0 && (i === 0 || i === 3 || i === 6 || i === 10)) m.pluck(t, ch[(i + m.bar) % ch.length] + 24, 0.022, 'sine', 0.9); } },
  // THE HOUSE: chromatic and tense, stabs on the off-beat
  { prog: [[52, 55, 59], [53, 56, 60], [52, 55, 58], [51, 55, 58]], roots: [28, 29, 28, 27], bars: ['KSAB', 'KXAB', 'KSGB', 'KRXR'], padCut: 1100, reeseCut: 340,
    extra(m, i, t, spb, I, ch) { if (I > 0.4 && i % 4 === 2 && m.variation > 0.25) m.pluck(t, ch[0] + 12, 0.028, 'sawtooth', 0.12); } },
];

const TRACKS = {
  // late-night trip-hop for menus
  menu: {
    bpm: 84, swing: 0.18,
    step(m, i, t, spb) {
      const chords = [[57, 60, 64, 67, 71], [53, 57, 60, 64], [50, 53, 57, 60, 64], [52, 56, 59, 62]];
      const bass = [45, 41, 38, 40];
      const c = (m.bar - 1) % 4;
      if (i === 0) m.rhodes(t, chords[c], 0.07, spb * 15);
      if (i === 10 && m.variation > 0.4) m.rhodes(t, chords[c].slice(2), 0.045, spb * 6);
      if (i === 0 || i === 7 || i === 10) m.kick(t, i === 0 ? 1.0 : 0.7);
      if (i === 4 || i === 12) m.snare(t, 0.45, 0.35);
      if (i % 2 === 0) m.hat(t, 0.07);
      if (i === 0) m.e.tone(NOTE(bass[c]), { t, type: 'sine', dur: spb * 7, vol: 0.28, dest: m.out, attack: 0.02 });
      if (i === 8) m.e.tone(NOTE(bass[c] + (m.variation > 0.5 ? 7 : 12)), { t, type: 'sine', dur: spb * 5, vol: 0.2, dest: m.out, attack: 0.02 });
      m.crackle(t);
      if ((i === 3 || i === 11) && m.variation > 0.5) m.pluck(t, chords[c][(i + m.bar) % chords[c].length] + 12, 0.025, 'triangle', 0.4);
    },
  },
  // jungle for tables — layers enter with intensity
  table: {
    bpm: 168,
    step(m, i, t, spb) {
      const I = m.intensity;
      const F = TABLE_FLAVORS[(m.e.flavor || 0) % TABLE_FLAVORS.length];
      const prog = F.prog, roots = F.roots;
      const c = Math.floor((m.bar - 1) / 2) % 4;
      if (i === 0 && (m.bar - 1) % 2 === 0) m.pad(t, prog[c].map(n => n + 12), spb * 32, 0.022 + I * 0.01, F.padCut + I * 800);
      if (I > 0.15) playBreak(m, i, t, 0.55 + I * 0.45, F.bars);
      else if (i % 4 === 0) m.hat(t, 0.04);
      if (I > 0.35 && i === 0) m.reese(t, roots[c] + 12, spb * 14, 0.13 + I * 0.07, F.reeseCut + I * 300);
      if (I > 0.6 && (i === 6 || i === 14) && m.variation > 0.3) m.pluck(t, prog[c][(i + m.bar) % prog[c].length] + 24, 0.03, 'square', 0.15);
      if (I > 0.8 && i % 4 === 2) m.ride(t, 0.04);
      F.extra?.(m, i, t, spb, I, prog[c]);
    },
  },
  // smoky lounge for shops / events
  shop: {
    bpm: 96, swing: 0.22,
    step(m, i, t, spb) {
      const chords = [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 61, 64, 67]];
      const walk = [[38, 41, 45, 43], [43, 47, 50, 49], [36, 40, 43, 45], [45, 44, 43, 40]];
      const c = (m.bar - 1) % 4;
      if (i === 0 || (i === 10 && m.variation > 0.5)) m.rhodes(t, chords[c], 0.035, spb * 8);
      if (i % 4 === 0) m.e.tone(NOTE(walk[c][i / 4]), { t, type: 'triangle', dur: spb * 3.5, vol: 0.22, dest: m.out, attack: 0.01 });
      if (i % 4 === 0) m.ride(t, 0.035);
      if (i % 4 === 3) m.ride(t, 0.02);
      if (i === 4 || i === 12) m.e.noise({ t, dur: 0.12, vol: 0.06, type: 'bandpass', freq: 3000, dest: m.out });
      if (i === 0) m.kick(t, 0.35);
      if ((i === 6 || i === 14) && m.variation > 0.35) m.pluck(t, chords[c][(m.bar + i) % 4] + 12, 0.03, 'sine', 0.6);
      m.crackle(t);
    },
  },
  // CLASSIC: late-night hotel bar — electric piano, upright bass, brushes
  lounge: {
    bpm: 88,
    step(m, i, t, spb) {
      const L = loungeTune(m.bar - 1), bar = (m.bar - 1) % L.length, c = L[bar], n = loungeTune(m.bar)[m.bar % L.length];
      const sw = i % 4 === 2 ? spb * 0.64 : 0;          // swung eighths
      const tt = t + sw;
      const end = m.mood === 'end';
      const beat = i % 4 === 0;
      // bass: walking quarters (half notes when the match is over)
      if (beat && (!end || i % 8 === 0)) {
        const k = i / 4;
        const third = c.q === 'min' ? 3 : 4;
        const pat = m.variation > 0.5 ? [0, 7, 12, 'a'] : [0, third, 7, 'a'];
        let note = c.root + (pat[k] === 'a' ? 0 : pat[k]);
        if (pat[k] === 'a') note = n.root + (m.variation > 0.3 ? 1 : -1);
        if (c.root2 != null && k >= 2) note = c.root2 + (k === 3 ? 7 : 0);
        m.ubass(t, note, end ? spb * 7 : spb * 3.6, end ? 0.14 : 0.17);
      }
      // piano: Charleston comping, sometimes an anticipation into the next bar
      const voic = c.root2 != null && i >= 8 ? c.v2 : c.v;
      if (i === 0) voic.forEach((x, k) => m.ep(t + k * 0.008, x, end ? 0.03 : 0.028, end ? spb * 15 : spb * 5, (k - 1.5) * 0.15));
      if (!end && i === 6 && m.variation > 0.2) voic.forEach((x, k) => m.ep(tt + k * 0.006, x, 0.024, spb * 6, (k - 1.5) * 0.15));
      if (!end && i === 14 && m.variation > 0.75) n.v.forEach((x, k) => m.ep(tt + k * 0.006, x, 0.02, spb * 4, (k - 1.5) * 0.15));
      // a sparse right hand every few bars
      if (!end && (m.bar % 4 === 3) && (i === 2 || i === 6 || i === 10) && m.variation > 0.45) {
        const pool = c.v.map(x => x + 12);
        m.ep(tt, pool[(i + m.bar) % pool.length], 0.018, spb * 4, 0.3);
      }
      // brushes
      if (!end) {
        if (i === 0 || i === 4 || i === 8 || i === 12) m.jride(t, i === 4 || i === 12 ? 0.026 : 0.02);
        if (i === 6 || i === 14) m.jride(tt, 0.014);
        if (i === 4 || i === 12) m.chick(t, 0.02);
        if (beat) m.brush(t, 0.012, spb * 3.5);
        if (i === 0 && m.bar % 2 === 1) m.kick(t, 0.12);
      }
    },
  },
  // dark, heavy dnb for bosses
  boss: {
    bpm: 174,
    step(m, i, t, spb) {
      const roots = [28, 28, 29, 26];
      const c = (m.bar - 1) % 4;
      playBreak(m, i, t, 1.0, ['KSAB', 'KXAB', 'KSGB', 'KXRR']);
      if (i === 0) m.reese(t, roots[c] + 12, spb * 7.5, 0.2, 520);
      if (i === 8) m.reese(t, roots[c] + (m.variation > 0.5 ? 13 : 12), spb * 7.5, 0.2, 380);
      if (i === 0 && (m.bar - 1) % 4 === 0) m.pad(t, [52, 55, 58, 64], spb * 64, 0.03, 700);
      if ((i === 3 || i === 11) && m.variation > 0.5) m.e.tone(NOTE(76 + (i === 11 ? 1 : 0)), { t, type: 'sawtooth', dur: 0.1, vol: 0.05, filter: 2500, dest: m.out, verb: 0.3 });
    },
  },
};
