# Allocations: the default hot-path tax

Heap traffic is the most common Rust perf problem in practice: each allocation is a (possibly contended) allocator call, and short-lived allocations also churn the cache. Count them with `dhat-rs`/`heaptrack` (profiling.md); allocation *count* matters as much as bytes.

## Smells and fixes

| Smell | Fix |
|---|---|
| `.clone()` / `.to_owned()` in a loop | Borrow instead; restructure ownership so the loop reads `&T`. Clone once outside if truly needed. |
| `to_string()` / `format!` in a hot path | `write!` into a reused `String` (`std::fmt::Write`); `itoa`/`ryu` for number→string at the extreme. |
| String building with `+` or repeated `format!` | One `String::with_capacity`, then `push_str`. |
| `Vec::push` loop with knowable size | `Vec::with_capacity(n)`, or `collect()` from an exact-size iterator (sizes automatically). |
| `collect::<Vec<_>>()` mid-pipeline, then iterate again | Delete the intermediate; keep it one iterator chain. Collect only at the boundary that needs a materialized collection. |
| Fresh buffer per call/iteration | Hoist the buffer out and `clear()` + reuse it. The workhorse pattern for parsers and encoders. |
| Owned key/string only used for lookup | Look up by `&str`/borrowed form; see collections-and-hashing.md for the map-key patterns. |
| Maybe-modified string, usually untouched | `Cow<'a, str>`: borrow the common case, allocate only when actually modified. |

Buffer reuse, the shape to reach for first:

```rust
let mut buf = Vec::with_capacity(4096);
for item in items {
    buf.clear();                 // keeps capacity, frees nothing
    encode_into(item, &mut buf);
    sink.write_all(&buf)?;
}
```

## Type-level levers

- **`Box<str>` / `Arc<str>`** instead of `String` for immutable-after-build text: drops the capacity field, `Arc<str>` makes sharing a refcount bump instead of a clone.
- **`SmallVec`/`ArrayVec`/`tinyvec`** for collections that are almost always tiny: inline storage, no heap. Caveats: a branch on every access, a bigger type (watch enum sizes, data-layout.md), and a *worse* outcome if the "almost always" is wrong. Measure; don't scatter by default.
- **String interning** (`lasso`, `string-interner`, or an id-map you own) when the same strings repeat massively: compare/hash `u32` ids instead of bytes.
- **Arenas** (`bumpalo`, `typed-arena`) for build-then-drop-together object graphs (ASTs, request scratch space): allocation becomes a pointer bump, drop becomes freeing one slab.
- **serde borrow**: `#[serde(borrow)]` + `&'a str` fields deserialize by pointing into the input instead of allocating per field, when the input buffer outlives the value.

## What NOT to do

- Don't contort lifetimes to remove a cold-path clone. A clone per request is nothing; a clone per item in a million-item loop is the target. The profile says which one you have.
- Don't reach for an arena/interner before buffer reuse and `with_capacity` — the boring fixes usually clear the profile first.
- A faster global allocator (build-config.md) makes allocations cheaper; deleting them is better. Source fix first, allocator swap second.
