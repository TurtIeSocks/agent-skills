// Type declarations for displacement-map.js (shipped as plain ESM .js so the
// vanilla/demo path can import it directly in the browser). Lets Glass.tsx import
// it under strict tsc without `allowJs`.

export interface DisplacementMapOptions {
  /** Element width in px (the map is rendered at this size). */
  width: number;
  /** Element height in px. */
  height: number;
  /** Corner radius in px — match the element's border-radius. Default 24. */
  radius?: number;
  /** Width of the refracting rim band in px. Default 24. */
  bezel?: number;
  /** +1 convex (rim pulls background outward), -1 concave. Default 1. */
  sign?: number;
}

/**
 * Build a radial "lens" displacement-map PNG data URL for a rounded-rect glass
 * surface. Returns '' on the server (no canvas). Feed to feDisplacementMap via
 * <feImage> — see the file header for the filter wiring.
 */
export function makeDisplacementMap(options: DisplacementMapOptions): string;

export default makeDisplacementMap;
