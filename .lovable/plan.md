

# Phase 1: Multi-Region Serial Generation + Office Allocation Layer

## Overview

This phase overhauls Procurement to support multi-region generation in a single action and adds a two-tier stock model: **Regional Stock → Office Stock**. Sales, reconciliation, and enhanced alerts come in a follow-up phase.

## Current Architecture

- `rent_card_serial_stock` table stores serials with `office_name` and `region` columns
- SerialGenerator generates for one office/region at a time
- No concept of "regional stock" vs "office stock" — everything is flat
- Stock alerts check total counts per office, not grouped by region

---

## Database Changes

### 1. New table: `region_codes` (editable by Main Admin)

```sql
CREATE TABLE region_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,       -- e.g. "GAR", "ASH", "WR"
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);
ALTER TABLE region_codes ENABLE ROW LEVEL SECURITY;
-- RLS: regulators manage, authenticated read
```

Seed with default codes for all 16 regions (GAR, ASH, WR, CR, ER, VR, NR, UER, UWR, BR, BER, AHR, WNR, OR, SVR, NER).

### 2. Add `stock_type` column to `rent_card_serial_stock`

```sql
ALTER TABLE rent_card_serial_stock
  ADD COLUMN stock_type text NOT NULL DEFAULT 'regional',
  ADD COLUMN office_allocation_id uuid;
```

- `stock_type`: `'regional'` (generated, in regional pool) or `'office'` (transferred to specific office)
- When serials are generated, they go into regional stock (`stock_type = 'regional'`, `region` set, `office_name` set to region name placeholder)
- When transferred to an office, `stock_type` becomes `'office'` and `office_name` is updated

### 3. New table: `office_allocations` (transfer log)

```sql
CREATE TABLE office_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL,
  office_id text NOT NULL,
  office_name text NOT NULL,
  quantity integer NOT NULL,
  start_serial text,
  end_serial text,
  serial_numbers text[] NOT NULL DEFAULT '{}',
  allocated_by uuid NOT NULL,
  batch_label text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE office_allocations ENABLE ROW LEVEL SECURITY;
-- RLS: regulators read/insert, service_role all
```

### 4. New table: `generation_batches` (full metadata per run)

```sql
CREATE TABLE generation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_label text NOT NULL,
  prefix text NOT NULL,
  regions text[] NOT NULL,
  region_details jsonb NOT NULL DEFAULT '[]',
  total_unique_serials integer NOT NULL,
  total_physical_cards integer NOT NULL,
  paired_mode boolean DEFAULT true,
  generated_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE generation_batches ENABLE ROW LEVEL SECURITY;
```

---

## Frontend Changes

### 1. SerialGenerator → Multi-Region Generator

**File**: `src/pages/regulator/rent-cards/SerialGenerator.tsx` (rewrite)

- Replace single-region selector with a multi-region checklist (checkboxes for each of the 16 regions)
- "Select All Regions" toggle
- For each selected region, show editable **start number** and **end number** fields (auto-populated with defaults)
- Serial format: `{prefix}{region_code}{padded_number}` (e.g. `RCD-2026-GAR-0001`)
- Region codes fetched from `region_codes` table
- Preview table showing: Region | Code | Start | End | Quantity | Sample Range
- Summary row: total unique serials, total physical cards
- Password confirmation dialog unchanged
- After generation: option to download structured Excel (SheetJS) or PDF (jsPDF)
- Each run creates a `generation_batches` record

### 2. New component: Region Code Manager

**File**: `src/pages/regulator/rent-cards/RegionCodeManager.tsx`

- Table showing all 16 regions with their codes
- Inline editing of codes (Main Admin only)
- Save updates to `region_codes` table
- Accessible from a sub-tab under Procurement

### 3. New component: Office Allocation

**File**: `src/pages/regulator/rent-cards/OfficeAllocation.tsx`

- Select a region → see regional stock summary (total available, already allocated)
- Two allocation modes via toggle:
  - **Option 1 (Priority Quota)**: Set a quota number per office. Staff can assign from regional stock until their office quota is reached. System tracks `allocated_quota` vs `used_count`.
  - **Option 2 (Transfer)**: Explicitly transfer N serials from regional stock to office stock. Choose "auto next available" or specify a starting serial. Supports transferring different quantities to all offices in the region at once (grid of office → quantity inputs).
- Transfer action updates `rent_card_serial_stock.stock_type` from `'regional'` to `'office'` and sets `office_name` to the target office
- Creates `office_allocations` record for audit trail
- Show allocation history per region

### 4. Updated Procurement Tabs

**File**: `src/pages/regulator/RegulatorRentCards.tsx`

Add new sub-tabs under Procurement:
- Generate Serials (existing, reworked for multi-region)
- Region Codes (new — Main Admin only)
- Office Allocation (new)
- Batch Upload (existing)
- Stock Alerts (moved, reworked)
- Procurement Report (new — downloadable Excel/PDF of all generation batches and allocations)

### 5. Stock Alerts Rework

**File**: `src/pages/regulator/rent-cards/StockAlerts.tsx` (rewrite)

- Query office-level stock only (`stock_type = 'office'`)
- Group display by region with collapsible headings
- Under each region heading, show all offices with their available counts
- Three threshold levels with color coding:
  - **Normal** (green): ≥ threshold
  - **Low** (amber): between critical and threshold
  - **Critical** (red): below critical threshold (e.g. < 10)
- Thresholds configurable (use existing `stock_alert_threshold` from `admin_staff`)

### 6. Procurement Report

**File**: `src/pages/regulator/rent-cards/ProcurementReport.tsx` (new)

- Table of all generation batches with metadata
- Filter by date range, region
- Download as structured Excel (SheetJS) or PDF (jsPDF)

---

## Edge Function Changes

### `admin-action/index.ts` — `generate_serials` case

- Accept `regions` array instead of single `office_name`/`region`
- For each region, use its code from `region_codes` table to build serial format
- Accept per-region `start_range` and `end_range`
- Insert all serials with `stock_type = 'regional'`
- Create `generation_batches` record
- Return summary with per-region counts

### New action: `allocate_to_office`

- Accept `region`, `office_id`, `office_name`, `quantity`, optional `start_serial`
- Find N available regional serials for that region
- Update their `stock_type` to `'office'` and `office_name` to the target office
- Create `office_allocations` record
- Requires Main Admin password confirmation

---

## Summary of Files

| Action | File |
|--------|------|
| Migration | New migration SQL (4 statements) |
| Rewrite | `SerialGenerator.tsx` |
| Rewrite | `StockAlerts.tsx` |
| New | `RegionCodeManager.tsx` |
| New | `OfficeAllocation.tsx` |
| New | `ProcurementReport.tsx` |
| Edit | `RegulatorRentCards.tsx` (tabs) |
| Edit | `admin-action/index.ts` (generate_serials + new action) |

Phase 2 (next) will cover: sales logic tied to assigning office, automatic office-level reconciliation, and updated reporting.

