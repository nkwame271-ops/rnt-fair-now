

# Phone-Based Registration & Login Overhaul

## Overview

Switch authentication from email-based to phone-based. Phone becomes required, email becomes optional. Users get a temporary password (last 6 digits of phone). SMS and email welcome messages updated to match the provided templates.

---

## Strategy: Phone as Primary Auth Identifier

Supabase requires an email for `signUp`. We will generate a synthetic email from the phone number: `{normalized_phone}@rentcontrolghana.local`. The actual email (if provided) is stored in the `profiles` table for correspondence only. Password defaults to the last 6 digits of the phone number.

---

## 1. Registration Pages

### `RegisterTenant.tsx` — Restructure Steps

**Step 0 "Account"**: Remove email and password fields. Keep Full Name. Add Phone Number (required). Add Email (optional).

**Step 1 "Identity"**: Keep as-is (citizenship, Ghana Card, region).

**Step 2 "Contact"**: Keep occupation, work address, emergency contact fields.

**Account creation logic**:
- Generate synthetic email: `{phone_digits}@rentcontrolghana.local`
- Auto-generate password: last 6 digits of phone number
- Store real email (if provided) in profiles table
- Sign up with synthetic email + auto-password
- Enable auto-confirm since there's no email verification needed

**Success screen updates**:
- Remove "Check your email to verify" instruction
- Show login details: phone number + "your temporary password is the last 6 digits of your phone number"
- Update fee display to GH₵ 40

### `RegisterLandlord.tsx` — Same pattern

**Step 0**: Full Name, Business Name (optional), Phone (required), Email (optional). Remove password field.

**Step 1**: Identity & region (keep as-is).

**Account creation**: Same synthetic email + auto-password approach.

**Success screen**: Same login details display. Update fee to GH₵ 30.

---

## 2. Login Page

### `Login.tsx` — Phone-based login

- **Password mode**: Change from email input to phone number input. Construct synthetic email from phone, sign in with auto-password or user-set password.
- **Magic Link mode**: Only available if user has a real email on file. Otherwise hide/disable this option.
- **Forgot password**: Replace with "Reset via SMS" or keep email-based for users who provided email.
- Update placeholder text and labels from "Email" to "Phone Number".

---

## 3. SMS Welcome Template

Update `smsService.ts` `registration_success` template:

```
Hello {name}, your RentControlGhana account has been successfully created. Name: {name}, ID: {id}. Please keep your ID safe. Login: Phone: {phone}, Temp Password: last 6 digits of your phone. Login: {link}. Change your password immediately. Do not share it.
```

---

## 4. Email Welcome (Optional - if email provided)

Create a new SMS event or send via edge function when email is provided during registration. The email contains the full formatted welcome message as specified by the user.

---

## 5. Auth Configuration

- Enable auto-confirm for email signups (since we use synthetic emails, verification is meaningless)
- The `handle_new_user` trigger already stores phone in profiles — no DB changes needed

---

## 6. Existing User Handling

- Login page: phone number uniquely maps to a synthetic email, so duplicate detection works
- Registration: check if `{phone}@rentcontrolghana.local` already exists before signup

---

## Files Summary

| File | Action |
|------|--------|
| `src/pages/RegisterTenant.tsx` | Rewrite — phone required, email optional, no password field, auto-password from phone, updated success screen |
| `src/pages/RegisterLandlord.tsx` | Rewrite — same phone-first approach, updated success screen |
| `src/pages/Login.tsx` | Rewrite — phone number input instead of email, construct synthetic email for auth |
| `src/lib/smsService.ts` | Update — new `registration_success` template matching provided SMS format |
| Auth config | Enable auto-confirm (synthetic emails don't need verification) |

