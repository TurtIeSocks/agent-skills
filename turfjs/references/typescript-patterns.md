# TypeScript patterns for Turf.js

Turf is typed but the typing has rough edges (operations like `union` and `intersect` drop property types, some functions over-widen the return). Here are patterns that hold up under `strict: true`.

## Type imports — the canonical set

Always pull GeoJSON types from the `geojson` module (provided by `@types/geojson`).

```typescript
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeometryCollection,
  Point,
  MultiPoint,
  LineString,
  MultiLineString,
  Polygon,
  MultiPolygon,
  Position,
  BBox,
  GeoJsonProperties,
} from "geojson";
```

`Position` is `[number, number] | [number, number, number]` (lon, lat, optional altitude). `BBox` is `[number, number, number, number]` for 2D or 6-element for 3D.

## Parameterize property types

Both `Feature` and `FeatureCollection` are generic over geometry **and** properties.

```typescript
interface StopProperties {
  id: string;
  routeId: string;
  name: string;
}

// Single feature
const stop: Feature<Point, StopProperties> = turf.point(
  [-122.4, 37.8],
  { id: "s1", routeId: "r-7", name: "Market & 5th" },
);

// Collection
const stops: FeatureCollection<Point, StopProperties> = turf.featureCollection([stop]);

// Turf preserves property type when it can:
const nearest = turf.nearestPoint(target, stops);
//      ^? Feature<Point, StopProperties>
nearest.properties.routeId; // ✅ typed
```

## Narrowing geometry kind

`Feature<Geometry>` is too wide for most code. Narrow it at the boundary:

```typescript
function ensurePolygon(
  f: Feature<Geometry>,
): Feature<Polygon | MultiPolygon> {
  const t = turf.getType(f);
  if (t !== "Polygon" && t !== "MultiPolygon") {
    throw new TypeError(`Expected Polygon/MultiPolygon, got ${t}`);
  }
  return f as Feature<Polygon | MultiPolygon>;
}
```

Or use Turf's own assertions:

```typescript
turf.featureOf(f, "Polygon", "myFunction");
// throws if wrong; doesn't narrow the type, but documents intent at runtime
```

For real type narrowing, write a type guard:

```typescript
function isPolygonFeature(f: Feature<Geometry>): f is Feature<Polygon> {
  return f.geometry.type === "Polygon";
}
```

## `intersect` / `union` lose property types — preserve them yourself

These set operations return `Feature | null` with `Geometry` and `GeoJsonProperties` widened. If you need the props of the inputs:

```typescript
interface RegionProps {
  name: string;
  code: string;
}

function intersectRegions(
  a: Feature<Polygon | MultiPolygon, RegionProps>,
  b: Feature<Polygon | MultiPolygon, RegionProps>,
): Feature<Polygon | MultiPolygon, RegionProps> | null {
  const result = turf.intersect(turf.featureCollection([a, b]), {
    properties: { name: `${a.properties.name} ∩ ${b.properties.name}`, code: `${a.properties.code}-${b.properties.code}` },
  });
  return result as Feature<Polygon | MultiPolygon, RegionProps> | null;
}
```

The cast is genuinely necessary here — Turf's signature returns the widened type and there's no way to recover it without one.

## Strict null checks: handle `undefined` from `buffer`

```typescript
function safeBuffer(
  f: Feature<Geometry>,
  radius: number,
): Feature<Polygon | MultiPolygon> {
  const out = turf.buffer(f, radius, { units: "meters" });
  if (!out) {
    throw new Error("buffer collapsed the geometry");
  }
  // `out` could still be a FeatureCollection — narrow further if needed
  if (out.type === "FeatureCollection") {
    throw new Error("buffer returned a collection; expected single feature");
  }
  return out;
}
```

## A typed pipeline helper (preserves properties)

Common need: thread a feature through a series of Turf ops while keeping its property type. This wrapper does that:

```typescript
import type { Feature, Geometry, GeoJsonProperties } from "geojson";

interface Pipeline<G extends Geometry, P extends GeoJsonProperties> {
  readonly value: Feature<G, P>;
  map<G2 extends Geometry>(
    fn: (f: Feature<G, P>) => Feature<G2, GeoJsonProperties>,
  ): Pipeline<G2, P>;
  unwrap(): Feature<G, P>;
}

function pipeline<G extends Geometry, P extends GeoJsonProperties>(
  feature: Feature<G, P>,
): Pipeline<G, P> {
  return {
    value: feature,
    map<G2 extends Geometry>(
      fn: (f: Feature<G, P>) => Feature<G2, GeoJsonProperties>,
    ): Pipeline<G2, P> {
      const next = fn(this.value);
      // Carry the original properties through
      return pipeline({ ...next, properties: this.value.properties } as Feature<G2, P>);
    },
    unwrap() {
      return this.value;
    },
  };
}

// Use:
const final = pipeline(route)
  .map((f) => turf.simplify(f, { tolerance: 0.001, highQuality: true }))
  .map((f) => turf.buffer(f, 500, { units: "meters" })! as Feature<Polygon | MultiPolygon>)
  .unwrap();
//    ^? Feature<Polygon | MultiPolygon, RouteProperties>
```

This is the **builder pattern** in disguise — each `map` returns a new pipeline you can chain. If you need a more elaborate builder (units defaults, error policies, etc.) wrap it in a class with a fluent interface.

## `Units` and `AreaUnits` — use the imported enum type, not strings

```typescript
import type { Units, AreaUnits } from "@turf/helpers";

interface BufferConfig {
  radius: number;
  units: Units; // "meters" | "kilometers" | ...
}

function configuredBuffer(
  f: Feature<Geometry>,
  { radius, units }: BufferConfig,
): Feature<Polygon | MultiPolygon> | undefined {
  const out = turf.buffer(f, radius, { units });
  if (out?.type === "Feature") return out;
  return undefined;
}
```

You can't import `Units` from `geojson` — it's a Turf concept. It IS exported by `@turf/helpers` and `@turf/turf`.

## `as const` for coordinate literals

```typescript
// `coords` is `number[]` by default — too wide for Position
const coords = [-122.4, 37.8];

// `as const` narrows to a tuple
const coords = [-122.4, 37.8] as const satisfies Position;
```

Or just construct via a helper, which is already strongly typed:

```typescript
const p = turf.point([-122.4, 37.8]); // safe
```

## Strict mode and `properties` defaults

Turf helpers default `properties` to `{}`. Under `strict: true` with `noImplicitAny`, that's fine — but if you've typed properties as a strict interface with required fields, the default empty `{}` won't satisfy it. Either:

- Always pass `properties` explicitly when constructing
- Or type properties as `Partial<MyProps>` at construction time and validate later
