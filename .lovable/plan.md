# Phase 5 — Premium Service, Wallet & Assessment Fixes, Engine Room

Six focused fixes grouped by area. All follow existing patterns (agent workflow, wallet edge functions, feature_flags table, escrow checkout).

## 1. Homepage: "Premium Service" nav link
- In `src/pages/Index.tsx` (and header/nav components), replace the existing "Become an Agent" link/CTA with **Premium Service** pointing to `/premium-service`.
- Create `src/pages/PremiumServiceLanding.tsx` (public):
  - Hero + explanation of Premium Service (per-property subscription, assigned agents, full management support, yearly billing).
  - "Apply as Premium Agent" CTA → routes to existing `/agent/register` flow (unchanged verification/approval/onboarding).
  - "Subscribe as Landlord/Tenant" CTA → routes to existing `/premium-service` in-app page (or auth gate first).
- Register route in `src/App.tsx`.

## 2. Wallet: withdrawal payout-account detection
Bug: withdrawal always says "Add a payout account first" even when Payment Settings has one saved.
- `src/pages/shared/Wallet.tsx` withdrawal path currently queries `wallet_payout_accounts`, but landlords save their account into `landlord_payment_settings` from `PaymentSettings.tsx`. Two data sources are out of sync.
- Fix: on opening the withdrawal dialog, fetch **both** `wallet_payout_accounts` and `landlord_payment_settings`. If the landlord has payment settings but no matching `wallet_payout_accounts` row, auto-provision one by calling `wallet-add-payout-account` (mobile money = accept as-is, bank = Paystack resolve).
- Validate: `is_verified = true` and only allow withdrawal from `wallets.available_balance` (already enforced in `wallet-withdraw`). Add a clear frontend check + toast.

## 3. Payout account changes require step-up auth
Apply to add/edit/delete/set-default on payout accounts (both `wallet_payout_accounts` UI in Wallet and `PaymentSettings.tsx`).
- New shared component `src/components/PayoutStepUpDialog.tsx`:
  1. Password OR Transaction PIN input (verified via new edge function `verify-user-credential`).
  2. OTP sent to user's registered phone via existing `send-otp` / `verify-otp`.
  3. Final confirmation screen summarising the change.
- Gate all mutations behind this dialog. On success, store a short-lived `stepup_token` in memory and pass it in the mutation request; edge function validates it before writing.
- Transaction PIN: add optional `transaction_pin_hash` column to `profiles` (nullable) + settings screen to set/change PIN (also step-up gated once first set).

## 4. Wallet action edge-function errors (Add Money, Payment Links, Send Money)
Diagnose then fix. Likely causes based on current signatures:
- **Add Money** (`wallet-topup-initiate` — verify it exists; if request payload lacks `amount`, `user_id`, `description` it 400s). Fix client call in `Wallet.tsx` to send correct body and read `authorization` header.
- **Payment Links** (`wallet-payment-link-create`): ensure body includes `title`, `amount`, `expires_at`, `max_uses`; server should derive `user_id` from JWT, not client.
- **Send Money** (`wallet-transfer` / `wallet-send`): ensure recipient lookup uses phone→user_id RPC and posts `wallet_post_entry` twice (debit sender, credit recipient) atomically with matched `reference`.
- Add zod validation + clear 400 messages so future breakage is obvious.
- Verify each with `supabase--curl_edge_functions` after fix.

## 5. Property Assessment → checkout-first flow
Current: Submit Request creates the application, then (maybe) prompts payment.
New:
- In `src/pages/shared/PropertyAssessmentsPage.tsx`, on **Submit Request**:
  1. Read fee from `feature_flags` where `feature_key='property_assessment'` (`fee_amount`, `fee_enabled`).
  2. If fee > 0: create a `pending_assessment_draft` row (new table) with the form payload, then call `paystack-checkout` with `payment_type='property_assessment'` and `metadata.draft_id`.
  3. Redirect to Paystack, return to `/assessments/confirm?reference=...`.
  4. On successful `verify-payment`, edge function reads the draft and inserts into `property_assessment_applications`, moves into normal workflow, deletes the draft.
