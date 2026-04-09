

# Plan: System Audit & Fix — Reconciliation + Stock Integrity

## Audit Summary

After thorough inspection of the database schema, edge functions, and frontend code, here are the findings for each audit item:

---

## 1. PAIR MODEL (REMOVE ÷2 LOGIC) — **GAPS FOUND**

**Current state**: Cards are paired by `purchase_id` but there's no explicit `pair_id`. Reconciliation uses `Math.floor(count / 2)` on lines 176-178 of `OfficeReconciliation.tsx`.

**Fix**:
- Do NOT create a new table — use `purchase_id` as the implicit pair identifier (every purchase creates exactly 2 cards)
- Replace all `÷2` logic in `OfficeReconciliation.tsx` with `COUNT(DISTINCT purchase_id)` queries
- Update metrics to count by `purchase_id` groups instead of dividing raw card counts

---

## 2. EVENT-SPECIFIC TIMESTAMPS — **PARTIALLY IMPLEMENTED**

**Current state**: `rent_cards` has `created_at`, `purchased_at`, `activated_at`. `rent_card_serial_stock` has `created_at`, `assigned_at`, `revoked_at`. Missing: `unassigned_at` on stock table, `paid_at` on cards (currently using `purchased_at` which is close but not explicit).

**Fix**:
- Add `unassigned_at` column to `rent_card_serial_stock`
- Update `unassign_serial_atomic` function to set `unassigned_at = now()` when resetting stock rows
- Use `purchased_at` as the payment timestamp (already exists, aliased as `paid_at` in queries)

---

## 3. STATE-BASED UNASSIGN TRACKING — **GAP FOUND**

**Current state**: Unassigned pairs count comes from `admin_audit_log` (line 128-133 of reconciliation). This is fragile — logs can be missing, delayed, or inconsistent.

**Fix**:
- Use the new `unassigned_at` column on `rent_card_serial_stock` to count unassigned pairs in a period
- Query: `WHERE unassigned_at BETWEEN from AND to AND pair_index = 1` gives exact count
- Remove `admin_audit_log` dependency for this metric

---

## 4. STOCK ACCOUNTING FORMULA — **NOT IMPLEMENTED**

**Current state**: Available stock is just a raw count of `status = 'available'` rows. No formula-based derivation.

**Fix**:
- Implement the formula in reconciliation view:
  ```
  Available = Initial Allocation + Adj Increases - Adj Decreases - Assigned + Unassign Returns
  ```
- Add a "Formula Verification" row that compares the formula result against the actual `status = 'available'` count
- Flag discrepancies

---

## 5. ADJUSTMENT STOCK FLAGGING — **GAP FOUND**

**Current state**: Adjustment-created stock uses `ADJ-` serial prefix (convention only). No queryable flag column.

**Fix**:
- Add `stock_source` column to `rent_card_serial_stock` (default: `'generation'`, values: `'generation'`, `'adjustment'`, `'upload'`)
- Set `stock_source = 'adjustment'` in the `inventory_adjustment` increase case
- Set `stock_source = 'upload'` in `SerialBatchUpload`
- Update reporting to separate real vs adjustment stock

---

## 6. SAFE DECREASE LOGIC — **GAP FOUND**

**Current state**: Decrease selects rows with `.limit(iaQty)` but no explicit ordering — non-deterministic.

**Fix**:
- Add `.order("created_at", { ascending: true })` (FIFO) to decrease query in `admin-action` `inventory_adjustment` case
- Prefer adjustment stock first: `.order("serial_number", { ascending: true })` which puts `ADJ-` prefixed rows first alphabetically

---

## 7. CONCURRENCY PROTECTION — **PARTIALLY IMPLEMENTED**

**Current state**: `assign_serials_atomic` and `unassign_serial_atomic` use `SELECT FOR UPDATE` correctly. But `inventory_adjustment` in the edge function has no transaction isolation — concurrent requests could select the same rows for decrease.

**Fix**:
- Create a new RPC function `inventory_adjustment_atomic` that wraps the decrease logic in a transaction with `SELECT FOR UPDATE`
- Call this RPC from the edge function instead of doing multi-step queries

---

## 8. IDEMPOTENCY FOR ADMIN ACTIONS — **GAP FOUND**

**Current state**: No idempotency keys. Retried requests create duplicate adjustments.

**Fix**:
- Add `idempotency_key` column to `inventory_adjustments` table (unique, nullable)
- Generate key client-side: `${action}-${office}-${timestamp}`
- Check for existing key before processing; return previous result if found

---

## 9. NEGATIVE STOCK VALIDATION — **PARTIALLY IMPLEMENTED**

**Current state**: Decrease checks `availRows.length < iaQty` but this is a count check on fetched rows, not a transactional guarantee.

