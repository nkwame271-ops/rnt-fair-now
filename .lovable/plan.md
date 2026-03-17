

# Fix Plan: 4 Issues

## 1. File Complaint — Add Audio Recording + Image Uploads

**File**: `src/pages/tenant/FileComplaint.tsx`

- Add audio recording using the browser's `MediaRecorder` API (record/stop/playback controls) on the Description step (step 3)
- Add image upload (multiple files) using the existing `application-evidence` storage bucket, with preview thumbnails
- Add `evidence_urls` and `audio_url` columns to the `complaints` table (migration needed — `evidence_urls text[] DEFAULT '{}'`, `audio_url text`)
- Upload files to `application-evidence` bucket on submit, store URLs in complaint record
- The `complaints` table already has no evidence columns, so a migration is required

**DB Migration**:
```sql
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS evidence_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audio_url text;
```

## 2. Double Payment Page After Registration

**Problem**: After paying on `RegisterTenant`/`RegisterLandlord` (step 3), Paystack redirects back. The user is now authenticated but the webhook may not have processed yet, so `ProtectedRoute` shows **another** payment screen.

**Fix in `src/components/ProtectedRoute.tsx`**:
- On return from payment (`?status=success` or `?trxref` param from Paystack), assume payment is processing and let the user through temporarily, or show a "Payment being confirmed..." screen with polling instead of another pay button
- Add Paystack's `trxref`/`reference` URL params as a signal that payment just happened
- Poll `registration_fee_paid` every 3 seconds for up to 30 seconds before showing the pay screen

## 3. Registration Page Left Panel — Correct Benefits List

**Problem**: Left panel shows 6 benefits (Marketplace, ID card, Rent card, Complaint system, Agreement mgmt, 12-month access). User wants only 2: **Tenant/Landlord ID Card** and **12-month platform access**.

**Files**: `src/pages/RegisterTenant.tsx` (lines 163-169), `src/pages/RegisterLandlord.tsx` (lines 158-164)

- Reduce the benefits list to just those 2 items
- Also update the `registrationBenefits` array in `src/components/ProtectedRoute.tsx` (lines 20-27) to match

## 4. Google Maps "Can't Load Correctly" Error

**Problem**: The Google Maps API key `AIzaSyBbj3EaLVeMViYbbn8Zrzgqu1qg4OMSLQ4` is showing "This page can't load Google Maps correctly" — this typically means the API key has billing issues or domain restrictions.

**Fix in `src/lib/googleMaps.ts`**:
- This is likely an external API key configuration issue (billing not enabled, or domain not authorized). Code-side, we can't fix a billing issue.
- However, we can add a graceful error state in `PropertyLocationPicker.tsx` that shows a helpful message instead of the broken map, and allows manual coordinate entry as a fallback when the map fails to load.

---

## Files Summary

| File | Change |
|------|--------|
| DB migration | Add `evidence_urls`, `audio_url` to `complaints` |
| `src/pages/tenant/FileComplaint.tsx` | Add audio recorder + image upload UI |
| `src/components/ProtectedRoute.tsx` | Fix double-payment by detecting payment return + polling; update benefits list |
| `src/pages/RegisterTenant.tsx` | Reduce left panel benefits to 2 items |
| `src/pages/RegisterLandlord.tsx` | Reduce left panel benefits to 2 items |
| `src/components/PropertyLocationPicker.tsx` | Add graceful fallback when Google Maps fails |

