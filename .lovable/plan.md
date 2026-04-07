
Fix direction

What is still wrong in the current code
- `PendingPurchases.tsx` is still turning count-based allocation into a pseudo-range by fetching regional serials and then doing `slice(0, quotaRemaining)`. That is the core reason offices only see the first allocated block instead of the full regional registry.
- `OfficeAllocation.tsx` and `OfficeSerialStock.tsx` currently group `quantity_transfer` into the same quota usage logic, so allocation counts and stock views are still conceptually mixed.
- `admin-action/index.ts` already keeps `quantity_transfer` as count-only, but the UI layer is wrongly converting that count into restricted serial visibility.

Target model: 3 separate layers
1. Regional Registry
- Master source of selectable serials for a region
- Read from regional `rent_card_serial_stock` only
- Serials stay visible until actually assigned / invalidated

2. Office Allocation
- Count-only limit
- Backed by `office_allocations` entries for `quota` and `quantity_transfer`
- No serial reservation, no range binding, no stock movement

3. Office Usage Display
- Reporting only
- `Allocated`, `Used`, `Remaining`
- Derived from allocation totals minus `serial_assignments`
- Separate from physical office stock

Implementation plan

1. Fix assignment loading so allocation never limits serial visibility
- In `PendingPurchases.tsx`, keep using allocation totals only to compute `remaining`.
- For count-based offices, fetch the full unused regional registry list for that region.
- Remove the logic that truncates the serial list to `quotaRemaining`.
- Enforce the limit only at confirmation time: if selected/auto-assigned count exceeds remaining, block assignment.

2. Keep physical stock and count allocation fully separate
- In `OfficeAllocation.tsx`, keep:
  - `Next Available Serials` = physical stock transfer
  - `Transfer by Number Only` = count allocation only
  - `Priority Quota` = count allocation only
- Update labels/help text so users clearly see that number-only/quota affect capacity, not stock.
- Do not let count allocation update the “Already in Office Stock” card.

3. Show the right regional numbers
- Keep “regional registry available” based on actual unused regional serials.
- Add or relabel a separate derived count for “regional unallocated capacity” if needed:
  `regional available - outstanding count allocations`
- This satisfies “reduce unallocated count” without hiding any serial numbers from the picker.

4. Keep office stock card pure
- In `OfficeSerialStock.tsx`, keep stock summary based only on `stock_type = "office"`.
- If allocation info is shown on that screen, label it separately as allocation usage, not stock.
- Do not let `quantity_transfer` make office stock appear larger or smaller.

5. Preserve count-only behavior in the edge function
- In `supabase/functions/admin-action/index.ts`, keep `quota` and `quantity_transfer` as accounting-only inserts into `office_allocations`.
- Ensure those modes never write `start_serial`, `end_serial`, `serial_numbers`, or move `rent_card_serial_stock` rows.
- Keep all physical serial movement in the `transfer` branch only.

6. Tighten deferred office payout behavior
- `OfficePayoutSettings.tsx`: keep auto-create/update of the office transfer recipient after save, then refresh/display the stored recipient status.
- `_shared/finalize-payment.ts`: keep office splits deferred for `rent_card`, `rent_card_bulk`, `add_tenant_fee`, and `declare_existing_tenancy_fee`, but do not lazily create office recipients at payout time.
- `finalize-office-attribution/index.ts`: make this the only place that attributes the office and triggers payout. If no stored recipient code exists, log the issue and leave payout pending instead of attempting transfer.

7. Complete deferred attribution for office-owned fees
- For rent cards, keep attribution after serial assignment.
- For Add Tenant / Declare Existing Tenancy, hook attribution at the exact point where the responsible office is actually known, so office crediting and payout happen only after real office linkage.

Files to update
- `src/pages/regulator/rent-cards/PendingPurchases.tsx`
- `src/pages/regulator/rent-cards/OfficeAllocation.tsx`
- `src/pages/regulator/rent-cards/OfficeSerialStock.tsx`
- `supabase/functions/admin-action/index.ts`
- `src/pages/regulator/OfficePayoutSettings.tsx`
- `supabase/functions/_shared/finalize-payment.ts`
- `supabase/functions/finalize-office-attribution/index.ts`
- the existing office-linking points in `AddTenant.tsx` / `DeclareExistingTenancy.tsx` once traced

Expected outcome
- Offices can see all unused regional serials for their region
- Allocation limits how many can be assigned, not which serials are visible
- Office stock changes only after real physical transfer
- Allocation/usage becomes a separate reporting layer
- Office payouts happen only after attribution and only when a valid stored recipient code exists
