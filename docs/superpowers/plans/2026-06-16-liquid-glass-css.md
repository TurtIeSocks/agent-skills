# liquid-glass-css Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is executed via an orchestrated, adversarially-verified Workflow (ultracode).

**Goal:** Ship a new repo skill `liquid-glass-css` — the web/CSS counterpart to the iOS `liquid-glass-design` skill — teaching layered "liquid glass"/glassmorphism for vanilla CSS, Tailwind v4, and React.

**Architecture:** SKILL.md hub + `references/` deep docs + `assets/` drop-in artifacts + `evals/`. A single **design-system contract** (token + class names below) is the shared interface every file consumes, guaranteeing cross-file consistency. Glass = a stack of 6 optical layers driven by CSS custom properties; 3 fidelity levels, 3 presets, 5 components, Tier A/B morphing.

**Tech Stack:** Vanilla CSS (custom properties, `backdrop-filter`, SVG filters), Tailwind v4 (`@theme`/`@utility`), React 19 + TypeScript (optional `framer-motion` peer).

**Source spec:** `docs/superpowers/specs/2026-06-16-liquid-glass-css-design.md` (read it; this plan does not repeat its prose).

---

## Design System Contract (the shared interface — ALL files MUST match these names exactly)

**CSS custom-property tokens** (defined on `:root`, overridden by presets):
```
--glass-blur            --glass-saturate
--glass-tint            --glass-tint-opacity        --glass-fill
--glass-border          --glass-radius
--glass-highlight       --glass-inner-shadow        --glass-shadow
--mx  --my              (pointer-tracking specular, set by JS; default 50%)
```

**Base rule:** `.glass` MUST set `position: relative; isolation: isolate;` so `::before/::after` sheen anchors and the stacking context is contained.

**Classes:**
```
.glass                         base material (L1) + fallback-first
.glass--l2  .glass--l3         fidelity levels (stack on .glass)
.glass--interactive            enables pointer specular (reads --mx/--my)
.glass-card                    radius-xl panel
.glass-button  .glass-button--prominent
.glass-nav                     sticky toolbar/topbar
.glass-pill  .glass-badge      small capsules
.glass-modal  .glass-scrim     centered panel + blurred backdrop
.glass-goo                     gooey-merge container (Tier B)
[data-glass-theme="dark"|"light"|"tinted"]   presets (dark = default)
```

**SVG filter ids:** `#glass-refract` (L3 displacement), `#glass-goo` (Tier B gooey merge).

**Tailwind v4 names:** `@theme` → `--blur-glass`, `--color-glass-tint`, `--radius-glass`; custom `@utility glass`.

**React API** (`assets/Glass.tsx`, `references/react.md`):
```
<GlassFilter id="glass-refract" />        mounts the SVG filter defs once
useGlassPointer<T extends HTMLElement>()  returns ref; sets --mx/--my on pointermove
<GlassCard>  <GlassButton>  <GlassPanel>  <GlassModal>
  props: level?: 1|2|3; prominent?: boolean; theme?: 'dark'|'light'|'tinted';
         interactive?: boolean; as?: ElementType; className?: string; + native props
```
React components emit the classes above and add **zero** glass logic. framer-motion shown by example only (morph), never imported by the core components.

---

## Task 0: RED baseline (writing-skills Iron Law — capture gaps before writing the skill)

**Files:** none (produces findings used to tune emphasis).

- [ ] **Step 1: Run baseline scenarios WITHOUT the skill.** Dispatch 3 fresh subagents, each given ONLY the scenario (no skill, no spec):
  1. "In plain CSS, build a frosted-glass stat card for a dark dashboard (translucent, blurred background showing through). Give me the CSS."
  2. "My `.card { backdrop-filter: blur(10px) }` shows nothing / looks wrong. Why, and how do I fix it?"
  3. "Build a React glass card component with an Apple-style liquid look."
- [ ] **Step 2: Record gaps verbatim.** Expected baseline failures (the skill must close these): only `blur` (no saturate/tint/specular/depth), missing `-webkit-backdrop-filter`, no `@supports` fallback (unreadable if unsupported), no contrast-on-glass handling, flat single-layer look, no `position` on parent for pseudo, no `prefers-reduced-*`.
- [ ] **Step 3: Confirm gaps map to spec sections.** Each gap must be addressed by a planned file. List any gap with no home → add coverage.

---

## Task 1: `assets/glass.css` — canonical stylesheet (source of truth)

**Files:** Create `liquid-glass-css/assets/glass.css`

