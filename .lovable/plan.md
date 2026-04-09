

# Plan: Landlord & Tenant Feature Enhancements

This is a large multi-part plan covering 7 distinct areas. Each is scoped to specific files and changes.

---

## 1. Enhanced Agreement PDF with Real Property Data

**Current state**: `generateAgreementPdf.ts` only includes basic fields (name, address, unit, rent). Missing: GPS, amenities, property condition, tenant contact, accommodation type, "assessed recoverable rent."

**Changes**:
- Expand `AgreementPdfData` interface to include: `gpsAddress`, `ghanaPostGps`, `amenities`, `propertyCondition`, `tenantPhone`, `landlordPhone`, `bedroomCount`, `bathroomCount`, `facilities` (water, electricity, etc.)
- Add new PDF sections: "Property Location" (GPS + Ghana Post), "Type of Accommodation" (unit type + bedrooms/bathrooms), "Available Amenities", "Condition of Property", "Condition of Tenancy"
- Rename "Monthly Rent" label to "Assessed Recoverable Rent Per Month"
- Update all callers (`RegulatorAgreements.tsx`, `MyAgreements.tsx`, `Agreements.tsx`) to pass the expanded data by fetching unit details (amenities, facilities) and property details (GPS, condition)

**Files**: `src/lib/generateAgreementPdf.ts`, `src/pages/regulator/RegulatorAgreements.tsx`, `src/pages/tenant/MyAgreements.tsx`, `src/pages/landlord/Agreements.tsx`

---

## 2. Clickable Entity Names (Landlord, Tenant, Property)

**Current state**: Names in `RegulatorAgreements.tsx` are plain text.

**Changes**:
- Make tenant names link to `/regulator/tenants?search={tenantName}`
- Make landlord names link to `/regulator/landlords?search={landlordName}`
- Make property names link to `/regulator/properties?id={propertyId}` (need to pass property ID through the data)
- Store `_propertyId` in the enriched agreement data
- Apply same pattern to landlord and tenant views where entity names appear

**Files**: `src/pages/regulator/RegulatorAgreements.tsx`, `src/pages/landlord/Agreements.tsx`, `src/pages/tenant/MyAgreements.tsx`

---

## 3. Property Registration: Vacant/Occupied Declaration

**Current state**: `RegisterProperty.tsx` always creates property as `pending_assessment` and shows marketplace notice. No occupancy question.

**Changes**:
- Add a new `occupancyStatus` state: `"vacant" | "occupied"` with radio buttons after "Property Structure"
- If **vacant**: existing workflow continues unchanged
- If **occupied**: after property is created, redirect to `/landlord/declare-existing-tenancy?propertyId={newPropertyId}` instead of `/landlord/my-properties`
- Set `property_status` to `"pending_assessment"` (same) but also set `listed_on_marketplace: false`
- Show info notice: "This property is occupied. You will be redirected to declare the existing tenancy."
- In admin view, tag occupied properties with `property_status` reflecting tenancy completion state

**Files**: `src/pages/landlord/RegisterProperty.tsx`

---

## 4. Declare Existing Tenancy: Flexible Advance Field

**Current state**: Advance paid is a `<Select>` dropdown limited to 0-6 months (line 619-627).

**Changes**:
- Replace the `<Select>` with a numeric `<Input>` field
- Remove the "Maximum 6 months (Act 220)" helper text, replace with "Enter the number of months already paid as advance"
- Keep the `maxLawfulAdvance` display as informational only (not a hard block)
- The `advancePaid` state already stores a string, so parse it as an integer

**Files**: `src/pages/landlord/DeclareExistingTenancy.tsx` (lines 617-627)

---

## 5. Placeholder Tenant Bug: Agreement Not Showing

