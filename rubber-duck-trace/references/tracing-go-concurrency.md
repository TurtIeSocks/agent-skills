# Playbook: tracing Go goroutines

Read this before tracing anything with `go`, channels (`<-`), `select`, `sync.WaitGroup`/`Mutex`, or `context` cancellation. Go concurrency breaks the trace assumption that there's *one* timeline: a `go` statement splits execution into goroutines that the runtime schedules across real threads, so "what happens when X" usually means narrating several timelines and the points where they meet.

This playbook *extends* the four universal traps in the SKILL. Mental model first, then Go's flavor of each trap, then phrasing, then a worked trace.

## The mental model you must trace against

Goroutines are cheap green threads multiplexed onto OS threads by the Go scheduler. Unlike JS's single thread, goroutines can run **truly in parallel** (up to `GOMAXPROCS` cores), and their interleaving is **non-deterministic** — never trace a specific order unless something *synchronizes* it.

The load-bearing facts:

- **`go f()` launches `f` on a new goroutine and returns immediately.** The launching goroutine does *not* wait. After this line you have two timelines running concurrently.
- **Channels are how goroutines hand off and synchronize.** An *unbuffered* channel send blocks until a receiver is ready (and vice versa) — a rendezvous where two goroutines meet. A *buffered* channel send blocks only when the buffer is full.
- **A blocked goroutine parks; the scheduler runs others.** Blocking one goroutine doesn't freeze the program — but if *every* goroutine is blocked, the runtime panics: `fatal error: all goroutines are asleep - deadlock!`
- **`main` returning kills every other goroutine, instantly.** Outstanding work just stops.

So a trace identifies, at each step: which goroutine am I on, where does it block, and what unblocks it.

## Go's flavor of the four traps

- **🔀 Forks**
  - **`go f()`** is the literal fork — execution splits into a new concurrent timeline.
  - **`select`** chooses among channel ops that are *ready*; if several are ready it picks one at random, and with no `default` it blocks until one is. Which case fires is the fork.
  - **Buffering & direction** decide whether a send/receive proceeds or parks.
  - **`ctx.Done()` / cancellation** flips goroutines onto their shutdown path.

- **⚠️ Side effects / shared state**
  - **Data races** — two goroutines touching the same variable with no mutex/channel guarding it. Flag any unsynchronized shared access; it's the bug the `-race` detector exists to catch.
  - **Concurrent map writes panic** outright. Concurrent slice growth corrupts silently.
  - **Closing a channel is a broadcast** (all receivers get the zero value + "closed"). Closing twice, or sending on a closed channel, **panics**.

- **⏳ Async handoffs (blocking & synchronization)**
  - Unbuffered `ch <- x` / `<-ch` is a **rendezvous**: the two goroutines meet and control effectively hands off there. Whichever arrives first parks and waits for the other.
  - `wg.Wait()` parks until the `WaitGroup` counter hits zero; `mu.Lock()` parks until the mutex is free; `time.Sleep` parks this goroutine only.
  - Narrate *where* each goroutine parks and *who* is responsible for waking it.

- **🤫 Silent stuff**
  - **Goroutine leaks** — a goroutine blocked forever on a channel nobody will ever send to (or receive from). It never exits and leaks memory; the runtime won't warn because *other* goroutines are still alive. This is the most common Go concurrency bug.
  - **`main` exits before goroutines finish** — expected output never appears because the program ended first.
  - **Loop-variable capture (pre-Go 1.22):** `for _, v := range xs { go func(){ use(v) }() }` — every goroutine closes over the *same* `v`. Fixed in Go 1.22 (per-iteration variable); note which version applies.
  - **`wg.Add` called inside the goroutine** instead of before `go` → `Wait` can return before the work is even registered.

## How to phrase a Go step (right vs wrong)

> ❌ *Wrong:* "It calls `go process(item)`, processes the item, then continues the loop."
> *(The launching goroutine doesn't process anything or wait — it moves on instantly.)*

> ✅ *Right:* "`go process(item)` (`worker.go:21`) launches `process` on a new goroutine and returns immediately; the loop keeps spawning. The `process` calls run concurrently, in no guaranteed order relative to the loop or each other."

> ❌ *Wrong:* "It sends `result` on the channel, the receiver gets it, then both continue."

> ✅ *Right:* "It sends on the *unbuffered* channel `results` (`worker.go:24`) — this goroutine ⏳ parks here until some other goroutine is ready to receive. The send and the matching `<-results` are a rendezvous; neither proceeds until both have arrived."

## A worked example (top-down, dev-savvy)

```go
func main() {
    ch := make(chan string)        // unbuffered
    go func() {                    // worker goroutine
        ch <- "done"               // (A)
    }()
    msg := <-ch                    // (B)
    fmt.Println(msg)
}
```

1. **On the main goroutine**, `make(chan string)` creates an *unbuffered* channel — no slots, so any send must meet a receiver.
2. **`go func(){...}` launches the worker** (`main.go:3`) and main continues *immediately* — two timelines now.
3. **Whichever reaches the channel first parks.** If the worker hits `(A)` first, it ⏳ blocks (no receiver yet). If main hits `(B)` first, *it* blocks. Order between them is not guaranteed — and it doesn't matter.
4. **The rendezvous happens** — when both `(A)` and `(B)` are pending, the runtime pairs them: `"done"` is handed from worker to main, and *both* goroutines unpark. 🔀 This meeting is the synchronization point.
5. **Main prints `done`** and returns; the program exits.

> **Where the duck would squint:** if main *didn't* receive (say it returned right after `go`), the worker would block forever on `(A)` — a goroutine leak — and `"done"` would never be handled. And if the worker were slow and main exited first, the program would end with the worker mid-flight, output lost.

Keep the questions front-of-mind for every step: *which goroutine, where does it block, who unblocks it.*
