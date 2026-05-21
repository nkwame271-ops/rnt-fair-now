## Problem

In the admin portal under **Rent Cards → Pending & Assign**, the screen looks empty even though landlords have purchased cards. The data is in the database — `rent_cards` has many rows in `status = 'awaiting_serial'` from recent landlord purchases (PUR-20260521-0703 … 0706, multiple landlords).

The reason nothing shows: `PendingPurchases.tsx` requires the admin to **type a query and click Search** before any row is fetched. `pendingCards` starts empty and is only populated by `handleSearch`, which itself filters by Landlord ID / Name / Purchase ID against the search string. With an empty box the list stays blank, so the landlord details never appear.

## Fix (frontend only — `src/pages/regulator/rent-cards/PendingPurchases.tsx`)

1. **Auto-load pending purchases on mount.** Add a `useEffect` that runs `loadPending()` when the component mounts (and when `profile` changes).
2. **Extract a `loadPending()` helper** from `handleSearch`. It fetches `rent_cards` with `status = 'awaiting_serial'` (paginated in 1 000-row chunks to bypass the Supabase default cap, same pattern already used elsewhere), joins to `profiles` and `landlords` for name + landlord ID, orders by `purchased_at desc`, and stores the result in `pendingCards`.
3. **Turn the search box into a client-side filter** over the loaded list. Remove the "click Search to fetch" gate; the input narrows `pendingCards` by Landlord ID / Name / Purchase ID as the admin types. Keep an explicit "Refresh" button (replacing the current Search button) so admins can re-pull after a landlord buys new cards.
4. **Empty state copy** updates from `No pending cards found for "<query>"` to either "No pending purchases" (when nothing is awaiting serial) or "No matches for <query>" (when filter excludes everything).
5. Preserve existing behaviour for assignment, selection, quota handling, and the post-assign list trimming.

No DB changes, no RLS changes, no edge function changes. No other rent-card screens touched.

## Verification

- Open **Rent Cards → Pending & Assign** as a regulator admin → list of pending purchases (grouped by `PUR-…`) shows landlord name, landlord ID code, purchase date, and card count immediately, without typing anything.
- Type a landlord ID / name / purchase ID → list narrows in place.
- Click **Refresh** after a new landlord purchase → new purchase appears.
- Assign serials → assigned cards disappear from the list, success banner shows, stock counters update (unchanged behaviour).
