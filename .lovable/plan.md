## Scope

Both issues live in `src/pages/regulator/rent-cards/PendingPurchases.tsx` (and a small read into Admin Actions for the super-admin deep link).

---

## Issue 1 — SerialSearchPicker dropdown overlaps the search box

### Root cause
The portaled dropdown panel inside the assignment dialog uses `position: fixed` with style computed in a `useLayoutEffect`. On open, the panel renders **once with an empty style object** (no `top/left/width`), so for one paint it lands at body origin (0,0) covering the field above it. The flip-up branch also leaves a stale `top` from a previous open, which can pin the panel on top of the trigger input.

### Fix
In `SerialSearchPicker`:
1. Hide the panel until positioned: render the portal only when `panelStyle.left` is set, OR start the style with `visibility: 'hidden'` and flip to `visible` after reposition.
2. In `reposition()`, always reset the unused axis (`top: 'auto'` when flipping up, `bottom: 'auto'` when flipping down) so a stale value can't pin the panel over the input.
3. Run `reposition()` synchronously inside `setOpen(true)` callbacks (call it from a `useLayoutEffect` keyed on `open` AND immediately before the first paint by computing the rect when toggling open via a ref-based handler), so the first frame already has correct coordinates.
4. Bump panel `zIndex` from 80 to 100 to sit above any sticky dialog headers/footers, and add a small `marginTop` gap so it visually clears the input.
5. Make the trigger input keep focus when the panel opens (`inputRef.current?.focus()` after `setOpen(true)`), so the user can keep typing without the panel stealing pointer-events.

No backend / RPC changes.

### Verification
- Open Pending & Assign → select cards → pick "Start From" / "Range" / "Manual" modes.
- Confirm the picker input is always clickable, the dropdown never overlaps it, and the dropdown flips up cleanly near the dialog's bottom edge on the 724×665 preview viewport.

---

## Issue 2 — "Found elsewhere: in your regional pool. No quota remaining" while office balance looks sufficient

### Root cause
`quotaRemaining` (lines 502–525) only counts `office_allocations.allocation_mode IN ('quota','quantity_transfer','quota_withdrawal')`. The DB also has `transfer` and `range_transfer` modes (verified via `office_allocations`). Those *do* move physical stock and aren't quota — so the calculation itself is correct — **but** the message conflates two different "balance" concepts:

- The office has **physical stock** balance (assignable today).
- The searched serial lives in the **regional pool**, not the office.
- The office has 0 **regional quota** left → the picker cannot pull that pool serial.

So the message "your office has no quota remaining" is technically right but reads as wrong because the user is looking at their physical balance. There is also no super-admin path to retrieve / transfer that pool serial from within the picker.

### Fix
In `explainHit()` and the "Found elsewhere" panel:
1. Make the wording explicit: when a serial is in the regional pool and the office has 0 quota, say:
   > "Serial is in the {region} regional pool (not currently in any office stock). Your office has used all its regional quota — request more quota OR transfer this specific serial into office stock to assign it."
2. Always show, for every hit, the **stock location bucket** (Office stock / Regional pool / Other office / Other region) as a colored label so the user immediately sees why it isn't selectable.
3. For super admins, render an inline "Open in Admin Actions" button that navigates to `/regulator/rent-cards` with a query param `?tab=admin_actions&serial={serial}` (and update `RegulatorRentCards.tsx` to read that query param and switch tabs + prefill the Admin Actions search). This makes the serial directly retrievable.
4. Surface the **regional-pool count** in the dialog summary box alongside "Assignable balance" so it's clear there is pool stock that isn't assignable without quota.

### Verification
- Search a known regional-pool serial as a super admin → the panel now shows the bucket badge and an "Open in Admin Actions" link that lands on Admin Actions with the serial pre-filtered.
- Confirm the message no longer reads as a contradiction with the physical balance.
- Search an office-stock serial belonging to another office → still gets a clear "in {office} office stock — transfer to your office" message.

---

## Files touched

- `src/pages/regulator/rent-cards/PendingPurchases.tsx` — picker positioning, panel wording, super-admin link, summary additions.
- `src/pages/regulator/RegulatorRentCards.tsx` — read `?tab=` and `?serial=` query params to open Admin Actions pre-filtered.
- (Read-only) `src/pages/regulator/rent-cards/AdminActions.tsx` — accept an optional initial search prop/param.

No database migration. No edge-function changes.
