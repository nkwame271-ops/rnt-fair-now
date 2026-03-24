

# Multi-Portal Fixes: Admin Assess/Approve, Edit Property Units, Bathrooms, Contact Form

## Issues Identified

1. **Admin Portal**: After landlord resubmits (status becomes `pending_assessment`), the "Assess" and "Suggest Relist" buttons only show when `assessment_status !== "approved"`. But for resubmitted properties, the assessment was already approved previously. The condition on line 396 hides the buttons. Need to also show Assess/Approve for properties with `property_status === "pending_assessment"` regardless of prior `assessment_status`.

2. **Landlord Edit Property**: The edit page only has property-level fields (name, address, region, etc.) but no unit editing. Landlords cannot change unit rents to match the suggested price. Need to add unit management (rent editing, type, facilities) to EditProperty.tsx.

3. **Missing bathroom count**: The `UnitForm` interface has `bedroomCount` but no `bathroomCount`. Need to add it to registration and edit forms.

4. **Homepage contact**: Replace email with a contact form that sends submissions to admin (store in a `contact_submissions` table).

---

## Database Changes

### New table: `contact_submissions`
| Column | Type |
|---|---|
| id | UUID PK |
| name | TEXT |
| email | TEXT |
| phone | TEXT |
| message | TEXT |
| status | TEXT DEFAULT 'new' |
| created_at | TIMESTAMPTZ |

RLS: anon/public can insert; regulators can read all.

---

## Changes by File

### `RegulatorProperties.tsx`
- Change the condition on line 396 from `(p.assessment_status || "pending") !== "approved"` to also show Assess/Approve when `pStatus === "pending_assessment"` (resubmitted properties)
- Same logic in detail dialog (line 514): show Assess/Quick Approve buttons when property is `pending_assessment` even if previously approved
- Show "Suggest Relist" for `pending_assessment` status (already works)

### `EditProperty.tsx`
- Fetch units for the property alongside property data
- Add unit editing section: for each unit, allow editing rent, unit type (with preset chips), bedroom count, bathroom count, and facilities checkboxes
- Save unit changes alongside property changes
- When in `needs_update` status, highlight the rent field with the suggested price as guidance

### `RegisterProperty.tsx`
- Add `bathroomCount` to `UnitForm` interface and `createEmptyUnit`
- Add bathroom count input next to bedroom count in the unit form

### `RoleSelect.tsx`
- Remove email line from footer contact section (keep phone and address)
- Replace the Contact column in the footer with a contact form (name, email, phone, message) that inserts into `contact_submissions`
- Or add a "Contact Us" section above the footer with the form

### `RegulatorDashboard.tsx` or `RegulatorFeedback.tsx`
- Add a way for admin to view contact submissions (can piggyback on existing feedback page or add a tab)

---

## Technical Details

### Admin Assess button visibility fix
```typescript
// Change from:
{(p.assessment_status || "pending") !== "approved" && (
// To:
{((p.assessment_status || "pending") !== "approved" || pStatus === "pending_assessment") && (
```

### Edit Property unit management
Fetch units on load, render editable unit cards with rent, type, bedrooms, bathrooms, facilities. On save, batch update all changed units.

### Contact form
Simple form in footer area that posts to `contact_submissions` table. No auth required (anon insert policy).

