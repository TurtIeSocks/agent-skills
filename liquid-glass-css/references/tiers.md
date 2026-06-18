# The three tiers — CSS → JS → WebGL

How much you depend on is a separate axis from how good it looks. This skill has **two axes**, and they are orthogonal:

- **Level** (`L1` → `L2` → `L3`) = *visual fidelity*, all pure CSS. How many optical layers are on.
- **Tier** (`1` → `2` → `3`) = *dependency*. What you sign up for: pure CSS/SVG, then JavaScript, then a WebGL shader.

A surface is described by **both** — e.g. "Tier 1, L3" (pure-CSS refracted hero) or "Tier 2, L2 + tilt" (specular that tracks the cursor). Fidelity is **not** monotonic with tier: the Tier-1 `.glass--apple` (SVG chromatic + specular) looks better than a bare Tier-2 pointer glint. Pick the lowest tier that gets the look you need — every tier up costs JS weight, perf, or a renderer.

> **Naming note.** "Tier 1/2/3" is this dependency axis. The morphing techniques (`matched-geometry morph`, `gooey merge`, `shader morph`) used to be called "Tier A/B/C" — that label is retired to avoid the clash. Morphing techniques themselves span tiers (gooey = Tier 1, matched-geometry = Tier 2, shader = Tier 3).

---

## Tier 1 — pure CSS/SVG (no JavaScript)

Everything renders from a stylesheet + static SVG `<filter>` defs. Drop into any page, no build step, no runtime.

- **Material:** `.glass`, `.glass--l2`, `.glass--l3` (turbulent refraction), `.glass--clear`, `.glass--fresnel`, presets, all components.
- **Ceiling:** `.glass--apple` — no-JS gradient-map barrel refraction + real chromatic aberration + a `feSpecularLighting` rim glint (optionally SMIL-animated). The most Apple-accurate look without a line of JS. See `references/levels.md` (*Pure CSS/SVG ceiling*).
- **Costs:** `url()` backdrop filters (L3, apple) are Chromium-leaning → degrade to the L2 solid via `@supports` on Safari/Firefox. Heavy filters are for *one hero element*.
- **Can't do:** react to input/sensors, read the backdrop, or refract per-frame over animating content.

## Tier 2 — + JavaScript

Adds a little JS to do the things CSS can't: react to the real world and read the page.

- **`.glass--interactive` + `useGlassPointer`** — pointer-tracking specular (`--mx/--my`).
- **`useGlassLens` + `.glass--lens`** *(footnote)* — JS generates a corner-accurate SDF displacement map (canvas). Only reach for it when the Tier-1 `.glass--apple` rectangular barrel isn't accurate enough at the corners; otherwise prefer apple. See `references/levels.md`.
- **`useGlassMorphTransition` + matched-geometry morph** — `framer-motion` `layoutId` (or vanilla FLIP) tweens between states. See `references/morphing.md`.
- **Planned:** `useGlassTilt` (gyroscope/pointer drives the specular light + displacement — the "feels physical" glint), adaptive vibrancy (sample backdrop luminance → auto tint/contrast).
- **Costs:** ships JS; pointer/gyro needs permission on iOS; backdrop sampling is perf-sensitive (throttle, downscale).

## Tier 3 — + WebGL shader

A fragment shader refracts/disperses/lights **per frame**. The only path that escapes the Chromium-only `url()` wall (works in Firefox/Safari) and refracts **live video/scrolling** content smoothly. Native-grade — and a real renderer.

- **Status:** reference implementation (not a drop-in). Capturing arbitrary live DOM as a texture is slow/fragile; it shines over an image, video, or canvas backdrop.
- **Costs:** a WebGL dependency + the capture problem. Reserve for the one surface that truly needs it.

---

## Feature → tier map

| Feature | Tier | Notes |
|---|---|---|
| `.glass`, `--l2`, `--l3`, `--clear`, `--fresnel` | **1** | static CSS + SVG |
| `.glass--apple` (chromatic + specular) | **1** | the no-JS refraction ceiling |
| components + presets | **1** | — |
| gooey merge (`.glass-goo` / `#glass-goo`) | **1** | CSS/SVG morph |
| `.glass--interactive` / `useGlassPointer` | **2** | pointer specular |
| `.glass--lens` / `useGlassLens` | **2** | footnote — corner-accurate map; prefer `--apple` |
| matched-geometry morph (`useGlassMorphTransition`) | **2** | framer-motion / FLIP |
| `useGlassTilt`, adaptive vibrancy | **2** | planned |
| shader morph / WebGL glass | **3** | reference only |

## Which tier?

```
No build step / static site / progressive enhancement?   → Tier 1 (apple is the ceiling)
React/JS app, want input- or content-reactive glass?      → Tier 2 (add only the hooks you use)
Need cross-browser real-time over live video/scroll?      → Tier 3 (accept the renderer)
```

Default to **Tier 1**. Add Tier 2 per-feature (one hook at a time), not wholesale. Tier 3 is the exception, not the goal.
