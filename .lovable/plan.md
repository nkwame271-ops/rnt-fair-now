

# Plan: Enhanced Reconciliation View, Stock Adjustment Tool, +149 Correction, and Unassign/Reassign Review

## Summary

Four deliverables: (1) rebuild the Reconciliation tab with date-filtered metrics, (2) add a stock adjustment tool to Office Allocation, (3) post the +149 pair correction to Greater Accra HQ, (4) confirm unassign/reassign logic integrity.

---

## 1. Enhanced Reconciliation View (`OfficeReconciliation.tsx`)

Replace the current office-only reconciliation with a date-filtered dashboard showing the 9 requested metrics.

**Date filter bar**: Today, Yesterday, This Week, This Month, Custom Range (using date picker).

**Metrics computed from `rent_cards` and `rent_card_serial_stock` filtered by the selected period**:

| # | Metric | Source |
|---|--------|--------|
| 1 | Total successful rent card payments | `escrow_transactions` where `payment_type = 'rent_card_purchase'` and `status = 'completed'`, filtered by `created_at` in period |
| 2 | Total equivalent pairs paid for | Count of `rent_cards` created in period ÷ 2 |
| 3 | Paid pairs awaiting serial | Cards with `status = 'awaiting_serial'` created in period ÷ 2 |
| 4 | Paid pairs assigned serials | Cards with `status = 'valid'` created in period ÷ 2 |
| 5 | Pairs unassigned after prior assignment | Count from `admin_audit_log` where `action = 'unassign_serial'` in period |
| 6 | Net assigned pairs | (#4 - #5) |
| 7 | Inventory adjustment increases | Sum from new `inventory_adjustments` table where `adjustment_type = 'increase'` in period |
| 8 | Inventory adjustment decreases | Sum from `inventory_adjustments` where `adjustment_type = 'decrease'` in period |
| 9 | Current available stock by office | `rent_card_serial_stock` where `status = 'available'` and `stock_type = 'office'`, grouped by `office_name` (live, not date-filtered) |

Keep the existing office-level reconciliation and snapshot functionality below the new metrics section.

---

## 2. Stock Adjustment Tool (`OfficeAllocation.tsx`)

Add a new section below the allocation history: **"Inventory Adjustment"**.

**UI**: Region selector → Office selector → Adjustment type (Increase / Decrease) → Quantity (pairs) → Reason (required text) → Note (optional) → Submit (requires password confirmation via `AdminPasswordConfirm`).

**Backend**: 
- New database table `inventory_adjustments` to record every adjustment.
- New `admin-action` case `"inventory_adjustment"` that:
  - For **increase**: inserts N new stock rows (pair_index 1 & 2) with `status = 'available'`, `stock_type = 'office'` using a synthetic serial prefix like `ADJ-{timestamp}-{i}`.
  - For **decrease**: finds N available stock rows for that office and marks them `status = 'revoked'`.
  - Records the adjustment in `inventory_adjustments`.
  - Writes to `admin_audit_log`.

**Table schema** (`inventory_adjustments`):
```sql
CREATE TABLE public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL,
  office_name text NOT NULL,
  region text NOT NULL,
  adjustment_type text NOT NULL, -- 'increase' or 'decrease'
  quantity integer NOT NULL,
  reason text NOT NULL,
  note text,
  performed_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
-- Regulators read, service role manages
```

---

## 3. Post +149 Pair Correction

After the stock adjustment tool is built, use