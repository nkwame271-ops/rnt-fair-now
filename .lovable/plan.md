

# Fix Tenant Portal: Complaint Fee, Viewing Fee, and Receipt Issues

## Issues Summary

1. **Complaint fee off → "No checkout URL received"** — `FileComplaint.tsx` line 226-229 doesn't handle `{ skipped: true }` from paystack-checkout when fee is disabled.
2. **Complaint fee on → case shows "pending_payment"** — The complaint is inserted with `status: "pending_payment"` (line 181). After payment, `verify-payment` doesn't update the complaint status to `"submitted"`. The webhook does (line 345), but there's a race condition — user returns before webhook fires.
3. **Hardcoded "GH₵ 2.00"** — FileComplaint line 485 and button line 521 show hardcoded amounts instead of using `useFeeConfig`.
4. **Complaint receipts missing** — `verify-payment` creates receipts generically (line 149-170) but doesn't update complaint status to `submitted`, so if webhook hasn't fired, the complaint stays in `pending_payment` and the receipt `payment_type` = `complaint_fee` may not match the tenant's receipt query filters.
5. **Viewing fee hardcoded** — Marketplace.tsx lines 558 and 560 show hardcoded "GH₵ 2" instead of dynamic fee. Also line 285-288 doesn't handle `{ skipped: true }`.

## Plan

### 1. FileComplaint.tsx — handle skipped + dynamic fee + verify on return

- Import `useFeeConfig` hook
- When `data?.skipped`, update complaint status to `"submitted"` directly, show success, navigate to My Cases
- On the review step, show `feeConfig.amount.toFixed(2)` instead of hardcoded "2.00"
- Button text: `Pay GH₵ ${feeConfig.amount.toFixed(2)} & Submit` instead of `Pay GH₵ 2 & Submit`

### 2. verify-payment — handle complaint_fee type

Add `complaint_fee` handler in verify-payment (after line 140, before receipt creation):
```
else if (paymentType === "complaint_fee") {
  // Update complaint status from pending_payment to submitted
  const complaintId = meta?.complaintId || reference.replace("comp_", "");
  await supabaseAdmin.from("complaints").update({ status: "submitted" }).eq("id", complaintId);
}
```

Also add `viewing_fee` handler to update viewing request status.

### 3. MyCases.tsx — add pending_payment status display + verify on load

- Add `pending_payment` to `statusIcon` and `statusColors` maps
- On page load, check for `?status=success` or `trxref`/`reference` params → call `verify-payment` with the reference to finalize the complaint, then refetch
- Show a human-readable label for `pending_payment` (e.g., "Awaiting Payment")

### 4. Marketplace.tsx — handle skipped + dynamic fee

- Import `useFeeConfig` for `viewing_fee`
- When `payData?.skipped`, update the viewing request status to `"pending"` (approved free), show success toast
- Replace hardcoded "GH₵ 2" with dynamic `feeConfig.amount.toFixed(2)` in button and helper text

### 5. Receipts — complaint fee receipts already work

The receipt is created by `verify-payment` with `payment_type: "complaint_fee"`. The tenant Receipts page queries by `user_id` and already includes `complaint_fee` in the filter. This should work once `verify-payment` properly finalizes complaint payments. No change needed in Receipts.tsx.

## Files to modify

- `src/pages/tenant/FileComplaint.tsx` — handle skipped, dynamic fee, verify on return
- `src/pages/tenant/MyCases.tsx` — pending_payment status, verify on load
- `src/pages/tenant/Marketplace.tsx` — handle skipped, dynamic viewing fee
- `supabase/functions/verify-payment/index.ts` — handle complaint_fee + viewing_fee types

