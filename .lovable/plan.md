

## Engine Room — Complaint Fee Architecture Overhaul

### Blast radius

**DB schema (migration)**:
- `complaint_types` — restructure: replace `fee_mode`/`fee_amount`/`fee_percentage`/`rent_band_config` with new `fee_structure` ('fixed'|'rent_band'|'percentage'), add `requires_property_link bool`. **Preserve existing rows** (illegal_eviction, rent_overcharge, etc.) by mapping `fee_mode='fixed'` → `fee_structure='fixed'`, etc. Then append the 18 new official types.
- `complaint_fee_fixed` (new): `complaint_type_id` UNIQUE FK, `fee_amount`, `igf_pct`, `admin_pct`, `platform_pct` (CHECK sum = 100).
- `complaint_fee_bands` (new): `complaint_type_id` FK, `band_label`, `rent_min`, `rent_max` (nullable = no cap), `fee_amount`, `igf_pct`, `admin_pct`, `platform_pct` (CHECK sum = 100), `display_order`. Index on `(complaint_type_id, rent_min)`.
- `complaint_fee_percentage` (new): `complaint_type_id` UNIQUE FK, `base_source` ('monthly_rent'|'claim_amount'), `threshold_amount`, `below_threshold_pct`, `above_threshold_pct`, `igf_pct`, `admin_pct`, `platform_pct` (CHECK sum = 100).
- `complaints` / `landlord_complaints` — add `linked_property_id` UUID FK (nullable; required only when `requires_property_link=true`), `claim_amount` numeric (for percentage types based on claim).
- RLS: read = authenticated, write = `is_main_admin()` (mirrors existing `complaint_types`).

**Seed data** (idempotent UPSERT keyed on `name`):
- 13 Fixed types (Filing Against Absconded Tenant, Authority to Force Open Door, Referral to Rent Magistrate, Absconding Writ, Filing Notice of Appeal, Extension of Time – Residential, Extension of Time – Commercial, Filing Letter to be Absent from Hearing, Witness Summons, Inspection, Filing Document (General), Archive Search, Swearing Affidavit / Statutory Declaration) — each with `fee_amount=0` placeholder + `igf=70 / admin=20 / platform=10` defaults (Super Admin to update).
- 2 Rent-band types (Filing of Complaint, Counterclaim) with `requires_property_link=true`, each pre-seeded with the 4 bands (0–200, 201–1000, 1001–2000, 2001+) and default fee 0 + same default split.
- 3 Percentage types (Appeal Against Assessment [base=monthly_rent, threshold=500, below=50%, above=100%], Payment Into Office [base=claim_amount, threshold=500, below=5%, above=10%], Withdrawal of Money [base=claim_amount, threshold=500, below=1%, above=0.26%]).
- Mark legacy `complaint_types` rows (illegal_eviction etc.) `active=false` so they disappear from new dropdown but stay queryable for back-compat on old complaint records.

**Code**:
- `src/lib/complaintFees.ts` (new) — pure helper: `computeComplaintFee(type, ctx)` returning `{ amount, splits: { igf, admin, platform }, bandLabel? }`. Handles all 3 structures + property-link guard.
- `src/components/ComplaintTypesManager.tsx` — full rewrite as **3 tabs** (Fixed / Rent Band / Percentage). Each tab lists types with inline edit for fee + split %s and band CRUD for rent_band tab. Live "splits must sum to 100" validation.
- `src/components/RequestComplaintPaymentDialog.tsx` — refactor to use `computeComplaintFee`, fetch linked property's `monthly_rent` for rent_band/percentage types, block submit with "This complaint type requires a linked property" if missing. Accept new optional `claimAmount` input for `Payment Into Office` / `Withdrawal of Money`.
- `src/pages/regulator/RegulatorComplaints.tsx` — pass linked property + claim amount inputs to dialog. Add "Set Type & Request Payment" button (final wiring from previous batch).
- `src/pages/tenant/FileComplaint.tsx` — add **optional** "Link a property" picker (tenancies for tenants) so rent-band types can be processed later by admin. Non-blocking at file time.
- `src/pages/regulator/EngineRoom.tsx` — inject `<ComplaintTypesManager />` as a new section (gated by `isMainAdmin`), and **remove the legacy `complaint_filing_fee` feature_flag row** from the fee list rendered there (but keep flag in DB untouched for back-compat — just hide).
- `paystack-checkout/index.ts` — already reads trusted `outstanding_amount`, no change needed. Splits applied via `loadAllocation` already trust admin-set figures.
- `_shared/finalize-payment.ts` — already updates complaint to paid + ready_for_scheduling, no change.

