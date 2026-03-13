# Performance And Tooling

Use this file when the request involves slow `tsc` or `tsserver`, "type instantiation is excessively deep" errors, giant unions, or a need for test/tooling guidance around string-literal-heavy TypeScript.

## Performance heuristics

These features get more expensive as you compose them:

| Pattern | Typical risk | Default stance |
| --- | --- | --- |
| Small string literal unions | Low | Safe by default |
| Built-in casing intrinsics | Low | Safe building blocks |
| Small template literal expansions | Medium | Fine when the unions are small |
| Key remapping over modest objects | Medium | Good default if keys are limited |
| Recursive parsing over literals | Medium to high | Add bailouts for wide `string` |
| Distributive conditional types over large unions | High | Refactor or constrain |
| Regex-like template grammars | Very high | Usually move to runtime |
| Huge cross-products such as `${Brand}_${Locale}_${Event}` | Very high | Generate ahead of time or loosen |

## Red flags

Treat these as signs that the design is too ambitious for the type system:

- More than a handful of unions appear inside multiple template slots.
- A recursive string parser has no bailout for wide `string`.
- A helper is trying to model full URLs, SQL, GraphQL, UUIDs, or free-form user input at the type level.
- Error messages become unreadable walls of expanded template unions.
- `tsserver` latency becomes noticeable after introducing a new utility type.

## Safer patterns

### 1. Name intermediate aliases

Do this:

```ts
type RouteParamNames<Path extends string> = RouteParams<Path>;

type RouteParamRecord<Path extends string> = {
  [K in RouteParamNames<Path>]: string;
};
```

Avoid this:

```ts
type RouteParamRecord<Path extends string> = {
  [K in (
    Path extends `${infer Segment}/${infer Rest}`
      ? TakeParam<Segment> | RouteParams<Rest>
      : TakeParam<Path>
  )]: string;
};
```

Named aliases are easier to read and usually easier for the compiler to cache.

### 2. Disable accidental distributivity

If you want to compare a whole union as a unit, wrap it:

```ts
type NonDistributiveExtends<T, U> = [T] extends [U] ? true : false;
```

This prevents the conditional from running once per union member.

### 3. Bail out for non-literal inputs

```ts
type IsStringLiteral<T extends string> = string extends T ? false : true;

type SafeKebabToWords<S extends string> =
  IsStringLiteral<S> extends true
    ? KebabToWords<S>
    : string[];
```

If the caller already has plain `string`, the compiler gains nothing from pretending it knows the exact output.

### 4. Stop generating giant languages in the type system

If the user wants something like:

```ts
type Key = `${Brand}_${Locale}_${Event}`;
```

and each union is already large, prefer one of these:

- Generate the keys ahead of time.
- Narrow only the most common prefixes and leave the tail as `string`.
- Brand validated strings instead of enumerating them.
- Move autocomplete to a runtime constant map.

## Anti-patterns

### Type-level regex cosplay

Bad fit:

- ZIP codes
- UUIDs
- URLs
- SQL fragments
- Arbitrary slug formats with many character classes

Better fit:

- Runtime regex or parser
- Branded return type after validation

### One helper to type them all

Avoid making a single utility cover every separator, every casing style, and every edge case if the app only needs one or two shapes. Smaller utilities are easier to understand and cheaper to compile.

### Runtime/type mismatch

Do not present a fancy type if the runtime function cannot actually guarantee it. The type system is not permission to lie.

## Debugging checklist

When the user reports slowdowns or confusing type errors:

1. Identify the largest unions involved.
2. Check whether template literal slots cross-multiply those unions.
3. Check for distributive conditionals over those results.
4. Add named aliases so you can inspect intermediate types.
5. Add bailouts for wide `string`.
6. Consider moving the feature boundary from compile time to runtime validation.

## Tooling

### Useful `tsconfig` and compiler flags

- `incremental`: speeds up repeated builds.
- `extendedDiagnostics`: shows where compile time is going.
- `skipLibCheck`: can reduce total type-checking cost in large projects.
- `noErrorTruncation`: makes gnarly type errors easier to inspect.

Use these as diagnostics and DX levers, not as excuses to keep a bad type design.

### Type testing

Add explicit type tests for string-literal-heavy utilities.

Good options:

- `tsd`
- `tsd-lite` or tools built on top of it

Include both:

- Positive cases that should type-check
- Negative cases that should fail

### Library selection

Use library code when it saves time and the tradeoff is clear:

- `string-ts`: useful when runtime string operations should preserve literal specificity.
- `type-fest`: useful for utilities like `LiteralUnion` and case-related helpers.
- `literal-case`: useful when the problem is specifically word-case conversion with template literal types.

Check current version requirements before pinning any of them in production code. The ecosystem shifts faster than your memory does.

## Review checklist

Before shipping advanced string-literal types, confirm:

- Literal inputs are preserved intentionally.
- The chosen abstraction matches the size of the string language.
- Runtime code exists and matches the type promises.
- Recursive helpers bail out for wide `string`.
- Large unions are factored, constrained, or generated ahead of time.
- Type tests cover both happy paths and misuse.
