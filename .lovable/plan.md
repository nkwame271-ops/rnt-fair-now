# Triage & Fix Plan — Complaints, Forms, Safety

This batch covers six distinct issues. I'll fix the blocking bugs first, then layer in the Form 7 / Form 33 auto-generation flow on top of the existing Document Editor (Phase 6) so we don't duplicate work.

## 1. Admin → File Complaint silently fails

Likely cause (confirmed against RLS):
- `INSERT` policy `Admin staff can file complaints` only allows users present in `admin_staff`. NUGS-only or regulator-without-admin_staff rows fail with no useful toast because the catch reads `e.message` which can be empty for RLS rejections.
- Even when insert succeeds, the chained `.select("id, ticket_number, complaint_code")` requires a SELECT policy; non-regulator admins fail here.

Fix:
- Wrap `submit()` in `AdminFileComplaint.tsx` with a clearer error pipeline (always surface `error.message || error.details || error.hint`).
- After insert, if the post-insert select returns nothing/error, re-fetch with `admin_staff`-scoped query, falling back to a service-side fetch using returned `id` if available.
- Add a new RLS policy: `Admin staff read complaints they filed` so the returning `select` resolves.
- Stenographers don't currently have an `admin_staff` row in some envs — verify by surfacing a friendly "Your account is not in admin_staff; ask Super Admin to add you" error rather than a silent failure.

## 2. Form 7 auto-generation on complaint filing

Workflow:
- After a successful complaint insert in `AdminFileComplaint.tsx` and the wizard (`ComplaintWizard.tsx`), call a new helper `autoGenerateForm7(caseId, complaint)` that:
  1. Loads the canonical `form_templates` row where `form_number = 'Form 7'`.
  2. Builds a `form_submissions` row with `data` pre-filled from the complaint (parties, address, region, ticket, description, date).
  3. Renders the PDF via existing `generateDynamicFormPdf`, uploads to `form-outputs/<caseId>/form-7-v1.pdf`.
  4. Inserts a `complaint_documents` row (`form_type='form_7'`, `version_number=1`, `status='final'`, `pdf_url=path`) so the Case File → Documents tab shows it immediately.
- Idempotent: skip if a `complaint_documents` row with `form_type='form_7'` already exists for the case.

## 3. Form 33 generation on hearing scheduling

Trigger point: existing **Schedule Hearing** action in `ComplaintCaseFile.tsx`.
- After `complaint_hearings` insert succeeds, call `generateForm33(caseId, hearing)`:
  - Pre-fill respondent name, case number, hearing date/time, venue (room name), parties.
  - Save as a *draft* `complaint_documents` row so the admin can edit variable fields before finalizing.
- Add an "Edit & Finalize Form 33" button on the Documents tab that opens `ComplaintDocumentEditor` with `form_type=form_33` and the draft pre-loaded.

## 4. Complaint Documents Section

`ComplaintCaseFile.tsx` already has a Documents tab from Phase 6. Enhance it:
- Group items: **Statutory Forms (Form 7, Form 33)**, **Evidence**, **Receipts**, **Other Documents**.
- Each row: badge for status (draft/final), Download PDF, Regenerate (rebuilds PDF from latest data, bumps version), Edit (opens WYSIWYG / FormFill).
- Pull receipts from `receipts` table keyed by complaint payment.

## 5. Form Engine — Generate & Delete

`FormFill.tsx` Generate button:
- `generateAndAttach` already exists. Bug: when called without a `complaintId`, it tries to update `form_submissions` then exits with no toast on path errors. Add explicit error toasts on every catch branch and a visible "Saved to outputs" success state with link to the file.

`FormEngine.tsx` Delete button:
- Inspect template list delete; ensure it calls `supabase.from('form_templates').delete().eq('id', id)` inside a confirmed AlertDialog and refreshes the list state on success. Add toast feedback for both success and RLS-blocked failures.

## 6. Safety & Emergency submission failures

Likely cause: `submit-safety-report` edge function works against the schema, but the SMS fan-out hits the failing Arkesel V2/V1 endpoints (see logs: `Your are not allowed to use this Sender ID`). The fan-out is wrapped in `try/catch` so it should not fail the function — but the `notify admins` insert into `notifications` may fail if no admin rows or column mismatch, and that block is NOT wrapped properly in all paths.

Fix:
- Audit `submit-safety-report/index.ts`: wrap every best-effort side-effect in its own try/catch returning success regardless. Only the core `safety_reports` insert and `safety_audit_log` insert determine success.
- Frontend: surface the real error in the toast (`err.message`) instead of a generic message.
- Verify the `safety-evidence` bucket upload doesn't 403 for the user (RLS on storage). Add a pre-check.

## Technical Section

Files touched:
- `src/pages/regulator/AdminFileComplaint.tsx` — error surfacing, auto-Form-7 trigger.
- `src/pages/regulator/ComplaintWizard.tsx` — auto-Form-7 trigger.
- `src/pages/regulator/ComplaintCaseFile.tsx` — auto-Form-33 on hearing schedule, Documents tab grouping & actions.
- `src/pages/regulator/FormFill.tsx` — error toasts on Generate.
- `src/pages/regulator/FormEngine.tsx` — wire Delete with confirm + feedback.
- `src/pages/shared/ReportSafetyIssue.tsx` — show real error message.
- `src/components/SafetyPanicButton.tsx` — show real error message.
- `supabase/functions/submit-safety-report/index.ts` — defensive try/catch around side-effects.
- `src/lib/complaintForms.ts` *(new)* — `autoGenerateForm7`, `generateForm33`, `attachAsComplaintDocument` helpers.
- Migration: new RLS policy `Admin staff read complaints they filed` on `public.complaints` and a CHECK that statutory `Form 7` / `Form 33` rows exist in `form_templates` (seed if missing).

Rollout order: migration → safety edge-function fix → frontend bug fixes → Form 7/33 auto-attach → Documents tab grouping.

After implementation I'll verify by:
- Filing a test complaint as an admin and confirming ticket toast + dashboard entry.
- Scheduling a hearing and seeing Form 33 draft appear.
- Triggering a Safety report and seeing the real error or success.
