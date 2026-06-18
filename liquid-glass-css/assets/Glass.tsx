'use client';

/**
 * Glass.tsx — typed React wrappers for the `liquid-glass-css` design system.
 *
 * DRY CONTRACT: this file owns ZERO glass styling. The entire look lives in
 * `assets/glass.css` (the single source of truth). These components only:
 *   - compose contract class names from props,
 *   - set the `data-glass-theme` preset attribute,
 *   - mount the SVG filter defs once (`<GlassFilter>`),
 *   - and wire the optional pointer-tracking specular (`useGlassPointer`).
 *
 * Drop `glass.css` into your app (import it once, e.g. `import './glass.css'`),
 * render one `<GlassFilter />` near the root, then use the components below.
 *
 * Class mapping (props → classes from the design-system contract):
 *   level: 1 | 2 | 3      → CUMULATIVE: 2 → `glass--l2`, 3 → `glass--l2 glass--l3`
 *                           (`.glass--l3` builds on `.glass--l2`; level 1 adds nothing)
 *   prominent: true       → `glass-button--prominent`  (GlassButton only)
 *   interactive: true     → `glass--interactive`       (reads --mx / --my)
 *   theme: 'dark'|'light'|'tinted' → `data-glass-theme="…"` attribute
 */

import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementType,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
// Sibling generator (plain ESM .js so the vanilla/demo path can import it in the
// browser too). In a TS project, allowJs (or a bundler's default JS resolution)
// makes this import resolve; the map is generated client-side only.
import { makeDisplacementMap } from './displacement-map.js';

/* ------------------------------------------------------------------ *\
   Shared types
\* ------------------------------------------------------------------ */

/** Fidelity level — how many optical layers are switched on. */
export type GlassLevel = 1 | 2 | 3;

/** Theme preset — overrides the token block via `[data-glass-theme]`. */
export type GlassTheme = 'dark' | 'light' | 'tinted';

/** Props shared by every glass surface (independent of the rendered tag). */
export interface GlassOwnProps {
  /** Fidelity level (default 1). 2 adds specular + depth; 3 adds SVG refraction. */
  level?: GlassLevel;
  /** Theme preset; sets `data-glass-theme`. Omit to inherit (`dark` is the root default). */
  theme?: GlassTheme;
  /** Enable pointer-tracking specular (`glass--interactive`, reads `--mx`/`--my`). */
  interactive?: boolean;
  /** Extra classes, merged after the generated glass classes. */
  className?: string;
  children?: ReactNode;
}

/**
 * Polymorphic prop helper: own props + the rendered element's native props,
 * with `as` choosing the tag. Native props that clash with own props are removed.
 */
export type PolymorphicProps<
  TElement extends ElementType,
  TOwn,
> = TOwn & {
  /** Render as a different element/component (default varies per component). */
  as?: TElement;
} & Omit<ComponentPropsWithoutRef<TElement>, 'as' | keyof TOwn>;

/* ------------------------------------------------------------------ *\
   className composition (the only "logic" in this file)
\* ------------------------------------------------------------------ */

/** Join truthy class fragments into a single className string. */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Merge several refs into a single callback ref so one DOM node can feed both
 * the internal pointer hook and the consumer's forwarded ref. Handles object
 * refs (`MutableRefObject`), callback refs, and `null`/`undefined` slots.
 */
function mergeRefs<T>(
  ...refs: Array<Ref<T> | undefined>
): (node: T | null) => void {
  return (node: T | null): void => {
    for (const ref of refs) {
      if (ref == null) continue;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as { current: T | null }).current = node;
      }
    }
  };
}

/**
 * Map a fidelity level to its CUMULATIVE level classes.
 * Levels stack: `.glass--l3` builds on top of `.glass--l2`, so a level-3 surface
 * carries BOTH. Level 1 is the bare `.glass` base and adds nothing extra.
 *   1 → (none)                 2 → `glass--l2`        3 → `glass--l2 glass--l3`
 */
function levelClass(level: GlassLevel | undefined): string | undefined {
  if (!level || level < 2) return undefined;
  return level >= 3 ? 'glass--l2 glass--l3' : 'glass--l2';
}

/**
 * Build the base glass class list shared by every surface.
 * `base` is the component's own root class (e.g. `glass-card`); every surface
 * also carries the foundational `glass` class so the material always applies.
 */
