

# Rent Card Management — Full Section Overhaul

## Overview

Restructure the existing `RegulatorRentCards.tsx` from a flat layout into a tabbed interface with 6 distinct sections. Add a new `serial_assignments` table for audit history tracking and a stock alert threshold system.

## Database Changes (Migration)

### 1. New table: `serial_assignments` (audit trail)
Tracks who assigned serials, from which office, to which landlord, and when.

```sql
CREATE TABLE public.serial_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id text NOT NULL,
  landlord_user_id uuid NOT NULL,
  office_name text NOT NULL,
  assigned_by uuid NOT NULL,
  serial_numbers text[] NOT NULL DEFAULT '{}',
  card_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.serial_assignments ENABLE ROW LEVEL SECURITY;

-- Regulators read all, service_role full
CREATE POLICY "Regulators read assignments" ON public.serial_assignments
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role));
CREATE POLICY "Regulators insert assignments" ON public.serial_assignments
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));
```

### 2. Add `assigned_by` column to `rent_card_serial_stock`
```sql
ALTER TABLE public.rent_card_serial_stock
  ADD COLUMN IF NOT EXISTS assigned_by uuid,
  ADD COLUMN IF NOT EXISTS batch_label text;
```

### 3. Add `stock_alert_threshold` column to `admin_staff`
```sql
ALTER TABLE public.admin_staff
  ADD COLUMN IF NOT EXISTS stock_alert_threshold integer DEFAULT 50;
```

## Frontend Changes

### `RegulatorRentCards.tsx` — Complete rewrite with Tabs

Replace the current flat layout with a `Tabs` component containing 6 tabs:

| Tab | Content |
|---|---|
| **Serial Batch Upload** | Main Admin / Head Office uploads serials via textarea (existing) or CSV file upload. Assigns batch to a target office. Shows parsed preview before confirming. |
| **Office Serial Stock** | Table showing: total serials, available, assigned, remaining for the selected office. Breakdown by serial range. |
| **Pending Purchases** | Existing search by Landlord ID / Purchase ID. Shows pending count and purchase details. |
| **Assign Serials** | Combined with search results — officer clicks Assign, system auto-assigns next available from office stock. On success, inserts into `serial_assignments` for audit. |
| **Assignment History** | Paginated table from `serial_assignments`: date, officer name, office, landlord name/ID, purchase ID, serial numbers assigned, count. Filterable by date range. |
| **Stock Alerts** | Shows all offices where available stock < threshold (default 50). Main Admin can adjust threshold. Color-coded: red (<10), amber (<50), green (50+). |

### Key implementation details

- **CSV Upload**: Parse CSV files client-side using `FileReader`. Expected format: one serial per line or column A. Also support Excel-style paste.
- **Batch label**: When uploading, Main Admin can add a label (e.g., "Batch 2026-Q1") stored in `rent_card_serial_stock.batch_label`.
- **Assignment audit**: When `handleAssign` succeeds, insert a row into `serial_assignments` with current user ID, office, serials assigned, and purchase ID.
- **Stock Alerts**: Query all offices' available counts. Compare against threshold. Display as cards sorted by urgency.
- **Sub Admin restrictions**: Sub Admins only see their office's data across all tabs. Serial Batch Upload is Main Admin only.

### Tab visibility by role

| Tab | Main Admin | Sub Admin |
|---|---|---|
| Serial Batch Upload | Yes | No |
| Office Serial Stock | Yes (all offices) | Yes (own office only) |
| Pending Purchases | Yes | Yes |
| Assign Serials | Yes | Yes (own office) |
| Assignment History | Yes (all) | Yes (own office) |
| Stock Alerts | Yes | No |

## Files to Modify

| File | Action |
|---|---|
| Migration SQL | Create `serial_assignments`, alter `rent_card_serial_stock`, alter `admin_staff` |
| `src/pages/regulator/RegulatorRentCards.tsx` | Full rewrite with 6 tabbed sections |

