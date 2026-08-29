# Build configuration: free wins before touching code

These apply to the whole binary, cost zero code changes, and stack with everything else. Check them at step 1 of the loop — a default `[profile.release]` is the cheapest finding a perf review can make.

## The release profile

```toml
[profile.release]
lto = "thin"          # cross-crate inlining; "fat" squeezes a bit more, builds much slower
codegen-units = 1     # whole-crate optimization; slower builds, faster code
panic = "abort"       # smaller/faster if you don't need unwinding (breaks catch_unwind!)
strip = "symbols"     # smaller binary; skip if you profile this profile (see profiling.md)
```

Typical combined effect: mid single-digit to ~10-20% depending on how cross-crate-call-heavy the code is. `opt-level = 3` is already the release default; `"s"`/`"z"` trade speed for size (embedded/wasm).

Trade-offs worth saying out loud:

- `panic = "abort"` changes semantics: no unwinding, no `catch_unwind`, FFI unwind expectations break. Confirm nothing needs it.
- `lto = "fat"` + `codegen-units = 1` can multiply clean-build times several-fold. Fine for release CI, miserable for iteration; leave dev profile alone.

## CPU targeting

```bash
RUSTFLAGS="-C target-cpu=native" cargo build --release
```

Unlocks AVX2/NEON etc. for auto-vectorization. The binary now requires that CPU family — right for servers you control and local tools, wrong for distributed binaries (use `target-cpu=x86-64-v3` as a portable middle ground for modern x86 fleets).

## Alternative allocators

For allocation-heavy or multithreaded workloads, swapping the global allocator is one dependency and three lines:

```rust
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;
// or tikv_jemallocator::Jemalloc — jemalloc also brings good heap-profiling tooling
```

Wins of 5-30% on alloc-hot services are common; near zero on compute-bound code. Measure — and note that reducing allocations at the source ([allocations](allocations.md)) usually beats making them cheaper.

## Profile-guided optimization (PGO)

`cargo-pgo` automates the build-with-instrumentation → run representative workload → rebuild-with-profile cycle. Typical 5-15% on branchy real-world code. Only worth it once the code is stable and you have a representative workload to train on; BOLT (`cargo-pgo` supports it) can stack a few more percent on large binaries.

## Two Rust-project hygiene notes

- **Pin the toolchain** (`rust-toolchain.toml`). Perf comparisons across different rustc versions are not comparisons.
- **Keep dev-profile debug info lean** to stop `target/` bloat and speed iteration:

```toml
[profile.dev]
debug = "line-tables-only"
[profile.dev.package."*"]
debug = false
```
