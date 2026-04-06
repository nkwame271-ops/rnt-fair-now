

# Phase 2: Office-Linked Sales Logic + Automatic Reconciliation

## Overview

Phase 1 established the two-tier stock model (Regional → Office). Phase 2 ties **sales operations to the assigning office**, adds **automatic office-level reconciliation**, and updates reporting to reflect office-linked sales data.

## Current State

- `PendingPurchases.tsx` assigns serials from office stock but queries by `office_name` only — does not filter by `stock_type = 'office'`
- `serial_assignments` table records office but no reconciliation check
- `OfficeSerialStock.tsx` shows stock but also queries regional stock via `or(office_name, region)` — should only show `stock_type = 'office'`
- `DailyReport.tsx` similarly queries broadly instead of office-only stock
- No reconciliation enforcement: assigned pairs vs fulfilled sales vs office-linked records are not cross-checked
- `rent_cards` table has no `assigned_office_id` / `assigned_office_name` to track which office fulfilled the purchase

---

## Database Changes

### 1. Add office tracking to `rent_cards`

```sql
ALTER TABLE rent_cards
  ADD COLUMN assigned_office_id text,
  ADD COLUMN assigned_office_name text;
```

When a serial is assigned, these columns record the office of record for that purchase.

### 2. Add office tracking to `serial_assignments`

Already has `office_name` and `office_id`. No schema change needed — just ensure code populates them correctly.

### 3. New table: `office_reconciliation_snapshots`

```sql
CREATE TABLE office_reconciliation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL,
  office_name text NOT NULL,
  snapshot_date date NOT NULL,
  total_office_stock integer NOT NULL DEFAULT 0,
  available_pairs integer NOT NULL DEFAULT 0,
  assigned_pairs integer NOT NULL DEFAULT 0,
  sold_pairs integer NOT NULL DEFAULT 0,
  spoilt_pairs integer NOT NULL DEFAULT 0,
  pending_purchases integer NOT NULL DEFAULT 0,
  fulfilled_purchases integer NOT NULL DEFAULT 0,
  discrepancy_notes text,
  is_balanced boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(office_id, snapshot_date)
);
ALTER TABLE office_reconciliation_snapshots ENABLE ROW LEVEL SECURITY;
-- RLS: regulators read, service_role all
```

---

## Frontend Changes

### 1. PendingPurchases — Filter by office stock only

**File**: `src/pages/regulator/rent-cards/PendingPurchases.tsx`

- When fetching available serials for assignment (line ~275), add `.eq("stock_type", "office")` to only pull from office stock
- After assignment, write `assigned_office_id` and `assigned_office_name` to the `rent_cards` row
- This makes the assigning office the "office of record"

### 2. OfficeSerialStock — Show office stock only

**File**: `src/pages/regulator/rent-cards/OfficeSerialStock.tsx`

- Remove the `or(office_name, region)` broad query (line ~61)
- Replace with: `.eq("office_name", officeName).eq("stock_type", "office")`
- This ensures stock counts reflect only what's been allocated to the office

### 3. DailyReport — Calculate from office stock only

**File**: `src/pages/regulator/rent-cards/DailyReport.tsx`

- Same fix: filter by `stock_type = 'office'` and exact `office_name`
- Remove the region-based `or()` query

### 4. New component: Office Reconciliation

**File**: `src/pages/regulator/rent-cards/OfficeReconciliation.tsx`

- Select office → runs reconciliation check:
  - **Office stock allocated** (from `office_allocations` for that office)
  - **Assigned pairs** (serials with `status = 'assigned'`, `stock_type = 'office'`)
  - **Fulfilled sales** (rent_cards with `assigned_office_id` matching and `status = 'valid'`)
  - **Available remaining** (serials with `status = 'available'`, `stock_type = 'office'`)
  - **Balance check**: allocated = available + assigned + sold + spoilt
- Show discrepancy flag if numbers don't add up
- "Save Snapshot" button stores to `office_reconciliation_snapshots`
- History of past snapshots per office
- Export reconciliation report as PDF

### 5. Updated Sales Tabs

**File**: `src/pages/regulator/RegulatorRentCards.tsx`

Add new sub-tab under Sales:
- **Reconciliation** (new) — accessible to Main Admin

### 6. AdminReportView — Add office-linked sales column

**File**: `src/pages/regulator/rent-cards/AdminReportView.tsx`

- Add a "Fulfilled Purchases" column sourced from `rent_cards` where `assigned_office_name` matches
- This gives a cross-check against the daily report's "Sold" count

---

## Edge Function Changes

### No new edge functions needed

All reconciliation logic runs client-side from existing table data. The serial assignment flow in `PendingPurchases.tsx` already uses direct Supabase calls (not the edge function) for the actual assignment — we just need to add `assigned_office_id` and `assigned_office_name` to the rent_cards update.

---

## Summary of Files

| Action | File |
|--------|------|
| Migration | New migration (2 statements: alter rent_cards, create reconciliation table) |
| Edit | `PendingPurchases.tsx` (filter stock_type, write office to rent_cards) |
| Edit | `OfficeSerialStock.tsx` (filter stock_type = office only) |
| Edit | `DailyReport.tsx` (filter stock_type = office only) |
| Edit | `AdminReportView.tsx` (add fulfilled purchases column) |
| Edit | `RegulatorRentCards.tsx` (add Reconciliation tab) |
| New | `OfficeReconciliation.tsx` |

