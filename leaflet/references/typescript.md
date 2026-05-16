# Leaflet with TypeScript

Leaflet itself is plain JS, but `@types/leaflet` (community-maintained, in DefinitelyTyped) is excellent. With it, the API is fully type-safe. This reference covers the types you'll actually trip on.

## Setup

```bash
npm install leaflet
npm install -D @types/leaflet
```

That's it for vanilla Leaflet. For react-leaflet, types ship in-package — no separate install needed.

For plugins, types are hit-and-miss:

| Plugin | Types |
|---|---|
| `leaflet.markercluster` | `@types/leaflet.markercluster` |
| `leaflet-draw` | `@types/leaflet-draw` |
| `leaflet.heat` | None — add a stub |
| `leaflet-routing-machine` | None — add a stub |
| `leaflet.fullscreen` | None — add a stub |

---

## The "no types for plugin X" pattern

When a plugin doesn't ship types, the minimum viable mitigation is a `declare module` stub. Drop a `.d.ts` file in your project:

```ts
// types/leaflet-heat.d.ts
import 'leaflet';

declare module 'leaflet' {
  interface HeatLatLng extends LatLngExpression {
    intensity?: number;
  }
  function heatLayer(
    latlngs: Array<[number, number] | [number, number, number] | LatLng>,
    options?: {
      minOpacity?: number;
      maxZoom?: number;
      max?: number;
      radius?: number;
      blur?: number;
      gradient?: Record<number, string>;
    }
  ): Layer & {
    setLatLngs(latlngs: Array<[number, number, number?]>): this;
    addLatLng(latlng: [number, number, number?]): this;
    setOptions(options: object): this;
    redraw(): this;
  };
}
```

Then make sure your `tsconfig.json` picks it up:

```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./types"]
  }
}
```

The same shape works for any plugin: declare what you actually use, leave the rest as `any` if it doesn't matter.

---

## Coordinates: `LatLngExpression`

Leaflet accepts coordinates in three forms. The union type is `LatLngExpression`:

```ts
type LatLngExpression = LatLng | LatLngLiteral | LatLngTuple;
type LatLngLiteral = { lat: number; lng: number };
type LatLngTuple = [number, number];   // [lat, lng]
```

So all of these work and are properly typed:

```ts
L.marker([51.5, -0.09]);
L.marker({ lat: 51.5, lng: -0.09 });
L.marker(L.latLng(51.5, -0.09));
```

For function signatures, accept `LatLngExpression` (broad) and convert internally when you need a concrete `LatLng`:

```ts
function distanceFromCenter(point: LatLngExpression, map: L.Map): number {
  return L.latLng(point).distanceTo(map.getCenter());
}
```

**`LatLngTuple` is `[lat, lng]`, but GeoJSON is `[lng, lat]`** — your types won't catch this, only careful reading will. Wrap conversion in a helper if you cross the boundary often:

```ts
const lngLatToLatLng = ([lng, lat]: [number, number]): LatLngTuple => [lat, lng];
```

---

## Bounds: `LatLngBoundsExpression`

```ts
type LatLngBoundsExpression = LatLngBounds | LatLngBoundsLiteral;
type LatLngBoundsLiteral = LatLngTuple[];  // [[s,w], [n,e]]
```

```ts
map.fitBounds([[40, -10], [60, 20]]);          // literal
map.fitBounds(L.latLngBounds([[40, -10], [60, 20]]));  // instance
map.fitBounds(featureGroup.getBounds());        // from a layer
```

---

## Strongly typed GeoJSON

`@types/geojson` (transitively pulled in by `@types/leaflet`) provides generics for your feature properties:

```ts
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';

interface CityProps {
  name: string;
  population: number;
  founded: number;
}

const cities: FeatureCollection<Point, CityProps> = await fetch('/cities.geojson').then(r => r.json());

L.geoJSON<CityProps>(cities, {
  onEachFeature: (feature, layer) => {
    //          ^ Feature<Geometry, CityProps>
    layer.bindPopup(`${feature.properties.name} (pop. ${feature.properties.population.toLocaleString()})`);
  },
  filter: feature => feature.properties.population > 1_000_000,
});
```

The generic on `L.geoJSON<P>` types `feature.properties` as `P` throughout all the callbacks. Worth it every time you have non-trivial properties.

---

## Event types

Leaflet event handlers receive specific event types depending on the event:

```ts
map.on('click', (e: L.LeafletMouseEvent) => {
  console.log(e.latlng, e.containerPoint, e.layerPoint, e.originalEvent);
});

map.on('zoomend', (e: L.LeafletEvent) => {
  console.log(e.target);   // the map
});

marker.on('dragend', (e: L.DragEndEvent) => {
  console.log(e.distance);
});

layer.on('popupopen', (e: L.PopupEvent) => {
  console.log(e.popup.getLatLng());
});
```

