

# Manual Serial-to-Card Assignment in Pending Purchases

## What Changes

Currently, clicking "Assign" on a pending purchase auto-picks the next available serials from office stock sequentially. The admin has no control over which specific serial goes to which card.

**New flow**: After clicking "Assign", instead of immediately assigning, show a mapping UI where the admin can pick a specific serial number for each pending rent card. Each card row shows the card ID and a searchable dropdown of available serials from the office. The admin confirms once all cards are mapped.

## File Changed

| File | Change |
|---|---|
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | Replace auto-assign with a manual serial picker UI |

## Technical Details

### PendingPurchases.tsx

1. **New state**: `mappingPurchase` (the purchase being mapped), `serialMap` (Record of cardId → selected serial), `availableSerials` (fetched list of available serials for the office).

2. **When admin clicks "Assign"**: Instead of running the assignment loop, fetch all available serials for the office and set `mappingPurchase` to that purchase. Show a modal/inline panel.

3. **Mapping UI**: For each `card_id` in the purchase, render a row with:
   - Card ID (truncated)
   - A searchable input/select to pick a serial number from `availableSerials`
   - The selected serial is removed from the available list for other rows (no duplicates)

4. **"Confirm Assignment" button**: Runs the existing atomic claim logic but uses the admin-selected serial for each card instead of sequential auto-pick. Falls back gracefully if a selected serial was claimed by another admin (toast error for that specific card).

5. **Quick-fill option**: Keep a "Auto-fill sequential" button that pre-fills all cards with the next N available serials (preserving current behavior as a shortcut).

