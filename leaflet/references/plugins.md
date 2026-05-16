# Leaflet Plugins

Leaflet's small core ships with markers, popups, vectors, and tiles. Almost everything else is a plugin. There are hundreds — these are the ones you'll actually reach for, organized by what you're trying to do.

## How to install any Leaflet plugin

The pattern is the same for nearly every plugin:

```bash
npm install leaflet.<plugin-name>
```

```js
import L from 'leaflet';
import 'leaflet.<plugin-name>';                // side-effect import — attaches to L
import 'leaflet.<plugin-name>/dist/style.css';  // if it ships CSS

// Now use it on L:
L.markerClusterGroup();
```

The side-effect import is the key — most Leaflet plugins extend the global `L` namespace at import time. **Don't try to destructure** the plugin export; just import it for side effects.

---

## Clustering: leaflet.markercluster

**Use when**: you have >100 markers and your map is becoming a sea of overlapping pins.

```bash
npm install leaflet.markercluster
npm install -D @types/leaflet.markercluster
```

```js
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const cluster = L.markerClusterGroup({
  chunkedLoading: true,        // build across animation frames — essential for >1000 markers
  maxClusterRadius: 80,        // pixels; smaller = more clusters
  spiderfyOnMaxZoom: true,     // fan out overlapping markers at max zoom
  showCoverageOnHover: false,  // disable the convex-hull overlay (often distracting)
  zoomToBoundsOnClick: true,
  disableClusteringAtZoom: 18, // stop clustering past this zoom
});

points.forEach(p => {
  cluster.addLayer(L.marker([p.lat, p.lng]).bindPopup(p.name));
});
map.addLayer(cluster);
```

Custom cluster icons (e.g., color by count, brand-matched):

```js
const cluster = L.markerClusterGroup({
  iconCreateFunction: c => L.divIcon({
    html: `<div class="cluster-pin">${c.getChildCount()}</div>`,
    className: 'cluster-wrapper',
    iconSize: [40, 40],
  })
});
```

React version: `react-leaflet-cluster` — see `references/react-leaflet.md`.

---

## Drawing and editing: Leaflet-Geoman

**The recommended choice.** Geoman is the modern, actively maintained drawing/editing plugin — successor to `leaflet.pm`, far richer than `leaflet-draw` (whose last commit was 2018).

```bash
npm install @geoman-io/leaflet-geoman-free
```

```js
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

map.pm.addControls({ position: 'topleft' });
map.on('pm:create', (e) => {
  console.log(e.layer.toGeoJSON());
});
```

That's the 30-second version. **For anything beyond hello-world — draw modes, edit modes, snapping, cutting, rotation, customization, React integration, persisting drawn shapes, Pro features (scale/split/measure/auto-trace), gotchas — see the dedicated [`references/geoman.md`](./geoman.md).** It's a deep dive, organized so you can jump to the section you need.

### Should I use the older leaflet-draw instead?

Almost certainly no. Geoman covers everything leaflet-draw does plus rotation, cutting, snapping, an active release cadence, in-package TypeScript types, and a Pro tier for advanced needs. Leaflet-draw is in maintenance-only mode (last meaningful commit September 2018) and is increasingly behind on modern bundler/SSR support. Use it only if you're maintaining an existing app already on it and the cost of migrating outweighs the benefit.


---

## Heatmaps: leaflet.heat

**Use when**: you want to show point density as a continuous color gradient.

```bash
npm install leaflet.heat
```

```js
import 'leaflet.heat';

const heat = L.heatLayer(
  points.map(p => [p.lat, p.lng, p.intensity ?? 1]),   // [lat, lng, weight]
  {
    radius: 25,
    blur: 15,
    maxZoom: 17,
    max: 1.0,
    gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' },
  }
).addTo(map);

// Update data later:
heat.setLatLngs(newPoints);
```

No types ship with the package; add a minimal declaration if using TypeScript:

```ts
// types/leaflet-heat.d.ts
import 'leaflet';
declare module 'leaflet' {
  function heatLayer(latlngs: any[], options?: any): any;
}
```

---

## Routing: leaflet-routing-machine

**Use when**: you need actual turn-by-turn directions over real roads (not just polylines).

```bash
npm install leaflet-routing-machine
```

```js
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

L.Routing.control({
  waypoints: [
    L.latLng(51.505, -0.09),
    L.latLng(48.857, 2.351),
  ],
  routeWhileDragging: true,
  // Default backend: OSRM demo (NOT for production)
  router: L.Routing.osrmv1({
    serviceUrl: 'https://router.project-osrm.org/route/v1',
  }),
}).addTo(map);
```

**For production**: don't use the OSRM demo server — it's not for heavy use and has no SLA. Self-host OSRM, use GraphHopper, Mapbox Directions, or HERE.