If you want the handler to know which marker fired it (when shared across many), use the target:

```ts
function makeClickHandler(label: string) {
  return (e: L.LeafletMouseEvent) => {
    const marker = e.target as L.Marker;
    console.log(label, marker.getLatLng());
  };
}
```

---

## Type-safe icons

```ts
const pinIcon: L.Icon = L.icon({
  iconUrl: '/pin.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const numberIcon = (n: number): L.DivIcon => L.divIcon({
  className: 'count-pin',
  html: `<div>${n}</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});
```

Both `L.Icon` and `L.DivIcon` extend `L.Layer` indirectly — pass either to `Marker`'s `icon` option.

---

## A builder for type-safe map composition

If you're building a lot of maps with similar setups (multiple basemaps, layered overlays, controls), a builder pattern keeps the call site clean. This matches the chain-friendly philosophy of Leaflet itself.

```ts
interface MapBuilderOptions {
  container: string | HTMLElement;
  center: L.LatLngExpression;
  zoom: number;
}

class MapBuilder {
  private map: L.Map;
  private overlays: Record<string, L.Layer> = {};
  private baseLayers: Record<string, L.Layer> = {};
  private hasBase = false;

  constructor(opts: MapBuilderOptions) {
    this.map = L.map(opts.container).setView(opts.center, opts.zoom);
  }

  addBaseLayer(name: string, url: string, options?: L.TileLayerOptions): this {
    const layer = L.tileLayer(url, options);
    this.baseLayers[name] = layer;
    if (!this.hasBase) {
      layer.addTo(this.map);
      this.hasBase = true;
    }
    return this;
  }

  addOverlay(name: string, layer: L.Layer, visible = true): this {
    this.overlays[name] = layer;
    if (visible) layer.addTo(this.map);
    return this;
  }

  addMarkers(points: Array<{ lat: number; lng: number; label?: string }>, name = 'Markers'): this {
    const group = L.featureGroup(
      points.map(p => {
        const m = L.marker([p.lat, p.lng]);
        if (p.label) m.bindPopup(p.label);
        return m;
      })
    );
    return this.addOverlay(name, group);
  }

  withLayerSwitcher(): this {
    L.control.layers(this.baseLayers, this.overlays).addTo(this.map);
    return this;
  }

  withScale(): this {
    L.control.scale().addTo(this.map);
    return this;
  }

  fitToOverlays(): this {
    const group = L.featureGroup(Object.values(this.overlays).filter(
      (l): l is L.FeatureGroup => l instanceof L.FeatureGroup
    ));
    if (group.getLayers().length) {
      this.map.fitBounds(group.getBounds(), { padding: [40, 40] });
    }
    return this;
  }

  build(): L.Map {
    return this.map;
  }
}
```

Usage:

```ts
const map = new MapBuilder({ container: 'map', center: [51.5, -0.09], zoom: 5 })
  .addBaseLayer('OpenStreetMap', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OSM',
  })
  .addBaseLayer('Carto Dark', 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png')
  .addMarkers([
    { lat: 51.5, lng: -0.09, label: 'London' },
    { lat: 48.85, lng: 2.35, label: 'Paris' },
    { lat: 52.52, lng: 13.40, label: 'Berlin' },
  ])
  .withLayerSwitcher()
  .withScale()
  .fitToOverlays()
  .build();
```

That `build()` at the end is optional but explicit. You can also return `this` to keep chaining inline if the caller still needs the underlying map.

---

## Common type-narrowing patterns

### "Is this layer a marker?"

Use the `instanceof` checks Leaflet exposes:

```ts
featureGroup.eachLayer(layer => {
  if (layer instanceof L.Marker) {
    layer.openPopup();
  } else if (layer instanceof L.Polygon) {
    layer.setStyle({ color: 'red' });
  }
});
```

### "Get the Leaflet element instance from a react-leaflet ref"

```ts
const ref = useRef<L.Map>(null);
// In an effect, ref.current is typed as L.Map | null
```

For individual layer refs in react-leaflet:

```ts
const markerRef = useRef<L.Marker>(null);
<Marker ref={markerRef} position={[51.5, -0.09]} />;
```

---

## Interfaces over types (style preference)

When defining shapes for your own data flowing into Leaflet, prefer interfaces — they extend cleanly, give better hover messages in editors, and merge if needed:

```ts
// Preferred
interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

interface ChoroplethFeatureProps {
  name: string;
  value: number;
}
```

```ts
// Use a type alias only when you need a union/intersection that doesn't make sense as an interface
type LayerKind = 'marker' | 'circle' | 'polygon';
type StyledLayer<P> = L.Layer & { __data: P };
```

This is a stylistic line, not a correctness one, but it pays off when interfaces start composing.
