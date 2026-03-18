
# Fix Recurring Registration Payments

## What is actually happening

Do I know what the issue is? Yes.

There are two separate payment problems causing the loop:

1. **Registration payments are not being finalized after checkout**
   - The app currently returns from checkout and `ProtectedRoute` only **polls `tenants.registration_fee_paid` / `landlords.registration_fee_paid`**.
   - In the database, recent registration `escrow_transactions` are still **`pending`** and the affected tenant records still have **`registration_fee_paid = false`**.
   - That means after refresh, the guard sends the user back to **“Registration Payment Required”**, which creates the repeated-payment experience.

2. **Some checkout requests fail before payment starts because Paystack rejects the email**
   - Logs show Paystack returning: **“Invalid Email Address Passed”**
   - The code is sending synthetic emails like `0240005678@rentcontrolghana.local`, which Paystack does not accept.

## Root cause

The registration flow depends too heavily on the webhook/polling path:
- `paystack-checkout` creates a pending escrow row
- after redirect back, the frontend waits for the webhook to mark the registration as paid
- if the webhook is delayed/misconfigured/missed, the record stays pending and the user is trapped in the payment wall

So the real fix is:
- **server-side payment verification on callback/refresh**
- plus **valid email fallback for Paystack initialization**

## Implementation plan

### 1. Add a backend verification path for returned payments
**Files:**
- `supabase/functions/paystack-checkout/index.ts`
- `src/components/ProtectedRoute.tsx`

Plan:
- Extend the payment backend so it can also **verify a Paystack transaction by reference** using the secret key.
- On successful verification for `tenant_registration` / `landlord_registration`, it should:
  - mark the escrow transaction as completed
  - set `registration_fee_paid = true`
  - set `registration_date` and `expiry_date`
  - create receipt / notification only once
- Update `ProtectedRoute` so when the user returns with `reference`, `trxref`, or `status=success`, it does **not only poll**. It should first call backend verification immediately, then fall back to polling only if needed.

Result:
- refreshing the page after a real successful payment will activate the account instead of showing the paywall again.

### 2. Make registration finalization idempotent
**Files:**
- `supabase/functions/paystack-webhook/index.ts`
- `supabase/functions/paystack-checkout/index.ts`

Plan:
- Reuse one shared completion flow for registration payments so both:
  - webhook confirmation
  - direct verification after redirect
  produce the same result safely.
- Guard against duplicates by checking whether:
  - escrow transaction is already completed
  - tenant/landlord already has `registration_fee_paid = true`
  - receipt already exists for the escrow record

Result:
- no duplicate charges, no duplicate receipts, no double-processing.

### 3. Fix invalid email errors sent to Paystack
**Files:**
- `supabase/functions/paystack-checkout/index.ts`
- possibly `src/pages/RegisterTenant.tsx`
- possibly `src/pages/RegisterLandlord.tsx`

Plan:
- Stop sending `.local` synthetic emails to Paystack.
- In checkout initialization, use this priority:
  1. real profile email if valid
  2. authenticated email if valid
  3. safe fallback email on a real domain (or generated valid placeholder)
- Keep phone-based login internally, but ensure the payment provider only receives a valid email format.

Result:
- checkout stops failing with “Invalid Email Address Passed”.

### 4. Tighten the registration-return UX
**File:**
- `src/components/ProtectedRoute.tsx`

Plan:
- Replace the current “Payment Is Being Processed” dead-end with a smarter recovery path:
  - verify payment by reference on load
  - show a clearer state if verification is still pending
  - prevent the user from being pushed straight back into a new payment attempt
- If verification succeeds, clear the query params and allow dashboard access immediately.

Result:
- users won’t feel forced into paying again after refresh.

## Files to update

- `supabase/functions/paystack-checkout/index.ts`
- `supabase/functions/paystack-webhook/index.ts`
- `src/components/ProtectedRoute.tsx`

## Expected outcome

After this fix:
- successful registration payments will unlock the dashboard even if the webhook is late
- refreshing will no longer send paid users back to “Registration Payment Required”
- Paystack initialization will stop failing on invalid synthetic emails
- the registration payment flow will be resilient and non-recurring
