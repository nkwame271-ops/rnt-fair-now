

# Plan: Split Engine Expansion, Rent Bands, and Declare Existing Tenancy Overhaul

## Summary

Three major changes: (1) expand all flat-fee splits to IGF/Admin/Platform and add tax revenue splits for GRA/Admin/Platform, (2) add configurable rent bands to determine agreement_sale fees dynamically, (3) overhaul the "Declare Existing Tenancy" flow to support unregistered tenants, case creation, office assignment, and a payment paywall using rent-band-based agreement_sale fee.

---

## 1. Database Changes (single migration)

### New table: `rent_bands`
Configurable rent ranges with corresponding fees, editable from Engine Room.
```sql
CREATE TABLE public.rent_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_rent numeric NOT NULL DEFAULT 0,
  max_rent numeric,  -- NULL = unlimited
  fee_amount numeric NOT NULL DEFAULT 30,
  label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
-- Seed default bands
INSERT INTO rent_bands (min_rent, max_rent, fee_amount, label) VALUES
  (0, 500, 30, 'Up to GH₵ 500'),
  (500.01, 1000, 50, 'GH₵ 500 - 1,000'),
  (1000.01, 2000, 80, 'GH₵ 1,000 - 2,000'),
  (2000.01, NULL, 120, 'Above GH₵ 2,000');
```
RLS: SELECT for authenticated, ALL for regulators + service_role.

### Update `split_configurations` seed data
Replace single-recipient splits for `add_tenant_fee`, `complaint_fee`, `listing_fee`, `viewing_fee`, `termination_fee` with 3-way IGF/Admin/Platform splits. Add new `rent_tax` payment type with GRA/Admin/Platform splits.

Using the insert tool (data operations):
- DELETE existing rows for these payment types
- INSERT new 3-way splits for each flat fee
- INSERT `rent_tax` splits (GRA, Admin, Platform)

### Add `pending_tenants` table
For tenants who don't have accounts yet but were declared by landlords.
```sql
CREATE TABLE public.pending_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  created_by uuid NOT NULL,
  tenancy_id uuid,
  claimed_by uuid,
  claimed_at timestamptz,
  sms_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 2. Backend Changes

### `paystack-checkout/index.ts`
- **Rent tax splits**: For `rent_tax`, `rent_tax_bulk`, and `rent_combined` types, replace the hardcoded `[{ recipient: "rent_control", amount: taxAmount }]` with a DB-driven split from `split_configurations` where `payment_type = 'rent_tax'`. The total tax amount is distributed proportionally across GRA/Admin/Platform based on configured split ratios.
- **Agreement sale with rent bands**: For `agreement_sale` type (used by Declare Existing Tenancy), accept an optional `monthlyRent` parameter. If provided, query `rent_bands` to find the matching fee instead of using the flat `feature_flags.fee_amount`. Fall back to the feature flag amount if no band matches.
- **Default split updates**: Update `DEFAULT_SPLIT_RULES` fallbacks to reflect the new 3-way splits for all flat fees.

### `paystack-webhook/index.ts`
- For `rent_tax` and `rent_tax_bulk` completion, use the stored `split_plan` from escrow metadata (already done) — the new splits will flow through automatically since they're computed at checkout time.

### New edge function or inline logic: SMS invitation
- When a pending tenant is created in `DeclareExistingTenancy`, call the existing `send-sms` function to send an invitation SMS to the tenant's phone number.

---

## 3. Frontend Changes

### `EngineRoom.tsx` — Rent Bands Configuration
Add a new "Rent Bands" section (main admin only) below the Split Engine:
- Table showing min_rent, max_rent, fee_amount, label
- Inline editing with add/remove rows
- Save button per row

### `EngineRoom.tsx` — Updated Split Labels
The existing Split Engine UI already renders dynamically from `split_configurations`. The new 3-way splits will appear automatically after the data update. Add `rent_tax` to `PAYMENT_TYPE_LABELS`.

### `DeclareExistingTenancy.tsx` — Major Overhaul
**Step 2 (Find Tenant)** changes:
- Replace tenant search with two input fields: **Tenant Name** and **Tenant Phone Number**
- On phone number entry, auto-search `profiles` table for matching phone
- If match found: show "Tenant found — will be linked automatically" with name
- If no match: show "Tenant not registered — an SMS invitation will be sent"
- Allow proceeding in both cases (no longer require existing tenant account)

**Submission flow** changes:
1. Determine `agreement_sale` fee from rent bands based on monthly rent
2. If fee > 0 and fee enabled, save form data to `sessionStorage` and redirect to Paystack via `paystack-checkout` with `type: "agreement_sale"` and `monthlyRent` parameter
3. On callback (fee paid or fee waived):
   - If tenant phone matched an existing user: create tenancy with their `user_id`
   - If no match: create a `pending_tenants` record, create tenancy with a placeholder `tenant_user_id` (the landlord's own ID temporarily) and store pending_tenant reference, send SMS invitation
4. Create a Case record via the checkout flow (already handled by `paystack-checkout`)
5. Assign office based on property region (already handled by `resolveOffice`)

**Tenant claiming flow** (separate future enhancement — for now, the tenancy appears when tenant logs in if phone matches).

---

## Files to Change

| File | Change |
|---|---|
| New migration | Create `rent_bands` and `pending_tenants` tables with RLS |
| Data operations (insert tool) | Update `split_configurations`: delete old single-recipient splits for flat fees, insert 3-way IGF/Admin/Platform splits; add `rent_tax` GRA/Admin/Platform splits |
| `supabase/functions/paystack-checkout/index.ts` | Add rent band lookup for agreement_sale; update rent_tax split to use DB config with GRA/Admin/Platform proportional distribution; update DEFAULT_SPLIT_RULES |
| `src/pages/regulator/EngineRoom.tsx` | Add Rent Bands config UI; add `rent_tax` to PAYMENT_TYPE_LABELS |
| `src/pages/landlord/DeclareExistingTenancy.tsx` | Replace tenant search with name+phone input; add rent-band fee lookup; add Paystack payment gate; support unregistered tenants with pending_tenants + SMS; add sessionStorage persistence for payment redirect |

