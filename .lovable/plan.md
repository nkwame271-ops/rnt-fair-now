# Escrow Ledger Recalculation & History Preservation — SHIPPED

## Schema (migration applied)
`escrow_splits` gained: `status` (active|superseded), `superseded_at`, `correction_run_id`, `payout_readiness` (pending|ready|unassigned|released|failed). Indexes on `(escrow_transaction_id, status)` and `correction_run_id`.

## Code changes
- **`reconcile-internal-ledger`** — rewritten as the correction engine. Per invocation: one `correction_run_id`. Per tx: idempotency check (active sum ≈ total), validation gate (expected sum ≈ total ± 0.01), supersede current active rows (UPDATE never DELETE), insert new rows tagged `status='active'` + `correction_run_id`. Computes `reconciliation_diff = active_sum − success_payout_sum`. `payout_transfers` is read-only.
- **`_shared/finalize-payment.ts`** — every insert into `escrow_splits` now sets `status='active'` + `payout_readiness`. Ledger posting is decoupled from payout: missing recipient → row stays active with `payout_readiness='unassigned'`. After transfer attempt, row's `payout_readiness` flips to `released` / `failed` / `unassigned` independently of `disbursement_status`.
- **`finalize-office-attribution`** — only re-tags `active` deferred rows (`.eq('status','active')`) and flips `payout_readiness` to `ready` / `released`.
- **`process-office-payout`** — balance calc now reads `status='active'` only.
- **`paystack-webhook`** — release/reverse events also update `payout_readiness`.
- **Frontend** — `OfficeFundRequests.calculateBalance` and `EscrowDashboard` splits query both add `.eq('status','active')`. (Only frontend files that read `escrow_splits` directly.)

## Acceptance
- ✅ Every active set sums to `total_amount` ±0.01 GHS.
- ✅ Re-running correction is a no-op (idempotency guard on active sum).
- ✅ `payout_transfers` never touched by correction.
- ✅ Missing recipient never blocks ledger posting.
- ✅ All live dashboard queries filter `status='active'`.

## Operating the correction engine
Invoke `reconcile-internal-ledger` (super/main admin only). Body:
```json
{ "from": "2025-01-01", "to": "2025-04-17", "limit": 200, "dry_run": true }
```
Or surgical:
```json
{ "escrow_transaction_ids": ["uuid1","uuid2"], "dry_run": false }
```
Always run `dry_run: true` first; response includes `reconciliation_diffs[]` per tx and a summary.
