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
uniform float uFx;          // 0 none, 1 galaxy, 2 toxic, 3 energy, 4 glitch
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
vec2 envUv(vec3 r) {
  return vec2(atan(r.z, r.x) / 6.2831853 + 0.5, acos(clamp(r.y, -1.0, 1.0)) / 3.14159265);
}
void main() {
  bool modern = uModern > 0.5;
  vec3 n = normalize(vN);
  vec3 v = normalize(vView);
  vec4 tex = texture2D(map, vUv);
  vec3 base = tex.rgb * uTint;
  if (uFx > 0.5 && uFx < 1.5) {
    vec2 q = floor(vUv * vec2(64.0, 32.0));
    float st = step(0.965, hash(q));
    float tw = 0.5 + 0.5 * sin(uTime * 4.0 + hash(q) * 30.0);
    base += vec3(0.8, 0.9, 1.0) * st * tw;
  } else if (uFx > 1.5 && uFx < 2.5) {
    float w = sin(vObjN.y * 10.0 + uTime * 3.0 + sin(vObjN.x * 7.0 + uTime) * 2.0);
    base = mix(base, vec3(0.6, 1.0, 0.1), (modern ? smoothstep(0.45, 0.75, w) : step(0.6, w)) * 0.5);
  } else if (uFx > 2.5 && uFx < 3.5) {
    float w = 0.5 + 0.5 * sin(uTime * 6.0 + vObjN.y * 8.0 + vObjN.x * 5.0);
    base = mix(base, vec3(1.0), w * 0.35);
  } else if (uFx > 3.5) {
    float line = floor(vUv.y * 24.0 + floor(uTime * 12.0));
    float g = step(0.9, hash(vec2(line, floor(uTime * 8.0))));
    base = mix(base, vec3(base.b, base.r, base.g), g);
  }
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
  col += uEmissive * uEmissiveAmt * base;
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
