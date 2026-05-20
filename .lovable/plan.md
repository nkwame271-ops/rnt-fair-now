## Goals

Fix five wired-up gaps in the complaint payment + documents pipeline:

1. After an admin checkout completes, the complaint should flip to "paid / ready_for_scheduling" automatically (no manual reconcile).
2. The payer's receipt must land in the complainant's portal under **Receipts** (not on the admin filer).
3. Command Center → **Payment & Receipt Summary** must show the real total paid, and **Documents → Payment Receipts** must list the receipt (currently shows "No receipt yet").
4. Receipts in Command Center → Documents need a working **Download** action.
5. All Command-Center-generated forms (Form 7, Form 33, Form 32A, complaint receipts, summons, notices) must carry a QR code that, when scanned, opens a verification page showing the form **and** key complaint details (ticket, case number, parties, status), not the current generic page.
6. Admin-filed landlord complaints must (a) actually go through checkout and (b) appear in the **landlord's** dashboard → Complaints once paid.

## Root causes

- `supabase/functions/_shared/finalize-payment.ts` inserts `payment_receipts` with `user_id = escrow.user_id` (the admin filer) and never sets `case_id` or `related_complaint_id`. Hence:
  - The receipt isn't visible on the complainant's `/tenant/receipts` or `/landlord/receipts` page (they filter by `user_id`).
  - `ComplaintCaseFile` queries `payment_receipts.case_id`, finds nothing, so the Payment Summary card sums to 0 and the Documents tab shows "No receipt yet".
- The `admin_complaint_filing` branch in `supabase/functions/paystack-checkout/index.ts` (lines 752-844) is hard-coded to the `complaints` table for the complaint lookup, basket query, and the pre-checkout status flip. For a landlord-complainant draft sitting in `landlord_complaints`, the lookup throws "Complaint not found", so the admin never reaches Paystack — and even when it does succeed for a tenant draft, finalize-payment finds no `complaintId` link on the receipt/case, leaving the "submitted, awaiting payer" UI until manual reconciliation.
- `VerifyForm` only reads `complaint_documents` columns (`form_type`, `version_number`, `status`, dates) and intentionally hides case context. Per the new requirement, it should display the form's ticket, case number, parties summary, and current case status.
- `ComplaintDocumentsHub` renders receipts via the `PaymentReceipt` component but the Documents-tab receipts card does not expose a download trigger that uses the existing `jsPDF` download in `PaymentReceipt`.

## Changes

### 1. `supabase/functions/paystack-checkout/index.ts` — `admin_complaint_filing` branch

- Look up the complaint in `complaints` first, then fall back to `landlord_complaints` (mirror the existing `complaint_fee` branch). Track `complaintTable: "complaints" | "landlord_complaints"`.
- Use `complaintTable` everywhere in this branch:
  - basket query `.eq("complaint_table", complaintTable)`
  - the pre-checkout `update({ payment_status: "pending", outstanding_amount, basket_total })` call
- Set `metadata.complaint_table = complaintTable` and keep `metadata.isLandlordComplaint` true when `complaintTable === "landlord_complaints"` or `complainant_role === "landlord"`.
- Callback path stays `/regulator/complaints/:id?status=success`.

### 2. `supabase/functions/_shared/finalize-payment.ts`

For `paymentType === "complaint_fee" | "student_complaint_fee"`:

- Resolve the **complainant user id** (`complainantUserId`) from the matched complaint row:
  - `complaints`: `complainant_user_id ?? tenant_user_id`
  - `landlord_complaints`: `landlord_user_id` (may be null for placeholder landlords)
- Resolve `caseId` by looking up `cases.id` where `related_complaint_id = complaintId`.
- When inserting the `payment_receipts` row, additionally set:
  - `user_id = complainantUserId ?? escrow.user_id` (falls back to filer if unregistered placeholder)
  - `case_id = caseId`
  - `related_complaint_id = complaintId`
  - `payer_name`/`payer_email` from `meta.payer_name`/`meta.payer_email` when `meta.filed_by_admin`, so the receipt shows the real payer rather than the admin profile.
