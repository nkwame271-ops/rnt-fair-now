## Goal
Make the Escrow & Revenue Dashboard load correct totals for **All Time** the same way the shorter presets already do.

## What I found
- The issue is in `src/pages/regulator/EscrowDashboard.tsx`.
- The shorter ranges work because they return fewer rows.
- **All Time** currently starts from the configured operational start date (`2026-04-07`) and that range now contains **1,098 escrow transactions**, which is above the backend’s default **1,000-row query limit**.
- The dashboard fetches transactions, payouts, and derived split totals **without pagination**, so the All Time view under-reads the data and appears stuck or only updates in small jumps.
- Split totals are then calculated only from the truncated transaction list, so the inflow/allocation figures drift together.

## Plan
1. **Fix the transaction fetch path**
   - Refactor the dashboard data loader to fetch `escrow_transactions` in pages until all rows in the selected range are loaded.
   - Apply the same office and date filters to every page so totals remain consistent.

2. **Fix dependent queries that use the same range**
   - Page through `payout_transfers` for the same range so pipeline stats do not cap out in All Time.
   - Keep the split batching logic, but feed it the full completed transaction ID set instead of the truncated first page.

3. **Stabilize All Time calculations**
   - Ensure summary cards, allocation totals, office breakdown, and receipt-linked metrics are all derived from the complete dataset.
   - Preserve the existing operational start-date floor so All Time still means “since go-live,” not pre-launch history.

4. **Validate the behavior**
   - Verify that Today / Yesterday / Last 7 Days still match current behavior.
   - Verify that All Time now exceeds the old cap and reflects the full accumulated amount instead of sticking near a stale value.

## Technical details
- **Files:** `src/pages/regulator/EscrowDashboard.tsx`
- **Likely implementation:** introduce a small reusable paginated fetch helper using `.range(from, to)` in a loop.
- **No database migration needed:** this is a frontend data-loading bug, not a schema or RLS issue.
- **Why this matches your symptom:** once the All Time range crossed 1,000 rows, the dashboard stopped counting everything after that cutoff, so newer money only showed up in small inconsistent increments instead of fully updating.