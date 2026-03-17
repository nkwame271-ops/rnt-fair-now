

# Phase 1: Schema + Lifecycle Foundations

## Overview

Extend the database and core UI to support the full tenancy lifecycle: expanded statuses, existing tenancy migration, property assessment records, tenancy card data, advance limit enforcement, and compliance scoring. This phase lays the groundwork for Phase 2 (Renewal Workflow) and Phase 3 (Termination + Compliance).

---

## 1. Database Migrations

### Migration 1: Extend `tenancies` table

Add columns to support lifecycle statuses and migration tracking:

```sql
-- New tenancy statuses: active, renewal_window, renewal_pending_assessment,
-- renewal_pending_confirmation, renewal_pending_payment, expired, terminated,
-- existing_declared, awaiting_verification, verified_existing, renewal_pending

ALTER TABLE public.tenancies
  ADD COLUMN IF NOT EXISTS tenancy_type text NOT NULL DEFAULT 'new',
  -- 'new', 'existing_migration', 'renewal'
  ADD COLUMN IF NOT EXISTS previous_tenancy_id uuid,
  ADD COLUMN IF NOT EXISTS renewal_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_requested_by uuid,
  ADD COLUMN IF NOT EXISTS termination_reason text,
  ADD COLUMN IF NOT EXISTS terminated_at timestamptz,
  ADD COLUMN IF NOT EXISTS existing_advance_paid integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS existing_start_date date,
  ADD COLUMN IF NOT EXISTS existing_agreement_url text,
  ADD COLUMN IF NOT EXISTS existing_voice_url text,
  ADD COLUMN IF NOT EXISTS max_lawful_advance numeric GENERATED ALWAYS AS (agreed_rent * 6) STORED,
  ADD COLUMN IF NOT EXISTS compliance_status text NOT NULL DEFAULT 'compliant';
  -- 'compliant', 'non_compliant', 'under_review'
```

The `status` column already exists as text. No enum migration needed — we just use the new values in application logic.

### Migration 2: Create `property_assessments` table

```sql
CREATE TABLE public.property_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  inspector_user_id uuid,
  photos text[] DEFAULT '{}',
  gps_location text,
  amenities jsonb DEFAULT '{}',
  property_condition text,
  recommended_rent numeric,
  approved_rent numeric,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
  -- 'pending', 'in_progress', 'completed', 'approved'
);

ALTER TABLE public.property_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators manage assessments" ON public.property_assessments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'regulator'))
  WITH CHECK (has_role(auth.uid(), 'regulator'));

CREATE POLICY "Landlords read own property assessments" ON public.property_assessments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = property_assessments.property_id
    AND properties.landlord_user_id = auth.uid()
  ));

CREATE POLICY "Tenants read assessments for their tenancies" ON public.property_assessments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tenancies t
    JOIN units u ON u.id = t.unit_id
    WHERE u.property_id = property_assessments.property_id
    AND t.tenant_user_id = auth.uid()
  ));
```

### Migration 3: Create `illegal_payment_attempts` log table

```sql
CREATE TABLE public.illegal_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL,
  user_id uuid NOT NULL,
  attempted_amount numeric NOT NULL,
  max_lawful_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text
);

ALTER TABLE public.illegal_payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read all" ON public.illegal_payment_attempts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'regulator'));

CREATE POLICY "System inserts" ON public.illegal_payment_attempts
  FOR INSERT TO authenticated
  WITH CHECK (true);
```

### Migration 4: Add `compliance_score` to `landlords` table

```sql
ALTER TABLE public.landlords
  ADD COLUMN IF NOT EXISTS compliance_score integer NOT NULL DEFAULT 100;
```

### Migration 5: Add `approved_rent` to `properties` table

```sql
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS approved_rent numeric,
  ADD COLUMN IF NOT EXISTS last_assessment_id uuid;
```

---

## 2. Existing Tenancy Migration Page

**New file**: `src/pages/landlord/DeclareExistingTenancy.tsx`

