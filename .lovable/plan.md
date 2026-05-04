## Student Revenue Separation — Engine Room, Escrow, Payout Settings

Student-related money flows are split off from the standard tenant/landlord pipeline at every layer: configuration (Engine Room), routing (escrow & payout), and visibility (Super Admin only).

### 1. New dedicated payment types

Two new `payment_type` values are introduced and used by the student portal exclusively:

- `student_registration` — paid by students at signup (replaces the use of `tenant_registration` when `is_student = true`).
- `student_complaint_fee` — paid for any complaint filed from the student/NUGS portal (replaces `complaint_fee` for student-filed complaints).

Existing tenant rows already paid as `tenant_registration` / `complaint_fee` are not migrated — only new student transactions go through the new types.

`paystack-checkout` is updated to detect a student payer (and student-filed complaints) and switch to these new types. `finalize-payment` recognises them so receipts, notifications and case-status side effects keep working.

### 2. Engine Room — dedicated Student Revenue category

A new top-level section "Student Revenue" appears in Engine Room, separate from the current Fees / Splits tabs. Inside it, two cards:

- Student Registration Fee
- Student Complaint Filing Fee

Each card has:

- A fee toggle + flat fee amount (stored in `feature_flags` as `student_registration_fee` and `student_complaint_fee`, category `fee`).
- A flat 4-row split editor with fixed recipients: **IGF**, **NUGS**, **Platform**, **CM**. Each row is an absolute GHS amount, not a percentage. The row sum must equal the fee amount (validated in the UI and on save).

Splits are stored in `split_configurations` with `payment_type` = `student_registration` / `student_complaint_fee` and `amount_type = 'flat'`. Recipients are exactly `igf`, `nugs`, `platform`, `cm`. (`igf` already exists as a system account; `nugs` and `cm` are new — see §3.)

Standard fee/split tabs in Engine Room hide these two payment types so they only live in the Student Revenue section.

### 3. Payout Settings — add NUGS and CM

In `OfficePayoutSettings.tsx`, the system settlement accounts list (currently IGF / Admin / Platform / GRA) is extended with two new entries:

- **NUGS** (`account_type = 'nugs'`)
- **CM** (`account_type = 'cm'`)

They use the same form fields (bank or momo, account name/number, Paystack recipient sync) as the existing IGF/Platform rows. They are stored as new rows in `system_settlement_accounts`.

`finalize-payment.ts` (`RECIPIENT_TO_ACCOUNT_TYPE`) is updated so split recipients `igf`, `nugs`, `platform`, `cm` map to their settlement accounts; payout transfer creation works for them like any other system recipient.

Student splits never go through office-level routing or `secondary_split_configurations` — even the IGF portion of a student fee bypasses the office/HQ secondary-split logic and goes straight to the IGF settlement account.

### 4. Escrow — Super Admin only, fully isolated

A new `is_student_revenue` boolean is added to `escrow_transactions` (default false). It is set to `true` whenever the payment type is `student_registration` or `student_complaint_fee`.

- `EscrowDashboard` (used by main/sub admins) excludes any transaction where `is_student_revenue = true`. Office-level escrows therefore never include student money.
- A new "Student Revenue" page is added under the Super Admin section (`/regulator/super-admin/student-revenue`) showing only student transactions, splits, receipts, and payouts. Filters mirror the standard escrow dashboard but scoped to student data.
- RLS is tightened so non-super-admins cannot SELECT student rows from `escrow_transactions`, `escrow_splits`, `payment_receipts`, or `payout_transfers` — even via API. Visibility uses `is_super_admin(auth.uid())`.

### 5. Routing on the student portal

- Student registration checkout from `RegisterTenant.tsx` (when `is_student = true`) calls `paystack-checkout` with `type = 'student_registration'`.
- `NugsMyComplaints` / NUGS complaint filing pays with `type = 'student_complaint_fee'`. Tenant complaints continue to use the existing `complaint_fee`.
- Receipt strings, SMS labels, and notification copy reference "Student" so users see the right wording.

### Files touched

- `supabase/migrations/<new>.sql` — add `is_student_revenue` column, new feature flag rows, new system settlement account types `nugs`/`cm`, two new `split_configurations` payment types, RLS updates.
- `supabase/functions/paystack-checkout/index.ts` — detect student payers, branch to new payment types, skip office routing for student types.
- `supabase/functions/_shared/finalize-payment.ts` — handle `student_registration` and `student_complaint_fee` side effects, set `is_student_revenue`, add `nugs`/`cm` to `RECIPIENT_TO_ACCOUNT_TYPE`, skip secondary split for student types.
- `src/pages/regulator/EngineRoom.tsx` — add Student Revenue section with flat 4-way split editor and validation; hide student types from generic tabs.
- `src/pages/regulator/OfficePayoutSettings.tsx` — add NUGS and CM rows.
- `src/pages/regulator/SuperAdminDashboard.tsx` + new `src/pages/regulator/StudentRevenue.tsx` and route in `App.tsx`.
- `src/pages/regulator/EscrowDashboard.tsx` — filter out `is_student_revenue` transactions.
- `src/pages/RegisterTenant.tsx`, `src/pages/nugs/NugsMyComplaints.tsx` (and any other student complaint entry points) — pass the new payment type.

### Out of scope

- Migration of historical tenant/landlord transactions to the new types.
- Changes to non-student fee structures, percentage configs, or office payout flows.
- New SMS provider templates beyond a wording tweak in existing notifications.
