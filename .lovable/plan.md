
# Lock the Ledger: Real-Time, Atomic, Zero-Duplicate Sync with Paystack

## Problem
The ledger lags Paystack and occasionally misses entries. Root causes in current pipeline:
1. **No DB-level uniqueness** on `paystack_transaction_id` for `escrow_transactions`, `payment_receipts`, or `escrow_splits` — relies on app-level "find then insert" checks (race-prone).
2. **`finalizePayment` is not a single DB transaction** — splits, receipt, payouts, and side effects are independent inserts. A failure mid-pipeline leaves the ledger half-written; a retry can double-write splits.
3. **Drift monitor runs every 15 min** — that's the "lag" the user is seeing.
4. **No live "ledger sync health" signal** — admins only discover drift by clicking around.

## Solution (4 layers)

### Layer 1 — Hard DB guarantees (uniqueness + atomic RPC)
- Add **unique indexes** so the database physically refuses duplicates:
  - `escrow_transactions(paystack_transaction_id)` where not null
  - `payment_receipts(escrow_transaction_id)` (already 1:1 logically — enforce it)
  - `escrow_splits(escrow_transaction_id, recipient, description)` partial unique on `status='active'`
  - `payout_transfers(paystack_reference)` (likely already unique — verify and enforce)
- Wrap the finalize pipeline in a new **`finalize_payment_atomic(reference, paystack_tx_id, amount)`** Postgres function (SECURITY DEFINER, single transaction). It performs: mark escrow completed → insert splits → insert receipt → insert payout rows → side-effect log. If any step fails, the whole thing rolls back. Re-running with the same `paystack_tx_id` is a no-op (idempotent on the unique indexes).
- Keep the existing TypeScript `finalizePayment` as a thin caller of this RPC (so webhook + verify-payment + reconcile-payment + drift-monitor all converge on the same atomic path).

### Layer 2 — Three redundant write paths, one source of truth
Every Paystack charge gets finalized through whichever of these fires first; all three call the same atomic RPC, so duplicates are impossible:
1. `paystack-webhook` (primary, real-time)
2. `verify-payment` (called from checkout success redirect)
3. `receipt-drift-monitor` (safety net)

### Layer 3 — Cut drift detection from 15 min → 1 min
- Update `pg_cron` to invoke `receipt-drift-monitor` every minute (was 15).
- Add a lightweight **`/api/ledger-health` ping** (new edge function) that returns `detect_receipt_drift()` JSON — used by the regulator UI to show a live "Ledger ✓ in sync" pill that turns red the second drift > 0.

### Layer 4 — Live UI indicator + auto-repair
- Add a small **`LedgerSyncBadge`** to the Payment Reconciliation Centre header and to the existing Transaction Explorer (top-right). Polls `/api/ledger-health` every 30s.
- When badge shows drift, a one-click "Resync now" button calls `receipt-drift-monitor` immediately and refreshes.

## Technical Details

### New migration (`*_atomic_ledger.sql`)
```sql
-- 1. Uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS escrow_tx_paystack_tx_uniq
  ON escrow_transactions(paystack_transaction_id)
  WHERE paystack_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_escrow_uniq
  ON payment_receipts(escrow_transaction_id)
  WHERE escrow_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS escrow_splits_dedup
  ON escrow_splits(escrow_transaction_id, recipient, COALESCE(description,''), COALESCE(office_id,''))
  WHERE status = 'active';

-- 2. Atomic RPC (wraps the current finalize logic in one txn)
CREATE OR REPLACE FUNCTION finalize_payment_atomic(...)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER ...
```

### Cron change (via `supabase--insert` per project rules)
```sql
SELECT cron.unschedule('receipt-drift-monitor');
SELECT cron.schedule('receipt-drift-monitor', '* * * * *', $$...$$);
```

### Edge functions
- **New**: `ledger-health` (returns `detect_receipt_drift()` snapshot; no JWT).
- **Modified**: `_shared/finalize-payment.ts` — replace body with a single `supabaseAdmin.rpc('finalize_payment_atomic', {...})` call. SMS/email stays in the webhook (non-financial).
- **Modified**: `receipt-drift-monitor/index.ts` — call same RPC.

### Frontend
- **New**: `src/components/regulator/LedgerSyncBadge.tsx` — green pill when `missing_receipts + missing_receipt_numbers + unreconciled = 0`, red otherwise with count + "Resync now" button.
- **Modified**: `src/pages/regulator/PaymentReconciliationCentre.tsx` — mount badge in header.
- **Modified**: `src/components/regulator/TransactionExplorer.tsx` — mount badge in header.

## Files
- New migration (uniqueness + atomic RPC)
- Insert: cron reschedule to 1-minute
- New: `supabase/functions/ledger-health/index.ts`
- Edited: `supabase/functions/_shared/finalize-payment.ts`
- Edited: `supabase/functions/receipt-drift-monitor/index.ts`
- New: `src/components/regulator/LedgerSyncBadge.tsx`
- Edited: `src/pages/regulator/PaymentReconciliationCentre.tsx`
- Edited: `src/components/regulator/TransactionExplorer.tsx`

## Out of scope
- No changes to Paystack checkout flow, split-plan math, secondary split configs, or payment-type-specific side effects (rent cards, tenancy activation, etc.) — those already work, we just wrap them in the atomic txn.

## Guarantees after this change
1. **No duplicates** — DB physically rejects them.
2. **No partial writes** — atomic RPC: all-or-nothing.
3. **Max 1-minute lag** in worst case (webhook + verify-payment both failing → cron catches it).
4. **Visible truth** — admins see a live green/red sync pill on every payment screen.
