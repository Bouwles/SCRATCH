// Two looks, one scene.
//
// PS1 (default): render at a deliberately low internal resolution, then a
// low-res composite (bloom, grade, 15-bit posterize + ordered dither, void
// swirl) and a nearest-neighbour upscale with CRT, chroma bleed and grain.
//
// MODERN: render at (near) native resolution into a multisampled target, wide
// soft bloom, filmic shoulder, clean linear upscale. Materials switch to their
// per-pixel path via shared.uModern (see materials.js).

import * as THREE from 'three';
import { shared } from './materials.js';

const quadVert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const brightFrag = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
    vec3 s = texture2D(tDiffuse, vUv + vec2(float(x), float(y)) * uTexel).rgb;
    float l = max(max(s.r, s.g), s.b);
    c += s * smoothstep(uThreshold, 1.0, l);
  }
  gl_FragColor = vec4(c / 9.0, 1.0);
}
`;

const blurFrag = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227;
  c += texture2D(tDiffuse, vUv + uDir * 1.38).rgb * 0.316;
  c += texture2D(tDiffuse, vUv - uDir * 1.38).rgb * 0.316;
  c += texture2D(tDiffuse, vUv + uDir * 3.23).rgb * 0.070;
  c += texture2D(tDiffuse, vUv - uDir * 3.23).rgb * 0.070;
  gl_FragColor = vec4(c, 1.0);
}
`;

const compositeFrag = /* glsl */`
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec2 uRes;
uniform float uBloom;
uniform float uLevels;
uniform float uDither;
uniform vec3 uSwirl;       // xy = uv centre, z = strength
uniform float uSwirlR;
uniform float uTime;
uniform vec3 uGradeLift;
uniform vec3 uGradeGain;
uniform float uSat;
uniform float uDesat;
uniform float uModern;
varying vec2 vUv;
float bayer4(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (m[i] + 0.5) / 16.0 - 0.5;
}
void main() {
  vec2 uv = vUv;
  if (uSwirl.z != 0.0) {
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    vec2 d = (uv - uSwirl.xy) * asp;
    float r = length(d);
    float k = smoothstep(uSwirlR, 0.0, r);
    float ang = uSwirl.z * k * k * 3.0;
    float cs = cos(ang), sn = sin(ang);
    d = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs) * (1.0 - k * 0.25 * sign(uSwirl.z));
    uv = uSwirl.xy + d / asp;
  }
  vec3 c = texture2D(tScene, uv).rgb;
  c += texture2D(tBloom, uv).rgb * uBloom;
  // grade
  c = c * uGradeGain + uGradeLift * (1.0 - c);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat * (1.0 - uDesat));
  if (uModern > 0.5) {
    // gentle filmic shoulder keeps neon and lamp hot-spots from clipping hard
    c = max(c, 0.0);
    c = c * (1.0 + c / 5.0) / (1.0 + c * 0.75);
    gl_FragColor = vec4(c, 1.0);
    return;
  }
  c = c / (1.0 + max(c - 1.0, 0.0) * 0.5);
  // 15-bit style posterize with ordered dither
  vec2 px = floor(uv * uRes);
  c = floor(c * uLevels + 0.5 + bayer4(px) * uDither) / uLevels;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const finalFrag = /* glsl */`
