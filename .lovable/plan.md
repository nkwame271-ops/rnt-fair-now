## Scope

Three fixes, all verified against the live DB and code — no assumptions:

1. PayStack checkout — registration payments post to escrow but **escrow_splits rows are never created**, so Escrow & Revenue / Internal Ledger show GHS 0.00 even though the transaction count is right.
2. Agreements — Landlords cannot reliably download Draft/Final, and PDFs do not reflect the current Templates configuration.
3. Complaint Command Center — Form 33 must SMS the respondent on every generation path.

---

## 1. Registration revenue shows GHS 0.00 in Escrow & Revenue / Receipts / Internal Ledger

**Diagnosis (confirmed via DB):**
- All `tenant_registration` / `landlord_registration` / `student_registration` rows since 2026-06-08 have `status = completed`, correct `total_amount`, and a valid `metadata.split_plan` (e.g. platform 0 / rent_control 13 / admin 7 / platform 0).
- `payment_receipts` are created (1 per escrow).
- **`escrow_splits` rows = 0** for every one of these escrows. No `payment_processing_errors` row exists, so the insert is failing silently.
- Financial reports sum `escrow_splits.amount` per recipient → zero, which matches the reported symptom.

Root cause: in `supabase/functions/_shared/finalize-payment.ts` the `escrow_splits` bulk insert at the splits step has no error check (`.insert(splitRowsWithStatus)` is followed by `splits = inserted || []` with no `error` capture). The insert is silently dropping the rows for these registration plans. We will (a) capture the error, (b) fix the row construction, and (c) backfill historical rows.

**Fix:**

1. **Backfill historical registrations (since 2026-06-08)** via a one-off migration / SQL repair function:
   - For every `escrow_transactions` row with `payment_type IN ('tenant_registration','landlord_registration','student_registration')`, `status='completed'`, `created_at >= '2026-06-08'`, and no `escrow_splits`:
     - Read `metadata->'split_plan'`.
     - Insert one `escrow_splits` row per plan entry (`recipient`, `amount`, `description`), with `office_id = escrow.office_id` for non-central-pool recipients, `disbursement_status = 'pending_transfer'`, `status='active'`, `release_mode='manual'`, `payout_readiness='pending'`.
     - Skip entries with `amount = 0` only if they are duplicate `platform` rows; keep ledger faithful otherwise.
   - Re-link `payment_receipts.split_breakdown` from `metadata.split_plan` if null.

2. **Patch the live finalize pipeline** (`supabase/functions/_shared/finalize-payment.ts`):
   - Capture and log the error from `.insert(splitRowsWithStatus)` to `payment_processing_errors` (stage `escrow_splits_insert`, severity `critical`).
   - On error, fall back to per-row inserts so a single bad row does not zero the entire ledger entry.
   - Guarantee at least one `escrow_splits` row exists per `completed` escrow before returning, including a sanity check that `sum(splits.amount) ≈ escrow.total_amount` (tolerance 0.01).
   - Add the same protection inside the `paystack-webhook` and `verify-payment` callers (they both already invoke `finalizePayment`, so the fix is centralized).

3. **Investigate the underlying insert failure** while patching:
   - The current split plan for registrations includes two `recipient = 'platform'` rows with `amount = 0`. Probable failure modes to harden against in the row builder:
     - `office_id = 'accra_central'` being passed for non-existent office FK (`escrow_splits.office_id` is `text`, no FK — should be safe, verify).
     - `is_service_fee` defaulting NULL on a NOT NULL column (`is_service_fee` is `boolean NOT NULL`) — confirm the row builder always sets it.
   - Add a unit-style check inside the function: log row count attempted vs inserted; surface mismatch.

4. **Re-verify** after deploy:
   - Run a fresh tenant + landlord registration on staging.
   - Confirm new `escrow_splits` rows appear, Escrow Dashboard / Internal Ledger / Receipts totals all reconcile to actual amount received.
   - Re-run the backfill query and confirm 0 missing-split escrows remain.
   - Super-Admin-only `platform` visibility rules untouched (we use existing `visibleRecipients` helper).

