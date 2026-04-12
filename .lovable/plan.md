

# Separate Rent Bands & Declare Existing Tenancy Fee Basket

## Overview

Currently there is ONE `rent_bands` table used by both "Add Tenant" and "Declare Existing Tenancy" flows. The request is to separate these into two independent band sets with distinct fee structures, and add a basket-style selection in the Declare Existing Tenancy workflow.

## Database Changes

### 1. Add `band_type` column to `rent_bands`
Add a `band_type TEXT NOT NULL DEFAULT 'add_tenant'` column to distinguish between the two band types:
- `add_tenant` — used by the Add Tenant flow
- `existing_tenancy` — used by the Declare Existing Tenancy flow

### 2. Add `band_type` column to `rent_band_allocations`
No change needed here — allocations already link to specific `rent_band_id`, so the band type is inherited. But we need to support three payment types per band:
- Current types: `agreement_sale`, `add_tenant_fee`
- New types needed: `register_tenant_fee`, `filing_fee`, `agreement_sale`

Update existing data: current `add_tenant_fee` allocations stay as-is for `add_tenant` bands. For `existing_tenancy` bands, allocations will use `register_tenant_fee`, `filing_fee`, and `agreement_sale`.

### 3. Migrate existing rent bands
Duplicate current rent bands with `band_type = 'existing_tenancy'` so both band sets start with the same ranges. Admin can then configure them independently.

## Engine Room Changes (`EngineRoom.tsx`)

### Rent Bands Section
Replace the single "Rent Bands" section with two sub-sections:
- **Add Tenant Rent Band** — `band_type = 'add_tenant'`
  - Each band shows fee amount and split allocations for `add_tenant_fee` only
- **Existing Tenancy Rent Band** — `band_type = 'existing_tenancy'`
  - Each band shows three fee rows with independent split allocations:
    - Register Tenant Fee (`register_tenant_fee`)
    - Agreement Sale Fee (`agreement_sale`)
    - Filing Fee (`filing_fee`)

Each fee row within a band has its own split engine (IGF, Admin, Platform allocations) configurable per band.

### Data fetching
Filter `rent_bands` by `band_type` when loading. Band allocations already link by `rent_band_id`.

## Landlord Portal: Declare Existing Tenancy (`DeclareExistingTenancy.tsx`)

### Step 3 — Agreement Selection
Add a toggle/selection before the review step:
- **Option A: "Upload Existing Agreement"** — landlord uploads their own agreement file
  - Fees: Register Tenant Fee + Filing Fee
- **Option B: "Buy Tenancy Agreement"** — platform generates the agreement
  - Fees: Register Tenant Fee + Filing Fee + Agreement Sale Fee

### Fee Display
Show a basket-style breakdown:
```
Register Tenant Fee:     GH₵ 50
Filing Fee:              GH₵ 20
Agreement Sale Fee:      GH₵ 30  (only if "Buy Agreement" selected)
──────────────────────────────────
Total:                   GH₵ 100
```

Fees are looked up from `rent_bands WHERE band_type = 'existing_tenancy'` based on the monthly rent. Each fee type has its own amount stored in `rent_band_allocations` grouped by `payment_type`.

### Payment Flow
The total amount sent to `paystack-checkout` is the sum of the selected fees. The checkout function needs to handle a composite payment with multiple fee types so each gets its own split allocation.

## Paystack Checkout Changes (`paystack-checkout/index.ts`)

### Support composite fee types
Add support for a new `type: "existing_tenancy_bundle"` that accepts an array of fee components. The function will:
1. Look up the existing tenancy rent band for the given monthly rent
2. Sum the applicable fees based on the selected option (upload vs buy)
3. Create a single escrow transaction with the total
4. Create split entries for each fee component's allocations

### Fee mapping enforcement
- `add_tenant` bands → only used when `type = "add_tenant_fee"`
- `existing_tenancy` bands → only used when `type = "existing_tenancy_bundle"`

## Files Modified

1. **Database migration** — Add `band_type` to `rent_bands`, duplicate existing bands for `existing_tenancy`
2. **`src/pages/regulator/EngineRoom.tsx`** — Split rent bands UI into two sections with per-fee-type allocation editors
3. **`src/pages/landlord/DeclareExistingTenancy.tsx`** — Add agreement selection toggle, basket-style fee display, composite payment
4. **`supabase/functions/paystack-checkout/index.ts`** — Support `existing_tenancy_bundle` composite payment type
5. **`src/pages/landlord/AddTenant.tsx`** — Filter rent bands by `band_type = 'add_tenant'`

## Technical Details

**Rent band fee structure for existing tenancy bands**: Instead of a single `fee_amount` on the band, each band's total fee is the sum of its `rent_band_allocations` grouped by payment_type. The `fee_amount` column on `rent_bands` will store the Register Tenant Fee for backward compatibility, while Agreement Sale and Filing fees are derived from their respective allocation totals.

Alternatively (simpler): add `register_fee`, `filing_fee`, and `agreement_fee` columns to `rent_bands` for existing tenancy bands, keeping `fee_amount` for add_tenant bands. This avoids complex allocation lookups for fee display.

**Recommended approach**: Add three nullable fee columns to `rent_bands`: `register_fee`, `filing_fee`, `agreement_fee`. For `add_tenant` bands, only `fee_amount` is used. For `existing_tenancy` bands, the three new columns define individual fees. Split allocations in `rent_band_allocations` map to each fee type independently.

