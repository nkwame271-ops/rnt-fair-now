# Surface Arkesel SMS Failures Clearly on Signup

## Problem (verified in code)
`send-notification` already returns `channels.sms: "failed"` plus a raw `sms_error`, and both signup pages show a generic toast ("welcome SMS could not be delivered"). Two gaps make failures effectively silent:

1. The error string handed back is an internal blob (`V2: ... | V1: ...`) that is never shown, so nobody can tell whether the cause is sender-ID rejection, no credit, a bad number, or a dead endpoint.
2. Arkesel is only treated as failed when it returns a non-success status. A response Arkesel accepts but never delivers is recorded as `"sent"`, so no signal reaches the UI at all.

## What will change

### 1. Classify the failure reason (`send-notification`)
Map Arkesel's response into a small set of explicit reasons instead of a raw string:
- `no_api_key` — key not configured
- `sender_rejected` — sender ID not approved (code 111)
- `insufficient_balance` — Arkesel reports low/zero credit
- `invalid_recipient` — malformed/unroutable number
- `provider_unreachable` — network/DNS/HTTP failure on both v2 and v1
- `provider_error` — anything else, with Arkesel's own message kept verbatim

Return `sms_error` as `{ reason, message, sender_tried }` and keep a human-readable `sms_error_text`. Log one clear `console.error` line per failure containing the reason, the sender tried, the masked recipient, and Arkesel's raw message (never the API key).

### 2. Treat "accepted but not delivered" as suspicious
When Arkesel returns success, capture the returned message/campaign id and include it in the response. If the response carries no id at all, mark the SMS `"unconfirmed"` rather than `"sent"` so the UI can distinguish real acceptance from a hollow one.

### 3. Fail loudly at signup
In `RegisterTenant.tsx` and `RegisterLandlord.tsx`:
- On `failed`, show a persistent error toast naming the actual reason and telling the user their account exists and they can sign in with their phone number (no silent pass-through).
- On `unconfirmed`, show a warning toast advising they may not receive the SMS and to contact the nearest Rent Control office.
- Console-log the structured reason so it is visible in diagnostics.

### 4. Shared typing
Widen `NotificationResult` in `src/lib/notificationService.ts` to include the structured `sms_error` and the `unconfirmed` SMS state so all callers get the same contract.

## Scope notes
- No secret changes, no Arkesel account changes, no other edge functions touched in this step.
- Registration itself still succeeds — the account is never rolled back because SMS failed; only the messaging becomes explicit.
