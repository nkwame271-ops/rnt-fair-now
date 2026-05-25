
## Problem

In `src/pages/student/RentCareApply.tsx`, a helper component `T` is defined **inside** the `RentCareApply` function body. Every keystroke updates `form` state → parent re-renders → `T` is a brand new component reference → React unmounts the old `<Input>`/`<Textarea>` and mounts a new one → the field loses focus after each character.

## Fix

Move the field renderer out of the component so its identity is stable across renders.

### Changes to `src/pages/student/RentCareApply.tsx`

1. Remove the inline `T` component defined inside `RentCareApply`.
2. Replace each `<T k="..." label="..." />` usage with direct `<Input>` / `<Textarea>` inside a small stable wrapper — either:
   - inline the `<div className="space-y-1"><Label/>...<Input/></div>` markup, or
   - extract a top-level `Field` component (defined outside `RentCareApply`) that takes `value`, `onChange`, `label`, `type`, `textarea` as props.

Preferred: extract a module-level `Field` component to keep the JSX compact. It will receive `value={form[k]}` and `onChange={(v) => set(k, v)}` from the parent, so its identity stays stable and inputs keep focus while typing.

3. No other logic, validation, or styling changes — purely a re-render/identity fix.

## Verification

- Open `/nugs/rentcare/new` (or wherever `RentCareApply` is routed) and type continuously into Full Name, Reason, and numeric fields — focus must remain in the field.
- Submit flow (`onSubmit`, zod schema, navigation to `/nugs/rentcare/:id`) is unchanged.
