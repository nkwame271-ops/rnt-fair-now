# Plan: Multi-Module Fixes

## 1. Rent Cards → Pending and Assign (Search UX)
**File:** `src/pages/regulator/rent-cards/PendingPurchases.tsx`
- Verify `SerialSearchPicker` only opens dropdown when `query.length > 0` AND input is focused.
- Add `position: relative` wrapper + `z-50` on dropdown panel, `z-10` on input.
- Add backdrop click-outside handler. Ensure dropdown renders BELOW input (not over it) by using `top-full mt-1` positioning.
- Make sure pointer-events on dropdown don't block sibling search filter input on desktop.

## 2. Property Management — Staff Feature Visibility & Workflow
**Issue:** Feature toggle in Engine Room / Invite Staff doesn't surface "Property Management" page for staff.

**Files:**
- `src/hooks/useAdminProfile.ts` — confirm `property_management` route mapping resolves for staff with the override.
- `src/components/RegulatorLayout.tsx` — add nav link for `property_management` (gated by `useFeatureGate`).
- `src/pages/regulator/RegulatorPropertyManagement.tsx` — add landlord contact card (phone, email, WhatsApp deep link) to each managed property row + assignment dialog.
- Verify `staff_feature_overrides` is being read; seed `feature_flags` row for `property_management` if missing.

## 3. Landlord → Management Support Requests + Messaging
**Files:**
- `src/pages/landlord/LandlordManagementSupport.tsx` — add "Submit Request" button per managed property, opens dialog with request types: `buy_rent_card`, `rent_card_delivery`, `onboard_new_tenant`, `other`.
- Insert into `management_task_assignments` (task_type=request subtype, source=landlord).
- Add a Messages thread component using `support_messages` / `support_conversations` scoped to the property's assigned staff.
- Regulator side: `RegulatorPropertyManagement.tsx` already shows tasks — extend Task Queues tabs to include `landlord_request` type.
- Super Admin sees all via existing `is_main_admin()` RLS (no policy change needed; verify).

## 4. Tenant Portal — Tax-Off Payment Buttons
**Files:**
- `src/pages/tenant/Payments.tsx` & `src/pages/tenant/MyAgreements.tsx`
- When `gra_tax_enabled = false`: show TWO buttons side-by-side:
  - **Pay Rent on Platform** → existing Paystack checkout flow.
  - **Pay Rent Off Platform** → opens confirmation modal with landlord MoMo/Bank details from `landlord_payment_settings`; on confirm, marks payment as `off_platform_pending` and unlocks agreement signing.
- When `gra_tax_enabled = true`: keep current flow (tax first, then buttons appear).

## 5. Agreements Download
**Files:**
- `src/pages/landlord/Agreements.tsx` — add two download buttons per tenancy: **Draft** (uses current draft state) and **Final** (uses signed/active agreement).
- Both call `generateAgreementPdf.ts` — Final variant always re-fetches latest `agreement_template_config` to reflect admin Template changes.
- Admin portal: ensure `DigitalSignatureDialog.tsx` and the agreement renderer always pull live `agreement_template_config` at generation time (already done previously; verify cache-busting).

## 6. Complaint Command Center
**A. Form 33 → SMS to respondent**
- File: `src/lib/pdf/form33.ts` or wherever Form 33 generation is triggered (likely `ComplaintWorkspace.tsx` / regulator complaint detail).
- After successful PDF generation + storage, look up respondent phone from `complaints.respondent_phone` (or related) and call `send-sms` edge function with templated message: "You have been summoned to Rent Control. Case #<ref>. Hearing date: <date>."

**B. My Cases — show generated forms**
- File: `src/pages/tenant/MyCases.tsx`
- Query `complaint_documents` where `complaint_id` matches and `document_type IN ('form_7','form_33')`; render with signed-URL download buttons via `EvidenceImage`/`openSignedStorageUrl` helpers.
- Ensure RLS on `complaint_documents` allows complainant SELECT (verify; add policy if missing).

## Technical Notes
- Migrations needed only if: (a) `feature_flags` missing `property_management` row, (b) `complaint_documents` RLS lacks complainant read policy.
- All other changes are frontend + edge-function calls.
- No schema changes to existing tables.

## Out of Scope
- Redesigns beyond the buttons/dialogs described.
- New notification channels beyond SMS for Form 33.

Confirm to proceed and I'll implement in this order: 1 → 4 → 5 → 6 → 2 → 3 (quickest wins first, then deeper workflow items).