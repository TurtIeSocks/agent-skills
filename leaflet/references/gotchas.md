# Leaflet Gotchas (and how to fix them)

This is the file you'll consult most often. Almost every "my Leaflet map is broken" question is one of these. They're ordered roughly by frequency.

## 1. Map renders as a gray rectangle / blank container

**Symptom**: A box appears where the map should be, but no tiles load.

**Cause**: Either no tile layer was added, or the container has zero height.

**Fix A** — Add a tile layer:

```js
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);
```

**Fix B** — Give the container an explicit height. CSS `height: 100%` only works when the parent has a height too. The chain stops at `<html>` and `<body>`, which default to `auto`.

```css
html, body { height: 100%; margin: 0; }
#map { height: 100%; }
/* Or: */
#map { height: 500px; }
```

In React/Vue/Svelte, set the height inline if you're not sure the surrounding CSS will cooperate:

```tsx
<MapContainer style={{ height: '500px' }} ... />
```

---

## 2. Marker icons broken (default blue pin missing or stretched)

**Symptom**: Markers are positioned correctly but show no image, or a fragment of an image, or a broken-image icon.

**Cause**: Leaflet's default icon URLs are resolved relative to the path of `leaflet.css`. Bundlers (webpack, Vite, Parcel, Next.js, etc.) rewrite asset paths during build, so the URLs Leaflet generates point to nonexistent files.

**Fix**: Monkey-patch the default icon URLs at app startup. Do this once, at your entry point (e.g., `main.ts`, `index.tsx`, or before any map renders).

```ts
import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
```

**Why the `delete`?** Leaflet caches the computed URL on the prototype. Without deleting it, your `mergeOptions` is ignored on the second-and-later icon instances.

If you're not using a bundler that turns `.png` imports into URLs (rare in 2026), point the URLs at CDN copies:

```ts
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
```

---

## 3. "ReferenceError: window is not defined" (Next.js, Nuxt, SvelteKit, Remix)

**Symptom**: Server crashes at import time with `ReferenceError: window is not defined` or `document is not defined`.

**Cause**: Leaflet touches the DOM at module load. Server-side rendering executes the import on Node, where `window` doesn't exist.

**Fix (Next.js App Router)**: dynamic-import the map component with SSR disabled.

```tsx
// app/components/MapWrapper.tsx
'use client';
import dynamic from 'next/dynamic';

export const MapWrapper = dynamic(
  () => import('./Map').then(mod => mod.Map),
  { ssr: false, loading: () => <div>Loading map…</div> }
);
```

```tsx
// app/page.tsx
import { MapWrapper } from './components/MapWrapper';
export default function Page() { return <MapWrapper />; }
```

**`'use client'` alone is not enough** — client components are still pre-rendered on the server during initial render. Only `dynamic(..., { ssr: false })` actually skips the server render.

**Fix (Pages Router)**: same idea.

```tsx
import dynamic from 'next/dynamic';
const Map = dynamic(() => import('../components/Map'), { ssr: false });
```

**Fix (SvelteKit)**: wrap the Leaflet import in `onMount` (client-only), or use `+page.ts` with `export const ssr = false;`.

**Fix (Remix)**: render the map only inside `useEffect` after a client-side flag flips.

---

## 4. Map is mis-sized after a parent container changes (sidebars, tabs, modals)

**Symptom**: The map renders correctly at first, but after a sidebar collapses, a tab becomes visible, or a modal opens, the tiles only fill part of the container — there's a gray band on one or two sides.

**Cause**: Leaflet caches the container's dimensions internally and only recomputes on `window.resize`. If the container itself resized without the window changing, Leaflet doesn't know.

**Fix**: Call `map.invalidateSize()` after the layout change.

```js
sidebar.addEventListener('transitionend', () => map.invalidateSize());

// Or after a timer if you can't hook into the transition:
setTimeout(() => map.invalidateSize(), 300);
```

In React:

```tsx
function HandleResize({ trigger }: { trigger: unknown }) {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map, trigger]);
  return null;
}
```

For frequent resizes, debounce with a `ResizeObserver`:

