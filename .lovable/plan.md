## Status: Already Fixed, Now Hardening

Current state is fully synced:
- 796 paid escrows / 796 receipts / 796 case_payments / 0 unreconciled
- `finalize-payment.ts` line 506 uses correct enum `auto_generated`
- `reconcile-payment` line 244 uses correct enum `manually_reconciled`
- All 4 valid enum values confirmed: `auto_generated`, `manually_reconciled`, `duplicate_blocked`, `voided`

But in the last 7 days, `payment_processing_errors` logged **66 `receipt_insert` failures** — the exact silent-fail mode that caused this outage. We need guardrails so this can never recur silently.

## Plan: Prevent Recurrence

### 1. Database-level guard (migration)
Add a trigger on `escrow_transactions` that fires when status flips to `success/completed/paid`. If no matching `payment_receipts` row exists within the same transaction context, log a row into a new `receipt_generation_failures` table (does NOT block payment — just records the drift instantly).

```text
escrow paid → trigger checks payment_receipts within 30s window
            → if missing after webhook completes, row inserted in
              receipt_generation_failures with reference + reason
```

### 2. Self-healing edge function: `receipt-drift-monitor`
New scheduled edge function (runs every 15 min) that:
- Finds paid escrows older than 5 min with no receipt
- Finds paid case_payments with no `receipt_number`
- Finds paid case_payments with `reconciliation_status <> 'reconciled'`
- For each: re-runs `finalize-payment` logic to backfill, then logs to `receipt_generation_failures` with outcome
- Returns counts so it can be wired to a Command Center alert tile

### 3. Hardened receipt insert in `finalize-payment.ts`
Wrap the receipt insert in retry-with-fallback logic:
- On insert error, log the EXACT enum value attempted (so future enum changes surface immediately)
- On any failure, write to new `receipt_generation_failures` table with full payload
- Escalate severity from `warning` → `critical` for receipt_insert errors so they appear in admin alerts

### 4. Command Center alert tile
Add a "Receipt Drift" tile to the Super Admin Command Center showing:
- Paid escrows missing receipts (should always be 0)
- Unreconciled paid payments (should always be 0)
- Receipt generation failures in last 24h
- Direct "Repair Now" button that calls `receipt-drift-monitor`

### 5. Frontend safeguard in Receipts pages
Tenant/Landlord/Regulator Receipts pages already query `payment_receipts`. Add a fallback: if a paid `case_payment` exists with no linked receipt, show it in the list with a "Receipt being generated" badge + auto-trigger drift monitor for that reference. Users never see a missing receipt again.

## Files Changed

- `supabase/migrations/<new>.sql` — create `receipt_generation_failures` table + RLS + drift detection function
- `supabase/functions/receipt-drift-monitor/index.ts` — new scheduled function
- `supabase/functions/_shared/finalize-payment.ts` — hardened receipt insert with failure logging
- `src/pages/admin/CommandCenter.tsx` (or equivalent) — receipt drift tile
- `src/pages/tenant/Receipts.tsx`, `src/pages/landlord/Receipts.tsx`, `src/pages/regulator/RegulatorReceipts.tsx` — fallback display for in-flight receipts

## Out of Scope

- No changes to payment processing flow itself (Paystack verification, escrow writes, reconciliation RPC) — those are working
- No backfill needed — data is already 100% synced

Approve to implement, or tell me which sections to skip.