# Downtime apology SMS to today's sign-ins

Send a short SMS, one recipient at a time, to every user who signed in today, telling them the platform was down for an upgrade and is back up.

## Audience (verified)

- 32 accounts have a sign-in recorded today; 29 of them have a phone number on their profile.
- Failed login attempts are not individually recoverable from the auth logs (only 7 auth log entries exist for the last 24h), so the audience is "accounts with a sign-in timestamp today". The 3 without a phone number are skipped and reported.

## Message draft (157 chars, single SMS segment)

```text
RentControlGhana: Our system was briefly down today for a scheduled upgrade. Everything is back up and running. Thank you for your patience. - Rent Control
```

Sender ID stays `RentControl` (the approved Arkesel sender).

## How it sends

1. Add an `action: "downtime-notice"` mode to the existing admin SMS function (regulator-only, already auth-guarded).
2. It selects the audience server-side (sign-in today + non-empty phone), normalises each number to `233XXXXXXXXX`, and de-duplicates.
3. Sends **strictly sequentially** — one Arkesel request per recipient with a small delay between them, not a bulk/batch payload.
4. Each send is logged to `sms_send_log` with the recipient, status and any provider error, and the run is recorded in the admin audit log.
5. Re-running is safe: recipients already logged as sent for this notice today are skipped, so a retry only picks up failures.
6. Returns a summary: total, sent, failed, skipped (no phone), plus the first failures with reasons.

## Technical notes

- Reuses `supabase/functions/admin-sms-broadcast/index.ts` (same Arkesel v1 endpoint that is confirmed working) rather than a new function.
- Audience query joins `auth.users.last_sign_in_at` to `profiles.phone` via the service-role client.
- After deploying, I trigger the run once and report the exact sent/failed counts back to you.
- Arkesel credit use: ~29 SMS.

## Optional

If you'd rather notify **all 3,287 users with phone numbers** instead of just today's sign-ins, say so and I'll widen the same audience query — that costs ~3,287 SMS credits and takes noticeably longer since sends are sequential.
