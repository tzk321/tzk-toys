// js/hair.js — anime hair as swept, tapered strands. Every style is a recipe
// of CatmullRom curves; each curve becomes a TubeGeometry re-profiled so the
// strand starts full at the root and sharpens to a point (the tube's uv.x IS
// the curve parameter, so the taper is a one-pass vertex edit). A scalp
// "helmet" (two sphere sections that dodge the face wedge) sits under the
// strands so no gap ever shows skin. Twin-tails and ponytails hang from
// pivot groups on damped springs — the hair lags the turntable, which is
// most of what "alive" means.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial, retint, outlineFor } from './toon.js';
import { HEAD_R } from './head.js';

const TAU = Math.PI * 2;
const R = HEAD_R * 1.07; // scalp radius

function strand(pts, r0, sharp = 1.6) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, 14, 1, 7);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const t = uv.getX(i);
    curve.getPointAt(t, c);
    v.fromBufferAttribute(pos, i).sub(c);
    const prof = r0 * Math.pow(Math.max(0.001, 1 - t), 1 / sharp) * (0.55 + 0.45 * Math.sin(Math.min(1, t * 4) * Math.PI * 0.5));
    pos.setXYZ(i, c.x + v.x * prof, c.y + v.y * prof, c.z + v.z * prof);
  }
  geo.computeVertexNormals();
  return geo;
}

// point on the scalp: theta 0 = straight front (+z), phi 0 = crown
const sph = (theta, phi, r = R) => [r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.cos(theta)];

function helmet() {
  const cap = new THREE.SphereGeometry(R, 32, 18, 0, TAU, 0, 1.30);
  const back = new THREE.SphereGeometry(R, 32, 14, Math.PI / 2 + 1.05, TAU - 2.10, 1.25, 1.05);
  return mergeGeometries([cap, back]);
}

function bangs(kind) {
  const out = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const f = (i / (n - 1)) * 2 - 1; // -1..1 across the forehead
    const th = f * 0.62;
    const root = sph(th * 0.55, 0.42, R * 0.99);
    const mid = sph(th * 0.85, 0.78, R * 1.015);
    let tipY = HEAD_R * 0.10;                       // brow line
    if (kind === 'swept') tipY -= Math.abs(f) * HEAD_R * 0.22;   // M-shape
    if (kind === 'hime') tipY = HEAD_R * 0.12;                    // blunt cut
    const tip = [Math.sin(th) * R * 0.98, tipY, Math.cos(th * 0.85) * R * 0.99];
    out.push(strand([root, mid, tip], HEAD_R * (0.16 - Math.abs(f) * 0.04)));
  }
  return out;
}

function sideLocks(len) {
  const out = [];
  for (const m of [-1, 1]) {
    const th = m * 1.25;
    out.push(strand([
      sph(th, 0.55, R * 0.98),
      [m * R * 1.06, -HEAD_R * 0.35, R * 0.42],
      [m * R * 1.02, -HEAD_R * (0.9 + len * 1.6), R * 0.30],
      [m * R * 0.92, -HEAD_R * (1.4 + len * 3.2), R * 0.24],
    ], HEAD_R * 0.15));
  }
  return out;
}

function backCurtain(length, curlIn) {
  const out = [];
  const n = 13;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const th = Math.PI * 0.55 + f * Math.PI * 0.9; // around the back
    const rootA = sph(th, 0.5, R * 0.98);
    const midA = sph(th, 1.15, R * 1.04);
    const sway = Math.sin(f * Math.PI) ;
    const tip = [
      Math.sin(th) * R * (1.02 - curlIn * 0.5),
      -HEAD_R * length,
      Math.cos(th) * R * (1.05 - curlIn * 0.35),
    ];
    out.push(strand([rootA, midA, [midA[0] * 1.05, -HEAD_R * length * 0.55, midA[2] * 1.1], tip], HEAD_R * (0.15 + sway * 0.03)));
  }
  return out;
}

