# Function index (alphabetical)

Flat lookup: function name → category → npm micro-package. Useful when you know the function name and just need the import.

All functions live on the `turf` namespace if you `import * as turf from "@turf/turf"`. Each is also published as `@turf/<name-in-kebab-case>` — e.g. `nearestPointOnLine` → `@turf/nearest-point-on-line`. The package column shows the exact micro-package name when it differs from a simple kebab-case of the function (or when the function name already contains a noun phrase that's preserved).

| Function | Category | Micro-package |
|---|---|---|
| `along` | Measurement | `@turf/along` |
| `angle` | Other | `@turf/angle` |
| `area` | Measurement | `@turf/area` |
| `azimuthToBearing` | Unit Conversion | `@turf/helpers` |
| `bbox` | Measurement | `@turf/bbox` |
| `bboxClip` | Transformation | `@turf/bbox-clip` |
| `bboxPolygon` | Measurement | `@turf/bbox-polygon` |
| `bearing` | Measurement | `@turf/bearing` |
| `bearingToAzimuth` | Unit Conversion | `@turf/helpers` |
| `bezierSpline` | Transformation | `@turf/bezier-spline` |
| `booleanClockwise` | Booleans | `@turf/boolean-clockwise` |
| `booleanConcave` | Booleans | `@turf/boolean-concave` |
| `booleanContains` | Booleans | `@turf/boolean-contains` |
| `booleanCrosses` | Booleans | `@turf/boolean-crosses` |
| `booleanDisjoint` | Booleans | `@turf/boolean-disjoint` |
| `booleanEqual` | Booleans | `@turf/boolean-equal` |
| `booleanIntersects` | Booleans | `@turf/boolean-intersects` |
| `booleanOverlap` | Booleans | `@turf/boolean-overlap` |
| `booleanParallel` | Booleans | `@turf/boolean-parallel` |
| `booleanPointInPolygon` | Booleans | `@turf/boolean-point-in-polygon` |
| `booleanPointOnLine` | Booleans | `@turf/boolean-point-on-line` |
| `booleanTouches` | Booleans | `@turf/boolean-touches` |
| `booleanValid` | Other | `@turf/boolean-valid` |
| `booleanWithin` | Booleans | `@turf/boolean-within` |
| `buffer` | Transformation | `@turf/buffer` |
| `center` | Measurement | `@turf/center` |
| `centerMean` | Other | `@turf/center-mean` |
| `centerMedian` | Other | `@turf/center-median` |
| `centerOfMass` | Measurement | `@turf/center-of-mass` |
| `centroid` | Measurement | `@turf/centroid` |
| `circle` | Transformation | `@turf/circle` |
| `cleanCoords` | Coordinate Mutation | `@turf/clean-coords` |
| `clone` | Transformation | `@turf/clone` |
| `clusterEach` | Meta | `@turf/clusters` |
| `clusterReduce` | Meta | `@turf/clusters` |
| `clustersDbscan` | Aggregation | `@turf/clusters-dbscan` |
| `clustersKmeans` | Aggregation | `@turf/clusters-kmeans` |
| `collect` | Aggregation | `@turf/collect` |
| `collectionOf` | Assertions | `@turf/invariant` |
| `combine` | Feature Conversion | `@turf/combine` |
| `concave` | Transformation | `@turf/concave` |
| `containsNumber` | Assertions | `@turf/invariant` |
| `convertArea` | Unit Conversion | `@turf/helpers` |
| `convertLength` | Unit Conversion | `@turf/helpers` |
| `convex` | Transformation | `@turf/convex` |
| `coordAll` | Meta | `@turf/meta` |
| `coordEach` | Meta | `@turf/meta` |
| `coordReduce` | Meta | `@turf/meta` |
| `degreesToRadians` | Unit Conversion | `@turf/helpers` |
| `destination` | Measurement | `@turf/destination` |
| `difference` | Transformation | `@turf/difference` |
| `directionalMean` | Other | `@turf/directional-mean` |
| `dissolve` | Transformation | `@turf/dissolve` |
| `distance` | Measurement | `@turf/distance` |
| `distanceWeight` | Other | `@turf/distance-weight` |
| `ellipse` | Other | `@turf/ellipse` |
| `envelope` | Measurement | `@turf/envelope` |
| `explode` | Feature Conversion | `@turf/explode` |
| `feature` | Helpers | `@turf/helpers` |
| `featureCollection` | Helpers | `@turf/helpers` |
| `featureEach` | Meta | `@turf/meta` |
| `featureOf` | Assertions | `@turf/invariant` |
| `featureReduce` | Meta | `@turf/meta` |
| `findPoint` | Other | `@turf/meta` |
| `findSegment` | Other | `@turf/meta` |
| `flatten` | Feature Conversion | `@turf/flatten` |
| `flattenEach` | Meta | `@turf/meta` |
| `flattenReduce` | Meta | `@turf/meta` |
| `flip` | Coordinate Mutation | `@turf/flip` |
| `geojsonType` | Assertions | `@turf/invariant` |
| `geomEach` | Meta | `@turf/meta` |
| `geomReduce` | Meta | `@turf/meta` |
| `geometry` | Other | `@turf/helpers` |
| `geometryCollection` | Helpers | `@turf/helpers` |
| `getCluster` | Meta | `@turf/clusters` |
| `getCoord` | Meta | `@turf/invariant` |
| `getCoords` | Meta | `@turf/invariant` |
| `getGeom` | Meta | `@turf/invariant` |
| `getType` | Meta | `@turf/invariant` |
| `greatCircle` | Measurement | `@turf/great-circle` |
| `hexGrid` | Grids | `@turf/hex-grid` |
| `interpolate` | Interpolation | `@turf/interpolate` |
| `intersect` | Transformation | `@turf/intersect` |
| `isNumber` | Other | `@turf/helpers` |
| `isObject` | Other | `@turf/helpers` |
| `isobands` | Interpolation | `@turf/isobands` |
| `isolines` | Interpolation | `@turf/isolines` |
| `kinks` | Misc | `@turf/kinks` |
| `length` | Measurement | `@turf/length` |
| `lengthToDegrees` | Unit Conversion | `@turf/helpers` |
| `lengthToRadians` | Unit Conversion | `@turf/helpers` |
| `lineArc` | Misc | `@turf/line-arc` |
| `lineChunk` | Misc | `@turf/line-chunk` |
| `lineEach` | Other | `@turf/meta` |
| `lineIntersect` | Misc | `@turf/line-intersect` |
| `lineOffset` | Transformation | `@turf/line-offset` |
| `lineOverlap` | Misc | `@turf/line-overlap` |
| `lineReduce` | Other | `@turf/meta` |
| `lineSegment` | Misc | `@turf/line-segment` |
| `lineSlice` | Misc | `@turf/line-slice` |
| `lineSliceAlong` | Misc | `@turf/line-slice-along` |
| `lineSplit` | Misc | `@turf/line-split` |
| `lineString` | Helpers | `@turf/helpers` |
| `lineStrings` | Other | `@turf/helpers` |
| `lineToPolygon` | Feature Conversion | `@turf/line-to-polygon` |
| `mask` | Misc | `@turf/mask` |
| `midpoint` | Measurement | `@turf/midpoint` |
| `moranIndex` | Other | `@turf/moran-index` |
| `multiLineString` | Helpers | `@turf/helpers` |
| `multiPoint` | Helpers | `@turf/helpers` |
| `multiPolygon` | Helpers | `@turf/helpers` |
| `nearestNeighborAnalysis` | Other | `@turf/nearest-neighbor-analysis` |
| `nearestPoint` | Classification | `@turf/nearest-point` |
| `nearestPointOnLine` | Misc | `@turf/nearest-point-on-line` |
| `nearestPointToLine` | Other | `@turf/nearest-point-to-line` |
| `pNormDistance` | Other | `@turf/p-norm-distance` |
| `planepoint` | Interpolation | `@turf/planepoint` |
| `point` | Helpers | `@turf/helpers` |
| `pointGrid` | Grids | `@turf/point-grid` |
| `pointOnFeature` | Measurement | `@turf/point-on-feature` |
| `pointToLineDistance` | Measurement | `@turf/point-to-line-distance` |
| `pointToPolygonDistance` | Measurement | `@turf/point-to-polygon-distance` |
| `points` | Other | `@turf/helpers` |
| `pointsWithinPolygon` | Joins | `@turf/points-within-polygon` |
| `polygon` | Helpers | `@turf/helpers` |
| `polygonSmooth` | Transformation | `@turf/polygon-smooth` |
| `polygonTangents` | Measurement | `@turf/polygon-tangents` |
| `polygonToLine` | Feature Conversion | `@turf/polygon-to-line` |
| `polygonize` | Feature Conversion | `@turf/polygonize` |
| `polygons` | Other | `@turf/helpers` |
| `propEach` | Meta | `@turf/meta` |
| `propReduce` | Meta | `@turf/meta` |
| `quadratAnalysis` | Other | `@turf/quadrat-analysis` |
| `radiansToDegrees` | Unit Conversion | `@turf/helpers` |
| `radiansToLength` | Unit Conversion | `@turf/helpers` |
| `randomLineString` | Random | `@turf/random` |
| `randomPoint` | Random | `@turf/random` |
| `randomPolygon` | Random | `@turf/random` |
| `randomPosition` | Random | `@turf/random` |
| `rbush` | Other | `@turf/geojson-rbush` |
| `rectangleGrid` | Other | `@turf/rectangle-grid` |
| `rewind` | Coordinate Mutation | `@turf/rewind` |
| `rhumbBearing` | Measurement | `@turf/rhumb-bearing` |
| `rhumbDestination` | Measurement | `@turf/rhumb-destination` |
| `rhumbDistance` | Measurement | `@turf/rhumb-distance` |
| `round` | Coordinate Mutation | `@turf/helpers` |
| `sample` | Data | `@turf/sample` |
| `sector` | Misc | `@turf/sector` |
| `segmentEach` | Meta | `@turf/meta` |
| `segmentReduce` | Meta | `@turf/meta` |
| `shortestPath` | Misc | `@turf/shortest-path` |
| `simplify` | Transformation | `@turf/simplify` |
| `square` | Measurement | `@turf/square` |
| `squareGrid` | Grids | `@turf/square-grid` |
| `standardDeviationalEllipse` | Other | `@turf/standard-deviational-ellipse` |
| `tag` | Joins | `@turf/tag` |
| `tesselate` | Transformation | `@turf/tesselate` |
| `tin` | Interpolation | `@turf/tin` |
| `toMercator` | Unit Conversion | `@turf/projection` |
| `toWgs84` | Unit Conversion | `@turf/projection` |
| `transformRotate` | Transformation | `@turf/transform-rotate` |
| `transformScale` | Transformation | `@turf/transform-scale` |
| `transformTranslate` | Transformation | `@turf/transform-translate` |
| `triangleGrid` | Grids | `@turf/triangle-grid` |
| `truncate` | Coordinate Mutation | `@turf/truncate` |
| `union` | Transformation | `@turf/union` |
| `unkinkPolygon` | Misc | `@turf/unkink-polygon` |
| `voronoi` | Transformation | `@turf/voronoi` |

## Notes on micro-packages

Several functions share an underlying package because they live in the same source file in the monorepo:

- **`@turf/helpers`** — all geometry constructors, unit conversion math, and basic predicates. This is the single largest gathering of named exports.
- **`@turf/invariant`** — type-introspection (`getType`, `getCoord`, `getCoords`, `getGeom`) and the `*Of` assertions.
- **`@turf/meta`** — every iteration helper (`coordEach`, `featureEach`, `flattenEach`, `segmentEach`, etc.).
- **`@turf/clusters`** — cluster iteration helpers (`clusterEach`, `clusterReduce`, `getCluster`).
- **`@turf/projection`** — Mercator round-tripping.
- **`@turf/random`** — all `random*` generators.

So if you're cherry-picking individual packages and your code uses `coordEach` + `getCoord` + `featureEach`, you actually need only `@turf/meta` + `@turf/invariant`, not three separate installs.
