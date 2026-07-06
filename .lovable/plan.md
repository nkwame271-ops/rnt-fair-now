# Branded In-App Payments (Paystack Inline)

Today every payment call `paystack-checkout` returns `authorization_url` and the frontend does `window.location.href = data.n` — the user leaves our app and lands on Paystack's hosted page. We replace that with a Paystack Inline modal launched from a branded in-app checkout screen. Paystack stays only as the processor.

## 1. Backend: `paystack-checkout`
- Keep initializing via `POST https://api.paystack.co/transaction/initialize` (server-side, secret key stays on server).
- Return `{ reference, access_code, amount, currency, email, purpose, invoice_id }` in addition to `authorization_url` (kept as a fallback only).
- Add/confirm these fields on the initialize call: `reference` (our invoice-style ref, e.g. `RCG-INV-YYYYMMDD-XXXX`), `metadata.custom_fields` (Platform: Rent Control Ghana, Purpose, Invoice ID, User), `channels` (card, mobile_money, bank, ussd), `callback_url` pointing to our in-app `/payments/confirm?ref=…` (used only if the modal falls back to redirect).

## 2. Frontend: shared branded checkout
- New component `src/components/payments/BrandedCheckout.tsx`:
  - Loads `https://js.paystack.co/v2/inline.js` once via a small `usePaystackInline()` hook.
  - Renders our branded "Secure Payment" card: RCG logo, platform name, invoice number, purpose, amount in `GHS X,XXX.XX`, user name/email, itemised fee lines, footer microcopy: *"Secure payment powered by our licensed payment partner."* No Paystack logo.
  - Primary CTA `Pay securely` → calls `PaystackPop.newTransaction({ key: PUBLIC_KEY, email, amount, reference, onSuccess, onCancel, onClose })`. No `window.location.href` redirect.
  - On `onSuccess` → navigate to `/payments/confirm?ref=…` which calls `verify-payment` and shows the branded success screen.
  - On `onCancel` / `onClose` → mark intent `abandoned` client-side (webhook is source of truth) and show a branded "Payment cancelled" state with Retry.
- New route `src/pages/shared/PaymentCheckout.tsx` (`/pay/:reference`) — the branded page hosting `BrandedCheckout`. Deep-linkable so email/SMS can point users here instead of Paystack URLs.
- New route `src/pages/shared/PaymentConfirm.tsx` (`/payments/confirm`) — verifies via `verify-payment`, shows branded receipt (invoice #, ref, amount, channel, timestamp, "Powered by our licensed payment partner").
- Add `VITE_PAYSTACK_PUBLIC_KEY` to `.env` (publishable key, safe in client).

## 3. Migrate all 24 callsites
Replace the `window.location.href = data.n` pattern in every file listed below with `navigate(\`/pay/\${data.reference}\`)` (or open `BrandedCheckout` in a dialog for flows that shouldn't leave the page):

`TenantDashboard`, `Payments`, `RequestRenewal`, `TerminationRequest`, `FileComplaint`, `Marketplace`, `RegisterLandlord`, `ReportSafetyIssue` (tenant/landlord/student), `NugsMyComplaints`, `RentCareDetail`, and the remaining files under `src/pages/**` that currently redirect. Behaviour, fees, and draft records are unchanged — only the checkout surface changes.

## 4. Verify + Webhook (mostly already in place)
- `verify-payment` edge function: keep — called from `PaymentConfirm` after `onSuccess` and from a polling fallback.
- `paystack-webhook` edge function: keep as source of truth. Ensure it upserts on `charge.success`, `charge.failed`, and treats missing/expired as `abandoned` via a scheduled sweep (already partially handled by `reconcile-payment`; extend it to mark intents `abandoned` after 30 min without terminal event).

## 5. Data model
Ensure `payment_intents` (and mirrored `escrow_transactions`) persist every required field. Add a migration only for columns that don't yet exist:
- `user_id`, `invoice_id`, `paystack_reference`, `amount`, `currency`, `purpose`, `status` (`pending|success|failed|abandoned`), `channel` (`card|mobile_money|bank|ussd`), `initialized_at`, `paid_at`, `webhook_payload jsonb`, `verification_payload jsonb`.
- Grants + RLS: users read their own rows; `service_role` full access; `is_main_admin()` read all. Follow the standard grant block.

## 6. Copy + branding rules
- Nowhere in our UI reads "Paystack". Buttons: `Pay securely`. Section titles: `Secure payment`. Fine print: `Secure payment powered by our licensed payment partner.`
- Receipts, emails, SMS templates: use `Rent Control Ghana` as merchant name and our internal reference (`RCG-INV-…`).
- Acknowledge in a small info tooltip on the checkout page that "Your bank statement, OTP, 3DS, or MoMo prompt may show our payment partner's name" — covers the leak channels listed in requirement 12 without foregrounding the brand.

## Technical details
- Inline v2 script: `<script src="https://js.paystack.co/v2/inline.js"></script>`, loaded on demand.
- `access_code` returned from initialize can be used with `PaystackPop.resumeTransaction(access_code)` for retries without re-initializing.
- Public key: `VITE_PAYSTACK_PUBLIC_KEY` (publishable, may live in code/.env). Secret key stays only in edge function env.
- Webhook signature verification (`x-paystack-signature`, HMAC-SHA512 with secret key) is already implemented in `paystack-webhook`; no change.
- Bank/OTP/MoMo/SMS from the processor cannot be rebranded — call this out in docs and in the small tooltip above.

## Out of scope
- No changes to fee calculation, split configuration, or receipt PDF generation.
- No change to how `finalize-payment` allocates escrow splits.

```text
User clicks Pay
  → paystack-checkout (server init)              [reference, access_code]
  → /pay/:reference (branded page)
  → PaystackPop.newTransaction (in-app modal)
  → onSuccess → /payments/confirm → verify-payment
  → paystack-webhook (async, source of truth) → payment_intents.status
```
