# Iterators, bounds checks, and vectorization

Idiomatic iterator code is usually the *fast* path in Rust, because it's what eliminates bounds checks and unlocks auto-vectorization. Reach for `unsafe` indexing last, not first.

## Bounds checks

Indexed access (`v[i]`) carries a per-access check unless LLVM can prove the index in range. One unproven check inside a hot loop also blocks vectorizing it. In preference order:

1. **Iterate, don't index.** `for x in &v`, `iter().map(...)`, `zip` — no indices, no checks. `a.iter().zip(&b)` proves both accesses simultaneously; `for i in 0..a.len() { a[i] + b[i] }` can't prove `b`.
2. **Hoist a slice.** One up-front slice op turns n checks into one:

```rust
let s = &data[..n];          // single check (panics here if wrong, which you want)
for i in 0..n { sum += s[i]; }   // provably in range: checks gone
```

3. **Fixed-size chunks.** `chunks_exact(8)` (or nightly `array_chunks`) gives the optimizer a compile-time-known length per block — the standard door into vectorization; handle `.remainder()` separately. Slice patterns (`if let [a, b, c, ..] = slice`) similarly prove lengths once.
4. **`get_unchecked` — last resort.** Only with a benchmark showing the check is the bottleneck after 1-3 failed, and a written safety argument for why the index is always in range. This is the smell table's "unsafe early" anti-pattern otherwise.

## Auto-vectorization

LLVM vectorizes simple loops on its own when the shape allows:

- Straight-line body, no early exit, no cross-iteration dependence, contiguous data, no bounds checks (above).
- Floats block reassociation: summing `f32`s in order is a serial dependency chain. Chunk-and-accumulate (e.g. 8 partial sums over `chunks_exact`) or use SIMD crates.
- `target-cpu` matters: without AVX2 enabled the vectorizer aims at the lowest common denominator (build-config.md).
- **Verify, don't assume**: `cargo asm my_crate::hot_fn` (cargo-show-asm) or Godbolt; look for packed instructions (`vaddps`, `vpmullw`...). If it didn't vectorize, simplify the loop body before reaching for intrinsics. `std::simd` (nightly) or the `wide` crate for explicit SIMD when auto fails.

## Iterator-chain hygiene

- **Don't `collect()` between adapters** — it materializes a Vec just to re-iterate (allocations.md). Keep the chain lazy to the sink.
- `collect()` into `Result<Vec<_>, E>` / `Option<Vec<_>>` short-circuits and pre-sizes: better than push-in-a-loop with manual error handling.
- `copied()`/`cloned()` on `&u8`-style iterators is free; on `&String` it's the clone-in-loop smell.
- `extend` beats a push loop (uses size hints); `Vec::from_iter` likewise.
- `position`/`find`/`any` short-circuit; hand-rolled flag loops often don't.
- `by_ref()` lets one pass feed two consumers without re-scanning.

## Branches in hot loops

- Move rare-case work out of the loop; a match arm that fires 0.1% of the time still costs its branch every iteration. `#[cold]` on the slow-path function tells the optimizer which side to favor.
- Branchless patterns (`(cond as u64) * x`, `max`/`min`, masks) only pay when the branch is *unpredictable* (`perf stat` branch-miss rate says); a predictable branch is ~free and clearer.
