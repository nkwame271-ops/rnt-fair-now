# SMS Delivery: Live Test with Current Key

## Goal
Prove whether the stored Arkesel key actually delivers an SMS to a real handset, using the existing key (no rotation), and read the carrier-level delivery status rather than trusting Arkesel's "success" response.

## What the current evidence shows
- The stored key authenticates (account name returned by Arkesel: "Nana Koranteng").
- Arkesel reports `sms_balance: 999,978,571` and `main_balance: GHS 0.025`.
- Recent `send-notification` logs show `SMS sent via v2 using sender "RentControl"` — the API accepts the message, so the failure (if any) is after acceptance: sender-ID approval or delivery status.

## Steps
1. Send one live test SMS to **0243973435** (normalized to `233243973435`) through the existing `send-sms` function with sender `RentControl`, and capture the full raw Arkesel response including the message/campaign ID.
2. Immediately query Arkesel's delivery-report endpoint for that message ID and record the returned status (`DELIVERED`, `PENDING`, `FAILED`, `REJECTED`, plus any reason code).
3. If the sender ID is rejected or the message is not delivered, repeat once with the fallback sender already configured in the code (`R Control`) to isolate sender-ID approval as the cause.
4. Report back the exact status, and — if delivery fails — state the specific reason Arkesel gives (sender ID unapproved, insufficient real balance, blacklisted recipient, or route failure) instead of a guess.

## Technical notes
- Extend the existing `sms-diagnose` function with a delivery-report lookup so message IDs can be checked without exposing the API key; keep it read-only apart from the single test send.
- No secret is changed and no application code paths (signup, OTP, notifications) are modified in this step.
- Once the true cause is confirmed, a follow-up plan will cover the actual fix.