**Fix**:
- Move validation into the `inventory_adjustment_atomic` RPC (item 7) where it's protected by row locks
- Reject if `available_count < requested` within the transaction

---

## 10. +149 CORRECTION TRACEABILITY — **GAP FOUND**

**Current state**: `inventory_adjustments` has `reason` and `note` but no `reference_id` or `correction_tag`.

**Fix**:
- Add `reference_id` and `correction_tag` columns to `inventory_adjustments`
- The +149 correction will be tagged with `correction_tag = 'reconciliation_correction'` and a meaningful `reference_id`

---

## 11. HISTORICAL CONSISTENCY — **PARTIALLY IMPLEMENTED**

**Current state**: `office_reconciliation_snapshots` table exists but metrics are recalculated live (no period snapshots). Past reports will show different numbers if stock changes retroactively.

**Fix**:
- With event-specific timestamps (item 2), all metrics become reconstructable from timestamps
- Add a "Save Period Snapshot" button that stores the current metrics output as a JSON blob in a new `reconciliation_period_snapshots` table
- Past saved snapshots remain immutable

---

## 12. UNASSIGN/REASSIGN DATA INTEGRITY — **MOSTLY CORRECT**

**Current state**: `assign_serials_atomic` validates 2 stock rows, both `available`, both cards `awaiting_serial`. `unassign_serial_atomic` resets everything atomically. Both use `FOR UPDATE`.

**Fix needed**:
- Add unique constraint: one serial cannot be assigned to multiple active cards. Currently no constraint prevents this at DB level (the RPC logic prevents it but a constraint is safer).
- Add: `CREATE UNIQUE INDEX ON rent_card_serial_stock (serial_number, pair_index) WHERE status = 'assigned'` — this already exists as `rent_card_serial_stock_serial_pair_unique` but it's unconditional (not filtered to `assigned` only). The existing constraint is sufficient since a serial+pair_index combo is always unique.

**Conclusion**: The existing unique constraint `(serial_number, pair_index)` already prevents duplicate assignments. No additional constraint needed.

---

## Implementation Plan

### Migration 1: Schema additions
```sql
ALTER TABLE rent_card_serial_stock ADD COLUMN unassigned_at timestamptz;
ALTER TABLE rent_card_serial_stock ADD COLUMN stock_source text NOT NULL DEFAULT 'generation';

ALTER TABLE inventory_adjustments ADD COLUMN reference_id text;
ALTER TABLE inventory_adjustments ADD COLUMN correction_tag text;
ALTER TABLE inventory_adjustments ADD COLUMN idempotency_key text UNIQUE;

CREATE TABLE reconciliation_period_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_from timestamptz NOT NULL,
  period_to timestamptz NOT NULL,
  preset text,
  metrics jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE reconciliation_period_snapshots ENABLE ROW LEVEL SECURITY;
```

### Migration 2: Atomic adjustment RPC
Create `inventory_adjustment_atomic` PL/pgSQL function with:
- Row-level locking for decreases
- FIFO ordering (oldest first, adjustment stock first)
- Negative stock validation inside transaction
- Idempotency key check

### Update `unassign_serial_atomic`
- Set `unassigned_at = now()` on stock rows during reset

### Edge function changes (`admin-action/index.ts`)
- `inventory_adjustment` case: call new RPC instead of multi-step queries
- Accept and pass `idempotency_key`, `reference_id`, `correction_tag`

### Frontend changes (`OfficeReconciliation.tsx`)
- Replace all `÷2` with `COUNT(DISTINCT purchase_id)` queries
- Use `unassigned_at` for unassign metric instead of `admin_audit_log`
- Add formula verification row
- Add "Save Period Snapshot" button
- Show real vs adjustment stock breakdown

### Frontend changes (`OfficeAllocation.tsx`)
- Add `reference_id` and `correction_tag` fields to adjustment form
- Generate and send `idempotency_key`

### Frontend changes (`SerialBatchUpload.tsx`)
- Set `stock_source = 'upload'` on inserted rows

---

## Files to Create/Modify

| File | Change |
|------|--------|
| New migration | Schema additions (columns, table, RPC) |
| `supabase/functions/admin-action/index.ts` | Use new RPC, pass new fields |
| `src/pages/regulator/rent-cards/OfficeReconciliation.tsx` | Remove ÷2, use timestamps, add formula check, snapshots |
| `src/pages/regulator/rent-cards/OfficeAllocation.tsx` | Add idempotency + reference fields |
| `src/pages/regulator/rent-cards/SerialBatchUpload.tsx` | Set stock_source |
| Update `unassign_serial_atomic` function | Add `unassigned_at` |