**Root cause**: Two issues:
1. When tenant is not registered, `tenant_user_id` is set to the **landlord's own user ID** (line 252: `const tenantUserId = matched?.userId || user.id`). When the tenant later registers, nothing links them to this tenancy.
2. The tenant dashboard query (line 37 of `TenantDashboard.tsx`) requires `tenant_signed_at IS NOT NULL`, which is never set for declared existing tenancies.
3. `MyAgreements.tsx` similarly filters only tenant's own tenancies.

**Changes**:
- In `DeclareExistingTenancy.tsx`: when creating a pending tenant, store the `tenancy_id` in `pending_tenants` table (already done). Add a new step: when a new tenant registers with a matching phone, auto-claim pending tenancies by updating `tenancies.tenant_user_id` to the new user's ID.
- In `RegisterTenant.tsx`: after successful registration, check `pending_tenants` for matching phone and update `tenancies.tenant_user_id` + mark as claimed. This requires a backend function since RLS blocks cross-user updates.
- Add a new admin-action case `"claim_pending_tenancy"` or create a trigger/edge function `claim-pending-tenancies` that runs on tenant registration.
- In `TenantDashboard.tsx`: include `existing_declared` tenancies even without `tenant_signed_at` (remove that filter for `existing_declared` status)
- In `MyAgreements.tsx`: show `existing_declared` tenancies with an "Accept" or "Confirm" action

**Files**: `src/pages/RegisterTenant.tsx`, `src/pages/tenant/TenantDashboard.tsx`, `src/pages/tenant/MyAgreements.tsx`, `src/pages/landlord/DeclareExistingTenancy.tsx`, new edge function or admin-action case

---

## 6. Rent Increase Control: Read-Only Rent After Declaration

**Current state**: Rent field in unit management and agreements is editable. The rent increase request flow exists but doesn't lock the field.

**Changes**:
- In `EditProperty.tsx` (if exists) and unit editing: make `monthly_rent` field read-only once a tenancy exists for that unit
- Show a notice: "Rent amount is locked. To request a change, use the Rent Increase Application."
- In `RegulatorRentReviews.tsx`: after approval, the system already updates `units.monthly_rent` (line 68). Add: also update `tenancies.agreed_rent` for the active tenancy on that unit.
- Add a field `rent_locked` (boolean) to units or check for active tenancy existence to determine editability

**Files**: `src/pages/landlord/EditProperty.tsx`, `src/pages/regulator/RegulatorRentReviews.tsx`

---

## 7. Tenancy Expiry Automation Fix

**Current state**: `tenancy-expiry-check` edge function already auto-expires tenancies and sets units to vacant. However, it also sets `property_status` to `off_market` and `listed_on_marketplace: false` — which is correct per the user's request ("property should not be automatically relisted").

**What needs to change**: The current logic is actually correct for what the user wants. However, verify:
- The function sets property to `off_market` (not relisted) ✓
- The property returns to landlord control ✓
- Landlord decides whether to relist ✓

The only change needed: ensure the property status change message in notifications is clear, telling the landlord "Your property is now off-market. You can relist it from My Properties when ready."

**Files**: `supabase/functions/tenancy-expiry-check/index.ts` (notification text only)

---

## Technical Summary

| # | Area | Files Modified | New Files |
|---|------|---------------|-----------|
| 1 | PDF enhancement | `generateAgreementPdf.ts`, 3 callers | — |
| 2 | Clickable entities | `RegulatorAgreements.tsx`, `Agreements.tsx`, `MyAgreements.tsx` | — |
| 3 | Vacant/Occupied | `RegisterProperty.tsx` | — |
| 4 | Flexible advance | `DeclareExistingTenancy.tsx` | — |
| 5 | Placeholder tenant fix | `RegisterTenant.tsx`, `TenantDashboard.tsx`, `MyAgreements.tsx` | Edge function or admin-action case |
| 6 | Rent lock | `EditProperty.tsx`, `RegulatorRentReviews.tsx` | — |
| 7 | Expiry notifications | `tenancy-expiry-check/index.ts` | — |

