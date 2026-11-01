// js/body.js — the body IS the outfit: each costume builds its own torso,
// sleeves, skirt and shoes around one shared set of proportions (anime
// ~6.5 heads). Limbs are tapered capsules; skirts are lathes with pleats cut
// as an angular triangle-wave; trims, bows and buttons are where the
// "costume design" lives. Everything merges into a handful of meshes.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial, retint, outlineFor } from './toon.js';

const TAU = Math.PI * 2;

// shared proportions (head centre sits at NECK_TOP + head radius)
export const P = {
  neckTop: 1.335,
  shoulderY: 1.255,
  shoulderW: 0.148,
  chestY: 1.17,
  waistY: 1.02,
  hipY: 0.945,
  kneeY: 0.52,
  ankleY: 0.075,
  armR: 0.030,
  legR: 0.052,
};

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
function limb(p1, p2, r1, r2) {
  _v1.set(...p1); _v2.set(...p2);
  const dir = _v2.clone().sub(_v1);
  const len = dir.length();
  const cyl = new THREE.CylinderGeometry(r2, r1, len, 10);
  const s1 = new THREE.SphereGeometry(r1, 10, 8);
  const s2 = new THREE.SphereGeometry(r2, 10, 8);
  s1.translate(0, -len / 2, 0);
  s2.translate(0, len / 2, 0);
  const g = mergeGeometries([cyl, s1, s2]);
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyQuaternion(_q);
  g.translate((_v1.x + _v2.x) / 2, (_v1.y + _v2.y) / 2, (_v1.z + _v2.z) / 2);
  return g;
}

