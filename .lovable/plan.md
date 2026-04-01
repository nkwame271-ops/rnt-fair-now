

# Plan: Rent Card Requirement in Declare Tenancy + Tax Revenue Split UI Fix

## Summary

Two changes: (1) Make rent card selection mandatory in the "Declare Existing Tenancy" flow (matching the Add Tenant flow), and (2) Fix the Engine Room Split Engine UI to display rent_tax splits as percentages instead of flat amounts, and ensure the tax payment from Tenant Portal is properly linked.

---

## 1. DeclareExistingTenancy.tsx — Make Rent Cards Required

Currently rent cards are shown as "optional" and only when `availableRentCards.length >= 2`. Change to:

- **Remove the "optional" label** — rename to "Assign Rent Cards"
- **Make both selections required** for form progression: the "Next: Review" button on the Details step should be disabled unless both `selectedRentCardId` and `selectedRentCardId2` are selected
- **Show a warning** if the landlord has fewer than 2 available cards, directing them to purchase rent cards first
- **Show selected rent card serials in the Review step** summary

## 2. EngineRoom.tsx — Display Rent Tax Splits as Percentages

The `split_configurations` table already stores `amount_type: 'percentage'` for `rent_tax` entries, and the backend (`getTaxSplitPlan`) already handles percentage-based distribution. The UI fix:

- In the Split Engine section, detect when `amount_type === 'percentage'` on splits
- Show "%" instead of "GH₵" prefix
- Show "Total: 100%" instead of "Total: GH₵ X" for percentage-based payment types
- Use step="1" instead of step="0.5" for percentage inputs

## 3. Payments.tsx — Already Connected

The tenant's "Pay Tax Online" flow already calls `paystack-checkout` with `type: "rent_tax_bulk"`, which calls `getTaxSplitPlan()` that reads from `split_configurations` where `payment_type = 'rent_tax'`. The percentage-based splits are already being applied. No backend changes needed — the connection is already in place.

---

## Files to Change

| File | Change |
|---|---|
| `src/pages/landlord/DeclareExistingTenancy.tsx` | Make rent card selection mandatory; show warning if < 2 cards available; add cards to review summary |
| `src/pages/regulator/EngineRoom.tsx` | Detect `amount_type` on splits; show "%" for percentage types, "GH₵" for flat; adjust totals display |