function glassClasses(
  base: string | undefined,
  { level, interactive, className }: GlassOwnProps,
): string {
  return cx(
    'glass',
    base,
    levelClass(level),
    interactive && 'glass--interactive',
    className,
  );
}

/* ------------------------------------------------------------------ *\
   useGlassPointer — pointer-tracking specular
   Writes `--mx` / `--my` (in %) on the element as the pointer moves.
   Honors `prefers-reduced-motion`; fully cleans up on unmount.
\* ------------------------------------------------------------------ */

/**
 * Returns a ref to attach to a `.glass--interactive` element. On `pointermove`
 * it sets the element's `--mx`/`--my` custom properties (as percentages) so the
 * CSS specular highlight follows the cursor.
 *
 * Guarded by `matchMedia('(prefers-reduced-motion: reduce)')`: when the user
 * prefers reduced motion, no listener is attached and the highlight stays at the
 * token default (50% 50%). SSR-safe — all DOM access is inside `useEffect`.
 *
 * @example
 * const ref = useGlassPointer<HTMLDivElement>();
 * return <GlassCard interactive ref={ref}>…</GlassCard>;
 */
export function useGlassPointer<T extends HTMLElement = HTMLElement>(): Ref<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (el == null || typeof window === 'undefined') return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;

    const onPointerMove = (event: PointerEvent): void => {
      if (frame !== 0) return; // throttle to one write per animation frame
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

    // Respect the live preference: bind only when motion is allowed, and
    // re-evaluate if the user toggles the setting while mounted.
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

/* ------------------------------------------------------------------ *\
   GlassFilter — mounts the SVG filter defs once
   Visually hidden; provides `#glass-refract` (L3 refraction) and, when
   `goo` is set, `#glass-goo` (the gooey merge). The id is configurable
   so multiple roots / micro-frontends can avoid collisions.
\* ------------------------------------------------------------------ */

export interface GlassFilterProps {
  /** Filter id used by `.glass--l3` (`backdrop-filter: … url(#id)`). Default `glass-refract`. */
  id?: string;
  /** Also emit the `#glass-goo` gooey-merge filter for the gooey-merge `.glass-goo`. */
  goo?: boolean;
  /** Override the gooey filter id (default `glass-goo`). */
  gooId?: string;
  /** Displacement strength for the refraction map (L3). Default 32. */
  scale?: number;
  /**
   * Also emit the `.glass--apple` Tier-1 ceiling filters: `#glass-refract-svg`
   * (no-JS gradient-map barrel refraction + chromatic aberration) and
   * `#glass-specular` (feSpecularLighting rim glint). Mount once if any surface
   * uses `.glass--apple`.
   */
  apple?: boolean;
}

const HIDDEN_SVG_STYLE: CSSProperties = {
  position: 'absolute',
  width: 0,
  height: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
};

/**
 * Render once near the application root. Outputs a zero-size, aria-hidden `<svg>`
 * containing the filter definitions the CSS references by id. Pure markup — the
 * actual displacement/blur is applied in `glass.css` via `url(#…)`.
 *
 * @example
 * <GlassFilter goo apple />   // mount L3 refraction + gooey + the apple ceiling
 */
export function GlassFilter({
  id = 'glass-refract',
  goo = false,
  gooId = 'glass-goo',
  scale = 32,
  apple = false,
}: GlassFilterProps): ReactElement {
  return (
    <svg aria-hidden="true" focusable="false" style={HIDDEN_SVG_STYLE}>
      <defs>
        {/* L3 refraction: fractal noise → displace the backdrop for a lensing edge. */}
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.009 0.013"
            numOctaves={2}
            seed={9}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Gooey merge: blur then crank alpha so overlapping blobs fuse. */}
        {goo ? (
          <filter id={gooId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        ) : null}

        {/* .glass--apple ceiling: gradient-map barrel refraction + chromatic
            aberration, and a feSpecularLighting rim glint. */}
        {apple ? (
          <>
            <filter
              id="glass-refract-svg"
              x="-15%"
              y="-15%"
              width="130%"
              height="130%"
              colorInterpolationFilters="sRGB"
            >
              <feImage
                result="map"
                preserveAspectRatio="none"
                href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cdefs%3E%3ClinearGradient id='x' x1='0' x2='1' y1='0' y2='0'%3E%3Cstop offset='0%25' stop-color='rgb(0,0,0)'/%3E%3Cstop offset='14%25' stop-color='rgb(128,0,0)'/%3E%3Cstop offset='86%25' stop-color='rgb(128,0,0)'/%3E%3Cstop offset='100%25' stop-color='rgb(255,0,0)'/%3E%3C/linearGradient%3E%3ClinearGradient id='y' x1='0' x2='0' y1='0' y2='1'%3E%3Cstop offset='0%25' stop-color='rgb(0,0,0)'/%3E%3Cstop offset='14%25' stop-color='rgb(0,128,0)'/%3E%3Cstop offset='86%25' stop-color='rgb(0,128,0)'/%3E%3Cstop offset='100%25' stop-color='rgb(0,255,0)'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23x)'/%3E%3Crect width='100' height='100' fill='url(%23y)' style='mix-blend-mode:screen'/%3E%3C/svg%3E"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={22}
                xChannelSelector="R"
                yChannelSelector="G"
                result="disp"
              />
              <feColorMatrix in="disp" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cr" />
              <feOffset in="cr" dx={2.8} dy={0} result="cr2" />
              <feColorMatrix in="disp" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cg" />
              <feColorMatrix in="disp" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cb" />
              <feOffset in="cb" dx={-2.8} dy={0} result="cb2" />
              <feBlend in="cr2" in2="cg" mode="screen" result="crg" />
              <feBlend in="crg" in2="cb2" mode="screen" />
            </filter>
            <filter id="glass-specular" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation={5} result="bump" />
              <feSpecularLighting
                in="bump"
                surfaceScale={12}
                specularConstant={1.3}
                specularExponent={18}
                lightingColor="#ffffff"
                result="spec"
              >
                <fePointLight x={120} y={-30} z={120} />
              </feSpecularLighting>
              <feComposite in="spec" in2="SourceAlpha" operator="in" />
            </filter>
          </>
        ) : null}
      </defs>
    </svg>
  );
}

