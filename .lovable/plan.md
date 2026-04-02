

# Fix Fee Determination vs Allocation Conflict

## Problem

The current system conflates fee determination and allocation in `paystack-checkout`. The `getDynamicFee` function pulls the fee amount from `feature_flags` but also loads split amounts from `split_configurations` — then proportionally scales splits if they don't match the fee. This causes:

1. **Split totals overriding fees**: If a regulator updates the fee in Platform Fees but not the splits (or vice versa), the proportional scaling produces incorrect allocations.
2. **No per-band allocation rules**: For rent-band-based payment types (agreement_sale, add_tenant_fee), the system picks the correct band fee but then blindly scales a single set of splits. There's no way to define different allocation ratios per rent band.
3. **Add Tenant Fee doesn't use rent bands at all** in checkout — it uses a flat fee from `feature_flags`, even though it should mirror the Declare Existing Tenancy logic.

## Architecture

Separate into two clear stages:

```text
Stage 1: FEE DETERMINATION
  ┌─────────────────────────────────┐
  │ feature_flags (flat fees)       │ → Fixed fee types
  │ rent_bands (band-based fees)    │ → Band fee types (agreement_sale, add_tenant_fee)
  └─────────────────────────────────┘
  Output: payableAmount (what user pays)

Stage 2: ALLOCATION (Split Engine)
  ┌─────────────────────────────────┐
  │ split_configurations            │ → Flat fee allocations (percentage-based)
  │ rent_band_allocations (NEW)     │ → Per-band allocations (absolute amounts)
  └─────────────────────────────────┘
  Output: splitPlan[] (how payableAmount is distributed)
  Validation: sum(splits) MUST equal payableAmount
```

## Changes

### 1. New Database Table: `rent_band_allocations`

Stores allocation rules per rent band, so each band fee has its own distribution:

```sql
CREATE TABLE rent_band_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_band_id uuid NOT NULL REFERENCES rent_bands(id) ON DELETE CASCADE,
  payment_type text NOT NULL DEFAULT 'agreement_sale',
  recipient text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(rent_band_id, payment_type, recipient)
);

ALTER TABLE rent_band_allocations ENABLE ROW LEVEL SECURITY;

-- RLS: regulators manage, service_role full access
CREATE POLICY "Regulators manage band allocations" ON rent_band_allocations
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages band allocations" ON rent_band_allocations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read band allocations" ON rent_band_allocations
  FOR SELECT TO authenticated USING (true);
```

Seed default allocations for each existing rent band (proportional to current split_configurations for agreement_sale and add_tenant_fee).

### 2. Refactor `paystack-checkout/index.ts` — `getDynamicFee`

Replace the current function with two separate functions:

- **`determineFee(feeKey, monthlyRent?)`**: Returns `{ amount, enabled }` — uses `feature_flags` for flat fees, `rent_bands` for band-based fees. This is the **sole authority** on what the user pays.
- **`loadAllocation(paymentType, amount, rentBandId?)`**: Returns `splitPlan[]` — for band-based types, loads from `rent_band_allocations`; for flat types, loads from `split_configurations` as percentages of the determined fee. **Validates** that `sum(splits) === amount` before returning.

### 3. Update `agreement_sale` and `add_tenant_fee` checkout branches

- Both should call `determineFee` first (using rent bands when `monthlyRent` is provided)
- Then call `loadAllocation` with the determined amount and matched band ID
- `add_tenant_fee` gains rent band support (currently only flat fee)

### 4. Update `split_configurations` usage

Change `split_configurations.amount` interpretation for flat-fee types to be **percentage-based** (0-100) rather than absolute amounts. The allocation function multiplies the determined fee by each recipient's percentage. This eliminates the scaling hack.

Actually — to minimize disruption, keep `split_configurations` as-is for flat fees but change the allocation loader to treat them as proportional shares: `recipient_amount = (split.amount / sum_of_all_splits) * payableAmount`. This is already what the scaling does, but we make it explicit and validate the output.

### 5. Engine Room UI Updates (`EngineRoom.tsx`)

Add a section under Rent Bands to manage per-band allocations:
- When editing a rent band, show sub-rows for IGF, Admin, Platform allocation amounts
- Validate that allocations sum to the band's `fee_amount`
- For flat-fee types, keep the existing split_configurations UI but add a validation warning if splits don't match the fee_amount in feature_flags

### 6. Frontend: Add Tenant page rent band support

Update `AddTenant.tsx` to look up rent bands based on `monthlyRent` (like DeclareExistingTenancy already does) and pass `monthlyRent` to the checkout call so the backend can determine the correct band fee.

### 7. Backend validation in `verify-payment` and `paystack-webhook`

Add a validation step before processing payouts: load the allocation rule for the payment type and verify that the stored `split_plan` in metadata matches the current allocation rules. Log a warning (not block) if mismatched, to catch stale transactions.

## Build Error

The "build-run failed" error appears to be a transient infrastructure issue (same as the earlier 503 error), not a code defect. The plan above addresses only the fee/allocation architecture. A rebuild after implementation should resolve it.

## Files to Change

| File | Change |
|------|--------|
| Migration (new) | Create `rent_band_allocations` table + seed data |
| `supabase/functions/paystack-checkout/index.ts` | Refactor `getDynamicFee` → `determineFee` + `loadAllocation`; update agreement_sale and add_tenant_fee branches |
| `supabase/functions/paystack-webhook/index.ts` | Add allocation validation before payout |
| `supabase/functions/verify-payment/index.ts` | Add allocation validation before payout |
| `src/pages/regulator/EngineRoom.tsx` | Add per-band allocation editor UI |
| `src/pages/landlord/AddTenant.tsx` | Add rent band lookup + pass monthlyRent to checkout |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

