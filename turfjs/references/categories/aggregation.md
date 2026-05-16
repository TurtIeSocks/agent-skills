# Aggregation — deep dive

Three functions: two clustering algorithms and one property aggregator. Picking between the clustering algorithms is the main decision.

## DBSCAN vs k-means: which to use

| | `clustersDbscan` | `clustersKmeans` |
|---|---|---|
| **You specify** | Distance threshold (maxDistance) + minPoints | Number of clusters (k) |
| **Auto-discovers cluster count?** | Yes | No |
| **Handles noise / outliers?** | Yes — marks unclustered points as noise | No — every point joins a cluster |
| **Sensitive to cluster shape?** | Handles arbitrary shapes | Assumes roughly spherical clusters |
| **When to use** | You don't know how many clusters exist; data has noise; clusters might be irregular | You know roughly how many groups you want; clusters are compact and similar-sized |

### `clustersDbscan`

```typescript
import { clustersDbscan } from "@turf/clusters-dbscan";

const clustered = clustersDbscan(points, 0.5, {
  units: "kilometers",     // for the maxDistance value
  minPoints: 3,            // minimum points to form a cluster (default 3)
  mutate: false,           // false = clone input (default), true = modify in place
});
```

Each point in the result gets:
- `cluster: number` — the cluster index, OR
- `dbscan: "core" | "edge" | "noise"` — classification within the cluster

Noise points have `dbscan: "noise"` and **no `cluster` property**.

### `clustersKmeans`

```typescript
import { clustersKmeans } from "@turf/clusters-kmeans";

const clustered = clustersKmeans(points, {
  numberOfClusters: 7,     // default: sqrt(points.length / 2)
  mutate: false,
});
```

Each point gets a `cluster: number` and a `centroid: [lon, lat]` (the cluster's mean location).

### Picking k for k-means

If you don't know k, common heuristics:
- **Default formula:** `sqrt(N/2)` — Turf's default; reasonable for small/medium N
- **Elbow method:** run for k = 1..10, plot total within-cluster variance, pick where the curve bends
- **Or just use DBSCAN** — it picks for you, and you tune a more intuitive parameter (distance threshold) instead

### When clustering is the wrong tool

Clustering is for **grouping similar points**, not for spatial queries. If the question is:
- "Which points are within X of each other?" → use a buffer + spatial join, not clustering
- "Are there hot spots in this data?" → use Moran's I (`moranIndex` in Other) or quadrat analysis
- "Which point is closest to each other point?" → use a spatial index with `rbush`, not clustering

## `collect` — aggregating point properties into polygons

`collect(polygons, points, inProp, outProp)` walks the points, for each one finds the containing polygon, and gathers the points' `inProp` values into an **array** stored under the polygon's `outProp`.

```typescript
import { collect } from "@turf/collect";

const enriched = collect(
  boroughs,        // FeatureCollection<Polygon>
  zipCodes,        // FeatureCollection<Point> with a `zip` property
  "zip",           // read this property from each point
  "containedZips", // write the gathered array onto each polygon
);

// each borough now has properties.containedZips: ["10001", "10002", ...]
```

This is the building block for "polygons enriched with their contained points' data" workflows. After `collect`, you can:
- Compute aggregates per polygon (count, sum of point property, etc.) using array methods on the new property
- Drive choropleth-style rendering off the collected data

### `collect` vs `tag`

- `tag` (Joins) writes **one** property per point — the property from its containing polygon (point ← polygon)
- `collect` (Aggregation) writes **an array** per polygon — values from all its contained points (polygon ← points)

They're inverse operations. If you need both directions, run both.

## Worked example: count + classify points per region

```typescript
import * as turf from "@turf/turf";
import type { FeatureCollection, Point, Polygon } from "geojson";

interface RegionProps {
  name: string;
  stationCount?: number;
  totalCapacity?: number;
}

interface StationProps {
  capacity: number;
}

function summarize(
  regions: FeatureCollection<Polygon, RegionProps>,
  stations: FeatureCollection<Point, StationProps>,
): FeatureCollection<Polygon, RegionProps> {
  // First gather capacity values into each region
  const withCaps = turf.collect(
    regions,
    stations,
    "capacity",
    "capacities",
  ) as FeatureCollection<Polygon, RegionProps & { capacities: number[] }>;

  // Then compute aggregates from the arrays
  return {
    ...withCaps,
    features: withCaps.features.map((r) => ({
      ...r,
      properties: {
        ...r.properties,
        stationCount: r.properties.capacities.length,
        totalCapacity: r.properties.capacities.reduce((s, c) => s + c, 0),
      },
    })),
  };
}
```

## Performance

Both clustering algorithms are in-memory and single-threaded. For a few thousand points they're snappy; for 100k+ points consider:

- **For DBSCAN at scale:** the algorithm itself is O(N²) in the worst case. Turf doesn't use a spatial index internally. If you have lots of data, pre-bucket by a coarse grid and run DBSCAN per bucket, or use a different tool.
- **For k-means at scale:** convergence is iterative; very large N or very large k slows it down. Same advice — pre-filter or sample if speed matters.

For the special case of "cluster the points I'm currently rendering on a map", use the map library's clusterer (Leaflet.markercluster, supercluster, Mapbox GL's built-in clustering) which is optimized for the rendering loop. Turf clustering is for analysis, not animation.