```js
const ro = new ResizeObserver(() => map.invalidateSize());
ro.observe(mapContainer);
// remember to ro.disconnect() on cleanup
```

---

## 5. "Map container is already initialized" error

**Symptom**: After navigating away and back to a page with a map (or hot-reloading in dev), you get `Error: Map container is already initialized.`

**Cause**: A previous `L.map(container)` left a `_leaflet_id` property on the DOM element. On re-init, Leaflet refuses to clobber it.

**Fix**: Always call `map.remove()` on teardown. In React effects:

```tsx
useEffect(() => {
  const map = L.map(containerRef.current!).setView([51.5, -0.09], 13);
  return () => { map.remove(); };
}, []);
```

`react-leaflet` handles this for you — if you're seeing this error inside react-leaflet, you've probably mounted two `<MapContainer>`s pointing at the same element, or you've manually instantiated a map inside a child component.

---

## 6. CSS not loading / map looks like garbage

**Symptom**: Markers stack diagonally, tiles overlap, controls float in nonsense positions. The whole map looks "fallen apart."

**Cause**: `leaflet.css` is not loaded.

**Fix**: Import it at the top of your entry file:

```ts
import 'leaflet/dist/leaflet.css';
```

Or include via CDN if no bundler:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

For plugins, each one needs its CSS imported too:

```ts
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
```

---

## 7. Tiles look blurry on retina/HiDPI

**Cause**: 256px tiles are upscaled by the browser.

**Fix**: Use `detectRetina: true` (if your provider supports `{r}` tiles), or use 512px tiles with `tileSize: 512, zoomOffset: -1`:

```js
// Mapbox-style 512px tiles
L.tileLayer('https://api.mapbox.com/.../tiles/{z}/{x}/{y}?access_token=...', {
  tileSize: 512,
  zoomOffset: -1,
});

// OSM retina via {r}
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}{r}.png', {
  detectRetina: true,
});
```

---

## 8. Pop-ups don't appear above other layers / cut off at map edge

**Symptom**: Popup shows but is hidden behind another control or cropped at the map boundary.

**Cause A**: A custom pane with a high z-index is on top.

**Fix**: Move the popup pane higher, or your custom pane lower:

```js
map.getPane('popupPane').style.zIndex = 700;   // it's 700 by default
```

**Cause B**: `autoPan` is disabled and the popup hits the edge.

**Fix**: keep `autoPan: true` (the default), or set `maxWidth` smaller, or set `autoPanPadding: [20, 20]`.

---

## 9. Click events fall through to the map from a custom control

**Symptom**: Clicking a button you added inside `L.Control.extend` zooms or drags the map.

**Cause**: Leaflet propagates DOM events to the map by default.

**Fix**: Call `L.DomEvent.disableClickPropagation` (and optionally `disableScrollPropagation`) on the control element:

```js
const InfoControl = L.Control.extend({
  onAdd() {
    const el = L.DomUtil.create('div', 'leaflet-bar info-control');
    el.innerHTML = '<button>?</button>';
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    return el;
  },
});
```

The same applies inside popup content if it has interactive widgets:

```js
const div = document.createElement('div');
div.innerHTML = '<button>Click me</button>';
L.DomEvent.disableClickPropagation(div);
marker.bindPopup(div);
```

---

## 10. GeoJSON `style` callback doesn't affect points

**Symptom**: You pass a `style` function but point features still render as default markers.

**Cause**: `style` is only applied to lines and polygons. Points need `pointToLayer`.

**Fix**:

```js
L.geoJSON(data, {
  pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
    radius: 6,
    color: feature.properties.color,
    fillOpacity: 0.8,
  }),
  style: feature => ({ color: feature.properties.color }),   // lines/polygons
});
```

---

## 11. Coordinates "look wrong" (showing wrong country)

**Symptom**: You pass coordinates and the marker lands in the wrong hemisphere or in the ocean.

**Cause**: You're feeding GeoJSON coordinates `[lng, lat]` to a Leaflet API that expects `[lat, lng]`, or vice versa.

