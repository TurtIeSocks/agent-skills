# Diff-trace mode — tracing what a change makes the program do differently

You're here because the user picked **diff trace**, or their request was clearly "trace this PR / walk me through what this diff changes / explain the behavior change in this commit." A normal trace narrates one execution path. A diff trace narrates the *delta* between two — pre-diff behavior and post-diff behavior — walked side by side in execution order.

Everything in the main SKILL still holds — the honesty rule, the anchors, execution order, the four traps, the domain playbooks. This file changes three things: you **read the diff first** to lock the changed-line set, the **walkthrough is paired** ("before this step did X; after, it does Y"), and the closing summary is the **behavioral delta**, not a recap of the lines that moved.

## Step A — Read the diff first, before opening a source file

Run `git diff <range>`, `gh pr diff <num>`, or the equivalent — and only then start tracing. From the diff, identify:

- **Touched files** — the set you'll be reading.
- **Functions whose *body* changed** — these become the spine of the trace.
- **Functions whose *call sites* changed but body didn't** — those are *callers* you may also need to narrate. The behavior change can live in *how* a function is used, not in the function itself.
- **Pure renames / formatting / comments / dead-code removal** — exclude. A diff trace ignores no-ops; they're noise here.

State the scope back to the user before you write the walkthrough: "this diff touches `auth.ts` and `session.ts`; the behavior change is in `validateToken` and one of its callers in `loginHandler`. I'll trace the login flow showing before-vs-after for those two." Catches scope confusion early.

If the diff is enormous, pick the *one* logical change and trace that. Offer the others as separate diff traces. A diff trace that tries to cover six unrelated changes reads like a release-notes file.

## Step B — Walk the post-diff path, pairing pre-diff at every changed step

Trace **top-down** on the *post-diff* version — that's the new behavior the reader needs to understand. (Bottom-up is rarely useful here; the goal is "what's different now," not "let's learn the building blocks.") At each step:

- If the step is **unchanged**, narrate it normally — one beat, anchor, move on. Don't skip it; the reader still needs the spine.
- If the step is **changed**, narrate the new behavior first, then add a `↔ before:` line summarizing what it used to do. Anchor both: post-diff line on the main step, pre-diff line on the `↔ before:` line (line numbers will differ, that's normal).

Watch the same four traps (forks, side effects, async handoffs, silent stuff), but add a fifth lens: **does the change introduce or close a trap?** That's the surface area new bugs sneak in through, and it's the most useful thing a diff trace surfaces.

## Step C — End with the behavioral delta, not the diff

The deliverable is "the program now behaves differently in these ways" — not "lines 12–17 changed; lines 30–34 changed." A reader can run `git diff` themselves. They came to you for *what it means*. Summarize:

- **New** — behaviors that didn't exist before.
- **Removed** — behaviors that no longer happen.
- **Same outcome, different path** — interesting because it's a *refactor risk*: anything depending on internal timing or order may be subtly affected.
- **Surface-area change** — new side effects, new awaits, new error paths, new callers, new external dependencies. This is the part future bugs will trace back to.

## Output shape (inline by default — no file unless they ask)

```markdown
**Diff trace:** `<branch or PR>` → `<base>` · **Spine:** `<changed functions>`

## The walkthrough (post-diff path, paired with pre-diff at changed steps)

1. **It starts at `<entry>`** — `file.ts:NN` — <narrative>. Unchanged.
2. **Then it `<step>`** — `file.ts:NN` — <new narrative>.
   ↔ before: `<old narrative>` (`file.ts:NN_old`). Effect on caller: <what changes downstream>.
3. **Then `<step>`** — <...>

## The behavioral delta
- **New:** <new behaviors>
- **Removed:** <removed behaviors>
- **Same outcome, different path:** <if any — usually a refactor>
- **Surface-area change:** <new side effects / awaits / error paths>

## Where the duck would squint 🦆
<as in the main format, but focused on risks the diff *introduces* — new traps,
weakened invariants, side effects the old code didn't have>
```

## When NOT to use diff trace

- The diff is pure rename / formatting / dead-code removal — there's no behavior to trace. Just say so; don't manufacture a story.
- The user wants the *full* feature behavior end-to-end, not just what changed — that's a regular trace; the diff is incidental.
- The diff touches >5 functions across unrelated paths — split into multiple diff traces, one per logical change. A single diff trace can't carry that load and stay honest.

## Right vs wrong framing

> ❌ *Wrong:* "Lines 12–17 of `auth.ts` were modified. The `if` condition now checks `>` instead of `>=`."
> *(Reports the diff, not the behavior. A reader gets the same info from `git diff` in less time.)*

> ✅ *Right:* "Before this PR, a token issued exactly at the expiry second was treated as still valid; after, it's treated as expired. That closes a one-second race where a request slipping in at expiry could refresh successfully and extend its lifetime — but it also means clients with even slightly skewed clocks (≥1s ahead) will see otherwise-valid tokens rejected. Worth checking how strict our client clock sync actually is."

The diff is the *evidence*. The trace is the *interpretation*. That's what the user can't get from `git diff` alone.
