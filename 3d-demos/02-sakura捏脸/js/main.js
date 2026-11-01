// js/main.js — the atelier shell. One character = head (painted face) + hair
// (strand recipes) + body (outfit builds) + accessories, hanging off a
// turntable group. UI sliders either REPAINT (face canvas, ~2 ms), RETINT
// (material uniform swap) or REBUILD (geometry) — never more than needed.
// Post chain: MSAA render target → UnrealBloom → OutputPass.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createFacePainter } from './face.js';
import { buildHead, HEAD_R } from './head.js';
import { buildHair, HAIR_STYLES } from './hair.js';
import { buildBody, OUTFITS, P } from './body.js';
import { buildAccessories } from './accessories.js';
import { createStage } from './stage.js';

const q = new URLSearchParams(location.search);

// ------------------------------------------------------------- palettes ---
const SKINS = ['#ffe9d8', '#ffdfc4', '#f2c9a8', '#c9946f'];
const EYE_COLORS = ['#7a5ae0', '#4a90d9', '#3fae8a', '#d9903f', '#d4506a', '#8a5a3f', '#c04ad0', '#607080'];
const HAIR_COLORS = ['#3a2e3c', '#7a4a52', '#b8874f', '#e8dbc8', '#8a5a9e', '#4a6a9e', '#c85a6e', '#5a8a72', '#d8d5dd', '#2e4a68'];
const RIBBONS = ['#d8465f', '#e8b04a', '#5a8ad0', '#f2ede4', '#3a2e3c'];
const OUTFIT_A = ['#c8323e', '#3a4a72', '#8a2e4a', '#2e5a4a', '#5a3a7a', '#1e1e28', '#d0688a', '#c9a86a'];
const OUTFIT_B = ['#f4f1ea', '#e8dbc8', '#2e2431', '#d9b25e', '#b8d0e8', '#f2c4ce'];
const NAMES = ['紗夜', '小雪', '琳', '綾音', '椿', 'ルナ', '楓', '白露'];

const OUTFIT_LABEL = { miko: '巫女', sailor: '水手服', dress: '晚礼裙', kimono: '着物' };
const HAIR_LABEL = { bob: '短发', long: '长直', twin: '双马尾', pony: '马尾', hime: '姬发式' };

// ------------------------------------------------------------- state ------
const params = {
  name: NAMES[0],
  skin: SKINS[0],
  faceWidth: 0.42, jaw: 0.62,
  eyeSize: 1.0, eyeSpacing: 1.0, eyeTilt: 0.0,
  eyeColor: EYE_COLORS[0], eyeStyle: 'round',
  browStyle: 'arch', mouthStyle: 'smile', blush: 0.45,
  hairStyle: 'twin', hairColor: HAIR_COLORS[1], ribbon: RIBBONS[0],
  outfit: 'miko', colorA: OUTFIT_A[0], colorB: OUTFIT_B[0],
  acc: { ribbon: true, glasses: false, mask: false, tiara: false },
};

// ------------------------------------------------------------ renderer ----
const renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('viewport').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, window.innerWidth / window.innerHeight, 0.05, 60);

const size = () => new THREE.Vector2(
  Math.floor(window.innerWidth * renderer.getPixelRatio()),
  Math.floor(window.innerHeight * renderer.getPixelRatio()));
