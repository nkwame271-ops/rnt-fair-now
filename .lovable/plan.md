
# Resolution Centre & Rent Card Payment Fix

## Part A — Rent Card Payment Bug (root cause)

In `supabase/functions/_shared/finalize-payment.ts` (line ~797), rent cards are only created if `escrow_transaction_id` returns no existing rows. If a webhook fires before the redirect (or vice versa), or if `finalize-payment` is invoked with the wrong `escrow.id` linkage, the insert silently no-ops — no receipt row is generated and no cards appear.

### Fixes
1. **Idempotent rent card provisioning**: wrap card insert + receipt insert + escrow status flip in a single Postgres function (`provision_rent_cards(escrow_id, user_id, quantity, amount)`) with a unique constraint on `rent_cards.escrow_transaction_id + card_index` so duplicate webhooks are safe.
2. **Always insert a receipt row** for `rent_card`/`rent_card_bulk` finalize paths (currently only conditional).
3. **Stale-pending sweeper**: cron edge function `sweep-pending-payments` that re-runs Paystack `verify` for any `escrow_transactions` stuck in `pending` >10 min and replays `finalize-payment`.
4. **Backfill**: scan last 30 days of `escrow_transactions` where `payment_type IN (rent_card,rent_card_bulk)` and `status='success'` but `rent_cards` count = 0 → auto-repair.

## Part B — User Issue Reports

### Schema (`issue_reports`)
- `reporter_user_id`, `reporter_role` (tenant/landlord/student/nugs)
- `issue_type` enum: `payment_not_updated`, `receipt_missing`, `rent_card_missing`, `complaint_payment_missing`, `agreement_missing`, `wrong_dashboard_status`, `other`
- `affected_service` enum: `rent_card`, `complaint`, `agreement`, `receipt`, `tenancy`, `dashboard`, `other`
- `reference_code` (optional — TKT, registration_code, serial, escrow ref)
- `description`, `evidence_urls[]` (Storage bucket `issue-evidence`, private)
- `contact_phone`, `contact_email` (prefilled from profile)
- `status`: `open`, `under_review`, `awaiting_user`, `resolved`, `rejected`
- `assigned_admin_id`, `resolution_summary`, `resolved_at`

### Schema (`issue_correction_log`)
- `issue_id`, `admin_user_id`, `correction_type`, `target_table`, `target_id`, `before_state` jsonb, `after_state` jsonb, `reason`, `evidence_url`, `created_at`. Immutable (no UPDATE/DELETE policy).

### Schema (`issue_messages`)
- `issue_id`, `sender_user_id`, `sender_role` (user/admin), `body`, `attachment_url`, `created_at` — for the back-and-forth thread.

### RLS
- Users: insert + select **own** reports/messages.
- Super Admin (`is_super_admin(auth.uid())`): full read/write on all three tables.
- Main Admins: read-only on reports list (no corrections).

## Part C — Report-an-Issue UI

### Reusable component `ReportIssueDialog.tsx`
Opened from a "Report an Issue" entry on Tenant, Landlord, Student dashboards (and FloatingActionHub). Steps:
1. Pick issue type (cards).
2. Pick affected service (auto-narrowed by issue type).
3. Reference code field (autocomplete from user's recent rent cards / complaints / agreements / receipts).
4. Description + screenshot upload (`issue-evidence` bucket, max 3 files, 5 MB each).
5. Confirm contact phone/email; submit.

User gets a toast + email/SMS with ticket ID `ISS-YYYYMMDD-00001` and can track in **My Reports** page per role.

## Part D — Super Admin Resolution Centre

New route: `/regulator/resolution-centre` (Super Admin only, hidden from other admins).

### List view
Filters: status, issue_type, service, role, date. Columns: ticket, user, type, service, status, age, last activity.

### Detail panel
- Reporter info card (name, role, phone with click-to-call, email).
- Original report + evidence gallery (signed URLs).
- Threaded `issue_messages` (admin ↔ user) with attachment support.
- **Verification widget** — auto-fetches related record:
  - Rent card: lists cards by user, escrow tx status, paystack verify button.
  - Complaint: shows complaint row, payment status.
  - Agreement: shows tenancy row + PDFs.
  - Receipt: lists receipts for user/reference.
  - Dashboard: snapshot of computed statuses.
- **Correction tools** (service-specific buttons, each opens `AdminPasswordConfirm`):
  - Rent card → "Provision missing cards" (calls `provision_rent_cards`), "Restore card status", "Reassign serial".
  - Complaint → "Mark payment confirmed", "Refund fee", "Reassign office".
  - Agreement → "Restart agreement flow", "Regenerate PDF", "Force link tenant".
  - Receipt → "Regenerate receipt PDF", "Attach existing receipt".
  - Dashboard/Other → "Recompute compliance score", "Refresh denormalised totals", free-form note.
- Every correction click writes to `issue_correction_log` with before/after JSONB snapshots and a mandatory reason + admin password.

### Edge functions
- `resolution-correction` (Super Admin only, JWT-verified, password re-check) — dispatches to correction handlers, writes log, sends user notification.
- `provision-rent-cards-repair` — idempotent backfill used by the rent-card correction button.

## Part E — Notifications & Audit

- User receives in-app notification + SMS whenever issue status changes or admin replies.
- All corrections appear in existing **Admin Activity Logs** with `action_type = 'resolution_correction'`.
- Super Admin dashboard tile: "Open issues", "Avg resolution time", "Corrections this week".

## Technical notes

- Storage bucket `issue-evidence` (private) with RLS: owner can upload to `{user_id}/*`; Super Admin can read all.
- Use `react-hook-form` + `zod` for the report dialog (matches existing patterns).
- All Super Admin correction edge functions must `require_super_admin(req)` helper (extract from JWT, check `is_super_admin`).
- Rate-limit user submissions to 5/hour per user.

## Acceptance checks

1. User submits a "rent card missing" report with screenshot → ticket appears in Resolution Centre within seconds.
2. Super Admin clicks "Provision missing cards" → cards appear on landlord dashboard, receipt is generated, correction log row written, user gets notification.
3. Re-clicking "Provision missing cards" does nothing (idempotent).
4. Non-Super-Admin staff cannot see `/regulator/resolution-centre` and cannot call correction endpoints (403).
5. Sweeper cron repairs a known stuck rent-card payment without manual intervention.
