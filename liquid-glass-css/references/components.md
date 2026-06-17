# Glass components — full CSS + every interaction state

The five core components. Each is the **same material** (`.glass`) with its own
geometry, radius, and interaction states. None re-implements the look — they
compose on `.glass` and retune a couple of tokens (mostly `--glass-radius`).

> **Source of truth:** every rule here is exactly what ships in
> [`assets/glass.css`](../assets/glass.css). This file is the annotated walkthrough —
> the *why* behind each state and the minimal HTML to drop each component in. If a
> rule here and `glass.css` ever disagree, `glass.css` wins.

**The composition contract (read once):**

- Always put `.glass` first, then the component class: `class="glass glass-card"`.
- `.glass` provides the fallback-first base (legible solid panel) and the
  `@supports`-gated real material. Components never re-declare `backdrop-filter`
  *except* `.glass-nav` and `.glass-scrim`, which need their own blur because they
  override the base border/radius (see their sections).
- Add a fidelity level by stacking. Levels are **cumulative**: `glass--l3`
  builds on top of `glass--l2`, so a level-3 surface stacks both —
  `class="glass glass--l2 glass--l3 glass-card"`. A level-2 surface is
  `class="glass glass--l2 glass-card"`; level-1 is just `class="glass glass-card"`.
- Add pointer specular by stacking: `class="glass glass--interactive glass-button"`.
- **`glass--l2` and `glass--interactive` compose.** `glass.css` ships a combined
  `.glass--l2.glass--interactive::before` that *layers both sheens* — the static
  158deg highlight and the pointer-tracking radial specular — in one background
  declaration, so neither clobbers the other. Stack them freely:
  `class="glass glass--l2 glass--interactive glass-card"`. They share the `::before`
  pseudo without collision (see the pseudo-element budget below).
- Switch theme on any ancestor: `<div data-glass-theme="light"> … </div>`.

**Pseudo-element budget (2 pseudos, no collision):** every glass surface gets
exactly two pseudo-elements, and `glass.css` keeps them from fighting over the
same slot:

- **`::before` = sheen / specular.** Carries the L2 static highlight *and* the
  `glass--interactive` pointer specular. When both classes are present the combined
  `.glass--l2.glass--interactive::before` rule layers the radial specular over the
  158deg highlight in a single `background`, so L2 + interactive coexist.
- **`::after` = L3 animated sheen.** The travelling reflection lives here, on its
  own pseudo, so it never competes with the `::before` sheen.

Because the two effects occupy different pseudos, **L2, L3, and interactive all
coexist on one element** — `class="glass glass--l2 glass--l3 glass--interactive glass-card"`
is valid and renders all three layers.

Quick map:

| Component | Class(es) | Shape / role | iOS twin |
|---|---|---|---|
| Card | `.glass-card` | radius-xl panel, padding | card / container |
| Button | `.glass-button` (+ `--prominent`) | capsule, fully interactive | `.buttonStyle(.glass)` / `.glassProminent` |
| Nav | `.glass-nav` | sticky topbar/toolbar, bottom rim | toolbar |
| Pill / Badge | `.glass-pill` / `.glass-badge` | small capsule | — |
| Modal | `.glass-modal` + `.glass-scrim` | centered panel + frosted backdrop | sheet |

---

## 1. Card — `.glass-card`

A roomy panel: bigger corner radius and built-in padding. It carries no interaction states of its own —
add `.glass--interactive` if you want the pointer specular, or deepen the
material with `.glass--l2` (and `.glass--l3` *on top of* `--l2`, since levels are
cumulative). `--interactive` composes with either.

```css
/* --- Card: roomy radius-xl panel --- */
.glass-card {
  --glass-radius: 22px;
  border-radius: var(--glass-radius);
  padding: 20px 22px;
}
```

Why it overrides `--glass-radius` rather than just `border-radius`: the token is
what `::before`/`::after` sheen, the rim, and the fallback panel all inherit via
`border-radius: inherit`. Setting the **token** keeps every layer's corner in
sync; setting only `border-radius` would round the box but leave the sheen
pseudo square.

**Minimal HTML:**

```html
<article class="glass glass--l2 glass-card">
  <p class="glass-badge">Total revenue</p>
  <h2>$48,120</h2>
  <p>+12.4% vs last month</p>
</article>
```

Plain L1 card (production-safe everywhere) is just `class="glass glass-card"`.
Reach for `glass--l2` on hero tiles; reserve L3 for one or two showcase panels —
and because levels are cumulative, an L3 card stacks both classes:
`class="glass glass--l2 glass--l3 glass-card"` (real compositing cost — see
[`levels.md`](./levels.md)).

---

## 2. Button — `.glass-button` (+ `--prominent`) with all states

