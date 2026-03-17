

## Fix: Arkesel SMS Edge Function — Wrong API Format

**Problem**: The `send-sms` edge function uses the Arkesel V1 URL (`sms.arkesel.com/sms/api?action=send-sms`) with a JSON POST body, but V1 expects query-parameter-style requests. The API returns HTML instead of JSON, causing a parse error.

**Solution**: Switch to Arkesel V2 API which properly supports JSON POST requests.

### Changes

**1. Update `supabase/functions/send-sms/index.ts`**

- Change API URL from `https://sms.arkesel.com/sms/api?action=send-sms` → `https://api.arkesel.com/api/v2/sms/send`
- Move API key from request body to `api-key` header
- Change body format: use `recipients` (array of strings) instead of `to`, and `message` instead of `sms`
- Remove `action` from body
- Update success check from `data.code !== "ok"` to `data.status !== "success"`
- Add response text logging before JSON parse to aid debugging

### Technical Details

```text
Current (broken V1 format):
  POST https://sms.arkesel.com/sms/api?action=send-sms
  Body: { action, api_key, to, from, sms }

Fixed (V2 format):
  POST https://api.arkesel.com/api/v2/sms/send
  Headers: { api-key: ARKESEL_API_KEY }
  Body: { sender, message, recipients: ["233..."] }
```

After fixing, I'll re-test by calling the edge function with Benjamin's phone number (024678954).

