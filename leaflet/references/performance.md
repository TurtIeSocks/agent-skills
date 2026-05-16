# Leaflet Performance

Leaflet is fast at the "default" scale: a hundred markers, a few thousand GeoJSON features, a dozen vector shapes. Push beyond that and you start hitting walls. This reference covers the patterns that get you to 10k, 100k, even 1M+ features.

## Where it gets slow (in order)

1. **DOM marker count**. Each `L.marker` is a `<div>` plus a `<img>`. Browsers fall over around 1000–2000 visible markers.
2. **SVG vector layer count**. Each `L.polygon` is an SVG element. Hundreds is fine, thousands lags pans.
3. **JS-side data processing on every map move**. Recomputing all features per pan/zoom kills frame rate.
4. **Tile request volume**. Lots of layers at once + a fast pan = burst of requests, the browser caps at ~6 per origin.

Each section below targets one of these bottlenecks.

---

## 1. Too many markers → use clustering or canvas

### Threshold ~ 200 visible markers: clustering

```js
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const cluster = L.markerClusterGroup({
  chunkedLoading: true,        // build over multiple frames
  chunkInterval: 200,          // ms of work per frame
  chunkDelay: 50,              // ms idle between chunks
  maxClusterRadius: 80,
  removeOutsideVisibleBounds: true,
  animate: false,              // disable for >5k markers
  spiderfyOnMaxZoom: true,
});

// Build outside the cluster, then add as a batch — much faster:
const markers = points.map(p => L.marker([p.lat, p.lng]).bindPopup(p.name));
cluster.addLayers(markers);
map.addLayer(cluster);
```

`addLayers(arrayOfMarkers)` is 5–10× faster than calling `addLayer` per marker, because it pre-builds the cluster index.

### Threshold ~ 5,000 markers: canvas circle markers

DOM markers become a problem at this scale. Switch to canvas-rendered circle markers:

```js
const canvasRenderer = L.canvas({ padding: 0.5 });

points.forEach(p => {
  L.circleMarker([p.lat, p.lng], {
    renderer: canvasRenderer,    // <-- canvas instead of SVG/DOM
    radius: 4,
    fillColor: p.color,
    fillOpacity: 0.8,
    stroke: false,
  }).addTo(map);
});
```

A single `<canvas>` element holds all of them. Smooth pan/zoom up to ~50k circles.

Trade-off: canvas markers don't fire mouseover/mouseout per-feature efficiently (Leaflet does hit-testing manually). Click events work fine.

### Threshold > 50k markers: supercluster

`leaflet.markercluster` slows down past ~50k markers. Use Mapbox's `supercluster` library directly — it's an order of magnitude faster because it pre-builds a hierarchical index in a typed array.

```js
import Supercluster from 'supercluster';

const index = new Supercluster({
  radius: 60,
  maxZoom: 16,
  minPoints: 3,
});

// Load GeoJSON-style point features (one-time):
index.load(features);   // [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties }, ...]

const layer = L.layerGroup().addTo(map);

function update() {
  const bounds = map.getBounds();
  const zoom = Math.round(map.getZoom());
  const bbox: [number, number, number, number] = [
    bounds.getWest(), bounds.getSouth(),
    bounds.getEast(), bounds.getNorth(),
  ];

  const clusters = index.getClusters(bbox, zoom);

  layer.clearLayers();
  for (const c of clusters) {
    const [lng, lat] = c.geometry.coordinates;
    if (c.properties.cluster) {
      // It's a cluster — render the count
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'cluster',
          html: `<div>${c.properties.point_count_abbreviated}</div>`,
          iconSize: [40, 40],
        })
      }).addTo(layer);
    } else {
      // Individual point
      L.circleMarker([lat, lng], { radius: 5 }).addTo(layer);
    }
  }
}

map.on('moveend zoomend', update);
update();
```

A million points is achievable this way on a modest laptop.

---

## 2. Too many vectors → simplify or canvas-render

### Simplify geometry server-side

Most "this polygon is laggy" cases are over-detailed geometry. A country border at country-level zoom doesn't need 50,000 vertices; it needs ~500.

Tools: `mapshaper` (CLI + web app), `topojson-simplify`, PostGIS `ST_Simplify`. Aim for **the smallest geometry that looks right at your typical zoom**, not the most accurate possible.

