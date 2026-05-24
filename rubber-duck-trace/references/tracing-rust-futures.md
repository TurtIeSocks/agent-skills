# Playbook: tracing Rust futures (async/await)

Read this before tracing anything with `async fn`, `.await`, `tokio::spawn`, `join!`/`select!`, or any executor (`tokio`, `async-std`, `smol`). Rust async breaks a trace assumption that even other async languages keep: calling an `async fn` runs **none** of its body. A trace that says "it calls `fetch()`, which fetches" is wrong before it starts — so the model below matters more here than anywhere else.

This playbook *extends* the four universal traps in the SKILL. Mental model first, then Rust's flavor of each trap, then phrasing, then a worked trace.

## The mental model you must trace against

A Rust future is **lazy and inert**. An `async fn` compiles to a state machine; *calling* it just **constructs** that state machine and does nothing else. No work happens until something **drives** it — i.e. `.await`s it, or hands it to an executor via `spawn`/`block_on`. The slogan: **futures do nothing unless polled.**

The load-bearing facts:

- **Construction ≠ execution.** `let f = work();` runs none of `work`'s body. Side effects, prints, network calls — all wait until `f` is driven.
- **`.await` drives the future to its next suspension point.** If the future isn't ready, `.await` yields control back to the executor (returns `Poll::Pending`), letting other tasks run; the executor re-polls it later when a *waker* signals readiness. Between `.await` points, code runs uninterrupted on that task.
- **An executor/runtime must exist.** `#[tokio::main]`, `block_on`, or `tokio::spawn` is what actually polls futures. No runtime → nothing runs, full stop.
- **Dropping a future cancels it.** Its work simply stops at the last suspension point; code after that `.await` never runs. (This is "cancellation safety," and it's how `select!` and timeouts abandon the losing future.)

So a trace identifies, at each step: is this future actually being *driven* yet, where are its `.await` suspension points, and what happens if it's dropped.

## Rust's flavor of the four traps

- **🔀 Forks**
  - **Awaited vs not** — the single biggest fork. An un-awaited, un-spawned future is a no-op (compiles with a warning, does nothing).
  - **Sequential vs concurrent vs parallel** — `a().await; b().await;` is serial; `join!(a(), b())` polls both concurrently on *one* task; `tokio::spawn` puts them on the runtime's task pool, which on a multi-threaded runtime can be truly parallel; `select!` *races* them.
  - **`?` after `.await`** — early-returns on an error variant.

- **⚠️ Side effects**
  - Because futures are lazy, **side effects inside an `async fn` body fire at poll time, not at call time.** Place them in the trace where the future is *driven*, never where it's constructed.
  - **Holding a `std::sync::MutexGuard` across `.await`** — the guard isn't `Send` and can deadlock the runtime; use `tokio::sync::Mutex` when a lock must span an await. Flag any lock held across a suspension point.
  - **Blocking the executor thread** — `std::thread::sleep`, heavy CPU, or sync I/O inside async stalls *every* task on that thread. Needs `spawn_blocking` or an async equivalent. (This is Rust's version of starving the loop.)

- **⏳ Async handoffs**
  - Each `.await` is a **suspension point**: poll the future; if `Pending`, yield to the executor so other tasks run; resume when woken. Name them explicitly.
  - On a multi-threaded runtime, `spawn`ed tasks may run on other threads in parallel; `join!`ed futures share one task and only interleave at their await points.
  - Wakers are the mechanism that re-schedules a task when its awaited resource is ready — mention lightly; the visible behavior is "it resumes later."

- **🤫 Silent stuff**
  - **The un-awaited future** — `do_thing();` with no `.await`/`spawn` silently does nothing (just an `unused must_use` warning). The #1 Rust async trap.
  - **Cancellation by drop** — a `select!` loser, a timed-out future, or an aborted task is *dropped*; work in flight stops at its last await and cleanup after it never runs.
  - **Lock guard across `.await`** and **blocking calls in async** (above) fail quietly until things hang.
  - **`block_on` inside an async context** can panic or deadlock.

## How to phrase a Rust step (right vs wrong)

> ❌ *Wrong:* "It calls `fetch_user()`, which starts fetching, then the next line runs."
> *(Calling it runs none of the body — Rust futures are lazy. If nothing awaits or spawns it, the fetch never happens at all.)*

> ✅ *Right:* "`fetch_user()` (`api.rs:8`) only *builds* a future — no request is sent yet. The request starts when this future is first polled, which is at the `.await` on `api.rs:20`; until then nothing in `fetch_user`'s body has run."

> ❌ *Wrong:* "`select!` runs both branches and takes whichever finishes first."

> ✅ *Right:* "`select!` (`main.rs:33`) polls both futures; the first to complete wins and the **other is dropped** — cancelled at its last `.await`, so any work it hadn't finished is abandoned. If that future was mid-write, the write doesn't complete."

## A worked example (top-down, dev-savvy)

```rust
async fn work(id: u32) -> u32 {
    println!("start {id}");
    sleep(Duration::from_millis(10)).await;   // tokio sleep
    println!("done {id}");
    id
}

#[tokio::main]
async fn main() {
    let f1 = work(1);            // (A)
    let f2 = work(2);            // (B)
    let (a, b) = join!(f1, f2);  // (C)
    println!("{a} {b}");
}
```

1. **`#[tokio::main]` starts a runtime** and `block_on`s the `main` future — now something can drive futures.
2. **`(A)` builds `f1`** — *nothing prints.* `"start 1"` is inside the body, and the body hasn't run; `work(1)` only constructed a state machine. ⚠️ The side effect is parked, not executed.
3. **`(B)` builds `f2`** — still nothing prints.
4. **`(C)` `join!` drives both concurrently** on this one task. *Now* the bodies run: both print `"start N"`, both reach the `sleep(...).await` and ⏳ yield (so they overlap rather than running back-to-back); ~10 ms later both wake, print `"done N"`, and return their `id`.
5. **It prints the two results.**

> **Where the duck would squint:** swap `(C)` for two separate statements `work(1); work(2);` with no `.await` — you'd get *two unused-future warnings and zero output*; both "fetches" silently never happen. And `f1.await; f2.await;` instead of `join!` would run them **serially** (~20 ms), not concurrently — same result, very different timeline.

Keep the questions front-of-mind for every step: *is this future being driven yet, where are its await points, and what dies if it's dropped.*
