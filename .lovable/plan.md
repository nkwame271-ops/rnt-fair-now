

# Plan: OTP-Based Password Recovery Flow

## Overview
Replace the current "visit Rent Control office" forgot-password message with a full self-service OTP-based password reset flow. Users enter their phone number or tenant/landlord ID, receive a 6-digit SMS OTP, verify it, then set a new password. If they no longer have access to the phone, they are directed to the office.

## Flow
```text
Login → "Forgot password?" → ForgotPassword page
  Step 1: Enter phone number OR tenant/landlord ID
  Step 2: System looks up phone from profiles/tenants/landlords tables
  Step 3: Send OTP to registered phone (reuse send-otp edge function)
  Step 4: Enter 6-digit OTP code (reuse verify-otp edge function)
  Step 5: Set new password (calls new reset-password-otp edge function)
  
  Fallback: "No longer have this phone?" → manual office verification message
```

## Changes

### 1. New edge function: `reset-password-otp`
- Accepts `{ phone, otp_code, new_password }`
- Uses service_role to verify OTP is valid and marked verified
- Looks up user by phone in `profiles` table
- Uses `supabase.auth.admin.updateUserById()` to set the new password
- Returns success/failure

### 2. New page: `src/pages/ForgotPassword.tsx`
- Multi-step form with 3 stages:
  - **Step 1 — Identify**: Input for phone number OR tenant/landlord ID. On submit, look up the user's phone number (if ID entered, query `tenants.tenant_id` or `landlords.landlord_id` to get `user_id`, then `profiles.phone`). Show masked phone (e.g. `023****890`) for confirmation. Call `send-otp`.
  - **Step 2 — Verify OTP**: 6-digit OTP input using existing `InputOTP` component. Call `verify-otp`. Show resend option with cooldown timer.
  - **Step 3 — New Password**: Password + confirm password fields. Call `reset-password-otp`. On success, redirect to `/login`.
- "Can't access this number?" link shows the manual office fallback message.

### 3. New edge function: `lookup-phone` (for ID-based lookup)
- Accepts `{ identifier }` (phone or tenant/landlord ID)
- Service_role queries `tenants`/`landlords` by ID pattern, then `profiles` by `user_id` or directly by phone
- Returns `{ phone_masked: "023****890", phone_normalized: "233..." }` — the normalized phone is needed for OTP but the masked version is shown to the user
- Security: returns masked phone only, never the full number

### 4. Update `Login.tsx`
- Change "Forgot password?" link to navigate to `/forgot-password` instead of toggling inline message

### 5. Update `App.tsx`
- Add route: `<Route path="/forgot-password" element={<ForgotPassword />} />`

### 6. Update `supabase/config.toml`
- Add `verify_jwt = false` for `reset-password-otp` and `lookup-phone` functions

## Files to create/modify

| File | Action |
|------|--------|
| `src/pages/ForgotPassword.tsx` | Create — multi-step recovery page |
| `supabase/functions/reset-password-otp/index.ts` | Create — verify OTP + reset password server-side |
| `supabase/functions/lookup-phone/index.ts` | Create — find phone by ID or phone input |
| `src/pages/Login.tsx` | Modify — link to `/forgot-password` |
| `src/App.tsx` | Modify — add route |
| `supabase/config.toml` | Modify — add function configs |

## Security considerations
- Password reset happens server-side only (service_role)
- OTP must be verified before password change is allowed
- Phone number is never fully exposed to the client (masked)
- Rate limiting via existing OTP deletion (one active OTP per phone)
- The `lookup-phone` function only returns masked phone, preventing enumeration of full numbers

