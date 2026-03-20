

# Fix: Switch to Arkesel V1 API (DNS Workaround) + Send Bulk SMS

## Problem
The edge function runtime cannot resolve `api.arkesel.com` (V2 endpoint). This is a platform-level DNS issue — not a code bug. It affects both `send-sms` and `bulk-welcome-sms`.

## Fix
Switch both functions to use the **Arkesel V1 GET-based API** at `sms.arkesel.com/sms/api` which uses a different domain that may resolve correctly. If that also fails, fall back to trying the IP-based approach or a different SMS gateway.

### V1 API format
```
GET https://sms.arkesel.com/sms/api?action=send-sms&api_key=KEY&to=233XXXXXXXXX&from=RentGhana&sms=MESSAGE
```

## Changes

| File | Change |
|---|---|
| `supabase/functions/send-sms/index.ts` | Add V1 fallback: try V2 first, if DNS fails, retry with V1 GET endpoint |
| `supabase/functions/bulk-welcome-sms/index.ts` | Same V1 fallback pattern |

After deploying, I'll send a test SMS to one number. If it works, I'll fire off all 13 one by one and report results.

## Execution Order
1. Update both functions with V1 fallback
2. Deploy both
3. Test with one number (Benjamin Boateng — 0247517843)
4. If successful, loop through remaining 12 numbers

