## 1. Fix: Admin → Complaints → empty page when clicking a row

**Root cause:** Both Tenant & Landlord lists rely on the row click to expand inline details (`expandedId` state). The current Tenant list summary buttons always expand correctly — the "empty page" symptom is from the Tenant tab when `_tenantRecord` is missing the `is_student` flag for some rows, so they get filtered out of both `tenant` and `student` views, *or* the inline expansion fails because `_tenantProfile` is null and several access paths throw.

**Fix:**
- Harden `isStudentRow` filter so a complaint with no tenant record falls through to the Tenant tab (default to non-student instead of being hidden).
- Wrap detail-section accessors (`c._tenantProfile?.…`, `c._activeTenancy?._unit?.…`) and the Landlord tab card in try/catch-friendly null guards (already mostly optional-chained — verify).
- For the Landlord tab, ensure each row card renders even if `_landlordProfile` lookup failed (show "Unknown" placeholders).
- Confirm both tabs render the inline expanded panel rather than navigating away (no `<Link>` triggers on row click).

## 2. Fix: Contact Messages reply → "non-2xx status code"

**Root cause:** `contact-reply` calls `supabase.rpc("enqueue_email", …)` and inserts into `email_send_log`, but neither the RPC nor the table exist in this project (`send-notification` has the same dead path but swallows errors). The function therefore 500s on the email channel.

**Fix:**
- Rewrite `supabase/functions/contact-reply/index.ts` to use the existing `send-notification` edge function for email (template name `complaint_summary` or a new generic `contact_reply` template) and `send-sms` for SMS — matching the working pattern used elsewhere.
- Apply the two-client pattern (anon client with the caller's JWT for the `is_main_admin` check; service-role client for the insert and dispatch) so authorization is verified against RLS.
- Always return CORS headers (already done) and return JSON 200 with a clear error payload instead of throwing on dispatch failure so the client toast shows the real reason.

## 3. NUGS Sub-Admin → Student Complaints (full workspace)

Currently `NugsComplaints.tsx` is read-only + escalate. Upgrade to a full workspace:
- Status management dropdown (`submitted → under_review → in_progress → resolved → closed`).
- Notes thread (reuse existing `complaint_notes` table if present, otherwise add `complaint_notes` with `complaint_id`, `author_user_id`, `body`, `created_at`; RLS lets NUGS staff read/write notes for complaints from their `assigned_school`).
- "Request Payment" basket flow — reuse `RequestComplaintPaymentDialog` with a NUGS-only fee scope (see §5).
- Track payment status badge + "Resend payment request" action.
- Download Complaint PDF (reuse `generateComplaintPdf`).
- Keep the Escalate-to-Rent-Control flow.

## 4. Escalated Student Complaints → full workspace inside Rent Control

Replace the current "Open in Complaints" button on `EscalatedStudentComplaints.tsx` with an inline expandable workspace per case:
- Full description, audio, evidence, attachments.
- NUGS history block (notes from §3, original NUGS payment status, escalation reason + escalated-by).
- Status management, scheduling, assignment control, payment request, profile/complaint downloads — same widgets used in `RegulatorComplaints` (extracted into a shared `<ComplaintWorkspace>` panel component).
- Visible only as configured today: super admins everywhere, standard regulators only on this Escalated page.

## 5. Student complaint payment logic (NUGS basket → Rent Control structured fee)

- **NUGS layer:** make `RequestComplaintPaymentDialog` accept a `feeScope="nugs"` mode that:
  - Hides rent-band / percentage selectors.
  - Shows a basket of `student_complaint_fee` items only (single type today, but the basket model from `complaintFees.ts` is reused so future types drop in).
  - Routes the resulting transaction with `is_student_revenue = true` and the existing NUGS split.
- **Rent Control layer (after escalation):** the same dialog opened from the escalated workspace uses `feeScope="rent_control"`, exposing the full complaint-type catalog including rent-band-based and fixed types, allowing fee updates/replacement. Capture an audit row `complaint_fee_revision` (complaint_id, old_amount, new_amount, reason, user_id) so the transition is traceable.

## 6. Rent Card revenue split when assigned by a NUGS officer

Today rent-card splits go HQ / Office / Platform. Add NUGS reassignment:
- New helper `is_nugs_user(_user_id)` (security definer, mirrors `is_main_admin`).
- In `paystack-checkout` and `_shared/finalize-payment.ts`, when building the `split_plan` for `rent_card` / `rent_card_bulk`, check the assigning user's role:
  - If NUGS → replace the `office` (or admin-share) recipient with `nugs` for that transaction; `hq` and `platform` shares unchanged.
  - The NUGS share is posted to a single central `nugs` settlement account (already wired in `OfficePayoutSettings`), not to per-school sub-accounts.
- Tag the escrow row `is_nugs_revenue = true` (new boolean column on `escrow_transactions`) and surface it in the Super-Admin Student Revenue dashboard alongside other NUGS revenue.

## 7. NUGS feature-level permissions

- Add `nugs_staff.permissions jsonb default '{"complaints":true,"rent_card":false}'`.
- Update `InviteStaff.tsx` (NUGS branch) to render two checkboxes: **Complaint Management**, **Rent Card**, persisted via `invite-staff` edge function.
- Super Admin can edit permissions later from a new "Manage NUGS Staff" tab (lists nugs_staff rows, toggles permissions).
- Enforce in code:
  - NUGS Complaints page → require `permissions.complaints`.
  - Rent-card assignment endpoints (assign serial, bulk allocate) → require `permissions.rent_card` for NUGS users; only those NUGS-assigned rent cards trigger the §6 NUGS-share rerouting.

## Technical changes

```text
DB migration
  - add column nugs_staff.permissions jsonb default '{"complaints":true,"rent_card":false}'
  - add column escrow_transactions.is_nugs_revenue boolean default false
  - create function is_nugs_user(_user_id uuid) returns boolean security definer
  - create table complaint_notes (id, complaint_id, author_user_id, body, visibility, created_at) + RLS
  - create table complaint_fee_revisions (id, complaint_id, old_amount, new_amount, reason, changed_by, created_at)
  - update RLS on complaint_notes so NUGS staff see notes for complaints from their assigned_school

Edge functions
  - rewrite supabase/functions/contact-reply/index.ts to use send-notification + send-sms
  - paystack-checkout/index.ts and _shared/finalize-payment.ts:
      detect NUGS assigner for rent_card / rent_card_bulk and rebuild split_plan + flag escrow.is_nugs_revenue
  - invite-staff/index.ts: persist permissions array onto nugs_staff

Frontend
  - src/pages/regulator/RegulatorComplaints.tsx: harden tenant/landlord tab rendering
  - new src/components/ComplaintWorkspace.tsx: shared full-detail panel
  - src/pages/regulator/EscalatedStudentComplaints.tsx: replace "Open in Complaints" with <ComplaintWorkspace>
  - src/pages/nugs/NugsComplaints.tsx: status dropdown, notes thread, payment request, downloads
  - src/components/RequestComplaintPaymentDialog.tsx: feeScope prop ("nugs" | "rent_control")
  - src/pages/regulator/InviteStaff.tsx: NUGS permission checkboxes
  - new src/pages/regulator/NugsStaffManagement.tsx (super-admin only) + route + sidebar entry
  - rent-card assignment screens: gate the assign action behind nugs permissions.rent_card for NUGS users
```

No new secrets are required.
