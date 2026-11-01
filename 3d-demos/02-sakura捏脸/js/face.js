// js/face.js — the parametric anime face, painted on a 1024² canvas that the
// head mesh wears via planar projection (the Guilty-Gear / arc-anime trick:
// features live in TEXTURE, geometry only supplies the silhouette). Redrawing
// is ~2 ms, so blinking, pupil camera-tracking and every 捏脸 slider are just
// repaints — no morph targets, no rig.
//
// Layout contract with head.js: the front hemisphere maps x→u, y→v with
// FACE_SPAN of the texture across the head's ±radius. All feature positions
// below are canvas pixels tuned against that projection.

import * as THREE from 'three';

export const FACE_SPAN = 0.44; // half-width of the projection in UV space

export function createFacePainter() {
  const SIZE = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const g = cv.getContext('2d');
  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const lighten = (hex, k) => {
    const c = new THREE.Color(hex);
    const hsl = {};
    c.getHSL(hsl);
    return '#' + new THREE.Color().setHSL(hsl.h, hsl.s, Math.min(1, hsl.l + k)).getHexString();
  };
  const darken = (hex, k) => lighten(hex, -k);

  function eye(p, cx, cy, mirror) {
    const w = 165 * p.eyeSize;
    const h = w * 0.72;
    const st = p.eyeStyle; // 'round' | 'sharp' | 'droopy'
    const tilt = (p.eyeTilt + (st === 'sharp' ? 0.10 : st === 'droopy' ? -0.12 : 0)) * mirror;
    g.save();
    g.translate(cx, cy);
    g.rotate(tilt);
    g.scale(mirror, 1);

    const blink = p.blink || 0;
    if (blink > 0.92) { // fully closed: one soft down-curved lash
      g.strokeStyle = '#33222e';
      g.lineWidth = w * 0.11;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-w * 0.46, h * 0.05);
      g.quadraticCurveTo(0, h * 0.34, w * 0.48, h * 0.02);
      g.stroke();
      g.restore();
      return;
    }

    // --- eye white ---
    const top = -h * 0.52, bot = h * 0.48;
    const shape = () => {
      g.beginPath();
      g.moveTo(-w * 0.5, -h * 0.04);
      g.bezierCurveTo(-w * 0.34, top, w * 0.30, top, w * 0.5, -h * 0.10);
      g.bezierCurveTo(w * 0.42, bot, -w * 0.30, bot, -w * 0.5, -h * 0.04);
      g.closePath();
    };
    shape();
    g.fillStyle = '#fdfbfa';
    g.fill();

    // --- iris (clipped) ---
    g.save();
    shape();
    g.clip();
    const ix = (p.look?.x || 0) * w * 0.14;
    const iy = (p.look?.y || 0) * w * 0.10 + h * 0.02;
    const ir = w * 0.30;
    const grad = g.createLinearGradient(ix, iy - ir, ix, iy + ir);
    grad.addColorStop(0, darken(p.eyeColor, 0.18));
    grad.addColorStop(0.55, p.eyeColor);
    grad.addColorStop(1, lighten(p.eyeColor, 0.22));
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(ix, iy, ir * 0.86, ir, 0, 0, Math.PI * 2);
    g.fill();
    // pupil
    g.fillStyle = darken(p.eyeColor, 0.30);
    g.beginPath();
    g.ellipse(ix, iy + h * 0.02, ir * 0.34, ir * 0.44, 0, 0, Math.PI * 2);
    g.fill();
    // bottom glow crescent
    g.fillStyle = lighten(p.eyeColor, 0.32);
    g.globalAlpha = 0.8;
    g.beginPath();
    g.ellipse(ix, iy + ir * 0.55, ir * 0.5, ir * 0.28, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    // top-lid shadow across the white
    g.fillStyle = 'rgba(90,70,110,0.30)';
    g.beginPath();
    g.moveTo(-w * 0.5, -h * 0.06);
    g.bezierCurveTo(-w * 0.34, top, w * 0.30, top, w * 0.5, -h * 0.12);
    g.bezierCurveTo(w * 0.30, top * 0.45, -w * 0.34, top * 0.45, -w * 0.5, -h * 0.06);
    g.fill();
    // highlights — the anime life
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.ellipse(ix - ir * 0.42, iy - ir * 0.38, ir * 0.26, ir * 0.20, -0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath();
    g.arc(ix + ir * 0.40, iy + ir * 0.30, ir * 0.10, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // --- blink lid (partial) ---
    if (blink > 0.02) {
      g.fillStyle = p.skin;
      const lid = -h * 0.52 + (h * 1.0) * blink;
      g.fillRect(-w * 0.55, -h * 0.6, w * 1.1, lid + h * 0.6);
      g.strokeStyle = 'rgba(51,34,46,0.85)';
      g.lineWidth = w * 0.06;
      g.beginPath();
      g.moveTo(-w * 0.48, lid);
      g.quadraticCurveTo(0, lid + h * 0.10, w * 0.48, lid);
      g.stroke();
    }

    // --- upper lash ---
    g.strokeStyle = '#2c1d28';
    g.lineCap = 'round';
    g.lineWidth = w * 0.13;
    g.beginPath();
    g.moveTo(-w * 0.46, -h * 0.02);
    g.bezierCurveTo(-w * 0.32, top * 1.12, w * 0.30, top * 1.14, w * 0.50, -h * 0.10);
    g.stroke();
    // outer flick
    g.lineWidth = w * 0.11;
    g.beginPath();
    if (st === 'droopy') {
      g.moveTo(w * 0.48, -h * 0.12);
      g.quadraticCurveTo(w * 0.62, -h * 0.02, w * 0.66, h * 0.10);
    } else {
      g.moveTo(w * 0.48, -h * 0.12);
      g.quadraticCurveTo(w * 0.64, -h * 0.22, w * 0.72, -h * (st === 'sharp' ? 0.42 : 0.30));
    }
    g.stroke();
    // double-lid crease
    g.strokeStyle = 'rgba(160,110,120,0.55)';
    g.lineWidth = w * 0.035;
    g.beginPath();
    g.moveTo(-w * 0.30, top * 1.28);
    g.quadraticCurveTo(0, top * 1.52, w * 0.28, top * 1.30);
    g.stroke();
    // lower lash hint
    g.strokeStyle = 'rgba(60,40,55,0.5)';
    g.lineWidth = w * 0.045;
    g.beginPath();
    g.moveTo(w * 0.18, bot * 0.98);
    g.quadraticCurveTo(w * 0.38, bot * 0.92, w * 0.48, bot * 0.66);
    g.stroke();
    g.restore();
  }

  function brow(p, cx, cy, mirror) {
    const w = 165 * p.eyeSize;
    g.save();
    g.translate(cx, cy - w * 0.74);
    g.scale(mirror, 1);
    g.strokeStyle = darken(p.browColor, 0.05);
    g.lineWidth = w * 0.085;
    g.lineCap = 'round';
    g.beginPath();
    if (p.browStyle === 'arch') {
      g.moveTo(-w * 0.40, w * 0.06);
      g.quadraticCurveTo(0, -w * 0.16, w * 0.42, -w * 0.02);
    } else if (p.browStyle === 'worried') {
      g.moveTo(-w * 0.38, -w * 0.08);
      g.quadraticCurveTo(0, -w * 0.02, w * 0.40, w * 0.10);
    } else { // straight
      g.moveTo(-w * 0.40, 0);
      g.lineTo(w * 0.42, -w * 0.04);
    }
    g.stroke();
    g.restore();
  }

  function mouth(p, cx, cy) {
    const w = 150 * p.eyeSize;
    const s = w * 0.5;
    g.save();
    g.translate(cx, cy);
    g.lineCap = 'round';
    if (p.mouthStyle === 'open') {
      g.fillStyle = '#93404e';
      g.beginPath();
      g.moveTo(-s * 0.55, 0);
      g.quadraticCurveTo(0, s * 0.9, s * 0.55, 0);
      g.quadraticCurveTo(0, s * 0.16, -s * 0.55, 0);
      g.fill();
      g.fillStyle = '#c86a72';
      g.beginPath();
      g.ellipse(0, s * 0.42, s * 0.30, s * 0.16, 0, 0, Math.PI * 2);
      g.fill();
    } else if (p.mouthStyle === 'cat') {
      g.strokeStyle = '#a4525c';
      g.lineWidth = s * 0.13;
      g.beginPath();
      g.moveTo(-s * 0.5, -s * 0.06);
      g.quadraticCurveTo(-s * 0.25, s * 0.22, 0, 0);
      g.quadraticCurveTo(s * 0.25, s * 0.22, s * 0.5, -s * 0.06);
      g.stroke();
    } else if (p.mouthStyle === 'neutral') {
      g.strokeStyle = '#a4525c';
      g.lineWidth = s * 0.12;
      g.beginPath();
      g.moveTo(-s * 0.3, s * 0.05);
      g.lineTo(s * 0.3, s * 0.05);
      g.stroke();
    } else { // smile
      g.strokeStyle = '#a4525c';
      g.lineWidth = s * 0.13;
      g.beginPath();
      g.moveTo(-s * 0.42, -s * 0.05);
      g.quadraticCurveTo(0, s * 0.30, s * 0.42, -s * 0.05);
      g.stroke();
      g.strokeStyle = 'rgba(140,60,70,0.35)';
      g.lineWidth = s * 0.06;
      g.beginPath();
      g.moveTo(-s * 0.2, s * 0.28);
      g.quadraticCurveTo(0, s * 0.36, s * 0.2, s * 0.28);
      g.stroke();
    }
    g.restore();
  }

  function draw(p) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    // base skin + a whisper of warmth low on the cheeks
    g.fillStyle = p.skin;
    g.fillRect(0, 0, SIZE, SIZE);
    const warm = g.createRadialGradient(512, 640, 60, 512, 640, 420);
    warm.addColorStop(0, 'rgba(255,190,170,0.10)');
    warm.addColorStop(1, 'rgba(255,190,170,0)');
    g.fillStyle = warm;
    g.fillRect(0, 0, SIZE, SIZE);

    const eyeY = 552;
    const sp = 152 * p.eyeSpacing;

    // bangs shadow (only when the hairstyle has bangs)
    if (p.bangsShadow) {
      g.fillStyle = 'rgba(90,60,95,0.13)';
      g.beginPath();
      g.moveTo(240, 356);
      g.quadraticCurveTo(512, 440, 784, 356);
      g.quadraticCurveTo(512, 320, 240, 356);
      g.fill();
    }

    // blush under the eyes
    if (p.blush > 0.02) {
      for (const m of [-1, 1]) {
        const bx = 512 + m * sp * 1.12, by = eyeY + 96;
        const rg = g.createRadialGradient(bx, by, 4, bx, by, 74);
        rg.addColorStop(0, `rgba(255,120,130,${0.34 * p.blush})`);
        rg.addColorStop(1, 'rgba(255,120,130,0)');
        g.fillStyle = rg;
        g.fillRect(bx - 80, by - 80, 160, 160);
        if (p.blush > 0.55) { // anime hatch lines
          g.strokeStyle = `rgba(220,90,105,${0.30 * p.blush})`;
          g.lineWidth = 5;
          for (let k = -1; k <= 1; k++) {
            g.beginPath();
            g.moveTo(bx + k * 22 - 12, by - 26);
            g.lineTo(bx + k * 22 + 12, by + 26);
            g.stroke();
          }
        }
      }
    }

    eye(p, 512 - sp, eyeY, 1);
    eye(p, 512 + sp, eyeY, -1);
    brow(p, 512 - sp, eyeY, 1);
    brow(p, 512 + sp, eyeY, -1);

    // the tiny anime nose
    g.strokeStyle = 'rgba(200,120,110,0.75)';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(514, eyeY + 74);
    g.lineTo(506, eyeY + 86);
    g.stroke();

    mouth(p, 512, eyeY + 148);
    texture.needsUpdate = true;
  }

  return { texture, draw, canvas: cv };
}
