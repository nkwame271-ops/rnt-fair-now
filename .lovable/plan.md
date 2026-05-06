## Goal
Fix 7 reported issues across Beta Feedback / Contact Replies, NUGS staff invite + visibility, Student complaint payment gating, File Complaint UX (school + Other type), and add NUGS revenue split for NUGS-assigned rent cards.

---

## 1. Contact Messages → "Edge Function returns non-2xx"

**Cause**: `contact-reply` returns 400/401/403 on validation; the frontend reads `error.message` from the SDK before reading `data.error`. Also the function leaks 500s when `RESEND_API_KEY` or `contact_message_replies` insert fails silently.

**Fix**:
- Make `contact-reply` always return HTTP **200** (errors carried in body `{ success:false, error }`), so `supabase.functions.invoke` doesn't trip on non-2xx.
- Tighten validation: trim `body`, normalize phone, return clear messages for missing email/phone.
- Wrap `contact_message_replies` insert + `handle_contact_reply_inserted` trigger errors so we still return a useful payload.
- In `RegulatorFeedback.tsx` `sendReply`: read `data?.error` before `error.message` (already partly done) and surface server message verbatim.

---

## 2. Invite Staff → NUGS Sub-Admin "non-2xx"

**Cause**: Several latent failures in `invite-staff/index.ts`:
- `auth.admin.listUsers()` is paginated (default 50) — collisions slip past, then `createUser` throws with a 422 the function re-emits as 500.
- `handle_new_user` trigger inserts into `user_roles` from `raw_user_meta_data.role`. Works for `nugs_admin` (enum exists), but the orphan-profile cleanup deletes by email then re-insert via trigger may race and fail if profile already created.
- All errors must be returned with HTTP 200 + `{ error }` so the SDK surfaces them.

**Fix**:
- Replace `listUsers()` with a paginated email check (or use `getUserByEmail` via admin API).
- Wrap each step in try/catch and always return 200 + descriptive error.
- If `nugs_staff` insert fails, roll back the auth user with `auth.admin.deleteUser` to prevent half-created accounts.
- Log structured errors to a new `edge_function_errors` row (reuse `payment_processing_errors` pattern, or just `console.error` for now).

---

## 3. NUGS Sub-Admins must appear in Engine Room + Super Admin "Staff & Admins" with feature config

**Current state**: `SuperAdminDashboard` already merges `nugs_staff` rows but the edit/feature/freeze/delete actions are hidden for `admin_type === "nugs_admin"`. Engine Room doesn't list them at all.

**Fix**:
- Add `allowed_features jsonb` and `muted_features jsonb` columns to `nugs_staff` (migration).
- In `SuperAdminDashboard`:
  - Allow "Edit" for NUGS rows; persist `allowed_features` / `muted_features` to `nugs_staff` (not `admin_staff`).
  - Allow Freeze / Unfreeze / Delete for NUGS rows via the same `admin-action` edge function (extend it to accept `nugs_admin` account_type).
- In `EngineRoom.tsx` Staff section: union-fetch `admin_staff` + `nugs_staff` and render NUGS rows with a NUGS badge and the same feature-toggle UI (writes to `nugs_staff` when row.kind = 'nugs').
- `useFeatureFlag`/`useModuleVisibility` already read `allowed_features` from a profile — ensure the NUGS profile path reads from `nugs_staff` when that's where the row lives. Add a small union helper.

---

## 4. Student Complaint Payment never redirects

**Root cause** (confirmed in code):
- `FileComplaint.handleSubmit` inserts the complaint with `status:'submitted'` and `payment_status:'awaiting'`, then calls `paystack-checkout` with `type:'complaint_fee'`.
- `paystack-checkout` rejects any complaint where `status !== 'pending_payment'` OR `payment_status !== 'pending'` OR `outstanding_amount <= 0` → throws → non-2xx → toast says "redirecting" but no redirect.
- Also: per the requirement, **no complaint should exist until payment is verified**.

**Fix**:
- Change student-complaint flow to a **payment-first** model:
  1. On submit, build a `pending_complaint_drafts` row (new table) holding the full complaint payload + evidence URLs (uploaded to a `drafts/` prefix).
  2. Call `paystack-checkout` with new `type:'student_complaint_fee'` and `draft_id` instead of `complaintId`. Server reads the student fee from `feature_flags.student_complaint_fee`, sets `totalAmount` itself, and stores `draft_id` in `escrow_transactions.metadata`.
  3. Add a step in `_shared/finalize-payment.ts` (or inside `verify-payment`) for `case_type='complaint'` + `metadata.draft_id`: materialize the actual `complaints` row, move evidence from `drafts/` to `complaints/<id>/`, create the `cases` row, then delete the draft.
- Frontend redirect uses `window.location.href = data.authorization_url` (already correct); we just need the checkout to succeed. Surface server `error` to user when it doesn't.
- Migration: `pending_complaint_drafts` table with RLS (tenant owns own draft; service role full).

---

## 5. File Complaint — School selection + "Other" school

**Current state**: students already see a NUGS school dropdown with custom-name fallback (`useCustomSchool`). The requirement is to make this **mandatory and the routing key** for student complaints (no "office" pick).

