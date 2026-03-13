---
name: typescript-string-literals
description: Use when writing or reviewing TypeScript that relies on string literal unions, template literal types, key remapping, typed route/event/path strings, case-conversion utilities, or compile-time string parsing. Also use when the user mentions `as const`, `satisfies`, route params, event names, structured string autocomplete, literal widening, template-literal inference surprises, or `tsserver` slowdowns caused by union-heavy string types.
---

# TypeScript String Literal Types

Design string-heavy APIs so they stay precise, readable, and fast enough to compile without summoning despair.

## Core idea

Optimize for four things at the same time:

- Preserve literal information at the boundary.
- Model only the smallest useful string language.
- Pair type-level transforms with runtime code.
- Add escape hatches before unions or recursion get silly.

## Triage

Use this table before writing clever types:

| If the problem is... | Prefer... | Avoid... |
| --- | --- | --- |
| Closed vocabulary (`"sm" \| "md" \| "lg"`) | String literal union | Plain `string` |
| Derived naming scheme (`onClick`, `user:created`) | Template literal types + built-in string intrinsics | Hand-maintained duplicate unions |
| Object key transformation | Mapped types with `as` key remapping | Copy-paste DTO variants |
| Small parser (`/users/:id`) | Conditional types + `infer` | Regex cosplay at the type level |
| Large language (URLs, SQL, huge keyspaces) | Runtime validation + branded `string` | Massive template literal cross-products |

## Default workflow

Follow this order unless the user already committed to a narrower pattern:

1. Preserve literal inputs with `as const`, `satisfies`, or narrow generic inference.
2. Decide whether the string language is closed, generated, or runtime-validated.
3. Model the invariant with the smallest possible type tool.
4. Pair the type with a runtime helper or validation function.
5. Add a bailout for wide `string` inputs if recursion or expansion is involved.
6. Add type tests and explain the tradeoff in plain English.

## Preserve literals first

Literal widening quietly wrecks most string-literal designs.

**Before:**

```ts
const route = "/teams/:teamId";
//    ^? string
```

**After:**

```ts
const route = "/teams/:teamId" as const;
//    ^? "/teams/:teamId"
```

When building config objects, prefer preserving literals without lying about the overall shape:

```ts
interface RouteDefinition {
  path: string;
  auth: "public" | "private";
}

const route = {
  path: "/teams/:teamId",
  auth: "private",
} as const satisfies RouteDefinition;
```

If the helper owns inference, keep the callsite narrow instead of forcing callers to cast after the fact.

## Reach for the smallest useful abstraction

Start boring. Clever is cheap; maintainable clever is not.

### Closed vocabularies

Use literal unions when the valid set is small and known:

```ts
interface ButtonProps {
  size: "sm" | "md" | "lg";
  tone: "primary" | "secondary";
}
```

If the user needs extension points without destroying autocomplete, prefer a `LiteralUnion`-style pattern or library helper instead of widening the whole thing to `string`.

### Derived strings

Use template literal types when the valid strings are generated from something smaller:

```ts
type EventName = "click" | "focus" | "blur";
type HandlerName = `on${Capitalize<EventName>}`;
// "onClick" | "onFocus" | "onBlur"
```

### Key transforms

Use key remapping when the value shape stays the same but the key names change:

```ts
type SnakeToCamel<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
    : S;

type CamelKeys<T> = {
  [K in keyof T as K extends string ? SnakeToCamel<K> : K]: T[K];
};
```

## Parse only when the grammar is small

Template literals are great for bounded parsers such as route params, event suffixes, and dot-path helpers.

```ts
type TakeParam<S extends string> =
  S extends `:${infer Param}` ? Param : never;

type RouteParams<Path extends string> =
  Path extends `${infer Segment}/${infer Rest}`
    ? TakeParam<Segment> | RouteParams<Rest>
    : TakeParam<Path>;

type ParamsObject<Path extends string> = {
  [K in RouteParams<Path>]: string;
};

type TeamPathParams = ParamsObject<"/teams/:teamId/members/:memberId">;
// { teamId: string; memberId: string }
```

If the string language starts looking like a real parser, stop and move the heavy lifting to runtime validation.

## Pair the type with runtime code

Do not ship type-level magic with no runtime plan.

- If you transform names, provide the actual transform function.
- If you validate structured strings, provide a parser or validator.
- If runtime string methods would widen results to `string`, consider typed helpers such as `string-ts` or a narrow custom wrapper.

This is usually the shape you want:

```ts
interface UserRecord {
  first_name: string;
  account_status: "active" | "disabled";
}

type UserView = CamelKeys<UserRecord>;

function camelizeUser(record: UserRecord): UserView {
  return {
    firstName: record.first_name,
    accountStatus: record.account_status,
  };
}
```

The type answers "what shape is valid?" and the runtime code answers "how do we actually get there?"

## Add bailouts before the compiler revolts

Wide `string` inputs should not trigger deep recursive type gymnastics.

Use a literal guard pattern when implementing recursive transforms:

```ts
type IsStringLiteral<T extends string> = string extends T ? false : true;

type SafeWords<S extends string> =
  IsStringLiteral<S> extends true
    ? SplitWords<S>
    : string[];

type SplitWords<S extends string> =
  S extends `${infer Head}-${infer Tail}`
    ? [Head, ...SplitWords<Tail>]
    : [S];
```

That fallback is not cowardice. It is production hygiene.

## Anti-pattern radar

Call these out explicitly when you see them:

- Accidentally widening literals, then trying to recover precision later.
- Expanding giant cross-products such as `${Brand}_${Locale}_${Event}` when the unions are already large.
- Building regex-like languages out of dozens of tiny unions.
- Nesting distributive conditional types over large unions.
- Keeping giant conditional/template expressions inline instead of naming intermediate aliases.
- Using `Uppercase` or `Lowercase` for locale-sensitive behavior.
- Writing type-level transforms without runtime tests or type tests.

## Escape hatches

Prefer these exits before the codebase turns into a compiler stress test:

- Loosen the public boundary to branded `string` when the language is large.
- Generate large unions ahead of time instead of synthesizing them inside the type system.
- Use tuple wrapping (`[T] extends [U]`) when distributive conditional behavior is unwanted.
- Replace one mega-type with a few named helper aliases so the compiler can cache work.
- Bail out to `string` or `string[]` for non-literal inputs.

## What to include in your answer

When using this skill for a user request:

- Name the pattern you chose and why it fits.
- Show a small before/after example.
- Include both the runtime implementation and the type-level side.
- Mention performance risk when unions, recursion, or template cross-products are involved.
- Add or suggest type tests for positive and negative cases.
- Explain any deliberate loosening, such as falling back to `string`, in plain language.

## Load these references only when needed

- Load [`references/patterns.md`](./references/patterns.md) for example-driven implementation patterns.
- Load [`references/performance-and-tooling.md`](./references/performance-and-tooling.md) for anti-patterns, compiler heuristics, and testing/tooling guidance.
- Load [`references/source-map.md`](./references/source-map.md) when you want the primary sources behind this skill.
