# Plan: Dynamic DB-Driven Splits + Paystack Automatic Settlement

## Summary

Two changes: (1) Remove all hardcoded `DEFAULT_SPLIT_RULES` from `paystack-checkout` so every transaction reads splits exclusively from the `split_configurations` table, and (2) Implement Paystack subaccount-based split payments so funds are automatically distributed to IGF, Admin, and Platform accounts at payment time instead of collecting into a single account.

---

## 1. Add Paystack Subaccount Codes to Settlement Accounts

The `system_settlement_accounts` table already stores bank/momo details for IGF, Admin, Platform, and GRA. Add a `paystack_subaccount_code` column to store each recipient's Paystack subaccount code.

**Migration:**
- Add `paystack_subaccount_code text` column to `system_settlement_accounts`

**Engine Room UI** (`EngineRoom.tsx` or `OfficePayoutSettings.tsx`):
- Add a field for each settlement account to enter/display the Paystack subaccount code
- Admins create subaccounts on the Paystack dashboard and paste the code (e.g., `ACCT_xxxxx`) into the system

---

## 2. Remove Hardcoded Split Rules from Backend

**`paystack-checkout/index.ts`:**
- Delete the entire `DEFAULT_SPLIT_RULES` constant (lines 11-91)
- Delete `PLATFORM_FIXED_FEE` constant (line 8)
- Delete `calculateRegistrationSplits` function (lines 94-110)
- Modify `getDynamicFee` to fail clearly if no DB splits exist (instead of falling back to hardcoded values)
- Keep `getSplitConfigFromDB` and `getTaxSplitPlan` as-is since they already read from DB

The `split_configurations` table already has all the seed data for every payment type. The hardcoded defaults are redundant.

---

## 3. Paystack Split Payments at Transaction Time

**`paystack-checkout/index.ts`:**
- After computing the split plan, query `system_settlement_accounts` to get `paystack_subaccount_code` for each recipient
- Build a Paystack `split` object in the transaction payload:

```text
payload.split = {
  type: "flat",
  subaccounts: [
    { subaccount: "ACCT_igf_xxx", share: 1500 },   // 15 GHS in kobo
    { subaccount: "ACCT_admin_xxx", share: 500 },   // 5 GHS
    { subaccount: "ACCT_platform_xxx", share: 500 } // 5 GHS
  ],
  bearer_type: "account"  // main account bears Paystack fees
}
```

- Map split recipients to settlement account types: `rent_control` → `igf`, `admin` → `admin`, `platform` → `platform`, `gra` → `gra`
- If a recipient has no subaccount code, that portion stays with the main Paystack account (logged as warning)
- The `landlord` recipient is excluded from Paystack splits (handled via escrow)

---

## 4. Rent Bands — Already DB-Driven

The `getRentBandFee` function already reads from the `rent_bands` table. No changes needed.

---

## Files to Change

| File | Change |
|---|---|
| `supabase/functions/paystack-checkout/index.ts` | Remove hardcoded splits; add Paystack split payment logic using subaccount codes from `system_settlement_accounts` |
| `src/pages/regulator/OfficePayoutSettings.tsx` | Add field for Paystack subaccount code on each settlement account |
| Migration | Add `paystack_subaccount_code` column to `system_settlement_accounts` |

---

## How It Works End-to-End

```text
User pays GH₵ 25 (e.g., Rent Card)
  ↓
paystack-checkout reads split_configurations for "rent_card"
  → rent_control: 15, admin: 10
  ↓
Looks up system_settlement_accounts for subaccount codes
  → rent_control(igf): ACCT_igf_xxx
  → admin: ACCT_admin_xxx
  ↓
Sends to Paystack with split parameter
  → Paystack settles 15 → IGF subaccount, 10 → Admin subaccount
  ↓
Webhook confirms → escrow_splits recorded for audit trail
```

All split ratios are controlled from the Engine Room. No code changes needed when splits change.