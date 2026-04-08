---
name: tanstack-form
description: >
  Implement forms using TanStack Form + shadcn/ui + Zod. Use this skill whenever
  the user mentions a form, forms, form fields, form validation, or form submission
  in any project that contains React code — even if they don't explicitly say
  "TanStack Form". Covers the render-prop field pattern, Zod schema validation,
  all shadcn field types (Input, Textarea, Select, Checkbox, Radio, Switch),
  array fields, async validation, dependent fields, and reactivity. Always use
  this skill before writing any form-related code in a React project.
---

# TanStack Form + shadcn/ui

> Also read the **shadcn-ui** skill for shadcn component installation and configuration patterns.

Use TanStack Form for all React forms. The core idea: Zod owns schema validation, `useForm` owns state, `form.Field` (render prop) owns each field's wiring.

**Package:** `@tanstack/react-form` + `zod`

## The invariant structure

Every form follows this three-part pattern:

### 1. Zod schema

```typescript
const formSchema = z.object({
  name: z.string().min(2, "At least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  message: z.string().min(20, "At least 20 characters"),
})
```

### 2. useForm hook

```typescript
'use client'

import { useForm } from "@tanstack/react-form"

const form = useForm({
  defaultValues: { name: "", email: "", message: "" },
  validators: { onSubmit: formSchema },
  onSubmit: async ({ value }) => {
    // value is fully typed and validated
  },
  onSubmitInvalid: ({ formApi }) => {
    console.log("Validation failed:", formApi.state.errors)
  },
})
```

### 3. form.Field render prop (the core pattern)

```tsx
<form.Field
  name="name"
  validators={{ onBlur: formSchema.shape.name }}
  children={(field) => {
    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
    return (
      <Field data-invalid={isInvalid}>
        <FieldLabel htmlFor={field.name}>Name</FieldLabel>
        <Input
          aria-invalid={isInvalid}
          id={field.name}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
        />
        {isInvalid && <FieldError errors={field.state.meta.errors} />}
      </Field>
    )
  }}
/>
```

Two things working together:
- **Form-level** `validators: { onSubmit: formSchema }` — enforces the full schema on submit
- **Field-level** `validators={{ onBlur: formSchema.shape.fieldName }}` — pulls the individual field's Zod schema for blur validation, so you define rules once

The `isTouched && !isValid` guard prevents showing errors before the user has interacted with the field.

## Form submission

Always `noValidate` (disables browser native validation), `preventDefault`, and `stopPropagation` — the latter matters when forms are inside dialogs or other forms:

```tsx
<form
  noValidate
  onSubmit={(e) => {
    e.preventDefault()
    e.stopPropagation()
    form.handleSubmit()
  }}
>
  <FieldGroup>
    {/* fields */}
  </FieldGroup>

  <form.Subscribe
    selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}
    children={({ canSubmit, isSubmitting }) => (
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting ? "Saving..." : "Submit"}
        </Button>
        <Button type="button" variant="outline" onClick={() => form.reset()}>
          Reset
        </Button>
      </div>
    )}
  />
</form>
```

`form.Subscribe` with a selector keeps the button from causing full-form re-renders.

## Field type reference

### Input / Textarea
```tsx
<Input
  aria-invalid={isInvalid}
  id={field.name}
  value={field.state.value}
  onBlur={field.handleBlur}
  onChange={(e) => field.handleChange(e.target.value)}
/>
// Textarea: same props, swap <Textarea />
// Add autoComplete="email" / "new-password" etc. on relevant fields
```

### Select

Use `z.enum([...] as const)` for typed select values. `SelectTrigger` needs `onBlur` for touched tracking:

```tsx
// Schema:
role: z.enum(["Engineer", "Designer", "PM"] as const, {
  error: () => ({ message: "Please select a role" }),
})

// JSX:
<Select value={field.state.value} onValueChange={field.handleChange}>
  <SelectTrigger
    aria-invalid={isInvalid}
    id={field.name}
    onBlur={field.handleBlur}
  >
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="Engineer">Engineer</SelectItem>
    <SelectItem value="Designer">Designer</SelectItem>
    <SelectItem value="PM">PM</SelectItem>
  </SelectContent>
</Select>
```

### Checkbox (boolean)
```tsx
<Checkbox
  id={field.name}
  checked={field.state.value}
  onCheckedChange={field.handleChange}
  aria-invalid={isInvalid}
/>
```

### Radio Group
```tsx
<RadioGroup
  value={field.state.value}
  onValueChange={field.handleChange}
  aria-invalid={isInvalid}
>
  <RadioGroupItem value="a" id="a" />
  <Label htmlFor="a">Option A</Label>
</RadioGroup>
```

### Switch
```tsx
<Switch
  id={field.name}
  checked={field.state.value}
  onCheckedChange={field.handleChange}
  aria-invalid={isInvalid}
/>
```

## Validation timing

