# Corrective Plan: Payment Integrity, Complaints, Test Login, and Admin Scope

## Confirmed causes

- Payment records remain materially out of sync: **118 successful escrow transactions have no receipt**, **17 successful fulfillments have no linked receipt**, **113 receipts have no cashbook entry**, and **1 receipt has a zero value**.
- “Open Failures” is also retaining historical noise: **2,100 unresolved processing errors** and **908 unresolved receipt failures**. Of the receipt failures, 903 are old receipt-number collisions, 3 are duplicate-escrow attempts, and 2 are cashbook-reference collisions. The receipt sequence itself is now ahead of the highest issued number, so the remaining work is recovery and correct resolution—not another sequence guess.
- The shared finalizer can return “completed” even after a receipt insert fails. Its allocation check still compares against the raw processor amount rather than the effective recovered amount, creating false failures during recovery. Payment finalization spans several independent writes rather than one authoritative synchronized operation.
- Phone `0240005678` currently exists only as an orphaned profile using the expected synthetic login email. There is no matching authentication user, landlord record, or landlord role, so no password can authenticate that profile.
- The hearing-room menu is empty because the live `hearing_rooms` table contains **zero rows**. Assignment already stores `room_id`; reassignment already requires and stores a reason in both assignment history and the complaint audit log.
- The Record Decision modal has no viewport height limit or scrolling, while its editor forces a minimum height of 60% of the viewport. Preview/Edit mode is not implemented.
- The three-value admin scope schema exists, but it is not wired into the frontend hook, Invite Staff, backend functions, or any RLS policy. Current sensitive policies still grant nationwide access to any regulator. The current staff update policy and Invite Staff function also contain privilege-escalation paths.

## Phase 1 — Make payment finalization authoritative and recover existing drift

1. **Create one backend finalization transaction**
   - Introduce a parameterized backend function that locks the payment reference and synchronizes escrow status, split ledger, receipt, fulfillment, case payment, reconciliation state, complaint payment state, and cashbook posting as one idempotent operation.
   - Enforce one receipt per escrow/reference and one cashbook row per receipt/reference with conflict-safe success behavior.
   - Return success only when required financial records exist; return a structured recoverable failure otherwise.
   - Use one effective paid amount consistently: verified processor amount, then stored fulfillment amount, then escrow total. Never create a zero receipt for a funded payment.

2. **Refactor every payment entry point**
   - Route webhook verification, callback verification, manual reconciliation, and drift recovery through the same operation.
   - Remove duplicate client/function-side synchronization logic and ensure retries converge on the same records.
   - Resolve failure rows automatically only after the referenced receipt, ledger, cashbook, and reconciliation records are verified.
   - Separate payout-account failures from payment/receipt synchronization so payout configuration does not make a successful customer payment appear unreconciled.

3. **Repair live records with an auditable recovery run**
   - Recover the 118 successful escrows missing receipts and link the 17 successful fulfillments.
   - Post the 113 missing cashbook rows and repair the one zero-value receipt from its payment source.
   - Re-evaluate all 3,008 open error/failure rows, resolve only repaired or obsolete duplicates, and preserve error history and resolution notes.
   - Produce before/after counts grouped by payment type and leave genuinely unrecoverable references visible with a specific reason.

4. **Validation**
   - Add concurrency and retry tests for webhook + callback races, manual reruns, receipt collisions, cashbook collisions, and recovery with missing processor amount.
   - Require zero successful escrows without receipts, zero funded zero-value receipts, zero receipts without cashbook rows, and zero successful fulfillments without receipt links before closing the phase.

## Phase 2 — Restore the landlord test account safely

- Recreate the authentication identity for `0240005678` using its existing profile identity instead of creating another profile.
- Add the missing landlord domain record and landlord role, preserving the existing profile ID and normalized phone mapping.
- Set a known 8+ character test password through the backend and verify phone login routes to the landlord dashboard.
- Check for other orphaned test profiles created by the same flow and report them without changing unrelated accounts.

