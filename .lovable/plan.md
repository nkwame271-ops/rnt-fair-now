## Goal

Make all outbound SMS try sender ID **"RentControl"** first, and if Arkesel rejects it (error code 111 — "not allowed to use this Sender ID"), automatically retry the same message with sender ID **"R Control"**.

## Changes

### 1. `supabase/functions/send-sms/index.ts`
- Add a `SENDER_IDS = ["RentControl", "R Control"]` ordered list.
- Wrap the existing V2 → V1 send logic in a loop over `SENDER_IDS`:
  - For each sender, try V2; on network failure, try V1.
  - If the response indicates sender-ID rejection (Arkesel code `111` or message containing "not allowed to use this Sender ID"), move to the next sender in the list.
  - Any other failure (auth, balance, bad number) breaks out — no point retrying with another sender.
- Keep the caller-supplied `sender` parameter as a one-shot override (no fallback chain when caller pins a sender explicitly).
- Log which sender ID ultimately succeeded so we can monitor Arkesel approval status.

### 2. `supabase/functions/_shared/sms.ts` (if it exists / shared helper)
- Mirror the same fallback list so any function importing the helper inherits the behavior. (I'll confirm during build whether a shared module exists.)

### 3. `supabase/functions/send-notification/index.ts`
- No change needed — it already delegates to `send-sms`, so the fallback applies transparently.

### 4. Verification
- After deploy, fire two test SMS via `send-sms` to `0243973435`:
  1. Default flow (should land on whichever sender Arkesel currently allows).
  2. Check edge-function logs to confirm which sender succeeded.

## Note on "R Control"

Arkesel sender IDs traditionally disallow spaces and cap at 11 characters. "R Control" is 9 chars including the space — it may itself be rejected by Arkesel until they whitelist it on their side. The fallback code will be in place regardless; if Arkesel rejects both, you'll need to confirm with their support which exact strings are approved on the account.
