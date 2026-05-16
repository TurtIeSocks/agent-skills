# GeoJSON in Leaflet

GeoJSON is the standard format for geographic data on the web. Leaflet's `L.geoJSON` factory turns a GeoJSON `FeatureCollection` (or single Feature/Geometry) into a styleable, interactive layer in one call.

## TL;DR

```js
L.geoJSON(data, {
  style: feature => ({ color: '#3388ff', weight: 2 }),
  pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 6 }),
  onEachFeature: (feature, layer) => layer.bindPopup(feature.properties.name),
  filter: feature => feature.properties.visible !== false,
}).addTo(map);
```

Four callbacks, one for each thing you might want to control. They're the entire mental model.

---

## What GeoJSON looks like

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "London", "population": 9000000 },
      "geometry": { "type": "Point", "coordinates": [-0.09, 51.505] }
    },
    {
      "type": "Feature",
      "properties": { "name": "City Center" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-0.1, 51.5], [-0.08, 51.5], [-0.08, 51.51], [-0.1, 51.51], [-0.1, 51.5]]]
      }
    }
  ]
}
```

**⚠️ GeoJSON uses `[longitude, latitude]` order**, the opposite of Leaflet's usual `[lat, lng]`. Leaflet handles this for you when reading GeoJSON, but if you're constructing geometry by hand, remember: GeoJSON is X-then-Y (lng-then-lat). This catches everyone at least once.

Geometry types:
- `Point` → rendered as a marker (override with `pointToLayer`)
- `LineString`, `MultiLineString` → polyline
- `Polygon`, `MultiPolygon` → polygon
- `GeometryCollection` → all of the above mixed

---

## The four hooks

### `style` — for lines and polygons

Accepts an object (applied to all) or a function (per-feature, called with the feature):

```js
// Same style for everything:
L.geoJSON(data, {
  style: { color: '#3388ff', weight: 2, fillOpacity: 0.2 }
});

// Per-feature, based on properties:
L.geoJSON(data, {
  style: feature => ({
    color: feature.properties.borderColor || '#3388ff',
    weight: feature.properties.featured ? 4 : 2,
    fillColor: getColorForValue(feature.properties.value),
    fillOpacity: 0.6,
  })
});
```

### `pointToLayer` — for points

By default, GeoJSON `Point` geometries become default markers. To make them circles, custom icons, or anything else:

```js
L.geoJSON(data, {
  pointToLayer: (feature, latlng) =>
    L.circleMarker(latlng, {
      radius: 8,
      fillColor: '#ff7800',
      color: '#000',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    })
});
```

**Important**: `style` is *not* called for points. Style each point inside `pointToLayer` instead.

### `onEachFeature` — bind popups, events, etc.

Called once per feature, after the layer is created. This is where popups, tooltips, and click handlers go.

```js
L.geoJSON(data, {
  onEachFeature: (feature, layer) => {
    const p = feature.properties;
    layer.bindPopup(`<h3>${p.name}</h3><p>${p.description}</p>`);
    layer.on('mouseover', () => layer.setStyle({ weight: 5 }));
    layer.on('mouseout', () => layer.setStyle({ weight: 2 }));
  }
});
```

### `filter` — exclude features

Return `true` to include, `false` to skip:

```js
L.geoJSON(data, {
  filter: feature => feature.properties.population > 100000
});
```

Filtering at load is much cheaper than adding then removing layers.

---

## Updating a GeoJSON layer

Adding more features later:

```js
const layer = L.geoJSON().addTo(map);
layer.addData(newFeatureCollection);
```

Replacing data:

```js
layer.clearLayers();
layer.addData(newData);
```

Re-styling all features (only affects lines/polygons):

```js
layer.setStyle({ color: 'red' });
// or per-feature:
layer.setStyle(feature => ({ color: pickColor(feature) }));
```

---

## Choropleth (color-by-value) — the canonical recipe

This is one of the most common GeoJSON tasks: shade regions by some property.

```js
function getColor(d) {
  return d > 1000 ? '#800026' :
         d > 500  ? '#BD0026' :
         d > 200  ? '#E31A1C' :
         d > 100  ? '#FC4E2A' :
         d > 50   ? '#FD8D3C' :
         d > 20   ? '#FEB24C' :
         d > 10   ? '#FED976' :
                    '#FFEDA0';
}

function style(feature) {
  return {
    fillColor: getColor(feature.properties.density),
    weight: 2,
    opacity: 1,
    color: 'white',
    dashArray: '3',
    fillOpacity: 0.7,
  };
}

const geojson = L.geoJSON(statesData, {
  style,
  onEachFeature: (feature, layer) => {
    layer.on({
      mouseover: (e) => e.target.setStyle({ weight: 5, color: '#666', fillOpacity: 0.9 }),
      mouseout: (e) => geojson.resetStyle(e.target),
      click: (e) => map.fitBounds(e.target.getBounds()),
    });
  }
}).addTo(map);
```

`geojson.resetStyle(layer)` reverts a layer to its original `style()` result — saves you from caching styles manually for hover-out.

---

## Loading external GeoJSON

```js
fetch('/data.geojson')
  .then(r => r.json())
  .then(data => L.geoJSON(data).addTo(map));
```

For large files, consider:
1. **Simplifying** with `mapshaper` or `topojson` before serving — saves bytes and renders faster.
2. **Loading viewport-bounded chunks** via your own tile server (vector tiles) instead of one giant blob.
3. **Streaming** with a library like `geojson-vt` for client-side vector tiling — see `references/performance.md`.

## TopoJSON support

GeoJSON's compact cousin. Leaflet itself doesn't read TopoJSON, but the conversion is trivial:

```js
import * as topojson from 'topojson-client';

fetch('/data.topojson')
  .then(r => r.json())
  .then(topo => {
    const geo = topojson.feature(topo, topo.objects.layerName);
    L.geoJSON(geo).addTo(map);
  });
```

TopoJSON typically cuts file sizes by 70-95% for adjacent-polygon data (like country boundaries).

---

## Fitting the map to GeoJSON

```js
const layer = L.geoJSON(data).addTo(map);
map.fitBounds(layer.getBounds(), { padding: [40, 40] });
```

`getBounds()` works on any vector layer (polyline, polygon, GeoJSON, FeatureGroup, MarkerCluster).

---

## Filtering and re-rendering by user input

A common pattern: a UI control (slider, checkboxes, search) filters the visible features. The clean way:

```js
let currentLayer = null;
const allData = await fetch('/data.geojson').then(r => r.json());

function render(filterFn) {
  if (currentLayer) map.removeLayer(currentLayer);
  currentLayer = L.geoJSON(allData, {
    filter: filterFn,
    style: featureStyle,
    onEachFeature: bindPopup,
  }).addTo(map);
}

render(f => f.properties.category === 'park');
// later:
render(f => f.properties.population > 500000);
```

For small datasets (~thousands of features) this re-renders fast enough. For larger ones, prefer toggling visibility (`layer.setStyle({ opacity: 0, fillOpacity: 0 })`) or use a clustering plugin.

---

## Getting GeoJSON back out

You can round-trip:

```js
const json = layer.toGeoJSON();
// or for any single drawn feature:
polygon.toGeoJSON();
```

Great for "let user draw, then save to backend" workflows (see `references/plugins.md` → leaflet-draw).
