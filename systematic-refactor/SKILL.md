---
name: systematic-refactor
description: Use when planning a non-trivial refactor — porting to a different language, restructuring for performance, modernizing architecture, or any multi-module rewrite. Triggers on "rewrite X in Y", "refactor this codebase", "port to", "migrate from X to Y", "modernize this project", "restructure for performance", "clean up the architecture", "redesign this module". Use BEFORE invoking brainstorming or writing-plans on refactor work. Do NOT use for single-file refactors, renames, local cleanups, or bug fixes — use refactor or surgical edits for those.
---

# Systematic Refactor

## Overview

Refactors fail when coding starts before understanding. This skill front-loads cheap work: trace what exists, capture what user wants, judge what's worth keeping, map old→new. Hand resulting artifact to `brainstorming` or `writing-plans` so spec work has real foundation.

**Core principle:** A refactor without an old→new map is a rewrite gambling that new code will resemble old code's intent. The map turns that gamble into a checklist.

**Required sub-skill:** Use `rubber-duck-trace` for tracing in Phase 1. This skill adds refactor-specific framing on top.

## When to Use

**Use when:**
- User says "rewrite", "port", "migrate", "restructure", "modernize", "refactor this codebase"
- Scope spans 3+ modules or crosses a language/framework boundary
- User has refactor goals but no explicit plan
- About to invoke `brainstorming` or `writing-plans` for refactor work

**Don't use when:**
- Single-file/function refactor (use `refactor`)
- Mechanical rename (direct edits)
- Bug fix (use `systematic-debugging`)
- Greenfield project — no existing code to trace

## Workflow

5 phases. Save each output to `refactor-workspace/` in project root so user has reviewable artifacts.

```
Phase 1: Adaptive trace      → trace.md
Phase 2: Goal gathering      → goals.md
Phase 3: Good/bad assessment → assessment.md
Phase 4: Old→new map         → map.md  ← primary deliverable
Phase 5: Checkpoint + handoff
```

### Phase 1: Adaptive Trace

Pick depth based on repo size + refactor scope.

| Repo size | Suggested depth | Why |
|-----------|-----------------|-----|
| < 10k LOC | Function-level — every public symbol + 1-line behavior | Cheap, full coverage |
| 10k–100k LOC | Flow-level — top 3-5 user-facing flows, trace end-to-end | Skips dead code, focuses on what matters |
| > 100k LOC | Module-level — dirs + 1-line purpose + entry points | Function-level explodes; user picks subset for deeper trace |
| Unknown | Run `cloc` or `find . -name '*.<ext>' \| xargs wc -l`, then decide |

Recommend a depth, let user override. Invoke `rubber-duck-trace` for actual trace work. While tracing, tag refactor-relevant signals inline:

- `[HOT]` — high git churn. `git log --format=format: --name-only | sort | uniq -c | sort -rn | head -20`
- `[COMPLEX]` — high cyclomatic complexity or 200+ line functions
- `[STALE]` — no commits in 12+ months
- `[UNTESTED]` — no test file references this module
- `[TODO]` — TODO/FIXME density

Save to `refactor-workspace/trace.md`.

### Phase 2: Goal Gathering

Hybrid: quick checklist first, targeted probes on picks.

**Step 1 — Quick checklist.** Ask:
> What's driving this refactor? Pick all that apply:
> - Language/runtime change (which → which?)
> - Performance (latency? throughput? memory?)
> - Readability / maintainability
> - Testability
> - Dependency reduction
> - Architecture (monolith→services, layering, boundaries)
> - API surface change (breaking? versioned?)
> - Team handoff / onboarding
> - Other: ___

**Step 2 — Probes per pick.** Per goal, ask 1-3 targeted follow-ups. Examples:
- **Performance** → "Current bottleneck? Profiled? Target metric?"
- **Language change** → "Why this target? Libraries to replace? Interop needed?"
- **Architecture** → "Pain with current arch? Boundaries already mapped?"

**Step 3 — Constraints.** Always ask:
- Timeline?
- Breaking changes allowed?
- Team size + familiarity with target stack?
- Migration strategy: big-bang, strangler-fig, parallel-run?

Save to `refactor-workspace/goals.md`.

### Phase 3: Good/Bad Assessment

Hybrid: agent drafts verdict per module with heuristic evidence, user reviews/edits in bulk.

Per module from trace, propose:

