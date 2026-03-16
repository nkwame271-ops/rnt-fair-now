

# Plan: Landlord Portal Enhancements

## 1. Property Category (Residential / Commercial)

**Database**: Add `property_category text NOT NULL DEFAULT 'residential'` to `properties` table. Values: `'residential'` or `'commercial'`.

**Frontend changes**:
- `RegisterProperty.tsx` — Add a required "Property Category" select (Residential / Commercial) before the units section. Store in state, submit to DB.
- `EditProperty.tsx` — Same selector for editing.
- `MyProperties.tsx` — Show category badge on property cards.
- `AddTenant.tsx` — When resolving tax rate from `tax_rates` JSONB, use the property's `property_category` instead of guessing from unit type.
- `RegulatorProperties.tsx` — Show category in property detail drawer.

---

## 2. Property Status: "Processing" After Registration

**Current state**: Properties get `assessment_status = 'pending'` on creation. Marketplace listing is controlled by `listed_on_marketplace`.

**Change**: After registration, show status as "Processing — Under Assessment" on `MyProperties.tsx`. Property cannot be listed on marketplace until `assessment_status = 'approved'`. The marketplace toggle in `RegisterProperty.tsx` should be removed (properties can only be listed after approval). In `MyProperties.tsx`, disable the "List on Marketplace" button if assessment is not approved, with a tooltip explaining why.

**Files**: `RegisterProperty.tsx`, `MyProperties.tsx`.

---

## 3. Landlord Applications Section

**Database**: Create `landlord_applications` table:
```sql
CREATE TABLE public.landlord_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id uuid NOT NULL,
  application_type text NOT NULL, -- 'rent_increase', 'tenant_ejection', 'regulatory_request', 'other'
  subject text NOT NULL,
  description text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  audio_url text,
  status text NOT NULL DEFAULT 'pending',
  reviewer_user_id uuid,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
RLS: landlords manage own, regulators read/update all.

**Storage**: Create `application-evidence` bucket (public) for images and audio uploads.

**Frontend**:
- New page `src/pages/landlord/LandlordApplications.tsx` — list of submitted applications with status tracking + "New Application" dialog with type selector, description, image upload (multiple), voice recording (MediaRecorder API), and submit.
- Route: `/landlord/applications`
- Nav item in `LandlordLayout.tsx`: "Applications" with `ClipboardList` icon.

**Regulator side**:
- New page `src/pages/regulator/RegulatorApplications.tsx` — list all applications, expand to see text + images + audio player, approve/reject with notes.
- Route: `/regulator/applications`, nav item in `RegulatorLayout.tsx`.

This replaces the existing `rent_assessments` approach with a more general-purpose applications system. The existing rent increase dialog in `Agreements.tsx` will be updated to submit to `landlord_applications` instead.

---

## 4. Rent Increase Evidence (Images + Voice)

Handled by the Applications system above. When application type is `rent_increase`:
- Landlord states reason (text), uploads images of improvements, and optionally records a voice message.
- Admin sees all three (text, image gallery, audio player) in the review panel.

---

## 5. Landlord Complaints

**Database**: Currently `complaints` table is tenant-only (`tenant_user_id`). We need to support landlord complaints too.

**Option**: Create a new `landlord_complaints` table (cleaner than modifying the tenant complaints table):
```sql
CREATE TABLE public.landlord_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id uuid NOT NULL,
  complaint_code text NOT NULL,
  complaint_type text NOT NULL,
  tenant_name text,
  property_address text NOT NULL,
  region text NOT NULL,
  description text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now()
);
```
RLS: landlords manage own, regulators read/update all.

**Frontend**:
- New page `src/pages/landlord/LandlordComplaints.tsx` — complaint form (type, description, document upload) + list of submitted complaints with status.
- Route: `/landlord/complaints`, nav item in `LandlordLayout.tsx`.
- `RegulatorComplaints.tsx` — Add a tab or section to show landlord complaints alongside tenant complaints.

---

## Files Summary

**New files** (6):
- `src/pages/landlord/LandlordApplications.tsx`
- `src/pages/landlord/LandlordComplaints.tsx`
- `src/pages/regulator/RegulatorApplications.tsx`

**Modified files** (8):
- `src/pages/landlord/RegisterProperty.tsx` — Add property category selector, remove marketplace toggle
- `src/pages/landlord/MyProperties.tsx` — Category badge, disable listing if not approved, "Processing" status
- `src/pages/landlord/Agreements.tsx` — Update rent increase to use landlord_applications
- `src/pages/landlord/AddTenant.tsx` — Resolve tax rate using property category
- `src/components/LandlordLayout.tsx` — Add Applications + Complaints nav items
- `src/components/RegulatorLayout.tsx` — Add Applications nav item
- `src/pages/regulator/RegulatorComplaints.tsx` — Add landlord complaints tab
- `src/App.tsx` — Add new routes

**Database migration** (1):
- Add `property_category` to `properties`
- Create `landlord_applications` table + RLS
- Create `landlord_complaints` table + RLS
- Create `application-evidence` storage bucket

