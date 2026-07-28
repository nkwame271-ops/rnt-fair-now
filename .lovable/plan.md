# Fix Plan — Rent Control Platform Batch

## A. Engine Room — configurable payment features

Register/verify feature flags with full config surface (fee, %, frequency, expiry, split, destination) for:
- `naflis_wallet` (toggle)
- `wallet_topup_fee` (payment config)
- `property_assessment_fee` (payment config, category: platform_fees)
- `premium_service_fee` (payment config, category: platform_fees)
- `agent_application_fee` (payment config, default 100 GHS)

Ensure `FeatureAdvancedDialog` reads these; checkout edge functions read fee/split from `feature_flags` instead of hardcoding.

## B. Cashbook — scoped permissions

- Apply `useAdminScope()` inside `RegulatorCashbook.tsx` (and `CashbookReport.tsx`).
- When `scopeOfficeId` is set, filter `cashbook_entries` by that office; when unscoped (super/main), no filter.
- Recompute the 5 summary cards (Opening/In/Out/Current/Reconciled) from the filtered rows only.

## C. Agent Portal paywall

- `AgentRegister.tsx`: on submit, create `agent_applications` row with `status='awaiting_payment'`, then invoke `agent-apply-checkout` edge function → Paystack init using `agent_application_fee` flag (default 10000 pesewas).
- New edge function `agent-apply-checkout` + verify hook flips status to `pending_review`.
- Admin approve unchanged; blocks approval while `awaiting_payment`.

## D. Complaints — case numbering & Form 7/33

- Central helper: on complaint creation, generate `{prefix} NNN/YYYY` via `generate_complaint_ticket()` using `platform_config.car_case_prefix` (already exists). Persist as `complaints.case_number`.
- Form 7 and Form 33 PDFs read `complaints.case_number` — same value on both.
- Verify Form 33 pulls all fields (complainant/respondent/property/summary) from the complaint record.
- Confirm Form 7 one-page A4 fit (already reduced fonts; verify).

## Landlord Portal

### A. Digital Rent Cards — tenant linkage
- `DigitalRentCardView.tsx`: enrich display by joining `tenancies` → `profiles` → `units` fallback chain.
- One-time backfill: for `rent_cards` with null `tenant_user_id`, populate from `tenancies.tenant_user_id` where linked.

### B. Property Assessment — "unauthorized"
- Root cause: `assessment-checkout` requires JWT but the client isn't sending Authorization header or session is missing. Fix: pass `Authorization: Bearer <token>` via `supabase.functions.invoke` (auto with SDK) and `getClaims()` validation in function.
- Read fee from `property_assessment_fee` flag; add flag under `platform_fees` category.

### C. Premium Service — "unauthorized" + dashboard
- Same JWT/auth fix in `premium-checkout`; read `premium_service_fee` flag.
- Rebuild `PremiumServicePage.tsx` dashboard (post-activation view) showing: agent photo, ID, phone, email, service status, subscription status, expiry, managed property.
- Actions: Call (tel:), SMS (sms:), Request Service (creates row in `management_task_assignments`), Revoke (sets `agent_assignments.status='revoked'`), Request Change (opens ticket).
- Agent sensitive-action block: enforce in `AgentRoute` + RLS — agents cannot write to `landlord_payment_settings`, `office_payout_accounts`, auth password, transaction PIN, verified phone/email on the landlord's profile.

### D. NAFLIS Wallet — "recipient_user_id required"
- Root cause: `wallet-topup` treats caller as anonymous because it doesn't extract user from JWT. Fix: validate JWT with `getClaims()`, set `recipient_user_id = claims.sub` server-side, do not require it from client.

## Agreement Workflow

1. **Existing Tenancy visibility**: `DeclareExistingTenancy` must set `tenant_user_id` when a matching profile exists (by phone/Ghana card); otherwise store `placeholder_tenant_phone` and rely on the auto-link in `MyAgreements.tsx` (already added). Verify notification is emitted.
2. **Add Tenant**: verify `AddTenant.tsx` sets `tenant_user_id` and inserts a landlord signature row + notification to tenant.
3. **"Both must sign" false positive**: `renderTenancyAgreement` already updated to accept fallback columns. Ensure `Agreements.tsx` (admin) and landlord/tenant final-PDF paths use the same helper. Also verify `tenancy_signatures` insert uses correct `role` values ('landlord'/'tenant').

## Pagination + responsiveness

Add server-side pagination (page size 100) with page controls to:
- `RegulatorLandlords.tsx`
- Tenant Database page
- Receipts pages (landlord + regulator)
- Cashbook (`CashbookReport.tsx` / `RegulatorCashbook.tsx`)
- Rent Cards "Pending and Assign" tab

Fix table hover distortion: wrap wide tables in `overflow-x-auto` and remove row-hover transforms that resize columns.

## Developer accounts — password exposure

- Locate the exact screens rendering plaintext passwords (need pointer: `DeveloperAccounts.tsx` and `ApiAccessRequests.tsx` didn't show one in my earlier read).
- Remove any UI that displays the password; replace with "Reset password" action. Confirm the raw value is not returned by any query/edge function.

## Technical notes

- All checkout edge functions standardize on `200` responses with `{ error }` body so the client can surface real messages.
- Feature-flag reads use `useFeatureFlag`/`useFeeConfig`; cache invalidated on save.
- RLS unchanged except adding a policy set restricting agent writes to sensitive landlord tables.

## Out of scope this batch
Anything requiring you to point at the exact screen (e.g. the developer password display) will be tackled after you share the location.
