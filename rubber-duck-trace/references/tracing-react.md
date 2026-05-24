# Playbook: tracing React

Read this before tracing anything involving React components, hooks, `useEffect`, `useState`, re-renders, or "why did this run twice / not run / run with the old value." React breaks the most basic assumption a trace makes — that a function runs once, top to bottom — so without this model it's easy to write a confident, wrong trace.

This playbook *extends* the four universal traps in the SKILL; it doesn't replace them. Mental model first, then React's flavor of each trap, then how to phrase the steps.

## The mental model you must trace against

A component is a function that React calls **again on every render**, not once. So "what happens when X" almost always spans *multiple* runs of the same function. The timeline for a single render is:

1. **Render** — React calls your component function. Hooks run top-to-bottom. The returned JSX is just a *description* of UI, not the actual DOM change. Render must be pure: no side effects here.
2. **Commit** — React applies the diff to the real DOM.
3. **Effects** — *after* the browser paints, React runs `useEffect` callbacks (and cleanups from the previous render). This is a separate beat from render, and that gap is where most React confusion lives.

So a trace of a React interaction is usually a **loop**: event → `setState` → re-render (function runs again) → commit → effects. Narrate it as that loop, and be explicit about *which render* you're in.

## React's flavor of the four traps

- **🔀 Forks**
  - **Dependency arrays** decide whether an effect/memo re-runs. `[count]` means "only when count changed." `[]` means "once on mount." No array means "every render." Trace which it is — it's the fork that decides whether step N happens at all.
  - **Conditional rendering** (`cond && <X/>`, early `return null`) changes which children mount/unmount.
  - **`key` changes** remount a component (fresh state), they don't just update it — a silent-looking line with big consequences.

- **⚠️ Side effects**
  - The render body must be pure, so real side effects live in **event handlers** and **effects**. If you see a fetch/subscription/DOM write in the render body, that's a bug worth flagging, not a step to narrate as normal.
  - `setState` *is* a scheduling side effect: it doesn't mutate anything now, it requests a future render (see below).
  - Refs (`useRef`) are mutable boxes that persist across renders and **don't** trigger a re-render when changed.

- **⏳ Async handoffs**
  - **`setState` is not immediate.** It schedules a re-render; the variable in the current scope keeps its old value until the *next* render. Multiple `setState`s in one handler are usually batched into one render.
  - **Effects run after paint**, not inline with render. A cleanup function runs before the next matching effect and on unmount — narrate cleanup as its own beat.
  - Data-fetching effects introduce real async: the component renders once with no data, the effect fires, and a later `setState` triggers a second render with data.

- **🤫 Silent stuff**
  - **Stale closures:** an effect or callback captures the props/state from the render it was created in. With a wrong dependency array it can keep using *old* values forever — the classic "why is count always 0 in my interval."
  - **Missing dependencies** silently freeze an effect's view of the world.
  - **StrictMode in dev double-invokes** render and effects (mount→unmount→mount) to surface impurity. Note it so a doubled log isn't mistaken for a bug.
  - **`setState` after unmount**, fire-and-forget effects with no cleanup, and effects that re-run more than the author expected are all quietly common.

## How to phrase a React step (right vs wrong)

> ❌ *Wrong:* "The handler calls `setCount(count + 1)`, so `count` is now 1, then it logs `count` which prints 1."
> *(`count` does **not** update inside the handler. The log prints the old value. This is the single most common React tracing mistake.)*

> ✅ *Right:* "The handler calls `setCount(count + 1)` (`Counter.tsx:12`) — this *schedules* a re-render; `count` in this handler's scope is still its old value, so the `console.log` right after prints the **old** number, not the new one. The new value only exists on the next render."

> ❌ *Wrong:* "On render, the effect fetches the user and sets it into state."

> ✅ *Right:* "The component renders first with `user` as `null` (`Profile.tsx:8`). ⏳ *After* paint, the `useEffect` with `[userId]` (`:14`) fires and starts the fetch. When it resolves, `setUser` schedules a second render — so this component renders at least twice, and the first paint shows the empty state."

## A tiny worked example (top-down, dev-savvy)

Tracing "what happens when you click the increment button" in a counter that also logs to the document title:

1. **First render** — `Counter.tsx:4` — `useState(0)` gives `count = 0`; the component returns a button showing `0`. The `useEffect(() => { document.title = ... }, [count])` (`:7`) is *registered* but hasn't run yet.
2. **After paint, the effect runs once** — `:7` — sets `document.title` to `Count: 0`. ⚠️ First real side effect, and it happens after the screen is already showing.
3. **You click** — `:13` — the `onClick` calls `setCount(count + 1)`. ⏳ This schedules a re-render; `count` here is still `0`. Anything after this line in the handler sees `0`, not `1`.
4. **Re-render** — `Counter.tsx:4` runs *again* — now `useState` returns `count = 1`; the button now describes `1`. 🔀 React compares `[count]` deps: `0 → 1` changed, so the effect is queued to run again.
5. **Cleanup, then effect** — `:7` — (this effect has no cleanup) the effect runs again and sets `document.title` to `Count: 1`. ⚠️ Side effect, again after paint.

> **Where the duck would squint:** if step 3's handler read `count` *after* the `setCount` expecting `1`, it'd be wrong — that's the stale-value trap. And in dev StrictMode, steps 1–2 run twice on mount, so an unguarded effect (e.g. an analytics ping) would fire twice.

Keep this loop shape — event → schedule → re-render → effects — at the center of any React trace.