const rt = new THREE.WebGLRenderTarget(size().x, size().y, { samples: 8 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(size(), 0.16, 0.35, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const stage = createStage(scene);

// ----------------------------------------------------------- character ----
const charGroup = new THREE.Group();
scene.add(charGroup);
const headHolder = new THREE.Group();
headHolder.position.y = P.neckTop + HEAD_R * 0.80;
headHolder.scale.setScalar(1.18); // anime ratio: the head reads BIG
charGroup.add(headHolder);

if (q.get('outfit')) params.outfit = q.get('outfit');
if (q.get('hair')) params.hairStyle = q.get('hair');
const painter = createFacePainter();
let headGroup = null, hairApi = null, bodyApi = null, accGroup = null;

const disposeDeep = (root) => root?.traverse((o) => {
  if (o.geometry) o.geometry.dispose();
  if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
});

let blink = 0;
const look = { x: 0, y: 0 };
function repaintFace() {
  painter.draw({
    skin: params.skin,
    eyeSize: params.eyeSize,
    eyeSpacing: params.eyeSpacing,
    eyeTilt: params.eyeTilt,
    eyeColor: params.eyeColor,
    eyeStyle: params.eyeStyle,
    browStyle: params.browStyle,
    browColor: params.hairColor,
    mouthStyle: params.mouthStyle,
    blush: params.blush,
    blink,
    look,
    bangsShadow: true,
  });
}
function rebuildHead() {
  if (headGroup) { headHolder.remove(headGroup); disposeDeep(headGroup); }
  headGroup = buildHead({ faceWidth: params.faceWidth, jaw: params.jaw, faceTexture: painter.texture, skin: params.skin });
  headHolder.add(headGroup);
}
function rebuildHair() {
  if (hairApi) { headHolder.remove(hairApi.group); disposeDeep(hairApi.group); }
  hairApi = buildHair({ style: params.hairStyle, color: params.hairColor, ribbon: params.ribbon });
  headHolder.add(hairApi.group);
}
function rebuildBody() {
  if (bodyApi) { charGroup.remove(bodyApi.group); disposeDeep(bodyApi.group); }
  bodyApi = buildBody({ outfit: params.outfit, colorA: params.colorA, colorB: params.colorB, skin: params.skin });
  charGroup.add(bodyApi.group);
}
function rebuildAcc() {
  if (accGroup) { headHolder.remove(accGroup); disposeDeep(accGroup); }
  accGroup = buildAccessories(params.acc, { ribbon: params.ribbon });
  headHolder.add(accGroup);
}
repaintFace();
rebuildHead();
rebuildHair();
rebuildBody();
rebuildAcc();

// ------------------------------------------------------------ turntable ---
let rotY = q.get('still') ? 0 : 0.35, rotVel = 0, camPitch = 0.22, dist = 3.4;
if (q.get('closeup')) { dist = 1.25; camPitch = 0.02; }
let autoRotate = !q.get('still'), dragging = false, lastX = 0, lastY = 0;
const dom = renderer.domElement;
dom.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; autoRotate = false; });
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  rotVel = dx * 0.0075;
  rotY += rotVel;
  camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.003, -0.12, 0.55);
});
dom.addEventListener('wheel', (e) => {
  e.preventDefault();
  dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.0016, 1.05, 3.6);
}, { passive: false });
dom.addEventListener('dblclick', () => { dist = dist > 1.7 ? 1.15 : 2.5; });

// ---------------------------------------------------------------- UI ------
const $ = (s) => document.querySelector(s);
const ctlRoot = $('#controls');
const mk = (tag, cls, parent) => { const el = document.createElement(tag); if (cls) el.className = cls; parent.append(el); return el; };

function slider(parent, label, get, set, min = 0, max = 1) {
  const row = mk('div', 'row', parent);
  mk('label', '', row).textContent = label;
  const inp = mk('input', '', row);
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = 0.01; inp.value = get();
  inp.addEventListener('input', () => set(parseFloat(inp.value)));
  return inp;
}
function swatches(parent, label, colors, get, set) {
  const row = mk('div', 'row col', parent);
  mk('label', '', row).textContent = label;
  const box = mk('div', 'swatches', row);
  const btns = colors.map((c) => {
    const b = mk('button', 'swatch', box);
    b.style.background = c;
    b.addEventListener('click', () => { set(c); mark(); });
    return b;
  });
  const mark = () => btns.forEach((b, i) => b.classList.toggle('on', colors[i] === get()));
  mark();
  return mark;
}
function segmented(parent, label, options, get, set) {
  const row = mk('div', 'row col', parent);
  mk('label', '', row).textContent = label;
  const box = mk('div', 'seg', row);
  const keys = Object.keys(options);
  const btns = keys.map((k) => {
    const b = mk('button', '', box);
    b.textContent = options[k];
    b.addEventListener('click', () => { set(k); mark(); });
    return b;
  });
  const mark = () => btns.forEach((b, i) => b.classList.toggle('on', keys[i] === get()));
  mark();
}
function toggle(parent, label, get, set) {
  const row = mk('div', 'row', parent);
  mk('label', '', row).textContent = label;
  const b = mk('button', 'tog', row);
  const mark = () => { b.textContent = get() ? 'ON' : 'OFF'; b.classList.toggle('on', get()); };
  b.addEventListener('click', () => { set(!get()); mark(); });
  mark();
}

