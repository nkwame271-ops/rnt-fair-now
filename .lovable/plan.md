

# Fix: Edge Function Errors, Landlord Name "Unknown", Escrow Types, Complaint Appointments

## Issues Found

### 1. Archive Search Fee — "non-2xx status code"
**Root cause**: The `paystack-checkout` edge function has `archive_search_fee` in its `DEFAULT_SPLIT_RULES` (line 64) but **no handler block** for `type === "archive_search_fee"`. The request falls through to line 627: `throw new Error("Invalid payment type")`.

**Fix**: Add an `else if (type === "archive_search_fee")` handler block in `paystack-checkout/index.ts` before the final `else` clause, similar to other fee