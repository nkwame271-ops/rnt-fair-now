## Goal
Fix the complaint workflow so paid complaints move forward automatically, receipts appear everywhere they should, landlord-vs-tenant complaint routing is correct, and every generated complaint document has real QR verification.

## What I’ll change

### 1. Repair complaint payment finalization end-to-end
- Update the shared payment finalization flow so complaint payments always write back the correct complaint status, `filing_fee_paid`, `receipt_id`, and complaint linkage in one consistent path.
- Make receipt creation/storeback use the complaint record and case record correctly instead of leaving complaint receipts with no usable `case_id` link.
- Add a fallback in the case-file loading flow so complaint receipts can still be found by complaint id / escrow reference when older records are missing the proper case link.
- Preserve idempotency so webhook verification and success-page verification cannot double-create receipts or corrupt payment state.

### 2. Fix Command Center payment and receipt visibility
- Update the Complaint Case File payment summary card to derive totals/status from the correct linked receipts and complaint basket state.
- Fix the Documents tab receipt loader so complaint receipts no longer show “No receipt yet for this case” when a valid complaint payment exists.
- Keep receipt downloads available from Command Center and ensure the download action uses the same receipt data path as the preview.

### 3. Ensure payer sees receipts in their own dashboard
- Verify and correct receipt ownership assignment for admin-filed complaint payments so the actual complainant gets the receipt in their portal.
- Make the tenant and landlord receipt dashboards surface these complaint receipts consistently after verification completes.

### 4. Correct admin complaint routing for tenant vs landlord complainants
- Harden the admin “File Complaint” draft creation flow so:
  - landlord complainants are created and maintained in `landlord_complaints`
  - tenant complainants stay in `complaints`
- Fix downstream complaint queries and helper logic that still assume tenant-table semantics, including case file/document helpers and landlord dashboard complaint visibility.
- Improve complainant identity resolution for admin-filed landlord complaints so a selected landlord actually sees the complaint on the Landlord dashboard when a platform account exists.

### 5. Extend QR verification to all complaint-generated documents
- Keep the existing statutory form verification path and extend the same verification treatment to all other complaint documents created through the generic document editor (summons, hearing notices, notices, other generated documents).
- Ensure every generated complaint document stores a verification code plus verifiable metadata and opens to a specific verification page with complaint/document details instead of a generic destination.
- Ensure complaint receipts continue to verify against actual receipt details.

### 6. Add any small backend schema support needed
- If needed, add a focused migration for missing complaint-document verification fields and/or indexes needed for reliable document/receipt lookup.
- Keep security intact with existing authenticated admin access and current document verification rules.

## Verification I’ll run after the fixes
- Simulate/verify a paid admin-filed complaint and confirm it moves out of the pre-payment state automatically.
- Confirm the complaint shows the right payment summary total in Command Center.
- Confirm the Documents tab shows the receipt and the receipt downloads.
- Confirm the actual payer sees the receipt in their dashboard.
- Confirm admin-filed landlord complaints appear in landlord complaint views and landlord dashboard.
- Confirm tenant-filed and landlord-filed complaints remain separated correctly in Complaint Management.
- Generate and verify Form 7, Form 33, complaint receipt, and at least one generic notice/summons document via QR verification.

## Technical details
- Main files likely touched:
  - `supabase/functions/_shared/finalize-payment.ts`
  - `supabase/functions/paystack-checkout/index.ts`
  - `src/pages/regulator/ComplaintCaseFile.tsx`
  - `src/components/regulator/ComplaintDocumentsHub.tsx`
  - `src/pages/regulator/AdminFileComplaint.tsx`
  - `src/pages/regulator/RegulatorComplaints.tsx`
  - `src/pages/landlord/LandlordComplaints.tsx`
  - `src/pages/landlord/LandlordDashboard.tsx`
  - `src/pages/tenant/Receipts.tsx` / landlord receipts view if needed
  - `src/pages/regulator/ComplaintDocumentEditor.tsx`
  - `src/pages/shared/VerifyForm.tsx` and related verification helpers
  - migration file only if schema support is missing

- Key issues already confirmed:
  - complaint receipts are often created without a usable `case_id`
  - the case file currently loads receipts only by `case_id`
  - some landlord complaint helpers infer the wrong table shape
  - generic complaint documents are finalized without the same QR verification model used by statutory forms

If you approve, I’ll implement the fixes and verify each reported issue against the actual flows.