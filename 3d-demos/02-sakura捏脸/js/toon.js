// js/toon.js — the Genshin-style NPR core. One toon shader for everything:
// two-band ramp with a soft transition, hue-shifted cool shadows (never just
// "darker"), fresnel rim light keyed to the sky, an optional anime-hair
// specular band, and a damped "face mode" (anime faces are lit almost flat —
// real lambert shading on a face texture reads as dirt).
//
// Outlines are inverted hulls: a BackSide clone pushed out along the normal,
// tinted a warm dark brown (Genshin never uses pure black lines).

import * as THREE from 'three';

// one key light shared by every material (the stage owns the direction)
export const LIGHT = {
  dir: new THREE.Vector3(-0.45, 0.8, 0.65).normalize(),
};

function shadowOf(hex) {
  // hue-shift toward violet-blue, drop lightness, keep saturation alive
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  const h = (hsl.h + 0.045) % 1; // toward cool
  return new THREE.Color().setHSL(h, Math.min(1, hsl.s * 1.12 + 0.06), Math.max(0, hsl.l * 0.62));
}

export function toonMaterial(opts = {}) {
  const {
    color = '#ffffff',
    map = null,
    faceMode = 0,        // 1 = damped flat shading for the face
    hairBand = 0,        // 1 = anime specular band
    rim = 0.55,
    emissive = '#000000',
    doubleSide = false,
  } = opts;
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uShadow: { value: shadowOf(color) },
    uMap: { value: map },
    uHasMap: { value: map ? 1 : 0 },
    uLightDir: { value: LIGHT.dir },
    uFace: { value: faceMode },
    uHairBand: { value: hairBand },
    uRim: { value: rim },
    uEmissive: { value: new THREE.Color(emissive) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    vertexShader: /* glsl */`
      varying vec3 vN;
      varying vec3 vW;
      varying vec2 vUv;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vN;
      varying vec3 vW;
      varying vec2 vUv;
      uniform vec3 uColor, uShadow, uLightDir, uEmissive;
      uniform sampler2D uMap;
      uniform float uHasMap, uFace, uHairBand, uRim;
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(cameraPosition - vW);
        vec3 base = uColor;
        vec3 shadowC = uShadow;
        if (uHasMap > 0.5) {
          vec4 t = texture2D(uMap, vUv);
          base = t.rgb;
          // derive the shadow tint from the texel so painted features keep hue
          shadowC = base * vec3(0.72, 0.66, 0.78);
        }
        float ndl = dot(n, uLightDir);
        // two-band ramp with a soft toe — the Genshin transition
        float band = smoothstep(-0.08, 0.22, ndl);
        if (uFace > 0.5) band = mix(0.75, 1.0, smoothstep(-0.4, 0.35, ndl)); // faces stay bright
        vec3 c = mix(shadowC, base, band);
        // painted-in ambient occlusion floor: nothing ever goes fully black
        c = max(c, base * 0.30);
        // fresnel rim on the lit side
        float rim = pow(1.0 - max(dot(n, v), 0.0), 3.2) * uRim * (0.35 + 0.65 * band);
        c += rim * vec3(0.33, 0.29, 0.47); // ~linear of the old sRGB tint
        // anime hair band: a view-dependent angel-ring
        if (uHairBand > 0.5) {
          vec3 h = normalize(uLightDir + v);
          float spec = pow(max(dot(n, h), 0.0), 42.0);
          float ring = smoothstep(0.25, 0.6, spec) * 0.5;
          c += ring * vec3(1.0, 0.96, 0.88);
        }
        c += uEmissive;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  mat.userData.uniforms = uniforms;
  return mat;
}

// swap the tint of an existing toon material (color pickers hit this)
export function retint(mat, hex) {
  mat.userData.uniforms.uColor.value.set(hex);
  mat.userData.uniforms.uShadow.value.copy(shadowOf(hex));
}

const OUTLINE_VERT = /* glsl */`
  uniform float uThick;
  void main() {
    vec3 p = position + normal * uThick;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const OUTLINE_FRAG = /* glsl */`
  uniform vec3 uLine;
  void main() { gl_FragColor = vec4(uLine, 1.0); }`;

export function outlineFor(mesh, thickness = 0.0035, color = '#3a2530') {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uThick: { value: thickness },
      uLine: { value: new THREE.Color(color) },
    },
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
  });
  const o = new THREE.Mesh(mesh.geometry, mat);
  o.name = (mesh.name || 'mesh') + '-outline';
  return o;
}

// convenience: mesh + outline in one group
export function withOutline(geo, mat, thickness, name = '') {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  g.add(m, outlineFor(m, thickness));
  return g;
}
