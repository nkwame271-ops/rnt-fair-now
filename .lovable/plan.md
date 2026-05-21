## Goal
Refactor the payment + reconciliation pipeline so every payment path (Dashboard Pay Now, Checkout, Paystack webhook, manual reconciliation) writes to **one unified source of truth** — `case_payments` — with strict one-time reconciliation, automatic receipt generation, and accurate Command Center / Student Revenue reporting.

---

## 1. New unified table: `public.case_payments`

Migration creates the table with these columns:

- `id` (uuid pk)
- `case_id` (uuid, nullable — links to complaint/case when applicable)
- `student_id` (uuid, nullable — set when payer is a student/NUGS context)
- `payment_reference` (text, **UNIQUE NOT NULL**) — Paystack/platform reference
- `payment_provider` (text — `paystack` | `manual` | `internal`)
- `payment_type` (text — `complaint_filing` | `rent_card` | `viewing_fee` | `student_rent_card_fee` | etc.)
- `amount_paid` (numeric, NOT NULL, default 0)
- `currency` (text default `GHS`)
- `payment_status` (text — `pending` | `paid` | `failed` | `refunded`)
- `reconciliation_status` (text — `unreconciled` | `reconciled` | `failed`)
- `receipt_number` (text)
- `receipt_url` (text)
- `paid_at` (timestamptz)
- `reconciled_at` (timestamptz)
- `reconciled_by` (uuid)
- `ledger_entry_id` (uuid)
- `escrow_transaction_id` (uuid — bridge to existing `escrow_transactions`)
- `payer_user_id` (uuid)
- `office_id` (text)
- `metadata` (jsonb)
- `created_at`, `updated_at`

Constraints + indexes:
- UNIQUE(`payment_reference`)
- Partial UNIQUE(`case_id`, `payment_type`) WHERE `payment_status = 'paid'` to block double-pay for the same fee
- Indexes on `case_id`, `student_id`, `payer_user_id`, `payment_status`, `reconciliation_status`

RLS:
- Payer can `SELECT` their own rows
- Admins/regulators `SELECT` all
- **No client INSERT / UPDATE / DELETE** — all writes go through SECURITY DEFINER functions / edge functions
- Service role full access

Audit table `case_payment_reconciliation_log`:
- `id`, `case_payment_id`, `action`, `actor_id`, `transaction_reference`, `ledger_update_reference`, `previous_status`, `new_status`, `notes`, `created_at`

---

## 2. Idempotent reconciliation RPC: `reconcile_case_payment`

`SECURITY DEFINER` plpgsql function wrapped in a single transaction:

1. `SELECT ... FOR UPDATE` the `case_payments` row by `payment_reference`.
2. If not found → raise.
3. If `payment_status != 'paid'` → raise "Payment not confirmed".
4. If `reconciliation_status = 'reconciled'` OR `ledger_entry_id IS NOT NULL` → return `{ ok: true, idempotent: true, message: 'Transaction already reconciled' }` (no writes).
5. Create ledger entry in the correct ledger:
   - Student payments (`student_id IS NOT NULL` or NUGS office) → **student revenue ledger only**.
   - All other payments → standard office/escrow ledger.
6. Update `case_payments`: set `reconciliation_status='reconciled'`, `reconciled_at=now()`, `reconciled_by`, `ledger_entry_id`.
7. Insert audit row with both transaction + ledger refs.
8. COMMIT (auto on function success; any RAISE → full rollback).

Triggers (BEFORE UPDATE on `case_payments`):
- Block client-side changes to `ledger_entry_id`, `reconciliation_status` (only service_role may set).
- When `payment_status` transitions to `paid` and `receipt_number IS NULL`, auto-call `generate_receipt_number()` and stamp `paid_at`.

---

## 3. Edge function changes

All write paths route through the new model:

