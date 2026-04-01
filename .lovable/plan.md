

# Plan: Main-Account-First Payout Model

## Current State

The system currently uses **Paystack Split Payments (subaccounts)** at transaction initialization. The `paystack-checkout` function builds a `split` object with subaccount codes from `system_settlement_accounts` and attaches it to `transaction/initialize`. Paystack distributes money automatically at charge time. The webhook then records allocations in `escrow_splits` and handles business logic.

The requested change moves to a **main-account-first transfer model** where all money enters the main Paystack account, and the backend distributes via Paystack's Transfer API after verification.

---

## Architecture Change

```text
CURRENT FLOW:
  User pays → Paystack splits money at charge → Webhook records in ledger

NEW FLOW:
  User pays → Money enters main account → Webhook verifies
  → Backend loads split rules from Engine Room
  → Posts allocations to escrow_splits ledger
  → Creates Paystack transfer recipients from saved payout accounts
  → Triggers Paystack transfers to IGF, Admin, GRA, Platform, offices
  → Office shares respect Auto/Manual payout mode
```

---

## Changes Required

### 1. Database Migration

Add `paystack_recipient_code` column to `system_settlement_accounts` and `office_payout_accounts` tables to cache Paystack transfer recipient codes (avoids re-creating recipients on every payout).

Add `payout_transfers` table to track individual Paystack transfer attempts:
- `id`, `escrow_split_id`, `recipient_type` (igf/admin/platform/gra/office/landlord), `recipient_code`, `transfer_code`, `amount`, `status` (pending/success/failed/reversed), `paystack_reference`, `created_at`, `completed_at`, `failure_reason`

### 2. Remove Subaccount Split from Checkout (`paystack-checkout/index.ts`)

- Remove `buildPaystackSplit()` function entirely
- Remove the `RECIPIENT_TO_ACCOUNT_TYPE` mapping
- Remove lines 751-778 that attach `payload.split`
- Keep everything else: fee loading, split plan calculation, escrow record creation, metadata storage
- The split plan is still calculated and stored in escrow metadata — it just is not sent to Paystack anymore

### 3. Add Transfer Payout Logic to Webhook (`paystack-webhook/index.ts`)

After `completeEscrow()` records splits in the ledger, add a new `triggerPayouts()` function that:

1. Loads all `escrow_splits` for this transaction
2. For each split recipient (igf, admin, platform, gra):
   - Loads the corresponding `system_settlement_accounts` record
   - Creates or retrieves a Paystack transfer recipient using cached `paystack_recipient_code` or the account details (bank/momo)
   - Caches the recipient code back to the table if newly created
   - Initiates a Paystack transfer via `POST /transfer`
   - Records the transfer in `payout_transfers`
3. For `admin` (office) splits:
   - Checks `office_payout_mode` feature flag
   - If Auto Release: loads `office_payout_accounts` for the office, creates recipient, triggers transfer
   - If Manual: marks split as `held` — no transfer (existing behavior)
4. For `landlord` splits: marks as `held` in escrow (existing behavior — landlord payouts are manual)

Key helper functions:
- `getOrCreateRecipient(accountDetails)` — checks for cached recipient code, creates via Paystack API if missing, caches result
- `initiateTransfer(recipientCode, amount, reason, reference)` — calls Paystack Transfer API
- `recordTransfer(splitId, recipientCode, transferCode, amount, status)` — inserts into `payout_transfers`

### 4. Update `verify-payment/index.ts`

The existing `verify-payment` function is a fallback for redirect-based verification. After its existing finalization logic, add the same `triggerPayouts()` call to ensure transfers happen even if the webhook was missed.

Use an idempotency check: skip if `payout_transfers` already exist for this escrow transaction.

### 5. Update `process-office-payout/index.ts`

This already has Paystack transfer logic for manual office payouts. Refactor to use the same `getOrCreateRecipient()` pattern and record transfers in `payout_transfers` for audit consistency.

### 6. Webhook for Transfer Events (New Edge Function: `paystack-transfer-webhook`)

Create a new function to handle Paystack transfer events (`transfer.success`, `transfer.failed`, `transfer.reversed`):
- Verify HMAC signature
- Update `payout_transfers` table with final status
- On failure: mark split as `failed`, notify admin
- On reversal: mark split as `reversed`, notify admin

Register this webhook URL in Paystack dashboard alongside the existing charge webhook.

### 7. UI: Replace Subaccount Code with Recipient Code (`OfficePayoutSettings.tsx`)

- Rename the "Paystack Subaccount Code" field on settlement accounts to "Paystack Recipient Code" 
- Add a "Test Payout" button (optional) that creates a GH₵ 0.01 test transfer to verify the recipient works
- The field becomes `paystack_recipient_code` (new column) while keeping `paystack_subaccount_code` for backward compat during transition

### 8. Engine Room Stays Unchanged

All split rules, rent bands, fee flags, and payout mode toggles already live in the Engine Room. No changes needed — the backend already reads from `split_configurations`, `rent_bands`, `feature_flags`, and `secondary_split_configurations`.

---

## Files to Create/Modify

| File | Change |
|---|---|
| **Migration** | Add `paystack_recipient_code` to settlement + office payout tables; create `payout_transfers` table |
| `paystack-checkout/index.ts` | Remove `buildPaystackSplit()` and split attachment |
| `paystack-webhook/index.ts` | Add `triggerPayouts()` after escrow completion |
| `verify-payment/index.ts` | Add idempotent `triggerPayouts()` call |
| `process-office-payout/index.ts` | Refactor to use shared recipient/transfer pattern; record in `payout_transfers` |
| **New:** `paystack-transfer-webhook/index.ts` | Handle transfer.success/failed/reversed events |
| `supabase/config.toml` | Add `paystack-transfer-webhook` function config |
| `OfficePayoutSettings.tsx` | Update UI labels from subaccount to recipient code |

---

## Paystack Dashboard Setup Required

The user must:
1. Set the webhook URL for transfers: `https://qjrvwcwmhuxygdanbxsz.supabase.co/functions/v1/paystack-transfer-webhook`
2. Enable Transfers on their Paystack account (requires business verification)
3. Ensure sufficient Paystack balance for outbound transfers

---

## Security Notes

- All Paystack API calls use `PAYSTACK_SECRET_KEY` server-side only
- Transfer webhook validates HMAC signature identically to charge webhook
- Idempotency: transfers check `payout_transfers` before initiating to prevent double-payouts
- `payout_transfers` table uses service_role-only insert with regulator read access

