// Materials with two paths, switched globally by shared.uModern:
//
// PS1: per-vertex (Gouraud) lighting, vertex snapping to the low-res pixel
//      grid, affine texture warping, banded ball shading, screen-door alpha.
// MODERN: per-pixel lighting with material gloss, perspective-correct UVs,
//      smooth ball shading with cube-mapped reflections of the room, real alpha.

import '../core/setup.js';
import * as THREE from 'three';

export const MAX_LIGHTS = 10;

// Uniforms shared by every material (same object references → one update).
export const shared = {
  uTime: { value: 0 },
  uSnap: { value: new THREE.Vector2(426, 240) },
  uJitter: { value: 1.0 },
  uModern: { value: 0 },
  uPointScale: { value: 1 },
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, -100, 0)) },
  uLightColor: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
  uLightRange: { value: new Array(MAX_LIGHTS).fill(1) },
  uAmbient: { value: new THREE.Color(0.05, 0.04, 0.08) },
  uSky: { value: new THREE.Color(0.10, 0.08, 0.16) },
  uGround: { value: new THREE.Color(0.02, 0.02, 0.03) },
  uFogColor: { value: new THREE.Color(0.03, 0.02, 0.06) },
  uFogNear: { value: 3.0 },
  uFogFar: { value: 11.0 },
  uEnvMap: { value: null },
  uEnvCube: { value: null },
  uHasCube: { value: 0 },
};

// Every PS1 material is registered so a graphics-mode switch can flip the few
// render-state flags a uniform can't (alpha blending instead of screen-door).
export const registry = new Set();

export function setMaterialMode(modern) {
  for (const m of registry) {
    if (m.userData.screenDoor) {
      m.transparent = modern;
      m.depthWrite = !modern;
      m.needsUpdate = true;
    }
  }
}

// Free everything a rebuilt group owned: geometry, materials and the canvas
// textures on them. Render-target and long-lived textures (userData.keep) survive.
export function disposeTree(root) {
  const mats = new Set(), texs = new Set();
  root.traverse(o => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material || [])) mats.add(m);
  });
  for (const m of mats) {
    for (const k in m) if (m[k]?.isTexture) texs.add(m[k]);
    if (m.uniforms) for (const k in m.uniforms) if (!(k in shared) && m.uniforms[k]?.value?.isTexture) texs.add(m.uniforms[k].value);
    m.dispose();
  }
  for (const t of texs) if (!t.isRenderTargetTexture && !t.userData.keep) t.dispose();
  root.clear();
}

const commonVert = /* glsl */`
uniform vec2 uSnap;
uniform float uJitter;
uniform float uTime;
uniform float uModern;
uniform vec3 uLightPos[${MAX_LIGHTS}];
uniform vec3 uLightColor[${MAX_LIGHTS}];
uniform float uLightRange[${MAX_LIGHTS}];
uniform vec3 uAmbient;
uniform vec3 uSky;
uniform vec3 uGround;
uniform float uFogNear;
uniform float uFogFar;

vec4 ps1Snap(vec4 clip) {
  if (uJitter <= 0.0 || uModern > 0.5) return clip;
  vec2 grid = uSnap * 0.5 / uJitter;
  vec2 ndc = clip.xy / clip.w;
  ndc = floor(ndc * grid + 0.5) / grid;
  clip.xy = ndc * clip.w;
  return clip;
}

vec3 ps1Light(vec3 wp, vec3 n) {
  vec3 col = uAmbient + mix(uGround, uSky, n.y * 0.5 + 0.5);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec3 L = uLightPos[i] - wp;
    float d = length(L);
    float att = clamp(1.0 - d / uLightRange[i], 0.0, 1.0);
    att *= att;
    float ndl = max(dot(n, L / max(d, 1e-4)), 0.0);
    col += uLightColor[i] * (ndl * 0.85 + 0.15) * att;
  }
  return col;
}
`;

