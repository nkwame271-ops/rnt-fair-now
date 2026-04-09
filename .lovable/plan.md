

# Plan: QR Code Verification Enhancement + Audio Recording Fix

## Issue 1: QR Code Links to Wrong URL / Missing Data

### Root Cause
Three problems identified:

1. **URL mismatch**: The PDF generates QR codes pointing to `https://www.rentcontrolghana.com/verify/tenancy/{registrationCode}` but the app route is `/verify-tenancy/:tenancyId`. The route param is named `tenancyId` and the edge function queries by `id` (UUID), not `registration_code`. So scanning the QR code with a registration code will always fail to find the tenancy.

2. **Missing data in verification page**: The `verify-tenancy` edge function only returns basic fields (names, rent, dates, rent cards). Missing: signed dates, property/unit details, agreement status labels (pending/final/rejected/archived/expired).

3. **No property or unit info displayed**: The verification page doesn't show property name, address, or unit type.

### Fix

**`src/lib/generateAgreementPdf.ts`**: Change QR URL to use the app's published domain and pass `propertyId` (the tenancy UUID, not registration code):
- Add `tenancyId` field to `AgreementPdfData` interface
- Change URL to: `https://rentghanapilot.lovable.app/verify-tenancy/{tenancyId}`
- Update all callers to pass `tenancyId`

**`supabase/functions/verify-tenancy/index.ts`**: Expand the query to also select:
- `landlord_signed_at`, `tenant_signed_at`, `landlord_accepted`, `tenant_accepted`
- Join to `units` table for `unit_name`, `unit_type`
- Join to `properties` table for `property_name`, `property_address`, `gps_address`, `ghana_post_gps`
- Compute a human-readable `agreement_status`: pending, final (both signed), rejected, archived, expired based on `status` field

**`src/pages/shared/VerifyTenancy.tsx`**: Expand the UI to display:
- Property name & address
- Unit name & type
- Landlord signed date, Tenant signed date
- Agreement status badge (Pending / Final / Rejected / Archived / Expired)
- Keep existing fields (rent cards, compliance, dates)

---

## Issue 2: Audio Recording Returns "Error"

### Root Cause
Two issues:

1. **Browser compatibility**: `audio/webm` is not supported on Safari/iOS. The `MediaRecorder` constructor will throw or produce unplayable files. No MIME type check or fallback is implemented.

2. **DeclareExistingTenancy only has file upload, no live recording**: The existing tenancy form only has `<Input type="file" accept="audio/*">` — no MediaRecorder-based recording. If the user is referring to complaints, the recording code looks correct but may fail on Safari due to webm.

### Fix

**All files with MediaRecorder** (`FileComplaint.tsx`, `LandlordComplaints.tsx`, `LandlordApplications.tsx`):
- Add MIME type detection: check `MediaRecorder.isTypeSupported('audio/webm')`, fall back to `audio/mp4` or `audio/ogg`
- Use the detected MIME type for both `new Blob()` and storage upload `contentType`
- Add `onerror` handler on MediaRecorder to show a clear toast

**`DeclareExistingTenancy.tsx`**: Add inline audio recording (MediaRecorder) alongside the existing file upload, matching the pattern from FileComplaint.

**Audio playback display**: Add audio playback in admin views where `audio_url` / `existing_voice_url` exists:
- `RegulatorComplaints.tsx`: display `<audio>` element when complaint has `audio_url`
- Admin tenancy detail views: display voice URL if `existing_voice_url` is present

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/generateAgreementPdf.ts` | Add `tenancyId` to interface, fix QR URL |
| `supabase/functions/verify-tenancy/index.ts` | Expand data: property, unit, signed dates, agreement status |
| `src/pages/shared/VerifyTenancy.tsx` | Display expanded verification info |
| `src/pages/tenant/FileComplaint.tsx` | Add MIME type detection for audio recording |
| `src/pages/landlord/LandlordComplaints.tsx` | Add MIME type detection for audio recording |
| `src/pages/landlord/LandlordApplications.tsx` | Add MIME type detection for audio recording |
| `src/pages/landlord/DeclareExistingTenancy.tsx` | Add inline audio recording with MIME detection |
| `src/pages/regulator/RegulatorComplaints.tsx` | Display audio playback for complaints with audio |
| Agreement PDF callers (3 files) | Pass `tenancyId` to PDF generation |

