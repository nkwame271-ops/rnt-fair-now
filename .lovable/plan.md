

## Problem Analysis

There are **two issues** causing the QR code verification to fail:

1. **RLS (Row-Level Security) blocks unauthenticated access**: The verification page at `/verify/:role/:id` is a public route (no login required), but the `tenants`, `landlords`, and `profiles` tables all require authentication to read. When someone scans the QR code without being logged in, the database queries silently return no data, making the page show "Not Found" -- or if the route itself isn't resolving on the published site, a 404.

2. **Direct client queries won't work for public verification**: Even if we added public RLS policies, that would expose sensitive user data to anyone. The correct approach is to use a backend function that performs the lookup server-side and returns only the minimal verification data.

## Plan

### 1. Create a backend function `verify-registration`

Create `supabase/functions/verify-registration/index.ts` that:
- Accepts `role` and `id` as query parameters
- Uses the service role key to query `tenants`/`landlords` and `profiles` tables (bypassing RLS)
- Returns only the minimal public verification data: name, registration status, fee paid, registration date, expiry date
- No authentication required (`verify_jwt = false` in config)

### 2. Update `supabase/config.toml`

Add the `verify-registration` function with `verify_jwt = false` so it can be called without authentication.

### 3. Update `VerifyRegistration.tsx`

Replace direct database queries with a call to the new backend function:
```typescript
const { data } = await supabase.functions.invoke("verify-registration", {
  body: { role, id }
});
```
This ensures the page works for anyone scanning the QR code, regardless of login status.

### 4. Update QR code URL in `ProfilePage.tsx`

Use the actual published URL dynamically from environment variables rather than hardcoding, to ensure the QR code works in both preview and production environments.

---

### Technical Details

**Backend function response shape:**
```json
{
  "found": true,
  "name": "Kwame Mensah",
  "status": "active",
  "feePaid": true,
  "registrationDate": "2026-02-25T02:30:16.919+00:00",
  "expiryDate": "2027-02-25T02:30:16.92+00:00",
  "role": "tenant",
  "registrationId": "TN-2026-1001"
}
```

**Security**: The function uses the service role key internally but only returns non-sensitive verification data (name, status, dates). No emails, phone numbers, addresses, or user IDs are exposed.

