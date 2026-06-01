## Goal

Give Super Admin complete visibility and controlled movement of rent card stock across **Central Pool → Regional Pool → Office Stock**, without changing existing procurement, quota, or assignment flows.

## Current state (verified)

- `rent_card_serial_stock.stock_type` today is only `office` or `regional`. There is no `central` value.
- Regional → Office and Office → Regional (withdraw) already exist via `OfficeAllocation.tsx` + `admin-action` cases `allocate_to_office` / `withdraw_from_office`.
- `PendingPurchases.tsx` already shows office/region/batch for "Found elsewhere" serials and links Super Admin to AdminActions. Missing pieces are: an actual lookup tool, office-to-office moves, central pool, and bulk transfer UX.
- "Found elsewhere even though quota remaining > 0" is real: serials in regional pool are not in the assignable list once quota is exhausted, but the message logic also fires when serials sit in another office — the new lookup makes the true location explicit.

## Scope

### 1. New tab: Serial Lookup (Super Admin only)

Under `/regulator/rent-cards` → new tab `serial_lookup`. Pure read tool.

Inputs: single serial, comma list, or range (`RC-0001 → RC-0050`).
Output table per serial:

- Serial · Pair index
- Current location: `Central Pool` / `Regional Pool: <region>` / `Office: <office_name> (<region>)`
- Stock status (available / assigned / revoked)
- Batch label
- Last movement action + date + actor (from `admin_audit_log` filtered by `target_id = serial`)
- Assignment: linked `rent_cards.id`, landlord, tenancy code, tenant (if any)
- Quick actions per row: Move, Return to Pool, Open in Admin Actions

### 2. Reveal exact location on "Found elsewhere"

Already shows office/region/batch. Add:

- Linked tenancy/landlord when status = assigned.
- Super Admin: inline "Move here" button → opens the movement dialog pre-filled.

### 3. New tab: Stock Movement (Super Admin only)

Under `/regulator/rent-cards` → new tab `stock_movement`. Supports five flows:

1. Office → Regional Pool (existing withdraw, surfaced here too)
2. Regional Pool → Office (existing allocate, surfaced here too)
3. Office → Office (new)
4. Office or Regional → Central Pool (new)
5. Central → Regional Pool (new)

UI: source picker, destination picker, selection mode (single / multi-select / range / paste list), preview count, confirm with password + reason (uses existing `AdminPasswordConfirm`).

Constraints enforced server-side:

- Only `available` serials move. Assigned/revoked are skipped with a per-serial reason in the response.
- Pair atomicity: both `pair_index` rows for a serial move together.
- Office→Office requires same region OR explicit override flag.
- Returning to Central clears `office_name`, `region`, `office_allocation_id`.

### 4. Bulk operations

All movement flows accept:

- Multi-select from a paginated list
- Range input (`start_serial`, `end_serial`)
- Pasted list (newline/comma separated)

Preview shows: total requested, eligible, blocked (with reasons), pair count.

### 5. Backend

**Migration**

- Allow `stock_type = 'central'` (drop/extend CHECK constraint if present; add index).
- Backfill: none — central is opt-in via new moves.
- New RPC `move_serials_atomic(p_serials text[], p_target jsonb, p_actor uuid, p_reason text)` — `SECURITY DEFINER`, locks all rows `FOR UPDATE`, validates eligibility, performs the update, writes one `admin_audit_log` row per serial with action `stock_move:<from>→<to>`.

**Edge function**: extend `admin-action` with cases:

- `move_office_to_office`
- `move_to_central`
- `move_central_to_regional`
- `lookup_serial` (read-only aggregator returning the lookup payload)

All require `is_super_admin(auth.uid())`.

### 6. Frontend

New files:

- `src/pages/regulator/rent-cards/SerialLookup.tsx`
- `src/pages/regulator/rent-cards/StockMovement.tsx`
- `src/pages/regulator/rent-cards/movement/MoveDialog.tsx` (shared dialog)
- `src/pages/regulator/rent-cards/movement/SerialMultiPicker.tsx` (select / range / paste)

Edits:

- `src/pages/regulator/RegulatorRentCards.tsx` — register the two tabs, Super Admin gated.
- `src/pages/regulator/rent-cards/PendingPurchases.tsx` — expand "Found elsewhere" row with tenancy/landlord and a "Move here" link for Super Admin.

### 7. Not in scope / unchanged

- Existing revoke, void, unassign, quota, procurement, and assignment flows.
- Office staff UX — these tools are Super Admin only.
- Regional pool already behaves as a shared per-region source; no change needed.

## Technical notes

- Use `admin_audit_log` for "last movement" — query `target_type='serial' AND target_id=serial_number ORDER BY created_at DESC LIMIT 1`.
- Lookup joins: `rent_card_serial_stock` → `rent_cards` (by `assigned_to_card_id`) → `tenancies` → `profiles` for landlord/tenant names.
- Movement RPC must respect the existing pair model (two rows per serial via `pair_index`).
- All movement actions emit `admin_audit_log` entries so the new Serial Lookup "last action" field is populated immediately.

## Out of scope clarification

This plan does NOT change quota math. A serial in regional pool while quota=0 still won't appear in the office's assignable list — but Super Admin can now (a) see exactly where it sits and (b) move it directly into the office, or top up quota, as they prefer.