# Revoked serial blocks assignment of the re-uploaded serial

## Confirmed cause

Verified in the database:

- Re-uploaded serials (e.g. `RCD-2026-GA-0009001`) now correctly have new `available` rows for card sides 1 and 2, while the older `revoked` rows remain as history.
- The assignment routine `assign_serials_atomic` selects **every** stock row matching the serial number — revoked ones included. It then rejects the first row whose status is not `available`, producing "Serial ... is not available (status: revoked)". Even if that check passed, its "must have exactly 2 stock rows" check would also fail (there are now 4), and its update statements would rewrite the revoked history rows too.
- The serial search box on the Pending Purchases screen looks up one row per serial without preferring the active one, so a re-uploaded serial can still be reported as "Revoked".
- The stock move routine `move_serials_atomic` has the same all-rows problem: a serial with revoked history can never be moved between pools.

## Changes

### 1. Assignment (main fix)
Rework the assignment routine so it works only on the current, non-revoked stock rows of a serial:

- Select and lock only rows whose status is not `revoked`, ordered by card side.
- Require exactly one non-revoked row per card side (1 and 2); if a card side has no non-revoked row, report "no available stock record for this serial" rather than "revoked".
- Mark as assigned by the specific stock row IDs found, so revoked history rows are never touched or overwritten.
- Keep the existing "already assigned" message when the active rows exist but are already taken.

### 2. Stock movement
Apply the same rule in the move routine: only non-revoked rows are considered, counted, locked and updated, so re-uploaded serials can be moved between central/regional/office pools.

### 3. Serial search on the assignment screen
When the search finds a serial, prefer its active (non-revoked) record and report status from that record; only show "Revoked" when no non-revoked record exists.

### 4. Generation duplicate check (single-region path)
The older single-region generator still treats revoked rows as duplicates. Align it with the multi-region path so revoked serials can be regenerated.

## Technical notes

- Migration replacing `public.assign_serials_atomic` and `public.move_serials_atomic`: add `AND status <> 'revoked'` to every `SELECT ... FOR UPDATE`, count and `UPDATE` on `rent_card_serial_stock`; assignment updates target the collected stock row `id`s (`WHERE id = <row id>`) instead of `serial_number + pair_index`.
- Pair validation becomes: exactly one non-revoked row for `pair_index = 1` and one for `pair_index = 2`.
- `src/pages/regulator/rent-cards/PendingPurchases.tsx`: global serial lookup (~line 146) selects candidate rows for `pair_index = 1` and picks the non-revoked one first; `explainHit` only reports "Revoked" when all candidates are revoked.
- `supabase/functions/admin-action/index.ts` (`generate_serials`, first case): duplicate set excludes `status = 'revoked'`, matching `generate_serials_multi`.
- No change to the partial unique index or to revocation history retention.
