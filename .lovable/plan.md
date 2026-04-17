

## Complaint Filing Flow Overhaul — Plan

### Blast radius

**Tables (schema)**:
- `complaints` — add `office_id` (FK → offices, **nullable initially** for backfill, then enforced for new rows via app-layer + check), `ticket_number` (unique, auto), `complaint_type_id` (FK → complaint type config), `payment_status` (`awaiting`|`pending`|`paid`), `receipt_id` (FK → payment_receipts), and **expand `status` enum-by-convention** to include `awaiting_payment`, `pending_payment`, `ready_for_scheduling`, `scheduled` (status is `text`, no enum constraint to alter — safe).
- `landlord_complaints` — same additions for parity (landlord portal also files complaints).
- New table `complaint_types` — Engine Room–managed list with `id`, `key`, `label`, `fee_mode` (`fixed`|`percentage`|`rent_band`), `fee_amount`, `fee_percentage`, `rent_band_config` (jsonb), `active`, `display_order`. Seeded with the existing complaint types from current code.
- New sequence `complaint_ticket_seq` + DB function `generate_complaint_ticket()` returning `TKT-YYYYMMDD-NNNNN`.

**Tables (read-only, no change)**: `offices`, `payment_receipts`, `escrow_*`, `user_roles`, `feature_flags`, `secondary_split_configurations`.

**Backfill plan for non-null `office_id`**:
1. Add column nullable.
2. Backfill existing rows using `resolve_office_id(region)` SQL function (already exists).
3. Backfill `ticket_number` for existing rows: `'TKT-LEGACY-' || left(id::text,8)`.
4. Backfill `payment_status='paid'` for any complaint already in `escrow_transactions` with `status='completed'`; else `'awaiting'`.
5. Backfill `complaint_type_id` from `complaint_type` text → `complaint_types.key` lookup where possible.
6. Add `NOT NULL` on `office_id` and `ticket_number` only after backfill verifies zero nulls.
7. Add unique index on `ticket_number`.

