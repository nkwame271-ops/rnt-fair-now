

# Plan: Rent Card Enhancements, Admin Permissions & Office Locator

## 1. Region → Office Hierarchy Data Structure

**`src/hooks/useAdminProfile.ts`** — Add `GHANA_REGIONS_OFFICES` grouped structure mapping each of the 16 Ghana regions to its offices. Derive `GHANA_OFFICES` from it for backward compatibility. Add helpers: `getOfficesForRegion()`, `getRegionForOffice()`.

---

## 2. Invite Staff — Permission Control for Main Admins

**`src/pages/regulator/InviteStaff.tsx`** — Show the feature selection checklist for Main Admins too (not just Sub Admins). Main Admins should not default to full access.

**`supabase/functions/invite-staff/index.ts`** — Accept and store `allowedFeatures` for main_admin accounts instead of forcing empty array.

**Feature gating** — If a Main Admin has a non-empty `allowed_features` array, enforce it. Empty array = full access (backward compatible).

---

## 3. Serial Number Generation Tool (New Tab)

**New: `src/pages/regulator/rent-cards/SerialGenerator.tsx`**:
- Form: Custom prefix/format, start range, end range (quantity auto-calculated)
- Region → Office cascading dropdowns
- Live preview of generated serials
- Password confirmation via `AdminPasswordConfirm` — generation blocked without it
- On confirm: calls `admin-action` edge function with action `generate_serials`

**`supabase/functions/admin-action/index.ts`** — Add `generate_serials` action: validates password, inserts serials into `rent_card_serial_stock`, logs to `admin_audit_log`.

**`src/pages/regulator/RegulatorRentCards.tsx`** — Add "Generate Serials" tab (Main Admin only).

---

## 4. Region → Office Filtering Across Rent Card Tabs

Update `SerialBatchUpload`, `OfficeSerialStock`, and `PendingPurchases` to use Region → Office cascading dropdowns instead of flat office lists.

---

## 5. Bulk Region Assignment

**Database migration**: Add `region` column to `rent_card_serial_stock`.

**`SerialBatchUpload.tsx`** — Add toggle: "Assign to office" vs "Assign to region". Region assignment stores the region name; stock queries include `WHERE office_name = X OR region = (region of X)`.

**`OfficeSerialStock.tsx`** — Update queries to include region-assigned stock.

---

## 6. Preserve Existing Features

CSV upload, manual upload, audit log, and revoke controls remain unchanged. The Generator is a new tab alongside existing functionality.

---

## 7. Office Locator on Main Page

**`src/pages/RoleSelect.tsx`** — Add "Find Your Nearest Office" section with a text search input that filters offices from `GHANA_REGIONS_OFFICES`, showing matching results grouped by region.

---

## Files to Change

| File | Change |
|---|---|
| `src/hooks/useAdminProfile.ts` | Region→Office hierarchy + helpers |
| `src/pages/regulator/InviteStaff.tsx` | Feature selector for Main Admins |
| `supabase/functions/invite-staff/index.ts` | Accept features for main_admin |
| `src/pages/regulator/rent-cards/SerialGenerator.tsx` | **New** — generation tool |
| `src/pages/regulator/RegulatorRentCards.tsx` | Add Generate tab |
| `src/pages/regulator/rent-cards/SerialBatchUpload.tsx` | Region filter + bulk region assignment |
| `src/pages/regulator/rent-cards/OfficeSerialStock.tsx` | Region filter + region stock queries |
| `supabase/functions/admin-action/index.ts` | Add `generate_serials` action |
| Migration | Add `region` column to `rent_card_serial_stock` |
| `src/pages/RoleSelect.tsx` | Office Locator section |

