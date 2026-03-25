

# Universal Search / Command Palette

## Problem
The platform has 50+ pages across three portals (Admin, Landlord, Tenant). Users struggle to find specific features. A search bar at the top of every dashboard lets them type a keyword and jump directly to the right page.

## Solution
A **Command Palette** (Ctrl+K / Cmd+K shortcut + clickable search bar in the header) that indexes all navigation items across the active portal. Users type a keyword, see matching pages with descriptions, and click to navigate instantly.

## Implementation

### New Component: `CommandSearch.tsx`
- Uses the existing `cmdk`-based `Command` UI components already in the project (`src/components/ui/command.tsx`)
- Renders a small search input in the header bar (magnifying glass icon + "Search features..." placeholder)
- On click or Ctrl+K, opens a full command dialog overlay
- Each portal layout passes its nav items + extra keyword metadata to the search component
- Items include: route, label, icon, and **search keywords** (e.g., "Rent Cards" also matches "serial", "purchase", "stock")

### Search Data Registry
A static map of all routes with enriched descriptions and keywords:

```text
Route                          Label                Keywords
/regulator/rent-cards          Rent Cards           serial, purchase, stock, assign, batch
/regulator/complaints          Complaints           dispute, case, hearing, schedule
/regulator/escrow              Escrow & Revenue     payment, split, IGF, revenue, office
/tenant/file-complaint         File Complaint       dispute, issue, landlord problem
/landlord/add-tenant           Add Tenant           tenancy, agreement, new tenant
... (all routes get keywords)
```

### Integration Points
- **RegulatorLayout.tsx**: Add `<CommandSearch items={navItems} />` in the header bar (line ~130, next to `NotificationBell`)
- **LandlordLayout.tsx**: Same placement in header
- **TenantLayout.tsx**: Same placement in header
- Each layout already has a `navItems` array — these are passed directly to the search component, augmented with keyword metadata

### Keyboard Shortcut
- Ctrl+K (Windows) / Cmd+K (Mac) opens the palette from anywhere within the portal
- Escape closes it

### UX Details
- Search input in header: compact, shows "Search features... ⌘K" hint
- Dialog shows grouped results by category (Navigation, Actions)
- Each result shows icon + label + short description
- Clicking a result navigates to that route and closes the dialog
- Empty state: "No matching features found"

## Files Changed

| File | Change |
|---|---|
| `src/components/CommandSearch.tsx` | **New** — Command palette component with route registry |
| `src/components/RegulatorLayout.tsx` | Add CommandSearch to header |
| `src/components/LandlordLayout.tsx` | Add CommandSearch to header |
| `src/components/TenantLayout.tsx` | Add CommandSearch to header |

No database changes. No new dependencies (uses existing `cmdk` package).

