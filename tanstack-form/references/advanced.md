# TanStack Form — Advanced Patterns

## Dependent / linked fields

Use `onChangeListenTo` when one field's validity depends on another's value (e.g. password confirmation):

```tsx
<form.Field
  name="confirmPassword"
  validators={{
    onChangeListenTo: ["password"],
    onChange: ({ value, fieldApi }) => {
      const password = fieldApi.form.getFieldValue("password")
      if (value !== password) return "Passwords do not match"
      return undefined
    },
  }}
  children={(field) => { /* ...field JSX... */ }}
/>
```

## Side-effect listeners

Use `listeners` to reset dependent fields when a parent changes (e.g. country → state → postal code):

```tsx
<form.Field
  name="country"
  listeners={{
    onChange: ({ value }) => {
      form.setFieldValue("state", "")
      form.setFieldValue("postalCode", "")
    },
  }}
  children={(field) => { /* ...field JSX... */ }}
/>
```

## Form-level validation (cross-field)

Validate across multiple fields simultaneously:

```tsx
const form = useForm({
  validators: {
    onChange: ({ value }) => {
      if (value.endDate < value.startDate) {
        return "End date must be after start date"
      }
      return undefined
    },
  },
})

// Display form-level errors:
<form.Subscribe
  selector={(s) => s.errors}
  children={(errors) =>
    errors.length > 0 ? <p className="text-destructive">{errors.join(", ")}</p> : null
  }
/>
```

## Reactivity with form.Subscribe

Use selectors to subscribe to only the state you need — avoids unnecessary re-renders:

```tsx
// Minimal subscription for submit button
<form.Subscribe
  selector={(s) => ({ canSubmit: s.canSubmit, isDirty: s.isDirty })}
  children={({ canSubmit, isDirty }) => (
    <>
      {isDirty && <span className="text-muted-foreground text-sm">Unsaved changes</span>}
      <Button type="submit" disabled={!canSubmit}>Save</Button>
    </>
  )}
/>

// Hook-based subscription for use inside child components
function FormStatus({ form }) {
  const isValid = form.useStore((s) => s.isValid)
  return isValid ? null : <p className="text-destructive">Please fix errors before submitting.</p>
}
```

## Shared form options (formOptions)

Reuse default values and configuration across multiple components or pages:

```tsx
import { formOptions } from "@tanstack/react-form"

const profileFormOptions = formOptions({
  defaultValues: { firstName: "", lastName: "", email: "" },
})

// In component:
const form = useForm({
  ...profileFormOptions,
  onSubmit: async ({ value }) => { /* ... */ },
})
```

## Server-side validation (Next.js)

```tsx
import { ServerValidateError } from "@tanstack/react-form/nextjs"

export async function submitAction(data: FormData) {
  "use server"
  const email = data.get("email") as string

  if (await checkEmailExists(email)) {
    throw new ServerValidateError({
      form: "Submission failed. Please check your details.",
      fields: { email: "This email is already registered." },
    })
  }

  // proceed with valid data...
}
```

## FormApi methods reference

| Method | Description |
|--------|-------------|
| `handleSubmit()` | Trigger form submission |
| `reset()` | Reset all fields to defaultValues |
| `getFieldValue(field)` | Read current field value |
| `setFieldValue(field, value)` | Update a field programmatically |
| `getFieldMeta(field)` | Read field metadata (touched, errors, etc.) |
| `validateAllFields(cause)` | Validate entire form with given cause |
| `validateField(field, cause)` | Validate a single field |
| `deleteField(field)` | Remove a dynamic field |

## Form state interface

```typescript
interface FormState {
  values: TFormData
  errors: ValidationError[]
  isValid: boolean           // isFormValid && isFieldsValid
  isTouched: boolean
  isDirty: boolean
  isPristine: boolean
  isSubmitting: boolean
  isSubmitted: boolean
  isSubmitSuccessful: boolean
  submissionAttempts: number
  canSubmit: boolean         // isValid && !isSubmitting
}
```

## Field state interface

```typescript
interface FieldState<T> {
  value: T
  meta: {
    isTouched: boolean
    isDirty: boolean
    isPristine: boolean
    isValidating: boolean
    errors: ValidationError[]
    errorMap: Record<ValidationCause, ValidationError>
  }
}
```
