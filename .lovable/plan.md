

# Updated Rent Card Logic

## Summary of Changes

The rent card system needs to align with the physical card model: each purchase creates exactly 2 cards (a pair), serial assignment gets a bulk selection UI, and tenancy creation already handles the 2-card pairing correctly.

## What Changes

### 1. Purchase creates 2 cards per unit purchased
Currently buying qty=4 creates 4 cards. Updated: qty=4 creates 8 cards (4 pairs). The purchase quantity represents "pairs of cards", not individual cards.

### 2. Assignment UI — bulk selection with checkboxes
Currently the admin must open a mapping dialog per purchase. Updated: show all pending cards for a landlord with checkboxes. Admin can select specific cards or "Select All", then bulk-assign serials from office stock in one action.

### 3. Status alignment
Current statuses already map correctly:
- `awaiting_serial` → Awaiting Serial (Stage 1)
- `valid` → Available (Stage 2, has serial, not yet used)
- `active` → Used (Stage 3, linked to tenancy)

No status rename needed — the flow is already correct.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/verify-payment/index.ts` | Multiply quantity by 2 when creating rent cards |
| `supabase/functions/paystack-webhook/index.ts` | Same — multiply by 2 for the fallback card creation |
| `src/pages/landlord/ManageRentCards.tsx` | Update purchase UI labels: "1 purchase = 2 cards (1 pair)" |
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | Add checkbox selection for individual cards + "Select All" toggle, bulk assign button that opens the serial mapping dialog for selected cards only |

## Technical Details

### verify-payment/index.ts & paystack-webhook/index.ts
Change the card creation loop from `qty` to `qty * 2`:
```typescript
const cardCount = qty * 2; // Each purchase = 1 pair = 2 cards
for (let i = 0; i < cardCount; i++) {
  rentCards.push({ ... });
}
```

### ManageRentCards.tsx
- Update the purchase section label: "Each purchase includes 2 rent cards (Landlord Copy + Tenant Copy)"
- Update the price display: show per-pair pricing
- Keep quantity selector as "Number of pairs"

### PendingPurchases.tsx
- Add `selectedCardIds: Set<string>` state for checkbox tracking
- Show individual card rows with checkboxes instead of grouping by purchase
- Add "Select All" / "Deselect All" toggle
- "Assign Serials" button opens the mapping dialog for only the selected cards
- Keep the existing per-card serial dropdown mapping in the dialog
- Keep "Auto-fill sequential" shortcut

