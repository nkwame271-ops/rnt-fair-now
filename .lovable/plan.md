
Goal: fix the persistent payment loop by making payment finalization reliable even when the webhook is missed, then tighten reporting, admin visibility, and receipt output.

What I found
- `paystack-webhook` is the only path that currently creates `escrow_splits`, updates office wallet flow, and starts payout transfers.
- `verify-payment` marks escrow as completed, creates a receipt, and tries payouts only if `escrow_splits` already exist. If the webhook does not run first, the ledger stays at zero and transfers never start.
- `EscrowDashboard` reads `escrow_splits`, so missing splits explains:
  - zero Allocation Summary
  - no transfers
  - “same errors” after successful payment
- `paystack-checkout` still auto-adjusts band allocations when totals do not match the payable fee. That should hard-fail, not silently rebalance.
- Sub-admin visibility is only handled in the UI today; the dashboard still calculates Platform/GRA/Landlord data from raw tables.
- Receipts still expose `split_breakdown` on tenant and regulator pages.

Plan
1. Build one shared payment finalization pipeline
- Extract the “successful payment” flow into one shared helper used by both `paystack-webhook` and `verify-payment`.
- That shared flow will be idempotent and always do the same steps in the same order:
  1. confirm escrow/payment success
  2. load stored `split_plan`
  3. validate split total equals payable amount
  4. create missing `escrow_splits`
  5. create/update receipt
  6. create missing transfer recipients
  7. create `payout_transfers`
  8. trigger transfers
  9. update office wallet flow where applicable
- Result: if webhook fires, great; if webhook is delayed/missed, `verify-payment` can still fully finalize the transaction instead of leaving ledger values at zero.

2. Fix the payout/recipient bugs
- Correct the payout routing so office admin share can use the office payout account path instead of being swallowed by the generic system-settlement mapping.
- Make transfer creation fully idempotent by checking existing `escrow_splits`, recipient codes, and `payout_transfers` before inserting again.
- Ensure the fallback verification path can create splits from `escrow_transactions.metadata.split_plan` if none exist yet.

3. Enforce strict fee/allocation validation
- In `paystack-checkout`, stop auto-adjusting the largest split when a rent-band allocation does not match the final payable fee.
- Replace that with strict validation:
  - Platform Fees / Rent Bands determine the payable amount
  - allocation rules only distribute that exact amount
  - mismatch = block checkout and log a payment configuration error
- This will prevent silent bad allocations from reaching escrow, reporting, or transfers.

4. Fix Escrow & Revenue reporting
- Update the dashboard to report from finalized payment data only, not partial/incomplete rows.
- Make Allocation Summary reflect real `escrow_splits` immediately after finalization.
- Add explicit breakdown cards instead of the current generic “Other” bucket:
  - Complaint
  - Tenancy Agreement (combined `agreement_sale` + `add_tenant_fee`)
  - Listing Fee
  - Viewing Fee
  - Archive Search
- Add a payment pipeline status/checklist view per transaction so you can see:
  - webhook received
  - verification completed
  - allocation posted
  - recipient created
  - transfer triggered
  - transfer result

5. Lock down admin visibility properly
- Main admin keeps full visibility.
- Invited sub-admins only get:
  - IGF
  - Admin
- Sub-admins must not receive or render:
  - Platform
  - GRA
  - Landlord
- I’ll enforce this in two places:
  - UI: hide restricted cards/columns/rows
  - backend data access: stop using raw unrestricted dashboard aggregation for sub-admins; return masked totals from a secure backend query/function based on `admin_staff.admin_type` and office scope.

6. Remove split details from receipts
- Make receipt views show only the total paid by the user.
- Keep internal allocation details only in escrow/reporting screens, not in receipt UI.
- Update tenant, landlord, and regulator receipt usage so `split_breakdown` is no longer shown.

Technical details
- Likely files:
  - `supabase/functions/paystack-checkout/index.ts`
  - `supabase/functions/paystack-webhook/index.ts`
  - `supabase/functions/verify-payment/index.ts`
  - `src/pages/regulator/EscrowDashboard.tsx`
  - `src/components/PaymentReceipt.tsx`
  - `src/pages/tenant/Receipts.tsx`
  - `src/pages/landlord/Receipts.tsx`
- Likely backend additions:
  - one shared payment-finalization helper under `supabase/functions/_shared/`
  - one secure reporting query/function for masked admin dashboard data
  - possibly