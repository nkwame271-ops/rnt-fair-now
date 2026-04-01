

# Plan: Dynamic DB-Driven Splits + Paystack Automatic Settlement

## Summary

Two changes: (1) Remove all hardcoded `DEFAULT_SPLIT_RULES` from `paystack-checkout` so every transaction reads splits exclusively from the `split_configurations` table, and (2) Implement Paystack subaccount-based split payments so funds are automatically distributed to IGF, Admin, and Platform accounts at payment time.

---

## 1. Database: Add Paystack Subaccount Code to Settlement Accounts

Add a `paystack_subaccount_code` column to `system_settlement_accounts` so each recipient (IGF, Admin, Platform, GRA) can store their Paystack subaccount code.

**Migration:**
```sql
ALTER TABLE public.system_settlement_accounts
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code text;
```

---

## 2. Remove Hardcoded Split Rules from Backend

**`paystack-checkout/index.ts`:**
- Delete the `DEFAULT_SPLIT_RULES` constant (lines 10-91)
- Delete `PLATFORM_FIXED_FEE` constant (line 8)
- Delete `calculateRegistrationSplits` function (lines 94-110)
- Simplify `getDynamicFee`: if no DB splits exist, throw an error instead of falling back to hardcoded values
- Keep `getSplitConfigFromDB` and `getTaxSplitPlan` unchanged — they already read from DB

All split data is already seeded in `split_configurations`. The hardcoded defaults are redundant.

---

## 3. Paystack Split Payments at Transaction Time

**`paystack-checkout/index.ts` — after computing the split plan:**

1. Query `system_settlement_accounts` for all rows with a `paystack_subaccount_code`
2. Build a recipient-to-subaccount map: `rent_control` → `igf` account, `admin` → `admin` account, `platform` → `platform` account, `gra` → `gra` account
3. For each split entry, if the recipient has a subaccount code, add it to the Paystack `split.subaccounts` array
4. Add the `split` object to the Paystack transaction payload:

```text
payload.split = {
  type: "flat",
  bearer_type: "account",
  subaccounts: [
    { subaccount: "ACCT_igf_xxx", share: 1500 },
    { subaccount: "ACCT_admin_xxx", share: 500 },
  ]
}
```

- Recipients without subaccount codes (e.g., `landlord`) are excluded from Paystack splits — their share stays with the main account for escrow handling
- If no subaccounts are configured at all, the transaction proceeds without splits (current behavior, all funds to main account)

---

## 4. UI: Add Subaccount Code Field to Settlement Accounts

**`src/pages/regulator/OfficePayoutSettings.tsx`:**
- Add a "Paystack Subaccount Code" input field to each settlement account form (IGF, Admin, Platform, GRA)
- Save/load from the new `paystack_subaccount_code` column

---

## Files to Change

| File | Change |
|---|---|
| Migration | Add `paystack_subaccount_code` column to `system_settlement_accounts` |
| `supabase/functions/paystack-checkout/index.ts` | Remove hardcoded splits; query subaccount codes from DB; add Paystack split parameter to transaction payload |
| `src/pages/regulator/OfficePayoutSettings.tsx` | Add Paystack subaccount code field to settlement account forms |

---

## End-to-End Flow

```text
User pays GH₵ 25 (Rent Card)
  ↓
paystack-checkout reads split_configurations → rent_control: 15, admin: 10
  ↓
Reads system_settlement_accounts for subaccount codes
  → IGF: ACCT_igf_xxx, Admin: ACCT_admin_xxx
  ↓
Sends to Paystack with split parameter
  → Paystack settles 15 → IGF, 10 → Admin instantly
  ↓
Webhook confirms → escrow_splits recorded for audit trail
```

All split ratios are controlled from the Engine Room. No code changes needed when splits change.

