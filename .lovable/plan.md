
# Plan: Rent Card Enhancements, Admin Permissions & Office Locator

## 1. Region → Office Hierarchy Data Structure

**`src/hooks/useAdminProfile.ts`** — Replace flat `GHANA_OFFICES` with a region-grouped structure:

```typescript
export const GHANA_REGIONS_OFFICES: { region: string; offices: { id: string; name: string }[] }[] = [
  { region: "Greater Accra", offices: [
    { id: "accra_central", name: "Accra Central Office" },
    { id: "accra_north", name: "Accra North Office" },
    { id: "madina", name: "Madina Office" },
    // ... all Greater Accra offices
  ]},
  { region: "Ashanti", offices: [
    { id: "kumasi", name: "Kumasi Office" },
    { id: "kumasi_south", name: "Kumasi South Office" },
    { id: "obuasi", name: "Obuasi Office" },
  ]},
  // ... all 16 regions with their offices
];
// Keep GHANA_OFFICES as a derived flat list for backward compatibility
export const GHANA_OFFICES = GHANA_REGIONS_OFFICES.flatMap(r => r.offices);
```

Also add a helper: `getOfficesForRegion(region: string)` and `getRegionForOffice(officeId: string)`.

---

## 2. Invite Staff — Permission Control for Main Admins

**`src/pages/regulator/InviteStaff.tsx`**:
- When `adminType === "main_admin"`, show the same feature selection checklist (currently only shown for sub_admins)
- Remove the assumption that Main Admins get full access by default
- Pass `allowedFeatures` for both admin types to the `invite-staff` edge function

**`supabase/functions/invite-staff/index.ts`**:
- Remove the line that forces `allowedFeatures: []` for main_admin
- Accept and store `allowedFeatures` for main_admin accounts too

**`src/hooks/useAdminProfile.ts`** / **`src/components/RegulatorLayout.tsx`**:
- Ensure feature gating applies to Main Admins who have a non-empty `allowed_features` array (if array is empty, treat as full access for backward compatibility)

---

## 3. Serial Number Generation Tool

**New component: `src/pages/regulator/rent-cards/SerialGenerator.tsx`**:
- Form fields: Prefix/Format (e.g. `RCD-2026-`), Start number, End number, Quantity display (auto-calculated)
- Live preview of generated serials
- Region selector → filters offices → Target Office selector
- Password confirmation dialog (using `AdminPasswordConfirm`) before generation proceeds
- On confirm: generates serials, inserts into `rent_card_serial_stock` as a batch, logs to `admin_audit_log` via `admin-action` edge function

**`supabase/functions/admin-action/index.ts`**:
- Add new action `generate_serials` that: validates password, generates the serial rows, inserts them, and logs to audit

---

## 4. Region → Office Filtering in Rent Card Management

**`src/pages/regulator/RegulatorRentCards.tsx`** and sub-components (`SerialBatchUpload`, `OfficeSerialStock`, `PendingPurchases`):
- Add Region dropdown that filters the Office dropdown dynamically
- Replace all `GHANA_OFFICES.map(...)` selects with a two-step Region → Office picker

---

## 5. Bulk Assignment to Region

**`src/pages/regulator/rent-cards/SerialBatchUpload.tsx`**:
- Add toggle: "Assign to single office" vs "Assign to entire region"
- When region mode: insert serials with a special `office_name` pattern (e.g. the region name) OR insert one copy per office in that region
- Better approach: store `region` column on `rent_card_serial_stock` (migration), and when querying office stock, include serials where `region` matches the office's region

**Database migration**:
```sql
ALTER TABLE public.rent_card_serial_stock ADD COLUMN IF NOT EXISTS region text;
```

Update all stock queries to: `WHERE office_name = X OR region = (region of X)`.

---

## 6. Maintain CSV Upload, Manual Upload, Audit & Revoke

These already exist. The new Generator tab will be added alongside (not replacing) the existing Serial Batch Upload tab. All existing audit/revoke controls in AdminActions remain unchanged.

---

## 7. Office Locator on Main Page

**`src/pages/RoleSelect.tsx`**:
- Add new section "Find Your Nearest Office" between the Contact section and Footer
- Text input for location/area search
- Filters `GHANA_REGIONS_OFFICES` to show matching offices with region labels
- Simple client-side search, no Google Maps needed — just a searchable list showing office name + region

---

## Files to Change

| File | Change |
|---|---|
| `src/hooks/useAdminProfile.ts` | Add `GHANA_REGIONS_OFFICES` hierarchy, keep `GHANA_OFFICES` derived |
| `src/pages/regulator/InviteStaff.tsx` | Show feature selector for Main Admins too |
| `supabase/functions/invite-staff/index.ts` | Accept `allowedFeatures` for main_admin |
| `src/pages/regulator/rent-cards/SerialGenerator.tsx` | **New** — generation form with password confirmation |
| `src/pages/regulator/RegulatorRentCards.tsx` | Add "Generate" tab, pass region/office context |
| `src/pages/regulator/rent-cards/SerialBatchUpload.tsx` | Add Region→Office filter, bulk region assignment toggle |
| `src/pages/regulator/rent-cards/OfficeSerialStock.tsx` | Add Region→Office filter, query region-assigned stock |
| `supabase/functions/admin-action/index.ts` | Add `generate_serials` action |
| Migration | Add `region` column to `rent_card_serial_stock` |
| `src/pages/RoleSelect.tsx` | Add Office Locator section |
