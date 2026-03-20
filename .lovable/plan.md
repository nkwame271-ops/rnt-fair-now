

# Fix: Serial Re-upload, Tenant Region, and Archived Account Re-registration

## Four Issues

### 1. Serial re-upload fails with unique constraint violation
**Root cause**: The `rent_card_serial_stock` table has a UNIQUE constraint on `serial_number` (`rent_card_serial_stock_serial_number_key`). The previous fix correctly filters the frontend check to skip revoked serials, but when inserting, the old revoked row still exists in the DB — causing a unique constraint violation.

**Fix**: Before inserting new serials, DELETE the revoked rows that match the incoming serial numbers. This clears the way for the fresh insert. The flow becomes:
1. Check for `available`/`assigned` duplicates (skip those)
2. Delete any `revoked` rows matching the remaining serials
3. Insert the new rows

### 2. PendingPurchases assign error
The "duplicate key" error on assignment likely happens when a serial that was previously revoked still exists in the table. The assignment flow uses UPDATE on existing `available` rows — it shouldn't hit a unique constraint. This is likely the same root cause as issue 1 (stale revoked rows from a previous failed re-upload attempt). Fixing issue 1 resolves this.

### 3. Tenant registration: Region of Stay required
The tenant registration form currently has no region/location field. The landlord form has a `region` field and validates it. The tenant form should also require a "Region of Stay" field on Step 0 (Account), stored in `profiles.delivery_region`.

### 4. Archived accounts should allow re-registration
Currently both `deactivated` and `archived` statuses block registration. Per the user's request: `deactivated` = permanently blocked, `archived` = number freed for re-use. Fix both `RegisterTenant.tsx` and `RegisterLandlord.tsx` to only block on `deactivated`, not `archived`.

## Files Changed

| File | Change |
|---|---|
| `src/pages/regulator/rent-cards/SerialBatchUpload.tsx` | Delete revoked rows before inserting new ones |
| `src/pages/RegisterTenant.tsx` | Add required Region of Stay field; remove `archived` from registration block |
| `src/pages/RegisterLandlord.tsx` | Remove `archived` from registration block |

## Technical Details

### SerialBatchUpload.tsx
After filtering out `available`/`assigned` duplicates and before the insert, add a step to delete revoked rows matching `newSerials`:
```typescript
// Delete revoked rows so we can re-insert them fresh
const revokedToDelete = serials.filter(s => !existingSet.has(s));
for (let i = 0; i < revokedToDelete.length; i += 100) {
  const batch = revokedToDelete.slice(i, i + 100);
  await supabase.from("rent_card_serial_stock")
    .delete()
    .in("serial_number", batch)
    .eq("status", "revoked");
}
```

### RegisterTenant.tsx
- Add `region` state and a Region of Stay `<Select>` dropdown on Step 0 using the existing `regions` import
- Make it required in `canProceed`: `fullName.length > 2 && isValidPhone(phone) && !!region`
- Save to `profiles.delivery_region` during account creation
- Change deactivation check from `=== "deactivated" || === "archived"` to only `=== "deactivated"`

### RegisterLandlord.tsx
- Change deactivation check from `=== "deactivated" || === "archived"` to only `=== "deactivated"`

