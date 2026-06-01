## What’s actually causing the issue
The persistent rent card problem is not just the dropdown UI anymore.

There are two separate causes in the current implementation:

1. `PendingPurchases.tsx` calculates quota by `office_id` but loads physical stock by exact `office_name`.
2. The live data already contains multiple name variants for the same office or grouped office IDs, so a serial can belong to the right office logically but fail the exact-name match.

Examples found in the live backend:
- `office_allocations` contains mixed names for the same `office_id` such as `Cape Coast` and `Cape Coast Office`
- Some grouped offices share one `office_id` but different historical `office_name` values such as `Swedru Office`, `Mankessim Office`, `Dambai Office`, `Nkwanta Office`
- `admin_staff` main/super admins currently have `office_id = null`, while the UI falls back to the first office in the static office list for some flows

That combination explains why users can see enough balance somewhere in the system but still get “found elsewhere” or “no quota remaining” messages.

## Plan

### 1) Make assignment use a single source of truth for office matching
- Refactor the pending assignment screen so stock lookup does not rely on exact `office_name` equality.
- Build office matching from `office_id` and a safe alias set instead of one display string.
- Ensure the same office identity is used consistently for:
  - physical stock lookup
  - quota lookup
  - “found elsewhere” explanations
  - assignment submission

### 2) Fix super/main admin office resolution
- Remove the fragile fallback that silently uses the first static office when `office_id` is null.
- Make the screen require an explicit scoped office for assignment flows when the admin profile is not already scoped.
- Prevent false calculations caused by “pretend office” defaults.

### 3) Improve “Found elsewhere” diagnostics
- Show the exact stock bucket and exact recorded office/region for the hit.
- Distinguish clearly between:
  - your office stock
  - same-region pool stock
  - another office’s stock
  - orphaned/mismatched stock records
- For super admins, keep the Admin Actions deep link and make sure it opens with the searched serial prefilled.

### 4) Add defensive handling for legacy office-name data
- Update the frontend matching logic to tolerate existing name variants already in the database.
- If needed after code review, add a small backend normalization migration for legacy `office_name` values so future lookups stay consistent.
- Only do the migration if the code-side alias fix is not enough.

### 5) Verify with real data before calling it fixed
- Re-test the problematic assignment flow against live backend data.
- Verify that a serial in the regional pool is labeled correctly.
- Verify that an office with real physical stock no longer shows contradictory “found elsewhere” messaging.
- Verify that super admin can see where a serial is and jump directly to recovery actions.

## Technical notes
- Primary file: `src/pages/regulator/rent-cards/PendingPurchases.tsx`
- Secondary files: `src/pages/regulator/RegulatorRentCards.tsx`, `src/pages/regulator/rent-cards/AdminActions.tsx`
- Possible backend follow-up only if necessary: migration to normalize legacy office names in stock/allocation records

## Expected outcome
After this change, the system should stop treating same-office stock as external stock because of name mismatches, and the validation message should reflect the real stock location and the real reason assignment is blocked.