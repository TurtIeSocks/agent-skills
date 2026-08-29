# Collections and hashing

## The default hasher is deliberately slow

`std::collections::HashMap` uses SipHash: DoS-resistant, but for short keys the hashing itself often dominates hot lookups. Swapping the hasher is frequently the biggest single-line win in map-heavy code.

| Hasher | Speed | DoS resistance | Use when |
|---|---|---|---|
| SipHash (std default) | baseline | yes | unsure, or keys are attacker-controlled and you want zero thought |
| `foldhash` (hashbrown's current default) / `ahash` | 2-3x on short keys | yes (randomly seeded) | the general-purpose upgrade, including externally-influenced keys |
| `rustc-hash` (FxHash) | fastest | **none** — fixed function | keys provably internal (compiler-style workloads, interned ids) |

```rust
use std::collections::HashMap;
type FastMap<K, V> = HashMap<K, V, foldhash::fast::RandomState>;
```

**Security caveat, always state it:** anything an outside party can influence (headers, paths, user text) can be hash-flooded on a non-random hasher. `foldhash`/`ahash` keep seeding; `rustc-hash` does not. Don't trade DoS resistance for a few percent on a public-facing map.

## Map access patterns

- **Double lookup** — `get` then `insert` — is two hash+probe rounds. Use the entry API: `*counts.entry(key).or_insert(0) += 1;`
- **Entry needs an owned key up front.** For string keys where hits dominate, that allocates per call. Std escape hatch (allow `clippy::map_entry`):

```rust
match counts.get_mut(word) {              // borrowed lookup: no alloc on hit
    Some(n) => *n += 1,
    None => { counts.insert(word.to_owned(), 1); }  // alloc only for new keys
}
```

- **`entry_ref` is hashbrown, not std.** `hashbrown::HashMap::entry_ref(&borrowed)` does the above in one call, allocating only on vacancy. Depend on `hashbrown` directly if you want it; do not claim std has it.
- **Pre-size**: `with_capacity` / `with_capacity_and_hasher` trims growth rehashes. Cheap, minor, do it in passing.

## Picking the container

| Situation | Reach for |
|---|---|
| < ~50 entries, hot | `Vec<(K, V)>` + linear scan — beats hashing at small n; benchmark the crossover |
| Ordered iteration / range queries | `BTreeMap` (or sorted `Vec` + `binary_search` if built once, queried many times) |
| Insertion-order iteration + O(1) lookup | `indexmap` |
| Queue / ring | `VecDeque`, not `Vec::remove(0)` (which is O(n) per pop) |
| Membership only | `HashSet` / sorted `Vec` + `binary_search` / bitset (`fixedbitset`) for dense int keys |
| Key is a small dense integer | `Vec<Option<V>>` indexed directly — no hashing at all |

## Sorting and removal

- `sort_unstable()` over `sort()`: faster, no allocation; use stable sort only when equal-element order matters.
- Expensive key closure? `sort_by_cached_key` computes each key once instead of O(n log n) times.
- Removing many items: `retain()` (one O(n) pass) — never `remove(i)` in a loop (O(n²)). Order-irrelevant single removal: `swap_remove` (O(1)).
- Draining into another collection: `drain(..)` reuses the allocation story instead of clone-then-clear.
