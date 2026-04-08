

# Plan: Daily Report Enhancements, Manual Assign Scroll Fix, Escrow Date Filtering

## 1. Daily Report Enhancements

**File**: `src/pages/regulator/rent-cards/DailyReport.tsx`

### Changes:
- Add a **date picker** field so staff can generate reports for any date (not just today). This enables missed report generation.
- Add a **"Previous Reports"** read-only section below the form that queries `daily_stock_reports` for the selected office, showing past submissions in a table (date, opening, assigned, sold, spoilt, closing, signed by). Read-only — no edit/delete.
- Add **report period selector**: "Daily" (single date), "Weekly" (auto-computes Mon–Sun range), "Custom Range" (from/to date picker). When Weekly or Custom is selected, stats are aggregated across the date range.
- For Weekly/Custom: query `rent_card_serial_stock` activity and `serial_assignments` across the full date range, then sum.
- Add **Export buttons** (CSV and PDF) using the same pattern as `AdminReportView.tsx` — structured output with headers, office name, period, stats, and sign-off metadata. Uses jsPDF and manual CSV generation.

---

## 2. Manual Assign Scroll Fix

**File**: `src/pages/regulator/rent-cards/PendingPurchases.tsx`

**Problem**: The manual assign list inside the Dialog uses `ScrollArea` with `max-h-[300px]`, but the dialog itself has `max-h-[90vh] overflow-hidden flex flex-col`. The inner content area uses `overflow-y-auto` but isn't constrained properly, causing content to be cut off.

**Fix**:
- Change the dialog's inner content `div` (line 678) from `className="space-y-4 flex-1 overflow-y-auto"` to use `min-h-0` to allow flex shrinking.
- For manual mode specifically (line 833), change `ScrollArea className="max-h-[300px]"` to a taller constraint like `max-h-[40vh]` with explicit `overflow-y-auto` and visible scrollbar styling.
- Ensure the container has proper flex layout so the footer stays fixed and the content scrolls.

---

## 3. Escrow Dashboard Date Filtering & Export

**File**: `src/pages/regulator/EscrowDashboard.tsx`

### Changes:
- Add a **date filter bar** below the office selector with preset buttons: Today, Yesterday, Last 7 Days, This Week, This Month, Custom Range (from/to date inputs).
- Apply the selected date range as `.gte("created_at", fromDate)` and `.lte("created_at", toDate)` on `escrow_transactions`, `escrow_splits`, `payment_receipts`, and `payout_transfers` queries.
- All summary cards, allocation totals, revenue-by-type, pipeline stats, office breakdown, and receipt list update based on the selected period.
- Add **Export section** with two buttons:
  - **Export Excel (CSV)**: Structured CSV with sections — Summary row, Allocation breakdown, Revenue by Type, Office breakdown, Receipt list. Clean headers, formatted amounts.
  - **Export PDF**: Using jsPDF — title, period, summary table, allocation table, revenue by type table, receipt register. Presentation-ready layout with borders and formatting.

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/regulator/rent-cards/DailyReport.tsx` | Date picker, previous reports view, weekly/custom range, export |
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | Fix manual assign scroll constraints |
| `src/pages/regulator/EscrowDashboard.tsx` | Date filter bar, filtered queries, CSV/PDF export |

