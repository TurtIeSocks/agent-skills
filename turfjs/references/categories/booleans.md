# Booleans — deep dive

Picking the right boolean predicate is the trickiest part of Turf for people without a GIS background. Several predicates look like synonyms; they're not. Most map to the **DE-9IM** (Dimensionally Extended 9-Intersection Model) — the standard formal relations between geometries.

## Decision tree: "I want to check if..."

```
Is your question about a single point and a polygon?
├── "Does this point fall inside this polygon?"
│       → booleanPointInPolygon(point, polygon, { ignoreBoundary? })
│         (the most common — has an explicit boundary control)
└── "Does this point lie on this line?"
        → booleanPointOnLine(point, line, { ignoreEndVertices? })

Is your question about two polygons (or two of any geometry)?
├── "Do they overlap at all, even just touching?"
│       → booleanIntersects (returns true for any shared point)
├── "Do their interiors overlap, but neither contains the other?"
│       → booleanOverlap (proper overlap; same-dimension geoms only)
├── "Do they only touch at the boundary, with no interior overlap?"
│       → booleanTouches
├── "Are they completely separate?"
│       → booleanDisjoint (the inverse of booleanIntersects)
├── "Is A fully inside B (including coincident boundaries)?"
│       → booleanWithin(a, b)  // OR booleanContains(b, a)
├── "Does A fully cover B?"
│       → booleanContains(a, b)  // OR booleanWithin(b, a)
└── "Do they have exactly the same geometry?"
        → booleanEqual (order-sensitive; consider booleanEqualCoordinates from your own code if you need order-insensitive)

Is your question about lines specifically?
├── "Do they cross each other (different-dimension intersection)?"
│       → booleanCrosses
└── "Are they parallel?"
        → booleanParallel

Is your question about a polygon shape?
├── "Is this ring wound clockwise?"
│       → booleanClockwise
├── "Is this polygon concave (not convex)?"
│       → booleanConcave
└── "Is this a valid GeoJSON geometry at all?"
        → booleanValid  (Other category, but related)
```

## The confusing trio: `Intersects`, `Overlap`, `Crosses`

These three sound similar in English but mean different things:

| Predicate | Allows boundary-only contact? | Same dimensions only? | Includes full containment? |
|---|---|---|---|
| `booleanIntersects` | Yes | No | Yes |
| `booleanOverlap` | No | **Yes** | **No** |
| `booleanCrosses` | No | **No** (different dimensions only) | No |

- `Intersects` is the "anything goes" predicate — touching at a single corner counts.
- `Overlap` requires proper overlap of same-dimension features. Two polygons overlap; a line "overlapping" a polygon is not what `booleanOverlap` checks.
- `Crosses` is specifically for different-dimension features. A line crossing a polygon's interior is `Crosses`. Two polygons cannot `Cross` each other.

### Worked example: "do these two regions overlap?"

```typescript
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";

// "They touch at all" — broadest
turf.booleanIntersects(regionA, regionB);

// "They share interior area (the usual 'overlap')"
turf.booleanOverlap(regionA, regionB);
//   ↑ returns FALSE if A fully contains B (because one contains the other,
//     it's not 'overlap' in the strict DE-9IM sense). Use `booleanIntersects`
//     instead if you want "either overlap or containment."

// "A fully covers B (including coincident boundary)"
turf.booleanContains(regionA, regionB);
```

If you want "they overlap or one contains the other" — the colloquial English meaning of "overlap" — use **`booleanIntersects`**, not `booleanOverlap`.

## `Contains` vs `Within` — the same relation, swapped

`booleanContains(a, b)` is identical to `booleanWithin(b, a)`. Pick whichever reads better at the call site:

```typescript
// Both equivalent:
turf.booleanContains(country, city);
turf.booleanWithin(city, country);
```

Both are **inclusive of the boundary** — a feature on the boundary of another is considered contained / within. Use `booleanPointInPolygon` with `ignoreBoundary: true` if you specifically need strict interior containment for a Point.

## `booleanPointInPolygon` — the workhorse, with options

```typescript
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";

booleanPointInPolygon(point, polygon, { ignoreBoundary: true });
//                                       ↑ default false; if true, points
//                                         exactly on the boundary return false
```

Also accepts MultiPolygon as the second arg. For "point in any of these polygons" use a MultiPolygon or wrap with `Array.prototype.some`:

```typescript
const isInAnyRegion = regions.features.some((r) =>
  turf.booleanPointInPolygon(point, r)
);
```

For bulk queries (many points × many polygons), use `pointsWithinPolygon` from the Joins category — it's the same predicate but optimized for the bulk case.

## `booleanEqual` — geometry equality, order-sensitive

Two polygons with the same shape but different vertex ordering or starting vertex will **not** be `booleanEqual`. If you need topological equality regardless of vertex order, you'd combine `booleanContains` both ways:

```typescript
function topologicallyEqual(a: Feature<Polygon>, b: Feature<Polygon>): boolean {
  return turf.booleanContains(a, b) && turf.booleanContains(b, a);
}
```

This is `O(n²)` in the worst case but usually fine for small polygons.

## Ring orientation: `booleanClockwise`

GeoJSON RFC 7946 specifies CCW outer rings and CW holes. To check a single ring:

```typescript
turf.booleanClockwise(ring);
// where `ring` is a Feature<LineString> or array of Positions representing
// the ring (NOT the whole Polygon — pick which ring you mean)
```

If you need to fix winding, use `rewind` in the Coordinate Mutation category.

## Performance notes

The boolean predicates are not optimized for bulk queries. If you're checking `booleanPointInPolygon` against thousands of points, build an [rbush](https://github.com/mourner/rbush) spatial index of the polygons' bboxes first (Turf exposes `turf.rbush()`), filter candidates by bbox containment, then run the precise predicate on the filtered subset.

```typescript
import * as turf from "@turf/turf";

const tree = turf.rbush();
tree.load(turf.featureCollection(polygons));

// For each point:
const candidates = tree.search(turf.point(coord)) as FeatureCollection<Polygon>;
const matches = candidates.features.filter((poly) =>
  turf.booleanPointInPolygon(turf.point(coord), poly)
);
```

This is the standard pattern for any "many vs many" spatial query in Turf.