```
### <module path>
- Verdict: Keep / Refactor in place / Rewrite / Delete / Defer
- Evidence: <heuristic tags + 1-line reason>
- Tension with goals: <how this blocks/serves a goal from Phase 2>
- Confidence: Low / Medium / High
```

**Example:**

```
### src/auth/legacy_session.py
- Verdict: Rewrite
- Evidence: [HOT][COMPLEX][UNTESTED] — 480 LOC, 23 commits in 6mo, no test file
- Tension with goals: Blocks "testability"; on perf hot path per profiling
- Confidence: High
```

Present full list as one document. Don't walk dir-by-dir — too slow. User flips verdicts in bulk.

Save to `refactor-workspace/assessment.md`.

### Phase 4: Old→New Map

**Primary deliverable.** Hybrid format: tree skeleton (new structure) + per-leaf prose note (action + why) + table fallback for 1:1 ports.

**Template:**

```markdown
# Refactor Map

## New Structure

src/
  auth/
    session.rs
      Session::create
        ← was auth/legacy_session.py:make_session
        Action: port + redesign
        Notes: return Result<Session, AuthError> instead of None-on-failure.
               Split token-issuance into separate function (currently inlined).
      Session::validate
        ← was auth/legacy_session.py:check_session
        Action: port (1:1)
    middleware.rs
      ← new module, no old equivalent
      Action: write fresh
      Notes: extract middleware logic currently scattered across handlers/*.py
  handlers/
    login.rs
      ← was handlers/login.py
      Action: port + simplify
      Notes: drop 3 retry-decorators — moved to client side per goals doc

## Bulk 1:1 Ports

| Old | New | Notes |
|-----|-----|-------|
| utils/strings.py | utils/strings.rs | direct port |
| utils/dates.py   | use chrono crate | replace whole file |

## Dropped (Not in New Codebase)

- src/legacy/v1_compat.py — no consumers (confirmed with user)
- src/debug/print_helpers.py — replaced by structured logging
```

**Per-leaf note structure:**

- `← was <old path>:<old symbol>` (or `← new module`)
- `Action:` one of — port | port + rename | port + redesign | split | merge | rewrite | drop | replace-with-lib
- `Notes:` rubber-duck-style sentence on what changes and why. Cite goal served when non-obvious.

Save to `refactor-workspace/map.md`.

### Phase 5: Checkpoint + Handoff

Show user summary:

```
Refactor workspace ready:
- trace.md       (N modules at <depth>)
- goals.md       (N goals, N constraints)
- assessment.md  (X keep, Y refactor, Z rewrite, W drop)
- map.md         (N new modules, M dropped)

Ready to hand off to brainstorming for spec? (y / n / edit map first)
```

- **y** → invoke `superpowers:brainstorming` with `refactor-workspace/` as context. Map is design substrate.
- **edit map first** → loop, user revises `map.md`, re-prompt.
- **n** → stop. `map.md` is entry point for later session.

## Quick Reference

| Phase | Output | Key decision |
|-------|--------|--------------|
| 1. Trace | `trace.md` | Depth (module/flow/function) by repo size |
| 2. Goals | `goals.md` | Checklist picks + probes + constraints |
| 3. Assessment | `assessment.md` | Bulk verdict per module, user confirms |
| 4. Map | `map.md` | Tree + per-leaf prose + bulk table |
| 5. Handoff | — | Auto-chain to brainstorming or stop |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Skip trace, jump to map | Map without trace is fiction. Trace first, even shallow. |
| Function-level trace on 100k LOC repo | Burns hours. Drop to module-level, deepen on hot subsets. |
| Goal gathering without probes | "Performance" alone is useless. Probe for metric + target + bottleneck. |
| Per-module Q&A in assessment | Too slow. Draft bulk verdict, user reviews list. |
| Map with no action notes | "← was X" alone gives no refactor signal. Always Action + Notes. |
| Auto-invoking brainstorming without checkpoint | User may want to edit map first. Always gate. |
| Treating map as immutable | Map is living doc. Brainstorming may surface issues requiring re-map. |

## Anti-Goals

This skill does NOT:

- Write the refactored code (`brainstorming` → `writing-plans` → `executing-plans` does that)
- Run tests on existing code (use `verification-before-completion`)
- Estimate effort or timelines (no signal from trace alone)
- Pick the target language/framework (user's decision; skill captures it)
