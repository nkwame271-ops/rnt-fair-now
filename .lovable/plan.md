

# Rent Card Sales: Four Assignment Modes

## Current State

The `PendingPurchases.tsx` component currently has a single assignment flow: auto-assign the next N sequential serials from office stock. The mapping dialog shows a summary and a single "Confirm Auto-Assignment" button.

## Plan

Redesign the assignment dialog to offer four distinct modes via a radio group selector.

### Assignment Modes

1. **Auto Assign by Quantity** (current default) — Picks the next N available serials sequentially from office stock. No extra input needed.

2. **Auto Assign with Start From** — User picks a starting serial from a searchable dropdown. System auto-selects N sequential serials starting from that point.

3. **Assign by Range** — User picks a "From" serial and a "To" serial. System selects all available serials within that range. Validates that count matches cards selected.

4. **Manual Assignment** — Shows the existing `SerialSearchPicker` for each card, allowing one-by-one serial selection (the old mapping UI behavior).

### UI Changes

**File: `src/pages/regulator/rent-cards/PendingPurchases.tsx`**

Replace the current assignment dialog content (lines 511-582) with:

- A `RadioGroup` with 4 options at the top of the dialog
- Conditional content below based on selected mode:
  - **Auto Quantity**: Current summary view (no extra inputs)
  - **Start From**: A single `SerialSearchPicker` for the starting serial, plus a preview of the N serials that will be assigned
  - **Range**: Two `SerialSearchPicker` components (From/To), with validation showing how many serials fall in range vs how many cards are selected
  - **Manual**: A scrollable list with one `SerialSearchPicker` per card (re-uses existing component)
- The confirm button label adapts per mode
- All modes use the same `handleConfirmAssign` logic (they just populate `serialMap` differently before calling it)

### Technical Details

- Add `assignMode` state: `"auto_qty" | "start_from" | "range" | "manual"`
- For "Start From": filter `availableSerials` to those at or after the chosen start serial, take N
- For "Range": filter `availableSerials` between from/to serials inclusive
- For "Manual": use existing `SerialSearchPicker` per card with `serialMap` state
- Import `RadioGroup, RadioGroupItem` from UI components
- No database or backend changes needed