const TABS = [
  { id: 'face', label: '顔 · 脸' },
  { id: 'hair', label: '髪 · 发型' },
  { id: 'outfit', label: '衣装 · 时装' },
  { id: 'finish', label: '完成' },
];
const tabBar = $('#tabs');
let activeTab = 'face';
let panes = {};

function showTab(id) {
  activeTab = id;
  for (const t of TABS) panes[t.id].style.display = t.id === id ? '' : 'none';
  tabBar.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
  $('#next').textContent = id === 'finish' ? '✦ 生成角色卡' : '下一步 →';
}

// the whole panel is rebuilt from params — init AND after randomize
function buildPanel() {
  tabBar.innerHTML = '';
  ctlRoot.innerHTML = '';
  panes = {};
  for (const t of TABS) {
    const b = mk('button', '', tabBar);
    b.textContent = t.label;
    b.dataset.tab = t.id;
    b.addEventListener('click', () => showTab(t.id));
    panes[t.id] = mk('div', 'pane', ctlRoot);
  }

  // — face —
  slider(panes.face, '脸宽', () => params.faceWidth, (v) => { params.faceWidth = v; queue('head'); });
  slider(panes.face, '下巴', () => params.jaw, (v) => { params.jaw = v; queue('head'); });
  swatches(panes.face, '肤色', SKINS, () => params.skin, (v) => { params.skin = v; queue('face'); queue('head'); queue('body'); });
  segmented(panes.face, '眼型', { round: '圆眼', sharp: '锐眼', droopy: '垂眼' }, () => params.eyeStyle, (v) => { params.eyeStyle = v; queue('face'); });
  slider(panes.face, '眼睛大小', () => params.eyeSize, (v) => { params.eyeSize = v; queue('face'); }, 0.75, 1.3);
  slider(panes.face, '眼距', () => params.eyeSpacing, (v) => { params.eyeSpacing = v; queue('face'); }, 0.85, 1.2);
  slider(panes.face, '眼睛倾斜', () => params.eyeTilt, (v) => { params.eyeTilt = v; queue('face'); }, -0.25, 0.25);
  swatches(panes.face, '瞳色', EYE_COLORS, () => params.eyeColor, (v) => { params.eyeColor = v; queue('face'); });
  segmented(panes.face, '眉形', { arch: '柔和', straight: '平直', worried: '八字' }, () => params.browStyle, (v) => { params.browStyle = v; queue('face'); });
  segmented(panes.face, '嘴型', { smile: '微笑', cat: '猫嘴', open: '开心', neutral: '淡定' }, () => params.mouthStyle, (v) => { params.mouthStyle = v; queue('face'); });
  slider(panes.face, '腮红', () => params.blush, (v) => { params.blush = v; queue('face'); });

  // — hair —
  segmented(panes.hair, '发型', HAIR_LABEL, () => params.hairStyle, (v) => { params.hairStyle = v; queue('hair'); });
  swatches(panes.hair, '发色', HAIR_COLORS, () => params.hairColor, (v) => { params.hairColor = v; hairApi.setColor(v); queue('face'); });
  swatches(panes.hair, '发饰色', RIBBONS, () => params.ribbon, (v) => { params.ribbon = v; hairApi.setRibbon(v); queue('acc'); });

  // — outfit —
  segmented(panes.outfit, '时装', OUTFIT_LABEL, () => params.outfit, (v) => { params.outfit = v; queue('body'); });
  swatches(panes.outfit, '主色', OUTFIT_A, () => params.colorA, (v) => { params.colorA = v; bodyApi.setColorA(v); });
  swatches(panes.outfit, '辅色', OUTFIT_B, () => params.colorB, (v) => { params.colorB = v; bodyApi.setColorB(v); });

  // — finish —
  toggle(panes.finish, '发带蝴蝶结', () => params.acc.ribbon, (v) => { params.acc.ribbon = v; queue('acc'); });
  toggle(panes.finish, '圆框眼镜', () => params.acc.glasses, (v) => { params.acc.glasses = v; queue('acc'); });
  toggle(panes.finish, '狐狸面具', () => params.acc.mask, (v) => { params.acc.mask = v; queue('acc'); });
  toggle(panes.finish, '黄金冠冕', () => params.acc.tiara, (v) => { params.acc.tiara = v; queue('acc'); });
  {
    const row = mk('div', 'row', panes.finish);
    mk('label', '', row).textContent = '名字';
    const inp = mk('input', 'name', row);
    inp.type = 'text'; inp.maxLength = 12; inp.value = params.name;
    inp.addEventListener('input', () => { params.name = inp.value || '???'; });
  }
  toggle(panes.finish, '自动旋转', () => autoRotate, (v) => { autoRotate = v; });
  showTab(activeTab);
}
buildPanel();

