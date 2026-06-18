# Morphing glass — the web port of iOS `glassEffectID`

This is the web counterpart to iOS Liquid Glass's matched-geometry morphing: SwiftUI's
`GlassEffectContainer` + `@Namespace` + `.glassEffectID(_:in:)`, where a glass shape
*flows* from one position/size into another instead of cross-fading. (See the sibling iOS
skill `liquid-glass-design` for the native side.)

**The one idea to keep straight:** the glass **material never morphs.** The blur, tint,
specular, and rim defined in `assets/glass.css` are constant. What morphs is the **shape and
position the material rides on** — a rectangle becomes a pill, a pill slides across the bar,
two blobs fuse. You animate geometry; the glass just keeps painting itself onto whatever
silhouette you hand it. Everything here puts the `.glass` classes on a moving box and moves
the box. None of it re-implements the look — that would break the DRY contract
(`glass.css` is the single source of truth).

Three techniques, descending in safety:

| Technique | Effect | Tech | Ship it? |
|---|---|---|---|
| **Matched-geometry morph** | Matched-geometry: one glass element flows between two states/positions | framer-motion `layoutId` (React) or vanilla FLIP | Yes — production-safe, the direct `glassEffectID` analog |
| **Gooey merge** | Gooey merge/split: two glass blobs fuse like mercury | SVG gooey filter (`#glass-goo`) + `backdrop-filter` via mask | Advanced — works but finicky; read the caveats |
| **Shader morph** | Continuous liquid *refraction* deforming through the fuse | WebGL / Canvas shaders | Out of scope — pointer only, no impl below |

---

## Matched-geometry morph

A single conceptual element that exists in two layouts (collapsed/expanded, tab A/tab B,
docked/floating) and *tweens* between them: position, size, and corner radius animate
continuously while the glass material is carried along for the ride. This is the move you reach
for ~90% of the time, and it has a robust, GPU-friendly implementation in both React and vanilla.

> **⚠️ Correctness — never `transform`/`scale` the element that carries `backdrop-filter`.**
> Animating `transform` (translate/scale) on an element that *itself* has `backdrop-filter` breaks
> the effect in several engines: a transformed element establishes a new containing block, so the
> backdrop it samples shifts (or disappears) mid-tween, and some browsers drop the backdrop blur
> entirely while a transform is active. **Morph a WRAPPER element and keep `backdrop-filter` on a
> static inner `.glass` element** — the wrapper moves/scales, the glass inside stays put relative to
> it and keeps sampling cleanly. If you can't split the layers, accept the engine-specific behavior
> (a brief backdrop shift or drop) as the cost. This applies to both the framer-motion and the
> vanilla-FLIP paths below.

### A1 — React (primary): framer-motion `layoutId`

`framer-motion` is the cleanest `glassEffectID` analog on the web. Two elements that share the
same `layoutId` are treated as **the same element across renders** — when one unmounts and the
other mounts (or they re-order), framer-motion measures both boxes and runs a layout (FLIP)
animation between them. Put the glass `className` on a `motion.div` and the glass tweens for free.

> **framer-motion is an optional peer dependency.** The core `liquid-glass-css` assets
> (`glass.css`, `Glass.tsx`) never import it — it is shown here **by example only**. Install it
> *only* if you want this effect: `npm i framer-motion`. The glass works without it; the morph
> is the sugar on top.

