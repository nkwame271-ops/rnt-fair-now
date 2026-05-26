## Problem

In `src/pages/regulator/rent-cards/PendingPurchases.tsx`, the `SerialSearchCombobox` (lines ~20–147) renders its options list via `createPortal(..., document.body)`. The outside-click listener it installs only checks whether the mousedown target is inside `containerRef` (the input/trigger). Because the portal is rendered outside that container, every click on an option is treated as "outside":

1. User mousedowns an option
2. Document `mousedown` handler fires first → `setOpen(false)` → dropdown unmounts
3. The option's `onClick` never fires (element is gone)
4. The synthetic click lands on whatever element is now under the cursor (table row, button, dialog backdrop), causing the "click passes through" behavior

The existing `onMouseDown={(e) => e.preventDefault()}` only blocks focus shift; it does not stop propagation to the document listener.

## Fix

Make the outside-click detection aware of the portaled dropdown.

1. Add a `dropdownRef` on the portaled `<div>`.
2. In the `mousedown` handler, return early if the target is inside `containerRef` **or** `dropdownRef`.
3. Also add `onMouseDown={(e) => e.stopPropagation()}` on the dropdown container as a belt-and-braces guard so the document handler never sees the event.
4. Keep `onMouseDown={(e) => e.preventDefault()}` on the option buttons (prevents the input from losing focus mid-click).

This keeps the portal (needed so the dropdown isn't clipped by overflow/dialog containers) while ensuring clicks inside it select the serial instead of falling through.

## Verification

- Open Rent Cards → Pending Purchases → Assign on a row
- Type a partial serial, click a result → input populates with the chosen serial, dropdown closes, no stray click on background elements
- Confirm clicking the input again reopens the dropdown and outside clicks still close it
- Confirm scroll/resize still keeps the portal aligned (existing `updateRect` logic untouched)

## Files touched

- `src/pages/regulator/rent-cards/PendingPurchases.tsx` — only the `SerialSearchCombobox` component (~20 lines changed). No other rent-card files or shared components affected.
