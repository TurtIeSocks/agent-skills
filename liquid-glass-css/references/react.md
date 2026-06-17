# React reference

The React layer is **ergonomics over `glass.css`, not a second implementation of glass.** Every component here emits the same class strings the stylesheet already defines — `.glass`, `.glass--l2`, `.glass-card`, `.glass-button--prominent`, `[data-glass-theme="…"]` — and adds exactly two things CSS cannot do on its own:

1. **`<GlassFilter>`** — mounts the SVG filter `<defs>` (`#glass-refract` always; `#glass-goo` opt-in via the `goo` prop) once per document, with a stable, configurable `id`.
2. **`useGlassPointer()`** — a ref hook that writes `--mx`/`--my` on `pointermove` so the `.glass--interactive` specular follows the cursor, rAF-throttled and synced live to `prefers-reduced-motion`.

Everything else — `<GlassCard>`, `<GlassButton>`, `<GlassPanel>`, `<GlassModal>`, `<GlassNav>`, `<GlassScrim>` — is a thin, typed, polymorphic wrapper that maps props to those class names and forwards a ref. **No glass look lives in TypeScript.** If you change the material, you change `glass.css`; the React files don't move.

> The component source lives in `assets/Glass.tsx`. This file documents the API and the patterns; copy `Glass.tsx` into your project and import from it. Keep the two in sync — the class strings below are the contract.

---

## Setup (three steps)

```tsx
// 1. Load the canonical stylesheet once, at your app entry (or import the file).
import './glass.css';            // copied from assets/glass.css

// 2. Bring in the components you use.
import {
  GlassFilter, GlassCard, GlassButton, GlassPanel,
  GlassModal, GlassScrim, GlassNav, useGlassPointer,
} from './Glass';                 // copied from assets/Glass.tsx

// 3. Mount the SVG filter defs ONCE, high in the tree (see below).
export default function App() {
  return (
    <>
      <GlassFilter />            {/* defines #glass-refract (add `goo` for #glass-goo) */}
      <GlassCard level={2}>Hello, glass</GlassCard>
    </>
  );
}
```

Three things that bite people on first try:

1. **Forgetting to import `glass.css`.** The components emit class names; if the stylesheet isn't loaded, you get a bare `<div>`. This is the React analog of the vanilla "I forgot the CSS" failure.
2. **Forgetting `<GlassFilter>`** — `level={3}` panels reference `url(#glass-refract)`. With no `<defs>` mounted, Chromium silently renders an un-refracted (L2-grade) panel. Mount it once. (For the gooey `.glass-goo` merge you also need `#glass-goo` — pass `<GlassFilter goo />`; see below.)
3. **Mounting `<GlassFilter>` more than once** — duplicate `id="glass-refract"` defs in the same document are an ID collision; the browser uses the first and the rest are dead weight. One per document. (Multiple ids? Pass distinct `id` props — see below.)

---

## `<GlassFilter>` — mount the SVG defs once

`backdrop-filter: url(#glass-refract)` (L3) and `filter: url(#glass-goo)` (Tier B `.glass-goo`) are SVG-filter references. The filter primitives have to exist *somewhere in the document* as `<defs>`. `<GlassFilter>` renders that hidden `<svg>`. **The refraction filter always ships; the gooey filter is opt-in** via the `goo` prop, so the default footprint stays minimal:

```tsx
<GlassFilter />
// renders (roughly):
// <svg aria-hidden="true" focusable="false" style={{ position:'absolute', width:0, height:0 }}>
//   <defs>
//     <filter id="glass-refract">…feTurbulence + feDisplacementMap…</filter>
//     {/* NO #glass-goo unless you pass `goo` */}
//   </defs>
// </svg>

<GlassFilter goo />
// same as above, PLUS:
//     <filter id="glass-goo">…feGaussianBlur + feColorMatrix + feComposite…</filter>
```

### Props

