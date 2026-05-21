## Goal
Restore full financial traceability so every successful payment is accounted for end-to-end: Paystack verification, escrow entry, split ledger rows, unified payment row, receipt, reconciliation log, and complaint/case visibility.

## What I found
- **Primary failure:** receipt creation started breaking because the backend now writes `receipt_status = "active"`, but the database enum only allows:
  - `auto_generated`
  - `manually_reconciled`
  - `duplicate_blocked`
  - `voided`
- That mismatch has been throwing **critical `receipt_insert` errors** since yesterday.
- Current live counts show real drift:
  - **793** paid escrow transactions
  - **788** paid unified payment rows
  - **719** receipts
  - **28** paid escrow rows with no active split ledger rows
- In the last 24 hours:
  - **69** paid escrow transactions
  - **63** got unified payment rows
  - **0** got receipts
- The newest **5** paid escrow transactions are missing unified payment rows entirely, and they are the same references failing receipt creation right now.
- Missing split rows are concentrated in older flows (`rent_card_bulk`, `rent_tax_bulk`, `complaint_fee`, `tenant_registration`, `landlord_registration`, `listing_fee`).

## Plan
### 1) Fix the receipt-status contract at the source
- Update the shared payment finalization pipeline so auto-created receipts use the correct enum value instead of `active`.
- Review every backend path that writes or updates receipt status so auto-generated receipts, manual reconciliation receipts, duplicate protection, and voiding all use valid statuses consistently.
- Keep frontend display logic compatible with both old `status` values and the receipt-status enum values.

### 2) Repair all paid payments that are missing receipts
- Backfill receipts for every paid escrow transaction that has no receipt.
- Ensure each repaired receipt gets:
  - one receipt number
  - the correct payer linkage
  - the correct escrow linkage
  - the correct complaint/case linkage when applicable
  - a valid verification URL / QR target
- Prevent duplicate receipt creation by keying repair on escrow transaction / payment reference.

### 3) Repair the 5 paid escrow rows missing unified payment rows
- Backfill missing unified payment records for the recent paid transactions that completed but never fully materialized.
- Ensure each repaired row includes:
  - paid status
  - amount
  - payment reference
  - office/student routing
  - receipt number / receipt URL once receipt repair is complete
- Re-run idempotent reconciliation only where needed so the ledger remains exact-once.

### 4) Repair the 28 paid escrow rows missing active split ledger rows
- Rebuild missing active split rows from the escrow metadata split plan for historical transactions.
- Preserve the existing payout-readiness rules so missing payout setup does not block ledger visibility.
- Review older edge cases like bulk rent tax and older rent-card flows where split rows were skipped or never posted.

### 5) Re-sync all payment surfaces to the repaired source of truth
- Confirm the user-facing Receipts pages, regulator case file, complaint documents hub, and Student Revenue all continue to read repaired data correctly.
- Tighten any places still depending too heavily on legacy receipt rows so recent verified payments remain visible even when legacy rows lag.
- Keep complaint payment visibility consistent between escrow, receipts, and case records.

### 6) Add verification queries and operational safeguards
- Add a reusable reconciliation/audit query set to detect:
  - paid escrow without unified payment row
  - paid escrow without receipt
  - paid escrow without active split rows
  - unified payment rows missing receipt linkage
  - unreconciled paid payments
- Improve backend logging so future failures identify the exact stage immediately.
- Keep the one-time reconciliation guard and exact message behavior for already-reconciled transactions.

### 7) Validate end-to-end after repair
I will verify these outcomes after implementation:
- a fresh successful payment creates:
  - escrow entry
  - active split ledger rows
  - unified payment row
  - exactly one receipt
  - reconciliation log / ledger reference
- recent broken payments from yesterday/today now appear with receipts
- regulator complaint documents show repaired receipts again
- receipt dashboards load historical and current records correctly
- no new `receipt_insert` enum errors appear in backend logs
- drift counts reduce to:
  - **0 paid escrow missing unified payment**
  - **0 paid escrow missing receipt**
  - **0 paid escrow missing active split rows**
  - **0 paid unified payments unreconciled**

## Technical details
- **Backend files likely to change**
  - `supabase/functions/_shared/finalize-payment.ts`
  - possibly `supabase/functions/reconcile-payment/index.ts` if any receipt-status follow-up is needed
- **Database work**
  - data repair for missing receipts, missing unified payment rows, and missing split rows
  - possibly a small schema migration only if we need stronger constraints or helper functions for durable repair
- **Frontend files to verify / adjust only if needed**
  - `src/pages/tenant/Receipts.tsx`
  - `src/pages/landlord/Receipts.tsx`
  - `src/pages/regulator/ComplaintCaseFile.tsx`
  - `src/components/regulator/ComplaintDocumentsHub.tsx`
  - `src/pages/regulator/StudentRevenue.tsx`

## Expected result
After implementation, every successful payment will be traceable from Paystack to escrow to ledger to receipt, including the missing payments from yesterday and today, with duplicate protection still intact.