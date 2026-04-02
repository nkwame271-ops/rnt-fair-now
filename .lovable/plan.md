

# Fix: Generate Rent Cards "Edge function returned a non-2xx status code"

## Root Cause

Same pattern as the invite-staff fix. The `admin-action` edge function's catch block (line 471-474) returns `status: 400`. When `supabase.functions.invoke()` receives a non-2xx response, it sets `data` to `null` and returns a generic error message, hiding the actual error details.

## Fix

**File**: `supabase/functions/admin-action/index.ts` (line 472)

Change `status: 400` to `status: 200` in the catch block. The error message stays in the JSON body (`{ error: err.message }`), which the frontend already reads via `data?.error`.

```typescript
// BEFORE (line 472):
status: 400,

// AFTER:
status: 200,
```

One line change. The frontend `SerialGenerator.tsx` already handles `data?.error` correctly via the `AdminPasswordConfirm` component's error handling.

