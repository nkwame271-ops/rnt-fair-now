

# Multi-Feature Update: Complaints, Agreements, Escrow, Applications & NIA API Readiness

## Overview

This plan addresses 10+ distinct improvements across Admin, Landlord, Tenant portals, Escrow dashboard, and system architecture for NIA Ghana Card API integration.

---

## 1. Complaint Scheduling Reminder on Dashboards

**Problem**: When admin schedules an appointment, the reminder only shows when complaint has `schedule_complainant` status. Admin dashboard doesn't show upcoming appointments at all.

**Changes**:
- **RegulatorDashboard.tsx**: Add an "Upcoming Appointments" section that queries `complaint_schedules` with status `confirmed` or `pending_selection`, showing complaint code, complainant name, and selected/available slot dates
- **RegulatorComplaints.tsx**: Show a small badge/indicator on complaints that have active schedules
- **TenantDashboard.tsx** and **LandlordDashboard.tsx**: Already handled via `AppointmentSlotPicker` component — verify it also shows confirmed appointments (not just pending selection)

---

## 2. Final Signed Agreement Sent to Admin

**Problem**: Admin sees agreement PDFs but may not get the final Version 2 (both signatures) automatically.

**Changes**:
- **DigitalSignatureDialog.tsx**: After tenant signs (both OTP and passkey paths), generate the final Version 2 PDF using `generateAgreementPdf` and upload it to storage, then update `tenancies.final_agreement_pdf_url` with the storage path
- **RegulatorAgreements.tsx**: Add a "Download Final" button that uses `final_agreement_pdf_url` when available (Version 2), distinct from the draft download

---

## 3. Escrow Revenue by Type

**Problem**: Revenue is shown only by recipient split (IGF, Admin, Platform, etc.), not by payment type (rent cards, registrations, quit notices, tenancy agreement fees).

**Changes**:
- **EscrowDashboard.tsx**: Add a new "Revenue by Type" section that aggregates `escrow_transactions` by `payment_type`, showing:
  - Rent Card Sales (`rent_card`)
  - Registrations (`tenant_registration`, `landlord_registration`)
  - Quit Notices / Ejection (`termination_fee`)
  - Tenancy Agreement Fee (`agreement_sale`, `add_tenant_fee`)
- Display as a card grid similar to the allocation summary, with totals per type

---

## 4. Hide Platform Revenue from Regular Admins

**Problem**: Platform revenue is visible on the Escrow Dashboard to all regulators.

**Changes**:
- **EscrowDashboard.tsx**: Check `is_main_admin()` — only show the "Platform" allocation card if user is main_admin. For office revenue table, hide the Platform column for non-main admins
- Add a new `platform_revenue_visible` check: only users in `admin_staff` with `admin_type = 'main_admin'` see platform splits. Sub-admins see IGF, Admin, GRA, and Landlord only
- The data remains in the system — only the UI visibility changes

---

## 5. Final Signed Agreement to Landlord Dashboard

**Problem**: After tenant signs, landlord doesn't get the final signed copy.

**Changes**:
- **Agreements.tsx (landlord)**: When displaying active tenancies, check for `final_agreement_pdf_url`. If present, show a "Download Signed Agreement" button that fetches from storage. This reuses the same URL set in item #2 above
- The PDF generation in `DigitalSignatureDialog` already covers creating this file

---

## 6. Archive Search Application Type with Paywall

**Problem**: No "Archive Search" application type exists. It needs a fee.

**Changes**:
- **LandlordApplications.tsx**: Add `{ value: "archive_search", label: "Archive Search" }` to `applicationTypes`
- **Engine Room**: Add a new feature flag row `archive_search_fee` with `category: 'fees'`, `fee_enabled: true`, default `fee_amount: 20` (adjustable)
- **LandlordApplications.tsx**: Before submitting an `archive_search` application, check the fee flag. If enabled and amount > 0, redirect to `paystack-checkout` with `type: "archive_search_fee"` before the application is created
- **paystack-checkout/index.ts**: Add `archive_search_fee` to the supported payment types with appropriate split rules
- **Database**: Insert the new feature flag row via insert tool

---

## 7. Tax Payment Required Before Signing

**Problem**: Currently tenant can accept and sign without paying rent tax first. Agreement should only be valid after tax payment.

**Changes**:
- **DigitalSignatureDialog.tsx / MyAgreements.tsx**: Before opening signature dialog, check if the first rent tax payment has been made. Query `rent_payments` for the tenancy — if no payment with `status = 'confirmed'` exists, block signing and show "Pay rent tax first" message with a link to the Payments page
- **handleAcceptAndPay**: Modify flow to: Accept → Redirect to payment → On return, allow signing
- The agreement status remains `pending` until both tax is paid AND signature is completed

