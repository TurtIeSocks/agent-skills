# Benchmarking: numbers that can't lie

The classic failure: `Instant::now()` around a loop, run with `cargo run`, results meaningless. Two stacked bugs, either alone is fatal.

## The two stacked bugs

1. **Debug build.** `cargo run`/`cargo bench` without `--release` (or a custom harness built in dev profile) measures `opt-level = 0` code: no inlining, no vectorization, overflow checks everywhere. Any comparison between "old" and "new" is a comparison between two things you don't ship.
2. **Dead-code elimination.** If the result of the benchmarked call is unused and the function is pure, LLVM deletes the whole loop. Symptom: absurdly fast or literally `0ns` readings.

Fix both or the numbers are fiction:

```rust
use std::hint::black_box;

// black_box the input (stops constant-folding the argument)
// AND the output (stops deleting the unused result).
for _ in 0..1000 {
    black_box(parse(black_box(&data)));
}
```

…and build with `--release`. Also grep `Cargo.toml` for a `[profile.dev] opt-level` override: dev builds with opt-level > 0 will DCE your unhinted harness too.

## Use a harness, not a stopwatch

| Tool | Use for |
|---|---|
| **criterion** | The default. Warmup, statistical sampling, outlier detection, and `--save-baseline old` / `--baseline old` to compare implementations with a confidence interval instead of eyeballing. |
| **divan** | Lighter setup, attribute-style benches, good allocation counters. Fine default for new projects. |
| **iai-callgrind** | Instruction counts via callgrind: deterministic, so it works in noisy CI where wall-clock lies. |
| **hyperfine** | Whole-binary A/B: `hyperfine --warmup 3 './old args' './new args'`. |

Criterion comparison workflow:

```bash
git stash push -m bench-old      # or check out the old commit
cargo bench -- --save-baseline old
git stash pop
cargo bench -- --baseline old    # prints e.g. "Performance has improved [-12.3% -10.1% -7.8%]"
```

## Traps beyond the two classics

- **Tiny inputs.** A 100-element bench fits in L1 and rewards cache-hostile code; bench prod-shaped sizes (and a size sweep if the answer might depend on n).
- **Warm-cache-only measurement.** An iteration loop measures the everything-cached steady state. If prod hits cold data, the bench flatters you.
- **Benching the allocator's mood.** Order of benches can shift allocator state; criterion's sampling mostly handles it, hand-rolled loops don't.
- **Thermal throttling / turbo drift** on laptops: long runs get slower for reasons that aren't your code. iai-callgrind or a desktop/CI box for anything close.
- **Micro-benchmark ≠ production.** A 30% win on an isolated function can be 0% end-to-end if the function is 2% of runtime (Amdahl). Always close the loop with the end-to-end number from the profiling reference.
- **`black_box` is not free.** It can inhibit optimizations that would legitimately happen in real call sites. Keep the benched unit big enough that this noise is small.
