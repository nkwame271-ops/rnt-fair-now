

# Fix Hardcoded Fee Amounts — Make All Fee Displays Dynamic

## Problem

Fee amounts are hardcoded in **6 locations** across 4 files. When an admin changes fees in Engine Room (e.g., tenant registration from 40 to 10), the actual Paystack charge uses the dynamic value but the UI still shows the old hardcoded amount. This causes user confusion and trust issues.

**Affected hardcoded values:**

| File | Hardcoded Value | Should Be |
|------|----------------|-----------|
| `RegisterTenant.tsx` line 177 | `GH₵ 40.00` (left panel) | Dynamic from `tenant_registration` flag |
| `RegisterTenant.tsx` line 393 | `Pay GH₵ 40` (success step) | Dynamic |
| `RegisterTenant.tsx` line 412 | `Pay GH₵ 40 Registration Fee` (button) | Dynamic |
| `RegisterLandlord.tsx` line 172 | `GH₵ 30.00` (left panel) | Dynamic from `landlord_registration` flag |
| `RegisterLandlord.tsx` line 350 | `Pay GH₵ 30` (success step) | Dynamic |
| `RegisterLandlord.tsx` line 389 | `Pay GH₵ 30 Registration Fee` (button) | Dynamic |
| `ProtectedRoute.tsx` line 192 | `GH₵ 40.00` / `GH₵ 30.00` | Dynamic |
| `ProtectedRoute.tsx` line 211 | `Pay GH₵ 40` / `Pay GH₵ 30` | Dynamic |
| `TenantDashboard.tsx` line 98 | `GH₵ 30` | Dynamic (landlord reg, but shown on tenant?) |
| `LandlordDashboard.tsx` line 98 | `GH₵ 30` | Dynamic |

## Plan

### 1. `src/pages/RegisterTenant.tsx`
- Import `useFeeConfig` from `useFeatureFlag`
- Call `useFeeConfig("tenant_registration")` to get `{ amount, loading }`
- Replace all `GH₵ 40` references with `GH₵ ${amount.toFixed(2)}`

### 2. `src/pages/RegisterLandlord.tsx`
- Same approach with `useFeeConfig("landlord_registration")`
- Replace all `GH₵ 30` references

### 3. `src/components/ProtectedRoute.tsx`
- Import `useFeeConfig`
- Fetch the appropriate fee based on role (`tenant_registration` or `landlord_registration`)
- Replace hardcoded `GH₵ 40.00` / `GH₵ 30.00` with dynamic values

### 4. `src/pages/landlord/LandlordDashboard.tsx`
- Use `useFeeConfig("landlord_registration")` for the unpaid banner amount

### 5. `src/pages/tenant/TenantDashboard.tsx`
- Use `useFeeConfig("tenant_registration")` for the unpaid banner amount

No database changes needed — `feature_flags` already has the dynamic `fee_amount` values.

