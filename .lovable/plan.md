

# Fix: Range Transfer "Invalid serial range" Error

## Root Cause

The backend `admin-action` function (line 297-301) does `parseInt(aStartSerial, 10)` on full serial strings like `RCD-2026-GAR-0001`. `parseInt("RCD-2026-GAR-0001")` returns `NaN`, which triggers the error `"Invalid serial range: end must be >= start"`.

The frontend was updated to send full serial strings (from the searchable picker), but the backend validation was never updated to match.

## Fix

**File: `supabase/functions/admin-action/index.ts`** (lines 297-316)

Replace the numeric `parseInt` validation with a string comparison:

1. Remove `parseInt(aStartSerial)` / `parseInt(aEndSerial)` and the `isNaN` check
2. Validate using simple string comparison: `aEndSerial < aStartSerial` (alphabetical — works because serials share a common prefix and are zero-padded)
3. Remove `expectedCount` calculation based on integer subtraction — it's meaningless for full serial strings
4. Instead, query all available regional serials between `aStartSerial` and `aEndSerial` using the existing `.gte()` / `.lte()` query (lines 307-316), then use the actual result count as the transfer count
5. Remove the `uniqueCount < expectedCount` check (line 331-333) since we no longer have a pre-computed expected count — transfer whatever is found in the range, or error if zero results

The `.gte("serial_number", aStartSerial).lte("serial_number", aEndSerial)` query on lines 313-314 already works correctly with full serial strings, so no change needed there.

### Updated validation logic (pseudocode):
```
if (aStartSerial > aEndSerial) throw "end must be >= start";
// query serials in range...
if (results.length === 0) throw "No serials found in range";
// proceed with transfer using actual results
```

No frontend changes needed — the frontend already sends full serial strings correctly.

