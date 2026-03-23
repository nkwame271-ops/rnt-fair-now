

# Multi-Portal Fixes and Enhancements

## Summary

This batch addresses 10 issues across Admin, Landlord, Tenant portals, and the homepage: assessment approval status sync, suggest-relisting workflow, listing/delisting guards, tenant assignment restrictions, single/multi-unit property structure, flexible unit types, expanded rent checker filters, and homepage contact details.

---

## Database Changes (Migration)

### New columns on `properties` table
- `suggested_price` NUMERIC — admin-suggested rent when sending property back for update
- `property_structure` TEXT DEFAULT 'multi_unit' — values: `single_unit`, `multi_unit`

### New status value
- Add `needs_update` to the `property_status` lifecycle (no enum change needed since it's TEXT)

---

## Changes by File

### 1. `RegulatorProperties.tsx` — Assessment Approval + Suggest Relisting

**Bug fix**: `handleApproveAssessment` updates `assessment_status` to `approved` but does NOT update `property_status`. Add `property_status: 'approved'` to the same update call.

**New feature**: Add "Suggest Relisting" button in assessment dialog:
- Admin enters a `suggested_price` and optional notes
- Sets `property_status = 'needs_update'`, stores `suggested_price` on property
- Sends notification to landlord via `send-notification` edge function
- Add `needs_update` to status colors/labels

### 2. `MyProperties.tsx` — Listing Error Fix + Delist Guard

**Listing error fix**: The edge function call to `compute-rent-benchmark` during relisting may fail. Add a try/catch around the benchmark check and skip it if the function is unavailable.

**Delist guard**: In `handleToggleListing` delist branch, check if any unit has `status === 'occupied'`. If so, show error "Occupied properties cannot be delisted" and return.

**Needs Update display**: When `property_status === 'needs_update'`, show the suggested price and a prompt to edit and resubmit. Add a "Resubmit for Assessment" button that sets `property_status = 'pending_assessment'`.

Add `needs_update` to `statusColors` and `statusLabels`.

### 3. `AddTenant.tsx` — Restrict to Approved Properties

Change the property fetch query to filter only properties with `assessment_status = 'approved'` and `property_status` in `('approved', 'live', 'occupied')`. This prevents tenant assignment to draft, pending, or unassessed properties.

### 4. `RegisterProperty.tsx` — Single/Multi-Unit Selection

Add a `propertyStructure` state (`single_unit` | `multi_unit`):
- Show radio/select before units section: "Single unit property" vs "Multi-unit property"
- If `single_unit`: auto-create 1 unit, hide "Add Unit" button, hide unit removal
- If `multi_unit`: current behavior (add/remove units freely)
- Validation: at least 1 unit with type and rent is required before submit
- Move bedrooms, bathrooms, occupancy type, furnishing, condition fields into each unit form (remove from property level)
- Save `property_structure` to the property record

### 5. `RegisterProperty.tsx` + `EditProperty.tsx` — Flexible Unit Types

Replace the fixed `PropertyType` dropdown with:
- A text input for custom unit description (e.g., "5-Bedroom Duplex with Boys' Quarters")
- Keep common presets as quick-select chips: Single Room, Chamber & Hall, 1-Bedroom, 2-Bedroom, 3-Bedroom, Self-Contained, Apartment, Hostel Room, Shop, Office
- Allow free-text entry alongside chip selection
- Add bedroom count field per unit (number input, 0-10+)

### 6. `RentChecker.tsx` — Expanded Filters

Add new filter fields:
- **Property category**: Residential / Commercial (radio or select)
- **Property sub-type**: Apartment, Detached House, Hostel, Shop, Office (select)
- **Bedroom range**: 1-8+ (select or slider)
- Combine all filters when searching `rentPrices` data
- Update the `rentPrices` dataset in `dummyData.ts` to include `category`, `subType`, and `bedrooms` fields for richer matching

### 7. `RoleSelect.tsx` — Homepage Contact Details

Update the footer contact section:
- Phone: `+233 303 960 792`
- Email: `rentcontroldepart@gmail.com`

### 8. `EditProperty.tsx` — Unit-Level Details + Needs Update Flow

- Move room count, bathroom count, occupancy type, furnishing status to unit editing (matching registration)
- If property has `property_status === 'needs_update'`, show the `suggested_price` from admin and allow landlord to adjust unit rents
- Add "Resubmit" action that sets `property_status = 'pending_assessment'`

---

## Technical Details

### Assessment approval status sync
In `handleApproveAssessment` (RegulatorProperties.tsx line 125-131), add `property_status: 'approved'` to the properties update call. This ensures both `assessment_status` and `property_status` advance together.

### Delist guard logic
```typescript
// Before delist
const hasOccupiedUnit = property.units.some(u => u.status === "occupied");
if (hasOccupiedUnit) {
  toast.error("Occupied properties cannot be delisted");
  return;
}
```

### Suggest Relisting flow
```typescript
// Admin action
await supabase.from("properties").update({
  property_status: "needs_update",
  suggested_price: suggestedPrice,
}).eq("id", propertyId);
```

### AddTenant filter
```typescript
supabase.from("properties")
  .select("...")
  .eq("landlord_user_id", user.id)
  .eq("assessment_status", "approved")
  .in("property_status", ["approved", "live", "occupied"])
```

---

## Files Changed Summary

| File | Change |
|---|---|
| New migration SQL | Add `suggested_price`, `property_structure` columns |
| `RegulatorProperties.tsx` | Fix status sync on approval, add Suggest Relisting |
| `MyProperties.tsx` | Delist guard for occupied, needs_update display, listing error fix |
| `AddTenant.tsx` | Filter to approved properties only |
| `RegisterProperty.tsx` | Single/multi-unit selector, flexible unit types, move details to unit level |
| `EditProperty.tsx` | Unit-level details, needs_update resubmit flow |
| `RentChecker.tsx` | Expanded filters (category, sub-type, bedrooms) |
| `dummyData.ts` | Expand `rentPrices` with category, subType, bedrooms; expand PropertyType |
| `RoleSelect.tsx` | Update contact phone and email |

