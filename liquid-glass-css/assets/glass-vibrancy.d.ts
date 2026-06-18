// Type declarations for glass-vibrancy.js (Tier 2 adaptive vibrancy).

export type VibrancySource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

/** Average relative luminance (0..1) of a normalized sub-rect of a drawable source. */
export function sampleLuminance(
  source: CanvasImageSource,
  nx: number,
  ny: number,
  nw: number,
  nh: number,
): number;

/** Map backdrop luminance to legibility-preserving glass tokens. */
export function vibrancyTokens(lum: number): { tint: string; opacity: number; fg: string };

/** Sample the backdrop under `el` and set `--glass-tint` / `--glass-tint-opacity` / `color`. */
export function applyVibrancy(el: HTMLElement, source: VibrancySource): void;
