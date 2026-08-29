---
name: rust-performance
description: Use when writing performance-sensitive Rust or diagnosing slow Rust code — "make this faster", high latency/low throughput, hot loops, excessive allocations or clones, slow HashMap lookups, benchmark setup (criterion/divan), profiling (flamegraph, perf, samply, DHAT), release-profile tuning (LTO, codegen-units, PGO), async services that stall under load, or reviewing Rust for perf smells. Triggers on cargo bench, black_box, 0ns benchmark readings, "optimization made no difference", p99 spikes, cache misses, rayon/parallelism questions, and enum/struct size concerns. Not for general Rust style (use rust-best-practices) or async correctness (use rust-async-patterns).
---

# Rust performance

Diagnose and improve Rust performance. This top-level file is a router: it holds the working loop, the leverage order, and a smell table that points into one reference per topic. Load only the reference the problem needs.

**Core principle: optimization is a measured loop, not a code edit.** The most common failure is answering "make it fast" with a rewrite and no numbers. Every change goes through: measure → locate → fix at the highest-leverage level → re-measure → keep or revert. A predicted speedup is a hypothesis, not a result.

## The loop

1. **Sanity-check the build.** Are the numbers from `--release`? Debug builds are 10-100x off and dominated by overhead your change can't touch. Check for a `[profile.release]` section; the free wins in [build-config](references/build-config.md) apply before any code change.
2. **Measure the whole thing.** One end-to-end number (`hyperfine`, a load test, a prod metric) is the baseline every later claim is judged against.
3. **Locate, don't guess.** Profile on realistic data — [profiling](references/profiling.md). If the profile surprises you, that's the profile working.
4. **Fix at the highest level of leverage that applies** (order below).
5. **Re-measure with a benchmark that can't lie** — [benchmarking](references/benchmarking.md). Keep the change only if the number moved; revert complexity that bought nothing.

## Leverage order

Work top to bottom. A win at one level routinely beats every level below it combined; skipping down to micro-optimization while an O(n²) sits above it wastes the effort.

1. **Algorithm and doing less work** — complexity class, caching, early exit, batching. No reference file: this is judgement, and the profile shows you where.
2. **Allocations** — clones, `format!`, intermediate `collect()`s in hot paths. [allocations](references/allocations.md)
3. **Data layout and collections** — struct/enum size, cache locality, hasher choice, the right container. [data-layout](references/data-layout.md), [collections-and-hashing](references/collections-and-hashing.md)
4. **Parallelism** — only after single-thread work is lean; parallel waste is still waste. [parallelism](references/parallelism.md), [async](references/async.md)
5. **Codegen** — bounds checks, inlining, dispatch, vectorization. [iterators-and-bounds](references/iterators-and-bounds.md), [dispatch-and-inlining](references/dispatch-and-inlining.md)
6. **`unsafe`** — last, rare, and only with a benchmark proving the safe version is the bottleneck.

[build-config](references/build-config.md) sits outside the order: it's free, apply it at step 1.

## Smell table

| Smell | Likely problem | Open |
|---|---|---|
| No profile exists, hotspot is a guess | Fixing the wrong thing | [profiling](references/profiling.md) |
| "Optimized but no difference", 0ns timings, `Instant` loops | Debug build, dead-code elimination, no `black_box` | [benchmarking](references/benchmarking.md) |
| Default `[profile.release]`, never tuned | Leaving LTO / codegen-units / allocator wins on the table | [build-config](references/build-config.md) |
| `.clone()` / `.to_owned()` / `to_string()` / `format!` inside a loop | Per-iteration allocation | [allocations](references/allocations.md) |
| `collect()` into a `Vec` that is immediately iterated again | Needless intermediate buffer | [allocations](references/allocations.md) |
| `Vec::push` in a loop with a knowable final size | Growth reallocations | [allocations](references/allocations.md) |
| Hot `HashMap<String, _>` on the default hasher | SipHash tax, double lookups, owned-key lookups | [collections-and-hashing](references/collections-and-hashing.md) |
| `sort()` with an expensive key closure; `remove()` in a loop | Recomputed keys; accidental O(n²) | [collections-and-hashing](references/collections-and-hashing.md) |
| Large struct or enum in a hot `Vec`; `size_of` never checked | Cache misses, memcpy traffic | [data-layout](references/data-layout.md) |
| `for i in 0..v.len()` with `v[i]` indexing in a hot loop | Bounds checks blocking vectorization | [iterators-and-bounds](references/iterators-and-bounds.md) |
| `Box<dyn Trait>` or closure call in the innermost loop | Indirect calls, no inlining | [dispatch-and-inlining](references/dispatch-and-inlining.md) |
| All threads hammering one `Arc<Mutex<_>>`; counters behind a lock | Contention, false sharing | [parallelism](references/parallelism.md) |
| `std::fs` / blocking client / heavy CPU inside `async fn`; unrelated endpoints slow together | Executor starvation | [async](references/async.md) |
| Fast locally, slow in prod | Unrealistic test data, tiny inputs, warm-cache-only measurement | [profiling](references/profiling.md) |

## Anti-patterns (do NOT)

- **Guess the hotspot.** Intuition about where time goes is wrong often enough that acting on it unmeasured is negative-value work.
- **Report a speedup you didn't measure**, or benchmark a debug build.
- **Reach for `unsafe` / `get_unchecked` early.** Safe Rust with the right algorithm and layout is almost always fast enough; unsafe is a last resort with a measured justification and a written safety argument.
- **Micro-optimize before the algorithm is right.** Vectorizing an O(n²) loop is polishing the wrong thing.
- **Parallelize as a first resort.** Rayon on top of a wasteful inner loop burns all cores doing the waste faster.
- **Scatter `#[inline(always)]`, `SmallVec`, or a faster hasher everywhere "to be safe".** Each has a cost (icache, branch on every access, DoS resistance) that only pays at measured hotspots.
- **Sacrifice API clarity for an unmeasured win.** Readability outranks a hypothetical 2%.

## When to stop

Stop when the target is met, or when the next change trades real readability for single-digit percent. "Fast enough, still readable" is the goal state, not a compromise.
