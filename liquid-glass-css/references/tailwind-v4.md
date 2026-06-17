# Tailwind v4 — `liquid-glass-css`

Tailwind v4 is **CSS-first**: tokens live in `@theme`, custom classes live in `@utility`, and variants live in `@custom-variant` — all inside your CSS, no `tailwind.config.js`. This file maps the glass material onto that model.

**DRY rule (read this first):** `assets/glass.css` is the single source of truth for the look. This page gives you two ways to consume it in a Tailwind project:

1. **Reuse `glass.css` verbatim** — import it, then compose Tailwind utilities around the `.glass*` classes for layout/spacing. This is the recommended path: zero duplication, every level/preset/component you already have.
2. **Mirror the L1 material as a `@utility glass`** — for teams that want a first-class Tailwind utility instead of an external class. The `@utility` below reproduces *only the L1 base*; it is a mirror, not a second source of truth. Levels 2/3, the presets, and the components still come from `glass.css`.

> If you only need frosted panels and don't want to think about levels, go with path 1: `@import "tailwindcss"; @import "./glass.css";` and you're done.

---

## The `@theme` token block

Expose the namespaced tokens (`--blur-*`, `--radius-*`) so they generate real utilities (`blur-glass`/`backdrop-blur-glass`, `rounded-glass`) *and* stay referenceable as `var(--blur-glass)` etc. The tint is a **channel token** (`--color-glass-tint: 255 255 255`) kept for arbitrary-value composition — see the two opacity paths below. These mirror the canonical `glass.css` defaults exactly.

```css
@import "tailwindcss";

@theme {
  --blur-glass: 16px;            /* → blur-glass / backdrop-blur-glass; mirrors --glass-blur */
  --color-glass-tint: 255 255 255; /* channel-trick "R G B"; mirrors --glass-tint */
  --radius-glass: 18px;          /* → rounded-glass; mirrors --glass-radius */
}
```

Why these three and not the whole token set:

