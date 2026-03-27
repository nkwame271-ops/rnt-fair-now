

# Tenancy Rejection Flow + Admin Property Status Filters

## 1. Tenant Rejects Agreement — Cascading Updates

**Current behavior**: `handleReject` in `MyAgreements.tsx` (line 111-122) only updates the tenancy to `status: "rejected"` and `tenant_accepted: false`. It does NOT:
- Update the unit status back to `vacant`
- Update the property status back to `live`
- Re-enable marketplace listing

**Fix in `MyAgreements.tsx` — `handleReject` function**:
After updating the tenancy, also:
1. Fetch the tenancy's `unit_id` and the unit's `property_id`
2. Update the unit status to `vacant`: `supabase.from("units").update({ status: "vacant" }).eq("id", unitId)`
3. Check if the property has any remaining occupied units — if none, update property to `live` and `listed_on_marketplace: true`: `supabase.from("properties").update({ property_status: "live", listed_on_marketplace: true }).eq("id", propertyId)`

**Fix in `Agreements.tsx` (landlord)**: The landlord agreements page already shows tenancy status. After rejection, it should display "Rejected" badge instead of "Pending Acceptance". The current code uses `t.status` which will show correctly once the DB updates — just need to add `rejected` to the status badge rendering logic.

**Landlord Agreements.tsx** — add rejected status display:
```tsx
// Add to status badge rendering
t.status === "rejected" ? "bg-destructive/10 text-destructive" : ...
```

## 2. Admin Properties — Status Filter Menus

**Current behavior**: `RegulatorProperties.tsx` has search by name/code/region (line 148-152) but no status filter dropdown.

**Fix**: Add a status filter `Select` dropdown next to the search bar. The `statusLabels` object (line 256-268) already defines all possible statuses. Add a `statusFilter` state and filter `filtered` results by `property_status`.

**Changes**:
- Add `const [statusFilter, setStatusFilter] = useState("all")`
- Add a `Select` dropdown with options: All, Draft, Identity Review, Under Assessment, Approved, Live, Occupied, Off Market, Rent Review, Suspended, Archived, Needs Update
- Update `filtered` to also filter by `statusFilter` when not "all"
- Show count per status in the dropdown labels (e.g., "Live (12)")

---

## Files Changed

| File | Change |
|---|---|
| `src/pages/tenant/MyAgreements.tsx` | Expand `handleReject` to update unit → vacant, property → live |
| `src/pages/landlord/Agreements.tsx` | Add "Rejected" status badge styling |
| `src/pages/regulator/RegulatorProperties.tsx` | Add status filter dropdown |

