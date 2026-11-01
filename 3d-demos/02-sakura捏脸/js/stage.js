// js/stage.js — the fitting room. A soft dusk-gradient backdrop (the brand
// palette from 竜の谷), a glowing platform disc, a contact shadow, drifting
// bokeh petals, and nothing else — the character is the show.

import * as THREE from 'three';

const TAU = Math.PI * 2;

export function createStage(scene) {
  // backdrop dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(30, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 lo = vec3(0.16, 0.09, 0.17);
          vec3 md = vec3(0.28, 0.14, 0.26);
          vec3 hi = vec3(0.10, 0.07, 0.16);
          vec3 c = mix(lo, md, smoothstep(0.15, 0.5, h));
          c = mix(c, hi, smoothstep(0.5, 0.9, h));
          // a soft key glow behind the character
          float g = pow(max(dot(vDir, normalize(vec3(0.0, 0.25, -1.0))), 0.0), 3.0);
          c += vec3(0.30, 0.16, 0.20) * g;
          // authored in display space; the OutputPass expects linear
          gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
        }`,
    })
  );
  dome.renderOrder = -10;
  scene.add(dome);

  // platform disc
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(256, 256, 30, 256, 256, 256);
  grad.addColorStop(0, '#4a2e42');
  grad.addColorStop(0.62, '#33203a');
  grad.addColorStop(0.86, '#5c3a52');
  grad.addColorStop(0.92, '#8a5a72');
  grad.addColorStop(1, 'rgba(90,50,70,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  // inscribed ring
  g.strokeStyle = 'rgba(230,180,150,0.5)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(256, 256, 205, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(230,180,150,0.25)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(256, 256, 190, 0, TAU);
  g.stroke();
  const discTex = new THREE.CanvasTexture(cv);
  discTex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 48),
    new THREE.MeshBasicMaterial({ map: discTex, transparent: true })
  );
  disc.rotation.x = -Math.PI / 2;
  scene.add(disc);

  // contact shadow
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const sg = sc.getContext('2d');
  const sGrad = sg.createRadialGradient(64, 64, 6, 64, 64, 64);
  sGrad.addColorStop(0, 'rgba(20,8,20,0.55)');
  sGrad.addColorStop(1, 'rgba(20,8,20,0)');
  sg.fillStyle = sGrad;
  sg.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 24),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  scene.add(shadow);

  // bokeh petals
  const N = 90;
  const pos = new Float32Array(N * 3);
  const seed = [];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 7;
    pos[i * 3 + 1] = Math.random() * 3.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 7;
    seed.push(Math.random() * TAU);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const bokehCv = document.createElement('canvas');
  bokehCv.width = bokehCv.height = 32;
  const bg = bokehCv.getContext('2d');
  const bGrad = bg.createRadialGradient(16, 16, 2, 16, 16, 16);
  bGrad.addColorStop(0, 'rgba(255,200,215,0.9)');
  bGrad.addColorStop(0.6, 'rgba(255,170,195,0.25)');
  bGrad.addColorStop(1, 'rgba(255,170,195,0)');
  bg.fillStyle = bGrad;
  bg.fillRect(0, 0, 32, 32);
  const petals = new THREE.Points(pGeo, new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(bokehCv),
    size: 0.055,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.75,
  }));
  petals.frustumCulled = false;
  scene.add(petals);

  return {
    update(t, dt) {
      const arr = pGeo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        arr[i * 3] += Math.sin(t * 0.5 + seed[i]) * 0.06 * dt + 0.02 * dt;
        arr[i * 3 + 1] -= (0.05 + 0.04 * Math.sin(seed[i])) * dt;
        if (arr[i * 3 + 1] < 0.02) arr[i * 3 + 1] = 3.2;
      }
      pGeo.attributes.position.needsUpdate = true;
    },
  };
}
