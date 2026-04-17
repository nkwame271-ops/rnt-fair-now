

## Plan: Office-Scoped Complaints + Central Receipts + Student Visibility

### Blast radius

**Schema (one migration)**:
- `profiles` — add `user_type text default 'individual' check in ('individual','student','organization')` (additive; only `student` is meaningful for filtering today, others reserved).
- `properties` — extend `property_type` allowed values to include `hostel` and `hall`. The column is text (no enum), so this is enforced at the app layer + a soft check constraint that includes legacy values.
- No RLS changes (rule: don't touch). All office-scoping is enforced **at the query layer**, not RLS — Super/main admins must continue to see everything via existing read policies.

**Frontend (regulator)**:
- New helper `useAdminScope()` (small wrapper over existing `useAdminProfile`) that returns `{ scopeOfficeId, isUnscoped }` — `scopeOfficeId` set when `!isMainAdmin && !isSuperAdmin && profile.officeId`, otherwise null.
- `RegulatorComplaints.tsx` —
  - Add an Office filter dropdown above the tabs. Options: "All Offices" + every office from the existing `GHANA_OFFICES` flat list (or fetch from `offices` table).
  - For scoped staff: dropdown is disabled, locked to their office. Default value = their office.
  - For super/main admin: defaults to "All Offices", freely changeable.
  - Apply the filter to both `fetchComplaints()` and `fetchLandlordComplaints()` using `.eq('office_id', officeId)` when set.
- `RegulatorTenants.tsx` — add a "Students" tab/category filter (`profile.user_type = 'student'`) and a "Student" badge next to student rows.
- `RegulatorProperties.tsx` — add a "Student Housing" filter chip and group header for `property_type in ('hostel','hall')`.
- New page `src/pages/regulator/RegulatorReceipts.tsx`:
  - Joins `payment_receipts` → `escrow_transactions` → active `escrow_splits` (`status='active'`).
  - Searchable by receipt number, ticket number, payer name/email, payment type.
  - Filters: payment type, date range, office (locked for scoped staff, free for unscoped).
  - Each row expands to show splits + Paystack reference; "Download/Print" reuses existing `<PaymentReceipt>` component → already supports browser print.
  - Office scoping: scoped staff → `escrow_transactions.office_id = scopeOfficeId`; super/main admin → all.
- `RegulatorLayout.tsx` — add nav entry "Receipts" gated by `feature='receipts'` OR by being a regulator. Wire route in `App.tsx`.
- `useAdminProfile.ts` — add `'receipts'` to `FEATURE_ROUTE_MAP`.
- Sign-up — out of scope for this prompt (Prompt 1 already handles student registration). This batch only consumes `user_type` for filtering; no sign-up form change.

**Out of scope (do not touch)**:
- RLS, `has_role`, `is_main_admin`, password flows, Paystack pipeline, escrow correction logic.
- Tenant-side or landlord-side receipts page (already exists at `LandlordReceipts.tsx` etc.).
- Student NUGS portal routing (handled separately).
- The 3 `service_role` linter warnings — pre-existing storage bucket policies, untouched.

### Build sequence

**Step 1 — Migration (single tool call, await approval)**:
```sql
-- Add user_type to profiles (default 'individual')
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'individual';

-- Add a permissive check that includes existing/expected values
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_user_type_check
    CHECK (user_type IN ('individual','student','organization'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend property_type allowed values via a soft check
-- (column is text — preserve all current data, just add new accepted values)
DO $$
DECLARE
  v_existing text[];
BEGIN
  SELECT array_agg(DISTINCT property_type) INTO v_existing FROM public.properties WHERE property_type IS NOT NULL;
  -- We won't add a CHECK constraint to avoid breaking legacy rows; values are validated at the app layer.
  RAISE NOTICE 'Existing property_type values: %', v_existing;
END $$;

-- Index for student filter and office scoping
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type) WHERE user_type <> 'individual';
CREATE INDEX IF NOT EXISTS idx_complaints_office_id ON public.complaints(office_id);
CREATE INDEX IF NOT EXISTS idx_landlord_complaints_office_id ON public.landlord_complaints(office_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_office_id ON public.escrow_transactions(office_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_user_id ON public.payment_receipts(user_id);
```

**Step 2 — Code (parallel batch)**:
1. `src/hooks/useAdminScope.ts` — new helper.
2. `src/pages/regulator/RegulatorComplaints.tsx` — add Office filter dropdown + apply scoping to both fetches.
3. `src/pages/regulator/RegulatorTenants.tsx` — add Students filter chip + badge.
4. `src/pages/regulator/RegulatorProperties.tsx` — add Student Housing filter chip + group header.
5. `src/pages/regulator/RegulatorReceipts.tsx` — new page (full receipts module).
6. `src/components/RegulatorLayout.tsx` — add "Receipts" nav link.
7. `src/App.tsx` — register `/regulator/receipts` route.
8. `src/hooks/useAdminProfile.ts` — add `receipts` to `FEATURE_ROUTE_MAP`.

**Step 3 — Verification**:
- Sub-admin assigned to "Tema" office sees only Tema complaints; office dropdown is locked.
- Super admin sees all complaints; office dropdown freely toggles between offices.
- Receipts module returns rows for super admin matching `payment_receipts` count; scoped staff sees subset filtered by their `escrow_transactions.office_id`.
- Filtering by ticket number returns the correct receipt.
- Print button opens browser print preview with full receipt + splits.
- A profile with `user_type='student'` appears under Tenants → Students filter with a Student badge.
- A property with `property_type='hostel'` appears under Properties → Student Housing.

### Acceptance criteria
- Office filter dropdown visible on complaints list for everyone; locked for scoped staff; defaults correctly per role.
- Receipts page accessible at `/regulator/receipts` with search + filters + per-row split breakdown + print.
- Active-only splits (`status='active'`) used in the join (matches escrow correction rules).
- Student tenants visibly labelled under Tenants → Students filter.
- Hostel/hall properties grouped/labelled "Student Housing".
- Zero changes to RLS, `has_role`, `is_main_admin`, password handling, or Paystack pipeline.
- Existing `LandlordReceipts.tsx` and `TenantReceipts` pages untouched.

### Open questions (lock before migration)
- **Q1** — Office source: should the Office filter dropdown options come from the live `offices` DB table (preferred for consistency with newly added offices) or from the static `GHANA_OFFICES` constant in `useAdminProfile.ts`? Recommended: **live `offices` table**.
- **Q2** — Receipts office source: receipts are scoped via `escrow_transactions.office_id`. Some legacy receipts may have `office_id IS NULL` (older transactions). For super admin those still appear; for scoped staff they are hidden. Confirm OK, or should we backfill via `complaints.office_id` for `payment_type='complaint_fee'`?
- **Q3** — Student Housing property types: confirm the only two new values are `hostel` and `hall`. Anything else (e.g., `dormitory`)?
- **Q4** — Where to place the "Receipts" nav item in the regulator sidebar — under "Finance" group (with Escrow / Office Wallet) or as its own top-level entry? Recommended: **under Finance**.

Approve and I'll run the migration first, then ship all code in one parallel batch.

