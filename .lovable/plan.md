# Fix Package — Admin, Landlord, Wallet, Agreements, Pagination, Developer

Grouped by area. Each item lists the change and where it lands.

## 1. Admin Portal — Engine Room coverage

Ensure every new payment-enabled feature has a `feature_flags` row with fee, percentage, billing frequency, expiry, and revenue split editable from the Engine Room UI.

- Register / verify rows for: `agent_application_fee`, `premium_service`, `property_assessment`, `wallet_topup`, `rent_card`, `landlord_registration`, `complaint_filing`, `viewing_request`, `rentcare`.
- Extend `FeatureAdvancedDialog` so all payment features expose the full config surface (fee, %, frequency, expiry, split destinations). Where a field doesn't apply, hide it — don't hardcode.
- Every checkout edge function (`premium-checkout`, `assessment-checkout`, `wallet-topup`, `paystack-checkout`, `approve-agent-application` fee lookup) must read fee/splits from `feature_flags` — no hardcoded amounts.

## 2. Admin Portal — Cashbook permissions

Cashbook currently shows global totals. Change to mirror Escrow Ledger scoping:

- Super Admin → all rows.
- Office / Main admin → rows for their office (via `office_id` / `admin_staff.office_id`).
- Summary cards (Opening, In, Out, Current, Reconciled) recomputed from the filtered rowset, not global.
- Apply RLS + client-side scope filter in `CashbookReport.tsx` using `useAdminScope`.

## 3. Agent Portal — Application paywall

- Add `agent_application_fee` feature flag (default GHS 100, configurable).
- `AgentRegister.tsx` Submit → create `agent_applications` row with `status='awaiting_payment'` → redirect to Paystack checkout via a new/extended edge function → on webhook success flip to `status='pending'` for admin review.
- Admin approve action reads the paid application only.

## 4. Complaints — Case numbering + Forms 7/33

- Single generator: on complaint creation, allocate `case_number = <PREFIX> NNN/YYYY` via `car_case_counters` (already exists) and persist to `complaints.case_number`. `CAR` prefix read from `platform_config.car_case_prefix` (already added) so it's changeable.
- Form 7, Form 33, receipts, notifications, and case records all read `complaints.case_number` — no re-allocation.
- **Form 7 layout**: reduce body to 12pt, labels 14pt, remove the dotted underlines on numbered fields (they force line height), tighten margins so a typical complaint fits on one A4 page. Add page-fit test with a long narrative.
- **Form 33**: audit the data mapping — ensure `parties_line`, `person_summoned`, `complaint_category`, `hearing_*`, `complainant_*`, `rent_office`, `rent_officer`, `issued_*` all pull from the complaint + hearing record. Fix any `—` placeholders that are actually populated in the DB.

## 5. Landlord Portal — Digital Rent Cards

- `DigitalRentCardView.tsx` enrichment: when `rent_cards.tenancy_id` exists, always join `tenancies → profiles(tenant) + units + properties` and hydrate tenant name, unit label, property address regardless of whether `tenant_user_id` is set on the card row.
- Backfill script: for cards missing `tenancy_id` but with matching `serial_number` on an active tenancy, link them.

## 6. Landlord Portal — Property Assessment checkout

- Root-cause the "non-2xx" from `assessment-checkout` by logging the actual error (read `supabase--edge_function_logs`). Common suspect: fee lookup from `feature_flags` returns null when the row is missing.
- Add `property_assessment_fee` to Engine Room under Platform Fees.
- Guarantee the function returns a 200 with a structured error if fee flag is missing, plus surface a user-friendly toast.

## 7. Landlord Portal — Premium Service

- Fix `premium-checkout` non-2xx (same pattern: read fee from `feature_flags.premium_service`, structured errors).
- Premium dashboard (new/updated component) shows: assigned agent avatar, agent ID, phone, email, service status, subscription status, expiry, managed property.
- Actions: Call (`tel:`), SMS (`sms:`), Request Service (creates `management_task_assignments` row), Revoke Access, Request Agent Change.
- Service requests appear in Agent dashboard; agent completes via existing landlord workflows.
- Agent role scoping: block edits to `landlord_payment_settings`, `wallet_payout_accounts`, `profiles.phone/email` (verified), password, and transaction PIN via RLS + UI hide.

## 8. NAFLIS Wallet — Add Money

- Pull `wallet-topup` edge function logs, identify the actual failure (likely Paystack init payload or missing fee flag / metadata).
- Ensure fee split reads from `feature_flags.wallet_topup`. Return 200 with a structured error on any Paystack failure.

## 9. Agreements

1. **Existing Tenancy** → agreement not visible to tenant. `DeclareExistingTenancy` writes `tenant_user_id = null` when no match; the tenant-side auto-link by phone (already added in `MyAgreements`) needs verification, plus a notification on first link.
2. **Add Tenant** → verify tenancy row + `tenancy_signatures` landlord row insert path; confirm surfacing in tenant dashboard.
3. **Draft agreements → Terms not loading**: `getActiveAgreementTemplate` must load `agreement_template_config` even for draft/existing variants and inject T&Cs into the PDF.
4. **"Both must sign" error** — when tenants accept via UI, insert a `tenancy_signatures` row with `signer_role='tenant'`. Same for landlord path. `renderTenancyAgreement` already reads that table.

## 10. Pagination across large tables

Add server-side pagination (LIMIT 100, offset, count) with page controls to:

- `RegulatorLandlords`, `RegulatorTenants`, `RegulatorReceipts`, `RegulatorCashbook`, `ManageRentCards` (Pending + Assign tabs), plus any other list rendering >100 rows.
- Fix responsiveness: wrap all tables in `overflow-x-auto` container; remove hover row transforms that shift layout — use `bg-muted/50` only.

## 11. Developer Accounts / API Access — password exposure

- Audit `DeveloperAccounts.tsx` and `ApiAccessRequests.tsx`: remove any rendering of `password`, `password_hash`, or plain-text credential fields.
- Ensure API responses / edge functions don't return raw credentials — mask or omit.

## Technical notes

- Edge function debugging uses `supabase--edge_function_logs` to see the real 5xx cause before "fixing" blind.
- All new fees/splits stored on `feature_flags` (`fee_amount`, `fee_percentage`, `billing_frequency`, `expiry_days`, `revenue_split` jsonb). No further schema changes required for #1.
- New DB work needed: none for pagination; #9.4 needs the tenant/landlord acceptance handlers to insert `tenancy_signatures`.

## Out of scope for this pass

Any item where the underlying edge-function log doesn't confirm the root cause will be surfaced back to you with the exact error payload rather than guessed at.