## Phase 3 — Complete complaint assignment and decision UX

1. **Single hearing-room source**
   - Seed/manage real room records for the relevant offices in `hearing_rooms`; do not use hardcoded Room 1–10 values.
   - Make Assign Case and Command Center read the same active, office-scoped rows.
   - Persist the selected room on assignment and scheduling, and display the same room in assignment history, hearing details, and generated documents.
   - Show a clear configuration state when an office has no rooms rather than an empty selector.

2. **Atomic reassignment**
   - Preserve the existing mandatory reassignment reason UI.
   - Move “close old assignment + create new assignment + audit entry” into one authorized backend operation so partial updates cannot occur.
   - Include old officer, new officer, room, reason, actor, and timestamp in the case audit/history.

3. **Responsive Record Decision workflow**
   - Constrain the decision dialog to the viewport with an internal vertical scroll area and sticky header/actions, including mobile and laptop resolutions.
   - Make the rich-text editor accept a modal-appropriate height instead of forcing `60vh`.
   - Add Preview mode that renders the unsaved decision, plus Edit from Preview without clearing the draft.
   - Keep outcome/date validation and save behavior unchanged except for the atomic adjournment/decision write.

## Phase 4 — Enforce region and office scope end to end

1. **Secure the scope model and Invite Staff**
   - Wire `ALL_REGIONS`, `SPECIFIC_REGION_ALL_OFFICES`, and `SPECIFIC_OFFICES` into the staff profile hook and Invite/Edit Staff screens using live `offices` data.
   - Validate scope combinations server-side: region required for regional scope; non-empty valid office list required for office scope; selected offices must belong to the permitted region where applicable.
   - Enforce the 8-character password rule.
   - Restrict creation/promotion of Main Admin and Super Admin accounts to explicitly authorized creators; remove the current client-controlled escalation path.
   - Replace the broad `admin_staff` update policy with narrowly authorized updates and matching validation checks.

2. **Backend authorization first**
   - Harden the scope helper as a non-recursive security-definer authorization function and add companion helpers for records whose office must be derived through a parent relation.
   - Replace blanket regulator policies with scope-aware policies for landlords, tenants, complaints, landlord complaints, cases, assignments, hearings, properties, rent cards/stock/allocations, receipts, escrow/splits, cashbook, reconciliation, reports, payouts, and other office-sensitive records.
   - Apply the same checks inside reconciliation, staff administration, complaint operations, exports, RPCs, and edge functions before service-level clients access data.
   - Treat records with no attributable office as central/HQ data available only to authorized `ALL_REGIONS` administrators; never expose them through null-as-unscoped behavior.

3. **Frontend consistency**
   - Replace the single-office `useAdminScope` contract with full region/multi-office scope data.
   - Apply scoped filtering to lists, detail pages, searches, totals, charts, exports, pagination, dropdown choices, and cross-table lookups.
   - Display the active scope and prevent out-of-scope navigation/options, while keeping database authorization as the security boundary.

4. **Backfill and rollout safely**
   - Validate all 60 existing admin scope rows before enabling restrictive policies; current records comprise 28 `ALL_REGIONS` and 32 `SPECIFIC_OFFICES` admins.
   - Derive missing record office attribution only from reliable parent links and create an exception report for ambiguous/null records.
   - Roll out by module with temporary before/after access checks so legitimate workflows are not locked out.

## Verification matrix

- **Payments:** processor success → escrow → splits → receipt → fulfillment → case payment → reconciliation → cashbook, including retries and recovery.
- **Login:** `0240005678` signs in by phone and reaches the landlord dashboard with the correct existing profile.
- **Complaints:** rooms populate from live office records; assignment and Command Center agree; reassignment is atomic and audited; decision dialog works without browser zoom; Preview/Edit preserves content.
- **Authorization:** test separate All Regions, Ashanti Region, and selected-office administrators across every listed module, including direct API attempts, guessed record IDs, exports, totals, and backend function calls outside scope.
