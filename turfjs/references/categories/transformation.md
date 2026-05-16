# Transformation — deep dive

Transformation produces new geometry from input geometry. This is the category with the most foot-guns: every set op changed signature in v7, `buffer` defaults to kilometers, and `simplify` can subtly break shared borders.

## The set ops: `union`, `intersect`, `difference`, `dissolve`

All four take a `FeatureCollection<Polygon | MultiPolygon>` in v7 (not two args — see `references/foot-guns.md` item 2).

| Function | What it produces | Returns null when... |
|---|---|---|
| `union(fc, opts?)` | All polygons merged into a single Polygon/MultiPolygon | Never returns null; returns MultiPolygon if inputs are disjoint |
| `intersect(fc, opts?)` | Shared overlap area | No overlap exists |
| `difference(fc, opts?)` | First polygon minus the rest | First polygon is fully covered by the others |
| `dissolve(fc, opts?)` | Touching polygons merged; non-touching kept separate | Never returns null; returns a FeatureCollection |

**`dissolve` vs `union`:** `union` always tries to produce a single (possibly Multi) feature. `dissolve` preserves separation between non-adjacent groups. If you have three polygons where A touches B but not C, `union` gives you `MultiPolygon([A∪B, C])` as one feature; `dissolve` gives you a FeatureCollection with two members: `A∪B` and `C`.

`dissolve` also has a `propertyName` option — only merge neighbors that share the same value for that property. Useful for "merge by region code" type tasks.

### Worked example: incrementally union a stream of polygons

```typescript
import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";

function combineAll(polygons: Array<Feature<Polygon>>): Feature<Polygon | MultiPolygon> | null {
  if (polygons.length === 0) return null;
  if (polygons.length === 1) return polygons[0];
  return turf.union(turf.featureCollection(polygons)) as Feature<Polygon | MultiPolygon>;
}
```

## buffer: the workhorse + the biggest gotcha

```typescript
turf.buffer(geojson, radius, { units: "meters", steps: 64 });
```

- **Always pass `units` explicitly.** Default is kilometers. `buffer(point, 100)` produces a 100 km circle (see `references/foot-guns.md` #1).
- **`steps` controls smoothness** for rounded ends. Default is 8 — coarse but cheap. Bump to 32 or 64 for visual rendering.
- **Negative radius shrinks.** Useful for "interior offsets". Too-large negative values can collapse the geometry and return `undefined`.
- **Buffers on Points, LineStrings, and Polygons all work.** A buffered LineString gives you a corridor; a buffered Polygon expands or shrinks it.

### Approximating "how far from any road"

```typescript
import type { Feature, FeatureCollection, LineString, Point } from "geojson";

function withinDistanceOfAnyRoad(
  point: Feature<Point>,
  roads: FeatureCollection<LineString>,
  meters: number,
): boolean {
  const corridor = turf.buffer(roads, meters, { units: "meters" });
  if (!corridor) return false;
  return turf.booleanPointInPolygon(point, corridor as Feature<any>);
}
```

For a large number of points against a large road network, **don't** call this in a loop — buffer once, then use `pointsWithinPolygon`.

## circle: it's a faceted polygon, not a true circle

`circle(center, radius, opts?)` produces a Polygon approximation with `steps` vertices (default 64). For map rendering you usually won't see the facets. For exact containment math near the boundary, bump `steps` or use `pointToPolygonDistance` for a continuous distance instead.

If you just want a buffered point, `buffer(point, radius, ...)` and `circle(point, radius, ...)` do nearly the same thing under the hood, but `circle` lets you pass the steps directly without an options object indirection.

## simplify: topology pitfalls

`simplify(geojson, { tolerance, highQuality })` uses Ramer-Douglas-Peucker. It works **per-feature** — feature borders that are shared between two polygons get simplified independently, which can produce gaps or overlaps along the shared border.

If you have a coverage (a set of polygons that tile a region without gaps), don't simplify in Turf. Instead:

1. Convert to TopoJSON via [topojson-server](https://github.com/topojson/topojson-server)
2. Simplify with [topojson-simplify](https://github.com/topojson/topojson-simplify) (topology-preserving)
3. Convert back to GeoJSON via [topojson-client](https://github.com/topojson/topojson-client)

`highQuality: true` uses a slower variant that preserves more detail. Worth it for production output; skip for fast preview.

## Convex and concave hulls

- `convex(features)` — smallest convex polygon containing the input
- `concave(points, { maxEdge, units })` — concavity-bounded hull (alpha-shape)

Convex hulls are deterministic and fast. Concave hulls have a parameter (`maxEdge`) you have to tune for your data — set too small, you get a fragmented hull; too large, it collapses to the convex hull.

For "the smallest polygon that covers these points without gaps" → convex. For "the smallest polygon that hugs the actual shape of the point cloud" → concave with a tuned `maxEdge`.

## transform* operations

`transformRotate`, `transformScale`, `transformTranslate` mutate geometry rigidly. They DO mutate in place by default — pass `{ mutate: false }` to clone (or `turf.clone()` first).

```typescript
// Rotate 45° around the geometry's centroid
turf.transformRotate(polygon, 45, { mutate: false });

// Rotate around a specific pivot
turf.transformRotate(polygon, 45, { pivot: turf.point([-122.4, 37.8]), mutate: false });

// Move by distance + bearing
turf.transformTranslate(polygon, 5, 90, { units: "kilometers", mutate: false });

// Scale 2x around the bbox centroid
turf.transformScale(polygon, 2, { origin: "centroid", mutate: false });
```

`origin` for `transformScale` accepts `"sw" | "se" | "nw" | "ne" | "center" | "centroid" | "centerOfMass"` or a Position.

## Voronoi and tesselation

- `voronoi(points, { bbox })` — Voronoi diagram, **must** be clipped to a bbox (no infinite cells). Returns a FeatureCollection of Polygon.
- `tesselate(polygon)` — triangulate a Polygon into a FeatureCollection of triangles (useful for WebGL or area-by-triangle math).
- For Delaunay triangulation (the dual of Voronoi), see `tin` in Interpolation.

## bboxClip vs intersect

`bboxClip(feature, bbox)` is **fast** and **lossy** — clips to a rectangle. Output may be invalid for very thin / degenerate intersections. Use it for visual cropping (tile-rendering, viewport culling), not for exact set ops.

For exact intersection with a polygon (even a rectangular one), use `intersect` with the polygon as a FeatureCollection member.
