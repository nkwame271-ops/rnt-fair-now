

# Plan: Comprehensive Notification System Overhaul

This plan implements the full notification logic and templates as specified, adding multi-channel (SMS + Email + In-App) notifications across the platform.

## Current State
- **SMS**: `smsService.ts` sends SMS via `send-sms` edge function (Arkesel V2). Used in 5 places (registration, complaint, agreement, viewing, payment).
- **Email**: Only auth emails (signup, recovery, magic-link, etc.) via `auth-email-hook`. No transactional email sending for business events.
- **In-App**: Notifications table used in `paystack-webhook` and `tenancy-expiry-check`.
- **No transactional email infrastructure** exists yet — needs scaffolding.

## Architecture

All notification sending will be centralized in a new `send-notification` edge function. Frontend code and other edge functions call it with an event type and data. It decides which channels (SMS, Email, In-App) to use based on the rules below.

```text
Caller (frontend/webhook/cron)
  → send-notification edge function
    → SMS (Arkesel) if event requires it
    → Email (enqueue via pgmq) if event requires it
    → In-App (notifications table insert) always
```

## Channel Rules (from spec)

| Event | SMS | Email | In-App |
|---|---|---|---|
| account_created | ✓ | ✓ | ✓ |
| password_reset | ✓ | ✓ | ✓ |
| contact_changed | ✓ | ✓ | ✓ |
| recovery_completed | ✓ | ✓ | ✓ |
| payment_successful | ✓ | ✓ | ✓ |
| escrow_released | ✓ | ✓ | ✓ |
| tenancy_registered | ✓ | ✓ | ✓ |
| rent_card_verified | ✓ | ✓ | ✓ |
| fraud_alert | ✓ | ✓ | ✓ |
| otp | ✓ | - | - |
| login_alert | ✓ | - | ✓ |
| tenancy_expiry_reminder | ✓ | - | ✓ |
| complaint_reminder | ✓ | - | ✓ |
| full_receipt | - | ✓ | ✓ |
| tenancy_agreement | - | ✓ | ✓ |
| rent_card_copy | - | ✓ | ✓ |
| complaint_summary | - | ✓ | ✓ |

## Changes

### 1. Create `supabase/functions/send-notification/index.ts`
Central edge function that accepts `{ event, phone, email, data }` and dispatches to the correct channels:
- **SMS**: Calls Arkesel V2 directly (like current `send-sms`)
- **Email**: Renders HTML from templates and enqueues via `enqueue_email` RPC (uses existing pgmq infrastructure)
- **In-App**: Inserts into `notifications` table
- Contains all SMS templates (from spec) and email HTML templates (simple branded HTML matching the platform style)
- Channel routing map determines which channels each event triggers

### 2. Create email templates for transactional events
New file: `supabase/functions/send-notification/email-templates.ts`
- Simple HTML template functions for each email type (account_created, payment_successful, contact_changed, recovery_completed, tenancy_registered, rent_card_verified, fraud_alert, full_receipt, tenancy_agreement, rent_card_copy, complaint_summary)
- Branded with RentControlGhana green (#2d7a4f), Plus Jakarta Sans font
- All follow the format from the spec (Hello [Name], body, Regards, RentControlGhana)

### 3. Update `src/lib/smsService.ts`
- Rename to `notificationService.ts` with expanded event types
- Change from calling `send-sms` to calling `send-notification`
- Pass both phone and email so the edge function can route to correct channels
- Export `sendNotification()` instead of `sendSms()`

### 4. Update all frontend callers (5 files)
Replace `sendSms()` calls with `sendNotification()`:
- `RegisterTenant.tsx` — `account_created` event
- `RegisterLandlord.tsx` — `account_created` event  
- `FileComplaint.tsx` — keep as is (complaint_filed is in-app only per spec)
- `Marketplace.tsx` — viewing is in-app only per spec, remove SMS call
- `AddTenant.tsx` — `tenancy_registered` event (both SMS + Email)

### 5. Update `ProfilePage.tsx`
- After successful password change: call `sendNotification("password_reset", ...)`
- After successful contact detail change: call `sendNotification("contact_changed", ...)`

### 6. Update `paystack-webhook/index.ts`
- Add email sending alongside existing SMS + in-app for payment events
- After `sendPaymentSms()`, also enqueue a "Payment Successful" email
- For escrow release events, trigger `escrow_released` notification

### 7. Update `tenancy-expiry-check/index.ts`
- Add SMS sending for tenancy expiry reminders (currently in-app only)

### 8. Add to `supabase/config.toml`
```toml
[functions.send-notification]
  verify_jwt = false
```

### Files to create
| File | Purpose |
|---|---|
| `supabase/functions/send-notification/index.ts` | Central notification dispatcher |

### Files to modify
| File | Change |
|---|---|
| `src/lib/smsService.ts` | Refactor to `notificationService.ts` — call `send-notification` |
| `src/pages/RegisterTenant.tsx` | Use `sendNotification("account_created")` |
| `src/pages/RegisterLandlord.tsx` | Same |
| `src/pages/landlord/AddTenant.tsx` | Use `sendNotification("tenancy_registered")` |
| `src/pages/tenant/Marketplace.tsx` | Remove SMS for viewing (in-app only per spec) |
| `src/pages/tenant/FileComplaint.tsx` | Remove SMS for complaint (in-app only per spec) |
| `src/pages/shared/ProfilePage.tsx` | Add notifications for password change + contact change |
| `supabase/functions/paystack-webhook/index.ts` | Add email enqueue for payment events |
| `supabase/functions/tenancy-expiry-check/index.ts` | Add SMS for expiry reminders |
| `supabase/config.toml` | Add send-notification function config |