**Fix**:
- For `isStudent`, hide the regular Office step; replace with **"Which school is this complaint about?"** dropdown of `GHANA_INSTITUTIONS` + "Other (type school name)".
- Resolve the school to a NUGS office: lookup `nugs_staff` rows by `assigned_school` ilike school; use first match's user as the routing target (`assigned_nugs_user_id`). If no NUGS sub-admin exists for that school, set `office_id = null`, `nugs_school = <name>`, and flag the case for Super Admin reassignment (already supported by `EscalatedStudentComplaints`).
- Persist `nugs_school` (already a column) and `assigned_nugs_user_id` on the new complaint row (add column via migration if missing).
- For non-students: keep existing office picker.

---

## 6. Complaint Type "Other"

**Fix**:
- Append `"Other"` to `complaintTypes` in `src/data/dummyData.ts`.
- In `FileComplaint.tsx`: when `form.type === "Other"`, render an extra `Input` "Describe complaint type" (`form.customType`); on submit, store as `complaint_type: form.customType` and set a new `complaint_type_is_custom: true` flag (column add or store in metadata jsonb already on the row).
- Mirror the same in `NugsComplaints` filter to display custom types correctly.

---

## 7. NUGS Revenue Split when a rent card is **assigned** by a NUGS office

**Current state**: NUGS routing already happens at **purchase** time (buyer is NUGS sub-admin → office/admin share rerouted to NUGS, marked `is_nugs_revenue`). The requirement adds a second hook: when a card is **assigned** (via `assign_serials_atomic`) by a NUGS office, classify the resulting revenue under Student Revenue with a 4-way split: **NUGS / IGF / CM / Platform**.

**Fix**:
- Add a `student_rent_card_fee` allocation key in `recipient_allocations` (Engine Room): NUGS %, IGF %, CM %, Platform %. Add UI in EngineRoom Allocations tab (`recipientAllocationsKeys` list).
- Migration: extend `escrow_transactions` with `nugs_office_id text` (nullable). Already has `is_nugs_revenue` boolean.
- Update `assign_serials_atomic` (or a new wrapper RPC) so when the assigning office is a NUGS office:
  1. Find the original `escrow_transactions` row for the purchase.
  2. If not already `is_nugs_revenue`: rewrite its `escrow_splits` using the `student_rent_card_fee` allocation, mark `is_nugs_revenue=true`, set `nugs_office_id`. Use `payout_status` guard — only rewrite while still `pending_payout`.
  3. If splits already paid out, insert a compensating ledger entry rather than rewriting (audit-safe).
- Surface NUGS-assigned rent card revenue in `StudentRevenue.tsx` as its own line with the 4-way breakdown.
- Engine Room: add the new `student_rent_card_fee` row in the Allocations editor with the four recipients.

---

## Files to change

**Edge functions**:
- `supabase/functions/contact-reply/index.ts` — always 200, better errors.
- `supabase/functions/invite-staff/index.ts` — paginated email check, rollback on partial failure, always 200.
- `supabase/functions/paystack-checkout/index.ts` — new `student_complaint_fee` flow keyed on `draft_id`; new `student_rent_card_fee` allocation lookup.
- `supabase/functions/_shared/finalize-payment.ts` (or `verify-payment/index.ts`) — materialize complaint from draft on success.
- `supabase/functions/admin-action/index.ts` — handle `account_type='nugs_admin'`.

**Migrations**:
- Add `allowed_features`, `muted_features` to `nugs_staff`.
- New `pending_complaint_drafts` table + RLS.
- Add `assigned_nugs_user_id`, optional `complaint_type_is_custom` to `complaints` (or use existing metadata jsonb).
- Add `nugs_office_id` to `escrow_transactions`.
- Update `assign_serials_atomic` to rewrite splits when assigner is a NUGS office.
- Seed `recipient_allocations` for `student_rent_card_fee` (NUGS / IGF / CM / Platform — defaults TBD, e.g. 50/30/10/10).

**Frontend**:
- `src/pages/tenant/FileComplaint.tsx` — student school step, Other complaint type, payment-first draft flow.
- `src/data/dummyData.ts` — append "Other" complaint type.
- `src/pages/regulator/SuperAdminDashboard.tsx` — enable edit/freeze/delete for NUGS rows; persist features to `nugs_staff`.
- `src/pages/regulator/EngineRoom.tsx` — list NUGS staff; add `student_rent_card_fee` allocation row; add `cm` recipient label.
- `src/pages/regulator/StudentRevenue.tsx` — new line for NUGS-assigned rent card revenue.
- `src/pages/regulator/RegulatorFeedback.tsx` — read `data.error` first, surface server message.

## Acceptance checks (what I'll verify after implementing)
1. Reply to a contact submission via email and SMS — both succeed; failures show specific reasons.
2. Create a NUGS sub-admin from Invite Staff and from Super Admin dialog — succeeds; record visible in both Engine Room and Super Admin lists with editable features.
3. Student files a complaint → redirected to Paystack → on cancel, no complaint exists; on success, complaint + case + evidence exist with `nugs_school` populated.
4. Choose "Other" school and "Other" complaint type → both saved as free text and visible in NUGS dashboards.
5. NUGS office assigns a rent card → escrow splits rewritten to NUGS/IGF/CM/Platform with `is_nugs_revenue=true`; appears in Student Revenue.
