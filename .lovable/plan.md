# Fix RentCare typing focus bug (real cause)

## Root cause

The previous fix extracted a top-level `Field` component, but `RentCareApply` still defines an inline wrapper `T` **inside** the component body:

```tsx
const T = ({ k, label, type, textarea }: any) => (
  <Field id={`rc-${k}`} ... value={form[k] || ""} onChange={(v) => set(k, v)} />
);
```

Every keystroke → `setForm` → `RentCareApply` re-renders → `T` is a **new function reference** → React treats every `<T ... />` as a different component type → unmounts the old `Field` (and its `Input`) and mounts a fresh one → the DOM input loses focus after each character.

Extracting `Field` did nothing as long as `T` sits between it and the JSX.

## Fix

In `src/pages/student/RentCareApply.tsx`:

1. Delete the inline `const T = ...` declaration inside `RentCareApply`.
2. Replace every `<T k="foo" label="..." [type] [textarea] />` usage in the JSX with a direct call to the already-extracted top-level `Field`:
   ```tsx
   <Field
     id="rc-foo"
     label="..."
     value={form.foo || ""}
     onChange={(v) => set("foo", v)}
   />
   ```
   Pass `type` / `textarea` only where the current `T` usage passes them (numeric fields, date field, `reason`, `previous_support_history`).
3. No changes to `Field`, `schema`, `onSubmit`, state shape, styling, or any other file.

## Verification

- Navigate to `/nugs/rentcare/new`.
- Type a full sentence into Full Name, Reason (textarea), and a numeric field (e.g. Amount Requested) — cursor must stay in the field, no re-click needed between keystrokes.
- Save Draft still navigates to `/nugs/rentcare/:id` with the same payload.
