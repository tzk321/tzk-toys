// js/head.js — the anime skull. A displaced sphere: wide cranium, cheeks with
// actual fullness, a jaw that tapers to a small chin. The face texture is
// planar-projected onto the front hemisphere (see face.js FACE_SPAN); the
// back maps to a plain-skin corner texel so one mesh wears both.

import * as THREE from 'three';
import { FACE_SPAN } from './face.js';
import { toonMaterial, outlineFor } from './toon.js';

export const HEAD_R = 0.115; // base radius (metres-ish)

export function buildHead({ faceWidth = 0.5, jaw = 0.5, faceTexture, skin }) {
  const geo = new THREE.SphereGeometry(1, 56, 44);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  const wide = 0.94 + faceWidth * 0.18;       // slider: narrow ↔ wide
  const jawK = 0.42 + jaw * 0.34;             // slider: soft ↔ sharp chin

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let { x, y, z } = v;

    // cranium: a touch taller than a ball
    y *= 1.06;
    // jaw taper below the midline: pinch x, pull the chin forward & down
    const s = THREE.MathUtils.smoothstep(-y, 0.05, 1.0);
    const pinch = 1 - s * jawK;
    x *= pinch;
    z = z * (1 - s * 0.30) + s * 0.16;
    y -= s * s * 0.10;
    // cheek fullness: front-lower quadrant swells slightly
    const cheek = THREE.MathUtils.smoothstep(-y, -0.05, 0.45)
      * (1 - THREE.MathUtils.smoothstep(-y, 0.45, 0.9))
      * THREE.MathUtils.smoothstep(z, -0.1, 0.6);
    x *= 1 + cheek * 0.10;
    // face plane: flatten the front a whisper so features don't warp
    z *= 1 - 0.10 * THREE.MathUtils.smoothstep(z, 0.55, 1.0);

    pos.setXYZ(i, x * HEAD_R * wide, y * HEAD_R, z * HEAD_R);

    // planar face projection on the front; back = plain-skin texel
    if (z > -0.05) {
      const blend = THREE.MathUtils.smoothstep(z, -0.05, 0.25);
      const u2 = 0.5 + (x * wide * FACE_SPAN);
      const v2 = 0.5 + (y * FACE_SPAN);
      uv.setXY(i, THREE.MathUtils.lerp(0.02, u2, blend), THREE.MathUtils.lerp(0.02, v2, blend));
    } else {
      uv.setXY(i, 0.02, 0.02);
    }
  }
  geo.computeVertexNormals();

  const mat = toonMaterial({ map: faceTexture, faceMode: 1, rim: 0.18 });
  const head = new THREE.Group();
  head.name = 'head';
  const skullMesh = new THREE.Mesh(geo, mat);
  skullMesh.name = 'skull';
  head.add(skullMesh, outlineFor(skullMesh, 0.0032));

  // ears — small skin nubs, mostly under hair
  const earGeo = new THREE.SphereGeometry(HEAD_R * 0.24, 12, 10);
  earGeo.scale(0.5, 1, 0.8);
  const earMat = toonMaterial({ color: skin, rim: 0.2 });
  for (const m of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, earMat);
    ear.position.set(m * HEAD_R * wide * 0.96, -HEAD_R * 0.08, 0);
    head.add(ear);
  }
  return head;
}
