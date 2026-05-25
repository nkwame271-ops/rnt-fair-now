
# RentCare Assistance — Implementation Plan

Formal name on every page header: **CFLED-NUGS RentCare Common Fund**.

## 1. Feature flag + Engine Room

Add one row to `feature_flags`:
- `feature_key = rentcare_assistance`, `category = student`, `label = RentCare Assistance`, `fee_amount = 75`, `fee_enabled = true`, `is_enabled = true`.
- Description field reused for the **UMB referral link** (free-text URL).
- Surfaces automatically in Engine Room → Student section, Super Admin features, and Role Features tabs (existing tabs read by category).

Per-role visibility uses the existing `module_visibility_config` table (Student=ON by default; Tenant/Landlord/Nugs admin=OFF). Engine Room already renders the matrix.

Two extra small toggles stored as additional feature_flag rows in `general` category (so Engine Room renders them as plain switches):
- `rentcare_allow_umb_edit` (allow UMB account correction after submission)
- `rentcare_admin_export_enabled`

Application-fee amount is **read live from `feature_flags.fee_amount` for `rentcare_assistance`** — never hardcoded.

## 2. Database

New tables (migration):

- **`rentcare_applications`** — one row per student application.
  Fields: id, applicant_user_id, reference (auto `RC-YYYYMMDD-#####` via new sequence), status (enum below), payment_status, payment_reference, receipt_id, fee_amount_snapshot, amount_requested, deadline, urgency, reason, previous_support_history, accommodation_type, provider_name, provider_contact, accommodation_location, total_fee, amount_paid, outstanding_amount, institution, campus, student_id_code, programme, level, gender, region, address, ghana_card_no, guarantor_json, consent_accepted_at, consent_ip, umb_account_name, umb_account_number, umb_branch, umb_account_type, umb_account_created_on, umb_confirmation_screenshot_path, umb_submitted_at, admin_notes, decision_reason, disbursed_at, version (optimistic lock), created_at/updated_at.

- **`rentcare_documents`** — uploaded files (student_id, admission_proof, invoice/rent_demand, umb_confirmation, other). Storage bucket `rentcare-docs` (private, RLS).

- **`rentcare_status_history`** — every status change with from/to, actor, role, note, IP/device.

- **`rentcare_messages`** — admin↔student inbox (subject, body, sender_user_id, sender_role, attachments).

- **`rentcare_audit_log`** — full audit (event_type, actor_user_id, role, old_value, new_value, ip, device, occurred_at) for every event listed in spec §12.

Status enum (Postgres):
`draft, awaiting_application_fee_payment, paid_and_submitted, awaiting_umb_account_number, umb_account_submitted, under_cfled_review, under_nugs_validation, sent_to_umb, more_information_required, approved, declined, disbursed, closed`.

Add `umb_account_*` fields to `profiles` (writeable only by student; mirrored to application on submission).

RLS:
- Students: SELECT/INSERT/UPDATE own application while in `draft` or when adding UMB details (gated by `rentcare_allow_umb_edit` for post-submission edits).
- NUGS staff (`is_nugs_user`) AND admin staff (`is_main_admin` / `is_super_admin`): full read; UPDATE restricted to status, admin_notes, decision_reason, hearing-style fields via a `rentcare_admin_update` RPC with optimistic-lock (same pattern as `update_complaint_with_version`).
- `rentcare_audit_log` insert-only via triggers/RPC, read by admins only.

Trigger: every UPDATE on `rentcare_applications` writes to `rentcare_status_history` (when status changes) and `rentcare_audit_log`.

## 3. Payment flow (reuse existing infrastructure)

New `payment_type = "rentcare_application_fee"` wired into:
- `paystack-checkout` (loads `fee_amount` from feature_flags; metadata carries `application_id`).
- `_shared/finalize-payment.ts` — on success: set application `payment_status = paid`, `status = paid_and_submitted`, generate receipt via existing `generate_receipt_number()`, link `receipt_id`. Idempotent (single application per reference).
- Default `split_configurations` row inserted for `rentcare_application_fee` (full amount → admin) so existing reconciliation/audit flows work.

Hard rule enforced server-side: `rentcare_applications.status` cannot advance past `awaiting_application_fee_payment` without a confirmed `escrow_transactions` row of type `rentcare_application_fee` and matching `application_id`. Webhook + verify-payment both call into the same finalizer (existing pattern, prevents duplicate ledger posts).

