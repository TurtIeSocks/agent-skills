# Fallbacks, Accessibility & Performance

Glass is a *decorative optical effect*. The moment it makes text unreadable, ignores a
user's stated preference, or melts a mid-range phone's compositor, it has failed — no
matter how good the hero shot looks. This file is the robustness layer of the skill: how
to ship glass that degrades gracefully, respects accessibility preferences, keeps text
legible over a noisy backdrop, and stays cheap to paint.

All of it is already wired into the canonical stylesheet — [`assets/glass.css`](../assets/glass.css)
is the single source of truth. This doc explains *why* each guard exists and how to extend
it; it does not re-invent the look.

> One-line summary: **fallback-first, honour `prefers-*`, keep contrast, don't glass everything.**

---

## 1. `@supports` — fallback-first, never feature-last

The single most common glass bug is writing the *enhanced* declaration as the base and
hoping the browser cooperates:

```css
/* ANTI-PATTERN — feature-last */
.card {
  background: rgb(255 255 255 / 0.08);          /* near-invisible */
  backdrop-filter: blur(16px);                  /* if unsupported... */
}
/* ...the user is left with text floating on 8%-opaque white = unreadable. */
```

When `backdrop-filter` is unsupported (or disabled, or stripped by a privacy extension),
that `0.08` fill does nothing to separate text from whatever is behind it. The page looks
broken precisely where it matters most.

**Fallback-first inverts the order: ship a legible solid-ish panel as the base, then
*upgrade* to real glass only inside an `@supports` block.** From `glass.css`:

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

