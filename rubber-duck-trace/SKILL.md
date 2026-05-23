---
name: rubber-duck-trace
description: Document how a piece of code actually works by tracing its execution from beginning to end as a plain-language, sequential story — the "rubber duck" method ("first it does X, then Y, then Z"). The user points at a target (a function, an API/request lifecycle, a class, a CLI command, a webhook handler, a data transformation, a variable's journey, or a bug's path) and the finished trace is saved to a committable markdown file. Use this whenever the user wants to understand, explain, walk through, narrate, or document the flow / control flow / execution path of code step by step — e.g. "how does login actually work", "trace the request lifecycle", "walk me through this function", "rubber duck this for me", "document what happens when a user clicks submit", "explain this module's data flow". Trigger even when the user never says "rubber duck" or "trace" by name but is clearly asking for a step-by-step account of how something runs at runtime.
---

# Rubber Duck Trace

You are explaining a piece of code to a rubber duck. The duck knows nothing, never interrupts, and is unimpressed by jargon — so you have to say what the code *actually does*, in order, in plain words. That discipline is the whole point: narrating real execution step by step is how programmers find the gap between what they *think* the code does and what it *really* does. A good trace is documentation **and** a bug-finding tool at the same time.

The deliverable is a markdown file the user can drop into their `docs/` folder and commit.

## The one rule that matters most

**Trace what's there, not what you assume.** Every step you write must be backed by code you actually read. If you can't find where something happens, say so — never invent a plausible-sounding step to keep the story flowing. A confident, wrong trace is worse than no trace, because it sends the reader looking in the wrong place.

This is why almost every step is anchored to a real location (`path/to/file.ts:42` or a function name). The anchor is your receipt. It also makes the doc maintainable: when the code moves, the reader knows exactly what to re-check.

**Before / after — the same step:**

