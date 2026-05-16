# Leaflet Core API

Everything you visibly do with Leaflet maps to a small number of object types. This reference covers them in the order you actually use them.

## Table of contents
- [The Map](#the-map)
- [Tile Layers](#tile-layers)
- [Markers](#markers)
- [Popups & Tooltips](#popups--tooltips)
- [Vector layers (polylines, polygons, circles, rectangles)](#vector-layers)
- [FeatureGroup vs LayerGroup](#featuregroup-vs-layergroup)
- [Image, video, SVG overlays](#image-video-svg-overlays)
- [Controls](#controls)
- [Events](#events)
- [Panes (z-index layering)](#panes-z-index-layering)
- [Coordinates: LatLng, LatLngBounds, Point](#coordinates)

---

## The Map

```js
const map = L.map('map', {
  center: [51.505, -0.09],
  zoom: 13,
  minZoom: 3,
  maxZoom: 19,
  zoomControl: true,
  attributionControl: true,
  // For locked maps:
  // maxBounds: L.latLngBounds([[40, -10], [60, 20]]),
  // dragging: false, scrollWheelZoom: false,
});
```

Or with separate setView (more common in tutorials):

```js
const map = L.map('map').setView([51.505, -0.09], 13);
```

### Common map methods you'll actually use

```js
map.setView([lat, lng], zoom);       // jump
map.flyTo([lat, lng], zoom);          // animated
map.panTo([lat, lng]);                // keep current zoom, animate pan
map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
map.getCenter();                      // returns LatLng
map.getZoom();
map.getBounds();                      // visible LatLngBounds
map.invalidateSize();                 // force re-layout (see gotchas)
map.locate({ setView: true });        // browser geolocation
map.remove();                         // clean up — call when destroying
```

### Always call `remove()` on cleanup

If you create a map and the container element is removed (or remounted, in SPA-land), the map object still has event listeners and a `<div>` it thinks it owns. Without `remove()`, you'll get the classic "Map container is already initialized" error on the next mount.

```js
// On teardown:
map.remove();
```

In React, this happens in `useEffect` cleanup. `react-leaflet` does this for you.

---

## Tile Layers

```js
L.tileLayer(urlTemplate, options).addTo(map);
```

The URL template uses placeholders Leaflet substitutes:
- `{z}` — zoom level
- `{x}`, `{y}` — tile coordinates
- `{s}` — subdomain (a, b, c) for parallel requests; defaults are `['a', 'b', 'c']`
- `{r}` — `'@2x'` on retina, empty otherwise (use for retina tiles)

```js
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  minZoom: 0,
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  // Common options:
  tileSize: 256,           // 256 default, some providers use 512
  zoomOffset: 0,           // pair with tileSize: 512 → zoomOffset: -1 (Mapbox)
  opacity: 1,
  detectRetina: true,      // serve higher-res tiles on retina screens
  crossOrigin: true,       // needed if you want to read tile pixels (canvas)
}).addTo(map);
```

### Multiple basemaps with a layer switcher

```js
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { /*...*/ });
const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', { /*...*/ });

osm.addTo(map); // start with one

L.control.layers(
  { 'Streets': osm, 'Dark': dark },   // base layers (radio buttons, one at a time)
  { 'Markers': markerGroup }          // overlays (checkboxes, multiple)
).addTo(map);
```

---

## Markers

```js
L.marker([51.5, -0.09]).addTo(map);
```

With options:

```js
L.marker([51.5, -0.09], {
  icon: customIcon,
  title: 'Tooltip on hover (browser native)',
  alt: 'Alt text for accessibility',
  draggable: true,
  autoPan: true,           // pan map when dragged to edge
  riseOnHover: true,       // raise z-index on hover
  opacity: 1,
});
```

### Custom icon (image)

```js
const icon = L.icon({
  iconUrl: '/pin.png',
  iconRetinaUrl: '/pin@2x.png',
  iconSize: [32, 32],      // [width, height] in pixels
  iconAnchor: [16, 32],    // point of the icon that corresponds to marker location
                            // for a teardrop pin: bottom-center → [width/2, height]
  popupAnchor: [0, -32],   // where popups open relative to iconAnchor
  shadowUrl: '/shadow.png',
  shadowSize: [40, 40],
  shadowAnchor: [12, 40],
});
```

**Anchor mental model**: imagine you're sticking a pin in cork. `iconAnchor` is the tip of the pin — the actual lat/lng location. For most pin-shaped icons that's the bottom-center.

### Custom icon (HTML / SVG via divIcon)

`L.divIcon` is the unsung hero of marker styling. It's a marker rendered as a `<div>` with arbitrary HTML — meaning you can use CSS, SVG, gradients, animations, the works.

```js
const icon = L.divIcon({
  className: 'custom-pin',           // for your CSS
  html: `<div class="pin-inner">${count}</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});
```

```css
.custom-pin .pin-inner {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  display: grid; place-items: center;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}
```

This is how you build numbered pins, status-colored pins, animated pins, etc. without making PNG sprites.

### Setting position / icon later

```js
marker.setLatLng([newLat, newLng]);
marker.setIcon(otherIcon);
marker.setOpacity(0.5);
```

---

## Popups & Tooltips

### Popup (click-to-open by default)

```js
marker.bindPopup('<b>Hello</b> world');     // HTML accepted
marker.openPopup();                          // open programmatically

// Detached popup (anchored to a coordinate):
L.popup()
  .setLatLng([51.5, -0.09])
  .setContent('Standalone popup')
  .openOn(map);
```

Options:

```js
marker.bindPopup(content, {
  maxWidth: 300,
  minWidth: 50,
  autoPan: true,           // pan to keep popup visible
  closeButton: true,
  closeOnClick: true,      // close when map is clicked elsewhere
  className: 'my-popup',   // for CSS targeting
});
```

To style the popup's appearance, target `.leaflet-popup-content-wrapper`, `.leaflet-popup-content`, and `.leaflet-popup-tip` in your CSS — Leaflet's defaults are intentionally bland.

### Tooltip (hover-to-open by default)

```js
marker.bindTooltip('Always visible label', {
  permanent: true,         // show without hover (great for place labels)
  direction: 'top',        // 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto'
  offset: [0, -20],
  className: 'my-tooltip',
});
```

Common use: `permanent: true, direction: 'top'` to label every marker without requiring hover.

### Popup content as a function (dynamic)

```js
marker.bindPopup(layer => {
  // Re-evaluated every time the popup opens
  return `<div>Current count: ${getCount()}</div>`;
});
```

---

## Vector layers

All vector layers (polyline, polygon, circle, rectangle, circleMarker) share the same Path options:

```js
const pathOpts = {
  stroke: true,
  color: '#3388ff',
  weight: 3,
  opacity: 1,
  fill: true,
  fillColor: '#3388ff',
  fillOpacity: 0.2,
  lineCap: 'round',
  lineJoin: 'round',
  dashArray: '5,10',       // SVG dash pattern
  className: 'my-path',    // for CSS
  interactive: true,       // emit events?
};
```

### Polyline

```js
L.polyline([[51.5, -0.09], [48.85, 2.35], [52.52, 13.40]], {
  color: 'red', weight: 4
}).addTo(map);
```

### Polygon

A polygon is a closed polyline. Pass an array of vertices — no need to repeat the first point.

```js
L.polygon([[51.5, -0.09], [51.51, -0.10], [51.51, -0.08]], {
  color: 'blue', fillOpacity: 0.4
}).addTo(map);
```

For polygons with holes, pass a nested array: `[outerRing, hole1, hole2, ...]`.

### Circle (real-world meters) vs CircleMarker (screen pixels)

This trips people up. **`Circle` scales with zoom; `CircleMarker` does not.**

```js
// "500m radius around this point" — gets bigger as you zoom in
L.circle([51.5, -0.09], { radius: 500, color: 'red' }).addTo(map);

// "8px dot at this point" — same size at every zoom level
L.circleMarker([51.5, -0.09], { radius: 8, color: 'red' }).addTo(map);
```

Use `CircleMarker` for data dots / scatter visualization. Use `Circle` for "X miles around Y" and similar geographic radii.

### Rectangle

```js
L.rectangle([[51.49, -0.11], [51.52, -0.07]], { color: 'green' }).addTo(map);
```

### Mutating vector layers

```js
polyline.setLatLngs(newPoints);
polygon.setStyle({ color: 'red' });
circle.setRadius(1000);
```

---

## FeatureGroup vs LayerGroup

Both are containers for batches of layers. Choose by whether you need bounds.

| | LayerGroup | FeatureGroup |
|---|---|---|
| Batch add/remove from map | ✅ | ✅ |
| Iterate with `.eachLayer()` | ✅ | ✅ |
| One event handler for all children (`group.on('click', ...)`) | ❌ | ✅ |
| `getBounds()` | ❌ | ✅ |
| `setStyle()` on all children | ❌ | ✅ |

**Use `FeatureGroup` 95% of the time.** It's strictly more capable. `LayerGroup` is fine when you have a mix of types and don't need bounds.

```js
const markers = L.featureGroup([
  L.marker([51.5, -0.09]),
  L.marker([48.85, 2.35]),
  L.marker([52.52, 13.40]),
]).addTo(map);

// One handler for any marker click:
markers.on('click', (e) => console.log(e.layer.getLatLng()));

// Fit map to all of them:
map.fitBounds(markers.getBounds(), { padding: [20, 20] });
```

---

## Image, video, SVG overlays

For when you have a non-tile raster (a floor plan, scanned map, video, custom SVG):

```js
L.imageOverlay('/floorplan.png', [[51.49, -0.11], [51.52, -0.07]]).addTo(map);

L.videoOverlay('https://example.com/clip.mp4', bounds, {
  autoplay: true, muted: true, loop: true,
}).addTo(map);

L.svgOverlay(svgElement, bounds).addTo(map);
```

`bounds` is `[[south, west], [north, east]]` — the geographic extent the image should cover.

---

## Controls

The four built-in controls:

```js
L.control.zoom({ position: 'topright' }).addTo(map);
L.control.attribution({ prefix: false }).addTo(map);   // prefix:false hides "Leaflet"
L.control.scale({ imperial: false, metric: true }).addTo(map);
L.control.layers(baseLayers, overlays).addTo(map);     // (covered above)
```

### Custom control

```js
const InfoControl = L.Control.extend({
  onAdd(map) {
    const el = L.DomUtil.create('div', 'leaflet-bar info-control');
    el.innerHTML = '<button>?</button>';
    L.DomEvent.disableClickPropagation(el);    // <-- critical: stops map drag/zoom
    el.querySelector('button').onclick = () => alert('Hi');
    return el;
  },
});
new InfoControl({ position: 'topleft' }).addTo(map);
```

**Always call `L.DomEvent.disableClickPropagation`** on custom controls. Otherwise clicking your button also drags the map. This is the #1 mistake with custom controls.

---

## Events

Every Leaflet object (map, markers, layers, controls) exposes `.on()` / `.off()` / `.once()`:

```js
map.on('click', (e) => {
  console.log(e.latlng);      // L.LatLng
  console.log(e.originalEvent); // the DOM event
});

marker.on('click drag', (e) => { /* multiple events at once */ });

map.once('zoomend', () => { /* fires once then unbinds */ });

map.off('click', handler);     // unbind
```

### Most-used events

| Map | Marker / Layer |
|---|---|
| `click`, `dblclick`, `contextmenu` | `click`, `mouseover`, `mouseout` |
| `mousemove`, `mouseover`, `mouseout` | `dragstart`, `drag`, `dragend` (markers) |
| `zoomstart`, `zoom`, `zoomend` | `popupopen`, `popupclose` |
| `movestart`, `move`, `moveend` | `add`, `remove` |
| `resize` | `tooltipopen`, `tooltipclose` |
| `load`, `unload` | |

### One handler for a whole FeatureGroup

```js
group.on('click', (e) => {
  // e.layer is the specific child that was clicked
  e.layer.bindPopup(...).openPopup();
});
```

---

## Panes (z-index layering)

Leaflet stacks rendering into named "panes," each with its own z-index. The defaults from bottom to top:

| Pane | z-index | What lives here |
|---|---|---|
| `mapPane` | 0 | Container for everything |
| `tilePane` | 200 | Tile layers |
| `overlayPane` | 400 | Polylines/polygons (SVG) |
| `shadowPane` | 500 | Marker shadows |
| `markerPane` | 600 | Marker icons |
| `tooltipPane` | 650 | Tooltips |
| `popupPane` | 700 | Popups |

If you need a layer below others (e.g., a transparent polygon under the markers but above the tiles), create a custom pane:

```js
map.createPane('labels');
map.getPane('labels').style.zIndex = 650;
map.getPane('labels').style.pointerEvents = 'none';  // labels shouldn't catch clicks

L.tileLayer(labelTileUrl, { pane: 'labels' }).addTo(map);
```

The `pointerEvents: 'none'` trick is essential for label/overlay tile layers — without it, the tile layer steals all clicks meant for markers below.

---

## Coordinates

### LatLng

```js
L.latLng(51.5, -0.09);           // {lat: 51.5, lng: -0.09}
[51.5, -0.09];                    // shorthand accepted in most APIs
{ lat: 51.5, lng: -0.09 };        // also accepted
```

Methods: `distanceTo(other)` (meters), `equals(other)`, `toBounds(sizeInMeters)`.

```js
const point = L.latLng(51.5, -0.09);
point.distanceTo([48.85, 2.35]);  // ≈ 343555 (meters between London and Paris)
```

### LatLngBounds

```js
L.latLngBounds([[40, -10], [60, 20]]);  // [southWest, northEast]
bounds.extend([55, 5]);                  // grow to include point
bounds.contains([50, 0]);
bounds.intersects(otherBounds);
bounds.getCenter();
bounds.pad(0.1);                         // grow 10% in each direction
```

### Point (pixels) and unprojection

`L.point(x, y)` is screen pixels. To go between geographic and pixel space:

```js
map.latLngToContainerPoint([51.5, -0.09]);  // → L.Point relative to map container
map.containerPointToLatLng([400, 300]);     // → L.LatLng

map.latLngToLayerPoint(...);                 // relative to overlay pane (for SVG)
map.project(latlng, zoom);                   // → CRS coords at given zoom
map.unproject(point, zoom);                  // ← CRS coords
```

Use the `containerPoint` variants when positioning HTML overlays. Use the `layerPoint` variants when drawing into Leaflet's SVG overlay pane.
