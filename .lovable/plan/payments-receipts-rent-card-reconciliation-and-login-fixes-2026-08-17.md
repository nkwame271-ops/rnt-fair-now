# Payments, Receipts, Rent Card Reconciliation and Login Fixes

## What I verified in the live data first

- **Rent card money exists, attribution does not.** Completed rent card transactions (`rent_card_bulk`) total **GHS 133,039**. Of the 4,455 active revenue split rows behind them, **2,902 rows worth GHS 136,539 have no office attached** (`office_id` is NULL). Only about GHS 49,000 of splits carry an office. Every office/region revenue view filters splits by office, so those unattributed rows silently vanish — that is why Greater Accra looks stuck far below the real figure.
- **A stock/sales panel queries a payment type that does not exist.** The Sales & Reconciliation screen counts payments where type = `rent_card_purchase`. No such rows exist; the real type is `rent_card_bulk`. That counter is structurally always 0.
- **Zero-value receipts have a single, confirmed cause.** 74 receipts show GHS 0.00 while escrow holds the real amount (e.g. receipt RCT-20260814-1176: receipt 0.00, escrow 195, and its own split breakdown adds to 195). The recovery path in `verify-payment` re-runs finalization with the paid amount hardcoded to `0` whenever escrow is already marked completed, so the receipt is written with 0.
- **57 completed rent card transactions have no receipt at all**, which also drags reported sales below escrow.
- **Complaint export already reads both tables** (tenant `complaints` and `landlord_complaints`) and regulators have read access to both. What it does *not* do is apply region, office, status or type filters — only dates. So a filtered/regional export can look like landlord complaints are missing.
- **Test landlord 0240005678**: the profile exists, but a password sign-in with the seeded password is rejected as invalid credentials. The seeded password is 6 characters, below the 8-character minimum the reset flow enforces — the account needs a valid password set.
- **Password-change lockout**: not yet proven. One real code-level risk found: sign-in uses a synthetic `<phone>@rentcontrolghana.local` address, and the profile "change email" action rewrites the auth email away from that synthetic address, which permanently breaks phone sign-in. Whether the reported case came from that or from the OTP reset path resolving the wrong account needs a reproduction before a fix is claimed.

## Fixes

### 1. Receipt amount correctness (root cause)
- In `verify-payment`, stop passing `0` on the already-completed recovery path; pass the real escrow amount.
- In the shared finalization module, treat a non-positive paid amount as "unknown" and fall back to the escrow total (then to the split-plan total) before writing the receipt, so no future path can write a 0.00 receipt for a funded transaction.
- One-off migration: correct existing zero-value receipts to their escrow amount, and generate the missing receipts for completed transactions that never got one. Both write an audit trail row rather than silently mutating money records.

### 2. Office/region attribution for rent card revenue
- Backfill `escrow_splits.office_id` from the parent transaction's office wherever it is NULL.
- Set the office on every split at creation time in finalization, so new payments cannot land unattributed.
- Change office and region roll-ups to attribute by the parent transaction's office instead of filtering splits by office, so a missing value can never drop money out of a total.

### 3. Simplified Rent Card stock reconciliation
Rebuild the Reconciliation view around card records only:
- Top level: Total Uploaded, Total Allocated to Regions/Offices, Total Assigned to Landlords, Unassigned Central Stock, plus an expandable Region -> Office allocation breakdown.
- Office level (after picking region + office): Total Received (allocations + transfers in + quota increases), Total Assigned to Landlords, Available = Received - Assigned, with the transfer/quota components itemised.
- Fix the `rent_card_purchase` -> `rent_card_bulk` payment type, and page all stock queries so nothing is capped at 1,000 rows.

### 4. Complaint report export
- Apply the selected region, office, status and type filters to both the tenant and landlord complaint queries, and page both so large ranges are complete.
- Add a source column ("Tenant" / "Landlord") to CSV and PDF so it is visible that both are present.

### 5. Login and password issues
- Set a compliant password for the 0240005678 test landlord so it signs in again, and update the seeder to use passwords that satisfy the 8-character policy.
- Reproduce the change-password lockout end to end (change password, then sign in by phone) against a scratch account before changing behaviour. Then fix what the reproduction shows, with these two candidates already identified: the profile email change rewriting the phone-login address, and the OTP reset resolving a user by loosely matched phone formats.
- Where the synthetic phone address is the login identity, keep it stable when contact email changes, and surface the change clearly to the user.

## Technical notes

- Files: `supabase/functions/verify-payment/index.ts`, `supabase/functions/_shared/finalize-payment.ts`, `src/pages/regulator/rent-cards/OfficeReconciliation.tsx`, `src/pages/regulator/EscrowDashboard.tsx`, `src/components/ComplaintReportsDialog.tsx`, `src/lib/generateComplaintReports.ts`, `src/pages/shared/ProfilePage.tsx`, `supabase/functions/seed-test-users/index.ts`, plus migrations for the receipt/split backfills.
- No displayed figure is hand-adjusted anywhere; every corrected number comes from escrow transactions, splits, receipts or serial stock records.
- After the backfills, escrow total, split totals, receipt totals and the office/region roll-ups for rent cards should agree; I will report the before/after numbers.
