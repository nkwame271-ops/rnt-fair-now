# Rent Control Digital Platform — Consolidated Fix & Feature Plan

Scope is large, so I've grouped work into ordered phases. Each phase is self-contained and can be shipped/verified independently. Say "Next" after each to proceed.

---

## Phase A — Critical Bug Fixes (ship first)

**A1. Agent Application flow**
- Add password field to `AgentRegister.tsx`; create auth user via signup so applicants can sign in.
- Replace numeric region codes in dropdown with actual Ghana region names (load from `region_codes` table or static list).
- Fix Approve action in `RegulatorAgents` — audit `approve-agent-application` edge function (likely missing role grant or throwing silently). Restore full flow.

**A2. NAFLIS Wallet**
- "Add Money" → "Failed to send request to Edge Function": audit `wallet-topup-init` (function name mismatch, missing deploy, or CORS). Fix + redeploy.
- `wallet-list-banks` returns empty: log the Paystack response; ensure MoMo constants always return; fall back to static bank list if Paystack call fails.
- Withdraw: add two-option chooser — (a) use account already saved in Payment Settings (auto-load from `landlord_payment_settings`), (b) select existing/new payout account.

**A3. Digital Rent Cards (downloaded PDF)**
- `generateRentCardPdf.ts`: join landlord (`profiles.full_name`), tenant (`profiles.full_name`), unit (`units.unit_number`) so PDF shows real names instead of "-".
- Payment history table columns: Month (MMM/YYYY), Amount Paid (GHS), Receipt # (link/number). Data source: `payment_receipts` joined to `rent_payments`.

---

## Phase B — Property Assessment overhaul

- **Application form**: add location capture with Google Maps picker, "Use live location" button, and optional GhanaPost GPS field (reuse `PropertyLocationPicker` + `ghana_post_gps_cache`).
- **Tenant scope**: allow tenants to apply for both occupied AND intended-to-rent properties (remove tenancy-required guard; add "Property I intend to rent" mode with address entry).
- **Checkout-first**: `Submit Request` → `assessment-checkout` → branded modal → on success `assessment-verify` creates the `property_assessment_applications` row. Nothing persists before payment. Admin queue only shows paid apps.
- **Engine Room**: register `assessment_application_fee` and `assessment_renewal_fee` feature flags with full advanced config (already partly done via FeatureAdvancedDialog).

---

## Phase C — Premium Service (merge with Management Support)

- Delete/redirect `LandlordManagementSupport` → new unified Premium Service page.
- Workflow: Subscribe → branded checkout → verify → `premium_subscriptions` activated → auto-assign agent (round-robin from approved `agent_staff` in same region) → notify agent + landlord.
- Rename "Yearly Fee" → "Fee"; billing cycle sourced from `feature_flags.billing_frequency` (default monthly).
- Landlord dashboard card shows: agent avatar, name, ID, phone, email, service/subscription status, expiry date, managed property. Buttons: Call, SMS, Request Service, Revoke Access, Request Agent Change.
- Service requests → new `agent_service_requests` (or reuse `management_task_assignments`) → appear on agent dashboard.
- Enforce agent restrictions via RLS + UI guards: block edits to `landlord_payment_settings`, `wallet_payout_accounts`, password, transaction PIN, verified contacts.

---

## Phase D — Payment Settings Security (Landlord + Tenant)

- Any mutation to `landlord_payment_settings`, `wallet_payout_accounts`, password, PIN, or verified phone requires:
  1. Password OR Transaction PIN confirm (existing `AdminPasswordConfirm` pattern extended).
  2. OTP to verified phone via `send-otp` + `verify-otp`.
- Add reusable `<SensitiveActionGate>` wrapping the save handlers. Apply to Payment Settings pages for Landlord AND Tenant.

---

## Phase E — Complaints: Forms 7 & 33, Case Numbers

**E1. Auto Case Number `CAR NNN/YYYY`**
- New `case_number_sequences` table: `(prefix text, year int, last_number int)` with unique `(prefix, year)`.
- Postgres function `next_case_number(prefix)` — atomic increment, resets on new year.
- Trigger on `complaints` insert to stamp `case_number` if null. Retained across Form 7/33/receipts/notifications.
- Engine Room: add configurable prefix (default `CAR`) stored in `platform_config`.

