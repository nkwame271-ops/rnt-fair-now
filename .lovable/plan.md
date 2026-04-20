

## Diagnosis

**Main Regulator Dashboard itself is NOT slow** — it only runs 8 small `count(*)` queries on tables with ≤623 rows.

**The real bottleneck:** any rent-card admin page hitting `rent_card_serial_stock` (**261,300 rows, zero filter indexes**).

Evidence from `pg_stat_user_indexes`:
- `rent_card_serial_stock_serial_pair_unique` — 15,083 scans returning **386,721,903 tuples** (~25K rows per query → near-full scans)
- No index exists on `office_name`, `region`, `status`, `pair_index`, `stock_type`, `batch_label`, `unassigned_at`, `stock_source`, `assigned_at`

**Affected pages** (all under `/regulator/rent-cards/*`):
StockAlerts, OfficeSerialStock, OfficeAllocation, OfficeReconciliation, PendingPurchases, AdminActions, DailyReport, SerialBatchUpload.

Several of these also paginate `select(...)` in `while(true)` loops fetching the entire dataset client-side.

## Fix Plan

### 1. Add composite indexes on `rent_card_serial_stock` (migration)
The high-impact index set covering all observed query shapes:

```sql
CREATE INDEX IF NOT EXISTS idx_rcss_office_status_pair
  ON rent_card_serial_stock (office_name, status, pair_index);
CREATE INDEX IF NOT EXISTS idx_rcss_region_status_pair
  ON rent_card_serial_stock (region, status, pair_index);
CREATE INDEX IF NOT EXISTS idx_rcss_serial
  ON rent_card_serial_stock (serial_number);
CREATE INDEX IF NOT EXISTS idx_rcss_batch_label
  ON rent_card_serial_stock (batch_label) WHERE batch_label IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rcss_unassigned_at
  ON rent_card_serial_stock (unassigned_at) WHERE unassigned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rcss_stock_type
  ON rent_card_serial_stock (stock_type, office_name);
```
Plus add the missing FIFO ordering helper:
```sql
CREATE INDEX IF NOT EXISTS idx_rcss_fifo
  ON rent_card_serial_stock (office_name, status, pair_index, stock_source, created_at);
```

### 2. Replace client-side full-table pagination with server-side aggregation
- **StockAlerts.tsx**: drop the unfiltered `select("office_name, status, stock_type, region, pair_index")` (pulls all 261K rows). Replace with a SQL view/RPC `rcss_office_summary` returning pre-aggregated counts per office.
- **DailyReport.tsx, OfficeReconciliation.tsx, PendingPurchases.tsx**: replace `while(true)` paged scans with `.select(..., { count: "exact", head: true })` filtered queries, or a single RPC.

### 3. Lightweight RPC for dashboard stat blocks (optional polish)
Single function `get_office_dashboard_stats(office_id)` returning all 8 counts in one round trip instead of 8 parallel queries.

### Expected impact
- StockAlerts/OfficeAllocation/Reconciliation: **5-30s → <300ms**
- Tuples read on stock table queries: **386M → <50K**
- No frontend behaviour changes; same data, same UI.

### Files to edit
- New migration: indexes + summary view/RPC
- `src/pages/regulator/rent-cards/StockAlerts.tsx`
- `src/pages/regulator/rent-cards/OfficeReconciliation.tsx`
- `src/pages/regulator/rent-cards/PendingPurchases.tsx`
- `src/pages/regulator/rent-cards/DailyReport.tsx`