---

## Geocoding: leaflet-control-geocoder

**Use when**: you want a search bar that converts addresses → coordinates.

```bash
npm install leaflet-control-geocoder
```

```js
import 'leaflet-control-geocoder';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';

L.Control.geocoder({
  defaultMarkGeocode: true,
  geocoder: L.Control.Geocoder.nominatim({
    geocodingQueryParams: { countrycodes: 'us,ca' },
  }),
}).addTo(map);
```

Backends include Nominatim (free, OSM-based, rate-limited), Mapbox, Google, Bing, Photon, Pelias.

**Nominatim's usage policy**: ~1 req/sec. For production, use a paid provider or self-host Nominatim.

---

## Fullscreen toggle: leaflet.fullscreen

```bash
npm install leaflet.fullscreen
```

```js
import 'leaflet.fullscreen';
import 'leaflet.fullscreen/Control.FullScreen.css';

L.control.fullscreen({ position: 'topright' }).addTo(map);
```

---

## Mini-map: leaflet-minimap

```bash
npm install leaflet-minimap
```

```js
import 'leaflet-minimap';
import 'leaflet-minimap/dist/Control.MiniMap.min.css';

const miniLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
new L.Control.MiniMap(miniLayer, { toggleDisplay: true }).addTo(map);
```

---

## Vector tiles: Leaflet.VectorGrid

**Use when**: you want Mapbox-style vector tiles in a Leaflet map. (For heavy vector tile usage, MapLibre GL is genuinely a better fit — but if you're locked into Leaflet, this works.)

```bash
npm install leaflet.vectorgrid
```

```js
import 'leaflet.vectorgrid';

L.vectorGrid.protobuf('https://example.com/tiles/{z}/{x}/{y}.pbf', {
  vectorTileLayerStyles: {
    'land': { fill: true, fillColor: '#eee', stroke: false },
    'roads': { weight: 1, color: '#888' },
  },
  interactive: true,
}).on('click', (e) => console.log(e.layer.properties)).addTo(map);
```

---

## Server-side / large dataset rendering: Leaflet.canvas-markers, supercluster

For 10,000+ markers, default markers (DOM elements) get sluggish. Two approaches:

### Canvas marker rendering

Render markers to a `<canvas>` instead of individual `<img>` elements:

```js
L.canvas({ padding: 0.5 });   // built into Leaflet core

L.circleMarker([lat, lng], {
  renderer: L.canvas(),
  radius: 5
}).addTo(map);
```

Or use a plugin like `leaflet-canvas-marker` for image-based canvas markers.

### Supercluster (faster than leaflet.markercluster for huge datasets)

For 100,000+ points, the `supercluster` library (by Mapbox) is significantly faster than leaflet.markercluster. There's no first-class Leaflet plugin, but it's a few dozen lines of glue:

```js
import Supercluster from 'supercluster';

const index = new Supercluster({ radius: 60, maxZoom: 16 });
index.load(geoJsonFeatures);   // your point features

function updateClusters() {
  const bounds = map.getBounds();
  const zoom = map.getZoom();
  const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  const clusters = index.getClusters(bbox, zoom);

  layer.clearLayers();
  clusters.forEach(c => {
    const [lng, lat] = c.geometry.coordinates;
    if (c.properties.cluster) {
      // Cluster — render as count bubble
      L.marker([lat, lng], { icon: clusterIcon(c.properties.point_count) }).addTo(layer);
    } else {
      // Individual point
      L.marker([lat, lng]).addTo(layer);
    }
  });
}
map.on('moveend zoomend', updateClusters);
updateClusters();
```

More performance patterns in `references/performance.md`.

---

## Animated markers: leaflet.marker.slideto / leaflet.movingmarker

For animated movement along a path (e.g., tracking a vehicle):

```bash
npm install leaflet.marker.slideto
```

```js
import 'leaflet.marker.slideto';

marker.slideTo([newLat, newLng], { duration: 1000, keepAtCenter: false });
```

---

## Plugin compatibility caveats

**leaflet.markercluster + Leaflet 2.0 (alpha)**: As of mid-2026, the plugin ecosystem still targets Leaflet 1.9. The maintainers of leaflet.markercluster are tracking compatibility but full v2 support isn't there yet. **Stay on Leaflet 1.9.4 if you depend on plugins.**

**No-types plugins**: many community plugins lack TypeScript definitions. The minimal mitigation is a one-line `declare module` stub (see `references/typescript.md`).

**Side-effect imports**: if your bundler does aggressive tree-shaking, mark plugin imports as side-effecting in `package.json` or use explicit `import 'plugin-name'` (not `import * from`). Tree-shaking plugin imports = silent failure where the plugin appears not to exist.
