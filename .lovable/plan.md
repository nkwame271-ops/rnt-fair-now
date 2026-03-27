

# Fixes: Payment Processing, Platform Revenue, Duplicate Comparison, Status Filters, Rejection Flow

## 1. Payment "keeps asking to pay again" after successful payment

**Root cause**: `MyAgreements.tsx` line 170 checks `eq("status", "confirmed")` — but the webhook only sets status to `"tenant_paid"`. The payment is never `"confirmed"` until the **landlord** confirms it. So the tenant can never proceed to sign.

**Fix**: Change `MyAgreements.tsx` `handleAcceptAndPay` to also accept `tenant_paid` status as valid proof of payment:
```
.in("status", ["confirmed", "tenant_paid"])
```
This allows signing once payment is verified by Paystack, without waiting for landlord confirmation.

## 2. Archive Search Fee in Engine Room

The `archive_search_fee` feature flag was inserted in a previous migration. The Engine Room already dynamically renders all flags from `feature_flags` table with `category = 'fees'`. Need to verify the insert actually persisted. If not, re-insert via the insert tool.

## 3. Remove "Platform Revenue" visibility from Escrow Dashboard

**Current**: `EscrowDashboard.tsx` line 158 already hides Platform for non-main admins. But the user wants it completely removed from this dashboard view.

**Fix**: Remove the Platform allocation card entirely from the `allocationCards` array in `EscrowDashboard.tsx`. Platform revenue tracking stays in the system (escrow_splits still record it) but is not shown on this page. For CFLECD-only access, suggest a separate `/regulator/platform-revenue` page gated behind `isMainAdmin`.

## 4. Duplicate Property — Comparison Button (persistent)

**Current**: The duplicate tag shows with old rent, but there's no comparison view. The "Clear" button on line 438 allows removing the `pending_identity_review` status.

**Fix**:
- Add a "Compare" button next to duplicate-flagged properties that opens a dialog showing the **original property details** (fetched by `duplicate_of_property_id`) side-by-side with the new one, including unit rents
- The "Compare" button appears whenever `duplicate_of_property_id` is set — regardless of status changes
- Remove the "Clear" button's ability to erase duplicate data (keep `duplicate_of_property_id` and `duplicate_old_rent` columns untouched)

## 5. Property Status Filter Menus

**Already implemented** in previous changes (line 321-334). The status filter dropdown with counts is present. No changes needed here.

## 6. Tenant Rejection → Cascading Updates

**Already implemented** in previous changes (line 111-158 of `MyAgreements.tsx`). The `handleReject` function already:
- Updates tenancy to `rejected`
- Resets unit to `vacant`
- Sets property back to `live` + `listed_on_marketplace: true` if no other occupied units

The landlord `Agreements.tsx` already shows "Rejected" badge (line 188). No changes needed here.

---

## Files to Change

| File | Change |
|---|---|
| `src/pages/tenant/MyAgreements.tsx` | Accept `tenant_paid` status as valid for signing |
| `src/pages/regulator/EscrowDashboard.tsx` | Remove Platform card entirely from allocation display |
| `src/pages/regulator/RegulatorProperties.tsx` | Add "Compare" dialog for duplicate properties; keep duplicate tag permanent |

