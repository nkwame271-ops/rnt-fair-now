

# Super Admin Dashboard & Platform Control System

This is a large multi-part request. I recommend implementing it in phases to keep each change testable and stable.

---

## Phase 1: Database Schema — Super Admin Role & Module Visibility Config

### New table: `module_visibility_config`
Stores per-section/card/button visibility rules that Super Admin controls.

```
id, module_key (e.g. "escrow"), section_key (e.g. "payment_pipeline"),
visibility ("all" | "super_admin_only" | "selected_admins"),
allowed_admin_ids (uuid[]), label_override (text, nullable),
level ("feature" | "section" | "button"), updated_by, updated_at
```

### New table: `feature_label_overrides`
Stores display-name overrides per feature key across all portals.

```
id, feature_key, portal ("admin" | "landlord" | "tenant"),
original_label, custom_label, updated_by, updated_at
```

### Migration: Upgrade `admin_staff.admin_type`
Add `'super_admin'` as a valid value. The current `main_admin` accounts remain as-is; the single Super Admin account will be set to `super_admin` type.

### Migration: Add `operational_start_date` to a config table
Used for item 5 (ledger baseline) — a date after which data is considered operational.

---

## Phase 2: Super Admin Dashboard Page

### New file: `src/pages/regulator/SuperAdminDashboard.tsx`

A dedicated page at `/regulator/super-admin` with tabs:

1. **Module Visibility Control** — Tree view of all modules → sections → buttons. Each node has a toggle (All Admins / Super Admin Only / Selected Admins). This renders the `module_visibility_config` table.

2. **Feature Renaming** — List all features across portals with editable label fields. Saves to `feature_label_overrides`.

3. **Staff & Admin Management** — Enhanced version of current InviteStaff, showing all admins with their permissions, plus the ability to promote/demote.

4. **Ledger & Data Controls** — Set the operational start date for reports. All escrow/revenue queries will filter `created_at >= operational_start_date`.

### Routing
Add route in `App.tsx` and nav item in `RegulatorLayout.tsx` (visible only to `super_admin`).

---

## Phase 3: Module Visibility Enforcement

### New hook: `useModuleVisibility(moduleKey, sectionKey?)`
Returns `{ visible: boolean, loading: boolean }` by checking `module_visibility_config` against the current admin's profile.

### Apply to `EscrowDashboard.tsx`
Wrap each section (Total Revenue card, Revenue by Type cards, Payment Pipeline, Office Breakdown, Auto/Manual Release, Receipts) in visibility checks using section keys like:
- `escrow.total_revenue`
- `escrow.revenue_by_type`
- `escrow.payment_pipeline`
- `escrow.office_breakdown`
- `escrow.auto_release`
- `escrow.manual_release`
- `escrow.receipts`

### Apply to Rent Cards pages
Wrap advanced actions (inventory adjustment, stock correction, batch revoke, serial reset, quota reset) with visibility checks.

---

## Phase 4: Feature Renaming System

### New hook: `useFeatureLabel(featureKey, portal, defaultLabel)`
Returns the custom label if one exists, otherwise the default.

### Apply to `RegulatorLayout.tsx`
Replace hardcoded nav labels with `useFeatureLabel()` calls.

### Apply to `LandlordLayout.tsx` and `TenantLayout.tsx`
Same pattern for landlord/tenant portal nav items.

---

## Phase 5: Ledger Cleanup (Item 5)

Rather than deleting data, add an `operational_start_date` config (default: `2025-04-07`). All dashboard queries in `EscrowDashboard.tsx`, `RegulatorDashboard.tsx`, reconciliation pages, and PDF exports will add a `>=` filter on this date. Super Admin can adjust this date from their dashboard.

This preserves historical data while giving clean operational baselines.

---

## Phase 6: Payment Processor Charges Display (Item 6)

### Changes to `EscrowDashboard.tsx`
- Add a "Payment Processor Deductions" info card showing: **1.95% processing fee** and **GHS 1 per transfer**.
- In the Allocation Summary, add a row for estimated processor charges.
- In PDF/CSV exports, include a "Payment Processor Charges" section with these figures.

### Changes to `PaymentReceipt.tsx`
Add a footnote: "Note: Payment processor charges (1.95% + GHS 1/transfer) are deducted by the payment provider before settlement."

---

## Files to Create
| File | Purpose |
|------|---------|
| `src/pages/regulator/SuperAdminDashboard.tsx` | Main Super Admin control panel |
| `src/hooks/useModuleVisibility.ts` | Section-level visibility hook |
| `src/hooks/useFeatureLabel.ts` | Feature renaming hook |

## Files to Modify
| File | Change |
|------|--------|
| `src/hooks/useAdminProfile.ts` | Add `super_admin` type support, add `isSuperAdmin` flag |
| `src/components/RegulatorLayout.tsx` | Add Super Admin nav item, apply feature labels |
| `src/components/LandlordLayout.tsx` | Apply feature label overrides |
| `src/components/TenantLayout.tsx` | Apply feature label overrides |
| `src/pages/regulator/EscrowDashboard.tsx` | Add section visibility checks, processor charges display, operational date filter |
| `src/pages/regulator/RegulatorRentCards.tsx` | Add visibility checks on advanced actions |
| `src/pages/regulator/EngineRoom.tsx` | Super Admin gate on sensitive sections |
| `src/components/PaymentReceipt.tsx` | Add processor charges footnote |
| `src/App.tsx` | Add Super Admin dashboard route |

## Database Migrations
1. Create `module_visibility_config` table with RLS
2. Create `feature_label_overrides` table with RLS
3. Create `platform_config` table (for operational_start_date)
4. Update `admin_staff` to support `super_admin` type

---

## Important Notes

- **No code logic breaks**: Renaming only affects display labels, not routing or feature keys.
- **Backward compatible**: Existing `main_admin` accounts keep working. Super Admin is an upgrade.
- **Data preserved**: Ledger cleanup uses date filtering, not deletion.
- This is a large feature set. I recommend implementing Phases 1-2 first, then 3-6 incrementally.

