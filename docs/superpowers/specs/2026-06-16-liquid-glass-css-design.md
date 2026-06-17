# Design: `liquid-glass-css` skill

**Date:** 2026-06-16
**Status:** Approved (brainstorming complete) — ready for implementation plan
**Author:** Comrade Claude + Rin

## Summary

A new repo skill, `liquid-glass-css`, that ports Apple's iOS 26 "Liquid Glass" look to the web with CSS. It is the web/CSS counterpart to the existing iOS/SwiftUI `liquid-glass-design` skill (a separate install at `~/.agents/skills/liquid-glass-design`). The reference aesthetic is the attached SEDELA dashboard: a dark, warm, ambient-gradient admin UI built from translucent frosted panels.

The skill teaches glass as a **stack of optical layers** (not a single `backdrop-filter`), driven by **CSS custom-property tokens**, with three fidelity **levels**, three theme **presets**, **5 components**, and parallel coverage for **vanilla CSS, Tailwind v4, and React**.

## Decisions (from brainstorming)

| Decision | Choice | Notes |
|---|---|---|
| Engage mode | Participate (section-by-section sign-off) | — |
| Scope | Recipe + core components | card, button, nav/toolbar, pill/badge, modal. Not a one-off dashboard clone. |
| Fidelity ceiling | All 3 levels, complete | incl. L3 SVG `feDisplacementMap` refraction + caveats + perf |
| Stacks | Vanilla CSS + Tailwind v4 + React | React added mid-flow (user is ~99% React) |
| Theming | Token-driven + presets | dark (SEDELA hero) / light / tinted |
| Structure | `leaflet` pattern: SKILL.md hub + `references/` + `assets/` + `evals/` | heavy reference split out per `writing-skills` |
| Morphing | Tier A (matched-geometry) + Tier B (gooey merge) in; Tier C (WebGL refraction) out | added after initial approval |

**DRY guard:** CSS owns the material/look. Tailwind and React layers add only what they uniquely provide (utilities/tokens; ergonomics, TS types, and the two JS-only effects). Neither re-implements the glass look.

## Skill identity

- **Folder/name:** `liquid-glass-css`
- **Description (CSO trigger string):**
  > Use when building translucent "liquid glass" or glassmorphism UI on the web with CSS — frosted/blurred panels, cards, navbars, buttons, or modals that blur and tint what's behind them. Triggers on `backdrop-filter`, `blur()`, frosted glass, translucent/acrylic surfaces, Apple-style or iOS-26-style glass on the web, dark dashboards with glowing ambient backgrounds, or porting an iOS Liquid Glass look to HTML/CSS/Tailwind. Covers vanilla CSS and Tailwind v4. Trigger even if the user doesn't say "glassmorphism" — "frosted card", "blurry transparent panel", "glass navbar", "see-through blurred header" all qualify. Not for native iOS/SwiftUI (use `liquid-glass-design`).
- **When to use:** frosted/glass surfaces on web; dark ambient dashboards; porting iOS Liquid Glass → HTML/CSS; glass navbar/card/modal/button/pill; debugging "`backdrop-filter` does nothing".
- **When NOT:** native iOS/SwiftUI → `liquid-glass-design`; fully opaque UI; contexts where translucency fails accessibility and no fallback is acceptable.
- **Cross-links:** two deliberate references to `liquid-glass-design` so the iOS↔web pair is discoverable from either side.

## Core teaching model

**Glass is not one property — it is a stack of ~6 optical layers.** The most common failure is doing only layer 1 (blur). The skill drills the layering.

| # | Optical layer | CSS mechanism |
|---|---|---|
| 1 | Backdrop (blur + refraction) | `backdrop-filter: blur() saturate()` — `+ url(#refract)` at L3 |
| 2 | Body tint | translucent fill — flat at L1, top-lit gradient at L2/L3 |
| 3 | Rim / edge | hairline border (L1) → gradient light-catching border (L2/L3) |
| 4 | Specular highlight | inner top light `inset 0 1px 0` + `::before` sheen |
| 5 | Inner depth | inner bottom shadow `inset 0 -Npx` → thickness |
| 6 | Elevation | outer `box-shadow` → floats off page |

## Token schema

Every layer is a CSS custom property. Presets/components retune by overriding vars, never rewriting rules. Channel-trick (`R G B` then `/ alpha`) lets one tint value drive many alphas.

```css
:root {
  /* 1 backdrop */    --glass-blur: 16px;          --glass-saturate: 140%;
  /* 2 body tint */   --glass-tint: 255 255 255;   --glass-tint-opacity: .08;
                      --glass-fill: rgb(var(--glass-tint) / var(--glass-tint-opacity));
  /* 3 rim */         --glass-border: rgb(255 255 255 / .18);   --glass-radius: 18px;
  /* 4 highlight */   --glass-highlight: rgb(255 255 255 / .5);
  /* 5 inner depth */ --glass-inner-shadow: rgb(0 0 0 / .18);
  /* 6 elevation */   --glass-shadow: 0 12px 40px rgb(0 0 0 / .45);
}
```

