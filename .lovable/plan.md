

## Plan: Fix Bulk Advance Payment, KYC Photo Upload & Selfie Issues

This plan addresses three distinct issues you raised.

---

### Issue 1: Bulk Advance Rent Tax Payment (Pay All 6 Months at Once)

**Current behavior**: The Payments page shows individual monthly payments and lets tenants pay tax one month at a time via a "Next Payment" button.

**Required behavior**: A single "Pay All Advance Tax" button that charges the total 8% tax for all advance months (e.g., 6 months) in one Paystack transaction. After payment, all advance month records get marked as paid.

**Changes**:

1. **`supabase/functions/paystack-checkout/index.ts`** — Add a new payment type `rent_tax_bulk`:
   - Accept `tenancyId` instead of a single `paymentId`
   - Query all unpaid `rent_payments` for the advance period
   - Sum the total tax across all unpaid advance months
   - Create a single Paystack transaction for the total
   - Store comma-separated payment IDs in the reference (e.g., `rentbulk_<tenancyId>`)

2. **`supabase/functions/paystack-webhook/index.ts`** — Handle the `rentbulk_` reference:
   - On successful payment, query all unpaid advance-period `rent_payments` for that tenancy
   - Mark all of them as `tenant_marked_paid: true` in one update

3. **`src/pages/tenant/Payments.tsx`** — Replace per-month payment with bulk:
   - Replace the "Next Payment" card with a "Pay All Advance Tax" card showing the total tax for all unpaid advance months
   - Single button: "Pay GH₵ X Online" (total tax for all advance months)
   - Call the edge function with `{ type: "rent_tax_bulk", tenancyId }`
   - Keep the payment schedule list below for visibility, but remove per-row pay buttons

---

### Issue 2: Photo Upload Fails (Private Storage Bucket)

**Root cause**: The `identity-documents` storage bucket is **private** (not public). The code uses `getPublicUrl()` which generates a URL, but that URL returns a 400/403 error because the bucket is private. This means:
- Ghana Card front/back images upload successfully but their URLs are inaccessible
- The AI face-match function receives broken URLs and fails silently

**Fix**:

4. **Database migration** — Add RLS policies for the `identity-documents` bucket:
   - Allow authenticated users to upload to their own folder (`user_id/*`)
   - Allow authenticated users to read their own files
   - Allow service role (edge functions) to read any file

5. **`src/components/KycVerificationCard.tsx`** — Use signed URLs instead of public URLs:
   - After uploading, call `supabase.storage.from("identity-documents").createSignedUrl(path, 3600)` to get a temporary accessible URL
   - Pass these signed URLs to the face-match function
   - Store the file paths (not public URLs) in the `kyc_verifications` table, since the bucket is private

6. **`supabase/functions/kyc-face-match/index.ts`** — Use service-role client to generate signed URLs:
   - Create a Supabase client with the service role key
   - Generate signed URLs from the stored file paths to pass to the AI vision model

---

### Issue 3: Live Selfie Camera Not Working

**Root cause**: The previous fix added a video dimension check, but there's a deeper issue — the `<video>` element's `autoPlay` may not trigger on mobile browsers without user interaction, and the `srcObject` assignment may happen before the ref is attached.

**Fix**:

7. **`src/components/KycVerificationCard.tsx`** — Improve camera reliability:
   - Add an `onLoadedMetadata` / `onPlaying` event handler on the `<video>` element to confirm the stream is active
   - Show a "Camera loading..." indicator until the video is actually playing
   - Disable the "Capture" button until `videoWidth > 0`
   - Add `muted` attribute to the video element (required by some browsers for autoplay)
   - Use `video.play()` explicitly after setting `srcObject` as a fallback

---

### Technical Summary

| Area | Files Changed |
|------|--------------|
| Bulk payment | `paystack-checkout/index.ts`, `paystack-webhook/index.ts`, `Payments.tsx` |
| Photo upload | Migration (storage RLS), `KycVerificationCard.tsx`, `kyc-face-match/index.ts` |
| Selfie camera | `KycVerificationCard.tsx` |