| Prop | Type | Default | Effect |
|---|---|---|---|
| `id` | `string` | `'glass-refract'` | id of the L3 refraction filter (`.glass--l3` references it) |
| `goo` | `boolean` | `false` | also emit the `#glass-goo` gooey-merge filter for Tier B `.glass-goo` |
| `gooId` | `string` | `'glass-goo'` | override the gooey filter's id |
| `scale` | `number` | `32` | displacement strength of the L3 refraction map (`feDisplacementMap` `scale`) |

**Default `id` is `glass-refract`** — the same id `glass.css` references in `.glass--l3`. Don't change it unless you have a collision, because the stylesheet's `url(#glass-refract)` is hard-coded. Same for `gooId` and `.glass-goo`'s `url(#glass-goo)`. If you must namespace (multiple isolated glass roots, a micro-frontend, a Shadow DOM boundary), render with custom ids **and** override the var-free `url()` in a scoped stylesheet — but in practice, **one default `<GlassFilter />` at the app root is the boring correct answer.**

```tsx
// Default — matches glass.css out of the box, emits only #glass-refract:
<GlassFilter />

// Opt into the gooey merge when you actually use .glass-goo (Tier B morphing):
<GlassFilter goo />

// Punchier lensing on hero panels (default scale is 32):
<GlassFilter scale={48} />

// Namespaced — only if you have a real id collision; you then own the CSS wiring:
<GlassFilter id="glass-refract--checkout" />
```

`<GlassFilter>` renders no visible pixels (`width:0; height:0; overflow:hidden`, `aria-hidden`), so it's safe anywhere in the tree. Put it next to your top-level layout.

---

## `useGlassPointer()` — pointer-tracking specular

`.glass--interactive` paints a radial highlight at `var(--mx) var(--my)`. CSS can't read the cursor, so this hook writes those two custom properties (as percentages) on `pointermove`, then the `@property`-registered vars ease the highlight to the new spot. It is the only JavaScript in the whole skill, and it's **opt-in and reduced-motion-aware**.

### Usage

```tsx
function FancyButton() {
  const ref = useGlassPointer<HTMLButtonElement>();
  return (
    <button ref={ref} className="glass glass--l2 glass--interactive glass-button">
      Hover me
    </button>
  );
}
```