- `--blur-glass` and `--radius-glass` sit in Tailwind's `--blur-*` / `--radius-*` namespaces, so v4 auto-generates `backdrop-blur-glass` and `rounded-glass` for you.
- `--color-glass-tint` is **not** a normal color token. It holds space-separated channels (`255 255 255`), not a `oklch()`/`rgb()`/hex color — so it does **not** produce working generated utilities. `bg-glass-tint` and the slash-opacity form `bg-glass-tint/8` compile to invalid CSS (v4's opacity modifier wraps the token in `color-mix(in oklab, var(--color-glass-tint) 8%, transparent)`, and bare channels are not a valid `color-mix` operand). Consume it via arbitrary values or a real-color token instead — see below.
- The remaining tokens (`--glass-saturate`, `--glass-fill`, `--glass-border`, `--glass-highlight`, `--glass-inner-shadow`, `--glass-shadow`, `--mx`, `--my`) have no Tailwind namespace — they're material internals. Keep them in `glass.css` on `:root`; reference them with arbitrary values (`[box-shadow:var(--glass-shadow)]`) when you need them inline.

### Two ways to drive opacity off the tint

The channel-trick lets one tint feed many alphas, but Tailwind's generated color utilities can't read bare channels. Pick the path that fits:

**(A) Keep the channel token, use the arbitrary-value form.** Compose the alpha yourself inside `rgb()`:

```html
<div class="bg-[rgb(var(--color-glass-tint)/.08)] border-[rgb(var(--color-glass-tint)/.18)]">
  Frosted, token-driven
</div>
```

This is also exactly what the custom `@utility glass` below does internally (`background: rgb(var(--color-glass-tint) / 0.08)`), so the utility path and the arbitrary-value path stay in sync. One tint token, every alpha — no extra color tokens needed.

**(B) Want first-class `bg-*` utilities? Define real-color tokens.** Add a token whose value is a complete CSS color, and v4 generates the utility:

```css
@theme {
  --color-glass-fill: rgb(255 255 255 / 0.08);   /* → bg-glass-fill works */
  --color-glass-rim:  rgb(255 255 255 / 0.18);   /* → border-glass-rim works */
}
```

```html
<div class="bg-glass-fill border border-glass-rim">First-class utilities</div>
```

Trade-off: real-color tokens give you clean `bg-*`/`border-*` names but bake the alpha into each token, so you lose the one-tint-many-alphas flexibility of the channel form. Use (A) when alphas vary, (B) when you want named utilities for a fixed fill/rim.

---

## The custom `@utility glass`

This reproduces the **L1 base material** (layers 1, 2, 3, 6) from `glass.css` as a real Tailwind utility. Drop it in your CSS once; then `class="glass"` works anywhere Tailwind runs, and you can still stack utilities on top.

```css
@utility glass {
  position: relative;
  isolation: isolate;

  /* fallback-first: legible solid-ish tint when backdrop-filter is unsupported */
  background: rgb(var(--color-glass-tint) / 0.6);

  border: 1px solid rgb(255 255 255 / 0.18);
  border-radius: var(--radius-glass);
  box-shadow: 0 12px 40px rgb(0 0 0 / 0.45);
}

/* UPGRADE only when the browser can blur the backdrop — -webkit- paired, always */
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  @utility glass {
    background: rgb(var(--color-glass-tint) / 0.08);
    -webkit-backdrop-filter: blur(var(--blur-glass)) saturate(1.4);
    backdrop-filter: blur(var(--blur-glass)) saturate(1.4);
  }
}
```

Notes:

- **Fallback-first is preserved.** The base rule paints a 0.6-alpha tint that stays readable with no blur support; the `@supports` block swaps in the translucent 0.08 fill and turns on the real backdrop-filter. Never ship the `@utility` without the `@supports` upgrade — that's the whole robustness move.
- **`-webkit-backdrop-filter` is paired with `backdrop-filter` every time.** Safari still needs the prefix.
- This utility is **L1 only.** For specular (L2), refraction (L3), the dark/light/tinted presets, and the components, import `glass.css` — don't try to re-author them as utilities, that's where drift creeps in.
- `position: relative; isolation: isolate;` are part of the contract: they anchor the sheen pseudo-elements and contain the stacking context. Keep them even in the utility.

---

## Vanilla class → Tailwind utility mapping

For the L1 look composed **inline from stock utilities** (no custom `@utility`, no import) — handy for one-off panels. This is the Tailwind translation of `glass.css`'s `.glass` base:

| `glass.css` declaration | Stock Tailwind v4 utilities |
|---|---|
| `background: rgb(var(--glass-tint)/.08)` | `bg-white/10` |
| `backdrop-filter: blur(16px) saturate(140%)` | `backdrop-blur-md backdrop-saturate-150` |
| `border: 1px solid rgb(255 255 255/.18)` | `border border-white/15` |
| `border-radius: 18px` | `rounded-2xl` |
| `box-shadow: 0 12px 40px rgb(0 0 0/.45)` | `shadow-xl` |
| `position: relative; isolation: isolate` | `relative isolate` |

**Composite L1 panel, fully inline:**

```html
<div class="relative isolate bg-white/10 backdrop-blur-md backdrop-saturate-150
            border border-white/15 rounded-2xl shadow-xl p-6">
  Frosted content
</div>
```

These are **approximations** of the canonical tokens — `backdrop-blur-md` is 12px (token is 16px), `bg-white/10` is .10 (token is .08). They read as glass and are fine for prototypes. For pixel-exact parity with the design system, use the `@utility glass` (token-driven) or import `glass.css`.

### Component shorthands

The five components, expressed as inline utility recipes on top of the base panel. Each **approximates** the geometry in `glass.css` (rounded to the nearest stock-utility step; see `references/components.md` for the canonical CSS):

| Component | Inline Tailwind (compose with the base panel above) |
|---|---|
| `.glass-card` | `rounded-3xl p-5` |
| `.glass-button` | `inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 cursor-pointer transition active:scale-[.98] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60` |
| `.glass-button--prominent` | `bg-linear-135 from-white/40 to-white/20 border-white/50` |
| `.glass-nav` | `sticky top-0 z-50 flex items-center gap-3 rounded-none border-0 border-b border-white/15 px-4 py-2.5 backdrop-blur-xl backdrop-saturate-150` |
| `.glass-pill` | `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm` |
| `.glass-badge` | `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold` |
| `.glass-modal` | `fixed left-1/2 top-1/2 z-[1001] -translate-x-1/2 -translate-y-1/2 w-[min(92vw,460px)] max-h-[86vh] overflow-auto rounded-[26px] p-7` |
| `.glass-scrim` | `fixed inset-0 z-[1000] border-0 rounded-none shadow-none bg-black/30 backdrop-blur-sm backdrop-saturate-125` |

Prefer the real `.glass-*` classes from `glass.css` for anything beyond a quick mockup — the inline forms can't carry the L2/L3 sheen pseudo-elements or the preset retuning, and they drift from the tokens.

---

## Level 3 (refraction) via arbitrary values

L3 layers an SVG `feDisplacementMap` (`url(#glass-refract)`) into the backdrop-filter. Tailwind has no utility for filter-function chains with a `url()` reference, so reach for an **arbitrary property** (`[property:value]`). Keep the paired prefixes:

```html
<div class="glass glass--l2
            [-webkit-backdrop-filter:blur(3px)_saturate(180%)_url(#glass-refract)]
            [backdrop-filter:blur(3px)_saturate(180%)_url(#glass-refract)]">
  Hero panel with backdrop lensing
</div>
```

Notes:

- **Underscores are spaces.** Tailwind converts `_` to a space inside arbitrary values, so `blur(3px)_saturate(180%)_url(#glass-refract)` compiles to `blur(3px) saturate(180%) url(#glass-refract)`.
- **Mount the filter once.** `url(#glass-refract)` references the inline `<svg>` defs from `glass.css`'s requirements (see `assets/demo.html`, or `<GlassFilter id="glass-refract" />` in `assets/Glass.tsx`). Without the def, the `url()` resolves to nothing and the panel quietly falls back to plain blur — which is the intended graceful degrade.
- **Chromium-leaning.** Safari and Firefox ignore the `url()` and degrade to an L2-grade blur. That's expected; don't try to polyfill it.
- **Still pair `-webkit-`.** Two arbitrary properties, one prefixed — same rule as everywhere.
- This is genuinely simpler to consume as the real `.glass--l3` class from `glass.css`. The arbitrary-value form exists for projects that refuse any non-Tailwind class; reach for it only then.

---

## Presets: dark / light / tinted via data attribute

The presets in `glass.css` are driven by `[data-glass-theme="dark"|"light"|"tinted"]` overriding the token block, with **dark as the `:root` default**. In a Tailwind project you keep that exact contract — set the attribute on a wrapper and the tokens cascade:

```html
<body data-glass-theme="dark">   <!-- dark is the default; explicit for clarity -->
  <section data-glass-theme="light"> <!-- this subtree flips to light glass -->
    <div class="glass-card">…</div>
  </section>
</body>
```

If `glass.css` is imported, that's all you need — the preset blocks already live there and recolor every alpha-driven surface for free (fill, gradients, prominent button) because they all read `rgb(var(--glass-tint)/…)`. The focus ring is the deliberate exception: it reads the theme-stable `--glass-focus` token (**not** the tint), which the `light` preset overrides to a dark ring so it never vanishes when the tint matches the backdrop.

### Registering preset-aware variants (`@custom-variant`)

To style **arbitrary Tailwind utilities** conditionally per theme (e.g. a darker text color only under `light`), register a `@custom-variant` for each preset. Then `glass-light:text-black`, `glass-tinted:border-orange-400`, etc. just work:

```css
@custom-variant glass-dark   (&:where([data-glass-theme="dark"], [data-glass-theme="dark"] *));
@custom-variant glass-light  (&:where([data-glass-theme="light"], [data-glass-theme="light"] *));
@custom-variant glass-tinted (&:where([data-glass-theme="tinted"], [data-glass-theme="tinted"] *));
```

```html
<div data-glass-theme="light">
  <!-- on light glass, force readable dark body text -->
  <p class="glass-light:text-zinc-900">Readable on a bright frosted panel</p>
</div>
```

**Light-glass gotcha (carried over from `glass.css`):** on bright backdrops a near-white rim disappears, so the `light` preset *darkens* the border to `rgb(0 0 0/.12)`. If you hand-roll a light panel with stock utilities, do the same — use `border-black/10`, **not** `border-white/15`. This is the #1 light-glass mistake.

### Quick token reference per preset

What each preset retunes (from `glass.css` §7) — mirror these if you must build a preset from Tailwind utilities instead of importing the CSS:

| Token | `dark` (default) | `light` | `tinted` |
|---|---|---|---|
| `--glass-tint` | `255 255 255` | `255 255 255` | `255 122 26` |
| `--glass-tint-opacity` | `0.08` | `0.55` | `0.16` |
| `--glass-saturate` | `140%` | `120%` | `150%` |
| `--glass-border` | `rgb(255 255 255/.18)` | `rgb(0 0 0/.12)` ← darker rim | `rgb(255 122 26/.4)` |
| `--glass-highlight` | `rgb(255 255 255/.5)` | `rgb(255 255 255/.7)` | `rgb(255 196 150/.55)` |
| `--glass-shadow` | `0 12px 40px rgb(0 0 0/.45)` | `0 10px 30px rgb(0 0 0/.16)` | `0 12px 40px rgb(120 50 0/.4)` |
| `--glass-focus` | `rgb(255 255 255/.65)` | `rgb(17 19 24/.6)` ← dark ring | *(inherits dark default)* |

---

## Putting it together — recommended setup

```css
/* app.css */
@import "tailwindcss";
@import "./glass.css";          /* the single source of truth: tokens, levels, presets, components */

@theme {
  /* namespaced tokens generate blur-glass / rounded-glass; the channel tint
     is for arbitrary-value composition (rgb(var(--color-glass-tint)/.08)),
     NOT generated bg-glass-tint utilities — see the two opacity paths above */
  --blur-glass: 16px;
  --color-glass-tint: 255 255 255;
  --radius-glass: 18px;
}

/* optional: theme-aware variants for conditionally styling stock utilities */
@custom-variant glass-light  (&:where([data-glass-theme="light"], [data-glass-theme="light"] *));
@custom-variant glass-tinted (&:where([data-glass-theme="tinted"], [data-glass-theme="tinted"] *));
```

```html
<body data-glass-theme="dark">
  <nav class="glass glass-nav">…</nav>

  <main class="grid gap-4 p-6 md:grid-cols-3">
    <!-- real classes from glass.css; Tailwind handles layout/spacing -->
    <div class="glass glass--l2 glass-card">Stat</div>
    <div class="glass glass--l2 glass--l3 glass-card glass--interactive">Hero</div>

    <button class="glass glass-button glass-button--prominent">Save</button>
  </main>
</body>
```

That's the DRY arrangement: **Tailwind owns layout, spacing, and the token namespace; `glass.css` owns the material.** Neither re-implements the other.

---

**See also:** `SKILL.md` (model + quick start) · `references/levels.md` (L1/L2/L3 deep dive) · `references/components.md` (canonical component CSS) · `references/fallbacks-a11y.md` (`@supports`, reduced-motion/transparency, contrast-on-glass).
