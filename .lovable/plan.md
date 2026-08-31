# Corrective Plan: Login, Office Assignment, Hearing Rooms, and Admin Access

## Confirmed findings

- **Landlord test account:** `0240005678@rentcontrolghana.local` exists, is confirmed and active, has the landlord role and `LLD-DEMO-001`, and last signed in on 31 August 2026. Its profile is inconsistent: the phone is blank and `user_type` is `tenant`. Password hashes cannot be inspected, so the safe fix is an idempotent credential reset plus an end-to-end login test.
- **Hearing rooms:** the database contains exactly **Hearing Room 1–10 for all 67 offices** (670 active rooms). The Assign Case UI fetches every office’s rooms into one unfiltered selector, causing repeated room labels instead of the ten rooms belonging to the selected office.
- **Registration office:** registration correctly saves the selected office and region on the landlord/tenant record. The payment checkout then ignores that record, re-resolves from unrelated delivery fields, and defaults failures to `accra_central`. There are **104 registration payment records and cases** with mismatched office attribution, including **56 completed payments/receipts**.
- **New admin access:** Cashbook, Agent Applications, API access, Developer Accounts, and Payment Reconciliation are absent from the feature-route registry. Restricted Main Admins therefore see unmapped routes automatically, and direct URLs are not consistently protected.

## Implementation

### 1. Repair and verify the landlord test account
- Update the existing test-account seeder so the landlord profile is repaired completely: phone, landlord user type, email, role, active landlord record, confirmed identity, and the documented 8+ character test password.
- Run the repair idempotently against the existing account rather than creating a duplicate.
- Verify phone login through the real landlord login screen and confirm arrival at the landlord dashboard.

### 2. Scope hearing rooms to the assigned office
- Include stable office IDs when loading assignable staff.
- After an office is selected, load/display only that office’s active Hearing Room 1–10 entries, using natural numeric order (`1, 2, …, 10`).
- Apply the same office filtering in case scheduling and hearing schedule controls so rooms from other offices cannot be assigned accidentally.
- Preserve the selected room in assignment history and validate server-side that the room belongs to the assigned office.

### 3. Preserve registration office and region end to end
- Change registration checkout to read `tenants.office_id` or `landlords.office_id` first; use the selected office’s database region as the authoritative region.
- Remove the silent Accra Central fallback for registration flows. Missing or invalid office data must return a clear error rather than misattribute money or cases.
- Keep geographic/property office resolution for non-registration payment types where it is still appropriate.
- Repair existing mismatched registration records transactionally across the authoritative payment, case, receipt, cashbook/reconciliation, and related office-attribution records, preserving student-revenue rules where applicable.
- Add consistency checks so a registration payment cannot be finalized under an office different from the user’s registration office.

### 4. Make sensitive admin features opt-in
- Add explicit feature keys for:
  - Cashbook
  - Agent Applications
  - API Developer Access / API Access Requests
  - Developer Accounts
  - Payment Reconciliation
- Surface those keys as unchecked options in **Invite Staff → Allowed Features** and store only the selections made.
- Remove the Main Admin “unmapped route means allowed” behavior for sensitive routes.
- Enforce the same permission at both navigation and route/page level, so manually entering a URL cannot bypass the feature assignment.
- Keep Super Admin access unchanged.

## Validation

- Log in with `0240005678` and the repaired test password; confirm the landlord dashboard and landlord identity data.
- In Assign Case, select offices in different regions and verify each shows exactly Hearing Room 1–10 for that office only.
- Register test landlord and tenant accounts under non-Accra offices; verify the selected office/region across account, payment, case, receipt, and cashbook records.
- Reconcile the historical repair counts before and after; target zero mismatches without changing payment amounts or references.
- Invite a new Main Admin with none of the five sensitive features and confirm they are hidden and blocked by direct URL; then enable each feature individually and confirm access appears only when selected.