The most state-heavy component: `:hover`, `:active`, `:focus-visible`, plus a
`--prominent` primary-action variant that itself has a hover state. Note it sets
`font: inherit` and `color: inherit` so a glass button matches surrounding text
instead of inheriting the UA button look.

### Base + interaction states

```css
/* --- Button: interactive capsule. Maps iOS .buttonStyle(.glass). --- */
.glass-button {
  --glass-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5em;
  padding: 0.6em 1.2em;
  border-radius: var(--glass-radius);
  font: inherit;
  color: inherit;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition:
    transform 0.12s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease,
    filter 0.2s ease;
}

.glass-button:hover {
  /* brighten the body on hover without a second backdrop-filter pass */
  background-color: rgb(var(--glass-tint) / 0.16);
  filter: brightness(1.08);
}

.glass-button:active {
  transform: scale(0.98);
}

.glass-button:focus-visible {
  outline: none;
  /* visible, theme-aware focus ring layered on top of the elevation shadow */
  box-shadow:
    var(--glass-shadow),
    0 0 0 3px rgb(var(--glass-tint) / 0.65);
}
```

State-by-state rationale:

- **`:hover`** — bumps `background-color` toward the tint and adds a small
  `brightness()`. Crucially it does **not** re-run `backdrop-filter` — a second
  backdrop pass on hover is a measurable repaint. `background-color` + `filter`
  animate cheaply on the compositor.
- **`:active`** — `scale(0.98)` gives the press a physical squish. The `0.12s`
  `transform` transition makes press *and* release feel springy; because it's a
  transform it never triggers layout.
- **`:focus-visible`** (not `:focus`) — keyboard users get a ring; mouse users
  don't get a ring on click. The ring is **layered on top of** `--glass-shadow`
  (note the shadow is repeated first in the list), so the elevation isn't lost
  when focused. The ring color is `rgb(var(--glass-tint) / 0.65)`, so it recolors
  for free under the `tinted` preset (an orange button gets an orange ring).

### Prominent variant — the primary action

`.glass-button--prominent` maps iOS `.glassProminent`: a denser, glowing,
tinted body that reads as *the* primary action. It inherits the tint hue, so
under `[data-glass-theme="tinted"]` it becomes a glowing orange button with no
extra CSS.

```css
/* Prominent variant — maps iOS .glassProminent: a saturated tinted body that
   reads as the primary action. Inherits the tint hue, just denser + glowing. */
.glass-button--prominent {
  background: linear-gradient(
    135deg,
    rgb(var(--glass-tint) / 0.42),
    rgb(var(--glass-tint) / 0.22)
  );
  border-color: rgb(var(--glass-tint) / 0.55);
  box-shadow:
    var(--glass-shadow),
    inset 0 1px 0 var(--glass-highlight),
    0 0 18px rgb(var(--glass-tint) / 0.35);
}

.glass-button--prominent:hover {
  background: linear-gradient(
    135deg,
    rgb(var(--glass-tint) / 0.52),
    rgb(var(--glass-tint) / 0.3)
  );
  filter: brightness(1.05);
}
```

- The `0 0 18px rgb(var(--glass-tint) / 0.35)` is an **outer glow** in the tint
  hue — that halo is what separates "prominent" from "louder fill".
- `inset 0 1px 0 var(--glass-highlight)` adds the top-edge specular that the base
  button doesn't have, giving the prominent variant visible thickness.
- The variant still inherits `:active` (`scale(0.98)`) and `:focus-visible` (the
  ring) from `.glass-button` — only the resting and hover *fills* change.

**Minimal HTML:**

```html
<!-- secondary / ghost glass button -->
<button class="glass glass-button">Cancel</button>

<!-- primary action -->
<button class="glass glass-button glass-button--prominent">Save changes</button>

<!-- with pointer-tracking specular (costs a little JS — see react.md) -->
<button class="glass glass--interactive glass-button glass-button--prominent">
  Get started
</button>
```

Use a real `<button>` (or `<a>` styled as one) so keyboard, focus, and
`:active` come for free. `:focus-visible` only does its job on a focusable
element.

---

## 3. Nav — `.glass-nav` (sticky toolbar / topbar)

