# Turf.js foot-guns

Things that silently bite. Load this when working on tricky polygon operations, units, or migrating from v6.

## 1. `buffer` defaults to kilometers

The single most common silent error.

```typescript
// "It returned a giant polygon covering Europe"
turf.buffer(point, 100); // <-- 100 KILOMETERS, default

// What you almost certainly meant:
turf.buffer(point, 100, { units: "meters" });
```

Same default applies to anything that takes a `units` option (`distance`, `along`, `circle`, `lineChunk`, `pointToLineDistance`, `length`, etc.). The default is always `"kilometers"`. If your domain is in meters, **always pass `units` explicitly**.

## 2. v6 → v7 breaking changes for set operations

In v6:
```typescript
const result = turf.intersect(polyA, polyB); // ✅ v6
```

In v7+:
```typescript
const result = turf.intersect(turf.featureCollection([polyA, polyB])); // ✅ v7
// Or if you have a FC already:
const result = turf.intersect(fc);
```

Same applies to `union` and `difference`. The change unifies them with the n-ary case (more than two polygons) and matches `dissolve`.

You'll see the v6 form all over Stack Overflow, blog posts, and old tutorials. Don't trust them.

## 3. Coordinate order: `[lon, lat]`, not `[lat, lon]`

GeoJSON spec is `[longitude, latitude]`. Most map UIs and geocoders return `[lat, lng]` or `{ lat, lng }`. Mixing them produces points "near the equator off the coast of Africa" or other obvious-in-hindsight bugs.

```typescript
// San Francisco
turf.point([-122.4194, 37.7749]); // ✅ lon, lat
turf.point([37.7749, -122.4194]); // ❌ flipped — point is in Antarctica somewhere
```

If you're stuck with flipped data: `turf.flip(geojson)` swaps lon/lat in place.

## 4. `buffer` returns can be `undefined`

When the radius is negative and the input is too small to shrink (or the result is degenerate), `buffer` may return `undefined`. The TypeScript return type reflects this:

```typescript
const out = turf.buffer(feature, -100, { units: "meters" });
//    ^? FeatureCollection | Feature<Polygon | MultiPolygon> | undefined

if (!out) {
  // The buffer ate the geometry. Handle it.
}
```

Also note: when the input is a `FeatureCollection` and some members become invalid, those are silently dropped — the output collection may have fewer members than the input, or even be empty.

## 5. Turf does NOT re-export GeoJSON types

```typescript
// ❌ Won't work
import { Polygon, FeatureCollection } from "@turf/turf";
import { Point } from "@turf/helpers";

// ✅ Correct — from the @types/geojson package
import type { Polygon, FeatureCollection, Point } from "geojson";
```

You may need `npm install --save-dev @types/geojson`.

## 6. Ring winding order (CCW outer, CW holes)

GeoJSON RFC 7946 specifies counter-clockwise outer rings and clockwise inner rings (holes). Many sources (older datasets, hand-built JSON, some shapefiles) violate this.

Symptoms:
- `turf.area(polygon)` is negative or unexpectedly tiny
- `booleanPointInPolygon` returns wrong answers near boundaries
- Renderers show the polygon as a "hole in the world" (everything except the polygon is filled)

Fix:
```typescript
const fixed = turf.rewind(polygon, { reverse: false });
```

## 7. `length` vs `distance` — different functions for different inputs

- `turf.distance(p1, p2)` — straight-line (great-circle) distance between **two Points**
- `turf.length(line)` — total length of a **LineString** (sum of all segments)

Using `distance` on the endpoints of a LineString gives you the great-circle distance, not the path length. Different number, different meaning.

## 8. `nearestPoint` vs `nearestPointOnLine`

- `nearestPoint(target, points)` — find the closest **existing Point** from a FeatureCollection
- `nearestPointOnLine(line, point)` — find the closest **synthetic point that lies ON the line** (interpolated; not necessarily a vertex)

If a user asks "what's the closest stop to my location" → `nearestPoint`. If they ask "where on this route am I closest to" → `nearestPointOnLine`.

## 9. `circle` is an approximation

`turf.circle(center, radius)` returns a Polygon, not a true circle. The default `steps` is 64. For visual rendering at most zoom levels this is fine; for precise area/containment math, bump `steps` (at a cost) or use `buffer` on a Point which uses the same approximation under the hood.

## 10. `intersect` returns `null` when there's no intersection

Not an empty FeatureCollection, not undefined — literally `null`. The TS type reflects this. Always guard:

```typescript
const overlap = turf.intersect(turf.featureCollection([a, b]));
if (overlap === null) {
  // No overlap.
}
```

## 11. Mercator projection mutates units

`toMercator(geojson)` projects lon/lat (degrees) to Web Mercator (meters). After that, coordinates are in meters and Turf measurement functions (`distance`, `area`, `length`) — which assume lon/lat input and compute on a sphere — will return nonsense.

**Rule of thumb:** if you `toMercator` for rendering or tile-based math, `toWgs84` back before passing to any Turf measurement function. Or don't project at all and let Turf's spherical math do the work.

## 12. Anti-meridian / dateline crossing

Turf's measurement is generally great-circle and handles the dateline OK, but polygons that cross 180° longitude need their coordinates expressed correctly per RFC 7946 (split into two polygons across the dateline). Many tools produce invalid features here — `booleanValid` will catch some of these.

## 13. `simplify` can destroy topology between features

`simplify` works per-feature. If two polygons share a border, simplifying each independently can produce gaps or overlaps along that shared border. There is no `topojson`-style topology-preserving simplification in Turf — for that, use [topojson-server](https://github.com/topojson/topojson-server) + [topojson-simplify](https://github.com/topojson/topojson-simplify) and round-trip.

## 14. `pointsWithinPolygon` includes boundary by default

Boundary inclusion behavior matches `booleanPointInPolygon`, which defaults to **including** boundary points. Pass `{ ignoreBoundary: true }` on the boolean if you need strict interior.

`pointsWithinPolygon` does not currently expose the `ignoreBoundary` option — if you need strict interior, filter the result with `booleanPointInPolygon(p, poly, { ignoreBoundary: true })`.

## 15. The `properties` of derived features default to `{}`

Operations like `intersect`, `union`, `buffer` do NOT preserve the input feature's `properties`. They return a fresh feature with empty props unless you pass `options.properties`.

```typescript
const merged = turf.union(turf.featureCollection([a, b]), {
  properties: { ...a.properties, ...b.properties },
});
```

For pipelines where this matters, carry props through manually or wrap each Turf call in a helper that preserves them (see `references/typescript-patterns.md`).
