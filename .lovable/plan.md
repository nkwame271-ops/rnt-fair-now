

# Admin Hierarchy and Office-Based Access Control

## Overview

Introduce a two-tier admin system (Main Admin / Sub Admin) with per-feature access control and office-based scoping for Rent Card Management.

## Database Changes (Migration)

### New table: `admin_staff`
Stores admin type, office assignment, and allowed features per regulator user.

```sql
CREATE TABLE public.admin_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  admin_type text NOT NULL DEFAULT 'sub_admin', -- 'main_admin' or 'sub_admin'
  office_id text, -- e.g. "accra_central", "kumasi_main"
  office_name text, -- human-readable: "Accra Central Office"
  allowed_features text[] DEFAULT '{}', -- feature keys this sub_admin can access
  muted_features text[] DEFAULT '{}', -- features explicitly muted by main admin
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_staff ENABLE ROW LEVEL SECURITY;

-- Main admins read all, sub admins read own
CREATE POLICY "Regulators read admin_staff" ON public.admin_staff
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

-- Only main admins can insert/update
CREATE POLICY "Main admins manage admin_staff" ON public.admin_staff
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_staff WHERE user_id = auth.uid() AND admin_type = 'main_admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_staff WHERE user_id = auth.uid() AND admin_type = 'main_admin'
  ));
```

### Seed main admin record
Insert a record for `admin@rentcontrol.gov.gh` as `main_admin` (done via insert tool after migration).

## Backend Changes

### `invite-staff` Edge Function
- Accept new fields: `adminType` ('main_admin' | 'sub_admin'), `officeId`, `officeName`, `allowedFeatures`
- Store in `admin_staff` table after creating the auth user
- Only main admins can invite other main admins

## Frontend Changes

### 1. New hook: `useAdminProfile`
Fetches current user's `admin_staff` record. Exposes `adminType`, `officeId`, `officeName`, `allowedFeatures`, `mutedFeatures`, `isMainAdmin`.

### 2. `InviteStaff.tsx` — Two invite modes
- Tab or radio: "Invite Main Admin" / "Invite Sub Admin"
- Sub Admin form adds: Office selection (dropdown of 66 offices), feature checkboxes (from feature_flags)
- Main Admin form: simpler (full access, no office restriction)

### 3. `RegulatorLayout.tsx` — Filter sidebar by permissions
- Fetch `admin_staff` for current user
- If `sub_admin`: filter `navItems` to only show items matching `allowed_features` (map feature keys to nav routes)
- If `main_admin`: show all items

### 4. `EngineRoom.tsx` — Sub Admin management section
- Main Admin sees a new section: "Staff Feature Access"
- Lists all sub admins with toggles to mute/unmute specific features per sub admin
- Sub Admins see only their allowed (non-muted) features in Engine Room (read-only, no toggles)

### 5. `RegulatorRentCards.tsx` — Office-scoped access
- Auto-populate `officeName` from `admin_staff.office_name` (not manually typed)
- Filter serial stock queries by the user's `office_id`
- Sub admins can only see/assign serials from their own office
- Main admins can select any office (dropdown)

## Feature-to-Route Mapping

A constant mapping connects feature keys to sidebar routes, enabling the system to hide inaccessible pages:

```typescript
const featureRouteMap: Record<string, string[]> = {
  dashboard: ["/regulator/dashboard"],
  tenants: ["/regulator/tenants"],
  rent_cards: ["/regulator/rent-cards"],
  engine_room: ["/regulator/engine-room"],
  invite_staff: ["/regulator/invite-staff"],
  // ... etc
};
```

## Files to Create/Modify

| File | Action |
|---|---|
| Migration SQL | Create `admin_staff` table with RLS |
| `src/hooks/useAdminProfile.ts` | **New** — fetch admin type + office + permissions |
| `supabase/functions/invite-staff/index.ts` | Add admin_type, office, features |
| `src/pages/regulator/InviteStaff.tsx` | Two invite modes + office/feature selection |
| `src/components/RegulatorLayout.tsx` | Filter nav by admin permissions |
| `src/pages/regulator/EngineRoom.tsx` | Sub admin management + read-only mode for sub admins |
| `src/pages/regulator/RegulatorRentCards.tsx` | Auto-populate office, scope queries |

