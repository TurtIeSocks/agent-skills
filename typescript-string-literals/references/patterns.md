# Patterns

Use this file when the request needs concrete implementation patterns, example code, or help choosing between multiple string-literal designs.

## 1. Closed vocabularies

Use a plain string literal union when the set is small, stable, and central to the API.

```ts
interface ToastOptions {
  tone: "info" | "success" | "warning" | "error";
  placement: "top-left" | "top-right" | "bottom-right";
}
```

Why this works:

- It catches typos immediately.
- It produces strong autocomplete.
- It stays cheap for the compiler.

### Open extension without giving up autocomplete

If callers may provide custom values, do not immediately widen the whole thing to `string`.

```ts
type BuiltInVariant = "primary" | "secondary";
type Variant = BuiltInVariant | (string & {});
```

If the project already uses `type-fest`, prefer its `LiteralUnion` helper instead of inventing a new house flavor.

## 2. Derived names

Use template literal types when the language is generated from something smaller.

```ts
type EventKey = "userCreated" | "userDeleted";
type EventTopic = `app:${EventKey}`;
type HandlerName = `on${Capitalize<EventKey>}`;
```

This is great when the valid strings follow a naming convention. It is bad when the convention expands into a giant combinatorial space.

## 3. Event payload inference

Use template literals plus indexed access when you need a typed event API.

```ts
interface FormState {
  firstName: string;
  age: number;
}

type ChangeEvent<K extends keyof FormState> = `${string & K}Changed`;

interface WatchedForm {
  on<K extends keyof FormState>(
    eventName: ChangeEvent<K>,
    handler: (value: FormState[K]) => void,
  ): void;
}
```

This pattern gives you:

- `"firstNameChanged"` only when `firstName` exists.
- The correct payload type per event name.

## 4. Route params

Use recursive matching for small route grammars.

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
```

**Before:**

```ts
buildPath("/teams/:teamId", { typo: "123" });
```

**After:**

```ts
buildPath("/teams/:teamId", { teamId: "123" });
// typo keys fail at compile time
```

Pair this with a runtime `buildPath` implementation. The type should not be the only thing doing the work.

## 5. Object key remapping

Use mapped types with `as` when the payload is structurally fine but the keys need normalization.

```ts
type SnakeToCamel<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
    : S;

type CamelKeys<T> = {
  [K in keyof T as K extends string ? SnakeToCamel<K> : K]: T[K];
};
```

This is ideal for:

- API response normalization
- getter/setter generation
- event handler name generation

## 6. Dot-path helpers

Use recursive path generation only when the object depth is modest and the path space is not huge.

```ts
type Path<T> = T extends object
  ? {
      [K in keyof T]:
        K extends string
          ? `${K}` | `${K}.${Path<T[K]>}`
          : never;
    }[keyof T]
  : never;
```

This can be lovely for config readers and form libraries. It can also get expensive if you point it at a large domain object with deep nesting.

## 7. Runtime pairing with typed helpers

Native string methods usually widen the result:

```ts
const value = "hello-world" as const;
const widened = value.replace("-", " ");
// string
```

If the codebase truly benefits from preserving literal outputs, pair the type-level idea with:

- A narrow custom helper
- `string-ts`
- Another library that explicitly preserves literal specificity

Prefer selective imports over project-wide prototype/type overrides unless the team has consciously chosen that tradeoff.

## 8. Large-language escape hatch

Do not model entire languages with template literal types when the valid space is large.

Use runtime validation plus a branded string instead:

```ts
declare const UuidBrand: unique symbol;

type Uuid = string & { readonly [UuidBrand]: "Uuid" };

function parseUuid(value: string): Uuid {
  if (!UUID_PATTERN.test(value)) {
    throw new Error("Invalid UUID");
  }

  return value as Uuid;
}
```

This keeps the API honest without forcing the compiler to enumerate a universe of strings.

## 9. Case-conversion strategy

Built-in intrinsics are great building blocks:

- `Uppercase`
- `Lowercase`
- `Capitalize`
- `Uncapitalize`

They are not locale-aware. Use them for identifier transforms, not human language.

For full case-conversion pipelines:

1. Split into words.
2. Normalize word casing.
3. Rejoin into the target shape.
4. Add a bailout for wide `string`.

## 10. Pattern chooser

Use this quick picker:

- If the string is a small fixed menu, use a union.
- If the string is generated from known pieces, use template literals.
- If you are transforming object keys, use key remapping.
- If you are parsing a small structured pattern, use recursive `infer`.
- If the space is large or user-authored, validate at runtime and brand the result.
