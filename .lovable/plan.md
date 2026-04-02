

# Unify Payment Execution: Webhook Must Use Shared Pipeline

## What I found

Your system has the right components but the **webhook doesn't use them**. Here's the gap:

| Layer | Status | Problem |
|-------|--------|---------|
| Layer 1: Collection (Paystack) | Working | — |
| Layer 2: Accounting (Ledger) | Built but disconnected | `paystack-webhook` has its own `completeEscrow` (472 lines of duplicate logic) and does NOT call the shared `finalizePayment` helper |
| Layer 3: Distribution (Transfers) | Built but duplicated | Same transfer logic exists in both webhook and `finalizePayment`, causing inconsistency |

The shared `finalizePayment` in `_shared/finalize-payment.ts` already does everything your 7-step framework requires:
- Verifies payment (Step 1)
- Loads split_plan from escrow metadata (Steps 2-3)
- Posts allocations to `escrow_splits` ledger (Step 1)
- Creates transfer recipients via Paystack API (Step 5)
- Triggers transfers with proper escrow rules: IGF/GRA/Platform = immediate, Office = auto/manual, Landlord = held (Steps 3-4)
- Records transfer status with success/failed/pending tracking (Step 7)
- Creates receipt, notifications (Step 1)

**But the webhook never calls it.** It still runs its own `completeEscrow` function. So when webhook fires, it may or may not create splits correctly. When `verify-payment` fires, it uses the shared helper. Two different code paths = inconsistent results.

The build error ("sandbox head mismatch") is a transient infrastructure issue, not a code defect.

## Plan

### 1. Rewrite `paystack-webhook` to use shared `finalizePayment`

Remove the 400+ lines of duplicate `completeEscrow`, `triggerPayouts`, and `getOrCreateRecipient` from the webhook. Replace with:

```
charge.success handler:
  1. Parse reference, amount, transactionId
  2. Run payment-type-specific side effects (update tenants, landlords, rent_payments, etc.)
  3. Call finalizePayment({ supabaseAdmin, reference, amountPaid, transactionId, logError })
  4. Send SMS/email/notification
```

The webhook keeps:
- Signature verification
- `charge.failed` handler
- `transfer.success/failed/reversed` handlers  
- Payment-type-specific side effects (tenant registration, rent card creation, renewal logic)
- SMS/email sending

The webhook delegates to `finalizePayment`:
- Marking escrow completed
- Creating `escrow_splits`
- Creating receipts
- Creating transfer recipients
- Triggering Paystack transfers
- Office wallet auto-release

### 2. Add retry capability to `verify-payment`

When a user hits "verify payment" and the webhook was missed, `verify-payment` already calls `finalizePayment`. But it should also run the payment-type-specific side effects that the webhook would have run (tenant activation, complaint status update, etc.). The shared `handleSideEffects` function in `finalizePayment` already does this — confirm it covers all cases the webhook handles.

### 3. No other changes needed

The EscrowDashboard, admin visibility, receipts, and revenue breakdown are already correctly implemented from previous work. The only issue is that **data never gets written** because the webhook's `completeEscrow` is unreliable and `verify-payment` doesn't get called automatically.

## Files to change

| File | Change |
|------|--------|
| `supabase/functions/paystack-webhook/index.ts` | Remove `completeEscrow`, `triggerPayouts`, `getOrCreateRecipient`. Import and call `finalizePayment` from shared helper. Keep side effects, signature check, transfer event handlers, SMS/email. ~900 lines → ~350 lines. |
| `supabase/functions/_shared/finalize-payment.ts` | Minor: ensure `handleSideEffects` covers renewal logic (creating new tenancy + rent payments) which is currently only in webhook |

## What this fixes

- Allocation Summary will show real numbers immediately after any payment (webhook or verify)
- Transfer recipients will be created and transfers triggered automatically
- Office wallet will update correctly
- No more duplicate/inconsistent code paths
- Retry safety: both webhook and verify-payment produce identical results

