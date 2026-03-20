

# Plan: Admin SMS Broadcast Center with Balance Monitoring

## What We're Building
A new "SMS Broadcast" page in the regulator portal where admins/sub-admins can send bulk SMS to all users (or filtered groups) using pre-built message templates for system announcements like scheduled maintenance, downtime notices, policy updates, etc. The page also shows live SMS credit balance with urgent warnings when low.

## Features

### 1. SMS Balance Widget (top of page)
- Calls Arkesel V1 balance check API: `https://sms.arkesel.com/sms/api?action=check-balance&api_key=KEY&response=json`
- Displays current credits prominently
- Color coding: green (>500), amber (100-500), red (<100) with pulsing urgent badge
- "Low credits" banner with message: "Contact Center for Financial Literacy, E-Commerce and Digitalization to top up SMS credits"

### 2. Pre-Built Message Templates
Admins pick from these system-relevant templates (editable before sending):
- **Scheduled Maintenance**: "RentGhana: The platform will undergo scheduled maintenance on {date} from {start_time} to {end_time}. Some services may be temporarily unavailable. We apologize for any inconvenience."
- **Emergency Downtime**: "RentGhana: URGENT — The platform is currently experiencing downtime. Our team is working to restore services. We will notify you when resolved."
- **Service Restored**: "RentGhana: The platform has been restored and all services are now available. Thank you for your patience."
- **Policy Update**: "RentGhana: Important policy update regarding {topic}. Please log in to www.rentcontrolghana.com for details."
- **Rent Card Reminder**: "RentGhana: Reminder — Please ensure your Rent Card is up to date. Visit www.rentcontrolghana.com or your nearest Rent Control office."
- **General Announcement**: "RentGhana: {message}"

### 3. Recipient Targeting
- All users (default)
- Tenants only
- Landlords only
- Specific region

### 4. Send Options
- Send now
- Schedule for later (uses Arkesel V1 schedule parameter: `&schedule=YYYY-MM-DD HH:MM AM/PM`)

## Technical Changes

| File | Change |
|---|---|
| `supabase/functions/admin-sms-broadcast/index.ts` | New edge function — checks balance, sends bulk SMS with templates, supports scheduling |
| `src/pages/regulator/SmsBroadcast.tsx` | New page — template picker, recipient selector, balance display, send/schedule buttons |
| `src/App.tsx` | Add route `/regulator/sms-broadcast` |
| `src/components/RegulatorLayout.tsx` | Add nav item "SMS Broadcast" with Send icon |
| `src/hooks/useAdminProfile.ts` | Add `sms_broadcast` to `FEATURE_ROUTE_MAP` |

### Edge Function: `admin-sms-broadcast`
- **POST /action=check-balance**: Proxies Arkesel balance check, returns credits count
- **POST /action=send-broadcast**: Accepts template key + overrides + recipient filter + optional schedule time. Fetches matching phone numbers from `profiles` table (joined with `user_roles`), loops through sending via V1 API. Returns success/fail counts.
- Auth: Validates caller is a regulator via service role check

### Database
- No new tables needed — we query `profiles` + `user_roles` for recipient phones
- Optionally log broadcasts to `admin_audit_log` for accountability