### Canvas renderer for vectors

Same trick as markers — render polygons/polylines via `<canvas>`:

```js
const canvasRenderer = L.canvas();

L.geoJSON(data, {
  renderer: canvasRenderer,   // applies to all child vector layers
  style: featureStyle,
}).addTo(map);
```

SVG rendering blocks the main thread per element. Canvas renders all features in one pass — much smoother for thousands of features.

Trade-off: canvas vectors don't support per-element CSS (no `.my-region:hover { ... }`), and they can't be inspected in DOM dev tools. You can still attach hover/click handlers programmatically.

---

## 3. Move-end recomputation → debounce, viewport-bound, cache

### Debounce/throttle move-end work

```js
let raf: number | null = null;
map.on('move', () => {
  if (raf !== null) return;
  raf = requestAnimationFrame(() => {
    raf = null;
    updateFeaturesForViewport();
  });
});
```

Use `move` (continuous, throttled to RAF) or `moveend` (fires once per gesture). For "fetch new data per region," use `moveend` — for "show count in a sidebar," use `move`.

### Only render what's visible

```js
const visible = features.filter(f => {
  const [lng, lat] = f.geometry.coordinates;
  return map.getBounds().contains([lat, lng]);
});
```

For polygons, use `bounds.intersects(featureBounds)`. Pre-compute feature bounds once if checking the same features repeatedly.

### Spatial index for fast bounds queries

For 10k+ features, a linear scan per move-end becomes the bottleneck. Use a spatial index:

```js
import RBush from 'rbush';

const tree = new RBush<{minX:number; minY:number; maxX:number; maxY:number; feature:any}>();
tree.load(features.map(f => {
  const [lng, lat] = f.geometry.coordinates;
  return { minX: lng, minY: lat, maxX: lng, maxY: lat, feature: f };
}));

map.on('moveend', () => {
  const b = map.getBounds();
  const visible = tree.search({
    minX: b.getWest(), minY: b.getSouth(),
    maxX: b.getEast(), maxY: b.getNorth(),
  }).map(r => r.feature);
  // render visible
});
```

`RBush` does this in O(log n) instead of O(n) per query.

---

## 4. Tile request flooding → preload, cap, throttle

### Pre-cache nearby tiles

```js
import 'leaflet.tilelayer.colorfilter';   // example, similar plugins exist

L.tileLayer(url, {
  keepBuffer: 4,    // tiles beyond the visible area kept in cache (default 2)
  updateWhenIdle: true,   // don't update during pan, only after
  updateWhenZooming: false,
}).addTo(map);
```

- `keepBuffer` larger = smoother pans, more memory.
- `updateWhenZooming: false` cuts tile requests during pinch-zoom (animation is interpolated instead).

### Limit concurrent requests

Browsers cap ~6 simultaneous requests per origin. If you have multiple tile layers from the same domain, you're competing. Either:

- Use providers with multiple subdomains (`{s}` substitution).
- Self-host with HTTP/2 or HTTP/3 (multiplexing eliminates the cap).

---

## Memory: cleanup on unmount

Maps that mount and unmount in SPAs without proper cleanup leak. Every layer holds references to event handlers, DOM elements, and image objects.

```js
// Vanilla
map.remove();   // call before destroying the container

// react-leaflet handles this automatically.
```

For long-running pages that add/remove many layers, watch:

```js
const layer = L.layerGroup().addTo(map);
layer.clearLayers();     // removes children, but layer itself stays
map.removeLayer(layer);  // removes the group from the map
layer.remove();          // same as above
```

Profile in dev tools: take a heap snapshot, navigate, take another, look for retained `L.Marker` / `L.Layer` instances.

---

## Profiling checklist

When a map feels slow, work this list in order:

1. **Frame rate**: open dev tools Performance tab, record a pan/zoom. Frames over 16ms = jank.
2. **Number of DOM elements** in the map container. `document.querySelectorAll('#map *').length`. If >5000, you're at the wall.
3. **Number of network requests** during a pan. Browser dev tools Network tab. If >50/sec, you're flooding.
4. **JS heap size** before and after several map interactions. Constant growth = leak.

Most problems show up in one of these four. Fix in this order: DOM elements (clustering/canvas), then JS work (spatial index, throttle), then network (preload, throttle), then memory (cleanup).
