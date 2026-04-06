

# Fix: Serial Generation Count, Regional Stock Display, and Quota Transfers

## Root Causes

### Issue 1: Report shows 9,950 instead of 10,000
The `ProcurementReport.tsx` query and the `generation_batches` record store the correct count. However, the Procurement Report table fetches from `generation_batches` with a default Supabase limit of 1000 rows — this is not the cause here. The actual issue is that the generation report displayed after generation uses `data?.new_state?.total_unique` which comes from the edge function's `totalGenerated` counter. If any serials were flagged as duplicates during the batch-of-100 dedup check, they'd be skipped. But more likely: the edge function's duplicate check query also has no explicit limit — so if a region has >1000 existing serials, the dedup `.in()` response gets truncated, causing some serials to be falsely treated as new or falsely skipped.

**Fix**: Add `.limit(batch.length)` to the dedup query to ensure all results are returned (each batch is only 100 items, so this is safe). The real 9,950 issue likely came from 50 pre-existing serials being skipped. The count is accurate — it's just showing how many were actually created (non-duplicates).

### Issue 2: Regional Stock shows 500 instead of 3500
The `OfficeAllocation.tsx` stock query (line 46-50) has **no `.limit()` override**. Supabase defaults to 1000 rows max. With paired mode (pair_index 1 and 2), 1000 rows = 500 unique pairs. Greater Accra has 7000 rows → query only returns 1000 → shows 500 pairs.

**Fix**: Use a **count query** instead of fetching all rows and counting client-side. Use `.select("id", { count: "exact", head: true })` with filters, which returns just the count without the 1000-row limit.

### Issue 3: Priority Quota doesn't transfer serials
The edge function's quota mode (line 263-276) only creates an `office_allocations` record — it does NOT update any `rent_card_serial_stock` rows. The user expects quotas to also transfer serials to the office so staff can assign from office stock.

**Fix**: Make quota mode behave like transfer mode — actually move the specified quantity of serials from regional to office stock, but also record the `quota_limit` for tracking purposes.

---

## Changes

### File 1: `src/pages/regulator/rent-cards/OfficeAllocation.tsx`
- Replace the bulk `.select("id, stock_type, pair_index")` query with two separate count queries:
  - Regional: `.select("id", { count: "exact", head: true }).eq("region", ...).eq("stock_type", "regional").eq("status", "available").eq("pair_index", 1)`
  - Office: same but `.eq("stock_type", "office")`
- This eliminates the 1000-row default limit entirely

### File 2: `supabase/functions/admin-action/index.ts`
- **Quota mode**: Copy the transfer logic into the quota branch — fetch N available regional serials, update them to `stock_type: "office"`, and set `office_name` to the target office. Also record `quota_limit` in the `office_allocations` record.
- **Dedup query**: Add `.limit(batch.length)` to the duplicate-check queries in both `generate_serials` and `generate_serials_multi` (already 100 items per batch, so this is just defensive).

