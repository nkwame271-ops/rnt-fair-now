

## Plan — Make Internal Ledger Equal Total Revenue

### Root cause (verified against the DB)

Revenue total: **GHS 30,950.77** (278 completed tx, bundle parents excluded).
Active-splits total: **GHS 30,734.92**.
Gap: **GHS 215.85** broken into two parts:

1. **28 completed transactions have ZERO active splits** (sum = GHS 224.85). All have valid `metadata.split_plan` — so `reconcile-internal-ledger` *should* fix them but apparently has never run successfully (the edge-function logs are empty and `payment_processing_errors` has nothing for it).
2. **Bundle-parent splits inflate the ledger by GHS 9.** The dashboard *excludes* `existing_tenancy_bundle` / `add_tenant_fee` from revenue but *includes* their splits in the allocation total, so the two sides will never reconcile even after a perfect run.

There is also a **UI bug**: the success alert reads `data.repaired` and `data.rows_inserted`, but the function returns `corrected` and `rows_inserted`. So when the function does run successfully the user sees "Repaired: undefined" and assumes nothing happened.

### Fix (3 small changes, no schema changes)

**1. `supabase/functions/reconcile-internal-ledger/index.ts`** — make the function tolerate a missing/expired auth header from the SDK invoke path the same way other admin functions do, and return clear `corrected_count` + `missing_split_inserts` fields so the UI message is unambiguous. Add a console.log of the run summary so future runs show in edge logs. No logic change to the supersede/insert pipeline.

**2. `src/pages/regulator/EscrowDashboard.tsx`**
   - Fix the alert to read the correct fields: `data.corrected`, `data.rows_inserted`, `data.already_balanced`, `data.validation_gate_aborts`, `data.total_recovered_amount`.
   - Filter the active-splits query the same way revenue is filtered: exclude splits whose parent `escrow_transaction.payment_type` is in `BUNDLE_PARENT_TYPES`. This guarantees Allocation Total == Revenue Total once splits exist for every completed tx.
   - After a successful reconcile, instead of `window.location.reload()` re-trigger the existing `fetchData` so the user sees the new totals in place.

**3. One-time backfill** — invoke `reconcile-internal-ledger` from the dashboard on the full operational range (the user's existing button) once Step 1+2 are deployed. This will create the 28 missing split sets and close the GHS 215.85 gap. No DB migration needed; the function itself does the inserts safely (validation gate + supersede-not-delete).

### What stays untouched
RLS, auth, Paystack, finalize-payment, escrow_transactions data, payout_transfers, the supersede/insert audit trail, all other portals.

### Verification
- Click **Recalculate Ledger** → alert shows `Corrected: 28, Rows inserted: ~50, Recovered: GH₵ 224.85`.
- Total Revenue card and sum of Allocation cards now match exactly.
- Edge function logs for `reconcile-internal-ledger` show the run summary.
- Re-clicking Recalculate is a no-op (`Already balanced: 278`).

