

# Fix: Operational Start Date Not Filtering Escrow for Other Admins

## Root Cause

The `operational_start_date` stored in `platform_config` is `"2025-04-08"` (year 2025), but the user intended `2026-04-08`. Since all escrow transactions are from March 2026 onwards, the 2025 date doesn't filter anything out. The date was likely saved incorrectly or entered with the wrong year.

Additionally, the operational start date is only applied when the date preset is "all". If an admin selects "this_month", "last7", or any other preset, there is no floor enforcement — transactions before the operational start date could theoretically appear.

## Changes

### 1. Fix stored date value (Data update)
Update `platform_config` to set the correct value: `"2026-04-08"`.

### 2. Enforce operational start date as a minimum floor for ALL presets (`EscrowDashboard.tsx`)
In `getPresetRange`, after computing the range for any preset, clamp the `from` value so it is never earlier than the operational start date. This ensures no data before the operational baseline ever appears, regardless of which date filter an admin selects.

```typescript
function getPresetRange(preset, operationalStartDate) {
  // ...compute range as before...
  // Then enforce floor:
  if (operationalStartDate && result.from) {
    const floor = startOfDay(new Date(operationalStartDate)).toISOString();
    if (result.from < floor) result.from = floor;
  }
  if (operationalStartDate && !result.from) {
    result.from = startOfDay(new Date(operationalStartDate)).toISOString();
  }
  return result;
}
```

### 3. Also enforce the floor in the `applyDateFilter` helper
Add a secondary guard: even when `dateRange.from` is null (which shouldn't happen after fix 2), the query always applies `gte("created_at", operationalStartDate)` for non-Super Admin users. This is a defense-in-depth measure.

## Files to Modify
- `src/pages/regulator/EscrowDashboard.tsx` — enforce operational start date floor in all presets
- Database data update — correct the stored `operational_start_date` to `2026-04-08`

