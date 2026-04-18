

## Mobile Responsive Pass 2

The mobile layout is broken because page headers, filter rows, and card grids assume desktop width. The screenshot shows content compressed because something inside is forcing horizontal overflow (likely `flex justify-between` headers + non-wrapping filter bars), and the tenant row grid `grid-cols-2 sm:grid-cols-7` packs 7 fields awkwardly.

### Fixes (CSS class changes only — no logic)

**1. Page headers across all admin tables** — wrap on mobile
- `flex items-center justify-between` → `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`
- Action buttons (Export CSV, etc.) → add `w-full sm:w-auto`
- Apply to: RegulatorTenants, RegulatorLandlords, RegulatorProperties, RegulatorComplaints, RegulatorAgreements, RegulatorReceipts, RegulatorRentReviews, RegulatorTerminations, RegulatorApplications, ManageRentCards, NugsStudents, NugsInstitutions, MyTenants, MyProperties.

**2. Filter rows** — stack on mobile
- `flex gap-3` (search + select) → `flex flex-col sm:flex-row gap-3`
- Search wrapper `max-w-md` → `flex-1 sm:max-w-md w-full`
- Select trigger `w-44` → `w-full sm:w-44`

**3. Tenant/Landlord/Property card rows** — readable on mobile
- The 7-field `grid grid-cols-2 sm:grid-cols-7` shows 4 wrapping rows of tiny half-cells on phone. Switch to a clean stacked layout:
  - Mobile: `flex flex-col gap-1` showing ID + name on row 1, phone + status badges on row 2, dates on row 3
  - Desktop (`sm:`): keep the 7-column grid
- Apply same pattern to RegulatorLandlords and RegulatorProperties row layouts.

**4. Title sizes** — shrink on mobile
- `text-3xl font-bold` page titles → `text-2xl sm:text-3xl font-bold`
- Long titles like "Tenant Database" with icon won't push viewport wider than 430px.

**5. Page container padding** — tighten on phone
- In the 4 portal layouts, `<main>` already uses `px-5 py-4 md:px-7 md:py-6 lg:px-10 lg:py-8` — fine, but on very narrow phones (≤390px) drop to `px-3`. Update to `px-3 sm:px-5 md:px-7 lg:px-10`.

**6. Overflow guard** — prevent horizontal scroll bleed
- Add `overflow-x-hidden` to the `<main>` element in all 4 layouts (currently only `overflow-y-auto`). This ensures any rogue wide child clips instead of pushing the layout.

### Files touched (~16, class edits only)

- `src/components/{LandlordLayout,TenantLayout,RegulatorLayout,NugsLayout}.tsx` — main padding + overflow-x-hidden
- `src/pages/regulator/{RegulatorTenants,RegulatorLandlords,RegulatorProperties,RegulatorComplaints,RegulatorAgreements,RegulatorReceipts,RegulatorRentReviews,RegulatorTerminations,RegulatorApplications}.tsx` — header/filter/title fixes
- `src/pages/landlord/{ManageRentCards,MyTenants,MyProperties}.tsx` — header/filter fixes
- `src/pages/nugs/{NugsStudents,NugsInstitutions}.tsx` — header/filter fixes

### Out of scope
- Sidebar behaviour (already collapses correctly via Sheet)
- Data, RLS, routes, logic
- Design tokens, colours, animations

