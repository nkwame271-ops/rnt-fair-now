## Escrow / Ledger Drift Fix Plan

### What I found
- **Receipts are mostly generating correctly now** and recent paid transactions already have:
  - a `payment_receipts` row
  - active `escrow_splits`
  - a reconciled `case_payments` row with `ledger_entry_id`
- The repeated drift is coming from **escrow release accounting**, not just receipt creation.
- In the current finalization flow, split rows are being marked **`disbursement_status = 'released'` immediately when a Paystack transfer request is accepted as pending**, instead of waiting for the actual `transfer.success` webhook.
- That means the platform can show money as already released even when Paystack has only accepted the transfer request, or has not completed it yet.
- I confirmed this is widespread in live data:
  - many active split rows are marked `released`
  - but there is **no matching successful payout transfer** for them yet
- The office wallet / escrow dashboard currently computes balances from **all active admin splits**, which overstates available or historical balance when release state is wrong.

### Root cause
There are **two coupled problems**:

1. **Backend status bug**
   - `finalize-payment.ts` sets split rows to `released` too early.
   - `finalize-office-attribution.ts` does the same for deferred office attribution payouts.
   - Correct behavior should be:
     - transfer initiated → split remains pending/releasing
     - `transfer.success` webhook → split becomes released
     - `transfer.failed` / `transfer.reversed` → split stays/reverts to unreleased

2. **Frontend accounting bug**
   - `EscrowDashboard.tsx` and `OfficeFundRequests.tsx` use broad totals from active `escrow_splits`
   - they do not strictly separate:
     - total inflow
     - unreleased balance
     - actually released amount
     - reserved/requested withdrawals
   - this allows the UI to disagree with the real payout lifecycle.

## Implementation plan

### 1) Fix payout-state handling in backend functions
Update these functions so split release state mirrors actual Paystack completion, not transfer initiation:
- `supabase/functions/_shared/finalize-payment.ts`
- `supabase/functions/finalize-office-attribution/index.ts`

Changes:
- when transfer request is created successfully:
  - keep split as **pending_transfer / in-flight**, not released
  - set `payout_readiness` to a non-final state
- only `paystack-webhook` on `transfer.success` sets:
  - `disbursement_status = 'released'`
  - `released_at`
  - `payout_readiness = 'released'`
- failed/reversed transfers remain unreleased and visible for repair

### 2) Repair existing bad split states in the database
Create a migration to safely normalize historical payout state.

Repair logic:
- for active split rows marked `released` **without any successful payout transfer**:
  - move them back to unreleased/in-flight state based on available payout rows
- keep rows with real `transfer.success` untouched
- preserve audit trail; do not delete historical payout data

This repair is necessary because code-only changes won’t fix already corrupted balances.

### 3) Tighten escrow dashboard calculations
Update `src/pages/regulator/EscrowDashboard.tsx` so each metric comes from a strict definition:
- **Total Revenue / Inflow** = completed escrow transactions in scope
- **Allocation totals** = active splits in scope
- **Actually Released** = only splits with confirmed released state
- **Office wallet balance** = unreleased office-admin share minus approved/pending office fund requests
- **Pipeline stats** = distinguish transfer initiated vs transfer completed

This will stop the dashboard from showing inflated released totals or misleading office balances.

### 4) Tighten office wallet/request balance logic
Update:
- `src/pages/regulator/OfficeFundRequests.tsx`
- `supabase/functions/process-office-payout/index.ts`

Changes:
- calculate requestable office balance from **unreleased admin office share only**
- subtract both pending and approved request reservations where appropriate
- prevent requests from exceeding real unreleased balance
- keep approval checks aligned with the same formula used by the UI

### 5) Keep reconciliation tools aligned with the corrected model
Update the recovery/admin tools so they reflect the new accounting truth:
- `src/components/regulator/TransactionExplorer.tsx`
- `src/pages/regulator/PaymentReconciliationCentre.tsx` only if needed for labels/status text

Changes:
- lifecycle should show transfer initiated vs transfer completed distinctly
- no UI text should imply funds were released until Paystack confirms success

## Technical notes
- I do **not** plan to rewrite the whole payment architecture.
- I will keep the existing centralized finalization pipeline and fix the incorrect payout-state transitions plus the downstream aggregation math.
- This work likely needs:
  - **1 migration** for historical split-state repair
  - **4–6 code file edits** across edge functions and regulator dashboards
- The fix is targeted at the exact repeating symptom you reported: **receipts appear, but escrow / inflow totals drift and repeat incorrectly**.

## Expected outcome
After this implementation:
- a payment still creates **one receipt** and **one reconciled ledger update**
- escrow inflow remains tied to completed transactions
- released balances only move when Paystack confirms the transfer
- office wallet balances stop drifting
- the ledger/escrow view stops showing repeated or inflated counts
- manual reconciliation remains idempotent and safe

If you approve, I’ll implement the backend state fix first, then the repair migration, then the dashboard/wallet math updates.