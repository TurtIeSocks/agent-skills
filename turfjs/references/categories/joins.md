# Joins — deep dive

A tiny category (two functions) but they answer one of the most common geospatial questions: "which of these points belong to which of these regions?"

## `pointsWithinPolygon` — the filter

Returns the subset of input Points that fall inside any of the provided Polygons.

```typescript
import { pointsWithinPolygon } from "@turf/points-within-polygon";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";

function inSpecificRegion<P>(
  points: FeatureCollection<Point, P>,
  region: Feature<Polygon>,
): FeatureCollection<Point, P> {
  return pointsWithinPolygon(points, region);
  //     ^? FeatureCollection<Point, P>  ← property types are preserved
}
```

### Multi-region queries

The polygon argument can be a single `Feature<Polygon | MultiPolygon>` or a `FeatureCollection<Polygon | MultiPolygon>` of multiple regions. The result is "points within ANY of them" (the union semantic):

```typescript
const regions: FeatureCollection<Polygon> = /* parks, neighborhoods, etc. */;
const matched = pointsWithinPolygon(stations, regions);
// stations that fall inside at least one region
```

The result does NOT tell you **which** region each point matched. If you need that, use `tag` instead.

### Boundary inclusion

`pointsWithinPolygon` includes points exactly on the boundary by default and (as of v7.3.0) does not expose the `ignoreBoundary` option. If strict interior is needed:

```typescript
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";

const strictMatches = pointsWithinPolygon(stations, region);
const filtered: FeatureCollection<Point, StationProperties> = {
  ...strictMatches,
  features: strictMatches.features.filter((p) =>
    booleanPointInPolygon(p, region, { ignoreBoundary: true }),
  ),
};
```

## `tag` — the labeler

Attaches a property from each containing polygon onto the points that fall inside it.

```typescript
import { tag } from "@turf/tag";
import type { FeatureCollection, Point, Polygon } from "geojson";

interface BoroughProperties {
  boroughName: string;
}

interface PointProperties {
  id: string;
}

interface TaggedPointProperties extends PointProperties {
  borough?: string;  // populated by tag()
}

const points: FeatureCollection<Point, PointProperties> = /* ... */;
const boroughs: FeatureCollection<Polygon, BoroughProperties> = /* ... */;

// Read `boroughName` from each polygon, write it as `borough` on matching points
const tagged = tag(points, boroughs, "boroughName", "borough") as FeatureCollection<Point, TaggedPointProperties>;
```

The signature is `tag(points, polygons, polyKey, outKey)`:
- `polyKey` — the name of the property to read on the polygon
- `outKey` — the name to write on the point

Points outside every polygon get **no new property** (the `outKey` is just absent). Hence the `?` in the typed result.

### When a point falls in multiple polygons

`tag` keeps the property from the **last** matching polygon in iteration order. If your polygons might overlap and you care about the winner, sort the polygon collection first or post-filter.

## Combining with other categories

The Joins category is small because most spatial-join needs reduce to "filter points by polygon" or "tag points with polygon property". For more elaborate joins, combine with other categories:

- **"Count points per polygon"** → `collect` (Aggregation category)
- **"Which polygon does each point belong to, with an explicit fallback"** → `tag` + a post-processing loop with `booleanPointInPolygon` for fallback regions
- **"Which polygons contain each point" (the n-to-many case)** → loop with `pointsWithinPolygon` per polygon, or use `rbush` for performance with many polygons

### Worked example: count stations per borough

```typescript
import * as turf from "@turf/turf";
import type { FeatureCollection, Point, Polygon } from "geojson";

interface BoroughProperties {
  boroughName: string;
  stationCount?: number;
}

function countStationsPerBorough(
  boroughs: FeatureCollection<Polygon, BoroughProperties>,
  stations: FeatureCollection<Point>,
): FeatureCollection<Polygon, BoroughProperties> {
  return {
    ...boroughs,
    features: boroughs.features.map((b) => ({
      ...b,
      properties: {
        ...b.properties,
        stationCount: turf.pointsWithinPolygon(stations, b).features.length,
      },
    })),
  };
}
```

For a few hundred boroughs × a few thousand stations this is fine. For larger N, use `collect` (which is built for this aggregation pattern) or an rbush index.

## Performance: when joins get slow

`pointsWithinPolygon` checks every point against every polygon — O(P × Q). For dense data, build an rbush index of the polygons (filtered by point bbox) before doing precise containment:

```typescript
const tree = turf.rbush();
tree.load(boroughs);

for (const station of stations.features) {
  const candidatePolys = tree.search(station);
  for (const poly of candidatePolys.features) {
    if (turf.booleanPointInPolygon(station, poly)) {
      // matched
    }
  }
}
```

This pattern moves the average case from O(P × Q) to roughly O(P log Q).
