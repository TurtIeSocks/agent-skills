# Dispatch, inlining, and monomorphization

## Static vs dynamic dispatch

| | Generics (`impl Trait` / `<T: Trait>`) | `dyn Trait` |
|---|---|---|
| Call | Direct, inlinable — optimizations flow through | Vtable indirection — no inlining across it |
| Cost model | One copy of the function *per concrete type* (monomorphization): code size, icache pressure, compile time | One copy total; per-call indirect branch |
| Hot inner loop | ✅ default choice | Avoid if the callee is small and hot |
| Cold/plugin/config paths, heterogeneous collections | Overkill, bloats binary | ✅ default choice |

The indirect call itself is a few cycles and often predicted; the real loss is *inlining*: a vtable call to a 3-instruction method can't fuse with the loop around it. So: monomorphize the hot core, `dyn` the cold shell. A `Vec<Box<dyn Shape>>` walked once per frame is fine; a `Box<dyn Fn>` invoked 10M times inside the pixel loop is not — take a generic closure parameter there.

Monomorphization gone wild is measurable: `cargo llvm-lines` (which generic instantiates most IR), `cargo bloat` (binary weight). Fix with the inner-`dyn` trick — a thin generic wrapper delegating to a non-generic implementation (`fn read_impl(path: &Path)` behind `fn read<P: AsRef<Path>>`) — so each instantiation is a shim, not a copy of the body.

## `#[inline]` rules of thumb

- **Within a crate: do nothing.** LLVM decides fine on its own.
- **Small non-generic functions called cross-crate**: `#[inline]` makes them inlinable without LTO (generics are already inlinable everywhere; LTO also dissolves the crate boundary — build-config.md — at which point most `#[inline]` is redundant).
- **`#[inline(always)]` is a measurement away from being a pessimization**: forced inlining bloats callers, evicts icache, and can slow the program down. Use only with a benchmark showing the win, and re-check after refactors.
- `#[cold]` / `#[inline(never)]` on error/slow paths keeps rare code out of the hot function's body — often the more useful attribute pair (see iterators-and-bounds.md on branches).

## Related codegen levers

- **Split hot from cold in the source**: a hot function that inlines a rare 200-line error formatter carries it everywhere. Factor the cold part into its own `#[cold]` fn.
- **`Result<T, Box<BigError>>`**: a fat error type rides in the return-value slot of every call; boxing it shrinks the happy path (`clippy::result_large_err`).
- **Const generics** (`fn f<const N: usize>`) turn runtime parameters into compile-time constants — loop bounds known, unrolling/vectorization unlocked — at monomorphization prices; for a handful of sizes it's the right trade.
- Closures are zero-cost *when generic* (`impl Fn`); every `Box<dyn Fn>` is an allocation plus indirect calls. Function pointers (`fn()`) sit between: no alloc, still no inlining.
