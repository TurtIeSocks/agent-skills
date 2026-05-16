# React Leaflet

`react-leaflet` is the React binding for Leaflet. It does **not** replace Leaflet — it's a thin wrapper that lets you express Leaflet maps as JSX components. You still need to think in Leaflet terms (layers, panes, lifecycles); the wrapper just makes the DOM bits feel React-native.

## Versions (as of May 2026)

| react-leaflet | React | Leaflet | Notes |
|---|---|---|---|
| **5.x** | 19 | 1.9 | Current line. Use for new projects. |
| **4.x** | 18 | 1.9 | Still widespread. Same API as v5 for 99% of usage. |
| **3.x** | 17 | 1.7+ | Legacy. Different API (`MapContainer` was `Map`). Don't write new code against this. |
| **2.x** | <17 | <1.7 | Ancient. The `<Map>` component (not `<MapContainer>`) is the giveaway. |

This reference covers v4/v5 — they're nearly identical. If you find yourself debugging a `<Map>` component (no "Container" suffix), you're on v2/v3 and should upgrade or [consult the v3 docs](https://react-leaflet.js.org/docs/v3/start-introduction/).

---

## Install

```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet     # TypeScript users
```

You **do not** need a separate types package for `react-leaflet` itself — it ships its own. You **do** need `@types/leaflet` because react-leaflet re-exports types from it.

---

## The smallest working map

```tsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export function MyMap() {
  return (
    <MapContainer
      center={[51.505, -0.09]}
      zoom={13}
      style={{ height: '500px', width: '100%' }}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap"
      />
      <Marker position={[51.5, -0.09]}>
        <Popup>Hello, London</Popup>
      </Marker>
    </MapContainer>
  );
}
```

Three things that bite people on first try:
1. **Forgetting `import 'leaflet/dist/leaflet.css'`** — silent failure, map renders as broken positioned chaos.
2. **Forgetting `style={{ height: ... }}`** — `<MapContainer>` is a `<div>`; with no height, it's invisible.
3. **Putting the import in a Next.js server component** — see [Next.js section](#nextjs--ssr) below.

---

## The "props are mostly immutable" rule

This is the one mental shift react-leaflet asks of you. **Props passed to react-leaflet components are used at *creation time* and ignored when they change**, unless explicitly documented as mutable. This is the opposite of how most React components work.

```tsx
// ⚠️ This does NOT pan the map when `center` changes
<MapContainer center={dynamicCenter} zoom={13}>
  ...
</MapContainer>
```

If you want to pan/zoom dynamically, use an imperative side-effect component or a ref. See the [imperative escape hatch](#imperative-escape-hatch) below.

Mutable props (do update on change):
- `<TileLayer url={...} opacity={...} zIndex={...} />`
- `<Marker position={...} icon={...} draggable={...} opacity={...} />`
- `<Popup position={...} />`
- `<Circle radius={...} center={...} pathOptions={...} />`
- `<Polyline positions={...} pathOptions={...} />` (and Polygon, Rectangle)

So markers and shapes update fine; the *map view itself* doesn't.

---

## Imperative escape hatch

You'll need imperative Leaflet access for: dynamic view changes, accessing `getBounds()`, plugin integration, anything not covered by props.

There are two ways:

### Pattern 1: A child component using `useMap`

The most common, cleanest approach.

```tsx
import { MapContainer, TileLayer, useMap } from 'react-leaflet';

function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom);
  }, [map, center, zoom]);
  return null;   // renders nothing — it's purely a side-effect component
}

export function MyMap({ center, zoom }) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: 500 }}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FlyTo center={center} zoom={zoom} />
    </MapContainer>
  );
}
```

`useMap()` returns the underlying `L.Map` instance — you can call any Leaflet method on it. **It only works inside descendants of `<MapContainer>`**.

### Pattern 2: A ref on `<MapContainer>`

```tsx
import { useRef } from 'react';
import type { Map } from 'leaflet';

const mapRef = useRef<Map | null>(null);

<MapContainer ref={mapRef} center={[51.5, -0.09]} zoom={13} style={{ height: 500 }}>
  ...
</MapContainer>;

// Later, from a button click etc.:
mapRef.current?.flyTo([48.85, 2.35], 14);
```

Both work. The `useMap` child component pattern composes better and avoids one-off refs cluttering the parent.

---

## Hooks reference

| Hook | What it returns | Available where |
|---|---|---|
| `useMap()` | The `L.Map` instance | Inside `<MapContainer>` |
| `useMapEvent(eventName, handler)` | The `L.Map`; binds a single event | Inside `<MapContainer>` |
| `useMapEvents(handlersObject)` | The `L.Map`; binds multiple events | Inside `<MapContainer>` |

```tsx
function ClickHandler({ onPick }: { onPick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) { onPick(e.latlng); },
    zoomend() { /* ... */ },
  });
  return null;
}
```

This is how you wire up "let user click to place a pin" features.

---

## Markers with custom icons in react-leaflet

`L.icon` / `L.divIcon` work identically — pass the resulting icon as a prop:

```tsx
import L from 'leaflet';

const pinIcon = L.icon({
  iconUrl: '/pin.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

<Marker position={[51.5, -0.09]} icon={pinIcon}>
  <Popup>Hello</Popup>
</Marker>
```

For DivIcons (most flexible):

```tsx
const numberIcon = (n: number) => L.divIcon({
  className: 'count-pin',
  html: `<div>${n}</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

<Marker position={[51.5, -0.09]} icon={numberIcon(42)}>
  <Popup>Count: 42</Popup>
</Marker>
```

### The "broken marker icons" fix (default markers)

Default marker icons reference images by relative path baked into Leaflet's CSS. Most bundlers (webpack, Vite, Parcel) break those paths during build. You'll see marker positions but no image.

The standard fix is one block of code at the top of your app entry point:

```ts
import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// react-leaflet/Leaflet uses _getIconUrl internally; this monkey-patches it.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
```

In Next.js / Vite the imports will resolve as URLs. With Create React App, ditto. With webpack 4 you may need `?url` query suffixes — check your bundler docs.

---

## GeoJSON in react-leaflet

```tsx
import { GeoJSON } from 'react-leaflet';

<GeoJSON
  data={featureCollection}
  style={feature => ({ color: feature.properties.color })}
  pointToLayer={(feature, latlng) => L.circleMarker(latlng, { radius: 6 })}
  onEachFeature={(feature, layer) => {
    layer.bindPopup(feature.properties.name);
  }}
/>
```

**`data` is treated as immutable**. To swap GeoJSON data, give the component a `key` that changes:

```tsx
<GeoJSON key={dataId} data={data} />
```

When `dataId` changes, React unmounts the old `<GeoJSON>` and mounts a fresh one with the new data. This is the documented escape hatch for re-rendering GeoJSON.

---

## Next.js / SSR

Leaflet touches `window` and `document` at *import time*. Server-side rendering it crashes immediately with `ReferenceError: window is not defined`. There are two clean fixes:

### Fix 1 (App Router): `dynamic()` with `ssr: false`

```tsx
// app/components/MapWrapper.tsx — Server-safe wrapper
'use client';
import dynamic from 'next/dynamic';

export const MapWrapper = dynamic(
  () => import('./Map').then(mod => mod.Map),
  { ssr: false, loading: () => <div>Loading map…</div> }
);
```

```tsx
// app/components/Map.tsx — the actual Leaflet component
'use client';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export function Map() {
  return (
    <MapContainer center={[51.5, -0.09]} zoom={13} style={{ height: 500 }}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
    </MapContainer>
  );
}
```

```tsx
// app/page.tsx — page that uses it
import { MapWrapper } from './components/MapWrapper';

export default function Page() {
  return <MapWrapper />;
}
```

The wrapper is the only thing that needs to be dynamic. Everything inside `Map.tsx` runs only on the client.

### Fix 2 (Pages Router): same idea, slightly different syntax

```tsx
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('../components/Map'), { ssr: false });

export default function Page() {
  return <Map />;
}
```

A working starter for both lives at `assets/nextjs-map.tsx`.

### What about `'use client'` alone?

Marking the component `'use client'` is **not enough** in App Router. Client components still get rendered to HTML on the server during the initial render — and that's when Leaflet crashes. You need `dynamic(..., { ssr: false })` to suppress server execution entirely.

---

## Common react-leaflet patterns

### Center on a clicked location

```tsx
function ClickToPlace() {
  const [pos, setPos] = useState<L.LatLngExpression | null>(null);
  useMapEvents({ click(e) { setPos(e.latlng); } });
  return pos ? <Marker position={pos} /> : null;
}
```

### Fit bounds when data changes

```tsx
function FitBounds({ points }: { points: L.LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [map, points]);
  return null;
}
```

### React-leaflet + marker clustering

The community plugin is `react-leaflet-cluster`. As of 2026 it tracks react-leaflet 5 + React 19.

```bash
npm install react-leaflet-cluster
```

```tsx
import MarkerClusterGroup from 'react-leaflet-cluster';

<MapContainer ...>
  <TileLayer ... />
  <MarkerClusterGroup chunkedLoading>
    {points.map(p => (
      <Marker key={p.id} position={[p.lat, p.lng]}>
        <Popup>{p.name}</Popup>
      </Marker>
    ))}
  </MarkerClusterGroup>
</MapContainer>
```

`chunkedLoading` is essential for thousands of markers — it splits the cluster build across animation frames so the UI stays responsive.

### Resize handling

If your map is in a container that resizes (sidebar collapses, tab becomes visible), call `invalidateSize`:

```tsx
function HandleResize({ trigger }: { trigger: unknown }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map, trigger]);
  return null;
}
```

Pass anything that changes when the container resizes (a tab index, a sidebar-open boolean) as `trigger`.

---

## Component prop quick reference

```tsx
<MapContainer
  center={[51.5, -0.09]}
  zoom={13}
  minZoom={3}
  maxZoom={19}
  scrollWheelZoom={true}
  dragging={true}
  zoomControl={true}
  attributionControl={true}
  style={{ height: '500px', width: '100%' }}
  className="my-map"
  whenReady={() => console.log('ready')}
  ref={mapRef}