```tsx
import { useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';

/**
 * A glass selection indicator that flows between tabs — the web `glassEffectID`.
 * Only ONE `.glass` pill exists at a time; `layoutId` makes framer-motion tween
 * it from the old tab's box to the new tab's box. The material is untouched.
 */
const TABS = ['Overview', 'Activity', 'Billing'] as const;

export function GlassTabs() {
  const [active, setActive] = useState<(typeof TABS)[number]>('Overview');

  return (
    // LayoutGroup scopes the shared layoutId — analogous to iOS @Namespace / GlassEffectContainer.
    <LayoutGroup id="glass-tabs">
      <div style={{ display: 'inline-flex', gap: 4, position: 'relative' }}>
        {TABS.map((tab) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              style={{ position: 'relative', padding: '8px 16px', background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }}
            >
              {/* The glass rides on this motion.div. Render it ONLY for the active tab;
                  the shared layoutId makes it slide+resize from the previous tab. */}
              {isActive && (
                <motion.span
                  layoutId="glass-tab-indicator"
                  className="glass glass--l2"
                  style={{ position: 'absolute', inset: 0, borderRadius: 'var(--glass-radius)' }}
                  // framer-motion's layout spring; tune to taste. This animates the BOX,
                  // not the material — blur/tint/specular stay constant the whole time.
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                  aria-hidden="true"
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{tab}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
```

Why this is the direct `glassEffectID` port:

- **`layoutId` ≡ `glassEffectID(_:in:)`** — a stable identity that ties two visual states into
  one morphing element.
