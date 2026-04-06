

# Plan: Count-Based Transfer, Auto-Recipient, and Deferred Office Payouts

## Part 1: Fix "Transfer by Number" — Count-Based Only

**Problem**: `quantity_transfer` currently falls into the physical transfer branch, reserving specific serials and binding to ranges. The user wants it to behave like quota: a pure accounting entry where the office draws from the full regional pool.

### Changes

**`supabase/functions/admin-action/index.ts`**
- Move `quantity_transfer` back into the quota/accounting branch (alongside `"quota"`)
- Change condition from `if (aMode === "quota")` to `if (aMode === "quota" || aMode === "quantity_transfer")`
- Both modes create an `office_allocations` record with `quota_limit` set to the quantity — no serial movement, no `start_serial`/`end_serial`, no `stock_type` updates

**`src/pages/regulator/rent-cards/PendingPurchases.tsx`**
- Re-add `quantity_transfer` to the quota check: `.in("allocation_mode", ["quota", "quantity_transfer"])`
- Both modes fetch from regional stock with enforcement against the combined quota limit

**`src/pages/regulator/rent-cards/OfficeAllocation.tsx`**
- Update `computeQuotaUsage` to include `quantity_transfer` entries alongside `quota` when computing totals
- This ensures the Quota tab shows usage for both allocation types

**Net effect**: "Transfer by Number" and "Quota" both let offices assign ANY serial from the full regional pool, enforced only by count. "Next Available" remains the only mode that physically moves serials.

---

## Part 2: Auto-Create Paystack Recipient on Payout Account Save

**Problem**: Recipient codes are only created lazily at payout time. If missing, the payout fails silently.

### Changes

**`src/pages/regulator/OfficePayoutSettings.tsx`**
- After successful insert/update of `office_payout_accounts`, call an edge function to create/update the Paystack transfer recipient immediately
- Store the returned `recipient_code` on the `office_payout_accounts` row

**`supabase/functions/admin-action/index.ts`** (new action: `create_payout_recipient`)
- Accepts `office_id`
- Reads the office payout account details
- Calls Paystack's `/transferrecipient` API
- Stores `paystack_recipient_code` on the `office_payout_accounts` row
- Returns success/failure to the UI so the admin sees immediate feedback

---

## Part 3: Deferred Office Payouts for Rent Cards, Add Tenant, and Declare Existing Tenancy

**Problem**: Currently, `finalizePayment` immediately creates splits and triggers payouts (including the office/"admin" share) at payment time. But for certain payment types, the responsible office isn't known until later.

### Approach

**`supabase/functions/_shared/finalize-payment.ts`**

For these payment types: `rent_card`, `rent_card_bulk`, `add_tenant_fee`, `declare_existing_tenancy_fee`:

- When creating `escrow_splits`, mark the `admin` (office) split as `disbursement_status: "deferred"` instead of `"pending_transfer"` or `"held"`
- Skip payout transfer creation for splits with `disbursement_status: "deferred"`
- The office_id on the escrow may be null or preliminary at this stage

**New edge function: `supabase/functions/finalize-office-attribution/index.ts`**

Called when the responsible office is determined (e.g., office allocates a rent card serial, or an admin assigns a tenancy to an office):

- Accepts `escrow_transaction_id` and `office_id`
- Updates the deferred `escrow_splits` row with the correct `office_id` and changes status to `"pending_transfer"`
- Looks up the office's `paystack_recipient_code` from `office_payout_accounts`
- If valid recipient exists, initiates the Paystack transfer and records in `payout_transfers`
- If no recipient, logs an error and leaves status as `"pending_transfer"` for manual resolution

**Integration points** (where to call the new function):

1. **Rent card serial assignment** (`PendingPurchases.tsx` — after successful assignment): call `finalize-office-attribution` with the purchase's `escrow_transaction_id` and the assigning office's ID
2. **Add Tenant / Declare Existing Tenancy**: when the tenancy is linked to an office (already happens in existing flows), trigger attribution for the related escrow

### Database

- No schema migration needed — `disbursement_status` already supports custom values as text, and `office_id` already exists on `escrow_splits`

---

## Files Summary

| File | Change |
|------|--------|
| `supabase/functions/admin-action/index.ts` | Move `quantity_transfer` back to accounting branch; add `create_payout_recipient` action |
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | Include `quantity_transfer` in quota check; call `finalize-office-attribution` after serial assignment |
| `src/pages/regulator/rent-cards/OfficeAllocation.tsx` | Include `quantity_transfer` in quota usage computation |
| `src/pages/regulator/OfficePayoutSettings.tsx` | Call recipient creation after saving payout account |
| `supabase/functions/_shared/finalize-payment.ts` | Defer office splits for rent_card, add_tenant_fee, declare_existing_tenancy_fee |
| `supabase/functions/finalize-office-attribution/index.ts` | New function: finalize deferred office payouts when office is determined |
| `supabase/config.toml` | Add `finalize-office-attribution` function config |

