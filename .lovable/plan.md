

## Escrow Ledger Recalculation & History Preservation — Plan

### Blast radius

**Tables (schema)**: `escrow_splits` — add `status`, `superseded_at`, `correction_run_id`, `payout_readiness`. Index on `(escrow_transaction_id, status)`.
**Tables (read-only)**: `escrow_transactions`, `payout_transfers`, `feature_flags`, `secondary_split_configurations`, `office_payout_accounts`.
**Tables (write)**: `admin_audit_log`, `payment_processing_errors`.

**Portals affected (every `escrow_splits` query gains `WHERE status='active'`)**:
- Super Admin → `EscrowDashboard`, `SuperAdminDashboard`, `EngineRoom`
- Regulator → `OfficeReconciliation`, `OfficeFundRequests`, `OfficePayoutSettings`, `RegulatorAnalytics`, `DailyReport`, `AdminReportView`, `PaymentErrors`
- Landlord → `Receipts`, `PaymentSettings`
- Tenant → `Receipts`, `Payments`

**Edge functions edited**:
- `_shared/finalize-payment.ts` — reorder pipeline (verify → calc → post all as `active` → mark readiness → payout decoupled)
- `reconcile-internal-ledger/index.ts` — rewrite as **correction-run engine** (supersede → recalc → validate → insert)
- `finalize-office-attribution/index.ts` — re-tag only on active rows; no re-split, no new HQ row
- `process-office-payout/index.ts` — read active rows only
- `paystack-webhook/index.ts` & `verify-payment/index.ts` — no logic change, inherit via shared module

### Decisions assumed (confirm or correct in next message)
1. **Correction-run scope**: auto-detect mode — scan completed escrow_transactions in date window, supersede only those whose active-rows sum ≠ `total_amount` (within ±0.01 GHS).
2. **Rounding tolerance**: ±0.01 GHS on the validation gate (sum-equals-total). Strict zero rounding causes false aborts on 50/50 splits of odd amounts.
3. **`correction_run_id`**: one UUID per invocation of `reconcile-internal-ledger`; tagged on every new active row inserted in that run.

### Build steps

**Step 1 — Migration** (must run and approve before code edits, because `types.ts` regenerates):
```sql
ALTER TABLE escrow_splits
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','superseded')),
  ADD COLUMN superseded_at TIMESTAMPTZ,
  ADD COLUMN correction_run_id UUID,
  ADD COLUMN payout_readiness TEXT NOT NULL DEFAULT 'pending'
    CHECK (payout_readiness IN ('pending','ready','unassigned','released','failed'));

CREATE INDEX idx_escrow_splits_active
  ON escrow_splits (escrow_transaction_id, status);
CREATE INDEX idx_escrow_splits_correction_run
  ON escrow_splits (correction_run_id) WHERE correction_run_id IS NOT NULL;
```
All existing rows become `status='active'`, `payout_readiness='pending'`. Historical `disbursement_status` field stays for payout state — `payout_readiness` is the new ledger-side flag (decoupled from transfer execution).

**Step 2 — Rewrite `reconcile-internal-ledger`** as the correction engine:
- Generate one `correction_run_id` (UUID) per invocation.
- For each completed tx in window:
  - Compute expected allocation from `metadata.split_plan` + `secondary_split_configurations` (full-bucket math, applied once — already shipped).
  - Sum active rows. If `|sum − total_amount| ≤ 0.01` → skip (idempotency).
  - Otherwise: validation gate — sum expected; if `|expected_sum − total_amount| > 0.01` → log to `payment_processing_errors`, abort this tx, continue.
  - Mark all current `active` rows for this tx as `status='superseded', superseded_at=now()` (UPDATE, never DELETE).
  - INSERT new rows with `status='active', correction_run_id=<run>`. Set `payout_readiness='unassigned'` if office_id required but missing or no `paystack_recipient_code`; otherwise `'pending'`.
- Do NOT touch `payout_transfers`. Compute `reconciliation_diff = sum(active.amount) − sum(payout_transfers.amount where status='success')` and surface in response payload.
- Audit log entry per run with counts + total recovered/voided amounts.

**Step 3 — Rewrite `finalize-payment.ts` ordering** (new payments):
1. Verify Paystack reference (existing).
2. Calculate full allocation (primary + secondary, full-bucket math — already shipped).
3. **Insert ALL splits as `status='active'`** in one batch — never blocked by recipient lookup. Missing office/recipient → `payout_readiness='unassigned'`.
4. Mark `payout_readiness='ready'` on rows with valid recipient.
5. Execute Paystack transfers in a try/catch loop — failures update `payout_readiness='failed'` and write `payout_transfers` row, but never delete or modify the split.

**Step 4 — `finalize-office-attribution`**: only re-tag `office_id` on existing `active` deferred rows and flip `payout_readiness` to `ready`. No re-split. No new HQ row. (Already shipped — verify only.)

**Step 5 — Add `WHERE status='active'` to every dashboard query**:
- Append `.eq('status','active')` to every `from('escrow_splits')` call across the ~12 frontend files listed above.
- `EscrowDashboard` (Super Admin) gains a new "Audit view" tab that queries WITHOUT the filter and labels rows by status.
- `OfficeReconciliation` adds a `reconciliation_diff` column per tx (active entitlement − executed payouts).

**Step 6 — Verification queries** after deploy:
- Per-tx integrity: `SELECT escrow_transaction_id, SUM(amount) FROM escrow_splits WHERE status='active' GROUP BY 1 HAVING SUM(amount) != (SELECT total_amount FROM escrow_transactions WHERE id = escrow_transaction_id);` → must return zero rows.
- Idempotency proof: run `reconcile-internal-ledger` twice; second run reports 0 superseded, 0 inserted.
- Payout immutability: `SELECT COUNT(*) FROM payout_transfers` before/after must be identical.

### Acceptance criteria
- Every transaction has exactly one set of `active` rows summing to `total_amount` (±0.01).
- `payout_transfers` row count and values unchanged by correction runs.
- Every live dashboard query filters `status='active'`; audit view shows both.
- Re-running correction is a no-op.
- New payments post the full ledger before any transfer attempt; recipient gaps never block posting.

### Open questions (answer to lock the plan)
- **Q1**: Auto-detect scope (only broken txs) vs explicit ID list — confirm auto-detect?
- **Q2**: ±0.01 GHS tolerance OK, or strict equality?
- **Q3**: Default correction window — last 30 days unless `from`/`to` provided in request body?

Approve and I'll run the migration first (single tool call), then ship all code in one batch.

