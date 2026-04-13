

# Fix: Existing Tenancy Band Allocations, Engine Room for Super Admin, Escrow Report Visibility

## Issues Found

### 1. Existing Tenancy Rent Bands — No way to add allocations
The database has zero `rent_band_allocations` rows for existing tenancy bands. The UI only shows an edit interface for existing allocations — there is no "Add Allocation" button. Users see "No allocations configured" with no action available.

**Fix**: Add an "Add Allocation" button for each fee type (register_tenant_fee, filing_fee, agreement_sale) within the expanded band view. When clicked, insert a new `rent_band_allocations` row with the selected recipient and amount. Also add this capability to the add_tenant bands for consistency.

### 2. Engine Room empty for Super Admin
The loading guard exists (line 617), and `isMainAdmin` includes super_admin (useAdminProfile line 55). The issue is likely that when logged in as Super Admin, the `useAllFeatureFlags` hook returns empty `flags` because the query may be failing or the component is stuck. Need to check: the `isMainAdmin` variable on line 477 is computed AFTER the loading guard on line 617, which uses the raw `loading` from `useAllFeatureFlags`. If flags are empty but `loading` is false, the page renders with no content because all sections check `xxxFlags.length > 0`.

Actually, looking more carefully: the Engine Room renders sections based on `isMainAdmin` and flag categories. If `profile` is `null` (e.g., super admin user doesn't have an `admin_staff` row), then `isMainAdmin` is `false` and nothing renders. The super admin must have an `admin_staff` record with `admin_type = 'super_admin'`.

**Fix**: Check if the super admin has an admin_staff record. If the issue is that `profile` returns null, add a fallback: if user has super_admin role but no admin_staff record, treat them as main admin. Additionally, ensure the loading guard properly handles the case where profile is null but user is authenticated as regulator.

### 3. Escrow Report shows muted cards (Auto/Manual Released)
The CSV export (lines 313-314) and PDF export (lines 368-369) always include "Auto-Released" and "Manually Released" lines regardless of whether `auto_release` and `manual_release` sections are visible on the dashboard.

**Fix**: Wrap the Auto-Released and Manually Released lines in the CSV and PDF exports with `isVisible("escrow", "auto_release")` and `isVisible("escrow", "manual_release")` checks, matching the dashboard visibility logic.

## Files to Modify

1. **`src/pages/regulator/EngineRoom.tsx`**
   - Add "Add Allocation" button for each fee type in both add_tenant and existing_tenancy band sections
   - Add handler `handleAddAllocation(bandId, paymentType, recipient)` that inserts a new row into `rent_band_allocations`
   - Add recipient selector (dropdown: IGF, Admin, Platform) next to the add button

2. **`src/pages/regulator/EscrowDashboard.tsx`**
   - In `exportCSV()`: conditionally include Auto-Released and Manually Released lines based on visibility
   - In `exportPDF()`: same conditional logic for the summary items

3. **`src/pages/regulator/EngineRoom.tsx`** (Engine Room loading)
   - Add fallback: if `profile` is null but user has regulator role, show a message or treat as main admin
   - Check super admin admin_staff record exists

## Technical Details

**Add Allocation handler**:
```typescript
const handleAddAllocation = async (bandId: string, paymentType: string, recipient: string) => {
  const { data, error } = await supabase
    .from("rent_band_allocations")
    .insert({ rent_band_id: bandId, payment_type: paymentType, recipient, amount: 0, description: `${RECIPIENT_LABELS[recipient]} - ${PAYMENT_TYPE_LABELS[paymentType]}`, sort_order: bandAllocations.filter(a => a.rent_band_id === bandId && a.payment_type === paymentType).length })
    .select()
    .single();
  // Update local state
};
```

**Escrow report visibility fix**:
```typescript
// In exportCSV summary section
const summaryRows = [
  ["Total Revenue", `GHS ${visibleRevenueTotal.toFixed(2)}`],
  ["Completed Transactions", String(stats.completed)],
  ["Pending Transactions", String(stats.pending)],
];
if (isVisible("escrow", "auto_release")) summaryRows.push(["Auto-Released", `GHS ${stats.autoReleased.toFixed(2)}`]);
if (isVisible("escrow", "manual_release")) summaryRows.push(["Manually Released", `GHS ${stats.manualReleased.toFixed(2)}`]);
```

