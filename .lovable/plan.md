

## KYC Verification Flow — Issues Found

After reviewing the full codebase and database, I identified **one critical bug** that will break the regulator's ability to review KYC submissions. The tenant-side upload and selfie capture code looks correct after the recent fixes.

---

### Critical Bug: Regulator KYC Review Shows Broken Images

**Problem**: The `identity-documents` storage bucket is **private**. The `KycVerificationCard.tsx` now correctly stores **file paths** (e.g., `user-id/ghana-card-front-123.jpg`) in the database instead of public URLs. However, `RegulatorKyc.tsx` still uses those stored values directly as `<img src={...}>` — which will fail because they're just paths, not accessible URLs.

**Lines affected**: `RegulatorKyc.tsx` lines 181, 187, 193 — all three `<img>` tags in the review dialog.

**Fix**: When a regulator opens the review dialog, generate **signed URLs** from the stored file paths using `supabase.storage.from("identity-documents").createSignedUrl(path, 600)`. This gives temporary 10-minute access to view the images.

### Changes

1. **`src/pages/regulator/RegulatorKyc.tsx`**:
   - Add a `signedUrls` state object (`{ front: string, back: string, selfie: string }`)
   - When `selectedRecord` is set (review dialog opens), call `createSignedUrl` for each of the 3 file paths
   - Replace the direct `src={selectedRecord.ghana_card_front_url}` references with the signed URL state values
   - Show a loading spinner while signed URLs are being generated

### No other changes needed

- **Selfie camera**: The implementation with `onPlaying`, `cameraReady` state, `muted` attribute, and explicit `play()` call is correct. The capture button is properly disabled until the stream is active.
- **Photo upload**: Files upload to the private bucket correctly. The paths are stored in the database. The `kyc-face-match` edge function already uses the service role to generate signed URLs for AI processing.
- **KycVerificationCard.tsx**: Already stores paths (not public URLs) and passes paths to the face-match function — this is correct.

---

### Technical Detail

```text
Current flow (broken):
  DB stores: "user-id/ghana-card-front-123.jpg"
  RegulatorKyc.tsx: <img src="user-id/ghana-card-front-123.jpg" />  ← 404

Fixed flow:
  DB stores: "user-id/ghana-card-front-123.jpg"
  RegulatorKyc.tsx: createSignedUrl("user-id/ghana-card-front-123.jpg")
                    → <img src="https://...supabase.co/storage/...?token=..." />  ← works
```

