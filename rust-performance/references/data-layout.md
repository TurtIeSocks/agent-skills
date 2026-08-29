# Data layout: make the cache work for you

When `perf stat` shows low IPC and high cache-miss rates, or the flamegraph is wide on `memcpy`/`drop_in_place`, the problem is the shape of the data, not the code walking it. Memory access costs dominate on modern CPUs: L1 ~4 cycles, main memory ~200+. Layout decides which one you pay.

## Know your sizes

`std::mem::size_of::<T>()` in a test, or just assert it:

```rust
const _: () = assert!(std::mem::size_of::<Event>() <= 64); // one cache line
```

Every hot type deserves a known size. Things that silently bloat:

- **Enums are as big as their largest variant.** One 200-byte variant makes every `Vec<Event>` element 200+ bytes even if 99% are the 16-byte variant. Fix: `Box` the fat variant (`clippy::large_enum_variant` flags this). Niche optimization means `Option<Box<T>>`, `Option<&T>`, `Option<NonZeroU32>` cost no extra space — lean on it.
- **`repr(Rust)` already reorders fields** to minimize padding — don't hand-order fields for packing, and don't add `#[repr(C)]` (which disables reordering) without an FFI reason. `#[repr(packed)]` is a trap: unaligned access, UB-adjacent references; measure before believing it helps.
- **`String`/`Vec` fields are 24 bytes of pointer-triple each** plus a heap hop to read the data. For many small immutable strings, `Box<str>` (16) or an interned `u32` id (allocations.md) shrinks both the struct and the pointer chasing.

## Array-of-structs vs struct-of-arrays

The default `Vec<Particle>` (AoS) drags every field through cache even when a loop reads one field. If hot loops sweep one or two fields across many elements, flip to SoA:

```rust
// AoS: position update loads velocity, mass, color, id... per element
struct Particle { pos: [f32; 3], vel: [f32; 3], mass: f32, color: u32, id: u64 }

// SoA: the position loop touches exactly the bytes it uses, and vectorizes
struct Particles { pos: Vec<[f32; 3]>, vel: Vec<[f32; 3]>, mass: Vec<f32>, /* ... */ }
```

SoA costs ergonomics (no `&Particle`), so reserve it for the hot core, not the whole codebase. `soa-rs`/`soa_derive` generate the boilerplate if it spreads.

## Pointer chasing

Every `Box`/`Rc`/`Arc` hop is a potential cache miss, and linked structures (trees of `Box`, graphs of `Rc<RefCell<_>>`) miss on every step. The Rust-native fix is **indices into a flat `Vec`**:

```rust
struct NodeId(u32);
struct Tree { nodes: Vec<Node> }        // Node stores NodeId children, not Box<Node>
```

Contiguous storage, half the pointer size, trivial serialization, and it usually dissolves the borrow-checker fights that caused the `Rc<RefCell<_>>` in the first place. Arenas (allocations.md) get the same locality when nodes must own real references.

## Iteration order

Sweep memory sequentially when you can: the prefetcher rewards linear scans and punishes strides and random hops. Classic case: 2D data in a nested loop — index `[row][col]` with `col` innermost (row-major), or the same loop runs several times slower for identical work.
