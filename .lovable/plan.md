

# Fix: Paired Serial Assignment "Claimed by Another Admin" Error

## Root Cause

In `handleConfirmAssign`, the loop processes all 14 cards sequentially. Two cards share the same serial number. When the first card in a pair updates the stock row to `status="assigned"`, the second card tries to update the **same row** with `.eq("status", "available")` — which now fails because the status is already `"assigned"`. This triggers the false "claimed by another admin" error.

## Fix

**File: `src/pages/regulator/rent-cards/PendingPurchases.tsx`** — `handleConfirmAssign` function (lines 470-524)

Track which serials have already been processed in this batch. When the second card in a pair encounters a serial that was already assigned by the first card in the same batch, skip the stock update (it's already done) and just update the `rent_cards` table.

### Changes:

1. Add a `Set<string>` called `processedSerials` before the loop
2. Inside the loop, check if `chosenSerial` is already in `processedSerials`:
   - **If NOT processed**: Do the full stock update (pair_index=1 + pair_index=2) as before. Add to `processedSerials`.
   - **If already processed**: Skip the stock update entirely — the serial rows are already marked assigned. Only update the `rent_cards` row with the serial number and status.
3. This ensures each unique serial's stock rows are updated exactly once, while all cards in the pair get their `rent_cards` record updated.

### Pseudocode:
```
const processedSerials = new Set<string>();

for (const card of mappingCards) {
  const chosenSerial = serialMap[card.id];
  
  if (!processedSerials.has(chosenSerial)) {
    // First card in pair: update stock rows
    update pair_index=1 WHERE status=available → check success
    update pair_index=2 WHERE status=available
    processedSerials.add(chosenSerial);
  }
  // else: second card in pair — stock already updated, skip
  
  // Always: update the rent_cards row
  update rent_cards SET serial_number, status='valid' WHERE id=card.id
}
```

No backend or database changes needed. Single file fix.

