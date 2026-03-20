

# Fix: Serial Batch Upload — Delete Revoked Before Duplicate Check

## Root Cause

The current flow is:
1. Check which serials exist with status `available`/`assigned` → build `existingSet`
2. Filter to `newSerials` (not in `existingSet`)
3. Delete revoked rows for `newSerials`
4. Insert `newSerials`

**Problem**: Step 1 correctly skips revoked serials. But `newSerials` then includes ALL serials not currently `available`/`assigned` — including revoked ones. Step 3 deletes revoked rows for those. Step 4 inserts them. This should work... BUT the delete in step 3 iterates over `newSerials`, not ALL serials. The real issue is the delete needs to happen for ALL incoming serials (not just `newSerials`), and it must happen BEFORE the duplicate check — because revoked rows still occupy the unique constraint slot.

**Correct flow**:
1. Delete ALL revoked rows matching ANY of the incoming serials
2. Then check which serials still exist (`available`/`assigned`)
3. Filter to new serials
4. Insert

## File Changed

**`src/pages/regulator/rent-cards/SerialBatchUpload.tsx`** — Reorder the upload logic:
- Move the "delete revoked" step to run FIRST, before the duplicate check, and iterate over ALL `serials` (not `newSerials`)
- Then proceed with the existing duplicate check and insert

This is a ~10-line reorder within the `handleUpload` function.

