

# Engine Room Overhaul: Feature Gating, Fee Management & Payment Gates

## Problems to Fix

1. **Feature flags don't actually hide nav items** -- toggling Marketplace/Rent Checker off in Engine Room has no effect because TenantLayout and LandlordLayout render all nav items unconditionally.
2. **Feature flags have no category** -- all flags are shown in one flat list, not separated by portal.
3. **No fee management** -- fees are hardcoded in `paystack-checkout/index.ts` and cannot be changed by the admin.
4. **Missing payment gates** on Add Tenant (landlord) and Termination Request (tenant).

## Plan

### 1. Database Migration

**Add columns to `feature_flags`:**
- `category` (text, default `'general'`) -- values: `'tenant'`, `'landlord'`, `'general'`
- `fee_amount` (numeric, nullable) -- for fee-type flags
- `fee_enabled` (boolean, default `true`) -- switch to disable a fee entirely (free pass)

**Insert missing feature flags** for all portal features with proper categories. Each nav item that could be toggled gets a flag:

Tenant features: `marketplace`, `rent_checker`, `complaint_filing`, `legal_assistant`, `payments`, `renewal`, `termination`, `report_side_payment`, `preferences`, `messages`, `tenant_receipts`

Landlord features: `register_property`, `add_tenant`, `declare_existing_tenancy`, `agreements`, `landlord_applications`, `landlord_complaints`, `viewing_requests`, `rental_applications`, `renewal_requests`, `landlord_ejection`, `landlord_messages`, `rent_cards`, `payment_settings`, `landlord_receipts`

Fee flags (with `fee_amount`): `tenant_registration` (40), `landlord_registration` (30), `viewing_fee` (2), `listing_fee` (2), `add_tenant_fee` (new, e.g. 5), `termination_fee` (new, e.g. 5), `complaint_fee` (2), `rent_card_fee` (25), `agreement_sale_fee` (30)

**Update existing flags** to set their category.

### 2. Update `useFeatureFlag` hook

- Add `category` and `fee_amount`, `fee_enabled` to the `FeatureFlag` interface.
- Add a `useFeatureFlagsByCategory(category)` hook for layout use.
- Add a `useFeeConfig(key)` hook that returns `{ amount, enabled, loading }`.

### 3. Gate nav items in TenantLayout and LandlordLayout

Each nav item gets an optional `featureKey` property. The layouts fetch all flags on mount, then filter the nav items -- only showing items whose feature flag is either missing (always show) or enabled.

Items that should always show (never toggled): Dashboard, Profile.

### 4. Revamp Engine Room UI

- Group flags into sections: "Tenant Features", "Landlord Features", "Platform Fees"
- Fee flags show an editable amount input and a "Payment Active" toggle
- On save, update both `fee_amount` and `fee_enabled` in the `feature_flags` table

### 5. Dynamic fees in `paystack-checkout`

Instead of the hardcoded `SPLIT_RULES` object, the edge function will query `feature_flags` for the fee amount. If `fee_enabled` is false for that fee type, skip payment and return a special response indicating no payment needed.

### 6. Add payment gates to Add Tenant and Tenant Termination

**Add Tenant (`src/pages/landlord/AddTenant.tsx`):**
- Before final submission, check if `add_tenant_fee` is enabled and > 0.
- If yes, redirect to Paystack checkout with type `add_tenant_fee`, then proceed on callback.

**Tenant Termination (`src/pages/tenant/TerminationRequest.tsx`):**
- Before submission, check if `termination_fee` is enabled and > 0.
- If yes, redirect to Paystack, then submit on callback.

**Add corresponding handlers** in `paystack-checkout` and `paystack-webhook` for these two new payment types.

### 7. Build error fix

The `@swc/core` native binding error is an infrastructure issue, not a code issue. It resolves on rebuild. No code changes needed.

## Files to Change

| File | Action |
|------|--------|
| `supabase/migrations/...` | Add `category`, `fee_amount`, `fee_enabled` columns; insert all missing flags |
| `src/hooks/useFeatureFlag.ts` | Extend interface, add `useFeatureFlagsByCategory`, `useFeeConfig` |
| `src/components/TenantLayout.tsx` | Add `featureKey` to nav items, filter by enabled flags |
| `src/components/LandlordLayout.tsx` | Same as above |
| `src/pages/regulator/EngineRoom.tsx` | Grouped UI with fee editing |
| `supabase/functions/paystack-checkout/index.ts` | Dynamic fee lookup, add `add_tenant_fee` and `termination_fee` types |
| `supabase/functions/paystack-webhook/index.ts` | Handle `add_tenant_fee` and `termination_fee` success |
| `src/pages/landlord/AddTenant.tsx` | Add payment gate before submission |
| `src/pages/tenant/TerminationRequest.tsx` | Add payment gate before submission |

