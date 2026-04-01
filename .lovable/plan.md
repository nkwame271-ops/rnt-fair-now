

# Plan: Escrow Allocation Visibility, Office Wallet Accuracy, and Receipt Split Visibility

## Summary

Four changes: (1) Enhance the Escrow Dashboard Allocation Summary to show per-transaction split breakdowns, (2) Ensure office wallet balances reflect allocated shares immediately including in auto-release mode, (3) Add Platform column to allocation summary (currently missing), (4) Hide split breakdown on receipts in the landlord portal while keeping it visible in the Escrow Dashboard receipt register.

---

## 1. PaymentReceipt Component — Add `showSplits` Prop

Currently `PaymentReceipt` always renders the split breakdown table. Add an optional `showSplits` prop (default `true`) to conditionally hide it.

- **`src/components/PaymentReceipt.tsx`**: Add `showSplits?: boolean` to `ReceiptProps`. Wrap the split breakdown `<div>` in `{showSplits !== false && (...)}`.

## 2. Landlord Receipts — Hide Splits

- **`src/pages/landlord/Receipts.tsx`**: Pass `showSplits={false}` to every `<PaymentReceipt>` instance.

## 3. Escrow Dashboard — Enhanced Allocation Summary

The current Allocation Summary only shows 4 cards (IGF, Admin, GRA, Landlord) and is missing Platform. Fix:

- **`src/pages/regulator/EscrowDashboard.tsx`**: Add Platform to `allocationCards` array using `stats.platform`.
- Change grid from `grid-cols-4` to `grid-cols-5` to accommodate.

## 4. Escrow Dashboard — Office Wallet Balance Accuracy

The office revenue table already aggregates `escrow_splits` by `office_id`, which means balances reflect allocated shares immediately upon transaction (splits are inserted by the webhook at payment completion). The auto-release mode sets `disbursement_status = 'released'` but the amount still appears in the office row.

Add clarity to the office table:
- Add a "Wallet Balance" column showing `admin` share minus released payouts (approved `office_fund_requests`)
- Show "Allocated" and "Released" separately so auto-release transactions are visible as both allocated and released simultaneously

Query `office_fund_requests` with `status = 'approved'` to compute released amounts per office, then: `wallet_balance = admin_share - released_amount`.

---

## Files to Change

| File | Change |
|---|---|
| `src/components/PaymentReceipt.tsx` | Add `showSplits` prop, conditionally render split breakdown |
| `src/pages/landlord/Receipts.tsx` | Pass `showSplits={false}` |
| `src/pages/regulator/EscrowDashboard.tsx` | Add Platform to allocation cards; add wallet balance column to office table using `office_fund_requests` data |

