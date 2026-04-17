

## Plan — Complaint Basket Model + Three-View Complaint System

### Part 1: Complaint Basket Model (Admin Payment Request)

**Current state:** `RequestComplaintPaymentDialog` lets admin pick ONE complaint type, computes ONE fee, sets `complaint_type_id` + `outstanding_amount` on the complaint row. Override replaces the whole total. Splits at payment time use that single type's rule.

**New behaviour:** Admin builds a basket of N items. Each item carries its own type, computed amount, and split percentages snapshot. Total = sum of items. Optional override is a separate "manual_adjustment" line item with its own reason. On payment, splits are computed per line item and posted to the ledger as N separate split sets sharing the same `escrow_transaction_id` but tagged with `complaint_item_id`.

**Schema changes (1 migration):**

1. New table `public.complaint_basket_items`:
   - `id uuid pk`, `complaint_id uuid`, `complaint_table text` (`'complaints'` | `'landlord_complaints'`)
   - `complaint_type_id uuid` (nullable for manual adjustment line)
   - `kind text check in ('fee_rule','manual_adjustment')`
   - `label text` (snapshot of type label, or admin-entered reason)
   - `amount numeric not null`
   - `igf_pct numeric`, `admin_pct numeric`, `platform_pct numeric` (snapshots at request time)
   - `computation_meta jsonb` (rent used, band label, claim amount)
   - `created_by uuid`, `created_at timestamptz default now()`
   - RLS: admins read/write all; complainant SELECT own (joined via parent complaint).
2. Add `basket_total numeric` to `complaints` and `landlord_complaints` (kept in sync via app code; existing `outstanding_amount` mirrors `basket_total` for backward compat).
3. No change to `escrow_splits` schema — we'll add `complaint_basket_item_id uuid nullable` column so each split set is traceable to its line item.

**Edge function changes:**

- `finalize-payment.ts` (shared): when `payment_type` is a complaint payment, instead of reading one `complaint_type_id` rule, read `complaint_basket_items` for the complaint and emit one split set per item using its snapshotted `igf_pct/admin_pct/platform_pct` and `amount`. Stamp `complaint_basket_item_id` on each emitted split. Manual-adjustment items default to 100% admin unless splits were captured at request time.

**UI changes:**

- `src/components/RequestComplaintPaymentDialog.tsx` — rebuild as a basket UI:
  - Top section: basket list with per-line label, amount, splits, remove button.
  - "Add complaint type" picker (existing grouped Select).
  - "Add manual adjustment" button → inline row with label + amount + splits inputs (defaults 0/100/0) + reason.
  - Footer: total = sum of items, splits totals row (IGF / Admin / Platform aggregated).
  - On submit: insert N rows into `complaint_basket_items`, set parent's `outstanding_amount = basket_total`, `payment_status='pending'`, `status='pending_payment'`. Audit log captures the full basket payload.

- Tenant/landlord complaint payment screens: show line-itemised breakdown when paying (read from `complaint_basket_items`). Receipt PDF lists items.

### Part 2: Three Complaint Views (Rent Control) + NUGS Scoping

**Current state:**
- `RegulatorComplaints.tsx` already exists for tenant complaints, `LandlordComplaints` for landlord-side. NUGS has its own `NugsComplaints.tsx` reading the `complaints` table filtered to student rows.
- No tabbed three-view shell.

**Approach (no data duplication):**

- Refactor `src/pages/regulator/RegulatorComplaints.tsx` into a tabbed page with three tabs:
  1. **Landlord Complaints** — reads `landlord_complaints` (current `RegulatorLandlordComplaints` content moves here as a tab body).
  2. **Tenant Complaints** — reads `complaints` WHERE `tenant_user_id` belongs to a non-student tenant (filter via join on `tenants.school IS NULL`).
  3. **Student Complaints** — reads `complaints` WHERE `tenants.school IS NOT NULL`.
- All three tabs share the same row components, ticket numbers (`complaint_code`), and detail drawer. No duplicate records — same tables, just filtered views.
- NUGS portal (`NugsComplaints.tsx`) stays as-is (already RLS-scoped to student complaints), but we'll align its row component and ticket display to match the regulator's Student tab so admins and NUGS see identical ticket/code/status formatting.
- Add deep-link tab state via `?tab=landlord|tenant|student` so command palette and notifications can land on the correct view.

### Files Touched

**Migration (1):**
- New: `complaint_basket_items` table + RLS, add `complaint_basket_item_id` to `escrow_splits`, add `basket_total` to `complaints` and `landlord_complaints`.

**Code:**
- `src/components/RequestComplaintPaymentDialog.tsx` — full rebuild to basket UI.
- `src/lib/complaintFees.ts` — add `BasketItem` type + helper to compute aggregated total/splits.
- `supabase/functions/_shared/finalize-payment.ts` — per-item split emission for complaint payments.
- `src/pages/tenant/MyCases.tsx` (and landlord equivalent) — show line-item breakdown on the pay screen.
- `src/pages/regulator/RegulatorComplaints.tsx` — convert to 3-tab shell; move existing landlord complaints view into a tab.
- `src/pages/regulator/LandlordComplaints.tsx` — extract its body as a reusable component for the tab.
- `src/components/LandlordLayout.tsx` / regulator sidebar — remove standalone "Landlord Complaints" entry (now inside tabbed page) OR keep as deep link to `?tab=landlord`.
- `src/pages/nugs/NugsComplaints.tsx` — minor: align row + ticket display with regulator student tab.

### What Stays Untouched

- RLS on `complaints` / `landlord_complaints`, NUGS scoping policies, ticket-number generator, Paystack flow, escrow_transactions schema, payout_transfers, all other portals, tenancy/rent-card systems.
- Existing single-type complaints already in flight: backfill — for any complaint with `complaint_type_id` set and no basket rows, the finalize function falls back to the legacy single-type path so nothing breaks mid-flight.

### Verification

1. Admin opens a complaint → Set Type & Request Payment → adds 2 fee-rule items + 1 manual adjustment → total = sum, splits aggregated correctly → submits → tenant sees itemised bill → pays → ledger has 3 split sets all linked to the same escrow_transaction with distinct `complaint_basket_item_id`.
2. Reconciliation: `Total Revenue` for that transaction equals sum of split amounts.
3. Rent Control admin opens **Complaints** → sees three tabs; ticket `TKT-...` shown in Student tab matches the same ticket NUGS sees in their portal.
4. NUGS admin still only sees student complaints (RLS unchanged).
5. Override-only flow: admin adds zero fee-rule items + 1 manual adjustment with custom splits → works; audit log records reason.

