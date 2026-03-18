

# Tenant Portal Fixes & Database Cleanup

## Issues Identified

### 1. Greeting — Already Fixed
The `src/lib/greeting.ts` already returns `"Hello, {name} 👋"`. The `TenantDashboard.tsx` imports `getTimeGreeting` which uses this. No change needed.

### 2. QR Code on Tenancy Card → Null Document
The QR code value is `RENT-CONTROL|{registrationCode}|{tenancyId}`. This string doesn't point to any URL — it's just raw text. Scanning it leads nowhere.

**Fix**: Change QR value to a verification URL: `https://rentghanapilot.lovable.app/verify/{tenancyId}`. Create a simple `/verify/:tenancyId` public page that fetches and displays tenancy details (registration code, landlord, tenant, rent, dates, compliance status).

### 3. Marketplace — "Payment Pending" After Paying Viewing Fee
The webhook correctly updates `viewing_requests.status` from `awaiting_payment` to `pending`. But when the user returns to `/tenant/marketplace?status=viewing_paid`, the Marketplace page doesn't handle this callback — it doesn't re-fetch viewing request statuses or show a success toast.

**Fix**: In `Marketplace.tsx`, on mount check for `?status=viewing_paid` URL param, show a success toast, re-fetch viewing requests data, and clear the param.

### 4. Google Maps Error
The API key `AIzaSyBbj3EaLVeMViYbbn8Zrzgqu1qg4OMSLQ4` is likely restricted or has billing/quota issues. This is a configuration issue outside the codebase.

**Fix**: The user needs to verify the Google Maps API key has the Maps JavaScript API and Places API enabled, has a valid billing account, and the key's HTTP referrer restrictions include `*.lovable.app/*` and `*.lovableproject.com/*`. We'll add a user-friendly error fallback in map components so the page doesn't break.

### 5. No Back Button in Property Detail Modal
The modal overlay dismisses on click outside, but there's no explicit close/back button visible in the modal UI.

**Fix**: Add an `X` close button and a `← Back to listings` button at the top of the modal.

### 6. Database Cleanup
Truncate all user-generated data tables while preserving schema, functions, RLS, sequences, and system config (feature_flags, agreement_template_config, api_keys).

---

## Files to Change

| File | Action |
|------|--------|
| `src/components/TenancyCard.tsx` | Update QR value to verification URL |
| `src/lib/generateTenancyCardPdf.ts` | Update QR value in PDF to match |
| `src/pages/shared/VerifyTenancy.tsx` | **Create** — public tenancy verification page |
| `src/pages/tenant/Marketplace.tsx` | Handle `?status=viewing_paid` callback; add close/back button to modal |
| `src/App.tsx` | Add `/verify/:tenancyId` route |
| Database (via insert tool) | Truncate all data tables except config tables |

---

## Technical Details

### Verification Page (`/verify/:tenancyId`)
- Public route (no auth required)
- Fetches tenancy by ID using a read-only query
- Displays: registration code, landlord name, tenant name, rent, dates, compliance, rent card serial
- Shows "Valid" or "Invalid" badge

### Database Cleanup SQL
Truncate in dependency order:
```sql
TRUNCATE TABLE escrow_splits, payment_receipts, escrow_transactions,
  rent_payments, illegal_payment_attempts, side_payment_declarations,
  termination_applications, rent_assessments, rental_applications,
  viewing_requests, marketplace_messages, watchlist, ratings,
  complaints, landlord_complaints, landlord_applications,
  support_messages, support_conversations, beta_feedback,
  notifications, property_location_edits, property_assessments,
  property_images, rent_cards, tenancies, units, properties,
  landlord_payment_settings, kyc_verifications,
  tenant_preferences, landlords, tenants, profiles, user_roles
CASCADE;
```
Preserve: `feature_flags`, `agreement_template_config`, `api_keys`.
Also delete all auth.users via Supabase admin (will cascade to profiles via trigger).

### Google Maps
Add graceful error message in map components when loading fails, and document the API key requirements for the user.

