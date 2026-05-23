# Worked example

This is the quality bar. It traces what happens when a GitHub webhook hits a small Hono server and gets dispatched to a background agent. It's written in the **dev-savvy** voice. After the full trace, there's a short side-by-side showing how the *opening step alone* reads in each of the three voices — use that to calibrate before you write.

The point of including a full example: notice that every step has an anchor, the order follows execution (not file layout), the forks and side effects are called out only where they matter, and the "squint" section finds a real, specific risk rather than hand-waving.

---

# 🦆 Trace: what happens when a GitHub webhook arrives

**In one sentence:** GitHub POSTs an event to our server; we check it's genuinely from GitHub, figure out which agent should handle it, kick that agent off in the background, and immediately tell GitHub "got it" so it doesn't retry.

> **Traced:** `POST /webhook` → `202` response · **Voice:** Dev-savvy · **Files:** `src/server.ts`, `src/dispatch.ts`, `src/agents/runner.ts`

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
