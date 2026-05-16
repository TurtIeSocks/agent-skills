# Leaflet 2.0 Migration

Leaflet 2.0 (alpha as of August 2025, still alpha through May 2026) is the first major release since 2016. It's a modernization, not a feature redesign — most APIs are the same, but the *way you call them* changes meaningfully.

## Should you migrate yet?

**As of May 2026: probably not for production**, unless:
- You're starting a brand-new project with no plugin dependencies
- You explicitly want ESM-first imports and modern syntax
- You're comfortable being an early adopter on alpha software

The reason: **most plugins still target Leaflet 1.9**. `leaflet.markercluster`, `leaflet-draw`, `leaflet-routing-machine`, `react-leaflet-cluster`, etc. — many haven't completed v2 compatibility work. If you depend on any plugins, stay on 1.9.4 until they catch up.

For projects without plugins, v2-alpha is usable and gives you a cleaner codebase.

---

## What changes in v2

### 1. ESM is the only distribution

v1 shipped UMD (the `L` global), CommonJS (Node `require`), and ESM. v2 ships **only ESM**, plus a separate `leaflet-global.js` bundle for legacy compatibility.

```js
// v1
import L from 'leaflet';
const map = L.map('map');

// v2 (ESM, the new way)
import L, { Map, TileLayer, Marker } from 'leaflet';
const map = new Map('map');
```

### 2. No more factory functions — use constructors

Every `L.something()` factory has a corresponding `Something` class. In v1, the factory was the recommended API; in v2, constructors are.

| v1 | v2 |
|---|---|
| `L.map('id')` | `new Map('id')` |
| `L.marker([0, 0])` | `new Marker([0, 0])` |
| `L.tileLayer(url)` | `new TileLayer(url)` |
| `L.polygon([...])` | `new Polygon([...])` |
| `L.geoJSON(data)` | `new GeoJSON(data)` |
| `L.circle([0, 0], 500)` | `new Circle([0, 0], { radius: 500 })` |
| `L.icon({...})` | `new Icon({...})` |
| `L.divIcon({...})` | `new DivIcon({...})` |
| `L.control.layers(...)` | `new Control.Layers(...)` |

The factories still exist via the default `L` export for backward compatibility, so you can mix styles during migration:

```js
import L from 'leaflet';   // still works
L.marker([0, 0]).addTo(map);   // still works
```

But for new code in v2, constructors are the documented path.

### 3. The `L` global is gone (mostly)

v1 attached `L` to `window` automatically when loaded via `<script>`. v2 does not. Use:

- Bundlers: `import L from 'leaflet'` — works as before.
- Script tags: `<script src=".../leaflet-global.js">` (separate bundle that restores the global).

Plugins that assumed `window.L` exists need either an explicit import or the legacy global bundle.

### 4. Pointer Events replace mouse/touch handling

v1 had separate code paths for mouse and touch. v2 uses [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) uniformly. For app code, this is mostly transparent — your `click` / `mousedown` handlers still fire. For plugin authors, the touch-specific shim is gone.

### 5. IE support dropped

IE11 polyfills, fallbacks, and feature detection are removed. Modern evergreen browsers only (Chrome, Firefox, Safari, Edge).

### 6. `layers.png` → `layers.svg`

The Control.Layers control icon is now an SVG. If you bundle assets manually (Vite/webpack asset modules), check that `leaflet/dist/images/layers.svg` is being included.

### 7. `LeafletMap` alias

`Map` shadows the built-in `Map` collection class, which can cause confusion. v2 introduces `LeafletMap` as an explicit alias:

```js
import { LeafletMap } from 'leaflet';
const m = new LeafletMap('map');
```

Use this if you're already using JS `Map` in the same file.

---

## What stays the same

- Map view methods: `setView`, `flyTo`, `fitBounds`, `getCenter`, `getZoom`
- All layer methods: `addTo`, `remove`, `bindPopup`, `bindTooltip`
- Vector geometry: lat/lng tuples, GeoJSON support
- Event API: `on`, `off`, `once`, `fire`
- Path styling options
- The basic mental model (Map + TileLayer + Layers + Controls)

---

## Side-by-side: the minimal example

### v1 (current)

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map').setView([51.505, -0.09], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  L.marker([51.5, -0.09]).addTo(map).bindPopup('Hi');
</script>
```

### v2-alpha (ESM module)

```html
<script type="importmap">
{ "imports": { "leaflet": "https://unpkg.com/leaflet@2.0.0-alpha.1/dist/leaflet.js" } }
</script>
<script type="module">
  import { Map, TileLayer, Marker } from 'leaflet';

  const map = new Map('map').setView([51.505, -0.09], 13);
  new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  new Marker([51.5, -0.09]).addTo(map).bindPopup('Hi');
</script>
```

### v2-alpha (legacy global script — for plugin compatibility)

```html
<script src="https://unpkg.com/leaflet@2.0.0-alpha.1/dist/leaflet-global.js"></script>
<script>
  // window.L exists; v1-style code works
  const map = new L.Map('map').setView([51.505, -0.09], 13);
  // note: factory function L.map(...) still works too
</script>
```

---

## Migration strategy when the time comes

1. **Update Leaflet**: `npm install leaflet@^2`
2. **Update peer plugins**: bump react-leaflet to whatever v6+ ships when it lands. Update markercluster, draw, etc. — wait if they haven't released v2-compatible versions.
3. **Codemod (your own, ~30 lines)**: replace `L.foo(args)` with `new Foo(args)` for the factory list. Mostly mechanical. The `L.` factories still work in v2, so this is optional, but it's the new house style.
4. **Test the icon paths**: v2 changed the Control.Layers icon to SVG. Make sure your bundler picks it up.
5. **Drop manual mouse-vs-touch handling**: if you have any code branching on `L.Browser.touch`, simplify to Pointer Events.

---

## What about `react-leaflet`?

`react-leaflet 5.x` targets Leaflet 1.9. A future major version will target Leaflet 2 — as of May 2026, it's not released. Track [the GitHub repo](https://github.com/PaulLeCam/react-leaflet/releases) for the v2-compatible release.

When it lands, the migration on the React side will be small — the wrapper components hide most of the change. Your JSX will mostly stay the same; the under-the-hood imports flip.

---

## Sticking with v1.9.4

The Leaflet team has explicitly committed to keeping v1.9 in maintenance mode for critical bug fixes. It's not getting new features, but it's not being abandoned either. For a stable production map app in 2026, **v1.9.4 + the existing plugin ecosystem is the boring, correct choice.**