- **`paystack-checkout`** — on init: upsert a `pending` row in `case_payments` keyed on `payment_reference` (alongside existing `escrow_transactions`).
- **`verify-payment`** — on Paystack success: update `case_payments` to `paid` (idempotent via unique reference), then call `reconcile_case_payment` RPC. Replaces the ad-hoc logic in `_shared/finalize-payment.ts` callers for these new rows.
- **`paystack-webhook`** — same path as verify-payment (idempotent — second call returns "already reconciled").
- **`reconcile-payment`** (manual admin) — calls the same RPC; never writes ledger directly.
- **Dashboard "Pay Now"** — uses the same `paystack-checkout` edge function (no separate client path). Audit any client component that posts directly to ledger tables and remove.

Receipt generation hook:
- When `payment_status` becomes `paid`, the trigger sets `receipt_number`. The edge function then renders the PDF, uploads to `form-outputs`, writes signed URL into `receipt_url`, and links the receipt into the existing `payment_receipts` table with `case_id` populated (fixes Command Center "No receipt yet").

---

## 4. Command Center fixes (frontend, read-only)

- `ComplaintCaseFile.tsx` Payment & Receipt Summary card → read totals from `case_payments` WHERE `case_id = X AND payment_status = 'paid'`. Sum `amount_paid`. Never default to 0 when paid rows exist.
- `ComplaintDocumentsHub.tsx` Documents tab → query receipts by `case_payments.receipt_url` (with fallback to legacy `payment_receipts` by `escrow_transaction_id`).
- Tenant/landlord `Receipts.tsx` → union over `case_payments` + legacy `payment_receipts` so historical receipts stay visible.

No frontend writes to ledger or `case_payments` columns beyond `metadata` (RLS enforces).

---

## 5. Student Revenue isolation

- Reconciliation RPC routes student rows to `student_revenue_ledger` only.
- A backfill query reclassifies any historical `escrow_transactions` flagged `is_student_revenue=true` whose payments now exist in `case_payments`.
- NUGS dashboards read `case_payments WHERE student_id IS NOT NULL` for revenue cards.

---

## 6. Backfill + safety

One-time backfill migration:
- Insert one `case_payments` row per existing `escrow_transactions` row where `status IN ('completed','success','paid')`, copying reference, amount, paid_at, status='paid', reconciliation_status='reconciled' (since they're already in legacy ledgers), and linking to existing receipts/cases.
- This ensures Command Center and Student Revenue immediately reflect historical data without re-posting ledgers.

---

## 7. Verification I'll run

- Dry-run a paid complaint through Checkout → confirm one `case_payments` row, `payment_status=paid`, ledger entry created exactly once, audit row written.
- Re-fire the webhook for the same reference → confirm RPC returns "already reconciled", no second ledger entry, no double receipt.
- Confirm Command Center summary now shows the correct GHS amount (no 0.00) and the receipt appears under Documents with a working download.
- Confirm a NUGS/student payment lands only in Student Revenue ledger, not the office ledger.
- Confirm an unauthenticated client cannot INSERT/UPDATE `case_payments` (RLS denial).

---

## 8. Technical surface

- **New migration**: `case_payments`, `case_payment_reconciliation_log`, RLS, triggers, `reconcile_case_payment()` RPC, backfill.
- **Edge functions**: `paystack-checkout/index.ts`, `verify-payment/index.ts`, `paystack-webhook/index.ts`, `reconcile-payment/index.ts`, `_shared/finalize-payment.ts` (add unified writer helper).
- **Frontend (read-only refactor)**:
  - `src/pages/regulator/ComplaintCaseFile.tsx`
  - `src/components/regulator/ComplaintDocumentsHub.tsx`
  - `src/pages/tenant/Receipts.tsx`, `src/pages/landlord/Receipts.tsx`
  - NUGS revenue cards
- **Audit & remove**: any client code that writes directly to ledger tables (replace with RPC call).

If you approve, I'll run the migration first (it requires your confirmation), then ship the edge function + frontend changes in one pass and verify each item above.