

# Audit: Gaps Found in Rent Card Range Logic + Admin Controls Implementation

After reviewing all affected files end-to-end, several changes were made at the UI level only and are not enforced or integrated across the full system. Here are the gaps and the plan to fix them.

---

## Gap 1: `account_status` Not Enforced at Login/Access Level

**Problem:** The `account_status` column (`deactivated`, `archived`) exists on `landlords` and `tenants` tables, and the admin-action edge function can set it. But **nothing in the app checks it**. A deactivated user can still log in, access their dashboard, and perform all actions normally.

**Fix:** Update `ProtectedRoute.tsx` to fetch `account_status` from the tenant/landlord record. If status is `deactivated` or `archived`, show a blocked screen ("Your account has been deactivated. Contact Rent Control.") instead of rendering the dashboard.

---

## Gap 2: AdminActions UI Missing "Void Upload" and "Account Deactivate/Archive"

**Problem:** The plan called for 4 sections in AdminActions: Revoke Batch, Unassign Serial, Void Upload, and Account Deactivate/Archive. The current implementation only has Revoke Batch, Unassign Serial, and Audit Log. The edge function supports `void_upload`, `deactivate_account`, and `archive_account` actions, but there is no UI to trigger them.

**Fix:** Add two more sections to `AdminActions.tsx`:
1. **Void Upload** — search by batch label, void all unused serials (calls `void_upload` action)
2. **Account Management** — search by landlord/tenant ID, deactivate or archive (calls `deactivate_account`/`archive_account`)

Both gated behind `AdminPasswordConfirm`.

---

## Gap 3: `verify-tenancy` Edge Function Doesn't Return Second Rent Card

**Problem:** The function only selects `rent_card_id` from tenancies and returns one `rent_card_serial`. It doesn't fetch `rent_card_id_2`, so the verification page shows incomplete data for the new 2-card model.

**Fix:** Update `verify-tenancy/index.ts` to also select `rent_card_id_2`, fetch both card serials, and return `rent_card_serial_landlord` and `rent_card_serial_tenant` (with `card_role`).

---

## Gap 4: `DeclareExistingTenancy` Not Updated for 2-Card Model

**Problem:** The existing tenancy declaration flow still works with the old single-card model. It doesn't select 2 rent cards or set `card_role` or `rent_card_id_2`.

**Fix:** Update `DeclareExistingTenancy.tsx` to match `AddTenant.tsx` — require 2 available rent cards, label them landlord/tenant copy, set `card_role` on both, and link `rent_card_id_2` to the tenancy.

---

## Gap 5: `TenancyCard` Component Only Shows One Card Serial

**Problem:** The `TenancyCard` component has a single `rentCardSerial` prop. With the 2-card model, it should show both the landlord copy and tenant copy serials.

**Fix:** Add `rentCardSerial2` and `cardRole` to the `TenancyCardData` interface. Display both serials with their role labels on the tenancy card and PDF.

---

## Gap 6: Tenant Dashboard / `MyAgreements` Doesn't Show Card Role

**Problem:** When a tenant views their tenancy, they don't see which card is their copy vs the landlord's. The data is stored but not surfaced.

**Fix:** In tenant agreement views, fetch both `rent_card_id` and `rent_card_id_2` with their `card_role` and display the tenant's copy serial prominently.

---

## Files to Modify

| File | Change |
|---|---|
| `src/components/ProtectedRoute.tsx` | Check `account_status`, block deactivated/archived users |
| `src/pages/regulator/rent-cards/AdminActions.tsx` | Add Void Upload + Account Deactivate/Archive sections |
| `supabase/functions/verify-tenancy/index.ts` | Fetch and return both rent card serials |
| `src/pages/landlord/DeclareExistingTenancy.tsx` | Require 2 cards, set `card_role`, link `rent_card_id_2` |
| `src/components/TenancyCard.tsx` | Show both card serials with role labels |
| `src/lib/generateTenancyCardPdf.ts` | Include both serials in PDF |
| `src/pages/tenant/MyAgreements.tsx` | Surface card role info for tenant |
| `src/pages/shared/VerifyTenancy.tsx` | Display both card serials from updated API |

