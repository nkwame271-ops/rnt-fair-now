

# Plan: Admin Fund Requests, Tenancy Card Fixes, Payment Flow Post-Tax, Rejection Cascade

## 1. Office Fund Requests — Sub Admin Submit Access

**Problem**: Sub admins need a place to submit fund requests. The `OfficeFundRequests.tsx` page already exists and supports both sub admin (submit) and main admin (review) flows. It's already in the nav as "Office Wallet".

**Fix**: The `FEATURE_ROUTE_MAP` is missing entries for `office_fund_requests` and `office_payout_settings`, so sub admins can't be granted access to these features via Invite Staff.

**Changes**:
- Add `office_wallet` and `payout_settings` keys to `FEATURE_ROUTE_MAP` in `useAdminProfile.ts`

## 2. Invite Staff — Add New Features to Feature Visibility

**Problem**: New features (Office Wallet, Payout Settings, Rent Reviews) are missing from `FEATURE_ROUTE_MAP`, so they don't appear in the Invite Staff feature checklist.

**Fix**: Already covered by adding the new keys in step 1. The Invite Staff page dynamically reads `Object.keys(FEATURE_ROUTE_MAP)`.

## 3. Tenant Dashboard — Show Tenancy Card After Agreement Signed

**Problem**: The dashboard query filters for `status IN (active, pending, renewal_window, ...)` but doesn't fetch rent card serials. After signing, the tenancy card shows but without rent card data.

**Fix**:
- In `TenantDashboard.tsx`, fetch `rent_card_id` and `rent_card_id_2` from the tenancy
- For each rent card ID, fetch the serial number from `rent_cards` table
- Pass `rentCardSerial`, `rentCardSerial2`, `rentCardRole`, `rentCardRole2` to `TenancyCardData`

## 4. Tenancy Card — Rename "Advance Paid" → "Advance" + Show Rent Cards

**Problem**: Label says "Advance Paid" but should say "Advance". Rent card serials need to be displayed.

**Fix**:
- In `TenancyCard.tsx`, change line 82 label from "Advance Paid" to "Advance"
- Rent card serials are already rendered (lines 86-97) when passed via props — the fix is in the data-fetching (step 3)

## 5. Payments — Hide Tax Card After Payment, Show Remaining Balance Options

**Problem**: After paying advance tax, the "Pay All Advance Tax" card still shows. Should instead show two options: pay remaining balance to landlord on-platform, or mark as paid off-platform.

**Fix**:
- In `Payments.tsx`, when `allAdvancePaid === true`, replace the tax payment card with a new "Remaining Balance" card showing:
  - Total advance rent minus total tax = amount owed to landlord
  - Option 1: "Pay Landlord on Platform" (future Paystack transfer, for now show as coming soon or direct link)
  - Option 2: "I Paid Off-Platform" button that marks the advance as settled
- Keep the payment schedule below for visibility

## 6. Rejection Cascade — Server-Side Fix

**Problem**: When tenant rejects agreement, the client-side code updates `units` and `properties` tables, but tenants lack RLS permissions to update those tables. The updates silently fail.

**Fix**: Create a database trigger `on_tenancy_rejected` that fires on `UPDATE` of `tenancies` table. When `NEW.status = 'rejected'` and `OLD.status != 'rejected'`:
- Set the unit (`units.status`) to `'vacant'`
- Check if property has any remaining occupied units; if not, set `properties.property_status = 'live'` and `properties.listed_on_marketplace = true`

This runs as `SECURITY DEFINER`, bypassing RLS. The client code in `MyAgreements.tsx` can then be simplified to only update the tenancy status — the trigger handles the cascade.

## Files to Change

| File | Change |
|---|---|
| `src/hooks/useAdminProfile.ts` | Add `office_wallet`, `payout_settings`, `rent_reviews` to `FEATURE_ROUTE_MAP` |
| `src/components/TenancyCard.tsx` | Rename "Advance Paid" → "Advance" |
| `src/pages/tenant/TenantDashboard.tsx` | Fetch rent card serials for tenancy card display |
| `src/pages/tenant/Payments.tsx` | After all advance tax paid, show remaining balance options instead of tax card |
| `src/pages/tenant/MyAgreements.tsx` | Simplify rejection to only update tenancy status (trigger handles cascade) |
| Database migration | Create `on_tenancy_rejected` trigger for cascading unit/property reset |

