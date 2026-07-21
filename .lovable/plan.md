# Fix Plan — Rent Control Digital Platform

Grouped by portal. Each item includes the diagnosis approach and the concrete fix.

---

## ADMIN PORTAL

### A. Engine Room

**A1. Feature/payment coverage for all new features**
- Audit `feature_flags` rows against the newly built features. Add missing flags for: Property Assessment fee, Premium Service fee, Wallet top-up fee, Wallet withdrawal fee, Rent Management deduction, Digital Rent Card issuance, Agent Program, Landlord Registration (monthly), Complaint filing fees.
- Each flag row must have: `enabled`, `fee_type` (fixed/percentage), `fee_amount`, `billing_frequency`, `expiry_days`, `revenue_split_json`, `payment_destination`.
- Register these features in the Engine Room UI so they show up in the flag list automatically (fix the registry array in the Engine Room page).

**A2. Advanced Settings reset bug**
- Diagnosis: `FeatureAdvancedDialog` initializes local form state from props only on mount; after save it invalidates the query but re-opening reads stale defaults because the dialog isn't re-syncing when `feature` prop changes, OR the save payload isn't merging with existing `revenue_split_json`.
- Fix: reset local state via `useEffect` on `feature.id`/`feature.updated_at`; ensure the save mutation reads the full row, merges the advanced fields, and writes back the full JSON. Confirm the read query returns the just-saved values (no `.select()` mismatch).

### B. Cashbook — "No entries in range" for all ranges