> ❌ *Assumed:* "Then it validates the user's permissions and rejects unauthorized requests."
> *(Did you see permission code? Or did you just expect it to be there? This is exactly the kind of step that's wrong half the time.)*

> ✅ *Grounded:* "Then it checks `req.headers['x-signature']` against an HMAC of the body (`server.ts:31`). Note: it checks the *signature*, not the user's *role* — there's no permission check on this path. The duck would squint here."

The grounded version found a real gap. That's rubber ducking working as intended.

## Workflow

### Step 0 — Get eyes on the code

You cannot trace code you haven't read. Read the entry point and follow it outward into whatever it calls. If the code isn't available to you (no repo access, no file path, nothing pasted), ask the user for the file path or the snippet before going further. Don't trace from the name of a function alone.

### Step 1 — Find the entry point and lock the scope

The user names a *target* ("how does login work"). Your job is to turn that into a concrete **start** and **stop**.

- **Start:** the first line that runs for this story (the route handler, the `main()`, the click listener, the exported function).
- **Stop:** where the story naturally ends (a value returned to the caller, a response sent, a row written, the process exiting).

State the scope back to the user in one line *before* you write the whole thing, e.g. "I'll trace from the `POST /login` handler through to the response that goes back to the browser — that covers credential check, session creation, and the redirect. Sound right?" This catches "oh, I actually only care about the token-refresh part" before you've written 400 lines.

If the target is enormous (an entire app), don't trace everything. Pick the main **happy path**, name it explicitly, and offer to trace edge paths separately. A trace that tries to cover every branch at once reads like a tax form.

### Step 2 — Pick the voice (ask the user)

The voice level changes literally every sentence you're about to write, so it's cheap to ask now and miserable to rewrite later. **Unless the user has already told you how technical to be, ask them before writing.** If you can show tappable options, offer exactly these three; otherwise ask in one line.

1. **Full ELI5** — assume the reader can't code at all. Metaphors over mechanics; every technical thing gets a plain-English stand-in. ("The server checks if the secret handshake matches before letting the message in.")
2. **Dev-savvy plain language** *(the usual default if they shrug)* — the reader codes but has never seen *this* codebase. Plain narrative sentences, but real terms are fine as long as each one is explained the first time it shows up. ("It verifies the HMAC — a fingerprint of the body signed with a shared secret — to prove the payload wasn't tampered with.")
3. **Match the code's complexity** — mirror the sophistication of the code itself, for a senior reader joining the project. Minimal hand-holding, still strictly sequential and narrative.

Whatever they pick, the *structure* below stays the same — only the wording gets simpler or denser.

### Step 3 — Walk it in execution order

Read the code and follow it the way the computer would, not the way the file is laid out. Functions defined at the bottom of a file might run first; imported helpers run in the middle of the story. Order the trace by **what happens when**, not by line number.

As you walk, watch for the four things the duck cares about most, because these are where bugs and surprises live:

- **🔀 Forks** — every `if`, `switch`, `?:`, early `return`, or `catch`. Name the condition and what each branch does. "If the cache has it, it returns immediately; otherwise it falls through to the database."
- **⚠️ Side effects** — anything that touches the outside world or shared state: DB writes, network calls, file I/O, mutating a shared object, firing an event, logging that something else depends on.
- **⏳ Async handoffs** — `await`, callbacks, promises, queues, events. Make it clear when the code *pauses and waits* versus *fires and forgets*, because that ordering is where race conditions hide.
- **🤫 Silent stuff** — swallowed errors (`catch {}`), default fallbacks, implicit type coercions, values that get quietly overwritten. These are the steps the original author forgot they wrote.

You don't need to label all four in the prose with emoji on every line — that gets noisy. Use the labels in the dedicated section (below) and mention forks/side effects inline where they're load-bearing to the story.

### Step 4 — Write the file

Save a markdown file using the structure in **Output format** below. Name it after the target: `trace-login-flow.md`, `trace-order-pipeline.md`, etc. Default location is the user's docs folder if one is obvious; otherwise put it where they're working and tell them the path.

### Step 5 — Hand it over

Save the file, then give the user a **one- or two-sentence** inline recap and the path — not a re-explanation of the whole thing. They asked for a file; the file is the deliverable. If your trace surfaced a likely bug or a genuinely surprising step, *that's* worth calling out inline ("heads up — the trace found that errors in the payment step get swallowed silently at `checkout.ts:88`").

## Output format

Use this structure. The duck emoji in the title is a light signature, not a mandate — if the user's existing docs are emoji-free or this is going into a formal repo, drop it (and the section-header emoji) and keep the same structure.

```markdown
# 🦆 Trace: <plain name of what's being traced>

**In one sentence:** <what this whole thing does, in language the chosen voice level would use>

> **Traced:** `<entry point>` → `<exit point>` · **Voice:** <ELI5 | Dev-savvy | Matched> · **Files:** `<main files touched>`

## The walkthrough

1. **It starts at `<entry>`** — `path/file.ts:NN`
   <plain narrative of the first thing that happens>

2. **Then it `<does the next thing>`** — `path/file.ts:NN`
   <narrative>. 🔀 If `<condition>`, it instead `<other path>`.

3. **Then it `<does the next thing>`** — `path/file.ts:NN`
   <narrative>. ⚠️ This writes to `<db/file/etc>` — first real side effect.

   ... (keep going, one numbered step per meaningful thing that happens) ...

N. **Finally it `<ends>`** — `path/file.ts:NN`
   <what comes out, what the caller/user/next system gets>.

## Where the duck would squint 🦆

The spots most likely to hide a bug or surprise a future reader:

- **`file.ts:NN`** — <e.g. errors here are caught and ignored; a failed write looks like success>
- **`file.ts:NN`** — <e.g. this mutates the object the caller passed in; they may not expect that>
- <only list real ones you actually found; if the code is genuinely clean, say "Nothing alarming — the path is linear and errors propagate." Don't manufacture concerns.>

## So the whole point is…

<one short paragraph, plain language, that a person could read on its own and walk away understanding the journey>
```

### Why this shape

- **The one-sentence summary** lets someone decide in three seconds whether this is the trace they need.
- **The numbered walkthrough** *is* the rubber-duck narration — "first X, then Y, then Z." Numbers (not bullets) because order is the entire point.
- **The anchors** (`file.ts:NN`) keep it honest and let readers jump to the real code.
- **"Where the duck would squint"** is the debugging payoff — it's why this is a debugging method and not just a tour.
- **"So the whole point is…"** zooms back out, because after a long walkthrough people lose the forest for the trees.

## Things that quietly wreck a trace

- **Narrating the file top-to-bottom instead of in run order.** If you catch yourself describing code in the order it's *written*, stop and re-sequence by what *executes*.
- **Skipping the boring glue.** "It maps the rows to DTOs" is a real step if it's where a field gets dropped. Boring-looking lines are where bugs hide.
- **Over-labeling.** Don't slap 🔀⚠️⏳🤫 on every line. Reserve the emphasis for steps that actually carry risk, or the signal stops meaning anything.
- **Drifting voice.** If they picked ELI5, "instantiates a singleton" is a failure even once. Re-read your draft as the chosen reader and fix any word they wouldn't know.
- **Guessing past the edge of what you read.** When the trail leaves the code you have (a third-party lib, an unread file), say "from here it hands off to `<thing>`, which I haven't traced" rather than improvising its insides.

## Worked example

See `references/example-trace.md` for a full trace (a webhook request through signature verification into an agent dispatch) written in the dev-savvy voice, plus a short side-by-side showing how the *same* opening step reads in all three voices. Read it before your first trace to calibrate the quality bar.
