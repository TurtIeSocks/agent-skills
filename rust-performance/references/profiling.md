# Profiling: locate before you fix

Goal: replace "I think the time goes here" with a measurement. Pick the tool by the question you're asking.

## Tool by question

| Question | Tool | Notes |
|---|---|---|
| Where does CPU time go? | `samply` (Mac/Linux/Win) or `cargo flamegraph` | Sampling profilers; near-zero setup. `samply record ./target/release/app` opens the Firefox Profiler UI. |
| Where does CPU time go? (Linux, deeper) | `perf record` + `perf report` | Raw events, kernel frames, per-thread views. |
| Where does CPU time go? (macOS, deeper) | Instruments (Time Profiler) or `samply` | `cargo instruments` helps launch. |
| Is this whole program faster now? | `hyperfine 'old' 'new'` | Statistical CLI comparison with warmup; the end-to-end baseline for the loop. |
| Who allocates, how much, how often? | `dhat-rs` (in-process) or `heaptrack` (Linux) | Allocation count matters as much as bytes; a million 16-byte allocs is a hot-path smell. |
| Cache misses? Branch misses? IPC? | `perf stat -d ./app` | Low IPC + high cache-miss rate → open data-layout. High branch-miss → look at branchy hot loops. |
| Deterministic instruction counts for CI | `iai-callgrind` | Immune to noisy runners; catches regressions criterion's variance would hide. |
| What is my async runtime doing? | `tokio-console` | Long poll times = blocking in async; see the async reference. |
| Why is the binary huge / compile slow? | `cargo bloat`, `cargo llvm-lines` | Monomorphization bloat; see dispatch-and-inlining. |

## Make release profiles debuggable

Sampling a release binary without symbols gives you a flamegraph of hex addresses. Fix once in `Cargo.toml`:

```toml
[profile.release]
debug = "line-tables-only"   # symbols + line numbers, negligible runtime cost

# or keep release pristine and add a dedicated profile:
[profile.profiling]
inherits = "release"
debug = true
```

Then `cargo build --profile profiling`. On Linux, cleaner stacks: `RUSTFLAGS="-C force-frame-pointers=yes"`.

## Reading a flamegraph

- **Width = total time.** Wide frames matter; tall stacks are just deep call chains.
- Look for wide frames you didn't expect: `memcpy`, `malloc`/`free`, `drop_in_place`, hashing (`SipHasher13`), `clone`. Each maps to a reference in this skill (memcpy → data-layout, malloc → allocations, hashing → collections-and-hashing).
- A flat profile with no wide frame usually means death-by-a-thousand-cuts allocation or cache misses; confirm with `dhat`/`perf stat` instead of staring harder.

## Profile honestly

- **Realistic data, realistic size.** Small inputs fit in cache and hide the real distribution; "fast locally, slow in prod" is usually this. Profile the prod-shaped case.
- **Profile the release build** (with the tuned `[profile.release]` from build-config). Debug profiles point at the wrong frames.
- **One variable at a time.** Change, re-measure, then next change. Two changes at once and a regression in one hides inside the win of the other.
- If the profile surprises you, believe the profile.
