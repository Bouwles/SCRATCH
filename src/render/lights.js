// Manages the fixed-size point light array fed to every PS1 shader.
// Slots: 0-2 table lamps, 3-6 room accents, 7-9 transient flashes.

import * as THREE from 'three';
import { shared, MAX_LIGHTS } from './materials.js';

export class LightRig {
  constructor() {
    this.slots = Array.from({ length: MAX_LIGHTS }, () => ({
      pos: new THREE.Vector3(0, -100, 0), color: new THREE.Color(0, 0, 0), range: 1, intensity: 0,
      flicker: 0, base: 0, life: 0, maxLife: 0, dynamic: false,
    }));
    this.master = 1;
    this.lampMul = 1;
    this.accentMul = 1;
  }

  set(i, pos, color, range, intensity, flicker = 0) {
    const s = this.slots[i];
    s.pos.copy(pos); s.color.copy(color instanceof THREE.Color ? color : new THREE.Color(color));
    s.range = range; s.intensity = intensity; s.base = intensity; s.flicker = flicker;
    s.dynamic = false; s.life = 0;
  }

  clear(i) { this.slots[i].intensity = 0; this.slots[i].base = 0; }

  flash(pos, color, range = 1.5, intensity = 3, duration = 0.35) {
    // pick the dynamic slot with least remaining life
    let best = 7;
    for (let i = 7; i < MAX_LIGHTS; i++) if (this.slots[i].life < this.slots[best].life) best = i;
    const s = this.slots[best];
    s.pos.copy(pos); s.color.set(color); s.range = range; s.base = intensity;
    s.life = duration; s.maxLife = duration; s.dynamic = true;
  }

  update(dt, t) {
    const P = shared.uLightPos.value, C = shared.uLightColor.value, Rg = shared.uLightRange.value;
    this.slots.forEach((s, i) => {
      let k = s.base;
      if (s.dynamic) {
        s.life = Math.max(0, s.life - dt);
        k = s.base * (s.maxLife > 0 ? Math.pow(s.life / s.maxLife, 1.5) : 0);
      } else if (s.flicker > 0) {
        const n = Math.sin(t * 13.1 + i * 7) * Math.sin(t * 5.3 + i * 3) + Math.sin(t * 31 + i);
        if (n > 2 - s.flicker * 1.4) k *= 0.15;
        else k *= 1 - s.flicker * 0.08 * (0.5 + 0.5 * Math.sin(t * 60 + i));
      }
      const mul = this.master * (i < 3 ? this.lampMul : i < 7 ? this.accentMul : 1);
      s.intensity = k;
      P[i].copy(s.pos);
      C[i].copy(s.color).multiplyScalar(k * mul);
      Rg[i] = s.range;
    });
  }
}
