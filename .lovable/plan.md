## Goal

Bring payment confirmation and document verification directly into the Command Center case workflow, and add tamper-evident QR verification to every platform-generated statutory form and receipt.

## 1. Payment Status card on case view

In `src/pages/regulator/ComplaintCaseFile.tsx`, add a new "Payment & Receipt Summary" card directly under the case header (above the Tabs) — visible on every tab so officers don't have to switch.

The card shows:
- Payment status badge (Paid / Pending / Failed / Refunded), colour-coded
- Fee type(s) (e.g. Basic Filing Fee, Hearing Fee)
- Total amount paid (GHS, formatted)
- Payer type (Tenant / Landlord / Officer-on-behalf) and payer name + phone
- Receipt number (clickable → opens receipt preview dialog)
- Payment reference (Paystack ref)
- Payment date

Data source: load on the same `load()` Promise.all by querying:
- `payment_receipts` where `complaint_id = id` (latest first)
- `complaint_basket_items` where `complaint_id = id` for fee-type breakdown / paid status
- Fallback to `escrow_transactions.related_complaint_id` if no receipt row yet

If multiple receipts exist, show the latest at the top with a "View all (N)" expander listing prior receipts compactly.

If no payment yet: show muted "No payment recorded yet" with a "Request Payment" shortcut (reuses existing `RequestComplaintPaymentDialog`).

## 2. Receipts inside Documents tab

Extend `src/components/regulator/ComplaintDocumentsHub.tsx`:
- Accept a new `receipts` prop (array from `payment_receipts` for this case)
- Render a new `ReceiptSection` block above Form 7, styled identically to the FormSection cards (icon = `Receipt`, label = "Payment Receipt — RCT-XXXX-####")
- Each receipt row exposes **Preview**, **Download (PDF)**, and **Print** buttons that reuse `PaymentReceipt` component logic (it already supports `downloadPdf`, `printReceipt`, and QR rendering)
- Preview opens in the same Dialog used for form previews, but renders the `<PaymentReceipt>` React component (not an iframe)

Receipts auto-attach: nothing new to write — they are inserted by `finalize-payment.ts` on successful payment, so they appear here as soon as Paystack confirms. We just surface them.

Load receipts in `ComplaintCaseFile.tsx`'s `load()` and pass to `ComplaintDocumentsHub`.

## 3. QR verification on all generated documents

Goal: add a small QR (≈ 80×80) in the footer-left of every generated PDF, encoding a public verification URL. The statutory body of the forms is untouched.

URL format:
- Forms: `https://www.rentcontrolghana.com/verify/form?id={form_document_id}&code={short_code}`
- Receipts: existing `/verify-receipt?ref={receipt_number}` (already used by `PaymentReceipt`)

Implementation:
- Add a `drawQrFooter(doc, url, label)` helper in `src/lib/pdf/_brand.ts` that renders QR (using `qrcode` package which is already installed for receipts) plus tiny "Scan to verify · {short_code}" caption to the left of the existing footer line.
- Call it from `form7.ts`, `form33.ts`, `form32a.ts`, and the generic `generateDynamicFormPdf.ts` right before `drawFooter`.
- `complaint_documents` rows already have an `id` and `verification_code` (or we generate one if missing) — pass through from `FormEditorDialog` when persisting.

DB: add a `verification_code TEXT` column to `complaint_documents` (random 8-char) and reuse existing `qr_code_data` on `payment_receipts`. A new public verify page `src/pages/shared/VerifyForm.tsx` looks the code up and shows: form type, case number, generated date, finalized status — without exposing private case details.

No statutory content is altered; QR lives in the footer band alongside the existing slogan.

## 4. Out of scope

- No changes to how payments are *initiated* (already handled in the previous turn)
- No changes to the Receipts module pages — they continue to work independently
- No rewrite of statutory form text or layout

## Technical notes

- New file: `src/pages/shared/VerifyForm.tsx` + route in `App.tsx`
- Edit: `ComplaintCaseFile.tsx`, `ComplaintDocumentsHub.tsx`, `_brand.ts`, `form7.ts`, `form33.ts`, `form32a.ts`, `generateDynamicFormPdf.ts`
- Migration: `ALTER TABLE complaint_documents ADD COLUMN verification_code TEXT UNIQUE` + backfill trigger generating an 8-char code on insert
- Reuses existing `qrcode` npm package and existing `PaymentReceipt` component — no new deps