const ps1Vert = /* glsl */`
${commonVert}
uniform float uUnlit;
uniform float uWave;
attribute vec3 color;
varying vec3 vLight;
varying vec3 vUvW;
varying vec2 vUv;
varying float vFog;
varying vec3 vColor;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vec3 pos = position;
  #ifdef USE_INSTANCING
  mat4 mm = modelMatrix * instanceMatrix;
  #else
  mat4 mm = modelMatrix;
  #endif
  vec4 wp = mm * vec4(pos, 1.0);
  if (uWave > 0.0) wp.xyz += vec3(sin(uTime * 1.7 + wp.y * 3.0), 0.0, cos(uTime * 1.3 + wp.y * 2.0)) * uWave;
  vec3 n = normalize(mat3(mm) * normal);
  vNormalW = n;
  vLight = (uUnlit > 0.5 || uModern > 0.5) ? vec3(1.0) : ps1Light(wp.xyz, n);
  vec4 vp = viewMatrix * wp;
  vec4 clip = projectionMatrix * vp;
  clip = ps1Snap(clip);
  gl_Position = clip;
  vUv = uv;
  vUvW = vec3(uv * clip.w, clip.w);
  vFog = smoothstep(uFogNear, uFogFar, -vp.z);
  #ifdef USE_VCOLOR
  vColor = color;
  #else
  vColor = vec3(1.0);
  #endif
  vWorld = wp.xyz;
}
`;

const bayer = /* glsl */`
float bayer4(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (m[i] + 0.5) / 16.0;
}
`;

const ps1Frag = /* glsl */`
uniform sampler2D map;
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform float uOpacity;
uniform float uAffine;
uniform float uFogAmt;
uniform vec3 uFogColor;
uniform float uScreenDoor;
uniform float uHasMap;
uniform vec2 uUvScroll;
uniform float uTime;
uniform float uAlphaTest;
uniform float uUnlit;
uniform float uModern;
uniform float uGloss;
uniform float uShine;
uniform vec3 uLightPos[${MAX_LIGHTS}];
uniform vec3 uLightColor[${MAX_LIGHTS}];
uniform float uLightRange[${MAX_LIGHTS}];
uniform vec3 uAmbient;
uniform vec3 uSky;
uniform vec3 uGround;
varying vec3 vLight;
varying vec3 vUvW;
varying vec2 vUv;
varying float vFog;
varying vec3 vColor;
varying vec3 vWorld;
varying vec3 vNormalW;
${bayer}
void main() {
  bool modern = uModern > 0.5;
  vec2 uv = (modern ? vUv : mix(vUv, vUvW.xy / vUvW.z, uAffine)) + uUvScroll * uTime;
  vec4 tex = uHasMap > 0.5 ? texture2D(map, uv) : vec4(1.0);
  if (tex.a < uAlphaTest) discard;
  vec3 base = tex.rgb * uColor * vColor;
  vec3 light = vLight;
  vec3 spec = vec3(0.0);
  if (modern && uUnlit < 0.5) {
    vec3 n = normalize(vNormalW);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(cameraPosition - vWorld);
    light = uAmbient + mix(uGround, uSky, n.y * 0.5 + 0.5);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      vec3 L = uLightPos[i] - vWorld;
      float d = length(L);
      float att = clamp(1.0 - d / uLightRange[i], 0.0, 1.0);
      att *= att;
      L /= max(d, 1e-4);
      float ndl = max(dot(n, L), 0.0);
      light += uLightColor[i] * (ndl * 0.9 + 0.1) * att * 0.86;
      vec3 h = normalize(L + v);
      spec += uLightColor[i] * pow(max(dot(n, h), 0.0), uShine) * att * ndl;
    }
  }
  vec3 col = base * light + uEmissive * tex.rgb + spec * uGloss;
  col = mix(col, uFogColor, vFog * uFogAmt);
  float a = tex.a * uOpacity;
  if (uScreenDoor > 0.5 && !modern) {
    if (a < bayer4(gl_FragCoord.xy)) discard;
    a = 1.0;
  }
  gl_FragColor = vec4(col, a);
}
`;