**Out of scope (do not touch)**:
- Certificate of Assessed Rent (lives in rent/assessment logic).
- Existing `feature_flags.complaint_filing_fee` row (left dormant; UI hides it).
- `escrow_splits` engine — existing `secondary_split_configurations` flow handles `complaint_fee` `payment_type`. Per-type splits are stored on the new tables; admin "Request Payment" will write them into `escrow_splits` via existing pipeline OR we override `loadAllocation` for `complaint_fee` to read from the new tables (decided in Q1 below).

### Status state machine, RLS, payment pipeline
Unchanged from previous batch. New tables only add fee config — no change to ledger posting, webhook, or payout flow.

### Build sequence
**Step 1 — Migration (single tool call, await approval)**:
1. CREATE the 3 new tables + RLS + indexes + CHECK constraints.
2. ALTER `complaint_types`: add `fee_structure`, `requires_property_link`. Backfill `fee_structure` from existing `fee_mode`. (Do NOT drop legacy columns yet — keep until code switches over fully; we'll drop in a follow-up.)
3. ALTER `complaints` + `landlord_complaints`: add `linked_property_id`, `claim_amount`.
4. UPSERT seed data for the 18 new official types + their fee rows.
5. Set `active=false` on legacy types (illegal_eviction, rent_overcharge, property_condition, harassment, lease_violation, side_payment, other).

**Step 2 — Code (parallel batch)**:
- New `complaintFees.ts` helper.
- Rewritten `ComplaintTypesManager.tsx`.
- Updated `RequestComplaintPaymentDialog.tsx`.
- `RegulatorComplaints.tsx` — wire dialog + add property/claim inputs; finish "Set Type & Request Payment" button placement deferred from previous batch.
- `EngineRoom.tsx` — inject manager section + hide legacy `complaint_filing_fee` flag from the fee table.
- `FileComplaint.tsx` — optional property linker (tenant's active tenancies dropdown).

**Step 3 — Verification**:
- All 18 new types appear in admin dropdown grouped by structure.
- Editing a fixed type's split that doesn't sum to 100 is rejected client + DB.
- Picking a rent-band type with no linked property shows the blocking error.
- Picking "Payment Into Office" with `claim_amount=300` computes `fee = 300 × 5% = 15` (below threshold).
- Picking "Appeal Against Assessment" on a property with `monthly_rent=600` computes `fee = 600 × 100% = 600`.
- Existing paid complaints still render correctly (legacy types stay readable via inactive rows).

### Acceptance criteria
- Engine Room shows all 18 official complaint types in 3 grouped sections; legacy generic complaint fee no longer visible.
- Each type has editable fee + split with sum=100 validation.
- Admin dropdown for "Set Type & Request Payment" pulls only `active=true` types.
- Rent-band types compute the correct band from the linked property's `monthly_rent` automatically (no manual band picker for admin).
- Percentage types compute fee from monthly_rent or claim_amount per their `base_source`.
- Splits stored per type/band feed `escrow_splits` correctly without altering the payment pipeline.
- No RLS, has_role, is_main_admin, password, or webhook changes.

### Open questions (lock before migration)
- **Q1 — Split routing**: admin-set fees currently flow through `secondary_split_configurations` to determine IGF/Admin/Platform splits. The new architecture stores splits **per complaint type** (and per band). Should we:
  - **(A)** Override `loadAllocation` for `payment_type='complaint_fee'` to read splits from the new tables (cleaner, type-specific), **OR**
  - **(B)** Continue using `secondary_split_configurations` global default and ignore per-type splits (simpler, but config in two places)?
  Recommended: **(A)** — splits live with the fee.
- **Q2 — Linked property requirement at filing**: should the tenant filing form *require* linking a property when the user might later be charged a rent-band fee? Plan says optional at filing (admin can link later). Confirm.
- **Q3 — Claim amount source**: `Payment Into Office` and `Withdrawal of Money` need a claim amount. Should the **complainant** enter this at file time, or the **admin** at payment-request time? Plan assumes admin enters in the dialog.
- **Q4 — Default split percentages for seeded rows**: I'll seed `igf=70 / admin=20 / platform=10` as a placeholder. Replace with your real defaults if different — otherwise Super Admin will edit per-type via the new UI.

Approve and I'll run the migration first (single tool call), then ship all code in one batch.