// wizard footer
$('#next').addEventListener('click', () => {
  const i = TABS.findIndex((t) => t.id === activeTab);
  if (i < TABS.length - 1) showTab(TABS[i + 1].id);
  else exportCard();
});
$('#rand').addEventListener('click', () => {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  Object.assign(params, {
    skin: pick(SKINS), faceWidth: Math.random(), jaw: Math.random(),
    eyeSize: 0.85 + Math.random() * 0.4, eyeSpacing: 0.9 + Math.random() * 0.25,
    eyeTilt: (Math.random() - 0.5) * 0.4, eyeColor: pick(EYE_COLORS),
    eyeStyle: pick(['round', 'sharp', 'droopy']), browStyle: pick(['arch', 'straight', 'worried']),
    mouthStyle: pick(['smile', 'cat', 'open', 'neutral']), blush: Math.random(),
    hairStyle: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS), ribbon: pick(RIBBONS),
    outfit: pick(OUTFITS), colorA: pick(OUTFIT_A), colorB: pick(OUTFIT_B),
    name: pick(NAMES),
  });
  params.acc.ribbon = Math.random() > 0.4;
  params.acc.glasses = Math.random() > 0.8;
  params.acc.mask = Math.random() > 0.85;
  params.acc.tiara = Math.random() > 0.8;
  queue('face'); queue('head'); queue('hair'); queue('body'); queue('acc');
  buildPanel();
});

// ------------------------------------------------------------ rebuilds ----
const dirty = new Set();
function queue(what) { dirty.add(what); }
function flushDirty() {
  if (!dirty.size) return;
  if (dirty.has('face')) repaintFace();
  if (dirty.has('head')) rebuildHead();
  if (dirty.has('hair')) rebuildHair();
  if (dirty.has('body')) rebuildBody();
  if (dirty.has('acc')) rebuildAcc();
  dirty.clear();
}