- If fee = 0 (disabled), keep current direct-submit path.

## 6. Landlord Dashboard: Management Support → Premium Service
- Rename sidebar item in `src/components/LandlordLayout.tsx` and page title in `src/pages/landlord/LandlordManagementSupport.tsx` from "Management Support" → "Premium Service".
- Keep route the same (`/landlord/management-support`) but add alias `/landlord/premium-service`.
- Page must display, per property with an assigned agent:
  - Agent name, phone, photo (from `agent_assignments` + `agent_staff`).
  - Property address and management status (`property_management_log.status`).
  - Subscription expiry from `premium_subscriptions.expires_at`.

## 7. Admin Portal — Engine Room additions
Extend `feature_flags` seed data + Engine Room UI to cover every new payment/subscription feature added recently:
- `premium_service_landlord`, `premium_service_tenant`, `property_assessment`, `safety_report_priority`, `rent_card_download`, `wallet_topup`, `wallet_withdrawal`, `wallet_send`, `wallet_payment_link`, `viewing_request`, `complaint_filing`, `rent_increase_request`, `termination_request`, `renewal_request`.

Each row supports (columns already exist or add via migration):
- `is_enabled` (toggle)
- `fee_amount` + `fee_type` ('fixed' | 'percentage')  ← add `fee_type` column
- `billing_frequency` ('one_time' | 'monthly' | 'yearly')  ← add column
- `revenue_split_json` (jsonb: `[{destination, percentage}]`)  ← add column
- `payment_destination` ('platform' | 'office' | 'landlord' | 'split')  ← add column
- `expiry_days`, `renewal_days`, `grace_period_days`  ← add columns

Update `src/pages/super-admin/EngineRoom.tsx` (or equivalent admin flags page) with a per-feature editor for these fields. Edge functions that charge fees must read from `feature_flags` at request time (no hardcoded amounts).

## Technical Details

**New migration:**
- `feature_flags`: add `fee_type`, `billing_frequency`, `revenue_split_json`, `payment_destination`, `expiry_days`, `renewal_days`, `grace_period_days`.
- `profiles`: add `transaction_pin_hash text`.
- New table `pending_assessment_drafts (id, user_id, property_id, form_data jsonb, reference text, created_at)` with RLS (owner only) + service_role.
- Seed new `feature_flags` rows listed above.

**New edge functions:**
- `verify-user-credential` — checks password or PIN, issues short-lived stepup_token (HS256 JWT, 5 min TTL, stored server-side in a small `stepup_tokens` table or Redis-less: signed with `SESSION_SECRET`).
- `verify-payment` extension: on `payment_type='property_assessment'`, promote draft to `property_assessment_applications`.

**Files touched (est.):**
- New: `PremiumServiceLanding.tsx`, `PayoutStepUpDialog.tsx`, `verify-user-credential/index.ts`, migration file.
- Edited: `Index.tsx`, header nav, `App.tsx`, `Wallet.tsx`, `PaymentSettings.tsx`, `PropertyAssessmentsPage.tsx`, `LandlordLayout.tsx`, `LandlordManagementSupport.tsx`, `EngineRoom.tsx`, `feature_flags` seed, wallet edge functions (`wallet-topup-initiate`, `wallet-payment-link-create`, `wallet-transfer`), `verify-payment`.

## Suggested order
1. Engine Room schema + seed (unblocks fee reads).
2. Wallet edge-function fixes + withdrawal payout detection.
3. Property Assessment checkout-first.
4. Homepage Premium Service link + landing.
5. Landlord "Premium Service" rename + agent display.
6. Payout step-up auth (last — most invasive UX).

Approve to proceed, or tell me which subset to tackle first.