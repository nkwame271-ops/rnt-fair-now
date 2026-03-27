

# Fixes: Payment Flow, Rejection Cascade, Archive Search Fee

## 1. Payment "keeps asking to pay again" — Unable to Sign Agreement

**Root cause**: The flow is: tenant pays on Payments page → webhook updates `rent_payments` to `tenant_paid` → tenant goes to MyAgreements → clicks "Accept & Sign" → system checks for `tenant_paid` payments. The problem is a **timing issue** — the Paystack webhook may not have processed by the time the user clicks "Accept & Sign". Additionally, there's no feedback loop between the Payments page and MyAgreements.

**Fix** (two-part):
1. In `MyAgreements.tsx` `handleAcceptAndPay`: Instead of only checking `rent_payments` status, **also check `escrow_transactions`** for a completed `rent_tax_bulk` transaction for this tenancy. If either source shows payment, allow signing.
2. Add a **retry mechanism with polling**: When the payment check fails, show a "Verifying payment..." state that polls every 3 seconds (up to 5 attempts) before showing the error. This handles the webhook delay gracefully.
3. After the Payments page callback redirect (`?status=success`), also set a `sessionStorage` flag. In MyAgreements, if this flag exists, automatically trigger the verification polling.

**Files**: `src/pages/tenant/MyAgreements.tsx`

---

## 2. Tenant Rejection → Remove from Landlord Agreements

**Current state**: The rejection cascade (unit → vacant, property → live) is already implemented. The landlord Agreements page already shows "Rejected" badge. However, the user wants rejected agreements **removed** from the landlord view (not just badged).

**Fix**: In `src/pages/landlord/Agreements.tsx`, filter out `rejected` tenancies from the main display, or move them to a collapsible "Rejected" section so they don't clutter the active view. The cascading updates to unit/property status are already working.

**Files**: `src/pages/landlord/Agreements.tsx`

---

## 3. Archive Search Fee — Changeable in Engine Room

**Current state**: The `archive_search_fee` feature flag was inserted in a previous migration with `category = 'fees'`. The Engine Room page dynamically renders all flags from the `feature_flags` table. This should already work — verify the flag exists with correct category, and if not, insert it.

**Action**: Verify via database query. If missing, insert using the insert tool.

---

## Files to Change

| File | Change |
|---|---|
| `src/pages/tenant/MyAgreements.tsx` | Add escrow_transactions fallback check + polling retry for payment verification |
| `src/pages/landlord/Agreements.tsx` | Filter rejected tenancies into a separate collapsed section |
| Database (verify/insert) | Ensure `archive_search_fee` flag exists with `category = 'fees'` |

