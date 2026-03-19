

# Feature Flag-Aware Dashboard Links

## Changes

### 1. Tenant Dashboard — Remove Quick Actions section entirely
**File:** `src/pages/tenant/TenantDashboard.tsx`
- Delete the `quickActions` array (lines 18-23)
- Delete the entire "Quick Actions" section (lines 163-177) including the heading, grid, and all links
- Remove unused icon imports (`FileText`, `Calculator`, `Store`, `CreditCard`) if no longer referenced elsewhere in the file

### 2. Landlord Dashboard — Gate quick links behind feature flags
**File:** `src/pages/landlord/LandlordDashboard.tsx`
- Import `useFeatureFlag` hook
- Wrap "Register New Property" link (lines 171-177) to only render when `register_property` feature flag is enabled
- Wrap "Declare Existing Tenancy" link (lines 178-184) to only render when `declare_existing_tenancy` feature flag is enabled
- If both are hidden, hide the entire grid section