- **`<LayoutGroup>` ≡ `@Namespace` / `GlassEffectContainer`** — scopes which elements can morph
  into each other and (in framer-motion's case) coordinates their measurement pass.
- **The spring `transition` ≡ `withAnimation`** — the timing curve the shape flows along.

Other shapes the same pattern covers:

- **Expand/collapse a card** — render a small `motion.div.glass.glass-card` with `layoutId="panel"`
  in the grid, and a large one with the same `layoutId` in the detail view. Toggling which is
  mounted makes the glass card *grow* into place.
- **Dock ↔ float a toolbar** — one `layoutId` on a `.glass.glass-nav`, conditionally placed in
  two containers.
- **FLIP-on-reorder** — give list items `layout` (not even `layoutId`) and framer-motion animates
  their glass boxes when the array re-sorts.

**Reduced motion:** framer-motion respects `prefers-reduced-motion` when you wrap the tree in
`<MotionConfig reducedMotion="user">`, which downgrades layout animations to instant cuts. Do
this at the app root so the morph honors the same user preference `glass.css` already honors for
sheen and pointer specular.

**`layout` vs `layoutId`:** use `layout` when the *same mounted element* changes size/position
(it animates its own box across renders); use `layoutId` when *different elements* should be
treated as one (the cross-fade-free hand-off shown above). The tab indicator needs `layoutId`
because a different `<button>` owns the indicator each time.

### A2 — Vanilla: the FLIP technique

No framer-motion, no React? You can do matched-geometry by hand with **FLIP — First, Last,
Invert, Play.** It is exactly what framer-motion does under the hood, and it's the canonical way
to animate layout changes (which are otherwise not directly transition-able) at 60fps using only
GPU-cheap `transform`.

The four beats:

1. **First** — measure the element's box *before* the change (`getBoundingClientRect()`).
2. **Last** — apply the DOM/layout change, then measure the box *after*.
3. **Invert** — compute the delta and apply an inverse `transform` so the element *appears* to
   still be in its First spot (no visual jump yet).
4. **Play** — on the next frame, transition the transform back to identity. The element glides
   from First to Last.

Because only `transform` (and optionally `opacity`) animate, the browser never relayouts mid-flight
and the glass material rides along untouched.

```js
/**
 * flip(el, mutate) — animate a glass element through a layout change with FLIP.
 *
 *   flip(pill, () => otherSlot.appendChild(pill));   // moves pill; glass glides there
 *
 * @param {HTMLElement} el       the element whose box should morph (carries .glass)
 * @param {() => void}  mutate   the DOM change that alters el's position/size (move, resize, reparent)
 * @param {{ duration?: number, easing?: string }} [opts]
 * @returns {Animation | undefined}  the WAAPI Animation, or undefined if motion is reduced
 */
function flip(el, mutate, { duration = 320, easing = 'cubic-bezier(.2,.8,.2,1)' } = {}) {
  // Honor the same preference glass.css uses to gate sheen/pointer specular.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // FIRST — box before the change.
  const first = el.getBoundingClientRect();

  // (LAST) — let the caller change the layout (reparent, add a class, resize…).
  mutate();

  if (reduce) return; // reduced motion: just take the new layout, no animation.

  // LAST — box after the change.
  const last = el.getBoundingClientRect();

  // INVERT — deltas that map Last back onto First.
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;

  // No meaningful change? Skip (avoids a 1px jitter animation).
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) {
    return;
  }

  // PLAY — start inverted (looks like it never moved), then transition to identity.
  // transform-origin top-left so the scale math composes cleanly with the translate.
  return el.animate(
    [
      { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transformOrigin: 'top left', transform: 'translate(0, 0) scale(1, 1)' },
    ],
    { duration, easing, fill: 'both' }
  );
}
```

Wiring a "slide the glass pill between two slots" toggle (this is what `assets/demo.html`'s
matched-geometry toggle does):

```html
<div id="slot-a"><span id="pill" class="glass glass--l2 glass-pill">Live</span></div>
<div id="slot-b"></div>
<button id="toggle">Move</button>

<script>
  const pill = document.getElementById('pill');
  const slotA = document.getElementById('slot-a');
  const slotB = document.getElementById('slot-b');

  document.getElementById('toggle').addEventListener('click', () => {
    const dest = pill.parentElement === slotA ? slotB : slotA;
    flip(pill, () => dest.appendChild(pill)); // glass glides slot→slot, material constant
  });
</script>
```

**FLIP gotchas:**

- **Border-radius is a `transform: scale` casualty.** Scaling a box distorts a uniform
  `border-radius` (it ovalizes during the tween). For pill/badge morphs whose radius is already
  `999px` this is invisible; for a square card growing to a rectangle it's noticeable. Fixes, in
  order of effort: animate *position only* (reparent without size change), keep the radius small
  relative to the box, or step up to framer-motion (which corrects radius distortion via its
  `borderRadius` layout handling).
- **`transform` creates a stacking context / can clip `backdrop-filter`.** A transformed ancestor
  becomes the containing block for `backdrop-filter`, which changes *what the glass samples* mid-
  animation (it samples within the transformed subtree, not the page). Usually fine for a quick
  tween; if the glass looks like it "loses" its backdrop while moving, animate a wrapper and keep
  the `.glass` element's own transform untouched, or accept the brief sample shift.
- **Measure-mutate-measure must be synchronous.** Don't `await` between First and Last or the user
  will see the un-animated jump. The helper above keeps all four beats in one synchronous call,
  deferring only the Play to WAAPI.

---

## Gooey merge / split (advanced)

The signature Liquid Glass flourish: two separate glass blobs drift together and **fuse into one
continuous silhouette** — like two mercury droplets touching — then split apart again. iOS gets
this from `GlassEffectContainer`'s `spacing`, which lets sibling glass shapes coalesce. On the web
we fake it with an **SVG gooey filter**.

> **⚠️ LOUD CAVEAT — this is the finicky one.** Composing an SVG `filter` with `backdrop-filter`
> is the single hardest thing in this skill, and browser behavior is uneven. Ship it for a *hero*
> moment (one place, deliberately), never as a default interaction. Read every caveat below before
> committing to it. If you just need shapes to flow into each other, **the matched-geometry morph is
> the right tool** — reach for the gooey merge only when you specifically want the *fuse*.

### How the gooey filter works

The trick is three SVG primitives in sequence (this is the `#glass-goo` filter that `glass.css`'s
`.glass-goo` container references; you mount its defs once per document — see `assets/demo.html`
and `<GlassFilter>`):

1. **`feGaussianBlur`** blurs the shapes' alpha so their soft edges *overlap* in the gap between
   them — bleeding into one fuzzy region where they're close.
2. **`feColorMatrix`** (`type="matrix"`) cranks the alpha channel through a steep ramp: it multiplies
   alpha way up (`19`) and subtracts a large constant (`-9`), so the fuzzy mid-alpha halo snaps to
   either fully-opaque (where two blurs overlapped enough) or fully-transparent (where they didn't).
   The result is a single hard-edged silhouette wherever blobs were close, with the characteristic
   "necking" bridge between them — the gooey look.
3. **`feComposite`** (`operator="atop"`) paints the original crisp shapes back over the fused mask
   so the insides stay sharp and only the silhouette/bridge reads as gooey.

```html
<!-- Mount ONCE per document. This is the #glass-goo referenced by .glass-goo in glass.css. -->
<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <defs>
<filter id="glass-goo">
  <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"/>
  <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo"/>
  <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
</filter>
  </defs>
</svg>
```

Tune `stdDeviation` (bigger = blobs fuse from farther apart, softer neck) and the `19 / -9` alpha
ramp (steeper = harder edge) together — they trade off.

### Composing it with the glass material

`feGaussianBlur`→`feColorMatrix` operates on the element's **own painted pixels** (`SourceGraphic`),
not on the backdrop. So the gooey filter shapes the **silhouette**; you then need the glass
`backdrop-filter` to fill that silhouette. There are two ways, and which works depends on the
browser:

**Approach 1 — gooey filter on a container of solid blobs, glass on top via mask (most robust).**
Put `filter: url(#glass-goo)` on a container (`.glass-goo`) holding solid-colored child blobs;
this produces the fused silhouette. Then render a single `.glass` layer above it and clip it to the
fused shape with `mask` (using the same blobs as the mask source) or `clip-path`. The glass samples
the real page backdrop; the goo only decides *where* the glass is visible.

```html
<div class="goo-stage">
  <!-- Layer 1: the fused SILHOUETTE (solid blobs through the gooey filter). -->
  <div class="glass-goo silhouette">
    <span class="blob blob-a"></span>
    <span class="blob blob-b"></span>
  </div>
  <!-- Layer 2: the GLASS, masked to the silhouette so it only shows inside the fused shape. -->
  <div class="glass glass--l2 fused-glass" aria-hidden="true"></div>
</div>
```

```css
.goo-stage { position: relative; width: 320px; height: 160px; }

/* The silhouette layer: solid blobs, fused by #glass-goo. Hidden visually (it's a mask source)
   but still rendered so we can read its shape. */
.silhouette { position: absolute; inset: 0; }
.blob {
  position: absolute; top: 40px; width: 96px; height: 96px; border-radius: 999px;
  background: #fff;                      /* solid — the gooey filter needs opaque alpha to crank */
  transition: transform .5s cubic-bezier(.2,.8,.2,1);
}
.blob-a { left: 40px; }
.blob-b { left: 184px; }
.goo-stage:hover .blob-a { transform: translateX(52px); }  /* drift together → they fuse */
.goo-stage:hover .blob-b { transform: translateX(-52px); }

/* The glass, clipped to the fused silhouette. mask paints the glass only where the goo is opaque.
   NOTE: this re-runs the goo as a mask image; perf-heavy — see caveats. */
.fused-glass {
  position: absolute; inset: 0;
  /* Use the silhouette as a mask. In practice you render the blobs twice (or use an SVG <mask>)
     so the glass shows only inside the fused shape. */
  -webkit-mask: var(--goo-mask) center / contain no-repeat;
  mask: var(--goo-mask) center / contain no-repeat;
}
```

**Approach 2 — `filter` and `backdrop-filter` on the *same* element (simplest, least portable).**
Tempting, but stacking an SVG `filter: url()` and a `backdrop-filter` on one element is exactly
where browsers disagree most: order of operations is under-specified, and the filter can capture the
backdrop result (or not) inconsistently. **Don't rely on it.** If you try it, test in every target
browser and have a matched-geometry fallback ready.

### Gooey merge caveats — read before you ship

- **Compositing is genuinely finicky.** `filter` (the gooey mask) and `backdrop-filter` (the glass)
  are different pipeline stages, and their interaction order isn't consistently specified. Expect to
  iterate per-browser. This is *the* reason the gooey merge is flagged "advanced" rather than "recipe".
- **Performance cost is real and stacked.** You're paying for a full-frame Gaussian blur (the goo)
  **plus** a backdrop blur (the glass) **plus** a mask composite — every animated frame. Keep it to
  one small stage, never a scroll-driven or always-on effect, and never on mobile-first hot paths.
  Pair with `contain: paint` and a fixed-size stage.
- **Solid alpha required for the crank.** The `feColorMatrix` ramp needs opaque source pixels to
  snap. Translucent glass fed *directly* into the goo washes out (mid-alpha never reaches the
  threshold). That's why the robust approach fuses **solid** blobs first, then masks glass to the
  result — don't try to goo the translucent glass itself.
- **Safari & Firefox quirks.** Safari historically clips SVG-filtered content to its bounding box
  (give the stage generous padding or the neck gets cut). Firefox composites the goo fine but, like
  Safari, ignores `backdrop-filter: url(#glass-refract)` (the L3 refraction) — so a gooey L3 panel
  degrades to a gooey L2 panel there, which is acceptable. Test the fuse on all three.
- **`overflow`/`transform` ancestors clip filters.** A `transform`ed or `overflow:hidden` ancestor
  can crop the SVG filter region; keep the gooey stage free of those, or size them with headroom.
- **Accessibility:** the fused shape is decorative — mark the glass/silhouette layers
  `aria-hidden="true"` and keep real content in a normal, un-filtered layer above. Honor
  `prefers-reduced-motion` by not animating the blobs together (skip straight to the merged or split
  resting state).

`assets/demo.html` ships a working, deliberately-scoped gooey-merge toggle so you can see the fuse and
read its perf cost live before adopting it.

---

## Shader morph — continuous liquid refraction through the merge (out of scope)

Matching iOS *exactly* — where the **refraction and specular highlights deform continuously through
the fuse**, so the lensing bends and flows as two blobs become one — is beyond what CSS plus SVG
filters can do well. It needs either an animated `feDisplacementMap` driving the merge frame-by-frame
(janky and expensive, and still won't track the backdrop convincingly) or, properly, a **WebGL/Canvas
shader** that samples the backdrop as a texture and warps it per-pixel along the morphing silhouette.
That is a real-time graphics project — its own GPU pipeline, render loop, and backdrop-capture
strategy — out of all proportion to a CSS skill, and it is **deliberately not implemented here.** If
you truly need shader-grade continuous refraction, treat it as a separate WebGL effort (a regl/Three.js
plane sampling a snapshot of the backdrop, displaced by a signed-distance field of the merging shapes);
this skill stops at the gooey merge and points you there.

---

## See also

- `assets/glass.css` — the source of truth for the material (`.glass`, `.glass-goo`, the tokens) and
  the `#glass-goo` container rule these morphs ride on. **Don't redefine the look here.**
- `assets/demo.html` — live matched-geometry (FLIP) and gooey-merge (gooey fuse) toggles, plus the inline
  `#glass-refract` / `#glass-goo` `<svg>` defs.
- `references/react.md` — `<GlassFilter>`, `useGlassPointer`, and the typed `<GlassCard>` /
  `<GlassButton>` / `<GlassPanel>` / `<GlassModal>` wrappers the matched-geometry React example composes with.
- `references/levels.md` — what L1/L2/L3 add, and why a gooey L3 panel degrades to L2 in Safari/Firefox.
- `references/fallbacks-a11y.md` — the `prefers-reduced-motion` / `prefers-reduced-transparency`
  contract every tier above honors.
- `SKILL.md` — the hub and routing table.
- Sibling iOS skill `liquid-glass-design` — `GlassEffectContainer` + `@Namespace` + `glassEffectID`,
  the native morphing this file ports.