Single drop-in file, authored in this order so it reads top-down:
1. `:root` token block (exact names from contract) — dark preset values are the defaults.
2. Fallback-first base: `.glass { background: rgb(var(--glass-tint)/.6); position:relative; isolation:isolate; border:1px solid var(--glass-border); border-radius:var(--glass-radius); box-shadow:var(--glass-shadow); }` then `@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` upgrade adding the translucent fill + `backdrop-filter` (+ `-webkit-` prefix).
3. `.glass--l2` (gradient fill + inset highlight + inner depth) + `.glass--l2::before` sheen.
4. `.glass--l3` (`backdrop-filter: ... url(#glass-refract)`) + animated `::after` sheen, both inside `@media (prefers-reduced-motion: no-preference)` for the animation.
5. `.glass--interactive` pointer specular: radial-gradient at `var(--mx) var(--my)` via `::before`; `@property --mx/--my` registration.
6. Components: `.glass-card`, `.glass-button` (+`--prominent`, `:hover/:active/:focus-visible`), `.glass-nav`, `.glass-pill`, `.glass-badge`, `.glass-modal`, `.glass-scrim`.
7. Presets: `[data-glass-theme="light"]` and `[data-glass-theme="tinted"]` override blocks (dark is `:root` default). Light preset MUST darken the rim (contrast gotcha).
8. `.glass-goo` gooey-merge container (applies `filter: url(#glass-goo)`), with a comment cross-referencing where `#glass-goo` is defined.
9. a11y media queries: `@media (prefers-reduced-transparency: reduce)` and `(prefers-contrast: more)` → solid fallbacks.

**Acceptance:** valid CSS (no parser errors); every token/class name matches the contract; `-webkit-backdrop-filter` present everywhere `backdrop-filter` is; fallback-first verified (base rule legible without `backdrop-filter`).

- [ ] Write the file per the above.
- [ ] Validate: load in `demo.html` (Task 2) renders without console errors.
- [ ] Commit.

---

## Task 2: `assets/demo.html` — self-contained live demo (primary verification surface)

**Files:** Create `liquid-glass-css/assets/demo.html`

Self-contained page (links or inlines `glass.css`), SEDELA-flavored: dark warm ambient gradient bg with colored blobs, then a grid showing: L1/L2/L3 cards side by side, a glass nav bar, glass buttons (regular + prominent), pills/badges, a modal trigger + scrim, and the **morph/merge toggles** (Tier A: a glass pill that moves/resizes between two states with a FLIP transition; Tier B: two `.glass-goo` blobs that merge on toggle). Includes the inline `<svg>` defs for `#glass-refract` and `#glass-goo`. A theme switcher cycles `data-glass-theme`.

**Acceptance:** opens standalone in a browser; glass visibly renders (blur+tint+specular); no console errors; toggles work without a framework.

- [ ] Write the file.
- [ ] Render it headless (Playwright/Preview), screenshot, confirm glass renders + no errors.
- [ ] Commit.

---

## Task 3: `assets/Glass.tsx` — typed React components

**Files:** Create `liquid-glass-css/assets/Glass.tsx`

Implements the React API from the contract. `'use client'` at top (pointer hook needs it). `useGlassPointer` adds a `pointermove` listener that writes `--mx/--my` (in %), guarded by `matchMedia('(prefers-reduced-motion: reduce)')`, cleaned up on unmount. Components build `className` from props (`level`→`glass--l{n}`, `prominent`→`glass-button--prominent`, `interactive`→`glass--interactive`) merged with user `className`; `theme` sets `data-glass-theme`; polymorphic `as`; `forwardRef`. `<GlassFilter>` returns the hidden `<svg>` with `#glass-refract` (+ optional `#glass-goo`) defs, id configurable. A commented morph example using `framer-motion` `motion.div` + `layoutId` (import guarded/commented so the file compiles without the dep).

**Acceptance:** self-consistent TypeScript (imports `React`, exported types); class strings match contract; no glass CSS logic duplicated; framer-motion not a hard import.

- [ ] Write the file.
- [ ] Review for type-consistency + contract class names (no toolchain in repo; review-verified, like `leaflet/assets/react-map.tsx`).
- [ ] Commit.

---

## Task 4: `SKILL.md` — the hub

**Files:** Create `liquid-glass-css/SKILL.md`

Frontmatter `name: liquid-glass-css` + the approved description string (from spec). Body, scannable (~250–350 lines): When to use / when NOT (+ 2 cross-links to `liquid-glass-design`); the 6-layer model table; the token schema block; L1 + L2 recipe inline; a **decision flowchart** (which level? does the target browser need the L3 fallback? glass-on-light?) — small, only because the level/fallback choice is non-obvious; quick-reference tables (levels, components, presets); and a "deep dive →" pointer table to each `references/` file. Loud one-liners: "glass is layered, not just blur", "always pair `-webkit-`", "fallback-first", "don't glass everything".