No RLS changes (rule: don't touch RLS). New `complaint_types` table gets RLS: read = all authenticated, write = `is_main_admin()`.

**Frontend portals affected**:
- Tenant → `FileComplaint.tsx` (remove fee step, add Region → Office cascade as Step 1, mandatory office), `MyCases.tsx` (show ticket number, show "Awaiting Payment" / "Pay Now" CTA for `pending_payment` rows that have an `outstanding_amount` set by admin)
- Landlord → `LandlordComplaints.tsx` (same form changes if it has a file flow — confirm during read; if it's only a list, only update the list view)
- Regulator → `RegulatorComplaints.tsx` (admin selects `complaint_type` from dropdown bound to `complaint_types`; "Request Payment" button → writes `complaint_type_id`, computes fee from Engine Room, sets `status='pending_payment'`, `payment_status='pending'`, persists `outstanding_amount`)
- Super Admin → `EngineRoom.tsx` add a new **Complaint Types** tab to CRUD `complaint_types`.

**Edge functions edited**:
- `paystack-checkout` (or wherever complaint payments init) — accept `complaint_id` + read `outstanding_amount` from row instead of client-supplied amount.
- `_shared/finalize-payment.ts` — on `payment_type='complaint_fee'`, after receipt creation: set `complaints.payment_status='paid'`, `complaints.status='ready_for_scheduling'`, `complaints.receipt_id=<new receipt id>`. Keep existing escrow/split logic untouched.
- `paystack-webhook/index.ts` — no logic change (it already calls `finalize-payment`); inherits the complaint update.

**Realtime**: Tenant `MyCases` subscribes to `postgres_changes` on `complaints` filtered by `tenant_user_id` so the "Pay Now" CTA appears the instant admin requests payment. Admin `RegulatorComplaints` subscribes similarly so the paid badge appears on payment confirmation. Requires `ALTER PUBLICATION supabase_realtime ADD TABLE complaints;`.

### Status state machine
```
submitted (tenant files, no fee)
  → awaiting_payment (auto on insert, since no admin action yet)
  → [admin selects type + clicks Request Payment]
  → pending_payment (payment_status=pending, outstanding_amount set)
  → [user pays, webhook → finalize-payment]
  → ready_for_scheduling (payment_status=paid, receipt_id set)
  → scheduled (admin offers slots — existing AppointmentSlotPicker flow)
  → resolved | closed (existing)
```
Note: `submitted` and `awaiting_payment` are functionally equivalent for new complaints; new inserts go straight to `awaiting_payment`. Keep `submitted` only for back-compat reads.

### Fee computation rules (admin "Request Payment" handler)
- `fee_mode='fixed'` → `outstanding_amount = complaint_types.fee_amount`
- `fee_mode='percentage'` → requires linked tenancy: `outstanding_amount = tenancy.monthly_rent * complaint_types.fee_percentage / 100`. If no tenancy, fall back to fixed admin-entered override.
- `fee_mode='rent_band'` → `rent_band_config` shaped as `[{ min, max, fee }, ...]`, evaluated against tenancy's `monthly_rent`. Same fallback as percentage.
- Admin gets an **Override Amount** numeric input that wins over computed fee and is logged to `admin_audit_log`.

### Build sequence

**Step 1 — Migration (tool call alone, await approval)**:
- Create `complaint_types` table + seed (Illegal eviction, Rent overcharge, Property condition, Harassment, Lease violation, Side payment, Other) with `fee_mode='fixed'` defaults pulled from current Engine Room fee for `complaint_filing_fee`.
- Create `complaint_ticket_seq` + `generate_complaint_ticket()` function.
- Add nullable columns to `complaints` and `landlord_complaints`: `office_id uuid references offices`, `ticket_number text`, `complaint_type_id uuid references complaint_types`, `payment_status text default 'awaiting' check (...)`, `receipt_id uuid references payment_receipts`, `outstanding_amount numeric`.
- Backfill (UPDATE statements above).
- Apply `NOT NULL` and `UNIQUE` constraints after backfill checks (`DO $$ ... ASSERT ... $$`).
- Index: `(office_id)`, `(payment_status)`, `(complaint_type_id)`, unique `(ticket_number)`.
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints, public.landlord_complaints;`.
- RLS for `complaint_types`: SELECT to authenticated, INSERT/UPDATE/DELETE to `is_main_admin(auth.uid())`.

**Step 2 — Code changes (one batched ship)**:
1. `FileComplaint.tsx` — remove fee step (current step shows Paystack handoff); replace with Region → Office cascade (offices fetched filtered by region). Office select required to enable Submit. Insert row with `payment_status='awaiting'`, `status='awaiting_payment'`, `office_id`, `ticket_number = await rpc('generate_complaint_ticket')`. No Paystack call here.
2. `LandlordComplaints.tsx` file-form (if exists) — mirror.
3. `RegulatorComplaints.tsx` — add **Set Type & Request Payment** modal: dropdown from `complaint_types`, computed fee preview, optional override, button writes `complaint_type_id`, `outstanding_amount`, `payment_status='pending'`, `status='pending_payment'`. Show ticket number column. Show paid receipt link when `receipt_id` set. Add realtime subscription.
4. `MyCases.tsx` — show ticket number; render "Pay Now" CTA for `pending_payment` rows pointing to existing Paystack checkout with `payment_type='complaint_fee'` and the row's `outstanding_amount`. Add realtime subscription.
5. `_shared/finalize-payment.ts` — branch: when `payment_type === 'complaint_fee'`, after the existing receipt + escrow flow, `UPDATE complaints SET payment_status='paid', status='ready_for_scheduling', receipt_id=<id> WHERE id=metadata.complaint_id`.
6. `paystack-checkout/index.ts` — when `payment_type='complaint_fee'`, read `outstanding_amount` from `complaints` row (server-side trusted), refuse client-supplied amount.
7. `EngineRoom.tsx` — new **Complaint Types** tab with CRUD UI.
8. Status label maps in all three portals updated for new states.

**Step 3 — Verification**:
- All existing complaints have non-null `office_id` and `ticket_number` after migration.
- `SELECT count(*) FROM complaints WHERE office_id IS NULL` → 0.
- File a new complaint as tenant → row appears in admin queue with `awaiting_payment` and ticket number, no payment attempted.
- Admin requests payment → tenant dashboard shows Pay Now within ~1s (realtime).
- Tenant pays → webhook fires → admin sees "Paid" + receipt within ~1s.
- `payout_transfers` and existing escrow flow untouched (count unchanged for non-complaint flows).

### Acceptance criteria
- Complaint filing form has zero fee selection and zero Paystack handoff.
- Region → Office is a cascading required pair; no submission possible without an office.
- Every complaint row has `office_id`, `ticket_number`, `payment_status`, `status` populated.
- Admin can pick a type from Engine Room–managed list and trigger a payment request that writes to the row, not to Paystack directly.
- Tenant Pay Now button only appears once admin has requested payment.
- Webhook → finalize-payment automatically marks complaint paid + receipt linked + status advances to `ready_for_scheduling`.
- No RLS, has_role, is_main_admin, or payment-pipeline modifications.
- Existing data preserved.

### Open questions (lock these before I run the migration)
- **Q1 — Engine Room fee source**: should the new `complaint_types` table fully replace the existing `feature_flags.complaint_filing_fee` flag, or coexist (legacy fallback)? Recommended: keep the flag as a global default, but `complaint_types.fee_amount` always wins when set.
- **Q2 — Per-office fee overrides**: do different offices charge different fees for the same complaint type? If yes, fee config needs `office_id` overlay; if no (recommended), fee is global per type.
- **Q3 — Landlord complaints (`landlord_complaints` table)**: confirm the same office-required + admin-initiated-fee flow applies, or is this tenant-only? Plan assumes mirror; will skip if you say tenant-only.
- **Q4 — Override amounts**: should admin override require a reason that's logged to `admin_audit_log`? Recommended yes.

Approve and I'll run the migration first (single tool call), then ship all code in one batch.

