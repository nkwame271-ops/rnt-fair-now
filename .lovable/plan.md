# Corrective Delivery Plan: Reconciliation, Auth, Complaints and Admin Scope

## Confirmed current failures

- **Greater Accra is not a data shortage:** completed `rent_card_bulk` transactions total about **GHS 135,190** for Greater Accra. The Receipts reconciliation component deliberately removes the Platform partition for non-Super Admins, so its displayed “Total” is not the gross transaction total. The report also fetches transactions without paging, so larger office histories can stop at the backend row limit.
- **Stock reconciliation is not lifecycle-correct:** the current overview derives “allocated” from mutable `stock_type`, counts every `status='assigned'` as assigned to a landlord, matches offices by name, and hardcodes the balance result to true. Live stock has 145,202 pairs, including 143,740 regional, 1,369 office and 93 central pairs; only 700 pairs carry an allocation record, while 6,176 are marked assigned. These fields cannot be treated as interchangeable totals.
- **Payment reconciliation remains broken:** 16 successful rent-card transactions worth **GHS 1,260** still have no receipt; 110 issued/active receipts worth **GHS 7,689** have no cashbook row; 864 unresolved critical `receipt_insert` errors remain open, including new errors today. Two completed transactions have no active splits.
- **The demo landlord identity is inconsistent:** profile phone `0240005678` exists, but its auth login email is a personal email rather than the phone-login identity `0240005678@rentcontrolghana.local`; phone login therefore targets a different/nonexistent identity. The seeder contains a valid reset password but has not repaired this live account.
- **Password update itself is handled by backend auth, not application hashing.** The confirmed risk is identity lookup: phone login always constructs a synthetic email, while accounts can have that email changed. The current profile email-change flow changes the auth login identity, and the OTP reset fallback scans only the first 1,000 auth users.
- **Complaint confirmation has two unsynchronized states:** confirming a receipt only writes `payment_receipts.admin_confirmed_at`; complaint scheduling separately requires both `complaint.payment_status='paid'` and a confirmed receipt linked through escrow. This leaves confirmed receipts and complaint status able to disagree.
- **Assignment updates are incomplete:** the Complaint Management assignment control stores a hardcoded “Reassignment” reason and has no room field. The separate Command Center assign dialog writes directly to `complaints`, does not create assignment history, and also has no room.
- **Command Center updates are not implemented:** the decision picker still shows Decided/Closed, the Overview remains plain text, and the old Orders / Directions and Compliance Deadline labels remain. A reusable rich editor exists, but it lacks font family/size, full-screen mode, managed image upload, watermark and preview/edit flow.
- **Office registration and scoped authorization are absent:** `profiles` has no `region_id` or `office_id`; `admin_staff` only supports one `office_id` and has no scope type/region/office-list fields. Existing regulator policies broadly allow all regulators/admin staff to read office-sensitive tables, so current frontend filtering is not backend authorization.

## Phase 1 — Stop recurring financial and complaint-payment errors

1. **Create one server-side reconciliation source of truth** that returns gross transaction totals, split totals, receipt totals and cashbook totals by payment type, parent transaction office and region. All report screens will call it; no screen will silently redefine “Total” based on hidden partitions.
2. **Repair the payment finalization pipeline** so a successful transaction idempotently produces active splits, one correctly-valued receipt, one cashbook row and a reconciled case-payment record. Duplicate retries must return the existing records rather than log another failure.
3. **Classify and repair live exceptions:** backfill the 16 missing rent-card receipts, 110 missing cashbook rows and two split-less successful transactions only after validating each against the processor/escrow amount. Mark an error resolved only when its missing downstream record exists, and retain an audit trail.
4. **Synchronize complaint payment confirmation atomically:** replace the Receipts page’s receipt-only update with a backend operation that validates the linked complaint/case payment, confirms the receipt, sets complaint payment/status consistently, and records the actor/time. Scheduling will read this canonical state rather than rebuilding linkage in the browser.
5. Add a reconciliation test matrix covering normal webhook completion, callback recovery, repeated verification, receipt insertion failure/retry and manual complaint confirmation.

## Phase 2 — Correct rent-card revenue and stock reports

