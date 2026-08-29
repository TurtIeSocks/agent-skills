# Async performance: don't starve the executor

Scope: throughput/latency of async services. For async *correctness* patterns, use the `rust-async-patterns` skill.

## The one big bug: blocking a worker thread

Tokio's scheduler is cooperative: a worker only switches tasks at an `.await`. Any non-yielding call — `std::fs::*`, `reqwest::blocking`, a DB driver's sync API, `std::thread::sleep`, a `Mutex` held long, or a big CPU burst (decompression, serde on megabytes, crypto) — parks that worker for the duration. With only ~num_cpus workers, load makes *every* endpoint slow, not just the guilty one.

**Signature:** p99 spikes under load while unrelated cheap endpoints degrade in lockstep. **Confirm with `tokio-console`**: task polls should be micros; millis+ polls are the smoking gun.

Fixes, by the kind of work:

```rust
// Blocking I/O or CPU chunk: hand the WHOLE sequential chain to the blocking pool
let report = tokio::task::spawn_blocking(move || {
    let raw = std::fs::read(path)?;              // one hop, not three:
    let json = zstd::decode_all(&raw[..])?;      // each spawn_blocking is a
    serde_json::from_slice::<Report>(&json)      // thread handoff you pay for
}).await??;
```

- `tokio::fs` is `spawn_blocking` internally — fine for a lone read, pointless to mix with an already-wrapped chain.
- Sustained CPU pipelines: a dedicated rayon pool / worker threads + channel back to async land; `spawn_blocking`'s pool (default cap 512) is for *blocking*, not as a compute cluster.
- Bound concurrent heavy work with a `Semaphore` (~num_cpus permits for CPU work) so a burst can't thrash every core at once.
- Audit greps for regressions: `std::fs::`, `::blocking`, `std::sync::Mutex` in async code, big loops without `.await`. A long compute-ish stretch *between* awaits counts too; `tokio::task::yield_now().await` or `spawn_blocking` it.

## Throughput patterns

- **Sequential awaits in a loop is the async N+1.** Independent I/O should overlap:

```rust
use futures::stream::{self, StreamExt};
let results: Vec<_> = stream::iter(ids)
    .map(|id| fetch(id))
    .buffer_unordered(32)      // bounded concurrency: overlap without stampeding
    .collect().await;
```

`join_all`/`try_join!` for a small fixed set; `buffer_unordered` for collections (pick the bound from what the downstream tolerates, not `usize::MAX`).

- **Don't over-spawn.** `tokio::spawn` per tiny operation pays task overhead for no overlap you couldn't get with `buffer_unordered` in one task. Spawn for genuinely independent lifetimes, not as async's `for` loop.
- **Zero-copy bodies**: pass `bytes::Bytes` through instead of `Vec<u8>` clones; skip decode+re-encode round trips (serve stored JSON as raw bytes with the right content-type rather than `serde_json::Value`-and-back).
- **Cache at the edge** (`moka` for async-aware LRU): the fastest handler body is the one that doesn't run.

## Structural costs worth knowing

- Every `async fn`'s future is a struct holding all locals alive across awaits; giant futures get `memcpy`d around and can blow stack-ish budgets. `Box::pin` the rare huge one; keep big buffers out of the future (arena, pool, or allocate inside the leaf).
- `select!` loops re-poll every branch each wakeup — fine at human rates, hot at 100k events/s; consider dedicated tasks per source then a channel.
- Async trait objects (`Box<dyn Future>`, `async-trait`) allocate per call — irrelevant per request over a network hop, real in a per-item inner loop (dispatch-and-inlining.md).
