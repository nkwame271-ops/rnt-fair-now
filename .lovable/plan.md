

# Fix Engine Room Fee Toggle, Rent Card Model, and QR Verification

## Issues

1. **Engine Room toggle doesn't reflect in AddTenant** — The `useFeeConfig` hook caches flags at module level. Once fetched, the cache is never invalidated when the user navigates to AddTenant. Toggling in Engine Room updates the DB, but the frontend serves stale cached data.

2. **Rent cards lack required fields** — Current `rent_cards` table only has: `id, serial_number, landlord_user_id, tenancy_id, status, purchased_at, activated_at, escrow_transaction_id, created_at`. Missing: tenant info, property/unit IDs, rent amounts, advance, expiry, QR code, payment status. The card display is minimal (serial + status only).

3. **QR codes point to insecure or inconsistent URLs** — Profile QR goes to `/verify/:role/:id`, tenancy card QR goes to `/verify-tenancy/:tenancyId`, receipt QR stores a raw Supabase URL. Need unified, secure in-platform verification.

## Plan

### 1. Fix stale fee cache
**File: `src/hooks/useFeatureFlag.ts`**

- Change `useFeeConfig` to always fetch fresh data (bypass module cache) OR invalidate cache on navigation. Simplest fix: skip the cache in `useFeeConfig` by calling the DB directly each time, since fee checks are infrequent and critical.
- Alternative (less disruptive): Add a cache TTL (e.g. 30 seconds) so stale data expires quickly.

### 2. Expand rent_cards table
**Migration:**

Add columns to `rent_cards`:
- `tenant_user_id` (uuid, nullable) — populated when card is linked to a tenancy
- `property_id` (uuid, nullable)
- `unit_id` (uuid, nullable)
- `start_date` (date, nullable)
- `expiry_date` (date, nullable)
- `current_rent` (numeric, nullable)
- `previous_rent` (numeric, nullable)
- `max_advance` (integer, nullable, default 6)
- `advance_paid` (integer, nullable)
- `last_payment_status` (text, nullable, default 'none')
- `qr_token` (text, unique, default gen_random_uuid()) — for secure verification

