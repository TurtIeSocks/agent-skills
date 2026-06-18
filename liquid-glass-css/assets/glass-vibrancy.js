// glass-vibrancy.js — approximate adaptive vibrancy (Tier 2).
//
// Apple's Liquid Glass lightens over dark content and darkens over light content,
// and keeps foreground text legible — it samples the live framebuffer. Pure CSS
// can't read what's behind an element, so this is the JS approximation: sample
// the average luminance of a DRAWABLE backdrop under an element's rect, then pick
// glass tokens that stay legible.
//
// ponytail: the backdrop must be DRAWABLE — an <img>, <canvas>, or <video>. This
// CANNOT sample arbitrary live DOM (that needs html2canvas or the Tier-3 WebGL
// path). For a DOM backdrop, snapshot it to a <canvas> yourself and pass that.
// It must also FILL its box (object-fit: fill / the default) — object-fit
// cover/contain crops/letterboxes the content, so the screen-rect -> source
// mapping would sample the wrong region.

const _cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const _ctx = _cv ? _cv.getContext('2d', { willReadFrequently: true }) : null;

/**
 * Average relative luminance (0 = black … 1 = white) of a normalized sub-rect of
 * a drawable source. nx/ny/nw/nh are 0..1 fractions of the source.
 * @returns {number} 0..1 (returns 0.5 if it can't sample)
 */
export function sampleLuminance(source, nx, ny, nw, nh) {
  if (!_ctx || !source) return 0.5;
  const W = 64;
  const H = 64;
  _cv.width = W;
  _cv.height = H;
  try {
    _ctx.drawImage(source, 0, 0, W, H);
  } catch {
    return 0.5; // broken/undecodable source (the tainted case throws at getImageData below)
  }
  const sx = Math.max(0, Math.min(W - 1, Math.floor(nx * W)));
  const sy = Math.max(0, Math.min(H - 1, Math.floor(ny * H)));
  const sw = Math.max(1, Math.min(W - sx, Math.round(nw * W)));
  const sh = Math.max(1, Math.min(H - sy, Math.round(nh * H)));
  let data;
  try {
    data = _ctx.getImageData(sx, sy, sw, sh).data;
  } catch {
    return 0.5;
  }
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 709 luma, normalized to 0..1
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    n += 1;
  }
  return n ? sum / n : 0.5;
}

/**
 * Map a backdrop luminance to glass tokens that keep the surface legible:
 * light glass + light text over dark content; dark glass + dark text over light.
 * @param {number} lum 0..1
 * @returns {{ tint: string, opacity: number, fg: string }}
 */
export function vibrancyTokens(lum) {
  const backdropIsLight = lum > 0.5;
  return backdropIsLight
    ? { tint: '18 20 26', opacity: 0.26, fg: 'rgb(15 17 22)' } // dark glass on light bg
    : { tint: '255 255 255', opacity: 0.1, fg: 'rgb(255 255 255)' }; // light glass on dark bg
}

/**
 * Apply adaptive vibrancy to `el` from a drawable `source` once.
 * Computes el's rect relative to the source's on-screen rect, samples, and sets
 * `--glass-tint`, `--glass-tint-opacity`, and `color` on `el`.
 */
export function applyVibrancy(el, source) {
  if (!el || !source) return;
  const er = el.getBoundingClientRect();
  const sr = source.getBoundingClientRect();
  if (!sr.width || !sr.height) return;
  const lum = sampleLuminance(
    source,
    (er.left - sr.left) / sr.width,
    (er.top - sr.top) / sr.height,
    er.width / sr.width,
    er.height / sr.height,
  );
  const t = vibrancyTokens(lum);
  el.style.setProperty('--glass-tint', t.tint);
  el.style.setProperty('--glass-tint-opacity', String(t.opacity));
  el.style.color = t.fg;
}
