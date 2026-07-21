## Confirmed diagnosis (from edge function logs, not assumed)

Paystack is rejecting every `POST /transaction/initialize` call today with:

```
{"status":false,"message":"Error, please try again.","meta":{"nextStep":"Try again later"},"type":"api_error","code":"unknown"}
```

This happens across different users, references, and amounts (GHS 20, GHS 30). Our code runs to completion and forwards Paystack's own message to the UI — that is the "Error, please try again." toast the user sees. So the failure is on Paystack's side of the request, not in the checkout UI.

`api_error / unknown` from Paystack is emitted in three known situations, in decreasing order of likelihood here:

1. **The secret key doesn't match the account state** (e.g. live key on an account still in test-only mode, or the account has been switched/deactivated). Every call fails the same way, which points at the key.
2. **Paystack fraud filter is blocking the synthesized email.** All failing calls use `user-<uuid8>@rentcontrolghana.com`, which Paystack often refuses on live mode because the domain has no MX / the pattern looks synthetic.
3. **GHS currency not enabled** on this Paystack business.

I have not confirmed which of the three it is yet — that verification is step 1 of the plan.

## Plan

### 1. Verify which cause it actually is (no code changes yet, do this first in build mode)
- Call Paystack directly from the edge runtime with the current `PAYSTACK_SECRET_KEY` against `GET https://api.paystack.co/balance` and log the response. This tells us immediately whether the key is valid and whether GHS is on the account.
- If balance succeeds, retry `transaction/initialize` with a real email (`test@paystack.com`) at the same amount. If that succeeds, the culprit is the synthetic email domain. If it still fails, the culprit is the account (currency / activation).

### 2. Fix based on what step 1 reveals

- **If the key/account is the problem:** stop calling Paystack with a broken key. Return a clear "Payments temporarily unavailable — Rent Control is reconnecting the gateway" message to users instead of Paystack's generic string, and prompt the operator to rotate `PAYSTACK_SECRET_KEY` via the secret manager. No user-visible retry loop.
- **If the synthetic email is the problem:** stop generating `user-<uuid>@rentcontrolghana.com`. Require a real email on the account:
  - Prefer `profile.email`, then `auth.users.email`.
  - If neither exists, block the checkout call and surface a clear message: "Add your email in Profile to complete payment," with a direct link to the profile editor. Do not fabricate an email.
- **If GHS isn't enabled:** surface the same "Payments temporarily unavailable" message and flag it for the operator; no code workaround is possible.

### 3. Improve the error surface so we stop chasing ghosts
- In `ProtectedRoute.tsx` and the branded-checkout host, when `paystack-checkout` returns `{ ok:false, error }`, show the specific reason (missing email, gateway unavailable, etc.) instead of the generic Paystack string.
- Keep the existing `console.log("Paystack response", ...)` so future failures remain diagnosable from logs.

### 4. Verify the fix
- After key rotation and/or email fix, trigger the tenant registration flow end-to-end from the preview, confirm `paystack-checkout` returns `ok:true`, and confirm the branded checkout opens.

## Technical notes
- Affected files: `supabase/functions/paystack-checkout/index.ts` (email fallback logic around lines 1416–1420, error return shape at 1487–1490), `src/components/ProtectedRoute.tsx` (toast at line 217), `src/components/payments/BrandedCheckoutHost.tsx` (error handling).
- No schema or RLS changes.
- No changes to Paystack v2 SDK loading — that part is working; the failure is before the popup ever opens.