- When updating the complaint row, branch on `meta.complaint_table` (or table-membership probe) so the `ready_for_scheduling / payment_status: paid / filing_fee_paid` update lands on `landlord_complaints` directly instead of relying on the fallback probe.
- After the update, send a `notifications` row to `complainantUserId` (if non-null) linking to `/tenant/my-cases` or `/landlord/complaints` based on table.

### 3. `src/pages/regulator/AdminFileComplaint.tsx`

- When opening checkout via `RequestComplaintPaymentDialog`, pass through the existing `draftTable` (already tracked in state) so the dialog forwards `complaint_table` in the `paystack-checkout` body. Required for the lookup branch above.
- The post-callback poll already exists; no behavioural change beyond ensuring it polls the correct table.

### 4. `src/components/RequestComplaintPaymentDialog.tsx`

- When `mode === "go_to_checkout"` and the complaint sits in `landlord_complaints`, include `complaint_table: "landlord_complaints"` in the `paystack-checkout` invoke body. (One-line addition; the dialog already knows `complaintTable`.)

### 5. `src/pages/shared/VerifyForm.tsx`

- After loading `complaint_documents`, fetch the parent case context (read-only, no PII beyond what's already on the printed form):
  - From `complaints` or `landlord_complaints` (by `case_kind` → table): `complaint_code`, `ticket_number`, `complaint_type`, `status`, `current_stage`, `created_at`.
  - Optional: `cases.case_number` via `cases.related_complaint_id`.
- Render a "Case details" section under the existing "Document" block showing: Ticket, Case #, Complaint type, Status, Created date, plus a short parties line (landlord_name + tenant_name or placeholder names — already on the printed PDF, so safe to surface).
- Keep the "Authentic document" banner. Replace the "Case details are not disclosed publicly" disclaimer with a shorter integrity statement.

### 6. `src/components/regulator/ComplaintDocumentsHub.tsx`

- In the receipts section, render each receipt with the existing `<PaymentReceipt />` component (which already includes a Print and a Download-PDF button via `jsPDF`). If the current layout only shows a summary row, swap it for `<PaymentReceipt ... showSplits={false} />` inside a collapsible so officers can preview + download. No business-logic change.

### 7. Forms QR coverage

`generateStatutoryForm` in `src/lib/complaintForms.ts` already injects `qr_data_url + verification_code` for Form 7 / 33 / 32A. Audit and patch any *other* generators used from Command Center that print without going through it:

- `src/lib/generateComplaintPdf.ts` — add the same QR footer + persist a `verification_code` on the corresponding `payment_receipts` / `complaint_documents` row so it resolves via `VerifyForm`.
- `src/components/PaymentReceipt.tsx` PDF download — embed the existing `qrCodeData` URL into the generated PDF (it currently only renders the on-screen QR), so printed/downloaded receipts are also scannable.
- Summons/notices: confirm they all flow through `generateStatutoryForm` (form_33 is the summons). If any custom notice path exists, route it through `generateStatutoryForm` to get the QR for free.

## Out of scope

- No schema changes (the `landlord_complaints` placeholder columns added in the previous round are sufficient).
- No new pages or routes; `/verify/form/:code` already exists.
- No changes to the statutory body of any form — only the existing footer QR area and the verification target page.

## Verification

1. Admin → File Complaint (tenant complainant) → Review & Submit → checkout → pay test card → land on `/regulator/complaints/:id?status=success`. Within ~5s the complaint row flips to `payment_status = paid`, `status = ready_for_scheduling`. The complainant logs in → `/tenant/receipts` shows the receipt. Command Center → Payment & Receipt Summary shows the correct GHS total. Documents tab lists the receipt with a working Download button.
2. Same flow with complainant = landlord (registered): row appears in **Landlord Complaints** tab; the landlord sees it in `/landlord/complaints`; receipt in `/landlord/receipts`.
3. Same flow with complainant = landlord (unregistered placeholder): row appears in Landlord Complaints; receipt is attached to the admin filer (fallback) and to the case; no crash.
4. Open any Form 7 / 33 / 32A from Documents → scan the QR with a phone → `/verify/form/:code` shows the form metadata **plus** ticket, case number, complaint type, status, parties.
5. Open a downloaded receipt PDF → it contains the same scannable QR pointing to `/verify/receipt/:reference`.