uniform sampler2D tLow;
uniform vec2 uLowRes;
uniform vec2 uScreen;
uniform float uCRT;
uniform float uCA;
uniform float uGrain;
uniform float uTime;
uniform vec3 uFlash;
uniform float uFlashAmt;
uniform float uVignette;
uniform float uFade;
uniform float uModern;
uniform float uMirror;
uniform float uPixel;      // >1: block pixelation in screen pixels (mode transitions)
uniform float uGlitch;     // 0..1 VHS tracking tear / roll
uniform float uStatic;     // 0..1 snow
uniform float uCollapse;   // 0..1 CRT power-off (0.55 = a line, 1 = gone)
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) / vec2(7.0, 5.5);
  uv = uv + uv * off * off;
  return uv * 0.5 + 0.5;
}
void main() {
  vec2 uv = vUv;
  float boost = 1.0;
  if (uCollapse > 0.0) {
    // the picture squeezes to a bright line, then to a dot, then nothing
    float sy = max(0.004, 1.0 - smoothstep(0.0, 0.55, uCollapse));
    float sx = max(0.003, 1.0 - smoothstep(0.55, 1.0, uCollapse));
    vec2 d = (uv - 0.5) / vec2(sx, sy);
    if (abs(d.x) > 0.5 || abs(d.y) > 0.5 || uCollapse >= 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    uv = d + 0.5;
    boost = 1.0 + uCollapse * 4.0;
  }
  if (uGlitch > 0.0) {
    float band = floor(uv.y * 72.0);
    float n = hash(vec2(band, floor(uTime * 22.0)));
    uv.x += step(1.0 - uGlitch * 0.4, n) * (hash(vec2(band, floor(uTime * 29.0))) - 0.5) * 0.14 * uGlitch;
    uv.x += sin(uv.y * 38.0 + uTime * 26.0) * 0.004 * uGlitch;
    uv.y = fract(uv.y + uGlitch * uGlitch * 0.06 * sin(uTime * 2.3));
  }
  if (uPixel > 1.0) { vec2 blocks = uScreen / uPixel; uv = (floor(uv * blocks) + 0.5) / blocks; }
  if (uMirror > 0.5) uv.x = 1.0 - uv.x;
  bool crt = uCRT > 0.5 && uModern < 0.5;
  if (crt) uv = curve(uv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 texel = 1.0 / uLowRes;
  vec2 cuv = uModern > 0.5 ? uv : (floor(uv * uLowRes) + 0.5) * texel;
  float edge = length(uv - 0.5);
  vec3 c;
  float caAmt = uCA + uGlitch * 2.5;
  if (caAmt > 0.0) {
    float ca = caAmt * (0.35 + edge * 1.6);
    vec2 off = uModern > 0.5 ? vec2(ca * 0.0012 * edge * 2.0, 0.0) : vec2(ca * texel.x, 0.0);
    c.r = texture2D(tLow, cuv + off).r;
    c.g = texture2D(tLow, cuv).g;
    c.b = texture2D(tLow, cuv - off).b;
  } else c = texture2D(tLow, cuv).rgb;
  if (crt) {
    float row = fract(uv.y * uLowRes.y);
    float scan = 0.78 + 0.22 * smoothstep(0.0, 0.35, row) * smoothstep(1.0, 0.65, row);
    c *= scan;
    float mx = mod(gl_FragCoord.x, 3.0);
    vec3 mask = mx < 1.0 ? vec3(1.06, 0.96, 0.96) : mx < 2.0 ? vec3(0.96, 1.06, 0.96) : vec3(0.96, 0.96, 1.06);
    c *= mask;
    c *= 1.12;
  } else if (uCRT > 0.5) {
    // modern + CRT: a whisper of scanlines only
    c *= 0.94 + 0.06 * sin(uv.y * 900.0);
  }
  c *= 1.0 - uVignette * smoothstep(0.35, 0.85, edge);
  float g = uModern > 0.5 ? hash(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7) - 0.5 : hash(floor(uv * uLowRes) + fract(uTime * 7.13) * 91.7) - 0.5;
  c += g * uGrain;
  if (uStatic > 0.0) {
    float sn = hash(floor(gl_FragCoord.xy / max(1.0, uPixel * 0.5)) + fract(uTime * 13.7) * 311.0);
    c = mix(c, vec3(sn * 0.85), uStatic);
  }
  c *= boost;
  c = mix(c, uFlash, uFlashAmt);
  c *= 1.0 - uFade;
  gl_FragColor = vec4(c, 1.0);
}
`;

function makeRT(w, h, { depth = false, linear = false, samples = 0 } = {}) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    minFilter: linear ? THREE.LinearFilter : THREE.NearestFilter,
    magFilter: linear ? THREE.LinearFilter : THREE.NearestFilter,
    depthBuffer: depth,
    type: THREE.HalfFloatType,
    samples,
  });
  rt.texture.generateMipmaps = false;
  return rt;
}

export class PS1Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(1);
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.autoClear = true;
    this.mode = 'ps1';
    this.targetHeight = 240;
    this.resScale = 'auto';
    this.settings = { crt: true, ca: 0.6, grain: 0.05, bloom: 0.9, jitter: 1 };
    this.flash = { color: new THREE.Color(1, 1, 1), amt: 0 };
    this.fade = 0;
    this.fx = { pixel: 1, glitch: 0, statik: 0, collapse: 0 };   // mode-transition effects
    this.msaa = true;
    this.mirror = false;
    this.swirl = new THREE.Vector3(0.5, 0.5, 0);
    this.swirlR = 0.25;
    this.grade = { lift: new THREE.Vector3(0.035, 0.015, 0.06), gain: new THREE.Vector3(1.05, 1.0, 1.08), sat: 1.25, desat: 0 };
    this.levels = 28;

    const quad = new THREE.PlaneGeometry(2, 2);
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(quad, null);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0.55 } },
      vertexShader: quadVert, fragmentShader: brightFrag, depthTest: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: quadVert, fragmentShader: blurFrag, depthTest: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom: { value: null },
        uRes: { value: new THREE.Vector2() }, uBloom: { value: 0.9 },
        uLevels: { value: 28 }, uDither: { value: 1.0 },
        uSwirl: { value: this.swirl }, uSwirlR: { value: 0.25 },
        uTime: shared.uTime,
        uGradeLift: { value: this.grade.lift }, uGradeGain: { value: this.grade.gain },
        uSat: { value: 1.25 }, uDesat: { value: 0 }, uModern: { value: 0 },
      },
      vertexShader: quadVert, fragmentShader: compositeFrag, depthTest: false,
    });
    this.finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tLow: { value: null }, uLowRes: { value: new THREE.Vector2() }, uScreen: { value: new THREE.Vector2() },
        uCRT: { value: 1 }, uCA: { value: 0.6 }, uGrain: { value: 0.05 }, uTime: shared.uTime,
        uFlash: { value: this.flash.color }, uFlashAmt: { value: 0 }, uVignette: { value: 0.55 }, uFade: { value: 0 },
        uModern: { value: 0 }, uMirror: { value: 0 },
        uPixel: { value: 1 }, uGlitch: { value: 0 }, uStatic: { value: 0 }, uCollapse: { value: 0 },
      },
      vertexShader: quadVert, fragmentShader: finalFrag, depthTest: false,
    });
    this.resize();
  }

  get modern() { return this.mode === 'modern'; }

  configure({ mode, ps1Height, resScale, msaa }) {
    let changed = false;
    if (msaa !== undefined && msaa !== this.msaa) { this.msaa = msaa; changed = true; }
    if (mode && mode !== this.mode) { this.mode = mode; changed = true; }
    if (ps1Height && ps1Height !== this.targetHeight) { this.targetHeight = ps1Height; changed = true; }
    if (resScale !== undefined && resScale !== this.resScale) { this.resScale = resScale; changed = true; }
    shared.uModern.value = this.modern ? 1 : 0;
    if (changed) this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.floor(window.innerWidth * dpr);
    const ch = Math.floor(window.innerHeight * dpr);
    this.gl.setSize(cw, ch, false);
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    let lw, lh;
    if (this.modern) {
      const rs = this.resScale === 'auto' ? (dpr >= 2 ? 0.72 : (cw > 2200 ? 0.8 : 1)) : this.resScale;
      lw = Math.max(320, Math.round(cw * rs)); lh = Math.max(180, Math.round(ch * rs));
      this.scale = 1;
    } else {
      // integer pixel scale so every low-res pixel is the same size on screen
      const scale = Math.max(1, Math.round(ch / this.targetHeight));
      lw = Math.ceil(cw / scale); lh = Math.ceil(ch / scale);
      this.scale = scale;
    }
    this.lowW = lw; this.lowH = lh;
    this.screenW = cw; this.screenH = ch;
    for (const k of ['rtScene', 'rtComp', 'rtB1', 'rtB2']) this[k]?.dispose();
    const m = this.modern;
    this.rtScene = makeRT(lw, lh, { depth: true, linear: m, samples: m && this.msaa ? 4 : 0 });
    this.rtComp = makeRT(lw, lh, { linear: m });
    const div = m ? 2 : 3;
    const bw = Math.max(8, Math.floor(lw / div)), bh = Math.max(8, Math.floor(lh / div));
    this.rtB1 = makeRT(bw, bh, { linear: true });
    this.rtB2 = makeRT(bw, bh, { linear: true });
    this.bloomRes = new THREE.Vector2(bw, bh);
    shared.uSnap.value.set(lw, lh);
    shared.uPointScale.value = m ? lh / 240 : 1;
    this.aspect = cw / ch;
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  render(scene, camera) {
    const gl = this.gl;
    const m = this.modern;
    shared.uJitter.value = m ? 0 : this.settings.jitter;
    gl.setRenderTarget(this.rtScene);
    gl.render(scene, camera);

    if (this.settings.bloom > 0) {
      this.brightMat.uniforms.tDiffuse.value = this.rtScene.texture;
      this.brightMat.uniforms.uTexel.value.set(1 / this.lowW, 1 / this.lowH);
      this.brightMat.uniforms.uThreshold.value = this.settings.bloomThreshold ?? (m ? 0.62 : 0.55);
      this.pass(this.brightMat, this.rtB1);
      const iters = m ? 2 : 1;
      for (let i = 0; i < iters; i++) {
        const s = 1 + i * 1.5;
        this.blurMat.uniforms.tDiffuse.value = this.rtB1.texture;
        this.blurMat.uniforms.uDir.value.set(s / this.bloomRes.x, 0);
        this.pass(this.blurMat, this.rtB2);
        this.blurMat.uniforms.tDiffuse.value = this.rtB2.texture;
        this.blurMat.uniforms.uDir.value.set(0, s / this.bloomRes.y);
        this.pass(this.blurMat, this.rtB1);
      }
    }

    const cu = this.compMat.uniforms;
    cu.tScene.value = this.rtScene.texture;
    cu.tBloom.value = this.rtB1.texture;
    cu.uRes.value.set(this.lowW, this.lowH);
    cu.uBloom.value = this.settings.bloom * (m ? 1.1 : 1);
    cu.uLevels.value = this.levels;
    cu.uSwirlR.value = this.swirlR;
    cu.uSat.value = m ? 1 + (this.grade.sat - 1) * 0.6 : this.grade.sat;
    cu.uDesat.value = this.grade.desat;
    cu.uModern.value = m ? 1 : 0;
    this.pass(this.compMat, this.rtComp);

    const fu = this.finalMat.uniforms;
    fu.tLow.value = this.rtComp.texture;
    fu.uLowRes.value.set(this.lowW, this.lowH);
    fu.uScreen.value.set(this.screenW, this.screenH);
    fu.uCRT.value = this.settings.crt ? 1 : 0;
    fu.uCA.value = this.settings.ca;
    fu.uGrain.value = this.settings.grain;
    fu.uFlashAmt.value = this.flash.amt;
    fu.uFade.value = this.fade;
    fu.uModern.value = m ? 1 : 0;
    fu.uVignette.value = this.settings.vignette ?? (m ? 0.4 : 0.55);
    fu.uMirror.value = this.mirror ? 1 : 0;
    fu.uPixel.value = this.fx.pixel;
    fu.uGlitch.value = this.fx.glitch;
    fu.uStatic.value = this.fx.statik;
    fu.uCollapse.value = this.fx.collapse;
    this.pass(this.finalMat, null);
  }

  // Project a world position to CSS pixel coordinates (mirror-aware).
  project(v, camera, out = { x: 0, y: 0, visible: true }) {
    const p = v.clone().project(camera);
    let u = p.x * 0.5 + 0.5;
    if (this.mirror) u = 1 - u;
    out.x = u * window.innerWidth;
    out.y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    out.visible = p.z < 1;
    out.u = p.x * 0.5 + 0.5;          // composite-space (pre-mirror) coords for the swirl
    out.v = p.y * 0.5 + 0.5;
    return out;
  }
}
