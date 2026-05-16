# Measurement — deep dive

Load this when the user is computing distances, areas, bbox-es, or picking between centroid-like functions. The Measurement category is the largest single-purpose category in Turf and has a few close-call decisions.

## "Find the middle" — picking between center, centerOfMass, and centroid

These three look like synonyms and they aren't.

| Function | What it computes | Cost | Use when |
|---|---|---|---|
| `centroid(features)` | Arithmetic mean of all vertices | O(n) — cheap | You want speed and don't care about shape (e.g., label clusters of points) |
| `centerOfMass(polygon)` | True polygon centroid weighted by area | O(n) but more math | You want the "balance point" — what most people mean by "the middle of this shape" |
| `center(features, opts?)` | Midpoint of the bbox | O(n) | You want a point near the centroid but guaranteed to sit in the geometry's bounding rectangle (fast labeling for axis-aligned UIs) |
| `centerMean(fc)` | Mean lon, mean lat across feature centers (Other) | O(n) | "Center of a cloud of points" with mean semantics |
| `centerMedian(fc)` | Iterative geometric median (Other) | O(iter · n) | Robust center that resists outliers — slower but stable |
| `pointOnFeature(geojson)` | A point guaranteed to lie ON the feature | O(n) | Placing a label that **must** sit on the geometry (e.g., on a sliver polygon where the centroid is outside) |

**Rule of thumb:**
- Labels on regular polygons → `centerOfMass`
- Labels on weird-shaped / U-shaped polygons → `pointOnFeature` (the centroid can fall outside an L-shape)
- Quick approximate label for a cluster of points → `centroid`
- A point inside a bbox-sized halo around the geometry → `center`

### Worked example: labeling a list of regions

```typescript
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";

interface Region {
  name: string;
}

function getLabelAnchor(region: Feature<Polygon, Region>) {
  // Try centerOfMass first; fall back to pointOnFeature for weird shapes
  const com = turf.centerOfMass(region);
  if (turf.booleanPointInPolygon(com, region)) {
    return com;
  }
  return turf.pointOnFeature(region);
}
```

## "How far" — great-circle vs rhumb

`distance(p1, p2)` and `bearing(p1, p2)` use **great-circle** math — the shortest path over a sphere. `rhumbDistance` and `rhumbBearing` use **rhumb lines** (loxodromes) — constant compass bearings.

| You want | Use |
|---|---|
| Shortest physical distance between two points | `distance` (great-circle) |
| Distance a ship/plane actually travels if it holds a constant heading | `rhumbDistance` |
| Bearing to point at the start of the journey | `bearing` |
| The single compass heading you'd hold the whole way | `rhumbBearing` |

For SF→Tokyo the great-circle distance is ~8,300 km but the rhumb-line distance is ~9,300 km. The two functions disagree more the longer the path and the further from the equator you go. For short distances (anything under ~1,000 km at mid-latitudes) the difference is small enough to ignore.

`destination(origin, dist, bearing)` is great-circle. `rhumbDestination(...)` is rhumb-line. If you're starting from a point and projecting outward, the two differ in the same way.

## "Length" pitfall — `length` is for LineStrings, `distance` is for two points

```typescript
const line = turf.lineString([[-122.4, 37.8], [-122.5, 37.9], [-122.6, 37.85]]);

turf.length(line, { units: "kilometers" });
// total path length: sum of segments

turf.distance(line.geometry.coordinates[0], line.geometry.coordinates[2]);
// great-circle distance between endpoints — does NOT walk the path
```

Forgetting this is a top-3 wrong-tool error. If the user asks "how long is the route" they want `length`.

## bbox shapes

- `bbox(geojson)` → `[west, south, east, north]` (the BBox type from `@types/geojson`)
- `bboxPolygon(bbox)` → wraps that array into a rectangular Polygon Feature (so you can render it or pass it to polygon-eating functions like `pointsWithinPolygon`)
- `envelope(features)` → same as `bbox` then `bboxPolygon`, in one call
- `square(bbox)` → smallest square bbox containing the input; useful for symmetric grids

Note: a bbox in GeoJSON is a 4-element (2D) or 6-element (3D, with min/max altitude) tuple. Several functions accept either, but most return the 4-element form.

## Units — always specify

Every distance-y function takes an `options.units` defaulting to `"kilometers"`. List of supported `Units`:

`"meters" | "kilometers" | "miles" | "nauticalmiles" | "inches" | "yards" | "feet" | "centimeters" | "millimeters" | "radians" | "degrees"` (plus British spellings: `metres`, `kilometres`, `centimetres`, `millimetres`).

For `area`, the **return is always m²** regardless of any option. Convert with `turf.convertArea(value, "meters", "kilometers")` if you need km².

```typescript
const areaSqM = turf.area(polygon);          // square meters, always
const areaSqKm = turf.convertArea(areaSqM, "meters", "kilometers");
```

## Point-to-line and point-to-polygon distance

- `pointToLineDistance(point, line)` — min distance to **any segment** of the line; great for "how far am I from a road"
- `pointToPolygonDistance(point, polygon)` — min distance to polygon **edge**; **returns 0 if the point is inside**, so this is also a "how far outside" measure that flips to 0 for interior points

If you need a non-zero answer for inside-the-polygon points (e.g., "how far inside the boundary"), use `nearestPointOnLine` against `polygonToLine(polygon)` and `distance` from there.

## Tangent points and polygon visibility

`polygonTangents(point, polygon)` returns the two points on the polygon boundary where you'd "graze" it from an external viewpoint. Useful for visibility cones, label-placement around obstacles, or generating shortest-path waypoints around a polygon (combined with `shortestPath` in Misc).