Contract: **presets** = different values; **levels** = how many layers are switched on; **components** = same tokens, different geometry/radius.

## Three fidelity levels

Classes stack: `.glass` → `.glass.glass--l2` → `.glass.glass--l3`.

**L1 — baseline** (layers 1,2,3,6), production-safe/universal:
```css
.glass{
  background: var(--glass-fill);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  box-shadow: var(--glass-shadow);
}
```

**L2 — specular / "liquid"** (adds 4,5 + gradient fill + light-catching rim), pure CSS/cross-browser:
```css
.glass--l2{
  background: linear-gradient(135deg, rgb(var(--glass-tint)/.15), rgb(var(--glass-tint)/.04));
  box-shadow: var(--glass-shadow),
              inset 0 1px 0 var(--glass-highlight),
              inset 0 -8px 22px var(--glass-inner-shadow);
}
.glass--l2::before{   /* sheen — pseudo, never blocks clicks */
  content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  background: linear-gradient(158deg, var(--glass-highlight), transparent 36%); opacity:.55;
}
```
(+ gradient-rim technique — `border-image` / masked `::after` — documented in `references/levels.md`.)

**L3 — refraction / lensing** (adds real backdrop displacement + animated sheen):
```css
/* inline ONCE per document */
<svg width="0" height="0" aria-hidden="true"><filter id="glass-refract">
  <feTurbulence type="fractalNoise" baseFrequency=".009 .013" numOctaves="2" seed="9" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="32" xChannelSelector="R" yChannelSelector="G"/>
</filter></svg>

.glass--l3{ backdrop-filter: blur(3px) saturate(180%) url(#glass-refract); }
```
**L3 caveats (documented loud):** `backdrop-filter: url()` is Chromium-leaning; Safari/Firefox ignore the `url()` and gracefully degrade to L2 blur (no breakage). Real compositing cost → reserve for hero panels, never every card. Sheen animation gated behind `prefers-reduced-motion`.

**Fallback-first pattern** (key robustness move — solid base, enhance upward):
```css
.glass{ background: rgb(var(--glass-tint) / .6); }   /* readable if no support */
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
  .glass{ background: var(--glass-fill);
          backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); }
}
```
No-`backdrop-filter` browsers get a legible translucent panel, not unreadable text on full transparency.

## Components (5)

Same tokens, different geometry + state. Each maps to an iOS-skill counterpart.

| Vanilla class | Shape / role | iOS twin | Key extras |
|---|---|---|---|
| `.glass-card` | radius-xl panel, padding | card/container | SEDELA stat & chart panels |
| `.glass-button` | capsule, interactive | `.buttonStyle(.glass)` | `:hover` brighten, `:active` scale(.98); `--prominent` = `.glassProminent` |
| `.glass-nav` | sticky topbar/toolbar | toolbar | stronger blur, thin bottom rim (SEDELA top nav) |
| `.glass-pill` / `.glass-badge` | small capsule | — | nav items, `$12.4K` tag, "Total Pending" chip |
| `.glass-modal` + scrim | centered panel + blurred backdrop | sheet | scrim carries own blur; fixed-pos note |

**Interactivity** (maps iOS `.interactive()`): `:hover`/`:active`/`:focus-visible` baked in; plus an **opt-in pointer-tracking specular** — `@property --mx/--my` + small JS sets cursor pos → radial highlight follows pointer. Documented as opt-in (costs JS).

## Presets (3)

Override the token block on `[data-glass-theme="…"]`, nothing else.