- Diagnosis: check whether `cashbook_entries` actually has rows (backfill may have failed silently, or the trigger fires on a status value the receipts table doesn't use, e.g. `completed` vs `paid`).
- Fix:
  - Query `cashbook_entries` count and the distinct `status` values on `payment_receipts`.
  - Rewrite `post_receipt_to_cashbook()` trigger to fire on any receipt whose payment is reconciled (join to `escrow_transactions.escrow_status='completed'`) instead of a receipt-status enum.
  - Re-run backfill from all completed escrow transactions.
  - Verify the report component's date filter uses `entry_date` (not `created_at`) and that the RLS policy permits Regulator/Super Admin reads.

### C. Agent Portal

**C1. Site resets to homepage after agent registration / role clicks**
- Diagnosis likely: `AgentRoute` (or `AgentRegister`) navigates to `/` on a transient auth state, or a top-level effect in `App.tsx`/`RoleSelect` redirects when it sees no matching role for the newly signed-up user. Also possible: `signUp` creates a session without a `profiles` row, and `ProtectedRoute` bounces to `/`.
- Fix:
  - After agent signup, insert a `profiles` row and an `agent_applications` row atomically; do not sign the user in until application is submitted, OR sign in and route to `/agent/register?status=pending`.
  - `AgentRoute`: when `agent_staff` row is missing but an `agent_applications` row exists, route to a "Pending approval" page instead of bouncing.
  - `RoleSelect`: remove the effect that force-redirects users with unknown role back to `/`.

**C2. Assign approved agents to properties from Admin → Property Management**
- Add an "Assign Agent" action on each property in the admin Property Management list.
- Dialog lists active `agent_staff` filtered by the property's region; on select, inserts into `agent_assignments` and notifies the agent.

### D. Complaints

**D1. Form 7 / Form 33 auto-fill (hard rule)**
- Extend `buildAutofillContext` to pull: complainant(s), respondent(s), additional parties (from `complaint_witnesses` / joined party tables), addresses, phones, premises, category, summary, assigned office, related Form 7 fields, and the case number.
- Block finalize/generate when complainant OR respondent name is empty — surface a toast pointing back to the complaint record.
- Remove editable name fields from the form editor; only hearing date/time/venue and officer remain editable on Form 33.
- Editing the complaint record must re-render forms with fresh values (invalidate the form query when the complaint updates).

**D2. Layout & fonts (A4)**
- Update `form7.ts` and `form33.ts`: labels/headings ≥ 20pt, body 18pt, FORM 33 heading and summons body larger/bolder than surrounding text, increased paragraph spacing, balanced margins.

**D3. Automatic case number**
- Confirmed: `car_case_counters` + `issue_car_case_number()` exists. Wire it so that:
  - Every new complaint (admin-assisted or user) calls the function and stores the number on the complaint row.
  - Prefix `CAR` is read from `platform_config.car_case_prefix` (editable in Engine Room).
  - Sequence resets at year rollover (already handled by counter's `year` column).
  - Number is persisted and reused on Form 7, Form 33, receipts, notifications.

---

## LANDLORD PORTAL

### A. Digital Rent Cards showing "-"
- Diagnosis: `DigitalRentCardView` enrichment joins on wrong FK, or `rent_cards` rows lack `tenant_id`/`unit_id`. Verify with a `read_query` against a sample card.
- Fix: rewrite the enrichment query to join `tenancies` → `tenants`/`profiles` and `properties`/`units`, and fall back to `tenancies` when `rent_cards` is missing the direct FK. Mirror the fix in `generateRentCardPdf.ts`.

### B. Property Assessment — checkout 400
- Pull the `assessment-checkout` edge function logs for the failing reference; inspect payload validation (Zod) and Paystack init call.
- Likely causes: missing `fee_amount` from feature_flags, missing user email, or unhandled null `property_id`. Fix validation + fallback fee from `feature_flags` (`property_assessment_fee`).
- Add `property_assessment_fee` (fixed) to Engine Room seed if missing.

### C. Premium Service

**C1. Subscribe/Pay 400**
- Pull `premium-checkout` logs; fix the same class of bug (fee resolution from `feature_flags.premium_service_fee`, email fallback, property_id validation).

**C2. Dashboard fields**
- Extend the assigned-agent card to show: photo, agent id, phone, email, service status, subscription status, expiry date, property being managed.
- Actions: Call, SMS (`tel:` / `sms:`), Request Service (creates a `management_task_assignments` row visible in the agent's dashboard), Revoke access (soft-cancel `premium_subscriptions` + close `agent_assignments`), Request agent change (queues a re-assignment request for admin).
- Enforce agent permission boundaries via RLS: agents cannot update `landlord_payment_settings`, `wallet_payout_accounts`, `profiles.phone/email`, or auth password. Add explicit deny policies where the current policy permits UPDATE for staff.

### D. NAFLIS Wallet — Add Money 400
- Pull `wallet-topup` logs to see the exact upstream error (missing `wallet_id`, currency, or Paystack payload issue).
- Fix input schema, ensure a `wallets` row is created lazily for first-time users, and return a friendly error.

---

## Verification pass
- Reproduce each fix from the preview (agent signup → portal, cashbook date filter, complaint → form generation, assessment/premium/wallet checkout) and check edge-function logs are clean.

---

## Technical notes (internal)

- Files to touch (initial set): `src/pages/regulator/EngineRoom*.tsx`, `src/components/FeatureAdvancedDialog.tsx`, `src/components/regulator/CashbookReport.tsx`, DB trigger `post_receipt_to_cashbook`, `src/pages/agent/AgentRegister.tsx`, `src/components/AgentRoute.tsx`, `src/pages/RoleSelect.tsx`, admin Property Management page (add Assign Agent), `src/lib/complaintForms.ts` / `formAutofill.ts`, `src/lib/pdf/form7.ts`, `src/lib/pdf/form33.ts`, complaint creation paths (call `issue_car_case_number`), `src/components/rentcards/DigitalRentCardView.tsx`, `src/lib/generateRentCardPdf.ts`, edge functions `assessment-checkout`, `premium-checkout`, `wallet-topup`, `src/pages/shared/PremiumServicePage.tsx`, RLS migrations for agent permission boundaries.
- New DB objects: possible `platform_config` row `car_case_prefix`; RLS deny policies on sensitive landlord tables for agent role; missing `feature_flags` rows for assessment/premium/wallet fees.
- No changes to auto-generated Supabase files.

## Execution order
1. Diagnose edge-function 400s (assessment/premium/wallet) via logs + fix.
2. Fix Advanced Settings persistence + register missing feature flags.
3. Fix Cashbook trigger + backfill.
4. Fix agent signup redirect loop + add Admin "Assign Agent".
5. Complaint auto-fill hard rule + font/layout bump + wire CAR numbering everywhere.
6. Rent Card auto-fill (landlord/tenant/unit).
7. Premium dashboard expansion + agent permission RLS.
8. End-to-end verification.
