# Playbook: tracing async JavaScript (the event loop)

Read this before tracing anything with `async`/`await`, promises, `.then()` chains, `setTimeout`/`setInterval`, callbacks, or any "why did these log in *that* order?" question. Async JS breaks the assumption traces rely on most — that lines run in the order they're written — because the event loop quietly reorders the back half of your code. Without this model you'll write a trace that reads top-to-bottom and is simply wrong about *when* things happen.

This playbook *extends* the four universal traps in the SKILL. Mental model first, then async-JS's flavor of each trap, then phrasing, then a worked trace.

## The mental model you must trace against

JavaScript runs on **one thread with an event loop**. The rule that drives every async trace:

1. **All synchronous code in the current run finishes first**, top of the call stack to empty. Nothing async interrupts it.
2. Then the engine **drains the entire microtask queue** — promise callbacks (`.then`/`.catch`/`finally`), the continuation after every `await`, `queueMicrotask`. Microtasks can queue more microtasks; *all* of them run before step 3.
3. Then it runs **one macrotask** — a `setTimeout`/`setInterval` callback, an I/O callback, a message/event. After that one macrotask, it goes back to step 2 (drain microtasks again), and the browser may paint between them.

So the order is always: **sync → microtasks → (one macrotask → microtasks) → repeat.** A `setTimeout(fn, 0)` does *not* run "right away" — it waits behind all current sync code and all microtasks.

The other half of the model: **`await` splits a function in two.** Everything before the `await` runs synchronously now; everything *after* it is packaged as a microtask continuation that runs only once the awaited promise settles. So an `async` function does not run start-to-finish in one go — narrate it as "runs to the first `await`, hands control back, resumes later."

## Async-JS's flavor of the four traps

- **🔀 Forks**
  - **`await` vs no `await`** — does this line pause the function, or fire-and-forget and keep going? This is the biggest fork in any async trace.
  - **Serial vs parallel** — `await a(); await b();` runs them one after another; `await Promise.all([a(), b()])` starts both at once. Same result, very different timeline.
  - **`await` inside a loop** serializes every iteration — often the difference between fast and painfully slow.
  - **Rejection path** — a rejected promise jumps to the nearest `.catch()` or the `catch` around an `await`; with neither, it becomes an *unhandled rejection*.

- **⚠️ Side effects**
  - **The `Promise` executor runs synchronously and immediately.** `new Promise((resolve) => { sideEffect(); resolve() })` — `sideEffect()` happens *now*, during sync execution, not later. Easy to misplace in a trace.
  - **State read across an `await` may have changed.** Between the `await` and its continuation, other tasks ran. A value you captured before the await can be stale, and shared state can be mutated underneath you — JS's version of a race condition.
  - **Microtask starvation** — an unbroken chain of microtasks (e.g. a recursive `.then`) blocks timers *and* rendering, because step 3 never gets a turn.

- **⏳ Async handoffs** (the whole point)
  - `await` / `.then` → **microtask** (runs after current sync, before any timer).
  - `setTimeout`/`setInterval`/I/O → **macrotask** (runs after all pending microtasks).
  - A `.then` on an **already-resolved** promise *still* defers to a microtask — code physically after it runs first.
  - Make explicit, at each async point, whether the function **pauses and resumes later** or **fires and forgets**.

- **🤫 Silent stuff**
  - **Forgotten `await`** — the call returns a pending `Promise`, the code barrels on, and the "result" is a Promise object, not the value. Often looks like `undefined` showed up from nowhere.
  - **`array.forEach(async ...)`** — `forEach` ignores the returned promises, so nothing is awaited; all callbacks fire and the surrounding code doesn't wait. Use `for...of` + `await`, or `Promise.all(array.map(...))`.
  - **Swallowed rejections** — no `.catch`, no surrounding try/catch → unhandled rejection (can crash Node, silently warns in browsers).
  - **`async` function with no caller awaiting it** — fire-and-forget; if it throws, the error escapes the place you'd expect to catch it.

## How to phrase an async step (right vs wrong)

> ❌ *Wrong:* "It calls `setTimeout(cb, 0)`, waits 0 ms, runs `cb`, then continues to the next line."
> *(The next line — and every microtask — runs* before *`cb`. The 0 ms is a floor, not a turn-taking signal.)*

> ✅ *Right:* "It schedules `cb` as a macrotask via `setTimeout(..., 0)` (`app.ts:9`) — `cb` won't run until the current sync code finishes *and* the microtask queue is empty, so the lines below it run first even though they're written after."

> ❌ *Wrong:* "`loadUser()` fetches the user, then the next line uses `user.name`."

> ✅ *Right:* "`loadUser()` returns a pending promise immediately (`api.ts:4`); because the caller doesn't `await` it (`:18`), the next line runs with `user` still undefined. ⏳ The fetch resolves later, on a microtask, long after that line already ran — this is the bug."

## A worked example (top-down, dev-savvy)

The canonical ordering puzzle — trace it as event-loop beats, not as written lines:

```js
console.log('1');                                  // line A
setTimeout(() => console.log('2'), 0);             // line B
Promise.resolve().then(() => console.log('3'));    // line C
console.log('4');                                  // line D
```

1. **Sync run begins** — line A logs `1`. The call stack is doing its one uninterrupted pass.
2. **Line B schedules a macrotask** — `() => log('2')` goes into the *macrotask* queue. ⏳ Nothing runs yet; we keep going.
3. **Line C schedules a microtask** — `.then` on an already-resolved promise still defers; `() => log('3')` goes into the *microtask* queue. ⏳ Still nothing runs.
4. **Line D logs `4`** — sync code continues straight past the async lines. Sync run now ends.
5. **Drain microtasks** — the queue holds the line-C callback; it runs and logs `3`. Microtask queue empties. 🔀 This happens *before* any timer.
6. **Run one macrotask** — now the line-B callback runs and logs `2`.

**Final order: `1`, `4`, `3`, `2`.** The two `console.log`s that were written *between* the schedulers ran first; the promise (microtask) beat the timer (macrotask). That's the entire model in four lines.

> **Where the duck would squint:** if anything relied on `2` or `3` having already happened by line D, it'd be reading values that don't exist yet. And swap `Promise.resolve().then` for an `await` and the "rest of the function" becomes that same microtask — same deferral, same trap.

## Node / Bun note

Same micro/macrotask model, with extras: in Node, **`process.nextTick` callbacks run before other microtasks**, and `setImmediate` is a distinct macrotask phase (the libuv loop has ordered phases: timers → poll → check). Bun and Deno follow the standard microtask/macrotask ordering with minor engine-specific differences. If the trace is Node-specific, note where `nextTick`/`setImmediate` sit relative to promises; otherwise the browser model above is enough.
