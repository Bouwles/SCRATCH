// Changing realities. Roguelite → Classic: the tape drags, the picture breaks
// down, the CRT shuts off with a click, one clean CLACK in the dark, and the
// lounge fades up. Classic → Roguelite: the jazz wavers, VHS interference, the
// clean image crumbles into pixels, the club snaps back on.

// tiny real-time timeline (independent of game time, which the switch pauses)
function timeline(steps) {
  const t0 = performance.now();
  const tweens = [];
  const events = steps.slice().sort((a, b) => a[0] - b[0]);
  return new Promise(resolve => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      while (events.length && events[0][0] <= t) {
        const [, fn] = events.shift();
        const tw = fn();
        if (tw) tweens.push({ ...tw, start: t });
      }
      for (let i = tweens.length - 1; i >= 0; i--) {
        const w = tweens[i], k = Math.min(1, (t - w.start) / w.dur);
        w.fn(w.ease ? w.ease(k) : k);
        if (k >= 1) tweens.splice(i, 1);
      }
      if (events.length || tweens.length) requestAnimationFrame(tick);
      else resolve();
    };
    tick();
  });
}
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);
const steps = n => k => Math.floor(k * n) / n;

export async function toClassic(g) {
  const R = g.renderer, fx = R.fx, A = g.audio, cui = g.classic.ui;
  g.state = 'transition';
  g.ui.closeAll();
  g.ui.showHUD(false);
  g.ui.root.style.transition = 'opacity 0.5s';
  g.ui.root.style.opacity = '0';
  const ps1 = !R.modern;
  await timeline([
    [0, () => { A.tapeStop(1.05); return null; }],
    // the picture sags: heavier pixels, tracking errors, snow creeping in
    [0, () => ({ dur: 1.0, ease: smooth, fn: k => { fx.pixel = lerp(1, ps1 ? 3.5 : 10, steps(6)(k)); fx.glitch = k * 0.55; fx.statik = k * 0.22; R.grade.desat = k * 0.5; } })],
    [0.9, () => { A.staticBurst(0.32, 0.09); return { dur: 0.3, fn: k => { fx.statik = lerp(0.22, 0.85, k); fx.glitch = lerp(0.55, 0.9, k); } }; }],
    // the CRT gives up: a bright line, a dot, nothing
    [1.2, () => { A.crtOff(); fx.pixel = 1; return { dur: 0.36, ease: k => 1 - (1 - k) * (1 - k), fn: k => { fx.collapse = k; fx.statik = 0.3 * (1 - k); fx.glitch = 0.3 * (1 - k); } }; }],
    [1.6, () => { R.fade = 1; fx.collapse = 0; fx.statik = 0; fx.glitch = 0; R.grade.desat = 0; A.playMusic('none'); return null; }],
  ]);
  // in the dark: tear down the club, build the lounge
  await new Promise(r => setTimeout(r, 30));
  g.classic.mount();
  g.camera.position.set(0, 0.6, 3.6);
  g.cam.yaw = 0.6; g.cam.pitch = 0.44; g.cam.dist = 3.5;
  await timeline([
    [0.12, () => { A.cClack(3.2); return null; }],
    [0.35, () => { cui.logo('in'); return null; }],
    [0.7, () => { A.playMusic('lounge'); return { dur: 1.2, ease: smooth, fn: k => { R.fade = 1 - k; } }; }],
    [1.65, () => { cui.logo('out'); return null; }],
    [2.05, () => { g.classic.toMenu(); return null; }],
  ]);
  R.fade = 0;
}

export async function toRogue(g, after) {
  const R = g.renderer, fx = R.fx, A = g.audio, cui = g.classic.ui;
  g.state = 'transition';
  cui.closeAll();
  cui.hud(false);
  g.cue.visible = false;
  g.classic.aim.hide(); g.classic.aim.hidePlace();
  if (A.music) { A.music.wobble = 1; A.music.fadeOut(1.3); }
  await timeline([
    [0, () => { cui.logo('in'); A.staticBurst(0.6, 0.05); return { dur: 0.9, fn: k => { fx.glitch = k * 0.7; fx.statik = 0.05 + Math.random() * 0.18 * k; } }; }],
    [0.55, () => { cui.logo('glitch'); return { dur: 0.75, ease: steps(8), fn: k => { fx.pixel = lerp(1, 22, k); } }; }],
    [1.25, () => { A.staticBurst(0.25, 0.16); fx.statik = 1; return null; }],
  ]);
  // snap: the club comes back
  g.classic.unmount();
  cui.logo('');
  g.lights.master = 0;
  if (after) after(); else g.toMenu();
  g.ui.root.style.opacity = '0';
  await timeline([
    [0.02, () => { A.powerOn(); fx.statik = 0.4; fx.glitch = 0.3; return { dur: 0.45, ease: steps(3), fn: k => { fx.pixel = lerp(10, 1, k); fx.statik = lerp(0.4, 0, k); fx.glitch = lerp(0.3, 0, k); } }; }],
    // the club lights stutter on
    [0.1, () => ({ dur: 0.7, fn: k => { g.lights.master = k < 0.3 ? (Math.random() < 0.5 ? 0.2 : 0.8) : k < 0.55 ? (Math.random() < 0.3 ? 0.4 : 1) : 1; } })],
    [0.5, () => { g.ui.root.style.opacity = '1'; return null; }],
  ]);
  fx.pixel = 1; fx.glitch = 0; fx.statik = 0; fx.collapse = 0;
  g.lights.master = 1;
}