---

## 8. Rent Cards on Tenancy Agreement PDF

**Problem**: Rent card serial numbers assigned to the tenancy don't appear on the agreement PDF.

**Changes**:
- **generateAgreementPdf.ts**: Add optional `rentCardSerials` field to `AgreementPdfData` interface. When present, render "Rent Card (Landlord Copy): XXX" and "Rent Card (Tenant Copy): XXX" on the PDF
- **MyAgreements.tsx & Agreements.tsx (landlord)**: When building PDF data, fetch `rent_cards` linked to the tenancy (`rent_card_id` and `rent_card_id_2` on tenancies table) and pass their serial numbers to the PDF generator

---

## 9. Tenancy Card on Tenant Dashboard After Payment & Signing

**Problem**: Tenancy card may not appear if conditions aren't met after signing.

**Changes**:
- **TenantDashboard.tsx**: Currently fetches tenancy card data for active tenancies. Verify it also works for newly signed tenancies (status changes to `active` after signing). The existing code already handles this — confirm the status list includes `active`. This is already correct in the current code (line 38 includes `active`).
- No code change needed — this already works. The tenancy card appears once status is `active`.

---

## 10. Fix "Unknown" Landlord Name on Tenant Agreement

**Problem**: Landlord name shows as "Unknown" on tenant dashboard agreements.

**Changes**:
- **MyAgreements.tsx**: The code already fetches landlord profile (line 77). The issue is likely a missing profile record or the query failing silently. Add error logging. Also check if landlord profile query returns null — if so, try fetching from `landlords` table joined with profiles
- Verify the `landlordName` is set correctly at line 91: `landlordProfile?.full_name || "Unknown"` — this should work. May need to verify data integrity

---

## 11. NIA Ghana API Readiness

**Problem**: System needs to be ready to plug in the NIA (National Identification Authority) API for Ghana Card verification.

**Changes**:
- **KycVerificationCard.tsx**: Add a step after Ghana Card number entry that calls a new edge function `verify-ghana-card` to validate the card number against NIA
- **New edge function `verify-ghana-card/index.ts`**: Stub function that:
  - Accepts `{ ghana_card_number: string, full_name: string }`
  - Checks for `NIA_API_KEY` and `NIA_API_URL` secrets
  - If secrets exist, calls the NIA API endpoint
  - If secrets don't exist, returns `{ verified: false, reason: "NIA API not configured", stub: true }` — allowing the system to function without the API while being ready for it
  - Stores verification result in a new column `kyc_verifications.nia_verified` (boolean) and `nia_response` (jsonb)
- **Database migration**: Add `nia_verified boolean DEFAULT false` and `nia_response jsonb` columns to `kyc_verifications`
- **RegulatorKyc.tsx**: Show NIA verification status badge alongside AI match badge
- **config.toml**: Add `verify-ghana-card` function entry

---

## Files Changed Summary

| Area | Files |
|---|---|
| Admin Dashboard | `RegulatorDashboard.tsx` — upcoming appointments section |
| Admin Agreements | `RegulatorAgreements.tsx` — final signed PDF download |
| Escrow | `EscrowDashboard.tsx` — revenue by type + hide platform for sub-admins |
| Landlord Agreements | `Agreements.tsx` — download signed agreement |
| Landlord Applications | `LandlordApplications.tsx` — archive_search type + paywall |
| Tenant Agreements | `MyAgreements.tsx` — tax-before-sign gate, rent card serials, landlord name fix |
| Signing Flow | `DigitalSignatureDialog.tsx` — generate + upload final PDF, tax payment check |
| PDF Generator | `generateAgreementPdf.ts` — rent card serial fields |
| Checkout | `paystack-checkout/index.ts` — archive_search_fee type |
| NIA Stub | `supabase/functions/verify-ghana-card/index.ts` (new) |
| KYC | `KycVerificationCard.tsx` — NIA verification step |
| KYC Admin | `RegulatorKyc.tsx` — NIA status badge |
| Database | Migration: add NIA columns to kyc_verifications |
| Database | Insert: archive_search_fee feature flag |
| Config | `supabase/config.toml` — verify-ghana-card function |

---

## Database Changes

### Migration: NIA columns on kyc_verifications
```sql
ALTER TABLE public.kyc_verifications ADD COLUMN nia_verified boolean DEFAULT false;
ALTER TABLE public.kyc_verifications ADD COLUMN nia_response jsonb;
```

### Insert: Archive search fee flag
```sql
INSERT INTO public.feature_flags (feature_key, label, description, category, is_enabled, fee_enabled, fee_amount)
VALUES ('archive_search_fee', 'Archive Search Fee', 'Fee charged for archive search applications', 'fees', true, true, 20);
```