// ------------------------------------------------------------ card --------
function exportCard() {
  flushDirty();
  composer.render();
  const shot = renderer.domElement;
  const W = 1000, H = 1500;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#241528');
  bg.addColorStop(0.6, '#3a2040');
  bg.addColorStop(1, '#1a0f20');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // character crop (center band of the viewport)
  const sw = shot.width, sh = shot.height;
  const band = Math.min(sw, sh * (W / (H - 260)));
  g.drawImage(shot, (sw - band) / 2, 0, band, sh, 40, 40, W - 80, H - 300);
  // gold frame
  g.strokeStyle = '#d9b25e';
  g.lineWidth = 3;
  g.strokeRect(40, 40, W - 80, H - 300);
  g.strokeStyle = 'rgba(217,178,94,0.45)';
  g.strokeRect(52, 52, W - 104, H - 324);
  // name + footer
  g.fillStyle = '#f4e8d8';
  g.font = '500 84px Georgia, "Hiragino Mincho ProN", serif';
  g.textAlign = 'center';
  g.fillText(params.name, W / 2, H - 150);
  g.fillStyle = 'rgba(240,220,190,0.55)';
  g.font = '26px Georgia, serif';
  g.fillText('桜の工房 — SAKURA ATELIER', W / 2, H - 84);
  const a = document.createElement('a');
  a.download = `${params.name}-card.png`;
  a.href = cv.toDataURL('image/png');
  a.click();
}

// ------------------------------------------------------------ idle life ---
let nextBlink = 2.5, blinkPhase = -1; // -1 idle, else 0..1 progress
let lookDirty = 0;

// ------------------------------------------------------------- loop -------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  flushDirty();

  if (autoRotate) { rotY += dt * 0.22; rotVel = dt * 0.22; }
  else if (!dragging) rotVel *= 0.9;
  charGroup.rotation.y = rotY;
  // breathing + a tiny head sway
  charGroup.scale.y = 1 + Math.sin(t * 1.5) * 0.0035;
  headHolder.rotation.z = Math.sin(t * 0.8) * 0.015;
  headHolder.rotation.x = Math.sin(t * 0.6) * 0.010;

  // camera rig (character rotates; camera stays front)
  // MathUtils.smoothstep needs min<max — invert for "closer ⇒ higher focus"
  const focus = 1 - THREE.MathUtils.smoothstep(dist, 1.15, 1.9);
  const targetY = THREE.MathUtils.lerp(0.98, 1.42, focus);
  camera.position.set(0, targetY + Math.sin(camPitch) * dist, Math.cos(camPitch) * dist);
  camera.lookAt(0, targetY, 0);

  // blink state machine
  if (blinkPhase < 0 && t > nextBlink && !q.get('still')) blinkPhase = 0;
  if (blinkPhase >= 0) {
    blinkPhase += dt / 0.24;
    blink = blinkPhase < 0.4 ? blinkPhase / 0.4 : Math.max(0, 1 - (blinkPhase - 0.4) / 0.6);
    queue('face');
    if (blinkPhase >= 1) { blinkPhase = -1; blink = 0; nextBlink = t + 2.2 + Math.random() * 3.5; queue('face'); }
  }

  // pupils track the camera when the face is visible
  lookDirty -= dt;
  const rel = ((rotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const facing = rel > Math.PI ? rel - Math.PI * 2 : rel; // -π..π, 0 = facing camera
  const wantX = Math.abs(facing) < 1.2 ? THREE.MathUtils.clamp(-facing * 0.8, -1, 1) : 0;
  const wantY = THREE.MathUtils.clamp((camPitch - 0.1) * 1.2, -0.6, 0.6);
  if (lookDirty <= 0 && (Math.abs(wantX - look.x) > 0.05 || Math.abs(wantY - look.y) > 0.05)) {
    look.x += (wantX - look.x) * 0.5;
    look.y += (wantY - look.y) * 0.5;
    queue('face');
    lookDirty = 0.12;
  }

  hairApi.update(t, dt, rotVel / Math.max(dt, 1e-4) * 0.02);
  stage.update(t, dt);
  composer.render();
});

document.getElementById('loading').style.opacity = '0';

// ------------------------------------------------------------ harness -----
window.__atelier = {
  params, camera, renderer, scene,
  set(patch) { Object.assign(params, patch); queue('face'); queue('head'); queue('hair'); queue('body'); queue('acc'); },
  queue,
  get rotY() { return rotY; },
  set rotY(v) { rotY = v; },
  setAutoRotate(v) { autoRotate = v; },
  ready: true,
};