**E2. Forms 7 & 33 auto-fill**
- Refactor `lib/pdf/form7.ts` and `form33.ts` to derive complainant/respondent names from `complaints` joined to `complaint_witnesses` + `profiles`.
- Validation: refuse to generate/finalize if complainant name OR respondent name is blank; surface toast.
- Only editable on Form 33: hearing date/time/venue/officer.
- Increase font sizes: labels/headings ≥20pt, body ≥18pt, Form 33 title + summon body larger and prominent. Better spacing to fill A4.

---

## Phase F — Landlord Registration → Monthly Subscription

- Migration: add `registration_expires_at`, `registration_status` (active/expired/pending) to `landlords`; drop 8-year logic.
- On paid registration → set `expires_at = now() + 30 days`.
- Daily cron (Supabase scheduled function) marks expired and blocks landlord routes until renewed.
- Renewal flow: banner + "Renew Registration" branded checkout → extends 30 days.
- Engine Room: `landlord_registration_fee` flag with billing_frequency=monthly.

---

## Phase G — Engine Room: full feature coverage

- Register feature_flags rows for every new payment-enabled feature not yet listed:
  - `premium_service_subscription`, `assessment_application_fee`, `assessment_renewal_fee`, `student_registration_fee`, `naflis_wallet_monthly_fee`, `landlord_registration_fee`, `rent_management_deduction` (5%), `maintenance_deduction` (5%), `agent_payments`.
- Each row uses existing `FeatureAdvancedDialog` fields: fee_type, amount/percentage, billing_frequency, revenue_split_json, payment_destination, expiry_days, renewal_days, grace_period_days, effective_date, status, exemptions_json.
- All checkout/deduction code reads live from `feature_flags` — no hardcoded amounts.

---

## Phase H — Platform Escrow (Super Admin) — segmented ledgers

Extend `/regulator/platform-escrow`:
- Separate buckets/tabs: Premium Service, NAFLIS Wallet, Rent Management (5%), Maintenance (5%), Agent Payments, Assessment Fees, Registration Fees, Other.
- Each bucket: total, breakdown table, CSV export, date filter.
- Reads from `escrow_splits` filtered by `revenue_category` (new column populated by fee engine).

---

## Phase I — Automated Cashbook (Escrow & Revenue + Receipts)

**One payment = one ledger = one receipt = one cashbook row.**

- New `cashbook_entries` table: date, receipt_no, payment_ref, description, category, payer, office, channel, method, money_in, money_out, running_balance, reconciliation_status, recorded_by.
- Populated by a trigger on `payment_receipts` insert (idempotent via unique constraint on payment_ref).
- New `CashbookReport` component under Regulator Escrow & Revenue + Receipts pages.
- Filters: daily/weekly/monthly/custom, office, payment type/method, reconciliation.
- Header/footer: opening balance, totals, closing balance, reconciled/unreconciled totals.
- Exports: PDF (with watermark, page numbers, timestamp, ref no.), Excel (xlsxwriter), print CSS.
- Reconciliation dedupe: cashbook trigger checks `payment_ref` uniqueness so re-runs don't double-post.

---

## Phase J — Landlord Safety Reports

- Extend safety report form used by Landlord role with the same fields already added to Tenant/Shared form: map pin, written directions, nearest landmark, person involved, description, date/time, photo/video upload, anonymous toggle.
- Reuse `ReportSafetyIssue` shared component — already implemented; verify Landlord entry passes correct `role` and category options.

---

## Suggested Ship Order

1. **Phase A** (critical bugs unblocking users)
2. **Phase G** (Engine Room flags — prerequisite for everything paid)
3. **Phase B** (Assessments)
4. **Phase C** (Premium Service merge)
5. **Phase F** (Landlord monthly subscription)
6. **Phase D** (Payment settings security)
7. **Phase E** (Complaints + case number)
8. **Phase H** (Platform Escrow segmentation)
9. **Phase I** (Cashbook)
10. **Phase J** (Landlord safety fields)

---

## Technical Notes

- All new tables get `GRANT` + RLS + `updated_at` trigger per project standard.
- Case numbers, cashbook posting, and subscription expiry use Postgres functions/triggers (not client code) for atomicity.
- Agent restrictions enforced by RLS `has_role('agent')` checks blocking sensitive columns, plus client guards.
- All new payments route through existing `BrandedCheckoutHost` — no hosted-page fallbacks.
- Fee configuration always read live via `useFeatureFlag`/server helper — never hardcoded.

Reply "start" to ship Phase A, or name specific phases to prioritize differently.
