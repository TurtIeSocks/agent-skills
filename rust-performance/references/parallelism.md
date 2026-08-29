# Parallelism: after the single-thread work is lean

Parallelize last. Rayon on top of a wasteful loop burns every core doing the waste faster, and Amdahl caps the win at the parallel fraction. Fix algorithm/allocations/layout first, then split.

## Data parallelism: rayon

```rust
use rayon::prelude::*;
let total: u64 = items.par_iter().map(expensive).sum();
```

- **Work per item must dwarf scheduling cost** (rough floor: ~1μs of real work per item, or batch with `with_min_len` / `par_chunks`). Parallelizing `x * 2` per element is a slowdown.
- Prefer `map` + `reduce`/`fold` shapes over locking a shared accumulator — rayon's whole model is "no shared mutable state per item".
- `par_sort_unstable` / `par_extend` exist; check for a `par_` version before hand-rolling.
- Chunked map-reduce (each worker builds a local `HashMap`, merge at the end) beats all-threads-into-one-`DashMap` for aggregation.

## Contention: the usual killer

Threads don't scale because they queue on shared state. Smells and ladders:

| Smell | Fix, in order |
|---|---|
| All threads locking one `Arc<Mutex<T>>` | Shrink critical section → shard (`Vec<Mutex<Shard>>` by key hash, or `dashmap`) → thread-local accumulate + merge |
| Read-mostly shared data | `RwLock`, or better `arc-swap` / plain `Arc` snapshot replacement — readers never block |
| Shared counters/flags | `AtomicU64` with `Ordering::Relaxed` (counters need no ordering); still contended? per-thread counters, sum on read |
| Lock held across I/O or `.await` | Restructure so the lock covers only the memory touch (async.md for the await case) |
| Perfect parallel code, still slow | **False sharing**: two threads' data on one cache line ping-ponging. Pad with `crossbeam_utils::CachePadded`. `perf c2c` (Linux) finds it. |

Mutex vs channel is architecture, not perf dogma: message passing (`crossbeam-channel`, `flume`, std mpsc) shines for pipelines and ownership handoff; a well-shrunk mutex is fine for a small shared map. Measure the design you can maintain.

## Threads: the checklist

- Spawning is ~100μs-scale: fine per connection, absurd per item. Pool (rayon's, or a job queue) for small units.
- Oversubscription (more busy threads than cores — e.g. rayon inside rayon, or two pools) thrashes; keep one pool authoritative, size it with `available_parallelism()`.
- Pin down *which* resource saturates: all cores busy = CPU-bound, parallelism is done, go back down the leverage order; cores idle while wall-clock is long = blocking/contention, see above and async.md.
