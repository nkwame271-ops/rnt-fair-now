

# Fix: Rent Card Purchase When Fee Is Deactivated

## Problem

When the rent card fee is deactivated in Engine Room, the `paystack-checkout` edge function returns `{ skipped: true, message: "Rent card fee is currently waived" }` but **never creates any rent card records**. Card creation only happens in `verify-payment` after a successful Paystack payment. So when the fee is waived, the landlord sees a toast but gets no cards.

## Fix

In `paystack-checkout/index.ts`, when rent card fee is not enabled (`!fee.enabled`), create the card records directly before returning the "skipped" response — mirroring how tenant/landlord registration auto-completes when fees are waived.

## File Changed

| File | Change |
|---|---|
| `supabase/functions/paystack-checkout/index.ts` | In the `rent_card_bulk` block, when `!fee.enabled`, create `qty * 2` rent card records with status `awaiting_serial` and a generated `purchase_id` before returning the skipped response |

## Technical Details

In the `rent_card_bulk` section (around line 274), replace the early return with:

```typescript
if (!fee.enabled) {
  // Create cards directly when fee is waived
  const cardCount = cardQty * 2;
  const { data: purchaseIdData } = await supabaseAdmin.rpc("generate_purchase_id");
  const purchaseId = purchaseIdData || `PUR-${Date.now()}`;
  const rentCards = [];
  for (let i = 0; i < cardCount; i++) {
    rentCards.push({
      landlord_user_id: userId,
      status: "awaiting_serial",
      purchase_id: purchaseId,
      purchased_at: new Date().toISOString(),
      qr_token: crypto.randomUUID(),
    });
  }
  await supabaseAdmin.from("rent_cards").insert(rentCards);
  return new Response(JSON.stringify({ skipped: true, message: "Rent card fee is currently waived. Cards created!" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

Same fix applied to the single `rent_card` type block (line 284) for consistency.

