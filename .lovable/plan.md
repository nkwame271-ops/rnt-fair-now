
Goal: make serial assignment truly pair-based and atomic, fully reset unassigns, and keep the landlord portal showing 2 cards under 1 serial reliably.

What I found
- `PendingPurchases.tsx` still assigns in a client-side loop, one card at a time.
- When a stock update fails, it shows “claimed by another admin” and `continue`s, so some cards commit while others do not.
- That means the current flow is not atomic, so partial assignment is still possible.
- `admin-action` unassign now clears many tenancy fields, but it should also clear assignment metadata so the card is fully back to “awaiting serial”.
- `ManageRentCards.tsx` already groups by shared `serial_number`, so once backend state is fixed the landlord portal pairing should behave correctly.

Implementation plan

1. Replace client-side assignment with a transactional backend pair-assignment function
- Add a database RPC/function for regulator-only assignment.
- Input should be explicit pair payloads, e.g. one serial + exactly 2 card IDs per pair.
- In one transaction, the function will:
  - lock the selected rent cards and stock rows
  - verify every pair has exactly 2 unique cards
  - verify all cards are still `awaiting_serial`
  - verify the serial is still free and has both stock rows available
  - verify quota/office rules server-side
  - assign the same serial to both cards
  - mark both stock rows assigned
  - write/update assignment usage/audit records
- If any validation fails, raise an error so nothing is committed.

2. Refactor `PendingPurchases.tsx` to call the backend pair-assignment function
- Stop updating `rent_card_serial_stock` and `rent_cards` directly from the browser.
- Build explicit card pairs before submit instead of relying on per-card looping.
- Enforce even-number selection only.
- For auto/manual/range modes, convert the selection into pair payloads and send one request.
- Replace the current per-card error handling with one transaction result:
  - success: all pairs assigned
  - failure: none assigned

3. Make unassign a full factory reset for the whole pair
- Update the unassign backend logic so one serial always resets both cards and both stock rows together.
- Clear all assignment/tenancy state from both cards:
  - `serial_number`
  - `status -> awaiting_serial`
  - tenant/property/unit/tenancy links
  - rent/payment/activation fields
  - `qr_token`
  - `card_role`
  - `assigned_office_id`
  - `assigned_office_name`
- Also clear stock locks on both serial rows:
  - `assigned_to_card_id`
  - `assigned_at`
  - `assigned_by`
  - `status -> available`
- Preserve landlord ownership and purchase history so the cards still appear in the landlord portal.

4. Add repair handling for already broken partial pairs
- Include a backend repair path for legacy bad states such as:
  - only 1 of 2 cards linked to a serial
  - only 1 stock row marked assigned
  - stock rows assigned but cards still awaiting serial
- Use this repair logic during unassign, and optionally expose it as an admin recovery action so existing broken records can be normalized before reassignment.

5. Tighten landlord pair presentation
- Keep the current grouped landlord view in `ManageRentCards.tsx`.
- Sort the two cards consistently as Landlord Copy + Tenant Copy.
- Show pair-level status clearly as “2 cards / 1 serial”.
- Once assignment/unassign becomes transactional, this view should naturally stay correct.

Files to update
- `src/pages/regulator/rent-cards/PendingPurchases.tsx`
- `supabase/functions/admin-action/index.ts` or a dedicated backend wrapper
- new database migration for transactional RPC/function(s)
- optionally minor cleanup in `src/pages/landlord/ManageRentCards.tsx`

Technical notes
- This needs backend transaction logic; client-side loops cannot guarantee all-or-nothing behavior.
- No new tables are required, but creating the RPC/function is a schema change, so it should go through a migration.
- The safest design is: browser builds pair payloads -> backend transaction validates + assigns -> UI refreshes from source of truth.

Expected result
- 1 serial always maps to exactly 2 cards.
- Assignment is all-or-nothing.
- No more half-assigned batches.
- No false “claimed by another admin” messages from mid-loop partial failure.
- Unassign fully frees the serial and returns both cards to “Awaiting Serial”.
- Landlord portal consistently shows paired cards under the same serial.
