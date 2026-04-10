

# Fix: Missing Payment Verification in "Declare Existing Tenancy" Flow

## Root Cause

The `DeclareExistingTenancy.tsx` page redirects the user to Paystack for payment but **never calls `verify-payment`** when the user returns. Every other payment flow in the system (rent cards, complaints, property listing, rent tax) calls `verify-payment` on callback — this is the only one that doesn't. Combined with the Paystack webhook not firing (DNS/network issues visible in other logs), this means money is collected but the transaction stays `pending` forever — no receipt, no splits, no ledger entry.

**Evidence**: All `agreement_sale` escrow transactions have `paystack_transaction_id: null` and `status: pending`, even the one from today where payment was confirmed on Paystack's side.

## Fix

### 1. Add `verify-payment` call to `DeclareExistingTenancy.tsx` (lines 245-258)

In `autoSubmitAfterPayment`, before creating the tenancy record, call `verify-payment` with the stored reference. This ensures the `finalizePayment` pipeline runs (marking escrow completed, creating splits, receipts, and payouts).

```typescript
const autoSubmitAfterPayment = async (savedData: any, propsData: any[]) => {
  if (!user) return;
  setSubmitting(true);
  try {
    // --- NEW: Verify payment first ---
    const ref = new URLSearchParams(window.location.search).get("reference")
      || sessionStorage.getItem("pendingPaymentReference");
    if (ref) {
      const { data: vData } = await supabase.functions.invoke("verify-payment", {
        body: { reference: ref },
      });
      if (vData?.verified) {
        toast.success("Payment confirmed!");
      } else {
        toast.warning("Payment verification pending — tenancy will still be created.");
      }
      sessionStorage.removeItem("pendingPaymentReference");
    }
    // --- END NEW ---

    const prop = propsData.find(...);
    // ... existing logic
  }
};
```

### 2. Store reference before redirect (around line 454)

After calling `paystack-checkout`, store the reference so it's available on return:

```typescript
if (data?.authorization_url) {
  if (data?.reference) {
    sessionStorage.setItem("pendingPaymentReference", data.reference);
  }
  window.location.href = data.authorization_url;
}
```

### 3. Also check URL `?reference=` param in the restore effect (line 104-131)

Paystack appends `?reference=XXX` to the callback URL. Extract it and pass to verify-payment as well.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/landlord/DeclareExistingTenancy.tsx` | Add `verify-payment` call on return from Paystack + store reference before redirect |

## Impact

- All future `agreement_sale` payments will be properly verified, receipted, and recorded
- The existing pending transactions can be retroactively fixed by calling `verify-payment` with their references (manual or via admin action)

