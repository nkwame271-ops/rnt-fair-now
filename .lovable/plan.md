

# Fix 6 Bugs: Engine Room, Escrow Reports, Operational Date, Add Tenant Fee, Payment Bypass, Rent Increase

## Bug Summary

### 1. Engine Room Empty for Super Admin
**Root cause**: No loading guard. When `useAdminProfile` and `useAllFeatureFlags` are still loading, `isMainAdmin` defaults to `false` and all flag arrays are empty, so nothing renders — just the title.
**Fix**: Add `if (loading || profileLoading) return <LogoLoader />` at top of the render in `EngineRoom.tsx`.

### 2. Escrow Report Shows Muted Cards
**Root cause**: The CSV and PDF export functions use `revenueByType` (unfiltered) and `allAllocationCards` instead of `visibleRevenueByType` and `allocationCards` (which are already filtered by visibility). Line 309 uses `revenueByType`, line 388 uses `revenueByType`, and lines 298/305 use raw `stats.totalEscrow` instead of `visibleRevenueTotal`.
**Fix**: Replace all references in `exportCSV()` and `exportPDF()` to use the visibility-filtered arrays and totals.

### 3. Operational Start Date Not Filtering Escrow
**Root cause**: `EscrowDashboard.tsx` never reads the `operational_start_date` from `platform_config`. It queries all escrow transactions without applying a minimum date filter.
**Fix**: Fetch `operational_start_date` from `platform_config` on mount. When `datePreset === "all"`, use the operational start date as the `from` date instead of null.

### 4. Add Tenant Fee Shows Static GH₵ 30
**Root cause**: `useFeeConfig("add_tenant_fee")` reads from `feature_flags.fee_amount` which is 30. But the actual fee is band-based (determined by rent bands at checkout). The frontend button says "Pay GH₵ 30.00" regardless of rent amount.
**Fix**: In `AddTenant.tsx`, when the user enters a rent amount, look up the matching rent band's `fee_amount` and display that instead of the static `feeConfig.amount`. Fetch `rent_bands` and compute the correct fee based on `monthlyRent`.

### 5. Payment Bypass on Back Navigation
**Root cause**: When a landlord clicks "Pay" → redirected to Paystack → clicks browser back → returns to the review step, they can click "Generate & Send to Tenant" directly because the fee button logic only checks `feeConfig.enabled && feeConfig.amount > 0`. There's no server-side verification that the fee was actually paid before creating the tenancy.
**Fix**: In `handleSubmit()`, before creating the tenancy, verify that a completed `add_tenant_fee` escrow transaction exists for this user (when fee is enabled). If not found, block submission and show an error.

### 6. Rent Increase: Rent Field Not Auto-Updating
**Root cause**: In `RegulatorRentReviews.tsx`, when admin approves, it updates `units.monthly_rent` and `tenancies.agreed_rent` correctly. However, the marketplace listing uses `units.monthly_rent` which does get updated. The issue is likely that the property's `approved_rent` is updated but the listing price on `units` table is what shows on marketplace — which IS updated. Let me verify the actual issue: the landlord's rent field should stay read-only and auto-update. Currently the `monthly_rent` field on the unit IS updated on approval (line 68). The marketplace reads from `units.monthly_rent`. So the data flow works. The missing piece is that the landlord sees no feedback — the rent field in their property edit page may still be editable. Also, on rejection, there's no explicit handling to ensure old price stays (it does by default since nothing is updated on rejection).

Actually, the rent increase approval already updates `units.monthly_rent` (line 68) and `properties.approved_rent` (line 75). The marketplace should reflect this. The real issue might be that the `monthly_rent` field in property editing is not read-only when there's an active tenancy — let me check.

Actually, from the memory: "the 'monthly_rent' field becomes strictly read-only once a tenancy is created." This is already enforced. The user's complaint is that after approval, the field should "simply update with the approved price" — meaning the landlord should see the new approved price reflected immediately without needing to manually edit. Since the admin approval already updates `units.monthly_rent`, this should work. The issue may be that the property listing/marketplace page caches old data. No additional code change needed for the data flow, but we should ensure the marketplace listing component reads fresh data.

Let me re-read: "after landlord applies for rent increase application and admin approves, the rent field should stay read only and simply update with the approved price from Admin. This change must update on marketplace as well." The update to `units.monthly_rent` already happens. But the `properties` table may have a separate listing price. Let me check if marketplace reads from units or properties.

**Fix**: The approval flow already updates `units.monthly_rent`. We should also update the `listing_price` or equivalent field on the `units` table if separate, and update `properties.asking_rent` if that's what marketplace reads. Since I see `properties.approved_rent` is updated, we need to ensure marketplace reads from the unit's `monthly_rent` which is already updated.

## Files to Modify

1. **`src/pages/regulator/EngineRoom.tsx`** — Add loading guard
2. **`src/pages/regulator/EscrowDashboard.tsx`** — Fix CSV/PDF exports to use filtered data; fetch and apply operational_start_date
3. **`src/pages/landlord/AddTenant.tsx`** — Fetch rent bands and compute dynamic fee; add server-side payment verification before tenancy creation
4. **`src/pages/regulator/RegulatorRentReviews.tsx`** — Verify marketplace price fields are updated on approval (may also need to update `asking_rent` or listing fields)

## Technical Details

**Engine Room fix** — 2-line addition before the return statement.

**Escrow Report fix** — In `exportCSV()`: replace `stats.totalEscrow` with `visibleRevenueTotal`, replace `revenueByType` with `visibleRevenueByType`, replace `allocationCards` reference (already correct in CSV but uses raw stats). In `exportPDF()`: same replacements. The summary section should show `visibleRevenueTotal` instead of `stats.totalEscrow`.

**Operational Start Date fix** — Fetch `platform_config` where `config_key = 'operational_start_date'` on mount. Store as state. In `getPresetRange("all")`, return `{ from: operationalStartDate, to: null }` instead of `{ from: null, to: null }`.

**Add Tenant Fee fix** — Fetch `rent_bands` table on mount. When displaying the fee button, compute `bandFee` by finding the rent band where `monthlyRent >= min_rent AND (max_rent IS NULL OR monthlyRent <= max_rent)`. Display `bandFee` instead of `feeConfig.amount`.

**Payment Bypass fix** — In `handleSubmit()`, when fee is enabled, query `escrow_transactions` for a completed `add_tenant_fee` payment by the current user. If none found, show error and block.

