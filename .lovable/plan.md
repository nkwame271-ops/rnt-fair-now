## Goal
Make payment finalization, receipts, complaint progression, reconciliation, and student revenue read from one synchronized source of truth so a verified Paystack payment updates exactly once and appears everywhere it should.

## What I found
- There is real data drift already:
  - `escrow_transactions` paid rows: 786
  - `case_payments` paid rows: 779
  - active `payment_receipts`: 719
- Recent paid references exist in `escrow_transactions` with no matching `case_payments` row.
- Tenant and landlord **Receipts** pages still read only `payment_receipts`, so any payment that finalized partially or only exists in `case_payments` will not appear.
- **Student Revenue** still reads `escrow_transactions` + `escrow_splits`, not the unified payment table.
- Complaint progression depends on receipt/admin-confirmation heuristics in places, so some paid admin-filed complaints remain in “awaiting payer” until manual reconciliation.
- Historical complaint receipts often have `case_id = null`, which breaks Command Center document attachment.
- Form verification failure UI exists, but the QR/document path still needs to be normalized so invalid Form 7 / Form 33 scans always land on the failure state.

## Plan
### 1) Harden the backend payment finalization path
- Refactor the shared finalization pipeline so `verify-payment`, `paystack-webhook`, and manual reconciliation all converge on one exact sequence:
  1. lock/resolve payment by reference
  2. mark escrow paid once
  3. upsert `case_payments`
  4. generate/link exactly one receipt
  5. run one-time reconciliation
  6. advance complaint workflow
- Remove any remaining logic branches that can succeed without fully writing `case_payments` and receipt linkage.
- Make the finalizer repair partial states for already-paid rows instead of silently skipping them.

### 2) Strengthen one-time reconciliation protection
- Upgrade the reconciliation RPC and its callers to treat `case_payments` as the only reconciliation gate.
- Return the exact message **“Transaction already reconciled”** when a reference is already reconciled.
- Ensure every reconciliation attempt logs:
  - reconciled by
  - reconciliation timestamp
  - transaction reference
  - ledger update reference
  - reconciliation status
  - webhook/manual source
- Align manual reconciliation so it never writes ledger state outside the unified payment record.

### 3) Repair historical drift with a targeted backend backfill
- Backfill missing `case_payments` rows for already-paid `escrow_transactions`.
- Backfill missing receipt linkage and `receipt_number` / `receipt_url` on `case_payments`.
- Backfill complaint-linked receipt `case_id` using `cases.related_complaint_id` where possible.
- Re-run reconciliation safely only for rows that are paid but not reconciled, without duplicating ledger updates.

### 4) Fix Receipts everywhere
- Update tenant and landlord **Receipts** pages to read a merged, deduplicated view of:
  - current `case_payments`
  - legacy `payment_receipts`
- Prefer unified payment data when both exist.
- Show receipt records immediately after payment verification, without depending on delayed legacy receipt-only queries.

### 5) Fix Command Center payment + receipt visibility
- Update `ComplaintCaseFile` and `ComplaintDocumentsHub` to prefer `case_payments` for totals and receipt URLs.
- Keep fallback support for legacy `payment_receipts` so older complaints still display correctly.
- Ensure complaint filing payments always attach one receipt under:
  - Command Center → Documents
  - user dashboard → Receipts

### 6) Fix complaint workflow synchronization
- Make admin-filed complaint checkout always carry the correct complaint table and complainant role through checkout, finalization, and post-payment updates.
- Ensure successful paid complaint filings move from `draft_awaiting_filing_payment` / awaiting payer states into the next actionable workflow state automatically, without manual reconciliation.
- Keep landlord-filed complaints in **Landlord complaints** and tenant-filed complaints in **Tenant complaints** consistently.

### 7) Fix Student Revenue isolation
- Refactor the Student Revenue dashboard to read unified paid/reconciled student transactions from `case_payments` first.
- Keep student receipts isolated to the Student Revenue flow and not mixed into standard office receipt views.
- Preserve split visibility from `escrow_splits`, but anchor the transaction list and totals on unified payment rows.

### 8) Fix Form 33 date presentation and QR verification failure flow
- Normalize Form 33 displayed dates to `dd/mm/yyyy` everywhere the user sees them, including the editor-facing selected date text.
- Ensure invalid Form 7 / Form 33 verification codes always resolve to the existing **Verification failed** page state instead of ambiguous results.

### 9) Validate end-to-end before closing
I will verify these scenarios after implementation:
- admin-filed tenant complaint → checkout → receipt in user Receipts + Command Center + complaint advances automatically
- admin-filed landlord complaint → lands only in Landlord complaints and follows the same paid workflow
- webhook replay on same reference → no second ledger update, no second receipt, returns “Transaction already reconciled”
- manual reconciliation on already reconciled row → blocked/idempotent with logged attempt
- student payment → appears in Student Revenue only with correct totals
- invalid Form 7 / Form 33 QR → verification failed page

## Technical details
### Database work
- Add a migration to tighten reconciliation logging and repair helpers.
- Add a safe backfill/repair migration for missing unified payment rows and missing complaint receipt case links.
- Preserve RLS and keep all sensitive writes server-side only.

### Code areas to update
- `supabase/functions/_shared/finalize-payment.ts`
- `supabase/functions/verify-payment/index.ts`
- `supabase/functions/paystack-webhook/index.ts`
- `supabase/functions/reconcile-payment/index.ts`
- `src/pages/tenant/Receipts.tsx`
- `src/pages/landlord/Receipts.tsx`
- `src/pages/regulator/ComplaintCaseFile.tsx`
- `src/components/regulator/ComplaintDocumentsHub.tsx`
- `src/pages/regulator/StudentRevenue.tsx`
- `src/pages/regulator/AdminFileComplaint.tsx`
- `src/components/RequestComplaintPaymentDialog.tsx`
- `src/components/regulator/FormEditorDialog.tsx`
- `src/pages/shared/VerifyForm.tsx`
- `src/pages/shared/VerifyReceipt.tsx`

### Success criteria
- no paid Paystack transaction without a matching unified payment row
- no paid unified payment without one receipt link
- no duplicate reconciliation for the same reference
- complaint status moves automatically after verified payment
- receipts load in dashboards and Command Center consistently
- student revenue totals match student-only unified payments