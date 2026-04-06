

# Office Allocation: Two Transfer Modes + Editable Quota

## Current State
- **Transfer tab**: physically moves specific serials from regional to office stock (serial-based)
- **Quota tab**: creates accounting entries, offices draw from regional pool (pool-based)

## What Needs to Change

### 1. Rename Transfer Tab to Support Two Sub-Modes

The "Transfer to Office" tab will offer two sub-options:
- **Next Available Serials** (existing behavior) — moves specific serials to office stock
- **Transfer by Number** (new) — records a numerical allocation; office draws from regional stock up to that number (similar to quota but for transfer use-cases)

Implementation: Add a radio group or sub-tabs within the Transfer tab. "Transfer by Number" calls the edge function with `allocation_mode: "quantity_transfer"`. The edge function creates an `office_allocations` record (like quota mode) but with `allocation_mode: "quantity_transfer"`. PendingPurchases will treat `quantity_transfer` the same as `quota` when checking available serials.

### 2. Editable Quota with Increase/Decrease

Replace the current "Add Quota" form with an editable quota manager per office:
- Show current total quota, used, and remaining for each office
- Allow admin to **set a new total quota** (increase or decrease)
- Enforce: new quota cannot be less than the number already used
- Edge function action: `set_office_quota` — computes the delta and either inserts a positive or negative `office_allocations` entry, or updates the existing cumulative quota
- Simpler approach: store a single `office_allocations` entry per office for quota mode, and update it in place (or insert adjustment records with positive/negative quantities)

### 3. Quota Enforcement in PendingPurchases

Already partially implemented. Extend to also check `allocation_mode = "quantity_transfer"` alongside `"quota"` when computing remaining allocation from the regional pool.

---

## Files to Change

| File | Change |
|------|--------|
| `OfficeAllocation.tsx` | Add sub-mode toggle under Transfer tab ("Next Available" vs "By Number"). Rework Quota tab to show editable quota per office with +/- controls and min-used validation. |
| `admin-action/index.ts` | Add `quantity_transfer` allocation mode (accounting-only, like quota). Add `adjust_office_quota` action to increase/decrease quota with floor enforcement. |
| `PendingPurchases.tsx` | Include `quantity_transfer` in the quota-check logic so offices with number-only transfers can also draw from regional stock. |

## Technical Details

**Edge Function — `allocate_to_office` with `allocation_mode: "quantity_transfer"`**:
- Same as current quota branch: insert into `office_allocations` with no serial movement
- Set `quota_limit` to the quantity so PendingPurchases can sum it

**Edge Function — new action `adjust_office_quota`**:
- Accepts `office_id`, `region`, `new_quota` (the desired total)
- Sums existing quota entries for this office
- Computes delta = `new_quota - current_total`
- If `new_quota < used_count`, reject with error "Cannot reduce below used count"
- Inserts an adjustment `office_allocations` record with `quantity: delta` (positive or negative)

**OfficeAllocation.tsx — Quota Tab Rework**:
- For each office with existing quota: show inline editable input with current total, used count, remaining
- "Update" button per office to save changes
- New offices without quota: show "Set Quota" input
- Validation: input cannot be less than `used` count, show error inline

**PendingPurchases.tsx**:
- Change the quota check query filter from `.eq("allocation_mode", "quota")` to `.in("allocation_mode", ["quota", "quantity_transfer"])`
- Everything else stays the same

