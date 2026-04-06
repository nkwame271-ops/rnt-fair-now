

# Fix: Separate Quota vs. Transfer Stock & Remove Range Binding from Number-Only Mode

## Problem Summary

1. **Quota and Transfer are conflated.** "Transfer by Number" currently sends `allocation_mode: "quantity_transfer"` which is treated identically to `"quota"` in PendingPurchases — both draw from regional pool. But "Transfer by Number" should actually **move serials to office stock** (same as "Next Available"), just without the admin needing to see which serials. The user wants two distinct concepts:
   - **Transfer** (both sub-modes) = physical stock movement → serials become `stock_type: "office"`
   - **Quota** = assignable limit only, no stock movement

2. **"Transfer by Number" still binds to serial ranges.** The edge function records `start_serial`/`end_serial` for quota/quantity_transfer, and PendingPurchases restricts assignment to specific serials. Number-only transfer should simply move N next-available serials to office stock without exposing ranges to the admin.

3. **Office Stock card doesn't update after transfer** because quota-mode entries don't change `stock_type`, so the Office Stock view (which queries `stock_type = "office"`) shows nothing.

## Solution

### 1. Edge Function (`admin-action/index.ts`)

**Change `quantity_transfer` to behave like `transfer`**: When `allocation_mode` is `"quantity_transfer"`, use the same serial-fetching and `stock_type` update logic as `"transfer"` mode — fetch N next-available regional serials, update them to `stock_type: "office"` with the office name. The only difference from explicit transfer: don't require the admin to pick serials (which is already the case). Remove `quantity_transfer` from the quota-only branch (line 265) so it falls through to the transfer branch.

Specifically:
- Line 265: Change `if (aMode === "quota" || aMode === "quantity_transfer")` → `if (aMode === "quota")`
- The `else` branch (transfer logic, lines 285-360) already handles physical movement. `quantity_transfer` will now use that same path, recording `allocation_mode: "quantity_transfer"` in the `office_allocations` record but physically moving serials.

### 2. PendingPurchases (`PendingPurchases.tsx`)

**Remove `quantity_transfer` from quota check**: Line 282 currently checks `.in("allocation_mode", ["quota", "quantity_transfer"])`. Change to `.eq("allocation_mode", "quota")` only. Offices with `quantity_transfer` allocations already have their serials in office stock (`stock_type: "office"`), so they use the normal office-stock fetch path.

This means:
- If office has **only quota allocations** → fetch from regional pool, enforce limit
- If office has **only transfer/quantity_transfer** → fetch from office stock (normal)
- If office has **both** → quota check applies for regional pool; office stock is also available from transfers

### 3. OfficeAllocation UI (`OfficeAllocation.tsx`)

**Summary cards**: Keep the two cards as-is:
- "Regional Stock" = count of `stock_type: "regional"`, `status: "available"` (already correct)
- "Office Stock" = count of `stock_type: "office"`, `status: "available"` (already correct — will now update properly after both transfer modes)

**Quota tab `computeQuotaUsage`**: Already filters by `allocation_mode === "quota"` only (line 97), so no change needed there.

### 4. OfficeSerialStock (`OfficeSerialStock.tsx`)

No changes needed — it already queries `stock_type: "office"` which will now correctly reflect both "Next Available" and "By Number" transfers.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/admin-action/index.ts` | Move `quantity_transfer` out of the quota branch into the transfer branch so it physically moves serials |
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | Remove `quantity_transfer` from quota-mode check; only `"quota"` triggers regional pool fetch |

Two files, minimal changes. The core fix is a one-line condition change in the edge function and one-line change in PendingPurchases.

