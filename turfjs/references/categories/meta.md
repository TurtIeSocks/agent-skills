# Meta — deep dive

Meta is iteration helpers for GeoJSON. People who don't know about it write a lot of recursive descent by hand and get it wrong (forgetting the `type: "GeometryCollection"` case, double-iterating wrap coordinates on closed rings, missing the MultiPolygon → Polygon → ring → coord nesting). Use these instead.

## Picking the right iterator

| Iterator | Visits | Use when |
|---|---|---|
| `coordEach(g, fn, excludeWrapCoord?)` | Every `[lon, lat]` Position in any geometry | You need to touch each coordinate (e.g., transform, validate, count) |
| `featureEach(fc, fn)` | Each Feature in a FeatureCollection (1 level deep) | You're processing a FeatureCollection like an array |
| `flattenEach(g, fn)` | Each individual sub-feature (MultiPolygon → 3 Polygons) | You want to treat Multi* as if it were separate features |
| `geomEach(g, fn)` | Each raw Geometry object (skips Feature wrapping) | You're doing geometry-level math and don't care about properties/ids |
| `segmentEach(g, fn)` | Every 2-vertex segment of every line/ring | You're processing edges (e.g., compute total length, check segment angles) |
| `propEach(fc, fn)` | Each `properties` object | You're modifying / reading properties without touching geometry |
| `lineEach(g, fn)` | Each LineString within any geometry | You're processing lines but the input may be wrapped in polygons or MultiLineStrings |

Each iterator has a `Reduce` counterpart (`coordReduce`, `featureReduce`, etc.) for accumulator-style aggregation.

## The `excludeWrapCoord` argument

Closed rings (Polygons) repeat the first vertex as the last vertex to close the loop. `coordEach` visits this duplicate by default. Pass `true` as the third argument to skip it:

```typescript
turf.coordEach(polygon, (coord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) => {
  // visits every coord including the duplicate closing vertex
});

turf.coordEach(polygon, (coord) => {
  // ...
}, true); // skip the wrap coord
```

If you're computing per-vertex statistics (e.g., counting unique vertices), pass `true`. For coordinate transformations that need to keep rings closed, leave it `false`.

## Worked example: total length of every LineString in a complex geometry

```typescript
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Geometry } from "geojson";

function totalLengthKm(geojson: FeatureCollection<Geometry>): number {
  let total = 0;
  turf.lineEach(geojson, (line) => {
    total += turf.length(line, { units: "kilometers" });
  });
  return total;
}
```

`lineEach` does the right thing whether the input contains LineStrings, MultiLineStrings, or even Polygons (each ring is a LineString).

## Worked example: tagging every feature with its bbox

```typescript
import type { FeatureCollection, Polygon } from "geojson";

function annotateWithBbox<P>(fc: FeatureCollection<Polygon, P>) {
  turf.featureEach(fc, (feature) => {
    feature.bbox = turf.bbox(feature);
  });
  return fc;
}
```

`featureEach` callback receives `(feature, index)` — handy for parallel arrays.

## Worked example: accumulating with reduce

```typescript
// Count unique property values
const counts = turf.propReduce(
  featureCollection,
  (acc, props) => {
    const key = props?.category ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);
```

## `flattenEach` vs `featureEach`

If your FeatureCollection contains a MultiPolygon with 3 sub-polygons:

- `featureEach` calls your callback **once** with the MultiPolygon Feature
- `flattenEach` calls your callback **3 times**, each with one of the sub-polygons (synthesized as separate Features)

Use `flattenEach` when "I want to treat each polygon individually even if they came in as a MultiPolygon."

## Direct accessors: `getCoord`, `getCoords`, `getGeom`, `getType`

These are not iterators — they're extractors that pull what you need without manual `feature.geometry.coordinates` digging:

```typescript
// Robust to "is this a Feature or a raw Geometry?"
const coord = turf.getCoord(point);         // Position
const coords = turf.getCoords(polygon);     // Position[][] for Polygon
const geom = turf.getGeom(feature);         // unwrap
const type = turf.getType(feature);         // "Point" | "Polygon" | ...
```

They handle the Feature/Geometry wrapping transparently and throw a clear error if you pass the wrong kind. Use them in API surfaces that accept "any GeoJSON" — defensive but tidy.

## When NOT to use Meta

If you're doing a single operation per top-level feature, plain `featureCollection.features.map(...)` is fine and clearer. Meta earns its keep when:

- You need to walk into Multi* features
- You need to visit coordinates inside polygons (rings + multi-rings)
- You need to maintain accumulator state across the walk (Reduce form)
- The input type is open (Feature | FeatureCollection | Geometry) and you want one code path

For pure data tasks where the geometry kind is known, plain array methods are easier to read.

## Cluster iteration

Functions in this category that look like cluster helpers (`clusterEach`, `clusterReduce`, `getCluster`) live in `@turf/clusters` and operate on FeatureCollections that have a `cluster` property on each feature (set by `clustersDbscan` / `clustersKmeans`). See `references/categories/aggregation.md` for the upstream clustering functions that produce these inputs.

```typescript
const clustered = turf.clustersKmeans(points, { numberOfClusters: 5 });

turf.clusterEach(clustered, "cluster", (clusterFc, clusterValue) => {
  // clusterFc is a FeatureCollection of points in this cluster
  // clusterValue is the cluster number (0..4)
});
```
