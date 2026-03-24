

# Fix: SMS Not Received After Signup

## Root Cause

The `send-notification` edge function (which handles post-signup SMS) only calls the Arkesel **V2 API**. The separate `send-sms` edge function has a V1 fallback for when V2 fails due to DNS/network issues on the platform, but `send-notification` does not.

When V2 fails silently (network error caught and logged), no SMS is delivered and no fallback is attempted.

## Fix

### `supabase/functions/send-notification/index.ts`

Update the `sendSms` function (lines 241-258) to mirror the V2-then-V1 fallback pattern already used in `send-sms/index.ts`:

1. Try Arkesel V2 API first (`https://api.arkesel.com/api/v2/sms/send`)
2. On failure, fall back to V1 API (`https://sms.arkesel.com/sms/api?action=send-sms&...`)
3. Log which path succeeded for debugging

This is a single-function change with no database or UI impact.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/send-notification/index.ts` | Add V1 fallback to `sendSms` function |