/* ------------------------------------------------------------------ *\
   Lens refraction — radial displacement map (the `.glass--lens` variant)

   Unlike `<GlassFilter>` (static, size-agnostic), a lens map is SIZE-SPECIFIC:
   backdrop-filter's filter region does not auto-fit the element, so the map must
   be generated for the element's exact W×H. `useGlassLens` measures the element
   and (re)builds the map; `<GlassLensFilter>` mounts it as `#glass-refract-lens`,
   which `.glass--lens` in glass.css references.
\* ------------------------------------------------------------------ */

export interface GlassLensOptions {
  /** Corner radius in px — match the element's border-radius. Default 18. */
  radius?: number;
  /** Width of the refracting rim band in px. Default 24. */
  bezel?: number;
  /** +1 convex (rim pulls the background outward), -1 concave. Default 1. */
  sign?: number;
}

export interface GlassLensState<T extends HTMLElement> {
  /** Put this on the glass element — it is measured to size the map. */
  ref: Ref<T>;
  /** The generated displacement-map data URL (empty until measured / on the server). */
  map: string;
  /** The element's current border-box size, in px. */
  size: { width: number; height: number };
}

/**
 * Measure a glass element and generate a radial lens displacement map sized to it,
 * rebuilding on resize. Client-only (returns an empty map during SSR). Pair the
 * returned `ref` with a `<GlassLensFilter>` fed the returned `map`/`size`.
 *
 * @example
 * const { ref, map, size } = useGlassLens({ radius: 18, bezel: 26 });
 * return (
 *   <>
 *     <GlassLensFilter href={map} width={size.width} height={size.height} />
 *     <GlassCard level={2} ref={ref} className="glass--lens">…</GlassCard>
 *   </>
 * );
 */
export function useGlassLens<T extends HTMLElement = HTMLElement>(
  options: GlassLensOptions = {},
): GlassLensState<T> {
  const { radius = 18, bezel = 24, sign = 1 } = options;
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [map, setMap] = useState('');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect(); // border-box — matches the filter region
      setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!size.width || !size.height) return;
    setMap(makeDisplacementMap({ width: size.width, height: size.height, radius, bezel, sign }));
  }, [size.width, size.height, radius, bezel, sign]);

  return { ref: ref as Ref<T>, map, size };
}

