# Source Map

Use these as the primary references behind the guidance in this skill:

- TypeScript 1.8 release notes
  - String literal types introduction
  - [https://www.typescriptlang.org/docs/handbook/release-notes/typescript-1-8.html](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-1-8.html)
- TypeScript handbook: template literal types
  - Cross-multiplication behavior and small-language guidance
  - [https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)
- TypeScript 4.1 release notes
  - Template literal types, inference, and key remapping
  - [https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html)
- TypeScript handbook: conditional types
  - Distributive conditionals and tuple wrapping
  - [https://www.typescriptlang.org/docs/handbook/2/conditional-types.html](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
- TypeScript handbook: intrinsic string manipulation types
  - `Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`
  - [https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html#intrinsic-string-manipulation-types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html#intrinsic-string-manipulation-types)
- TypeScript performance wiki
  - Caching, naming complex types, and performance investigations
  - [https://github.com/microsoft/TypeScript/wiki/Performance](https://github.com/microsoft/TypeScript/wiki/Performance)
- `string-ts`
  - Typed runtime string helpers and bailout-minded patterns
  - [https://github.com/gustavoguichard/string-ts](https://github.com/gustavoguichard/string-ts)
- `type-fest`
  - `LiteralUnion` and related utility patterns
  - [https://github.com/sindresorhus/type-fest](https://github.com/sindresorhus/type-fest)

The report also surfaced useful cautionary evidence from TypeScript issue threads around:

- Template literal combinatorial blowups
- Slow conditional types over massive unions
- Non-obvious template-literal inference behavior

Use those as motivation for the escape hatches and performance guidance in this skill.
