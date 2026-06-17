# Fidelity levels — L1 / L2 / L3 deep dive

The single most common glassmorphism failure is treating glass as **one property** — a lone `backdrop-filter: blur()`. Real glass is a **stack of ~6 optical layers**, and the three fidelity levels in this skill are simply *how many of those layers you switch on*:

| Layer | What it does | L1 | L2 | L3 |
|---|---|:--:|:--:|:--:|
| 1 backdrop (blur + saturate) | frosts + enriches what's behind | ● | ● | ● + refraction |
| 2 body tint | gives the pane a colour/material | ● flat | ● top-lit gradient | ● top-lit gradient |
| 3 rim / edge | catches light along the border | ● hairline | ● + inner highlight | ● + inner highlight |
| 4 specular highlight | the diagonal sheen on the surface | — | ● `::before` | ● `::before` |
| 5 inner depth | inner bottom shadow → thickness | — | ● | ● |
| 6 elevation | outer shadow → floats off the page | ● | ● | ● |
| + travelling sheen | animated lensing glint | — | — | ● `::after` (motion-gated) |

The classes **stack** — each level builds on the one below it:

```html
<div class="glass">…</div>                          <!-- L1 -->
<div class="glass glass--l2">…</div>                 <!-- L2 -->
<div class="glass glass--l2 glass--l3">…</div>       <!-- L3 -->
```

You almost never want `glass--l3` without `glass--l2` — L3 only adds the refraction filter and the travelling glint; it relies on L2 for the gradient body, the inner highlight, and the static sheen. The canonical material lives in [`assets/glass.css`](../assets/glass.css); this doc quotes it rule-for-rule and explains *why* each piece is there.

---

## L1 — baseline (layers 1, 2, 3, 6)