These get populated when a tenancy is created (in AddTenant's `handleSubmit` and in `verify-payment`).

### 3. Populate rent card fields on tenancy creation
**File: `src/pages/landlord/AddTenant.tsx`**

When the tenancy is created and a rent card is assigned, update the rent card with tenant_user_id, property_id, unit_id, start_date, expiry_date, current_rent, advance_paid, status='active'.

**File: `supabase/functions/verify-payment/index.ts`**

When creating rent cards in bulk, they start with `status=valid` and null fields (not yet linked). No change needed there — fields populate on tenancy assignment.

### 4. Build rich rent card display
**File: `src/pages/landlord/ManageRentCards.tsx`**

- Fetch rent cards with joined data (tenant profile name, property info)
- Display full card with all required fields: Rent Card ID, Landlord Name/ID, Tenant Name/ID, Property ID, Unit ID, Tenancy ID, Start/Expiry Date, Current/Previous Rent, Max Advance, Advance Paid, Last Payment Status, QR Code, Card Status
- Use QRCodeSVG with verification URL `/<lov-plan>

# Fix Engine Room Fee Toggle, Rent Card Model, and QR Verification

## Issues

1. **Engine Room toggle doesn't reflect in AddTenant** — `useFeeConfig` uses a module-level cache that never expires. Toggling in Engine Room updates the DB but the frontend serves stale data.

2. **Rent cards lack required fields** — Current schema only has: `id, serial_number, landlord_user_id, tenancy_id, status, purchased_at, activated_at, escrow_transaction_id, created_at`. Missing: tenant, property, unit, rent amounts, advance, expiry, QR token, payment status.

3. **QR codes are inconsistent** — Profile QR → `/verify/:role/:id`, tenancy card → `/verify-tenancy/:tenancyId`, receipt → raw Supabase URL. Need unified secure in-platform verification.

## Plan

### 1. Fix stale fee cache
**File: `src/hooks/useFeatureFlag.ts`**

Add a 30-second TTL to the module cache so `useFeeConfig` picks up Engine Room changes within 30s. Store `cachedAt` timestamp and invalidate if expired.

### 2. Expand rent_cards table
**Migration** — add columns:
- `tenant_user_id` (uuid, nullable)
- `property_id` (uuid, nullable)
- `unit_id` (uuid, nullable)
- `start_date` (date, nullable)
- `expiry_date` (date, nullable)
- `current_rent` (numeric, nullable)
- `previous_rent` (numeric, nullable, default 0)
- `max_advance` (integer, default 6)
- `advance_paid` (integer, nullable)
- `last_payment_status` (text, default 'none')
- `qr_token` (text, unique, default `gen_random_uuid()`)

### 3. Populate rent card on tenancy creation
**File: `src/pages/landlord/AddTenant.tsx`**

After inserting the tenancy, update the assigned rent card with: `tenant_user_id, property_id, unit_id, start_date, expiry_date, current_rent, advance_paid, status='active'`.

### 4. Build rich rent card display
**File: `src/pages/landlord/ManageRentCards.tsx`**

- Expand the interface and fetch to include all new fields plus joined landlord/tenant names
- Render a full card view with: Rent Card ID, Landlord Name/ID, Tenant Name/ID, Property ID, Unit ID, Tenancy ID, Start/Expiry Date, Current/Previous Rent, Max Advance, Advance Paid, Last Payment Status, QR Code, Card Status
- QR points to `/verify/rent-card/:qr_token`

### 5. Create rent card verification page + route
**New file: `src/pages/shared/VerifyRentCard.tsx`**

- Public page at `/verify/rent-card/:token`
- Calls an edge function to look up card by `qr_token`
- Shows: card serial, status, landlord name, tenant name, property, rent, dates — minimum verification data only

**New file: `supabase/functions/verify-rent-card/index.ts`**

- Accepts `{ token }`, queries rent_cards + profiles using service role
- Returns only verification-safe fields

### 6. Standardize all QR codes
- **Profile QR** (`ProfilePage.tsx`): Already uses `/verify/:role/:id` — OK, uses edge function
- **Tenancy QR** (`TenancyCard.tsx`): Already uses `/verify-tenancy/:tenancyId` — OK
- **Receipt QR** (`verify-payment/index.ts`): Change from raw Supabase URL to `https://rentghanapilot.lovable.app/verify/receipt/:receiptNumber`
- **Rent Card QR**: New `/verify/rent-card/:token`
- Add receipt verification route + page

**New file: `src/pages/shared/VerifyReceipt.tsx`** — looks up receipt by number, shows minimal verification data

**Route updates in `App.tsx`:**
- `/verify/rent-card/:token` → VerifyRentCard
- `/verify/receipt/:receiptNumber` → VerifyReceipt

### 7. Add receipt verification edge function
**New file: `supabase/functions/verify-receipt/index.ts`**

- Accepts `{ receiptNumber }`, returns payer name, amount, date, status — no PII

## Files to create/modify

- `src/hooks/useFeatureFlag.ts` — cache TTL
- `src/pages/landlord/ManageRentCards.tsx` — rich card display
- `src/pages/landlord/AddTenant.tsx` — populate rent card on tenancy creation
- `src/pages/shared/VerifyRentCard.tsx` — new
- `src/pages/shared/VerifyReceipt.tsx` — new
- `supabase/functions/verify-rent-card/index.ts` — new
- `supabase/functions/verify-receipt/index.ts` — new
- `supabase/functions/verify-payment/index.ts` — fix receipt QR URL
- `src/App.tsx` — add verification routes
- `supabase/config.toml` — add new functions with `verify_jwt = false`
- Migration for rent_cards schema expansion