/* UPGRADE: only when the browser can actually blur the backdrop do we drop to the
   lighter translucent fill and turn on the real material. */
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass {
    background: var(--glass-fill);                                              /* ~0.08 */
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
    backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  }
}
```

Three rules this encodes:

1. **Query *both* prefixes.** Safari only ever shipped `-webkit-backdrop-filter`. A bare
   `@supports (backdrop-filter: blur(1px))` returns `false` on those Safari versions and
   the upgrade never applies — you ship the fallback to the *one browser that actually
   supports the effect*. Always `or` the two:
   `@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))`.

2. **Always pair the two `*-backdrop-filter` declarations**, `-webkit-` first. Every place
   the look applies `backdrop-filter` — `.glass`, `.glass--l3`, `.glass-nav`, `.glass-scrim` —
   pairs it. If you add a new glassy surface, pair it too, or Safari silently drops it.

3. **The fallback must be self-sufficient.** `rgb(var(--glass-tint) / 0.6)` is opaque enough
   that body text on top clears WCAG against a typical page. Don't fall back to the
   translucent `--glass-fill` — that's the thing that needs the blur to be readable.

This is the same chain `.glass-nav` and `.glass-scrim` use: a solid-ish base outside
`@supports`, the blur inside it.

### Tailwind / arbitrary-value note

`backdrop-blur-md` compiles to `backdrop-filter` **without** the `-webkit-` prefix and
**without** an `@supports` guard. On a glass surface that matters, wrap it yourself or use
the `glass` `@utility` from [`tailwind-v4.md`](./tailwind-v4.md), which bakes the
fallback-first chain in. Inline utilities are fine for prototypes; don't ship a primary
nav on a bare `backdrop-blur-*`.

---

## 2. `prefers-reduced-transparency` — give them an opaque panel

Some users (vestibular sensitivity, low vision, plain preference) set the OS "Reduce
Transparency" toggle. Translucent-everything is exactly what they asked the system to stop
doing. Honour it by dropping the blur and solidifying the fill — the layout is identical,
only the material changes:

```css
@media (prefers-reduced-transparency: reduce) {
  .glass, .glass-nav, .glass-scrim, .glass-modal {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;                  /* no see-through, no blur */
  }
  .glass, .glass--l2, .glass-card, .glass-button,
  .glass-pill, .glass-badge, .glass-modal {
    background: rgb(var(--glass-tint) / 0.92);   /* nearly opaque */
  }
  .glass-button--prominent { background: rgb(var(--glass-tint) / 1); }
  .glass-scrim             { background: rgb(0 0 0 / 0.7); }   /* dim, don't frost */
}
```

Because every surface reads the same `--glass-tint`, one opaque value re-skins the whole
system. The component geometry (radius, padding, shadows) is untouched — it still looks
like *your* UI, just solid.

---

## 3. `prefers-reduced-motion` — kill the moving parts

Two glass effects move: the L3 travelling sheen (`.glass--l3::after`, a 7s animation) and
the pointer-tracking specular (`.glass--interactive`, which follows the cursor). Both are
gated:

- **L3 sheen** is defined *inside* `@media (prefers-reduced-motion: no-preference)`, so the
  animation only exists when motion is welcome. The static gradient still renders — you lose
  the travel, not the highlight.
  ```css
  @media (prefers-reduced-motion: no-preference) {
    .glass--l3::after { animation: glass-sheen 7s ease-in-out infinite; }
    @keyframes glass-sheen { 0%,100%{ background-position:0% 50%; } 50%{ background-position:100% 50%; } }
  }
  ```
- **Pointer specular** is hidden entirely when motion is unwelcome:
  ```css
  @media (prefers-reduced-motion: reduce) { .glass--interactive::before { display: none; } }
  ```
  The React `useGlassPointer` hook (see [`react.md`](./react.md)) does the *same* check in JS:
  it reads `matchMedia('(prefers-reduced-motion: reduce)')` and never attaches the
  `pointermove` listener when reduced motion is requested — so it doesn't even pay the
  per-move cost. CSS and JS guard the same thing from both ends.

**Rule:** any new motion you add to glass (a hover tween that travels, a morph, a
shimmer) goes inside `no-preference` or is killed under `reduce`. Default to still.

---

## 4. `prefers-contrast: more` — solid surface, no decoration

High-contrast users need text to sit on a *stable, predictable* surface. Refraction, sheen,
and pointer highlights all reduce the effective text/background contrast and add visual
noise. Under `prefers-contrast: more` we go opaque, firm up the rim, and drop every
decorative pseudo:

```css
@media (prefers-contrast: more) {
  .glass, .glass-nav, .glass-scrim, .glass-modal {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
  .glass, .glass--l2, .glass-card, .glass-button,
  .glass-pill, .glass-badge, .glass-modal {
    background: rgb(var(--glass-tint) / 0.95);
    border-color: currentColor;             /* a rim you can actually see */
  }
  .glass--l2::before, .glass--l3::after, .glass--interactive::before { display: none; }
}
```

`border-color: currentColor` is the key move — a hairline 18%-white rim is invisible in a
high-contrast UA. Tie the border to the text colour and it becomes a real, perceivable edge.

---

## 5. Contrast on glass — keep text readable over a busy backdrop

This is the accessibility failure mode unique to glass, and the one `@supports`/`prefers-*`
*don't* catch: even with full effect support and no special preference, **text on a
translucent panel inherits the contrast of whatever is behind it.** Float white text on a
glass card and slide a bright photo behind it — contrast can swing from 8:1 to 1.5:1 as the
user scrolls. WCAG is computed against the *rendered* pixels, not your fill colour.

Defences, cheapest first — reach for them in this order:

**a) Denser tint behind text.** The simplest, most reliable fix: raise the panel opacity so
content sits on a more stable surface. Bump `--glass-tint-opacity` (or the per-component
fill) on text-bearing panels. A stat card carrying a number wants more body than a
purely-decorative blob. Glass that holds critical text should lean opaque (0.15–0.6),
not gossamer (0.04).

**b) Subtle text-shadow as a contrast floor.** A faint shadow guarantees a minimum
separation from the backdrop even when the panel is light:
```css
.glass-card :is(h1,h2,h3,p,span) {
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.45);   /* dark UI: dark halo lifts light text */
}
```
On a *light* theme invert it (`rgb(255 255 255 / 0.6)`) so the halo lifts dark text. Keep it
subtle — a heavy shadow reads as a bug, and it's a floor, not a substitute for (a).

**c) A scrim layer between backdrop and text.** For text over genuinely high-variance
imagery, drop a low-opacity gradient *inside* the panel, beneath the text, so the worst-case
backdrop never reaches the type. (The `.glass-scrim` pattern does this at full-viewport
scale for modals; the same idea scales down to a single card.)

**d) Don't put critical text on busy areas at all.** The real fix is often layout. Body copy,
form labels, error messages, and anything a user *must* read do not belong floating on a
glass panel over a churning gradient or a hero image. Put them on a denser surface, or move
the glass to chrome (nav, toolbar, badges) and keep reading-surfaces calmer. Glass is
fantastic for *chrome and accents*; it is a poor host for long-form reading.

**Always verify the rendered result**, not the token values: check the actual text against
its *worst-case* backdrop position (scroll the brightest part of the background under the
panel) with a contrast tool. WCAG AA wants 4.5:1 for body text, 3:1 for large text and UI
components. If you can't hold that across the scroll range, the panel needs more tint or the
text needs to move.

---

## 6. Performance — `backdrop-filter` is the expensive one

`backdrop-filter` is not a paint, it's a *recomposite*: the browser must sample everything
behind the element and re-blur it every frame the backdrop changes. It is the single most
expensive thing in this skill. Treat it as a budget.

**Hard rules:**

- **Count limit.** Every live `backdrop-filter` element is its own blur pass. A handful is
  fine; dozens tank scroll performance, badly on mobile and integrated GPUs. If a dashboard
  has 30 glass cards over a *static* background, the blur is redundant — render one frosted
  panel and let the cards be cheap translucent fills on top of it. Reserve true
  `backdrop-filter` for surfaces that actually sit over *changing* content.

- **Never animate the blur radius.** Animating `backdrop-filter: blur(Npx)` re-runs the
  entire blur kernel at a new radius *every frame* — one of the most expensive things you
  can ask a browser to do, and it visibly stutters. Animate cheap, compositor-friendly
  properties instead: `opacity`, `transform`, and `background-position` (how the L3 sheen
  travels). The glass *material* should be static; only light and geometry move.

- **No nested `backdrop-filter`s.** A glass element inside another glass element makes the
  inner one try to blur an already-blurred backdrop — double the cost, muddy and
  unpredictable result, and it defeats the layering. One backdrop-filter per stacking
  context. If you need a glass child, give it a plain translucent fill, not a second blur.

- **`contain: paint` to bound the work.** On a glass element with a fixed size and no
  overflowing children, `contain: paint` tells the browser the element's painting is
  confined to its box, so it can skip work outside it and isolate invalidation:
  ```css
  .glass-card { contain: paint; }      /* only where size is fixed + nothing overflows */
  ```
  Don't apply it blindly — it clips overflow and establishes containment, which can break
  popovers, tooltips, or shadows that escape the box. Use it on self-contained panels.

- **Reserve L3 refraction for hero panels.** `url(#glass-refract)` runs an
  `feDisplacementMap` over the sampled backdrop — real compositing cost on top of the blur,
  and Chromium-leaning support (see [`levels.md`](./levels.md)). One or two L3 surfaces per
  view, never a grid of them. L1/L2 is the default; L3 is a garnish.

- **Mobile costs more.** Phone GPUs and high-DPI screens pay multiples for the same blur.
  Test scroll performance on a real mid-range device, not just a desktop with a discrete
  GPU. If it janks, drop the blur radius, cut the glass count, or fall the affected surfaces
  back to opaque on small viewports.

---

## 7. Don't glass everything — the anti-pattern list

This mirrors the iOS `liquid-glass-design` skill's anti-patterns (the native counterpart to
this one — see SKILL.md's cross-links), translated to the web. Glass earns its keep as
*chrome and accent*; used on
everything it becomes noise, a perf sink, and an accessibility hazard.

- **Glass on every surface.** The signature failure. Reserve it for navigation, toolbars,
  cards, modals, and interactive controls — the things that benefit from floating above
  content. Body backgrounds, long-form text containers, dense data tables, and full-page
  fills should be solid. If everything is glass, nothing reads as elevated.

- **Nesting glass inside glass.** The web cousin of "multiple standalone glass effects
  without a container." Doubles the `backdrop-filter` cost, blurs an already-blurred
  backdrop, and muddies the result. One glass layer per stacking context.

- **An opaque background directly behind glass.** Glass *is* the see-through. Put a fully
  opaque block immediately behind a glass panel and the blur has nothing interesting to
  sample — you've paid the recomposite cost for a flat tint you could have written as a
  plain `background`. Glass needs ambient content (a gradient, an image, scrolling page)
  behind it to do anything.

- **Forgetting to clip to the corner radius.** The web analogue of UIKit's
  `clipsToBounds`. The sheen/specular pseudos use `border-radius: inherit` and the base
  sets `overflow`/containment where needed — if you add children that paint to the edges
  (an image, a chart), clip them to the panel radius or the glass corners look broken.

- **Animating the blur radius.** Covered above; listed here because it's a top-tier
  anti-pattern. Animate light and geometry, never the material's blur.

- **Shipping the enhanced rule as the base (feature-last).** Skipping the fallback-first
  `@supports` chain leaves unsupported browsers with unreadable text on a near-invisible
  fill. Always solid-base-then-upgrade.

- **Ignoring `prefers-*`.** Glass that ignores reduced-transparency, reduced-motion, or
  high-contrast is broken for the users who most need it to behave. The defaults are wired;
  don't strip them, and extend them when you add new effects.

- **Critical text floating on a busy backdrop.** Decorative glass over a churning gradient
  is gorgeous. The same panel hosting a form label or an error message is an accessibility
  bug waiting for a bright scroll position. Keep must-read text on calm, dense surfaces.

---

## See also

- [`levels.md`](./levels.md) — the L1/L2/L3 fidelity ladder and the L3 browser-support matrix.
- [`tailwind-v4.md`](./tailwind-v4.md) — the `glass` `@utility` that bakes in the
  fallback-first chain so utilities don't drop `-webkit-`/`@supports`.
- [`react.md`](./react.md) — `useGlassPointer`'s `prefers-reduced-motion` guard, the JS twin
  of the CSS rule in §3.
- [`../assets/glass.css`](../assets/glass.css) — the source of truth all of the above lives in.
- [`../SKILL.md`](../SKILL.md) — the hub, the 6-layer model, and the "don't glass
  everything" one-liner.
