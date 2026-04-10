

# Plan: Landlord/Tenant Admin Portal Enhancements

## Summary of Changes

### 1. Profile PDF Enhancement (`src/lib/generateProfilePdf.ts`)
The current Profile PDF (downloaded from Landlord/Tenant admin pages) only shows basic property info (name, code, address) and tenancy rent as "agreed_rent". It lacks GPS, amenities, property condition, accommodation type, and facilities.

**Changes:**
- Update `ProfileData` interface to include enriched property data (GPS, amenities, condition, bedroom/bathroom counts, facilities) and tenancy property details
- Add new PDF sections: "Property Location" (with GPS/GhanaPost), "Type of Accommodation" (bedrooms/bathrooms), "Available Amenities", "Condition of Property", "Facilities"
- Replace "Rent:" label with "Assessed Recoverable Rent Per Month:"
- Include tenant contact details in tenancy entries

### 2. Landlord Admin Page — Enrich data + clickable links (`src/pages/regulator/RegulatorLandlords.tsx`)
**Current gaps:** Property names, tenant names are plain text. PDF doesn't include enriched property data.

**Changes:**
- Fetch additional property fields: `gps_location`, `ghana_post_gps`, `property_condition`, `room_count`, `bathroom_count`
- Fetch unit facilities: `has_toilet_bathroom`, `has_kitchen`, `water_available`, `electricity_available`, `has_borehole`, `has_polytank`, `amenities`
- Make property names clickable → link to `/regulator/properties?id={propertyId}`
- Make tenant names clickable → link to `/regulator/tenants?search={tenantName}`
- Pass enriched data to `generateProfilePdf`

### 3. Tenant Admin Page — Enrich data + clickable links (`src/pages/regulator/RegulatorTenants.tsx`)
**Current gaps:** Landlord names and property names in tenancy cards are plain text.

**Changes:**
- Make landlord names clickable → link to `/regulator/landlords?search={landlordName}`
- Make property names clickable → link to `/regulator/properties?id={propertyId}`
- Fetch property enrichment data (GPS, condition, amenities, facilities) for PDF
- Pass enriched data to `generateProfilePdf`

### 4. Property Status: "Occupied, Pending Tenancy Agreement Completion" (`src/pages/regulator/RegulatorProperties.tsx`)
**Current state:** Properties with `existing_declared` tenancies show as "Occupied" with no distinction.

**Changes:**
- Cross-reference tenancies with `existing_declared` status for each property's units
- Show a sub-badge: "Pending Tenancy Agreement Completion" for properties whose units have `existing_declared` tenancies where `tenant_accepted = false`
- Update to plain "Occupied" when tenant accepts the agreement (this is already handled by tenancy status transitions)

### 5. Existing Tenancy Agreement Download Changes (`src/pages/regulator/RegulatorAgreements.tsx` + `src/lib/generateAgreementPdf.ts`)
**Changes to RegulatorAgreements.tsx:**
- For `tenancy_type === 'existing_migration'`, change download button label to "Existing Tenancy Details"
- Show a download button for `existing_agreement_url` if present (custom uploaded agreement file)
- Fetch `tenancy_type` and `existing_agreement_url` in the query (already fetching `*`)

**Changes to generateAgreementPdf.ts:**
- Accept a new `isExistingTenancy` flag in `AgreementPdfData`
- When `isExistingTenancy`:
  - Change title from "TENANCY AGREEMENT" to "EXISTING TENANCY DETAILS"
  - Remove "Govt. Tax" and "To Landlord" rows from Financial Terms
  - Remove "KEY TERMS & CONDITIONS" section entirely

### 6. Existing Agreement File Visibility in Admin
- In `RegulatorAgreements.tsx`, add a button to download the landlord-uploaded custom agreement file when `existing_agreement_url` is present

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/generateProfilePdf.ts` | Add property enrichment sections (GPS, amenities, condition, facilities), rename rent label |
| `src/lib/generateAgreementPdf.ts` | Add `isExistingTenancy` flag; conditionally skip tax/terms sections; change title |
| `src/pages/regulator/RegulatorLandlords.tsx` | Fetch enriched property/unit data, clickable links, pass enriched data to PDF |
| `src/pages/regulator/RegulatorTenants.tsx` | Clickable landlord/property names, fetch enriched property data for PDF |
| `src/pages/regulator/RegulatorAgreements.tsx` | Show "Existing Tenancy Details" label, show uploaded agreement download, pass `isExistingTenancy` to PDF |
| `src/pages/regulator/RegulatorProperties.tsx` | Show "Pending Tenancy Agreement Completion" sub-badge for existing_declared tenancies |

