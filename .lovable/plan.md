

# Fix Plan: Two Issues

## Issue 1 — Batch Upload serials not appearing in Regional Stock

**Root cause**: `SerialBatchUpload.tsx` inserts rows without setting `pair_index`. The default is `NULL`. But `OfficeAllocation.tsx` (line 67) filters regional stock with `.eq("pair_index", 1)`, so batch-uploaded serials are invisible.

**Fix**: In `SerialBatchUpload.tsx`, add `pair_index: 1` to each inserted row (line 112-118). Batch uploads are unpaired single serials, so `pair_index: 1` is correct and makes them visible in the regional stock count.

**File**: `src/pages/regulator/rent-cards/SerialBatchUpload.tsx` — add `pair_index: 1` to the row object.

---

## Issue 2 — Numbers Only allocation not reflected on Office Stock cards

**Root cause**: `OfficeSerialStock.tsx` only queries serials with `stock_type = "office"`. Numbers-only allocations don't move serials (by design), so nothing appears on the office stock card. The quota info panel exists but is separate from the stock cards.

**Fix**: Merge the quota allocation into the stock card display so the office dashboard reads correctly. Specifically:

- In `OfficeSerialStock.tsx`, add the quota's `remaining` count to the "Opening Rent Card Pairs" and "Closing Rent Card Pairs" cards as an additive display component.
- The cards will show: physical stock + quota allocation combined, with a small label distinguishing the two sources.
- Example: Opening Pairs = `physicalAvailable + quotaRemaining`, with subtitle showing breakdown like "3 physical + 5 quota".

**File**: `src/pages/regulator/rent-cards/OfficeSerialStock.tsx` — update the stock summary cards (lines 277-303) to include quota counts in the totals.

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/regulator/rent-cards/SerialBatchUpload.tsx` | Add `pair_index: 1` to inserted rows |
| `src/pages/regulator/rent-cards/OfficeSerialStock.tsx` | Merge quota counts into office stock card display |

