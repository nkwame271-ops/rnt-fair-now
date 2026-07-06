## What I found

The current screenshot is not the same earlier “incomplete checkout details” problem.

Evidence from the backend logs for reference `treg_30b8024a-7895-4287-b99f-bede0d731e0d_1783342791049`:

- Checkout initialization succeeded.
- The payment processor returned an authorization URL, access code, and reference.
- The app returned a complete branded checkout payload with public key, email, amount, invoice, and reference.
- The database still shows the matching escrow transaction as `pending`.
- No matching verification log was recorded for that reference.
- No webhook log was recorded.

So the failure is after the payment modal: the confirmation page is timing out because the transaction is still `pending` and the verification path is not completing the escrow.

## Likely root cause

The branded inline checkout currently uses only the reference in the browser callback. It does not pass the processor `access_code` into the inline SDK setup.

Because the backend already initialized a transaction and got an `access_code`, the frontend should open that exact initialized transaction. Without binding the inline SDK to the returned `access_code`, the user can reach the confirmation page with a reference that the backend has recorded, but verification can still report not paid / pending if the inline payment session is not the same initialized transaction or has not actually completed.

There is also a UX issue: the confirmation page currently shows a generic failure after retries, instead of checking the local transaction record and explaining whether the payment is pending, failed, abandoned, or unverifiable.

## Plan to fix

1. **Bind branded checkout to the initialized transaction**
   - Update the inline checkout setup to use the returned `access_code` when opening the payment window.
   - Keep the existing reference, amount, email, and branded UI.
   - Do not show public payment-page links or redirect to hosted payment pages.

2. **Improve verification diagnostics**
   - Add safe logs in the verify function for:
     - reference received
     - local escrow status found
     - processor verification status
     - finalization result
   - Do not log keys, tokens, or sensitive payloads.

3. **Make the confirmation page reflect real status**
   - If verification returns `success`, show payment received.
   - If the processor says `abandoned`, `failed`, or `not_paid`, show a clear visible failure.
   - If the local escrow remains `pending`, show “Payment still pending” with retry/back actions instead of immediately implying the user was charged.

4. **Make verification more resilient**
   - Keep retrying briefly for delayed processor/webhook updates.
   - If verification says not paid, return the exact safe status to the frontend.
   - Keep finalization idempotent so webhooks and manual confirmation cannot double-process the payment.

5. **Deploy and verify against the exact failing reference path**
   - Deploy the changed verification/check-out functions if backend code changes are needed.
   - Re-test a checkout flow and confirm the escrow changes from `pending` to `completed`, or shows the precise processor status instead of the generic confirmation failure.

## Files to change

- `src/lib/payments/brandedCheckout.ts`
- `src/components/payments/BrandedCheckoutHost.tsx`
- `src/pages/shared/PaymentConfirm.tsx`
- `supabase/functions/verify-payment/index.ts`

No database schema change is planned.