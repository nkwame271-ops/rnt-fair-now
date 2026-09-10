# Make complaint payments reliable

## Confirmed today

- The backend successfully created fresh Paystack sessions and returned valid access codes, public-key status, amount, email, and references.
- The latest complaint payment `CAR-2026-005187` was successfully verified and completed.
- Two earlier attempts for the same complaint remained pending before a later fresh attempt completed.
- No backend log contains “Unable to process transaction”; that message is raised inside Paystack’s payment window before verification.
- The current retry logic refreshes a session only after the payment window reports an error or closes. Other payment entry points still reuse their initial session if reopened.

## Fix

1. **Make every popup opening use a newly created session**
   - Refresh the checkout immediately before opening Paystack, not only after a failed popup.
   - Prevent double-clicks and concurrent refreshes from opening the same access code twice.
   - Apply this consistently to complaint, registration, rent-card, and other shared payment flows through the central checkout host.

2. **Add a reliable fallback when Paystack Inline rejects a fresh session**
   - If the inline popup returns “Unable to process transaction,” retain the fresh authorization URL and offer the same transaction through Paystack’s hosted checkout instead of retrying a spent access code.
   - Keep the reference and return path intact so successful payments still reach the existing confirmation flow.

3. **Capture the missing failure evidence**
   - Add a small authenticated payment-error reporting function.
   - Record reference, payment type, popup stage, Paystack message, browser context, and timestamp without logging card, OTP, Mobile Money, or secret data.
   - Mark superseded pending attempts when a later attempt for the same complaint succeeds, while preserving their audit history.

4. **Verify processing end to end**
   - Test: first attempt, close-and-retry, inline-error fallback, successful callback, and repeated verification.
   - Confirm one completed payment, one receipt, correct complaint status, and no duplicate revenue splits.
   - Check both mobile and desktop behavior and review the new logs for the exact provider response.

## Technical details

- Centralize fresh-session acquisition in the shared checkout host so individual screens cannot accidentally bypass it.
- Keep verification idempotent and continue using the existing server-side Paystack verification as the payment source of truth.
- Do not treat a popup error as payment failure until server verification confirms the processor status.