export function ps1Material(opts = {}) {
  const {
    map = null, color = 0xffffff, emissive = 0x000000, unlit = false,
    opacity = 1, transparent = false, additive = false, side = THREE.FrontSide,
    affine = 0.55, fog = 1, screenDoor = false, vertexColors = false,
    depthWrite, scroll = [0, 0], alphaTest = 0.0, wave = 0,
    gloss = 0.12, shine = 24,
  } = opts;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      map: { value: map },
      uHasMap: { value: map ? 1 : 0 },
      uColor: { value: new THREE.Color(color) },
      uEmissive: { value: new THREE.Color(emissive) },
      uOpacity: { value: opacity },
      uAffine: { value: affine },
      uFogAmt: { value: fog },
      uUnlit: { value: unlit ? 1 : 0 },
      uScreenDoor: { value: screenDoor ? 1 : 0 },
      uUvScroll: { value: new THREE.Vector2(scroll[0], scroll[1]) },
      uAlphaTest: { value: alphaTest },
      uWave: { value: wave },
      uGloss: { value: gloss },
      uShine: { value: shine },
    },
    vertexShader: ps1Vert,
    fragmentShader: ps1Frag,
    transparent: transparent || additive,
    side,
    defines: vertexColors ? { USE_VCOLOR: '' } : {},
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: depthWrite ?? !(transparent || additive),
  });
  mat.isPS1 = true;
  mat.userData.screenDoor = screenDoor;
  if (screenDoor && shared.uModern.value > 0.5) { mat.transparent = true; mat.depthWrite = false; }
  registry.add(mat);
  mat.addEventListener('dispose', () => registry.delete(mat));
  return mat;
}

// ---------------------------------------------------------------------------
// Ball material. PS1: banded diffuse, hard specular dot, pixelated equirect
// reflection. MODERN: smooth diffuse, layered specular (clearcoat glint +
// broad sheen), cube-mapped reflection of the actual room, fresnel.

const ballVert = /* glsl */`
${commonVert}
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vUv;
varying float vFog;
varying vec3 vView;
varying vec3 vObjN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vObjN = normal;
  vWorld = wp.xyz;
  vec4 vp = viewMatrix * wp;
  vView = normalize(cameraPosition - wp.xyz);
  vec4 clip = projectionMatrix * vp;
  gl_Position = ps1Snap(clip);
  vUv = uv;
  vFog = smoothstep(uFogNear, uFogFar, -vp.z);
}
`;

