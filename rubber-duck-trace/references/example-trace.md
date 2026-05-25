# Worked example

This is the quality bar. It traces what happens when a GitHub webhook hits a small Hono server and gets dispatched to a background agent. It's written in the **dev-savvy** voice. After the full trace, there's a short side-by-side showing how the *opening step alone* reads in each of the three voices — use that to calibrate before you write.

The point of including a full example: notice that every step has an anchor, the order follows execution (not file layout), the forks and side effects are called out only where they matter, and the "squint" section finds a real, specific risk rather than hand-waving.

---

# 🦆 Trace: what happens when a GitHub webhook arrives

**In one sentence:** GitHub POSTs an event to our server; we check it's genuinely from GitHub, figure out which agent should handle it, kick that agent off in the background, and immediately tell GitHub "got it" so it doesn't retry.

> **Traced:** `POST /webhook` → `202` response · **Voice:** Dev-savvy · **Direction:** Top-down · **Files:** `src/server.ts`, `src/dispatch.ts`, `src/agents/runner.ts`

## The walkthrough

1. **It starts when Hono receives the POST** — `src/server.ts:18`
   The route `app.post('/webhook', ...)` is the front door. Hono hands our handler the raw request. Nothing has been validated yet — at this moment the body is just bytes we don't trust.

2. **It reads the raw body as text, not JSON** — `src/server.ts:21`
   `await req.text()` instead of `req.json()`. This matters: the signature in step 3 is computed over the *exact* raw bytes, so parsing to JSON first (which can reorder or reformat) would make the check fail. ⏳ This `await` is the first pause — the handler waits for the full body to arrive.

3. **It verifies the request actually came from GitHub** — `src/server.ts:31`
   It computes an HMAC-SHA256 — basically a fingerprint of the body signed with a secret only we and GitHub know — and compares it to the `X-Hub-Signature-256` header using a timing-safe compare (`crypto.timingSafeEqual`). 🔀 If they don't match, it returns `401` here and the story ends — no agent runs. If they match, the body is trusted from this point on.

4. **Now it parses the JSON** — `src/server.ts:38`
   Only after trust is established does it `JSON.parse` the body. The `X-GitHub-Event` header (e.g. `issues`, `pull_request`) plus the payload's `action` field (`opened`, `closed`) are what decide who handles this.

5. **It picks an agent based on event + action** — `src/dispatch.ts:12`
   `route(event, action)` is a lookup: `issues/opened` → the PM agent, `pull_request/opened` → the QA agent, and so on. 🔀 If nothing matches, it returns `null`, and back in the handler that becomes a `204 No Content` — "valid request, nothing for us to do." This is the silent-success path; see the squint section.

6. **It starts the agent without waiting for it** — `src/server.ts:44`
   `runAgent(agent, payload)` is called *without* `await`. ⏳ This is fire-and-forget on purpose — the agent loop can run for minutes, but GitHub will retry the whole webhook if we don't respond in ~10 seconds. ⚠️ Side effect: this spawns a long-running background task that outlives the request.

7. **It immediately responds `202 Accepted`** — `src/server.ts:46`
   `202` means "accepted, still processing." GitHub sees a fast success and won't retry. The HTTP story ends here — but the *agent's* story is just beginning in the background.

8. **Finally, in the background, the agent loop runs** — `src/agents/runner.ts:9`
   Detached from the request, `runAgent` enters its tool-calling loop (read repo, propose changes, etc.) until it finishes or hits `MAX_TOOL_ROUNDS`. ⚠️ Anything that throws in here happens *after* we already told GitHub `202`, so failures are invisible to GitHub entirely.

## Where the duck would squint 🦆

- **`src/server.ts:44`** — `runAgent` is fired without `await` and nothing catches its errors. If the agent throws, the request already returned `202`, so the failure vanishes — no GitHub retry, no obvious log unless `runAgent` logs its own crashes. This is the highest-risk line in the trace.
- **`src/dispatch.ts:12`** — an unmatched event returns `204` (success). That's reasonable, but it means a *typo'd or renamed* event silently does nothing and looks healthy. Worth a debug log so "why didn't my agent run?" is answerable.
- **`src/server.ts:38`** — `JSON.parse` isn't wrapped in a try/catch. A malformed-but-correctly-signed body (unlikely from GitHub, but not impossible) would throw a 500 instead of a clean error.

## So the whole point is…

