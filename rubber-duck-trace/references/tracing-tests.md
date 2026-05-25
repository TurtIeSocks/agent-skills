# Tracing tests — what does this test actually verify

Tests are code, but the *story* they tell is different from production code. A test isn't trying to compute something useful; it's trying to *demonstrate a claim about a behavior*. A trace of a test answers a question that's easy to skip past in review: **if this test passes, what did we just prove — and what did we miss?**

Use this playbook when:

- A reviewer asks "what does this actually cover?"
- A test fails and the author can't explain what was being asserted.
- You're documenting test intent for a less-tested area.
- A test passes for the wrong reasons (false positive) and you want to expose it.
- You suspect a test is *tautological* — checking that a value the test itself just assigned equals itself.

The main SKILL's workflow still holds — honesty rule, anchors, execution order, the four traps. This file changes two things: you treat the test's natural shape (`setup → action → assertion`) as the spine, and you replace (or supplement) the "where the duck would squint" section with **"what this test would *not* catch."** That's where the review value lives.

## Mental model — a test as a three-act story

| Phase | Question | What you narrate |
|---|---|---|
| **Setup** | "What world is being built so the action can run?" | What's mocked, what's real, what state is being injected, what's deliberately left default. |
| **Action** | "What single behavior is being exercised?" | The *one* call (or interaction) the test is about. If there are several, the test is doing too much — say so. |
| **Assertion** | "What claim is being staked, and what would falsify it?" | The exact comparison + the kind of bug it would catch (or miss). |

A test that passes proves *something*, but not always what the author thought. The trace makes the claim explicit so a reader can judge whether the test is load-bearing.

## The four traps — for tests specifically

- **🔀 Forks** — does the test cover one branch and silently miss the others? Are there `if`s *inside* the test itself? (A smell — usually means two tests glued into one.)
- **⚠️ Side effects** — does setup mutate shared state another test later depends on? Does teardown actually undo it? A test that "works in isolation but fails in the suite" almost always lives here.
- **⏳ Async handoffs** — is the assertion *after* the awaited result, or is it racing? A missing `await` before an `expect` is the single most common cause of false-positive JS tests; the assertion runs on the unresolved promise, which is truthy, so it always passes.
- **🤫 Silent stuff** — assertions that always pass (`expect(x).toBeDefined()` on a value the test itself just constructed), swallowed errors in the test body (`try { ... } catch {}`), mocks that match anything (`expect.anything()` when the test should have pinned a specific value).

## The fifth lens — the falsification test

This is the move that turns a tour into a review. For each assertion, ask:

> **What change in production code would make this test fail?**

- If the answer is "I can't think of one" or "only the literal opposite of the line just above the assertion" → the test is tautological. Flag it.
- If the answer is a sharp behavior boundary ("any change to the cache invalidation logic," "any code path that skips the audit log") → the test is load-bearing. Say so explicitly; that's information the next reviewer needs.

The falsification test is the test's *negative space*. A test you can't falsify isn't a test, it's a re-assertion.

## Output shape

Use the main SKILL's documentation or explanation shape, but structure the walkthrough by the three acts and end with **"What this test would *not* catch."**

```markdown
## The walkthrough

### Setup
1. **It mocks `<thing>` to return `<value>`** — `test.ts:NN` — <what world this builds, and what's deliberately *not* mocked>.
2. **It seeds `<state>`** — `test.ts:NN` — <...>.

### Action
3. **It calls `<the SUT>` with `<args>`** — `test.ts:NN` — <the one behavior under test>.

### Assertion
4. **It checks `<value> === <expected>`** — `test.ts:NN` — <the staked claim, in plain language>.

## What this test would *not* catch
- <a specific failure mode the assertion would miss — e.g. "returns the right value but caches the wrong key">
- <a code change that should fail it but wouldn't — e.g. "if `getUser` started mutating the input, this would still pass because `toEqual` is structural">
- <if the test is load-bearing, say so: "any change to the cache invalidation logic would fail this — it's a real guardrail">
```

## Right vs wrong framing

> ❌ *Wrong:* "This test calls `getUser(1)` and checks the result equals what we expect."
> *(Reports the syntax, not the claim. A reader gets the same info from reading the test itself in less time.)*

> ✅ *Right:* "Setup: an in-memory user with id `1` is inserted. Action: `getUser(1)` is called once. Assertion: the result is `toEqual` (structural, not reference) the inserted user. The claim being staked: `getUser` round-trips through the cache without mutating or replacing the object. **Would not catch:** a regression where the cache returns a *different* object that happens to be structurally equal — `toEqual` accepts that. To catch identity-preservation, the assertion would need `toBe`."

The wrong version describes what the test *does*. The right version describes what the test *proves* (and what it doesn't). That's why a trace of a test is worth writing.