const ballFrag = /* glsl */`
uniform sampler2D map;
uniform sampler2D uEnvMap;
uniform samplerCube uEnvCube;
uniform float uHasCube;
uniform float uModern;
uniform vec3 uLightPos[${MAX_LIGHTS}];
uniform vec3 uLightColor[${MAX_LIGHTS}];
uniform float uLightRange[${MAX_LIGHTS}];
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uTime;
uniform float uReflect;
uniform float uSpec;
uniform vec3 uRim;
uniform float uRimAmt;
uniform vec3 uEmissive;
uniform float uEmissiveAmt;
uniform float uBands;
uniform float uOpacity;
uniform float uFx;          // see BALL_FX
uniform float uKind;        // 0 cue, 1 solid, 2 stripe, 3 eight, 4 special
uniform vec3 uHue;          // this ball's colour in its set
uniform float uSeed;
uniform vec3 uTint;
uniform float uFlash;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vUv;
varying float vFog;
varying vec3 vView;
varying vec3 vObjN;
${bayer}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec2 envUv(vec3 r) {
  return vec2(atan(r.z, r.x) / 6.2831853 + 0.5, acos(clamp(r.y, -1.0, 1.0)) / 3.14159265);
}
void main() {
  bool modern = uModern > 0.5;
  vec3 n = normalize(vN);
  vec3 v = normalize(vView);
  vec4 tex = texture2D(map, vUv);
  vec3 base = tex.rgb * uTint;
  // ---- the set's effect lives only in the coloured parts of the ball: never on
  // the number discs, only on the band of a stripe, only faintly on the cue ball
  vec2 d1 = (vUv - vec2(0.25, 0.5)) / vec2(0.078, 0.145);
  vec2 d2 = (vUv - vec2(0.75, 0.5)) / vec2(0.078, 0.145);
  float disc = (uKind > 0.5 && uKind < 3.5) ? 1.0 - step(1.0, min(dot(d1, d1), dot(d2, d2))) : 0.0;
  float band = step(0.27, vUv.y) * step(vUv.y, 0.73);
  float body = uKind < 0.5 ? 0.0 : (uKind > 1.5 && uKind < 2.5 ? band : 1.0);
  if (uKind > 3.5) body = 0.0;
  body *= 1.0 - disc;
  float cueK = uKind < 0.5 ? 1.0 : 0.0;
  float dz = bayer4(gl_FragCoord.xy);
  #define Q(x) (modern ? (x) : floor((x) * 4.0 + dz * 0.95) / 4.0)
  vec3 P = vObjN;
  float T = uTime;
  vec3 hue = uHue;
  float glow = 0.0;                                  // extra emission from the effect
  if (uFx > 0.5 && uFx < 1.5) {                      // GALAXY: drifting nebula + stars
    float n = vnoise(P * 3.2 + vec3(T * 0.05, T * 0.03, uSeed));
    float n2 = vnoise(P * 7.0 - vec3(0.0, T * 0.04, uSeed * 2.0));
    float neb = Q(clamp(n * 0.75 + n2 * 0.45 - 0.2, 0.0, 1.0));
    vec3 space = uKind > 2.5 ? vec3(0.02, 0.015, 0.05) : hue * 0.28;
    vec3 gal = mix(space, hue * 1.25 + vec3(0.12), neb);
    vec2 q = floor(vUv * vec2(96.0, 48.0));
    float st = step(0.975, hash(q + uSeed)) * (0.55 + 0.45 * sin(T * 3.0 + hash(q) * 40.0));
    base = mix(base, gal + vec3(st), body);
    base += vec3(0.5, 0.6, 1.0) * st * 0.35 * cueK;
    glow = body * neb * 0.25;
  } else if (uFx > 1.5 && uFx < 2.5) {               // NEON: a slow breathing glow
    float pulse = 0.5 + 0.5 * sin(T * 1.8 + uSeed * 1.7);
    glow = body * (0.22 + 0.18 * Q(pulse));
  } else if (uFx > 2.5 && uFx < 3.5) {               // PLASMA: energy flowing inside
    float w = sin(P.y * 7.0 + vnoise(P * 3.5 + vec3(0.0, T * 0.5, uSeed)) * 7.0 + T * 1.6);
    float f = Q(smoothstep(0.35, 1.0, w));
    base = mix(base, mix(hue * 0.7, mix(hue, vec3(1.0), 0.65), f), body);
    base = mix(base, vec3(1.0, 0.98, 0.95), cueK * f * 0.12);
    glow = body * (0.18 + f * 0.45);
  } else if (uFx > 3.5 && uFx < 4.5) {               // LAVA: crust and slow cracks
    float n = vnoise(P * 5.0 + vec3(0.0, T * 0.06, uSeed));
    float crack = 1.0 - smoothstep(0.015, 0.07, abs(n - 0.5));
    crack = Q(crack);
    vec3 hot = uKind > 2.5 ? vec3(1.0, 0.25, 0.08) : mix(hue, vec3(1.0, 0.55, 0.15), 0.35);
    vec3 crust = uKind > 2.5 ? vec3(0.03, 0.02, 0.02) : hue * 0.55;
    float heat = 0.75 + 0.25 * sin(T * 1.3 + uSeed);
    base = mix(base, mix(crust, hot * 1.4, crack * heat), body);
    base = mix(base, vec3(1.0, 0.6, 0.3), cueK * crack * 0.35);
    glow = body * crack * heat * 0.8 + cueK * crack * 0.2;
  } else if (uFx > 4.5 && uFx < 5.5) {               // DIGITAL: a pixel grid that scrolls
    vec2 g = vUv * vec2(56.0, 28.0) + vec2(0.0, T * 1.2);
    vec2 fg = fract(g);
    float line = step(fg.x, 0.12) + step(fg.y, 0.12);
    float flick = step(0.965, hash(floor(g) + floor(T * 6.0)));
    vec3 lit = uKind > 2.5 ? vec3(0.1, 0.9, 0.35) : hue * 1.35 + vec3(0.1);
    base = mix(base, base * (1.0 - min(1.0, line) * 0.55) + lit * flick * 0.8, body);
    base = mix(base, base * (1.0 - min(1.0, line) * 0.12), cueK);
    glow = body * flick * 0.6;
  } else if (uFx > 5.5 && uFx < 6.5) {               // HOLOGRAM: scanlines and a sliding sheen
    float scan = step(0.5, fract(vWorld.y * 520.0 - T * 2.5));
    float sweep = smoothstep(0.08, 0.0, abs(fract(P.y * 0.5 + 0.5 - T * 0.25) - 0.5));
    base = mix(base, base * (0.82 + 0.18 * scan) + vec3(0.25, 0.9, 1.0) * sweep * 0.45, max(body, cueK * 0.5));
    glow = body * (0.12 + sweep * 0.35);
  } else if (uFx > 6.5 && uFx < 7.5) {               // RADAR: a sweep that never stops
    float a = atan(P.z, P.x) / 6.2831853 + 0.5;
    float sw = fract(a - T * 0.3 + uSeed * 0.13);
    float trail = Q(exp(-sw * 7.0));
    vec3 phos = vec3(0.56, 0.82, 0.31);
    base = mix(base, mix(hue * 0.45, hue * 1.3 + phos * 0.3, trail), body);
    base = mix(base, base * 0.85 + phos * trail * 0.4, cueK);
    glow = body * trail * 0.5 + cueK * trail * 0.15;
  } else if (uFx > 7.5 && uFx < 8.5) {               // LIQUID: the surface never quite settles
    n = normalize(n + (vec3(vnoise(P * 3.0 + T * 0.35), vnoise(P * 3.0 + 7.0 + T * 0.3), vnoise(P * 3.0 + 13.0 - T * 0.33)) - 0.5) * 0.55);
  } else if (uFx > 8.5 && uFx < 9.5) {               // VOID: a slow swirl falling inward
    float a = atan(P.z, P.x), r = P.y;
    float sw = sin(a * 3.0 + r * 6.0 - T * 0.8 + uSeed);
    float s = Q(smoothstep(0.2, 1.0, sw));
    vec3 deep = uKind > 2.5 ? vec3(0.0) : hue * 0.45;
    base = mix(base, mix(deep, hue * 1.25, s), body);
    glow = body * s * 0.3;
  } else if (uFx > 9.5 && uFx < 10.5) {              // CYBER: circuit lines lighting up
    vec2 g = vUv * vec2(40.0, 20.0);
    vec2 id = floor(g), f = fract(g);
    float hor = step(0.5, hash(id + 3.1)) * step(abs(f.y - 0.5), 0.08);
    float ver = step(0.6, hash(id + 9.7)) * step(abs(f.x - 0.5), 0.08);
    float trace = min(1.0, hor + ver);
    float pulse = step(0.75, fract(hash(id) + T * 0.45));
    vec3 steel = mix(vec3(0.42, 0.44, 0.48), hue, 0.8);
    if (uKind > 2.5) steel = vec3(0.08, 0.09, 0.1);
    base = mix(base, mix(steel, hue * 1.5 + vec3(0.15), trace * (0.45 + 0.55 * pulse)), body);
    glow = body * trace * pulse * 0.7;
  } else if (uFx > 10.5 && uFx < 11.5) {             // AFTERHOURS: a lamp passing somewhere
    float pass = Q(smoothstep(0.6, 1.0, sin(P.x * 2.0 + P.z * 1.2 - T * 0.5 + uSeed)));
    base = mix(base, base * (0.85 + 0.4 * pass), body);
    glow = body * pass * 0.12;
  }
  #undef Q
  vec3 light = uAmbient * 1.6;
  vec3 spec = vec3(0.0);
  vec3 sheen = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec3 L = uLightPos[i] - vWorld;
    float d = length(L);
    float att = clamp(1.0 - d / uLightRange[i], 0.0, 1.0);
    att *= att;
    L /= max(d, 1e-4);
    float ndl = max(dot(n, L), 0.0);
    vec3 h = normalize(L + v);
    float nh = max(dot(n, h), 0.0);
    if (modern) {
      light += uLightColor[i] * (ndl * 0.9 + 0.1) * att;
      spec += uLightColor[i] * pow(nh, 220.0) * att * 3.0;      // clearcoat glint
      sheen += uLightColor[i] * pow(nh, 24.0) * att * 0.25;     // broad sheen
    } else {
      light += uLightColor[i] * ndl * att;
      float s = pow(nh, 60.0);
      spec += uLightColor[i] * step(0.5, s) * att * 1.4;
    }
  }
  if (!modern) {
    // posterize the diffuse into chunky bands, dither between them
    float lum = dot(light, vec3(0.333));
    float bl = floor(lum * uBands + bayer4(gl_FragCoord.xy) * 0.9) / uBands;
    light *= bl / max(lum, 1e-3);
  }
  vec3 col = base * (light + 0.08);
  vec3 r = reflect(-v, n);
  vec3 env = (modern && uHasCube > 0.5) ? textureCube(uEnvCube, r).rgb * 1.2 : texture2D(uEnvMap, envUv(r)).rgb;
  float fres = pow(1.0 - max(dot(n, v), 0.0), modern ? 4.0 : 2.5);
  float refl = modern ? clamp(uReflect * 0.6 + 0.08 + fres * 0.85, 0.0, 1.0) : clamp(uReflect * (0.35 + fres), 0.0, 1.0);
  col = mix(col, env * (0.6 + base * 0.8), refl);
  col += spec * uSpec + sheen * uSpec;
  col += uRim * fres * uRimAmt;
  col += uEmissive * uEmissiveAmt * base + base * glow;
  col += vec3(uFlash);
  col = mix(col, uFogColor, vFog);
  float a = uOpacity;
  if (a < 0.99) {
    a = clamp(a + fres * 0.7, 0.0, 1.0);
    if (!modern) { if (a < bayer4(gl_FragCoord.xy)) discard; a = 1.0; }
  }
  gl_FragColor = vec4(col, a);
}
`;

