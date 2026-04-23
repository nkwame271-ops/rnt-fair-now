
## Fix welcome SMS reliability + update welcome copy + move roles above About Us

### 1. Stop welcome SMS from silently failing on new registrations

Current registration sends the welcome notice from the browser via `sendNotification("account_created", ...)`, but the flow is fragile in two ways:
- `RegisterTenant.tsx` and `RegisterLandlord.tsx` do not await the notification call, so registration completes even if the welcome SMS request never finishes.
- `send-notification` currently swallows SMS provider failures and still reports SMS as effectively “sent”, so the app has no reliable signal when welcome delivery actually fails.

### 2. Make the welcome SMS path explicit and reliable

Update the registration flow so welcome delivery is handled as a real, inspectable step after successful account creation:

- **`supabase/functions/send-notification/index.ts`**
  - Refactor SMS sending to return a real success/failure result instead of swallowing both V2/V1 failures.
  - For `account_created`, return structured channel results such as:
    - `sms: "sent"`
    - `sms: "failed"`
    - `sms_error: "...reason..."`
  - Keep HTTP `200` with a structured body so the client can react without breaking registration.

- **`src/lib/notificationService.ts`**
  - Return the edge function response instead of only logging internally, so callers can inspect whether SMS actually went out.

- **`src/pages/RegisterTenant.tsx` and `src/pages/RegisterLandlord.tsx`**
  - `await` the notification call after the tenant/landlord record is created.
  - If SMS succeeds, continue as normal.
  - If SMS fails, do not roll back registration, but show a visible warning toast like:
    - “Account created, but welcome SMS could not be delivered.”
  - This preserves account creation while making failures visible instead of silently recurring.

### 3. Consolidate the welcome message copy so it stops drifting

Right now welcome-style copy exists in multiple places, which is why the wording keeps getting “fixed” and then diverging again.

Standardize the welcome copy in all relevant paths so every registration-related SMS uses the same wording:

- **Primary live registration path**
  - `supabase/functions/send-notification/index.ts` → `account_created` SMS template

- **Secondary/manual welcome paths**
  - `src/lib/smsService.ts` → `registration_success`
  - `supabase/functions/bulk-welcome-sms/index.ts` → `WELCOME_MESSAGE`

### 4. Update the welcome SMS text with the requested wording

Use `RentControlGhana` as the heading/prefix and preserve the existing account info, while adding the requested site link and office help line.

The updated welcome copy will include:
- `RentControlGhana`
- existing registration confirmation details
- `Sign in to your dashboard by using rentcontrolghana.com`
- `Visit the nearest rent control office for assistance`

If needed for SMS length, the wording will be tightened slightly while preserving all requested information and the same meaning.

### 5. Main page layout change: move roles above About Us

On the landing page, the role cards are currently below the About Us and API sections, which delays the main call-to-action.

Update **`src/pages/RoleSelect.tsx`** so:
- the **Role Selection / Get Started** section appears immediately below the hero
- **About Us** comes after the roles
- the rest of the homepage order remains intact unless spacing needs a small adjustment

This will make Tenant / Landlord / Student access visible sooner on mobile and desktop without requiring users to scroll far down.

### Files to update
- `supabase/functions/send-notification/index.ts`
- `src/lib/notificationService.ts`
- `src/pages/RegisterTenant.tsx`
- `src/pages/RegisterLandlord.tsx`
- `src/lib/smsService.ts`
- `supabase/functions/bulk-welcome-sms/index.ts`
- `src/pages/RoleSelect.tsx`

### Out of scope
- OTP SMS wording
- complaint/reminder/payment SMS templates
- authentication email templates unless you later want the same wording mirrored in email welcome messages
