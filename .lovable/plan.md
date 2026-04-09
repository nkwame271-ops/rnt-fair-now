

# Debugging Report & Fix Plan

## Issue 1: OTP "Invalid or expired OTP" — ROOT CAUSE IDENTIFIED

### 1. Root Cause
The `verify-otp` edge function returns **HTTP 400** for business errors (wrong code, expired, etc.). When `supabase.functions.invoke()` receives a non-2xx response, it sets `error` to a `FunctionsHttpError` object and `data` to **null**. The actual error message from the response body is lost.

**Current broken code** in `supabase/functions/verify-otp/index.ts`, lines 43, 53, 58:
```ts
// These all return status: 400 — supabase.functions.invoke treats this as error, data=null
return new Response(JSON.stringify({ verified: false, error: "No verification code found..." }), { status: 400, ... });
return new Response(JSON.stringify({ verified: false, error: "Verification code has expired..." }), { status: 400, ... });
return new Response(JSON.stringify({ verified: false, error: "Incorrect verification code" }), { status: 400, ... });
```

**Frontend** in `src/pages/ForgotPassword.tsx`, line 96-97:
```ts
if (error || data?.error || !data?.verified) {
  const reason = data?.error || error?.message || "Invalid or expired OTP. Please try again.";
```
Since `data` is null (due to 400), `data?.error` is undefined, so it falls through to `error?.message` which is a generic SDK message like "Edge Function returned a non-2xx status code" — then falls to the hardcoded generic string.

**I verified this live**: calling verify-otp with wrong code returns 400, and `supabase.functions.invoke` wraps it as an error.

### 2. Fix
Change `verify-otp` to return **HTTP 200** for all business-logic responses. Use `verified: false` + `error` field to signal failures. Reserve non-200 only for actual server crashes.

This is a different approach from all previous attempts — none of the earlier fixes addressed the HTTP status code mismatch.

### 3. Verification
- Wrong code → 200 with `{ verified: false, error: "Incorrect verification code" }` → `data` is populated → UI shows exact message
- Expired → 200 with `{ verified: false, error: "..." }` → UI shows "expired" message
- Correct code → 200 with `{ verified: true }` → proceeds to step 3

---

## Issue 2: Allocation History — Clear & Download

### 1. Current State
The allocation history section in `src/pages/regulator/rent-cards/OfficeAllocation.tsx` (lines 620-643) is a read-only list with no clear or download buttons.

### 2. Fix
Add two buttons to the allocation history header:
- **Download PDF** — generates a report of the history using jsPDF (already a project dependency)
- **Clear History** — deletes `office_allocations` records for the selected region via the `admin-action` edge function (requires password confirmation), then refreshes

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/verify-otp/index.ts` | Return HTTP 200 for all business errors instead of 400 |
| `src/pages/regulator/rent-cards/OfficeAllocation.tsx` | Add "Download Report" and "Clear History" buttons to allocation history section |

