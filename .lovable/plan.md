

# Multi-Feature Implementation Plan

## Overview
Five major areas: Registration improvements, Agreement security and digital signatures, Complaint scheduling, Engine Room integration, and non-citizen registration fix.

---

## 1. Registration: Non-Citizen Support

**Problem**: Both `RegisterTenant.tsx` and `RegisterLandlord.tsx` lack nationality/citizenship fields. The `profiles` table has `is_citizen` (default true), `nationality`, and `residence_permit_no` columns, but registration forms never set them.

**Changes**:
- **RegisterTenant.tsx** and **RegisterLandlord.tsx**: Add a "Nationality" toggle (Ghanaian Citizen / Non-Citizen) on step 0. When "Non-Citizen" is selected, show nationality text input and residence permit number field. On account creation, update profile with `is_citizen`, `nationality`, and `residence_permit_no`.

---

## 2. Registration: Phone OTP Verification

**Changes**:
- **New edge function `send-otp/index.ts`**: Generates a 6-digit OTP, stores it in a new `otp_verifications` table (phone, code, expires_at, verified), sends via Arkesel SMS.
- **New edge function `verify-otp/index.ts`**: Validates OTP against the table, marks as verified.
- **Database migration**: Create `otp_verifications` table (id, phone, code, expires_at, verified, created_at) with anon insert + service_role manage policies.
- **RegisterTenant.tsx** and **RegisterLandlord.tsx**: After phone input, add "Verify Phone" button. On click, call `send-otp`. Show OTP input (6-digit InputOTP component). On correct entry, mark phone as verified. Block "Continue" until phone is verified.
- **Engine Room**: Add `phone_otp_verification` feature flag so admin can enable/disable OTP requirement.

---

## 3. Registration: Custom Password

**Problem**: Currently uses phone number as temp password.

**Changes**:
- **RegisterTenant.tsx** and **RegisterLandlord.tsx**: Add a password field (with show/hide toggle) and confirm password field on step 0. Use user-entered password instead of `phoneDigits` as the password in `supabase.auth.signUp()`. Update the success step to remove "Temp Password: Your full phone number" messaging.
- Enforce minimum 8 characters.

---

## 4. Tenancy Agreement: QR Code + Serial Security

**Changes**:
- **`src/lib/generateAgreementPdf.ts`**: Add QR code to PDF using `qrcode` library. QR encodes a verification URL: `https://www.rentcontrolghana.com/verify/tenancy/{registration_code}`. Add a unique serial code (e.g., `AGR-2026-XXXXX-XXXX`) displayed prominently. Add "ORIGINAL DOCUMENT" watermark. Add anti-duplication text: "This document has a unique serial. Verify authenticity at rentcontrolghana.com/verify".
- **`AgreementPdfData` interface**: Add `landlordSignature` and `tenantSignature` fields (name-based text signatures with timestamps).
- Install `qrcode` npm package for QR generation.

---

## 5. Combined Tenancy + Digital Signature Workflow

This is the largest change — restructuring the tenancy creation flow into a multi-step lifecycle.

### Database Changes
- **New `tenancy_signatures` table**: id, tenancy_id, signer_user_id, signer_role (landlord/tenant), signature_method (passkey/otp/password), device_info (jsonb), ip_address, signed_at, signature_hash.
- **Add columns to `tenancies`**: `landlord_signed_at`, `tenant_signed_at`, `agreement_version` (integer default 1), `final_agreement_pdf_url`, `execution_timestamp`.

### Workflow Implementation

**Landlord side (`AddTenant.tsx`)**:
- After "Generate & Send to Tenant", system auto-applies landlord signature (recorded in `tenancy_signatures`), sets status to `pending_tenant_review`, locks core terms.
- Sends SMS + email + in-app notification to tenant.

**Tenant side (`MyAgreements.tsx`)**:
- Pending agreements show full details with Accept / Reject options.
- **Accept flow**:
  1. Tenant clicks "Accept and Continue"
  2. Tax payment via Paystack (existing flow)
  3. On payment success, show "I Agree and Sign" button
  4. **Digital signature authentication**: Primary — WebAuthn/Passkey (fingerprint, Face ID). Fallback — OTP sent to phone.
  5. On successful auth, record signature event in `tenancy_signatures` (timestamp, device, method)
  6. Generate final agreement (Version 2) with both signatures, QR code, serial
  7. Status becomes `active`, both parties notified, document locked
- **Reject flow**: Status set to `rejected`, landlord notified.

**Post-execution**:
- Both parties receive final PDF (stored in Supabase storage)
- Tenancy card issued (existing flow)
- Agreement becomes immutable (no edits allowed)

### Engine Room
- Add `digital_signatures` feature flag to enable/disable the signing workflow
- Add `passkey_auth` feature flag for passkey vs OTP-only signing

---

## 6. Admin Complaints: Schedule Complainant

### Database Changes
- **New `complaint_schedules` table**: id, complaint_id, complaint_type (tenant/landlord), created_by (admin uuid), available_slots (jsonb array of {date, time_start, time_end}), selected_slot (jsonb), selected_by (user uuid), selected_at, status (pending_selection/confirmed/completed), created_at.

### Admin Side (`RegulatorComplaints.tsx`)
- Add `schedule_complainant` to status options for both tenant and landlord complaints.
- When selected, show a calendar/time picker modal where admin selects multiple available date+time slots.
- Save slots to `complaint_schedules` table.
- Send notification to complainant about available times.
- Update "All Status" filter to include `schedule_complainant`.

### Tenant/Landlord Dashboard
- Show banner/card when a complaint has `schedule_complainant` status with available slots.
- User can pick one slot from the available times.
- On selection, update `complaint_schedules` with chosen slot, notify admin.
- Show confirmed appointment details.

### Engine Room
- Add `complaint_scheduling` feature flag.

---

## Summary of Files Changed

| Area | Files |
|---|---|
| Registration (non-citizen, OTP, password) | `RegisterTenant.tsx`, `RegisterLandlord.tsx`, new `send-otp/index.ts`, new `verify-otp/index.ts` |
| Agreement PDF (QR, serial, signatures) | `generateAgreementPdf.ts` |
| Digital signature workflow | `AddTenant.tsx`, `MyAgreements.tsx`, new `tenancy_signatures` migration |
| Complaint scheduling | `RegulatorComplaints.tsx`, `TenantDashboard.tsx`, `LandlordDashboard.tsx`, new `complaint_schedules` migration |
| Engine Room integration | `EngineRoom.tsx` + feature_flags data inserts |
| Database | 3 migrations: `otp_verifications`, `tenancy_signatures` + tenancies columns, `complaint_schedules` |

### New npm packages
- `qrcode` (for QR code generation in PDFs)

