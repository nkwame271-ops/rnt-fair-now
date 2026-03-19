

# Update CFLED Branding and Contact Details

## What's Changing

1. **Footer branding text**: Change from "Powered by" to "Designed by Center for Financial Literacy, E-Commerce and Digitalization" across all 4 layout files.

2. **Add CFLED contact details**: Add a subtle contact section to the landing page footer showing:
   - Center For Financial Literacy, E-Commerce and Digitalization
   - Ghana Hostels Ltd., University of Ghana, Legon
   - Contact: 0508376903
   - Email: info@cflec.org

3. **Dashboard footers**: Update the 3 dashboard layout footers (Tenant, Landlord, Regulator) with the new "Designed by" text and keep contact details minimal (just the org name).

## Missing: New Logo Image

You mentioned "Put this new Logo there" — but I don't see an uploaded image. **Please upload the new CFLED logo** so I can replace the current `cfled-logo.png`. I'll proceed with the text/contact changes and swap the logo once you provide it.

## Files to Modify

| File | Change |
|---|---|
| `src/pages/RoleSelect.tsx` | Update footer: "Designed by" text + add CFLED contact column |
| `src/components/TenantLayout.tsx` | Footer: "Designed by" text |
| `src/components/LandlordLayout.tsx` | Footer: "Designed by" text |
| `src/components/RegulatorLayout.tsx` | Footer: "Designed by" text |

