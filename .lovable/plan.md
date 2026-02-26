

## KYC Verification Flow — End-to-End Fix Plan

After investigating the code, database, and RLS policies, I found the root cause of the "Submit for Verification" button not working, plus additional issues to fix.

---

### Critical Bug: RLS Policy Blocks Resubmission After Rejection

The `kyc_verifications` table has this UPDATE policy:

```
"Users can update own pending kyc" → USING ((auth.uid() = user_id) AND (status = 'pending'))
```

When a regulator **rejects** a KYC submission, the status becomes `'rejected'`. The UI correctly shows the form again for resubmission, but when the user clicks "Submit for Verification," the code tries to **update** the existing record (line 154). The RLS policy blocks this because `status = 'rejected'`, not `'pending'`. The update silently fails — no error is shown because the code doesn't check the result.

### Bug #2: Silent Failures in handleSubmit

Lines 153-173 of `KycVerificationCard.tsx` perform `update` or `insert` without checking for errors. If RLS blocks the operation, the user sees "KYC documents submitted!" but nothing actually saved.

---

### Changes

**1. Fix RLS policy on `kyc_verifications`** (database migration)

Drop the restrictive update policy and replace it with one that allows users to update their own record when status is `pending` OR `rejected`:

```sql
DROP POLICY "Users can update own pending kyc" ON kyc_verifications;
CREATE POLICY "Users can update own non-verified kyc"
  ON kyc_verifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending', 'rejected'));
```

**2. Fix error handling in `KycVerificationCard.tsx`**

In `handleSubmit`, capture the `error` from both the `update` and `insert` calls and throw if present. This ensures the user sees a proper error toast instead of a false success message.

```typescript
// For update:
const { error } = await supabase.from("kyc_verifications").update({...}).eq("id", kyc.id);
if (error) throw error;

// For insert:
const { error } = await supabase.from("kyc_verifications").insert({...});
if (error) throw error;
```

**3. No other changes needed**

- Storage bucket policies are correct — users can upload to their own folder, regulators can read all docs
- `RegulatorKyc.tsx` already generates signed URLs for the review dialog (verified in current code)
- Camera/selfie capture code is correct with `onPlaying`, `cameraReady`, and `muted` attributes
- The `kyc-face-match` edge function works (logs show successful 90% match score)
- The KycGate component correctly gates actions behind verification

---

### Technical Summary

```text
Current flow (broken for resubmission):
  User rejected → clicks "Submit" → UPDATE where status='rejected'
  → RLS blocks (only allows status='pending') → silent failure → false success toast

Fixed flow:
  User rejected → clicks "Submit" → UPDATE where status IN ('pending','rejected')
  → RLS allows → files upload → AI match runs → record updated → real success
  → error handling catches any failure → proper error toast
```

