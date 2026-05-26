## Plan

1. Update the `SerialSearchPicker` in `src/pages/regulator/rent-cards/PendingPurchases.tsx` so its results panel stays inside the assignment dialog’s interaction layer instead of portaling to `document.body`.
2. Tighten the picker’s event handling so pointer/mouse events are consumed by the dropdown and option buttons, ensuring a click selects the serial immediately instead of reaching the overlay or elements behind the dialog.
3. Re-test the `Pending & Assign` flow in the preview to confirm the dropdown remains clickable, the dialog stays open during selection, and the chosen rent card/serial is applied correctly.

## Technical details

- The current picker is rendered with `createPortal(..., document.body)` inside a Radix `Dialog`, which is the most likely reason the modal’s outside-interaction logic is still treating dropdown clicks as external.
- I’ll make this a targeted fix in `PendingPurchases.tsx` only, preserving the rest of the rent-card assignment flow.
- If needed, I’ll keep the existing z-index safeguards but shift the dropdown to a dialog-local positioned layer and harden `pointerdown`/`mousedown` handling on the dropdown root and option items so selection wins reliably.