/>

<TileLayer url={...} attribution={...} opacity={1} zIndex={1} />
<Marker position={...} icon={...} draggable={false} eventHandlers={{ click: () => {} }} />
<Popup position={...} maxWidth={300} closeButton={true} />
<Tooltip position={...} permanent={false} direction="top" />
<Circle center={...} radius={500} pathOptions={{ color: 'red' }} />
<CircleMarker center={...} radius={8} pathOptions={{ color: 'red' }} />
<Polyline positions={...} pathOptions={{ color: 'red' }} />
<Polygon positions={...} pathOptions={{ color: 'red' }} />
<Rectangle bounds={[[s,w],[n,e]]} pathOptions={...} />
<GeoJSON data={...} style={...} onEachFeature={...} pointToLayer={...} />
<LayerGroup>...children...</LayerGroup>
<FeatureGroup>...children with one event handler...</FeatureGroup>
<ImageOverlay url={...} bounds={...} />
<VideoOverlay url={...} bounds={...} />
<ZoomControl position="topright" />
<ScaleControl />
<AttributionControl prefix={false} />
<LayersControl>
  <LayersControl.BaseLayer name="OSM" checked>
    <TileLayer url="..." />
  </LayersControl.BaseLayer>
  <LayersControl.Overlay name="Markers">
    <FeatureGroup>...</FeatureGroup>
  </LayersControl.Overlay>
</LayersControl>
<Pane name="customPane" style={{ zIndex: 650 }}>...</Pane>
```

Event handlers go on an `eventHandlers` prop (NOT `onClick`):

```tsx
<Marker position={[51.5, -0.09]} eventHandlers={{
  click: (e) => console.log(e.latlng),
  dragend: (e) => console.log(e.target.getLatLng()),
}} />
```

This is one of the most common react-leaflet "huh?" moments. There's no `onClick` — events are batched into `eventHandlers`.
