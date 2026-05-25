# Debugging mode — the rubber duck, pointed at a bug

You're here because the user picked **debugging**, or their request was clearly "why does X happen / this should do Y but does Z / where's the bug." Rubber ducking finds bugs precisely because narrating what the code *actually* does, step by step, exposes the spot where reality stops matching what the author intended. Debugging mode makes that explicit: you trace **toward a known symptom** and rank where the divergence most likely is.

**Related skill:** `superpowers:systematic-debugging` is the general hypothesis → cheap-confirm → ranked-suspects framework, untied to control-flow shape. Reach for *that* when you don't yet have a path to walk (intermittent failures with no stack trace, multi-system bugs, environmental issues). Reach for *this* when you do — when there's a function or request lifecycle to narrate toward the symptom. The two are complementary; nothing here contradicts that skill, this is its trace-shaped specialization.

Everything in the main SKILL still holds — the honesty rule, the anchors, execution order, the four traps, the domain playbooks. This file changes three things: you **interview for the symptom first**, you **walk with a suspect lens**, and you **end with a ranked diagnosis instead of a flat recap**.

## Step A — Get the symptom before tracing anything

Unless the user already gave it, ask — briefly, in one short message (not a long form):

- **What did you expect to happen?**
- **What actually happened?** — exact error text, the wrong value, a hang, a crash, or simply nothing.
- **Anything that narrows it?** — a stack trace, which input triggers it, whether it's intermittent, what changed recently.

Don't start tracing until you have *expected vs actual*. Without it you're just writing documentation with extra steps — you need the target to aim at. If they pasted a stack trace, start from the frame it points at and work outward.

## Step B — Walk it toward the symptom

Trace **top-down**, following the path that actually leads to the reported behavior (bottom-up is rarely useful when hunting a bug). Run the usual four traps, but at every step add a fifth question: **could this step produce the symptom?** Tag each step in your head as one of:

- ✅ **consistent** — behaves as expected, not the culprit (but might pass bad data downstream),
- 🚫 **ruled out** — can't be involved in this symptom,
- 🔎 **suspect** — could plausibly cause the divergence.

The bug is usually the **first place** where what the code does diverges from what the user expected — find that point, don't just list every risky line.

## Step C — Name the prime suspect as a causal chain

End with a *ranked* diagnosis, phrased as the chain from cause to symptom — this is the "first it does X, then at step 3's `if` it does this, which makes step 4 do X instead of Y" shape the whole skill is built around:

> "Steps 1–2 run as expected. **Prime suspect: step 3** (`file.ts:NN`) — if `<value>` is `<unexpected>` here (which happens when `<condition>`), the `if` takes the *else* branch, so step 4 does `<X>` instead of `<Y>` — which is exactly the `<symptom>` you're seeing."

Then rank the rest: *second most likely*, *less likely*. If the traced path looks genuinely correct, **say so** and point outward — the bug is probably in the input, in state set earlier, in the environment, or in a *different* code path than the one you assumed runs. Honesty matters more here than anywhere: a confident wrong diagnosis costs the user hours down the wrong hole. State what would change your mind.

## Step D — Give a cheap way to confirm

Don't stop at a hypothesis — hand the user the smallest experiment that proves or kills it:

> "Log `<value>` right before `file.ts:NN`. If it's `<x>`, that confirms the suspect. If it's `<y>`, skip to the second suspect."

Prefer a check that **bisects** the suspects (rules out half at once) over a random `console.log`. A breakpoint, one log line, or a unit test pinning the suspect's inputs are all good. This is the part that turns a trace into progress.

## Output shape (inline by default — no file unless they ask)

```markdown
**Symptom:** <what they expected> → <what actually happens>

## The trace (toward the symptom)
1. **It starts at `<entry>`** — `file.ts:NN` — <narrative>. ✅ consistent.
2. **Then `<step>`** — `file.ts:NN` — <narrative>. ✅ consistent.
3. **Then `<step>`** — `file.ts:NN` — <narrative>. 🔎 **suspect** — <why this could cause it>.
4. **Then `<step>`** — `file.ts:NN` — <the wrong outcome that follows from step 3>.

## Prime suspect
<the causal chain from the suspect step to the symptom>. Then: second-most-likely, less-likely.

## How to confirm
<the cheapest check that proves or kills the top suspect, and what each result means>
```

## Hypothesis framing — right vs wrong

> ❌ *Wrong:* "The bug is on line 42."
> *(Flat and unconditional. States a guess as fact; if it's wrong the user wastes an hour, and it skips the chain that makes it checkable.)*

> ✅ *Right:* "Most likely it's `userService.ts:25`: a failed DB lookup gets caught and the resulting `null` is cached, and because `cache.has(id)` then treats that as a hit, every later call returns `null` without re-querying. That matches 'the user exists but reads as missing.' Confirm by logging `cache.get(id)` right before the early return — if it's `null` for a user you know exists, that's it."

## A worked debugging example

**Symptom:** "After I create a user, `getUser(id)` keeps returning `null` even though the row is definitely in the database."

Tracing `getUser` (the cache-then-DB lookup) toward that symptom:

1. **`getUser(id)` checks `cache.has(id)`** — `userService.ts:12` — 🔎 **suspect**. `has` is true even when the stored value is `null`, so a cached "miss" short-circuits here and returns `null` *without ever touching the DB*.
2. **On a real miss it queries the DB** — `userService.ts:16` — ✅ would find the row… *if we got here*. The suspect in step 1 may stop us from ever reaching this.
3. **A failed/empty query leaves `user = null`** and the `catch` swallows any error — `userService.ts:21` — 🔎 contributes: this is *how* a `null` gets created to be cached.
4. **It caches whatever it got, including `null`** — `userService.ts:25` — 🔎 **suspect**. This freezes the `null` in the cache.

**Prime suspect:** steps 4 + 1 together. If `getUser` was called *before* the user existed (or during a transient DB hiccup), step 4 cached `null` for that id; every later call hits step 1, sees a cached entry, and returns `null` — so the user reads as missing forever even after the row exists. That's an exact match for the symptom.
**Less likely:** the row isn't actually committed when you think (a transaction not yet flushed) — but you said it's definitely there, so this ranks lower.
**How to confirm:** log `cache.get(id)` right before `userService.ts:13`. If it returns `null` for an id you know exists, the cache is poisoned — calling `invalidate(id)` (or not caching `null`s) will fix it. If the id isn't in the cache at all, the bug is elsewhere and the DB query in step 2 is the next place to look.

Keep the three moves front-of-mind: *interview for the symptom, walk toward it tagging suspects, end with a ranked chain and a cheap confirm.*
