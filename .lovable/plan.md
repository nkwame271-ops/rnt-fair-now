

# Remaining Work: Arkesel SMS V2 Fix

Everything from the approved plans has been implemented **except** the Arkesel SMS edge function fix documented in `.lovable/plan.md`.

## Problem

`supabase/functions/send-sms/index.ts` still uses the **V1 API** (`sms.arkesel.com/sms/api?action=send-sms`) with query parameters. This returns HTML instead of JSON, causing parse errors. SMS messages (welcome messages, notifications) will fail.

## Fix

**File**: `supabase/functions/send-sms/index.ts`

- Change URL from `https://sms.arkesel.com/sms/api?...` → `https://api.arkesel.com/api/v2/sms/send`
- Move API key from query params to `api-key` header
- Use JSON POST body: `{ sender, message, recipients: [normalizedPhone] }`
- Update success check from `data.code !== "ok"` to `data.status !== "success"`
- Remove the `URLSearchParams` approach entirely

## Also Note (Non-Code)

**Google Maps**: The API key needs configuration in the Google Cloud Console — enable Maps JavaScript API, ensure billing is active, and add `*.lovable.app/*` and `*.lovableproject.com/*` to HTTP referrer restrictions. This can't be fixed in code.