export interface GlassLensFilterProps {
  /** Filter id `.glass--lens` references. Default `glass-refract-lens`. */
  id?: string;
  /** Displacement-map data URL from `useGlassLens` / `makeDisplacementMap`. */
  href: string;
  /** Map dimensions in px — must match the element (from `useGlassLens().size`). */
  width: number;
  height: number;
  /** Max displacement in px (feDisplacementMap scale). Default 40. */
  scale?: number;
}

/**
 * Mount the lens refraction filter. Renders nothing until it has a map + size.
 * For several differently-sized lens surfaces, render one per size with distinct
 * `id`s and point each element at its id via an inline `backdrop-filter`.
 */
export function GlassLensFilter({
  id = 'glass-refract-lens',
  href,
  width,
  height,
  scale = 40,
}: GlassLensFilterProps): ReactElement | null {
  if (!href || !width || !height) return null;
  return (
    <svg aria-hidden="true" focusable="false" style={HIDDEN_SVG_STYLE}>
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%" primitiveUnits="userSpaceOnUse">
          <feImage
            result="map"
            preserveAspectRatio="none"
            href={href}
            x={0}
            y={0}
            width={width}
            height={height}
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

/* ------------------------------------------------------------------ *\
   Polymorphic surface factory
   Every component below is the same shape: pick a default tag, compose the
   contract classes, set `data-glass-theme`, forward the ref. Built once here.
\* ------------------------------------------------------------------ */

interface SurfaceConfig {
  /** Component's own root class, e.g. `glass-card`. */
  base: string;
  /** Default rendered tag when `as` is omitted. */
  defaultTag: ElementType;
}

function createGlassSurface(displayName: string, config: SurfaceConfig) {
  function Surface<TElement extends ElementType = ElementType>(
    props: PolymorphicProps<TElement, GlassOwnProps>,
    ref: ForwardedRef<Element>,
  ): ReactElement {
    const {
      as,
      level,
      theme,
      interactive,
      className,
      children,
      ...rest
    } = props as PolymorphicProps<ElementType, GlassOwnProps>;

    const Tag = (as ?? config.defaultTag) as ElementType;

    // Call the pointer hook unconditionally (hooks must run every render). It
    // only attaches listeners once mounted to a `.glass--interactive` node, so
    // it is a no-op when `interactive` is off. When `interactive` is on, merge
    // its ref with the consumer's forwarded ref so neither is clobbered.
    const pointerRef = useGlassPointer<HTMLElement>();
    const mergedRef = interactive
      ? mergeRefs<Element>(ref, pointerRef as Ref<Element>)
      : ref;

    return createElement(
      Tag,
      {
        ref: mergedRef,
        className: glassClasses(config.base, {
          level,
          interactive,
          className,
        }),
        'data-glass-theme': theme,
        ...rest,
      },
      children,
    );
  }

  Surface.displayName = displayName;

  // Cast the forwardRef result to a polymorphic-friendly callable type so
  // consumers keep `as`-driven prop inference at the call site.
  return forwardRef(Surface) as <TElement extends ElementType = ElementType>(
    props: PolymorphicProps<TElement, GlassOwnProps> & { ref?: Ref<Element> },
  ) => ReactElement;
}

/* ------------------------------------------------------------------ *\
   Components — classes only, zero glass logic.
\* ------------------------------------------------------------------ */

/** Frosted panel (`glass glass-card`). Default tag: `div`. */
export const GlassCard = createGlassSurface('GlassCard', {
  base: 'glass-card',
  defaultTag: 'div',
});

/** Generic glass surface (`glass`) with no component-specific geometry. Default tag: `div`. */
export const GlassPanel = createGlassSurface('GlassPanel', {
  base: '',
  defaultTag: 'div',
});

/** Centered modal panel (`glass glass-modal`). Pair with `<GlassScrim>`. Default tag: `div`. */
export const GlassModal = createGlassSurface('GlassModal', {
  base: 'glass-modal',
  defaultTag: 'div',
});

/** Sticky toolbar / topbar (`glass glass-nav`). Default tag: `nav`. */
export const GlassNav = createGlassSurface('GlassNav', {
  base: 'glass-nav',
  defaultTag: 'nav',
});

/** Blurred backdrop behind a modal (`glass-scrim`). Default tag: `div`. */
export const GlassScrim = createGlassSurface('GlassScrim', {
  base: 'glass-scrim',
  defaultTag: 'div',
});

/* GlassButton needs the extra `prominent` prop, so it is authored explicitly
   rather than via the surface factory (everything else is identical). */

export interface GlassButtonOwnProps extends GlassOwnProps {
  /** High-emphasis variant — adds `glass-button--prominent`. */
  prominent?: boolean;
}

function GlassButtonInner<TElement extends ElementType = 'button'>(
  props: PolymorphicProps<TElement, GlassButtonOwnProps>,
  ref: ForwardedRef<Element>,
): ReactElement {
  const {
    as,
    level,
    theme,
    interactive,
    prominent,
    className,
    children,
    ...rest
  } = props as PolymorphicProps<ElementType, GlassButtonOwnProps>;

  const Tag = (as ?? 'button') as ElementType;

  // Same wiring as the surface factory: hook runs every render, merges with the
  // forwarded ref only when `interactive` so the consumer's ref is preserved.
  const pointerRef = useGlassPointer<HTMLElement>();
  const mergedRef = interactive
    ? mergeRefs<Element>(ref, pointerRef as Ref<Element>)
    : ref;

  return createElement(
    Tag,
    {
      ref: mergedRef,
      className: cx(
        glassClasses('glass-button', { level, interactive, className: undefined }),
        prominent && 'glass-button--prominent',
        className,
      ),
      'data-glass-theme': theme,
      ...rest,
    },
    children,
  );
}

GlassButtonInner.displayName = 'GlassButton';

/** Interactive glass capsule (`glass glass-button`, `--prominent` optional). Default tag: `button`. */
export const GlassButton = forwardRef(GlassButtonInner) as <
  TElement extends ElementType = 'button',
>(
  props: PolymorphicProps<TElement, GlassButtonOwnProps> & { ref?: Ref<Element> },
) => ReactElement;

/* ------------------------------------------------------------------ *\
   Matched-geometry morph example — framer-motion `layoutId` (the web analog of iOS
   `glassEffectID` + `@Namespace`). framer-motion is an OPTIONAL peer dep:
   the import below is COMMENTED so this file compiles standalone with no
   extra dependency. Uncomment it (and `npm i framer-motion`) to use the
   pattern shown.

   The glass *material* never changes — `layoutId` animates the *shape and
   position* the material rides on, so a single glass pill flows between two
   layouts. Put the glass className on the `motion.div`; two elements sharing
   the same `layoutId` (one mounted at a time) tween into each other.

   ----------------------------------------------------------------------

   // import { motion } from 'framer-motion';
   //
   // export function GlassMorphExample({ expanded }: { expanded: boolean }) {
   //   return expanded ? (
   //     <motion.div
   //       layoutId="glass-morph"
   //       className="glass glass-card glass--l2"
   //       transition={{ type: 'spring', stiffness: 380, damping: 32 }}
   //     >
   //       Expanded panel
   //     </motion.div>
   //   ) : (
   //     <motion.button
   //       layoutId="glass-morph"
   //       className="glass glass-button glass--l2"
   //       transition={{ type: 'spring', stiffness: 380, damping: 32 }}
   //     >
   //       Open
   //     </motion.button>
   //   );
   // }
   //
   // Reduced-motion note: wrap the toggle in a `prefers-reduced-motion` check,
   // or pass framer-motion a `transition={{ duration: 0 }}` when the user opts
   // out, so the morph snaps instead of animating.
   //
   // Vanilla (no framer-motion) alternative — FLIP — lives in
   // `references/morphing.md`.
\* ------------------------------------------------------------------ */

/**
 * `useGlassMorphTransition` — a tiny, dependency-free spring config you can
 * spread onto a framer-motion element's `transition` prop, automatically
 * flattened to an instant snap under `prefers-reduced-motion`. Provided so the
 * morph example needs zero glass/animation constants duplicated elsewhere.
 *
 * @example
 * const transition = useGlassMorphTransition();
 * // <motion.div layoutId="x" transition={transition} className="glass glass-card" />
 */
export function useGlassMorphTransition(): {
  type: 'spring';
  stiffness: number;
  damping: number;
  duration?: number;
} {
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mq.matches;
    const onChange = (): void => {
      prefersReducedMotion.current = mq.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const make = useCallback(
    () =>
      prefersReducedMotion.current
        ? ({ type: 'spring', stiffness: 380, damping: 32, duration: 0 } as const)
        : ({ type: 'spring', stiffness: 380, damping: 32 } as const),
    [],
  );

  return make();
}