function tail(side, len, lift) {
  // strands RELATIVE to the tie point — the group supplies position + spring
  const geos = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const ox = Math.cos(a) * HEAD_R * 0.24, oz = Math.sin(a) * HEAD_R * 0.20;
    geos.push(strand([
      [0, 0, 0],
      [ox * 1.6 + side * HEAD_R * 0.42 * lift, HEAD_R * 0.16 * lift, oz * 1.5],
      [ox * 1.9 + side * HEAD_R * 0.50 * lift, -HEAD_R * len * 0.5, oz * 1.8],
      [ox * 0.9 + side * HEAD_R * 0.18, -HEAD_R * len, oz * 0.8],
    ], HEAD_R * 0.15, 1.3));
  }
  // scrunchie
  const tie = new THREE.TorusGeometry(HEAD_R * 0.20, HEAD_R * 0.065, 8, 14);
  return { geos, tie };
}

export const HAIR_STYLES = ['bob', 'long', 'twin', 'pony', 'hime'];

export function buildHair({ style = 'twin', color = '#7a4a52', ribbon = '#d8465f' }) {
  const group = new THREE.Group();
  group.name = 'hair';
  const mat = toonMaterial({ color, hairBand: 1, rim: 0.45 });
  const ribbonMat = toonMaterial({ color: ribbon, rim: 0.4 });
  const springs = [];

  const statics = [helmet()];
  if (style === 'hime') statics.push(...bangs('hime'), ...sideLocks(1.1), ...backCurtain(3.6, 0.1));
  else if (style === 'bob') statics.push(...bangs('swept'), ...sideLocks(0.25), ...backCurtain(1.5, 0.55));
  else if (style === 'long') statics.push(...bangs('swept'), ...sideLocks(0.8), ...backCurtain(3.4, 0.3));
  else if (style === 'pony') statics.push(...bangs('swept'), ...sideLocks(0.5), ...backCurtain(0.9, 0.6));
  else if (style === 'twin') statics.push(...bangs('swept'), ...sideLocks(0.6), ...backCurtain(1.1, 0.6));

  const staticMesh = new THREE.Mesh(mergeGeometries(statics), mat);
  staticMesh.name = 'hair-static';
  group.add(staticMesh, outlineFor(staticMesh, 0.0024));

  const addTail = (pivotPos, side, len, lift) => {
    const pivot = new THREE.Group();
    pivot.position.set(...pivotPos);
    const { geos, tie } = tail(side, len, lift);
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    pivot.add(m, outlineFor(m, 0.0024));
    const tieMesh = new THREE.Mesh(tie, ribbonMat);
    tieMesh.rotation.x = Math.PI / 2;
    pivot.add(tieMesh);
    group.add(pivot);
    springs.push({ pivot, ax: 0, az: 0, vx: 0, vz: 0, phase: Math.random() * TAU });
  };
  if (style === 'twin') {
    addTail([-R * 1.12, R * 0.68, -R * 0.12], -1, 2.1, 1.1);
    addTail([R * 1.12, R * 0.68, -R * 0.12], 1, 2.1, 1.1);
  } else if (style === 'pony') {
    addTail([0, R * 0.72, -R * 0.62], 0, 2.6, 0.7);
  }

  return {
    group,
    setColor(hex) { retint(mat, hex); },
    setRibbon(hex) { retint(ribbonMat, hex); },
    update(t, dt, spinVel) {
      for (const s of springs) {
        // driven damped spring: turntable spin + a slow breeze
        const drive = -spinVel * 0.35 + Math.sin(t * 1.1 + s.phase) * 0.012;
        const k = 26, c = 5.5;
        s.vx += (-k * s.ax - c * s.vx + Math.sin(t * 0.9 + s.phase) * 0.35) * dt;
        s.vz += (-k * s.az - c * s.vz + drive * 8) * dt;
        s.ax += s.vx * dt;
        s.az += s.vz * dt;
        s.ax = THREE.MathUtils.clamp(s.ax, -0.5, 0.5);
        s.az = THREE.MathUtils.clamp(s.az, -0.6, 0.6);
        s.pivot.rotation.x = s.ax;
        s.pivot.rotation.z = s.az;
      }
    },
  };
}
