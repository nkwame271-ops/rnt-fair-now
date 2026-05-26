# Fix: Rent Card serial picker clicks pass through

## Root cause

`SerialSearchPicker` in `src/pages/regulator/rent-cards/PendingPurchases.tsx` is rendered inside the "Assign Serials" Radix `Dialog`. Its dropdown list is portaled to `document.body` via `createPortal`. When a Radix `Dialog` is open it sets `pointer-events: none` on `body`, which is inherited by the portaled dropdown — so clicks "pass through" to the dialog overlay (which closes the dialog or hits elements behind), even though z-index (10000) is above the overlay.

Additionally, Radix `DialogContent` treats any pointerdown outside the dialog content as an "outside click" and will close the dialog when the user mousedowns on the portaled list.

## Fix

Edit only `src/pages/regulator/rent-cards/PendingPurchases.tsx`:

1. Force `pointerEvents: 'auto'` on the dropdown wrapper so it captures clicks even when an ancestor (body) has `pointer-events: none`.
2. Mark the dropdown so Radix Dialog ignores it as an "outside" interaction:
   - Add `data-serial-picker-dropdown` attribute to the portaled div.
   - On the parent `Dialog`'s `DialogContent`, add `onPointerDownOutside` and `onInteractOutside` handlers that call `e.preventDefault()` when `e.target` is inside an element with `[data-serial-picker-dropdown]`. This stops the dialog from closing and lets the dropdown's own `onClick` fire.
3. Keep the existing `onMouseDown={e => e.preventDefault()}` on each option button (preserves input focus) and the `onClick` for selection.
4. Bump dropdown `z-index` is unnecessary — keep at 10000.

## Verification

- Open Rent Cards → Sales → Pending & Assign.
- Select a pending card, open the "Assign Serials" dialog.
- Type in the serial search field, click a result.
- Expected: result is selected, dropdown closes, dialog stays open.