**Acceptance:** valid frontmatter (name = folder, description third-person "Use when…"); every `references/` file linked; inline code matches contract; under ~400 lines.

- [ ] Write the file.
- [ ] Commit.

---

## Tasks 5–9: `references/` deep docs

Each: Create the file; content fully specified by the spec section of the same topic; every code sample uses contract names; cross-link back to SKILL.md and sibling refs. Commit after each.

- [ ] **Task 5 — `references/levels.md`:** L1/L2/L3 full deep dive; the `#glass-refract` filter explained; gradient-rim techniques (`border-image` + masked `::after`); browser support matrix (`backdrop-filter`, `backdrop-filter: url()`, `@supports`); fallback chain rationale.
- [ ] **Task 6 — `references/components.md`:** full CSS for all 5 components incl. every interaction state; modal + scrim + fixed-position note; prominent button variant.
- [ ] **Task 7 — `references/tailwind-v4.md`:** `@theme` token block; `@utility glass`; vanilla-class → utility-class mapping table; L3 `url()` arbitrary-value note; dark/light/tinted via `@variant`/data-attr.
- [ ] **Task 8 — `references/react.md`:** the full React API with usage examples; SSR/Next.js notes; `useGlassPointer` source; Tier A morph via `layoutId`; DRY note (wraps classes only).
- [ ] **Task 9 — `references/morphing.md`:** Tier A (framer-motion `layoutId` + vanilla FLIP helper); Tier B (gooey `#glass-goo` filter `feGaussianBlur`→`feColorMatrix`, composing with `backdrop-filter` via mask, loud caveats + perf); Tier C (WebGL pointer paragraph, no impl).
- [ ] **Task 10 — `references/fallbacks-a11y.md`:** `@supports` patterns; `prefers-reduced-transparency`/`-reduced-motion`/`-contrast`; contrast-on-glass (WCAG, text-shadow, denser tint behind text); perf (`contain:paint`, never animate blur radius, no nested backdrop-filters, count limits, mobile); the "don't glass everything" anti-pattern list (mirrors iOS skill).

---

## Task 11: `evals/evals.json` — retrieval + application eval cases

**Files:** Create `liquid-glass-css/evals/evals.json`

Match the repo's eval shape (inspect `tanstack-form/evals/evals.json` and `typescript-string-literals/evals/` first for the exact schema). Encode: retrieval probes (does the skill cover refraction? Tailwind `@utility`? React `<GlassCard>`? light-glass gotcha? fallback?) and application scenarios (the 3 RED scenarios from Task 0, now expecting layered glass + `-webkit-` + fallback + a11y).

**Acceptance:** valid JSON; schema matches sibling skills' evals; cases trace to Task 0 gaps + spec sections.

- [ ] Inspect sibling eval schema, write the file, validate JSON.
- [ ] Commit.

---

## Task 12: `README.md` — add skills-table row

**Files:** Modify `README.md` (the "Skills in this repo" table only)

Add one row (keep alphabetical-ish placement consistent with existing rows):
```
| `liquid-glass-css` | Web/CSS counterpart to iOS liquid-glass-design: layered "liquid glass"/glassmorphism for vanilla CSS, Tailwind v4, and React. 6-layer material model, 3 fidelity levels (incl. SVG refraction), presets, 5 components, and Tier A/B morphing. | `liquid-glass-css/SKILL.md` |
```

**Acceptance:** exactly one row added; table still renders; no other README edits.

- [ ] Edit, verify table, commit.

---

## Task 13: GREEN verification + integration (writing-skills GREEN)

**Files:** none (verification); fix-ups as needed.

- [ ] **Cross-file consistency:** grep every token/class/filter-id/React name across all files; flag any name not in the contract. Fix mismatches.
- [ ] **GREEN scenario re-test:** dispatch fresh subagents on the 3 Task-0 scenarios, this time WITH the skill (SKILL.md + relevant refs). Verify each output now: layers (not just blur), `-webkit-`, fallback-first, a11y. Capture any NEW gap → patch the skill.
- [ ] **Demo render proof:** final headless render of `demo.html`; screenshot attached as the "it works" artifact.
- [ ] **Self-review vs spec:** walk every spec section → confirm a file covers it.
- [ ] Final commit if any fix-ups.

---

## Notes
- DRY: `glass.css` is the single source of truth; references quote it, React wraps it, Tailwind mirrors it. No copy of the glass look in two places that could drift.
- YAGNI: no Vue/Svelte components (one-line note), no build tooling, no Tier C morph impl.
- Commits: one per task (frequent commits).
