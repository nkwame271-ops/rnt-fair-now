# Corrective Delivery Plan: Payments, Complaints, Registration, and Admin Scope

## Confirmed live findings

- The receipt-number sequence is at **12,389**, while existing receipt numbers reach **20,360**. New receipt creation is therefore colliding with existing numbers. There are **873 unresolved duplicate receipt-number failures**.
- There are currently **106 completed payments without receipts**: 39 landlord registrations, 20 complaint fees, 18 tenant registrations, 16 rent-card purchases, 7 filing fees, 4 existing-tenancy bundles, and 2 wallet top-ups.
- There are **110 receipts worth GHS 7,689 without cashbook entries**, plus one zero-value receipt.
- The current complaint scheduling gate requires a paid complaint to have a receipt linked through `escrow_transactions.related_complaint_id`. That link is absent for **38 paid tenant complaints and 56 paid landlord complaints**, so those cases show “Awaiting admin confirmation” even though payment is already recorded.
- Test phone **0240005678** belongs to an existing landlord account whose authentication email is a normal email address, while phone login constructs `0240005678@rentcontrolghana.local`. The seeded test-account password path therefore does not target this live account.
- Case assignment currently has no room field and silently stores a generic reassignment reason. The Command Center already has `hearing_rooms`, but its scheduler presents hardcoded Room 1–10 values rather than using those records directly.
- Decision recording still offers Decided/Closed and uses plain text fields. The existing Tiptap editor already supports headings, bold, italics, alignment, lists, tables, and images, but is not connected to decisions.
- Registration currently stores only `profiles.delivery_region`; `landlords` and `tenants` have no `region_id` or `office_id` columns.
- Admin access is currently single-office and frontend-only. All 27 main admins are unscoped, and database policies do not enforce office/region boundaries.

## Phase 1 — Stop recurring payment and complaint failures

1. **Repair receipt generation at the source**
   - Advance the receipt sequence safely beyond the highest existing receipt number.
   - Make receipt/cashbook creation idempotent by escrow ID and payment reference, treating an already-created row as success rather than an open failure.
   - Use the effective paid amount consistently for allocation validation so recovery runs do not log false “paid amount 0” failures.
   - Ensure the finalization transaction synchronizes payment intent, escrow, receipt, case payment, reconciliation status, and cashbook posting.

2. **Repair existing financial drift**
   - Re-run finalization for the 106 completed payments missing receipts.
   - Post the 110 missing cashbook entries from their receipts.
   - Repair the single zero-value receipt from its escrow/payment source.
   - Relink receipt numbers and mark genuinely repaired processing/generation failures resolved, preserving the audit history.
   - Produce before/after counts by payment type; no displayed figure will be manually edited.

3. **Fix complaint payment synchronization**
   - Resolve a complaint payment using all canonical links: complaint ID, escrow ID, case ID, platform reference, Paystack reference, and `case_payments` metadata.
   - Make receipt confirmation atomically update the correct complaint, filing-fee fields, case payment, and scheduling-ready status.
   - Replace the fragile frontend-only scheduling check with one backend-authorized payment-state check shared by tenant and landlord complaints.
   - Backfill the 94 paid complaints currently blocked by the old link assumption, then verify scheduling succeeds.

4. **Restore the landlord test account**
   - Preserve the existing landlord user and records; do not create a duplicate account.
   - Repair its phone-login identity mapping and set a known 8+ character test password through the backend.
   - Verify phone login end to end and confirm it routes to the landlord dashboard.

## Phase 2 — Complaint assignment and decisions

1. **Unified assignment workflow**
   - Add Room Number to Assign Case, populated directly from active `hearing_rooms` records.
   - Store room assignment with the active case assignment so the Command Center reads the same room record.
   - Consolidate the competing direct officer assignment and assignment-history paths into one operation.
   - Require a non-empty reassignment reason, close the prior assignment, create the new assignment, and append the reason to the complaint audit/history log.

2. **Decision outcomes and adjournments**
   - Replace the picker with: Adjournment, Struck Off, Pending, Inspection, Adjourn Sine Die, and Referred to Court.
   - Keep historical Closed/Decided values readable, but prevent new selections.
   - For Adjournment, require a future date and create an append-only adjournment history record; allow repeated adjournments until a final determination.
   - Show the complete dated adjournment timeline in the case file and activity history.

3. **Document-style Overview editor**
   - Reuse and extend the existing Tiptap editor rather than embedding Google Docs.
   - Add full-screen editing, font family/size, bold, italics, alignment and lists, controlled image upload, and optional watermark metadata.
   - Sanitize stored HTML and keep images in private storage rather than inline base64.
   - Add Preview and Edit from Preview without losing unsaved content.
   - Relabel Orders/Directions as **Determination** and Compliance Deadline as **Date** while preserving existing stored values.

## Phase 3 — Office-bound landlord and tenant registration

- Use the backend `offices` table as the single source for Region → Office selection.
- Require an office during landlord and tenant registration; derive `region_id` from the selected office server-side rather than trusting a client-supplied pair.
- Add non-nullable office/region ownership for new registration records while allowing a controlled migration period for legacy rows.
- Store the attribution on the landlord/tenant domain record and profile where needed for portal reads.
- Backfill existing users only where office can be derived reliably; produce an exception list instead of guessing.
- Update registration, account creation, directories, exports, and related payment attribution to use the stored office.

## Phase 4 — Region and office scoped admin authorization

1. **Scope model**
   - Add `ALL_REGIONS`, `SPECIFIC_REGION_ALL_OFFICES`, and `SPECIFIC_OFFICES` to `admin_staff`, with region and validated office membership.
   - Update Invite/Edit Staff so permitted creators assign a scope. Existing super/main admins receive an explicit safe migration scope rather than relying on null semantics.
   - Enforce the project’s 8-character password minimum in Invite Staff at both UI and function levels.

2. **Backend enforcement first**
   - Add a security-definer scope helper that returns whether the current admin may access a given region/office without recursive RLS.
   - Apply scope-aware authorization to landlords, tenants, complaints, cases, assignments, hearings, rent cards, receipts, escrow/reconciliation, reports, cashbook data, and office-sensitive functions.
   - Validate scope in admin edge functions and RPCs, including Invite Staff; reject arbitrary or out-of-scope office IDs.
   - Preserve unrestricted access only for explicitly authorized `ALL_REGIONS` super/main admins.

3. **Frontend consistency**
   - Replace the single-office `useAdminScope` result with the full scope model.
   - Apply the same scope to every listed module, exports, totals, pagination, search, and drill-downs.
   - Display the active scope clearly and prevent out-of-scope options from appearing, while treating database authorization as the real security boundary.

## Validation and rollout

- Add focused tests for receipt-number concurrency, idempotent reprocessing, complaint payment linking, multiple adjournments, room synchronization, registration attribution, and each admin scope type.
- Verify payment lifecycle and complaint scheduling against repaired live examples.
- Verify admin scope with separate All Regions, Ashanti Region, and selected-office users, including direct API attempts outside scope.
- Roll out in order: payment/complaint repair, complaint workflow, registration attribution, then scoped RLS. Each phase includes before/after counts and an audit record for data repairs.