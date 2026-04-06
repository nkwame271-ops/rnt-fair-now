

# Fix: Quota Mode — Pool-Based Assignment Instead of Serial Transfer

## Problem

Currently, quota mode physically moves specific serials from regional to office stock (same as transfer mode). The user wants quota mode to work fundamentally differently:

- **Quota** = a number assigned to an office (e.g., "Office X can assign up to 200 pairs")
- Office staff assign serials directly **from regional stock** (not office stock)
- System tracks how many serials the office has used against its quota
- Once quota is exhausted, further assignment is blocked until more quota is allocated

## Changes

### 1. Edge Function: `supabase/functions/admin-action/index.ts`

**Quota branch** (~lines 265-330): Remove all serial-fetching and stock-type updating logic. Replace with:
- Just create the `office_allocations` record with `allocation_mode: "quota"`, `quota_limit`, and `quantity` set to the quota number
- No `serial_numbers`, no `start_serial`/`end_serial`, no updating `rent_card_serial_stock` rows
- This makes quota a pure accounting entry

### 2. Frontend: `src/pages/regulator/rent-cards/PendingPurchases.tsx`

**Serial fetching** (~line 275): Currently only fetches `stock_type = 'office'` serials. Need to add a quota-based path:
- Check if the office has quota allocations (query `office_allocations` where `allocation_mode = 'quota'` and `office_id` matches)
- Sum the total quota for the office
- Count how many serials the office has already assigned (from `serial_assignments` or `rent_card_serial_stock` where `assigned_by` office)
- If `used < total_quota`, fetch available serials from **regional stock** (`stock_type = 'regional'`, same region) instead of office stock
- Limit the fetchable serials to `remaining_quota` count
- If no quota remaining, show a clear message: "Quota exhausted — request more allocation"

**Assignment logic** (~line 368): After assigning a serial from regional stock under quota mode, do NOT change `stock_type` to `office`. Instead, mark it as `assigned` directly from regional. The `serial_assignments` record already tracks the office.

### 3. Frontend: `src/pages/regulator/rent-cards/OfficeAllocation.tsx`

**Quota tab UI**: Add a display showing current quota usage per office when in quota mode:
- Total quota allocated (sum from `office_allocations`)
- Used (count of serials assigned by that office)
- Remaining

### 4. Database: New column on `office_allocations` (optional but helpful)

No schema change needed — we can compute usage from `serial_assignments` by `office_id`. The existing `quota_limit` column on `office_allocations` is sufficient.

### 5. Frontend: `src/pages/regulator/rent-cards/OfficeSerialStock.tsx`

For quota-based offices, show quota usage stats (allocated / used / remaining) instead of or alongside the serial stock list, since their serials live in regional stock until assigned.

---

## Summary of Files

| Action | File |
|--------|------|
| Edit | `supabase/functions/admin-action/index.ts` — simplify quota branch to only record quota |
| Edit | `PendingPurchases.tsx` — add quota-aware serial fetching from regional stock with limit enforcement |
| Edit | `OfficeAllocation.tsx` — show quota usage stats per office |
| Edit | `OfficeSerialStock.tsx` — display quota info for quota-based offices |
| Deploy | `admin-action` edge function |