function lathe(profile, seg = 24) {
  // profiles here are authored top→bottom; LatheGeometry wants ascending y
  // for outward normals, so reverse (v1 shipped inverted normals: every
  // costume's front rendered in its own shadow)
  return new THREE.LatheGeometry(profile.slice().reverse().map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

// pleated skirt: lathe with a triangle-wave radius ripple that grows downward
function pleatedSkirt(topR, botR, topY, botY, pleats = 14, depth = 0.16) {
  const g = lathe([
    [topR, topY],
    [THREE.MathUtils.lerp(topR, botR, 0.35), THREE.MathUtils.lerp(topY, botY, 0.35)],
    [THREE.MathUtils.lerp(topR, botR, 0.75), THREE.MathUtils.lerp(topY, botY, 0.75)],
    [botR, botY],
    [botR * 0.96, botY - 0.004],
  ], 56);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const rr = Math.hypot(x, z);
    if (rr < 1e-4) continue;
    const drop = THREE.MathUtils.smoothstep(topY - y, 0, topY - botY);
    const wave = Math.abs(((a / TAU * pleats) % 1) - 0.5) * 2 - 0.5; // triangle
    const k = 1 + wave * depth * drop;
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}

function bow(w = 0.05, cA = 1) {
  // two loops + knot + tails, centred at origin, facing +z
  const loop = new THREE.TorusGeometry(w * 0.55, w * 0.22, 8, 12);
  const l1 = loop.clone(); l1.scale(1, 0.62, 0.55);
  l1.rotateZ(0.5); l1.translate(-w * 0.62, 0, 0);
  const l2 = loop.clone(); l2.scale(1, 0.62, 0.55);
  l2.rotateZ(-0.5); l2.translate(w * 0.62, 0, 0);
  const knot = new THREE.SphereGeometry(w * 0.28, 8, 8);
  const t1 = new THREE.ConeGeometry(w * 0.16, w * 1.3, 6);
  t1.rotateX(Math.PI); t1.rotateZ(0.35); t1.translate(-w * 0.3, -w * 0.7, 0);
  const t2 = new THREE.ConeGeometry(w * 0.16, w * 1.3, 6);
  t2.rotateX(Math.PI); t2.rotateZ(-0.35); t2.translate(w * 0.3, -w * 0.7, 0);
  return mergeGeometries([l1, l2, knot, t1, t2]);
}

export const OUTFITS = ['miko', 'sailor', 'dress', 'kimono'];

export function buildBody({ outfit = 'miko', colorA = '#c8323e', colorB = '#f4f1ea', skin = '#ffe6d5' }) {
  const g = new THREE.Group();
  g.name = 'body';
  const mats = {
    A: toonMaterial({ color: colorA, rim: 0.4 }),
    B: toonMaterial({ color: colorB, rim: 0.4 }),
    skin: toonMaterial({ color: skin, rim: 0.25 }),
    dark: toonMaterial({ color: '#2e2431', rim: 0.3 }),
    gold: toonMaterial({ color: '#d9b25e', rim: 0.5 }),
  };

  const buckets = { A: [], B: [], skin: [], dark: [], gold: [] };
  const put = (k, geo) => buckets[k].push(geo);

  // ---- neck (always skin) ----
  put('skin', limb([0, P.neckTop - 0.09, 0], [0, P.neckTop + 0.02, 0], 0.030, 0.032));

  // ---- arms: slight A-pose; sleeves depend on outfit ----
  const shoulder = (m) => [m * P.shoulderW, P.shoulderY, 0];
  const elbow = (m) => [m * (P.shoulderW + 0.078), P.shoulderY - 0.235, 0.012];
  const wrist = (m) => [m * (P.shoulderW + 0.135), P.shoulderY - 0.425, 0.030];
  for (const m of [-1, 1]) {
    if (outfit === 'miko' || outfit === 'kimono') {
      // huge hanging sleeves: upper arm hidden, forearm skin peeks
      put('B', limb(shoulder(m), elbow(m), 0.042, 0.060));
      put(outfit === 'miko' ? 'B' : 'A', limb(elbow(m), [m * (P.shoulderW + 0.068), P.shoulderY - 0.355, 0.018], 0.060, 0.072));
      put('skin', limb([m * (P.shoulderW + 0.064), P.shoulderY - 0.35, 0.018], wrist(m), 0.023, 0.021));
    } else if (outfit === 'dress') {
      put('skin', limb(shoulder(m), elbow(m), 0.034, 0.028));
      put('B', limb(elbow(m), wrist(m), 0.027, 0.024)); // long gloves
    } else { // sailor: short puff sleeve + bare arm
      put('B', limb(shoulder(m), [m * (P.shoulderW + 0.03), P.shoulderY - 0.11, 0.006], 0.048, 0.042));
      put('skin', limb([m * (P.shoulderW + 0.028), P.shoulderY - 0.10, 0.005], wrist(m), 0.026, 0.022));
    }
    // hand
    const h = new THREE.SphereGeometry(0.026, 10, 8);
    h.scale(0.8, 0.68, 1.1);
    h.translate(...wrist(m));
    h.translate(0, -0.028, 0.012);
    put(outfit === 'dress' ? 'B' : 'skin', h);
  }

  // ---- torso ----
  const torsoProfile = [
    [0.033, P.neckTop - 0.02],
    [0.118, P.shoulderY],
    [0.128, P.chestY],
    [0.098, P.waistY],
    [0.125, P.hipY],
    [0.120, P.hipY - 0.04],
  ];
  const torso = lathe(torsoProfile, 26);
  torso.scale(1, 1, 0.74);
  put(outfit === 'sailor' || outfit === 'miko' ? 'B' : 'A', torso);

  // ---- outfit-specific layers ----
  if (outfit === 'miko') {
    put('A', pleatedSkirt(0.115, 0.24, P.waistY + 0.02, P.ankleY + 0.05, 12, 0.10)); // hakama
    // collar V (red-trimmed white)
    for (const m of [-1, 1]) {
      const c = new THREE.BoxGeometry(0.024, 0.125, 0.010);
      c.rotateX(0.30); c.rotateZ(m * 0.60);
      c.translate(m * 0.040, P.neckTop - 0.098, 0.080);
      put('A', c);
    }
    const obi = bow(0.06);
    obi.rotateY(Math.PI);
    obi.translate(0, P.waistY + 0.015, -0.115);
    put('A', obi);
  } else if (outfit === 'sailor') {
    put('A', pleatedSkirt(0.115, 0.20, P.waistY + 0.01, P.kneeY + 0.14, 18, 0.22));
    // sailor collar: flat back flap + shoulder wings
    const flap = new THREE.BoxGeometry(0.20, 0.012, 0.14);
    flap.translate(0, P.shoulderY + 0.015, -0.065);
    put('A', flap);
    for (const m of [-1, 1]) {
      const wing = new THREE.BoxGeometry(0.065, 0.010, 0.105);
      wing.rotateY(m * 0.32);
      wing.translate(m * 0.088, P.shoulderY + 0.010, 0.012);
      put('A', wing);
    }
    const tie = bow(0.045);
    tie.translate(0, P.shoulderY - 0.075, 0.115);
    put('A', tie);
    // chest stripe
    const stripe = new THREE.TorusGeometry(0.117, 0.006, 6, 28);
    stripe.rotateX(Math.PI / 2);
    stripe.scale(1, 1, 0.76);
    stripe.translate(0, P.chestY - 0.03, 0);
    put('dark', stripe);
  } else if (outfit === 'dress') {
    // flowing gown with a waved hem + white under-layer
    const gown = lathe([
      [0.10, P.waistY + 0.03],
      [0.16, P.hipY - 0.06],
      [0.24, P.kneeY],
      [0.30, P.ankleY + 0.07],
    ], 48);
    const pos = gown.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const drop = THREE.MathUtils.smoothstep(P.waistY - y, 0.25, P.waistY - P.ankleY);
      const k = 1 + Math.sin(a * 6) * 0.06 * drop;
      pos.setX(i, x * k); pos.setZ(i, z * k);
    }
    gown.computeVertexNormals();
    put('A', gown);
    const under = lathe([[0.285, P.ankleY + 0.035], [0.295, P.ankleY + 0.005]], 48);
    put('B', under);
    // neckline trim + brooch
    const trim = new THREE.TorusGeometry(0.075, 0.008, 6, 20, Math.PI);
    trim.rotateZ(Math.PI); trim.rotateX(0.5);
    trim.translate(0, P.neckTop - 0.09, 0.075);
    put('gold', trim);
    const brooch = new THREE.SphereGeometry(0.014, 8, 8);
    brooch.translate(0, P.neckTop - 0.115, 0.105);
    put('gold', brooch);
  } else if (outfit === 'kimono') {
    const robe = lathe([
      [0.118, P.waistY + 0.05],
      [0.135, P.hipY - 0.05],
      [0.155, P.kneeY],
      [0.150, P.ankleY + 0.045],
    ], 30);
    put('A', robe);
    // wide obi
    const obiBand = new THREE.CylinderGeometry(0.118, 0.124, 0.10, 24);
    obiBand.scale(1, 1, 0.78);
    obiBand.translate(0, P.waistY + 0.015, 0);
    put('B', obiBand);
    const back = bow(0.075);
    back.rotateY(Math.PI);
    back.translate(0, P.waistY + 0.04, -0.12);
    put('B', back);
    // collar overlap
    for (const m of [-1, 1]) {
      const c = new THREE.BoxGeometry(0.03, 0.17, 0.014);
      c.rotateX(0.40); c.rotateZ(m * 0.58);
      c.translate(m * 0.045, P.neckTop - 0.08, 0.096);
      put('B', c);
    }
  }

  // ---- legs + shoes ----
  const skirtFloor = { miko: P.ankleY + 0.06, sailor: P.kneeY + 0.15, dress: P.ankleY + 0.08, kimono: P.ankleY + 0.05 }[outfit];
  for (const m of [-1, 1]) {
    const hip = [m * 0.062, P.hipY - 0.02, 0];
    const knee = [m * 0.058, P.kneeY, 0.008];
    const ankle = [m * 0.056, P.ankleY, -0.004];
    if (outfit === 'sailor') {
      put('skin', limb(hip, knee, 0.052, 0.042));
      put('dark', limb([m * 0.058, P.kneeY + 0.10, 0.006], ankle, 0.045, 0.030)); // over-knee socks
    } else if (outfit === 'miko') {
      put('skin', limb(hip, knee, 0.052, 0.042));
      put('B', limb(knee, ankle, 0.040, 0.028)); // tabi-white
    } else {
      put('skin', limb(hip, knee, 0.052, 0.042));
      put('skin', limb(knee, ankle, 0.040, 0.028));
    }
    const shoe = new THREE.SphereGeometry(0.042, 10, 8);
    shoe.scale(0.78, 0.55, 1.5);
    shoe.translate(m * 0.056, 0.035, 0.02);
    put('dark', shoe);
  }

  // ---- merge buckets ----
  for (const [k, arr] of Object.entries(buckets)) {
    if (!arr.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(arr), mats[k]);
    mesh.name = 'body-' + k;
    g.add(mesh, outlineFor(mesh, 0.0028));
  }
  return {
    group: g,
    setColorA(hex) { retint(mats.A, hex); },
    setColorB(hex) { retint(mats.B, hex); },
    skirtFloor,
  };
}