export function ballMaterial(map, skin = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSnap: shared.uSnap,
      uJitter: shared.uJitter,
      uModern: shared.uModern,
      uTime: shared.uTime,
      uLightPos: shared.uLightPos,
      uLightColor: shared.uLightColor,
      uLightRange: shared.uLightRange,
      uAmbient: shared.uAmbient,
      uSky: shared.uSky,
      uGround: shared.uGround,
      uFogColor: shared.uFogColor,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uEnvMap: shared.uEnvMap,
      uEnvCube: shared.uEnvCube,
      uHasCube: shared.uHasCube,
      map: { value: map },
      uReflect: { value: skin.reflect ?? 0.22 },
      uSpec: { value: skin.spec ?? 1.0 },
      uRim: { value: new THREE.Color(skin.rim ?? 0x6040ff) },
      uRimAmt: { value: skin.rimAmt ?? 0.35 },
      uEmissive: { value: new THREE.Color(skin.emissive ?? 0xffffff) },
      uEmissiveAmt: { value: skin.emissiveAmt ?? 0 },
      uBands: { value: skin.bands ?? 4 },
      uOpacity: { value: skin.opacity ?? 1 },
      uFx: { value: skin.fx ?? 0 },
      uKind: { value: 1 },
      uHue: { value: new THREE.Color(1, 1, 1) },
      uSeed: { value: 0 },
      uTint: { value: new THREE.Color(skin.tint ?? 0xffffff) },
      uFlash: { value: 0 },
    },
    vertexShader: ballVert,
    fragmentShader: ballFrag,
  });
  // glass / ghost balls blend for real in modern mode
  mat.userData.screenDoor = true;
  if (shared.uModern.value > 0.5) { mat.transparent = true; }
  mat.userData.ball = true;
  registry.add(mat);
  mat.addEventListener('dispose', () => registry.delete(mat));
  return mat;
}

