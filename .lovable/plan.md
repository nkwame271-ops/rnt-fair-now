

# Plan: Delete Buttons, Account Management, Office Stock Overhaul, Assignment Simplification, Escrow Verification

---

## 1. Delete Buttons on Regulator Pages (Main Admin Only)

The `admin-action` edge function already has all delete cases implemented (`delete_complaint`, `delete_landlord_complaint`, `delete_application`, `delete_property`, `delete_agreement`, `delete_assessment`, `delete_rent_review`, `delete_termination`). The frontend pages just need delete buttons.

Each page gets a delete button per record, visible only to Main Admin, requiring `AdminPasswordConfirm` before calling the edge function.

**Files to modify:**
- `RegulatorComplaints.tsx` — add `useAdminProfile`, import `AdminPasswordConfirm`, add delete button per complaint row calling `delete_complaint` / `delete_landlord_complaint`
- `RegulatorApplications.tsx` — delete button per application calling `delete_application`
- `RegulatorProperties.tsx` — delete button per property calling `delete_property`
- `RegulatorAgreements.tsx` — delete button per agreement calling `delete_agreement`
- `RegulatorRentAssessments.tsx` — delete button per assessment calling `delete_assessment`
- `RegulatorRentReviews.tsx` — delete button per review calling `delete_rent_review`
- `RegulatorTerminations.tsx` — delete button per termination calling `delete_termination`

Each follows the same pattern:
1. Add state for `deletingId`, `deletePassword`, `showDeleteConfirm`
2. On confirm: call `supabase.functions.invoke("admin-action", { body: { action, target_id, reason, password } })`
3. On success: remove from local list, toast success
4. Button only renders when `profile?.isMainAdmin`

---

## 2. Account Management UI in EngineRoom

Move the account search/deactivate/archive/delete UI from `AdminActions.tsx` into `EngineRoom.tsx`.

**`EngineRoom.tsx`** — Add a new "Account Management" section (Main Admin only) with:
- Account type selector (landlord / tenant / admin)
- Search input
- Results display with Deactivate, Archive, Delete buttons
- `AdminPasswordConfirm` for destructive actions
- Calls existing `admin-action` edge function cases

**`AdminActions.tsx`** — Remove the Account Management section (lines ~37-42 state vars and the corresponding UI block). Keep only serial-related admin actions (Revoke Batch, Unassign Serial, Void Upload, Audit Log).

---

## 3. Office Stock Display Overhaul with Pair Terminology

**`OfficeSerialStock.tsx`** — Replace the current summary cards:

Current: Total Serials / Available / Assigned / Revoked

New display:
- **Opening Rent Card Pairs** — available pairs at start (available / 2)
- **Assigned Rent Card Pairs** — assigned / 2
- **Sold Rent Card Pairs** — count of serials with status "sold" / 2 (add "sold" status tracking)
- **Spoilt Rent Card Pairs** — count with status "spoilt" / 2
- **Closing Rent Card Pairs** — remaining available / 2

Add a secondary line under assigned showing "X serial numbers = Y rent card pairs" for clarity.

Update the `StockSummary` interface to include `sold` and `spoilt` counts. Update the fetch to track these statuses.

---

## 4. Simplified Quantity-Based Assignment in PendingPurchases

**`PendingPurchases.tsx`** — Replace the manual serial-by-serial picker dialog with:

1. After selecting cards and clicking "Assign Serials", show a simplified dialog:
   - **Quantity** field (pre-filled with selected card count, read-only)
   - **Optional "Start from serial"** input — if provided, assignment begins from that serial
   - **Optional "Select range"** — start and end serial inputs for bulk
   - Default behavior: auto-selects next available serials from office stock sequentially
2. Remove the `SerialSearchPicker` component and the per-card manual mapping
3. Keep the "Auto-fill sequential" concept but make it the default (no manual picking needed)
4. On confirm: fetch N available serials ordered by serial_number, assign them to the selected cards

The dialog becomes: "Assigning X cards. System will use next available serials from office stock." with a Confirm button.

---

## 5. Escrow/Paystack Split Verification

After reviewing `paystack-checkout/index.ts`, the dynamic split pipeline is already correctly implemented:
- Every payment type builds a `splitPlan` from DB via `getDynamicFee()` or `getTaxSplitPlan()`
- `buildPaystackSplit()` maps recipients to Paystack subaccount codes from `system_settlement_accounts`
- The split object is attached to every Paystack initialization call (line 776-778)
- All payment types (registration, rent_card, agreement_sale, complaint, listing, viewing, add_tenant, termination, renewal, archive_search, rent_tax) use this pipeline

No code changes needed. The split system is fully dynamic and DB-driven.

---

## Files to Create/Modify

| File | Change |
|---|---|
| `RegulatorComplaints.tsx` | Add Main Admin delete button |
| `RegulatorApplications.tsx` | Add Main Admin delete button |
| `RegulatorProperties.tsx` | Add Main Admin delete button |
| `RegulatorAgreements.tsx` | Add Main Admin delete button |
| `RegulatorRentAssessments.tsx` | Add Main Admin delete button |
| `RegulatorRentReviews.tsx` | Add Main Admin delete button |
| `RegulatorTerminations.tsx` | Add Main Admin delete button |
| `EngineRoom.tsx` | Add Account Management section |
| `AdminActions.tsx` | Remove Account Management section |
| `OfficeSerialStock.tsx` | Pair terminology overhaul |
| `PendingPurchases.tsx` | Simplified quantity-based assignment |

No database migrations or edge function changes needed — all backend actions already exist.

