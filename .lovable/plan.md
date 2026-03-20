

# Fix Rent Card Stock Display, Deletion, and Serial Search

## Problems Identified

1. **Office Stock shows only 1,000**: Supabase has a default 1,000-row query limit. `OfficeSerialStock.tsx` fetches without pagination, so anything beyond 1,000 is silently truncated.

2. **Assignment dialog shows only 500 serials**: `PendingPurchases.tsx` line 165 has an explicit `.limit(500)`.

3. **No delete option for uploaded stock**: Main admin cannot delete uploaded serial batches from the UI.

4. **No serial search in assignment dialog**: The Select dropdown only supports scrolling, not typing to filter.

## Changes

| File | Change |
|---|---|
| `OfficeSerialStock.tsx` | Paginated fetch (loop in batches of 1000 until exhausted) to load ALL serials. Add "Delete Batch" button per batch row for main admins. |
| `PendingPurchases.tsx` | Remove `.limit(500)`, use same paginated fetch pattern. Replace `Select` dropdown with a searchable `Combobox`-style input (text input with filtered dropdown list). |

## Technical Details

### Paginated fetch pattern (both files)
```typescript
let allData: any[] = [];
let from = 0;
const PAGE = 1000;
while (true) {
  const { data } = await supabase
    .from("rent_card_serial_stock")
    .select("...")
    .eq("office_name", office)
    .range(from, from + PAGE - 1)
    .order("serial_number", { ascending: true });
  if (!data || data.length === 0) break;
  allData = allData.concat(data);
  if (data.length < PAGE) break;
  from += PAGE;
}
```

### Delete batch (OfficeSerialStock)
- Add a "Delete Batch" button next to each batch row, visible only for main admins
- Deletes all `available` serials in the batch (not assigned ones)
- Shows confirmation count before deleting
- Uses `supabase.from("rent_card_serial_stock").delete().eq("batch_label", label).eq("status", "available")`

### Searchable serial picker (PendingPurchases)
- Replace the `Select` component with a custom searchable input:
  - Text input that filters the serial list as admin types
  - Dropdown below showing filtered matches (virtualized or capped display)
  - Clicking a match selects it
  - Shows the selected serial as a badge
- This allows the admin to type e.g. "RC-20260319-3842" to jump directly to that serial