The server's real job in the foreground is tiny and fast: prove the request is really from GitHub, decide who should handle it, light the fuse on a background agent, and say "thanks, got it" before GitHub gets impatient. All the actual work happens *after* the response, in a detached task — which is great for responsiveness but means anything that goes wrong in the agent is invisible from GitHub's side. If an agent ever "didn't run," steps 5 and 6 are where to look first.

---

## The same opening step in all three voices

This is step 1 above, rewritten for each voice level. Same fact, same anchor — different reader.

**🟢 Full ELI5**
> It all kicks off when a message from GitHub knocks on our server's door — specifically the door labeled `/webhook` (`src/server.ts:18`). At this point we've only heard the knock; we haven't checked who's really out there or read what they brought. So we treat it like a stranger until we've checked their ID.

**🔵 Dev-savvy plain language**
> It starts when Hono receives the POST at `app.post('/webhook', ...)` (`src/server.ts:18`) and hands our handler the raw request. Nothing's validated yet — the body is just untrusted bytes at this moment.

**⚫ Match the code's complexity**
> Entry is the `/webhook` POST handler (`src/server.ts:18`). The request is unvalidated on arrival; the body must be read raw (not as parsed JSON) so the HMAC in the next step is computed over the exact bytes GitHub signed.

Notice none of them lie or add steps — they just dial the vocabulary and hand-holding up or down. Pick the voice the user chose and keep it consistent for the whole trace.

---

## The same trace, but bottom-up

The full trace above is **top-down**: it starts at the front door and meets each piece as the request reaches it. If the user picks **bottom-up** instead, you define the building blocks first, then assemble. Same facts, same anchors, same honesty — only the *order the reader meets things* changes. The opening would look like this:

> ## The building blocks
>
> The pieces the webhook flow leans on, defined before we wire them together:
>
> - **`verifySignature(body, header)`** (`src/server.ts:31`) — recomputes an HMAC-SHA256 fingerprint of the raw body using our shared secret and compares it (timing-safe) to the header GitHub sent. Returns true only if the request genuinely came from GitHub.
> - **`route(event, action)`** (`src/dispatch.ts:12`) — a lookup that maps a `(event, action)` pair like `issues/opened` to the agent that should handle it, or `null` if nothing matches.
> - **`runAgent(agent, payload)`** (`src/agents/runner.ts:9`) — the long-running tool-calling loop; given an agent and a payload, it does the actual work until it finishes or hits `MAX_TOOL_ROUNDS`.
>
> ## The walkthrough
>
> Now that we know the parts, here's how a request wires them together:
>
> 1. **It starts when Hono receives the POST** (`src/server.ts:18`) and reads the raw body...
> 2. **It calls `verifySignature`** (the check we defined above) — if it fails, `401` and we're done...
> 3. *...(continues in execution order, now referring to the blocks by name instead of diving into each one)...*

The walkthrough is *still* in execution order — bottom-up doesn't run the program backwards. It just front-loads the definitions so the assembly reads as a clean story instead of constantly pausing to explain a helper mid-sentence. Reach for it when the helpers are the unfamiliar part; reach for top-down when the *flow* is what the reader cares about.

---

## The same trace, succinct density

When the user signals "tl;dr / briefly / give me the gist" (or chose voice 3 in chat and the flow is short), collapse the same trace to one line per step. Same facts, same anchors, same honesty rule — just the connective prose between facts is gone. The webhook trace above, in succinct form:

> # 🦆 Trace: GitHub webhook arrival
>
> **In one sentence:** verify it's really from GitHub, decide who handles it, kick off the agent in the background, return `202` before GitHub retries.
>
> > **Traced:** `POST /webhook` → `202` · **Voice:** Dev-savvy · **Direction:** Top-down · **Density:** Succinct · **Files:** `src/server.ts`, `src/dispatch.ts`, `src/agents/runner.ts`
>
> ## The walkthrough
>
> 1. **Receives POST** — `src/server.ts:18` — raw, untrusted at this point.
> 2. **Reads body as text, not JSON** — `src/server.ts:21` — HMAC in step 3 needs exact bytes. ⏳ first await.
> 3. **Verifies HMAC** — `src/server.ts:31` — body fingerprint vs `X-Hub-Signature-256`, timing-safe. 🔀 mismatch → 401, story ends.
> 4. **Parses JSON** — `src/server.ts:38` — only after trust; `X-GitHub-Event` + payload `action` drive routing.
> 5. **Picks agent** — `src/dispatch.ts:12` — static lookup. 🔀 no match → `204` (silent-success path, see squint).
> 6. **Fires agent, no await** — `src/server.ts:44` — ⏳ detached; ⚠️ outlives the request.
> 7. **Returns `202` immediately** — `src/server.ts:46` — GitHub stops waiting; agent runs in background.
> 8. **Agent loop runs detached** — `src/agents/runner.ts:9` — ⚠️ anything thrown here is invisible to GitHub.
>
> ## Where the duck would squint 🦆
> - **`src/server.ts:44`** — fire-and-forget with no error catch; agent crashes vanish.
> - **`src/dispatch.ts:12`** — unmatched event = silent `204`; typos look healthy.
> - **`src/server.ts:38`** — `JSON.parse` uncaught → 500 on malformed but correctly-signed body.
>
> ## So the whole point is…
> Foreground: prove it's GitHub, route, light the fuse, say `202`. Background: the agent does the actual work — and any failure in there never reaches GitHub. If an agent "didn't run," check steps 5–6 first.

