# Fix Pass — Errors Reported

## 1. Contact Messages → "SMS dispatch failed: non-2xx"
**Cause:** `contact-reply` invokes `send-sms`, which throws 500 on Arkesel failures. `supabase-js` then surfaces "non-2xx".

**Fix:**
- `send-sms`: always return HTTP 200 with `{ success:false, error }` on provider failures (mirroring what we did for `contact-reply`).
- `contact-reply`: parse `smsData.error` first; on failure show the provider's real reason (e.g. "Insufficient SMS credit") instead of the generic transport error.
- Frontend `RegulatorFeedback.tsx`: already reads `data.error`, no change needed.

## 2. NUGS Sub-Admins not in Engine Room / Super Admin Staff & Admins
**Cause:** `EngineRoom.tsx` and the Staff & Admins block in `SuperAdminDashboard.tsx` query only `admin_staff`; `nugs_staff` rows are never merged in.

**Fix:**
- `SuperAdminDashboard.tsx` Staff & Admins tab: union-load `admin_staff` + `nugs_staff` (already partially present — extend list rendering to include `nugs_admin` / `nugs_sub_admin` rows with edit / freeze / reset / delete actions wired to `admin-action`).
- `EngineRoom.tsx`: add a "NUGS Staff" subsection (or merge into existing Staff list) with feature-toggle controls writing to `nugs_staff.allowed_features` / `muted_features`.
- `admin-action` already handles `nugs_admin` ops — verify no path still 500s for these IDs.

## 3. Student Complaint Payment → "Redirecting" but never navigates
**Cause:** Two likely failure points; the current flow swallows them:
- Evidence upload into the private `application-evidence/drafts/...` may fail silently for some MIME types.
- `paystack-checkout` may throw before returning `authorization_url` (no toast on `payErr` because the prior toast.success already fired).

**Fix:**
- `FileComplaint.tsx`:
  - Move `toast.success("Redirecting…")` to AFTER `authorization_url` is confirmed.
  - On any failure during draft insert / evidence upload / checkout invoke, show explicit toast.error with the underlying reason and roll back the draft row.
  - Ensure no `complaints` / `cases` rows are written before payment — already true via draft flow; double-check the non-student fallback isn't used for student users.
- `paystack-checkout`: keep payment-first; return 200 with `{ error }` so frontend can show the real reason instead of "non-2xx".

## 4. Complaint Type → add "Other" with free-text
**Status:** `complaintTypes` in `src/data/dummyData.ts` already has "Other" (done last loop).

**Fix (UI wiring):** In `FileComplaint.tsx`, when `complaintType === "Other"` show a required `<Input>` for custom type and persist `complaint_type_is_custom=true` + custom string in the draft payload → carry through `finalize-payment` into the materialized complaint.

## 5. NUGS Office Rent-Card Assignment → Student Revenue split (NUGS / IGF / CM / Platform)
**Cause:** `assign_serials_atomic` simply marks the pair assigned; it does not classify revenue. Existing `student_rent_card_fee` allocation was seeded but only fires at purchase time, not on NUGS-office assignment.

**Fix:**
- New trigger / extension in `assign_serials_atomic` (or post-assignment hook): if `assigned_office` is a NUGS office (offices table flag or NUGS-prefixed id), locate the related `escrow_transactions` row for the rent-card purchase and:
  - Set `is_student_revenue = true`, `payment_type = 'student_rent_card_fee'`.
  - Rewrite `splits` from `recipient_allocations` for `student_rent_card_fee` (NUGS / IGF / CM / Platform — already seeded).
- `StudentRevenue.tsx`: surface a new line item "NUGS-Assigned Rent Cards" sourced from the rewritten escrow rows.
- Engine Room allocation editor: ensure `student_rent_card_fee` row is editable for Super Admin.

## 6. Declared Existing Tenancy → Tenant placeholder shows Landlord's name
**Cause:** In `DeclareExistingTenancy.tsx` (line 244), when no matched tenant exists, `tenant_user_id = user.id` (the landlord). Agreements UI then resolves both parties from the landlord's profile.

**Fix:**
- Add columns to `tenancies`: `placeholder_tenant_name text`, `placeholder_tenant_phone text`, `tenant_user_id` nullable until the tenant registers.
- In `DeclareExistingTenancy.tsx`: if no `matchedTenant`, insert with `tenant_user_id = NULL`, populate placeholder columns from the captured form, and link the row to the `pending_tenants` record (`pending_tenant_id` FK).
- On tenant registration / phone-match flow (existing matcher): when a `pending_tenants` row resolves to a real user, update all linked tenancies' `tenant_user_id`, clear placeholders, and notify the tenant to accept.
- `RegulatorAgreements.tsx`, `RegulatorTenants.tsx`, `LandlordTenants.tsx`, and any place reading `tenant_user_id`: fall back to `placeholder_tenant_name` / phone when `tenant_user_id` is null. Show a "Pending acceptance" badge.
- RLS for `tenancies`: keep landlord access; allow read by tenant only after `tenant_user_id` is set.

## Acceptance checks
1. Reply to a contact message with a number that has no SMS credit → UI shows the real provider error, no "non-2xx".
2. Create a NUGS Sub-Admin via Invite Staff → appears in both Engine Room Staff list and Super Admin → Staff & Admins → editable.
3. Student files complaint → redirected to Paystack; cancelling means no `complaints` row exists; on success complaint + case are created.
4. Selecting "Other" complaint type shows a required free-text field and persists on the materialized complaint.
5. Rent card assigned by a NUGS office → escrow row marked `is_student_revenue=true`, split into NUGS / IGF / CM / Platform; visible in Student Revenue.
6. Declared existing tenancy without a matched tenant shows the captured tenant name everywhere; after the tenant registers and accepts, all UIs update to the real profile.

## Technical notes
- New migration: `tenancies.placeholder_tenant_name`, `placeholder_tenant_phone`, `pending_tenant_id`; make `tenant_user_id` nullable; trigger / function to backfill on tenant registration.
- Edge functions: `send-sms` (200-always pattern), `paystack-checkout` (200 with error body for student draft path), small change to `assign_serials_atomic` or a new `classify_nugs_revenue` SQL function.
- No new secrets required.