5. **Checkout latency** ("system delays a lot before payment goes through"):
   - Profile `paystack-checkout` for the registration path. The expensive calls are: `determineFee` → `loadAllocation` → `resolveOffice` → `escrow_transactions.insert` → Paystack `/transaction/initialize`. We will:
     - Parallelise the independent reads (`determineFee` + `resolveOffice` + profile lookup) with `Promise.all`.
     - Cache `service_fee_configurations` for the per-request lifetime (already loaded once, just hoist).
     - Return early to the client with the Paystack `authorization_url` before writing optional notification rows (move notifications to fire-and-forget).
   - No behaviour change — purely latency.

---

## 2. Landlord Agreements — Draft + Final download + always-fresh templates

Current behaviour: `src/pages/landlord/Agreements.tsx` shows Draft/Final buttons only when `agreement_pdf_url` / `final_agreement_pdf_url` is non-null, and the PDFs are static snapshots stored at creation time — they do not reflect later changes in `agreement_template_config`.

**Fix:**

1. **Always-available download buttons** for every active or pending tenancy:
   - Draft Agreement: regenerated on click from the current `agreement_template_config` using `src/lib/generateAgreementPdf.ts`, falling back to the stored `agreement_pdf_url` only if regeneration fails.
   - Final Agreement: regenerated on click only when the tenancy has both party signatures; otherwise the button is disabled with a tooltip explaining why.
2. **Single source of truth for templates** — a small helper `getActiveAgreementTemplate()` that:
   - Reads `agreement_template_config` (active row).
   - Reads tenant + landlord + property + unit + signatures.
   - Renders the PDF on demand.
3. Apply the same on-demand rendering inside Tenant, Student (NUGS), and Admin Portal agreement viewers, so every portal reflects the latest template configuration.
4. Keep stored `agreement_pdf_url` for audit/legacy, but the download action always regenerates against current config.

---

## 3. Form 33 — automatic SMS to respondent

Current behaviour: `generateForm33Draft()` (helper) already SMSes respondents. The Form Editor Dialog path (`src/components/regulator/FormEditorDialog.tsx`) calls `generateStatutoryForm("form_33", ...)` directly and skips the SMS. Manual generations therefore do not notify the respondent.

**Fix:**

1. Move the SMS dispatch into `generateStatutoryForm` itself, guarded by `formType === "form_33"`:
   - Resolve respondent phones from the complaint (`respondents[].phone`, falling back to `placeholder_respondent_phone`).
   - Compose the existing summons message ("Rent Control: You have been summoned for Case … Hearing: … at …").
   - Send via `supabase.functions.invoke("send-sms", ...)`, fire-and-forget, with a try/catch so PDF generation is never blocked.
   - Log dispatch to `admin_audit_log` (action `form33_sms_sent`) for traceability.
2. Remove the duplicate SMS block from `generateForm33Draft` (now handled centrally) to avoid double-send.
3. Verify the SMS fires for: editor dialog generation, autogenerate path, and any future caller.

---

## Technical details (non-user-facing)

- New migration: `backfill_registration_escrow_splits` — idempotent SQL function + one-shot `SELECT` execution; bounded to `created_at >= '2026-06-08'`.
- Edge function edits: `_shared/finalize-payment.ts`, `paystack-checkout/index.ts`.
- Frontend edits: `src/pages/landlord/Agreements.tsx`, `src/pages/tenant/MyAgreements.tsx`, `src/pages/nugs/*` agreement viewers, `src/pages/regulator/RegulatorAgreements.tsx`; new helper `src/lib/getActiveAgreementTemplate.ts`.
- Library edit: `src/lib/complaintForms.ts` (centralize Form 33 SMS).
- No schema changes beyond the backfill function. No RLS changes. Super Admin revenue visibility helpers untouched.

## Verification checklist (run after build)

- [ ] DB query: 0 `completed` registration escrows since 2026-06-08 without `escrow_splits`.
- [ ] Escrow Dashboard totals reconcile to `sum(escrow_transactions.total_amount)` for registration types.
- [ ] Internal Ledger shows non-zero per recipient (`rent_control`, `admin`).
- [ ] Receipts page lists registration receipts with correct amounts.
- [ ] Fresh registration end-to-end: pay → completed → splits present → receipt present → ledger updated.
- [ ] Landlord opens Draft + Final from every tenancy and PDF reflects the current template.
- [ ] Generating Form 33 via editor dialog triggers SMS to respondent (visible in `admin_audit_log` + send-sms logs).
