

# Fix: OTP "Invalid or expired" Error

## Root Cause Analysis

Testing confirms the OTP flow works mechanically. The real issues are:

1. **OTP gets deleted on resend**: `send-otp` deletes ALL previous OTPs for the phone before inserting a new one. If the user hits "Resend" or the app calls `send-otp` twice (e.g., navigating back and re-submitting), the first OTP is destroyed. The user then enters the old code from the first SMS → "Invalid."

2. **Indistinguishable errors**: `verify-otp` returns the same "Invalid or expired OTP" for ALL failure reasons: wrong code, already verified, expired, or no OTP found. This makes debugging impossible.

3. **No retry protection**: After a successful verification (`verified = true`), any second call to `verify-otp` fails because it filters for `verified = false`. If the app's response handler retries or the user double-clicks, they see the error even though verification succeeded.

## Fix

### `supabase/functions/verify-otp/index.ts` — Specific error messages + tolerant matching

Instead of one combined query with all filters, do a stepped lookup:
1. Find the latest OTP for this phone (no code/verified/expiry filter)
2. If none found → "No verification code found for this number"
3. If found but already verified → return `{ verified: true }` (idempotent success)
4. If found but expired → "Verification code has expired. Please request a new one"
5. If found but code doesn't match → "Incorrect verification code"
6. If all pass → mark as verified, return success

### `supabase/functions/send-otp/index.ts` — Soft-delete instead of hard-delete

Instead of `DELETE` old OTPs, only delete OTPs that are already `verified = true` or expired. Keep the current unverified+unexpired OTP alive so resend doesn't break an in-progress verification. If an unexpired OTP exists, just update its code and reset expiry (upsert pattern).

## Files

| File | Action |
|------|--------|
| `supabase/functions/verify-otp/index.ts` | Rewrite with stepped lookup and specific error messages |
| `supabase/functions/send-otp/index.ts` | Change delete to upsert pattern — update existing unexpired OTP code instead of deleting |

No frontend changes needed — the error messages will flow through to the UI automatically.

