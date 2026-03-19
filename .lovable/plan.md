

# Plan: Landlord Voice Notes + Full Phone Number as Temp Password

## Change 1: Landlord Complaints — Voice Note Recording

Add voice recording capability to the landlord complaint form, matching the existing pattern in tenant FileComplaint.

### Database
- Add `audio_url` column (text, nullable) to `landlord_complaints` table via migration

### Frontend (`src/pages/landlord/LandlordComplaints.tsx`)
- Add audio recording state (isRecording, audioBlob, audioUrl, mediaRecorderRef, chunksRef)
- Add startRecording/stopRecording/deleteRecording handlers (same pattern as FileComplaint)
- Add voice recording UI in the dialog: record button, playback preview, delete option
- Upload audio blob to `application-evidence` storage on submit, store URL in `audio_url` field

---

## Change 2: Temp Password = Full Phone Number

Currently the temp password is `phoneDigits.slice(-6)` (last 6 digits). Change to full 10-digit phone number.

### Files to update:
1. **`src/pages/RegisterTenant.tsx`** (line 76): Change `phoneDigits.slice(-6)` → `phoneDigits`
2. **`src/pages/RegisterLandlord.tsx`** (line 74): Same change
3. **`src/lib/smsService.ts`** (line 13): Update SMS template from "last 6 digits of your phone" → "your full phone number"
4. **`src/pages/Login.tsx`** (line 187): Update hint text from "last 6 digits" → "your full phone number"
5. **`src/pages/RegisterTenant.tsx`** (line 402): Update success screen text
6. **`src/pages/RegisterLandlord.tsx`** (line 358): Update success screen text

Note: The signup email template doesn't mention the temp password, so no email change needed.