// Points for particles. PS1: crunchy squares snapped to the pixel grid.
// MODERN: round soft sprites scaled to the render resolution.
export function particleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uSnap: shared.uSnap, uJitter: shared.uJitter, uModern: shared.uModern, uPointScale: shared.uPointScale },
    vertexShader: /* glsl */`
      attribute float size;
      attribute vec4 pcolor;
      uniform vec2 uSnap;
      uniform float uModern;
      uniform float uPointScale;
      varying vec4 vC;
      void main() {
        vec4 vp = modelViewMatrix * vec4(position, 1.0);
        vec4 clip = projectionMatrix * vp;
        if (uModern < 0.5) {
          vec2 grid = uSnap * 0.5;
          clip.xy = floor(clip.xy / clip.w * grid + 0.5) / grid * clip.w;
          gl_PointSize = max(1.0, floor(size * (1.0 + 2.0 / max(-vp.z, 0.4))));
        } else {
          gl_PointSize = max(1.5, size * (1.0 + 2.0 / max(-vp.z, 0.4)) * uPointScale * 1.2);
        }
        gl_Position = clip;
        vC = pcolor;
      }`,
    fragmentShader: /* glsl */`
      uniform float uModern;
      varying vec4 vC;
      void main() {
        if (vC.a <= 0.01) discard;
        float k = 1.0;
        if (uModern > 0.5) {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float d = dot(p, p);
          if (d > 1.0) discard;
          k = (1.0 - d) * (1.0 - d) * 1.6;
        }
        gl_FragColor = vec4(vC.rgb * vC.a * k, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