```typescript
// On the form: enforces schema at submit time
validators: { onSubmit: formSchema }

// On each field: pulls that field's schema for blur validation
validators={{ onBlur: formSchema.shape.fieldName }}
```

For more complex per-field logic (custom messages, async checks), write an inline function:

```tsx
validators={{
  onBlur: ({ value }) =>
    !value ? "Required" : value.length < 8 ? "At least 8 characters" : undefined,
}}
```

Return `undefined` (not `null` or `false`) for valid states.

## Async validation

```tsx
<form.Field
  name="username"
  asyncDebounceMs={500}
  validators={{
    onChangeAsync: async ({ value }) => {
      const res = await fetch(`/api/check-username?q=${value}`)
      const { available } = await res.json()
      return available ? undefined : "Username already taken"
    },
  }}
  children={(field) => (
    <>
      {/* ...field JSX... */}
      {field.state.meta.isValidating && <span>Checking...</span>}
    </>
  )}
/>
```

## Array fields

```tsx
const memberSchema = z.object({
  name: z.string().min(1, "Required"),
  role: z.enum(["Engineer", "Designer", "PM"] as const),
})

const formSchema = z.object({
  members: z.array(memberSchema).min(1).max(5),
})

<form.Field
  name="members"
  mode="array"
  children={(membersField) => (
    <div className="flex flex-col gap-4">
      {membersField.state.value.map((_, index) => (
        <div key={index} className="rounded-lg border p-4 flex flex-col gap-4">
          {membersField.state.value.length > 1 && (
            <Button type="button" variant="outline" onClick={() => membersField.removeValue(index)}>
              Remove
            </Button>
          )}

          <form.Field
            name={`members[${index}].name`}
            validators={{ onBlur: memberSchema.shape.name }}
            children={(nameField) => {
              const isInvalid = nameField.state.meta.isTouched && !nameField.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={nameField.name}>Name</FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    id={nameField.name}
                    value={nameField.state.value}
                    onBlur={nameField.handleBlur}
                    onChange={(e) => nameField.handleChange(e.target.value)}
                  />
                  {isInvalid && <FieldError errors={nameField.state.meta.errors} />}
                </Field>
              )
            }}
          />

          <form.Field
            name={`members[${index}].role`}
            validators={{ onBlur: memberSchema.shape.role }}
            children={(roleField) => {
              const isInvalid = roleField.state.meta.isTouched && !roleField.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={roleField.name}>Role</FieldLabel>
                  <Select value={roleField.state.value} onValueChange={roleField.handleChange}>
                    <SelectTrigger aria-invalid={isInvalid} id={roleField.name} onBlur={roleField.handleBlur}>
                      <SelectValue placeholder="Select a role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Engineer">Engineer</SelectItem>
                      <SelectItem value="Designer">Designer</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                  {isInvalid && <FieldError errors={roleField.state.meta.errors} />}
                </Field>
              )
            }}
          />
        </div>
      ))}

      {membersField.state.value.length < 5 && (
        <Button type="button" variant="outline"
          onClick={() => membersField.pushValue({ name: "", role: "Engineer" })}>
          + Add Member
        </Button>
      )}
    </div>
  )}
/>
```

Array methods: `pushValue`, `insertValue(index, item)`, `replaceValue(index, item)`, `removeValue(index)`, `swapValues(a, b)`, `moveValue(from, to)`.

## Accessibility checklist

- `noValidate` on `<form>` — disables browser validation to let TanStack Form handle it
- `<Field data-invalid={isInvalid}>` — lets shadcn style the error state
- `htmlFor={field.name}` on `<FieldLabel>` — links label to input
- `id={field.name}` on the control — completes the label link
- `aria-invalid={isInvalid}` on the control — signals invalidity to screen readers
- `onBlur={field.handleBlur}` on `SelectTrigger` as well as inputs
- `<FieldError errors={field.state.meta.errors} />` — only render when `isInvalid`

## Common pitfalls

- Forgetting `e.stopPropagation()` on submit (breaks forms inside dialogs)
- Forgetting `noValidate` on the form (browser validation fights TanStack Form)
- Returning `null`/`false` from a validator instead of `undefined`
- Omitting `onBlur={field.handleBlur}` on `SelectTrigger` (breaks blur tracking on selects)
- Using `mode="array"` on nested item fields instead of just the parent
- Missing `asyncDebounceMs` on async validators (causes excessive API calls)
- Subscribing to entire form state instead of using a selector in `form.Subscribe`
- Using JSX children (`<form.Field>...</form.Field>`) instead of the `children` prop (`children={...} />`) — always use the prop form with self-closing tag
- Using `formSchema.shape.members.element.shape.name` for array sub-field validators — extract a named `memberSchema` and use `memberSchema.shape.name` instead

---

For advanced patterns — dependent fields, side-effect listeners, shared `formOptions`, server-side validation, and form state interface — see `references/advanced.md`.