Or via the wrappers — pass `interactive` and the hook is wired for you (the wrapper merges its internal pointer ref with any ref you forward, so neither is clobbered — see [Components](#components)):

```tsx
<GlassButton level={2} interactive>Hover me</GlassButton>
```

### Source (canonical — matches `assets/Glass.tsx`)

The real hook is **rAF-throttled** (at most one `--mx`/`--my` write per animation frame) and **synced live** to the motion preference: it attaches/detaches listeners on a `matchMedia('(prefers-reduced-motion: reduce)')` `change` event, so toggling the OS setting while the component is mounted takes effect immediately — not just on next mount.

```tsx
'use client';
import { useEffect, useRef, type Ref } from 'react';

/**
 * Writes --mx/--my (as %) on the ref'd element while the pointer moves over it,
 * driving the .glass--interactive radial specular. Throttled to one write per
 * animation frame. Binds/unbinds live with prefers-reduced-motion (re-evaluated
 * on the media-query `change` event). SSR-safe; cleans up on unmount.
 */
export function useGlassPointer<T extends HTMLElement = HTMLElement>(): Ref<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (el == null || typeof window === 'undefined') return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    const onPointerMove = (event: PointerEvent): void => {
      if (frame !== 0) return; // throttle: one write per animation frame
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const mx = ((event.clientX - rect.left) / rect.width) * 100;
        const my = ((event.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty('--mx', `${mx}%`);
        el.style.setProperty('--my', `${my}%`);
      });
    };

    const onPointerLeave = (): void => {
      // Ease the highlight back to center when the pointer leaves.
      el.style.setProperty('--mx', '50%');
      el.style.setProperty('--my', '50%');
    };

    const attach = (): void => {
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerleave', onPointerLeave);
    };
    const detach = (): void => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    // Bind only when motion is allowed; re-evaluate live if the user toggles it.
    const sync = (): void => {
      detach();
      if (!reduceMotion.matches) attach();
    };

    sync();
    reduceMotion.addEventListener('change', sync);
    return () => {
      detach();
      reduceMotion.removeEventListener('change', sync);
    };
  }, []);

  return ref;
}
```

Notes:
- **Generic `<T extends HTMLElement>`** so the returned ref types correctly whether it lands on a `<div>`, `<button>`, or `<a>`. Call it as `useGlassPointer<HTMLButtonElement>()`.
- **rAF throttle** — `pointermove` fires far faster than the display refreshes; coalescing to one write per frame keeps the custom-property updates cheap.
- **Reduced-motion is live, not one-shot** — listeners are attached only when motion is allowed, and the `change` handler re-binds/unbinds when the user toggles the OS setting mid-session. This mirrors the CSS `@media (prefers-reduced-motion: reduce) { .glass--interactive::before { display:none } }`.
- **SSR-safe** — all DOM access is inside `useEffect`, guarded by `typeof window === 'undefined'`.
- **Cleanup is built in** — listeners are removed and any pending frame is cancelled on unmount.
- It only writes percentages onto inline `style`. It never touches the look — the radial-gradient that reads `--mx`/`--my` lives in `glass.css`.

---

## Components

The wrappers share one prop contract. They build a `className` from props, set `data-glass-theme` when `theme` is passed, forward a `ref`, and render whatever element `as` names (defaulting to a sensible tag). **They contain zero style declarations.**

### Shared props

| Prop | Type | Maps to | Default |
|---|---|---|---|
| `level` | `1 \| 2 \| 3` | `glass` + `glass--l2`/`glass--l3` (stacked) | `1` |
| `prominent` | `boolean` | `glass-button--prominent` (button only) | `false` |
| `theme` | `'dark' \| 'light' \| 'tinted'` | `data-glass-theme="…"` attribute | inherits (`dark` = `:root`) |
| `interactive` | `boolean` | `glass--interactive` + wires `useGlassPointer` | `false` |
| `as` | `ElementType` | the rendered tag | per component |
| `className` | `string` | merged after the glass classes | — |
| …rest | native props of `as` | spread onto the element | — |

`level` stacks cumulatively, exactly like the CSS: `level={2}` → `glass glass--l2`; `level={3}` → `glass glass--l2 glass--l3` (L3 builds on L2's specular). You never write the `glass--lN` strings yourself.

**`interactive` auto-wires the pointer hook.** Pass `interactive` and the wrapper calls `useGlassPointer` internally, then **merges** that pointer ref with whatever ref you forward (via a `mergeRefs` callback ref). So your own `ref={...}` still receives the node *and* the cursor specular tracks — neither clobbers the other. You do not call `useGlassPointer` yourself when you use the wrappers; it's only for hand-rolled elements. (The hook runs on every render regardless, but attaches listeners only on a mounted `.glass--interactive` node, so it's a no-op when `interactive` is off.)

### `<GlassCard>` — radius-xl panel (`as="div"`)

```tsx
<GlassCard level={2} className="stat">
  <span className="glass-badge">Total Pending</span>
  <strong>$12.4K</strong>
</GlassCard>
```
Emits `class="glass glass--l2 glass-card stat"`. Reserve `level={3}` for hero panels only — L3 has real compositing cost (see [`levels.md`](./levels.md) and [`fallbacks-a11y.md`](./fallbacks-a11y.md)).

### `<GlassButton>` — interactive capsule (`as="button"`)

```tsx
<GlassButton onClick={save}>Cancel</GlassButton>
<GlassButton prominent onClick={save}>Save changes</GlassButton>
<GlassButton level={2} interactive>Pointer specular</GlassButton>
```
Emits `glass glass-button` (+ `glass-button--prominent` when `prominent`). `:hover`/`:active`/`:focus-visible` states are all in `glass.css` — the wrapper adds nothing. Because the default `as` is `<button>`, native `disabled`, `type`, `onClick`, etc. spread straight through.

### `<GlassPanel>` — generic surface (`as="div"`)

The unopinionated wrapper: `.glass` material with no component geometry, for sidebars, toolbars, or any surface you style yourself. (For a sticky topbar specifically, prefer `<GlassNav>` below.)

```tsx
<GlassPanel as="aside" level={1} className="sidebar">
  <span className="glass-pill">Overview</span>
  <span className="glass-pill">Reports</span>
</GlassPanel>
```
Use `as` to render the semantically correct element (`<header>`, `<aside>`, `<section>`) while keeping the glass material. Compose `glass-pill`, etc. via `className`.

### `<GlassNav>` — sticky topbar / toolbar (`as="nav"`)

Emits `glass glass-nav` and defaults to a `<nav>`. `.glass-nav` in `glass.css` is `position: sticky; top: 0`, with a stronger blur and a single hairline bottom rim (no all-round border).

```tsx
<GlassNav>
  <strong>SEDELA</strong>
  <span className="glass-pill">Overview</span>
  <span className="glass-pill">Reports</span>
</GlassNav>
```

### `<GlassModal>` + `<GlassScrim>` — centered panel and its backdrop (`as="div"`)

**`<GlassModal>` is panel-only.** It emits `glass glass-modal` (a `position: fixed`, centered floating panel) and nothing else — it does **not** render its own scrim. Render `<GlassScrim>` yourself as a sibling for the dimmed, frosted backdrop. `<GlassScrim>` emits `glass glass-scrim` (full-viewport, `position: fixed`, carries its **own** `backdrop-filter` so the whole page frosts behind the dialog) and is the natural place to hang the click-to-close handler.

```tsx
function Confirm({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <>
      {/* Backdrop: dims + frosts the page, click outside to close. */}
      <GlassScrim onClick={onClose} />
      {/* Panel: the dialog itself. No onClose on the panel — it's not a DOM prop. */}
      <GlassModal level={2} role="dialog" aria-modal="true">
        <h2>Delete project?</h2>
        <p>This can't be undone.</p>
        <GlassButton onClick={onClose}>Cancel</GlassButton>
        <GlassButton prominent onClick={onClose}>Delete</GlassButton>
      </GlassModal>
    </>
  );
}
```

Pass `role="dialog"` and `aria-modal="true"` to the modal (they spread through). Note that `onClose` is **not** a DOM attribute — put your close handler on `<GlassScrim onClick={…}>` (and on the buttons / an `Escape` keydown handler), never spread `onClose` onto the panel `<div>`. For production dialogs, wrap with your focus-trap / `Escape`-to-close logic, or render the panel inside a Radix/Headless UI `Dialog` and put the glass classes on its content — the glass layer is presentation-only and composes with any a11y dialog primitive.

### Theming

`theme` sets the attribute on the element itself, so it cascades to that subtree:

```tsx
<GlassCard theme="light" level={2}>Light glass — darker rim, denser tint</GlassCard>
<GlassButton theme="tinted" prominent>Tinted action</GlassButton>
```
More often you set the theme once on a container and let everything inside inherit:

```tsx
<div data-glass-theme="light">
  <GlassCard level={2}>…</GlassCard>   {/* inherits light preset */}
  <GlassButton>…</GlassButton>
</div>
```
Light glass has a real gotcha — a white rim vanishes on bright backdrops, so the `light` preset darkens the border. Don't fight it; see [`fallbacks-a11y.md`](./fallbacks-a11y.md).

### Reference implementation sketch (matches `assets/Glass.tsx`)

Every surface wrapper is built by one factory, `createGlassSurface(displayName, { base, defaultTag })`. The factory composes the cumulative level classes, sets `data-glass-theme`, and — when `interactive` — merges the internal `useGlassPointer` ref with the forwarded ref. Each component is just a factory call differing only in its `base` class and `defaultTag`:

```tsx
'use client';
import {
  createElement, forwardRef, useRef, useEffect,
  type ElementType, type ForwardedRef, type ReactElement, type Ref,
} from 'react';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// Merge several refs into one callback ref so a single node can feed BOTH the
// internal pointer hook and the consumer's forwarded ref — neither is dropped.
function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (ref == null) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as { current: T | null }).current = node;
    }
  };
}

// level -> cumulative class list, mirroring the CSS stacking exactly.
// 1 -> (base only)   2 -> 'glass--l2'   3 -> 'glass--l2 glass--l3'
function levelClass(level: 1 | 2 | 3 | undefined): string | undefined {
  if (!level || level < 2) return undefined;
  return level >= 3 ? 'glass--l2 glass--l3' : 'glass--l2';
}

interface SurfaceConfig { base: string; defaultTag: ElementType; }

function createGlassSurface(displayName: string, config: SurfaceConfig) {
  function Surface(props: any, ref: ForwardedRef<Element>): ReactElement {
    const { as, level, theme, interactive, className, children, ...rest } = props;
    const Tag = (as ?? config.defaultTag) as ElementType;

    // Hook runs every render (a no-op when not interactive). When interactive,
    // merge its ref with the forwarded ref so the consumer's ref survives.
    const pointerRef = useGlassPointer<HTMLElement>();
    const mergedRef = interactive
      ? mergeRefs<Element>(ref, pointerRef as Ref<Element>)
      : ref;

    return createElement(Tag, {
      ref: mergedRef,
      className: cx('glass', config.base, levelClass(level),
        interactive && 'glass--interactive', className),
      'data-glass-theme': theme,
      ...rest,
    }, children);
  }
  Surface.displayName = displayName;
  return forwardRef(Surface);
}

export const GlassCard  = createGlassSurface('GlassCard',  { base: 'glass-card',  defaultTag: 'div' });
export const GlassPanel = createGlassSurface('GlassPanel', { base: '',            defaultTag: 'div' });
export const GlassModal = createGlassSurface('GlassModal', { base: 'glass-modal', defaultTag: 'div' });
export const GlassNav   = createGlassSurface('GlassNav',   { base: 'glass-nav',   defaultTag: 'nav' });
export const GlassScrim = createGlassSurface('GlassScrim', { base: 'glass-scrim', defaultTag: 'div' });
```

`<GlassButton>` is the one surface authored explicitly rather than via the factory, because it carries the extra `prominent` prop (appends `glass-button--prominent`); its ref/interactive wiring is identical. **None of them declare a single CSS property.** This is the DRY guarantee: the look has exactly one home, and it's [`assets/glass.css`](../assets/glass.css).

> The sketch above elides the polymorphic `as` generics, the `PolymorphicProps` typing, and the explicit `GlassButton` body for readability — read [`assets/Glass.tsx`](../assets/Glass.tsx) for the fully-typed source. The class output, the cumulative level stacking, and the `mergeRefs` interactive wiring are reproduced faithfully.

---

## Exports at a glance

| Export | Kind | Notes |
|---|---|---|
| `GlassCard` | component | `glass glass-card`, `as="div"` |
| `GlassPanel` | component | bare `glass`, `as="div"` |
| `GlassModal` | component | `glass glass-modal`, `as="div"` — **panel only**, pair with `GlassScrim` |
| `GlassScrim` | component | `glass glass-scrim`, `as="div"` — full-viewport blurred backdrop |
| `GlassNav` | component | `glass glass-nav`, `as="nav"` — sticky topbar |
| `GlassButton` | component | `glass glass-button` (+ `--prominent`), `as="button"` |
| `GlassFilter` | component | mounts SVG `<defs>`; `#glass-refract` always, `#glass-goo` via `goo` |
| `useGlassPointer` | hook | rAF-throttled `--mx`/`--my` writer, live reduced-motion sync |
| `useGlassMorphTransition` | hook | spring config for framer-motion `transition`, snaps under reduced motion (see [Tier A morph](#tier-a-morph--framer-motion-layoutid)) |

Types are exported too: `GlassLevel`, `GlassTheme`, `GlassOwnProps`, `GlassButtonOwnProps`, `GlassFilterProps`, `PolymorphicProps`.

---

## SSR / Next.js

`glass.css` is plain CSS and SSRs with zero issues — no `window`, no measurement, no hydration concern. The only client-side pieces are the pointer hook and (because they may host it) the interactive components.

### `'use client'`

`useGlassPointer` uses `useEffect`, `useRef`, and `window.matchMedia` — it must run on the client. `assets/Glass.tsx` starts with `'use client'`, so importing any wrapper into a Server Component is safe; the file is a client boundary. If you split the hook into your own module, **keep `'use client'` at the top of whatever file defines it.**

The **non-interactive** wrappers (a plain `<GlassCard level={2}>` with no `interactive`) are pure class-emitters and would be fine as Server Components — but since they live in the same `'use client'` file, they render on the client too. That's harmless (they have no client-only logic and no hydration mismatch). If you want a server-rendered glass surface with zero client JS, just write the classes directly in a Server Component:

```tsx
// Server Component — no hook, no client boundary needed:
export function ServerCard() {
  return <div className="glass glass--l2 glass-card">Rendered on the server</div>;
}
```
That's the ultimate expression of the DRY rule: the classes work with **no JavaScript at all.** The React layer is a convenience, never a requirement.

### Stable filter id (hydration)

`<GlassFilter>` must render **the same `id` on the server and the client** or React flags a hydration mismatch and Chromium may briefly lose the refraction. So:

- **Use a literal, stable id** (the default `glass-refract`, or a hard-coded namespaced string). ✅
- **Do not** feed `id` from `useId()`, `Math.random()`, `Date.now()`, or anything non-deterministic — the server and client strings won't match, and the `url(#…)` in `glass.css` is a fixed literal anyway, so a generated id wouldn't even be referenced. ❌

```tsx
// app/layout.tsx (Server Component is fine — GlassFilter renders static SVG)
import { GlassFilter } from '@/components/Glass';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlassFilter goo />   {/* one stable #glass-refract (+ #glass-goo) for the whole app */}
        {children}
      </body>
    </html>
  );
}
```
Mount `<GlassFilter>` once in the root layout and every page/route reuses the same defs. Add `goo` here if any route uses the `.glass-goo` Tier B merge.

### Tailwind v4 interop

If you drive glass through the Tailwind `@utility glass` instead of (or alongside) raw `glass.css`, the React components don't care — they emit class strings, and `glass` resolves to whichever definition is loaded. You can even mix: use `<GlassPanel className="backdrop-blur-md bg-white/10 …">` to compose Tailwind utilities on a glass surface. The class-mapping table in [`tailwind-v4.md`](./tailwind-v4.md) shows the vanilla → utility equivalents. The contract names (`--blur-glass`, `--color-glass-tint`, `--radius-glass`, `@utility glass`) are stable across the CSS and Tailwind layers.

---

## Tier A morph — `framer-motion` `layoutId`

The web analog of iOS `glassEffectID` + `@Namespace`: a glass element that **flows** between two positions/sizes instead of cutting. In React the clean tool is `framer-motion`'s shared-layout animation — give two glass elements the same `layoutId` and Framer tweens one into the other, dragging the glass material along for the ride.

**`framer-motion` is an optional peer dependency, shown by example only.** `assets/Glass.tsx` never imports it (the import is commented out) — the core components compile and run with zero extra deps. You add `framer-motion` to your own project only if you want this morph.

For the spring timing, `Glass.tsx` exports **`useGlassMorphTransition()`** — a tiny, dependency-free hook returning a `{ type:'spring', stiffness, damping }` config you spread onto a motion element's `transition` prop. It flattens to an instant snap (`duration: 0`) under `prefers-reduced-motion`, so you get the reduced-motion guard for free without duplicating spring constants:

```tsx
'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useGlassMorphTransition } from './Glass';

// A pill that morphs between two slots. Same layoutId == same glass blob,
// flowing between positions. The glass classes ride on the motion element.
function MorphPill() {
  const [active, setActive] = useState<'a' | 'b'>('a');
  const transition = useGlassMorphTransition();   // snaps under reduced-motion
  return (
    <div className="row" onClick={() => setActive(a => (a === 'a' ? 'b' : 'a'))}>
      <div className="slot">
        {active === 'a' && (
          <motion.div layoutId="glass-pill" transition={transition}
                      className="glass glass--l2 glass-pill">
            Active
          </motion.div>
        )}
      </div>
      <div className="slot">
        {active === 'b' && (
          <motion.div layoutId="glass-pill" transition={transition}
                      className="glass glass--l2 glass-pill">
            Active
          </motion.div>
        )}
      </div>
    </div>
  );
}
```

Key points:
- The **glass `className` goes on the `motion.div`** — Framer animates layout (position/size); `glass.css` supplies the material. They're orthogonal, which is exactly why this composes cleanly.
- For a `<GlassButton>`/`<GlassCard>` that should morph, render it `as={motion.div}` (the polymorphic `as` makes the wrapper a `motion` element) and pass `layoutId` through the spread. The wrapper still emits only classes.
- Respect motion preferences: use `useGlassMorphTransition()` as above (it snaps under reduced motion), or wrap morphing regions in framer-motion's `MotionConfig reducedMotion="user"`. This mirrors the `useGlassPointer` reduced-motion guard.
- The **vanilla FLIP** equivalent (no framer-motion) is in [`morphing.md`](./morphing.md) — use it when you don't want the dependency.

For the gooey **Tier B** merge (`.glass-goo` + `#glass-goo`), see [`morphing.md`](./morphing.md); the React side is just rendering `.glass-goo` containers and ensuring `<GlassFilter goo>` mounted `#glass-goo`.

---

## The DRY note (read once)

The React layer is intentionally thin:

- **`glass.css` owns the look.** Every visual property — blur, tint, rim, specular, depth, elevation, presets, components — is defined there and nowhere else.
- **The components emit class strings.** `<GlassCard level={2}>` is `class="glass glass--l2 glass-card"` with a ref and a `data-glass-theme`. That's the whole job.
- **The hook writes two CSS variables.** `useGlassPointer` sets `--mx`/`--my`; the *appearance* of the highlight is still pure CSS.
- **`<GlassFilter>` mounts SVG defs.** It declares filter primitives, not styles.

So if a design review says "make the glass warmer" or "thicker rim," you edit `glass.css` once and **every** vanilla element, every Tailwind utility, and every React component updates together. Nothing to chase across `.tsx` files. That single-source-of-truth property is the entire reason the React layer holds no glass logic — and the reason you should resist the urge to add a `style={{ backdropFilter: … }}` shortcut in a component. If you find yourself reaching for inline glass styles, add a token or a component class to `glass.css` instead.

---

## See also

- [`../assets/Glass.tsx`](../assets/Glass.tsx) — the source you copy into your project.
- [`../assets/glass.css`](../assets/glass.css) — the single source of truth for the material.
- [`levels.md`](./levels.md) — what `level={1|2|3}` actually switches on, the `#glass-refract` filter, browser support.
- [`tailwind-v4.md`](./tailwind-v4.md) — `@utility glass` + the vanilla → utility class map for `className` composition.
- [`morphing.md`](./morphing.md) — Tier A FLIP (vanilla) and Tier B gooey merge in depth.
- [`fallbacks-a11y.md`](./fallbacks-a11y.md) — `prefers-reduced-*`, contrast-on-glass, perf budget ("don't glass everything").
- [`../SKILL.md`](../SKILL.md) — the hub: mental model, token schema, decision flowchart.
