

# Plan: Tax Rate Templates, Engine Room, Property Assessment & Rent Assessment

## 1. Tax Rate Templates (per property type)

**Current state**: The `agreement_template_config` table has a single `tax_rate` column (8%). The `AddTenant.tsx` and `generateAgreementPdf.ts` read this single rate.

**Change**: Replace the single `tax_rate` number with a JSONB column `tax_rates` storing per-property-type rates (e.g. `{ "residential": 8, "commercial": 15 }`). The admin Templates page gets a multi-rate editor. The agreement creation logic (`AddTenant.tsx`) picks the correct rate based on unit type.

**Files affected**:
- **Migration**: Add `tax_rates` JSONB column to `agreement_template_config`, default `{"residential": 8, "commercial": 15}`, migrate existing `tax_rate` value into it
- `RegulatorAgreementTemplates.tsx` — Replace single tax rate input with editable key-value pairs (property type → rate %)
- `AddTenant.tsx` — Look up tax rate by unit type from `tax_rates` JSONB instead of flat `tax_rate`
- `generateAgreementPdf.ts` — Accept resolved tax rate instead of reading flat field
- `agency-api/index.ts` — Update tax endpoints to reflect per-type rates

---

## 2. Engine Room (Feature Control Panel)

**New feature**: A `feature_flags` table and a new admin page where regulators can toggle platform features on/off. Features awaiting Ministry approval can be disabled without code changes.

**Database**:
```sql
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
-- RLS: regulators manage, all authenticated users can read
```

Seed with initial flags: `rent_assessment`, `legal_assistant`, `marketplace`, `kyc_verification`, `complaint_filing`, `rent_checker`, `viewing_requests`.

**Frontend**:
- New page `src/pages/regulator/EngineRoom.tsx` — table of feature flags with toggle switches
- New hook `src/hooks/useFeatureFlag.ts` — fetches flags, caches them, exposes `isEnabled(key)` 
- Wrap gated features (e.g. Legal Assistant, Marketplace) with the hook — show "Coming Soon" if disabled
- Add route `/regulator/engine-room` in `App.tsx`
- Add "Engine Room" nav item with `Settings` icon in `RegulatorLayout.tsx`

---

## 3. Property Assessment Approval (Admin)

**Current state**: `RegulatorProperties.tsx` shows a table/map of properties but has no detail view or approval workflow. Properties have a `property_condition` field but no formal assessment status.

**Database**:
```sql
ALTER TABLE public.properties 
  ADD COLUMN assessment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN assessed_at timestamptz,
  ADD COLUMN assessed_by uuid;
```

**Frontend**:
- Expand `RegulatorProperties.tsx` — add a click-to-expand detail drawer/dialog showing: property images (from `property_images`), all units with amenities, condition, GPS, and an "Approve Assessment" button
- Approved sets `assessment_status = 'approved'` (Fully Assessed / Tenantable)
- Add status badge column to the properties table
- Landlord's `MyProperties.tsx` — show assessment status badge on each property card

---

## 4. Rent Assessment (Rent Increase Application)

**New feature**: When a landlord wants to increase rent on an existing tenancy, they must submit an application. The regulator reviews and approves/rejects it.

**Database**:
```sql
CREATE TABLE public.rent_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL,
  landlord_user_id uuid NOT NULL,
  current_rent numeric NOT NULL,
  proposed_rent numeric NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewer_user_id uuid,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: landlords manage own, regulators read/update all, tenants read own tenancy's assessments
```

**Frontend**:
- Landlord side: Add "Request Rent Increase" button on `Agreements.tsx` or property detail — opens a form (current rent shown, enter proposed rent + reason)
- Regulator side: New page `src/pages/regulator/RegulatorRentAssessments.tsx` — list of pending/reviewed applications with approve/reject actions
- Add route `/regulator/rent-assessments` and nav item "Rent Assessments" in layout
- Gate this feature behind the `rent_assessment` feature flag from Engine Room

---

## Implementation Order

1. **Migration**: `tax_rates` JSONB on `agreement_template_config`, `assessment_status` on `properties`, new `feature_flags` table, new `rent_assessments` table — single migration
2. **Engine Room**: `feature_flags` table seed + `EngineRoom.tsx` page + `useFeatureFlag` hook
3. **Tax Rate Templates**: Update Templates page UI + `AddTenant.tsx` tax lookup
4. **Property Assessment**: Expand `RegulatorProperties.tsx` with detail drawer + approval
5. **Rent Assessment**: New landlord form + regulator review page
6. **Routing & Nav**: Add all new routes and sidebar items

**Files to create**: `EngineRoom.tsx`, `RegulatorRentAssessments.tsx`, `useFeatureFlag.ts`
**Files to modify**: `RegulatorAgreementTemplates.tsx`, `RegulatorProperties.tsx`, `AddTenant.tsx`, `generateAgreementPdf.ts`, `RegulatorLayout.tsx`, `App.tsx`, `MyProperties.tsx`, `Agreements.tsx`

