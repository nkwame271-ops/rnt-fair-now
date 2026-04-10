

# Granular Card-Level Muting for Revenue by Type & Allocation Ledger

## What Changes

### 1. Add sub-card entries to `MODULE_SECTIONS` in SuperAdminDashboard

Add individual mutable entries for each Revenue by Type card and each Allocation card:

**Revenue by Type sub-cards** (module: `escrow`):
- `revenue_type_rent_card` — Rent Card Sales
- `revenue_type_registrations` — Registrations
- `revenue_type_termination` — Quit Notices / Ejection
- `revenue_type_agreement` — Tenancy Agreement
- `revenue_type_rent_tax` — Rent Tax
- `revenue_type_complaint` — Complaint Fee
- `revenue_type_listing` — Listing Fee
- `revenue_type_viewing` — Viewing Fee
- `revenue_type_archive` — Archive Search

**Allocation Ledger sub-cards** (module: `escrow`):
- `allocation_igf` — IGF (Rent Control)
- `allocation_admin` — Admin
- `allocation_platform` — Platform
- `allocation_gra` — GRA
- `allocation_landlord` — Landlord (Held)

These appear nested under the existing "Revenue by Type" and "Revenue Breakdown by Destination" sections in the Super Admin visibility tab.

### 2. Update EscrowDashboard to filter cards by visibility and adjust totals

**Revenue by Type section**: Filter `revenueByType` through `isVisible("escrow", "revenue_type_*")` for each card. Compute a `visibleRevenue` total that sums only the visible type cards. Display this adjusted total in the "Total Revenue" summary card instead of `stats.totalEscrow` — so muted revenue types disappear from both the cards and the total.

**Allocation Summary section**: Filter `allocationCards` through `isVisible("escrow", "allocation_*")` for each card. Compute a `visibleAllocation` total and show that as the "Total Collected" footer value — so muted allocation entries (e.g., Platform, GRA) disappear from both the individual cards and the bottom-line total.

### 3. Files modified
- `src/pages/regulator/SuperAdminDashboard.tsx` — add ~14 new sub-section entries to `MODULE_SECTIONS`
- `src/pages/regulator/EscrowDashboard.tsx` — filter revenue type cards and allocation cards by `isVisible`, recalculate totals based on visible cards only

## How It Works

When Super Admin mutes `revenue_type_complaint` → other admins no longer see the Complaint Fee card AND the Total Revenue number drops by the complaint fee amount. The money still flows through the platform, it's just hidden from their view. Super Admin always sees everything.

Same for allocation: muting `allocation_platform` hides the Platform card and reduces the displayed "Total Collected" to match only what the admin is allowed to see.

