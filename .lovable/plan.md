
Fix all remaining issues as one integrity pass, not as isolated patches. The current code shows earlier fixes landed, but there are still deeper consistency problems causing the same errors to resurface.

1. Stabilize OTP across all flows
- Update `supabase/functions/send-otp/index.ts` and `verify-otp/index.ts` to use one strict phone normalizer everywhere: strip non-digits, accept `0...`, `233...`, and `+233...`, and store/verify the exact same canonical value.
- Stop rotating the OTP code while an unexpired active code already exists. Reuse the current code until expiry so resend/double-send cannot invalidate a code “within time”.
- Keep verify idempotent for already-verified codes and return specific failures only when the code is truly wrong/expired.
- Apply this across all OTP entry points already using these functions: registration, forgot password, and digital signature.

2. Repair existing broken serial stock data
- Add a migration that audits and repairs malformed `rent_card_serial_stock` rows created before the pair-based fixes.
- Backfill missing second rows for serials that only have `pair_index = 1` but should exist as pairs.
- Clean up stale stock/card links where `assigned_to_card_id`, `serial_number`, and card state no longer agree.
- Rebuild any incomplete pair state so one serial always maps to exactly 2 stock rows and 2 cards.

3. Fix the source of recurring serial errors
- `src/pages/regulator/rent-cards/SerialBatchUpload.tsx` still inserts only one stock row per serial. Change it to insert both pair rows with correct `pair_index` and paired metadata.
- Harden `supabase/functions/admin-action/index.ts` allocation flows so office transfers only move complete serial pairs, never partial rows.
- Keep `assign_serials_atomic` / `unassign_serial_atomic` as the single source of truth, but add stricter validation so malformed stock is rejected early with a clear error instead of creating half-assigned states.

4. Fix “assigns half / claimed by another admin”
- In `src/pages/regulator/rent-cards/PendingPurchases.tsx`, align quota math with pairs, not raw card count.
- Right now the screen mixes “cards” and “pairs”; that can block valid assignments and produce misleading partial-state behavior. Standardize the whole flow so:
  - 16 selected cards = 8 serial pairs
  - quota checks use pairs
  - audit usage and remaining allocation use the same unit
- Also ensure the available serial picker only exposes serials whose full 2-row pair is available.

5. Fix “landlord sees one assigned card and one unassigned”
- After the stock/data repair, verify assignment always writes both cards in the pair in one transaction.
- Update landlord/admin views to read paired state consistently, so a serial is shown as a complete pair instead of mixing one assigned card with one awaiting card when legacy data is malformed.
- Improve admin serial lookup (`src/pages/regulator/rent-cards/AdminActions.tsx`) to inspect the full pair, not just the `pair_index = 1` row.

6. Fix receipt printing properly
- Replace the current in-page `window.print()` visibility hack in `src/components/PaymentReceipt.tsx`.
- Render a dedicated receipt-only print document/window/iframe with only the selected receipt markup and styles, so Escrow print can never include the whole dashboard.
- Keep `src/index.css` print rules minimal/global, but move receipt isolation into the component print flow.

Files to touch
- `supabase/functions/send-otp/index.ts`
- `supabase/functions/verify-otp/index.ts`
- `supabase/functions/admin-action/index.ts`
- new migration to repair legacy serial stock + harden pair integrity
- `src/pages/regulator/rent-cards/SerialBatchUpload.tsx`
- `src/pages/regulator/rent-cards/PendingPurchases.tsx`
- `src/pages/regulator/rent-cards/AdminActions.tsx`
- `src/components/PaymentReceipt.tsx`
- possibly small supporting updates in receipt/landlord pair display pages if needed after data repair

Validation plan
- OTP: send, resend, verify same code within window, wrong code, expired code, forgot-password retry, signature retry
- Serials: upload new batch, allocate to office, assign 8 pairs/16 cards, unassign, reassign same serials, confirm landlord sees both cards together
- Admin actions: search serial before and after unassign, verify no stale “active/assigned” mismatch
- Escrow: print from multiple receipts and confirm only the clicked receipt prints
