

# Enhance Super Admin Dashboard — Staff Ordering, Granular Feature Control, Regulators Tab

## What's Already Done (skip these)
- Feature Renaming across portals (Tab 2)
- Module-Level Visibility Control for Escrow, Rent Cards, Engine Room, Analytics (Tab 1)
- Procurement/Rent Card button-level controls (inventory adjustment, stock correction, etc.)
- Staff CRUD: create, freeze, delete, reset password (Tab 3)
- Ledger baseline / operational start date (Tab 4)
- Payment processor charges display (1.95% + GHS 1) (Tab 4)
- Activity Logs (Tab 5)
- Sidebar shows "SUPER ADMIN" badge

## What Needs to Change

### 1. Super Admin account pinned to top of staff list
In the Staff tab, sort staff so `super_admin` accounts always appear first, then `main_admin`, then `sub_admin`.

### 2. New "Regulators" tab
Add a dedicated tab showing only `main_admin` and `super_admin` accounts. When you click on a regulator's card, it expands inline to show:
- Full list of all platform features with checkboxes to enable/disable each one
- Muted features with toggle switches
- Office assignment
- Last login and activity summary

### 3. Replace comma-separated feature editing with a proper checklist UI
The current "Edit Staff" dialog uses a text input for comma-separated feature keys. Replace this with:
- A scrollable checklist of all available features (using the `FEATURE_ROUTE_MAP` keys)
- Each feature has a checkbox (allowed) and a mute toggle
- Grouped by category for clarity

### 4. Sidebar: more prominent Super Admin indicator
Make the Super Admin badge visually distinct — use a gold/amber color instead of the same destructive red used for other badges.

## Files Modified
- `src/pages/regulator/SuperAdminDashboard.tsx` — sort staff list, add Regulators tab, replace feature edit dialog with checklist UI
- `src/components/RegulatorLayout.tsx` — update Super Admin badge styling

