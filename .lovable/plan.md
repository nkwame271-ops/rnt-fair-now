## Problem

In Pending & Assign → Assign Serial, the picker only loads serials that match the admin's office + region + remaining quota. A serial that shows "available" in Admin Actions can still be invisible because it lives in another office, another region, or the office has 0 quota. Today the dropdown just says "No serials found", giving no clue why.

## Fix

Add a global lookup that runs whenever the typed query is long enough (≥ 4 chars) and produces zero local matches. The lookup tells the admin exactly where the serial currently lives and why it can't be assigned from here.

### `src/pages/regulator/rent-cards/PendingPurchases.tsx`

**`SerialSearchPicker`**
- Accept two new props: `officeName: string` and `officeRegion: string | null`.
- When `filtered.length === 0` and `query.length >= 4`, debounce ~300 ms and call a single Supabase query:
  ```
  rent_card_serial_stock
    .select("serial_number, status, stock_type, region, office_name, batch_label")
    .eq("pair_index", 1)
    .ilike("serial_number", `%${query}%`)
    .limit(5)
  ```
- Render results below the "No serials found" line. For each hit show:
  - serial number + status badge
  - a one-line reason derived client-side:
    - `assigned` → "Already assigned"
    - `revoked` → "Revoked"
    - `available` + `stock_type='office'` + `office_name !== officeName` → "In **{office_name}** stock — transfer to your office to assign"
    - `available` + `stock_type='regional'` + `region !== officeRegion` → "In **{region}** regional pool — outside your region"
    - `available` + `stock_type='regional'` + `region === officeRegion` → "In your regional pool — your office has no quota remaining (request a quota or quantity transfer)"
    - `available` + `stock_type='office'` + `office_name === officeName` → "Belongs here but `pair_index=2` only — data anomaly, contact super admin"
- Loading state ("Looking up…") + error swallow (just hide the panel).
- No selection from these hits — they're informational only.

**Caller in `PendingPurchases`** (the `<SerialSearchPicker>` instances in manual mode + start/range inputs)
- Pass `officeName={resolveOffice()}` and `officeRegion={officeId ? getRegionForOffice(officeId) : null}` already computed in `openMappingDialog`. Hoist `officeRegion` into component state so the picker can read it.

### Out of scope
- No change to assignment logic, scoping rules, or quota math.
- No new admin action / migration. Read-only lookup against existing table.
- Range/start-from inputs reuse the same picker so they get the explanation for free.

## Technical notes
- The lookup is a single indexed `ilike` on `serial_number` (already searchable from Admin Actions, so query cost is fine).
- 5-result cap + 4-char minimum + debounce keep keystroke load negligible.
- RLS for regulators on `rent_card_serial_stock` already allows reading these fields (Admin Actions uses the same table).
