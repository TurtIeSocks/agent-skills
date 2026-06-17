// displacement-map.js — generate a radial "lens" displacement map for L3 glass refraction.
//
// WHY: the default L3 filter in glass.css uses feTurbulence (random noise) → organic,
// rippled frost. That reads as textured glass, not as a *lens*. A real lens bends the
// background hardest at the rim and leaves the centre flat. This generator bakes that
// edge-lensing into a static image: each pixel's RED channel encodes an x-displacement
// and GREEN a y-displacement (neutral = 128, range ±127). Feed it to feDisplacementMap
// via <feImage> instead of feTurbulence:
//
//   <filter id="glass-refract-lens" x="0" y="0" width="100%" height="100%">
//     <feImage href="<dataURL from makeDisplacementMap()>" result="map"
//              x="0" y="0" width="W" height="H" preserveAspectRatio="none"/>
//     <feDisplacementMap in="SourceGraphic" in2="map"
//        scale="40" xChannelSelector="R" yChannelSelector="G"/>
//   </filter>
//   .lens { backdrop-filter: blur(2px) saturate(180%) url(#glass-refract-lens); }
//
// The map is SIZE-SPECIFIC: backdrop-filter's filter region does NOT auto-fit the element
// (a known gotcha — see references/levels.md), so the map's W×H must match the element.
// Regenerate on resize (a ResizeObserver, or the useGlassLens hook in Glass.tsx).
//
// This is a practical approximation of the Snell's-law derivation in
// https://kube.io/blog/liquid-glass-css-svg/ — close enough for UI, far cheaper to reason about.

/**
 * Signed distance from point (px,py) to a rounded-rect [0,0,w,h] with corner radius r.
 * Returns the signed distance (negative inside) and the OUTWARD unit normal at that point.
 * Standard rounded-box SDF (Inigo Quilez), plus a normal derived from the field gradient.
 */
function roundedRectSDF(px, py, w, h, r) {
  const cx = w / 2;
  const cy = h / 2;
  // position relative to centre, folded into the first quadrant
  const qx = Math.abs(px - cx) - (cx - r);
  const qy = Math.abs(py - cy) - (cy - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  const outside = Math.hypot(ax, ay);
  const inside = Math.min(Math.max(qx, qy), 0);
  const dist = outside + inside - r; // < 0 inside the panel

  // Outward normal: in the corner arcs it points along (ax,ay); along the straight
  // bands it points along whichever axis is closest to the edge.
  const sx = Math.sign(px - cx) || 1;
  const sy = Math.sign(py - cy) || 1;
  let nx;
  let ny;
  if (qx > 0 || qy > 0) {
    const len = outside || 1;
    nx = (sx * ax) / len;
    ny = (sy * ay) / len;
  } else if (qx > qy) {
    nx = sx;
    ny = 0;
  } else {
    nx = 0;
    ny = sy;
  }
  return { dist, nx, ny };
}

/**
 * Smooth 0→1→0 bump across the bezel band (sine hump). t in [0,1].
 */
function bump(t) {
  return Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
}

/**
 * Build a displacement-map data URL for a rounded-rect glass surface.
 *
 * @param {object} opts
 * @param {number} opts.width   element width in px (map is rendered at this size)
 * @param {number} opts.height  element height in px
 * @param {number} [opts.radius=24]   corner radius in px (match the element's border-radius)
 * @param {number} [opts.bezel=24]    width of the refracting rim band in px
 * @param {number} [opts.sign=1]      +1 convex (pull background outward), -1 concave
 * @returns {string} a PNG data URL, or '' on the server (no canvas)
 */
export function makeDisplacementMap({ width, height, radius = 24, bezel = 24, sign = 1 } = {}) {
  if (typeof document === 'undefined') return ''; // SSR / no-DOM guard
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(w, h);
  const data = img.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const { dist, nx, ny } = roundedRectSDF(x + 0.5, y + 0.5, w, h, radius);
      const fromEdge = -dist; // >= 0 inside the panel
      let mag = 0;
      if (fromEdge >= 0 && fromEdge < bezel) {
        mag = bump(fromEdge / bezel) * sign; // peaks mid-bezel, 0 at edge + inner bezel
      }
      // Displace along the INWARD normal so the rim samples the background from outside →
      // the classic "fat edge" lensing. Encode unit vector*profile into R/G (neutral 128).
      const dx = -nx * mag;
      const dy = -ny * mag;
      const i = (y * w + x) * 4;
      data[i] = 128 + Math.max(-1, Math.min(1, dx)) * 127; // R = x displacement
      data[i + 1] = 128 + Math.max(-1, Math.min(1, dy)) * 127; // G = y displacement
      data[i + 2] = 128; // B unused (room for chromatic-aberration experiments)
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

export default makeDisplacementMap;
