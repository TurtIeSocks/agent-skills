# Leaflet-Geoman: Deep Dive

The modern drawing-and-editing plugin for Leaflet. Successor to `leaflet.pm`, actively maintained, and as of mid-2026 the de-facto standard for any app that lets users draw shapes on a map. This is **the** reference for any task involving drawing, editing, splitting, cutting, rotating, snapping, or measuring on a Leaflet map.

If you're asking "should I use this or leaflet-draw?" — Geoman. leaflet-draw's last commit was September 2018; Geoman is on a multi-release-per-month cadence and ships TypeScript types in-package.

## Table of contents

- [Versions and Free vs Pro](#versions-and-free-vs-pro)
- [Install](#install)
- [The mental model: `map.pm` and `layer.pm`](#the-mental-model-mappm-and-layerpm)
- [The Toolbar](#the-toolbar)
- [Draw Mode](#draw-mode)
- [Edit Mode](#edit-mode)
- [Drag Mode](#drag-mode)
- [Removal Mode](#removal-mode)
- [Cut Mode](#cut-mode)
- [Rotation Mode](#rotation-mode)
- [Pro modes (overview)](#pro-modes-overview)
- [Snapping](#snapping)
- [Events](#events)
- [Ignoring layers (`pmIgnore`)](#ignoring-layers-pmignore)
- [Customization](#customization)
- [Translations (i18n)](#translations-i18n)
- [TypeScript](#typescript)
- [React Leaflet integration](#react-leaflet-integration)
- [Common recipes](#common-recipes)
- [Gotchas](#gotchas)

---

## Versions and Free vs Pro

There are two packages. Same author, same docs, same API surface — the Pro package adds features and a commercial license.

| Package | License | Use when |
|---|---|---|
| `@geoman-io/leaflet-geoman-free` | Free / open source | You need draw, edit, drag, remove, cut, rotate, snap, basic measurement-free workflows. Sufficient for 95% of apps. |
| `@geoman-io/leaflet-geoman-pro` | Commercial | You need split, scale, measure-while-drawing, pinning, snap guides, auto-trace, union/difference, line simplification, or performance tuning for thousands of features. |

**Current stable**: `@geoman-io/leaflet-geoman-free` 2.19.3 (April 2026). The version bump cadence is roughly monthly.

Features marked **⭐** below are Pro-only. Everything else is in the free package. The API shape is identical — Pro features just throw "not available" if you call them without a license, and Pro features in the toolbar are hidden in the free build.

---

## Install

### Free version, bundler

```bash
npm install @geoman-io/leaflet-geoman-free
```

```ts
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
```

That's it. The plugin auto-initializes on every Leaflet `Map` and every `Layer` you create afterward — there's no `new Geoman(map)` step. The import is **side-effectful** (it attaches `pm` to `L.Map.prototype` and `L.Layer.prototype`). Don't try to destructure it.

### Pro version, bundler

```bash
npm install @geoman-io/leaflet-geoman-pro
```

```ts
import '@geoman-io/leaflet-geoman-pro';
import '@geoman-io/leaflet-geoman-pro/dist/leaflet-geoman.css';
```

The Pro package is a drop-in replacement. If you swap `-free` for `-pro` everywhere, the same code keeps working — Pro features simply become available.

### Without a bundler (CDN)

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://unpkg.com/@geoman-io/leaflet-geoman-free@latest/dist/leaflet-geoman.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/@geoman-io/leaflet-geoman-free@latest/dist/leaflet-geoman.js"></script>
```

Order matters: Leaflet first, then Geoman.

---

## The mental model: `map.pm` and `layer.pm`

Geoman extends Leaflet by attaching a `.pm` namespace to two things:

- **`map.pm`** — controls *global modes* (drawing, edit-everything, drag-everything, removal-everything). One mode active at a time.
- **`layer.pm`** — controls a *single layer* (enable editing on just this polygon, get vertex count, set per-layer options).

The "pm" is a historical name (Polygon Management, back when leaflet.pm only did polygons). Don't think about it.

Before (vanilla Leaflet — you write your own UI and vertex math):
```js
map.on('click', (e) => {
  // ...track clicks, build polygon vertices, render preview, handle finish, ugh
});
```

After (Geoman):
```js
map.pm.enableDraw('Polygon');           // user starts drawing, hint line follows cursor
map.on('pm:create', (e) => {            // fires once when user finishes
  console.log(e.layer.toGeoJSON());     // already a Leaflet layer + GeoJSON-able
});
```

The mental model is two-tier: **enable a mode** (verb on `map.pm`) → **listen for an event** (`pm:<verb>`) → **act on the resulting layer**.

---

## The Toolbar

The toolbar is the visible UI control. It's a Leaflet control like any other, added with one call.

```js
map.pm.addControls({
  position: 'topleft',          // 'topleft' | 'topright' | 'bottomleft' | 'bottomright'

  // Hide individual buttons by setting to false:
  drawMarker:        true,
  drawCircleMarker:  true,
  drawPolyline:      true,
  drawRectangle:     true,
  drawPolygon:       true,
  drawCircle:        true,
  drawText:          true,
  editMode:          true,
  dragMode:          true,
  cutPolygon:        true,
  removalMode:       true,
  rotateMode:        true,

  // Pro only:
  scaleMode:         true,
  splitMode:         true,      // ⭐
  unionMode:         true,      // ⭐
  differenceMode:    true,      // ⭐

  // Block-level toggles:
  drawControls:      true,      // hide all draw buttons
  editControls:      true,      // hide all edit buttons
  optionsControls:   true,      // ⭐ hide Pro options block
  customControls:    true,      // hide custom buttons

  oneBlock:          false,     // collapse all buttons into one toolbar block
});
```

To hide the toolbar entirely, just don't call `addControls`. You can still drive Geoman programmatically (`map.pm.enableDraw('Polygon')`) and skip the built-in UI. That's the right pattern when you have your own buttons in your app shell.

Remove the toolbar:

```js
map.pm.removeControls();
```

Move buttons around:

```js
map.pm.Toolbar.changeControlOrder([
  'drawPolygon', 'drawRectangle', 'drawCircle', 'editMode', 'removalMode'
]);
```

---

## Draw Mode

Programmatic API:

```js
// Available shapes: 'Marker', 'CircleMarker', 'Circle', 'Line', 'Rectangle', 'Polygon', 'Cut', 'Text'
map.pm.enableDraw('Polygon', {
  snappable: true,
  snapDistance: 20,
  // ... see options table below
});

map.pm.disableDraw();              // disable the currently active draw mode
map.pm.disableDraw('Polygon');     // or specify

map.pm.globalDrawModeEnabled();    // boolean: is any draw mode active?

map.pm.Draw.getShapes();           // → ['Marker', 'CircleMarker', ...]
```

### Draw options (the ones you'll actually touch)

| Option | Default | What it does |
|---|---|---|
| `snappable` | `true` | Snap vertices to nearby layers while drawing |
| `snapDistance` | `20` | Snap radius in pixels |
| `allowSelfIntersection` | `true` | Allow polygons to cross themselves; set `false` for valid polygons only |
| `templineStyle` | `{ color: '#3388ff' }` | Style of finished-but-still-drawing edges |
| `hintlineStyle` | `{ color: '#3388ff', dashArray: [5, 5] }` | Style of the line following the cursor |
| `pathOptions` | `{}` | Style applied to the final layer (color, weight, fillOpacity, etc.) |
| `markerStyle` | `{ draggable: true }` | Style of the marker dropped at each vertex |
| `cursorMarker` | `true` | Show a marker at the cursor |
| `finishOn` | `null` | Event name that finishes the draw (`'dblclick'`, `'contextmenu'`, `'mouseout'`, etc.) |
| `requireSnapToFinish` | `false` | Refuse to finish until the last vertex is snapped to another layer |
| `continueDrawing` | `false` for Polygon, `true` for Marker | After finishing, immediately start drawing another of the same shape |
| `tooltips` | `true` | Show the "Click to finish" hint near cursor |
| `minRadiusCircle` / `maxRadiusCircle` | `null` | Constrain circle radius (meters) |

### Per-shape quick examples

```js
// Marker — drops a pin on click
map.pm.enableDraw('Marker', {
  markerStyle: { icon: customIcon },
  continueDrawing: false,    // place one marker then stop
});

// Polygon with strict validity
map.pm.enableDraw('Polygon', {
  allowSelfIntersection: false,
  finishOn: 'dblclick',
  pathOptions: { color: '#ef4444', fillOpacity: 0.4 },
});

// Rectangle — drag-to-draw
map.pm.enableDraw('Rectangle', {
  pathOptions: { color: 'green' },
});

// Circle — click center then click edge
map.pm.enableDraw('Circle', {
  minRadiusCircle: 10,       // meters
  maxRadiusCircle: 5000,
});

// Line / polyline
map.pm.enableDraw('Line', {
  finishOn: 'dblclick',
});

// Cut — draws a polygon that *removes* area from underlying polygons
map.pm.enableDraw('Cut');
```

### Setting global draw options once

Instead of passing options to every `enableDraw` call:

```js
map.pm.setGlobalOptions({
  snappable: true,
  snapDistance: 25,
  allowSelfIntersection: false,
  pathOptions: { color: '#ef4444' },
});
```

These persist across toolbar-triggered draws too — useful when the user clicks the toolbar buttons rather than calling `enableDraw` programmatically.

### What you get back: `pm:create`

```js
map.on('pm:create', (e) => {
  e.shape;                   // 'Polygon' | 'Marker' | ...
  e.layer;                   // the L.Layer that was just added to the map
  e.layer.toGeoJSON();       // GeoJSON for persistence
});
```

The created layer is **already on the map**. Geoman adds it for you. If you want it inside a specific `FeatureGroup` (typical pattern), move it:

```js
const drawnItems = L.featureGroup().addTo(map);

map.on('pm:create', (e) => {
  map.removeLayer(e.layer);
  drawnItems.addLayer(e.layer);
});
```

---

## Edit Mode

Edit Mode lets users drag vertices, add new vertices (by clicking the middle markers), and remove vertices (right-click). It can be enabled globally (all layers at once) or on a single layer.

### Global edit

```js
map.pm.enableGlobalEditMode({
  snappable: true,
  snapDistance: 20,
  allowSelfIntersection: false,
  preventMarkerRemoval: false,    // don't let user delete vertices
  removeLayerBelowMinVertexCount: true,  // auto-remove if dragged below 3 verts (polygon) / 2 (line)
});

map.pm.disableGlobalEditMode();
map.pm.globalEditModeEnabled();       // boolean
map.pm.toggleGlobalEditMode();
```

### Per-layer edit

```js
polygon.pm.enable({ snappable: true });
polygon.pm.disable();
polygon.pm.enabled();                  // boolean
polygon.pm.toggleEdit();
polygon.pm.getShape();                 // 'Polygon' | 'Circle' | ...

// Vertex operations:
polygon.pm.getVertices();              // L.LatLng[]
polygon.pm.hasSelfIntersection();      // boolean
polygon.pm.intersects(otherLayer);
```

### Listening to edits

The event story is layered. Read carefully — this catches everyone:

| Event | Fires when |
|---|---|
| `pm:edit` | A vertex moved (fires on every drag, can be noisy) |
| `pm:update` | Edit mode disabled and changes were made (the "save" event) |
| `pm:vertexadded` | A new vertex was added via middle-marker click |
| `pm:vertexremoved` | A vertex was right-clicked away |
| `pm:markerdragstart` / `pm:markerdrag` / `pm:markerdragend` | Dragging a vertex marker |

```js
layer.on('pm:edit', (e) => {
  // High-frequency. Use for live previews, not persistence.
});

layer.on('pm:update', (e) => {
  // Fires once when the user finishes editing. THIS is the "save to backend" event.
  saveToBackend(layer.toGeoJSON());
});
```

**The rule**: persist on `pm:update`, not `pm:edit`. `pm:edit` fires on every micro-move and will hammer your backend.

---

## Drag Mode

Drag Mode lets users grab a whole shape and move it. It's a separate mode from Edit Mode (which moves vertices).

```js
map.pm.enableGlobalDragMode();
map.pm.disableGlobalDragMode();

// Per layer:
polygon.pm.enableLayerDrag();
polygon.pm.disableLayerDrag();
polygon.pm.layerDragEnabled();
```

Events:

```js
layer.on('pm:dragstart', (e) => { /* started moving */ });
layer.on('pm:drag', (e) => { /* moving */ });
layer.on('pm:dragend', (e) => { /* finished moving — persist here */ });
```

---

## Removal Mode

Removal Mode turns the cursor into a delete-on-click tool.

```js
map.pm.enableGlobalRemovalMode();
map.pm.disableGlobalRemovalMode();
map.pm.globalRemovalModeEnabled();
```

```js
layer.on('pm:remove', (e) => {
  // The layer has already been removed from the map. Clean up backend, redo state, etc.
});
```

To programmatically delete: `map.removeLayer(layer)` — that's just normal Leaflet, no Geoman call needed.

---

## Cut Mode

Cut Mode draws a polygon that **subtracts** area from any polygon it overlaps. The result is a new polygon (or multi-polygon) replacing the original. This is how you make holes ("donuts"), split a polygon in two, or carve out a region.

```js
map.pm.enableGlobalCutMode({
  allowSelfIntersection: false,
});

map.on('pm:cut', (e) => {
  e.layer;          // the new resulting layer
  e.originalLayer;  // the layer that was cut
  e.shape;          // 'Cut'
});
```

**Critical gotcha — `pm:cut` also fires `pm:edit`**. When a cut completes, the original layer technically changes, so `pm:edit` fires alongside `pm:cut`. If you persist on `pm:edit`, you'll get two writes for one cut.

The fix: check whether the layer is the result of a cut by setting a marker on it, or differentiate via the originalLayer reference:

```js
let cuttingInProgress = false;

map.on('pm:cut', (e) => {
  cuttingInProgress = true;
  saveToBackend(e.layer.toGeoJSON(), 'cut');
  // delete the original
  removeFromBackend(e.originalLayer);
  setTimeout(() => { cuttingInProgress = false; }, 0);
});

featureGroup.on('pm:edit', (e) => {
  if (cuttingInProgress) return;   // ignore the edit that came from the cut
  saveToBackend(e.layer.toGeoJSON(), 'edit');
});
```

---

## Rotation Mode

Rotates a layer around its center.

```js
map.pm.enableGlobalRotateMode();
map.pm.disableGlobalRotateMode();

// Per layer:
layer.pm.enableRotate();
layer.pm.disableRotate();
layer.pm.rotateEnabled();
layer.pm.getAngle();              // current rotation in degrees
layer.pm.setAngle(45);            // set rotation in degrees
layer.pm.rotateLayer(15);         // rotate by 15° (relative)
```

Events:

```js
layer.on('pm:rotatestart', (e) => { /* ... */ });
layer.on('pm:rotate', (e) => { /* e.angle, e.startAngle, e.originLatLngs */ });
layer.on('pm:rotateend', (e) => { /* ... */ });
```

---

## Pro modes (overview) ⭐

These exist in the Pro package only. If you can't use Pro, the workarounds usually involve Turf.js for geometry operations + custom UI for the user input. Pro is faster to ship.

| Mode | What it does |
|---|---|
| **Scale Mode** | Drag corners to resize a shape uniformly or per-axis |
| **Split Mode** | Draw a line through a polygon to cut it into two pieces (vs. Cut which removes area) |
| **Union Mode** | Click two layers to merge them into one |
| **Difference Mode** | Click layer A, click layer B → A minus B (preserves both inputs) |
| **Measurement** | Live distance/area readout while drawing or editing |
| **Snap Guides** | Dashed-line guides at 90° from the current edge to help create right angles |
| **Auto-tracing** | While drawing along an existing layer's edge, snap to follow it |
| **Pinning** | When dragging a vertex, all other vertices at the same lat/lng follow (avoids gaps between adjacent polygons) |
| **Line Simplification** | Reduce vertex count of polylines/polygons interactively |
| **CutCircle / cutAsCircle** | Cut using a circular shape |
| **Lasso Mode** | Free-draw a polygon to select / operate on contained features |

API calls follow the same `map.pm.enableGlobalXMode()` / `disableGlobalXMode()` pattern.

---

## Snapping

Snapping is a feature, not a mode — it operates inside Draw and Edit modes. When the cursor or a dragged vertex gets within `snapDistance` pixels of another layer's vertex/edge, it locks to that point.

```js
map.pm.setGlobalOptions({
  snappable: true,
  snapDistance: 20,
  snapMiddle: false,     // also snap to edge midpoints
  snapSegment: true,     // snap to line segments (not just vertices)
});
```

### Per-layer opt-out

You almost always want some layers to be snappable and some not (e.g., snap to existing parcels, don't snap to background labels).

```js
// This layer cannot be snapped TO from other layers' drawing:
const labelLayer = L.geoJSON(data, { snapIgnore: true }).addTo(map);

// This layer is ALWAYS snappable, even if pmIgnore is true:
const parcels = L.geoJSON(data, { snapIgnore: false }).addTo(map);
```

Users can also hold **Alt** to temporarily disable snapping during a draw — built in, no code needed.

### Require snap to finish

```js
map.pm.enableDraw('Polygon', {
  snappable: true,
  requireSnapToFinish: true,    // can't close polygon unless the last vertex snaps
});
```

Great for forcing clean topology (no floating gaps between polygons that should share an edge).

---

## Events

The full event catalog. Events prefixed `pm:` to namespace them away from Leaflet's own events.

### Map-level events

| Event | Fires when |
|---|---|
| `pm:create` | A new layer was drawn and added |
| `pm:drawstart` | A draw mode was enabled |
| `pm:drawend` | A draw mode was disabled |
| `pm:globaldrawmodetoggled` | Draw mode toggled on/off (any shape) |
| `pm:globaleditmodetoggled` | Edit-everything mode toggled |
| `pm:globaldragmodetoggled` | Drag-everything mode toggled |
| `pm:globalremovalmodetoggled` | Removal mode toggled |
| `pm:globalcutmodetoggled` | Cut mode toggled |
| `pm:globalrotatemodetoggled` | Rotate mode toggled |
| `pm:cut` | Something was cut |
| `pm:buttonclick` | Any toolbar button was clicked |
| `pm:actionclick` | A toolbar action (cancel / finish / etc.) was clicked |
| `pm:keyevent` | Keyboard event during a Geoman operation |
| `pm:langchange` | Language was changed |

### Layer-level events

| Event | Fires when |
|---|---|
| `pm:edit` | Vertex moved (high-frequency) |
| `pm:update` | Edit mode disabled, changes made (low-frequency, **save here**) |
| `pm:enable` | Edit mode enabled on this layer |
| `pm:disable` | Edit mode disabled on this layer |
| `pm:vertexadded` | New vertex inserted |
| `pm:vertexremoved` | Vertex removed |
| `pm:vertexclick` | Vertex clicked |
| `pm:markerdragstart` / `pm:markerdrag` / `pm:markerdragend` | Vertex marker dragged |
| `pm:dragstart` / `pm:drag` / `pm:dragend` | Whole-layer dragged |
| `pm:rotatestart` / `pm:rotate` / `pm:rotateend` | Layer rotated |
| `pm:remove` | Layer removed |
| `pm:cut` | Layer was cut (also fires on the new layer) |
| `pm:snap` | Vertex snapped to something |
| `pm:unsnap` | Vertex unsnapped |
| `pm:centerplaced` | Circle center placed (during draw) |
| `pm:change` | Generic "something changed" (Pro shapes especially) |
| `pm:cancel` ⭐ | Layer changes cancelled |

### The 80/20 of events

If you only learn three, learn these:

```js
map.on('pm:create', (e) => persist(e.layer));   // user finished drawing
layer.on('pm:update', (e) => persist(e.layer)); // user finished editing
layer.on('pm:remove', (e) => unpersist(e.layer)); // user removed
```

That trio plus `pm:cut` covers the standard CRUD-over-shapes use case.

---

## Ignoring layers (`pmIgnore`)

By default, Geoman wires itself onto every layer you add — that's the "auto-init" behavior. Sometimes you don't want that (background tiles, label overlays, fixed pins). Two patterns:

### Per-layer opt-out

```js
const labelMarker = L.marker([51.5, -0.09], { pmIgnore: true }).addTo(map);
```

`pmIgnore: true` means "Geoman should pretend this layer doesn't exist" — it can't be edited, dragged, removed, or snapped to.

To re-enable on a previously-ignored layer:

```js
layer.options.pmIgnore = false;
L.PM.reInitLayer(layer);
```

### Global opt-IN (inverted default)

If most of your layers should be ignored and only a few should be editable, flip the default:

```js
import * as L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';

L.PM.setOptIn(true);   // now layers need pmIgnore: false to participate
```

After enabling opt-in, **newly-drawn layers are also ignored by default**. To make them editable on creation:

```js
map.on('pm:create', (e) => {
  e.layer.options.pmIgnore = false;
  L.PM.reInitLayer(e.layer);
});
```

The opt-in pattern is the right choice for read-mostly maps that only need editing in a specific workflow.

---

## Customization

### Hide buttons after creation

```js
map.pm.addControls({ drawCircle: false });
// or to hide everything except polygon:
map.pm.addControls({
  drawMarker: false, drawCircleMarker: false, drawCircle: false,
  drawPolyline: false, drawRectangle: false, drawText: false,
  cutPolygon: false, rotateMode: false,
});
```

### Style the toolbar buttons

Geoman buttons get `.leaflet-pm-toolbar` and per-button classes you can target:

```css
.leaflet-pm-toolbar a {
  background-color: #1f2937;
  filter: invert(1);   /* if you want light-on-dark icons */
}
.leaflet-pm-toolbar .active {
  background-color: #3b82f6 !important;
}
```

### Custom buttons (your own action in the toolbar)

```js
map.pm.Toolbar.createCustomControl({
  name: 'saveAll',
  block: 'custom',                     // 'draw' | 'edit' | 'custom' | 'options'
  title: 'Save all shapes',
  className: 'my-save-icon',           // CSS class for icon
  onClick: () => {
    const all = drawnItems.toGeoJSON();
    saveToBackend(all);
  },
  toggle: false,                       // is this a toggle button (active/inactive)?
  afterClick: () => { /* runs after onClick */ },
});
```

The `block: 'custom'` slot is reserved for your additions.

### Copy a built-in button and customize it

```js
map.pm.Toolbar.copyDrawControl('Rectangle', {
  name: 'RoomRectangle',
  block: 'custom',
  title: 'Draw a room',
  actions: [
    'cancel',
    { text: 'Finish', onClick: () => map.pm.disableDraw() },
  ],
});
```

`actions` are the small text buttons that appear next to a draw button while drawing (the "cancel / remove last vertex / finish" tray). Defaults: `'cancel'`, `'removeLastVertex'`, `'finish'`, `'finishMode'`.

### Position individual button blocks

By default all blocks (draw, edit, custom) live in one corner. Spread them:

```js
map.pm.addControls({
  position: 'topleft',
  positions: {
    draw: 'topleft',
    edit: 'topright',
    custom: 'bottomleft',
    options: 'bottomright',   // ⭐ Pro
  },
});
```

---

## Translations (i18n)

Geoman ships translations for ~20 languages. To switch:

```js
map.pm.setLang('de');      // German
map.pm.setLang('fr');      // French
```

Available out of the box (as of 2026): `cz`, `da`, `de`, `el`, `en`, `es`, `fa`, `fr`, `hu`, `id`, `it`, `nl`, `no`, `pl`, `pt_br`, `ro`, `ru`, `sv`, `tr`, `ua`, `zh`, `zh_tw`.

Override specific strings:

```js
const custom = {
  tooltips: {
    placeMarker: 'Drop pin here',
    firstVertex: 'Click to place first vertex',
    continueLine: 'Click to continue the line',
    finishLine: 'Click any existing point to finish',
    finishPoly: 'Click first point to finish',
  },
  actions: {
    finish: 'Done',
    cancel: 'Nevermind',
    removeLastVertex: 'Undo',
  },
  buttonTitles: {
    drawMarkerButton: 'Add pin',
    drawPolyButton: 'Outline area',
    editButton: 'Edit',
    deleteButton: 'Delete',
  },
};

map.pm.setLang('customEN', custom, 'en');   // 3rd arg = fallback lang
```

The 3rd argument is the fallback — your overrides merge on top of `'en'` (or whichever fallback you choose).

---

## TypeScript

The free and Pro packages both ship `leaflet-geoman.d.ts` — full types come bundled. Importing the side-effect package augments the `L` namespace globally:

```ts
import * as L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';   // augments L.Map and L.Layer types

const map: L.Map = L.map('map');
map.pm.addControls({ position: 'topleft' });   // fully typed
```

Key types you'll use directly:

```ts
import type { Map } from 'leaflet';
// Module augmentation makes these available:

// From L.PM namespace:
type ShapeKind =
  | 'Marker' | 'CircleMarker' | 'Circle'
  | 'Line' | 'Rectangle' | 'Polygon'
  | 'Cut' | 'Text';

interface PMCreateEvent {
  shape: ShapeKind;
  layer: L.Layer;
}

interface PMEditEvent {
  layer: L.Layer;
  shape: ShapeKind;
}

interface PMCutEvent {
  layer: L.Layer;          // the new layer
  originalLayer: L.Layer;  // before the cut
  shape: 'Cut';
}
```

When typing event handlers, the `pm:` events aren't in Leaflet's built-in event map, so cast:

```ts
map.on('pm:create', (e) => {
  const event = e as unknown as { shape: string; layer: L.Layer };
  console.log(event.shape, event.layer.toGeoJSON());
});
```

Or define an interface for the events your app cares about and assert at the boundary.

---

## React Leaflet integration

Geoman doesn't ship a React Leaflet wrapper out of the box, but the standard pattern is two small components. This works with both react-leaflet v4 and v5.

### GeomanControl component

```tsx
// components/GeomanControl.tsx
import { createControlComponent } from '@react-leaflet/core';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

interface GeomanProps extends L.ControlOptions {
  position: L.ControlPosition;
  drawCircle?: boolean;
  drawMarker?: boolean;
  drawPolygon?: boolean;
  drawPolyline?: boolean;
  drawRectangle?: boolean;
  drawCircleMarker?: boolean;
  drawText?: boolean;
  editMode?: boolean;
  dragMode?: boolean;
  cutPolygon?: boolean;
  removalMode?: boolean;
  rotateMode?: boolean;
  oneBlock?: boolean;
}

const Geoman = L.Control.extend({
  options: {},
  initialize(options: GeomanProps) {
    L.setOptions(this, options);
  },
  addTo(map: L.Map) {
    if (!map.pm) return this;
    map.pm.addControls({ ...this.options });
    return this;
  },
});

const createGeomanInstance = (props: GeomanProps) => new Geoman(props);

export const GeomanControl = createControlComponent(createGeomanInstance);
```

### Events component

```tsx
// components/GeomanEvents.tsx
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { Layer } from 'leaflet';

interface GeomanEventsProps {
  onCreate?: (layer: Layer, shape: string) => void;
  onUpdate?: (layer: Layer) => void;
  onRemove?: (layer: Layer) => void;
  onCut?: (layer: Layer, originalLayer: Layer) => void;
}

export function GeomanEvents({ onCreate, onUpdate, onRemove, onCut }: GeomanEventsProps) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handleCreate = (e: { layer: Layer; shape: string }) => {
      // Wire up persistence events on the new layer:
      e.layer.on('pm:update', () => onUpdate?.(e.layer));
      e.layer.on('pm:remove', () => onRemove?.(e.layer));
      e.layer.on('pm:cut', (cutEvent: { layer: Layer; originalLayer: Layer }) => {
        onCut?.(cutEvent.layer, cutEvent.originalLayer);
      });
      onCreate?.(e.layer, e.shape);
    };

    map.on('pm:create', handleCreate as unknown as L.LeafletEventHandlerFn);

    return () => {
      map.off('pm:create', handleCreate as unknown as L.LeafletEventHandlerFn);
    };
  }, [map, onCreate, onUpdate, onRemove, onCut]);

  return null;
}
```

### Usage

```tsx
import { MapContainer, TileLayer } from 'react-leaflet';
import { GeomanControl } from './components/GeomanControl';
import { GeomanEvents } from './components/GeomanEvents';
import 'leaflet/dist/leaflet.css';

export function MyEditor() {
  return (
    <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: 500 }}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <GeomanControl position="topleft" oneBlock />

      <GeomanEvents
        onCreate={(layer, shape) => console.log('created', shape, layer.toGeoJSON())}
        onUpdate={(layer) => console.log('updated', layer.toGeoJSON())}
        onRemove={(layer) => console.log('removed')}
      />
    </MapContainer>
  );
}
```

### Next.js / SSR

Same rule as base Leaflet — Geoman touches `window` at import time. Wrap your map component in `dynamic(..., { ssr: false })`. See `references/react-leaflet.md` for the full pattern.

---

## Common recipes

### Recipe 1: Save drawn shapes, restore them later

```js
const drawnItems = L.featureGroup().addTo(map);

// On create — move into the FeatureGroup and persist
map.on('pm:create', (e) => {
  map.removeLayer(e.layer);
  drawnItems.addLayer(e.layer);
  saveToBackend(drawnItems.toGeoJSON());
});

// On update or remove — re-persist
drawnItems.on('pm:update pm:remove', () => {
  saveToBackend(drawnItems.toGeoJSON());
});

// On load — restore
async function restore() {
  const geojson = await fetchFromBackend();
  const restored = L.geoJSON(geojson).addTo(map);
  restored.eachLayer((layer) => drawnItems.addLayer(layer));
  map.removeLayer(restored);   // we only want them in drawnItems
}
```

Loaded layers are automatically editable because Geoman auto-inits them.

### Recipe 2: Restrict to one shape, one feature

For "draw exactly one polygon to define the area":

```js
let theShape = null;

map.pm.addControls({
  position: 'topleft',
  drawMarker: false, drawCircleMarker: false, drawCircle: false,
  drawPolyline: false, drawRectangle: false, drawText: false,
  drawPolygon: true,
  cutPolygon: false, rotateMode: false,
  editMode: true, removalMode: true, dragMode: false,
});

map.on('pm:create', (e) => {
  // Replace any existing shape
  if (theShape) map.removeLayer(theShape);
  theShape = e.layer;
});
```

### Recipe 3: Limit number of vertices

```js
map.pm.enableDraw('Polygon', {
  pathOptions: { color: '#3388ff' },
});

map.on('pm:vertexadded', (e) => {
  const verts = e.workingLayer.getLatLngs()[0];
  if (verts.length >= 8) {
    map.pm.Draw.Polygon._finishShape();   // force finish
  }
});
```

### Recipe 4: Validation before save

```js
map.on('pm:create', (e) => {
  if (e.shape !== 'Polygon') return;
  if (e.layer.pm.hasSelfIntersection()) {
    alert('Polygon cannot cross itself');
    map.removeLayer(e.layer);
    return;
  }
  const area = L.GeometryUtil.geodesicArea(e.layer.getLatLngs()[0]);
  if (area < 100) {
    alert('Area too small (min 100 m²)');
    map.removeLayer(e.layer);
    return;
  }
  saveToBackend(e.layer.toGeoJSON());
});
```

### Recipe 5: Programmatic draw from a button (no toolbar)

```html
<button id="draw-polygon">Draw area</button>
```

```js
document.getElementById('draw-polygon').onclick = () => {
  map.pm.enableDraw('Polygon', {
    snappable: true,
    finishOn: 'dblclick',
  });
};

map.on('pm:create', (e) => {
  // your handling
});
```

No `addControls()` call → no built-in toolbar → your UI fully controls the experience.

### Recipe 6: Builder for a configured editor

When you build several maps with similar setups, wrap it:

```ts
interface EditorBuilderOptions {
  container: string | HTMLElement;
  center: L.LatLngExpression;
  zoom: number;
}

interface GeomanShapeFlags {
  marker?: boolean;
  polyline?: boolean;
  polygon?: boolean;
  rectangle?: boolean;
  circle?: boolean;
  text?: boolean;
}

class GeomanEditorBuilder {
  private map: L.Map;
  private drawn = L.featureGroup();
  private shapes: GeomanShapeFlags = {
    marker: true, polyline: true, polygon: true,
    rectangle: true, circle: true, text: false,
  };
  private snap = true;
  private allowSelfIntersection = false;
  private onPersist?: (geo: GeoJSON.FeatureCollection) => void;

  constructor(opts: EditorBuilderOptions) {
    this.map = L.map(opts.container).setView(opts.center, opts.zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OSM',
    }).addTo(this.map);
    this.drawn.addTo(this.map);
  }

  shapesEnabled(flags: GeomanShapeFlags): this {
    this.shapes = { ...this.shapes, ...flags };
    return this;
  }

  withSnap(snapDistance = 20): this {
    this.snap = true;
    this.map.pm.setGlobalOptions({ snappable: true, snapDistance });
    return this;
  }

  strictPolygons(): this {
    this.allowSelfIntersection = false;
    this.map.pm.setGlobalOptions({ allowSelfIntersection: false });
    return this;
  }

  onSave(cb: (geo: GeoJSON.FeatureCollection) => void): this {
    this.onPersist = cb;
    return this;
  }

  load(geojson: GeoJSON.FeatureCollection): this {
    L.geoJSON(geojson).eachLayer((l) => this.drawn.addLayer(l));
    return this;
  }

  build(): L.Map {
    this.map.pm.addControls({
      position: 'topleft',
      drawMarker: this.shapes.marker,
      drawPolyline: this.shapes.polyline,
      drawPolygon: this.shapes.polygon,
      drawRectangle: this.shapes.rectangle,
      drawCircle: this.shapes.circle,
      drawText: this.shapes.text,
      drawCircleMarker: false,
      editMode: true,
      dragMode: true,
      cutPolygon: this.shapes.polygon,
      removalMode: true,
      rotateMode: false,
    });

    this.map.on('pm:create', (e: { layer: L.Layer }) => {
      this.map.removeLayer(e.layer);
      this.drawn.addLayer(e.layer);
      this.onPersist?.(this.drawn.toGeoJSON() as GeoJSON.FeatureCollection);
    });
    this.drawn.on('pm:update pm:remove pm:cut', () => {
      this.onPersist?.(this.drawn.toGeoJSON() as GeoJSON.FeatureCollection);
    });

    return this.map;
  }
}

// Usage:
const map = new GeomanEditorBuilder({ container: 'map', center: [51.5, -0.09], zoom: 13 })
  .shapesEnabled({ polygon: true, rectangle: true, marker: false, polyline: false, circle: false })
  .withSnap(25)
  .strictPolygons()
  .load(existingGeoJSON)
  .onSave((g) => saveToBackend(g))
  .build();
```

The builder collapses the common 30+ lines of Geoman setup into a single chain. Adjust to taste — most apps will want a similar wrapper specific to their save/load flow.

---

## Gotchas

### 1. `pm:edit` is high-frequency; use `pm:update` for persistence

`pm:edit` fires on every vertex move (potentially dozens per second during a drag). `pm:update` fires once when the user finishes editing. If you POST to a backend, listen to `pm:update`.

### 2. `pm:cut` also triggers `pm:edit`

Cutting fires both events. If you have separate handlers for both, debounce or set a flag. See the [Cut Mode](#cut-mode) section for the pattern.

### 3. `L.LayerGroup` doesn't propagate Geoman events; use `L.FeatureGroup`

Plain `LayerGroup` doesn't fire `layeradd`/`layerremove` events from its children — Geoman uses these to track membership. **Use `L.FeatureGroup` or `L.GeoJSON`** for any container of editable layers. The docs include a monkey-patch workaround for LayerGroup, but it's easier to just use FeatureGroup.

### 4. Auto-init catches every new layer

Every layer you `.addTo(map)` after Geoman loads becomes editable. For background-only layers (tiles, labels, fixed pins, choropleth shading), set `pmIgnore: true` on creation, or use opt-in mode (`L.PM.setOptIn(true)`).

### 5. The layer is on the map before `pm:create` fires

Geoman adds the new layer to the map for you. If you want it in a `FeatureGroup` instead, you have to remove and re-add inside the handler. There's no "don't add automatically" flag.

### 6. SSR crashes (Next.js, Nuxt, SvelteKit, Remix)

Geoman is a Leaflet plugin and inherits Leaflet's "touches `window` on import" problem. Use `dynamic(() => import('./Map'), { ssr: false })` in Next.js. See `references/react-leaflet.md` for the full pattern.

### 7. CSS not loaded → buttons render unstyled

`@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css` is a separate import from the JS. Forgetting it gives you broken-looking, oversized icon buttons.

### 8. Plain `L.Marker` is editable too, which surprises people

Drawing a marker creates an L.Marker. By default, Edit Mode lets the user drag the marker. If you want the user to be able to delete/move it but not the marker's *coordinates*, you'll find there's no such mode — markers either participate or don't. Use `pmIgnore: true` on markers that should be static.

### 9. Toolbar position vs. block positions

`addControls({ position: 'topleft' })` sets the default position. `addControls({ positions: { draw: 'topleft', edit: 'topright' } })` overrides per block. If the toolbar isn't where you expect, check whether `positions` is overriding `position`.

### 10. `pmIgnore: false` doesn't re-enable after `pmIgnore: true`

Setting `layer.options.pmIgnore = false` isn't enough on its own. You must also call `L.PM.reInitLayer(layer)` to re-initialize Geoman on that layer.

```js
// Wrong:
layer.options.pmIgnore = false;
// (layer is still ignored)

// Right:
layer.options.pmIgnore = false;
L.PM.reInitLayer(layer);
```

### 11. Toolbar icon assets

The toolbar icons are loaded from `leaflet-geoman.css` via relative URLs to glyphicon assets bundled in the package. Most bundlers handle this fine. If you see missing icon images, check that your bundler is copying assets from `node_modules/@geoman-io/leaflet-geoman-free/dist/` to your output.

### 12. Pro features in the free build

Calling a Pro method (`enableGlobalSplitMode`, `enableGlobalScaleMode`, etc.) from the free build silently does nothing (or warns in console depending on version). Don't rely on these methods being present unless you've installed the Pro package.