The top bar: a sticky frosted strip with a **single hairline bottom rim**
instead of an all-round border, and a **stronger blur** so dense content
scrolling underneath stays readable. Because it zeroes the base border and
radius, it re-declares its own `backdrop-filter` inside an `@supports` block
(the base `.glass` rule still supplies the fallback fill, but the *blur strength*
is the nav's own).

```css
/* --- Nav: sticky topbar / toolbar. Stronger blur, thin rim. --- */
.glass-nav {
  --glass-blur: 22px;
  --glass-radius: 16px;
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  /* override the all-round border for a single hairline bottom rim */
  border: 0;
  border-bottom: 1px solid var(--glass-border);
  border-radius: 0;
}

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass-nav {
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
    backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  }
}
```

Things that bite people here:

- **`position: sticky` needs a scroll container and `top`.** The nav sticks
  relative to its nearest scrolling ancestor. If an ancestor has
  `overflow: hidden`/`auto`/`scroll`, sticky pins to *that*, not the viewport —
  the classic "my sticky header won't stick" bug. `top: 0` is required; sticky
  with no inset offset never pins.
- **`z-index: 50`** keeps the bar above scrolling page content but below the
  modal layer (`.glass-modal` is `1001`, `.glass-scrim` is `1000`). Keep nav
  *under* the scrim so an open modal frosts the nav too.
- **Why re-declare `backdrop-filter`?** The nav sets `--glass-blur: 22px`
  (stronger than the `16px` default) and zeroes the inherited border/radius. The
  re-declaration applies the nav's stronger blur; the base `.glass` rule still
  provides `background: var(--glass-fill)` and the no-support fallback, so DRY
  holds — only the blur *value* is restated, paired `-webkit-` first as always.

**Minimal HTML:**

```html
<nav class="glass glass-nav">
  <strong>Liquid Glass CSS</strong>
  <a class="glass glass-pill" href="#">Overview</a>
  <a class="glass glass-pill" href="#">Reports</a>
  <span style="margin-inline-start: auto"></span>
  <button class="glass glass-button glass-button--prominent">New</button>
</nav>
```

The `<main>` after the nav simply scrolls; the nav frosts whatever passes under
it. No JS needed for the sticky behavior.

---

## 4. Pill & Badge — `.glass-pill` / `.glass-badge`

Two small capsules that differ only in scale and intent. **Pill** is the
interactive one (nav items, filter chips) — pair it with `.glass-button` or an
`<a>` if you want hover/press states. **Badge** is static and tiny (the `$12.4K`
tag, the "Total Pending" chip) and carries a heavier font weight to stay legible
at small size.

```css
/* --- Pill: small interactive capsule (nav items, filters) --- */
.glass-pill {
  --glass-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.35em 0.85em;
  border-radius: var(--glass-radius);
  font-size: 0.875rem;
  line-height: 1;
}

/* --- Badge: tiny static capsule ($12.4K tag, "Total Pending" chip) --- */
.glass-badge {
  --glass-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.2em 0.6em;
  border-radius: var(--glass-radius);
  font-size: 0.75rem;
  line-height: 1;
  font-weight: 600;
}
```

- Both set `line-height: 1` so the capsule hugs the text — without it the
  inherited line-height balloons the pill into an oval with dead vertical space.
- Neither defines interaction states. A pill that needs to respond to hover/press
  should **also** carry `.glass-button` (which brings the full state set) or be an
  `<a>`/`<button>`:

```html
<!-- interactive filter pill: borrow the button's states -->
<button class="glass glass-pill glass-button">This week</button>
```

- Badges are decorative status chips; keep them non-interactive. If a badge must
  convey state to assistive tech, give it text (not color alone) and consider an
  `aria-label`.

**Minimal HTML:**

```html
<nav class="glass glass-nav">
  <a class="glass glass-pill" href="#">Overview</a>
  <a class="glass glass-pill" href="#">Customers</a>
</nav>

<span class="glass glass-badge">$12.4K</span>
<span class="glass glass-badge" data-glass-theme="tinted">Total Pending</span>
```

(Setting `data-glass-theme` on the badge itself recolors just that chip.)

---

## 5. Modal — `.glass-modal` + `.glass-scrim` (with the fixed-position note)

A modal is **two elements**: a full-viewport `.glass-scrim` that dims *and frosts*
the page, and a centered `.glass-modal` floating above it. The scrim is what makes
the effect read as "glass over the whole app" rather than "a glass box on a solid
overlay".

```css
/* --- Modal: centered floating panel. The scrim carries its OWN blur so the
   whole page behind dims and frosts. Note the fixed positioning. --- */
.glass-modal {
  --glass-radius: 26px;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1001;
  width: min(92vw, 460px);
  max-height: 86vh;
  overflow: auto;
  padding: 28px;
  border-radius: var(--glass-radius);
}

/* Scrim: full-viewport blurred backdrop behind a modal. Its own backdrop-filter
   frosts the page; the rgba dims it. Fallback (no blur) still dims via the base. */
.glass-scrim {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgb(0 0 0 / 0.45);
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass-scrim {
    background: rgb(0 0 0 / 0.3);
    -webkit-backdrop-filter: blur(6px) saturate(120%);
    backdrop-filter: blur(6px) saturate(120%);
  }
}
```

### The fixed-position note (read before shipping a modal)

`position: fixed` positions relative to the **viewport** — *unless* an ancestor
creates a containing block. Any ancestor with a `transform`, `filter`,
`perspective`, `backdrop-filter`, `will-change: transform`, or `contain: paint`
turns `fixed` into "fixed to that ancestor", and the modal will be miscentered or
clipped. This is the single most common glass-modal bug, and glass is *full* of
those properties — every `.glass` element has `isolation: isolate`, and L3 panels
carry `backdrop-filter`.

**Rule: render `.glass-scrim` + `.glass-modal` at the top of `<body>`, not nested
inside a glass card.** In React/Vue, portal them to `document.body`. Then `fixed`
resolves against the viewport as intended.

Other essentials:

- **Stacking order:** scrim `z-index: 1000` sits below modal `z-index: 1001`, and
  both sit above the nav (`50`) and page content. The scrim therefore frosts the
  nav and everything else, while the modal floats clear on top.
- **The scrim does the frosting, the modal does the glass.** Note the scrim
  *zeroes* the inherited border/radius/shadow (`border: 0; border-radius: 0;
  box-shadow: none`) — it's a flat full-bleed sheet, so it must re-declare its own
  (gentler, `6px`) `backdrop-filter`. The base `.glass` rule still supplies the
  `rgb(0 0 0 / 0.45)` dim as a fallback where blur is unsupported, so the overlay
  *always* dims even with no glass support.
- **Scroll the modal, not the scrim.** `max-height: 86vh` + `overflow: auto`
  keeps a tall modal scrollable inside the frosted frame without scrolling the
  dimmed page behind it.
- **Contrast:** modal text sits on a frosted-but-busy backdrop. Use `glass--l2`
  (the denser gradient fill) for the modal body, or keep important copy on a
  higher-opacity inner surface — see [`fallbacks-a11y.md`](./fallbacks-a11y.md).

**Minimal HTML** (portal-to-body markup; toggle the wrapper's visibility in JS):

```html
<!-- mount these as direct children of <body> -->
<div class="glass glass-scrim" data-modal-backdrop></div>

<div class="glass glass--l2 glass-modal" role="dialog" aria-modal="true"
     aria-labelledby="modal-title">
  <h2 id="modal-title">Confirm upgrade</h2>
  <p>You're moving to the Pro plan. This takes effect immediately.</p>
  <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:18px">
    <button class="glass glass-button" data-modal-close>Cancel</button>
    <button class="glass glass-button glass-button--prominent">Upgrade</button>
  </div>
</div>
```

A11y minimums: `role="dialog"`, `aria-modal="true"`, an `aria-labelledby` (or
`aria-label`), focus moved into the dialog on open and restored on close, and
`Esc` / scrim-click to dismiss. The CSS gives you the surface; the dialog
*semantics* are still yours to wire.

### Native `<dialog>` shortcut (skip the separate scrim)

If you use the native `<dialog>` element with `showModal()`, the browser gives you
focus-trapping, `Esc`-to-close, and a built-in `::backdrop` *for free* — so you can
drop the standalone `.glass-scrim` element and frost the page from the backdrop
pseudo instead. Put `class="glass glass--l2 glass-modal"` on the `<dialog>` and
style its `::backdrop` with the same gentle blur the scrim uses:

```css
/* Native <dialog> backdrop: frosts + dims the page, replacing .glass-scrim.
   Paired -webkit- first as always. Only paints while the dialog is modal-open. */
dialog::backdrop {
  -webkit-backdrop-filter: blur(6px) saturate(120%);
  backdrop-filter: blur(6px) saturate(120%);
  background: rgb(0 0 0 / 0.3);
}
```

```html
<dialog class="glass glass--l2 glass-modal" aria-labelledby="modal-title">
  <h2 id="modal-title">Confirm upgrade</h2>
  <!-- … same body as above … -->
</dialog>
<!-- open with dialogEl.showModal(); the ::backdrop frosts everything behind it -->
```

`::backdrop` only renders while the dialog is open via `showModal()` (not
`show()`), and it always paints behind the dialog, so there's no `z-index` or
portal-to-body dance — the browser handles stacking. The `6px` blur and
`rgb(0 0 0 / 0.3)` dim match `.glass-scrim`'s `@supports` branch so the two
approaches look identical.

---

## See also

- [`levels.md`](./levels.md) — L1/L2/L3 fidelity, the `#glass-refract` filter, browser support.
- [`fallbacks-a11y.md`](./fallbacks-a11y.md) — `@supports`, reduced-motion/transparency/contrast, contrast-on-glass, perf.
- [`tailwind-v4.md`](./tailwind-v4.md) — these components as `@utility` + the class-mapping table.
- [`react.md`](./react.md) — `<GlassCard>` / `<GlassButton>` / `<GlassPanel>` / `<GlassModal>` wrappers (classes only).
- [`../assets/glass.css`](../assets/glass.css) — the canonical stylesheet every rule above comes from.
