

## Analysis

The current system has a gap between what the regulator can configure and what appears in the agreement. Right now:

- **Regulator** can only edit statutory limits (max advance, tax rate) and terms/conditions (text clauses). The "Auto-Populated Fields" section is hardcoded — the regulator cannot add or remove data fields.
- **Landlord** fills in hardcoded fields (rent, advance period, start date) when creating a tenancy via AddTenant.
- **Tenant** sees the agreement and can accept it.

The user wants the regulator to define **which data fields** appear in the agreement (e.g., "Occupation of Tenant", "Purpose of Tenancy", "Next of Kin"). The landlord then fills those fields when adding a tenant, and the values carry through to the PDF and to the tenant's view.

---

## Plan

### Step 1: Add `custom_fields` column to `agreement_template_config`

Add a JSONB column `custom_fields` that stores an array of field definitions:

```text
custom_fields: [
  { "label": "Occupation of Tenant", "type": "text", "required": true },
  { "label": "Purpose of Tenancy", "type": "text", "required": false },
  { "label": "Next of Kin", "type": "text", "required": true },
  ...
]
```

Also add a `custom_field_values` JSONB column to the `tenancies` table to store the landlord's filled-in values for each agreement.

**Database migration:**
- `ALTER TABLE agreement_template_config ADD COLUMN custom_fields jsonb DEFAULT '[]'::jsonb;`
- `ALTER TABLE tenancies ADD COLUMN custom_field_values jsonb DEFAULT '{}'::jsonb;`

### Step 2: Update Regulator Agreement Templates page

**`src/pages/regulator/RegulatorAgreementTemplates.tsx`**:
- Add a new section "Agreement Data Fields" where the regulator can:
  - See all current fields (both auto-populated system fields and custom fields)
  - Add a new custom field (label + type dropdown: text/number/date + required toggle)
  - Edit existing custom fields
  - Remove custom fields
  - Reorder fields (drag or up/down buttons)
- The auto-populated fields (Registration Code, Landlord Name, etc.) are shown as locked/non-removable items so the regulator knows they exist
- Custom fields are shown as editable/removable items
- Save persists to the `custom_fields` column

### Step 3: Update Landlord's AddTenant flow

**`src/pages/landlord/AddTenant.tsx`**:
- In the "Set Terms" step (step 3), after the existing rent/advance/date fields, dynamically render input fields for each custom field defined by the regulator
- Field types map to: `text` → Input, `number` → Input type=number, `date` → Input type=date
- Required fields are validated before proceeding to review
- Store values in local state as a key-value object

In the "Review" step (step 4), display the custom field values alongside the standard fields.

When submitting, save the custom field values to `tenancies.custom_field_values`.

### Step 4: Update PDF generation

**`src/lib/generateAgreementPdf.ts`**:
- Accept `customFields` (field definitions) and `customFieldValues` (filled values) in `AgreementPdfData`
- Add a "ADDITIONAL INFORMATION" section in the PDF that renders each custom field label and its value

### Step 5: Update Tenant's MyAgreements view

**`src/pages/tenant/MyAgreements.tsx`**:
- Fetch `custom_field_values` from the tenancy record
- Fetch `custom_fields` from `agreement_template_config` for labels
- Display custom field data in both the pending and active agreement cards

### Files to change

| File | Change |
|------|--------|
| New migration SQL | Add `custom_fields` to `agreement_template_config`, add `custom_field_values` to `tenancies` |
| `src/pages/regulator/RegulatorAgreementTemplates.tsx` | Add custom fields management UI (add/edit/remove/reorder) |
| `src/pages/landlord/AddTenant.tsx` | Render dynamic fields from config in Set Terms step; save values on submit |
| `src/lib/generateAgreementPdf.ts` | Render custom field values in PDF |
| `src/pages/tenant/MyAgreements.tsx` | Display custom field values in agreement cards |
| `src/pages/landlord/Agreements.tsx` | Display custom field values in landlord's agreement view |