**Fix**: Memorize this:

- **Leaflet expects `[lat, lng]`**. Always. `L.marker`, `L.latLng`, all of it.
- **GeoJSON uses `[lng, lat]`**. Always. The spec, every export from QGIS, every database `ST_AsGeoJSON` result.
- **`L.geoJSON(...)` handles the swap for you** when you feed it a GeoJSON object. But if you read `feature.geometry.coordinates` manually, you'll need to swap.

```js
// Reading raw GeoJSON
const [lng, lat] = feature.geometry.coordinates;
L.marker([lat, lng]).addTo(map);   // swap when passing to Leaflet
```

---

## 12. Mobile pinch-zoom or two-finger pan doesn't work

**Symptom**: Touch gestures don't work as expected.

**Cause**: Either `touchZoom: false` was set, or the page has a CSS rule like `touch-action: none` on a parent that interferes.

**Fix**: Make sure these are not disabled, and remove conflicting CSS:

```js
L.map('map', {
  touchZoom: true,
  tap: true,
  dragging: true,
});
```

For mobile maps inside a scrollable page, often the better UX is to **require two fingers to pan** (so single-finger scroll moves the page, not the map):

```js
L.map('map', { dragging: true, tap: true })
  .gestureHandling   // requires leaflet-gesture-handling plugin
```

Or use the `Leaflet.GestureHandling` plugin which shows a "Use two fingers to move the map" overlay when single-finger panning is attempted.

---

## 13. Hot reload duplicates the map in dev

**Symptom**: After a hot reload in webpack/Vite dev mode, the map renders correctly but with two visible map containers stacked, or duplicated controls.

**Cause**: HMR re-runs your module without unmounting the previous map.

**Fix**: In React, the cleanup function of `useEffect` solves this. In vanilla code, check for an existing instance:

```js
if ((map as any)._leaflet_id) {
  map.remove();
}
const newMap = L.map('map')...
```

In dev only, a more pragmatic fix is to disable HMR for the map module.

---

## 14. Empty map at certain zoom levels / "no map data" gray tiles

**Symptom**: Tiles render at some zooms but not others.

**Cause A**: `maxZoom` not set on tile layer (defaults too high) or `minZoom` too low.

**Cause B**: Tile provider has a different supported zoom range than what you've configured the map for.

**Fix**: Match the tile layer's range to the provider's documentation. OSM is `0–19`. Mapbox is `0–22`. CARTO is typically `0–18`.

```js
L.tileLayer(url, { minZoom: 0, maxZoom: 19 }).addTo(map);
L.map('map', { minZoom: 0, maxZoom: 19 });
```

---

## 15. "Map is empty after fitBounds" (single point case)

**Symptom**: With a single marker, `map.fitBounds(group.getBounds())` zooms to infinity (or to maxZoom with the marker dead-center, often too zoomed in).

**Cause**: A bounds with one point has zero area. `fitBounds` zooms to fit zero area = maximum zoom.

**Fix**: Detect the single-point case and use `setView` instead:

```js
const layers = group.getLayers();
if (layers.length === 1 && layers[0] instanceof L.Marker) {
  map.setView(layers[0].getLatLng(), 14);
} else {
  map.fitBounds(group.getBounds(), { padding: [40, 40] });
}
```

Or always pad the bounds:

```js
map.fitBounds(group.getBounds().pad(0.5), { maxZoom: 14 });
```

---

## 16. Production tile usage gets blocked by OpenStreetMap

**Symptom**: OSM tiles start returning 418, 429, or just nothing after some deployment traffic.

**Cause**: OSM's tile server is a community resource — `https://tile.openstreetmap.org` has a [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) that prohibits "heavy use" by individual sites. They will block you.

**Fix**: For anything beyond hobby traffic, use a commercial or self-hosted tile provider:
- Stadia Maps, CARTO, MapTiler, Mapbox, ESRI — all have free tiers + paid plans.
- Self-host via `tileserver-gl`, `OpenMapTiles`, or `Mapnik`.

This is not optional — it's the foundation's policy. Build with this assumption from day one.
