

# Plan: Send Bulk Welcome SMS to All Registered Users

## What
Send a one-time welcome SMS to all 13 real phone numbers in the database (excluding test numbers like 020000xxxx) via the existing `send-sms` edge function and Arkesel API.

## Message
> "Welcome to RentControlGhana — the future of rent in Ghana. Your rent, your rights, your records — all in one place. We're building a fairer rental system for everyone. Log in anytime at rentghanapilot.lovable.app. Thank you for being part of the journey!"

## How
1. Create a new edge function `bulk-welcome-sms/index.ts` that:
   - Queries all profiles with valid phone numbers (excluding test numbers)
   - Sends the welcome message to each via Arkesel API
   - Returns a summary of sent/failed counts
2. Call it once to trigger the blast

## Why an edge function
- The `send-sms` function handles one message at a time — calling it 13 times from the client is wasteful
- A single server-side function can loop through all numbers efficiently with proper error handling and rate control

## Files
| File | Action |
|---|---|
| `supabase/functions/bulk-welcome-sms/index.ts` | Create — one-time bulk SMS sender |
| `supabase/config.toml` | Add function entry |

After creating and deploying, I'll invoke it directly to send the messages and report results.

