# Stop the payment error from coming back

## Why it returns

The fix so far only repairs the payment window *after* it has already failed once: when a payment window is cancelled or errors, the app now fetches a new payment session. But the very first opening of a window can still use a session that was created earlier and already spent or expired, which is exactly what produces "Unable to process transaction".

Two verified gaps keep it coming back:

1. **Most payment screens never supply a way to create a fresh session.** Of the ~20 places that open the payment window (registration for landlords and tenants, rent payments, renewals, terminations, marketplace, complaints from students, rent cards, assessments, premium services, pay links, agent registration, safety reports, API billing), only two — tenant cases and the officer complaint dialog — pass a refresh routine. Everywhere else the session created on button click is the only one that will ever exist: leave the page open, click twice, come back from a background tab, and the window opens on a dead session.
2. **The session is created too early.** It is created when the button is pressed, then the user reads the review panel and only later presses "Pay securely". The gap between the two is unbounded, so sessions go stale in normal use — which matches the "works for a while, then breaks" pattern.

There is also no server-side safety net: completions depend on the browser calling back after payment, and the payment provider's webhook has recorded no traffic at all. So a payment that succeeds while the browser is closed can sit unfinished.

## The fix

1. **Create the payment session at the moment the window opens, not before.**
   The review panel will hold only the amount, invoice and payer details. Pressing "Pay securely" fetches a brand-new session and immediately opens the window with it, so a session is never more than a second old.

2. **Make every payment screen use the same path.**
   One shared helper takes what to charge (payment type plus its details) and handles session creation itself. All payment screens are switched to it, so no screen can hand over a stale session and no screen can be forgotten again.

3. **Never reuse a session.**
   Each created session is marked as consumed the moment a window opens on it. A second open always creates a new one. Double-clicks and re-opened dialogs can no longer reuse a spent session.

4. **Keep the escape hatch and the record.**
   The secure hosted payment page fallback and the failure logging added earlier stay, so if a window still refuses to open the payer can finish the payment and we see exactly why.

5. **Close the loop on the server.**
   Enable and verify provider webhook handling so a successful payment is finalised even if the payer's browser closes, plus a scheduled sweep that re-checks payments left unfinished for more than a few minutes and completes or supersedes them. This removes the "paid but nothing happened" class of report.

## Technical notes

- `src/lib/payments/brandedCheckout.ts`: change `BrandedCheckoutPayload` so `access_code`/`authorization_url` are produced by a required `createSession()` callback rather than passed in. Add a consumed-session guard keyed on `reference`.
- `src/components/payments/BrandedCheckoutHost.tsx`: move `createSession()` into `pay()` before `loadPaystackInline()`; keep `reopenForRetry`, hosted fallback and `report-checkout-error` reporting.
- Update all `startBrandedCheckout` callers (registration, tenant payments/renewals/terminations/marketplace/complaints, landlord pages, rent cards, assessments, premium, pay link, agent register, safety reports, agency billing, `ProtectedRoute`) to pass a `createSession` closure that invokes the relevant checkout function.
- `supabase/functions/paystack-webhook`: verify signature handling, then route `charge.success` through the shared `finalizePayment`; confirm the webhook endpoint is registered with the provider.
- New scheduled function/cron: re-verify `escrow_transactions` still `pending` after 10 minutes via the provider's verify endpoint; finalise on success, mark superseded when a later attempt for the same purpose completed.
- Verification: first-attempt payment, cancel then retry, long idle before pressing Pay, double-click, browser closed mid-payment (webhook path), and repeat-verification idempotency.
