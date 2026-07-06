## Goal
Complete the branded in-app payment experience so users never see Paystack-hosted pages, all payment data (including channel + webhook payload) is stored, and confirmation happens inside our app.

## What is already in place
- `BrandedCheckoutHost` modal renders our brand, invoice number, description, payer details, amount, and "Secure payment powered by our licensed payment partner" copy.
- `startBrandedCheckout` validates the payload and opens the modal; the modal loads Paystack Inline JS on demand and never redirects to a hosted page.
- 19+ call-sites migrated (tenant, landlord, student, NUGS, regulator, agency-API billing) to use `startBrandedCheckout`.
- Modal now shows a visible destructive alert when initialization fails.
- `paystack-checkout` returns `publicKey`, `reference`, `amount`, `email`, `invoiceId`, etc.
- `payment_intents` table stores user_id, invoice/reference, amount, service type (purpose), status, provider payload, timestamps. `paystack-webhook` and `verify-payment` already update it.

## Remaining gaps to close
1. **Store payment channel + full webhook payload explicitly**
   - Add `payment_channel` (text) and `webhook_response` (jsonb) columns to `payment_intents` via migration.
   - Update `paystack-webhook` to persist `data.channel` (card / mobile_money / bank / ussd / qr) and the full webhook body into these columns on `charge.success`, `charge.failed`, and abandonment events.
   - Update `verify-payment` to persist `channel` when the verification call returns it (so channel is captured even if the webhook is delayed).

2. **Backend verification on the confirmation screen**
   - `PaymentConfirm` already polls `verify-payment`; confirm it displays branded success/failure using our platform name only, with reference + invoice + amount and no Paystack wording. Adjust copy if any Paystack mentions remain.

3. **Guarantee inline-only flow**
   - Audit `paystack-checkout` response to make sure the frontend never depends on `authorization_url`. Keep it internally for legacy webhooks but stop returning it to the client, or clearly mark it as unused.
   - Add a lint-style source scan note in the plan doc: no component may reference `authorization_url` or `window.location.href = ` for payments.

4. **Neutral copy pass**
   - Sweep remaining user-facing strings ("Paystack", "Redirecting to Paystack", "Opening Paystack") across `src/` and replace with "Secure payment" / "Opening secure checkout".
   - Keep the disclaimer already shown in the modal about statements/OTP/MoMo prompts possibly showing the partner's name.

5. **Webhook hardening**
   - Ensure `paystack-webhook` verifies the `x-paystack-signature` HMAC using `PAYSTACK_SECRET_KEY` before trusting the body (add if missing).
   - Log every event into `payment_processing_errors` on failure and into `payment_intents.provider_payload` on success (already partly done — confirm channel + raw body land in the new columns).

6. **Verification**
   - Trigger a test payment from Tenant → Payments in the preview and confirm:
     a. The branded modal opens (no redirect).
     b. After completing the sandbox payment, the app lands on `/payments/confirm` with our branding.
     c. `payment_intents` row shows `payment_channel` and `webhook_response` populated.

## Technical notes
- Migration adds two nullable columns; no data backfill needed. Existing GRANTs on `payment_intents` remain unchanged.
- No schema change to `payment_receipts` — channel already flows into receipts via existing logic; we only add it to `payment_intents` for auditability.
- No new secrets required. `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` are already configured.
