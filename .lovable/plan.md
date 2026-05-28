
## Problem

Office allocations behave as two disconnected pools:

- **Transfer by number** → only writes a `quota` / `quantity_transfer` row in `office_allocations` (pure accounting, no serials moved).
- **Next available** / **By range** → moves physical serials from regional → office stock (`stock_type='office'`).

In `PendingPurchases.loadSerialsForAssignment` the logic is **exclusive**:

```
if (totalQuota > 0)  → show ONLY regional pool, cap by quota remaining
else                 → show ONLY office physical stock
```

So once any quota row exists for an office, physical serials already transferred to that office become invisible during assignment. The user wants a single assignable balance:

```
assignable = office physical stock available + quota remaining
```

There is also no way to undo an allocation (reduce quota or pull serials back).

## Scope of changes

Frontend-only logic changes for the assignment surface, plus a new admin-action branch (`withdraw_from_office`) and a new "Reduce / Withdraw" panel inside `OfficeAllocation.tsx`.

### 1. Unified assignable balance (assignment side)

File: `src/pages/regulator/rent-cards/PendingPurchases.tsx`

`loadSerialsForAssignment` becomes additive:

1. Always fetch the office's physical stock (`stock_type='office'`, `office_name=office`, `status='available'`, `pair_index=1`) — call these `officePhysical`.
2. Compute `quotaRemaining` from `office_allocations` (`quota` + `quantity_transfer`) minus `serial_assignments.card_count` for that office, **minus pairs already taken from physical stock** (so physical assignments don't also burn quota — they're independent).
   - Cleanest: track physical assignments separately. Physical-stock pairs are consumed when the office stock row flips to `assigned`. Only quota-draw pairs (those pulled from the regional pool at assign time) should count against `quota_limit`.
   - Implementation: on confirm, tag each pair with its source (`physical` vs `quota`) and pass that into `serial_assignments` metadata so the quota calculation can exclude physical ones.
3. If `quotaRemaining > 0`, also fetch regional pool serials (current behaviour) and concatenate them after physical ones with a visual tag (`Physical` vs `Pool`).
4. `availableSerials` = physical first, then regional pool entries up to `quotaRemaining`.
5. Display in the assign popup: `Office balance: X physical + Y quota = Z assignable`.

On confirm:
- For serials chosen from `officePhysical`: no quota decrement — they already live in office stock; existing `assign_serials_atomic` flips the row.
- For serials chosen from the regional pool: same atomic assign, but record `card_count` in `serial_assignments` so quota usage advances. Also mark a `source='quota'` flag so withdrawal logic can tell them apart.

UI:
- Replace the "Quota allows only N more" message with combined: "X physical + Y quota remaining".
- Drop the `hasQuota ? regional-only : office-only` branch; remove the early "Quota exhausted" abort when physical stock still exists.
- `OfficeSerialStock.tsx` Opening/Closing tiles already sum physical + quota — keep, but rename label to "Assignable Pairs" and use the same formula.

### 2. Withdraw / reverse allocation

New UI block in `OfficeAllocation.tsx` ("Reduce Allocation") with two modes:

**A. Reduce by Quantity** (quota / quantity_transfer only)
- Select region → office → quantity → reason → password.
- Calls `admin-action` with `action: "withdraw_from_office"`, `mode: "quantity"`, `office_id`, `quantity`.
- Server logic:
  - Compute `quotaRemaining` (same formula as assignment).
  - Refuse if `quantity > quotaRemaining` ("Cannot reduce below committed quota").
  - Insert a negative-quota `office_allocations` row (`allocation_mode='quota_withdrawal'`, `quota_limit = -quantity`) so the existing SUM-based remaining calc subtracts cleanly without mutating historical rows.
  - Audit-log entry.

**B. Reduce by Physical Serial Range**
- Inputs: start_serial, end_serial, destination (default: return to regional pool of source region; later can be "another office").
- Calls `admin-action` `action: "withdraw_from_office"`, `mode: "range"`, with range.
- Server logic:
  - Select rows in `rent_card_serial_stock` where `office_name=office, stock_type='office', serial_number BETWEEN start AND end`.
  - **Block** if any row has `status != 'available'` (i.e. assigned/sold/spoilt). Return list of blocking serials so UI can show "Unassign these first: …".
  - For passing rows: update `stock_type='regional'`, clear `office_name`, `office_allocation_id`.
  - Insert a `office_allocations` row with `allocation_mode='range_withdrawal'`, `quantity = -count`, `start_serial`, `end_serial`, `serial_numbers` for audit/history.
  - Audit-log entry.

Both withdrawals appear in the existing allocation history list with a red badge.

### 3. Edge function: `supabase/functions/admin-action/index.ts`

Add `case "withdraw_from_office"` next to `allocate_to_office`. Reuse password / admin gate. Same audit log shape (`admin_audit_log`).

### 4. Allocation history & summary

- `OfficeAllocation.tsx` summary already sums `quota_limit || quantity`. Negative-quota rows from withdrawals will subtract naturally — no formula change.
- History row: show `quota_withdrawal` / `range_withdrawal` with a destructive badge.

## Technical notes

- No DB migration strictly required — `office_allocations.quota_limit` already allows integers; using negative values is the cheapest way to keep the SUM-based remaining calc honest. If the column has a `>= 0` check constraint we'll add a tiny migration to drop it. Need to verify on implementation.
- The "physical vs quota source" tag during assignment is the only subtle bit. Recommend adding a `source TEXT` column to `serial_assignments` (nullable, defaults `'physical'`) so quota usage = `SUM(card_count) WHERE source='quota'`. Small migration.
- All existing assignment paths (`assign_serials_atomic`) untouched; only the caller computes/records source.
- KYC, payment, escrow flows untouched.

## Out of scope

- Moving withdrawn serials to a *different* office in one step (we just return to regional pool; admin can re-transfer).
- Bulk reversal of an entire prior allocation by id (the by-range tool already covers this case).
