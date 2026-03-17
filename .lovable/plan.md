

# Phase 3: Termination + Compliance

## Overview

Implement tenancy termination workflows, tenant dispute/mediation flows, side-payment declaration, compliance score engine, and expiry lock — completing the lifecycle management system.

---

## 1. Database Migration

```sql
-- Termination applications table
CREATE TABLE public.termination_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL,
  applicant_user_id uuid NOT NULL,
  applicant_role text NOT NULL, -- 'tenant' or 'landlord'
  reason text NOT NULL,
  description text,
  evidence_urls text[] DEFAULT '{}',
  audio_url text,
  status text NOT NULL DEFAULT 'pending',
  -- 'pending', 'under_review', 'mediation', 'approved', 'rejected'
  reviewer_user_id uuid,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Side-payment declarations (tenant reports illegal charges)
CREATE TABLE public.side_payment_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL,
  declared_by uuid NOT NULL,
  amount numeric NOT NULL,
  payment_type text NOT NULL, -- 'key_money', 'goodwill', 'extra_advance', 'other'
  description text,
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'reported',
  -- 'reported', 'under_investigation', 'confirmed', 'dismissed'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for both tables + compliance_score update trigger
```

## 2. Termination Application Pages

**`src/pages/tenant/TerminationRequest.tsx`** (new) — Tenant submits termination request with reason, description, evidence images, optional audio. Only available for active/renewal_window tenancies.

**`src/pages/landlord/TerminationRequest.tsx`** (new) — Landlord submits ejection application with reason (non-payment, breach, personal use), evidence. Routes through regulator review.

**`src/pages/regulator/RegulatorTerminations.tsx`** (new) — Regulator reviews termination applications. Actions: approve (sets tenancy to `terminated`), reject, or escalate to mediation.

## 3. Side-Payment Declaration

**`src/pages/tenant/ReportSidePayment.tsx`** (new) — Tenant declares illegal side payments (key money, goodwill fees, extra advance beyond 6 months). Uploads evidence. Creates record in `side_payment_declarations` and reduces landlord's `compliance_score`.

## 4. Compliance Score Engine

**Database trigger** on `illegal_payment_attempts`, `side_payment_declarations`, and `termination_applications`:
- Each confirmed illegal payment attempt: -10 points
- Each confirmed side-payment: -15 points
- Approved termination due to landlord fault: -20 points
- Score floors at 0, caps at 100

Update `landlords.compliance_score` via a database function `recalculate_compliance_score(landlord_user_id)`.

## 5. Expiry Lock

**Update `tenancy-expiry-check` Edge Function**:
- Tenancies past `end_date` with no renewal: auto-set status to `expired`
- Unit status reverts to `vacant`
- Notification to both parties: "Tenancy has expired. The unit is now unlocked."

## 6. Regulator Dashboard Updates

**`RegulatorDashboard.tsx`**: Add stat cards for termination applications and side-payment reports.

**`RegulatorAgreements.tsx`**: Add `terminated` and renewal pipeline status filters.

## 7. Navigation & Routing

| Route | Layout | Page |
|-------|--------|------|
| `/tenant/termination` | Tenant | TerminationRequest |
| `/tenant/report-side-payment` | Tenant | ReportSidePayment |
| `/landlord/termination` | Landlord | TerminationRequest (landlord version) |
| `/regulator/terminations` | Regulator | RegulatorTerminations |

Add nav items to `TenantLayout`, `LandlordLayout`, `RegulatorLayout`.

---

## Files Summary

| File | Action |
|------|--------|
| DB migration | Create `termination_applications`, `side_payment_declarations`; add RLS; create `recalculate_compliance_score` function + trigger |
| `src/pages/tenant/TerminationRequest.tsx` | Create — tenant termination request form |
| `src/pages/tenant/ReportSidePayment.tsx` | Create — side-payment declaration form |
| `src/pages/landlord/TerminationRequest.tsx` | Create — landlord ejection application |
| `src/pages/regulator/RegulatorTerminations.tsx` | Create — regulator termination review |
| `src/components/TenantLayout.tsx` | Edit — add Termination + Report Side Payment nav |
| `src/components/LandlordLayout.tsx` | Edit — add Termination nav |
| `src/components/RegulatorLayout.tsx` | Edit — add Terminations nav |
| `src/App.tsx` | Edit — add 4 new routes |
| `src/pages/regulator/RegulatorDashboard.tsx` | Edit — add termination + side-payment stats |
| `supabase/functions/tenancy-expiry-check/index.ts` | Edit — add auto-expire + unit vacancy logic |