A multi-step form for landlords to declare pre-platform tenancies:
- Step 1: Select property + unit (same pattern as AddTenant)
- Step 2: Find tenant by ID/name
- Step 3: Enter details — monthly rent, advance already paid (max 6), tenancy start date, expected expiry, optional agreement PDF upload, optional voice message upload
- Step 4: Review and submit

Creates a tenancy record with `tenancy_type = 'existing_migration'` and `status = 'existing_declared'`. Generates a temporary tenancy ID.

**Route**: `/landlord/declare-existing-tenancy`
**Nav item**: Add to LandlordLayout nav.

---

## 3. Tenancy Card Component

**New file**: `src/components/TenancyCard.tsx`

A reusable card component displaying:
- Tenancy ID, Property ID, digital address, landlord name, tenant name
- Monthly rent (approved), max lawful advance (rent × 6), advance paid
- Start date, expiry date, assessment ID, compliance status
- QR code (using a lightweight QR library or inline SVG generator)
- Color-coded status indicator (green/yellow/red)

**PDF download**: Extend `src/lib/generateAgreementPdf.ts` or create `src/lib/generateTenancyCardPdf.ts` using jsPDF to produce a downloadable PDF tenancy card.

---

## 4. Dashboard Tenancy Display Updates

### Tenant Dashboard (`src/pages/tenant/TenantDashboard.tsx`)
- Show tenancy status with color indicators: Green (active), Yellow (renewal_window), Red (expired)
- Display start date, expiry date, days remaining countdown
- Add "Request Renewal" button (disabled until Phase 2, but visible with tooltip)
- Add "Download Tenancy Card" button linking to TenancyCard PDF generation

### Landlord Dashboard (`src/pages/landlord/LandlordDashboard.tsx`)
- Show tenancy status breakdown in stats cards
- Add compliance score display

---

## 5. Advance Limit Enforcement

### Frontend (`src/pages/landlord/AddTenant.tsx`)
- Cap advance months selector at 6 (already done via `maxAdvance` from template config)
- Add explicit validation: if `advanceMonths * monthlyRent > monthlyRent * 6`, block submission with error
- Display "Maximum lawful advance: GH₵ X" prominently

### Backend (`supabase/functions/paystack-checkout/index.ts`)
- In the `rent_tax_bulk` handler, verify total advance does not exceed `agreed_rent * 6`
- If it does, log to `illegal_payment_attempts` and return error
- Same check for single `rent_tax` payments

---

## 6. Property Assessment Integration

### Regulator Properties page (`src/pages/regulator/RegulatorProperties.tsx`)
- Add "Assess Property" button that opens an assessment form dialog
- Assessment form: inspector ID, photo uploads, GPS, amenities checklist, condition dropdown, recommended rent
- On submit, creates `property_assessments` record
- "Approve Assessment" action sets `approved_rent` on properties table and updates `assessment_status` to `assessed`

---

## Files Summary

| File | Action |
|------|--------|
| DB migration | Extend tenancies, properties, landlords; create property_assessments, illegal_payment_attempts |
| `src/pages/landlord/DeclareExistingTenancy.tsx` | Create — existing tenancy migration form |
| `src/components/TenancyCard.tsx` | Create — reusable tenancy card with QR + status |
| `src/lib/generateTenancyCardPdf.ts` | Create — PDF generation for tenancy card |
| `src/pages/tenant/TenantDashboard.tsx` | Edit — status colors, days remaining, download card button |
| `src/pages/landlord/LandlordDashboard.tsx` | Edit — compliance score, tenancy status breakdown |
| `src/pages/landlord/AddTenant.tsx` | Edit — advance limit validation + display |
| `src/pages/regulator/RegulatorProperties.tsx` | Edit — assessment form + approval flow |
| `supabase/functions/paystack-checkout/index.ts` | Edit — advance limit check + illegal attempt logging |
| `src/components/LandlordLayout.tsx` | Edit — add nav item for Declare Existing Tenancy |
| `src/App.tsx` | Edit — add route for declare-existing-tenancy |

