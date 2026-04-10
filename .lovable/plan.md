

# Fix: Payment Verification Gap Across All Payment Flows

## Root Cause

The Paystack webhook is not reliably firing (zero logs in production). The system's only fallback is the client-side `verify-payment` call when users return from Paystack. However, **most payment pages do NOT**:
1. Store the Paystack `reference` in `sessionStorage` before redirecting
2. Call `verify-payment` on return from Paystack

This means money is collected but the system stays in `pending` state — no receipt, no rent cards, no ledger entry.

**Evidence**: 20+ `escrow_transactions` stuck as `pending` with `paystack_transaction_id: null`, spanning rent cards, agreement sales, complaint fees, and more.

## Affected Pages (12 payment flows)

| Page | Payment Type | Stores ref? | Verifies on return? |
|------|-------------|-------------|---------------------|
| `ManageRentCards.tsx` | rent_card_bulk | NO | YES (URL only) |
| `RequestRenewal.tsx` | renewal_payment | NO | NO |
| `TerminationRequest.tsx` | termination_fee | NO | NO |
| `FileComplaint.tsx` | complaint_fee | NO | NO (MyCases covers it) |
| `AddTenant.tsx` | add_tenant_fee | NO | NO |
| `Marketplace.tsx` | viewing_fee | NO | NO |
| `MyProperties.tsx` | listing_fee | NO | YES (URL only) |
| `LandlordDashboard.tsx` | landlord_registration | NO | NO (ProtectedRoute covers) |
| `TenantDashboard.tsx` | tenant_registration | NO | NO (ProtectedRoute covers) |
| `RegisterLandlord.tsx` | landlord_registration | NO | NO (ProtectedRoute covers) |
| `RegisterTenant.tsx` | tenant_registration | NO | NO (ProtectedRoute covers) |
| `LandlordApplications.tsx` | archive_search_fee | NO | NO |

Pages already fixed: `DeclareExistingTenancy.tsx`, `Payments.tsx` (rent payments).

## Fix Strategy

For every page that calls `paystack-checkout` and redirects:

**Step 1**: Store reference in `sessionStorage` before redirect:
```typescript
if (data?.authorization_url) {
  if (data?.reference) {
    sessionStorage.setItem("pendingPaymentReference", data.reference);
  }
  window.location.href = data.authorization_url;
}
```

**Step 2**: On page mount, check for return reference and call verify-payment:
```typescript
useEffect(() => {
  const ref = params.get("reference") || params.get("trxref")
    || sessionStorage.getItem("pendingPaymentReference");
  if (ref) {
    supabase.functions.invoke("verify-payment", { body: { reference: ref } })
      .then(({ data }) => { /* handle result */ });
    sessionStorage.removeItem("pendingPaymentReference");
  }
}, [user]);
```

For pages where the return is handled by a different page (e.g., FileComplaint → MyCases, registration → ProtectedRoute), we still store the reference so the handler page can pick it up.

## Files to Modify (10 files)

| File | Change |
|------|--------|
| `src/pages/landlord/ManageRentCards.tsx` | Add sessionStorage store before redirect; add sessionStorage fallback to verify logic |
| `src/pages/tenant/RequestRenewal.tsx` | Add sessionStorage store + verify-payment on return |
| `src/pages/tenant/TerminationRequest.tsx` | Add sessionStorage store + verify-payment on return |
| `src/pages/tenant/FileComplaint.tsx` | Add sessionStorage store before redirect |
| `src/pages/landlord/AddTenant.tsx` | Add sessionStorage store + verify-payment on return |
| `src/pages/tenant/Marketplace.tsx` | Add sessionStorage store before redirect + verify-payment on return |
| `src/pages/landlord/MyProperties.tsx` | Add sessionStorage store; add sessionStorage fallback to verify logic |
| `src/pages/landlord/LandlordDashboard.tsx` | Add sessionStorage store before redirect |
| `src/pages/tenant/TenantDashboard.tsx` | Add sessionStorage store before redirect |
| `src/pages/landlord/LandlordApplications.tsx` | Add sessionStorage store before redirect + verify-payment on return |

ProtectedRoute.tsx already calls verify-payment for registration flows and reads URL params, so we just need the pages to store the reference.

## Impact

Every payment flow will now have a reliable client-side verification fallback, ensuring that even when webhooks fail, payments are always: traceable, receipted, and recorded in the ledger.