1. Replace the Receipts reconciliation query with the shared server-side aggregation, paged/database-aggregated and attributed by the **parent transaction office**. Display Gross Collected separately from visible recipient partitions so Greater Accra reconciles to the ledger without exposing restricted Platform details.
2. Define each stock tile from immutable lifecycle records:
   - Uploaded: unique valid card pairs introduced into serial stock.
   - Region allocation: allocation events to a region.
   - Office allocation: office allocation/transfer events.
   - Assigned to landlords: completed serial assignment records, deduplicated by pair/purchase.
   - Unassigned central: valid uploaded pairs never allocated, assigned, revoked or spoiled.
   - Available office: net office receipts + transfers/adjustments in − assignments − transfers/adjustments out − revoked/spoiled.
3. Move these calculations to a database function/view with one shared response for overview, region drill-down and office drill-down. Use office IDs, never office-name equality.
4. Show explicit conservation checks and discrepancy counts; never hardcode a report as balanced.

## Phase 3 — Repair login and password flows

1. Repair test account `0240005678` so its phone-login identity, profile and landlord record point to the same auth user; set a new policy-compliant test password and verify sign-in through the real phone login flow.
2. Keep the phone-derived auth identity stable when a user changes their contact email. Store contact email only in the profile unless a separate email-login migration is explicitly performed.
3. Make password change re-authenticate, update the password, sign out other sessions, refresh the current session state and then perform a clean sign-out/sign-in verification.
4. Replace first-page auth-user scans in OTP recovery with an indexed server-side identity mapping. Normalize every Ghana phone to one canonical `233XXXXXXXXX` value while accepting local input.
5. Add end-to-end tests for landlord and tenant: register → phone login → change password → sign out → phone login with new password; repeat for OTP reset.

## Phase 4 — Complete complaint assignment and Command Center

1. Unify both assignment interfaces behind one backend assignment operation. Initial assignment and reassignment will store officer, room sourced from `hearing_rooms`, actor and timestamp; reassignment requires a non-empty reason and writes complaint assignment history plus the audit log.
2. Replace outcomes with: Adjournment, Struck Off, Pending, Inspection, Adjourn Sine Die and Referred to Court. Existing historical values remain readable.
3. For Adjournment, require a date and append an immutable adjournment-history row; never overwrite earlier dates. Show the complete history until final determination.
4. Upgrade Overview using the existing rich editor foundation: full-screen mode, font family/size, bold/italic/underline, alignment/lists/tables, managed image upload, optional watermark, preview and edit-from-preview. Sanitize stored HTML and store uploaded images in private application storage rather than arbitrary URLs/base64.
5. Rename the UI labels to **Determination** and **Date** while preserving existing database fields where compatible.

## Phase 5 — Office registration and enforceable admin scope

1. Add required `region_id` and `office_id` registration ownership to landlord/tenant records (and profile lookup fields where needed), with the office selected from the database and region derived server-side. Update both registration UI and `register-account` validation.
2. Backfill existing users from reliable linked office data; records that cannot be derived remain explicitly unassigned for controlled admin remediation rather than being guessed.
3. Add staff scope fields supporting `ALL_REGIONS`, `SPECIFIC_REGION_ALL_OFFICES` and `SPECIFIC_OFFICES`. Update Invite Staff and staff editing to require and validate the matching region/office selection. Also align temporary passwords with the project-wide 8-character minimum.
4. Implement non-recursive backend scope helpers and apply scope-aware policies to landlord/tenant data, complaints, cases, rent cards, receipts, cashbook/reconciliation, reports and other office-sensitive records. Main/Super Admin behavior remains governed by the existing main-admin source of truth.
5. Replace the single-office frontend scope helper with the complete effective scope, apply it consistently to every affected query/export/function and display the active scope. Backend denial remains authoritative even if a client removes UI filters.
6. Add authorization tests using one all-region admin, one Ashanti-region admin and one multi-office admin, verifying both allowed data and denied direct API access.

## Delivery and acceptance

- Deliver in the phase order above; Phase 1 is the release blocker because new reconciliation errors are still being created.
- Before and after each financial repair, publish transaction/split/receipt/cashbook counts and amounts; no hand-adjusted totals.
- Every bug is accepted only after a live browser reproduction and post-fix verification on the affected role, plus direct database checks for financial and authorization invariants.
- Database changes include grants, RLS and indexes in the same migrations. Data backfills are separate audited data operations.
- Scope rollout uses a deny-by-default migration sequence with an explicit compatibility window so existing admins are not accidentally locked out before scopes are assigned.