L1 is the production-safe floor: it ships everywhere, reads on any backdrop, and never traps a user on unreadable text. It is built **fallback-first** — a legible solid-ish panel is the base rule, and `@supports` *upgrades* it to true translucency only where the browser can actually blur. That ordering is the key robustness move; see [Fallback chain](#the-fallback-chain-fallback-first-not-feature-then-patch) below.

From `assets/glass.css`:

```css
.glass {
  position: relative;
  isolation: isolate;

  /* Fallback: opaque-enough tint (0.6 alpha) keeps content legible with no blur. */
  background: rgb(var(--glass-tint) / 0.6);

  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  box-shadow: var(--glass-shadow);
}

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass {
    background: var(--glass-fill);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
    backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  }
}
```

What each line is doing, by optical layer:

- **`position: relative; isolation: isolate;`** — *not decorative; load-bearing.* `position: relative` anchors the absolutely-positioned `::before`/`::after` pseudos that L2/L3/interactive paint the sheen on (`inset: 0` resolves against this element). `isolation: isolate` forces a new stacking context so the `z-index: -1` pseudos sit *behind the content but above the backdrop* and never escape to bleed over siblings. Drop either and the sheen mis-anchors or vanishes — this is the most-forgotten line in hand-rolled glass.
- **Layer 2 — body tint.** The base `background: rgb(var(--glass-tint) / 0.6)` is the *fallback* fill: at 0.6 alpha it is opaque enough to keep text legible even with zero blur. Inside `@supports` it swaps to `var(--glass-fill)` — which is `rgb(var(--glass-tint) / var(--glass-tint-opacity))`, i.e. 0.08 alpha — because once the blur is doing the frosting, you *want* the pane thin and see-through.
- **Layer 3 — rim.** `border: 1px solid var(--glass-border)` is the hairline edge. At L1 it is a single flat line; L2 adds the light-catching inner highlight on top.
- **Layer 6 — elevation.** `box-shadow: var(--glass-shadow)` (`0 12px 40px rgb(0 0 0 / 0.45)`) lifts the pane off the page so it reads as floating glass, not a painted rectangle.
- **Layer 1 — backdrop.** `backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate))` is the frost. The `saturate(140%)` is the unsung half of the pairing: blur alone produces flat grey mush, but pushing saturation makes the colours bleeding through the glass feel *richer*, the way real frosted glass intensifies what's behind it. **`-webkit-backdrop-filter` is listed first and the standard property second** — Safari (desktop and iOS) shipped the prefixed form long before un-prefixing, so you always write both, prefix first.

> **Always pair `-webkit-backdrop-filter` with `backdrop-filter`.** Every single place this skill applies a backdrop filter writes both lines. Forget the `-webkit-` prefix and your glass is invisible on Safari/iOS — which is exactly the audience most likely to expect the Apple look.

### Common `backdrop-filter` footguns

`backdrop-filter` "silently doing nothing" is almost always one of these four. They bite even when your CSS is otherwise correct, so check them first when a pane frosts in one place and goes flat in another:

1. **`transform`, `will-change`, or `filter` on the *same* element can break or no-op `backdrop-filter`.** A non-`none` `transform`/`filter`/`perspective` (or a `will-change` naming any of them) on the glass element itself promotes it in ways that, in some engines, make the backdrop sample wrong or drop entirely — the exact behaviour is engine-specific and not worth memorising. Rule of thumb: keep `transform`/`filter` off the glass element and put them on a *wrapper* instead. This is why the interactive tilt in this skill animates a child/pseudo, not the `.glass` box.
2. **An ancestor can flatten the effect.** `backdrop-filter` samples the backdrop *up to the nearest stacking/grouping boundary*. An ancestor with `opacity` < 1, a `filter`, its *own* `backdrop-filter`, `mix-blend-mode`, `isolation: isolate`, `contain: paint`, or `will-change` creates a group that the child cannot reach past — so the glass blurs an empty/clipped region or nothing at all. If your glass works standalone but dies inside a parent, audit the ancestor chain for these properties first.
3. **Glass needs a non-flat ambient backdrop to refract.** There must be *something* behind the pane worth blurring — imagery, a gradient, overlapping content, scrolling text. Over a single flat fill, `blur()` + `saturate()` have nothing to work with and L3's displacement has no edges to bend, so the surface reads as a plain tinted rectangle no matter how correct the CSS is. The material is only as convincing as what sits behind it.
4. **`-webkit-backdrop-filter` must precede the unprefixed declaration.** Same line as the prefix rule above — write the `-webkit-` line *first*, the standard line second, so the prefixed form wins on the long tail of older Safari/iOS where it's required. Every backdrop rule in this skill, at every level (`glass`, `glass--l3`), follows this order.

These are the *mechanics* of why a backdrop filter no-ops; for the a11y/perf consequences — `prefers-reduced-transparency`, the solid fallbacks, and the compositing cost of blurring a large or animated region — see [`fallbacks-a11y.md`](./fallbacks-a11y.md).

---

## L2 — specular / "liquid" (adds layers 4 + 5 + gradient body + sheen)

L2 is where a flat frosted rectangle becomes *liquid*. It is pure CSS, fully cross-browser, and has no `url()` filter — so it works identically in Chrome, Safari, and Firefox. It does three things on top of L1: replaces the flat fill with a top-lit gradient (layer 2 upgraded), adds an inner top highlight + inner bottom shadow (layers 4 + 5, giving the pane *thickness*), and paints a diagonal sheen on a non-interactive pseudo.

From `assets/glass.css`:

```css
.glass--l2 {
  /* layer 2 upgraded: top-lit gradient instead of a flat fill */
  background: linear-gradient(
    135deg,
    rgb(var(--glass-tint) / 0.15),
    rgb(var(--glass-tint) / 0.04)
  );

  /* layer 6 elevation + layer 4 inner top highlight + layer 5 inner bottom depth */
  box-shadow:
    var(--glass-shadow),
    inset 0 1px 0 var(--glass-highlight),
    inset 0 -8px 22px var(--glass-inner-shadow);
}

.glass--l2::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;                 /* sit behind content, above the backdrop */
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(158deg, var(--glass-highlight), transparent 36%);
  opacity: 0.55;
}
```

Reading it layer by layer:

- **Layer 2, upgraded** — the flat fill becomes a `135deg` gradient from a brighter tint (`/ 0.15`) at the top-left to a fainter one (`/ 0.04`) at the bottom-right. This is *top-lighting*: glass lit from above is brighter where the light hits it. Both stops are driven off the *same* `--glass-tint` channel-trick value, so re-tinting the whole pane is one variable change.
- **The three-part `box-shadow` is the heart of L2.** A single `box-shadow` property stacks three shadows:
  - `var(--glass-shadow)` — the outer elevation (layer 6), re-stated because setting `box-shadow` replaces L1's.
  - `inset 0 1px 0 var(--glass-highlight)` — a 1px-tall inner light line along the **top** edge (layer 4). This is the "lit top rim" — the bright catch you see on the upper edge of real glass.
  - `inset 0 -8px 22px var(--glass-inner-shadow)` — a soft inner shadow rising from the **bottom** edge (layer 5). This reads as the *underside* of the material in shadow, which is what gives the pane apparent thickness rather than looking like a decal.
- **`::before` sheen (layer 4).** A `158deg` gradient from `--glass-highlight` fading to `transparent 36%` lays a soft diagonal glare across the upper portion. It lives on a pseudo-element with `pointer-events: none` so it **never intercepts clicks**, and `z-index: -1` keeps it behind your content. `border-radius: inherit` makes the sheen follow rounded corners instead of square-cropping. `inset: 0` covers the whole pane; the gradient itself is what limits the glare to the top third.

> Why a `::before` instead of just another gradient in `background`? Because the body already *is* a gradient, and because the sheen needs to sit at a specific z-layer (behind text, above the frosted backdrop) and be independently dimmable. Pseudo-elements give you a free extra paint layer with its own opacity, blend mode, and stacking position.

L2 is the level you should reach for **by default** for cards, modals, and any hero surface. It looks like real glass and costs nothing exotic.

---

## L3 — refraction / lensing (adds real backdrop displacement + animated glint)

L3 is the showpiece: it bends the pixels *behind* the pane through an SVG displacement map, so straight lines in the background warp as if seen through a real lens, plus a slow travelling glint sweeps the surface. It is also the level with real caveats — it is Chromium-leaning and has genuine compositing cost. Reserve it for **one or two hero panels**, never every card.

From `assets/glass.css`:

```css
.glass--l3 {
  -webkit-backdrop-filter: blur(3px) saturate(180%) url(#glass-refract);
  backdrop-filter: blur(3px) saturate(180%) url(#glass-refract);
}

.glass--l3::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 0%,
    var(--glass-highlight) 45%,
    transparent 60%
  );
  background-size: 220% 220%;
  background-position: 0% 50%;
  opacity: 0.35;
  mix-blend-mode: screen;
}

@media (prefers-reduced-motion: no-preference) {
  .glass--l3::after {
    animation: glass-sheen 7s ease-in-out infinite;
  }
  @keyframes glass-sheen {
    0%,
    100% { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
  }
}
```

- **The backdrop filter chains `url(#glass-refract)` after the blur.** A `backdrop-filter` is a filter *list* — `blur(3px) saturate(180%) url(#glass-refract)` runs blur, then saturation boost, then the SVG displacement, in order. Note the blur drops to `3px` here (vs 16px at L1): the displacement is what sells the glass now, so you want the backdrop sharp enough that the *warping* is visible. The displacement reads `in="SourceGraphic"` — at the `backdrop-filter` stage, the "source" is the rendered backdrop behind the element, so it's the **page behind the glass** that gets warped, not the glass's own content.
- **The `::after` is the travelling glint** (distinct from L2's static `::before` sheen — an L3 pane has *both*). A `115deg` gradient with a bright band at 45% is painted onto an oversized `220% 220%` canvas, then the keyframes slide `background-position` from `0%` to `100%` and back, dragging the glint diagonally across the surface over 7s. `mix-blend-mode: screen` makes the glint *add* light rather than paint over content, so it glances rather than smears.
- **Motion is opt-in.** The `animation` lives inside `@media (prefers-reduced-motion: no-preference)` — the static glint still shows for users who asked for stillness, it just doesn't sweep. Never animate glass for someone who set reduced-motion.

### The `#glass-refract` filter — feTurbulence + feDisplacementMap

The refraction is an inline SVG filter you mount **once per document** (in `assets/demo.html`, or via `<GlassFilter id="glass-refract" />` in React). It is two primitives:

```html
<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <filter id="glass-refract" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency=".009 .013"
                  numOctaves="2" seed="9" result="noise"/>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="32"
                       xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>
```

How it works, primitive by primitive:

1. **`feTurbulence`** generates a procedural noise texture (Perlin-style) — a smooth, organic field of pseudo-random values across R/G/B/A channels. The parameters are the whole personality of the lens:
   - `type="fractalNoise"` — smooth, cloud-like noise (the alternative, `turbulence`, is sharper/veinier and reads as cracked glass, not a clean lens).
   - `baseFrequency=".009 .013"` — the *scale* of the noise. Low values = large, gentle undulations (a smooth lens); high values = tight, busy ripples (frosted/pebbled glass). The two numbers are X and Y frequency — slightly different so the warp isn't perfectly isotropic, which looks more like real glass. **This is the dial you tune most.**
   - `numOctaves="2"` — how many layers of noise stack. More octaves = more fine detail (and more cost); 1–2 is plenty for glass.
   - `seed="9"` — fixes the random pattern so it's stable across reloads (and identical between SSR and client — important for React hydration; see [`react.md`](./react.md)).
   - `result="noise"` — names this output so the next primitive can reference it.
2. **`feDisplacementMap`** is the lens. It takes `in="SourceGraphic"` (the backdrop pixels) and *moves each pixel* by an amount read from the `in2="noise"` texture:
   - `xChannelSelector="R" yChannelSelector="G"` — read the **R**ed channel of the noise to decide horizontal displacement, the **G**reen channel for vertical. Because the noise is smooth, neighbouring pixels shift by similar amounts, so the backdrop *warps* coherently instead of scattering.
   - `scale="32"` — the **maximum displacement in pixels**. This is the strength of the lens. `scale="0"` = no refraction; `32` is a strong, obvious bend; push past ~50 and the warp turns into smeary chaos. This is the second dial you'll tune.

The `x/y/width/height="-20%/140%"` on the `<filter>` enlarges the filter region so displaced pixels near the edges aren't clipped — without it, the warp gets a hard rectangular crop at the pane's border.

> **Tuning cheat-sheet:** want a *subtle* lens → lower `scale` (12–20) and lower `baseFrequency` (.004–.008). Want *pebbled/shower-glass* → raise `baseFrequency` (.02+). Want *more violent bending* → raise `scale`. Keep `numOctaves` at 1–2 unless you have a measured perf budget.

---

## Gradient-rim techniques (advanced layer 3)

L1's `border: 1px solid var(--glass-border)` is a *flat* rim — uniform colour all the way round. Real glass edges catch light unevenly: bright where light hits, dim in shadow. Two techniques give you a **gradient rim** that varies around the edge. Neither is in the base `.glass` (a flat hairline is the safe default), but both are the natural next step when you want a premium edge on a hero card.

### Technique 1 — `border-image` with a gradient

`border-image` paints a gradient *into* the border box. The catch most people hit: `border-image` and `border-radius` **don't combine** — a gradient `border-image` squares off your rounded corners. So this technique is for square-ish panels, or you accept the corner trade-off:

```css
.glass-rim-borderimage {
  border: 1px solid transparent;            /* width + a fallback colour */
  border-image: linear-gradient(
    135deg,
    rgb(var(--glass-tint) / 0.6),           /* bright top-left catch */
    rgb(var(--glass-tint) / 0.05) 40%,      /* fade to nearly nothing */
    rgb(0 0 0 / 0.2)                         /* dark bottom-right shadow */
  ) 1;                                       /* the trailing 1 = slice */
}
```

The gradient runs the same `135deg` as the body's top-lighting, so the bright corner of the rim aligns with the bright corner of the pane — they read as one lit object.

### Technique 2 — masked `::after` ring (keeps rounded corners)

The robust way to get a gradient rim that **respects `border-radius`** is a pseudo-element filled with a gradient, then *masked* so only a 1px ring at the edge shows. The mask is the trick: two stacked backgrounds (one clipped to the content box, one to the border box) composited with `xor`/`exclude` cut out the interior and leave just the frame:

```css
.glass-rim-masked {
  position: relative;          /* (.glass already sets this) */
}
.glass-rim-masked::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;      /* follows the pane's rounded corners */
  padding: 1px;                /* the rim thickness */
  pointer-events: none;

  /* the gradient that the rim will show */
  background: linear-gradient(
    135deg,
    rgb(var(--glass-tint) / 0.7),
    rgb(var(--glass-tint) / 0.04) 45%,
    rgb(0 0 0 / 0.25)
  );

  /* mask out the interior: keep only the 1px padded frame */
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;            /* Safari spelling */
          mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
          mask-composite: exclude;        /* standard spelling */
}
```

This is the same "1px gradient frame" recipe used widely for modern card borders. It keeps perfectly rounded corners and lets the rim brighten in one corner and darken in the opposite — the most convincing edge of the three. Note again that **`-webkit-mask-composite` uses `xor` while the standard `mask-composite` uses `exclude`** — you write both, just like the backdrop-filter prefix pairing.

---

## Browser-support matrix

What actually ships, and what each level needs (as of mid-2026, current evergreen browsers):

| Feature | Chrome / Edge | Safari (desktop + iOS) | Firefox | Used by |
|---|---|---|---|---|
| `backdrop-filter: blur() saturate()` | ✅ since 76 | ✅ **prefixed** `-webkit-` since 9; un-prefixed since 18 | ✅ since 103 | **L1** (the base material) |
| `-webkit-backdrop-filter` (the prefix) | ✅ (alias) | ✅ **required** on older iOS | ✅ (alias) | every backdrop rule |
| `linear-gradient` body + `inset` `box-shadow` + pseudo sheen | ✅ | ✅ | ✅ | **L2** (no caveats) |
| `@property` (typed custom props) | ✅ since 85 | ✅ since 16.4 | ✅ since 128 | `.glass--interactive` (the `--mx/--my` easing) |
| `backdrop-filter: url(#filter)` | ✅ (Chromium honours SVG filters in `backdrop-filter`) | ⚠️ **ignores the `url()`** — applies the blur/saturate, silently drops the displacement | ⚠️ **ignores the `url()`** likewise | **L3** refraction |
| SVG `feTurbulence` + `feDisplacementMap` (as a normal `filter:`) | ✅ | ✅ | ✅ | `#glass-goo` Tier B, and any *non-backdrop* use |
| `@supports (...)` feature query | ✅ | ✅ | ✅ | the whole fallback-first scheme |
| `prefers-reduced-motion` / `-reduced-transparency` / `prefers-contrast` | ✅ | ✅ (`reduced-transparency` maps to "Reduce Transparency") | ✅ (`reduced-transparency` support is partial) | a11y guards |

Two rows carry the only real gotchas:

- **`backdrop-filter: url()` is Chromium-leaning.** Chrome/Edge composite the SVG displacement against the live backdrop. Safari and Firefox parse the value, apply the `blur(3px) saturate(180%)` part, and **silently ignore the `url(#glass-refract)`** — there is no error, the pane just doesn't warp. This is *by design* in this skill (see degradation below), not a bug to fix.
- **Always-prefix `backdrop-filter`.** Even though current Safari un-prefixes, the prefixed property is still required for the long tail of iOS versions in the wild, and writing both costs nothing.

> Note the asymmetry: SVG filters (`feDisplacementMap`, `feGaussianBlur`) work *everywhere* when applied via the normal `filter:` property — that's why the Tier B gooey merge (`#glass-goo`, used as `filter: url(#glass-goo)`) is broadly supported, while L3 refraction (the *same kind* of filter via `backdrop-filter: url()`) is Chromium-only. The difference is `backdrop-filter`-plus-`url()`, not SVG filters themselves.

---

## The fallback chain (fallback-first, not feature-then-patch)

The robustness backbone of this whole system is **authoring the safe state as the default and *enhancing upward*** — the opposite of writing the fancy version and patching the failures.

```
┌─ no backdrop-filter at all (ancient/locked-down browser, reduced-transparency)
│     → .glass base rule: background: rgb(var(--glass-tint) / 0.6)
│        a LEGIBLE solid-ish panel. Text is readable. Nothing is broken.
│
├─ backdrop-filter supported (the @supports block fires)
│     → swaps to the thin --glass-fill (0.08 alpha) + blur + saturate
│        = real L1 frosted glass.
│
├─ + .glass--l2
│     → gradient body, inner highlight, inner depth, static sheen
│        = L2 liquid glass. (Works in every evergreen browser.)
│
└─ + .glass--l3
      → adds backdrop-filter: url(#glass-refract) + travelling glint
         = L3 refraction *in Chromium*; *gracefully L2 elsewhere* (see below).
```

Why fallback-first beats the naive order:

```css
/* ❌ NAIVE — fancy first, no floor. If backdrop-filter is unsupported you get
   white text on near-transparent background: unreadable. */
.card {
  background: rgb(255 255 255 / 0.08);
  backdrop-filter: blur(16px);
}

/* ✅ THIS SKILL — solid floor first, enhance only when proven supported. */
.glass { background: rgb(var(--glass-tint) / 0.6); }   /* readable always */
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: var(--glass-fill); backdrop-filter: blur(var(--glass-blur)) … ; }
}
```

The `@supports` query tests **both** the prefixed and un-prefixed property with `or`, so it fires on any browser that can blur the backdrop by either spelling — and *only* then does the fill thin out to 0.08. A browser that fails the query keeps the 0.6-alpha solid panel and stays legible. The failure mode of glass is *unreadable content*, and fallback-first is what guarantees that never happens.

---

## L3 graceful degradation to L2

L3's degradation is the same fallback-first idea applied to one feature — and it is **automatic**, not something you wire up:

- A pane marked `class="glass glass--l2 glass--l3"` already carries the full L2 material — gradient body, inner highlight, inner depth, static sheen — because those classes stack.
- L3 *adds* exactly two things: the `url(#glass-refract)` term on the backdrop filter, and the travelling `::after` glint.
- In **Safari/Firefox**, the browser keeps the `blur(3px) saturate(180%)` part of L3's backdrop filter and **drops only the `url()`**. So the pane still frosts — it just doesn't warp. Combined with the L2 layers underneath, it reads as a clean L2-grade glass panel. **No breakage, no blank pane, no JS detection needed.**
- The travelling glint (`::after`) is plain CSS/SVG-free and works everywhere; only the *refractive warp* is Chromium-exclusive.

So the practical rule is: **always author L3 as `glass glass--l2 glass--l3`.** That gives Chromium the lens and gives everyone else a polished L2 fallback for free. If you ever need to *force* the L2 look (e.g. you measured the L3 composite as too costly on a mobile target), simply omit `glass--l3` — the same markup minus one class.

> Want to confirm which path a given browser took? In Chromium the background visibly bends behind the pane; in Safari/Firefox the background is frosted but straight. There's no console warning either way — the `url()` is dropped silently, which is exactly why this degradation is safe to ship.

---

## See also

- [`assets/glass.css`](../assets/glass.css) — the canonical material these levels are quoted from.
- [`components.md`](./components.md) — the 5 components (card, button, nav, pill/badge, modal) that compose these levels with their own geometry.
- [`tailwind-v4.md`](./tailwind-v4.md) — the `@theme`/`@utility` mirror of L1, plus the `[backdrop-filter:…url(#glass-refract)]` arbitrary-value note for L3 in Tailwind.
- [`react.md`](./react.md) — `<GlassFilter id="glass-refract" />` mounts the L3 displacement defs once, SSR-safe with a stable `seed`.
- [`fallbacks-a11y.md`](./fallbacks-a11y.md) — the `@supports` patterns and the `prefers-reduced-*` / `prefers-contrast` solid fallbacks that sit underneath every level.
- [`morphing.md`](./morphing.md) — Tier B's `#glass-goo` filter (the same `feGaussianBlur`/`feColorMatrix` family, applied via a normal `filter:` so it works cross-browser).
