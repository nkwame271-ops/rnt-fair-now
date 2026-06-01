## Problems

**1. Dropdown overlaps the search field (Manual mode especially).**
`SerialSearchPicker` renders its results panel as an absolutely-positioned div with `top-full`. In the Manual mode list (`max-h-[50vh] overflow-y-auto`) every row stacks a picker, so an open dropdown sits on top of the next row's input, and is also clipped by the scroll container. The Pending search box can also be visually crowded by the picker panel inside the mapping dialog above it.

**2. Wrong reason: "your office has no quota remaining" when quota is actually available.**
`openMappingDialog` only loads the first `quotaRemaining + 50` regional serials (ordered by `serial_number`). If a super admin types a real serial that lives further down the regional pool, the local list shows no match, the global lookup fires, and `explainHit` blindly returns:
> "In your regional pool — your office has no quota remaining (request a quota or quantity transfer)"
even though `quotaContext.quotaRemaining > 0`.

**3. Super admin can't see exactly where the serial lives.**
The "Found elsewhere" panel hides `office_name`/`region`/`batch_label` for same-region regional hits, so there's nothing to act on to retrieve it.

## Fix (frontend-only, `src/pages/regulator/rent-cards/PendingPurchases.tsx`)

### A. Dropdown positioning & layering
Keep the current lightweight panel but make it escape the scroll container and never hide the input:

- Render the results panel via a React portal to `document.body`, positioned with `getBoundingClientRect()` of the input wrapper (recomputed on `scroll`/`resize`). This removes the `overflow-y-auto` clipping in Manual mode and the "covers the next row's input" problem.
- Choose top/bottom placement based on available viewport space (flip up when the input is in the lower half of the viewport). Cap height with `max-h-[min(18rem,40vh)]` and internal scroll.
- Bump portal z-index to `z-[80]` (above dialog content `z-50`) and keep `pointer-events-auto`.
- Keep the existing outside-click handler but compare against both the trigger ref and the portaled panel ref.
- Pending Purchases page search input is unchanged (it's already above the dialog); the dialog's pickers stop overlapping it once the panel is portaled and flips.

### B. Honest "Found elsewhere" reason
Pass the current `quotaContext` (and the office's region) into `SerialSearchPicker` as a new optional `assignableContext` prop:

```
{ physical: number; quotaRemaining: number; officeRegion: string | null }
```

Update `explainHit` for `status === "available"`:

- `stock_type === "office"` + `office_name === officeName` → unchanged ("anomaly, contact super admin").
- `stock_type === "office"` + other office → "In **{office_name}** ({region}) office stock — transfer to your office to assign".
- `stock_type === "regional"` + `region !== officeRegion` → "In **{region}** regional pool — outside your region".
- `stock_type === "regional"` + `region === officeRegion`:
  - if `quotaRemaining <= 0` → keep current "no quota remaining" message.
  - if `quotaRemaining > 0` → "In your regional pool ({region}) — beyond the currently loaded window. Increase quota usage, or transfer this serial into your office stock to assign it."
- Always append a small secondary line with `Batch: {batch_label || "—"}` so super admin sees exactly which batch to retrieve from.

### C. Super-admin retrieval hint
When `profile.isSuperAdmin` is true, append a one-line action hint under each hit:
- "Open Admin Actions → search **{serial_number}** to transfer or revoke."

(No new admin endpoint — Admin Actions already supports lookup by serial.)

### D. Out of scope
- No backend change, no migration, no change to assignment math or quota rules.
- Pool fetch cap (`quotaRemaining + 50`) is unchanged; only the explanation gets honest. (Raising the cap would belong in a separate change — happy to do it next if you want all regional serials loaded when quota remains.)

## Technical notes
- Portal positioning lives entirely in `SerialSearchPicker`; the four call sites in `PendingPurchases` only pass the new `assignableContext` prop.
- Flip logic: if `rect.bottom + 288 > window.innerHeight` and `rect.top > 288`, render above (`bottom: window.innerHeight - rect.top + 4`); else below (`top: rect.bottom + 4`).
- No new dependencies — uses `createPortal` from `react-dom`.
