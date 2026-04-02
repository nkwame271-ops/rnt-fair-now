

# Fix: Invite Staff 400 Errors + Empty Rent Cards for Sub-Admins

## Root Cause Analysis

### Issue 1: "Edge function returned a non-2xx code"
The edge function returns HTTP 400 with `{ error: "..." }` in the body. However, when `supabase.functions.invoke()` receives a non-2xx status, it sets `error` to a generic `FunctionsHttpError` ("Edge function returned a non-2xx status code") and `data` is **null**. The frontend code checks `data?.error` first (line 76), but `data` is null, so it falls through to `error.message` which is the generic message.

**Fix**: Change the edge function to always return HTTP 200 and put success/error status in the JSON body. This is the standard pattern for Supabase edge functions called via `supabase.functions.invoke()`.

### Issue 2: Rent Cards empty for sub-admins
The code at `RegulatorRentCards.tsx` lines 25-27 already has the fix from the prior implementation (`hasRentCards` check). This should be working. If it's still empty, the issue is that the `admin_staff` record was created during a previous (broken) invitation attempt where `allowed_features` may not have been saved correctly. Verify that the `admin_staff` table has the correct `allowed_features` array for the invited user.

## Plan

### 1. Fix edge function to return 200 with error in body
**File**: `supabase/functions/invite-staff/index.ts`

Change all `status: 400` / `status: 403` responses to `status: 200` with the error message in the JSON body. The frontend already checks `data?.error` — this will now work correctly because `data` will be populated.

```typescript
// BEFORE (broken with supabase.functions.invoke):
return new Response(JSON.stringify({ error: "message" }), {
  status: 400,  // causes data to be null
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

// AFTER:
return new Response(JSON.stringify({ error: "message" }), {
  status: 200,  // data is populated, frontend reads data.error
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
```

Keep `status: 401` for unauthorized (no auth header) since that's a true auth failure. Change 400 and 403 responses to 200.

### 2. Verify Rent Cards fix is deployed
The `RegulatorRentCards.tsx` already has the correct permission check (lines 25-27). No code change needed. The empty dashboard issue will resolve once staff accounts can be successfully created with the correct `allowed_features` array.

## Files to change

| File | Change |
|------|--------|
| `supabase/functions/invite-staff/index.ts` | Return HTTP 200 for all business errors (400/403), keeping error message in JSON body |

