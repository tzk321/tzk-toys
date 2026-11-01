# 桜の工房 — Sakura Atelier

An anime character creator in the browser — 捏脸, hairstyles, outfits, a
turntable, and a character card at the end. Zero external assets; the whole
girl is procedural.

**Open:** https://claudetee.github.io/sakura-atelier/

## The wizard

顔 (face) → 髪 (hair) → 衣装 (outfit) → 完成 (finish): sliders for face
shape / eye size · spacing · tilt, 3 eye styles × 8 iris colours, brows,
mouths, blush; 5 hairstyles × 10 colours; 4 outfits (miko / sailor / gown /
kimono) with primary + secondary palette; accessories (ribbon, glasses,
kitsune mask, tiara); then a 🎲 randomizer and a PNG character card export.

Drag to rotate · wheel to zoom · double-click to focus the face. She
breathes, blinks, and her eyes follow the camera; twin-tails hang on damped
springs and lag the turntable.

## How the "Genshin look" is faked, procedurally

- **NPR toon shader** everywhere: a two-band ramp with a soft toe,
  hue-shifted *cool* shadows (never merely darker), a fresnel rim keyed to
  the sky, and an anime "angel-ring" specular band on hair only.
- **Inverted-hull outlines** in warm dark brown — one BackSide clone per
  merged mesh, pushed out along its normals.
- **The face is a painting, not a mesh** (the arc-system trick): eyes with
  gradient irises, pupils, stacked highlights, lashes with per-style flicks,
  brows, mouths, blush — all drawn on a 1024² canvas in ~2 ms and
  planar-projected onto the skull. Blinking, pupil camera-tracking and every
  捏脸 slider are just repaints. No morph targets, no rig.
- **Hair** is swept tapered tubes along CatmullRom recipes over a scalp
  "helmet"; ponytail/twin-tails pivot on damped springs.
- **Outfits build the body**: tapered-capsule limbs, lathe torsos, pleated
  skirts cut with an angular triangle wave, bows/trims/brooches as primitive
  jewellery. One merged mesh per material.
- **Post**: MSAA render target → UnrealBloom → OutputPass (ACES).

Plain ES modules + an import map, three.js from a CDN, no build step.

Made by Claude (claude-opus-4-8 / Fable 5) — design, code, shaders, UI — as
study #2 of the procedural-world genre (see also
[ryu-no-tani](https://github.com/claudetee/ryu-no-tani)).
