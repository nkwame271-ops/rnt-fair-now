## Transaction Explorer with Lifecycle Drill-Down

Add a "Transactions" tab inside **Payment Reconciliation & Recovery Centre** so admins can browse every transaction type, drill into a single transaction, see exactly where it is in the lifecycle, and safely issue a missing receipt only when Paystack has actually confirmed the payment.

### 1. New "Transactions" tab on Reconciliation Centre

Three-pane layout:

```text
┌─ Transaction Types ──┐ ┌─ Transactions ──────────┐ ┌─ Lifecycle ─────────┐
│ Rent Card Bulk  608  │ │ ref · payer · amount    │ │ ✓ Paystack verified │
│ Landlord Reg     84  │ │ ref · payer · amount    │ │ ✓ Escrow finalized  │
│ Tenant Reg       45  │ │ ...                     │ │ ⚠ Receipt missing   │
│ Complaint Fee    35  │ │                         │ │ ✓ Splits created    │
│ Rent Tax Bulk    10  │ │                         │ │ ✗ Not reconciled    │
│ ...                  │ │                         │ │                     │
└──────────────────────┘ └─────────────────────────┘ │ [Issue Receipt]     │
                                                     └─────────────────────┘
```

- Type list comes from `escrow_transactions.payment_type` aggregated with counts.
- Transactions list is filterable by status (paid / pending / failed) and searchable by reference.
- Both panes paginate (50/page) to handle the 800+ transactions.

### 2. Lifecycle panel (the drop-down the user described)

For the selected transaction, render an ordered status timeline:

| Stage | Source of truth | Pass condition |
|-------|----------------|---------------|
| Transaction created | `escrow_transactions` row exists | always |
| Paystack verified | live call to `reconcile-payment` dry_run | Paystack returns `status=success` |
| Escrow finalized | `escrow_transactions.status IN (success, completed, paid)` | flagged |
| Receipt issued | `payment_receipts` row exists | row found |
| Splits created | `escrow_splits` active rows exist | found |
| Case payment recorded | `case_payments` row with `payment_status='paid'` | found |
| Reconciled | `case_payments.reconciliation_status='reconciled'` | flagged |

Each row shows: ✓ green, ✗ red, ⏳ amber (pending). Each row is expandable to show timestamp + actor + the underlying record reference.

### 3. Safe "Manually Issue Receipt" button

Button is **enabled only when both** are true:
- Paystack dry_run confirms the transaction is paid (`verified === true`)
- `payment_receipts` row is missing for this escrow

When clicked:
- Calls existing `reconcile-payment` edge function with `action=reconcile` — this is the same idempotent pipeline `receipt-drift-monitor` uses
- Writes a `payment_reconciliation_audit_log` entry tagged `manual_receipt_issue`
- Refreshes the lifecycle panel inline

If Paystack does NOT confirm success (`verified === false` or unknown reference), the button stays disabled with a tooltip: **"Cannot issue receipt — Paystack has not confirmed this transaction. Receipts can only be issued for verified payments."**

### 4. Reuse, don't duplicate

- No new backend endpoints needed. `reconcile-payment` already supports `dry_run` and `reconcile` actions.
- No new tables. The Lifecycle panel reads from `escrow_transactions`, `payment_receipts`, `escrow_splits`, `case_payments`, plus the live Paystack dry-run.
- The existing "Reconciliation Gaps" tab stays for sweeping fixes; the new "Transactions" tab is the per-transaction explorer.

### 5. Files Changed

- `src/pages/regulator/PaymentReconciliationCentre.tsx` — add "Transactions" tab + state
- `src/components/regulator/TransactionExplorer.tsx` — new three-pane UI
- `src/components/regulator/TransactionLifecyclePanel.tsx` — lifecycle timeline + safe Issue Receipt button
- `src/components/regulator/TransactionTypeList.tsx` — left pane, type counts

### Out of Scope

- No edits to payment processing or finalize logic — it works.
- No new edge functions — `reconcile-payment` already provides what's needed.
- Tenant/landlord views unchanged.