## 4. Frontend — Student experience

Add routes under both `/nugs/*` (student layout) and the equivalent tenant/landlord paths only when their role flag is toggled on (matrix-driven).

New pages:
- `src/pages/student/RentCareOverview.tsx` — programme description + legal notice + "Start Application" CTA.
- `src/pages/student/RentCareApply.tsx` — multi-step form (Personal → Student → Accommodation → Need → Guarantor → Documents → Consent → Review). Uploads to `rentcare-docs` bucket. Zod-validated client + server.
- `src/pages/student/RentCareCheckout.tsx` — shows fee from `useFeeConfig("rentcare_assistance")`, displays legal notice with explicit "I accept" checkbox, calls `paystack-checkout`. On return, verify-payment route already exists.
- `src/pages/student/RentCareUmb.tsx` — appears only after `payment_status = paid`. "Create UMB Account" button uses link from feature flag description. Form for UMB account name/number/branch/type/date/screenshot. On submit, updates application + `profiles.umb_*`.
- `src/pages/student/RentCareDashboard.tsx` — list + detail with reference, payment status, application status, UMB status, amount, date, inbox, download receipt PDF, "Update UMB details" (if flag allows). Progress stepper: Application → Payment → UMB Account → Review → Decision → Disbursement.

Sidebar entry in `NugsLayout` (Student-side nav) with `featureKey: "rentcare_assistance"`. Tenant/Landlord sidebars get the same entry behind module visibility (off by default).

## 5. Frontend — Admin experience

New pages under both regulator and NUGS portals (both manage equally):
- `src/pages/regulator/RentCareManagement.tsx` and `src/pages/nugs/NugsRentCare.tsx` — share one component `<RentCareAdminConsole role="regulator|nugs">`. Lists applications with dashboard counts (by status), filters, payment/UMB columns.
- Detail drawer: application data, document gallery, receipt, status timeline, messages, admin notes. Actions: view, send message, request more info, mark under review (NUGS validation or CFLED review variant), sent to UMB, approve, decline, mark disbursed. Each calls `rentcare_admin_update` RPC (optimistic lock).
- Export buttons (gated by `rentcare_admin_export_enabled`): PDF (jspdf — full application + docs list + payment ref + UMB + timeline + notes), CSV and XLSX (SheetJS) with the columns listed in spec §10.

Added to Engine Room sidebar and Super Admin dashboard tile (counts).

## 6. Legal notice + Audit

Legal-notice text from spec §11 lives in a single shared constant `src/lib/rentcare/legalNotice.ts` and is shown verbatim on checkout. Acceptance writes `consent_accepted_at`, `consent_ip` and an audit-log row.

All §12 events logged via a small helper `logRentCareAudit(event, oldValue, newValue)` on both client (for UI events like "viewed", "exported") and inside the edge functions / triggers for state changes. IP/device captured from request headers when present.

## 7. Implementation order

1. Migration: tables, enums, sequence, RLS, triggers, status-history trigger, feature_flag seed rows, `rentcare-docs` storage bucket + policies, `split_configurations` row.
2. Edge function deltas: extend `paystack-checkout` payment_type whitelist; extend `_shared/finalize-payment.ts` rentcare branch; new `rentcare-admin-update` edge function (optimistic-lock RPC wrapper).
3. Student UI (overview → apply → checkout → UMB → dashboard) wired to feature flag + fee config.
4. NUGS + Regulator admin console (shared component) + exports.
5. Engine Room: surface new fee/visibility/UMB-link/export-toggle rows (no new code — existing categorised renderer picks them up).
6. Sidebar entries + module visibility defaults (Student ON, others OFF).
7. Audit log writes throughout; smoke-test full happy path with one demo student.

## Technical notes

- Receipts: reuse `generate_receipt_number()` + existing receipts table; downloadable from student dashboard via existing receipt PDF renderer.
- All currency strings rendered as `GHS X,XXX` per project memory.
- Optimistic locking on `rentcare_applications.version` follows the `update_complaint_with_version` pattern already in the DB.
- No changes to the Supabase types file — it regenerates after migration.
- Visibility: any user whose role flag is OFF will not see the menu entry (existing `featureKey` mechanism in NugsLayout/TenantLayout/LandlordLayout).
