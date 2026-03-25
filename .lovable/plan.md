

# Escrow, Revenue & Case-Based Office Mapping

## Overview

Introduce a **Cases** table as the central coordination point for all platform activity. Every paid action and every complaint creates or attaches to a Case. Each Case is mapped to an office (derived from property location). The internal ledger tracks allocations per office even though all money flows through one Paystack account. Dashboards support national vs office-level views.

---

## Database Changes (3 migrations)

### Migration 1: `offices` table + `cases` table

```sql
-- Offices reference table
CREATE TABLE public.offices (
  id text PRIMARY KEY,
  name text NOT NULL,
  region text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
-- Populate from GHANA_OFFICES list (68 offices)
INSERT INTO public.offices (id, name, region) VALUES
  ('accra_central', 'Accra Central Office', 'Greater Accra'),
  ('accra_north', 'Accra North Office', 'Greater Accra'),
  ... (all 68 offices);

-- Cases table
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL UNIQUE,
  office_id text NOT NULL REFERENCES public.offices(id),
  user_id uuid NOT NULL,
  case_type text NOT NULL, -- registration, tenancy, complaint, rent_card, listing, viewing, termination, renewal
  related_property_id uuid,
  related_tenancy_id uuid,
  related_complaint_id uuid,
  status text NOT NULL DEFAULT 'open',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
-- RLS: users read own, regulators read all, service_role manages all
```

### Migration 2: Add `office_id` and `case_id` to existing tables

```sql
ALTER TABLE public.escrow_transactions ADD COLUMN office_id text REFERENCES public.offices(id);
ALTER TABLE public.escrow_transactions ADD COLUMN case_id uuid;
ALTER TABLE public.escrow_splits ADD COLUMN office_id text;
ALTER TABLE public.payment_receipts ADD COLUMN office_id text;
ALTER TABLE public.complaints ADD COLUMN office_id text;
ALTER TABLE public.landlord_complaints ADD COLUMN office_id text;
ALTER TABLE public.tenancies ADD COLUMN office_id text;
ALTER TABLE public.properties ADD COLUMN office_id text;
```

### Migration 3: Case number sequence + office resolver function

```sql
CREATE SEQUENCE case_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN 'CASE-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('case_number_seq')::text, 5, '0');
END;
$$;

-- Function to resolve office from property region/area
CREATE OR REPLACE FUNCTION public.resolve_office_id(p_region text, p_area text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  resolved text;
BEGIN
  -- Try exact area match first
  IF p_area IS NOT NULL THEN
    SELECT id INTO resolved FROM offices
    WHERE lower(replace(name, ' Office', '')) = lower(p_area)
    LIMIT 1;
    IF resolved IS NOT NULL THEN RETURN resolved; END IF;
  END IF;
  -- Fallback to region-based match
  SELECT id INTO resolved FROM offices
  WHERE lower(region) = lower(p_region)
  LIMIT 1;
  RETURN COALESCE(resolved, 'accra_central'); -- default fallback
END;
$$;
```

---

## Split Logic Update: Platform Fee Isolation

### Rule
- **10 GHS** is always extracted first as a fixed platform fee from any registration payment
- The remainder is split by configured percentages for IGF, admin, platform

### Example: Landlord registration = 30 GHS
1. Platform fixed fee: 10 GHS → `platform`
2. Remaining 20 GHS split by percentages (e.g., 65% IGF, 25% admin, 10% platform):
   - IGF (rent_control): 13 GHS
   - Admin: 5 GHS
   - Platform: 2 GHS

### Implementation
- Update `paystack-checkout/index.ts`: New split calculation function that isolates 10 GHS platform fee first, then applies percentage splits on remainder
- Update `paystack-webhook/index.ts`: Use split plan from escrow metadata (already stored), add `office_id` to splits
- Add `gra` as a new recipient type for future GRA allocations

---

## Case Creation Flow

### Where cases are created (in `paystack-checkout/index.ts`):

Before initializing Paystack, the backend:
1. Resolves the office from the property (for tenancy/listing/viewing) or user's region (for registration)
2. Creates a Case record with `case_number`, `office_id`, `case_type`
3. Stores `case_id` and `office_id` in the escrow transaction metadata
4. Passes `case_id` and `office_id` to Paystack metadata

### For complaints (no payment):
- Case is created when complaint is submitted (in `FileComplaint.tsx` / `LandlordComplaints.tsx`)
- Office resolved from complaint's `region` field

### Office resolution priority:
1. Property → property.area/region → office
2. Complaint → complaint.region → office
3. Registration → user's `delivery_region` from profiles → office
4. Fallback → `accra_central`

---

## Dashboard Changes

### National Dashboard (Main Admin)
- **RegulatorDashboard.tsx**: Add office dropdown filter at top. Default = "All Offices (National)". When an office is selected, all queries filter by `office_id`
- **EscrowDashboard.tsx**: Add office dropdown. Show total collected + internal balances per office. Add "Office Breakdown" table showing revenue per office

### Office Dashboard (Sub Admin)
- Automatically filters everything by `admin_staff.office_id`
- Sub admins see only their office's cases, transactions, complaints, tenancies

### New sections on EscrowDashboard:
- **Allocation Summary**: Platform Fixed Fee | IGF | Admin | GRA | Landlord (Held) — per office
- **Office Revenue Table**: Rows = offices, Columns = total collected, IGF share, admin share, platform share
- **Actual vs Internal**: "Total Collected (Paystack)" vs "Internal Allocations" comparison

---

## Engine Room Integration

### New feature flags:
- `case_management` — Enable/disable case-based tracking
- `office_escrow_view` — Allow office-level escrow visibility

### Invite Staff update:
- Add "escrow" to `FEATURE_ROUTE_MAP` (already exists)
- When inviting sub_admin with "escrow" in allowed_features, they see only their office's financial data

---

## Files Changed

| Area | Files |
|---|---|
| Database | 3 migrations: offices + cases tables, alter existing tables, functions |
| Backend | `paystack-checkout/index.ts` — case creation + split logic rewrite |
| Backend | `paystack-webhook/index.ts` — persist office_id on splits/receipts |
| Frontend | `EscrowDashboard.tsx` — office filter, allocation breakdown, office revenue table |
| Frontend | `RegulatorDashboard.tsx` — office filter dropdown |
| Frontend | `useAdminProfile.ts` — move GHANA_OFFICES to use DB `offices` table (or keep static for now) |
| Frontend | `EngineRoom.tsx` — new feature flags |
| Frontend | `FileComplaint.tsx` — create case on complaint submit |

### Key architectural decisions:
- Single Paystack account stays — only the internal ledger changes
- Cases are the universal join point for all activity
- Office is derived from property/region, never manually entered by users
- 10 GHS platform fee is always isolated before percentage splits
- `offices` table matches existing `GHANA_OFFICES` constant

