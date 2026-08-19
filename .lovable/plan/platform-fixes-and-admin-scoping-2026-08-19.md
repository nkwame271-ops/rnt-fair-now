# Platform Fixes and Admin Scoping

## What I confirmed in the live data before planning

- Rent card money **is** attributable by parent transaction: completed `rent_card_bulk` splits group cleanly by the transaction's office — `accra_central` GHS 140,505, `weija` 10,170, `sowutuom` 9,970, `adenta` 8,615, `ofankor` 5,250, `ashaiman` 4,550, `amasaman` 3,750, `tema` 2,600, `ningo_prampram` 2,375, plus only GHS 84.01 across 12 rows with no office at all. So Greater Accra's true rent card figure is far above GHS 63,100 and the shortfall is in the *reading* query, not the ledger.
- `profiles` has **no** `office_id` or `region_id` column (only `delivery_region`/`delivery_area`), so office-scoped landlord/tenant registration needs new columns — nothing to reuse today.
- `admin_staff` has `office_id` and `office_name` but **no region or multi-office scope column**, and the scope helper (`useAdminScope`) is single-office and application-layer only. Region scope and `SPECIFIC_OFFICES` do not exist yet in either UI or database.
- `complaint_assignments` already has a `reason` column and `complaint_hearings` already carries `room_id` / `room_label`, so room number and reassignment reason can reuse existing structures.
- `complaint_decisions` stores `outcome`, `orders`, `compliance_deadline`, `next_hearing_at` as free text/date — the new outcome list and adjournment history fit without destructive schema changes.

Items 1.4 (payment reconciliation open failures) and 1.6 (password change lockout) are **not diagnosed yet**. I will not assert a cause for them; step 1 for each is reproduction/query, then a fix.

## Phase 1 — Bug fixes

### 1.1 Rent card sales by region stuck at 63,100
Audit every rent card sales/revenue reader (`EscrowDashboard`, `SuperAdminDashboard`, `RegulatorReceipts`, `rent-cards/OfficeReconciliation`) and make them all use one shared aggregation: group splits by the **parent transaction's** office, map office to region from `offices`, page past the 1,000-row cap, and count `rent_card_bulk` only. Report the before/after per region so the movement is verifiable.

### 1.2 Stock reconciliation figures
Recompute each tile straight from lifecycle records: uploaded = serial stock rows; allocated to region/office = allocation records; assigned to landlords = rent card rows with a landlord; central unassigned = uploaded minus allocated; available office stock = received (allocations + transfers in + quota) minus assigned. Every query paged. Add a self-check row that flags when the parts do not sum to the whole instead of silently hiding the gap.

### 1.3 Complaints export
Verify and, where missing, apply region, office, status, type and date filters identically to both `complaints` and `landlord_complaints` in the export path, page both, and keep a Source column in CSV and PDF.

### 1.4 Payment reconciliation (investigate first)
Query the current state of open failures, receipt-less successful payments and unreconciled receipts, classify each cluster by cause, then fix the paths responsible and back-fill the affected records with an audit row. I will report the counts before proposing any data write.

### 1.5 Test landlord 0240005678
Check the auth state for that account, set a policy-compliant password, and confirm sign-in by phone actually succeeds before reporting it as usable.

### 1.6 Password change lockout (reproduce first)
Reproduce end to end on a scratch account: change password in-app, then sign in by phone. Trace the update path, the synthetic phone login address, and session invalidation. Fix what the reproduction shows — the leading suspects are the profile email change rewriting the phone login identity, and the reset flow resolving the wrong account by loose phone match.

## Phase 2 — Complaint management updates

### 2.1 Assign case
- Add Room Number to the assignment dialog, sourced from the same room records the Command Center uses, so both stay in sync.
- On reassignment, require a Reason and write it to the assignment record and the case audit history.

### 2.2 Command Center
- Outcome list becomes: Adjournment, Struck Off, Pending, Inspection, Adjourn Sine Die, Referred to Court. Remove Closed and Decided from the picker (existing records keep their stored value).
- Adjournment requires a date, supports multiple adjournments per case, and shows the full adjournment history until final determination.
- Overview field becomes a rich editor: full-screen mode, font family/size, bold, italic, formatting, image insertion, and a watermark option. Add Preview with Edit-from-Preview.
- Rename Orders/Directions to **Determination** and Compliance Deadline to **Date** (labels only; stored columns unchanged).

## Phase 3 — Office-scoped registration

Landlord and tenant registration require selecting a Rent Control office; region is derived from that office. Store region and office on the registration record so the user appears under that office everywhere, the same way rent cards and cases do. Existing accounts without an office get backfilled where derivable and flagged where not.

## Phase 4 — Region/office scoped admin access

Give staff a real scope: `ALL_REGIONS`, `SPECIFIC_REGION_ALL_OFFICES`, or `SPECIFIC_OFFICES` (with a region and an office list). Set it when inviting or editing an admin.

Enforce it in two layers:
- **Database:** scope-aware policies so a scoped admin cannot read out-of-scope rows even with a direct API call, across landlords, tenants, complaints, cases, rent cards, receipts, reconciliation and reports.
- **Frontend:** the scope hook returns the full scope (not a single office) and every listed module filters by it, with the active scope shown in the header.

Super/main admins with `ALL_REGIONS` keep seeing everything.

## Technical notes

- Shared aggregation helper for rent card revenue; all readers call it instead of each rolling their own filter.
- New columns: registration region/office on the landlord/tenant records; scope type + region + office array on `admin_staff`. Both with grants and policies in the same migration.
- Scope enforcement uses a security-definer helper (in the style of `is_main_admin()`) so policies stay non-recursive.
- Rich text stored as sanitised HTML; images go to storage, not inline base64.
- No displayed figure is hand-edited anywhere — corrected numbers come from transactions, splits, receipts and serial stock records.

## Sequencing

Phase 1 first (money and login correctness), then Phase 2, then 3, then 4 — Phase 4 touches the most policies and benefits from registration already carrying office data.
