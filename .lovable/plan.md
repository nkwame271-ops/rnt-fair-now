## Problem

In **Rent Cards → Pending & Assign**, the serial search picker shows hits that exist in the office's own regional pool (`stock_type = 'regional'`, same region, status `available`) but cannot be assigned, with the message:

> "In your regional pool (X) — beyond the currently loaded window. Transfer this serial into your office stock to assign it."

This happens because assignment only draws from the office's preloaded "assignable" list (physical office stock + N regional serials up to `quotaRemaining + 50`). Any regional serial outside that window is shown as informational only — the user has to leave the screen, open Admin Actions, run a range-transfer, then return and reassign. This is friction even when the office has assignable balance.

The fix the user asked for is a **one-click "Assign From Regional Pool"** action that does Regional Pool → Office Stock → Assignable in a single step, directly from the global hit row in the picker.

## Solution

Add a single-click flow in `SerialSearchPicker` (inside `PendingPurchases.tsx`) that appears on a global hit when **all** of these are true:

- `h.status === 'available'`
- `h.stock_type === 'regional'`
- `h.region === officeRegion` (the current office's region)
- The serial is not specifically allocated to another office (regional serials by definition aren't — `office_name` is null for `stock_type='regional'`)
- The current office has remaining assignable headroom (`quotaRemaining > 0`) — if not, surface a clear "request more quota" message instead of silently failing

When clicked, the button will:

1. Call the existing `admin-action` edge function with `action: 'allocate_office'`, `allocation_mode: 'range_transfer'`, `start_serial = end_serial = h.serial_number`, `region = officeRegion`, `office_id`, `office_name`. This already exists and atomically moves both pair_index 1 and 2 of that serial from regional → office stock and records an `office_allocations` row.
2. On success, re-run the existing `loadAssignableSerials` step so the freshly transferred serial appears in the assignable dropdown.
3. Automatically select the serial in the picker (`onChange(h.serial_number)`) and close the dropdown.
4. Toast: "Transferred {serial} from regional pool to your office stock — ready to assign."

No new backend, no schema change, no edits to revoke/quota/procurement logic. Existing range-transfer action already enforces region scoping and atomic pair handling.

## Additional Visibility Improvements

While in `explainHit()`, tighten the messaging so users always know what to do:

- Same-region regional + quota remaining → show the **Assign From Regional Pool** button (primary action).
- Same-region regional + quota exhausted → keep the current "request more quota" message, no button.
- Other-region regional or other-office stock → unchanged (informational; super admin gets the existing Admin Actions deep link).

Also bump the regional pool preload cap from `quotaRemaining + 50` to `quotaRemaining + 500` so common cases with light fragmentation stop hitting the "outside loaded window" path in the first place. (Cheap — already paginated 1000/page; bounded by `quotaRemaining`.)

## Files Touched

- `src/pages/regulator/rent-cards/PendingPurchases.tsx`
  - `SerialSearchPicker`: accept a new `onAssignFromPool(serial)` prop; render the button on qualifying hits.
  - `explainHit`: branch on quota remaining and same-region regional to drive button visibility.
  - Parent (`PendingPurchases`): implement `handleAssignFromPool(serial)` that invokes `admin-action` range-transfer (1 serial), reloads assignable serials, and selects the serial in the picker via the existing `onChange` for the active card row.
  - Bump regional preload cap from `+50` to `+500`.

No database migration, no edge function change, no changes to existing revoke / procurement / quota / assignment architecture.