- `dark` *(default, SEDELA hero)* — low-opacity white tint, bright highlights, warm ambient bg recommended.
- `light` — the hard case; tint flips to denser white + **darker rim** (low-contrast borders are the #1 light-glass gotcha), softer shadow, less saturate. Gotcha called out.
- `tinted` — colored glass: `--glass-tint: 255 122 26` (SEDELA orange) etc. Maps iOS `.tint()`.

## Tailwind v4

CSS-first (`@theme` + `@utility`):
```css
@theme { --blur-glass:16px; --color-glass-tint:255 255 255; --radius-glass:18px; }
@utility glass {
  background: rgb(var(--color-glass-tint)/.08);
  backdrop-filter: blur(var(--blur-glass)) saturate(1.4);
  border:1px solid rgb(255 255 255/.15); border-radius:var(--radius-glass);
  box-shadow:0 12px 40px rgb(0 0 0/.45);
}
```
\+ a class-mapping table (vanilla → utilities, e.g. `backdrop-blur-md bg-white/10 border border-white/15 rounded-2xl shadow-xl`) for inline composition, and the L3 `url()` arbitrary-value note (`[backdrop-filter:…]`).

## React

`references/react.md` + `assets/Glass.tsx`. Adds only the non-CSS value:
- `<GlassFilter id="…" />` — mounts the SVG `feDisplacementMap` once; configurable `id` to dodge collisions; SSR-safe.
- `useGlassPointer()` — ref hook; sets `--mx/--my` on pointer move for tracking specular; respects `prefers-reduced-motion`; cleans up listeners.
- `<GlassCard> <GlassButton> <GlassPanel> <GlassModal>` — typed wrappers; forward refs; polymorphic `as`; merge `className`. Props: `level?: 1|2|3`, `prominent?`, `theme?`, `interactive?`. **They emit the classes only — zero glass logic duplicated.**
- Next.js notes: `'use client'` for the hook; stable filter id for hydration; Tailwind v4 interop.

## Morphing transitions (`references/morphing.md`)

The web counterpart to iOS `glassEffectID` + `@Namespace` + `GlassEffectContainer`, in two tiers. The glass *material* is unchanged — morphing animates the *shape/position* the material rides on.

**Tier A — matched-geometry morph** (a glass element flows between two states/positions):
- **React (primary):** `framer-motion` `layoutId` — two glass elements sharing a `layoutId` tween into each other; put the glass `className` on a `motion.div`. Documented as the direct `glassEffectID` analog. framer-motion is an optional peer dep, shown by example, never required by the core.
- **Vanilla:** FLIP (First-Last-Invert-Play) — measure before/after rects, apply inverse transform, transition to identity. Short helper in the doc.
- Effort: small. Mostly wiring existing tools + one `demo.html` toggle.

**Tier B — gooey merge/split** (two glass blobs fuse like mercury — the signature Liquid Glass move):
- Technique: SVG **gooey filter** (`feGaussianBlur` → `feColorMatrix` alpha-crank) on a shape/mask layer so overlapping shapes snap into one silhouette; the glass `backdrop-filter` is driven off that shape via `mask`/`clip-path`.
- Caveats (loud): composing the gooey filter with `backdrop-filter` is finicky; perf cost; browser quirks. Ships as a working-but-caveated demo, flagged "advanced".
- Effort: medium.

**Tier C — continuous liquid refraction through the merge: OUT.** Matching iOS exactly (refraction/specular deforming through the fuse) needs animated `feDisplacementMap` (janky/expensive) or WebGL/Canvas shaders — a graphics project out of proportion to a CSS skill. Documented as a one-paragraph "needs WebGL, separate skill" pointer, no implementation.

## Accessibility + performance

First-class (`references/fallbacks-a11y.md`), mirrors the iOS skill's anti-patterns.

- **Contrast-on-glass:** text over high-variance backdrops fails WCAG → denser tint behind text / subtle text-shadow / don't float critical text on busy areas.
- **Media queries:** `prefers-reduced-transparency` → solid preset; `prefers-reduced-motion` → kill sheen + pointer; `prefers-contrast: more` → solid.
- **Perf:** `backdrop-filter` recomposites — limit count, `contain: paint`, never animate blur radius, don't nest backdrop-filters, mobile cost. Loud **"don't put glass on everything"** rule.

## File manifest

```
liquid-glass-css/
  SKILL.md                      # hub: model, tokens, L1/L2 inline, quick-ref tables, decision flowchart
  references/
    levels.md                   # L1/L2/L3 deep dive, refraction filter, browser support matrix
    components.md               # 5 components, full CSS + states
    tailwind-v4.md              # @theme/@utility + class-mapping table
    react.md                    # React reference sheet
    morphing.md                 # Tier A matched-geometry (layoutId/FLIP) + Tier B gooey merge
    fallbacks-a11y.md           # @supports, reduced-* queries, contrast-on-glass, perf
  assets/
    glass.css                   # drop-in: tokens + 3 presets + L1–L3 + components + fallbacks
    Glass.tsx                   # typed React components + useGlassPointer + GlassFilter
    demo.html                   # self-contained SEDELA-flavored live demo (+ morph/merge toggles)
  evals/
    evals.json                  # retrieval + application eval cases
```

## Testing plan (writing-skills TDD — Reference skill → retrieval + application)

- **RED (baseline, no skill):** dispatch fresh subagents on "build a frosted dark-dashboard glass card in CSS" and "my `backdrop-filter` does nothing" — capture gaps (only blurs, forgets `-webkit-`, no fallback, no specular, unreadable contrast, no a11y).
- **GREEN (with skill):** rerun same scenarios → must produce layered glass + fallback + a11y. Plus retrieval probes (refraction? Tailwind `@utility`? React `<GlassCard>`?) + gap tests.
- Encode scenarios in `evals/evals.json` (repo convention).

## README

Add exactly one row to the "Skills in this repo" table. No other README edits.

## Out of scope (YAGNI)

- Full SEDELA dashboard clone (skill teaches reusable patterns, image is the showcase example).
- Vue/Svelte components (one-line "same classes" note only).
- Build tooling / npm package (copy-paste assets only).
- Tier C morphing only: continuous liquid *refraction* flowing through a merge (shader-grade) — needs WebGL/Canvas; one-paragraph pointer to a separate skill. (Tier A matched-geometry + Tier B gooey merge are IN scope — see Morphing section.)