Notice what survived and what didn't. Every anchor is still there. Every fork, every async handoff, every silent-success path that earned a mention in the full version is still mentioned — just in one clause instead of three. The recap shrank from a paragraph to two sentences. **Step 6 is the test case for whether succinct works:** the full version spent three sentences explaining *why* `runAgent` is unawaited and what side effect that creates; the succinct version compresses to `⏳ detached; ⚠️ outlives the request` and trusts the reader to know what that means. That trust is what voice 3 + senior reader + succinct lets you do. At voice 1 (ELI5) the same compression would be opaque — which is why density and voice interact.

---

## A confidently wrong trace (anti-example)

Same target — the GitHub webhook flow — but written by someone who skimmed the code and pattern-matched against "what servers usually do" instead of reading it. Every step *sounds* plausible. Every step is wrong in a way a reader can't catch from the prose alone. Read this side-by-side with the good trace above to feel where the honesty rule and the anchor receipts actually earn their keep.

> # Trace: what happens when a GitHub webhook arrives (bad version)
>
> 1. **It receives the POST and validates the request** — `src/server.ts:18`
>    Hono receives the request, parses the body, and validates the user's permissions before passing it to the handler.
>    *(Wrong on three counts: the body is read **before** the signature check, not after; there's no "user" on this path — webhooks are authenticated by HMAC, not by user role; and "validates the request" is a generic phrase that hides where the actual check is. A reader who trusts this will look for permission code that doesn't exist.)*
>
> 2. **It looks up the right agent in the database** — `src/dispatch.ts:12`
>    The router queries the agent table by event type and returns the matching agent's config.
>    *(Wrong: `route()` is a static lookup, not a DB query. Inventing a DB call is exactly the kind of plausible-but-fictional step the honesty rule exists to prevent — the trace is now claiming a network round-trip and a possible failure mode that don't exist.)*
>
> 3. **It runs the agent and waits for it to finish** — `src/server.ts:44`
>    The handler awaits the agent's completion and returns its result to GitHub.
>    *(Wrong, and dangerously so: it's deliberately **not** awaited — that's the entire design. A trace that gets this wrong sends a debugger looking for a bug that isn't there, and hides the real risk that **is** there.)*
>
> 4. **It returns the result to GitHub** — `src/server.ts:46`
>    The handler responds with the agent's output.
>    *(Wrong: it responds `202 Accepted` immediately. The agent's output never reaches GitHub at all — it lives only in our own logs.)*

**Why this is worse than no trace at all.** Each step sounds like a reasonable thing a server *might* do. None of them are anchored to code that actually does what's claimed — the line numbers are real but the narration isn't grounded in what those lines say. A reader who trusts this walks away with three load-bearing wrong beliefs: that the request is parsed before signature verification (a security model misunderstanding), that the dispatcher hits the database (a fictional dependency), and that the agent's response reaches GitHub (a fictional contract). And the *real* surprise of the system — fire-and-forget background work whose errors vanish into the void — is hidden.

**A confident wrong trace is worse than no trace, because it sends the reader looking in the wrong place.** This is what the honesty rule and the anchor receipts protect against. If you can't find the code for a step, the fix isn't to invent something plausible — it's to say "from here it hands off to `<thing>`, which I haven't traced" and stop.

How to catch yourself writing this:

- If you can't point at the line that does what the step claims, the step is fiction. Delete or downgrade.
- If a step *summarizes* code you didn't read ("it validates the request" with no anchor narrating the actual check), that's a tell — you're paraphrasing your *expectation* of the code, not the code.
- Run `scripts/validate-anchors.py --refresh <trace.md>` on your draft. It prints the actual line at each anchor; mismatches between your narration and the printed line jump out fast.

