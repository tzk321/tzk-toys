// js/accessories.js — the finishing touches, each a tiny primitive build
// that clips onto the head group: a side ribbon, round glasses, a kitsune
// half-mask worn on the temple, and a gold tiara.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial, outlineFor } from './toon.js';
import { HEAD_R } from './head.js';

const TAU = Math.PI * 2;

function bowGeo(w) {
  const loop = new THREE.TorusGeometry(w * 0.55, w * 0.20, 8, 12);
  const l1 = loop.clone(); l1.scale(1, 0.6, 0.5); l1.rotateZ(0.5); l1.translate(-w * 0.6, 0, 0);
  const l2 = loop.clone(); l2.scale(1, 0.6, 0.5); l2.rotateZ(-0.5); l2.translate(w * 0.6, 0, 0);
  const knot = new THREE.SphereGeometry(w * 0.26, 8, 8);
  return mergeGeometries([l1, l2, knot]);
}

export function buildAccessories(flags, colors) {
  const group = new THREE.Group();
  group.name = 'accessories';

  if (flags.ribbon) {
    const mat = toonMaterial({ color: colors.ribbon || '#d8465f', rim: 0.45 });
    const geo = bowGeo(HEAD_R * 0.55);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(HEAD_R * 0.62, HEAD_R * 0.82, HEAD_R * 0.28);
    m.rotation.set(0.2, 0.5, -0.25);
    group.add(m, (() => { const o = outlineFor(m, 0.0022); o.position.copy(m.position); o.rotation.copy(m.rotation); return o; })());
  }

  if (flags.glasses) {
    const mat = toonMaterial({ color: '#4a3a45', rim: 0.6 });
    const ring = new THREE.TorusGeometry(HEAD_R * 0.30, HEAD_R * 0.035, 8, 20);
    const r1 = ring.clone(); r1.translate(-HEAD_R * 0.42, 0, 0);
    const r2 = ring.clone(); r2.translate(HEAD_R * 0.42, 0, 0);
    const bridge = new THREE.CylinderGeometry(HEAD_R * 0.03, HEAD_R * 0.03, HEAD_R * 0.26, 6);
    bridge.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(mergeGeometries([r1, r2, bridge]), mat);
    m.position.set(0, -HEAD_R * 0.05, HEAD_R * 1.02);
    group.add(m);
  }

  if (flags.mask) {
    // kitsune half-mask on the temple: white shield + painted marks
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#f6f1ea';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#c8323e';
    g.lineWidth = 7;
    g.beginPath(); g.moveTo(30, 78); g.quadraticCurveTo(46, 92, 62, 80); g.stroke();
    g.beginPath(); g.moveTo(66, 78); g.quadraticCurveTo(82, 92, 98, 80); g.stroke();
    g.fillStyle = '#2e2431';
    g.beginPath(); g.ellipse(44, 56, 7, 11, 0.1, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(84, 56, 7, 11, -0.1, 0, TAU); g.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const shell = new THREE.SphereGeometry(HEAD_R * 0.62, 20, 16, 0, Math.PI, 0.5, 1.8);
    shell.scale(0.85, 1, 0.55);
    const m = new THREE.Mesh(shell, toonMaterial({ map: tex, faceMode: 1, rim: 0.3 }));
    // ears
    const earMat = toonMaterial({ color: '#f6f1ea', rim: 0.3 });
    const e1 = new THREE.Mesh(new THREE.ConeGeometry(HEAD_R * 0.16, HEAD_R * 0.34, 4), earMat);
    e1.position.set(-HEAD_R * 0.26, HEAD_R * 0.58, 0);
    const e2 = e1.clone();
    e2.position.x = HEAD_R * 0.26;
    m.add(e1, e2);
    m.position.set(HEAD_R * 0.78, HEAD_R * 0.55, HEAD_R * 0.35);
    m.rotation.set(0.15, 0.9, 0.15);
    group.add(m);
  }

  if (flags.tiara) {
    const mat = toonMaterial({ color: '#e0c078', rim: 0.7, emissive: '#241a08' });
    const band = new THREE.TorusGeometry(HEAD_R * 0.86, HEAD_R * 0.045, 8, 26, Math.PI * 1.1);
    band.rotateX(-0.42);
    band.rotateZ(Math.PI * -0.05);
    const gem = new THREE.OctahedronGeometry(HEAD_R * 0.14);
    gem.scale(0.7, 1, 0.7);
    gem.translate(0, HEAD_R * 0.52, HEAD_R * 0.78);
    const m = new THREE.Mesh(mergeGeometries([band, gem]), mat);
    m.position.y = HEAD_R * 0.35;
    group.add(m);
  }

  return group;
}
